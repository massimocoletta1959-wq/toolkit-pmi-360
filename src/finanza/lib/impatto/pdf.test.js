import fs from 'fs'
import * as pdfLib from 'pdf-lib'
import { calcolaSimulazione } from './motore'
import { generaPdfImpatto } from './pdf'
import { caricaRigheDaBudget, calcolaPianoCashflow } from '../tesoreria'
import { aggregaBudgetMensile, calcolaLiquidazioniIva, costruisciCeBaseline, MESI_KEYS } from '../budgetMensile'

const mk = (categoria, descrizione, v, soggetto_iva = true) => ({ categoria, descrizione, soggetto_iva, totale_annuo: v * 12, ...Object.fromEntries(MESI_KEYS.map((m) => [m, v])) })
const VOCI = [mk('ricavi', 'Ricavi', 100000), mk('costi', 'Servizi', 60000), mk('costi', 'Salari e stipendi', 20000, false), mk('costi', '60830 - Energia elettrica', 3000)]
const AZ = { nome: 'Azienda di Prova S.r.l.', aliquota_iva_vendite: 22, aliquota_iva_acquisti: 22, liquidazione_iva: 'trimestrale', gg_medi_incasso: 45, gg_medi_pagamento: 30 }

function baseline() {
  const righe = caricaRigheDaBudget(AZ, VOCI, 45, 30, 2026, 9)
  const piano = calcolaPianoCashflow({ righe, saldoIniziale: 30000, fatturatoMedio: 100000, bufferPct: 15, orizzonteMesi: 12, dso: 45, dpo: 30, meseInizio: [2026, 9], lineeCredito: { dichiarate: true, linee: [{ tipo: 'fido_conto_corrente', accordato: 40000, utilizzato: 0, scadenza: null }] } })
  const mesi = aggregaBudgetMensile(VOCI, AZ, 2026, 9, 12)
  piano.ce_baseline = costruisciCeBaseline(mesi, VOCI, {})
  piano.iva_baseline = { liquidazione: 'trimestrale', aliquota_vendite: 22, aliquota_acquisti: 22, periodi: calcolaLiquidazioniIva(mesi, 'trimestrale') }
  piano.mesi_reali = [{ entrate: 90000 }, { entrate: 100000 }, { entrate: 110000 }]
  piano.linee_credito = { dichiarate: true, n_linee: 1, accordato: 40000, linee: [{ tipo: 'fido_conto_corrente', accordato: 40000, utilizzato: 0, scadenza: null }] }
  return { id: 's1', creato_il: '2026-09-20 10:00:00', piano_json: piano, fatturato_mensile_medio: 100000 }
}

test('genera i due PDF validi (metodo finanziario, con ipotesi di ricavi)', async () => {
  const richiesta = { partita_iva: '01234567890', determina_ref: 'bozza-42', decisione: { tipo_impatto: 'leasing', descrizione: 'Acquisto macchinario X in leasing', data_decorrenza: '2026-11-01', imponibile: 240000, leasing: { metodo_contabile: 'finanziario', maxicanone: 24000, numero_rate: 60, periodicita: 'mensile', tasso_annuo_pct: 6.5, riscatto: 2400 }, costi_esercizio_mensili: 300, ammortamento: { durata_mesi: 84 }, ipotesi_ricavi: { modalita: 'incremento_pct', valore: 8, mese_partenza: '2027-01-01' } } }
  const risultato = calcolaSimulazione({ richiesta, azienda: AZ, scenarioRow: baseline(), ora: new Date('2026-09-25T12:00:00Z') })
  const t0 = Date.now()
  const pdf = await generaPdfImpatto(pdfLib, { azienda: AZ, richiesta, risultato, simulazioneId: '00000000-0000-4000-8000-000000000001', creatoIl: '2026-09-25' })
  const ms = Date.now() - t0
  for (const k of ['economico', 'finanziario']) {
    const doc = await pdfLib.PDFDocument.load(pdf[k])
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2)
    expect(pdf[k].length).toBeGreaterThan(5000)
    expect(pdf[k].length).toBeLessThan(2 * 1024 * 1024) // sotto la soglia-paracadute da 2 MB
  }
  if (process.env.SCRATCH) {
    fs.writeFileSync(`${process.env.SCRATCH}/economico.pdf`, pdf.economico)
    fs.writeFileSync(`${process.env.SCRATCH}/finanziario.pdf`, pdf.finanziario)
    fs.writeFileSync(`${process.env.SCRATCH}/info.txt`, `ms=${ms} eco=${pdf.economico.length} fin=${pdf.finanziario.length}`)
  }
})
