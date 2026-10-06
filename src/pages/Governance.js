import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'

// Tipi di organo previsti dal database (tabella organi)
const TIPI = [
  { id: 'cda',                  label: 'Consiglio di Amministrazione', icon: '🏛️', mono: false },
  { id: 'amministratore_unico', label: 'Amministratore Unico',         icon: '👤', mono: true  },
  { id: 'comitato',             label: 'Comitato',                     icon: '👥', mono: false },
  { id: 'collegio_sindacale',   label: 'Collegio Sindacale',           icon: '⚖️', mono: false },
  { id: 'assemblea',            label: 'Assemblea',                    icon: '🗳️', mono: false },
  { id: 'altro',                label: 'Altro organo',                 icon: '📋', mono: false },
]
const tipoInfo = id => TIPI.find(t => t.id === id) || TIPI[TIPI.length - 1]

// Ruoli tipici dentro un organo (campo organo_membri.ruolo — testo libero lato DB)
const RUOLI = ['Presidente', 'Vice Presidente', 'Amministratore Delegato', 'Consigliere',
  'Amministratore Unico', 'Presidente del Collegio', 'Sindaco effettivo', 'Sindaco supplente', 'Membro']

const nomeMembro = m => m ? `${m.nome || ''} ${m.cognome || ''}`.trim() || m.email : '—'

const fmtQuota = q => (q == null || q === '') ? '—' : `${Number(q).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}%`

// ---------------------------------------------------------------------
// Modale: nuovo organo
// ---------------------------------------------------------------------
function OrganoModal({ aziendaId, organo, onSaved, onClose }) {
  const editing = !!organo?.id
  const [tipo, setTipo] = useState(organo?.tipo || 'cda')
  const [nome, setNome] = useState(organo?.nome || '')
  const [qPres, setQPres] = useState(organo?.quorum_presenza ?? '')
  const [qDelib, setQDelib] = useState(organo?.quorum_delibera ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const info = tipoInfo(tipo)

  async function salva() {
    if (!nome.trim()) { setError('Dai un nome all\'organo (es. "CdA", "Comitato Rischi").'); return }
    setLoading(true); setError(null)
    let err
    if (editing) {
      // In modifica cambiamo solo denominazione e quorum (il tipo resta invariato)
      ;({ error: err } = await supabase.from('organi').update({
        nome: nome.trim(),
        quorum_presenza: qPres === '' ? null : Number(qPres),
        quorum_delibera: qDelib === '' ? null : Number(qDelib),
      }).eq('id', organo.id))
    } else {
      ;({ error: err } = await supabase.from('organi').insert({
        azienda_id: aziendaId,
        tipo,
        nome: nome.trim(),
        monocratico: info.mono,
        quorum_presenza: qPres === '' ? null : Number(qPres),
        quorum_delibera: qDelib === '' ? null : Number(qDelib),
      }))
    }
    setLoading(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div className="card" style={{ width: 460, maxWidth: '92%', margin: 0 }} onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <span className="card-title">{editing ? 'Modifica organo' : 'Nuovo organo'}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Tipo di organo</label>
          {editing ? (
            <div className="form-control" style={{ background: '#F5F5F5', color: '#666' }}>{info.icon}  {info.label}</div>
          ) : (
            <select className="form-control" value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPI.map(t => <option key={t.id} value={t.id}>{t.icon}  {t.label}</option>)}
            </select>
          )}
          {info.mono && <div style={{ fontSize: 11, color: '#666', marginTop: 5 }}>Organo monocratico: un solo componente.</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Nome / denominazione</label>
          <input className="form-control" value={nome} onChange={e => setNome(e.target.value)}
            placeholder={info.mono ? 'es. Amministratore Unico' : 'es. Consiglio di Amministrazione'} />
        </div>

        {!info.mono && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Quorum presenza</label>
              <input className="form-control" type="number" step="0.01" min="0" max="1" value={qPres}
                onChange={e => setQPres(e.target.value)} placeholder="es. 0.5" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Quorum delibera</label>
              <input className="form-control" type="number" step="0.01" min="0" max="1" value={qDelib}
                onChange={e => setQDelib(e.target.value)} placeholder="es. 0.5" />
            </div>
          </div>
        )}
        {!info.mono && <div style={{ fontSize: 11, color: '#999', marginTop: -6, marginBottom: 10 }}>Frazione dei componenti (0,5 = maggioranza). Lascia vuoto se non applicabile.</div>}

        {error && <div style={{ background: '#FADBD8', color: '#C0392B', padding: '8px 10px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={salva} disabled={loading}>{loading ? 'Salvataggio…' : (editing ? 'Salva modifiche' : 'Crea organo')}</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Riga per aggiungere un componente a un organo
//  - assemblea: si indica la quota %
//  - altri organi: si indica il ruolo
// ---------------------------------------------------------------------
function AggiungiComponente({ organo, membri, giaPresenti, onAdded }) {
  const isAssemblea = organo.tipo === 'assemblea'
  const [membroId, setMembroId] = useState('')
  const [ruolo, setRuolo] = useState(organo.monocratico ? 'Amministratore Unico' : 'Consigliere')
  const [quota, setQuota] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [nuova, setNuova] = useState({ nome: '', cognome: '', email: '' })

  const disponibili = membri.filter(m => !giaPresenti.includes(m.id))

  async function aggiungi() {
    if (!membroId) { setError('Scegli una persona.'); return }
    setLoading(true); setError(null)
    // Nuova persona: la funzione la collega all'organo (riusa la persona dell'azienda con la stessa email) senza
    // che chi gestisce l'organo debba vedere l'anagrafica dell'azienda
    if (membroId === '__nuova__') {
      const { error: err } = await supabase.rpc('aggiungi_componente_organo', {
        p_organo: organo.id, p_nome: nuova.nome, p_cognome: nuova.cognome, p_email: nuova.email,
        p_ruolo: isAssemblea ? 'Socio' : ruolo, p_quota: isAssemblea && quota !== '' ? Number(quota) : null,
      })
      setLoading(false)
      if (err) { setError(err.message); return }
      setMembroId(''); setQuota(''); setNuova({ nome: '', cognome: '', email: '' }); onAdded()
      return
    }
    const payload = {
      organo_id: organo.id, membro_id: membroId,
      data_nomina: new Date().toISOString().slice(0, 10),
    }
    if (isAssemblea) {
      payload.ruolo = 'Socio'
      payload.quota = quota === '' ? null : Number(quota)
    } else {
      payload.ruolo = ruolo
    }
    const { error: err } = await supabase.from('organo_membri').insert(payload)
    setLoading(false)
    if (err) { setError(err.message.includes('duplicate') ? 'Persona già presente.' : err.message); return }
    setMembroId(''); setQuota(''); onAdded()
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, flexWrap: 'wrap' }}>
      <select className="form-control" style={{ flex: 2, minWidth: 160 }} value={membroId} onChange={e => setMembroId(e.target.value)}>
        <option value="">+ Aggiungi {isAssemblea ? 'socio' : 'persona'}…</option>
        <option value="__nuova__">➕ Nuova persona (nome, cognome, email)</option>
        {disponibili.map(m => <option key={m.id} value={m.id}>{nomeMembro(m)}</option>)}
      </select>
      {membroId === '__nuova__' && (
        <div style={{ display: 'flex', gap: 8, width: '100%', flexWrap: 'wrap' }}>
          <input className="form-control" style={{ flex: 1, minWidth: 120 }} placeholder="Nome" value={nuova.nome} onChange={e => setNuova(n => ({ ...n, nome: e.target.value }))} />
          <input className="form-control" style={{ flex: 1, minWidth: 120 }} placeholder="Cognome" value={nuova.cognome} onChange={e => setNuova(n => ({ ...n, cognome: e.target.value }))} />
          <input className="form-control" style={{ flex: 2, minWidth: 180 }} type="email" placeholder="Email (per inviti e prese visione)" value={nuova.email} onChange={e => setNuova(n => ({ ...n, email: e.target.value }))} />
        </div>
      )}
      {isAssemblea ? (
        <input className="form-control" style={{ flex: 1, minWidth: 130 }} type="number" step="0.001" min="0" max="100"
          value={quota} onChange={e => setQuota(e.target.value)} placeholder="Quota % (es. 64,29)" />
      ) : (
        <select className="form-control" style={{ flex: 1, minWidth: 130 }} value={ruolo} onChange={e => setRuolo(e.target.value)}>
          {RUOLI.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      )}
      <button className="btn btn-primary btn-sm" onClick={aggiungi} disabled={loading || !membroId}>Aggiungi</button>
      {error && <div style={{ width: '100%', color: '#C0392B', fontSize: 12 }}>{error}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------
// Incaricati della gestione di un organo (solo vista gestore)
// Possono essere persone già in anagrafica o esterni: ricevono un'email
// (o un invito a registrarsi) e gestiscono l'organo da "I miei organi".
// ---------------------------------------------------------------------
function IncaricatiOrgano({ organo, membri, onCambio }) {
  const [incaricati, setIncaricati] = useState([])
  const [aperto, setAperto] = useState(false)
  const [scelta, setScelta] = useState('')
  const [esterno, setEsterno] = useState({ nome: '', cognome: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const carica = useCallback(async () => {
    const { data } = await supabase.from('organo_incaricati')
      .select('*, membri(nome,cognome,email,user_id)').eq('organo_id', organo.id).is('data_revoca', null).order('created_at')
    setIncaricati(data || [])
  }, [organo.id])
  useEffect(() => { carica() }, [carica])

  async function nomina() {
    setBusy(true); setMsg(null)
    let membroId = scelta
    if (scelta === '__esterno__') {
      const email = esterno.email.trim().toLowerCase()
      if (!esterno.nome.trim() || !esterno.cognome.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
        setMsg({ err: true, txt: 'Inserisci nome, cognome ed email valida.' }); setBusy(false); return
      }
      const { data: nuovo, error } = await supabase.from('membri').insert({
        azienda_id: organo.azienda_id, nome: esterno.nome.trim(), cognome: esterno.cognome.trim(), email, ruolo: 'Esterno',
      }).select('id').single()
      if (error) { setMsg({ err: true, txt: error.message }); setBusy(false); return }
      membroId = nuovo.id
    }
    if (!membroId) { setMsg({ err: true, txt: 'Scegli una persona.' }); setBusy(false); return }
    const { data, error } = await supabase.functions.invoke('nomina-incaricato', { body: { organo_id: organo.id, membro_id: membroId } })
    setBusy(false)
    if (error || data?.error) {
      let txt = data?.error || error?.message
      try { txt = (await error.context.json()).error || txt } catch (_e) { /* risposta non JSON */ }
      setMsg({ err: true, txt }); return
    }
    setMsg({ err: false, txt: data.registrato
      ? 'Nomina registrata: la persona ha ricevuto un\'email e trova l\'organo in "I miei organi".'
      : 'Nomina registrata: la persona ha ricevuto l\'invito a registrarsi al portale.' })
    setAperto(false); setScelta(''); setEsterno({ nome: '', cognome: '', email: '' })
    carica(); onCambio && onCambio()
  }

  async function revoca(inc) {
    const n = inc.membri ? `${inc.membri.nome || ''} ${inc.membri.cognome || ''}`.trim() : 'questa persona'
    if (!window.confirm(`Revocare l'incarico di gestione di "${organo.nome}" a ${n}?`)) return
    await supabase.from('organo_incaricati').update({ data_revoca: new Date().toISOString().slice(0, 10) }).eq('id', inc.id)
    carica(); onCambio && onCambio()
  }

  const giaIncaricati = new Set(incaricati.map(i => i.membro_id))
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid #E8ECF2', paddingTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A3A5C', flex: 1 }}>🔑 Incaricati della gestione</span>
        {!aperto && <button className="btn btn-sm" onClick={() => { setAperto(true); setMsg(null) }}>+ Nomina incaricato</button>}
      </div>
      {incaricati.length === 0 && !aperto && (
        <div style={{ fontSize: 12, color: '#999' }}>Nessuno: l'organo è gestito solo da te. Un incaricato lo gestisce in autonomia (componenti, adunanze, verbali), senza vedere il resto dell'azienda.</div>
      )}
      {incaricati.map(i => (
        <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' }}>
          <span style={{ flex: 1 }}>{nomeMembro(i.membri)} <span style={{ color: '#999', fontSize: 12 }}>· {i.membri?.email} · dal {new Date(i.data_nomina + 'T00:00:00').toLocaleDateString('it-IT')}</span>
            {!i.membri?.user_id && <span className="badge" style={{ background: '#FEF9E7', color: '#856404', marginLeft: 6 }}>invito in attesa</span>}
          </span>
          <button className="btn btn-sm btn-danger" onClick={() => revoca(i)}>Revoca</button>
        </div>
      ))}
      {aperto && (
        <div style={{ background: '#F7F8FA', borderRadius: 8, padding: 10, marginTop: 6 }}>
          <select className="form-control" value={scelta} onChange={e => setScelta(e.target.value)}>
            <option value="">Scegli una persona…</option>
            {membri.filter(m => !giaIncaricati.has(m.id)).map(m => (
              <option key={m.id} value={m.id} disabled={!m.email}>{nomeMembro(m)}{m.email ? ` — ${m.email}` : ' (senza email)'}</option>
            ))}
            <option value="__esterno__">+ Persona esterna (non in anagrafica)…</option>
          </select>
          {scelta === '__esterno__' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 6, marginTop: 6 }}>
              <input className="form-control" placeholder="Nome" value={esterno.nome} onChange={e => setEsterno({ ...esterno, nome: e.target.value })} />
              <input className="form-control" placeholder="Cognome" value={esterno.cognome} onChange={e => setEsterno({ ...esterno, cognome: e.target.value })} />
              <input className="form-control" placeholder="Email" type="email" value={esterno.email} onChange={e => setEsterno({ ...esterno, email: e.target.value })} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="btn btn-sm btn-primary" onClick={nomina} disabled={busy}>{busy ? 'Invio…' : 'Nomina e invia email'}</button>
            <button className="btn btn-sm" onClick={() => setAperto(false)} disabled={busy}>Annulla</button>
          </div>
        </div>
      )}
      {msg && <div style={{ fontSize: 12, marginTop: 6, color: msg.err ? '#C0392B' : '#1E8449' }}>{msg.txt}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------
// Pagina Governance — Organi & composizione
// ---------------------------------------------------------------------
export default function Governance() {
  const { azienda, modoIncaricato, organoIncarico } = useApp()
  const [organi, setOrgani] = useState([])
  const [membri, setMembri] = useState([])
  const [comp, setComp] = useState([])       // organo_membri con membri joinati
  const [loading, setLoading] = useState(true)
  const [showNuovo, setShowNuovo] = useState(false)
  const [editOrg, setEditOrg] = useState(null)

  const load = useCallback(async () => {
    if (!azienda?.id) return
    setLoading(true)
    let qOrg = supabase.from('organi').select('*').eq('azienda_id', azienda.id).order('created_at')
    if (modoIncaricato) qOrg = qOrg.eq('id', organoIncarico.organo_id)   // incaricato: solo il suo organo
    const { data: orgs } = await qOrg
    const { data: mem } = await supabase.from('membri').select('id,nome,cognome,email,ruolo').eq('azienda_id', azienda.id).order('cognome')
    let composizione = []
    if (orgs && orgs.length) {
      const { data: c } = await supabase.from('organo_membri')
        .select('*, membri(nome,cognome,email)')
        .in('organo_id', orgs.map(o => o.id))
      composizione = c || []
    }
    setOrgani(orgs || []); setMembri(mem || []); setComp(composizione)
    setLoading(false)
  }, [azienda, modoIncaricato, organoIncarico])

  useEffect(() => { load() }, [load])

  async function eliminaOrgano(o) {
    if (!window.confirm(`Eliminare "${o.nome}" e la sua composizione?`)) return
    await supabase.from('organi').delete().eq('id', o.id)
    load()
  }
  async function rimuoviComponente(id) {
    await supabase.from('organo_membri').delete().eq('id', id)
    load()
  }
  async function cambiaRuolo(id, ruolo) {
    await supabase.from('organo_membri').update({ ruolo }).eq('id', id)
    load()
  }
  async function cambiaQuota(id, quota) {
    await supabase.from('organo_membri').update({ quota: quota === '' ? null : Number(quota) }).eq('id', id)
    load()
  }

  const compDi = organoId => comp.filter(c => c.organo_id === organoId)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, color: '#1A3A5C', marginBottom: 2 }}>Governance — Organi</h2>
          <p style={{ fontSize: 13, color: '#666' }}>Organi societari di <strong>{azienda?.nome}</strong> e loro composizione.</p>
        </div>
        {!modoIncaricato && <button className="btn btn-primary" onClick={() => setShowNuovo(true)}>+ Nuovo organo</button>}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1A3A5C' }}>{organi.length}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Organi</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1A3A5C' }}>{comp.length}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Cariche assegnate</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1A3A5C' }}>{membri.length}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Persone disponibili</div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', color: '#999' }}>Caricamento…</div>
      ) : organi.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏛️</div>
          <div style={{ color: '#666', marginBottom: 16 }}>Nessun organo ancora. Crea il primo — di solito il Consiglio di Amministrazione.</div>
          <button className="btn btn-primary" onClick={() => setShowNuovo(true)}>+ Crea il primo organo</button>
        </div>
      ) : (
        organi.map(o => {
          const info = tipoInfo(o.tipo)
          const isAssemblea = o.tipo === 'assemblea'
          const membriOrgano = compDi(o.id)
          const idsPresenti = membriOrgano.map(c => c.membro_id)
          const pieno = o.monocratico && membriOrgano.length >= 1
          const totQuote = membriOrgano.reduce((s, c) => s + (c.quota ? Number(c.quota) : 0), 0)
          return (
            <div className="card" key={o.id}>
              <div className="card-header">
                <span className="card-title">{info.icon}  {o.nome}
                  <span className="badge" style={{ background: '#EBF4FC', color: '#2B5FA5', marginLeft: 8 }}>{info.label}</span>
                  {o.monocratico && <span className="badge" style={{ background: '#FEF9E7', color: '#856404', marginLeft: 6 }}>monocratico</span>}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => setEditOrg(o)}>Modifica</button>
                  {!modoIncaricato && <button className="btn btn-sm btn-danger" onClick={() => eliminaOrgano(o)}>Elimina</button>}
                </div>
              </div>

              {(o.quorum_presenza != null || o.quorum_delibera != null) && (
                <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
                  {o.quorum_presenza != null && <>Quorum presenza: <strong>{o.quorum_presenza}</strong>&nbsp;&nbsp;</>}
                  {o.quorum_delibera != null && <>Quorum delibera: <strong>{o.quorum_delibera}</strong></>}
                </div>
              )}

              {membriOrgano.length === 0 ? (
                <div style={{ fontSize: 13, color: '#999', padding: '4px 0' }}>Nessun {isAssemblea ? 'socio' : 'componente'} assegnato.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr>
                      <th>{isAssemblea ? 'Socio' : 'Componente'}</th>
                      <th>{isAssemblea ? 'Quota %' : 'Ruolo'}</th>
                      <th>Dal</th><th></th>
                    </tr></thead>
                    <tbody>
                      {membriOrgano.map(c => (
                        <tr key={c.id}>
                          <td>{nomeMembro(c.membri)}</td>
                          <td>
                            {isAssemblea ? (
                              <input className="form-control" style={{ width: 120, padding: '4px 8px', fontSize: 13 }}
                                type="number" step="0.001" min="0" max="100" defaultValue={c.quota ?? ''}
                                onBlur={e => { const v = e.target.value; if (String(c.quota ?? '') !== v) cambiaQuota(c.id, v) }}
                                placeholder="%" />
                            ) : (
                              <select className="form-control" style={{ width: 'auto', minWidth: 150, padding: '4px 8px', fontSize: 13 }}
                                value={RUOLI.includes(c.ruolo) ? c.ruolo : '__altro__'}
                                onChange={e => e.target.value !== '__altro__' && cambiaRuolo(c.id, e.target.value)}>
                                {!RUOLI.includes(c.ruolo) && <option value="__altro__">{c.ruolo}</option>}
                                {RUOLI.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            )}
                          </td>
                          <td style={{ color: '#666', fontSize: 12 }}>{c.data_nomina ? new Date(c.data_nomina + 'T00:00:00').toLocaleDateString('it-IT') : '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-sm btn-danger" onClick={() => rimuoviComponente(c.id)}>Rimuovi</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {isAssemblea && membriOrgano.length > 0 && (
                    <div style={{ fontSize: 12, color: totQuote > 100.001 ? '#C0392B' : '#666', marginTop: 8, textAlign: 'right' }}>
                      Totale quote: <strong>{fmtQuota(totQuote)}</strong>{totQuote > 100.001 ? ' — supera il 100%!' : ''}
                    </div>
                  )}
                </div>
              )}

              {!pieno && (
                membri.length === 0
                  ? <div style={{ fontSize: 12, color: '#999', marginTop: 10 }}>Aggiungi prima delle persone in “Membri” per poterle nominare qui.</div>
                  : <AggiungiComponente organo={o} membri={membri} giaPresenti={idsPresenti} onAdded={load} />
              )}
              {pieno && <div style={{ fontSize: 12, color: '#999', marginTop: 10 }}>Organo monocratico: componente già assegnato.</div>}
              {!modoIncaricato && <IncaricatiOrgano organo={o} membri={membri} />}
            </div>
          )
        })
      )}

      {showNuovo && (
        <OrganoModal aziendaId={azienda.id}
          onSaved={() => { setShowNuovo(false); load() }}
          onClose={() => setShowNuovo(false)} />
      )}

      {editOrg && (
        <OrganoModal aziendaId={azienda.id} organo={editOrg}
          onSaved={() => { setEditOrg(null); load() }}
          onClose={() => setEditOrg(null)} />
      )}
    </div>
  )
}
