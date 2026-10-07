// Abbinamento automatico della Riclassificazione da un bilancio analitico: per ogni gruppo del piano dei conti
// (mastro/conto, es. "11/45") si propone la voce CEE (Conto economico) o di Stato patrimoniale partendo da:
//  - la sezione e il lato in cui il bilancio espone il gruppo (attivita'/passivita'/costi/ricavi);
//  - la descrizione del gruppo e, in mancanza, del suo mastro (i piani dei conti ricalcano le voci di legge:
//    "CREDITI TRIBUTARI ENTRO 12 MESI", "ONERI SOCIALI", "INTERESSI E ALTRI ONERI FINANZIARI"...).
// Le proposte vanno confermate dall'utente; quelle senza regola restano "da scegliere". Modulo puro.

const norm = (s) => (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'’]/g, ' ').replace(/\s+/g, ' ').trim()

// [regola, codice] in ordine: vince la prima che corrisponde. 'sp:' = Stato patrimoniale, 'cee:' = Conto economico.
const REGOLE = {
  attivita: [
    [/CREDITI V(ERSO)? ?SOCI|VERSAMENTI ANCORA DOVUTI/, 'sp:ATT_A'],
    [/COSTI DI IMPIANTO|AMPLIAMENTO/, 'sp:ATT_B_I_1'],
    [/RICERCA|SVILUPPO/, 'sp:ATT_B_I_2'],
    [/BREVETT|INGEGNO|SOFTWARE/, 'sp:ATT_B_I_3'],
    [/CONCESSION|LICENZ|MARCH/, 'sp:ATT_B_I_4'],
    [/AVVIAMENTO/, 'sp:ATT_B_I_5'],
    [/IMMATERIAL.*(IN CORSO|ACCONTI)/, 'sp:ATT_B_I_6'],
    [/TERRENI|FABBRICATI/, 'sp:ATT_B_II_1'],
    [/IMPIANTI|MACCHINAR/, 'sp:ATT_B_II_2'],
    [/ATTREZZATUR/, 'sp:ATT_B_II_3'],
    [/ALTRI BENI/, 'sp:ATT_B_II_4'],
    [/MATERIAL.*(IN CORSO|ACCONTI)|IMMOBILIZZAZIONI IN CORSO/, 'sp:ATT_B_II_5'],
    [/PARTECIPAZ.*CONTROLLAT/, 'sp:ATT_B_III_1A'],
    [/PARTECIPAZ.*COLLEGAT/, 'sp:ATT_B_III_1B'],
    [/PARTECIPAZ/, 'sp:ATT_B_III_1D'],
    [/CREDITI IMMOBILIZZAT|IMMOBILIZZAZIONI FINANZIARIE/, 'sp:ATT_B_III_2D'],
    [/MATERIE PRIME|SUSSIDIARIE|DI CONSUMO/, 'sp:ATT_C_I_1'],
    [/SEMILAVORAT|IN CORSO DI LAVORAZIONE/, 'sp:ATT_C_I_2'],
    [/LAVORI IN CORSO/, 'sp:ATT_C_I_3'],
    [/PRODOTTI FINITI|\bMERCI\b|RIMANENZ/, 'sp:ATT_C_I_4'],
    [/CLIENTI/, 'sp:ATT_C_II_1'],
    [/CONTROLLAT/, 'sp:ATT_C_II_2'],
    [/COLLEGAT/, 'sp:ATT_C_II_3'],
    [/CONTROLLANT/, 'sp:ATT_C_II_4'],
    [/IMPOSTE ANTICIPATE/, 'sp:ATT_C_II_4T'],
    [/TRIBUTAR|ERARIO/, 'sp:ATT_C_II_4B'],
    [/VERSO ALTRI|V ALTRI|CREDITI DIVERSI|ALTRI CREDITI/, 'sp:ATT_C_II_5'],
    [/TITOLI|ATTIVITA FINANZIARIE/, 'sp:ATT_C_III_6'],
    [/DEPOSITI BANCARI|BANCH|POSTAL/, 'sp:ATT_C_IV_1'],
    [/ASSEGNI/, 'sp:ATT_C_IV_2'],
    [/CASSA|DENARO/, 'sp:ATT_C_IV_3'],
    [/DISPONIBILITA LIQUIDE/, 'sp:ATT_C_IV_1'],
    [/RATEI ATTIVI/, 'sp:ATT_D_1'],
    [/RISCONTI|RATEI/, 'sp:ATT_D_2'],
  ],
  passivita: [
    [/CAPITALE/, 'sp:PAS_A_I'],
    [/SOVRAPPREZZO/, 'sp:PAS_A_II'],
    [/RIVALUTAZION/, 'sp:PAS_A_III'],
    [/RISERVA LEGALE/, 'sp:PAS_A_IV'],
    [/STATUTARI/, 'sp:PAS_A_V'],
    [/AZIONI PROPRIE/, 'sp:PAS_A_VI'],
    [/A NUOVO/, 'sp:PAS_A_VIII'],
    [/UTILE|PERDITA D ESERCIZIO|RISULTATO/, 'sp:PAS_A_IX'],
    [/RISERV/, 'sp:PAS_A_VII'],
    [/QUIESCENZA/, 'sp:PAS_B_1'],
    [/FONDO IMPOSTE|IMPOSTE DIFFERITE/, 'sp:PAS_B_2'],
    [/FONDI? (PER )?RISCHI|ALTRI FONDI|FONDO ONERI/, 'sp:PAS_B_3'],
    [/TFR|FINE RAPPORTO/, 'sp:PAS_C'],
    [/OBBLIGAZION/, 'sp:PAS_D_1'],
    [/SOCI (PER |C )?FINANZ|FINANZIAMENTI SOCI/, 'sp:PAS_D_3'],
    [/ALTRI FINANZIATORI/, 'sp:PAS_D_5'],
    [/BANCH|BANCARI/, 'sp:PAS_D_4'],
    [/ACCONTI/, 'sp:PAS_D_6'],
    [/FORNITORI/, 'sp:PAS_D_7'],
    [/TITOLI DI CREDITO|CAMBIALI/, 'sp:PAS_D_8'],
    [/CONTROLLAT/, 'sp:PAS_D_9'],
    [/COLLEGAT/, 'sp:PAS_D_10'],
    [/CONTROLLANT/, 'sp:PAS_D_11'],
    [/TRIBUTAR|ERARIO/, 'sp:PAS_D_12'],
    [/PREVID|SICUREZZA SOCIALE|ASSISTENZ/, 'sp:PAS_D_13'],
    [/ALTRI DEBITI|DEBITI DIVERSI/, 'sp:PAS_D_14'],
    [/RATEI PASSIVI/, 'sp:PAS_E_1'],
    [/RISCONTI|RATEI/, 'sp:PAS_E_2'],
  ],
  costi: [
    [/RIMANENZ|\bRIM\b|ESISTENZE/, 'cee:B11'],
    [/MAT PRIME|MATERIE PRIME|\bSUSS|\bCONSUMO\b|\bMERCI\b|\bACQUISTI\b/, 'cee:B6'],
    [/SERVIZI/, 'cee:B7'],
    [/GODIMENTO|LEASING|LOCAZION|NOLEGG|AFFITT/, 'cee:B8'],
    [/SALARI|STIPENDI/, 'cee:B9a'],
    [/ONERI SOCIALI/, 'cee:B9b'],
    [/FINE RAPPORTO|TFR/, 'cee:B9c'],
    [/QUIESCENZA/, 'cee:B9d'],
    [/ALTRI COSTI DEL PERSONALE|PERSONALE/, 'cee:B9e'],
    [/AMMORT.*IMMATERIAL/, 'cee:B10a'],
    [/AMMORT/, 'cee:B10b'],
    [/SVALUTAZ.*CREDIT/, 'cee:B10d'],
    [/SVALUTAZ.*(PARTECIP|TITOL|FINANZIAR)|RETTIFICHE/, 'cee:D19'],
    [/SVALUTAZ/, 'cee:B10c'],
    [/ACCANTONAMENT.*RISCH/, 'cee:B12'],
    [/ACCANTONAMENT/, 'cee:B13'],
    [/ONERI DIVERSI/, 'cee:B14'],
    [/INTERESSI|ONERI FINANZIARI|PERDITE SU CAMBI/, 'cee:C17'],
    [/IMPOSTE/, 'cee:E20'],
    [/ALTRI ONERI|ONERI STRAORDINARI|SOPRAVVENIENZE/, 'cee:B14'],
  ],
  ricavi: [
    [/RIMANENZ|\bRIM\b|ESISTENZE/, 'cee:B11'],
    [/VARIAZION.*PRODOTTI/, 'cee:A2'],
    [/LAVORI IN CORSO/, 'cee:A3'],
    [/INCREMENTI/, 'cee:A4'],
    [/RICAVI DELLE VENDITE|VENDITE|PRESTAZIONI/, 'cee:A1'],
    [/PROVENTI DA PARTECIPAZ|DIVIDEND/, 'cee:C15'],
    [/PROVENTI FINANZIARI|INTERESSI ATTIVI|UTILI SU CAMBI/, 'cee:C16'],
    [/RIVALUTAZ/, 'cee:D18'],
    [/ALTRI RICAVI|ALTRI PROVENTI|PROVENTI|CONTRIBUTI/, 'cee:A5'],
  ],
}

function proponi(lato, ...descrizioni) {
  for (const d of descrizioni) {
    const t = norm(d)
    if (!t) continue
    for (const [re, codice] of REGOLE[lato]) if (re.test(t)) return { codice, da: d }
  }
  return null
}

// Conti bancari: niente compensazione (art. 2423-ter c.c.). Un conto esposto sul lato opposto a quello del suo
// gruppo di liquidita' (es. "UNICREDIT C/anticipi" tra le passivita' dentro "DEPOSITI BANCARI") e' un debito
// verso banche; viceversa un conto attivo dentro un gruppo di debiti verso banche e' un deposito.
const ECCEZIONI_BANCHE = {
  'sp:ATT_C_IV_1': { latoOpposto: 'passivita', voce: 'sp:PAS_D_4', motivo: 'conto bancario a saldo passivo (anticipi, scoperto): debito verso banche' },
  'sp:ATT_C_IV_2': { latoOpposto: 'passivita', voce: 'sp:PAS_D_4', motivo: 'saldo passivo: debito verso banche' },
  'sp:ATT_C_IV_3': { latoOpposto: 'passivita', voce: 'sp:PAS_D_4', motivo: 'saldo passivo: debito verso banche' },
  'sp:PAS_D_4': { latoOpposto: 'attivita', voce: 'sp:ATT_C_IV_1', motivo: 'conto bancario a saldo attivo: deposito' },
}

// bilancio: { voci: [{ sezione, lato, livello, codice, descrizione, importo }] }
// Restituisce un gruppo per ogni codice di livello 2, con il saldo netto (Dare +), la proposta e le eventuali
// eccezioni sui singoli conti (conti: [{ conto, descrizione, saldo, proposta, motivo }]).
export function proposteDaBilancio(bilancio) {
  const mastri = new Map()
  const gruppi = new Map()
  for (const v of bilancio.voci) {
    if (v.livello === 1) mastri.set(`${v.sezione}|${v.codice}`, v.descrizione)
    if (v.livello !== 2) continue
    const g = gruppi.get(v.codice) || { gruppo: v.codice, sezione: v.sezione, descrizione: v.descrizione, lati: {} }
    g.lati[v.lato] = (g.lati[v.lato] || 0) + v.importo
    gruppi.set(v.codice, g)
  }
  return [...gruppi.values()].map((g) => {
    const [sinistro, destro] = g.sezione === 'SP' ? ['attivita', 'passivita'] : ['costi', 'ricavi']
    const imp = (l) => g.lati[l] || 0
    // lato prevalente = natura del gruppo (a parita', quello di sinistra); l'altro lato e' una rettifica di segno
    const lato = imp(destro) > imp(sinistro) ? destro : sinistro
    const mastro = mastri.get(`${g.sezione}|${g.gruppo.split('/')[0]}`) || ''
    // se il lato prevalente non ha una voce adatta si prova l'altro: es. "FORNITORI" con piu' anticipi in Dare
    // che debiti in Avere resta un debito verso fornitori (il saldo in Dare lo riduce)
    const altro = lato === sinistro ? destro : sinistro
    const p = proponi(lato, g.descrizione, mastro) || proponi(altro, g.descrizione, mastro)
    const latoVoce = p && !proponi(lato, g.descrizione, mastro) ? altro : lato
    return {
      gruppo: g.gruppo,
      descrizione: g.descrizione,
      mastro,
      sezione: g.sezione,
      lato: latoVoce,
      saldo: Math.round((imp(sinistro) - imp(destro)) * 100) / 100,
      proposta: p ? p.codice : null,
      regola: p ? (p.da === g.descrizione ? 'descrizione del gruppo' : 'descrizione del mastro') : null,
      conti: eccezioniConti(bilancio, g.gruppo, p?.codice),
    }
  }).sort((a, b) => a.gruppo.localeCompare(b.gruppo, 'it', { numeric: true }))
}

function eccezioniConti(bilancio, gruppo, proposta) {
  const regola = ECCEZIONI_BANCHE[proposta]
  if (!regola) return []
  return bilancio.voci
    .filter((v) => v.livello === 3 && v.codice.startsWith(`${gruppo}/`) && v.lato === regola.latoOpposto)
    .map((v) => ({ conto: v.codice, descrizione: v.descrizione, saldo: v.lato === 'passivita' ? -v.importo : v.importo, proposta: regola.voce, motivo: regola.motivo }))
}

// Confronto con la classificazione gia' salvata: 'nuovo' (gruppo non classificato), 'uguale', 'diverso',
// 'da_scegliere' (nessuna proposta). valoreAttuale: 'sp:CODICE' / 'cee:CODICE' o ''.
export function statoProposta(proposta, valoreAttuale) {
  if (!proposta) return 'da_scegliere'
  if (!valoreAttuale) return 'nuovo'
  return valoreAttuale === proposta ? 'uguale' : 'diverso'
}
