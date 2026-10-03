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
export const eCodiceConto = (codice) => /^\d{2}\/\d{2}\/\d{3}\/[GFC]$|^\d{2}\/\d{5}\/[GFC]$/.test(codice || '')
