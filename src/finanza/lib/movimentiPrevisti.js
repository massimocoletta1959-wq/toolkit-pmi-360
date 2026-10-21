// Movimenti di cassa previsti inseriti a mano nell'Analisi dei flussi (tabella movimenti_previsti): rateizzazioni,
// acconti di imposta, finanziamenti attesi, ecc., una volta o ricorrenti. Qui si espandono in scadenze e diventano
// righe della proiezione di Tesoreria. Libreria pura.
//
// Regola concordata con l'utente (opzione A): un versamento di imposte sul reddito inserito a mano sostituisce, nello
// STESSO mese, i versamenti calcolati dalla Tesoreria (saldo e acconti dal budget); gli altri mesi restano calcolati.
// Tutte le altre voci si sommano.

export const VOCI_PREVISTE = {
  imposte_reddito: { label: 'Imposte sul reddito (saldo/acconti IRES-IRAP)', gruppo: 'imposte', sostituisce: true },
  imposte_altre: { label: 'Altre imposte e tasse F24 (rateizzazioni, IVA arretrata, IMU, ritenute)', gruppo: 'imposte' },
  contributi: { label: 'Contributi INPS/INAIL (anche rateizzati)', gruppo: 'contributi' },
  finanziamenti: { label: 'Finanziamenti (erogazioni ricevute o rate)', gruppo: 'finanziamenti' },
  personale: { label: 'Personale (TFR, premi, arretrati)', gruppo: 'personale' },
  soci: { label: 'Soci e amministratori (versamenti, rimborsi, compensi)', gruppo: 'soci' },
  clienti: { label: 'Clienti (incassi straordinari)', gruppo: 'clienti' },
  fornitori: { label: 'Fornitori (pagamenti straordinari)', gruppo: 'fornitori' },
  investimenti: { label: 'Investimenti / disinvestimenti', gruppo: 'investimenti' },
  altro: { label: 'Altro', gruppo: 'altro' },
}

export const FREQUENZE = {
  una_volta: { label: 'Una volta', mesi: 0 },
  mensile: { label: 'Mensile', mesi: 1 },
  bimestrale: { label: 'Bimestrale', mesi: 2 },
  trimestrale: { label: 'Trimestrale', mesi: 3 },
  semestrale: { label: 'Semestrale', mesi: 6 },
  annuale: { label: 'Annuale', mesi: 12 },
}

const MAX_SCADENZE = 240   // ricorrenze senza numero di rate: si espandono comunque solo dentro l'orizzonte richiesto
const ultimoGiorno = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate()

// data ISO della k-esima scadenza (stesso giorno del mese, o l'ultimo se il mese e' piu' corto)
export function dataScadenza(primaData, frequenza, k) {
  const [a, m, g] = primaData.slice(0, 10).split('-').map(Number)
  const passo = FREQUENZE[frequenza]?.mesi || 0
  const t = (m - 1) + passo * k
  const anno = a + Math.floor(t / 12)
  const mese = (t % 12) + 1
  const giorno = Math.min(g, ultimoGiorno(anno, mese))
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
}

// Scadenze di un movimento previsto tra due date ISO incluse: [{ data, anno, mese, rata, totaleRate }]
export function scadenzeMovimento(mov, daData, aData) {
  const una = (mov.frequenza || 'una_volta') === 'una_volta'
  const n = una ? 1 : mov.numero_rate || MAX_SCADENZE
  const out = []
  for (let k = 0; k < n; k++) {
    const data = una ? mov.prima_data.slice(0, 10) : dataScadenza(mov.prima_data, mov.frequenza, k)
    if (aData && data > aData) break
    if (!daData || data >= daData) out.push({ data, anno: Number(data.slice(0, 4)), mese: Number(data.slice(5, 7)), rata: k + 1, totaleRate: una ? 1 : mov.numero_rate || null })
  }
  return out
}

// Totale ancora da pagare/incassare (rate dalla data indicata in poi), null se la ricorrenza non ha fine
export function residuoMovimento(mov, daData) {
  if ((mov.frequenza || 'una_volta') !== 'una_volta' && !mov.numero_rate) return null
  return Math.round(scadenzeMovimento(mov, daData, null).length * Number(mov.importo) * 100) / 100
}

const PROB = { certo: 100, probabile: 75 }

// Righe della proiezione di Tesoreria (stesso formato di caricaRigheDaBudget) per i movimenti previsti dal mese
// [anno, mese] per orizzonteMesi mesi.
export function righeMovimentiPrevisti(movimenti, [anno, mese], orizzonteMesi) {
  const da = `${anno}-${String(mese).padStart(2, '0')}-01`
  const fineT = (mese - 1) + orizzonteMesi - 1
  const aAnno = anno + Math.floor(fineT / 12)
  const aMese = (fineT % 12) + 1
  const a = `${aAnno}-${String(aMese).padStart(2, '0')}-${ultimoGiorno(aAnno, aMese)}`
  const righe = []
  for (const mov of movimenti || []) {
    const voce = VOCI_PREVISTE[mov.voce] || VOCI_PREVISTE.altro
    for (const s of scadenzeMovimento(mov, da, a)) {
      const d = new Date(`${s.data}T00:00:00Z`)
      righe.push({
        direzione: mov.direzione, categoria: `previsto_${voce.gruppo}`, voce_prevista: mov.voce, movimento_previsto_id: mov.id,
        controparte: mov.descrizione, importo: Number(mov.importo), dataFattura: d, dataScadenza: d, dataIncassoEffettivo: null,
        giorniDilazione: 0, giorniRitardo: 0, tipoDato: mov.certezza === 'probabile' ? 'variabile' : 'certo', probabilita: PROB[mov.certezza] || 100,
        note: `Previsto a mano (Analisi dei flussi)${s.totaleRate > 1 ? `: rata ${s.rata}/${s.totaleRate}` : s.totaleRate === null ? `: ricorrenza ${FREQUENZE[mov.frequenza]?.label.toLowerCase()}` : ''}${mov.note ? ` — ${mov.note}` : ''}`,
        meseBudget: s.anno * 100 + s.mese,
      })
    }
  }
  return righe
}

// Opzione A: toglie dalle righe calcolate i versamenti di imposte sul reddito (categoria 'imposte') dei mesi in cui
// c'e' un versamento di imposte sul reddito inserito a mano. Ritorna { righe, sostituite }.
export function sostituisciImposteCalcolate(righeCalcolate, righePreviste) {
  const mesi = new Set(righePreviste.filter((r) => r.voce_prevista === 'imposte_reddito' && r.direzione === 'uscita').map((r) => r.meseBudget))
  const sostituite = righeCalcolate.filter((r) => r.categoria === 'imposte' && mesi.has(r.meseBudget))
  return { righe: righeCalcolate.filter((r) => !(r.categoria === 'imposte' && mesi.has(r.meseBudget))), sostituite }
}
