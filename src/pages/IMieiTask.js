import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { generaProcedura } from '../lib/generaProcedura'
import { CATALOGO_PROCEDURE, AREE_PROCEDURE } from '../lib/procedure'

// Estrae il codice procedura (es. PRO-AMM-004) da un ticket di presa visione
function codiceDaTicket(t) {
  const src = `${t.procedura_id || ''} ${t.istruzioni || ''} ${t.titolo || ''}`
  // codice procedura: sigla area (2-6 lettere maiuscole) + trattino + numero, es. AMM-01, ACQ-3
  // (riconosce anche il vecchio formato PRO-AMM-004)
  const m = src.match(/\b[A-Z]{2,6}-\d{1,3}\b/)
  return m ? m[0] : null
}

// Un ticket è una "presa visione" se è di quel tipo o è legato a una procedura
function isPresaVisione(t) {
  return t.tipo === 'presa_visione' || !!t.procedura_id
}

// Un ticket è "governance" se legato a un organo o a un'adunanza/riunione,
// oppure se di tipo istruttorio del CdA (parere / delibera / incarico)
function isGovernance(t) {
  return !!t.organo_id || !!t.riunione_id || ['parere', 'delibera', 'incarico'].includes(t.tipo)
}

// Ricava l'area (es. AMM) di una presa visione, dal codice procedura → catalogo
function areaDaTicket(t) {
  const cod = codiceDaTicket(t)
  if (!cod) return null
  const p = CATALOGO_PROCEDURE.find(x => x.codice === cod)
  return p ? p.area : null
}

const STATO_COLORS = {
  'Aperto':        { bg: '#E6F1FB', color: '#1A3A5C' },
  'In lavorazione':{ bg: '#FEF9E7', color: '#856404' },
  'Completato':    { bg: '#D5F5E3', color: '#155724' },
  'Scaduto':       { bg: '#FADBD8', color: '#C0392B' },
}
const PRIOR_COLORS = {
  'Alta':  { bg: '#FADBD8', color: '#C0392B' },
  'Media': { bg: '#FDEBD0', color: '#E67E22' },
  'Bassa': { bg: '#D5F5E3', color: '#27AE60' },
}

function AggiornaModal({ ticket, autore, onSave, onClose }) {
  const [stato, setStato] = useState(ticket.stato)
  const [note, setNote]   = useState('')
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    // Scrive la nota di transizione solo se l'update dello stato è andato a buon fine.
    if (stato !== ticket.stato) {
      const { data: upd } = await supabase.from('ticket')
        .update({ stato }).eq('id', ticket.id).eq('stato', ticket.stato).select('id')
      if (upd && upd.length > 0) {
        await supabase.from('ticket_note').insert({
          ticket_id: ticket.id, autore, ruolo: 'sistema',
          testo: 'Stato: ' + ticket.stato + ' → ' + stato,
        })
      }
    }
    if (note.trim()) {
      await supabase.from('ticket_note').insert({
        ticket_id: ticket.id, autore, ruolo: 'membro',
        testo: note.trim(), stato_al_momento: stato,
      })
    }
    setLoading(false); onSave()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 className="modal-title">Aggiorna task</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ background: '#F7F8FA', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          <strong>{ticket.titolo}</strong>
          {ticket.aziende && <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>— {ticket.aziende.nome}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Stato</label>
          <select className="form-control" value={stato} onChange={e => setStato(e.target.value)}>
            {['Aperto','In lavorazione','Completato','Scaduto'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Aggiungi una nota (resta nello storico del ticket)</label>
          <textarea className="form-control" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Descrivi l'avanzamento, eventuali problemi o aggiornamenti..." />
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Salvataggio...' : 'Aggiorna'}</button>
        </div>
      </div>
    </div>
  )
}

// Documenti inviati in presa visione per una seduta (istantanea fissata all'invio): testo degli atti, con le
// analisi d'impatto, e allegati (comprese le simulazioni). La conferma si da' da qui, dopo averli visti.
function DocumentiInviati({ t, giaPresa, onConferma, confLoading, onClose }) {
  const [aperto, setAperto] = useState(0)
  const [errFile, setErrFile] = useState(null)
  const atti = t.documenti?.atti || []
  async function apriFile(f) {
    setErrFile(null)
    const { data, error } = await supabase.storage.from('fascicoli').createSignedUrl(f.storage_path, 300)
    if (error || !data?.signedUrl) { setErrFile(`«${f.nome_file}» non è più disponibile (sostituito dopo l'invio).`); return }
    window.open(data.signedUrl, '_blank')
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 820, width: '100%' }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{t.titolo}</h3>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Documenti inviati il {new Date(t.documenti.inviato_il || t.created_at).toLocaleString('it-IT')}{t.aziende?.nome ? ` · ${t.aziende.nome}` : ''}
            </div>
          </div>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ maxHeight: '62vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {atti.map((a, i) => (
            <div key={a.determina_id} style={{ border: '1px solid #E0E0E0', borderRadius: 8 }}>
              <button type="button" onClick={() => setAperto(aperto === i ? -1 : i)}
                style={{ width: '100%', textAlign: 'left', background: '#F7F8FA', border: 0, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13.5 }}>
                <span style={{ color: '#888', marginRight: 6 }}>{aperto === i ? '▾' : '▸'}</span>
                <strong>{a.oggetto}</strong> <span style={{ color: '#888', fontSize: 12 }}>— {a.numero}{a.allegati?.length ? ` · ${a.allegati.length} allegati` : ''}</span>
              </button>
              {aperto === i && (
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: '#333' }}>{a.testo || 'Testo non presente.'}</div>
                  {a.allegati?.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {a.allegati.map(f => (
                        <button key={f.id} type="button" className="btn btn-sm" onClick={() => apriFile(f)}>📎 {f.nome_file}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {errFile && <div className="alert alert-error" style={{ marginBottom: 0 }}>{errFile}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Chiudi</button>
          {giaPresa
            ? <span style={{ fontSize: 13, color: '#27AE60', fontWeight: 600, alignSelf: 'center' }}>✓ Presa visione confermata{t.data_presa_visione ? ' il ' + new Date(t.data_presa_visione).toLocaleString('it-IT') : ''}</span>
            : <button className="btn" style={{ background: '#27AE60', color: '#fff' }} disabled={confLoading} onClick={onConferma}>{confLoading ? 'Salvataggio…' : '✓ Ho esaminato i documenti: confermo la presa visione'}</button>}
        </div>
      </div>
    </div>
  )
}

function TicketCard({ t, onAggiorna, autore, onReload }) {
  const sc = STATO_COLORS[t.stato] || STATO_COLORS['Aperto']
  const pc = PRIOR_COLORS[t.priorita] || PRIOR_COLORS['Media']
  const codiceProc = (t.tipo === 'presa_visione' || t.procedura_id) ? codiceDaTicket(t) : null
  const presaVisione = t.tipo === 'presa_visione' || !!t.procedura_id
  const giaPresa = t.stato === 'Completato'
  const [conf, setConf] = React.useState({ loading: false, err: null })
  const [docAperti, setDocAperti] = React.useState(false)
  const conDocumenti = (t.documenti?.atti || []).length > 0
  const scadenzaDate = t.scadenza ? new Date(t.scadenza) : null
  const oggi = new Date()
  const giorniMancanti = scadenzaDate ? Math.ceil((scadenzaDate - oggi) / (1000*60*60*24)) : null
  const inScadenza = giorniMancanti !== null && giorniMancanti <= 3 && giorniMancanti >= 0 && t.stato !== 'Completato'

  async function confermaPresa() {
    setConf({ loading: true, err: null })
    const now = new Date().toISOString()
    // Aggiorna solo se il ticket è ancora nello stato attuale, e VERIFICA che
    // il salvataggio sia avvenuto (niente nota se lo stato non è cambiato).
    const { data: upd } = await supabase.from('ticket')
      .update({ stato: 'Completato', data_presa_visione: now })
      .eq('id', t.id).eq('stato', t.stato).select('id')
    if (!upd || upd.length === 0) {
      setConf({ loading: false, err: 'Non salvato — ricarica e riprova' })
      return
    }
    await supabase.from('ticket_note').insert({
      ticket_id: t.id, autore: autore || 'membro', ruolo: 'sistema', testo: 'Presa visione confermata',
    })
    setDocAperti(false)
    if (onReload) onReload()
  }

  return (
    <div className="card" style={{ borderLeft: `4px solid ${sc.color}`, marginBottom: 0, background: inScadenza ? '#FFFDF5' : 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{t.titolo}</span>
            {inScadenza && <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 10, background: '#FAEEDA', color: '#854F0B' }}>⏰ Scade in {giorniMancanti} giorni</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="badge" style={{ background: sc.bg, color: sc.color }}>{t.stato}</span>
            <span className="badge" style={{ background: pc.bg, color: pc.color }}>{t.priorita}</span>
            {t.scadenza && <span style={{ fontSize: 12, color: '#666' }}>📅 {new Date(t.scadenza).toLocaleDateString('it-IT')}</span>}
            {t.created_at && <span style={{ fontSize: 12, color: '#999' }}>🕓 Creato il {new Date(t.created_at).toLocaleDateString('it-IT')}</span>}
          </div>
          {t.rischi && <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>🔗 {t.rischi.descrizione}</div>}
          {t.istruzioni && (
            <div style={{ background: '#F7F8FA', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#444', lineHeight: 1.6, marginBottom: 8 }}>
              <strong style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>ISTRUZIONI</strong>
              {t.istruzioni}
            </div>
          )}
          {((t.ticket_note && t.ticket_note.length > 0) || t.note_membro) && (
            <div style={{ background: '#E8F4FD', borderRadius: 6, padding: '8px 14px', fontSize: 12, color: '#2B5FA5' }}>
              <strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>💬 STORICO AGGIORNAMENTI</strong>
              {[...(t.ticket_note || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(n => (
                <div key={n.id} style={{ marginBottom: 3, lineHeight: 1.5, fontStyle: n.ruolo === 'sistema' ? 'italic' : 'normal', opacity: n.ruolo === 'sistema' ? 0.75 : 1 }}>
                  <span style={{ color: '#7A9CC4' }}>{new Date(n.created_at).toLocaleDateString('it-IT')} {new Date(n.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span> — {n.ruolo === 'sistema' ? '🔄 ' : n.ruolo === 'consulente' ? <strong>👔 {n.autore}: </strong> : ''}{n.testo}
                </div>
              ))}
              {(!t.ticket_note || t.ticket_note.length === 0) && t.note_membro && <div>{t.note_membro}</div>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'stretch' }}>
          {codiceProc && (
            <button className="btn btn-sm" style={{ background: '#EBF4FC', color: '#2B5FA5', whiteSpace: 'nowrap' }}
              onClick={() => generaProcedura(CATALOGO_PROCEDURE.find(p => p.codice === codiceProc) || { codice: codiceProc }, t.aziende || {}, { ticketId: t.id })}>
              📄 Apri la procedura
            </button>
          )}
          {conDocumenti && (
            <button className="btn btn-sm" style={{ background: '#EBF4FC', color: '#2B5FA5', whiteSpace: 'nowrap' }} onClick={() => setDocAperti(true)}>
              📂 Documenti della seduta ({t.documenti.atti.length})
            </button>
          )}
          {docAperti && <DocumentiInviati t={t} giaPresa={giaPresa} confLoading={conf.loading} onConferma={confermaPresa} onClose={() => setDocAperti(false)} />}
          {presaVisione ? (
            giaPresa ? (
              <span style={{ fontSize: 12, color: '#27AE60', textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>
                ✓ Presa visione{t.data_presa_visione ? ' · ' + new Date(t.data_presa_visione).toLocaleDateString('it-IT') : ''}
              </span>
            ) : (
              <button className="btn btn-sm" style={{ background: '#27AE60', color: '#fff', whiteSpace: 'nowrap' }}
                disabled={conf.loading} onClick={conDocumenti ? () => setDocAperti(true) : confermaPresa}>
                {conf.loading ? 'Salvataggio…' : conDocumenti ? '✓ Esamina e conferma' : '✓ Confermo la presa visione'}
              </button>
            )
          ) : (
            <button className="btn btn-sm btn-primary" onClick={() => onAggiorna(t)} disabled={t.stato === 'Completato'}>
              {t.stato === 'Completato' ? '✓ Fatto' : 'Aggiorna'}
            </button>
          )}
          {conf.err && <div style={{ fontSize: 11, color: '#C0392B', textAlign: 'right' }}>{conf.err}</div>}
        </div>
      </div>
    </div>
  )
}

// Lista piatta di ticket: i completati scendono in fondo, sbiaditi.
function ListaTicket({ tasks, onAggiorna, autore, onReload }) {
  const ordinati = [...tasks].sort((a, b) => (a.stato === 'Completato' ? 1 : 0) - (b.stato === 'Completato' ? 1 : 0))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ordinati.map(t => (
        <div key={t.id} style={{ opacity: t.stato === 'Completato' ? 0.6 : 1 }}>
          <TicketCard t={t} onAggiorna={onAggiorna} autore={autore} onReload={onReload} />
        </div>
      ))}
    </div>
  )
}

export default function IMieiTask({ modo = 'task' }) {
  const proceduraView = modo === 'procedure'
  const governanceView = modo === 'governance'
  const { profilo, session } = useApp()
  const [tickets, setTickets]       = useState([])
  const [aziendeFiltro, setAziendeFiltro] = useState([]) // aziende disponibili
  const [aziendaSelezionata, setAziendaSelezionata] = useState('tutte')
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(null)
  const [filterStato, setFilterStato] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterArea, setFilterArea] = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    // Carica tutti i miei ticket via funzione SECURITY DEFINER: aggancia i
    // miei record membro e restituisce i ticket scavalcando la RLS.
    const { data: ticketJson } = await supabase.rpc('miei_ticket')
    const allTickets = Array.isArray(ticketJson) ? ticketJson : []
    setTickets(allTickets)

    // Estrai aziende uniche
    const azUniche = []
    const azIds = new Set()
    allTickets.forEach(t => {
      if (t.aziende && !azIds.has(t.aziende.id)) {
        azIds.add(t.aziende.id)
        azUniche.push(t.aziende)
      }
    })
    setAziendeFiltro(azUniche)
    setLoading(false)
  }, [profilo.id, session.user.id])

  useEffect(() => { load() }, [load])

  // Smistamento a tre vie:
  //  - governance: tutto ciò che è legato a un organo/adunanza
  //  - procedure: prese visione NON di governance
  //  - task: tutto il resto (operativo), NON di governance
  const ticketsModo = tickets.filter(t => {
    if (governanceView) return isGovernance(t)
    if (isGovernance(t)) return false
    return proceduraView ? isPresaVisione(t) : !isPresaVisione(t)
  })

  // Filtra per azienda, stato e (categoria rischio | area procedura)
  const filtered = ticketsModo.filter(t => {
    if (aziendaSelezionata !== 'tutte' && t.aziende?.id !== aziendaSelezionata) return false
    if (filterStato && t.stato !== filterStato) return false
    if (!proceduraView && !governanceView && filterCategoria && t.rischi?.categoria !== filterCategoria) return false
    if (proceduraView && filterArea && areaDaTicket(t) !== filterArea) return false
    return true
  })

  const aperti     = ticketsModo.filter(t => t.stato === 'Aperto').length
  const inLav      = ticketsModo.filter(t => t.stato === 'In lavorazione').length
  const completati = ticketsModo.filter(t => t.stato === 'Completato').length
  const multiAz    = aziendeFiltro.length > 1
  const areeDisponibili = [...new Set(ticketsModo.map(areaDaTicket).filter(Boolean))].sort()

  return (
    <div>
      <div className="page-header">
        <h2>{governanceView ? 'Governance' : proceduraView ? 'Le mie procedure' : 'I miei task'}</h2>
        <p>{governanceView ? 'Delibere da esaminare e incarichi del tuo organo' : proceduraView ? 'Procedure da prendere in visione' : 'Task operativi assegnati a te'}{multiAz ? ` — ${aziendeFiltro.length} aziende` : ''}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{ticketsModo.length}</div><div className="stat-label">Totali</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#1A3A5C' }}>{aperti}</div><div className="stat-label">{proceduraView ? 'Da leggere' : 'Da fare'}</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#856404' }}>{inLav}</div><div className="stat-label">In lavorazione</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#27AE60' }}>{completati}</div><div className="stat-label">{proceduraView ? 'Prese in visione' : 'Completati'}</div></div>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Selezione azienda — solo se multi-azienda */}
        {multiAz && (
          <select className="form-control" style={{ maxWidth: 220 }} value={aziendaSelezionata} onChange={e => setAziendaSelezionata(e.target.value)}>
            <option value="tutte">🏢 Tutte le aziende</option>
            {aziendeFiltro.map(az => (
              <option key={az.id} value={az.id}>{az.nome}</option>
            ))}
          </select>
        )}
        {[['','Tutti'],['Aperto','Da fare'],['In lavorazione','In lavorazione'],['Completato','Completati']].map(([v,l]) => (
          <button key={v} className={`btn btn-sm${filterStato === v ? ' btn-primary' : ''}`} onClick={() => setFilterStato(v)}>{l}</button>
        ))}
        {!proceduraView && (
          <select className="form-control" style={{ maxWidth: 220 }} value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)}>
            <option value="">Tutte le categorie rischio</option>
            {[...new Set(ticketsModo.map(t => t.rischi?.categoria).filter(Boolean))].sort().map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
        {proceduraView && areeDisponibili.length > 0 && (
          <select className="form-control" style={{ maxWidth: 260 }} value={filterArea} onChange={e => setFilterArea(e.target.value)}>
            <option value="">Tutte le aree</option>
            {areeDisponibili.map(a => (
              <option key={a} value={a}>{a} — {AREE_PROCEDURE[a] || a}</option>
            ))}
          </select>
        )}
        {!proceduraView && filterCategoria && <button className="btn btn-sm" onClick={() => setFilterCategoria('')}>✕</button>}
        {proceduraView && filterArea && <button className="btn btn-sm" onClick={() => setFilterArea('')}>✕</button>}
      </div>

      {loading ? <div className="spinner" /> : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ fontSize: 36 }}>{governanceView ? '⚖️' : proceduraView ? '📋' : '✅'}</div>
            <p>{ticketsModo.length === 0
              ? (governanceView ? 'Nessuna delibera o incarico dal tuo organo al momento.' : proceduraView ? 'Nessuna procedura da prendere in visione.' : 'Nessun task assegnato al momento.')
              : (governanceView ? 'Nessun elemento con questo filtro.' : proceduraView ? 'Nessuna procedura con questo filtro.' : 'Nessun task con questo filtro.')}</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {aziendaSelezionata === 'tutte' && multiAz ? (
            Object.entries(
              filtered.reduce((acc, t) => {
                const nome = t.aziende?.nome || 'Sconosciuta'
                if (!acc[nome]) acc[nome] = []
                acc[nome].push(t)
                return acc
              }, {})
            ).map(([nomeAz, tasks]) => (
              <div key={nomeAz} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1A3A5C' }}>🏢 {nomeAz}</span>
                  <span style={{ fontSize: 12, color: '#888', background: '#F0F0F0', padding: '2px 8px', borderRadius: 10 }}>{tasks.length}</span>
                </div>
                <ListaTicket tasks={tasks} onAggiorna={setModal} autore={profilo?.nome || session.user.email} onReload={load} />
              </div>
            ))
          ) : (
            <ListaTicket tasks={filtered} onAggiorna={setModal} autore={profilo?.nome || session.user.email} onReload={load} />
          )}
        </div>
      )}

      {modal && (
        <AggiornaModal ticket={modal} autore={profilo?.nome || session.user.email} onSave={() => { setModal(null); load() }} onClose={() => setModal(null)} />
      )}
    </div>
  )
}