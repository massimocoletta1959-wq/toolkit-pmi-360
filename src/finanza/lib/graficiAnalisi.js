// Grafici del report "Analisi Bilancio" — porting client-side (Chart.js) degli
// 8 grafici che il vecchio backend (backend/api/analisi_narrativa_pdf.py,
// matplotlib) generava per il PDF: stessi dati, stesse soglie, stesso
// significato, adattati all'idioma Chart.js invece che matplotlib.
const C = {
  blu: '#0f2d52', blu2: '#185fa5', bluch: '#dbeafe',
  verde: '#1a6b2e', rosso: '#a32d2d', aran: '#854f0b',
  grigio: '#f4f6f9', g2: '#e2e8f0', nero: '#1e293b',
  testo: '#6b7280', a1: '#3b82f6', a2: '#10b981', a3: '#f59e0b', a4: '#ef4444',
}

const g = (ind, k, d = 0) => {
  const v = ind?.[k]
  return typeof v === 'number' && !Number.isNaN(v) ? v : d
}

const fk = (n) => {
  if (n == null) return 'N/D'
  const abs = Math.abs(n)
  if (abs >= 1000000) return `€${(n / 1000000).toFixed(2)}M`
  if (abs >= 1000) return `€${(n / 1000).toFixed(0)}k`
  return `€${n.toFixed(0)}`
}

const baseOptions = (title) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: { display: true, text: title, color: C.blu, font: { size: 13, weight: 'bold' } },
    legend: { display: false },
  },
  scales: {
    x: { grid: { display: false } },
    y: { grid: { color: C.g2 }, beginAtZero: true },
  },
})

// 1) Conto Economico: Ricavi/EBITDA/EBIT/Utile, corrente vs precedente
export function configCe(ind, indPrev, annoC, annoP) {
  const labels = ['Ricavi', 'EBITDA', 'EBIT', 'Utile netto']
  const keys = ['ricavi', 'ebitda', 'ebit', 'utile']
  const valsC = keys.map((k) => g(ind, k))
  const valsP = keys.map((k) => g(indPrev, k))
  const hasP = !!indPrev && valsP.some((v) => v > 0)
  const datasets = hasP
    ? [
        { label: String(annoP), data: valsP, backgroundColor: [C.blu2, C.a2, C.a1, C.verde].map((c) => c + '48') },
        { label: String(annoC), data: valsC, backgroundColor: [C.blu2, C.a2, C.a1, C.verde] },
      ]
    : [{ label: String(annoC), data: valsC, backgroundColor: [C.blu2, C.a2, C.a1, C.verde] }]
  return {
    type: 'bar',
    data: { labels, datasets },
    options: {
      ...baseOptions('Conto Economico'),
      plugins: { ...baseOptions('Conto Economico').plugins, legend: { display: hasP, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } } },
      scales: { ...baseOptions('').scales, y: { ticks: { callback: (v) => fk(v) } } },
    },
  }
}

// 2) Indicatori di rischio: Leva D/E e Debiti/EBITDA vs soglia
export function configRischio(ind) {
  const lev = g(ind, 'lev')
  const de = g(ind, 'debiti_ebitda') || g(ind, 'tot_debiti') / Math.max(g(ind, 'ebitda', 1), 1)
  const soglie = [2.0, 4.0]
  const vals = [lev, de]
  const colori = vals.map((v, i) => (v <= soglie[i] ? C.verde : C.rosso))
  return {
    type: 'bar',
    data: { labels: ['Leva D/E', 'Debiti / EBITDA'], datasets: [{ data: vals, backgroundColor: colori, barThickness: 60 }] },
    options: {
      ...baseOptions('Indicatori di rischio finanziario'),
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (v) => `${v}x` } } },
      plugins: {
        ...baseOptions('').plugins,
        title: { display: true, text: 'Indicatori di rischio finanziario', color: C.blu, font: { size: 13, weight: 'bold' } },
        annotation: {
          annotations: {
            s0: { type: 'line', scaleID: 'y', value: soglie[0], borderColor: C.rosso, borderDash: [6, 4], borderWidth: 1.5, xMin: -0.4, xMax: 0.4, label: { display: true, content: `Soglia ${soglie[0]}x`, position: 'end', font: { size: 9 } } },
            s1: { type: 'line', scaleID: 'y', value: soglie[1], borderColor: C.rosso, borderDash: [6, 4], borderWidth: 1.5, xMin: 0.6, xMax: 1.4, label: { display: true, content: `Soglia ${soglie[1]}x`, position: 'end', font: { size: 9 } } },
          },
        },
      },
    },
  }
}

// 3) Indici di redditività (orizzontale) vs soglia ottimale
export function configEconomica(ind) {
  const metriche = [
    { l: 'ROI', v: g(ind, 'roi'), s: 10 },
    { l: 'ROS', v: g(ind, 'ros'), s: 10 },
    { l: 'EBITDA Margin', v: g(ind, 'ebitda_margin'), s: 15 },
    { l: 'ROE', v: g(ind, 'roe'), s: 15 },
  ]
  return {
    type: 'bar',
    data: {
      labels: metriche.map((m) => m.l),
      datasets: [{ data: metriche.map((m) => m.v), backgroundColor: [C.a1, C.a2, C.blu2, C.verde], barThickness: 22 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Indici di redditività', color: C.blu, font: { size: 13, weight: 'bold' } },
        legend: { display: false },
      },
      scales: { x: { ticks: { callback: (v) => `${v}%` } }, y: { grid: { display: false } } },
    },
  }
}

// 4a) Struttura patrimoniale (barre)
export function configPatrimonialeStruttura(ind) {
  const items = [
    { l: 'Tot. Attivo', v: g(ind, 'tot_attivo'), c: C.a1 },
    { l: 'Att. Circ.', v: g(ind, 'attivo_circ'), c: C.a2 },
    { l: 'Deb. Breve', v: g(ind, 'debiti_breve'), c: C.a4 },
    { l: 'Patr. Netto', v: g(ind, 'pn'), c: C.blu2 },
  ]
  return {
    type: 'bar',
    data: { labels: items.map((i) => i.l), datasets: [{ data: items.map((i) => i.v), backgroundColor: items.map((i) => i.c) }] },
    options: { ...baseOptions('Struttura patrimoniale'), scales: { ...baseOptions('').scales, y: { ticks: { callback: (v) => fk(v) } } } },
  }
}

// 4b) Fonti di finanziamento (torta: PN/TFR/Debiti)
export function configPatrimonialeFonti(ind) {
  const pn = g(ind, 'pn')
  const tfr = g(ind, 'tfr')
  const deb = g(ind, 'tot_debiti')
  const voci = [['Patrimonio Netto', pn, C.blu2], ['TFR', tfr, C.a3], ['Debiti', deb, C.a4]].filter((v) => v[1] > 0)
  return {
    type: 'doughnut',
    data: { labels: voci.map((v) => v[0]), datasets: [{ data: voci.map((v) => v[1]), backgroundColor: voci.map((v) => v[2]) }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Fonti di finanziamento', color: C.blu, font: { size: 13, weight: 'bold' } },
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
      },
    },
  }
}

// 5) Cash flow: autofinanziamento/EBITDA, copertura debiti, buffer liquidità
export function configCashflow(ind) {
  const utile = g(ind, 'utile')
  const amm = g(ind, 'amm')
  const ebitda = Math.max(g(ind, 'ebitda', 1), 1)
  const debiti = g(ind, 'tot_debiti')
  const liq = g(ind, 'liquidita')
  const ricavi = Math.max(Math.abs(g(ind, 'ricavi', 1)), 1)
  const auto = utile + amm
  const autoPct = Math.min(Math.max((auto / ebitda) * 100, -200), 200)
  const copPct = Math.min(debiti > 0 ? (auto / debiti) * 100 : 0, 200)
  const bufferGg = Math.min(ricavi > 0 ? liq / (ricavi / 365) : 0, 365)
  const metriche = [
    { l: 'Autofinanziamento / EBITDA', v: autoPct, s: 15, u: '%' },
    { l: 'Copertura debiti', v: copPct, s: 15, u: '%' },
    { l: 'Buffer liquidità', v: bufferGg, s: 15, u: 'gg' },
  ]
  return {
    type: 'bar',
    data: {
      labels: metriche.map((m) => m.l),
      datasets: [{ data: metriche.map((m) => m.v), backgroundColor: metriche.map((m) => (m.v >= m.s ? C.verde : C.rosso)), barThickness: 50 }],
    },
    options: {
      ...baseOptions('Sostenibilità del debito e cash flow'),
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
    },
  }
}

// 6) Radar posizionamento settoriale vs benchmark PMI
export function configSettore(ind) {
  const cats = ['ROS %', 'ROI %', 'EBITDA %', 'Current Ratio', 'Solidità']
  const azRaw = [g(ind, 'ros'), g(ind, 'roi'), g(ind, 'ebitda_margin'), g(ind, 'current_ratio'), Math.min(10 / Math.max(g(ind, 'lev', 10), 0.01), 10)]
  const bench = [7, 8, 9, 1.8, 5]
  const maxs = [20, 20, 20, 3, 10]
  const azN = azRaw.map((v, i) => Math.min(Math.abs(v) / maxs[i] * 10, 10))
  const beN = bench.map((v, i) => Math.min(v / maxs[i] * 10, 10))
  return {
    type: 'radar',
    data: {
      labels: cats,
      datasets: [
        { label: 'Azienda', data: azN, borderColor: C.blu2, backgroundColor: C.blu2 + '33', pointBackgroundColor: C.blu2 },
        { label: 'Benchmark PMI', data: beN, borderColor: C.aran, backgroundColor: C.aran + '1a', pointBackgroundColor: C.aran, borderDash: [5, 4] },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Posizionamento vs benchmark', color: C.blu, font: { size: 13, weight: 'bold' } },
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
      },
      scales: { r: { min: 0, max: 10, ticks: { stepSize: 2, font: { size: 8 } }, pointLabels: { font: { size: 10 } } } },
    },
  }
}

// 7) Proiezione patrimonio netto (prudente vs ottimale)
export function configStrategie(ind, annoC) {
  const pn = g(ind, 'pn')
  const utile = g(ind, 'utile')
  const a0 = parseInt(annoC, 10) || new Date().getFullYear()
  const anni = [a0, a0 + 1, a0 + 2, a0 + 3]
  const pnC = [pn]
  const pnO = [pn]
  for (let i = 0; i < 3; i++) {
    pnC.push(pnC[pnC.length - 1] + utile * 0.4)
    pnO.push(pnO[pnO.length - 1] + utile * 0.75)
  }
  const soglia = g(ind, 'tot_debiti') / 3
  return {
    type: 'line',
    data: {
      labels: anni.map(String),
      datasets: [
        { label: 'Prudente (40% ret.)', data: pnC, borderColor: C.a3, backgroundColor: C.a3, borderDash: [6, 4] },
        { label: 'Ottimale (75% ret.)', data: pnO, borderColor: C.verde, backgroundColor: C.verde, fill: '+1', tension: 0.15 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Proiezione patrimonio netto', color: C.blu, font: { size: 13, weight: 'bold' } },
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
        annotation: {
          annotations: {
            target: { type: 'line', scaleID: 'y', value: soglia, borderColor: C.rosso, borderDash: [3, 3], borderWidth: 1.2, label: { display: true, content: `Target D/E≤3 (${fk(soglia)})`, position: 'start', font: { size: 9 } } },
          },
        },
      },
      scales: { y: { ticks: { callback: (v) => fk(v) } } },
    },
  }
}

// 8) Scorecard per area (redditività/liquidità/solidità/cash flow/efficienza)
export function configScorecard(ind) {
  const aree = [
    { l: 'Redditività', v: Math.min((g(ind, 'ros') / 10) * 10, 10) },
    { l: 'Liquidità', v: Math.min((g(ind, 'current_ratio') / 2) * 10, 10) },
    { l: 'Solidità', v: Math.min(10 / Math.max(g(ind, 'lev', 10), 0.5), 10) },
    { l: 'Cash Flow', v: Math.min((g(ind, 'utile') / Math.max(g(ind, 'tot_debiti', 1), 1)) * 100, 10) },
    { l: 'Efficienza', v: g(ind, 'rot') > 0 ? Math.min((g(ind, 'rot') / 1.5) * 10, 10) : 5 },
  ]
  const colori = aree.map((a) => (a.v >= 7 ? C.verde : a.v >= 4 ? C.a3 : C.rosso))
  return {
    type: 'bar',
    data: { labels: aree.map((a) => a.l), datasets: [{ data: aree.map((a) => a.v), backgroundColor: colori, barThickness: 20 }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: 'Scorecard per area', color: C.blu, font: { size: 13, weight: 'bold' } }, legend: { display: false } },
      scales: { x: { min: 0, max: 10, title: { display: true, text: 'Score /10', font: { size: 10 } } }, y: { grid: { display: false } } },
    },
  }
}

export const RATING_SCORE = {
  'BBB+': 1.0, BBB: 0.9, 'BBB-': 0.82, 'BB+': 0.72, BB: 0.63, 'BB-': 0.54,
  'B+': 0.44, B: 0.36, 'B-': 0.28, CCC: 0.18, CC: 0.1, C: 0.05,
}

// Gauge rating: doughnut semicircolare colorato per fasce + valore al centro
// (mostrato come testo sovrapposto dal chiamante, Chart.js non lo fa nativamente)
export function configGaugeRating(rating) {
  const score = RATING_SCORE[rating] ?? 0.5
  const zoneColors = [C.rosso, C.aran, C.a3, C.verde]
  const zoneWidths = [0.33, 0.25, 0.22, 0.2] // 0-.33 .33-.58 .58-.80 .80-1
  return {
    type: 'doughnut',
    data: {
      labels: ['0–33%', '33–58%', '58–80%', '80–100%'],
      datasets: [
        { data: zoneWidths, backgroundColor: zoneColors, circumference: 180, rotation: 270, borderWidth: 2, borderColor: '#fff' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        title: { display: true, text: 'Rating sintetico', color: C.blu, font: { size: 13, weight: 'bold' } },
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
    _score: score,
  }
}
