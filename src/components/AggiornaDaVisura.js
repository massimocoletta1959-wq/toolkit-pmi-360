import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { addettiDaVisura, settoreDaAteco } from '../lib/visura'
import { confrontaGovernance } from '../lib/governanceDaVisura'

// ============================================================
// Aggiornamento dell'anagrafica di un'azienda già inserita da una visura
// camerale aggiornata: confronto campo per campo, si applica solo ciò che
// l'utente spunta. Con il modulo Governance attivo confronta anche organo amministrativo, collegio sindacale e
// soci (src/lib/governanceDaVisura.js) e propone le modifiche, anch'esse da spuntare.
// ============================================================

const CAMPI = [
  ['nome', 'Denominazione', a => a.denominazione],
  ['forma_giuridica', 'Forma giuridica', a => a.forma_giuridica],
  ['piva', 'Partita IVA', a => (a.partita_iva || '').replace(/[^0-9]/g, '') || null],
  ['codice_fiscale', 'Codice fiscale', a => a.codice_fiscale],
  ['rea', 'REA', a => a.rea],
  ['pec', 'PEC', a => a.pec],
  ['sede_via', 'Sede — indirizzo', a => a.sede_via],
  ['sede_cap', 'Sede — CAP', a => a.sede_cap],
  ['sede_comune', 'Sede — comune', a => a.sede_comune],
  ['sede_provincia', 'Sede — provincia', a => a.sede_provincia],
  ['capitale_sociale', 'Capitale sociale', a => a.capitale_sociale],
  ['data_costituzione', 'Data di costituzione', a => a.data_costituzione],
  ['ateco', 'Codice ATECO', a => a.ateco],
  ['attivita', 'Attività', a => a.attivita],
  ['settore', 'Settore (dal codice ATECO)', a => (a.ateco ? settoreDaAteco(a.ateco, a.settore_suggerito) : null)],
  ['oggetto_sociale', 'Oggetto sociale', a => a.oggetto_sociale],
  ['numero_dipendenti', 'Numero dipendenti', a => addettiDaVisura(a)?.dipendenti ?? null],
]

const norm = v => (v == null ? '' : String(v)).trim().replace(/\s+/g, ' ').toLowerCase()
const mostra = (k, v) => {
  if (v == null || v === '') return <span style={{ color: '#bbb' }}>—</span>
  if (k === 'data_costituzione') return new Date(v + 'T00:00:00').toLocaleDateString('it-IT')
  return String(v)
}

export default function AggiornaDaVisura({ azienda, onChiudi, onAggiornata }) {
  const [stato, setStato] = useState('scelta')   // scelta | lettura | confronto | salvataggio
  const [errore, setErrore] = useState(null)
  const [diff, setDiff] = useState([])           // [{ k, label, attuale, nuovo, sel }]
  const [addetti, setAddetti] = useState(null)
  const [gov, setGov] = useState([])             // modifiche di governance proposte: [{ ...modifica, sel }]
  const [avvisi, setAvvisi] = useState([])

  async function leggi(file) {
    if (!file) return
    setStato('lettura'); setErrore(null)
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result).split(',')[1])
        r.onerror = () => rej(new Error('lettura del file fallita'))
        r.readAsDataURL(file)
      })
      const { data, error } = await supabase.functions.invoke('extract-visura', { body: { pdf_base64: b64 } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const a = data.azienda || {}
      // controllo di coerenza: la visura deve essere della stessa azienda
      const pivaVisura = (a.partita_iva || '').replace(/[^0-9]/g, '')
      if (azienda.piva && pivaVisura && pivaVisura !== azienda.piva) {
        setErrore(`La visura è di un'altra azienda (P.IVA ${pivaVisura}, qui ${azienda.piva}).`); setStato('scelta'); return
      }
      const righe = CAMPI.map(([k, label, estrai]) => ({ k, label, attuale: azienda[k], nuovo: estrai(a) }))
        .filter(r => r.nuovo != null && r.nuovo !== '' && norm(r.nuovo) !== norm(r.attuale))
        .map(r => ({ ...r, sel: true }))
      setDiff(righe)
      if (azienda.mod_governance) {
        const [o, m] = await Promise.all([
          supabase.from('organi').select('id,tipo,nome,monocratico').eq('azienda_id', azienda.id),
          supabase.from('membri').select('id,nome,cognome').eq('azienda_id', azienda.id),
        ])
        const ids = (o.data || []).map(x => x.id)
        const c = ids.length ? await supabase.from('organo_membri').select('id,organo_id,membro_id,ruolo,data_nomina,quota,membri(nome,cognome)').in('organo_id', ids) : { data: [] }
        setGov(confrontaGovernance(data, { organi: o.data || [], composizione: c.data || [], membri: m.data || [] }).map(x => ({ ...x, sel: true })))
      } else setGov([])
      const add = addettiDaVisura(a)
      setAddetti(add ? { n: add.dipendenti, ind: add.indipendenti, data: add.data } : null)
      setStato('confronto')
    } catch (e) {
      setErrore('Non sono riuscito a leggere la visura: ' + (e.message || String(e))); setStato('scelta')
    }
  }

  // modifiche di governance: prima gli organi (creati o cambiati), poi le composizioni
  async function applicaGovernance(scelte) {
    const avv = []
    const creati = {}
    for (const g of scelte.filter(x => x.azione.tipo === 'organo_crea')) {
      const { data, error } = await supabase.from('organi').insert({ azienda_id: azienda.id, ...g.azione.dati }).select('id').single()
      if (error) throw error
      creati[g.azione.chiaveOrgano] = data.id
    }
    for (const g of scelte.filter(x => x.azione.tipo === 'organo_aggiorna')) {
      const { error } = await supabase.from('organi').update(g.azione.patch).eq('id', g.azione.id)
      if (error) throw error
    }
    for (const g of scelte.filter(x => x.azione.tipo.startsWith('componente_'))) {
      const a = g.azione
      if (a.tipo === 'componente_rimuovi') {
        const { error } = await supabase.from('organo_membri').delete().eq('id', a.id)
        if (error) throw error
      } else if (a.tipo === 'componente_aggiorna') {
        const { error } = await supabase.from('organo_membri').update(a.patch).eq('id', a.id)
        if (error) throw error
      } else {
        const organoId = a.organo_id || creati[a.chiaveOrgano]
        if (!organoId) { avv.push(`${a.persona.nomeCompleto}: non aggiunto perché l'organo non è stato creato.`); continue }
        let membroId = a.membro_id
        if (!membroId) {
          const { data: m, error } = await supabase.from('membri').insert({
            azienda_id: azienda.id, nome: a.persona.nome, cognome: a.persona.cognome,
            email: a.persona.pec || null, pec: a.persona.pec || null, ruolo: a.persona.ruolo,
          }).select('id').single()
          if (error) throw error
          membroId = m.id
        }
        const { error } = await supabase.from('organo_membri').insert({
          organo_id: organoId, membro_id: membroId, ruolo: a.persona.ruolo,
          data_nomina: a.persona.data_nomina || null, quota: a.persona.quota ?? null,
        })
        if (error) throw error
      }
    }
    return avv
  }

  async function applica() {
    const scelti = diff.filter(r => r.sel)
    const sceltiGov = gov.filter(g => g.sel)
    if (scelti.length === 0 && sceltiGov.length === 0) { onChiudi(); return }
    setStato('salvataggio'); setErrore(null)
    try {
      if (scelti.length) {
        const patch = Object.fromEntries(scelti.map(r => [r.k, r.nuovo]))
        const { error } = await supabase.from('aziende').update(patch).eq('id', azienda.id)
        if (error) throw error
      }
      const avv = sceltiGov.length ? await applicaGovernance(sceltiGov) : []
      if (avv.length) { setAvvisi(avv); setStato('fatto'); return }
      onAggiornata()
    } catch (e) {
      setErrore('Aggiornamento non completato: ' + (e.message || String(e)) + '. Ricarica la visura per vedere cosa resta da allineare.')
      setStato('confronto')
    }
  }

  const tutti = diff.length > 0 && diff.every(r => r.sel)
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && stato !== 'salvataggio' && onChiudi()}>
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <div className="modal-title">📄 Aggiorna da visura — {azienda.nome}</div>
          <button className="btn btn-sm" onClick={onChiudi} disabled={stato === 'salvataggio'}>✕</button>
        </div>
        {errore && <div className="alert alert-error" style={{ fontSize: 12.5 }}>{errore}</div>}

        {(stato === 'scelta' || stato === 'lettura') && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              Carica la visura camerale aggiornata (PDF): ti mostro le differenze con l'anagrafica attuale e scegli cosa aggiornare.
              {azienda.mod_governance ? 'Confronto anche organo amministrativo, collegio sindacale e soci con la Governance.' : 'Organi, componenti e soci non vengono modificati (modulo Governance non attivo).'}
            </p>
            <label className="btn btn-primary" style={{ cursor: stato === 'lettura' ? 'default' : 'pointer' }}>
              {stato === 'lettura' ? 'Lettura della visura in corso…' : '📎 Scegli il PDF della visura'}
              <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={stato === 'lettura'}
                onChange={e => { leggi(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
        )}

        {stato === 'fatto' && (<>
          <div className="alert alert-warning" style={{ fontSize: 12.5 }}>Aggiornamento eseguito, con queste eccezioni:{avvisi.map((x, i) => <div key={i}>• {x}</div>)}</div>
          <div className="modal-footer"><button className="btn btn-primary" onClick={onAggiornata}>Chiudi</button></div>
        </>)}

        {(stato === 'confronto' || stato === 'salvataggio') && (<>
          {addetti && (
            <div style={{ fontSize: 12.5, color: '#555', marginBottom: 10 }}>
              Addetti in visura: <strong>{addetti.n} dipendenti</strong>
              {Number.isInteger(addetti.ind) ? ` e ${addetti.ind} indipendenti` : ''}
              {addetti.data ? ` (al ${new Date(addetti.data + 'T00:00:00').toLocaleDateString('it-IT')})` : ''}
            </div>
          )}
          {diff.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 14, color: '#1E8449' }}>✅ L'anagrafica è già allineata alla visura: nessuna differenza.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th style={{ width: 30 }}><input type="checkbox" checked={tutti} onChange={e => setDiff(d => d.map(r => ({ ...r, sel: e.target.checked })))} /></th>
                  <th>Campo</th><th>Attuale</th><th>Da visura</th>
                </tr></thead>
                <tbody>
                  {diff.map((r, i) => (
                    <tr key={r.k}>
                      <td><input type="checkbox" checked={r.sel} onChange={e => setDiff(d => d.map((x, j) => j === i ? { ...x, sel: e.target.checked } : x))} /></td>
                      <td style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' }}>{r.label}</td>
                      <td style={{ fontSize: 12.5, color: '#888', maxWidth: 260 }}>{mostra(r.k, r.attuale)}</td>
                      <td style={{ fontSize: 12.5, color: '#1A3A5C', maxWidth: 260 }}>{mostra(r.k, r.nuovo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {azienda.mod_governance && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1A3A5C', marginBottom: 6 }}>⚖️ Governance</div>
              {gov.length === 0 ? (
                <div style={{ fontSize: 12.5, color: '#1E8449' }}>✅ Organi, componenti e soci sono già allineati alla visura.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr>
                      <th style={{ width: 30 }}><input type="checkbox" checked={gov.every(g => g.sel)} onChange={e => setGov(d => d.map(g => ({ ...g, sel: e.target.checked })))} /></th>
                      <th>Organo</th><th>Modifica</th><th>Attuale</th><th>Da visura</th>
                    </tr></thead>
                    <tbody>
                      {gov.map((g, i) => (
                        <tr key={g.chiave}>
                          <td><input type="checkbox" checked={g.sel} onChange={e => setGov(d => d.map((x, j) => j === i ? { ...x, sel: e.target.checked } : x))} /></td>
                          <td style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>{g.gruppo}</td>
                          <td style={{ fontSize: 12.5, fontWeight: 600, color: g.tipo === 'cessato' ? '#C0392B' : g.tipo === 'nuovo' ? '#1E8449' : '#1A3A5C' }}>{g.descrizione}</td>
                          <td style={{ fontSize: 12.5, color: '#888' }}>{g.attuale || <span style={{ color: '#bbb' }}>—</span>}</td>
                          <td style={{ fontSize: 12.5, color: '#1A3A5C' }}>{g.nuovo || <span style={{ color: '#bbb' }}>—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 11.5, color: '#888', marginTop: 4 }}>I componenti non più in visura vengono tolti dall'organo (la persona resta tra i membri, con atti e verbali già registrati). Togli la spunta se la visura è stata letta in modo incompleto.</div>
                </div>
              )}
            </div>
          )}
          <div className="modal-footer">
            <button className="btn" onClick={onChiudi} disabled={stato === 'salvataggio'}>Annulla</button>
            {(diff.length > 0 || gov.length > 0) && (
              <button className="btn btn-primary" onClick={applica} disabled={stato === 'salvataggio' || !(diff.some(r => r.sel) || gov.some(g => g.sel))}>
                {stato === 'salvataggio' ? 'Salvataggio…' : `Applica ${diff.filter(r => r.sel).length + gov.filter(g => g.sel).length} modific${diff.filter(r => r.sel).length + gov.filter(g => g.sel).length === 1 ? 'a' : 'he'}`}
              </button>
            )}
          </div>
        </>)}
      </div>
    </div>
  )
}
