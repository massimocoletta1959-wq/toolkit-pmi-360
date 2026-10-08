import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Un solo dispositivo per utente: vale l'accesso piu' recente (funzione sessione_valida sul database, vedi
// supabase/sql/2026-10-08_n_sessione_unica.sql). Il controllo si fa all'apertura, ogni minuto e al ritorno sulla
// scheda; se nel frattempo l'utente e' entrato da un altro dispositivo, questa sessione viene chiusa con un avviso.
const INTERVALLO_MS = 60 * 1000

export default function ControlloSessione() {
  const [superata, setSuperata] = useState(false)

  const controlla = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data?.session) return
    const { data: valida, error } = await supabase.rpc('sessione_valida')
    if (!error && valida === false) {
      setSuperata(true)
      // si chiude subito la sessione locale: da qui in poi nessuna operazione parte da questo dispositivo
      await supabase.auth.signOut({ scope: 'local' })
    }
  }, [])

  useEffect(() => {
    controlla()
    const timer = setInterval(controlla, INTERVALLO_MS)
    const alRitorno = () => { if (document.visibilityState === 'visible') controlla() }
    document.addEventListener('visibilitychange', alRitorno)
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_IN' || evento === 'TOKEN_REFRESHED') controlla() })
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', alRitorno)
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
