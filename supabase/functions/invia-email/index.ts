import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { richiedeUtenteAal2 } from '../_shared/mfa.ts'
import { inviaEmail } from '../_shared/posta.ts'

const APP_URL = 'https://app.pmi360.it'

serve(async (req) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  const negato = await richiedeUtenteAal2(req, headers)
  if (negato) return negato
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
    // chi chiama deve poter vedere il ticket (stesse regole di accesso del database); la chiave di servizio
    // (promemoria pianificati) e' gia' stata ammessa da richiedeUtenteAal2
    const authUtente = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (authUtente !== supabaseKey) {
      const vis = await fetch(`${supabaseUrl}/rest/v1/ticket?id=eq.${ticket_id}&select=id`, {
        headers: { 'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '', 'Authorization': `Bearer ${authUtente}` },
      })
      const visibili = vis.ok ? await vis.json() : []
      if (!Array.isArray(visibili) || visibili.length === 0) return new Response(JSON.stringify({ error: 'Ticket non accessibile' }), { status: 403, headers })
    }
    if (!ticket || !ticket.membri?.email) return new Response(JSON.stringify({ error: 'Ticket o membro non trovato' }), { status: 404, headers })

    const membro = ticket.membri
    const isReminder = tipo === 'reminder'
    // incarico ritirato: il ticket sta per essere cancellato dal gestore; il membro viene avvisato con i dettagli
    const isRitiro = tipo === 'ritirato'
    // atti e allegati inviati in presa visione (istantanea sul ticket): elencati, si aprono solo nel portale
    const documenti = Array.isArray(ticket.documenti?.atti) ? ticket.documenti.atti : []
    const esc = (t: string) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const scadenzaFormatted = ticket.scadenza ? new Date(ticket.scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Non definita'
    const prioritaColor = { 'Alta': '#C0392B', 'Media': '#E67E22', 'Bassa': '#27AE60' }[ticket.priorita] || '#666'
    const subject = isRitiro ? `Incarico ritirato: ${ticket.titolo}` : isReminder ? `Promemoria scadenza: ${ticket.titolo}` : `Nuovo task assegnato: ${ticket.titolo}`

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#F7F8FA;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
<div style="background:#1A3A5C;padding:24px 32px;text-align:center;"><div style="font-size:28px;">🛡️</div>
<h1 style="color:white;margin:8px 0 0;font-size:18px;">Pmi 360°</h1></div>
<div style="padding:32px;">
${isRitiro ? '<div style="background:#FADBD8;border:1px solid #F1948A;border-radius:8px;padding:12px 16px;margin-bottom:20px;"><strong style="color:#922B21;">Incarico ritirato</strong></div>' : ''}
${isReminder ? '<div style="background:#FEF9E7;border:1px solid #FAC775;border-radius:8px;padding:12px 16px;margin-bottom:20px;"><strong style="color:#856404;">⏰ Promemoria scadenza</strong></div>' : ''}
<p style="color:#555;">Ciao <strong>${membro.nome} ${membro.cognome}</strong>,<br>${isRitiro ? 'il task qui sotto, che ti era stato assegnato, è stato <strong>ritirato</strong>: non devi più occupartene e non lo troverai più nel portale.' : isReminder ? 'ti ricordiamo che hai un task in scadenza:' : 'ti è stato assegnato un nuovo task:'}</p>
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
${documenti.length ? `<p style="margin:12px 0 4px;font-size:13px;color:#444;"><strong>Documenti da esaminare</strong> (si aprono nel portale, in «I miei task»):</p><ul style="margin:0;padding-left:18px;font-size:13px;color:#444;line-height:1.6;">${documenti.map((d: any) => `<li>${esc(d.oggetto)}${d.allegati?.length ? ` — testo e ${d.allegati.length} allegati` : ' — testo'}</li>`).join('')}</ul>` : ''}
</div></div>
${isRitiro ? '<p style="color:#555;font-size:13px;">Per chiarimenti rivolgiti a chi ti aveva assegnato il task.</p>' : `<div style="text-align:center;margin-bottom:24px;">
<a href="${APP_URL}" style="display:inline-block;background:#2B5FA5;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Apri il portale →</a>
</div>`}
<p style="font-size:12px;color:#aaa;text-align:center;">Email inviata automaticamente da Pmi 360°</p>
</div></div></body></html>`

    const esito = await inviaEmail({
        to: [{ email: membro.email, name: `${membro.nome} ${membro.cognome}` }],
        subject,
        html: html,
    })

    const successo = esito.ok

    if (!isRitiro) await fetch(`${supabaseUrl}/rest/v1/ticket?id=eq.${ticket_id}`, {
      method: 'PATCH',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(isReminder ? { reminder_inviato: true } : { email_inviata: true }),
    })

    await fetch(`${supabaseUrl}/rest/v1/notifiche`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ ticket_id, tipo, email_destinatario: membro.email, successo }),
    })

    return new Response(JSON.stringify({ successo, invio: esito }), { headers })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
})
