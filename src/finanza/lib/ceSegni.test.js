import { processaDocumento, buildCe } from '../pages/CE'
jest.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }))
jest.mock('../../App', () => ({ useApp: () => ({}) }))
jest.mock('./supabase', () => ({ supabase: {} }))

// Il risultato del Conto economico deve coincidere con ricavi - costi del libro giornale qualunque sia la
// categoria con cui la Riclassificazione ha salvato i conti finanziari (proventi in "costi" o "ricavi").
const VOCI = [
  { codice: 'A', sezione: 'A', tipo: 'ricavo', totale: true }, { codice: 'A1', sezione: 'A', tipo: 'ricavo', segno: 1, descrizione: 'Ricavi' },
  { codice: 'B', sezione: 'B', tipo: 'costo', totale: true }, { codice: 'B7', sezione: 'B', tipo: 'costo', segno: -1, descrizione: 'Servizi' },
  { codice: 'C', sezione: 'C', tipo: 'finanziario', totale: true }, { codice: 'C16', sezione: 'C', tipo: 'finanziario', segno: 1, descrizione: 'Proventi' },
  { codice: 'C17', sezione: 'C', tipo: 'finanziario', segno: -1, descrizione: 'Oneri' },
  { codice: 'D', sezione: 'D', tipo: 'finanziario', totale: true }, { codice: 'RIS', totale: true },
]
const ctx = (mappature) => ({ mappatureAzienda: mappature, mappatureGlobali: [], vociCeeList: VOCI, vociCeeByCodice: Object.fromEntries(VOCI.map((v) => [v.codice, v])), vociCeeByDescrizione: Object.fromEntries(VOCI.filter((v) => v.descrizione).map((v) => [v.descrizione, v])) })
const dati = { gruppi: [
  { gruppo: '44/5', conti: [{ conto: '44/5/1', valore: -1000 }] },   // ricavi (Avere)
  { gruppo: '29/5', conti: [{ conto: '29/5/1', valore: 300 }] },     // servizi
  { gruppo: '49/5', conti: [{ conto: '49/5/1', valore: -7.5 }] },    // interessi attivi (Avere)
  { gruppo: '39/5', conti: [{ conto: '39/5/1', valore: 50 }] },      // interessi passivi
] }
const map = (catProventi, catOneri) => [
  { conto_origine: '44/5', categoria: 'ricavi', codice_cee: 'A1', voce_budget_descrizione: 'Ricavi' }, { conto_origine: '29/5', categoria: 'costi', codice_cee: 'B7', voce_budget_descrizione: 'Servizi' },
  { conto_origine: '49/5', categoria: catProventi, codice_cee: 'C16', voce_budget_descrizione: 'Proventi' }, { conto_origine: '39/5', categoria: catOneri, codice_cee: 'C17', voce_budget_descrizione: 'Oneri' },
]

test.each([['costi', 'costi'], ['ricavi', 'ricavi'], ['costi', 'ricavi'], ['ricavi', 'costi']])('proventi in %s, oneri in %s: risultato = ricavi - costi', (cp, co) => {
  const voci = buildCe(processaDocumento(dati, 12, 'cumulativo', ctx(map(cp, co))), VOCI)
  expect(voci.find((v) => v.codice === 'C16').importo).toBeCloseTo(7.5, 2)
  expect(voci.find((v) => v.codice === 'C17').importo).toBeCloseTo(-50, 2)
  expect(voci.find((v) => v.codice === 'RIS').importo).toBeCloseTo(1000 - 300 + 7.5 - 50, 2)
})
