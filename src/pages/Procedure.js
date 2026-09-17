import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { AREE_PROCEDURE, MAPPA_SIGLE } from '../lib/procedure'
import { generaProcedura } from '../lib/generaProcedura'
import { repartiConMembri } from '../lib/reparti'
import EditorProcedura from './EditorProcedura'

const STATI = ['Bozza', 'Approvata', 'Adottata', 'Personalizzata', 'Non applicabile']
const STATO_STYLE = {
  'Bozza':           { bg: '#FCF3E3', color: '#B7791F' },
  'Approvata':       { bg: '#D1F2EB', color: '#0E6655' },
  'Adottata':        { bg: '#D5F5E3', color: '#155724' },
  'Personalizzata':  { bg: '#D6E8F7', color: '#1A3A5C' },
  'Non applicabile': { bg: '#EEE',    color: '#777' },
}

// ---------------------------------------------------------------------
// Modale: distribuisci una o più procedure per presa visione. Ogni persona
// selezionata riceve un ticket per ciascuna procedura, ma UNA SOLA email
// riassuntiva (non una a procedura) — se non ha ancora un account, la stessa
// email vale anche da invito a registrarsi.
// ---------------------------------------------------------------------
function DistribuzioneModal({ procs, suggeritiIds, sigleRilevanti, membri, aziendaId, onClose, onDone }) {
  const [sel, setSel] = useState(() => {
    const init = {}
    suggeritiIds.forEach(id => { init[id] = true })
    return init
  })
  const [tuttiReparti, setTuttiReparti] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [avvisaEmail, setAvvisaEmail] = useState(true)

  useEffect(() => { repartiConMembri(aziendaId).then(setTuttiReparti) }, [aziendaId])
  // Solo i reparti coinvolti dalle procedure selezionate: con tante procedure
  // di aree diverse, mostrare tutto l'organigramma sarebbe solo rumore.
  const reparti = tuttiReparti.filter(r => sigleRilevanti.has(r.sigla))

  const nomeMembro = m => `${m.nome || ''} ${m.cognome || ''}`.trim() || m.email || '—'
  const toggle = id => setSel(s => ({ ...s, [id]: !s[id] }))
  const selezionaReparto = (membroIds, valore) => setSel(s => {
    const next = { ...s }
    membroIds.forEach(id => { next[id] = valore })
    return next
  })
  const nSel = Object.values(sel).filter(Boolean).length

  async function invia() {
    const dest = membri.filter(m => sel[m.id])
    if (!dest.length) { setErr('Seleziona almeno una persona.'); return }
    setLoading(true); setErr(null)
    const righe = []
    dest.forEach(m => procs.forEach(p => righe.push({
      azienda_id: aziendaId,
      membro_id: m.id,
      titolo: `Presa visione ${p.codice}: ${p.titolo}`,
      istruzioni: `Prendi visione della procedura ${p.codice} — ${p.titolo}, poi segna il ticket come "Completato" per confermare.`,
      tipo: 'presa_visione',
      priorita: 'Media',
      stato: 'Aperto',
    })))
    const { data: creati, error } = await supabase.from('ticket').insert(righe).select('id, membro_id')
    if (error) { setLoading(false); setErr(error.message); return }

    // Un'unica email per membro con l'elenco di tutte le procedure, non una a procedura
    if (avvisaEmail && creati?.length) {
      try {
        const perMembro = {}
        creati.forEach(t => { (perMembro[t.membro_id] ||= []).push(t.id) })
        const { data: { session } } = await supabase.auth.getSession()
        await Promise.all(Object.entries(perMembro).map(([membro_id, ticket_ids]) =>
          fetch('https://vwbixmbbcutjcplskjvg.supabase.co/functions/v1/invia-presa-visione', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ membro_id, azienda_id: aziendaId, ticket_ids, procedure: procs.map(p => ({ codice: p.codice, titolo: p.titolo })) }),
          }).catch(() => {})
        ))
      } catch (e) { /* l'email e' best-effort */ }
    }

    setLoading(false)
    onDone(dest.length, procs.length)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div className="card" style={{ width: 480, maxWidth: '92%', margin: 0, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <span className="card-title">📤 Distribuisci per presa visione</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
          {procs.length === 1 ? (
            <><strong>{procs[0].codice}</strong> — {procs[0].titolo}</>
          ) : (
            <>
              <strong>{procs.length} procedure selezionate</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#777' }}>
                {procs.map(p => <li key={p.codice}>{p.codice} — {p.titolo}</li>)}
              </ul>
            </>
          )}
          <div style={{ marginTop: 8 }}>Seleziona le persone che devono prenderne visione: a ciascuna arriverà {procs.length === 1 ? 'un ticket' : `${procs.length} ticket, ma una sola email`}.</div>
        </div>

        {reparti.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {reparti.map(r => (
              <button key={r.sigla} className="btn btn-sm" style={{ fontSize: 11.5 }}
                onClick={() => selezionaReparto(r.membroIds, !Array.from(r.membroIds).every(id => sel[id]))}>
                {Array.from(r.membroIds).every(id => sel[id]) ? '✓ ' : '+ '}{r.sigla} ({r.membroIds.size})
              </button>
            ))}
          </div>
        )}

        {membri.length === 0 ? (
          <div className="alert alert-info">Non ci sono ancora persone in <strong>Membri</strong>: aggiungile prima di distribuire.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {membri.map(m => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: sel[m.id] ? '#EBF4FC' : '#FBFCFD', border: '1px solid #E8EAED', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!sel[m.id]} onChange={() => toggle(m.id)} />
                <span style={{ fontSize: 13 }}>{nomeMembro(m)}</span>
                {suggeritiIds.has(m.id) && <span className="badge" style={{ background: '#FEF9E7', color: '#856404', fontSize: 10 }}>responsabile</span>}
              </label>
            ))}
          </div>
        )}
        {err && <div style={{ background: '#FADBD8', color: '#C0392B', padding: '8px 10px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}
        {membri.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555', marginBottom: 12 }}>
            <input type="checkbox" checked={avvisaEmail} onChange={e => setAvvisaEmail(e.target.checked)} />
            Avvisa via email chi ha un indirizzo (una sola email, con tutte le procedure elencate)
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={invia} disabled={loading || nSel === 0}>{loading ? 'Invio…' : `Invia a ${nSel || ''} persone`}</button>
        </div>
      </div>
    </div>
  )
}

export default function Procedure() {
  const { azienda, profilo } = useApp()
  const [catalogo, setCatalogo] = useState([])   // procedure del settore + generico
  const [adozioni, setAdozioni] = useState({})   // codice -> record procedure_azienda
  const [ruoli, setRuoli]       = useState([])
  const [membri, setMembri]     = useState([])
  const [distProc, setDistProc] = useState(null)   // { procs, suggeritiIds }
  const [editProc, setEditProc] = useState(null)   // { proc, modo: 'azienda'|'standard' }
  const [msg, setMsg]           = useState(null)
  const [loading, setLoading]   = useState(true)
  const [areaSel, setAreaSel]   = useState('')
  const [error, setError]       = useState(null)
  const [selezionate, setSelezionate] = useState(new Set())   // codici procedura selezionati per la distribuzione multipla

  const load = useCallback(async () => {
    setLoading(true)
    const [p, r, m, c] = await Promise.all([
      supabase.from('procedure_azienda').select('*').eq('azienda_id', azienda.id),
      supabase.from('ruoli').select('id, sigla, nome, membro_id').eq('azienda_id', azienda.id).order('sigla'),
      supabase.from('membri').select('id, nome, cognome, email').eq('azienda_id', azienda.id).order('cognome'),
      supabase.from('procedure_catalogo').select('codice, area, titolo, funzioni, settore')
        .in('settore', [azienda.settore, 'generico'].filter(Boolean)).eq('attivo', true).order('codice'),
    ])
    const map = {}
    ;(p.data || []).forEach(x => { map[x.codice] = x })
    setAdozioni(map)
    setRuoli(r.data || [])
    setMembri(m.data || [])
    // Dedup per codice: se un codice esiste sia nel settore dell'azienda sia in
    // 'generico', tengo SOLO la versione del settore specifico (che ha priorità).
    const perCodice = {}
    ;(c.data || []).forEach(p => {
      const esist = perCodice[p.codice]
      if (!esist) { perCodice[p.codice] = p; return }
      // preferisci il settore dell'azienda rispetto al generico
      if (p.settore === azienda.settore) perCodice[p.codice] = p
    })
    const catalogoDedup = Object.values(perCodice).sort((a, b) => a.codice.localeCompare(b.codice))
    setCatalogo(catalogoDedup)
    setLoading(false)
  }, [azienda.id])

  useEffect(() => { load() }, [load])

  function ruoloSuggerito(proc) {
    const sigla = MAPPA_SIGLE[proc.funzioni[0]] || proc.funzioni[0]
    return ruoli.find(r => r.sigla === sigla)?.id || null
  }

  // Responsabili (assegnati o, in mancanza, suggeriti) di un gruppo di procedure:
  // pre-selezionati nella finestra di distribuzione, evidenziati col badge.
  function suggeritiPer(procs) {
    const ids = procs.map(p => ruoli.find(r => r.id === (adozioni[p.codice]?.ruolo_id ?? ruoloSuggerito(p)))?.membro_id)
    return new Set(ids.filter(Boolean))
  }

  // Sigle di reparto coinvolte da un gruppo di procedure (tutte le loro funzioni,
  // non solo la prima): filtra i pulsanti "seleziona per reparto" della distribuzione,
  // così con procedure di una sola area non compare l'intero organigramma.
  function sigleCoinvolte(procs) {
    const sigle = new Set()
    procs.forEach(p => p.funzioni.forEach(f => sigle.add(MAPPA_SIGLE[f] || f)))
    return sigle
  }

  function toggleSelezione(codice) {
    setSelezionate(s => {
      const next = new Set(s)
      next.has(codice) ? next.delete(codice) : next.add(codice)
      return next
    })
  }

  async function setCampo(proc, campo, valore) {
    setError(null)
    const esistente = adozioni[proc.codice]
    const payload = {
      azienda_id: azienda.id,
      codice: proc.codice,
      stato: campo === 'stato' ? valore : (esistente?.stato || 'Bozza'),
      ruolo_id: campo === 'ruolo_id' ? (valore || null) : (esistente?.ruolo_id ?? ruoloSuggerito(proc)),
    }
    const { error: err } = await supabase.from('procedure_azienda').upsert(payload, { onConflict: 'azienda_id,codice' })
    if (err) { setError(err.message); return }
    load()
  }

  async function adottaTutte() {
    setError(null); setLoading(true)
    const mancanti = catalogo.filter(p => !adozioni[p.codice]).map(p => ({
      azienda_id: azienda.id, codice: p.codice, stato: 'Adottata', ruolo_id: ruoloSuggerito(p),
    }))
    if (mancanti.length > 0) {
      const { error: err } = await supabase.from('procedure_azienda').insert(mancanti)
      if (err) setError(err.message)
    }
    load()
  }

  const lista = catalogo.filter(p => !areaSel || p.area === areaSel)
  const tot = catalogo.length
  const statoEff = p => adozioni[p.codice]?.stato || 'Bozza'
  const nBozza  = catalogo.filter(p => statoEff(p) === 'Bozza').length
  const nApprov = catalogo.filter(p => statoEff(p) === 'Approvata').length
  const nAdott  = catalogo.filter(p => statoEff(p) === 'Adottata').length
  const nPers   = catalogo.filter(p => statoEff(p) === 'Personalizzata').length
  const nNA     = catalogo.filter(p => statoEff(p) === 'Non applicabile').length
  const senzaResp = catalogo.filter(p => { const a = adozioni[p.codice]; return ['Approvata','Adottata','Personalizzata'].includes(a?.stato) && !a?.ruolo_id }).length

  return (
    <div>
      <div className="page-header">
        <h2>Procedure Aziendali</h2>
        <p>Il Manuale delle Procedure ({tot}) applicato all'azienda: adozione e responsabilità</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 18 }}>
        {[
          ['Bozze', nBozza, nBozza > 0 ? '#B7791F' : '#27AE60'],
          ['Approvate', nApprov, '#0E6655'],
          ['Adottate', nAdott, '#27AE60'],
          ['Personalizzate', nPers, '#2B5FA5'],
          ['Non applicabili', nNA, '#888'],
          ['Senza responsabile', senzaResp, senzaResp > 0 ? '#C0392B' : '#27AE60'],
        ].map(([lab, val, col]) => (
          <div key={lab} className="card" style={{ textAlign: 'center', marginBottom: 0, padding: '14px 8px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: col }}>{val}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{lab}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">📘 Catalogo procedure</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-control" style={{ width: 260 }} value={areaSel} onChange={e => setAreaSel(e.target.value)}>
              <option value="">Tutte le aree</option>
              {[...new Set(catalogo.map(p => p.area))].sort().map(sigla => (
                <option key={sigla} value={sigla}>{AREE_PROCEDURE[sigla] ? `${sigla} — ${AREE_PROCEDURE[sigla]}` : sigla}</option>
              ))}
            </select>
            <button className="btn btn-sm btn-primary" onClick={adottaTutte}>✓ Adotta tutte</button>
          </div>
        </div>

        {selezionate.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EBF4FC', border: '1px solid #CFE3F7', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#1A3A5C' }}><strong>{selezionate.size}</strong> procedure selezionate</span>
            <button className="btn btn-sm btn-primary" onClick={() => {
              const procs = lista.filter(p => selezionate.has(p.codice))
              setDistProc({ procs, suggeritiIds: suggeritiPer(procs), sigleRilevanti: sigleCoinvolte(procs) })
            }}>📤 Distribuisci le selezionate</button>
            <button className="btn btn-sm" onClick={() => setSelezionate(new Set())}>Annulla selezione</button>
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        {msg && <div className="alert alert-info" style={{ marginBottom: 12 }}>{msg}</div>}
        {ruoli.length === 0 && !loading && (
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            💡 L'organigramma è vuoto: carica prima i ruoli in <strong>Organigramma</strong> per poter assegnare i responsabili.
          </div>
        )}

        {loading ? (
          <div className="empty-state"><p>Caricamento...</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lista.map(p => {
              const a = adozioni[p.codice]
              const st = a?.stato || 'Bozza'
              const stile = STATO_STYLE[st] || { bg: '#FDF6E7', color: '#B7791F' }
              return (
                <div key={p.codice} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: selezionate.has(p.codice) ? '#EBF4FC' : '#FBFCFD', border: '1px solid #E8EAED', opacity: st === 'Non applicabile' ? 0.55 : 1 }}>
                  <input type="checkbox" checked={selezionate.has(p.codice)} disabled={st === 'Non applicabile'} onChange={() => toggleSelezione(p.codice)} />
                  <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#1A3A5C', minWidth: 96 }}>{p.codice}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.titolo}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{p.funzioni.join(' + ')}</div>
                  </div>
                  <select className="form-control" style={{ width: 150, background: stile.bg, color: stile.color, fontWeight: 600, fontSize: 12 }}
                          value={st} onChange={e => setCampo(p, 'stato', e.target.value)}>
                    {STATI.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select className="form-control" style={{ width: 200, fontSize: 12 }} disabled={st === 'Non applicabile'}
                          value={a?.ruolo_id || ''} onChange={e => setCampo(p, 'ruolo_id', e.target.value)}>
                    <option value="">— Responsabile —</option>
                    {ruoli.map(r => <option key={r.id} value={r.id}>{r.sigla} — {r.nome}</option>)}
                  </select>
                  <button className="btn btn-sm btn-icon" title="Personalizza per questa azienda"
                          disabled={st === 'Non applicabile'}
                          onClick={() => setEditProc({ proc: p, modo: 'azienda' })}>✏️</button>
                  {profilo?.proprietario && (
                    <button className="btn btn-sm btn-icon" title="Modifica lo STANDARD del settore (solo proprietario)"
                            onClick={() => setEditProc({ proc: p, modo: 'standard' })}>📚</button>
                  )}
                  <button className="btn btn-sm btn-icon" title="Genera documento personalizzato"
                          disabled={st === 'Non applicabile'}
                          onClick={() => generaProcedura(p, azienda)}>📄</button>
                  <button className="btn btn-sm btn-icon" title="Distribuisci per presa visione"
                          disabled={st === 'Non applicabile'}
                          onClick={() => setDistProc({ procs: [p], suggeritiIds: suggeritiPer([p]), sigleRilevanti: sigleCoinvolte([p]) })}>📤</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {distProc && (
        <DistribuzioneModal
          procs={distProc.procs}
          suggeritiIds={distProc.suggeritiIds}
          sigleRilevanti={distProc.sigleRilevanti}
          membri={membri}
          aziendaId={azienda.id}
          onClose={() => setDistProc(null)}
          onDone={(nPersone, nProcs) => {
            setDistProc(null); setSelezionate(new Set())
            setMsg(nProcs === 1
              ? `Distribuita "${distProc.procs[0].titolo}" a ${nPersone} persone: ${nPersone} email inviate. Le trovi in Procedure → Ticket.`
              : `Distribuite ${nProcs} procedure a ${nPersone} persone: ${nPersone} email inviate (una a testa, con tutte le procedure elencate).`)
            setTimeout(() => setMsg(null), 6000)
          }}
        />
      )}

      {editProc && (
        <EditorProcedura
          proc={editProc.proc}
          azienda={azienda}
          modo={editProc.modo}
          onClose={() => setEditProc(null)}
          onSaved={(isStd) => {
            setEditProc(null)
            load()
            setMsg(isStd ? 'Standard del settore aggiornato.' : 'Procedura personalizzata salvata per questa azienda.')
            setTimeout(() => setMsg(null), 6000)
          }}
        />
      )}
    </div>
  )
}
