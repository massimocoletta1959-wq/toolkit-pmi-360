import { caricaRigheDaBudget, calcolaPianoCashflow, calcolaConcentrazioneClienti, eseguiValidationRules } from './tesoreria'
import { MESI_KEYS } from './budgetMensile'

const mk = (categoria, descrizione, v, soggetto_iva = true) => ({ categoria, descrizione, soggetto_iva, totale_annuo: v * 12, ...Object.fromEntries(MESI_KEYS.map((m) => [m, v])) })
const voci = [mk('ricavi', 'Ricavi', 100000), mk('costi', 'Servizi', 60000), mk('costi', 'Salari e stipendi', 10000, false)]
const az = { aliquota_iva_vendite: 22, aliquota_iva_acquisti: 22, liquidazione_iva: 'mensile' }
const piano = (dso = 30, dpo = 30, extra = {}) =>
  calcolaPianoCashflow({ righe: caricaRigheDaBudget(az, voci, dso, dpo, 2026, 9), saldoIniziale: 20000, fatturatoMedio: 100000, bufferPct: 15, orizzonteMesi: 12, dso, dpo, meseInizio: [2026, 9], ...extra })

describe('scenari coerenti col base (§2.5d)', () => {
  test('ottimistico >= base >= pessimistico in ogni mese', () => {
    const p = piano()
    for (const m of p.mesi) {
      expect(m.saldo_ottimistico).toBeGreaterThanOrEqual(m.saldo_base)
      expect(m.saldo_base).toBeGreaterThanOrEqual(m.saldo_pessimistico)
    }
  })
  test('gli stress test non sono meno severi del base', () => {
    const p = piano()
    const saldoMinBase = Math.min(...p.mesi.map((m) => m.saldo_base), 0)
    for (const s of p.stress_tests.filter((x) => x.applicabile !== false)) expect(s.saldo_minimo).toBeLessThanOrEqual(saldoMinBase + 0.01)
  })
})

describe('DSO/DPO ripartiti sui mesi', () => {
  test('la somma degli incassi non cambia con DSO non multipli di 30', () => {
    const somma = (dso) => caricaRigheDaBudget(az, voci, dso, 30, 2026, 9).filter((r) => r.direzione === 'entrata').reduce((s, r) => s + r.importo, 0)
    expect(Math.round(somma(45))).toBe(Math.round(somma(30)))
    expect(Math.round(somma(12))).toBe(Math.round(somma(60)))
  })
  test('DSO 45gg = metà a +1 mese e metà a +2', () => {
    const righe = caricaRigheDaBudget(az, voci, 45, 30, 2026, 9).filter((r) => r.direzione === 'entrata' && r.dataFattura.getUTCMonth() === 8)
    expect(righe.map((r) => r.meseBudget).sort()).toEqual([202610, 202611])
    expect(Math.round(righe[0].importo)).toBe(Math.round(righe[1].importo))
  })
})

describe('concentrazione clienti (§2.5k)', () => {
  test('alert oltre 40% e scenario dedicato', () => {
    const c = calcolaConcentrazioneClienti([{ conto: '14/1', descrizione: 'Cliente A', importoTotale: 600 }, { conto: '14/2', descrizione: 'Cliente B', importoTotale: 400 }])
    expect(c).toMatchObject({ topCliente: 'Cliente A', topPct: 60, alert: true })
    const p = piano(30, 30, { concentrazione: c })
    expect(p.stress_tests.some((s) => s.scenario_nome.includes('Perdita del cliente principale'))).toBe(true)
  })
  test('senza dettaglio: non calcolabile (mai verde per default)', () => {
    expect(calcolaConcentrazioneClienti([])).toBeNull()
    expect(eseguiValidationRules({ concentrazione: null })['VR-4'].ok).toBeNull()
  })
})

describe('VR-1: DSO usato vs misurato (§2.5j: 5 giorni)', () => {
  test.each([[60, 45, false], [60, 56, true], [null, 45, null]])('misurato %s usato %s -> %s', (misurato, usato, atteso) => {
    expect(eseguiValidationRules({ dsoMisurato: misurato, dsoUsato: usato })['VR-1'].ok).toBe(atteso)
  })
})

describe('stress energia solo sulle voci energetiche (§2.5g)', () => {
  const conEnergia = [mk('ricavi', 'Ricavi', 100000), mk('costi', 'Servizi', 60000), mk('costi', '60830 - Energia elettrica', 20000)]
  const pianoDa = (v, extra = {}) => calcolaPianoCashflow({ righe: caricaRigheDaBudget(az, v, 30, 30, 2026, 9), saldoIniziale: 5000, fatturatoMedio: 100000, bufferPct: 15, orizzonteMesi: 12, dso: 30, dpo: 30, meseInizio: [2026, 9], ...extra })
  const trova = (p, nome) => p.stress_tests.find((x) => x.scenario_nome.startsWith(nome))

  test('senza voci energetiche lo scenario è non applicabile (mai stress su tutti i costi)', () => {
    const st = trova(piano(), 'Energia')
    expect(st.applicabile).toBe(false)
    expect(st.semaforo).toBe('nd')
  })
  test('con una voce energetica è applicabile e pesa meno di un +30% su tutte le uscite', () => {
    const st = trova(pianoDa(conEnergia), 'Energia')
    expect(st.applicabile).toBe(true)
  })
})

describe('blocco credito e copertura con le linee (§2.5g)', () => {
  // budget in perdita: il saldo va sotto zero
  const inPerdita = [mk('ricavi', 'Ricavi', 50000), mk('costi', 'Servizi', 70000)]
  const pianoDa = (lineeCredito) => calcolaPianoCashflow({ righe: caricaRigheDaBudget(az, inPerdita, 30, 30, 2026, 9), saldoIniziale: 10000, fatturatoMedio: 50000, bufferPct: 15, orizzonteMesi: 12, dso: 30, dpo: 30, meseInizio: [2026, 9], lineeCredito })
  const ritardo = (p) => p.stress_tests.find((x) => x.scenario_nome.startsWith('Ritardo'))

  test('linee non dichiarate: copertura non verificabile e blocco non valutabile', () => {
    const p = pianoDa({ dichiarate: false, linee: [] })
    expect(ritardo(p).coperto).toBeNull()
    expect(p.stress_tests.find((x) => x.scenario_nome.startsWith('Blocco')).semaforo).toBe('nd')
  })
  test('dichiarata "nessuna linea": il fabbisogno non è coperto -> rosso', () => {
    const st = ritardo(pianoDa({ dichiarate: true, linee: [] }))
    expect(st.coperto).toBe(false)
    expect(st.semaforo).toBe('rosso')
  })
  test('linee sufficienti: coperto -> giallo, non rosso', () => {
    const st = ritardo(pianoDa({ dichiarate: true, linee: [{ tipo: 'fido_conto_corrente', accordato: 5000000, utilizzato: 0, scadenza: null }] }))
    expect(st.coperto).toBe(true)
    expect(st.semaforo).toBe('giallo')
  })
  test('il blocco credito rende scoperti i mesi bloccati anche con linee ampie', () => {
    // conto già in scoperto dal primo mese: nei 2 mesi di blocco le linee non sono utilizzabili
    const p = calcolaPianoCashflow({ righe: caricaRigheDaBudget(az, inPerdita, 30, 30, 2026, 9), saldoIniziale: -1000, fatturatoMedio: 50000, bufferPct: 15, orizzonteMesi: 12, dso: 30, dpo: 30, meseInizio: [2026, 9], lineeCredito: { dichiarate: true, linee: [{ tipo: 'fido_conto_corrente', accordato: 5000000, utilizzato: 0, scadenza: null }] } })
    const blocco = p.stress_tests.find((x) => x.scenario_nome.startsWith('Blocco'))
    expect(blocco.applicabile).toBe(true)
    expect(blocco.mesi_scoperti).toBe(2)
    expect(blocco.semaforo).toBe('rosso')
    expect(p.stress_tests.find((x) => x.scenario_nome.startsWith('Ritardo')).mesi_scoperti).toBe(0)
  })
})

describe('CCC e DIO da anagrafica (§2.5e)', () => {
  const pianoDio = (dio) => calcolaPianoCashflow({ righe: caricaRigheDaBudget(az, voci, 30, 30, 2026, 9), saldoIniziale: 20000, fatturatoMedio: 100000, orizzonteMesi: 12, dso: 40, dpo: 30, dio, meseInizio: [2026, 9] })
  test('DIO non dichiarato: CCC parziale, senza inventare 50 giorni', () => {
    const p = pianoDio(null)
    expect(p.ccc_parziale).toBe(true)
    expect(p.ccc_medio).toBe(10)
  })
  test('senza magazzino DIO=0; con magazzino il DIO dichiarato', () => {
    expect(pianoDio(0)).toMatchObject({ ccc_parziale: false, ccc_medio: 10 })
    expect(pianoDio(45)).toMatchObject({ ccc_parziale: false, ccc_medio: 55 })
  })
})
