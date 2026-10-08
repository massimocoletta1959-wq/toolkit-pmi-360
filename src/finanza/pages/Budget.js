import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../../App'
import { supabase } from '../lib/supabase'
import { trovaMappaturaConto, contiDelGruppo } from '../lib/mappatureConti'

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const MESI_ESTESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const MESI_KEYS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const ANNI = ['2024', '2025', '2026', '2027']

const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const round2 = (n) => Math.round(n * 100) / 100

// Voci di costo senza IVA: personale e oneri sociali, ammortamenti, svalutazioni e accantonamenti, variazioni
// delle rimanenze, oneri diversi di gestione (imposte indirette, sanzioni, tasse), imposte sul reddito, interessi
// e oneri finanziari, affitti.
const VOCI_ESENTI_IVA = [
  'personale', 'stipendi', 'salari', 'tfr', 'trattamento di fine rapporto', 'quiescenza', 'oneri sociali', 'inps', 'inail',
  'ammortament', 'amm. ', 'svalutazion', 'accantonament', 'rimanenze', 'oneri diversi', 'imposte', 'tasse',
  'interessi', 'oneri finanziari', 'affitto', 'locazione', 'affitti',
]
const isEsenteIva = (descrizione) => {
  const d = (descrizione || '').toLowerCase()
  return VOCI_ESENTI_IVA.some((p) => d.includes(p))
}
// Ricavi senza IVA: proventi finanziari e da partecipazioni, interessi attivi, plusvalenze, sopravvenienze,
// contributi in conto esercizio
const RICAVI_SENZA_IVA = ['proventi finanziari', 'proventi da partecipazioni', 'interessi', 'plusvalenz', 'sopravvenienz', 'contribut']
const ricavoSoggettoIva = (descrizione) => {
  const d = (descrizione || '').toLowerCase()
  return !RICAVI_SENZA_IVA.some((p) => d.includes(p))
}

const TIPI_LIBRO_GIORNALE = ['prima_nota_precedente', 'prima_nota_corrente', 'libro_giornale_precedente', 'libro_giornale_corrente']

// Andamento mensile di un insieme di conti dello stesso gruppo. Se coincide con
// l'intero gruppo si usa quello gia' calcolato. Altrimenti si sommano i mesi
// dei singoli conti (salvati nei documenti elaborati di recente); nei documenti
// piu' vecchi, che hanno solo l'andamento del gruppo, si ripartisce quello del
// gruppo in proporzione al saldo di ciascun conto (approssimazione).
function mensileDelBlocco(g, contiBlocco) {
  const tutti = contiDelGruppo(g)
  if (contiBlocco.length === tutti.length) return g.mensile || {}
  const risultato = {}
  for (const c of contiBlocco) {
    for (let mese = 1; mese <= 12; mese++) {
      let v = 0
      if (c.mensile) v = c.mensile[mese] || 0
      else if (g.importo) v = (g.mensile?.[mese] || 0) * ((c.valore || 0) / g.importo)
      risultato[mese] = (risultato[mese] || 0) + v
    }
  }
  return risultato
}

// Voci che sono gia' comprese in un totale aggregato presente nello stesso
// documento (es. "salari e stipendi" dentro "Personale"): escluse per non
// contare due volte lo stesso importo nel budget generato.
const SOTTOVOCI_PERSONALE = new Set(['salari e stipendi', 'oneri sociali', 'trattamento fine rapporto', 'altri costi del personale', 'altri costi', 'trattamento di fine rapporto'])
const SOTTOVOCI_AMMORTAMENTI = new Set(['ammortamento immobilizzazioni immateriali', 'ammortamento immobilizzazioni materiali', 'svalutazione crediti'])
function isSottovoce(descrizione, vociPresenti) {
  const d = (descrizione || '').toLowerCase().trim()
  if (SOTTOVOCI_PERSONALE.has(d) && [...vociPresenti].some((v) => v.toLowerCase().includes('personale'))) return true
  if (SOTTOVOCI_AMMORTAMENTI.has(d) && [...vociPresenti].some((v) => v.toLowerCase().includes('ammortament'))) return true
  return false
}

function distribuisciMensile(totale) {
  const base = Math.round((totale / 12) * 100) / 100
  const mesi = {}
  MESI_KEYS.forEach((m) => (mesi[m] = base))
  const somma = MESI_KEYS.reduce((s, m) => s + mesi[m], 0)
  mesi.dic = Math.round((mesi.dic + (totale - somma)) * 100) / 100
  return mesi
}

function CellaEditabile({ valore, onSalva, disabled, align = 'right' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  const avvia = () => {
    if (disabled) return
    setDraft(String(valore))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 10)
  }

  const salva = async () => {
    if (draft === String(valore)) {
      setEditing(false)
      return
    }
    await onSalva(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cell-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={salva}
        onKeyDown={(e) => {
          if (e.key === 'Enter') salva()
          if (e.key === 'Escape') setEditing(false)
        }}
        style={{ textAlign: align }}
      />
    )
  }

  return (
    <div className={`cell-display${disabled ? '' : ' editable'}`} style={{ textAlign: align }} onClick={avvia}>
      {typeof valore === 'number' ? `€${fmt(valore)}` : valore}
    </div>
  )
}

function ModaleNuovaVoce({ onChiudi, onAggiungi }) {
  const [categoria, setCategoria] = useState('ricavi')
  const [descrizione, setDescrizione] = useState('')
  const [totale, setTotale] = useState('')
  const [soggettoIva, setSoggettoIva] = useState(true)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!descrizione.trim() || !totale) return
    setLoading(true)
    try {
      await onAggiungi(categoria, descrizione.trim(), parseFloat(totale) || 0, soggettoIva)
      onChiudi()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Aggiungi nuova voce</h3>
        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select className="form-control" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="ricavi">Ricavi</option>
            <option value="costi">Costi</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Descrizione</label>
          <input className="form-control" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Es. Ricavi da consulenza" />
        </div>
        <div className="form-group">
          <label className="form-label">Totale annuo (€)</label>
          <input type="number" className="form-control" value={totale} onChange={(e) => setTotale(e.target.value)} placeholder="0" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={soggettoIva} onChange={(e) => setSoggettoIva(e.target.checked)} />
          Soggetto a IVA
        </label>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onChiudi}>
            Annulla
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={loading || !descrizione.trim() || !totale}>
            {loading ? 'Salvataggio...' : 'Aggiungi voce'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Budget() {
  const [aziende, setAziende] = useState([])
  // Pmi 360°: l'azienda è quella attiva dell'app (niente selettore nella pagina)
  const { azienda: aziendaAttiva } = useApp()
  const aziendaId = aziendaAttiva?.id || ''
  const [anno, setAnno] = useState('2026')
  const [budgets, setBudgets] = useState([])
  const [budgetSel, setBudgetSel] = useState(null)
  const [voci, setVoci] = useState([])
  const [mostraIva, setMostraIva] = useState(false)
  const [mostraModale, setMostraModale] = useState(false)
  const [creando, setCreando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [modalitaGenerazione, setModalitaGenerazione] = useState('uniforme')
  const [documentiOrigine, setDocumentiOrigine] = useState([])
  const [documentoOrigineId, setDocumentoOrigineId] = useState('')
  const [errore, setErrore] = useState(null)
  const [avviso, setAvviso] = useState(null)   // informazioni sulla generazione (es. annualizzazione di un provvisorio)

  useEffect(() => {
    supabase
      .from('aziende')
      .select('id, nome')
      .order('nome')
      .then(({ data }) => setAziende(data || []))
  }, [])

  const caricaBudgets = async (azId) => {
    const { data, error } = await supabase.from('budget').select('*').eq('azienda_id', azId).order('anno', { ascending: false })
    if (error) setErrore(error.message)
    else setBudgets(data)
  }

  useEffect(() => {
    if (aziendaId) {
      caricaBudgets(aziendaId)
      setBudgetSel(null)
      setVoci([])
    }
  }, [aziendaId])

  // Elenco documenti da cui si puo' generare il budget, in base alla modalita'
  // scelta: bilancio/provvisorio/previsioni per la distribuzione uniforme,
  // Libro Giornale/Prima Nota per quella stagionale (serve il dettaglio mensile).
  useEffect(() => {
    setDocumentoOrigineId('')
    if (!aziendaId) {
      setDocumentiOrigine([])
      return
    }
    const tipi = modalitaGenerazione === 'stagionale' ? TIPI_LIBRO_GIORNALE : ['previsioni', 'bilancio', 'provvisorio']
    supabase
      .from('documenti')
      .select('*')
      .eq('azienda_id', aziendaId)
      .eq('stato', 'elaborato')
      .in('tipo_documento', tipi)
      .order('anno', { ascending: false })
      .then(({ data }) => setDocumentiOrigine(data || []))
  }, [aziendaId, modalitaGenerazione])

  const selezionaBudget = async (b) => {
    setBudgetSel(b)
    const { data, error } = await supabase.from('budget_voci').select('*').eq('budget_id', b.id)
    if (error) setErrore(error.message)
    else setVoci(data)
  }

  const nuovoBudget = async () => {
    if (!aziendaId) return
    const esistente = budgets.find((b) => b.anno === anno)
    if (esistente) {
      setErrore(`Esiste già un budget ${anno} per questa azienda.`)
      return
    }
    setCreando(true)
    setErrore(null)
    const { error } = await supabase.from('budget').insert({
      id: crypto.randomUUID(),
      azienda_id: aziendaId,
      anno,
      stato: 'bozza',
      creato_il: new Date().toISOString(),
    })
    setCreando(false)
    if (error) setErrore(error.message)
    else caricaBudgets(aziendaId)
  }

  // Sostituisce (se esiste) il budget dell'anno scelto con uno nuovo composto
  // dalle righe passate. Usato da entrambe le modalita' di generazione.
  const salvaBudgetGenerato = async (righeSenzaBudgetId) => {
    const esistente = budgets.find((b) => b.anno === anno)
    if (esistente) {
      await supabase.from('budget_voci').delete().eq('budget_id', esistente.id)
      await supabase.from('scostamenti').delete().eq('budget_id', esistente.id)
      await supabase.from('budget').delete().eq('id', esistente.id)
    }

    const nuovoBudgetId = crypto.randomUUID()
    const { error: insErr } = await supabase.from('budget').insert({
      id: nuovoBudgetId,
      azienda_id: aziendaId,
      anno,
      stato: 'bozza',
      creato_il: new Date().toISOString(),
    })
    if (insErr) throw new Error(insErr.message)

    const righe = righeSenzaBudgetId.map((r) => ({ id: crypto.randomUUID(), budget_id: nuovoBudgetId, ...r }))
    const { error: voceErr } = await supabase.from('budget_voci').insert(righe)
    if (voceErr) throw new Error(voceErr.message)

    await caricaBudgets(aziendaId)
    const { data: nuovoBudgetRow } = await supabase.from('budget').select('*').eq('id', nuovoBudgetId).single()
    if (nuovoBudgetRow) selezionaBudget(nuovoBudgetRow)
  }

  // Genera un budget aggregando le voci ricavi/costi del documento
  // bilancio/provvisorio/previsioni scelto, distribuite in parti uguali sui
  // 12 mesi. Se esiste gia' un budget per l'anno scelto, chiede conferma e lo
  // sostituisce (stessa logica del vecchio backend, ma su un solo documento
  // invece di aggregarli tutti automaticamente).
  const generaBudgetUniforme = async (doc) => {
    if (!doc.dati_estratti) throw new Error('Il documento scelto non ha dati elaborati.')
    let dati
    try {
      dati = JSON.parse(doc.dati_estratti)
    } catch {
      throw new Error('Impossibile leggere i dati del documento scelto.')
    }

    const vociRicavi = {}
    const vociCosti = {}
    for (const v of dati.ricavi?.voci || []) {
      const desc = v.descrizione || 'Ricavi'
      vociRicavi[desc] = (vociRicavi[desc] || 0) + (parseFloat(v.importo) || 0)
    }
    const nomiVociCosti = new Set((dati.costi?.voci || []).map((v) => v.descrizione || ''))
    for (const v of dati.costi?.voci || []) {
      const desc = v.descrizione || 'Costi'
      if (isSottovoce(desc, nomiVociCosti)) continue
      vociCosti[desc] = (vociCosti[desc] || 0) + (parseFloat(v.importo) || 0)
    }

    if (Object.keys(vociRicavi).length === 0 && Object.keys(vociCosti).length === 0) {
      throw new Error('Nessuna voce di ricavo/costo trovata nel documento scelto.')
    }

    // Un provvisorio copre solo i primi N mesi (mese_fine): il totale annuo si stima x 12 / N, altrimenti il
    // budget riceverebbe il risultato di N mesi spalmato su 12 (sottostimato)
    const mesiCoperti = doc.tipo_documento === 'provvisorio' && doc.mese_fine >= 1 && doc.mese_fine < 12 ? Number(doc.mese_fine) : 12
    const annualizza = (v) => (mesiCoperti === 12 ? v : (v * 12) / mesiCoperti)
    if (mesiCoperti < 12) setAvviso(`Il documento è un provvisorio di ${mesiCoperti} mesi (gennaio-${MESI_ESTESI[mesiCoperti - 1]}): gli importi sono stati annualizzati (× 12 / ${mesiCoperti}) e distribuiti in parti uguali sui 12 mesi. Rivedi le voci con andamento non lineare (stagionalità, ricavi o costi una tantum).`)

    const righe = []
    for (const [desc, totale] of Object.entries(vociRicavi)) {
      const tot = round2(annualizza(totale))
      righe.push({ categoria: 'ricavi', descrizione: desc, soggetto_iva: ricavoSoggettoIva(desc), totale_annuo: tot, ...distribuisciMensile(tot) })
    }
    for (const [desc, totale] of Object.entries(vociCosti)) {
      const tot = round2(annualizza(totale))
      righe.push({ categoria: 'costi', descrizione: desc, soggetto_iva: !isEsenteIva(desc), totale_annuo: tot, ...distribuisciMensile(tot) })
    }
    await salvaBudgetGenerato(righe)
  }

  // Genera un budget replicando, mese per mese, la stagionalita' con cui i
  // ricavi/costi si sono effettivamente formati nel documento scelto (Libro
  // Giornale/Prima Nota, gia' riclassificato) — invece di dividere il totale
  // annuo in parti uguali.
  const generaBudgetStagionale = async (doc) => {
    if (!doc.dati_estratti) throw new Error('Il documento scelto non ha dati elaborati.')
    let dati
    try {
      dati = JSON.parse(doc.dati_estratti)
    } catch {
      throw new Error('Impossibile leggere i dati del documento scelto.')
    }
    if (!dati.gruppi) throw new Error('Il documento scelto non contiene gruppi di conto (non è un Libro Giornale/Prima Nota elaborato).')

    const { data: mappatureAzienda } = await supabase.from('mappature_conti').select('*').eq('azienda_id', aziendaId).eq('globale', false)
    const { data: mappatureGlobali } = await supabase.from('mappature_conti').select('*').eq('globale', true)
    const { data: vociCeeList } = await supabase.from('voci_cee').select('*')
    const vociCeeByCodice = {}
    for (const v of vociCeeList || []) vociCeeByCodice[v.codice] = v

    // per voce CEE: { descrizione, categoria, mensile: {1..12} }
    const perVoce = {}
    let gruppiNonClassificati = 0

    for (const g of dati.gruppi || []) {
      // Ogni conto e' riclassificato singolarmente (l'eccezione sul conto batte
      // la mappatura del gruppo): i conti con la stessa destinazione vengono
      // riuniti, poi si somma la stagionalita' mensile di ciascun blocco.
      const conti = contiDelGruppo(g)
      const blocchi = new Map()
      let haNonClassificati = false
      for (const c of conti) {
        const mappatura = trovaMappaturaConto(c.conto, mappatureAzienda || [], mappatureGlobali || [], g.gruppo)
        if (!mappatura) {
          haNonClassificati = true
          continue
        }
        if (mappatura.categoria !== 'ricavi' && mappatura.categoria !== 'costi') continue
        const chiave = `${mappatura.categoria}|${mappatura.codice_cee || ''}`
        if (!blocchi.has(chiave)) blocchi.set(chiave, { mappatura, conti: [] })
        blocchi.get(chiave).conti.push(c)
      }

      if (haNonClassificati) gruppiNonClassificati++

      for (const { mappatura, conti: contiBlocco } of blocchi.values()) {
        const bucketRicavo = mappatura.categoria === 'ricavi'
        const codiceCeeAgg = mappatura.codice_cee || (bucketRicavo ? 'A1' : 'B14')
        const voceCeeDest = vociCeeByCodice[codiceCeeAgg]
        const tipoDest = voceCeeDest?.tipo || (bucketRicavo ? 'ricavo' : 'costo')
        const segnoDest = voceCeeDest?.segno ?? (bucketRicavo ? 1 : -1)
        let segnoFlip = 1
        if (bucketRicavo && tipoDest === 'costo') segnoFlip = -1
        else if (!bucketRicavo && tipoDest === 'ricavo') segnoFlip = -1
        else if (!bucketRicavo && tipoDest === 'finanziario' && segnoDest < 0) segnoFlip = -1

        if (!perVoce[codiceCeeAgg]) {
          perVoce[codiceCeeAgg] = { descrizione: voceCeeDest?.descrizione || (bucketRicavo ? 'Ricavi' : 'Costi'), categoria: mappatura.categoria, mensile: {} }
        }
        const mensileBlocco = mensileDelBlocco(g, contiBlocco)
        for (let mese = 1; mese <= 12; mese++) {
          const valoreMese = Math.abs(mensileBlocco[mese] || 0) * segnoFlip
          perVoce[codiceCeeAgg].mensile[mese] = round2((perVoce[codiceCeeAgg].mensile[mese] || 0) + valoreMese)
        }
      }
    }

    const codici = Object.keys(perVoce)
    if (codici.length === 0) {
      throw new Error('Nessun gruppo del documento scelto risulta classificato su ricavi/costi: completa la riclassificazione prima di generare il budget stagionale.')
    }

    // Libro giornale infrannuale (es. al 30/06): i mesi successivi non hanno dati; si completano con la media
    // dei mesi registrati, invece di lasciarli a zero
    const meseFine = doc.mese_fine >= 1 && doc.mese_fine < 12 ? Number(doc.mese_fine) : 12
    if (meseFine < 12) setAvviso(`Il libro giornale arriva a ${MESI_ESTESI[meseFine - 1]}: i mesi da gennaio a ${MESI_ESTESI[meseFine - 1]} seguono l'andamento registrato, quelli successivi la media mensile dei mesi registrati. Rivedi le voci stagionali.`)

    const righe = []
    for (const codice of codici) {
      const { descrizione, categoria, mensile } = perVoce[codice]
      const media = meseFine < 12 ? round2(Array.from({ length: meseFine }, (_, i) => mensile[i + 1] || 0).reduce((t, x) => t + x, 0) / meseFine) : 0
      const mesiValori = {}
      let totale = 0
      for (let mese = 1; mese <= 12; mese++) {
        const v = mese > meseFine ? media : mensile[mese] || 0
        mesiValori[MESI_KEYS[mese - 1]] = v
        totale += v
      }
      righe.push({ categoria, descrizione, soggetto_iva: categoria === 'ricavi' ? ricavoSoggettoIva(descrizione) : !isEsenteIva(descrizione), totale_annuo: round2(totale), ...mesiValori })
    }
    await salvaBudgetGenerato(righe)

    if (gruppiNonClassificati > 0) {
      setErrore(`Budget generato, ma ${gruppiNonClassificati} gruppi non erano classificati e sono stati esclusi — completa la riclassificazione e rigenera per un risultato più accurato.`)
    }
  }

  const generaBudget = async () => {
    if (!aziendaId || !documentoOrigineId) return
    const doc = documentiOrigine.find((d) => d.id === documentoOrigineId)
    if (!doc) return
    const esistente = budgets.find((b) => b.anno === anno)
    const messaggioConferma =
      modalitaGenerazione === 'stagionale'
        ? `Esiste già un budget ${anno} per questa azienda: verrà sostituito con quello generato replicando la stagionalità mensile di "${doc.nome_file}". Continuare?`
        : `Esiste già un budget ${anno} per questa azienda: verrà sostituito con quello generato da "${doc.nome_file}". Continuare?`
    if (esistente && !window.confirm(messaggioConferma)) return

    setGenerando(true)
    setErrore(null)
    setAvviso(null)
    try {
      if (modalitaGenerazione === 'stagionale') await generaBudgetStagionale(doc)
      else await generaBudgetUniforme(doc)
    } catch (e) {
      setErrore(e.message || 'Errore nella generazione del budget')
    } finally {
      setGenerando(false)
    }
  }

  const eliminaBudget = async (b) => {
    if (!window.confirm(`Eliminare il budget ${b.anno}?`)) return
    // niente ON DELETE CASCADE su budget_voci/scostamenti -> pulizia manuale prima del delete
    await supabase.from('budget_voci').delete().eq('budget_id', b.id)
    await supabase.from('scostamenti').delete().eq('budget_id', b.id)
    await supabase.from('cashflow').delete().eq('azienda_id', b.azienda_id).eq('anno', b.anno)
    const { error } = await supabase.from('budget').delete().eq('id', b.id)
    if (error) setErrore(error.message)
    else {
      caricaBudgets(aziendaId)
      if (budgetSel?.id === b.id) {
        setBudgetSel(null)
        setVoci([])
      }
    }
  }

  const approvaBudget = async () => {
    if (!budgetSel) return
    const ora = new Date().toISOString()
    const { error } = await supabase.from('budget').update({ stato: 'approvato', approvato_il: ora }).eq('id', budgetSel.id)
    if (error) setErrore(error.message)
    else {
      setBudgetSel({ ...budgetSel, stato: 'approvato', approvato_il: ora })
      caricaBudgets(aziendaId)
    }
  }

  const sbloccaBudget = async () => {
    if (!budgetSel) return
    if (!window.confirm('Sbloccare il budget per modificare le voci?')) return
    const { error } = await supabase.from('budget').update({ stato: 'bozza', approvato_il: null }).eq('id', budgetSel.id)
    if (error) setErrore(error.message)
    else {
      setBudgetSel({ ...budgetSel, stato: 'bozza', approvato_il: null })
      caricaBudgets(aziendaId)
    }
  }

  const toggleIva = async (voce) => {
    const { error } = await supabase.from('budget_voci').update({ soggetto_iva: !voce.soggetto_iva }).eq('id', voce.id)
    if (error) setErrore(error.message)
    else setVoci(voci.map((v) => (v.id === voce.id ? { ...v, soggetto_iva: !v.soggetto_iva } : v)))
  }

  const aggiornaVoce = async (voce, campo, valoreRaw) => {
    let payload = {}
    if (campo === 'descrizione') {
      payload.descrizione = valoreRaw
    } else if (campo === 'totale_annuo') {
      const totale = parseFloat(valoreRaw.replace(',', '.')) || 0
      payload = { totale_annuo: totale, ...distribuisciMensile(totale) }
    } else {
      const num = parseFloat(valoreRaw.replace(',', '.')) || 0
      const mesiAggiornati = { ...voce, [campo]: num }
      const nuovoTotale = MESI_KEYS.reduce((s, m) => s + mesiAggiornati[m], 0)
      payload = { [campo]: num, totale_annuo: Math.round(nuovoTotale * 100) / 100 }
    }
    const { data, error } = await supabase.from('budget_voci').update(payload).eq('id', voce.id).select().single()
    if (error) setErrore(error.message)
    else setVoci(voci.map((v) => (v.id === voce.id ? data : v)))
  }

  const aggiungiVoce = async (categoria, descrizione, totale, soggettoIva) => {
    const mesi = distribuisciMensile(totale)
    const { data, error } = await supabase
      .from('budget_voci')
      .insert({
        id: crypto.randomUUID(),
        budget_id: budgetSel.id,
        categoria,
        descrizione,
        totale_annuo: totale,
        soggetto_iva: soggettoIva,
        ...mesi,
      })
      .select()
      .single()
    if (error) setErrore(error.message)
    else setVoci([...voci, data])
  }

  const eliminaVoce = async (voce) => {
    if (!window.confirm(`Eliminare la voce "${voce.descrizione}"?`)) return
    const { error } = await supabase.from('budget_voci').delete().eq('id', voce.id)
    if (error) setErrore(error.message)
    else setVoci(voci.filter((v) => v.id !== voce.id))
  }

  const ricavi = voci.filter((v) => v.categoria === 'ricavi')
  const costi = voci.filter((v) => v.categoria === 'costi')
  const totRicavi = ricavi.reduce((s, v) => s + v.totale_annuo, 0)
  const totCosti = costi.reduce((s, v) => s + v.totale_annuo, 0)
  const margine = totRicavi - totCosti
  const isApprovato = budgetSel?.stato === 'approvato'
  const azienda = aziende.find((a) => a.id === aziendaId)

  const rigaVoce = (v) => (
    <tr key={v.id}>
      <td>
        <CellaEditabile valore={v.descrizione} align="left" disabled={isApprovato} onSalva={(val) => aggiornaVoce(v, 'descrizione', val)} />
      </td>
      {mostraIva && (
        <td style={{ textAlign: 'center' }}>
          <input type="checkbox" checked={v.soggetto_iva} disabled={isApprovato} onChange={() => toggleIva(v)} />
        </td>
      )}
      <td>
        <CellaEditabile valore={v.totale_annuo} disabled={isApprovato} onSalva={(val) => aggiornaVoce(v, 'totale_annuo', val)} />
      </td>
      {MESI_KEYS.map((m) => (
        <td key={m}>
          <CellaEditabile valore={v[m]} disabled={isApprovato} onSalva={(val) => aggiornaVoce(v, m, val)} />
        </td>
      ))}
      {!isApprovato && (
        <td style={{ textAlign: 'center' }}>
          <button className="icon-btn" title="Elimina voce" onClick={() => eliminaVoce(v)}>
            🗑
          </button>
        </td>
      )}
    </tr>
  )

  return (
    <div>
      <h2 className="no-print" style={{ color: '#1a3a5c', marginTop: 0 }}>
        Budget
      </h2>
      <p className="no-print" style={{ color: '#666', marginTop: -8, marginBottom: 20 }}>
        Crea e gestisci il budget annuale per azienda
      </p>

      {errore && <div className="alert alert-error">{errore}</div>}
      {avviso && <div className="alert alert-info">{avviso}</div>}

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
            <button className="btn btn-primary" onClick={nuovoBudget} disabled={!aziendaId || creando}>
              {creando ? 'Creazione...' : '+ Nuovo budget'}
            </button>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f2f5', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Distribuzione mensile:</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`btn btn-sm ${modalitaGenerazione === 'uniforme' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setModalitaGenerazione('uniforme')}>
                Uniforme (1/12)
              </button>
              <button
                className={`btn btn-sm ${modalitaGenerazione === 'stagionale' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setModalitaGenerazione('stagionale')}
                title="Replica, mese per mese, come si sono formati i ricavi/costi nell'anno precedente (richiede Libro Giornale/Prima Nota riclassificati)"
              >
                Stagionale (anno precedente)
              </button>
            </div>
            <select
              className="form-control"
              style={{ maxWidth: 340 }}
              value={documentoOrigineId}
              onChange={(e) => setDocumentoOrigineId(e.target.value)}
              disabled={!aziendaId || documentiOrigine.length === 0}
            >
              <option value="">
                {documentiOrigine.length === 0 ? 'Nessun documento disponibile...' : 'Seleziona documento di partenza...'}
              </option>
              {documentiOrigine.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome_file} — {d.anno}
                  {d.mese_fine ? ` (fino a ${MESI[d.mese_fine - 1]})` : ''}
                </option>
              ))}
            </select>
            <button className="btn btn-outline" onClick={generaBudget} disabled={!aziendaId || !documentoOrigineId || generando}>
              {generando ? 'Generando...' : '🤖 Genera budget'}
            </button>
          </div>
        </div>
      </div>

      {budgets.length > 0 && (
        <div className="card no-print" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {budgets.map((b) => (
              <div key={b.id} style={{ display: 'flex', gap: 4 }}>
                <button
                  className={`btn btn-sm ${budgetSel?.id === b.id ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => selezionaBudget(b)}
                >
                  Budget {b.anno} — {b.stato}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => eliminaBudget(b)}>
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {budgetSel && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 className="no-print" style={{ margin: 0, color: '#1a3a5c' }}>
                Budget {budgetSel.anno}
              </h3>
              <div className="print-only">
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c' }}>{azienda?.nome || ''}</div>
                <div style={{ fontSize: 13, color: '#555' }}>Budget {budgetSel.anno}</div>
              </div>
              {!isApprovato && <p className="no-print" style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Clicca su una cella per modificarla</p>}
            </div>
            <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={mostraIva} onChange={(e) => setMostraIva(e.target.checked)} />
                Mostra flag IVA
              </label>
              {!isApprovato && (
                <button className="btn btn-outline btn-sm" onClick={() => setMostraModale(true)}>
                  + Aggiungi voce
                </button>
              )}
              {!isApprovato ? (
                <button className="btn btn-primary btn-sm" onClick={approvaBudget}>
                  Approva budget
                </button>
              ) : (
                <button className="btn btn-outline btn-sm" onClick={sbloccaBudget}>
                  Sblocca budget
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
                🖨️ Stampa / PDF
              </button>
            </div>
          </div>

          <div className="grid-3" style={{ marginBottom: 20 }}>
            <div className="kpi-tile kpi-green">
              <div className="kpi-label">Ricavi totali</div>
              <div className="kpi-value">€{fmt(totRicavi)}</div>
            </div>
            <div className="kpi-tile kpi-red">
              <div className="kpi-label">Costi totali</div>
              <div className="kpi-value">€{fmt(totCosti)}</div>
            </div>
            <div className={`kpi-tile ${margine >= 0 ? 'kpi-blue' : 'kpi-orange'}`}>
              <div className="kpi-label">EBITDA</div>
              <div className="kpi-value">€{fmt(margine)}</div>
            </div>
          </div>

          <div className="card table-scroll">
            <table className="table budget-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Voce</th>
                  {mostraIva && <th style={{ width: 52 }}>IVA</th>}
                  <th style={{ textAlign: 'right', minWidth: 90 }}>Totale</th>
                  {MESI.map((m) => (
                    <th key={m} style={{ textAlign: 'right', minWidth: 80 }}>
                      {m}
                    </th>
                  ))}
                  {!isApprovato && <th style={{ width: 40 }} />}
                </tr>
              </thead>
              <tbody>
                <tr className="section-row section-ricavi">
                  <td colSpan={99}>Ricavi</td>
                </tr>
                {ricavi.map(rigaVoce)}
                <tr className="total-row total-ricavi">
                  <td colSpan={mostraIva ? 2 : 1}>Totale Ricavi</td>
                  <td style={{ textAlign: 'right' }}>€{fmt(totRicavi)}</td>
                  {MESI_KEYS.map((m) => (
                    <td key={m} style={{ textAlign: 'right' }}>
                      €{fmt(ricavi.reduce((s, v) => s + v[m], 0))}
                    </td>
                  ))}
                  {!isApprovato && <td />}
                </tr>

                <tr className="section-row section-costi">
                  <td colSpan={99}>Costi</td>
                </tr>
                {costi.map(rigaVoce)}
                <tr className="total-row total-costi">
                  <td colSpan={mostraIva ? 2 : 1}>Totale Costi</td>
                  <td style={{ textAlign: 'right' }}>€{fmt(totCosti)}</td>
                  {MESI_KEYS.map((m) => (
                    <td key={m} style={{ textAlign: 'right' }}>
                      €{fmt(costi.reduce((s, v) => s + v[m], 0))}
                    </td>
                  ))}
                  {!isApprovato && <td />}
                </tr>

                <tr className={`total-row ${margine >= 0 ? 'total-ebitda' : 'total-ebitda-neg'}`}>
                  <td colSpan={mostraIva ? 2 : 1}>EBITDA</td>
                  <td style={{ textAlign: 'right' }}>€{fmt(margine)}</td>
                  {MESI_KEYS.map((m) => {
                    const mr = ricavi.reduce((s, v) => s + v[m], 0) - costi.reduce((s, v) => s + v[m], 0)
                    return (
                      <td key={m} style={{ textAlign: 'right' }}>
                        €{fmt(mr)}
                      </td>
                    )
                  })}
                  {!isApprovato && <td />}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {mostraModale && <ModaleNuovaVoce onChiudi={() => setMostraModale(false)} onAggiungi={aggiungiVoce} />}
    </div>
  )
}
