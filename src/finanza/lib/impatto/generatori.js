// Generatori di "effetti" per ciascun tipo_impatto (v8). Ogni generatore prende i campi della decisione (o di un
// componente, per una futura "composta") e un contesto comune, e restituisce:
//   ce:    [{ ym, importo, categoria }]   — competenza economica; categoria una di:
//                                            ricavo_operativo | costo_operativo | ammortamento | onere_finanziario |
//                                            provento_finanziario. importo con segno naturale (positivo = piu' costo/
//                                            piu' ricavo/piu' ammortamento/...).
//   cassa: [{ ym, giorniSfasamento, importo, direzione, soggettoIva }]  — movimento di competenza-cassa PRIMA dello
//                                            sfasamento (che il motore applica con ripartisci()) e prima dell'IVA
//                                            (che il motore aggiunge secondo aliqA/aliqV in base alla direzione).
//   avvisi: [{ codice, messaggio }]
//   meta:  { titolo, righe: [[label, valore], ...] }   — per il PDF generico e per ipotesi_usate
//   livelliScenario: [{ nome, fattori: {worst,base,best}, ce: [...], cassa: [...] }]  (opzionale)
// ym e' sempre un mese assoluto (AAAAMM), mai un indice relativo: e' la base per una futura "composta" con
// componenti a decorrenze diverse.
import { round2, it, ymDaData, addMesi, MESI_PER_PERIODO, soggettoIvaDaRegime } from './util.js'
import { calcolaPianoAmmortamento } from './ammortamento.js'

// ---------------------------------------------------------------- leasing (v7, invariato: vedi test di non regressione)
export function calcolaRataLeasing({ imponibile, maxicanone, numeroRate, riscatto, tassoAnnuoPct, canone }) {
  if (canone != null) return { rata: canone, derivata: false, senzaTasso: false }
  const P = imponibile - maxicanone
  const i = (tassoAnnuoPct || 0) / 1200
  if (i > 0) return { rata: ((P - riscatto / Math.pow(1 + i, numeroRate)) * i) / (1 - Math.pow(1 + i, -numeroRate)), derivata: true, senzaTasso: false }
  return { rata: (P - riscatto) / numeroRate, derivata: true, senzaTasso: true }
}
function pianoInteressiLeasing({ imponibile, maxicanone, numeroRate, riscatto, tassoAnnuoPct, rata }) {
  const i = (tassoAnnuoPct || 0) / 1200
  let residuo = imponibile - maxicanone
  const interessi = []
  for (let k = 0; k < numeroRate; k++) {
    const int = residuo * i
    interessi.push(int)
    residuo = residuo - (rata - int)
  }
  return { interessi, residuoFinale: residuo, scostamentoRiscatto: residuo - riscatto }
}

export function generaLeasing(d, ctx) {
  const { ymDecorrenza, kMax, dpoGiorni } = ctx
  const L = d.leasing
  const metodo = L.metodo_contabile
  const avvisi = []
  const soggettoIva = soggettoIvaDaRegime(d.iva_regime)

  const n = L.numero_rate
  const r = calcolaRataLeasing({ imponibile: d.imponibile, maxicanone: L.maxicanone, numeroRate: n, riscatto: L.riscatto, tassoAnnuoPct: L.tasso_annuo_pct, canone: L.canone })
  const rata = r.rata
  if (r.derivata) avvisi.push({ codice: 'RATA_DERIVATA', messaggio: `La rata periodica non e' stata indicata: calcolata in ${it(rata, 2)} € (IVA esclusa)${r.senzaTasso ? ' SENZA interessi (tasso non indicato)' : ' dal tasso indicato'}. Indicare leasing.canone per un risultato esatto.` })
  let interessi = new Array(n).fill(0)
  let scostamentoRiscatto = 0
  if (metodo === 'finanziario') {
    const pf = pianoInteressiLeasing({ imponibile: d.imponibile, maxicanone: L.maxicanone, numeroRate: n, riscatto: L.riscatto, tassoAnnuoPct: L.tasso_annuo_pct, rata })
    interessi = pf.interessi
    scostamentoRiscatto = pf.scostamentoRiscatto
    if (Math.abs(scostamentoRiscatto) > 0.02 * d.imponibile) {
      avvisi.push({ codice: 'PIANO_RATE_NON_COERENTE', messaggio: `Con canone e tasso indicati il debito residuo a fine piano (${it(pf.residuoFinale)} €) si discosta dal riscatto (${it(L.riscatto)} €) di oltre il 2% del bene: verificare canone e tasso.` })
    }
  }
  const rateResidueOltre = null // calcolato dal motore (dipende dalla finestra)

  const ce = []
  const cassa = []
  for (let k = 0; k < kMax; k++) {
    const ym = addMesi(ymDecorrenza, k)
    ce.push({ ym, importo: d.costi_esercizio_mensili, categoria: 'costo_operativo' })
    if (metodo === 'patrimoniale') {
      if (k < n) ce.push({ ym, importo: rata + L.maxicanone / n, categoria: 'costo_operativo' })
    } else {
      if (k < d.ammortamento.durata_mesi) ce.push({ ym, importo: d.imponibile / d.ammortamento.durata_mesi, categoria: 'ammortamento' })
      if (k < n) ce.push({ ym, importo: interessi[k], categoria: 'onere_finanziario' })
    }
    if (d.costi_esercizio_mensili) cassa.push({ ym, giorniSfasamento: dpoGiorni, importo: d.costi_esercizio_mensili, direzione: 'uscita', soggettoIva })
    if (k === 0 && L.maxicanone) cassa.push({ ym, giorniSfasamento: dpoGiorni, importo: L.maxicanone, direzione: 'uscita', soggettoIva })
    if (k < n) cassa.push({ ym, giorniSfasamento: dpoGiorni, importo: rata, direzione: 'uscita', soggettoIva })
    if (k === n && L.riscatto) cassa.push({ ym, giorniSfasamento: dpoGiorni, importo: L.riscatto, direzione: 'uscita', soggettoIva })
  }

  return {
    ce, cassa, avvisi,
    meta: {
      titolo: 'La decisione simulata',
      righe: [
        ['Valore del bene (imponibile)', it(d.imponibile) + ' €'],
        ['Maxicanone iniziale (IVA esclusa)', it(L.maxicanone) + ' €'],
        ['Numero di rate', `${n} (${L.periodicita})`],
        [`Canone periodico (IVA esclusa)${r.derivata ? ' - calcolato' : ''}`, it(rata, 2) + ' €'],
        ['Riscatto finale (IVA esclusa)', it(L.riscatto) + ' €'],
        ['Costi di esercizio mensili', it(d.costi_esercizio_mensili) + ' €'],
        ...(metodo === 'finanziario' ? [['Tasso annuo / durata ammortamento', `${L.tasso_annuo_pct}% / ${d.ammortamento.durata_mesi} mesi`]] : []),
      ],
    },
    piano_rate: { rata_periodica_iva_esclusa: round2(rata), numero_rate: n, maxicanone: L.maxicanone, riscatto: L.riscatto, imponibile: d.imponibile },
    ipotesiSpecifiche: { rata_derivata: r.derivata, rata_periodica_iva_esclusa: round2(rata), scostamento_riscatto: round2(scostamentoRiscatto), numero_rate: n, rateResidueOltre },
  }
}

// ---------------------------------------------------------------- acquisto_bene
// ASSUNZIONI dichiarate (non specificate nel dettaglio da Pmi 360°, da confermare):
//  - "acconto_saldo": il saldo si paga a data_entrata_in_funzione (o alla decorrenza, se non indicata).
//  - "rate": rate di pari importo, la prima alla decorrenza, spaziate secondo `periodicita`.
//  - i "contributi" impattano solo la cassa (all'incasso indicato), non il Conto Economico: distinguere un
//    contributo in conto impianti (che ridurrebbe l'ammortamento) da uno in conto esercizio (un provento) richiede
//    una scelta contabile che qui non forziamo.
export function generaAcquistoBene(d, ctx) {
  const { ymDecorrenza, dpoGiorni } = ctx
  const soggettoIva = soggettoIvaDaRegime(d.iva_regime)
  const avvisi = []
  const ce = []
  const cassa = []

  const p = d.pagamento ?? { modalita: 'unico' }
  if (p.modalita === 'acconto_saldo') {
    const ymSaldo = d.data_entrata_in_funzione ? ymDaData(d.data_entrata_in_funzione) : ymDecorrenza
    cassa.push({ ym: ymDecorrenza, giorniSfasamento: dpoGiorni, importo: round2((d.imponibile * p.acconto_pct) / 100), direzione: 'uscita', soggettoIva })
    cassa.push({ ym: ymSaldo, giorniSfasamento: dpoGiorni, importo: round2((d.imponibile * (100 - p.acconto_pct)) / 100), direzione: 'uscita', soggettoIva })
  } else if (p.modalita === 'rate') {
    const rata = round2(d.imponibile / p.numero_rate)
    const passo = MESI_PER_PERIODO(p.periodicita || 'mensile')
    for (let k = 0; k < p.numero_rate; k++) cassa.push({ ym: addMesi(ymDecorrenza, k * passo), giorniSfasamento: dpoGiorni, importo: rata, direzione: 'uscita', soggettoIva })
  } else {
    cassa.push({ ym: ymDecorrenza, giorniSfasamento: dpoGiorni, importo: d.imponibile, direzione: 'uscita', soggettoIva })
  }

  const ymEntrata = d.data_entrata_in_funzione ? ymDaData(d.data_entrata_in_funzione) : ymDecorrenza
  const quotaMensile = d.ammortamento.durata_mesi ? d.imponibile / d.ammortamento.durata_mesi : (d.imponibile * d.ammortamento.aliquota_annua_pct) / 100 / 12
  const nMesiAmm = d.ammortamento.durata_mesi ?? Math.round((100 / d.ammortamento.aliquota_annua_pct) * 12)
  for (let k = 0; k < ctx.kMax; k++) {
    const ym = addMesi(ymEntrata, k)
    if (k < nMesiAmm) ce.push({ ym, importo: quotaMensile, categoria: 'ammortamento' })
    if (d.costi_esercizio_mensili) {
      ce.push({ ym, importo: d.costi_esercizio_mensili, categoria: 'costo_operativo' })
      cassa.push({ ym, giorniSfasamento: dpoGiorni, importo: d.costi_esercizio_mensili, direzione: 'uscita', soggettoIva })
    }
  }

  for (const c of d.contributi || []) {
    cassa.push({ ym: ymDaData(c.data_incasso), giorniSfasamento: 0, importo: c.importo, direzione: 'entrata', soggettoIva: false })
  }
  if ((d.contributi || []).length) {
    avvisi.push({ codice: 'CONTRIBUTI_SOLO_CASSA', messaggio: 'I contributi indicati sono considerati solo come incasso di cassa, senza effetto diretto sul Conto Economico (nessuna distinzione tra conto impianti e conto esercizio).' })
  }

  return {
    ce, cassa, avvisi,
    meta: {
      titolo: 'Il bene simulato',
      righe: [
        ['Valore del bene (imponibile)', it(d.imponibile) + ' €'],
        ['Modalità di pagamento', p.modalita === 'unico' ? 'unico alla decorrenza' : p.modalita === 'acconto_saldo' ? `acconto ${p.acconto_pct}% + saldo` : `${p.numero_rate} rate ${p.periodicita}`],
        ['Ammortamento', d.ammortamento.durata_mesi ? `${d.ammortamento.durata_mesi} mesi` : `${d.ammortamento.aliquota_annua_pct}%/anno (${nMesiAmm} mesi)`],
        ['Entrata in funzione', d.data_entrata_in_funzione ?? '(= decorrenza)'],
        ['Costi di esercizio mensili', it(d.costi_esercizio_mensili || 0) + ' €'],
      ],
    },
    ipotesiSpecifiche: { ammortamento_mesi: nMesiAmm, quota_mensile: round2(quotaMensile) },
  }
}

// ---------------------------------------------------------------- finanziamento (solo "rateale" in questa fase)
export function generaFinanziamento(d, ctx) {
  const avvisi = []
  const ymErog = ymDaData(d.data_erogazione)
  const mesiPerPeriodo = MESI_PER_PERIODO(d.periodicita)
  const attesoInteroMultiplo = (d.preammortamento_mesi || 0) % mesiPerPeriodo === 0
  if (!attesoInteroMultiplo) {
    avvisi.push({ codice: 'PREAMMORTAMENTO_ARROTONDATO', messaggio: `preammortamento_mesi (${d.preammortamento_mesi}) non è un multiplo esatto della periodicità (${d.periodicita}): arrotondato al periodo più vicino.` })
  }
  const piano = calcolaPianoAmmortamento({ importo: d.importo, tassoAnnuoPct: d.tasso_annuo_pct, numeroRate: d.numero_rate, periodicita: d.periodicita, piano: d.piano, preammortamentoMesi: d.preammortamento_mesi })

  const ce = []
  const cassa = [{ ym: ymErog, giorniSfasamento: 0, importo: d.importo, direzione: 'entrata', soggettoIva: false }]
  if (d.spese_istruttoria) {
    ce.push({ ym: ymErog, importo: d.spese_istruttoria, categoria: 'onere_finanziario' })
    cassa.push({ ym: ymErog, giorniSfasamento: 0, importo: d.spese_istruttoria, direzione: 'uscita', soggettoIva: false })
  }
  piano.rate.forEach((r, p) => {
    const ym = addMesi(ymErog, (p + 1) * piano.mesiPerPeriodo)
    if (r.interessi) ce.push({ ym, importo: r.interessi, categoria: 'onere_finanziario' })
    cassa.push({ ym, giorniSfasamento: 0, importo: round2(r.rata), direzione: 'uscita', soggettoIva: false })
  })

  return {
    ce, cassa, avvisi,
    meta: {
      titolo: 'Il finanziamento simulato',
      righe: [
        ['Importo erogato', it(d.importo) + ' €'],
        ['Piano di ammortamento', `${d.piano} — ${d.numero_rate} rate ${d.periodicita}`],
        ['Tasso annuo', `${d.tasso_annuo_pct}%`],
        ...(d.preammortamento_mesi ? [['Preammortamento', `${d.preammortamento_mesi} mesi (solo interessi)`]] : []),
        ['Spese di istruttoria', it(d.spese_istruttoria || 0) + ' €'],
        ['Debito residuo a fine piano', it(piano.residuoFinale) + ' €'],
        ['Prima rata', it(piano.rate[0]?.rata || 0, 2) + ' €'],
      ],
    },
    ipotesiSpecifiche: { debito_residuo_fine_piano: piano.residuoFinale, prima_rata: round2(piano.rate[0]?.rata || 0), interessi_totali: round2(piano.rate.reduce((s, r) => s + r.interessi, 0)) },
  }
}

// ---------------------------------------------------------------- costo_ricorrente
export function generaCostoRicorrente(d, ctx) {
  const { ymDecorrenza, dpoGiorni } = ctx
  const soggettoIva = soggettoIvaDaRegime(d.iva_regime)
  const ce = []
  const cassa = []
  const mesiPerPeriodo = MESI_PER_PERIODO(d.periodicita_fatturazione)
  const nPeriodi = Math.ceil(d.durata_mesi / mesiPerPeriodo)

  for (let m = 0; m < d.durata_mesi; m++) {
    const anniTrascorsi = Math.floor(m / 12)
    const importoMese = (d.importo_periodico / mesiPerPeriodo) * Math.pow(1 + (d.indicizzazione_annua_pct || 0) / 100, anniTrascorsi)
    ce.push({ ym: addMesi(ymDecorrenza, m), importo: importoMese, categoria: 'costo_operativo' })
  }
  for (let p = 0; p < nPeriodi; p++) {
    const meseInizio = p * mesiPerPeriodo
    const meseFattura = d.pagamento_anticipato ? meseInizio : Math.min(meseInizio + mesiPerPeriodo - 1, d.durata_mesi - 1)
    const anniTrascorsi = Math.floor(meseInizio / 12)
    const importoPeriodo = d.importo_periodico * Math.pow(1 + (d.indicizzazione_annua_pct || 0) / 100, anniTrascorsi)
    cassa.push({ ym: addMesi(ymDecorrenza, meseFattura), giorniSfasamento: dpoGiorni, importo: round2(importoPeriodo), direzione: 'uscita', soggettoIva })
  }
  if (d.una_tantum_iniziale) {
    ce.push({ ym: ymDecorrenza, importo: d.una_tantum_iniziale, categoria: 'costo_operativo' })
    cassa.push({ ym: ymDecorrenza, giorniSfasamento: dpoGiorni, importo: d.una_tantum_iniziale, direzione: 'uscita', soggettoIva })
  }
  if (d.deposito_cauzionale) {
    cassa.push({ ym: ymDecorrenza, giorniSfasamento: dpoGiorni, importo: d.deposito_cauzionale, direzione: 'uscita', soggettoIva: false })
    cassa.push({ ym: addMesi(ymDecorrenza, d.durata_mesi), giorniSfasamento: 0, importo: d.deposito_cauzionale, direzione: 'entrata', soggettoIva: false })
  }

  const livelliScenario = []
  if (d.success_fee) {
    livelliScenario.push({
      nome: 'success_fee',
      fattori: { worst: 0, base: 1, best: 1 },
      ce: [{ ym: ymDaData(d.success_fee.data_prevista), importo: d.success_fee.importo, categoria: 'costo_operativo' }],
      cassa: [{ ym: ymDaData(d.success_fee.data_prevista), giorniSfasamento: dpoGiorni, importo: d.success_fee.importo, direzione: 'uscita', soggettoIva }],
    })
  }

  return {
    ce, cassa, avvisi: [], livelliScenario,
    meta: {
      titolo: 'Il contratto simulato',
      righe: [
        ['Categoria', d.categoria],
        ['Importo periodico', `${it(d.importo_periodico)} € / ${d.periodicita_fatturazione}`],
        ['Durata', `${d.durata_mesi} mesi`],
        ...(d.indicizzazione_annua_pct ? [['Indicizzazione annua', `${d.indicizzazione_annua_pct}%`]] : []),
        ...(d.una_tantum_iniziale ? [['Costo di attivazione', it(d.una_tantum_iniziale) + ' €']] : []),
        ...(d.deposito_cauzionale ? [['Deposito cauzionale', it(d.deposito_cauzionale) + ' € (rimborsabile a fine contratto)']] : []),
        ...(d.success_fee ? [['Success fee (base/best)', it(d.success_fee.importo) + ' €']] : []),
      ],
    },
    ipotesiSpecifiche: {},
  }
}

// ---------------------------------------------------------------- costo_una_tantum
export function generaCostoUnaTantum(d, ctx) {
  const { ymDecorrenza, dpoGiorni } = ctx
  const soggettoIva = soggettoIvaDaRegime(d.iva_regime)
  const avvisi = []
  const ce = [{ ym: ymDecorrenza, importo: d.importo, categoria: 'costo_operativo' }]
  const cassa = []
  if (d.piano_pagamenti && d.piano_pagamenti.length) {
    const somma = round2(d.piano_pagamenti.reduce((s, t) => s + t.importo, 0))
    if (Math.abs(somma - d.importo) > 0.5) {
      avvisi.push({ codice: 'PIANO_PAGAMENTI_NON_COERENTE', messaggio: `Il piano dei pagamenti (${it(somma)} €) non coincide con l'importo totale (${it(d.importo)} €).` })
    }
    for (const t of d.piano_pagamenti) cassa.push({ ym: ymDaData(t.data), giorniSfasamento: 0, importo: t.importo, direzione: 'uscita', soggettoIva })
  } else {
    cassa.push({ ym: ymDecorrenza, giorniSfasamento: dpoGiorni, importo: d.importo, direzione: 'uscita', soggettoIva })
  }
  return {
    ce, cassa, avvisi,
    meta: { titolo: 'Il costo simulato', righe: [['Categoria', d.categoria], ['Importo', it(d.importo) + ' €'], ['Pagamento', d.piano_pagamenti?.length ? `${d.piano_pagamenti.length} tranche` : 'unico alla decorrenza']] },
    ipotesiSpecifiche: {},
  }
}

// ---------------------------------------------------------------- personale
// contributi_pct e mensilita sono OBBLIGATORI (confermato da Pmi 360°: l'aliquota INPS effettiva dell'azienda +
// INAIL, presa dai dati reali del cedolino/avviso INAIL — mai un default per inquadramento). L'unica formula
// fissata da EasyPMI è il TFR di legge: retribuzione annua / 13,5 (art. 2120 c.c.), senza rivalutazione.
//
// ASSUNZIONI dichiarate (nessuna confermata da Pmi 360° in dettaglio: correggetele se non corrispondono):
//  - RAL annua divisa per `mensilita` (13 o 14): ogni mensilità ordinaria e le aggiuntive (13ª a dicembre, 14ª
//    anche a giugno) valgono ral_annua/mensilita. Competenza e cassa coincidono nel mese di erogazione (nessun
//    rateo infra-mese, come per gli altri costi ricorrenti del motore).
//  - Contributi (INPS+INAIL, `contributi_pct` su ciascuna mensilità pagata) versati con F24 il 16 del mese
//    successivo, mai IVA. `sgravi.riduzione_contributi_pct` e' una PERCENTUALE DELL'ALIQUOTA (moltiplicativa: 100
//    = esonero totale, 50 = meta' dei contributi), non punti percentuali — chiarito con Pmi 360°.
//  - TFR = (ral_annua / 13,5) / 12 al mese (RAL/13,5 e' l'accantonamento ANNUO), SOLO Conto Economico: nessun
//    esborso di cassa. ECCEZIONE dichiarata da Pmi 360°, non ancora modellata: nelle aziende con almeno 50
//    dipendenti il TFR va versato ogni mese al Fondo Tesoreria INPS o alla previdenza complementare, quindi
//    sarebbe anche un'uscita di cassa mensile — da aggiungere quando ci invieranno `numero_dipendenti`.
//  - `numero_persone` moltiplica RAL, contributi, TFR, benefit e bonus (costi "per persona"); NON moltiplica
//    `costi_una_tantum` né `incentivo_esodo`, trattati come importi complessivi del processo.
//  - `movimento: "uscita"`: RAL/contributi/TFR diventano un RISPARMIO (segno invertito) dalla decorrenza a fine
//    finestra; `durata_mesi` non si applica alle uscite. `incentivo_esodo` è un costo e un esborso one-off alla
//    decorrenza, mai IVA.
//  - `bonus_variabile`: competenza e cassa concentrate tutte nel mese indicato (`mese_pagamento`), non spalmate.
//  - `costi_una_tantum`: array di {descrizione, importo}, esborso e competenza alla decorrenza (selezione, head
//    hunter, formazione), mai IVA (compensi a intermediari spesso soggetti a ritenuta, non IVA verso il datore).
export function generaPersonale(d, ctx) {
  const { ymDecorrenza, kMax } = ctx
  const n = d.numero_persone ?? 1
  const segno = d.movimento === 'uscita' ? -1 : 1
  const mensilitaAnnue = d.mensilita // 13 | 14
  const mensilitaExtra = mensilitaAnnue === 14 ? [6, 12] : [12] // mese (1-based) delle mensilità aggiuntive
  const rataMensile = (d.ral_annua / mensilitaAnnue) * n
  const tfrMensile = (d.ral_annua / 13.5 / 12) * n // RAL/13,5 e' l'accantonamento ANNUO: quota mensile = annuo/12
  const benefitMensile = ((d.benefit_annui || 0) / 12) * n

  // sgravi.riduzione_contributi_pct e' una PERCENTUALE DELL'ALIQUOTA (moltiplicativa), non punti percentuali: 100
  // = esonero totale qualunque sia contributi_pct, 50 = meta' dei contributi. Chiarito con Pmi 360° dopo che la
  // prima versione (sottrazione in punti) rendeva ambiguo un esonero al 100% su aliquote diverse.
  const sgraviAttivo = (k) => d.sgravi && k < Math.round(d.sgravi.durata_mesi)
  const contributiPct = (k) => (d.contributi_pct * (sgraviAttivo(k) ? 1 - d.sgravi.riduzione_contributi_pct / 100 : 1)) / 100

  const ce = []
  const cassa = []
  const nMax = d.durata_mesi != null && d.movimento === 'ingresso' ? Math.min(kMax, d.durata_mesi) : kMax
  for (let k = 0; k < nMax; k++) {
    const ym = addMesi(ymDecorrenza, k)
    const meseCal = ym % 100 // mese di calendario 1-12
    const mensilitaDelMese = 1 + (mensilitaExtra.includes(meseCal) ? 1 : 0)
    const retribuzioneMese = rataMensile * mensilitaDelMese * segno
    const contributiMese = retribuzioneMese * contributiPct(k)

    if (retribuzioneMese) {
      ce.push({ ym, importo: retribuzioneMese, categoria: 'costo_operativo' })
      cassa.push({ ym, giorniSfasamento: 0, importo: retribuzioneMese, direzione: retribuzioneMese > 0 ? 'uscita' : 'entrata', soggettoIva: false })
    }
    if (contributiMese) {
      ce.push({ ym, importo: contributiMese, categoria: 'costo_operativo' })
      const ymVers = addMesi(ym, 1)
      cassa.push({ ym: ymVers, giorniSfasamento: 0, importo: contributiMese, direzione: contributiMese > 0 ? 'uscita' : 'entrata', soggettoIva: false })
    }
    ce.push({ ym, importo: tfrMensile * segno, categoria: 'costo_operativo' }) // solo CE, nessuna cassa
    if (benefitMensile) {
      ce.push({ ym, importo: benefitMensile * segno, categoria: 'costo_operativo' })
      cassa.push({ ym, giorniSfasamento: 0, importo: benefitMensile * segno, direzione: benefitMensile * segno > 0 ? 'uscita' : 'entrata', soggettoIva: false })
    }
  }

  if (d.bonus_variabile) {
    const ymBonus = ymDaData(d.bonus_variabile.mese_pagamento)
    const importoBonus = d.bonus_variabile.importo_annuo * n * segno
    ce.push({ ym: ymBonus, importo: importoBonus, categoria: 'costo_operativo' })
    cassa.push({ ym: ymBonus, giorniSfasamento: 0, importo: importoBonus, direzione: importoBonus > 0 ? 'uscita' : 'entrata', soggettoIva: false })
  }
  for (const c of d.costi_una_tantum || []) {
    ce.push({ ym: ymDecorrenza, importo: c.importo, categoria: 'costo_operativo' })
    cassa.push({ ym: ymDecorrenza, giorniSfasamento: 0, importo: c.importo, direzione: 'uscita', soggettoIva: false })
  }
  if (d.movimento === 'uscita' && d.incentivo_esodo) {
    ce.push({ ym: ymDecorrenza, importo: d.incentivo_esodo, categoria: 'costo_operativo' })
    cassa.push({ ym: ymDecorrenza, giorniSfasamento: 0, importo: d.incentivo_esodo, direzione: 'uscita', soggettoIva: false })
  }

  const avvisi = []
  if (d.movimento === 'uscita') {
    avvisi.push({ codice: 'TFR_LIQUIDAZIONE_NON_MODELLATA', messaggio: 'Modellato solo il risparmio su RAL, contributi e accantonamento TFR da qui in avanti: l\'eventuale liquidazione in un\'unica soluzione del TFR già maturato (non tracciato da questo motore) non è inclusa.' })
  }
  const costoAnnuoPersona = round2((d.ral_annua) * (1 + d.contributi_pct / 100) + d.ral_annua / 13.5 + (d.benefit_annui || 0))
  return {
    ce, cassa, avvisi,
    meta: {
      titolo: d.movimento === 'uscita' ? 'L\'uscita simulata' : 'L\'assunzione simulata',
      righe: [
        ['Movimento', d.movimento === 'uscita' ? 'uscita' : 'ingresso'],
        ['Persone', String(n)],
        ['Inquadramento', d.inquadramento],
        ['RAL annua (per persona)', it(d.ral_annua) + ' €'],
        ['Mensilità', String(mensilitaAnnue)],
        ['Contributi (aliquota dichiarata dall\'azienda)', `${d.contributi_pct}%`],
        ['TFR (formula di legge: RAL / 13,5)', it(round2(d.ral_annua / 13.5)) + ' €/anno per persona'],
        ...(d.durata_mesi != null ? [['Durata contratto', `${d.durata_mesi} mesi`]] : [['Durata', 'tempo indeterminato']]),
        ...(d.sgravi ? [['Sgravio contributivo', `-${d.sgravi.riduzione_contributi_pct}% dell'aliquota per ${d.sgravi.durata_mesi} mesi`]] : []),
        ['Costo aziendale annuo stimato (per persona)', it(costoAnnuoPersona) + ' €'],
      ],
    },
    ipotesiSpecifiche: { costo_annuo_azienda_per_persona: costoAnnuoPersona },
  }
}

export const GENERATORI = {
  leasing: generaLeasing,
  acquisto_bene: generaAcquistoBene,
  finanziamento: generaFinanziamento,
  costo_ricorrente: generaCostoRicorrente,
  costo_una_tantum: generaCostoUnaTantum,
  personale: generaPersonale,
}
