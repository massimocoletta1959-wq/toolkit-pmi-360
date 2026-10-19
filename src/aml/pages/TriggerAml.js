import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../App'
import { apriFascicolo } from '../index'
import { ModaleChiusuraTrigger } from './FascicoloAml'
import { TIPI_TRIGGER, STATI_TRIGGER, fmtData, fmtDataOra, fmtEuro, nomeUtente } from '../lib/costanti'

// Elenco dei trigger AML-05 di tutti i clienti: aperti (posizioni bloccate) e chiusi con esito motivato
export default function TriggerAml() {
  const { azienda, setPage, profilo, session } = useApp()
  const [righe, setRighe] = useState([])
  const [clienti, setClienti] = useState({})
  const [stato, setStato] = useState('aperto')
  const [chiusura, setChiusura] = useState(null)
  const [carico, setCarico] = useState(true)

  const carica = useCallback(async () => {
    if (!azienda?.id) return
    setCarico(true)
    const [t, c] = await Promise.all([
      supabase.from('aml_trigger').select('*').eq('azienda_id', azienda.id).order('data_rilevazione', { ascending: false }),
      supabase.from('aml_clienti').select('id,denominazione,tipo').eq('azienda_id', azienda.id),
    ])
    setRighe(t.data || [])
    setClienti(Object.fromEntries((c.data || []).map(x => [x.id, x])))
    setCarico(false)
  }, [azienda])
  useEffect(() => { carica() }, [carica])

  const visibili = righe.filter(r => !stato || (stato === 'chiusi' ? r.stato !== 'aperto' : r.stato === stato))
  const oggi = Date.now()
  const giorni = d => Math.floor((oggi - Date.parse(d)) / 86400000)

  return (
    <div>
      <div className="page-header">
        <h2>Trigger AML e posizioni bloccate</h2>
        <p>Procedura AML-05: al trigger la posizione si blocca e passa alla funzione AML, che la sblocca solo con un esito motivato e le fonti consultate (obiettivo: entro 5 giorni lavorativi).</p>
      </div>
      <div className="tabs" style={{ marginBottom: 12 }}>
        {[['aperto', `Aperti (${righe.filter(r => r.stato === 'aperto').length})`], ['chiusi', 'Chiusi'], ['', 'Tutti']].map(([k, l]) => (
          <div key={k} className={`tab${stato === k ? ' active' : ''}`} onClick={() => setStato(k)}>{l}</div>
        ))}
      </div>
      {carico ? <div className="spinner" /> : !visibili.length ? <div className="empty-state"><p>Nessun trigger {stato === 'aperto' ? 'aperto' : ''}.</p></div> : (
        <div className="card table-wrap"><table>
          <thead><tr><th>Data</th><th>Cliente</th><th>Trigger</th><th>Importo</th><th>Stato</th><th>Esito</th><th></th></tr></thead>
          <tbody>{visibili.map(t => {
            const cl = clienti[t.cliente_id]
            const ritardo = t.stato === 'aperto' && giorni(t.data_rilevazione) > 7
            return (
              <tr key={t.id}>
                <td>{fmtData(t.data_rilevazione)}{t.stato === 'aperto' && <div style={{ fontSize: 11, color: ritardo ? '#C0392B' : '#888' }}>da {giorni(t.data_rilevazione)} giorni</div>}</td>
                <td><span style={{ color: '#2B5FA5', cursor: 'pointer' }} onClick={() => apriFascicolo(setPage, t.cliente_id)}>{cl?.denominazione || '—'}</span></td>
                <td>{TIPI_TRIGGER[t.tipo]}<div style={{ fontSize: 11, color: '#888' }}>{t.descrizione}</div></td>
                <td>{fmtEuro(t.importo)}</td>
                <td><span className="badge" style={t.stato === 'aperto' ? { background: '#FADBD8', color: '#C0392B' } : { background: '#EEE', color: '#555' }}>{STATI_TRIGGER[t.stato]}</span></td>
                <td style={{ fontSize: 12, maxWidth: 300 }}>{t.esito_motivato ? <>{t.esito_motivato}<div style={{ color: '#888' }}>{t.chiuso_nome} · {fmtDataOra(t.chiuso_il)}</div></> : '—'}</td>
                <td>{t.stato === 'aperto' && <button className="btn btn-sm btn-primary" onClick={() => setChiusura(t)}>Esito</button>}</td>
              </tr>
            )
          })}</tbody>
        </table></div>
      )}
      {chiusura && <ModaleChiusuraTrigger trigger={chiusura} cliente={clienti[chiusura.cliente_id]} autore={nomeUtente(profilo, session)}
        onClose={() => setChiusura(null)} onSalvato={() => { setChiusura(null); carica() }} />}
    </div>
  )
}
