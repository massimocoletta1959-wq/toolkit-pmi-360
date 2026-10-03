import { calcolaSimulazione, ErroreMotore } from './motore'
import { caricaRigheDaBudget, calcolaPianoCashflow } from '../tesoreria'
import { aggregaBudgetMensile, calcolaLiquidazioniIva, costruisciCeBaseline, MESI_KEYS } from '../budgetMensile'

// Stesso baseline sintetico dei test dei generatori: finestra ott-26...set-27, decorrenza = primo mese.
const mk = (categoria, descrizione, v, soggetto_iva = true) => ({ categoria, descrizione, soggetto_iva, totale_annuo: v * 12, ...Object.fromEntries(MESI_KEYS.map((m) => [m, v])) })
const VOCI = [mk('ricavi', 'Ricavi', 100000), mk('costi', 'Servizi', 40000), mk('costi', 'Salari e stipendi', 20000, false), mk('costi', '60830 - Energia elettrica', 3000)]
const AZ = { aliquota_iva_vendite: 22, aliquota_iva_acquisti: 22, liquidazione_iva: 'mensile', gg_medi_incasso: 0, gg_medi_pagamento: 0 }

function scenarioBaseline() {
  const righe = caricaRigheDaBudget(AZ, VOCI, 0, 0, 2026, 10)
  const piano = calcolaPianoCashflow({ righe, saldoIniziale: 50000, fatturatoMedio: 100000, bufferPct: 15, orizzonteMesi: 12, dso: 0, dpo: 0, meseInizio: [2026, 10], lineeCredito: { dichiarate: true, linee: [] } })
  const mesi = aggregaBudgetMensile(VOCI, AZ, 2026, 10, 12)
  piano.ce_baseline = costruisciCeBaseline(mesi, VOCI, {})
  piano.iva_baseline = { liquidazione: 'mensile', aliquota_vendite: 22, aliquota_acquisti: 22, periodi: calcolaLiquidazioniIva(mesi, 'mensile') }
  piano.mesi_reali = [{ entrate: 100000 }]
  piano.linee_credito = { dichiarate: true, n_linee: 0, accordato: 0, linee: [] }
  piano.modello_cassa = 9
  return { id: 'scen-1', creato_il: '2026-09-20 10:00:00', piano_json: piano, fatturato_mensile_medio: 100000 }
}
const ORA = new Date('2026-09-25T12:00:00Z')
const simula = (decisione) => calcolaSimulazione({ richiesta: { partita_iva: '01234567890', determina_ref: 'b1', decisione }, azienda: AZ, scenarioRow: scenarioBaseline(), ora: ORA })

const beneA = { tipo_impatto: 'acquisto_bene', descrizione: 'Macchinario A', data_decorrenza: '2026-10-01', imponibile: 60000, pagamento: { modalita: 'unico' }, ammortamento: { durata_mesi: 60 }, costi_esercizio_mensili: 100 }
const costoB = { tipo_impatto: 'costo_una_tantum', descrizione: 'Adeguamento B', data_decorrenza: '2027-01-01', categoria: 'adeguamento', importo: 5000 }

describe('composta: singolo tipo è un caso particolare (non regressione)', () => {
  test('un tipo singolo e una composta di 1 solo componente danno lo stesso risultato', () => {
    const singolo = simula(beneA)
    const composta = simula({ tipo_impatto: 'composta', descrizione: 'x', componenti: [beneA] })
    expect(composta.scenari.worst.conto_economico.ebitda.delta).toBe(singolo.scenari.worst.conto_economico.ebitda.delta)
    expect(composta.scenari.worst.mesi[11].delta_cassa).toBe(singolo.scenari.worst.mesi[11].delta_cassa)
  })
})

describe('composta: due componenti con decorrenze diverse', () => {
  const comp = simula({ tipo_impatto: 'composta', descrizione: 'Macchinario + adeguamento', componenti: [beneA, costoB] })

  test('il totale è la somma dei due componenti presi singolarmente', () => {
    const soloA = simula(beneA)
    const soloB = simula(costoB)
    const attesoEbitda = soloA.scenari.worst.conto_economico.ebitda.delta + soloB.scenari.worst.conto_economico.ebitda.delta
    expect(comp.scenari.worst.conto_economico.ebitda.delta).toBeCloseTo(attesoEbitda, 1)
  })

  test('dettaglio_componenti riporta il contributo di ciascuno, e la somma torna al totale', () => {
    expect(comp.dettaglio_componenti).toHaveLength(2)
    expect(comp.dettaglio_componenti[0].tipo_impatto).toBe('acquisto_bene')
    expect(comp.dettaglio_componenti[1].tipo_impatto).toBe('costo_una_tantum')
    const sommaEbitda = comp.dettaglio_componenti.reduce((s, c) => s + c.delta_ebitda_worst, 0)
    expect(sommaEbitda).toBeCloseTo(comp.scenari.worst.conto_economico.ebitda.delta, 1)
    const sommaCassa = comp.dettaglio_componenti.reduce((s, c) => s + c.delta_cassa_finale_worst, 0)
    expect(sommaCassa).toBeCloseTo(comp.scenari.worst.mesi[11].delta_cassa, 1)
  })

  test('il componente con decorrenza a gennaio non impatta i mesi precedenti', () => {
    // isolando il solo componente B, i primi 3 mesi (ott-dic, prima della sua decorrenza) non si muovono
    const soloB = simula(costoB)
    expect(soloB.scenari.worst.mesi[0].delta_cassa).toBe(0)
    expect(soloB.scenari.worst.mesi[2].delta_cassa).toBe(0)
    expect(soloB.scenari.worst.mesi[3].delta_cassa).toBeLessThan(0) // gennaio: il costo esce
  })
})

describe('composta: validità per componente (§4.G)', () => {
  test('un componente con decorrenza fuori dalla finestra genera FUORI_FINESTRA, con riferimento al componente', () => {
    const fuori = { ...costoB, data_decorrenza: '2028-01-01' }
    try {
      simula({ tipo_impatto: 'composta', descrizione: 'x', componenti: [beneA, fuori] })
      throw new Error('non doveva arrivare qui')
    } catch (e) {
      expect(e).toBeInstanceOf(ErroreMotore)
      expect(e.codice).toBe('FUORI_FINESTRA')
      expect(e.message).toContain('componente 2')
      expect(e.extra.componente).toBe(1)
    }
  })
})

describe('composta: ipotesi_ricavi per componente', () => {
  test('ogni componente può avere la propria ipotesi di ricavi, sommate nel totale', () => {
    const conRicavi = { ...beneA, ipotesi_ricavi: { modalita: 'euro_mese', valore: 1000, mese_partenza: '2026-10-01' } }
    const comp = simula({ tipo_impatto: 'composta', descrizione: 'x', componenti: [conRicavi, costoB] })
    // best - worst = 12 mesi x 1.000 (il ricavo ipotizzato del solo componente A)
    expect(comp.scenari.best.conto_economico.ebitda.delta - comp.scenari.worst.conto_economico.ebitda.delta).toBeCloseTo(12 * 1000, 0)
  })
})
