import { leggiBilancioAnalitico } from './index'
import { proposteDaBilancio, statoProposta } from './abbina'

const riga = (sx, dx) => {
  const parte = (v) => (v ? `${v[0].padEnd(16)}${v[1].padEnd(36)}${v[2].padStart(14)}` : ''.padEnd(66))
  return `${parte(sx)}   ${parte(dx)}`.trimEnd()
}
const BILANCIO = [
  '                       STATO PATRIMONIALE        DAL 01/01/2025 AL 31/12/2025',
  ` ATTIVITA'${' '.repeat(60)}PASSIVITA'`,
  riga(['3 / 15', 'DIRITTI BREVETTO E UTILIZZAZIONE', '700,63'], ['3 / 15', 'DIRITTI BREVETTO E UTILIZZAZIONE', '700,63']),
  riga(['3 / 15 / 4', "Programmi software in proprieta'", '700,63'], ['3 / 15 / 104', "F.do amm.software in proprieta'", '700,63']),
  riga(['9', 'CLIENTI', '83.568,87'], ['22', 'FORNITORI', '265.642,66']),
  riga(['9 / 5', 'CLIENTI', '83.568,87'], ['22 / 5', 'FORNITORI', '89.494,30']),
  riga(['22', 'FORNITORI', '93.551,88'], ['23 / 115', 'DEBITI TRIBUTARI ENTRO 12 MESI', '283.651,41']),
  riga(['22 / 5', 'FORNITORI', '93.551,88'], null),
  "             TOTALE ATTIVITA'                         178.522,38             TOTALE PASSIVITA'          375.140,01",
  '                       CONTO ECONOMICO DAL 01/01/2025 AL 31/12/2025',
  ` COSTI${' '.repeat(63)}RICAVI`,
  riga(['29 / 10', 'COSTI PER SERVIZI (COMMERCIALI)', '16.930,10'], ['45', 'RIMANENZE FINALI', '7.843,03']),
  riga(['36 / 10', 'RIM.INIZ.MERCI,AGGI,PRODOTTI,OPERE', '130.600,00'], ['45 / 10', 'RIMAN.FINALI MERCI,AGGI,PROD.,OPERE', '7.843,03']),
  riga(['33 / 10', 'ONERI SOCIALI', '7.937,41'], ['44 / 5', 'RICAVI DELLE VENDITE ITALIA', '1.531.146,88']),
]

describe('bilancio analitico Buffetti e abbinamento', () => {
  test('legge sezioni, lati, livelli e totali', () => {
    const b = leggiBilancioAnalitico(BILANCIO)
    expect(b.anno).toBe(2025)
    expect(b.totali.totale_attivita).toBeCloseTo(178522.38, 2)
    const fondo = b.voci.find((v) => v.codice === '3/15/104')
    expect(fondo).toMatchObject({ sezione: 'SP', lato: 'passivita', livello: 3, importo: 700.63 })
    expect(b.voci.find((v) => v.codice === '44/5')).toMatchObject({ sezione: 'CE', lato: 'ricavi', livello: 2 })
  })

  test('propone le voci: fondi netti nel bene, fornitori con anticipi, servizi commerciali, rimanenze', () => {
    const p = Object.fromEntries(proposteDaBilancio(leggiBilancioAnalitico(BILANCIO)).map((x) => [x.gruppo, x]))
    expect(p['3/15']).toMatchObject({ proposta: 'sp:ATT_B_I_3', saldo: 0 })          // bene meno fondo
    expect(p['9/5'].proposta).toBe('sp:ATT_C_II_1')
    expect(p['22/5']).toMatchObject({ proposta: 'sp:PAS_D_7', lato: 'passivita' })    // anticipi in Dare > debiti
    expect(p['23/115'].proposta).toBe('sp:PAS_D_12')
    expect(p['29/10'].proposta).toBe('cee:B7')                                        // "COMMERCIALI" non e' merci
    expect(p['36/10'].proposta).toBe('cee:B11')                                       // rimanenze iniziali
    expect(p['45/10'].proposta).toBe('cee:B11')                                       // rimanenze finali
    expect(p['33/10'].proposta).toBe('cee:B9b')
    expect(p['44/5'].proposta).toBe('cee:A1')
  })

  test('stato rispetto alla classificazione attuale', () => {
    expect(statoProposta('cee:B7', '')).toBe('nuovo')
    expect(statoProposta('cee:B7', 'cee:B7')).toBe('uguale')
    expect(statoProposta('cee:B7', 'cee:B6')).toBe('diverso')
    expect(statoProposta(null, '')).toBe('da_scegliere')
  })
})

test('conti bancari a saldo passivo: eccezione verso i debiti verso banche, non compensati', () => {
  const B = [
    '                       STATO PATRIMONIALE        DAL 01/01/2025 AL 31/12/2025',
    ` ATTIVITA'${' '.repeat(60)}PASSIVITA'`,
    riga(['15 / 5', 'DEPOSITI BANCARI E POSTALI', '457.039,31'], ['15 / 5', 'DEPOSITI BANCARI E POSTALI', '198.133,34']),
    riga(['15 / 5 / 1', 'UNICREDIT C/ordinario', '333.048,19'], ['15 / 5 / 5003', 'UNICREDIT C/anticipi', '196.264,62']),
  ]
  const g = proposteDaBilancio(leggiBilancioAnalitico(B)).find((x) => x.gruppo === '15/5')
  expect(g.proposta).toBe('sp:ATT_C_IV_1')
  expect(g.conti).toEqual([expect.objectContaining({ conto: '15/5/5003', proposta: 'sp:PAS_D_4', saldo: -196264.62 })])
})

test('bilancio di esercizio AS/400: conti di 12 cifre, gruppi GG/SSSS, totali e finanziamento tra le passivita\' delle banche', () => {
  const r = (sx, dx) => `${(sx || '').padEnd(87)}${dx || ''}`.trimEnd()
  const B = [
    'Asap Logistics S.r.l.            Bilancio di esercizio dal       1/01/26    al       31/08/26                            Pagina    1',
    '--------------------------------------- ATTIVITA  ---------------------------------     ---------------------------------  PASSIVITA  -------------------------------------',
    'Codice conto Descrizione------------------------ Saldi----------- Totali-----------    Codice conto Descrizione------------------------ Saldi------------ Totali-----------',
    r('010707000008 Autovetture e autocarri                     74.809,51', '090303000006 Erario c/IRES                               18.523,00'),
    r('130303000001 UNICREDIT 6608312                          291.975,28', '130303000007 Finanziamento fondo centrale di gar        100.000,00        100.000,00'),
    r('130303000005 PREPAGATA -6260                              1.447,25       293.422,53', "310202000100 Utile   d'esercizio                        127.858,30        127.858,30"),
    r('                                      Totale attività                      367.704,04', '                                 Totale passività                   246.381,30'),
    'Asap Logistics S.r.l.            Bilancio di esercizio dal       1/01/26    al       31/08/26                            Pagina    2',
    '--------------------------------------- COSTI -------------------------------------    -----------------------------------   RICAVI   ---------------------------------------',
    'Codice conto Descrizione------------------------ Saldi----------- Totali-----------    Codice conto Descrizione------------------------ Saldi------------ Totali-----------',
    r('662001000009 SPESE DI RAPPRESENTANZA 1                     224,50', '500101000001 Ricavi di spedizione                     441.337,05        441.337,05'),
  ]
  const b = leggiBilancioAnalitico(B)
  expect(b).toMatchObject({ formato: 'as400', anno: 2026 })
  expect(b.totali).toMatchObject({ totale_attivita: 367704.04, totale_passivita: 246381.3 })
  expect(b.voci.find((v) => v.codice === '13/0303/000007')).toMatchObject({ sezione: 'SP', lato: 'passivita', livello: 3, importo: 100000 })
  expect(b.voci.find((v) => v.codice === '66/2001/000009')).toMatchObject({ descrizione: 'SPESE DI RAPPRESENTANZA 1', importo: 224.5 })
  const p = Object.fromEntries(proposteDaBilancio(b).map((x) => [x.gruppo, x]))
  expect(p['13/0303']).toMatchObject({ proposta: 'sp:ATT_C_IV_1', descrizione: 'UNICREDIT 6608312', saldo: 193422.53 })
  expect(p['13/0303'].conti).toEqual([expect.objectContaining({ conto: '13/0303/000007', proposta: 'sp:PAS_D_4' })])
  expect(p['01/0707'].proposta).toBe('sp:ATT_B_II_4')
  expect(p['09/0303'].proposta).toBe('sp:PAS_D_12')
  expect(p['50/0101'].proposta).toBe('cee:A1')
})

// GB Software: mastri di 2 cifre, conti numerici, clienti e fornitori solo come mastro, codice attaccato alla descrizione
const GB = [
  '                                                         * BILANCIO *                          dal 01/01/2026 al 31/08/2026',
  '                       ATTIVITÀ                  STATO PATRIMONIALE                                PASSIVITÀ',
  '21       Immobilizzazioni materiali             1.100,00      21       Immobilizzazioni materiali              400,00',
  '21300    Autoveicoli da trasporto                1.100,00     21380    Fondi amm/to autov.da trasp.             300,00',
  '40       Clienti                                   500,00     21382100Fondo amm/to di periodo                   100,00',
  '22020    Partec.in società control.non quota       50,00      41       Fornitori                                600,00',
  '         TOTALE                                  1.650,00               TOTALE                                1.000,00',
  '                                                                        UTILE DI ESERCIZIO                      650,00',
  '                        COSTI                      CONTO ECONOMICO                                     RICAVI',
  '61100    Contributi Inps                           150,00     70140    Prestazioni di servizi                   800,00',
  '         TOTALE                                    150,00               TOTALE                                  800,00',
]

test('bilancio analitico GB Software: lati, gruppi e proposte', () => {
  const b = leggiBilancioAnalitico(GB)
  expect(b).toMatchObject({ formato: 'gb', anno: 2026, totali: { totale_attivita: 1650, totale_passivita: 1000, utile_desercizio: 650, totale_costi: 150, totale_ricavi: 800 } })
  const voce = (codice, liv) => b.voci.find((v) => v.codice === codice && v.livello === liv)
  expect(voce('21/300/0', 3)).toMatchObject({ lato: 'attivita', importo: 1100 })
  expect(voce('21/382/100', 3)).toMatchObject({ lato: 'passivita', descrizione: 'Fondo amm/to di periodo' })
  expect(voce('40/C', 2)).toMatchObject({ lato: 'attivita', importo: 500 })
  expect(voce('41/F', 2)).toMatchObject({ lato: 'passivita', importo: 600 })
  const p = Object.fromEntries(proposteDaBilancio(b).map((x) => [x.gruppo, x]))
  expect(p['21/380']).toMatchObject({ proposta: 'sp:ATT_B_II_4', lato: 'attivita', saldo: -300 })   // fondo: rettifica del bene
  expect(p['22/020'].proposta).toBe('sp:ATT_B_III_1A')
  expect(p['61/100'].proposta).toBe('cee:B9b')
  expect(p['70/140'].proposta).toBe('cee:A1')
})
