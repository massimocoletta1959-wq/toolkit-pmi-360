// Assestamenti di periodo per un libro giornale infrannuale (es. al 30/06): le scritture che il gestionale fa
// solo a fine anno (rimanenze finali, ammortamenti, TFR, fatture da ricevere/emettere, imposte) qui sono STIME,
// mostrate separate dai dati registrati. Ogni assestamento entra sia nel Conto economico sia nello Stato
// patrimoniale, cosi' i due restano in quadratura. Modulo puro.
//
// Valori proposti:
//  - rimanenze finali = esistenze iniziali (le registrazioni in B11 con saldo in Dare), come il bilancio
//    infrannuale di Seasoft, che lascia la merce in magazzino al valore di apertura;
//  - ammortamenti e TFR = valore annuo dell'esercizio precedente x mesi / 12 (zero se nel periodo sono gia'
//    registrati);
//  - imposte = aliquota (default 27,9% = IRES 24% + IRAP 3,9%, stima semplificata) x risultato ante imposte
//    assestato, se positivo e se nel periodo non ci sono gia' imposte.

const round2 = (n) => Math.round(n * 100) / 100

export const ALIQUOTA_IMPOSTE_DEFAULT = 27.9

const somma = (agg, prefisso) => Object.entries(agg).filter(([k]) => k.startsWith(prefisso)).reduce((s, [, v]) => s + (v.importo || 0), 0)

// aggregato: { codiceCEE: { importo, conti: [{ codice, conto, importo }] } } (da processaDocumento)
// annuali: { ammortamenti, tfr, fonte } dell'esercizio precedente (opzionale)
export function proponiAssestamenti({ aggregato, meseFine, annuali = null }) {
  const esistenzeIniziali = round2((aggregato.B11?.conti || []).filter((c) => c.importo > 0).reduce((s, c) => s + c.importo, 0))
  const ammGiaRegistrati = somma(aggregato, 'B10') > 0
  const tfrGiaRegistrato = (aggregato.B9c?.importo || 0) > 0
  const quota = (annuo) => (annuo ? round2((annuo * meseFine) / 12) : 0)
  return {
    attivi: true,
    rimanenze_finali: esistenzeIniziali,
    ammortamenti: ammGiaRegistrati ? 0 : quota(annuali?.ammortamenti),
    tfr: tfrGiaRegistrato ? 0 : quota(annuali?.tfr),
    fatture_da_ricevere: 0,
    fatture_da_emettere: 0,
    aliquota_imposte: (aggregato.E20?.importo || 0) > 0 ? 0 : ALIQUOTA_IMPOSTE_DEFAULT,
    fonti: {
      rimanenze_finali: esistenzeIniziali ? 'uguali alle rimanenze iniziali (come il bilancio infrannuale del gestionale): correggile con l\'inventario del periodo' : 'nessuna rimanenza iniziale registrata',
      ammortamenti: ammGiaRegistrati ? 'già registrati nel periodo' : annuali?.ammortamenti ? `${meseFine}/12 degli ammortamenti ${annuali.fonte}` : 'nessun dato dell\'esercizio precedente: inseriscili a mano',
      tfr: tfrGiaRegistrato ? 'già registrato nel periodo' : annuali?.tfr ? `${meseFine}/12 del TFR ${annuali.fonte}` : 'nessun dato dell\'esercizio precedente',
      aliquota_imposte: (aggregato.E20?.importo || 0) > 0 ? 'imposte già registrate nel periodo' : 'IRES 24% + IRAP 3,9% sul risultato ante imposte (stima semplificata)',
    },
  }
}

const copia = (agg) => Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, { importo: v.importo, conti: [...(v.conti || [])] }]))
const aggiungi = (agg, codice, importo, etichetta) => {
  if (!importo) return
  if (!agg[codice]) agg[codice] = { importo: 0, conti: [] }
  agg[codice].importo = round2(agg[codice].importo + importo)
  agg[codice].conti.push({ codice: '', conto: `${etichetta} (assestamento stimato)`, importo: round2(importo) })
}

// Applica gli assestamenti al Conto economico. risultatoAnteImposte(aggregato) e' fornito dal chiamante (dipende
// dallo schema delle voci). Restituisce il nuovo aggregato e le imposte stimate.
export function applicaAssestamentiCE(aggregato, a, periodo, risultatoAnteImposte) {
  const agg = copia(aggregato)
  if (!a?.attivi) return { aggregato: agg, imposte: 0 }
  aggiungi(agg, 'B11', -(Number(a.rimanenze_finali) || 0), `Rimanenze finali ${periodo}`)
  aggiungi(agg, 'B10b', Number(a.ammortamenti) || 0, `Ammortamenti ${periodo}`)
  aggiungi(agg, 'B9c', Number(a.tfr) || 0, `Accantonamento TFR ${periodo}`)
  aggiungi(agg, 'B6', Number(a.fatture_da_ricevere) || 0, `Fatture da ricevere ${periodo}`)
  aggiungi(agg, 'A1', Number(a.fatture_da_emettere) || 0, `Fatture da emettere ${periodo}`)
  const base = risultatoAnteImposte(agg)
  const imposte = base > 0 ? round2((base * (Number(a.aliquota_imposte) || 0)) / 100) : 0
  aggiungi(agg, 'E20', imposte, `Imposte stimate ${a.aliquota_imposte}% ${periodo}`)
  return { aggregato: agg, imposte }
}

// Contropartite patrimoniali degli stessi assestamenti. aggregatoSP come da processaGruppiSP (attivo col suo
// segno, passivo in positivo). Gli ammortamenti riducono le immobilizzazioni in proporzione al loro valore netto.
// Restituisce il nuovo aggregato e la variazione del risultato da sommare a quello dei conti aperti.
export function applicaAssestamentiSP(aggregatoSP, a, imposte, periodo) {
  const agg = copia(aggregatoSP)
  if (!a?.attivi) return { aggregato: agg, deltaRisultato: 0 }
  const rf = Number(a.rimanenze_finali) || 0
  const amm = Number(a.ammortamenti) || 0
  const tfr = Number(a.tfr) || 0
  const fdr = Number(a.fatture_da_ricevere) || 0
  const fde = Number(a.fatture_da_emettere) || 0
  aggiungi(agg, 'ATT_C_I_4', rf, `Rimanenze finali ${periodo}`)
  if (amm) {
    const immob = Object.entries(agg).filter(([k, v]) => /^ATT_B_I(I)?_/.test(k) && v.importo > 0)
    const tot = immob.reduce((s, [, v]) => s + v.importo, 0)
    if (tot > 0) {
      let residuo = amm
      immob.forEach(([k, v], i) => {
        const quota = i === immob.length - 1 ? residuo : round2((amm * v.importo) / tot)
        residuo = round2(residuo - quota)
        aggiungi(agg, k, -quota, `Fondo ammortamento ${periodo}`)
      })
    } else aggiungi(agg, 'ATT_B_II_4', -amm, `Fondo ammortamento ${periodo}`)
  }
  aggiungi(agg, 'PAS_C', tfr, `TFR ${periodo}`)
  aggiungi(agg, 'PAS_D_7', fdr, `Fatture da ricevere ${periodo}`)
  aggiungi(agg, 'ATT_C_II_1', fde, `Fatture da emettere ${periodo}`)
  aggiungi(agg, 'PAS_D_12', imposte, `Imposte stimate ${periodo}`)
  return { aggregato: agg, deltaRisultato: round2(rf - amm - tfr - fdr + fde - imposte) }
}
