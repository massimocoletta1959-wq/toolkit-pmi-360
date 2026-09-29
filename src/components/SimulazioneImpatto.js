import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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
}
const TUTTI = Object.keys(TIPI_IMPATTO)

// Tipo di delibera → tipi d'impatto coerenti. Tipi assenti (personalizzati,
// urgenza, adempimenti contabili) → tutti; lista vuota → nessuna simulazione.
const IMPATTI_PER_TIPO = {
  beni_strumentali:       ['acquisto_bene', 'leasing', 'finanziamento'],
  contratto:              ['costo_ricorrente', 'costo_una_tantum'],
  operazione_finanziaria: ['finanziamento', 'leasing'],
  personale:              ['costo_una_tantum', 'costo_ricorrente'],
  assunzione:             [],   // tipo "personale" in attesa lato EasyPMI
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
const PERIODICITA = { mensile: 'Mensile', trimestrale: 'Trimestrale', semestrale: 'Semestrale' }

const eur = (n) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 }) + ' €'
const eurDelta = (n) => (n == null || isNaN(n)) ? '—' : (n > 0 ? '+' : '') + eur(n)
const coloreDelta = (n) => n > 0 ? '#1E8449' : n < 0 ? '#C0392B' : '#666'
const SEMAFORO = { verde: '🟢', giallo: '🟡', rosso: '🔴', nd: '⚪' }
const num = (v) => Number(String(v ?? '').replace(',', '.'))
const intero = (v) => parseInt(v, 10)
const pieno = (v) => v !== '' && v != null

function primoDelMeseProssimo() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Stato del modulo: campi comuni + un blocco per tipo (si passa da un tipo
// all'altro senza perdere quanto già compilato)
function formVuoto({ oggetto, valore, tipoAtto, impatti }) {
  return {
    tipo_impatto: impatti[0] || 'leasing',
    descrizione: oggetto || '', data_decorrenza: primoDelMeseProssimo(), iva_regime: 'ordinaria',
    ricavi_modalita: '', ricavi_valore: '', ricavi_mese: '',   // ipotesi_ricavi: campo comune a tutti i tipi
    leasing: { metodo: 'patrimoniale', imponibile: valore || '', maxicanone: 0, numero_rate: 60, riscatto: 0, canone: '', tasso: '', durata_ammortamento: '', costi_esercizio: 0 },
    acquisto_bene: { imponibile: valore || '', pag_modalita: 'unico', acconto_pct: 30, numero_rate: 12, periodicita: 'mensile', amm_tipo: 'durata', amm_valore: 60, data_entrata: '', costi_esercizio: 0, contributi: [] },
    finanziamento: { importo: valore || '', data_erogazione: '', tasso: '', numero_rate: 60, periodicita: 'mensile', piano: 'francese', preammortamento_mesi: 0, spese_istruttoria: 0 },
    costo_ricorrente: { categoria: RICORRENTE_DEFAULT[tipoAtto] || 'servizi', importo_periodico: '', periodicita_fatturazione: 'mensile', pagamento_anticipato: false, durata_mesi: 12, indicizzazione: 0, una_tantum_iniziale: 0, deposito_cauzionale: 0, fee_importo: '', fee_data: '' },
    costo_una_tantum: { categoria: CATEGORIA_DEFAULT[tipoAtto] || 'altro', importo: valore || '', piano: [] },
  }
}

// Ricostruisce il modulo dalla richiesta salvata (per "Rifai simulazione")
function formDaRichiesta(r, base) {
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
  }
  return f
}

// Costruisce la `decisione` con i soli campi ammessi dallo schema rigido di EasyPMI
function costruisciDecisione(f) {
  const d = { tipo_impatto: f.tipo_impatto, descrizione: f.descrizione.trim(), data_decorrenza: f.data_decorrenza }
  if (f.iva_regime !== 'ordinaria' && f.tipo_impatto !== 'finanziamento') d.iva_regime = f.iva_regime

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
  }
  if (f.ricavi_modalita) d.ipotesi_ricavi = { modalita: f.ricavi_modalita, valore: num(f.ricavi_valore), mese_partenza: `${f.ricavi_mese}-01` }
  return d
}

function validaForm(f) {
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

  const impatti = impattiPerTipo(tipoAtto)

  const carica = useCallback(async () => {
    if (!attoId) { setSim(null); return }
    const { data } = await supabase.from('determina_simulazioni').select('*').eq('determina_id', attoId).maybeSingle()
    setSim(data || null)
  }, [attoId])
  useEffect(() => { carica() }, [carica])

  function apri() {
    const base = formVuoto({ oggetto, valore, tipoAtto, impatti })
    setForm(sim?.richiesta?.tipo_impatto ? formDaRichiesta(sim.richiesta, base) : base)
    setErr(null); setAperto(true)
  }

  const setC = (k) => (v) => setForm(f => ({ ...f, [k]: v }))                                   // campo comune
  const setT = (k) => (v) => setForm(f => ({ ...f, [f.tipo_impatto]: { ...f[f.tipo_impatto], [k]: v } }))  // campo del tipo
  const setRiga = (lista, i, k) => (v) => setForm(f => {
    const t = f[f.tipo_impatto]; const righe = [...t[lista]]; righe[i] = { ...righe[i], [k]: v }
    return { ...f, [f.tipo_impatto]: { ...t, [lista]: righe } }
  })
  const aggiungiRiga = (lista, riga) => setForm(f => ({ ...f, [f.tipo_impatto]: { ...f[f.tipo_impatto], [lista]: [...f[f.tipo_impatto][lista], riga] } }))
  const togliRiga = (lista, i) => setForm(f => ({ ...f, [f.tipo_impatto]: { ...f[f.tipo_impatto], [lista]: f[f.tipo_impatto][lista].filter((_, j) => j !== i) } }))

  async function esegui() {
    const v = validaForm(form)
    if (v) { setErr({ codice: 'INPUT', messaggio: v }); return }
    setBusy(true); setErr(null)
    const id = await assicuraBozza()
    if (!id) { setBusy(false); setAperto(false); return }
    const { data, error } = await supabase.functions.invoke('simulazione-impatto', {
      body: { determina_id: id, decisione: costruisciDecisione(form) },
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
  const t = form?.[form?.tipo_impatto]

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
            Operazione simulata: <strong>{TIPI_IMPATTO[sim.richiesta?.tipo_impatto] || sim.richiesta?.tipo_impatto}</strong>
          </div>
          {s.confronto_baseline?.testo && (
            <div style={{ color: '#333', marginBottom: 10, lineHeight: 1.5 }}>{s.confronto_baseline.testo}</div>
          )}
          {dettaglio?.righe?.length > 0 && (
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#EAF1F8', color: '#1A3A5C' }}>
                  <th style={{ textAlign: 'left', padding: '5px 8px' }}>Δ sui 12 mesi</th>
                  {nomiScenari.map(([k, l]) => <th key={k} style={{ textAlign: 'right', padding: '5px 8px' }}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {[['ebitda', 'EBITDA'], ['ebit', 'EBIT'], ['oneri_finanziari', 'Oneri finanziari'], ['utile', 'Utile ante imposte']].map(([k, l]) => (
                  <tr key={k} style={{ borderTop: '1px solid #E8ECF2' }}>
                    <td style={{ padding: '5px 8px' }}>{l}</td>
                    {nomiScenari.map(([sc]) => {
                      const d = s.scenari?.[sc]?.conto_economico?.[k]?.delta
                      return <td key={sc} style={{ textAlign: 'right', padding: '5px 8px', color: coloreDelta(d) }}>{eurDelta(d)}</td>
                    })}
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid #E8ECF2' }}>
                  <td style={{ padding: '5px 8px' }}>Cassa a fine finestra</td>
                  {nomiScenari.map(([sc]) => {
                    const mesi = (s.scenari?.[sc]?.mesi || []).filter(m => m && typeof m === 'object')
                    const d = mesi.length ? mesi[mesi.length - 1].delta_cassa : null
                    return <td key={sc} style={{ textAlign: 'right', padding: '5px 8px', color: coloreDelta(d) }}>{eurDelta(d)}</td>
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            Worst = solo effetti certi · Base = 50% dei ricavi ipotizzati · Best = 100%.
          </div>

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

            <Campo label="Tipo di operazione">
              <Scelta value={form.tipo_impatto} onChange={v => { setC('tipo_impatto')(v); setErr(null) }}
                opzioni={Object.fromEntries(impatti.map(k => [k, TIPI_IMPATTO[k]]))} />
            </Campo>
            <Campo label="Descrizione">
              <input className="form-control" value={form.descrizione} onChange={e => setC('descrizione')(e.target.value)} />
            </Campo>
            <div className="grid-2">
              <Campo label="Decorrenza"><Data value={form.data_decorrenza} onChange={setC('data_decorrenza')} /></Campo>
              {form.tipo_impatto !== 'finanziamento' && (
                <Campo label="Regime IVA">
                  <Scelta value={form.iva_regime} onChange={setC('iva_regime')}
                    opzioni={{ ordinaria: 'Ordinaria (aliquota EasyPMI)', esente: 'Esente', non_soggetta: 'Non soggetta' }} />
                </Campo>
              )}
            </div>

            {/* ── Leasing ── */}
            {form.tipo_impatto === 'leasing' && (<>
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
            {form.tipo_impatto === 'acquisto_bene' && (<>
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
            {form.tipo_impatto === 'finanziamento' && (<>
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
            {form.tipo_impatto === 'costo_ricorrente' && (<>
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
            {form.tipo_impatto === 'costo_una_tantum' && (<>
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

            {/* ── Ipotesi di ricavi: comune a tutti i tipi (worst 0% · base 50% · best 100%) ── */}
            <div className="grid-3" style={{ marginTop: 6 }}>
              <Campo label="Ricavi attesi (facolt.)">
                <Scelta value={form.ricavi_modalita} onChange={setC('ricavi_modalita')} opzioni={{ '': 'Nessuna ipotesi', incremento_pct: 'Incremento % ricavi', euro_mese: '€ in più al mese' }} />
              </Campo>
              {form.ricavi_modalita && (<>
                <Campo label={form.ricavi_modalita === 'incremento_pct' ? 'Incremento %' : '€ / mese'}><Num value={form.ricavi_valore} onChange={setC('ricavi_valore')} /></Campo>
                <Campo label="Dal mese"><Data type="month" value={form.ricavi_mese} onChange={setC('ricavi_mese')} /></Campo>
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
