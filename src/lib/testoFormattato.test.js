import { blocchiDaTesto, partiInLinea } from './testoFormattato'

test('titoli, paragrafi ed elenchi', () => {
  const b = blocchiDaTesto('# Titolo\n\nPrima riga\nseconda riga\n\n## Diritti\n- accesso\n- rettifica\n  e integrazione\n\n1. uno\n2. due')
  expect(b).toEqual([
    { tipo: 'h1', testo: 'Titolo' },
    { tipo: 'p', testo: 'Prima riga seconda riga' },
    { tipo: 'h2', testo: 'Diritti' },
    { tipo: 'ul', voci: ['accesso', 'rettifica e integrazione'] },
    { tipo: 'ol', voci: ['uno', 'due'] },
  ])
})

test('il grassetto si separa, l HTML resta testo', () => {
  expect(partiInLinea('Titolare: **Pmi 360 S.r.l.** <b>x</b>')).toEqual([
    { grassetto: false, testo: 'Titolare: ' },
    { grassetto: true, testo: 'Pmi 360 S.r.l.' },
    { grassetto: false, testo: ' <b>x</b>' },
  ])
})

test('tabelle con intestazione', () => {
  expect(blocchiDaTesto('Prima\n\n| Finalità | Base |\n|---|---|\n| Account | art. 6.1.b |\n| Sicurezza | art. 6.1.f |\n\nDopo')).toEqual([
    { tipo: 'p', testo: 'Prima' },
    { tipo: 'table', intestazione: ['Finalità', 'Base'], righe: [['Account', 'art. 6.1.b'], ['Sicurezza', 'art. 6.1.f']] },
    { tipo: 'p', testo: 'Dopo' },
  ])
})
