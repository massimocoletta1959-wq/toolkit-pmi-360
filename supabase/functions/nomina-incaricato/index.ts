import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Nomina di un incaricato alla gestione di un organo.
// Solo un gestore dell'azienda (o lo Studio) può nominare. Registra la nomina,
// collega la persona all'azienda e le scrive: se non ha ancora un account,
// l'email è anche l'invito a registrarsi (stesso flusso degli inviti esistenti).

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || ''
const APP_URL = 'https://app.pmi360.it'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
const risposta = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  try {
    const { organo_id, membro_id } = await req.json()
    if (!organo_id || !membro_id) return risposta(400, { error: 'Parametri mancanti' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const db = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    const dbJson = { ...db, 'Content-Type': 'application/json' }
    const get = async (path: string) => (await (await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: db })).json())

    // ── Chi chiama: deve essere gestore dell'azienda dell'organo (o lo Studio) ──
    const ur = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { 'apikey': serviceKey, 'Authorization': req.headers.get('Authorization') || '' } })
    const utente = ur.ok ? await ur.json() : null
    if (!utente?.id) return risposta(401, { error: 'Sessione non valida' })

    const organo = (await get(`organi?id=eq.${organo_id}&select=id,nome,tipo,azienda_id`))[0]
    if (!organo) return risposta(404, { error: 'Organo non trovato' })
    const [link, studio] = await Promise.all([
      get(`utente_aziende?utente_id=eq.${utente.id}&azienda_id=eq.${organo.azienda_id}&ruolo=neq.membro&select=id`),
      get(`proprietari?user_id=eq.${utente.id}&select=user_id`),
    ])
    if (!link[0] && !studio[0]) return risposta(403, { error: 'Solo un gestore dell\'azienda può nominare incaricati.' })

    const membro = (await get(`membri?id=eq.${membro_id}&azienda_id=eq.${organo.azienda_id}&select=*`))[0]
    if (!membro) return risposta(404, { error: 'Persona non trovata in anagrafica' })
    if (!membro.email) return risposta(422, { error: 'Alla persona manca l\'email: aggiungila in anagrafica.' })
    const azienda = (await get(`aziende?id=eq.${organo.azienda_id}&select=nome`))[0]

    // ── Nomina (riattiva se era stata revocata) ──
    const nr = await fetch(`${supabaseUrl}/rest/v1/organo_incaricati?on_conflict=organo_id,membro_id`, {
      method: 'POST',
      headers: { ...dbJson, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ azienda_id: organo.azienda_id, organo_id, membro_id, nominato_da: utente.id, data_nomina: new Date().toISOString().slice(0, 10), data_revoca: null }),
    })
    if (!nr.ok) return risposta(500, { error: 'Registrazione della nomina non riuscita' })

    // ── Accesso: già registrato → collegamento all'azienda; altrimenti invito ──
    let ctaUrl = `${APP_URL}?vista=organi`
    let ctaLabel = 'Accedi e gestisci l\'organo →'
    let intro = ''
    if (membro.user_id) {
      await fetch(`${supabaseUrl}/rest/v1/utente_aziende?on_conflict=utente_id,azienda_id`, {
        method: 'POST',
        headers: { ...dbJson, 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ utente_id: membro.user_id, azienda_id: organo.azienda_id, ruolo: 'membro' }),
      })
    } else {
      const token = crypto.randomUUID().replace(/-/g, '')
      await fetch(`${supabaseUrl}/rest/v1/inviti`, {
        method: 'POST',
        headers: { ...dbJson, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ azienda_id: organo.azienda_id, membro_id, email: membro.email, token }),
      })
      ctaUrl = `${APP_URL}?invito=${token}`
      ctaLabel = 'Registrati e accedi →'
      intro = `<p style="color:#555;">Per iniziare devi registrarti al portale (ci vuole un minuto): una volta dentro troverai l'organo nella voce <strong>«I miei organi»</strong>.</p>`
    }

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#F7F8FA;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
<div style="background:#1A3A5C;padding:24px 32px;text-align:center;"><div style="font-size:28px;">⚖️</div>
<h1 style="color:white;margin:8px 0 0;font-size:18px;">Toolkit Pmi 360°</h1></div>
<div style="padding:32px;">
<p style="color:#555;">Ciao <strong>${membro.nome || ''} ${membro.cognome || ''}</strong>,</p>
<p style="color:#555;"><strong>${azienda?.nome || ''}</strong> ti ha nominato <strong>incaricato della gestione</strong> dell'organo <strong>${organo.nome}</strong>.</p>
<p style="color:#555;">Potrai gestirlo in autonomia: componenti, convocazioni e ordine del giorno, presenze, delibere e votazioni, verbali e relativi modelli.</p>
${intro}
<div style="text-align:center;margin:24px 0;">
<a href="${ctaUrl}" style="background:#2B5FA5;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${ctaLabel}</a>
</div>
<p style="font-size:11px;color:#aaa;text-align:center;">Oppure copia: <a href="${ctaUrl}">${ctaUrl}</a></p>
</div></div></body></html>`

    const br = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Toolkit Pmi 360°', email: 'massimocoletta1959@gmail.com' },
        to: [{ email: membro.email, name: `${membro.nome || ''} ${membro.cognome || ''}`.trim() }],
        subject: `Incarico: gestione di ${organo.nome} — ${azienda?.nome || ''}`,
        htmlContent: html,
      }),
    })
    return risposta(200, { successo: true, email_inviata: br.status === 201, registrato: !!membro.user_id })
  } catch (err) {
    console.error('Errore:', (err as Error).message)
    return risposta(500, { error: (err as Error).message })
  }
})
