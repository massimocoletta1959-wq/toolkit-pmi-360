import { gruppoFlussoReale, vociMeseReale, vociMeseProiezione, totaliPerGruppo, gruppiPresenti, contropartiDelGruppo } from './dettaglioFlussi'

describe('dettaglioFlussi', () => {
  test('raggruppamenti dai conti di contropartita e dalle categorie', () => {
    expect(gruppoFlussoReale({ categoria: '7) Debiti verso fornitori', conto: '40/00012/F', descrizione: 'SYNERGIE ITALIA S.P.A.' })).toBe('fornitori')
    expect(gruppoFlussoReale({ categoria: '1) Verso clienti', conto: '14/00090/C', descrizione: 'ROSSI SRL' })).toBe('clienti')
    expect(gruppoFlussoReale({ categoria: '14) Altri debiti', conto: '48/05/080/G', descrizione: 'ERARIO C/RITENUTE LAV. DIPENDENTI' })).toBe('imposte')
    expect(gruppoFlussoReale({ categoria: '14) Altri debiti', conto: '48/10/005/G', descrizione: 'DIPENDENTI C/RETRIBUZIONI' })).toBe('personale')
    expect(gruppoFlussoReale({ categoria: '13) Debiti verso istituti di previdenza e sicurezza sociale', conto: '48/15/001/G', descrizione: 'INPS C/CONTRIBUTI' })).toBe('contributi')
    expect(gruppoFlussoReale({ categoria: 'Soci c/finanziamenti' })).toBe('soci')
    expect(gruppoFlussoReale({ categoria: 'Rate mutuo' })).toBe('finanziamenti')
    expect(gruppoFlussoReale({ categoria: 'Ratei passivi' })).toBe('altro')
    expect(gruppoFlussoReale({ categoria: 'Giroconto tra conti propri', conto: '24/05/002/G' })).toBe('giroconti')
  })

  test('mese reale: raggruppamenti, controparti e movimenti', () => {
    const dati = {
      movimentiFlussi: [
        { mese: 11, direzione: 'uscita', categoria: '7) Debiti verso fornitori', conto: '40/1/F', descrizione: 'A2A', importo: 1030, data: '26/11/2026' },
        { mese: 11, direzione: 'uscita', categoria: '7) Debiti verso fornitori', conto: '40/1/F', descrizione: 'A2A', importo: 500, data: '05/11/2026' },
        { mese: 11, direzione: 'uscita', categoria: '12) Debiti tributari', conto: '48/1/G', descrizione: 'ERARIO C/IVA', importo: 800, data: '16/11/2026' },
        { mese: 10, direzione: 'uscita', categoria: '7) Debiti verso fornitori', conto: '40/2/F', descrizione: 'ALTRO', importo: 99, data: '01/10/2026' },
      ],
    }
    const voci = vociMeseReale(dati, 11, 'uscita')
    expect(totaliPerGruppo(voci)).toEqual({ fornitori: 1530, imposte: 800 })
    const [a2a] = contropartiDelGruppo(voci, 'fornitori')
    expect(a2a.importo).toBe(1530)
    expect(a2a.movimenti.map((m) => m.data)).toEqual(['05/11/2026', '26/11/2026'])
  })

  test('analisi salvata senza dettaglio: solo categorie', () => {
    const voci = vociMeseReale({ uscite: { 'INPS/INAIL': { 3: 400 }, Personale: { 3: 2000, 4: 10 } } }, 3, 'uscita')
    expect(totaliPerGruppo(voci)).toEqual({ contributi: 400, personale: 2000 })
  })

  test('mese di proiezione e ordine dei raggruppamenti', () => {
    const mese = { dettaglio: [
      { direzione: 'uscita', categoria: 'iva', controparte: 'Erario — IVA mensile', importo: 300, data: '2026-12-16' },
      { direzione: 'uscita', categoria: 'debiti_aperti', controparte: 'A2A', conto: '40/1/F', importo: 1030, data: '2026-11-26' },
      { direzione: 'entrata', categoria: 'incassi_clienti_budget', controparte: 'Clienti — budget 2026', importo: 1000, data: '2026-12-31' },
    ] }
    const usc = vociMeseProiezione(mese, 'uscita')
    expect(totaliPerGruppo(usc)).toEqual({ imposte: 300, fornitori: 1030 })
    expect(usc.find((v) => v.gruppo === 'imposte').data).toBe('16/12/2026')
    expect(gruppiPresenti([{ imposte: 1 }, { fornitori: 2, giroconti: 3 }])).toEqual(['fornitori', 'imposte', 'giroconti'])
  })
})

test("IVA sui corrispettivi incassata: fa parte dell'incasso da clienti", () => {
  expect(gruppoFlussoReale({ categoria: '12) Debiti tributari', conto: '48/05/020/G', descrizione: 'IVA SU CORRISPETTIVI', direzione: 'entrata' })).toBe('clienti')
  expect(gruppoFlussoReale({ categoria: '12) Debiti tributari', conto: '48/05/020/G', descrizione: 'ERARIO C/IVA', direzione: 'uscita' })).toBe('imposte')
})
