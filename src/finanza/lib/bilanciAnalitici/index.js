// Registro dei lettori di bilancio analitico (bilancio di verifica con il piano dei conti), uno per software
// house, come per i libri giornale (../giornali). Ogni lettore restituisce le voci con sezione (SP/CE), lato
// (attivita/passivita/costi/ricavi), livello (1 mastro, 2 gruppo, 3 conto), codice, descrizione e importo.
import { eBilancioAnaliticoSeasoft, leggiBilancioAnaliticoSeasoft } from './seasoft'

export const LETTORI_BILANCIO = [
  { id: 'seasoft', nome: 'Seasoft (bilancio a sezioni contrapposte)', riconosci: eBilancioAnaliticoSeasoft, leggi: leggiBilancioAnaliticoSeasoft },
]

export function leggiBilancioAnalitico(righe) {
  const l = LETTORI_BILANCIO.find((x) => x.riconosci(righe))
  if (!l) throw new Error(`Formato del bilancio analitico non riconosciuto. Formati supportati: ${LETTORI_BILANCIO.map((x) => x.nome).join('; ')}.`)
  const r = l.leggi(righe)
  if (!r.voci.length) throw new Error('Nessuna voce trovata nel bilancio analitico.')
  return r
}
