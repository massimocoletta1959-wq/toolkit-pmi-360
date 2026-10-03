// Generazione dei due PDF d'impatto (economico e finanziario) con pdf-lib. Modulo puro: la libreria si passa come
// argomento ({ PDFDocument, StandardFonts, rgb }), cosi' gira sia nella Edge Function Deno (npm:pdf-lib) sia in Jest.
// Font standard Helvetica (WinAnsi): il testo viene ripulito dai caratteri non supportati.

const A4 = [595.28, 841.89]
const M = 42 // margine
const COL = { blu: [0.1, 0.23, 0.36], grigio: [0.42, 0.45, 0.5], chiaro: [0.93, 0.94, 0.96], bordo: [0.82, 0.84, 0.87], rosso: [0.86, 0.15, 0.15], verde: [0.13, 0.65, 0.33], giallo: [0.85, 0.55, 0.05], ambra: [1, 0.97, 0.9], base: [0.15, 0.39, 0.92], nd: [0.61, 0.64, 0.69] }
const SERIE = { baseline: COL.nd, worst: COL.rosso, base: COL.base, best: COL.verde }

const pulisci = (t) =>
  String(t ?? '')
    .replace(/[−–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/→/g, '->')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[  ]/g, ' ')
    .replace(/[^\x20-\x7E¡-ÿ€]/g, '?')

const num = (n, dec = 0) => {
  if (n == null || Number.isNaN(n)) return '-'
  const neg = n < 0
  const [i, d] = Math.abs(n).toFixed(dec).split('.')
  return `${neg ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${d ? `,${d}` : ''}`
}
const eur = (n) => (n == null ? '-' : `${num(n)} €`)
const eurSegno = (n) => (n == null ? '-' : `${n > 0 ? '+' : ''}${num(n)} €`)
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const meseCorto = (yyyymm) => { const [y, m] = String(yyyymm).split('-'); return `${MESI[Number(m) - 1]} ${String(y).slice(2)}` }
const dataIt = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '-')

class Documento {
  constructor(lib, font, bold, pdf, intestazione) {
    this.lib = lib; this.font = font; this.bold = bold; this.pdf = pdf; this.intestazione = intestazione
    this.pagine = []
    this.nuovaPagina()
  }
  rgb(c) { return this.lib.rgb(c[0], c[1], c[2]) }
  nuovaPagina() {
    this.page = this.pdf.addPage(A4)
    this.pagine.push(this.page)
    this.y = A4[1] - M
    if (this.pagine.length > 1) {
      this.page.drawText(pulisci(this.intestazione), { x: M, y: A4[1] - 26, size: 7.5, font: this.font, color: this.rgb(COL.grigio) })
      this.page.drawLine({ start: { x: M, y: A4[1] - 32 }, end: { x: A4[0] - M, y: A4[1] - 32 }, thickness: 0.5, color: this.rgb(COL.bordo) })
      this.y = A4[1] - 50
    }
  }
  spazio(h) { if (this.y - h < M + 24) this.nuovaPagina() }
  righeTesto(testo, size, font, larghezza) {
    const parole = pulisci(testo).split(/\s+/).filter(Boolean)
    const righe = []
    let corrente = ''
    for (const p of parole) {
      const prova = corrente ? `${corrente} ${p}` : p
      if (font.widthOfTextAtSize(prova, size) > larghezza && corrente) { righe.push(corrente); corrente = p } else corrente = prova
    }
    if (corrente) righe.push(corrente)
    return righe
  }
  testo(t, { size = 9, bold = false, colore = COL.blu, rientro = 0, sotto = 3 } = {}) {
    const font = bold ? this.bold : this.font
    for (const r of this.righeTesto(t, size, font, A4[0] - 2 * M - rientro)) {
      this.spazio(size + 3)
      this.page.drawText(r, { x: M + rientro, y: this.y - size, size, font, color: this.rgb(colore) })
      this.y -= size + 3
    }
    this.y -= sotto
  }
  titolo(t) { this.spazio(30); this.y -= 6; this.testo(t, { size: 12, bold: true, sotto: 2 }); this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4[0] - M, y: this.y }, thickness: 1, color: this.rgb(COL.blu) }); this.y -= 8 }
  elenco(voci, opts = {}) { for (const v of voci) this.testo(`- ${v}`, { size: 8.5, rientro: 8, colore: COL.blu, sotto: 1, ...opts }) ; this.y -= 3 }
  riquadro(t, colore = COL.ambra, bordo = COL.giallo) {
    const righe = this.righeTesto(t, 8.5, this.font, A4[0] - 2 * M - 16)
    const h = righe.length * 11.5 + 10
    this.spazio(h + 6)
    this.page.drawRectangle({ x: M, y: this.y - h, width: A4[0] - 2 * M, height: h, color: this.rgb(colore), borderColor: this.rgb(bordo), borderWidth: 0.7 })
    righe.forEach((r, i) => this.page.drawText(r, { x: M + 8, y: this.y - 13 - i * 11.5, size: 8.5, font: this.font, color: this.rgb(COL.blu) }))
    this.y -= h + 8
  }
  // tabella: colonne [{t, w, al:'l'|'r'}], righe: array di array (stringhe) oppure { celle, colori, grassetto, sfondo }
  tabella(colonne, righe, { size = 8, altezzaRiga = 15 } = {}) {
    const larghezzaTot = colonne.reduce((s, c) => s + c.w, 0)
    const disegnaTesta = () => {
      this.spazio(altezzaRiga * 2)
      this.page.drawRectangle({ x: M, y: this.y - altezzaRiga, width: larghezzaTot, height: altezzaRiga, color: this.rgb(COL.blu) })
      let x = M
      for (const c of colonne) {
        const w = this.bold.widthOfTextAtSize(pulisci(c.t), size)
        this.page.drawText(pulisci(c.t), { x: c.al === 'r' ? x + c.w - 4 - w : x + 4, y: this.y - altezzaRiga + 4.5, size, font: this.bold, color: this.rgb([1, 1, 1]) })
        x += c.w
      }
      this.y -= altezzaRiga
    }
    disegnaTesta()
    righe.forEach((riga, ri) => {
      const cfg = Array.isArray(riga) ? { celle: riga } : riga
      if (this.y - altezzaRiga < M + 24) { this.nuovaPagina(); disegnaTesta() }
      if (cfg.sfondo || ri % 2 === 1) this.page.drawRectangle({ x: M, y: this.y - altezzaRiga, width: larghezzaTot, height: altezzaRiga, color: this.rgb(cfg.sfondo || COL.chiaro) })
      let x = M
      colonne.forEach((c, ci) => {
        const font = cfg.grassetto ? this.bold : this.font
        const testo = pulisci(cfg.celle[ci] ?? '')
        const w = font.widthOfTextAtSize(testo, size)
        this.page.drawText(testo, { x: c.al === 'r' ? x + c.w - 4 - w : x + 4, y: this.y - altezzaRiga + 4.5, size, font, color: this.rgb((cfg.colori && cfg.colori[ci]) || COL.blu) })
        x += c.w
      })
      this.y -= altezzaRiga
    })
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: M + larghezzaTot, y: this.y }, thickness: 0.5, color: this.rgb(COL.bordo) })
    this.y -= 10
  }
  // grafico a linee: serie = [{nome, valori[], colore}], etichette = mesi
  grafico(serie, etichette, { altezza = 170, titolo }) {
    const w = A4[0] - 2 * M
    this.spazio(altezza + 40)
    if (titolo) this.testo(titolo, { size: 9, bold: true, sotto: 4 })
    const x0 = M + 46
    const larg = w - 56
    const yTop = this.y - 6
    const yBase = yTop - altezza
    const tutti = serie.flatMap((s) => s.valori)
    let min = Math.min(...tutti, 0)
    let max = Math.max(...tutti, 0)
    if (max === min) max = min + 1
    const pad = (max - min) * 0.06
    min -= pad; max += pad
    const py = (v) => yBase + ((v - min) / (max - min)) * altezza
    const px = (i) => x0 + (i / (etichette.length - 1)) * larg
    for (let g = 0; g <= 4; g++) {
      const v = min + ((max - min) * g) / 4
      this.page.drawLine({ start: { x: x0, y: py(v) }, end: { x: x0 + larg, y: py(v) }, thickness: 0.3, color: this.rgb(COL.bordo) })
      this.page.drawText(pulisci(num(Math.round(v))), { x: M, y: py(v) - 3, size: 6.5, font: this.font, color: this.rgb(COL.grigio) })
    }
    if (min < 0 && max > 0) this.page.drawLine({ start: { x: x0, y: py(0) }, end: { x: x0 + larg, y: py(0) }, thickness: 0.9, color: this.rgb(COL.grigio) })
    etichette.forEach((e, i) => { if (i % 1 === 0) this.page.drawText(pulisci(meseCorto(e)), { x: px(i) - 8, y: yBase - 11, size: 6, font: this.font, color: this.rgb(COL.grigio) }) })
    for (const s of serie) {
      for (let i = 1; i < s.valori.length; i++) this.page.drawLine({ start: { x: px(i - 1), y: py(s.valori[i - 1]) }, end: { x: px(i), y: py(s.valori[i]) }, thickness: s.spessore || 1.3, color: this.rgb(s.colore), dashArray: s.tratteggio ? [3, 2] : undefined })
    }
    let lx = x0
    for (const s of serie) {
      this.page.drawLine({ start: { x: lx, y: yBase - 24 }, end: { x: lx + 14, y: yBase - 24 }, thickness: 2, color: this.rgb(s.colore) })
      this.page.drawText(pulisci(s.nome), { x: lx + 18, y: yBase - 27, size: 7, font: this.font, color: this.rgb(COL.blu) })
      lx += 26 + this.font.widthOfTextAtSize(pulisci(s.nome), 7) + 14
    }
    this.y = yBase - 38
  }
  chiudi(nota) {
    const n = this.pagine.length
    this.pagine.forEach((p, i) => {
      p.drawText(pulisci(`${nota}  -  Pagina ${i + 1} di ${n}`), { x: M, y: 22, size: 7, font: this.font, color: this.rgb(COL.grigio) })
    })
  }
}

const semaforoTesto = (s) => ({ verde: 'verde', giallo: 'giallo', rosso: 'rosso', nd: 'n.d.' }[s] || s)
const semaforoColore = (s) => ({ verde: COL.verde, giallo: COL.giallo, rosso: COL.rosso, nd: COL.nd }[s] || COL.blu)

const TIPI_LEGGIBILI = { leasing: 'Leasing', acquisto_bene: 'Acquisto di un bene strumentale', finanziamento: 'Finanziamento', costo_ricorrente: 'Costo ricorrente', costo_una_tantum: 'Costo una tantum', composta: 'Decisione composta' }

function copertina(doc, titolo, ctx) {
  const { azienda, richiesta, risultato, simulazioneId, creatoIl } = ctx
  const d = richiesta.decisione
  doc.page.drawRectangle({ x: 0, y: A4[1] - 74, width: A4[0], height: 74, color: doc.rgb(COL.blu) })
  doc.page.drawText(pulisci(titolo), { x: M, y: A4[1] - 38, size: 18, font: doc.bold, color: doc.rgb([1, 1, 1]) })
  doc.page.drawText(pulisci(`${azienda.nome}  -  ${d.descrizione}`), { x: M, y: A4[1] - 58, size: 10, font: doc.font, color: doc.rgb([0.85, 0.9, 0.97]) })
  doc.y = A4[1] - 96
  doc.tabella([{ t: 'Dato', w: 150 }, { t: 'Valore', w: A4[0] - 2 * M - 150 }], [
    ['Determina (riferimento)', richiesta.determina_ref],
    ['Simulazione', simulazioneId],
    ['Generata il', dataIt(creatoIl)],
    ['Proiezione di Tesoreria usata', `${dataIt(risultato.baseline.generato_il)} (finestra ${meseCorto(risultato.baseline.finestra.da)}, ${risultato.baseline.finestra.mesi} mesi)`],
    ['Decorrenza della decisione', dataIt(d.data_decorrenza)],
    ['Tipo di impatto', TIPI_LEGGIBILI[d.tipo_impatto] || d.tipo_impatto],
    ...(d.tipo_impatto === 'leasing' ? [['Metodo contabile del leasing', d.leasing.metodo_contabile === 'patrimoniale' ? 'Patrimoniale (canone a costo, OIC)' : 'Finanziario (IAS/IFRS 16)']] : []),
  ], { size: 8 })
}

function sezioneDecisione(doc, ctx) {
  const d = ctx.richiesta.decisione
  doc.titolo('La decisione simulata')
  const righeComuni = [
    ...(d.iva_regime && d.iva_regime !== 'ordinaria' ? [['Regime IVA', d.iva_regime]] : []),
    ['Aliquota IVA usata (anagrafica EasyPMI)', `${ctx.risultato.ipotesi_usate.aliquota_iva_usata}%`],
    ...(d.ipotesi_ricavi ? [['Ipotesi di ricavi aggiuntivi', `${d.ipotesi_ricavi.modalita === 'incremento_pct' ? `+${d.ipotesi_ricavi.valore}% dei ricavi` : `${eur(d.ipotesi_ricavi.valore)}/mese`} da ${meseCorto(d.ipotesi_ricavi.mese_partenza.slice(0, 7))}`]] : []),
  ]
  if (d.tipo_impatto === 'leasing') {
    // Reso invariato rispetto alla v7 (non regressione): formattazione dedicata del leasing.
    const L = d.leasing
    const pr = ctx.risultato.piano_rate
    doc.tabella([{ t: 'Parametro', w: 190 }, { t: 'Valore', w: A4[0] - 2 * M - 190, al: 'r' }], [
      ['Valore del bene (imponibile)', eur(d.imponibile)],
      ['Maxicanone iniziale (IVA esclusa)', eur(L.maxicanone)],
      ['Numero di rate', `${L.numero_rate} (${L.periodicita})`],
      [`Canone periodico (IVA esclusa)${ctx.risultato.ipotesi_usate.rata_derivata ? ' - calcolato' : ''}`, eur(pr.rata_periodica_iva_esclusa)],
      ['Riscatto finale (IVA esclusa)', eur(L.riscatto)],
      ['Costi di esercizio mensili', eur(d.costi_esercizio_mensili)],
      ...(L.metodo_contabile === 'finanziario' ? [['Tasso annuo / durata ammortamento', `${L.tasso_annuo_pct}% / ${d.ammortamento.durata_mesi} mesi`]] : []),
      ...righeComuni,
    ], { size: 8 })
    return
  }
  // Altri tipi (v8): tabella generica, costruita dal generatore stesso (dettaglio_tipo) + le righe comuni.
  const dettaglio = ctx.risultato.ipotesi_usate.dettaglio_tipo
  doc.tabella([{ t: 'Parametro', w: 190 }, { t: 'Valore', w: A4[0] - 2 * M - 190, al: 'r' }], [...(dettaglio?.righe || []), ...righeComuni], { size: 8 })
}

function sezioneAvvisi(doc, ctx) {
  const a = ctx.risultato.avvisi
  if (a.length) { doc.titolo('Avvisi'); for (const x of a) doc.riquadro(`${x.codice}: ${x.messaggio}`) }
}

function sezioneIpotesi(doc, ctx) {
  const ip = ctx.risultato.ipotesi_usate
  doc.titolo('Ipotesi e limiti')
  doc.elenco([
    `Scenari: worst = ${ip.scenari.worst}; base = ${ip.scenari.base}; best = ${ip.scenari.best}.`,
    `Utile espresso ${ip.utile_espresso === 'ante_imposte' ? 'ANTE IMPOSTE' : ip.utile_espresso}. Conto Economico baseline: ${ip.ce_baseline}.`,
    `Finestra del confronto: ${meseCorto(ip.finestra.da)} - ${meseCorto(ip.finestra.a)} (${ip.finestra.mesi} mesi mobili, non l'esercizio civile).`,
    `Pagamenti sfasati di ${ip.dpo_usato_giorni} giorni (DPO), incassi di ${ip.dso_usato_giorni} giorni (DSO); IVA canone per canone, recuperata alla liquidazione ${ctx.risultato.baseline.liquidazione || ''}`.trim() + '.',
    `Ricavi ipotizzati: ${ip.ricavi_ipotizzati}.`,
    ...ip.limiti_noti,
  ])
}

const PARAM = { patrimoniale: 'Patrimoniale: il canone e\' costo pieno a Conto Economico in B8 (godimento beni di terzi), quindi l\'impatto sta soprattutto sull\'EBITDA. Nessun ammortamento e nessuno scorporo di interessi in capo al locatario.', finanziario: 'Finanziario: l\'EBITDA resta vicino a zero (solo i costi di esercizio); l\'impatto compare sull\'EBIT (ammortamento del bene) e sull\'utile ante imposte (interessi passivi, sotto l\'EBIT).' }

export async function generaPdfImpatto(lib, ctx) {
  const { PDFDocument, StandardFonts } = lib
  const r = ctx.risultato
  const intestazione = `${ctx.azienda.nome} - Simulazione d'impatto ${ctx.simulazioneId} - determina ${ctx.richiesta.determina_ref}`
  const nota = `EasyPMI - simulazione ${ctx.simulazioneId}`

  const nuovo = async () => {
    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    return new Documento(lib, font, bold, pdf, intestazione)
  }

  // ================= PDF ECONOMICO =================
  const eco = await nuovo()
  copertina(eco, 'Impatto economico', ctx)
  sezioneDecisione(eco, ctx)
  sezioneAvvisi(eco, ctx)
  eco.titolo('Conto Economico: baseline e scenari (12 mesi, ante imposte)')
  const nomi = [['ebitda', 'EBITDA'], ['ebit', 'EBIT'], ['oneri_finanziari', 'Oneri finanziari netti'], ['utile', 'Utile ante imposte']]
  const S = r.scenari
  const wq = (A4[0] - 2 * M - 128) / 4
  eco.tabella([{ t: 'Valori', w: 128 }, { t: 'Baseline', w: wq, al: 'r' }, { t: 'Worst', w: wq, al: 'r' }, { t: 'Base', w: wq, al: 'r' }, { t: 'Best', w: wq, al: 'r' }],
    nomi.map(([k, t]) => ({ celle: [t, eur(S.worst.conto_economico[k].baseline), eur(S.worst.conto_economico[k].scenario), eur(S.base.conto_economico[k].scenario), eur(S.best.conto_economico[k].scenario)], grassetto: k === 'utile' })))
  eco.testo('Variazione rispetto al baseline', { size: 9, bold: true, sotto: 4 })
  eco.tabella([{ t: 'Delta', w: 128 }, { t: 'Worst', w: wq * 2, al: 'r' }, { t: 'Base', w: wq, al: 'r' }, { t: 'Best', w: wq, al: 'r' }],
    nomi.map(([k, t]) => {
      const dd = [S.worst, S.base, S.best].map((s) => s.conto_economico[k].delta)
      return { celle: [t, eurSegno(dd[0]), eurSegno(dd[1]), eurSegno(dd[2])], colori: [COL.blu, dd[0] < 0 ? COL.rosso : COL.verde, dd[1] < 0 ? COL.rosso : COL.verde, dd[2] < 0 ? COL.rosso : COL.verde], grassetto: k === 'utile' }
    }))
  if (ctx.richiesta.decisione.tipo_impatto === 'leasing') {
    eco.titolo('Dove atterra l\'impatto')
    eco.testo(PARAM[ctx.richiesta.decisione.leasing.metodo_contabile], { size: 9 })
  }
  if (r.dettaglio_componenti) {
    eco.titolo('Contributo di ciascun componente (scenario worst)')
    const wc = (A4[0] - 2 * M - 190) / 3
    eco.tabella([{ t: 'Componente', w: 190 }, { t: 'EBITDA', w: wc, al: 'r' }, { t: 'Utile ante imposte', w: wc, al: 'r' }, { t: 'Cassa a fine finestra', w: wc, al: 'r' }],
      r.dettaglio_componenti.map((c) => ({ celle: [`${c.indice}. ${TIPI_LEGGIBILI[c.tipo_impatto] || c.tipo_impatto}`, eurSegno(c.delta_ebitda_worst), eurSegno(c.delta_utile_worst), eurSegno(c.delta_cassa_finale_worst)], colori: [COL.blu, c.delta_ebitda_worst < 0 ? COL.rosso : COL.verde, c.delta_utile_worst < 0 ? COL.rosso : COL.verde, c.delta_cassa_finale_worst < 0 ? COL.rosso : COL.verde] })), { size: 8 })
  }
  eco.testo(r.confronto_baseline.testo, { size: 9, bold: true })
  eco.titolo('Utile ante imposte: andamento mensile del delta')
  eco.grafico([
    { nome: 'Worst (solo effetti certi)', valori: S.worst.conto_economico.mensile.map((m) => m.utile), colore: SERIE.worst },
    { nome: 'Base', valori: S.base.conto_economico.mensile.map((m) => m.utile), colore: SERIE.base },
    { nome: 'Best', valori: S.best.conto_economico.mensile.map((m) => m.utile), colore: SERIE.best },
  ], S.worst.conto_economico.mensile.map((m) => m.mese), { altezza: 150, titolo: 'Effetto della decisione sull\'utile ante imposte, per mese (€)' })
  eco.titolo('Ricavi ipotizzati e storico dell\'azienda')
  const rs = r.range_storico_ricavi
  eco.tabella([{ t: 'Dato', w: 200 }, { t: 'Valore', w: A4[0] - 2 * M - 200, al: 'r' }], [
    ['Base del confronto', 'incassi mensili medi reali (fatturato mensile medio)'],
    ['Media mensile', eur(rs.media_mensile)],
    ['Minimo / massimo mensile storico', `${eur(rs.banda_min)} / ${eur(rs.banda_max)} (${rs.n_mesi_reali} mesi)`],
  ])
  eco.testo(rs.giudizio_testo, { size: 9 })
  sezioneIpotesi(eco, ctx)
  eco.chiudi(nota)

  // ================= PDF FINANZIARIO =================
  const fin = await nuovo()
  copertina(fin, 'Impatto finanziario', ctx)
  sezioneDecisione(fin, ctx)
  sezioneAvvisi(fin, ctx)
  fin.titolo('Saldo di cassa: baseline e scenari')
  const et = S.worst.mesi.map((m) => m.mese)
  fin.grafico([
    { nome: 'Baseline', valori: S.worst.mesi.map((m) => m.cassa_baseline), colore: SERIE.baseline, tratteggio: true },
    { nome: 'Worst', valori: S.worst.mesi.map((m) => m.cassa_scenario), colore: SERIE.worst },
    { nome: 'Base', valori: S.base.mesi.map((m) => m.cassa_scenario), colore: SERIE.base },
    { nome: 'Best', valori: S.best.mesi.map((m) => m.cassa_scenario), colore: SERIE.best },
    { nome: 'Buffer minimo', valori: S.worst.mesi.map((m) => m.buffer_minimo), colore: COL.giallo, tratteggio: true, spessore: 0.8 },
  ], et, { altezza: 170, titolo: 'Saldo di cassa a fine mese (€)' })
  const wm = (A4[0] - 2 * M - 46) / 5
  fin.tabella([{ t: 'Mese', w: 46 }, { t: 'Baseline', w: wm, al: 'r' }, { t: 'Worst', w: wm, al: 'r' }, { t: 'Base', w: wm, al: 'r' }, { t: 'Best', w: wm, al: 'r' }, { t: 'Buffer', w: wm, al: 'r' }],
    S.worst.mesi.map((m, i) => ({ celle: [meseCorto(m.mese), num(m.cassa_baseline), num(m.cassa_scenario), num(S.base.mesi[i].cassa_scenario), num(S.best.mesi[i].cassa_scenario), num(m.buffer_minimo)], colori: [COL.blu, COL.blu, semaforoColore(m.semaforo_scenario), COL.blu, COL.blu, COL.grigio] })), { size: 7.5, altezzaRiga: 13.5 })
  fin.testo(r.confronto_baseline.testo, { size: 9, bold: true })
  if (r.alert.length) { fin.titolo('Alert'); fin.elenco(r.alert) }
  fin.titolo('Stress test (CNDCEC 2.5g): senza e con la decisione')
  fin.testo(`Gli stress test sono applicati alla proiezione con la decisione nello scenario ${r.stress_test.scenario_di_riferimento.toUpperCase()} (solo effetti certi) e confrontati con la proiezione senza la decisione.`, { size: 8.5 })
  const ws = (A4[0] - 2 * M - 170) / 5
  fin.tabella([{ t: 'Scenario di stress', w: 170 }, { t: 'Senza', w: ws }, { t: 'Saldo min.', w: ws, al: 'r' }, { t: 'Con decisione', w: ws }, { t: 'Saldo min.', w: ws, al: 'r' }, { t: 'Mese critico', w: ws }],
    r.stress_test.baseline.map((b, i) => {
      const c = r.stress_test.con_decisione[i]
      return { celle: [b.scenario_nome, semaforoTesto(b.semaforo), b.saldo_minimo == null ? '-' : num(b.saldo_minimo), semaforoTesto(c.semaforo), c.saldo_minimo == null ? '-' : num(c.saldo_minimo), c.mese_critico || '-'], colori: [COL.blu, semaforoColore(b.semaforo), COL.blu, semaforoColore(c.semaforo), COL.blu, COL.blu] }
    }), { size: 7.5 })
  const nonApplicabili = r.stress_test.con_decisione.filter((s) => s.applicabile === false)
  if (nonApplicabili.length) fin.elenco(nonApplicabili.map((s) => s.messaggio))
  const coperti = r.stress_test.con_decisione.filter((s) => s.coperto != null && s.fabbisogno_max > 0)
  if (coperti.length) fin.elenco(coperti.map((s) => `${s.scenario_nome}: fabbisogno massimo ${eur(s.fabbisogno_max)}, linee disponibili ${eur(s.linee_disponibili)} -> ${s.coperto ? 'coperto' : 'NON coperto'}.`))
  fin.titolo('IVA e tempi di cassa')
  fin.elenco([
    ...(ctx.richiesta.decisione.tipo_impatto === 'leasing'
      ? ['L\'IVA non si paga in un colpo sull\'imponibile finanziato: si versa canone per canone, piu\' IVA sul maxicanone all\'inizio e IVA sul riscatto alla fine.', 'La cassa in uscita e\' la stessa nei due metodi contabili: cambia solo dove atterra l\'impatto nel Conto Economico.']
      : []),
    `I pagamenti sono sfasati di ${r.ipotesi_usate.dpo_usato_giorni} giorni; il credito IVA e' recuperato alla liquidazione (mensile/trimestrale) successiva.`,
  ])
  sezioneIpotesi(fin, ctx)
  fin.chiudi(nota)

  return { economico: await eco.pdf.save(), finanziario: await fin.pdf.save() }
}
