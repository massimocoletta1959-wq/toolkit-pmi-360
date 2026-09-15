import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || ''
const APP_URL = 'https://massimocoletta1959-wq.github.io/toolkit-pmi-360'

serve(async (req) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  try {
    const { ticket_id, tipo } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    const ticketRes = await fetch(
      `${supabaseUrl}/rest/v1/ticket?id=eq.${ticket_id}&select=*,membri(*),rischi(*),azioni(*)`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    const tickets = await ticketRes.json()
    const ticket = tickets[0]
    if (!ticket || !ticket.membri?.email) return new Response(JSON.stringify({ error: 'Ticket o membro non trovato' }), { status: 404, headers })

    const membro = ticket.membri
    const isReminder = tipo === 'reminder'
    const scadenzaFormatted = ticket.scadenza ? new Date(ticket.scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Non definita'
    const prioritaColor = { 'Alta': '#C0392B', 'Media': '#E67E22', 'Bassa': '#27AE60' }[ticket.priorita] || '#666'
    const subject = isReminder ? `Promemoria scadenza: ${ticket.titolo}` : `Nuovo task assegnato: ${ticket.titolo}`

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#F7F8FA;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
<div style="background:#1A3A5C;padding:24px 32px;text-align:center;"><div style="font-size:28px;">🛡️</div>
<h1 style="color:white;margin:8px 0 0;font-size:18px;">Toolkit Pmi 360°</h1></div>
<div style="padding:32px;">
${isReminder ? '<div style="background:#FEF9E7;border:1px solid #FAC775;border-radius:8px;padding:12px 16px;margin-bottom:20px;"><strong style="color:#856404;">⏰ Promemoria scadenza</strong></div>' : ''}
<p style="color:#555;">Ciao <strong>${membro.nome} ${membro.cognome}</strong>,<br>${isReminder ? 'ti ricordiamo che hai un task in scadenza:' : 'ti è stato assegnato un nuovo task:'}</p>
<div style="border:1px solid #E0E0E0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
<div style="background:#F7F8FA;padding:16px 20px;border-bottom:1px solid #E0E0E0;">
<h2 style="margin:0;font-size:16px;color:#1A3A5C;">${ticket.titolo}</h2>
<div style="margin-top:8px;">
<span style="font-size:12px;padding:3px 8px;border-radius:20px;background:${prioritaColor}22;color:${prioritaColor};font-weight:600;margin-right:8px;">Priorità: ${ticket.priorita}</span>
<span style="font-size:12px;padding:3px 8px;border-radius:20px;background:#E6F1FB;color:#0C447C;font-weight:600;">Scadenza: ${scadenzaFormatted}</span>
</div></div>
<div style="padding:16px 20px;">
${ticket.rischi ? `<p style="margin:0 0 12px;font-size:13px;color:#888;"><strong>Rischio:</strong> ${ticket.rischi.descrizione}</p>` : ''}
${ticket.istruzioni ? `<p style="margin:0;font-size:13px;color:#444;line-height:1.6;"><strong>Istruzioni:</strong><br>${ticket.istruzioni.replace(/\n/g, '<br>')}</p>` : ''}
</div></div>
<div style="text-align:center;margin-bottom:24px;">
<a href="${APP_URL}" style="display:inline-block;background:#2B5FA5;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Apri il portale →</a>
</div>
<p style="font-size:12px;color:#aaa;text-align:center;">Email inviata automaticamente dal Toolkit Pmi 360°</p>
</div></div></body></html>`

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

    await fetch(`${supabaseUrl}/rest/v1/ticket?id=eq.${ticket_id}`, {
      method: 'PATCH',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(isReminder ? { reminder_inviato: true } : { email_inviata: true }),
    })

    await fetch(`${supabaseUrl}/rest/v1/notifiche`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ ticket_id, tipo, email_destinatario: membro.email, successo }),
    })

    return new Response(JSON.stringify({ successo, brevo: brevoData }), { headers })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
})
