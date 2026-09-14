import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { CATEGORIE, CATALOGO, PROB_OPTIONS, IMP_OPTIONS, FONTE_OPTIONS, getTier, CAT_COLORS } from '../lib/constants'

function TierBadge({ p, i }) {
  if (!p || !i) return <span style={{ color: '#aaa', fontSize: 12 }}>—</span>
  const t = getTier(p, i)
  return <span className="badge" style={{ background: t.bg, color: t.color }}>{t.tier} — {t.label}</span>
}

function RischioModal({ rischio, aziendaId, onSave, onClose }) {
  const editing = !!rischio?.id
  const [form, setForm] = useState({
    categoria: rischio?.categoria || '',
    descrizione: rischio?.descrizione || '',
    fonte: rischio?.fonte || '',
    probabilita: rischio?.probabilita || '',
    impatto: rischio?.impatto || '',
    note: rischio?.note || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.categoria || !form.descrizione) { setError('Categoria e descrizione sono obbligatori'); return }
    setLoading(true); setError(null)
    const payload = { ...form, probabilita: form.probabilita || null, impatto: form.impatto || null, azienda_id: aziendaId }
    const { error: err } = editing
      ? await supabase.from('rischi').update(payload).eq('id', rischio.id)
      : await supabase.from('rischi').insert(payload)
    if (err) { setError(err.message); setLoading(false); return }
    onSave()
  }

  const catalogo = form.categoria ? (CATALOGO[form.categoria] || []) : []

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{editing ? 'Modifica rischio' : 'Aggiungi rischio'}</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label className="form-label">Categoria *</label>
          <select className="form-control" value={form.categoria} onChange={e => { set('categoria', e.target.value); set('descrizione', '') }}>
            <option value="">Seleziona categoria...</option>
            {CATEGORIE.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Descrizione *</label>
          {catalogo.length > 0 ? (
            <select className="form-control" value={form.descrizione} onChange={e => set('descrizione', e.target.value)}>
              <option value="">Seleziona dal catalogo o scrivi sotto...</option>
              {catalogo.map(d => <option key={d}>{d}</option>)}
              <option value="__custom">— Scrivi descrizione personalizzata</option>
            </select>
          ) : null}
          {(form.descrizione === '__custom' || !catalogo.length || (form.descrizione && !catalogo.includes(form.descrizione))) && (
            <input className="form-control" style={{ marginTop: 6 }} value={form.descrizione === '__custom' ? '' : form.descrizione}
              onChange={e => set('descrizione', e.target.value)} placeholder="Descrivi il rischio specifico..." />
          )}
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Fonte</label>
            <select className="form-control" value={form.fonte} onChange={e => set('fonte', e.target.value)}>
              <option value="">Seleziona...</option>
              {FONTE_OPTIONS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Punteggio</label>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, paddingTop: 4 }}>
              {form.probabilita && form.impatto ? <TierBadge p={+form.probabilita} i={+form.impatto} /> : <span style={{ color: '#aaa', fontSize: 12 }}>Compila P e I</span>}
            </div>
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Probabilità</label>
            <select className="form-control" value={form.probabilita} onChange={e => set('probabilita', e.target.value)}>
              <option value="">Seleziona...</option>
              {PROB_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Impatto</label>
            <select className="form-control" value={form.impatto} onChange={e => set('impatto', e.target.value)}>
              <option value="">Seleziona...</option>
              {IMP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Note / Segnali precoci</label>
          <textarea className="form-control" value={form.note} onChange={e => set('note', e.target.value)} placeholder="Osservazioni, segnali di allerta..." />
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Salvataggio...' : 'Salva'}</button>
        </div>
      </div>
    </div>
  )
}

export default function RegistroRischi() {
  const { azienda } = useApp()
  const [rischi, setRischi]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null) // null | {} | {id,...}
  const [filterCat, setFilterCat] = useState('')
  const [filterTier, setFilterTier] = useState('')
  const [search, setSearch]     = useState('')
  const [delConfirm, setDelConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('rischi').select('*').eq('azienda_id', azienda.id).order('created_at')
    setRischi(data || [])
    setLoading(false)
  }, [azienda.id])

  useEffect(() => { load() }, [load])

  async function deleteRischio(id) {
    await supabase.from('rischi').delete().eq('id', id)
    setDelConfirm(null); load()
  }

  const filtered = rischi.filter(r => {
    if (filterCat  && r.categoria !== filterCat) return false
    if (filterTier && r.probabilita && r.impatto) {
      const t = getTier(r.probabilita, r.impatto)
      if (t.tier !== filterTier) return false
    }
    if (search && !r.descrizione.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const tier1 = rischi.filter(r => r.probabilita && r.impatto && getTier(r.probabilita, r.impatto).tier === 'Tier 1').length
  const tier2 = rischi.filter(r => r.probabilita && r.impatto && getTier(r.probabilita, r.impatto).tier === 'Tier 2').length
  const tier3 = rischi.filter(r => r.probabilita && r.impatto && getTier(r.probabilita, r.impatto).tier === 'Tier 3').length

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Registro Rischi</h2>
            <p>Identifica, categorizza e valuta i rischi aziendali</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal({})}>+ Aggiungi rischio</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{rischi.length}</div><div className="stat-label">Rischi totali</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#C0392B' }}>{tier1}</div><div className="stat-label">Tier 1 — Critici</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#E67E22' }}>{tier2}</div><div className="stat-label">Tier 2 — Significativi</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#856404' }}>{tier3}</div><div className="stat-label">Tier 3 — Moderati</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#27AE60' }}>{rischi.filter(r => r.probabilita && r.impatto && getTier(r.probabilita, r.impatto).tier === 'Tier 4').length}</div><div className="stat-label">Tier 4 — Accettabili</div></div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <input className="form-control" style={{ maxWidth: 220 }} placeholder="🔍 Cerca..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-control" style={{ maxWidth: 200 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">Tutte le categorie</option>
            {CATEGORIE.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="form-control" style={{ maxWidth: 160 }} value={filterTier} onChange={e => setFilterTier(e.target.value)}>
            <option value="">Tutti i Tier</option>
            <option>Tier 1</option><option>Tier 2</option><option>Tier 3</option><option>Tier 4</option>
          </select>
          {(filterCat || filterTier || search) && <button className="btn btn-sm" onClick={() => { setFilterCat(''); setFilterTier(''); setSearch('') }}>✕ Reset</button>}
        </div>

        {loading ? <div className="spinner" /> : filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 36 }}>📋</div>
            <p>{rischi.length === 0 ? 'Nessun rischio inserito. Clicca "+ Aggiungi rischio" per iniziare.' : 'Nessun rischio corrisponde ai filtri.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>#</th><th>Categoria</th><th>Descrizione</th><th>Fonte</th>
                <th>P</th><th>I</th><th>Score</th><th>Tier</th><th>Azioni</th>
              </tr></thead>
              <tbody>
                {filtered.map((r, i) => {
                  const t = r.probabilita && r.impatto ? getTier(r.probabilita, r.impatto) : null
                  const cc = CAT_COLORS[r.categoria] || { bg: '#F5F5F5', color: '#333' }
                  return (
                    <tr key={r.id}>
                      <td style={{ color: '#aaa', fontSize: 12 }}>{i + 1}</td>
                      <td><span className="badge" style={{ background: cc.bg, color: cc.color, fontSize: 11 }}>{r.categoria}</span></td>
                      <td style={{ maxWidth: 260 }}>{r.descrizione}</td>
                      <td style={{ color: '#666', fontSize: 12 }}>{r.fonte || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.probabilita || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.impatto || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {t ? <span className="score-pill" style={{ background: t.bg, color: t.color }}>{t.score}</span> : '—'}
                      </td>
                      <td>{t ? <span className="badge" style={{ background: t.bg, color: t.color }}>{t.tier}</span> : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-icon" title="Modifica" onClick={() => setModal(r)}>✏️</button>
                          <button className="btn btn-sm btn-icon btn-danger" title="Elimina" onClick={() => setDelConfirm(r)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <RischioModal rischio={modal} aziendaId={azienda.id} onSave={() => { setModal(null); load() }} onClose={() => setModal(null)} />
      )}

      {delConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 className="modal-title" style={{ marginBottom: 12 }}>Conferma eliminazione</h3>
            <p style={{ fontSize: 14, color: '#555' }}>Vuoi eliminare il rischio <strong>"{delConfirm.descrizione}"</strong>? Verranno eliminate anche le azioni associate.</p>
            <div className="modal-footer">
              <button className="btn" onClick={() => setDelConfirm(null)}>Annulla</button>
              <button className="btn btn-danger" onClick={() => deleteRischio(delConfirm.id)}>Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
