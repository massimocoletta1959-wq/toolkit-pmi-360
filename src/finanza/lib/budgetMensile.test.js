import { classificaVoceBudget, aggregaBudgetMensile, calcolaLiquidazioniIva, costruisciCeBaseline, analizzaStagionalita, imposteAnnue, MESI_KEYS } from './budgetMensile'
import { caricaRigheDaBudget } from './tesoreria'

const mk = (categoria, descrizione, v, soggetto_iva = true) => ({ categoria, descrizione, soggetto_iva, totale_annuo: v * 12, ...Object.fromEntries(MESI_KEYS.map((m) => [m, v])) })
const voci = [mk('ricavi', 'Ricavi', 100000), mk('costi', 'Servizi', 60000), mk('costi', 'Salari e stipendi', 10000, false), mk('costi', 'b) Amm. immobilizzazioni materiali', 2000, false), mk('costi', 'Interessi passivi', 500, false), mk('costi', 'Accantonamenti per rischi', 300, true)]

describe('classificaVoceBudget', () => {
  test.each([
    ['costi', 'a) Amm. immobilizzazioni immateriali', 'ammortamento'],
    ['costi', 'Svalutazioni crediti attivo circolante', 'ammortamento'],
    ['costi', 'Interessi e altri oneri finan.', 'onere_finanziario'],
    ['ricavi', 'Int.attivi su c/c e dep.banc.', 'provento_finanziario'],
    ['costi', "Imposte sul reddito dell'esercizio", 'imposta'],
    ['costi', 'Accantonamenti per rischi', 'accantonamento'],
    // falsi positivi noti: devono restare operativi
    ['costi', '60730 - Comp.prof.consul.amm.va/fisc.', 'costo_operativo'],
    ['costi', '60859 - Spese amministrative diverse', 'costo_operativo'],
    ['costi', '63203 - Imposta di bollo', 'costo_operativo'],
    ['costi', '60940 - Loc.fin.beni mobili', 'costo_operativo'],
  ])('%s | %s -> %s', (categoria, descrizione, atteso) => {
    expect(classificaVoceBudget(descrizione, categoria).tipo).toBe(atteso)
  })
})

describe('cassa dal budget netto', () => {
  test.each(['mensile', 'trimestrale'])('IVA neutra sul totale (%s): cassa netta = ricavi - costi monetari', (liquidazione) => {
    const az = { aliquota_iva_vendite: 22, aliquota_iva_acquisti: 22, liquidazione_iva: liquidazione }
    const righe = caricaRigheDaBudget(az, voci, 30, 30, 2026, 1)
    const somma = (f) => righe.filter(f).reduce((s, r) => s + r.importo, 0)
    const netto = somma((r) => r.direzione === 'entrata') - somma((r) => r.direzione === 'uscita')
    // ammortamenti (2000) e accantonamenti (300) non escono dalla cassa
    expect(Math.round(netto)).toBe(12 * (100000 - 60000 - 10000 - 500))
  })

  test('il credito IVA si riporta al periodo successivo invece di essere versato', () => {
    const az = { aliquota_iva_vendite: 22, aliquota_iva_acquisti: 22, liquidazione_iva: 'mensile' }
    const v = [mk('ricavi', 'Ricavi', 1000), mk('costi', 'Servizi', 50000)]
    const p = calcolaLiquidazioniIva(aggregaBudgetMensile(v, az, 2026, 1), 'mensile')
    expect(p[0].versamento).toBe(0)
    expect(p[0].credito_riportato).toBeGreaterThan(0)
    expect(p[1].credito_precedente).toBe(p[0].credito_riportato)
  })
})

describe('CE baseline', () => {
  test('waterfall e finestra a cavallo d\'anno', () => {
    const az = { aliquota_iva_vendite: 22, aliquota_iva_acquisti: 22 }
    const ce = costruisciCeBaseline(aggregaBudgetMensile(voci, az, 2026, 9), voci, {})
    expect(ce.finestra).toEqual({ da: 202609, mesi: 12 })
    expect(ce.mesi.filter((m) => m.replica)).toHaveLength(8)
    // l'accantonamento (300) sta sopra l'EBITDA
    expect(ce.totale.ebitda).toBe(12 * (100000 - 60000 - 10000 - 300))
    expect(ce.totale.ebit).toBe(ce.totale.ebitda - 12 * 2000)
    expect(ce.totale.utile).toBe(ce.totale.ebit - 12 * 500)
    expect(ce.utilizzabile).toBe(true)
  })
  test('budget vuoto o a zero -> non utilizzabile', () => {
    expect(costruisciCeBaseline(aggregaBudgetMensile([], {}, 2026, 1), [], {}).utilizzabile).toBe(false)
  })
})

describe('contributi, imposte e stagionalità', () => {
  const az = { aliquota_iva_vendite: 22, aliquota_iva_acquisti: 22, liquidazione_iva: 'mensile' }
  const conImposte = [mk('ricavi', 'Ricavi', 100000), mk('costi', 'Servizi', 40000), mk('costi', 'Contributi INPS', 5000, false), mk('costi', 'Salari e stipendi', 10000, false), mk('costi', 'Imposte sul reddito dell\'esercizio', 1000, false)]

  test('contributi: F24 il 16 del mese successivo; stipendi il 27', () => {
    const righe = caricaRigheDaBudget(az, conImposte, 30, 30, 2026, 1)
    const contr = righe.filter((r) => r.categoria === 'contributi')
    expect(contr).toHaveLength(12)
    expect(contr[0].dataScadenza.getUTCDate()).toBe(16)
    expect(contr[0].meseBudget).toBe(202602)
    expect(righe.filter((r) => r.categoria === 'personale')[0].dataScadenza.getUTCDate()).toBe(27)
  })
  test('imposte: acconti 50% a giugno e 50% a novembre, totale = imposta annua', () => {
    const righe = caricaRigheDaBudget(az, conImposte, 30, 30, 2026, 1).filter((r) => r.categoria === 'imposte')
    expect(righe.map((r) => r.meseBudget)).toEqual([202606, 202611])
    expect(Math.round(righe[0].importo)).toBe(6000)
    expect(Math.round(righe[1].importo)).toBe(6000)
    expect(Math.round(righe[0].importo + righe[1].importo)).toBe(imposteAnnue(conImposte))
  })
  test('la cassa netta resta ricavi - costi monetari (contributi e imposte inclusi)', () => {
    const righe = caricaRigheDaBudget(az, conImposte, 30, 30, 2026, 1)
    const netto = righe.reduce((s, r) => s + (r.direzione === 'entrata' ? r.importo : -r.importo), 0)
    expect(Math.round(netto)).toBe(12 * (100000 - 40000 - 5000 - 10000 - 1000))
  })
  test('stagionalità: una voce stagionale piatta è segnalata', () => {
    const r = analizzaStagionalita([mk('costi', '60830 - Energia elettrica', 3000), mk('costi', 'Servizi', 500), { ...mk('costi', 'Riscaldamento', 0), gen: 900, feb: 800, dic: 900, totale_annuo: 2600 }])
    expect(r.stagionali_piatte).toEqual(['60830 - Energia elettrica'])
    expect(r.n_piatte).toBe(2)
  })
})

describe('investimenti e finanziamenti', () => {
  const { caricaRigheFinanziamenti } = require('./tesoreria')
  const { calcolaPaybackInvestimento } = require('./budgetMensile')
  const az = { aliquota_iva_vendite: 22, aliquota_iva_acquisti: 22, liquidazione_iva: 'mensile' }
  const voci = [mk('ricavi', 'Ricavi', 100000), mk('costi', 'Servizi', 60000)]
  const inv = [{ importo: 100000, soggetto_iva: true, tranche: [{ mese: '2026-03', pct: 30 }, { mese: '2026-06', pct: 40 }, { mese: '2026-09', pct: 30 }] }]

  test('investimento: esborso per tranche con IVA, e la cassa netta cala dell\'importo netto', () => {
    const senza = caricaRigheDaBudget(az, voci, 30, 30, 2026, 1)
    const con = caricaRigheDaBudget(az, voci, 30, 30, 2026, 1, inv)
    const tot = (r) => r.reduce((s, x) => s + (x.direzione === 'entrata' ? x.importo : -x.importo), 0)
    const rInv = con.filter((r) => r.categoria === 'investimenti')
    expect(rInv.map((r) => r.meseBudget)).toEqual([202603, 202606, 202609])
    expect(Math.round(rInv[0].importo)).toBe(36600) // 30% di 100.000 + IVA 22%
    expect(Math.round(tot(senza) - tot(con))).toBe(100000) // IVA recuperata in liquidazione: resta il costo netto
  })
  test('finanziamento: rate mensili e trimestrali dalla prossima rata, solo dentro la finestra', () => {
    const f = [{ descrizione: 'Mutuo', importo_rata: 1000, periodicita: 'mensile', data_prossima_rata: '2026-10-31', numero_rate_residue: 20 }]
    const r = caricaRigheFinanziamenti(f, [2026, 9], 12)
    expect(r).toHaveLength(11) // ott 2026 ... ago 2027
    expect(r[0].dataScadenza.getUTCDate()).toBe(31)
    expect(r[4].dataScadenza.toISOString().slice(0, 10)).toBe('2027-02-28') // il 31 diventa fine mese
    const q = caricaRigheFinanziamenti([{ ...f[0], periodicita: 'trimestrale' }], [2026, 9], 12)
    expect(q.map((x) => x.meseBudget)).toEqual([202610, 202701, 202704, 202707])
  })
  test('payback semplice e attualizzato (§2.5f)', () => {
    const p = calcolaPaybackInvestimento({ importo: 100000, beneficio_annuo: 40000, impatto_costi_annuo: 10000, tasso_attualizzazione_pct: 5 })
    expect(p.payback_semplice).toBeCloseTo(3.33, 2)
    expect(p.payback_attualizzato).toBeGreaterThan(p.payback_semplice)
    expect(p.oltre_3_anni).toBe(true)
    expect(calcolaPaybackInvestimento({ importo: 100000, beneficio_annuo: 10000, impatto_costi_annuo: 20000 }).payback_semplice).toBeNull()
  })
})

describe('scorte, vista settimanale, LCR', () => {
  const { calcolaSettimane, saldoPrevistoAl, calcolaLcrPmi, calcolaPianoCashflow } = require('./tesoreria')
  const az = { aliquota_iva_vendite: 22, aliquota_iva_acquisti: 22, liquidazione_iva: 'mensile' }
  const voci = [mk('ricavi', 'Ricavi', 100000), mk('costi', 'Servizi', 60000)]

  test('manovre scorte: incremento = uscita con IVA, riduzione = minori acquisti; IVA neutra sul totale', () => {
    const manovre = [{ mese: '2026-03', tipo: 'incremento_scorte', importo: 10000, soggetto_iva: true }, { mese: '2026-09', tipo: 'riduzione_scorte', importo: 4000, soggetto_iva: true }]
    const senza = caricaRigheDaBudget(az, voci, 30, 30, 2026, 1)
    const con = caricaRigheDaBudget(az, voci, 30, 30, 2026, 1, [], manovre)
    const tot = (r) => r.reduce((s, x) => s + (x.direzione === 'entrata' ? x.importo : -x.importo), 0)
    expect(con.find((r) => r.categoria === 'scorte').importo).toBeCloseTo(12200, 0)
    expect(con.find((r) => r.categoria === 'riduzione_scorte').direzione).toBe('entrata')
    expect(Math.round(tot(senza) - tot(con))).toBe(6000) // +10.000 - 4.000 netti
  })

  test('vista settimanale: 13 settimane, saldi coerenti con i flussi pesati', () => {
    const righe = caricaRigheDaBudget(az, voci, 30, 30, 2026, 9)
    const v = calcolaSettimane({ righe, inizio: new Date(Date.UTC(2026, 8, 1)), saldoIniziale: 20000, buffer: 15000 })
    expect(v.settimane).toHaveLength(13)
    const netto = v.settimane.reduce((s, w) => s + w.entrate - w.uscite, 0)
    expect(Math.round(v.settimane[12].saldo_fine)).toBe(Math.round(20000 + netto))
    expect(saldoPrevistoAl(v, '2026-09-30')).toBe(saldoPrevistoAl(v, '2026-09-30'))
    expect(saldoPrevistoAl(v, '2026-08-15')).toBeNull()
    // il saldo previsto all'ultimo giorno coincide con il saldo di fine 13a settimana
    expect(saldoPrevistoAl(v, v.settimane[12].al)).toBeCloseTo(v.settimane[12].saldo_fine, 1)
  })

  test('LCR: (cassa + linee non utilizzate) / uscite stressate a 30 giorni', () => {
    const l = calcolaLcrPmi({ saldoIniziale: 50000, lineeCredito: { dichiarate: true, linee: [{ accordato: 30000, utilizzato: 10000 }] }, primoMese: { uscite_certe: 20000, uscite_stimate: 50000 } })
    // uscite stress = 20.000 + 50.000*1,10 = 75.000; liquidità = 50.000 + 20.000
    expect(l.lcr_pct).toBeCloseTo(93.3, 1)
    expect(calcolaLcrPmi({ saldoIniziale: -5000, lineeCredito: null, primoMese: { uscite_certe: 1000, uscite_stimate: 0 } }).lcr_pct).toBe(0)
  })
})
