import React, { useEffect, useState } from 'react'
import { useApp } from '../../App'
import { supabase } from '../lib/supabase'
import { caricaContesto, processaDocumento, buildCe, TIPI_LIBRO_GIORNALE } from './CE'

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const MESI_KEYS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const ANNI = ['2024', '2025', '2026', '2027']

const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const round2 = (n) => Math.round(n * 100) / 100

// Larghezze fisse condivise tra le tabelle Ricavi/Costi e la riga Risultato
// finale, cosi' le colonne restano allineate anche essendo tabelle separate.
const COLGROUP_SCOSTAMENTO = (
  <colgroup>
    <col />
    <col style={{ width: 140 }} />
    <col style={{ width: 140 }} />
    <col style={{ width: 140 }} />
    <col style={{ width: 100 }} />
  </colgroup>
)

// Ultimo mese con movimenti nel libro giornale (dati_estratti di Documenti).
function ultimoMeseGiornale(dati) {
  let ultimo = 0
  for (const g of dati?.gruppi || []) {
    for (const m of Object.keys(g.mensile || {})) if (Number(m) > ultimo) ultimo = Number(m)
  }
  return ultimo
}

const sommaFinoA = (mensile, mese) => round2(Object.entries(mensile || {}).filter(([m]) => Number(m) <= mese).reduce((s, [, v]) => s + (v || 0), 0))

// Reale cumulativo gennaio..mese ricavato dai movimenti mensili del libro
// giornale, con la stessa riclassificazione di Bilancio riclassificato (CE):
// ogni conto vale la somma dei suoi movimenti fino al mese scelto, poi il
// risultato e' portato nel formato del provvisorio (ricavi/costi per voce CEE).
function realeDaGiornale(dati, mese, ctx) {
  const gruppi = (dati.gruppi || []).map((g) =>
    g.conti?.length
      ? { ...g, conti: g.conti.map((c) => ({ ...c, valore: sommaFinoA(c.mensile, mese) })) }
      : { ...g, conti: [{ conto: g.gruppo, descrizione: g.descrizione, valore: sommaFinoA(g.mensile, mese) }] }
  )
  const voci = buildCe(processaDocumento({ gruppi }, mese, 'cumulativo', ctx), ctx.vociCeeList)
  const mappaVoce = (v) => ({ descrizione: v.descrizione, importo: v.importo, dettaglio: v.conti.map((c) => ({ conto: c.codice, descrizione: c.conto, importo: c.importo })) })
  return {
    ricavi: { voci: voci.filter((v) => v.tipo === 'ricavo' && !v.totale && v.importo !== 0).map(mappaVoce) },
    costi: { voci: voci.filter((v) => v.tipo === 'costo' && !v.totale && v.importo !== 0).map(mappaVoce) },
  }
}

// Documenti contabili dell'anno utili come "reale": libri giornale / prime note
// (mese per mese) e provvisori (cumulativi a fine mese), piu' recenti per primi.
async function caricaDocumentiReale(aziendaId, anno) {
  const { data } = await supabase
    .from('documenti')
    .select('id, tipo_documento, nome_file, mese_fine, dati_estratti, caricato_il')
    .eq('azienda_id', aziendaId)
    .eq('anno', anno)
    .in('tipo_documento', ['provvisorio', ...TIPI_LIBRO_GIORNALE])
    .eq('stato', 'elaborato')
    .order('caricato_il', { ascending: false })
  const giornali = []
  const provvisori = []
  for (const d of data || []) {
    if (!d.dati_estratti) continue
    if (d.tipo_documento === 'provvisorio') {
      if (d.mese_fine) provvisori.push(d)
      continue
    }
    try {
      const dati = JSON.parse(d.dati_estratti)
      const ultimoMese = ultimoMeseGiornale(dati)
      if (ultimoMese) giornali.push({ ...d, dati, ultimoMese })
    } catch {
      // dati non leggibili: documento ignorato
    }
  }
  return { giornali, provvisori }
}

// Il libro giornale copre qualunque mese fino all'ultimo registrato, senza
// bisogno di un provvisorio per ogni chiusura; il provvisorio del mese resta
// come alternativa quando il giornale non arriva a quel mese.
async function caricaReale(aziendaId, anno, mese) {
  const { giornali, provvisori } = await caricaDocumentiReale(aziendaId, anno)
  const giornale = giornali.find((g) => g.ultimoMese >= mese)
  if (giornale) {
    const ctx = await caricaContesto(aziendaId)
    return { datiReali: realeDaGiornale(giornale.dati, mese, ctx), fonte: `libro giornale «${giornale.nome_file}», movimenti da gennaio a fine ${MESI[mese - 1].toLowerCase()}` }
  }
  const provv = provvisori.find((d) => Number(d.mese_fine) === Number(mese))
  if (provv) return { datiReali: JSON.parse(provv.dati_estratti), fonte: `provvisorio «${provv.nome_file}» a fine ${MESI[mese - 1].toLowerCase()}` }

  const nomeMese = MESI[mese - 1].toLowerCase()
  const parti = []
  if (giornali.length) parti.push(`il libro giornale arriva fino a ${MESI[Math.max(...giornali.map((g) => g.ultimoMese)) - 1].toLowerCase()}`)
  const mesiProvv = [...new Set(provvisori.map((d) => Number(d.mese_fine)))].sort((a, b) => a - b)
  if (mesiProvv.length) parti.push(`provvisori disponibili: ${mesiProvv.map((m) => MESI[m - 1].toLowerCase()).join(', ')}`)
  throw new Error(parti.length
    ? `Nessun dato reale a fine ${nomeMese} ${anno}: ${parti.join('; ')}. Carica in Documenti contabili un libro giornale aggiornato o un provvisorio chiuso a ${nomeMese}.`
    : `Nessun dato reale per il ${anno}: carica in Documenti contabili il libro giornale (o una prima nota) dell'anno, oppure crea un provvisorio da Bilancio riclassificato.`)
}

// Replica client-side di /scostamento/calcola: budget cumulativo vs reale
// riclassificato tramite le mappature conti già presenti in Supabase.
async function calcolaScostamento(aziendaId, anno, mese) {
  const { data: budget } = await supabase.from('budget').select('*').eq('azienda_id', aziendaId).eq('anno', anno).eq('stato', 'approvato').maybeSingle()
  if (!budget) throw new Error('Nessun budget approvato trovato per questo anno.')

  const { datiReali, fonte } = await caricaReale(aziendaId, anno, mese)

  const { data: vociBudget } = await supabase.from('budget_voci').select('*').eq('budget_id', budget.id)
  const { data: mappatureAzienda } = await supabase.from('mappature_conti').select('*').eq('azienda_id', aziendaId).eq('globale', false)
  const { data: mappatureGlobali } = await supabase.from('mappature_conti').select('*').eq('globale', true)
  const { data: vociCeeList } = await supabase.from('voci_cee').select('descrizione')
  const vociCeeDescrizioni = new Set((vociCeeList || []).map((v) => v.descrizione))

  const trovaMappatura = (conto) => {
    const cl = (conto || '').toLowerCase()
    for (const m of mappatureAzienda || []) {
      if (m.conto_origine.toLowerCase() === cl) return [m.voce_budget_descrizione, m.categoria]
    }
    for (const m of mappatureGlobali || []) {
      if (cl.includes(m.conto_origine.toLowerCase())) return [m.voce_budget_descrizione, m.categoria]
    }
    return null
  }

  const budgetPerVoce = {}
  for (const voce of vociBudget || []) {
    const cumulativo = round2(MESI_KEYS.slice(0, mese).reduce((s, m) => s + (voce[m] || 0), 0))
    budgetPerVoce[voce.descrizione] = { categoria: voce.categoria, valore: cumulativo }
  }

  const realiPerVoce = {}
  const aggrega = (voci, fallbackDesc, fallbackCat) => {
    for (const v of voci || []) {
      const importo = Math.abs(v.importo || 0)
      if (importo === 0) continue
      // Se la descrizione e' gia' una voce CEE ufficiale (es. un "provvisorio"
      // generato da Bilancio Riclassificato), e' gia' classificata: le parole
      // chiave qui sotto servono solo per testo grezzo non ancora classificato
      // (un provvisorio caricato a mano), altrimenti rischiano di riaccorpare
      // per errore voci gia' distinte (es. "a) Salari e stipendi" contiene
      // "salari" e finirebbe reclassificata su "Per il personale").
      const gia_classificata = vociCeeDescrizioni.has(v.descrizione)
      const risultato = gia_classificata ? null : trovaMappatura(v.descrizione || '')
      const voceBudget = gia_classificata ? v.descrizione : risultato ? risultato[0] : fallbackDesc
      const cat = gia_classificata ? fallbackCat : risultato ? risultato[1] : fallbackCat
      if (!realiPerVoce[voceBudget]) realiPerVoce[voceBudget] = { categoria: cat, valore: 0 }
      realiPerVoce[voceBudget].valore += importo
    }
  }
  aggrega(datiReali.ricavi?.voci, 'Ricavi non classificati', 'ricavi')
  aggrega(datiReali.costi?.voci, 'Costi non classificati', 'costi')

  await supabase.from('scostamenti').delete().eq('budget_id', budget.id).eq('mese', mese)

  const tutteLeVoci = new Set([...Object.keys(budgetPerVoce), ...Object.keys(realiPerVoce)])
  let totRicaviBudget = 0, totRicaviReali = 0, totCostiBudget = 0, totCostiReali = 0
  const righe = []

  for (const desc of tutteLeVoci) {
    const b = budgetPerVoce[desc] || { categoria: 'costi', valore: 0 }
    const r = realiPerVoce[desc] || { categoria: b.categoria, valore: 0 }
    const vBudget = b.valore
    const vReale = r.valore
    const categoria = b.valore > 0 ? b.categoria : r.categoria
    const diff = round2(vReale - vBudget)
    const perc = vBudget !== 0 ? round2((diff / vBudget) * 100) : 0

    righe.push({
      id: crypto.randomUUID(),
      budget_id: budget.id,
      azienda_id: aziendaId,
      anno,
      mese,
      categoria,
      descrizione: desc,
      valore_budget: round2(vBudget),
      valore_reale: round2(vReale),
      scostamento: diff,
      scostamento_perc: perc,
      creato_il: new Date().toISOString(),
    })

    if (categoria === 'ricavi') {
      totRicaviBudget += vBudget
      totRicaviReali += vReale
    } else {
      totCostiBudget += vBudget
      totCostiReali += vReale
    }
  }

  const ebitdaBudget = round2(totRicaviBudget - totCostiBudget)
  const ebitdaReale = round2(totRicaviReali - totCostiReali)
  const diffEbitda = round2(ebitdaReale - ebitdaBudget)
  const percEbitda = ebitdaBudget !== 0 ? round2((diffEbitda / ebitdaBudget) * 100) : 0

  righe.push({
    id: crypto.randomUUID(),
    budget_id: budget.id,
    azienda_id: aziendaId,
    anno,
    mese,
    categoria: 'ebitda',
    descrizione: 'EBITDA',
    valore_budget: ebitdaBudget,
    valore_reale: ebitdaReale,
    scostamento: diffEbitda,
    scostamento_perc: percEbitda,
    creato_il: new Date().toISOString(),
  })

  const { error } = await supabase.from('scostamenti').insert(righe)
  if (error) throw new Error(error.message)

  return {
    voci: righe,
    fonte,
    riepilogo: {
      ricavi_budget: round2(totRicaviBudget),
      ricavi_reali: round2(totRicaviReali),
      costi_budget: round2(totCostiBudget),
      costi_reali: round2(totCostiReali),
      ebitda_budget: ebitdaBudget,
      ebitda_reale: ebitdaReale,
    },
  }
}

function TabellaScostamento({ voci, titolo, sectionClass, totalClass }) {
  const totBudget = voci.reduce((s, v) => s + v.valore_budget, 0)
  const totReale = voci.reduce((s, v) => s + v.valore_reale, 0)
  const totScost = round2(totReale - totBudget)
  const totPerc = totBudget !== 0 ? round2((totScost / totBudget) * 100) : 0
  const categoria = voci[0]?.categoria || 'costi'
  const nSopraSoglia = voci.filter((v) => Math.abs(v.scostamento_perc || 0) > 10).length // CNDCEC §2.5h: dettaglio delle voci con varianza > 10%

  const colore = (val) => {
    const buono = categoria === 'ricavi' || categoria === 'ebitda' ? val >= 0 : val <= 0
    return buono ? 'cf-pos' : 'cf-neg'
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className={`section-row ${sectionClass}`} style={{ padding: '10px 16px' }}>
        {titolo}
      </div>
      <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
        {COLGROUP_SCOSTAMENTO}
        <thead>
          <tr>
            <th>Voce</th>
            <th style={{ textAlign: 'right' }}>Budget</th>
            <th style={{ textAlign: 'right' }}>Reale</th>
            <th style={{ textAlign: 'right' }}>Scost. €</th>
            <th style={{ textAlign: 'right' }}>Scost. %</th>
          </tr>
        </thead>
        <tbody>
          {voci.map((v) => (
            <tr key={v.id}>
              <td>{v.descrizione}</td>
              <td style={{ textAlign: 'right' }}>€{fmt(v.valore_budget)}</td>
              <td style={{ textAlign: 'right' }}>€{fmt(v.valore_reale)}</td>
              <td className={colore(v.scostamento)} style={{ textAlign: 'right', fontWeight: 600 }}>
                {v.scostamento >= 0 ? '+' : ''}€{fmt(v.scostamento)}
              </td>
              <td className={colore(v.scostamento)} style={{ textAlign: 'right' }}>
                {v.scostamento_perc >= 0 ? '+' : ''}
                {v.scostamento_perc?.toFixed(1)}%{Math.abs(v.scostamento_perc || 0) > 10 && ' ⚠️'}
              </td>
            </tr>
          ))}
          <tr className={`total-row ${totalClass}`}>
            <td>
              Totale{nSopraSoglia > 0 && <span style={{ fontWeight: 400, fontSize: 11 }}> — ⚠️ {nSopraSoglia} voci con scostamento oltre il 10% (CNDCEC §2.5h)</span>}
            </td>
            <td style={{ textAlign: 'right' }}>€{fmt(totBudget)}</td>
            <td style={{ textAlign: 'right' }}>€{fmt(totReale)}</td>
            <td className={colore(totScost)} style={{ textAlign: 'right' }}>
              {totScost >= 0 ? '+' : ''}€{fmt(totScost)}
            </td>
            <td className={colore(totScost)} style={{ textAlign: 'right' }}>
              {totPerc >= 0 ? '+' : ''}
              {totPerc.toFixed(1)}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function Scostamento() {
  const [aziende, setAziende] = useState([])
  // Pmi 360°: l'azienda è quella attiva dell'app (niente selettore nella pagina)
  const { azienda: aziendaAttiva } = useApp()
  const aziendaId = aziendaAttiva?.id || ''
  const [anno, setAnno] = useState('2026')
  const [mese, setMese] = useState(1)
  // si parte dall'ultimo mese coperto dal libro giornale o da un provvisorio
  useEffect(() => {
    if (!aziendaId || !anno) return
    caricaDocumentiReale(aziendaId, anno).then(({ giornali, provvisori }) => {
      const ultimo = Math.max(0, ...giornali.map((g) => g.ultimoMese), ...provvisori.map((d) => Number(d.mese_fine)))
      if (ultimo) setMese(ultimo)
    })
  }, [aziendaId, anno])
  const [budgets, setBudgets] = useState([])
  const [voci, setVoci] = useState([])
  const [riepilogo, setRiepilogo] = useState(null)
  const [fonte, setFonte] = useState('')
  const [calcolando, setCalcolando] = useState(false)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    supabase
      .from('aziende')
      .select('id, nome')
      .order('nome')
      .then(({ data }) => setAziende(data || []))
  }, [])

  useEffect(() => {
    if (aziendaId) {
      supabase
        .from('budget')
        .select('*')
        .eq('azienda_id', aziendaId)
        .then(({ data }) => setBudgets(data || []))
      setVoci([])
      setRiepilogo(null)
      setErrore('')
    }
  }, [aziendaId])

  const calcola = async () => {
    setCalcolando(true)
    setErrore('')
    try {
      const { voci, riepilogo, fonte } = await calcolaScostamento(aziendaId, anno, mese)
      setVoci(voci)
      setRiepilogo(riepilogo)
      setFonte(fonte)
    } catch (e) {
      setErrore(e.message || 'Errore nel calcolo')
      setVoci([])
      setRiepilogo(null)
    } finally {
      setCalcolando(false)
    }
  }

  const ricavi = voci.filter((v) => v.categoria === 'ricavi')
  const costi = voci.filter((v) => v.categoria === 'costi')
  const ebitda = voci.find((v) => v.categoria === 'ebitda')

  const azienda = aziende.find((a) => a.id === aziendaId)

  return (
    <div>
      <h2 className="no-print" style={{ color: '#1a3a5c', marginTop: 0 }}>
        Scostamento
      </h2>
      <p className="no-print" style={{ color: '#666', marginTop: -8, marginBottom: 20 }}>
        Confronto budget vs dati reali per voce
      </p>

      <div className="card no-print" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div className="grid-3" style={{ alignItems: 'end' }}>
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
              <label className="form-label">Anno</label>
              <select className="form-control" value={anno} onChange={(e) => setAnno(e.target.value)}>
                {ANNI.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Mese</label>
              <select className="form-control" value={mese} onChange={(e) => setMese(Number(e.target.value))}>
                {MESI.map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {budgets.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {budgets.map((b) => (
                <span key={b.id} className={`badge ${b.stato === 'approvato' ? 'badge-success' : 'badge-warning'}`}>
                  Budget {b.anno} — {b.stato}
                </span>
              ))}
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <button className="btn btn-primary" onClick={calcola} disabled={!aziendaId || calcolando}>
              {calcolando ? 'Calcolando...' : 'Calcola scostamento'}
            </button>
          </div>

          {errore && (
            <div className="alert alert-error" style={{ marginTop: 14, marginBottom: 0 }}>
              {errore}
            </div>
          )}
        </div>
      </div>

      {riepilogo && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 className="no-print" style={{ color: '#1a3a5c', margin: 0 }}>
                Scostamento Gen-{MESI[mese - 1]} {anno} <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>(cumulativo — dati riclassificati)</span>
              </h3>
              <div className="print-only">
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c' }}>{azienda?.nome || ''}</div>
                <div style={{ fontSize: 13, color: '#555' }}>
                  Scostamento Gen-{MESI[mese - 1]} {anno} (cumulativo — dati riclassificati)
                </div>
              </div>
              {fonte && <div style={{ fontSize: 12.5, color: '#5f6b7a', marginTop: 4 }}>Reale da {fonte}</div>}
            </div>
            <button className="btn btn-outline btn-sm no-print" onClick={() => window.print()}>
              🖨️ Stampa / PDF
            </button>
          </div>

          <div className="grid-3" style={{ marginBottom: 20 }}>
            <div className="kpi-tile kpi-green">
              <div className="kpi-label">Ricavi budget</div>
              <div className="kpi-value">€{fmt(riepilogo.ricavi_budget)}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Reale: €{fmt(riepilogo.ricavi_reali)}</div>
            </div>
            <div className="kpi-tile kpi-red">
              <div className="kpi-label">Costi budget</div>
              <div className="kpi-value">€{fmt(riepilogo.costi_budget)}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Reale: €{fmt(riepilogo.costi_reali)}</div>
            </div>
            <div className={`kpi-tile ${ebitda?.scostamento >= 0 ? 'kpi-blue' : 'kpi-orange'}`}>
              <div className="kpi-label">EBITDA budget</div>
              <div className="kpi-value">€{fmt(riepilogo.ebitda_budget)}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                Reale: €{fmt(riepilogo.ebitda_reale)}{' '}
                <span className={ebitda?.scostamento >= 0 ? 'cf-pos' : 'cf-neg'} style={{ fontWeight: 600 }}>
                  ({ebitda?.scostamento >= 0 ? '+' : ''}€{fmt(ebitda?.scostamento)})
                </span>
              </div>
            </div>
          </div>

          {ricavi.length > 0 && <TabellaScostamento voci={ricavi} titolo="RICAVI" sectionClass="section-ricavi" totalClass="total-ricavi" />}
          {costi.length > 0 && <TabellaScostamento voci={costi} titolo="COSTI" sectionClass="section-costi" totalClass="total-costi" />}
          {ebitda && (
            <div className="card" style={{ marginBottom: 16 }}>
              <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
                {COLGROUP_SCOSTAMENTO}
                <tbody>
                  <tr className="total-row" style={{ fontWeight: 700 }}>
                    <td>Risultato (Ricavi − Costi)</td>
                    <td style={{ textAlign: 'right' }}>€{fmt(ebitda.valore_budget)}</td>
                    <td style={{ textAlign: 'right' }}>€{fmt(ebitda.valore_reale)}</td>
                    <td className={ebitda.scostamento >= 0 ? 'cf-pos' : 'cf-neg'} style={{ textAlign: 'right' }}>
                      {ebitda.scostamento >= 0 ? '+' : ''}€{fmt(ebitda.scostamento)}
                    </td>
                    <td className={ebitda.scostamento >= 0 ? 'cf-pos' : 'cf-neg'} style={{ textAlign: 'right' }}>
                      {ebitda.scostamento_perc >= 0 ? '+' : ''}
                      {ebitda.scostamento_perc?.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
