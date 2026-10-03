import React, { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'

Chart.register(...registerables, annotationPlugin)

export default function Grafico({ config, height = 200 }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !config) return
    chartRef.current = new Chart(canvasRef.current, config)
    return () => chartRef.current?.destroy()
  }, [JSON.stringify(config?.data), config?.type])

  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
