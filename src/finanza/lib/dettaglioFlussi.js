// Dettaglio di entrate e uscite per la tabella Cash Flow di Tesoreria:
// raggruppamento leggibile (incassi da clienti, fornitori, F24, stipendi...) ->
// controparte -> singoli movimenti. Vale sia per i mesi reali (flussi
// dell'Analisi dei flussi, classificati sul conto di contropartita) sia per i
// mesi di proiezione (partite del piano di cassa).
//
// Le categorie dell'Analisi dei flussi sono spesso voci di bilancio ("7) Debiti
// verso fornitori", "13) Debiti verso istituti di previdenza...") o etichette
// libere delle mappature flussi: qui vengono ricondotte a pochi raggruppamenti
// di tesoreria, guardando anche la descrizione del conto di contropartita
// (es. "ERARIO C/RITENUTE" nel gruppo "Altri debiti" -> F24 imposte).

const round2 = (n) => Math.round(n * 100) / 100

export const GRUPPI = {
  giroconti: { entrata: 'Giroconti tra conti propri', uscita: 'Giroconti tra conti propri' },
  clienti: { entrata: 'Incassi da clienti', uscita: 'Rimborsi a clienti' },
  fornitori: { entrata: 'Rimborsi da fornitori', uscita: 'Pagamenti a fornitori' },
  personale: { entrata: 'Personale (rimborsi)', uscita: 'Stipendi e personale' },
  contributi: { entrata: 'Contributi INPS/INAIL (rimborsi)', uscita: 'Contributi INPS/INAIL (F24)' },
  imposte: { entrata: 'Rimborsi e crediti d\'imposta', uscita: 'Imposte e tasse (F24)' },
  soci: { entrata: 'Soci e amministratori', uscita: 'Soci e amministratori' },
  finanziamenti: { entrata: 'Finanziamenti ricevuti', uscita: 'Rate di mutui e finanziamenti' },
  banca: { entrata: 'Interessi e proventi bancari', uscita: 'Interessi e spese bancarie' },
  investimenti: { entrata: 'Disinvestimenti', uscita: 'Investimenti' },
  scorte: { entrata: 'Riduzione scorte', uscita: 'Scorte e acquisti a lotto' },
  altro: { entrata: 'Altre entrate', uscita: 'Altre uscite' },
  non_classificato: { entrata: 'Non classificato', uscita: 'Non classificato' },
}
// ordine delle righe nella tabella
const ORDINE = ['clienti', 'fornitori', 'personale', 'contributi', 'imposte', 'finanziamenti', 'banca', 'soci', 'investimenti', 'scorte', 'altro', 'giroconti', 'non_classificato']

const REGOLE = [
  ['contributi', /inps|inail|previdenz|enasarco|fondo pension|cassa edile/i],
  ['imposte', /erario|tributar|\biva\b|irpef|\bires\b|\birap\b|ritenut|imposte|imposta|\bf24\b|tasse|diritto camerale|\bimu\b/i],
  ['personale', /retribuz|stipend|salari|personale|dipendent|\btfr\b|collaborator/i],
  ['soci', /\bsoci\b|socio|amministrator|prelevament/i],
  ['finanziamenti', /mutu|finanziament|debiti verso banche|leasing|\brate\b|\brata\b|prestit/i],
  ['banca', /interess|commission|oneri finanziari|proventi finanziari|spese banc|competenze banc|bolli/i],
  ['clienti', /client|ricavi delle vendite|incassi clienti/i],
  ['fornitori', /fornitor|servizi|materie prime|godimento|affitt|locazion|energia|utenze|merci/i],
  ['investimenti', /immobilizzazion|investiment|cespit/i],
]

// Raggruppamento di un flusso reale (movimento dell'Analisi dei flussi, o la
// sola categoria per analisi salvate prima del dettaglio per contropartita).
export function gruppoFlussoReale({ categoria = '', conto = null, descrizione = '', direzione = null }) {
  if (categoria === 'Giroconto tra conti propri') return 'giroconti'
  if (/^Non classificato/.test(categoria)) return 'non_classificato'
  // sottoconti clienti/fornitori: la controparte e' un nome, non va interpretata
  if (conto && /\/C$/.test(conto)) return 'clienti'
  if (conto && /\/F$/.test(conto)) return 'fornitori'
  const testo = `${descrizione || ''} | ${categoria || ''}`
  // l'IVA incassata insieme ai corrispettivi/vendite fa parte dell'incasso dal cliente
  if (direzione === 'entrata' && /corrispett|iva (su )?vendite/i.test(testo)) return 'clienti'
  for (const [gruppo, re] of REGOLE) if (re.test(testo)) return gruppo
  return 'altro'
}

const GRUPPO_PROIEZIONE = {
  incassi_clienti: 'clienti', incassi_clienti_budget: 'clienti', crediti_aperti: 'clienti',
  pagamenti_fornitori: 'fornitori', fornitori_budget: 'fornitori', fornitori_energia: 'fornitori', debiti_aperti: 'fornitori',
  personale: 'personale', contributi: 'contributi', iva: 'imposte', imposte: 'imposte',
  rate_mutuo: 'finanziamenti', rate_finanziamenti: 'finanziamenti',
  investimenti: 'investimenti', scorte: 'scorte', riduzione_scorte: 'scorte',
}
export const gruppoFlussoProiezione = (categoria) => GRUPPO_PROIEZIONE[categoria] || 'altro'

export const etichettaGruppo = (gruppo, direzione) => (GRUPPI[gruppo] || GRUPPI.altro)[direzione]

// Voci elementari di un mese, nella stessa forma per reale e proiezione:
// { gruppo, chiave, controparte, importo, data, nota }
export function vociMeseReale(datiFlussi, mese, direzione) {
  if (datiFlussi?.movimentiFlussi) {
    return datiFlussi.movimentiFlussi
      .filter((f) => f.mese === mese && f.direzione === direzione)
      .map((f) => ({
        gruppo: gruppoFlussoReale(f),
        chiave: f.conto || f.descrizione || f.categoria,
        controparte: f.descrizione || f.conto || f.categoria,
        importo: f.importo,
        data: f.data,
        nota: f.categoria,
      }))
  }
  // analisi salvata prima del dettaglio per contropartita: solo le categorie
  const perCategoria = (direzione === 'entrata' ? datiFlussi?.entrate : datiFlussi?.uscite) || {}
  return Object.entries(perCategoria)
    .filter(([, mesi]) => mesi?.[mese])
    .map(([categoria, mesi]) => ({ gruppo: gruppoFlussoReale({ categoria }), chiave: categoria, controparte: categoria, importo: mesi[mese], data: null, nota: '' }))
}

export function vociMeseProiezione(mesePiano, direzione) {
  return (mesePiano?.dettaglio || [])
    .filter((v) => v.direzione === direzione)
    .map((v) => ({
      gruppo: gruppoFlussoProiezione(v.categoria),
      chiave: v.conto || v.controparte,
      controparte: v.controparte,
      importo: v.importo,
      data: v.data ? v.data.split('-').reverse().join('/') : null,
      nota: v.note,
    }))
}

// Totali per raggruppamento: { gruppo: importo }
export function totaliPerGruppo(voci) {
  const tot = {}
  for (const v of voci) tot[v.gruppo] = round2((tot[v.gruppo] || 0) + v.importo)
  return tot
}

// Raggruppamenti presenti in almeno un mese, nell'ordine di visualizzazione
export function gruppiPresenti(totaliMesi) {
  const presenti = new Set()
  for (const t of totaliMesi) for (const [g, v] of Object.entries(t || {})) if (Math.abs(v) >= 0.5) presenti.add(g)
  return ORDINE.filter((g) => presenti.has(g))
}

// Controparti di un raggruppamento in un mese, con i singoli movimenti,
// dalla piu' rilevante: [{ chiave, controparte, importo, movimenti: [...] }]
export function contropartiDelGruppo(voci, gruppo) {
  const perChiave = new Map()
  for (const v of voci) {
    if (v.gruppo !== gruppo) continue
    if (!perChiave.has(v.chiave)) perChiave.set(v.chiave, { chiave: v.chiave, controparte: v.controparte, importo: 0, movimenti: [] })
    const c = perChiave.get(v.chiave)
    c.importo = round2(c.importo + v.importo)
    c.movimenti.push(v)
  }
  const dataIso = (d) => (d ? d.split('/').reverse().join('-') : '')
  for (const c of perChiave.values()) c.movimenti.sort((a, b) => dataIso(a.data).localeCompare(dataIso(b.data)))
  return [...perChiave.values()].sort((a, b) => Math.abs(b.importo) - Math.abs(a.importo))
}
