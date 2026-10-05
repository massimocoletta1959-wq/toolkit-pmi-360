import { calcolaBudgetRettificato, annoEsercizio } from './budgetRettificato'

// budget minimo: ricavi 100.000/mese, servizi 20.000/mese, personale per sottovoci
const mese = (v) => Object.fromEntries(['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'].map((k) => [k, v]))
const BUDGET = [
  { descrizione: 'Ricavi delle vendite e delle prestazioni', categoria: 'ricavi', ...mese(100000) },
  { descrizione: 'Servizi', categoria: 'costi', ...mese(20000) },
  { descrizione: '  a) Salari e stipendi', categoria: 'costi', ...mese(30000) },
  { descrizione: '  b) Oneri sociali', categoria: 'costi', ...mese(9000) },
  { descrizione: '  c) Trattamento di fine rapporto', categoria: 'costi', ...mese(2000) },
]

describe('budget rettificato', () => {
  test('assunzione da luglio: costo mensilizzato per ratei, solo fino a dicembre', () => {
    const decisione = { tipo_impatto: 'personale', descrizione: 'impiegato', data_decorrenza: '2026-07-01', iva_regime: 'ordinaria', movimento: 'ingresso', numero_persone: 1, inquadramento: 'impiegato', ral_annua: 36000, mensilita: 14, contributi_pct: 30, benefit_annui: 0 }
    const r = calcolaBudgetRettificato({ decisione, vociBudget: BUDGET, anno: annoEsercizio(decisione) })
    const v = Object.fromEntries(r.voci.map((x) => [x.voce, x]))
    expect(v['a) Salari e stipendi'].delta_certi).toBeCloseTo(18000, 2)           // 6 mesi x 36.000/12, 14ª compresa nei ratei
    expect(v['b) Oneri sociali'].delta_certi).toBeCloseTo(5400, 2)
    expect(v['c) Trattamento di fine rapporto'].delta_certi).toBeCloseTo(36000 / 13.5 / 2, 2)
    expect(v['a) Salari e stipendi'].mensile_certi.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0])
    expect(r.totali.budget.ebitda).toBeCloseTo(12 * (100000 - 61000), 2)
    expect(r.totali.solo_costi_certi.ebitda).toBeCloseTo(r.totali.budget.ebitda - 18000 - 5400 - 36000 / 13.5 / 2, 2)
    expect(r.movimenti_oltre_chiusura_ignorati).toBeGreaterThan(0)
  })

  test('macchinario da settembre: ammortamento pro rata in una nuova voce; ricavi attesi separati', () => {
    const decisione = { tipo_impatto: 'acquisto_bene', descrizione: 'tornio', data_decorrenza: '2026-09-01', iva_regime: 'ordinaria', imponibile: 120000, pagamento: { modalita: 'unico' }, ammortamento: { durata_mesi: 60 }, costi_esercizio_mensili: 0,
      ipotesi_ricavi: { modalita: 'euro_mese', valore: 5000, mese_partenza: '2026-10-01' } }
    const r = calcolaBudgetRettificato({ decisione, vociBudget: BUDGET, anno: 2026 })
    const amm = r.voci.find((x) => /ammortamento/i.test(x.voce))
    expect(amm.nuova).toBe(true)
    expect(amm.delta_certi).toBeCloseTo(4 * 2000, 2)                                 // set-dic, 120.000/60
    const ric = r.voci.find((x) => x.voce === 'Ricavi delle vendite e delle prestazioni')
    expect(ric.delta_certi).toBe(0)
    expect(ric.delta_ricavi).toBeCloseTo(3 * 5000, 2)                                // ott-dic
    expect(r.totali.solo_costi_certi.ebitda).toBeCloseTo(r.totali.budget.ebitda, 2)   // l'ammortamento sta sotto l'EBITDA
    expect(r.totali.solo_costi_certi.ebit).toBeCloseTo(r.totali.budget.ebit - 8000, 2)
    expect(r.totali.con_ricavi_attesi.risultato_ante_imposte).toBeCloseTo(r.totali.budget.risultato_ante_imposte - 8000 + 15000, 2)
  })

  test('costo una tantum: la tipologia di spesa sceglie la voce', () => {
    const decisione = { tipo_impatto: 'costo_una_tantum', descrizione: 'licenza', data_decorrenza: '2026-03-15', iva_regime: 'ordinaria', categoria: 'altro', importo: 5000, voce_ce: 'B8' }
    const r = calcolaBudgetRettificato({ decisione, vociBudget: BUDGET, anno: 2026 })
    expect(r.voci.map((v) => v.voce)).toEqual(['Godimento di beni di terzi'])
  })
})
