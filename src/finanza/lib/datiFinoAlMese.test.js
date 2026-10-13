import { datiFinoAlMese } from './mappatureConti'

jest.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }))

test('libro giornale a fine agosto: tolti dai saldi i movimenti di settembre e ottobre', () => {
  const dati = {
    gruppi: [{
      gruppo: '50/0101', importo: -507383.69, mensile: { 1: -441337.05, 9: -66046.64 },
      conti: [{ conto: '50/0101/000001', valore: -507383.69, mensile: { 1: -441337.05, 9: -66046.64 } }],
    }, {
      gruppo: '13/0303', importo: 1100, mensile: { 2: 100, 10: 500 },   // apertura 500 compresa nel saldo
      conti: [{ conto: '13/0303/000001', valore: 1100, mensile: { 2: 100, 10: 500 } }],
    }],
  }
  const r = datiFinoAlMese(dati, 8)
  expect(r.gruppi[0].conti[0].valore).toBeCloseTo(-441337.05, 2)
  expect(r.gruppi[0].importo).toBeCloseTo(-441337.05, 2)
  expect(r.gruppi[0].conti[0].mensile).toEqual({ 1: -441337.05 })
  expect(r.gruppi[1].conti[0].valore).toBeCloseTo(600, 2)
  expect(datiFinoAlMese(dati, 12)).toBe(dati)
})
