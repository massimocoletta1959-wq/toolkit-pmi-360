import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { proposteDaBilancio, statoProposta } from '../lib/bilanciAnalitici/abbina'

const TIPI_LIBRO_GIORNALE = ['prima_nota_precedente', 'prima_nota_corrente', 'libro_giornale_precedente', 'libro_giornale_corrente']
const fmt = (n) => (n == null ? '—' : n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const STATI = {
  nuovo: { testo: 'nuovo', colore: '#1d4ed8', sfondo: '#eff6ff' },
  uguale: { testo: 'già così', colore: '#15803d', sfondo: '#f0fdf4' },
  diverso: { testo: 'diverso dall\'attuale', colore: '#b45309', sfondo: '#fffbeb' },
  da_scegliere: { testo: 'da scegliere', colore: '#b91c1c', sfondo: '#fef2f2' },
}

// "Abbina dal documento": propone la Riclassificazione dei gruppi di conto partendo da un bilancio analitico
// (piano dei conti con sezioni e descrizioni) caricato in Documenti contabili. Ogni proposta si conferma, si
// cambia o si scarta; si salva solo cio' che e' spuntato, con le stesse regole della classificazione manuale.
export default function AbbinaDaDocumento({ aziendaId, vociSP, vociCEE, codiceLeggibile, renderSelectUnificato, onApplicato, onChiudi }) {
  const [documenti, setDocumenti] = useState([])
  const [docId, setDocId] = useState('')
  const [righe, setRighe] = useState([])
  const [giornale, setGiornale] = useState(null) // { nome, gruppi: { gruppo: saldo } }
  const [soloDaApplicare, setSoloDaApplicare] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState('')
  // classificazioni gia' salvate, lette qui dal database (la pagina le carica solo dopo aver scelto un documento)
  const [mappatureAz, setMappatureAz] = useState(null)
  useEffect(() => {
    supabase.from('mappature_conti').select('*').eq('azienda_id', aziendaId).eq('globale', false)
      .then(({ data }) => setMappatureAz(data || []))
  }, [aziendaId])

  useEffect(() => {
    supabase.from('documenti').select('id, nome_file, anno, caricato_il').eq('azienda_id', aziendaId).eq('tipo_documento', 'bilancio_analitico').eq('stato', 'elaborato')
      .order('anno', { ascending: false })
      .then(({ data }) => {
        setDocumenti(data || [])
        if (data?.length === 1) setDocId(data[0].id)
      })
  }, [aziendaId])

  const valoreAttuale = (gruppo) => {
    const m = mappatureAz.find((x) => x.conto_origine === gruppo)
    return m?.codice_cee ? `${m.categoria === 'attivita' || m.categoria === 'passivita' ? 'sp' : 'cee'}:${m.codice_cee}` : ''
  }
  const etichetta = (valore) => {
    if (!valore) return '—'
    const [tipo, codice] = valore.split(':')
    const v = (tipo === 'sp' ? vociSP : vociCEE).find((x) => x.codice === codice)
    return v ? `${codiceLeggibile(codice)} — ${v.descrizione.trim()}` : valore
  }

  useEffect(() => {
    if (!docId || !mappatureAz) { setRighe([]); setGiornale(null); return }
    setErrore('')
    ;(async () => {
      const { data: doc } = await supabase.from('documenti').select('dati_estratti, anno').eq('id', docId).single()
      let bilancio
      try { bilancio = JSON.parse(doc.dati_estratti) } catch { setErrore('Dati del documento non leggibili: rielaboralo in Documenti contabili.'); return }
      const proposte = proposteDaBilancio(bilancio)
      setRighe(proposte.map((p) => {
        const attuale = valoreAttuale(p.gruppo)
        const stato = statoProposta(p.proposta, attuale)
        return { ...p, attuale, valore: p.proposta || attuale || '', stato, sel: stato === 'nuovo' }
      }))
      // controllo incrociato con il libro giornale dello stesso esercizio (saldi per gruppo)
      const { data: lg } = await supabase.from('documenti').select('nome_file, dati_estratti').eq('azienda_id', aziendaId).eq('anno', String(bilancio.anno || doc.anno))
        .in('tipo_documento', TIPI_LIBRO_GIORNALE).eq('stato', 'elaborato').limit(1)
      if (lg?.[0]) {
        try {
          const gruppi = {}
          for (const g of JSON.parse(lg[0].dati_estratti).gruppi || []) gruppi[g.gruppo] = g.importo
          setGiornale({ nome: lg[0].nome_file, gruppi })
        } catch { setGiornale(null) }
      } else setGiornale(null)
    })()
  }, [docId, mappatureAz])

  const aggiorna = (gruppo, campi) => setRighe((prev) => prev.map((r) => (r.gruppo === gruppo ? { ...r, ...campi } : r)))
  const visibili = useMemo(() => righe.filter((r) => !soloDaApplicare || r.stato !== 'uguale'), [righe, soloDaApplicare])
  const scelte = righe.filter((r) => r.sel && r.valore && r.valore !== r.attuale)
  const conteggio = (s) => righe.filter((r) => r.stato === s).length
  const differenze = giornale ? righe.filter((r) => Math.abs((giornale.gruppi[r.gruppo] ?? 0) - r.saldo) > 1).length : 0

  const parse = (valore) => {
    const [tipo, codice] = valore.split(':')
    if (tipo === 'sp') {
      const v = vociSP.find((x) => x.codice === codice)
      return v ? { voce: v.descrizione.trim(), categoria: v.tipo, codice } : null
    }
    const v = vociCEE.find((x) => x.codice === codice)
    return v ? { voce: v.descrizione, categoria: v.tipo === 'ricavo' ? 'ricavi' : 'costi', codice } : null
  }

  const applica = async () => {
    setSalvando(true)
    setErrore('')
    try {
      const nuove = scelte.map((r) => {
        const p = parse(r.valore)
        return p && { id: crypto.randomUUID(), azienda_id: aziendaId, conto_origine: r.gruppo, voce_budget_descrizione: p.voce, categoria: p.categoria, codice_cee: p.codice, globale: false, creata_il: new Date().toISOString() }
      }).filter(Boolean)
      if (!nuove.length) return
      const { error: delErr } = await supabase.from('mappature_conti').delete().eq('azienda_id', aziendaId).eq('globale', false).in('conto_origine', nuove.map((m) => m.conto_origine))
      if (delErr) throw new Error(delErr.message)
      const { error } = await supabase.from('mappature_conti').insert(nuove)
      if (error) throw new Error(error.message)
      await onApplicato(nuove)
    } catch (e) {
      setErrore(`Salvataggio non riuscito: ${e.message}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onChiudi()}>
      <div className="modal" style={{ maxWidth: 1100, width: '100%' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Abbina dal documento</div>
            <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 2 }}>
              Proposte ricavate dal bilancio analitico (sezione e descrizione di ogni gruppo del piano dei conti). Spunta ciò che vuoi applicare.
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onChiudi}>✕</button>
        </div>

        {documenti.length === 0 ? (
          <div className="alert alert-info">Nessun bilancio analitico elaborato per questa azienda: caricalo in <strong>Documenti contabili</strong> con il tipo «Bilancio analitico (piano dei conti)» ed elaboralo.</div>
        ) : (
          <div className="form-group">
            <label className="form-label">Documento</label>
            <select className="form-control" value={docId} onChange={(e) => setDocId(e.target.value)}>
              <option value="">Scegli il bilancio analitico...</option>
              {documenti.map((d) => <option key={d.id} value={d.id}>{d.nome_file} — {d.anno}</option>)}
            </select>
          </div>
        )}
        {errore && <div className="alert alert-error">{errore}</div>}

        {righe.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, marginBottom: 8 }}>
              <span>{righe.length} gruppi:</span>
              {Object.entries(STATI).map(([k, s]) => <span key={k} style={{ color: s.colore }}>{conteggio(k)} {s.testo}</span>)}
              {giornale
                ? <span style={{ color: differenze ? '#b45309' : '#15803d' }}>Confronto con «{giornale.nome}»: {differenze ? `${differenze} gruppi con saldo diverso` : 'tutti i saldi coincidono'}</span>
                : <span style={{ color: '#6b7280' }}>Nessun libro giornale dello stesso esercizio per il confronto dei saldi</span>}
              <label style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={soloDaApplicare} onChange={(e) => setSoloDaApplicare(e.target.checked)} /> nascondi quelli già così
              </label>
            </div>
            <div style={{ maxHeight: '58vh', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                  <tr>
                    <th style={{ width: 30 }} />
                    <th>Gruppo nel bilancio</th>
                    <th style={{ textAlign: 'right' }}>Saldo</th>
                    {giornale && <th style={{ textAlign: 'right' }}>Libro giornale</th>}
                    <th>Voce proposta</th>
                    <th>Classificazione attuale</th>
                  </tr>
                </thead>
                <tbody>
                  {visibili.map((r) => {
                    const s = STATI[r.stato]
                    const saldoLg = giornale?.gruppi[r.gruppo]
                    const diff = giornale && Math.abs((saldoLg ?? 0) - r.saldo) > 1
                    return (
                      <tr key={r.gruppo} style={{ background: s.sfondo }}>
                        <td><input type="checkbox" checked={r.sel} disabled={r.stato === 'uguale' && r.valore === r.attuale} onChange={(e) => aggiorna(r.gruppo, { sel: e.target.checked })} /></td>
                        <td>
                          <strong>{r.gruppo}</strong> — {r.descrizione}
                          <div style={{ color: '#6b7280', fontSize: 11.5 }}>{r.lato}{r.regola === 'descrizione del mastro' ? ` · dal mastro «${r.mastro}»` : ''}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{fmt(r.saldo)}</td>
                        {giornale && <td style={{ textAlign: 'right', color: diff ? '#b45309' : '#15803d' }}>{saldoLg == null ? '—' : fmt(saldoLg)}{diff ? ' ⚠️' : ' ✓'}</td>}
                        <td style={{ minWidth: 300 }}>
                          {renderSelectUnificato(r.valore, (v) => aggiorna(r.gruppo, { valore: v, sel: !!v && v !== r.attuale }))}
                          <div style={{ color: s.colore, fontSize: 11.5, marginTop: 2 }}>{s.testo}</div>
                        </td>
                        <td style={{ color: '#4b5563' }}>{etichetta(r.attuale)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="modal-footer">
          <button className="btn" onClick={onChiudi}>Chiudi</button>
          <button className="btn btn-primary" disabled={!scelte.length || salvando} onClick={applica}>
            {salvando ? 'Salvataggio…' : `Applica ${scelte.length} abbinament${scelte.length === 1 ? 'o' : 'i'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
