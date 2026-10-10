import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { blocchiDaTesto, partiInLinea } from '../lib/testoFormattato'

const fmtData = (iso) => (iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

function InLinea({ testo }) {
  return partiInLinea(testo).map((p, i) => (p.grassetto ? <strong key={i}>{p.testo}</strong> : <React.Fragment key={i}>{p.testo}</React.Fragment>))
}

// Testo di un documento legale (Markdown semplice, vedi lib/testoFormattato)
export function TestoDocumento({ testo }) {
  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#26313d' }}>
      {blocchiDaTesto(testo).map((b, i) => {
        if (b.tipo === 'h1') return <h2 key={i} style={{ fontSize: 18, color: '#1A3A5C', margin: '4px 0 10px' }}><InLinea testo={b.testo} /></h2>
        if (b.tipo === 'h2') return <h3 key={i} style={{ fontSize: 15, color: '#1A3A5C', margin: '16px 0 6px' }}><InLinea testo={b.testo} /></h3>
        if (b.tipo === 'h3') return <h4 key={i} style={{ fontSize: 14, color: '#1A3A5C', margin: '12px 0 4px' }}><InLinea testo={b.testo} /></h4>
        if (b.tipo === 'ul' || b.tipo === 'ol') {
          const Lista = b.tipo
          return <Lista key={i} style={{ margin: '4px 0 10px', paddingLeft: 22 }}>{b.voci.map((v, k) => <li key={k} style={{ marginBottom: 3 }}><InLinea testo={v} /></li>)}</Lista>
        }
        return <p key={i} style={{ margin: '0 0 10px' }}><InLinea testo={b.testo} /></p>
      })}
    </div>
  )
}

// Pagina bloccante: documenti in vigore non ancora accettati dall'utente. Si entra nel portale solo dopo aver
// spuntato ogni documento; l'accettazione (con IP, browser e impronta del testo) la registra il database.
export function AccettazioneDocumenti({ documenti, onAccettati, onEsci }) {
  const [spuntati, setSpuntati] = useState({})
  const [aperto, setAperto] = useState(documenti[0]?.id)
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState('')
  const tutti = documenti.every((d) => spuntati[d.id])

  const conferma = async () => {
    setSalvando(true)
    setErrore('')
    const { error } = await supabase.rpc('accetta_documenti', { p_ids: documenti.map((d) => d.id) })
    setSalvando(false)
    if (error) return setErrore(`Registrazione non riuscita: ${error.message}. Riprova.`)
    onAccettati()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '32px 16px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, color: '#1A3A5C', marginBottom: 6 }}>Prima di continuare</h1>
        <p style={{ color: '#5f6b7a', fontSize: 14, marginBottom: 18 }}>
          {documenti.length === 1 ? 'Leggi il documento qui sotto' : `Leggi i ${documenti.length} documenti qui sotto`} e conferma per accedere al portale. Potrai rileggerli in ogni momento da «Privacy e documenti legali».
        </p>
        {documenti.map((d) => (
          <div key={d.id} className="card" style={{ marginBottom: 14 }}>
            <div className="card-body">
              <button type="button" onClick={() => setAperto(aperto === d.id ? null : d.id)}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#1A3A5C', fontSize: 15 }}>{d.titolo}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>versione {d.versione} {aperto === d.id ? '▾' : '▸'}</span>
              </button>
              {aperto === d.id && (
                <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #e3e8ee', borderRadius: 8, padding: '14px 16px', margin: '12px 0', background: '#fff' }}>
                  <TestoDocumento testo={d.testo} />
                </div>
              )}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!spuntati[d.id]} onChange={(e) => setSpuntati({ ...spuntati, [d.id]: e.target.checked })} />
                {d.formula} «{d.titolo}» (versione {d.versione})
              </label>
            </div>
          </div>
        ))}
        {errore && <div className="alert alert-error" style={{ marginBottom: 12 }}>{errore}</div>}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn btn-primary" disabled={!tutti || salvando} onClick={conferma}>{salvando ? 'Registrazione…' : 'Conferma e accedi'}</button>
          <button className="btn btn-outline" disabled={salvando} onClick={onEsci}>Esci</button>
        </div>
      </div>
    </div>
  )
}

// Finestra di consultazione: documenti in vigore e quando l'utente li ha accettati
export function FinestraDocumentiLegali({ onChiudi }) {
  const [documenti, setDocumenti] = useState(null)
  const [accettazioni, setAccettazioni] = useState({})
  const [aperto, setAperto] = useState(null)

  useEffect(() => {
    (async () => {
      const [{ data: docs }, { data: acc }] = await Promise.all([
        supabase.from('documenti_legali_in_vigore').select('*').order('tipo'),
        supabase.from('accettazioni_documenti').select('documento_id, accettato_il'),
      ])
      setDocumenti(docs || [])
      setAccettazioni(Object.fromEntries((acc || []).map((a) => [a.documento_id, a.accettato_il])))
    })()
  }, [])

  return (
    <div className="modal-overlay" onClick={onChiudi}>
      <div className="modal" style={{ maxWidth: 820, width: '95vw' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Privacy e documenti legali</h3>
          <button className="btn btn-icon" onClick={onChiudi}>✕</button>
        </div>
        <div>
          {documenti === null ? (
            <p style={{ color: '#6b7280' }}>Caricamento…</p>
          ) : documenti.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Nessun documento pubblicato.</p>
          ) : (
            documenti.map((d) => (
              <div key={d.id} style={{ borderBottom: '1px solid #eef1f4', padding: '10px 0' }}>
                <button type="button" onClick={() => setAperto(aperto === d.id ? null : d.id)}
                  style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', width: '100%', gap: 12 }}>
                  <span style={{ fontWeight: 600, color: '#1A3A5C' }}>{d.titolo} <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 12 }}>versione {d.versione}</span></span>
                  <span style={{ fontSize: 12, color: accettazioni[d.id] ? '#1D9E75' : '#6b7280', whiteSpace: 'nowrap' }}>
                    {accettazioni[d.id] ? `accettato il ${fmtData(accettazioni[d.id])}` : d.richiede_accettazione ? '' : 'da consultare'} {aperto === d.id ? '▾' : '▸'}
                  </span>
                </button>
                {aperto === d.id && (
                  <div style={{ marginTop: 10 }}>
                    <TestoDocumento testo={d.testo} />
                    <div style={{ fontSize: 11, color: '#8A94A0', marginTop: 6 }}>In vigore dal {fmtData(d.pubblicato_il)} · impronta SHA-256 {d.sha256}</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Link per la barra laterale: apre la finestra dei documenti legali
export function LinkDocumentiLegali() {
  const [aperta, setAperta] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAperta(true)}
        style={{ all: 'unset', cursor: 'pointer', display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.65)', textDecoration: 'underline', marginBottom: 8 }}>
        Privacy e documenti legali
      </button>
      {aperta && <FinestraDocumentiLegali onChiudi={() => setAperta(false)} />}
    </>
  )
}
