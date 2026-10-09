import React, { useState, act } from 'react'
import { createRoot } from 'react-dom/client'
import { ScadenzeModificate, dataOriginale } from './DifferimentoPartite'

global.IS_REACT_ACT_ENVIRONMENT = true

const lista = [
  { conto: '14/C/1', descrizione: 'Cliente Alfa', direzione: 'entrata', importo: 1000, data: '2026-09-26', data_originale: '2026-07-28', differimento: 60 },
  { conto: '40/F/7', descrizione: 'Fornitore Beta', direzione: 'uscita', importo: 500, data: '2026-07-28', escluso: true },
]
const modificate = [
  { id: 'a', conto: '14/C/1', descrizione: 'Cliente Alfa', direzione: 'entrata', differimento_giorni: 60, motivo: 'accordo' },
  { id: 'b', conto: '40/F/7', descrizione: 'Fornitore Beta', direzione: 'uscita', differimento_giorni: null, motivo: null },
]

function Prova({ onApplica, onRipristina, onEscludi }) {
  const [modifica, setModifica] = useState(null)
  return <ScadenzeModificate modificate={modificate} lista={lista} modifica={modifica} setModifica={setModifica} onApplica={onApplica} onRipristina={onRipristina} onEscludi={onEscludi} salvando={false} />
}

function scrivi(input, valore) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, valore)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

let box, root
beforeEach(() => {
  box = document.createElement('div')
  document.body.appendChild(box)
  root = createRoot(box)
})
afterEach(() => {
  act(() => root.unmount())
  box.remove()
})

const bottone = (testo) => [...box.querySelectorAll('button')].find((b) => b.textContent === testo)

test('il riepilogo mostra le partite differite ed escluse con le date', () => {
  act(() => root.render(<Prova />))
  expect(box.textContent).toContain('Scadenze modificate (2)')
  expect(box.textContent).toContain('Differita di 60 gg')
  expect(box.textContent).toContain('28/07/2026')
  expect(box.textContent).toContain('26/09/2026')
  expect(box.textContent).toContain('Esclusa')
})

test('Modifica giorni apre il campo, mostra la nuova scadenza e applica i giorni scritti', () => {
  const onApplica = jest.fn()
  act(() => root.render(<Prova onApplica={onApplica} />))
  act(() => bottone('Modifica giorni').click())
  const input = box.querySelector('input[type=number]')
  expect(input.value).toBe('60')
  act(() => scrivi(input, '15'))
  expect(box.textContent).toContain('Nuova scadenza: 12/08/2026')
  act(() => bottone('Applica').click())
  expect(onApplica).toHaveBeenCalledWith(lista[0])
})

test('giorni non validi: Applica disattivato', () => {
  act(() => root.render(<Prova />))
  act(() => bottone('Modifica giorni').click())
  act(() => scrivi(box.querySelector('input[type=number]'), '0'))
  expect(bottone('Applica').disabled).toBe(true)
  expect(box.textContent).toContain('tra 1 e 730')
})

test('Ripristina ed Escludi passano la partita modificata', () => {
  const onRipristina = jest.fn()
  const onEscludi = jest.fn()
  act(() => root.render(<Prova onRipristina={onRipristina} onEscludi={onEscludi} />))
  act(() => bottone('Escludi').click())
  expect(onEscludi).toHaveBeenCalledWith(modificate[0])
  act(() => [...box.querySelectorAll('button')].filter((b) => b.textContent === 'Ripristina')[1].click())
  expect(onRipristina).toHaveBeenCalledWith(modificate[1])
})

test('dataOriginale ricostruisce la data anche per proiezioni salvate prima', () => {
  expect(dataOriginale({ data: '2026-09-26', differimento: 60 })).toBe('2026-07-28')
  expect(dataOriginale({ data: '2026-09-26' })).toBe('2026-09-26')
})
