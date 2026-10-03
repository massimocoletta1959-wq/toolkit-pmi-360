import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcolaPaybackInvestimento } from '../lib/budgetMensile'

// Scheda investimenti (CNDCEC §2.5f): importo e tempistica dei pagamenti per tranche, impatto sui costi
// operativi, beneficio annuo, payback semplice e attualizzato; oltre 3 anni si segnala la necessita'
// di approfondimento o di frazionamento in fasi. Gli investimenti entrano nel piano di cassa alla
// prossima generazione della proiezione.
// Attenzione: se un investimento e' gia' inserito tra i costi del budget, non ripeterlo qui (doppio conteggio).

const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })
const num = (v) => parseFloat(String(v).replace(',', '.'))
const vuoto = () => ({ id: null, descrizione: '', importo: '', soggetto_iva: true, tranche: [{ mese: '', pct: '100' }], impatto_costi_annuo: '0', beneficio_annuo: '0', tasso_attualizzazione_pct: '5' })

export default function Investimenti({ aziendaId }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(null)
  const [errore, setErrore] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carica = async () => {
    const { data } = await supabase.from('investimenti').select('*').eq('azienda_id', aziendaId).order('creato_il')
    setLista(data || [])
  }
  useEffect(() => {
    if (aziendaId) carica()
    setForm(null)
  }, [aziendaId])

  const salva = async () => {
    setErrore('')
    if (!form.descrizione.trim()) return setErrore('Inserisci una descrizione.')
    if (!(num(form.importo) > 0)) return setErrore('L\'importo (netto IVA) deve essere maggiore di 0.')
    const tranche = form.tranche.map((t) => ({ mese: t.mese, pct: num(t.pct) }))
    if (tranche.some((t) => !/^\d{4}-\d{2}$/.test(t.mese) || !(t.pct > 0))) return setErrore('Ogni tranche richiede un mese e una percentuale maggiore di 0.')
    const somma = tranche.reduce((s, t) => s + t.pct, 0)
    if (Math.abs(somma - 100) > 0.01) return setErrore(`Le tranche devono sommare 100% (ora ${somma}%).`)
    setSalvando(true)
    try {
      const riga = {
        azienda_id: aziendaId, descrizione: form.descrizione.trim(), importo: num(form.importo), soggetto_iva: form.soggetto_iva, tranche,
        impatto_costi_annuo: num(form.impatto_costi_annuo || 0), beneficio_annuo: num(form.beneficio_annuo || 0), tasso_attualizzazione_pct: num(form.tasso_attualizzazione_pct || 0),
      }
      const { error } = form.id ? await supabase.from('investimenti').update(riga).eq('id', form.id) : await supabase.from('investimenti').insert({ id: crypto.randomUUID(), ...riga })
      if (error) throw error
      setForm(null)
      await carica()
    } catch (e) {
      setErrore(e.message || 'Errore nel salvataggio')
    } finally {
      setSalvando(false)
    }
  }

  const elimina = async (id) => {
    if (!window.confirm('Eliminare questo investimento?')) return
    await supabase.from('investimenti').delete().eq('id', id)
    await carica()
  }

  const modifica = (r) =>
    setForm({ id: r.id, descrizione: r.descrizione, importo: String(r.importo), soggetto_iva: r.soggetto_iva, tranche: (r.tranche || []).map((t) => ({ mese: t.mese, pct: String(t.pct) })), impatto_costi_annuo: String(r.impatto_costi_annuo), beneficio_annuo: String(r.beneficio_annuo), tasso_attualizzazione_pct: String(r.tasso_attualizzazione_pct) })

  const anteprima = form && num(form.importo) > 0 ? calcolaPaybackInvestimento({ importo: num(form.importo), impatto_costi_annuo: num(form.impatto_costi_annuo || 0), beneficio_annuo: num(form.beneficio_annuo || 0), tasso_attualizzazione_pct: num(form.tasso_attualizzazione_pct || 0) }) : null

  const riquadroPayback = (p) =>
    p && (
      <div style={{ fontSize: 12, color: p.oltre_3_anni ? '#9a3412' : '#166534', background: p.oltre_3_anni ? '#fff7ed' : '#f0fdf4', border: `1px solid ${p.oltre_3_anni ? '#fed7aa' : '#bbf7d0'}`, borderRadius: 8, padding: 8, marginTop: 8 }}>
        {p.nota ? (
          p.nota
        ) : (
          <>
            Beneficio netto annuo {fmt(p.flusso_annuo)} € — payback semplice <strong>{p.payback_semplice.toFixed(1)} anni</strong>
            {p.payback_attualizzato != null ? `, attualizzato ${p.payback_attualizzato.toFixed(1)} anni` : ', attualizzato oltre 100 anni'}.
            {p.oltre_3_anni && ' Oltre 3 anni: richiedere un approfondimento o valutare il frazionamento in fasi (§2.5f).'}
          </>
        )}
      </div>
    )

  return (
    <div style={{ marginTop: 16 }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ color: '#1a3a5c', margin: 0, fontSize: 14 }}>Investimenti pianificati (CNDCEC §2.5f)</h3>
              <p style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55, margin: '4px 0 0' }}>
                Entrano nel piano di cassa alla prossima generazione della proiezione. Non inserire qui un investimento già presente tra i costi del budget: verrebbe contato due volte.
              </p>
            </div>
            {!form && (
              <button className="btn btn-primary btn-sm" onClick={() => setForm(vuoto())}>
                + Nuovo investimento
              </button>
            )}
          </div>
        </div>
      </div>

      {form && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Descrizione</label>
                <input className="form-control" value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Importo totale (€, netto IVA)</label>
                <input className="form-control" value={form.importo} onChange={(e) => setForm({ ...form, importo: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">IVA</label>
                <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                  <input type="checkbox" checked={form.soggetto_iva} onChange={(e) => setForm({ ...form, soggetto_iva: e.target.checked })} /> Soggetto a IVA (aliquota acquisti dell'azienda)
                </label>
              </div>
            </div>

            <label className="form-label">Tempistica dei pagamenti (es. 30% ordine, 40% consegna, 30% collaudo)</label>
            {form.tranche.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input type="month" className="form-control" style={{ maxWidth: 180 }} value={t.mese} onChange={(e) => setForm({ ...form, tranche: form.tranche.map((x, j) => (j === i ? { ...x, mese: e.target.value } : x)) })} />
                <input className="form-control" style={{ maxWidth: 100 }} value={t.pct} onChange={(e) => setForm({ ...form, tranche: form.tranche.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)) })} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>%</span>
                {form.tranche.length > 1 && (
                  <button className="btn btn-outline btn-sm" onClick={() => setForm({ ...form, tranche: form.tranche.filter((_, j) => j !== i) })}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button className="btn btn-outline btn-sm" onClick={() => setForm({ ...form, tranche: [...form.tranche, { mese: '', pct: '' }] })}>
              + Tranche
            </button>

            <div className="grid-3" style={{ marginTop: 12 }}>
              <div className="form-group">
                <label className="form-label">Impatto sui costi operativi (€/anno, + maggiori, − minori)</label>
                <input className="form-control" value={form.impatto_costi_annuo} onChange={(e) => setForm({ ...form, impatto_costi_annuo: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Risparmio o incremento di margine (€/anno)</label>
                <input className="form-control" value={form.beneficio_annuo} onChange={(e) => setForm({ ...form, beneficio_annuo: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Tasso di attualizzazione (%)</label>
                <input className="form-control" value={form.tasso_attualizzazione_pct} onChange={(e) => setForm({ ...form, tasso_attualizzazione_pct: e.target.value })} />
                <span style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55 }}>Il valore preimpostato (5%) è modificabile: scegli quello adatto all'azienda.</span>
              </div>
            </div>
            {riquadroPayback(anteprima)}
            {errore && <div className="alert alert-error" style={{ marginTop: 8 }}>{errore}</div>}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={salva} disabled={salvando}>
                {salvando ? 'Salvataggio...' : 'Salva investimento'}
              </button>
              <button className="btn btn-outline" onClick={() => { setForm(null); setErrore('') }}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {lista.length === 0 && !form && <div className="alert" style={{ background: '#eff6ff', color: '#1d4ed8' }}>ℹ️ Nessun investimento pianificato.</div>}
      {lista.map((r) => {
        const p = calcolaPaybackInvestimento(r)
        return (
          <div key={r.id} className="card" style={{ marginBottom: 12 }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.descrizione}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {fmt(r.importo)} € {r.soggetto_iva ? '+ IVA' : '(senza IVA)'} — {(r.tranche || []).map((t) => `${t.pct}% ${t.mese}`).join(' · ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => modifica(r)}>
                    ✏️
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => elimina(r.id)}>
                    🗑
                  </button>
                </div>
              </div>
              {riquadroPayback(p)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
