import React, { useEffect, useState } from 'react'
import { useApp } from '../../App'
import { supabase } from '../lib/supabase'
import { MESI_NOMI, caricaRigheDaBudget, caricaRigheFinanziamenti, caricaRigheRateMutuo, calcolaPianoCashflow, eseguiValidationRules, calcolaConcentrazioneClienti, calcolaSettimane, calcolaLcrPmi, SOGLIA_CONCENTRAZIONE_PCT } from '../lib/tesoreria'
import DatiTesoreria from '../components/DatiTesoreria'
import Investimenti from '../components/Investimenti'
import ManovreScorte from '../components/ManovreScorte'
import VistaSettimanale from '../components/VistaSettimanale'
import ControlliTesoreria, { periodoMensile, periodoTrimestrale } from '../components/ControlliTesoreria'
import { aggregaBudgetMensile, calcolaLiquidazioniIva, costruisciCeBaseline, analizzaStagionalita } from '../lib/budgetMensile'
import { caricaContestoSP, processaGruppiSP } from '../lib/statoPatrimoniale'
import { calcolaRigheAperture, applicaDifferimenti } from '../lib/partiteAperte'
import { tipoControparte } from '../lib/mappatureConti'
import { vociColonne, RigheRaggruppamenti, ModaleDettaglio } from '../components/DettaglioCashflow'
import { EditorDifferimento, ScadenzeModificate, dataOriginale } from '../components/DifferimentoPartite'
import GraficoTesoreria from '../components/GraficoTesoreria'

const TABS = [
  { id: 'kpi', label: '📊 KPI' },
  { id: 'cashflow', label: '💰 Cash Flow' },
  { id: 'stress', label: '🔬 Stress Test' },
  { id: 'settimane', label: '📆 13 settimane' },
  { id: 'investimenti', label: '🏗️ Investimenti e scorte' },
  { id: 'controlli', label: '✅ Controlli' },
  { id: 'rolling', label: '🔄 Rolling Forecast' },
]

const TIPI_LIBRO_GIORNALE = ['prima_nota_precedente', 'prima_nota_corrente', 'libro_giornale_precedente', 'libro_giornale_corrente']

const ANNO_BUDGET = 2026

const round1 = (n) => Math.round(n * 10) / 10
const round2Local = (n) => Math.round(n * 100) / 100
const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })
const fmtEur = (n) => `€${fmt(Math.abs(n ?? 0))}`
// Per i saldi (a differenza di entrate/uscite, sempre positivi per costruzione)
// il segno conta: un saldo negativo va mostrato con il "-", non solo con il
// colore rosso — altrimenti "€67.707" sembra positivo anche quando e' in
// realta' un saldo negativo di 67.707€.
const fmtSaldo = (n) => `${(n ?? 0) < 0 ? '-' : ''}${fmtEur(n)}`
const semaforoColore = (s) => (s === 'verde' ? '#22c55e' : s === 'giallo' ? '#f59e0b' : s === 'nd' ? '#9ca3af' : '#ef4444')
const semaforoEmoji = (s) => (s === 'verde' ? '🟢' : s === 'giallo' ? '🟡' : s === 'nd' ? '⚪' : '🔴')

async function selezionaBudgetPerAnno(aziendaId, anno) {
  const { data: candidati } = await supabase.from('budget').select('*').eq('azienda_id', aziendaId).eq('anno', String(anno))
  if (!candidati || !candidati.length) return null
  let scelto = null
  let maxVoci = -1
  for (const b of candidati) {
    const { count } = await supabase.from('budget_voci').select('id', { count: 'exact', head: true }).eq('budget_id', b.id)
    const n = count || 0
    if (n > maxVoci || (n === maxVoci && b.stato === 'approvato')) {
      maxVoci = n
      scelto = b
    }
  }
  return scelto
}

// Cerca l'Analisi dei flussi (vedi pagina "Analisi dei flussi") gia' salvata
// per il Libro Giornale/Prima Nota di una data azienda/anno: preferisce il
// documento "corrente" (esercizio in corso) se presente, altrimenti il primo
// disponibile (es. "precedente", esercizio chiuso).
async function caricaAnalisiFlussiAnno(aziendaId, anno) {
  const { data: docs } = await supabase.from('documenti').select('id, tipo_documento, dati_estratti').eq('azienda_id', aziendaId).eq('anno', String(anno)).in('tipo_documento', TIPI_LIBRO_GIORNALE).eq('stato', 'elaborato')
  if (!docs || !docs.length) return null
  const doc = docs.find((d) => d.tipo_documento.endsWith('corrente')) || docs[0]
  const { data: af } = await supabase.from('analisi_flussi').select('dati').eq('documento_id', doc.id).maybeSingle()
  if (!af?.dati) return null
  // saldi clienti/fornitori (per le partite aperte a fine mese chiuso): stessi
  // dati che alimentano Riclassificazione, gia' salvati quando il Libro
  // Giornale e' stato elaborato in Documenti.
  let gruppiConti = []
  try {
    gruppiConti = JSON.parse(doc.dati_estratti)?.gruppi || []
  } catch {
    gruppiConti = []
  }
  // clienti/fornitori: dal codice TeamSystem (14/C, 40/F) o, per gli altri programmi, dalla Riclassificazione
  const { data: mapAz } = await supabase.from('mappature_conti').select('*').eq('azienda_id', aziendaId).eq('globale', false)
  const conti = gruppiConti.flatMap((g) => g.conti || [])
  const tipo = (c) => tipoControparte(c.conto, c.descrizione, mapAz || [], [])
  return { ...af.dati, _gruppi: gruppiConti, _contiClienti: conti.filter((c) => tipo(c) === 'cliente'), _contiFornitori: conti.filter((c) => tipo(c) === 'fornitore') }
}

// Ultimo mese con movimenti bancari/cassa reali: euristica di partenza
// (proposta all'utente, non imposta) — un'azienda reale ha quasi sempre
// qualche movimento ogni mese (es. spese bancarie), quindi il primo mese a
// zero segna verosimilmente la fine dei dati reali disponibili.
function ultimoMeseConDati(dati) {
  let ultimo = 0
  for (let m = 1; m <= 12; m++) {
    if ((dati?.totaleEntrate?.[m] || 0) !== 0 || (dati?.totaleUscite?.[m] || 0) !== 0) ultimo = m
  }
  return ultimo
}

// Storico rate mutuo per mese di calendario (1-12): usa l'anno di riferimento
// se disponibile per quel mese, altrimenti l'anno precedente.
function storicoRateMutuoPerMese(datiAnnoRiferimento, datiAnnoPrecedente) {
  const storico = {}
  for (let m = 1; m <= 12; m++) {
    storico[m] = datiAnnoRiferimento?.uscite?.['Rate mutuo']?.[m] || datiAnnoPrecedente?.uscite?.['Rate mutuo']?.[m] || 0
  }
  return storico
}

export default function Tesoreria() {
  const [aziende, setAziende] = useState([])
  // Pmi 360°: l'azienda è quella attiva dell'app (niente selettore nella pagina)
  const { azienda: aziendaAttiva } = useApp()
  const aziendaId = aziendaAttiva?.id || ''
  const [tab, setTab] = useState('kpi')

  const [bufferPct, setBufferPct] = useState(15)
  const [piano, setPiano] = useState(null)
  // dettaglio di Entrate/Uscite nella tabella Cash Flow: righe aperte e mese/raggruppamento mostrato
  const [espansi, setEspansi] = useState({ entrata: false, uscita: false })
  const [dettaglioCf, setDettaglioCf] = useState(null)

  const [kpi, setKpi] = useState(null)
  const [kpiLoading, setKpiLoading] = useState(false)

  const [rolling, setRolling] = useState(false)
  const [rollingResult, setRollingResult] = useState(null)

  const [annoRiferimento, setAnnoRiferimento] = useState(ANNO_BUDGET)
  const [datiRealiAnno, setDatiRealiAnno] = useState(null)
  const [meseChiusura, setMeseChiusura] = useState(null)
  // CNDCEC richiede una pianificazione di cassa a 12 mesi (non e' un'opzione
  // regolabile dall'utente).
  const ORIZZONTE_CNDCEC = 12
  const [generandoReale, setGenerandoReale] = useState(false)
  const [erroreReale, setErroreReale] = useState('')
  const [richiestaDati, setRichiestaDati] = useState(false)
  const [scadenzeEscluse, setScadenzeEscluse] = useState([]) // righe scadenze_escluse dell'azienda corrente
  const [modificaPartita, setModificaPartita] = useState(null) // { conto, origine: 'tabella'|'riepilogo', giorni, motivo } in corso
  const [salvandoPartita, setSalvandoPartita] = useState(false)

  useEffect(() => {
    supabase
      .from('aziende')
      .select('id, nome')
      .order('nome')
      .then(({ data }) => setAziende(data || []))
  }, [])

  const caricaKpi = async (azId) => {
    setKpiLoading(true)
    try {
      const { data } = await supabase.from('kpi_tesoreria').select('*').eq('azienda_id', azId).order('data_snapshot', { ascending: false }).limit(1).maybeSingle()
      if (!data) {
        setKpi(null)
        return
      }
      const dettaglio = data.dettaglio_json || {}
      // checklist mensile (§2.5j) e revisione trimestrale (§2.5h): registrate nella scheda Controlli
      const { data: ctrl } = await supabase.from('controlli_tesoreria').select('tipo, periodo, completato, data_completamento').eq('azienda_id', azId)
      const ora = new Date()
      const mesePrec = new Date(ora.getFullYear(), ora.getMonth() - 1, 1)
      const fatto = (tipo, periodo) => (ctrl || []).some((c) => c.tipo === tipo && c.periodo === periodo && c.completato)
      const ultimaTrim = (ctrl || []).filter((c) => c.tipo === 'trimestrale' && c.completato && c.data_completamento).map((c) => c.data_completamento).sort().pop() || null
      const controlli = {
        mensile_ok: fatto('mensile', periodoMensile(ora)) || (ora.getDate() <= 10 && fatto('mensile', periodoMensile(mesePrec))),
        mensile_periodo: periodoMensile(ora),
        trimestrale_ok: !!ultimaTrim && (Date.now() - new Date(`${ultimaTrim}T00:00:00Z`).getTime()) / 86400000 <= 100,
        ultima_trimestrale: ultimaTrim,
        periodo_trimestrale: periodoTrimestrale(ora),
      }
      const validations = eseguiValidationRules({ dsoMisurato: dettaglio.dso_misurato ?? null, dsoUsato: dettaglio.dso_usato ?? null, concentrazione: dettaglio.concentrazione ?? null, ultimoSnapshotIso: data.data_snapshot })
      setKpi({
        dso_giorni: data.dso_giorni,
        dpo_giorni: data.dpo_giorni,
        ccc_giorni: data.ccc_giorni,
        semaforo: data.semaforo || 'verde',
        saldo_corrente: dettaglio.saldo_corrente || 0,
        buffer_minimo: data.buffer_minimo || 0,
        past_due_flag: data.past_due_flag,
        alert_concentrazione: data.alert_concentrazione,
        concentrazione: dettaglio.concentrazione ?? null,
        dso_fonte: dettaglio.dso_fonte ?? null,
        ccc_parziale: dettaglio.ccc_parziale ?? null,
        stagionalita: dettaglio.stagionalita ?? null,
        finanziamenti: dettaglio.finanziamenti ?? null,
        termini: dettaglio.termini ?? null,
        past_due: dettaglio.past_due ?? null,
        controlli,
        kpi_finanziari: dettaglio.kpi_finanziari ?? null,
        ultimo_aggiornamento: data.data_snapshot,
        validations,
      })
    } finally {
      setKpiLoading(false)
    }
  }

  const caricaPiano = async (azId) => {
    const { data } = await supabase.from('scenari_tesoreria').select('*').eq('azienda_id', azId).order('creato_il', { ascending: false }).limit(1).maybeSingle()
    setPiano(data?.piano_json || null)
  }

  useEffect(() => {
    if (!aziendaId) return
    setRollingResult(null)
    caricaKpi(aziendaId)
    caricaPiano(aziendaId)
    caricaScadenzeEscluse(aziendaId)
  }, [aziendaId])

  const caricaScadenzeEscluse = async (azId) => {
    const { data } = await supabase.from('scadenze_escluse').select('*').eq('azienda_id', azId)
    setScadenzeEscluse(data || [])
  }

  // Esclude o riammette una partita aperta (credito/debito reale dal Libro Giornale) dal calcolo di cassa,
  // per conto: resta valida nelle proiezioni successive finche' non la riattivi. Rigenera subito la proiezione,
  // se ce n'e' gia' una, cosi' l'effetto sul cash flow e' immediato.
  const toggleScadenzaEsclusa = async (riga) => {
    const gia = scadenzeEscluse.find((e) => e.conto === riga.conto)
    if (gia && gia.differimento_giorni == null) {
      await supabase.from('scadenze_escluse').delete().eq('id', gia.id)
    } else {
      const motivo = window.prompt(`Escludere "${riga.descrizione}" (${riga.conto}) dal calcolo del cash flow?\n\nMotivo (opzionale):`, '')
      if (motivo === null) return // annullato
      if (gia) await supabase.from('scadenze_escluse').delete().eq('id', gia.id) // era differita: diventa esclusa
      const { error } = await supabase.from('scadenze_escluse').insert({ id: crypto.randomUUID(), azienda_id: aziendaId, conto: riga.conto, direzione: riga.direzione, descrizione: riga.descrizione, motivo: motivo || null })
      if (error) return setErroreReale(error.message)
    }
    await caricaScadenzeEscluse(aziendaId)
    if (piano?.ancora) await generaProiezioneReale()
  }

  // Differisce di N giorni una partita aperta (per conto): resta nel cash flow, con la scadenza stimata spostata in
  // avanti. Stessa tabella delle esclusioni (una riga per conto) con differimento_giorni valorizzato. I giorni li
  // scrive l'utente nel campo della riga (modificaPartita); "Ripristina" riporta la partita alla scadenza stimata.
  const salvaDifferimento = async (riga) => {
    const giorni = Number(modificaPartita?.giorni)
    if (!Number.isInteger(giorni) || giorni < 1 || giorni > 730) return
    setSalvandoPartita(true)
    const gia = scadenzeEscluse.find((e) => e.conto === riga.conto)
    if (gia) await supabase.from('scadenze_escluse').delete().eq('id', gia.id)
    const { error } = await supabase.from('scadenze_escluse').insert({ id: crypto.randomUUID(), azienda_id: aziendaId, conto: riga.conto, direzione: riga.direzione, descrizione: riga.descrizione, motivo: modificaPartita.motivo?.trim() || null, differimento_giorni: giorni })
    if (error) { setSalvandoPartita(false); return setErroreReale(error.message) }
    setModificaPartita(null)
    await caricaScadenzeEscluse(aziendaId)
    if (piano?.ancora) await generaProiezioneReale()
    setSalvandoPartita(false)
  }

  // Annulla la modifica (differimento o esclusione): la partita torna com'era, alla scadenza stimata.
  const ripristinaScadenza = async (riga) => {
    const gia = scadenzeEscluse.find((e) => e.conto === riga.conto)
    if (!gia) return
    setSalvandoPartita(true)
    await supabase.from('scadenze_escluse').delete().eq('id', gia.id)
    setModificaPartita(null)
    await caricaScadenzeEscluse(aziendaId)
    if (piano?.ancora) await generaProiezioneReale()
    setSalvandoPartita(false)
  }

  useEffect(() => {
    if (!aziendaId) return
    setErroreReale('')
    caricaAnalisiFlussiAnno(aziendaId, annoRiferimento).then((dati) => {
      setDatiRealiAnno(dati)
      setMeseChiusura(dati ? ultimoMeseConDati(dati) : null)
    })
  }, [aziendaId, annoRiferimento])

  // Rilegge l'Analisi dei flussi (es. dopo aver elaborato un mese piu' recente
  // nella pagina "Analisi dei flussi") senza cambiare azienda/anno: azione
  // esplicita dell'utente, niente refetch automatico "silenzioso".
  const aggiornaDatiReali = async () => {
    const dati = await caricaAnalisiFlussiAnno(aziendaId, annoRiferimento)
    setDatiRealiAnno(dati)
    const nuovoMese = dati ? ultimoMeseConDati(dati) : null
    setMeseChiusura(nuovoMese)
    return { dati, meseChiusura: nuovoMese }
  }

  const salvaScenarioEKpi = async (pianoDaSalvare, nome) => {
    const now = new Date()
    await supabase.from('scenari_tesoreria').insert({
      id: crypto.randomUUID(),
      azienda_id: aziendaId,
      nome,
      tipo: 'base',
      mese_riferimento: now.getFullYear() * 100 + (now.getMonth() + 1),
      orizzonte_mesi: 12,
      piano_json: pianoDaSalvare,
      saldo_finale_base: pianoDaSalvare.mesi[pianoDaSalvare.mesi.length - 1]?.saldo_base ?? 0,
      semaforo: pianoDaSalvare.semaforo_globale,
      buffer_minimo_pct: pianoDaSalvare.buffer_minimo_pct,
      saldo_iniziale: pianoDaSalvare.saldo_iniziale,
      fatturato_mensile_medio: pianoDaSalvare.fatturato_mensile_medio,
      creato_il: now.toISOString(),
      aggiornato_il: now.toISOString(),
    })
    await supabase.from('kpi_tesoreria').insert({
      id: crypto.randomUUID(),
      azienda_id: aziendaId,
      data_snapshot: now.toISOString(),
      dso_giorni: pianoDaSalvare.dso_medio,
      dpo_giorni: pianoDaSalvare.dpo_medio,
      ccc_giorni: pianoDaSalvare.ccc_medio,
      saldo_corrente: pianoDaSalvare.mesi[0]?.saldo_base ?? 0,
      buffer_minimo: pianoDaSalvare.mesi[0]?.buffer_minimo ?? 0,
      semaforo: pianoDaSalvare.semaforo_globale,
      past_due_flag: !!pianoDaSalvare.past_due?.flag,
      alert_concentrazione: !!pianoDaSalvare.concentrazione?.alert,
      errore_forecast_pct: pianoDaSalvare.errore_forecast_pct,
      dettaglio_json: {
        saldo_corrente: pianoDaSalvare.mesi[0]?.saldo_base ?? 0,
        fatturato_mensile_medio: pianoDaSalvare.fatturato_mensile_medio,
        delta_competenza_cassa: pianoDaSalvare.delta_competenza_cassa,
        dso_misurato: pianoDaSalvare.dso_misurato ?? null,
        ccc_parziale: pianoDaSalvare.ccc_parziale ?? null,
        stagionalita: pianoDaSalvare.stagionalita ?? null,
        finanziamenti: pianoDaSalvare.finanziamenti ?? null,
        termini: pianoDaSalvare.termini ?? null,
        past_due: pianoDaSalvare.past_due ?? null,
        kpi_finanziari: pianoDaSalvare.kpi_finanziari ?? null,
        dio_usato: pianoDaSalvare.dio_usato ?? null,
        dso_usato: pianoDaSalvare.dso_medio,
        dso_fonte: pianoDaSalvare.dso_fonte ?? null,
        concentrazione: pianoDaSalvare.concentrazione ?? null,
      },
      creato_il: now.toISOString(),
    })
  }

  // datiRealiOverride/meseChiusuraOverride: usati dal Rolling Forecast, che
  // rilegge i dati reali PRIMA di generare (per non lavorare su uno stato
  // ancora non aggiornato dal refetch appena fatto — vedi aggiornaRollingReale).
  // Prima di generare: se mancano i dati di anagrafica per la Tesoreria (magazzino, linee di credito)
  // si chiedono in un popup; si puo' anche procedere senza, e allora gli indicatori interessati
  // mostrano "dato mancante" (mai un valore inventato).
  const avviaGenerazione = async () => {
    const { data: az } = await supabase.from('aziende').select('ha_magazzino, linee_credito_dichiarate, finanziamenti_dichiarati').eq('id', aziendaId).single()
    if (az && (az.ha_magazzino == null || az.linee_credito_dichiarate == null || az.finanziamenti_dichiarati == null)) setRichiestaDati(true)
    else generaProiezioneReale()
  }

  const generaProiezioneReale = async (overrides = {}) => {
    const datiCorrenti = overrides.datiReali ?? datiRealiAnno
    const meseCorrente = overrides.meseChiusura ?? meseChiusura
    if (!aziendaId || !meseCorrente) return null
    setGenerandoReale(true)
    setErroreReale('')
    try {
      if (!datiCorrenti) throw new Error(`Nessuna Analisi dei flussi trovata per l'anno ${annoRiferimento}. Elaborala prima nella pagina "Analisi dei flussi".`)

      const { data: azienda } = await supabase.from('aziende').select('*').eq('id', aziendaId).single()
      const budgetScelto = await selezionaBudgetPerAnno(aziendaId, annoRiferimento)
      if (!budgetScelto) throw new Error(`Nessun budget ${annoRiferimento} trovato per questa azienda: serve un budget approvato per proiettare i mesi successivi al consuntivo.`)
      const { data: vociBudget } = await supabase.from('budget_voci').select('*').eq('budget_id', budgetScelto.id)

      // DSO/DPO: valore MISURATO dal Libro Giornale (Analisi dei flussi, media ponderata sugli
      // importi) quando c'e'; altrimenti i giorni medi dell'anagrafica; in ultimo 30. Non si
      // riusa piu' l'ultimo KPI salvato: era il DSO usato dalla proiezione precedente, un
      // ciclo chiuso che non si aggiornava mai coi dati reali (§2.2, §2.5c, §2.5k).
      const dsoMisurato = datiCorrenti.dsoDpo?.dso?.mediaPonderata ?? null
      const dpoMisurato = datiCorrenti.dsoDpo?.dpo?.mediaPonderata ?? null
      const dso = dsoMisurato ?? azienda?.gg_medi_incasso ?? 30
      const dpo = dpoMisurato ?? azienda?.gg_medi_pagamento ?? 30
      const dsoFonte = dsoMisurato != null ? 'misurato' : azienda?.gg_medi_incasso != null ? 'anagrafica' : 'default'
      const concentrazione = calcolaConcentrazioneClienti(datiCorrenti.dsoDpo?.dso?.dettaglio)
      // DIO (§2.5e): 0 senza magazzino, valore dichiarato con magazzino, null se non dichiarato
      const dio = azienda?.ha_magazzino === false ? 0 : azienda?.ha_magazzino === true ? azienda?.dio_giorni ?? null : null
      // linee di credito (§2.5g): dichiarate solo se l'utente lo ha indicato in anagrafica (anche "nessuna")
      const { data: lineeRighe } = await supabase.from('linee_credito').select('*').eq('azienda_id', aziendaId)
      const lineeCredito = { dichiarate: azienda?.linee_credito_dichiarate === true, linee: lineeRighe || [] }

      // La generazione dal budget riparte dal mese successivo alla chiusura
      // reale, quindi da sola non modellerebbe gli incassi/pagamenti di
      // competenza dei mesi reali gia' chiusi (es. fatture di luglio
      // incassate in agosto): calcolaRigheAperture colma questo "ponte" con
      // le fatture clienti/fornitori realmente ancora aperte a fine mese
      // chiuso (saldi dei conti 14/C-40/F), scadenzate con il DSO/DPO storico
      // reale del singolo cliente/fornitore quando disponibile.
      const meseInizioProiezione = meseCorrente + 1
      // Investimenti pianificati (scheda investimenti, §2.5f) e finanziamenti dichiarati (piano di ammortamento, §2.5a)
      const { data: invRighe } = await supabase.from('investimenti').select('*').eq('azienda_id', aziendaId)
      const { data: finRighe } = await supabase.from('finanziamenti').select('*').eq('azienda_id', aziendaId)
      const { data: manovreRighe } = await supabase.from('manovre_scorte').select('*').eq('azienda_id', aziendaId)
      const righeBudget = caricaRigheDaBudget(azienda, vociBudget || [], dso, dpo, annoRiferimento, meseInizioProiezione, invRighe || [], manovreRighe || [])

      const datiAnnoPrec = await caricaAnalisiFlussiAnno(aziendaId, annoRiferimento - 1)
      const storicoMutuo = storicoRateMutuoPerMese(datiCorrenti, datiAnnoPrec)
      // Rate: dal piano dichiarato quando c'e' (anche "nessun finanziamento"); altrimenti stima dallo storico, segnalata
      const finanziamentiDichiarati = azienda?.finanziamenti_dichiarati === true
      const righeMutuo = finanziamentiDichiarati
        ? caricaRigheFinanziamenti(finRighe || [], [annoRiferimento, meseInizioProiezione], ORIZZONTE_CNDCEC)
        : caricaRigheRateMutuo(storicoMutuo, annoRiferimento, meseInizioProiezione, ORIZZONTE_CNDCEC)

      const righeApertureTutte = calcolaRigheAperture({
        contiClienti: datiCorrenti._contiClienti,
        contiFornitori: datiCorrenti._contiFornitori,
        dsoDettaglio: datiCorrenti.dsoDpo?.dso?.dettaglio,
        dpoDettaglio: datiCorrenti.dsoDpo?.dpo?.dettaglio,
        dsoMedio: datiCorrenti.dsoDpo?.dso?.mediaPonderata ?? dso,
        dpoMedio: datiCorrenti.dsoDpo?.dpo?.mediaPonderata ?? dpo,
        anno: annoRiferimento,
        meseChiusura: meseCorrente,
      })
      // Esclusione per conto (scadenze_escluse, dichiarata dall'utente): tolta PRIMA di ogni calcolo di cassa,
      // cosi' l'esclusione incide davvero sul cash flow e non e' solo un filtro di visualizzazione.
      const { data: escluseRighe } = await supabase.from('scadenze_escluse').select('*').eq('azienda_id', aziendaId)
      // Stessa tabella per i differimenti (differimento_giorni valorizzato): la partita resta nei flussi, spostata.
      const contiEsclusi = new Set((escluseRighe || []).filter((e) => e.differimento_giorni == null).map((e) => e.conto))
      const differimenti = new Map((escluseRighe || []).filter((e) => e.differimento_giorni != null).map((e) => [e.conto, e.differimento_giorni]))
      const righeApertureConDifferimenti = applicaDifferimenti(righeApertureTutte, differimenti)
      const righeAperture = righeApertureConDifferimenti.filter((r) => !contiEsclusi.has(r.conto))

      const mesiReali = []
      for (let m = 1; m <= meseCorrente; m++) {
        mesiReali.push({
          anno: annoRiferimento,
          mese: m,
          mese_budget: annoRiferimento * 100 + m,
          entrate: datiCorrenti.totaleEntrate?.[m] || 0,
          uscite: datiCorrenti.totaleUscite?.[m] || 0,
          saldo: datiCorrenti.saldoFinePeriodo?.[m] || 0,
        })
      }
      const saldoRealeIniziale = datiCorrenti.saldoFinePeriodo?.[meseCorrente] || 0
      const fatturatoMedioReale = Math.round(mesiReali.reduce((s, m) => s + m.entrate, 0) / mesiReali.length)

      const pianoProiettato = calcolaPianoCashflow({
        righe: [...righeBudget, ...righeMutuo, ...righeAperture],
        saldoIniziale: saldoRealeIniziale,
        fatturatoMedio: fatturatoMedioReale || 100000,
        bufferPct,
        orizzonteMesi: ORIZZONTE_CNDCEC,
        dso,
        dpo,
        meseInizio: [annoRiferimento, meseInizioProiezione],
        concentrazione,
        dio,
        lineeCredito,
      })
      pianoProiettato.dso_misurato = dsoMisurato
      pianoProiettato.dso_fonte = dsoFonte
      pianoProiettato.dpo_misurato = dpoMisurato
      pianoProiettato.mesi_reali = mesiReali
      pianoProiettato.ancora = { anno: annoRiferimento, ultimo_mese_reale: meseCorrente, saldo_reale_iniziale: saldoRealeIniziale }
      pianoProiettato.partite_aperte = {
        n_crediti: righeAperture.filter((r) => r.direzione === 'entrata').length,
        crediti: round2Local(righeAperture.filter((r) => r.direzione === 'entrata').reduce((s, r) => s + r.importo, 0)),
        n_debiti: righeAperture.filter((r) => r.direzione === 'uscita').length,
        debiti: round2Local(righeAperture.filter((r) => r.direzione === 'uscita').reduce((s, r) => s + r.importo, 0)),
        n_esclusi: righeApertureTutte.length - righeAperture.length,
        importo_escluso: round2Local(righeApertureTutte.filter((r) => contiEsclusi.has(r.conto)).reduce((s, r) => s + r.importo, 0)),
      }
      // Elenco completo (incluse ed escluse) per la scheda "Partite aperte": ogni cliente/fornitore col saldo
      // ancora aperto a fine mese chiuso, con l'azione per escluderlo dal conteggio o riammetterlo.
      pianoProiettato.partite_aperte_lista = righeApertureConDifferimenti
        .map((r, i) => ({ conto: r.conto, descrizione: r.controparte, direzione: r.direzione, importo: round2Local(r.importo), data: r.dataScadenza.toISOString().slice(0, 10), data_originale: righeApertureTutte[i].dataScadenza.toISOString().slice(0, 10), giorni: r.giorniDilazione, differimento: r.differimentoGiorni || null, escluso: contiEsclusi.has(r.conto), motivo: (escluseRighe || []).find((e) => e.conto === r.conto)?.motivo || null }))
        .sort((a, b) => a.data.localeCompare(b.data) || b.importo - a.importo)

      // Snapshot del baseline economico e IVA, calcolato dallo STESSO budget e
      // sulla stessa finestra del piano di cassa, cosi' i due baseline sono
      // coerenti e condividono il timestamp del salvataggio (motore di
      // valutazione d'impatto, contratto §4.G). Budget pieno, costi netti.
      const mesiBudget = aggregaBudgetMensile(vociBudget || [], azienda, annoRiferimento, meseInizioProiezione, ORIZZONTE_CNDCEC, invRighe || [], manovreRighe || [])
      pianoProiettato.modello_cassa = 10 // 10 = elenco completo, esclusione e differimento delle partite aperte (scadenze_escluse); 9 = + dettaglio linee di credito e costi energetici per mese (stress del motore d'impatto); 8 = + vista 13 settimane, scorte, termini contrattuali, Past Due dichiarato, LCR; 7 = acconti imposte 50/50; 6 = + rate da piano di ammortamento, investimenti pianificati; 5 = + contributi F24, acconti imposte, stagionalità, cruscotto, KPI; 4 = + DIO da anagrafica, stress energia, copertura linee; 2 = budget netto + IVA per liquidazione + costi non monetari fuori cassa; 3 = + scenari coerenti col base, DSO misurato, concentrazione; 4 = + DIO da anagrafica, stress energia sulle sole voci energetiche, copertura con le linee di credito (vedi CHANGELOG.md)
      pianoProiettato.ce_baseline = costruisciCeBaseline(mesiBudget, vociBudget || [], { budget_id: budgetScelto.id, anno_budget: annoRiferimento })
      pianoProiettato.iva_baseline = {
        liquidazione: azienda?.liquidazione_iva || 'trimestrale',
        aliquota_vendite: azienda?.aliquota_iva_vendite ?? 22,
        aliquota_acquisti: azienda?.aliquota_iva_acquisti ?? 22,
        periodi: calcolaLiquidazioniIva(mesiBudget, azienda?.liquidazione_iva || 'trimestrale'),
      }

      // Controllo stagionalita' del budget (§2.5k cruscotto)
      pianoProiettato.stagionalita = analizzaStagionalita(vociBudget || [])
      const inizioFinestra = Date.UTC(annoRiferimento, meseInizioProiezione - 1, 1)

      // KPI finanziari (§2.5k): copertura interessi, liquidita' immediata, debito bancario / fatturato
      const ceTot = pianoProiettato.ce_baseline?.totale
      const usciteMedieGiorno = pianoProiettato.mesi.slice(0, 3).reduce((t, mm) => t + mm.uscite_certe + mm.uscite_stimate, 0) / 90
      const kpiFin = {
        copertura_interessi: ceTot && ceTot.oneri_finanziari > 0 ? Math.round((ceTot.ebitda / ceTot.oneri_finanziari) * 10) / 10 : null,
        copertura_interessi_nota: ceTot ? (ceTot.oneri_finanziari > 0 ? 'EBITDA / oneri finanziari netti a budget' : 'nessun onere finanziario netto a budget') : 'baseline economico non disponibile',
        liquidita_giorni: usciteMedieGiorno > 0 ? Math.round((saldoRealeIniziale / usciteMedieGiorno) * 10) / 10 : null,
        debito_bancario: null,
        debito_bancario_su_fatturato: null,
        debito_bancario_nota: 'non calcolabile: gruppi del Libro Giornale non riclassificati su Debiti verso banche',
      }
      try {
        const ctxSP = await caricaContestoSP(aziendaId)
        const sp = processaGruppiSP({ gruppi: datiCorrenti._gruppi || [] }, ctxSP)
        const banche = sp.aggregatoSP?.PAS_D_4
        if (banche && ceTot?.ricavi_operativi > 0) {
          kpiFin.debito_bancario = round2Local(banche.importo)
          kpiFin.debito_bancario_su_fatturato = Math.round((banche.importo / ceTot.ricavi_operativi) * 100) / 100
          kpiFin.debito_bancario_nota = 'debiti verso banche (Stato Patrimoniale riclassificato) / ricavi operativi a budget 12 mesi'
        }
      } catch {
        /* resta non calcolabile */
      }
      kpiFin.lcr = calcolaLcrPmi({ saldoIniziale: saldoRealeIniziale, lineeCredito, primoMese: pianoProiettato.mesi[0] })
      pianoProiettato.kpi_finanziari = kpiFin

      // vista a 13 settimane (§1.1, §2.5h) sugli stessi flussi del piano
      pianoProiettato.vista_settimanale = calcolaSettimane({ righe: [...righeBudget, ...righeMutuo, ...righeAperture], inizio: new Date(inizioFinestra), saldoIniziale: saldoRealeIniziale, buffer: pianoProiettato.mesi[0]?.buffer_minimo ?? 0 })
      // termini contrattuali (DSO/DPO vs termini, §2.5e) e Past Due dichiarato (§1.4, CCII art. 3): dati dell'anagrafica
      pianoProiettato.termini = { incasso: azienda?.termini_incasso_giorni ?? null, pagamento: azienda?.termini_pagamento_giorni ?? null }
      pianoProiettato.past_due = {
        dichiarato: azienda?.esposizioni_dichiarate === true,
        importo: azienda?.esposizioni_scadute_importo ?? null,
        giorni: azienda?.esposizioni_scadute_giorni ?? null,
        al: azienda?.esposizioni_scadute_al ?? null,
        flag: azienda?.esposizioni_dichiarate === true && (azienda?.esposizioni_scadute_importo || 0) > 0 && (azienda?.esposizioni_scadute_giorni || 0) > 30,
      }
      pianoProiettato.scorte = { n_manovre: (manovreRighe || []).length }
      pianoProiettato.finanziamenti = { dichiarati: finanziamentiDichiarati, n: (finRighe || []).length, rate_stimate_da_storico: !finanziamentiDichiarati && righeMutuo.length > 0 }
      pianoProiettato.investimenti = { n: (invRighe || []).length, totale: (invRighe || []).reduce((t, r) => t + r.importo, 0) }

      await salvaScenarioEKpi(pianoProiettato, `Proiezione da reale ${MESI_NOMI[meseCorrente - 1]} ${annoRiferimento} (+${ORIZZONTE_CNDCEC}m)`)
      setPiano(pianoProiettato)
      await caricaKpi(aziendaId)
      return pianoProiettato
    } catch (e) {
      setErroreReale(e.message || 'Errore nella generazione della proiezione')
      return null
    } finally {
      setGenerandoReale(false)
    }
  }

  // Rolling forecast: rilegge i dati reali (nel caso sia stato elaborato un
  // mese piu' recente in "Analisi dei flussi" da quando e' stata generata
  // l'ultima proiezione), confronta il primo mese proiettato di QUELLA
  // proiezione con il dato reale ora eventualmente disponibile per misurare
  // l'errore di forecast (CNDCEC §3.2 — target <10%), poi rigenera la
  // proiezione ancorata alla nuova chiusura.
  const aggiornaRollingReale = async () => {
    if (!aziendaId) return
    setRolling(true)
    setRollingResult(null)
    try {
      const pianoPrecedente = piano
      const { dati, meseChiusura: nuovoMeseChiusura } = await aggiornaDatiReali()
      if (!dati || !nuovoMeseChiusura) throw new Error(`Nessuna Analisi dei flussi trovata per l'anno ${annoRiferimento}.`)

      let erroreForecastPct = null
      if (pianoPrecedente?.mesi?.length && pianoPrecedente.ancora?.anno === annoRiferimento) {
        const primoMese = pianoPrecedente.mesi[0]
        if (primoMese.mese <= nuovoMeseChiusura && primoMese.flusso_netto) {
          const flussoReale = (dati.totaleEntrate?.[primoMese.mese] || 0) - (dati.totaleUscite?.[primoMese.mese] || 0)
          erroreForecastPct = round1(((flussoReale - primoMese.flusso_netto) / Math.abs(primoMese.flusso_netto)) * 100)
        }
      }

      const nuovoPiano = await generaProiezioneReale({ datiReali: dati, meseChiusura: nuovoMeseChiusura })
      if (!nuovoPiano) return

      let messaggioErrore = ''
      if (erroreForecastPct != null) {
        const pct = erroreForecastPct
        if (Math.abs(pct) < 10) messaggioErrore = `✓ Errore forecast: ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% (target <10% raggiunto)`
        else if (Math.abs(pct) < 20) messaggioErrore = `⚠ Errore forecast: ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% — rivedere ipotesi di incasso (target <10%)`
        else messaggioErrore = `✗ Errore forecast: ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% — scostamento elevato. Aggiornare DSO/DPO e verificare ipotesi budget (§3.2)`
      } else {
        messaggioErrore = 'Proiezione aggiornata. Errore forecast non ancora calcolabile: il primo mese della proiezione precedente non è ancora coperto da dati reali.'
      }

      setRollingResult({ semaforo: nuovoPiano.semaforo_globale, errore_forecast_pct: erroreForecastPct, messaggio_errore_forecast: messaggioErrore })
    } catch (e) {
      setRollingResult({ errore: e.message || 'Errore aggiornamento' })
    } finally {
      setRolling(false)
    }
  }

  const stressTests = piano?.stress_tests || []
  const stressValutabili = stressTests.filter((s) => s.semaforo !== 'nd')
  const semaforoWorstCase = stressValutabili.length ? (stressValutabili.some((s) => s.semaforo === 'rosso') ? 'rosso' : stressValutabili.some((s) => s.semaforo === 'giallo') ? 'giallo' : 'verde') : null
  const raccomandazioni = stressTests.filter((s) => ['giallo', 'rosso'].includes(s.semaforo)).map((s) => s.messaggio)
  const raccomandazioniFinal = raccomandazioni.length ? raccomandazioni : ['Piano resiliente: tutti gli scenari mostrano liquidità sufficiente (EBA GL).']

  return (
    <div>
      {richiestaDati && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 760, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-body">
              <h3 style={{ color: '#1a3a5c', marginTop: 0 }}>Dati mancanti per la Tesoreria</h3>
              <p style={{ fontSize: 13, color: '#6b7280' }}>
                Servono al Cash Conversion Cycle (magazzino), alla verifica di copertura negli stress test (linee di credito) e alle rate dal piano di ammortamento (finanziamenti). Restano registrati nell'anagrafica dell'azienda. Puoi anche procedere senza:
                gli indicatori interessati mostreranno «dato mancante».
              </p>
              <DatiTesoreria
                aziendaId={aziendaId}
                compatto
                etichettaSalva="Salva e genera la proiezione"
                onSalvato={() => {
                  setRichiestaDati(false)
                  generaProiezioneReale()
                }}
              />
              <button
                className="btn btn-outline"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setRichiestaDati(false)
                  generaProiezioneReale()
                }}
              >
                Genera senza questi dati
              </button>
              <button className="btn btn-outline" style={{ marginTop: 12, marginLeft: 8 }} onClick={() => setRichiestaDati(false)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
      <h2 className="no-print" style={{ color: '#1a3a5c', marginTop: 0 }}>
        Budget di Tesoreria
      </h2>
      <p className="no-print" style={{ color: '#666', marginTop: -8, marginBottom: 20 }}>
        Pianificazione cash flow 12 mesi — CNDCEC §2.5 conforme
      </p>
      <div className="print-only" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c' }}>{aziende.find((a) => a.id === aziendaId)?.nome || ''}</div>
        <div style={{ fontSize: 13, color: '#555' }}>Budget di Tesoreria — Pianificazione cash flow 12 mesi (CNDCEC §2.5)</div>
      </div>

      <div className="card no-print" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'end', gap: 20, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 260 }}>
            <label className="form-label">Azienda</label>
            <select className="form-control" value={aziendaId} disabled title="Azienda attiva di Pmi 360°: si cambia dal menu laterale">
              <option value="">Seleziona azienda...</option>
              {aziende.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>
          {kpi && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 8, background: semaforoColore(kpi.semaforo) + '18', border: `1.5px solid ${semaforoColore(kpi.semaforo)}` }}>
              <span style={{ fontSize: 22 }}>{semaforoEmoji(kpi.semaforo)}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: semaforoColore(kpi.semaforo) }}>{kpi.semaforo.toUpperCase()}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  Saldo: {fmtSaldo(kpi.saldo_corrente)} · Buffer: {fmtEur(kpi.buffer_minimo)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="tesoreria-tabs no-print">
        {TABS.map((t) => (
          <button key={t.id} className={`tesoreria-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kpi' && (
        <div style={{ marginTop: 16 }}>
          {!kpi && !kpiLoading && <div className="alert" style={{ background: '#eff6ff', color: '#1d4ed8' }}>ℹ️ Nessun KPI disponibile. Genera prima una proiezione nella scheda Cash Flow.</div>}
          {kpi && (
            <>
              <div className="grid-4" style={{ marginBottom: 16 }}>
                {[
                  { label: 'DSO', val: kpi.dso_giorni ? `${kpi.dso_giorni.toFixed(0)} gg` : '—', sub: `Giorni medi incasso${kpi.dso_fonte ? ` (${kpi.dso_fonte})` : ''}${kpi.termini?.incasso != null ? ` — termini contrattuali ${kpi.termini.incasso.toFixed(0)} gg (${kpi.dso_giorni - kpi.termini.incasso >= 0 ? '+' : ''}${(kpi.dso_giorni - kpi.termini.incasso).toFixed(0)})` : ' — termini contrattuali non dichiarati'}`, warn: (kpi.dso_giorni && kpi.dso_giorni > 60) || (kpi.dso_giorni != null && kpi.termini?.incasso != null && kpi.dso_giorni - kpi.termini.incasso > 10) },
                  { label: 'DPO', val: kpi.dpo_giorni ? `${kpi.dpo_giorni.toFixed(0)} gg` : '—', sub: `Giorni medi pagamento${kpi.termini?.pagamento != null ? ` — termini contrattuali ${kpi.termini.pagamento.toFixed(0)} gg (${kpi.dpo_giorni - kpi.termini.pagamento >= 0 ? '+' : ''}${(kpi.dpo_giorni - kpi.termini.pagamento).toFixed(0)})` : ' — termini contrattuali non dichiarati'}`, warn: false },
                  { label: 'CCC', val: kpi.ccc_giorni ? `${kpi.ccc_giorni.toFixed(0)} gg` : '—', sub: kpi.ccc_parziale ? 'CCC senza scorte: magazzino non dichiarato (anagrafica)' : 'Cash Conversion Cycle', warn: kpi.ccc_giorni && kpi.ccc_giorni > 60 },
                  { label: 'Saldo corrente', val: fmtSaldo(kpi.saldo_corrente), sub: `Buffer: ${fmtEur(kpi.buffer_minimo)}`, warn: kpi.saldo_corrente < kpi.buffer_minimo },
                ].map((k) => (
                  <div key={k.label} className={`kpi-tile ${k.warn ? 'kpi-orange' : ''}`} style={!k.warn ? { background: '#fff', border: '1px solid #e5e7eb' } : undefined}>
                    <div className="kpi-label">{k.label}</div>
                    <div className="kpi-value">{k.val}</div>
                    <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginTop: 4 }}>{k.sub}</div>
                    {k.warn && <div style={{ fontSize: 11, color: '#c2410c', marginTop: 2 }}>⚠️ Sopra soglia</div>}
                  </div>
                ))}
              </div>

              {(() => {
                const kf = kpi.kpi_finanziari
                const tiles = [
                  { label: 'Copertura interessi', val: kf?.copertura_interessi != null ? `${kf.copertura_interessi.toFixed(1)}x` : '—', sub: kf ? kf.copertura_interessi_nota : 'Non calcolata: rigenera la proiezione' },
                  { label: 'Liquidità immediata', val: kf?.liquidita_giorni != null ? `${kf.liquidita_giorni.toFixed(0)} gg` : '—', sub: kf ? 'Cassa / uscite medie giornaliere dei primi 3 mesi' : 'Non calcolata: rigenera la proiezione', warn: kf?.liquidita_giorni != null && kf.liquidita_giorni < 30 },
                  { label: 'LCR PMI (30 gg)', val: kf?.lcr ? `${kf.lcr.lcr_pct.toFixed(0)}%` : '—', sub: kf?.lcr ? `(cassa + linee non utilizzate${kf.lcr.linee_dichiarate ? '' : ' — linee non dichiarate'}) / uscite in stress a 30 gg` : 'Non calcolato: rigenera la proiezione', warn: kf?.lcr != null && kf.lcr.lcr_pct < 100 },
                  { label: 'Debito bancario / fatturato', val: kf?.debito_bancario_su_fatturato != null ? `${(kf.debito_bancario_su_fatturato * 100).toFixed(0)}%` : '—', sub: kf ? kf.debito_bancario_nota : 'Non calcolato: rigenera la proiezione' },
                ]
                return (
                  <div className="grid-4" style={{ marginBottom: 16 }}>
                    {tiles.map((k) => (
                      <div key={k.label} className={`kpi-tile ${k.warn ? 'kpi-orange' : ''}`} style={!k.warn ? { background: '#fff', border: '1px solid #e5e7eb' } : undefined}>
                        <div className="kpi-label">{k.label}</div>
                        <div className="kpi-value">{k.val}</div>
                        <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginTop: 4 }}>{k.sub}</div>
                        {k.warn && <div style={{ fontSize: 11, color: '#c2410c', marginTop: 2 }}>⚠️ Sotto soglia</div>}
                      </div>
                    ))}
                  </div>
                )
              })()}

              <div className="grid-2" style={{ marginBottom: 16 }}>
                {(() => {
                  const pd = kpi.past_due
                  const stato = !pd?.dichiarato ? 'nd' : pd.flag ? 'alert' : 'ok'
                  const eta = pd?.al ? Math.floor((Date.now() - new Date(`${pd.al}T00:00:00Z`).getTime()) / 86400000) : null
                  const c = { nd: ['#f3f4f6', '#4b5563', '#6b7280', '⚪'], alert: ['#fef2f2', '#a32d2d', '#a32d2d', '🔴'], ok: ['#e6f4ea', '#1a6b2e', '#1a6b2e', '🟢'] }[stato]
                  return (
                    <div className="kpi-tile" style={{ background: c[0] }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{c[3]}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: c[1] }}>Past Due EBA 30gg</span>
                      </div>
                      <p style={{ fontSize: 11, marginTop: 6, color: c[2] }}>
                        {stato === 'nd' && 'Non dichiarato: indica in anagrafica le esposizioni bancarie scadute (Centrale dei Rischi). Non si ricava dai dati contabili.'}
                        {stato === 'alert' && `Esposizioni scadute da ${pd.giorni} giorni per €${fmt(pd.importo)} (rilevazione del ${pd.al.split('-').reverse().join('/')}). Rischio rating!`}
                        {stato === 'ok' && `Nessuna esposizione scaduta oltre 30 giorni (dichiarato il ${pd.al ? pd.al.split('-').reverse().join('/') : '—'}).`}
                        {stato !== 'nd' && eta != null && eta > 45 && ` ⚠️ Dato di ${eta} giorni fa: aggiornalo.`}
                      </p>
                    </div>
                  )
                })()}
                {(() => {
                  const c = kpi.concentrazione
                  const stato = !c ? 'nd' : c.alert ? 'alert' : 'ok'
                  const col = { nd: ['#f3f4f6', '#4b5563', '#6b7280', '⚪'], alert: ['#fff1e6', '#854f0b', '#854f0b', '🟡'], ok: ['#e6f4ea', '#1a6b2e', '#1a6b2e', '🟢'] }[stato]
                  return (
                    <div className="kpi-tile" style={{ background: col[0] }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{col[3]}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: col[1] }}>Concentrazione cliente</span>
                      </div>
                      <p style={{ fontSize: 11, marginTop: 6, color: col[2] }}>
                        {stato === 'nd' && 'Non calcolata: manca il dettaglio incassi per cliente. Elabora l\'Analisi dei flussi e rigenera la proiezione.'}
                        {stato === 'alert' && `${c.topCliente}: ${c.topPct}% degli incassi (soglia ${SOGLIA_CONCENTRAZIONE_PCT}%). Scenario "senza cliente" incluso negli stress test.`}
                        {stato === 'ok' && `Cliente principale al ${c.topPct}% degli incassi (soglia ${SOGLIA_CONCENTRAZIONE_PCT}%).`}
                      </p>
                    </div>
                  )
                })()}
              </div>

              <div className="card">
                <div className="card-body">
                  <h3 style={{ color: '#1a3a5c', marginTop: 0, fontSize: 14 }}>Validation rules CNDCEC §2.5k — Errori comuni</h3>
                  {[
                    {
                      label: 'Medie lineari per costi stagionali',
                      ok: kpi.stagionalita ? kpi.stagionalita.stagionali_piatte.length === 0 : null,
                      desc: kpi.stagionalita
                        ? `${kpi.stagionalita.n_piatte} voci di budget su ${kpi.stagionalita.n_voci} hanno 12 mesi identici${kpi.stagionalita.stagionali_piatte.length ? `; di natura stagionale: ${kpi.stagionalita.stagionali_piatte.join(', ')}` : ''}. Riscaldamento (inverno), manutenzione (fermo estivo), premi (fine anno) vanno distribuiti nei mesi giusti.`
                        : 'Non verificato: rigenera la proiezione per controllare la stagionalità del budget.',
                    },
                    { label: 'DSO ottimistico non giustificato', ok: kpi.validations?.['VR-1']?.ok ?? null, desc: kpi.validations?.['VR-1']?.msg },
                    { label: 'Versamenti IVA separati dai flussi imponibili', ok: true, desc: 'Incassi e pagamenti al lordo IVA; versamento per liquidazione mensile/trimestrale, credito riportato' },
                    { label: 'Concentrazione rischio cliente', ok: kpi.validations?.['VR-4']?.ok ?? null, desc: kpi.validations?.['VR-4']?.msg },
                    {
                      label: 'Rate dei finanziamenti da piano di ammortamento',
                      ok: kpi.finanziamenti ? (kpi.finanziamenti.rate_stimate_da_storico ? null : true) : null,
                      desc: !kpi.finanziamenti
                        ? 'Non verificato: rigenera la proiezione.'
                        : kpi.finanziamenti.rate_stimate_da_storico
                        ? 'Rate stimate ripetendo gli importi storici: dichiara i finanziamenti nell\'anagrafica per usare il piano di ammortamento (§2.5a).'
                        : kpi.finanziamenti.dichiarati
                        ? `${kpi.finanziamenti.n} finanziamento/i dichiarato/i: rate con date effettive dal piano.`
                        : 'Nessuna rata rilevata.',
                    },
                    {
                      label: 'Checklist mensile del budget',
                      ok: kpi.controlli ? kpi.controlli.mensile_ok : null,
                      desc: kpi.controlli ? (kpi.controlli.mensile_ok ? `Completata per ${kpi.controlli.mensile_periodo} (§2.5j)` : `Non completata per ${kpi.controlli.mensile_periodo}: scheda Controlli (§2.5j)`) : undefined,
                    },
                    {
                      label: 'Revisione trimestrale delle ipotesi',
                      ok: kpi.controlli ? kpi.controlli.trimestrale_ok : null,
                      desc: kpi.controlli ? (kpi.controlli.ultima_trimestrale ? `Ultima revisione completata il ${kpi.controlli.ultima_trimestrale.split('-').reverse().join('/')} (§2.5h: trimestrale)` : 'Nessuna revisione trimestrale registrata (§2.5h)') : undefined,
                    },
                    { label: 'Rolling forecast aggiornato', ok: kpi.validations?.['VR-5']?.ok ?? true, desc: kpi.validations?.['VR-5']?.msg },
                  ].map((r) => (
                    <div key={r.label} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f2f5' }}>
                      <span>{r.ok === null ? 'ℹ️' : r.ok ? '✅' : '⚠️'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</div>
                        {r.desc && <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginTop: 2 }}>{r.desc}</div>}
                      </div>
                      <span className={`badge ${r.ok === null ? '' : r.ok ? 'badge-success' : 'badge-warning'}`}>{r.ok === null ? 'NON VERIFICATO' : r.ok ? 'OK' : 'ATTENZIONE'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginTop: 10 }}>Ultimo aggiornamento: {new Date(kpi.ultimo_aggiornamento).toLocaleString('it-IT')}</p>
            </>
          )}
        </div>
      )}

      {tab === 'cashflow' && (
        <div style={{ marginTop: 16 }}>
          <div className="card no-print" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <h3 style={{ color: '#1a3a5c', marginTop: 0, marginBottom: 4 }}>Proiezione da Libro Giornale reale</h3>
              <p style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginBottom: 16 }}>
                Parte dal saldo reale dell'ultimo mese chiuso (Analisi dei flussi), colma il primo tratto con le fatture clienti/fornitori realmente ancora
                aperte (DSO/DPO storico), poi proietta dal budget approvato — IVA scorporata e calendarizzata, personale certo, rate mutuo dallo storico.
                Oltre dicembre {annoRiferimento}, in attesa del budget {annoRiferimento + 1}, replica lo stesso mese di calendario del budget{' '}
                {annoRiferimento} come budget "virtuale" (§3.2). I tre scenari CNDCEC si applicano solo ai mesi proiettati; i mesi reali restano
                definitivi.
              </p>
              <div className="grid-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Anno di riferimento</label>
                  <input type="number" className="form-control" value={annoRiferimento} onChange={(e) => setAnnoRiferimento(Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ultimo mese reale (chiusura)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="form-control" value={meseChiusura ?? ''} onChange={(e) => setMeseChiusura(Number(e.target.value))} disabled={!datiRealiAnno}>
                      <option value="">—</option>
                      {MESI_NOMI.map((n, i) => (
                        <option key={i} value={i + 1}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-outline btn-sm" title="Rilegge l'Analisi dei flussi (es. dopo un nuovo mese elaborato)" onClick={aggiornaDatiReali}>
                      🔄
                    </button>
                  </div>
                  {!datiRealiAnno && (
                    <span style={{ fontSize: 11, color: '#c2410c' }}>
                      Nessuna Analisi dei flussi trovata per {annoRiferimento}. Elaborala prima nella pagina "Analisi dei flussi".
                    </span>
                  )}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Orizzonte proiezione</label>
                  <div className="form-control" style={{ background: '#f8fafc', color: '#374151' }}>
                    12 mesi — CNDCEC §2.5
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 12, maxWidth: 200 }}>
                <label className="form-label">Buffer minimo (%)</label>
                <input type="number" className="form-control" min={5} max={50} value={bufferPct} onChange={(e) => setBufferPct(Number(e.target.value))} />
                <span style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55 }}>PMI manifatturiere: 15% · Servizi: 10%</span>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={avviaGenerazione} disabled={!aziendaId || !meseChiusura || generandoReale}>
                {generandoReale ? 'Genero...' : 'Genera proiezione'}
              </button>
              {piano && (
                <span style={{ marginLeft: 12, color: semaforoColore(piano.semaforo_globale), fontWeight: 700, fontSize: 13 }}>
                  {semaforoEmoji(piano.semaforo_globale)} {piano.semaforo_globale.toUpperCase()}
                </span>
              )}
              {piano?.ancora && (piano.modello_cassa ?? 0) < 10 && (
            <div className="alert" style={{ marginBottom: 12, background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>
              ⚠️ Questa proiezione è stata calcolata con un modello precedente: cassa sottostimata (IVA scorporata da importi già netti, costi non monetari contati come uscite), scenari ottimistico/pessimistico incoerenti col base, DSO non misurato e concentrazione clienti non calcolata. Premi «Genera proiezione» per ricalcolarla: le cifre cambieranno. Vedi CHANGELOG.md.
            </div>
          )}
          {piano?.ancora && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body">
                <h3 style={{ color: '#1a3a5c', marginTop: 0, fontSize: 14 }}>Cruscotto minimo (CNDCEC §2.5h)</h3>
                <div className="grid-4" style={{ marginBottom: 12 }}>
                  <div className="kpi-tile" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                    <div className="kpi-label">Cassa disponibile</div>
                    <div className="kpi-value">{fmtSaldo(piano.ancora.saldo_reale_iniziale)}</div>
                    <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55 }}>saldo reale a fine {MESI_NOMI[piano.ancora.ultimo_mese_reale - 1]} {piano.ancora.anno}</div>
                  </div>
                  {[0, 1, 2].map((i) => {
                    const m = piano.mesi[i]
                    return m ? (
                      <div key={i} className="kpi-tile" style={{ background: '#fff', border: `1px solid ${semaforoColore(m.semaforo_base)}` }}>
                        <div className="kpi-label">Saldo previsto ~{(i + 1) * 30} gg</div>
                        <div className="kpi-value">{fmtSaldo(m.saldo_base)}</div>
                        <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55 }}>
                          {semaforoEmoji(m.semaforo_base)} fine {MESI_NOMI[m.mese - 1]} {m.anno}
                        </div>
                      </div>
                    ) : null
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1a3a5c' }}>Partite aperte dal Libro Giornale (crediti e debiti a fine mese chiuso)</div>
                  {piano.partite_aperte?.n_esclusi > 0 && (
                    <div style={{ fontSize: 11, color: '#9a3412' }}>
                      {piano.partite_aperte.n_esclusi} escluse dal conteggio ({fmtEur(piano.partite_aperte.importo_escluso)})
                    </div>
                  )}
                </div>
                <ScadenzeModificate
                  modificate={scadenzeEscluse}
                  lista={piano.partite_aperte_lista}
                  modifica={modificaPartita}
                  setModifica={setModificaPartita}
                  onApplica={salvaDifferimento}
                  onRipristina={ripristinaScadenza}
                  onEscludi={toggleScadenzaEsclusa}
                  salvando={salvandoPartita}
                />
                {(piano.partite_aperte_lista || []).length === 0 ? (
                  <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55 }}>{piano.partite_aperte_lista ? 'Nessuna partita aperta a fine mese chiuso.' : 'Rigenera la proiezione per vedere le partite aperte.'}</div>
                ) : (
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    <table className="table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Scadenza stimata</th>
                          <th>Cliente / Fornitore</th>
                          <th>Tipo</th>
                          <th style={{ textAlign: 'right' }}>Importo</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {piano.partite_aperte_lista.map((sc) => (
                          <React.Fragment key={sc.conto}>
                          <tr style={sc.escluso ? { opacity: 0.55 } : sc.importo >= 50000 ? { background: '#fff7ed' } : undefined}>
                            <td style={{ whiteSpace: 'nowrap', color: !sc.escluso && sc.differimento ? '#1d4ed8' : undefined, fontWeight: !sc.escluso && sc.differimento ? 600 : undefined }}>{sc.data.split('-').reverse().join('/')}</td>
                            <td>
                              {sc.descrizione}
                              {sc.escluso && (
                                <div style={{ fontSize: 10, color: '#9a3412' }}>Esclusa dal conteggio{sc.motivo ? `: ${sc.motivo}` : ''}</div>
                              )}
                              {!sc.escluso && sc.differimento && (
                                <div style={{ fontSize: 10, color: '#1d4ed8' }}>
                                  Differita di {sc.differimento} gg (era il {dataOriginale(sc).split('-').reverse().join('/')}){sc.motivo ? `: ${sc.motivo}` : ''}
                                </div>
                              )}
                            </td>
                            <td>{sc.direzione === 'entrata' ? 'incasso' : 'pagamento'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, textDecoration: sc.escluso ? 'line-through' : undefined }}>
                              {fmtEur(sc.importo)}
                              {!sc.escluso && sc.importo >= 50000 ? ' ⚠️' : ''}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {sc.escluso ? (
                                <button className="btn btn-outline btn-sm no-print" disabled={salvandoPartita} onClick={() => toggleScadenzaEsclusa(sc)}>Includi</button>
                              ) : sc.differimento ? (
                                <>
                                  <button className="btn btn-outline btn-sm no-print" disabled={salvandoPartita} onClick={() => setModificaPartita({ conto: sc.conto, origine: 'tabella', giorni: String(sc.differimento), motivo: sc.motivo || '' })}>Modifica giorni</button>{' '}
                                  <button className="btn btn-outline btn-sm no-print" disabled={salvandoPartita} onClick={() => ripristinaScadenza(sc)}>Ripristina</button>{' '}
                                  <button className="btn btn-outline btn-sm no-print" disabled={salvandoPartita} onClick={() => toggleScadenzaEsclusa(sc)}>Escludi</button>
                                </>
                              ) : (
                                <>
                                  <button className="btn btn-outline btn-sm no-print" disabled={salvandoPartita} onClick={() => toggleScadenzaEsclusa(sc)}>Escludi</button>{' '}
                                  <button className="btn btn-outline btn-sm no-print" disabled={salvandoPartita} title="Sposta in avanti la scadenza stimata del numero di giorni che indichi" onClick={() => setModificaPartita({ conto: sc.conto, origine: 'tabella', giorni: '', motivo: '' })}>Differisci</button>
                                </>
                              )}
                            </td>
                          </tr>
                          {modificaPartita?.conto === sc.conto && modificaPartita.origine === 'tabella' && (
                            <tr>
                              <td colSpan={5}>
                                <EditorDifferimento modifica={modificaPartita} setModifica={setModificaPartita} base={dataOriginale(sc)} salvando={salvandoPartita} onApplica={() => salvaDifferimento(sc)} />
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginTop: 6 }}>
                  Saldo a 30/60/90 giorni approssimato con la fine dei primi tre mesi della proiezione. Importi al 100%, non pesati per probabilità; ⚠️ = oltre 50.000 € (soglia di esempio del documento). Le partite
                  escluse (es. un credito in contenzioso, un debito rinegoziato) non entrano nel calcolo del cash flow, nella vista a 13 settimane né negli stress test, e restano escluse anche nelle proiezioni
                  successive finché non le riammetti. Le partite differite restano nel cash flow con la scadenza spostata del numero di giorni indicato (data in blu), anche nella vista a 13 settimane e negli
                  stress test, finché non annulli il differimento.
                </div>
              </div>
            </div>
          )}
          {piano?.ancora && (
                <button className="btn btn-outline btn-sm" style={{ marginLeft: 12 }} onClick={() => window.print()}>
                  🖨️ Stampa / PDF
                </button>
              )}
              {erroreReale && (
                <div className="alert alert-error" style={{ marginTop: 12, marginBottom: 0 }}>
                  {erroreReale}
                </div>
              )}
            </div>
          </div>

          {piano?.ancora && (
            <>
              <div className="grid-3" style={{ marginBottom: 16 }}>
                <div className="kpi-tile kpi-blue">
                  <div className="kpi-label">Saldo di ancoraggio (reale)</div>
                  <div className="kpi-value">{fmtSaldo(piano.ancora.saldo_reale_iniziale)}</div>
                  <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginTop: 4 }}>
                    fine {MESI_NOMI[piano.ancora.ultimo_mese_reale - 1]} {piano.ancora.anno}
                  </div>
                </div>
                <div className={`kpi-tile ${Math.min(...piano.mesi.map((m) => m.saldo_base)) < 0 ? 'kpi-red' : 'kpi-green'}`}>
                  <div className="kpi-label">Saldo minimo proiettato</div>
                  <div className="kpi-value">{fmtSaldo(Math.min(...piano.mesi.map((m) => m.saldo_base)))}</div>
                </div>
                <div className="kpi-tile">
                  <div className="kpi-label">Saldo a fine orizzonte</div>
                  <div className="kpi-value">{fmtSaldo(piano.mesi[piano.mesi.length - 1]?.saldo_base ?? 0)}</div>
                </div>
              </div>

              <GraficoTesoreria piano={piano} />

              <ModaleDettaglio key={dettaglioCf ? `${dettaglioCf.colonna.chiave}-${dettaglioCf.gruppo}-${dettaglioCf.direzione}` : 'chiuso'} dettaglio={dettaglioCf} onClose={() => setDettaglioCf(null)} />
              <div className="card table-scroll">
                <table className="table cf-table">
                  <thead>
                    <tr>
                      <th className="cf-sticky-col" style={{ minWidth: 190 }}>
                        Voce
                      </th>
                      {piano.mesi_reali.map((m) => (
                        <th key={`r${m.mese_budget}`} style={{ textAlign: 'right', minWidth: 90, background: '#f0f4f8' }}>
                          {MESI_NOMI[m.mese - 1]} {m.anno}
                          <div style={{ fontSize: 9, fontWeight: 400, color: '#6b7280' }}>REALE</div>
                        </th>
                      ))}
                      {piano.mesi.map((m) => (
                        <th key={`p${m.mese_budget}`} style={{ textAlign: 'right', minWidth: 90 }}>
                          {MESI_NOMI[m.mese - 1]} {m.anno}
                          <div style={{ fontSize: 9, fontWeight: 400, color: '#6b7280' }}>proiezione</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="cf-sticky-col cf-espandi" onClick={() => setEspansi((e) => ({ ...e, entrata: !e.entrata }))} title="Mostra o nascondi il dettaglio per raggruppamento">
                        <span style={{ display: 'inline-block', width: 16, color: '#6b7280' }}>{espansi.entrata ? '▾' : '▸'}</span>
                        Entrate
                      </td>
                      {piano.mesi_reali.map((m) => (
                        <td key={`r${m.mese_budget}`} className="cf-pos" style={{ textAlign: 'right', background: '#f0f4f8' }}>
                          {fmtEur(m.entrate)}
                        </td>
                      ))}
                      {piano.mesi.map((m) => (
                        <td key={`p${m.mese_budget}`} className="cf-pos" style={{ textAlign: 'right' }}>
                          {fmtEur(m.entrate_certe + m.entrate_stimate)}
                        </td>
                      ))}
                    </tr>
                    {espansi.entrata && <RigheRaggruppamenti colonne={vociColonne(piano, piano.ancora?.anno === annoRiferimento ? datiRealiAnno : null, 'entrata')} direzione="entrata" onApri={setDettaglioCf} />}
                    <tr>
                      <td className="cf-sticky-col cf-espandi" onClick={() => setEspansi((e) => ({ ...e, uscita: !e.uscita }))} title="Mostra o nascondi il dettaglio per raggruppamento">
                        <span style={{ display: 'inline-block', width: 16, color: '#6b7280' }}>{espansi.uscita ? '▾' : '▸'}</span>
                        Uscite
                      </td>
                      {piano.mesi_reali.map((m) => (
                        <td key={`r${m.mese_budget}`} className="cf-neg" style={{ textAlign: 'right', background: '#f0f4f8' }}>
                          {fmtEur(m.uscite)}
                        </td>
                      ))}
                      {piano.mesi.map((m) => (
                        <td key={`p${m.mese_budget}`} className="cf-neg" style={{ textAlign: 'right' }}>
                          {fmtEur(m.uscite_certe + m.uscite_stimate)}
                        </td>
                      ))}
                    </tr>
                    {espansi.uscita && <RigheRaggruppamenti colonne={vociColonne(piano, piano.ancora?.anno === annoRiferimento ? datiRealiAnno : null, 'uscita')} direzione="uscita" onApri={setDettaglioCf} />}

                    {[
                      { key: 'saldo_ottimistico', label: '📈 Saldo — scenario ottimistico', cls: 'cf-pos' },
                      { key: 'saldo_base', label: '📊 Saldo (reale fino a chiusura, poi base)', bold: true },
                      { key: 'saldo_pessimistico', label: '📉 Saldo — scenario pessimistico', cls: 'cf-warn' },
                    ].map((r) => (
                      <tr key={r.key} className={r.bold ? 'cf-saldo-row' : ''}>
                        <td className="cf-sticky-col" style={{ fontWeight: r.bold ? 700 : 400 }}>
                          {r.label}
                        </td>
                        {piano.mesi_reali.map((m) => (
                          <td
                            key={`r${m.mese_budget}`}
                            className={m.saldo < 0 ? 'cf-neg' : undefined}
                            style={{ textAlign: 'right', fontWeight: r.bold ? 700 : 400, background: '#f0f4f8' }}
                          >
                            {fmtSaldo(m.saldo)}
                          </td>
                        ))}
                        {piano.mesi.map((m) => (
                          <td key={`p${m.mese_budget}`} className={m[r.key] < 0 ? 'cf-neg' : r.cls} style={{ textAlign: 'right', fontWeight: r.bold ? 700 : 400 }}>
                            {fmtSaldo(m[r.key])}
                          </td>
                        ))}
                      </tr>
                    ))}

                    <tr>
                      <td className="cf-sticky-col" style={{ color: '#9ca3af' }}>
                        Semaforo
                      </td>
                      {piano.mesi_reali.map((m) => (
                        <td key={`r${m.mese_budget}`} style={{ textAlign: 'center', background: '#f0f4f8' }} />
                      ))}
                      {piano.mesi.map((m) => (
                        <td key={`p${m.mese_budget}`} style={{ textAlign: 'center' }}>
                          {semaforoEmoji(m.semaforo_base)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginTop: 10 }}>
                Mesi reali (sfondo grigio) dal Libro Giornale — definitivi. Mesi di proiezione: partite aperte a fine chiusura ({piano.partite_aperte.n_crediti}{' '}
                crediti per {fmtEur(piano.partite_aperte.crediti)}, {piano.partite_aperte.n_debiti} debiti per {fmtEur(piano.partite_aperte.debiti)},
                scadenzati con il DSO/DPO storico reale) + budget {annoRiferimento} (IVA scorporata e calendarizzata, personale certo, rate mutuo da
                storico); oltre dicembre {annoRiferimento} replica lo stesso mese di calendario del budget {annoRiferimento} come budget "virtuale"{' '}
                {annoRiferimento + 1}, in attesa di quello vero (§3.2).
              </p>
            </>
          )}
        </div>
      )}

      {tab === 'stress' && (
        <div style={{ marginTop: 16 }}>
          {!piano && <div className="alert" style={{ background: '#eff6ff', color: '#1d4ed8' }}>ℹ️ Calcola prima il piano cash flow per generare gli stress test CNDCEC §2.5g.</div>}
          {piano && stressTests.length > 0 && (
            <>
              <div className="card" style={{ marginBottom: 16, background: semaforoColore(semaforoWorstCase) + '10', border: `2px solid ${semaforoColore(semaforoWorstCase)}` }}>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 32 }}>{semaforoEmoji(semaforoWorstCase)}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: semaforoColore(semaforoWorstCase) }}>Worst case: {semaforoWorstCase.toUpperCase()}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{raccomandazioniFinal[0]}</div>
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: 16 }}>
                {stressTests.map((st, i) => (
                  <div key={i} className="card" style={{ border: `1.5px solid ${semaforoColore(st.semaforo)}` }}>
                    <div className="card-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span>{semaforoEmoji(st.semaforo)}</span>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{st.scenario_nome}</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginBottom: 10 }}>{st.descrizione}</p>
                      <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                        <div>
                          <div style={{ color: '#9ca3af' }}>Saldo minimo</div>
                          <div className={st.saldo_minimo < 0 ? 'cf-neg' : ''} style={{ fontWeight: 700, fontSize: 13 }}>
                            {st.saldo_minimo == null ? '—' : fmtSaldo(st.saldo_minimo)}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#9ca3af' }}>Mese critico</div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{st.mese_critico || '—'}</div>
                        </div>
                        {st.fabbisogno_max > 0 && (
                          <div>
                            <div style={{ color: '#9ca3af' }}>Fabbisogno / linee</div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>
                              {fmtEur(st.fabbisogno_max)} / {st.coperto == null ? 'n.d.' : fmtEur(st.linee_disponibili)}
                            </div>
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginTop: 10, paddingTop: 8, borderTop: '1px solid #f0f2f5' }}>{st.messaggio}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body">
                  <h3 style={{ color: '#1a3a5c', marginTop: 0, fontSize: 14 }}>Priorità di pagamento in crisi (CNDCEC §2.4, §2.5i)</h3>
                  <p style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginTop: 0 }}>Ordine rigido da stabilire in condizioni di normalità, non nel momento del bisogno. Le voci essenziali non sono mai dilazionabili.</p>
                  <ol style={{ fontSize: 13, color: '#374151', margin: 0, paddingLeft: 20 }}>
                    <li>Stipendi e contributi (imprescindibili)</li>
                    <li>Tasse e imposte</li>
                    <li>Fornitori strategici non sostituibili</li>
                    <li>Servizio del debito (evitare il default)</li>
                    <li>Fornitori ordinari dilazionabili</li>
                    <li>Investimenti discrezionali (sospendibili)</li>
                  </ol>
                </div>
              </div>

              {raccomandazioniFinal.length > 1 && (
                <div className="card">
                  <div className="card-body">
                    <h3 style={{ color: '#1a3a5c', marginTop: 0, fontSize: 14 }}>Azioni correttive consigliate</h3>
                    {raccomandazioniFinal.map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 13, color: '#6b7280' }}>
                        <span>•</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'settimane' && (aziendaId ? <VistaSettimanale aziendaId={aziendaId} piano={piano} /> : <div className="alert" style={{ background: '#eff6ff', color: '#1d4ed8', marginTop: 16 }}>ℹ️ Seleziona un'azienda.</div>)}

      {tab === 'controlli' && (aziendaId ? <ControlliTesoreria aziendaId={aziendaId} /> : <div className="alert" style={{ background: '#eff6ff', color: '#1d4ed8', marginTop: 16 }}>ℹ️ Seleziona un'azienda.</div>)}

      {tab === 'investimenti' && (aziendaId ? <><Investimenti aziendaId={aziendaId} /><div style={{ marginTop: 16 }}><ManovreScorte aziendaId={aziendaId} /></div></> : <div className="alert" style={{ background: '#eff6ff', color: '#1d4ed8', marginTop: 16 }}>ℹ️ Seleziona un'azienda.</div>)}

      {tab === 'rolling' && (
        <div style={{ marginTop: 16 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <h3 style={{ color: '#1a3a5c', marginTop: 0, marginBottom: 4 }}>Aggiorna Rolling Forecast</h3>
              <p style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginBottom: 16 }}>
                Rilegge l'Analisi dei flussi (nel caso sia stato elaborato un mese più recente), misura automaticamente l'errore del primo mese
                dell'ultima proiezione contro il dato reale ora eventualmente disponibile, poi rigenera la proiezione ancorata alla nuova chiusura
                (CNDCEC §3.2).
              </p>
              {piano?.ancora ? (
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                  Ultima proiezione ancorata a {MESI_NOMI[piano.ancora.ultimo_mese_reale - 1]} {piano.ancora.anno}.
                </p>
              ) : (
                <p style={{ fontSize: 12, color: '#c2410c', marginBottom: 16 }}>Nessuna proiezione ancora generata: vai prima nella scheda Cash Flow.</p>
              )}
              <button className="btn btn-primary" onClick={aggiornaRollingReale} disabled={!aziendaId || rolling || !piano?.ancora}>
                {rolling ? 'Aggiornando...' : 'Aggiorna Rolling Forecast'}
              </button>
            </div>
          </div>

          {rollingResult && !rollingResult.errore && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>✅ Forecast aggiornato</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                <div>
                  Semaforo: <span style={{ color: semaforoColore(rollingResult.semaforo) }}>{semaforoEmoji(rollingResult.semaforo)} {rollingResult.semaforo}</span>
                </div>
                {rollingResult.errore_forecast_pct != null && (
                  <div>
                    Errore forecast:{' '}
                    <span className={Math.abs(rollingResult.errore_forecast_pct) < 10 ? 'cf-pos' : 'cf-warn'} style={{ fontWeight: 700 }}>
                      {rollingResult.errore_forecast_pct > 0 ? '+' : ''}
                      {rollingResult.errore_forecast_pct.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
              {rollingResult.messaggio_errore_forecast && <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>{rollingResult.messaggio_errore_forecast}</p>}
            </div>
          )}
          {rollingResult?.errore && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {rollingResult.errore}
            </div>
          )}

          <div className="card" style={{ background: '#f8fafc' }}>
            <div className="card-body">
              <h3 style={{ fontSize: 14, marginTop: 0, marginBottom: 12 }}>Come funziona il Rolling Forecast</h3>
              <div className="grid-3">
                {[
                  { icon: '📅', title: 'Settimanale', desc: 'Posizione di cassa reale vs prevista (max 48h ritardo dati)' },
                  { icon: '📊', title: 'Mensile', desc: "Scostamenti budget/consuntivo — aggiorna il 25 del mese con dati reali" },
                  { icon: '🔄', title: 'Trimestrale', desc: 'Revisione completa ipotesi base + aggiornamento forecast orizzonte 12 mesi' },
                ].map((r) => (
                  <div key={r.title} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#6b7280' }}>
                    <span style={{ fontSize: 16 }}>{r.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#374151' }}>{r.title}</div>
                      <div>{r.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
