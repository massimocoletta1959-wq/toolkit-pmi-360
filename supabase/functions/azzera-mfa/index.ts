// =====================================================================
//  Edge Function: azzera-mfa
//  Azzera la verifica in due passaggi di un utente che ha perso o cambiato il telefono: rimuove i suoi
//  fattori TOTP, cosi' al prossimo accesso la riattiva con il nuovo telefono. Autorizzati (puo_azzerare_mfa):
//  il proprietario per chiunque, il gestore per i membri delle proprie aziende. Ogni azzeramento e'
//  registrato in mfa_azzeramenti con chi l'ha eseguito e il motivo.
// =====================================================================

import { richiedeUtenteAal2 } from '../_shared/mfa.ts'

const URL_SB = Deno.env.get('SUPABASE_URL') || ''
const SERVIZIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || ''

Deno.serve(async (req: Request) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  const negato = await richiedeUtenteAal2(req, headers)
  if (negato) return negato
  const risposta = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers })

  try {
    const { utente_id, motivo } = await req.json()
    if (!utente_id) return risposta(400, { errore: 'Utente mancante' })
    const tokenUtente = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')

    // autorizzazione decisa dal database, con il token di chi chiede
    const aut = await fetch(`${URL_SB}/rest/v1/rpc/puo_azzerare_mfa`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${tokenUtente}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_utente: utente_id }),
    })
    if (!aut.ok || (await aut.json()) !== true) return risposta(403, { errore: 'Non sei autorizzato ad azzerare la verifica di questo utente' })

    const admin = { apikey: SERVIZIO, Authorization: `Bearer ${SERVIZIO}`, 'Content-Type': 'application/json' }
    const [utenteRes, chiedenteRes] = await Promise.all([
      fetch(`${URL_SB}/auth/v1/admin/users/${utente_id}`, { headers: admin }),
      fetch(`${URL_SB}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${tokenUtente}` } }),
    ])
    if (!utenteRes.ok) return risposta(404, { errore: 'Utente non trovato' })
    const utente = await utenteRes.json()
    const chiedente = await chiedenteRes.json()

    let rimossi = 0
    for (const f of utente.factors || []) {
      const del = await fetch(`${URL_SB}/auth/v1/admin/users/${utente_id}/factors/${f.id}`, { method: 'DELETE', headers: admin })
      if (del.ok) rimossi++
    }

    await fetch(`${URL_SB}/rest/v1/mfa_azzeramenti`, {
      method: 'POST',
      headers: { ...admin, Prefer: 'return=minimal' },
      body: JSON.stringify({
        utente_id,
        utente_email: utente.email || null,
        eseguito_da: chiedente.id || null,
        eseguito_da_email: chiedente.email || null,
        motivo: motivo ? String(motivo).slice(0, 500) : null,
        fattori_rimossi: rimossi,
      }),
    })

    return risposta(200, { ok: true, fattori_rimossi: rimossi, email: utente.email })
  } catch (e) {
    return risposta(500, { errore: (e as Error).message })
  }
})
