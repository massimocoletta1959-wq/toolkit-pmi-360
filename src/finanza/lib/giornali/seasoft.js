// Libro giornale in formato Seasoft ("GIORNALE DI CONTABILITA'"), cronologico per registrazione:
//
//   Data registrazione   Causale              Attivita                                   Filiale
//                 Riga   Conto        Descrizione conto    Descrizione dell'operazione   Dare     Avere
//   10/04/2025           FATTURA DI VENDITA   A - Commercio all'ingrosso di altri metalli  1 - SEDE
//                 3363   9 / 5 / 494  CAPORALI OFFICINE    Del 10042025 n2025 125/I      1.474,17
//                 3364   44 / 5 / 1   Vendite prod.finiti  Prot. 125 CAPORALI ...                 1.143,34
//
// Ogni registrazione e' una testata (data, causale, attivita', filiale) seguita dalle sue righe numerate; a fine
// pagina "TOTALE PAGINA" riporta i totali progressivi Dare/Avere (controllo di quadratura). Apertura e chiusura
// dei conti sono le registrazioni con causale APERTURA ESERCIZIO / CHIUSURA ESERCIZIO.
// Il codice conto "9 / 5 / 494" diventa "9/5/494" (mastro/conto/sottoconto); il gruppo e' "9/5". Le righe con
// importo zero sono stampate senza importo e vengono ignorate.
// Produce gli stessi dati del lettore del brogliaccio (parseLibroGiornale / estraiMovimenti in libroGiornale.js).

const RE_AMOUNT = /\d[\d.]*,\d{2}/g
const RE_TESTATA = /^\s*(\d{2}\/\d{2}\/\d{4})\s+(\S.*)$/
const RE_RIGA = /^\s*(\d+)\s+(\d+\s*\/\s*\d+\s*\/\s*\d+)\b(.*)$/
const RE_ATTIVITA = /\b([A-Z]\s-\s.+?)\s{2,}\d+\s-\s/
const CONTI_TECNICI_PREFIX = ['55/']

const round2 = (n) => Math.round(n * 100) / 100
const parseNum = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'))

export const eGiornaleSeasoft = (righe) =>
  righe.some((ln) => /GIORNALE DI CONTABILITA/.test(ln)) &&
  righe.some((ln) => /\bRiga\b/.test(ln) && /\bConto\b/.test(ln) && /\bDare\b/.test(ln) && /\bAvere\b/.test(ln))

// Legge le registrazioni con le loro righe, piu' i controlli di quadratura sui totali di pagina
export function leggiRegistrazioniSeasoft(righe) {
  let col = null // colonne della pagina corrente (le intestazioni si ripetono a ogni pagina)
  const registrazioni = []
  let reg = null
  let totDare = 0
  let totAvere = 0
  let pagineOk = 0
  const pagineKo = []
  let totaleGenerale = null

  for (const ln of righe) {
    if (/\bRiga\b/.test(ln) && /\bConto\b/.test(ln) && /\bDare\b/.test(ln) && /\bAvere\b/.test(ln)) {
      col = {
        // importi allineati a destra: il riferimento e' la FINE delle intestazioni
        dare: ln.indexOf('Dare') + 4,
        avere: ln.lastIndexOf('Avere') + 5,
        descrConto: ln.indexOf('Descrizione conto'),
        descrOp: ln.indexOf("Descrizione dell'operazione"),
      }
      continue
    }
    if (!col) continue

    if (/TOTALE PAGINA|TOTALE GENERALE/.test(ln)) {
      const m = [...ln.matchAll(RE_AMOUNT)]
      if (m.length >= 2) {
        const td = parseNum(m[m.length - 2][0])
        const ta = parseNum(m[m.length - 1][0])
        if (Math.abs(td - totDare) < 0.02 && Math.abs(ta - totAvere) < 0.02) pagineOk++
        else pagineKo.push({ atteso: [td, ta], calcolato: [round2(totDare), round2(totAvere)] })
        if (/TOTALE GENERALE/.test(ln)) totaleGenerale = { dare: td, avere: ta }
      }
      continue
    }
    if (/RIPORTI/.test(ln)) continue

    const mt = ln.match(RE_TESTATA)
    if (mt) {
      const [g, m, a] = mt[1].split('/')
      const resto = mt[2]
      const causale = resto.split(/\s{2,}/)[0].trim()
      // una registrazione che prosegue alla pagina successiva ripete la testata: stessa data e causale mentre la
      // registrazione aperta non e' ancora in quadratura = continuazione, non una registrazione nuova
      if (reg && reg.data === mt[1] && reg.causale === causale && Math.abs(reg.righe.reduce((t, r) => t + r.segno * r.importo, 0)) > 0.005) continue
      const att = ln.match(RE_ATTIVITA)
      reg = { data: mt[1], iso: `${a}-${m}-${g}`, mese: parseInt(m, 10), causale, attivita: att ? att[1].trim() : null, righe: [] }
      registrazioni.push(reg)
      continue
    }

    const mr = ln.match(RE_RIGA)
    if (mr && reg) {
      const amounts = [...ln.matchAll(RE_AMOUNT)].filter((m) => m.index + m[0].length > (col.descrOp > 0 ? col.descrOp : 0))
      if (!amounts.length) continue
      const ultimo = amounts[amounts.length - 1]
      const fine = ultimo.index + ultimo[0].length
      const segno = Math.abs(fine - col.dare) <= Math.abs(fine - col.avere) ? 1 : -1
      const importo = parseNum(ultimo[0])
      const conto = mr[2].replace(/\s+/g, '')
      // descrizione del conto e dell'operazione: separate dalla colonna "Descrizione dell'operazione"
      const inizioDescr = ln.indexOf(mr[2]) + mr[2].length
      const fineConto = col.descrOp > inizioDescr ? col.descrOp : ultimo.index
      const descrizioneConto = ln.slice(inizioDescr, fineConto).trim()
      const descrizioneOperazione = ln.slice(fineConto, ultimo.index).trim()
      reg.righe.push({ riga: parseInt(mr[1], 10), conto, descrizioneConto, descrizioneOperazione, segno, importo })
      if (segno > 0) totDare += importo
      else totAvere += importo
    }
  }
  return { registrazioni, controlli: { pagineOk, pagineKo, totaleGenerale, totaleDare: round2(totDare), totaleAvere: round2(totAvere) } }
}

const eApertura = (reg) => /APERTURA ESERCIZIO|RIAPERTURA/i.test(reg.causale)
// chiusura dei conti: patrimoniali (CHIUSURA ESERCIZIO), economici a profitti e perdite (CHIUSURA A P/P) e
// rilevazione del risultato (RILEVAZIONE UTILE / PERDITA)
const eChiusura = (reg) => /CHIUSURA ESERCIZIO|CHIUSURA A P\/P|RILEVAZIONE (UTILE|PERDITA)/i.test(reg.causale)

// Stessa uscita di parseLibroGiornale: saldi per conto (apertura + movimenti, senza chiusura), movimenti mensili
// (esclusi apertura e chiusura), descrizioni dei conti e diagnostica
export function parseGiornaleSeasoft(righe) {
  const { registrazioni, controlli } = leggiRegistrazioniSeasoft(righe)
  if (!registrazioni.length) throw new Error("Nessuna registrazione trovata nel Giornale di contabilità.")
  const saldoApertura = {}
  const saldoMovimenti = {}
  const saldoChiusura = {}
  const movimentiPerMese = {}
  const descrizioni = {}
  let nMovimenti = 0
  let nNonBilanciate = 0

  for (const reg of registrazioni) {
    const somma = reg.righe.reduce((s, r) => s + r.segno * r.importo, 0)
    if (Math.abs(somma) > 0.02) nNonBilanciate++
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

  const tecnico = (c) => CONTI_TECNICI_PREFIX.some((p) => c.startsWith(p))
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
    if (!tecnico(c)) saldi[c] = round2((saldoApertura[c] || 0) + (saldoMovimenti[c] || 0))
  }
  const movimentiMensili = {}
  for (const [mese, perConto] of Object.entries(movimentiPerMese)) {
    movimentiMensili[mese] = {}
    for (const [c, v] of Object.entries(perConto)) if (!tecnico(c)) movimentiMensili[mese][c] = round2(v)
  }

  return {
    saldi,
    movimentiMensili,
    descrizioni,
    diagnostica: {
      formato: 'seasoft',
      testate: registrazioni.length,
      movimenti: nMovimenti,
      registrazioniNonBilanciate: nNonBilanciate,
      checkpointOk: controlli.pagineOk,
      checkpointKo: controlli.pagineKo.length,
      totaleGenerale: controlli.totaleGenerale,
      verificaOk,
      verificaKo: verificaKo.length,
      dettaglioVerificaKo: verificaKo.slice(0, 20),
      attivita: [...new Set(registrazioni.map((r) => r.attivita).filter(Boolean))],
    },
  }
}

// "Del 10042025 n2025 125/I" / "N.2025 125/I del 09042025": numero e data del documento originale (serve ai
// tempi medi di incasso/pagamento, vedi dsoDpo.js)
const RE_DOC = /\bn\.?\s?(\S+)/i
const RE_DEL = /\bdel\s+(\d{2})(\d{2})(\d{4})\b/i

// Emissione di ricevute bancarie: il cliente viene chiuso alla data di emissione contro "Ricevute bancarie", ma
// l'incasso vero avviene alla scadenza scritta sulla riga della RiBa ("SCADENZA 28.02.25"). Ogni riga del
// cliente si abbina alla riga RiBa dello stesso importo (una sola volta) e ne prende la data di scadenza.
const RE_SCADENZA = /SCADENZA\s+(\d{2})[./](\d{2})[./](\d{2,4})/i
function scadenzeRiba(reg) {
  const riba = reg.righe.map((r) => ({ r, m: r.descrizioneOperazione.match(RE_SCADENZA) })).filter((x) => x.m && x.r.segno > 0)
  const date = new Map()
  if (!riba.length) return date
  const usate = new Set()
  for (const r of reg.righe) {
    if (r.segno > 0 || RE_SCADENZA.test(r.descrizioneOperazione)) continue
    const x = riba.find((y) => !usate.has(y) && Math.abs(y.r.importo - r.importo) < 0.005)
    if (!x) continue
    usate.add(x)
    const anno = x.m[3].length === 2 ? `20${x.m[3]}` : x.m[3]
    date.set(r, `${x.m[1]}/${x.m[2]}/${anno}`)
  }
  return date
}

// Stessa uscita di estraiMovimenti: un movimento per riga; ogni registrazione e' un segmento bilanciato.
// dataEffettiva (se presente) = data reale dell'incasso, diversa dalla data di registrazione (RiBa).
export function estraiMovimentiSeasoft(righe) {
  const { registrazioni } = leggiRegistrazioniSeasoft(righe)
  const movimenti = []
  for (const reg of registrazioni) {
    const scadenze = scadenzeRiba(reg)
    reg.righe.forEach((r, i) => {
      const del = r.descrizioneOperazione.match(RE_DEL)
      const doc = r.descrizioneOperazione.match(RE_DOC)
      movimenti.push({
        data: reg.data,
        mese: reg.mese,
        conto: r.conto,
        descrizione: r.descrizioneConto,
        segno: r.segno,
        importo: r.importo,
        chiave: `${reg.causale} ${r.descrizioneOperazione}`.trim(),
        eApertura: eApertura(reg),
        eChiusura: eChiusura(reg),
        chiudeSegmento: i === reg.righe.length - 1,
        nDoc: doc ? doc[1] : null,
        dtDoc: del ? `${del[1]}/${del[2]}/${del[3]}` : null,
        attivita: reg.attivita,
        ...(scadenze.has(r) ? { dataEffettiva: scadenze.get(r) } : {}),
      })
    })
  }
  return movimenti
}
