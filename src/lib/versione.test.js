import { descriviVersione } from './versione'

test('codice breve e data in ora italiana', () => {
  expect(descriviVersione('a0d5acf0d33f-20261009T110854')).toEqual({ codice: 'a0d5acf', pubblicata: '09/10/2026, 13:08' })
})

test('senza versione (sviluppo locale) restituisce null', () => {
  expect(descriviVersione('')).toBeNull()
})
