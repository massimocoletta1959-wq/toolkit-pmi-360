// Libro giornale in formato GB Software ("LIBRO GIORNALE - Anno 2025 (Stampa di Controllo)"), stampato su pagina
// A4 ruotata: una riga per movimento, senza numero di registrazione:
//
//   DATA      DESCRIZIONE                              D A R E     A V E R E   NUM.DOC. DATA DOC. DESCRIZIONE CONTO      N. RIGA
//   01/01/25  Fattura acquisto n. 335 L.G.E. ...      1.174,36                     335 31/12/24 45041 - IVA acquisti        2
//   01/01/25  Rilevazione CAONE MENSILE                              20,00           1 01/01/25 50105 - BdM Banca conto ...  10
//
// L'importo e' Dare o Avere secondo la colonna in cui e' allineato (fine del numero piu' vicina alla fine di
// "D A R E" o di "A V E R E" nell'intestazione della pagina). Il numero di riga e' progressivo su tutto il
// giornale (controllo di completezza); a fine pagina "TOTALI" riporta i totali progressivi Dare/Avere (controllo di
// quadratura). Il numero documento puo' contenere spazi ("12/24 L", "FPR 1/25") o essere attaccato alla data del
// documento ("HI14/01/25", "12/2431/12/24"); se e' lungo va a capo. Il numero di riga puo' essere attaccato alla
// descrizione del conto troncata ("...A SOCIO UNIC11040") sulla riga dopo: quelle righe di continuazione si ignorano.
// Le registrazioni non sono numerate: righe consecutive della stessa data fino alla quadratura Dare = Avere.
//
// Codici conto numerici GB: mastro (2 cifre) + conto (3 cifre) + sottoconto (resto). "60822" -> "60/822/0",
// "60812401" -> "60/812/401" (gruppo "60/812"). Clienti (mastro 40) e fornitori (mastro 41) hanno il codice
// dell'anagrafica dopo il mastro: "400005" -> "40/00005/C", "41001" -> "41/00001/F" (gruppi "40/C" e "41/F").
// Alcuni codici sono alfanumerici (es. "40CORR - Corrispettivi" dell'Hotel Castello): stessa regola.
// Produce gli stessi dati degli altri lettori (vedi index.js).

const AMT = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`
const RE_RIGA = new RegExp(String.raw`^\s*(\d{2})\/(\d{2})\/(\d{2})\s+(.*)\s(-?${AMT})\s+(?:(\S.*?)\s*)?(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}[0-9A-Z]{1,10}) - (.*?)(?:(?:\s+|(?<=[A-Za-z.)]))(\d+))?\s*$`)
const RE_AMOUNT = new RegExp(AMT, 'g')
const RE_APERTURA = /\b(RI)?APERTURA\s+(DEI\s+)?CONTI\b|BILANCIO\s+DI\s+APERTURA|APERTURA\s+ESERCIZIO/i
const RE_CHIUSURA = /\bCHIUSURA\s+(DEI\s+)?CONTI\b|BILANCIO\s+DI\s+CHIUSURA|CHIUSURA\s+ESERCIZIO|CHIUSURA\s+A\s+(P\/P|PROFITTI)/i

const round2 = (n) => Math.round(n * 100) / 100
const parseNum = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'))

export const eGiornaleGb = (righe) =>
  righe.some((ln) => /LIBRO GIORNALE - Anno \d{4}/.test(ln)) &&
  righe.some((ln) => /D A R E/.test(ln) && /A V E R E/.test(ln) && /DESCRIZIONE CONTO/.test(ln))

// codice GB -> codice nel formato del portale (vedi intestazione)
export function contoGb(codice) {
  const c = String(codice)
  if (/^4[01][0-9A-Z]{3,}$/.test(c)) return `${c.slice(0, 2)}/${c.slice(2).padStart(5, '0')}/${c[1] === '0' ? 'C' : 'F'}`
  if (c.length <= 5) return `${c.slice(0, 2)}/${c.slice(2).padEnd(3, '0')}/0`
  return `${c.slice(0, 2)}/${c.slice(2, 5)}/${c.slice(5)}`
}

// causale: la parte iniziale fissa della descrizione ("Fattura acquisto n.", "Pagata fattura", "Giroconto"...)
const CAUSALI = ['Fattura acquisto n.', 'Fattura vendita n.', 'Nota credito', 'Nota di credito', 'Pagata fattura', 'Incassata fattura', 'Pagamento', 'Incasso', 'Giroconto', 'Rilevazione', 'Calcolata quota', 'Versamento', 'Prelevamento', 'Liquidazione', 'Corrispettivi', 'Stipendi', 'F24']
const causaleDi = (descr) => CAUSALI.find((c) => descr.toLowerCase().startsWith(c.toLowerCase())) || descr.split(/\s+/)[0] || ''

// Una descrizione molto lunga "spinge" a destra l'importo nella ricostruzione a colonne: un importo in Dare puo'
// finire vicino alla colonna Avere. Quelle righe (importo attaccato al testo, un solo spazio) hanno il lato incerto e
// lo decide la quadratura della registrazione: la registrazione si chiude quando esiste un'assegnazione dei lati
// incerti che porta Dare = Avere (se ce n'e' piu' d'una si preferisce quella che sposta meno righe).
const MAX_INCERTE = 8
function chiudiSePossibile(reg) {
  const incerte = reg.righe.filter((r) => r.incerto)
  const certo = reg.righe.filter((r) => !r.incerto).reduce((t, r) => t + r.segno * r.importo, 0)
  if (!incerte.length) return Math.abs(certo) < 0.005
  if (incerte.length > MAX_INCERTE) return false
  let migliore = null
  for (let mask = 0; mask < 1 << incerte.length; mask++) {
    let somma = certo
    let spostate = 0
    incerte.forEach((r, k) => {
      const segno = mask & (1 << k) ? 1 : -1      // bit acceso = Dare
      if (segno !== r.segnoColonna) spostate++
      somma += segno * r.importo
    })
    if (Math.abs(somma) < 0.005 && (!migliore || spostate < migliore.spostate)) migliore = { mask, spostate }
  }
  if (!migliore) return false
  incerte.forEach((r, k) => { r.segno = migliore.mask & (1 << k) ? 1 : -1; r.incerto = false })
  return true
}

export function leggiRegistrazioniGb(righe) {
  let col = null
  const registrazioni = []
  const tutte = []              // righe nell'ordine di stampa (per i controlli dei totali di pagina)
  const totaliPagina = []       // { dopo: numero di righe lette, td, ta }
  let reg = null
  let nRighe = 0
  let ultimaRiga = 0

  for (const ln of righe) {
    if (/D A R E/.test(ln) && /A V E R E/.test(ln)) {
      col = { dare: ln.indexOf('D A R E') + 7, avere: ln.indexOf('A V E R E') + 9 }
      continue
    }
    if (!col) continue
    if (/^\s*T\s?O\s?T\s?A\s?L\s?I\s/.test(ln)) {   // "TOTALI" (anche spaziato "T O T A L I"): progressivi
      const m = [...ln.matchAll(RE_AMOUNT)]
      if (m.length >= 2) totaliPagina.push({ dopo: tutte.length, td: parseNum(m[m.length - 2][0]), ta: parseNum(m[m.length - 1][0]) })
      continue
    }
    const m = ln.match(RE_RIGA)
    if (!m) continue
    const [, g, me, a, descr, imp, numDoc, gd, md, ad, codice, descrConto, nRiga] = m
    const inizio = ln.indexOf(imp, ln.indexOf(descr) + descr.length)
    const fine = inizio + imp.length
    // importo negativo (storno, es. "-60,84" in Avere): vale come importo positivo nella colonna opposta
    const negativo = imp.startsWith('-')
    const colonnaAvere = Math.abs(fine - col.dare) > Math.abs(fine - col.avere)
    const segnoColonna = (colonnaAvere ? -1 : 1) * (negativo ? -1 : 1)
    // importo attaccato alla descrizione (un solo spazio): potrebbe essere stato spinto a destra
    const incerto = colonnaAvere && inizio >= 2 && ln[inizio - 2] !== ' '
    const importo = parseNum(imp.replace('-', ''))
    const data = `${g}/${me}/20${a}`
    nRighe++
    if (nRiga) ultimaRiga = Math.max(ultimaRiga, parseInt(nRiga, 10))
    if (!reg || reg.data !== data || chiudiSePossibile(reg)) {
      reg = { data, iso: `20${a}-${me}-${g}`, mese: parseInt(me, 10), causale: causaleDi(descr.trim()), attivita: null, righe: [] }
      registrazioni.push(reg)
    }
    const riga = {
      riga: nRiga ? parseInt(nRiga, 10) : null, conto: contoGb(codice), codiceGb: codice, descrizioneConto: descrConto.trim(),
      descrizioneOperazione: descr.trim(), segno: segnoColonna, segnoColonna, incerto, negativo, colonnaAvere, importo, numDoc: numDoc || null, dataDoc: `${gd}/${md}/20${ad}`,
    }
    reg.righe.push(riga)
    tutte.push(riga)
  }
  if (reg) chiudiSePossibile(reg)
  let incerteRimaste = 0
  // totali di pagina come li stampa GB: importo con segno nella colonna in cui e' stampato (un negativo resta nella
  // sua colonna e la riduce); per le righe dal lato incerto la colonna e' quella risolta
  const colonna = new Map()
  for (const r of tutte) {
    if (r.incerto) incerteRimaste++
    colonna.set(r, { avere: r.negativo ? r.colonnaAvere : r.segno < 0, valore: r.negativo ? -r.importo : r.importo })
    delete r.incerto; delete r.segnoColonna; delete r.negativo; delete r.colonnaAvere
  }

  // controlli di quadratura sui totali progressivi di fine pagina, con i lati gia' risolti
  let pagineOk = 0
  const pagineKo = []
  let totDare = 0
  let totAvere = 0
  let k = 0
  for (const t of totaliPagina) {
    for (; k < t.dopo; k++) { const c = colonna.get(tutte[k]); if (c.avere) totAvere += c.valore; else totDare += c.valore }
    if (Math.abs(t.td - totDare) < 0.02 && Math.abs(t.ta - totAvere) < 0.02) pagineOk++
    else pagineKo.push({ atteso: [t.td, t.ta], calcolato: [round2(totDare), round2(totAvere)] })
  }
  for (; k < tutte.length; k++) { const c = colonna.get(tutte[k]); if (c.avere) totAvere += c.valore; else totDare += c.valore }
  const ultimo = totaliPagina[totaliPagina.length - 1]
  return {
    registrazioni,
    controlli: { pagineOk, pagineKo, totaleGenerale: ultimo ? { dare: ultimo.td, avere: ultimo.ta } : null, totaleDare: round2(totDare), totaleAvere: round2(totAvere), nRighe, ultimaRiga, righeMancanti: Math.max(0, ultimaRiga - nRighe), incerteRimaste },
  }
}

const eApertura = (reg) => reg.righe.length > 0 && reg.righe.every((r) => RE_APERTURA.test(r.descrizioneOperazione))
const eChiusura = (reg) => reg.righe.length > 0 && reg.righe.every((r) => RE_CHIUSURA.test(r.descrizioneOperazione))

export function parseGiornaleGb(righe) {
  const { registrazioni, controlli } = leggiRegistrazioniGb(righe)
  if (!registrazioni.length) throw new Error('Nessun movimento trovato nel libro giornale GB Software.')
  const saldoApertura = {}
  const saldoMovimenti = {}
  const saldoChiusura = {}
  const movimentiPerMese = {}
  const descrizioni = {}
  let nMovimenti = 0
  let nNonBilanciate = 0
  for (const reg of registrazioni) {
    if (Math.abs(reg.righe.reduce((s, r) => s + r.segno * r.importo, 0)) > 0.02) nNonBilanciate++
    for (const r of reg.righe) {
      nMovimenti++
      if (!(r.conto in descrizioni) && r.descrizioneConto) descrizioni[r.conto] = r.descrizioneConto
      const v = r.segno * r.importo
      if (eApertura(reg)) saldoApertura[r.conto] = (saldoApertura[r.conto] || 0) + v
      else if (eChiusura(reg)) saldoChiusura[r.conto] = (saldoChiusura[r.conto] || 0) + v
      else {
        saldoMovimenti[r.conto] = (saldoMovimenti[r.conto] || 0) + v
        if (!movimentiPerMese[reg.mese]) movimentiPerMese[reg.mese] = {}
        movimentiPerMese[reg.mese][r.conto] = (movimentiPerMese[reg.mese][r.conto] || 0) + v
      }
    }
  }
  const tutti = new Set([...Object.keys(saldoApertura), ...Object.keys(saldoMovimenti), ...Object.keys(saldoChiusura)])
  let verificaOk = 0
  const verificaKo = []
  const saldi = {}
  for (const c of tutti) {
    if (c in saldoChiusura) {
      const tot = (saldoApertura[c] || 0) + (saldoMovimenti[c] || 0) + saldoChiusura[c]
      if (Math.abs(tot) < 0.02) verificaOk++
      else verificaKo.push({ conto: c, descrizione: descrizioni[c] || '', scarto: round2(tot) })
    }
    saldi[c] = round2((saldoApertura[c] || 0) + (saldoMovimenti[c] || 0))
  }
  const movimentiMensili = {}
  for (const [mese, perConto] of Object.entries(movimentiPerMese)) {
    movimentiMensili[mese] = {}
    for (const [c, v] of Object.entries(perConto)) movimentiMensili[mese][c] = round2(v)
  }
  return {
    saldi,
    movimentiMensili,
    descrizioni,
    diagnostica: {
      formato: 'gb',
      testate: registrazioni.length,
      movimenti: nMovimenti,
      registrazioniNonBilanciate: nNonBilanciate,
      checkpointOk: controlli.pagineOk,
      checkpointKo: controlli.pagineKo.length,
      totaleGenerale: controlli.totaleGenerale,
      righeLette: controlli.nRighe,
      ultimaRiga: controlli.ultimaRiga,
      righeMancanti: controlli.righeMancanti,   // numero di riga progressivo stampato meno righe lette
      latiIncertiNonRisolti: controlli.incerteRimaste,
      verificaOk,
      verificaKo: verificaKo.length,
      dettaglioVerificaKo: verificaKo.slice(0, 20),
      attivita: [],
    },
  }
}

// Movimenti per l'Analisi dei flussi e i tempi medi di incasso/pagamento (stessa forma degli altri lettori)
export function estraiMovimentiGb(righe) {
  const { registrazioni } = leggiRegistrazioniGb(righe)
  const movimenti = []
  for (const reg of registrazioni) {
    reg.righe.forEach((r, i) => {
      movimenti.push({
        data: reg.data,
        mese: reg.mese,
        conto: r.conto,
        descrizione: r.descrizioneConto,
        segno: r.segno,
        importo: r.importo,
        chiave: r.descrizioneOperazione,
        eApertura: eApertura(reg),
        eChiusura: eChiusura(reg),
        chiudeSegmento: i === reg.righe.length - 1,
        nDoc: r.numDoc,
        dtDoc: r.dataDoc,
        attivita: null,
      })
    })
  }
  return movimenti
}
