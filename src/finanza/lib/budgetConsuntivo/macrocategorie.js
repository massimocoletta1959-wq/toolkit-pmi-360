// Macrocategorie dei conti di costo, dalla descrizione del conto: vince la prima regola che corrisponde, quindi
// l'ordine conta (es. "Assicurazioni automezzi" va in Assicurazioni perche' la regola viene prima di Automezzi).
// Imposte sul reddito e ammortamenti si decidono dalla voce di bilancio del conto (vedi natura in index.js).
// Regole decise con l'utente sull'analisi dei costi di Asap Logistics (ottobre 2026); eccezioni per singolo conto
// nelle impostazioni dell'azienda (macrocategorieConti).
export const REGOLE_MACROCATEGORIE = [
  ['Automezzi (altri costi)', /TASSA DI PROPRIET|BOLLO AUTO/i],
  ['Spese amministrative e varie', /RIMBORS/i],
  ['Carburanti', /CARBUR|\bCARB\b|LUBRIF|GASOLIO|BENZIN/i],
  ['Assicurazioni', /ASSICURAZ|POLIZZ/i],
  ['Pedaggi e telepedaggio', /PEDAGG|TELEPASS|AUTOSTRAD|PARCHEGG/i],
  ['Spedizioni e trasporti', /SPEDIZ|\bIATA\b|TRASPORT|CORRIER|NOLI\b/i],
  ['Compensi e contributi amministratori', /AMMINISTRATOR|\bAMM\.? ?R\.?E?\b/i],
  ['Personale', /RETRIBUZ|STIPEND|SALARI|CONTRIBUT|\bINPS\b|I\.N\.P\.S|INAIL|I\.N\.A\.I\.L|FASC|EBILOG|SANILOG|FINE RAPPORTO|TRATTAMENTO DI FINE|\bTFR\b|BUONI PASTO/i],
  ['Consulenze e prestazioni professionali', /CONSULENZ|NOTARIL|PROFESSION|LEGALI|PARCELL/i],
  ['Manutenzioni e riparazioni', /MANUT|RIPAR/i],
  ['Noleggi', /NOLEGG|LEASING/i],
  ['Affitti e locazioni', /AFFITT|LOCAZ|CANONE DI LOCAZIONE/i],
  ['Utenze, telefonia e internet', /ENERGIA|ELETTRIC|\bGAS\b|ACQUA|TELEFON|INTERNET|DOMINIO|E-?MAIL|\bLUCE\b/i],
  ['Viaggi, trasferte e rappresentanza', /VIAGG|TRASFERT|RAPPRESENT|ALBERG|RISTORAN/i],
  ['Banche e oneri finanziari', /BANCAR|COMMISSION|INTERESS|FIDEJUSS|FIDEIUSS|CAMBI/i],
  ['Tasse, bolli e diritti', /TASSA|BOLLI|VIDIMAZ|DIRITTO ANNUALE|CCIAA|SANZION|IMPOSTA/i],
  ['Software e informatica', /SOFTWARE|INFORMATIC|HARDWARE|CLOUD/i],
  ['Formazione e certificazioni', /CORSI|CORSO|CERTIFICAZ|FORMAZ/i],
  ['Ufficio, cancelleria e postali', /UFFICIO|CANCELLER|POSTAL|STAMPATI/i],
  ['Automezzi (altri costi)', /AUTOVEICOL|AUTOMEZZ|AUTOVETTUR|AUTOCARR|CAMION|TACHIGRAF/i],
  ['Spese amministrative e varie', /AMMINISTRATIV|\bVARIE\b|INDEDUC|INDETRAI|NON DOCUMENT|RECUPERO/i],
  ['Arrotondamenti e sopravvenienze', /ARROTOND|ABBUON|SOPRAVVEN/i],
]
export const ALTRI_COSTI = 'Altri costi'

export function macrocategoria(conto, descrizione, natura, eccezioni = {}) {
  if (eccezioni[conto]) return eccezioni[conto]
  if (natura === 'imposte') return 'Imposte sul reddito'
  if (natura === 'ammortamenti') return 'Ammortamenti'
  const r = REGOLE_MACROCATEGORIE.find(([, re]) => re.test(descrizione || ''))
  return r ? r[0] : ALTRI_COSTI
}

export const MACROCATEGORIE = [...new Set(REGOLE_MACROCATEGORIE.map(([n]) => n)), ALTRI_COSTI]
