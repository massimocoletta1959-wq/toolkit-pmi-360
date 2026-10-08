import React, { useCallback, useEffect, useState } from 'react'

// Controllo della versione: il programma conosce la propria (REACT_APP_VERSIONE, scritta alla build da
// scripts/versione.js) e la confronta con quella pubblicata (version.json sul sito) all'apertura, ogni 5 minuti e
// quando si torna sulla scheda. Se e' cambiata, un avviso a tutto schermo chiede di ricaricare: una scheda rimasta
// aperta dopo un aggiornamento userebbe ancora il codice vecchio (es. il lettore di un nuovo formato di giornale).
// In sviluppo (npm start) la versione non c'e' e il controllo e' spento.
const VERSIONE = process.env.REACT_APP_VERSIONE
const INTERVALLO_MS = 5 * 60 * 1000

async function versionePubblicata() {
  const r = await fetch(`${process.env.PUBLIC_URL || ''}/version.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!r.ok) return null
  const j = await r.json()
  return j?.versione || null
}

// Ricarica scavalcando la cache del browser (equivalente a Ctrl+F5 per la pagina principale)
function aggiorna() {
  const url = new URL(window.location.href)
  url.searchParams.set('v', Date.now().toString(36))
  window.location.replace(url.toString())
}

export default function ControlloVersione() {
  const [nuova, setNuova] = useState(false)

  const controlla = useCallback(async () => {
    if (!VERSIONE) return
    try {
      const pubblicata = await versionePubblicata()
      if (pubblicata && pubblicata !== VERSIONE) setNuova(true)
    } catch {
      // rete assente o file non raggiungibile: si riprova al prossimo controllo
    }
  }, [])

  useEffect(() => {
    if (!VERSIONE) return undefined
    controlla()
    const timer = setInterval(controlla, INTERVALLO_MS)
    const alRitorno = () => { if (document.visibilityState === 'visible') controlla() }
    document.addEventListener('visibilitychange', alRitorno)
    // una pagina caricata "a pezzi" dopo un aggiornamento non trova piu' i file vecchi: stesso avviso
    const suErrore = (e) => {
      const msg = String(e?.reason?.message || e?.message || '')
      if (/Loading chunk|ChunkLoadError|Loading CSS chunk/i.test(msg)) setNuova(true)
    }
    window.addEventListener('unhandledrejection', suErrore)
    window.addEventListener('error', suErrore)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', alRitorno)
      window.removeEventListener('unhandledrejection', suErrore)
      window.removeEventListener('error', suErrore)
    }
  }, [controlla])

  // tolto il parametro di ricarica dall'indirizzo, per non lasciarlo in giro
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has('v')) {
      url.searchParams.delete('v')
      window.history.replaceState(null, '', url.toString())
    }
  }, [])

  if (!nuova) return null
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="nuova-versione-titolo"
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(15, 23, 42, 0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 460, width: '100%', padding: '24px 26px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
        <h2 id="nuova-versione-titolo" style={{ margin: '0 0 8px', fontSize: 19, color: '#1A3A5C' }}>È disponibile una nuova versione</h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.55 }}>
          Il portale è stato aggiornato. Per continuare serve caricare la versione nuova: quella in uso potrebbe dare risultati non corretti.
        </p>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
          Le modifiche già salvate sono al sicuro; quelle in un modulo aperto e non ancora salvato andrebbero perse.
          Se il pulsante non bastasse, ricarica con <strong>Ctrl+F5</strong> (su Mac <strong>Cmd+Shift+R</strong>).
        </p>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={aggiorna} autoFocus>Aggiorna ora</button>
      </div>
    </div>
  )
}
