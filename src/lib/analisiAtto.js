// Analisi d'impatto (economico e finanziario) nel testo della delibera/determina: un blocco riconoscibile, che si
// riscrive a ogni nuova simulazione senza toccare il resto del testo (anche se modificato a mano).
import { MARCATORE } from '../finanza/lib/impatto/testiAnalisi'

const TITOLO_ECO = 'ANALISI DI IMPATTO ECONOMICO'
const TITOLO_FIN = 'ANALISI DI IMPATTO FINANZIARIO'
const CHIUSURA = "Le analisi e i relativi prospetti sono conservati nel fascicolo dell'atto."
const VISTE = 'VISTE le analisi economico-finanziarie condotte e la documentazione istruttoria agli atti'
const RE_BLOCCO = new RegExp(`(${TITOLO_ECO}|${TITOLO_FIN})[\\s\\S]*?${CHIUSURA.replace(/[.*+?^${}()|[\]\\']/g, '\\$&')}`)

// "[Simulazione d'impatto del 05/10/2026]" -> "(simulazione d'impatto del 05/10/2026)"
const perAtto = (t) => (t || '').trim().replace(/\[Simulazione d'impatto del ([^\]]+)\]/g, "(simulazione d'impatto del $1)")

export function bloccoAnalisi(eco, fin) {
  const parti = []
  if (eco && eco.trim()) parti.push(`${TITOLO_ECO}\n${perAtto(eco)}`)
  if (fin && fin.trim()) parti.push(`${TITOLO_FIN}\n${perAtto(fin)}`)
  if (!parti.length) return ''
  return `${parti.join('\n\n')}\n\n${CHIUSURA}`
}

// Riga "VISTE ..." del testo generato: con analisi presenti le introduce, altrimenti resta come prima
export const rigaViste = (eco, fin) => (bloccoAnalisi(eco, fin) ? `${VISTE}, di seguito riportate:` : `${VISTE};`)

// Aggiorna il blocco nel testo esistente: lo sostituisce se c'e', altrimenti lo inserisce dopo la riga "VISTE"
// (o prima di DELIBERA/DETERMINA). Il resto del testo non cambia.
export function inserisciAnalisiNelCorpo(corpo, eco, fin) {
  const blocco = bloccoAnalisi(eco, fin)
  if (!corpo) return corpo
  if (RE_BLOCCO.test(corpo)) return corpo.replace(RE_BLOCCO, blocco)
  if (!blocco) return corpo
  const righe = corpo.split('\n')
  const iViste = righe.findIndex((r) => r.startsWith(VISTE))
  if (iViste >= 0) {
    righe.splice(iViste, 1, `${VISTE}, di seguito riportate:`, '', blocco, '')
    return righe.join('\n')
  }
  const iDispositivo = righe.findIndex((r) => /^(DELIBERA|DETERMINA)\s*$/.test(r.trim()))
  if (iDispositivo >= 0) {
    righe.splice(iDispositivo, 0, blocco, '')
    return righe.join('\n')
  }
  return `${corpo}\n\n${blocco}`
}

export { MARCATORE }
