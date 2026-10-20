import { calcolaBudgetConsuntivo, vociBudgetAnno } from './index'

jest.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }))

const mesi = (f) => Object.fromEntries(Array.from({ length: 12 }, (_, j) => [String(j + 1), f(j + 1)]).filter(([, v]) => v))
const conto = (c, descrizione, mensile) => ({ conto: c, descrizione, valore: 0, mensile })
const gruppi = (conti) => ({ gruppi: conti.map((c) => ({ gruppo: c.conto.slice(0, 7), conti: [c] })) })
const MAP = [['50/0101', 'ricavi', 'A1'], ['61/0606', 'costi', 'B7'], ['66/0707', 'costi', 'B9a'], ['66/0808', 'costi', 'B8'],
  ['66/1212', 'costi', 'B7'], ['66/3001', 'costi', 'B7'], ['69/5151', 'costi', 'B10b'], ['66/1111', 'costi', 'E20']]
  .map(([conto_origine, categoria, codice_cee]) => ({ conto_origine, categoria, codice_cee, globale: false }))

const d2025 = gruppi([
  conto('50/0101/000001', 'Ricavi', mesi(() => -10000)),
  conto('61/0606/000001', 'COSTI DI SPEDIZIONE', mesi(() => 1500)),
  conto('66/0707/000001', 'Retribuzioni lorde', mesi((m) => (m === 6 || m === 12 ? 2000 : 1000))),
  conto('66/0808/000008', 'Affitti', mesi(() => 500)),
  conto('66/1212/000003', 'Consulenze amministrative', mesi((m) => (m % 3 === 0 ? 300 : 0))),
  conto('66/3001/000001', 'COMPENSO AMMINISTRATORE', mesi(() => 1000)),
])
const d2026 = gruppi([
  conto('50/0101/000001', 'Ricavi', mesi((m) => (m <= 9 ? -12000 : 0))),
  conto('61/0606/000001', 'COSTI DI SPEDIZIONE', mesi((m) => (m <= 8 ? 1200 : 0))),
  conto('66/0707/000001', 'Retribuzioni lorde', mesi((m) => (m <= 8 ? (m === 6 ? 2200 : 1100) : 0))),   // stipendi fino ad agosto
  conto('66/0808/000008', 'Affitti', mesi((m) => (m <= 6 ? 500 : m === 7 ? 550 : m === 8 ? 520 : 0))),
  conto('66/1212/000003', 'Consulenze amministrative', mesi((m) => (m % 3 === 0 && m <= 8 ? 300 : 0))),
  conto('66/3001/000001', 'COMPENSO AMMINISTRATORE', mesi((m) => (m <= 8 ? (m === 8 ? 1400 : 1000) : 0))),
  conto('69/5151/000014', 'Amm.to di periodo', mesi((m) => (m <= 8 ? 100 : 0))),
])

test('budget dai valori effettivi: taglio sugli stipendi, regole di previsione, fino a dicembre dell\'anno dopo', () => {
  const r = calcolaBudgetConsuntivo({
    documenti: [{ anno: 2025, dati: d2025 }, { anno: 2026, dati: d2026 }], mappatureAzienda: MAP,
    impostazioni: { rettifiche: [{ mese: '2026-08', da: '66/3001/000001', a: '66/0707/000001', importo: 400 }] },
  })
  expect(r.ultimoMeseChiuso).toBe('2026-08')                         // settembre ha ricavi ma non stipendi
  expect(r.mesiPrevisione[0]).toBe('2026-09')
  expect(r.mesiPrevisione[r.mesiPrevisione.length - 1]).toBe('2027-12')
  // ricavi: media degli ultimi 12 mesi chiusi (set-dic 2025 a 10.000, gen-ago 2026 a 12.000)
  const ricavi = r.ricavi[0]
  expect(ricavi.base).toBeCloseTo((4 * 10000 + 8 * 12000) / 12, 2)
  // costi variabili: % dei ricavi 2026 (1.200 / 12.000 = 10%)
  expect(r.costiVariabili[0].percentuale).toBeCloseTo(0.1, 6)
  expect(r.costiVariabili[0].valori['2026-10']).toBeCloseTo(0.1 * ricavi.base, 2)
  const fisso = (c) => r.costiFissi.find((x) => x.conto === c)
  // retribuzioni: media di 6 mesi esclusi giugno e dicembre (feb-mag, lug, ago: agosto con la rettifica 1.500), giugno e dicembre doppi
  const stip = fisso('66/0707/000001')
  const base = Math.round(((1100 * 5 + 1500) / 6) * 100) / 100       // media arrotondata al centesimo
  expect(stip.valori['2026-10']).toBeCloseTo(base, 2)
  expect(stip.valori['2026-12']).toBeCloseTo(2 * base, 2)
  expect(stip.valori['2027-06']).toBeCloseTo(2 * base, 2)
  // compenso amministratore rettificato: 1.000 fisso
  expect(fisso('66/3001/000001').valori['2026-11']).toBe(1000)
  // affitto: ultimo valore (520) anche se diverso dai precedenti, segnalato
  expect(fisso('66/0808/000008')).toMatchObject({ base: 520, segnalato: true })
  // trimestrale: 300 a dicembre, marzo, giugno… (ultimo a giugno 2026, poi settembre)
  const trim = fisso('66/1212/000003')
  expect(trim.valori['2026-09']).toBe(300)
  expect(trim.valori['2026-10']).toBe(0)
  expect(trim.valori['2027-09']).toBe(300)                            // oltre i 12 mesi: come un anno prima
  // ammortamenti: quota mensile 2026
  expect(r.totali.ammortamenti['2027-03']).toBe(100)
  // totali coerenti
  const k = '2027-01'
  expect(r.totali.ebitda[k]).toBeCloseTo(r.totali.ricavi[k] - r.totali.variabili[k] - r.totali.fissi[k], 2)
  // righe per budget_voci dell'anno successivo
  const voci = vociBudgetAnno(r, 2027)
  expect(voci.find((v) => v.descrizione === 'Affitti')).toMatchObject({ categoria: 'costi', gen: 520, totale_annuo: 6240 })
})

test('senza dipendenti: ultimo mese chiuso = mese di fine del giornale, i mesi dopo sono previsti', () => {
  const senza = (d) => ({ gruppi: d.gruppi.filter((g) => !g.conti[0].conto.startsWith('66/0707')) })
  const d2026giu = gruppi([
    conto('50/0101/000001', 'Ricavi', mesi((m) => (m <= 6 ? -12000 : 0))),
    conto('66/0808/000008', 'Affitti', mesi((m) => (m <= 6 ? 500 : 0))),
  ])
  const r = calcolaBudgetConsuntivo({ documenti: [{ anno: 2025, dati: senza(d2025) }, { anno: 2026, meseFine: 6, dati: d2026giu }], mappatureAzienda: MAP })
  expect(r.ultimoMeseChiuso).toBe('2026-06')
  expect(r.mesiPrevisione[0]).toBe('2026-07')
  expect(r.costiFissi.find((x) => x.conto === '66/0808/000008').valori['2026-09']).toBe(500)
  expect(r.ricavi[0].valori['2026-10']).toBeGreaterThan(0)
  // senza mese di fine: l'ultimo mese con movimenti
  expect(calcolaBudgetConsuntivo({ documenti: [{ anno: 2025, dati: senza(d2025) }, { anno: 2026, dati: d2026giu }], mappatureAzienda: MAP }).ultimoMeseChiuso).toBe('2026-06')
})
