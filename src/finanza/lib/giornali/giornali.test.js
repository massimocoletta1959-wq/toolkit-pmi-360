import { leggiGiornale, leggiMovimentiGiornale, riconosciLettore } from './index'
import { gruppoDiConto } from '../libroGiornale'
import { eCodiceConto } from '../mappatureConti'

jest.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }))

// estratto in formato Buffetti (layout a colonne come dal PDF)
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
const BUFFETTI = [
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
  test('riconosce Buffetti e ricostruisce saldi, quadrature e chiusura a P/P', () => {
    expect(riconosciLettore(BUFFETTI).id).toBe('buffetti')
    const r = leggiGiornale(BUFFETTI)
    expect(r.diagnostica.formato).toBe('buffetti')
    expect(r.diagnostica.registrazioniNonBilanciate).toBe(0)       // la testata ripetuta non spezza la fattura
    expect(r.diagnostica.checkpointOk).toBe(2)                     // totale pagina + totale generale
    expect(r.saldi['44/5/1']).toBeCloseTo(-1000, 2)                // la chiusura a P/P non azzera il ricavo
    expect(r.saldi['9/5/494']).toBeCloseTo(1220, 2)
    expect(r.saldi['55/5/2']).toBeUndefined()                      // conti tecnici esclusi
    expect(r.movimentiMensili[4]['44/5/1']).toBeCloseTo(-1000, 2)
    expect(r.descrizioni['9/5/494']).toBe('CLIENTE SRL')
  })

  test('movimenti per l\'Analisi dei flussi: segmenti, documento d\'origine, apertura', () => {
    const m = leggiMovimentiGiornale(BUFFETTI)
    const fattura = m.filter((x) => x.data === '10/04/2025')
    expect(fattura.map((x) => x.chiudeSegmento)).toEqual([false, false, true])
    expect(fattura[0].dtDoc).toBe('10/04/2025')
    expect(m[0].eApertura).toBe(true)
  })

  test('codici conto: Buffetti numerico, TeamSystem invariato', () => {
    expect(gruppoDiConto('9/5/494')).toBe('9/5')
    expect(eCodiceConto('9/5/494')).toBe(true)
    expect(eCodiceConto('9/5')).toBe(false)
    expect(gruppoDiConto('06/05/015/G')).toBe('06/05/G')
    expect(gruppoDiConto('14/00090/C')).toBe('14/C')
    expect(eCodiceConto('06/05/015/G')).toBe(true)
    expect(eCodiceConto('14/C')).toBe(false)
  })

  test('formato sconosciuto: errore con i formati supportati', () => {
    expect(() => leggiGiornale(['testo qualsiasi'])).toThrow(/TeamSystem.*Buffetti/)
  })
})

test('RiBa: il cliente incassa alla scadenza della ricevuta, non alla sua emissione', () => {
  const RIBA = [
    ...INTESTAZIONE,
    testata('10/01/2025', 'MOVIMENTI DIVERSI'),
    riga(1, '11 / 5 / 3', 'Ricevute bancarie', 'SCADENZA 28.02.25', '2.133,87', null),
    riga(2, '11 / 5 / 3', 'Ricevute bancarie', 'SCADENZA 31.03.25', '1.020,00', null),
    riga(3, '9 / 5 / 423', 'C.M. SRL', 'N.2025 10/E del 09012025', null, '2.133,87'),
    riga(4, '9 / 5 / 243', 'MARSILLI SPA', 'N.2025 8/E del 09012025', null, '1.020,00'),
  ]
  const m = leggiMovimentiGiornale(RIBA)
  expect(m.find((x) => x.conto === '9/5/423')).toMatchObject({ dtDoc: '09/01/2025', dataEffettiva: '28/02/2025' })
  expect(m.find((x) => x.conto === '9/5/243').dataEffettiva).toBe('31/03/2025')
  expect(m.find((x) => x.conto === '11/5/3').dataEffettiva).toBeUndefined()
})

// estratto di "Stampa Lista Prima Nota" da AS/400 (filtrata per utente: manca l'incasso del cliente)
const AS400 = [
  'CGH5PFR                         Stampa Lista Prima Nota                         Pag.     1',
  'Data Reg. Protoc. Num. Mov.    Cau   N. Documento   Data Doc. Val.    Fil. Pr. Utente    Bl. P/E',
  'Conto Cont. Codice Descrizione           Imp.Div.Richiesta Imp.Div.Originale      Imponibile     D Al Desc. Aggiuntiva    Dt. Scad.',
  ' 1/01/25           24       1  300                    1/01/25   EUR    01    ASAPCOLETT    B   E',
  '130303000001        UNICREDIT 6608312          1.000,00          1.000,00 D                 APERTURA CONTI        1/01/25',
  '310202000001        Capitale Sociale           1.000,00          1.000,00 A                 APERTURA CONTI        1/01/25',
  'Totali al  1/01/25 Num.      1 Totale Dare    1.000,00 Totale Avere    1.000,00  Squadr.',
  '10/04/25           24     616  020          125    10/04/25   EUR    01    ASAPCOLETT    B   E',
  '110101000000 000071 OFFICINE MECCANICHE        1.220,00          1.220,00 D                 FATT. 125            10/05/25',
  '500101000001        Ricavi di spedizione       1.000,00          1.000,00 A                 FATT. 125            10/04/25',
  '090303000002        I.V.A. su vendite            220,00            220,00 A        1.000,00 22 FATT. 125         10/04/25',
  'Totali al 10/04/25 Num.      1 Totale Dare    1.220,00 Totale Avere    1.220,00  Squadr.',
  '31/12/25           25     866  300                    31/12/25   EUR    01    ASAPCOLETT    B   E',
  '500101000001        Ricavi di spedizione       1.000,00          1.000,00 D                 CHIUSURA 2025 ECON.  31/12/25',
  '310202000100        Utile   d\'esercizio        1.000,00          1.000,00 A                 CHIUSURA 2025 ECON.  31/12/25',
  '31/12/25           25     867  300                    31/12/25   EUR    01    ASAPCOLETT    B   E',
  '130303000001        UNICREDIT 6608312          2.220,00          2.220,00 A                 CHIUS. STATO Patr.   31/12/25',
  '310202000001        Capitale Sociale           1.000,00          1.000,00 D                 CHIUS. STATO Patr.   31/12/25',
  '310202000100        Utile   d\'esercizio        1.000,00          1.000,00 D                 CHIUS. STATO Patr.   31/12/25',
  '090303000002        I.V.A. su vendite            220,00            220,00 D                 CHIUS. STATO Patr.   31/12/25',
  'Totali al 31/12/25 Num.      2 Totale Dare    3.220,00 Totale Avere    3.220,00  Squadr.',
  'Conto        Descr.                                   Importo Dare      Importo Avere',
  '500101000001 Ricavi di spedizione aerea                 1.000,00           1.000,00',
]

test('AS/400 Lista Prima Nota: saldi dalla chiusura, conti cliente col codice soggetto, stampa parziale segnalata', () => {
  expect(riconosciLettore(AS400).id).toBe('as400')
  const r = leggiGiornale(AS400)
  expect(r.diagnostica).toMatchObject({ formato: 'as400', testate: 4, registrazioniNonBilanciate: 0, checkpointOk: 3, checkpointKo: 0 })
  expect(r.saldi['13/0303/000001']).toBeCloseTo(2220, 2)            // dalla chiusura, anche senza l'incasso stampato
  expect(r.saldi['11/0101/000071']).toBeUndefined()                  // non chiuso: saldo zero a fine anno
  expect(r.saldi['50/0101/000001']).toBeCloseTo(-1000, 2)
  expect(r.saldi['31/0202/000100']).toBeUndefined()                  // il risultato resta nei costi e ricavi
  expect(Object.values(r.saldi).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 2)
  expect(r.movimentiMensili[4]['11/0101/000071']).toBeCloseTo(1220, 2)
  expect(r.descrizioni['11/0101/000071']).toBe('OFFICINE MECCANICHE')
  expect(r.descrizioni['50/0101/000001']).toBe('Ricavi di spedizione aerea')
  expect(r.diagnostica.verificaKo).toBe(2)                           // banca e cliente: movimenti mancanti
  expect(r.diagnostica.avviso).toMatch(/filtrata/)
  expect(gruppoDiConto('11/0101/000071')).toBe('11/0101')
  expect(eCodiceConto('11/0101/000071')).toBe(true)
  const m = leggiMovimentiGiornale(AS400)
  expect(m.find((x) => x.conto === '11/0101/000071')).toMatchObject({ dtDoc: '10/04/2025', nDoc: '125', chiudeSegmento: false })
  expect(m[0].eApertura).toBe(true)
})

test('AS/400: testata con protocollo e incassi senza riferimento alla fattura abbinati in ordine cronologico', () => {
  const T = [
    'CGH5PFR                         Stampa Lista Prima Nota                         Pag.     1',
    'Conto Cont. Codice Descrizione           Imp.Div.Richiesta Imp.Div.Originale      Imponibile     D Al Desc. Aggiuntiva    Dt. Scad.',
    '31/01/26        1  26      47  102            1     31/01/26   EUR    01    ASAPRUSSO       E',
    '110104000000 000045 ASAP LOGISTICS UK Lt      1.000,00          1.000,00 D                    28/02/26',
    '500101000001        Ricavi di spedizione      1.000,00          1.000,00 A                    28/02/26',
    '28/02/26        6  26      99  102            6     28/02/26   EUR    01    ASAPRUSSO       E',
    '110104000000 000045 ASAP LOGISTICS UK Lt      3.000,00          3.000,00 D                    31/03/26',
    '500101000001        Ricavi di spedizione      3.000,00          3.000,00 A                    31/03/26',
    ' 2/03/26           26     108  120                                  EUR    01    ASAPCOLETT      E',
    '130303000001        UNICREDIT 6608312         2.000,00          2.000,00 D',
    '110104000000 000045 ASAP LOGISTICS UK Lt      2.000,00          2.000,00 A',
  ]
  const m = leggiMovimentiGiornale(T)
  expect(m.filter((x) => x.data === '31/01/2026')).toHaveLength(2)          // la testata con protocollo apre la registrazione
  const incasso = m.find((x) => x.conto === '11/0104/000045' && x.segno === -1)
  // 1.000 della fattura del 31/01 e 1.000 di quella del 28/02: data media 14/02 (circa)
  expect(incasso.dtDoc).toBe('14/02/2026')
  expect(incasso.nDoc).toBe('1, 6')
})

// GB Software: una riga per movimento, lato Dare/Avere dalla colonna, registrazioni ricostruite per quadratura
const GB = [
  '                                                                                      LIBRO GIORNALE - Anno 2025',
  '  DATA                                 DESCRIZIONE                                    D A R E         A V E R E                                     DESCRIZIONE CONTO                  N. RIGA',
  '01/01/25 Fattura acquisto n. 335 Forn.fatt.da ricev.beni e ser.                                            6.512,36      335 31/12/24 41001 - L.G.E. CALCESTRUZZI SRL                     1',
  '01/01/25 Fattura acquisto n. 335 L.G.E. CALCESTRUZZI SRL                                 1.174,36                        335 31/12/24 45041 - IVA acquisti                                2',
  '01/01/25 Fattura acquisto n. L.G.E. CALCESTRUZZI SRL                                     5.338,00                        335 31/12/24 44020 - Forn.fatt.da ricev.beni e ser.              3',
  '16/01/25 Rilevazione CANONE MENSILE                                                          20,00                          1 16/01/25 64330 - Spese di banca                              4',
  '16/01/25 Rilevazione CANONE MENSILE                                                                           20,00   HI16/01/25 50105 - BdM Banca conto 1000504                     5',
  '                                                                      T O T A L I       6.532,36         6.532,36',
  // descrizione lunga: l'importo in Dare e' stato spinto verso la colonna Avere (lato incerto, deciso dalla quadratura)
  '03/06/25 Nota accredito su fatt.acquisto n. FPR 8/25 Costi per pers.distacc.di terzi presso 30.476,82             FPR 8/25 03/06/25 41065 - Chiesa di San Domenico                  6',
  '03/06/25 Nota accredito su fatt.acquisto n. FPR 8/25 C.J.LIPO GENERAL CONSTRUCTION                      5.495,82  12/24 L03/06/25 45041 - IVA acquisti                            7',
  '03/06/25 Nota accredito su fatt.acquisto n. Chiesa di San Domenico                                     24.981,00  FPR 8/25 03/06/25 61407 - Costi per pers.distacc.di terzi        8',
  '                                                                      T O T A L I      37.009,18        37.009,18',
]

test('GB Software: riconoscimento, conti, lati e quadratura', () => {
  expect(riconosciLettore(GB).id).toBe('gb')
  const r = leggiGiornale(GB)
  expect(r.diagnostica).toMatchObject({ formato: 'gb', movimenti: 8, registrazioniNonBilanciate: 0, checkpointOk: 2, checkpointKo: 0, righeMancanti: 0, latiIncertiNonRisolti: 0 })
  expect(r.saldi['41/00001/F']).toBe(-6512.36)
  expect(r.saldi['44/020/0']).toBe(5338)
  expect(r.saldi['41/00065/F']).toBe(30476.82)          // nota di credito: fornitore in Dare
  expect(r.saldi['61/407/0']).toBe(-24981)
  expect(r.saldi['50/105/0']).toBe(-20)
  const m = leggiMovimentiGiornale(GB)
  expect(m.filter((x) => x.chiudeSegmento).length).toBe(3)
  expect(m[0]).toMatchObject({ data: '01/01/2025', nDoc: '335', dtDoc: '31/12/2024' })
})

// GB Software, elenco registrazioni in prima nota: lato esplicito D/A, registrazione = progressivo, righe spezzate
const GB_PN = [
  '                                Elenco delle registrazioni in prima nota: Ditta 005 - UNIREST S.R.L. / Anno 2024',
  '                                          Num. doc.  Data doc. CO   Conto               Descrizione             D/A    Importo   Saldo Partite Imponibile Iva Iva                   Progressivo',
  '    31/12/2024                                     31/12/2024 00  10020    Capitale sociale/Patr.netto Apertura conA  600.000,00                      0,00 0,00               0,00    2024011',
  '                                                                           ti',
  '    31/12/2024                                     31/12/2024 00  50100    BPER Banca conto ordinario Apertura coD     50.000,00                      0,00 0,00               0,00    2024011',
  '                                                              00  400017   Condominio " VERONA" Amm.re Gabriel  D     550.000,00                      0,00 0,00               0,00    2024011',
  '    31/12/2024                                     31/12/2024 ',
  '                                                                           la Cichetti Apertura conti',
]

test('GB Software prima nota: saldi di apertura, righe spezzate', () => {
  expect(riconosciLettore(GB_PN).id).toBe('gb_prima_nota')
  const r = leggiGiornale(GB_PN)
  expect(r.diagnostica).toMatchObject({ movimenti: 3, registrazioniNonBilanciate: 0, registrazioniApertura: 1 })
  expect(r.saldi).toEqual({ '10/020/0': -600000, '50/100/0': 50000, '40/00017/C': 550000 })
  expect(r.movimentiMensili).toEqual({})                       // tutto apertura: nessun movimento del periodo
  expect(r.descrizioni['50/100/0']).toBe('BPER Banca conto ordinario')
  const m = leggiMovimentiGiornale(GB_PN)
  expect(m.every((x) => x.eApertura && x.data === '31/12/2024')).toBe(true)
})
