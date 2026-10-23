import { eContoOrdine, valoreMappatura, CONTI_ORDINE } from './contiOrdine'

test('riconosce i conti d\'ordine, non i costi che ne parlano', () => {
  for (const d of ['Terzi per beni presso di noi', 'Beni di leasing', 'Terzi per garanzie prestate', 'Fideyussioni avalli ecc.ricev.', 'Terzi per fidejussioni ricevute', 'A favore di terzi'])
    expect(eContoOrdine(d)).toBe(true)
  for (const d of ['Assicurazioni fideyussorie', 'Godimento beni di terzi', 'Canoni leasing', 'Clienti'])
    expect(eContoOrdine(d)).toBe(false)
})

test('valore della tendina', () => {
  expect(valoreMappatura({ categoria: 'conti_ordine', codice_cee: 'ORD' })).toBe(CONTI_ORDINE.valore)
  expect(valoreMappatura({ categoria: 'passivita', codice_cee: 'PAS_D_4' })).toBe('sp:PAS_D_4')
  expect(valoreMappatura({ categoria: 'costi', codice_cee: 'B7' })).toBe('cee:B7')
  expect(valoreMappatura(null)).toBe('')
})
