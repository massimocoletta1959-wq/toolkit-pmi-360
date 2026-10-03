import { calcolaRigheAperture } from './partiteAperte'

// Il "conto" e' la chiave stabile usata da Tesoreria.js per escludere/riammettere una partita aperta dal
// calcolo del cash flow (tabella scadenze_escluse): deve comparire su ogni riga generata, invariato tra
// una proiezione e l'altra per lo stesso cliente/fornitore.
describe('calcolaRigheAperture: conto come chiave stabile', () => {
  const base = { dsoDettaglio: [], dpoDettaglio: [], dsoMedio: 30, dpoMedio: 30, anno: 2026, meseChiusura: 9 }

  test('ogni credito/debito aperto porta il conto sorgente', () => {
    const righe = calcolaRigheAperture({
      ...base,
      contiClienti: [{ conto: '14/00090/C', descrizione: 'Cliente Rossi', valore: 12400 }],
      contiFornitori: [{ conto: '40/00050/F', descrizione: 'Fornitore Verdi', valore: -8000 }],
    })
    const credito = righe.find((r) => r.direzione === 'entrata')
    const debito = righe.find((r) => r.direzione === 'uscita')
    expect(credito.conto).toBe('14/00090/C')
    expect(debito.conto).toBe('40/00050/F')
  })

  test('conti senza saldo aperto (o con acconto ricevuto) non generano righe', () => {
    const righe = calcolaRigheAperture({ ...base, contiClienti: [{ conto: '14/1/C', descrizione: 'A', valore: 0 }], contiFornitori: [{ conto: '40/1/F', descrizione: 'B', valore: 0 }] })
    expect(righe).toHaveLength(0)
  })
})
