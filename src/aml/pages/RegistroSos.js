import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../App'
import { STATI_SOS, fmtData, fmtDataOra, oggiISO, sha256File, nomeUtente, percorsoFile } from '../lib/costanti'

// ============================================================
// Segnalazioni interne e registro SOS (procedura AML-09).
// Chiunque sia collegato all'azienda puo' inviare una segnalazione interna; il registro (istruttoria, decisione,
// invio alla UIF, anche le anomalie archiviate) lo legge e lo gestisce SOLO il Delegato SOS: la persona assegnata
// al ruolo DSOS dell'organigramma (regola applicata dal database).
// ============================================================

function ModaleIstruttoria({ sos, autore, onClose, onSalvato }) {
  const [f, setF] = useState({
    stato: sos.stato, istruttoria: sos.istruttoria || '', motivazione_decisione: sos.motivazione_decisione || '',
    data_decisione: sos.data_decisione || oggiISO(), protocollo_uif: sos.protocollo_uif || '', data_invio_uif: sos.data_invio_uif || '',
  })
  const [file, setFile] = useState(null)
  const [errore, setErrore] = useState(null)
  const [salva, setSalva] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const decisa = ['archiviata', 'inviata_uif'].includes(sos.stato)

  async function conferma() {
    const chiude = ['archiviata', 'inviata_uif'].includes(f.stato)
    if (chiude && f.motivazione_decisione.trim().length < 20) { setErrore('Scrivi la motivazione della decisione (anche per l\'archiviazione).'); return }
    if (f.stato === 'inviata_uif' && (!f.protocollo_uif.trim() || !f.data_invio_uif)) { setErrore('Indica protocollo e data di invio della SOS alla UIF.'); return }
    setSalva(true); setErrore(null)
    try {
      let allegati = sos.allegati || []
      if (file) {
        const path = percorsoFile(sos.azienda_id, 'sos', file.name)
        const sha = await sha256File(file)
        const up = await supabase.storage.from('aml-documenti').upload(path, file, { contentType: file.type || 'application/octet-stream' })
        if (up.error) throw up.error
        allegati = [...allegati, { nome: file.name, path, sha256: sha, caricato_il: new Date().toISOString(), caricato_da: autore }]
      }
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('aml_sos').update({
        stato: f.stato, istruttoria: f.istruttoria.trim() || null, allegati,
        motivazione_decisione: chiude ? f.motivazione_decisione.trim() : (f.motivazione_decisione.trim() || null),
        data_decisione: chiude ? f.data_decisione : null, decisa_da: chiude ? (sos.decisa_da || user.id) : null,
        protocollo_uif: f.stato === 'inviata_uif' ? f.protocollo_uif.trim() : null, data_invio_uif: f.stato === 'inviata_uif' ? f.data_invio_uif : null,
      }).eq('id', sos.id)
      if (error) throw error
      onSalvato()
    } catch (e) { setErrore(e.message); setSalva(false) }
  }
  async function apri(a) {
    const { data, error } = await supabase.storage.from('aml-documenti').createSignedUrl(a.path, 120)
    if (error) setErrore(error.message); else window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <h3 className="modal-title">Segnalazione del {fmtData(sos.data_segnalazione)}</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        {errore && <div className="alert alert-error">{errore}</div>}
        <div style={{ fontSize: 13, background: '#F7F8FA', padding: 10, borderRadius: 6, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>Segnalante: {sos.segnalante_nome || '—'}{sos.soggetto ? ` · soggetto: ${sos.soggetto}` : ''}</div>
          {sos.descrizione}
        </div>
        <div className="form-group"><label className="form-label">Istruttoria (approfondimenti, documenti esaminati, chiarimenti chiesti senza rivelarne la finalità)</label>
          <textarea className="form-control" rows={5} value={f.istruttoria} onChange={e => set('istruttoria', e.target.value)} disabled={decisa} /></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">Stato</label>
            <select className="form-control" value={f.stato} onChange={e => set('stato', e.target.value)} disabled={decisa}>
              {Object.entries(STATI_SOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Data della decisione</label>
            <input type="date" className="form-control" value={f.data_decisione} onChange={e => set('data_decisione', e.target.value)} disabled={decisa} /></div>
        </div>
        <div className="form-group"><label className="form-label">Motivazione della decisione</label>
          <textarea className="form-control" rows={3} value={f.motivazione_decisione} onChange={e => set('motivazione_decisione', e.target.value)} disabled={decisa}
            placeholder="Anche l'archiviazione va motivata: elementi esaminati e perché non ricorre il sospetto" /></div>
        {f.stato === 'inviata_uif' && (
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Protocollo Infostat-UIF</label><input className="form-control" value={f.protocollo_uif} onChange={e => set('protocollo_uif', e.target.value)} disabled={decisa} /></div>
            <div className="form-group"><label className="form-label">Data di invio</label><input type="date" className="form-control" value={f.data_invio_uif} onChange={e => set('data_invio_uif', e.target.value)} disabled={decisa} /></div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Documentazione istruttoria</label>
          {(sos.allegati || []).map((a, i) => (
            <div key={i} style={{ fontSize: 12 }}><span style={{ color: '#2B5FA5', cursor: 'pointer' }} onClick={() => apri(a)}>{a.nome}</span> · {fmtDataOra(a.caricato_il)} · <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{a.sha256?.slice(0, 16)}…</span></div>
          ))}
          <input type="file" style={{ marginTop: 6 }} onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
        {decisa && <div style={{ fontSize: 12, color: '#888' }}>Segnalazione decisa: si possono solo aggiungere documenti.</div>}
        <div className="modal-footer"><button className="btn" onClick={onClose}>Chiudi</button><button className="btn btn-primary" onClick={conferma} disabled={salva}>{salva ? 'Salvataggio…' : 'Salva'}</button></div>
      </div>
    </div>
  )
}

function NuovaSegnalazione({ aziende, aziendaPredefinita, autore, onInviata }) {
  const [f, setF] = useState({ azienda_id: aziendaPredefinita || aziende[0]?.id || '', soggetto: '', descrizione: '', data_segnalazione: oggiISO() })
  const [errore, setErrore] = useState(null)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  async function invia() {
    if (!f.azienda_id) { setErrore('Scegli l\'azienda.'); return }
    if (f.descrizione.trim().length < 20) { setErrore('Descrivi l\'operazione o il comportamento anomalo.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('aml_sos').insert({
      azienda_id: f.azienda_id, segnalante: user.id, segnalante_nome: autore, soggetto: f.soggetto.trim() || null,
      descrizione: f.descrizione.trim(), data_segnalazione: f.data_segnalazione,
    })
    if (error) { setErrore(error.message); return }
    setF(x => ({ ...x, soggetto: '', descrizione: '' })); setErrore(null)
    onInviata()
  }
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Nuova segnalazione interna al Delegato SOS</span></div>
      <p style={{ fontSize: 12, color: '#666' }}>Segnala senza ritardo un'operazione o un comportamento che sai, sospetti o hai motivo di sospettare legato a riciclaggio. La segnalazione è riservata: dopo l'invio la vede solo il Delegato SOS. È vietato informarne il cliente o terzi.</p>
      {errore && <div className="alert alert-error">{errore}</div>}
      <div className="grid-3">
        {aziende.length > 1 && (
          <div className="form-group"><label className="form-label">Azienda</label>
            <select className="form-control" value={f.azienda_id} onChange={e => set('azienda_id', e.target.value)}>
              {aziende.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select></div>
        )}
        <div className="form-group"><label className="form-label">Cliente / pratica</label><input className="form-control" value={f.soggetto} onChange={e => set('soggetto', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Data</label><input type="date" className="form-control" value={f.data_segnalazione} onChange={e => set('data_segnalazione', e.target.value)} /></div>
      </div>
      <div className="form-group"><label className="form-label">Cosa hai rilevato</label><textarea className="form-control" rows={4} value={f.descrizione} onChange={e => set('descrizione', e.target.value)} /></div>
      <button className="btn btn-primary" onClick={invia}>Invia al Delegato SOS</button>
    </div>
  )
}

export default function RegistroSos({ vistaMembro = false }) {
  const { azienda, profilo, session } = useApp()
  const autore = nomeUtente(profilo, session)
  const [dsos, setDsos] = useState([])          // aziende in cui l'utente e' Delegato SOS
  const [segnalabili, setSegnalabili] = useState([])
  const [righe, setRighe] = useState([])
  const [aperta, setAperta] = useState(null)
  const [messaggio, setMessaggio] = useState(null)
  const [carico, setCarico] = useState(true)

  const carica = useCallback(async () => {
    setCarico(true)
    const [d, u] = await Promise.all([supabase.rpc('aml_dsos_aziende'), supabase.rpc('aml_aziende_utente')])
    const idsD = (d.data || []).map(x => (typeof x === 'string' ? x : Object.values(x)[0]))
    const idsU = (u.data || []).map(x => (typeof x === 'string' ? x : Object.values(x)[0]))
    const tutti = [...new Set([...idsD, ...idsU])]
    const { data: az } = tutti.length ? await supabase.from('aziende').select('id,nome').in('id', tutti) : { data: [] }
    const nome = id => (az || []).find(a => a.id === id)?.nome || 'Azienda'
    const filtro = vistaMembro ? null : azienda?.id
    setDsos(idsD.filter(id => !filtro || id === filtro).map(id => ({ id, nome: nome(id) })))
    setSegnalabili(idsU.filter(id => !filtro || id === filtro).map(id => ({ id, nome: nome(id) })))
    const idsLettura = idsD.filter(id => !filtro || id === filtro)
    if (idsLettura.length) {
      const { data } = await supabase.from('aml_sos').select('*').in('azienda_id', idsLettura).order('data_segnalazione', { ascending: false })
      setRighe(data || [])
    } else setRighe([])
    setCarico(false)
  }, [azienda, vistaMembro])
  useEffect(() => { carica() }, [carica])

  function esportaCsv() {
    const t = [['Data', 'Segnalante', 'Soggetto', 'Descrizione', 'Istruttoria', 'Stato', 'Motivazione', 'Data decisione', 'Protocollo UIF', 'Data invio UIF', 'Documenti istruttoria']]
    righe.forEach(r => t.push([r.data_segnalazione, r.segnalante_nome, r.soggetto, r.descrizione, r.istruttoria, STATI_SOS[r.stato], r.motivazione_decisione, r.data_decisione, r.protocollo_uif, r.data_invio_uif, (r.allegati || []).map(a => `${a.nome} (${a.sha256})`).join(' | ')]))
    const csv = t.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `registro_sos_${oggiISO()}.csv`
    a.click()
  }

  if (carico) return <div className="spinner" />
  const sonoDsos = dsos.length > 0

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>{sonoDsos ? 'Registro SOS — riservato al Delegato' : 'Segnalazione interna AML'}</h2>
          <p>Procedura AML-09. {sonoDsos ? 'Anche le anomalie valutate e archiviate restano nel registro con la motivazione: la società deve poter spiegare come rileva e valuta le anomalie.' : 'Il registro delle segnalazioni è accessibile solo al Delegato SOS (ruolo DSOS dell\'organigramma).'}</p>
        </div>
        {sonoDsos && <button className="btn" onClick={esportaCsv} disabled={!righe.length}>⬇ Elenco SOS con istruttoria</button>}
      </div>
      {messaggio && <div className="alert alert-success" onClick={() => setMessaggio(null)}>{messaggio}</div>}

      {segnalabili.length > 0
        ? <NuovaSegnalazione aziende={segnalabili} aziendaPredefinita={vistaMembro ? null : azienda?.id} autore={autore}
            onInviata={() => { setMessaggio('Segnalazione inviata al Delegato SOS.'); carica() }} />
        : <div className="alert alert-info">Il modulo antiriciclaggio non è attivo per le tue aziende.</div>}

      {sonoDsos && (
        <div className="card table-wrap">
          <div className="card-header"><span className="card-title">Segnalazioni ricevute ({righe.length})</span></div>
          {!righe.length ? <p style={{ fontSize: 13, color: '#888' }}>Nessuna segnalazione.</p> : (
            <table>
              <thead><tr><th>Data</th>{dsos.length > 1 && <th>Azienda</th>}<th>Segnalante</th><th>Soggetto / descrizione</th><th>Stato</th><th>Decisione</th></tr></thead>
              <tbody>{righe.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setAperta(r)}>
                  <td>{fmtData(r.data_segnalazione)}</td>
                  {dsos.length > 1 && <td>{dsos.find(a => a.id === r.azienda_id)?.nome}</td>}
                  <td>{r.segnalante_nome}</td>
                  <td>{r.soggetto && <strong>{r.soggetto}</strong>}<div style={{ fontSize: 12, color: '#666' }}>{r.descrizione.slice(0, 140)}{r.descrizione.length > 140 ? '…' : ''}</div></td>
                  <td><span className="badge" style={['ricevuta', 'in_istruttoria'].includes(r.stato) ? { background: '#FCF3CF', color: '#7D6608' } : { background: '#EEE', color: '#555' }}>{STATI_SOS[r.stato]}</span></td>
                  <td style={{ fontSize: 12 }}>{r.data_decisione ? fmtData(r.data_decisione) : '—'}{r.protocollo_uif ? ` · prot. ${r.protocollo_uif}` : ''}</td>
                </tr>))}</tbody>
            </table>
          )}
        </div>
      )}
      {aperta && <ModaleIstruttoria sos={aperta} autore={autore} onClose={() => setAperta(null)} onSalvato={() => { setAperta(null); setMessaggio('Registro aggiornato.'); carica() }} />}
    </div>
  )
}
