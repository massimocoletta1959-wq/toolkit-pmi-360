import { calcolaFlussiCassa } from './flussiCassa'

// il lettore PDF non serve a questi test (e Jest di CRA non carica i suoi moduli ESM)
jest.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }))

// Invariante dell'Analisi dei flussi: per ogni mese, entrate - uscite deve essere
// uguale al movimento netto reale dei conti banca/cassa (ogni riga conta una volta).

const mappature = {
  mappatureContiAzienda: [{ conto_origine: '24/05/G', codice_cee: 'ATT_C_IV_1', categoria: 'attivita' }],
  mappatureContiGlobali: [],
  mappatureFlussi: [],
}
const mov = (conto, segno, importo, chiudeSegmento = false) => ({
  data: '16/01/2026', mese: 1, conto, descrizione: '', segno, importo, chiave: 'x',
  eApertura: false, eChiusura: false, chiudeSegmento, nDoc: null, dtDoc: null,
})
const nettoBanca = (movimenti) => movimenti.filter((m) => m.conto.startsWith('24/05/')).reduce((s, m) => s + m.segno * m.importo, 0)

describe('calcolaFlussiCassa', () => {
  test('registrazione composita con piu movimenti di banca: nessun doppio conteggio', () => {
    // stipendi pagati con due bonifici da due banche, a fronte di tre dipendenti
    const m = [
      mov('52/05/055/G', 1, 1000), mov('52/05/055/G', 1, 1500), mov('52/05/055/G', 1, 700),
      mov('24/05/001/G', -1, 2000), mov('24/05/002/G', -1, 1200, true),
    ]
    const r = calcolaFlussiCassa(m, mappature)
    expect(r.saldoMese[1]).toBeCloseTo(nettoBanca(m), 2)   // -3200, non -6400
    expect(r.totaleUscite[1]).toBeCloseTo(3200, 2)
  })

  test('abbinamenti 1:1 e parte composita nella stessa registrazione', () => {
    // F24: un tributo pagato con importo identico + altri tributi cumulati
    const m = [
      mov('48/05/080/G', 1, 500), mov('24/05/001/G', -1, 500),
      mov('48/05/085/G', 1, 300), mov('48/05/105/G', 1, 200), mov('24/05/002/G', -1, 500, true),
    ]
    const r = calcolaFlussiCassa(m, mappature)
    expect(r.saldoMese[1]).toBeCloseTo(nettoBanca(m), 2)   // -1000
  })

  test('giroconto tra conti propri: netto zero', () => {
    const m = [mov('24/05/001/G', -1, 5000), mov('24/05/002/G', 1, 5000, true)]
    const r = calcolaFlussiCassa(m, mappature)
    expect(r.saldoMese[1]).toBeCloseTo(0, 2)
    expect(r.entrate['Giroconto tra conti propri'][1]).toBeCloseTo(5000, 2)
    expect(r.uscite['Giroconto tra conti propri'][1]).toBeCloseTo(5000, 2)
  })
})
