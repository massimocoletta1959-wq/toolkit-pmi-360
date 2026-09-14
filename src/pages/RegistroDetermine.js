import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { etichettaAttiGovernance } from '../lib/modalitaSolo'

// Etichette leggibili per i tipi di determina (coerenti con lo schema della migrazione 54)
const TIPO_LABEL = {
  beni_strumentali: 'Beni strumentali',
  contratto: 'Contratto',
  operazione_finanziaria: 'Operazione finanziaria',
  adempimenti_contabili: 'Contabile / fiscale',
  personale: 'Personale',
  assunzione: 'Assunzione rilevante',
  consulenza: 'Incarico esterno',
  contenzioso: 'Contenzioso',
  rs_innovazione: 'R&S / innovazione',
  marketing: 'Marketing / eventi',
  immobiliare: 'Immobiliare',
  compliance: 'Sicurezza / compliance',
  procura: 'Procura / delega',
  urgenza: 'Urgenza',
  altro: 'Altro',
}

// Colori dei badge di stato
const STATO_STYLE = {
  bozza:    { background: '#FEF9E7', color: '#856404', label: 'Bozza' },
  firmata:  { background: '#E9F7EF', color: '#1E8449', label: 'Firmata' },
  annullata:{ background: '#FDEDEC', color: '#C0392B', label: 'Annullata' },
}

// 007/2026  (le bozze non hanno ancora numero → —/2026)
const numFmt = d => `${d.numero != null ? String(d.numero).padStart(3, '0') : '—'}/${d.anno}`

const eur = v => v == null ? '—'
  : '€ ' + Number(v).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const dataFmt = d => {
  const raw = d.data_firma || d.created_at
  return raw ? new Date(raw).toLocaleDateString('it-IT') : '—'
}

export default function RegistroDetermine() {
  const { azienda, apriDetermina, nuovaDetermina } = useApp()
  const [determine, setDetermine] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStato, setFilterStato] = useState('')
  const [search, setSearch] = useState('')
  const [organoAzienda, setOrganoAzienda] = useState(undefined) // undefined=caricamento, 'amministratore_unico'|'cda'|null

  const load = useCallback(async () => {
    if (!azienda?.id) return
    setLoading(true)
    // Pulizia bozze fantasma: elimino le provvisorie orfane di questa azienda
    try {
      const { data: orfane } = await supabase.from('determine')
        .select('id').eq('azienda_id', azienda.id).eq('provvisoria', true)
      const ids = (orfane || []).map(o => o.id)
      if (ids.length) {
        const { data: alg } = await supabase.from('determina_allegati')
          .select('storage_path').in('determina_id', ids)
        const paths = (alg || []).map(a => a.storage_path)
        if (paths.length) await supabase.storage.from('fascicoli').remove(paths)
        await supabase.from('determine').delete().in('id', ids)
      }
    } catch (_e) { /* pulizia best-effort */ }
    // Organo amministrativo ATTUALE dell'azienda (AU o CdA sono mutuamente esclusivi)
    const { data: orgs } = await supabase.from('organi')
      .select('tipo').eq('azienda_id', azienda.id)
      .in('tipo', ['amministratore_unico', 'cda'])
    const org = orgs && orgs.length ? orgs[0].tipo : null
    setOrganoAzienda(org)
    // Mostro le determine/delibere dell'organo attuale (escluse eventuali provvisorie)
    const { data } = await supabase
      .from('determine')
      .select('*')
      .eq('azienda_id', azienda.id)
      .eq('organo', org || 'amministratore_unico')
      .eq('provvisoria', false)
      .order('anno', { ascending: false })
      .order('numero', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
    setDetermine(data || [])
    setLoading(false)
  }, [azienda])

  useEffect(() => { load() }, [load])

  const filtered = determine.filter(d => {
    if (filterStato && d.stato !== filterStato) return false
    if (search && !(d.oggetto || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Etichette adattive in base all'organo attuale
  const isCda = organoAzienda === 'cda'
  const titoloRegistro = etichettaAttiGovernance(organoAzienda, azienda?.tipo_soggetto)
  const sottotitoloRegistro = isCda
    ? 'Delibere del Consiglio di Amministrazione di'
    : "Determine dell'Amministratore Unico di"
  const nuovoLabel = isCda ? '+ Nuova delibera' : '+ Nuova determina'
  const nFirmate = determine.filter(d => d.stato === 'firmata').length
  const nBozze   = determine.filter(d => d.stato === 'bozza').length
  const valFirmate = determine
    .filter(d => d.stato === 'firmata' && d.valore != null)
    .reduce((s, d) => s + Number(d.valore), 0)

  return (
    <div>
      {organoAzienda === null && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          Questa azienda non ha un organo amministrativo (Amministratore Unico o CdA). Crealo nella sezione Organi per gestire le determine/delibere.
        </div>
      )}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>{titoloRegistro}</h2>
            <p>{sottotitoloRegistro} <strong>{azienda?.nome}</strong> · numerazione progressiva, registro immodificabile</p>
          </div>
          <button className="btn btn-primary" onClick={() => nuovaDetermina(organoAzienda)}>{nuovoLabel}</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{determine.length}</div><div className="stat-label">{isCda ? 'Delibere totali' : 'Determine totali'}</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#1E8449' }}>{nFirmate}</div><div className="stat-label">{isCda ? 'Protocollate' : 'Firmate'}</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#856404' }}>{nBozze}</div><div className="stat-label">Bozze aperte</div></div>
        <div className="stat-card"><div className="stat-num" style={{ fontSize: 20 }}>{eur(valFirmate)}</div><div className="stat-label">{isCda ? 'Valore protocollato' : 'Valore firmato'}</div></div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <input className="form-control" style={{ maxWidth: 240 }} placeholder="🔍 Cerca per oggetto..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-control" style={{ maxWidth: 180 }} value={filterStato} onChange={e => setFilterStato(e.target.value)}>
            <option value="">Tutti gli stati</option>
            <option value="bozza">Bozze</option>
            <option value="firmata">{isCda ? 'Protocollate' : 'Firmate'}</option>
            <option value="annullata">Annullate</option>
          </select>
          {(filterStato || search) && <button className="btn btn-sm" onClick={() => { setFilterStato(''); setSearch('') }}>✕ Reimposta</button>}
        </div>

        {loading ? <div className="spinner" /> : filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 36 }}>📚</div>
            <p>{determine.length === 0
              ? 'Nessuna determina registrata. Clicca "+ Nuova determina" per crearne una.'
              : 'Nessuna determina corrisponde ai filtri.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>N.</th><th>Oggetto</th><th>Tipo</th><th>Data</th><th>Valore</th><th>Stato</th>
              </tr></thead>
              <tbody>
                {filtered.map(d => {
                  const st = STATO_STYLE[d.stato] || STATO_STYLE.bozza
                  return (
                    <tr key={d.id} onClick={() => apriDetermina(d.id)} style={{ cursor: 'pointer' }}
                      title={d.stato === 'bozza' ? 'Riprendi la bozza' : 'Apri in sola lettura'}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>{numFmt(d)}</td>
                      <td style={{ maxWidth: 320, fontWeight: 600 }}>{d.oggetto}</td>
                      <td style={{ fontSize: 12, color: '#666' }}>{TIPO_LABEL[d.tipo] || d.tipo}</td>
                      <td style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>{dataFmt(d)}</td>
                      <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{eur(d.valore)}</td>
                      <td><span className="badge" style={{ background: st.background, color: st.color }}>{st.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
