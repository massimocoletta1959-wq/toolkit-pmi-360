import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Checklist mensile del budget (CNDCEC §2.5j) e revisione trimestrale delle ipotesi (§2.5h). E' un processo,
// non un calcolo: qui si registra che e' stato fatto, e la scheda KPI segnala se e' in ritardo.
export const VOCI_CHECKLIST_MENSILE = [
  ['scadenziari', 'Aggiornare gli scadenziari clienti con le nuove fatture emesse'],
  ['rate', 'Verificare le scadenze delle rate dei finanziamenti'],
  ['dso', 'Confrontare il DSO effettivo con quello di budget e aggiornare i coefficienti se la deviazione supera 5 giorni'],
  ['volumi', 'Validare le ipotesi sui volumi con gli ultimi dati di vendita'],
  ['energia', 'Controllare gli scostamenti dei costi energetici rispetto alle previsioni'],
  ['stress', 'Simulare lo scenario di stress con i dati aggiornati'],
  ['report', 'Preparare il report scostamenti per il management'],
]
export const periodoMensile = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const periodoTrimestrale = (d = new Date()) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`

export default function ControlliTesoreria({ aziendaId }) {
  const [mensile, setMensile] = useState(null)
  const [trimestrale, setTrimestrale] = useState(null)
  const [note, setNote] = useState('')
  const pM = periodoMensile()
  const pT = periodoTrimestrale()

  const carica = async () => {
    const { data } = await supabase.from('controlli_tesoreria').select('*').eq('azienda_id', aziendaId).in('periodo', [pM, pT])
    setMensile((data || []).find((r) => r.tipo === 'mensile' && r.periodo === pM) || null)
    const t = (data || []).find((r) => r.tipo === 'trimestrale' && r.periodo === pT) || null
    setTrimestrale(t)
    setNote(t?.note || '')
  }
  useEffect(() => {
    if (aziendaId) carica()
  }, [aziendaId])

  const salvaMensile = async (chiave, valore) => {
    const voci = { ...(mensile?.voci || {}), [chiave]: valore }
    const completato = VOCI_CHECKLIST_MENSILE.every(([k]) => voci[k])
    await supabase.from('controlli_tesoreria').upsert({ azienda_id: aziendaId, tipo: 'mensile', periodo: pM, voci, completato, data_completamento: completato ? new Date().toISOString().slice(0, 10) : null }, { onConflict: 'azienda_id,tipo,periodo' })
    carica()
  }

  const salvaTrimestrale = async (completato) => {
    await supabase.from('controlli_tesoreria').upsert({ azienda_id: aziendaId, tipo: 'trimestrale', periodo: pT, note, completato, data_completamento: completato ? new Date().toISOString().slice(0, 10) : null }, { onConflict: 'azienda_id,tipo,periodo' })
    carica()
  }

  const fatte = VOCI_CHECKLIST_MENSILE.filter(([k]) => mensile?.voci?.[k]).length
  return (
    <div style={{ marginTop: 16 }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <h3 style={{ color: '#1a3a5c', marginTop: 0, fontSize: 14 }}>
            Checklist mensile — {pM} ({fatte}/{VOCI_CHECKLIST_MENSILE.length}) {mensile?.completato && '✅'}
          </h3>
          {VOCI_CHECKLIST_MENSILE.map(([k, t]) => (
            <label key={k} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, borderBottom: '1px solid #f0f2f5' }}>
              <input type="checkbox" checked={!!mensile?.voci?.[k]} onChange={(e) => salvaMensile(k, e.target.checked)} /> {t}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h3 style={{ color: '#1a3a5c', marginTop: 0, fontSize: 14 }}>
            Revisione trimestrale delle ipotesi — {pT} {trimestrale?.completato && '✅'}
          </h3>
          <p style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, marginTop: 0 }}>Revisione completa delle ipotesi di base e aggiornamento del forecast (§2.5h). Annota cosa hai rivisto e cosa hai cambiato.</p>
          <textarea className="form-control" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note della revisione" />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => salvaTrimestrale(true)}>
              Segna la revisione come completata
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => salvaTrimestrale(false)}>
              Salva la nota
            </button>
          </div>
          {trimestrale?.data_completamento && <div style={{ fontSize: 12, color: '#166534', marginTop: 6 }}>Completata il {trimestrale.data_completamento.split('-').reverse().join('/')}</div>}
        </div>
      </div>
    </div>
  )
}
