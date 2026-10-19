import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../App'
import { clienteAperto } from '../index'
import { ModaleCliente, BadgeClasse } from './ClientiAml'
import {
  TIPI_CLIENTE, STATI_CLIENTE, RUOLI_SOGGETTO, ESITI_LISTE, TIPI_VALUTAZIONE, TIPI_TRIGGER, STATI_TRIGGER,
  CATEGORIE_DOC_CLIENTE, CATEGORIE_CON_SCADENZA, fmtData, fmtDataOra, fmtEuro, oggiISO, sha256File, nomeUtente, percorsoFile,
} from '../lib/costanti'
import {
  fattoriPer, calcolaProfilo, prossimaRevisione, bozzaMotivazione, erroriValutazione, statoRevisione, ETICHETTA_CLASSE, CLASSI,
} from '../lib/profilatura'

const STAMPA = `
@media print {
  .sidebar, .no-print, .modal-overlay { display: none !important; }
  .main-content { margin: 0 !important; padding: 0 !important; }
  .card { break-inside: avoid; box-shadow: none !important; border: 1px solid #ccc; }
  details { display: block; } details > summary { list-style: none; }
  details:not([open]) > *:not(summary) { display: block !important; }
}`

const Sezione = ({ titolo, azioni, children }) => (
  <div className="card">
    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span className="card-title">{titolo}</span>
      <div className="no-print" style={{ display: 'flex', gap: 6 }}>{azioni}</div>
    </div>
    {children}
  </div>
)

const Riga = ({ etichetta, children }) => (
  <div style={{ display: 'flex', gap: 10, fontSize: 13, padding: '3px 0' }}>
    <span style={{ minWidth: 190, color: '#888' }}>{etichetta}</span><span style={{ whiteSpace: 'pre-wrap' }}>{children || '—'}</span>
  </div>
)

const Modale = ({ titolo, onClose, children, larghezza = 640 }) => (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" style={{ maxWidth: larghezza }}>
      <div className="modal-header">
        <h3 className="modal-title">{titolo}</h3>
        <button className="btn btn-icon" onClick={onClose}>✕</button>
      </div>
      {children}
    </div>
  </div>
)

// ── Soggetto collegato (titolare effettivo, legale rappresentante, esecutore, terzo pagatore) ──
function ModaleSoggetto({ cliente, onClose, onSalvato }) {
  const [f, setF] = useState({ ruolo: cliente.natura === 'persona_giuridica' ? 'titolare_effettivo' : 'terzo_pagatore', nome: '', codice_fiscale: '', data_nascita: '', paese: 'IT', quota_pct: '', criterio: '', pep: 'false', esito_liste: 'negativo', fonte_verifica: '', verificato_il: oggiISO(), note: '' })
  const [errore, setErrore] = useState(null)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  async function salva() {
    if (!f.nome.trim()) { setErrore('Indica il nominativo.'); return }
    if (!f.fonte_verifica.trim()) { setErrore('Indica le fonti consultate (visura, registro titolari effettivi, liste UE/ONU, banche dati PEP).'); return }
    const { error } = await supabase.from('aml_soggetti').insert({
      azienda_id: cliente.azienda_id, cliente_id: cliente.id, ruolo: f.ruolo, nome: f.nome.trim(),
      codice_fiscale: f.codice_fiscale.trim().toUpperCase() || null, data_nascita: f.data_nascita || null, paese: f.paese.trim().toUpperCase() || null,
      quota_pct: f.quota_pct === '' ? null : Number(String(f.quota_pct).replace(',', '.')), criterio: f.criterio.trim() || null,
      pep: f.pep === 'true', esito_liste: f.esito_liste, fonte_verifica: f.fonte_verifica.trim(), verificato_il: f.verificato_il || null, note: f.note.trim() || null,
    })
    if (error) { setErrore(error.message); return }
    onSalvato()
  }
  return (
    <Modale titolo="Soggetto collegato" onClose={onClose}>
      {errore && <div className="alert alert-error">{errore}</div>}
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Ruolo</label>
          <select className="form-control" value={f.ruolo} onChange={e => set('ruolo', e.target.value)}>
            {Object.entries(RUOLI_SOGGETTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="form-group"><label className="form-label">Nominativo</label><input className="form-control" value={f.nome} onChange={e => set('nome', e.target.value)} /></div>
      </div>
      <div className="grid-3">
        <div className="form-group"><label className="form-label">Codice fiscale</label><input className="form-control" value={f.codice_fiscale} onChange={e => set('codice_fiscale', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Data di nascita</label><input type="date" className="form-control" value={f.data_nascita} onChange={e => set('data_nascita', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Paese</label><input className="form-control" maxLength={2} value={f.paese} onChange={e => set('paese', e.target.value)} /></div>
      </div>
      {f.ruolo === 'titolare_effettivo' && (
        <div className="grid-2">
          <div className="form-group"><label className="form-label">Quota (%)</label><input className="form-control" value={f.quota_pct} onChange={e => set('quota_pct', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Criterio</label>
            <select className="form-control" value={f.criterio} onChange={e => set('criterio', e.target.value)}>
              <option value="">—</option><option value="proprieta">Proprietà diretta o indiretta (&gt; 25%)</option><option value="controllo">Controllo (voti, influenza dominante)</option><option value="residuale">Residuale: legale rappresentante / amministratore</option>
            </select></div>
        </div>
      )}
      {f.ruolo === 'terzo_pagatore' && (
        <div className="form-group"><label className="form-label">Legame con il debitore</label><input className="form-control" value={f.criterio} onChange={e => set('criterio', e.target.value)} placeholder="Es. coniuge, garante, società del gruppo" /></div>
      )}
      <div className="grid-3">
        <div className="form-group"><label className="form-label">PEP</label>
          <select className="form-control" value={f.pep} onChange={e => set('pep', e.target.value)}><option value="false">No</option><option value="true">Sì</option></select></div>
        <div className="form-group"><label className="form-label">Liste di sanzioni</label>
          <select className="form-control" value={f.esito_liste} onChange={e => set('esito_liste', e.target.value)}>
            {Object.entries(ESITI_LISTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="form-group"><label className="form-label">Verificato il</label><input type="date" className="form-control" value={f.verificato_il} onChange={e => set('verificato_il', e.target.value)} /></div>
      </div>
      <div className="form-group"><label className="form-label">Fonti consultate</label><input className="form-control" value={f.fonte_verifica} onChange={e => set('fonte_verifica', e.target.value)} placeholder="Es. visura del 10/10/2026, registro titolari effettivi, liste UE e ONU, ricerca notizie" /></div>
      <div className="form-group"><label className="form-label">Note</label><input className="form-control" value={f.note} onChange={e => set('note', e.target.value)} /></div>
      <div className="modal-footer"><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={salva}>Salva</button></div>
    </Modale>
  )
}

// ── Valutazione del rischio: profilatura iniziale o riesame (AML-03, AML-07) ──
function ModaleValutazione({ cliente, precedente, autore, onClose, onSalvato }) {
  const [tipo, setTipo] = useState(precedente ? 'riesame_periodico' : 'iniziale')
  const [scelte, setScelte] = useState(() => Object.fromEntries((precedente?.fattori || []).filter(d => d.valore).map(d => [d.codice, d.valore])))
  const profilo = useMemo(() => calcolaProfilo(cliente.tipo, scelte), [cliente.tipo, scelte])
  const [classe, setClasse] = useState('')
  const [motivazione, setMotivazione] = useState('')
  const [data, setData] = useState(oggiISO())
  const [informazioni, setInformazioni] = useState('')
  const [variazioni, setVariazioni] = useState('')
  const [conseguenze, setConseguenze] = useState('')
  const [errori, setErrori] = useState([])
  const [salva, setSalva] = useState(false)
  const classeFinale = classe || profilo.classe

  async function conferma() {
    const e = erroriValutazione({ profilo, classe: classeFinale, motivazione, informazioni, variazioni, conseguenze, tipoValutazione: tipo })
    setErrori(e)
    if (e.length) return
    setSalva(true)
    const { error } = await supabase.from('aml_valutazioni').insert({
      azienda_id: cliente.azienda_id, cliente_id: cliente.id, tipo, data,
      fattori: profilo.dettaglio, punteggio: profilo.punteggio, classe_calcolata: profilo.classe, classe: classeFinale,
      motivazione: motivazione.trim(),
      informazioni_verificate: tipo === 'iniziale' ? (informazioni.trim() || null) : informazioni.trim(),
      variazioni: tipo === 'iniziale' ? (variazioni.trim() || null) : variazioni.trim(),
      conseguenze: tipo === 'iniziale' ? (conseguenze.trim() || null) : conseguenze.trim(),
      prossima_revisione: prossimaRevisione(classeFinale, data), autore_nome: autore,
    })
    setSalva(false)
    if (error) { setErrori([error.message]); return }
    onSalvato()
  }

  return (
    <Modale titolo={precedente ? 'Nuovo riesame del profilo di rischio' : 'Profilatura del rischio (AML-03)'} onClose={onClose} larghezza={820}>
      <div className="alert alert-info" style={{ fontSize: 12 }}>
        La GdF contesta i fascicoli in cui c'è solo la classe di rischio: valuta <strong>ogni</strong> fattore (anche quelli assenti) e scrivi la motivazione.
        Una valutazione salvata non si modifica più: per correggerla si registra un nuovo riesame.
      </div>
      {errori.length > 0 && <div className="alert alert-error">{errori.map((x, i) => <div key={i}>{x}</div>)}</div>}
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Tipo di valutazione</label>
          <select className="form-control" value={tipo} onChange={e => setTipo(e.target.value)}>
            {Object.entries(TIPI_VALUTAZIONE).filter(([k]) => precedente ? k !== 'iniziale' : k === 'iniziale').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="form-group"><label className="form-label">Data</label><input type="date" className="form-control" value={data} max={oggiISO()} onChange={e => setData(e.target.value)} /></div>
      </div>

      <table style={{ width: '100%', fontSize: 13, marginBottom: 12 }}>
        <thead><tr><th style={{ textAlign: 'left' }}>Fattore</th><th style={{ textAlign: 'left' }}>Valutazione</th><th>Punti</th></tr></thead>
        <tbody>
          {fattoriPer(cliente.tipo).map(f => {
            const d = profilo.dettaglio.find(x => x.codice === f.codice)
            return (
              <tr key={f.codice}>
                <td style={{ padding: '4px 6px', verticalAlign: 'top', width: '38%' }}>{f.fattore}</td>
                <td style={{ padding: '4px 6px' }}>
                  <select className="form-control" value={scelte[f.codice] || ''} onChange={e => setScelte(s => ({ ...s, [f.codice]: e.target.value }))}
                    style={{ borderColor: scelte[f.codice] ? undefined : '#E5A0A0' }}>
                    <option value="">— da valutare —</option>
                    {f.opzioni.map(o => <option key={o.valore} value={o.valore}>{o.label}{o.alto ? ' (alto d\'ufficio)' : ''}</option>)}
                  </select>
                </td>
                <td style={{ textAlign: 'center', fontWeight: 600, color: d?.forza_alto ? '#C0392B' : '#333' }}>{d?.punti ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, fontSize: 13 }}>
        <span>Punteggio <strong>{profilo.punteggio}</strong></span>
        <span>Classe calcolata <BadgeClasse classe={profilo.classe} /></span>
        {profilo.motiviAlto.length > 0 && <span style={{ color: '#C0392B', fontSize: 12 }}>Alto d'ufficio: {profilo.motiviAlto.join('; ')}</span>}
        <span style={{ marginLeft: 'auto' }}>Classe attribuita&nbsp;
          <select className="form-control" style={{ display: 'inline-block', width: 'auto' }} value={classe} onChange={e => setClasse(e.target.value)}>
            <option value="">come calcolata</option>
            {CLASSI.map(c => <option key={c} value={c}>{ETICHETTA_CLASSE[c]}</option>)}
          </select>
        </span>
      </div>

      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Motivazione scritta della classificazione</span>
          <button type="button" className="btn btn-sm" disabled={!profilo.completo} onClick={() => setMotivazione(bozzaMotivazione(profilo, classeFinale))}>Componi dai fattori</button>
        </label>
        <textarea className="form-control" rows={6} value={motivazione} onChange={e => setMotivazione(e.target.value)}
          placeholder="Quali fattori sono stati considerati e perché si è arrivati a questa classe" />
      </div>
      {tipo !== 'iniziale' && (
        <>
          <div className="form-group"><label className="form-label">Informazioni verificate</label>
            <textarea className="form-control" rows={2} value={informazioni} onChange={e => setInformazioni(e.target.value)} placeholder="Es. documento d'identità, visura aggiornata al…, titolare effettivo, liste, pagamenti dell'ultimo anno" /></div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Variazioni riscontrate</label>
              <textarea className="form-control" rows={2} value={variazioni} onChange={e => setVariazioni(e.target.value)} placeholder="Anche «nessuna variazione»" /></div>
            <div className="form-group"><label className="form-label">Conseguenze sul rischio</label>
              <textarea className="form-control" rows={2} value={conseguenze} onChange={e => setConseguenze(e.target.value)} placeholder="Es. classe confermata; aggiornata a medio per…" /></div>
          </div>
        </>
      )}
      <div style={{ fontSize: 12, color: '#666' }}>Prossima revisione: <strong>{fmtData(prossimaRevisione(classeFinale, data))}</strong> ({classeFinale === 'alto' ? '12' : classeFinale === 'medio' ? '24' : '36'} mesi, procedura AML-07)</div>
      <div className="modal-footer"><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={conferma} disabled={salva}>{salva ? 'Salvataggio…' : 'Salva valutazione'}</button></div>
    </Modale>
  )
}

// ── Documento del fascicolo ──
function ModaleDocumento({ cliente, soggetti, onClose, onSalvato }) {
  const [f, setF] = useState({ categoria: 'documento_identita', descrizione: '', data_documento: '', scadenza: '', soggetto_id: '' })
  const [file, setFile] = useState(null)
  const [errore, setErrore] = useState(null)
  const [salva, setSalva] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  async function conferma() {
    if (!file) { setErrore('Scegli il file.'); return }
    if (CATEGORIE_CON_SCADENZA.includes(f.categoria) && !f.scadenza && f.categoria === 'documento_identita') { setErrore('Indica la scadenza del documento d\'identità.'); return }
    setSalva(true); setErrore(null)
    try {
      const sha = await sha256File(file)
      const path = percorsoFile(cliente.azienda_id, cliente.id, file.name)
      const up = await supabase.storage.from('aml-documenti').upload(path, file, { contentType: file.type || 'application/octet-stream' })
      if (up.error) throw up.error
      const { error } = await supabase.from('aml_documenti').insert({
        azienda_id: cliente.azienda_id, cliente_id: cliente.id, soggetto_id: f.soggetto_id || null, categoria: f.categoria,
        descrizione: f.descrizione.trim() || null, data_documento: f.data_documento || null, scadenza: f.scadenza || null,
        storage_path: path, nome_file: file.name, dimensione: file.size, sha256: sha,
      })
      if (error) throw error
      onSalvato()
    } catch (e) { setErrore(e.message); setSalva(false) }
  }
  return (
    <Modale titolo="Carica documento nel fascicolo" onClose={onClose}>
      {errore && <div className="alert alert-error">{errore}</div>}
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Categoria</label>
          <select className="form-control" value={f.categoria} onChange={e => set('categoria', e.target.value)}>
            {Object.entries(CATEGORIE_DOC_CLIENTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="form-group"><label className="form-label">Riferito a</label>
          <select className="form-control" value={f.soggetto_id} onChange={e => set('soggetto_id', e.target.value)}>
            <option value="">{cliente.denominazione}</option>
            {soggetti.map(s => <option key={s.id} value={s.id}>{s.nome} ({RUOLI_SOGGETTO[s.ruolo]})</option>)}
          </select></div>
      </div>
      <div className="form-group"><label className="form-label">Descrizione</label><input className="form-control" value={f.descrizione} onChange={e => set('descrizione', e.target.value)} /></div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Data del documento</label><input type="date" className="form-control" value={f.data_documento} onChange={e => set('data_documento', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Scadenza {CATEGORIE_CON_SCADENZA.includes(f.categoria) ? '' : '(se prevista)'}</label><input type="date" className="form-control" value={f.scadenza} onChange={e => set('scadenza', e.target.value)} /></div>
      </div>
      <div className="form-group"><input type="file" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
      <div style={{ fontSize: 12, color: '#888' }}>Del file si registra l'impronta SHA-256; i documenti non si cancellano (conservazione decennale, AML-08): un documento errato si annulla con motivazione.</div>
      <div className="modal-footer"><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={conferma} disabled={salva}>{salva ? 'Caricamento…' : 'Carica'}</button></div>
    </Modale>
  )
}

// ── Trigger AML-05: apertura (blocca la posizione) ──
function ModaleTrigger({ cliente, autore, onClose, onSalvato }) {
  const [f, setF] = useState({ tipo: 'soglia_15000', data_rilevazione: oggiISO(), importo: '', descrizione: '' })
  const [errore, setErrore] = useState(null)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  async function conferma() {
    if (!f.descrizione.trim()) { setErrore('Descrivi cosa è stato rilevato.'); return }
    const { data: t, error } = await supabase.from('aml_trigger').insert({
      azienda_id: cliente.azienda_id, cliente_id: cliente.id, tipo: f.tipo, data_rilevazione: f.data_rilevazione,
      importo: f.importo === '' ? null : Number(String(f.importo).replace(',', '.')), descrizione: f.descrizione.trim(), rilevato_nome: autore,
    }).select().single()
    if (error) { setErrore(error.message); return }
    // task per la funzione AML: ticket alla persona assegnata al ruolo RAML nell'organigramma
    const { data: raml } = await supabase.from('ruoli').select('membro_id').eq('azienda_id', cliente.azienda_id).eq('sigla', 'RAML').not('membro_id', 'is', null).limit(1)
    if (raml?.[0]?.membro_id) {
      const { data: tk } = await supabase.from('ticket').insert({
        azienda_id: cliente.azienda_id, membro_id: raml[0].membro_id, tipo: 'manuale', priorita: 'Alta', stato: 'Aperto',
        titolo: `AML: posizione bloccata — ${cliente.denominazione}`.slice(0, 120),
        istruzioni: `Trigger AML-05: ${TIPI_TRIGGER[f.tipo]}.\n${f.descrizione.trim()}\n\nVerifica manuale (registro imprese, liste di sanzioni, PEP, notizie avverse, giustificativi) ed esito motivato nel fascicolo AML entro 5 giorni lavorativi.`,
        scadenza: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      }).select('id').single()
      if (tk?.id) await supabase.from('aml_trigger').update({ ticket_id: tk.id }).eq('id', t.id)
    }
    onSalvato(!!raml?.[0]?.membro_id)
  }
  return (
    <Modale titolo="Trigger AML — blocca la posizione" onClose={onClose}>
      <div className="alert alert-warning" style={{ fontSize: 12 }}>La posizione si blocca subito e passa alla funzione AML: nessun piano di rientro o incasso finché il trigger non è chiuso con esito motivato (procedura AML-05).</div>
      {errore && <div className="alert alert-error">{errore}</div>}
      <div className="form-group"><label className="form-label">Trigger</label>
        <select className="form-control" value={f.tipo} onChange={e => set('tipo', e.target.value)}>
          {Object.entries(TIPI_TRIGGER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Data</label><input type="date" className="form-control" value={f.data_rilevazione} onChange={e => set('data_rilevazione', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Importo (€)</label><input className="form-control" value={f.importo} onChange={e => set('importo', e.target.value)} /></div>
      </div>
      <div className="form-group"><label className="form-label">Cosa è stato rilevato</label><textarea className="form-control" rows={3} value={f.descrizione} onChange={e => set('descrizione', e.target.value)} /></div>
      <div className="modal-footer"><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-danger" onClick={conferma}>Blocca la posizione</button></div>
    </Modale>
  )
}

// ── Chiusura del trigger con esito motivato ──
export function ModaleChiusuraTrigger({ trigger, cliente, autore, onClose, onSalvato }) {
  const [f, setF] = useState({ stato: 'archiviato', fonti_consultate: '', esito_motivato: '' })
  const [errore, setErrore] = useState(null)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  async function conferma() {
    if (!f.fonti_consultate.trim()) { setErrore('Indica le banche dati e i documenti consultati.'); return }
    if (f.esito_motivato.trim().length < 20) { setErrore('Scrivi l\'esito motivato della verifica.'); return }
    const { error } = await supabase.from('aml_trigger').update({ stato: f.stato, fonti_consultate: f.fonti_consultate.trim(), esito_motivato: f.esito_motivato.trim(), chiuso_nome: autore }).eq('id', trigger.id)
    if (error) { setErrore(error.message); return }
    if (f.stato === 'segnalato_dsos') {
      const { data: { user } } = await supabase.auth.getUser()
      const r = await supabase.from('aml_sos').insert({
        azienda_id: trigger.azienda_id, cliente_id: trigger.cliente_id, trigger_id: trigger.id, segnalante: user.id, segnalante_nome: autore,
        soggetto: cliente?.denominazione || null,
        descrizione: `Trigger AML-05 (${TIPI_TRIGGER[trigger.tipo]}) del ${fmtData(trigger.data_rilevazione)}: ${trigger.descrizione}\n\nEsito della verifica: ${f.esito_motivato.trim()}\nFonti: ${f.fonti_consultate.trim()}`,
      })
      if (r.error) { setErrore('Trigger chiuso, ma la segnalazione al DSOS non è stata registrata: ' + r.error.message); return }
    }
    onSalvato()
  }
  return (
    <Modale titolo="Esito della verifica AML" onClose={onClose}>
      {errore && <div className="alert alert-error">{errore}</div>}
      <div style={{ fontSize: 13, marginBottom: 10 }}><strong>{TIPI_TRIGGER[trigger.tipo]}</strong> — {trigger.descrizione}</div>
      <div className="form-group"><label className="form-label">Esito</label>
        <select className="form-control" value={f.stato} onChange={e => set('stato', e.target.value)}>
          <option value="archiviato">Archiviato: nessun sospetto, la posizione si sblocca</option>
          <option value="segnalato_dsos">Segnalazione interna al Delegato SOS</option>
        </select></div>
      <div className="form-group"><label className="form-label">Fonti consultate</label><input className="form-control" value={f.fonti_consultate} onChange={e => set('fonti_consultate', e.target.value)} placeholder="Es. registro imprese, liste UE/ONU, verifica PEP, ricerca notizie, giustificativo del terzo pagatore" /></div>
      <div className="form-group"><label className="form-label">Esito motivato</label><textarea className="form-control" rows={4} value={f.esito_motivato} onChange={e => set('esito_motivato', e.target.value)} placeholder="Es. archiviata, rischio basso: il pagatore è il coniuge, legame documentato con stato di famiglia" /></div>
      <div style={{ fontSize: 12, color: '#888' }}>Dopo la chiusura il trigger non si modifica più. {f.stato === 'segnalato_dsos' ? 'La segnalazione arriva nel registro riservato del Delegato SOS: chi segnala non la vede più e non deve informarne il cliente.' : ''}</div>
      <div className="modal-footer"><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={conferma}>Chiudi il trigger</button></div>
    </Modale>
  )
}

const DESCR_REGISTRO = { aml_clienti: 'Anagrafica', aml_soggetti: 'Soggetto collegato', aml_valutazioni: 'Valutazione', aml_documenti: 'Documento', aml_trigger: 'Trigger' }
const AZIONE = { insert: 'inserimento', update: 'modifica', delete: 'cancellazione' }

export default function FascicoloAml() {
  const { azienda, setPage, profilo, session } = useApp()
  const id = clienteAperto()
  const autore = nomeUtente(profilo, session)
  const [c, setC] = useState(null)
  const [mandante, setMandante] = useState(null)
  const [mandanti, setMandanti] = useState([])
  const [soggetti, setSoggetti] = useState([])
  const [valutazioni, setValutazioni] = useState([])
  const [documenti, setDocumenti] = useState([])
  const [trigger, setTrigger] = useState([])
  const [registro, setRegistro] = useState([])
  const [modale, setModale] = useState(null)   // {tipo, dati}
  const [messaggio, setMessaggio] = useState(null)
  const [errore, setErrore] = useState(null)

  const carica = useCallback(async () => {
    if (!id || !azienda?.id) return
    const [cl, sg, va, dc, tr, rg, md] = await Promise.all([
      supabase.from('aml_clienti').select('*').eq('id', id).eq('azienda_id', azienda.id).maybeSingle(),
      supabase.from('aml_soggetti').select('*').eq('cliente_id', id).order('creato_il'),
      supabase.from('aml_valutazioni').select('*').eq('cliente_id', id).order('data', { ascending: false }).order('creato_il', { ascending: false }),
      supabase.from('aml_documenti').select('*').eq('cliente_id', id).order('caricato_il', { ascending: false }),
      supabase.from('aml_trigger').select('*').eq('cliente_id', id).order('creato_il', { ascending: false }),
      supabase.from('aml_registro').select('*').eq('azienda_id', azienda.id).eq('cliente_id', id).order('quando', { ascending: false }).limit(200),
      supabase.from('aml_clienti').select('id,denominazione').eq('azienda_id', azienda.id).eq('tipo', 'mandante').order('denominazione'),
    ])
    if (cl.error) setErrore(cl.error.message)
    setC(cl.data); setSoggetti(sg.data || []); setValutazioni(va.data || []); setDocumenti(dc.data || [])
    setTrigger(tr.data || []); setRegistro(rg.data || []); setMandanti(md.data || [])
    setMandante((md.data || []).find(m => m.id === cl.data?.mandante_id) || null)
  }, [id, azienda])
  useEffect(() => { carica() }, [carica])

  const chiudi = (msg) => { setModale(null); if (msg) setMessaggio(msg); carica() }

  async function apriDocumento(d) {
    const { data, error } = await supabase.storage.from('aml-documenti').createSignedUrl(d.storage_path, 120)
    if (error) { setErrore(error.message); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  async function annullaDocumento(d) {
    const motivo = window.prompt('Motivo dell\'annullamento (il documento resta conservato):')
    if (!motivo || !motivo.trim()) return
    const { error } = await supabase.from('aml_documenti').update({ annullato: true, motivo_annullamento: motivo.trim() }).eq('id', d.id)
    if (error) setErrore(error.message); else carica()
  }
  async function eliminaSoggetto(s) {
    if (!window.confirm(`Eliminare ${s.nome} dai soggetti collegati? L'operazione resta nella cronologia.`)) return
    const { error } = await supabase.from('aml_soggetti').delete().eq('id', s.id)
    if (error) setErrore(error.message); else carica()
  }
  async function valida(v) {
    if (!window.confirm('Validare la valutazione come Responsabile AML? La validazione resta registrata con nome, data e ora.')) return
    const { error } = await supabase.from('aml_valutazioni').update({ validata_nome: autore }).eq('id', v.id)
    if (error) setErrore(error.message); else carica()
  }
  async function cambiaStato(stato) {
    const testo = stato === 'chiuso' ? 'Chiudere il rapporto? Il fascicolo resta conservato per 10 anni dalla chiusura.' : 'Riaprire il rapporto?'
    if (!window.confirm(testo)) return
    const { error } = await supabase.from('aml_clienti').update({ stato, data_chiusura: stato === 'chiuso' ? oggiISO() : null }).eq('id', c.id)
    if (error) setErrore(error.message); else carica()
  }

  if (!id) return <div className="empty-state"><p>Nessun cliente selezionato.</p><button className="btn" onClick={() => setPage('aml_clienti')}>Vai ai clienti</button></div>
  if (!c) return errore ? <div className="alert alert-error">{errore}</div> : <div className="spinner" />

  const oggi = oggiISO()
  const aperti = trigger.filter(t => t.stato === 'aperto')
  const docAttivi = documenti.filter(d => !d.annullato)
  const scaduti = docAttivi.filter(d => d.scadenza && d.scadenza < oggi)
  const sr = statoRevisione(c)
  const ultima = valutazioni[0]
  const te = soggetti.filter(s => s.ruolo === 'titolare_effettivo')

  // cosa manca perché il fascicolo sia completo (verbali GdF: fascicoli incompleti, TE non individuato, riesami assenti)
  const mancanze = []
  if (!c.scopo_natura) mancanze.push('scopo e natura del rapporto')
  if (!docAttivi.some(d => d.categoria === 'documento_identita')) mancanze.push('documento d\'identità')
  if (c.natura === 'persona_giuridica' && !docAttivi.some(d => d.categoria === 'visura')) mancanze.push('visura camerale')
  if (c.natura === 'persona_giuridica' && !te.length) mancanze.push('titolare effettivo')
  if (c.natura === 'persona_giuridica' && te.length && !docAttivi.some(d => d.categoria === 'schema_controllo') && c.tipo === 'mandante') mancanze.push('schema della catena di controllo')
  if (!valutazioni.length) mancanze.push('valutazione scritta del rischio')
  if (sr === 'scaduta') mancanze.push('riesame scaduto')
  if (scaduti.length) mancanze.push(`${scaduti.length} documento/i scaduti`)
  if (c.tipo === 'mandante' && !docAttivi.some(d => d.categoria === 'contratto_mandato')) mancanze.push('contratto di mandato')

  return (
    <div>
      <style>{STAMPA}</style>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="no-print" style={{ fontSize: 12, color: '#2B5FA5', cursor: 'pointer', marginBottom: 4 }} onClick={() => setPage('aml_clienti')}>← Clienti AML</div>
          <h2>Fascicolo AML — {c.denominazione}</h2>
          <p>{TIPI_CLIENTE[c.tipo]} · {azienda.nome} · stampato il {fmtData(oggi)} <span style={{ marginLeft: 8 }}><BadgeClasse classe={c.classe_rischio} /></span>
            {c.stato === 'bloccato' && <span className="badge" style={{ marginLeft: 6, background: '#FADBD8', color: '#C0392B' }}>⛔ Bloccato</span>}
            {c.stato === 'chiuso' && <span className="badge" style={{ marginLeft: 6 }}>Chiuso il {fmtData(c.data_chiusura)}</span>}</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button className="btn" onClick={() => window.print()}>🖨 Stampa / PDF</button>
          <button className="btn" onClick={() => setModale({ tipo: 'anagrafica' })}>Modifica anagrafica</button>
          {c.stato !== 'chiuso' ? <button className="btn" onClick={() => cambiaStato('chiuso')}>Chiudi rapporto</button>
            : <button className="btn" onClick={() => cambiaStato('attivo')}>Riapri</button>}
        </div>
      </div>
      {errore && <div className="alert alert-error no-print">{errore}</div>}
      {messaggio && <div className="alert alert-success no-print" onClick={() => setMessaggio(null)}>{messaggio}</div>}
      {aperti.length > 0 && <div className="alert alert-error">Posizione bloccata: {aperti.length} trigger in attesa dell'esito motivato della funzione AML. Nessun piano di rientro o incasso fino alla chiusura.</div>}
      {mancanze.length > 0
        ? <div className="alert alert-warning">Fascicolo incompleto: manca {mancanze.join(', ')}.</div>
        : <div className="alert alert-success">Fascicolo completo: identificazione, scopo e natura, valutazione scritta e documenti in corso di validità.</div>}

      <Sezione titolo="1. Identificazione e scopo del rapporto">
        <Riga etichetta={c.natura === 'persona_fisica' ? 'Cognome e nome' : 'Ragione sociale'}>{c.denominazione}</Riga>
        <Riga etichetta="Natura">{c.natura === 'persona_fisica' ? 'Persona fisica' : 'Persona giuridica / ente'}</Riga>
        <Riga etichetta="Codice fiscale / P. IVA">{[c.codice_fiscale, c.partita_iva].filter(Boolean).join(' · ')}</Riga>
        <Riga etichetta="Paese · indirizzo">{[c.paese, c.indirizzo].filter(Boolean).join(' · ')}</Riga>
        {c.tipo === 'debitore'
          ? <><Riga etichetta="Mandante">{mandante?.denominazione}</Riga><Riga etichetta="Pratica · importo affidato">{[c.riferimento_pratica, fmtEuro(c.importo)].filter(Boolean).join(' · ')}</Riga></>
          : <Riga etichetta="Portafoglio">{c.portafoglio === 'bancario' ? 'Bancario / NPL' : c.portafoglio === 'commerciale' ? 'Commerciale' : null}</Riga>}
        <Riga etichetta="Scopo e natura del rapporto">{c.scopo_natura}</Riga>
        <Riga etichetta="Apertura · stato">{fmtData(c.data_apertura)} · {STATI_CLIENTE[c.stato]}</Riga>
        {c.note && <Riga etichetta="Note">{c.note}</Riga>}
      </Sezione>

      <Sezione titolo="2. Titolare effettivo, rappresentanti e terzi pagatori" azioni={<button className="btn btn-sm" onClick={() => setModale({ tipo: 'soggetto' })}>+ Soggetto</button>}>
        {!soggetti.length ? <p style={{ fontSize: 13, color: '#888' }}>{c.natura === 'persona_giuridica' ? 'Nessun soggetto: individua il titolare effettivo e ricostruisci la catena di controllo (AML-06).' : 'Nessun soggetto collegato.'}</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Ruolo</th><th>Nominativo</th><th>Quota / criterio</th><th>PEP</th><th>Liste</th><th>Verifica</th><th className="no-print"></th></tr></thead>
            <tbody>{soggetti.map(s => (
              <tr key={s.id}>
                <td>{RUOLI_SOGGETTO[s.ruolo]}</td>
                <td>{s.nome}<div style={{ fontSize: 11, color: '#888' }}>{[s.codice_fiscale, s.paese].filter(Boolean).join(' · ')}</div></td>
                <td>{[s.quota_pct != null ? `${s.quota_pct}%` : null, s.criterio].filter(Boolean).join(' · ') || '—'}</td>
                <td>{s.pep ? <strong style={{ color: '#C0392B' }}>Sì</strong> : 'No'}</td>
                <td>{ESITI_LISTE[s.esito_liste] || '—'}</td>
                <td style={{ fontSize: 12 }}>{fmtData(s.verificato_il)}<div style={{ color: '#888' }}>{s.fonte_verifica}</div></td>
                <td className="no-print"><button className="btn btn-sm" onClick={() => eliminaSoggetto(s)}>✕</button></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Sezione>

      <Sezione titolo="3. Valutazione del rischio e controllo costante" azioni={
        <button className="btn btn-sm btn-primary" onClick={() => setModale({ tipo: 'valutazione' })}>{valutazioni.length ? '+ Riesame' : '+ Profilatura'}</button>}>
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          Classe attuale <BadgeClasse classe={c.classe_rischio} /> · ultima valutazione {fmtData(c.ultima_valutazione)} · prossima revisione <strong style={{ color: sr === 'scaduta' ? '#C0392B' : undefined }}>{fmtData(c.prossima_revisione)}</strong>
        </div>
        {!valutazioni.length && <p style={{ fontSize: 13, color: '#C0392B' }}>Nessuna valutazione: il cliente non ha ancora un profilo di rischio motivato.</p>}
        {valutazioni.map(v => (
          <details key={v.id} open={v.id === ultima?.id} style={{ borderTop: '1px solid #EEE', padding: '8px 0' }}>
            <summary style={{ cursor: 'pointer', fontSize: 13 }}>
              <strong>{fmtData(v.data)}</strong> — {TIPI_VALUTAZIONE[v.tipo]} · <BadgeClasse classe={v.classe} />
              {v.classe !== v.classe_calcolata && <span style={{ fontSize: 11, color: '#7D6608' }}> (calcolata {ETICHETTA_CLASSE[v.classe_calcolata]})</span>}
              <span style={{ fontSize: 11, color: '#888' }}> · {v.autore_nome || 'autore'} · {v.validata_il ? `validata da ${v.validata_nome || ''} il ${fmtDataOra(v.validata_il)}` : 'non validata'}</span>
            </summary>
            <table style={{ width: '100%', fontSize: 12, margin: '6px 0' }}><tbody>
              {(v.fattori || []).map(d => (
                <tr key={d.codice}><td style={{ width: '40%', color: '#666', padding: '2px 4px' }}>{d.fattore}</td><td style={{ padding: '2px 4px' }}>{d.scelta}</td><td style={{ textAlign: 'right', padding: '2px 4px', color: d.forza_alto ? '#C0392B' : undefined }}>{d.punti}</td></tr>
              ))}
              <tr><td style={{ padding: '2px 4px' }}><strong>Punteggio</strong></td><td></td><td style={{ textAlign: 'right', padding: '2px 4px' }}><strong>{v.punteggio}</strong></td></tr>
            </tbody></table>
            <Riga etichetta="Motivazione">{v.motivazione}</Riga>
            {v.informazioni_verificate && <Riga etichetta="Informazioni verificate">{v.informazioni_verificate}</Riga>}
            {v.variazioni && <Riga etichetta="Variazioni riscontrate">{v.variazioni}</Riga>}
            {v.conseguenze && <Riga etichetta="Conseguenze sul rischio">{v.conseguenze}</Riga>}
            <Riga etichetta="Prossima revisione">{fmtData(v.prossima_revisione)}</Riga>
            {!v.validata_il && <button className="btn btn-sm no-print" style={{ marginTop: 6 }} onClick={() => valida(v)}>Valida (Responsabile AML)</button>}
          </details>
        ))}
      </Sezione>

      <Sezione titolo="4. Trigger e verifiche manuali (AML-05)" azioni={<button className="btn btn-sm btn-danger" onClick={() => setModale({ tipo: 'trigger' })}>+ Trigger</button>}>
        {!trigger.length ? <p style={{ fontSize: 13, color: '#888' }}>Nessun trigger rilevato.</p> : trigger.map(t => (
          <div key={t.id} style={{ borderTop: '1px solid #EEE', padding: '8px 0', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span><strong>{fmtData(t.data_rilevazione)}</strong> — {TIPI_TRIGGER[t.tipo]}{t.importo != null ? ` · ${fmtEuro(t.importo)}` : ''}</span>
              <span className="badge" style={t.stato === 'aperto' ? { background: '#FADBD8', color: '#C0392B' } : { background: '#EEE', color: '#555' }}>{STATI_TRIGGER[t.stato]}</span>
            </div>
            <Riga etichetta="Rilevato">{t.descrizione}{t.rilevato_nome ? ` (${t.rilevato_nome})` : ''}</Riga>
            {t.stato !== 'aperto' && <><Riga etichetta="Fonti consultate">{t.fonti_consultate}</Riga><Riga etichetta="Esito motivato">{t.esito_motivato}</Riga><Riga etichetta="Chiuso">{t.chiuso_nome} · {fmtDataOra(t.chiuso_il)}</Riga></>}
            {t.stato === 'aperto' && <button className="btn btn-sm btn-primary no-print" onClick={() => setModale({ tipo: 'chiusura', dati: t })}>Registra l'esito</button>}
          </div>
        ))}
      </Sezione>

      <Sezione titolo="5. Documenti" azioni={<button className="btn btn-sm" onClick={() => setModale({ tipo: 'documento' })}>+ Documento</button>}>
        {!documenti.length ? <p style={{ fontSize: 13, color: '#888' }}>Nessun documento.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Categoria</th><th>Documento</th><th>Scadenza</th><th>Caricato</th><th>Impronta SHA-256</th><th className="no-print"></th></tr></thead>
            <tbody>{documenti.map(d => (
              <tr key={d.id} style={d.annullato ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
                <td>{CATEGORIE_DOC_CLIENTE[d.categoria] || d.categoria}{d.soggetto_id && <div style={{ fontSize: 11, color: '#888' }}>{soggetti.find(s => s.id === d.soggetto_id)?.nome}</div>}</td>
                <td>{d.nome_file}{d.descrizione && <div style={{ fontSize: 11, color: '#888' }}>{d.descrizione}</div>}{d.annullato && <div style={{ fontSize: 11, color: '#C0392B', textDecoration: 'none' }}>Annullato: {d.motivo_annullamento}</div>}</td>
                <td style={{ color: d.scadenza && d.scadenza < oggi && !d.annullato ? '#C0392B' : undefined, fontWeight: d.scadenza && d.scadenza < oggi ? 600 : 400 }}>{fmtData(d.scadenza)}</td>
                <td style={{ fontSize: 12 }}>{fmtDataOra(d.caricato_il)}</td>
                <td style={{ fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: 180 }}>{d.sha256}</td>
                <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm" onClick={() => apriDocumento(d)}>Apri</button>
                  {!d.annullato && <button className="btn btn-sm" onClick={() => annullaDocumento(d)}>Annulla</button>}
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Sezione>

      <Sezione titolo="6. Cronologia (audit trail)">
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13 }}>{registro.length} operazioni registrate</summary>
          <table style={{ width: '100%', fontSize: 12, marginTop: 6 }}><tbody>
            {registro.map(r => (
              <tr key={r.id}><td style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>{fmtDataOra(r.quando)}</td><td style={{ padding: '2px 4px' }}>{DESCR_REGISTRO[r.tabella] || r.tabella}: {AZIONE[r.azione] || r.azione}</td><td style={{ padding: '2px 4px', color: '#888' }}>{r.utente_email}</td></tr>
            ))}
          </tbody></table>
        </details>
      </Sezione>

      {modale?.tipo === 'anagrafica' && <ModaleCliente cliente={c} mandanti={mandanti.filter(m => m.id !== c.id)} aziendaId={azienda.id} onClose={() => setModale(null)} onSalvato={() => chiudi('Anagrafica aggiornata.')} />}
      {modale?.tipo === 'soggetto' && <ModaleSoggetto cliente={c} onClose={() => setModale(null)} onSalvato={() => chiudi('Soggetto registrato.')} />}
      {modale?.tipo === 'valutazione' && <ModaleValutazione cliente={c} precedente={ultima} autore={autore} onClose={() => setModale(null)} onSalvato={() => chiudi('Valutazione registrata.')} />}
      {modale?.tipo === 'documento' && <ModaleDocumento cliente={c} soggetti={soggetti} onClose={() => setModale(null)} onSalvato={() => chiudi('Documento caricato.')} />}
      {modale?.tipo === 'trigger' && <ModaleTrigger cliente={c} autore={autore} onClose={() => setModale(null)}
        onSalvato={conTicket => chiudi(conTicket ? 'Posizione bloccata e task assegnato al Responsabile AML.' : 'Posizione bloccata. Assegna una persona al ruolo RAML nell\'organigramma perché riceva i task.')} />}
      {modale?.tipo === 'chiusura' && <ModaleChiusuraTrigger trigger={modale.dati} cliente={c} autore={autore} onClose={() => setModale(null)} onSalvato={() => chiudi('Esito registrato.')} />}
    </div>
  )
}
