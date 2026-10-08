import React from 'react'
import Grafico from './Grafico'
import { MESI_NOMI } from '../lib/tesoreria'

const eur = (v) => `€ ${Math.round(v).toLocaleString('it-IT')}`
const compatto = (v) => {
  const a = Math.abs(v)
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('it-IT', { maximumFractionDigits: 1 })} M`
  if (a >= 1e3) return `${Math.round(v / 1e3).toLocaleString('it-IT')}k`
  return Math.round(v).toLocaleString('it-IT')
}

// Configurazione Chart.js del piano di tesoreria: barre di entrate e uscite (mesi reali pieni, proiezione
// attenuata) sull'asse sinistro, saldo e scenari sull'asse destro, linea del buffer minimo.
export function configGraficoTesoreria(piano) {
  const reali = piano.mesi_reali || []
  const proiez = piano.mesi || []
  const nReali = reali.length
  const etichette = [...reali, ...proiez].map((m) => `${MESI_NOMI[m.mese - 1]} ${String(m.anno).slice(2)}`)
  const entrate = [...reali.map((m) => m.entrate), ...proiez.map((m) => m.entrate_certe + m.entrate_stimate)]
  const uscite = [...reali.map((m) => m.uscite), ...proiez.map((m) => m.uscite_certe + m.uscite_stimate)]
  const saldo = [...reali.map((m) => m.saldo), ...proiez.map((m) => m.saldo_base)]
  // gli scenari partono dall'ultimo saldo reale, cosi' le linee si staccano dal saldo base senza buchi
  const scenario = (k) => [...reali.map((m, i) => (i === nReali - 1 ? m.saldo : null)), ...proiez.map((m) => m[k])]
  const buffer = proiez[0]?.buffer_minimo || 0
  const colori = (pieno, tenue) => etichette.map((_, i) => (i < nReali ? pieno : tenue))

  const annotazioni = {}
  if (nReali > 0) {
    annotazioni.reale = {
      type: 'box', xMin: -0.5, xMax: nReali - 0.5, backgroundColor: 'rgba(240,244,248,0.6)', borderWidth: 0,
      label: { display: true, content: 'reale', position: { x: 'center', y: 'start' }, color: '#6b7280', font: { size: 11 } },
    }
  }
  if (buffer > 0) {
    annotazioni.buffer = {
      type: 'line', yScaleID: 'saldo', yMin: buffer, yMax: buffer, borderColor: '#E08B0B', borderWidth: 1.5, borderDash: [6, 4],
      label: { display: true, content: `buffer minimo ${eur(buffer)}`, position: 'end', backgroundColor: 'rgba(224,139,11,0.12)', color: '#b9690a', font: { size: 11 } },
    }
  }

  return {
    type: 'bar',
    data: {
      labels: etichette,
      datasets: [
        { type: 'line', label: 'Saldo', data: saldo, yAxisID: 'saldo', borderColor: '#2B5FA5', backgroundColor: '#2B5FA5', borderWidth: 3, pointRadius: 3.5, tension: 0.25, order: 0 },
        { type: 'line', label: 'Scenario ottimistico', data: scenario('saldo_ottimistico'), yAxisID: 'saldo', borderColor: '#1D9E75', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, tension: 0.25, spanGaps: false, order: 1 },
        { type: 'line', label: 'Scenario pessimistico', data: scenario('saldo_pessimistico'), yAxisID: 'saldo', borderColor: '#E5484D', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, tension: 0.25, spanGaps: false, order: 1 },
        { label: 'Entrate', data: entrate, yAxisID: 'flussi', backgroundColor: colori('#5fb894', 'rgba(127,200,169,0.75)'), borderRadius: 3, order: 2 },
        { label: 'Uscite', data: uscite, yAxisID: 'flussi', backgroundColor: colori('#e2827a', 'rgba(240,167,160,0.75)'), borderRadius: 3, order: 2 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { boxWidth: 12, usePointStyle: true, font: { size: 12 } } },
        tooltip: { callbacks: { label: (c) => (c.raw == null ? null : `${c.dataset.label}: ${eur(c.raw)}`) } },
        annotation: { annotations: annotazioni },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        flussi: { position: 'left', beginAtZero: true, title: { display: true, text: 'Entrate e uscite del mese', font: { size: 11 } }, ticks: { callback: compatto, font: { size: 11 } } },
        saldo: { position: 'right', grid: { display: false }, title: { display: true, text: 'Saldo', font: { size: 11 } }, ticks: { callback: compatto, font: { size: 11 } } },
      },
    },
  }
}

export default function GraficoTesoreria({ piano }) {
  if (!piano?.mesi?.length) return null
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-body">
        <h3 style={{ color: '#1a3a5c', marginTop: 0, marginBottom: 4, fontSize: 15 }}>Andamento della tesoreria</h3>
        <p style={{ fontSize: 12.5, color: '#5f6b7a', margin: '0 0 10px' }}>
          Barre: entrate e uscite del mese (piene i mesi reali, chiare la proiezione). Linea blu: saldo; tratteggiate: scenari ottimistico e pessimistico.
        </p>
        <Grafico config={configGraficoTesoreria(piano)} height={320} />
      </div>
    </div>
  )
}
