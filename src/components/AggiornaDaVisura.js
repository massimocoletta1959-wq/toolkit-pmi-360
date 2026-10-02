import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

// ============================================================
// Aggiornamento dell'anagrafica di un'azienda già inserita da una visura
// camerale aggiornata: confronto campo per campo, si applica solo ciò che
// l'utente spunta. Organi, componenti e soci non vengono toccati.
// ============================================================

const CAMPI = [
  ['nome', 'Denominazione', a => a.denominazione],
  ['forma_giuridica', 'Forma giuridica', a => a.forma_giuridica],
  ['piva', 'Partita IVA', a => (a.partita_iva || '').replace(/[^0-9]/g, '') || null],
  ['codice_fiscale', 'Codice fiscale', a => a.codice_fiscale],
  ['rea', 'REA', a => a.rea],
  ['pec', 'PEC', a => a.pec],
  ['sede_via', 'Sede — indirizzo', a => a.sede_via],
  ['sede_cap', 'Sede — CAP', a => a.sede_cap],
  ['sede_comune', 'Sede — comune', a => a.sede_comune],
  ['sede_provincia', 'Sede — provincia', a => a.sede_provincia],
  ['capitale_sociale', 'Capitale sociale', a => a.capitale_sociale],
  ['data_costituzione', 'Data di costituzione', a => a.data_costituzione],
  ['ateco', 'Codice ATECO', a => a.ateco],
  ['attivita', 'Attività', a => a.attivita],
  ['oggetto_sociale', 'Oggetto sociale', a => a.oggetto_sociale],
  ['numero_dipendenti', 'Numero dipendenti', a => Number.isInteger(a.addetti_dipendenti) ? a.addetti_dipendenti : null],
]

const norm = v => (v == null ? '' : String(v)).trim().replace(/\s+/g, ' ').toLowerCase()
const mostra = (k, v) => {
  if (v == null || v === '') return <span style={{ color: '#bbb' }}>—</span>
  if (k === 'data_costituzione') return new Date(v + 'T00:00:00').toLocaleDateString('it-IT')
  return String(v)
}

export default function AggiornaDaVisura({ azienda, onChiudi, onAggiornata }) {
  const [stato, setStato] = useState('scelta')   // scelta | lettura | confronto | salvataggio
  const [errore, setErrore] = useState(null)
  const [diff, setDiff] = useState([])           // [{ k, label, attuale, nuovo, sel }]
  const [addetti, setAddetti] = useState(null)

  async function leggi(file) {
    if (!file) return
    setStato('lettura'); setErrore(null)
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result).split(',')[1])
        r.onerror = () => rej(new Error('lettura del file fallita'))
        r.readAsDataURL(file)
      })
      const { data, error } = await supabase.functions.invoke('extract-visura', { body: { pdf_base64: b64 } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const a = data.azienda || {}
      // controllo di coerenza: la visura deve essere della stessa azienda
      const pivaVisura = (a.partita_iva || '').replace(/[^0-9]/g, '')
      if (azienda.piva && pivaVisura && pivaVisura !== azienda.piva) {
        setErrore(`La visura è di un'altra azienda (P.IVA ${pivaVisura}, qui ${azienda.piva}).`); setStato('scelta'); return
      }
      const righe = CAMPI.map(([k, label, estrai]) => ({ k, label, attuale: azienda[k], nuovo: estrai(a) }))
        .filter(r => r.nuovo != null && r.nuovo !== '' && norm(r.nuovo) !== norm(r.attuale))
        .map(r => ({ ...r, sel: true }))
      setDiff(righe)
      setAddetti(Number.isInteger(a.addetti_dipendenti) ? { n: a.addetti_dipendenti, ind: a.addetti_indipendenti, data: a.addetti_data } : null)
      setStato('confronto')
    } catch (e) {
      setErrore('Non sono riuscito a leggere la visura: ' + (e.message || String(e))); setStato('scelta')
    }
  }

  async function applica() {
    const scelti = diff.filter(r => r.sel)
    if (scelti.length === 0) { onChiudi(); return }
    setStato('salvataggio'); setErrore(null)
    const patch = Object.fromEntries(scelti.map(r => [r.k, r.nuovo]))
    const { error } = await supabase.from('aziende').update(patch).eq('id', azienda.id)
    if (error) { setErrore(error.message); setStato('confronto'); return }
    onAggiornata()
  }

  const tutti = diff.length > 0 && diff.every(r => r.sel)
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && stato !== 'salvataggio' && onChiudi()}>
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <div className="modal-title">📄 Aggiorna da visura — {azienda.nome}</div>
          <button className="btn btn-sm" onClick={onChiudi} disabled={stato === 'salvataggio'}>✕</button>
        </div>
        {errore && <div className="alert alert-error" style={{ fontSize: 12.5 }}>{errore}</div>}

        {(stato === 'scelta' || stato === 'lettura') && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              Carica la visura camerale aggiornata (PDF): ti mostro le differenze con l'anagrafica attuale e scegli cosa aggiornare.
              Organi, componenti e soci non vengono modificati.
            </p>
            <label className="btn btn-primary" style={{ cursor: stato === 'lettura' ? 'default' : 'pointer' }}>
              {stato === 'lettura' ? 'Lettura della visura in corso…' : '📎 Scegli il PDF della visura'}
              <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={stato === 'lettura'}
                onChange={e => { leggi(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
        )}

        {(stato === 'confronto' || stato === 'salvataggio') && (<>
          {addetti && (
            <div style={{ fontSize: 12.5, color: '#555', marginBottom: 10 }}>
              Addetti in visura: <strong>{addetti.n} dipendenti</strong>
              {Number.isInteger(addetti.ind) ? ` e ${addetti.ind} indipendenti` : ''}
              {addetti.data ? ` (al ${new Date(addetti.data + 'T00:00:00').toLocaleDateString('it-IT')})` : ''}
            </div>
          )}
          {diff.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#1E8449' }}>✅ L'anagrafica è già allineata alla visura: nessuna differenza.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th style={{ width: 30 }}><input type="checkbox" checked={tutti} onChange={e => setDiff(d => d.map(r => ({ ...r, sel: e.target.checked })))} /></th>
                  <th>Campo</th><th>Attuale</th><th>Da visura</th>
                </tr></thead>
                <tbody>
                  {diff.map((r, i) => (
                    <tr key={r.k}>
                      <td><input type="checkbox" checked={r.sel} onChange={e => setDiff(d => d.map((x, j) => j === i ? { ...x, sel: e.target.checked } : x))} /></td>
                      <td style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' }}>{r.label}</td>
                      <td style={{ fontSize: 12.5, color: '#888', maxWidth: 260 }}>{mostra(r.k, r.attuale)}</td>
                      <td style={{ fontSize: 12.5, color: '#1A3A5C', maxWidth: 260 }}>{mostra(r.k, r.nuovo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="modal-footer">
            <button className="btn" onClick={onChiudi} disabled={stato === 'salvataggio'}>Annulla</button>
            {diff.length > 0 && (
              <button className="btn btn-primary" onClick={applica} disabled={stato === 'salvataggio' || !diff.some(r => r.sel)}>
                {stato === 'salvataggio' ? 'Salvataggio…' : `Aggiorna ${diff.filter(r => r.sel).length} camp${diff.filter(r => r.sel).length === 1 ? 'o' : 'i'}`}
              </button>
            )}
          </div>
        </>)}
      </div>
    </div>
  )
}
