// Estrazione testo/immagini da PDF ed Excel, lato browser, prima di mandare il
// contenuto alla Edge Function AI. Porting parziale di backend/services/ai/estrattore.py
// (estrai_testo_pdf, estrai_testo_excel, elabora_pdf_scansionato).
//
// Nota: la scorciatoia deterministica per Excel (cerca_foglio_conto_economico,
// scansione delle colonne "Budget" nel foglio Conto Economico) NON è stata portata
// in questo passaggio — l'estrazione Excel passa sempre dall'AI. Può essere aggiunta
// in seguito come ottimizzazione.

import * as pdfjsLib from 'pdfjs-dist'
import * as XLSX from 'xlsx'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs'

const SOGLIA_TESTO_SCANSIONATO = 500
// La Edge Function ha un limite di tempo di esecuzione fisso della piattaforma
// (non configurabile via CLI): con più pagine il tempo di analisi vision di
// Claude può superarlo (errore 504 "gateway timeout"). Ridotto ulteriormente
// pagine/risoluzione/qualità per stare comodi sotto quel limite — a scapito
// di un minimo di leggibilità su documenti scansionati molto lunghi.
const MAX_PAGINE_VISION = 3
const SCALA_RENDER = 1.3
const QUALITA_JPEG = 0.75
const MEDIA_TYPE_VISION = 'image/jpeg'

// Restituisce { modalita: 'testo', testo } se il PDF ha testo leggibile,
// oppure { modalita: 'vision', immagini: [base64...], mediaType } se sembra scansionato.
export async function estraiPdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let testo = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    testo += content.items.map((it) => it.str).join(' ') + '\n'
  }
  testo = testo.trim()

  if (testo.length > SOGLIA_TESTO_SCANSIONATO) {
    return { modalita: 'testo', testo: testo.slice(0, 20000) }
  }

  const immagini = []
  const maxPagine = Math.min(pdf.numPages, MAX_PAGINE_VISION)
  for (let i = 1; i <= maxPagine; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: SCALA_RENDER })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    // Sfondo bianco: toDataURL su JPEG non supporta trasparenza (diventerebbe nera)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // eslint-disable-next-line no-await-in-loop
    await page.render({ canvasContext: ctx, viewport }).promise
    immagini.push(canvas.toDataURL(MEDIA_TYPE_VISION, QUALITA_JPEG).split(',')[1])
  }
  return { modalita: 'vision', immagini, mediaType: MEDIA_TYPE_VISION }
}

export async function estraiExcel(file) {
  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  let testo = ''
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    testo += `\n--- Foglio: ${sheetName} ---\n`
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })
    for (const row of rows) {
      const riga = (row || []).filter((v) => v !== null && v !== undefined && v !== '').map((v) => String(v))
      if (riga.length) testo += riga.join(' | ') + '\n'
    }
  }
  return testo.slice(0, 20000)
}
