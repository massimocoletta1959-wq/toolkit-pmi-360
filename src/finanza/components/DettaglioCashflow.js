import React, { useState } from 'react'
import { MESI_NOMI } from '../lib/tesoreria'
import { vociMeseReale, vociMeseProiezione, totaliPerGruppo, gruppiPresenti, contropartiDelGruppo, etichettaGruppo } from '../lib/dettaglioFlussi'

const fmt = (n) => `€${(Math.abs(n ?? 0)).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`
const fmtSegno = (n) => `${(n ?? 0) < 0 ? '-' : ''}${fmt(n)}`
const fmtCent = (n) => `${(n ?? 0) < 0 ? '-' : ''}€${Math.abs(n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Voci elementari di ogni colonna della tabella Cash Flow (mesi reali, poi mesi di proiezione)
export function vociColonne(piano, datiReali, direzione) {
  return [
    ...piano.mesi_reali.map((m) => ({ chiave: `r${m.mese_budget}`, reale: true, anno: m.anno, mese: m.mese, voci: datiReali ? vociMeseReale(datiReali, m.mese, direzione) : null })),
    ...piano.mesi.map((m) => ({ chiave: `p${m.mese_budget}`, reale: false, anno: m.anno, mese: m.mese, voci: m.dettaglio ? vociMeseProiezione(m, direzione) : null })),
  ]
}

// Righe dei raggruppamenti sotto "Entrate" o "Uscite": ogni cella apre il dettaglio del mese
export function RigheRaggruppamenti({ colonne, direzione, onApri }) {
  const totali = colonne.map((c) => (c.voci ? totaliPerGruppo(c.voci) : null))
  const gruppi = gruppiPresenti(totali)
  if (!gruppi.length) {
    return (
      <tr>
        <td className="cf-sticky-col" colSpan={colonne.length + 1} style={{ paddingLeft: 34, fontSize: 12.5, color: '#6b7280' }}>
          Dettaglio non disponibile: ricalcola l'Analisi dei flussi e premi «Genera proiezione».
        </td>
      </tr>
    )
  }
  const cls = direzione === 'entrata' ? 'cf-pos' : 'cf-neg'
  return gruppi.map((g) => (
    <tr key={g} style={{ fontSize: 13 }}>
      <td className="cf-sticky-col" style={{ paddingLeft: 34, color: '#374151' }}>
        {etichettaGruppo(g, direzione)}
      </td>
      {colonne.map((c, i) => {
        const v = totali[i]?.[g] || 0
        return (
          <td key={c.chiave} className={v ? cls : undefined} style={{ textAlign: 'right', background: c.reale ? '#f0f4f8' : undefined, opacity: 0.9 }}>
            {totali[i] == null ? (
              <span style={{ color: '#9ca3af' }} title="Dettaglio non disponibile per questo mese">—</span>
            ) : v ? (
              <button type="button" className="cf-link" title="Mostra il dettaglio" onClick={() => onApri({ colonna: c, gruppo: g, direzione })}>
                {fmt(v)}
              </button>
            ) : (
              <span style={{ color: '#d1d5db' }}>—</span>
            )}
          </td>
        )
      })}
    </tr>
  ))
}

// Dettaglio di un raggruppamento in un mese: controparti, ognuna apribile sui singoli movimenti
export function ModaleDettaglio({ dettaglio, onClose }) {
  const [aperti, setAperti] = useState({})
  if (!dettaglio) return null
  const { colonna, gruppo, direzione } = dettaglio
  const controparti = contropartiDelGruppo(colonna.voci || [], gruppo)
  const totale = controparti.reduce((s, c) => s + c.importo, 0)
  const toggle = (k) => setAperti((a) => ({ ...a, [k]: !a[k] }))

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760, width: '100%' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {etichettaGruppo(gruppo, direzione)} — {MESI_NOMI[colonna.mese - 1]} {colonna.anno}
            </div>
            <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 2 }}>
              {colonna.reale ? 'Movimenti reali di banca e cassa dal Libro Giornale' : 'Partite previste dalla proiezione (scenario base)'} · {controparti.length} {controparti.length === 1 ? 'voce' : 'voci'} · totale {fmtSegno(totale)}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>{colonna.reale ? 'Controparte' : 'Voce'}</th>
                <th style={{ textAlign: 'right', width: 70 }}>Mov.</th>
                <th style={{ textAlign: 'right', width: 130 }}>Importo</th>
              </tr>
            </thead>
            <tbody>
              {controparti.map((c) => (
                <React.Fragment key={c.chiave}>
                  <tr onClick={() => toggle(c.chiave)} style={{ cursor: 'pointer' }} title="Mostra i singoli movimenti">
                    <td>
                      <span style={{ display: 'inline-block', width: 16, color: '#6b7280' }}>{aperti[c.chiave] ? '▾' : '▸'}</span>
                      {c.controparte}
                    </td>
                    <td style={{ textAlign: 'right', color: '#6b7280' }}>{c.movimenti.length}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCent(c.importo)}</td>
                  </tr>
                  {aperti[c.chiave] &&
                    c.movimenti.map((m, i) => (
                      <tr key={i} style={{ fontSize: 12.5, background: '#f9fafb' }}>
                        <td style={{ paddingLeft: 40, color: '#4b5563' }}>
                          {m.data || '—'}
                          {m.nota && <span style={{ color: '#9ca3af' }}> · {m.nota}</span>}
                        </td>
                        <td />
                        <td style={{ textAlign: 'right' }}>{fmtCent(m.importo)}</td>
                      </tr>
                    ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
