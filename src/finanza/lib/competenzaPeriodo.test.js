import { registrazioniDiCompetenza, fattureDiCompetenza } from './competenzaPeriodo'

const mov = (data, dtDoc, conto, segno, importo, chiave = 'Fattura acquisto') => ({ data, mese: Number(data.slice(3, 5)), dtDoc, conto, segno, importo, chiave })
const movimenti = [
  mov('20/08/2026', '18/08/2026', '60/705/0', 1, 999),                    // registrata nel periodo: esclusa
  mov('14/09/2026', '31/08/2026', '60/705/0', 1, 1000), mov('14/09/2026', '31/08/2026', '41/00001/F', -1, 1000),
  mov('15/09/2026', '15/09/2026', '60/705/0', 1, 500),                    // documento di settembre: esclusa
  mov('10/09/2026', '30/08/2026', '70/140/0', -1, 2000, 'Fattura vendita'), mov('10/09/2026', '30/08/2026', '40/00001/C', 1, 2000, 'Fattura vendita'),
  mov('05/09/2026', '31/12/2025', '60/705/0', 1, 300),                    // documento dell'anno prima: esclusa
]

test('registrazioni di competenza del periodo e proposta di fatture da ricevere/emettere', () => {
  const comp = registrazioniDiCompetenza(movimenti, 2026, 8)
  expect(comp.righe.map((r) => r.conto)).toEqual(['60/705/0', '41/00001/F', '70/140/0', '40/00001/C'])
  const classifica = (c) => ({ '60/705/0': { categoria: 'costi', codice: 'B7' }, '70/140/0': { categoria: 'ricavi', codice: 'A1' }, '41/00001/F': { categoria: 'passivita', codice: 'PAS_D_7' } })[c] || null
  const f = fattureDiCompetenza(comp, 8, classifica)
  expect(f).toMatchObject({ fattureDaRicevere: 1000, fattureDaEmettere: 2000 })
  expect(f.dettaglio.map((d) => d.tipo)).toEqual(['emettere', 'ricevere'])
  expect(fattureDiCompetenza(comp, 6, classifica)).toBeNull()             // periodo diverso da quello annotato
  expect(registrazioniDiCompetenza(movimenti, 2026, 12)).toBeNull()
})
