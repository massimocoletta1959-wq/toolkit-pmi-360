// Parsing deterministico (nessuna AI, nessun costo/latenza di token) di Libro
// Giornale / Lista Prima Nota in PDF, potenzialmente lunghi centinaia di pagine.
//
// Ricostruisce pagina per pagina il testo con la disposizione a colonne del
// programma di contabilita' (equivalente di `pdftotext -layout`), partendo dalle
// posizioni (x,y) dei frammenti di testo che pdf.js restituisce, poi applica la
// stessa logica di ricostruzione saldi gia' validata offline contro un Libro
// Giornale reale (Intellcredit 2025 — 349 pagine, 13.428 movimenti): controllo di
// quadratura pagina per pagina (TOTALI PROGRESSIVI) e verifica apertura+movimenti+
// chiusura≈0 per ogni conto chiuso a fine anno, entrambi passati al 100%.
//
// Formato codice conto atteso: GRUPPO(2cifre)/SOTTOGRUPPO(2cifre)/CONTO(3cifre)/G
// per la contabilita' generale, oppure GRUPPO(2cifre)/CONTO/C per i clienti
// (gruppo fisso "14") e .../F per i fornitori (gruppo fisso "40"). Dare="+", Avere="-".

import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs'

const RE_TESTATA = /^\s*(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{5}\/[GFC]|\d{2}\/\d{2}\/\d{3}\/[GFC])\s+(.*\S)\s*$/
const RE_AMOUNT = /\d[\d.]*,\d{2}/g
const RE_PERIODO = /DAL\s+\d{2}\/\d{2}\/\d{2}\s+AL\s+\d{2}\/\d{2}\/\d{2}/
// Conti tecnici di quadratura apertura/chiusura (non sono saldi economici reali)
const CONTI_TECNICI_PREFIX = ['55/']

function round2(n) {
  return Math.round(n * 100) / 100
}

function parseNum(s) {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

// "06/05/015/G" -> "06/05/G" (Gruppo/Sottogruppo, per la contabilita' generale:
// lo stesso Gruppo puo' contenere sottogruppi eterogenei — es. fabbricati e
// macchinari sotto lo stesso "06" — che vanno riclassificati su voci diverse).
// "14/00090/C" -> "14/C" ; "40/00199/F" -> "40/F" (clienti/fornitori non hanno
// un sottogruppo distinto nel codice, restano al livello Gruppo).
export function gruppoDiConto(conto) {
  const campi = conto.split('/')
  const tipo = campi[campi.length - 1]
  if (campi.length >= 4) return `${campi[0]}/${campi[1]}/${tipo}`
  return `${campi[0]}/${tipo}`
}

async function estraiRighePagina(page) {
  const content = await page.getTextContent()
  const items = content.items
    .filter((it) => it.str != null && it.str.length > 0)
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width }))
  if (!items.length) return []

  // stima la "spaziatura carattere" della pagina (mediana) per ricostruire un
  // layout a colonne fisse analogo a quello di pdftotext -layout
  const pitches = items.filter((it) => it.str.trim().length > 0 && it.w > 0).map((it) => it.w / it.str.length)
  pitches.sort((a, b) => a - b)
  const pitch = pitches[Math.floor(pitches.length / 2)] || 5
  const xOrigin = Math.min(...items.map((it) => it.x))

  items.sort((a, b) => b.y - a.y || a.x - b.x)
  const righeItems = []
  let riga = null
  let yCorrente = null
  for (const it of items) {
    if (yCorrente === null || Math.abs(it.y - yCorrente) > 2) {
      riga = []
      righeItems.push(riga)
      yCorrente = it.y
    }
    riga.push(it)
  }

  return righeItems.map((r) => {
    r.sort((a, b) => a.x - b.x)
    const buf = []
    for (const it of r) {
      const col = Math.max(0, Math.round((it.x - xOrigin) / pitch))
      while (buf.length < col) buf.push(' ')
      for (const ch of it.str) buf.push(ch)
    }
    return buf.join('')
  })
}

// Estrae tutte le righe di testo (layout a colonne ricostruito) da un PDF di Libro
// Giornale / Prima Nota. onProgress(paginaCorrente, totalePagine) e' opzionale.
export async function estraiRigheLibroGiornale(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const righe = []
  for (let i = 1; i <= pdf.numPages; i++) {
    // eslint-disable-next-line no-await-in-loop
    const page = await pdf.getPage(i)
    // eslint-disable-next-line no-await-in-loop
    const righePagina = await estraiRighePagina(page)
    righe.push(...righePagina)
    if (onProgress) onProgress(i, pdf.numPages)
  }
  return righe
}

// Ricostruisce i saldi di ogni conto a partire dalle righe di testo estratte.
export function parseLibroGiornale(righe) {
  let dareCol = null
  let avereCol = null
  for (const ln of righe) {
    if (ln.includes('N.Pr.') && ln.includes('Cod. Conto') && ln.includes('Dare') && ln.includes('Avere')) {
      // gli importi sono allineati a DESTRA: il riferimento e' la fine delle
      // intestazioni "Dare"/"Avere", non il loro inizio
      dareCol = ln.indexOf('Dare') + 'Dare'.length
      avereCol = ln.indexOf('Avere') + 'Avere'.length
      break
    }
  }
  if (dareCol === null) {
    throw new Error('Intestazione colonne (N.Pr. / Cod. Conto / Dare / Avere) non trovata: il PDF non sembra un Libro Giornale/Prima Nota in questo formato.')
  }

  const saldoApertura = {}
  const saldoMovimenti = {}
  const saldoChiusura = {}
  const movimentiPerMese = {} // { 1..12: { conto: valore del mese, esclusi apertura/chiusura } }
  const descrizioni = {}
  let nMovimenti = 0
  let nTestate = 0
  let contoCorrente = null
  let meseCorrente = null

  let periodoCorrente = null
  let totDareSezione = 0
  let totAvereSezione = 0
  let checkpointOk = 0
  const checkpointKo = []

  for (const ln of righe) {
    if (ln.includes('BROGLIACCIO MOVIMENTI')) {
      const mp = ln.match(RE_PERIODO)
      const periodo = mp ? mp[0] : null
      if (periodo !== periodoCorrente) {
        periodoCorrente = periodo
        totDareSezione = 0
        totAvereSezione = 0
      }
      continue
    }
    if (ln.includes('TOTALI PROGRESSIVI')) {
      const m = [...ln.matchAll(RE_AMOUNT)]
      if (m.length === 2) {
        const td = parseNum(m[0][0])
        const ta = parseNum(m[1][0])
        if (Math.abs(td - totDareSezione) < 0.02 && Math.abs(ta - totAvereSezione) < 0.02) checkpointOk++
        else checkpointKo.push({ atteso: [td, ta], calcolato: [round2(totDareSezione), round2(totAvereSezione)] })
      }
      continue
    }

    const mt = ln.match(RE_TESTATA)
    if (mt) {
      contoCorrente = mt[3]
      nTestate++
      meseCorrente = parseInt(mt[2].split('/')[1], 10)
      if (!(contoCorrente in descrizioni)) descrizioni[contoCorrente] = mt[4].trim()
      continue
    }

    if (contoCorrente === null) continue

    const amounts = [...ln.matchAll(RE_AMOUNT)]
    if (!amounts.length) continue

    const eApertura = ln.includes('SALDO APERTURA')
    const eChiusura = ln.includes('SALDO CHIUSURA')

    for (const m of amounts) {
      // fine dell'importo (allineato a destra) confrontata con la fine delle intestazioni:
      // con l'inizio, un importo lungo in Avere (es. 1.306.479,50) risultava piu' vicino a Dare
      const pos = m.index + m[0].length
      const val = parseNum(m[0])
      const segno = Math.abs(pos - dareCol) <= Math.abs(pos - avereCol) ? 1 : -1
      totDareSezione += segno > 0 ? val : 0
      totAvereSezione += segno < 0 ? val : 0
      nMovimenti++
      if (eApertura) saldoApertura[contoCorrente] = (saldoApertura[contoCorrente] || 0) + segno * val
      else if (eChiusura) saldoChiusura[contoCorrente] = (saldoChiusura[contoCorrente] || 0) + segno * val
      else {
        saldoMovimenti[contoCorrente] = (saldoMovimenti[contoCorrente] || 0) + segno * val
        if (meseCorrente >= 1 && meseCorrente <= 12) {
          if (!movimentiPerMese[meseCorrente]) movimentiPerMese[meseCorrente] = {}
          movimentiPerMese[meseCorrente][contoCorrente] = (movimentiPerMese[meseCorrente][contoCorrente] || 0) + segno * val
        }
      }
    }
    contoCorrente = null
  }

  const tuttiConti = new Set([...Object.keys(saldoApertura), ...Object.keys(saldoMovimenti), ...Object.keys(saldoChiusura)])

  // Verifica di coerenza: per un conto chiuso a fine periodo, apertura+movimenti+
  // chiusura deve tornare a ~0 (la scrittura di chiusura e' costruita apposta per
  // azzerarlo). Se non torna, segnala un possibile problema di abbinamento importi.
  let verificaOk = 0
  const verificaKo = []
  for (const c of tuttiConti) {
    if (!(c in saldoChiusura)) continue
    const tot = (saldoApertura[c] || 0) + (saldoMovimenti[c] || 0) + (saldoChiusura[c] || 0)
    if (Math.abs(tot) < 0.02) verificaOk++
    else verificaKo.push({ conto: c, descrizione: descrizioni[c] || '', scarto: round2(tot) })
  }

  const saldi = {}
  for (const c of tuttiConti) {
    if (CONTI_TECNICI_PREFIX.some((p) => c.startsWith(p))) continue
    saldi[c] = round2((saldoApertura[c] || 0) + (saldoMovimenti[c] || 0))
  }

  const movimentiMensili = {}
  for (const [mese, perConto] of Object.entries(movimentiPerMese)) {
    movimentiMensili[mese] = {}
    for (const [c, v] of Object.entries(perConto)) {
      if (CONTI_TECNICI_PREFIX.some((p) => c.startsWith(p))) continue
      movimentiMensili[mese][c] = round2(v)
    }
  }

  return {
    saldi,
    movimentiMensili,
    descrizioni,
    diagnostica: {
      testate: nTestate,
      movimenti: nMovimenti,
      checkpointOk,
      checkpointKo: checkpointKo.length,
      verificaOk,
      verificaKo: verificaKo.length,
      dettaglioVerificaKo: verificaKo.slice(0, 20),
    },
  }
}

// Raggruppa i saldi per gruppo di conto (es. "06/G", "14/C", "40/F"): e' il livello
// a cui viene fatta la riclassificazione manuale (attivita'/passivita'/costi/ricavi),
// cosi' i conti nuovi che compaiono nei caricamenti successivi nello stesso gruppo
// vengono classificati automaticamente.
export function raggruppaPerGruppo(saldi, descrizioni) {
  const gruppi = {}
  for (const [conto, valore] of Object.entries(saldi)) {
    const gruppo = gruppoDiConto(conto)
    if (!gruppi[gruppo]) gruppi[gruppo] = { gruppo, conti: [], somma: 0 }
    gruppi[gruppo].conti.push({ conto, descrizione: descrizioni[conto] || '', valore })
    gruppi[gruppo].somma = round2(gruppi[gruppo].somma + valore)
  }
  // descrizione rappresentativa del gruppo: il conto con saldo assoluto maggiore
  for (const g of Object.values(gruppi)) {
    const rappresentativo = [...g.conti].sort((a, b) => Math.abs(b.valore) - Math.abs(a.valore))[0]
    g.descrizione = rappresentativo?.descrizione || g.gruppo
  }
  return gruppi
}

// Un "N.Doc." (es. "360/01") seguito dalla sua "Dt. Doc." (es. "16/12/2024"):
// sulle righe di incasso/pagamento di un cliente/fornitore, la Dt. Doc. non e'
// la data del movimento ma quella della fattura originale a cui si riferisce
// (riportata identica dal software di contabilita'), il che permette di
// calcolare i tempi medi di incasso/pagamento senza dover riabbinare a mano
// fattura e relativo incasso/pagamento (vedi dsoDpo.js).
const RE_NDOC_DTDOC = /(\d+\/\d+)\s+(\d{2}\/\d{2}\/\d{4})/

// Estrae ogni singolo movimento (non aggregato per conto) dalle righe del Libro
// Giornale, per l'Analisi dei flussi: conto, descrizione, segno, importo, data,
// N.Doc./Dt.Doc. (quando presenti), "chiave" della registrazione (causale +
// N.Doc. + Dt.Doc., cioe' tutto cio' che precede la colonna Dare) e se la riga
// chiude un segmento Dare=Avere bilanciato (la colonna "Controp." del Libro
// Giornale marca con "*" l'ultima riga di ogni sotto-partita bilanciata: una
// singola registrazione puo' contenere piu' sotto-partite, es. un F24 con piu'
// tributi versati in un unico addebito).
export function estraiMovimenti(righe) {
  let dareCol = null
  let avereCol = null
  for (const ln of righe) {
    if (ln.includes('N.Pr.') && ln.includes('Cod. Conto') && ln.includes('Dare') && ln.includes('Avere')) {
      // gli importi sono allineati a DESTRA: il riferimento e' la fine delle
      // intestazioni "Dare"/"Avere", non il loro inizio
      dareCol = ln.indexOf('Dare') + 'Dare'.length
      avereCol = ln.indexOf('Avere') + 'Avere'.length
      break
    }
  }
  if (dareCol === null) {
    throw new Error('Intestazione colonne (N.Pr. / Cod. Conto / Dare / Avere) non trovata: il PDF non sembra un Libro Giornale/Prima Nota in questo formato.')
  }

  const movimenti = []
  let contoCorrente = null
  let dataCorrente = null
  let descrizioneCorrente = null

  for (const ln of righe) {
    if (ln.includes('BROGLIACCIO MOVIMENTI') || ln.includes('TOTALI PROGRESSIVI')) continue

    const mt = ln.match(RE_TESTATA)
    if (mt) {
      contoCorrente = mt[3]
      dataCorrente = mt[2]
      descrizioneCorrente = mt[4].trim()
      continue
    }
    if (contoCorrente === null) continue

    const amounts = [...ln.matchAll(RE_AMOUNT)]
    if (!amounts.length) continue

    const eApertura = ln.includes('SALDO APERTURA')
    const eChiusura = ln.includes('SALDO CHIUSURA')
    // la "chiave" e' il testo della riga (causale + N.Doc. + Dt.Doc.) SENZA gli
    // importi ne' il marcatore di Contropartita "*": tagliare per posizione di
    // colonna (es. ln.slice(0, dareCol)) e' sbagliato perche' un importo in Dare
    // a cavallo di quella colonna verrebbe troncato a meta' cifra. Gli spazi
    // vengono anche collassati perche' il numero di cifre dell'importo rimosso
    // cambia la larghezza del "buco" lasciato nel layout a colonne fisse, pur
    // essendo la stessa causale/data per tutte le righe della registrazione
    const chiave = ln.replace(RE_AMOUNT, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim()
    const chiudeSegmento = ln.trim().endsWith('*')
    const mese = parseInt(dataCorrente.split('/')[1], 10)
    const docMatch = ln.match(RE_NDOC_DTDOC)
    const nDoc = docMatch ? docMatch[1] : null
    const dtDoc = docMatch ? docMatch[2] : null

    for (const m of amounts) {
      // fine dell'importo (allineato a destra) confrontata con la fine delle intestazioni:
      // con l'inizio, un importo lungo in Avere (es. 1.306.479,50) risultava piu' vicino a Dare
      const pos = m.index + m[0].length
      const val = parseNum(m[0])
      const segno = Math.abs(pos - dareCol) <= Math.abs(pos - avereCol) ? 1 : -1
      movimenti.push({
        data: dataCorrente,
        mese,
        conto: contoCorrente,
        descrizione: descrizioneCorrente,
        segno,
        importo: val,
        chiave,
        eApertura,
        eChiusura,
        chiudeSegmento,
        nDoc,
        dtDoc,
      })
    }
    contoCorrente = null
  }
  return movimenti
}

// Raggruppa i movimenti mensili (per singolo conto) per gruppo di conto: usato
// per proiettare il budget di un anno replicando la stagionalita' mensile con
// cui si sono formati i saldi nell'anno precedente, invece di dividerli in
// parti uguali sui 12 mesi. Ritorna { gruppo: { mese(1-12): valore } }.
export function raggruppaMensilePerGruppo(movimentiMensili) {
  const risultato = {}
  for (const [mese, perConto] of Object.entries(movimentiMensili)) {
    for (const [conto, valore] of Object.entries(perConto)) {
      const gruppo = gruppoDiConto(conto)
      if (!risultato[gruppo]) risultato[gruppo] = {}
      risultato[gruppo][mese] = round2((risultato[gruppo][mese] || 0) + valore)
    }
  }
  return risultato
}

// Come raggruppaMensilePerGruppo ma per singolo conto: serve a proiettare il
// budget quando un conto e' stato riclassificato diversamente dal suo gruppo.
// Ritorna { conto: { mese(1-12): valore } }.
export function mensilePerContoDa(movimentiMensili) {
  const risultato = {}
  for (const [mese, perConto] of Object.entries(movimentiMensili)) {
    for (const [conto, valore] of Object.entries(perConto)) {
      if (!risultato[conto]) risultato[conto] = {}
      risultato[conto][mese] = round2((risultato[conto][mese] || 0) + valore)
    }
  }
  return risultato
}
