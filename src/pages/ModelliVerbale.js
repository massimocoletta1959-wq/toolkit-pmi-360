import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'

// Segnaposto disponibili (mostrati nella legenda cliccabile)
const SEGNAPOSTI = [
  ['{{ORGANO}}', 'Nome esteso organo'],
  ['{{AZIENDA}}', 'Ragione sociale'],
  ['{{SETTORE}}', 'Settore azienda'],
  ['{{NUMERO}}', 'Numero verbale'],
  ['{{ANNO}}', 'Anno'],
  ['{{DATA}}', 'Data della seduta'],
  ['{{ORA_INIZIO}}', 'Ora di apertura'],
  ['{{ORA_CHIUSURA}}', 'Ora di chiusura'],
  ['{{LUOGO}}', 'Luogo'],
  ['{{MODALITA}}', 'Presenza/videoconferenza'],
  ['{{SESSIONE}}', 'Ordinaria/straordinaria'],
  ['{{PRESIDENTE}}', 'Presidente della seduta'],
  ['{{SEGRETARIO}}', 'Segretario'],
  ['{{PRESENTI}}', 'N. presenti'],
  ['{{AVENTI_DIRITTO}}', 'N. aventi diritto'],
  ['{{ODG}}', "Elenco punti dell'ordine del giorno"],
  ['{{DELIBERE}}', 'Blocco delle delibere con esiti'],
]

const ORGANO_OPZIONI = [
  ['', 'Qualsiasi organo'],
  ['assemblea', 'Assemblea dei soci'],
  ['cda', 'Consiglio di Amministrazione'],
  ['comitato', 'Comitato'],
  ['collegio_sindacale', 'Collegio Sindacale'],
]
const organoLabel = t => (ORGANO_OPZIONI.find(o => o[0] === (t || ''))?.[1]) || t

const ORGANO_ESTESO = {
  cda: 'Consiglio di Amministrazione', amministratore_unico: 'Amministratore Unico',
  comitato: 'Comitato', collegio_sindacale: 'Collegio Sindacale', assemblea: 'Assemblea dei Soci', altro: 'Organo',
}

// Sostituisce nel testo tutte le occorrenze di `val` con `tag` (se val non vuoto)
function subst(testo, val, tag) {
  if (val == null || String(val).trim() === '') return testo
  const s = String(val).trim()
  return testo.split(s).join(tag)
}

// Converte un verbale compilato in un modello con segnaposti (best-effort)
function verbaleToModello(testo, { azienda, organo, ad, punti, delibere }) {
  let t = testo

  // Blocco ORDINE DEL GIORNO → {{ODG}}  (righe numerate "1. ...", "2. ...")
  if (punti && punti.length) {
    const blocco = punti.map((p, i) => `${i + 1}. ${p.titolo || ''}`).join('\n')
    if (t.includes(blocco)) t = t.replace(blocco, '{{ODG}}')
  }
  // Blocco delibere: se i testi delle delibere sono presenti, li marchio (best-effort)
  if (delibere && delibere.length) {
    delibere.forEach(d => { if (d.testo && d.testo.trim()) t = t.split(d.testo.trim()).join('{{DELIBERE}}') })
  }

  // Campi anagrafici (dal più specifico al più generico)
  const d = ad.data_ora ? new Date(ad.data_ora) : null
  if (d) {
    const dataStr = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
    t = subst(t, dataStr, '{{DATA}}')
    const oraStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    t = subst(t, oraStr, '{{ORA_INIZIO}}')
  }
  t = subst(t, ad.presidente, '{{PRESIDENTE}}')
  t = subst(t, ad.segretario, '{{SEGRETARIO}}')
  t = subst(t, ad.luogo, '{{LUOGO}}')
  t = subst(t, ad.ora_chiusura, '{{ORA_CHIUSURA}}')
  t = subst(t, azienda?.nome, '{{AZIENDA}}')
  if (organo) t = subst(t, ORGANO_ESTESO[organo.tipo], '{{ORGANO}}')
  if (ad.presenti != null) t = subst(t, ad.presenti, '{{PRESENTI}}')
  if (ad.aventi_diritto != null) t = subst(t, ad.aventi_diritto, '{{AVENTI_DIRITTO}}')
  if (ad.numero != null) t = subst(t, String(ad.numero).padStart(2, '0'), '{{NUMERO}}')
  t = subst(t, ad.sessione, '{{SESSIONE}}')

  return t
}

// Modale: scelta dell'assemblea da cui creare il modello
function ScegliAssembleaModal({ azienda, organi = [], filtroOrgano = '', onScelta, onClose }) {
  const [adunanze, setAdunanze] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState(filtroOrgano || '')

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('adunanze').select('*, organi(nome, tipo)')
        .eq('azienda_id', azienda.id).order('created_at', { ascending: false })
      setAdunanze(data || [])
      setLoading(false)
    })()
  }, [azienda])

  const nomeOrgano = (a) => a.organi?.nome || (organi.find(o => o.tipo === a.organi?.tipo)?.nome) || '—'
  const lista = filtro ? adunanze.filter(a => a.organi?.tipo === filtro) : adunanze

  async function scegli(ad) {
    const { data: organo } = await supabase.from('organi').select('*').eq('id', ad.organo_id).single()
    const { data: punti } = await supabase.from('adunanza_punti').select('*').eq('adunanza_id', ad.id).order('ordine')
    const { data: delibere } = await supabase.from('delibere').select('*').eq('adunanza_id', ad.id).order('created_at')
    const testo = ad.verbale_html || ''
    const corpo = verbaleToModello(testo, { azienda, organo, ad, punti: punti || [], delibere: delibere || [] })
    onScelta({
      nome: `Modello da: ${ad.titolo || 'adunanza'}`,
      organo_tipo: organo?.tipo || '',
      corpo_html: corpo,
      intestazione: ad.intestazione || '',
      odg: (punti || []).map(p => ({ titolo: p.titolo || '', relatore: p.relatore || '' })),
      delibere: (delibere || []).map(d => ({ oggetto: d.oggetto || '', testo: d.testo || '', esito: d.esito || 'approvata' })),
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
      <div className="card" style={{ width: 620, maxWidth: '95%', margin: 0, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <span className="card-title">Scegli l'adunanza da usare come modello</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        {organi.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <select className="form-control" style={{ maxWidth: 300 }} value={filtro} onChange={e => setFiltro(e.target.value)}>
              <option value="">Tutti gli organi</option>
              {organi.map(o => <option key={o.id} value={o.tipo}>{o.nome}</option>)}
            </select>
          </div>
        )}
        {loading ? <div className="spinner" /> : lista.length === 0 ? (
          <p style={{ fontSize: 13, color: '#999' }}>Nessuna adunanza registrata da cui partire{filtro ? ' per questo organo' : ''}.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Titolo</th><th>Organo</th><th>Anno</th><th></th></tr></thead>
              <tbody>
                {lista.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.titolo}</td>
                    <td style={{ fontSize: 12, color: '#666' }}>{nomeOrgano(a)}</td>
                    <td style={{ fontSize: 12, color: '#666' }}>{a.anno}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => scegli(a)} disabled={!a.verbale_html}
                        title={a.verbale_html ? '' : 'Questa adunanza non ha ancora un verbale'}>Usa come modello</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 11, color: '#999', marginTop: 10 }}>
          Il verbale scelto verrà convertito in modello inserendo automaticamente i segnaposti al posto di date, nomi e dati variabili. Potrai rifinirlo prima di salvare.
        </div>
      </div>
    </div>
  )
}

export default function ModelliVerbale() {
  const { azienda, modoIncaricato, organoIncarico } = useApp()
  const [modelli, setModelli] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)  // null | {} (nuovo) | {…} (esistente)
  const [daAssemblea, setDaAssemblea] = useState(false)
  const [organi, setOrgani] = useState([])       // organi reali dell'azienda (dal pannello Governance)
  const [filtroOrgano, setFiltroOrgano] = useState('')  // '' = tutti

  const load = useCallback(async () => {
    if (!azienda?.id) return
    setLoading(true)
    let qOrg = supabase.from('organi').select('id, nome, tipo').eq('azienda_id', azienda.id).order('created_at')
    if (modoIncaricato) qOrg = qOrg.eq('id', organoIncarico.organo_id)
    const { data: orgs } = await qOrg
    setOrgani(orgs || [])
    const { data } = await supabase.from('verbale_template').select('*').eq('azienda_id', azienda.id).order('created_at')
    setModelli(data || [])
    setLoading(false)
  }, [azienda, modoIncaricato, organoIncarico])

  useEffect(() => { load() }, [load])

  // etichetta organo: prima cerca tra gli organi reali dell'azienda, poi fallback fisso
  const nomeOrgano = (tipo) => {
    const o = organi.find(x => x.tipo === tipo)
    if (o) return o.nome
    return organoLabel(tipo)
  }
  const modelliFiltrati = filtroOrgano ? modelli.filter(m => m.organo_tipo === filtroOrgano) : modelli

  async function elimina(m) {
    if (!window.confirm(`Eliminare il modello "${m.nome}"?`)) return
    await supabase.from('verbale_template').delete().eq('id', m.id)
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Modelli di verbale</h2>
            <p>Facsimile riutilizzabili per <strong>{azienda?.nome}</strong>: incolla il tuo verbale tipo e inserisci i segnaposto</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setDaAssemblea(true)}>↩ Crea da adunanza</button>
            <button className="btn btn-primary" onClick={() => setEdit({})}>+ Nuovo modello</button>
          </div>
        </div>
      </div>

      {/* Filtro per organo (solo gli organi realmente presenti in Governance) */}
      {organi.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <select className="form-control" style={{ maxWidth: 320 }} value={filtroOrgano} onChange={e => setFiltroOrgano(e.target.value)}>
            <option value="">Tutti gli organi</option>
            {organi.map(o => <option key={o.id} value={o.tipo}>{o.nome}</option>)}
          </select>
        </div>
      )}

      {loading ? <div className="spinner" /> : modelliFiltrati.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ fontSize: 36 }}>📝</div>
            <p>Nessun modello. Crea il primo incollando un verbale che usi di solito (es. quello dell'anno scorso) e sostituendo le parti variabili con i segnaposto.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>Organo</th><th>Predefinito</th><th></th></tr></thead>
              <tbody>
                {modelliFiltrati.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.nome}</td>
                    <td style={{ fontSize: 12, color: '#666' }}>{nomeOrgano(m.organo_tipo)}</td>
                    <td>{m.predefinito ? <span className="badge" style={{ background: '#E9F7EF', color: '#1E8449' }}>Predefinito</span> : <span style={{ color: '#bbb' }}>—</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {(!modoIncaricato || m.organo_id === organoIncarico.organo_id) ? (<>
                          <button className="btn btn-sm" onClick={() => setEdit(m)}>Modifica</button>
                          <button className="btn btn-sm btn-danger" onClick={() => elimina(m)}>Elimina</button>
                        </>) : <span style={{ fontSize: 11, color: '#999' }}>modello dell'azienda</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edit !== null && (
        <ModelloEditor azienda={azienda} organi={organi} filtroOrgano={filtroOrgano} modello={edit}
          onSaved={() => { setEdit(null); load() }} onClose={() => setEdit(null)} />
      )}

      {daAssemblea && (
        <ScegliAssembleaModal azienda={azienda} organi={organi} filtroOrgano={filtroOrgano}
          onScelta={(bozza) => { setDaAssemblea(false); setEdit(bozza) }}
          onClose={() => setDaAssemblea(false)} />
      )}
    </div>
  )
}

// ── Editor modello ────────────────────────────────────────────────────
function ModelloEditor({ azienda, organi = [], filtroOrgano = '', modello, onSaved, onClose }) {
  const { modoIncaricato, organoIncarico } = useApp()
  const editing = !!modello?.id
  const [nome, setNome] = useState(modello?.nome || '')
  const [organoTipo, setOrganoTipo] = useState(modello?.organo_tipo || filtroOrgano || (organi[0]?.tipo) || '')
  const [corpo, setCorpo] = useState(modello?.corpo_html || '')
  const [predefinito, setPredefinito] = useState(modello?.predefinito || false)
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState(null)
  const areaRef = React.useRef(null)
  // struttura trasportata (non editabile qui: si modifica nell'assemblea)
  const intestazione = modello?.intestazione || ''
  const odg = modello?.odg || []
  const delibere = modello?.delibere || []

  // inserisce il segnaposto nel punto del cursore
  function inserisci(tag) {
    const el = areaRef.current
    if (!el) { setCorpo(c => c + tag); return }
    const start = el.selectionStart, end = el.selectionEnd
    setCorpo(c => c.slice(0, start) + tag + c.slice(end))
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = start + tag.length }, 0)
  }

  async function salva() {
    if (!nome.trim()) { setErrore('Dai un nome al modello.'); return }
    setSaving(true); setErrore(null)
    // se questo diventa predefinito, tolgo il flag agli altri dello stesso organo_tipo
    if (predefinito) {
      let q = supabase.from('verbale_template').update({ predefinito: false })
        .eq('azienda_id', azienda.id).eq('organo_tipo', organoTipo || null)
      if (modoIncaricato) q = q.eq('organo_id', organoIncarico.organo_id)
      await q
    }
    const payload = {
      azienda_id: azienda.id, nome: nome.trim(), organo_tipo: organoTipo || null,
      corpo_html: corpo, predefinito,
      intestazione: intestazione || null, odg, delibere,
      // modello creato dall'incaricato: legato al suo organo (lo gestisce solo lui e il gestore)
      ...(modoIncaricato ? { organo_id: organoIncarico.organo_id } : {}),
    }
    const { error } = editing
      ? await supabase.from('verbale_template').update(payload).eq('id', modello.id)
      : await supabase.from('verbale_template').insert(payload)
    setSaving(false)
    if (error) { setErrore(error.message); return }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
      <div className="card" style={{ width: 760, maxWidth: '96%', margin: 0, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <span className="card-title">{editing ? 'Modifica modello' : 'Nuovo modello di verbale'}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 2, minWidth: 200 }}>
            <label className="form-label">Nome del modello *</label>
            <input className="form-control" value={nome} onChange={e => setNome(e.target.value)} placeholder="es. Assemblea ordinaria - approvazione bilancio" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-label">Organo</label>
            <select className="form-control" value={organoTipo} onChange={e => setOrganoTipo(e.target.value)}>
              {organi.length === 0 && <option value="">— Nessun organo in Governance —</option>}
              {organi.map(o => <option key={o.id} value={o.tipo}>{o.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Segnaposto (clicca per inserirli nel punto del cursore)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {SEGNAPOSTI.map(([tag, desc]) => (
              <button key={tag} type="button" className="btn btn-sm" title={desc}
                style={{ fontFamily: 'monospace', fontSize: 11 }} onClick={() => inserisci(tag)}>{tag}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#999' }}>
            <strong>{'{{ODG}}'}</strong> inserisce l'elenco numerato dei punti; <strong>{'{{DELIBERE}}'}</strong> il blocco delle delibere con gli esiti dei voti.
          </div>
        </div>

        {(odg.length > 0 || delibere.length > 0 || intestazione) && (
          <div style={{ background: '#EDEBFA', border: '1px solid #D9D5F5', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#5A4FCF' }}>
            📎 Questo modello porta con sé anche la struttura, che verrà copiata nelle nuove assemblee (e poi potrai modificarla):
            {intestazione ? ' intestazione,' : ''} {odg.length} punti all'ordine del giorno, {delibere.length} delibere.
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Testo del facsimile *</label>
          <textarea ref={areaRef} className="form-control" style={{ minHeight: 300, fontFamily: 'inherit', lineHeight: 1.6 }}
            value={corpo} onChange={e => setCorpo(e.target.value)}
            placeholder={`Incolla qui il tuo verbale tipo e sostituisci le parti variabili con i segnaposto. Esempio:\n\nVERBALE {{ORGANO}} N. {{NUMERO}}/{{ANNO}}\n{{AZIENDA}}\n\nL'anno {{ANNO}}, il giorno {{DATA}}, alle ore {{ORA_INIZIO}}, presso {{LUOGO}}, si è riunita l'assemblea per deliberare sul seguente ordine del giorno:\n{{ODG}}\n\nAssume la presidenza {{PRESIDENTE}}...`} />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={predefinito} onChange={e => setPredefinito(e.target.checked)} />
            Usa come predefinito per questo tipo di organo
          </label>
        </div>

        {errore && <div className="alert alert-error" style={{ marginBottom: 12 }}>{errore}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={salva} disabled={saving}>{saving ? 'Salvataggio…' : 'Salva modello'}</button>
        </div>
      </div>
    </div>
  )
}
