import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { richiedeUtenteAal2 } from '../_shared/mfa.ts'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || ''
const APP_URL = 'https://app.pmi360.it'

serve(async (req) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  const negato = await richiedeUtenteAal2(req, headers)
  if (negato) return negato
  try {
    const { membro_id, azienda_id } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuid.test(String(membro_id || '')) || !uuid.test(String(azienda_id || ''))) {
      return new Response(JSON.stringify({ error: 'Parametri non validi' }), { status: 400, headers })
    }

    // Chi invia: utente collegato che gestisce l'azienda dell'invito (stessa regola del database,
    // mie_aziende_gestore, interrogata con il token dell'utente)
    const auth = req.headers.get('Authorization') || ''
    const ur = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { 'apikey': anonKey, 'Authorization': auth } })
    const utente = ur.ok ? await ur.json() : null
    if (!utente?.id) return new Response(JSON.stringify({ error: 'Sessione non valida' }), { status: 401, headers })
    const gr = await fetch(`${supabaseUrl}/rest/v1/rpc/mie_aziende_gestore`, { method: 'POST', headers: { 'apikey': anonKey, 'Authorization': auth, 'Content-Type': 'application/json' }, body: '{}' })
    const gestite: string[] = gr.ok ? await gr.json() : []
    if (!Array.isArray(gestite) || !gestite.includes(azienda_id)) {
      return new Response(JSON.stringify({ error: 'Non gestisci questa azienda' }), { status: 403, headers })
    }

    const [mr, ar] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/membri?id=eq.${membro_id}&select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
      fetch(`${supabaseUrl}/rest/v1/aziende?id=eq.${azienda_id}&select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
    ])
    const membro  = (await mr.json())[0]
    const azienda = (await ar.json())[0]
    if (!membro || !azienda) return new Response(JSON.stringify({ error: 'Non trovato' }), { status: 404, headers })
    // il membro invitato deve appartenere all'azienda dell'invito
    if (membro.azienda_id !== azienda_id) return new Response(JSON.stringify({ error: 'Il membro non appartiene a questa azienda' }), { status: 403, headers })
    if (!membro.email) return new Response(JSON.stringify({ error: 'Il membro non ha un indirizzo email' }), { status: 422, headers })

    const token = crypto.randomUUID().replace(/-/g, '')
    await fetch(`${supabaseUrl}/rest/v1/inviti`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ azienda_id, membro_id, email: membro.email, token }),
    })

    const inviteUrl = `${APP_URL}?invito=${token}`
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Toolkit Pmi 360°', email: 'massimocoletta1959@gmail.com' },
        to: [{ email: membro.email, name: `${membro.nome} ${membro.cognome}` }],
        subject: `Invito al portale — ${azienda.nome}`,
        htmlContent: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
<div style="background:#1A3A5C;padding:24px;text-align:center;"><h1 style="color:white;margin:0;font-size:18px;">🛡️ Toolkit Pmi 360°</h1></div>
<div style="padding:32px;">
<p style="color:#555;">Ciao <strong>${membro.nome} ${membro.cognome}</strong>,</p>
<p style="color:#555;">sei stato invitato ad accedere al portale di gestione rischi dell'azienda <strong>${azienda.nome}</strong>.</p>
<div style="background:#F7F8FA;border-radius:8px;padding:16px;margin:20px 0;font-size:13px;color:#555;">
<strong>Ruolo:</strong> ${membro.ruolo || 'Membro operativo'}<br>
<strong>Azienda:</strong> ${azienda.nome}<br>
<strong>Link valido per:</strong> 7 giorni</div>
<div style="text-align:center;margin:24px 0;">
<a href="${inviteUrl}" style="background:#2B5FA5;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Accetta invito e accedi →</a>
</div>
<p style="font-size:11px;color:#aaa;text-align:center;">Oppure copia: <a href="${inviteUrl}">${inviteUrl}</a></p>
</div></div></body></html>`,
      }),
    })

    const brevoData = await brevoRes.json()
    console.log('Brevo status:', brevoRes.status, JSON.stringify(brevoData))
    const successo = brevoRes.status === 201

    return new Response(JSON.stringify({ successo, token, inviteUrl }), { headers })
  } catch (err) {
    console.error('Errore:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
})
