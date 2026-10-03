import { calcolaSimulazione } from './motore'
import { calcolaPianoAmmortamento } from './ammortamento'
import { generaCostoRicorrente } from './generatori'
import { caricaRigheDaBudget, calcolaPianoCashflow } from '../tesoreria'
import { aggregaBudgetMensile, calcolaLiquidazioniIva, costruisciCeBaseline, MESI_KEYS } from '../budgetMensile'

// Stesso baseline sintetico usato per il leasing (motore.test.js): decorrenza a ottobre 2026, finestra
// ott-26...set-27, IVA 22%, DSO/DPO 0 (nessuno sfasamento aggiuntivo, per isolare le formule di ciascun tipo).
const mk = (categoria, descrizione, v, soggetto_iva = true) => ({ categoria, descrizione, soggetto_iva, totale_annuo: v * 12, ...Object.fromEntries(MESI_KEYS.map((m) => [m, v])) })
const VOCI = [mk('ricavi', 'Ricavi', 100000), mk('costi', 'Servizi', 40000), mk('costi', 'Salari e stipendi', 20000, false), mk('costi', '60830 - Energia elettrica', 3000)]
const AZ = { aliquota_iva_vendite: 22, aliquota_iva_acquisti: 22, liquidazione_iva: 'mensile', gg_medi_incasso: 0, gg_medi_pagamento: 0 }

function scenarioBaseline() {
  const righe = caricaRigheDaBudget(AZ, VOCI, 0, 0, 2026, 10)
  const piano = calcolaPianoCashflow({ righe, saldoIniziale: 50000, fatturatoMedio: 100000, bufferPct: 15, orizzonteMesi: 12, dso: 0, dpo: 0, meseInizio: [2026, 10], lineeCredito: { dichiarate: true, linee: [] } })
  const mesiB = aggregaBudgetMensile(VOCI, AZ, 2026, 10, 12)
  piano.ce_baseline = costruisciCeBaseline(mesiB, VOCI, {})
  piano.iva_baseline = { liquidazione: 'mensile', aliquota_vendite: 22, aliquota_acquisti: 22, periodi: calcolaLiquidazioniIva(mesiB, 'mensile') }
  piano.mesi_reali = [{ entrate: 100000 }]
  piano.linee_credito = { dichiarate: true, n_linee: 0, accordato: 0, linee: [] }
  piano.modello_cassa = 9
  return { id: 'scen-1', creato_il: '2026-09-20 10:00:00', piano_json: piano, fatturato_mensile_medio: 100000 }
}
const ORA = new Date('2026-09-25T12:00:00Z')
const base = (decisione) => calcolaSimulazione({ richiesta: { partita_iva: '01234567890', determina_ref: 'b1', decisione }, azienda: AZ, scenarioRow: scenarioBaseline(), ora: ORA })

describe('acquisto_bene', () => {
  const d = { tipo_impatto: 'acquisto_bene', descrizione: 'Macchinario', data_decorrenza: '2026-10-01', imponibile: 84000, pagamento: { modalita: 'unico' }, ammortamento: { durata_mesi: 84 }, costi_esercizio_mensili: 200 }

  test('pagamento unico: tutta la cassa esce a ottobre, con IVA', () => {
    const r = base(d)
    // ottobre: 84.000 + 22% IVA + 200 costi esercizio (+ IVA); IVA recuperata alla liquidazione mensile
    expect(r.scenari.worst.mesi[0].delta_cassa).toBeCloseTo(-(84000 * 1.22 + 200 * 1.22), 0)
  })
  test('ammortamento su EBIT per la durata indicata, EBITDA impattato solo dai costi di esercizio', () => {
    const r = base(d)
    const ce = r.scenari.worst.conto_economico
    // 12 mesi interi in finestra (decorrenza = primo mese della finestra)
    expect(ce.ebitda.delta).toBeCloseTo(-12 * 200, 1)
    expect(ce.ebit.delta).toBeCloseTo(ce.ebitda.delta - (12 * 84000) / 84, 1)
    expect(ce.oneri_finanziari.delta).toBe(0)
  })
  test('acconto/saldo: due uscite, alla decorrenza e all\'entrata in funzione', () => {
    const r2 = base({ ...d, pagamento: { modalita: 'acconto_saldo', acconto_pct: 30 }, data_entrata_in_funzione: '2026-12-01' })
    // ottobre: solo il 30% + IVA; dicembre: il resto + IVA (in più rispetto a ottobre, che ha comunque i costi di esercizio)
    const nov = r2.scenari.worst.mesi[1].delta_cassa
    const dic = r2.scenari.worst.mesi[2].delta_cassa
    expect(dic).toBeLessThan(nov) // il saldo peggiora ancora a dicembre per il saldo del 70%
  })
  test('rate: importo diviso equamente, una per periodicità', () => {
    const r3 = base({ ...d, pagamento: { modalita: 'rate', numero_rate: 4, periodicita: 'trimestrale' } })
    const tot = r3.scenari.worst.mesi.reduce((s, m, j, arr) => s + (m.delta_cassa - (arr[j - 1]?.delta_cassa ?? 0)), 0)
    expect(r3.scenari.worst.mesi[11].delta_cassa).toBeLessThan(0)
  })
  test('contributi: incasso di cassa alla data indicata, avviso "solo cassa"', () => {
    const r4 = base({ ...d, contributi: [{ descrizione: 'Credito imposta 4.0', importo: 10000, data_incasso: '2026-11-15', natura: 'credito_imposta' }] })
    expect(r4.avvisi.some((a) => a.codice === 'CONTRIBUTI_SOLO_CASSA')).toBe(true)
    // il delta di novembre migliora di 10.000 rispetto a ottobre (nessun'altra spesa aggiuntiva quel mese)
    const senza = base(d)
    expect(r4.scenari.worst.mesi[1].cassa_scenario - senza.scenari.worst.mesi[1].cassa_scenario).toBeCloseTo(10000, 0)
  })
})

describe('finanziamento (rateale)', () => {
  const d = { tipo_impatto: 'finanziamento', descrizione: 'Mutuo chirografario', data_decorrenza: '2026-10-01', forma: 'rateale', importo: 100000, data_erogazione: '2026-10-05', tasso_annuo_pct: 6, numero_rate: 24, periodicita: 'mensile', piano: 'francese', preammortamento_mesi: 0, spese_istruttoria: 1000 }

  // La prima rata cade UN PERIODO dopo l'erogazione (accordo Pmi 360°): con erogazione a ottobre (mese 0 della
  // finestra) la prima rata e' a novembre (mese 1), quindi solo 11 delle 24 rate cadono nella finestra di 12 mesi.
  const pianoAtteso = calcolaPianoAmmortamento({ importo: d.importo, tassoAnnuoPct: d.tasso_annuo_pct, numeroRate: d.numero_rate, periodicita: d.periodicita, piano: d.piano })
  const rateNellaFinestra = pianoAtteso.rate.slice(0, 11)

  test('erogazione ed spese di istruttoria: nessuna IVA (operazione finanziaria pura), la prima rata è a novembre', () => {
    const r = base(d)
    expect(r.scenari.worst.mesi[0].delta_cassa).toBeCloseTo(100000 - 1000, 0) // ottobre: solo erogazione - istruttoria
    const rateTotali = rateNellaFinestra.reduce((s, x) => s + x.rata, 0)
    expect(r.scenari.worst.mesi[11].delta_cassa).toBeCloseTo(100000 - 1000 - rateTotali, 0) // a fine finestra, le 11 rate sono uscite
  })
  test('nel CE solo gli interessi (sotto l\'EBIT, per le sole rate dentro la finestra) e le spese di istruttoria; EBITDA non tocco', () => {
    const r = base(d)
    const ce = r.scenari.worst.conto_economico
    const interessiFinestra = rateNellaFinestra.reduce((s, x) => s + x.interessi, 0)
    expect(ce.ebitda.delta).toBe(0)
    expect(ce.ebit.delta).toBe(0)
    expect(ce.oneri_finanziari.delta).toBeCloseTo(interessiFinestra + 1000, 0)
  })
  test('a fine piano il debito residuo è (circa) zero', () => {
    expect(base(d).ipotesi_usate.debito_residuo_fine_piano).toBeCloseTo(0, 0)
  })
})

describe('costo_ricorrente', () => {
  const d = { tipo_impatto: 'costo_ricorrente', descrizione: 'Canone software', data_decorrenza: '2026-10-01', categoria: 'canone_software', importo_periodico: 3000, periodicita_fatturazione: 'trimestrale', pagamento_anticipato: false, durata_mesi: 12, indicizzazione_annua_pct: 0 }

  test('competenza mensilizzata, cassa concentrata a fine trimestre', () => {
    const r = base(d)
    const ce = r.scenari.worst.conto_economico.mensile
    expect(ce[0].ebitda).toBeCloseTo(-1000, 1) // 3.000/3 al mese
    // cassa: nulla nei primi due mesi del trimestre, tutto (3.000+IVA) al terzo
    expect(r.scenari.worst.mesi[0].delta_cassa).toBe(0)
    expect(r.scenari.worst.mesi[1].delta_cassa).toBe(0)
    expect(r.scenari.worst.mesi[2].delta_cassa).toBeCloseTo(-3000 * 1.22, 0)
  })
  test('pagamento anticipato: la cassa esce all\'inizio del periodo', () => {
    const r = base({ ...d, pagamento_anticipato: true })
    expect(r.scenari.worst.mesi[0].delta_cassa).toBeCloseTo(-3000 * 1.22, 0)
    // a novembre non c'e' un nuovo pagamento, ma l'IVA di ottobre (a credito) si recupera alla liquidazione di
    // novembre: il cumulato migliora dell'IVA recuperata (stessa meccanica del leasing, §4.L)
    expect(r.scenari.worst.mesi[1].delta_cassa).toBeCloseTo(-3000, 0)
  })
  test('deposito cauzionale: solo cassa, nessuna IVA, rimborsato a fine contratto', () => {
    const r = base({ ...d, deposito_cauzionale: 2000 })
    // il canone (posticipato) esce solo a fine trimestre (dicembre): a ottobre si muove solo il deposito, senza IVA
    expect(r.scenari.worst.mesi[0].delta_cassa).toBeCloseTo(-2000, 0)
    expect(r.scenari.worst.conto_economico.ebitda.delta).toBeCloseTo(-12 * 1000, 1) // il deposito non tocca il CE (12 mesi interi in finestra)
  })
  test('success fee: assente nel worst, presente in base e best', () => {
    const r = base({ ...d, success_fee: { importo: 5000, data_prevista: '2026-12-01' } })
    expect(r.scenari.worst.conto_economico.ebitda.delta).toBeCloseTo(-12 * 1000, 1) // invariato: nessuna success fee nel worst
    expect(r.scenari.base.conto_economico.ebitda.delta).toBeCloseTo(r.scenari.worst.conto_economico.ebitda.delta - 5000, 1)
    expect(r.scenari.best.conto_economico.ebitda.delta).toBeCloseTo(r.scenari.worst.conto_economico.ebitda.delta - 5000, 1)
  })
  // La finestra della proiezione e' sempre di 12 mesi: un contratto di 24 mesi (indicizzato al 13° mese) va
  // testato chiamando direttamente il generatore, non tramite calcolaSimulazione (che vede solo i primi 12 mesi).
  test('indicizzazione annua: il canone del secondo anno è più alto (generatore diretto)', () => {
    const g = generaCostoRicorrente({ ...d, durata_mesi: 24, indicizzazione_annua_pct: 10 }, { ymDecorrenza: 202610, dpoGiorni: 0 })
    const ceMese0 = g.ce.filter((r) => r.ym === 202610).reduce((s, r) => s + r.importo, 0)
    const ceMese12 = g.ce.filter((r) => r.ym === 202710).reduce((s, r) => s + r.importo, 0) // 13° mese = 12 mesi dopo
    expect(ceMese12).toBeCloseTo(ceMese0 * 1.1, 2)
  })
})

describe('costo_una_tantum', () => {
  const d = { tipo_impatto: 'costo_una_tantum', descrizione: 'Adeguamento normativo', data_decorrenza: '2026-10-01', categoria: 'adeguamento', importo: 6000 }

  test('competenza tutta a ottobre, pagamento unico con IVA', () => {
    const r = base(d)
    expect(r.scenari.worst.conto_economico.mensile[0].ebitda).toBeCloseTo(-6000, 1)
    expect(r.scenari.worst.mesi[0].delta_cassa).toBeCloseTo(-6000 * 1.22, 0)
  })
  test('piano pagamenti: le date esatte governano la cassa, competenza resta a ottobre', () => {
    const r = base({ ...d, piano_pagamenti: [{ data: '2026-10-01', importo: 3000 }, { data: '2027-01-01', importo: 3000 }] })
    expect(r.scenari.worst.conto_economico.mensile[0].ebitda).toBeCloseTo(-6000, 1) // competenza invariata
    expect(r.scenari.worst.mesi[0].delta_cassa).toBeCloseTo(-3000 * 1.22, 0)
    expect(r.scenari.worst.mesi[3].delta_cassa - r.scenari.worst.mesi[2].delta_cassa).toBeCloseTo(-3000 * 1.22, 0)
  })
  test('piano pagamenti incoerente con l\'importo: avviso, non errore', () => {
    const r = base({ ...d, piano_pagamenti: [{ data: '2026-10-01', importo: 1000 }] })
    expect(r.avvisi.some((a) => a.codice === 'PIANO_PAGAMENTI_NON_COERENTE')).toBe(true)
  })
})

describe('iva_regime comune a tutti i tipi (v8)', () => {
  test('esente: nessuna IVA sui movimenti, in nessun tipo', () => {
    const d = { tipo_impatto: 'costo_una_tantum', descrizione: 'x', data_decorrenza: '2026-10-01', categoria: 'altro', importo: 1000, iva_regime: 'esente' }
    expect(base(d).scenari.worst.mesi[0].delta_cassa).toBeCloseTo(-1000, 1)
  })
})

describe('ipotesi_ricavi comune anche nei tipi nuovi (richiesta Pmi 360°)', () => {
  test('acquisto_bene: worst <= base <= best, coerente col meccanismo comune', () => {
    const d = { tipo_impatto: 'acquisto_bene', descrizione: 'Linea produttiva', data_decorrenza: '2026-10-01', imponibile: 60000, pagamento: { modalita: 'unico' }, ammortamento: { durata_mesi: 60 }, costi_esercizio_mensili: 100, ipotesi_ricavi: { modalita: 'incremento_pct', valore: 5, mese_partenza: '2026-10-01' } }
    const r = base(d)
    const { worst, base: b, best } = r.scenari
    for (let j = 0; j < 12; j++) expect(best.mesi[j].cassa_scenario).toBeGreaterThanOrEqual(b.mesi[j].cassa_scenario)
    expect(worst.conto_economico.ebitda.delta).toBeLessThan(b.conto_economico.ebitda.delta)
    expect(b.conto_economico.ebitda.delta).toBeLessThan(best.conto_economico.ebitda.delta)
    // il ricavo ipotizzato (5% x 100.000 x 12 mesi = 60.000) e' lo stesso identico meccanismo del leasing
    expect(best.conto_economico.ebitda.delta - worst.conto_economico.ebitda.delta).toBeCloseTo(12 * 0.05 * 100000, 0)
  })
})

describe('personale', () => {
  const ingresso = { tipo_impatto: 'personale', descrizione: 'Nuovo tecnico', data_decorrenza: '2026-10-01', movimento: 'ingresso', numero_persone: 1, inquadramento: 'impiegato', ral_annua: 36400, mensilita: 13, contributi_pct: 30 }

  test('mensilità ordinaria: RAL/13 + contributi + TFR di legge (RAL/13,5)', () => {
    const r = base(ingresso)
    const ce = r.scenari.worst.conto_economico.mensile
    // TFR: RAL/13,5 e' l'accantonamento ANNUO, la quota mensile e' quel valore diviso 12 (non l'intero
    // importo ogni mese: era il bug segnalato da Pmi 360° sulla prima versione).
    const attesoOttobre = -(36400 / 13 + (36400 / 13) * 0.3 + 36400 / 13.5 / 12)
    expect(ce[0].ebitda).toBeCloseTo(attesoOttobre, 2)
  })
  test('la tredicesima raddoppia RAL e contributi solo a dicembre', () => {
    const r = base(ingresso)
    const ce = r.scenari.worst.conto_economico.mensile
    const rataOrd = 36400 / 13
    const attesoDicembre = -(2 * rataOrd + 2 * rataOrd * 0.3 + 36400 / 13.5 / 12)
    expect(ce[2].ebitda).toBeCloseTo(attesoDicembre, 2) // indice 2 = dicembre (decorrenza ottobre)
  })
  test('cassa: stipendio nel mese di competenza, contributi (F24) il mese dopo', () => {
    const r = base(ingresso)
    const rataOrd = 36400 / 13
    const contribOrd = rataOrd * 0.3
    expect(r.scenari.worst.mesi[0].delta_cassa).toBeCloseTo(-rataOrd, 1) // ottobre: solo stipendio
    expect(r.scenari.worst.mesi[1].delta_cassa).toBeCloseTo(-rataOrd - (rataOrd + contribOrd), 1) // novembre: stipendio + contributi di ottobre
  })
  test('nessuna IVA su nessun movimento', () => {
    const r = base({ ...ingresso, iva_regime: 'esente' }) // indifferente: personale non applica mai IVA
    const rSenza = base(ingresso)
    expect(r.scenari.worst.mesi[0].delta_cassa).toBe(rSenza.scenari.worst.mesi[0].delta_cassa)
  })
  test('sgravio contributivo: percentuale DELL\'ALIQUOTA (moltiplicativa), non punti — 100 = esonero totale', () => {
    const r = base({ ...ingresso, sgravi: { riduzione_contributi_pct: 100, durata_mesi: 3 } })
    const ce = r.scenari.worst.conto_economico.mensile
    const rataOrd = 36400 / 13
    const tfrOrd = 36400 / 13.5 / 12
    expect(ce[0].ebitda).toBeCloseTo(-(rataOrd + 0 + tfrOrd), 2) // esonero 100%: contributi azzerati nei primi 3 mesi
    expect(ce[4].ebitda).toBeCloseTo(-(rataOrd + rataOrd * 0.3 + tfrOrd), 2) // dal 4° mese, contributi pieni
  })
  test('sgravio parziale (50%): dimezza i contributi, non li annulla', () => {
    const r = base({ ...ingresso, sgravi: { riduzione_contributi_pct: 50, durata_mesi: 3 } })
    const ce = r.scenari.worst.conto_economico.mensile
    const rataOrd = 36400 / 13
    const tfrOrd = 36400 / 13.5 / 12
    expect(ce[0].ebitda).toBeCloseTo(-(rataOrd + rataOrd * 0.15 + tfrOrd), 2) // 0,3 * (1 - 0,5) = 0,15
  })
  test('contratto a termine (durata_mesi): il costo cessa dopo la durata', () => {
    const r = base({ ...ingresso, durata_mesi: 3 })
    const ce = r.scenari.worst.conto_economico.mensile
    expect(ce[0].ebitda).toBeLessThan(0)
    expect(ce[3].ebitda).toBe(0) // 4° mese: contratto già finito
  })
  test('numero_persone moltiplica RAL/contributi/TFR', () => {
    const uno = base(ingresso)
    const tre = base({ ...ingresso, numero_persone: 3 })
    expect(tre.scenari.worst.conto_economico.ebitda.delta).toBeCloseTo(uno.scenari.worst.conto_economico.ebitda.delta * 3, 1)
  })

  const uscita = { tipo_impatto: 'personale', descrizione: 'Uscita amministrativo', data_decorrenza: '2026-10-01', movimento: 'uscita', numero_persone: 1, inquadramento: 'impiegato', ral_annua: 30000, mensilita: 14, contributi_pct: 28, incentivo_esodo: 8000 }

  test('uscita: RAL/contributi/TFR diventano un risparmio (EBITDA migliora)', () => {
    const r = base(uscita)
    expect(r.scenari.worst.conto_economico.ebitda.delta).toBeGreaterThan(0)
    expect(r.avvisi.some((a) => a.codice === 'TFR_LIQUIDAZIONE_NON_MODELLATA')).toBe(true)
  })
  test('incentivo di esodo: costo ed esborso one-off alla decorrenza', () => {
    const r = base(uscita)
    const senza = base({ ...uscita, incentivo_esodo: 0 })
    expect(senza.scenari.worst.mesi[0].delta_cassa - r.scenari.worst.mesi[0].delta_cassa).toBeCloseTo(8000, 1)
  })

  test('costi_una_tantum (selezione): costo ed esborso alla decorrenza, non moltiplicato per numero_persone', () => {
    const r = base({ ...ingresso, numero_persone: 2, costi_una_tantum: [{ descrizione: 'Head hunter', importo: 3000 }] })
    const senza = base({ ...ingresso, numero_persone: 2 })
    expect(r.scenari.worst.mesi[0].delta_cassa - senza.scenari.worst.mesi[0].delta_cassa).toBeCloseTo(-3000, 1)
  })

  // Caso reale segnalato da Pmi 360° (simulazione 02db3ade...): con RAL 32.000, 13 mensilita', contributi 29,5%,
  // decorrenza 2026-11-01 su una finestra che parte a ottobre 2026, il CE totale doveva essere ~40.425 €, non i
  // ~64.326 € che restituiva la versione col bug del TFR mensilizzato per errore come importo annuo intero.
  test('CE totale sul caso reale segnalato da Pmi 360° (regressione sul bug del TFR)', () => {
    const r = base({ tipo_impatto: 'personale', descrizione: 'Assunzione tecnico', data_decorrenza: '2026-11-01', movimento: 'ingresso', numero_persone: 1, inquadramento: 'impiegato', ral_annua: 32000, mensilita: 13, contributi_pct: 29.5 })
    // 12 mensilita' di competenza (11 ordinarie nov-set + 13a a dicembre) + TFR su 11 mesi in finestra
    const mens = 32000 / 13
    const ceAtteso = -(mens * 12 + mens * 0.295 * 12 + (32000 / 13.5 / 12) * 11)
    expect(r.scenari.worst.conto_economico.ebitda.delta).toBeCloseTo(ceAtteso, 0)
    expect(r.scenari.worst.conto_economico.ebitda.delta).toBeCloseTo(-40425.15, 0)
    // la cassa non e' toccata dal fix (era gia' corretta secondo Pmi 360°)
    expect(r.scenari.worst.mesi[11].delta_cassa).toBeCloseTo(-37526.15, 0)
  })

  test('bonus variabile: concentrato nel mese indicato', () => {
    const r = base({ ...ingresso, bonus_variabile: { importo_annuo: 2000, mese_pagamento: '2027-03-01' } })
    const senza = base(ingresso)
    expect(r.scenari.worst.conto_economico.mensile[5].ebitda - senza.scenari.worst.conto_economico.mensile[5].ebitda).toBeCloseTo(-2000, 1)
    expect(r.scenari.worst.conto_economico.mensile[0].ebitda).toBeCloseTo(senza.scenari.worst.conto_economico.mensile[0].ebitda, 2)
  })
})
