import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'

// ============================================================
// Simulazione d'impatto EasyPMI (contratto v7 + schema v8) nello step Analisi.
// La chiamata passa dalla Edge Function `simulazione-impatto`, che
// ri-ospita i due PDF nel fascicolo e salva la sintesi in
// `determina_simulazioni`. Una nuova simulazione sostituisce la precedente.
// Lo schema EasyPMI è rigido: si inviano solo i campi previsti per il tipo.
// ============================================================

export const VOCE_SIMULAZIONE = "Simulazione d'impatto (EasyPMI)"

// Tipi d'impatto oggi supportati da EasyPMI (motore impatto-2)
const TIPI_IMPATTO = {
  acquisto_bene:    'Acquisto di un bene (investimento)',
  leasing:          'Leasing',
  finanziamento:    'Finanziamento rateale (mutuo, prestito)',
  costo_ricorrente: 'Costo ricorrente (servizi, consulenze, canoni, locazioni)',
  costo_una_tantum: 'Costo una tantum (evento, adeguamento, manutenzione…)',
  personale:        'Personale (assunzione o uscita)',
}
const TUTTI = Object.keys(TIPI_IMPATTO)

// Tipo di delibera → tipi d'impatto coerenti. Tipi assenti (personalizzati,
// urgenza, adempimenti contabili) → tutti; lista vuota → nessuna simulazione.
const IMPATTI_PER_TIPO = {
  beni_strumentali:       ['acquisto_bene', 'leasing', 'finanziamento'],
  contratto:              ['costo_ricorrente', 'costo_una_tantum'],
  operazione_finanziaria: ['finanziamento', 'leasing'],
  personale:              ['personale', 'costo_una_tantum', 'costo_ricorrente'],
  assunzione:             ['personale'],
  consulenza:             ['costo_ricorrente', 'costo_una_tantum'],
  contenzioso:            ['costo_una_tantum'],
  rs_innovazione:         ['acquisto_bene', 'costo_una_tantum', 'costo_ricorrente', 'leasing'],
  marketing:              ['costo_una_tantum', 'costo_ricorrente'],
  immobiliare:            ['acquisto_bene', 'leasing', 'costo_ricorrente', 'costo_una_tantum', 'finanziamento'],
  compliance:             ['costo_ricorrente', 'costo_una_tantum'],
  procura:                [],
}
export const impattiPerTipo = (tipo) => IMPATTI_PER_TIPO[tipo] ?? TUTTI

const CATEGORIE_RICORRENTE = { servizi: 'Servizi', consulenza: 'Consulenza', locazione_passiva: 'Locazione passiva', canone_software: 'Canone software', marketing: 'Marketing', altro: 'Altro' }
const CATEGORIE_UNA_TANTUM = { evento: 'Evento', sponsorizzazione: 'Sponsorizzazione', adeguamento: 'Adeguamento normativo', manutenzione: 'Manutenzione', spese_legali: 'Spese legali', altro: 'Altro' }
const CATEGORIA_DEFAULT = { consulenza: 'altro', marketing: 'evento', contenzioso: 'spese_legali', compliance: 'adeguamento', immobiliare: 'manutenzione' }
const RICORRENTE_DEFAULT = { consulenza: 'consulenza', marketing: 'marketing', immobiliare: 'locazione_passiva', rs_innovazione: 'canone_software' }
const INQUADRAMENTI = { impiegato: 'Impiegato', operaio: 'Operaio', quadro: 'Quadro', dirigente: 'Dirigente' }
// Tipi senza IVA su nessun movimento: il regime IVA non si chiede né si invia
const SENZA_IVA = ['finanziamento', 'personale']

// Default del tipo "personale" dai dati lavoro della scheda azienda (Impostazioni)
function datiLavoro(azienda) {
  const inps = azienda?.aliquota_inps_datore_pct, inail = azienda?.tasso_inail_pct
  return {
    mensilita: [13, 14].includes(azienda?.mensilita) ? azienda.mensilita : 13,
    contributi_pct: inps != null ? Math.round((Number(inps) + Number(inail || 0)) * 100) / 100 : '',
    completi: inps != null && inail != null,
  }
}

const PERIODICITA = { mensile: 'Mensile', trimestrale: 'Trimestrale', semestrale: 'Semestrale' }

const eur = (n) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 }) + ' €'
const eurDelta = (n) => (n == null || isNaN(n)) ? '—' : (n > 0 ? '+' : '') + eur(n)
const coloreDelta = (n) => n > 0 ? '#1E8449' : n < 0 ? '#C0392B' : '#666'
const SEMAFORO = { verde: '🟢', giallo: '🟡', rosso: '🔴', nd: '⚪' }
const num = (v) => Number(String(v ?? '').replace(',', '.'))
const intero = (v) => parseInt(v, 10)
const pieno = (v) => v !== '' && v != null

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const meseEsteso = (am) => { const [a, m] = String(am || '').split('-'); return m ? `${MESI[Number(m) - 1]} ${a}` : am }

function primoDelMeseProssimo() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Stato di UNA operazione: campi comuni + un blocco per tipo (si passa da un
// tipo all'altro senza perdere quanto già compilato)
function singoloVuoto({ oggetto, valore, tipoAtto, impatti, azienda }) {
  const lav = datiLavoro(azienda)
  return {
    tipo_impatto: impatti[0] || 'leasing',
    descrizione: oggetto || '', data_decorrenza: primoDelMeseProssimo(), iva_regime: 'ordinaria',
    ricavi_modalita: '', ricavi_valore: '', ricavi_mese: '',   // ipotesi_ricavi: campo comune a tutti i tipi
    leasing: { metodo: 'patrimoniale', imponibile: valore || '', maxicanone: 0, numero_rate: 60, riscatto: 0, canone: '', tasso: '', durata_ammortamento: '', costi_esercizio: 0 },
    acquisto_bene: { imponibile: valore || '', pag_modalita: 'unico', acconto_pct: 30, numero_rate: 12, periodicita: 'mensile', amm_tipo: 'durata', amm_valore: 60, data_entrata: '', costi_esercizio: 0, contributi: [] },
    finanziamento: { importo: valore || '', data_erogazione: '', tasso: '', numero_rate: 60, periodicita: 'mensile', piano: 'francese', preammortamento_mesi: 0, spese_istruttoria: 0 },
    costo_ricorrente: { categoria: RICORRENTE_DEFAULT[tipoAtto] || 'servizi', importo_periodico: '', periodicita_fatturazione: 'mensile', pagamento_anticipato: false, durata_mesi: 12, indicizzazione: 0, una_tantum_iniziale: 0, deposito_cauzionale: 0, fee_importo: '', fee_data: '' },
    costo_una_tantum: { categoria: CATEGORIA_DEFAULT[tipoAtto] || 'altro', importo: valore || '', piano: [] },
    personale: { movimento: 'ingresso', numero_persone: 1, inquadramento: 'impiegato', ral_annua: '', mensilita: lav.mensilita, contributi_pct: lav.contributi_pct, durata_mesi: '', benefit_annui: 0, bonus_importo: '', bonus_mese: '', costi_una_tantum: [], incentivo_esodo: '', sgravio_pct: '', sgravio_mesi: '' },
  }
}

// Ricostruisce un'operazione dalla richiesta salvata (per "Rifai simulazione")
function singoloDaRichiesta(r, base) {
  const f = { ...base, tipo_impatto: r.tipo_impatto, descrizione: r.descrizione || '', data_decorrenza: r.data_decorrenza || base.data_decorrenza, iva_regime: r.iva_regime || 'ordinaria',
    ricavi_modalita: r.ipotesi_ricavi?.modalita || '', ricavi_valore: r.ipotesi_ricavi?.valore ?? '', ricavi_mese: (r.ipotesi_ricavi?.mese_partenza || '').slice(0, 7) }
  if (r.tipo_impatto === 'leasing') {
    const l = r.leasing || {}
    f.leasing = { metodo: l.metodo_contabile || 'patrimoniale', imponibile: r.imponibile ?? '', maxicanone: l.maxicanone ?? 0, numero_rate: l.numero_rate ?? 60, riscatto: l.riscatto ?? 0, canone: l.canone ?? '', tasso: l.tasso_annuo_pct ?? '', durata_ammortamento: r.ammortamento?.durata_mesi ?? '', costi_esercizio: r.costi_esercizio_mensili ?? 0 }
  } else if (r.tipo_impatto === 'acquisto_bene') {
    const p = r.pagamento || {}, a = r.ammortamento || {}
    f.acquisto_bene = { imponibile: r.imponibile ?? '', pag_modalita: p.modalita || 'unico', acconto_pct: p.acconto_pct ?? 30, numero_rate: p.numero_rate ?? 12, periodicita: p.periodicita || 'mensile', amm_tipo: a.aliquota_annua_pct != null ? 'aliquota' : 'durata', amm_valore: a.aliquota_annua_pct ?? a.durata_mesi ?? 60, data_entrata: r.data_entrata_in_funzione || '', costi_esercizio: r.costi_esercizio_mensili ?? 0, contributi: r.contributi || [] }
  } else if (r.tipo_impatto === 'finanziamento') {
    f.finanziamento = { importo: r.importo ?? '', data_erogazione: r.data_erogazione || '', tasso: r.tasso_annuo_pct ?? '', numero_rate: r.numero_rate ?? 60, periodicita: r.periodicita || 'mensile', piano: r.piano || 'francese', preammortamento_mesi: r.preammortamento_mesi ?? 0, spese_istruttoria: r.spese_istruttoria ?? 0 }
  } else if (r.tipo_impatto === 'costo_ricorrente') {
    f.costo_ricorrente = { categoria: r.categoria || 'servizi', importo_periodico: r.importo_periodico ?? '', periodicita_fatturazione: r.periodicita_fatturazione || 'mensile', pagamento_anticipato: !!r.pagamento_anticipato, durata_mesi: r.durata_mesi ?? 12, indicizzazione: r.indicizzazione_annua_pct ?? 0, una_tantum_iniziale: r.una_tantum_iniziale ?? 0, deposito_cauzionale: r.deposito_cauzionale ?? 0, fee_importo: r.success_fee?.importo ?? '', fee_data: r.success_fee?.data_prevista || '' }
  } else if (r.tipo_impatto === 'costo_una_tantum') {
    f.costo_una_tantum = { categoria: r.categoria || 'altro', importo: r.importo ?? '', piano: r.piano_pagamenti || [] }
  } else if (r.tipo_impatto === 'personale') {
    f.personale = { movimento: r.movimento || 'ingresso', numero_persone: r.numero_persone ?? 1, inquadramento: r.inquadramento || 'impiegato', ral_annua: r.ral_annua ?? '', mensilita: r.mensilita ?? 13, contributi_pct: r.contributi_pct ?? '', durata_mesi: r.durata_mesi ?? '', benefit_annui: r.benefit_annui ?? 0, bonus_importo: r.bonus_variabile?.importo_annuo ?? '', bonus_mese: (r.bonus_variabile?.mese_pagamento || '').slice(0, 7), costi_una_tantum: r.costi_una_tantum || [], incentivo_esodo: r.incentivo_esodo ?? '', sgravio_pct: r.sgravi?.riduzione_contributi_pct ?? '', sgravio_mesi: r.sgravi?.durata_mesi ?? '' }
  }
  return f
}

// Costruisce la `decisione` con i soli campi ammessi dallo schema rigido di EasyPMI
function costruisciDecisione(f) {
  const d = { tipo_impatto: f.tipo_impatto, descrizione: f.descrizione.trim(), data_decorrenza: f.data_decorrenza }
  if (f.iva_regime !== 'ordinaria' && !SENZA_IVA.includes(f.tipo_impatto)) d.iva_regime = f.iva_regime

  if (f.tipo_impatto === 'leasing') {
    const x = f.leasing
    const leasing = { metodo_contabile: x.metodo, maxicanone: num(x.maxicanone || 0), numero_rate: intero(x.numero_rate), periodicita: 'mensile', riscatto: num(x.riscatto || 0), canone: num(x.canone) }
    if (pieno(x.tasso)) leasing.tasso_annuo_pct = num(x.tasso)
    Object.assign(d, { imponibile: num(x.imponibile), leasing, costi_esercizio_mensili: num(x.costi_esercizio || 0) })
    if (x.metodo === 'finanziario') d.ammortamento = { durata_mesi: intero(x.durata_ammortamento) }
  } else if (f.tipo_impatto === 'acquisto_bene') {
    const x = f.acquisto_bene
    const pagamento = { modalita: x.pag_modalita }
    if (x.pag_modalita === 'acconto_saldo') pagamento.acconto_pct = num(x.acconto_pct)
    if (x.pag_modalita === 'rate') Object.assign(pagamento, { numero_rate: intero(x.numero_rate), periodicita: x.periodicita })
    Object.assign(d, {
      imponibile: num(x.imponibile), pagamento,
      ammortamento: x.amm_tipo === 'aliquota' ? { aliquota_annua_pct: num(x.amm_valore) } : { durata_mesi: intero(x.amm_valore) },
      costi_esercizio_mensili: num(x.costi_esercizio || 0),
    })
    if (x.data_entrata) d.data_entrata_in_funzione = x.data_entrata
    const contributi = x.contributi.filter(c => pieno(c.importo)).map(c => ({ descrizione: (c.descrizione || '').trim() || 'Contributo', importo: num(c.importo), data_incasso: c.data_incasso, natura: c.natura }))
    if (contributi.length) d.contributi = contributi
  } else if (f.tipo_impatto === 'finanziamento') {
    const x = f.finanziamento
    Object.assign(d, {
      forma: 'rateale', importo: num(x.importo), data_erogazione: x.data_erogazione || f.data_decorrenza,
      tasso_annuo_pct: num(x.tasso), numero_rate: intero(x.numero_rate), periodicita: x.periodicita, piano: x.piano,
      preammortamento_mesi: intero(x.preammortamento_mesi || 0), spese_istruttoria: num(x.spese_istruttoria || 0),
    })
  } else if (f.tipo_impatto === 'costo_ricorrente') {
    const x = f.costo_ricorrente
    Object.assign(d, {
      categoria: x.categoria, importo_periodico: num(x.importo_periodico), periodicita_fatturazione: x.periodicita_fatturazione,
      pagamento_anticipato: !!x.pagamento_anticipato, durata_mesi: intero(x.durata_mesi), indicizzazione_annua_pct: num(x.indicizzazione || 0),
    })
    if (num(x.una_tantum_iniziale) > 0) d.una_tantum_iniziale = num(x.una_tantum_iniziale)
    if (num(x.deposito_cauzionale) > 0) d.deposito_cauzionale = num(x.deposito_cauzionale)
    if (pieno(x.fee_importo)) d.success_fee = { importo: num(x.fee_importo), data_prevista: x.fee_data }
  } else if (f.tipo_impatto === 'costo_una_tantum') {
    const x = f.costo_una_tantum
    Object.assign(d, { categoria: x.categoria, importo: num(x.importo) })
    const piano = x.piano.filter(p => p.data && pieno(p.importo)).map(p => ({ data: p.data, importo: num(p.importo) }))
    if (piano.length) d.piano_pagamenti = piano
  } else if (f.tipo_impatto === 'personale') {
    const x = f.personale, uscita = x.movimento === 'uscita'
    Object.assign(d, {
      movimento: x.movimento, numero_persone: intero(x.numero_persone || 1), inquadramento: x.inquadramento,
      ral_annua: num(x.ral_annua), mensilita: intero(x.mensilita), contributi_pct: num(x.contributi_pct),
    })
    if (!uscita && pieno(x.durata_mesi)) d.durata_mesi = intero(x.durata_mesi)
    if (num(x.benefit_annui) > 0) d.benefit_annui = num(x.benefit_annui)
    if (pieno(x.bonus_importo)) d.bonus_variabile = { importo_annuo: num(x.bonus_importo), mese_pagamento: `${x.bonus_mese}-01` }
    const ut = x.costi_una_tantum.filter(k => pieno(k.importo)).map(k => ({ descrizione: (k.descrizione || '').trim() || 'Costo una tantum', importo: num(k.importo) }))
    if (ut.length) d.costi_una_tantum = ut
    if (uscita && num(x.incentivo_esodo) > 0) d.incentivo_esodo = num(x.incentivo_esodo)
    if (pieno(x.sgravio_pct) && pieno(x.sgravio_mesi)) d.sgravi = { riduzione_contributi_pct: num(x.sgravio_pct), durata_mesi: intero(x.sgravio_mesi) }
  }
  if (f.ricavi_modalita) d.ipotesi_ricavi = { modalita: f.ricavi_modalita, valore: num(f.ricavi_valore), mese_partenza: `${f.ricavi_mese}-01` }
  return d
}

function validaSingolo(f) {
  if (!f.descrizione.trim()) return 'Inserisci una descrizione.'
  if (!f.data_decorrenza) return 'Inserisci la data di decorrenza.'
  if (f.ricavi_modalita) {
    if (!(num(f.ricavi_valore) > 0) || !f.ricavi_mese) return 'Completa l\'ipotesi di ricavi (valore e mese di partenza) o rimuovila.'
    if (f.ricavi_mese < f.data_decorrenza.slice(0, 7)) return 'I ricavi ipotizzati non possono partire prima del mese di decorrenza.'
  }
  const x = f[f.tipo_impatto]
  if (f.tipo_impatto === 'leasing') {
    if (!(num(x.imponibile) > 0)) return 'Inserisci il valore del bene (IVA esclusa).'
    if (!(intero(x.numero_rate) > 0)) return 'Inserisci il numero di rate.'
    if (!(num(x.canone) > 0)) return 'Inserisci il canone mensile (IVA esclusa).'
    if (x.metodo === 'finanziario' && (!pieno(x.tasso) || !(intero(x.durata_ammortamento) > 0)))
      return 'Con il metodo finanziario servono tasso annuo e durata dell\'ammortamento.'
  } else if (f.tipo_impatto === 'acquisto_bene') {
    if (!(num(x.imponibile) > 0)) return 'Inserisci il valore del bene (IVA esclusa).'
    if (!(num(x.amm_valore) > 0)) return 'Indica la durata o l\'aliquota di ammortamento.'
    if (x.pag_modalita === 'rate' && !(intero(x.numero_rate) > 0)) return 'Indica il numero di rate di pagamento.'
    if (x.contributi.some(c => pieno(c.importo) && !c.data_incasso)) return 'Indica la data di incasso di ogni contributo.'
  } else if (f.tipo_impatto === 'finanziamento') {
    if (!(num(x.importo) > 0)) return 'Inserisci l\'importo del finanziamento.'
    if (!pieno(x.tasso)) return 'Inserisci il tasso annuo.'
    if (!(intero(x.numero_rate) > 0)) return 'Inserisci il numero di rate.'
  } else if (f.tipo_impatto === 'costo_ricorrente') {
    if (!(num(x.importo_periodico) > 0)) return 'Inserisci l\'importo per periodo di fatturazione.'
    if (!(intero(x.durata_mesi) > 0)) return 'Inserisci la durata del contratto in mesi.'
    if (pieno(x.fee_importo) && !x.fee_data) return 'Indica la data prevista della success fee.'
  } else if (f.tipo_impatto === 'costo_una_tantum') {
    if (!(num(x.importo) > 0)) return 'Inserisci l\'importo.'
  } else if (f.tipo_impatto === 'personale') {
    if (!(num(x.ral_annua) > 0)) return 'Inserisci la RAL annua per persona.'
    if (!(num(x.contributi_pct) > 0)) return 'Inserisci l\'aliquota contributiva a carico azienda (INPS + INAIL): la trovi sul cedolino, oppure compilala una volta in Impostazioni → Dettagli azienda.'
    if (!(intero(x.numero_persone) > 0)) return 'Inserisci il numero di persone.'
    if (pieno(x.bonus_importo) && !x.bonus_mese) return 'Indica il mese di pagamento del bonus.'
    if (pieno(x.sgravio_pct) !== pieno(x.sgravio_mesi)) return 'Per lo sgravio indica sia la riduzione (% dei contributi) sia la durata in mesi.'
    if (pieno(x.sgravio_pct) && num(x.sgravio_pct) > 100) return 'Lo sgravio è una percentuale dei contributi: al massimo 100 (esonero totale).'
  }
  return null
}

// Modulo completo: una o più operazioni (composta, max 5 componenti).
// Da sola, un'operazione si invia come tipo singolo.
const MAX_COMPONENTI = 5
function formVuoto(opz) {
  return { composta: false, descrizione: opz.oggetto || '', componenti: [singoloVuoto(opz)], attivo: 0 }
}
function formDaRichiesta(r, opz) {
  const base = singoloVuoto(opz)
  if (r.tipo_impatto === 'composta') {
    return { composta: true, descrizione: r.descrizione || '', componenti: (r.componenti || []).map(c => singoloDaRichiesta(c, base)), attivo: 0 }
  }
  return { composta: false, descrizione: r.descrizione || '', componenti: [singoloDaRichiesta(r, base)], attivo: 0 }
}
function costruisciRichiesta(F) {
  if (!F.composta) return costruisciDecisione(F.componenti[0])
  return { tipo_impatto: 'composta', descrizione: F.descrizione.trim(), componenti: F.componenti.map(costruisciDecisione) }
}
function validaForm(F) {
  if (!F.composta) return validaSingolo(F.componenti[0])
  if (!F.descrizione.trim()) return 'Inserisci la descrizione complessiva dell\'operazione.'
  for (let i = 0; i < F.componenti.length; i++) {
    const v = validaSingolo(F.componenti[i])
    if (v) return { messaggio: `Componente ${i + 1}: ${v}`, indice: i }
  }
  return null
}

// Estrae la busta {errore:{codice,messaggio,dettagli}} da un errore di functions.invoke
async function leggiErrore(error) {
  try {
    const j = await error.context.json()
    if (j?.errore) return j.errore
  } catch (_e) { /* non JSON */ }
  return { codice: 'ERRORE', messaggio: error?.message || 'Simulazione non riuscita.' }
}

// ── Piccoli elementi del modulo ──
const Campo = ({ label, children }) => (
  <div className="form-group"><label className="form-label">{label}</label>{children}</div>
)
const Num = ({ value, onChange, step = '0.01', min = '0' }) => (
  <input className="form-control" type="number" min={min} step={step} value={value} onChange={e => onChange(e.target.value)} />
)
const Scelta = ({ value, onChange, opzioni }) => (
  <select className="form-control" value={value} onChange={e => onChange(e.target.value)}>
    {Object.entries(opzioni).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
  </select>
)
const Data = ({ value, onChange, type = 'date' }) => (
  <input className="form-control" type={type} value={value} onChange={e => onChange(e.target.value)} />
)

export default function SimulazioneImpatto({ attoId, assicuraBozza, soloLettura, oggetto, valore, tipoAtto, onRiporta }) {
  const [sim, setSim] = useState(null)          // riga determina_simulazioni
  const [aperto, setAperto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)          // { codice, messaggio, dettagli? }
  const [form, setForm] = useState(null)
  const [vista, setVista] = useState('worst')   // scenario mostrato nell'esito

  const { azienda } = useApp()
  const impatti = impattiPerTipo(tipoAtto)

  const carica = useCallback(async () => {
    if (!attoId) { setSim(null); return }
    const { data } = await supabase.from('determina_simulazioni').select('*').eq('determina_id', attoId).maybeSingle()
    setSim(data || null)
  }, [attoId])
  useEffect(() => { carica() }, [carica])

  function apri() {
    const opz = { oggetto, valore, tipoAtto, impatti, azienda }
    setForm(sim?.richiesta?.tipo_impatto ? formDaRichiesta(sim.richiesta, opz) : formVuoto(opz))
    setErr(null); setAperto(true)
  }

  // Tutte le modifiche dell'editor agiscono sul componente attivo
  const modifica = (fn) => setForm(F => {
    const componenti = [...F.componenti]; componenti[F.attivo] = fn(componenti[F.attivo])
    return { ...F, componenti }
  })
  const setC = (k) => (v) => modifica(f => ({ ...f, [k]: v }))                                   // campo comune
  const setT = (k) => (v) => modifica(f => ({ ...f, [f.tipo_impatto]: { ...f[f.tipo_impatto], [k]: v } }))  // campo del tipo
  const setRiga = (lista, i, k) => (v) => modifica(f => {
    const t = f[f.tipo_impatto]; const righe = [...t[lista]]; righe[i] = { ...righe[i], [k]: v }
    return { ...f, [f.tipo_impatto]: { ...t, [lista]: righe } }
  })
  const aggiungiRiga = (lista, riga) => modifica(f => ({ ...f, [f.tipo_impatto]: { ...f[f.tipo_impatto], [lista]: [...f[f.tipo_impatto][lista], riga] } }))
  const togliRiga = (lista, i) => modifica(f => ({ ...f, [f.tipo_impatto]: { ...f[f.tipo_impatto], [lista]: f[f.tipo_impatto][lista].filter((_, j) => j !== i) } }))

  function impostaComposta(on) {
    setErr(null)
    setForm(F => on
      ? { ...F, composta: true, descrizione: F.componenti[F.attivo].descrizione }
      : { ...F, composta: false, componenti: [F.componenti[F.attivo]], attivo: 0 })
  }
  function aggiungiComponente() {
    setForm(F => F.componenti.length >= MAX_COMPONENTI ? F : {
      ...F, componenti: [...F.componenti, singoloVuoto({ oggetto: '', valore: '', tipoAtto, impatti, azienda })], attivo: F.componenti.length,
    })
  }
  function togliComponente(i) {
    setForm(F => {
      const componenti = F.componenti.filter((_, j) => j !== i)
      return { ...F, componenti, attivo: Math.min(F.attivo, componenti.length - 1) }
    })
  }

  async function esegui() {
    const v = validaForm(form)
    if (v) {
      if (typeof v === 'object') { setForm(F => ({ ...F, attivo: v.indice })); setErr({ codice: 'INPUT', messaggio: v.messaggio }) }
      else setErr({ codice: 'INPUT', messaggio: v })
      return
    }
    setBusy(true); setErr(null)
    const id = await assicuraBozza()
    if (!id) { setBusy(false); setAperto(false); return }
    const { data, error } = await supabase.functions.invoke('simulazione-impatto', {
      body: { determina_id: id, decisione: costruisciRichiesta(form) },
    })
    setBusy(false)
    if (error) { setErr(await leggiErrore(error)); return }
    setSim(data.simulazione)
    setAperto(false)
  }

  // Tipo di delibera senza meccaniche simulabili (es. procura, assunzione in attesa del tipo "personale")
  if (impatti.length === 0 && !sim) {
    return (
      <div style={{ border: '1px solid #E8ECF2', background: '#FAFAFA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: '#888' }}>
        📊 Simulazione d'impatto (EasyPMI): non ancora disponibile per questo tipo di atto.
      </div>
    )
  }

  const s = sim?.sintesi
  const nomiScenari = [['worst', 'Worst'], ['base', 'Base'], ['best', 'Best']]
  const dettaglio = s?.ipotesi_usate?.dettaglio_tipo
  const c = form?.componenti[form.attivo]      // operazione in modifica
  const t = c?.[c.tipo_impatto]

  return (
    <div style={{ border: '1px solid #D6E4F0', background: '#F7FAFD', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1A3A5C' }}>📊 Simulazione d'impatto (EasyPMI)</div>
          <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
            Applica la decisione alla proiezione di Tesoreria dell'azienda in EasyPMI. I due PDF finiscono nel fascicolo.
          </div>
        </div>
        {!soloLettura && impatti.length > 0 && (
          <button type="button" className="btn btn-sm btn-primary" onClick={apri}>
            {sim ? '↻ Rifai simulazione' : 'Simula impatto'}
          </button>
        )}
      </div>

      {s && (
        <div style={{ marginTop: 12, fontSize: 12.5 }}>
          <div style={{ fontSize: 11.5, color: '#777', marginBottom: 6 }}>
            Operazione simulata: <strong>{sim.richiesta?.tipo_impatto === 'composta'
              ? `composta da ${sim.richiesta.componenti?.length || 0} parti`
              : (TIPI_IMPATTO[sim.richiesta?.tipo_impatto] || sim.richiesta?.tipo_impatto)}</strong>
          </div>
          {s.confronto_baseline?.testo && (
            <div style={{ color: '#333', marginBottom: 10, lineHeight: 1.5 }}>{s.confronto_baseline.testo}</div>
          )}
          {(s.dettaglio_componenti || []).length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: 10 }}>
              <div style={{ fontWeight: 600, color: '#1A3A5C', marginBottom: 4 }}>Contributo di ciascun componente (scenario worst)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '5px 8px' }}>Componente</th>
                    <th style={{ textAlign: 'right', padding: '5px 8px' }}>Δ EBITDA</th>
                    <th style={{ textAlign: 'right', padding: '5px 8px' }}>Δ Utile</th>
                    <th style={{ textAlign: 'right', padding: '5px 8px' }}>Δ Cassa</th>
                  </tr>
                </thead>
                <tbody>
                  {s.dettaglio_componenti.map(k => (
                    <tr key={k.indice} style={{ borderTop: '1px solid #E8ECF2' }}>
                      <td style={{ padding: '5px 8px' }}>{k.indice}. {k.descrizione} <span style={{ color: '#999' }}>({(TIPI_IMPATTO[k.tipo_impatto] || k.tipo_impatto).split(' (')[0]})</span></td>
                      {[k.delta_ebitda_worst, k.delta_utile_worst, k.delta_cassa_finale_worst].map((d, j) => (
                        <td key={j} style={{ textAlign: 'right', padding: '5px 8px', color: coloreDelta(d) }}>{eurDelta(d)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!(s.dettaglio_componenti || []).length && dettaglio?.righe?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {dettaglio.titolo && <div style={{ fontWeight: 600, color: '#1A3A5C', marginBottom: 4 }}>{dettaglio.titolo}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2px 16px' }}>
                {dettaglio.righe.map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: '1px dotted #E0E6EE', padding: '2px 0' }}>
                    <span style={{ color: '#666' }}>{k}</span><span style={{ color: '#1A3A5C', textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(() => {
            // Prima/dopo la decisione: CE sui 12 mesi e cassa mese per mese.
            // Se i tre scenari coincidono (nessuna ipotesi di ricavi) se ne mostra uno solo.
            const firma = (sc) => JSON.stringify([s.scenari?.[sc]?.conto_economico?.utile, (s.scenari?.[sc]?.mesi || []).map(m => m?.cassa_scenario)])
            const distinti = firma('worst') !== firma('base') || firma('worst') !== firma('best')
            const sc = distinti ? vista : 'worst'
            const ce = s.scenari?.[sc]?.conto_economico || {}
            const mesi = (s.scenari?.[sc]?.mesi || []).filter(m => m && typeof m === 'object')
            const th = { textAlign: 'right', padding: '5px 8px' }, td = { textAlign: 'right', padding: '4px 8px' }
            const cassa = (v) => <span style={{ color: v < 0 ? '#C0392B' : undefined, fontWeight: v < 0 ? 600 : undefined }}>{eur(v)}</span>
            return (<>
              {distinti && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: '#777' }}>Scenario:</span>
                  {nomiScenari.map(([k, l]) => (
                    <button key={k} type="button" className={`btn btn-sm${k === sc ? ' btn-primary' : ''}`} onClick={() => setVista(k)}>{l}</button>
                  ))}
                  <span style={{ fontSize: 11, color: '#999' }}>Worst = solo effetti certi · Base = 50% dei ricavi ipotizzati · Best = 100%</span>
                </div>
              )}
              <div style={{ fontWeight: 600, color: '#1A3A5C', marginBottom: 4 }}>Conto economico sui 12 mesi della proiezione</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: 'left' }}></th>
                      <th style={th}>Senza la decisione</th><th style={th}>Con la decisione</th><th style={th}>Variazione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[['ebitda', 'EBITDA'], ['ebit', 'EBIT'], ['oneri_finanziari', 'Oneri finanziari'], ['utile', 'Utile ante imposte']].map(([k, l]) => {
                      const v = ce[k] || {}
                      const pct = v.baseline ? (v.delta / Math.abs(v.baseline)) * 100 : null
                      return (
                        <tr key={k} style={{ borderTop: '1px solid #E8ECF2' }}>
                          <td style={{ padding: '4px 8px' }}>{l}</td>
                          <td style={td}>{eur(v.baseline)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{eur(v.scenario)}</td>
                          <td style={{ ...td, color: coloreDelta(v.delta) }}>
                            {eurDelta(v.delta)}{pct != null && k !== 'oneri_finanziari' && v.delta ? <span style={{ color: '#999' }}> ({pct > 0 ? '+' : ''}{pct.toFixed(1).replace('.', ',')}%)</span> : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {mesi.length > 0 && (<>
                <div style={{ fontWeight: 600, color: '#1A3A5C', margin: '12px 0 4px' }}>Saldo di cassa mese per mese</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, textAlign: 'left' }}>Mese</th>
                        <th style={th}>Senza la decisione</th><th style={th}>Con la decisione</th><th style={th}>Differenza</th>
                        <th style={{ ...th, textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mesi.map((m, i) => {
                        const cambio = i > 0 ? m.delta_cassa - mesi[i - 1].delta_cassa : m.delta_cassa
                        return (
                          <tr key={m.mese} style={{ borderTop: '1px solid #E8ECF2', background: cambio ? '#FBFCFE' : undefined }}>
                            <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>{meseEsteso(m.mese)}</td>
                            <td style={td}>{cassa(m.cassa_baseline)}</td>
                            <td style={td}>{cassa(m.cassa_scenario)}</td>
                            <td style={{ ...td, color: coloreDelta(m.delta_cassa) }}>
                              {eurDelta(m.delta_cassa)}{cambio ? <span style={{ color: '#999' }}> ({eurDelta(cambio)} nel mese)</span> : null}
                            </td>
                            <td style={{ textAlign: 'center' }} title={m.buffer_minimo != null ? `Buffer minimo ${eur(m.buffer_minimo)}` : ''}>{SEMAFORO[m.semaforo_scenario] || ''}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {mesi[0]?.buffer_minimo != null && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                    Semaforo sul saldo con la decisione rispetto al buffer minimo di cassa ({eur(mesi[0].buffer_minimo)}).
                  </div>
                )}
              </>)}
              {!distinti && (
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Senza ipotesi di ricavi i tre scenari (worst, base, best) coincidono.</div>
              )}
            </>)
          })()}

          {(s.stress_test?.con_decisione || []).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600, color: '#1A3A5C', marginBottom: 4 }}>Stress test (scenario worst): senza → con la decisione</div>
              {s.stress_test.con_decisione.map((st, i) => {
                const base = (s.stress_test.baseline || []).find(b => b.scenario_nome === st.scenario_nome)
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                    <span style={{ flex: 1 }}>{st.scenario_nome}</span>
                    <span>{SEMAFORO[base?.semaforo] || '⚪'} → {SEMAFORO[st.semaforo] || '⚪'}</span>
                    {st.applicabile !== false && st.fabbisogno_max > 0 && <span style={{ color: '#777', minWidth: 130, textAlign: 'right' }}>fabbisogno {eur(st.fabbisogno_max)}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {s.range_storico_ricavi?.giudizio_testo && (
            <div style={{ marginTop: 10, color: s.range_storico_ricavi.giudizio_ipotesi_utente === 'oltre_massimo_storico' ? '#B9770E' : '#555' }}>
              📈 {s.range_storico_ricavi.giudizio_testo}
            </div>
          )}
          {[...(s.avvisi || []), ...(s.alert || [])].length > 0 && (
            <div className="alert" style={{ background: '#FEF9E7', color: '#856404', fontSize: 12, marginTop: 10, marginBottom: 0 }}>
              {[...(s.avvisi || []), ...(s.alert || [])].map((a, i) => (
                <div key={i}>⚠️ {typeof a === 'string' ? a : (a.messaggio || a.codice || JSON.stringify(a))}</div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#999', flex: 1 }}>
              Simulazione del {new Date(sim.created_at).toLocaleString('it-IT')} · PDF nel fascicolo (step Fascicolo)
            </span>
            {!soloLettura && onRiporta && s.confronto_baseline?.testo && (
              <button type="button" className="btn btn-sm" onClick={() => onRiporta(s.confronto_baseline.testo)}>
                Riporta nell'analisi finanziaria
              </button>
            )}
          </div>
        </div>
      )}

      {aperto && form && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !busy && setAperto(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div className="modal-title">Simulazione d'impatto</div>
              <button className="btn btn-sm" onClick={() => setAperto(false)} disabled={busy}>✕</button>
            </div>
            {err && (
              <div className="alert alert-error" style={{ fontSize: 12.5 }}>
                {err.messaggio}
                {Array.isArray(err.dettagli) && err.dettagli.map((d, i) => (
                  <div key={i} style={{ fontSize: 11.5, marginTop: 2 }}>• {d.campo ? `${d.campo}: ` : ''}{d.messaggio || String(d)}</div>
                ))}
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A3A5C', marginBottom: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.composta} onChange={e => impostaComposta(e.target.checked)} />
              <span>Operazione composta da più parti (es. bene in leasing + mutuo + manutenzione, max {MAX_COMPONENTI})</span>
            </label>
            {form.composta && (<>
              <Campo label="Descrizione complessiva">
                <input className="form-control" value={form.descrizione} onChange={e => setForm(F => ({ ...F, descrizione: e.target.value }))} />
              </Campo>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {form.componenti.map((k, i) => (
                  <button key={i} type="button" className={`btn btn-sm${i === form.attivo ? ' btn-primary' : ''}`}
                    onClick={() => setForm(F => ({ ...F, attivo: i }))}>
                    {i + 1}. {TIPI_IMPATTO[k.tipo_impatto].split(' (')[0]}
                  </button>
                ))}
                {form.componenti.length < MAX_COMPONENTI && <button type="button" className="btn btn-sm" onClick={aggiungiComponente}>+ Componente</button>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E8ECF2', paddingTop: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A3A5C' }}>Componente {form.attivo + 1}</span>
                {form.componenti.length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => togliComponente(form.attivo)}>Rimuovi componente</button>}
              </div>
            </>)}
            <Campo label="Tipo di operazione">
              <Scelta value={c.tipo_impatto} onChange={v => { setC('tipo_impatto')(v); setErr(null) }}
                opzioni={Object.fromEntries(impatti.map(k => [k, TIPI_IMPATTO[k]]))} />
            </Campo>
            <Campo label={form.composta ? 'Descrizione del componente' : 'Descrizione'}>
              <input className="form-control" value={c.descrizione} onChange={e => setC('descrizione')(e.target.value)} />
            </Campo>
            <div className="grid-2">
              <Campo label="Decorrenza"><Data value={c.data_decorrenza} onChange={setC('data_decorrenza')} /></Campo>
              {!SENZA_IVA.includes(c.tipo_impatto) && (
                <Campo label="Regime IVA">
                  <Scelta value={c.iva_regime} onChange={setC('iva_regime')}
                    opzioni={{ ordinaria: 'Ordinaria (aliquota EasyPMI)', esente: 'Esente', non_soggetta: 'Non soggetta' }} />
                </Campo>
              )}
            </div>

            {/* ── Leasing ── */}
            {c.tipo_impatto === 'leasing' && (<>
              <div className="grid-3">
                <Campo label="Valore bene (€, IVA escl.)"><Num value={t.imponibile} onChange={setT('imponibile')} /></Campo>
                <Campo label="Metodo contabile"><Scelta value={t.metodo} onChange={setT('metodo')} opzioni={{ patrimoniale: 'Patrimoniale', finanziario: 'Finanziario' }} /></Campo>
                <Campo label="Maxicanone (€)"><Num value={t.maxicanone} onChange={setT('maxicanone')} /></Campo>
              </div>
              <div className="grid-3">
                <Campo label="N. rate mensili"><Num value={t.numero_rate} onChange={setT('numero_rate')} step="1" min="1" /></Campo>
                <Campo label="Canone mensile (€, IVA escl.)"><Num value={t.canone} onChange={setT('canone')} /></Campo>
                <Campo label="Riscatto (€)"><Num value={t.riscatto} onChange={setT('riscatto')} /></Campo>
              </div>
              <div className="grid-3">
                <Campo label="Costi esercizio/mese (€)"><Num value={t.costi_esercizio} onChange={setT('costi_esercizio')} /></Campo>
                <Campo label={`Tasso annuo %${t.metodo === 'finanziario' ? '' : ' (facoltativo)'}`}><Num value={t.tasso} onChange={setT('tasso')} /></Campo>
                {t.metodo === 'finanziario' && <Campo label="Ammortamento (mesi)"><Num value={t.durata_ammortamento} onChange={setT('durata_ammortamento')} step="1" min="1" /></Campo>}
              </div>
            </>)}

            {/* ── Acquisto bene ── */}
            {c.tipo_impatto === 'acquisto_bene' && (<>
              <div className="grid-3">
                <Campo label="Valore bene (€, IVA escl.)"><Num value={t.imponibile} onChange={setT('imponibile')} /></Campo>
                <Campo label="Pagamento"><Scelta value={t.pag_modalita} onChange={setT('pag_modalita')} opzioni={{ unico: 'Unica soluzione', acconto_saldo: 'Acconto + saldo', rate: 'A rate' }} /></Campo>
                {t.pag_modalita === 'acconto_saldo' && <Campo label="Acconto %"><Num value={t.acconto_pct} onChange={setT('acconto_pct')} step="1" /></Campo>}
                {t.pag_modalita === 'rate' && <Campo label="N. rate"><Num value={t.numero_rate} onChange={setT('numero_rate')} step="1" min="1" /></Campo>}
              </div>
              {t.pag_modalita === 'rate' && (
                <div className="grid-3">
                  <Campo label="Periodicità rate"><Scelta value={t.periodicita} onChange={setT('periodicita')} opzioni={PERIODICITA} /></Campo>
                </div>
              )}
              <div className="grid-3">
                <Campo label="Ammortamento"><Scelta value={t.amm_tipo} onChange={setT('amm_tipo')} opzioni={{ durata: 'Durata in mesi', aliquota: 'Aliquota annua %' }} /></Campo>
                <Campo label={t.amm_tipo === 'aliquota' ? 'Aliquota annua %' : 'Durata (mesi)'}><Num value={t.amm_valore} onChange={setT('amm_valore')} step={t.amm_tipo === 'aliquota' ? '0.01' : '1'} /></Campo>
                <Campo label="Entrata in funzione (facolt.)"><Data value={t.data_entrata} onChange={setT('data_entrata')} /></Campo>
              </div>
              <div className="grid-3">
                <Campo label="Costi esercizio/mese (€)"><Num value={t.costi_esercizio} onChange={setT('costi_esercizio')} /></Campo>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1A3A5C', margin: '4px 0 6px' }}>Contributi e crediti d'imposta (facoltativi)</div>
              {t.contributi.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.3fr auto', gap: 6, marginBottom: 6 }}>
                  <input className="form-control" placeholder="Descrizione" value={c.descrizione} onChange={e => setRiga('contributi', i, 'descrizione')(e.target.value)} />
                  <Num value={c.importo} onChange={setRiga('contributi', i, 'importo')} />
                  <Data value={c.data_incasso} onChange={setRiga('contributi', i, 'data_incasso')} />
                  <Scelta value={c.natura} onChange={setRiga('contributi', i, 'natura')} opzioni={{ credito_imposta: "Credito d'imposta", contributo_conto_impianti: 'C/impianti', contributo_conto_esercizio: 'C/esercizio' }} />
                  <button type="button" className="btn btn-sm" onClick={() => togliRiga('contributi', i)}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" onClick={() => aggiungiRiga('contributi', { descrizione: '', importo: '', data_incasso: '', natura: 'credito_imposta' })}>+ Contributo</button>
              {t.contributi.length > 0 && <div style={{ fontSize: 11.5, color: '#999', marginTop: 4 }}>EasyPMI considera i contributi solo in cassa, alla data di incasso.</div>}
            </>)}

            {/* ── Finanziamento ── */}
            {c.tipo_impatto === 'finanziamento' && (<>
              <div className="grid-3">
                <Campo label="Importo (€)"><Num value={t.importo} onChange={setT('importo')} /></Campo>
                <Campo label="Erogazione (default decorrenza)"><Data value={t.data_erogazione} onChange={setT('data_erogazione')} /></Campo>
                <Campo label="Tasso annuo %"><Num value={t.tasso} onChange={setT('tasso')} /></Campo>
              </div>
              <div className="grid-3">
                <Campo label="N. rate"><Num value={t.numero_rate} onChange={setT('numero_rate')} step="1" min="1" /></Campo>
                <Campo label="Periodicità"><Scelta value={t.periodicita} onChange={setT('periodicita')} opzioni={PERIODICITA} /></Campo>
                <Campo label="Piano"><Scelta value={t.piano} onChange={setT('piano')} opzioni={{ francese: 'Francese (rata costante)', italiano: 'Italiano (capitale costante)', bullet: 'Bullet (capitale a scadenza)' }} /></Campo>
              </div>
              <div className="grid-3">
                <Campo label="Preammortamento (mesi)"><Num value={t.preammortamento_mesi} onChange={setT('preammortamento_mesi')} step="1" /></Campo>
                <Campo label="Spese istruttoria (€)"><Num value={t.spese_istruttoria} onChange={setT('spese_istruttoria')} /></Campo>
              </div>
            </>)}

            {/* ── Costo ricorrente ── */}
            {c.tipo_impatto === 'costo_ricorrente' && (<>
              <div className="grid-3">
                <Campo label="Categoria"><Scelta value={t.categoria} onChange={setT('categoria')} opzioni={CATEGORIE_RICORRENTE} /></Campo>
                <Campo label="Importo per periodo (€, IVA escl.)"><Num value={t.importo_periodico} onChange={setT('importo_periodico')} /></Campo>
                <Campo label="Fatturazione"><Scelta value={t.periodicita_fatturazione} onChange={setT('periodicita_fatturazione')} opzioni={{ ...PERIODICITA, annuale: 'Annuale' }} /></Campo>
              </div>
              <div className="grid-3">
                <Campo label="Durata (mesi)"><Num value={t.durata_mesi} onChange={setT('durata_mesi')} step="1" min="1" /></Campo>
                <Campo label="Indicizzazione annua %"><Num value={t.indicizzazione} onChange={setT('indicizzazione')} /></Campo>
                <Campo label="Pagamento"><Scelta value={t.pagamento_anticipato ? 's' : 'n'} onChange={v => setT('pagamento_anticipato')(v === 's')} opzioni={{ n: 'Posticipato', s: 'Anticipato' }} /></Campo>
              </div>
              <div className="grid-3">
                <Campo label="Costo attivazione (€)"><Num value={t.una_tantum_iniziale} onChange={setT('una_tantum_iniziale')} /></Campo>
                <Campo label="Deposito cauzionale (€)"><Num value={t.deposito_cauzionale} onChange={setT('deposito_cauzionale')} /></Campo>
              </div>
              <div className="grid-3">
                <Campo label="Success fee (€, facolt.)"><Num value={t.fee_importo} onChange={setT('fee_importo')} /></Campo>
                {pieno(t.fee_importo) && <Campo label="Data prevista fee"><Data value={t.fee_data} onChange={setT('fee_data')} /></Campo>}
              </div>
            </>)}

            {/* ── Costo una tantum ── */}
            {c.tipo_impatto === 'costo_una_tantum' && (<>
              <div className="grid-2">
                <Campo label="Categoria"><Scelta value={t.categoria} onChange={setT('categoria')} opzioni={CATEGORIE_UNA_TANTUM} /></Campo>
                <Campo label="Importo (€, IVA escl.)"><Num value={t.importo} onChange={setT('importo')} /></Campo>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1A3A5C', margin: '4px 0 6px' }}>Piano dei pagamenti (facoltativo: senza, tutto alla decorrenza)</div>
              {t.piano.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginBottom: 6 }}>
                  <Data value={p.data} onChange={setRiga('piano', i, 'data')} />
                  <Num value={p.importo} onChange={setRiga('piano', i, 'importo')} />
                  <button type="button" className="btn btn-sm" onClick={() => togliRiga('piano', i)}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" onClick={() => aggiungiRiga('piano', { data: '', importo: '' })}>+ Pagamento</button>
            </>)}

            {/* ── Personale ── */}
            {c.tipo_impatto === 'personale' && (<>
              <div className="grid-3">
                <Campo label="Movimento"><Scelta value={t.movimento} onChange={setT('movimento')} opzioni={{ ingresso: 'Assunzione (ingresso)', uscita: 'Uscita' }} /></Campo>
                <Campo label="N. persone"><Num value={t.numero_persone} onChange={setT('numero_persone')} step="1" min="1" /></Campo>
                <Campo label="Inquadramento"><Scelta value={t.inquadramento} onChange={setT('inquadramento')} opzioni={INQUADRAMENTI} /></Campo>
              </div>
              <div className="grid-3">
                <Campo label="RAL annua per persona (€)"><Num value={t.ral_annua} onChange={setT('ral_annua')} /></Campo>
                <Campo label="Mensilità"><Scelta value={String(t.mensilita)} onChange={setT('mensilita')} opzioni={{ 13: '13', 14: '14' }} /></Campo>
                <Campo label="Contributi azienda % (INPS+INAIL)"><Num value={t.contributi_pct} onChange={setT('contributi_pct')} /></Campo>
              </div>
              {!datiLavoro(azienda).completi && (
                <div style={{ fontSize: 11.5, color: '#B9770E', marginTop: -6, marginBottom: 8 }}>
                  Aliquota INPS e/o tasso INAIL dell'azienda non compilati in Impostazioni → Dettagli azienda: inserisci qui l'aliquota complessiva dal cedolino.
                </div>
              )}
              <div className="grid-3">
                {t.movimento === 'ingresso'
                  ? <Campo label="Durata mesi (vuoto = indeterminato)"><Num value={t.durata_mesi} onChange={setT('durata_mesi')} step="1" min="1" /></Campo>
                  : <Campo label="Incentivo all'esodo (€, totale)"><Num value={t.incentivo_esodo} onChange={setT('incentivo_esodo')} /></Campo>}
                <Campo label="Benefit annui per persona (€)"><Num value={t.benefit_annui} onChange={setT('benefit_annui')} /></Campo>
              </div>
              <div className="grid-3">
                <Campo label="Bonus annuo per persona (€, facolt.)"><Num value={t.bonus_importo} onChange={setT('bonus_importo')} /></Campo>
                {pieno(t.bonus_importo) && <Campo label="Mese pagamento bonus"><Data type="month" value={t.bonus_mese} onChange={setT('bonus_mese')} /></Campo>}
              </div>
              <div className="grid-3">
                <Campo label="Sgravio (% dei contributi, 100 = esonero)"><Num value={t.sgravio_pct} onChange={setT('sgravio_pct')} /></Campo>
                {pieno(t.sgravio_pct) && <Campo label="Durata sgravio (mesi)"><Num value={t.sgravio_mesi} onChange={setT('sgravio_mesi')} step="1" min="1" /></Campo>}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1A3A5C', margin: '4px 0 6px' }}>Costi una tantum (selezione, formazione… importo totale)</div>
              {t.costi_una_tantum.map((k, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 6, marginBottom: 6 }}>
                  <input className="form-control" placeholder="Descrizione" value={k.descrizione} onChange={e => setRiga('costi_una_tantum', i, 'descrizione')(e.target.value)} />
                  <Num value={k.importo} onChange={setRiga('costi_una_tantum', i, 'importo')} />
                  <button type="button" className="btn btn-sm" onClick={() => togliRiga('costi_una_tantum', i)}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" onClick={() => aggiungiRiga('costi_una_tantum', { descrizione: '', importo: '' })}>+ Costo una tantum</button>
              {t.movimento === 'uscita' && <div style={{ fontSize: 11.5, color: '#999', marginTop: 6 }}>Il TFR già maturato da liquidare all'uscita non è incluso nella simulazione.</div>}
            </>)}

            {/* ── Ipotesi di ricavi: comune a tutti i tipi (worst 0% · base 50% · best 100%) ── */}
            <div className="grid-3" style={{ marginTop: 6 }}>
              <Campo label="Ricavi attesi (facolt.)">
                <Scelta value={c.ricavi_modalita} onChange={setC('ricavi_modalita')} opzioni={{ '': 'Nessuna ipotesi', incremento_pct: 'Incremento % ricavi', euro_mese: '€ in più al mese' }} />
              </Campo>
              {c.ricavi_modalita && (<>
                <Campo label={c.ricavi_modalita === 'incremento_pct' ? 'Incremento %' : '€ / mese'}><Num value={c.ricavi_valore} onChange={setC('ricavi_valore')} /></Campo>
                <Campo label="Dal mese"><Data type="month" value={c.ricavi_mese} onChange={setC('ricavi_mese')} /></Campo>
              </>)}
            </div>

            {sim && <div style={{ fontSize: 12, color: '#999', marginTop: 10 }}>La nuova simulazione sostituirà quella attuale (PDF compresi).</div>}
            <div className="modal-footer">
              <button className="btn" onClick={() => setAperto(false)} disabled={busy}>Annulla</button>
              <button className="btn btn-primary" onClick={esegui} disabled={busy}>{busy ? 'Simulazione in corso…' : 'Simula'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
