import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { z } from 'npm:zod@3.23.8'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
// Motore e PDF: moduli puri condivisi col frontend del modulo Finanza e Controllo (stessa fonte di verita'
// della Tesoreria per cassa e Conto Economico).
import { calcolaSimulazione, ErroreMotore, VERSIONE_MOTORE, MODELLO_CASSA_MINIMO } from '../../../src/finanza/lib/impatto/motore.js'
import { generaPdfImpatto } from '../../../src/finanza/lib/impatto/pdf.js'
import { calcolaBudgetRettificato, annoEsercizio } from '../../../src/finanza/lib/impatto/budgetRettificato.js'
import { testoAnalisiEconomica, testoAnalisiFinanziaria } from '../../../src/finanza/lib/impatto/testiAnalisi.js'
import { richiedeUtenteAal2 } from '../_shared/mfa.ts'

// Simulazione d'impatto di una decisione (delibera/determina in bozza) calcolata in Pmi 360° sui dati del
// modulo Finanza e Controllo: baseline = ultima proiezione di Tesoreria salvata (fin_scenari_tesoreria),
// parametri = anagrafica finanziaria (fin_aziende). Motore e schema sono quelli del contratto v7/v8 nati con
// EasyPMI, portati qui senza cambiare la matematica: nessuna chiamata esterna.
//
// Garanzie:
//  1. riferimento e sintesi si scrivono SOLO dopo che i due PDF sono stati salvati nel bucket `fascicoli`;
//  2. se il salvataggio fallisce non resta nulla (file rimossi, nessuna riga) e l'esito e' un fallimento;
//  3. una nuova simulazione sulla stessa bozza SOSTITUISCE la precedente.

const VOCE_SIMULAZIONE = "Simulazione d'impatto (Finanza e Controllo)"
const VOCE_SIMULAZIONE_PRECEDENTE = "Simulazione d'impatto (EasyPMI)"

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
const risposta = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
const errore = (status: number, codice: string, messaggio: string, dettagli?: unknown) =>
  risposta(status, { errore: { codice, messaggio, ...(dettagli ? { dettagli } : {}) } })

async function sha256Hex(bytes: Uint8Array) {
  const h = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------- schema della decisione (v8)
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'formato atteso AAAA-MM-GG').refine((s) => {
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}, 'data di calendario non valida')

// Campi comuni a tutti i tipi (v8, proposta Pmi 360°). iva_regime sostituisce iva_pct (v7): "ordinaria" applica
// l'aliquota dell'anagrafica Finanza e Controllo (§4.F), "esente"/"non_soggetta" non applicano IVA ai movimenti della decisione.
const Comuni = z.object({
  descrizione: z.string().trim().min(1).max(500),
  data_decorrenza: dataIso,
  iva_regime: z.enum(['ordinaria', 'esente', 'non_soggetta']).default('ordinaria'),
  ipotesi_ricavi: z.object({
    modalita: z.enum(['incremento_pct', 'euro_mese']),
    valore: z.number().finite(),
    mese_partenza: dataIso,
  }).strict().optional(),
})

// Strict ovunque: un campo sbagliato o con refuso (es. "maxicanon") NON viene ignorato in silenzio, perché su
// input finanziari sarebbe uno zero silenzioso.
const Leasing = z.object({
  tipo_impatto: z.literal('leasing'),
  imponibile: z.number().finite().positive(),
  // iva_pct (v7) rimosso dallo schema: dalla v8 non si invia più per nessun tipo,
  // leasing incluso (fa fede iva_regime, comune). Se qualcuno lo invia ancora, 422 come per ogni campo sconosciuto.
  leasing: z.object({
    metodo_contabile: z.enum(['patrimoniale', 'finanziario']).default('patrimoniale'),
    maxicanone: z.number().finite().min(0),
    numero_rate: z.number().int().positive().max(600),
    periodicita: z.literal('mensile'),
    tasso_annuo_pct: z.number().finite().min(0).max(100).optional(),   // solo se finanziario
    riscatto: z.number().finite().min(0).default(0),
    canone: z.number().finite().positive().optional(),                  // rata periodica IVA esclusa; se assente si ricava (con avviso)
  }).strict(),
  costi_esercizio_mensili: z.number().finite().min(0).default(0),
  ammortamento: z.object({ durata_mesi: z.number().int().positive().max(600) }).strict().optional(), // solo se finanziario
}).merge(Comuni).strict()
// NOTA: niente .superRefine() qui — trasformerebbe Leasing in uno ZodEffects, che discriminatedUnion rifiuta come
// membro (richiede un ZodObject puro). Il controllo "finanziario -> tasso/ammortamento obbligatori" si fa dopo
// l'unione, insieme a quello comune sull'ipotesi_ricavi.

// acquisto_bene: acquisto diretto di un bene da capitalizzare.
const PagamentoAcquisto = z.discriminatedUnion('modalita', [
  z.object({ modalita: z.literal('unico') }).strict(),
  z.object({ modalita: z.literal('acconto_saldo'), acconto_pct: z.number().finite().min(0).max(100) }).strict(),
  z.object({ modalita: z.literal('rate'), numero_rate: z.number().int().positive().max(120), periodicita: z.enum(['mensile', 'trimestrale', 'semestrale']) }).strict(),
]).default({ modalita: 'unico' })
const AmmortamentoBene = z.union([
  z.object({ durata_mesi: z.number().int().positive().max(600) }).strict(),
  z.object({ aliquota_annua_pct: z.number().finite().positive().max(100) }).strict(),
])
const ContributoBene = z.object({
  descrizione: z.string().trim().min(1).max(300),
  importo: z.number().finite().positive(),
  data_incasso: dataIso,
  natura: z.enum(['credito_imposta', 'contributo_conto_impianti', 'contributo_conto_esercizio']),
}).strict()
const AcquistoBene = z.object({
  tipo_impatto: z.literal('acquisto_bene'),
  imponibile: z.number().finite().positive(),
  pagamento: PagamentoAcquisto,
  ammortamento: AmmortamentoBene,
  data_entrata_in_funzione: dataIso.optional(),
  costi_esercizio_mensili: z.number().finite().min(0).default(0),
  contributi: z.array(ContributoBene).max(20).optional(),
}).merge(Comuni).strict()

// finanziamento: solo forma "rateale" in questa fase (la "linea_di_credito" resta da implementare).
const Finanziamento = z.object({
  tipo_impatto: z.literal('finanziamento'),
  forma: z.literal('rateale'),
  importo: z.number().finite().positive(),
  data_erogazione: dataIso,
  tasso_annuo_pct: z.number().finite().min(0).max(100),
  numero_rate: z.number().int().positive().max(600),
  periodicita: z.enum(['mensile', 'trimestrale', 'semestrale']),
  piano: z.enum(['francese', 'italiano', 'bullet']),
  preammortamento_mesi: z.number().finite().min(0).max(600).default(0),
  spese_istruttoria: z.number().finite().min(0).default(0),
}).merge(Comuni).strict()

// Voce di bilancio di un costo (tipologia di spesa) per il budget rettificato
const VoceCe = z.enum(['B6', 'B7', 'B8', 'B14'])

// costo_ricorrente: servizi, consulenze, locazione passiva, canoni software, contratti di marketing.
const SuccessFee = z.object({ importo: z.number().finite().positive(), data_prevista: dataIso }).strict()
const CostoRicorrente = z.object({
  tipo_impatto: z.literal('costo_ricorrente'),
  categoria: z.enum(['servizi', 'consulenza', 'locazione_passiva', 'canone_software', 'marketing', 'altro']),
  importo_periodico: z.number().finite().positive(),
  periodicita_fatturazione: z.enum(['mensile', 'trimestrale', 'semestrale', 'annuale']),
  pagamento_anticipato: z.boolean().default(false),
  durata_mesi: z.number().int().positive().max(600),
  indicizzazione_annua_pct: z.number().finite().min(0).max(100).default(0),
  una_tantum_iniziale: z.number().finite().positive().optional(),
  deposito_cauzionale: z.number().finite().positive().optional(),
  success_fee: SuccessFee.optional(),  // inclusa solo negli scenari base e best
  voce_ce: VoceCe.optional(),           // tipologia di spesa: voce di bilancio (se assente, quella tipica della categoria)
}).merge(Comuni).strict()

// costo_una_tantum: evento, sponsorizzazione, adeguamento normativo, manutenzione non capitalizzata.
const PianoPagamentiUnaTantum = z.array(z.object({ data: dataIso, importo: z.number().finite().positive() }).strict()).min(1).max(24)
const CostoUnaTantum = z.object({
  tipo_impatto: z.literal('costo_una_tantum'),
  categoria: z.enum(['evento', 'sponsorizzazione', 'adeguamento', 'manutenzione', 'spese_legali', 'altro']),
  importo: z.number().finite().positive(),
  piano_pagamenti: PianoPagamentiUnaTantum.optional(),
  voce_ce: VoceCe.optional(),
}).merge(Comuni).strict()

// personale: assunzioni, uscite, variazioni di organico. contributi_pct e mensilita sono OBBLIGATORI (confermato
// da Pmi 360°: l'aliquota INPS effettiva dell'azienda + INAIL, presa dai dati reali del cedolino/avviso INAIL —
// mai un default per inquadramento). Il TFR (RAL/13,5, art. 2120 c.c.) lo calcola il motore.
const CostiUnaTantumPersonale = z.array(z.object({ descrizione: z.string().trim().min(1).max(300), importo: z.number().finite().positive() }).strict()).max(10)
const Sgravi = z.object({ riduzione_contributi_pct: z.number().finite().min(0).max(100), durata_mesi: z.number().int().positive().max(600) }).strict()
const BonusVariabile = z.object({ importo_annuo: z.number().finite().positive(), mese_pagamento: dataIso }).strict()
const Personale = z.object({
  tipo_impatto: z.literal('personale'),
  movimento: z.enum(['ingresso', 'uscita']),
  numero_persone: z.number().int().positive().max(1000).default(1),
  inquadramento: z.enum(['dirigente', 'quadro', 'impiegato', 'operaio']),  // solo descrittivo: non influenza il calcolo
  ral_annua: z.number().finite().positive(),                              // per persona
  mensilita: z.union([z.literal(13), z.literal(14)]),
  contributi_pct: z.number().finite().min(0).max(100),                    // aliquota reale dell'azienda (INPS+INAIL), obbligatoria
  durata_mesi: z.number().int().positive().max(600).optional(),           // solo "ingresso": vuoto = tempo indeterminato
  benefit_annui: z.number().finite().min(0).default(0),
  bonus_variabile: BonusVariabile.optional(),
  costi_una_tantum: CostiUnaTantumPersonale.optional(),                   // selezione, head hunter, formazione: importi complessivi, non per persona
  incentivo_esodo: z.number().finite().min(0).optional(),                 // solo "uscita": importo complessivo, non per persona
  sgravi: Sgravi.optional(),
}).merge(Comuni).strict()

// Unione dei tipi "semplici" (un solo componente): usata sia da sola sia dentro "composta" (§5, richiesta
// aggiuntiva Pmi 360°). Una composta non può annidare un'altra composta: i suoi componenti sono sempre di questa
// unione, mai z.literal('composta').
const DecisioneSemplice = z.discriminatedUnion('tipo_impatto', [Leasing, AcquistoBene, Finanziamento, CostoRicorrente, CostoUnaTantum, Personale])

// Vincoli comuni a ogni componente, applicati sia al tipo singolo sia a ciascun elemento di "componenti".
function validaComponente(d: z.infer<typeof DecisioneSemplice>, ctx: z.RefinementCtx, path: (string | number)[] = []) {
  if (d.ipotesi_ricavi && d.ipotesi_ricavi.mese_partenza.slice(0, 7) < d.data_decorrenza.slice(0, 7)) {
    ctx.addIssue({ code: 'custom', path: [...path, 'ipotesi_ricavi', 'mese_partenza'], message: 'i ricavi non possono partire prima della decorrenza' })
  }
  if (d.tipo_impatto === 'leasing' && d.leasing.metodo_contabile === 'finanziario') {
    if (d.leasing.tasso_annuo_pct === undefined) ctx.addIssue({ code: 'custom', path: [...path, 'leasing', 'tasso_annuo_pct'], message: 'obbligatorio con metodo_contabile "finanziario"' })
    if (!d.ammortamento) ctx.addIssue({ code: 'custom', path: [...path, 'ammortamento'], message: 'obbligatorio con metodo_contabile "finanziario"' })
  }
}

// composta: fino a 5 componenti, ciascuno con la propria decorrenza (§5, richiesta aggiuntiva Pmi 360°). Nessun
// campo comune a livello di composta (descrizione a parte): iva_regime/data_decorrenza/ipotesi_ricavi stanno
// dentro ogni componente, non ripetuti qui.
const Composta = z.object({
  tipo_impatto: z.literal('composta'),
  descrizione: z.string().trim().min(1).max(500),
  componenti: z.array(DecisioneSemplice).min(1).max(5),
}).strict()

const Decisione = z.discriminatedUnion('tipo_impatto', [Leasing, AcquistoBene, Finanziamento, CostoRicorrente, CostoUnaTantum, Personale, Composta]).superRefine((d, ctx) => {
  if (d.tipo_impatto === 'composta') d.componenti.forEach((c, i) => validaComponente(c, ctx, ['componenti', i]))
  else validaComponente(d, ctx)
})


// ---------------------------------------------------------------- baseline (§4.G)
// Il baseline e' l'ultima proiezione di Tesoreria salvata con il modello di cassa attuale (snapshot CE + IVA).
// Niente baseline = "non calcolabile", mai zeri.
function valutaBaseline(riga: Record<string, any> | null): { ok: true; baseline: any } | { ok: false; motivo: string } {
  if (!riga) return { ok: false, motivo: 'Nessuna proiezione di Tesoreria salvata per questa azienda: elaborare prima la Tesoreria.' }
  const piano = riga.piano_json
  if (!piano || !Array.isArray(piano.mesi) || piano.mesi.length === 0) return { ok: false, motivo: 'L\'ultima proiezione salvata è vuota: rigenerarla in Tesoreria.' }
  if (!piano.ce_baseline || !piano.iva_baseline || (piano.modello_cassa ?? 0) < MODELLO_CASSA_MINIMO) {
    return { ok: false, motivo: 'L\'ultima proiezione e\' stata calcolata con un modello di cassa precedente (mancano baseline economico, IVA, linee di credito o costi energetici per gli stress test): rigenerarla in Tesoreria.' }
  }
  if (piano.ce_baseline.utilizzabile === false) return { ok: false, motivo: 'Il budget usato dalla proiezione è vuoto o a totali zero: il baseline economico non è calcolabile.' }
  // creato_il è timestamp SENZA fuso, scritto dall'app in UTC via toISOString(): si aggiunge la Z [ASSUNTO, contratto §7]
  const generato = new Date(String(riga.creato_il).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(riga.creato_il)) ? '' : 'Z'))
  return { ok: true, baseline: { scenario_id: riga.id, generato_il: generato.toISOString(), fonte: 'scenari_tesoreria.piano_json (cassa + snapshot CE)', piano } }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  const negato = await richiedeUtenteAal2(req, headers)
  if (negato) return negato
  if (req.method !== 'POST') return errore(405, 'METODO_NON_CONSENTITO', 'Usa POST.')

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const db = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
  const dbJson = { ...db, 'Content-Type': 'application/json' }
  const storage = `${supabaseUrl}/storage/v1/object/fascicoli`

  let body: { determina_id?: string; decisione?: Record<string, unknown> }
  try { body = await req.json() } catch { return errore(400, 'JSON_MALFORMATO', 'Corpo della richiesta non valido.') }
  const { determina_id, decisione } = body || {}
  if (!determina_id || !decisione) return errore(400, 'PARAMETRI_MANCANTI', 'determina_id e decisione sono obbligatori.')

  // ── Chi chiama: utente autenticato, collegato all'azienda della determina ──
  const ur = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { 'apikey': serviceKey, 'Authorization': req.headers.get('Authorization') || '' } })
  const utente = ur.ok ? await ur.json() : null
  if (!utente?.id) return errore(401, 'NON_AUTORIZZATO', 'Sessione non valida.')

  const dr = await fetch(`${supabaseUrl}/rest/v1/determine?id=eq.${encodeURIComponent(determina_id)}&select=id,azienda_id,stato,con_analisi_economica`, { headers: db })
  const det = (await dr.json())[0]
  if (!det) return errore(404, 'DETERMINA_NON_TROVATA', 'Atto non trovato.')
  const lr = await fetch(`${supabaseUrl}/rest/v1/utente_aziende?utente_id=eq.${utente.id}&azienda_id=eq.${det.azienda_id}&select=azienda_id`, { headers: db })
  if (!(await lr.json())[0]) return errore(403, 'NON_AUTORIZZATO', 'Non hai accesso a questa azienda.')
  if (det.stato !== 'bozza') return errore(409, 'ATTO_NON_IN_BOZZA', "La simulazione si può allegare solo a un atto in bozza.")
  if (det.con_analisi_economica === false) return errore(409, 'ATTO_SENZA_IMPEGNO', "L'atto non prevede un impegno economico-finanziario.")
  // ── Decisione: schema rigido (un campo sbagliato non diventa uno zero silenzioso) ──
  const parsed = Decisione.safeParse(decisione)
  if (!parsed.success) {
    const dettagli = parsed.error.issues.map((i) => ({ campo: i.path.join('.') || '(radice)', messaggio: i.message }))
    return errore(422, 'INPUT_NON_VALIDO', `Richiesta non valida: ${dettagli.slice(0, 3).map((d) => `${d.campo}: ${d.messaggio}`).join('; ')}${dettagli.length > 3 ? '…' : ''}`, dettagli)
  }
  const richiesta = { determina_ref: determina_id, decisione: parsed.data }

  // ── Dati del modulo Finanza e Controllo: anagrafica finanziaria e ultima proiezione di Tesoreria ──
  const t0 = performance.now()
  // (non dalla vista fin_aziende: filtra sull'utente collegato e con la chiave di servizio sarebbe vuota)
  const azr = await fetch(`${supabaseUrl}/rest/v1/aziende?id=eq.${det.azienda_id}&select=id,nome,piva`, { headers: db })
  const anag = azr.ok ? (await azr.json())[0] : null
  if (!anag) return errore(404, 'AZIENDA_NON_TROVATA', 'Azienda non trovata.')
  const par = await fetch(`${supabaseUrl}/rest/v1/fin_parametri_azienda?azienda_id=eq.${det.azienda_id}&select=*`, { headers: db })
  const parametri = par.ok ? ((await par.json())[0] || {}) : {}
  const azienda = { ...parametri, id: anag.id, nome: anag.nome, partita_iva: anag.piva }
  const scr = await fetch(`${supabaseUrl}/rest/v1/fin_scenari_tesoreria?azienda_id=eq.${det.azienda_id}&select=*&order=creato_il.desc&limit=1`, { headers: db })
  const scenario = scr.ok ? ((await scr.json())[0] || null) : null
  const b = valutaBaseline(scenario)
  if (!b.ok) return errore(409, 'BASELINE_NON_DISPONIBILE', b.motivo)

  // voci di budget non riconosciute nel CE baseline: avviso non bloccante (§4.M)
  const avvisi: { codice: string; messaggio: string }[] = []
  const nr = scenario.piano_json.ce_baseline.non_riconosciuti
  if (nr?.n_voci > 0) avvisi.push({ codice: 'VOCI_BUDGET_OPERATIVE_PER_DEFAULT', messaggio: `${nr.n_voci} voci di budget (${nr.pct_importo}% dell'importo operativo) trattate come operative per default nel CE baseline` })

  let risultato: any
  try {
    risultato = calcolaSimulazione({ richiesta, azienda, scenarioRow: scenario })
  } catch (e) {
    if (e instanceof ErroreMotore) return errore(e.codice === 'FUORI_FINESTRA' ? 409 : 422, e.codice === 'FUORI_FINESTRA' ? 'BASELINE_NON_DISPONIBILE' : e.codice, e.message)
    console.error('simulazione-impatto: motore', e)
    return errore(500, 'ERRORE_INTERNO', 'Errore nel calcolo della simulazione.')
  }
  for (const a of avvisi) if (!risultato.avvisi.some((x: any) => x.codice === a.codice)) risultato.avvisi.push(a)

  // ── Analisi di impatto economico sul budget approvato dell'esercizio in cui decorre la decisione ──
  const anno = annoEsercizio(parsed.data)
  const bur = await fetch(`${supabaseUrl}/rest/v1/fin_budget?azienda_id=eq.${det.azienda_id}&anno=eq.${anno}&stato=eq.approvato&select=id,approvato_il,creato_il&order=approvato_il.desc.nullslast,creato_il.desc&limit=1`, { headers: db })
  const budget = bur.ok ? ((await bur.json())[0] || null) : null
  if (!budget) return errore(409, 'BUDGET_NON_DISPONIBILE', `Manca il budget ${anno} approvato: la decisione decorre nel ${anno}. Approva il budget ${anno} in Finanza e Controllo e ripeti la simulazione.`)
  const vbr = await fetch(`${supabaseUrl}/rest/v1/fin_budget_voci?budget_id=eq.${budget.id}&select=*`, { headers: db })
  const vociBudget = vbr.ok ? await vbr.json() : []
  if (!vociBudget.length) return errore(409, 'BUDGET_NON_DISPONIBILE', `Il budget ${anno} approvato non ha voci.`)
  try {
    risultato.budget_rettificato = { budget_id: budget.id, ...calcolaBudgetRettificato({ decisione: parsed.data, vociBudget, anno, azienda }) }
  } catch (e) {
    console.error('simulazione-impatto: budget rettificato', e)
    return errore(500, 'ERRORE_INTERNO', 'Errore nel calcolo del budget rettificato.')
  }
  const dataSimulazione = new Date().toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })
  const testi = {
    analisi_economica: testoAnalisiEconomica(risultato.budget_rettificato, dataSimulazione),
    analisi_finanziaria: testoAnalisiFinanziaria(risultato, dataSimulazione),
  }

  const simulazioneId = crypto.randomUUID()
  let pdf: { economico: Uint8Array; finanziario: Uint8Array }
  try {
    pdf = await generaPdfImpatto({ PDFDocument, StandardFonts, rgb }, { azienda, richiesta, risultato, simulazioneId, creatoIl: new Date().toISOString() })
  } catch (e) {
    console.error('simulazione-impatto: pdf', e)
    return errore(500, 'ERRORE_INTERNO', 'Errore nella generazione dei PDF della simulazione.')
  }
  const durataMs = Math.round(performance.now() - t0)

  // ── Salvataggio dei due PDF nel fascicolo ──
  const caricati: string[] = []
  const rimuovi = async (paths: string[]) => {
    if (!paths.length) return
    await fetch(storage, { method: 'DELETE', headers: dbJson, body: JSON.stringify({ prefixes: paths }) }).catch(() => {})
  }
  const DOC = [
    { chiave: 'pdf_economico', tipo: 'economico', nome: 'Simulazione impatto economico.pdf' },
    { chiave: 'pdf_finanziario', tipo: 'finanziario', nome: 'Simulazione impatto finanziario.pdf' },
  ] as const
  const allegati: Record<string, unknown>[] = []
  const documenti: Record<string, unknown> = {}
  try {
    const ts = Date.now()
    for (const d of DOC) {
      const bytes = pdf[d.tipo]
      const path = `${det.azienda_id}/${determina_id}/${ts}-${d.nome.replace(/[^\w.\-]+/g, '_')}`
      const up = await fetch(`${storage}/${path}`, { method: 'POST', headers: { ...db, 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: bytes })
      if (!up.ok) throw new Error(`upload ${d.chiave}: ${up.status}`)
      caricati.push(path)
      allegati.push({ azienda_id: det.azienda_id, determina_id, voce: VOCE_SIMULAZIONE, nome_file: d.nome, storage_path: path, dimensione: bytes.length })
      documenti[d.chiave] = { tipo: 'fascicolo', sha256: await sha256Hex(bytes), bytes: bytes.length }
    }
  } catch (e) {
    await rimuovi(caricati)
    return errore(502, 'SALVATAGGIO_PDF_FALLITO', 'Non è stato possibile salvare i PDF della simulazione: nessun allegato è stato aggiunto. Riprova.', String((e as Error)?.message || e))
  }

  // ── Solo ora si scrivono i riferimenti (sostituendo la simulazione precedente) ──
  const vr = await fetch(`${supabaseUrl}/rest/v1/determina_allegati?determina_id=eq.${determina_id}&voce=in.(${encodeURIComponent(`"${VOCE_SIMULAZIONE}","${VOCE_SIMULAZIONE_PRECEDENTE}"`)})&select=id,storage_path`, { headers: db })
  const vecchi: { id: string; storage_path: string }[] = vr.ok ? await vr.json() : []

  // Sintesi: stessa forma di sempre (contratto v7/v8), letta dalla pagina e dal fascicolo BJR
  const sintesi = {
    simulazione_id: simulazioneId,
    azienda: { trovata: true, nome: azienda.nome },
    baseline: risultato.baseline,
    ipotesi_usate: risultato.ipotesi_usate,
    avvisi: risultato.avvisi,
    range_storico_ricavi: risultato.range_storico_ricavi,
    scenari: risultato.scenari,
    stress_test: risultato.stress_test,
    confronto_baseline: risultato.confronto_baseline,
    alert: risultato.alert,
    budget_rettificato: risultato.budget_rettificato,
    testi,
    ...(risultato.dettaglio_componenti ? { dettaglio_componenti: risultato.dettaglio_componenti } : {}),
    ...(risultato.piano_rate ? { piano_rate: risultato.piano_rate } : {}),
    documenti,
    versione_motore: VERSIONE_MOTORE,
    motore: 'Pmi 360° Finanza e Controllo',
    durata_ms: durataMs,
  }

  const ar = await fetch(`${supabaseUrl}/rest/v1/determina_allegati`, { method: 'POST', headers: { ...dbJson, 'Prefer': 'return=representation' }, body: JSON.stringify(allegati) })
  const nuovi: { id: string }[] = ar.ok ? await ar.json() : []
  if (!ar.ok) { await rimuovi(caricati); return errore(500, 'SALVATAGGIO_FALLITO', 'Salvataggio degli allegati non riuscito: nessun allegato è stato aggiunto.') }

  const sr = await fetch(`${supabaseUrl}/rest/v1/determina_simulazioni?on_conflict=determina_id`, {
    method: 'POST',
    headers: { ...dbJson, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      determina_id, azienda_id: det.azienda_id, simulazione_id: simulazioneId,
      richiesta: parsed.data, sintesi, versione_motore: VERSIONE_MOTORE,
      creata_da: utente.id, created_at: new Date().toISOString(),
    }),
  })
  if (!sr.ok) {
    await fetch(`${supabaseUrl}/rest/v1/determina_allegati?id=in.(${nuovi.map(n => n.id).join(',')})`, { method: 'DELETE', headers: db })
    await rimuovi(caricati)
    return errore(500, 'SALVATAGGIO_FALLITO', 'Salvataggio della sintesi non riuscito: nessun allegato è stato aggiunto.')
  }

  // Rimozione della simulazione precedente (best-effort: la nuova è già completa)
  if (vecchi.length) {
    await fetch(`${supabaseUrl}/rest/v1/determina_allegati?id=in.(${vecchi.map(v => v.id).join(',')})`, { method: 'DELETE', headers: db }).catch(() => {})
    await rimuovi(vecchi.map(v => v.storage_path))
  }

  return risposta(200, { simulazione: (await sr.json())[0] })
})
