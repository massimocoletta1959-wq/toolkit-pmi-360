import { calcolaRigheAperture, applicaDifferimenti } from './partiteAperte'

const base = () =>
  calcolaRigheAperture({
    contiClienti: [{ conto: '14/C/1', descrizione: 'Cliente Alfa', valore: 1000 }],
    contiFornitori: [{ conto: '40/F/7', descrizione: 'Fornitore Beta', valore: -500 }],
    dsoDettaglio: [],
    dpoDettaglio: [],
    dsoMedio: 30,
    dpoMedio: 30,
    anno: 2026,
    meseChiusura: 6,
  })

test('senza differimenti le righe restano invariate', () => {
  const righe = base()
  expect(applicaDifferimenti(righe, new Map())).toBe(righe)
})

test('il differimento sposta scadenza e mese di cassa solo della partita indicata', () => {
  const righe = base()
  const [cliente, fornitore] = applicaDifferimenti(righe, new Map([['14/C/1', 60]]))
  // 28/06 + 30gg = 28/07; + 60gg = 26/09
  expect(cliente.dataScadenza.toISOString().slice(0, 10)).toBe('2026-09-26')
  expect(cliente.meseBudget).toBe(202609)
  expect(cliente.giorniDilazione).toBe(90)
  expect(cliente.differimentoGiorni).toBe(60)
  expect(cliente.importo).toBe(1000)
  expect(fornitore).toBe(righe[1])
})

test('un differimento lungo puo portare la partita nell anno successivo', () => {
  const [, fornitore] = applicaDifferimenti(base(), new Map([['40/F/7', 200]]))
  expect(fornitore.meseBudget).toBe(202702)
})
