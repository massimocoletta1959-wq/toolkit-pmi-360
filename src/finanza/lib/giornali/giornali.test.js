import { leggiGiornale, leggiMovimentiGiornale, riconosciLettore } from './index'
import { gruppoDiConto } from '../libroGiornale'
import { eCodiceConto } from '../mappatureConti'

jest.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }))

// estratto in formato Seasoft (layout a colonne come dal PDF)
const INTESTAZIONE = [
  '                                     GIORNALE DI CONTABILITA\'',
  'Data registrazione   Causale                                   Attivita                                    Filiale',
  '              Riga   Conto          Descrizione conto          Descrizione dell\'operazione            Dare           Avere',
]
const testata = (data, causale) => `${data}           ${causale.padEnd(40)}A - Commercio all'ingrosso di metalli    1 - SEDE`
const riga = (n, conto, descr, op, dare, avere) => {
  let s = `             ${String(n).padEnd(8)}${conto.padEnd(15)}${descr.padEnd(27)}${op.padEnd(30)}`
  if (dare) s = s.padEnd(102 - dare.length) + dare
  if (avere) s = s.padEnd(117 - avere.length) + avere
  return s
}
const SEASOFT = [
  ...INTESTAZIONE,
  testata('01/01/2025', 'APERTURA ESERCIZIO'),
  riga(1, '15 / 5 / 1', 'Banca', 'Apertura', '1.000,00', null),
  riga(2, '55 / 5 / 2', 'Stato patrimoniale', 'Apertura', null, '1.000,00'),
  testata('10/04/2025', 'FATTURA DI VENDITA'),
  riga(3, '9 / 5 / 494', 'CLIENTE SRL', 'Del 10042025 n125 Pr1', '1.220,00', null),
  '                                                                          TOTALE PAGINA        2.220,00        1.000,00',
  ...INTESTAZIONE,
  '                                                                          RIPORTI              2.220,00        1.000,00',
  testata('10/04/2025', 'FATTURA DI VENDITA'),   // la stessa registrazione prosegue: testata ripetuta
  riga(4, '44 / 5 / 1', 'Vendite merci', 'Prot. 1 CLIENTE', null, '1.000,00'),
  riga(5, '23 / 115 / 2', 'IVA c/vendite', 'Prot. 1 CLIENTE', null, '220,00'),
  testata('31/12/2025', 'CHIUSURA A P/P'),
  riga(6, '44 / 5 / 1', 'Vendite merci', 'Chiusura', '1.000,00', null),
  riga(7, '55 / 5 / 1', 'Conto economico', 'Chiusura', null, '1.000,00'),
  '                                                                          TOTALE GENERALE      3.220,00        3.220,00',
]

describe('lettori di libro giornale', () => {
  test('riconosce Seasoft e ricostruisce saldi, quadrature e chiusura a P/P', () => {
    expect(riconosciLettore(SEASOFT).id).toBe('seasoft')
    const r = leggiGiornale(SEASOFT)
    expect(r.diagnostica.formato).toBe('seasoft')
    expect(r.diagnostica.registrazioniNonBilanciate).toBe(0)       // la testata ripetuta non spezza la fattura
    expect(r.diagnostica.checkpointOk).toBe(2)                     // totale pagina + totale generale
    expect(r.saldi['44/5/1']).toBeCloseTo(-1000, 2)                // la chiusura a P/P non azzera il ricavo
    expect(r.saldi['9/5/494']).toBeCloseTo(1220, 2)
    expect(r.saldi['55/5/2']).toBeUndefined()                      // conti tecnici esclusi
    expect(r.movimentiMensili[4]['44/5/1']).toBeCloseTo(-1000, 2)
    expect(r.descrizioni['9/5/494']).toBe('CLIENTE SRL')
  })

  test('movimenti per l\'Analisi dei flussi: segmenti, documento d\'origine, apertura', () => {
    const m = leggiMovimentiGiornale(SEASOFT)
    const fattura = m.filter((x) => x.data === '10/04/2025')
    expect(fattura.map((x) => x.chiudeSegmento)).toEqual([false, false, true])
    expect(fattura[0].dtDoc).toBe('10/04/2025')
    expect(m[0].eApertura).toBe(true)
  })

  test('codici conto: Seasoft numerico, TeamSystem invariato', () => {
    expect(gruppoDiConto('9/5/494')).toBe('9/5')
    expect(eCodiceConto('9/5/494')).toBe(true)
    expect(eCodiceConto('9/5')).toBe(false)
    expect(gruppoDiConto('06/05/015/G')).toBe('06/05/G')
    expect(gruppoDiConto('14/00090/C')).toBe('14/C')
    expect(eCodiceConto('06/05/015/G')).toBe(true)
    expect(eCodiceConto('14/C')).toBe(false)
  })

  test('formato sconosciuto: errore con i formati supportati', () => {
    expect(() => leggiGiornale(['testo qualsiasi'])).toThrow(/TeamSystem.*Seasoft/)
  })
})
