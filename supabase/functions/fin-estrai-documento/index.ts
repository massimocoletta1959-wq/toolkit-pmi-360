// Edge Function: fin-estrai-documento (modulo Finanza e Controllo di Pmi 360°)
// Portata da EasyPMI (estrai-documento): stessa logica, tabella fin_documenti e in più
// il controllo che il documento appartenga a un'azienda accessibile a chi chiama.
//
// Riceve testo (o immagini di pagine PDF scansionate) già estratti lato client,
// costruisce lo stesso prompt del vecchio backend/services/ai/estrattore.py e
// chiama l'API Anthropic tenendo la chiave come secret (mai esposta al browser).
//
// ASINCRONA: risponde subito ({ avviato: true }) dopo aver segnato il documento
// come "elaborando", e continua il lavoro vero (chiamata Anthropic + salvataggio
// risultato) in background con EdgeRuntime.waitUntil(). Necessario perché su
// documenti densi la generazione AI può superare il limite di tempo di una
// singola richiesta HTTP sincrona (era la causa dei 504 "gateway timeout").
// Il frontend fa polling sullo stato del documento finché non diventa
// 'elaborato' o 'errore'.
//
// Deploy protetto di default: Supabase verifica il JWT dell'utente autenticato
// prima di invocare questa funzione (nessun --no-verify-jwt usato), quindi solo
// chi ha fatto login nell'app può chiamarla.
//
// Nota sul modello: il vecchio backend usava "claude-opus-4-6" (stringa non
// riconosciuta tra i modelli Claude attuali). Qui uso "claude-sonnet-5" —
// cambialo pure se preferisci un altro modello attuale.

import { createClient } from 'npm:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
// Haiku, non Sonnet: questo è un compito di estrazione dati strutturati
// (pattern matching su testo contabile -> JSON), non ragionamento complesso.
// Un modello "Sonnet" tende a "ragionarci sopra" molto più a lungo per lo
// stesso risultato — su questo task è overkill e va lentissimo (era la causa
// dei timeout: non la dimensione del documento, ma il modello scelto).
const MODEL = 'claude-haiku-4-5-20251001'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatoJson(tipoDocumento: string, anno: string): string {
  return JSON.stringify({
    tipo_documento: tipoDocumento,
    anno,
    ricavi: { totale: 0, voci: [{ descrizione: 'nome voce', importo: 0, dettaglio: [{ conto: '60100', descrizione: 'nome conto', importo: 0 }] }] },
    costi: { totale: 0, voci: [{ descrizione: 'nome voce', importo: 0, dettaglio: [{ conto: '60100', descrizione: 'nome conto', importo: 0 }] }] },
    ammortamenti: 0,
    oneri_finanziari: 0,
    margine_operativo: 0,
    ebitda: 0,
    imposte: 0,
    risultato_esercizio: 0,
    patrimonio_netto: 0,
    totale_attivo: 0,
    totale_debiti: 0,
    attivo_circolante: 0,
    totale_immobilizzazioni: 0,
    disponibilita_liquide: 0,
    crediti_clienti: 0,
    tfr: 0,
    debiti_breve: 0,
    note: '',
  })
}

function puliciJson(testo: string): unknown {
  const t = testo.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
  try {
    return JSON.parse(t)
  } catch {
    // Il modello a volte aggiunge del testo prima/dopo il JSON nonostante le
    // istruzioni: come fallback prendiamo la sottostringa tra la prima { e
    // l'ultima } e riproviamo.
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1))
    throw new Error('JSON non trovato nella risposta')
  }
}

// Aggiunta a ogni prompt per ridurre il rischio di troncamento/risposte lente:
// il modello a volte genera JSON con indentazione e testo di contorno
// nonostante le istruzioni, gonfiando inutilmente l'output.
const ISTRUZIONE_COMPATTEZZA = `

IMPORTANTE SUL FORMATO OUTPUT: rispondi con SOLO l'oggetto JSON, compatto su una
riga sola (nessuna indentazione, nessuno spazio dopo i due punti o le virgole),
senza alcun testo, spiegazione o markdown prima o dopo. Se il documento elenca
moltissimi conti analitici, includi comunque il campo 'dettaglio' ma con le sole
chiavi conto/descrizione/importo, senza aggiungere altri campi o commenti.`

function promptTesto(tipoFile: string, tipoDocumento: string, anno: string, contenuto: string): string {
  const fmt = formatoJson(tipoDocumento, anno)

  if (tipoFile === 'excel') {
    return `Sei un esperto contabile italiano. Analizza questo file Excel con dati finanziari.
Tipo: ${tipoDocumento} - Anno: ${anno}
ISTRUZIONI IMPORTANTI:
1. Cerca le colonne con codice conto e descrizione conto
2. Per ogni voce estrai: codice_conto, descrizione, importo
3. Il codice conto è spesso numerico (es. 663001000001)
4. Separa ricavi da costi in base al tipo di conto
5. ESCLUDI ammortamenti e oneri finanziari dai costi operativi
6. Se presente, estrai anche dati Stato Patrimoniale: totale_attivo, attivo_circolante, disponibilita_liquide, crediti_clienti, patrimonio_netto, tfr, totale_debiti, debiti_breve

Contenuto:
${contenuto}

Restituisci SOLO JSON valido senza backtick con questa struttura:
${fmt}${ISTRUZIONE_COMPATTEZZA}`
  }

  if (tipoDocumento === 'provvisorio') {
    return `Sei un esperto contabile italiano. Analizza questa situazione contabile gestionale.
Anno: ${anno}

=== CONTO ECONOMICO ===
ATTENZIONE: il prefisso numerico dei codici conto NON è uno standard — ogni
gestionale/azienda numera i conti a modo suo (in alcuni "5x" sono ricavi e
"6x-7x" costi, in altri i ricavi sono in "70-72" e i costi in "60-66", ecc.).
NON dedurre ricavi/costi dal prefisso del codice. Usa invece:
1. La struttura reale del documento: di solito il Conto Economico è mostrato
   in due colonne/sezioni affiancate o consecutive, intestate esplicitamente
   "COSTI" e "RICAVI" (o "Valore della produzione" per i ricavi, "Costi della
   produzione" per i costi) — segui quella struttura, non il numero del conto.
2. In alternativa, usa il significato della descrizione del conto (es. "Ricavi
   corrispettivi", "Affitti", "Contributi" sono ricavi; "Acquisto", "Servizi",
   "Personale" sono costi).
3. Per ogni voce estrai: codice, descrizione, importo (sempre POSITIVO)
4. Ammortamenti: identificali dalla descrizione ("ammortamento", "svalutazione"), qualunque sia il codice conto
5. Oneri finanziari: identificali dalla descrizione ("interessi passivi", "oneri finanziari", "spese banca", "commissioni bancarie"), qualunque sia il codice conto
6. Imposte: SOLO imposte sul reddito (IRES, IRAP) identificate dalla descrizione — NON includere altre imposte/tasse (IMU, bolli, tasse di concessione, diritti camerali), quelle restano costi operativi
7. EBIT = Ricavi totali - Costi operativi (esclusi amm, oneri fin, imposte)
8. EBITDA = EBIT + Ammortamenti
9. risultato_esercizio = utile/perdita netto dopo imposte — se il documento riporta esplicitamente un "utile/perdita di esercizio" in fondo, usa quel valore come riscontro finale

=== STATO PATRIMONIALE ===
Se presente, estrai:
- totale_attivo
- totale_immobilizzazioni
- attivo_circolante
- crediti_clienti (crediti verso clienti)
- disponibilita_liquide (cassa + banca)
- patrimonio_netto (capitale + riserve + utile incluso)
- tfr (fondo trattamento fine rapporto)
- totale_debiti
- debiti_breve (debiti esigibili entro 12 mesi)

Se lo SP non e' presente, stima patrimonio_netto dai dati disponibili (es. saldo precedente + risultato periodo) e lascia gli altri campi SP a 0.

Contenuto documento:
${contenuto}

Restituisci SOLO JSON valido senza backtick:
${fmt}${ISTRUZIONE_COMPATTEZZA}`
  }

  return `Sei un esperto contabile italiano. Analizza questo bilancio OIC.
Anno: ${anno}

Dal CONTO ECONOMICO estrai:
- Per ogni voce includi 'dettaglio': lista di {conto, descrizione, importo} per ogni conto analitico trovato nel documento
- Il campo 'conto' è il codice numerico (es. 60100, 70050) che trovi nel testo
- IMPORTANTE PER EVITARE RISPOSTE TROPPO LUNGHE: se una voce ha più di 15 conti analitici, includi nel 'dettaglio' solo i 15 con importo assoluto più alto, poi aggiungi un ultimo elemento {conto: "", descrizione: "Altri conti minori aggregati", importo: <somma dei restanti>}. L'importo totale della voce deve comunque essere quello reale, anche se il dettaglio è aggregato.
- ricavi: valore produzione con dettaglio voci
- costi: tutti i costi con dettaglio voci
- ammortamenti, oneri finanziari, EBITDA, imposte, utile netto

Dallo STATO PATRIMONIALE estrai:
- totale_attivo, totale_immobilizzazioni, attivo_circolante
- crediti_clienti, disponibilita_liquide
- patrimonio_netto, tfr, totale_debiti, debiti_breve

Contenuto:
${contenuto}

Restituisci SOLO JSON valido senza backtick:
${fmt}${ISTRUZIONE_COMPATTEZZA}`
}

function promptVision(tipoDocumento: string, anno: string): string {
  const fmt = formatoJson(tipoDocumento, anno)
  return `Sei un esperto contabile italiano. Analizza queste pagine di bilancio.
Anno: ${anno} - Tipo: ${tipoDocumento}
Estrai dal Conto Economico: ricavi totali, costi operativi (escludi ammortamenti e oneri finanziari), ammortamenti, oneri finanziari, EBITDA, utile netto.
Dallo Stato Patrimoniale: totale attivo, immobilizzazioni, attivo circolante, crediti clienti, disponibilita liquide, patrimonio netto, tfr, totale debiti, debiti breve.

Restituisci SOLO JSON valido senza backtick:
${fmt}${ISTRUZIONE_COMPATTEZZA}`
}

async function chiamaAnthropic(tipoFile: string, tipoDocumento: string, anno: string, modalita: string, testo: string | undefined, immagini: string[] | undefined, mediaType: string | undefined): Promise<unknown> {
  let content: unknown
  if (modalita === 'vision') {
    const tipoImmagine = mediaType || 'image/png'
    content = [
      ...(immagini || []).map((img) => ({ type: 'image', source: { type: 'base64', media_type: tipoImmagine, data: img } })),
      { type: 'text', text: promptVision(tipoDocumento, anno) },
    ]
  } else {
    content = promptTesto(tipoFile, tipoDocumento, anno, String(testo))
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 16000, messages: [{ role: 'user', content }] }),
  })

  const data = await resp.json()
  if (!resp.ok) {
    throw new Error(data?.error?.message || `Errore Anthropic API (${resp.status})`)
  }

  // Non assumiamo che il testo sia nel primo blocco: alcuni modelli possono
  // restituire prima un blocco 'thinking' e poi quello 'text'.
  const bloccoTesto = (data?.content || []).find((b: { type?: string }) => b?.type === 'text')
  const testoRisposta = (bloccoTesto as { text?: string } | undefined)?.text || ''

  try {
    return puliciJson(testoRisposta)
  } catch {
    const troncato = data?.stop_reason === 'max_tokens' ? ' (risposta troncata: max_tokens raggiunto)' : ''
    const anteprima = testoRisposta.slice(0, 300) || '[nessun blocco di testo nella risposta]'
    throw new Error(`Risposta AI non in formato JSON valido${troncato}. Anteprima: ${anteprima}`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rispondi = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  if (!ANTHROPIC_API_KEY) return rispondi({ errore: 'ANTHROPIC_API_KEY non configurata come secret su questo progetto Supabase.' }, 500)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return rispondi({ errore: 'Configurazione Supabase (URL/service role) mancante nella function.' }, 500)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return rispondi({ errore: 'Corpo della richiesta non valido.' }, 400)
  }

  const { documentoId, tipoFile, tipoDocumento, anno, modalita, testo, immagini, mediaType } = body as {
    documentoId?: string
    tipoFile: string
    tipoDocumento: string
    anno: string
    modalita: string
    testo?: string
    immagini?: string[]
    mediaType?: string
  }

  if (!documentoId) return rispondi({ errore: 'documentoId mancante.' }, 400)
  if (modalita === 'vision' && (!Array.isArray(immagini) || immagini.length === 0)) return rispondi({ errore: 'Nessuna immagine ricevuta per la modalità vision.' }, 400)
  if (modalita !== 'vision' && (!testo || String(testo).trim().length < 20)) return rispondi({ errore: 'Testo estratto troppo corto o assente.' }, 400)

  // Pmi 360°: il documento deve essere visibile a chi chiama (regole di accesso del
  // modulo Finanza: gestore dell'azienda con il modulo attivo, o lo Studio)
  const comeUtente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || '', {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  })
  const { data: visibile } = await comeUtente.from('fin_documenti').select('id').eq('id', documentoId).maybeSingle()
  if (!visibile) return rispondi({ errore: 'Documento non trovato o non accessibile.' }, 403)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { error: updErr } = await supabase.from('fin_documenti').update({ stato: 'elaborando' }).eq('id', documentoId)
  if (updErr) return rispondi({ errore: `Impossibile aggiornare lo stato del documento: ${updErr.message}` }, 500)

  const elabora = async () => {
    try {
      const risultato = await chiamaAnthropic(tipoFile, tipoDocumento, anno, modalita, testo, immagini, mediaType)
      await supabase.from('fin_documenti').update({ dati_estratti: JSON.stringify(risultato), stato: 'elaborato' }).eq('id', documentoId)
    } catch (e) {
      await supabase.from('fin_documenti').update({ dati_estratti: JSON.stringify({ errore: String((e as Error)?.message || e) }), stato: 'errore' }).eq('id', documentoId)
    }
  }

  // EdgeRuntime è un global specifico del runtime Supabase Edge Functions: permette
  // di continuare a lavorare DOPO aver già inviato la risposta HTTP al client.
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime
  if (rt && typeof rt.waitUntil === 'function') {
    rt.waitUntil(elabora())
  } else {
    // Ambiente senza waitUntil (es. test locali): esegue in modo sincrono.
    await elabora()
  }

  return rispondi({ avviato: true })
})
