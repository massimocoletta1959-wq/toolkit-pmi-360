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

  test("apertura dei conti registrata in corso d'anno: esclusa dai flussi", () => {
    // bilancio di apertura del 2025 registrato a maggio contro il conto tecnico 55
    const ap = { ...mov('24/05/001/G', 1, 30000), data: '01/05/2026', mese: 5 }
    const ap55 = { ...mov('55/05/005/G', -1, 30000, true), data: '01/05/2026', mese: 5, descrizione: 'BILANCIO DI APERTURA' }
    const m = [mov('52/05/055/G', 1, 1000), mov('24/05/001/G', -1, 1000, true), ap, ap55]
    const r = calcolaFlussiCassa(m, { ...mappature, saldoInizialeEsterno: { importo: 30000, fonte: 'anno_precedente' } })
    expect(r.totaleEntrate[5]).toBeCloseTo(0, 2)              // l'apertura non e' un incasso
    expect(r.saldoFinePeriodo[12]).toBeCloseTo(29000, 2)      // 30.000 dall'anno precedente - 1.000 pagati
    expect(r.diagnostica.saldoIniziale.fonte).toBe('anno_precedente')
    expect(r.diagnostica.saldoIniziale.registrazioniApertura).toBe(1)
    expect(r.diagnostica.saldoIniziale.differenzaApertura).toBeCloseTo(0, 2)
  })

  test('senza apertura ne anno precedente il saldo iniziale e segnalato come mancante', () => {
    const r = calcolaFlussiCassa([mov('52/05/055/G', 1, 1000), mov('24/05/001/G', -1, 1000, true)], mappature)
    expect(r.diagnostica.saldoIniziale.fonte).toBe('mancante')
  })

  test('conto transitorio del gruppo 55: non e un apertura, il flusso resta', () => {
    const m = [{ ...mov('55/05/200/G', 1, 800), descrizione: 'CONTO TRANSITORIO' }, mov('24/05/001/G', -1, 800, true)]
    const r = calcolaFlussiCassa(m, mappature)
    expect(r.totaleUscite[1]).toBeCloseTo(800, 2)
    expect(r.diagnostica.saldoIniziale.registrazioniApertura).toBe(0)
  })
})
