// Piano di ammortamento di un finanziamento rateale (tipo_impatto "finanziamento", v8). Tre forme più un
// eventuale preammortamento a soli interessi. Formule confermate da Pmi 360° in risposta alla revisione v8:
//   i = tasso_annuo_pct / 100 / m, con m = periodi/anno (12 mensile, 4 trimestrale, 2 semestrale) — tasso
//   nominale convertibile nella periodicità del piano.
//   francese: rata costante R = C·i / (1 − (1+i)^−n); interessi sul debito residuo, capitale = R − interessi.
//   italiano: quota capitale costante C/n; interessi sul debito residuo (la rata quindi decresce).
//   bullet: solo interessi a ogni scadenza; il capitale si restituisce tutto all'ultima rata.
//   preammortamento_mesi: si pagano solo interessi sul capitale intero, poi parte il piano scelto.
// ASSUNZIONE dichiarata (non specificata da Pmi 360° per periodicità non mensili): i mesi di preammortamento si
// convertono in periodi alla periodicità del piano, arrotondando (round(preammortamento_mesi / mesiPerPeriodo)).
// Va segnalata a Pmi 360° e corretta se la loro intenzione è diversa.
import { round2, MESI_PER_PERIODO } from './util.js'

export function calcolaPianoAmmortamento({ importo, tassoAnnuoPct, numeroRate, periodicita, piano, preammortamentoMesi = 0 }) {
  const m = { mensile: 12, trimestrale: 4, semestrale: 2 }[periodicita]
  const i = (tassoAnnuoPct || 0) / 100 / m
  const mesiPerPeriodo = MESI_PER_PERIODO(periodicita)
  const periodiPream = Math.round((preammortamentoMesi || 0) / mesiPerPeriodo)

  const rate = [] // { capitale, interessi, rata } — indice = periodo dall'inizio del preammortamento (o del piano, se assente)
  let residuo = importo

  for (let p = 0; p < periodiPream; p++) {
    const interessi = residuo * i
    rate.push({ capitale: 0, interessi, rata: interessi, preammortamento: true })
  }

  if (piano === 'bullet') {
    for (let k = 0; k < numeroRate; k++) {
      const interessi = residuo * i
      const capitale = k === numeroRate - 1 ? residuo : 0
      rate.push({ capitale, interessi, rata: capitale + interessi })
      residuo -= capitale
    }
  } else if (piano === 'italiano') {
    const quota = importo / numeroRate
    for (let k = 0; k < numeroRate; k++) {
      const interessi = residuo * i
      rate.push({ capitale: quota, interessi, rata: quota + interessi })
      residuo -= quota
    }
  } else {
    // francese (default): rata costante sul capitale residuo all'inizio del piano vero e proprio (dopo l'eventuale
    // preammortamento, durante il quale il capitale non si riduce)
    const capitaleIniziale = residuo
    const R = i > 0 ? (capitaleIniziale * i) / (1 - Math.pow(1 + i, -numeroRate)) : capitaleIniziale / numeroRate
    for (let k = 0; k < numeroRate; k++) {
      const interessi = residuo * i
      const capitale = R - interessi
      rate.push({ capitale, interessi, rata: R })
      residuo -= capitale
    }
  }

  return { rate, mesiPerPeriodo, periodiPream, residuoFinale: round2(residuo) }
}
