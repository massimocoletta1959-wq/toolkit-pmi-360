import React, { useEffect, useState } from 'react'

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const CAMPI = [
  ['rimanenze_finali', 'Rimanenze finali', 'riducono i costi (B.11) e restano in magazzino (C.I.4)'],
  ['ammortamenti', 'Ammortamenti di periodo', 'B.10.b a costo, fondo ammortamento sulle immobilizzazioni'],
  ['tfr', 'Accantonamento TFR di periodo', 'B.9.c a costo, debito TFR (C del passivo)'],
  ['fatture_da_ricevere', 'Fatture da ricevere (acquisti di competenza non ancora registrati)', 'B.6 a costo, debiti verso fornitori (D.7); importo senza IVA'],
  ['fatture_da_emettere', 'Fatture da emettere (vendite di competenza non ancora fatturate)', 'A.1 a ricavo, crediti verso clienti (C.II.1); importo senza IVA'],
]

// Assestamenti di periodo di un libro giornale infrannuale: stime separate dai dati registrati, salvate sul
// documento. Il risultato "da giornale" resta sempre visibile accanto a quello assestato.
export default function AssestamentiPeriodo({ valori, proposte, periodo, sommario, salvando, onSalva }) {
  const [form, setForm] = useState(valori)
  useEffect(() => setForm(valori), [valori])
  if (!form) return null
  const cambia = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const modificato = JSON.stringify({ ...form, fonti: null }) !== JSON.stringify({ ...valori, fonti: null })

  return (
    <div className="card" style={{ marginBottom: 20, border: '1px solid #f5d0a9', background: '#fffaf3' }}>
      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <h3 style={{ margin: 0, color: '#1a3a5c', fontSize: 16 }}>Assestamenti di periodo {periodo} (stime)</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginLeft: 'auto' }}>
            <input type="checkbox" checked={!!form.attivi} onChange={(e) => cambia('attivi', e.target.checked)} /> applica al Conto economico e allo Stato patrimoniale
          </label>
        </div>
        <p style={{ fontSize: 12.5, color: '#5f6b7a', margin: '0 0 12px' }}>
          Il libro giornale infrannuale non contiene le scritture di fine esercizio. Queste stime le aggiungono, separate dai dati registrati:
          nelle tabelle compaiono come «assestamento stimato».
        </p>
        <div className="grid-2">
          {CAMPI.map(([k, label, effetto]) => (
            <div key={k} className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">{label}</label>
              <input className="form-control" type="number" step="0.01" value={form[k] ?? ''} disabled={!form.attivi} onChange={(e) => cambia(k, e.target.value === '' ? 0 : Number(e.target.value))} />
              <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>
                {effetto}
                {proposte?.fonti?.[k] && <> · proposta: {fmt(proposte[k])} € — {proposte.fonti[k]}</>}
              </div>
            </div>
          ))}
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Aliquota imposte stimate (%)</label>
            <input className="form-control" type="number" step="0.1" value={form.aliquota_imposte ?? ''} disabled={!form.attivi} onChange={(e) => cambia('aliquota_imposte', e.target.value === '' ? 0 : Number(e.target.value))} />
            <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>{proposte?.fonti?.aliquota_imposte} · E.20 a costo, debiti tributari (D.12)</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 13, marginTop: 6 }}>
          <span>Risultato da giornale: <strong>€{fmt(sommario?.risultato_da_giornale)}</strong></span>
          {valori?.attivi && (
            <>
              <span>Ante imposte assestato: <strong>€{fmt(sommario?.risultato_ante_imposte)}</strong></span>
              <span>Imposte stimate: <strong>€{fmt(sommario?.imposte_stimate)}</strong></span>
              <span>Risultato netto stimato: <strong>€{fmt(sommario?.risultato)}</strong></span>
            </>
          )}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" disabled={salvando} onClick={() => setForm({ ...proposte, attivi: form.attivi })}>Ripristina proposte</button>
            <button className="btn btn-primary btn-sm" disabled={salvando || !modificato} onClick={() => onSalva(form)}>{salvando ? 'Salvataggio…' : 'Salva e ricalcola'}</button>
          </span>
        </div>
      </div>
    </div>
  )
}
