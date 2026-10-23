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

describe('rettifiche di fine esercizio (giornale annuale non chiuso)', () => {
  test('proposte a zero, ammortamenti gia registrati segnalati', () => {
    const p = proponiAssestamenti({ aggregato: { B10b: { importo: 12387.97, conti: [] } }, meseFine: 12, fineAnno: true })
    expect(p).toMatchObject({ attivi: false, rimanenze_finali: 0, ammortamenti: 0, aliquota_imposte: 0 })
    expect(p.fonti.ammortamenti).toMatch(/già registrati/)
  })
})

test('lavori in corso su ordinazione: A3 nel conto economico, C.I.3 nello stato patrimoniale', () => {
  const agg = { A3: { importo: -868875.9, conti: [{ codice: '70/350/0', conto: 'Rim.iniziali lav.corso', importo: -868875.9 }] } }
  const p = proponiAssestamenti({ aggregato: agg, meseFine: 8, competenza: { fattureDaRicevere: 1000, fattureDaEmettere: 0, dettaglio: [] } })
  expect(p.lavori_in_corso).toBe(868875.9)
  expect(p.fatture_da_ricevere).toBe(1000)
  const a = { ...p, attivi: true, lavori_in_corso: 1944161.55, rimanenze_finali: 0, ammortamenti: 0, tfr: 0, fatture_da_ricevere: 0, aliquota_imposte: 0 }
  const ce = applicaAssestamentiCE(agg, a, 'al 31/08', () => 0)
  expect(ce.aggregato.A3.importo).toBeCloseTo(1075285.65, 2)
  const sp = applicaAssestamentiSP({}, a, 0, 'al 31/08')
  expect(sp.aggregato.ATT_C_I_3.importo).toBe(1944161.55)
  expect(sp.deltaRisultato).toBe(1944161.55)
})
