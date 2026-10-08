// Budget mensile -> aggregati per il piano di cassa, l'IVA e il Conto Economico
// baseline. Modulo PURO e senza import: e' usato sia dal frontend React
// (Tesoreria) sia, in prospettiva, dalla Edge Function Deno del motore di
// valutazione d'impatto, cosi' cassa e CE partono dagli stessi numeri.
//
// Convenzione del budget: i valori di budget_voci sono NETTI (imponibili).
// `soggetto_iva` serve solo per aggiungere l'IVA sopra, nei flussi di cassa;
// il Conto Economico prende il valore netto cosi' com'e'.

export const MESI_KEYS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

const round2 = (n) => Math.round(n * 100) / 100

const VOCI_PERSONALE = ['personale', 'stipendi', 'salari', 'retribuzioni', 'tfr', 'inps', 'inail', 'oneri sociali', 'contributi', 'trattamento di fine rapporto', 'lavoro dipendente']
export const isPersonale = (desc) => VOCI_PERSONALE.some((p) => (desc || '').toLowerCase().includes(p))

// ---------------------------------------------------------------------------
// Classificazione strutturale delle voci di budget
// ---------------------------------------------------------------------------
// Si riconosce SOLO cio' che sta sotto l'EBITDA (o sotto l'utile ante imposte):
// ammortamenti/svalutazioni, oneri/proventi finanziari, imposte sul reddito.
// Tutto il resto e' operativo per default ("fallire chiudendo": un costo non
// riconosciuto resta dentro l'EBITDA, non lo gonfia). Definizione di EBITDA
// coerente con lib/xbrl.js: EBIT + ammortamenti e svalutazioni. Gli
// accantonamenti restano sopra l'EBITDA.
export const RE_IMPOSTE = /imposte?\s+(sul\s+reddito|correnti|differite|anticipate)|\bires\b|\birap\b/i
// "amm." da solo NON basta ("Comp.prof.consul.amm.va" = amministrativa): serve
// "amm. immobilizzazioni" oppure il prefisso di elenco "a) Amm."/"b) Amm."
export const RE_AMMORTAMENTI = /ammortament|^\s*[a-z]\)\s*amm\.|\bamm\.\s*imm|svalutaz/i
export const RE_ONERI_FIN = /interessi\s+passivi|int\.?\s*passiv|oneri\s+finanziari|interessi\s+e\s+altri\s+oneri|commission\w*\s+(su\s+)?fid|(spese|commission\w*)(\s+e\s+commission\w*)?\s+bancar|perdite\s+su\s+cambi/i
// Accantonamenti (B12/B13): sopra l'EBITDA (come lib/xbrl.js), ma non monetari
export const RE_ACCANTONAMENTI = /accantonament/i
// variazioni delle rimanenze (B11): solo Conto economico, nessun movimento di cassa
export const RE_RIMANENZE = /rimanenz|esistenze iniziali/i
export const RE_PROVENTI_FIN = /interessi\s+attivi|int\.?\s*attivi|proventi\s+finanziari|prov\.?\s*da\s+part/i

// Voci energetiche del budget (§2.3 "consumi energetici", §2.5g stress "costi energetici +30%"):
// riconosciute per descrizione, solo per lo scenario di stress (non cambiano CE né cassa base).
// L'elenco delle voci riconosciute si mostra all'utente perché lo verifichi.
export const RE_ENERGIA = /energia|elettric|\bgas\b|metano|carburant|combustibil|riscaldament/i

// Contributi previdenziali (INPS, INAIL, oneri sociali): dati certi con scadenza fiscale, si versano
// il 16 del mese successivo (F24), non con gli stipendi (§2.5b "Scadenze fiscali e previdenziali").
export const RE_CONTRIBUTI = /inps|inail|oneri\s+sociali|contribut|previdenz/i

// Voci di costo di natura stagionale (§2.5k "Usare medie annuali per costi stagionali")
export const RE_STAGIONALI = /energia|elettric|utenz|riscaldament|manutenz|premi|ferie|climatizz/i

// Etichette operative "standard" (le stesse gia' riconosciute da CE.js): servono
// solo a stimare quanta parte dell'operativo e' stata riconosciuta e quanta e'
// finita li' per default (avviso, non rifiuto).
const ETICHETTE_OPERATIVE_STANDARD = [
  'ricavi delle vendite', 'ricavi delle prestazioni', 'prestazioni di servizi', 'ricavi di spedizione', 'altri ricavi',
  'materie prime', 'costi di spedizione', 'servizi', 'godimento', 'affitti e locazioni', 'personale', 'salari e stipendi',
  'retribuzioni', 'oneri sociali', 'contributi', 'trattamento di fine rapporto', 'tfr', 'oneri diversi', 'altri oneri',
]

// tipo: 'ricavo_operativo' | 'provento_finanziario' | 'costo_operativo' | 'accantonamento' | 'ammortamento' | 'onere_finanziario' | 'imposta'
// esplicita: true se riconosciuta da una regola (strutturale o etichetta standard), false se operativa per default
export function classificaVoceBudget(descrizione, categoria) {
  const d = (descrizione || '').toLowerCase().trim()
  if (categoria === 'ricavi') {
    if (RE_PROVENTI_FIN.test(d)) return { tipo: 'provento_finanziario', esplicita: true }
    return { tipo: 'ricavo_operativo', esplicita: ETICHETTE_OPERATIVE_STANDARD.some((k) => d.includes(k)) }
  }
  if (RE_IMPOSTE.test(d)) return { tipo: 'imposta', esplicita: true }
  if (RE_AMMORTAMENTI.test(d)) return { tipo: 'ammortamento', esplicita: true }
  if (RE_ONERI_FIN.test(d)) return { tipo: 'onere_finanziario', esplicita: true }
  if (RE_ACCANTONAMENTI.test(d)) return { tipo: 'accantonamento', esplicita: true }
  return { tipo: 'costo_operativo', esplicita: ETICHETTE_OPERATIVE_STANDARD.some((k) => d.includes(k)) }
}

// ---------------------------------------------------------------------------
// Aggregazione mensile su una finestra di N mesi
// ---------------------------------------------------------------------------
// I mesi oltre dicembre di `anno` replicano lo stesso mese di calendario del
// budget di `anno` (budget "virtuale" dell'anno successivo, §3.2).
// Ogni mese contiene:
//  - Conto Economico (valori NETTI del budget, budget pieno, nessuna probabilita'):
//    ricavi_operativi, proventi_finanziari, costi_operativi, ammortamenti,
//    oneri_finanziari, imposte
//  - cassa: incassi (ricavi + IVA se soggetto_iva), fornitori (costi monetari non
//    personale + IVA se soggetto_iva), energia (idem, per le voci energetiche), personale (stipendi, nessuna IVA),
//    contributi (personale previdenziale, versati il 16 del mese dopo), imposte (accumulo: si pagano ad acconti). Esclusi
//    dalla cassa ammortamenti, svalutazioni e accantonamenti (non monetari)
//  - iva: vendite, acquisti, saldo (per competenza)
export function aggregaBudgetMensile(vociBudget, azienda, anno, meseInizio, orizzonte = 12, investimenti = [], manovreScorte = []) {
  const aliqV = (azienda?.aliquota_iva_vendite ?? 22) / 100
  const aliqA = (azienda?.aliquota_iva_acquisti ?? 22) / 100
  const voci = (vociBudget || []).map((v) => ({ ...v, classe: classificaVoceBudget(v.descrizione, v.categoria), personale: v.categoria === 'costi' && isPersonale(v.descrizione) }))

  const mesi = []
  for (let i = 0; i < orizzonte; i++) {
    const meseAssoluto = meseInizio + i
    const mese = ((meseAssoluto - 1) % 12) + 1
    const annoMese = anno + Math.floor((meseAssoluto - 1) / 12)
    const key = MESI_KEYS[mese - 1]
    const m = {
      anno: annoMese, mese, mese_budget: annoMese * 100 + mese, replica: annoMese > anno,
      ricavi_operativi: 0, proventi_finanziari: 0, costi_operativi: 0, ammortamenti: 0, oneri_finanziari: 0, imposte: 0,
      cassa: { incassi: 0, fornitori: 0, energia: 0, personale: 0, contributi: 0, imposte: 0, investimenti: 0, scorte: 0 },
      iva: { vendite: 0, acquisti: 0, saldo: 0 },
    }
    for (const v of voci) {
      const val = v[key] || 0
      if (!val) continue
      if (v.categoria === 'ricavi') {
        if (v.classe.tipo === 'provento_finanziario') m.proventi_finanziari += val
        else m.ricavi_operativi += val
        const iva = v.soggetto_iva ? val * aliqV : 0
        m.cassa.incassi += val + iva
        m.iva.vendite += iva
      } else {
        if (v.classe.tipo === 'imposta') m.imposte += val
        else if (v.classe.tipo === 'ammortamento') m.ammortamenti += val
        else if (v.classe.tipo === 'onere_finanziario') m.oneri_finanziari += val
        else m.costi_operativi += val
        // Costi NON monetari (ammortamenti, svalutazioni, accantonamenti): sono a CE
        // ma non escono dalla cassa e non hanno IVA. Il personale mantiene sempre il
        // suo trattamento (uscita certa, nessuna IVA). Imposte e oneri finanziari
        // restano uscite di cassa.
        const nonMonetario = !v.personale && (v.classe.tipo === 'ammortamento' || v.classe.tipo === 'accantonamento' || RE_RIMANENZE.test(v.descrizione || ''))
        if (nonMonetario) continue
        // Imposte sul reddito: non seguono i tempi dei fornitori ma il calendario degli acconti
        // (vedi imposteAnnue e caricaRigheDaBudget); qui si tiene solo l'accumulo mensile.
        if (v.classe.tipo === 'imposta') {
          m.cassa.imposte += val
          continue
        }
        // il personale non e' mai soggetto a IVA, qualunque sia il flag
        const iva = v.soggetto_iva && !v.personale ? val * aliqA : 0
        if (v.personale) {
          if (RE_CONTRIBUTI.test(v.descrizione || '')) m.cassa.contributi += val
          else m.cassa.personale += val
        }
        else if (RE_ENERGIA.test(v.descrizione || '')) m.cassa.energia += val + iva
        else m.cassa.fornitori += val + iva
        m.iva.acquisti += iva
      }
    }
    // Investimenti pianificati (scheda investimenti, §2.5f): esborso per tranche nel mese indicato,
    // con IVA se soggetto_iva. Non toccano il Conto Economico (l'ammortamento non e' modellato qui).
    for (const inv of investimenti || []) {
      for (const t of inv.tranche || []) {
        const [ty, tm] = String(t.mese || '').split('-').map(Number)
        if (ty * 100 + tm !== m.mese_budget) continue
        const netto = (inv.importo * (t.pct || 0)) / 100
        const iva = inv.soggetto_iva ? netto * aliqA : 0
        m.cassa.investimenti += netto + iva
        m.iva.acquisti += iva
      }
    }
    // Manovre sulle scorte e acquisti a lotto (§2.3): incremento/acquisto = esborso aggiuntivo non legato alla
    // produzione corrente; riduzione = minori acquisti (esborso negativo). Con IVA se soggetto_iva.
    for (const mv of manovreScorte || []) {
      const [ty, tm] = String(mv.mese || '').split('-').map(Number)
      if (ty * 100 + tm !== m.mese_budget) continue
      const netto = (mv.tipo === 'riduzione_scorte' ? -1 : 1) * mv.importo
      const iva = mv.soggetto_iva ? netto * aliqA : 0
      m.cassa.scorte += netto + iva
      m.iva.acquisti += iva
    }
    m.iva.saldo = m.iva.vendite - m.iva.acquisti
    mesi.push(m)
  }
  return mesi
}

// ---------------------------------------------------------------------------
// IVA per liquidazione (mensile o trimestrale), con riporto del credito
// ---------------------------------------------------------------------------
// Scadenze del versamento trimestrale per mese di chiusura del trimestre
// [mese, giorno] (a dicembre: febbraio dell'anno dopo).
const IVA_TRIMESTRALE = { 3: [5, 16], 6: [8, 20], 9: [11, 18], 12: [2, 16] }

// Il saldo di ogni periodo si somma al credito riportato dai periodi
// precedenti: se resta a debito si versa, se resta a credito il credito passa
// al periodo dopo (nessun rimborso in cassa dentro la finestra).
// Nota: in una finestra che inizia a meta' trimestre il primo trimestre
// contiene solo i mesi della finestra (i mesi precedenti sono gia' reali).
export function calcolaLiquidazioniIva(mesi, liquidazione = 'trimestrale') {
  const periodi = []
  let credito = 0
  const chiudi = (gruppo, meseVersamento) => {
    const vendite = round2(gruppo.reduce((s, m) => s + m.iva.vendite, 0))
    const acquisti = round2(gruppo.reduce((s, m) => s + m.iva.acquisti, 0))
    const creditoPrec = credito
    const saldoNetto = round2(vendite - acquisti - creditoPrec)
    const versamento = saldoNetto > 0 ? saldoNetto : 0
    credito = saldoNetto < 0 ? round2(-saldoNetto) : 0
    periodi.push({
      da: gruppo[0].mese_budget, a: gruppo[gruppo.length - 1].mese_budget,
      iva_vendite: vendite, iva_acquisti: acquisti, credito_precedente: creditoPrec,
      versamento, credito_riportato: credito, mese_versamento: meseVersamento.mese_budget, giorno_versamento: meseVersamento.giorno,
    })
  }

  if (liquidazione === 'mensile') {
    for (const m of mesi) {
      const mVers = (m.mese % 12) + 1
      const aVers = m.mese < 12 ? m.anno : m.anno + 1
      chiudi([m], { mese_budget: aVers * 100 + mVers, giorno: 16 })
    }
  } else {
    let acc = []
    for (const m of mesi) {
      acc.push(m)
      if ([3, 6, 9, 12].includes(m.mese)) {
        const [mVers, gVers] = IVA_TRIMESTRALE[m.mese]
        const aVers = mVers > 2 ? m.anno : m.anno + 1
        chiudi(acc, { mese_budget: aVers * 100 + mVers, giorno: gVers })
        acc = []
      }
    }
    // mesi dell'ultimo trimestre non ancora chiuso a fine finestra: non versati qui
  }
  return periodi
}

// ---------------------------------------------------------------------------
// Conto Economico baseline (budget pieno, costi netti) con waterfall
// ---------------------------------------------------------------------------
// EBITDA = ricavi operativi - costi operativi
// EBIT   = EBITDA - ammortamenti/svalutazioni
// oneri_finanziari (netti) = oneri finanziari - proventi finanziari
// utile (ante imposte) = EBIT - oneri_finanziari netti; le imposte sul reddito
// eventualmente a budget restano fuori dalla waterfall (voce `imposte_escluse`).
export function costruisciCeBaseline(mesi, vociBudget, meta = {}) {
  const righe = mesi.map((m) => {
    const ebitda = m.ricavi_operativi - m.costi_operativi
    const ebit = ebitda - m.ammortamenti
    const oneriNetti = m.oneri_finanziari - m.proventi_finanziari
    return {
      anno: m.anno, mese: m.mese, mese_budget: m.mese_budget, replica: m.replica,
      ricavi_operativi: round2(m.ricavi_operativi), costi_operativi: round2(m.costi_operativi), ammortamenti: round2(m.ammortamenti),
      oneri_finanziari: round2(oneriNetti), imposte_escluse: round2(m.imposte),
      ebitda: round2(ebitda), ebit: round2(ebit), utile: round2(ebit - oneriNetti),
    }
  })
  const somma = (k) => round2(righe.reduce((s, r) => s + r[k], 0))
  const totale = {
    ricavi_operativi: somma('ricavi_operativi'), costi_operativi: somma('costi_operativi'), ammortamenti: somma('ammortamenti'),
    oneri_finanziari: somma('oneri_finanziari'), imposte_escluse: somma('imposte_escluse'), ebitda: somma('ebitda'), ebit: somma('ebit'), utile: somma('utile'),
  }

  // quanta parte dell'operativo e' finita li' per default (nessuna regola l'ha riconosciuta)
  const classificate = (vociBudget || []).map((v) => ({ v, c: classificaVoceBudget(v.descrizione, v.categoria) }))
  const operativeDefault = classificate.filter(({ v, c }) => (c.tipo === 'ricavo_operativo' || c.tipo === 'costo_operativo') && !c.esplicita && (v.totale_annuo || 0) !== 0)
  const importoOperativo = classificate.filter(({ c }) => c.tipo === 'ricavo_operativo' || c.tipo === 'costo_operativo').reduce((s, { v }) => s + Math.abs(v.totale_annuo || 0), 0)
  const importoDefault = operativeDefault.reduce((s, { v }) => s + Math.abs(v.totale_annuo || 0), 0)
  const nonRiconosciuti = {
    n_voci: operativeDefault.length,
    n_voci_totali: classificate.length,
    importo: round2(importoDefault),
    pct_importo: importoOperativo ? round2((importoDefault / importoOperativo) * 100) : 0,
    descrizioni: operativeDefault.slice(0, 40).map(({ v }) => `${v.categoria}: ${(v.descrizione || '').trim()}`),
  }

  // Rifiuto solo se il budget manca o ha totali a zero: il motore risponde BASELINE_NON_DISPONIBILE
  const utilizzabile = classificate.length > 0 && (totale.ricavi_operativi !== 0 || totale.costi_operativi !== 0)
  return {
    convenzione: 'budget pieno, costi netti',
    utile_espresso: 'ante_imposte',
    finestra: { da: mesi[0]?.mese_budget ?? null, mesi: mesi.length },
    utilizzabile,
    mesi: righe,
    totale,
    non_riconosciuti: nonRiconosciuti,
    ...meta,
  }
}

// Imposte sul reddito annue a budget (somma dei 12 mesi delle voci "imposta"): base degli acconti.
export function imposteAnnue(vociBudget) {
  return round2(
    (vociBudget || [])
      .filter((v) => v.categoria === 'costi' && classificaVoceBudget(v.descrizione, v.categoria).tipo === 'imposta')
      .reduce((t, v) => t + MESI_KEYS.reduce((a, k) => a + (v[k] || 0), 0), 0)
  )
}

// Controllo di stagionalita' del budget (§2.5k): una voce con 12 mesi identici e' una media annuale.
// Il segnale che conta e' una voce di costo di tipo stagionale (energia, utenze, riscaldamento,
// manutenzione, premi...) piatta; la quota di voci piatte e' solo informativa (un'attivita'
// realmente costante puo' avere voci piatte).
export function analizzaStagionalita(vociBudget) {
  const attive = (vociBudget || []).filter((v) => (v.totale_annuo || 0) !== 0)
  const piatta = (v) => {
    const vals = MESI_KEYS.map((k) => v[k] || 0)
    return Math.max(...vals) === Math.min(...vals)
  }
  const piatte = attive.filter(piatta)
  const stagionaliPiatte = piatte.filter((v) => v.categoria === 'costi' && RE_STAGIONALI.test(v.descrizione || '')).map((v) => (v.descrizione || '').trim())
  return { n_voci: attive.length, n_piatte: piatte.length, pct_piatte: attive.length ? round2((piatte.length / attive.length) * 100) : 0, stagionali_piatte: stagionaliPiatte }
}

// Scheda investimento (§2.5f): payback semplice e attualizzato. Il beneficio netto annuo e' costante:
// beneficio annuo - maggiori costi operativi annui. Il payback attualizzato interpola linearmente
// nell'anno di rientro. Oltre 3 anni il documento chiede approfondimento o frazionamento in fasi.
export function calcolaPaybackInvestimento({ importo, impatto_costi_annuo = 0, beneficio_annuo = 0, tasso_attualizzazione_pct = 0 }) {
  const flusso = (beneficio_annuo || 0) - (impatto_costi_annuo || 0)
  if (!(flusso > 0) || !(importo > 0)) return { flusso_annuo: round2(flusso), payback_semplice: null, payback_attualizzato: null, oltre_3_anni: true, nota: 'Il beneficio netto annuo non è positivo: l\'investimento non si ripaga.' }
  const r = (tasso_attualizzazione_pct || 0) / 100
  let cum = 0
  let attualizzato = null
  for (let t = 1; t <= 100; t++) {
    const pv = flusso / Math.pow(1 + r, t)
    if (cum + pv >= importo) {
      attualizzato = t - 1 + (importo - cum) / pv
      break
    }
    cum += pv
  }
  const semplice = importo / flusso
  return {
    flusso_annuo: round2(flusso), payback_semplice: round2(semplice), payback_attualizzato: attualizzato == null ? null : round2(attualizzato),
    oltre_3_anni: (attualizzato ?? Infinity) > 3, nota: null,
  }
}
