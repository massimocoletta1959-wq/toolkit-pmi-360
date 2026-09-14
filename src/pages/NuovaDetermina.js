import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { FASCICOLI } from '../lib/fascicoli'
import { nomeAtto } from '../lib/modalitaSolo'

// ── Costanti ────────────────────────────────────────────────────────────
const TIPI = [
  { id: 'beni_strumentali',      label: 'Acquisto beni strumentali',        icon: '🏭', desc: 'Macchinari, attrezzature, immobilizzazioni' },
  { id: 'contratto',             label: 'Approvazione contratto',           icon: '📄', desc: 'Fornitori, clienti, partner strategici' },
  { id: 'operazione_finanziaria',label: 'Operazione finanziaria',           icon: '💰', desc: 'Finanziamenti, leasing, garanzie' },
  { id: 'adempimenti_contabili', label: 'Adempimenti contabili e fiscali',  icon: '📊', desc: 'Bilancio, destinazione utili, variazioni di budget' },
  { id: 'personale',             label: 'Personale e organizzazione',       icon: '👥', desc: 'Mobilità interna, disciplinari, organigramma, mansioni' },
  { id: 'assunzione',            label: 'Assunzione rilevante',             icon: '👔', desc: 'Dirigenti, quadri, figure strategiche' },
  { id: 'consulenza',            label: 'Consulenza e incarichi esterni',   icon: '🧑‍💼', desc: 'Legali, commercialisti, revisori, tecnici' },
  { id: 'contenzioso',           label: 'Contenzioso e gestione legale',    icon: '⚖️', desc: 'Azioni legali, costituzione in giudizio, transazioni' },
  { id: 'rs_innovazione',        label: 'Ricerca, sviluppo e innovazione',  icon: '🔬', desc: 'Nuovi prodotti, digital transformation, brevetti, marchi' },
  { id: 'marketing',             label: 'Marketing, comunicazione, eventi', icon: '📣', desc: 'Campagne, sponsorizzazioni, fiere, agenzie' },
  { id: 'immobiliare',           label: 'Gestione immobiliare e manutenzioni', icon: '🏠', desc: 'Locazioni, dismissioni, manutenzione straordinaria' },
  { id: 'compliance',            label: 'Sicurezza e conformità',           icon: '🛡️', desc: 'Sicurezza lavoro, GDPR, 231, nomine (RSPP, DPO)' },
  { id: 'procura',               label: 'Concessione procura/delega',       icon: '✋', desc: 'Procuratori, agenti, rappresentanti' },
  { id: 'urgenza',               label: 'Emergenza / Urgenza',              icon: '⚡', desc: 'Decisioni urgenti non differibili' },
]
const TIPO_LABEL = Object.fromEntries(TIPI.map(t => [t.id, t.label]))

const RISK_CATS = [
  { id: 'finanziario',  label: 'Rischio finanziario',   hint: 'Sostenibilità, tassi, liquidità' },
  { id: 'operativo',    label: 'Rischio operativo',     hint: 'Esecuzione, fornitori, continuità' },
  { id: 'legale_231',   label: 'Rischio legale / 231',  hint: 'Aree sensibili, compliance' },
  { id: 'reputazionale',label: 'Rischio reputazionale', hint: 'Immagine, rapporti con stakeholder' },
]

const AREE_231 = ['', 'Rapporti con la PA', 'Gestione finanziaria', 'Salute e Sicurezza',
  'Reati informatici', 'Ambiente', 'Antiriciclaggio']

const LIV_LABEL = { 1: 'Basso', 2: 'Basso', 3: 'Medio', 4: 'Alto', 5: 'Critico' }
const livStyle = v => v >= 5 ? { background: '#FDEDEC', color: '#C0392B' }
  : v >= 4 ? { background: '#FEF5E7', color: '#B9770E' }
  : v >= 3 ? { background: '#FEF9E7', color: '#856404' }
  : { background: '#EAF2F8', color: '#2874A6' }

const STEPS = ['Tipo', 'Analisi', 'Rischio', 'Pareri', 'Redazione', 'Fascicolo', 'Chiusura']

// Testo di aiuto fisso sotto ogni campo (le domande giuste a cui rispondere)
const HINT = {
  fin: 'Come si copre la spesa? Impatto su cassa e liquidità, sostenibilità nel tempo, eventuali indici (es. DSCR).',
  eco: 'Effetto su costi/ricavi e conto economico: ritorno atteso (ROI), tempo di rientro (payback), margini.',
  alt: 'Quali opzioni hai considerato e perché hai scelto questa? Cita anche il "non fare nulla" se pertinente.',
}

// Esempi (placeholder) calibrati sul tipo di determina; 'default' per i tipi non elencati
const PLACEHOLDER = {
  default: {
    fin: 'Es. Copertura con cassa aziendale; impatto contenuto sulla liquidità corrente.',
    eco: 'Es. Beneficio atteso e tempi di rientro della spesa.',
    alt: 'Es. 1) Opzione A — scartata perché…; 2) Opzione B — scelta perché…',
  },
  beni_strumentali: {
    fin: 'Es. Leasing vs acquisto; impatto su cassa, DSCR post-investimento, fonte di copertura.',
    eco: 'Es. ROI atteso sulle commesse abilitate, payback in mesi, aumento capacità produttiva.',
    alt: 'Es. 1) Acquisto cash — escluso per liquidità; 2) Terzismo — escluso per costi; 3) Leasing — scelto.',
  },
  operazione_finanziaria: {
    fin: 'Es. Importo, tasso (fisso/variabile), durata, garanzie richieste, effetto su indebitamento e DSCR.',
    eco: 'Es. Costo complessivo del finanziamento, impatto su oneri finanziari, convenienza vs alternative.',
    alt: 'Es. Altri istituti/strumenti valutati (mutuo, apertura di credito, autofinanziamento) e motivo della scelta.',
  },
  contratto: {
    fin: 'Es. Valore del contratto, termini di pagamento, esposizione massima, penali.',
    eco: 'Es. Marginalità attesa, incidenza sui costi/ricavi annui, durata e rinnovi.',
    alt: 'Es. Altri fornitori/clienti valutati e criterio di selezione (prezzo, affidabilità, tempi).',
  },
  consulenza: {
    fin: 'Es. Compenso pattuito, modalità (a forfait/a ore), eventuali spese, copertura di budget.',
    eco: 'Es. Beneficio atteso dall\'incarico, alternativa "in house", rapporto costo/valore.',
    alt: 'Es. Altri professionisti/studi consultati, preventivi confrontati, motivazione della scelta.',
  },
  contenzioso: {
    fin: 'Es. Costi legali stimati, valore della causa, accantonamento a fondo rischi, spese soccombenza.',
    eco: 'Es. Probabilità di esito favorevole, importo recuperabile/rischio, convenienza vs transazione.',
    alt: 'Es. Transazione stragiudiziale, mediazione, rinuncia: valutazione comparata degli esiti.',
  },
  immobiliare: {
    fin: 'Es. Canone/prezzo, durata, oneri accessori, impatto su cassa, eventuale finanziamento.',
    eco: 'Es. Convenienza vs alternative, valorizzazione dell\'immobile, risparmio o ricavo atteso.',
    alt: 'Es. Altri immobili/soluzioni valutati, acquisto vs locazione, motivazione della scelta.',
  },
  marketing: {
    fin: 'Es. Budget della campagna/evento, ripartizione dei costi, copertura finanziaria.',
    eco: 'Es. Ritorno atteso (lead, vendite, notorietà), ROI di marketing, KPI di misurazione.',
    alt: 'Es. Altri canali/agenzie/eventi valutati e criterio di scelta.',
  },
  personale: {
    fin: 'Es. Costo annuo lordo, oneri, impatto sul costo del personale e sul budget.',
    eco: 'Es. Beneficio organizzativo atteso, produttività, copertura del fabbisogno.',
    alt: 'Es. Riorganizzazione interna, part-time, esternalizzazione: opzioni valutate.',
  },
  assunzione: {
    fin: 'Es. RAL e costo aziendale complessivo, incidenza sul budget del personale.',
    eco: 'Es. Valore aggiunto della figura, obiettivi attesi, tempi di inserimento.',
    alt: 'Es. Promozione interna, consulenza esterna, agenzia: alternative considerate.',
  },
  rs_innovazione: {
    fin: 'Es. Investimento previsto, eventuali crediti d\'imposta/agevolazioni, copertura.',
    eco: 'Es. Ritorno atteso, vantaggio competitivo, tempi di sviluppo e time-to-market.',
    alt: 'Es. Sviluppo interno vs acquisizione vs partnership: opzioni e scelta.',
  },
  compliance: {
    fin: 'Es. Costo dell\'adeguamento, sanzioni evitate, copertura di budget.',
    eco: 'Es. Riduzione del rischio, benefici organizzativi, impatto su continuità.',
    alt: 'Es. Livelli di adeguamento valutati, soluzioni interne vs esterne, motivazione.',
  },
  adempimenti_contabili: {
    fin: 'Es. Importi in gioco, impatto su liquidità e patrimonio, coerenza con il budget.',
    eco: 'Es. Effetto su risultato d\'esercizio, destinazione utili, riflessi economici.',
    alt: 'Es. Ipotesi alternative valutate (es. destinazione utili) e motivazione della scelta.',
  },
}
const ph = (tipo, campo) => (PLACEHOLDER[tipo] || PLACEHOLDER.default)[campo]

const eur = v => v == null || v === '' ? null
  : '€ ' + Number(v).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Componente ──────────────────────────────────────────────────────────
export default function NuovaDetermina() {
  const { azienda, setPage, determinaId, determinaOrgano } = useApp()
  const anno = new Date().getFullYear()

  const [step, setStep] = useState(1)
  const [auNome, setAuNome] = useState('')          // titolare AU (da organi/organo_membri)
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState(null)
  const [soloLettura, setSoloLettura] = useState(false)  // determina già firmata → non modificabile
  const [caricata, setCaricata] = useState(!determinaId) // false finché carico una bozza esistente
  const [organoAzienda, setOrganoAzienda] = useState(undefined) // undefined=caricamento, 'amministratore_unico'|'cda'|null
  const [titolareNome, setTitolareNome] = useState('')          // AU: titolare; CdA: presidente

  // dati determina
  const [tipo, setTipo] = useState('')
  const [oggetto, setOggetto] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [valore, setValore] = useState('')
  const [analisiFin, setAnalisiFin] = useState('')
  const [analisiEco, setAnalisiEco] = useState('')
  const [conEconomica, setConEconomica] = useState(true)  // false = delibera senza impatti economici
  const [vociExtra, setVociExtra] = useState([])   // voci checklist aggiuntive (azienda+tipo)
  const [nuovaVoce, setNuovaVoce] = useState('')
  const [checklist, setChecklist] = useState([])   // compilazione sull'atto: [{voce, spuntata, nota}]
  const [bozzaProvvId, setBozzaProvvId] = useState(null)   // id bozza provvisoria per allegare i file
  const [alternative, setAlternative] = useState('')
  const [area231, setArea231] = useState('')
  const [risk, setRisk] = useState({ finanziario: 0, operativo: 0, legale_231: 0, reputazionale: 0 })
  const [mit, setMit] = useState({})
  const [pareri, setPareri] = useState([])
  const [nuovoParere, setNuovoParere] = useState({ tipo: 'legale', fonte: '', sintesi: '' })
  const [corpoTesto, setCorpoTesto] = useState('')       // testo del documento, modificabile a mano
  const [modelli, setModelli] = useState([])             // determina_template dell'organo attivo
  const [templateId, setTemplateId] = useState('')       // modello scelto per "Importa modello"
  const [tipiCustom, setTipiCustom] = useState([])       // tipi aggiunti dall'azienda, solo per il suo organo

  // Rileva l'organo amministrativo ATTUALE (AU o CdA) e il nominativo di riferimento
  // Carica le voci checklist aggiuntive per (azienda, tipo)
  const caricaVociExtra = useCallback(async () => {
    if (!azienda?.id || !tipo) { setVociExtra([]); return }
    const { data } = await supabase.from('checklist_voci')
      .select('id, testo').eq('azienda_id', azienda.id).eq('tipo', tipo).order('created_at')
    setVociExtra(data || [])
  }, [azienda, tipo])
  useEffect(() => { caricaVociExtra() }, [caricaVociExtra])

  // Modelli (determina_template) e tipi personalizzati dell'organo attivo
  useEffect(() => {
    (async () => {
      if (!azienda?.id || organoAzienda === undefined) { setModelli([]); setTipiCustom([]); return }
      const org = determinaOrgano || organoAzienda || 'amministratore_unico'
      const [{ data: tpl }, { data: tc }] = await Promise.all([
        supabase.from('determina_template').select('*').eq('azienda_id', azienda.id).eq('organo', org).order('created_at'),
        supabase.from('determina_tipi_custom').select('*').eq('azienda_id', azienda.id).eq('organo', org).order('created_at'),
      ])
      setModelli(tpl || [])
      setTipiCustom(tc || [])
    })()
  }, [azienda, organoAzienda, determinaOrgano])

  async function aggiungiVoceChecklist() {
    const t = nuovaVoce.trim()
    if (!t || !tipo) return
    await supabase.from('checklist_voci').insert({ azienda_id: azienda.id, tipo, testo: t })
    setNuovaVoce('')
    caricaVociExtra()
  }
  async function modificaVoceChecklist(v) {
    const t = window.prompt('Modifica la voce:', v.testo)
    if (t == null) return
    const val = t.trim(); if (!val) return
    await supabase.from('checklist_voci').update({ testo: val }).eq('id', v.id)
    caricaVociExtra()
  }
  async function eliminaVoceChecklist(v) {
    if (!window.confirm(`Eliminare la voce "${v.testo}" dalla checklist di questo tipo?`)) return
    await supabase.from('checklist_voci').delete().eq('id', v.id)
    caricaVociExtra()
  }

  useEffect(() => {
    (async () => {
      if (!azienda?.id) return
      const { data: orgs } = await supabase.from('organi')
        .select('id,tipo').eq('azienda_id', azienda.id)
        .in('tipo', ['amministratore_unico', 'cda'])
      const org = orgs && orgs.length ? orgs[0] : null
      setOrganoAzienda(org ? org.tipo : null)
      if (!org) return
      if (org.tipo === 'amministratore_unico') {
        const { data: comp } = await supabase.from('organo_membri')
          .select('membri(nome,cognome)').eq('organo_id', org.id).limit(1)
        const m = comp && comp[0] && comp[0].membri
        if (m) { const nm = `${m.nome || ''} ${m.cognome || ''}`.trim(); setAuNome(nm); setTitolareNome(nm) }
      } else {
        // CdA: cerco il Presidente (o il primo componente)
        const { data: comp } = await supabase.from('organo_membri')
          .select('ruolo, membri(nome,cognome)').eq('organo_id', org.id)
        const pres = (comp || []).find(c => (c.ruolo || '').toLowerCase().includes('presidente')) || (comp || [])[0]
        const m = pres && pres.membri
        if (m) setTitolareNome(`${m.nome || ''} ${m.cognome || ''}`.trim())
      }
    })()
  }, [azienda])

  // Se sto riaprendo una determina esistente, carico i suoi dati
  useEffect(() => {
    (async () => {
      if (!determinaId) return
      const { data: det } = await supabase.from('determine').select('*').eq('id', determinaId).single()
      if (!det) { setCaricata(true); return }
      setTipo(det.tipo || '')
      setOggetto(det.oggetto || '')
      setDescrizione(det.descrizione || '')
      setValore(det.valore == null ? '' : String(det.valore))
      setAnalisiFin(det.analisi_finanziaria || '')
      setAnalisiEco(det.analisi_economica || '')
      if (det.con_analisi_economica === false) setConEconomica(false)
      if (Array.isArray(det.checklist)) setChecklist(det.checklist)
      setAlternative(det.alternative || '')
      setArea231(det.area_231 || '')
      setCorpoTesto(det.corpo_html || '')
      if (det.stato === 'firmata' || det.stato === 'annullata') setSoloLettura(true)

      const { data: rr } = await supabase.from('determina_rischi').select('*').eq('determina_id', determinaId)
      if (rr && rr.length) {
        const rk = { finanziario: 0, operativo: 0, legale_231: 0, reputazionale: 0 }
        const mt = {}
        rr.forEach(r => { rk[r.categoria] = r.livello; if (r.mitigazione) mt[r.categoria] = r.mitigazione })
        setRisk(rk); setMit(mt)
      }
      const { data: pp } = await supabase.from('determina_pareri').select('*').eq('determina_id', determinaId)
      if (pp && pp.length) setPareri(pp.map(p => ({ tipo: p.tipo, fonte: p.fonte || '', sintesi: p.sintesi || '' })))

      setCaricata(true)
    })()
  }, [determinaId])

  const maxRisk = Math.max(0, ...Object.values(risk))
  const serveParere = maxRisk >= 4
  const setR = (cat, v) => setRisk(r => ({ ...r, [cat]: r[cat] === v ? 0 : v }))

  function aggiungiParere() {
    if (!nuovoParere.fonte.trim()) return
    setPareri(p => [...p, nuovoParere])
    setNuovoParere({ tipo: 'legale', fonte: '', sintesi: '' })
  }

  // Precompila i campi del wizard da un modello della libreria (determina_template)
  function applicaModello(tpl) {
    setTipo(tpl.tipo || tipo)
    if (tpl.oggetto) setOggetto(tpl.oggetto)
    setDescrizione(tpl.descrizione || '')
    setConEconomica(tpl.con_analisi_economica !== false)
    setAnalisiFin(tpl.analisi_finanziaria || '')
    setAnalisiEco(tpl.analisi_economica || '')
    setAlternative(tpl.alternative || '')
    setArea231(tpl.area_231 || '')
    const rk = { finanziario: 0, operativo: 0, legale_231: 0, reputazionale: 0 }
    const mt = {}
    ;(tpl.rischi || []).forEach(r => { if (r.categoria) { rk[r.categoria] = r.livello || 0; if (r.mitigazione) mt[r.categoria] = r.mitigazione } })
    setRisk(rk); setMit(mt)
    setCorpoTesto('')   // si rigenera dai nuovi campi con "↻ Genera" allo step Redazione
  }

  // Salva i campi correnti come nuovo modello riutilizzabile (determina_template)
  async function salvaComeModello() {
    const nome = window.prompt('Nome del modello:', oggetto ? `Modello: ${oggetto}` : '')
    if (!nome || !nome.trim()) return
    const rischi = RISK_CATS.filter(c => risk[c.id] > 0).map(c => ({ categoria: c.id, livello: risk[c.id], mitigazione: mit[c.id] || null }))
    const payload = {
      azienda_id: azienda.id, organo: organoAtto, nome: nome.trim(), tipo: tipo || null,
      oggetto: oggetto || null, descrizione: descrizione || null,
      con_analisi_economica: conEconomica,
      analisi_finanziaria: conEconomica ? (analisiFin || null) : null,
      analisi_economica: conEconomica ? (analisiEco || null) : null,
      alternative: conEconomica ? (alternative || null) : null,
      area_231: area231 || null, rischi,
    }
    const { data, error } = await supabase.from('determina_template').insert(payload).select().single()
    if (error) { setErrore(error.message); return }
    setModelli(m => [...m, data])
  }

  // Aggiunge un tipo personalizzato, valido solo per questa azienda e questo organo
  async function aggiungiTipoCustom() {
    const label = window.prompt(`Nome del nuovo tipo di ${nomeAtto(organoAtto, azienda?.tipo_soggetto)} (solo per questa azienda):`)
    if (!label || !label.trim()) return
    const descrizione = window.prompt('Descrizione (facoltativa): a cosa serve questo tipo?') || ''
    const { data, error } = await supabase.from('determina_tipi_custom')
      .insert({ azienda_id: azienda.id, organo: organoAtto, label: label.trim(), descrizione: descrizione.trim() || null })
      .select().single()
    if (error) { setErrore(error.message); return }
    setTipiCustom(tc => [...tc, data])
    setTipo('custom:' + data.id)
  }

  async function elimina() {
    if (!window.confirm(`Eliminare definitivamente questa bozza di ${nomeAtto(organoAtto, azienda?.tipo_soggetto)}? L'operazione non è reversibile.`)) return
    setSaving(true)
    try {
      await supabase.from('governance_eventi').insert({
        azienda_id: azienda.id, determina_id: determinaId,
        evento: 'eliminazione_bozza', dettaglio: oggetto || '(senza oggetto)',
      })
    } catch (_e) { /* l'evento è accessorio */ }
    const { error } = await supabase.from('determine').delete().eq('id', determinaId)
    setSaving(false)
    if (error) { setErrore(error.message); return }
    setPage('au_registro')
  }

  function generaCorpo(numero) {
    const num = numero != null ? String(numero).padStart(3, '0') : '—'
    const chiRischi = RISK_CATS.filter(c => risk[c.id] > 0)
      .map(c => `${c.label.toLowerCase()}: ${LIV_LABEL[risk[c.id]]}`).join('; ')
    const righeParere = pareri.length
      ? `ACQUISITI i pareri professionali: ${pareri.map(p => `${p.tipo}${p.fonte ? ' (' + p.fonte + ')' : ''}`).join('; ')};`
      : ''
    return [
      isCda
        ? `Proposta di DELIBERA DEL CONSIGLIO DI AMMINISTRAZIONE N. ${num}/${anno}`
        : `DETERMINA DELL'AMMINISTRATORE UNICO N. ${num}/${anno}`,
      ``,
      isCda
        ? `PREMESSA. Il Consiglio di Amministrazione di ${azienda?.nome || 'questa società'}, riunitosi e validamente costituito, avendo valutato la necessità e l'opportunità dell'operazione di seguito descritta;`
        : `PREMESSA. Il/La sottoscritto/a ${titolareNome || auNome || 'Amministratore Unico'}, in qualità di Amministratore Unico di ${azienda?.nome || 'questa società'}, avendo valutato la necessità e l'opportunità dell'operazione di seguito descritta;`,
      ``,
      `VISTE le analisi economico-finanziarie condotte e la documentazione istruttoria agli atti;`,
      alternative ? `VALUTATE le alternative considerate: ${alternative};` : '',
      chiRischi ? `ACCERTATO che i rischi connessi sono stati valutati (${chiRischi}) con i relativi piani di mitigazione;` : '',
      righeParere,
      area231 ? `RILEVATO che l'operazione ricade nell'area sensibile 231 "${area231}", per la quale sono stati rispettati i protocolli previsti dal Modello Organizzativo;` : '',
      ``,
      isCda ? `DELIBERA` : `DETERMINA`,
      `1. di approvare l'operazione avente ad oggetto: ${oggetto}${eur(valore) ? `, per un valore di ${eur(valore)}` : ''};`,
      descrizione ? `2. ${descrizione}` : '',
      `${descrizione ? '3' : '2'}. di autorizzare la sottoscrizione di tutti gli atti conseguenti.`,
    ].filter(Boolean).join('\n')
  }

  // Crea una bozza provvisoria per poter allegare i file già in preparazione.
  // Restituisce l'id, o null se manca l'oggetto.
  async function assicuraBozzaProvvisoria() {
    if (determinaId || bozzaProvvId) return determinaId || bozzaProvvId
    if (!oggetto.trim()) { setErrore('Inserisci l\'oggetto per proseguire e poter allegare i documenti.'); setStep(1); return null }
    const campi = {
      azienda_id: azienda.id, anno, tipo, organo: organoAtto,
      oggetto: oggetto.trim(), descrizione: descrizione || null,
      valore: valore === '' ? null : Number(valore),
      con_analisi_economica: conEconomica, checklist,
      analisi_finanziaria: conEconomica ? (analisiFin || null) : null,
      analisi_economica: conEconomica ? (analisiEco || null) : null,
      alternative: conEconomica ? (alternative || null) : null,
      area_231: area231 || null, corpo_html: corpoTesto && corpoTesto.trim() ? corpoTesto : generaCorpo(null),
      stato: 'bozza', provvisoria: true,
    }
    const { data, error } = await supabase.from('determine').insert(campi).select().single()
    if (error) { setErrore(error.message); return null }
    setBozzaProvvId(data.id)
    return data.id
  }

  // Passaggio allo step Fascicolo: garantisce la bozza provvisoria
  async function vaiAlFascicolo() {
    setErrore(null)
    const id = await assicuraBozzaProvvisoria()
    if (id) setStep(6)
  }

  // Se si arriva allo step Fascicolo da qualunque via (anche cliccando la barra
  // degli step), garantisci comunque la bozza provvisoria per poter allegare.
  useEffect(() => {
    if (step === 6 && !determinaId && !bozzaProvvId && !soloLettura && oggetto.trim()) {
      assicuraBozzaProvvisoria()
    }
  }, [step])

  // Precompila il testo la prima volta che si arriva allo step di Redazione
  useEffect(() => {
    if (step === 5 && !corpoTesto && !soloLettura) setCorpoTesto(generaCorpo(null))
  }, [step])

  // Uscita dal wizard: se c'è una bozza provvisoria non confermata, la elimino
  async function esciDalWizard() {
    if (bozzaProvvId && !determinaId) {
      try {
        const { data: alg } = await supabase.from('determina_allegati').select('storage_path').eq('determina_id', bozzaProvvId)
        const paths = (alg || []).map(a => a.storage_path)
        if (paths.length) await supabase.storage.from('fascicoli').remove(paths)
        await supabase.from('determina_allegati').delete().eq('determina_id', bozzaProvvId)
        await supabase.from('determine').delete().eq('id', bozzaProvvId)
      } catch (_e) { /* pulizia best-effort */ }
    }
    setPage('au_registro')
  }

  async function salva(firma) {
    setErrore(null)
    if (!tipo) { setStep(1); setErrore(`Seleziona il tipo di ${nomeAtto(organoAtto, azienda?.tipo_soggetto)}, poi riprova.`); return }
    if (!oggetto.trim()) { setStep(1); setErrore(`Manca l'oggetto della ${nomeAtto(organoAtto, azienda?.tipo_soggetto)}: lo trovi qui sotto. Compilalo e riprova — il resto del lavoro è al sicuro.`); return }
    if (firma && conEconomica && serveParere && pareri.length === 0) {
      setStep(4); setErrore(isCda ? 'Rischio alto/critico rilevato: è obbligatorio allegare almeno un parere prima di protocollare.' : 'Rischio alto/critico rilevato: è obbligatorio allegare almeno un parere prima di firmare.'); return
    }

    setSaving(true)
    try {
      let numero = null, data_firma = null, hash = null, stato = 'bozza'
      let corpo = corpoTesto && corpoTesto.trim() ? corpoTesto : generaCorpo(null)
      if (firma) {
        const { data: n, error: eN } = await supabase.rpc('prossimo_numero_determina', { p_azienda: azienda.id, p_anno: anno, p_organo: organoAtto })
        if (eN) throw eN
        numero = n
        data_firma = new Date().toISOString()
        stato = 'firmata'
        corpo = corpo.replace('N. —/', `N. ${String(numero).padStart(3, '0')}/`)
        hash = await sha256(corpo)
      }

      const campi = {
        azienda_id: azienda.id, anno, tipo, organo: organoAtto, oggetto: oggetto.trim(), descrizione: descrizione || null,
        valore: valore === '' ? null : Number(valore),
        con_analisi_economica: conEconomica,
        checklist,
        analisi_finanziaria: conEconomica ? (analisiFin || null) : null,
        analisi_economica: conEconomica ? (analisiEco || null) : null,
        alternative: conEconomica ? (alternative || null) : null,
        area_231: area231 || null, corpo_html: corpo, stato, provvisoria: false,
      }
      // il numero/hash/data si scrivono solo alla firma (una bozza non li ha)
      if (firma) { campi.numero = numero; campi.data_firma = data_firma; campi.hash_documento = hash }

      const idEsistente = determinaId || bozzaProvvId
      let detId = idEsistente
      if (idEsistente) {
        const { error } = await supabase.from('determine').update(campi).eq('id', idEsistente)
        if (error) throw error
        // ricarico rischi e pareri da zero (sostituzione pulita)
        await supabase.from('determina_rischi').delete().eq('determina_id', idEsistente)
        await supabase.from('determina_pareri').delete().eq('determina_id', idEsistente)
      } else {
        const { data: det, error } = await supabase.from('determine').insert(campi).select().single()
        if (error) throw error
        detId = det.id
      }

      const righeRischi = RISK_CATS.filter(c => risk[c.id] > 0).map(c => ({
        determina_id: detId, azienda_id: azienda.id, categoria: c.id, livello: risk[c.id], mitigazione: mit[c.id] || null,
      }))
      if (righeRischi.length) {
        const { error } = await supabase.from('determina_rischi').insert(righeRischi)
        if (error) throw error
      }

      if (pareri.length) {
        const righeP = pareri.map(p => ({
          determina_id: detId, azienda_id: azienda.id, tipo: p.tipo, fonte: p.fonte || null,
          sintesi: p.sintesi || null, obbligatorio: serveParere,
        }))
        const { error } = await supabase.from('determina_pareri').insert(righeP)
        if (error) throw error
      }

      await supabase.from('governance_eventi').insert({
        azienda_id: azienda.id, determina_id: detId,
        evento: firma ? 'firma' : (determinaId ? 'aggiornamento_bozza' : 'creazione_bozza'),
        dettaglio: `${labelDiTipo(tipo)} — ${oggetto.trim()}`,
      })

      setPage('au_registro')
    } catch (e) {
      setErrore(e.message || 'Errore durante il salvataggio.')
      setSaving(false)
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────
  // Organo dell'atto che sto creando: da context (nuovo) o dall'organo attuale
  const organoAtto = determinaOrgano || organoAzienda || 'amministratore_unico'
  const attoId = determinaId || bozzaProvvId   // id per allegati/fascicolo
  const isCda = organoAtto === 'cda'
  // Suffisso AU/CdA nei titoli: per un'impresa individuale (nessun organo collegiale) si omette
  const suffissoAtto = azienda?.tipo_soggetto === 'individuale' ? '' : (isCda ? ' CdA' : ' AU')
  // Tipi standard + personalizzati di questa azienda, ed etichetta unificata
  const tipiTutti = [...TIPI, ...tipiCustom.map(c => ({ id: 'custom:' + c.id, label: c.label, icon: '🏷️', desc: c.descrizione || 'Tipo personalizzato per questa azienda' }))]
  const labelDiTipo = (t) => TIPO_LABEL[t] || tipiTutti.find(x => x.id === t)?.label || t

  // GUARDIA DI ACCESSO (solo in creazione nuova; le bozze/atti esistenti si aprono sempre)
  if (!determinaId && organoAzienda !== undefined && organoAzienda && determinaOrgano && determinaOrgano !== organoAzienda) {
    const attesa = determinaOrgano === 'cda' ? 'il Consiglio di Amministrazione' : "l'Amministratore Unico"
    const reale = organoAzienda === 'cda' ? 'il Consiglio di Amministrazione' : "l'Amministratore Unico"
    return (
      <div>
        <div className="page-header">
          <h2>Operazione non consentita</h2>
        </div>
        <div className="alert alert-error">
          Questa società ha {reale} come organo amministrativo, quindi non è possibile creare un atto per {attesa}.
        </div>
        <button className="btn" onClick={() => setPage(organoAzienda === 'cda' ? 'au_registro' : 'au_registro')}>← Torna al registro</button>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>{soloLettura ? `${nomeAtto(organoAtto, azienda?.tipo_soggetto, { maiuscolo: true })}${suffissoAtto}` : determinaId ? `Modifica ${nomeAtto(organoAtto, azienda?.tipo_soggetto)}${suffissoAtto}` : `Nuova ${nomeAtto(organoAtto, azienda?.tipo_soggetto)}${suffissoAtto}`}</h2>
            <p>
              {tipo
                ? <>{tipiTutti.find(t => t.id === tipo)?.icon} <strong>{labelDiTipo(tipo)}</strong> · {azienda?.nome}</>
                : <>Flusso guidato · {azienda?.nome}</>}
              {titolareNome ? (isCda ? ` · Presidente: ${titolareNome}` : ` · AU: ${titolareNome}`) : ''} · Anno {anno}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {determinaId && !soloLettura && <button className="btn btn-sm btn-danger" onClick={elimina} disabled={saving}>🗑 Elimina bozza</button>}
            <button className="btn btn-sm" onClick={esciDalWizard}>← Registro</button>
          </div>
        </div>
      </div>

      {soloLettura && (
        <div className="alert" style={{ marginBottom: 14, background: '#EAF2F8', color: '#1A5276' }}>
          🔒 {isCda ? 'Questa delibera ha l\'istruttoria chiusa ed è protocollata' : `Questa ${nomeAtto(organoAtto, azienda?.tipo_soggetto)} è già firmata e registrata`}: è consultabile ma non modificabile.
        </div>
      )}

      {/* Indicatore step */}
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #E0E0E0', marginBottom: 18 }}>
        {STEPS.map((s, i) => {
          const n = i + 1
          const active = n === step, done = n < step
          const disabilitato = !conEconomica && (n === 2 || n === 3 || n === 4)
          return (
            <div key={s} onClick={() => { if (!disabilitato) setStep(n) }}
              style={{
                flex: 1, padding: '9px 6px', textAlign: 'center', fontSize: 12, fontWeight: 600,
                cursor: disabilitato ? 'not-allowed' : 'pointer', opacity: disabilitato ? 0.4 : 1,
                background: active ? '#7F77DD' : done ? '#EDEBFA' : '#F7F8FA',
                color: active ? '#fff' : done ? '#5A4FCF' : '#999',
              }}>{n} · {s}</div>
          )
        })}
      </div>

      {errore && <div className="alert alert-error" style={{ marginBottom: 14 }}>{errore}</div>}

      {/* STEP 1 — Tipo */}
      {step === 1 && (
        <div className="card">
          {modelli.length > 0 && !soloLettura && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <select className="form-control" style={{ width: 'auto', minWidth: 240 }} value={templateId} onChange={e => setTemplateId(e.target.value)}>
                <option value="">— Parti da zero —</option>
                {modelli.map(m => <option key={m.id} value={m.id}>Modello: {m.nome}</option>)}
              </select>
              <button className="btn btn-sm" disabled={!templateId}
                onClick={() => { const tpl = modelli.find(m => m.id === templateId); if (tpl) applicaModello(tpl) }}>
                ↩ Importa modello
              </button>
            </div>
          )}
          {/* Oggetto in cima, piena larghezza */}
          <div className="form-group">
            <label className="form-label">Oggetto della {nomeAtto(organoAtto, azienda?.tipo_soggetto)} *</label>
            <input className="form-control" value={oggetto} onChange={e => setOggetto(e.target.value)}
              placeholder="es. Contratto di leasing macchinario CNC" />
          </div>

          {/* Due colonne: sinistra i tipi (stretti, 2 colonne), destra la guida */}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 340px', minWidth: 280 }}>
              <label className="form-label">Tipo di {nomeAtto(organoAtto, azienda?.tipo_soggetto)} *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {tipiTutti.map(t => (
                  <div key={t.id} onClick={() => setTipo(t.id)}
                    style={{
                      border: `1.5px solid ${tipo === t.id ? '#7F77DD' : '#E0E0E0'}`,
                      background: tipo === t.id ? '#EDEBFA' : '#fff',
                      borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                    }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>{t.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 12.5, color: '#1A3A5C', lineHeight: 1.25 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 2, lineHeight: 1.3 }}>{t.desc}</div>
                  </div>
                ))}
                {!soloLettura && (
                  <div onClick={aggiungiTipoCustom}
                    style={{
                      border: '1.5px dashed #B9C2D0', borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#7F8B9E',
                    }}>
                    <div style={{ fontSize: 18 }}>➕</div>
                    <div style={{ fontWeight: 600, fontSize: 12.5 }}>Nuovo tipo</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: '1 1 340px', minWidth: 280 }}>
              {tipo && FASCICOLI[tipo] ? (
                <div style={{ background: '#F4F8FF', border: '1px solid #CFE0F5', borderRadius: 12, padding: '16px 18px', position: 'sticky', top: 12 }}>
                  <div style={{ fontSize: 14.5, color: '#1A3A5C', marginBottom: 10, lineHeight: 1.55 }}>
                    <strong>Cosa riguarda.</strong> {FASCICOLI[tipo].riguarda}
                  </div>
                  <div style={{ fontSize: 14.5, color: '#1A3A5C', marginBottom: 10, lineHeight: 1.55 }}>
                    <strong>Funzionamento.</strong> {FASCICOLI[tipo].funzionamento}
                  </div>
                  <div style={{ fontSize: 14.5, color: '#1A3A5C', marginBottom: 12, lineHeight: 1.55 }}>
                    <strong>Elementi chiave.</strong> {FASCICOLI[tipo].elementi}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#5A4FCF', marginBottom: 6 }}>📂 Giustificativi da conservare nel fascicolo</div>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 14, color: '#44506A', lineHeight: 1.7 }}>
                    {FASCICOLI[tipo].giustificativi.map((g, i) => <li key={'b' + i}>{g}</li>)}
                    {vociExtra.map(v => (
                      <li key={v.id}>
                        {v.testo} <span style={{ fontSize: 11, color: '#8A93A5' }}>(aggiunta)</span>
                        <button type="button" title="Modifica" onClick={() => modificaVoceChecklist(v)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#5A4FCF', padding: '0 2px', marginLeft: 4 }}>✎</button>
                        <button type="button" title="Elimina" onClick={() => eliminaVoceChecklist(v)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#C0392B', padding: '0 2px' }}>✕</button>
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <input className="form-control" style={{ fontSize: 13, padding: '6px 10px' }}
                      value={nuovaVoce} onChange={e => setNuovaVoce(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aggiungiVoceChecklist() } }}
                      placeholder="Aggiungi un giustificativo a questo tipo…" />
                    <button type="button" className="btn btn-sm btn-primary" onClick={aggiungiVoceChecklist} disabled={!nuovaVoce.trim()}>+ Aggiungi</button>
                  </div>
                  <div style={{ fontSize: 11, color: '#8A93A5', marginTop: 6 }}>
                    Le voci aggiunte valgono per le prossime {nomeAtto(organoAtto, azienda?.tipo_soggetto, { plurale: true })} di questo tipo (solo per questa azienda). Le voci di base non sono modificabili.
                  </div>
                </div>
              ) : tipo ? (
                <div style={{ background: '#F4F8FF', border: '1px solid #CFE0F5', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 14.5, color: '#1A3A5C', lineHeight: 1.55 }}>
                    <strong>Tipo personalizzato.</strong> {tipiCustom.find(c => 'custom:' + c.id === tipo)?.descrizione || 'Nessuna descrizione inserita.'}
                  </div>
                  <div style={{ fontSize: 11, color: '#8A93A5', marginTop: 10 }}>
                    Nessun giustificativo predefinito per i tipi personalizzati: puoi comunque aggiungerne uno qui sotto.
                  </div>
                  {vociExtra.length > 0 && (
                    <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 14, color: '#44506A', lineHeight: 1.7 }}>
                      {vociExtra.map(v => (
                        <li key={v.id}>
                          {v.testo}
                          <button type="button" title="Modifica" onClick={() => modificaVoceChecklist(v)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#5A4FCF', padding: '0 2px', marginLeft: 4 }}>✎</button>
                          <button type="button" title="Elimina" onClick={() => eliminaVoceChecklist(v)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#C0392B', padding: '0 2px' }}>✕</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <input className="form-control" style={{ fontSize: 13, padding: '6px 10px' }}
                      value={nuovaVoce} onChange={e => setNuovaVoce(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aggiungiVoceChecklist() } }}
                      placeholder="Aggiungi un giustificativo a questo tipo…" />
                    <button type="button" className="btn btn-sm btn-primary" onClick={aggiungiVoceChecklist} disabled={!nuovaVoce.trim()}>+ Aggiungi</button>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#F7F8FA', border: '1px dashed #D5DCE6', borderRadius: 12, padding: '24px 16px', textAlign: 'center', color: '#9AA5B4', fontSize: 13 }}>
                  Scegli un tipo per vedere cosa riguarda e quali giustificativi conservare nel fascicolo.
                </div>
              )}
            </div>
          </div>

          <div className="form-group" style={{ background: '#F7F8FA', borderRadius: 10, padding: '12px 14px', marginTop: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5 }}>
              <input type="checkbox" checked={conEconomica} onChange={e => setConEconomica(e.target.checked)} />
              <span>Questa {nomeAtto(organoAtto, azienda?.tipo_soggetto)} ha <strong>impatti economici</strong> da analizzare</span>
            </label>
            <div style={{ fontSize: 11.5, color: '#999', marginTop: 6 }}>
              {conEconomica
                ? 'Verranno chiesti analisi economico-finanziaria, valutazione del rischio ed eventuali pareri.'
                : 'Istruttoria semplificata: si passa direttamente alla redazione del testo (es. preparazione all\'approvazione del bilancio).'}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setStep(conEconomica ? 2 : 5)}>Avanti →</button>
          </div>
        </div>
      )}

      {/* STEP 2 — Analisi */}
      {step === 2 && (
        <div className="card">
          <div className="form-group">
            <label className="form-label">Descrizione dell'operazione</label>
            <textarea className="form-control" value={descrizione} onChange={e => setDescrizione(e.target.value)}
              placeholder={`Descrivi in dettaglio l'operazione oggetto della ${nomeAtto(organoAtto, azienda?.tipo_soggetto)}...`} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Valore (€)</label>
              <input className="form-control" type="number" min="0" step="0.01" value={valore}
                onChange={e => setValore(e.target.value)} placeholder="es. 525000" />
            </div>
            <div className="form-group">
              <label className="form-label">Analisi finanziaria</label>
              <textarea className="form-control" value={analisiFin} onChange={e => setAnalisiFin(e.target.value)}
                placeholder={ph(tipo, 'fin')} />
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 4 }}>{HINT.fin}</div>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Analisi economica</label>
              <textarea className="form-control" value={analisiEco} onChange={e => setAnalisiEco(e.target.value)}
                placeholder={ph(tipo, 'eco')} />
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 4 }}>{HINT.eco}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Alternative valutate</label>
              <textarea className="form-control" value={alternative} onChange={e => setAlternative(e.target.value)}
                placeholder={ph(tipo, 'alt')} />
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 4 }}>{HINT.alt}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn" onClick={() => setStep(1)}>← Indietro</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>Avanti →</button>
          </div>
        </div>
      )}

      {/* STEP 3 — Rischio */}
      {step === 3 && (
        <div className="card">
          <div className="form-group">
            <label className="form-label">Valuta ogni categoria di rischio (1 = basso · 5 = critico)</label>
            {RISK_CATS.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid #F0F0F0' }}>
                <div style={{ width: 150 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{c.hint}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} onClick={() => setR(c.id, v)}
                      style={{
                        width: 30, height: 30, borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                        border: `1.5px solid ${risk[c.id] >= v ? '#7F77DD' : '#E0E0E0'}`,
                        background: risk[c.id] >= v ? '#7F77DD' : '#fff',
                        color: risk[c.id] >= v ? '#fff' : '#999',
                      }}>{v}</button>
                  ))}
                </div>
                {risk[c.id] > 0 && <span className="badge" style={livStyle(risk[c.id])}>{LIV_LABEL[risk[c.id]]}</span>}
                {risk[c.id] >= 3 && (
                  <input className="form-control" style={{ flex: 1, minWidth: 180 }} value={mit[c.id] || ''}
                    onChange={e => setMit(m => ({ ...m, [c.id]: e.target.value }))} placeholder="Piano di mitigazione..." />
                )}
              </div>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">Area sensibile 231 (se applicabile)</label>
            <select className="form-control" value={area231} onChange={e => setArea231(e.target.value)}>
              {AREE_231.map(a => <option key={a} value={a}>{a || '— Nessuna / non pertinente'}</option>)}
            </select>
          </div>
          {serveParere && (
            <div className="alert alert-error" style={{ marginBottom: 14 }}>
              🚨 Rischio alto/critico rilevato: prima di {isCda ? 'protocollare' : 'firmare'} sarà obbligatorio allegare almeno un parere (step successivo).
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn" onClick={() => setStep(2)}>← Indietro</button>
            <button className="btn btn-primary" onClick={() => setStep(4)}>Avanti →</button>
          </div>
        </div>
      )}

      {/* STEP 4 — Pareri */}
      {step === 4 && (
        <div className="card">
          {serveParere
            ? <div className="alert alert-error" style={{ marginBottom: 14 }}>Obbligatorio: il rischio rilevato richiede almeno un parere professionale.</div>
            : <p style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>Puoi allegare pareri professionali a supporto della decisione (facoltativo per questo livello di rischio).</p>}

          {pareri.map((p, i) => (
            <div key={i} style={{ border: '1px solid #E0E0E0', borderRadius: 8, padding: 12, marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Parere {p.tipo}{p.fonte ? ` — ${p.fonte}` : ''}</div>
                {p.sintesi && <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>{p.sintesi}</div>}
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => setPareri(pareri.filter((_, j) => j !== i))}>Rimuovi</button>
            </div>
          ))}

          <div style={{ background: '#F7F8FA', borderRadius: 8, padding: 12, marginTop: 8 }}>
            <div className="grid-2">
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label">Tipo di parere</label>
                <select className="form-control" value={nuovoParere.tipo} onChange={e => setNuovoParere({ ...nuovoParere, tipo: e.target.value })}>
                  <option value="legale">Legale</option>
                  <option value="finanziario">Finanziario</option>
                  <option value="tecnico">Tecnico</option>
                  <option value="odv">OdV</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label">Fonte / professionista</label>
                <input className="form-control" value={nuovoParere.fonte} onChange={e => setNuovoParere({ ...nuovoParere, fonte: e.target.value })} placeholder="es. Studio Legale Rossi" />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">Sintesi del parere</label>
              <textarea className="form-control" value={nuovoParere.sintesi} onChange={e => setNuovoParere({ ...nuovoParere, sintesi: e.target.value })} placeholder="Conclusione del parere..." />
            </div>
            <button className="btn btn-sm btn-primary" onClick={aggiungiParere} disabled={!nuovoParere.fonte.trim()}>+ Aggiungi parere</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <button className="btn" onClick={() => setStep(3)}>← Indietro</button>
            <button className="btn btn-primary" onClick={() => setStep(5)}>Avanti →</button>
          </div>
        </div>
      )}

      {/* STEP 5 — Redazione */}
      {step === 5 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Testo della {nomeAtto(organoAtto, azienda?.tipo_soggetto)}</label>
            {!soloLettura && <button className="btn btn-sm" onClick={() => setCorpoTesto(generaCorpo(null))}>↻ Genera</button>}
          </div>
          <p style={{ fontSize: 12, color: '#999', margin: '4px 0 8px' }}>
            Genera il testo dai dati inseriti, poi modificalo liberamente. Alla {isCda ? 'protocollazione' : 'firma'} il numero definitivo viene inserito e il documento congelato con un hash.
          </p>
          <textarea className="form-control" style={{ minHeight: 300, fontFamily: 'inherit', lineHeight: 1.7, fontSize: 13 }}
            value={corpoTesto} disabled={soloLettura} onChange={e => setCorpoTesto(e.target.value)}
            placeholder="Clicca «↻ Genera» per una prima bozza dai dati inseriti, poi modificala liberamente." />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <button className="btn" onClick={() => setStep(conEconomica ? 4 : 1)}>← Indietro</button>
            <button className="btn btn-primary" onClick={vaiAlFascicolo}>Avanti →</button>
          </div>
        </div>
      )}

      {/* STEP 6 — Fascicolo (checklist giustificativi) */}
      {step === 6 && (
        <div className="card">
          <label className="form-label">Fascicolo — giustificativi raccolti</label>
          <div style={{ fontSize: 12.5, color: '#999', marginBottom: 12 }}>
            Spunta i documenti che hai raccolto per questo atto e, se vuoi, aggiungi una nota (es. protocollo, data). È una traccia consigliata, non vincolante.
          </div>
          <FascicoloChecklist
            tipo={tipo} vociExtra={vociExtra} checklist={checklist} setChecklist={setChecklist} soloLettura={soloLettura}
            determinaId={attoId} aziendaId={azienda?.id} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <button className="btn" onClick={() => setStep(5)}>← Indietro</button>
            <button className="btn btn-primary" onClick={() => setStep(7)}>Avanti →</button>
          </div>
        </div>
      )}

      {/* STEP 7 — Chiusura */}
      {step === 7 && (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✍️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1A3A5C', marginBottom: 6 }}>{isCda ? 'Salva o chiudi l\'istruttoria' : `Salva o firma la ${nomeAtto(organoAtto, azienda?.tipo_soggetto)}`}</div>
          <div style={{ fontSize: 12.5, color: '#666', marginBottom: 18 }}>
            {isCda ? 'La chiusura dell\'istruttoria assegna il numero progressivo definitivo e congela il documento preparatorio con un hash SHA-256.' : 'La firma assegna il numero progressivo definitivo e congela il documento con un hash SHA-256.'} La bozza resta modificabile.
          </div>
          <div style={{ display: 'inline-flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className="badge" style={{ background: '#E9F7EF', color: '#1E8449' }}>Tipo: {labelDiTipo(tipo) || '—'}</span>
            {eur(valore) && <span className="badge" style={{ background: '#EBF4FC', color: '#2B5FA5' }}>{eur(valore)}</span>}
            {maxRisk > 0 && <span className="badge" style={livStyle(maxRisk)}>Rischio max: {LIV_LABEL[maxRisk]}</span>}
            {pareri.length > 0 && <span className="badge" style={{ background: '#EDEBFA', color: '#5A4FCF' }}>{pareri.length} parere/i</span>}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => salva(false)} disabled={saving || soloLettura}>{saving ? 'Salvataggio…' : '💾 Salva come bozza'}</button>
            <button className="btn btn-primary" onClick={() => salva(true)} disabled={saving || soloLettura}>{saving ? 'Salvataggio…' : (isCda ? '📋 Chiudi l\'istruttoria e protocolla' : '✍️ Firma e registra')}</button>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-sm" onClick={() => setStep(6)}>← Indietro</button>
            {!soloLettura && <button className="btn btn-sm" onClick={salvaComeModello}>💾 Salva come modello</button>}
          </div>
        </div>
      )}
    </div>
  )
}
// ── Checklist del fascicolo: spunta + nota + allegati per giustificativo ────
const MAX_FILE_MB = 10

function FascicoloChecklist({ tipo, vociExtra, checklist, setChecklist, soloLettura, determinaId, aziendaId }) {
  const base = (tipo && FASCICOLI[tipo] && FASCICOLI[tipo].giustificativi) || []
  const extra = (vociExtra || []).map(v => v.testo)
  const voci = [...base, ...extra]

  const [allegati, setAllegati] = useState([])
  const [busy, setBusy] = useState(null)   // voce in upload
  const [msg, setMsg] = useState(null)

  const caricaAllegati = useCallback(async () => {
    if (!determinaId) { setAllegati([]); return }
    const { data } = await supabase.from('determina_allegati')
      .select('*').eq('determina_id', determinaId).order('created_at')
    setAllegati(data || [])
  }, [determinaId])
  useEffect(() => { caricaAllegati() }, [caricaAllegati])

  const stato = (voce) => checklist.find(c => c.voce === voce) || { voce, spuntata: false, nota: '' }
  function aggiorna(voce, patch) {
    setChecklist(prev => {
      const i = prev.findIndex(c => c.voce === voce)
      if (i === -1) return [...prev, { voce, spuntata: false, nota: '', ...patch }]
      const copia = [...prev]; copia[i] = { ...copia[i], ...patch }; return copia
    })
  }

  const allegatiDiVoce = (voce) => allegati.filter(a => a.voce === voce)

  async function caricaFile(voce, file) {
    if (!file) return
    if (!determinaId) { setMsg('Salva prima la bozza per poter allegare i file.'); return }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { setMsg(`Il file supera ${MAX_FILE_MB} MB.`); return }
    setBusy(voce); setMsg(null)
    // percorso: azienda/determina/timestamp-nomefile (nome ripulito)
    const safe = file.name.replace(/[^\w.\-]+/g, '_')
    const path = `${aziendaId}/${determinaId}/${Date.now()}-${safe}`
    const up = await supabase.storage.from('fascicoli').upload(path, file, { upsert: false })
    if (up.error) { setBusy(null); setMsg('Caricamento non riuscito: ' + up.error.message); return }
    const { error } = await supabase.from('determina_allegati').insert({
      azienda_id: aziendaId, determina_id: determinaId, voce,
      nome_file: file.name, storage_path: path, dimensione: file.size,
    })
    setBusy(null)
    if (error) { setMsg('File caricato ma registrazione fallita: ' + error.message); return }
    caricaAllegati()
  }

  async function scaricaFile(a) {
    const { data, error } = await supabase.storage.from('fascicoli').createSignedUrl(a.storage_path, 120)
    if (error || !data?.signedUrl) { setMsg('Impossibile aprire il file.'); return }
    window.open(data.signedUrl, '_blank')
  }

  async function eliminaFile(a) {
    if (!window.confirm(`Eliminare l'allegato "${a.nome_file}"?`)) return
    await supabase.storage.from('fascicoli').remove([a.storage_path])
    await supabase.from('determina_allegati').delete().eq('id', a.id)
    caricaAllegati()
  }

  if (voci.length === 0) {
    return <div style={{ fontSize: 13, color: '#999' }}>Nessun giustificativo previsto per questo tipo.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!determinaId && (
        <div className="alert" style={{ background: '#FEF9E7', color: '#856404', fontSize: 12.5 }}>
          Per allegare i file, salva prima la bozza (pulsante nell'ultimo step). Le spunte e le note puoi già compilarle.
        </div>
      )}
      {msg && <div className="alert alert-error" style={{ fontSize: 12.5 }}>{msg}</div>}
      {voci.map((voce, i) => {
        const st = stato(voce)
        const files = allegatiDiVoce(voce)
        return (
          <div key={i} style={{ border: '1px solid #E8ECF2', borderRadius: 8, padding: '10px 12px', background: st.spuntata ? '#F3FBF6' : '#fff' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: soloLettura ? 'default' : 'pointer', fontSize: 13.5, color: '#1A3A5C' }}>
              <input type="checkbox" checked={!!st.spuntata} disabled={soloLettura}
                onChange={e => aggiorna(voce, { spuntata: e.target.checked })} style={{ marginTop: 3 }} />
              <span>{voce}</span>
            </label>
            {st.spuntata && (
              <input className="form-control" style={{ marginTop: 8, fontSize: 13, padding: '6px 10px' }}
                value={st.nota || ''} disabled={soloLettura}
                onChange={e => aggiorna(voce, { nota: e.target.value })}
                placeholder="Nota (facoltativa): es. acquisiti 3 preventivi, agli atti prot. 12/2026" />
            )}

            {/* Allegati della voce */}
            {files.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {files.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, background: '#F7F8FA', borderRadius: 6, padding: '5px 8px' }}>
                    <span style={{ flex: 1, color: '#1A3A5C' }}>📎 {a.nome_file}</span>
                    <button type="button" className="btn btn-sm" onClick={() => scaricaFile(a)}>Apri</button>
                    {!soloLettura && <button type="button" className="btn btn-sm btn-danger" onClick={() => eliminaFile(a)}>✕</button>}
                  </div>
                ))}
              </div>
            )}

            {!soloLettura && determinaId && (
              <div style={{ marginTop: 8 }}>
                <label className="btn btn-sm" style={{ cursor: busy === voce ? 'default' : 'pointer' }}>
                  {busy === voce ? 'Caricamento…' : '📎 Allega file'}
                  <input type="file" style={{ display: 'none' }} disabled={busy === voce}
                    onChange={e => { caricaFile(voce, e.target.files?.[0]); e.target.value = '' }} />
                </label>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
