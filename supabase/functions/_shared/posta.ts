// Invio delle email del portale. Prima dal server di posta del dominio (Aruba, casella assistenza@pmi360.it, firmata
// DKIM da Aruba): e' il mittente piu' affidabile per i filtri antispam dei provider italiani. Se Aruba non risponde o
// manca la password (secret ARUBA_SMTP_PASSWORD), si usa Brevo come riserva.
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const MITTENTE = { name: 'Pmi 360°', email: 'assistenza@pmi360.it' }
type Destinatario = { email: string; name?: string }
export type EsitoInvio = { ok: boolean; via: 'aruba' | 'brevo' | null; dettaglio?: string }

const indirizzo = (d: Destinatario) => (d.name ? `"${d.name.replace(/"/g, '')}" <${d.email}>` : d.email)

async function viaAruba(to: Destinatario[], subject: string, html: string): Promise<EsitoInvio> {
  const password = Deno.env.get('ARUBA_SMTP_PASSWORD')
  if (!password) return { ok: false, via: 'aruba', dettaglio: 'password SMTP Aruba non configurata' }
  const client = new SMTPClient({
    connection: { hostname: 'smtps.aruba.it', port: 465, tls: true, auth: { username: MITTENTE.email, password } },
  })
  try {
    await client.send({ from: indirizzo(MITTENTE), to: to.map(indirizzo), subject, html, content: 'auto' })
    return { ok: true, via: 'aruba' }
  } catch (e) {
    return { ok: false, via: 'aruba', dettaglio: String((e as Error)?.message || e) }
  } finally {
    try { await client.close() } catch { /* connessione gia' chiusa */ }
  }
}

async function viaBrevo(to: Destinatario[], subject: string, html: string): Promise<EsitoInvio> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': Deno.env.get('BREVO_API_KEY') || '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: MITTENTE, to, subject, htmlContent: html }),
  })
  const testo = await res.text()
  return { ok: res.status === 201, via: 'brevo', dettaglio: res.status === 201 ? undefined : `Brevo ${res.status}: ${testo.slice(0, 200)}` }
}

export async function inviaEmail({ to, subject, html }: { to: Destinatario[]; subject: string; html: string }): Promise<EsitoInvio> {
  const aruba = await viaAruba(to, subject, html)
  console.log('Invio email', JSON.stringify({ via: 'aruba', ok: aruba.ok, dettaglio: aruba.dettaglio, a: to.map((d) => d.email) }))
  if (aruba.ok) return aruba
  const brevo = await viaBrevo(to, subject, html)
  console.log('Invio email', JSON.stringify({ via: 'brevo', ok: brevo.ok, dettaglio: brevo.dettaglio, a: to.map((d) => d.email) }))
  return brevo.ok ? brevo : { ok: false, via: null, dettaglio: `Aruba: ${aruba.dettaglio}; ${brevo.dettaglio}` }
}
