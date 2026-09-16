import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || ''
const APP_URL = 'https://massimocoletta1959-wq.github.io/toolkit-pmi-360'

// Un'unica email per membro con l'elenco di TUTTE le procedure appena assegnategli
// (invece di una email per procedura): se il membro non ha ancora un account la
// stessa email fa anche da invito a registrarsi, così non ne riceve due separate.
serve(async (req) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  try {
    const { membro_id, azienda_id, ticket_ids, procedure } = await req.json()
    if (!membro_id || !ticket_ids?.length || !procedure?.length) {
      return new Response(JSON.stringify({ error: 'Parametri mancanti' }), { status: 400, headers })
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const dbHeaders = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }

    const [mr, ar] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/membri?id=eq.${membro_id}&select=*`, { headers: dbHeaders }),
      fetch(`${supabaseUrl}/rest/v1/aziende?id=eq.${azienda_id}&select=nome`, { headers: dbHeaders }),
    ])
    const membro  = (await mr.json())[0]
    const azienda = (await ar.json())[0]
    if (!membro || !membro.email) return new Response(JSON.stringify({ error: 'Membro o email non trovati' }), { status: 404, headers })

    // Non ha ancora un account: la stessa email vale anche da invito a registrarsi.
    let ctaUrl = APP_URL
    let ctaLabel = 'Accedi e leggi le procedure →'
    let introRegistrazione = ''
    if (!membro.user_id) {
      const token = crypto.randomUUID().replace(/-/g, '')
      await fetch(`${supabaseUrl}/rest/v1/inviti`, {
        method: 'POST',
        headers: { ...dbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ azienda_id, membro_id, email: membro.email, token }),
      })
      ctaUrl = `${APP_URL}?invito=${token}`
      ctaLabel = 'Completa la registrazione →'
      introRegistrazione = `<p style="color:#555;">Per prenderne visione devi prima completare la registrazione al portale (ci vuole un minuto): una volta dentro, le troverai già pronte.</p>`
    }

    const righeProcedure = procedure.map((p: { codice: string; titolo: string }) =>
      `<tr><td style="padding:6px 10px;font-family:monospace;font-size:12px;font-weight:700;color:#1A3A5C;white-space:nowrap;">${p.codice}</td><td style="padding:6px 10px;font-size:13px;color:#444;">${p.titolo}</td></tr>`
    ).join('')

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#F7F8FA;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
<div style="background:#1A3A5C;padding:24px 32px;text-align:center;"><div style="font-size:28px;">🛡️</div>
<h1 style="color:white;margin:8px 0 0;font-size:18px;">Toolkit Pmi 360°</h1></div>
<div style="padding:32px;">
<p style="color:#555;">Ciao <strong>${membro.nome} ${membro.cognome}</strong>,</p>
<p style="color:#555;">${azienda?.nome ? `<strong>${azienda.nome}</strong> ti ha assegnato` : 'Ti sono state assegnate'} ${procedure.length === 1 ? 'la seguente procedura' : `le seguenti ${procedure.length} procedure`} da leggere e confermare:</p>
<table style="width:100%;border-collapse:collapse;border:1px solid #E0E0E0;border-radius:8px;overflow:hidden;margin:16px 0;">${righeProcedure}</table>
${introRegistrazione}
<div style="text-align:center;margin:24px 0;">
<a href="${ctaUrl}" style="display:inline-block;background:#2B5FA5;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">${ctaLabel}</a>
</div>
<p style="font-size:12px;color:#aaa;text-align:center;">Email inviata automaticamente dal Toolkit Pmi 360°</p>
</div></div></body></html>`

    const subject = procedure.length === 1
      ? `Da leggere: ${procedure[0].codice} — ${procedure[0].titolo}`
      : `${procedure.length} procedure da leggere e confermare`

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Toolkit Pmi 360°', email: 'massimocoletta1959@gmail.com' },
        to: [{ email: membro.email, name: `${membro.nome} ${membro.cognome}` }],
        subject,
        htmlContent: html,
      }),
    })
    const brevoData = await brevoRes.json()
    const successo = brevoRes.status === 201

    const idsFiltro = ticket_ids.map((id: string) => `"${id}"`).join(',')
    await fetch(`${supabaseUrl}/rest/v1/ticket?id=in.(${idsFiltro})`, {
      method: 'PATCH',
      headers: { ...dbHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_inviata: true }),
    })
    await fetch(`${supabaseUrl}/rest/v1/notifiche`, {
      method: 'POST',
      headers: { ...dbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(ticket_ids.map((id: string) => ({ ticket_id: id, tipo: 'presa_visione', email_destinatario: membro.email, successo }))),
    })

    return new Response(JSON.stringify({ successo, brevo: brevoData }), { headers })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
})
