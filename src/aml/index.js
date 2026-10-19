// ============================================================
// Modulo "Antiriciclaggio" (AML, D.Lgs. 231/2007) — per ora attivo solo sulle aziende con aziende.mod_aml.
// Pagine caricate in modo differito, come il modulo Finanza.
// ============================================================
import React, { Suspense, lazy } from 'react'

const Cruscotto = lazy(() => import('./pages/CruscottoAml'))
const Clienti = lazy(() => import('./pages/ClientiAml'))
const Fascicolo = lazy(() => import('./pages/FascicoloAml'))
const Trigger = lazy(() => import('./pages/TriggerAml'))
const RegistroSos = lazy(() => import('./pages/RegistroSos'))
const DocumentiAziendali = lazy(() => import('./pages/DocumentiAziendaliAml'))

const Modulo = ({ children }) => <Suspense fallback={<div className="spinner" />}>{children}</Suspense>

export const PAGINE_AML = {
  aml_cruscotto: () => <Modulo><Cruscotto /></Modulo>,
  aml_clienti: () => <Modulo><Clienti /></Modulo>,
  aml_fascicolo: () => <Modulo><Fascicolo /></Modulo>,
  aml_trigger: () => <Modulo><Trigger /></Modulo>,
  aml_sos: () => <Modulo><RegistroSos /></Modulo>,
  aml_documenti: () => <Modulo><DocumentiAziendali /></Modulo>,
}

// Registro SOS e segnalazione interna anche nella vista membro (Delegato SOS e personale operativo)
export const RegistroSosMembro = () => <Modulo><RegistroSos vistaMembro /></Modulo>

// cliente aperto nel fascicolo (la pagina e' una sola: il cliente si passa cosi')
export const apriFascicolo = (setPage, clienteId) => {
  try { sessionStorage.setItem('aml_cliente', clienteId) } catch (e) { /* ignora */ }
  setPage('aml_fascicolo')
}
export const clienteAperto = () => {
  try { return sessionStorage.getItem('aml_cliente') } catch (e) { return null }
}
