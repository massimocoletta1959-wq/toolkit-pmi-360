// Registro dei lettori di libro giornale, uno per software house della contabilita'. Ogni lettore riconosce il
// proprio formato e restituisce gli stessi dati (saldi per conto, movimenti mensili, descrizioni, diagnostica;
// movimenti per l'Analisi dei flussi), cosi' Riclassificazione, Bilancio riclassificato, Budget, Scostamento e
// Analisi dei flussi funzionano allo stesso modo qualunque sia il programma di provenienza.
// Per aggiungere un programma: un file in questa cartella con riconosci / leggiSaldi / leggiMovimenti, e una voce qui.
import { parseLibroGiornale, estraiMovimenti } from '../libroGiornale'
import { eGiornaleSeasoft, parseGiornaleSeasoft, estraiMovimentiSeasoft } from './seasoft'

export const LETTORI = [
  {
    id: 'teamsystem',
    nome: 'TeamSystem (brogliaccio movimenti per conto)',
    riconosci: (righe) => righe.some((ln) => ln.includes('N.Pr.') && ln.includes('Cod. Conto') && ln.includes('Dare') && ln.includes('Avere')),
    leggiSaldi: parseLibroGiornale,
    leggiMovimenti: estraiMovimenti,
  },
  {
    id: 'seasoft',
    nome: "Seasoft (Giornale di contabilità per registrazione)",
    riconosci: eGiornaleSeasoft,
    leggiSaldi: parseGiornaleSeasoft,
    leggiMovimenti: estraiMovimentiSeasoft,
  },
]

export function riconosciLettore(righe) {
  const l = LETTORI.find((x) => x.riconosci(righe))
  if (!l) throw new Error(`Formato del libro giornale non riconosciuto. Formati supportati: ${LETTORI.map((x) => x.nome).join('; ')}.`)
  return l
}

export function leggiGiornale(righe) {
  const l = riconosciLettore(righe)
  const r = l.leggiSaldi(righe)
  return { ...r, diagnostica: { ...r.diagnostica, formato: l.id } }
}

export const leggiMovimentiGiornale = (righe) => riconosciLettore(righe).leggiMovimenti(righe)
