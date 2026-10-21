import { dataScadenza, scadenzeMovimento, residuoMovimento, righeMovimentiPrevisti, sostituisciImposteCalcolate } from './movimentiPrevisti'

const rata = { id: 'r1', descrizione: 'Rateizzazione AdER', direzione: 'uscita', voce: 'imposte_altre', importo: 1000, prima_data: '2026-01-31', frequenza: 'mensile', numero_rate: 12, certezza: 'certo' }

test('scadenze mensili a fine mese', () => {
  expect(dataScadenza('2026-01-31', 'mensile', 1)).toBe('2026-02-28')
  expect(dataScadenza('2026-01-31', 'mensile', 2)).toBe('2026-03-31')
  expect(dataScadenza('2026-11-16', 'trimestrale', 1)).toBe('2027-02-16')
})

test('scadenze nel periodo e residuo', () => {
  const s = scadenzeMovimento(rata, '2026-07-01', '2026-12-31')
  expect(s.map((x) => x.data)).toEqual(['2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31'])
  expect(s[0].rata).toBe(7)
  expect(residuoMovimento(rata, '2026-07-01')).toBe(6000)
  expect(residuoMovimento({ ...rata, numero_rate: null }, '2026-07-01')).toBeNull()
  expect(scadenzeMovimento({ ...rata, frequenza: 'una_volta' }, '2026-07-01', null)).toEqual([])
})

test('righe della proiezione nell\'orizzonte', () => {
  const r = righeMovimentiPrevisti([rata], [2026, 11], 3)
  expect(r.map((x) => x.meseBudget)).toEqual([202611, 202612])   // la 12a e ultima rata e' a dicembre
  expect(r[0]).toMatchObject({ direzione: 'uscita', categoria: 'previsto_imposte', importo: 1000, probabilita: 100 })
  expect(r[0].note).toMatch(/rata 11\/12/)
})

test('opzione A: il versamento a mano sostituisce le imposte calcolate solo nel suo mese', () => {
  const calcolate = [
    { categoria: 'imposte', meseBudget: 202705, importo: 26000 },
    { categoria: 'imposte', meseBudget: 202611, importo: 27000 },
    { categoria: 'iva', meseBudget: 202611, importo: 5000 },
  ]
  const previste = righeMovimentiPrevisti([{ id: 'a', descrizione: '2° acconto IRES', direzione: 'uscita', voce: 'imposte_reddito', importo: 15000, prima_data: '2026-11-30', frequenza: 'una_volta', certezza: 'certo' }], [2026, 7], 12)
  const { righe, sostituite } = sostituisciImposteCalcolate(calcolate, previste)
  expect(sostituite.map((x) => x.meseBudget)).toEqual([202611])
  expect(righe.map((x) => `${x.categoria}${x.meseBudget}`)).toEqual(['imposte202705', 'iva202611'])
})
