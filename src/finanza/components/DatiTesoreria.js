import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Dati anagrafici per la Tesoreria (documento CNDCEC «Il budget di tesoreria», §2.5e e §2.5g):
//  - magazzino e DIO, per il Cash Conversion Cycle
//  - linee di credito, per verificare la copertura del fabbisogno negli stress test
// "Non dichiarato" e' uno stato a parte: gli indicatori mostrano "dato mancante" invece di inventare un valore.
// Usato sia nella scheda Aziende sia nel popup di Tesoreria prima di generare la proiezione.

const TIPI = { fido_conto_corrente: 'Fido di conto corrente', anticipo_fatture: 'Anticipo fatture', factoring: 'Factoring', altro: 'Altro' }
const oggiIso = () => new Date().toISOString().slice(0, 10)
const num = (v) => parseFloat(String(v).replace(',', '.'))
const giorniFa = (iso) => (iso ? Math.floor((Date.now() - new Date(`${iso}T00:00:00Z`).getTime()) / 86400000) : null)
const nuovoFin = () => ({ _k: crypto.randomUUID(), id: null, descrizione: '', importo_rata: '', periodicita: 'mensile', data_prossima_rata: '', numero_rate_residue: '' })
const nuovaLinea = () => ({ _k: crypto.randomUUID(), id: null, tipo: 'fido_conto_corrente', descrizione: '', accordato: '', utilizzato: '0', utilizzato_al: oggiIso(), scadenza: '' })

export default function DatiTesoreria({ aziendaId, onSalvato, etichettaSalva = 'Salva dati di tesoreria', compatto = false }) {
  const [caricato, setCaricato] = useState(false)
  const [magazzino, setMagazzino] = useState('') // '' | 'si' | 'no'
  const [dio, setDio] = useState('')
  const [lineeModo, setLineeModo] = useState('') // '' | 'nessuna' | 'presenti'
  const [linee, setLinee] = useState([])
  const [idsOriginali, setIdsOriginali] = useState([])
  const [finModo, setFinModo] = useState('') // '' | 'nessuno' | 'presenti'
  const [fin, setFin] = useState([])
  const [idsFin, setIdsFin] = useState([])
  const [terminiInc, setTerminiInc] = useState('')
  const [terminiPag, setTerminiPag] = useState('')
  const [espModo, setEspModo] = useState('') // '' | 'nessuna' | 'presenti'
  const [espImporto, setEspImporto] = useState('')
  const [espGiorni, setEspGiorni] = useState('')
  const [espAl, setEspAl] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState('')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [{ data: az }, { data: righe }, { data: finRighe }] = await Promise.all([
        supabase.from('aziende').select('ha_magazzino, dio_giorni, linee_credito_dichiarate, finanziamenti_dichiarati, termini_incasso_giorni, termini_pagamento_giorni, esposizioni_dichiarate, esposizioni_scadute_importo, esposizioni_scadute_giorni, esposizioni_scadute_al').eq('id', aziendaId).single(),
        supabase.from('linee_credito').select('*').eq('azienda_id', aziendaId).order('creato_il'),
        supabase.from('finanziamenti').select('*').eq('azienda_id', aziendaId).order('creato_il'),
      ])
      if (!vivo) return
      setMagazzino(az?.ha_magazzino == null ? '' : az.ha_magazzino ? 'si' : 'no')
      setDio(az?.dio_giorni == null ? '' : String(az.dio_giorni))
      setLinee((righe || []).map((r) => ({ _k: r.id, id: r.id, tipo: r.tipo, descrizione: r.descrizione || '', accordato: String(r.accordato), utilizzato: String(r.utilizzato), utilizzato_al: r.utilizzato_al, scadenza: r.scadenza || '' })))
      setIdsOriginali((righe || []).map((r) => r.id))
      setLineeModo(az?.linee_credito_dichiarate ? ((righe || []).length ? 'presenti' : 'nessuna') : '')
      setFin((finRighe || []).map((r) => ({ _k: r.id, id: r.id, descrizione: r.descrizione, importo_rata: String(r.importo_rata), periodicita: r.periodicita, data_prossima_rata: r.data_prossima_rata, numero_rate_residue: String(r.numero_rate_residue) })))
      setIdsFin((finRighe || []).map((r) => r.id))
      setFinModo(az?.finanziamenti_dichiarati ? ((finRighe || []).length ? 'presenti' : 'nessuno') : '')
      setTerminiInc(az?.termini_incasso_giorni == null ? '' : String(az.termini_incasso_giorni))
      setTerminiPag(az?.termini_pagamento_giorni == null ? '' : String(az.termini_pagamento_giorni))
      setEspModo(az?.esposizioni_dichiarate ? ((az.esposizioni_scadute_importo || 0) > 0 ? 'presenti' : 'nessuna') : '')
      setEspImporto(az?.esposizioni_scadute_importo ? String(az.esposizioni_scadute_importo) : '')
      setEspGiorni(az?.esposizioni_scadute_giorni ? String(az.esposizioni_scadute_giorni) : '')
      setEspAl(az?.esposizioni_scadute_al || '')
      setCaricato(true)
    })()
    return () => {
      vivo = false
    }
  }, [aziendaId])

  const aggiorna = (k, campo, valore) => setLinee((prev) => prev.map((l) => (l._k === k ? { ...l, [campo]: valore } : l)))

  const salva = async () => {
    setErrore('')
    setOk(false)
    if (magazzino === 'si' && dio !== '' && !(num(dio) >= 0)) return setErrore('DIO (giorni di magazzino): inserire un numero maggiore o uguale a 0.')
    if (lineeModo === 'presenti') {
      if (!linee.length) return setErrore('Hai indicato che ci sono linee di credito: aggiungine almeno una.')
      for (const l of linee) {
        if (!(num(l.accordato) >= 0)) return setErrore('Ogni linea deve avere un importo accordato (numero ≥ 0).')
        if (!(num(l.utilizzato || 0) >= 0)) return setErrore('L\'importo utilizzato deve essere un numero ≥ 0.')
      }
    }
    if (finModo === 'presenti') {
      if (!fin.length) return setErrore('Hai indicato che ci sono finanziamenti: aggiungine almeno uno.')
      for (const f of fin) {
        if (!f.descrizione.trim()) return setErrore('Ogni finanziamento deve avere una descrizione.')
        if (!(num(f.importo_rata) > 0)) return setErrore('L\'importo della rata deve essere maggiore di 0.')
        if (!f.data_prossima_rata) return setErrore('Indica la data della prossima rata.')
        if (!(parseInt(f.numero_rate_residue, 10) > 0)) return setErrore('Il numero di rate residue deve essere maggiore di 0.')
      }
    }
    if (terminiInc !== '' && !(num(terminiInc) >= 0)) return setErrore('Termini di incasso: inserire un numero di giorni ≥ 0.')
    if (terminiPag !== '' && !(num(terminiPag) >= 0)) return setErrore('Termini di pagamento: inserire un numero di giorni ≥ 0.')
    if (espModo === 'presenti') {
      if (!(num(espImporto) > 0)) return setErrore('Esposizioni scadute: indica l\'importo scaduto (maggiore di 0).')
      if (!(parseInt(espGiorni, 10) >= 0)) return setErrore('Esposizioni scadute: indica da quanti giorni sono scadute.')
      if (!espAl) return setErrore('Esposizioni scadute: indica la data della rilevazione.')
    }
    setSalvando(true)
    try {
      const datiAzienda = {
        ha_magazzino: magazzino === '' ? null : magazzino === 'si',
        dio_giorni: magazzino === 'si' && dio !== '' ? num(dio) : null,
        linee_credito_dichiarate: lineeModo === '' ? null : true,
        finanziamenti_dichiarati: finModo === '' ? null : true,
        termini_incasso_giorni: terminiInc === '' ? null : num(terminiInc),
        termini_pagamento_giorni: terminiPag === '' ? null : num(terminiPag),
        esposizioni_dichiarate: espModo === '' ? null : true,
        esposizioni_scadute_importo: espModo === 'presenti' ? num(espImporto) : espModo === 'nessuna' ? 0 : null,
        esposizioni_scadute_giorni: espModo === 'presenti' ? parseInt(espGiorni, 10) : null,
        esposizioni_scadute_al: espModo === '' ? null : espAl || new Date().toISOString().slice(0, 10),
      }
      const { error: e1 } = await supabase.from('aziende').update(datiAzienda).eq('id', aziendaId)
      if (e1) throw e1

      const daTenere = lineeModo === 'presenti' ? linee : []
      const daEliminare = idsOriginali.filter((id) => !daTenere.some((l) => l.id === id))
      if (daEliminare.length) {
        const { error } = await supabase.from('linee_credito').delete().in('id', daEliminare)
        if (error) throw error
      }
      const salvate = []
      for (const l of daTenere) {
        const riga = { azienda_id: aziendaId, tipo: l.tipo, descrizione: l.descrizione || null, accordato: num(l.accordato), utilizzato: num(l.utilizzato || 0), utilizzato_al: l.utilizzato_al || oggiIso(), scadenza: l.scadenza || null }
        const id = l.id || crypto.randomUUID()
        // eslint-disable-next-line no-await-in-loop
        const { error } = l.id ? await supabase.from('linee_credito').update(riga).eq('id', l.id) : await supabase.from('linee_credito').insert({ id, ...riga })
        if (error) throw error
        salvate.push({ ...l, id, _k: id })
      }
      const finTenere = finModo === 'presenti' ? fin : []
      const finEliminare = idsFin.filter((id) => !finTenere.some((f) => f.id === id))
      if (finEliminare.length) {
        const { error } = await supabase.from('finanziamenti').delete().in('id', finEliminare)
        if (error) throw error
      }
      const finSalvati = []
      for (const f of finTenere) {
        const riga = { azienda_id: aziendaId, descrizione: f.descrizione.trim(), importo_rata: num(f.importo_rata), periodicita: f.periodicita, data_prossima_rata: f.data_prossima_rata, numero_rate_residue: parseInt(f.numero_rate_residue, 10) }
        const id = f.id || crypto.randomUUID()
        // eslint-disable-next-line no-await-in-loop
        const { error } = f.id ? await supabase.from('finanziamenti').update(riga).eq('id', f.id) : await supabase.from('finanziamenti').insert({ id, ...riga })
        if (error) throw error
        finSalvati.push({ ...f, id, _k: id })
      }
      setFin(finSalvati)
      setIdsFin(finSalvati.map((f) => f.id))
      setLinee(salvate)
      setIdsOriginali(salvate.map((l) => l.id))
      setOk(true)
      if (onSalvato) onSalvato({ ...datiAzienda, linee: salvate })
    } catch (e) {
      setErrore(e.message || 'Errore nel salvataggio')
    } finally {
      setSalvando(false)
    }
  }

  if (!caricato) return <p style={{ color: '#666', fontSize: 13 }}>Caricamento dati di tesoreria...</p>

  return (
    <div style={compatto ? {} : { marginTop: 8 }}>
      <div className="form-group">
        <label className="form-label">Magazzino (scorte)</label>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {[['', 'Non dichiarato'], ['si', 'L\'azienda ha magazzino'], ['no', 'Nessun magazzino']].map(([v, t]) => (
            <label key={v} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="radio" name={`mag-${aziendaId}`} checked={magazzino === v} onChange={() => setMagazzino(v)} /> {t}
            </label>
          ))}
          {magazzino === 'si' && (
            <input className="form-control" style={{ maxWidth: 200 }} placeholder="DIO in giorni (opzionale)" value={dio} onChange={(e) => setDio(e.target.value)} />
          )}
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          Serve al Cash Conversion Cycle (DSO + DIO − DPO). Senza magazzino il DIO è 0; se non dichiarato, il CCC è mostrato senza la componente scorte (§2.5e).
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">Linee di credito</label>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[['', 'Non dichiarato'], ['nessuna', 'Nessuna linea di credito'], ['presenti', 'Sono presenti linee di credito']].map(([v, t]) => (
            <label key={v} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="radio" name={`lin-${aziendaId}`} checked={lineeModo === v} onChange={() => setLineeModo(v)} /> {t}
            </label>
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          Serve a verificare se liquidità + linee non utilizzate coprono il fabbisogno nello scenario stressato (§2.5g). Fido di conto: il saldo negativo di conto è già un utilizzo del fido; anticipi e
          factoring: indica l'importo già anticipato.
        </span>
      </div>

      {lineeModo === 'presenti' && (
        <div style={{ marginBottom: 12 }}>
          {linee.map((l) => {
            const eta = giorniFa(l.utilizzato_al)
            return (
              <div key={l._k} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, alignItems: 'end' }}>
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="form-control" value={l.tipo} onChange={(e) => aggiorna(l._k, 'tipo', e.target.value)}>
                    {Object.entries(TIPI).map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Accordato (€)</label>
                  <input className="form-control" value={l.accordato} onChange={(e) => aggiorna(l._k, 'accordato', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Utilizzato (€)</label>
                  <input className="form-control" value={l.utilizzato} onChange={(e) => aggiorna(l._k, 'utilizzato', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Utilizzato al</label>
                  <input type="date" className="form-control" value={l.utilizzato_al} onChange={(e) => aggiorna(l._k, 'utilizzato_al', e.target.value)} />
                  {eta != null && eta > 45 && <span style={{ fontSize: 10, color: '#c2410c' }}>⚠️ dato di {eta} giorni fa: aggiornalo</span>}
                </div>
                <div>
                  <label className="form-label">Scadenza (opz.)</label>
                  <input type="date" className="form-control" value={l.scadenza} onChange={(e) => aggiorna(l._k, 'scadenza', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Nota (opz.)</label>
                  <input className="form-control" value={l.descrizione} onChange={(e) => aggiorna(l._k, 'descrizione', e.target.value)} />
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => setLinee((prev) => prev.filter((x) => x._k !== l._k))}>
                  Rimuovi
                </button>
              </div>
            )
          })}
          <button className="btn btn-outline btn-sm" onClick={() => setLinee((prev) => [...prev, nuovaLinea()])}>
            + Aggiungi linea
          </button>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Finanziamenti in corso (mutui, prestiti)</label>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[['', 'Non dichiarato'], ['nessuno', 'Nessun finanziamento'], ['presenti', 'Sono presenti finanziamenti']].map(([v, t]) => (
            <label key={v} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="radio" name={`fin-${aziendaId}`} checked={finModo === v} onChange={() => setFinModo(v)} /> {t}
            </label>
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          Le rate escono dal piano di ammortamento (capitale + interessi, §2.5a/§2.5b). Se non dichiarato, la Tesoreria stima le rate ripetendo gli importi storici dello stesso mese e lo segnala.
        </span>
      </div>

      {finModo === 'presenti' && (
        <div style={{ marginBottom: 12 }}>
          {fin.map((f) => (
            <div key={f._k} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, alignItems: 'end' }}>
              <div>
                <label className="form-label">Descrizione</label>
                <input className="form-control" value={f.descrizione} onChange={(e) => setFin((prev) => prev.map((x) => (x._k === f._k ? { ...x, descrizione: e.target.value } : x)))} />
              </div>
              <div>
                <label className="form-label">Importo rata (€)</label>
                <input className="form-control" value={f.importo_rata} onChange={(e) => setFin((prev) => prev.map((x) => (x._k === f._k ? { ...x, importo_rata: e.target.value } : x)))} />
              </div>
              <div>
                <label className="form-label">Periodicità</label>
                <select className="form-control" value={f.periodicita} onChange={(e) => setFin((prev) => prev.map((x) => (x._k === f._k ? { ...x, periodicita: e.target.value } : x)))}>
                  <option value="mensile">Mensile</option>
                  <option value="trimestrale">Trimestrale</option>
                </select>
              </div>
              <div>
                <label className="form-label">Prossima rata</label>
                <input type="date" className="form-control" value={f.data_prossima_rata} onChange={(e) => setFin((prev) => prev.map((x) => (x._k === f._k ? { ...x, data_prossima_rata: e.target.value } : x)))} />
              </div>
              <div>
                <label className="form-label">Rate residue (compresa la prossima)</label>
                <input className="form-control" value={f.numero_rate_residue} onChange={(e) => setFin((prev) => prev.map((x) => (x._k === f._k ? { ...x, numero_rate_residue: e.target.value } : x)))} />
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => setFin((prev) => prev.filter((x) => x._k !== f._k))}>
                Rimuovi
              </button>
            </div>
          ))}
          <button className="btn btn-outline btn-sm" onClick={() => setFin((prev) => [...prev, nuovoFin()])}>
            + Aggiungi finanziamento
          </button>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Termini contrattuali medi (giorni)</label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="form-control" style={{ maxWidth: 220 }} placeholder="Incasso dai clienti" value={terminiInc} onChange={(e) => setTerminiInc(e.target.value)} />
          <input className="form-control" style={{ maxWidth: 220 }} placeholder="Pagamento ai fornitori" value={terminiPag} onChange={(e) => setTerminiPag(e.target.value)} />
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>Servono al confronto DSO/DPO misurati vs termini contrattuali (§2.5e, §2.5k: scostamento DSO entro 10 giorni). Facoltativi.</span>
      </div>

      <div className="form-group">
        <label className="form-label">Esposizioni bancarie scadute (Centrale dei Rischi)</label>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[['', 'Non dichiarato'], ['nessuna', 'Nessuna esposizione scaduta'], ['presenti', 'Ci sono esposizioni scadute']].map(([v, t]) => (
            <label key={v} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="radio" name={`esp-${aziendaId}`} checked={espModo === v} onChange={() => setEspModo(v)} /> {t}
            </label>
          ))}
        </div>
        {espModo === 'presenti' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <input className="form-control" style={{ maxWidth: 200 }} placeholder="Importo scaduto (€)" value={espImporto} onChange={(e) => setEspImporto(e.target.value)} />
            <input className="form-control" style={{ maxWidth: 200 }} placeholder="Scaduto da (giorni)" value={espGiorni} onChange={(e) => setEspGiorni(e.target.value)} />
            <input type="date" className="form-control" style={{ maxWidth: 200 }} value={espAl} onChange={(e) => setEspAl(e.target.value)} />
          </div>
        )}
        <span style={{ fontSize: 11, color: '#9ca3af' }}>Il Past Due a 30 giorni (EBA, CCII art. 3) non si ricava dai dati contabili: lo indichi tu dalla Centrale dei Rischi; l'indicatore segnala se il dato è vecchio.</span>
      </div>

      {errore && <div className="alert alert-error">{errore}</div>}
      {ok && <div className="alert alert-success">Dati di tesoreria salvati.</div>}
      <button className="btn btn-primary" onClick={salva} disabled={salvando}>
        {salvando ? 'Salvataggio...' : etichettaSalva}
      </button>
    </div>
  )
}
