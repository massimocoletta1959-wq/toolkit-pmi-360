import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { saldoPrevistoAl } from '../lib/tesoreria'

// Vista a 13 settimane (check-list art. 13 CCII richiamata dal documento CNDCEC §1.1) e controllo settimanale
// della posizione di cassa reale vs prevista (§2.5h: dato non piu' vecchio di 48 ore, scostamento > 10% segnalato).
const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })
const fmtSaldo = (n) => `${n < 0 ? '-' : ''}€${fmt(Math.abs(n))}`
const col = (s) => (s === 'verde' ? '#22c55e' : s === 'giallo' ? '#f59e0b' : '#ef4444')
const gg = (iso) => iso.split('-').reverse().join('/')
const oggi = () => new Date().toISOString().slice(0, 10)

export default function VistaSettimanale({ aziendaId, piano }) {
  const [saldi, setSaldi] = useState([])
  const [data, setData] = useState(oggi())
  const [saldo, setSaldo] = useState('')
  const [errore, setErrore] = useState('')
  const vista = piano?.vista_settimanale

  const carica = async () => {
    const { data: righe } = await supabase.from('saldi_cassa_reali').select('*').eq('azienda_id', aziendaId).order('data', { ascending: false }).limit(12)
    setSaldi(righe || [])
  }
  useEffect(() => {
    if (aziendaId) carica()
  }, [aziendaId])

  const registra = async () => {
    setErrore('')
    const v = parseFloat(String(saldo).replace(',', '.'))
    if (!data || Number.isNaN(v)) return setErrore('Indica data e saldo di cassa reale.')
    const { error } = await supabase.from('saldi_cassa_reali').upsert({ azienda_id: aziendaId, data, saldo: v }, { onConflict: 'azienda_id,data' })
    if (error) return setErrore(error.message)
    setSaldo('')
    carica()
  }

  if (!piano) return <div className="alert" style={{ background: '#eff6ff', color: '#1d4ed8', marginTop: 16 }}>ℹ️ Genera prima la proiezione nella scheda Cash Flow.</div>
  if (!vista) return <div className="alert" style={{ background: '#fff7ed', color: '#9a3412', marginTop: 16 }}>Questa proiezione non contiene la vista settimanale: premi «Genera proiezione».</div>

  const ultimo = saldi[0]
  const etaGiorni = ultimo ? Math.floor((Date.now() - new Date(`${ultimo.data}T00:00:00Z`).getTime()) / 86400000) : null

  return (
    <div style={{ marginTop: 16 }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <h3 style={{ color: '#1a3a5c', marginTop: 0, fontSize: 14 }}>Vista a 13 settimane dal {gg(vista.inizio)}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Settimana</th>
                  <th style={{ textAlign: 'right' }}>Entrate</th>
                  <th style={{ textAlign: 'right' }}>Uscite</th>
                  <th style={{ textAlign: 'right' }}>Saldo a fine settimana</th>
                </tr>
              </thead>
              <tbody>
                {vista.settimane.map((w, i) => (
                  <tr key={w.dal}>
                    <td>
                      {i + 1}. {gg(w.dal).slice(0, 5)} – {gg(w.al).slice(0, 5)}
                    </td>
                    <td style={{ textAlign: 'right' }}>€{fmt(w.entrate)}</td>
                    <td style={{ textAlign: 'right' }}>€{fmt(w.uscite)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: col(w.semaforo) }}>{fmtSaldo(w.saldo_fine)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>
            Stessi flussi del piano mensile (incassi variabili pesati per probabilità) collocati nella settimana della loro data. I flussi da budget cadono al giorno 15 (pagamenti) e 28 (incassi) del mese:
            approssimazione dichiarata; IVA, F24, stipendi, rate e partite aperte hanno la data effettiva.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h3 style={{ color: '#1a3a5c', marginTop: 0, fontSize: 14 }}>Controllo settimanale: cassa reale vs prevista (§2.5h)</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 8 }}>
            <div>
              <label className="form-label">Data</label>
              <input type="date" className="form-control" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Saldo di cassa reale (€)</label>
              <input className="form-control" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={registra}>
              Registra saldo
            </button>
          </div>
          {errore && <div className="alert alert-error">{errore}</div>}
          {etaGiorni != null && etaGiorni > 2 && <div className="alert" style={{ background: '#fff7ed', color: '#9a3412' }}>⚠️ L'ultimo saldo registrato ha {etaGiorni} giorni: il controllo settimanale richiede dati di non oltre 48 ore.</div>}
          {!ultimo && <div style={{ fontSize: 12, color: '#9ca3af' }}>Nessun saldo registrato: senza, il confronto reale/previsto non è possibile.</div>}
          {saldi.length > 0 && (
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th style={{ textAlign: 'right' }}>Reale</th>
                  <th style={{ textAlign: 'right' }}>Previsto</th>
                  <th style={{ textAlign: 'right' }}>Scostamento</th>
                </tr>
              </thead>
              <tbody>
                {saldi.map((r) => {
                  const prev = saldoPrevistoAl(vista, r.data)
                  const delta = prev == null ? null : r.saldo - prev
                  const perc = prev ? (delta / Math.abs(prev)) * 100 : null
                  return (
                    <tr key={r.id}>
                      <td>{gg(r.data)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtSaldo(r.saldo)}</td>
                      <td style={{ textAlign: 'right' }}>{prev == null ? 'fuori dalla vista' : fmtSaldo(prev)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: perc != null && Math.abs(perc) > 10 ? '#c2410c' : undefined }}>
                        {delta == null ? '—' : `${delta >= 0 ? '+' : '-'}€${fmt(Math.abs(delta))}${perc != null ? ` (${perc >= 0 ? '+' : ''}${perc.toFixed(0)}%)` : ''}${perc != null && Math.abs(perc) > 10 ? ' ⚠️' : ''}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
