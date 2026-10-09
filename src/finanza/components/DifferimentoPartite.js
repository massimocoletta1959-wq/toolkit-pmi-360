import React from 'react'

const fmtData = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')
const fmtEur = (n) => `€${Math.round(n || 0).toLocaleString('it-IT')}`

function aggiungiGiorni(iso, giorni) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + giorni)
  return d.toISOString().slice(0, 10)
}

// Scadenza stimata prima di ogni differimento (le proiezioni salvate prima di questa funzione non hanno data_originale).
export function dataOriginale(sc) {
  if (sc.data_originale) return sc.data_originale
  return sc.differimento ? aggiungiGiorni(sc.data, -sc.differimento) : sc.data
}

// Campo per i giorni di differimento scritti dall'utente, con anteprima della nuova scadenza.
export function EditorDifferimento({ modifica, setModifica, base, onApplica, salvando }) {
  const giorni = Number(modifica.giorni)
  const valido = Number.isInteger(giorni) && giorni >= 1 && giorni <= 730
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
      <label style={{ fontSize: 12, color: '#1a3a5c' }}>
        Giorni di differimento
        <input
          className="form-control"
          type="number"
          min="1"
          max="730"
          step="1"
          autoFocus
          value={modifica.giorni}
          onChange={(e) => setModifica({ ...modifica, giorni: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && valido) onApplica() }}
          style={{ width: 110, marginTop: 3 }}
        />
      </label>
      <label style={{ fontSize: 12, color: '#1a3a5c', flex: '1 1 200px' }}>
        Motivo (facoltativo)
        <input className="form-control" value={modifica.motivo} onChange={(e) => setModifica({ ...modifica, motivo: e.target.value })} style={{ marginTop: 3 }} />
      </label>
      <div style={{ fontSize: 12, color: '#1d4ed8', minWidth: 170 }}>
        Scadenza stimata: {fmtData(base)}
        <br />
        <strong>Nuova scadenza: {valido ? fmtData(aggiungiGiorni(base, giorni)) : '—'}</strong>
      </div>
      <button className="btn btn-primary btn-sm" disabled={!valido || salvando} onClick={onApplica}>{salvando ? 'Salvataggio…' : 'Applica'}</button>
      <button className="btn btn-outline btn-sm" disabled={salvando} onClick={() => setModifica(null)}>Annulla</button>
      {!valido && modifica.giorni !== '' && <div style={{ width: '100%', fontSize: 11.5, color: '#b91c1c' }}>Indica un numero intero di giorni tra 1 e 730.</div>}
    </div>
  )
}

// Riepilogo delle partite modificate (differite o escluse), letto dalla tabella e non dalla proiezione: e' sempre
// aggiornato e permette di ripristinare la scadenza originale, escludere o cambiare i giorni.
export function ScadenzeModificate({ modificate, lista, modifica, setModifica, onApplica, onRipristina, onEscludi, salvando }) {
  if (!modificate.length) return null
  const perConto = new Map((lista || []).map((sc) => [sc.conto, sc]))
  return (
    <div style={{ border: '1px solid #c7d2fe', background: '#f8faff', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1a3a5c', marginBottom: 6 }}>Scadenze modificate ({modificate.length})</div>
      <table className="table" style={{ fontSize: 12, marginBottom: 0 }}>
        <thead>
          <tr>
            <th>Cliente / Fornitore</th>
            <th>Modifica</th>
            <th>Scadenza</th>
            <th style={{ textAlign: 'right' }}>Importo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {modificate.map((m) => {
            const sc = perConto.get(m.conto)
            const differita = m.differimento_giorni != null
            const base = sc ? dataOriginale(sc) : null
            const inModifica = modifica?.conto === m.conto && modifica.origine === 'riepilogo'
            return (
              <React.Fragment key={m.id}>
                <tr>
                  <td>
                    {m.descrizione || m.conto}
                    <div style={{ fontSize: 10, color: '#6b7280' }}>
                      {m.direzione === 'entrata' ? 'incasso' : 'pagamento'} · {m.conto}{m.motivo ? ` · ${m.motivo}` : ''}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: differita ? '#1d4ed8' : '#9a3412', fontWeight: 600 }}>
                    {differita ? `Differita di ${m.differimento_giorni} gg` : 'Esclusa'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {!sc ? (
                      <span style={{ color: '#6b7280' }}>non più aperta</span>
                    ) : differita ? (
                      <>
                        <span style={{ textDecoration: 'line-through', color: '#6b7280' }}>{fmtData(base)}</span> → <strong style={{ color: '#1d4ed8' }}>{fmtData(aggiungiGiorni(base, m.differimento_giorni))}</strong>
                      </>
                    ) : (
                      fmtData(base)
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>{sc ? fmtEur(sc.importo) : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="btn btn-outline btn-sm no-print" disabled={salvando} title="Riporta la partita alla scadenza stimata originale" onClick={() => onRipristina(m)}>Ripristina</button>{' '}
                    {differita ? (
                      <>
                        <button className="btn btn-outline btn-sm no-print" disabled={salvando} onClick={() => setModifica({ conto: m.conto, origine: 'riepilogo', giorni: String(m.differimento_giorni), motivo: m.motivo || '' })}>Modifica giorni</button>{' '}
                        <button className="btn btn-outline btn-sm no-print" disabled={salvando} onClick={() => onEscludi(m)}>Escludi</button>
                      </>
                    ) : (
                      sc && <button className="btn btn-outline btn-sm no-print" disabled={salvando} onClick={() => setModifica({ conto: m.conto, origine: 'riepilogo', giorni: '', motivo: m.motivo || '' })}>Differisci</button>
                    )}
                  </td>
                </tr>
                {inModifica && sc && (
                  <tr>
                    <td colSpan={5}>
                      <EditorDifferimento modifica={modifica} setModifica={setModifica} base={base} salvando={salvando} onApplica={() => onApplica(sc)} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
