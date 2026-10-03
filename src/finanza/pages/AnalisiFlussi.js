import React, { useEffect, useState } from 'react'
import { useApp } from '../../App'
import { supabase } from '../lib/supabase'
import { estraiRigheLibroGiornale, estraiMovimenti } from '../lib/libroGiornale'
import { calcolaFlussiCassa } from '../lib/flussiCassa'
import { calcolaDsoDpo } from '../lib/dsoDpo'

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const TIPI_LIBRO_GIORNALE = ['prima_nota_precedente', 'prima_nota_corrente', 'libro_giornale_precedente', 'libro_giornale_corrente']
const LABEL_TIPO_DOCUMENTO = {
  prima_nota_precedente: 'Lista Prima Nota — Anno precedente',
  prima_nota_corrente: 'Lista Prima Nota — Anno corrente',
  libro_giornale_precedente: 'Libro Giornale — Anno precedente',
  libro_giornale_corrente: 'Libro Giornale — Anno corrente',
}

const round2 = (n) => Math.round(n * 100) / 100
const fmt = (n) => Math.round(n || 0).toLocaleString('it-IT')

// Alcune categorie di uscita nascono da conti di natura diversa (IVA/ritenute,
// contributi previdenziali, imposte sul reddito, credito d'imposta usato in
// compensazione) ma per la lettura del flusso di cassa ha senso vederle
// accorpate in un unico blocco "fiscale/previdenziale".
const GRUPPI_VISUALIZZAZIONE = [
  {
    etichetta: 'Erario e contributi (IVA/ritenute, INPS/INAIL, IRES/IRAP, netto compensazioni)',
    voci: ['Erario', 'INPS/INAIL', 'IRES/IRAP', 'Credito IRES in compensazione'],
  },
]

function applicaGruppiVisualizzazione(perCategoria) {
  const risultato = {}
  const assorbite = new Set()
  for (const g of GRUPPI_VISUALIZZAZIONE) {
    const presenti = g.voci.filter((v) => perCategoria[v])
    if (!presenti.length) continue
    const somma = {}
    for (const v of presenti) {
      assorbite.add(v)
      for (const [mese, val] of Object.entries(perCategoria[v])) somma[mese] = round2((somma[mese] || 0) + val)
    }
    risultato[g.etichetta] = somma
  }
  for (const [cat, v] of Object.entries(perCategoria)) {
    if (!assorbite.has(cat)) risultato[cat] = v
  }
  return risultato
}

function totaleVoce(v) {
  return Object.values(v).reduce((s, x) => s + x, 0)
}

const COLONNE_DSO_DPO = [
  { chiave: 'descrizione', etichetta: 'Cliente/Fornitore', allineaDestra: false },
  { chiave: 'nOperazioni', etichetta: 'N. operazioni', allineaDestra: true },
  { chiave: 'importoTotale', etichetta: 'Importo', allineaDestra: true },
  { chiave: 'giorniMedi', etichetta: 'Giorni medi', allineaDestra: true },
]

function TabellaDsoDpo({ titolo, dati }) {
  const [ordinaPer, setOrdinaPer] = useState('importoTotale')
  const [direzione, setDirezione] = useState('desc')

  if (!dati || !dati.dettaglio.length) return null

  const cambiaOrdine = (chiave) => {
    if (chiave === ordinaPer) setDirezione(direzione === 'asc' ? 'desc' : 'asc')
    else {
      setOrdinaPer(chiave)
      setDirezione('asc')
    }
  }

  const righeOrdinate = [...dati.dettaglio].sort((a, b) => {
    const va = a[ordinaPer]
    const vb = b[ordinaPer]
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
    return direzione === 'asc' ? cmp : -cmp
  })

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <h4 style={{ margin: 0, color: '#1a3a5c' }}>{titolo}</h4>
        <span style={{ fontSize: 13, color: '#555' }}>
          media ponderata: <strong>{dati.mediaPonderata} giorni</strong> su €{fmt(dati.importoTotale)} ({dati.nOperazioni} operazioni)
        </span>
      </div>
      <table className="table" style={{ minWidth: 600 }}>
        <thead>
          <tr>
            {COLONNE_DSO_DPO.map((c) => (
              <th
                key={c.chiave}
                onClick={() => cambiaOrdine(c.chiave)}
                style={{ textAlign: c.allineaDestra ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }}
              >
                {c.etichetta}
                {ordinaPer === c.chiave ? (direzione === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {righeOrdinate.map((r) => (
            <tr key={r.conto}>
              <td>{r.descrizione}</td>
              <td style={{ textAlign: 'right' }}>{r.nOperazioni}</td>
              <td style={{ textAlign: 'right' }}>{fmt(r.importoTotale)}</td>
              <td style={{ textAlign: 'right' }}>{r.giorniMedi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabellaCategorie({ titolo, perCategoria }) {
  const righe = Object.entries(perCategoria).sort((a, b) => Math.abs(totaleVoce(b[1])) - Math.abs(totaleVoce(a[1])))
  const totaliMensili = {}
  for (let m = 1; m <= 12; m++) totaliMensili[m] = round2(righe.reduce((s, [, v]) => s + (v[m] || 0), 0))
  return (
    <>
      <tr>
        <td colSpan={14} style={{ fontWeight: 700, background: '#f4f6f8', paddingTop: 10 }}>
          {titolo}
        </td>
      </tr>
      {righe.map(([cat, v]) => (
        <tr key={cat}>
          <td>{cat}</td>
          {MESI.map((_, i) => (
            <td key={i} style={{ textAlign: 'right' }}>
              {v[i + 1] ? fmt(v[i + 1]) : '—'}
            </td>
          ))}
          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totaleVoce(v))}</td>
        </tr>
      ))}
      <tr style={{ fontWeight: 700, borderTop: '2px solid #ccc' }}>
        <td>Totale {titolo.toLowerCase()}</td>
        {MESI.map((_, i) => (
          <td key={i} style={{ textAlign: 'right' }}>
            {fmt(totaliMensili[i + 1])}
          </td>
        ))}
        <td style={{ textAlign: 'right' }}>{fmt(Object.values(totaliMensili).reduce((s, x) => s + x, 0))}</td>
      </tr>
    </>
  )
}

// Da dove viene il saldo iniziale di banche e cassa, con i controlli del caso
function SaldoIniziale({ risultato, saldoManuale, setSaldoManuale, onRicalcola, calcolando }) {
  const si = risultato.diagnostica?.saldoIniziale
  if (!si) return null
  const box = (bg, col, children) => (
    <div className="no-print" style={{ background: bg, color: col, borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13, lineHeight: 1.55 }}>{children}</div>
  )
  const descr = {
    anno_precedente: <>Saldo iniziale di banche e cassa <strong>{fmt(risultato.saldoIniziale)} €</strong> ricavato dal giornale dell'anno precedente: {si.riferimento}.</>,
    manuale: <>Saldo iniziale di banche e cassa <strong>{fmt(risultato.saldoIniziale)} €</strong> inserito a mano.</>,
    apertura_giornale: <>Saldo iniziale di banche e cassa <strong>{fmt(risultato.saldoIniziale)} €</strong> dall'apertura dei conti registrata nel giornale.</>,
  }
  return (
    <>
      {si.fonte !== 'mancante' && box('#F3F6FA', '#3b4a5a', descr[si.fonte])}
      {si.registrazioniApertura > 0 && box('#F3F6FA', '#3b4a5a',
        <>{si.registrazioniApertura} registrazion{si.registrazioniApertura === 1 ? 'e' : 'i'} di apertura dei conti fatt{si.registrazioniApertura === 1 ? 'a' : 'e'} in corso d'anno: esclus{si.registrazioniApertura === 1 ? 'a' : 'e'} dai flussi (non sono incassi o pagamenti).</>)}
      {si.differenzaApertura != null && Math.abs(si.differenzaApertura) > 1 && box('#FEF5E7', '#8a5a00',
        <>⚠️ L'apertura registrata nel giornale ({fmt(si.aperturaGiornale)} €) non coincide con il saldo di partenza usato ({fmt(risultato.saldoIniziale)} €): differenza {fmt(si.differenzaApertura)} €. Verifica la chiusura dell'anno precedente.</>)}
      {(si.fonte === 'mancante' || si.fonte === 'manuale') && box(si.fonte === 'mancante' ? '#FDEDEC' : '#F3F6FA', si.fonte === 'mancante' ? '#922B21' : '#3b4a5a',
        <>
          {si.fonte === 'mancante' && <div>⚠️ <strong>Saldo iniziale di banche e cassa non disponibile</strong>: il giornale non contiene l'apertura dei conti e non è caricato il giornale dell'anno precedente. I saldi qui sopra partono da zero.</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <span>Saldo banche e cassa al 1° gennaio (da estratti conto o bilancio):</span>
            <input className="form-control" style={{ maxWidth: 160 }} type="number" step="0.01" value={saldoManuale} onChange={(e) => setSaldoManuale(e.target.value)} />
            <button className="btn btn-sm btn-primary" disabled={calcolando || saldoManuale === ''} onClick={onRicalcola}>Ricalcola</button>
          </div>
        </>)}
    </>
  )
}

export default function AnalisiFlussi() {
  const [aziende, setAziende] = useState([])
  // Pmi 360°: l'azienda è quella attiva dell'app (niente selettore nella pagina)
  const { azienda: aziendaAttiva } = useApp()
  const aziendaId = aziendaAttiva?.id || ''
  const [documenti, setDocumenti] = useState([])
  const [documentoId, setDocumentoId] = useState('')
  const [calcolando, setCalcolando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [errore, setErrore] = useState('')
  const [risultato, setRisultato] = useState(null)
  const [salvatoIl, setSalvatoIl] = useState(null)
  const [caricandoSalvato, setCaricandoSalvato] = useState(false)
  const [movimentiCache, setMovimentiCache] = useState(null)
  const [escludiSottoSoglia, setEscludiSottoSoglia] = useState(false)
  const [sogliaGiorni, setSogliaGiorni] = useState(2)
  const [stampaDsoDpo, setStampaDsoDpo] = useState(true)
  // saldo iniziale banche/cassa inserito a mano (solo se manca sia il giornale
  // dell'anno precedente sia l'apertura nel giornale corrente)
  const [saldoManuale, setSaldoManuale] = useState('')

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
        .from('documenti')
        .select('*')
        .eq('azienda_id', aziendaId)
        .in('tipo_documento', TIPI_LIBRO_GIORNALE)
        .eq('stato', 'elaborato')
        .order('anno', { ascending: false })
        .then(({ data }) => setDocumenti(data || []))
      setDocumentoId('')
      setRisultato(null)
      setSalvatoIl(null)
      setMovimentiCache(null)
    }
  }, [aziendaId])

  // Se questo documento e' gia' stato elaborato in passato, carica il
  // risultato salvato invece di ririleggere e riclassificare da capo un PDF
  // che puo' avere centinaia di pagine.
  useEffect(() => {
    setRisultato(null)
    setSalvatoIl(null)
    setMovimentiCache(null)
    if (!documentoId) return
    setCaricandoSalvato(true)
    supabase
      .from('analisi_flussi')
      .select('dati, creata_il')
      .eq('documento_id', documentoId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRisultato(data.dati)
          setSalvatoIl(data.creata_il)
          setSaldoManuale(data.dati.diagnostica?.saldoIniziale?.fonte === 'manuale' ? String(data.dati.saldoIniziale) : '')
          if (data.dati.dsoDpo?.opzioni) {
            setEscludiSottoSoglia(data.dati.dsoDpo.opzioni.escludiSottoSoglia)
            setSogliaGiorni(data.dati.dsoDpo.opzioni.sogliaGiorni)
          }
        }
        setCaricandoSalvato(false)
      })
  }, [documentoId])

  // Saldo banche/cassa a fine anno di un giornale: dall'analisi gia' salvata se
  // recente (ha la data dell'ultimo movimento), altrimenti rileggendo il giornale.
  const saldoChiusuraAnno = async (doc, mappature) => {
    const { data: salvata } = await supabase.from('analisi_flussi').select('dati').eq('documento_id', doc.id).maybeSingle()
    if (salvata?.dati?.diagnostica?.ultimaData) {
      return { importo: salvata.dati.saldoFinePeriodo[12], ultimaData: salvata.dati.diagnostica.ultimaData }
    }
    const { data: blob, error } = await supabase.storage.from('documenti').download(doc.percorso)
    if (error) return null
    const righe = await estraiRigheLibroGiornale(new File([blob], doc.nome_file), (pagina, totale) =>
      setProgresso(`Leggo il giornale ${doc.anno}: pagina ${pagina} di ${totale}...`))
    const r = calcolaFlussiCassa(estraiMovimenti(righe), mappature)
    return { importo: r.saldoFinePeriodo[12], ultimaData: r.diagnostica.ultimaData }
  }

  const calcola = async () => {
    if (!documentoId) return
    setCalcolando(true)
    setErrore('')
    setRisultato(null)
    setSalvatoIl(null)
    try {
      const doc = documenti.find((d) => d.id === documentoId)
      const { data: blob, error: dlErr } = await supabase.storage.from('documenti').download(doc.percorso)
      if (dlErr) throw new Error(dlErr.message)
      const file = new File([blob], doc.nome_file)

      const righe = await estraiRigheLibroGiornale(file, (pagina, totale) => setProgresso(`Elaboro pagina ${pagina} di ${totale}...`))
      setProgresso('Classifico i movimenti...')
      const movimenti = estraiMovimenti(righe)
      setMovimentiCache(movimenti)

      const [{ data: mappatureContiAzienda }, { data: mappatureContiGlobali }, { data: mappatureFlussi }] = await Promise.all([
        supabase.from('mappature_conti').select('*').eq('azienda_id', aziendaId).eq('globale', false),
        supabase.from('mappature_conti').select('*').eq('globale', true),
        supabase.from('mappature_flussi_conti').select('*').eq('azienda_id', aziendaId),
      ])

      const mappature = { mappatureContiAzienda, mappatureContiGlobali, mappatureFlussi: mappatureFlussi || [] }

      // Saldo iniziale banche/cassa: prima il saldo al 31/12 del giornale
      // dell'anno precedente (dato affidabile, e copre il caso in cui l'apertura
      // dei conti viene registrata in corso d'anno), poi l'eventuale saldo inserito
      // a mano; altrimenti l'apertura presente nel giornale corrente.
      let saldoInizialeEsterno = null
      const precedente = documenti.find((d) => Number(d.anno) === Number(doc.anno) - 1)
      if (precedente) {
        setProgresso(`Ricavo il saldo di cassa al 31/12/${precedente.anno} dal giornale ${precedente.anno}...`)
        const chiusura = await saldoChiusuraAnno(precedente, mappature)
        if (chiusura && chiusura.ultimaData >= `${precedente.anno}-12-01`) {
          saldoInizialeEsterno = { importo: chiusura.importo, fonte: 'anno_precedente', riferimento: `${precedente.nome_file} (saldo banche/cassa al 31/12/${precedente.anno})` }
        }
      }
      if (!saldoInizialeEsterno && saldoManuale !== '' && !isNaN(Number(String(saldoManuale).replace(',', '.')))) {
        saldoInizialeEsterno = { importo: Number(String(saldoManuale).replace(',', '.')), fonte: 'manuale' }
      }
      setProgresso('Classifico i movimenti...')
      const res = calcolaFlussiCassa(movimenti, { ...mappature, saldoInizialeEsterno })
      const dsoDpo = calcolaDsoDpo(movimenti, { escludiSottoSoglia, sogliaGiorni })
      const pacchetto = { ...res, dsoDpo }
      setRisultato(pacchetto)
      await salva(pacchetto, doc)
    } catch (e) {
      setErrore(e.message || "Errore nell'elaborazione")
    } finally {
      setCalcolando(false)
      setProgresso('')
    }
  }

  const salva = async (pacchetto, doc) => {
    setProgresso('Salvo elaborazione...')
    const oraSalvataggio = new Date().toISOString()
    const { data: salvato, error: salvaErr } = await supabase
      .from('analisi_flussi')
      .upsert({ azienda_id: aziendaId, documento_id: documentoId, anno: doc.anno, dati: pacchetto, creata_il: oraSalvataggio }, { onConflict: 'documento_id' })
      .select('creata_il')
      .single()
    if (!salvaErr) setSalvatoIl(salvato.creata_il)
  }

  // Ricalcola solo i tempi medi (con la soglia correntemente impostata) senza
  // riscaricare e riclassificare da capo tutto il Libro Giornale, se i
  // movimenti sono gia' in cache in questa sessione; altrimenti (es. dopo aver
  // ricaricato la pagina e recuperato solo il risultato salvato) serve una
  // rielaborazione completa.
  const ricalcolaDsoDpo = async () => {
    if (!risultato) return
    if (!movimentiCache) {
      await calcola()
      return
    }
    setCalcolando(true)
    try {
      const doc = documenti.find((d) => d.id === documentoId)
      const dsoDpo = calcolaDsoDpo(movimentiCache, { escludiSottoSoglia, sogliaGiorni })
      const pacchetto = { ...risultato, dsoDpo }
      setRisultato(pacchetto)
      await salva(pacchetto, doc)
    } finally {
      setCalcolando(false)
      setProgresso('')
    }
  }

  const stampa = () => {
    const haDsoDpo = risultato?.dsoDpo && (risultato.dsoDpo.dso.dettaglio.length > 0 || risultato.dsoDpo.dpo.dettaglio.length > 0)
    const includi = haDsoDpo
      ? window.confirm('Includere anche i tempi medi di incasso/pagamento, con il dettaglio per cliente/fornitore, nella stampa?')
      : false
    setStampaDsoDpo(includi)
    setTimeout(() => window.print(), 100)
  }

  const azienda = aziende.find((a) => a.id === aziendaId)
  const documento = documenti.find((d) => d.id === documentoId)

  return (
    <div>
      <h2 className="no-print" style={{ color: '#1a3a5c', marginTop: 0 }}>
        Analisi dei flussi
      </h2>
      <p className="no-print" style={{ color: '#666', marginTop: -8, marginBottom: 20 }}>
        Entrate e uscite bancarie/cassa del Libro Giornale, classificate per categoria e mese. Funziona solo su esercizi chiusi (Libro Giornale/Lista Prima
        Nota gia' caricati ed elaborati in Documenti).
      </p>

      <div className="card no-print" style={{ marginBottom: 20 }}>
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
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Documento (Libro Giornale / Lista Prima Nota)</label>
              <select className="form-control" value={documentoId} onChange={(e) => setDocumentoId(e.target.value)}>
                <option value="">Seleziona documento...</option>
                {documenti.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome_file} ({d.anno})
                  </option>
                ))}
              </select>
              {documenti.length === 0 && <p style={{ color: '#999', fontSize: 13, marginTop: 6 }}>Nessun Libro Giornale/Prima Nota elaborato per questa azienda.</p>}
            </div>
          )}

          {documentoId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={calcola} disabled={calcolando || caricandoSalvato}>
                {calcolando ? progresso || 'Elaboro...' : risultato ? 'Ricalcola' : 'Calcola flussi di cassa'}
              </button>
              {caricandoSalvato && <span style={{ color: '#999', fontSize: 13 }}>Verifico se esiste gia' un'elaborazione salvata...</span>}
              {!caricandoSalvato && salvatoIl && (
                <span style={{ color: '#2e8b57', fontSize: 13 }}>
                  ✓ Elaborazione salvata il {new Date(salvatoIl).toLocaleString('it-IT')} — servira' da riferimento anche per gli anni successivi
                </span>
              )}
              {risultato && (
                <button className="btn btn-outline" onClick={stampa}>
                  🖨️ Stampa / PDF
                </button>
              )}
            </div>
          )}

          {risultato?.dsoDpo && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={escludiSottoSoglia} onChange={(e) => setEscludiSottoSoglia(e.target.checked)} />
                Escludi dal calcolo dei tempi medi gli incassi/pagamenti sotto
              </label>
              <input
                type="number"
                min="0"
                className="form-control"
                style={{ width: 70 }}
                value={sogliaGiorni}
                disabled={!escludiSottoSoglia}
                onChange={(e) => setSogliaGiorni(Number(e.target.value))}
              />
              <span style={{ fontSize: 13, color: '#555' }}>giorni</span>
              <button className="btn btn-outline btn-sm" onClick={ricalcolaDsoDpo} disabled={calcolando}>
                {calcolando ? progresso || 'Ricalcolo...' : 'Ricalcola tempi medi'}
              </button>
            </div>
          )}

          {errore && <p style={{ color: '#c0392b', marginTop: 12 }}>{errore}</p>}
        </div>
      </div>

      {risultato && (
        <div className="card">
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c' }}>{azienda?.nome || ''}</div>
                <div style={{ fontSize: 13, color: '#555' }}>
                  Analisi dei flussi di cassa — {LABEL_TIPO_DOCUMENTO[documento?.tipo_documento] || documento?.tipo_documento} {documento?.anno}
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55 }}>Stampato il {new Date().toLocaleDateString('it-IT')}</div>
            </div>
            <table className="table" style={{ minWidth: 1200 }}>
              <thead>
                <tr>
                  <th>Voce</th>
                  {MESI.map((m) => (
                    <th key={m} style={{ textAlign: 'right' }}>
                      {m}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right' }}>Totale</th>
                </tr>
              </thead>
              <tbody>
                <TabellaCategorie titolo="Entrate" perCategoria={risultato.entrate} />
                <TabellaCategorie titolo="Uscite" perCategoria={applicaGruppiVisualizzazione(risultato.uscite)} />

                <tr>
                  <td colSpan={14} style={{ fontWeight: 700, background: '#f4f6f8', paddingTop: 10 }}>
                    Saldo
                  </td>
                </tr>
                <tr>
                  <td>Saldo del mese</td>
                  {MESI.map((_, i) => (
                    <td key={i} style={{ textAlign: 'right' }}>
                      {fmt(risultato.saldoMese[i + 1])}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(Object.values(risultato.saldoMese).reduce((s, x) => s + x, 0))}</td>
                </tr>
                <tr>
                  <td>Flusso di cassa (cumulato)</td>
                  {MESI.map((_, i) => (
                    <td key={i} style={{ textAlign: 'right' }}>
                      {fmt(risultato.flussoCassaCumulato[i + 1])}
                    </td>
                  ))}
                  <td />
                </tr>
                <tr style={{ fontWeight: 700 }}>
                  <td>Saldo a fine periodo (iniziale: {fmt(risultato.saldoIniziale)})</td>
                  {MESI.map((_, i) => (
                    <td key={i} style={{ textAlign: 'right' }}>
                      {fmt(risultato.saldoFinePeriodo[i + 1])}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>

            <SaldoIniziale risultato={risultato} saldoManuale={saldoManuale} setSaldoManuale={setSaldoManuale} onRicalcola={calcola} calcolando={calcolando} />

            {risultato.diagnostica.segmentiNonBilanciati > 0 && (
              <p className="no-print" style={{ color: '#5f6b7a', fontSize: 12.5, lineHeight: 1.55, marginTop: 10 }}>
                {risultato.diagnostica.segmentiNonBilanciati} registrazioni su {risultato.diagnostica.segmenti} (
                {((risultato.diagnostica.segmentiNonBilanciati / risultato.diagnostica.segmenti) * 100).toFixed(1)}%) non risultano perfettamente bilanciate
                Dare/Avere: possono generare una piccola quota di movimenti non classificati.
              </p>
            )}

            {risultato.dsoDpo && (
              <div className={stampaDsoDpo ? '' : 'no-print'}>
                <TabellaDsoDpo titolo="Tempi medi di incasso (DSO) per cliente" dati={risultato.dsoDpo.dso} />
                <TabellaDsoDpo titolo="Tempi medi di pagamento (DPO) per fornitore" dati={risultato.dsoDpo.dpo} />
                <p className="no-print" style={{ color: '#5f6b7a', fontSize: 12.5, lineHeight: 1.55, marginTop: 10 }}>
                  Le partite aperte a inizio anno (saldo di apertura, senza riferimento alla fattura originale nel Libro Giornale dell'anno in corso) non
                  sono incluse nel calcolo.
                  {risultato.dsoDpo.opzioni?.escludiSottoSoglia &&
                    ` Esclusi dal calcolo della media anche gli incassi/pagamenti sotto ${risultato.dsoDpo.opzioni.sogliaGiorni} giorni.`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
