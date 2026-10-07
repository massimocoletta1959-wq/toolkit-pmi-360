// Bilancio analitico Seasoft a sezioni contrapposte (Attivita'/Passivita', Costi/Ricavi), con la gerarchia del
// piano dei conti mastro / conto / sottoconto e i saldi:
//
//    ATTIVITA'                                              PASSIVITA'
//   4 / 10            IMPIANTI E MACCHINARIO     3.789,15   4 / 10          IMPIANTI E MACCHINARIO        2.399,27
//   4 / 10 / 1         Impianti generici          2.689,15   4 / 10 / 101     F.do amm.imp.generici          1.299,27
//
// Un conto con saldo di segno opposto alla natura del suo mastro sta sul lato opposto (es. i fondi ammortamento
// tra le passivita' sotto lo stesso gruppo del bene): il lato dice solo il segno del saldo.
const RE_VOCE = /(\d+(?:\s*\/\s*\d+){0,2})\s{2,}(\S.*?)\s{2,}(\d[\d.]*,\d{2})/g
const RE_TOTALE = /(TOTALE ATTIVITA'|TOTALE PASSIVITA'|TOTALE COSTI|TOTALE RICAVI|UTILE D'ESERCIZIO|PERDITA D'ESERCIZIO)\s+(\d[\d.]*,\d{2})/g

const parseNum = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'))

export const eBilancioAnaliticoSeasoft = (righe) =>
  righe.some((ln) => /STATO PATRIMONIALE/.test(ln)) &&
  righe.some((ln) => /ATTIVITA'/.test(ln) && /PASSIVITA'/.test(ln)) &&
  righe.some((ln) => /^\s*\d+\s*\/\s*\d+\s*\/\s*\d+\s{2,}/.test(ln))

export function leggiBilancioAnaliticoSeasoft(righe) {
  let sezione = null
  let split = null
  let anno = null
  const voci = []
  const totali = {}
  for (const ln of righe) {
    const periodo = ln.match(/DAL\s+\d{2}\/\d{2}\/(\d{4})\s+AL\s+\d{2}\/\d{2}\/(\d{4})/)
    if (periodo) anno = anno || Number(periodo[2])
    if (/STATO PATRIMONIALE/.test(ln)) { sezione = 'SP'; continue }
    if (/CONTO ECONOMICO/.test(ln)) { sezione = 'CE'; continue }
    if (/ATTIVITA'/.test(ln) && /PASSIVITA'/.test(ln) && !/TOTALE/.test(ln)) { split = ln.indexOf("PASSIVITA'"); continue }
    if (/^\s*COSTI\s{2,}.*RICAVI\s*$/.test(ln)) { split = ln.indexOf('RICAVI'); continue }
    if (!sezione || split == null) continue
    let trovatoTotale = false
    for (const t of ln.matchAll(RE_TOTALE)) {
      totali[t[1].replace("'", '').replace(/\s+/g, '_').toLowerCase()] = parseNum(t[2])
      trovatoTotale = true
    }
    if (trovatoTotale) continue
    for (const m of ln.matchAll(RE_VOCE)) {
      const destra = m.index >= split - 4
      const lato = sezione === 'SP' ? (destra ? 'passivita' : 'attivita') : (destra ? 'ricavi' : 'costi')
      const codice = m[1].replace(/\s+/g, '')
      voci.push({ sezione, lato, livello: codice.split('/').length, codice, descrizione: m[2].trim(), importo: parseNum(m[3]) })
    }
  }
  return { formato: 'seasoft', anno, voci, totali }
}
