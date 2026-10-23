// Bilancio (situazione contabile) GB Software a sezioni contrapposte, con i mastri di 2 cifre e i conti numerici:
//
//                     * BILANCIO *                          dal 01/01/2026 al 31/08/2026
//                      ATTIVITÀ                  STATO PATRIMONIALE                                PASSIVITÀ
//   20       Immobilizzazioni immateriali    48.224,16      10       Patrimonio netto            4.436.165,82
//   20000    Costi di costituz.e impianto    47.918,12      10020    Capitale sociale/Patr.netto   600.000,00
//
// I conti hanno gli stessi codici del libro giornale GB (../giornali/gb.js) e si convertono allo stesso modo
// ("20000" -> "20/000/0", gruppo "20/000"). La stampa non ha il livello di gruppo: le voci di livello 2 per la
// Riclassificazione si ottengono sommando i conti dello stesso gruppo, con la descrizione del conto piu' grande.
// Clienti (mastro 40) e fornitori (mastro 41) sono stampati solo come totale del mastro: diventano i gruppi "40/C"
// e "41/F" del giornale. Il codice puo' essere attaccato alla descrizione ("21382100Fondo amm/to di periodo").
// Stessa uscita degli altri lettori (voci con sezione, lato, livello, codice, descrizione, importo; totali).
import { contoGb } from '../giornali/gb'

// gruppo come gruppoDiConto (libroGiornale.js) per i codici GB, senza dipendere dal lettore PDF
const gruppoDiConto = (conto) => { const c = conto.split('/'); return /^[CF]$/.test(c[2]) ? `${c[0]}/${c[2]}` : `${c[0]}/${c[1]}` }

const AMT = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`
const RE_VOCE = new RegExp(String.raw`(?:^|\s)(\d{2}(?:\d{0,8}|[0-9A-Z]{1,8}(?=\s)))\s*([^\d\s].*?)\s+(${AMT})(?=\s|$)`, 'g')
const RE_TOTALE = new RegExp(String.raw`(TOTALE|PERDITA DI ESERCIZIO|UTILE DI ESERCIZIO)\s+(${AMT})`, 'g')

const parseNum = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'))
const r2 = (n) => Math.round(n * 100) / 100

export const eBilancioAnaliticoGb = (righe) =>
  righe.some((ln) => /\*\s*BILANCIO\s*\*/.test(ln)) &&
  righe.some((ln) => /STATO PATRIMONIALE/.test(ln) && /ATTIVIT/.test(ln) && /PASSIVIT/.test(ln)) &&
  righe.some((ln) => /^\s*\d{5,10}\s*\S.*\d,\d{2}/.test(ln))

export function leggiBilancioAnaliticoGb(righe) {
  let sezione = null
  let split = null
  let anno = null
  const mastri = []
  const conti = []
  const totali = {}
  for (const ln of righe) {
    const periodo = ln.match(/dal\s+\d{2}\/\d{2}\/\d{4}\s+al\s+\d{2}\/\d{2}\/(\d{4})/i)
    if (periodo) anno = anno || Number(periodo[1])
    // le intestazioni dei lati sono centrate sulle colonne: il confine tra le due colonne e' il centro del titolo
    if (/STATO PATRIMONIALE/.test(ln) && /PASSIVIT/.test(ln)) { sezione = 'SP'; split = ln.indexOf('STATO PATRIMONIALE') + 9; continue }
    if (/CONTO ECONOMICO/.test(ln) && /RICAVI/.test(ln)) { sezione = 'CE'; split = ln.indexOf('CONTO ECONOMICO') + 7; continue }
    if (!sezione || split == null) continue
    let trovatoTotale = false
    for (const t of ln.matchAll(RE_TOTALE)) {
      trovatoTotale = true
      const destra = t.index >= split
      const chiave = t[1] === 'TOTALE'
        ? (sezione === 'SP' ? (destra ? 'totale_passivita' : 'totale_attivita') : (destra ? 'totale_ricavi' : 'totale_costi'))
        : t[1] === 'PERDITA DI ESERCIZIO' ? 'perdita_desercizio' : 'utile_desercizio'
      totali[chiave] = parseNum(t[2])
    }
    if (trovatoTotale) continue
    for (const m of ln.matchAll(RE_VOCE)) {
      const inizio = m.index + m[0].indexOf(m[1])
      const destra = inizio >= split
      const lato = sezione === 'SP' ? (destra ? 'passivita' : 'attivita') : (destra ? 'ricavi' : 'costi')
      const v = { sezione, lato, codiceGb: m[1], descrizione: m[2].trim(), importo: parseNum(m[3]) }
      if (m[1].length === 2) mastri.push({ ...v, livello: 1, codice: m[1] })
      else conti.push({ ...v, livello: 3, codice: contoGb(m[1]) })
    }
  }

  // livello 2: somma dei conti dello stesso gruppo (per sezione e lato)
  const gruppi = new Map()
  for (const c of conti) {
    const g = gruppoDiConto(c.codice)
    const k = `${c.sezione}|${c.lato}|${g}`
    const x = gruppi.get(k) || { sezione: c.sezione, lato: c.lato, livello: 2, codice: g, importo: 0, max: -1, descrizione: '' }
    x.importo = r2(x.importo + c.importo)
    if (c.importo > x.max) { x.max = c.importo; x.descrizione = c.descrizione }
    gruppi.set(k, x)
  }
  // clienti e fornitori: solo il totale del mastro
  for (const m of mastri) {
    if (!['40', '41'].includes(m.codice)) continue
    if (conti.some((c) => c.codiceGb.startsWith(m.codice) && c.sezione === m.sezione && c.lato === m.lato)) continue
    const g = m.codice === '40' ? '40/C' : '41/F'
    gruppi.set(`${m.sezione}|${m.lato}|${g}`, { sezione: m.sezione, lato: m.lato, livello: 2, codice: g, importo: m.importo, descrizione: m.descrizione })
  }
  const livello2 = [...gruppi.values()].map(({ max, ...v }) => v)
  return { formato: 'gb', anno, voci: [...mastri, ...livello2, ...conti].map(({ codiceGb, ...v }) => v), totali }
}
