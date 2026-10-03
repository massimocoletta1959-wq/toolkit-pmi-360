import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Manovre sulle scorte e acquisti a lotto (CNDCEC §2.3): un incremento discrezionale delle giacenze o un
// acquisto a lotto e' un esborso aggiuntivo non correlato alla produzione corrente; una riduzione programmata
// delle scorte riduce gli acquisti. Entrano nel piano di cassa (con IVA) alla prossima generazione.
const TIPI = { incremento_scorte: 'Incremento scorte di sicurezza', acquisto_lotto: 'Acquisto a lotto economico', riduzione_scorte: 'Riduzione programmata delle scorte' }
const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })
const num = (v) => parseFloat(String(v).replace(',', '.'))
const vuota = () => ({ id: null, mese: '', tipo: 'incremento_scorte', importo: '', soggetto_iva: true, descrizione: '' })

export default function ManovreScorte({ aziendaId }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(null)
  const [errore, setErrore] = useState('')

  const carica = async () => {
    const { data } = await supabase.from('manovre_scorte').select('*').eq('azienda_id', aziendaId).order('mese')
    setLista(data || [])
  }
  useEffect(() => {
    if (aziendaId) carica()
    setForm(null)
  }, [aziendaId])

  const salva = async () => {
    setErrore('')
    if (!/^\d{4}-\d{2}$/.test(form.mese)) return setErrore('Indica il mese.')
    if (!(num(form.importo) > 0)) return setErrore('L\'importo (netto IVA) deve essere maggiore di 0.')
    const riga = { azienda_id: aziendaId, mese: form.mese, tipo: form.tipo, importo: num(form.importo), soggetto_iva: form.soggetto_iva, descrizione: form.descrizione.trim() || null }
    const { error } = form.id ? await supabase.from('manovre_scorte').update(riga).eq('id', form.id) : await supabase.from('manovre_scorte').insert({ id: crypto.randomUUID(), ...riga })
    if (error) return setErrore(error.message)
    setForm(null)
    carica()
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ color: '#1a3a5c', margin: 0, fontSize: 14 }}>Scorte e approvvigionamenti (CNDCEC §2.3)</h3>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>Manovre sulle giacenze e acquisti a lotto: uscite (o minori uscite) non correlate alla produzione corrente.</p>
          </div>
          {!form && (
            <button className="btn btn-primary btn-sm" onClick={() => setForm(vuota())}>
              + Nuova manovra
            </button>
          )}
        </div>

        {form && (
          <div style={{ marginTop: 12 }}>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-control" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  {Object.entries(TIPI).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Mese</label>
                <input type="month" className="form-control" value={form.mese} onChange={(e) => setForm({ ...form, mese: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Importo (€, netto IVA)</label>
                <input className="form-control" value={form.importo} onChange={(e) => setForm({ ...form, importo: e.target.value })} />
              </div>
            </div>
            <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
              <input type="checkbox" checked={form.soggetto_iva} onChange={(e) => setForm({ ...form, soggetto_iva: e.target.checked })} /> Soggetto a IVA
            </label>
            <input className="form-control" placeholder="Nota (opzionale)" value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} />
            {errore && <div className="alert alert-error" style={{ marginTop: 8 }}>{errore}</div>}
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={salva}>
                Salva
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => { setForm(null); setErrore('') }}>
                Annulla
              </button>
            </div>
          </div>
        )}

        {lista.length > 0 && (
          <table className="table" style={{ marginTop: 12, fontSize: 12 }}>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td>{r.mese}</td>
                  <td>{TIPI[r.tipo]}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {r.tipo === 'riduzione_scorte' ? '−' : '+'}
                    {fmt(r.importo)} € {r.soggetto_iva ? '+ IVA' : ''}
                  </td>
                  <td>{r.descrizione}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setForm({ id: r.id, mese: r.mese, tipo: r.tipo, importo: String(r.importo), soggetto_iva: r.soggetto_iva, descrizione: r.descrizione || '' })}>
                      ✏️
                    </button>{' '}
                    <button className="btn btn-danger btn-sm" onClick={async () => { if (window.confirm('Eliminare la manovra?')) { await supabase.from('manovre_scorte').delete().eq('id', r.id); carica() } }}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
