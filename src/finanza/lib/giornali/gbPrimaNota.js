// "Elenco delle registrazioni in prima nota" di GB Software (pagina A4 ruotata), es. i saldi iniziali caricati in
// prima nota al 31/12 dell'anno precedente al passaggio a GB (le scritture di apertura e chiusura compaiono nel libro
// giornale GB solo dopo la stampa definitiva):
//
//   Data reg.   Reg.Iva  Protocollo  Num.doc. Data doc.  CO  Conto    Descrizione                 D/A   Importo  ...  Progressivo
//   31/12/2024                                31/12/2024 00  10020    Capitale sociale Apertura conA  600.000,00  ...  2024011
//                                                                     ti
//
// Lato esplicito (colonna D/A, a volte attaccato alla descrizione troncata), registrazione = "Progressivo".
// Le descrizioni vanno a capo sulla riga dopo: quelle righe di continuazione si ignorano. Le registrazioni con
// descrizione "Apertura conti" sono aperture (saldi iniziali). Codici conto come il libro giornale GB (gb.js).
//
// Stessa uscita per la stampa di una singola registrazione, "Registrazione della prima nota" (es. "OP. APERTURA -
// Stato patrimoniale" al 01/01): testata con data e causale, poi una riga per conto e i totali Dare/Avere in fondo.
//
//     Data registraz. Causale:   ...
//      01/01/2025       00
//     Conto      P/E   Descrizione conto           D  A     Importo   N. Rif.  A.  CO   Descrizione                       R&R
//   1   10020     P    Capitale sociale/Patr.netto     A   480.000,00              00   OP. APERTURA - Stato patrimoniale  No
//
// Produce gli stessi dati degli altri lettori (vedi index.js).
import { contoGb } from './gb'

const AMT = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`
// date (registrazione, documento) + corpo (CO, conto, descrizione, D/A, importo ... progressivo); quando la
// descrizione contiene virgolette la stampa mette le date su una riga e il corpo su una riga successiva
const DATE = String.raw`^\s*(\d{2})\/(\d{2})\/(\d{4})\s+(?:(.*?)\s+)?(\d{2})\/(\d{2})\/(\d{4})`
const CORPO = String.raw`(\d{2})\s+(\d{2}[0-9A-Z]{1,10})\s+(.*?)\s*([DA])\s+(${AMT})\b.*?\s(\d{4,})\s*$`
const RE_RIGA = new RegExp(`${DATE}\\s+${CORPO}`)
const RE_SOLO_DATE = new RegExp(`${DATE}\\s*$`)
const RE_SOLO_CORPO = new RegExp(`^\\s*${CORPO}`)
const RE_APERTURA = /APERT/i
const RE_CHIUSURA = /CHIUSUR/i

const round2 = (n) => Math.round(n * 100) / 100
const parseNum = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'))

const eElencoGb = (righe) =>
  righe.some((ln) => /Elenco delle registrazioni in prima nota/i.test(ln)) &&
  righe.some((ln) => /\bD\/A\b/.test(ln) && /Importo/.test(ln) && /Progressivo/.test(ln))
const eDettaglioGb = (righe) =>
  righe.some((ln) => /Registrazione della prima nota/i.test(ln)) &&
  righe.some((ln) => /\bConto\b/.test(ln) && /Descrizione conto/.test(ln) && /Importo/.test(ln))

export const eListaPrimaNotaGb = (righe) => eElencoGb(righe) || eDettaglioGb(righe)

// "Registrazione della prima nota": una o piu' registrazioni, ognuna con la sua testata (data registrazione)
const RE_RIGA_DETTAGLIO = new RegExp(String.raw`^\s*(\d+)\s+(\d{2}[0-9A-Z]{1,10})\s+([PE])\s+(.*?)\s*([DA])\s+(${AMT})\b(.*)$`)
function leggiDettaglio(righe) {
  const registrazioni = []
  let reg = null
  let attesaData = false
  const totali = {}
  for (const ln of righe) {
    if (/Data registraz/i.test(ln)) { attesaData = true; continue }
    const d = attesaData && ln.match(/^\s*(\d{2})\/(\d{2})\/(\d{4})\b/)
    if (d) {
      attesaData = false
      const [, g, me, a] = d
      reg = { data: `${g}/${me}/${a}`, iso: `${a}-${me}-${g}`, mese: parseInt(me, 10), causale: '', attivita: null, righe: [] }
      registrazioni.push(reg)
      continue
    }
    const t = ln.match(/Totale (Dare|Avere):\s*(\d[\d.]*,\d{2})/i)
    if (t) { totali[t[1].toLowerCase()] = (totali[t[1].toLowerCase()] || 0) + parseNum(t[2]); continue }
    const m = reg && ln.match(RE_RIGA_DETTAGLIO)
    if (!m) continue
    const [, , codice, , descrConto, da, imp, resto] = m
    // descrizione dell'operazione: dopo il codice CO (2 cifre), fino a "Si"/"No" (R&R)
    const op = (resto.match(/\s(\d{2})\s+(.*?)\s+(Si|No)\s*$/) || [])[2] || ''
    reg.righe.push({
      conto: contoGb(codice), codiceGb: codice, descrizioneConto: descrConto.trim(), descrizioneOperazione: op.trim() || descrConto.trim(),
      segno: da === 'D' ? 1 : -1, importo: parseNum(imp), numDoc: null, dataDoc: reg.data,
    })
  }
  return { registrazioni: registrazioni.filter((r) => r.righe.length), totali }
}

export function leggiRegistrazioniPrimaNotaGb(righe) {
  if (!eElencoGb(righe) && eDettaglioGb(righe)) {
    const { registrazioni } = leggiDettaglio(righe)
    for (const reg of registrazioni) {
      const quota = (re) => reg.righe.filter((r) => re.test(r.descrizioneOperazione)).length / reg.righe.length
      reg.eApertura = quota(RE_APERTURA) >= 0.5
      reg.eChiusura = !reg.eApertura && quota(RE_CHIUSURA) >= 0.5
      reg.causale = reg.eApertura ? 'Apertura conti' : reg.eChiusura ? 'Chiusura conti' : 'Prima nota'
    }
    return registrazioni
  }
  return leggiElenco(righe)
}

function leggiElenco(righe) {
  const perProgressivo = new Map()
  const registrazioni = []
  // date e corpo su righe separate possono arrivare in un ordine o nell'altro: si abbinano al primo disponibile
  let dateSospese = null
  const corpiInAttesa = []
  const righeLette = []
  for (const ln of righe) {
    const m = ln.match(RE_RIGA)
    if (m) { righeLette.push(m); continue }
    const d = ln.match(RE_SOLO_DATE)
    if (d) {
      if (corpiInAttesa.length) righeLette.push([ln, ...d.slice(1, 8), ...corpiInAttesa.shift()])
      else dateSospese = d.slice(1, 8)
      continue
    }
    const c = ln.match(RE_SOLO_CORPO)
    if (!c) continue
    if (dateSospese) { righeLette.push([ln, ...dateSospese, ...c.slice(1)]); dateSospese = null } else corpiInAttesa.push(c.slice(1))
  }
  for (const m of righeLette) {
    const [, g, me, a, numDoc, gd, md, ad, , codice, descr, da, imp, progressivo] = m
    let reg = perProgressivo.get(progressivo)
    if (!reg) {
      reg = { data: `${g}/${me}/${a}`, iso: `${a}-${me}-${g}`, mese: parseInt(me, 10), causale: '', attivita: null, progressivo, righe: [] }
      perProgressivo.set(progressivo, reg)
      registrazioni.push(reg)
    }
    reg.righe.push({
      conto: contoGb(codice), codiceGb: codice, descrizioneConto: descr.trim(), descrizioneOperazione: descr.trim(),
      segno: da === 'D' ? 1 : -1, importo: parseNum(imp), numDoc: numDoc ? numDoc.trim() || null : null, dataDoc: `${gd}/${md}/${ad}`,
    })
  }
  // apertura/chiusura: la descrizione (troncata, es. "Apertura con") lo dice per la maggior parte delle righe (nelle
  // righe spezzate dalle virgolette la parola finisce sulla riga di continuazione)
  for (const reg of registrazioni) {
    const quota = (re) => reg.righe.filter((r) => re.test(r.descrizioneOperazione)).length / reg.righe.length
    reg.eApertura = quota(RE_APERTURA) >= 0.5
    reg.eChiusura = !reg.eApertura && quota(RE_CHIUSURA) >= 0.5
    reg.causale = reg.eApertura ? 'Apertura conti' : reg.eChiusura ? 'Chiusura conti' : 'Prima nota'
  }
  return registrazioni
}

// "Registrazione della prima nota" stampa i totali Dare/Avere: confronto con i movimenti letti
function controlloTotali(righe, totDare, totAvere) {
  if (eElencoGb(righe)) return { checkpointOk: 0, checkpointKo: 0 }
  const { totali } = leggiDettaglio(righe)
  if (totali.dare == null || totali.avere == null) return { checkpointOk: 0, checkpointKo: 0 }
  const ok = Math.abs(totali.dare - totDare) < 0.02 && Math.abs(totali.avere - totAvere) < 0.02
  return { checkpointOk: ok ? 1 : 0, checkpointKo: ok ? 0 : 1 }
}

export function parseListaPrimaNotaGb(righe) {
  const registrazioni = leggiRegistrazioniPrimaNotaGb(righe)
  if (!registrazioni.length) throw new Error('Nessuna registrazione trovata nella prima nota GB Software.')
  const saldoApertura = {}
  const saldoMovimenti = {}
  const saldoChiusura = {}
  const movimentiPerMese = {}
  const descrizioni = {}
  let nMovimenti = 0
  let nNonBilanciate = 0
  let totDare = 0
  let totAvere = 0
  for (const reg of registrazioni) {
    if (Math.abs(reg.righe.reduce((s, r) => s + r.segno * r.importo, 0)) > 0.02) nNonBilanciate++
    for (const r of reg.righe) {
      nMovimenti++
      if (r.segno > 0) totDare += r.importo
      else totAvere += r.importo
      // descrizione del conto: senza il testo dell'operazione ("Apertura conti" troncato)
      if (!(r.conto in descrizioni)) descrizioni[r.conto] = r.descrizioneConto.replace(/\s*Apert\S*(\s+\S*)?$/i, '').trim()
      const v = r.segno * r.importo
      if (reg.eApertura) saldoApertura[r.conto] = (saldoApertura[r.conto] || 0) + v
      else if (reg.eChiusura) saldoChiusura[r.conto] = (saldoChiusura[r.conto] || 0) + v
      else {
        saldoMovimenti[r.conto] = (saldoMovimenti[r.conto] || 0) + v
        if (!movimentiPerMese[reg.mese]) movimentiPerMese[reg.mese] = {}
        movimentiPerMese[reg.mese][r.conto] = (movimentiPerMese[reg.mese][r.conto] || 0) + v
      }
    }
  }
  const saldi = {}
  for (const c of new Set([...Object.keys(saldoApertura), ...Object.keys(saldoMovimenti)])) saldi[c] = round2((saldoApertura[c] || 0) + (saldoMovimenti[c] || 0))
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
      formato: 'gb_prima_nota',
      testate: registrazioni.length,
      movimenti: nMovimenti,
      registrazioniNonBilanciate: nNonBilanciate,
      registrazioniApertura: registrazioni.filter((r) => r.eApertura).length,
      ...controlloTotali(righe, totDare, totAvere),
      totaleGenerale: { dare: round2(totDare), avere: round2(totAvere) },
      verificaOk: 0,
      verificaKo: 0,
      dettaglioVerificaKo: [],
      attivita: [],
    },
  }
}

export function estraiMovimentiPrimaNotaGb(righe) {
  const movimenti = []
  for (const reg of leggiRegistrazioniPrimaNotaGb(righe)) {
    reg.righe.forEach((r, i) => {
      movimenti.push({
        data: reg.data, mese: reg.mese, conto: r.conto, descrizione: r.descrizioneConto, segno: r.segno, importo: r.importo,
        chiave: `${reg.causale} ${r.descrizioneOperazione}`.trim(), eApertura: reg.eApertura, eChiusura: reg.eChiusura,
        chiudeSegmento: i === reg.righe.length - 1, nDoc: r.numDoc, dtDoc: r.dataDoc, attivita: null,
      })
    })
  }
  return movimenti
}
