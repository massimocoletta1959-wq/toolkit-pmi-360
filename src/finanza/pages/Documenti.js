import React, { useEffect, useState } from 'react'
import { useApp } from '../../App'
import { supabase } from '../lib/supabase'
import { elaboraXbrlDiretto, haDatiSignificativi } from '../lib/xbrl'
import { estraiPdf, estraiExcel } from '../lib/estrazione'
import { estraiRigheLibroGiornale, raggruppaPerGruppo, raggruppaMensilePerGruppo, mensilePerContoDa } from '../lib/libroGiornale'
import { leggiGiornale } from '../lib/giornali'

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const ANNI = ['2022', '2023', '2024', '2025', '2026', '2027']

const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const round2 = (n) => Math.round(n * 100) / 100

const badgeStato = (stato) => (stato === 'elaborato' ? 'badge-success' : stato === 'errore' ? 'badge-danger' : 'badge-warning')

// Replica della logica "vedi dati" del vecchio frontend: dati_estratti può essere
// JSON diretto, oppure {testo_grezzo: "```json\n...\n```"} se l'AI ha risposto con
// del testo attorno al JSON, oppure {errore: "..."} se l'elaborazione è fallita.
function parseDettaglio(datiEstratti) {
  try {
    if (!datiEstratti) return { note: 'Nessun dato disponibile' }
    const raw = JSON.parse(datiEstratti)
    if (raw.testo_grezzo) {
      const pulito = raw.testo_grezzo.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      return JSON.parse(pulito)
    }
    if (raw.errore) return { note: `Errore: ${raw.errore}` }
    return raw
  } catch {
    return { note: 'Errore nel leggere i dati' }
  }
}

function tipoFileDaEstensione(nomeFile) {
  const ext = nomeFile.split('.').pop().toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (['xlsx', 'xls'].includes(ext)) return 'excel'
  if (ext === 'xbrl') return 'xbrl'
  return null
}

// Tipi documento "anno corrente": come il vecchio "provvisorio", richiedono
// il mese di chiusura del periodo (non coprono l'anno intero).
const TIPI_ANNO_CORRENTE = ['provvisorio', 'prima_nota_corrente', 'libro_giornale_corrente']
const richiedeMeseFine = (tipoDocumento) => TIPI_ANNO_CORRENTE.includes(tipoDocumento)

// Libro Giornale e Lista Prima Nota: parsing deterministico lato browser (nessuna
// AI, nessun costo/latenza di token) — vedi src/lib/libroGiornale.js. Possono
// essere lunghi centinaia di pagine, per questo non passano dalla Edge Function AI.
const TIPI_LIBRO_GIORNALE = ['prima_nota_precedente', 'prima_nota_corrente', 'libro_giornale_precedente', 'libro_giornale_corrente']

function ModalePrevisioni({ aziendaId, aziendaNome, onChiudi, onGenerato }) {
  const [annoDa, setAnnoDa] = useState('2025')
  const [annoA, setAnnoA] = useState('2026')
  const [crescitaRicavi, setCrescitaRicavi] = useState(10)
  const [crescitaCosti, setCrescitaCosti] = useState(10)
  const [generando, setGenerando] = useState(false)
  const [risultato, setRisultato] = useState(null)

  const genera = async () => {
    setGenerando(true)
    setRisultato(null)
    try {
      const { data: docs } = await supabase
        .from('documenti')
        .select('*')
        .eq('azienda_id', aziendaId)
        .eq('anno', annoDa)
        .in('tipo_documento', ['bilancio', 'provvisorio'])
        .eq('stato', 'elaborato')
        .order('tipo_documento')
      const doc = docs?.[0]
      if (!doc) {
        setRisultato({ errore: `Nessun bilancio o provvisorio elaborato trovato per l'anno ${annoDa}` })
        return
      }

      const dati = JSON.parse(doc.dati_estratti)
      const coeffR = 1 + crescitaRicavi / 100
      const coeffC = 1 + crescitaCosti / 100

      const ricaviNuovi = (dati.ricavi?.voci || [])
        .filter((v) => Math.abs(v.importo || 0) > 0)
        .map((v) => ({ descrizione: v.descrizione || 'Ricavi', importo: round2(Math.abs(v.importo) * coeffR) }))
      const costiNuovi = (dati.costi?.voci || [])
        .filter((v) => Math.abs(v.importo || 0) > 0)
        .map((v) => ({ descrizione: v.descrizione || 'Costi', importo: round2(Math.abs(v.importo) * coeffC) }))

      const totRicaviNuovi = round2(Math.abs(dati.ricavi?.totale || 0) * coeffR)
      const totCostiNuovi = round2(Math.abs(dati.costi?.totale || 0) * coeffC)

      const datiPrevisioni = {
        tipo_documento: 'previsioni',
        anno: annoA,
        ricavi: { totale: totRicaviNuovi, voci: ricaviNuovi },
        costi: { totale: totCostiNuovi, voci: costiNuovi },
        ammortamenti: round2(Math.abs(dati.ammortamenti || 0) * coeffC),
        oneri_finanziari: round2(Math.abs(dati.oneri_finanziari || 0) * coeffC),
        margine_operativo: round2(totRicaviNuovi - totCostiNuovi),
        ebitda: round2(totRicaviNuovi - totCostiNuovi),
        patrimonio_netto: 0,
        note: `Previsioni generate da ${doc.tipo_documento} ${annoDa} con crescita ricavi +${crescitaRicavi}% e costi +${crescitaCosti}%`,
      }

      const { error: insErr } = await supabase.from('documenti').insert({
        id: crypto.randomUUID(),
        azienda_id: aziendaId,
        nome_file: `Previsioni_${annoA}_${aziendaNome || ''}.json`,
        tipo_file: 'json',
        tipo_documento: 'previsioni',
        anno: annoA,
        stato: 'elaborato',
        percorso: `generated/${aziendaId}_${annoA}_previsioni.json`,
        dati_estratti: JSON.stringify(datiPrevisioni),
        caricato_il: new Date().toISOString(),
      })
      if (insErr) {
        setRisultato({ errore: insErr.message })
        return
      }

      setRisultato({ totale_ricavi: totRicaviNuovi, totale_costi: totCostiNuovi, ebitda: round2(totRicaviNuovi - totCostiNuovi), note: datiPrevisioni.note })
      onGenerato()
    } catch (e) {
      setRisultato({ errore: e.message || 'Errore nella generazione' })
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>🔮 Genera previsioni da bilancio</h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: -10, marginBottom: 16 }}>Genera previsioni applicando una percentuale di crescita al bilancio storico.</p>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Anno origine</label>
            <select className="form-control" value={annoDa} onChange={(e) => setAnnoDa(e.target.value)}>
              {ANNI.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Anno previsioni</label>
            <select className="form-control" value={annoA} onChange={(e) => setAnnoA(e.target.value)}>
              {ANNI.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Crescita ricavi %</label>
            <input type="number" className="form-control" value={crescitaRicavi} onChange={(e) => setCrescitaRicavi(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label className="form-label">Crescita costi %</label>
            <input type="number" className="form-control" value={crescitaCosti} onChange={(e) => setCrescitaCosti(Number(e.target.value))} />
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={genera} disabled={generando}>
          {generando ? 'Generando...' : '🔮 Genera previsioni'}
        </button>

        {risultato && !risultato.errore && (
          <div className="alert alert-success" style={{ marginTop: 16, marginBottom: 0 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>✅ Previsioni generate!</div>
            <div className="grid-3" style={{ gap: 8, fontSize: 12 }}>
              <div>
                <div style={{ color: '#6b7280' }}>Ricavi</div>
                <div style={{ fontWeight: 700, color: '#1a6b2e' }}>€{fmt(risultato.totale_ricavi)}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280' }}>Costi</div>
                <div style={{ fontWeight: 700, color: '#a32d2d' }}>€{fmt(risultato.totale_costi)}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280' }}>EBITDA</div>
                <div style={{ fontWeight: 700, color: '#1d4ed8' }}>€{fmt(risultato.ebitda)}</div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={onChiudi}>
              Chiudi
            </button>
          </div>
        )}
        {risultato?.errore && (
          <div className="alert alert-error" style={{ marginTop: 16, marginBottom: 0 }}>
            ⚠️ {risultato.errore}
          </div>
        )}
        {!risultato && (
          <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={onChiudi}>
            Annulla
          </button>
        )}
      </div>
    </div>
  )
}

// La Edge Function segna il documento 'elaborando' e lavora in background:
// qui aspettiamo che passi a 'elaborato'/'errore', interrogando la riga ogni
// pochi secondi invece di restare bloccati su una singola richiesta HTTP.
async function attendiElaborazione(documentoId) {
  const inizio = Date.now()
  const timeoutMs = 5 * 60 * 1000
  while (Date.now() - inizio < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 3000))
    // eslint-disable-next-line no-await-in-loop
    const { data } = await supabase.from('documenti').select('stato, dati_estratti').eq('id', documentoId).single()
    if (data?.stato === 'elaborato') return
    if (data?.stato === 'errore') {
      let msg = "Errore durante l'elaborazione AI."
      try {
        const parsed = JSON.parse(data.dati_estratti || '{}')
        if (parsed?.errore) msg = parsed.errore
      } catch {
        // dati_estratti non leggibile: resta il messaggio generico
      }
      throw new Error(msg)
    }
  }
  throw new Error("L'elaborazione sta impiegando più di 5 minuti — controlla più tardi lo stato del documento (potrebbe comunque completarsi in background).")
}

export default function Documenti() {
  const [aziende, setAziende] = useState([])
  // Pmi 360°: l'azienda è quella attiva dell'app (niente selettore nella pagina)
  const { azienda: aziendaAttiva } = useApp()
  const aziendaId = aziendaAttiva?.id || ''
  const [documenti, setDocumenti] = useState([])
  const [loading, setLoading] = useState(false)

  const [tipoDocumento, setTipoDocumento] = useState('bilancio')
  const [anno, setAnno] = useState('2026')
  const [meseFine, setMeseFine] = useState(1)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [errore, setErrore] = useState('')

  const [dettaglio, setDettaglio] = useState(null)
  const [docDettaglio, setDocDettaglio] = useState(null)
  const [showPrevisioni, setShowPrevisioni] = useState(false)
  const [elaborando, setElaborando] = useState(null)
  const [progresso, setProgresso] = useState('')

  useEffect(() => {
    supabase
      .from('aziende')
      .select('id, nome')
      .order('nome')
      .then(({ data }) => setAziende(data || []))
  }, [])

  const carica = async (azId) => {
    setLoading(true)
    const { data, error } = await supabase.from('documenti').select('*').eq('azienda_id', azId).order('caricato_il', { ascending: false })
    if (error) setErrore(error.message)
    else setDocumenti(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (aziendaId) {
      carica(aziendaId)
      setDettaglio(null)
      setDocDettaglio(null)
    }
  }, [aziendaId])

  const uploadFile = async () => {
    if (!file || !aziendaId) return
    const tipoFile = tipoFileDaEstensione(file.name)
    if (!tipoFile) {
      setErrore('Formato non supportato. Usa PDF, Excel (.xlsx/.xls) o XBRL.')
      return
    }
    setUploading(true)
    setErrore('')
    try {
      const percorso = `${aziendaId}/${crypto.randomUUID()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('documenti').upload(percorso, file)
      if (upErr) throw new Error(upErr.message)

      const { error: insErr } = await supabase.from('documenti').insert({
        id: crypto.randomUUID(),
        azienda_id: aziendaId,
        nome_file: file.name,
        tipo_file: tipoFile,
        tipo_documento: tipoDocumento,
        anno,
        mese_fine: richiedeMeseFine(tipoDocumento) ? meseFine : null,
        stato: 'caricato',
        percorso,
        caricato_il: new Date().toISOString(),
      })
      if (insErr) throw new Error(insErr.message)

      setFile(null)
      carica(aziendaId)
    } catch (e) {
      setErrore(e.message || 'Errore durante il caricamento')
    } finally {
      setUploading(false)
    }
  }

  const eliminaDocumento = async (doc) => {
    if (!window.confirm(`Eliminare ${doc.nome_file}?`)) return
    await supabase.storage.from('documenti').remove([doc.percorso])
    const { error } = await supabase.from('documenti').delete().eq('id', doc.id)
    if (error) setErrore(error.message)
    else {
      carica(aziendaId)
      if (docDettaglio?.id === doc.id) {
        setDettaglio(null)
        setDocDettaglio(null)
      }
    }
  }

  const vediDati = (doc) => {
    setDettaglio(parseDettaglio(doc.dati_estratti))
    setDocDettaglio(doc)
  }

  // Libro Giornale / Lista Prima Nota: parsing deterministico interamente nel
  // browser (nessuna Edge Function, nessuna AI). Ricostruisce i saldi di ogni
  // conto e li raggruppa per "gruppo" (es. "06/G", "14/C", "40/F") — la
  // riclassificazione attivita'/passivita'/costi/ricavi si fa poi nel modulo
  // Riclassificazione, gruppo per gruppo, e si applica automaticamente ai conti
  // nuovi degli stessi gruppi nei caricamenti successivi.
  const elaboraLibroGiornale = async (doc) => {
    const { data: blob, error: dlErr } = await supabase.storage.from('documenti').download(doc.percorso)
    if (dlErr) throw new Error(dlErr.message)
    const file = new File([blob], doc.nome_file)

    const righe = await estraiRigheLibroGiornale(file, (pagina, totale) => setProgresso(`Elaboro pagina ${pagina} di ${totale}...`))
    const { saldi, movimentiMensili, descrizioni, diagnostica } = leggiGiornale(righe)   // lettore scelto in base al programma di contabilità
    const gruppi = raggruppaPerGruppo(saldi, descrizioni)
    const mensilePerGruppo = raggruppaMensilePerGruppo(movimentiMensili)
    const mensilePerConto = mensilePerContoDa(movimentiMensili)

    const datiEstratti = {
      tipo_documento: doc.tipo_documento,
      gruppi: Object.values(gruppi)
        .map((g) => ({ gruppo: g.gruppo, descrizione: g.descrizione, importo: g.somma, n_conti: g.conti.length, conti: g.conti.map((c) => ({ ...c, mensile: mensilePerConto[c.conto] || {} })), mensile: mensilePerGruppo[g.gruppo] || {} }))
        .sort((a, b) => a.gruppo.localeCompare(b.gruppo)),
      diagnostica,
    }

    const { error: updErr } = await supabase.from('documenti').update({ dati_estratti: JSON.stringify(datiEstratti), stato: 'elaborato' }).eq('id', doc.id)
    if (updErr) throw new Error(updErr.message)
  }

  // XBRL: lettura strutturata senza AI (fallback se mancano i tag standard: errore
  // esplicito invece del fallback AI-su-testo del vecchio backend, non ancora portato).
  // PDF/Excel: estrazione testo/immagini nel browser + Edge Function AI.
  const elaboraDocumento = async (doc) => {
    setElaborando(doc.id)
    setErrore('')
    setProgresso('')
    try {
      if (TIPI_LIBRO_GIORNALE.includes(doc.tipo_documento)) {
        await elaboraLibroGiornale(doc)
        carica(aziendaId)
        return
      }

      if (doc.tipo_file === 'xbrl') {
        const { data: blob, error: dlErr } = await supabase.storage.from('documenti').download(doc.percorso)
        if (dlErr) throw new Error(dlErr.message)
        const testoXml = await blob.text()
        const risultato = elaboraXbrlDiretto(testoXml, doc.anno)

        if (!haDatiSignificativi(risultato)) {
          setErrore(`"${doc.nome_file}" non contiene i tag XBRL standard attesi e richiederebbe il fallback AI su testo, non portato in questo passaggio.`)
          return
        }
        const { error: updErr } = await supabase.from('documenti').update({ dati_estratti: JSON.stringify(risultato), stato: 'elaborato' }).eq('id', doc.id)
        if (updErr) throw new Error(updErr.message)
        carica(aziendaId)
        return
      }

      // PDF o Excel: serve la Edge Function "estrai-documento"
      const { data: blob, error: dlErr } = await supabase.storage.from('documenti').download(doc.percorso)
      if (dlErr) throw new Error(dlErr.message)
      const file = new File([blob], doc.nome_file)

      let payload
      if (doc.tipo_file === 'pdf') {
        const estratto = await estraiPdf(file)
        payload =
          estratto.modalita === 'vision'
            ? { documentoId: doc.id, tipoFile: 'pdf', tipoDocumento: doc.tipo_documento, anno: doc.anno, modalita: 'vision', immagini: estratto.immagini, mediaType: estratto.mediaType }
            : { documentoId: doc.id, tipoFile: 'pdf', tipoDocumento: doc.tipo_documento, anno: doc.anno, modalita: 'testo', testo: estratto.testo }
      } else {
        const testo = await estraiExcel(file)
        payload = { documentoId: doc.id, tipoFile: 'excel', tipoDocumento: doc.tipo_documento, anno: doc.anno, modalita: 'testo', testo }
      }

      // La function risponde subito (ha solo AVVIATO l'elaborazione in
      // background: evita il timeout HTTP sui documenti più lenti da
      // analizzare). Il risultato vero arriva sulla riga documenti via
      // polling qui sotto.
      const { data: risposta, error: fnErr } = await supabase.functions.invoke('estrai-documento', { body: payload })
      if (fnErr) {
        let messaggio = fnErr.message
        try {
          const errBody = await fnErr.context.json()
          if (errBody?.errore) messaggio = errBody.errore
        } catch {
          // corpo non leggibile: resta il messaggio generico
        }
        throw new Error(messaggio)
      }
      if (risposta?.errore) throw new Error(risposta.errore)

      carica(aziendaId)
      await attendiElaborazione(doc.id)
      carica(aziendaId)
    } catch (e) {
      setErrore(e.message || "Errore nell'elaborazione")
      await supabase.from('documenti').update({ stato: 'errore' }).eq('id', doc.id)
      carica(aziendaId)
    } finally {
      setElaborando(null)
      setProgresso('')
    }
  }

  const haBilancio = documenti.some((d) => ['bilancio', 'provvisorio'].includes(d.tipo_documento) && d.stato === 'elaborato')
  const aziendaCorrente = aziende.find((a) => a.id === aziendaId)

  return (
    <div>
      <h2 style={{ color: '#1a3a5c', marginTop: 0 }}>Documenti</h2>
      <p style={{ color: '#666', marginTop: -8, marginBottom: 20 }}>Carica bilanci, provvisori, budget — l'elaborazione AI arriva nel prossimo passaggio</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div className="form-group" style={{ marginBottom: 16 }}>
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

          {aziendaId && (
            <>
              <div className="grid-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tipo documento</label>
                  <select className="form-control" value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
                    <option value="bilancio">Bilancio esercizio precedente</option>
                    <option value="provvisorio">Bilancio provvisorio</option>
                    <option value="prima_nota_precedente">Lista Prima Nota — Anno precedente</option>
                    <option value="prima_nota_corrente">Lista Prima Nota — Anno corrente</option>
                    <option value="libro_giornale_precedente">Libro Giornale — Anno precedente</option>
                    <option value="libro_giornale_corrente">Libro Giornale — Anno corrente</option>
                    <option value="previsioni">Previsioni lavorazioni</option>
                    <option value="budget">Budget</option>
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
                {richiedeMeseFine(tipoDocumento) && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Mese fine periodo</label>
                    <select className="form-control" value={meseFine} onChange={(e) => setMeseFine(Number(e.target.value))}>
                      {MESI.map((m, i) => (
                        <option key={i + 1} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
                <label className="form-label">File (PDF, Excel, XBRL)</label>
                <input type="file" accept=".pdf,.xlsx,.xls,.xbrl" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={uploadFile} disabled={!file || uploading}>
                {uploading ? 'Caricamento...' : 'Carica documento'}
              </button>
            </>
          )}

          {errore && (
            <div className="alert alert-error" style={{ marginTop: 14, marginBottom: 0 }}>
              {errore}
            </div>
          )}
        </div>
      </div>

      {aziendaId && haBilancio && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={() => setShowPrevisioni(true)}>
            🔮 Genera previsioni da bilancio
          </button>
        </div>
      )}

      {aziendaId && (
        <div className="card">
          <div className="card-header">
            Documenti caricati
            <span className="badge-count">{documenti.length}</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Tipo</th>
                <th>Anno</th>
                <th>Periodo</th>
                <th>Formato</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {documenti.map((doc) => (
                <tr key={doc.id}>
                  <td style={{ fontWeight: 600, color: '#1a3a5c' }}>{doc.nome_file}</td>
                  <td style={{ textTransform: 'capitalize' }}>{doc.tipo_documento}</td>
                  <td>{doc.anno}</td>
                  <td>{doc.mese_fine ? `Gen-${MESI[doc.mese_fine - 1].slice(0, 3)}` : '—'}</td>
                  <td style={{ textTransform: 'uppercase', fontSize: 11 }}>{doc.tipo_file}</td>
                  <td>
                    <span className={`badge ${badgeStato(doc.stato)}`}>{doc.stato}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['caricato', 'errore'].includes(doc.stato) && (
                        <button className="btn btn-outline btn-sm" disabled={elaborando === doc.id} onClick={() => elaboraDocumento(doc)}>
                          {elaborando === doc.id
                            ? progresso || 'Elaboro...'
                            : TIPI_LIBRO_GIORNALE.includes(doc.tipo_documento)
                            ? '⚙️ Elabora'
                            : '🤖 Elabora AI'}
                        </button>
                      )}
                      {doc.stato === 'elaborando' && <span className="badge badge-info">in corso...</span>}
                      {doc.stato === 'elaborato' && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => vediDati(doc)}>
                            Vedi dati
                          </button>
                          {doc.tipo_documento !== 'previsioni' && (
                            <button className="btn btn-outline btn-sm" disabled={elaborando === doc.id} onClick={() => elaboraDocumento(doc)}>
                              {elaborando === doc.id ? progresso || 'Elaboro...' : '🔄 Rielabora'}
                            </button>
                          )}
                        </>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => eliminaDocumento(doc)}>
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && documenti.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
                    Nessun documento caricato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {dettaglio && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            Dati estratti — {docDettaglio?.nome_file}
            <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setDettaglio(null)}>
              ✕
            </button>
          </div>
          <div className="card-body">
            {dettaglio.note && !dettaglio.ricavi && !dettaglio.costi && !dettaglio.gruppi && <p style={{ color: '#6b7280', fontSize: 13 }}>{dettaglio.note}</p>}

            {dettaglio.gruppi && (
              <>
                <div className="grid-3" style={{ marginBottom: 16, fontSize: 12 }}>
                  <div className="kpi-tile kpi-blue">
                    <div className="kpi-label">Movimenti / testate</div>
                    <div className="kpi-value" style={{ fontSize: 18 }}>
                      {fmt(dettaglio.diagnostica?.movimenti)} / {fmt(dettaglio.diagnostica?.testate)}
                    </div>
                  </div>
                  <div className="kpi-tile kpi-green">
                    <div className="kpi-label">Quadratura pagine</div>
                    <div className="kpi-value" style={{ fontSize: 18 }}>
                      {dettaglio.diagnostica?.checkpointOk}/{(dettaglio.diagnostica?.checkpointOk ?? 0) + (dettaglio.diagnostica?.checkpointKo ?? 0)} OK
                    </div>
                  </div>
                  <div className={`kpi-tile ${dettaglio.diagnostica?.verificaKo ? 'kpi-red' : 'kpi-green'}`}>
                    <div className="kpi-label">Verifica apertura+chiusura</div>
                    <div className="kpi-value" style={{ fontSize: 18 }}>
                      {dettaglio.diagnostica?.verificaOk}/{(dettaglio.diagnostica?.verificaOk ?? 0) + (dettaglio.diagnostica?.verificaKo ?? 0)} OK
                    </div>
                  </div>
                </div>
                {dettaglio.diagnostica?.checkpointKo > 0 || dettaglio.diagnostica?.verificaKo > 0 ? (
                  <div className="alert alert-error" style={{ marginBottom: 16 }}>
                    ⚠️ Alcuni controlli di quadratura non tornano — i saldi potrebbero non essere accurati per tutti i conti. Verifica il documento originale prima di usare questi dati.
                  </div>
                ) : (
                  <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ Tutti i controlli di quadratura sono passati.</div>
                )}
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  {dettaglio.gruppi.length} gruppi di conto — vai su <strong>Riclassificazione</strong> per assegnare attività/passività/costi/ricavi ai gruppi non ancora mappati.
                </p>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Gruppo</th>
                      <th>Conto rappresentativo</th>
                      <th style={{ textAlign: 'right' }}>N. conti</th>
                      <th style={{ textAlign: 'right' }}>Saldo aggregato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dettaglio.gruppi.map((g) => (
                      <tr key={g.gruppo}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{g.gruppo}</td>
                        <td>{g.descrizione}</td>
                        <td style={{ textAlign: 'right' }}>{g.n_conti}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>€{fmt(g.importo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {(dettaglio.ricavi || dettaglio.costi) && (
              <>
                <div className="grid-3" style={{ marginBottom: 20 }}>
                  <div className="kpi-tile kpi-green">
                    <div className="kpi-label">Ricavi totali</div>
                    <div className="kpi-value">€{fmt(dettaglio.ricavi?.totale)}</div>
                  </div>
                  <div className="kpi-tile kpi-red">
                    <div className="kpi-label">Costi totali</div>
                    <div className="kpi-value">€{fmt(dettaglio.costi?.totale)}</div>
                  </div>
                  <div className="kpi-tile kpi-blue">
                    <div className="kpi-label">EBITDA</div>
                    <div className="kpi-value">€{fmt(dettaglio.ebitda ?? dettaglio.margine_operativo)}</div>
                  </div>
                </div>

                {dettaglio.ricavi?.voci?.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a6b2e', marginBottom: 8 }}>Dettaglio Ricavi</div>
                    <table className="table" style={{ marginBottom: 20 }}>
                      <thead>
                        <tr>
                          <th>Codice</th>
                          <th>Voce</th>
                          <th style={{ textAlign: 'right' }}>Importo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dettaglio.ricavi.voci.map((v, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{v.codice || '—'}</td>
                            <td>{v.descrizione || v.nome || v.conto || JSON.stringify(v)}</td>
                            <td style={{ textAlign: 'right', color: '#1a6b2e', fontWeight: 600 }}>€{fmt(v.importo ?? v.valore ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {dettaglio.costi?.voci?.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#a32d2d', marginBottom: 8 }}>Dettaglio Costi</div>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Codice</th>
                          <th>Voce</th>
                          <th style={{ textAlign: 'right' }}>Importo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dettaglio.costi.voci.map((v, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{v.codice || '—'}</td>
                            <td>{v.descrizione || v.nome || v.conto || JSON.stringify(v)}</td>
                            <td style={{ textAlign: 'right', color: '#a32d2d', fontWeight: 600 }}>€{fmt(v.importo ?? v.valore ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showPrevisioni && (
        <ModalePrevisioni
          aziendaId={aziendaId}
          aziendaNome={aziendaCorrente?.nome}
          onChiudi={() => setShowPrevisioni(false)}
          onGenerato={() => carica(aziendaId)}
        />
      )}
    </div>
  )
}
