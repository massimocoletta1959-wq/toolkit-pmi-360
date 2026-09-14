import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const emailDaUrl = new URLSearchParams(window.location.search).get('email') || ''

export default function Login() {
  const [email, setEmail]     = useState(emailDaUrl)
  const [password, setPassword] = useState('')
  const [mode, setMode]       = useState(emailDaUrl ? 'register' : 'login') // login | register | recupera
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setMsg(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg({ type: 'error', text: error.message })
    } else if (mode === 'register') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMsg({ type: 'error', text: error.message })
      else setMsg({ type: 'success', text: 'Account creato! Controlla la tua email per confermare, poi accedi.' })
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      })
      if (error) setMsg({ type: 'error', text: error.message })
      else setMsg({ type: 'success', text: 'Ti abbiamo inviato una email con il link per reimpostare la password.' })
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div style={{ fontSize: 40, marginBottom: 8 }}>🛡️</div>
          <h1>Toolkit Pmi 360°</h1>
          <p>Sistema di gestione rischi aziendali</p>
        </div>
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tuaemail@azienda.it" />
          </div>
          {mode !== 'recupera' && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-control" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} />
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? 'Attendere...' : mode === 'login' ? 'Accedi' : mode === 'register' ? 'Registrati' : 'Invia email di recupero'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mode === 'login' && (
            <>
              <span>Non hai un account? <button style={{ background: 'none', border: 'none', color: '#2B5FA5', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setMode('register'); setMsg(null) }}>Registrati</button></span>
              <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }} onClick={() => { setMode('recupera'); setMsg(null) }}>Password dimenticata?</button>
            </>
          )}
          {mode === 'register' && (
            <span>Hai già un account? <button style={{ background: 'none', border: 'none', color: '#2B5FA5', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setMode('login'); setMsg(null) }}>Accedi</button></span>
          )}
          {mode === 'recupera' && (
            <span>Torna al <button style={{ background: 'none', border: 'none', color: '#2B5FA5', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setMode('login'); setMsg(null) }}>login</button></span>
          )}
        </div>
      </div>
    </div>
  )
}
