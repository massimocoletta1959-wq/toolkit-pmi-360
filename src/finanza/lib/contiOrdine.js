// Conti d'ordine (beni di terzi, beni in leasing, garanzie, impegni): dal 2016 (D.Lgs. 139/2015) non sono piu' nello
// schema di bilancio, solo in nota integrativa. Nella Riclassificazione sono una scelta a parte: il gruppo risulta
// classificato (non resta tra i "non classificati") ma e' escluso da Stato patrimoniale, Conto economico, budget e
// flussi (categoria 'conti_ordine', che nessun calcolo considera).
export const CONTI_ORDINE = { valore: 'ord:ORD', codice: 'ORD', categoria: 'conti_ordine', voce: "Conti d'ordine (fuori bilancio)" }

// valore della tendina per una mappatura salvata: 'sp:CODICE', 'cee:CODICE' o 'ord:ORD'
export const valoreMappatura = (m) => {
  if (!m?.codice_cee) return ''
  if (m.categoria === CONTI_ORDINE.categoria) return CONTI_ORDINE.valore
  return `${m.categoria === 'attivita' || m.categoria === 'passivita' ? 'sp' : 'cee'}:${m.codice_cee}`
}

// descrizione di un conto d'ordine (non i costi che ne parlano, es. "Assicurazioni fideiussorie", "Godimento beni di terzi")
export const eContoOrdine = (descrizione) =>
  /CONTI D.?ORDINE|TERZI PER (BENI|GARANZIE|FIDEJ|FIDEY|FIDEI)|BENI (DI|IN) LEASING|BENI (DI TERZI )?PRESSO (DI )?NOI|A FAVORE DI TERZI|FIDE[JYI]USSIONI.*(RICEV|PRESTAT)|AVALLI|GARANZIE (PRESTATE|RICEVUTE)|IMPEGNI/i.test(descrizione || '') &&
  !/ASSICURAZ|COMMISSION|COSTI|SPESE|ONERI|GODIMENTO|CANONI/i.test(descrizione || '')
