// Fatture di competenza di un periodo infrannuale registrate dopo la sua fine (es. situazione al 31/08: fatture di
// agosto registrate a settembre). Il gestionale le inserisce nella situazione contabile come "fatture da ricevere/da
// emettere di periodo"; il libro giornale le ha solo nei mesi dopo. Qui:
//  - all'elaborazione del giornale (Documenti) si annotano le righe delle registrazioni successive alla fine del
//    periodo con data del documento nel periodo (registrazioniDiCompetenza);
//  - nel Bilancio riclassificato le righe su conti di costo e di ricavo diventano la proposta di fatture da
//    ricevere / da emettere (fattureDiCompetenza), con l'elenco per verificarle.
// Libreria pura.

const r2 = (n) => Math.round(n * 100) / 100
const iso = (d) => (d && /^\d{2}\/\d{2}\/\d{4}$/.test(d) ? `${d.slice(6)}-${d.slice(3, 5)}-${d.slice(0, 2)}` : null)

// movimenti: quelli dei lettori (data, mese, conto, descrizione, segno, importo, chiave, dtDoc, eApertura, eChiusura)
export function registrazioniDiCompetenza(movimenti, anno, meseFine) {
  if (!(meseFine >= 1 && meseFine < 12)) return null
  const inizio = `${anno}-01-01`
  const fine = `${anno}-${String(meseFine).padStart(2, '0')}-31`
  const righe = []
  for (const m of movimenti || []) {
    if (m.eApertura || m.eChiusura || !(m.mese > meseFine)) continue
    const doc = iso(m.dtDoc)
    if (!doc || doc < inizio || doc > fine) continue
    righe.push({ conto: m.conto, descrizione: m.descrizione || '', valore: r2(m.segno * m.importo), data: m.data, dtDoc: m.dtDoc, chiave: (m.chiave || '').slice(0, 90) })
  }
  return { meseFine, righe }
}

// Voci CEE che una fattura di acquisto/vendita puo' toccare (non personale, ammortamenti, rimanenze, imposte)
const COSTI_FATTURA = /^B(6|7|8|14)$/
const RICAVI_FATTURA = /^A(1|5)$/

// competenza: { meseFine, righe } salvato sul documento; classifica(conto) -> { categoria, codice } | null
export function fattureDiCompetenza(competenza, meseFine, classifica) {
  if (!competenza?.righe?.length || competenza.meseFine !== meseFine) return null
  let daRicevere = 0
  let daEmettere = 0
  const perDocumento = new Map()
  for (const r of competenza.righe) {
    const c = classifica(r.conto)
    if (!c) continue
    let tipo = null
    if (c.categoria === 'costi' && COSTI_FATTURA.test(c.codice || '')) { daRicevere += r.valore; tipo = 'ricevere' }
    else if (c.categoria === 'ricavi' && RICAVI_FATTURA.test(c.codice || '')) { daEmettere -= r.valore; tipo = 'emettere' }
    if (!tipo) continue
    const k = `${tipo}|${r.data}|${r.dtDoc}|${r.chiave}`
    const d = perDocumento.get(k) || { tipo, data: r.data, dtDoc: r.dtDoc, descrizione: r.chiave, importo: 0 }
    d.importo = r2(d.importo + (tipo === 'ricevere' ? r.valore : -r.valore))
    perDocumento.set(k, d)
  }
  const dettaglio = [...perDocumento.values()].filter((d) => d.importo !== 0).sort((a, b) => Math.abs(b.importo) - Math.abs(a.importo))
  return { fattureDaRicevere: r2(daRicevere), fattureDaEmettere: r2(daEmettere), dettaglio }
}
