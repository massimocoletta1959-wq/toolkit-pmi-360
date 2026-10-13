// Invio delle email del portale (con copia nella cartella della posta inviata della casella). Prima dal server di posta del dominio (Aruba, casella assistenza@pmi360.it, firmata
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

// ---- copia in "Posta inviata" della casella (IMAP APPEND su imaps.aruba.it) ----
// L'invio SMTP non salva nulla nella cartella della posta inviata: lo fa questo passaggio, dopo l'invio. Se non
// riesce l'email e' comunque partita (si registra solo nel log).
const b64 = (t: string) => { const b = new TextEncoder().encode(t); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s) }
const intestazione = (t: string) => (/^[\x20-\x7e]*$/.test(t) ? t : `=?UTF-8?B?${b64(t)}?=`)
const conNome = (d: Destinatario) => (d.name ? `${intestazione(d.name.replace(/"/g, ''))} <${d.email}>` : d.email)
const aCapo = (t: string) => t.replace(/.{1,76}/g, '$&\r\n')

export function messaggioRfc822(to: Destinatario[], subject: string, html: string): string {
  return [
    `From: ${conNome(MITTENTE)}`,
    `To: ${to.map(conNome).join(', ')}`,
    `Subject: ${intestazione(subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@pmi360.it>`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    aCapo(b64(html)),
  ].join('\r\n')
}

const quota = (t: string) => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

export async function copiaInPostaInviata(to: Destinatario[], subject: string, html: string): Promise<{ ok: boolean; cartella?: string; dettaglio?: string }> {
  const password = Deno.env.get('ARUBA_SMTP_PASSWORD')
  if (!password) return { ok: false, dettaglio: 'password non configurata' }
  const conn = await Deno.connectTls({ hostname: 'imaps.aruba.it', port: 993 })
  const enc = new TextEncoder()
  const dec = new TextDecoder()
  let buffer = ''
  const leggiFino = async (fine: (b: string) => boolean) => {
    const pezzo = new Uint8Array(16384)
    const limite = Date.now() + 20000
    while (!fine(buffer)) {
      if (Date.now() > limite) throw new Error('timeout IMAP')
      const n = await conn.read(pezzo)
      if (n === null) throw new Error('connessione IMAP chiusa')
      buffer += dec.decode(pezzo.subarray(0, n))
    }
    const r = buffer; buffer = ''; return r
  }
  const comando = async (tag: string, testo: string) => {
    await conn.write(enc.encode(`${tag} ${testo}\r\n`))
    const r = await leggiFino((b) => new RegExp(`(^|\\r\\n)${tag} (OK|NO|BAD)`).test(b))
    if (!new RegExp(`(^|\\r\\n)${tag} OK`).test(r)) throw new Error(`${testo.split(' ')[0]}: ${r.split('\r\n').filter(Boolean).pop()}`)
    return r
  }
  try {
    await leggiFino((b) => b.includes('\r\n'))
    await comando('a1', `LOGIN ${quota(MITTENTE.email)} ${quota(password)}`)
    const elenco = await comando('a2', 'LIST "" "*"')
    const cartelle = [...elenco.matchAll(/\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (?:"((?:[^"\\]|\\.)*)"|(\S+))/g)].map((m) => ({ attributi: m[1], nome: m[2] ?? m[3] }))
    const inviata = cartelle.find((c) => /\\Sent/i.test(c.attributi)) || cartelle.find((c) => /(^|[./])(Sent|Inviat|Posta inviata)/i.test(c.nome))
    if (!inviata) throw new Error('cartella della posta inviata non trovata: ' + cartelle.map((c) => c.nome).join(', '))
    const dati = enc.encode(messaggioRfc822(to, subject, html))
    await conn.write(enc.encode(`a3 APPEND ${quota(inviata.nome)} (\\Seen) {${dati.length}}\r\n`))
    const cont = await leggiFino((b) => /(^|\r\n)\+/.test(b) || /(^|\r\n)a3 (NO|BAD)/.test(b))
    if (!/(^|\r\n)\+/.test(cont)) throw new Error('APPEND rifiutato: ' + cont.trim())
    await conn.write(dati)
    await conn.write(enc.encode('\r\n'))
    const fine = await leggiFino((b) => /(^|\r\n)a3 (OK|NO|BAD)/.test(b))
    if (!/(^|\r\n)a3 OK/.test(fine)) throw new Error('APPEND: ' + fine.trim())
    try { await comando('a4', 'LOGOUT') } catch { /* il server chiude */ }
    return { ok: true, cartella: inviata.nome }
  } catch (e) {
    return { ok: false, dettaglio: String((e as Error)?.message || e) }
  } finally {
    try { conn.close() } catch { /* gia' chiusa */ }
  }
}

export async function inviaEmail({ to, subject, html }: { to: Destinatario[]; subject: string; html: string }): Promise<EsitoInvio> {
  const aruba = await viaAruba(to, subject, html)
  console.log('Invio email', JSON.stringify({ via: 'aruba', ok: aruba.ok, dettaglio: aruba.dettaglio, a: to.map((d) => d.email) }))
  if (aruba.ok) {
    const copia = await copiaInPostaInviata(to, subject, html).catch((e) => ({ ok: false, dettaglio: String(e) }))
    console.log('Copia in posta inviata', JSON.stringify(copia))
    return aruba
  }
  const brevo = await viaBrevo(to, subject, html)
  console.log('Invio email', JSON.stringify({ via: 'brevo', ok: brevo.ok, dettaglio: brevo.dettaglio, a: to.map((d) => d.email) }))
  return brevo.ok ? brevo : { ok: false, via: null, dettaglio: `Aruba: ${aruba.dettaglio}; ${brevo.dettaglio}` }
}
