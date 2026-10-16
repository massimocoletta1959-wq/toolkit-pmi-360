import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { settoriCatalogo, scegliPerSettore } from '../lib/procedure'

// ============================================================
//  Editor procedura — Strada A (testo per sezioni)
//  Modalita':
//   - 'azienda'  : personalizza SOLO per l'azienda attiva (copia personale)
//   - 'standard' : modifica la LIBRERIA STANDARD del settore (solo proprietario)
//  Modifica le sezioni dalla 2 alla 8. La 1 e la 9 restano invariate.
//  Al salvataggio la sezione 4 (Fasi) viene rinumerata.
// ============================================================

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// costruttori di riga (replicano ESATTAMENTE lo stampo del generatore)
const rowRiferimenti = r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td></tr>`
const rowFasi = (r, i) => `<tr><td><strong>${i + 1}</strong></td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`
const rowRaci = r => `<tr><td><strong>${esc(r[0])}</strong></td>${r.slice(1).map(v => `<td>${esc(v)}</td>`).join('')}</tr>`
const rowFlussi = r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td>→</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td><blockquote><p>${esc(r[5])}</p></blockquote></td></tr>`
const rowKpi = r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`
const rowAnomalie = r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`

function leggiRighe(table) {
  return Array.from(table.querySelectorAll('tbody tr')).map(tr =>
    Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()))
}

// smonta il corpo_html nelle sezioni modificabili
function parseCorpo(html) {
  const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html')
  const t = Array.from(doc.querySelectorAll('table'))
  // ordine tabelle: 0 scheda, 1 riferimenti, 2 fasi, 3 raci, 4 flussi, 5 kpi, 6 anomalie, 7 revisioni
  const haScopo = Array.from(doc.querySelectorAll('blockquote')).some(bq => bq.textContent.includes('2 Scopo e Campo'))
  if (t.length < 7 || !haScopo) {
    const e = new Error('Questa procedura non ha il formato standard a sezioni e non puo\' essere aperta con questo editor. (Le procedure generate dalla libreria lo supportano.)')
    e.formato = true
    throw e
  }
  const fasiRaw = leggiRighe(t[2])
  const flussiRaw = leggiRighe(t[4])
  const raciCols = Array.from(t[3].querySelectorAll('thead th')).map(th => th.textContent.trim())
  // scopo (sez.2): i <p> senza <strong> nel blockquote che contiene "2 Scopo"
  let scopo = []
  for (const bq of Array.from(doc.querySelectorAll('blockquote'))) {
    if (bq.textContent.includes('2 Scopo e Campo')) {
      scopo = Array.from(bq.querySelectorAll('p')).filter(x => !x.querySelector('strong'))
        .map(x => x.textContent.trim()).filter(Boolean)
    }
  }
  return {
    scopo,
    rif: leggiRighe(t[1]),
    fasi: fasiRaw.map(r => [r[1], r[2], r[3]]),
    raciCols,
    raci: leggiRighe(t[3]),
    flussi: flussiRaw.map(r => [r[0], r[1], r[3], r[4], r[5], r[6]]),
    kpi: leggiRighe(t[5]),
    anom: leggiRighe(t[6]),
  }
}

// rimonta il corpo_html a partire dall'originale + i dati modificati
function serializzaCorpo(htmlBase, d) {
  const doc = new DOMParser().parseFromString('<body>' + htmlBase + '</body>', 'text/html')
  const t = Array.from(doc.querySelectorAll('table'))
  const set = (tab, html) => { const tb = tab.querySelector('tbody'); if (tb) tb.innerHTML = html }
  set(t[1], d.rif.map(rowRiferimenti).join(''))
  set(t[2], d.fasi.map((r, i) => rowFasi(r, i)).join(''))   // rinumerazione automatica
  set(t[3], d.raci.map(rowRaci).join(''))
  set(t[4], d.flussi.map(rowFlussi).join(''))
  set(t[5], d.kpi.map(rowKpi).join(''))
  set(t[6], d.anom.map(rowAnomalie).join(''))
  // scopo
  for (const bq of Array.from(doc.querySelectorAll('blockquote'))) {
    if (bq.textContent.includes('2 Scopo e Campo')) {
      const ps = Array.from(bq.querySelectorAll('p'))
      const i2 = ps.findIndex(x => x.textContent.includes('2 Scopo e Campo'))
      const i3 = ps.findIndex(x => x.textContent.includes('3 Riferimenti'))
      for (let k = i3 - 1; k > i2; k--) ps[k].remove()
      const anchor = ps[i2]
      d.scopo.slice().reverse().forEach(txt => {
        const np = doc.createElement('p'); np.textContent = txt
        anchor.parentNode.insertBefore(np, anchor.nextSibling)
      })
    }
  }
  return doc.body.innerHTML
}

// ---- componenti UI ----

function BtnRiga({ onIns, onDel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center' }}>
      <button type="button" title="Inserisci una riga sotto" onClick={onIns}
        style={{ border: '1px solid #CBD5E0', background: '#F7FAFC', borderRadius: 4, cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: '2px 5px' }}>＋</button>
      <button type="button" title="Cancella questa riga" onClick={onDel}
        style={{ border: '1px solid #FEB2B2', background: '#FFF5F5', color: '#C53030', borderRadius: 4, cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: '2px 5px' }}>🗑</button>
    </div>
  )
}

// tabella generica: cols = etichette colonne dati; long = indici colonne "testo lungo"
function SezioneTabella({ titolo, cols, rows, setRows, long = [], numerata = false, strette = [] }) {
  const nuovaRiga = () => cols.map(() => '')
  const setCell = (ri, ci, v) => { const c = rows.map(r => r.slice()); c[ri][ci] = v; setRows(c) }
  const insDopo = ri => { const c = rows.map(r => r.slice()); c.splice(ri + 1, 0, nuovaRiga()); setRows(c) }
  const del = ri => { const c = rows.map(r => r.slice()); c.splice(ri, 1); setRows(c) }
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 700, color: '#1A3A5C', marginBottom: 6 }}>{titolo}</div>
      <div style={{ display: 'flex', gap: 8, padding: '2px 0', fontSize: 11, color: '#718096', fontWeight: 600 }}>
        {numerata && <div style={{ width: 24 }}>#</div>}
        {cols.map((c, i) => <div key={i} style={{ flex: strette.includes(i) ? '0 0 70px' : 1 }}>{c}</div>)}
        <div style={{ width: 34 }}></div>
      </div>
      {rows.length === 0 && <div style={{ fontSize: 12, color: '#A0AEC0', fontStyle: 'italic', padding: '4px 0' }}>Nessuna riga. Usa "Aggiungi riga" qui sotto.</div>}
      {rows.map((r, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 6 }}>
          {numerata && <div style={{ width: 24, display: 'flex', alignItems: 'center', color: '#A0AEC0', fontWeight: 700, fontSize: 13 }}>{ri + 1}</div>}
          {cols.map((c, ci) => (
            <div key={ci} style={{ flex: strette.includes(ci) ? '0 0 70px' : 1 }}>
              {long.includes(ci)
                ? <textarea className="form-control" style={{ width: '100%', fontSize: 12, minHeight: 54, resize: 'vertical' }} value={r[ci] || ''} onChange={e => setCell(ri, ci, e.target.value)} />
                : <input className="form-control" style={{ width: '100%', fontSize: 12 }} value={r[ci] || ''} onChange={e => setCell(ri, ci, e.target.value)} />}
            </div>
          ))}
          <BtnRiga onIns={() => insDopo(ri)} onDel={() => del(ri)} />
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, nuovaRiga()])}
        style={{ border: '1px dashed #90CDF4', background: '#EBF8FF', color: '#2B6CB0', borderRadius: 6, cursor: 'pointer', fontSize: 12, padding: '5px 12px', marginTop: 2 }}>＋ Aggiungi riga</button>
    </div>
  )
}

function SezioneScopo({ scopo, setScopo }) {
  const set = (i, v) => { const c = scopo.slice(); c[i] = v; setScopo(c) }
  const ins = i => { const c = scopo.slice(); c.splice(i + 1, 0, ''); setScopo(c) }
  const del = i => { const c = scopo.slice(); c.splice(i, 1); setScopo(c) }
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 700, color: '#1A3A5C', marginBottom: 6 }}>2 — Scopo e Campo di Applicazione</div>
      {scopo.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <textarea className="form-control" style={{ flex: 1, fontSize: 12, minHeight: 60, resize: 'vertical' }} value={p} onChange={e => set(i, e.target.value)} />
          <BtnRiga onIns={() => ins(i)} onDel={() => del(i)} />
        </div>
      ))}
      <button type="button" onClick={() => setScopo([...scopo, ''])}
        style={{ border: '1px dashed #90CDF4', background: '#EBF8FF', color: '#2B6CB0', borderRadius: 6, cursor: 'pointer', fontSize: 12, padding: '5px 12px' }}>＋ Aggiungi paragrafo</button>
    </div>
  )
}

export default function EditorProcedura({ proc, azienda, modo, onClose, onSaved }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [baseHtml, setBaseHtml] = useState('')
  const [d, setD] = useState(null)   // dati sezioni

  const isStandard = modo === 'standard'

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        let base = null
        if (isStandard) {
          // modifica lo STANDARD del settore (o generico come ripiego)
          const { data: tpls } = await supabase.from('procedure_template')
            .select('corpo_html, settore').eq('codice', proc.codice)
            .in('settore', settoriCatalogo(azienda))
          const tpl = scegliPerSettore(azienda, tpls)
          base = tpl?.corpo_html || null
        } else {
          // personalizza per l'AZIENDA: usa la copia personale se c'e', altrimenti parti dallo standard
          const { data: az } = await supabase.from('procedure_azienda')
            .select('corpo_html').eq('azienda_id', azienda.id).eq('codice', proc.codice).maybeSingle()
          if (az?.corpo_html && az.corpo_html.trim()) base = az.corpo_html
          if (!base) {
            const { data: tpls } = await supabase.from('procedure_template')
              .select('corpo_html, settore').eq('codice', proc.codice)
              .in('settore', settoriCatalogo(azienda))
            const tpl = scegliPerSettore(azienda, tpls)
            base = tpl?.corpo_html || null
          }
        }
        if (!base) throw new Error('Testo della procedura non trovato.')
        const parsed = parseCorpo(base)
        if (!vivo) return
        setBaseHtml(base)
        setD(parsed)
        setLoading(false)
      } catch (e) {
        if (vivo) { setError(e.message || 'Errore di caricamento.'); setLoading(false) }
      }
    })()
    return () => { vivo = false }
  }, [proc.codice, azienda.id, azienda.settore, isStandard])

  async function salva() {
    setSaving(true); setError(null)
    try {
      const nuovo = serializzaCorpo(baseHtml, d)
      if (isStandard) {
        // scrive sullo STANDARD da cui viene la procedura (settore dell'azienda, o procedura riservata all'azienda)
        const { error: err } = await supabase.from('procedure_template')
          .update({ corpo_html: nuovo }).eq('codice', proc.codice).eq('settore', proc.settore || azienda.settore)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('procedure_azienda')
          .upsert({ azienda_id: azienda.id, codice: proc.codice, corpo_html: nuovo, stato: 'Personalizzata' },
                  { onConflict: 'azienda_id,codice' })
        if (err) throw err
      }
      onSaved && onSaved(isStandard)
    } catch (e) {
      setError(e.message || 'Errore nel salvataggio.')
      setSaving(false)
    }
  }

  const upd = campo => val => setD({ ...d, [campo]: val })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflow: 'auto' }}>
      <div className="card" style={{ maxWidth: 900, width: '100%', margin: '10px 0' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">✏️ {proc.codice} — {proc.titolo}</span>
          <button className="btn btn-sm" onClick={onClose} disabled={saving}>✕ Chiudi</button>
        </div>
        <div className="card-body">
          {/* avviso di modalita' */}
          {isStandard ? (
            <div style={{ background: '#FFF5F5', border: '1px solid #FEB2B2', color: '#9B2C2C', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 13 }}>
              ⚠️ <strong>Stai modificando lo STANDARD del settore {azienda.settore}.</strong> La modifica varra' per <strong>tutte</strong> le aziende dello stesso settore che non hanno una versione personalizzata.
            </div>
          ) : (
            <div style={{ background: '#EBF8FF', border: '1px solid #90CDF4', color: '#2C5282', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 13 }}>
              Stai personalizzando questa procedura <strong>solo per {azienda.nome}</strong>. Lo standard e le altre aziende non verranno toccati.
            </div>
          )}

          {loading && <div style={{ padding: 20, textAlign: 'center', color: '#718096' }}>Caricamento…</div>}
          {error && <div style={{ background: '#FFF5F5', border: '1px solid #FEB2B2', color: '#C53030', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 13 }}>{error}</div>}

          {!loading && d && (
            <>
              <div style={{ fontSize: 12, color: '#718096', marginBottom: 16 }}>
                Le sigle tra doppie parentesi (es. <code>{'{{AZIENDA}}'}</code>) vengono sostituite automaticamente in stampa: puoi lasciarle.
              </div>

              <SezioneScopo scopo={d.scopo} setScopo={upd('scopo')} />

              <SezioneTabella titolo="3 — Riferimenti Normativi"
                cols={['Riferimento normativo', 'Descrizione']} long={[1]}
                rows={d.rif} setRows={upd('rif')} />

              <SezioneTabella titolo="4 — Fasi Operative (il numero si aggiorna da solo)"
                cols={['Fase', 'Responsabile', 'Descrizione']} long={[2]} numerata
                rows={d.fasi} setRows={upd('fasi')} />

              <SezioneTabella titolo="5 — Matrice RACI (R/A/C/I per ogni ruolo)"
                cols={d.raciCols} strette={d.raciCols.map((_, i) => i).filter(i => i > 0)}
                rows={d.raci} setRows={upd('raci')} />

              <SezioneTabella titolo="6 — Flussi Informativi"
                cols={['Documento', 'Generato da', 'Destinato a', 'Formato', 'Entro', 'Archiviazione']}
                rows={d.flussi} setRows={upd('flussi')} />

              <SezioneTabella titolo="7 — KPI e Indicatori"
                cols={['Indicatore', 'Target', 'Frequenza']}
                rows={d.kpi} setRows={upd('kpi')} />

              <SezioneTabella titolo="8 — Gestione Anomalie"
                cols={['Anomalia', 'Causa', 'Azione']} long={[1, 2]}
                rows={d.anom} setRows={upd('anom')} />

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: 14, position: 'sticky', bottom: 0, background: '#fff' }}>
                <button className="btn" onClick={onClose} disabled={saving}>Annulla</button>
                <button className="btn btn-primary" onClick={salva} disabled={saving}>
                  {saving ? 'Salvataggio…' : (isStandard ? '💾 Salva nello standard' : '💾 Salva per questa azienda')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
