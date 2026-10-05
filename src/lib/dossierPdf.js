// Fascicolo BJR completo in un unico PDF (pdf-lib, tutto nel browser).
// Contiene TUTTO cio' che documenta la decisione, non solo un riepilogo:
//  - testata della seduta, score e criteri;
//  - verbale integrale della seduta;
//  - delibere con testo e voti;
//  - per ogni atto istruito richiamato: testo integrale, istruttoria (descrizione,
//    analisi finanziaria/economica, alternative), rischi con mitigazioni, pareri,
//    checklist dei giustificativi, simulazione d'impatto, elenco allegati;
//  - documentazione inviata ai componenti: invio, email (esito e orario),
//    solleciti, presa visione/ricezione;
//  - cronologia;
//  - tutti gli allegati incorporati (PDF e immagini), ognuno con copertina e
//    impronta SHA-256 del file.
// Quello che non si puo' incorporare (es. Word/Excel) o non si riesce a leggere
// e' dichiarato in copertina come "fascicolo incompleto", mai omesso in silenzio.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const ORGANO_LABEL = {
  cda: 'Consiglio di Amministrazione', amministratore_unico: 'Amministratore Unico',
  comitato: 'Comitato', collegio_sindacale: 'Collegio Sindacale', assemblea: 'Assemblea dei Soci', altro: 'Organo',
}
const RISCHIO_LABEL = { strategico: 'Strategico', finanziario: 'Finanziario', operativo: 'Operativo', compliance: 'Compliance', reputazionale: 'Reputazionale' }

const numFmt = a => `${a.numero != null ? String(a.numero).padStart(2, '0') : '—'}/${a.anno}`
const dataOra = d => d ? new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const dataSola = d => d ? new Date(d).toLocaleDateString('it-IT') : '—'
const nomeDi = m => m ? `${m.nome || ''} ${m.cognome || ''}`.trim() : '—'
const euro = v => `€ ${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const kb = n => n ? (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : '—'
const numeroAtto = det => det?.numero != null
  ? `${det.organo === 'cda' ? 'Delibera' : 'Determina'} n. ${String(det.numero).padStart(3, '0')}/${det.anno}`
  : 'non ancora protocollato'

// Testo leggibile da HTML (verbale, corpo dell'atto): paragrafi, a capo ed elenchi conservati
export function htmlATesto(html) {
  if (!html) return ''
  const conInterruzioni = String(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\/\s*(p|div|h[1-6]|li|tr|table|ul|ol|blockquote)\s*>/gi, '\n')
    .replace(/<\/\s*t[dh]\s*>/gi, '  ')
  const doc = new DOMParser().parseFromString(conInterruzioni, 'text/html')
  return (doc.body.textContent || '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function sha256(bytes) {
  const h = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// d: { ad, organo, isAssemblea, delibere, richiami, componenti, presenze, ticket, eventi, voti,
//      allegati, rischi, pareri, atti, simulazioni, notifiche }
// scaricaAllegato(storage_path) -> Blob | null
export async function generaFascicoloBjr({ d, score, azienda, scaricaAllegato, onProgresso = () => {} }) {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const PAGE_W = 595.28, PAGE_H = 841.89, MARGIN = 50
  const MAX_W = PAGE_W - MARGIN * 2
  const colTitolo = rgb(0.10, 0.23, 0.36), colGrigio = rgb(0.45, 0.48, 0.53), colAvviso = rgb(0.6, 0.38, 0.02), colTesto = rgb(0.15, 0.15, 0.18)

  // I font standard coprono solo WinAnsi: i caratteri non codificabili (emoji, frecce...) si
  // sostituiscono invece di far fallire tutto il PDF
  const cacheChar = new Map()
  const SOSTITUZIONI = { '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '≠': '!=', '✓': 'v', '✔': 'v', '✗': 'x', '✕': 'x', '\t': '    ' }
  const pulisci = (s) => [...String(s ?? '')].map(ch => {
    if (ch === '\n') return ch
    if (ch === '\r') return ''
    if (SOSTITUZIONI[ch]) return SOSTITUZIONI[ch]
    if (!cacheChar.has(ch)) { try { font.encodeText(ch); fontBold.encodeText(ch); cacheChar.set(ch, true) } catch { cacheChar.set(ch, false) } }
    return cacheChar.get(ch) ? ch : ''
  }).join('')

  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN
  // insertAt: pagine inserite dopo la copertina (riquadro di completezza, scritto per ultimo)
  let insertAt = null
  const newPage = () => {
    page = insertAt == null ? pdfDoc.addPage([PAGE_W, PAGE_H]) : pdfDoc.insertPage(++insertAt, [PAGE_W, PAGE_H])
    y = PAGE_H - MARGIN
  }
  const ensureSpace = h => { if (y - h < MARGIN) newPage() }
  const spacer = (h = 8) => { y -= h }

  function drawText(text, { size = 9.5, f = font, color = colTesto, gap = 3, indent = 0 } = {}) {
    const larghezza = MAX_W - indent
    pulisci(text).split('\n').forEach(paragraph => {
      let line = ''
      const words = paragraph.split(/ +/).filter(Boolean)
      const flush = () => { if (line) { ensureSpace(size + gap); page.drawText(line, { x: MARGIN + indent, y, size, font: f, color }); y -= size + gap; line = '' } }
      if (words.length === 0) { ensureSpace(size + gap); y -= size + gap; return }
      words.forEach(w => {
        // parola piu' lunga della riga (es. hash, URL): spezzata a caratteri
        while (f.widthOfTextAtSize(w, size) > larghezza) {
          let k = w.length
          while (k > 1 && f.widthOfTextAtSize(w.slice(0, k), size) > larghezza) k--
          if (line) flush()
          line = w.slice(0, k); flush(); w = w.slice(k)
        }
        const test = line ? line + ' ' + w : w
        if (f.widthOfTextAtSize(test, size) > larghezza && line) { flush(); line = w } else { line = test }
      })
      flush()
    })
  }
  const drawHeading = (text, size = 13) => {
    ensureSpace(40); y -= 6
    page.drawText(pulisci(text), { x: MARGIN, y, size, font: fontBold, color: colTitolo })
    y -= 4
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.85) })
    y -= 14
  }
  const drawSub = (text) => { ensureSpace(30); spacer(4); drawText(text, { size: 10.5, f: fontBold, color: colTitolo }); spacer(1) }
  const campo = (etichetta, valore, opt = {}) => {
    if (valore == null || valore === '') return
    drawText(`${etichetta}: ${valore}`, { size: 9.5, ...opt })
  }
  const blocco = (titolo, testo, avvisoSeVuoto) => {
    drawSub(titolo)
    if (testo && String(testo).trim()) drawText(testo)
    else if (avvisoSeVuoto) drawText(avvisoSeVuoto, { color: colAvviso })
  }

  const mancanze = []   // cio' che rende il fascicolo incompleto, riportato in copertina

  // ── Atti istruiti: tutti quelli richiamati nella seduta (anche se il titolo della delibera e' diverso) ──
  const attiById = new Map((d.atti || []).map(a => [a.id, a]))
  const richiamiConAtto = d.richiami.filter(r => r.determina_id && attiById.has(r.determina_id))
  const attoDellaDelibera = (del) => {
    const r = richiamiConAtto.find(x => (x.testo_odg || '').trim().toLowerCase() === (del.oggetto || '').trim().toLowerCase())
    return r ? attiById.get(r.determina_id) : null
  }

  // Allegati da incorporare, nell'ordine degli atti
  const daIncorporare = []
  for (const r of richiamiConAtto) {
    const atto = attiById.get(r.determina_id)
    d.allegati.filter(a => a.determina_id === atto.id).forEach(a => daIncorporare.push({ ...a, atto }))
  }
  // impronte e contenuti scaricati prima di scrivere, per poterle citare negli elenchi
  const contenuti = new Map()
  for (let i = 0; i < daIncorporare.length; i++) {
    const a = daIncorporare[i]
    onProgresso(`Scarico allegato ${i + 1} di ${daIncorporare.length}: ${a.nome_file}`)
    try {
      const blob = await scaricaAllegato(a.storage_path)
      if (!blob) throw new Error('file non trovato')
      const bytes = new Uint8Array(await blob.arrayBuffer())
      contenuti.set(a.id, { bytes, hash: await sha256(bytes) })
    } catch (e) {
      contenuti.set(a.id, { errore: e.message || 'download non riuscito' })
    }
  }

  // ═════════ COPERTINA ═════════
  onProgresso('Compongo il fascicolo…')
  let logoImg = null
  if (azienda?.logo_url) {
    try {
      const resp = await fetch(azienda.logo_url)
      const blob = await resp.blob()
      const bytes = new Uint8Array(await blob.arrayBuffer())
      if (blob.type.includes('png')) logoImg = await pdfDoc.embedPng(bytes)
      else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) logoImg = await pdfDoc.embedJpg(bytes)
    } catch (e) { /* logo non incorporabile: procedo senza */ }
  }
  if (logoImg) {
    const scale = Math.min(90 / logoImg.width, 40 / logoImg.height, 1)
    const w = logoImg.width * scale, h = logoImg.height * scale
    page.drawImage(logoImg, { x: PAGE_W - MARGIN - w, y: y - h + 10, width: w, height: h })
  }
  if (azienda?.nome) drawText(azienda.nome, { size: 12, f: fontBold, color: colTitolo })
  spacer(4)
  drawText(`Fascicolo BJR — ${d.ad.titolo}`, { size: 16, f: fontBold, color: colTitolo })
  drawText(`${ORGANO_LABEL[d.organo?.tipo] || 'Organo'}${d.organo?.nome ? ` (${d.organo.nome})` : ''} · Seduta n. ${numFmt(d.ad)}`, { size: 10, color: colGrigio })
  campo('Data e ora della seduta', dataOra(d.ad.data_ora), { color: colGrigio })
  campo('Luogo / modalità', [d.ad.luogo, d.ad.modalita].filter(Boolean).join(' · '), { color: colGrigio })
  campo('Presidente / segretario', [d.ad.presidente, d.ad.segretario].filter(Boolean).join(' / '), { color: colGrigio })
  campo('Verbalizzata il', dataOra(d.ad.data_verbale), { color: colGrigio })
  if (d.ad.hash_documento) drawText(`Impronta SHA-256 del verbale: ${d.ad.hash_documento}`, { size: 7, color: colGrigio })
  drawText(`Fascicolo generato il ${dataOra(new Date())}`, { size: 8, color: colGrigio })
  spacer(8)
  drawText(`Score conformità: ${score.punteggio != null ? score.punteggio + '%' : '—'}`, { size: 14, f: fontBold })
  drawText('Completezza del fascicolo e indice: pagina seguente.', { size: 9, color: colGrigio })
  newPage()

  // ═════════ CRITERI ═════════
  drawHeading('1. Criteri di conformità verificati')
  score.criteri.forEach(c => drawText(`${Math.round(c.valore * 100)}%  ${c.label} — ${c.dettaglio}`))

  if (d.isAssemblea && d.componenti.length) {
    spacer(8); drawHeading('Presenze soci')
    d.componenti.forEach(c => {
      const p = d.presenze.find(x => x.membro_id === c.membro_id)
      const stato = p ? (p.modalita === 'delega' ? `Per delega${p.delegato ? ` (${p.delegato})` : ''}` : 'In presenza') : 'Non dichiarato'
      drawText(`${nomeDi(c.membri)}${c.quota != null ? ` — ${c.quota}%` : ''} — ${stato}`)
    })
  }

  // ═════════ VERBALE ═════════
  spacer(8); drawHeading('2. Verbale della seduta')
  const testoVerbale = htmlATesto(d.ad.verbale_html)
  if (testoVerbale) drawText(testoVerbale)
  else { drawText('Testo del verbale non presente.', { color: colAvviso }); mancanze.push('testo del verbale della seduta') }

  // ═════════ DELIBERE ═════════
  newPage(); drawHeading('3. Delibere assunte')
  if (d.delibere.length === 0) {
    drawText('Nessuna delibera registrata in questa seduta.', { color: richiamiConAtto.length ? colAvviso : colTesto })
    if (richiamiConAtto.length) mancanze.push('delibera con esito e voti: la seduta tratta atti istruiti ma non ha delibere registrate')
  }
  d.delibere.forEach((del, i) => {
    const votiDel = d.voti.filter(v => v.delibera_id === del.id)
    const atto = attoDellaDelibera(del)
    drawSub(`3.${i + 1}  ${del.oggetto}  [${del.esito || 'esito non indicato'}]`)
    drawText('Testo della delibera', { size: 8.5, f: fontBold, color: colGrigio })
    if (del.testo) drawText(del.testo)
    else { drawText('Nessun testo registrato per questa delibera.', { color: colAvviso }); mancanze.push(`testo della delibera «${del.oggetto}»`) }
    spacer(2)
    drawText(`Favorevoli${d.isAssemblea ? ' (%)' : ''}: ${del.favorevoli} · Contrari: ${del.contrari} · Astenuti: ${del.astenuti}`, { size: 9 })
    if (votiDel.length) {
      votiDel.forEach(v => {
        const c = d.componenti.find(x => x.membro_id === v.membro_id)
        drawText(`• ${c ? nomeDi(c.membri) : '—'}: ${v.voto}`, { size: 9, indent: 10 })
      })
    } else drawText('Solo totale aggregato, nessun voto nominativo.', { size: 9, color: colAvviso })
    if (atto) drawText(`Atto istruito: ${atto.oggetto} (${numeroAtto(atto)}) — vedi sezione 4`, { size: 9, color: colGrigio })
    spacer(6)
  })

  // ═════════ ATTI ISTRUITI ═════════
  newPage(); drawHeading('4. Atti istruiti e relativa documentazione')
  if (!richiamiConAtto.length) drawText('Nessun atto istruito richiamato in questa seduta.')
  richiamiConAtto.forEach((r, i) => {
    const atto = attiById.get(r.determina_id)
    if (i > 0) newPage()
    drawSub(`4.${i + 1}  ${atto.oggetto}`)
    campo('Numero', numeroAtto(atto))
    campo('Tipo di atto', atto.tipo)
    campo('Organo', ORGANO_LABEL[atto.organo] || atto.organo)
    campo('Stato', atto.stato)
    if (atto.valore) campo('Valore', euro(atto.valore))
    campo('Area 231', atto.area_231)
    campo('Creato il', dataOra(atto.created_at))
    if (atto.data_firma) campo('Firmato il', dataOra(atto.data_firma))
    if (atto.hash_documento) drawText(`Impronta SHA-256 dell'atto: ${atto.hash_documento}`, { size: 7, color: colGrigio })
    campo('Esito nella seduta', r.esito)

    const testoAtto = htmlATesto(atto.corpo_html)
    blocco("Testo dell'atto preparato", testoAtto, 'Testo dell\'atto non presente.')
    if (!testoAtto) mancanze.push(`testo dell'atto «${atto.oggetto}»`)
    blocco('Descrizione / motivazioni', atto.descrizione)
    blocco('Analisi finanziaria', atto.analisi_finanziaria)
    if (atto.con_analisi_economica || atto.analisi_economica) blocco('Analisi economica', atto.analisi_economica, 'Analisi economica prevista ma non compilata.')
    blocco('Alternative valutate', atto.alternative)

    const rischi = d.rischi.filter(x => x.determina_id === atto.id)
    drawSub('Rischi valutati')
    if (!rischi.length) drawText('Nessun rischio indicato.', { color: colGrigio })
    rischi.forEach(x => drawText(`• ${RISCHIO_LABEL[x.categoria] || x.categoria} — livello ${x.livello}${x.mitigazione ? ` — mitigazione: ${x.mitigazione}` : ''}`, { indent: 10 }))

    const pareri = d.pareri.filter(x => x.determina_id === atto.id)
    drawSub('Pareri')
    if (!pareri.length) drawText('Nessun parere acquisito.', { color: colGrigio })
    pareri.forEach(p => {
      drawText(`• ${p.tipo}${p.fonte ? ` — ${p.fonte}` : ''}${p.data_ricezione ? ` — ricevuto il ${dataSola(p.data_ricezione)}` : ''}${p.obbligatorio ? ' (obbligatorio)' : ''}`, { indent: 10 })
      if (p.sintesi) drawText(p.sintesi, { indent: 22, size: 9 })
    })

    const checklist = Array.isArray(atto.checklist) ? atto.checklist : []
    if (checklist.length) {
      drawSub('Checklist dei giustificativi')
      checklist.forEach(c => drawText(`[${c.spuntata ? 'x' : ' '}] ${c.voce}${c.nota ? ` — ${c.nota}` : ''}`, { indent: 10 }))
    }

    const sim = (d.simulazioni || []).find(s => s.determina_id === atto.id)
    if (sim) {
      drawSub("Simulazione d'impatto economico e finanziario")
      campo('Eseguita il', dataOra(sim.created_at))
      const comp = sim.richiesta?.tipo_impatto === 'composta' ? `operazione composta da ${sim.richiesta.componenti?.length || 0} parti` : sim.richiesta?.tipo_impatto
      campo('Operazione simulata', comp)
      const alert = sim.sintesi?.alert || []
      if (alert.length) { drawText('Segnalazioni:', { size: 9, f: fontBold }); alert.forEach(a => drawText(`• ${a}`, { size: 9, indent: 10 })) }
      else drawText('Nessuna segnalazione di tensione di cassa.', { size: 9 })
      ;(sim.sintesi?.avvisi || []).forEach(a => drawText(`• ${typeof a === 'string' ? a : JSON.stringify(a)}`, { size: 9, indent: 10, color: colAvviso }))
      drawText('I prospetti completi (impatto economico e impatto finanziario) sono incorporati tra gli allegati.', { size: 9, color: colGrigio })
    }

    const allegati = d.allegati.filter(a => a.determina_id === atto.id)
    drawSub('Allegati dell\'atto')
    if (!allegati.length) drawText('Nessun allegato.', { color: colGrigio })
    allegati.forEach(a => {
      const c = contenuti.get(a.id)
      drawText(`• ${a.nome_file}${a.voce ? ` — ${a.voce}` : ''} — caricato il ${dataOra(a.created_at)} — ${kb(a.dimensione)}`, { indent: 10 })
      if (c?.hash) drawText(`SHA-256 ${c.hash}`, { indent: 22, size: 7, color: colGrigio })
    })
  })

  // ═════════ DOCUMENTAZIONE INVIATA ═════════
  newPage(); drawHeading('5. Documentazione inviata ai componenti')
  if (richiamiConAtto.length) {
    drawText('Atti e documenti messi a disposizione per la seduta:', { size: 9, f: fontBold })
    richiamiConAtto.forEach(r => {
      const atto = attiById.get(r.determina_id)
      const n = d.allegati.filter(a => a.determina_id === atto.id).length
      drawText(`• ${atto.oggetto} — ${n} ${n === 1 ? 'allegato' : 'allegati'}`, { size: 9, indent: 10 })
    })
    spacer(6)
  }
  if (d.ticket.length === 0) {
    drawText('Nessun invio registrato per questa seduta (nessuna circolarizzazione).', { color: colAvviso })
    mancanze.push('invio della documentazione ai componenti (circolarizzazione)')
  }
  // un blocco per ogni invio (stesso titolo e tipo), con il dettaglio per destinatario
  const invii = []
  d.ticket.forEach(t => {
    let inv = invii.find(x => x.titolo === t.titolo && x.tipo === t.tipo)
    if (!inv) { inv = { titolo: t.titolo, tipo: t.tipo, istruzioni: t.istruzioni, scadenza: t.scadenza, righe: [] }; invii.push(inv) }
    inv.righe.push(t)
  })
  invii.forEach((inv, i) => {
    drawSub(`5.${i + 1}  ${inv.tipo === 'presa_visione' ? 'Presa visione' : 'Incarico'}: ${inv.titolo}`)
    if (inv.istruzioni) drawText(`Note inviate: ${inv.istruzioni}`, { size: 9 })
    if (inv.scadenza) drawText(`Scadenza: ${dataSola(inv.scadenza)}`, { size: 9 })
    inv.righe.forEach(t => {
      const notif = (d.notifiche || []).filter(n => n.ticket_id === t.id).sort((a, b) => String(a.inviata_at).localeCompare(String(b.inviata_at)))
      const email = notif.filter(n => n.tipo !== 'reminder')
      const solleciti = notif.filter(n => n.tipo === 'reminder')
      drawText(`${nomeDi(t.membri)}${t.membri?.email ? ` <${t.membri.email}>` : ''}`, { size: 9.5, f: fontBold, indent: 10 })
      drawText(`Invio registrato: ${dataOra(t.created_at)}`, { size: 9, indent: 22 })
      if (email.length) email.forEach(n => drawText(`Email: ${n.successo === false ? 'NON consegnata al servizio di posta' : 'inviata'} il ${dataOra(n.inviata_at)} a ${n.email_destinatario || '—'}${n.errore ? ` (errore: ${n.errore})` : ''}`, { size: 9, indent: 22, color: n.successo === false ? colAvviso : colTesto }))
      else drawText(`Email: ${t.email_inviata ? 'inviata (orario non registrato)' : 'nessun invio email registrato'}`, { size: 9, indent: 22, color: t.email_inviata ? colTesto : colAvviso })
      solleciti.forEach(n => drawText(`Sollecito: ${dataOra(n.inviata_at)}${n.successo === false ? ' (non consegnato)' : ''}`, { size: 9, indent: 22 }))
      if (t.tipo === 'presa_visione' && !t.data_presa_visione) mancanze.push(`presa visione non confermata da ${nomeDi(t.membri)} («${inv.titolo}»)`)
      if (t.tipo === 'presa_visione') drawText(`Presa visione / ricezione: ${t.data_presa_visione ? dataOra(t.data_presa_visione) : 'NON ancora confermata'}`, { size: 9, indent: 22, color: t.data_presa_visione ? colTesto : colAvviso })
      else drawText(`Stato incarico: ${t.stato || '—'}${t.stato === 'Completato' && t.updated_at ? ` il ${dataOra(t.updated_at)}` : ''}`, { size: 9, indent: 22 })
      if (t.note_membro) drawText(`Note del destinatario: ${t.note_membro}`, { size: 9, indent: 22 })
    })
  })

  // ═════════ CRONOLOGIA ═════════
  spacer(8); drawHeading('6. Cronologia')
  if (d.eventi.length === 0) drawText('Nessun evento registrato.')
  d.eventi.forEach(e => drawText(`${dataOra(e.created_at)} — ${e.evento}${e.dettaglio ? ` — ${e.dettaglio}` : ''}`, { size: 9 }))

  // ═════════ ALLEGATI INCORPORATI ═════════
  const nonIncorporati = []
  for (let i = 0; i < daIncorporare.length; i++) {
    const a = daIncorporare[i]
    onProgresso(`Incorporo allegato ${i + 1} di ${daIncorporare.length}: ${a.nome_file}`)
    const c = contenuti.get(a.id)
    const ext = (a.nome_file.split('.').pop() || '').toLowerCase()
    const copertina = () => {
      newPage()
      drawText(`Allegato ${i + 1} di ${daIncorporare.length}`, { size: 9, color: colGrigio })
      drawText(a.nome_file, { size: 13, f: fontBold, color: colTitolo })
      campo('Atto', `${a.atto.oggetto} (${numeroAtto(a.atto)})`)
      campo('Voce del fascicolo', a.voce)
      campo('Caricato il', dataOra(a.created_at))
      campo('Dimensione', kb(a.dimensione))
      if (c?.hash) drawText(`SHA-256: ${c.hash}`, { size: 7.5, color: colGrigio })
    }
    if (c?.errore) { nonIncorporati.push({ a, motivo: `non scaricabile (${c.errore})` }); continue }
    try {
      if (ext === 'pdf') {
        const src = await PDFDocument.load(c.bytes, { ignoreEncryption: true })
        const pagine = await pdfDoc.copyPages(src, src.getPageIndices())
        copertina()
        pagine.forEach(p => pdfDoc.addPage(p))
      } else if (['png', 'jpg', 'jpeg'].includes(ext)) {
        const img = ext === 'png' ? await pdfDoc.embedPng(c.bytes) : await pdfDoc.embedJpg(c.bytes)
        copertina()
        newPage()
        const scale = Math.min(MAX_W / img.width, (PAGE_H - MARGIN * 2) / img.height, 1)
        const w = img.width * scale, h = img.height * scale
        page.drawImage(img, { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, width: w, height: h })
      } else if (['txt', 'csv'].includes(ext)) {
        copertina(); spacer(10)
        drawText(new TextDecoder().decode(c.bytes), { size: 8.5 })
      } else {
        nonIncorporati.push({ a, motivo: `formato .${ext} non incorporabile: allegare la versione PDF` })
      }
    } catch (e) {
      nonIncorporati.push({ a, motivo: `file non leggibile come ${ext.toUpperCase()} (${e.message || e})` })
    }
  }
  nonIncorporati.forEach(({ a, motivo }) => mancanze.push(`allegato «${a.nome_file}» (${a.atto.oggetto}): ${motivo}`))
  if (nonIncorporati.length) {
    newPage()
    drawHeading('Allegati NON incorporati in questo PDF')
    nonIncorporati.forEach(({ a, motivo }) => {
      drawText(`• ${a.nome_file} — ${a.atto.oggetto} — ${motivo}`, { indent: 10 })
      const c = contenuti.get(a.id)
      if (c?.hash) drawText(`SHA-256 del file originale: ${c.hash}`, { indent: 22, size: 7, color: colGrigio })
    })
  }

  // ═════════ COMPLETEZZA (in copertina) ═════════
  insertAt = 0
  newPage()
  drawHeading('Completezza del fascicolo')
  if (!mancanze.length) {
    drawText(`Fascicolo completo: verbale, ${d.delibere.length} delibere, ${richiamiConAtto.length} atti istruiti, ${d.ticket.length} invii ai componenti e ${daIncorporare.length} allegati incorporati.`, { color: rgb(0.12, 0.52, 0.29) })
  } else {
    drawText(`FASCICOLO INCOMPLETO — ${mancanze.length} ${mancanze.length === 1 ? 'elemento mancante' : 'elementi mancanti'}:`, { f: fontBold, color: colAvviso })
    mancanze.forEach(m => drawText(`• ${m}`, { size: 9, indent: 10, color: colAvviso }))
  }
  spacer(8)
  drawHeading('Indice')
  ;['1. Criteri di conformità verificati', '2. Verbale della seduta', '3. Delibere assunte', '4. Atti istruiti e relativa documentazione', '5. Documentazione inviata ai componenti', '6. Cronologia', `Allegati incorporati (${daIncorporare.length - nonIncorporati.length})`]
    .forEach(s => drawText(s, { size: 9.5 }))

  // numerazione pagine
  const pagine = pdfDoc.getPages()
  pagine.forEach((p, i) => {
    const etichetta = pulisci(`Fascicolo BJR — ${d.ad.titolo} — pag. ${i + 1}/${pagine.length}`)
    const w = font.widthOfTextAtSize(etichetta, 7)
    // sul bordo inferiore: non si sovrappone al pie' di pagina degli allegati incorporati
    p.drawText(etichetta, { x: Math.max(10, (p.getWidth() - w) / 2), y: 6, size: 6.5, font, color: colGrigio })
  })

  return { bytes: await pdfDoc.save(), mancanze }
}
