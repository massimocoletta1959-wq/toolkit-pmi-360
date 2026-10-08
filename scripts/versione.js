// Identificativo della build (commit + ora), scritto prima di "react-scripts build" in due posti:
//  - .env.production.local -> REACT_APP_VERSIONE, compilato dentro il programma;
//  - public/version.json   -> pubblicato sul sito, letto dal browser per sapere se c'e' una versione piu' nuova.
// Vedi src/components/ControlloVersione.js. Entrambi i file sono generati (in .gitignore).
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

let commit = process.env.GITHUB_SHA || ''
if (!commit) {
  try { commit = execSync('git rev-parse HEAD').toString().trim() } catch { commit = 'locale' }
}
const versione = `${commit.slice(0, 12)}-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`
const radice = path.join(__dirname, '..')
fs.writeFileSync(path.join(radice, '.env.production.local'), `REACT_APP_VERSIONE=${versione}\n`)
fs.writeFileSync(path.join(radice, 'public', 'version.json'), JSON.stringify({ versione }) + '\n')
console.log(`Versione della build: ${versione}`)
