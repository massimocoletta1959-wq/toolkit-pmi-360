import React, { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'

export const RUOLI_STANDARD = [
  { sigla: 'DL',     nome: 'Direzione / Datore di Lavoro' },
  { sigla: 'AMM',    nome: 'Amministrazione' },
  { sigla: 'CG',     nome: 'Contabilità Generale' },
  { sigla: 'DC',     nome: 'Direzione Commerciale' },
  { sigla: 'ACQ',    nome: 'Acquisti e Contabilità Lavori / Subappalti' },
  { sigla: 'DTS',    nome: 'Direzione Tecnica Strutture' },
  { sigla: 'DTA',    nome: 'Direzione Tecnica Architettura' },
  { sigla: 'RC',     nome: 'Responsabili di Cantiere' },
  { sigla: 'HR',     nome: 'Responsabile Risorse Umane' },
  { sigla: 'RSPP',   nome: 'Responsabile Servizio Prevenzione e Protezione' },
  { sigla: 'RSGI',   nome: 'Responsabile Sistema di Gestione Integrato' },
  { sigla: 'MC',     nome: 'Medico Competente (esterno)' },
  { sigla: 'RLS',    nome: 'Rappresentante dei Lavoratori per la Sicurezza' },
  { sigla: 'SA8000', nome: 'Rappresentante dei Lavoratori SA8000' },
  { sigla: 'IT',     nome: 'Information Technology' },
]

// Ruoli standard per il settore SERVIZI
const RUOLI_SERVIZI = [
  { sigla: 'DL',   nome: 'Direzione / Datore di Lavoro' },
  { sigla: 'AMM',  nome: 'Amministrazione' },
  { sigla: 'CG',   nome: 'Contabilità Generale' },
  { sigla: 'DC',   nome: 'Direzione Commerciale' },
  { sigla: 'ACQ',  nome: 'Acquisti e Fornitori' },
  { sigla: 'DTS',  nome: 'Direzione Tecnica / Operativa' },
  { sigla: 'RC',   nome: 'Responsabile Commessa / Progetto' },
  { sigla: 'HR',   nome: 'Responsabile Risorse Umane' },
  { sigla: 'IT',   nome: 'Information Technology' },
  { sigla: 'RSGI', nome: 'Responsabile Sistema di Gestione Integrato' },
  { sigla: 'RSPP', nome: 'Responsabile Servizio Prevenzione e Protezione' },
  { sigla: 'DPO',  nome: 'Responsabile Protezione Dati (Privacy)' },
  { sigla: 'MC',   nome: 'Medico Competente (esterno)' },
  { sigla: 'RLS',  nome: 'Rappresentante dei Lavoratori per la Sicurezza' },
]

// Ruoli standard per il settore HOTEL
const RUOLI_HOTEL = [
  { sigla: 'DG',    nome: 'Direttore Generale' },
  { sigla: 'VD',    nome: 'Vice Direttore' },
  { sigla: 'DL',    nome: 'Direzione / Datore di Lavoro' },
  { sigla: 'AMM',   nome: 'Amministrazione & Finanza' },
  { sigla: 'HR',    nome: 'Responsabile Risorse Umane' },
  { sigla: 'IT',    nome: 'Information Technology' },
  { sigla: 'RSGI',  nome: 'Responsabile Qualità / SGI' },
  { sigla: 'RSPP',  nome: 'Responsabile Sicurezza (RSPP)' },
  { sigla: 'DPO',   nome: 'Responsabile Protezione Dati (Privacy)' },
  { sigla: 'RD',    nome: 'Rooms Division Manager' },
  { sigla: 'FOM',   nome: 'Front Office Manager' },
  { sigla: 'GOV',   nome: 'Governante / Executive Housekeeper' },
  { sigla: 'NIGHT', nome: 'Night Auditor' },
  { sigla: 'FBM',   nome: 'F&B Manager' },
  { sigla: 'CHEF',  nome: 'Executive Chef' },
  { sigla: 'MTR',   nome: 'Maître / Responsabile Sala' },
  { sigla: 'HACCP', nome: 'Responsabile HACCP' },
  { sigla: 'SPA',   nome: 'Spa Manager' },
  { sigla: 'MICE',  nome: 'Responsabile Eventi & Banqueting' },
  { sigla: 'REV',   nome: 'Revenue Manager' },
  { sigla: 'MAINT', nome: 'Responsabile Manutenzione & Impianti' },
  { sigla: 'SEC',   nome: 'Responsabile Security & Antincendio' },
  { sigla: 'GRM',   nome: 'Guest Relations Manager' },
  { sigla: 'MC',    nome: 'Medico Competente (esterno)' },
  { sigla: 'RLS',   nome: 'Rappresentante dei Lavoratori per la Sicurezza' },
]

// Set di ruoli standard in base al settore dell'azienda
export const RUOLI_STANDARD_PER_SETTORE = {
  Edilizia: RUOLI_STANDARD,
  Servizi:  RUOLI_SERVIZI,
  Hotel:    RUOLI_HOTEL,
}

// Classificazione di default in base alla sigla (poi correggibile a mano)
const FASCE = [
  ['governance', 'Governance'],
  ['core', 'Operative (Core)'],
  ['staff', 'Supporto (Staff)'],
]
const FASCIA_LABEL = Object.fromEntries(FASCE)

const SIGLE_GOVERNANCE = ['CDA', 'DL', 'DG', 'VD', 'DIR']
const SIGLE_STAFF = ['AMM', 'CG', 'HR', 'IT', 'RSPP', 'RSGI', 'DPO', 'MC', 'RLS', 'SA8000', 'HACCP', 'SEC', 'MAINT']
// tutto il resto (commerciale, tecnico, produzione, cantiere, ecc.) -> core
function fasciaDaSigla(sigla) {
  const s = (sigla || '').toUpperCase()
  if (SIGLE_GOVERNANCE.includes(s)) return 'governance'
  if (SIGLE_STAFF.includes(s)) return 'staff'
  return 'core'
}

export default function Organigramma() {
  const { azienda } = useApp()
  const [ruoli, setRuoli]     = useState([])
  const [membri, setMembri]   = useState([])
  const [team, setTeam]       = useState([])   // ruolo_team: membri aggiuntivi oltre al responsabile
  const [procedure, setProcedure] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuovo, setNuovo]     = useState(null)
  const [editNome, setEditNome] = useState(null)
  const [error, setError]     = useState(null)
  const [modoPagina, setModoPagina] = useState('organigramma')  // 'organigramma' | 'funzionigramma'
  const [promuovi, setPromuovi] = useState(null)  // ruolo per cui va scelto il nuovo responsabile
  const [importModal, setImportModal] = useState(false)
  const [organoAmm, setOrganoAmm] = useState(null)        // organo amministrativo reale (cda | amministratore_unico), da Governance
  const [componentiAmm, setComponentiAmm] = useState([])  // suoi componenti reali (organo_membri)

  const load = useCallback(async () => {
    setLoading(true)
    const [r, m, t, p, org] = await Promise.all([
      supabase.from('ruoli').select('*').eq('azienda_id', azienda.id).order('sigla'),
      supabase.from('membri').select('id, nome, cognome').eq('azienda_id', azienda.id).order('cognome'),
      supabase.from('ruolo_team').select('*').eq('azienda_id', azienda.id),
      supabase.from('procedure_azienda').select('codice, titolo, stato, ruolo_id').eq('azienda_id', azienda.id).not('ruolo_id', 'is', null),
      supabase.from('organi').select('id, tipo, nome').eq('azienda_id', azienda.id).in('tipo', ['cda', 'amministratore_unico']),
    ])
    setRuoli(r.data || [])
    setMembri(m.data || [])
    setTeam(t.data || [])
    setProcedure(p.data || [])
    const orgReale = (org.data || [])[0] || null
    setOrganoAmm(orgReale)
    if (orgReale) {
      const { data: comp } = await supabase.from('organo_membri')
        .select('membro_id, ruolo, membri(nome, cognome)').eq('organo_id', orgReale.id)
      setComponentiAmm(comp || [])
    } else {
      setComponentiAmm([])
    }
    setLoading(false)
  }, [azienda.id])

  const teamDiRuolo = (ruoloId) => team.filter(t => t.ruolo_id === ruoloId)
  const nomeMembro = (id) => {
    const m = membri.find(x => x.id === id)
    return m ? `${m.nome || ''} ${m.cognome || ''}`.trim() : null
  }

  useEffect(() => { load() }, [load])

  async function caricaStandard() {
    setLoading(true); setError(null)
    const esistenti = new Set(ruoli.map(r => r.sigla))
    const setRuoliStd = RUOLI_STANDARD_PER_SETTORE[azienda.settore] || RUOLI_STANDARD
    const payload = setRuoliStd.filter(r => !esistenti.has(r.sigla)).map(r => ({ ...r, azienda_id: azienda.id, fascia: fasciaDaSigla(r.sigla) }))
    if (payload.length > 0) {
      const { error: err } = await supabase.from('ruoli').insert(payload)
      if (err) setError(err.message)
    }
    load()
  }

  async function assegna(ruolo, membroId) {
    // Rimozione del responsabile con team non vuoto: va scelto chi lo sostituisce
    if (!membroId && ruolo.membro_id && teamDiRuolo(ruolo.id).length > 0) {
      setPromuovi(ruolo)
      return
    }
    // Se il nuovo responsabile era già nel team, lo tolgo da lì (evita doppia presenza)
    const eraNelTeam = team.find(t => t.ruolo_id === ruolo.id && t.membro_id === membroId)
    if (eraNelTeam) await supabase.from('ruolo_team').delete().eq('id', eraNelTeam.id)
    await supabase.from('ruoli').update({ membro_id: membroId || null }).eq('id', ruolo.id)
    load()
  }

  // Scelta del nuovo responsabile dopo la rimozione del precedente (tra i membri del team, o nessuno)
  async function promuoviResponsabile(ruolo, nuovoMembroId) {
    if (nuovoMembroId) {
      const riga = team.find(t => t.ruolo_id === ruolo.id && t.membro_id === nuovoMembroId)
      if (riga) await supabase.from('ruolo_team').delete().eq('id', riga.id)
    }
    await supabase.from('ruoli').update({ membro_id: nuovoMembroId || null }).eq('id', ruolo.id)
    setPromuovi(null); load()
  }

  async function aggiungiAlTeam(ruolo, membroId) {
    if (!membroId) return
    const { error: err } = await supabase.from('ruolo_team').insert({ azienda_id: azienda.id, ruolo_id: ruolo.id, membro_id: membroId })
    if (err) { setError(err.message); return }
    load()
  }

  async function rimuoviDalTeam(teamId) {
    await supabase.from('ruolo_team').delete().eq('id', teamId)
    load()
  }

  async function cambiaFascia(ruolo, fascia) {
    await supabase.from('ruoli').update({ fascia: fascia || null }).eq('id', ruolo.id)
    load()
  }
  async function cambiaParent(ruolo, parentId) {
    await supabase.from('ruoli').update({ parent_id: parentId || null }).eq('id', ruolo.id)
    load()
  }

  async function salvaNome(ruolo) {
    if (!editNome.nome.trim()) return
    await supabase.from('ruoli').update({ nome: editNome.nome.trim() }).eq('id', ruolo.id)
    setEditNome(null); load()
  }

  async function salvaNuovo() {
    if (!nuovo.sigla.trim() || !nuovo.nome.trim()) return
    const { error: err } = await supabase.from('ruoli').insert({
      azienda_id: azienda.id, sigla: nuovo.sigla.trim().toUpperCase(), nome: nuovo.nome.trim(),
      fascia: fasciaDaSigla(nuovo.sigla),
    })
    if (err) {
      setError(err.message.includes('duplicate') || err.message.includes('unique') ? 'Sigla già presente in questa azienda.' : err.message)
      return
    }
    setNuovo(null); setError(null); load()
  }

  async function elimina(id) {
    await supabase.from('ruoli').delete().eq('id', id)
    load()
  }

  const assegnati = ruoli.filter(r => r.membro_id).length
  const scoperti  = ruoli.length - assegnati

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>{modoPagina === 'funzionigramma' ? 'Funzionigramma' : 'Organigramma'}</h2>
          <p>{modoPagina === 'funzionigramma' ? 'Chi è responsabile di quali procedure' : 'Ruoli e funzioni aziendali — la base per procedure e responsabilità'}</p>
        </div>
        <div style={{ display: 'flex', border: '1px solid #D5DCE6', borderRadius: 8, overflow: 'hidden' }}>
          <button className="btn btn-sm" style={{ borderRadius: 0, background: modoPagina === 'organigramma' ? '#1A3A5C' : '#fff', color: modoPagina === 'organigramma' ? '#fff' : '#1A3A5C' }} onClick={() => setModoPagina('organigramma')}>Organigramma</button>
          <button className="btn btn-sm" style={{ borderRadius: 0, background: modoPagina === 'funzionigramma' ? '#1A3A5C' : '#fff', color: modoPagina === 'funzionigramma' ? '#fff' : '#1A3A5C' }} onClick={() => setModoPagina('funzionigramma')}>Funzionigramma</button>
        </div>
      </div>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
        <div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#1A3A5C' }}>{ruoli.length}</div>
          <div style={{ fontSize: 13, color: '#666' }}>Ruoli definiti</div>
        </div>
        <div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#27AE60' }}>{assegnati}</div>
          <div style={{ fontSize: 13, color: '#666' }}>Assegnati</div>
        </div>
        <div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: scoperti > 0 ? '#C0392B' : '#27AE60' }}>{scoperti}</div>
          <div style={{ fontSize: 13, color: '#666' }}>Scoperti</div>
        </div>
      </div>

      {/* Vista: organigramma a fasce/albero, oppure funzionigramma */}
      {!loading && ruoli.length > 0 && modoPagina === 'organigramma' && (
        <OrganigrammaVista ruoli={ruoli} membri={membri} team={team} azienda={azienda}
          organoAmm={organoAmm} componentiAmm={componentiAmm} />
      )}
      {!loading && ruoli.length > 0 && modoPagina === 'funzionigramma' && (
        <FunzionigrammaVista ruoli={ruoli} membri={membri} procedure={procedure} azienda={azienda} />
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">🏛️ Ruoli dell'azienda</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={caricaStandard}>⬇️ Carica i ruoli standard</button>
            <button className="btn btn-sm" onClick={() => setImportModal(true)}>📥 Importa da Excel</button>
            <button className="btn btn-sm btn-primary" onClick={() => { setNuovo({ sigla: '', nome: '' }); setError(null) }}>+ Ruolo</button>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

        {nuovo && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, padding: 12, background: '#F7F8FA', borderRadius: 8, alignItems: 'center' }}>
            <input className="form-control" style={{ width: 100 }} placeholder="Sigla" value={nuovo.sigla} onChange={e => setNuovo({ ...nuovo, sigla: e.target.value })} maxLength={6} />
            <input className="form-control" style={{ flex: 1 }} placeholder="Nome del ruolo (es. Responsabile Qualità)" value={nuovo.nome} onChange={e => setNuovo({ ...nuovo, nome: e.target.value })} />
            <button className="btn btn-sm btn-primary" onClick={salvaNuovo}>Salva</button>
            <button className="btn btn-sm" onClick={() => { setNuovo(null); setError(null) }}>Annulla</button>
          </div>
        )}

        {loading ? (
          <div className="empty-state"><p>Caricamento...</p></div>
        ) : ruoli.length === 0 ? (
          <div className="empty-state">
            <p>Nessun ruolo definito. Parti dai <strong>ruoli standard</strong> del Manuale delle Procedure, poi personalizza.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ruoli.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 8, background: r.membro_id ? '#F7FBF8' : '#FDF9F3', border: `1px solid ${r.membro_id ? '#CBE8D5' : '#F0E0C0'}` }}>
                <span style={{ fontWeight: 700, fontSize: 12, background: '#1A3A5C', color: 'white', padding: '3px 10px', borderRadius: 12, minWidth: 52, textAlign: 'center' }}>{r.sigla}</span>
                {editNome?.id === r.id ? (
                  <>
                    <input className="form-control" style={{ flex: 1 }} value={editNome.nome} onChange={e => setEditNome({ ...editNome, nome: e.target.value })} />
                    <button className="btn btn-sm btn-primary" onClick={() => salvaNome(r)}>✓</button>
                    <button className="btn btn-sm" onClick={() => setEditNome(null)}>×</button>
                  </>
                ) : (
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, cursor: 'pointer' }} title="Clicca per rinominare" onClick={() => setEditNome({ id: r.id, nome: r.nome })}>{r.nome}</span>
                )}
                <select className="form-control" style={{ width: 150 }} value={r.fascia || ''} onChange={e => cambiaFascia(r, e.target.value)} title="Fascia">
                  <option value="">— Fascia —</option>
                  {FASCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select className="form-control" style={{ width: 180 }} value={r.parent_id || ''} onChange={e => cambiaParent(r, e.target.value)} title="Riporta a (secondo livello)">
                  <option value="">— Primo livello —</option>
                  {ruoli.filter(x => x.id !== r.id && x.fascia === r.fascia).map(x => (
                    <option key={x.id} value={x.id}>↳ {x.sigla}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: '#999' }}>Responsabile</span>
                <select className="form-control" style={{ width: 200 }} value={r.membro_id || ''} onChange={e => assegna(r, e.target.value)}>
                  <option value="">— Non assegnato —</option>
                  {membri.map(m => <option key={m.id} value={m.id}>{m.nome} {m.cognome}</option>)}
                </select>
                <button className="btn btn-sm btn-icon btn-danger" onClick={() => elimina(r.id)}>🗑️</button>

                <div style={{ width: '100%', marginTop: 4, paddingTop: 8, borderTop: '1px dashed #E0E0E0', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#999' }}>Team:</span>
                  {teamDiRuolo(r.id).map(t => (
                    <span key={t.id} className="badge" style={{ background: '#EAF2FC', color: '#2B5FA5', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {nomeMembro(t.membro_id) || '—'}
                      <button onClick={() => rimuoviDalTeam(t.id)} title="Rimuovi dal team"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#C0392B', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                  <select className="form-control" style={{ width: 170, fontSize: 12 }} value=""
                    onChange={e => aggiungiAlTeam(r, e.target.value)}>
                    <option value="">+ Aggiungi al team</option>
                    {membri.filter(m => m.id !== r.membro_id && !teamDiRuolo(r.id).some(t => t.membro_id === m.id))
                      .map(m => <option key={m.id} value={m.id}>{m.nome} {m.cognome}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {membri.length === 0 && !loading && (
        <div className="alert alert-info" style={{ marginTop: 14 }}>
          💡 Non ci sono ancora membri in questa azienda: crea prima i membri in <strong>Membri</strong>, poi torna qui per assegnarli ai ruoli.
        </div>
      )}

      {promuovi && (
        <div className="modal-overlay" onClick={() => setPromuovi(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 className="modal-title" style={{ marginBottom: 8 }}>Chi diventa responsabile di {promuovi.sigla}?</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
              Stai rimuovendo {nomeMembro(promuovi.membro_id) || 'il responsabile attuale'}. Scegli chi prende il suo posto tra i membri del team, oppure lascia il ruolo scoperto.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {teamDiRuolo(promuovi.id).map(t => (
                <button key={t.id} className="btn btn-sm" style={{ justifyContent: 'flex-start' }}
                  onClick={() => promuoviResponsabile(promuovi, t.membro_id)}>
                  {nomeMembro(t.membro_id) || '—'}
                </button>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-sm" onClick={() => promuoviResponsabile(promuovi, null)}>Lascia il ruolo scoperto</button>
              <button className="btn" onClick={() => setPromuovi(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {importModal && (
        <ImportExcelModal azienda={azienda} ruoli={ruoli} membri={membri}
          onClose={() => setImportModal(false)} onDone={load} />
      )}
    </div>
  )
}

// ── Import membri da Excel/CSV ──────────────────────────────────────────
function ImportExcelModal({ azienda, ruoli, membri, onClose, onDone }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState(null)
  const [risultato, setRisultato] = useState(null)  // { importati, saltati, errori }

  function valore(row, ...nomiPossibili) {
    const chiave = Object.keys(row).find(k => nomiPossibili.includes(k.trim().toLowerCase()))
    return chiave != null ? String(row[chiave] ?? '').trim() : ''
  }

  async function elabora() {
    if (!file) return
    setLoading(true); setErrore(null); setRisultato(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const foglio = wb.Sheets[wb.SheetNames[0]]
      const righe = XLSX.utils.sheet_to_json(foglio, { defval: '' })

      const importati = [], saltati = [], errori = []
      const emailViste = new Set(membri.map(m => (m.email || '').trim().toLowerCase()).filter(Boolean))
      const respPerRuolo = {}
      ruoli.forEach(r => { respPerRuolo[r.id] = r.membro_id })

      for (let i = 0; i < righe.length; i++) {
        const numRiga = i + 2   // +1 per l'header, +1 perché i è 0-based
        try {
          const reparto = valore(righe[i], 'reparto').toUpperCase()
          const nome = valore(righe[i], 'nome')
          const cognome = valore(righe[i], 'cognome')
          const email = valore(righe[i], 'email').toLowerCase()

          if (!reparto) { errori.push({ riga: numRiga, motivo: 'Reparto mancante' }); continue }
          const ruolo = ruoli.find(r => (r.sigla || '').toUpperCase() === reparto)
          if (!ruolo) { errori.push({ riga: numRiga, motivo: `Reparto "${reparto}" non esiste per questa azienda` }); continue }
          if (!nome || !cognome) { errori.push({ riga: numRiga, motivo: 'Nome o cognome mancante' }); continue }
          if (email && emailViste.has(email)) { saltati.push({ riga: numRiga, motivo: `Email "${email}" già esistente in questa azienda` }); continue }

          const { data: nuovo, error: errIns } = await supabase.from('membri')
            .insert({ azienda_id: azienda.id, nome, cognome, email: email || null }).select().single()
          if (errIns) { errori.push({ riga: numRiga, motivo: errIns.message }); continue }
          if (email) emailViste.add(email)

          if (!respPerRuolo[ruolo.id]) {
            await supabase.from('ruoli').update({ membro_id: nuovo.id }).eq('id', ruolo.id)
            respPerRuolo[ruolo.id] = nuovo.id
          } else {
            await supabase.from('ruolo_team').insert({ azienda_id: azienda.id, ruolo_id: ruolo.id, membro_id: nuovo.id })
          }
          importati.push({ riga: numRiga, nome, cognome, reparto })
        } catch (e) {
          errori.push({ riga: numRiga, motivo: e.message || 'Errore imprevisto' })
        }
      }

      setRisultato({ importati, saltati, errori })
      onDone()
    } catch (e) {
      setErrore('File non leggibile: ' + (e.message || e))
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📥 Importa membri da Excel</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
          Il file (.xlsx, .xls o .csv) deve avere le colonne <strong>Reparto, Nome, Cognome, email</strong>. "Reparto" deve corrispondere alla sigla di un ruolo già esistente in questa azienda (es. AMM, IT).
        </p>

        {!risultato ? (
          <>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setFile(e.target.files?.[0] || null)} />
            {errore && <div className="alert alert-error" style={{ marginTop: 12 }}>{errore}</div>}
            <div className="modal-footer">
              <button className="btn" onClick={onClose}>Annulla</button>
              <button className="btn btn-primary" onClick={elabora} disabled={!file || loading}>{loading ? 'Importazione…' : 'Importa'}</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: '#D5F5E3', color: '#1E8449' }}>{risultato.importati.length} importati</span>
              <span className="badge" style={{ background: '#FEF9E7', color: '#856404' }}>{risultato.saltati.length} saltati</span>
              <span className="badge" style={{ background: '#FADBD8', color: '#C0392B' }}>{risultato.errori.length} errori</span>
            </div>
            {(risultato.saltati.length > 0 || risultato.errori.length > 0) && (
              <div style={{ maxHeight: 220, overflowY: 'auto', fontSize: 12.5, background: '#F7F8FA', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
                {risultato.saltati.map((s, i) => <div key={'s' + i} style={{ color: '#856404', padding: '2px 0' }}>Riga {s.riga}: saltata — {s.motivo}</div>)}
                {risultato.errori.map((e, i) => <div key={'e' + i} style={{ color: '#C0392B', padding: '2px 0' }}>Riga {e.riga}: errore — {e.motivo}</div>)}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>Chiudi</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Vista organigramma a tre fasce (Governance / Core / Staff) ────────────
const FASCE_VISTA = [
  { key: 'governance', label: 'Governance', colore: '#7F77DD', bg: '#EEEDFB' },
  { key: 'core',       label: 'Operative (Core)', colore: '#2B8A6B', bg: '#E8F6F0' },
  { key: 'staff',      label: 'Supporto (Staff)', colore: '#2B5FA5', bg: '#EAF2FC' },
]

function OrganigrammaVista({ ruoli, membri, team = [], azienda, organoAmm = null, componentiAmm = [] }) {
  const [vista, setVista] = useState('fasce')   // 'fasce' | 'albero'
  const nomeMembro = (id) => {
    const m = membri.find(x => x.id === id)
    return m ? `${m.nome || ''} ${m.cognome || ''}`.trim() : null
  }

  // Quando Governance ha un organo amministrativo reale, le vecchie righe "CdA/CDA..."
  // create a mano nell'organigramma (prima che esistesse questo collegamento) vanno
  // nascoste dalla resa grafica per evitare caselle duplicate: la casella reale la
  // sostituisce. Le righe restano comunque nella lista gestionale più sotto.
  const escludiDaOrganigramma = r => !!organoAmm && (r.sigla || '').toUpperCase().startsWith('CDA')
  const isCdaReale = organoAmm?.tipo === 'cda'
  const siglaOrgano = isCdaReale ? 'CdA' : 'AU'
  const titoloOrgano = isCdaReale ? 'Consiglio di Amministrazione' : 'Amministratore Unico'

  // Casella dell'organo amministrativo reale (sola lettura, da organi/organo_membri)
  const CasellaOrgano = () => (
    <div className="og-node">
      <div style={{
        border: '1.5px solid #CBD5E1', background: '#fff', borderRadius: 10, padding: '10px 14px',
        minWidth: 170, maxWidth: 240, textAlign: 'center', boxShadow: '0 1px 3px rgba(26,58,92,0.08)',
      }}>
        <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, background: '#1A3A5C', color: '#fff', padding: '2px 8px', borderRadius: 10, marginBottom: 5 }}>{siglaOrgano}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A3A5C', lineHeight: 1.25 }}>{titoloOrgano}</div>
        {componentiAmm.length === 0 ? (
          <div style={{ fontSize: 12, color: '#B9770E', marginTop: 4 }}>— Non assegnato —</div>
        ) : componentiAmm.map((c, i) => (
          <div key={c.membro_id} style={{ fontSize: i === 0 ? 12 : 11, color: i === 0 ? '#2B8A6B' : '#8A94A0', marginTop: i === 0 ? 4 : 2, lineHeight: 1.4 }}>
            {`${c.membri?.nome || ''} ${c.membri?.cognome || ''}`.trim()}{c.ruolo ? ` — ${c.ruolo}` : ''}
          </div>
        ))}
      </div>
    </div>
  )

  // Stampa / PDF dell'organigramma in A4 orizzontale
  function stampa() {
    const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const dataStr = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })

    // costruisce l'HTML ricorsivo di una casella e dei suoi figli
    const casellaHtml = (r) => {
      const persona = r.membro_id ? nomeMembro(r.membro_id) : null
      const teamMembri = team.filter(t => t.ruolo_id === r.id).map(t => nomeMembro(t.membro_id)).filter(Boolean)
      const figli = ruoli.filter(x => x.parent_id === r.id)
      const box = `<div class="box${persona ? '' : ' vuoto'}">
        <div class="sigla">${esc(r.sigla)}</div>
        <div class="nome">${esc(r.nome)}</div>
        <div class="persona">${persona ? esc(persona) : '— Non assegnato —'}</div>
        ${teamMembri.length > 0 ? `<div class="team">${teamMembri.map(t => `<div class="team-membro">${esc(t)}</div>`).join('')}</div>` : ''}
      </div>`
      if (figli.length === 0) return `<div class="nodo">${box}</div>`
      return `<div class="nodo">${box}
        <div class="linea-v"></div>
        <div class="figli">${figli.map(casellaHtml).join('')}</div>
      </div>`
    }

    const organoHtml = () => `<div class="nodo"><div class="box">
        <div class="sigla">${esc(siglaOrgano)}</div>
        <div class="nome">${esc(titoloOrgano)}</div>
        ${componentiAmm.length === 0 ? '<div class="persona">— Non assegnato —</div>' :
          componentiAmm.map(c => `<div class="persona">${esc(`${c.membri?.nome || ''} ${c.membri?.cognome || ''}`.trim())}${c.ruolo ? ` — ${esc(c.ruolo)}` : ''}</div>`).join('')}
      </div></div>`

    const primaFascia = FASCE_VISTA.find(x => (x.key === 'governance' && organoAmm) || ruoli.some(r => r.fascia === x.key))?.key
    const bande = FASCE_VISTA.map(f => {
      const mostraOrgano = f.key === 'governance' && !!organoAmm
      const nella = ruoli.filter(r => r.fascia === f.key && !escludiDaOrganigramma(r))
      const radici = nella.filter(r => !r.parent_id || !nella.some(x => x.id === r.parent_id))
      if (nella.length === 0 && !mostraOrgano) return ''
      const connettore = (vista === 'albero' && f.key !== primaFascia) ? '<div class="linea-tra"></div>' : ''
      return `${connettore}<div class="banda" style="background:${f.bg}">
        <div class="banda-tit" style="color:${f.colore}"><span class="dot" style="background:${f.colore}"></span>${f.label}</div>
        <div class="riga">${mostraOrgano ? organoHtml() : ''}${radici.map(casellaHtml).join('')}</div>
      </div>`
    }).join('')
    const contenuto = vista === 'albero'
      ? `<div class="albero">${bande}</div>`
      : bande

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Organigramma ${esc(azienda?.nome || '')}</title>
      <style>
        @page { size: A4 landscape; margin: 1.2cm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, Arial, sans-serif; color: #1A3A5C; margin: 0; }
        h1 { font-size: 18px; margin: 0 0 2px; }
        .sub { font-size: 12px; color: #8A94A0; margin-bottom: 16px; }
        .banda { border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; page-break-inside: avoid; }
        .banda-tit { font-size: 11px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 10px; }
        .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
        .riga { display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-start; }
        .nodo { display: flex; flex-direction: column; align-items: center; }
        .box { border: 1.5px solid #CBD5E1; background: #fff; border-radius: 10px; padding: 8px 12px; min-width: 150px; max-width: 210px; text-align: center; }
        .box.vuoto { border-color: #E5B84B; }
        .sigla { display: inline-block; font-size: 9px; font-weight: 700; background: #1A3A5C; color: #fff; padding: 2px 8px; border-radius: 10px; margin-bottom: 4px; }
        .nome { font-size: 12px; font-weight: 600; line-height: 1.2; }
        .persona { font-size: 11px; color: #2B8A6B; margin-top: 3px; }
        .box.vuoto .persona { color: #B9770E; }
        .team { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #E2E8F0; }
        .team-membro { font-size: 10px; color: #8A94A0; line-height: 1.4; }
        .linea-tra { width: 1.5px; height: 20px; background: #CBD5E1; margin: 0 auto; }
        .albero { display: flex; flex-direction: column; align-items: center; }
        .albero .banda { width: auto; max-width: 100%; display: inline-block; text-align: center; }
        .albero .riga { justify-content: center; }
        .linea-v { width: 1.5px; height: 12px; background: #CBD5E1; }
        .figli { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; border-top: 1.5px solid #CBD5E1; padding-top: 10px; }
      </style></head><body>
      <h1>Organigramma — ${esc(azienda?.nome || '')}</h1>
      <div class="sub">Aggiornato al ${dataStr}</div>
      ${contenuto}
      <script>window.onload = function(){ window.print(); }</script>
      </body></html>`)
    w.document.close()
  }

  // Casella singola (ruolo + persona), con i figli annidati sotto
  const Casella = ({ r, livello }) => {
    const persona = r.membro_id ? nomeMembro(r.membro_id) : null
    const teamMembri = team.filter(t => t.ruolo_id === r.id).map(t => nomeMembro(t.membro_id)).filter(Boolean)
    const figli = ruoli.filter(x => x.parent_id === r.id)
    return (
      <div className="og-node">
        <div style={{
          border: `1.5px solid ${persona ? '#CBD5E1' : '#E5B84B'}`,
          background: '#fff', borderRadius: 10, padding: '10px 14px', minWidth: 170, maxWidth: 240,
          textAlign: 'center', boxShadow: '0 1px 3px rgba(26,58,92,0.08)',
        }}>
          <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, background: '#1A3A5C', color: '#fff', padding: '2px 8px', borderRadius: 10, marginBottom: 5 }}>{r.sigla}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A3A5C', lineHeight: 1.25 }}>{r.nome}</div>
          <div style={{ fontSize: 12, color: persona ? '#2B8A6B' : '#B9770E', marginTop: 4 }}>
            {persona || '— Non assegnato —'}
          </div>
          {teamMembri.length > 0 && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #E2E8F0' }}>
              {teamMembri.map((nome, i) => (
                <div key={i} style={{ fontSize: 11, color: '#8A94A0', lineHeight: 1.5 }}>{nome}</div>
              ))}
            </div>
          )}
        </div>
        {figli.length > 0 && (
          <>
            <div className="og-connect" />
            <div className={`og-children${figli.length > 1 ? ' multi' : ''}`}>
              {figli.map(f => (
                <div key={f.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {figli.length > 1 && <div className="og-connect" style={{ height: 12, marginTop: -16 }} />}
                  <Casella r={f} livello={livello + 1} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <style>{`
        .og-node { display: flex; flex-direction: column; align-items: center; }
        .og-children { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; align-items: flex-start; position: relative; }
        .og-children.multi { border-top: 1.5px solid #CBD5E1; padding-top: 16px; }
        .og-connect { width: 1.5px; height: 16px; background: #CBD5E1; }
      `}</style>
      <div className="card-header">
        <span className="card-title">📊 Organigramma</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid #D5DCE6', borderRadius: 8, overflow: 'hidden' }}>
            <button className="btn btn-sm" style={{ borderRadius: 0, background: vista === 'fasce' ? '#7F77DD' : '#fff', color: vista === 'fasce' ? '#fff' : '#1A3A5C' }} onClick={() => setVista('fasce')}>Fasce</button>
            <button className="btn btn-sm" style={{ borderRadius: 0, background: vista === 'albero' ? '#7F77DD' : '#fff', color: vista === 'albero' ? '#fff' : '#1A3A5C' }} onClick={() => setVista('albero')}>Albero</button>
          </div>
          <button className="btn btn-sm" onClick={stampa}>🖨️ Stampa / PDF</button>
        </div>
      </div>

      {vista === 'albero' ? (
        <AlberoVista ruoli={ruoli} Casella={Casella} organoAmm={organoAmm} CasellaOrgano={CasellaOrgano} escludiDaOrganigramma={escludiDaOrganigramma} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {FASCE_VISTA.map(f => {
            const mostraOrgano = f.key === 'governance' && !!organoAmm
            const nella = ruoli.filter(r => r.fascia === f.key && !escludiDaOrganigramma(r))
            const radici = nella.filter(r => !r.parent_id || !nella.some(x => x.id === r.parent_id))
            if (nella.length === 0 && !mostraOrgano) return null
            return (
              <div key={f.key} style={{ background: f.bg, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: f.colore }} />
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: f.colore }}>{f.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {mostraOrgano && <CasellaOrgano />}
                  {radici.map(r => <Casella key={r.id} r={r} livello={0} />)}
                </div>
              </div>
            )
          })}
          {ruoli.every(r => !r.fascia) && (
            <div style={{ fontSize: 13, color: '#999' }}>Assegna una fascia ai ruoli (qui sotto) per vederli comparire nell'organigramma.</div>
          )}
        </div>
      )}
    </div>
  )
}

// Vista ad albero (Modo 2): le tre fasce impilate come livelli, collegate da linee
function AlberoVista({ ruoli, Casella, organoAmm = null, CasellaOrgano = null, escludiDaOrganigramma = () => false }) {
  const perFascia = (key) => {
    const nella = ruoli.filter(r => r.fascia === key && !escludiDaOrganigramma(r))
    return nella.filter(r => !r.parent_id || !nella.some(x => x.id === r.parent_id))
  }
  const livelli = FASCE_VISTA
    .map(f => ({ ...f, radici: perFascia(f.key), mostraOrgano: f.key === 'governance' && !!organoAmm }))
    .filter(l => l.radici.length > 0 || l.mostraOrgano)

  if (livelli.length === 0) {
    return <div style={{ fontSize: 13, color: '#999' }}>Assegna una fascia ai ruoli per vedere l'albero.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '8px 0' }}>
      {livelli.map((l, i) => (
        <React.Fragment key={l.key}>
          {i > 0 && <div style={{ width: 1.5, height: 22, background: '#CBD5E1' }} />}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: l.colore, marginBottom: 8 }}>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: l.colore, marginRight: 6 }} />{l.label}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', background: l.bg, borderRadius: 12, padding: '14px 16px', width: '100%' }}>
              {l.mostraOrgano && <CasellaOrgano />}
              {l.radici.map(r => <Casella key={r.id} r={r} livello={0} />)}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Vista Funzionigramma: per ogni ruolo, le procedure di cui è responsabile ──
function FunzionigrammaVista({ ruoli, membri, procedure, azienda }) {
  const nomeMembro = (id) => {
    const m = membri.find(x => x.id === id)
    return m ? `${m.nome || ''} ${m.cognome || ''}`.trim() : null
  }
  const procDiRuolo = (ruoloId) => procedure.filter(p => p.ruolo_id === ruoloId)

  // solo i ruoli che hanno almeno una procedura, ordinati per sigla
  const ruoliConProc = ruoli
    .map(r => ({ ...r, proc: procDiRuolo(r.id) }))
    .filter(r => r.proc.length > 0)
    .sort((a, b) => (a.sigla || '').localeCompare(b.sigla || ''))

  function stampa() {
    const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const dataStr = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
    const blocchi = ruoliConProc.map(r => {
      const persona = r.membro_id ? nomeMembro(r.membro_id) : null
      const righe = r.proc.map(p => `<tr><td class="cod">${esc(p.codice || '')}</td><td>${esc(p.titolo || '')}</td><td class="st">${esc(p.stato || '')}</td></tr>`).join('')
      return `<div class="ruolo">
        <div class="rt"><span class="sig">${esc(r.sigla)}</span> ${esc(r.nome)} ${persona ? '— <b>' + esc(persona) + '</b>' : '<span class="na">— non assegnato —</span>'}</div>
        <table><thead><tr><th>Codice</th><th>Procedura</th><th>Stato</th></tr></thead><tbody>${righe}</tbody></table>
      </div>`
    }).join('')
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Funzionigramma ${esc(azienda?.nome || '')}</title>
      <style>
        @page { size: A4 portrait; margin: 1.5cm; }
        body { font-family: -apple-system, Arial, sans-serif; color: #1A3A5C; }
        h1 { font-size: 18px; margin: 0 0 2px; } .sub { font-size: 12px; color: #8A94A0; margin-bottom: 18px; }
        .ruolo { margin-bottom: 18px; page-break-inside: avoid; }
        .rt { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
        .sig { display: inline-block; font-size: 10px; font-weight: 700; background: #1A3A5C; color: #fff; padding: 2px 8px; border-radius: 10px; }
        .na { color: #B9770E; font-weight: 400; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { text-align: left; background: #F2F5F9; padding: 5px 8px; font-size: 11px; color: #5B6673; }
        td { padding: 5px 8px; border-bottom: 1px solid #EEE; }
        .cod { font-weight: 700; color: #1D9E75; white-space: nowrap; } .st { color: #666; white-space: nowrap; }
      </style></head><body>
      <h1>Funzionigramma — ${esc(azienda?.nome || '')}</h1>
      <div class="sub">Chi è responsabile di quali procedure · aggiornato al ${dataStr}</div>
      ${blocchi || '<p style="font-size:13px;color:#999">Nessuna procedura con responsabile assegnato.</p>'}
      <script>window.onload=function(){window.print()}</script>
      </body></html>`)
    w.document.close()
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-header">
        <span className="card-title">🗂️ Funzionigramma</span>
        <button className="btn btn-sm" onClick={stampa}>🖨️ Stampa / PDF</button>
      </div>
      {ruoliConProc.length === 0 ? (
        <div className="empty-state">
          <p>Nessuna procedura ha ancora un responsabile assegnato. Assegna il responsabile alle procedure (in Procedure → colonna Responsabile) per popolare il funzionigramma.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ruoliConProc.map(r => {
            const persona = r.membro_id ? nomeMembro(r.membro_id) : null
            return (
              <div key={r.id} style={{ border: '1px solid #E8ECF2', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F7F8FA', borderBottom: '1px solid #E8ECF2' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#1A3A5C', color: '#fff', padding: '2px 9px', borderRadius: 10 }}>{r.sigla}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.nome}</span>
                  <span style={{ fontSize: 12, color: persona ? '#2B8A6B' : '#B9770E', marginLeft: 'auto' }}>{persona || '— non assegnato —'}</span>
                  <span style={{ fontSize: 12, color: '#8A94A0' }}>· {r.proc.length} {r.proc.length === 1 ? 'procedura' : 'procedure'}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th style={{ width: 110 }}>Codice</th><th>Procedura</th><th style={{ width: 120 }}>Stato</th></tr></thead>
                    <tbody>
                      {r.proc.map((p, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, color: '#1D9E75', fontSize: 12 }}>{p.codice}</td>
                          <td style={{ fontSize: 13 }}>{p.titolo}</td>
                          <td style={{ fontSize: 12, color: '#666' }}>{p.stato}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
