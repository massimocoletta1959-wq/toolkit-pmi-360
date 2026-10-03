import { calcolaPianoAmmortamento } from './ammortamento'

describe('piano di ammortamento (finanziamento rateale, v8)', () => {
  test('francese: rata costante, il capitale residuo va a zero', () => {
    const { rate, residuoFinale } = calcolaPianoAmmortamento({ importo: 100000, tassoAnnuoPct: 6, numeroRate: 24, periodicita: 'mensile', piano: 'francese' })
    const rate0 = rate[0].rata
    expect(rate.every((r) => Math.abs(r.rata - rate0) < 0.01)).toBe(true)
    expect(residuoFinale).toBeCloseTo(0, 1)
    expect(rate.reduce((s, r) => s + r.capitale, 0)).toBeCloseTo(100000, 1)
  })

  test('italiano: quota capitale costante, la rata decresce', () => {
    const { rate, residuoFinale } = calcolaPianoAmmortamento({ importo: 120000, tassoAnnuoPct: 6, numeroRate: 12, periodicita: 'mensile', piano: 'italiano' })
    expect(rate.every((r) => Math.abs(r.capitale - 10000) < 0.01)).toBe(true)
    expect(rate[0].rata).toBeGreaterThan(rate[rate.length - 1].rata)
    expect(residuoFinale).toBeCloseTo(0, 1)
  })

  test('bullet: solo interessi, capitale tutto all\'ultima rata', () => {
    const { rate, residuoFinale } = calcolaPianoAmmortamento({ importo: 50000, tassoAnnuoPct: 5, numeroRate: 6, periodicita: 'trimestrale', piano: 'bullet' })
    expect(rate.slice(0, -1).every((r) => r.capitale === 0)).toBe(true)
    expect(rate[rate.length - 1].capitale).toBeCloseTo(50000, 1)
    expect(rate.every((r) => Math.abs(r.interessi - 50000 * (0.05 / 4)) < 0.01)).toBe(true) // capitale costante: stessi interessi ogni rata
    expect(residuoFinale).toBeCloseTo(0, 1)
  })

  test('preammortamento: solo interessi sul capitale intero, poi parte il piano scelto', () => {
    const { rate, periodiPream } = calcolaPianoAmmortamento({ importo: 100000, tassoAnnuoPct: 6, numeroRate: 12, periodicita: 'mensile', piano: 'francese', preammortamentoMesi: 6 })
    expect(periodiPream).toBe(6)
    for (let p = 0; p < 6; p++) {
      expect(rate[p].capitale).toBe(0)
      expect(rate[p].interessi).toBeCloseTo(100000 * (0.06 / 12), 2) // capitale ancora intero durante il preammortamento
    }
    expect(rate).toHaveLength(18) // 6 di preammortamento + 12 del piano
    expect(rate[6].capitale).toBeGreaterThan(0)
  })

  test('senza tasso: la rata francese è l\'importo diviso il numero di rate', () => {
    const { rate } = calcolaPianoAmmortamento({ importo: 12000, tassoAnnuoPct: 0, numeroRate: 12, periodicita: 'mensile', piano: 'francese' })
    expect(rate.every((r) => Math.abs(r.rata - 1000) < 0.01 && r.interessi === 0)).toBe(true)
  })
})
