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

describe('bilancio analitico Seasoft e abbinamento', () => {
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
