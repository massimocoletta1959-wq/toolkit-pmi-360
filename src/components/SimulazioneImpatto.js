import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ============================================================
// Simulazione d'impatto EasyPMI (contratto v7) nello step Analisi.
// La chiamata passa dalla Edge Function `simulazione-impatto`, che
// ri-ospita i due PDF nel fascicolo e salva la sintesi in
// `determina_simulazioni`. Oggi EasyPMI supporta solo il leasing.
// Una nuova simulazione sostituisce la precedente.
// ============================================================

export const VOCE_SIMULAZIONE = "Simulazione d'impatto (EasyPMI)"

const eur = (n) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 }) + ' €'
const eurDelta = (n) => (n == null || isNaN(n)) ? '—' : (n > 0 ? '+' : '') + eur(n)
const coloreDelta = (n) => n > 0 ? '#1E8449' : n < 0 ? '#C0392B' : '#666'
const SEMAFORO = { verde: '🟢', giallo: '🟡', rosso: '🔴', nd: '⚪' }

function primoDelMeseProssimo() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Costruisce la `decisione` con i soli campi ammessi dallo schema rigido di EasyPMI
function costruisciDecisione(f) {
  const num = (v) => Number(String(v).replace(',', '.'))
  const leasing = {
    metodo_contabile: f.metodo,
    maxicanone: num(f.maxicanone || 0),
    numero_rate: parseInt(f.numero_rate, 10),
    periodicita: 'mensile',
    riscatto: num(f.riscatto || 0),
    canone: num(f.canone),
  }
  if (f.tasso !== '') leasing.tasso_annuo_pct = num(f.tasso)
  const decisione = {
    tipo_impatto: 'leasing',
    descrizione: f.descrizione.trim(),
    data_decorrenza: f.data_decorrenza,
    imponibile: num(f.imponibile),
    iva_pct: num(f.iva_pct || 22),
    leasing,
    costi_esercizio_mensili: num(f.costi_esercizio || 0),
  }
  if (f.metodo === 'finanziario') decisione.ammortamento = { durata_mesi: parseInt(f.durata_ammortamento, 10) }
  if (f.ricavi_modalita) {
    decisione.ipotesi_ricavi = { modalita: f.ricavi_modalita, valore: num(f.ricavi_valore), mese_partenza: `${f.ricavi_mese}-01` }
  }
  return decisione
}

function validaForm(f) {
  if (!f.descrizione.trim()) return 'Inserisci una descrizione.'
  if (!f.data_decorrenza) return 'Inserisci la data di decorrenza.'
  if (!(Number(f.imponibile) > 0)) return 'Inserisci il valore del bene (imponibile, IVA esclusa).'
  if (!(parseInt(f.numero_rate, 10) > 0)) return 'Inserisci il numero di rate.'
  if (!(Number(f.canone) > 0)) return 'Inserisci il canone mensile (IVA esclusa).'
  if (f.metodo === 'finanziario' && (f.tasso === '' || !(parseInt(f.durata_ammortamento, 10) > 0)))
    return 'Con il metodo finanziario servono tasso annuo e durata dell\'ammortamento.'
  if (f.ricavi_modalita) {
    if (!(Number(f.ricavi_valore) > 0) || !f.ricavi_mese) return 'Completa l\'ipotesi di ricavi (valore e mese di partenza) o rimuovila.'
    if (f.ricavi_mese < f.data_decorrenza.slice(0, 7)) return 'I ricavi ipotizzati non possono partire prima del mese di decorrenza.'
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

export default function SimulazioneImpatto({ attoId, assicuraBozza, soloLettura, oggetto, valore, onRiporta }) {
  const [sim, setSim] = useState(null)          // riga determina_simulazioni
  const [aperto, setAperto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)          // { codice, messaggio, dettagli? }
  const [form, setForm] = useState(null)

  const carica = useCallback(async () => {
    if (!attoId) { setSim(null); return }
    const { data } = await supabase.from('determina_simulazioni').select('*').eq('determina_id', attoId).maybeSingle()
    setSim(data || null)
  }, [attoId])
  useEffect(() => { carica() }, [carica])

  function apri() {
    const r = sim?.richiesta
    setForm(r ? {
      descrizione: r.descrizione || '', data_decorrenza: r.data_decorrenza || '', imponibile: r.imponibile ?? '',
      iva_pct: r.iva_pct ?? 22, metodo: r.leasing?.metodo_contabile || 'patrimoniale',
      maxicanone: r.leasing?.maxicanone ?? 0, numero_rate: r.leasing?.numero_rate ?? 60, riscatto: r.leasing?.riscatto ?? 0,
      canone: r.leasing?.canone ?? '', tasso: r.leasing?.tasso_annuo_pct ?? '', durata_ammortamento: r.ammortamento?.durata_mesi ?? '',
      costi_esercizio: r.costi_esercizio_mensili ?? 0,
      ricavi_modalita: r.ipotesi_ricavi?.modalita || '', ricavi_valore: r.ipotesi_ricavi?.valore ?? '',
      ricavi_mese: (r.ipotesi_ricavi?.mese_partenza || '').slice(0, 7),
    } : {
      descrizione: oggetto || '', data_decorrenza: primoDelMeseProssimo(), imponibile: valore || '', iva_pct: 22,
      metodo: 'patrimoniale', maxicanone: 0, numero_rate: 60, riscatto: 0, canone: '', tasso: '', durata_ammortamento: '',
      costi_esercizio: 0, ricavi_modalita: '', ricavi_valore: '', ricavi_mese: '',
    })
    setErr(null); setAperto(true)
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

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

  const s = sim?.sintesi
  const nomiScenari = [['worst', 'Worst'], ['base', 'Base'], ['best', 'Best']]

  return (
    <div style={{ border: '1px solid #D6E4F0', background: '#F7FAFD', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1A3A5C' }}>📊 Simulazione d'impatto (EasyPMI)</div>
          <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
            Applica la decisione (leasing) alla proiezione di Tesoreria dell'azienda in EasyPMI. I due PDF finiscono nel fascicolo.
          </div>
        </div>
        {!soloLettura && (
          <button type="button" className="btn btn-sm btn-primary" onClick={apri}>
            {sim ? '↻ Rifai simulazione' : 'Simula impatto'}
          </button>
        )}
      </div>

      {s && (
        <div style={{ marginTop: 12, fontSize: 12.5 }}>
          {s.confronto_baseline?.testo && (
            <div style={{ color: '#333', marginBottom: 10, lineHeight: 1.5 }}>{s.confronto_baseline.testo}</div>
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
              {s.stress_test.con_decisione.map((t, i) => {
                const base = (s.stress_test.baseline || []).find(b => b.scenario_nome === t.scenario_nome)
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                    <span style={{ flex: 1 }}>{t.scenario_nome}</span>
                    <span>{SEMAFORO[base?.semaforo] || '⚪'} → {SEMAFORO[t.semaforo] || '⚪'}</span>
                    {t.applicabile !== false && t.fabbisogno_max > 0 && <span style={{ color: '#777', minWidth: 130, textAlign: 'right' }}>fabbisogno {eur(t.fabbisogno_max)}</span>}
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
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div className="modal-title">Simulazione d'impatto — leasing</div>
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
            <div className="form-group">
              <label className="form-label">Descrizione</label>
              <input className="form-control" value={form.descrizione} onChange={set('descrizione')} placeholder="es. Acquisto macchinario X in leasing" />
            </div>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Decorrenza</label>
                <input className="form-control" type="date" value={form.data_decorrenza} onChange={set('data_decorrenza')} />
              </div>
              <div className="form-group">
                <label className="form-label">Valore bene (€, IVA escl.)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.imponibile} onChange={set('imponibile')} />
              </div>
              <div className="form-group">
                <label className="form-label">IVA %</label>
                <input className="form-control" type="number" min="0" step="1" value={form.iva_pct} onChange={set('iva_pct')} />
              </div>
            </div>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Metodo contabile</label>
                <select className="form-control" value={form.metodo} onChange={set('metodo')}>
                  <option value="patrimoniale">Patrimoniale</option>
                  <option value="finanziario">Finanziario</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Maxicanone (€)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.maxicanone} onChange={set('maxicanone')} />
              </div>
              <div className="form-group">
                <label className="form-label">N. rate mensili</label>
                <input className="form-control" type="number" min="1" step="1" value={form.numero_rate} onChange={set('numero_rate')} />
              </div>
            </div>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Canone mensile (€, IVA escl.)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.canone} onChange={set('canone')} />
              </div>
              <div className="form-group">
                <label className="form-label">Riscatto (€)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.riscatto} onChange={set('riscatto')} />
              </div>
              <div className="form-group">
                <label className="form-label">Costi esercizio/mese (€)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.costi_esercizio} onChange={set('costi_esercizio')} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Tasso annuo %{form.metodo === 'finanziario' ? '' : ' (facoltativo)'}</label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.tasso} onChange={set('tasso')} />
              </div>
              {form.metodo === 'finanziario' && (
                <div className="form-group">
                  <label className="form-label">Durata ammortamento (mesi)</label>
                  <input className="form-control" type="number" min="1" step="1" value={form.durata_ammortamento} onChange={set('durata_ammortamento')} />
                </div>
              )}
            </div>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Ipotesi ricavi</label>
                <select className="form-control" value={form.ricavi_modalita} onChange={set('ricavi_modalita')}>
                  <option value="">Nessuna</option>
                  <option value="incremento_pct">Incremento % ricavi</option>
                  <option value="euro_mese">€ in più al mese</option>
                </select>
              </div>
              {form.ricavi_modalita && (
                <>
                  <div className="form-group">
                    <label className="form-label">{form.ricavi_modalita === 'incremento_pct' ? 'Incremento %' : '€ / mese'}</label>
                    <input className="form-control" type="number" min="0" step="0.01" value={form.ricavi_valore} onChange={set('ricavi_valore')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dal mese</label>
                    <input className="form-control" type="month" value={form.ricavi_mese} onChange={set('ricavi_mese')} />
                  </div>
                </>
              )}
            </div>
            {sim && <div style={{ fontSize: 12, color: '#999' }}>La nuova simulazione sostituirà quella attuale (PDF compresi).</div>}
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
