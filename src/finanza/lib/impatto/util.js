// Utilità condivise dal motore di valutazione d'impatto e dai generatori per tipo (v8). Modulo puro.

export const round2 = (n) => Math.round(n * 100) / 100
export const round1 = (n) => Math.round(n * 10) / 10

// formato italiano per i numeri nei messaggi (1.234,50)
export const it = (n, dec = 0) => {
  const [i, d] = Math.abs(n).toFixed(dec).split('.')
  return `${n < 0 ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${d ? `,${d}` : ''}`
}

export const ymDaData = (iso) => {
  const [y, m] = String(iso).split('-').map(Number)
  return y * 100 + m
}
export const addMesi = (ym, k) => {
  const tot = Math.floor(ym / 100) * 12 + (ym % 100) - 1 + k
  return Math.floor(tot / 12) * 100 + (tot % 12) + 1
}
export const etichettaMese = (ym) => `${Math.floor(ym / 100)}-${String(ym % 100).padStart(2, '0')}`
// differenza in mesi tra due ym (b - a)
export const diffMesi = (a, b) => (Math.floor(b / 100) - Math.floor(a / 100)) * 12 + (b % 100) - (a % 100)

// Un flusso con ritardo di `giorni` si ripartisce sui due mesi vicini in proporzione ai giorni (come in Tesoreria):
// 45gg = metà nel mese +1, metà nel mese +2. giorni=0 -> tutto nel mese di partenza (nessuno sfasamento).
export function ripartisci(giorni) {
  const offset = Math.max(0, giorni) / 30
  const lo = Math.floor(offset)
  const w = offset - lo
  const parti = []
  if (w < 0.999) parti.push({ k: lo, peso: 1 - w })
  if (w > 0.001) parti.push({ k: lo + 1, peso: w })
  return parti
}

export const PERIODI_ANNO = { mensile: 12, trimestrale: 4, semestrale: 2, annuale: 1 }
export const MESI_PER_PERIODO = (periodicita) => 12 / PERIODI_ANNO[periodicita]

// iva_regime (comune a tutti i tipi, v8): sostituisce iva_pct. "ordinaria" applica l'aliquota di EasyPMI
// (aliqA per gli acquisti, aliqV per le vendite); "esente"/"non_soggetta" -> nessuna IVA sul movimento.
export const soggettoIvaDaRegime = (regime) => (regime ?? 'ordinaria') === 'ordinaria'
