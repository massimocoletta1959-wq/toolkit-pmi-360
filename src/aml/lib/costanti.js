// Costanti del modulo Antiriciclaggio (etichette e cataloghi)

export const TIPI_CLIENTE = { mandante: 'Mandante', debitore: 'Debitore' }
export const STATI_CLIENTE = { attivo: 'Attivo', bloccato: 'Bloccato (trigger AML)', chiuso: 'Chiuso' }

export const RUOLI_SOGGETTO = {
  titolare_effettivo: 'Titolare effettivo',
  legale_rappresentante: 'Legale rappresentante',
  esecutore: 'Esecutore / delegato',
  terzo_pagatore: 'Terzo pagatore',
}
export const ESITI_LISTE = { negativo: 'Negativo', omonimia: 'Omonimia da chiarire', positivo: 'Positivo' }

export const TIPI_VALUTAZIONE = {
  iniziale: 'Profilatura iniziale',
  riesame_periodico: 'Riesame periodico',
  evento: 'Riesame per evento',
  trigger: 'Riesame dopo trigger',
}

// Trigger oggettivi della procedura AML-05
export const TIPI_TRIGGER = {
  soglia_15000: 'Saldo o piano di rientro ≥ 15.000 € (anche cumulato)',
  terzo_pagatore: 'Pagamento proposto o eseguito da un terzo',
  frazionamento: 'Frazionamento sospetto sotto soglia',
  estero: 'Pagamento da conto estero o paese a rischio',
  fretta: 'Fretta ingiustificata di saldare importi rilevanti',
  rimborso: 'Eccedenza con richiesta di rimborso',
  contante: 'Proposta di pagamento in contante',
  altro: 'Altra anomalia',
}
export const STATI_TRIGGER = { aperto: 'Aperto — posizione bloccata', archiviato: 'Archiviato con esito motivato', segnalato_dsos: 'Segnalato al Delegato SOS' }

export const STATI_SOS = { ricevuta: 'Ricevuta', in_istruttoria: 'In istruttoria', archiviata: 'Archiviata con motivazione', inviata_uif: 'Inviata alla UIF' }

// Documenti del fascicolo del cliente
export const CATEGORIE_DOC_CLIENTE = {
  documento_identita: 'Documento d\'identità',
  codice_fiscale: 'Codice fiscale / tessera sanitaria',
  visura: 'Visura camerale',
  schema_controllo: 'Schema della catena di controllo',
  dichiarazione_te_pep: 'Dichiarazione titolare effettivo / PEP',
  questionario: 'Questionario AML del mandante',
  procura: 'Procura / delega',
  contratto_mandato: 'Contratto di mandato',
  documentazione_crediti: 'Documentazione dei crediti affidati',
  verifica_liste: 'Esito verifica liste / PEP / notizie',
  giustificativo_fondi: 'Giustificativo provenienza fondi',
  altro: 'Altro',
}
// Documenti aziendali (fascicolo AML dell'azienda)
export const CATEGORIE_DOC_AZIENDA = {
  licenza_tulps: 'Licenza ex art. 115 TULPS',
  delibera_nomina: 'Delibera di nomina RAML / DSOS e accettazioni',
  organigramma_aml: 'Organigramma AML',
  manuale: 'Manuale AML / procedure',
  autovalutazione: 'Autovalutazione del rischio',
  modulistica: 'Modulistica in bianco (versione adottata)',
  relazione_annuale: 'Relazione annuale AML',
  formazione: 'Formazione (programmi, presenze, attestati)',
  controlli_interni: 'Verifiche dei controlli interni',
  comunicazione_mef: 'Comunicazioni al MEF',
  altro: 'Altro',
}
// documenti che scadono: il portale li segnala nel controllo costante
export const CATEGORIE_CON_SCADENZA = ['documento_identita', 'visura', 'procura', 'licenza_tulps']

// Checklist della verifica GdF (webinar UNIREC): voce → dove si trova l'evidenza nel portale
export const CHECKLIST_GDF = [
  { n: 1, voce: 'Licenze e autorizzazioni', dove: 'Documenti aziendali: licenza ex art. 115 TULPS; scheda del registro giornale degli affari' },
  { n: 2, voce: 'Organigramma aziendale e AML', dove: 'Organigramma: ruoli RAML, DSOS, ADV, RCI con le persone assegnate' },
  { n: 3, voce: 'Responsabile AML', dove: 'Organigramma (RAML) + delibera di nomina con accettazione' },
  { n: 4, voce: 'Funzione SOS', dove: 'Organigramma (DSOS) + delibera di nomina' },
  { n: 5, voce: 'Deleghe e incarichi', dove: 'Governance: delibere di tipo Antiriciclaggio; Documenti aziendali' },
  { n: 6, voce: 'Autovalutazione del rischio', dove: 'Registro rischi, categoria Antiriciclaggio (probabilità e impatto valutati) + documento approvato' },
  { n: 7, voce: 'Manuale AML', dove: 'Procedure AML-01…AML-13 adottate e prese visione' },
  { n: 8, voce: 'Procedure operative', dove: 'Procedure AML-04…AML-13' },
  { n: 9, voce: 'Metodologia di classificazione del rischio cliente', dove: 'Procedura AML-03 + scheda di profilatura con fattori e motivazione' },
  { n: 10, voce: 'Fascicoli AML completi', dove: 'Clienti: fascicolo di ogni mandante e debitore' },
  { n: 11, voce: 'Evidenze del controllo costante', dove: 'Riesami nei fascicoli; revisioni scadute e documenti scaduti nel cruscotto' },
  { n: 12, voce: 'Procedura SOS', dove: 'Procedura AML-09 + registro SOS (riservato al DSOS)' },
  { n: 13, voce: 'Registro della formazione', dove: 'Documenti aziendali: formazione (in attesa del modulo Formazione)' },
  { n: 14, voce: 'Evidenze dei controlli interni', dove: 'Documenti aziendali: verifiche dei controlli interni; trigger chiusi con esito motivato' },
]

export const fmtData = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('it-IT') : '—')
export const fmtDataOra = (d) => (d ? new Date(d).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—')
export const fmtEuro = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }))
export const oggiISO = () => new Date().toISOString().slice(0, 10)

// impronta SHA-256 di un file (evidenza di integrità, AML-08)
export async function sha256File(file) {
  const buf = await file.arrayBuffer()
  const h = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// nome leggibile dell'utente per le evidenze (autore, validato da)
export const nomeUtente = (profilo, session) =>
  [profilo?.nome, profilo?.cognome].filter(Boolean).join(' ') || profilo?.email || session?.user?.email || 'utente'

// percorso nello storage: <azienda>/<cliente|azienda|sos>/<timestamp>_<nome>
export const percorsoFile = (aziendaId, cartella, nome) =>
  `${aziendaId}/${cartella}/${Date.now()}_${nome.normalize('NFD').replace(/[^\w.-]+/g, '_')}`
