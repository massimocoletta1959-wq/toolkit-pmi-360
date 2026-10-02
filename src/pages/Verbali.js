import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'

// Etichette leggibili per il tipo di organo
const ORGANO_LABEL = {
  cda: 'CdA', amministratore_unico: 'AU', comitato: 'Comitato',
  collegio_sindacale: 'Collegio Sindacale', assemblea: 'Assemblea', altro: 'Organo',
}

const STATO_STYLE = {
  programmata:  { background: '#FEF9E7', color: '#856404', label: 'Programmata' },
  svolta:       { background: '#EAF2F8', color: '#2874A6', label: 'Svolta' },
  verbalizzata: { background: '#E9F7EF', color: '#1E8449', label: 'Verbalizzata' },
  annullata:    { background: '#FDEDEC', color: '#C0392B', label: 'Annullata' },
}

const numFmt = a => `${a.numero != null ? String(a.numero).padStart(2, '0') : '—'}/${a.anno}`

const dataFmt = a => a.data_ora ? new Date(a.data_ora).toLocaleString('it-IT', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '—'

// ── Modale: nuova adunanza ────────────────────────────────────────────
function NuovaAdunanzaModal({ aziendaId, organi, onSaved, onClose }) {
  const [organoId, setOrganoId] = useState(organi[0]?.id || '')
  const [titolo, setTitolo] = useState('')
  const [sessione, setSessione] = useState('ordinaria')
  const [dataOra, setDataOra] = useState('')
  const [luogo, setLuogo] = useState('')
  const [modalita, setModalita] = useState('presenza')
  const [templateId, setTemplateId] = useState('')
  const [modelli, setModelli] = useState([])
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('verbale_template').select('id,nome,organo_tipo').eq('azienda_id', aziendaId).order('created_at')
      setModelli(data || [])
    })()
  }, [aziendaId])

  // filtra i modelli per il tipo di organo scelto (o generici)
  const organoSel = organi.find(o => o.id === organoId)
  const modelliCompat = modelli.filter(m => !m.organo_tipo || m.organo_tipo === organoSel?.tipo)

  async function salva() {
    if (!organoId) { setErrore('Seleziona l\'organo che si riunisce.'); return }
    if (!titolo.trim()) { setErrore('Indica un titolo per l\'adunanza.'); return }
    setSaving(true); setErrore(null)

    // se scelto un modello, ne leggo la struttura da copiare
    let tpl = null
    if (templateId) {
      const { data } = await supabase.from('verbale_template').select('*').eq('id', templateId).single()
      tpl = data || null
    }

    const { data, error } = await supabase.from('adunanze').insert({
      azienda_id: aziendaId, organo_id: organoId, titolo: titolo.trim(), sessione,
      data_ora: dataOra ? new Date(dataOra).toISOString() : null,
      luogo: luogo || null, modalita, stato: 'programmata',
      template_id: templateId || null,
      intestazione: tpl?.intestazione || null,
    }).select().single()
    if (error) { setSaving(false); setErrore(error.message); return }

    // copio OdG e delibere dal modello nella nuova adunanza
    if (tpl) {
      const odg = Array.isArray(tpl.odg) ? tpl.odg : []
      if (odg.length) {
        await supabase.from('adunanza_punti').insert(odg.map((p, i) => ({
          adunanza_id: data.id, azienda_id: aziendaId, ordine: i + 1,
          titolo: p.titolo || `Punto ${i + 1}`, relatore: p.relatore || null, con_delibera: true,
        })))
      }
      const delb = Array.isArray(tpl.delibere) ? tpl.delibere : []
      if (delb.length) {
        await supabase.from('delibere').insert(delb.map(d => ({
          adunanza_id: data.id, azienda_id: aziendaId,
          oggetto: d.oggetto || 'Delibera', testo: d.testo || null,
          favorevoli: 0, contrari: 0, astenuti: 0, esito: d.esito || 'approvata',
        })))
      }
    }

    setSaving(false)
    onSaved(data?.id)
  }

  return (
    <div className="modal-overlay" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div className="card" style={{ width: 480, maxWidth: '92%', margin: 0 }} onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <span className="card-title">Nuova adunanza</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Organo che si riunisce *</label>
          <select className="form-control" value={organoId} onChange={e => setOrganoId(e.target.value)}>
            {organi.map(o => (
              <option key={o.id} value={o.id}>{o.nome} · {ORGANO_LABEL[o.tipo] || o.tipo}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Modello di verbale (facoltativo)</label>
          <select className="form-control" value={templateId} onChange={e => setTemplateId(e.target.value)}>
            <option value="">Parti da zero (testo standard)</option>
            {modelliCompat.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Se scegli un modello, il verbale verrà generato dal tuo facsimile riempiendo i segnaposti.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Titolo / oggetto *</label>
          <input className="form-control" value={titolo} onChange={e => setTitolo(e.target.value)}
            placeholder="es. Approvazione bilancio 2025" />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Sessione</label>
            <select className="form-control" value={sessione} onChange={e => setSessione(e.target.value)}>
              <option value="ordinaria">Ordinaria</option>
              <option value="straordinaria">Straordinaria</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Modalità</label>
            <select className="form-control" value={modalita} onChange={e => setModalita(e.target.value)}>
              <option value="presenza">In presenza</option>
              <option value="videoconferenza">Videoconferenza</option>
              <option value="mista">Mista</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Data e ora</label>
            <input className="form-control" type="datetime-local" value={dataOra} onChange={e => setDataOra(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Luogo</label>
            <input className="form-control" value={luogo} onChange={e => setLuogo(e.target.value)} placeholder="Sede legale / link" />
          </div>
        </div>

        {errore && <div className="alert alert-error" style={{ marginBottom: 12 }}>{errore}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={salva} disabled={saving}>{saving ? 'Salvataggio…' : 'Crea adunanza'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Pagina: elenco adunanze ───────────────────────────────────────────
export default function Verbali() {
  const { azienda, apriAdunanza, modoIncaricato, organoIncarico } = useApp()
  const [adunanze, setAdunanze] = useState([])
  const [organi, setOrgani] = useState([])
  const [orgById, setOrgById] = useState({})
  const [loading, setLoading] = useState(true)
  const [showNuova, setShowNuova] = useState(false)
  const [filterStato, setFilterStato] = useState('')

  const load = useCallback(async () => {
    if (!azienda?.id) return
    setLoading(true)
    let qOrg = supabase.from('organi').select('id,nome,tipo').eq('azienda_id', azienda.id).order('created_at')
    let qAd = supabase.from('adunanze').select('*').eq('azienda_id', azienda.id)
    if (modoIncaricato) {   // incaricato: solo l'organo dell'incarico
      qOrg = qOrg.eq('id', organoIncarico.organo_id); qAd = qAd.eq('organo_id', organoIncarico.organo_id)
    }
    const { data: orgs } = await qOrg
    const { data: ad } = await qAd
      .order('anno', { ascending: false }).order('data_ora', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false })
    setOrgani(orgs || [])
    setOrgById(Object.fromEntries((orgs || []).map(o => [o.id, o])))
    setAdunanze(ad || [])
    setLoading(false)
  }, [azienda, modoIncaricato, organoIncarico])

  useEffect(() => { load() }, [load])

  const filtered = adunanze.filter(a => !filterStato || a.stato === filterStato)
  const nProg = adunanze.filter(a => a.stato === 'programmata').length
  const nVerb = adunanze.filter(a => a.stato === 'verbalizzata').length

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Assemblee e verbali</h2>
            <p>Sedute del CdA e assemblee dei soci di <strong>{azienda?.nome}</strong> · ordine del giorno, delibere, verbali</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNuova(true)} disabled={organi.length === 0}>+ Nuova adunanza</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{adunanze.length}</div><div className="stat-label">Adunanze totali</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#856404' }}>{nProg}</div><div className="stat-label">Programmate</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#1E8449' }}>{nVerb}</div><div className="stat-label">Verbalizzate</div></div>
      </div>

      {organi.length === 0 && !loading && (
        <div className="alert" style={{ marginBottom: 14, background: '#FEF9E7', color: '#856404' }}>
          Per creare un'adunanza serve prima almeno un organo collegiale. Vai in <strong>Organi</strong> e crea il CdA o l'Assemblea.
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <select className="form-control" style={{ maxWidth: 200 }} value={filterStato} onChange={e => setFilterStato(e.target.value)}>
            <option value="">Tutti gli stati</option>
            <option value="programmata">Programmate</option>
            <option value="svolta">Svolte</option>
            <option value="verbalizzata">Verbalizzate</option>
            <option value="annullata">Annullate</option>
          </select>
          {filterStato && <button className="btn btn-sm" onClick={() => setFilterStato('')}>✕ Reimposta</button>}
        </div>

        {loading ? <div className="spinner" /> : filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 36 }}>🗳️</div>
            <p>{adunanze.length === 0
              ? 'Nessuna adunanza registrata. Clicca "+ Nuova adunanza" per programmarne una.'
              : 'Nessuna adunanza corrisponde al filtro.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>N.</th><th>Titolo</th><th>Organo</th><th>Data</th><th>Sessione</th><th>Stato</th>
              </tr></thead>
              <tbody>
                {filtered.map(a => {
                  const st = STATO_STYLE[a.stato] || STATO_STYLE.programmata
                  const org = orgById[a.organo_id]
                  return (
                    <tr key={a.id} onClick={() => apriAdunanza(a.id)} style={{ cursor: 'pointer' }}
                      title={a.stato === 'verbalizzata' ? 'Apri il verbale (sola lettura)' : 'Apri e compila'}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>{numFmt(a)}</td>
                      <td style={{ maxWidth: 300, fontWeight: 600 }}>{a.titolo}</td>
                      <td style={{ fontSize: 12, color: '#666' }}>{org ? `${org.nome}` : '—'}</td>
                      <td style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>{dataFmt(a)}</td>
                      <td style={{ fontSize: 12, color: '#666', textTransform: 'capitalize' }}>{a.sessione}</td>
                      <td><span className="badge" style={{ background: st.background, color: st.color }}>{st.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNuova && (
        <NuovaAdunanzaModal aziendaId={azienda.id} organi={organi}
          onSaved={(newId) => { setShowNuova(false); if (newId) apriAdunanza(newId); else load() }}
          onClose={() => setShowNuova(false)} />
      )}
    </div>
  )
}
