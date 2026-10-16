export const CATEGORIE = [
  'IT / Cyber',
  'Strategico',
  'Operativo',
  'Reputazionale',
  'Normativo / Compliance',
  'Finanziario',
  'Terze Parti / Fornitori',
  'Continuità Operativa',
  'Antiriciclaggio',
]

export const CATALOGO = {
  'Antiriciclaggio': [
    'Mandante con struttura proprietaria opaca o titolare effettivo non individuato',
    'Pagamenti da terzi non legati al debitore',
    'Incassi in contante oltre la soglia di legge o frazionati',
    'Pagamenti eccedenti il dovuto con richiesta di rimborso su conti diversi',
    'Mancata o tardiva segnalazione di operazioni sospette',
    'Fascicoli AML non aggiornati alle scadenze del controllo costante',
  ],
  'IT / Cyber': [
    'Attacco ransomware ai sistemi gestionali',
    'Violazione dei dati personali (GDPR)',
    'Perdita di accesso ai sistemi cloud',
    'Phishing e ingegneria sociale verso dipendenti',
    'Vulnerabilità software non aggiornato',
    'Mancanza di backup aggiornati',
    'Accesso non autorizzato da ex dipendenti',
    'Interruzione del provider di hosting/cloud',
  ],
  'Strategico': [
    'Perdita di un cliente chiave (>20% fatturato)',
    'Ingresso di nuovi competitor con prezzi aggressivi',
    'Dipendenza da un unico mercato o canale',
    'Cambio di leadership o uscita di figure chiave',
    "Fallimento di un'acquisizione o partnership",
    'Obsolescenza del modello di business',
    'Perdita di posizionamento competitivo',
  ],
  'Operativo': [
    'Guasto a macchinari o infrastrutture critiche',
    'Errori nel processo produttivo / servizio',
    'Dipendenza da un singolo fornitore critico',
    'Carenza di personale qualificato',
    'Infortuni sul lavoro',
    'Errori nella gestione degli ordini/contratti',
    'Perdita di know-how per turnover elevato',
    'Interruzione logistica o di consegna',
  ],
  'Reputazionale': [
    'Recensioni negative online (Google, social)',
    "Scandalo mediatico legato all'azienda",
    'Comportamento scorretto di un dipendente',
    'Gestione comunicazione di crisi inadeguata',
    'Perdita di certificazioni o riconoscimenti',
    'Controversie pubbliche con stakeholder',
    'Danni reputazionali da fornitori o partner',
  ],
  'Normativo / Compliance': [
    'Non conformità GDPR / privacy',
    'Violazione normativa sicurezza sul lavoro (D.Lgs 81/08)',
    'Inadempienza fiscale o tributaria',
    'Mancato rispetto normative ambientali',
    'Nuovo regolamento europeo di settore',
    "Controversie con l'Agenzia delle Entrate",
    'Mancanza di licenze o autorizzazioni aggiornate',
  ],
  'Finanziario': [
    'Crisi di liquidità a breve termine',
    'Insolvenza di clienti importanti',
    'Aumento improvviso dei costi energetici',
    'Variazioni sfavorevoli dei tassi di interesse',
    'Ritardi nei pagamenti della PA',
    'Costi non previsti su progetti in corso',
    'Difficoltà di accesso al credito bancario',
  ],
  'Terze Parti / Fornitori': [
    'Fallimento di un fornitore strategico',
    'Ritardi cronici nelle consegne',
    'Qualità insufficiente dei materiali/servizi forniti',
    'Dipendenza da un unico fornitore critico',
    'Rischi reputazionali da comportamento del fornitore',
    'Mancato rispetto contrattuale da partner',
    'Vulnerabilità cyber introdotte da terze parti',
  ],
  'Continuità Operativa': [
    'Assenza prolungata di figure chiave (malattia, dimissioni)',
    'Interruzione della rete internet / telecomunicazioni',
    'Blackout elettrico prolungato',
    'Catastrofe naturale o evento meteo estremo',
    'Incendio o danni fisici alla sede',
    'Pandemia o assenza massiva del personale',
    'Mancanza di piani di continuità documentati',
  ],
}

export const PROB_OPTIONS = [
  { value: 1, label: '1 — Bassa  (evento raro, < 10% annuo)' },
  { value: 2, label: '2 — Media  (evento possibile, 10-50% annuo)' },
  { value: 3, label: '3 — Alta   (evento probabile, > 50% annuo)' },
]

export const IMP_OPTIONS = [
  { value: 1, label: '1 — Limitato   (< 1% del fatturato)' },
  { value: 2, label: '2 — Rilevante  (1-7% del fatturato)' },
  { value: 3, label: '3 — Critico    (> 7% del fatturato)' },
]

export const FONTE_OPTIONS = [
  'Interna',
  'Esterna',
  'Mista',
]

export const STRATEGIA_OPTIONS = ['Ridurre', 'Evitare', 'Trasferire', 'Accettare']
export const STATO_OPTIONS = ['Pianificato', 'In corso', 'Completato', 'Da rivedere']

export function getTier(p, i) {
  const score = p * i
  if (score >= 6) return { tier: 'Tier 1', label: 'Critico', score, color: '#C0392B', bg: '#FADBD8' }
  if (score >= 4) return { tier: 'Tier 2', label: 'Significativo', score, color: '#E67E22', bg: '#FDEBD0' }
  if (score >= 2) return { tier: 'Tier 3', label: 'Moderato', score, color: '#856404', bg: '#FEF9E7' }
  return { tier: 'Tier 4', label: 'Accettabile', score, color: '#27AE60', bg: '#D5F5E3' }
}

export const CAT_COLORS = {
  'IT / Cyber':              { bg: '#E6F1FB', color: '#0C447C' },
  'Strategico':              { bg: '#EEEDFE', color: '#3C3489' },
  'Operativo':               { bg: '#F1EFE8', color: '#444441' },
  'Reputazionale':           { bg: '#FBEAF0', color: '#72243E' },
  'Normativo / Compliance':  { bg: '#FAEEDA', color: '#633806' },
  'Finanziario':             { bg: '#FCEBEB', color: '#791F1F' },
  'Terze Parti / Fornitori': { bg: '#E1F5EE', color: '#085041' },
  'Continuità Operativa':    { bg: '#EAF3DE', color: '#27500A' },
  'Antiriciclaggio':         { bg: '#FDF2E9', color: '#7E3A0B' },
}

export const RISCHI_DEFAULT = [
  { categoria: 'IT / Cyber', descrizione: 'Attacco ransomware ai sistemi gestionali', fonte: 'Esterna', probabilita: 2, impatto: 2, note: '' },
  { categoria: 'IT / Cyber', descrizione: 'Violazione dei dati personali (GDPR)', fonte: 'Esterna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'IT / Cyber', descrizione: 'Vulnerabilità software non aggiornato', fonte: 'Esterna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'IT / Cyber', descrizione: 'Mancanza di backup aggiornati', fonte: 'Interna', probabilita: 2, impatto: 2, note: '' },
  { categoria: 'IT / Cyber', descrizione: 'Interruzione del provider di hosting/cloud', fonte: 'Esterna', probabilita: 1, impatto: 3, note: '' },
  { categoria: 'Strategico', descrizione: 'Perdita di un cliente chiave (>20% fatturato)', fonte: 'Esterna', probabilita: 2, impatto: 2, note: '' },
  { categoria: 'Strategico', descrizione: 'Cambio di leadership o uscita di figure chiave', fonte: 'Interna', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'Operativo', descrizione: 'Guasto a macchinari o infrastrutture critiche', fonte: 'Interna', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'Operativo', descrizione: 'Dipendenza da un singolo fornitore critico', fonte: 'Esterna', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'Operativo', descrizione: 'Carenza di personale qualificato', fonte: 'Interna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Operativo', descrizione: 'Errori nella gestione degli ordini/contratti', fonte: 'Interna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Operativo', descrizione: 'Perdita di know-how per turnover elevato', fonte: 'Interna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Operativo', descrizione: 'Interruzione logistica o di consegna', fonte: 'Esterna', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'Reputazionale', descrizione: 'Comportamento scorretto di un dipendente', fonte: 'Interna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Reputazionale', descrizione: 'Gestione comunicazione di crisi inadeguata', fonte: 'Interna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Reputazionale', descrizione: 'Perdita di certificazioni o riconoscimenti', fonte: 'Esterna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Reputazionale', descrizione: 'Controversie pubbliche con stakeholder', fonte: 'Esterna', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'Reputazionale', descrizione: 'Danni reputazionali da fornitori o partner', fonte: 'Esterna', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'Normativo / Compliance', descrizione: 'Non conformita GDPR / privacy', fonte: 'Esterna', probabilita: 1, impatto: 3, note: '' },
  { categoria: 'Normativo / Compliance', descrizione: 'Violazione normativa sicurezza sul lavoro (D.Lgs 81/08)', fonte: 'Esterna', probabilita: 1, impatto: 3, note: '' },
  { categoria: 'Normativo / Compliance', descrizione: 'Inadempienza fiscale o tributaria', fonte: 'Esterna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Normativo / Compliance', descrizione: 'Controversie con l\'Agenzia delle Entrate', fonte: 'Esterna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Finanziario', descrizione: 'Crisi di liquidita a breve termine', fonte: 'Esterna', probabilita: 2, impatto: 1, note: '' },
  { categoria: 'Finanziario', descrizione: 'Insolvenza di clienti importanti', fonte: 'Esterna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Finanziario', descrizione: 'Difficolta di accesso al credito bancario', fonte: 'Esterna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Terze Parti / Fornitori', descrizione: 'Fallimento di un fornitore strategico', fonte: 'Esterna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Terze Parti / Fornitori', descrizione: 'Dipendenza da un unico fornitore critico', fonte: 'Esterna', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'Terze Parti / Fornitori', descrizione: 'Mancato rispetto contrattuale da partner', fonte: 'Esterna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Continuità Operativa', descrizione: 'Assenza prolungata di figure chiave (malattia, dimissioni)', fonte: 'Esterna', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'Continuità Operativa', descrizione: 'Interruzione della rete internet / telecomunicazioni', fonte: 'Esterna', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'Continuità Operativa', descrizione: 'Blackout elettrico prolungato', fonte: 'Esterna', probabilita: 1, impatto: 3, note: '' },
  { categoria: 'Continuità Operativa', descrizione: 'Mancanza di piani di continuita documentati', fonte: 'Esterna', probabilita: 2, impatto: 2, note: '' },
  { categoria: 'Continuità Operativa', descrizione: 'Pandemia o assenza massiva del personale', fonte: 'Esterna', probabilita: 1, impatto: 1, note: '' },
]

export const RISCHI_PER_SETTORE = {
  'Edilizia': [
  // IT / Cyber
  { categoria: 'IT / Cyber', descrizione: 'Furto o perdita di dati di progetto/gare d\'appalto', fonte: 'Esterna', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'IT / Cyber', descrizione: 'Interruzione dei sistemi BIM/gestionali di cantiere', fonte: 'Interna', probabilita: 1, impatto: 2, note: '' },

  // Strategico
  { categoria: 'Strategico', descrizione: 'Fluttuazione della domanda legata a cicli edilizi e incentivi pubblici', fonte: 'Esterna', probabilita: 3, impatto: 3, note: 'Settore in fase di assestamento dopo la forte espansione trainata da incentivi pubblici e investimenti infrastrutturali (INAIL, Dati Inail dic. 2025)' },
  { categoria: 'Strategico', descrizione: 'Dipendenza da un singolo grande appalto pubblico', fonte: 'Mista', probabilita: 2, impatto: 3, note: '' },

  // Operativo
  { categoria: 'Operativo', descrizione: 'Infortunio grave o mortale in cantiere (caduta dall\'alto o in profondità)', fonte: 'Interna', probabilita: 3, impatto: 3, note: 'Le cadute dall\'alto restano la principale causa di morte nei cantieri, il 58,3% degli incidenti mortali/gravi (Rapporto Inail-Regioni, set. 2025); settore Costruzioni +3% infortuni nel 2025 (Dati Inail)' },
  { categoria: 'Operativo', descrizione: 'Mancato rispetto del cronoprogramma lavori / ritardi di cantiere', fonte: 'Interna', probabilita: 2, impatto: 2, note: '' },
  { categoria: 'Operativo', descrizione: 'Incidente con mezzi e macchinari (gru, escavatori, ponteggi)', fonte: 'Interna', probabilita: 2, impatto: 3, note: '' },
  { categoria: 'Operativo', descrizione: 'Furto di materiali o attrezzature da cantiere', fonte: 'Esterna', probabilita: 2, impatto: 1, note: '' },
  { categoria: 'Operativo', descrizione: 'Condizioni meteo avverse che bloccano i lavori', fonte: 'Esterna', probabilita: 2, impatto: 1, note: '' },
  { categoria: 'Operativo', descrizione: 'Carenza di manodopera specializzata (muratori, gruisti)', fonte: 'Interna', probabilita: 3, impatto: 2, note: 'I soggetti più colpiti dagli infortuni restano i muratori 55-64 anni, segnale anche di un problema di ricambio generazionale nel settore (Rapporto Inail-Regioni, 2025)' },
  { categoria: 'Operativo', descrizione: 'Difetti costruttivi/vizi dell\'opera con necessità di rifacimento', fonte: 'Interna', probabilita: 2, impatto: 2, note: '' },

  // Reputazionale
  { categoria: 'Reputazionale', descrizione: 'Incidente sul lavoro con eco mediatica negativa', fonte: 'Mista', probabilita: 2, impatto: 2, note: '' },
  { categoria: 'Reputazionale', descrizione: 'Contestazioni pubbliche legate al cantiere (rumore, polvere, disagio ai residenti)', fonte: 'Esterna', probabilita: 1, impatto: 1, note: '' },
  { categoria: 'Reputazionale', descrizione: 'Contenziosi con il committente per ritardi o difetti', fonte: 'Mista', probabilita: 2, impatto: 2, note: '' },

  // Normativo / Compliance
  { categoria: 'Normativo / Compliance', descrizione: 'Violazione D.Lgs 81/08 sicurezza nei cantieri', fonte: 'Mista', probabilita: 2, impatto: 3, note: '43.931 infortuni denunciati nel comparto costruzioni nel 2024; malattie professionali denunciate +29,3% sull\'anno precedente (Dati Inail, dic. 2025) — segnale di ispezioni in intensificazione' },
  { categoria: 'Normativo / Compliance', descrizione: 'Mancato rispetto normative urbanistiche/permessi a costruire', fonte: 'Mista', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'Normativo / Compliance', descrizione: 'Irregolarità DURC o violazioni nel Codice dei Contratti Pubblici', fonte: 'Mista', probabilita: 1, impatto: 2, note: '' },
  { categoria: 'Normativo / Compliance', descrizione: 'Sanzioni per lavoro irregolare o subappalto non autorizzato', fonte: 'Mista', probabilita: 1, impatto: 2, note: '' },

  // Finanziario
  { categoria: 'Finanziario', descrizione: 'Crisi di liquidità per SAL non pagati dal committente (specie PA)', fonte: 'Mista', probabilita: 2, impatto: 3, note: '' },
  { categoria: 'Finanziario', descrizione: 'Aumento improvviso del costo dei materiali (acciaio, cemento, energia)', fonte: 'Esterna', probabilita: 2, impatto: 2, note: '' },
  { categoria: 'Finanziario', descrizione: 'Blocco o riduzione retroattiva di incentivi fiscali (superbonus/ecobonus)', fonte: 'Esterna', probabilita: 2, impatto: 3, note: '' },

  // Terze Parti / Fornitori
  { categoria: 'Terze Parti / Fornitori', descrizione: 'Fallimento o inadempienza di un subappaltatore', fonte: 'Mista', probabilita: 2, impatto: 2, note: '' },
  { categoria: 'Terze Parti / Fornitori', descrizione: 'Ritardi nella fornitura di materiali edili', fonte: 'Esterna', probabilita: 2, impatto: 1, note: '' },
  { categoria: 'Terze Parti / Fornitori', descrizione: 'Comportamento scorretto o irregolare di un subappaltatore', fonte: 'Mista', probabilita: 1, impatto: 2, note: '' },

  // Continuità Operativa
  { categoria: 'Continuità Operativa', descrizione: 'Sequestro del cantiere per irregolarità o incidente grave', fonte: 'Mista', probabilita: 1, impatto: 3, note: '' },
  { categoria: 'Continuità Operativa', descrizione: 'Danni a strutture preesistenti o a terzi durante i lavori', fonte: 'Interna', probabilita: 1, impatto: 2, note: '' },
],
}

export const RISCHI_231_EDILIZIA = [
  { categoria: 'Normativo / Compliance', descrizione: 'Corruzione di funzionari pubblici per ottenere permessi di costruire o concessioni edilizie', fonte: 'Interna', probabilita: 2, impatto: 3, note: 'Art. 24-25 D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Turbata liberta degli incanti in gare di appalto pubbliche', fonte: 'Interna', probabilita: 2, impatto: 3, note: 'Art. 25 D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Truffa aggravata ai danni dello Stato per erogazioni pubbliche e superbonus', fonte: 'Interna', probabilita: 2, impatto: 3, note: 'Art. 24 D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Frode nelle pubbliche forniture o nelle perizie tecniche richieste dalla PA', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 24 D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Induzione indebita nel rilascio di autorizzazioni urbanistiche', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25 D.Lgs. 231/01' },
  { categoria: 'Operativo', descrizione: 'Omicidio colposo o lesioni gravi per violazione norme antinfortunistiche in cantiere (D.Lgs. 81/08)', fonte: 'Interna', probabilita: 2, impatto: 3, note: 'Art. 25-septies D.Lgs. 231/01' },
  { categoria: 'Operativo', descrizione: 'Omessa o inadeguata valutazione dei rischi (DVR) nei cantieri temporanei e mobili', fonte: 'Interna', probabilita: 2, impatto: 3, note: 'Art. 25-septies D.Lgs. 231/01' },
  { categoria: 'Operativo', descrizione: 'Mancata nomina del Coordinatore per la Sicurezza in fase di esecuzione (CSE)', fonte: 'Interna', probabilita: 2, impatto: 2, note: 'Art. 25-septies D.Lgs. 231/01' },
  { categoria: 'Operativo', descrizione: 'Infortuni gravi su lavoratori di ditte subappaltatrici per carente coordinamento sicurezza', fonte: 'Mista', probabilita: 2, impatto: 3, note: 'Art. 25-septies D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Gestione illecita di rifiuti speciali da cantiere (terra, calcestruzzo, eternit, amianto)', fonte: 'Interna', probabilita: 2, impatto: 3, note: 'Art. 25-undecies D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Violazione normativa terre e rocce da scavo (DPR 120/2017)', fonte: 'Interna', probabilita: 2, impatto: 2, note: 'Art. 25-undecies D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Traffico illecito di rifiuti o miscelazione non autorizzata di rifiuti pericolosi', fonte: 'Mista', probabilita: 1, impatto: 3, note: 'Art. 25-undecies D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Inquinamento ambientale da attivita di cantiere (acque, suolo, aria)', fonte: 'Mista', probabilita: 1, impatto: 3, note: 'Art. 25-undecies D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Omessa bonifica di siti contaminati su aree oggetto di intervento edilizio', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25-undecies D.Lgs. 231/01' },
  { categoria: 'Finanziario', descrizione: 'Riciclaggio attraverso appalti gonfiati, subappalti fittizi o compravendite immobiliari', fonte: 'Mista', probabilita: 1, impatto: 3, note: 'Art. 25-octies D.Lgs. 231/01' },
  { categoria: 'Finanziario', descrizione: 'Autoriciclaggio tramite reimpiego di proventi illeciti in attivita edilizie', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25-octies D.Lgs. 231/01' },
  { categoria: 'Finanziario', descrizione: 'Impiego di denaro di provenienza illecita nei cantieri (pagamenti in contanti non tracciati)', fonte: 'Mista', probabilita: 2, impatto: 2, note: 'Art. 25-octies D.Lgs. 231/01' },
  { categoria: 'Finanziario', descrizione: 'Emissione o utilizzo di fatture per operazioni inesistenti nella catena dei subappalti', fonte: 'Mista', probabilita: 2, impatto: 3, note: 'Art. 25-quinquiesdecies D.Lgs. 231/01' },
  { categoria: 'Finanziario', descrizione: 'Dichiarazione fraudolenta mediante uso di fatture false per ridurre il carico fiscale', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25-quinquiesdecies D.Lgs. 231/01' },
  { categoria: 'Finanziario', descrizione: 'Omessa dichiarazione o occultamento di documenti contabili relativi ai cantieri', fonte: 'Interna', probabilita: 1, impatto: 2, note: 'Art. 25-quinquiesdecies D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Falso in bilancio o comunicazioni sociali infedeli nelle societa del gruppo', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25-ter D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Impedimento al controllo da parte del Collegio Sindacale o del Revisore', fonte: 'Interna', probabilita: 1, impatto: 2, note: 'Art. 25-ter D.Lgs. 231/01' },
  { categoria: 'Operativo', descrizione: 'Caporalato e sfruttamento del lavoro nella gestione della manodopera di cantiere', fonte: 'Mista', probabilita: 2, impatto: 3, note: 'Art. 25-quinquies D.Lgs. 231/01' },
  { categoria: 'Operativo', descrizione: 'Utilizzo di manodopera di imprese collegate alla criminalita organizzata nei subappalti', fonte: 'Esterna', probabilita: 1, impatto: 3, note: 'Art. 25-quater D.Lgs. 231/01' },
  { categoria: 'Operativo', descrizione: 'Impiego di cittadini stranieri con soggiorno irregolare nei cantieri', fonte: 'Mista', probabilita: 2, impatto: 2, note: 'Art. 25-duodecies D.Lgs. 231/01' },
  { categoria: 'IT / Cyber', descrizione: 'Accesso abusivo ai sistemi informatici di committenti pubblici o concorrenti (gare telematiche)', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 24-bis D.Lgs. 231/01' },
  { categoria: 'IT / Cyber', descrizione: 'Danneggiamento o alterazione di dati informatici di progetto o documentazione di gara', fonte: 'Interna', probabilita: 1, impatto: 2, note: 'Art. 24-bis D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Assenza o inefficacia del Modello Organizzativo 231 e dell Organismo di Vigilanza (OdV)', fonte: 'Interna', probabilita: 2, impatto: 3, note: 'Rischio trasversale MOG 231' },
  { categoria: 'Normativo / Compliance', descrizione: 'Mancata formazione del personale sui contenuti del Modello 231 e del Codice Etico', fonte: 'Interna', probabilita: 2, impatto: 2, note: 'Requisito art. 6 D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Canale di whistleblowing assente o non conforme al D.Lgs. 24/2023', fonte: 'Interna', probabilita: 2, impatto: 2, note: 'Obbligo dal 2023 per aziende con piu di 50 dipendenti' },
  { categoria: 'Finanziario', descrizione: 'Indebita compensazione di crediti d imposta edilizi inesistenti o non spettanti (bonus edilizi)', fonte: 'Interna', probabilita: 2, impatto: 3, note: 'Art. 25-quinquiesdecies D.Lgs. 231/01 - art. 10-quater D.Lgs. 74/2000' },
  { categoria: 'IT / Cyber', descrizione: 'Estorsione informatica: ransomware con richiesta di riscatto sui sistemi di commessa e contabilita', fonte: 'Esterna', probabilita: 2, impatto: 3, note: 'Art. 24-bis D.Lgs. 231/01 - art. 629 co.3 c.p. (L. 90/2024)' },
  { categoria: 'Normativo / Compliance', descrizione: 'Danneggiamento, deturpamento o uso illecito di beni culturali o paesaggistici in lavori su immobili vincolati', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25-septiesdecies D.Lgs. 231/01 (L. 22/2022)' },
  { categoria: 'Normativo / Compliance', descrizione: 'Combustione o abbandono illecito di rifiuti di cantiere', fonte: 'Mista', probabilita: 2, impatto: 3, note: 'Art. 25-undecies D.Lgs. 231/01 - D.L. 116/2025 (Terra dei fuochi)' },
  { categoria: 'Normativo / Compliance', descrizione: 'Impedimento o ostacolo ai controlli ambientali in cantiere', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25-undecies D.Lgs. 231/01 - art. 452-septies c.p. (2025)' },
  { categoria: 'Finanziario', descrizione: 'Sottrazione all accisa su prodotti energetici: uso irregolare di gasolio agevolato per mezzi d opera', fonte: 'Interna', probabilita: 1, impatto: 2, note: 'Art. 25-sexiesdecies D.Lgs. 231/01 (D.Lgs. 141/2024)' },
  { categoria: 'Normativo / Compliance', descrizione: 'Corruzione tra privati verso direzione lavori o committenti privati per collaudi e accettazioni', fonte: 'Interna', probabilita: 1, impatto: 2, note: 'Art. 25-ter D.Lgs. 231/01 - art. 2635 c.c.' },
]

export const RISCHI_231_GENERICO = [
  { categoria: 'Normativo / Compliance', descrizione: 'Corruzione o induzione indebita di funzionari pubblici per ottenere vantaggi commerciali o autorizzazioni', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 24-25 D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Truffa aggravata ai danni dello Stato per accesso a fondi pubblici, contributi o agevolazioni', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 24 D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Turbata liberta degli incanti o delle procedure di gara pubblica', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25 D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Omicidio colposo o lesioni gravi per violazione delle norme sulla sicurezza nei luoghi di lavoro (D.Lgs. 81/08)', fonte: 'Interna', probabilita: 2, impatto: 3, note: 'Art. 25-septies D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Omessa valutazione dei rischi (DVR) e mancata nomina delle figure obbligatorie per la sicurezza', fonte: 'Interna', probabilita: 2, impatto: 2, note: 'Art. 25-septies D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Gestione illecita di rifiuti speciali prodotti dall attivita aziendale', fonte: 'Interna', probabilita: 1, impatto: 2, note: 'Art. 25-undecies D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Scarichi industriali o emissioni atmosferiche non conformi alle autorizzazioni', fonte: 'Interna', probabilita: 1, impatto: 2, note: 'Art. 25-undecies D.Lgs. 231/01' },
  { categoria: 'Finanziario', descrizione: 'Riciclaggio o autoriciclaggio di proventi illeciti attraverso attivita aziendali', fonte: 'Mista', probabilita: 1, impatto: 3, note: 'Art. 25-octies D.Lgs. 231/01' },
  { categoria: 'Finanziario', descrizione: 'Impiego di denaro di provenienza illecita nei pagamenti aziendali', fonte: 'Mista', probabilita: 1, impatto: 2, note: 'Art. 25-octies D.Lgs. 231/01' },
  { categoria: 'Finanziario', descrizione: 'Emissione o utilizzo di fatture per operazioni inesistenti per ridurre il carico fiscale', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25-quinquiesdecies D.Lgs. 231/01' },
  { categoria: 'Finanziario', descrizione: 'Dichiarazione fraudolenta o omessa dichiarazione fiscale', fonte: 'Interna', probabilita: 1, impatto: 2, note: 'Art. 25-quinquiesdecies D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Falso in bilancio o comunicazioni sociali infedeli verso soci e mercato', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25-ter D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Impedimento o ostruzione al controllo da parte del Collegio Sindacale o del Revisore', fonte: 'Interna', probabilita: 1, impatto: 2, note: 'Art. 25-ter D.Lgs. 231/01' },
  { categoria: 'Operativo', descrizione: 'Intermediazione illecita e sfruttamento del lavoro (caporalato) nella gestione della manodopera', fonte: 'Mista', probabilita: 1, impatto: 3, note: 'Art. 25-quinquies D.Lgs. 231/01' },
  { categoria: 'Operativo', descrizione: 'Impiego di lavoratori stranieri con permesso di soggiorno irregolare o scaduto', fonte: 'Mista', probabilita: 1, impatto: 2, note: 'Art. 25-duodecies D.Lgs. 231/01' },
  { categoria: 'IT / Cyber', descrizione: 'Accesso abusivo a sistemi informatici di concorrenti, clienti o pubbliche amministrazioni', fonte: 'Interna', probabilita: 1, impatto: 2, note: 'Art. 24-bis D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Assenza o inefficacia del Modello Organizzativo 231 e dell Organismo di Vigilanza (OdV)', fonte: 'Interna', probabilita: 2, impatto: 3, note: 'Rischio trasversale MOG 231' },
  { categoria: 'Normativo / Compliance', descrizione: 'Mancata formazione del personale sui contenuti del Modello 231 e del Codice Etico aziendale', fonte: 'Interna', probabilita: 2, impatto: 2, note: 'Requisito art. 6 D.Lgs. 231/01' },
  { categoria: 'Normativo / Compliance', descrizione: 'Canale di whistleblowing assente o non conforme al D.Lgs. 24/2023', fonte: 'Interna', probabilita: 2, impatto: 2, note: 'Obbligo dal 2023 per aziende con piu di 50 dipendenti' },
  { categoria: 'IT / Cyber', descrizione: 'Estorsione informatica: ransomware con richiesta di riscatto sui sistemi aziendali', fonte: 'Esterna', probabilita: 2, impatto: 3, note: 'Art. 24-bis D.Lgs. 231/01 - art. 629 co.3 c.p. (L. 90/2024)' },
  { categoria: 'Finanziario', descrizione: 'Indebita compensazione di crediti d imposta inesistenti o non spettanti', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25-quinquiesdecies D.Lgs. 231/01 - art. 10-quater D.Lgs. 74/2000' },
  { categoria: 'Finanziario', descrizione: 'Frodi con strumenti di pagamento diversi dai contanti (carte, bonifici, valute virtuali)', fonte: 'Mista', probabilita: 1, impatto: 2, note: 'Art. 25-octies.1 D.Lgs. 231/01 (D.Lgs. 184/2021)' },
  { categoria: 'Normativo / Compliance', descrizione: 'Violazione di misure restrittive UE nelle operazioni con controparti estere sanzionate', fonte: 'Interna', probabilita: 1, impatto: 3, note: 'Art. 25-octies.2 D.Lgs. 231/01 (D.Lgs. 211/2025)' },
  { categoria: 'Normativo / Compliance', descrizione: 'Corruzione tra privati nei rapporti commerciali con clienti e fornitori', fonte: 'Interna', probabilita: 1, impatto: 2, note: 'Art. 25-ter D.Lgs. 231/01 - art. 2635 c.c.' },
  { categoria: 'Normativo / Compliance', descrizione: 'Combustione o abbandono illecito di rifiuti aziendali', fonte: 'Mista', probabilita: 1, impatto: 2, note: 'Art. 25-undecies D.Lgs. 231/01 - D.L. 116/2025' },
]

export const RISCHI_PER_SETTORE_231 = {
  'Edilizia': RISCHI_231_EDILIZIA,
  'Generico': RISCHI_231_GENERICO,
}

export function getRischiDefault(settore) {
  const settoreSpecifico = RISCHI_PER_SETTORE[settore] || []
  if (settoreSpecifico.length > 0) {
    return [...RISCHI_DEFAULT, ...settoreSpecifico]
  }
  return RISCHI_DEFAULT
}

// Suggerimenti di fallback per categoria: si attivano solo per rischi personalizzati
// non coperti dai suggerimenti specifici. Chiave = parola contenuta nella descrizione.
const SUGGERIMENTI_AZIONI = {
  'Antiriciclaggio': {
    'titolare effettivo': `Adeguata verifica dei mandanti (AML-04, AML-06): dichiarazione del titolare effettivo, verifica su visura e registro dei titolari effettivi, rafforzata se la struttura resta opaca; astensione se non individuabile. Fascicolo AML del mandante completo prima dell'avvio del mandato.`,
    'terzi': `Verifica del pagatore a ogni incasso (AML-05): se il pagatore non e' il debitore o un soggetto legato, raccolta dati e motivazione; senza giustificazione, segnalazione interna al Delegato SOS. Controllo a campione mensile degli incassi da terzi.`,
    'contante': `Incassi tracciabili come regola (AML-10): contante solo entro la soglia di legge con ricevuta e identificazione del pagatore, divieto di frazionamento; comunicazione al MEF entro 30 giorni delle infrazioni rilevate e valutazione della SOS.`,
    'rimborso': `Eccedenze restituite solo sul conto di provenienza previa verifica del RAML (AML-05); rifiuto di rimborsi su conti diversi e segnalazione interna al Delegato SOS.`,
    'segnalazione': `Procedura SOS (AML-09): segnalazione interna senza ritardo nel portale, istruttoria e decisione motivata del Delegato entro 15 giorni, invio alla UIF tramite Infostat; formazione mirata sugli indicatori di anomalia UIF; riservatezza del segnalante.`,
    'fascicoli': `Controllo costante (AML-07): scadenze di revisione per classe di rischio (alto 12 mesi, medio 24, basso 36) generate dal portale; supervisione trimestrale del RAML sulle revisioni scadute.`,
    'formato': `Piano formativo AML annuale (AML-11) con corso nel portale, test di verifica e registro della formazione; formazione iniziale entro 30 giorni dall'ingresso.`,
    'conservat': `Conservazione decennale nei fascicoli AML del portale con impronta hash e registro degli accessi (AML-08); verifica a campione dell'esibibilita' dei documenti.`,
    'nominate': `Delibera dell'organo amministrativo di nomina del Responsabile AML e del Delegato SOS (tipo di atto «Antiriciclaggio» nel percorso guidato) con requisiti, poteri, risorse, sostituti e accettazione; relazione annuale al CdA (AML-01).`,
    'default': `Ricondurre il rischio alla procedura AML di riferimento, verificarne l'applicazione con un controllo a campione (AML-12) e registrare le azioni correttive con responsabile e scadenza; aggiornare l'autovalutazione (AML-02).`,
  },
  'IT / Cyber': {
    'phishing': `Programma anti-phishing strutturato: simulazioni trimestrali con scenari differenziati per reparto, formazione mirata (non punitiva) per chi cade nella simulazione, regola di verifica fuori banda per richieste di pagamento o cambio IBAN (conferma telefonica a numero gia noto). Attivare SPF, DKIM e DMARC sul dominio email. KPI: tasso di click sotto il 5% entro 12 mesi.`,
    'credenzial': `Governance delle identita: password manager aziendale, MFA su tutti i servizi esposti, revisione trimestrale dei privilegi (principio del minimo privilegio), disattivazione account entro 24 ore dalla cessazione del rapporto, utenze amministrative separate da quelle operative. Log degli accessi conservati 12 mesi con revisione mensile delle anomalie.`,
    'obsolescen': `Censimento asset IT con data di fine supporto per ogni sistema. Piano di sostituzione pluriennale con budget dedicato, priorita ai sistemi esposti a internet. Per i legacy non sostituibili: segregazione di rete, accessi limitati, monitoraggio rafforzato. Aggiornare il censimento ogni 6 mesi.`,
    'default': `Assessment cyber basato su CIS Controls (livello IG1) o Framework Nazionale Cybersecurity: gap analysis sulle misure essenziali, piano di rimedio a 12 mesi ordinato per rapporto costo/beneficio, con responsabile e budget per ogni intervento. Rivalutazione annuale e dopo ogni incidente. Valutare polizza cyber con copertura per interruzione attivita e data breach.`,
  },
  'Strategico': {
    'concorren': `Analisi competitiva strutturata: monitoraggio trimestrale di prezzi, offerta e mosse dei 3-5 concorrenti principali (bilanci depositati, siti, fiere di settore). Identificare il vantaggio competitivo difendibile e concentrare li gli investimenti. Win/loss analysis scritta su ogni trattativa persa per leggere dove si sta spostando il mercato.`,
    'tecnolog': `Roadmap di innovazione a 3 anni: mappare le tecnologie emergenti del settore e classificarle per impatto e maturita, budget annuale protetto per sperimentazioni anche piccole, partnership con universita o startup per competenze non presenti in azienda. Revisione della roadmap ogni 6 mesi in comitato di direzione.`,
    'domanda': `Early warning commerciale: monitorare mensilmente 3-5 indicatori anticipatori della domanda (portafoglio ordini, richieste di offerta, indici di settore). Predisporre scenari base/contrazione/crescita con azioni gia decise per ciascuno. Struttura dei costi con quota flessibile in grado di assorbire una contrazione del 20%.`,
    'default': `Risk assessment strategico annuale in sede di budget: per ogni obiettivo strategico identificare i 2-3 rischi che possono comprometterlo, con owner e indicatore misurabile. Revisione semestrale in comitato di direzione con decisioni verbalizzate. Collegare il registro rischi al piano industriale.`,
  },
  'Operativo': {
    'difett': `Controlli qualita in-process: definire i punti di controllo critici, checklist con soglie di accettazione, registrazione delle non conformita con analisi delle cause (5 perche o Ishikawa) e azioni correttive tracciate. KPI mensili: tasso di difettosita, costi della non qualita, reclami. Audit interno semestrale.`,
    'scorte': `Gestione scorte a doppio livello: scorta di sicurezza calcolata su variabilita della domanda e lead time per gli articoli di classe A, riordino automatico a punto fisso, inventario ciclico mensile. KPI: rotture di stock, indice di rotazione, obsolescenza. Ricalibrare i parametri ogni trimestre.`,
    'default': `Analisi FMEA sul processo interessato: scomporlo in fasi e per ciascuna valutare gravita, probabilita e rilevabilita del guasto; priorita di intervento in base all'indice di rischio (RPN). Azioni di mitigazione con responsabile e scadenza. Ricalcolare l'RPN dopo ogni intervento per misurarne l'efficacia.`,
  },
  'Reputazionale': {
    'social': `Presidio della reputazione digitale: alert automatici sulle menzioni del brand, procedura di risposta alle recensioni negative entro 48 ore con tono predefinito, escalation alla direzione per i casi sensibili, divieto di risposte a caldo. Report trimestrale sul sentiment con azioni correttive sui temi ricorrenti.`,
    'default': `Mappa dei rischi reputazionali per stakeholder (clienti, dipendenti, comunita, media): per ciascuno individuare gli eventi scatenanti piu probabili e preparare in anticipo posizione e messaggi chiave. Portavoce unico designato. Monitoraggio delle menzioni e revisione annuale della mappa; ogni crisi chiusa con lesson learned scritta.`,
  },
  'Normativo / Compliance': {
    'misure restrittive': `Screening sanzioni per le operazioni con l'estero: verifica delle controparti (e dei titolari effettivi) sulle liste UE consolidate prima di contratti, spedizioni e pagamenti; blocco automatico verso paesi/soggetti listati; conservazione delle evidenze di verifica. Nominare un referente sanctions e aggiornare la verifica a ogni rinnovo contrattuale e a ogni aggiornamento delle liste.`,
    'beni culturali': `Per interventi su immobili vincolati o in aree tutelate: verifica preventiva dei vincoli (soprintendenza, PPR), autorizzazioni acquisite prima dell'avvio, procedure operative specifiche per le lavorazioni a contatto con elementi tutelati, formazione delle maestranze, documentazione fotografica ante/durante/post. Stop-work immediato in caso di ritrovamenti.`,
    'tra privati': `Prevenzione della corruzione tra privati: policy regali e ospitalita con soglie e registro, divieto di utilita a dipendenti di clienti/fornitori per ottenere collaudi, accettazioni o condizioni di favore, doppia firma sugli sconti anomali, clausole anticorruzione nei contratti, canale di segnalazione. Formazione mirata a commerciale e acquisti.`,
    'combustione': `Divieto assoluto di combustione e abbandono di rifiuti, comunicato formalmente e sanzionato disciplinarmente. Deposito temporaneo conforme (aree delimitate, tempi e quantita di legge), tracciabilita completa con formulari, verifiche periodiche del responsabile e sopralluoghi a sorpresa. Attenzione al D.L. 116/2025: aggravanti specifiche per l'attivita d'impresa.`,
    'impedimento': `Procedura per ispezioni e controlli ambientali: obbligo di piena collaborazione con gli organi di controllo, divieto di ostacolare accessi e campionamenti, referente unico per le ispezioni, verbalizzazione interna di ogni visita, conservazione ordinata della documentazione ambientale sempre esibibile. Il nuovo art. 452-septies c.p. punisce l'impedimento del controllo.`,
    'ambiental': `Compliance ambientale: scadenzario di autorizzazioni e adempimenti (MUD, registri carico/scarico rifiuti, FIR) con responsabile unico. Verificare iscrizione all'Albo Gestori dei trasportatori e destinazione finale dei rifiuti. Audit ambientale annuale; valutare ISO 14001 se la pressione normativa cresce.`,
    'antiriciclaggio': `Presidio antiriciclaggio ex D.Lgs. 231/2007: verifica adeguata della controparte per operazioni rilevanti (titolare effettivo, provenienza fondi), divieto di contanti oltre soglia di legge, tracciabilita completa dei flussi, procedura per segnalazione operazioni sospette. Formazione ad amministrazione e commerciale sui segnali di allarme. Evidenze conservate 10 anni.`,
    'default': `Compliance program dedicato: (1) censire gli obblighi applicabili con supporto specialistico, (2) gap analysis documentata, (3) piano di adeguamento con priorita sulle sanzioni piu gravi, (4) scadenzario adempimenti con alert e responsabile unico, (5) audit di conformita annuale. Presidiare le novita normative con una fonte dedicata (newsletter di categoria o consulente).`,
  },
  'Finanziario': {
    'compensazione': `Presidio sui crediti d'imposta: utilizzare in compensazione solo crediti supportati da documentazione completa (asseverazioni, visti di conformita, contratti, pagamenti tracciati), due diligence rafforzata sui crediti acquistati da terzi (catena delle cessioni, soggetto originario), parere fiscale scritto prima di compensazioni rilevanti, segregazione tra chi matura e chi utilizza il credito. Conservare il fascicolo di ogni credito per 10 anni.`,
    'accisa': `Uso conforme dei prodotti energetici agevolati: registro dei consumi per mezzo e per cantiere, rifornimenti solo da depositi autorizzati con documentazione, divieto di uso promiscuo del gasolio agevolato, riconciliazione periodica consumi/ore mezzo, verifiche a campione. Formare i responsabili di cantiere sulle condizioni di impiego agevolato.`,
    'materie prime': `Gestione del rischio prezzo: clausole di revisione prezzi o indicizzazione nei contratti di vendita pluriennali, contratti quadro con prezzi bloccati 6-12 mesi sulle materie critiche, coperture fisiche (forward) per le esposizioni maggiori. Monitorare mensilmente l'incidenza dei costi sulle commesse aperte e rinegoziare oltre la soglia definita.`,
    'cambio': `Rischio cambio: quantificare l'esposizione netta per valuta a 12 mesi, coprire con forward la quota certa dei flussi (ordini confermati), fatturare in euro dove il potere negoziale lo consente, conti in valuta per compensare naturalmente incassi e pagamenti. Politica di copertura scritta approvata dalla direzione, con divieto di posizioni speculative.`,
    'tassi': `Rischio tasso: mappare i finanziamenti a tasso variabile e simulare l'impatto di +200 punti base sul conto economico. Se supera la soglia di tolleranza, valutare IRS o CAP sulla quota di debito a medio-lungo termine, o rinegoziare a tasso fisso. Rivedere la struttura del debito annualmente.`,
    'default': `Presidio finanziario: cruscotto mensile con margini per commessa/linea, posizione finanziaria netta, DSO/DPO e covenant bancari. Budget con revisione trimestrale e analisi scostamenti scritta. Stress test sugli scenari peggiori (perdita del cliente principale, incassi ritardati di 60 giorni) con piani di risposta gia definiti.`,
  },
  'Terze Parti / Fornitori': {
    'outsourcing': `Governance dell'outsourcing: contratto con SLA misurabili, penali, diritto di audit, exit plan e clausola di reversibilita (dati e know-how rientrano in azienda a fine rapporto). Referente interno che conserva la competenza per controllare il fornitore. Review formale delle performance ogni trimestre. Esternalizzare l'esecuzione, mai il controllo.`,
    'subappalt': `Albo subappaltatori qualificati: verifica preventiva (visura, DURC, referenze, capacita tecnica), valutazione delle performance a fine lavoro che aggiorna l'albo, contratti scritti con SLA e responsabilita chiare, vigilanza sull'esecuzione con sopralluoghi documentati. Nessun affidamento a soggetti non qualificati, nemmeno in urgenza.`,
    'default': `Vendor risk management proporzionato: classificare i fornitori per criticita (impatto sull'operativita se vengono meno); per i critici richiedere evidenze annuali (bilancio, certificazioni, coperture assicurative), qualificare un'alternativa e testarla periodicamente, monitorare i segnali di deterioramento (ritardi, calo qualita, richieste anomale di anticipi). Riclassificare ogni anno.`,
  },
  'Continuità Operativa': {
    'incendio': `Prevenzione incendi oltre il minimo di legge: verificare che CPI/SCIA antincendio rispecchi l'attivita reale, manutenzione semestrale documentata di estintori e impianti, prova di evacuazione annuale con verbale, archivi e server separati dalle aree a rischio, copia offsite di dati e documenti vitali. Polizza incendio con valori assicurati aggiornati per evitare sottoassicurazione.`,
    'alluvion': `Verificare l'esposizione della sede con le mappe di pericolosita idraulica (ISPRA/PAI). Misure fisiche proporzionate: barriere, server e archivi ai piani alti, materiali critici sollevati da terra. Polizza catastrofale (obbligo assicurativo imprese dal 2025). Smart working o sito alternativo come piano B, testato una volta l'anno.`,
    'inagibil': `Piano di indisponibilita sede: definire come operare 30 giorni senza accesso ai locali - smart working immediato per le funzioni d'ufficio, sito alternativo o accordo di mutuo soccorso con azienda partner per le attivita fisiche, recapiti alternativi comunicati a clienti e fornitori entro 24 ore. Test annuale di una giornata di operativita fuori sede.`,
    'default': `Business Impact Analysis mirata: per il processo interessato definire RTO (fermo massimo tollerabile) e risorse minime per ripartire (persone, sistemi, fornitori, dati). Strategia di continuita dimensionata sull'RTO, procedura di emergenza di una pagina (chi fa cosa nelle prime 4 ore), test annuale con verbale e azioni di miglioramento.`,
  },
}

export function getSuggerimentoAzione(categoria, descrizione) {
  const desc = (descrizione || '').toLowerCase()

  // Suggerimenti specifici per descrizione
  if (desc.includes('ransomware'))
    return `Implementare EDR su tutti i dispositivi. Attivare MFA obbligatorio su email, VPN e gestionali. Predisporre piano di risposta ransomware: isolamento, contatti CERT, comunicazione interna. Simulazioni phishing semestrali. Testare ripristino da backup ogni trimestre.`
  if (desc.includes('violazione dei dati personali') || desc.includes('gdpr'))
    return `Audit GDPR completo: mappatura trattamenti art. 30, verifica DPA con fornitori, aggiornamento informative. Verificare nomina DPO. Procedura data breach: notifica Garante entro 72 ore. DPIA per trattamenti ad alto rischio. Formazione annuale tutto il personale.`
  if (desc.includes('vulnerabilit') || desc.includes('software non aggiornato'))
    return `Inventariare tutti i software e definire patch policy: mensile per patch ordinarie, 48 ore per critiche. Attivare aggiornamenti automatici. Vulnerability scan semestrale. Rimuovere sistemi end-of-life. Registro vulnerabilita aperte con responsabile e priorita.`
  if (desc.includes('backup'))
    return `Implementare regola 3-2-1: 3 copie, 2 supporti diversi, 1 offsite. Backup giornalieri automatici con verifica integrita. Testare ripristino completo ogni trimestre documentando i tempi. Definire RTO e RPO per ogni sistema critico. Backup offline per protezione ransomware.`
  if (desc.includes('provider') || desc.includes('hosting') || desc.includes('cloud'))
    return `Strategia resilienza cloud: provider secondario o hot-standby on-premise per servizi critici. RTO e RPO contrattualizzati. SLA con penali per downtime. Test failover annuale con verbale. Copia locale dati critici aggiornata.`
  if (desc.includes('cliente chiave') || desc.includes('>20% fatturato'))
    return `Diversificazione portafoglio clienti: obiettivo concentrazione sotto 15% per singolo cliente entro 12 mesi. QBR trimestrali con top 5 clienti. Sviluppare nuovi mercati o segmenti. Monitorare concentrazione fatturato come KPI mensile. Accantonamento in bilancio per rischio cliente.`
  if (desc.includes('leadership') || desc.includes('figure chiave'))
    return `Succession planning: identificare posizioni chiave, valutare successori interni, piani di sviluppo individuali. Backup operativo per ogni C-level. Clausole retention nei contratti manager strategici. Documentare conoscenze critiche in wiki interna. Revisione annuale piano successione.`
  if (desc.includes('macchinari') || desc.includes('infrastrutture critiche'))
    return `Piano manutenzione preventiva con registro interventi. Contratti manutenzione con SLA per macchinari critici. Identificare macchinari senza ridondanza e valutare backup o noleggio emergenza. Analisi FMEA per processi produttivi critici.`
  if (desc.includes('singolo fornitore') || desc.includes('unico fornitore'))
    return `Mappare fornitori critici. Identificare almeno un fornitore alternativo qualificato per ognuno. Diversificare acquisti: massimo 60% da singolo fornitore per categorie critiche. Stock di sicurezza per materiali a lungo lead time. Clausole contrattuali di continuita fornitura.`
  if (desc.includes('carenza di personale qualificato'))
    return `Partnership con ITS, universita e agenzie lavoro per pipeline talenti. Piano formazione interna e upskilling con budget dedicato. Benchmark retributivo annuale. Programma retention: survey clima, piani carriera, benefit competitivi. Monitorare turnover mensile come KPI HR.`
  if (desc.includes('ordini') || desc.includes('contratti'))
    return `Sistema gestione contratti con alert scadenze. Checklist revisione contrattuale prima della firma (4-eyes principle). Formare personale commerciale e operativo. Riconciliazione mensile ordini-consegne-fatture. Repository centralizzato documentazione contrattuale.`
  if (desc.includes('know-how') || desc.includes('turnover'))
    return `Knowledge management: documentare processi chiave in wiki, video tutorial attivita critiche, affiancamenti strutturati per figure critiche. Matrice competenze per identificare dipendenze da singole persone. Monitorare turnover mensile. Exit interview sistematiche.`
  if (desc.includes('logistica') || desc.includes('consegna'))
    return `Mappare catena logistica e identificare nodi senza ridondanza. Qualificare almeno 2 vettori alternativi per rotte principali. Stock di sicurezza per prodotti a maggiore rotazione. SLA con penali per ritardi. Piano emergenza logistica con rerouting.`
  if (desc.includes('comportamento scorretto') && !desc.includes('subappaltatore'))
    return `Codice Etico con norme comportamento chiare, diffuso con firma per ricevuta. Canale segnalazione anonima (whistleblowing). Processo disciplinare trasparente e proporzionato. Formare responsabili HR sulla gestione casi. Screening reputazionale per posizioni di responsabilita.`
  if (desc.includes('comunicazione di crisi'))
    return `Crisis Communication Plan: portavoce ufficiale designato, messaggi chiave per scenari probabili, canali e approvazioni definiti. Tabletop exercise annuale. Monitoraggio reputazione online con social listening. Aggiornamento piano annuale.`
  if (desc.includes('certificazioni') || desc.includes('riconoscimenti'))
    return `Mappa certificazioni con scadenze e responsabili. Alert automatici 90 e 30 giorni prima di ogni scadenza. Responsabile certificazioni con delega formale. Audit interni pre-certificazione 3 mesi prima del rinnovo.`
  if (desc.includes('controversie pubbliche') || desc.includes('stakeholder'))
    return `Mappare stakeholder e temi di controversia. Stakeholder engagement proattivo: incontri periodici, canali dedicati, report sostenibilita. Procedura gestione controversie con escalation verso direzione. Formare responsabili sulla comunicazione con stakeholder critici.`
  if (desc.includes('reputazionali da fornitori') || desc.includes('danni reputazionali da fornitori'))
    return `Due diligence reputazionale sui fornitori strategici: verifica online, referenze, visita sede. Clausole etiche nei contratti con risoluzione per violazioni. Monitorare reputazione fornitori principali. Audit fornitori annuali per quelli critici.`
  if (desc.includes('non conformita gdpr') || (desc.includes('gdpr') && desc.includes('privacy')))
    return `Audit GDPR: mappare trattamenti registro art. 30, base giuridica, informative aggiornate, DPA con fornitori. Formazione personale e-learning annuale con test. Nominare DPO. Procedura data breach con notifica Garante 72 ore. DPIA per nuovi trattamenti ad alto rischio.`
  if (desc.includes('81/08') || (desc.includes('sicurezza') && desc.includes('lavoro')))
    return `Aggiornare DVR e verificare scadenze formazione obbligatoria (preposti, antincendio, primo soccorso). Sopralluogo RSPP entro 30 giorni. Verificare disponibilita e adeguatezza DPI. Aggiornare registro infortuni e quasi-infortuni. Simulazioni emergenza semestrali con verbale.`
  if (desc.includes('fiscale') || desc.includes('tributaria'))
    return `Revisione fiscale preventiva annuale con commercialista. Verificare adempimenti periodici (IVA, F24, dichiarazioni). Calendario adempimenti con alert automatici. Valutare internal audit sulla contabilita. Conservare documentazione fiscale per almeno 10 anni.`
  if (desc.includes('liquidit'))
    return `Cash flow forecast settimanale a 13 settimane aggiornato ogni lunedi. Linea di credito revolving di emergenza con banca principale. Alert sulla liquidita: sotto 3 mensilita di costi fissi, escalation immediata a CFO e CEO. Accelerare incassi con incentivi pagamento anticipato.`
  if (desc.includes('insolvenza di clienti'))
    return `Credit scoring per clienti con esposizione sopra 5% fatturato. Assicurazione crediti (SACE, Euler Hermes). Monitorare puntualita pagamenti e intervenire entro 15 giorni dallo scaduto. Clausole di riserva di proprieta e fideiussioni per commesse rilevanti. Valutare factoring pro-soluto per fatture verso PA.`
  if (desc.includes('credito bancario') || desc.includes('accesso al credito'))
    return `Dossier finanziario aggiornato (bilanci, business plan triennale, proiezioni cash flow). Diversificare fonti: Confidi, finanza agevolata SIMEST/SACE, factoring. Relazioni proattive con almeno 2 istituti di credito. Monitorare rating bancario e intervenire prima di necessita urgenti.`
  if (desc.includes('fallimento di un fornitore strategico'))
    return `Identificare fornitori strategici e qualificare un alternativo per ognuno. Richiedere bilanci e situazione finanziaria ai fornitori critici annualmente. Monitorare segnali difficolta: ritardi, riduzione qualita, richieste di anticipi. Clausole di continuita del servizio in caso di procedure concorsuali.`
  if (desc.includes('mancato rispetto contrattuale') || (desc.includes('partner') && desc.includes('rispetto')))
    return `Due diligence prima di stipulare contratti: verifica referenze, sopralluogo, analisi finanziaria. SLA misurabili con penali, clausole risolutive per inadempimenti gravi, diritto di audit. Monitorare performance con KPI mensili. Processo strutturato di contestazione prima del contenzioso.`
  if (desc.includes('assenza prolungata') || desc.includes('malattia, dimissioni'))
    return `Identificare posizioni critiche e designare sostituto operativo per ognuna. Documentare processi critici in procedure scritte. Polizza assicurativa key man per figure indispensabili. Rotazione responsabilita per ridurre dipendenze. Testare piani di sostituzione almeno una volta l'anno.`
  if (desc.includes('rete internet') || desc.includes('telecomunicazioni'))
    return `Connessione internet backup su tecnologia diversa (fibra + 4G/5G) con failover automatico. Verificare operativita sistemi critici in modalita offline. SLA con provider con penali per downtime. Test failover semestrale. Identificare e prioritizzare attivita che richiedono connessione continua.`
  if (desc.includes('blackout') || desc.includes('elettrico'))
    return `UPS per sistemi IT critici con autonomia minima 4 ore. Valutare gruppo elettrogeno per continuita oltre 4 ore. Test sistema backup elettrico ogni 6 mesi con verbale. Identificare processi che possono continuare senza corrente. Verificare contratti fornitore energia per SLA.`
  if (desc.includes('piani di continuita') || desc.includes('bcp'))
    return `Redigere Business Continuity Plan: analisi impatto processi critici (BIA), minacce principali, strategie risposta, procedure operative emergenza, piano comunicazione. Nominare BCP Manager con delega formale. Drill annuale e aggiornamento piano. Riferimento: ISO 22301.`
  if (desc.includes('pandemia') || desc.includes('assenza massiva'))
    return `Protocollo smart working esteso: posizioni remote, dotazione tecnologica, sicurezza informatica da casa. Team gestione emergenze sanitarie. Identificare attivita che richiedono presenza fisica con relative misure di protezione. Mantenere scorte DPI. Simulazione annuale operativita ridotta.`

  // Edilizia specifica
  if (desc.includes('bim') || desc.includes('gestionali di cantiere'))
    return `Policy sicurezza per sistemi BIM: backup giornaliero modelli, accessi con credenziali personali, log modifiche, cifratura file di progetto. Diritti di accesso per figura professionale. Copia offline aggiornata settimanalmente. Clausole riservatezza nei contratti con studi esterni.`
  if (desc.includes('furto o perdita di dati di progetto'))
    return `Classificare dati di progetto per riservatezza. Cifrare file relativi a gare pubbliche. Vietare dispositivi personali per dati di progetto. DLP per bloccare invio file riservati. NDA con collaboratori esterni. Audit semestrale sugli accessi ai file di progetto.`
  if (desc.includes('fluttuazione della domanda') || desc.includes('cicli edilizi'))
    return `Diversificare portafoglio lavori per tipologia (privato, pubblico, manutenzione) e area geografica. Monitorare indicatori anticipatori: permessi di costruire, bandi pubblici. Struttura costi flessibile. Pipeline commesse con copertura minima 18 mesi.`
  if (desc.includes('singolo grande appalto') || desc.includes('appalto pubblico'))
    return `Limitare dipendenza da singolo committente pubblico al 40% portafoglio ordini. Diversificare per stazione appaltante (Comuni, ANAS, RFI, privati). Clausole revisione prezzi per commesse pluriennali. Verificare disponibilita finanziaria effettiva del committente prima di iniziare.`
  if (desc.includes('infortunio grave') || desc.includes('caduta'))
    return `Procedura Zero Cadute: checklist giornaliera ponteggi e aperture nel vuoto, verifica DPI anticaduta ad ogni turno, stop lavori in quota con vento oltre 50 km/h. Sopralluogo sicurezza settimanale con verbale firmato. Videosorveglianza aree rischiose. Analisi ogni quasi-infortunio entro 24 ore.`
  if (desc.includes('cronoprogramma') || desc.includes('ritardi di cantiere'))
    return `Gestione cantiere con software dedicato (MS Project, Primavera) aggiornato settimanalmente. Monitorare percorso critico quotidianamente. Riunioni avanzamento settimanali con verbale. Early warning: alert automatico quando ritardo supera 10% su attivita critiche. Penali e bonus per rispetto tempi.`
  if (desc.includes('mezzi e macchinari') || desc.includes('gru') || desc.includes('escavatori'))
    return `Registro manutenzione per ogni mezzo con checklist pre-utilizzo giornaliera firmata dall'operatore. Verificare abilitazione specifica per ogni mezzo (patentino gru, escavatore). Verifiche periodiche obbligatorie nei tempi previsti. Contratto manutenzione con SLA per mezzi critici.`
  if (desc.includes('furto di materiali') || desc.includes('attrezzature da cantiere'))
    return `Videosorveglianza perimetrale H24 con alert movimenti notturni. Inventariare e contrassegnare (incisione, RFID) tutti i macchinari. Polizza All-Risk di cantiere specifica. Recinzione adeguata con chiusura sicura. Valutare guardiania notturna in zone ad alto rischio.`
  if (desc.includes('condizioni meteo') || desc.includes('bloccano i lavori'))
    return `Clausole meteo nei contratti: giorni sospensione per maltempo esclusi dal computo. Pianificare attivita in quota nei periodi favorevoli. Monitorare previsioni meteo a 7 giorni. Attivita alternative al coperto da attivare in caso di blocco. Copertura assicurativa per danni da maltempo.`
  if (desc.includes('manodopera specializzata') || desc.includes('gruisti'))
    return `Rete subappaltatori specializzati qualificati, relazioni attive anche in bassa stagione. Programmi formazione interna per figure carenti sul mercato. Anticipare assunzioni rispetto ai cantieri (lead time 2-3 mesi). Collaborare con associazioni di categoria. Formazione tramite ITS e apprendistato.`
  if (desc.includes('difetti costruttivi') || desc.includes('vizi'))
    return `Sistema qualita di cantiere ISO 9001: checklist controllo qualita per ogni fase, verbali accettazione materiali, test e collaudi intermedi documentati. Direttore Tecnico con poteri di stop ai lavori per non conformita. Conservare documentazione cantiere 10 anni. Polizza decennale postuma per opere strutturali.`
  if (desc.includes('eco mediatica') || (desc.includes('infortun') && desc.includes('mediatica')))
    return `Piano comunicazione crisi per infortuni: portavoce designato, messaggio condoglianze prima di qualsiasi altra comunicazione, nessuna dichiarazione cause prima indagine ispettorato. Procedura notifica interna. Monitorare social media nelle ore successive. Comunicare misure correttive adottate.`
  if (desc.includes('contestazioni pubbliche') || desc.includes('rumore') || desc.includes('polvere'))
    return `Riunione informativa con residenti prima del cantiere. Calendario lavorazioni rumorose affisso all'esterno. Rispettare fasce orarie comunali. Sistemi abbattimento polveri (nebulizzatori, teloni). Referente cantiere per segnalazioni cittadini con risposta entro 24 ore.`
  if (desc.includes('contenziosi con il committente') || desc.includes('ritardi o difetti'))
    return `Aggiornare giornale dei lavori con ogni evento rilevante. Formalizzare per PEC ogni variante, riserva o contestazione nei termini contrattuali. Non eseguire mai varianti senza ordine scritto. Legale specializzato in contratti d'appalto per redazione contratti. Clausole ADR per evitare contenziosi lunghi.`
  if (desc.includes('violazione d.lgs 81') || (desc.includes('sicurezza') && desc.includes('cantier')))
    return `Audit sicurezza completo di tutti i cantieri attivi entro 30 giorni. Verificare validita di tutti i documenti (DVR, POS, PSC, PIMUS). Controllare scadenze formazione obbligatoria. Nominare preposti alla sicurezza per ogni cantiere con nomina scritta. Canale segnalazione anonima dei rischi.`
  if (desc.includes('normative urbanistiche') || desc.includes('permessi a costruire'))
    return `Verificare conformita urbanistica con professionista incaricato prima di ogni intervento. Conservare copia di tutte le autorizzazioni nel fascicolo di cantiere. Aggiornare permessi per varianti significative prima di procedere. Monitorare iter permessi con alert scadenze.`
  if (desc.includes('durc') || desc.includes('codice dei contratti'))
    return `Verificare DURC in tempo reale prima di ogni pagamento ai subappaltatori (mai DURC cartacei, sempre online INPS/INAIL). Conservare evidenza verifiche. Verificare iscrizione CCIAA del subappaltatore. Per contratti pubblici: qualificazione SOA, subappalto nei limiti legge, tracciabilita pagamenti L. 136/2010.`
  if (desc.includes('lavoro irregolare') || desc.includes('subappalto non autorizzato'))
    return `Lista nominativa obbligatoria di tutti i lavoratori presenti in cantiere con documento identita e contratto. Verificare autorizzazione committente per ogni subappalto e notifica Cassa Edile. Verifica documentale mensile su tutti i subappaltatori. Formare responsabile cantiere sulla responsabilita solidale.`
  if (desc.includes('sal non pagati') || (desc.includes('liquidit') && desc.includes('committente')))
    return `Clausole di pagamento SAL con scadenze certe e interessi di mora ex D.Lgs. 231/2002. Sollecito entro 30 giorni dallo scaduto. Valutare factoring dei crediti PA. Piano finanziario con copertura minima 3 mesi senza incassi. Clausola sospensione lavori per SAL non pagati oltre 60 giorni.`
  if (desc.includes('costo dei materiali') || desc.includes('acciaio') || desc.includes('cemento'))
    return `Clausola revisione prezzi su indici DEI o ISTAT delle costruzioni in tutti i contratti pluriennali. Acquisti anticipati dei materiali principali all'aggiudicazione. Diversificare fornitori per materie prime critiche. Monitorare mensilmente prezzi acciaio, cemento, energia. Valutare hedging per materiali con mercato finanziario.`
  if (desc.includes('incentivi fiscali') || desc.includes('superbonus') || desc.includes('ecobonus'))
    return `Monitorare evoluzione normativa incentivi (Superbonus, Ecobonus, Sismabonus) tramite circolari Agenzia Entrate e Enea. Non avviare lavori senza asseverazione tecnica preliminare. Clausole di adeguamento e restituzione acconti nei contratti con clienti finali in caso di decadenza incentivo. Diversificare portafoglio tra lavori incentivati e non.`
  if (desc.includes('subappaltatore') && (desc.includes('fallimento') || desc.includes('inadempienza')))
    return `Verificare solidita finanziaria del subappaltatore: visura CCIAA, bilancio ultimi 2 anni, DURC, referenze. Non anticipare oltre il 20% dell'importo contrattuale. Clausola risoluzione per inadempimento con preavviso 10 giorni. Subappaltatore alternativo qualificato per lavorazioni critiche. SAL parziali mensili per limitare esposizione.`
  if (desc.includes('fornitura di materiali') || desc.includes('ritardi nella fornitura'))
    return `Diversificare fornitori per categorie critiche (almeno 2 qualificati). Anticipare ordini di 4-6 settimane per materiali a lungo lead time. Penali per ritardi e diritto approvvigionamento alternativo a spese del fornitore inadempiente. Monitorare settimanalmente ordini in corso. Scorte di sicurezza per materiali piu utilizzati.`
  if (desc.includes('comportamento scorretto') && desc.includes('subappaltatore'))
    return `Supplier Code of Conduct con requisiti etici, sicurezza e ambientali. Audit periodici sui subappaltatori strategici (almeno annuali). Risoluzione immediata per comportamenti illeciti. Richiedere adesione al codice etico con firma. Valutazione condotta del subappaltatore alla chiusura di ogni commessa.`
  if (desc.includes('sequestro del cantiere'))
    return `Checklist mensile documenti obbligatori di cantiere (autorizzazioni, DVR, POS, DURC, notifica preliminare). Responsabile conformita cantiere con potere di blocco lavori. Piano risposta al sequestro: legale reperibile H24, comunicazione committente, piano ripresa lavori. Simulazione annuale ispezione ispettorato.`
  if (desc.includes('danni a strutture') || desc.includes('danni a terzi'))
    return `Rilievo fotografico e video documentato di immobili e infrastrutture adiacenti prima del cantiere. Polizza RCT/RCO adeguata per importo e tipologia lavori. Sistemi monitoraggio vibrazioni e cedimenti per cantieri vicini a strutture sensibili. Soglie di allerta e procedure intervento. Informare preventivamente proprietari adiacenti.`

  // Rischi 231
  if (desc.includes('corruzione') && (desc.includes('permessi') || desc.includes('concessioni') || desc.includes('funzionari')))
    return `Procedura Gestione Rapporti PA: registro obbligatorio ogni contatto con funzionari pubblici (data, oggetto, persone), doppia firma per pratiche edilizie, divieto assoluto omaggi o utilita. Clausola anticorruzione standard in tutti i contratti con professionisti verso enti pubblici. Formazione annuale specifica sul reato di corruzione.`
  if (desc.includes('turbata') || (desc.includes('gare') && desc.includes('appalto')))
    return `Procedura interna per gare pubbliche: separare team preparazione offerta dalla direzione, vietare contatti informali con RUP o commissioni al di fuori dei canali ufficiali, documentare tutte le fonti di informazione usate. Revisione legale dell'offerta. Conservare documentazione di gara per 10 anni.`
  if (desc.includes('truffa') || (desc.includes('fondi') && desc.includes('pubblici')))
    return `Checklist verifica requisiti tecnici e soggettivi prima di ogni domanda di incentivo. Responsabile interno per rapporti con enti erogatori con delega scritta. Conservare documentazione tecnica e comunicazioni ufficiali. Audit interno trimestrale sulle pratiche in corso. Clausole di restituzione nei contratti con clienti finali.`
  if (desc.includes('omicidio colposo') || desc.includes('antinfortun'))
    return `Certificare sistema sicurezza ISO 45001. Nominare RSPP con esperienza in edilizia e CSE qualificato per ogni cantiere. Stop-work authority: chiunque puo bloccare i lavori per pericolo imminente senza conseguenze. Sopralluoghi mensili documentati con verbale. KPI sicurezza nella valutazione annuale dei responsabili.`
  if (desc.includes('dvr') || desc.includes('valutazione dei rischi') && desc.includes('231'))
    return `Aggiornare DVR entro 30 giorni dall'apertura di ogni cantiere. POS specifico per ogni subappaltatore. Audit interno mensile: checklist DPI, ponteggi, scavi, impianti. Verbali firmati di tutte le verifiche. Preposto alla sicurezza per ogni fronte di lavoro.`
  if (desc.includes('cse') || desc.includes('coordinatore per la sicurezza'))
    return `Nominare CSE con contratto scritto prima dell'avvio di qualsiasi cantiere con piu imprese. Verificare iscrizione all'albo e crediti formativi aggiornati. Riunioni coordinamento documentate ogni 2 settimane. CSE con potere di sospensione lavori. PSC aggiornato e fascicolo del fabbricato firmato a ogni variante.`
  if (desc.includes('rifiuti speciali') || (desc.includes('cantiere') && desc.includes('rifiuti')))
    return `Piano gestione rifiuti per ogni cantiere: classificazione CER, formulari FIR per ogni trasporto, registro carico/scarico aggiornato. Qualificare trasportatori (Albo Gestori Ambientali). Se presente amianto: responsabile amianto certificato e Piano di Lavoro ex D.Lgs. 81/08 art. 256. Audit documentale trimestrale.`
  if (desc.includes('terre e rocce') || desc.includes('dpr 120'))
    return `Piano di Utilizzo (PdU) ai sensi DPR 120/2017 con caratterizzazione chimica del terreno (1 campione ogni 5.000 mc). Tracciare ogni movimento con DDT e documentazione analitica. Se terre non rispettano CSC, gestirle come rifiuto. Conservare documentazione per almeno 5 anni. Geologo responsabile del Piano di Utilizzo.`
  if (desc.includes('traffico illecito') || desc.includes('miscelazione'))
    return `Vietare miscelazione di rifiuti di diversa classificazione CER. Verificare iscrizione Albo Gestori Ambientali per categoria e classe specifica. Audit a sorpresa sulle aree di stoccaggio ogni 2 mesi. Clausole responsabilita per subappaltatori nella gestione rifiuti. Formare responsabile cantiere sul reato di traffico illecito (art. 259 D.Lgs. 152/06).`
  if (desc.includes('inquinamento ambientale') || (desc.includes('cantiere') && desc.includes('acque')))
    return `Prima di cantieri vicino a corsi d'acqua o aree protette: valutazione impatto ambientale preliminare. Barriere contenimento acque di lavaggio cemento e oli. Piano gestione acque meteoriche. Responsabile ambientale di cantiere con delega scritta. In caso di contaminazione: comunicazione entro 24 ore ex art. 304 D.Lgs. 152/06.`
  if (desc.includes('bonifica') || desc.includes('siti contaminati'))
    return `Prima di interventi su aree potenzialmente contaminate: Fase I (indagine storica) e Fase II (campionamento e analisi chimica). Se superamento CSC: attivare procedura ex art. 242 D.Lgs. 152/06 con comunicazione Comune e ARPA. Non avviare lavori fino ad approvazione piano bonifica. Conservare documentazione analisi per almeno 10 anni.`
  if (desc.includes('riciclaggio') && desc.includes('subappalti'))
    return `Procedure AML per operazioni immobiliari: verifica provenienza fondi per acquisti/vendite sopra 10.000 euro. Applicare tracciabilita pagamenti L. 136/2010 per contratti pubblici. Monitorare flussi finanziari anomali (triangolazioni, pagamenti a terzi non giustificati). Formare responsabile amministrativo su obblighi antiriciclaggio.`
  if (desc.includes('autoriciclaggio'))
    return `Sistema monitoraggio flussi finanziari anomali: alert per movimenti oltre soglie definite, verifica trimestrale coerenza ricavi-lavori eseguiti. Separare conti correnti per azienda e commessa. Revisione contabile annuale da revisore esterno indipendente. OdV con componente esperto in diritto penale economico.`
  if (desc.includes('denaro di provenienza illecita') || desc.includes('pagamenti in contanti'))
    return `Vietare pagamenti in contanti sopra 1.000 euro. Procedura autorizzazione pagamenti: chi autorizza diverso da chi esegue diverso da chi registra. Riconciliazioni bancarie mensili. Formare personale amministrativo sul divieto di contanti e segnalazioni antiriciclaggio. Conservare evidenza documentale di ogni pagamento per almeno 10 anni.`
  if (desc.includes('fatture per operazioni inesistenti') || desc.includes('catena dei subappalti'))
    return `Registro Fornitori Qualificati: nessun subappalto senza verifica preventiva (visura CCIAA, DURC, confronto fatturato vs importi). Doppia firma Direttore Tecnico e CFO per fatture subappalto oltre 10.000 euro. Audit mensile corrispondenza SAL-fatture. Segnalare immediatamente all'OdV qualsiasi anomalia documentale.`
  if (desc.includes('dichiarazione fraudolenta') || (desc.includes('fatture false') && desc.includes('carico fiscale')))
    return `Separazione funzioni contabili: chi registra fatture diverso da chi approva pagamenti diverso da chi prepara dichiarazioni. Revisione interna scritture contabili prima delle dichiarazioni. Audit fiscale annuale da commercialista esterno. Formare responsabile amministrativo sui reati tributari ex D.Lgs. 231/01.`
  if (desc.includes('occultamento') || desc.includes('documenti contabili'))
    return `Archiviazione digitale certificata (conservazione sostitutiva) per documentazione contabile: giornale cantiere, SAL, DDT, bolle, registri rifiuti. Retention obbligatoria: 10 anni per documenti fiscali, 5 anni per documenti ambientali. Vietare distruzione documenti senza autorizzazione OdV. Audit annuale integrita archivi.`
  if (desc.includes('falso in bilancio') || desc.includes('comunicazioni sociali'))
    return `Procedure formali per valutazione immobili e avanzamento lavori: perizie da professionisti iscritti all'albo, SAL approvati da DL e committente. Revisione legale obbligatoria anche sotto soglie di legge. Flussi informativi completi verso Collegio Sindacale prima approvazione bilancio. Formare amministratori su reati societari e responsabilita personali.`
  if (desc.includes('impedimento al controllo') || desc.includes('collegio sindacale'))
    return `Regolamento flussi informativi verso Collegio Sindacale e Revisore: trasmissione mensile dati contabili gestionali, accesso illimitato a documentazione entro 48 ore su richiesta, comunicazione immediata di eventi rilevanti. Vietare comportamenti ostruzionistici. Sanzioni disciplinari fino a licenziamento per chi impedisca le verifiche.`
  if (desc.includes('caporalato') || desc.includes('sfruttamento del lavoro'))
    return `Qualificazione obbligatoria subappaltatori manodopera: DURC in tempo reale, CCNL applicato, estratto conto INPS ultimi 6 mesi, buste paga 3 lavoratori campione, libro unico del lavoro. Sopralluoghi a sorpresa mensili con verifica orari e condizioni lavoro. Clausola risolutiva immediata per irregolarita. Aderire a Protocollo di legalita di settore.`
  if (desc.includes('criminalita organizzata') || desc.includes('imprese collegate'))
    return `Documentazione antimafia (art. 83-84 D.Lgs. 159/2011) per tutte le imprese della filiera. Verificare congruita economica dei prezzi offerti (anomalie oltre 30% = segnale di allarme). Consultare banche dati pubbliche (BDNA, Prefettura). Clausola risolutiva immediata per interdittiva antimafia. Formare responsabile acquisti sui segnali di infiltrazione mafiosa.`
  if (desc.includes('stranieri') && desc.includes('soggiorno'))
    return `Verificare prima dell'assunzione permesso di soggiorno valido e idoneita al lavoro per tutti i lavoratori extracomunitari. Estendere verifica a lavoratori di tutti i subappaltatori presenti in cantiere. Conservare copia verifiche con data e firma. Verifiche periodiche durante il rapporto (scadenza permesso). Formare responsabile HR sul reato di impiego di clandestini.`
  if (desc.includes('sistemi informatici') && desc.includes('gare'))
    return `Policy sicurezza per sistemi di gara e BIM: MFA obbligatorio, log accessi a portali e-procurement, divieto condivisione credenziali. Formare responsabili gare sui reati informatici (art. 615-ter c.p.). Penetration test annuale. Procedure incident response per accessi anomali. Vietare accesso a sistemi di committenti o concorrenti al di fuori di canali ufficiali.`
  if (desc.includes('dati informatici di progetto') || desc.includes('documentazione di gara'))
    return `Controllo integrita documenti tecnici: firma digitale qualificata su documenti di gara, hash crittografico file BIM prima della trasmissione, log immutabile di ogni modifica. Vietare strumenti non aziendali per documentazione di gara. Backup giornalieri con verifica integrita. Sanzioni disciplinari per manipolazione documenti tecnici.`
  if (desc.includes('modello organizzativo 231') || desc.includes('organismo di vigilanza'))
    return `Progetto strutturato MOG 231: (1) delibera CdA con nomina responsabile, (2) gap analysis e mappatura processi sensibili - 2 mesi, (3) stesura Parte Generale e Parti Speciali del Modello - 2 mesi, (4) nomina OdV con componente esterno indipendente e budget autonomo deliberato dal CdA, (5) adozione formale con delibera motivata, (6) formazione differenziata. Tempistica totale: 7-9 mesi. Aggiornamento ogni 2 anni.`
  if (desc.includes('formazione del personale') && desc.includes('231'))
    return `Piano formazione 231 differenziato: (A) apicali e dirigenti - corso 4 ore su responsabilita personali e reati presupposto; (B) dipendenti operativi - e-learning 2 ore con test; (C) subappaltatori - informativa scritta Codice Etico con firma per ricevuta. Formazione entro 3 mesi dall'adozione del Modello e ogni 2 anni. Attestati conservati. Formazione come requisito di qualificazione subappaltatori.`
  if (desc.includes('whistleblowing') || desc.includes('d.lgs. 24/2023'))
    return `Sistema whistleblowing conforme D.Lgs. 24/2023: canale digitale cifrato gestito da soggetto terzo indipendente, possibilita segnalazione anonima, risposta al segnalante entro 3 mesi, divieto assoluto ritorsioni (sanzioni fino a 50.000 euro). Nominare Gestore delle Segnalazioni. Comunicare canale a dipendenti, collaboratori e subappaltatori. Conservare segnalazioni per 5 anni.`

  // Fallback per categorie standard
  const catSugg = SUGGERIMENTI_AZIONI[categoria]
  if (!catSugg) return ''
  const descLower = (descrizione || '').toLowerCase()
  for (const [keyword, azione] of Object.entries(catSugg)) {
    if (keyword !== 'default' && descLower.includes(keyword.toLowerCase())) {
      return azione
    }
  }
  return catSugg['default'] || ''
}

// Rischi antiriciclaggio tipici del recupero crediti per conto terzi (autovalutazione AML, D.Lgs. 231/2007):
// probabilita' e impatto si valutano nell'autovalutazione, non sono preimpostati
export const RISCHI_AML = [
  { categoria: 'Antiriciclaggio', descrizione: 'Mandante con struttura proprietaria opaca o titolare effettivo non individuato', fonte: 'Esterna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Mandante, debitore o pagatore persona politicamente esposta (PEP) o presente in liste di sanzioni non rilevato', fonte: 'Esterna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Pagamenti da terzi non legati al debitore (possibile utilizzo del saldo delle posizioni per riciclare fondi)', fonte: 'Esterna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Saldo improvviso di posizioni di importo rilevante con fondi di provenienza non giustificata', fonte: 'Esterna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Debitore che propone o effettua pagamenti in contante, o frazionamenti volti a eludere le soglie', fonte: 'Esterna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Pagamenti eccedenti il dovuto con richiesta di rimborso su conti diversi (triangolazioni)', fonte: 'Esterna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Pagamenti provenienti da conti esteri o da paesi terzi ad alto rischio', fonte: 'Esterna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Adeguata verifica incompleta o fascicoli AML non aggiornati alle scadenze del controllo costante', fonte: 'Interna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Mancata o tardiva segnalazione di operazioni sospette, o violazione della riservatezza del segnalante', fonte: 'Interna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Personale non formato sugli obblighi antiriciclaggio e sugli indicatori di anomalia', fonte: 'Interna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Documenti e dati non conservati per 10 anni o non esibibili in sede di ispezione', fonte: 'Interna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Funzioni antiriciclaggio non nominate formalmente o con risorse e poteri inadeguati', fonte: 'Interna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Mancata comunicazione al MEF delle infrazioni alle limitazioni sull\'uso del contante', fonte: 'Interna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Identificazione a distanza del debitore inadeguata prima della negoziazione di piani di rientro o saldi', fonte: 'Interna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Mancata intercettazione di debitori PEP o in liste di sanzioni sotto le soglie di controllo per assenza di screening automatico («false clean»)', fonte: 'Interna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Invio delle posizioni alla funzione AML lasciato alla discrezione dell\'operatore telefonico, senza trigger oggettivi', fonte: 'Interna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Verifiche manuali caso per caso senza traccia scritta di motivo, fonti consultate ed esito', fonte: 'Interna', probabilita: null, impatto: null, note: '' },
  { categoria: 'Antiriciclaggio', descrizione: 'Committente commerciale fittizio o interposto (frodi carosello, crediti di origine non documentata)', fonte: 'Esterna', probabilita: null, impatto: null, note: '' },
]
