import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword({ onFatto }) {
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState(null)
  const [fatto, setFatto] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) { setErrore('La password deve avere almeno 6 caratteri.'); return }
    if (password !== conferma) { setErrore('Le due password non coincidono.'); return }
    setLoading(true); setErrore(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setErrore(error.message); return }
    setFatto(true)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔑</div>
          <h1>Nuova password</h1>
          <p>Imposta la password per il tuo account</p>
        </div>
        {fatto ? (
          <>
            <div className="alert alert-success">Password aggiornata! Ora puoi accedere con la nuova password.</div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onFatto}>Vai al login</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {errore && <div className="alert alert-error">{errore}</div>}
            <div className="form-group">
              <label className="form-label">Nuova password</label>
              <input className="form-control" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label className="form-label">Conferma password</label>
              <input className="form-control" type="password" value={conferma} onChange={e => setConferma(e.target.value)} required minLength={6} placeholder="••••••••" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
              {loading ? 'Salvataggio...' : 'Imposta password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
