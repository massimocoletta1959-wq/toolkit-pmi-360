import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../App'
import { CATEGORIE_DOC_AZIENDA, fmtData, fmtDataOra, oggiISO, sha256File, percorsoFile } from '../lib/costanti'

// Fascicolo AML dell'azienda: licenza, delibere di nomina, Manuale, autovalutazione, modulistica in bianco,
// formazione, controlli interni, comunicazioni al MEF. Con impronta SHA-256; non si cancellano, si annullano.
export default function DocumentiAziendaliAml() {
  const { azienda } = useApp()
  const [doc, setDoc] = useState([])
  const [f, setF] = useState({ categoria: 'licenza_tulps', descrizione: '', data_documento: '', scadenza: '' })
  const [file, setFile] = useState(null)
  const [errore, setErrore] = useState(null)
  const [messaggio, setMessaggio] = useState(null)
  const [salva, setSalva] = useState(false)
  const [chiaveFile, setChiaveFile] = useState(0)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  const carica = useCallback(async () => {
    if (!azienda?.id) return
    const { data, error } = await supabase.from('aml_documenti').select('*').eq('azienda_id', azienda.id).is('cliente_id', null).order('categoria').order('caricato_il', { ascending: false })
    if (error) setErrore(error.message)
    setDoc(data || [])
  }, [azienda])
  useEffect(() => { carica() }, [carica])

  async function carica_() {
    if (!file) { setErrore('Scegli il file.'); return }
    setSalva(true); setErrore(null)
    try {
      const sha = await sha256File(file)
      const path = percorsoFile(azienda.id, 'azienda', file.name)
      const up = await supabase.storage.from('aml-documenti').upload(path, file, { contentType: file.type || 'application/octet-stream' })
      if (up.error) throw up.error
      const { error } = await supabase.from('aml_documenti').insert({
        azienda_id: azienda.id, cliente_id: null, categoria: f.categoria, descrizione: f.descrizione.trim() || null,
        data_documento: f.data_documento || null, scadenza: f.scadenza || null, storage_path: path, nome_file: file.name, dimensione: file.size, sha256: sha,
      })
      if (error) throw error
      setFile(null); setChiaveFile(k => k + 1); setF(x => ({ ...x, descrizione: '', data_documento: '', scadenza: '' }))
      setMessaggio('Documento caricato.'); carica()
    } catch (e) { setErrore(e.message) }
    setSalva(false)
  }
  async function apri(d) {
    const { data, error } = await supabase.storage.from('aml-documenti').createSignedUrl(d.storage_path, 120)
    if (error) setErrore(error.message); else window.open(data.signedUrl, '_blank', 'noopener')
  }
  async function annulla(d) {
    const motivo = window.prompt('Motivo dell\'annullamento (il documento resta conservato):')
    if (!motivo || !motivo.trim()) return
    const { error } = await supabase.from('aml_documenti').update({ annullato: true, motivo_annullamento: motivo.trim() }).eq('id', d.id)
    if (error) setErrore(error.message); else carica()
  }

  const oggi = oggiISO()
  return (
    <div>
      <div className="page-header">
        <h2>Documenti aziendali AML</h2>
        <p>Il fascicolo AML dell'azienda, da esibire in ispezione: licenza, nomine, Manuale, autovalutazione, modulistica in bianco, formazione, controlli interni, comunicazioni al MEF.</p>
      </div>
      {errore && <div className="alert alert-error">{errore}</div>}
      {messaggio && <div className="alert alert-success" onClick={() => setMessaggio(null)}>{messaggio}</div>}
      <div className="card">
        <div className="card-header"><span className="card-title">Carica un documento</span></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">Categoria</label>
            <select className="form-control" value={f.categoria} onChange={e => set('categoria', e.target.value)}>
              {Object.entries(CATEGORIE_DOC_AZIENDA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Descrizione</label><input className="form-control" value={f.descrizione} onChange={e => set('descrizione', e.target.value)} placeholder={f.categoria === 'modulistica' ? 'Es. Questionario mandante v1.0 adottato il …' : ''} /></div>
        </div>
        <div className="grid-3">
          <div className="form-group"><label className="form-label">Data del documento</label><input type="date" className="form-control" value={f.data_documento} onChange={e => set('data_documento', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Scadenza (se prevista)</label><input type="date" className="form-control" value={f.scadenza} onChange={e => set('scadenza', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">File</label><input key={chiaveFile} type="file" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
        </div>
        <button className="btn btn-primary" onClick={carica_} disabled={salva}>{salva ? 'Caricamento…' : 'Carica'}</button>
      </div>

      {Object.entries(CATEGORIE_DOC_AZIENDA).map(([cat, etichetta]) => {
        const righe = doc.filter(d => d.categoria === cat)
        return (
          <div className="card" key={cat}>
            <div className="card-header"><span className="card-title">{etichetta}</span><span style={{ fontSize: 12, color: righe.some(d => !d.annullato) ? '#155724' : '#C0392B' }}>{righe.filter(d => !d.annullato).length ? `${righe.filter(d => !d.annullato).length} documento/i` : 'mancante'}</span></div>
            {righe.map(d => (
              <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, padding: '4px 0', borderTop: '1px solid #F0F0F0', opacity: d.annullato ? 0.5 : 1 }}>
                <span style={{ flex: 1 }}>{d.nome_file}{d.descrizione ? ` — ${d.descrizione}` : ''}{d.annullato && <span style={{ color: '#C0392B' }}> (annullato: {d.motivo_annullamento})</span>}</span>
                <span style={{ fontSize: 12, color: '#888' }}>{fmtData(d.data_documento)}</span>
                {d.scadenza && <span style={{ fontSize: 12, color: d.scadenza < oggi ? '#C0392B' : '#888' }}>scade {fmtData(d.scadenza)}</span>}
                <span style={{ fontSize: 11, color: '#aaa' }}>{fmtDataOra(d.caricato_il)}</span>
                <span title={d.sha256} style={{ fontSize: 10, fontFamily: 'monospace', color: '#aaa' }}>{d.sha256?.slice(0, 12)}…</span>
                <button className="btn btn-sm" onClick={() => apri(d)}>Apri</button>
                {!d.annullato && <button className="btn btn-sm" onClick={() => annulla(d)}>Annulla</button>}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
