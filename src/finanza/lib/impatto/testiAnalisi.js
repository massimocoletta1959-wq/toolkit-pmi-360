// Testi delle analisi di impatto (economico e finanziario) da riportare nell'atto: nei campi "Analisi economica"
// e "Analisi finanziaria" e nel testo della delibera/determina. Si generano dalla simulazione, cosi' i numeri
// dell'atto sono gli stessi dei prospetti allegati. Modulo puro.
import { it } from './util.js'

// Prima riga di ogni testo generato: permette di sostituire il blocco a una nuova simulazione senza toccare
// l'eventuale testo scritto a mano sopra di esso.
export const MARCATORE = "[Simulazione d'impatto del "

const euro = (n) => `${it(n)} €`
const conSegno = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${it(Math.abs(n))} €`
const meseIt = (s) => {
  if (!s) return ''
  const [a, m] = String(s).split('-').map(Number)
  return `${['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'][m - 1]} ${a}`
}

export function testoAnalisiEconomica(br, dataSimulazione) {
  const t = br.totali
  const righe = [
    `${MARCATORE}${dataSimulazione}]`,
    `Effetti della decisione sul budget ${br.anno} approvato, da ${br.periodo.da_leggibile || '—'} a ${br.periodo.a_leggibile} (chiusura dell'esercizio); quanto matura dopo la chiusura non è considerato.`,
    '',
    'Variazioni per voce di bilancio:',
    ...br.voci.map((v) => {
      const parti = []
      if (v.delta_certi) parti.push(`${conSegno(v.delta_certi)} certi`)
      if (v.delta_ricavi) parti.push(`${conSegno(v.delta_ricavi)} stimati`)
      return `- ${v.voce.trim()}: ${parti.join(', ')} da ${meseIt(v.da_mese)} (budget ${euro(v.originale)} → ${euro(v.rettificato)})`
    }),
    '',
    `Risultato dell'esercizio ${br.anno} (ante imposte):`,
    `- EBITDA: budget ${euro(t.budget.ebitda)}; con i soli costi certi ${euro(t.solo_costi_certi.ebitda)} (${conSegno(t.solo_costi_certi.ebitda - t.budget.ebitda)})${br.ha_ricavi_attesi ? `; con i ricavi attesi ${euro(t.con_ricavi_attesi.ebitda)} (${conSegno(t.con_ricavi_attesi.ebitda - t.budget.ebitda)})` : ''}.`,
    `- EBIT: budget ${euro(t.budget.ebit)}; con i soli costi certi ${euro(t.solo_costi_certi.ebit)}${br.ha_ricavi_attesi ? `; con i ricavi attesi ${euro(t.con_ricavi_attesi.ebit)}` : ''}.`,
    `- Risultato ante imposte: budget ${euro(t.budget.risultato_ante_imposte)}; con i soli costi certi ${euro(t.solo_costi_certi.risultato_ante_imposte)} (${conSegno(t.solo_costi_certi.risultato_ante_imposte - t.budget.risultato_ante_imposte)})${br.ha_ricavi_attesi ? `; con i ricavi attesi ${euro(t.con_ricavi_attesi.risultato_ante_imposte)} (${conSegno(t.con_ricavi_attesi.risultato_ante_imposte - t.budget.risultato_ante_imposte)})` : ''}.`,
    '',
    `Criteri: ${br.criteri.slice(1).join(' ')}`,
  ]
  return righe.join('\n')
}

export function testoAnalisiFinanziaria(risultato, dataSimulazione) {
  const w = risultato.scenari.worst.mesi
  const b = risultato.scenari.base.mesi
  const minimo = (mesi, campo) => mesi.reduce((m, x) => (x[campo] < m[campo] ? x : m), mesi[0])
  const minBase = minimo(w, 'cassa_baseline')
  const minWorst = minimo(w, 'cassa_scenario')
  const minAtteso = minimo(b, 'cassa_scenario')
  const stress = risultato.stress_test?.con_decisione || []
  const scoperti = stress.filter((s) => s.coperto === false)
  const fin = risultato.ipotesi_usate.finestra
  const righe = [
    `${MARCATORE}${dataSimulazione}]`,
    `Effetti sulla cassa nei 12 mesi della proiezione di Tesoreria (${meseIt(fin.da)} - ${meseIt(fin.a)}), IVA e tempi di incasso/pagamento compresi.`,
    `- Variazione della cassa a fine periodo: ${conSegno(risultato.confronto_baseline.delta_cassa_finale_worst)} con i soli effetti certi.`,
    `- Saldo minimo: senza la decisione ${euro(minBase.cassa_baseline)} (${meseIt(minBase.mese)}); con la decisione ${euro(minWorst.cassa_scenario)} (${meseIt(minWorst.mese)}) con i soli effetti certi, ${euro(minAtteso.cassa_scenario)} (${meseIt(minAtteso.mese)}) nello scenario base.`,
    risultato.alert.length
      ? `- Segnalazioni: ${risultato.alert.length} (es. ${risultato.alert[0]}).`
      : '- Nessuna tensione di cassa aggiuntiva rispetto alla proiezione senza la decisione.',
    stress.length
      ? `- Stress test con la decisione: ${scoperti.length ? `${scoperti.length} scenari su ${stress.length} con fabbisogno non coperto dalle linee di credito (${scoperti.map((s) => s.scenario_nome).join(', ')})` : `fabbisogni coperti o assenti in tutti i ${stress.length} scenari`}.`
      : '',
  ].filter(Boolean)
  return righe.join('\n')
}

// Sostituisce (o aggiunge in coda) il blocco generato, lasciando intatto il testo scritto a mano sopra di esso
export function aggiornaBloccoAnalisi(testoAttuale, nuovoBlocco) {
  const t = testoAttuale || ''
  const i = t.indexOf(MARCATORE)
  const manuale = (i >= 0 ? t.slice(0, i) : t).trim()
  return manuale ? `${manuale}\n\n${nuovoBlocco}` : nuovoBlocco
}
