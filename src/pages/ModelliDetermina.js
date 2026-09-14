import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { nomeAtto as calcolaNomeAtto } from '../lib/modalitaSolo'

// Tipi di determina/delibera (allineati al wizard NuovaDetermina)
const TIPI = [
  ['beni_strumentali', 'Acquisto beni strumentali'],
  ['contratto', 'Approvazione contratto'],
  ['operazione_finanziaria', 'Operazione finanziaria'],
  ['adempimenti_contabili', 'Adempimenti contabili e fiscali'],
  ['personale', 'Personale e organizzazione'],
  ['assunzione', 'Assunzione rilevante'],
  ['consulenza', 'Consulenza e incarichi esterni'],
  ['contenzioso', 'Contenzioso e gestione legale'],
  ['rs_innovazione', 'Ricerca, sviluppo e innovazione'],
  ['marketing', 'Marketing, comunicazione, eventi'],
  ['immobiliare', 'Gestione immobiliare e manutenzioni'],
  ['compliance', 'Sicurezza e conformità'],
  ['procura', 'Concessione procura/delega'],
  ['urgenza', 'Emergenza / Urgenza'],
]
const TIPO_LABEL = Object.fromEntries(TIPI.map(t => [t[0], t[1]]))

export default function ModelliDetermina() {
  const { azienda } = useApp()
  const [organoAzienda, setOrganoAzienda] = useState(undefined)
  const [modelli, setModelli] = useState([])
  const [tipiCustom, setTipiCustom] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)       // null | {} nuovo | {...} esistente
  const [daEsistente, setDaEsistente] = useState(false)

  const isCda = organoAzienda === 'cda'
  // Suffisso AU/CdA nel titolo: per un'impresa individuale (nessun organo collegiale) si omette
  const suffissoAtto = azienda?.tipo_soggetto === 'individuale' ? '' : (isCda ? ' CdA' : ' AU')
  const nomeAtto = calcolaNomeAtto(organoAzienda, azienda?.tipo_soggetto)
  const tipiTutti = [...TIPI, ...tipiCustom.map(c => ({ id: 'custom:' + c.id, label: c.label }))]
  const labelDiTipo = t => TIPO_LABEL[t] || tipiTutti.find(x => x.id === t)?.label || t

  const load = useCallback(async () => {
    if (!azienda?.id) return
    setLoading(true)
    const { data: orgs } = await supabase.from('organi')
      .select('tipo').eq('azienda_id', azienda.id)
      .in('tipo', ['amministratore_unico', 'cda'])
    const org = orgs && orgs.length ? orgs[0].tipo : null
    setOrganoAzienda(org)
    const [{ data }, { data: tc }] = await Promise.all([
      supabase.from('determina_template').select('*').eq('azienda_id', azienda.id)
        .eq('organo', org || 'amministratore_unico').order('created_at'),
      supabase.from('determina_tipi_custom').select('*').eq('azienda_id', azienda.id)
        .eq('organo', org || 'amministratore_unico').order('created_at'),
    ])
    setModelli(data || [])
    setTipiCustom(tc || [])
    setLoading(false)
  }, [azienda])

  useEffect(() => { load() }, [load])

  async function elimina(m) {
    if (!window.confirm(`Eliminare il modello "${m.nome}"?`)) return
    await supabase.from('determina_template').delete().eq('id', m.id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Modelli {calcolaNomeAtto(organoAzienda, azienda?.tipo_soggetto, { plurale: true })}{suffissoAtto}</h2>
            <p>Facsimile riutilizzabili per <strong>{azienda?.nome}</strong>: crea da zero o da un atto esistente</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setDaEsistente(true)}>↩ Crea da {nomeAtto} esistente</button>
            <button className="btn btn-primary" onClick={() => setEdit({})}>+ Nuovo modello</button>
          </div>
        </div>
      </div>

      {loading ? <div className="spinner" /> : modelli.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ fontSize: 36 }}>📝</div>
            <p>Nessun modello. Crealo da zero, oppure parti da una {nomeAtto} già preparata e trasformala in modello.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>Tipo</th><th>Impatti econ.</th><th></th></tr></thead>
              <tbody>
                {modelli.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.nome}</td>
                    <td style={{ fontSize: 12, color: '#666' }}>{m.tipo ? labelDiTipo(m.tipo) : '—'}</td>
                    <td style={{ fontSize: 12, color: '#666' }}>{m.con_analisi_economica ? 'Sì' : 'No'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm" onClick={() => setEdit(m)}>Modifica</button>
                        <button className="btn btn-sm btn-danger" onClick={() => elimina(m)}>Elimina</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edit !== null && (
        <ModelloEditor azienda={azienda} organo={organoAzienda || 'amministratore_unico'} modello={edit} tipiCustom={tipiCustom}
          onSaved={() => { setEdit(null); load() }} onClose={() => setEdit(null)} />
      )}

      {daEsistente && (
        <ScegliDeterminaModal azienda={azienda} organo={organoAzienda || 'amministratore_unico'} nomeAtto={nomeAtto}
          onScelta={(bozza) => { setDaEsistente(false); setEdit(bozza) }}
          onClose={() => setDaEsistente(false)} />
      )}
    </div>
  )
}

// ── Editor modello ──────────────────────────────────────────────────────
function ModelloEditor({ azienda, organo, modello, tipiCustom = [], onSaved, onClose }) {
  const editing = !!modello?.id
  const [nome, setNome] = useState(modello?.nome || '')
  const [tipo, setTipo] = useState(modello?.tipo || '')
  const [oggetto, setOggetto] = useState(modello?.oggetto || '')
  const [descrizione, setDescrizione] = useState(modello?.descrizione || '')
  const [conEco, setConEco] = useState(modello?.con_analisi_economica !== false)
  const [analisiFin, setAnalisiFin] = useState(modello?.analisi_finanziaria || '')
  const [analisiEco, setAnalisiEco] = useState(modello?.analisi_economica || '')
  const [alternative, setAlternative] = useState(modello?.alternative || '')
  const [area231, setArea231] = useState(modello?.area_231 || '')
  const rischi = modello?.rischi || []
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState(null)

  async function salva() {
    if (!nome.trim()) { setErrore('Dai un nome al modello.'); return }
    setSaving(true); setErrore(null)
    const payload = {
      azienda_id: azienda.id, organo, nome: nome.trim(), tipo: tipo || null,
      oggetto: oggetto || null, descrizione: descrizione || null,
      con_analisi_economica: conEco,
      analisi_finanziaria: conEco ? (analisiFin || null) : null,
      analisi_economica: conEco ? (analisiEco || null) : null,
      alternative: conEco ? (alternative || null) : null,
      area_231: area231 || null, rischi,
    }
    const { error } = editing
      ? await supabase.from('determina_template').update(payload).eq('id', modello.id)
      : await supabase.from('determina_template').insert(payload)
    setSaving(false)
    if (error) { setErrore(error.message); return }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
      <div className="card" style={{ width: 720, maxWidth: '96%', margin: 0, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <span className="card-title">{editing ? 'Modifica modello' : 'Nuovo modello'}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 2, minWidth: 220 }}>
            <label className="form-label">Nome del modello *</label>
            <input className="form-control" value={nome} onChange={e => setNome(e.target.value)} placeholder="es. Approvazione progetto di bilancio" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
            <label className="form-label">Tipo</label>
            <select className="form-control" value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="">— Tipo —</option>
              {TIPI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {tipiCustom.map(c => <option key={c.id} value={'custom:' + c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Oggetto</label>
          <input className="form-control" value={oggetto} onChange={e => setOggetto(e.target.value)} placeholder="Oggetto tipico dell'atto" />
        </div>
        <div className="form-group">
          <label className="form-label">Descrizione</label>
          <textarea className="form-control" value={descrizione} onChange={e => setDescrizione(e.target.value)} />
        </div>

        <div className="form-group" style={{ background: '#F7F8FA', borderRadius: 10, padding: '12px 14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5 }}>
            <input type="checkbox" checked={conEco} onChange={e => setConEco(e.target.checked)} />
            <span>Questo modello prevede <strong>analisi economica</strong></span>
          </label>
        </div>

        {conEco && (
          <>
            <div className="form-group">
              <label className="form-label">Analisi finanziaria</label>
              <textarea className="form-control" value={analisiFin} onChange={e => setAnalisiFin(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Analisi economica</label>
              <textarea className="form-control" value={analisiEco} onChange={e => setAnalisiEco(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Alternative considerate</label>
              <textarea className="form-control" value={alternative} onChange={e => setAlternative(e.target.value)} />
            </div>
          </>
        )}

        <div className="form-group">
          <label className="form-label">Area 231 (se applicabile)</label>
          <input className="form-control" value={area231} onChange={e => setArea231(e.target.value)} placeholder="es. Rapporti con la PA" />
        </div>

        {errore && <div className="alert alert-error" style={{ marginBottom: 12 }}>{errore}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={salva} disabled={saving}>{saving ? 'Salvataggio…' : 'Salva modello'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Modale: scegli una determina/delibera esistente da cui creare il modello ──
function ScegliDeterminaModal({ azienda, organo, nomeAtto, onScelta, onClose }) {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('determine').select('*')
        .eq('azienda_id', azienda.id).eq('organo', organo)
        .order('created_at', { ascending: false })
      setLista(data || [])
      setLoading(false)
    })()
  }, [azienda, organo])

  async function scegli(d) {
    // carico i rischi collegati
    const { data: rr } = await supabase.from('determina_rischi')
      .select('categoria, livello, mitigazione').eq('determina_id', d.id)
    onScelta({
      nome: `Modello da: ${d.oggetto || 'atto'}`,
      tipo: d.tipo || '',
      oggetto: d.oggetto || '',
      descrizione: d.descrizione || '',
      con_analisi_economica: d.con_analisi_economica !== false,
      analisi_finanziaria: d.analisi_finanziaria || '',
      analisi_economica: d.analisi_economica || '',
      alternative: d.alternative || '',
      area_231: d.area_231 || '',
      rischi: rr || [],
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
      <div className="card" style={{ width: 560, maxWidth: '95%', margin: 0, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <span className="card-title">Scegli la {nomeAtto} da usare come modello</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        {loading ? <div className="spinner" /> : lista.length === 0 ? (
          <p style={{ fontSize: 13, color: '#999' }}>Nessun atto registrato da cui partire.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Oggetto</th><th>Anno</th><th></th></tr></thead>
              <tbody>
                {lista.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.oggetto || '(senza oggetto)'}</td>
                    <td style={{ fontSize: 12, color: '#666' }}>{d.anno}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => scegli(d)}>Usa come modello</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 11, color: '#999', marginTop: 10 }}>
          I campi dell'istruttoria (tipo, oggetto, analisi, rischi) verranno copiati nel modello. Potrai rifinirlo prima di salvare.
        </div>
      </div>
    </div>
  )
}
