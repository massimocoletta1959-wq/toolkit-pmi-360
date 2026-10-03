// Tempi medi di incasso (DSO, clienti) e di pagamento (DPO, fornitori), calcolati
// dal Libro Giornale con abbinamento ESATTO fattura/incasso-pagamento: sulle
// righe di incasso/pagamento la colonna "Dt. Doc." del software di contabilita'
// non riporta la data del movimento ma quella della fattura originale a cui si
// riferisce, quindi basta la singola riga di incasso/pagamento (data movimento -
// Dt. Doc. = giorni), senza dover cercare e riabbinare la riga di emissione.
//
// Le partite aperte a inizio anno (saldo di apertura, senza N.Doc./Dt.Doc. nel
// Libro Giornale dell'anno in corso perche' la fattura e' dell'anno precedente)
// non vengono conteggiate: recuperarle richiede di incrociare il Libro Giornale
// dell'anno precedente (non ancora implementato).
const round2 = (n) => Math.round(n * 100) / 100

function parseData(s) {
  const [d, m, y] = s.split('/').map(Number)
  return Date.UTC(y, m - 1, d)
}

function differenzaGiorni(data, dtDoc) {
  return Math.round((parseData(data) - parseData(dtDoc)) / 86400000)
}

const GIORNI_MASSIMI_PLAUSIBILI = 730

// opzioni.escludiSottoSoglia: se true, le singole operazioni con giorni <
// opzioni.sogliaGiorni (es. incassi/pagamenti a zero o quasi zero giorni, che
// possono essere storni, compensazioni o riconciliazioni piu' che veri e
// propri incassi/pagamenti a termine) non entrano nel calcolo della media, ne'
// per il singolo cliente/fornitore ne' nella media ponderata complessiva.
export function calcolaDsoDpo(movimenti, opzioni = {}) {
  const escludiSottoSoglia = !!opzioni.escludiSottoSoglia
  const sogliaGiorni = opzioni.sogliaGiorni ?? 2
  const clienti = {}
  const fornitori = {}
  let scartatiSenzaDoc = 0
  let scartatiAnomali = 0
  let scartatiSottoSoglia = 0

  for (const m of movimenti) {
    if (m.eApertura || m.eChiusura) continue
    const isCliente = m.conto.endsWith('/C')
    const isFornitore = m.conto.endsWith('/F')
    if (!isCliente && !isFornitore) continue
    // solo le righe di incasso (Avere sul cliente) o di pagamento (Dare sul
    // fornitore): le righe di emissione fattura hanno segno opposto
    if (isCliente && m.segno !== -1) continue
    if (isFornitore && m.segno !== 1) continue
    if (!m.nDoc || !m.dtDoc) {
      scartatiSenzaDoc++
      continue
    }
    const giorni = differenzaGiorni(m.data, m.dtDoc)
    if (giorni < 0 || giorni > GIORNI_MASSIMI_PLAUSIBILI) {
      scartatiAnomali++
      continue
    }
    if (escludiSottoSoglia && giorni < sogliaGiorni) {
      scartatiSottoSoglia++
      continue
    }
    const dest = isCliente ? clienti : fornitori
    if (!dest[m.conto]) dest[m.conto] = { descrizione: m.descrizione, righe: [] }
    dest[m.conto].righe.push({ giorni, importo: m.importo })
  }

  function riepiloga(dest) {
    const dettaglio = []
    let sommaGiorniPonderata = 0
    let sommaImporti = 0
    let nOperazioni = 0
    for (const [conto, v] of Object.entries(dest)) {
      const importoTotale = round2(v.righe.reduce((s, r) => s + r.importo, 0))
      if (importoTotale <= 0) continue
      const giorniMedi = round2(v.righe.reduce((s, r) => s + r.giorni * r.importo, 0) / importoTotale)
      dettaglio.push({ conto, descrizione: v.descrizione || conto, nOperazioni: v.righe.length, importoTotale, giorniMedi })
      sommaGiorniPonderata += giorniMedi * importoTotale
      sommaImporti += importoTotale
      nOperazioni += v.righe.length
    }
    dettaglio.sort((a, b) => b.importoTotale - a.importoTotale)
    return {
      dettaglio,
      mediaPonderata: sommaImporti ? round2(sommaGiorniPonderata / sommaImporti) : null,
      importoTotale: round2(sommaImporti),
      nOperazioni,
    }
  }

  return {
    dso: riepiloga(clienti),
    dpo: riepiloga(fornitori),
    diagnostica: { scartatiSenzaDoc, scartatiAnomali, scartatiSottoSoglia },
    opzioni: { escludiSottoSoglia, sogliaGiorni },
  }
}
