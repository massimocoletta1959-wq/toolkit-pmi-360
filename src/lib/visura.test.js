import { settoreDaAteco, addettiDaVisura } from './visura'

test('settore dal codice ATECO', () => {
  expect(settoreDaAteco('46.82.2')).toBe('Commercio')          // Teknosteel: ingrosso di metalli
  expect(settoreDaAteco('47.11.40')).toBe('Commercio')
  expect(settoreDaAteco('25.62.00')).toBe('Manifatturiero')
  expect(settoreDaAteco('43.21.01')).toBe('Edilizia')
  expect(settoreDaAteco('55.10.00')).toBe('Hotel')
  expect(settoreDaAteco('62.01.00')).toBe('Tecnologia')
  expect(settoreDaAteco('49.41.00')).toBe('Trasporti')
  expect(settoreDaAteco('69.20.11')).toBe('Servizi')
  expect(settoreDaAteco('')).toBe('Servizi')
})

test('addetti dalla visura: numeri o testo, ricavati dal totale se mancano i dipendenti', () => {
  expect(addettiDaVisura({ addetti_dipendenti: 1, addetti_indipendenti: 1, addetti_totale: 2 }).dipendenti).toBe(1)
  expect(addettiDaVisura({ addetti_dipendenti: '1', addetti_indipendenti: '1' }).dipendenti).toBe(1)
  expect(addettiDaVisura({ addetti_totale: 2, addetti_indipendenti: 1 }).dipendenti).toBe(1)
  expect(addettiDaVisura({ addetti_totale: '12' })).toMatchObject({ dipendenti: 12, totale: 12 })
  expect(addettiDaVisura({})).toBeNull()
})
