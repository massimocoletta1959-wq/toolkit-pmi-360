import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { getTier, STRATEGIA_OPTIONS, STATO_OPTIONS, getSuggerimentoAzione } from '../lib/constants'

const STATO_COLORS = {
  'Pianificato': { bg: '#F1EFE8', color: '#5F5E5A' },
  'In corso':    { bg: '#D6E8F7', color: '#1A3A5C' },
  'Completato':  { bg: '#D5F5E3', color: '#155724' },
  'Da rivedere': { bg: '#FADBD8', color: '#C0392B' },
}

function AzioneModal({ azione, rischio, aziendaId, onSave, onClose, membri = [] }) {
  const editing = !!azione?.id
  const suggerimento = getSuggerimentoAzione(rischio?.categoria, rischio?.descrizione)

  const [form, setForm] = useState({
    azione:       azione?.azione || '',
    responsabile: azione?.responsabile || '',
    responsabile_custom: '',
    scadenza:     azione?.scadenza || '',
    strategia:    azione?.strategia || 'Ridurre',
    stato:        azione?.stato || 'Pianificato',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [showSugg, setShowSugg] = useState(!editing && !!suggerimento)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.azione) { setError("Descrivi l'azione di mitigazione"); return }
    setLoading(true); setError(null)
    const respFinale = form.responsabile === '__custom' ? (form.responsabile_custom || '') : form.responsabile
    const { responsabile_custom, ...formClean } = form
    const payload = { ...formClean, responsabile: respFinale, rischio_id: rischio.id, azienda_id: aziendaId }
    const { data: azioneSalvata, error: err } = editing
      ? await supabase.from('azioni').update(payload).eq('id', azione.id).select().single()
      : await supabase.from('azioni').insert(payload).select().single()
    if (err) { setError(err.message); setLoading(false); return }
    if (form.responsabile && form.responsabile !== '__custom' && !editing) {
      const membroScelto = membri.find(m =>
        (m.nome + ' ' + m.cognome + (m.ruolo ? ' — ' + m.ruolo : '')) === form.responsabile ||
        (m.nome + ' ' + m.cognome) === form.responsabile
      )
      if (membroScelto) {
        const ticketPayload = {
          azienda_id: aziendaId,
          membro_id: membroScelto.id,
          rischio_id: rischio.id,
          azione_id: azioneSalvata?.id || null,
          titolo: 'Azione: ' + form.azione.substring(0, 80) + (form.azione.length > 80 ? '...' : ''),
          istruzioni: form.azione,
          scadenza: null,
          priorita: rischio.probabilita && rischio.impatto
            ? (rischio.probabilita * rischio.impatto >= 6 ? 'Alta' : rischio.probabilita * rischio.impatto >= 4 ? 'Media' : 'Bassa')
            : 'Media',
          stato: 'Aperto',
        }
        const { data: nuovoTicket } = await supabase.from('ticket').insert(ticketPayload).select().single()

        if (nuovoTicket) {
          const inviaEmail = window.confirm(
            'Ticket creato per ' + membroScelto.nome + ' ' + membroScelto.cognome + '.\n\nVuoi inviare una email con i dettagli del task?'
          )
          if (inviaEmail) {
            try {
              const { data: { session } } = await supabase.auth.getSession()
              await fetch('https://vwbixmbbcutjcplskjvg.supabase.co/functions/v1/invia-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session?.access_token },
                body: JSON.stringify({ ticket_id: nuovoTicket.id, tipo: 'assegnazione' }),
              })
            } catch(e) { console.warn('Email non inviata:', e) }
          }
        }
      }
    }

    onSave()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h3 className="modal-title">{editing ? 'Modifica azione' : 'Nuova azione'}</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Contesto rischio */}
        <div style={{ background: '#F7F8FA', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 13, color: '#555' }}>
          Rischio: <strong>{rischio.descrizione}</strong>
          {rischio.probabilita && rischio.impatto && (() => {
            const t = getTier(rischio.probabilita, rischio.impatto)
            return <span className="badge" style={{ background: t.bg, color: t.color, marginLeft: 8 }}>{t.tier}</span>
          })()}
        </div>

        {/* Suggerimento azione */}
        {showSugg && suggerimento && (
          <div style={{ background: '#E8F4FD', border: '1px solid #B5D4F4', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1A3A5C', marginBottom: 4 }}>💡 Azione suggerita per questo tipo di rischio:</div>
                <div style={{ fontSize: 13, color: '#2B5FA5', lineHeight: 1.5 }}>{suggerimento}</div>
              </div>
              <button className="btn btn-sm" style={{ flexShrink: 0 }} onClick={() => setShowSugg(false)}>✕</button>
            </div>
            <button
              className="btn btn-sm btn-primary"
              style={{ marginTop: 10 }}
              onClick={() => { set('azione', suggerimento); setShowSugg(false) }}
            >
              Usa questo suggerimento →
            </button>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Azione di mitigazione *</label>
          <textarea className="form-control" value={form.azione} onChange={e => set('azione', e.target.value)}
            placeholder="Descrivi l'azione concreta da intraprendere..." />
          {!showSugg && suggerimento && (
            <button style={{ background: 'none', border: 'none', color: '#2B5FA5', fontSize: 12, cursor: 'pointer', marginTop: 4, padding: 0 }}
              onClick={() => setShowSugg(true)}>
              💡 Mostra suggerimento
            </button>
          )}
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Responsabile</label>
            {membri.length > 0 ? (
              <select className="form-control" value={form.responsabile} onChange={e => set('responsabile', e.target.value)}>
                <option value="">Seleziona membro...</option>
                {membri.map(m => (
                  <option key={m.id} value={`${m.nome} ${m.cognome}${m.ruolo ? ' — ' + m.ruolo : ''}`}>
                    {m.nome} {m.cognome}{m.ruolo ? ` — ${m.ruolo}` : ''}
                  </option>
                ))}
                <option value="__custom">— Inserisci manualmente</option>
              </select>
            ) : (
              <input className="form-control" value={form.responsabile} onChange={e => set('responsabile', e.target.value)} placeholder="Es. Responsabile IT" />
            )}
            {form.responsabile === '__custom' && (
              <input className="form-control" style={{ marginTop: 6 }} value={form.responsabile_custom || ''} onChange={e => set('responsabile_custom', e.target.value)} placeholder="Inserisci nome responsabile..." />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Scadenza</label>
            <input className="form-control" value={form.scadenza} onChange={e => set('scadenza', e.target.value)} placeholder="Es. 30 giorni / 31/12/2025" />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Strategia</label>
            <select className="form-control" value={form.strategia} onChange={e => set('strategia', e.target.value)}>
              {STRATEGIA_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Stato</label>
            <select className="form-control" value={form.stato} onChange={e => set('stato', e.target.value)}>
              {STATO_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Salvataggio...' : 'Salva'}</button>
        </div>
      </div>
    </div>
  )
}

export default function PianoAzione() {
  const { azienda } = useApp()
  const [rischi, setRischi]   = useState([])
  const [azioni, setAzioni]   = useState({})
  const [membri, setMembri]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)
  const [filterTier, setFilterTier] = useState('12')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [delConfirm, setDelConfirm] = useState(null)
  const [erroreElimina, setErroreElimina] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: r } = await supabase.from('rischi').select('*').eq('azienda_id', azienda.id).order('categoria').order('descrizione')
    const { data: a } = await supabase.from('azioni').select('*').eq('azienda_id', azienda.id)
    const { data: m } = await supabase.from('membri').select('id, nome, cognome, ruolo').eq('azienda_id', azienda.id).order('cognome')
    setMembri(m || [])
    const aMap = {}
    ;(a || []).forEach(az => { if (!aMap[az.rischio_id]) aMap[az.rischio_id] = []; aMap[az.rischio_id].push(az) })
    setRischi(r || [])
    setAzioni(aMap)
    setLoading(false)
  }, [azienda.id])

  useEffect(() => { load() }, [load])

  // Un'azione con ticket assegnati non si elimina: prima si ritira il ticket (pagina Ticket, con email di incarico
  // ritirato al membro), poi si elimina l'azione. Cosi' nessuno resta con un incarico "orfano".
  async function deleteAzione(az) {
    setErroreElimina(null)
    const { data: tk, error: eTk } = await supabase.from('ticket').select('id, titolo, stato, membri(nome, cognome)').eq('azione_id', az.id)
    if (eTk) { setErroreElimina(`Controllo dei ticket non riuscito: ${eTk.message}`); return }
    if (tk && tk.length) {
      const elenco = tk.map(t => `«${t.titolo}»${t.membri ? ` (${t.membri.nome} ${t.membri.cognome}, ${t.stato})` : ` (${t.stato})`}`).join(', ')
      setErroreElimina(`Questa azione ha ${tk.length === 1 ? 'un ticket assegnato' : `${tk.length} ticket assegnati`}: ${elenco}. Ritira prima ${tk.length === 1 ? 'il ticket' : 'i ticket'} dalla pagina Ticket, poi potrai eliminare l'azione.`)
      return
    }
    const { data, error } = await supabase.from('azioni').delete().eq('id', az.id).select('id')
    if (error || !data?.length) { setErroreElimina(`Azione non eliminata: ${error?.message || 'non hai i permessi per farlo.'}`); return }
    setDelConfirm(null); load()
  }

  const rischiFiltered = rischi.filter(r => {
    if (!r.probabilita || !r.impatto) return false
    if (filterCategoria && r.categoria !== filterCategoria) return false
    const t = getTier(r.probabilita, r.impatto)
    if (filterTier === '12') return t.tier === 'Tier 1' || t.tier === 'Tier 2'
    if (filterTier === '1')  return t.tier === 'Tier 1'
    if (filterTier === '2')  return t.tier === 'Tier 2'
    if (filterTier === '3')  return t.tier === 'Tier 3'
    return true
  }).sort((a, b) => {
    const ta = getTier(a.probabilita, a.impatto)
    const tb = getTier(b.probabilita, b.impatto)
    return ta.score !== tb.score ? tb.score - ta.score : a.descrizione.localeCompare(b.descrizione)
  })

  const totAzioni  = Object.values(azioni).flat().length
  const completate = Object.values(azioni).flat().filter(a => a.stato === 'Completato').length

  return (
    <div>
      <div className="page-header">
        <h2>Piano d'Azione</h2>
        <p>Azioni di mitigazione per i rischi prioritari — si aggiorna automaticamente dal Registro</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{rischiFiltered.length}</div><div className="stat-label">Rischi in piano</div></div>
        <div className="stat-card"><div className="stat-num">{totAzioni}</div><div className="stat-label">Azioni totali</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#27AE60' }}>{completate}</div><div className="stat-label">Completate</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#E67E22' }}>{totAzioni - completate}</div><div className="stat-label">Da completare</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['12','Tier 1 + 2'], ['1','Solo Tier 1'], ['2','Solo Tier 2'], ['3','Solo Tier 3'], ['all','Tutti']].map(([v, l]) => (
          <button key={v} className={`btn btn-sm${filterTier === v ? ' btn-primary' : ''}`} onClick={() => setFilterTier(v)}>{l}</button>
        ))}
        <select className="form-control" style={{ maxWidth: 220, marginLeft: 8 }} value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {[...new Set(rischi.map(r => r.categoria).filter(Boolean))].sort().map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {filterCategoria && <button className="btn btn-sm" onClick={() => setFilterCategoria('')}>✕ Reset</button>}
      </div>

      {loading ? <div className="spinner" /> : rischiFiltered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ fontSize: 36 }}>✅</div>
            <p>Nessun rischio {filterTier !== 'all' ? 'Tier 1/2 ' : ''}trovato. Aggiungi rischi con probabilità e impatto nel Registro.</p>
          </div>
        </div>
      ) : rischiFiltered.map(r => {
        const t   = getTier(r.probabilita, r.impatto)
        const az  = azioni[r.id] || []
        const sugg = getSuggerimentoAzione(r.categoria, r.descrizione)

        return (
          <div key={r.id} className="card" style={{ borderLeft: `4px solid ${t.color}` }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <span className="badge" style={{ background: t.bg, color: t.color, flexShrink: 0 }}>{t.tier}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{r.descrizione}</span>
                <span style={{ color: '#aaa', fontSize: 12, flexShrink: 0 }}>P:{r.probabilita} × I:{r.impatto} = {t.score}</span>
              </div>
              <button className="btn btn-sm btn-primary" style={{ flexShrink: 0 }} onClick={() => setModal({ rischio: r })}>+ Azione</button>
            </div>

            {/* Suggerimento se non ci sono azioni */}
            {az.length === 0 && sugg && (
              <div style={{ background: '#E8F4FD', border: '1px solid #B5D4F4', borderRadius: 6, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#2B5FA5' }}>
                💡 <strong>Azione suggerita:</strong> {sugg.substring(0, 120)}{sugg.length > 120 ? '...' : ''}
                <button className="btn btn-sm" style={{ marginLeft: 10, fontSize: 11 }} onClick={() => setModal({ rischio: r, azionePrecompilata: sugg })}>
                  Usa →
                </button>
              </div>
            )}

            {az.length === 0 && !sugg ? (
              <div style={{ color: '#aaa', fontSize: 13, fontStyle: 'italic', padding: '8px 0' }}>
                Nessuna azione definita — clicca "+ Azione" per aggiungerne una.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F7F8FA' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11 }}>Azione</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11 }}>Responsabile</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11 }}>Scadenza</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11 }}>Strategia</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11 }}>Stato</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {az.map(a => {
                    const sc = STATO_COLORS[a.stato] || STATO_COLORS['Pianificato']
                    return (
                      <tr key={a.id} style={{ borderTop: '1px solid #F0F0F0' }}>
                        <td style={{ padding: '8px 10px', maxWidth: 280 }}>{a.azione}</td>
                        <td style={{ padding: '8px 10px', color: '#555' }}>{a.responsabile || '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#2B5FA5', fontWeight: 600 }}>{a.scadenza || '—'}</td>
                        <td style={{ padding: '8px 10px' }}><span style={{ fontSize: 12, color: '#856404' }}>{a.strategia}</span></td>
                        <td style={{ padding: '8px 10px' }}><span className="badge" style={{ background: sc.bg, color: sc.color }}>{a.stato}</span></td>
                        <td style={{ padding: '8px 6px' }}>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <button className="btn btn-sm btn-icon" onClick={() => setModal({ rischio: r, azione: a })}>✏️</button>
                            <button className="btn btn-sm btn-icon btn-danger" onClick={() => setDelConfirm(a)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {modal && (
        <AzioneModal
          azione={modal.azione || (modal.azionePrecompilata ? { azione: modal.azionePrecompilata } : null)}
          rischio={modal.rischio}
          aziendaId={azienda.id}
          membri={membri}
          onSave={() => { setModal(null); load() }}
          onClose={() => setModal(null)}
        />
      )}

      {delConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 380 }}>
            <h3 className="modal-title" style={{ marginBottom: 12 }}>Elimina azione</h3>
            <p style={{ fontSize: 14, color: '#555' }}>Confermi l'eliminazione dell'azione «{delConfirm.azione}»?</p>
            {erroreElimina && <div className="alert alert-error" style={{ marginTop: 10 }}>{erroreElimina}</div>}
            <div className="modal-footer">
              <button className="btn" onClick={() => { setDelConfirm(null); setErroreElimina(null) }}>{erroreElimina ? 'Chiudi' : 'Annulla'}</button>
              {!erroreElimina && <button className="btn btn-danger" onClick={() => deleteAzione(delConfirm)}>Elimina</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
