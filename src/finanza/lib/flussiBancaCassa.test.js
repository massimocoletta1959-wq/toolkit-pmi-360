import { calcolaFlussiCassa, contiBancariDaConfermare } from './flussiCassa'

// il lettore PDF non serve a questi test (e Jest di CRA non carica i suoi moduli ESM)
jest.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }))

// conto corrente sempre sotto fido riclassificato tra i debiti verso banche (gruppo 15/5), cassa tra le liquidita'
const mappatureContiAzienda = [
  { conto_origine: '15/5', categoria: 'passivita', codice_cee: 'PAS_D_4', voce_budget_descrizione: '4) Debiti verso banche' },
  { conto_origine: '15/15', categoria: 'attivita', codice_cee: 'ATT_C_IV_3', voce_budget_descrizione: '3) Denaro e valori in cassa' },
  { conto_origine: '23/135', categoria: 'passivita', codice_cee: 'PAS_D_14', voce_budget_descrizione: '14) Altri debiti' },
]
const mov = (data, conto, descrizione, segno, importo, ultimo = false) => ({ data, mese: Number(data.slice(3, 5)), conto, descrizione, segno, importo, chiave: 'MOVIMENTI DIVERSI', chiudeSegmento: ultimo })
const movimenti = []
for (let i = 1; i <= 25; i++) {
  const g = String(i).padStart(2, '0')
  movimenti.push(mov(`${g}/02/2026`, '23/135/9', 'Debiti salari', 1, 1000), mov(`${g}/02/2026`, '15/5/5003', 'Unicredit Banca c/c 365113', -1, 1000, true))
}
movimenti.push(mov('10/03/2026', '15/5/5003', 'Unicredit Banca c/c 365113', 1, 5000), mov('10/03/2026', '15/5/5006', 'Bcc c/anticipi', -1, 5000, true))

test('chiede i conti bancari esposti tra i debiti verso banche, proponendo no per gli anticipi', () => {
  const r = contiBancariDaConfermare(movimenti, { mappatureContiAzienda, mappatureContiGlobali: [], mappatureFlussi: [] })
  expect(r.pochiMovimenti).toBe(true)
  const c = Object.fromEntries(r.conti.map((x) => [x.conto, x.proposta]))
  expect(c['15/5/5003']).toBe(true)
  expect(c['15/5/5006']).toBe(false)
  expect(c['23/135/9']).toBe(false)    // proposto (pochi movimenti) ma non come banca
})

test('dopo la conferma: stipendi in uscita, anticipo come entrata da finanziamento', () => {
  const mappatureFlussi = [
    { conto_origine: '15/5/5003', voce_flusso: '', includi_in_banca_cassa: true, escludi_da_banca_cassa: false },
    { conto_origine: '15/5/5006', voce_flusso: '', includi_in_banca_cassa: false, escludi_da_banca_cassa: true },
  ]
  const mp = { mappatureContiAzienda, mappatureContiGlobali: [], mappatureFlussi }
  expect(contiBancariDaConfermare(movimenti, mp).conti.length).toBe(0)
  const r = calcolaFlussiCassa(movimenti, mp)
  expect(r.totaleUscite['2']).toBe(25000)
  expect(r.totaleEntrate['3']).toBe(5000)
})

test('incasso con accollo del mutuo: clienti per intero in entrata, quota del mutuo in uscita tra le rate', () => {
  const mp = { mappatureContiAzienda: [
    { conto_origine: '50/102', categoria: 'attivita', codice_cee: 'ATT_C_IV_1', voce_budget_descrizione: '1) Depositi bancari e postali' },
    { conto_origine: '14/001', categoria: 'passivita', codice_cee: 'PAS_D_4', voce_budget_descrizione: '4) Debiti verso banche' },
    { conto_origine: '40/C', categoria: 'attivita', codice_cee: 'ATT_C_II_1', voce_budget_descrizione: '1) Verso clienti' },
    { conto_origine: '64/309', categoria: 'costi', codice_cee: 'C17', voce_budget_descrizione: '17) Interessi e altri oneri finanziari' },
  ], mappatureContiGlobali: [], mappatureFlussi: [] }
  const r = (conto, descrizione, segno, importo, ultimo = false) => ({ data: '25/08/2026', mese: 8, conto, descrizione, segno, importo, chiave: 'Riscossa fattura', chiudeSegmento: ultimo })
  const movimenti = [
    r('50/102/0', 'Banca Popolare Emilia-Romagna', 1, 164873.21),
    r('40/04398/C', 'SECONDINI Lucio', -1, 95002), r('40/04399/C', "D'ASCANIO Giovanna", -1, 95002),
    r('14/001/01', 'Debiti mutui ipotecari BPER O/12m', 1, 24046.19),
    r('64/309/0', 'Inter.passivi su finanziamenti', 1, 1080.6),
    r('63/240/0', 'Arrotondamenti', 1, 4, true),                  // resta a riduzione dell'incasso
  ]
  const res = calcolaFlussiCassa(movimenti, mp)
  expect(res.totaleEntrate[8]).toBe(190000)
  expect(res.totaleUscite[8]).toBe(25126.79)
  expect(res.saldoMese[8]).toBe(164873.21)        // = movimento netto della banca
})
