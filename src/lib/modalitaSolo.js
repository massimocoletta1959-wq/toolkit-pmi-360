// Etichette dei moduli quando l'azienda è in Modalità Solo (azienda.modalita_solo).
// Cambia solo il testo visibile: id, rotte e logica dei moduli restano invariati.
export const ETICHETTE_MODULI_SOLO = {
  rischi: 'Protezione e Continuità',
  procedure: 'Standard Operativi e Checklist',
}

export function etichettaModulo(modulo, labelDefault, modalitaSolo) {
  return (modalitaSolo && ETICHETTE_MODULI_SOLO[modulo]) || labelDefault
}

// Etichetta del registro atti amministrativi: per un'impresa individuale/professionista
// (tipo_soggetto = 'individuale') non ha senso parlare di "Determine AU"/"Delibere CdA"
// (non ci sono organi collegiali), quindi diventa "Registro delle Decisioni". Il
// meccanismo esistente che sceglie tra Determine AU e Delibere CdA in base all'organo
// amministrativo reale resta invariato per tipo_soggetto = 'societa' (o assente).
export function etichettaAttiGovernance(organoTipo, tipoSoggetto) {
  if (tipoSoggetto === 'individuale') return 'Registro delle Decisioni'
  return organoTipo === 'cda' ? 'Preparazione Delibere CdA' : 'Preparazione Determine AU'
}
