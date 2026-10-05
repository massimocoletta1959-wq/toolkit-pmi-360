// Porting client-side del motore Tesoreria del vecchio backend FastAPI:
//   backend/engine/import_engine.py   -> parsing/validazione CSV, DSO/DPO/CCC
//   backend/engine/cashflow_engine.py -> piano 12 mesi, stress test, riconciliazione
//   backend/api/tesoreria/router.py   -> Layer 3 (budget economico -> scadenzario)
//
// Precisione: il backend usa Decimal, qui si usano Number con arrotondamento a
// 2 decimali dove il backend arrotonda esplicitamente — coerente con gli altri
// moduli già portati (Budget, Cash Flow, Scostamento).
//
// ESCLUSO da questo porting: import "Prima Nota" da PDF (backend/api/api_tesoreria.py
// + parser_prima_nota.py) — richiede parsing PDF lato server, non portato al client.

import { aggregaBudgetMensile, calcolaLiquidazioniIva, imposteAnnue } from './budgetMensile.js'

export const MESI_KEYS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export const MESI_NOMI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

const round2 = (n) => Math.round(n * 100) / 100
const round1 = (n) => Math.round(n * 10) / 10
const pad2 = (n) => String(n).padStart(2, '0')
const fmtN = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 0 })

const dateUTC = (y, m, d) => new Date(Date.UTC(y, m - 1, d)) // m 1-based
const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / 86400000)

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function splitCsvLine(line, sep) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === sep) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function parseCsvText(testo) {
  const sample = testo.slice(0, 1024)
  const sep = (sample.split(';').length - 1) > (sample.split(',').length - 1) ? ';' : ','
  const lines = testo.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return { header: [], rows: [] }

  const header = splitCsvLine(lines[0], sep).map((h) => h.trim().toLowerCase().replace(/ /g, '_').replace(/-/g, '_'))
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line, sep)
    const row = {}
    header.forEach((h, i) => {
      row[h] = (values[i] ?? '').trim()
    })
    return row
  })
  return { header, rows }
}

function parseDateFlexible(val) {
  if (!val || String(val).trim() === '') return null
  const v = String(val).trim()
  let m
  if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return dateUTC(+m[1], +m[2], +m[3])
  if ((m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) return dateUTC(+m[3], +m[2], +m[1])
  if ((m = v.match(/^(\d{2})-(\d{2})-(\d{4})$/))) return dateUTC(+m[3], +m[2], +m[1])
  if ((m = v.match(/^(\d{4})\/(\d{2})\/(\d{2})$/))) return dateUTC(+m[1], +m[2], +m[3])
  if ((m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/))) return dateUTC(+m[3], +m[2], +m[1])
  if ((m = v.match(/^(\d{4})(\d{2})(\d{2})$/))) return dateUTC(+m[1], +m[2], +m[3])
  return null
}

// ---------------------------------------------------------------------------
// Normalizzazione colonne
// ---------------------------------------------------------------------------

const COLONNE_SCADENZARIO = {
  controparte: ['controparte', 'cliente', 'fornitore', 'ragione_sociale', 'nome'],
  importo: ['importo', 'importo_fattura', 'totale', 'amount'],
  data_fattura: ['data_fattura', 'data_emissione', 'invoice_date', 'data'],
  data_scadenza: ['data_scadenza', 'scadenza', 'due_date', 'payment_due'],
  data_incasso_effettivo: ['data_incasso', 'data_pagamento', 'paid_date', 'incassato_il'],
  giorni_dilazione: ['giorni_dilazione', 'termini_pagamento', 'payment_terms', 'gg_dilazione'],
  categoria: ['categoria', 'tipo', 'category'],
  note: ['note', 'notes', 'descrizione'],
}

function normalizzaColonne(header, rows, direzione) {
  const errors = []
  const renameMap = {}
  for (const [campo, alias] of Object.entries(COLONNE_SCADENZARIO)) {
    for (const a of alias) {
      if (header.includes(a)) {
        renameMap[a] = campo
        break
      }
    }
  }
  const rowsRenamed = rows.map((r) => {
    const nr = {}
    for (const [k, v] of Object.entries(r)) nr[renameMap[k] || k] = v
    return nr
  })
  const colonneEffettive = new Set(Object.values(renameMap))
  for (const col of ['controparte', 'importo', 'data_scadenza']) {
    if (!colonneEffettive.has(col)) {
      errors.push({
        riga: 0,
        campo: col,
        messaggio: `Colonna obbligatoria '${col}' non trovata nel CSV. Nomi accettati: ${COLONNE_SCADENZARIO[col].join(', ')}`,
        bloccante: true,
        codice: 'COLONNA_MANCANTE',
      })
    }
  }
  for (const r of rowsRenamed) {
    if (r.data_fattura === undefined) r.data_fattura = r.data_scadenza || ''
    if (r.giorni_dilazione === undefined) r.giorni_dilazione = '30'
    if (r.categoria === undefined) r.categoria = direzione === 'entrata' ? 'incassi_clienti' : 'pagamenti_fornitori'
    if (r.note === undefined) r.note = ''
    if (r.data_incasso_effettivo === undefined) r.data_incasso_effettivo = ''
  }
  return { rows: rowsRenamed, errors }
}

// ---------------------------------------------------------------------------
// Validazione riga
// ---------------------------------------------------------------------------

function validaRiga(row, rigaNum, direzione) {
  const errors = []

  const importoStr = String(row.importo ?? '').trim().replace(/\./g, '').replace(',', '.')
  const importo = parseFloat(importoStr)
  if (Number.isNaN(importo)) {
    errors.push({ riga: rigaNum, campo: 'importo', messaggio: `Importo non valido: '${row.importo ?? ''}'. Usare formato numerico (es. 1234.56)`, bloccante: true, codice: 'IMPORTO_INVALIDO' })
    return { riga: null, errors }
  }
  if (importo < 0) {
    errors.push({ riga: rigaNum, campo: 'importo', messaggio: `Importo negativo (${importo}). Gli importi devono essere positivi. La direzione (entrata/uscita) determina il segno nel cash flow.`, bloccante: true, codice: 'IMPORTO_NEGATIVO' })
    return { riga: null, errors }
  }
  if (importo === 0) {
    errors.push({ riga: rigaNum, campo: 'importo', messaggio: 'Importo zero — riga ignorata.', bloccante: false, codice: 'IMPORTO_ZERO' })
  }

  const dataScadenza = parseDateFlexible(row.data_scadenza)
  if (!dataScadenza) {
    errors.push({ riga: rigaNum, campo: 'data_scadenza', messaggio: `Data scadenza non valida: '${row.data_scadenza ?? ''}'. Formati accettati: YYYY-MM-DD, DD/MM/YYYY`, bloccante: true, codice: 'DATA_INVALIDA' })
    return { riga: null, errors }
  }
  const dataFattura = parseDateFlexible(row.data_fattura) || dataScadenza
  const dataIncasso = parseDateFlexible(row.data_incasso_effettivo)

  let giorniDilazione = parseInt(String(row.giorni_dilazione ?? '30').trim() || '30', 10)
  if (Number.isNaN(giorniDilazione)) giorniDilazione = 30

  const oggi = dateUTC(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())
  let giorniRitardo
  if (dataIncasso) giorniRitardo = Math.max(0, daysBetween(dataScadenza, dataIncasso))
  else if (dataScadenza < oggi) giorniRitardo = daysBetween(dataScadenza, oggi)
  else giorniRitardo = 0

  if (direzione === 'entrata' && giorniRitardo > 30 && !dataIncasso) {
    errors.push({ riga: rigaNum, campo: 'data_scadenza', messaggio: `Credito scaduto da ${giorniRitardo} giorni verso '${row.controparte ?? ''}'. ATTENZIONE: oltre 30gg costituisce segnale di allerta CCII art.3 c.4.`, bloccante: false, codice: 'PAST_DUE_30' })
  }
  if (direzione === 'uscita' && giorniRitardo > 90 && !dataIncasso) {
    errors.push({ riga: rigaNum, campo: 'data_scadenza', messaggio: `Debito verso fornitore scaduto da ${giorniRitardo} giorni. ATTENZIONE: oltre 90gg costituisce segnale di allerta CCII art.3 c.4.`, bloccante: false, codice: 'PAST_DUE_90' })
  }

  const tipoDato = dataIncasso ? 'certo' : 'stimato'
  const probabilita = tipoDato === 'certo' ? 100 : Math.max(60, Math.min(90, 100 - giorniRitardo))
  const categoria = String(row.categoria ?? '').trim().toLowerCase() || (direzione === 'entrata' ? 'incassi_clienti' : 'pagamenti_fornitori')
  const meseBudget = dataScadenza.getUTCFullYear() * 100 + (dataScadenza.getUTCMonth() + 1)

  return {
    riga: {
      direzione,
      categoria,
      controparte: String(row.controparte ?? '').trim(),
      importo,
      dataFattura,
      dataScadenza,
      dataIncassoEffettivo: dataIncasso,
      giorniDilazione,
      giorniRitardo,
      tipoDato,
      probabilita,
      note: String(row.note ?? '').trim(),
      meseBudget,
    },
    errors,
  }
}

// ---------------------------------------------------------------------------
// Validation rules CNDCEC §2.5k sull'intero dataset
// ---------------------------------------------------------------------------

const CATEGORIE_STAGIONALI = new Set(['utenze', 'riscaldamento', 'energia', 'manutenzione', 'manutenzione_straordinaria', 'premi_produzione', 'ferie_permessi'])

function validaStagionalita(righe) {
  const perCategoria = {}
  for (const r of righe) {
    if (CATEGORIE_STAGIONALI.has(r.categoria)) {
      ;(perCategoria[r.categoria] ||= []).push(r.importo)
    }
  }
  const errori = []
  for (const [categoria, importi] of Object.entries(perCategoria)) {
    if (importi.length < 6) continue
    const media = importi.reduce((a, b) => a + b, 0) / importi.length
    const varianza = importi.reduce((a, b) => a + (b - media) ** 2, 0) / importi.length
    const cv = media > 0 ? Math.sqrt(varianza) / media : 0
    if (cv < 0.02) {
      errori.push({
        riga: 0,
        campo: 'categoria',
        messaggio: `Categoria '${categoria}' ha importi quasi identici su tutti i mesi (variazione ${(cv * 100).toFixed(1)}%). Probabilmente stai usando medie annuali. CNDCEC §2.5k richiede distribuzione stagionale corretta: concentrare riscaldamento in inverno, manutenzione nel fermo macchine, premi a fine anno.`,
        bloccante: true,
        codice: 'STAGIONALITA_MANCANTE',
      })
    }
  }
  return errori
}

function validaIvaSeparata(righe) {
  let sospetti = 0
  for (const r of righe) {
    for (const aliquota of [1.22, 1.1, 1.04]) {
      const imponibile = round2(r.importo / aliquota)
      const iva = round2(r.importo - imponibile)
      if (Math.abs(iva - Math.round(iva)) < 0.01 && iva > 0) {
        sospetti++
        break
      }
    }
  }
  if (sospetti > righe.length * 0.6) {
    return [{ riga: 0, campo: 'importo', messaggio: `${sospetti}/${righe.length} importi sembrano includere IVA. CNDCEC §2.5k: separare sempre i flussi imponibili dalle imposte. Importare gli importi al netto IVA e gestire i versamenti IVA come flusso separato con calendario specifico (16 del mese).`, bloccante: true, codice: 'IVA_NON_SEPARATA' }]
  }
  return []
}

function validaConcentrazione(righe, direzione) {
  if (direzione !== 'entrata') return { warnings: [], concentrazionePct: null, alert: false }
  const perCliente = {}
  let totale = 0
  for (const r of righe) {
    perCliente[r.controparte] = (perCliente[r.controparte] || 0) + r.importo
    totale += r.importo
  }
  if (totale === 0) return { warnings: [], concentrazionePct: null, alert: false }
  let topCliente = null
  let topVal = -1
  for (const [k, v] of Object.entries(perCliente)) {
    if (v > topVal) {
      topVal = v
      topCliente = k
    }
  }
  const topPct = round1((topVal / totale) * 100)
  if (topPct > 40) {
    return {
      warnings: [{ riga: 0, campo: 'controparte', messaggio: `'${topCliente}' rappresenta il ${topPct}% del fatturato importato. CNDCEC §2.5k: con concentrazione > 40% è obbligatorio creare uno scenario stress specifico 'senza questo cliente'. Procedere con l'import ma generare automaticamente lo scenario di concentrazione.`, bloccante: false, codice: 'CONCENTRAZIONE_CLIENTE' }],
      concentrazionePct: topPct,
      alert: true,
    }
  }
  return { warnings: [], concentrazionePct: topPct, alert: false }
}

function validaDsoBudget(dsoBudget, dsoStorico) {
  const delta = dsoStorico - dsoBudget
  if (delta > 15) {
    return [{ riga: 0, campo: 'dso', messaggio: `DSO budget (${dsoBudget.toFixed(0)}gg) è ${delta.toFixed(0)} giorni inferiore al DSO storico (${dsoStorico.toFixed(0)}gg). CNDCEC §2.5k: non budgettare un DSO ottimistico senza evidenza concreta di miglioramento del recupero crediti. Usare il DSO storico come base minima o fornire una giustificazione.`, bloccante: true, codice: 'DSO_SOTTOSTIMATO' }]
  }
  return []
}

// ---------------------------------------------------------------------------
// KPI: DSO / DPO / CCC
// ---------------------------------------------------------------------------

function calcolaDso(righe, direzione) {
  if (direzione !== 'entrata') return null
  const giorniList = []
  for (const r of righe) {
    let giorni
    if (r.dataIncassoEffettivo) giorni = daysBetween(r.dataFattura, r.dataIncassoEffettivo)
    else if (r.dataScadenza) giorni = r.giorniDilazione + r.giorniRitardo
    else continue
    if (giorni > 0) giorniList.push(giorni)
  }
  if (!giorniList.length) return null
  const importi = righe.filter((r) => r.importo > 0).map((r) => r.importo)
  let dso
  if (importi.length === giorniList.length) {
    const totale = importi.reduce((a, b) => a + b, 0)
    dso = totale > 0 ? giorniList.reduce((s, g, i) => s + g * importi[i], 0) / totale : giorniList.reduce((a, b) => a + b, 0) / giorniList.length
  } else {
    dso = giorniList.reduce((a, b) => a + b, 0) / giorniList.length
  }
  return round1(dso)
}

function calcolaDpo(righe, direzione) {
  if (direzione !== 'uscita') return null
  const giorniList = righe.filter((r) => r.giorniDilazione > 0).map((r) => r.giorniDilazione + Math.max(0, r.giorniRitardo))
  if (!giorniList.length) return null
  return round1(giorniList.reduce((a, b) => a + b, 0) / giorniList.length)
}

function calcolaCcc(dso, dpo, dio = 50) {
  if (dso == null && dpo == null) return null
  return (dso || 0) + dio - (dpo || 0)
}

// ---------------------------------------------------------------------------
// Import CSV — entry point (equivalente ImportEngine.importa_csv)
// ---------------------------------------------------------------------------

export function importaCsv(testo, direzione, { dsoStoricoGiorni = null, dsoBudgetGiorni = null } = {}) {
  const result = { righeImportate: 0, righeScartate: 0, errori: [], warnings: [], dsoCalcolato: null, dpoCalcolato: null, cccCalcolato: null, concentrazioneTopClientePct: null, alertConcentrazione: false, righe: [] }

  const { header, rows } = parseCsvText(testo)
  const { rows: rowsNorm, errors: colErrors } = normalizzaColonne(header, rows, direzione)
  result.errori.push(...colErrors)
  if (result.errori.some((e) => e.bloccante)) return result

  const righeValide = []
  rowsNorm.forEach((row, idx) => {
    const rigaNum = idx + 2
    const { riga, errors } = validaRiga(row, rigaNum, direzione)
    if (errors.some((e) => e.bloccante)) {
      result.errori.push(...errors)
      result.righeScartate++
    } else {
      result.warnings.push(...errors.filter((e) => !e.bloccante))
      if (riga) {
        righeValide.push(riga)
        result.righeImportate++
      }
    }
  })
  result.righe = righeValide
  if (!righeValide.length) return result

  result.errori.push(...validaStagionalita(righeValide))
  result.errori.push(...validaIvaSeparata(righeValide))
  const conc = validaConcentrazione(righeValide, direzione)
  result.warnings.push(...conc.warnings)
  result.concentrazioneTopClientePct = conc.concentrazionePct
  result.alertConcentrazione = conc.alert

  result.dsoCalcolato = calcolaDso(righeValide, direzione)
  result.dpoCalcolato = calcolaDpo(righeValide, direzione)
  result.cccCalcolato = calcolaCcc(result.dsoCalcolato, result.dpoCalcolato)

  if (dsoBudgetGiorni && dsoStoricoGiorni) {
    result.errori.push(...validaDsoBudget(dsoBudgetGiorni, dsoStoricoGiorni))
  }

  return result
}

export const haErroriBloccanti = (result) => result.errori.some((e) => e.bloccante)
export const successoImport = (result) => !haErroriBloccanti(result) && result.righeImportate > 0

// ---------------------------------------------------------------------------
// Layer 3 — budget economico -> righe scadenzario (equivalente _carica_righe_da_budget)
// ---------------------------------------------------------------------------

export { isPersonale } from './budgetMensile.js'

const PROB_BUDGET = 75
const PROB_CERTO = 100
const PROB_PERSONALE = 100
const PROB_PROIEZIONE = 60

// Il budget e' NETTO (vedi budgetMensile.js): l'IVA si aggiunge sopra solo alle
// voci con soggetto_iva. Incassi e pagamenti sono quindi al lordo IVA, e il
// versamento IVA a ogni liquidazione e' il saldo (vendite - acquisti) per
// competenza, con l'eventuale credito riportato al periodo successivo. Cosi'
// l'IVA incide sul timing della cassa ma non sul risultato complessivo.
export function caricaRigheDaBudget(azienda, vociBudget, dsoGiorni, dpoGiorni, anno, meseInizio, investimenti = [], manovreScorte = []) {
  if (!vociBudget || !vociBudget.length) return []

  const liquidazione = azienda.liquidazione_iva || 'trimestrale'

  // Finestra sempre di 12 mesi da meseInizio (coerente con l'orizzonte
  // CNDCEC §2.5): i mesi che superano dicembre di "anno" replicano lo stesso
  // mese di calendario del budget di "anno" — un budget "virtuale" dell'anno
  // successivo uguale a quello approvato, in attesa di uno vero (§3.2).
  const mesi = aggregaBudgetMensile(vociBudget, azienda, anno, meseInizio, 12, investimenti, manovreScorte)
  const righe = []

  mesi.forEach((m, i) => {
    const meseAssoluto = meseInizio + i
    const mese1 = m.mese
    const annoCorrente = m.anno
    const meseKey = MESI_KEYS[mese1 - 1]
    const dataCompetenza = dateUTC(annoCorrente, mese1, 1)
    const probabilitaVariabile = m.replica ? PROB_PROIEZIONE : PROB_BUDGET
    const etichettaAnno = m.replica ? `${annoCorrente} (=budget ${anno})` : `${anno}`

    const dataScadenzaAssoluta = (offsetMesi, giorno) => {
      const target = meseAssoluto + offsetMesi
      const meseT = ((target - 1) % 12) + 1
      const annoT = anno + Math.floor((target - 1) / 12)
      return { data: dateUTC(annoT, meseT, giorno), meseBudget: annoT * 100 + meseT }
    }

    // DSO/DPO non multipli di 30 giorni: il flusso si ripartisce sui due mesi vicini in
    // proporzione ai giorni (45gg = meta' a +1 mese e meta' a +2), cosi' il ritardo medio
    // resta esattamente il DSO/DPO misurato invece di essere arrotondato al mese intero (§2.2).
    const ripartisci = (giorni, giornoMese) => {
      const offset = Math.max(0, giorni) / 30
      const lo = Math.floor(offset)
      const w = offset - lo
      const parti = []
      if (w < 0.999) parti.push({ ...dataScadenzaAssoluta(lo, giornoMese), peso: 1 - w })
      if (w > 0.001) parti.push({ ...dataScadenzaAssoluta(lo + 1, giornoMese), peso: w })
      return parti
    }

    if (m.cassa.incassi > 0) {
      for (const { data: dataIncasso, meseBudget: meseBudgetR, peso } of ripartisci(dsoGiorni, 28)) {
        righe.push({ direzione: 'entrata', categoria: 'incassi_clienti_budget', controparte: `Clienti — budget ${etichettaAnno}`, importo: m.cassa.incassi * peso, dataFattura: dataCompetenza, dataScadenza: dataIncasso, dataIncassoEffettivo: null, giorniDilazione: Math.round(dsoGiorni), giorniRitardo: 0, tipoDato: 'variabile', probabilita: probabilitaVariabile, note: `Layer 3: ricavi budget ${etichettaAnno}/${meseKey} (netti + IVA) → incasso con DSO ${dsoGiorni.toFixed(0)}gg`, meseBudget: meseBudgetR })
      }
    }

    if (m.cassa.fornitori > 0) {
      for (const { data: dataPag, meseBudget: meseBudgetC, peso } of ripartisci(dpoGiorni, 15)) {
        righe.push({ direzione: 'uscita', categoria: 'fornitori_budget', controparte: `Fornitori — budget ${etichettaAnno}`, importo: m.cassa.fornitori * peso, dataFattura: dataCompetenza, dataScadenza: dataPag, dataIncassoEffettivo: null, giorniDilazione: Math.round(dpoGiorni), giorniRitardo: 0, tipoDato: 'variabile', probabilita: probabilitaVariabile, note: `Layer 3: costi variabili budget ${etichettaAnno}/${meseKey} (netti + IVA) → pagamento con DPO ${dpoGiorni.toFixed(0)}gg`, meseBudget: meseBudgetC })
      }
    }

    if (m.cassa.energia > 0) {
      for (const { data: dataPag, meseBudget: meseBudgetE, peso } of ripartisci(dpoGiorni, 15)) {
        righe.push({ direzione: 'uscita', categoria: 'fornitori_energia', controparte: `Energia — budget ${etichettaAnno}`, importo: m.cassa.energia * peso, dataFattura: dataCompetenza, dataScadenza: dataPag, dataIncassoEffettivo: null, giorniDilazione: Math.round(dpoGiorni), giorniRitardo: 0, tipoDato: 'variabile', probabilita: probabilitaVariabile, note: `Layer 3: costi energetici budget ${etichettaAnno}/${meseKey} (netti + IVA) → pagamento con DPO ${dpoGiorni.toFixed(0)}gg`, meseBudget: meseBudgetE })
      }
    }

    // investimenti pianificati: esborso per tranche, nel mese della tranche (§2.5f)
    if (m.cassa.investimenti > 0) {
      righe.push({ direzione: 'uscita', categoria: 'investimenti', controparte: 'Investimenti pianificati', importo: m.cassa.investimenti, dataFattura: dataCompetenza, dataScadenza: dateUTC(annoCorrente, mese1, 15), dataIncassoEffettivo: null, giorniDilazione: 0, giorniRitardo: 0, tipoDato: 'variabile', probabilita: PROB_CERTO, note: `Investimenti pianificati ${etichettaAnno}/${meseKey} (tranche + IVA)`, meseBudget: annoCorrente * 100 + mese1 })
    }

    // scorte (§2.3): incrementi e acquisti a lotto escono, le riduzioni programmate riducono gli acquisti
    if (m.cassa.scorte !== 0) {
      const esce = m.cassa.scorte > 0
      righe.push({ direzione: esce ? 'uscita' : 'entrata', categoria: esce ? 'scorte' : 'riduzione_scorte', controparte: esce ? 'Scorte e acquisti a lotto' : 'Riduzione scorte (minori acquisti)', importo: Math.abs(m.cassa.scorte), dataFattura: dataCompetenza, dataScadenza: dateUTC(annoCorrente, mese1, 15), dataIncassoEffettivo: null, giorniDilazione: 0, giorniRitardo: 0, tipoDato: 'variabile', probabilita: PROB_CERTO, note: `Manovre sulle scorte ${etichettaAnno}/${meseKey} (con IVA)`, meseBudget: annoCorrente * 100 + mese1 })
    }

    // contributi previdenziali: F24 il 16 del mese successivo, uscita certa (§2.5b)
    if (m.cassa.contributi > 0) {
      const meseV = (mese1 % 12) + 1
      const annoV = mese1 < 12 ? annoCorrente : annoCorrente + 1
      righe.push({ direzione: 'uscita', categoria: 'contributi', controparte: 'INPS/INAIL — contributi', importo: m.cassa.contributi, dataFattura: dataCompetenza, dataScadenza: dateUTC(annoV, meseV, 16), dataIncassoEffettivo: null, giorniDilazione: 0, giorniRitardo: 0, tipoDato: 'certo', probabilita: PROB_CERTO, note: `Contributi budget ${etichettaAnno}/${meseKey}: versamento F24 il 16 del mese successivo`, meseBudget: annoV * 100 + meseV })
    }

    if (m.cassa.personale > 0) {
      righe.push({ direzione: 'uscita', categoria: 'personale', controparte: 'Personale dipendente', importo: m.cassa.personale, dataFattura: dataCompetenza, dataScadenza: dateUTC(annoCorrente, mese1, 27), dataIncassoEffettivo: null, giorniDilazione: 0, giorniRitardo: 0, tipoDato: 'certo', probabilita: PROB_PERSONALE, note: `Layer 1: personale budget ${etichettaAnno}/${meseKey} (uscita certa)`, meseBudget: annoCorrente * 100 + mese1 })
    }
  })

  // Imposte sul reddito: acconti al 30 giugno (50%) e al 30 novembre (50%), calcolati sull'imposta annua a
  // budget (ipotesi: acconti pari all'imposta a budget; il saldo dell'anno precedente non e' noto). Dati certi.
  const imposte = imposteAnnue(vociBudget)
  if (imposte > 0) {
    const inFinestra = new Set(mesi.map((mm) => mm.mese_budget))
    for (const y of [anno, anno + 1]) {
      for (const [meseAcc, quota] of [[6, 0.5], [11, 0.5]]) {
        if (!inFinestra.has(y * 100 + meseAcc)) continue
        righe.push({ direzione: 'uscita', categoria: 'imposte', controparte: `Erario — acconto imposte sul reddito ${quota * 100}%`, importo: round2(imposte * quota), dataFattura: dateUTC(y, meseAcc, 1), dataScadenza: dateUTC(y, meseAcc, 30), dataIncassoEffettivo: null, giorniDilazione: 0, giorniRitardo: 0, tipoDato: 'certo', probabilita: PROB_CERTO, note: `Acconto ${quota * 100}% dell'imposta a budget (${imposte.toFixed(0)}€), scadenza 30/${pad2(meseAcc)}/${y}`, meseBudget: y * 100 + meseAcc })
      }
    }
  }

  for (const p of calcolaLiquidazioniIva(mesi, liquidazione)) {
    if (p.versamento <= 0) continue
    const annoV = Math.floor(p.mese_versamento / 100)
    const meseV = p.mese_versamento % 100
    righe.push({ direzione: 'uscita', categoria: 'iva', controparte: liquidazione === 'mensile' ? 'Erario — IVA mensile' : 'Erario — IVA trimestrale', importo: p.versamento, dataFattura: dateUTC(annoV, meseV, 1), dataScadenza: dateUTC(annoV, meseV, p.giorno_versamento), dataIncassoEffettivo: null, giorniDilazione: 0, giorniRitardo: 0, tipoDato: 'certo', probabilita: PROB_CERTO, note: `IVA ${liquidazione} competenza ${p.da}–${p.a}: vendite ${p.iva_vendite.toFixed(0)} − acquisti ${p.iva_acquisti.toFixed(0)}${p.credito_precedente ? ` − credito riportato ${p.credito_precedente.toFixed(0)}` : ''}`, meseBudget: p.mese_versamento })
  }

  return righe
}

// Rate dei finanziamenti dichiarati in anagrafica (piano di ammortamento: capitale + interessi), §2.5a/§2.5b.
// Dato certo, con la data effettiva di ogni rata. Rate mensili o trimestrali dalla prossima rata, per il
// numero di rate residue, dentro la finestra della proiezione.
export function caricaRigheFinanziamenti(finanziamenti, meseInizio, orizzonteMesi) {
  const righe = []
  const [aInizio, mInizio] = meseInizio
  const inizioAss = aInizio * 12 + (mInizio - 1)
  for (const f of finanziamenti || []) {
    const [y0, m0, d0] = String(f.data_prossima_rata).split('-').map(Number)
    const passo = f.periodicita === 'trimestrale' ? 3 : 1
    for (let k = 0; k < f.numero_rate_residue; k++) {
      const ass = y0 * 12 + (m0 - 1) + k * passo
      if (ass < inizioAss || ass >= inizioAss + orizzonteMesi) continue
      const y = Math.floor(ass / 12)
      const m = (ass % 12) + 1
      const giorno = Math.min(d0, new Date(Date.UTC(y, m, 0)).getUTCDate()) // 31 -> ultimo giorno del mese
      righe.push({ direzione: 'uscita', categoria: 'rate_finanziamenti', controparte: `Rata — ${f.descrizione}`, importo: f.importo_rata, dataFattura: dateUTC(y, m, giorno), dataScadenza: dateUTC(y, m, giorno), dataIncassoEffettivo: null, giorniDilazione: 0, giorniRitardo: 0, tipoDato: 'certo', probabilita: 100, note: `Rata ${k + 1}/${f.numero_rate_residue} da piano di ammortamento dichiarato`, meseBudget: y * 100 + m })
    }
  }
  return righe
}

// Rate mutuo: non essendoci ancora uno scadenzario puntuale (previsto come
// sviluppo successivo), si riusa l'importo storico reale dello stesso mese di
// calendario (es. il mese proiettato di agosto usa l'importo dell'agosto
// storico piu' recente disponibile), coerente con rate a importo fisso da
// piano di ammortamento. storicoPerMese e' un oggetto {1: importo, ..., 12:
// importo}, con 0/assente nei mesi in cui storicamente non c'e' stata rata.
export function caricaRigheRateMutuo(storicoPerMese, anno, meseInizio, mesiOrizzonte) {
  const righe = []
  for (let i = 0; i < mesiOrizzonte; i++) {
    const meseAssoluto = meseInizio + i
    const meseCal = ((meseAssoluto - 1) % 12) + 1
    const annoEff = anno + Math.floor((meseAssoluto - 1) / 12)
    const importo = storicoPerMese?.[meseCal] || 0
    if (importo > 0) {
      righe.push({
        direzione: 'uscita',
        categoria: 'rate_mutuo',
        controparte: 'Rata mutuo (storico)',
        importo,
        dataFattura: dateUTC(annoEff, meseCal, 1),
        dataScadenza: dateUTC(annoEff, meseCal, 28),
        dataIncassoEffettivo: null,
        giorniDilazione: 0,
        giorniRitardo: 0,
        tipoDato: 'certo',
        probabilita: 100,
        note: `Rata mutuo storica (calendario mese ${pad2(meseCal)}) — in attesa dello scadenzario mutui puntuale`,
        meseBudget: annoEff * 100 + meseCal,
      })
    }
  }
  return righe
}

// ---------------------------------------------------------------------------
// Cash Flow Engine — piano 12 mesi + stress test (equivalente CashFlowEngine)
// ---------------------------------------------------------------------------

// §2.5d: scenario ottimistico "ipotesi base +10/15%", pessimistico "base -15/20%".
// Incassi: +10% / -20% (estremi prudenti degli intervalli); uscite variabili: -5% / +10%.
export const SCENARI_FATTORI = {
  ottimistico: { entrate: 1.1, uscite: 0.95 },
  pessimistico: { entrate: 0.8, uscite: 1.1 },
}

// §2.5k "Ignorare concentrazione rischi": esempio del documento, 40% del fatturato su un cliente
export const SOGLIA_CONCENTRAZIONE_PCT = 40

const STRESS_SCENARIOS = [
  { nome: 'Ritardo incassi -20%', riduzioneIncassiPct: 20, aumentoCostiPct: 0, bloccoCreditoGiorni: 0, descrizione: 'Riduzione incassi del 20% per ritardi commerciali (§2.5g)' },
  { nome: 'Energia +30% per 3 mesi', riduzioneIncassiPct: 0, aumentoCostiPct: 30, bloccoCreditoGiorni: 0, descrizione: 'Aumento del 30% delle sole voci energetiche del budget per 3 mesi (§2.5g)' },
  { nome: 'Blocco credito bancario 60gg', riduzioneIncassiPct: 0, aumentoCostiPct: 0, bloccoCreditoGiorni: 60, descrizione: 'Nessun accesso alle linee di credito per 60 giorni: liquidità + linee non utilizzate coprono il fabbisogno? (§2.5g)' },
  { nome: 'Scenario combinato (worst case)', riduzioneIncassiPct: 20, aumentoCostiPct: 30, bloccoCreditoGiorni: 60, descrizione: 'Combinazione dei tre shock, concorrenti (§2.4, §2.5g) — colloqui bancari EBA GL' },
]

function avanzaMese([anno, mese], n) {
  const meseTot = mese + n
  const anniExtra = Math.floor((meseTot - 1) / 12)
  return [anno + anniExtra, ((meseTot - 1) % 12) + 1]
}

const semaforoDa = (saldo, buffer) => (saldo > buffer ? 'verde' : saldo > 0 ? 'giallo' : 'rosso')

const voceDettaglio = (r, importo) => ({
  direzione: r.direzione,
  categoria: r.categoria,
  controparte: r.controparte,
  conto: r.conto || null,
  importo: round2(importo),
  data: r.dataScadenza instanceof Date && !isNaN(r.dataScadenza) ? r.dataScadenza.toISOString().slice(0, 10) : null,
  certo: r.tipoDato === 'certo',
  note: r.note || '',
})

function raggruppaPerMese(righe) {
  const perMese = {}
  for (const r of righe) {
    ;(perMese[r.meseBudget] ||= { entrate: [], uscite: [] })[r.direzione === 'entrata' ? 'entrate' : 'uscite'].push(r)
  }
  return perMese
}

// Linee di credito utilizzabili nel mese: si escludono quelle scadute. Per il fido di conto il saldo
// negativo E' gia' un utilizzo, quindi si confronta con l'accordato intero; per anticipi/factoring
// (l'anticipato non compare nel saldo di conto) vale accordato - utilizzato.
function disponibilitaLinee(lineeCredito, anno, mese) {
  const primoGiorno = Date.UTC(anno, mese - 1, 1)
  let tot = 0
  for (const l of lineeCredito?.linee || []) {
    if (l.scadenza && new Date(`${l.scadenza}T00:00:00Z`).getTime() < primoGiorno) continue
    tot += l.tipo === 'fido_conto_corrente' ? l.accordato : Math.max(0, l.accordato - l.utilizzato)
  }
  return tot
}

function stressTest(perMese, meseStart, scenario, saldoIniziale, fatturatoMedio, bufferPct, orizzonteMesi, lineeCredito = null) {
  const ridInc = scenario.riduzioneIncassiPct / 100
  const aumCost = scenario.aumentoCostiPct / 100
  const buffer = (fatturatoMedio * bufferPct) / 100
  const bloccoMesi = Math.floor(scenario.bloccoCreditoGiorni / 30)
  const dichiarate = lineeCredito?.dichiarate === true
  const haEnergia = Object.values(perMese).some((d) => d.uscite.some((r) => r.categoria === 'fornitori_energia'))

  // scenari che non si possono valutare con i dati disponibili: dichiarati "non applicabili", mai inventati
  const note = []
  if (scenario.aumentoCostiPct > 0 && !haEnergia) note.push('nessuna voce energetica riconosciuta nel budget (shock energia non applicato)')
  if (bloccoMesi > 0 && !dichiarate) note.push('linee di credito non dichiarate in anagrafica (blocco non valutabile)')
  const soloEnergia = scenario.aumentoCostiPct > 0 && ridInc === 0 && bloccoMesi === 0
  const soloBlocco = bloccoMesi > 0 && ridInc === 0 && scenario.aumentoCostiPct === 0
  if ((soloEnergia && !haEnergia) || (soloBlocco && !dichiarate)) {
    return { scenario_nome: scenario.nome, descrizione: scenario.descrizione, semaforo: 'nd', applicabile: false, saldo_minimo: null, mesi_in_rosso: 0, mese_critico: null, coperto: null, messaggio: `Scenario '${scenario.nome}': non applicabile — ${note.join('; ')}.` }
  }

  let saldo = saldoIniziale
  let mesiInRosso = 0
  let mesiScoperti = 0
  let saldoMinimo = 0
  let mesePeggiore = null
  let fabbisognoMax = 0
  let lineePicco = 0

  for (let i = 0; i < orizzonteMesi; i++) {
    const [anno, mese] = avanzaMese(meseStart, i)
    const mb = anno * 100 + mese
    const dati = perMese[mb] || { entrate: [], uscite: [] }
    // partenza = stesso BASE del piano (entrate variabili pesate per probabilita'),
    // altrimenti lo stress risulterebbe meno severo del base stesso
    const entrate = dati.entrate.reduce((s, r) => s + (r.tipoDato === 'certo' ? r.importo : (r.importo * r.probabilita) / 100), 0)
    const uscite = dati.uscite.reduce((s, r) => s + r.importo, 0)
    const energia = dati.uscite.filter((r) => r.categoria === 'fornitori_energia').reduce((s, r) => s + r.importo, 0)

    // §2.5g: +30% dei SOLI costi energetici, per 3 mesi
    const usciteStress = uscite + (aumCost > 0 && i < 3 ? energia * aumCost : 0)
    saldo = saldo + entrate * (1 - ridInc) - usciteStress

    if (saldo < 0) {
      mesiInRosso++
      const deficit = -saldo
      const disp = bloccoMesi > 0 && i < bloccoMesi && dichiarate ? 0 : disponibilitaLinee(lineeCredito, anno, mese)
      if (deficit > fabbisognoMax) {
        fabbisognoMax = deficit
        lineePicco = disp
      }
      if (dichiarate && deficit > disp) mesiScoperti++
      if (saldo < saldoMinimo) {
        saldoMinimo = saldo
        mesePeggiore = mb
      }
    }
  }

  // con linee dichiarate (anche zero) si verifica la copertura; senza, regola prudenziale precedente
  const semaforo = mesiInRosso === 0 ? 'verde' : dichiarate ? (mesiScoperti === 0 ? 'giallo' : 'rosso') : mesiInRosso <= 2 ? 'giallo' : 'rosso'
  const nota = note.length ? ` Nota: ${note.join('; ')}.` : ''
  let messaggio
  if (semaforo === 'verde') messaggio = `Scenario '${scenario.nome}': liquidità sufficiente. Nessun mese in rosso.${nota}`
  else if (dichiarate && semaforo === 'giallo') messaggio = `Scenario '${scenario.nome}': saldo negativo in ${mesiInRosso} mese/i ma coperto dalle linee di credito (fabbisogno massimo ${fmtN(fabbisognoMax)}€, linee disponibili ${fmtN(lineePicco)}€).${nota}`
  else if (dichiarate) messaggio = `Scenario '${scenario.nome}': CRITICO. Fabbisogno massimo ${fmtN(fabbisognoMax)}€ NON coperto: linee disponibili nel mese critico ${fmtN(lineePicco)}€, ${mesiScoperti} mese/i scoperti. Azioni: accelerare incassi, posticipare investimenti, rinegoziare le linee.${nota}`
  else if (semaforo === 'giallo') messaggio = `Scenario '${scenario.nome}': attenzione. ${mesiInRosso} mese/i con saldo negativo (fabbisogno massimo ${fmtN(fabbisognoMax)}€). Copertura non verificabile: linee di credito non dichiarate in anagrafica.${nota}`
  else messaggio = `Scenario '${scenario.nome}': CRITICO. ${mesiInRosso} mesi in rosso, fabbisogno massimo ${fmtN(fabbisognoMax)}€. Copertura non verificabile: linee di credito non dichiarate in anagrafica.${nota}`

  const meseCriticoLabel = mesePeggiore ? `${MESI_NOMI[(mesePeggiore % 100) - 1]} ${Math.floor(mesePeggiore / 100)}` : null

  return { scenario_nome: scenario.nome, descrizione: scenario.descrizione, semaforo, applicabile: true, saldo_minimo: round2(saldoMinimo), mesi_in_rosso: mesiInRosso, mese_critico: meseCriticoLabel, fabbisogno_max: round2(fabbisognoMax), linee_disponibili: round2(lineePicco), mesi_scoperti: mesiScoperti, coperto: dichiarate ? mesiScoperti === 0 : null, buffer_riferimento: round2(buffer), messaggio }
}

function riconciliaCompetenzaCassa(righe, dso) {
  const totaleFatturato = righe.filter((r) => r.direzione === 'entrata').reduce((s, r) => s + r.importo, 0)
  const totaleIncassato = righe.filter((r) => r.direzione === 'entrata' && r.dataIncassoEffettivo).reduce((s, r) => s + r.importo, 0)
  const delta = totaleFatturato - totaleIncassato
  let nota
  if (delta === 0) nota = 'Nessun delta: tutti i crediti risultano incassati.'
  else if (delta > 0) nota = `Crediti aperti: ${fmtN(delta)}€ di fatturato non ancora incassato. Con DSO attuale (${dso ?? '?'}gg) si stima un assorbimento di liquidità di circa ${fmtN(delta)}€ nel prossimo periodo. Verificare posizioni scadute e attivare solleciti.`
  else nota = `Incassi anticipati: ${fmtN(Math.abs(delta))}€ incassati prima della competenza (es. acconti, pagamenti anticipati).`
  return [round2(delta), nota]
}

// Batteria di stress test (§2.5g) sullo stesso BASE del piano. perMese: { AAAAMM: { entrate: [...], uscite: [...] } }.
// Esportata perche' il motore d'impatto la riesegue sulla proiezione con la decisione applicata.
export function eseguiStressTests({ perMese, meseStart, saldoIniziale, fatturatoMedio, bufferPct, orizzonteMesi, lineeCredito = null, concentrazione = null }) {
  // §2.5k: con concentrazione oltre soglia serve uno scenario specifico "senza quel cliente"
  const scenariStress = concentrazione?.alert
    ? [...STRESS_SCENARIOS, { nome: `Perdita del cliente principale (${concentrazione.topPct}%)`, riduzioneIncassiPct: concentrazione.topPct, aumentoCostiPct: 0, bloccoCreditoGiorni: 0, descrizione: `Incassi ridotti della quota del cliente principale (${concentrazione.topCliente}), §2.5k` }]
    : STRESS_SCENARIOS
  return scenariStress.map((sc) => stressTest(perMese, meseStart, sc, saldoIniziale, fatturatoMedio, bufferPct, orizzonteMesi, lineeCredito))
}

export function calcolaPianoCashflow({ righe, saldoIniziale, fatturatoMedio, bufferPct = 15, orizzonteMesi = 12, dso = null, dpo = null, dio = null, meseInizio = null, concentrazione = null, lineeCredito = null }) {
  const oggi = new Date()
  // meseInizio: [anno, mese] esplicito, per ancorare la proiezione al mese
  // successivo all'ultimo consuntivo reale (Libro Giornale) invece che al mese
  // solare corrente — usato dalla proiezione "da reale" (vedi Tesoreria.js).
  const meseCorrente = meseInizio || [oggi.getFullYear(), oggi.getMonth() + 1]
  const perMese = raggruppaPerMese(righe)

  let saldoBase = saldoIniziale
  let saldoOtt = saldoIniziale
  let saldoPess = saldoIniziale
  const mesi = []

  for (let i = 0; i < orizzonteMesi; i++) {
    const [anno, mese] = avanzaMese(meseCorrente, i)
    const meseBudget = anno * 100 + mese
    const dati = perMese[meseBudget] || { entrate: [], uscite: [] }
    const buffer = (fatturatoMedio * bufferPct) / 100

    let entrateCerte = 0, entrateStimate = 0
    for (const r of dati.entrate) {
      if (r.tipoDato === 'certo') entrateCerte += r.importo
      else entrateStimate += (r.importo * r.probabilita) / 100
    }
    let usciteCerte = 0, usciteStimate = 0
    for (const r of dati.uscite) {
      if (r.tipoDato === 'certo') usciteCerte += r.importo
      else usciteStimate += r.importo
    }
    // Scenari ottimistico/pessimistico (§2.5d): variazioni percentuali rispetto al BASE
    // (gia' pesato per probabilita'), applicate solo alle componenti stimate; i flussi
    // certi (stipendi, IVA, rate, partite aperte) non variano. Cosi' ott >= base >= pess
    // in ogni mese, per costruzione.
    const entrateOtt = entrateCerte + entrateStimate * SCENARI_FATTORI.ottimistico.entrate
    const entratePess = entrateCerte + entrateStimate * SCENARI_FATTORI.pessimistico.entrate
    const usciteOtt = usciteCerte + usciteStimate * SCENARI_FATTORI.ottimistico.uscite
    const uscitePess = usciteCerte + usciteStimate * SCENARI_FATTORI.pessimistico.uscite

    const entrateBase = entrateCerte + entrateStimate
    const usciteBase = usciteCerte + usciteStimate
    saldoBase = saldoBase + entrateBase - usciteBase
    saldoOtt = saldoOtt + entrateOtt - usciteOtt
    saldoPess = saldoPess + entratePess - uscitePess

    mesi.push({
      anno, mese, mese_budget: meseBudget,
      entrate_certe: round2(entrateCerte), entrate_stimate: round2(entrateStimate),
      uscite_certe: round2(usciteCerte), uscite_stimate: round2(usciteStimate),
      uscite_energia: round2(dati.uscite.filter((r) => r.categoria === 'fornitori_energia').reduce((t, r) => t + r.importo, 0)),
      saldo_base: round2(saldoBase), saldo_ottimistico: round2(saldoOtt), saldo_pessimistico: round2(saldoPess),
      semaforo_base: semaforoDa(saldoBase, buffer), semaforo_ottimistico: semaforoDa(saldoOtt, buffer), semaforo_pessimistico: semaforoDa(saldoPess, buffer),
      buffer_minimo: round2(buffer),
      flusso_netto: round2(entrateBase - usciteBase),
      // singole partite del mese (scenario base), per il dettaglio cliccabile di entrate/uscite
      dettaglio: [
        ...dati.entrate.map((r) => voceDettaglio(r, r.tipoDato === 'certo' ? r.importo : (r.importo * r.probabilita) / 100)),
        ...dati.uscite.map((r) => voceDettaglio(r, r.importo)),
      ].filter((v) => v.importo !== 0),
    })
  }

  const stressTests = eseguiStressTests({ perMese, meseStart: meseCorrente, saldoIniziale, fatturatoMedio, bufferPct, orizzonteMesi, lineeCredito, concentrazione })
  const semaforoGlobale = mesi.some((m) => m.semaforo_base === 'rosso') ? 'rosso' : mesi.some((m) => m.semaforo_base === 'giallo') ? 'giallo' : 'verde'
  // DIO dall'anagrafica: 0 senza magazzino, valore dichiarato con magazzino, null se non dichiarato
  // (CCC parziale, senza componente DIO, invece di un DIO inventato — §2.5e)
  const cccMedio = dso != null && dpo != null ? dso + (dio ?? 0) - dpo : null
  const [deltaCompetenzaCassa, noteRiconciliazione] = riconciliaCompetenzaCassa(righe, dso)

  return {
    data_elaborazione: oggi.toISOString().slice(0, 10),
    orizzonte_mesi: orizzonteMesi,
    saldo_iniziale: saldoIniziale,
    buffer_minimo_pct: bufferPct,
    fatturato_mensile_medio: fatturatoMedio,
    semaforo_globale: semaforoGlobale,
    dso_medio: dso, dpo_medio: dpo, ccc_medio: cccMedio,
    mesi,
    stress_tests: stressTests,
    delta_competenza_cassa: deltaCompetenzaCassa,
    note_riconciliazione: noteRiconciliazione,
    errore_forecast_pct: null,
    concentrazione,
    dio_usato: dio,
    ccc_parziale: dio == null,
    linee_credito: lineeCredito
      ? { dichiarate: lineeCredito.dichiarate === true, n_linee: (lineeCredito.linee || []).length, accordato: (lineeCredito.linee || []).reduce((t, l) => t + l.accordato, 0), linee: (lineeCredito.linee || []).map((l) => ({ tipo: l.tipo, accordato: l.accordato, utilizzato: l.utilizzato, scadenza: l.scadenza || null })) }
      : { dichiarate: false, n_linee: 0, accordato: 0, linee: [] },
  }
}

export function calcolaErroreForecast(pianoPrecedente, consuntivoMese) {
  if (consuntivoMese == null || !pianoPrecedente?.mesi?.length) return null
  const previsto = pianoPrecedente.mesi[0].flusso_netto
  if (!previsto) return null
  return round1(((consuntivoMese - previsto) / Math.abs(previsto)) * 100)
}

// ---------------------------------------------------------------------------
// Validation rules CNDCEC §2.5k a livello KPI (equivalente _esegui_validation_rules)
// ---------------------------------------------------------------------------

// Concentrazione clienti sugli INCASSI per cliente dell'anno (Analisi dei flussi, dsoDpo.dso.dettaglio):
// e' il dato per cliente disponibile, non il fatturato. null = non calcolabile.
export function calcolaConcentrazioneClienti(dettaglioClienti) {
  const voci = (dettaglioClienti || []).filter((c) => (c.importoTotale || 0) > 0)
  const totale = voci.reduce((s, c) => s + c.importoTotale, 0)
  if (!voci.length || !totale) return null
  const top = voci.reduce((a, b) => (b.importoTotale > a.importoTotale ? b : a))
  const topPct = round1((top.importoTotale / totale) * 100)
  return { topCliente: top.descrizione || top.conto, topPct, sogliaPct: SOGLIA_CONCENTRAZIONE_PCT, alert: topPct > SOGLIA_CONCENTRAZIONE_PCT, base: 'incassi per cliente' }
}

// Ogni regola ritorna ok: true | false | null (null = non verificabile con i dati disponibili).
export function eseguiValidationRules({ dsoMisurato = null, dsoUsato = null, concentrazione = null, ultimoSnapshotIso }) {
  const result = {}

  // §2.5j: aggiornare i coefficienti se il DSO effettivo devia di oltre 5 giorni; §2.5k: non budgettare un DSO ottimistico
  if (dsoMisurato == null || dsoUsato == null) {
    result['VR-1'] = { ok: null, msg: 'DSO misurato non disponibile (serve l\'Analisi dei flussi con i tempi di incasso): non verificabile.' }
  } else if (dsoMisurato - dsoUsato > 5) {
    result['VR-1'] = { ok: false, msg: `DSO usato nel piano (${dsoUsato.toFixed(0)}gg) inferiore di ${(dsoMisurato - dsoUsato).toFixed(0)} giorni al DSO misurato (${dsoMisurato.toFixed(0)}gg): soglia 5 giorni (§2.5j, §2.5k).` }
  } else {
    result['VR-1'] = { ok: true, msg: `DSO del piano (${dsoUsato.toFixed(0)}gg) coerente col misurato (${dsoMisurato.toFixed(0)}gg)` }
  }

  if (!concentrazione) result['VR-4'] = { ok: null, msg: 'Concentrazione non calcolabile: manca il dettaglio incassi per cliente (Analisi dei flussi).' }
  else if (concentrazione.alert) result['VR-4'] = { ok: false, msg: `Il cliente principale pesa il ${concentrazione.topPct}% degli incassi (soglia ${concentrazione.sogliaPct}%): incluso lo scenario "senza quel cliente" tra gli stress test (§2.5k).` }
  else result['VR-4'] = { ok: true, msg: `Cliente principale al ${concentrazione.topPct}% degli incassi (soglia ${concentrazione.sogliaPct}%)` }

  if (ultimoSnapshotIso) {
    const giorni = Math.floor((Date.now() - new Date(ultimoSnapshotIso).getTime()) / 86400000)
    result['VR-5'] = giorni > 35 ? { ok: false, msg: `Forecast non aggiornato da ${giorni} giorni. Aggiornamento mensile obbligatorio (§3.2).` } : { ok: true, msg: `Aggiornato ${giorni}gg fa` }
  } else {
    result['VR-5'] = { ok: true, msg: 'Primo calcolo' }
  }

  return result
}

// Vista settimanale (13 settimane, check-list art. 13 CCII richiamata dal documento §1.1 e §2.5h): stessi flussi
// del piano mensile (entrate variabili pesate per probabilita', come il BASE), collocati nella settimana della loro
// data. I flussi da budget cadono al giorno 15/28 del mese: e' un'approssimazione dichiarata, le date esatte
// (partite aperte, IVA, F24, stipendi, rate) sono precise.
const isoGiorno = (d) => d.toISOString().slice(0, 10)
export function calcolaSettimane({ righe, inizio, saldoIniziale, buffer, settimane = 13 }) {
  const t0 = inizio.getTime()
  const giorniMs = 86400000
  const pesato = (r) => (r.direzione === 'entrata' ? (r.tipoDato === 'certo' ? r.importo : (r.importo * r.probabilita) / 100) : r.importo)
  const conData = righe.filter((r) => r.dataScadenza instanceof Date && r.dataScadenza.getTime() >= t0 && r.dataScadenza.getTime() < t0 + settimane * 7 * giorniMs)
  let saldo = saldoIniziale
  const out = []
  for (let w = 0; w < settimane; w++) {
    const dal = t0 + w * 7 * giorniMs
    const al = dal + 7 * giorniMs
    let entrate = 0
    let uscite = 0
    for (const r of conData) {
      const t = r.dataScadenza.getTime()
      if (t < dal || t >= al) continue
      if (r.direzione === 'entrata') entrate += pesato(r)
      else uscite += pesato(r)
    }
    saldo = saldo + entrate - uscite
    out.push({ dal: isoGiorno(new Date(dal)), al: isoGiorno(new Date(al - giorniMs)), entrate: round2(entrate), uscite: round2(uscite), saldo_fine: round2(saldo), semaforo: semaforoDa(saldo, buffer) })
  }
  // flussi netti per giorno: servono a confrontare la cassa reale registrata con il saldo previsto a una data qualsiasi
  const perGiorno = {}
  for (const r of conData) {
    const g = isoGiorno(r.dataScadenza)
    perGiorno[g] = (perGiorno[g] || 0) + (r.direzione === 'entrata' ? pesato(r) : -pesato(r))
  }
  const flussiGiornalieri = Object.entries(perGiorno).sort((a, b) => a[0].localeCompare(b[0])).map(([data, netto]) => ({ data, netto: round2(netto) }))
  return { settimane: out, flussi_giornalieri: flussiGiornalieri, inizio: isoGiorno(inizio), saldo_iniziale: saldoIniziale }
}

// Saldo previsto a fine giornata `dataIso`, dai flussi giornalieri della vista settimanale
export function saldoPrevistoAl(vista, dataIso) {
  if (!vista || dataIso < vista.inizio) return null
  return round2(vista.saldo_iniziale + vista.flussi_giornalieri.filter((f) => f.data <= dataIso).reduce((s, f) => s + f.netto, 0))
}

// Liquidity Coverage Ratio adattato alle PMI (§2.4): (cassa disponibile + linee non utilizzate) / uscite attese
// nei 30 giorni successivi in condizioni di stress (uscite variabili +10% come scenario pessimistico, incassi non
// contati). >= 100% = copertura. null se manca il dato.
export function calcolaLcrPmi({ saldoIniziale, lineeCredito, primoMese }) {
  if (!primoMese) return null
  const uscite = primoMese.uscite_certe + primoMese.uscite_stimate * SCENARI_FATTORI.pessimistico.uscite
  if (!(uscite > 0)) return null
  const linee = (lineeCredito?.linee || []).reduce((t, l) => t + Math.max(0, l.accordato - l.utilizzato), 0)
  const dichiarate = lineeCredito?.dichiarate === true
  const liquidita = Math.max(0, saldoIniziale)
  return { lcr_pct: round1(((liquidita + linee) / uscite) * 100), cassa: round2(liquidita), linee_non_utilizzate: round2(linee), linee_dichiarate: dichiarate, uscite_stress_30gg: round2(uscite) }
}
