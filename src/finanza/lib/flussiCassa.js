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

export function calcolaFlussiCassa(movimenti, { mappatureContiAzienda, mappatureContiGlobali, mappatureFlussi }) {
  const gruppiBancaCassa = individuaGruppiBancaCassa([...mappatureContiAzienda, ...mappatureContiGlobali])

  const contiEsclusi = new Set(mappatureFlussi.filter((m) => m.escludi_da_banca_cassa).map((m) => m.conto_origine))
  // eccezioni della riclassificazione sul singolo conto (vedi mappatureConti.js):
  // un conto del gruppo banca/cassa puo' essere stato riclassificato altrove, o
  // viceversa un conto di un altro gruppo essere una disponibilita' liquida
  const eccezioniLiquidita = new Map(
    mappatureContiAzienda.filter((m) => eCodiceConto(m.conto_origine)).map((m) => [m.conto_origine, ['ATT_C_IV_1', 'ATT_C_IV_2', 'ATT_C_IV_3'].includes(m.codice_cee)])
  )
  const isBancaCassa = (conto) => {
    const eccezione = eccezioniLiquidita.get(conto)
    const liquido = eccezione !== undefined ? eccezione : gruppiBancaCassa.has(gruppoDiConto(conto))
    return liquido && !contiEsclusi.has(conto)
  }

  const classifica = (conto) => {
    const gruppo = gruppoDiConto(conto)
    const flussoConto = trovaEsatto(conto, mappatureFlussi)
    if (flussoConto) return flussoConto.voce_flusso
    const flussoGruppo = trovaEsatto(gruppo, mappatureFlussi)
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
  let saldoIniziale = 0
  for (const m of movimenti) {
    if (m.eApertura && isBancaCassa(m.conto)) saldoIniziale += m.segno * m.importo
  }
  saldoIniziale = round2(saldoIniziale)

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

  let segmentiNonBilanciati = 0
  const flussi = [] // { mese, categoria, importo, direzione }

  for (const segmento of segmenti) {
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
        flussi.push({ mese: bancaLeg.mese, categoria: 'Giroconto tra conti propri', importo: bancaLeg.importo, direzione: direzioneBanca })
        flussi.push({ mese: c.mese, categoria: 'Giroconto tra conti propri', importo: c.importo, direzione: c.segno > 0 ? 'entrata' : 'uscita' })
      } else {
        flussi.push({ mese: bancaLeg.mese, categoria: classifica(c.conto), importo: bancaLeg.importo, direzione: direzioneBanca })
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
      flussi.push({ mese, categoria: 'Non classificato (contropartita non trovata)', importo: Math.abs(netto), direzione })
      continue
    }
    for (const leg of nonBancaResto) {
      const contributo = round2(-leg.segno * segnoNetto * leg.importo)
      if (Math.abs(contributo) < 0.005) continue
      flussi.push({ mese, categoria: classifica(leg.conto), importo: contributo, direzione })
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
    diagnostica: { segmenti: segmenti.length, segmentiNonBilanciati },
  }
}
