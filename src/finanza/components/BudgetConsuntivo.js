import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcolaBudgetConsuntivo, vociBudgetAnno, etichettaMese } from '../lib/budgetConsuntivo'

// Budget dai valori effettivi (pagina Budget): consuntivo dell'anno in corso fino all'ultimo mese chiuso (ultima
// registrazione degli stipendi) e previsione fino al 31 dicembre dell'anno dopo, dai libri giornale / prime note
// elaborati in Documenti e dalla Riclassificazione. Le regole sono in lib/budgetConsuntivo; le scelte dell'azienda
// (costi variabili, valori decisi, rettifiche) si salvano in fin_budget_impostazioni.

const TIPI_LIBRO_GIORNALE = ['prima_nota_precedente', 'prima_nota_corrente', 'libro_giornale_precedente', 'libro_giornale_corrente']
const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmt2 = (n) => (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const CHIAVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const cella = { textAlign: 'right', whiteSpace: 'nowrap', padding: '6px 8px' }
const prima = { position: 'sticky', left: 0, background: '#fff', zIndex: 1, minWidth: 250, maxWidth: 320, padding: '6px 10px' }

export default function BudgetConsuntivo({ aziendaId, budgets, onSalvato, ivaPredefinita = () => true }) {
  const [stato, setStato] = useState({ caricando: true })
  const [impostazioni, setImpostazioni] = useState({})
  const [aperte, setAperte] = useState({})
  const [mostraImpostazioni, setMostraImpostazioni] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [messaggio, setMessaggio] = useState(null)
  const [nuovaRettifica, setNuovaRettifica] = useState({ mese: '', da: '', a: '', importo: '', nota: '' })

  const carica = useCallback(async () => {
    setStato({ caricando: true })
    const [{ data: docs, error: e1 }, { data: mapAz }, { data: mapGl }, { data: imp }] = await Promise.all([
      supabase.from('documenti').select('id, nome_file, anno, tipo_documento, caricato_il, dati_estratti').eq('azienda_id', aziendaId).eq('stato', 'elaborato').in('tipo_documento', TIPI_LIBRO_GIORNALE),
      supabase.from('mappature_conti').select('*').eq('azienda_id', aziendaId).eq('globale', false),
      supabase.from('mappature_conti').select('*').eq('globale', true),
      supabase.from('budget_impostazioni').select('impostazioni').eq('azienda_id', aziendaId).maybeSingle(),
    ])
    if (e1) { setStato({ errore: e1.message }); return }
    // per ogni anno il documento elaborato piu' recente; si usano l'anno piu' recente e quello prima
    const perAnno = {}
    for (const d of docs || []) if (!perAnno[d.anno] || d.caricato_il > perAnno[d.anno].caricato_il) perAnno[d.anno] = d
    const anni = Object.keys(perAnno).map(Number).sort((a, b) => b - a)
    if (!anni.length) { setStato({ errore: 'Per questo calcolo servono il libro giornale o la prima nota dell\'anno in corso (e, meglio, dell\'anno precedente), caricati ed elaborati in Documenti.' }); return }
    const usati = anni.filter((a) => a >= anni[0] - 1).map((a) => perAnno[a])
    const documenti = usati.map((d) => { try { return { anno: Number(d.anno), dati: JSON.parse(d.dati_estratti) } } catch { return null } }).filter(Boolean)
    setImpostazioni(imp?.impostazioni || {})
    setStato({ documenti, usati, mapAz: mapAz || [], mapGl: mapGl || [] })
  }, [aziendaId])

  useEffect(() => { if (aziendaId) carica() }, [aziendaId, carica])

  const risultato = useMemo(() => {
    if (!stato.documenti) return null
    try {
      return calcolaBudgetConsuntivo({ documenti: stato.documenti, mappatureAzienda: stato.mapAz, mappatureGlobali: stato.mapGl, impostazioni })
    } catch (e) { return { errore: e.message } }
  }, [stato, impostazioni])

  const salvaImpostazioni = async (nuove) => {
    setImpostazioni(nuove)
    const { error } = await supabase.from('budget_impostazioni').upsert({ azienda_id: aziendaId, impostazioni: nuove, aggiornato_il: new Date().toISOString() })
    setMessaggio(error ? { tipo: 'error', testo: `Impostazioni non salvate: ${error.message}` } : null)
  }

  const salvaBudget = async (anno) => {
    const esistente = budgets.find((b) => b.anno === String(anno))
    const testo = `Salvare come budget ${anno} (ricavi e costi di gestione conto per conto, ${anno === risultato.annoCorrente ? `consuntivo fino a ${etichettaMese(risultato.ultimoMeseChiuso).toLowerCase()} e previsione per i mesi seguenti` : 'previsione'})?` +
      (esistente ? `\n\nEsiste già un budget ${anno} (${esistente.stato}): verrà sostituito.` : '')
    if (!window.confirm(testo)) return
    setSalvando(true)
    setMessaggio(null)
    try {
      if (esistente) {
        await supabase.from('budget_voci').delete().eq('budget_id', esistente.id)
        await supabase.from('scostamenti').delete().eq('budget_id', esistente.id)
        const { error } = await supabase.from('budget').delete().eq('id', esistente.id)
        if (error) throw new Error(error.message)
      }
      const id = crypto.randomUUID()
      const { error: e1 } = await supabase.from('budget').insert({ id, azienda_id: aziendaId, anno: String(anno), stato: 'bozza', note: `Dai valori effettivi (ultimo mese chiuso ${etichettaMese(risultato.ultimoMeseChiuso)})`, creato_il: new Date().toISOString() })
      if (e1) throw new Error(e1.message)
      // flag IVA: quello scelto per la voce nei budget precedenti dell'azienda (ivaVoci), altrimenti il predefinito
      const ivaVoci = impostazioni.ivaVoci || {}
      const righe = vociBudgetAnno(risultato, anno).map((r) => ({ id: crypto.randomUUID(), budget_id: id, ...r,
        soggetto_iva: ivaVoci[r.descrizione] ?? ivaPredefinita(r.categoria, r.descrizione) }))
      const { error: e2 } = await supabase.from('budget_voci').insert(righe)
      if (e2) throw new Error(e2.message)
      // imposte sul reddito annue (anni chiusi e previsione): base di saldo e acconti nel cash flow della Tesoreria
      const nuove = { ...impostazioni, imposteAnnue: { ...(impostazioni.imposteAnnue || {}), ...risultato.imposteAnnue }, imposteResidue: risultato.imposteResidue }
      await supabase.from('budget_impostazioni').upsert({ azienda_id: aziendaId, impostazioni: nuove, aggiornato_il: new Date().toISOString() })
      setImpostazioni(nuove)
      setMessaggio({ tipo: 'success', testo: `Budget ${anno} salvato (${righe.length} voci). Lo trovi nell'elenco dei budget qui sopra.` })
      onSalvato?.(String(anno))
    } catch (e) {
      setMessaggio({ tipo: 'error', testo: `Budget non salvato: ${e.message}` })
    } finally {
      setSalvando(false)
    }
  }

  if (stato.caricando) return <div className="card"><div className="card-body">Calcolo in corso…</div></div>
  if (stato.errore) return <div className="alert alert-warning">{stato.errore}</div>
  if (!risultato) return null
  if (risultato.errore) return <div className="alert alert-error">{risultato.errore}</div>

  const r = risultato
  const mesi = [...r.mesiConsuntivo, ...r.mesiPrevisione]
  const anni = [...new Set(mesi.map((k) => Number(k.slice(0, 4))))]
  const totAnno = (valori, anno) => mesi.filter((k) => k.startsWith(String(anno))).reduce((s, k) => s + (valori[k] || 0), 0)
  const contiCosto = [...r.costiVariabili, ...r.costiFissi].sort((a, b) => a.descrizione.localeCompare(b.descrizione, 'it'))
  const variabili = new Set(r.costiVariabiliMacrocategorie)

  const perMacro = {}
  for (const x of r.costiFissi) (perMacro[x.macrocategoria] ||= []).push(x)
  const macro = Object.entries(perMacro).map(([nome, xs]) => {
    const valori = Object.fromEntries(mesi.map((k) => [k, xs.reduce((s, x) => s + (x.valori[k] || 0), 0)]))
    return { nome, xs: xs.sort((a, b) => totAnno(b.valori, r.annoCorrente + 1) - totAnno(a.valori, r.annoCorrente + 1)), valori }
  }).sort((a, b) => totAnno(b.valori, r.annoCorrente + 1) - totAnno(a.valori, r.annoCorrente + 1))
  const somma = (xs) => Object.fromEntries(mesi.map((k) => [k, xs.reduce((s, x) => s + (x.valori[k] || 0), 0)]))
  const amm = somma(r.ammortamentiImposte.filter((x) => x.natura === 'ammortamenti'))
  const imp = somma(r.ammortamentiImposte.filter((x) => x.natura === 'imposte'))

  const valori = (vals, stile = {}) => (
    <>
      {mesi.map((k) => <td key={k} style={{ ...cella, ...stile, ...(r.mesiPrevisione.includes(k) ? {} : { color: '#475569' }) }}>{fmt(vals[k])}</td>)}
      {anni.map((a) => <td key={a} style={{ ...cella, ...stile, fontWeight: 700, background: '#f8fafc' }}>{fmt(totAnno(vals, a))}</td>)}
    </>
  )
  const rigaTot = (titolo, vals, classe) => (
    <tr className={`total-row ${classe}`}>
      <td style={{ ...prima, background: 'inherit' }}>{titolo}</td>
      <td />
      {valori(vals)}
    </tr>
  )
  const sezione = (titolo, classe) => (
    <tr className={`section-row ${classe}`}><td colSpan={2 + mesi.length + anni.length} style={{ position: 'sticky', left: 0 }}>{titolo}</td></tr>
  )
  const impostaValore = (x) => {
    const attuale = impostazioni.valoriMensili?.[x.conto]
    const v = window.prompt(`Valore mensile da usare per "${x.descrizione}" (${x.conto}).\nValore calcolato: ${fmt2(x.base)} — ${x.metodo}.\nLascia vuoto per tornare al calcolo automatico.`, attuale != null ? String(attuale).replace('.', ',') : '')
    if (v === null) return
    const valoriMensili = { ...(impostazioni.valoriMensili || {}) }
    if (v.trim() === '') delete valoriMensili[x.conto]
    else {
      const n = Number(v.replace(/\./g, '').replace(',', '.'))
      if (Number.isNaN(n)) return
      valoriMensili[x.conto] = n
    }
    salvaImpostazioni({ ...impostazioni, valoriMensili })
  }
  const aggiungiRettifica = () => {
    const importo = Number(String(nuovaRettifica.importo).replace(/\./g, '').replace(',', '.'))
    if (!nuovaRettifica.mese || !nuovaRettifica.da || !nuovaRettifica.a || !importo || nuovaRettifica.da === nuovaRettifica.a) return
    salvaImpostazioni({ ...impostazioni, rettifiche: [...(impostazioni.rettifiche || []), { ...nuovaRettifica, importo }] })
    setNuovaRettifica({ mese: '', da: '', a: '', importo: '', nota: '' })
  }
  const nomeConto = (c) => contiCosto.find((x) => x.conto === c)?.descrizione || c

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
          <div>
            Documenti usati: {r && stato.usati.map((d) => `${d.nome_file} (${d.anno})`).join(' · ')}.
            {' '}Ultimo mese chiuso: <strong>{etichettaMese(r.ultimoMeseChiuso)}</strong> (ultima registrazione degli stipendi).
            {' '}Previsione da <strong>{etichettaMese(r.mesiPrevisione[0])}</strong> a <strong>{etichettaMese(r.mesiPrevisione[r.mesiPrevisione.length - 1])}</strong>, sulla base di {r.base}.
          </div>
          <div style={{ color: '#64748b', marginTop: 4 }}>
            Ricavi: media degli ultimi 12 mesi. Costi variabili ({r.costiVariabiliMacrocategorie.join(', ') || 'nessuno'}): percentuale dei ricavi delle vendite {r.annoCorrente}.
            {' '}Personale: media di 6 mesi esclusi giugno e dicembre, doppia a giugno e dicembre. Costi fissi: ultimo valore. Periodici e annuali: ultimo importo nei mesi del ciclo.
            {' '}Altri: media annua. Ammortamenti e imposte: quota mensile. Valori in grigio = consuntivo.
            {' '}Imposte sul reddito annue (per saldo e acconti nel cash flow): {Object.entries(r.imposteAnnue).map(([a, v]) => `${a} € ${fmt(v)}`).join(' · ')}.
            {r.imposteResidue && (r.imposteResidue.saldoResiduo > 0 || r.imposteResidue.accontoResiduo > 0) && (
              <> Ancora da versare a {etichettaMese(r.imposteResidue.alMese).toLowerCase()}: saldo {r.annoCorrente - 1} € {fmt(r.imposteResidue.saldoResiduo)} e 1° acconto {r.annoCorrente} € {fmt(r.imposteResidue.accontoResiduo)} (nel cash flow a maggio).</>
            )}
          </div>
          {r.avvisi.map((a) => <div key={a} className="alert alert-warning" style={{ margin: '8px 0 0' }}>{a}</div>)}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button className="btn btn-outline btn-sm" onClick={() => setMostraImpostazioni((v) => !v)}>{mostraImpostazioni ? 'Chiudi impostazioni' : '⚙️ Costi variabili e rettifiche'}</button>
            {[r.annoCorrente, r.annoCorrente + 1].map((a) => (
              <button key={a} className="btn btn-primary btn-sm" disabled={salvando} onClick={() => salvaBudget(a)}>Salva come budget {a}</button>
            ))}
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>🖨️ Stampa / PDF</button>
          </div>
          {messaggio && <div className={`alert alert-${messaggio.tipo}`} style={{ margin: '10px 0 0' }}>{messaggio.testo}</div>}
        </div>
      </div>

      {mostraImpostazioni && (
        <div className="card no-print" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: '#1a3a5c', marginBottom: 6 }}>Costi variabili (in percentuale dei ricavi delle vendite)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 14 }}>
              {r.macrocategorieCosti.filter((m) => !['Imposte sul reddito', 'Ammortamenti'].includes(m)).map((m) => (
                <label key={m} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={variabili.has(m)}
                    onChange={(e) => salvaImpostazioni({ ...impostazioni, costiVariabili: e.target.checked ? [...variabili, m] : [...variabili].filter((x) => x !== m) })} />
                  {m}
                </label>
              ))}
            </div>
            <div style={{ fontWeight: 700, color: '#1a3a5c', marginBottom: 6 }}>Rettifiche (importi registrati sul conto sbagliato)</div>
            {(impostazioni.rettifiche || []).map((x, j) => (
              <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span>{etichettaMese(x.mese)}: € {fmt2(x.importo)} da «{nomeConto(x.da)}» a «{nomeConto(x.a)}»{x.nota ? ` — ${x.nota}` : ''}</span>
                <button className="btn btn-sm btn-outline" onClick={() => salvaImpostazioni({ ...impostazioni, rettifiche: impostazioni.rettifiche.filter((_, i) => i !== j) })}>Togli</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
              <select className="form-control" style={{ width: 130 }} value={nuovaRettifica.mese} onChange={(e) => setNuovaRettifica({ ...nuovaRettifica, mese: e.target.value })}>
                <option value="">Mese…</option>
                {r.mesiConsuntivo.map((k) => <option key={k} value={k}>{etichettaMese(k)}</option>)}
              </select>
              {['da', 'a'].map((campo) => (
                <select key={campo} className="form-control" style={{ width: 260 }} value={nuovaRettifica[campo]} onChange={(e) => setNuovaRettifica({ ...nuovaRettifica, [campo]: e.target.value })}>
                  <option value="">{campo === 'da' ? 'Dal conto…' : 'Al conto…'}</option>
                  {contiCosto.map((x) => <option key={x.conto} value={x.conto}>{x.descrizione} ({x.conto})</option>)}
                </select>
              ))}
              <input className="form-control" style={{ width: 110 }} placeholder="Importo" value={nuovaRettifica.importo} onChange={(e) => setNuovaRettifica({ ...nuovaRettifica, importo: e.target.value })} />
              <input className="form-control" style={{ width: 200 }} placeholder="Nota" value={nuovaRettifica.nota} onChange={(e) => setNuovaRettifica({ ...nuovaRettifica, nota: e.target.value })} />
              <button className="btn btn-sm btn-primary" onClick={aggiungiRettifica}>Aggiungi</button>
            </div>
            <div style={{ color: '#64748b', marginTop: 10 }}>Per cambiare il valore usato per un costo fisso apri la macrocategoria nella tabella e premi ✎ sul conto.</div>
          </div>
        </div>
      )}

      <div className="card table-scroll">
        <table className="table budget-table" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={{ ...prima, background: '#f8fafc' }}>Voce</th>
              <th style={{ minWidth: 200 }}>Metodo</th>
              {mesi.map((k) => (
                <th key={k} style={{ ...cella, background: r.mesiPrevisione.includes(k) ? '#eff6ff' : '#f1f5f9' }}>
                  {etichettaMese(k)}<div style={{ fontWeight: 400, fontSize: 11, color: '#64748b' }}>{r.mesiPrevisione.includes(k) ? 'previsione' : 'consuntivo'}</div>
                </th>
              ))}
              {anni.map((a) => <th key={a} style={{ ...cella, background: '#e2e8f0' }}>Totale {a}</th>)}
            </tr>
          </thead>
          <tbody>
            {sezione('Ricavi', 'section-ricavi')}
            {r.ricavi.map((x) => (
              <tr key={x.conto}><td style={prima}>{x.descrizione} <span style={{ color: '#94a3b8' }}>{x.conto}</span></td><td style={{ color: '#64748b' }}>{x.voce} · {x.metodo}</td>{valori(x.valori)}</tr>
            ))}
            {rigaTot('Totale ricavi', r.totali.ricavi, 'total-ricavi')}

            {sezione('Costi variabili', 'section-costi')}
            {r.costiVariabili.map((x) => (
              <tr key={x.conto}><td style={prima}>{x.descrizione} <span style={{ color: '#94a3b8' }}>{x.conto}</span></td><td style={{ color: '#64748b' }}>{(x.percentuale * 100).toLocaleString('it-IT', { maximumFractionDigits: 2 })}% dei ricavi delle vendite</td>{valori(x.valori)}</tr>
            ))}
            {rigaTot('Totale costi variabili', r.totali.variabili, 'total-costi')}
            {rigaTot('Margine di contribuzione', r.totali.margine, 'total-ebitda')}

            {sezione('Costi fissi (clic sulla macrocategoria per vedere i conti)', 'section-costi')}
            {macro.map((m) => (
              <Fragment key={m.nome}>
                <tr className="cf-espandi" onClick={() => setAperte((a) => ({ ...a, [m.nome]: !a[m.nome] }))} style={{ fontWeight: 600 }}>
                  <td style={prima}>{aperte[m.nome] ? '▾' : '▸'} {m.nome} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({m.xs.length})</span></td>
                  <td style={{ color: '#64748b', fontWeight: 400 }}>{m.xs.some((x) => x.segnalato) ? '⚠️ valori da verificare' : ''}</td>
                  {valori(m.valori)}
                </tr>
                {aperte[m.nome] && m.xs.map((x) => (
                  <tr key={x.conto} style={x.segnalato ? { background: '#fff8db' } : undefined} title={x.nota || undefined}>
                    <td style={{ ...prima, paddingLeft: 26, background: x.segnalato ? '#fff8db' : '#fff' }}>
                      {x.descrizione} <span style={{ color: '#94a3b8' }}>{x.conto}</span>
                    </td>
                    <td style={{ color: '#64748b' }}>
                      <button className="btn btn-sm no-print" title="Imposta il valore mensile da usare" style={{ padding: '0 6px', marginRight: 4 }} onClick={() => impostaValore(x)}>✎</button>
                      {x.metodo}{x.metodo === 'valore deciso' || x.base ? ` (${fmt2(x.base)})` : ''}{x.nota ? <div style={{ fontSize: 11 }}>{x.nota}</div> : null}
                    </td>
                    {valori(x.valori)}
                  </tr>
                ))}
              </Fragment>
            ))}
            {rigaTot('Totale costi fissi', r.totali.fissi, 'total-costi')}
            {rigaTot('EBITDA (margine operativo lordo)', r.totali.ebitda, 'total-ebitda')}
            <tr><td style={prima}>Ammortamenti</td><td style={{ color: '#64748b' }}>{r.ammortamentiImposte.find((x) => x.natura === 'ammortamenti')?.metodo}</td>{valori(amm)}</tr>
            {rigaTot('Risultato operativo', r.totali.ebit, 'total-ebitda')}
            <tr><td style={prima}>Imposte sul reddito</td><td style={{ color: '#64748b' }}>{r.ammortamentiImposte.find((x) => x.natura === 'imposte')?.metodo}</td>{valori(imp)}</tr>
            {rigaTot('Risultato netto', r.totali.netto, 'total-ebitda')}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
        «Salva come budget» crea il budget dell'anno con ricavi e costi di gestione conto per conto ({CHIAVI.length} mesi): poi si modifica, si approva e si usa nello Scostamento come gli altri budget.
      </p>
    </div>
  )
}
