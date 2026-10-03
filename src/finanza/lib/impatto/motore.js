// Motore di valutazione d'impatto (contratto EasyPMI <-> Pmi 360°, v6-v8): applica una decisione alla proiezione
// di Tesoreria già salvata (baseline) e ne calcola l'effetto DIFFERENZIALE su cassa e Conto Economico in tre
// scenari, più gli stress test con la decisione applicata. Modulo PURO, senza dipendenze esterne: usato dalla
// Edge Function Deno e testato in Jest. Le formule di cassa/CE sono le stesse della Tesoreria (budgetMensile.js,
// tesoreria.js).
//
// v8: da "motore leasing" a DISPATCHER su tipo_impatto, con movimenti indicizzati per MESE ASSOLUTO (mai un
// indice relativo a una singola decorrenza). Il leasing (v7) è portato SENZA CAMBIARE LA MATEMATICA: vedi
// motore.test.js, i cui valori attesi sono il test di non regressione richiesto da Pmi 360°.
// v8 "composta": un tipo singolo è trattato come una decisione composta di UN SOLO componente — stessa pipeline,
// nessuna duplicazione. Una composta con N componenti (ciascuno con la propria decorrenza e la propria eventuale
// ipotesi_ricavi) somma i loro movimenti; il totale usa la stessa aggregazione di un tipo singolo, più un
// dettaglio per componente (limitato allo scenario worst, per semplicità dichiarata).
import { eseguiStressTests } from '../tesoreria.js'
import { round2, round1, it, ymDaData, addMesi, etichettaMese, ripartisci } from './util.js'
import { GENERATORI } from './generatori.js'

export const VERSIONE_MOTORE = 'impatto-2'
export const MODELLO_CASSA_MINIMO = 9 // il baseline deve contenere gli stress input (linee di credito, costi energetici)
export const ETA_MASSIMA_BASELINE_GIORNI = 35 // oltre: avviso (non blocco), come il controllo di aggiornamento della Tesoreria
export const QUOTA_RICAVI_SCENARIO_BASE = 0.5 // BASE = via di mezzo prudente: 50% dell'ipotesi di ricavi
export const MAX_COMPONENTI_COMPOSTA = 5
export const TIPI_SUPPORTATI = Object.keys(GENERATORI)

export class ErroreMotore extends Error {
  constructor(codice, messaggio, extra = {}) {
    super(messaggio)
    this.codice = codice
    this.extra = extra
  }
}

const CATEGORIE_CE = ['ricavo_operativo', 'costo_operativo', 'ammortamento', 'onere_finanziario', 'provento_finanziario']

// Applica un movimento di cassa (competenza + sfasamento + IVA) ai vettori mensili dati. L'IVA matura alla
// COMPETENZA (mese della fattura, non sfasata: e' quella la regola fiscale), il flusso di cassa fisico (capitale +
// IVA della fattura) e' invece sfasato secondo giorniSfasamento — stessa distinzione già nel motore v7.
function applicaMovimentoCassa(riga, { uscite, entrate, ivaAcquisti, ivaVendite, idx, aliqA, aliqV }) {
  const aliquota = riga.soggettoIva ? (riga.direzione === 'uscita' ? aliqA : aliqV) : 0
  const iva = riga.importo * aliquota
  const jComp = idx.get(riga.ym)
  if (jComp !== undefined) {
    if (riga.direzione === 'uscita') ivaAcquisti[jComp] += iva
    else ivaVendite[jComp] += iva
  }
  for (const { k: off, peso } of ripartisci(riga.giorniSfasamento)) {
    const j = idx.get(addMesi(riga.ym, off))
    if (j === undefined) continue
    const tot = (riga.importo + iva) * peso
    if (riga.direzione === 'uscita') uscite[j] += tot
    else entrate[j] += tot
  }
}

// Costruisce il "livello scenario-dipendente" dell'ipotesi_ricavi comune (§4.A) per UN componente (o per la
// decisione, se di tipo singolo). ymDecorrenza e' quella del componente: i ricavi non possono partire prima.
function livelloIpotesiRicavi(ip, { ymDecorrenza, finestra, idx, dsoGiorni }, ceBaselineMesi) {
  const ymPartenza = ymDaData(ip.mese_partenza)
  const ce = []
  const cassa = []
  for (let j = 0; j < finestra.length; j++) {
    if (finestra[j] < ymPartenza || finestra[j] < ymDecorrenza) continue
    const importo = ip.modalita === 'incremento_pct' ? (ip.valore / 100) * (ceBaselineMesi[j]?.ricavi_operativi ?? 0) : ip.valore
    if (!importo) continue
    ce.push({ ym: finestra[j], importo, categoria: 'ricavo_operativo' })
    cassa.push({ ym: finestra[j], giorniSfasamento: dsoGiorni, importo, direzione: 'entrata', soggettoIva: true })
  }
  const troncato = !idx.has(ymPartenza) && ymPartenza > finestra[finestra.length - 1]
  return { livello: { nome: 'ipotesi_ricavi', fattori: { worst: 0, base: QUOTA_RICAVI_SCENARIO_BASE, best: 1 }, ce, cassa }, troncato }
}

// Aggrega un insieme di movimenti (gia' certi, di uno o piu' componenti sommati) + i suoi livelli
// scenario-dipendenti in scenari worst/base/best, stress test, alert e range storico ricavi. E' l'unica
// implementazione, usata sia per il totale (tipo singolo o composta) sia, isolata, per ogni componente di una
// composta (dettaglio_componenti).
function elaboraMovimenti({ ce: ceMov, cassa: cassaMov, livelli, ctx, piano }) {
  const { finestra, idx, nMesi, aliqA, aliqV } = ctx

  const ceCerto = {}
  for (const cat of CATEGORIE_CE) ceCerto[cat] = new Array(nMesi).fill(0)
  for (const riga of ceMov) {
    const j = idx.get(riga.ym)
    if (j !== undefined) ceCerto[riga.categoria][j] += riga.importo
  }

  const usciteLordeCerte = new Array(nMesi).fill(0)
  const entrateLordeCerte = new Array(nMesi).fill(0)
  const ivaAcquistiCertaComp = new Array(nMesi).fill(0)
  const ivaVenditeCertaComp = new Array(nMesi).fill(0)
  for (const riga of cassaMov) {
    applicaMovimentoCassa(riga, { uscite: usciteLordeCerte, entrate: entrateLordeCerte, ivaAcquisti: ivaAcquistiCertaComp, ivaVendite: ivaVenditeCertaComp, idx, aliqA, aliqV })
  }

  const ceBase = piano.ce_baseline.totale
  const scenari = {}
  const cassaWorst = {}
  for (const nomeScenario of ['worst', 'base', 'best']) {
    const ceTot = {}
    for (const cat of CATEGORIE_CE) {
      ceTot[cat] = ceCerto[cat].slice()
      for (const l of livelli) {
        const f = l.fattori[nomeScenario]
        if (!f) continue
        for (const riga of l.ce) {
          if (riga.categoria !== cat) continue
          const j = idx.get(riga.ym)
          if (j !== undefined) ceTot[cat][j] += riga.importo * f
        }
      }
    }
    const uscite = usciteLordeCerte.slice()
    const entrate = entrateLordeCerte.slice()
    const ivaAcquisti = ivaAcquistiCertaComp.slice()
    const ivaVendite = ivaVenditeCertaComp.slice()
    for (const l of livelli) {
      const f = l.fattori[nomeScenario]
      if (!f) continue
      for (const riga of l.cassa) applicaMovimentoCassa({ ...riga, importo: riga.importo * f }, { uscite, entrate, ivaAcquisti, ivaVendite, idx, aliqA, aliqV })
    }

    const dVersamento = new Array(nMesi).fill(0)
    let creditoPrec = null
    for (const p of piano.iva_baseline.periodi) {
      let dAcq = 0, dVen = 0
      for (let j = 0; j < nMesi; j++) {
        if (finestra[j] >= p.da && finestra[j] <= p.a) { dAcq += ivaAcquisti[j]; dVen += ivaVendite[j] }
      }
      const credPrec = creditoPrec === null ? p.credito_precedente : creditoPrec
      const saldoNetto = p.iva_vendite + dVen - (p.iva_acquisti + dAcq) - credPrec
      const versamento = saldoNetto > 0 ? saldoNetto : 0
      creditoPrec = saldoNetto < 0 ? -saldoNetto : 0
      const jPag = idx.get(p.mese_versamento)
      if (jPag !== undefined) dVersamento[jPag] += versamento - p.versamento
    }

    let cum = 0
    const mesi = piano.mesi.map((m, j) => {
      cum += entrate[j] - uscite[j] - dVersamento[j]
      const scen = round2(m.saldo_base + cum)
      return { mese: etichettaMese(m.mese_budget), cassa_baseline: round2(m.saldo_base), cassa_scenario: scen, delta_cassa: round2(scen - m.saldo_base), buffer_minimo: m.buffer_minimo, semaforo_scenario: scen > m.buffer_minimo ? 'verde' : scen > 0 ? 'giallo' : 'rosso' }
    })

    const ceMensile = []
    const tot = { ebitda: 0, ebit: 0, oneri_finanziari: 0, utile: 0 }
    for (let j = 0; j < nMesi; j++) {
      const ebitda = ceTot.ricavo_operativo[j] - ceTot.costo_operativo[j]
      const ebit = ebitda - ceTot.ammortamento[j]
      const oneri = ceTot.onere_finanziario[j] - ceTot.provento_finanziario[j]
      const utile = ebit - oneri
      ceMensile.push({ mese: etichettaMese(finestra[j]), ebitda: round2(ebitda), ebit: round2(ebit), oneri_finanziari: round2(oneri), utile: round2(utile) })
      tot.ebitda += ebitda; tot.ebit += ebit; tot.oneri_finanziari += oneri; tot.utile += utile
    }
    const riga = (base, dlt) => ({ baseline: round2(base), scenario: round2(base + dlt), delta: round2(dlt) })
    scenari[nomeScenario] = { mesi, conto_economico: { ebitda: riga(ceBase.ebitda, tot.ebitda), ebit: riga(ceBase.ebit, tot.ebit), oneri_finanziari: riga(ceBase.oneri_finanziari, tot.oneri_finanziari), utile: riga(ceBase.utile, tot.utile), mensile: ceMensile } }
    if (nomeScenario === 'worst') cassaWorst.uscite = uscite, cassaWorst.entrate = entrate, cassaWorst.dVersamento = dVersamento
  }

  const alert = []
  for (const [nome, sc] of Object.entries(scenari)) {
    for (const m of sc.mesi) {
      if (m.cassa_scenario < 0 && m.cassa_baseline >= 0) alert.push(`saldo negativo a ${m.mese} nello scenario ${nome} (baseline ${it(m.cassa_baseline)} €, scenario ${it(m.cassa_scenario)} €)`)
      else if (m.cassa_scenario < m.buffer_minimo && m.cassa_baseline >= m.buffer_minimo) alert.push(`sfora il buffer minimo a ${m.mese} nello scenario ${nome}`)
    }
  }
  const alertUnici = [...new Set(alert)].slice(0, 30)

  const perMeseBase = {}
  const perMeseDec = {}
  piano.mesi.forEach((m, j) => {
    const entrateBase = m.entrate_certe + m.entrate_stimate
    const usciteTot = m.uscite_certe + m.uscite_stimate
    const energia = m.uscite_energia || 0
    perMeseBase[m.mese_budget] = { entrate: [{ importo: entrateBase, tipoDato: 'certo' }], uscite: [{ importo: usciteTot - energia, categoria: 'altre' }, { importo: energia, categoria: 'fornitori_energia' }] }
    perMeseDec[m.mese_budget] = {
      entrate: [{ importo: entrateBase + cassaWorst.entrate[j], tipoDato: 'certo' }],
      uscite: [{ importo: usciteTot - energia + cassaWorst.uscite[j] + cassaWorst.dVersamento[j], categoria: 'altre' }, { importo: energia, categoria: 'fornitori_energia' }],
    }
  })
  const parametriStress = { meseStart: [piano.mesi[0].anno, piano.mesi[0].mese], saldoIniziale: piano.saldo_iniziale, fatturatoMedio: piano.fatturato_mensile_medio, bufferPct: piano.buffer_minimo_pct, orizzonteMesi: nMesi, lineeCredito: piano.linee_credito ? { dichiarate: piano.linee_credito.dichiarate, linee: piano.linee_credito.linee || [] } : null, concentrazione: piano.concentrazione || null }
  const stressBaseline = eseguiStressTests({ perMese: perMeseBase, ...parametriStress })
  const stressDecisione = eseguiStressTests({ perMese: perMeseDec, ...parametriStress })

  const livelloRicavi = livelli.find((l) => l.nome === 'ipotesi_ricavi')
  const reali = (piano.mesi_reali || []).map((m) => m.entrate).filter((v) => v != null)
  const mediaFatt = piano.fatturato_mensile_medio ?? null
  const range = { base: 'fatturato_mensile_medio', media_mensile: mediaFatt != null ? round2(mediaFatt) : null, banda_min: reali.length ? round2(Math.min(...reali)) : null, banda_max: reali.length ? round2(Math.max(...reali)) : null, n_mesi_reali: reali.length, giudizio_ipotesi_utente: 'nessuna_ipotesi', giudizio_testo: 'Nessuna ipotesi di ricavi indicata: gli scenari differiscono solo per gli effetti certi.' }
  if (livelloRicavi) {
    const mensileLordo = Math.max(...livelloRicavi.ce.map((r) => r.importo), 0) * (1 + aliqV)
    if (reali.length >= 3 && mediaFatt != null) {
      const oltre = mediaFatt + mensileLordo > range.banda_max
      range.giudizio_ipotesi_utente = oltre ? 'oltre_massimo_storico' : 'entro_banda_storica'
      range.giudizio_testo = oltre
        ? `Con l'ipotesi (${it(mensileLordo)} € lordi/mese in piu') il volume mensile supererebbe il massimo storico dell'azienda (${it(range.banda_max)} €).`
        : `Con l'ipotesi (${it(mensileLordo)} € lordi/mese in piu') il volume mensile resta entro il massimo storico dell'azienda (${it(range.banda_max)} €).`
    } else {
      range.giudizio_ipotesi_utente = 'non_valutabile'
      range.giudizio_testo = 'Storico insufficiente (meno di 3 mesi reali) per valutare la plausibilita dell\'ipotesi.'
    }
  }

  let impegniOltreFinestra = 0
  for (const riga of cassaMov) {
    if (ripartisci(riga.giorniSfasamento).some(({ k: off }) => addMesi(riga.ym, off) > finestra[nMesi - 1])) impegniOltreFinestra++
  }

  const w = scenari.worst
  const confronto = {
    testo: `Nello scenario worst (solo effetti certi) la decisione varia l'utile ante imposte di ${it(w.conto_economico.utile.delta)} € e l'EBITDA di ${it(w.conto_economico.ebitda.delta)} € sui 12 mesi; la cassa a fine finestra varia di ${it(w.mesi[nMesi - 1].delta_cassa)} €.`,
    delta_cassa_finale_worst: w.mesi[nMesi - 1].delta_cassa,
    delta_cassa_minimo_worst: Math.min(...w.mesi.map((m) => m.delta_cassa)),
    delta_ebitda_worst: w.conto_economico.ebitda.delta,
    delta_utile_worst: w.conto_economico.utile.delta,
  }

  return { scenari, alert: alertUnici, stressBaseline, stressDecisione, range, confronto, impegniOltreFinestra }
}

export function calcolaSimulazione({ richiesta, azienda, scenarioRow, ora = new Date() }) {
  const piano = scenarioRow.piano_json
  const d = richiesta.decisione
  const avvisi = []

  // ---- baseline: finestra, età ----
  const finestra = piano.mesi.map((m) => m.mese_budget)
  const nMesi = finestra.length
  const idx = new Map(finestra.map((ym, j) => [ym, j]))
  const generato = new Date(String(scenarioRow.creato_il).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(scenarioRow.creato_il)) ? '' : 'Z'))
  const etaGiorni = Math.floor((ora.getTime() - generato.getTime()) / 86400000)
  if (etaGiorni > ETA_MASSIMA_BASELINE_GIORNI) {
    avvisi.push({ codice: 'BASELINE_NON_AGGIORNATO', messaggio: `La proiezione di Tesoreria usata risale a ${etaGiorni} giorni fa (oltre ${ETA_MASSIMA_BASELINE_GIORNI}): rigenerarla per un confronto aggiornato.` })
  }

  const aliqA = (azienda.aliquota_iva_acquisti ?? 22) / 100
  const aliqV = (piano.iva_baseline?.aliquota_vendite ?? azienda.aliquota_iva_vendite ?? 22) / 100
  const dsoGiorni = piano.dso_medio ?? azienda.gg_medi_incasso ?? 30
  const dpoGiorni = piano.dpo_medio ?? azienda.gg_medi_pagamento ?? 30
  const kMax = nMesi + 3
  const ctxBase = { finestra, idx, nMesi, kMax, aliqA, aliqV, dsoGiorni, dpoGiorni }

  // ---- componenti: un tipo singolo è una composta di UN solo componente (stessa pipeline, nessuna duplicazione) ----
  const componenti = d.tipo_impatto === 'composta' ? d.componenti : [d]
  const parti = componenti.map((comp, i) => {
    const etichettaComp = componenti.length > 1 ? `componente ${i + 1} (${comp.tipo_impatto})` : null
    const ymDecorrenza = ymDaData(comp.data_decorrenza)
    if (!idx.has(ymDecorrenza)) {
      throw new ErroreMotore('FUORI_FINESTRA', `La decorrenza${etichettaComp ? ` del ${etichettaComp}` : ''} (${etichettaMese(ymDecorrenza)}) cade fuori dalla finestra della proiezione di Tesoreria (${etichettaMese(finestra[0])} - ${etichettaMese(finestra[nMesi - 1])}): elaborare una proiezione che la comprenda.`, { finestra: { da: finestra[0], a: finestra[nMesi - 1] }, componente: componenti.length > 1 ? i : undefined })
    }
    const generatore = GENERATORI[comp.tipo_impatto]
    if (!generatore) throw new ErroreMotore('TIPO_NON_SUPPORTATO', `Tipo d'impatto "${comp.tipo_impatto}"${etichettaComp ? ` (${etichettaComp})` : ''} non è ancora supportato dal motore.`)
    const ctx = { ...ctxBase, ymDecorrenza }
    const gen = generatore(comp, ctx)
    let livelloRicavi = null
    let ricaviTroncatiComp = false
    if (comp.ipotesi_ricavi) {
      const r = livelloIpotesiRicavi(comp.ipotesi_ricavi, ctx, piano.ce_baseline.mesi)
      livelloRicavi = r.livello
      ricaviTroncatiComp = r.troncato
    }
    return { i, comp, etichettaComp, ymDecorrenza, gen, livelloRicavi, ricaviTroncatiComp }
  })

  for (const p of parti) {
    for (const a of p.gen.avvisi) avvisi.push(p.etichettaComp ? { ...a, messaggio: `[${p.etichettaComp}] ${a.messaggio}` } : a)
  }
  const ricaviTroncati = parti.some((p) => p.ricaviTroncatiComp)

  const ceTotale = parti.flatMap((p) => p.gen.ce)
  const cassaTotale = parti.flatMap((p) => p.gen.cassa)
  const livelliTotali = [...parti.filter((p) => p.livelloRicavi).map((p) => p.livelloRicavi), ...parti.flatMap((p) => p.gen.livelliScenario || [])]

  const { scenari, alert, stressBaseline, stressDecisione, range, confronto, impegniOltreFinestra } = elaboraMovimenti({ ce: ceTotale, cassa: cassaTotale, livelli: livelliTotali, ctx: ctxBase, piano })

  if (impegniOltreFinestra > 0) {
    avvisi.push({ codice: 'FINESTRA_TRONCATA', messaggio: `${impegniOltreFinestra} movimenti di cassa cadono oltre i 12 mesi della proiezione: il confronto copre solo la finestra (${etichettaMese(finestra[0])} - ${etichettaMese(finestra[nMesi - 1])}).` })
  }

  // ---- dettaglio_componenti (solo se composta): contributo di ciascun componente, scenario worst soltanto ----
  let dettagliComponenti
  if (d.tipo_impatto === 'composta') {
    dettagliComponenti = parti.map((p) => {
      const iso = elaboraMovimenti({ ce: p.gen.ce, cassa: p.gen.cassa, livelli: p.livelloRicavi ? [p.livelloRicavi] : [], ctx: ctxBase, piano })
      return {
        indice: p.i + 1,
        tipo_impatto: p.comp.tipo_impatto,
        descrizione: p.comp.descrizione,
        dettaglio_tipo: p.gen.meta,
        delta_ebitda_worst: iso.scenari.worst.conto_economico.ebitda.delta,
        delta_utile_worst: iso.scenari.worst.conto_economico.utile.delta,
        delta_cassa_finale_worst: iso.scenari.worst.mesi[nMesi - 1].delta_cassa,
      }
    })
  }

  // ---- ipotesi usate (§4.D: trasparenza, incluse le convenzioni e i limiti noti) ----
  const ipotesi = {
    tipo_impatto: d.tipo_impatto,
    ...(d.tipo_impatto === 'composta' ? { numero_componenti: componenti.length } : { iva_regime: d.iva_regime ?? 'ordinaria' }),
    aliquota_iva_usata: aliqA * 100,
    aliquota_iva_vendite_usata: aliqV * 100,
    utile_espresso: 'ante_imposte',
    range_ricavi_base: 'fatturato_mensile_medio',
    ce_baseline: piano.ce_baseline.convenzione,
    finestra: { da: etichettaMese(finestra[0]), a: etichettaMese(finestra[nMesi - 1]), mesi: nMesi },
    impegni_oltre_finestra: impegniOltreFinestra,
    ricavi_ipotizzati_troncati: ricaviTroncati,
    dso_usato_giorni: round1(dsoGiorni),
    dpo_usato_giorni: round1(dpoGiorni),
    scenari: { worst: 'solo effetti certi, ricavi ipotizzati a zero', base: `${QUOTA_RICAVI_SCENARIO_BASE * 100}% dell'ipotesi di ricavi`, best: '100% dell\'ipotesi di ricavi' },
    ricavi_ipotizzati: 'considerati al netto dei relativi costi variabili: nessun costo variabile aggiuntivo modellato',
    stress_test: 'applicati alla proiezione con la decisione nello scenario WORST (solo effetti certi), confrontati con la proiezione senza la decisione',
    eta_baseline_giorni: etaGiorni,
    dettaglio_tipo: d.tipo_impatto === 'composta' ? { titolo: 'Decisione composta', righe: componenti.map((c, i) => [`Componente ${i + 1}`, `${c.tipo_impatto} — ${c.descrizione}`]) } : parti[0].gen.meta,
    ...(d.tipo_impatto === 'composta' ? {} : parti[0].gen.ipotesiSpecifiche),
    limiti_noti: [
      'Investimenti inseriti tra i costi del budget restano nei costi operativi del CE baseline: il budget va corretto a monte.',
      'I 12 mesi del confronto sono quelli mobili della proiezione, non l\'esercizio civile.',
      'Il CE baseline prende il budget pieno (non pesato per probabilita) con costi netti.',
      ...(d.tipo_impatto === 'composta' ? ['dettaglio_componenti è calcolato solo sullo scenario worst (solo effetti certi), per ciascun componente isolato dagli altri.'] : []),
    ],
  }
  if (d.tipo_impatto === 'leasing') ipotesi.metodo_contabile = d.leasing.metodo_contabile

  return {
    baseline: { scenario_id: scenarioRow.id, generato_il: generato.toISOString(), fonte: 'scenari_tesoreria.piano_json (cassa + snapshot CE + IVA)', finestra: { da: etichettaMese(finestra[0]), mesi: nMesi } },
    ipotesi_usate: ipotesi,
    avvisi,
    range_storico_ricavi: range,
    scenari,
    stress_test: { scenario_di_riferimento: 'worst', baseline: stressBaseline, con_decisione: stressDecisione },
    confronto_baseline: confronto,
    alert,
    ...(dettagliComponenti ? { dettaglio_componenti: dettagliComponenti } : {}),
    ...(d.tipo_impatto !== 'composta' && parti[0].gen.piano_rate ? { piano_rate: parti[0].gen.piano_rate } : {}),
  }
}
