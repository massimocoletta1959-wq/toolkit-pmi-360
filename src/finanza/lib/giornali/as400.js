// Lista Prima Nota stampata da gestionali su IBM AS/400 ("Stampa Lista Prima Nota", es. Asap Logistics):
//
//   Data Reg. Protoc. Num. Mov.    Cau   N. Documento   Data Doc. Val.    Fil. Pr. Utente    Bl. P/E
//   Conto Cont. Codice Descrizione           Imp.Div.Richiesta Imp.Div.Originale      Imponibile     D Al Desc. Aggiuntiva    Dt. Scad.
//   10/01/25           24     616  025               9    3/01/25   EUR    01    ASAPCOLETT    B   E
//   440101000000 000097 Studio Coletta Comme       2.664,48          2.664,48 D                 STUDIO COLETTA        3/01/25
//   130303000001        UNICREDIT 6608312          2.245,48          2.245,48 A                 STUDIO COLETTA       16/12/24
//   Totali al 10/01/25 Num.      4 Totale Dare    3.901,21 Totale Avere    3.901,21  Squadr.
//
// Codice conto di 12 cifre: gruppo (2) + sottogruppo (4) + conto (6); clienti e fornitori hanno il conto a zero
// e il codice del soggetto accanto ("440101000000 000097"). Il conto diventa "44/0101/000097" e il gruppo
// "44/0101", come per gli altri codici numerici (vedi gruppoDiConto). Le righe IVA riportano anche l'imponibile.
// Apertura e chiusura si riconoscono dalla descrizione delle righe ("APERTURA CONTI"; "CHIUSURA ... ECON.",
// "CHIUS. STATO Patr."; "g/c utile" e "comp.chiusura" sono invece movimenti normali). In fondo alla stampa c'e' un riepilogo per conto con le descrizioni complete.
//
// Attenzione: la stampa puo' essere filtrata per utente ("Utente" nei parametri di lancio) e contenere solo una
// parte dei movimenti. Per questo, se la stampa contiene le chiusure di fine anno, il saldo dell'anno e' quello di
// chiusura (sempre completo; zero per i conti che non vengono chiusi); i conti i cui movimenti non tornano con la
// chiusura sono segnalati in diagnostica.
// Produce gli stessi dati degli altri lettori (parseLibroGiornale / estraiMovimenti in libroGiornale.js).

const AMT = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`
const RE_AMOUNT = new RegExp(AMT, 'g')
// Testata: data, [protocollo], anno e numero del movimento (es. "26 15" o "24 616"), causale di 3 cifre, poi
// eventuali numero e data del documento. Il protocollo c'e' solo su alcune registrazioni (es. fatture d'acquisto):
// " 9/01/26        4  26       4  001    K26000057      9/01/26   EUR"   " 9/01/26   26   15  120   EUR"
const RE_DATA_TESTATA = /^\s*(\d{1,2})\/(\d{2})\/(\d{2})\s+(\d.*)$/
const RE_CON_PROTOCOLLO = /^(\d+)\s+(\d{2})\s+(\d+)\s+(\d{3})\b(.*)$/
const RE_SENZA_PROTOCOLLO = /^(\d{2})\s+(\d+)\s+(\d{3})\b(.*)$/
function leggiTestata(ln) {
  const md = ln.match(RE_DATA_TESTATA)
  if (!md) return null
  const [, g, m, a, resto] = md
  const plausibile = (anno) => Math.abs(Number(anno) - Number(a)) <= 1   // anno del movimento: quello della data o vicino
  const cp = resto.match(RE_CON_PROTOCOLLO)
  if (cp && plausibile(cp[2])) return { g, m, a, protocollo: cp[1], numero: cp[3], causale: cp[4], resto: cp[5] }
  const sp = resto.match(RE_SENZA_PROTOCOLLO)
  if (sp && plausibile(sp[1])) return { g, m, a, protocollo: null, numero: sp[2], causale: sp[3], resto: sp[4] }
  return null
}
const RE_RIGA = new RegExp(String.raw`^\s*(\d{12})(?:\s+(\d{6}))?\s+(.*?)\s+(${AMT})\s+(${AMT})\s+([DA])(?:\s+(.*))?$`)
const RE_TOTALI = new RegExp(String.raw`Totali al\s+(\d{1,2}/\d{2}/\d{2}).*Totale Dare\s+(${AMT}).*Totale Avere\s+(${AMT})`)
const RE_RIEPILOGO = /^\s*Conto\s+Descr\.\s+Importo Dare\s+Importo Avere/
const RE_RIGA_RIEPILOGO = new RegExp(String.raw`^\s*(\d{12})\s+(.+?)\s+(${AMT})\s+(${AMT})\s*$`)
const RE_DATA_FINALE = /\s(\d{1,2}\/\d{2}\/\d{2})\s*$/

const round2 = (n) => Math.round(n * 100) / 100
const parseNum = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'))
const dataEstesa = (g, m, a) => `${String(g).padStart(2, '0')}/${m}/20${a}`

export const eListaPrimaNotaAs400 = (righe) =>
  righe.some((ln) => /Stampa Lista Prima Nota/.test(ln)) && righe.some((ln) => /Conto Cont\./.test(ln) && /Imp\.Div\./.test(ln))

const contoDa = (cod12, soggetto) => {
  const conto = cod12.slice(6)
  const finale = /^0+$/.test(conto) && soggetto ? soggetto : conto
  return `${cod12.slice(0, 2)}/${cod12.slice(2, 6)}/${finale}`
}

const eDescrApertura = (d) => /APERTURA CONTI/i.test(d || '')
const eDescrChiusura = (d) => /CHIUSURA.*ECON|CHIUS\.?\s*STATO/i.test(d || '')

// Registrazioni con le loro righe, controlli di quadratura giornalieri e descrizioni complete dal riepilogo
export function leggiRegistrazioniAs400(righe) {
  const registrazioni = []
  const descrizioniComplete = {}
  let reg = null
  let nelRiepilogo = false
  const perGiorno = {} // data -> { dare, avere }
  let giorniOk = 0
  const giorniKo = []

  for (const ln of righe) {
    if (RE_RIEPILOGO.test(ln)) { nelRiepilogo = true; continue }
    if (nelRiepilogo) {
      const mr = ln.match(RE_RIGA_RIEPILOGO)
      if (mr) descrizioniComplete[mr[1]] = mr[2].trim()
      continue
    }
    const mtot = ln.match(RE_TOTALI)
    if (mtot) {
      const [g, m, a] = mtot[1].split('/')
      const chiave = dataEstesa(g, m, a)
      const calc = perGiorno[chiave] || { dare: 0, avere: 0 }
      const td = parseNum(mtot[2])
      const ta = parseNum(mtot[3])
      if (Math.abs(td - calc.dare) < 0.02 && Math.abs(ta - calc.avere) < 0.02) giorniOk++
      else giorniKo.push({ data: chiave, atteso: [td, ta], calcolato: [round2(calc.dare), round2(calc.avere)] })
      continue
    }
    const mt = leggiTestata(ln)
    if (mt) {
      const { g, m, a, protocollo, numero, causale, resto } = mt
      const doc = resto.match(/^\s*(?:(\S+)\s+)?(\d{1,2}\/\d{2}\/\d{2})\s+EUR\b/)
      reg = {
        data: dataEstesa(g, m, a),
        mese: parseInt(m, 10),
        protocollo,
        numero,
        causale,
        nDoc: doc && doc[1] && !/^\d{1,2}\/\d{2}\/\d{2}$/.test(doc[1]) ? doc[1] : null,
        dtDoc: doc ? (() => { const [dg, dm, da] = doc[2].split('/'); return dataEstesa(dg, dm, da) })() : null,
        righe: [],
      }
      registrazioni.push(reg)
      continue
    }
    const mr = ln.match(RE_RIGA)
    if (mr && reg) {
      const [, cod12, soggetto, descrizioneConto, , importoOrig, da, coda = ''] = mr
      const importo = parseNum(importoOrig)
      const segno = da === 'D' ? 1 : -1
      // coda: [imponibile] [aliquota] [descrizione aggiuntiva] [data scadenza]
      let altro = coda.replace(RE_DATA_FINALE, '').trim()
      const imp = altro.match(new RegExp(String.raw`^(${AMT})\s+(\d{1,2})?\s*(.*)$`))
      if (imp) altro = imp[3].trim()
      const scad = coda.match(RE_DATA_FINALE)
      reg.righe.push({
        conto: contoDa(cod12, soggetto),
        // clienti e fornitori: la descrizione e' il nome del soggetto, non quella del conto riepilogativo
        codice12: soggetto ? null : cod12,
        soggetto: !!soggetto,
        descrizioneConto: descrizioneConto.trim(),
        descrizioneOperazione: altro,
        scadenza: scad ? (() => { const [sg, sm, sa] = scad[1].split('/'); return dataEstesa(sg, sm, sa) })() : null,
        segno,
        importo,
      })
      const pg = perGiorno[reg.data] || (perGiorno[reg.data] = { dare: 0, avere: 0 })
      if (segno > 0) pg.dare += importo
      else pg.avere += importo
    }
  }
  // registrazioni di apertura / chiusura: decise dalle descrizioni delle righe
  for (const r of registrazioni) {
    r.eApertura = r.righe.length > 0 && r.righe.every((x) => eDescrApertura(x.descrizioneOperazione))
    r.eChiusura = r.righe.some((x) => eDescrChiusura(x.descrizioneOperazione))
  }
  return { registrazioni, descrizioniComplete, controlli: { giorniOk, giorniKo } }
}

export function parseListaPrimaNotaAs400(righe) {
  const { registrazioni, descrizioniComplete, controlli } = leggiRegistrazioniAs400(righe)
  if (!registrazioni.length) throw new Error('Nessuna registrazione trovata nella Lista Prima Nota.')
  const saldoApertura = {}
  const saldoMovimenti = {}
  const saldoChiusura = {}
  const movimentiPerMese = {}
  const descrizioni = {}
  let nMovimenti = 0
  let nNonBilanciate = 0

  for (const reg of registrazioni) {
    if (Math.abs(reg.righe.reduce((s, r) => s + r.segno * r.importo, 0)) > 0.02) nNonBilanciate++
    for (const r of reg.righe) {
      nMovimenti++
      if (!(r.conto in descrizioni)) descrizioni[r.conto] = descrizioniComplete[r.codice12] || r.descrizioneConto
      const v = r.segno * r.importo
      if (reg.eApertura) saldoApertura[r.conto] = (saldoApertura[r.conto] || 0) + v
      else if (reg.eChiusura) saldoChiusura[r.conto] = (saldoChiusura[r.conto] || 0) + v
      else {
        saldoMovimenti[r.conto] = (saldoMovimenti[r.conto] || 0) + v
        if (!movimentiPerMese[reg.mese]) movimentiPerMese[reg.mese] = {}
        movimentiPerMese[reg.mese][r.conto] = (movimentiPerMese[reg.mese][r.conto] || 0) + v
      }
    }
  }

  const tutti = new Set([...Object.keys(saldoApertura), ...Object.keys(saldoMovimenti), ...Object.keys(saldoChiusura)])
  let verificaOk = 0
  const verificaKo = []
  const saldi = {}
  const conChiusura = Object.keys(saldoChiusura).length > 0
  for (const c of tutti) {
    const calcolato = (saldoApertura[c] || 0) + (saldoMovimenti[c] || 0)
    if (!conChiusura) { saldi[c] = round2(calcolato); continue }
    // la chiusura e' sempre completa: e' il saldo dell'anno anche se la stampa non ha tutti i movimenti
    // (un conto senza riga di chiusura ha saldo zero a fine anno)
    const finale = -(saldoChiusura[c] || 0)
    const scarto = calcolato - finale
    if (Math.abs(scarto) < 0.02) verificaOk++
    else verificaKo.push({ conto: c, descrizione: descrizioni[c] || '', scarto: round2(scarto) })
    if (Math.abs(finale) >= 0.005) saldi[c] = round2(finale)
  }
  const movimentiMensili = {}
  for (const [mese, perConto] of Object.entries(movimentiPerMese)) {
    movimentiMensili[mese] = {}
    for (const [c, v] of Object.entries(perConto)) movimentiMensili[mese][c] = round2(v)
  }
  const stampaParziale = verificaKo.length > 0

  return {
    saldi,
    movimentiMensili,
    descrizioni,
    diagnostica: {
      formato: 'as400',
      testate: registrazioni.length,
      movimenti: nMovimenti,
      registrazioniNonBilanciate: nNonBilanciate,
      checkpointOk: controlli.giorniOk,
      checkpointKo: controlli.giorniKo.length,
      verificaOk,
      verificaKo: verificaKo.length,
      dettaglioVerificaKo: verificaKo.slice(0, 20),
      saldiDaChiusura: conChiusura,
      ...(stampaParziale
        ? { avviso: `Per ${verificaKo.length} conti i movimenti stampati non tornano con la chiusura: la Lista Prima Nota sembra filtrata (es. per utente). I saldi dell'anno sono presi dalla chiusura e sono corretti, ma i movimenti mensili sono incompleti: ristampa la lista senza filtri per avere anche i mesi.` }
        : {}),
    },
  }
}

// Stessa uscita di estraiMovimenti: un movimento per riga; ogni registrazione e' un segmento bilanciato
export function estraiMovimentiAs400(righe) {
  const { registrazioni, descrizioniComplete } = leggiRegistrazioniAs400(righe)
  const movimenti = []
  for (const reg of registrazioni) {
    reg.righe.forEach((r, i) => {
      movimenti.push({
        data: reg.data,
        mese: reg.mese,
        conto: r.conto,
        descrizione: descrizioniComplete[r.codice12] || r.descrizioneConto,
        segno: r.segno,
        importo: r.importo,
        chiave: `${reg.causale} ${r.descrizioneOperazione}`.trim(),
        eApertura: reg.eApertura,
        eChiusura: reg.eChiusura,
        chiudeSegmento: i === reg.righe.length - 1,
        nDoc: reg.nDoc,
        dtDoc: reg.dtDoc,
        soggetto: r.soggetto,
      })
    })
  }
  abbinaIncassiPagamenti(movimenti)
  return movimenti
}

// Le righe di incasso e di pagamento di questa stampa non riportano la fattura a cui si riferiscono (numero e data
// del documento sono quelli della registrazione). Per i tempi medi (dsoDpo.js) si abbinano alle fatture dello
// stesso cliente/fornitore in ordine cronologico (prima la fattura piu' vecchia): la riga di incasso/pagamento
// riceve come Dt. Doc. la data media, ponderata sugli importi, delle fatture che chiude. Le partite di apertura
// (fatture dell'anno prima, data sconosciuta) si chiudono per prime ma non entrano nella media; un incasso o
// pagamento che chiude solo partite di apertura resta senza data documento e non viene conteggiato.
const giornoDa = (s) => { const [d, m, y] = s.split('/').map(Number); return Date.UTC(y, m - 1, d) / 86400000 }
const dataDa = (giorno) => { const t = new Date(Math.round(giorno) * 86400000); return `${String(t.getUTCDate()).padStart(2, '0')}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${t.getUTCFullYear()}` }
export function abbinaIncassiPagamenti(movimenti) {
  const partite = new Map() // conto -> { segno, aperte: [{ residuo, giorno, nDoc }] }
  const ordinati = movimenti.filter((x) => x.soggetto && !x.eChiusura).map((x, i) => ({ x, i })).sort((p, q) => giornoDa(p.x.data) - giornoDa(q.x.data) || p.i - q.i)
  for (const { x } of ordinati) {
    const p = partite.get(x.conto) || { segno: null, aperte: [] }
    partite.set(x.conto, p)
    const nuova = () => ({ residuo: x.importo, giorno: x.eApertura ? null : giornoDa(x.dtDoc || x.data), nDoc: x.nDoc })
    if (!p.aperte.length || p.segno === x.segno) {
      p.aperte.push(nuova())
      p.segno = x.segno
      continue
    }
    let resto = x.importo
    let somma = 0
    let quota = 0
    const documenti = []
    while (resto > 0.005 && p.aperte.length) {
      const a = p.aperte[0]
      const usato = Math.min(resto, a.residuo)
      if (a.giorno != null) { somma += usato * a.giorno; quota += usato; if (a.nDoc) documenti.push(a.nDoc) }
      a.residuo -= usato
      resto -= usato
      if (a.residuo <= 0.005) p.aperte.shift()
    }
    if (resto > 0.005) { p.aperte.push({ ...nuova(), residuo: resto }); p.segno = x.segno }   // eccedenza: anticipo
    x.dtDoc = quota > 0 ? dataDa(somma / quota) : null
    x.nDoc = quota > 0 ? (documenti.join(', ') || 'abbinato') : null
  }
}
