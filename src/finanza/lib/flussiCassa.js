// Analisi dei flussi di cassa a partire dai movimenti dettagliati del Libro
// Giornale (vedi estraiMovimenti in libroGiornale.js). Per ogni movimento sui
// conti banca/cassa, individua la "contropartita" (il conto che ha generato
// l'entrata o l'uscita) e classifica il flusso per categoria, usando in ordine:
//   1) mappature_flussi_conti a livello di singolo conto (eccezioni verificate
//      manualmente sui movimenti reali, es. un conto "misto" che contiene sia
//      incassi per conto terzi sia rimborsi amministratori nello stesso gruppo);
//   2) mappature_flussi_conti a livello di gruppo di conto;
//   3) la classificazione CE/SP gia' presente in mappature_conti (gruppo di
//      conto), che pero' riflette la natura contabile (costo/ricavo/attivita'/
//      passivita') e non necessariamente un'etichetta di flusso di cassa leggibile.
// mappature_flussi_conti e' volutamente una tabella separata da mappature_conti:
// la stessa voce puo' avere una classificazione CE (es. imposta sostitutiva TFR
// = costo per il personale) diversa dalla categoria di flusso che ha senso
// mostrare qui (es. accorpata a "Personale" insieme al netto stipendi).
import { gruppoDiConto } from './libroGiornale'
import { eCodiceConto } from './mappatureConti'

function round2(n) {
  return Math.round(n * 100) / 100
}

function trovaEsatto(chiave, righe) {
  const cl = (chiave || '').toLowerCase()
  for (const r of righe) if ((r.conto_origine || '').toLowerCase() === cl) return r
  return null
}

function trovaSottostringa(chiave, righe) {
  const cl = (chiave || '').toLowerCase()
  for (const r of righe) if (cl.includes((r.conto_origine || '').toLowerCase())) return r
  return null
}

// Individua i gruppi di conto banca/cassa dalla riclassificazione gia' fatta
// dall'utente in Riclassificazione (codice_cee ATT_C_IV_1/2/3 = disponibilita'
// liquide), cosi' funziona automaticamente per qualsiasi azienda con un piano
// dei conti diverso, senza codificare codici conto specifici.
export function individuaGruppiBancaCassa(mappatureConti) {
  return new Set(mappatureConti.filter((m) => ['ATT_C_IV_1', 'ATT_C_IV_2', 'ATT_C_IV_3'].includes(m.codice_cee)).map((m) => m.conto_origine))
}

// Registrazione di apertura dei conti fatta in corso d'anno (es. bilancio di
// apertura del 2025 registrato il 01/05/2026): riconosciuta dal conto (es.
// 55/05/005 "BILANCIO DI APERTURA") o dalla causale. Non e' un flusso di cassa.
// NON basta il gruppo 55: contiene anche conti tecnici diversi (es. 55/05/200
// "CONTO TRANSITORIO", usato per normali fatture e pagamenti).
// mutui e finanziamenti (capitale o interessi) nella descrizione del conto o nella sua voce di riclassificazione
const RE_FINANZIAMENTO = /MUTU|FINANZIAMENT|DEBITI VERSO BANCHE|ALTRI FINANZIATORI|LEASING|PRESTIT/i
const RE_CAUSALE_APERTURA = /BILANCIO DI APERTURA|RIAPERTURA|\bAPE?RT?URA\s+CONTI/i   // anche "aperura conti" (refuso)
const eRegistrazioneApertura = (segmento) =>
  segmento.some((r) => RE_CAUSALE_APERTURA.test(r.chiave || '') || RE_CAUSALE_APERTURA.test(r.descrizione || ''))

// saldoInizialeEsterno: { importo, fonte: 'anno_precedente' | 'manuale', riferimento? }.
// Se presente prevale sull'apertura del giornale (il saldo di chiusura dell'anno
// precedente e' il dato affidabile); l'apertura del giornale resta come controllo.
const CODICI_LIQUIDITA = ['ATT_C_IV_1', 'ATT_C_IV_2', 'ATT_C_IV_3']
const RE_CONTO_BANCARIO = /\bBANCA\b|\bBANK\b|\bBANCO\b|\bBCC\b|\bC\/C\b|\bCC\b|CONTO CORRENTE|\bPOSTE\b|BANCOPOSTA|UNICREDIT|INTESA|BPER|MONTE DEI PASCHI|CREDITO COOP|CREDEM|FINECO|PAYPAL|SUMUP|SATISPAY/i
const RE_NON_LIQUIDO = /ANTICIP|MUTU|FINANZ|PRESTIT|S\.?B\.?F|PORTAF|LEASING|SPESE|COMMISSION|INTERESS|ONERI|RATE[IO]|FIDEJUSS/i

// Decide se un conto e' banca/cassa per i flussi: riclassificazione (gruppo o eccezione sul conto tra le
// disponibilita' liquide), poi la scelta dell'utente nell'Analisi dei flussi (includi/escludi), che prevale.
export function filtroBancaCassa({ mappatureContiAzienda, mappatureContiGlobali, mappatureFlussi }) {
  const gruppiBancaCassa = individuaGruppiBancaCassa([...mappatureContiAzienda, ...mappatureContiGlobali])
  const contiEsclusi = new Set(mappatureFlussi.filter((m) => m.escludi_da_banca_cassa).map((m) => m.conto_origine))
  const contiInclusi = new Set(mappatureFlussi.filter((m) => m.includi_in_banca_cassa).map((m) => m.conto_origine))
  const eccezioniLiquidita = new Map(
    mappatureContiAzienda.filter((m) => eCodiceConto(m.conto_origine)).map((m) => [m.conto_origine, CODICI_LIQUIDITA.includes(m.codice_cee)])
  )
  return (conto) => {
    if (contiEsclusi.has(conto)) return false
    if (contiInclusi.has(conto)) return true
    const eccezione = eccezioniLiquidita.get(conto)
    return eccezione !== undefined ? eccezione : gruppiBancaCassa.has(gruppoDiConto(conto))
  }
}

// Conti su cui chiedere conferma all'utente prima dell'analisi: conti patrimoniali non (ancora) banca/cassa e non
// gia' decisi, che sembrano conti bancari (descrizione) o sono riclassificati tra i debiti verso banche (es. conti
// correnti sempre sotto fido). Proposta: banca/cassa si', salvo anticipi, mutui, finanziamenti.
// Se nel periodo i movimenti su banca/cassa sono pochissimi rispetto alle registrazioni, l'analisi non puo' essere
// attendibile: si propongono anche i conti patrimoniali piu' movimentati, perche' l'utente indichi le banche.
export function contiBancariDaConfermare(movimenti, mappature) {
  const { mappatureContiAzienda, mappatureContiGlobali, mappatureFlussi } = mappature
  const isBancaCassa = filtroBancaCassa(mappature)
  const decisi = new Set(mappatureFlussi.filter((m) => m.includi_in_banca_cassa || m.escludi_da_banca_cassa).map((m) => m.conto_origine))
  const mappa = (conto) => trovaEsatto(conto, mappatureContiAzienda) || trovaEsatto(gruppoDiConto(conto), mappatureContiAzienda) || trovaSottostringa(gruppoDiConto(conto), mappatureContiGlobali)
  const conti = new Map()
  let movBanca = 0
  const registrazioni = new Set()
  for (const m of movimenti) {
    if (m.eApertura || m.eChiusura) continue
    registrazioni.add(`${m.data}|${m.chiave}`)
    if (isBancaCassa(m.conto)) { movBanca++; continue }
    const c = conti.get(m.conto) || { conto: m.conto, descrizione: m.descrizione || '', movimenti: 0 }
    c.movimenti++
    conti.set(m.conto, c)
  }
  const patrimoniale = (conto) => { const mp = mappa(conto); return !mp || ['attivita', 'passivita'].includes(mp.categoria) }
  const pochiMovimenti = registrazioni.size >= 20 && movBanca < registrazioni.size * 0.1
  const candidati = [...conti.values()].filter((c) => !decisi.has(c.conto) && patrimoniale(c.conto) && !/\/(C|F)$/.test(c.conto))
  const scelti = candidati.filter((c) => mappa(c.conto)?.codice_cee === 'PAS_D_4' || RE_CONTO_BANCARIO.test(c.descrizione))
  let elenco = scelti
  if (pochiMovimenti) {
    const altri = candidati.filter((c) => !scelti.includes(c)).sort((a, b) => b.movimenti - a.movimenti).slice(0, 10)
    elenco = [...scelti, ...altri]
  }
  return {
    pochiMovimenti, movimentiBanca: movBanca, registrazioni: registrazioni.size,
    conti: elenco.map((c) => ({
      ...c, voce: mappa(c.conto)?.voce_budget_descrizione || null,
      proposta: (mappa(c.conto)?.codice_cee === 'PAS_D_4' || RE_CONTO_BANCARIO.test(c.descrizione)) && !RE_NON_LIQUIDO.test(c.descrizione),
    })).sort((a, b) => b.movimenti - a.movimenti),
  }
}

export function calcolaFlussiCassa(movimenti, { mappatureContiAzienda, mappatureContiGlobali, mappatureFlussi, saldoInizialeEsterno = null }) {
  // eccezioni della riclassificazione sul singolo conto (vedi mappatureConti.js): un conto del gruppo banca/cassa
  // puo' essere stato riclassificato altrove, o viceversa; e le scelte dell'utente nell'Analisi dei flussi
  const isBancaCassa = filtroBancaCassa({ mappatureContiAzienda, mappatureContiGlobali, mappatureFlussi })

  // le righe che servono solo a includere/escludere un conto da banca/cassa non hanno una voce di flusso
  const flussiConVoce = mappatureFlussi.filter((m) => m.voce_flusso)
  const classifica = (conto) => {
    const gruppo = gruppoDiConto(conto)
    const flussoConto = trovaEsatto(conto, flussiConVoce)
    if (flussoConto) return flussoConto.voce_flusso
    const flussoGruppo = trovaEsatto(gruppo, flussiConVoce)
    if (flussoGruppo) return flussoGruppo.voce_flusso
    const mConto = trovaEsatto(conto, mappatureContiAzienda) || trovaEsatto(gruppo, mappatureContiAzienda)
    if (mConto) return mConto.voce_budget_descrizione || gruppo
    const mGlobale = trovaSottostringa(gruppo, mappatureContiGlobali)
    if (mGlobale) return mGlobale.voce_budget_descrizione || gruppo
    if (conto.endsWith('/C')) return 'Clienti (non mappato)'
    if (conto.endsWith('/F')) return 'Fornitori (non mappato)'
    return `${gruppo} (non mappato)`
  }

  // saldo di apertura sui conti banca/cassa: punto di partenza per ricavare le
  // disponibilita' liquide di fine mese dal flusso di cassa cumulato
  let aperturaGiornale = 0
  let righeAperturaBanca = 0
  for (const m of movimenti) {
    if (m.eApertura && isBancaCassa(m.conto)) { aperturaGiornale += m.segno * m.importo; righeAperturaBanca++ }
  }

  // "Segmenti" Dare=Avere bilanciati: si seguono le righe nell'ordine del Libro
  // Giornale e si chiude un segmento sulla riga marcata "*" nella colonna
  // Controp. (una registrazione puo' contenere piu' sotto-partite, es. piu'
  // tributi in un unico F24). NON si raggruppa per testo della riga: la
  // descrizione libera puo' cambiare tra le righe della stessa registrazione
  // (es. chiusura IVA con "iva vendite" / "iva corrispettivi" / "iva acquisti",
  // accredito con "POS" su una riga e il codice conto sull'altra), e spezzarla
  // la farebbe risultare sbilanciata. Per sicurezza il segmento si chiude anche
  // al cambio di data (registrazione senza "*").
  const segmenti = []
  let corrente = []
  for (const m of movimenti) {
    if (m.eApertura || m.eChiusura) continue
    if (corrente.length && corrente[0].data !== m.data) {
      segmenti.push(corrente)
      corrente = []
    }
    corrente.push(m)
    if (m.chiudeSegmento) {
      segmenti.push(corrente)
      corrente = []
    }
  }
  if (corrente.length) segmenti.push(corrente)

  // aperture registrate come movimenti (anche in corso d'anno): concorrono al saldo
  // di apertura del giornale e NON ai flussi del periodo
  let registrazioniApertura = 0
  const segmentiFlussi = []
  for (const seg of segmenti) {
    if (eRegistrazioneApertura(seg)) {
      registrazioniApertura++
      for (const r of seg) if (isBancaCassa(r.conto)) { aperturaGiornale += r.segno * r.importo; righeAperturaBanca++ }
    } else segmentiFlussi.push(seg)
  }
  aperturaGiornale = round2(aperturaGiornale)
  const aperturaPresente = righeAperturaBanca > 0

  let fonteSaldoIniziale, saldoIniziale
  if (saldoInizialeEsterno && saldoInizialeEsterno.importo != null && !isNaN(saldoInizialeEsterno.importo)) {
    saldoIniziale = round2(Number(saldoInizialeEsterno.importo))
    fonteSaldoIniziale = saldoInizialeEsterno.fonte || 'manuale'
  } else if (aperturaPresente) {
    saldoIniziale = aperturaGiornale
    fonteSaldoIniziale = 'apertura_giornale'
  } else {
    saldoIniziale = 0
    fonteSaldoIniziale = 'mancante'
  }
  const ultimaData = movimenti.reduce((max, m) => {
    const [g, me, a] = (m.data || '').split('/'); const iso = a && `${a}-${me}-${g}`
    return iso && iso > max ? iso : max
  }, '')

  let segmentiNonBilanciati = 0
  const flussi = [] // { mese, categoria, importo, direzione, data, conto, descrizione } — conto = contropartita

  for (const segmento of segmentiFlussi) {
    const somma = round2(segmento.reduce((s, r) => s + r.segno * r.importo, 0))
    if (Math.abs(somma) > 0.02) segmentiNonBilanciati++

    const legsBanca = segmento.filter((r) => isBancaCassa(r.conto))
    if (!legsBanca.length) continue

    // Invariante: la somma dei flussi di un segmento e' uguale al movimento
    // netto dei conti banca/cassa del segmento (ogni riga conta una sola volta).
    const usate = new Set()

    // 1) abbinamenti 1:1 per importo identico e segno opposto (ogni riga usata
    //    una volta sola); due conti banca/cassa abbinati = giroconto tra conti propri
    for (const bancaLeg of legsBanca) {
      if (usate.has(bancaLeg)) continue
      const c = segmento.find((r) => r !== bancaLeg && !usate.has(r) && r.segno === -bancaLeg.segno && Math.abs(r.importo - bancaLeg.importo) < 0.01)
      if (!c) continue
      usate.add(bancaLeg); usate.add(c)
      const direzioneBanca = bancaLeg.segno > 0 ? 'entrata' : 'uscita'
      if (isBancaCassa(c.conto)) {
        flussi.push({ mese: bancaLeg.mese, categoria: 'Giroconto tra conti propri', importo: bancaLeg.importo, direzione: direzioneBanca, data: bancaLeg.data, conto: c.conto, descrizione: c.descrizione })
        flussi.push({ mese: c.mese, categoria: 'Giroconto tra conti propri', importo: c.importo, direzione: c.segno > 0 ? 'entrata' : 'uscita', data: c.data, conto: bancaLeg.conto, descrizione: bancaLeg.descrizione })
      } else {
        flussi.push({ mese: bancaLeg.mese, categoria: classifica(c.conto), importo: bancaLeg.importo, direzione: direzioneBanca, data: bancaLeg.data, conto: c.conto, descrizione: c.descrizione })
      }
    }

    // 2) parte composita (es. F24 con piu' tributi, stipendi cumulativi): il NETTO
    //    dei movimenti bancari rimasti viene ripartito UNA volta sola tra le voci
    //    non bancarie rimaste, nella direzione del netto; una voce con polarita'
    //    anomala (es. credito d'imposta compensato nell'F24) ne riduce il netto.
    const bancaResto = legsBanca.filter((r) => !usate.has(r))
    if (!bancaResto.length) continue
    const netto = round2(bancaResto.reduce((s, r) => s + r.segno * r.importo, 0))
    if (Math.abs(netto) < 0.005) continue
    const segnoNetto = netto > 0 ? 1 : -1
    const direzione = segnoNetto > 0 ? 'entrata' : 'uscita'
    const mese = bancaResto[0].mese
    const nonBancaResto = segmento.filter((r) => !usate.has(r) && !isBancaCassa(r.conto))
    if (!nonBancaResto.length) {
      flussi.push({ mese, categoria: 'Non classificato (contropartita non trovata)', importo: Math.abs(netto), direzione, data: bancaResto[0].data, conto: null, descrizione: bancaResto[0].chiave || '' })
      continue
    }
    for (const leg of nonBancaResto) {
      const contributo = round2(-leg.segno * segnoNetto * leg.importo)
      if (Math.abs(contributo) < 0.005) continue
      const categoria = classifica(leg.conto)
      // Mutuo o finanziamento estinto/accollato dentro un incasso (es. vendita di un immobile con accollo del mutuo da
      // parte dell'acquirente): l'incasso dal cliente resta per intero e la quota del mutuo (capitale e interessi) e'
      // un'uscita per rate di finanziamento, non una riduzione dell'incasso. Le altre righe di polarita' opposta
      // (es. credito d'imposta compensato in un F24) restano a riduzione del netto.
      if (contributo < 0 && RE_FINANZIAMENTO.test(`${categoria} ${leg.descrizione || ''}`)) {
        flussi.push({ mese, categoria, importo: -contributo, direzione: direzione === 'entrata' ? 'uscita' : 'entrata', data: leg.data, conto: leg.conto, descrizione: leg.descrizione })
        continue
      }
      flussi.push({ mese, categoria, importo: contributo, direzione, data: leg.data, conto: leg.conto, descrizione: leg.descrizione })
    }
  }

  const entrate = {}
  const uscite = {}
  for (const f of flussi) {
    const dest = f.direzione === 'entrata' ? entrate : uscite
    if (!dest[f.categoria]) dest[f.categoria] = {}
    dest[f.categoria][f.mese] = round2((dest[f.categoria][f.mese] || 0) + f.importo)
  }

  const totMese = (perCategoria, mese) => round2(Object.values(perCategoria).reduce((s, v) => s + (v[mese] || 0), 0))
  const totaleEntrate = {}
  const totaleUscite = {}
  const saldoMese = {}
  const flussoCassaCumulato = {}
  const saldoFinePeriodo = {}
  let cumulato = 0
  for (let mese = 1; mese <= 12; mese++) {
    totaleEntrate[mese] = totMese(entrate, mese)
    totaleUscite[mese] = totMese(uscite, mese)
    saldoMese[mese] = round2(totaleEntrate[mese] - totaleUscite[mese])
    cumulato = round2(cumulato + saldoMese[mese])
    flussoCassaCumulato[mese] = cumulato
    saldoFinePeriodo[mese] = round2(saldoIniziale + cumulato)
  }

  return {
    saldoIniziale,
    entrate,
    uscite,
    totaleEntrate,
    totaleUscite,
    saldoMese,
    flussoCassaCumulato,
    saldoFinePeriodo,
    // ogni singolo flusso con la sua contropartita: base per il dettaglio
    // (raggruppamento -> controparte -> movimenti) in Tesoreria
    movimentiFlussi: flussi.map((f) => ({ ...f, importo: round2(f.importo) })),
    diagnostica: {
      segmenti: segmenti.length, segmentiNonBilanciati, ultimaData,
      saldoIniziale: {
        fonte: fonteSaldoIniziale,                       // anno_precedente | manuale | apertura_giornale | mancante
        riferimento: saldoInizialeEsterno?.riferimento || null,
        aperturaGiornale: aperturaPresente ? aperturaGiornale : null,
        registrazioniApertura,                           // aperture registrate come movimenti (escluse dai flussi)
        differenzaApertura: aperturaPresente && fonteSaldoIniziale !== 'apertura_giornale' ? round2(saldoIniziale - aperturaGiornale) : null,
      },
    },
  }
}
