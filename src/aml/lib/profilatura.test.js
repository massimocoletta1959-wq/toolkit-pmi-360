import { calcolaProfilo, prossimaRevisione, bozzaMotivazione, erroriValutazione, statoRevisione, fattoriPer } from './profilatura'

const tutto = (tipo, valori = {}) => Object.fromEntries(fattoriPer(tipo).map(f => [f.codice, valori[f.codice] ?? f.opzioni[0].valore]))

describe('calcolaProfilo', () => {
  test('debitore regolare: basso', () => {
    const p = calcolaProfilo('debitore', tutto('debitore'))
    expect(p.completo).toBe(true)
    expect(p.punteggio).toBe(0)
    expect(p.classe).toBe('basso')
  })
  test('punteggio medio', () => {
    const p = calcolaProfilo('debitore', tutto('debitore', { importo: 'sopra_soglia', pagatore: 'terzo_giustificato' }))
    expect(p.punteggio).toBe(4)
    expect(p.classe).toBe('medio')
  })
  test('punteggio alto senza fattori d\'ufficio', () => {
    const p = calcolaProfilo('debitore', tutto('debitore', { natura_debitore: 'catena', modalita_pagamento: 'estero', comportamento: 'anomalo' }))
    expect(p.punteggio).toBe(9)
    expect(p.classe).toBe('alto')
    expect(p.motiviAlto).toEqual([])
  })
  test('PEP porta ad alto d\'ufficio', () => {
    const p = calcolaProfilo('mandante', tutto('mandante', { pep: 'si' }))
    expect(p.punteggio).toBe(4)
    expect(p.classe).toBe('alto')
    expect(p.motiviAlto.length).toBe(1)
  })
  test('fattori mancanti', () => {
    const p = calcolaProfilo('mandante', { natura_committente: 'vigilato' })
    expect(p.completo).toBe(false)
    expect(p.mancanti.length).toBe(fattoriPer('mandante').length - 1)
  })
  test('i fattori assenti restano nel dettaglio', () => {
    const p = calcolaProfilo('mandante', tutto('mandante'))
    expect(p.dettaglio.every(d => d.scelta && d.punti === 0)).toBe(true)
  })
})

describe('prossimaRevisione', () => {
  test('12/24/36 mesi', () => {
    expect(prossimaRevisione('alto', '2026-10-17')).toBe('2027-10-17')
    expect(prossimaRevisione('medio', '2026-10-17')).toBe('2028-10-17')
    expect(prossimaRevisione('basso', '2026-10-17')).toBe('2029-10-17')
  })
  test('fine mese', () => {
    expect(prossimaRevisione('alto', '2028-02-29')).toBe('2029-02-28')
  })
})

describe('erroriValutazione', () => {
  const profilo = calcolaProfilo('debitore', tutto('debitore'))
  test('valutazione completa', () => {
    expect(erroriValutazione({ profilo, classe: 'basso', motivazione: bozzaMotivazione(profilo), tipoValutazione: 'iniziale' })).toEqual([])
  })
  test('motivazione obbligatoria', () => {
    expect(erroriValutazione({ profilo, classe: 'basso', motivazione: 'ok', tipoValutazione: 'iniziale' }).length).toBe(1)
  })
  test('classe diversa senza spiegazione', () => {
    const m = bozzaMotivazione(profilo, 'medio')
    expect(erroriValutazione({ profilo, classe: 'medio', motivazione: m, tipoValutazione: 'iniziale' })).toContain('Spiega perché la classe attribuita è diversa da quella calcolata.')
    expect(erroriValutazione({ profilo, classe: 'medio', motivazione: m + 'notizie di stampa recenti', tipoValutazione: 'iniziale' })).toEqual([])
  })
  test('alto d\'ufficio non si abbassa', () => {
    const p = calcolaProfilo('debitore', tutto('debitore', { pep: 'si' }))
    const err = erroriValutazione({ profilo: p, classe: 'medio', motivazione: 'Motivazione lunga a sufficienza per il test', tipoValutazione: 'iniziale' })
    expect(err.some(e => e.includes('non può essere abbassata'))).toBe(true)
  })
  test('riesame: evidenze obbligatorie', () => {
    expect(erroriValutazione({ profilo, classe: 'basso', motivazione: bozzaMotivazione(profilo), tipoValutazione: 'riesame_periodico' }).length).toBe(3)
  })
})

describe('statoRevisione', () => {
  const oggi = '2026-10-17'
  test('stati', () => {
    expect(statoRevisione({ stato: 'attivo' }, oggi)).toBe('da_profilare')
    expect(statoRevisione({ stato: 'attivo', classe_rischio: 'basso', prossima_revisione: '2026-10-01' }, oggi)).toBe('scaduta')
    expect(statoRevisione({ stato: 'attivo', classe_rischio: 'basso', prossima_revisione: '2026-11-10' }, oggi)).toBe('in_scadenza')
    expect(statoRevisione({ stato: 'attivo', classe_rischio: 'basso', prossima_revisione: '2027-11-10' }, oggi)).toBe('regolare')
    expect(statoRevisione({ stato: 'chiuso', classe_rischio: 'basso', prossima_revisione: '2026-10-01' }, oggi)).toBe('chiuso')
  })
})
