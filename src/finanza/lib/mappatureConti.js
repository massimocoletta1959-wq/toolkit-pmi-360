// Risoluzione condivisa della riclassificazione (tabella mappature_conti) per i
// documenti Libro Giornale/Prima Nota.
//
// La riclassificazione si salva di default a livello di GRUPPO di conto (es.
// "06/05/G"): una scelta fatta su un gruppo vale per tutti i suoi conti, anche
// quelli che compaiono nei caricamenti successivi. Un singolo conto puo' pero'
// avere una propria eccezione: si salva con conto_origine = codice conto
// completo (es. "06/05/015/G") e ha la precedenza sul gruppo. Tutti i report
// (Stato Patrimoniale, Conto Economico, Budget, Flussi) usano questa stessa
// regola, cosi' un'eccezione decisa in Riclassificazione vale ovunque.
import { gruppoDiConto } from './libroGiornale'

const eguale = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase()

// Ritorna { mappatura, livello } con livello 'conto' | 'gruppo' | 'globale',
// oppure null se il conto non e' classificato. L'eccezione sul singolo conto
// batte la mappatura del gruppo; le mappature globali (per sottostringa,
// comportamento storico) si applicano solo al gruppo.
export function risolviMappatura(conto, mappatureAzienda, mappatureGlobali, gruppo = gruppoDiConto(conto)) {
  if (conto && conto !== gruppo) {
    for (const m of mappatureAzienda || []) if (eguale(m.conto_origine, conto)) return { mappatura: m, livello: 'conto' }
  }
  for (const m of mappatureAzienda || []) if (eguale(m.conto_origine, gruppo)) return { mappatura: m, livello: 'gruppo' }
  const gl = (gruppo || '').toLowerCase()
  for (const m of mappatureGlobali || []) if (gl.includes(m.conto_origine.toLowerCase())) return { mappatura: m, livello: 'globale' }
  return null
}

export function trovaMappaturaConto(conto, mappatureAzienda, mappatureGlobali, gruppo) {
  return risolviMappatura(conto, mappatureAzienda, mappatureGlobali, gruppo)?.mappatura || null
}

// Conti di un gruppo salvato in dati_estratti. I documenti elaborati prima che
// il dettaglio dei conti venisse salvato non hanno g.conti: in quel caso il
// gruppo stesso fa da unico "conto".
export function contiDelGruppo(g) {
  if (g.conti?.length) return g.conti
  return [{ conto: g.gruppo, descrizione: g.descrizione, valore: g.importo || 0 }]
}

// True se il codice e' quello di un singolo conto ("06/05/015/G", "14/00090/C"),
// false se e' un gruppo ("06/05/G", "14/C"): distingue le eccezioni per conto
// dalle mappature di gruppo dentro mappature_conti.
// (anche i codici solo numerici mastro/conto/sottoconto, es. Seasoft "9/5/494"; il gruppo e' "9/5")
export const eCodiceConto = (codice) => /^\d{2}\/\d{2}\/\d{3}\/[GFC]$|^\d{2}\/\d{5}\/[GFC]$|^\d{1,3}\/\d{1,3}\/\d{1,6}$/.test(codice || '')

// Clienti e fornitori per i tempi medi (DSO/DPO) e le partite aperte. TeamSystem li distingue nel codice
// ("/C", "/F"); per gli altri programmi (es. Seasoft "9/5/494") vale la Riclassificazione del gruppo: crediti
// verso clienti (C.II.1) e debiti verso fornitori (D.7). Sono esclusi i conti tecnici di quei gruppi che non
// sono una controparte (ricevute bancarie, fatture da emettere/ricevere, anticipi).
const RE_CONTI_TECNICI = /RICEVUTE|EFFETTI|\bRI\.?BA\b|PORTAFOGLIO|FATTURE DA (EMETTERE|RICEVERE)|NOTE (DI )?CREDITO DA|ANTICIP|ACCONT/i
export function tipoControparte(conto, descrizione, mappatureAzienda, mappatureGlobali) {
  if (!conto) return null
  if (conto.endsWith('/C')) return 'cliente'
  if (conto.endsWith('/F')) return 'fornitore'
  if (/\/[GFC]$/.test(conto)) return null
  const m = trovaMappaturaConto(conto, mappatureAzienda, mappatureGlobali)
  if (!m || RE_CONTI_TECNICI.test(descrizione || '')) return null
  if (m.codice_cee === 'ATT_C_II_1') return 'cliente'
  if (m.codice_cee === 'PAS_D_7') return 'fornitore'
  return null
}
