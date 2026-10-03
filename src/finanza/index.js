// ============================================================
// Modulo "Finanza e Controllo" (portato da EasyPMI frontend-supabase).
// Ogni pagina è avvolta in .mod-finanza, a cui è legato lo stile del modulo,
// ed è caricata in modo differito (code splitting).
// ============================================================
import React, { Suspense, lazy } from 'react'
import './finanza.css'
const Documenti = lazy(() => import('./pages/Documenti'))
const Budget = lazy(() => import('./pages/Budget'))
const Scostamento = lazy(() => import('./pages/Scostamento'))
const CE = lazy(() => import('./pages/CE'))
const Riclassificazione = lazy(() => import('./pages/Riclassificazione'))
const AnalisiFlussi = lazy(() => import('./pages/AnalisiFlussi'))
const AnalisiBilancio = lazy(() => import('./pages/AnalisiBilancio'))
const Tesoreria = lazy(() => import('./pages/Tesoreria'))

// Le pagine si scaricano solo entrando nel modulo (grafici e lettore PDF sono pesanti)
const Modulo = ({ children }) => (
  <div className="mod-finanza">
    <Suspense fallback={<div className="spinner" />}>{children}</Suspense>
  </div>
)

// Chiavi di pagina (prefisso fin_) → componente
export const PAGINE_FINANZA = {
  fin_documenti:         () => <Modulo><Documenti /></Modulo>,
  fin_budget:            () => <Modulo><Budget /></Modulo>,
  fin_scostamento:       () => <Modulo><Scostamento /></Modulo>,
  fin_ce:                () => <Modulo><CE /></Modulo>,
  fin_riclassificazione: () => <Modulo><Riclassificazione /></Modulo>,
  fin_analisi_flussi:    () => <Modulo><AnalisiFlussi /></Modulo>,
  fin_tesoreria:         () => <Modulo><Tesoreria /></Modulo>,
  fin_analisi_bilancio:  () => <Modulo><AnalisiBilancio /></Modulo>,
}
