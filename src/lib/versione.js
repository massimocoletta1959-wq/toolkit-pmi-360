// Versione della build in forma leggibile: REACT_APP_VERSIONE = "<commit 12>-<AAAAMMGGTHHMMSS UTC>"
// (scripts/versione.js) -> { codice: commit breve, pubblicata: data e ora italiane }.
export function descriviVersione(v = process.env.REACT_APP_VERSIONE) {
  if (!v) return null
  const [commit, ts] = v.split('-')
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(ts || '')
  const data = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : null
  return {
    codice: (commit || '').slice(0, 7),
    pubblicata: data
      ? data.toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : null,
  }
}
