import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../../App'
import { supabase } from '../lib/supabase'
import AbbinaDaDocumento from '../components/AbbinaDaDocumento'
import { risolviMappatura } from '../lib/mappatureConti'

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const fmt = (n) => (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

// Libro Giornale/Prima Nota: i "conti" da riclassificare sono in realta' gruppi di
// conto (es. "06/G", "14/C", "40/F"), senza una categoria ricavi/costi di partenza
// come nel provvisorio — vanno assegnati anche ad attivita'/passivita'.
const TIPI_LIBRO_GIORNALE = ['prima_nota_precedente', 'prima_nota_corrente', 'libro_giornale_precedente', 'libro_giornale_corrente']

const BADGE_CATEGORIA = { ricavi: 'badge-success', costi: 'badge-danger', attivita: 'badge-info', passivita: 'badge-warning' }
const LABEL_CATEGORIA = { ricavi: 'ricavi', costi: 'costi', attivita: 'attività', passivita: 'passività' }

// Suggerimento automatico della voce in base alla descrizione del gruppo
// (Libro Giornale/Prima Nota): un aiuto per velocizzare la riclassificazione,
// non una scelta definitiva — l'utente la conferma o la cambia prima di
// salvare. I fondi ammortamento/svalutazione legati a un bene specifico (es.
// "F/AMM...", "fondo rischi su crediti") vanno tra le ATTIVITA' in negativo,
// perche' rettificano il valore lordo del bene; i fondi rischi/oneri generici,
// non legati a un bene specifico (controversie legali, quiescenza), tra le
// PASSIVITA' — sono accantonamenti veri, non rettifiche.
const REGOLE_SUGGERIMENTO = [
  // --- eccezioni molto specifiche, controllate per prime perche' altrimenti
  // verrebbero intercettate da una regola piu' generica successiva (es. "INT.
  // ATTIVI V/CLIENTI" contiene "CLIENTI" ma e' un provento finanziario, non un
  // credito; "CLIENTI C/CAPARRE" contiene "CLIENTI" ma e' un debito) ---
  [/INT\.?\s*ATTIV|INTERESSI ATTIV|PROVENTI FINANZIAR/i, () => 'cee:C16'],
  [/INT\.?\s*PASSIV|INTERESSI PASSIV|ONERI FINANZIAR|SPESE.*BANCARI|COMMISSION.*BANCARI/i, () => 'cee:C17'],
  [/ACC\.?TO|ACCANTONAMENT/i, () => 'cee:B12'],
  [/ACCONT[IO]|CAPARR/i, () => 'sp:PAS_D_6'],

  // --- rettifiche di attivo: fondi ammortamento/svalutazione di un bene ---
  [
    /F[./]?\s*\/?\s*AMM/i,
    (d) => {
      if (/FABBRIC/i.test(d)) return 'sp:ATT_B_II_1'
      if (/IMPIANT/i.test(d)) return 'sp:ATT_B_II_2'
      if (/ATTREZZATUR/i.test(d)) return 'sp:ATT_B_II_3'
      if (/MACCH|ARREDAMENTO|BENI\s*(STRUMENTALI|INFERIORI)/i.test(d)) return 'sp:ATT_B_II_4'
      if (/SOFTWARE|LICENZ|CONCESSION|MARCHI/i.test(d)) return 'sp:ATT_B_I_4'
      if (/AVVIAMENTO/i.test(d)) return 'sp:ATT_B_I_5'
      return 'sp:ATT_B_I_7'
    },
  ],
  [/RISCHI SU CREDITI|SVALUTAZIONE CREDITI/i, () => 'sp:ATT_C_II_1'],

  // --- immobilizzazioni / attivo circolante ---
  [/FABBRIC/i, () => 'sp:ATT_B_II_1'],
  [/IMPIANT/i, () => 'sp:ATT_B_II_2'],
  [/ATTREZZATUR/i, () => 'sp:ATT_B_II_3'],
  [/MACCHINE ELETTROMEC|ARREDAMENTO|BENI\s*(STRUMENTALI|INFERIORI)/i, () => 'sp:ATT_B_II_4'],
  [/SOFTWARE|LICENZ|CONCESSION|MARCHI|BREVETT/i, () => 'sp:ATT_B_I_4'],
  [/AVVIAMENTO/i, () => 'sp:ATT_B_I_5'],
  [
    /PARTECIPAZ/i,
    (d) => {
      if (/CONTROLLAT/i.test(d)) return 'sp:ATT_B_III_1A'
      if (/COLLEGAT/i.test(d)) return 'sp:ATT_B_III_1B'
      if (/CONTROLLANT/i.test(d)) return 'sp:ATT_B_III_1C'
      return 'sp:ATT_B_III_1D'
    },
  ],
  [
    /FINANZIAMENTO.*(COLLEGAT|CONTROLLAT|CONTROLLANT)/i,
    (d) => {
      if (/CONTROLLANT/i.test(d)) return 'sp:ATT_B_III_2C'
      if (/CONTROLLAT/i.test(d)) return 'sp:ATT_B_III_2A'
      if (/COLLEGAT/i.test(d)) return 'sp:ATT_B_III_2B'
      return 'sp:ATT_B_III_2D'
    },
  ],
  [/CREDITI TRIBUTARI|ERARIO C\/CREDITO/i, () => 'sp:ATT_C_II_4B'],
  [/IMPOSTE ANTICIPATE/i, () => 'sp:ATT_C_II_4T'],
  [/CLIENT/i, () => 'sp:ATT_C_II_1'],
  [/C\/C\b|BANCARI|POSTALI|\bBANCA\b/i, () => 'sp:ATT_C_IV_1'],
  [/CASSA|DENARO/i, () => 'sp:ATT_C_IV_3'],
  [/RISCONTI ATTIV/i, () => 'sp:ATT_D_2'],
  [/RATEI ATTIV/i, () => 'sp:ATT_D_1'],

  // --- passivo / patrimonio netto ---
  [/CAPITALE SOCIALE/i, () => 'sp:PAS_A_I'],
  [/RISERVA LEGALE/i, () => 'sp:PAS_A_IV'],
  [/RISERV[EA] STATUTARI/i, () => 'sp:PAS_A_V'],
  [/ALTRE RISERVE/i, () => 'sp:PAS_A_VII'],
  [/UTIL[EI].*NUOVO|PERDIT[EA].*NUOVO/i, () => 'sp:PAS_A_VIII'],
  [/QUIESCENZ/i, () => 'sp:PAS_B_1'],
  [/F[./]?\s*\/?\s*DO?\s*RIS/i, () => 'sp:PAS_B_3'],
  [/\bT\.?F\.?R\.?\b|TRATTAMENTO.*FINE RAPPORTO/i, () => 'sp:PAS_C'],
  [/SOCI C\/FINANZIAMENT/i, () => 'sp:PAS_D_3'],
  [/BANCH[EA]|MUTU[IO]|FINANZIAMENT[IO] BANCAR/i, () => 'sp:PAS_D_4'],
  [/FORNITOR/i, () => 'sp:PAS_D_7'],
  [/ERARIO C\/IVA|ERARIO C\/IRES|ERARIO C\/RIT|DEBITI TRIBUTARI|ADDIZ\.?\s*IRPEF/i, () => 'sp:PAS_D_12'],
  [/\bINPS\b|\bINAIL\b|PREVIDENZ|ASSISTENZA INTEGRATIVA/i, () => 'sp:PAS_D_13'],
  [/RATEI PASSIV/i, () => 'sp:PAS_E_1'],
  [/RISCONTI PASSIV/i, () => 'sp:PAS_E_2'],
  [/DIPENDENTI C\/|COLLABORATORI C\/|AMMINISTRATORI C\/|DEBITI DIVERSI/i, () => 'sp:PAS_D_14'],

  // --- conto economico: ricavi ---
  [/RICAVI.*RECUPERO|RICAVI.*VENDIT|RICAVI.*PRESTAZ|RICAVI.*SERVIZI/i, () => 'cee:A1'],
  [/INCREMENTI IMMOBILIZZ|CAPIT\.?\s*DI\s*COSTI/i, () => 'cee:A4'],
  [/SOPRAVVENIENZ.*ATTIV|ABBUON.*ATTIV|PLUSVALENZ|RICAVI DIVERSI|ALTRI RICAVI/i, () => 'cee:A5'],

  // --- conto economico: costi ---
  [/IMPOSTA.*REDDITO|\bIRES\b|\bIRAP\b/i, () => 'cee:E20'],
  [/MATERIE PRIME|MATERIALE\s*(DI|MANUT)|CANCELLERIA/i, () => 'cee:B6'],
  [/GODIMENTO.*BENI.*TERZI|FITTI PASSIV|NOLEGGIO|LEASING|CANONE.*LOCAZ/i, () => 'cee:B8'],
  [/AMM\.?TO ORD|AMMORTAMENTO/i, () => 'cee:B10b'],
  [/ONERI DIVERSI|IMPOSTA DI BOLLO|\bIMU\b|MULTE|TASSA|QUOTE ASSOCIATIVE|DIRITTI CAMERALI/i, () => 'cee:B14'],
  [/COMP\.?|COMPENS|CONSULENZ|SERVIZI|SPESE\s*(LEGALI|POSTALI|TELEFON)/i, () => 'cee:B7'],
  [/SALARI|STIPEND|PERSONALE|ONERI SOCIALI/i, () => 'cee:B9a'],
]

function suggerisciVoce(descrizione) {
  const d = descrizione || ''
  for (const [pattern, risolvi] of REGOLE_SUGGERIMENTO) {
    if (pattern.test(d)) return risolvi(d)
  }
  return null
}

function trovaMappatura(conto, mappatureAzienda, mappatureGlobali) {
  const cl = (conto || '').toLowerCase()
  for (const m of mappatureAzienda) if (m.conto_origine.toLowerCase() === cl) return [m.voce_budget_descrizione, m.categoria, m.codice_cee]
  for (const m of mappatureGlobali) if (cl.includes(m.conto_origine.toLowerCase())) return [m.voce_budget_descrizione, m.categoria, m.codice_cee]
  return null
}

export default function Riclassificazione() {
  const [aziende, setAziende] = useState([])
  // Pmi 360°: l'azienda è quella attiva dell'app (niente selettore nella pagina)
  const { azienda: aziendaAttiva } = useApp()
  const aziendaId = aziendaAttiva?.id || ''
  const [documenti, setDocumenti] = useState([])
  const [documentoId, setDocumentoId] = useState('')
  const [analisi, setAnalisi] = useState(null)
  const [vociCEE, setVociCEE] = useState([])
  const [vociSP, setVociSP] = useState([])
  const [caricando, setCaricando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mappatureLocali, setMappatureLocali] = useState({})
  const [mappatureLocaliUnificato, setMappatureLocaliUnificato] = useState({})
  const [inModifica, setInModifica] = useState({})
  const [override, setOverride] = useState({})
  const [rimossi, setRimossi] = useState(new Set())
  const [usaCEE, setUsaCEE] = useState(true)
  // Libro Giornale/Prima Nota: mappature dell'azienda (gruppo o singolo conto) e
  // dati del documento, tenuti in stato per la vista "tutti i conti"
  const [mappatureAz, setMappatureAz] = useState([])
  const [mappatureGlob, setMappatureGlob] = useState([])
  const [datiDoc, setDatiDoc] = useState(null)
  const [aperti, setAperti] = useState(new Set())
  const [ricerca, setRicerca] = useState('')
  const [editConto, setEditConto] = useState({})
  const [abbinaAperto, setAbbinaAperto] = useState(false)
  const flagScritto = useRef(false)

  useEffect(() => {
    supabase
      .from('aziende')
      .select('id, nome')
      .order('nome')
      .then(({ data }) => setAziende(data || []))
    supabase
      .from('voci_cee')
      .select('*')
      .order('ordine')
      .then(({ data }) => setVociCEE((data || []).filter((v) => !v.totale)))
    supabase
      .from('voci_sp')
      .select('*')
      .order('ordine')
      .then(({ data }) => setVociSP((data || []).filter((v) => !v.totale)))
  }, [])

  const resetStato = () => {
    setAnalisi(null)
    setDocumentoId('')
    setMappatureLocali({})
    setMappatureLocaliUnificato({})
    setInModifica({})
    setOverride({})
    setRimossi(new Set())
    setMappatureAz([])
    setMappatureGlob([])
    setDatiDoc(null)
    setAperti(new Set())
    setRicerca('')
    setEditConto({})
  }

  useEffect(() => {
    if (aziendaId) {
      supabase
        .from('documenti')
        .select('*')
        .eq('azienda_id', aziendaId)
        .in('tipo_documento', ['provvisorio', 'bilancio', ...TIPI_LIBRO_GIORNALE])
        .eq('stato', 'elaborato')
        .then(({ data }) => setDocumenti(data || []))
      resetStato()
    }
  }, [aziendaId])

  const analizza = async () => {
    if (!documentoId) return
    setCaricando(true)
    try {
      const { data: doc } = await supabase.from('documenti').select('*').eq('id', documentoId).single()
      const dati = JSON.parse(doc.dati_estratti)

      const { data: mappatureAzienda } = await supabase.from('mappature_conti').select('*').eq('azienda_id', aziendaId).eq('globale', false)
      const { data: mappatureGlobali } = await supabase.from('mappature_conti').select('*').eq('globale', true)

      const mappati = []
      const nonMappati = []
      const processa = (voci, categoriaDefault) => {
        for (const v of voci || []) {
          const importo = Math.abs(v.importo || 0)
          if (importo === 0) continue
          const conto = v.gruppo || v.descrizione || ''
          const etichetta = v.gruppo ? `${v.gruppo} — ${v.descrizione || ''}` : conto
          const risultato = trovaMappatura(conto, mappatureAzienda || [], mappatureGlobali || [])
          if (risultato) mappati.push({ conto, etichetta, categoria: risultato[1], importo, voce_budget: risultato[0], codice_cee: risultato[2] })
          else nonMappati.push({ conto, etichetta, descrizioneOriginale: v.descrizione || conto, categoria: categoriaDefault, importo, suggerimento: categoriaDefault === null ? suggerisciVoce(v.descrizione) : null })
        }
      }
      if (TIPI_LIBRO_GIORNALE.includes(doc.tipo_documento)) {
        // Nessuna categoria "di partenza": ogni gruppo puo' essere attivita',
        // passivita', costo o ricavo — la distinzione la fa solo la mappatura.
        processa(dati.gruppi, null)
      } else {
        processa(dati.ricavi?.voci, 'ricavi')
        processa(dati.costi?.voci, 'costi')
      }

      const { data: budget } = await supabase.from('budget').select('*').eq('azienda_id', aziendaId).eq('anno', doc.anno).limit(1).maybeSingle()
      let vociBudget = []
      if (budget) {
        const { data: voci } = await supabase.from('budget_voci').select('descrizione, categoria').eq('budget_id', budget.id)
        const visti = new Set()
        vociBudget = (voci || []).filter((v) => {
          const key = `${v.descrizione}|${v.categoria}`
          if (visti.has(key)) return false
          visti.add(key)
          return true
        })
      }

      const suggerimentiIniziali = {}
      for (const c of nonMappati) if (c.suggerimento) suggerimentiIniziali[c.conto] = c.suggerimento

      // Libro Giornale/Prima Nota: un documento e' "gia' riclassificato" se l'utente
      // ha gia' salvato almeno una scelta su di esso (riclassificato_il), oppure —
      // per i documenti lavorati prima che questo segno esistesse — se tutti i
      // suoi gruppi risultano gia' classificati. In quel caso si mostrano tutti i
      // conti, per poter correggere quelli che vanno su una voce diversa.
      const eLibroGiornale = TIPI_LIBRO_GIORNALE.includes(doc.tipo_documento)
      const giaRiclassificato = eLibroGiornale && (!!dati.riclassificato_il || (nonMappati.length === 0 && mappati.length > 0))
      const esisteRiclassificazioneAzienda = eLibroGiornale && !giaRiclassificato && (mappatureAzienda || []).length > 0
      setMappatureAz(mappatureAzienda || [])
      setMappatureGlob(mappatureGlobali || [])
      setDatiDoc(eLibroGiornale ? dati : null)
      flagScritto.current = false
      setAperti(new Set())
      setRicerca('')
      setEditConto({})
      setAnalisi({ mappati, non_mappati: nonMappati, voci_budget: vociBudget, eLibroGiornale, giaRiclassificato, esisteRiclassificazioneAzienda })
      setMappatureLocali({})
      setMappatureLocaliUnificato(suggerimentiIniziali)
      setInModifica({})
      setOverride({})
      setRimossi(new Set())
    } finally {
      setCaricando(false)
    }
  }

  // Ricorda sul documento (dentro dati_estratti, senza modifiche allo schema) che
  // l'utente lo ha gia' riclassificato: alle aperture successive mostra tutti i conti.
  const segnaRiclassificato = async () => {
    if (!datiDoc || datiDoc.riclassificato_il || flagScritto.current) return
    flagScritto.current = true
    const nuoviDati = { ...datiDoc, riclassificato_il: new Date().toISOString() }
    setDatiDoc(nuoviDati)
    await supabase.from('documenti').update({ dati_estratti: JSON.stringify(nuoviDati) }).eq('id', documentoId)
  }

  const salvaMappatura = async (conto, voce, categoria, codiceCee) => {
    setSalvando(true)
    try {
      await supabase.from('mappature_conti').delete().eq('azienda_id', aziendaId).eq('conto_origine', conto).eq('globale', false)
      const { error } = await supabase.from('mappature_conti').insert({
        id: crypto.randomUUID(),
        azienda_id: aziendaId,
        conto_origine: conto,
        voce_budget_descrizione: voce,
        categoria,
        codice_cee: codiceCee || null,
        globale: false,
        creata_il: new Date().toISOString(),
      })
      if (!error) {
        setMappatureAz((prev) => [
          ...prev.filter((m) => m.conto_origine !== conto),
          { azienda_id: aziendaId, conto_origine: conto, voce_budget_descrizione: voce, categoria, codice_cee: codiceCee || null, globale: false },
        ])
        segnaRiclassificato()
        setOverride((prev) => ({ ...prev, [conto]: { voce, categoria, codice_cee: codiceCee || null } }))
        setRimossi((prev) => {
          const n = new Set(prev)
          n.delete(conto)
          return n
        })
        setInModifica((prev) => {
          const n = { ...prev }
          delete n[conto]
          return n
        })
        setMappatureLocali((prev) => {
          const n = { ...prev }
          delete n[conto]
          return n
        })
        setMappatureLocaliUnificato((prev) => {
          const n = { ...prev }
          delete n[conto]
          return n
        })
      }
    } finally {
      setSalvando(false)
    }
  }

  // Libro Giornale/Prima Nota: i gruppi non hanno una categoria di partenza,
  // possono essere attivita'/passivita' (schema di Stato Patrimoniale, art. 2424
  // c.c.) o ricavi/costi (schema CEE, come per il provvisorio) — un'unica
  // tendina con tutte le voci evita di doverne mostrare due separate.
  const confermaUnificato = (conto) => {
    const valore = mappatureLocaliUnificato[conto]
    if (!valore) return
    const [tipoScelta, codice] = valore.split(':')
    if (tipoScelta === 'sp') {
      const v = vociSP.find((x) => x.codice === codice)
      if (v) salvaMappatura(conto, v.descrizione.trim(), v.tipo, v.codice)
    } else {
      const v = vociCEE.find((x) => x.codice === codice)
      if (v) salvaMappatura(conto, v.descrizione, v.tipo === 'ricavo' ? 'ricavi' : 'costi', v.codice)
    }
  }

  const eliminaMappatura = async (conto) => {
    if (!window.confirm(`Eliminare la mappatura per "${conto}"?`)) return
    setSalvando(true)
    try {
      await supabase.from('mappature_conti').delete().eq('azienda_id', aziendaId).eq('conto_origine', conto).eq('globale', false)
      setMappatureAz((prev) => prev.filter((m) => m.conto_origine !== conto))
      segnaRiclassificato()
      setRimossi((prev) => new Set([...prev, conto]))
      setOverride((prev) => {
        const n = { ...prev }
        delete n[conto]
        return n
      })
      setInModifica((prev) => {
        const n = { ...prev }
        delete n[conto]
        return n
      })
    } finally {
      setSalvando(false)
    }
  }

  const categoriaPerVoce = (voce, categoriaDefault) => {
    if (usaCEE) return vociCEE.find((v) => v.descrizione === voce)?.tipo === 'ricavo' ? 'ricavi' : 'costi'
    return analisi.voci_budget.find((v) => v.descrizione === voce)?.categoria || categoriaDefault
  }

  const salvaTutte = async () => {
    if (!analisi) return
    setSalvando(true)
    try {
      for (const conto of nonMappatiVisibili) {
        const voce = mappatureLocali[conto.conto]
        const unificato = mappatureLocaliUnificato[conto.conto]
        if (voce) {
          const cat = categoriaPerVoce(voce, conto.categoria)
          // eslint-disable-next-line no-await-in-loop
          await salvaMappatura(conto.conto, voce, cat)
        } else if (unificato) {
          const [tipoScelta, codice] = unificato.split(':')
          if (tipoScelta === 'sp') {
            const v = vociSP.find((x) => x.codice === codice)
            // eslint-disable-next-line no-await-in-loop
            if (v) await salvaMappatura(conto.conto, v.descrizione.trim(), v.tipo, v.codice)
          } else {
            const v = vociCEE.find((x) => x.codice === codice)
            // eslint-disable-next-line no-await-in-loop
            if (v) await salvaMappatura(conto.conto, v.descrizione, v.tipo === 'ricavo' ? 'ricavi' : 'costi', v.codice)
          }
        }
      }
    } finally {
      setSalvando(false)
    }
  }

  const voceAttuale = (conto) => (override[conto.conto] ? override[conto.conto].voce : conto.voce_budget)
  const codiceAttuale = (conto) => (override[conto.conto] ? override[conto.conto].codice_cee : conto.codice_cee)
  const isCategoriaSP = (cat) => cat === 'attivita' || cat === 'passivita'

  const mappatiVisibili = (analisi?.mappati || []).filter((c) => !rimossi.has(c.conto))
  const contiRimossi = (analisi?.mappati || [])
    .filter((c) => rimossi.has(c.conto))
    .map((c) => ({ conto: c.conto, etichetta: c.etichetta, descrizioneOriginale: c.etichetta, categoria: c.categoria, importo: c.importo }))
  const nonMappatiVisibili = [...(analisi?.non_mappati || []).filter((c) => !override[c.conto]), ...contiRimossi]

  const vociAttivo = vociSP.filter((v) => v.tipo === 'attivita')
  const vociPassivo = vociSP.filter((v) => v.tipo === 'passivita')

  // Formatta il codice come nello schema ufficiale (es. "B9a" -> "B.9.a",
  // "ATT_B_III_1A" -> "B.III.1.a"): lettera di sezione, numero, sotto-lettera.
  const codiceLeggibile = (codice) =>
    (codice || '')
      .replace(/^(ATT_|PAS_)/, '')
      .replace(/_/g, '.')
      .replace(/^([A-Z]+)(\d)/, '$1.$2')
      .replace(/(\d)([A-Za-z])$/, (_, d, l) => `${d}.${l.toLowerCase()}`)

  const renderSelectSP = (value, onChange) => (
    <select className="form-control" style={{ flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Seleziona voce patrimoniale...</option>
      <optgroup label="ATTIVO">
        {vociAttivo.map((v) => (
          <option key={v.codice} value={v.codice}>
            {codiceLeggibile(v.codice)} — {v.descrizione.trim()}
          </option>
        ))}
      </optgroup>
      <optgroup label="PASSIVO">
        {vociPassivo.map((v) => (
          <option key={v.codice} value={v.codice}>
            {codiceLeggibile(v.codice)} — {v.descrizione.trim()}
          </option>
        ))}
      </optgroup>
    </select>
  )

  const vociRicavi = vociCEE.filter((v) => v.tipo === 'ricavo')
  const vociCosti = vociCEE.filter((v) => v.tipo === 'costo')
  const vociFinanziarie = vociCEE.filter((v) => v.tipo === 'finanziario')

  const renderSelect = (value, onChange) => (
    <select className="form-control" style={{ flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Seleziona voce...</option>
      {usaCEE ? (
        <>
          <optgroup label="A — RICAVI">
            {vociRicavi.map((v) => (
              <option key={v.codice} value={v.descrizione}>
                {codiceLeggibile(v.codice)} — {v.descrizione}
              </option>
            ))}
          </optgroup>
          <optgroup label="B — COSTI">
            {vociCosti.map((v) => (
              <option key={v.codice} value={v.descrizione}>
                {codiceLeggibile(v.codice)} — {v.descrizione}
              </option>
            ))}
          </optgroup>
          <optgroup label="C/D — FINANZIARI">
            {vociFinanziarie.map((v) => (
              <option key={v.codice} value={v.descrizione}>
                {codiceLeggibile(v.codice)} — {v.descrizione}
              </option>
            ))}
          </optgroup>
        </>
      ) : (
        <>
          <optgroup label="RICAVI">
            {(analisi?.voci_budget || [])
              .filter((v) => v.categoria === 'ricavi')
              .map((v) => (
                <option key={v.descrizione} value={v.descrizione}>
                  {v.descrizione}
                </option>
              ))}
          </optgroup>
          <optgroup label="COSTI">
            {(analisi?.voci_budget || [])
              .filter((v) => v.categoria === 'costi')
              .map((v) => (
                <option key={v.descrizione} value={v.descrizione}>
                  {v.descrizione}
                </option>
              ))}
          </optgroup>
        </>
      )}
    </select>
  )

  // Libro Giornale/Prima Nota: un'unica tendina con tutte le voci possibili
  // (Attivo/Passivo per lo Stato Patrimoniale, Ricavi/Costi per il Conto
  // Economico), invece di due tendine separate — un gruppo puo' finire in una
  // sola di queste categorie, non serve scegliere prima lo schema.
  const renderSelectUnificato = (value, onChange) => (
    <select className="form-control" style={{ flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Seleziona voce...</option>
      <optgroup label="ATTIVO">
        {vociAttivo.map((v) => (
          <option key={`sp:${v.codice}`} value={`sp:${v.codice}`}>
            {codiceLeggibile(v.codice)} — {v.descrizione.trim()}
          </option>
        ))}
      </optgroup>
      <optgroup label="PASSIVO">
        {vociPassivo.map((v) => (
          <option key={`sp:${v.codice}`} value={`sp:${v.codice}`}>
            {codiceLeggibile(v.codice)} — {v.descrizione.trim()}
          </option>
        ))}
      </optgroup>
      <optgroup label="A — RICAVI">
        {vociRicavi.map((v) => (
          <option key={`cee:${v.codice}`} value={`cee:${v.codice}`}>
            {codiceLeggibile(v.codice)} — {v.descrizione}
          </option>
        ))}
      </optgroup>
      <optgroup label="B — COSTI">
        {vociCosti.map((v) => (
          <option key={`cee:${v.codice}`} value={`cee:${v.codice}`}>
            {codiceLeggibile(v.codice)} — {v.descrizione}
          </option>
        ))}
      </optgroup>
      <optgroup label="C/D — FINANZIARI">
        {vociFinanziarie.map((v) => (
          <option key={`cee:${v.codice}`} value={`cee:${v.codice}`}>
            {codiceLeggibile(v.codice)} — {v.descrizione}
          </option>
        ))}
      </optgroup>
    </select>
  )


  // ---- Libro Giornale/Prima Nota, vista "tutti i conti" (documento gia' riclassificato) ----
  const parseUnificato = (valore) => {
    const [tipoScelta, codice] = (valore || '').split(':')
    if (tipoScelta === 'sp') {
      const v = vociSP.find((x) => x.codice === codice)
      return v ? { voce: v.descrizione.trim(), categoria: v.tipo, codice: v.codice } : null
    }
    const v = vociCEE.find((x) => x.codice === codice)
    return v ? { voce: v.descrizione, categoria: v.tipo === 'ricavo' ? 'ricavi' : 'costi', codice: v.codice } : null
  }
  const valoreUnificato = (m) => (m?.codice_cee ? `${m.categoria === 'attivita' || m.categoria === 'passivita' ? 'sp' : 'cee'}:${m.codice_cee}` : '')
  const etichettaMappatura = (m) => (m ? `${m.codice_cee ? `${codiceLeggibile(m.codice_cee)} — ` : ''}${m.voce_budget_descrizione}` : null)
  const chiudiEdit = (key) =>
    setEditConto((prev) => {
      const n = { ...prev }
      delete n[key]
      return n
    })

  // Scelta di una voce per un singolo conto: se coincide con quella del suo
  // gruppo non serve alcuna eccezione (si toglie quella eventuale), altrimenti
  // si salva un'eccezione con conto_origine = codice conto completo, che ha la
  // precedenza sul gruppo in tutti i report (vedi lib/mappatureConti.js).
  const salvaVoceConto = async (c, gruppo, valore) => {
    const nuova = parseUnificato(valore)
    if (!nuova) return
    const gm = risolviMappatura(gruppo, mappatureAz, mappatureGlob, gruppo)?.mappatura
    if (gm && gm.codice_cee === nuova.codice && gm.categoria === nuova.categoria) {
      await rimuoviEccezioneConto(c.conto, false)
    } else {
      await salvaMappatura(c.conto, nuova.voce, nuova.categoria, nuova.codice)
    }
    chiudiEdit(`c:${c.conto}`)
  }

  const rimuoviEccezioneConto = async (conto, conferma = true) => {
    if (conferma && !window.confirm(`Riportare il conto ${conto} alla voce del suo gruppo?`)) return
    setSalvando(true)
    try {
      await supabase.from('mappature_conti').delete().eq('azienda_id', aziendaId).eq('conto_origine', conto).eq('globale', false)
      setMappatureAz((prev) => prev.filter((m) => m.conto_origine !== conto))
      segnaRiclassificato()
    } finally {
      setSalvando(false)
    }
  }

  const salvaVoceGruppo = async (gruppo, valore) => {
    const nuova = parseUnificato(valore)
    if (!nuova) return
    await salvaMappatura(gruppo, nuova.voce, nuova.categoria, nuova.codice)
    chiudiEdit(`g:${gruppo}`)
  }

  const renderEditor = (key, valoreAttuale, onSalva) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {renderSelectUnificato(editConto[key], (v) => setEditConto((prev) => ({ ...prev, [key]: v })))}
      <button className="btn btn-outline btn-sm" disabled={!editConto[key] || salvando} onClick={() => onSalva(editConto[key])}>
        ✓
      </button>
      <button className="btn btn-outline btn-sm" onClick={() => chiudiEdit(key)}>
        ✕
      </button>
    </div>
  )

  const renderDettaglioConti = () => {
    const q = ricerca.trim().toLowerCase()
    const gruppi = (datiDoc?.gruppi || []).filter((g) => (g.importo || 0) !== 0 || (g.conti || []).some((c) => (c.valore || 0) !== 0))
    const righe = gruppi
      .map((g) => {
        const gm = risolviMappatura(g.gruppo, mappatureAz, mappatureGlob, g.gruppo)
        const conti = (g.conti?.length ? g.conti : [{ conto: g.gruppo, descrizione: g.descrizione, valore: g.importo }])
          .filter((c) => (c.valore || 0) !== 0)
          .map((c) => ({ ...c, risolto: risolviMappatura(c.conto, mappatureAz, mappatureGlob, g.gruppo) }))
        const gruppoCorrisponde = q && `${g.gruppo} ${g.descrizione}`.toLowerCase().includes(q)
        const contiFiltrati = q && !gruppoCorrisponde ? conti.filter((c) => `${c.conto} ${c.descrizione}`.toLowerCase().includes(q)) : conti
        return { g, gm, conti, contiFiltrati }
      })
      .filter((r) => !q || r.contiFiltrati.length > 0)

    return (
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: 16, background: '#e6f4ea', borderBottom: '1px solid #bbf7d0' }}>
          <h3 style={{ margin: 0, color: '#1a6b2e' }}>✅ Tutti i conti ({righe.reduce((n, r) => n + r.conti.length, 0)})</h3>
          <p style={{ fontSize: 12, color: '#1a6b2e', margin: '4px 0 10px' }}>
            Questo documento è già stato riclassificato: puoi cambiare la voce di un intero gruppo o di un singolo conto. La scelta su un conto ha la precedenza su quella del
            suo gruppo e vale anche nei documenti dei mesi successivi.
          </p>
          <input className="form-control" placeholder="Cerca per codice o descrizione del conto..." value={ricerca} onChange={(e) => setRicerca(e.target.value)} />
        </div>
        {righe.map(({ g, gm, conti, contiFiltrati }) => {
          const aperto = aperti.has(g.gruppo) || !!q
          const nEccezioni = conti.filter((c) => c.risolto?.livello === 'conto').length
          const keyG = `g:${g.gruppo}`
          return (
            <div key={g.gruppo} style={{ borderBottom: '1px solid #f0f2f5' }}>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#fafbfc' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setAperti((prev) => {
                      const n = new Set(prev)
                      if (n.has(g.gruppo)) n.delete(g.gruppo)
                      else n.add(g.gruppo)
                      return n
                    })
                  }
                >
                  {aperto ? '▾' : '▸'}
                </button>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {g.gruppo} — {g.descrizione}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55 }}>
                    {conti.length} conti — €{fmt(g.importo)}
                    {nEccezioni > 0 && <span style={{ color: '#b45309' }}> — {nEccezioni} con voce diversa dal gruppo</span>}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  {editConto[keyG] !== undefined ? (
                    renderEditor(keyG, valoreUnificato(gm?.mappatura), (v) => salvaVoceGruppo(g.gruppo, v))
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: gm ? '#6b7280' : '#b45309', fontSize: 13 }}>{gm ? `→ ${etichettaMappatura(gm.mappatura)}` : '→ gruppo da classificare'}</span>
                      <button className="btn btn-outline btn-sm" title="Cambia la voce di tutto il gruppo" onClick={() => setEditConto((prev) => ({ ...prev, [keyG]: valoreUnificato(gm?.mappatura) }))}>
                        ✏️
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {aperto &&
                contiFiltrati.map((c) => {
                  const keyC = `c:${c.conto}`
                  const eccezione = c.risolto?.livello === 'conto'
                  return (
                    <div key={c.conto} style={{ padding: '8px 16px 8px 56px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #f0f2f5', background: eccezione ? '#fffbeb' : '#fff' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 13 }}>{c.descrizione || c.conto}</div>
                        <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55 }}>
                          {c.conto} — €{fmt(c.valore)}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        {editConto[keyC] !== undefined ? (
                          renderEditor(keyC, valoreUnificato(c.risolto?.mappatura), (v) => salvaVoceConto(c, g.gruppo, v))
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: c.risolto ? '#6b7280' : '#b45309', fontSize: 13 }}>{c.risolto ? `→ ${etichettaMappatura(c.risolto.mappatura)}` : '→ da classificare'}</span>
                            {eccezione && <span className="badge badge-warning">diverso dal gruppo</span>}
                            <button className="btn btn-outline btn-sm" onClick={() => setEditConto((prev) => ({ ...prev, [keyC]: valoreUnificato(c.risolto?.mappatura) }))}>
                              ✏️
                            </button>
                            {eccezione && (
                              <button className="btn btn-danger btn-sm" title="Riporta alla voce del gruppo" onClick={() => rimuoviEccezioneConto(c.conto)}>
                                ↩
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#1a3a5c', marginTop: 0 }}>Riclassificazione</h2>
          <p style={{ color: '#666', marginTop: -8, marginBottom: 20 }}>Collega i conti del provvisorio alle voci CEE o del budget</p>
        </div>
        <button className="btn btn-outline" disabled={!aziendaId || !vociSP.length} onClick={() => setAbbinaAperto(true)} title="Propone la classificazione dei gruppi di conto da un bilancio analitico caricato in Documenti contabili">
          📑 Abbina dal documento
        </button>
      </div>
      {abbinaAperto && (
        <AbbinaDaDocumento
          aziendaId={aziendaId}
          vociSP={vociSP}
          vociCEE={vociCEE}
          codiceLeggibile={codiceLeggibile}
          renderSelectUnificato={renderSelectUnificato}
          onChiudi={() => setAbbinaAperto(false)}
          onApplicato={async (nuove) => {
            const gruppi = new Set(nuove.map((m) => m.conto_origine))
            setMappatureAz((prev) => [...prev.filter((m) => !gruppi.has(m.conto_origine)), ...nuove])
            setAbbinaAperto(false)
            // se un documento e' aperto, si rilegge con le nuove classificazioni
            if (documentoId) { await segnaRiclassificato(); await analizza() }
          }}
        />
      )}

      <div className="card" style={{ marginBottom: 20 }}>
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
              <label className="form-label">Provvisorio/bilancio elaborato</label>
              <select className="form-control" value={documentoId} onChange={(e) => setDocumentoId(e.target.value)} disabled={!aziendaId || documenti.length === 0}>
                <option value="">Seleziona documento...</option>
                {documenti.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome_file} — {d.anno}
                    {d.mese_fine ? ` (fino a ${MESI[d.mese_fine - 1]})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ display: 'block' }}>
                Schema
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={`btn btn-sm ${usaCEE ? 'btn-primary' : 'btn-outline'}`} onClick={() => setUsaCEE(true)}>
                  CEE
                </button>
                <button className={`btn btn-sm ${!usaCEE ? 'btn-primary' : 'btn-outline'}`} onClick={() => setUsaCEE(false)}>
                  Budget
                </button>
              </div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={analizza} disabled={!documentoId || caricando}>
            {caricando ? 'Analizzando...' : '🔍 Analizza conti'}
          </button>
        </div>
      </div>

      {analisi && (
        <>
          {analisi.esisteRiclassificazioneAzienda && (
            <div className="alert" style={{ marginBottom: 20, background: '#e8f1fb', color: '#1a3a5c', border: '1px solid #bcd4f0' }}>
              Per questa azienda esiste già una riclassificazione: è stata applicata come suggerimento ai gruppi già noti (verifica l'elenco qui sotto). Restano da classificare
              solo i gruppi nuovi; i conti nuovi di un gruppo già classificato ne ereditano la voce.
            </div>
          )}
          {analisi.giaRiclassificato && renderDettaglioConti()}
          {nonMappatiVisibili.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ padding: 16, background: '#fff1e6', borderBottom: '1px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#854f0b' }}>⚠️ Conti da mappare ({nonMappatiVisibili.length})</h3>
                  <p style={{ fontSize: 12, color: '#854f0b', marginTop: 4 }}>
                    Schema attivo: <strong>{usaCEE ? 'Struttura CEE' : 'Voci Budget'}</strong>
                  </p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={salvaTutte} disabled={salvando}>
                  {salvando ? 'Salvando...' : '💾 Salva tutte'}
                </button>
              </div>
              <div>
                {nonMappatiVisibili.map((c) => (
                  <div key={c.conto} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid #f0f2f5' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.etichetta || c.conto}</div>
                      <div style={{ fontSize: 12.5, color: '#5f6b7a', lineHeight: 1.55 }}>
                        {c.categoria ? `${LABEL_CATEGORIA[c.categoria] || c.categoria}` : 'categoria da assegnare'} — €{fmt(c.importo)}
                      </div>
                    </div>
                    {c.categoria === null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#9ca3af' }}>→</span>
                          {renderSelectUnificato(mappatureLocaliUnificato[c.conto] || '', (v) => setMappatureLocaliUnificato((prev) => ({ ...prev, [c.conto]: v })))}
                          <button className="btn btn-outline btn-sm" disabled={!mappatureLocaliUnificato[c.conto] || salvando} onClick={() => confermaUnificato(c.conto)}>
                            ✓
                          </button>
                        </div>
                        {c.suggerimento && mappatureLocaliUnificato[c.conto] === c.suggerimento && (
                          <span style={{ fontSize: 10, color: '#b45309', marginLeft: 24 }}>💡 suggerito dalla descrizione — verifica prima di confermare</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220 }}>
                        <span style={{ color: '#9ca3af' }}>→</span>
                        {renderSelect(mappatureLocali[c.conto] || '', (v) => setMappatureLocali((prev) => ({ ...prev, [c.conto]: v })))}
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={!mappatureLocali[c.conto] || salvando}
                          onClick={() => {
                            const voce = mappatureLocali[c.conto]
                            salvaMappatura(c.conto, voce, categoriaPerVoce(voce, c.categoria))
                          }}
                        >
                          ✓
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!analisi.giaRiclassificato && mappatiVisibili.length > 0 && (
            <div className="card">
              <div style={{ padding: 16, background: '#e6f4ea', borderBottom: '1px solid #bbf7d0' }}>
                <h3 style={{ margin: 0, color: '#1a6b2e' }}>✅ Conti mappati ({mappatiVisibili.length})</h3>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Conto provvisorio</th>
                    <th>Cat.</th>
                    <th style={{ textAlign: 'right' }}>Importo</th>
                    <th>Voce</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {mappatiVisibili.map((c) => (
                    <tr key={c.conto}>
                      <td style={{ fontWeight: 600 }}>{c.etichetta || c.conto}</td>
                      <td>
                        {(() => {
                          const cat = override[c.conto]?.categoria || c.categoria
                          return <span className={`badge ${BADGE_CATEGORIA[cat] || 'badge-danger'}`}>{LABEL_CATEGORIA[cat] || cat}</span>
                        })()}
                      </td>
                      <td style={{ textAlign: 'right' }}>€{fmt(c.importo)}</td>
                      <td>
                        {inModifica[c.conto] !== undefined ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isCategoriaSP(override[c.conto]?.categoria || c.categoria)
                              ? renderSelectSP(inModifica[c.conto], (v) => setInModifica((prev) => ({ ...prev, [c.conto]: v })))
                              : renderSelect(inModifica[c.conto], (v) => setInModifica((prev) => ({ ...prev, [c.conto]: v })))}
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={!inModifica[c.conto] || salvando}
                              onClick={() => {
                                if (isCategoriaSP(override[c.conto]?.categoria || c.categoria)) {
                                  const voceSP = vociSP.find((v) => v.codice === inModifica[c.conto])
                                  if (voceSP) salvaMappatura(c.conto, voceSP.descrizione.trim(), voceSP.tipo, voceSP.codice)
                                } else {
                                  const voce = inModifica[c.conto]
                                  salvaMappatura(c.conto, voce, categoriaPerVoce(voce, c.categoria))
                                }
                              }}
                            >
                              ✓
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() =>
                                setInModifica((prev) => {
                                  const n = { ...prev }
                                  delete n[c.conto]
                                  return n
                                })
                              }
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>
                            → {codiceAttuale(c) ? `${codiceLeggibile(codiceAttuale(c))} — ` : ''}
                            {voceAttuale(c)}
                          </span>
                        )}
                      </td>
                      <td>
                        {inModifica[c.conto] === undefined && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() =>
                                setInModifica((prev) => ({
                                  ...prev,
                                  [c.conto]: isCategoriaSP(override[c.conto]?.categoria || c.categoria) ? codiceAttuale(c) || '' : voceAttuale(c),
                                }))
                              }
                            >
                              ✏️
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => eliminaMappatura(c.conto)}>
                              🗑
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!analisi.giaRiclassificato && nonMappatiVisibili.length === 0 && mappatiVisibili.length > 0 && <div className="alert alert-success">🎉 Tutti i conti sono mappati sulla struttura {usaCEE ? 'CEE' : 'Budget'}!</div>}
        </>
      )}
    </div>
  )
}
