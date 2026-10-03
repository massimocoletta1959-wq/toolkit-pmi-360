// ============================================================
// Client Supabase del modulo "Finanza e Controllo" (portato da EasyPMI).
// Le pagine del modulo usano i nomi originali di EasyPMI (tabella "budget",
// bucket "documenti", funzione "estrai-documento"…): questo adattatore li
// traduce verso le risorse di Pmi 360° (fin_budget, fin-documenti,
// fin-estrai-documento…), così il codice delle pagine resta quello collaudato.
// Accesso, sessione e regole sono quelli di Pmi 360° (stesso client).
// ============================================================
import { supabase as base } from '../../lib/supabase'

const TABELLE = new Set([
  'analisi_flussi', 'budget', 'budget_voci', 'cashflow', 'controlli_tesoreria', 'documenti',
  'finanziamenti', 'investimenti', 'kpi_tesoreria', 'linee_credito', 'manovre_scorte',
  'mappature_conti', 'mappature_flussi_conti', 'movimenti_tesoreria', 'narrativa_report',
  'saldi_cassa_reali', 'scadenze_escluse', 'scenari_tesoreria', 'scostamenti', 'voci_cee', 'voci_sp',
])
// "aziende" di EasyPMI = vista fin_aziende (anagrafica Pmi 360° + parametri finanziari);
// le modifiche ai parametri passano dalla vista (trigger) a fin_parametri_azienda.
const tabella = nome => (TABELLE.has(nome) ? `fin_${nome}` : nome === 'aziende' ? 'fin_aziende' : nome)
const bucket = nome => (nome === 'documenti' ? 'fin-documenti' : nome)
const FUNZIONI = { 'estrai-documento': 'fin-estrai-documento', 'genera-narrativa': 'fin-genera-narrativa' }

export const supabase = {
  from: nome => base.from(tabella(nome)),
  rpc: (...a) => base.rpc(...a),
  auth: base.auth,
  storage: { from: nome => base.storage.from(bucket(nome)) },
  functions: { invoke: (nome, opz) => base.functions.invoke(FUNZIONI[nome] || nome, opz) },
}
