// ============================================================
// Profilatura del rischio cliente (procedura AML-03): fattori, punteggi e classe.
// Ogni fattore ha opzioni con un punteggio; alcune opzioni portano la classe ad "alto" d'ufficio
// (PEP, paesi ad alto rischio, liste di sanzioni, titolare effettivo non individuabile, terzo pagatore non
// giustificato). Pesi e soglie sono una proposta da approvare dal Responsabile AML (taratura annuale, AML-03).
// Libreria pura: la usano la scheda di valutazione e i test.
// ============================================================

export const SOGLIE = { medio: 4, alto: 8 }          // punteggio >= 4 medio, >= 8 alto
export const MESI_REVISIONE = { alto: 12, medio: 24, basso: 36 }   // controllo costante (AML-07)
export const CLASSI = ['basso', 'medio', 'alto']
export const ETICHETTA_CLASSE = { basso: 'Basso', medio: 'Medio', alto: 'Alto' }
export const COLORE_CLASSE = {
  basso: { bg: '#D5F5E3', color: '#155724' },
  medio: { bg: '#FCF3CF', color: '#7D6608' },
  alto: { bg: '#FADBD8', color: '#C0392B' },
}

const AREA = {
  codice: 'area_geografica', fattore: 'Area geografica (residenza, sede, conti di pagamento)',
  opzioni: [
    { valore: 'italia_ue', label: 'Italia o altro paese UE', punti: 0 },
    { valore: 'extra_ue', label: 'Paese extra UE non a rischio elevato', punti: 2 },
    { valore: 'alto_rischio', label: 'Paese terzo ad alto rischio o non cooperativo', punti: 4, alto: true },
  ],
}
const PEP = {
  codice: 'pep', fattore: 'Persona politicamente esposta (cliente, titolare effettivo, familiari)',
  opzioni: [
    { valore: 'no', label: 'Nessun PEP (dichiarazione e verifica)', punti: 0 },
    { valore: 'si', label: 'Presenza di un PEP', punti: 4, alto: true },
  ],
}
const LISTE = {
  codice: 'liste_sanzioni', fattore: 'Liste di sanzioni UE/ONU',
  opzioni: [
    { valore: 'negativo', label: 'Verifica negativa', punti: 0 },
    { valore: 'omonimia', label: 'Omonimia da chiarire', punti: 3 },
    { valore: 'positivo', label: 'Corrispondenza confermata', punti: 6, alto: true },
  ],
}
const NOTIZIE = {
  codice: 'notizie_avverse', fattore: 'Notizie pregiudizievoli (procedimenti, notizie di stampa)',
  opzioni: [
    { valore: 'nessuna', label: 'Nessuna notizia rilevante', punti: 0 },
    { valore: 'presenti', label: 'Notizie pregiudizievoli presenti', punti: 3 },
  ],
}

export const FATTORI = {
  mandante: [
    {
      codice: 'natura_committente', fattore: 'Natura del committente',
      opzioni: [
        { valore: 'vigilato', label: 'Banca o intermediario vigilato (portafogli bancari/NPL)', punti: 0 },
        { valore: 'commerciale_verificato', label: 'Impresa commerciale con operatività e bilanci verificati', punti: 2 },
        { valore: 'commerciale_critico', label: 'Impresa commerciale di recente costituzione, senza bilanci o con struttura opaca', punti: 4 },
      ],
    },
    {
      codice: 'titolare_effettivo', fattore: 'Titolare effettivo e struttura di controllo',
      opzioni: [
        { valore: 'verificato', label: 'Individuato e verificato, catena semplice', punti: 0 },
        { valore: 'complesso', label: 'Individuato attraverso una catena societaria complessa', punti: 2 },
        { valore: 'non_individuabile', label: 'Non individuabile', punti: 4, alto: true },
      ],
    },
    {
      codice: 'origine_crediti', fattore: 'Origine e documentazione dei crediti affidati',
      opzioni: [
        { valore: 'documentata', label: 'Documentata (contratti, fatture, cessione)', punti: 0 },
        { valore: 'parziale', label: 'Parzialmente documentata', punti: 2 },
        { valore: 'non_documentata', label: 'Non documentata o incoerente con l\'attività', punti: 4 },
      ],
    },
    AREA, PEP, LISTE, NOTIZIE,
  ],
  debitore: [
    {
      codice: 'natura_debitore', fattore: 'Natura del debitore',
      opzioni: [
        { valore: 'persona_fisica', label: 'Persona fisica', punti: 0 },
        { valore: 'societa', label: 'Società o ente con struttura semplice', punti: 1 },
        { valore: 'catena', label: 'Catena societaria complessa o fiduciarie', punti: 3 },
      ],
    },
    {
      codice: 'importo', fattore: 'Importo del saldo o del piano di rientro (anche cumulato nell\'anno)',
      opzioni: [
        { valore: 'sotto_soglia', label: 'Inferiore a 15.000 euro', punti: 0 },
        { valore: 'sopra_soglia', label: 'Pari o superiore a 15.000 euro', punti: 2 },
      ],
    },
    {
      codice: 'pagatore', fattore: 'Chi paga',
      opzioni: [
        { valore: 'debitore', label: 'Il debitore, da conto a lui intestato', punti: 0 },
        { valore: 'terzo_giustificato', label: 'Un terzo con legame documentato (familiare, garante, società del gruppo)', punti: 2 },
        { valore: 'terzo_non_giustificato', label: 'Un terzo senza legame giustificato', punti: 4, alto: true },
      ],
    },
    {
      codice: 'modalita_pagamento', fattore: 'Modalità e provenienza dei pagamenti',
      opzioni: [
        { valore: 'tracciabile', label: 'Bonifico, SDD o carta da conto italiano/UE', punti: 0 },
        { valore: 'estero', label: 'Conto estero extra UE', punti: 3 },
        { valore: 'contante_proposto', label: 'Proposta di pagamento in contante', punti: 3 },
      ],
    },
    {
      codice: 'comportamento', fattore: 'Comportamento nella gestione della pratica',
      opzioni: [
        { valore: 'regolare', label: 'Regolare, coerente con il profilo', punti: 0 },
        { valore: 'anomalo', label: 'Fretta ingiustificata di saldare, frazionamenti, rimborsi richiesti su altri conti', punti: 3 },
      ],
    },
    AREA, PEP, LISTE, NOTIZIE,
  ],
}

export const fattoriPer = (tipo) => FATTORI[tipo] || []

// scelte: { codice: valore } → dettaglio dei fattori, punteggio, classe calcolata e motivi d'ufficio
export function calcolaProfilo(tipo, scelte = {}) {
  const fattori = fattoriPer(tipo)
  const dettaglio = fattori.map(f => {
    const o = f.opzioni.find(x => x.valore === scelte[f.codice]) || null
    return { codice: f.codice, fattore: f.fattore, valore: o?.valore ?? null, scelta: o?.label ?? null, punti: o?.punti ?? null, forza_alto: !!o?.alto }
  })
  const mancanti = dettaglio.filter(d => d.valore == null).map(d => d.fattore)
  const punteggio = dettaglio.reduce((s, d) => s + (d.punti || 0), 0)
  const motiviAlto = dettaglio.filter(d => d.forza_alto).map(d => `${d.fattore}: ${d.scelta}`)
  const classe = motiviAlto.length || punteggio >= SOGLIE.alto ? 'alto' : punteggio >= SOGLIE.medio ? 'medio' : 'basso'
  return { dettaglio, punteggio, classe, motiviAlto, mancanti, completo: mancanti.length === 0 }
}

// data ISO + mesi della classe → data ISO della prossima revisione
export function prossimaRevisione(classe, daData) {
  const mesi = MESI_REVISIONE[classe]
  if (!mesi || !daData) return null
  const [a, m, g] = daData.slice(0, 10).split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + mesi, 1))
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(g, ultimo))
  return d.toISOString().slice(0, 10)
}

// testo di partenza per la motivazione: elenca i fattori considerati (anche quelli assenti) e la classe
export function bozzaMotivazione(profilo, classeFinale) {
  const righe = profilo.dettaglio.filter(d => d.valore != null).map(d => `- ${d.fattore}: ${d.scelta} (${d.punti} punti${d.forza_alto ? ', rischio alto d\'ufficio' : ''})`)
  const finale = classeFinale || profilo.classe
  let t = `Fattori considerati:\n${righe.join('\n')}\nPunteggio ${profilo.punteggio}: classe calcolata ${ETICHETTA_CLASSE[profilo.classe].toLowerCase()}.`
  if (profilo.motiviAlto.length) t += ` Classe alta d'ufficio per: ${profilo.motiviAlto.join('; ')}.`
  if (finale !== profilo.classe) t += `\nClasse attribuita ${ETICHETTA_CLASSE[finale].toLowerCase()} diversa da quella calcolata perché: `
  return t
}

// controlli prima del salvataggio: il verbale GdF contesta classi senza motivazione scritta
export function erroriValutazione({ profilo, classe, motivazione, informazioni, variazioni, conseguenze, tipoValutazione }) {
  const e = []
  if (!profilo?.completo) e.push(`Valuta tutti i fattori (mancano: ${profilo?.mancanti?.join(', ')}).`)
  if (!CLASSI.includes(classe)) e.push('Scegli la classe di rischio.')
  const mot = (motivazione || '').trim()
  if (mot.length < 20) e.push('Scrivi la motivazione della classificazione.')
  if (profilo && classe && classe !== profilo.classe) {
    if (/perché:\s*$/.test(mot)) e.push('Spiega perché la classe attribuita è diversa da quella calcolata.')
    if (profilo.motiviAlto.length && classe !== 'alto') e.push('Con un fattore di rischio alto d\'ufficio la classe non può essere abbassata.')
  }
  if (tipoValutazione && tipoValutazione !== 'iniziale') {
    if (!(informazioni || '').trim()) e.push('Indica le informazioni verificate nel riesame.')
    if (!(variazioni || '').trim()) e.push('Indica le variazioni riscontrate (anche «nessuna variazione»).')
    if (!(conseguenze || '').trim()) e.push('Indica le conseguenze sul profilo di rischio.')
  }
  return e
}

// stato del controllo costante di un cliente alla data
export function statoRevisione(cliente, oggi = new Date().toISOString().slice(0, 10)) {
  if (cliente.stato === 'chiuso') return 'chiuso'
  if (!cliente.classe_rischio) return 'da_profilare'
  if (!cliente.prossima_revisione) return 'regolare'
  if (cliente.prossima_revisione < oggi) return 'scaduta'
  const tra30 = new Date(Date.parse(oggi) + 30 * 86400000).toISOString().slice(0, 10)
  return cliente.prossima_revisione <= tra30 ? 'in_scadenza' : 'regolare'
}
