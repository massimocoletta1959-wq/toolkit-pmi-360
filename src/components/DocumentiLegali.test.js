import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AccettazioneDocumenti } from './DocumentiLegali'
import { supabase } from '../lib/supabase'

jest.mock('../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }))

global.IS_REACT_ACT_ENVIRONMENT = true

const documenti = [
  { id: 'd1', titolo: 'Informativa privacy', versione: '1.0', testo: '# Informativa\n\n- dati di accesso', formula: 'Ho preso visione' },
  { id: 'd2', titolo: 'Condizioni di servizio', versione: '1.0', testo: 'Testo **importante**', formula: 'Ho letto e accetto' },
]

let box, root
beforeEach(() => {
  box = document.createElement('div')
  document.body.appendChild(box)
  root = createRoot(box)
  supabase.rpc.mockReset()
})
afterEach(() => {
  act(() => root.unmount())
  box.remove()
})

const bottone = (t) => [...box.querySelectorAll('button')].find((b) => b.textContent === t)

test('si entra solo dopo aver spuntato tutti i documenti; l accettazione passa dal database', async () => {
  supabase.rpc.mockResolvedValue({ data: 2, error: null })
  const onAccettati = jest.fn()
  act(() => root.render(<AccettazioneDocumenti documenti={documenti} onAccettati={onAccettati} onEsci={() => {}} />))
  expect(box.textContent).toContain('Ho preso visione «Informativa privacy» (versione 1.0)')
  expect(box.querySelector('li').textContent).toBe('dati di accesso') // primo documento aperto e formattato
  const [c1, c2] = box.querySelectorAll('input[type=checkbox]')
  expect(bottone('Conferma e accedi').disabled).toBe(true)
  act(() => c1.click())
  expect(bottone('Conferma e accedi').disabled).toBe(true)
  act(() => c2.click())
  expect(bottone('Conferma e accedi').disabled).toBe(false)
  await act(async () => bottone('Conferma e accedi').click())
  expect(supabase.rpc).toHaveBeenCalledWith('accetta_documenti', { p_ids: ['d1', 'd2'] })
  expect(onAccettati).toHaveBeenCalled()
})

test('se la registrazione non riesce resta sulla pagina con un messaggio', async () => {
  supabase.rpc.mockResolvedValue({ data: null, error: { message: 'rete assente' } })
  const onAccettati = jest.fn()
  act(() => root.render(<AccettazioneDocumenti documenti={[documenti[0]]} onAccettati={onAccettati} onEsci={() => {}} />))
  act(() => box.querySelector('input[type=checkbox]').click())
  await act(async () => bottone('Conferma e accedi').click())
  expect(onAccettati).not.toHaveBeenCalled()
  expect(box.textContent).toContain('Registrazione non riuscita: rete assente')
})
