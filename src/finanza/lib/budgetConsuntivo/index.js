// Budget dai valori effettivi ("budget da consuntivo"): dai libri giornale / prime note elaborati in Documenti
// (movimenti mensili per conto) e dalla Riclassificazione si ottiene il consuntivo dell'anno in corso fino all'ultimo
// mese chiuso e la previsione fino al 31 dicembre dell'anno successivo. Modulo puro (nessun accesso al database).
//
// Regole (decise con l'utente sull'analisi dei costi di Asap Logistics, ottobre 2026):
// - L'unita' di analisi e' il conto. Costi di gestione separati da imposte sul reddito (E20) e ammortamenti (B10).
// - Ultimo mese chiuso: l'ultimo con la registrazione degli stipendi (retribuzioni); i mesi dopo possono avere
//   operazioni non ancora registrate e non si usano.
// - Ricavi: media annua dell'ultimo anno (ultimi 12 mesi chiusi / 12) per conto, senza correggere i mesi bassi.
// - Costi variabili (macrocategorie scelte, default quelle con "Spedizioni"): percentuale dei ricavi delle vendite
//   (A1) dell'anno in corso, applicata ai ricavi delle vendite di ogni mese.
// - Costi fissi, conto per conto:
//   . retribuzioni e oneri sociali: media degli ultimi 6 mesi esclusi giugno e dicembre; giugno e dicembre al
//     doppio (mensilita' aggiuntive); il premio INAIL e' annuale e segue la media annua;
//   . mensili con importo stabile negli ultimi 6 mesi: ultimo valore, anche se diverso dai precedenti (segnalato);
//   . bimestrali/trimestrali/semestrali con importo stabile e annuali: ultimo importo nei mesi del ciclo;
//   . tutti gli altri (variabili, irregolari, occasionali): media annua dell'ultimo anno; zero se prevalgono storni.
// - Ammortamenti e imposte: quota mensile dell'anno in corso se gia' accantonati, altrimenti ultimo anno chiuso / 12.
// - Oltre i 12 mesi dopo l'ultimo mese chiuso (fino a dicembre dell'anno dopo) si ripete il valore di un anno prima.
//
// Impostazioni dell'azienda (tutte facoltative): costiVariabili [macrocategorie], valoriMensili {conto: importo},
// importiPeriodici {conto: importo}, macrocategorieConti {conto: macrocategoria}, rettifiche [{ mese: 'AAAA-MM',
// da: conto, a: conto, importo, nota }] per i movimenti registrati sul conto sbagliato.
import { trovaMappaturaConto, contiDelGruppo } from '../mappatureConti'
import { macrocategoria } from './macrocategorie'

export { MACROCATEGORIE, REGOLE_MACROCATEGORIE } from './macrocategorie'

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const PROVENTI = new Set(['C15', 'C16', 'A1', 'A2', 'A3', 'A4', 'A5', 'D18'])
const RICAVI_CEE = new Set(['A1', 'A2', 'A3', 'A4', 'A5'])
const RE_STIPENDI = /RETRIBUZ|STIPEND|SALARI/i
const RE_PERSONALE = /RETRIBUZ|STIPEND|SALARI|CONTRIBUT|\bINPS\b|I\.N\.P\.S|FASC|EBILOG|ONERI SOCIALI/i
const RE_INAIL = /INAIL|I\.N\.A\.I\.L/i
const PASSI = { bimestrale: 2, trimestrale: 3, semestrale: 6 }

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const somma = (xs) => xs.reduce((s, x) => s + x, 0)
const media = (xs) => (xs.length ? somma(xs) / xs.length : 0)
const pstdev = (xs) => { const m = media(xs); return Math.sqrt(media(xs.map((x) => (x - m) ** 2))) }
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }
const etichetta = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
export const etichettaMese = (k) => `${MESI[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`

export function natura(voceCee) {
  const v = voceCee || ''
  return v === 'E20' ? 'imposte' : v.startsWith('B10') ? 'ammortamenti' : 'gestione'
}

const numerico = (gruppo) => /^\d+\//.test(gruppo || '')
const mastro = (gruppo) => parseInt(gruppo, 10)

// costo / ricavo di un conto dalla Riclassificazione (eccezione sul conto o gruppo); senza classificazione, per i
// piani dei conti numerici: mastri 61-73 costi, 50-60 ricavi
function classifica(conto, gruppo, mapAz, mapGl) {
  const m = trovaMappaturaConto(conto, mapAz, mapGl, gruppo)
  if (m) {
    if (m.categoria === 'costi' && !PROVENTI.has(m.codice_cee || '')) return { tipo: 'costo', voce: m.codice_cee || null, classificato: true }
    if (m.categoria === 'ricavi' && RICAVI_CEE.has(m.codice_cee || 'A1')) return { tipo: 'ricavo', voce: m.codice_cee || 'A1', classificato: true }
    return null
  }
  if (!numerico(gruppo)) return null
  if (mastro(gruppo) >= 61 && mastro(gruppo) <= 73) return { tipo: 'costo', voce: null, classificato: false }
  if (mastro(gruppo) >= 50 && mastro(gruppo) <= 60) return { tipo: 'ricavo', voce: 'A1', classificato: false }
  return null
}

function periodicita(attivi, coperti) {
  if (!attivi.length) return 'nessuna'
  const quota = attivi.length / coperti.length
  if (quota >= 0.85) return 'mensile'
  if (quota >= 0.6) return 'quasi mensile'
  const salti = attivi.slice(1).map((x, j) => x - attivi[j])
  const med = salti.length ? mediana(salti) : null
  if ([2, 3, 6].includes(med) && attivi.length >= 3) return { 2: 'bimestrale', 3: 'trimestrale', 6: 'semestrale' }[med]
  const anni = [...new Set(coperti.map((i) => Math.floor(i / 12)))].sort()
  const perAnno = {}
  for (const i of attivi) (perAnno[Math.floor(i / 12)] ||= []).push(i % 12)
  const presenti = anni.filter((a) => perAnno[a])
  if (presenti.length > 1 && presenti.every((a) => perAnno[a].length === 1)) {
    const mesi = presenti.map((a) => perAnno[a][0])
    if (Math.max(...mesi) - Math.min(...mesi) <= 1) return 'annuale'
  }
  if (attivi.length === 1) return 'occasionale'
  return 'irregolare'
}

// documenti: [{ anno, dati }] (dati_estratti dei libri giornale / prime note, uno per anno, il piu' recente per ultimo)
export function calcolaBudgetConsuntivo({ documenti, mappatureAzienda = [], mappatureGlobali = [], impostazioni = {} }) {
  const imp = { costiVariabili: null, valoriMensili: {}, importiPeriodici: {}, macrocategorieConti: {}, rettifiche: [], ...impostazioni }
  const docs = [...documenti].sort((a, b) => a.anno - b.anno)
  if (!docs.length) throw new Error('Nessun libro giornale o prima nota elaborato.')
  const conti = {}
  const serie = {}                                                   // conto -> indice mese -> importo (costi Dare +, ricavi Avere +)
  const avvisi = []
  let nonClassificati = 0
  for (const { anno, dati } of docs) {
    for (const g of dati?.gruppi || []) {
      for (const c of contiDelGruppo(g)) {
        const cl = classifica(c.conto, g.gruppo, mappatureAzienda, mappatureGlobali)
        if (!cl) { if (!numerico(g.gruppo) && !trovaMappaturaConto(c.conto, mappatureAzienda, mappatureGlobali, g.gruppo)) nonClassificati++; continue }
        if (!conti[c.conto]) {
          const nat = cl.tipo === 'costo' ? natura(cl.voce) : null
          conti[c.conto] = { conto: c.conto, gruppo: g.gruppo, descrizione: c.descrizione || c.conto, tipo: cl.tipo, voce: cl.voce, natura: nat, classificato: cl.classificato }
        }
        const s = (serie[c.conto] ||= {})
        const mensile = c.mensile || g.mensile || {}
        for (const [m, v] of Object.entries(mensile)) {
          const i = anno * 12 + Number(m) - 1
          s[i] = (s[i] || 0) + (cl.tipo === 'ricavo' ? -v : v)
        }
      }
    }
  }
  for (const r of imp.rettifiche || []) {
    const i = Number(r.mese.slice(0, 4)) * 12 + Number(r.mese.slice(5)) - 1
    if (!conti[r.da] || !conti[r.a]) { avvisi.push(`Rettifica ${r.mese} non applicata: conto ${!conti[r.da] ? r.da : r.a} non trovato.`); continue }
    serie[r.da][i] = (serie[r.da][i] || 0) - r.importo
    serie[r.a][i] = (serie[r.a][i] || 0) + r.importo
  }
  for (const c of Object.values(conti)) if (c.tipo === 'costo') c.macrocategoria = macrocategoria(c.conto, c.descrizione, c.natura, imp.macrocategorieConti)

  // ultimo mese chiuso di ogni anno: ultima registrazione degli stipendi
  const stipendi = Object.values(conti).filter((c) => c.tipo === 'costo' && c.natura === 'gestione' && RE_STIPENDI.test(c.descrizione))
  const completi = {}
  for (const { anno } of docs) {
    const mesi = stipendi.flatMap((c) => Object.entries(serie[c.conto]).filter(([i, v]) => Math.floor(i / 12) === anno && v > 0).map(([i]) => (i % 12) + 1))
    completi[anno] = mesi.length ? Math.max(...mesi) : 12
  }
  const annoCorrente = docs[docs.length - 1].anno
  if (!stipendi.length) avvisi.push('Nessun conto di retribuzioni trovato: l\'ultimo mese chiuso e\' dicembre.')
  const coperti = docs.flatMap(({ anno }) => Array.from({ length: completi[anno] }, (_, m) => anno * 12 + m))
  const ultimo = annoCorrente * 12 + completi[annoCorrente] - 1
  const finestra = Array.from({ length: 12 }, (_, j) => ultimo - 11 + j)
  if (!coperti.includes(finestra[0])) avvisi.push(`Mancano dati per alcuni dei 12 mesi prima di ${etichettaMese(etichetta(ultimo))}: carica anche il libro giornale dell'anno precedente.`)
  const consuntivo = Array.from({ length: completi[annoCorrente] }, (_, m) => annoCorrente * 12 + m)
  const fine = (annoCorrente + 1) * 12 + 11
  const futuri = Array.from({ length: fine - ultimo }, (_, j) => ultimo + 1 + j)
  const proiettati = futuri.slice(0, 12)
  const val = (conto, i) => serie[conto]?.[i] || 0

  // proiezione dei costi di gestione, conto per conto
  const proiezione = {}
  for (const c of Object.values(conti)) {
    if (c.tipo !== 'costo' || c.natura !== 'gestione') continue
    const valori = finestra.map((i) => val(c.conto, i))
    if (!valori.some((v) => Math.abs(v) >= 0.005)) continue
    const attivi = coperti.filter((i) => Math.abs(val(c.conto, i)) >= 0.005)
    const per = periodicita(attivi, coperti)
    const piano = Object.fromEntries(proiettati.map((i) => [i, 0]))
    let metodo
    let base
    let nota = ''
    let segnalato = false
    const recenti = finestra.slice(-6).map((i) => val(c.conto, i)).filter((v) => Math.abs(v) >= 0.005)
    const stabile = recenti.length >= 3 && media(recenti) && pstdev(recenti) / Math.abs(media(recenti)) < 0.05
    const occorrenze = finestra.filter((i) => Math.abs(val(c.conto, i)) >= 0.005)
    const occ = occorrenze.map((i) => val(c.conto, i))
    const stabilePeriodico = occ.length >= 2 && media(occ) && pstdev(occ) / Math.abs(media(occ)) < 0.05
    const mediaAnnua = () => { base = r2(somma(valori) / 12); if (base <= 0) { base = 0; nota = 'nell\'ultimo anno prevalgono storni o rettifiche: nessun costo previsto' } proiettati.forEach((i) => { piano[i] = base }) }
    if (imp.valoriMensili[c.conto] != null) {
      base = Number(imp.valoriMensili[c.conto]); metodo = 'valore deciso'
      proiettati.forEach((i) => { piano[i] = base })
    } else if (c.macrocategoria === 'Personale' && RE_PERSONALE.test(c.descrizione)) {
      const mesi6 = [...finestra].reverse().filter((i) => ![5, 11].includes(i % 12)).slice(0, 6)
      base = r2(somma(mesi6.map((i) => val(c.conto, i))) / 6)
      metodo = 'personale: media 6 mesi esclusi giugno e dicembre, giugno e dicembre doppi'
      nota = 'mesi: ' + [...mesi6].sort((a, b) => a - b).map((i) => etichettaMese(etichetta(i))).join(', ')
      proiettati.forEach((i) => { piano[i] = base * ([5, 11].includes(i % 12) ? 2 : 1) })
    } else if (c.macrocategoria === 'Personale' && RE_INAIL.test(c.descrizione)) {
      metodo = 'premio INAIL: media annua dell\'ultimo anno'; mediaAnnua()
    } else if (['mensile', 'quasi mensile'].includes(per) && stabile) {
      base = recenti[recenti.length - 1]; metodo = 'fisso mensile: ultimo valore'
      const ultimi3 = recenti.slice(-3)
      if (Math.max(...ultimi3) - Math.min(...ultimi3) > 0.02 * Math.abs(base)) {
        segnalato = true
        nota = `diverso dai mesi precedenti (${ultimi3.map((v) => v.toLocaleString('it-IT', { minimumFractionDigits: 2 })).join(', ')}): usato l'ultimo`
      }
      proiettati.forEach((i) => { piano[i] = base })
    } else if (per === 'annuale' || (PASSI[per] && stabilePeriodico)) {
      base = imp.importiPeriodici[c.conto] != null ? Number(imp.importiPeriodici[c.conto]) : occ[occ.length - 1]
      metodo = `${per}: ultimo importo nei mesi del ciclo`
      if (per !== 'annuale' && occ.length >= 2 && imp.importiPeriodici[c.conto] == null && Math.abs(occ[occ.length - 2] - occ[occ.length - 1]) > 0.02 * Math.abs(base)) {
        segnalato = true; nota = `diverso dalla scadenza precedente (${r2(occ[occ.length - 2])} e ${r2(occ[occ.length - 1])}): usato l'ultimo`
      }
      if (per === 'annuale') proiettati.forEach((i) => { if (occorrenze.some((o) => o % 12 === i % 12)) piano[i] = base })
      else for (let i = occorrenze[occorrenze.length - 1] + PASSI[per]; i <= proiettati[proiettati.length - 1]; i += PASSI[per]) if (i in piano) piano[i] = base
    } else {
      metodo = 'media annua dell\'ultimo anno'; mediaAnnua()
    }
    if (!coperti.some((i) => Math.floor(i / 12) === annoCorrente && Math.abs(val(c.conto, i)) >= 0.005)) nota = (nota ? nota + '; ' : '') + `conto non usato nel ${annoCorrente}`
    proiezione[c.conto] = { metodo, base: r2(base), nota, segnalato, periodicita: per, ultimi12: r2(somma(valori)), piano }
  }

  // budget
  const reale = (conto) => Object.fromEntries(consuntivo.map((i) => [etichetta(i), r2(val(conto, i))]))
  const prevSu = (piano, i) => (i in piano ? piano[i] : piano[i - 12] || 0)
  const ricaviConti = Object.values(conti).filter((c) => c.tipo === 'ricavo')
  const ricavi = []
  for (const c of ricaviConti.sort((a, b) => a.conto.localeCompare(b.conto))) {
    let base = r2(somma(finestra.map((i) => val(c.conto, i))) / 12)
    if (base <= 0 && !consuntivo.some((i) => val(c.conto, i))) continue
    base = Math.max(base, 0)
    ricavi.push({ conto: c.conto, descrizione: c.descrizione, voce: c.voce, metodo: 'media annua dell\'ultimo anno', base,
      valori: { ...reale(c.conto), ...Object.fromEntries(futuri.map((i) => [etichetta(i), base])) } })
  }
  const vendite = (i) => somma(ricaviConti.filter((c) => c.voce === 'A1').map((c) => val(c.conto, i)))
  const venditeAnno = somma(consuntivo.map(vendite))
  const venditePrev = (k) => somma(ricavi.filter((x) => x.voce === 'A1').map((x) => x.valori[k] || 0))

  const macroCosti = [...new Set(Object.values(conti).filter((c) => c.tipo === 'costo').map((c) => c.macrocategoria))]
  const variabili = imp.costiVariabili || macroCosti.filter((m) => /Spedizion/i.test(m))
  const costiVariabili = []
  const costiFissi = []
  const altri = []
  for (const c of Object.values(conti).filter((x) => x.tipo === 'costo').sort((a, b) => a.conto.localeCompare(b.conto))) {
    const re = reale(c.conto)
    if (c.natura === 'gestione') {
      const p = proiezione[c.conto]
      if (!p && !Object.values(re).some((v) => v)) continue
      if (variabili.includes(c.macrocategoria)) {
        const percentuale = venditeAnno ? Math.round((somma(consuntivo.map((i) => val(c.conto, i))) / venditeAnno) * 1e6) / 1e6 : 0
        costiVariabili.push({ conto: c.conto, descrizione: c.descrizione, macrocategoria: c.macrocategoria, percentuale,
          valori: { ...re, ...Object.fromEntries(futuri.map((i) => [etichetta(i), r2(percentuale * venditePrev(etichetta(i)))])) } })
      } else {
        costiFissi.push({ conto: c.conto, descrizione: c.descrizione, macrocategoria: c.macrocategoria, ...(p ? { metodo: p.metodo, base: p.base, nota: p.nota, segnalato: p.segnalato, periodicita: p.periodicita } : { metodo: 'nessun movimento nell\'ultimo anno', base: 0, nota: '' }),
          valori: { ...re, ...Object.fromEntries(futuri.map((i) => [etichetta(i), r2(p ? prevSu(p.piano, i) : 0)])) } })
      }
    } else {
      const stessa = Object.values(conti).filter((d) => d.tipo === 'costo' && d.natura === c.natura)
      const inCorso = stessa.some((d) => consuntivo.some((i) => val(d.conto, i)))
      const base = inCorso ? somma(consuntivo.map((i) => val(c.conto, i))) / consuntivo.length : somma(Array.from({ length: 12 }, (_, m) => val(c.conto, (annoCorrente - 1) * 12 + m))) / 12
      if (!base && !Object.values(re).some((v) => v)) continue
      altri.push({ conto: c.conto, descrizione: c.descrizione, natura: c.natura, metodo: inCorso ? `quota mensile del ${annoCorrente}` : `ultimo anno chiuso (${annoCorrente - 1}) / 12`,
        valori: { ...re, ...Object.fromEntries(futuri.map((i) => [etichetta(i), r2(base)])) } })
    }
  }

  const mesi = [...consuntivo, ...futuri].map(etichetta)
  const tot = (righe) => Object.fromEntries(mesi.map((k) => [k, r2(somma(righe.map((x) => x.valori[k] || 0)))]))
  const totali = { ricavi: tot(ricavi), vendite: tot(ricavi.filter((x) => x.voce === 'A1')), variabili: tot(costiVariabili), fissi: tot(costiFissi),
    ammortamenti: tot(altri.filter((x) => x.natura === 'ammortamenti')), imposte: tot(altri.filter((x) => x.natura === 'imposte')) }
  for (const k of mesi) {
    totali.margine = { ...totali.margine, [k]: r2(totali.ricavi[k] - totali.variabili[k]) }
    totali.ebitda = { ...totali.ebitda, [k]: r2(totali.margine[k] - totali.fissi[k]) }
    totali.ebit = { ...totali.ebit, [k]: r2(totali.ebitda[k] - totali.ammortamenti[k]) }
    totali.netto = { ...totali.netto, [k]: r2(totali.ebit[k] - totali.imposte[k]) }
  }
  // imposte sul reddito annue (base di saldo e acconti nel cash flow): anni chiusi dal giornale, anno in corso e
  // successivo dal budget (consuntivo + previsione)
  const imposteAnnue = {}
  const contiImposte = Object.values(conti).filter((c) => c.tipo === 'costo' && c.natura === 'imposte')
  for (const { anno } of docs) {
    if (anno >= annoCorrente) continue
    imposteAnnue[anno] = r2(somma(contiImposte.flatMap((c) => Array.from({ length: 12 }, (_, m) => val(c.conto, anno * 12 + m)))))
  }
  for (const a of [annoCorrente, annoCorrente + 1]) imposteAnnue[a] = r2(somma(mesi.filter((k) => k.startsWith(String(a))).map((k) => totali.imposte[k] || 0)))
  if (nonClassificati) avvisi.push(`${nonClassificati} conti non classificati in Riclassificazione: completa la Riclassificazione, altrimenti restano fuori dal budget.`)
  return {
    annoCorrente, ultimoMeseChiuso: etichetta(ultimo), mesiConsuntivo: consuntivo.map(etichetta), mesiPrevisione: futuri.map(etichetta),
    base: `${etichettaMese(etichetta(finestra[0]))} - ${etichettaMese(etichetta(finestra[11]))}`,
    costiVariabiliMacrocategorie: variabili, macrocategorieCosti: macroCosti.sort(), venditeAnnoInCorso: r2(venditeAnno),
    ricavi, costiVariabili, costiFissi, ammortamentiImposte: altri, totali, imposteAnnue, avvisi,
  }
}

// righe per budget_voci di un anno solare (12 mesi): ricavi e costi di gestione conto per conto
const CHIAVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export function vociBudgetAnno(risultato, anno) {
  const righe = [
    ...risultato.ricavi.map((x) => ({ categoria: 'ricavi', ...x })),
    ...[...risultato.costiVariabili, ...risultato.costiFissi].map((x) => ({ categoria: 'costi', ...x })),
  ]
  const conteggio = {}
  righe.forEach((x) => { conteggio[x.descrizione] = (conteggio[x.descrizione] || 0) + 1 })
  return righe.map((x) => {
    const mesi = Object.fromEntries(CHIAVI.map((m, j) => [m, r2(x.valori[`${anno}-${String(j + 1).padStart(2, '0')}`] || 0)]))
    return { categoria: x.categoria, descrizione: conteggio[x.descrizione] > 1 ? `${x.descrizione} (${x.conto})` : x.descrizione, ...mesi, totale_annuo: r2(somma(Object.values(mesi))) }
  }).filter((x) => x.totale_annuo !== 0 || CHIAVI.some((m) => x[m]))
}
