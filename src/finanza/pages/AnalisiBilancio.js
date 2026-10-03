import React, { useEffect, useState } from 'react'
import { useApp } from '../../App'
import { supabase } from '../lib/supabase'
import { estraiDati, calcolaIndici, costruisciPrompt, fmtEur, fmtPct, fmtX } from '../lib/analisiNarrativa'
import { configCe, configRischio, configEconomica, configPatrimonialeStruttura, configPatrimonialeFonti, configCashflow, configSettore, configStrategie, configScorecard, configGaugeRating, RATING_SCORE } from '../lib/graficiAnalisi'
import Grafico from '../components/Grafico'

const RATING_COLORE = {
  'BBB+': 'kpi-green', BBB: 'kpi-green', 'BBB-': 'kpi-green',
  'BB+': 'kpi-blue', BB: 'kpi-blue', 'BB-': 'kpi-blue',
  'B+': 'kpi-orange', B: 'kpi-orange',
}
const RATING_HEX = {
  'BBB+': '#1a6b2e', BBB: '#1a6b2e', 'BBB-': '#2d8a45',
  'BB+': '#185fa5', BB: '#185fa5', 'BB-': '#2172c4',
  'B+': '#854f0b', B: '#854f0b',
}

const SEZIONI = [
  { key: 'sintesi', label: 'Sintesi esecutiva' },
  { key: 'rischio', label: 'Profilo di rischio' },
  { key: 'economica', label: 'Analisi economica' },
  { key: 'patrimoniale', label: 'Analisi patrimoniale' },
  { key: 'cashflow', label: 'Cash flow' },
  { key: 'settore', label: 'Posizionamento settoriale' },
  { key: 'strategie', label: 'Strategie consigliate' },
  { key: 'conclusioni', label: 'Conclusioni' },
]

// Messaggi mostrati durante la generazione: la chiamata AI e' un'unica
// richiesta sincrona (nessun endpoint di stato lato server), quindi
// l'avanzamento e' simulato a tempo (stessa logica della versione Mac:
// 6 step, un avanzamento ogni 7.5s, fino all'85%, poi 100% a risposta
// ricevuta) solo per dare un riscontro visivo durante l'attesa.
const STEP_MSGS = ['Lettura dati di bilancio...', 'Calcolo indici finanziari...', 'Analisi Z-Score e leva...', 'Generazione testo con AI...', 'Elaborazione sezioni...', 'Finalizzazione report...']
const STEP_LABELS = ['Dati', 'Indici', 'Z-Score', 'AI', 'Sezioni', 'Fine']

export default function AnalisiBilancio() {
  const [aziende, setAziende] = useState([])
  // Pmi 360°: l'azienda è quella attiva dell'app (niente selettore nella pagina)
  const { azienda: aziendaAttiva } = useApp()
  const aziendaId = aziendaAttiva?.id || ''
  const [documenti, setDocumenti] = useState([])
  const [docIdCorrente, setDocIdCorrente] = useState('')
  const [docIdPrecedente, setDocIdPrecedente] = useState('')
  const [tab, setTab] = useState('indici')

  const [indCorr, setIndCorr] = useState(null)
  const [indPrev, setIndPrev] = useState(null)
  const [errore, setErrore] = useState('')

  const [narrativa, setNarrativa] = useState(null)
  const [narrativaSalvataIl, setNarrativaSalvataIl] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [progressoMsg, setProgressoMsg] = useState('')
  const [progressoPct, setProgressoPct] = useState(0)

  useEffect(() => {
    supabase
      .from('aziende')
      .select('id, nome, partita_iva')
      .order('nome')
      .then(({ data }) => setAziende(data || []))
  }, [])

  useEffect(() => {
    if (aziendaId) {
      supabase
        .from('documenti')
        .select('*')
        .eq('azienda_id', aziendaId)
        .eq('stato', 'elaborato')
        .order('anno', { ascending: false })
        .then(({ data }) => setDocumenti(data || []))
      setDocIdCorrente('')
      setDocIdPrecedente('')
      setIndCorr(null)
      setIndPrev(null)
      setNarrativa(null)
      setNarrativaSalvataIl(null)
    }
  }, [aziendaId])

  const calcolaIndiciDocumenti = async () => {
    setErrore('')
    setNarrativa(null)
    setNarrativaSalvataIl(null)
    try {
      const docCorr = documenti.find((d) => d.id === docIdCorrente)
      const datiCorr = estraiDati(docCorr)
      if (!datiCorr) {
        setErrore('Impossibile leggere i dati dal documento corrente.')
        return
      }
      setIndCorr(calcolaIndici(datiCorr, docCorr.mese_fine))

      if (docIdPrecedente) {
        const docPrev = documenti.find((d) => d.id === docIdPrecedente)
        const datiPrev = estraiDati(docPrev)
        setIndPrev(datiPrev ? calcolaIndici(datiPrev, docPrev.mese_fine) : null)
      } else {
        setIndPrev(null)
      }

      // Se esiste già una narrativa salvata per questo documento, la mostriamo
      // subito senza dover rigenerare (stesso comportamento di get_narrativa_salvata).
      const { data: salvata } = await supabase.from('narrativa_report').select('*').eq('azienda_id', aziendaId).eq('doc_id_corrente', docIdCorrente).order('generata_il', { ascending: false }).limit(1).maybeSingle()
      if (salvata) {
        setNarrativa(salvata.narrativa)
        setNarrativaSalvataIl(salvata.generata_il)
      }
    } catch (e) {
      setErrore(e.message || 'Errore nel calcolo degli indici')
    }
  }

  const generaNarrativa = async () => {
    if (!indCorr) return
    setGenerando(true)
    setErrore('')
    setProgressoPct(0)
    setProgressoMsg(STEP_MSGS[0])
    let step = 0
    const timer = setInterval(() => {
      step = Math.min(step + 1, STEP_MSGS.length - 1)
      setProgressoMsg(STEP_MSGS[step])
      setProgressoPct(Math.round((step / (STEP_MSGS.length - 1)) * 85))
    }, 7500)
    try {
      const azienda = aziende.find((a) => a.id === aziendaId)
      const prompt = costruisciPrompt(azienda, indCorr, indPrev)

      const { data: risposta, error: fnErr } = await supabase.functions.invoke('genera-narrativa', { body: { prompt } })
      if (fnErr) {
        let messaggio = fnErr.message
        try {
          const body = await fnErr.context.json()
          if (body?.errore) messaggio = body.errore
        } catch {
          // mantieni messaggio generico
        }
        throw new Error(messaggio)
      }
      if (risposta?.errore) throw new Error(risposta.errore)

      const risultato = {
        ...risposta,
        anno_corrente: indCorr.anno,
        anno_precedente: indPrev?.anno || null,
        periodo_corrente: indCorr.periodo_label,
        is_infrannuale_corrente: indCorr.is_infrannuale,
      }

      const now = new Date().toISOString()
      const { error: upErr } = await supabase.from('narrativa_report').upsert(
        {
          azienda_id: aziendaId,
          doc_id_corrente: docIdCorrente,
          doc_id_precedente: docIdPrecedente || null,
          anno_corrente: risultato.anno_corrente,
          anno_precedente: risultato.anno_precedente,
          rating: risultato.rating,
          narrativa: risultato,
          generata_il: now,
        },
        { onConflict: 'azienda_id,doc_id_corrente' }
      )
      if (upErr) throw new Error(upErr.message)

      clearInterval(timer)
      setProgressoPct(100)
      setProgressoMsg('Report completato!')
      setTimeout(() => {
        setNarrativa(risultato)
        setNarrativaSalvataIl(now)
        setTab('narrativa')
        setGenerando(false)
      }, 400)
    } catch (e) {
      clearInterval(timer)
      setErrore(e.message || 'Errore nella generazione della narrativa')
      setGenerando(false)
    }
  }

  const IndiciTable = ({ ind, indB }) => (
    <table className="table">
      <tbody>
        {[
          ['Periodo', ind.periodo_label, null],
          ['Ricavi', fmtEur(ind.ricavi), indB && fmtEur(indB.ricavi)],
          ['Costi', fmtEur(ind.costi), indB && fmtEur(indB.costi)],
          ['EBIT', fmtEur(ind.ebit), indB && fmtEur(indB.ebit)],
          ['EBITDA', fmtEur(ind.ebitda), indB && fmtEur(indB.ebitda)],
          ['Utile netto', fmtEur(ind.utile), indB && fmtEur(indB.utile)],
          ['Totale attivo', fmtEur(ind.tot_attivo), indB && fmtEur(indB.tot_attivo)],
          ['Patrimonio netto', fmtEur(ind.pn), indB && fmtEur(indB.pn)],
          ['Totale debiti', fmtEur(ind.tot_debiti), indB && fmtEur(indB.tot_debiti)],
          ['ROI (annualizzato)', fmtPct(ind.roi), indB && fmtPct(indB.roi)],
          ['ROS', fmtPct(ind.ros), indB && fmtPct(indB.ros)],
          ['ROE (annualizzato)', fmtPct(ind.roe), indB && fmtPct(indB.roe)],
          ['ROT', fmtX(ind.rot), indB && fmtX(indB.rot)],
          ['EBITDA margin', fmtPct(ind.ebitda_margin), indB && fmtPct(indB.ebitda_margin)],
          ['CCN', fmtEur(ind.ccn), indB && fmtEur(indB.ccn)],
          ['Current ratio', fmtX(ind.current_ratio), indB && fmtX(indB.current_ratio)],
          ['Leva (D/E)', fmtX(ind.lev), indB && fmtX(indB.lev)],
          ['DSO', ind.dso ? `${ind.dso.toFixed(0)} gg` : 'N/D', indB && (indB.dso ? `${indB.dso.toFixed(0)} gg` : 'N/D')],
          ['Debiti/EBITDA', fmtX(ind.debiti_ebitda), indB && fmtX(indB.debiti_ebitda)],
        ].map(([label, v1, v2]) => (
          <tr key={label}>
            <td style={{ color: '#6b7280' }}>{label}</td>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>{v1}</td>
            {indB !== undefined && <td style={{ textAlign: 'right', color: '#6b7280' }}>{v2 ?? '—'}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )

  const azienda = aziende.find((a) => a.id === aziendaId)

  const GraficoSezione = ({ chiave }) => {
    if (!indCorr) return null
    const annoC = narrativa?.anno_corrente || indCorr.anno
    const annoP = narrativa?.anno_precedente || indPrev?.anno
    switch (chiave) {
      case 'sintesi':
        return <Grafico config={configCe(indCorr, indPrev, annoC, annoP)} height={230} />
      case 'rischio':
        return <Grafico config={configRischio(indCorr)} height={230} />
      case 'economica':
        return <Grafico config={configEconomica(indCorr)} height={230} />
      case 'patrimoniale':
        return (
          <div className="grid-2" style={{ marginBottom: 16, gap: 16 }}>
            <Grafico config={configPatrimonialeStruttura(indCorr)} height={220} />
            <Grafico config={configPatrimonialeFonti(indCorr)} height={220} />
          </div>
        )
      case 'cashflow':
        return <Grafico config={configCashflow(indCorr)} height={230} />
      case 'settore':
        return <Grafico config={configSettore(indCorr)} height={270} />
      case 'strategie':
        return <Grafico config={configStrategie(indCorr, annoC)} height={230} />
      case 'conclusioni': {
        const rating = narrativa?.rating
        const score = RATING_SCORE[rating] ?? 0.5
        // Chart.js non mostra testo al centro di una doughnut nativamente:
        // l'etichetta del rating e' sovrapposta in posizione assoluta.
        const angle = Math.PI * (1 - score)
        return (
          <div className="grid-2" style={{ marginBottom: 16, gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <Grafico config={configGaugeRating(rating)} height={200} />
              <div style={{ position: 'absolute', top: '62%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: RATING_HEX[rating] || '#185fa5' }}>{rating || 'N/D'}</div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: '62%',
                  left: '50%',
                  width: 2,
                  height: 55,
                  background: '#1e293b',
                  transformOrigin: 'bottom center',
                  transform: `translate(-50%, -100%) rotate(${90 - (angle * 180) / Math.PI}deg)`,
                  pointerEvents: 'none',
                }}
              />
            </div>
            <Grafico config={configScorecard(indCorr)} height={200} />
          </div>
        )
      }
      default:
        return null
    }
  }

  return (
    <div>
      <h2 className="no-print" style={{ color: '#1a3a5c', marginTop: 0 }}>
        Analisi Bilancio
      </h2>
      <p className="no-print" style={{ color: '#666', marginTop: -8, marginBottom: 20 }}>
        Indici finanziari e report narrativo AI, con gestione corretta di bilanci infrannuali/provvisori
      </p>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div className="grid-3">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Azienda</label>
              <select className="form-control" value={aziendaId} disabled title="Azienda attiva di Pmi 360°: si cambia dal menu laterale">
                <option value="">Seleziona azienda...</option>
                {aziende.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Documento corrente</label>
              <select className="form-control" value={docIdCorrente} onChange={(e) => setDocIdCorrente(e.target.value)} disabled={!aziendaId}>
                <option value="">Seleziona documento...</option>
                {documenti.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome_file} — {d.anno}
                    {d.mese_fine ? ` (fino a mese ${d.mese_fine})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Documento precedente (opzionale, per confronto)</label>
              <select className="form-control" value={docIdPrecedente} onChange={(e) => setDocIdPrecedente(e.target.value)} disabled={!aziendaId}>
                <option value="">Nessuno</option>
                {documenti
                  .filter((d) => d.id !== docIdCorrente)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome_file} — {d.anno}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={calcolaIndiciDocumenti} disabled={!docIdCorrente}>
            Calcola indici
          </button>
          {errore && (
            <div className="alert alert-error" style={{ marginTop: 14, marginBottom: 0 }}>
              {errore}
            </div>
          )}
        </div>
      </div>

      {indCorr && (
        <>
          <div className="print-only" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c' }}>{azienda?.nome || ''}</div>
            <div style={{ fontSize: 13, color: '#555' }}>Analisi Bilancio — {narrativa?.periodo_corrente || indCorr.periodo_label}</div>
          </div>

          <div className="tesoreria-tabs no-print">
            <button className={`tesoreria-tab${tab === 'indici' ? ' active' : ''}`} onClick={() => setTab('indici')}>
              📊 Indici
            </button>
            <button className={`tesoreria-tab${tab === 'narrativa' ? ' active' : ''}`} onClick={() => setTab('narrativa')}>
              📝 Narrativa AI
            </button>
          </div>

          {tab === 'indici' && (
            <div className="card table-scroll" style={{ marginTop: 16 }}>
              <div className="card-header">
                Indici finanziari
                {indCorr.is_infrannuale && <span className="badge badge-warning">dato infrannuale — {indCorr.mese_fine} mesi</span>}
                <button className="btn btn-outline btn-sm no-print" onClick={() => window.print()}>
                  🖨️ Stampa / PDF
                </button>
              </div>
              <IndiciTable ind={indCorr} indB={indPrev || undefined} />
            </div>
          )}

          {tab === 'narrativa' && (
            <div style={{ marginTop: 16 }}>
              <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={generaNarrativa} disabled={generando}>
                  {generando ? 'Generando (può richiedere qualche secondo)...' : narrativa ? '🔄 Rigenera narrativa AI' : '🤖 Genera narrativa AI'}
                </button>
                {narrativaSalvataIl && <span style={{ fontSize: 12, color: '#9ca3af' }}>Salvata il {new Date(narrativaSalvataIl).toLocaleString('it-IT')}</span>}
                {narrativa && (
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => window.print()}>
                    🖨️ Stampa / PDF
                  </button>
                )}
              </div>

              {generando && (
                <div className="no-print" style={{ padding: '32px 24px', background: '#fff', border: '2px solid #185fa5', borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 28 }}>✨</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#185fa5' }}>{progressoMsg}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Generazione report AI — circa 20-30 secondi</div>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: '#185fa5' }}>{progressoPct}%</div>
                  </div>
                  <div style={{ background: '#f0f2f5', borderRadius: 8, height: 8, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 8,
                        background: 'linear-gradient(90deg, #185fa5 0%, #0f2d52 100%)',
                        width: `${progressoPct}%`,
                        transition: 'width 0.8s ease-in-out',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    {STEP_LABELS.map((s, i) => (
                      <div
                        key={s}
                        style={{ fontSize: 10, color: progressoPct >= (i / 5) * 100 ? '#185fa5' : '#d1d5db', fontWeight: progressoPct >= (i / 5) * 100 ? 600 : 400, textAlign: 'center' }}
                      >
                        {progressoPct >= (i / 5) * 100 ? '✓' : '○'} {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {narrativa && !generando && (
                <>
                  <div className="grid-3" style={{ marginBottom: 20 }}>
                    <div className={`kpi-tile ${RATING_COLORE[narrativa.rating] || 'kpi-blue'}`}>
                      <div className="kpi-label">Rating sintetico</div>
                      <div className="kpi-value">{narrativa.rating || 'N/D'}</div>
                    </div>
                    <div className="kpi-tile" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                      <div className="kpi-label">Periodo analizzato</div>
                      <div className="kpi-value" style={{ fontSize: 14 }}>
                        {narrativa.periodo_corrente || indCorr.periodo_label}
                      </div>
                    </div>
                    {narrativa.is_infrannuale_corrente && (
                      <div className="kpi-tile kpi-orange">
                        <div className="kpi-label">Attenzione</div>
                        <div className="kpi-value" style={{ fontSize: 13 }}>
                          Dato provvisorio/infrannuale
                        </div>
                      </div>
                    )}
                  </div>

                  {SEZIONI.map((s) => (
                    <div key={s.key} className="card" style={{ marginBottom: 16 }}>
                      <div className="card-header">{s.label}</div>
                      <div className="card-body">
                        <GraficoSezione chiave={s.key} />
                        {(narrativa[s.key] || '')
                          .split('\n')
                          .filter((riga) => riga.trim())
                          .map((riga, i) => (
                            <p key={i} style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.6, color: '#374151' }}>
                              {riga}
                            </p>
                          ))}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {!narrativa && !generando && <div className="alert" style={{ background: '#eff6ff', color: '#1d4ed8' }}>ℹ️ Nessuna narrativa generata per questo documento. Clicca "Genera narrativa AI".</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
