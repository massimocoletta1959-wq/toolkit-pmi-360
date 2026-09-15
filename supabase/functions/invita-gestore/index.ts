import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || ''
const APP_URL = 'https://massimocoletta1959-wq.github.io/toolkit-pmi-360'

serve(async (req) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  try {
    const { email, ragione_sociale } = await req.json()
    if (!email) return new Response(JSON.stringify({ error: 'Email mancante' }), { status: 400, headers })

    const registerUrl = `${APP_URL}?email=${encodeURIComponent(email)}`
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Toolkit Pmi 360°', email: 'massimocoletta1959@gmail.com' },
        to: [{ email, name: ragione_sociale || email }],
        subject: 'Sei stato invitato al Toolkit Pmi 360°',
        htmlContent: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
<div style="background:#1A3A5C;padding:24px;text-align:center;"><h1 style="color:white;margin:0;font-size:18px;">🛡️ Toolkit Pmi 360°</h1></div>
<div style="padding:32px;">
<p style="color:#555;">Ciao${ragione_sociale ? ' ' + ragione_sociale : ''},</p>
<p style="color:#555;">sei stato invitato ad attivare il tuo account sul Toolkit Pmi 360°, il sistema di gestione rischi e governance aziendale.</p>
<p style="color:#555;">Il tuo piano è già pronto: ti basta completare la registrazione con questa stessa email.</p>
<div style="text-align:center;margin:24px 0;">
<a href="${registerUrl}" style="background:#2B5FA5;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Completa la registrazione →</a>
</div>
<p style="font-size:11px;color:#aaa;text-align:center;">Oppure copia: <a href="${registerUrl}">${registerUrl}</a></p>
</div></div></body></html>`,
      }),
    })

    const brevoData = await brevoRes.json()
    console.log('Brevo status:', brevoRes.status, JSON.stringify(brevoData))
    const successo = brevoRes.status === 201

    return new Response(JSON.stringify({ successo, registerUrl }), { headers })
  } catch (err) {
    console.error('Errore:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
})
