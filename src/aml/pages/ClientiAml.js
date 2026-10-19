import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../App'
import { apriFascicolo } from '../index'
import { TIPI_CLIENTE, STATI_CLIENTE, fmtData, fmtEuro } from '../lib/costanti'
import { statoRevisione, ETICHETTA_CLASSE, COLORE_CLASSE } from '../lib/profilatura'

const ETICHETTA_REVISIONE = {
  da_profilare: { t: 'Da profilare', bg: '#FADBD8', c: '#C0392B' },
  scaduta: { t: 'Revisione scaduta', bg: '#FADBD8', c: '#C0392B' },
  in_scadenza: { t: 'In scadenza', bg: '#FCF3CF', c: '#7D6608' },
  regolare: { t: 'Regolare', bg: '#D5F5E3', c: '#155724' },
  chiuso: { t: 'Chiuso', bg: '#EEE', c: '#666' },
}

export function BadgeClasse({ classe }) {
  if (!classe) return <span className="badge" style={{ background: '#EEE', color: '#888' }}>—</span>
  const c = COLORE_CLASSE[classe]
  return <span className="badge" style={{ background: c.bg, color: c.color }}>{ETICHETTA_CLASSE[classe]}</span>
}

const VUOTO = { tipo: 'debitore', natura: 'persona_fisica', denominazione: '', codice_fiscale: '', partita_iva: '', paese: 'IT', indirizzo: '', mandante_id: '', portafoglio: '', riferimento_pratica: '', importo: '', scopo_natura: '', data_apertura: new Date().toISOString().slice(0, 10), note: '' }

export function ModaleCliente({ cliente, mandanti, aziendaId, onClose, onSalvato }) {
  const [f, setF] = useState(cliente ? { ...VUOTO, ...Object.fromEntries(Object.entries(cliente).map(([k, v]) => [k, v ?? ''])) } : VUOTO)
  const [errore, setErrore] = useState(null)
  const [salva, setSalva] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  async function conferma() {
    if (!f.denominazione.trim()) { setErrore('Indica nome o ragione sociale.'); return }
    if (f.tipo === 'debitore' && !f.mandante_id) { setErrore('Indica il mandante che ha affidato la pratica.'); return }
    if (!f.scopo_natura.trim()) { setErrore('Descrivi scopo e natura del rapporto (adeguata verifica, art. 18 D.Lgs. 231/2007).'); return }
    setSalva(true); setErrore(null)
    const payload = {
      azienda_id: aziendaId, tipo: f.tipo, natura: f.natura, denominazione: f.denominazione.trim(),
      codice_fiscale: f.codice_fiscale.trim().toUpperCase() || null, partita_iva: f.partita_iva.trim() || null,
      paese: (f.paese || 'IT').trim().toUpperCase(), indirizzo: f.indirizzo.trim() || null,
      mandante_id: f.tipo === 'debitore' ? f.mandante_id || null : null,
      portafoglio: f.portafoglio || null, riferimento_pratica: f.riferimento_pratica.trim() || null,
      importo: f.importo === '' ? null : Number(String(f.importo).replace(',', '.')),
      scopo_natura: f.scopo_natura.trim(), data_apertura: f.data_apertura || null, note: f.note.trim() || null,
    }
    const r = cliente?.id
      ? await supabase.from('aml_clienti').update(payload).eq('id', cliente.id).select().single()
      : await supabase.from('aml_clienti').insert(payload).select().single()
    setSalva(false)
    if (r.error) { setErrore(r.error.message); return }
    onSalvato(r.data)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h3 className="modal-title">{cliente?.id ? 'Modifica anagrafica' : 'Nuovo cliente AML'}</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        {errore && <div className="alert alert-error">{errore}</div>}
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-control" value={f.tipo} onChange={e => set('tipo', e.target.value)} disabled={!!cliente?.id}>
              <option value="mandante">Mandante (committente)</option>
              <option value="debitore">Debitore</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Natura</label>
            <select className="form-control" value={f.natura} onChange={e => set('natura', e.target.value)}>
              <option value="persona_fisica">Persona fisica</option>
              <option value="persona_giuridica">Persona giuridica / ente</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{f.natura === 'persona_fisica' ? 'Cognome e nome' : 'Ragione sociale'}</label>
          <input className="form-control" value={f.denominazione} onChange={e => set('denominazione', e.target.value)} />
        </div>
        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Codice fiscale</label>
            <input className="form-control" value={f.codice_fiscale} onChange={e => set('codice_fiscale', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Partita IVA</label>
            <input className="form-control" value={f.partita_iva} onChange={e => set('partita_iva', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Paese (sigla)</label>
            <input className="form-control" value={f.paese} maxLength={2} onChange={e => set('paese', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Indirizzo / sede</label>
          <input className="form-control" value={f.indirizzo} onChange={e => set('indirizzo', e.target.value)} />
        </div>
        {f.tipo === 'debitore' ? (
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Mandante</label>
              <select className="form-control" value={f.mandante_id} onChange={e => set('mandante_id', e.target.value)}>
                <option value="">— scegli —</option>
                {mandanti.map(m => <option key={m.id} value={m.id}>{m.denominazione}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Riferimento pratica</label>
              <input className="form-control" value={f.riferimento_pratica} onChange={e => set('riferimento_pratica', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Importo affidato (€)</label>
              <input className="form-control" value={f.importo} onChange={e => set('importo', e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Portafoglio</label>
            <select className="form-control" value={f.portafoglio} onChange={e => set('portafoglio', e.target.value)}>
              <option value="">—</option>
              <option value="bancario">Bancario / NPL (committente vigilato)</option>
              <option value="commerciale">Commerciale</option>
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Scopo e natura del rapporto</label>
          <textarea className="form-control" rows={3} value={f.scopo_natura} onChange={e => set('scopo_natura', e.target.value)}
            placeholder={f.tipo === 'mandante' ? 'Es. mandato al recupero stragiudiziale di crediti al consumo ceduti; volumi attesi, canali di incasso, modalità di riversamento' : 'Es. recupero di credito da finanziamento al consumo; incasso tramite bonifico su conto dedicato'} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Data di apertura del rapporto / pratica</label>
            <input type="date" className="form-control" value={f.data_apertura} onChange={e => set('data_apertura', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Note</label>
            <input className="form-control" value={f.note} onChange={e => set('note', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={conferma} disabled={salva}>{salva ? 'Salvataggio…' : 'Salva'}</button>
        </div>
      </div>
    </div>
  )
}

export default function ClientiAml() {
  const { azienda, setPage } = useApp()
  const [clienti, setClienti] = useState([])
  const [carico, setCarico] = useState(true)
  const [errore, setErrore] = useState(null)
  const [filtro, setFiltro] = useState({ tipo: '', classe: '', revisione: '', testo: '' })
  const [nuovo, setNuovo] = useState(false)

  const carica = useCallback(async () => {
    if (!azienda?.id) return
    setCarico(true)
    const { data, error } = await supabase.from('aml_clienti').select('*').eq('azienda_id', azienda.id).order('denominazione')
    if (error) setErrore(error.message)
    setClienti(data || []); setCarico(false)
  }, [azienda])
  useEffect(() => { carica() }, [carica])

  const mandanti = useMemo(() => clienti.filter(c => c.tipo === 'mandante'), [clienti])
  const nomeMandante = id => mandanti.find(m => m.id === id)?.denominazione || '—'
  const visibili = clienti.filter(c =>
    (!filtro.tipo || c.tipo === filtro.tipo) &&
    (!filtro.classe || (filtro.classe === 'nessuna' ? !c.classe_rischio : c.classe_rischio === filtro.classe)) &&
    (!filtro.revisione || statoRevisione(c) === filtro.revisione || (filtro.revisione === 'bloccato' && c.stato === 'bloccato')) &&
    (!filtro.testo || `${c.denominazione} ${c.codice_fiscale || ''} ${c.riferimento_pratica || ''}`.toLowerCase().includes(filtro.testo.toLowerCase())))

  function esportaCsv() {
    const righe = [['Tipo', 'Denominazione', 'Codice fiscale', 'Partita IVA', 'Paese', 'Mandante', 'Pratica', 'Importo', 'Apertura', 'Stato', 'Classe di rischio', 'Ultima valutazione', 'Prossima revisione']]
    visibili.forEach(c => righe.push([TIPI_CLIENTE[c.tipo], c.denominazione, c.codice_fiscale, c.partita_iva, c.paese, c.tipo === 'debitore' ? nomeMandante(c.mandante_id) : '', c.riferimento_pratica, c.importo, c.data_apertura, STATI_CLIENTE[c.stato], c.classe_rischio ? ETICHETTA_CLASSE[c.classe_rischio] : '', c.ultima_valutazione, c.prossima_revisione]))
    const csv = righe.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `clienti_aml_${azienda.nome}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>Clienti AML — mandanti e debitori</h2>
          <p>Ogni cliente ha il suo fascicolo: identificazione, titolare effettivo, scopo e natura, valutazione scritta del rischio, riesami e documenti.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={esportaCsv} disabled={!visibili.length}>⬇ Elenco CSV</button>
          <button className="btn btn-primary" onClick={() => setNuovo(true)}>+ Nuovo cliente</button>
        </div>
      </div>
      {errore && <div className="alert alert-error">{errore}</div>}

      <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-control" style={{ maxWidth: 260 }} placeholder="Cerca nome, codice fiscale, pratica…" value={filtro.testo} onChange={e => setFiltro(x => ({ ...x, testo: e.target.value }))} />
        <select className="form-control" style={{ maxWidth: 160 }} value={filtro.tipo} onChange={e => setFiltro(x => ({ ...x, tipo: e.target.value }))}>
          <option value="">Tutti i tipi</option><option value="mandante">Mandanti</option><option value="debitore">Debitori</option>
        </select>
        <select className="form-control" style={{ maxWidth: 170 }} value={filtro.classe} onChange={e => setFiltro(x => ({ ...x, classe: e.target.value }))}>
          <option value="">Tutte le classi</option><option value="alto">Alto</option><option value="medio">Medio</option><option value="basso">Basso</option><option value="nessuna">Non profilati</option>
        </select>
        <select className="form-control" style={{ maxWidth: 200 }} value={filtro.revisione} onChange={e => setFiltro(x => ({ ...x, revisione: e.target.value }))}>
          <option value="">Tutte le situazioni</option><option value="da_profilare">Da profilare</option><option value="scaduta">Revisione scaduta</option><option value="in_scadenza">In scadenza (30 gg)</option><option value="bloccato">Bloccati da trigger</option>
        </select>
        <span style={{ fontSize: 12, color: '#888' }}>{visibili.length} di {clienti.length}</span>
      </div>

      {carico ? <div className="spinner" /> : !clienti.length ? (
        <div className="empty-state"><p>Nessun cliente. Inserisci prima i mandanti, poi i debitori delle pratiche da sottoporre ad adeguata verifica.</p></div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Cliente</th><th>Tipo</th><th>Mandante / portafoglio</th><th>Importo</th><th>Classe</th><th>Controllo costante</th><th>Stato</th></tr></thead>
            <tbody>
              {visibili.map(c => {
                const r = ETICHETTA_REVISIONE[statoRevisione(c)]
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => apriFascicolo(setPage, c.id)}>
                    <td><strong>{c.denominazione}</strong><div style={{ fontSize: 11, color: '#888' }}>{c.codice_fiscale || c.partita_iva || ''}{c.riferimento_pratica ? ` · pratica ${c.riferimento_pratica}` : ''}</div></td>
                    <td>{TIPI_CLIENTE[c.tipo]}</td>
                    <td>{c.tipo === 'debitore' ? nomeMandante(c.mandante_id) : (c.portafoglio === 'bancario' ? 'Bancario / NPL' : c.portafoglio === 'commerciale' ? 'Commerciale' : '—')}</td>
                    <td>{fmtEuro(c.importo)}</td>
                    <td><BadgeClasse classe={c.classe_rischio} /></td>
                    <td><span className="badge" style={{ background: r.bg, color: r.c }}>{r.t}</span>{c.prossima_revisione && <div style={{ fontSize: 11, color: '#888' }}>entro {fmtData(c.prossima_revisione)}</div>}</td>
                    <td>{c.stato === 'bloccato' ? <span className="badge" style={{ background: '#FADBD8', color: '#C0392B' }}>⛔ Bloccato</span> : STATI_CLIENTE[c.stato]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {nuovo && <ModaleCliente mandanti={mandanti} aziendaId={azienda.id} onClose={() => setNuovo(false)}
        onSalvato={c => { setNuovo(false); apriFascicolo(setPage, c.id) }} />}
    </div>
  )
}
