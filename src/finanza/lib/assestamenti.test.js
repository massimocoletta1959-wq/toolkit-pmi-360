import { proponiAssestamenti, applicaAssestamentiCE, applicaAssestamentiSP } from './assestamenti'

const AGG = {
  A1: { importo: 1000, conti: [] },
  B6: { importo: 400, conti: [] },
  B11: { importo: 100, conti: [{ codice: '36/10/1', conto: 'Esistenze iniziali', importo: 100 }] },
}
// risultato ante imposte semplificato per il test: ricavi - costi
const ante = (agg) => (agg.A1?.importo || 0) - Object.entries(agg).filter(([k]) => /^B/.test(k)).reduce((s, [, v]) => s + v.importo, 0)

describe('assestamenti di periodo', () => {
  test('proposte: rimanenze finali = iniziali, ammortamenti e TFR in proporzione ai mesi, imposte 27,9%', () => {
    const p = proponiAssestamenti({ aggregato: AGG, meseFine: 6, annuali: { ammortamenti: 1200, tfr: 240, fonte: '2025' } })
    expect(p).toMatchObject({ rimanenze_finali: 100, ammortamenti: 600, tfr: 120, aliquota_imposte: 27.9 })
  })

  test('niente doppioni: ammortamenti, TFR e imposte gia registrati non si ripropongono', () => {
    const p = proponiAssestamenti({ aggregato: { ...AGG, B10b: { importo: 50, conti: [] }, B9c: { importo: 10, conti: [] }, E20: { importo: 5, conti: [] } }, meseFine: 6, annuali: { ammortamenti: 1200, tfr: 240 } })
    expect(p).toMatchObject({ ammortamenti: 0, tfr: 0, aliquota_imposte: 0 })
  })

  test('CE e SP restano coerenti: la variazione del risultato e la stessa', () => {
    const v = { attivi: true, rimanenze_finali: 100, ammortamenti: 60, tfr: 12, fatture_da_ricevere: 30, fatture_da_emettere: 20, aliquota_imposte: 27.9 }
    const ce = applicaAssestamentiCE(AGG, v, 'al 30/06', ante)
    const deltaCe = ante(ce.aggregato) - ce.imposte - ante(AGG)
    const sp = applicaAssestamentiSP({ ATT_B_II_1: { importo: 300, conti: [] }, ATT_B_II_4: { importo: 100, conti: [] } }, v, ce.imposte, 'al 30/06')
    expect(sp.deltaRisultato).toBeCloseTo(deltaCe, 2)
    // fondo ammortamento ripartito sulle immobilizzazioni in proporzione al valore
    expect(sp.aggregato.ATT_B_II_1.importo).toBeCloseTo(255, 2)
    expect(sp.aggregato.ATT_B_II_4.importo).toBeCloseTo(85, 2)
    expect(sp.aggregato.ATT_C_I_4.importo).toBeCloseTo(100, 2)
    expect(sp.aggregato.PAS_D_12.importo).toBeCloseTo(ce.imposte, 2)
  })

  test('non attivi: nessuna modifica', () => {
    const ce = applicaAssestamentiCE(AGG, { attivi: false, rimanenze_finali: 100 }, 'al 30/06', ante)
    expect(ce.aggregato.B11.importo).toBe(100)
    expect(ce.imposte).toBe(0)
  })
})
