// Calcolo dello Stato Patrimoniale Riclassificato (art. 2424 c.c.) a partire
// dai gruppi di conto di un Libro Giornale/Lista Prima Nota gia' riclassificati
// (vedi Riclassificazione.js). Condiviso dalla pagina "Bilancio Riclassificato"
// (src/pages/CE.js), che mostra Conto Economico e Stato Patrimoniale insieme
// quando il documento di origine e' un Libro Giornale/Prima Nota.
import React from 'react'
import { supabase } from './supabase'
import { trovaMappaturaConto, contiDelGruppo } from './mappatureConti'
import { applicaAssestamentiSP } from './assestamenti'

export const round2 = (n) => Math.round(n * 100) / 100
export const fmtSP = (n) => (!n ? '—' : n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const padding = (livello) => 10 + (livello - 1) * 16

export async function caricaContestoSP(aziendaId) {
  const { data: mappatureAzienda } = await supabase.from('mappature_conti').select('*').eq('azienda_id', aziendaId).eq('globale', false)
  const { data: mappatureGlobali } = await supabase.from('mappature_conti').select('*').eq('globale', true)
  const { data: vociSpList } = await supabase.from('voci_sp').select('*').order('ordine')
  const byCodice = {}
  const byDescrizione = {}
  const figliDi = {}
  for (const v of vociSpList || []) {
    byCodice[v.codice] = v
    byDescrizione[(v.descrizione || '').trim().toLowerCase()] = v
    if (v.parent_codice) {
      if (!figliDi[v.parent_codice]) figliDi[v.parent_codice] = []
      figliDi[v.parent_codice].push(v)
    }
  }
  return { mappatureAzienda: mappatureAzienda || [], mappatureGlobali: mappatureGlobali || [], vociSpList: vociSpList || [], byCodice, byDescrizione, figliDi }
}

// Riclassifica i gruppi del Libro Giornale/Prima Nota su attivita'/passivita'
// (per lo Stato Patrimoniale) e ricavi/costi (per il risultato d'esercizio,
// necessario alla quadratura: i conti economici restano "aperti" nel libro
// giornale fino alla scrittura di chiusura, quindi non fanno parte del
// Patrimonio Netto se non sommando qui il loro risultato).
export function processaGruppiSP(dati, ctx) {
  const { mappatureAzienda, mappatureGlobali, byCodice, byDescrizione } = ctx
  const aggregatoSP = {}
  const nonClassificati = []
  let totaleRicavi = 0
  let totaleCosti = 0

  // Ogni conto viene riclassificato singolarmente: l'eccezione salvata sul conto
  // batte la mappatura del gruppo (vedi mappatureConti.js). Senza eccezioni il
  // risultato coincide con la riclassificazione per gruppo.
  for (const g of dati.gruppi || []) {
    let nonClassificatoGruppo = 0
    for (const c of contiDelGruppo(g)) {
      const importo = round2(c.valore || 0)
      if (importo === 0) continue
      const mappatura = trovaMappaturaConto(c.conto, mappatureAzienda, mappatureGlobali, g.gruppo)
      if (!mappatura) {
        nonClassificatoGruppo = round2(nonClassificatoGruppo + importo)
        continue
      }
      if (mappatura.categoria === 'ricavi') {
        totaleRicavi += -importo // ricavi: saldo naturale in Avere (negativo in convenzione Dare+/Avere-)
        continue
      }
      if (mappatura.categoria === 'costi') {
        totaleCosti += importo
        continue
      }
      if (mappatura.categoria !== 'attivita' && mappatura.categoria !== 'passivita') continue

      let voce = mappatura.codice_cee ? byCodice[mappatura.codice_cee] : null
      if (!voce) voce = byDescrizione[(mappatura.voce_budget_descrizione || '').trim().toLowerCase()]
      if (!voce) {
        nonClassificatoGruppo = round2(nonClassificatoGruppo + importo)
        continue
      }
      // attivita': si somma il saldo cosi' com'e' (i conti rettificativi, es. fondi
      // ammortamento, sono naturalmente negativi e nettano il lordo correttamente).
      // passivita': si inverte il segno per mostrare il valore come e' normale in
      // un bilancio (i debiti/il patrimonio netto hanno saldo naturale in Avere).
      const segno = mappatura.categoria === 'passivita' ? -1 : 1
      const valore = round2(importo * segno)
      if (!aggregatoSP[voce.codice]) aggregatoSP[voce.codice] = { importo: 0, conti: [] }
      aggregatoSP[voce.codice].importo = round2(aggregatoSP[voce.codice].importo + valore)
      // Il drill-down mostra ogni singolo conto, non un'unica riga con
      // l'etichetta del conto piu' rilevante: un gruppo come "40/F" raggruppa
      // decine di fornitori diversi, non e' un conto singolo.
      aggregatoSP[voce.codice].conti.push({ gruppo: c.conto, conto: c.descrizione, importo: valore })
    }
    if (nonClassificatoGruppo !== 0) nonClassificati.push({ gruppo: g.gruppo, descrizione: g.descrizione, importo: nonClassificatoGruppo })
  }

  return { aggregatoSP, nonClassificati, risultatoEsercizio: round2(totaleRicavi - totaleCosti) }
}

function calcolaImportoSP(codice, aggregato, byCodice, figliDi, memo) {
  if (memo[codice] !== undefined) return memo[codice]
  const voce = byCodice[codice]
  let val = 0
  if (!voce.totale) {
    val = aggregato[codice]?.importo || 0
  } else {
    const figli = figliDi[codice] || []
    val = figli.reduce((s, f) => s + calcolaImportoSP(f.codice, aggregato, byCodice, figliDi, memo), 0)
  }
  val = round2(val)
  memo[codice] = val
  return val
}

export function buildSp(aggregato, ctx, risultatoEsercizio) {
  const { vociSpList, byCodice, figliDi } = ctx

  // Il risultato d'esercizio (ricavi - costi correnti) confluisce nel Patrimonio
  // Netto (voce IX): nel libro giornale i conti economici restano "aperti" fino
  // alla chiusura, quindi va sommato qui prima del calcolo a cascata, cosi' i
  // totali dei livelli superiori (Patrimonio netto, Totale Passivo) lo riflettono
  // in modo coerente lungo tutto l'albero.
  const aggregatoConRisultato = { ...aggregato }
  if (risultatoEsercizio !== 0) {
    const esistente = aggregatoConRisultato.PAS_A_IX
    aggregatoConRisultato.PAS_A_IX = {
      importo: round2((esistente?.importo || 0) + risultatoEsercizio),
      conti: [...(esistente?.conti || []), { gruppo: '', conto: "Risultato d'esercizio (ricavi - costi correnti, conti ancora aperti)", importo: risultatoEsercizio }],
    }
  }

  const memo = {}
  for (const v of vociSpList) calcolaImportoSP(v.codice, aggregatoConRisultato, byCodice, figliDi, memo)

  const totAttivo = round2(vociSpList.filter((v) => v.tipo === 'attivita' && v.livello === 1).reduce((s, v) => s + memo[v.codice], 0))
  const totPassivo = round2(vociSpList.filter((v) => v.tipo === 'passivita' && v.livello === 1).reduce((s, v) => s + memo[v.codice], 0))

  const voci = vociSpList.map((v) => {
    let importo = memo[v.codice]
    if (v.codice === 'ATT_TOT') importo = totAttivo
    if (v.codice === 'PAS_TOT') importo = totPassivo
    const conti = !v.totale ? aggregatoConRisultato[v.codice]?.conti || [] : []
    return { ...v, importo, conti, ha_dettaglio: conti.length > 0 }
  })

  return { voci, totAttivo, totPassivo }
}

// Il libro giornale contiene la riapertura dei conti? I saldi per conto sono apertura + movimenti, il dettaglio
// mensile solo i movimenti: se coincidono per tutti i conti, l'apertura non c'e' (tipico dell'anno in corso quando
// l'esercizio precedente non e' ancora stato chiuso e riaperto in contabilita').
export function haApertura(dati) {
  for (const g of dati?.gruppi || []) {
    for (const c of contiDelGruppo(g)) {
      if (!c.mensile) return true   // senza dettaglio mensile non si puo' stabilire: si assume presente
      const mov = Object.values(c.mensile).reduce((s, v) => s + (Number(v) || 0), 0)
      if (Math.abs((c.valore || 0) - mov) > 0.01) return true
    }
  }
  return false
}

// Somma ai conti patrimoniali dell'anno i saldi di fine esercizio precedente (dal suo libro giornale) e porta il
// risultato di quell'esercizio, non ancora destinato, tra gli utili/perdite portati a nuovo.
export function aggiungiSaldiIniziali(aggregatoSP, precedente, annoPrec) {
  const out = { ...aggregatoSP }
  for (const [codice, v] of Object.entries(precedente.aggregatoSP)) {
    const es = out[codice] || { importo: 0, conti: [] }
    out[codice] = {
      importo: round2(es.importo + v.importo),
      conti: [...es.conti, ...v.conti.map((c) => ({ ...c, conto: `${c.conto} (saldo al 31/12/${annoPrec})` }))],
    }
  }
  if (precedente.risultatoEsercizio) {
    const es = out.PAS_A_VIII || { importo: 0, conti: [] }
    out.PAS_A_VIII = {
      importo: round2(es.importo + precedente.risultatoEsercizio),
      conti: [...es.conti, { gruppo: '', conto: `Risultato ${annoPrec} non ancora destinato (dal libro giornale ${annoPrec})`, importo: precedente.risultatoEsercizio }],
    }
  }
  return out
}

// Calcola lo Stato Patrimoniale completo per un documento gia' elaborato.
// Restituisce null se il documento non ha gruppi di conto (non e' un Libro
// Giornale/Prima Nota) — in quel caso il chiamante mostra solo il Conto Economico.
// assestamenti (opzionale): { valori, imposte, periodo } — contropartite patrimoniali degli assestamenti di
// periodo stimati (vedi lib/assestamenti.js), sommati anche al risultato d'esercizio.
// iniziali (opzionale): { dati, anno } o [{ dati, anno }, ...] — libri giornale degli esercizi precedenti, quando quello
// dell'anno non contiene l'apertura dei conti: i loro saldi patrimoniali diventano i saldi iniziali.
export async function calcolaSpDocumento(aziendaId, dati, assestamenti = null, iniziali = null) {
  if (!dati.gruppi) return null
  const ctx = await caricaContestoSP(aziendaId)
  const base = processaGruppiSP(dati, ctx)
  let { aggregatoSP, risultatoEsercizio } = base
  let saldiIniziali = null
  // iniziali: un esercizio { dati, anno } o la catena degli esercizi precedenti senza apertura [{ dati, anno }, ...]
  const catena = Array.isArray(iniziali) ? iniziali : iniziali ? [iniziali] : []
  for (const es of catena) {
    if (!es?.dati?.gruppi) continue
    const prec = processaGruppiSP(es.dati, ctx)
    aggregatoSP = aggiungiSaldiIniziali(aggregatoSP, prec, es.anno)
    ;(saldiIniziali ||= []).push({ anno: es.anno, risultato: prec.risultatoEsercizio })
  }
  if (assestamenti?.valori?.attivi) {
    const r = applicaAssestamentiSP(aggregatoSP, assestamenti.valori, assestamenti.imposte, assestamenti.periodo)
    aggregatoSP = r.aggregato
    risultatoEsercizio = round2(risultatoEsercizio + r.deltaRisultato)
  }
  const { voci, totAttivo, totPassivo } = buildSp(aggregatoSP, ctx, risultatoEsercizio)
  return { voci, totAttivo, totPassivo, risultatoEsercizio, risultatoDaGiornale: base.risultatoEsercizio, nonClassificati: base.nonClassificati, differenza: round2(totAttivo - totPassivo), saldiIniziali }
}

export const rowClassSP = (voce) => {
  if (voce.codice === 'ATT_TOT' || voce.codice === 'PAS_TOT') return 'ce-row-finale'
  if (voce.totale && voce.livello === 1) return 'ce-row-sezione'
  if (voce.totale) return 'ce-row-sottotot'
  return ''
}

export function TabellaSP({ titolo, voci, espansi, toggleEspandi }) {
  return (
    <div className="card table-scroll" style={{ marginBottom: 20 }}>
      <div className="card-header">{titolo}</div>
      <table className="table">
        <thead>
          <tr>
            <th>Voce</th>
            <th style={{ textAlign: 'right', width: 160 }}>Importo (€)</th>
            <th style={{ width: 30 }} />
          </tr>
        </thead>
        <tbody>
          {voci.map((voce) => (
            <React.Fragment key={voce.codice}>
              <tr className={rowClassSP(voce)} style={{ cursor: voce.ha_dettaglio ? 'pointer' : 'default' }} onClick={() => voce.ha_dettaglio && toggleEspandi(voce.codice)}>
                <td style={{ paddingLeft: padding(voce.livello) }}>{voce.descrizione}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  {voce.importo !== 0 ? `${voce.importo < 0 ? '-' : ''}€${fmtSP(Math.abs(voce.importo))}` : '—'}
                </td>
                <td style={{ textAlign: 'center', fontSize: 11 }}>{voce.ha_dettaglio && (espansi.has(voce.codice) ? '▼' : '▶')}</td>
              </tr>
              {espansi.has(voce.codice) &&
                voce.conti.map((c, idx) => (
                  <tr key={`${voce.codice}-${idx}`} className="ce-conto-row">
                    <td style={{ paddingLeft: 46, fontSize: 12, color: '#6b7280' }}>
                      <span style={{ marginRight: 8 }}>└─</span>
                      <span className="badge badge-info" style={{ marginRight: 8 }}>
                        {c.gruppo}
                      </span>
                      {c.conto}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>
                      {c.importo < 0 ? '-' : ''}€{fmtSP(Math.abs(c.importo))}
                    </td>
                    <td />
                  </tr>
                ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
