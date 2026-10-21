import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { VOCI_PREVISTE, FREQUENZE, scadenzeMovimento, residuoMovimento } from '../lib/movimentiPrevisti'

// Movimenti di cassa previsti per i periodi futuri (rateizzazioni, acconti di imposta, finanziamenti attesi...):
// si inseriscono qui e la proiezione della Tesoreria li usa. I versamenti di imposte sul reddito sostituiscono,
// nello stesso mese, quelli calcolati dalla Tesoreria; le altre voci si sommano.

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const fmtData = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('it-IT') : '—')
const oggi = () => new Date().toISOString().slice(0, 10)
const VUOTO = { descrizione: '', direzione: 'uscita', voce: 'imposte_altre', importo: '', prima_data: '', frequenza: 'una_volta', numero_rate: '', certezza: 'certo', conto: '', note: '' }

export default function MovimentiPrevisti({ aziendaId, ultimaDataReale }) {
  const [righe, setRighe] = useState([])
  const [form, setForm] = useState(null)        // null = chiuso; { ...campi, id? }
  const [errore, setErrore] = useState('')
  const [salvando, setSalvando] = useState(false)
  const limite = ultimaDataReale && ultimaDataReale > oggi() ? ultimaDataReale : oggi()   // da qui in poi e' "futuro"

  const carica = useCallback(async () => {
    if (!aziendaId) return
    const { data, error } = await supabase.from('movimenti_previsti').select('*').eq('azienda_id', aziendaId).order('prima_data')
    if (error) setErrore(error.message)
    setRighe(data || [])
  }, [aziendaId])
  useEffect(() => { carica() }, [carica])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function salva() {
    const f = form
    const testo = String(f.importo).trim()
    const importo = Number(testo.includes(',') ? testo.replace(/\./g, '').replace(',', '.') : testo)
    if (!f.descrizione.trim()) { setErrore('Indica una descrizione.'); return }
    if (!(importo > 0)) { setErrore('Indica un importo maggiore di zero.'); return }
    if (!f.prima_data) { setErrore('Indica la data della (prima) scadenza.'); return }
    if (f.prima_data <= limite && !f.id) { setErrore(`La previsione riguarda i periodi futuri: la data deve essere successiva al ${fmtData(limite)}${ultimaDataReale ? ' (ultimo movimento reale analizzato)' : ''}.`); return }
    if (f.frequenza !== 'una_volta' && f.numero_rate !== '' && !(Number(f.numero_rate) >= 1)) { setErrore('Il numero di rate deve essere almeno 1.'); return }
    setSalvando(true); setErrore('')
    const payload = {
      azienda_id: aziendaId, descrizione: f.descrizione.trim(), direzione: f.direzione, voce: f.voce, importo,
      prima_data: f.prima_data, frequenza: f.frequenza, numero_rate: f.frequenza === 'una_volta' || f.numero_rate === '' ? null : Number(f.numero_rate),
      certezza: f.certezza, conto: f.conto.trim() || null, note: f.note.trim() || null, aggiornato_il: new Date().toISOString(),
    }
    const { error } = f.id
      ? await supabase.from('movimenti_previsti').update(payload).eq('id', f.id)
      : await supabase.from('movimenti_previsti').insert(payload)
    setSalvando(false)
    if (error) { setErrore(error.message); return }
    setForm(null); carica()
  }

  async function elimina(r) {
    if (!window.confirm(`Eliminare «${r.descrizione}» dai movimenti previsti?`)) return
    const { error } = await supabase.from('movimenti_previsti').delete().eq('id', r.id)
    if (error) setErrore(error.message); else carica()
  }

  const prossime = (r) => scadenzeMovimento(r, limite, null).slice(0, 1)[0]
  const totali = righe.reduce((t, r) => {
    const res = residuoMovimento(r, limite)
    if (res != null) t[r.direzione] += res
    return t
  }, { entrata: 0, uscita: 0 })

  return (
    <div className="card no-print" style={{ marginBottom: 20 }}>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, color: '#1a3a5c', fontSize: 16 }}>Movimenti previsti (periodi futuri)</h3>
            <p style={{ fontSize: 12.5, color: '#5f6b7a', margin: '4px 0 0' }}>
              Rateizzazioni, acconti e saldi di imposta, finanziamenti attesi e ogni altra entrata o uscita già nota: la proiezione della Tesoreria li usa
              alla data di pagamento. Un versamento di imposte sul reddito sostituisce, nello stesso mese, quello calcolato dal budget; le altre voci si sommano.
            </p>
          </div>
          {!form && <button className="btn btn-primary btn-sm" onClick={() => { setErrore(''); setForm({ ...VUOTO }) }}>+ Nuovo movimento previsto</button>}
        </div>
        {errore && <p style={{ color: '#c0392b', marginTop: 10 }}>{errore}</p>}

        {form && (
          <div style={{ marginTop: 14, padding: 14, background: '#f7f9fc', border: '1px solid #e3eaf3', borderRadius: 8 }}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Descrizione</label>
                <input className="form-control" value={form.descrizione} onChange={(e) => set('descrizione', e.target.value)} placeholder="Es. Rateizzazione AdER n. 942706, 2° acconto IRES 2026" /></div>
              <div className="form-group"><label className="form-label">Voce</label>
                <select className="form-control" value={form.voce} onChange={(e) => set('voce', e.target.value)}>
                  {Object.entries(VOCI_PREVISTE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Entrata o uscita</label>
                <select className="form-control" value={form.direzione} onChange={(e) => set('direzione', e.target.value)}>
                  <option value="uscita">Uscita</option><option value="entrata">Entrata</option>
                </select></div>
              <div className="form-group"><label className="form-label">Importo (per ogni scadenza) €</label>
                <input className="form-control" value={form.importo} onChange={(e) => set('importo', e.target.value)} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">{form.frequenza === 'una_volta' ? 'Data di pagamento/incasso' : 'Data della prima scadenza'}</label>
                <input type="date" className="form-control" value={form.prima_data} min={form.id ? undefined : limite} onChange={(e) => set('prima_data', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Frequenza</label>
                <select className="form-control" value={form.frequenza} onChange={(e) => set('frequenza', e.target.value)}>
                  {Object.entries(FREQUENZE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
            </div>
            <div className="grid-2">
              {form.frequenza !== 'una_volta' && (
                <div className="form-group"><label className="form-label">Numero di rate (vuoto = senza fine)</label>
                  <input className="form-control" type="number" min="1" value={form.numero_rate} onChange={(e) => set('numero_rate', e.target.value)} /></div>
              )}
              <div className="form-group"><label className="form-label">Certezza</label>
                <select className="form-control" value={form.certezza} onChange={(e) => set('certezza', e.target.value)}>
                  <option value="certo">Certo (scadenza definita)</option><option value="probabile">Probabile</option>
                </select></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Conto contabile collegato (facoltativo)</label>
                <input className="form-control" value={form.conto} onChange={(e) => set('conto', e.target.value)} placeholder="Es. 23/120/5024" /></div>
              <div className="form-group"><label className="form-label">Note</label>
                <input className="form-control" value={form.note} onChange={(e) => set('note', e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={salvando} onClick={salva}>{salvando ? 'Salvataggio…' : 'Salva'}</button>
              <button className="btn btn-outline btn-sm" disabled={salvando} onClick={() => setForm(null)}>Annulla</button>
            </div>
          </div>
        )}

        {righe.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: '#5f6b7a' }}>
                <th>Descrizione</th><th>Voce</th><th style={{ textAlign: 'right' }}>Importo</th><th>Frequenza</th><th>Prossima scadenza</th><th style={{ textAlign: 'right' }}>Residuo</th><th></th>
              </tr></thead>
              <tbody>
                {righe.map((r) => {
                  const p = prossime(r)
                  const res = residuoMovimento(r, limite)
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid #eef1f5', opacity: p ? 1 : 0.5 }}>
                      <td>{r.descrizione}{r.certezza === 'probabile' && <span style={{ fontSize: 11, color: '#b45309' }}> · probabile</span>}{r.conto && <div style={{ fontSize: 11, color: '#8a94a0' }}>conto {r.conto}</div>}</td>
                      <td style={{ fontSize: 12, color: '#5f6b7a' }}>{VOCI_PREVISTE[r.voce]?.label || r.voce}</td>
                      <td style={{ textAlign: 'right', color: r.direzione === 'uscita' ? '#c0392b' : '#1e8449' }}>{r.direzione === 'uscita' ? '−' : '+'}{fmt(r.importo)}</td>
                      <td>{FREQUENZE[r.frequenza]?.label}{r.numero_rate ? ` × ${r.numero_rate}` : r.frequenza !== 'una_volta' ? ' (senza fine)' : ''}</td>
                      <td>{p ? `${fmtData(p.data)}${p.totaleRate > 1 ? ` (rata ${p.rata}/${p.totaleRate})` : ''}` : 'esaurito'}</td>
                      <td style={{ textAlign: 'right' }}>{res == null ? '—' : fmt(res)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => { setErrore(''); setForm({ ...VUOTO, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])), numero_rate: r.numero_rate ?? '' }) }}>Modifica</button>{' '}
                        <button className="btn btn-outline btn-sm" onClick={() => elimina(r)}>Elimina</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ fontSize: 12.5, color: '#5f6b7a', marginTop: 6 }}>
              Residuo dal {fmtData(limite)}: uscite {fmt(totali.uscita)} €, entrate {fmt(totali.entrata)} € (esclusi i movimenti ricorrenti senza fine).
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
