// Bilancio di esercizio da AS/400 (es. Asap Logistics) a sezioni contrapposte, con i soli conti di 12 cifre
// (gruppo 2 + sottogruppo 4 + conto 6) e, sull'ultimo conto di ogni sottogruppo, il totale del sottogruppo:
//
//   --------- ATTIVITA  ---------                               ---------  PASSIVITA  ---------
//   Codice conto Descrizione---- Saldi---- Totali----           Codice conto Descrizione---- Saldi---- Totali----
//   010606000001 Spese costituzione e impianto   1.770,33       090303000002 I.V.A. su vendite      191,40
//   010606000003 Spese su beni di terzi           5.994,84  7.765,17   090303000006 Erario c/IRES  18.523,00
//
// Il gruppo della Riclassificazione e' "GG/SSSS" (es. "01/0606"), lo stesso della Lista Prima Nota AS/400
// (../giornali/as400.js). La stampa non ha le descrizioni dei sottogruppi: si usa quella del conto con il saldo
// piu' alto del sottogruppo. Stessa uscita del lettore Buffetti (voci di livello 2 e 3).
const AMT = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`
const RE_VOCE = new RegExp(String.raw`(\d{12})\s+(\S.*?)\s+(${AMT})(?:\s+(${AMT}))?(?=\s{2,}\d{12}|\s*$)`, 'g')
const RE_TOTALE = new RegExp(String.raw`(Totale attivit\S*|Totale passivit\S*|Totale costi|Totale ricavi|Risultato positivo|Risultato negativo)\s+(${AMT})`, 'gi')

const parseNum = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'))
const CHIAVI_TOTALI = { 'totale attivita': 'totale_attivita', 'totale passivita': 'totale_passivita', 'totale costi': 'totale_costi', 'totale ricavi': 'totale_ricavi', 'risultato positivo': 'utile_desercizio', 'risultato negativo': 'perdita_desercizio' }
const chiaveTotale = (t) => CHIAVI_TOTALI[t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')]

export const eBilancioAnaliticoAs400 = (righe) =>
  righe.some((ln) => /Bilancio di esercizio dal/i.test(ln)) &&
  righe.some((ln) => /ATTIVITA/.test(ln) && /PASSIVITA/.test(ln)) &&
  righe.some((ln) => /Codice conto Descrizione.*Codice conto Descrizione/.test(ln))

export function leggiBilancioAnaliticoAs400(righe) {
  let sezione = null
  let split = null
  let anno = null
  const conti = []
  const totali = {}
  for (const ln of righe) {
    const periodo = ln.match(/dal\s+\d{1,2}\/\d{2}\/\d{2}\s+al\s+\d{1,2}\/\d{2}\/(\d{2})/i)
    if (periodo) anno = anno || 2000 + Number(periodo[1])
    if (/-\s*ATTIVITA\s.*PASSIVITA/.test(ln)) { sezione = 'SP'; continue }
    if (/-\s*COSTI\s.*RICAVI/.test(ln)) { sezione = 'CE'; continue }
    if (/Codice conto Descrizione/.test(ln)) { split = ln.lastIndexOf('Codice conto'); continue }
    if (!sezione || split == null) continue
    for (const t of ln.matchAll(RE_TOTALE)) {
      const k = chiaveTotale(t[1])
      if (k) totali[k] = parseNum(t[2])
    }
    for (const m of ln.matchAll(RE_VOCE)) {
      const destra = m.index >= split - 4
      const lato = sezione === 'SP' ? (destra ? 'passivita' : 'attivita') : (destra ? 'ricavi' : 'costi')
      const c = m[1]
      conti.push({ sezione, lato, livello: 3, codice: `${c.slice(0, 2)}/${c.slice(2, 6)}/${c.slice(6)}`, descrizione: m[2].replace(/\s+/g, ' ').trim(), importo: parseNum(m[3]) })
    }
  }
  // voci di sottogruppo (livello 2): somma per lato; descrizione del conto con il saldo piu' alto del lato
  // prevalente, uguale su entrambi i lati (es. "13/0303": banche in attivo e un finanziamento in passivo)
  const gruppi = new Map()
  for (const v of conti) {
    const g = v.codice.split('/').slice(0, 2).join('/')
    const k = `${v.sezione}|${g}|${v.lato}`
    const voce = gruppi.get(k) || { sezione: v.sezione, lato: v.lato, livello: 2, codice: g, descrizione: v.descrizione, importo: 0, max: 0 }
    voce.importo += v.importo
    if (v.importo > voce.max) { voce.max = v.importo; voce.descrizione = v.descrizione }
    gruppi.set(k, voce)
  }
  const livello2 = [...gruppi.values()]
  for (const v of livello2) {
    const prevalente = livello2.filter((x) => x.sezione === v.sezione && x.codice === v.codice).sort((x, y) => y.importo - x.importo)[0]
    v.descrizioneGruppo = prevalente.descrizione
  }
  const voci2 = livello2.map(({ max, descrizioneGruppo, ...v }) => ({ ...v, descrizione: descrizioneGruppo, importo: Math.round(v.importo * 100) / 100 }))
  return { formato: 'as400', anno, voci: [...voci2, ...conti], totali }
}
