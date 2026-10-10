import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Un solo dispositivo per utente: vale l'accesso piu' recente (funzione sessione_valida sul database, vedi
// supabase/sql/2026-10-08_n_sessione_unica.sql). Appena un altro dispositivo registra il proprio accesso, la riga
// sessioni_pmi360 dell'utente cambia e arriva qui in tempo reale (Supabase Realtime): l'avviso compare subito.
// Il controllo periodico e al ritorno sulla scheda resta come rete di sicurezza (es. connessione caduta).
// rete di sicurezza se la notifica in tempo reale non arriva (es. connessione caduta): controllo frequente
// quando la scheda e' visibile, poco frequente quando e' nascosta
const INTERVALLO_VISIBILE_MS = 15 * 1000
const INTERVALLO_NASCOSTA_MS = 60 * 1000

// id della sessione di Supabase Auth contenuto nel token ("session_id")
function idSessione(session) {
  try {
    const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)).session_id || null
  } catch {
    return null
  }
}

export default function ControlloSessione() {
  const [superata, setSuperata] = useState(false)
  const [utente, setUtente] = useState(null)   // { id, sessione }

  const chiudi = useCallback(async () => {
    setSuperata(true)
    // si chiude subito la sessione locale: da qui in poi nessuna operazione parte da questo dispositivo
    await supabase.auth.signOut({ scope: 'local' })
  }, [])

  const controlla = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data?.session) return
    setUtente((u) => (u?.sessione === idSessione(data.session) ? u : { id: data.session.user.id, sessione: idSessione(data.session) }))
    const { data: valida, error } = await supabase.rpc('sessione_valida')
    if (!error && valida === false) await chiudi()
  }, [chiudi])

  // notifica immediata: la sessione registrata dell'utente e' cambiata
  useEffect(() => {
    if (!utente?.id || !utente.sessione) return undefined
    let canale = null
    let attivo = true
    let riprova = null
    const collega = async () => {
      // la libreria passa il token dell'utente al canale solo al login o al rinnovo del token: dopo un
      // ricaricamento della pagina il canale resterebbe anonimo e le regole di accesso bloccherebbero la notifica
      const { data } = await supabase.auth.getSession()
      if (!attivo || !data?.session) return
      await supabase.realtime.setAuth(data.session.access_token)
      canale = supabase
        .channel(`sessione-${utente.id}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessioni_pmi360', filter: `user_id=eq.${utente.id}` }, (payload) => {
          const nuova = payload.new?.session_id
          if (nuova && nuova !== utente.sessione) chiudi()
        })
        .subscribe((stato) => {
          // canale caduto: si ricontrolla subito e ci si ricollega
          if (stato === 'CHANNEL_ERROR' || stato === 'TIMED_OUT' || stato === 'CLOSED') {
            if (!attivo) return
            controlla()
            clearTimeout(riprova)
            riprova = setTimeout(() => { if (attivo) { supabase.removeChannel(canale); collega() } }, 5000)
          }
        })
    }
    collega()
    return () => {
      attivo = false
      clearTimeout(riprova)
      if (canale) supabase.removeChannel(canale)
    }
  }, [utente, chiudi, controlla])

  useEffect(() => {
    controlla()
    let timer = null
    const programma = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => { await controlla(); programma() }, document.visibilityState === 'visible' ? INTERVALLO_VISIBILE_MS : INTERVALLO_NASCOSTA_MS)
    }
    programma()
    const alRitorno = () => { if (document.visibilityState === 'visible') { controlla(); programma() } }
    document.addEventListener('visibilitychange', alRitorno)
    window.addEventListener('focus', controlla)
    window.addEventListener('online', controlla)
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_IN' || evento === 'TOKEN_REFRESHED' || evento === 'MFA_CHALLENGE_VERIFIED') controlla() })
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', alRitorno)
      window.removeEventListener('focus', controlla)
      window.removeEventListener('online', controlla)
      sub?.subscription?.unsubscribe()
    }
  }, [controlla])

  if (!superata) return null
  const rientra = () => window.location.replace(window.location.origin + window.location.pathname)
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="sessione-chiusa-titolo"
      style={{ position: 'fixed', inset: 0, zIndex: 100001, background: 'rgba(15, 23, 42, 0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 460, width: '100%', padding: '24px 26px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
        <h2 id="sessione-chiusa-titolo" style={{ margin: '0 0 8px', fontSize: 19, color: '#1A3A5C' }}>Sessione chiusa</h2>
        <p style={{ margin: '0 0 18px', fontSize: 14, color: '#374151', lineHeight: 1.55 }}>
          Hai effettuato l'accesso al portale da un altro dispositivo: si può usare un solo dispositivo alla volta,
          quindi questa sessione è stata chiusa. Per continuare qui, accedi di nuovo (l'altro dispositivo verrà disconnesso).
        </p>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={rientra} autoFocus>Accedi di nuovo</button>
      </div>
    </div>
  )
}
