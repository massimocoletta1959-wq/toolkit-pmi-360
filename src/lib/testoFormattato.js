// Formattazione minima per i documenti legali scritti in Markdown semplice: titoli (#, ##, ###), elenchi puntati
// (- o *), elenchi numerati (1.), paragrafi separati da una riga vuota, **grassetto**. Restituisce blocchi che
// la pagina disegna; nessun HTML dal testo viene mai interpretato.
export function blocchiDaTesto(testo) {
  const righe = String(testo || '').replace(/\r\n?/g, '\n').split('\n')
  const blocchi = []
  let paragrafo = []
  let elenco = null

  const chiudiParagrafo = () => {
    if (paragrafo.length) blocchi.push({ tipo: 'p', testo: paragrafo.join(' ') })
    paragrafo = []
  }
  const chiudiElenco = () => {
    if (elenco) blocchi.push(elenco)
    elenco = null
  }

  for (const grezza of righe) {
    const riga = grezza.trim()
    const titolo = /^(#{1,3})\s+(.*)$/.exec(riga)
    const puntato = /^[-*]\s+(.*)$/.exec(riga)
    const numerato = /^\d+[.)]\s+(.*)$/.exec(riga)
    if (!riga) {
      chiudiParagrafo()
      chiudiElenco()
    } else if (titolo) {
      chiudiParagrafo()
      chiudiElenco()
      blocchi.push({ tipo: `h${titolo[1].length}`, testo: titolo[2] })
    } else if (puntato || numerato) {
      chiudiParagrafo()
      const tipo = puntato ? 'ul' : 'ol'
      if (!elenco || elenco.tipo !== tipo) {
        chiudiElenco()
        elenco = { tipo, voci: [] }
      }
      elenco.voci.push((puntato || numerato)[1])
    } else if (elenco && /^\s{2,}/.test(grezza)) {
      elenco.voci[elenco.voci.length - 1] += ` ${riga}` // continuazione della voce
    } else {
      chiudiElenco()
      paragrafo.push(riga)
    }
  }
  chiudiParagrafo()
  chiudiElenco()
  return blocchi
}

// Spezza un testo in parti normali e in grassetto (**...**)
export function partiInLinea(testo) {
  return String(testo)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((p) => (p.startsWith('**') && p.endsWith('**') ? { grassetto: true, testo: p.slice(2, -2) } : { grassetto: false, testo: p }))
}
