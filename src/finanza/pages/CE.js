import React, { useEffect, useState } from 'react'
import { useApp } from '../../App'
import { supabase } from '../lib/supabase'
import { calcolaSpDocumento, TabellaSP } from '../lib/statoPatrimoniale'
import { trovaMappaturaConto, contiDelGruppo } from '../lib/mappatureConti'

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const MESI_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const ANNI = ['2024', '2025', '2026', '2027']
export const TIPI_LIBRO_GIORNALE = ['prima_nota_precedente', 'prima_nota_corrente', 'libro_giornale_precedente', 'libro_giornale_corrente']

const round2 = (n) => Math.round(n * 100) / 100
const fmt = (n) => (!n ? '—' : n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

const MAPPA_BUDGET_CEE = {
  'ricavi delle vendite e delle prestazioni': 'A1',
  'ricavi delle vendite': 'A1',
  'ricavi delle prestazioni': 'A1',
  'prestazioni di servizi': 'A1',
  'ricavi di spedizione': 'A1',
  'altri ricavi e proventi': 'A5',
  'altri ricavi': 'A5',
  'materie prime': 'B6',
  'materie prime, sussidiarie, di consumo e merci': 'B6',
  'per materie prime, sussidiarie, di consumo e di merci': 'B6',
  'costi di spedizione': 'B6',
  'per servizi': 'B7',
  servizi: 'B7',
  'godimento di beni di terzi': 'B8',
  'per godimento beni di terzi': 'B8',
  'per godimento di beni di terzi': 'B8',
  'affitti e locazioni': 'B8',
  'affitti e locazioni varie': 'B8',
  'per il personale': 'B9',
  personale: 'B9',
  'salari e stipendi': 'B9a',
  retribuzioni: 'B9a',
  'oneri sociali': 'B9b',
  contributi: 'B9b',
  'trattamento di fine rapporto': 'B9c',
  tfr: 'B9c',
  'ammortamenti e svalutazioni': 'B10',
  ammortamenti: 'B10b',
  'oneri diversi di gestione': 'B14',
  'oneri diversi': 'B14',
  'altri oneri': 'B14',
  'interessi attivi': 'C16',
  'proventi finanziari': 'C16',
  'proventi da partecipazioni': 'C15',
  'interessi e altri oneri finanziari': 'C17',
  'oneri finanziari': 'C17',
  'interessi passivi': 'C17',
  'interessi passivi moratori': 'C17',
  'perdite su cambi': 'C17',
  'spese e commissioni bancarie': 'C17',
  'commissioni su fidejussioni': 'C17',
  'imposte sul reddito': 'E20',
  imposte: 'E20',
}

function voceBudgetToCee(voceDesc) {
  const d = (voceDesc || '').toLowerCase().trim()
  if (MAPPA_BUDGET_CEE[d]) return MAPPA_BUDGET_CEE[d]
  for (const [key, codice] of Object.entries(MAPPA_BUDGET_CEE)) {
    if (d.includes(key) || key.includes(d)) return codice
  }
  return null
}

function trovaMappatura(conto, mappatureAzienda, mappatureGlobali) {
  const cl = (conto || '').toLowerCase()
  for (const m of mappatureAzienda) if (m.conto_origine.toLowerCase() === cl) return [m.voce_budget_descrizione, m.categoria]
  for (const m of mappatureGlobali) if (cl.includes(m.conto_origine.toLowerCase())) return [m.voce_budget_descrizione, m.categoria]
  return null
}

export async function caricaContesto(aziendaId) {
  const { data: mappatureAzienda } = await supabase.from('mappature_conti').select('*').eq('azienda_id', aziendaId).eq('globale', false)
  const { data: mappatureGlobali } = await supabase.from('mappature_conti').select('*').eq('globale', true)
  const { data: vociCeeList } = await supabase.from('voci_cee').select('*').order('ordine')
  const vociCeeByCodice = {}
  const vociCeeByDescrizione = {}
  for (const v of vociCeeList || []) {
    vociCeeByCodice[v.codice] = v
    vociCeeByDescrizione[v.descrizione] = v
  }
  return { mappatureAzienda: mappatureAzienda || [], mappatureGlobali: mappatureGlobali || [], vociCeeList: vociCeeList || [], vociCeeByCodice, vociCeeByDescrizione }
}

export function processaDocumento(dati, meseFine, modalita, ctx) {
  const { mappatureAzienda, mappatureGlobali, vociCeeByCodice, vociCeeByDescrizione } = ctx
  const aggregato = {}
  const aggiungi = (codiceCee, conto, importo, codiceConto) => {
    if (!aggregato[codiceCee]) aggregato[codiceCee] = { importo: 0, conti: [] }
    aggregato[codiceCee].importo += importo
    aggregato[codiceCee].conti.push({ codice: codiceConto || '', conto, importo: round2(importo) })
  }
  const codiceDaVoce = (voceDescrizione) => vociCeeByDescrizione[voceDescrizione]?.codice || voceBudgetToCee(voceDescrizione)
  // provvisorio: mappatura per descrizione libera del conto
  const getCodice = (conto, def) => {
    const risultato = trovaMappatura(conto, mappatureAzienda, mappatureGlobali)
    return (risultato && codiceDaVoce(risultato[0])) || def
  }
  // Libro Giornale/Prima Nota: mappatura del singolo conto o, in mancanza, del gruppo
  const getCodiceConto = (conto, gruppo, def) => {
    const m = trovaMappaturaConto(conto, mappatureAzienda, mappatureGlobali, gruppo)
    return (m && codiceDaVoce(m.voce_budget_descrizione)) || def
  }
  const divisore = modalita === 'mensile' ? meseFine : 1

  // Libro Giornale/Lista Prima Nota: ogni gruppo di conto riclassificato su
  // ricavi/costi (in Riclassificazione) confluisce qui nella voce CEE scelta,
  // con lo stesso meccanismo del provvisorio ma chiave = gruppo invece che
  // descrizione libera. I gruppi classificati come attivita'/passivita' (per lo
  // Stato Patrimoniale) sono ignorati: non riguardano il Conto Economico.
  if (dati.gruppi) {
    for (const g of dati.gruppi) {
      // Ogni conto e' riclassificato singolarmente: l'eccezione salvata sul
      // conto batte la mappatura del gruppo (vedi mappatureConti.js).
      for (const c of contiDelGruppo(g)) {
        if (!c.valore) continue
        const mappatura = trovaMappaturaConto(c.conto, mappatureAzienda, mappatureGlobali, g.gruppo)
        if (!mappatura || (mappatura.categoria !== 'ricavi' && mappatura.categoria !== 'costi')) continue
        const bucketRicavo = mappatura.categoria === 'ricavi'
        // Saldo col suo segno (Dare +, Avere -), portato al segno "naturale" della
        // categoria: i conti di una stessa voce si compensano (es. B11 Variazioni
        // delle rimanenze = esistenze iniziali in Dare - rimanenze finali in Avere)
        // invece di sommarsi in valore assoluto.
        const importoRaw = bucketRicavo ? -c.valore : c.valore
        const codiceCeeAgg = getCodiceConto(c.conto, g.gruppo, bucketRicavo ? 'A1' : 'B14')
        const voceCeeDest = vociCeeByCodice[codiceCeeAgg]
        const tipoDest = voceCeeDest?.tipo || (bucketRicavo ? 'ricavo' : 'costo')
        let segnoFlip = 1
        if (bucketRicavo && tipoDest === 'costo') segnoFlip = -1
        else if (!bucketRicavo && tipoDest === 'ricavo') segnoFlip = -1
        // sezioni C/D: proventi positivi e oneri negativi (RIS = A - B + C + D), qualunque sia la categoria del
        // conto: il valore e' sempre il saldo in Avere (-c.valore). Prima un provento (C15, C16, D18) classificato
        // dalla Riclassificazione con categoria "costi" veniva sottratto invece che sommato.
        else if (tipoDest === 'finanziario') segnoFlip = bucketRicavo ? 1 : -1
        // Il drill-down mostra ogni singolo conto, non un'unica riga con
        // l'etichetta del conto piu' rilevante.
        const importoConto = round2((importoRaw / divisore) * segnoFlip)
        if (importoConto === 0) continue
        aggiungi(codiceCeeAgg, c.descrizione || c.conto, importoConto, c.conto)
      }
    }
    return aggregato
  }

  for (const voceAgg of dati.ricavi?.voci || []) {
    const descAgg = voceAgg.descrizione || 'Ricavi'
    const dettaglio = voceAgg.dettaglio || []
    const codiceCeeAgg = getCodice(descAgg, 'A1')
    const tipoDest = vociCeeByCodice[codiceCeeAgg]?.tipo || 'ricavo'

    if (dettaglio.length) {
      for (const item of dettaglio) {
        const importoRaw = Math.abs(item.importo || 0)
        if (importoRaw === 0) continue
        let importo = round2(importoRaw / divisore)
        if (tipoDest === 'costo') importo = -importo
        aggiungi(codiceCeeAgg, item.descrizione || descAgg, importo, item.conto || '')
      }
    } else {
      const importoRaw = Math.abs(voceAgg.importo || 0)
      if (importoRaw === 0) continue
      let importo = round2(importoRaw / divisore)
      if (tipoDest === 'costo') importo = -importo
      aggiungi(codiceCeeAgg, descAgg, importo, voceAgg.codice || '')
    }
  }

  for (const voceAgg of dati.costi?.voci || []) {
    const descAgg = voceAgg.descrizione || 'Costi'
    const dettaglio = voceAgg.dettaglio || []
    const codiceCeeAgg = getCodice(descAgg, 'B14')
    const voceCeeDest = vociCeeByCodice[codiceCeeAgg]
    const tipoDest = voceCeeDest?.tipo || 'costo'
    const segnoDest = voceCeeDest?.segno ?? -1

    if (dettaglio.length) {
      for (const item of dettaglio) {
        const importoRaw = Math.abs(item.importo || 0)
        if (importoRaw === 0) continue
        let importo = round2(importoRaw / divisore)
        if (tipoDest === 'ricavo') importo = -importo
        else if (tipoDest === 'finanziario' && segnoDest < 0) importo = -importo
        aggiungi(codiceCeeAgg, item.descrizione || descAgg, importo, item.conto || '')
      }
    } else {
      const importoRaw = Math.abs(voceAgg.importo || 0)
      if (importoRaw === 0) continue
      let importo = round2(importoRaw / divisore)
      if (tipoDest === 'ricavo') importo = -importo
      else if (tipoDest === 'finanziario' && segnoDest < 0) importo = -importo
      aggiungi(codiceCeeAgg, descAgg, importo, voceAgg.codice || '')
    }
  }

  return aggregato
}

function calcolaTotali(aggregato, vociCee) {
  const sumSezione = (sez) => vociCee.filter((v) => v.sezione === sez && !v.totale).reduce((s, v) => s + (aggregato[v.codice]?.importo || 0), 0)
  return { A: sumSezione('A'), B: sumSezione('B'), C: sumSezione('C'), D: sumSezione('D') }
}

export function buildCe(aggregato, vociCee) {
  const { A: totA, B: totB, C: totC, D: totD } = calcolaTotali(aggregato, vociCee)
  return vociCee.map((voce) => {
    let importo, conti
    if (!voce.totale) {
      const datiVoce = aggregato[voce.codice] || {}
      importo = round2(datiVoce.importo || 0)
      conti = datiVoce.conti || []
    } else {
      conti = []
      if (voce.codice === 'A') importo = round2(totA)
      else if (voce.codice === 'B') importo = round2(totB)
      else if (voce.codice === 'DIFF') importo = round2(totA - totB)
      else if (voce.codice === 'C') importo = round2(totC)
      else if (voce.codice === 'D') importo = round2(totD)
      else if (voce.codice === 'EBIT_FIN') importo = round2(totA - totB + totC + totD)
      else if (voce.codice === 'RIS') importo = round2(totA - totB + totC + totD - (aggregato['E20']?.importo || 0))
      else importo = 0
    }
    return { codice: voce.codice, sezione: voce.sezione, descrizione: voce.descrizione, tipo: voce.tipo, livello: voce.livello, totale: voce.totale, importo, conti, ha_dettaglio: conti.length > 0 }
  })
}

async function calcolaCeDocumento(aziendaId, documentoId, modalita) {
  const { data: doc } = await supabase.from('documenti').select('*').eq('id', documentoId).single()
  if (!doc || !doc.dati_estratti) throw new Error('Documento non trovato o non elaborato')
  const dati = JSON.parse(doc.dati_estratti)
  const meseFine = doc.mese_fine || 12

  const ctx = await caricaContesto(aziendaId)
  const aggregato = processaDocumento(dati, meseFine, modalita, ctx)
  const voci = buildCe(aggregato, ctx.vociCeeList)
  const totali = calcolaTotali(aggregato, ctx.vociCeeList)

  // Solo per Libro Giornale/Prima Nota: gli stessi gruppi riclassificati
  // producono anche lo Stato Patrimoniale (i gruppi provvisorio/bilancio non
  // hanno conti di attivo/passivo, solo ricavi/costi).
  const stataPatrimoniale = TIPI_LIBRO_GIORNALE.includes(doc.tipo_documento) ? await calcolaSpDocumento(aziendaId, dati) : null

  return {
    anno: doc.anno,
    mese_fine: meseFine,
    voci,
    sommario: {
      valore_produzione: round2(totali.A),
      costi_produzione: round2(totali.B),
      ebit: round2(totali.A - totali.B),
      oneri_finanziari: round2(totali.C),
      // Le imposte (E20) hanno sezione 'E', esclusa da calcolaTotali (A-D):
      // vanno sottratte qui a parte, come gia' fa la riga 'RIS' nella tabella
      // sottostante — altrimenti il riquadro riassuntivo mostra un risultato
      // diverso (piu' alto) di quello della tabella e dello Stato Patrimoniale.
      risultato: round2(totali.A - totali.B + totali.C + totali.D - (aggregato['E20']?.importo || 0)),
    },
    statoPatrimoniale: stataPatrimoniale,
  }
}

async function calcolaCeMensile(aziendaId, anno) {
  const { data: documenti } = await supabase
    .from('documenti')
    .select('*')
    .eq('azienda_id', aziendaId)
    .eq('anno', anno)
    .eq('tipo_documento', 'provvisorio')
    .eq('stato', 'elaborato')
    .not('mese_fine', 'is', null)
    .order('mese_fine')
  if (!documenti || documenti.length === 0) throw new Error('Nessun provvisorio trovato per questo anno')

  const ctx = await caricaContesto(aziendaId)
  const mesiDisponibili = []
  const aggregatiMensili = {}

  for (const doc of documenti) {
    const mese = doc.mese_fine
    const dati = JSON.parse(doc.dati_estratti)
    const aggregatoCum = processaDocumento(dati, mese, 'cumulativo', ctx)

    if (mese > 1 && aggregatiMensili[mese - 1]) {
      const aggPrec = aggregatiMensili[mese - 1].cumulativo
      const aggDelta = {}
      const tutteVoci = new Set([...Object.keys(aggregatoCum), ...Object.keys(aggPrec)])
      for (const codice of tutteVoci) {
        const delta = round2((aggregatoCum[codice]?.importo || 0) - (aggPrec[codice]?.importo || 0))
        if (delta !== 0) aggDelta[codice] = { importo: delta, conti: aggregatoCum[codice]?.conti || [] }
      }
      aggregatiMensili[mese] = { cumulativo: aggregatoCum, mensile: aggDelta }
    } else {
      aggregatiMensili[mese] = { cumulativo: aggregatoCum, mensile: aggregatoCum }
    }
    mesiDisponibili.push(mese)
  }

  const ultimoDoc = documenti[documenti.length - 1]
  const datiUltimo = JSON.parse(ultimoDoc.dati_estratti)
  const aggregatoTotale = processaDocumento(datiUltimo, ultimoDoc.mese_fine, 'cumulativo', ctx)

  const voci = ctx.vociCeeList.map((voce) => {
    const importiMensili = {}
    const contiPerMese = {}
    for (const mese of mesiDisponibili) {
      const agg = aggregatiMensili[mese].mensile
      if (!voce.totale) {
        importiMensili[mese] = round2(agg[voce.codice]?.importo || 0)
        contiPerMese[mese] = agg[voce.codice]?.conti || []
      } else {
        const tot = calcolaTotali(agg, ctx.vociCeeList)
        if (voce.codice === 'A') importiMensili[mese] = round2(tot.A)
        else if (voce.codice === 'B') importiMensili[mese] = round2(tot.B)
        else if (voce.codice === 'DIFF') importiMensili[mese] = round2(tot.A - tot.B)
        else if (voce.codice === 'C') importiMensili[mese] = round2(tot.C)
        else if (voce.codice === 'D') importiMensili[mese] = round2(tot.D)
        else if (voce.codice === 'EBIT_FIN') importiMensili[mese] = round2(tot.A - tot.B + tot.C + tot.D)
        else if (voce.codice === 'RIS') importiMensili[mese] = round2(tot.A - tot.B + tot.C + tot.D - (agg['E20']?.importo || 0))
        else importiMensili[mese] = 0
        contiPerMese[mese] = []
      }
    }

    let importoCum, contiCum
    if (!voce.totale) {
      importoCum = round2(aggregatoTotale[voce.codice]?.importo || 0)
      contiCum = aggregatoTotale[voce.codice]?.conti || []
    } else {
      const totCum = calcolaTotali(aggregatoTotale, ctx.vociCeeList)
      // Nota: fedele al backend originale, qui mancano i casi C/D (bug esistente
      // nel vecchio codice: la colonna cumulativo per quelle righe resta 0).
      if (voce.codice === 'A') importoCum = round2(totCum.A)
      else if (voce.codice === 'B') importoCum = round2(totCum.B)
      else if (voce.codice === 'DIFF') importoCum = round2(totCum.A - totCum.B)
      else if (voce.codice === 'EBIT_FIN') importoCum = round2(totCum.A - totCum.B + totCum.C + totCum.D)
      else if (voce.codice === 'RIS') importoCum = round2(totCum.A - totCum.B + totCum.C + totCum.D - (aggregatoTotale['E20']?.importo || 0))
      else importoCum = 0
      contiCum = []
    }

    const haValori = Object.values(importiMensili).some((v) => v !== 0) || importoCum !== 0
    return {
      codice: voce.codice,
      sezione: voce.sezione,
      descrizione: voce.descrizione,
      tipo: voce.tipo,
      livello: voce.livello,
      totale: voce.totale,
      importi_mensili: importiMensili,
      importo_cumulativo: importoCum,
      conti_per_mese: contiPerMese,
      conti_cumulativo: contiCum,
      ha_dettaglio: haValori && !voce.totale,
    }
  })

  return { anno, mesi_disponibili: mesiDisponibili, voci }
}

const rowClass = (voce) => {
  if (['DIFF', 'EBIT_FIN', 'RIS'].includes(voce.codice)) return 'ce-row-finale'
  if (voce.totale && ['A', 'B'].includes(voce.codice)) return 'ce-row-sezione'
  if (voce.totale) return 'ce-row-sottotot'
  return ''
}
const importoClass = (importo, codice) => {
  if (importo < 0) return 'cf-neg'
  if (['DIFF', 'EBIT_FIN', 'RIS'].includes(codice)) return importo >= 0 ? 'cf-pos' : 'cf-neg'
  return ''
}
const padding = (livello) => (livello === 1 ? 10 : livello === 2 ? 26 : 42)

export default function CE() {
  const [aziende, setAziende] = useState([])
  // Pmi 360°: l'azienda è quella attiva dell'app (niente selettore nella pagina)
  const { azienda: aziendaAttiva } = useApp()
  const aziendaId = aziendaAttiva?.id || ''
  const [documenti, setDocumenti] = useState([])
  const [documentoId, setDocumentoId] = useState('')
  const [anno, setAnno] = useState('2026')
  const [modalita, setModalita] = useState('cumulativo')
  const [voci, setVoci] = useState([])
  const [vociMensili, setVociMensili] = useState([])
  const [mesiDisponibili, setMesiDisponibili] = useState([])
  const [sommario, setSommario] = useState(null)
  const [statoPatrimoniale, setStatoPatrimoniale] = useState(null)
  const [caricando, setCaricando] = useState(false)
  const [espansi, setEspansi] = useState(new Set())
  const [errore, setErrore] = useState('')
  const [salvandoProvv, setSalvandoProvv] = useState(false)
  const [messaggioProvv, setMessaggioProvv] = useState('')

  useEffect(() => {
    supabase
      .from('aziende')
      .select('id, nome')
      .order('nome')
      .then(({ data }) => setAziende(data || []))
  }, [])

  useEffect(() => {
    if (aziendaId) {
      supabase
        .from('documenti')
        .select('*')
        .eq('azienda_id', aziendaId)
        .in('tipo_documento', ['bilancio', 'provvisorio', ...TIPI_LIBRO_GIORNALE])
        .eq('stato', 'elaborato')
        .then(({ data }) => setDocumenti(data || []))
      setVoci([])
      setVociMensili([])
      setSommario(null)
      setStatoPatrimoniale(null)
      setDocumentoId('')
    }
  }, [aziendaId])

  const calcola = async () => {
    setCaricando(true)
    setErrore('')
    setMessaggioProvv('')
    setEspansi(new Set())
    try {
      if (modalita === 'mensile_multi') {
        const res = await calcolaCeMensile(aziendaId, anno)
        setVociMensili(res.voci)
        setMesiDisponibili(res.mesi_disponibili)
        setVoci([])
        setSommario(null)
        setStatoPatrimoniale(null)
      } else {
        if (!documentoId) return
        const mod = modalita === 'mensile_singolo' ? 'mensile' : 'cumulativo'
        const res = await calcolaCeDocumento(aziendaId, documentoId, mod)
        setVoci(res.voci)
        setSommario(res.sommario)
        setStatoPatrimoniale(res.statoPatrimoniale)
        setVociMensili([])
      }
    } catch (e) {
      setErrore(e.message || 'Errore nel calcolo')
    } finally {
      setCaricando(false)
    }
  }

  const toggleEspandi = (codice) => {
    setEspansi((prev) => {
      const n = new Set(prev)
      if (n.has(codice)) n.delete(codice)
      else n.add(codice)
      return n
    })
  }

  const doc = documenti.find((d) => d.id === documentoId)
  const aziendaCorrente = aziende.find((a) => a.id === aziendaId)

  // Salva il risultato appena calcolato (Conto Economico + Stato Patrimoniale,
  // se disponibile) come un nuovo documento "provvisorio": stesso formato che
  // usano gia' Genera budget, Genera previsioni e Analisi Bilancio, cosi' i
  // dati ricostruiti dal Libro Giornale alimentano quelle funzioni senza
  // bisogno di una logica dedicata per ciascuna.
  const salvaComeProvvisorio = async () => {
    if (!sommario || !voci.length) return
    const nomeScelto = window.prompt('Nome del documento da creare:', `Provvisorio ${doc?.anno || anno} — ${aziendaCorrente?.nome || ''}`.trim())
    if (!nomeScelto) return

    setSalvandoProvv(true)
    setErrore('')
    setMessaggioProvv('')
    try {
      const trovaSP = (codice) => statoPatrimoniale?.voci.find((v) => v.codice === codice)?.importo || 0

      const mappaVoce = (v) => ({
        descrizione: v.descrizione,
        importo: v.importo,
        ...(v.conti?.length ? { dettaglio: v.conti.map((c) => ({ conto: c.codice, descrizione: c.conto, importo: c.importo })) } : {}),
      })
      const ricaviVoci = voci.filter((v) => v.tipo === 'ricavo' && !v.totale && v.importo !== 0).map(mappaVoce)
      const costiVoci = voci.filter((v) => v.tipo === 'costo' && !v.totale && v.importo !== 0).map(mappaVoce)
      const ammortamenti = round2(voci.filter((v) => v.codice?.startsWith('B10') && !v.totale).reduce((s, v) => s + (v.importo || 0), 0))

      const datiEstratti = {
        ricavi: { totale: sommario.valore_produzione, voci: ricaviVoci },
        costi: { totale: sommario.costi_produzione, voci: costiVoci },
        ammortamenti,
        oneri_finanziari: sommario.oneri_finanziari < 0 ? round2(-sommario.oneri_finanziari) : 0,
        ebitda: sommario.ebit,
        margine_operativo: sommario.ebit,
        utile_netto: sommario.risultato,
        note: `Generato da Bilancio Riclassificato — ${doc?.nome_file || ''} (${new Date().toLocaleDateString('it-IT')})`,
        ...(statoPatrimoniale
          ? {
              totale_attivo: statoPatrimoniale.totAttivo,
              totale_immobilizzazioni: trovaSP('ATT_B'),
              attivo_circolante: trovaSP('ATT_C'),
              crediti_clienti: trovaSP('ATT_C_II_1'),
              disponibilita_liquide: round2(trovaSP('ATT_C_IV_1') + trovaSP('ATT_C_IV_2') + trovaSP('ATT_C_IV_3')),
              patrimonio_netto: trovaSP('PAS_A'),
              tfr: trovaSP('PAS_C'),
              totale_debiti: trovaSP('PAS_D'),
              debiti_breve: trovaSP('PAS_D'),
            }
          : {}),
      }

      const nuovoId = crypto.randomUUID()
      const { error: insErr } = await supabase.from('documenti').insert({
        id: nuovoId,
        azienda_id: aziendaId,
        nome_file: nomeScelto,
        tipo_file: 'json',
        tipo_documento: 'provvisorio',
        anno: doc?.anno || anno,
        mese_fine: doc?.mese_fine || 12,
        stato: 'elaborato',
        percorso: `generated/${aziendaId}_${nuovoId}_provvisorio.json`,
        dati_estratti: JSON.stringify(datiEstratti),
        caricato_il: new Date().toISOString(),
      })
      if (insErr) throw new Error(insErr.message)
      setMessaggioProvv(`✅ Documento "${nomeScelto}" creato su Documenti.`)
    } catch (e) {
      setErrore(e.message || 'Errore nel salvataggio del documento')
    } finally {
      setSalvandoProvv(false)
    }
  }

  return (
    <div>
      <h2 className="no-print" style={{ color: '#1a3a5c', marginTop: 0 }}>
        Bilancio Riclassificato
      </h2>
      <p className="no-print" style={{ color: '#666', marginTop: -8, marginBottom: 20 }}>
        Conto Economico (struttura CEE — OIC 12) e, per Libro Giornale/Prima Nota, anche Stato Patrimoniale (art. 2424 c.c.)
      </p>
      <div className="print-only" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c' }}>{aziendaCorrente?.nome || ''}</div>
        <div style={{ fontSize: 13, color: '#555' }}>
          Bilancio Riclassificato — {doc?.nome_file || ''} {doc?.anno || ''}
          {doc?.mese_fine ? ` (Gen-${MESI[doc.mese_fine - 1]})` : ''}
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div className="grid-3">
            <div className="form-group" style={{ marginBottom: 0 }}>
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
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Modalità</label>
              <select className="form-control" value={modalita} onChange={(e) => setModalita(e.target.value)}>
                <option value="cumulativo">Cumulativo</option>
                <option value="mensile_singolo">Mensile medio</option>
                <option value="mensile_multi">Multi-mese</option>
              </select>
            </div>
            {modalita === 'mensile_multi' ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Anno</label>
                <select className="form-control" value={anno} onChange={(e) => setAnno(e.target.value)}>
                  {ANNI.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Documento</label>
                <select className="form-control" value={documentoId} onChange={(e) => setDocumentoId(e.target.value)} disabled={!aziendaId || documenti.length === 0}>
                  <option value="">Seleziona documento...</option>
                  {documenti.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome_file} — {d.anno}
                      {d.mese_fine ? ` (Gen-${MESI[d.mese_fine - 1]})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="btn btn-primary" onClick={calcola} disabled={!aziendaId || (modalita !== 'mensile_multi' && !documentoId) || caricando}>
              {caricando ? 'Calcolando...' : 'Calcola CE'}
            </button>
          </div>
          {sommario && voci.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={salvaComeProvvisorio} disabled={salvandoProvv}>
                {salvandoProvv ? 'Salvataggio...' : '💾 Salva come Bilancio Provvisorio'}
              </button>
              <span style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55 }}>Crea un documento "provvisorio" con questo risultato, utilizzabile in Budget, Previsioni e Analisi Bilancio</span>
              <button className="btn btn-outline" style={{ marginLeft: 'auto' }} onClick={() => window.print()}>
                🖨️ Stampa / PDF
              </button>
            </div>
          )}
          {messaggioProvv && (
            <div className="alert alert-success" style={{ marginTop: 14, marginBottom: 0 }}>
              {messaggioProvv}
            </div>
          )}
          {errore && (
            <div className="alert alert-error" style={{ marginTop: 14, marginBottom: 0 }}>
              {errore}
            </div>
          )}
        </div>
      </div>

      {statoPatrimoniale && (
        <>
          <h3 style={{ color: '#1a3a5c' }}>Stato Patrimoniale Riclassificato</h3>
          <p style={{ color: '#666', marginTop: -8, marginBottom: 16, fontSize: 13 }}>Struttura ex art. 2424 c.c.</p>

          <div className="grid-3" style={{ marginBottom: 10 }}>
            <div className="kpi-tile kpi-blue">
              <div className="kpi-label">Totale Attivo</div>
              <div className="kpi-value">€{fmt(statoPatrimoniale.totAttivo)}</div>
            </div>
            <div className="kpi-tile kpi-blue">
              <div className="kpi-label">Totale Passivo + P.N.</div>
              <div className="kpi-value">€{fmt(statoPatrimoniale.totPassivo)}</div>
            </div>
            <div className={`kpi-tile ${statoPatrimoniale.risultatoEsercizio >= 0 ? 'kpi-green' : 'kpi-red'}`}>
              <div className="kpi-label">Risultato d'esercizio (ricavi - costi)</div>
              <div className="kpi-value">€{fmt(statoPatrimoniale.risultatoEsercizio)}</div>
            </div>
          </div>

          <div className={`alert ${Math.abs(statoPatrimoniale.differenza) < 0.02 ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 20 }}>
            {Math.abs(statoPatrimoniale.differenza) < 0.02
              ? "✅ Quadratura verificata: Totale Attivo = Totale Passivo + Patrimonio Netto (incluso il risultato d'esercizio)."
              : `⚠️ Non quadra: differenza di €${fmt(Math.abs(statoPatrimoniale.differenza))} — probabile gruppo non ancora classificato o classificato nella sezione sbagliata.`}
          </div>

          {statoPatrimoniale.nonClassificati.length > 0 && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              <strong>{statoPatrimoniale.nonClassificati.length} gruppi non ancora riclassificati</strong> (esclusi dal calcolo — vai su Riclassificazione):
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                {statoPatrimoniale.nonClassificati.map((g) => (
                  <li key={g.gruppo} style={{ fontSize: 12 }}>
                    {g.gruppo} — {g.descrizione} (€{fmt(g.importo)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid-2" style={{ gap: 20, alignItems: 'start' }}>
            <TabellaSP
              titolo="ATTIVO"
              voci={statoPatrimoniale.voci.filter((v) => v.tipo === 'attivita' || v.codice === 'ATT_TOT')}
              espansi={espansi}
              toggleEspandi={toggleEspandi}
            />
            <TabellaSP
              titolo="PASSIVO"
              voci={statoPatrimoniale.voci.filter((v) => v.tipo === 'passivita' || v.codice === 'PAS_TOT')}
              espansi={espansi}
              toggleEspandi={toggleEspandi}
            />
          </div>
        </>
      )}

      {sommario && voci.length > 0 && (
        <>
          <div className="grid-3" style={{ marginBottom: 16, marginTop: statoPatrimoniale ? 28 : 0 }}>
            <div className="kpi-tile kpi-green">
              <div className="kpi-label">Valore produzione (A)</div>
              <div className="kpi-value">€{fmt(sommario.valore_produzione)}</div>
            </div>
            <div className="kpi-tile kpi-red">
              <div className="kpi-label">Costi produzione (B)</div>
              <div className="kpi-value">€{fmt(sommario.costi_produzione)}</div>
            </div>
            <div className={`kpi-tile ${sommario.ebit >= 0 ? 'kpi-blue' : 'kpi-orange'}`}>
              <div className="kpi-label">EBIT (A-B)</div>
              <div className="kpi-value">€{fmt(sommario.ebit)}</div>
            </div>
          </div>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <div className={`kpi-tile ${sommario.risultato >= 0 ? 'kpi-green' : 'kpi-red'}`}>
              <div className="kpi-label">Risultato esercizio</div>
              <div className="kpi-value">€{fmt(sommario.risultato)}</div>
            </div>
          </div>

          <h3 style={{ color: '#1a3a5c' }}>
            Conto Economico — {modalita === 'mensile_singolo' ? 'Media mensile' : 'Cumulativo'}
            {doc?.mese_fine && (
              <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>
                Gen-{MESI[doc.mese_fine - 1]} {doc.anno}
              </span>
            )}
          </h3>

          <div className="card table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Voce CEE</th>
                  <th style={{ textAlign: 'right', width: 160 }}>Importo (€)</th>
                  <th style={{ width: 30 }} />
                </tr>
              </thead>
              <tbody>
                {voci.map((voce) => (
                  <React.Fragment key={voce.codice}>
                    <tr className={rowClass(voce)} style={{ cursor: voce.ha_dettaglio ? 'pointer' : 'default' }} onClick={() => voce.ha_dettaglio && toggleEspandi(voce.codice)}>
                      <td style={{ paddingLeft: padding(voce.livello) }}>
                        {!voce.totale && voce.codice && <span style={{ color: '#9ca3af', marginRight: 8, fontFamily: 'monospace', fontSize: 11 }}>{voce.codice}</span>}
                        {voce.descrizione}
                      </td>
                      <td className={importoClass(voce.importo, voce.codice)} style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {voce.importo !== 0 ? `${voce.importo < 0 ? '-' : ''}€${fmt(Math.abs(voce.importo))}` : '—'}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 11 }}>{voce.ha_dettaglio && (espansi.has(voce.codice) ? '▼' : '▶')}</td>
                    </tr>
                    {espansi.has(voce.codice) &&
                      voce.conti.map((c, idx) => (
                        <tr key={`${voce.codice}-${idx}`} className="ce-conto-row">
                          <td style={{ paddingLeft: 64, fontSize: 12, color: '#6b7280' }}>
                            <span style={{ marginRight: 8 }}>└─</span>
                            {c.codice && <span className="badge badge-info" style={{ marginRight: 8 }}>{c.codice}</span>}
                            {c.conto}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>
                            {c.importo < 0 ? '-' : ''}€{fmt(Math.abs(c.importo))}
                          </td>
                          <td />
                        </tr>
                      ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {vociMensili.length > 0 && mesiDisponibili.length > 0 && (
        <>
          <h3 style={{ color: '#1a3a5c' }}>
            Mensile — {anno} <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>({mesiDisponibili.map((m) => MESI_SHORT[m - 1]).join(', ')} + Cumulativo)</span>
          </h3>
          <div className="card table-scroll">
            <table className="table cf-table">
              <thead>
                <tr>
                  <th className="cf-sticky-col" style={{ minWidth: 220 }}>
                    Voce CEE
                  </th>
                  {mesiDisponibili.map((m) => (
                    <th key={m} style={{ textAlign: 'right', minWidth: 100 }}>
                      {MESI_SHORT[m - 1]}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', minWidth: 100, background: '#eff6ff' }}>Cumulativo</th>
                  <th style={{ width: 30 }} />
                </tr>
              </thead>
              <tbody>
                {vociMensili
                  .filter((v) => Object.values(v.importi_mensili).some((x) => x !== 0) || v.importo_cumulativo !== 0)
                  .map((voce) => (
                    <React.Fragment key={voce.codice}>
                      <tr className={rowClass(voce)} style={{ cursor: voce.ha_dettaglio ? 'pointer' : 'default' }} onClick={() => voce.ha_dettaglio && toggleEspandi(voce.codice)}>
                        <td className="cf-sticky-col" style={{ paddingLeft: padding(voce.livello) }}>
                          {!voce.totale && voce.codice && <span style={{ color: '#9ca3af', marginRight: 8, fontFamily: 'monospace', fontSize: 11 }}>{voce.codice}</span>}
                          {voce.descrizione}
                        </td>
                        {mesiDisponibili.map((m) => (
                          <td key={m} className={importoClass(voce.importi_mensili[m] || 0, voce.codice)} style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            {voce.importi_mensili[m] ? `${voce.importi_mensili[m] < 0 ? '-' : ''}€${fmt(Math.abs(voce.importi_mensili[m]))}` : '—'}
                          </td>
                        ))}
                        <td className={importoClass(voce.importo_cumulativo, voce.codice)} style={{ textAlign: 'right', fontFamily: 'monospace', background: '#f5f9ff' }}>
                          {voce.importo_cumulativo ? `${voce.importo_cumulativo < 0 ? '-' : ''}€${fmt(Math.abs(voce.importo_cumulativo))}` : '—'}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 11 }}>{voce.ha_dettaglio && (espansi.has(voce.codice) ? '▼' : '▶')}</td>
                      </tr>
                      {espansi.has(voce.codice) &&
                        mesiDisponibili.map((m) =>
                          (voce.conti_per_mese[m] || []).map((c, idx) => (
                            <tr key={`${voce.codice}-${m}-${idx}`} className="ce-conto-row">
                              <td className="cf-sticky-col" style={{ paddingLeft: 64, fontSize: 12, color: '#6b7280', background: '#fffbea' }}>
                                {idx === 0 && (
                                  <>
                                    <span style={{ marginRight: 8 }}>└─</span>
                                    <span style={{ fontWeight: 600, color: '#1d4ed8' }}>{MESI_SHORT[m - 1]}</span>{' '}
                                  </>
                                )}
                                {c.codice && <span className="badge badge-info" style={{ margin: '0 8px' }}>{c.codice}</span>}
                                {c.conto}
                              </td>
                              <td colSpan={mesiDisponibili.length + 2} style={{ textAlign: 'right', fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>
                                {c.importo < 0 ? '-' : ''}€{fmt(Math.abs(c.importo))}
                              </td>
                            </tr>
                          ))
                        )}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginTop: 10 }}>▶ Clicca su una voce per vedere il dettaglio conti per mese</p>
        </>
      )}
    </div>
  )
}
