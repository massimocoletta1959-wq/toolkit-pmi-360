jest.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }))
jest.mock('../../App', () => ({ useApp: () => ({}) }))
jest.mock('./supabase', () => ({ supabase: {} }))
import { haApertura, aggiungiSaldiIniziali } from './statoPatrimoniale'

const giornale = (valore, mensile) => ({ gruppi: [{ gruppo: '15/5', conti: [{ conto: '15/5/1', valore, mensile }] }] })

test('apertura riconosciuta dal confronto tra saldo e movimenti mensili', () => {
  expect(haApertura(giornale(1500, { 1: 200, 2: 300 }))).toBe(true)     // 1.000 di apertura
  expect(haApertura(giornale(500, { 1: 200, 2: 300 }))).toBe(false)
})

test('saldi iniziali dall\'esercizio precedente e risultato portato a nuovo', () => {
  const corrente = { ATT_C_IV_1: { importo: 100, conti: [{ gruppo: '15/5/1', conto: 'Banca', importo: 100 }] } }
  const prec = { aggregatoSP: { ATT_C_IV_1: { importo: 900, conti: [{ gruppo: '15/5/1', conto: 'Banca', importo: 900 }] }, PAS_D_7: { importo: 400, conti: [] } }, risultatoEsercizio: -250 }
  const r = aggiungiSaldiIniziali(corrente, prec, 2025)
  expect(r.ATT_C_IV_1.importo).toBe(1000)
  expect(r.PAS_D_7.importo).toBe(400)
  expect(r.PAS_A_VIII.importo).toBe(-250)
  expect(r.ATT_C_IV_1.conti[1].conto).toBe('Banca (saldo al 31/12/2025)')
})
