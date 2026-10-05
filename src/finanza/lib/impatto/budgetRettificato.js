// Analisi di impatto ECONOMICO sul budget dell'esercizio: applica la decisione al budget approvato dell'anno in
// cui decorre, voce per voce e mese per mese, dalla decorrenza al mese di chiusura (dicembre). Gli effetti che
// cadono oltre la chiusura dell'esercizio sono ignorati. Costi (e risparmi) sono effetti certi; i ricavi
// dell'ipotesi sono una stima e si tengono in una colonna separata, cosi' il risultato si legge sia "solo costi
// certi" (prudente) sia "con i ricavi attesi" (100% dell'ipotesi).
// Le quote si imputano per competenza mensile: personale per ratei (RAL/12, contributi, TFR), ammortamento pro
// rata dal mese di entrata in funzione, canoni e servizi nel mese di competenza. Modulo puro (Deno + Jest).
import { round2, ymDaData, etichettaMese } from './util.js'
import { GENERATORI } from './generatori.js'
import { classificaVoceBudget, MESI_KEYS } from '../budgetMensile.js'

// Voci CEE di destinazione: come riconoscerle nel budget e come chiamarle se il budget non le ha.
// Per il personale e gli ammortamenti si ripiega sulla voce aggregata, se il budget non ha le sottovoci.
export const VOCI_CE = {
  A1: { nome: 'Ricavi delle vendite e delle prestazioni', categoria: 'ricavi', re: [/ricavi delle vendite/] },
  B6: { nome: 'Materie prime, sussidiarie, di consumo e merci', categoria: 'costi', re: [/materie prime/] },
  B7: { nome: 'Servizi', categoria: 'costi', re: [/^(per )?servizi$/] },
  B8: { nome: 'Godimento di beni di terzi', categoria: 'costi', re: [/godimento/] },
  B9a: { nome: 'a) Salari e stipendi', categoria: 'costi', re: [/salari/, /^(costi )?(per il )?personale$/] },
  B9b: { nome: 'b) Oneri sociali', categoria: 'costi', re: [/oneri sociali/, /^(costi )?(per il )?personale$/] },
  B9c: { nome: 'c) Trattamento di fine rapporto', categoria: 'costi', re: [/fine rapporto/, /^(costi )?(per il )?personale$/] },
  B9e: { nome: 'e) Altri costi del personale', categoria: 'costi', re: [/altri costi del personale/, /^(costi )?(per il )?personale$/] },
  B10b: { nome: 'b) Ammortamento delle immobilizzazioni materiali', categoria: 'costi', re: [/amm.*materiali/, /ammortament/] },
  B14: { nome: 'Oneri diversi di gestione', categoria: 'costi', re: [/oneri diversi/] },
  C17: { nome: 'Interessi e altri oneri finanziari', categoria: 'costi', re: [/interessi e altri oneri/, /oneri finanziari/] },
}

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const nomeMese = (ym) => ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'][(ym % 100) - 1]
export const meseLeggibile = (ym) => `${nomeMese(ym)} ${Math.floor(ym / 100)}`

// Anno dell'esercizio da rettificare: quello della prima decorrenza della decisione
export function annoEsercizio(decisione) {
  const comp = decisione.tipo_impatto === 'composta' ? decisione.componenti : [decisione]
  return Math.min(...comp.map((c) => Math.floor(ymDaData(c.data_decorrenza) / 100)))
}

// vociBudget: righe di budget_voci ({ descrizione, categoria, gen..dic }) del budget approvato dell'anno
export function calcolaBudgetRettificato({ decisione, vociBudget, anno, azienda = {} }) {
  const finestra = Array.from({ length: 12 }, (_, i) => anno * 100 + i + 1)
  const idx = new Map(finestra.map((ym, j) => [ym, j]))
  const ctxBase = {
    finestra, idx, nMesi: 12, kMax: 12 + 3,
    aliqA: (azienda.aliquota_iva_acquisti ?? 22) / 100, aliqV: (azienda.aliquota_iva_vendite ?? 22) / 100,
    dsoGiorni: azienda.gg_medi_incasso ?? 30, dpoGiorni: azienda.gg_medi_pagamento ?? 30,
  }

  // righe del budget, con la loro classificazione (stessa regola della Tesoreria)
  const righe = (vociBudget || []).map((v) => {
    const mesi = MESI_KEYS.map((k) => Number(v[k]) || 0)
    return { descrizione: (v.descrizione || '').trim(), categoria: v.categoria, tipo: classificaVoceBudget(v.descrizione, v.categoria).tipo, mesi, certi: new Array(12).fill(0), ricavi: new Array(12).fill(0), nuova: false }
  })
  const rigaPer = (codice) => {
    const def = VOCI_CE[codice]
    for (const re of def.re) {
      const r = righe.find((x) => x.categoria === def.categoria && re.test(norm(x.descrizione)))
      if (r) return r
    }
    const nuova = { descrizione: def.nome, categoria: def.categoria, tipo: classificaVoceBudget(def.nome, def.categoria).tipo, mesi: new Array(12).fill(0), certi: new Array(12).fill(0), ricavi: new Array(12).fill(0), nuova: true }
    righe.push(nuova)
    return nuova
  }

  const componenti = decisione.tipo_impatto === 'composta' ? decisione.componenti : [decisione]
  let esclusiOltre = 0
  let primoYm = null
  const applica = (r, campo, ym, importo) => {
    const j = idx.get(ym)
    if (j === undefined) { if (ym > finestra[11]) esclusiOltre++; return }
    r[campo][j] += importo
    if (primoYm === null || ym < primoYm) primoYm = ym
  }

  // ricavi operativi mensili del budget: base per un'ipotesi di ricavi in percentuale
  const ricaviOperativiMese = finestra.map((_, j) => righe.filter((r) => r.categoria === 'ricavi' && r.tipo === 'ricavo_operativo').reduce((s, r) => s + r.mesi[j], 0))

  for (const comp of componenti) {
    const ymDecorrenza = ymDaData(comp.data_decorrenza)
    const gen = GENERATORI[comp.tipo_impatto](comp, { ...ctxBase, ymDecorrenza })
    for (const mov of gen.ceRatei || gen.ce) {
      if (!mov.importo) continue
      applica(rigaPer(mov.voce || (mov.categoria === 'ricavo_operativo' ? 'A1' : 'B14')), 'certi', mov.ym, mov.importo)
    }
    // effetti incerti dei livelli di scenario (es. success fee): con le stime, non tra i certi
    for (const l of gen.livelliScenario || []) {
      for (const mov of l.ce) if (mov.importo) applica(rigaPer(mov.voce || 'B7'), 'ricavi', mov.ym, mov.importo)
    }
    const ip = comp.ipotesi_ricavi
    if (ip) {
      const ymPartenza = Math.max(ymDaData(ip.mese_partenza), ymDecorrenza)
      const a1 = rigaPer('A1')
      for (let j = 0; j < 12; j++) {
        if (finestra[j] < ymPartenza) continue
        const importo = ip.modalita === 'incremento_pct' ? (ip.valore / 100) * ricaviOperativiMese[j] : ip.valore
        if (importo) applica(a1, 'ricavi', finestra[j], importo)
      }
    }
  }

  // ---- totali: originale, solo costi certi, con ricavi attesi ----
  const somma = (arr) => arr.reduce((s, v) => s + v, 0)
  const totali = (campi) => {
    const t = { valore_produzione: 0, costi_operativi: 0, ammortamenti: 0, oneri_finanziari: 0, imposte: 0 }
    for (const r of righe) {
      const v = somma(r.mesi) + (campi.includes('certi') ? somma(r.certi) : 0) + (campi.includes('ricavi') ? somma(r.ricavi) : 0)
      if (r.categoria === 'ricavi') {
        if (r.tipo === 'provento_finanziario') t.oneri_finanziari -= v
        else t.valore_produzione += v
      } else if (r.tipo === 'imposta') t.imposte += v
      else if (r.tipo === 'ammortamento') t.ammortamenti += v
      else if (r.tipo === 'onere_finanziario') t.oneri_finanziari += v
      else t.costi_operativi += v
    }
    const ebitda = t.valore_produzione - t.costi_operativi
    const ebit = ebitda - t.ammortamenti
    const ris = ebit - t.oneri_finanziari
    return {
      valore_produzione: round2(t.valore_produzione), costi_operativi: round2(t.costi_operativi), ebitda: round2(ebitda),
      ammortamenti: round2(t.ammortamenti), ebit: round2(ebit), oneri_finanziari: round2(t.oneri_finanziari),
      risultato_ante_imposte: round2(ris),
    }
  }

  const variate = righe
    .filter((r) => Math.abs(somma(r.certi)) >= 0.005 || Math.abs(somma(r.ricavi)) >= 0.005)
    .map((r) => {
      const originale = round2(somma(r.mesi))
      const deltaCerti = round2(somma(r.certi))
      const deltaRicavi = round2(somma(r.ricavi))
      const daJ = Math.min(...[...r.certi, ...r.ricavi].map((v, i) => (Math.abs(v) >= 0.005 ? i % 12 : 99)))
      return { voce: r.descrizione, categoria: r.categoria, nuova: r.nuova, originale, delta_certi: deltaCerti, delta_ricavi: deltaRicavi, rettificato: round2(originale + deltaCerti + deltaRicavi), da_mese: daJ < 12 ? etichettaMese(finestra[daJ]) : null, mensile_certi: r.certi.map(round2), mensile_ricavi: r.ricavi.map(round2) }
    })

  return {
    anno,
    periodo: { da: primoYm ? etichettaMese(primoYm) : null, a: etichettaMese(finestra[11]), da_leggibile: primoYm ? meseLeggibile(primoYm) : null, a_leggibile: meseLeggibile(finestra[11]) },
    movimenti_oltre_chiusura_ignorati: esclusiOltre,
    voci: variate,
    totali: { budget: totali([]), solo_costi_certi: totali(['certi']), con_ricavi_attesi: totali(['certi', 'ricavi']) },
    ha_ricavi_attesi: variate.some((v) => v.delta_ricavi !== 0),
    criteri: [
      `Budget ${anno} approvato; effetti dal mese di decorrenza a dicembre ${anno}: quanto matura dopo la chiusura dell'esercizio non è considerato.`,
      'Costi e risparmi della decisione: effetti certi. Ricavi dell\'ipotesi (ed eventuali costi condizionati, come una success fee): stima, in colonna separata.',
      'Personale per ratei mensili: retribuzione annua/12 (compresi i ratei di 13ª/14ª), contributi sull\'aliquota dichiarata, TFR = retribuzione annua/13,5.',
      'Ammortamento pro rata a mesi dal mese di entrata in funzione del bene.',
      'Risultato ante imposte: le imposte sul reddito non sono ricalcolate.',
    ],
  }
}
