import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || ''
const APP_URL = 'https://massimocoletta1959-wq.github.io/toolkit-pmi-360'

serve(async (req) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  try {
    const { membro_id, azienda_id } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    const [mr, ar] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/membri?id=eq.${membro_id}&select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
      fetch(`${supabaseUrl}/rest/v1/aziende?id=eq.${azienda_id}&select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
    ])
    const membro  = (await mr.json())[0]
    const azienda = (await ar.json())[0]
    if (!membro || !azienda) return new Response(JSON.stringify({ error: 'Non trovato' }), { status: 404, headers })

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
