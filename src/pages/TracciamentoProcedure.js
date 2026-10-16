import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { AREE_PROCEDURE } from '../lib/procedure'
import { settoriCatalogo, prioritaSettore } from '../lib/procedure'

const EDGE = 'https://vwbixmbbcutjcplskjvg.supabase.co/functions/v1/invia-email'

// Codice procedura (es. AMM-01, ACQ-3; riconosce anche il vecchio formato PRO-AMM-004) da un ticket di presa visione
function codiceDaTicket(t) {
  const src = `${t.procedura_id || ''} ${t.istruzioni || ''} ${t.titolo || ''}`
  const m = src.match(/\b[A-Z]{2,6}-\d{1,3}\b/)
  return m ? m[0] : null
}

export default function TracciamentoProcedure() {
  const { azienda } = useApp()
  const [righe, setRighe]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [fAdoz, setFAdoz]       = useState('tutte')   // tutte | adottate
  const [fDistr, setFDistr]     = useState('tutte')   // tutte | distribuite | non_distribuite
  const [aperta, setAperta]     = useState(null)      // codice espanso
  const [msg, setMsg]           = useState(null)

  const load = useCallback(async () => {
    if (!azienda?.id) return
    setLoading(true)
    const A = azienda.id
    const res = await Promise.allSettled([
      supabase.from('procedure_azienda').select('codice, stato').eq('azienda_id', A),
      supabase.from('ticket').select('id, procedura_id, istruzioni, titolo, membro_id, stato, data_presa_visione').eq('azienda_id', A).eq('tipo', 'presa_visione'),
      supabase.from('membri').select('id, nome, cognome, email').eq('azienda_id', A),
      supabase.from('procedure_catalogo').select('codice, area, titolo, settore')
        .in('settore', settoriCatalogo(azienda)).eq('attivo', true),
    ])
    const val = i => (res[i].status === 'fulfilled' ? (res[i].value.data || []) : [])
    const pa = val(0), tk = val(1), mb = val(2), cat = val(3)

    // Dedup per codice: priorità al settore specifico dell'azienda rispetto al generico
    const perCodiceCatalogo = {}
    cat.forEach(p => {
      if (!perCodiceCatalogo[p.codice] || prioritaSettore(azienda, p.settore) > prioritaSettore(azienda, perCodiceCatalogo[p.codice].settore)) perCodiceCatalogo[p.codice] = p
    })
    const catalogo = Object.values(perCodiceCatalogo)

    const nomeMembro = id => {
      const m = mb.find(x => x.id === id)
      return m ? (`${m.nome || ''} ${m.cognome || ''}`.trim() || m.email || '—') : '—'
    }
    const adozione = {}
    pa.forEach(p => { adozione[p.codice] = p.stato })

    // Raggruppa i ticket di presa visione per codice procedura
    const perCodice = {}
    tk.forEach(t => {
      const cod = codiceDaTicket(t)
      if (!cod) return
      if (!perCodice[cod]) perCodice[cod] = []
      perCodice[cod].push(t)
    })

    // Costruisci una riga per ogni procedura rilevante (adottata o distribuita)
    const out = []
    catalogo.forEach(p => {
      const stato = adozione[p.codice]
      const adottata = stato === 'Adottata' || stato === 'Personalizzata'
      const ticketsP = perCodice[p.codice] || []
      const distribuita = ticketsP.length > 0
      if (!adottata && !distribuita) return

      const destinatari = ticketsP.map(t => ({
        ticketId: t.id,
        membroId: t.membro_id,
        nome: nomeMembro(t.membro_id),
        firmato: t.stato === 'Completato',
        data: t.data_presa_visione,
      })).sort((a, b) => (a.firmato ? 1 : 0) - (b.firmato ? 1 : 0))

      out.push({
        codice: p.codice,
        area: p.area,
        titolo: p.titolo,
        stato: stato || null,
        adottata,
        distribuita,
        firmate: destinatari.filter(d => d.firmato).length,
        totali: destinatari.length,
        destinatari,
      })
    })
    out.sort((a, b) => a.codice.localeCompare(b.codice))
    setRighe(out)
    setLoading(false)
  }, [azienda])

  useEffect(() => { load() }, [load])

  const filtrate = righe.filter(r => {
    if (fAdoz === 'adottate' && !r.adottata) return false
    if (fDistr === 'distribuite' && !r.distribuita) return false
    if (fDistr === 'non_distribuite' && r.distribuita) return false
    return true
  })

  async function sollecita(r) {
    const mancanti = r.destinatari.filter(d => !d.firmato)
    if (!mancanti.length) return
    setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await Promise.all(mancanti.map(d =>
        fetch(EDGE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ ticket_id: d.ticketId, tipo: 'assegnazione' }),
        }).catch(() => {})
      ))
      setMsg(`Sollecito inviato a ${mancanti.length} ${mancanti.length === 1 ? 'persona' : 'persone'} per "${r.titolo}".`)
      setTimeout(() => setMsg(null), 6000)
    } catch (e) {
      setMsg('Non è stato possibile inviare il sollecito.')
    }
  }

  const fmt = d => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null

  return (
    <div>
      <div className="page-header">
        <h2>📊 Tracciamento prese visioni</h2>
        <p>Chi ha preso visione delle procedure, e chi manca</p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select className="form-control" style={{ maxWidth: 200 }} value={fAdoz} onChange={e => setFAdoz(e.target.value)}>
          <option value="tutte">Tutte le procedure</option>
          <option value="adottate">Solo adottate</option>
        </select>
        <select className="form-control" style={{ maxWidth: 220 }} value={fDistr} onChange={e => setFDistr(e.target.value)}>
          <option value="tutte">Tutte</option>
          <option value="distribuite">Solo distribuite</option>
          <option value="non_distribuite">Non ancora distribuite</option>
        </select>
      </div>

      {msg && <div className="alert alert-info" style={{ marginBottom: 12 }}>{msg}</div>}

      {loading ? <div className="spinner" /> : filtrate.length === 0 ? (
        <div className="card"><div className="empty-state"><div style={{ fontSize: 36 }}>📊</div><p>Nessuna procedura con questi filtri.</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrate.map(r => {
            const completa = r.distribuita && r.firmate === r.totali
            const espansa = aperta === r.codice
            return (
              <div key={r.codice} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: r.distribuita ? 'pointer' : 'default' }}
                     onClick={() => r.distribuita && setAperta(espansa ? null : r.codice)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75' }}>{r.codice}</span>
                      <span style={{ fontSize: 11, color: '#888' }}>{r.area} — {AREE_PROCEDURE[r.area] || r.area}</span>
                      {r.stato && <span className="badge" style={{ background: '#EAF7F1', color: '#155724', fontSize: 10 }}>{r.stato}</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3A5C', marginTop: 3 }}>{r.titolo}</div>
                  </div>
                  {r.distribuita ? (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: completa ? '#27AE60' : '#E67E22' }}>{r.firmate}/{r.totali}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{completa ? 'tutti hanno firmato' : 'hanno preso visione'}</div>
                    </div>
                  ) : (
                    <span className="badge" style={{ background: '#FDEBD0', color: '#B9770E', flexShrink: 0 }}>Non distribuita</span>
                  )}
                </div>

                {r.distribuita && espansa && (
                  <div style={{ borderTop: '1px solid #EEE', padding: '12px 18px', background: '#FBFCFD' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {r.destinatari.map(d => (
                        <div key={d.ticketId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                          <span>{d.nome}</span>
                          {d.firmato
                            ? <span style={{ color: '#27AE60', fontWeight: 600 }}>✓ preso visione{d.data ? ' · ' + fmt(d.data) : ''}</span>
                            : <span style={{ color: '#E67E22' }}>in attesa</span>}
                        </div>
                      ))}
                    </div>
                    {r.firmate < r.totali && (
                      <div style={{ marginTop: 12, textAlign: 'right' }}>
                        <button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); sollecita(r) }}>
                          📧 Sollecita i mancanti ({r.totali - r.firmate})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
