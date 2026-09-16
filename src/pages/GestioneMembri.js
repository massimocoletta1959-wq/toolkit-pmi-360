import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { RUOLI_STANDARD_PER_SETTORE } from './Organigramma'
import { repartiConMembri } from '../lib/reparti'

// Qualifiche generiche valide per ogni settore (in coda ai ruoli del settore)
const QUALIFICHE_GENERICHE = [
  'Dipendente / Operativo',
  'Collaboratore Esterno',
  'Altro',
]

function MembroModal({ membro, aziendaId, onSave, onClose }) {
  const { azienda } = useApp()
  const editing = !!membro?.id
  const ruoliSettore = RUOLI_STANDARD_PER_SETTORE[azienda?.settore] || RUOLI_STANDARD_PER_SETTORE.Edilizia || []
  const opzioniQualifica = [
    ...ruoliSettore.map(r => `${r.nome} (${r.sigla})`),
    ...QUALIFICHE_GENERICHE,
  ]
  const [form, setForm] = useState({
    nome:      membro?.nome || '',
    cognome:   membro?.cognome || '',
    email:     membro?.email || '',
    pec:       membro?.pec || '',
    telefono:  membro?.telefono || '',
    cellulare: membro?.cellulare || '',
    ruolo:     membro?.ruolo || '',
    qualifica_custom: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Se il ruolo attuale non è tra le opzioni, è una qualifica personalizzata
  const isCustom = form.ruolo && !opzioniQualifica.includes(form.ruolo) && form.ruolo !== 'Altro'

  async function save() {
    if (!form.nome || !form.cognome) {
      setError('Nome e cognome sono obbligatori')
      return
    }
    const ruoloFinale = form.ruolo === 'Altro' ? form.qualifica_custom : form.ruolo
    if (form.ruolo === 'Altro' && !form.qualifica_custom.trim()) {
      setError('Inserisci la qualifica personalizzata')
      return
    }
    setLoading(true); setError(null)
    const payload = {
      nome: form.nome,
      cognome: form.cognome,
      email: form.email.trim() || null,
      pec: form.pec || null,
      telefono: form.telefono,
      cellulare: form.cellulare || null,
      ruolo: ruoloFinale,
      azienda_id: aziendaId,
    }
    const { error: err } = editing
      ? await supabase.from('membri').update(payload).eq('id', membro.id)
      : await supabase.from('membri').insert(payload)
    if (err) {
      setError(err.message.includes('membri_email_azienda_unici')
        ? 'Esiste gia un membro con questa email in questa azienda.'
        : err.message)
      setLoading(false); return
    }
    onSave()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{editing ? 'Modifica membro' : 'Aggiungi membro'}</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-control" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Mario" />
          </div>
          <div className="form-group">
            <label className="form-label">Cognome *</label>
            <input className="form-control" value={form.cognome} onChange={e => set('cognome', e.target.value)} placeholder="Rossi" />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Email <span style={{ color: '#999', fontWeight: 400 }}>(facoltativa)</span></label>
            <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="mario.rossi@azienda.it" />
          </div>
          <div className="form-group">
            <label className="form-label">PEC <span style={{ color: '#999', fontWeight: 400 }}>(comunicazioni ufficiali)</span></label>
            <input className="form-control" type="email" value={form.pec} onChange={e => set('pec', e.target.value)} placeholder="mario.rossi@pec.it" />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Telefono fisso</label>
            <input className="form-control" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+39 02 1234567" />
          </div>
          <div className="form-group">
            <label className="form-label">Cellulare</label>
            <input className="form-control" value={form.cellulare} onChange={e => set('cellulare', e.target.value)} placeholder="+39 333 1234567" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Qualifica / Ruolo</label>
          <select
            className="form-control"
            value={isCustom ? 'Altro' : form.ruolo}
            onChange={e => {
              set('ruolo', e.target.value)
              if (e.target.value !== 'Altro') set('qualifica_custom', '')
              if (isCustom) set('qualifica_custom', form.ruolo)
            }}
          >
            <option value="">Seleziona qualifica...</option>
            {opzioniQualifica.map(q => <option key={q}>{q}</option>)}
          </select>
        </div>

        {(form.ruolo === 'Altro' || isCustom) && (
          <div className="form-group">
            <label className="form-label">Qualifica personalizzata *</label>
            <input
              className="form-control"
              value={isCustom ? form.ruolo : form.qualifica_custom}
              onChange={e => isCustom ? set('ruolo', e.target.value) : set('qualifica_custom', e.target.value)}
              placeholder="Es. Responsabile ESG, Quality Manager..."
            />
          </div>
        )}

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Salvataggio...' : 'Salva'}</button>
        </div>
      </div>
    </div>
  )
}

// Chiamata condivisa tra l'invito singolo (per riga) e quello multiplo (per selezione)
async function inviaInvitoRichiesta(membroId, aziendaId) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `https://vwbixmbbcutjcplskjvg.supabase.co/functions/v1/invia-invito`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ membro_id: membroId, azienda_id: aziendaId }),
      }
    )
    const data = await res.json()
    return !!data.successo
  } catch {
    return false
  }
}

function InvioInvito({ membro, aziendaId }) {
  const [stato, setStato] = React.useState(null) // null | 'loading' | 'ok' | 'error'

  if (!membro?.email) return <span style={{ color: '#bbb', fontSize: 12 }}>—</span>

  async function invia() {
    setStato('loading')
    const ok = await inviaInvitoRichiesta(membro.id, aziendaId)
    setStato(ok ? 'ok' : 'error')
    setTimeout(() => setStato(null), 3000)
  }

  return (
    <button
      className="btn btn-sm"
      style={{ fontSize: 11, color: stato === 'ok' ? '#27AE60' : stato === 'error' ? '#C0392B' : '#2B5FA5' }}
      onClick={invia}
      disabled={stato === 'loading'}
      title={`Invia invito a ${membro.email}`}
    >
      {stato === 'loading' ? '...' : stato === 'ok' ? '✓ Inviato' : stato === 'error' ? '✗ Errore' : '📧 Invita'}
    </button>
  )
}

function TicketCount({ membroId }) {
  const [count, setCount] = useState(null)
  useEffect(() => {
    supabase.from('ticket').select('id', { count: 'exact' })
      .eq('membro_id', membroId).neq('stato', 'Completato')
      .then(({ count: c }) => setCount(c || 0))
  }, [membroId])
  if (count === null) return <span style={{ color: '#aaa' }}>—</span>
  return <span style={{ fontWeight: 600, color: count > 0 ? '#E67E22' : '#27AE60' }}>{count}</span>
}

export default function GestioneMembri() {
  const { azienda } = useApp()
  const [membri, setMembri]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)
  const [delConfirm, setDelConfirm] = useState(null)
  const [search, setSearch]     = useState('')
  const [selezionati, setSelezionati] = useState(new Set())   // id membri selezionati per l'invito multiplo
  const [reparti, setReparti]   = useState([])
  const [invitando, setInvitando] = useState(false)
  const [esitoInvito, setEsitoInvito] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('membri').select('*').eq('azienda_id', azienda.id).order('cognome')
    setMembri(data || [])
    setLoading(false)
  }, [azienda.id])

  useEffect(() => { load() }, [load])
  useEffect(() => { repartiConMembri(azienda.id).then(setReparti) }, [azienda.id])

  function toggleSel(id) {
    setSelezionati(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function selezionaReparto(membroIds, valore) {
    setSelezionati(s => {
      const next = new Set(s)
      membroIds.forEach(id => { valore ? next.add(id) : next.delete(id) })
      return next
    })
  }

  async function invitaSelezionati() {
    const dest = membri.filter(m => selezionati.has(m.id) && m.email)
    if (!dest.length) return
    setInvitando(true); setEsitoInvito(null)
    const risultati = await Promise.all(dest.map(m => inviaInvitoRichiesta(m.id, azienda.id)))
    const ok = risultati.filter(Boolean).length
    const saltati = selezionati.size - dest.length
    setInvitando(false)
    setEsitoInvito(`${ok}/${dest.length} inviti inviati con successo.${saltati > 0 ? ` ${saltati} saltati (nessuna email).` : ''}`)
    setSelezionati(new Set())
    setTimeout(() => setEsitoInvito(null), 8000)
  }

  async function deleteMembro(id) {
    await supabase.from('membri').delete().eq('id', id)
    setDelConfirm(null); load()
  }

  const filtered = membri.filter(m =>
    !search || `${m.nome} ${m.cognome} ${m.email} ${m.ruolo}`.toLowerCase().includes(search.toLowerCase())
  )

  // Raggruppa per qualifica
  const byQualifica = filtered.reduce((acc, m) => {
    const q = m.ruolo || 'Senza qualifica'
    if (!acc[q]) acc[q] = []
    acc[q].push(m)
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Gestione Membri</h2>
            <p>Anagrafica delle persone coinvolte nella gestione dei rischi</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal({})}>+ Aggiungi membro</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{membri.length}</div><div className="stat-label">Membri totali</div></div>
        <div className="stat-card"><div className="stat-num">{Object.keys(byQualifica).length}</div><div className="stat-label">Qualifiche diverse</div></div>
      </div>

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <input className="form-control" style={{ maxWidth: 300 }} placeholder="🔍 Cerca per nome, email o qualifica..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {reparti.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#999', alignSelf: 'center' }}>Seleziona per reparto:</span>
            {reparti.map(r => (
              <button key={r.sigla} className="btn btn-sm" style={{ fontSize: 11.5 }}
                onClick={() => selezionaReparto(r.membroIds, !Array.from(r.membroIds).every(id => selezionati.has(id)))}>
                {Array.from(r.membroIds).every(id => selezionati.has(id)) ? '✓ ' : '+ '}{r.sigla} ({r.membroIds.size})
              </button>
            ))}
          </div>
        )}

        {selezionati.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EBF4FC', border: '1px solid #CFE3F7', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#1A3A5C' }}><strong>{selezionati.size}</strong> selezionati</span>
            <button className="btn btn-sm btn-primary" onClick={invitaSelezionati} disabled={invitando}>
              {invitando ? 'Invio…' : '📧 Invita selezionati'}
            </button>
            <button className="btn btn-sm" onClick={() => setSelezionati(new Set())}>Annulla selezione</button>
          </div>
        )}
        {esitoInvito && <div className="alert alert-info" style={{ marginBottom: 12 }}>{esitoInvito}</div>}

        {loading ? <div className="spinner" /> : filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 36 }}>👥</div>
            <p>{membri.length === 0 ? 'Nessun membro aggiunto. Clicca "+ Aggiungi membro" per iniziare.' : 'Nessun risultato per la ricerca.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th></th>
                <th>Nome</th>
                <th>Qualifica / Ruolo</th>
                <th>Email</th>
                <th>Telefono</th>
                <th style={{ textAlign: 'center' }}>Ticket aperti</th>
                <th style={{ textAlign: 'center' }}>Invito</th>
                <th></th>
              </tr></thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id}>
                    <td><input type="checkbox" checked={selezionati.has(m.id)} onChange={() => toggleSel(m.id)} /></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.nome} {m.cognome}</div>
                    </td>
                    <td>
                      {m.ruolo
                        ? <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#EBF4FC', color: '#2B5FA5' }}>{m.ruolo}</span>
                        : <span style={{ color: '#aaa', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <div style={{ color: '#2B5FA5' }}>{m.email}</div>
                      {m.pec && <div style={{ color: '#856404', fontSize: 11 }}>PEC: {m.pec}</div>}
                    </td>
                    <td style={{ color: '#666', fontSize: 13 }}>
                      <div>{m.telefono || '—'}</div>
                      {m.cellulare && <div style={{ fontSize: 11, color: '#999' }}>📱 {m.cellulare}</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}><TicketCount membroId={m.id} /></td>
                    <td style={{ textAlign: 'center' }}><InvioInvito membro={m} aziendaId={azienda.id} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-icon" title="Modifica" onClick={() => setModal(m)}>✏️</button>
                        <button className="btn btn-sm btn-icon btn-danger" title="Elimina" onClick={() => setDelConfirm(m)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <MembroModal membro={modal} aziendaId={azienda.id} onSave={() => { setModal(null); load() }} onClose={() => setModal(null)} />
      )}

      {delConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 className="modal-title" style={{ marginBottom: 12 }}>Conferma eliminazione</h3>
            <p style={{ fontSize: 14, color: '#555' }}>Vuoi eliminare <strong>{delConfirm.nome} {delConfirm.cognome}</strong>? I ticket associati rimarranno ma senza assegnatario.</p>
            <div className="modal-footer">
              <button className="btn" onClick={() => setDelConfirm(null)}>Annulla</button>
              <button className="btn btn-danger" onClick={() => deleteMembro(delConfirm.id)}>Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
