import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../App'
import { CHECKLIST_GDF, fmtData, oggiISO } from '../lib/costanti'
import { statoRevisione } from '../lib/profilatura'

// ============================================================
// Cruscotto AML: numeri del controllo costante, scheda del registro giornale degli affari (cartaceo) e checklist
// delle 14 voci che la GdF verifica in ispezione, con lo stato calcolato dai dati del portale.
// ============================================================

const STATO = {
  ok: { t: 'Presente', bg: '#D5F5E3', c: '#155724', i: '✓' },
  parziale: { t: 'Parziale', bg: '#FCF3CF', c: '#7D6608', i: '◐' },
  mancante: { t: 'Mancante', bg: '#FADBD8', c: '#C0392B', i: '✗' },
}
const RUOLI_AML = ['RAML', 'DSOS', 'ADV', 'RCI']
const GIORNI_REGISTRO = 1   // il registro giornale degli affari si aggiorna giorno per giorno (AML-01)

function SchedaRegistro({ azienda, imp, onSalvato }) {
  const [f, setF] = useState({ registro_responsabile: imp?.registro_responsabile || '', registro_luogo: imp?.registro_luogo || '' })
  const [modifica, setModifica] = useState(!imp?.registro_responsabile)
  const [errore, setErrore] = useState(null)
  async function salva(extra = {}) {
    const { error } = await supabase.from('aml_impostazioni').upsert({ azienda_id: azienda.id, registro_responsabile: f.registro_responsabile.trim() || null, registro_luogo: f.registro_luogo.trim() || null, ...extra })
    if (error) { setErrore(error.message); return }
    setModifica(false); onSalvato()
  }
  const ultimo = imp?.registro_ultimo_aggiornamento
  const giorni = ultimo ? Math.floor((Date.parse(oggiISO()) - Date.parse(ultimo)) / 86400000) : null
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">📒 Registro giornale degli affari (art. 120 TULPS)</span></div>
      <p style={{ fontSize: 12, color: '#666' }}>Registro cartaceo, da aggiornare giorno per giorno in ordine cronologico (AML-01). In ispezione si esibisce in originale dal luogo di custodia.</p>
      {errore && <div className="alert alert-error">{errore}</div>}
      {modifica ? (
        <div className="grid-2">
          <div className="form-group"><label className="form-label">Responsabile della tenuta</label><input className="form-control" value={f.registro_responsabile} onChange={e => setF(x => ({ ...x, registro_responsabile: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Luogo di custodia</label><input className="form-control" value={f.registro_luogo} onChange={e => setF(x => ({ ...x, registro_luogo: e.target.value }))} placeholder="Es. sede, ufficio amministrazione, armadio blindato" /></div>
          <div><button className="btn btn-primary btn-sm" onClick={() => salva()}>Salva</button></div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
          <span>Responsabile: <strong>{imp?.registro_responsabile}</strong></span>
          <span>Custodia: <strong>{imp?.registro_luogo}</strong></span>
          <span>Ultimo aggiornamento: <strong style={{ color: giorni == null || giorni > GIORNI_REGISTRO ? '#C0392B' : '#155724' }}>{ultimo ? fmtData(ultimo) : 'mai registrato'}</strong>{giorni > GIORNI_REGISTRO ? ` (${giorni} giorni fa)` : ''}</span>
          <button className="btn btn-sm btn-primary" onClick={() => salva({ registro_ultimo_aggiornamento: oggiISO() })}>Aggiornato oggi</button>
          <button className="btn btn-sm" onClick={() => setModifica(true)}>Modifica</button>
        </div>
      )}
    </div>
  )
}

export default function CruscottoAml() {
  const { azienda, setPage } = useApp()
  const [d, setD] = useState(null)

  const carica = useCallback(async () => {
    if (!azienda?.id) return
    const A = azienda.id
    const [cl, tr, dc, imp, ru, ri, pr, de, sv] = await Promise.all([
      supabase.from('aml_clienti').select('id,tipo,stato,classe_rischio,prossima_revisione').eq('azienda_id', A),
      supabase.from('aml_trigger').select('id,stato').eq('azienda_id', A),
      supabase.from('aml_documenti').select('id,cliente_id,categoria,scadenza,annullato').eq('azienda_id', A).eq('annullato', false),
      supabase.from('aml_impostazioni').select('*').eq('azienda_id', A).maybeSingle(),
      supabase.from('ruoli').select('sigla,membro_id').eq('azienda_id', A).in('sigla', RUOLI_AML),
      supabase.from('rischi').select('probabilita,impatto').eq('azienda_id', A).eq('categoria', 'Antiriciclaggio'),
      supabase.from('procedure_azienda').select('codice,stato').eq('azienda_id', A).like('codice', 'AML-%'),
      supabase.from('determine').select('id,stato').eq('azienda_id', A).eq('tipo', 'antiriciclaggio').eq('provvisoria', false),
      supabase.from('aml_valutazioni').select('cliente_id').eq('azienda_id', A),
    ])
    setD({ clienti: cl.data || [], trigger: tr.data || [], doc: dc.data || [], imp: imp.data, ruoli: ru.data || [], rischi: ri.data || [], proc: pr.data || [], delibere: de.data || [], valutati: new Set((sv.data || []).map(v => v.cliente_id)) })
  }, [azienda])
  useEffect(() => { carica() }, [carica])

  if (!d) return <div className="spinner" />
  const oggi = oggiISO()
  const attivi = d.clienti.filter(c => c.stato !== 'chiuso')
  const perStato = s => attivi.filter(c => statoRevisione(c, oggi) === s).length
  const bloccati = attivi.filter(c => c.stato === 'bloccato').length
  const triggerAperti = d.trigger.filter(t => t.stato === 'aperto').length
  const docScaduti = d.doc.filter(x => x.cliente_id && x.scadenza && x.scadenza < oggi).length
  const haDoc = cat => d.doc.some(x => !x.cliente_id && x.categoria === cat)
  const assegnato = s => d.ruoli.some(r => r.sigla === s && r.membro_id)
  const adottate = d.proc.filter(p => p.stato === 'Adottata').map(p => p.codice)
  const adottata = c => adottate.includes(c)
  const rischiValutati = d.rischi.filter(r => r.probabilita && r.impatto).length
  const licenza = d.doc.find(x => !x.cliente_id && x.categoria === 'licenza_tulps')
  const st = (ok, parziale) => (ok ? 'ok' : parziale ? 'parziale' : 'mancante')
  const conFascicolo = attivi.filter(c => d.valutati.has(c.id)).length

  const verifica = {
    1: [st(licenza && (!licenza.scadenza || licenza.scadenza >= oggi) && d.imp?.registro_luogo, licenza || d.imp?.registro_luogo), licenza ? `licenza caricata${licenza.scadenza ? `, scade ${fmtData(licenza.scadenza)}` : ''}` : 'licenza non caricata'],
    2: [st(RUOLI_AML.every(assegnato), RUOLI_AML.some(assegnato)), `ruoli assegnati: ${RUOLI_AML.filter(assegnato).join(', ') || 'nessuno'}`],
    3: [st(assegnato('RAML') && (haDoc('delibera_nomina') || d.delibere.length), assegnato('RAML')), assegnato('RAML') ? 'RAML assegnato' : 'RAML non assegnato nell\'organigramma'],
    4: [st(assegnato('DSOS') && (haDoc('delibera_nomina') || d.delibere.length), assegnato('DSOS')), assegnato('DSOS') ? 'DSOS assegnato' : 'DSOS non assegnato: nessuno può leggere il registro SOS'],
    5: [st(d.delibere.length || haDoc('delibera_nomina'), false), `${d.delibere.length} atti AML in Governance`],
    6: [st(d.rischi.length && rischiValutati === d.rischi.length && haDoc('autovalutazione'), rischiValutati), `${rischiValutati}/${d.rischi.length} rischi AML valutati`],
    7: [st(adottate.length >= 13, adottate.length), `${adottate.length}/13 procedure AML adottate`],
    8: [st(['AML-04', 'AML-05', 'AML-06', 'AML-07', 'AML-08'].every(adottata), adottate.length), 'AML-04…AML-13'],
    9: [st(adottata('AML-03') && conFascicolo, adottata('AML-03') || conFascicolo), adottata('AML-03') ? 'AML-03 adottata' : 'AML-03 non adottata'],
    10: [st(attivi.length && conFascicolo === attivi.length, conFascicolo), `${conFascicolo}/${attivi.length} clienti con valutazione scritta`],
    11: [st(attivi.length && !perStato('scaduta') && !docScaduti, attivi.length), `${perStato('scaduta')} revisioni scadute, ${docScaduti} documenti scaduti`],
    12: [st(adottata('AML-09') && assegnato('DSOS'), adottata('AML-09') || assegnato('DSOS')), adottata('AML-09') ? 'AML-09 adottata' : 'AML-09 non adottata'],
    13: [st(haDoc('formazione'), false), haDoc('formazione') ? 'documenti caricati' : 'nessuna evidenza'],
    14: [st(haDoc('controlli_interni'), d.trigger.some(t => t.stato !== 'aperto')), haDoc('controlli_interni') ? 'verifiche caricate' : 'nessuna verifica caricata'],
  }
  const nOk = Object.values(verifica).filter(v => v[0] === 'ok').length

  const Stat = ({ n, label, colore, onClick }) => (
    <div className="stat-card" style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="stat-num" style={{ color: colore }}>{n}</div><div className="stat-label">{label}</div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h2>🔎 Antiriciclaggio — cruscotto</h2>
        <p>D.Lgs. 231/2007 · {azienda.nome} · presidio pronto per l'ispezione: {nOk} voci su 14</p>
      </div>
      <div className="stats-grid">
        <Stat n={attivi.filter(c => c.tipo === 'mandante').length} label="Mandanti attivi" onClick={() => setPage('aml_clienti')} />
        <Stat n={attivi.filter(c => c.tipo === 'debitore').length} label="Debitori attivi" onClick={() => setPage('aml_clienti')} />
        <Stat n={perStato('da_profilare')} label="Da profilare" colore={perStato('da_profilare') ? '#C0392B' : undefined} onClick={() => setPage('aml_clienti')} />
        <Stat n={perStato('scaduta')} label="Revisioni scadute" colore={perStato('scaduta') ? '#C0392B' : undefined} onClick={() => setPage('aml_clienti')} />
        <Stat n={perStato('in_scadenza')} label="Revisioni nei prossimi 30 giorni" colore={perStato('in_scadenza') ? '#7D6608' : undefined} />
        <Stat n={docScaduti} label="Documenti scaduti nei fascicoli" colore={docScaduti ? '#C0392B' : undefined} />
        <Stat n={triggerAperti} label={`Trigger aperti (${bloccati} posizioni bloccate)`} colore={triggerAperti ? '#C0392B' : undefined} onClick={() => setPage('aml_trigger')} />
        <Stat n={attivi.filter(c => c.classe_rischio === 'alto').length} label="Clienti a rischio alto" />
      </div>

      <SchedaRegistro key={d.imp?.aggiornato_il || 'nuovo'} azienda={azienda} imp={d.imp} onSalvato={carica} />

      <div className="card">
        <div className="card-header"><span className="card-title">Checklist della verifica GdF</span><span style={{ fontSize: 12, color: '#888' }}>stato calcolato dai dati del portale</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>#</th><th>Voce</th><th>Stato</th><th>Dettaglio</th><th>Dove si trova l'evidenza</th></tr></thead>
          <tbody>{CHECKLIST_GDF.map(v => {
            const [s, det] = verifica[v.n]
            return (
              <tr key={v.n}>
                <td>{v.n}</td><td><strong>{v.voce}</strong></td>
                <td><span className="badge" style={{ background: STATO[s].bg, color: STATO[s].c }}>{STATO[s].i} {STATO[s].t}</span></td>
                <td style={{ fontSize: 12 }}>{det}</td>
                <td style={{ fontSize: 12, color: '#666' }}>{v.dove}</td>
              </tr>
            )
          })}</tbody>
        </table></div>
      </div>
    </div>
  )
}
