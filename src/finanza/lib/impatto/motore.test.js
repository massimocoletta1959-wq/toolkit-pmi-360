import { calcolaSimulazione, ErroreMotore, QUOTA_RICAVI_SCENARIO_BASE } from './motore'
import { calcolaRataLeasing as calcolaRata } from './generatori'
import { caricaRigheDaBudget, calcolaPianoCashflow } from '../tesoreria'
import { aggregaBudgetMensile, calcolaLiquidazioniIva, costruisciCeBaseline, MESI_KEYS } from '../budgetMensile'

// Baseline realistico costruito come in Tesoreria.js: piano di cassa + snapshot CE + IVA per liquidazione
const mk = (categoria, descrizione, v, soggetto_iva = true) => ({ categoria, descrizione, soggetto_iva, totale_annuo: v * 12, ...Object.fromEntries(MESI_KEYS.map((m) => [m, v])) })
const VOCI = [mk('ricavi', 'Ricavi', 100000), mk('costi', 'Servizi', 40000), mk('costi', 'Salari e stipendi', 20000, false), mk('costi', '60830 - Energia elettrica', 3000)]
const AZ = { aliquota_iva_vendite: 22, aliquota_iva_acquisti: 22, liquidazione_iva: 'mensile', gg_medi_incasso: 0, gg_medi_pagamento: 0 }

function scenarioBaseline({ dso = 0, dpo = 0, liquidazione = 'mensile', creato = '2026-09-20 10:00:00' } = {}) {
  const az = { ...AZ, liquidazione_iva: liquidazione }
  const righe = caricaRigheDaBudget(az, VOCI, dso, dpo, 2026, 9)
  const piano = calcolaPianoCashflow({ righe, saldoIniziale: 50000, fatturatoMedio: 100000, bufferPct: 15, orizzonteMesi: 12, dso, dpo, meseInizio: [2026, 9], lineeCredito: { dichiarate: true, linee: [] } })
  const mesiB = aggregaBudgetMensile(VOCI, az, 2026, 9, 12)
  piano.ce_baseline = costruisciCeBaseline(mesiB, VOCI, {})
  piano.iva_baseline = { liquidazione, aliquota_vendite: 22, aliquota_acquisti: 22, periodi: calcolaLiquidazioniIva(mesiB, liquidazione) }
  piano.mesi_reali = [{ entrate: 90000 }, { entrate: 100000 }, { entrate: 110000 }]
  piano.linee_credito = { dichiarate: true, n_linee: 0, accordato: 0, linee: [] }
  piano.modello_cassa = 9
  return { id: 'scen-1', creato_il: creato, piano_json: piano, fatturato_mensile_medio: 100000 }
}

const richiesta = (over = {}, leasingOver = {}) => ({
  partita_iva: '01234567890', determina_ref: 'b1',
  decisione: {
    tipo_impatto: 'leasing', descrizione: 'Macchinario', data_decorrenza: '2026-10-01', imponibile: 120000,
    leasing: { metodo_contabile: 'patrimoniale', maxicanone: 12000, numero_rate: 36, periodicita: 'mensile', riscatto: 1200, canone: 3000, ...leasingOver },
    costi_esercizio_mensili: 500, ...over,
  },
})
const ORA = new Date('2026-09-25T12:00:00Z')
const calcola = (req, sc = scenarioBaseline()) => calcolaSimulazione({ richiesta: req, azienda: AZ, scenarioRow: sc, ora: ORA })

describe('piano rate', () => {
  test('rata derivata dal tasso: a fine piano il debito residuo coincide con il riscatto', () => {
    const { rata } = calcolaRata({ imponibile: 120000, maxicanone: 12000, numeroRate: 36, riscatto: 1200, tassoAnnuoPct: 6.5 })
    let res = 108000
    for (let k = 0; k < 36; k++) res = res - (rata - (res * 0.065) / 12)
    expect(res).toBeCloseTo(1200, 4)
  })
  test('senza tasso né canone: nessun interesse e avviso RATA_DERIVATA', () => {
    const r = calcola(richiesta({}, { canone: undefined }))
    expect(r.avvisi.some((a) => a.codice === 'RATA_DERIVATA')).toBe(true)
    expect(r.ipotesi_usate.rata_periodica_iva_esclusa).toBeCloseTo((108000 - 1200) / 36, 2)
  })
})

describe('cassa: IVA neutra sul totale (regola §4.L)', () => {
  test('worst, senza sfasamenti: delta cassa totale = -(netto pagato) - IVA dell\'ultimo mese non ancora recuperata', () => {
    const r = calcola(richiesta())
    // competenza ott-26 ... ago-27 (11 mesi): maxicanone 12.000 + 11 rate + 11 mesi di esercizio
    const netto = 12000 + 11 * 3000 + 11 * 500
    const ultimoMese = 3000 + 500 // ago-27: IVA pagata a settembre, fuori finestra
    const tot = r.scenari.worst.mesi.reduce((s, m) => s + m.delta_cassa, 0)
    // la serie e' cumulata: il delta totale e' quello dell'ultimo mese
    expect(r.scenari.worst.mesi[11].delta_cassa).toBeCloseTo(-(netto + ultimoMese * 0.22), 0)
    expect(tot).toBeLessThan(0)
  })
})

describe('Conto Economico nei due metodi (§4.E, §5)', () => {
  test('patrimoniale: impatto su EBITDA, nessun ammortamento né interessi', () => {
    const r = calcola(richiesta())
    const ce = r.scenari.worst.conto_economico
    // 11 mesi in finestra: canone + maxicanone/36 + esercizio
    expect(ce.ebitda.delta).toBeCloseTo(-11 * (3000 + 12000 / 36 + 500), 1)
    expect(ce.ebit.delta).toBe(ce.ebitda.delta)
    expect(ce.oneri_finanziari.delta).toBe(0)
    expect(ce.utile.delta).toBe(ce.ebitda.delta)
    expect(r.ipotesi_usate.utile_espresso).toBe('ante_imposte')
  })
  test('finanziario: EBITDA solo costi di esercizio; ammortamento su EBIT; interessi sotto l\'EBIT', () => {
    const req = richiesta({ ammortamento: { durata_mesi: 84 } }, { metodo_contabile: 'finanziario', tasso_annuo_pct: 6.5, canone: 3300 })
    const r = calcola(req)
    const ce = r.scenari.worst.conto_economico
    expect(ce.ebitda.delta).toBeCloseTo(-11 * 500, 1)
    expect(ce.ebit.delta).toBeCloseTo(ce.ebitda.delta - (11 * 120000) / 84, 1)
    expect(ce.oneri_finanziari.delta).toBeGreaterThan(0)
    expect(ce.utile.delta).toBeCloseTo(ce.ebit.delta - ce.oneri_finanziari.delta, 1)
  })
  test('la cassa in uscita è la stessa nei due metodi', () => {
    const pat = calcola(richiesta())
    const fin = calcola(richiesta({ ammortamento: { durata_mesi: 84 } }, { metodo_contabile: 'finanziario', tasso_annuo_pct: 6.5 }))
    expect(fin.scenari.worst.mesi.map((m) => m.cassa_scenario)).toEqual(pat.scenari.worst.mesi.map((m) => m.cassa_scenario))
  })
})

describe('scenari e ricavi ipotizzati', () => {
  const req = richiesta({ ipotesi_ricavi: { modalita: 'incremento_pct', valore: 10, mese_partenza: '2026-11-01' } })
  test('worst <= base <= best su cassa e utile, base = 50% dei ricavi', () => {
    const r = calcola(req)
    const { worst, base, best } = r.scenari
    for (let j = 0; j < 12; j++) {
      expect(base.mesi[j].cassa_scenario).toBeGreaterThanOrEqual(worst.mesi[j].cassa_scenario)
      expect(best.mesi[j].cassa_scenario).toBeGreaterThanOrEqual(base.mesi[j].cassa_scenario)
    }
    const ricaviBest = best.conto_economico.utile.delta - worst.conto_economico.utile.delta
    expect(base.conto_economico.utile.delta - worst.conto_economico.utile.delta).toBeCloseTo(ricaviBest * QUOTA_RICAVI_SCENARIO_BASE, 1)
    expect(ricaviBest).toBeCloseTo(10 * 0.1 * 100000, 0) // 10 mesi (nov-26 ... ago-27) x 10% x 100.000
  })
  test('giudizio del range storico dai mesi reali', () => {
    expect(calcola(req).range_storico_ricavi.giudizio_ipotesi_utente).toBe('oltre_massimo_storico')
    expect(calcola(richiesta()).range_storico_ricavi.giudizio_ipotesi_utente).toBe('nessuna_ipotesi')
  })
})

describe('stress test con la decisione (§2.5g)', () => {
  test('mai meno severi del baseline, stesso numero di scenari', () => {
    const r = calcola(richiesta())
    const { baseline, con_decisione } = r.stress_test
    expect(con_decisione).toHaveLength(baseline.length)
    baseline.forEach((b, i) => {
      if (b.applicabile === false) return
      expect(con_decisione[i].saldo_minimo).toBeLessThanOrEqual(b.saldo_minimo + 0.01)
    })
  })
  test('lo stress del baseline ricalcolato coincide con quello del piano salvato', () => {
    const sc = scenarioBaseline()
    const r = calcola(richiesta(), sc)
    sc.piano_json.stress_tests.forEach((s, i) => expect(r.stress_test.baseline[i].saldo_minimo).toBeCloseTo(s.saldo_minimo ?? 0, 1))
  })
})

describe('validità del baseline (§4.G)', () => {
  test('decorrenza fuori dalla finestra: errore', () => {
    expect(() => calcola(richiesta({ data_decorrenza: '2028-01-01' }))).toThrow(ErroreMotore)
    try { calcola(richiesta({ data_decorrenza: '2026-03-01' })) } catch (e) { expect(e.codice).toBe('FUORI_FINESTRA') }
  })
  test('baseline più vecchio di 35 giorni: avviso, non blocco', () => {
    const r = calcola(richiesta(), scenarioBaseline({ creato: '2026-07-01 10:00:00' }))
    expect(r.avvisi.some((a) => a.codice === 'BASELINE_NON_AGGIORNATO')).toBe(true)
    expect(calcola(richiesta()).avvisi.some((a) => a.codice === 'BASELINE_NON_AGGIORNATO')).toBe(false)
  })
  test('iva_pct (v7, deprecato dalla v8): accettato e ignorato, nessun avviso', () => {
    const r = calcola(richiesta({ iva_pct: 20 }))
    expect(r.avvisi.some((a) => a.codice === 'IVA_DISALLINEATA')).toBe(false)
    // il numero non cambia rispetto alla stessa richiesta senza iva_pct
    expect(r.scenari.worst.mesi[11].delta_cassa).toBe(calcola(richiesta()).scenari.worst.mesi[11].delta_cassa)
  })
  test('iva_regime "esente" (v8): nessuna IVA sui movimenti della decisione', () => {
    const r = calcola(richiesta({ iva_regime: 'esente' }))
    // stesso netto pagato (12.000 + 11*3.000 + 11*500), ma senza il 22% di IVA
    const netto = 12000 + 11 * 3000 + 11 * 500
    expect(r.scenari.worst.mesi[11].delta_cassa).toBeCloseTo(-netto, 0)
  })
})
