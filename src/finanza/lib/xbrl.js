// Porting client-side di backend/services/ai/estrattore.py::elabora_xbrl_diretto —
// lettura strutturata (senza AI) dei tag XBRL standard italiani (bilancio CEE).
// Se i tag standard non sono presenti, il vecchio backend ricadeva sull'AI: qui
// segnaliamo semplicemente che serve l'elaborazione AI (non ancora disponibile).

const round2 = (n) => Math.round(n * 100) / 100

const MAPPA_CE = {
  ValoreProduzioneRicaviVenditePrestazioni: ['ricavi', 'Ricavi delle vendite e delle prestazioni'],
  ValoreProduzioneAltriRicaviProventiTotaleAltriRicaviProventi: ['ricavi', 'Altri ricavi e proventi'],
  TotaleValoreProduzione: ['totali', 'Totale valore produzione'],
  CostiProduzioneMateriePrimeSussidiarieConsumoMerci: ['costi', 'Materie prime, sussidiarie e merci'],
  CostiProduzioneServizi: ['costi', 'Servizi'],
  CostiProduzioneGodimentoBeniTerzi: ['costi', 'Godimento beni di terzi'],
  CostiProduzionePersonaleTotaleCostiPersonale: ['costi', 'Personale'],
  CostiProduzionePersonaleSalariStipendi: ['costi', 'Salari e stipendi'],
  CostiProduzionePersonaleOneriSociali: ['costi', 'Oneri sociali'],
  CostiProduzionePersonaleTrattamentoFineRapporto: ['costi', 'Trattamento fine rapporto'],
  CostiProduzioneAmmortamentiSvalutazioniTotaleAmmortamentiSvalutazioni: ['costi', 'Ammortamenti e svalutazioni'],
  CostiProduzioneOneriDiversiGestione: ['costi', 'Oneri diversi di gestione'],
  TotaleCostiProduzione: ['totali', 'Totale costi produzione'],
  DifferenzaValoreCostiProduzione: ['totali', 'EBIT (A-B)'],
  TotaleProventiOneriFinanziari: ['totali', 'Proventi e oneri finanziari'],
  RisultatoPrimaImposte: ['totali', 'Risultato prima delle imposte'],
  ImposteRedditoEsercizioCorrentiDifferiteAnticipateTotaleImposteRedditoEsercizioCorrentiDifferiteAnticipate: ['totali', 'Imposte sul reddito'],
  UtilePerditaEsercizio: ['totali', "Utile/Perdita dell'esercizio"],
}

function localName(el) {
  return el.localName || el.tagName.split(':').pop()
}

// Equivalente di elem.text in Python (ElementTree): solo il testo diretto,
// non concatenato con quello dei figli.
function directText(el) {
  let text = ''
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue
  }
  return text.trim()
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export function elaboraXbrlDiretto(testoXml, anno) {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(testoXml, 'application/xml')
  if (xmlDoc.querySelector('parsererror')) {
    throw new Error('File XBRL non leggibile: XML non valido.')
  }

  const elementi = Array.from(xmlDoc.getElementsByTagName('*'))

  // Pass 1: valori numerici, prima occorrenza per tag
  const valori = {}
  const conteggi = {}
  for (const elem of elementi) {
    const tag = localName(elem)
    const testo = directText(elem)
    if (testo && !['identifier', 'startDate', 'endDate', 'instant'].includes(tag)) {
      const val = parseFloat(testo.replace(',', '.'))
      if (!Number.isNaN(val)) {
        if (!(tag in conteggi)) {
          conteggi[tag] = 0
          valori[tag] = val
        }
        conteggi[tag]++
      }
    }
  }

  // Pass 2: valori testuali (dati anagrafici) — se non sembra un numero,
  // l'ultima occorrenza vince; altrimenti solo la prima (setdefault).
  const hasDigitInFirst3 = (s) => /[0-9]/.test(s.slice(0, 3))
  const testi = {}
  for (const elem of elementi) {
    const tag = localName(elem)
    const val = directText(elem)
    if (val && !hasDigitInFirst3(val)) testi[tag] = val
    else if (val && !(tag in testi)) testi[tag] = val
  }
  const t = (tag) => testi[tag]?.trim() || null

  const ricaviVoci = []
  const costiVoci = []
  for (const [tag, [tipo, desc]] of Object.entries(MAPPA_CE)) {
    if (tag in valori && tipo === 'ricavi') ricaviVoci.push({ codice: tag.slice(0, 8), descrizione: desc, importo: valori[tag] })
    else if (tag in valori && tipo === 'costi') costiVoci.push({ codice: tag.slice(0, 8), descrizione: desc, importo: valori[tag] })
  }

  const totRicavi = valori.TotaleValoreProduzione || 0
  const totCosti = valori.TotaleCostiProduzione || 0
  const ebit = valori.DifferenzaValoreCostiProduzione ?? totRicavi - totCosti
  const oneriFin = valori.TotaleProventiOneriFinanziari || 0
  const risultato = valori.UtilePerditaEsercizio || 0
  const imposte = valori.ImposteRedditoEsercizioCorrentiDifferiteAnticipateTotaleImposteRedditoEsercizioCorrentiDifferiteAnticipate || 0
  const ammortamenti = valori.CostiProduzioneAmmortamentiSvalutazioniTotaleAmmortamentiSvalutazioni || 0
  const ebitda = round2(ebit + ammortamenti)

  const totAttivo = valori.TotaleAttivo || 0
  const totImmob = valori.TotaleImmobilizzazioni || 0
  const attivoCirc = valori.TotaleAttivoCircolante || 0
  const liquidita = valori.TotaleDisponibilitaLiquide || 0
  const crediti = valori.TotaleCreditiAttivoCircolante ?? valori.TotaleCrediti ?? 0
  const pn = valori.TotalePatrimonioNetto || 0
  const tfr = valori.TotaleFondiRischiOneri ?? valori.TrFr ?? valori.FondoTFR ?? 0
  const totDebiti = valori.TotaleDebiti || 0
  const debitiBreve = valori.TotaleDebitiEsigibiliEntroEsercizioSuccessivo ?? totDebiti

  const fg = t('DatiAnagraficiFormaGiuridica') || ''
  const fgNorm = fg
    .replace("Societa' A Responsabilita' Limitata", 'S.r.l.')
    .replace("SOCIETA' A RESPONSABILITA' LIMITATA", 'S.r.l.')
    .replace('Societa Per Azioni', 'S.p.A.')
    .replace('SOCIETA PER AZIONI', 'S.p.A.')

  const capVal = valori.DatiAnagraficiCapitaleSociale ?? valori.PatrimonioNettoCapitale
  let capStr = capVal ? `€ ${Math.trunc(capVal).toLocaleString('it-IT')}` : null
  const capVersato = t('DatiAnagraficiCapitaleSocialeInteramenteVersato')
  if (capStr && capVersato && capVersato.toLowerCase() === 'true') capStr += ' (interamente versato)'

  const reaRaw = t('DatiAnagraficiNumeroRea') || ''
  const sedeRaw = t('DatiAnagraficiSede') || ''
  const sedeNorm = sedeRaw ? titleCase(sedeRaw) : null

  const atecoRaw = t('DatiAnagraficiSettoreAttivitaPrevalenteAteco') || ''
  let atecoNorm = null
  if (atecoRaw) {
    const m = atecoRaw.match(/\((\d+\.\d+)/)
    const codice = m ? m[1] : ''
    const desc = atecoRaw.replace(/\s*\([\d.]+\)/, '').trim()
    atecoNorm = codice ? `${codice} — ${desc}` : desc
  }

  const anagraficaCandidati = {
    sede_legale: sedeNorm,
    numero_rea: reaRaw || null,
    codice_ateco: atecoNorm,
    forma_giuridica: fgNorm || null,
    capogruppo: t('DatiAnagraficiDenominazioneSocietaEnteEsercitaAttivitaDirezioneCoordinamento'),
    capitale_sociale: capStr,
  }
  const anagrafica = {}
  for (const [k, v] of Object.entries(anagraficaCandidati)) if (v) anagrafica[k] = v

  return {
    tipo_documento: 'bilancio',
    anno,
    ricavi: { totale: totRicavi, voci: ricaviVoci },
    costi: { totale: totCosti, voci: costiVoci },
    ammortamenti,
    oneri_finanziari: oneriFin,
    margine_operativo: ebit,
    ebitda,
    imposte,
    risultato_esercizio: risultato,
    patrimonio_netto: pn,
    totale_attivo: totAttivo,
    totale_immobilizzazioni: totImmob,
    attivo_circolante: attivoCirc,
    crediti_clienti: crediti,
    disponibilita_liquide: liquidita,
    tfr,
    totale_debiti: totDebiti,
    debiti_breve: debitiBreve,
    anagrafica,
    note: 'Dati estratti direttamente da file XBRL (lettura strutturata)',
  }
}

export function haDatiSignificativi(risultato) {
  return risultato.ricavi.voci.length > 0 || risultato.costi.voci.length > 0 || risultato.ricavi.totale !== 0 || risultato.costi.totale !== 0
}
