// ============================================================
// Guida al fascicolo documentale per ciascun tipo di determina/delibera.
// Fonte: schede "a prova di audit" (business judgment rule).
// Usata dal wizard per mostrare cosa riguarda, come funziona, gli elementi
// chiave e i giustificativi da conservare. La lista "giustificativi" servirà
// anche per la checklist + allegati (Livello 2).
// ============================================================

export const FASCICOLI = {
  beni_strumentali: {
    riguarda: "Macchinari, impianti, attrezzature industriali, hardware e software di rilievo aziendale.",
    funzionamento: "L'amministratore approva l'investimento sulla base di un piano industriale o di un'esigenza produttiva motivata dai responsabili di reparto. L'atto autorizza l'uscita finanziaria, individua il fornitore (spesso a seguito di preventivi comparativi) e impegna la spesa sul budget di esercizio.",
    elementi: "Congruità del prezzo, stima del ritorno sull'investimento (ROI) e modalità di ammortamento.",
    giustificativi: [
      "Richiesta tecnica interna motivata dal responsabile di produzione/IT.",
      "Almeno 2-3 preventivi comparativi (o motivazione dettagliata in caso di fornitore unico/infungibile).",
      "Scheda tecnica e stima del ROI (Ritorno sull'Investimento).",
      "Preventivo economico definitivo e contratto di fornitura/ordine firmato.",
    ],
  },
  contratto: {
    riguarda: "Contratti quadro con fornitori strategici, accordi commerciali con clienti di rilievo, partnership industriali o di filiera.",
    funzionamento: "L'atto recepisce le condizioni negoziali concordate, approva formalmente il testo contrattuale definitivo e autorizza la sottoscrizione.",
    elementi: "Verifica delle clausole di tutela (recesso, penali, proprietà intellettuale, foro competente) e controllo sulla copertura finanziaria degli impegni assunti.",
    giustificativi: [
      "Testo integrale del contratto e di tutti gli allegati tecnici/commerciali sottoscritti.",
      "Verbale di negoziazione o minuta di accordo preliminare (Letter of Intent / Term Sheet).",
      "Parere di conformità legale (se richiesto) su clausole vessatorie, recesso o foro competente.",
    ],
  },
  operazione_finanziaria: {
    riguarda: "Accensione di mutui, linee di credito, contratti di leasing finanziario/operativo, rilascio di fideiussioni o garanzie a terzi.",
    funzionamento: "L'amministratore, verificati i poteri statutari (alcune garanzie straordinarie potrebbero richiedere l'autorizzazione dell'assemblea), delibera l'accesso al credito o l'operazione finanziaria per garantire la liquidità o sostenere investimenti.",
    elementi: "Sostenibilità del debito, tassi di interesse, piani di ammortamento e impatto sulla posizione finanziaria netta.",
    giustificativi: [
      "Delibera/contratto di finanziamento o leasing con il piano di ammortamento.",
      "Analisi di sostenibilità del debito e impatto sulla posizione finanziaria.",
      "Verifica dei poteri statutari (ed eventuale autorizzazione assembleare per garanzie straordinarie).",
    ],
  },
  adempimenti_contabili: {
    riguarda: "Adozione del progetto di bilancio d'esercizio, proposte di destinazione dell'utile o copertura delle perdite, variazioni significative di budget in corso d'anno.",
    funzionamento: "L'organo amministrativo cristallizza i dati economico-finanziari elaborati con la direzione amministrativa, predisponendo la documentazione obbligatoria per legge da sottoporre successivamente all'assemblea dei soci.",
    elementi: "Rispetto dei termini civilistici/fiscali di approvazione e coerenza con i principi contabili di riferimento (OIC o IAS/IFRS).",
    giustificativi: [
      "Progetto di bilancio (Stato Patrimoniale, Conto Economico, Nota Integrativa).",
      "Relazione sulla gestione dell'organo amministrativo.",
      "Relazione del Collegio Sindacale e del Revisore Legale (ove presenti).",
      "Estratto del budget con evidenza della variazione di spesa.",
    ],
  },
  personale: {
    riguarda: "Riorganizzazioni interne, mobilità, definizione di mansionari, approvazione di regolamenti interni o provvedimenti disciplinari gravi (es. licenziamenti per giustificato motivo).",
    funzionamento: "L'amministratore formalizza le scelte di macro-struttura aziendale e gestisce i rapporti di lavoro complessi che esulano dalla normale gestione delegata ai responsabili HR.",
    elementi: "Rispetto dello Statuto dei Lavoratori (L. 300/1970), dei CCNL applicati e delle procedure di consultazione sindacale ove previste.",
    giustificativi: [
      "Organigramma/funzionigramma precedente e aggiornato (per le riorganizzazioni).",
      "Verbale di esame congiunto o accordo sindacale (ove previsto).",
      "Lettera di contestazione, memorie difensive del dipendente e provvedimento finale (per i disciplinari).",
    ],
  },
  assunzione: {
    riguarda: "Inserimento di dirigenti (top management), quadri apicali o figure altamente specializzate e strategiche per il business.",
    funzionamento: "L'atto approva la proposta economica e contrattuale (RAL, bonus, stock options, patti di non concorrenza) per l'ingresso di figure che incidono significativamente sui costi fissi e sulle strategie aziendali.",
    elementi: "Budget HR approvato, coerenza del profilo con gli obiettivi di crescita e formalizzazione dei patti di riservatezza.",
    giustificativi: [
      "CV del candidato e risultanze del processo di selezione (headhunting/colloqui).",
      "Lettera di offerta economica firmata per accettazione (contratto di lavoro).",
      "Patti accessori (non concorrenza, stabilità, riservatezza/NDA).",
    ],
  },
  consulenza: {
    riguarda: "Conferimento di mandati a professionisti esterni (studi legali, commercialisti, revisori, consulenti tecnici, advisor finanziari o strategici).",
    funzionamento: "L'amministratore individua il professionista in base all'intuitus personae o a procedure selettive, definendo oggetto dell'incarico, durata e compenso pattuito.",
    elementi: "Prevenzione di conflitti d'interesse, motivazione della necessità dell'apporto esterno e rispetto dei parametri professionali.",
    giustificativi: [
      "Curriculum vitae del professionista incaricato.",
      "Lettera di incarico sottoscritta con esplicitazione del compenso stimato.",
      "Dichiarazione sostitutiva di assenza di conflitto d'interessi (stringente nelle società pubbliche/partecipate).",
    ],
  },
  contenzioso: {
    riguarda: "Promozione di azioni giudiziarie, costituzione in giudizio in caso di cause contro la società, sottoscrizione di transazioni bonarie.",
    funzionamento: "L'atto conferisce la procura alle liti agli avvocati esterni e approva eventuali accordi transattivi per chiudere liti pendenti.",
    elementi: "Analisi costi/benefici del contenzioso (rischio soccombenza) e accantonamento dei fondi rischi adeguati in bilancio.",
    giustificativi: [
      "Parere legale pro-veritate sulle probabilità di successo/soccombenza (per la stima del fondo rischi).",
      "Atto di citazione ricevuto o ricorso da depositare.",
      "Testo dell'accordo transattivo firmato dalle parti.",
    ],
  },
  rs_innovazione: {
    riguarda: "Avvio di progetti di R&D, digital transformation, sviluppo di nuovi prodotti/servizi, deposito di brevetti o registrazione di marchi.",
    funzionamento: "L'amministratore stanzia i fondi dedicati all'innovazione, autorizza la collaborazione con università o centri di ricerca e delibera la protezione della proprietà intellettuale.",
    elementi: "Accesso a eventuali agevolazioni fiscali (es. Credito d'imposta R&D) e strategie di tutela del vantaggio competitivo.",
    giustificativi: [
      "Business plan o project charter tecnico del progetto di ricerca.",
      "Contratti di partenariato con università o centri di ricerca.",
      "Attestato di deposito del brevetto/registrazione del marchio (UIBM o enti equivalenti) e documentazione per i crediti d'imposta.",
    ],
  },
  marketing: {
    riguarda: "Campagne pubblicitarie di grande portata, sponsorizzazioni, partecipazione a fiere di settore, contratti con agenzie di comunicazione.",
    funzionamento: "L'atto autorizza il budget di spesa promozionale e approva i piani di comunicazione strategica proposti dal reparto marketing o dalle agenzie partner.",
    elementi: "Misurabilità del ritorno sull'investimento (KPI di visibilità/lead generation) e conformità alle normative sulle sponsorizzazioni.",
    giustificativi: [
      "Piano media/comunicazione con canali e ritorni attesi.",
      "Contratto di sponsorizzazione o convenzione con ente fiera/agenzia.",
      "Report finale di riscontro (rassegna stampa, dati di traffico/visibilità, attestato di prestazione).",
    ],
  },
  immobiliare: {
    riguarda: "Stipula o disdetta di contratti di locazione (attiva o passiva), acquisto/dismissione di immobili, manutenzione straordinaria sugli edifici aziendali.",
    funzionamento: "L'amministratore valuta l'impatto patrimoniale e immobiliare dell'operazione, autorizzando i lavori edili o la gestione del patrimonio immobiliare.",
    elementi: "Autorizzazioni urbanistiche ed edilizie, conformità catastale e congruità dei canoni di mercato.",
    giustificativi: [
      "Perizia estimativa di congruità del canone o del valore di mercato.",
      "Preventivi dei lavori edili e computo metrico estimativo del direttore dei lavori.",
      "Autorizzazioni edilizie/urbanistiche (CILA, SCIA, permessi) e contratti di locazione registrati.",
    ],
  },
  compliance: {
    riguarda: "Nomine obbligatorie (RSPP, Medico Competente, DPO), adozione/aggiornamento del Modello 231, adempimenti privacy GDPR.",
    funzionamento: "L'amministratore adempie agli obblighi di legge non delegabili (o formalizza le deleghe di funzioni in materia di sicurezza) stanziando le risorse per la compliance aziendale.",
    elementi: "Mitigazione del rischio penale d'impresa, rispetto del Testo Unico Sicurezza (D.Lgs. 81/08) e istituzione dell'Organismo di Vigilanza.",
    giustificativi: [
      "Lettera di incarico/accettazione firmata dal soggetto nominato (RSPP, DPO, Medico Competente).",
      "Delibera di adozione/aggiornamento del Modello 231 o delle procedure privacy.",
      "Evidenza dell'erogazione dei fondi o della formazione obbligatoria correlata.",
    ],
  },
  procura: {
    riguarda: "Conferimento di procure speciali o generali a dipendenti, procuratori, agenti o rappresentanti per compiere atti in nome e per conto della società.",
    funzionamento: "L'amministratore delimita puntualmente i poteri di firma e di rappresentanza conferiti, specificando limiti di spesa e ambito operativo.",
    elementi: "Registrazione della procura presso il Registro delle Imprese (se necessario per l'opponibilità ai terzi) e tracciabilità dei poteri conferiti.",
    giustificativi: [
      "Testo dell'atto di procura (preferibilmente atto pubblico o scrittura privata autenticata).",
      "Ricevuta di deposito e iscrizione della procura al Registro delle Imprese.",
      "Lettera con i limiti operativi e le istruzioni di budget al procuratore.",
    ],
  },
  antiriciclaggio: {
    riguarda: "Presidio antiriciclaggio (D.Lgs. 231/2007): nomina del Responsabile Antiriciclaggio e del Delegato alle segnalazioni di operazioni sospette (SOS), approvazione della politica e del Manuale AML, dell'autovalutazione del rischio e della relazione annuale.",
    funzionamento: "L'organo amministrativo individua formalmente le funzioni antiriciclaggio, ne definisce requisiti, poteri, autonomia, risorse e linee di riporto, approva il Manuale AML e ne verifica periodicamente l'adeguatezza sulla base dell'autovalutazione e della relazione annuale del Responsabile.",
    elementi: "Requisiti di professionalità, onorabilità e indipendenza dei nominati; assenza di conflitti con le funzioni operative; poteri di accesso alle informazioni; sostituti in caso di assenza; riservatezza del Delegato SOS (art. 38 D.Lgs. 231/2007).",
    giustificativi: [
      "Curriculum del Responsabile AML / Delegato SOS e dichiarazione sui requisiti e sull'assenza di conflitti di interesse.",
      "Lettera di incarico con poteri, risorse, linee di riporto e accettazione firmata del nominato.",
      "Organigramma AML aggiornato (portale — Organigramma) e sostituti designati.",
      "Manuale AML / procedure approvate con evidenza della diffusione e delle prese visione degli incaricati.",
      "Autovalutazione del rischio di riciclaggio (Registro rischi — gruppo Antiriciclaggio) o relazione annuale del Responsabile AML, se l'atto le approva.",
    ],
  },
  urgenza: {
    riguarda: "Decisioni indifferibili e urgenti per evitare danni gravi e imminenti alla società, alla continuità aziendale, alla sicurezza delle persone o agli impianti.",
    funzionamento: "L'amministratore adotta un atto immediato motivato da forza maggiore o urgenza eccezionale, derogando temporaneamente alle normali procedure, con riserva di ratifica o informativa successiva agli organi di controllo.",
    elementi: "Tracciabilità rigorosa delle motivazioni di urgenza e proporzionalità dell'intervento per neutralizzare il pericolo.",
    giustificativi: [
      "Relazione tecnica o verbale di constatazione dell'evento eccezionale (es. verbale VVF, perizia di guasto).",
      "Prova documentale dell'impossibilità di convocare tempestivamente gli organi di controllo.",
      "Verbale della successiva riunione di presa d'atto e ratifica dell'operato d'urgenza.",
    ],
  },
}
