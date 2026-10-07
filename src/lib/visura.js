// Dati della visura camerale (estratti dall'Edge Function extract-visura) trasformati per l'anagrafica.

// Settore dell'azienda dalla divisione ATECO (prime due cifre), sulle voci usate in Setup/Impostazioni.
// Sezioni ATECO 2025: A agricoltura 01-03, B estrazione 05-09, C manifattura 10-33, F costruzioni 41-43,
// G commercio 46-47 (45 in ATECO 2007), H trasporti 49-53, I alloggio 55 / ristorazione 56,
// J-K informazione e comunicazione / ICT 58-63, Q sanita' e assistenza 86-88.
export function settoreDaAteco(ateco, suggerito) {
  const div = parseInt((ateco || '').replace(/\D/g, '').slice(0, 2), 10)
  if (!Number.isNaN(div)) {
    if (div >= 1 && div <= 3) return 'Agricoltura'
    if (div >= 5 && div <= 33) return 'Manifatturiero'
    if (div >= 41 && div <= 43) return 'Edilizia'
    if (div >= 45 && div <= 47) return 'Commercio'
    if (div >= 49 && div <= 53) return 'Trasporti'
    if (div === 55) return 'Hotel'
    if (div >= 61 && div <= 63) return 'Tecnologia'
    if (div >= 86 && div <= 88) return 'Sanità'
  }
  return suggerito === 'edilizia' ? 'Edilizia' : 'Servizi'
}

// Intero da numero o testo ("2", "2 addetti"); null se assente
const intero = (v) => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? Math.round(n) : null
}

// Addetti dalla visura (dato INPS): dipendenti, indipendenti e totale. Se manca il numero dei dipendenti ma
// c'e' il totale ("Addetti al 30/06/2026  2" nel riquadro "L'impresa in cifre"), dipendenti = totale - indipendenti.
export function addettiDaVisura(a = {}) {
  const totale = intero(a.addetti_totale)
  const indipendenti = intero(a.addetti_indipendenti)
  let dipendenti = intero(a.addetti_dipendenti)
  if (dipendenti == null && totale != null) dipendenti = Math.max(0, totale - (indipendenti || 0))
  if (dipendenti == null && totale == null) return null
  return { dipendenti, indipendenti, totale: totale ?? (dipendenti != null ? dipendenti + (indipendenti || 0) : null), data: a.addetti_data || null }
}
