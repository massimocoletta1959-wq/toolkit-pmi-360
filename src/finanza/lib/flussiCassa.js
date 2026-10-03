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

  // raggruppa in registrazioni (stessa data + stessa causale/N.Doc./Dt.Doc.),
  // poi ogni registrazione in "segmenti" Dare=Avere bilanciati (una registrazione
  // puo' contenere piu' sotto-partite, es. piu' tributi in un unico F24)
  const registrazioni = new Map()
  for (const m of movimenti) {
    if (m.eApertura || m.eChiusura) continue
    const key = m.data + '|' + m.chiave
    if (!registrazioni.has(key)) registrazioni.set(key, [])
    registrazioni.get(key).push(m)
  }

  const segmenti = []
  for (const righeReg of registrazioni.values()) {
    let corrente = []
    for (const r of righeReg) {
      corrente.push(r)
      if (r.chiudeSegmento) {
        segmenti.push(corrente)
        corrente = []
      }
    }
    if (corrente.length) segmenti.push(corrente)
  }

  let segmentiNonBilanciati = 0
  const flussi = [] // { mese, categoria, importo, direzione }

  for (const segmento of segmenti) {
    const somma = round2(segmento.reduce((s, r) => s + r.segno * r.importo, 0))
    if (Math.abs(somma) > 0.02) segmentiNonBilanciati++

    const legsBanca = segmento.filter((r) => isBancaCassa(r.conto))
    if (!legsBanca.length) continue

    for (const bancaLeg of legsBanca) {
      const direzioneBanca = bancaLeg.segno > 0 ? 'entrata' : 'uscita'
      const candidati = segmento.filter((r) => r !== bancaLeg && r.segno === -bancaLeg.segno && Math.abs(r.importo - bancaLeg.importo) < 0.01)

      if (candidati.length > 0) {
        const c = candidati[0]
        const categoria = isBancaCassa(c.conto) ? 'Giroconto tra conti propri' : classifica(c.conto)
        flussi.push({ mese: bancaLeg.mese, categoria, importo: bancaLeg.importo, direzione: direzioneBanca })
        continue
      }

      // nessuna contropartita di importo identico: registrazione composita
      // (es. F24 con piu' tributi) — attribuisce a ciascuna voce non bancaria
      // il proprio contributo, nella STESSA direzione del movimento bancario
      // (direzioneBanca), con segno positivo se la voce concorre normalmente al
      // movimento e negativo se ha polarita' anomala e ne riduce il netto (es.
      // un credito d'imposta usato in compensazione dentro un F24 riduce
      // l'uscita netta invece di essere una entrata separata). La somma dei
      // contributi torna sempre a bancaLeg.importo.
      const nonBanca = segmento.filter((r) => !isBancaCassa(r.conto))
      if (!nonBanca.length) {
        flussi.push({ mese: bancaLeg.mese, categoria: 'Non classificato (contropartita non trovata)', importo: bancaLeg.importo, direzione: direzioneBanca })
        continue
      }
      for (const leg of nonBanca) {
        const contributo = round2(-leg.segno * bancaLeg.segno * leg.importo)
        if (Math.abs(contributo) < 0.005) continue
        flussi.push({ mese: bancaLeg.mese, categoria: classifica(leg.conto), importo: contributo, direzione: direzioneBanca })
      }
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
