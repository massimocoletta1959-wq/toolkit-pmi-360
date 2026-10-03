// Porting client-side di backend/api/analisi_narrativa.py (calcola_indici,
// costruisci_prompt) — la chiamata AI vera e propria passa dalla Edge Function
// "genera-narrativa" (stesso pattern di "estrai-documento").

const MESI_IT = ['', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

function giorniDaInizioAnno(anno, meseFine) {
  const fine = meseFine >= 12 ? new Date(Date.UTC(anno + 1, 0, 1)) : new Date(Date.UTC(anno, meseFine, 1))
  const inizio = new Date(Date.UTC(anno, 0, 1))
  return Math.round((fine.getTime() - inizio.getTime()) / 86400000)
}

function periodoLabel(annoInt, meseFine, isInfrannuale) {
  if (!annoInt) return 'Esercizio non determinato'
  if (isInfrannuale) return `1 gennaio – ${MESI_IT[meseFine]} ${annoInt} (${meseFine} mesi, dato provvisorio/infrannuale)`
  return `Esercizio ${annoInt} (12 mesi, dato annuale)`
}

// Estrae i dati da un documento, gestendo sia JSON diretto che risposte AI
// avvolte in {testo_grezzo: "```json...```"} — stessa logica di estrai_dati.
export function estraiDati(doc) {
  if (!doc || !doc.dati_estratti) return null
  try {
    let raw = JSON.parse(doc.dati_estratti)
    if (raw.testo_grezzo) {
      let inner = raw.testo_grezzo
      if (typeof inner === 'string') {
        inner = inner.replace(/```json/g, '').replace(/```/g, '').trim()
        raw = JSON.parse(inner)
      }
    }
    return raw
  } catch {
    return null
  }
}

export function calcolaIndici(d, meseFineParam = null) {
  let ricavi = d.ricavi?.totale ?? (typeof d.ricavi === 'object' ? 0 : d.ricavi) ?? 0
  if (typeof ricavi === 'object') ricavi = ricavi.totale ?? 0
  let costi = d.costi?.totale ?? (typeof d.costi === 'object' ? 0 : d.costi) ?? 0
  if (typeof costi === 'object') costi = costi.totale ?? 0

  const ebit = d.margine_operativo ?? d.ebit ?? d.reddito_operativo ?? ricavi - costi
  const ebitda = d.ebitda ?? ebit + (d.ammortamenti || 0)
  const utile = d.risultato_esercizio ?? d.utile_esercizio ?? d.utile ?? 0
  const amm = d.ammortamenti || 0
  const oneriFin = Math.abs(d.oneri_finanziari || 0)
  const imposte = d.imposte || 0

  const totAttivo = d.totale_attivo || 0
  const totImmob = d.totale_immobilizzazioni || 0
  const attivoCirc = d.attivo_circolante || (totAttivo ? totAttivo - totImmob : 0)
  const liquidita = d.disponibilita_liquide || 0
  const crediti = d.crediti_clienti || 0
  const pn = d.patrimonio_netto || 0
  const tfr = d.tfr || 0
  const totDebiti = d.totale_debiti || 0
  const debitiBreve = d.debiti_breve || totDebiti

  const annoInt = parseInt(String(d.anno || '').slice(0, 4), 10) || null

  let meseFineVal = meseFineParam != null ? meseFineParam : d.mese_fine || d.mese_chiusura || d.mese_periodo
  meseFineVal = parseInt(meseFineVal, 10) || 12
  meseFineVal = Math.max(1, Math.min(12, meseFineVal))
  const isInfrannuale = meseFineVal < 12

  let giorniPeriodo, giorniAnno
  if (annoInt) {
    giorniPeriodo = giorniDaInizioAnno(annoInt, meseFineVal)
    giorniAnno = giorniDaInizioAnno(annoInt, 12)
  } else {
    giorniPeriodo = meseFineVal * 30
    giorniAnno = 365
  }
  const fattoreAnnualizzazione = giorniPeriodo ? giorniAnno / giorniPeriodo : 1.0

  const ricaviAnn = ricavi * fattoreAnnualizzazione
  const ebitAnn = ebit * fattoreAnnualizzazione
  const ebitdaAnn = ebitda * fattoreAnnualizzazione
  const utileAnn = utile * fattoreAnnualizzazione

  const roi = totAttivo ? (ebitAnn / totAttivo) * 100 : null
  const ros = ricavi ? (ebit / ricavi) * 100 : null
  const rot = totAttivo ? ricaviAnn / totAttivo : null
  const roe = pn ? (utileAnn / pn) * 100 : null
  const ebitdaMargin = ricavi ? (ebitda / ricavi) * 100 : null
  const ccn = attivoCirc - debitiBreve
  const currentRatio = debitiBreve ? attivoCirc / debitiBreve : null
  const lev = pn ? totDebiti / pn : null
  const dso = ricavi && crediti ? (crediti / ricavi) * giorniPeriodo : null
  const debitiEbitda = ebitdaAnn ? totDebiti / ebitdaAnn : null

  let incidPersonale = null
  const voceCosti = d.costi
  if (voceCosti && typeof voceCosti === 'object' && Array.isArray(voceCosti.voci)) {
    for (const v of voceCosti.voci) {
      const desc = (v.descrizione || '').toLowerCase()
      if (desc.includes('personale') && !desc.includes('totale')) continue
      if (desc.includes('personale')) {
        incidPersonale = ricavi ? ((v.importo || 0) / ricavi) * 100 : null
        break
      }
    }
  }

  return {
    ricavi, costi, ebit, ebitda, utile, amm, oneri_fin: oneriFin, imposte,
    tot_attivo: totAttivo, tot_immob: totImmob, attivo_circ: attivoCirc,
    liquidita, crediti, pn, tfr, tot_debiti: totDebiti, debiti_breve: debitiBreve,
    roi, ros, rot, roe, ebitda_margin: ebitdaMargin, ccn, current_ratio: currentRatio, lev,
    dso, debiti_ebitda: debitiEbitda, incid_personale: incidPersonale,
    anno: d.anno || '',
    anno_int: annoInt,
    mese_fine: meseFineVal,
    is_infrannuale: isInfrannuale,
    giorni_periodo: giorniPeriodo,
    fattore_annualizzazione: fattoreAnnualizzazione,
    ricavi_annualizzato: ricaviAnn,
    ebit_annualizzato: ebitAnn,
    ebitda_annualizzato: ebitdaAnn,
    utile_annualizzato: utileAnn,
    periodo_label: periodoLabel(annoInt, meseFineVal, isInfrannuale),
  }
}

const fmtEur = (n) => {
  if (n == null) return 'N/D'
  const abs = Math.abs(n)
  if (abs >= 1000000) return `€ ${(n / 1000000).toFixed(3)} M`
  if (abs >= 1000) return `€ ${(n / 1000).toFixed(1)}k`
  return `€ ${n.toFixed(0)}`
}
const fmtPct = (n) => (n != null ? `${n.toFixed(2)}%` : 'N/D')
const fmtX = (n) => (n != null ? `${n.toFixed(2)}x` : 'N/D')
const fmtVar = (v) => (v == null ? 'N/D' : v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`)

export function costruisciPrompt(azienda, ind, indPrev) {
  const anno = ind.anno
  const annoPrev = indPrev?.anno

  let notaPeriodo = ''
  if (ind.is_infrannuale) {
    notaPeriodo = `
ATTENZIONE - DATO INFRANNUALE/PROVVISORIO:
Il bilancio corrente si riferisce SOLO ai primi ${ind.mese_fine} mesi dell'anno ${anno} (${ind.giorni_periodo} giorni), NON all'esercizio completo.
- NON scrivere mai "chiude l'esercizio ${anno}" o altre formulazioni che implichino un dato annuale definitivo.
- Usa invece espressioni come "nel periodo gennaio-${MESI_IT[ind.mese_fine]} ${anno}" o "nei primi ${ind.mese_fine} mesi del ${anno}".
- Specifica esplicitamente nella sintesi che si tratta di un dato provvisorio/infrannuale, non dell'esercizio chiuso.
- ROI e ROE riportati sono già annualizzati (fattore ${ind.fattore_annualizzazione.toFixed(2)}x) per renderli confrontabili con dati a 12 mesi: indicalo nel testo se lo commenti.
- Il DSO è calcolato sui ${ind.giorni_periodo} giorni effettivi del periodo, non su 365 giorni: è già corretto, non parlarne come fosse anomalo per questo motivo.
`
  }

  let confronto = ''
  if (indPrev) {
    const periodiOmogenei = indPrev.mese_fine === ind.mese_fine && indPrev.is_infrannuale === ind.is_infrannuale
    let rCorr, rPrev, eCorr, ePrev, notaOmogeneita
    if (periodiOmogenei) {
      rCorr = ind.ricavi
      rPrev = indPrev.ricavi
      eCorr = ind.ebit
      ePrev = indPrev.ebit
      notaOmogeneita = `(confronto omogeneo: stesso periodo di ${ind.mese_fine} mesi in entrambi gli anni)`
    } else {
      rCorr = ind.ricavi_annualizzato
      rPrev = indPrev.ricavi_annualizzato
      eCorr = ind.ebit_annualizzato
      ePrev = indPrev.ebit_annualizzato
      notaOmogeneita = '(periodi di durata diversa: confronto basato su stima di run-rate annualizzato, NON su dati consuntivi omogenei)'
    }
    const varRicavi = rPrev ? ((rCorr - rPrev) / rPrev) * 100 : null
    const varEbit = ePrev ? ((eCorr - ePrev) / ePrev) * 100 : null
    const istruzioneConfronto = periodiOmogenei
      ? 'i dati sono direttamente comparabili, periodi di pari durata.'
      : "i dati di ricavi/EBIT sopra riportati sono ANNUALIZZATI (stima di proiezione su 12 mesi), perche' i due periodi hanno durata diversa. Nel testo della sintesi e dell'analisi economica devi dirlo esplicitamente (es. 'su base annualizzata, in proiezione') e NON presentare la variazione percentuale come un dato consuntivo definitivo."

    confronto = `
CONFRONTO CON PERIODO PRECEDENTE (${indPrev.periodo_label}) ${notaOmogeneita}:
- Ricavi ${annoPrev}: ${fmtEur(rPrev)} → ${anno}: ${fmtEur(rCorr)} (${fmtVar(varRicavi)})
- EBIT ${annoPrev}: ${fmtEur(ePrev)} → ${anno}: ${fmtEur(eCorr)} (${fmtVar(varEbit)})
- ROI ${annoPrev}: ${fmtPct(indPrev.roi)} → ${anno}: ${fmtPct(ind.roi)}
- ROS ${annoPrev}: ${fmtPct(indPrev.ros)} → ${anno}: ${fmtPct(ind.ros)}
- CCN ${annoPrev}: ${fmtEur(indPrev.ccn)} → ${anno}: ${fmtEur(ind.ccn)}
- Leva ${annoPrev}: ${fmtX(indPrev.lev)} → ${anno}: ${fmtX(ind.lev)}

ISTRUZIONE OBBLIGATORIA SUL CONFRONTO: ${istruzioneConfronto}
`
  }

  return `Sei un analista finanziario senior specializzato in PMI italiane.
Devi produrre un'analisi economico-finanziaria professionale e approfondita per ${azienda.nome}.
${notaPeriodo}
DATI AZIENDA:
- Ragione sociale: ${azienda.nome}
- P.IVA: ${azienda.partita_iva}
- Periodo di riferimento: ${ind.periodo_label}

DATI ECONOMICI del periodo (${ind.periodo_label}):
- Ricavi: ${fmtEur(ind.ricavi)}
- Costi totali: ${fmtEur(ind.costi)}
- EBIT (Margine operativo): ${fmtEur(ind.ebit)}
- EBITDA: ${fmtEur(ind.ebitda)}
- Ammortamenti: ${fmtEur(ind.amm)}
- Oneri finanziari: ${fmtEur(ind.oneri_fin)}
- Imposte: ${fmtEur(ind.imposte)}
- Utile netto: ${fmtEur(ind.utile)}

DATI PATRIMONIALI (fotografia di fine periodo):
- Totale Attivo: ${fmtEur(ind.tot_attivo)}
- Immobilizzazioni: ${fmtEur(ind.tot_immob)}
- Attivo Circolante: ${fmtEur(ind.attivo_circ)}
- Crediti vs clienti: ${fmtEur(ind.crediti)}
- Disponibilità liquide: ${fmtEur(ind.liquidita)}
- Patrimonio Netto: ${fmtEur(ind.pn)}
- TFR: ${fmtEur(ind.tfr)}
- Totale Debiti: ${fmtEur(ind.tot_debiti)}
- Debiti a breve: ${fmtEur(ind.debiti_breve)}

INDICI CALCOLATI (già corretti per la durata del periodo):
- ROI (annualizzato): ${fmtPct(ind.roi)}
- ROS: ${fmtPct(ind.ros)}
- ROE (annualizzato): ${fmtPct(ind.roe)}
- ROT: ${fmtX(ind.rot)}
- EBITDA Margin: ${fmtPct(ind.ebitda_margin)}
- CCN: ${fmtEur(ind.ccn)}
- Current Ratio: ${fmtX(ind.current_ratio)}
- Leva finanziaria (D/E): ${fmtX(ind.lev)}
- DSO (giorni incasso, su ${ind.giorni_periodo} gg di periodo): ${ind.dso ? `${ind.dso.toFixed(0)} gg` : 'N/D'}
- Debiti/EBITDA (EBITDA annualizzato): ${fmtX(ind.debiti_ebitda)}
${confronto}

Produci un'analisi strutturata in 8 sezioni. Per ogni sezione scrivi testo fluente e professionale.
REGOLA FONDAMENTALE PER IL LAYOUT PDF: ogni sezione deve contenere ESATTAMENTE 3-4 frasi separate da "\n" (a capo).
Non scrivere un unico paragrafo continuo. Dividi il testo in 3-4 frasi distinte separate da newline.
Esempio formato corretto:
"Prima frase con primo concetto chiave e dati numerici.\nSeconda frase con secondo concetto.\nTerza frase conclusiva."
Il tono deve essere quello di un report bancario/Cerved di alta qualità.
Usa i numeri esatti e fornisci interpretazioni contestualizzate al settore PMI italiano.
Rispetta sempre le istruzioni sul periodo e sul confronto indicate sopra: sono vincolanti.

Rispondi SOLO con un oggetto JSON valido (senza backtick), compatto, senza testo prima o dopo, con questa struttura:
{
  "sintesi": "Paragrafo di sintesi esecutiva (4-6 righe)",
  "rischio": "Analisi del profilo di rischio, Z-Score e leva finanziaria (4-6 righe)",
  "economica": "Analisi economica: redditività, ROS, ROI, struttura dei costi (4-6 righe)",
  "patrimoniale": "Analisi patrimoniale: SP riclassificato, CCN, solidità (3-5 righe)",
  "cashflow": "Analisi cash flow: autofinanziamento, sostenibilità debito, DSO (3-5 righe)",
  "settore": "Posizionamento settoriale e benchmark (3-4 righe)",
  "strategie": "3-4 strategie concrete per migliorare il profilo (6-8 righe totali)",
  "conclusioni": "Conclusioni e rating sintetico (3-4 righe)",
  "rating": "BB+|BB|BB-|B+|B|BBB-|BBB|BBB+"
}`
}

export { fmtEur, fmtPct, fmtX }
