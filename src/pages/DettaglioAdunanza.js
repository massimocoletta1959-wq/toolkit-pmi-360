import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'

const EDGE_EMAIL = 'https://vwbixmbbcutjcplskjvg.supabase.co/functions/v1/invia-email'

const ORGANO_LABEL = {
  cda: 'Consiglio di Amministrazione', amministratore_unico: 'Amministratore Unico',
  comitato: 'Comitato', collegio_sindacale: 'Collegio Sindacale', assemblea: 'Assemblea dei Soci', altro: 'Organo',
}
const ESITO_STYLE = {
  approvata: { background: '#E9F7EF', color: '#1E8449' },
  respinta:  { background: '#FDEDEC', color: '#C0392B' },
  rinviata:  { background: '#FEF9E7', color: '#856404' },
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function DettaglioAdunanza() {
  const { azienda, setPage, adunanzaId } = useApp()
  const [caricata, setCaricata] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState(null)
  const [soloLettura, setSoloLettura] = useState(false)

  const [ad, setAd] = useState(null)         // testata adunanza
  const [organo, setOrgano] = useState(null)
  const [punti, setPunti] = useState([])     // [{titolo, relatore, con_delibera}]
  const [delibere, setDelibere] = useState([]) // [{id, oggetto, testo, favorevoli, contrari, astenuti, esito}]
  const [voti, setVoti] = useState([])         // voti nominativi delle delibere di questa adunanza
  const [presenze, setPresenze] = useState([]) // presenza/delega dei soci (solo assemblea)
  const [verbale, setVerbale] = useState('')
  const [modelli, setModelli] = useState([])       // modelli di verbale dell'azienda
  const [templateId, setTemplateId] = useState('') // modello selezionato
  const [componenti, setComponenti] = useState([]) // membri dell'organo (per circolarizzare)
  const [ticketCirc, setTicketCirc] = useState([]) // ticket di questa adunanza (tracciamento)
  const [delibRichiamate, setDelibRichiamate] = useState([]) // delibere preparate richiamate in trattazione
  const [delibDisponibili, setDelibDisponibili] = useState([]) // delibere preparate richiamabili
  const [circMsg, setCircMsg] = useState(null)

  // Carica i modelli di verbale dell'azienda
  useEffect(() => {
    (async () => {
      if (!azienda?.id) return
      const { data } = await supabase.from('verbale_template').select('id,nome,corpo_html,organo_tipo,predefinito').eq('azienda_id', azienda.id).order('created_at')
      setModelli(data || [])
    })()
  }, [azienda])

  // Carica adunanza + organo + punti + delibere
  useEffect(() => {
    (async () => {
      if (!adunanzaId) { setCaricata(true); return }
      const { data: a } = await supabase.from('adunanze').select('*').eq('id', adunanzaId).single()
      if (!a) { setCaricata(true); return }
      setAd(a)
      setVerbale(a.verbale_html || '')
      setTemplateId(a.template_id || '')
      if (a.stato === 'verbalizzata' || a.stato === 'annullata') setSoloLettura(true)

      const { data: org } = await supabase.from('organi').select('*').eq('id', a.organo_id).single()
      setOrgano(org || null)

      // Delibere preparate richiamate in questa seduta + quelle richiamabili
      await caricaDelibere(org)

      // componenti dell'organo (per circolarizzare ai membri, e per i voti nominativi)
      const { data: comp } = await supabase.from('organo_membri')
        .select('membro_id, ruolo, quota, membri(nome,cognome,email)').eq('organo_id', a.organo_id)
      setComponenti(comp || [])

      // ticket già circolarizzati per questa adunanza (tracciamento)
      await caricaTicket()

      const { data: pp } = await supabase.from('adunanza_punti').select('*').eq('adunanza_id', adunanzaId).order('ordine')
      setPunti((pp || []).map(p => ({ titolo: p.titolo, relatore: p.relatore || '', con_delibera: p.con_delibera })))

      const { data: dd } = await supabase.from('delibere').select('*').eq('adunanza_id', adunanzaId).order('created_at')
      setDelibere((dd || []).map(d => ({
        id: d.id, oggetto: d.oggetto, testo: d.testo || '', favorevoli: d.favorevoli, contrari: d.contrari,
        astenuti: d.astenuti, esito: d.esito, area_231: d.area_231 || '',
      })))
      const idDelibere = (dd || []).map(d => d.id)
      if (idDelibere.length) {
        const { data: vv } = await supabase.from('voti').select('*').in('delibera_id', idDelibere)
        setVoti(vv || [])
      } else setVoti([])

      const { data: pr } = await supabase.from('adunanza_presenze').select('*').eq('adunanza_id', adunanzaId)
      setPresenze(pr || [])

      setCaricata(true)
    })()
  }, [adunanzaId])

  const setTestata = (k, v) => setAd(a => ({ ...a, [k]: v }))

  // Carica le delibere richiamate in questa seduta e quelle richiamabili
  async function caricaDelibere(org) {
    if (!adunanzaId || !azienda?.id) return
    // richiamate: legami di questa adunanza + dati della determina
    const { data: legami } = await supabase.from('adunanza_delibere')
      .select('*, determine(oggetto, tipo, organo, stato, numero, anno)')
      .eq('adunanza_id', adunanzaId).order('ordine')
    setDelibRichiamate(legami || [])

    // organi da cui questa seduta può richiamare (regola: stesso organo,
    // + l'assemblea può richiamare anche cda e amministratore_unico)
    const tipo = org?.tipo || organo?.tipo
    let organiAmmessi = [tipo]
    if (tipo === 'assemblea') organiAmmessi = ['assemblea', 'cda', 'amministratore_unico']

    // disponibili: determine dell'azienda con organo ammesso, non già richiamate qui
    const giaRichiamate = new Set((legami || []).map(l => l.determina_id))
    const { data: dets } = await supabase.from('determine')
      .select('id, oggetto, tipo, organo, stato, numero, anno')
      .eq('azienda_id', azienda.id).in('organo', organiAmmessi)
      .order('created_at', { ascending: false })
    setDelibDisponibili((dets || []).filter(d => !giaRichiamate.has(d.id)))
  }

  async function richiamaDelibera(determinaId) {
    const det = delibDisponibili.find(d => d.id === determinaId)
    const ordine = delibRichiamate.length + 1
    await supabase.from('adunanza_delibere').insert({
      azienda_id: azienda.id, adunanza_id: adunanzaId, determina_id: determinaId,
      testo_odg: det?.oggetto || '', ordine,
    })
    // aggiungo anche il punto all'OdG (stato locale), poi l'utente può ritoccarlo
    setPunti(p => [...p, { titolo: det?.oggetto || 'Delibera', relatore: '', con_delibera: true }])
    caricaDelibere(organo)
  }

  async function aggiornaTestoOdg(legameId, testo) {
    await supabase.from('adunanza_delibere').update({ testo_odg: testo }).eq('id', legameId)
    setDelibRichiamate(prev => prev.map(l => l.id === legameId ? { ...l, testo_odg: testo } : l))
  }

  async function rimuoviRichiamo(legame) {
    if (!window.confirm('Rimuovere questa delibera dalla trattazione della seduta? (la delibera preparata e i suoi allegati restano, viene tolto solo il richiamo qui)')) return
    await supabase.from('adunanza_delibere').delete().eq('id', legame.id)
    caricaDelibere(organo)
  }

  async function caricaTicket() {
    if (!adunanzaId) return
    const { data } = await supabase.from('ticket').select('*, membri(nome,cognome,email)')
      .eq('riunione_id', adunanzaId).order('created_at')
    setTicketCirc(data || [])
  }

  // Invia a tutti i componenti dell'organo un ticket (presa visione o incarico)
  async function circolarizza(tipo, { titolo, istruzioni, scadenza }) {
    setCircMsg(null)
    const dest = componenti.filter(c => c.membro_id)
    if (dest.length === 0) { setCircMsg({ tipo: 'err', txt: 'Nessun componente da avvisare: aggiungi prima i membri all\'organo.' }); return }

    // (B) Blocco anti-ri-invio: già inviato lo stesso oggetto+tipo per questa adunanza?
    const elenco = dest.map(c => {
      const n = c.membri ? `${c.membri.nome || ''} ${c.membri.cognome || ''}`.trim() : 'Componente'
      return `- ${n} (${c.membri?.email || 'email mancante'})`
    }).join('\n')
    const giaInviato = ticketCirc.some(t => t.tipo === tipo && (t.titolo || '').trim() === (titolo || '').trim())
    if (giaInviato) {
      const ok = window.confirm(`Hai già circolarizzato "${titolo}" a questi componenti.\nVuoi inviare di nuovo? Riceveranno:\n\n${elenco}`)
      if (!ok) return
    } else {
      // (A) Conferma prima di inviare
      const label = tipo === 'incarico' ? 'assegnare l\'incarico' : 'inviare in presa visione'
      const ok = window.confirm(`Stai per ${label} ai seguenti destinatari:\n\n${elenco}\n\nConfermi l'invio?`)
      if (!ok) return
    }

    const righe = dest.map(c => ({
      azienda_id: azienda.id,
      membro_id: c.membro_id,
      organo_id: ad.organo_id,
      riunione_id: adunanzaId,
      tipo,                                   // 'presa_visione' | 'incarico'
      titolo,
      istruzioni: istruzioni || null,
      scadenza: scadenza || null,
      priorita: 'media',
      stato: 'Aperto',
      email_inviata: false,
    }))
    const { data: creati, error } = await supabase.from('ticket').insert(righe).select('id')
    if (error) { setCircMsg({ tipo: 'err', txt: error.message }); return }
    await supabase.from('governance_eventi').insert({
      azienda_id: azienda.id, adunanza_id: adunanzaId,
      evento: tipo === 'incarico' ? 'incarico_assegnato' : 'documento_circolarizzato',
      dettaglio: `${titolo} - ${dest.length} destinatari`,
    })
    // Invio email a ciascun destinatario (riusa la Edge Function invia-email)
    let inviate = 0
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await Promise.all((creati || []).map(t =>
        fetch(EDGE_EMAIL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ ticket_id: t.id, tipo: 'assegnazione' }),
        }).then(() => { inviate++ }).catch(() => {})
      ))
    } catch (_e) { /* se l'email fallisce, i ticket restano comunque creati */ }
    setCircMsg({ tipo: 'ok', txt: `Inviato a ${dest.length} ${dest.length === 1 ? 'componente' : 'componenti'}${inviate ? ' (email in partenza)' : ''}.` })
    caricaTicket()
  }

  // Sollecita i destinatari che non hanno ancora completato
  async function sollecita(righeTicket) {
    const mancanti = righeTicket.filter(t => t.tipo === 'presa_visione' ? !t.data_presa_visione : t.stato !== 'Completato')
    if (!mancanti.length) return
    setCircMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await Promise.all(mancanti.map(t =>
        fetch(EDGE_EMAIL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ ticket_id: t.id, tipo: 'reminder' }),
        }).catch(() => {})
      ))
      setCircMsg({ tipo: 'ok', txt: `Sollecito inviato a ${mancanti.length} ${mancanti.length === 1 ? 'persona' : 'persone'}.` })
    } catch (_e) {
      setCircMsg({ tipo: 'err', txt: 'Non è stato possibile inviare il sollecito.' })
    }
  }

  // ── Punti OdG ──
  const addPunto = () => setPunti(p => [...p, { titolo: '', relatore: '', con_delibera: true }])
  const setPunto = (i, k, v) => setPunti(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const delPunto = i => setPunti(p => p.filter((_, j) => j !== i))
  const movePunto = (i, dir) => setPunti(p => {
    const j = i + dir
    if (j < 0 || j >= p.length) return p
    const c = [...p]; [c[i], c[j]] = [c[j], c[i]]; return c
  })

  // ── Delibere ──
  const addDelibera = () => setDelibere(d => [...d, { oggetto: '', testo: '', favorevoli: 0, contrari: 0, astenuti: 0, esito: 'approvata', area_231: '' }])
  const setDel = (i, k, v) => setDelibere(d => d.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const delDelibera = i => setDelibere(d => d.filter((_, j) => j !== i))

  // ── Voti nominativi (tabella voti: assenza di riga = assente) ──
  const isAssemblea = organo?.tipo === 'assemblea'
  const votiDiDelibera = (deliberaId) => voti.filter(v => v.delibera_id === deliberaId)
  const votoDi = (deliberaId, membroId) => votiDiDelibera(deliberaId).find(v => v.membro_id === membroId)?.voto || ''

  // Ricalcola favorevoli/contrari/astenuti dai voti nominativi — per testa negli organi
  // collegiali, in % di quota per l'assemblea — e li salva subito sulla delibera.
  async function ricalcolaTotali(delibera, votiDelibera) {
    let favorevoli, contrari, astenuti
    if (isAssemblea) {
      const quotaTot = componenti.reduce((s, c) => s + (Number(c.quota) || 0), 0) || 100
      const quotaDi = (membroId) => Number(componenti.find(c => c.membro_id === membroId)?.quota) || 0
      const percentuale = (voto) => Math.round((votiDelibera.filter(v => v.voto === voto).reduce((s, v) => s + quotaDi(v.membro_id), 0) / quotaTot) * 100)
      favorevoli = percentuale('favorevole'); contrari = percentuale('contrario'); astenuti = percentuale('astenuto')
    } else {
      favorevoli = votiDelibera.filter(v => v.voto === 'favorevole').length
      contrari = votiDelibera.filter(v => v.voto === 'contrario').length
      astenuti = votiDelibera.filter(v => v.voto === 'astenuto').length
    }
    setDelibere(d => d.map(x => x.id === delibera.id ? { ...x, favorevoli, contrari, astenuti } : x))
    await supabase.from('delibere').update({ favorevoli, contrari, astenuti }).eq('id', delibera.id)
  }

  async function impostaVoto(delibera, membroId, valore) {
    if (!delibera.id) return
    if (valore) {
      await supabase.from('voti').upsert(
        { azienda_id: azienda.id, delibera_id: delibera.id, membro_id: membroId, voto: valore },
        { onConflict: 'delibera_id,membro_id' }
      )
    } else {
      await supabase.from('voti').delete().eq('delibera_id', delibera.id).eq('membro_id', membroId)
    }
    const { data: vv } = await supabase.from('voti').select('*').eq('delibera_id', delibera.id)
    setVoti(v => [...v.filter(x => x.delibera_id !== delibera.id), ...(vv || [])])
    ricalcolaTotali(delibera, vv || [])
  }

  // ── Presenza/delega dei soci (solo assemblea) ──
  const presenzaDi = (membroId) => presenze.find(p => p.membro_id === membroId) || { modalita: 'presenza', delegato: '' }

  async function impostaPresenza(membroId, patch) {
    const attuale = presenzaDi(membroId)
    const nuova = { ...attuale, ...patch }
    const { data, error } = await supabase.from('adunanza_presenze').upsert(
      { azienda_id: azienda.id, adunanza_id: adunanzaId, membro_id: membroId, modalita: nuova.modalita, delegato: nuova.delegato || null },
      { onConflict: 'adunanza_id,membro_id' }
    ).select().single()
    if (error) return
    setPresenze(p => [...p.filter(x => x.membro_id !== membroId), data])
  }

  // Applica un modello (facsimile con segnaposti) riempiendolo coi dati correnti
  function applicaModello(tpl) {
    const isAssemblea = organo?.tipo === 'assemblea'
    const d = ad.data_ora ? new Date(ad.data_ora) : null
    const dataStr = d ? d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '____________'
    const oraInizio = d ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '____'
    const num = ad.numero != null ? String(ad.numero).padStart(2, '0') : '—'
    const odg = punti.map((p, i) => `${i + 1}. ${p.titolo || ''}`).join('\n')
    const delibBlocco = delibere.map(x => x.testo || x.oggetto || '').filter(Boolean).join('\n\n')
    const map = {
      '{{ORGANO}}': ORGANO_LABEL[organo?.tipo] || 'Organo',
      '{{AZIENDA}}': azienda?.nome || '',
      '{{SETTORE}}': azienda?.settore || '',
      '{{NUMERO}}': num,
      '{{ANNO}}': String(ad.anno || ''),
      '{{DATA}}': dataStr,
      '{{ORA_INIZIO}}': oraInizio,
      '{{ORA_CHIUSURA}}': ad.ora_chiusura || '____',
      '{{LUOGO}}': ad.luogo || '____________',
      '{{MODALITA}}': { presenza: 'in presenza', videoconferenza: 'in videoconferenza', mista: 'in modalità mista' }[ad.modalita] || '',
      '{{SESSIONE}}': ad.sessione || '',
      '{{PRESIDENTE}}': ad.presidente || '____________',
      '{{SEGRETARIO}}': ad.segretario || '____________',
      '{{PRESENTI}}': ad.presenti != null ? String(ad.presenti) : '__',
      '{{AVENTI_DIRITTO}}': ad.aventi_diritto != null ? String(ad.aventi_diritto) : '__',
      '{{ODG}}': odg,
      '{{DELIBERE}}': delibBlocco,
    }
    let t = tpl
    Object.entries(map).forEach(([k, v]) => { t = t.split(k).join(v) })
    // Nota: l'intestazione NON va anteposta qui — il modello la contiene già
    // (viene salvata dentro il corpo quando si crea il modello da un'assemblea).
    return t
  }

  function generaVerbale() {
    if (!ad) return ''
    // se è selezionato un modello, si applica quello
    const tpl = modelli.find(m => m.id === templateId)
    if (tpl) return applicaModello(tpl.corpo_html || '')

    const tOrg = ORGANO_LABEL[organo?.tipo] || 'Organo'
    const isAssemblea = organo?.tipo === 'assemblea'
    const collegio = isAssemblea ? 'l\'assemblea' : 'il consiglio'
    const d = ad.data_ora ? new Date(ad.data_ora) : null
    const dataStr = d ? d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '____________'
    const oraInizio = d ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '____'
    const modLabel = { presenza: '', videoconferenza: ' in videoconferenza', mista: ' in modalità mista' }[ad.modalita] || ''
    const num = ad.numero != null ? String(ad.numero).padStart(2, '0') : '—'
    const R = []

    if (ad.intestazione && ad.intestazione.trim()) { R.push(ad.intestazione.trim()); R.push('') }

    if (isAssemblea) {
      R.push(`VERBALE N. ${num}/${ad.anno}`)
    } else {
      R.push(`VERBALE ${tOrg.toUpperCase()} N. ${num}/${ad.anno}`)
      R.push(`${azienda?.nome || ''}`)
    }
    R.push('')
    R.push(`L'anno ${ad.anno}, il giorno ${dataStr}, alle ore ${oraInizio}, presso ${ad.luogo || '____________'}${modLabel}, si è riunita${isAssemblea ? '' : 'o'} ${collegio} di ${azienda?.nome || 'questa società'}, in sessione ${ad.sessione}, per discutere e deliberare sul seguente`)
    R.push('')
    R.push('ORDINE DEL GIORNO')
    punti.forEach((p, i) => R.push(`${i + 1}. ${p.titolo || '(punto senza titolo)'}`))
    R.push('')

    // Apertura
    const pres = ad.presidente || (isAssemblea ? '____________' : 'il Presidente')
    const quorum = (ad.presenti != null || ad.aventi_diritto != null)
      ? ` — essendo presenti n. ${ad.presenti ?? '__'} ${isAssemblea ? 'soci' : 'componenti'} su n. ${ad.aventi_diritto ?? '__'} aventi diritto —`
      : ''
    R.push(`Assume la presidenza ${pres} il quale, constatata e fatta constatare la regolare costituzione dell'adunanza${quorum}, dichiara la seduta validamente costituita e atta a deliberare.`)
    if (ad.segretario) R.push(`Viene chiamato a fungere da segretario ${ad.segretario}, che accetta.`)
    R.push('')
    R.push('Si passa quindi alla trattazione degli argomenti all\'ordine del giorno.')
    R.push('')

    // Trattazione punto per punto — testo neutro (la narrazione la scrive l'utente)
    punti.forEach((p, i) => {
      R.push(`Punto ${i + 1} all'ordine del giorno: ${p.titolo || '____________'}.`)
      const del = delibere[i] // abbinamento posizionale punto→delibera
      if (del) {
        if (del.testo) R.push(del.testo)
        if (del.area_231) R.push(`(Operazione ricadente nell'area sensibile 231: ${del.area_231}.)`)
      }
      R.push('')
    })

    // Chiusura
    R.push(`Null'altro essendovi da deliberare e nessuno chiedendo la parola, il Presidente dichiara sciolta la seduta alle ore ${ad.ora_chiusura || '____'}.`)
    R.push('')
    R.push('Letto, approvato e sottoscritto.')
    R.push('')
    R.push(`Il Segretario                                   Il Presidente`)
    R.push(`${ad.segretario || '____________'}                    ${ad.presidente || '____________'}`)
    return R.join('\n')
  }

  function stampaPdf() {
    const num = ad.numero != null ? String(ad.numero).padStart(2, '0') : '—'
    const titoloDoc = `Verbale ${num}-${ad.anno} ${azienda?.nome || ''}`.trim()
    const testo = (verbale && verbale.trim()) ? verbale : generaVerbale()
    const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // Separo il blocco firme (due colonne) dal corpo, per allinearle bene
    const linee = testo.split('\n')
    const idx = linee.findIndex(l => l.includes('Il Segretario') && l.includes('Il Presidente'))
    let corpoHtml, firmeHtml = ''
    if (idx >= 0) {
      corpoHtml = esc(linee.slice(0, idx).join('\n').replace(/\n+$/, ''))
      firmeHtml = `<table class="firme"><tr><td>Il Segretario</td><td>Il Presidente</td></tr>` +
        `<tr><td class="nome">${esc(ad.segretario || '')}</td><td class="nome">${esc(ad.presidente || '')}</td></tr></table>`
    } else {
      corpoHtml = esc(testo)
    }

    const w = window.open('', '_blank')
    if (!w) { setErrore('Consenti le finestre popup per stampare il verbale.'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titoloDoc)}</title>
      <style>
        @page { size: A4 portrait; margin: 2cm; }
        * { box-sizing: border-box; }
        html, body { width: 100%; }
        body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; padding-right: 4px; }
        pre { white-space: pre-wrap; overflow-wrap: break-word; word-wrap: break-word; hyphens: none; font-family: inherit; margin: 0; max-width: 100%; }
        table.firme { width: 100%; margin-top: 46px; border-collapse: collapse; }
        table.firme td { width: 50%; text-align: center; vertical-align: top; }
        table.firme .nome { padding-top: 46px; }
        .hash { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ccc; font-family: monospace; font-size: 8pt; color: #888; word-break: break-all; }
      </style></head><body>
      <pre>${corpoHtml}</pre>
      ${firmeHtml}
      ${ad.hash_documento ? `<div class="hash">Impronta SHA-256: ${esc(ad.hash_documento)}</div>` : ''}
      <script>window.onload = function(){ window.print(); }</script>
      </body></html>`)
    w.document.close()
  }

  async function salva(verbalizza) {
    setErrore(null)
    if (!ad?.titolo?.trim()) { setErrore('Il titolo dell\'adunanza è obbligatorio.'); return }
    setSaving(true)
    try {
      let numero = ad.numero, data_verbale = ad.data_verbale, hash = ad.hash_documento
      let stato = ad.stato === 'programmata' ? 'svolta' : ad.stato
      const corpo = verbale && verbale.trim() ? verbale : generaVerbale()

      if (verbalizza) {
        if (ad.numero == null) {
          const { data: n, error: eN } = await supabase.rpc('prossimo_numero_adunanza', { p_organo: ad.organo_id, p_anno: ad.anno })
          if (eN) throw eN
          numero = n
        }
        data_verbale = new Date().toISOString()
        stato = 'verbalizzata'
        hash = await sha256(corpo.replace('N. —/', `N. ${String(numero).padStart(2, '0')}/`))
      }

      const corpoFinale = verbalizza
        ? corpo.replace('N. —/', `N. ${String(numero).padStart(2, '0')}/`)
        : corpo

      const { error: eUp } = await supabase.from('adunanze').update({
        titolo: ad.titolo.trim(), sessione: ad.sessione, data_ora: ad.data_ora, luogo: ad.luogo || null,
        modalita: ad.modalita, presenti: ad.presenti === '' ? null : ad.presenti,
        aventi_diritto: ad.aventi_diritto === '' ? null : ad.aventi_diritto,
        presidente: ad.presidente || null, segretario: ad.segretario || null, ora_chiusura: ad.ora_chiusura || null,
        intestazione: ad.intestazione || null,
        template_id: templateId || null,
        verbale_html: corpoFinale, stato, numero, data_verbale, hash_documento: hash,
      }).eq('id', adunanzaId)
      if (eUp) throw eUp

      // sync punti (delete + insert)
      await supabase.from('adunanza_punti').delete().eq('adunanza_id', adunanzaId)
      if (punti.length) {
        const rows = punti.map((p, i) => ({
          adunanza_id: adunanzaId, azienda_id: azienda.id, ordine: i + 1,
          titolo: p.titolo || `Punto ${i + 1}`, relatore: p.relatore || null, con_delibera: p.con_delibera,
        }))
        const { error } = await supabase.from('adunanza_punti').insert(rows)
        if (error) throw error
      }

      // sync delibere: aggiorna quelle esistenti e inserisce le nuove, mantenendo
      // stabile l'id (serve per non perdere l'aggancio dei voti nominativi registrati).
      // Elimina solo quelle rimosse dall'utente, insieme ai loro voti (nessuna cascade in DB).
      const { data: esistenti } = await supabase.from('delibere').select('id').eq('adunanza_id', adunanzaId)
      const idAttuali = new Set(delibere.filter(d => d.id).map(d => d.id))
      const daEliminare = (esistenti || []).map(e => e.id).filter(id => !idAttuali.has(id))
      if (daEliminare.length) {
        await supabase.from('voti').delete().in('delibera_id', daEliminare)
        await supabase.from('delibere').delete().in('id', daEliminare)
      }
      for (const d of delibere) {
        const payload = {
          adunanza_id: adunanzaId, azienda_id: azienda.id, oggetto: d.oggetto || 'Delibera',
          testo: d.testo || null, favorevoli: Number(d.favorevoli) || 0, contrari: Number(d.contrari) || 0,
          astenuti: Number(d.astenuti) || 0, esito: d.esito, area_231: d.area_231 || null,
        }
        if (d.id) {
          const { error } = await supabase.from('delibere').update(payload).eq('id', d.id)
          if (error) throw error
        } else {
          const { data: nuova, error } = await supabase.from('delibere').insert(payload).select().single()
          if (error) throw error
          d.id = nuova.id
        }
      }

      await supabase.from('governance_eventi').insert({
        azienda_id: azienda.id, adunanza_id: adunanzaId,
        evento: verbalizza ? 'verbalizzazione' : 'aggiornamento_adunanza',
        dettaglio: `${ORGANO_LABEL[organo?.tipo] || 'Organo'} — ${ad.titolo.trim()}`,
      })

      setPage('verbali')
    } catch (e) {
      setErrore(e.message || 'Errore durante il salvataggio.')
      setSaving(false)
    }
  }

  async function elimina() {
    if (!window.confirm(`Eliminare definitivamente l'adunanza "${ad.titolo || ''}" e tutti i suoi dati (ordine del giorno, delibere, verbale)?`)) return
    setSaving(true)
    await supabase.from('governance_eventi').delete().eq('adunanza_id', adunanzaId)
    await supabase.from('delibere').delete().eq('adunanza_id', adunanzaId)
    await supabase.from('adunanza_punti').delete().eq('adunanza_id', adunanzaId)
    const { error } = await supabase.from('adunanze').delete().eq('id', adunanzaId)
    if (error) { setErrore(error.message); setSaving(false); return }
    setPage('verbali')
  }

  if (!caricata) return <div className="spinner" />
  if (!ad) return (
    <div className="card"><p>Adunanza non trovata. <button className="btn btn-sm" onClick={() => setPage('verbali')}>← Torna all'elenco</button></p></div>
  )

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>{soloLettura ? 'Verbale' : 'Adunanza'} · {ORGANO_LABEL[organo?.tipo] || 'Organo'}</h2>
            <p>{organo?.nome} · {azienda?.nome} · N. {ad.numero != null ? String(ad.numero).padStart(2, '0') : '—'}/{ad.anno}</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={stampaPdf}>🖨️ Stampa / PDF</button>
            {!soloLettura && <button className="btn btn-sm btn-danger" onClick={elimina} disabled={saving}>🗑 Elimina</button>}
            <button className="btn btn-sm" onClick={() => setPage('verbali')}>← Elenco</button>
          </div>
        </div>
      </div>

      {soloLettura && (
        <div className="alert" style={{ marginBottom: 14, background: '#EAF2F8', color: '#1A5276' }}>
          🔒 Adunanza verbalizzata: consultabile ma non modificabile.
        </div>
      )}
      {errore && <div className="alert alert-error" style={{ marginBottom: 14 }}>{errore}</div>}

      {/* Testata */}
      <div className="card">
        <div className="card-header"><span className="card-title">Dati della seduta</span></div>
        <div className="form-group">
          <label className="form-label">Intestazione del verbale</label>
          <textarea className="form-control" style={{ minHeight: 70 }} value={ad.intestazione || ''} disabled={soloLettura}
            onChange={e => setTestata('intestazione', e.target.value)}
            placeholder="Testo libero che comparirà in cima al verbale (es. ragione sociale completa, sede legale, capitale sociale, C.F./P.IVA, n. R.E.A.)" />
        </div>
        <div className="form-group">
          <label className="form-label">Titolo *</label>
          <input className="form-control" value={ad.titolo || ''} disabled={soloLettura} onChange={e => setTestata('titolo', e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
            <label className="form-label">Sessione</label>
            <select className="form-control" value={ad.sessione} disabled={soloLettura} onChange={e => setTestata('sessione', e.target.value)}>
              <option value="ordinaria">Ordinaria</option><option value="straordinaria">Straordinaria</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
            <label className="form-label">Modalità</label>
            <select className="form-control" value={ad.modalita} disabled={soloLettura} onChange={e => setTestata('modalita', e.target.value)}>
              <option value="presenza">In presenza</option><option value="videoconferenza">Videoconferenza</option><option value="mista">Mista</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 90 }}>
            <label className="form-label">Presenti</label>
            <input className="form-control" type="number" min="0" value={ad.presenti ?? ''} disabled={soloLettura} onChange={e => setTestata('presenti', e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 90 }}>
            <label className="form-label">Aventi diritto</label>
            <input className="form-control" type="number" min="0" value={ad.aventi_diritto ?? ''} disabled={soloLettura} onChange={e => setTestata('aventi_diritto', e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Luogo</label>
          <input className="form-control" value={ad.luogo || ''} disabled={soloLettura} onChange={e => setTestata('luogo', e.target.value)} placeholder="Sede legale / link videoconferenza" />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-label">Presidente della seduta</label>
            <input className="form-control" value={ad.presidente || ''} disabled={soloLettura} onChange={e => setTestata('presidente', e.target.value)} placeholder="Nome e cognome" />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-label">Segretario</label>
            <input className="form-control" value={ad.segretario || ''} disabled={soloLettura} onChange={e => setTestata('segretario', e.target.value)} placeholder="Nome e cognome" />
          </div>
          <div className="form-group" style={{ width: 120 }}>
            <label className="form-label">Ora chiusura</label>
            <input className="form-control" value={ad.ora_chiusura || ''} disabled={soloLettura} onChange={e => setTestata('ora_chiusura', e.target.value)} placeholder="es. 18:30" />
          </div>
        </div>
      </div>

      {/* Delibere in trattazione (richiamo delibere preparate) */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{azienda?.tipo_soggetto === 'individuale' ? 'Decisioni in trattazione' : 'Delibere in trattazione'}</span>
        </div>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
          {azienda?.tipo_soggetto === 'individuale'
            ? "Richiama le decisioni già preparate (con il loro fascicolo di supporto) da mettere all'ordine del giorno di questa seduta. Puoi poi completare l'OdG con punti liberi qui sotto."
            : "Richiama le delibere/determine già preparate (con il loro fascicolo di supporto) da mettere all'ordine del giorno di questa seduta. Puoi poi completare l'OdG con punti liberi qui sotto."}
        </p>
        {!soloLettura && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <select className="form-control" style={{ flex: 1, minWidth: 220 }} value="" onChange={e => { if (e.target.value) richiamaDelibera(e.target.value) }}>
              <option value="">+ Richiama una delibera preparata…</option>
              {delibDisponibili.map(d => (
                <option key={d.id} value={d.id}>
                  {d.oggetto || '(senza oggetto)'}{d.organo && d.organo !== organo?.tipo ? ` · da ${ORGANO_LABEL[d.organo] || d.organo}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {delibRichiamate.length === 0 ? (
          <div style={{ fontSize: 13, color: '#999' }}>Nessuna delibera preparata richiamata in questa seduta.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {delibRichiamate.map(l => (
              <div key={l.id} style={{ border: '1px solid #E8ECF2', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1A3A5C', flex: 1 }}>
                    📎 {l.determine?.oggetto || 'Delibera'}
                    {l.determine?.organo && l.determine.organo !== organo?.tipo && (
                      <span style={{ fontSize: 11, color: '#8A6D3B', marginLeft: 6 }}>· da {ORGANO_LABEL[l.determine.organo] || l.determine.organo}</span>
                    )}
                  </span>
                  {!soloLettura && <button className="btn btn-sm btn-danger" onClick={() => rimuoviRichiamo(l)}>Rimuovi</button>}
                </div>
                <label style={{ fontSize: 11, color: '#8A94A0' }}>Testo del punto all'ordine del giorno (modificabile)</label>
                <input className="form-control" style={{ fontSize: 13, marginTop: 4 }} value={l.testo_odg || ''} disabled={soloLettura}
                  onChange={e => aggiornaTestoOdg(l.id, e.target.value)}
                  placeholder="Es. Deliberazioni in merito ai contratti di fornitura" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ordine del giorno */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Ordine del giorno</span>
          {!soloLettura && <button className="btn btn-sm btn-primary" onClick={addPunto}>+ Punto</button>}
        </div>
        {punti.length === 0 ? <p style={{ fontSize: 13, color: '#999' }}>Nessun punto all'ordine del giorno.</p> : punti.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#7F77DD', width: 20 }}>{i + 1}.</span>
            <input className="form-control" style={{ flex: 2, minWidth: 160 }} value={p.titolo} disabled={soloLettura} onChange={e => setPunto(i, 'titolo', e.target.value)} placeholder="Titolo del punto" />
            <input className="form-control" style={{ flex: 1, minWidth: 120 }} value={p.relatore} disabled={soloLettura} onChange={e => setPunto(i, 'relatore', e.target.value)} placeholder="Relatore" />
            {!soloLettura && <>
              <button className="btn btn-sm" onClick={() => movePunto(i, -1)} title="Su">↑</button>
              <button className="btn btn-sm" onClick={() => movePunto(i, 1)} title="Giù">↓</button>
              <button className="btn btn-sm btn-danger" onClick={() => delPunto(i)}>✕</button>
            </>}
          </div>
        ))}
      </div>

      {/* Circolarizzazione ai componenti dell'organo */}
      <BloccoCircolarizzazione
        componenti={componenti} ticket={ticketCirc} messaggio={circMsg}
        soloLettura={soloLettura} onInvia={circolarizza} onSollecita={sollecita} organoNome={organo?.nome} />

      {/* Presenze soci (solo assemblea) */}
      {isAssemblea && componenti.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Presenze soci</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {componenti.map(c => {
              const nome = c.membri ? `${c.membri.nome || ''} ${c.membri.cognome || ''}`.trim() : 'Socio'
              const p = presenzaDi(c.membro_id)
              return (
                <div key={c.membro_id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
                  <span style={{ flex: 1, minWidth: 160 }}>{nome}{c.quota != null ? ` — ${c.quota}%` : ''}</span>
                  <select className="form-control" style={{ width: 140, fontSize: 12 }} disabled={soloLettura}
                    value={p.modalita} onChange={e => impostaPresenza(c.membro_id, { modalita: e.target.value })}>
                    <option value="presenza">In presenza</option>
                    <option value="delega">Per delega</option>
                  </select>
                  {p.modalita === 'delega' && (
                    <input className="form-control" style={{ width: 200, fontSize: 12 }} disabled={soloLettura}
                      value={p.delegato || ''} onChange={e => impostaPresenza(c.membro_id, { delegato: e.target.value })}
                      placeholder="Nome del delegato" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Delibere */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Delibere</span>
          {!soloLettura && <button className="btn btn-sm btn-primary" onClick={addDelibera}>+ Delibera</button>}
        </div>
        {delibere.length === 0 ? <p style={{ fontSize: 13, color: '#999' }}>Nessuna delibera registrata.</p> : delibere.map((d, i) => (
          <div key={i} style={{ border: '1px solid #E0E0E0', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: '#7F77DD' }}>Delibera {i + 1}</span>
              {soloLettura && <span className="badge" style={ESITO_STYLE[d.esito]}>{d.esito}</span>}
              {!soloLettura && <button className="btn btn-sm btn-danger" style={{ marginLeft: 'auto' }} onClick={() => delDelibera(i)}>Rimuovi</button>}
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <input className="form-control" value={d.oggetto} disabled={soloLettura} onChange={e => setDel(i, 'oggetto', e.target.value)} placeholder="Oggetto della delibera" />
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <textarea className="form-control" value={d.testo} disabled={soloLettura} onChange={e => setDel(i, 'testo', e.target.value)} placeholder="Testo della delibera..." />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0, width: 90 }}>
                <label className="form-label">Favorevoli{isAssemblea ? ' (%)' : ''}</label>
                <input className="form-control" type="number" min="0" value={d.favorevoli} disabled={soloLettura || votiDiDelibera(d.id).length > 0} onChange={e => setDel(i, 'favorevoli', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, width: 90 }}>
                <label className="form-label">Contrari{isAssemblea ? ' (%)' : ''}</label>
                <input className="form-control" type="number" min="0" value={d.contrari} disabled={soloLettura || votiDiDelibera(d.id).length > 0} onChange={e => setDel(i, 'contrari', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, width: 90 }}>
                <label className="form-label">Astenuti{isAssemblea ? ' (%)' : ''}</label>
                <input className="form-control" type="number" min="0" value={d.astenuti} disabled={soloLettura || votiDiDelibera(d.id).length > 0} onChange={e => setDel(i, 'astenuti', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 130 }}>
                <label className="form-label">Esito</label>
                <select className="form-control" value={d.esito} disabled={soloLettura} onChange={e => setDel(i, 'esito', e.target.value)}>
                  <option value="approvata">Approvata</option><option value="respinta">Respinta</option><option value="rinviata">Rinviata</option>
                </select>
              </div>
            </div>
            {votiDiDelibera(d.id).length > 0 && (
              <div style={{ fontSize: 11, color: '#8A94A0', marginTop: 4 }}>Calcolati automaticamente dai voti nominativi qui sotto.</div>
            )}

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E0E0E0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#5A4FCF', marginBottom: 6 }}>
                Voti nominativi {isAssemblea ? '(soci, pesati per quota)' : '(componenti)'}
              </div>
              {!d.id ? (
                <div style={{ fontSize: 12, color: '#999' }}>Salva prima la bozza per poter registrare i voti nominativi di questa delibera.</div>
              ) : componenti.length === 0 ? (
                <div style={{ fontSize: 12, color: '#999' }}>Nessun componente/socio in questo organo.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {componenti.map(c => {
                    const nome = c.membri ? `${c.membri.nome || ''} ${c.membri.cognome || ''}`.trim() : 'Componente'
                    const p = isAssemblea ? presenzaDi(c.membro_id) : null
                    return (
                      <div key={c.membro_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ flex: 1 }}>
                          {nome}{isAssemblea && c.quota != null ? ` — ${c.quota}%` : ''}
                          {p && p.modalita === 'delega' && <span style={{ color: '#8A94A0', fontSize: 11 }}> — per delega{p.delegato ? ` (${p.delegato})` : ''}</span>}
                        </span>
                        <select className="form-control" style={{ width: 150, fontSize: 12 }} disabled={soloLettura}
                          value={votoDi(d.id, c.membro_id)} onChange={e => impostaVoto(d, c.membro_id, e.target.value)}>
                          <option value="">Assente</option>
                          <option value="favorevole">Favorevole</option>
                          <option value="contrario">Contrario</option>
                          <option value="astenuto">Astenuto</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Verbale */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Verbale</span>
          {!soloLettura && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="form-control" style={{ width: 'auto', minWidth: 150, padding: '4px 8px', fontSize: 13 }}
                value={templateId} onChange={e => setTemplateId(e.target.value)}>
                <option value="">Testo standard</option>
                {modelli.map(m => <option key={m.id} value={m.id}>Modello: {m.nome}</option>)}
              </select>
              <button className="btn btn-sm" onClick={() => setVerbale(generaVerbale())}>↻ Genera</button>
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
          {templateId
            ? 'Genera applicando il modello scelto: i segnaposti vengono riempiti con i dati, l\'ordine del giorno e le delibere. Puoi poi modificare il testo.'
            : 'Genera la bozza dai dati inseriti, poi modificala liberamente. Alla verbalizzazione il testo viene congelato con un hash.'}
        </p>
        <textarea className="form-control" style={{ minHeight: 260, fontFamily: 'inherit', lineHeight: 1.6 }}
          value={verbale} disabled={soloLettura} onChange={e => setVerbale(e.target.value)}
          placeholder="Scegli un modello (o «Testo standard»), poi clicca «Genera». In alternativa scrivi qui il verbale." />
      </div>

      {/* Azioni */}
      {!soloLettura && (
        <div className="card" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => salva(false)} disabled={saving}>{saving ? 'Salvataggio…' : '💾 Salva bozza'}</button>
          <button className="btn btn-primary" onClick={() => salva(true)} disabled={saving}>{saving ? 'Salvataggio…' : '✍️ Verbalizza'}</button>
        </div>
      )}
    </div>
  )
}

// --- Blocco Circolarizzazione ai componenti dell'organo ---
function BloccoCircolarizzazione({ componenti, ticket, messaggio, soloLettura, onInvia, onSollecita, organoNome }) {
  const [modo, setModo] = useState(null)   // null | 'presa_visione' | 'incarico'
  const [titolo, setTitolo] = useState('')
  const [istruzioni, setIstruzioni] = useState('')
  const [scadenza, setScadenza] = useState('')
  const [inviando, setInviando] = useState(false)

  async function invia() {
    setInviando(true)
    await onInvia(modo, { titolo: titolo.trim() || (modo === 'incarico' ? 'Incarico' : 'Documento da esaminare'), istruzioni, scadenza })
    setInviando(false)
    setModo(null); setTitolo(''); setIstruzioni(''); setScadenza('')
  }

  const nome = t => t?.membri ? `${t.membri.nome || ''} ${t.membri.cognome || ''}`.trim() : '-'
  const statoTicket = t => t.tipo === 'presa_visione'
    ? (t.data_presa_visione ? 'Vista ' + new Date(t.data_presa_visione).toLocaleDateString('it-IT') : 'Da vedere')
    : (t.stato === 'Completato' ? 'Completato' : t.stato === 'In lavorazione' ? 'In lavorazione' : 'Aperto')

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Circolarizzazione ai componenti</span>
      </div>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
        Invia ai componenti {organoNome ? 'di ' + organoNome : "dell'organo"} i documenti da esaminare (presa visione) o gli incarichi da svolgere. Li ricevono nella loro area, sezione Governance.
      </p>

      {!soloLettura && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-primary" onClick={() => setModo('presa_visione')}>Invia in presa visione</button>
          <button className="btn btn-sm" onClick={() => setModo('incarico')}>Assegna incarico</button>
        </div>
      )}

      {modo && (
        <div style={{ background: '#F7F8FA', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#5A4FCF' }}>
            {modo === 'presa_visione' ? 'Documento da far esaminare' : 'Incarico da assegnare'} - {componenti.length} destinatari
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <input className="form-control" value={titolo} onChange={e => setTitolo(e.target.value)}
              placeholder={modo === 'presa_visione' ? 'Oggetto (es. Progetto di bilancio 2025)' : "Oggetto dell'incarico (es. Predisporre relazione)"} />
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <textarea className="form-control" value={istruzioni} onChange={e => setIstruzioni(e.target.value)}
              placeholder={modo === 'presa_visione' ? 'Note per i consiglieri (facoltative)' : 'Cosa deve fare il destinatario'} />
          </div>
          {modo === 'incarico' && (
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">Scadenza</label>
              <input className="form-control" type="date" value={scadenza} onChange={e => setScadenza(e.target.value)} style={{ maxWidth: 200 }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-primary" onClick={invia} disabled={inviando}>{inviando ? 'Invio...' : 'Invia a tutti i componenti'}</button>
            <button className="btn btn-sm" onClick={() => setModo(null)}>Annulla</button>
          </div>
        </div>
      )}

      {messaggio && (
        <div className="alert" style={{ marginBottom: 12, background: messaggio.tipo === 'ok' ? '#E9F7EF' : '#FDEDEC', color: messaggio.tipo === 'ok' ? '#1E8449' : '#C0392B' }}>
          {messaggio.txt}
        </div>
      )}

      {ticket.length > 0 && (
        <div className="table-wrap">
          {!soloLettura && (
            <div style={{ textAlign: 'right', marginBottom: 8 }}>
              <button className="btn btn-sm" onClick={() => onSollecita(ticket)}>Sollecita i mancanti</button>
            </div>
          )}
          <table>
            <thead><tr><th>Destinatario</th><th>Tipo</th><th>Oggetto</th><th>Stato</th></tr></thead>
            <tbody>
              {ticket.map(t => (
                <tr key={t.id}>
                  <td style={{ fontSize: 13 }}>{nome(t)}</td>
                  <td style={{ fontSize: 12, color: '#666' }}>{t.tipo === 'presa_visione' ? 'Presa visione' : 'Incarico'}</td>
                  <td style={{ fontSize: 12, color: '#666', maxWidth: 240 }}>{t.titolo}</td>
                  <td style={{ fontSize: 12 }}>{statoTicket(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
