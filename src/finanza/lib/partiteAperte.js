// Righe scadenzario per le partite aperte a fine dell'ultimo mese reale
// chiuso: fatture clienti emesse e non ancora incassate, fatture fornitori
// ricevute e non ancora pagate. Sono il "ponte" tra il consuntivo reale
// (Libro Giornale) e la proiezione dal budget — senza queste righe il primo
// mese proiettato risulterebbe vuoto in entrata/uscita perche' la logica
// budget->scadenzario genera solo gli incassi/pagamenti relativi a
// vendite/acquisti budgetati DA quel mese in poi, non quelli gia' maturati
// nei mesi reali gia' chiusi.
//
// Il saldo di ogni conto cliente/fornitore a fine mese chiuso (dai gruppi di
// conto "14/C"/"40/F" gia' calcolati per la Riclassificazione: Dare=+,
// Avere=- per il parser) e' l'importo ancora aperto. Il tempo di incasso/
// pagamento stimato usa lo storico DSO/DPO REALE per quello specifico
// cliente/fornitore (calcolato dall'Analisi dei flussi), o la media
// ponderata complessiva se il conto non ha ancora storico.
const round2 = (n) => Math.round(n * 100) / 100

function dateUTC(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d))
}
function addDays(date, giorni) {
  return new Date(date.getTime() + giorni * 86400000)
}
function meseBudgetDi(date) {
  return date.getUTCFullYear() * 100 + (date.getUTCMonth() + 1)
}

export function calcolaRigheAperture({ contiClienti, contiFornitori, dsoDettaglio, dpoDettaglio, dsoMedio, dpoMedio, anno, meseChiusura }) {
  const dataChiusura = dateUTC(anno, meseChiusura, 28)
  const dsoPerConto = new Map((dsoDettaglio || []).map((r) => [r.conto, r.giorniMedi]))
  const dpoPerConto = new Map((dpoDettaglio || []).map((r) => [r.conto, r.giorniMedi]))

  const righe = []

  for (const c of contiClienti || []) {
    if ((c.valore || 0) <= 0.01) continue // niente aperto (o acconto ricevuto: saldo negativo, ignorato qui)
    const giorni = dsoPerConto.has(c.conto) ? dsoPerConto.get(c.conto) : dsoMedio ?? 30
    const dataIncasso = addDays(dataChiusura, giorni)
    righe.push({
      direzione: 'entrata',
      categoria: 'crediti_aperti',
      conto: c.conto,
      controparte: c.descrizione || c.conto,
      importo: round2(c.valore),
      dataFattura: dataChiusura,
      dataScadenza: dataIncasso,
      dataIncassoEffettivo: null,
      giorniDilazione: Math.round(giorni),
      giorniRitardo: 0,
      tipoDato: 'certo',
      probabilita: 100,
      note: `Credito aperto a fine mese ${meseChiusura}/${anno} (fattura emessa, non incassata) — incasso stimato con DSO ${dsoPerConto.has(c.conto) ? 'storico del cliente' : 'medio'} (${Math.round(giorni)}gg)`,
      meseBudget: meseBudgetDi(dataIncasso),
    })
  }

  for (const f of contiFornitori || []) {
    const debito = -(f.valore || 0) // fornitori: Avere aumenta il debito -> saldo negativo
    if (debito <= 0.01) continue
    const giorni = dpoPerConto.has(f.conto) ? dpoPerConto.get(f.conto) : dpoMedio ?? 30
    const dataPag = addDays(dataChiusura, giorni)
    righe.push({
      direzione: 'uscita',
      categoria: 'debiti_aperti',
      conto: f.conto,
      controparte: f.descrizione || f.conto,
      importo: round2(debito),
      dataFattura: dataChiusura,
      dataScadenza: dataPag,
      dataIncassoEffettivo: null,
      giorniDilazione: Math.round(giorni),
      giorniRitardo: 0,
      tipoDato: 'certo',
      probabilita: 100,
      note: `Debito aperto a fine mese ${meseChiusura}/${anno} (fattura ricevuta, non pagata) — pagamento stimato con DPO ${dpoPerConto.has(f.conto) ? 'storico del fornitore' : 'medio'} (${Math.round(giorni)}gg)`,
      meseBudget: meseBudgetDi(dataPag),
    })
  }

  return righe
}

// Differimento dichiarato dall'utente per singola partita (per conto): la partita resta nei flussi ma la scadenza
// stimata slitta di N giorni, e con lei il mese di cassa. differimenti: Map conto -> giorni (interi > 0).
export function applicaDifferimenti(righe, differimenti) {
  if (!differimenti || differimenti.size === 0) return righe
  return righe.map((r) => {
    const giorni = differimenti.get(r.conto)
    if (!giorni) return r
    const dataScadenza = addDays(r.dataScadenza, giorni)
    return {
      ...r,
      dataScadenza,
      giorniDilazione: r.giorniDilazione + giorni,
      differimentoGiorni: giorni,
      meseBudget: meseBudgetDi(dataScadenza),
      note: `${r.note} — differita di ${giorni}gg su indicazione dell'utente`,
    }
  })
}
