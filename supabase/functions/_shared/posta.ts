// Invio delle email del portale (`inviaEmail`): Amazon SES a Francoforte (dominio pmi360.it verificato, DKIM e MAIL FROM
// mail.pmi360.it), con Brevo di riserva. SES arriva anche ai provider (es. MC-link) che trattengono le email di Brevo.
//
// Rimane, spento, l'invio dalla casella Aruba assistenza@pmi360.it (SMTP/IMAP scritti sopra Deno.connectTls, con copia
// in Posta inviata dalla funzione copia-posta-inviata): Aruba sospende la casella per gli accessi dai server cloud
// (14/10/2026). Si riattiva solo con il secret ARUBA_INVIO_ATTIVO=si.

import { firmaSigV4 } from './claude.ts'

const MITTENTE = { name: 'Pmi 360°', email: 'assistenza@pmi360.it' }
type Destinatario = { email: string; name?: string }
export type EsitoInvio = { ok: boolean; via: 'ses' | 'aruba' | 'brevo' | null; dettaglio?: string }

const enc = new TextEncoder()
const dec = new TextDecoder()
const b64 = (t: string) => { let s = ''; for (const x of enc.encode(t)) s += String.fromCharCode(x); return btoa(s) }
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

// connessione TLS con lettura "fino a" una condizione, con limite di tempo
async function connessione(hostname: string, port: number) {
  const conn = await Deno.connectTls({ hostname, port })
  let buffer = ''
  const leggiFino = async (fine: (b: string) => boolean) => {
    const pezzo = new Uint8Array(16384)
    const limite = Date.now() + 20000
    while (!fine(buffer)) {
      if (Date.now() > limite) throw new Error(`timeout ${hostname}`)
      const n = await conn.read(pezzo)
      if (n === null) throw new Error(`connessione chiusa da ${hostname}`)
      buffer += dec.decode(pezzo.subarray(0, n))
    }
    const r = buffer; buffer = ''; return r
  }
  const scrivi = (t: string | Uint8Array) => conn.write(typeof t === 'string' ? enc.encode(t) : t)
  return { conn, leggiFino, scrivi }
}

// ---- SMTP (smtps.aruba.it:465) ----
// risposta completa SMTP: ultima riga "NNN " (le righe intermedie sono "NNN-")
const rispostaSmtp = (b: string) => /(^|\r\n)\d{3} [^\r\n]*\r\n$/.test(b)
async function viaAruba(to: Destinatario[], raw: string): Promise<EsitoInvio> {
  const password = Deno.env.get('ARUBA_SMTP_PASSWORD')
  if (!password) return { ok: false, via: 'aruba', dettaglio: 'password SMTP Aruba non configurata' }
  let c: Awaited<ReturnType<typeof connessione>> | null = null
  try {
    c = await connessione('smtps.aruba.it', 465)
    const passo = async (comando: string | null, attesi: string[]) => {
      if (comando !== null) await c!.scrivi(comando + '\r\n')
      const r = await c!.leggiFino(rispostaSmtp)
      const codice = r.trim().split('\r\n').pop()!.slice(0, 3)
      if (!attesi.includes(codice)) throw new Error(`${(comando || 'connessione').split(' ')[0]}: ${r.trim().split('\r\n').pop()}`)
    }
    await passo(null, ['220'])
    await passo('EHLO pmi360.it', ['250'])
    await passo('AUTH PLAIN ' + b64(`\u0000${MITTENTE.email}\u0000${password}`), ['235'])
    await passo(`MAIL FROM:<${MITTENTE.email}>`, ['250'])
    for (const d of to) await passo(`RCPT TO:<${d.email}>`, ['250', '251'])
    await passo('DATA', ['354'])
    // dot-stuffing: una riga che inizia con "." si raddoppia
    await c.scrivi(raw.replace(/\r\n\./g, '\r\n..') + '\r\n.\r\n')
    await passo(null, ['250'])
    try { await passo('QUIT', ['221']) } catch { /* il server chiude */ }
    return { ok: true, via: 'aruba' }
  } catch (e) {
    return { ok: false, via: 'aruba', dettaglio: String((e as Error)?.message || e) }
  } finally {
    try { c?.conn.close() } catch { /* gia' chiusa */ }
  }
}

// ---- copia in "Posta inviata" (IMAP APPEND su imaps.aruba.it:993) ----
const quota = (t: string) => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
export async function copiaInPostaInviata(raw: string): Promise<{ ok: boolean; cartella?: string; dettaglio?: string }> {
  const password = Deno.env.get('ARUBA_SMTP_PASSWORD')
  if (!password) return { ok: false, dettaglio: 'password non configurata' }
  let c: Awaited<ReturnType<typeof connessione>> | null = null
  try {
    c = await connessione('imaps.aruba.it', 993)
    const comando = async (tag: string, testo: string) => {
      await c!.scrivi(`${tag} ${testo}\r\n`)
      const r = await c!.leggiFino((b) => new RegExp(`(^|\\r\\n)${tag} (OK|NO|BAD)`).test(b))
      if (!new RegExp(`(^|\\r\\n)${tag} OK`).test(r)) throw new Error(`${testo.split(' ')[0]}: ${r.split('\r\n').filter(Boolean).pop()}`)
      return r
    }
    await c.leggiFino((b) => b.includes('\r\n'))
    await comando('a1', `LOGIN ${quota(MITTENTE.email)} ${quota(password)}`)
    const elenco = await comando('a2', 'LIST "" "*"')
    const cartelle = [...elenco.matchAll(/\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (?:"((?:[^"\\]|\\.)*)"|(\S+))/g)].map((m) => ({ attributi: m[1], nome: m[2] ?? m[3] }))
    const inviata = cartelle.find((x) => /\\Sent/i.test(x.attributi)) || cartelle.find((x) => /(^|[./])(Sent|Inviat|Posta inviata)/i.test(x.nome))
    if (!inviata) throw new Error('cartella della posta inviata non trovata: ' + cartelle.map((x) => x.nome).join(', '))
    const dati = enc.encode(raw)
    await c.scrivi(`a3 APPEND ${quota(inviata.nome)} (\\Seen) {${dati.length}}\r\n`)
    const cont = await c.leggiFino((b) => /(^|\r\n)\+/.test(b) || /(^|\r\n)a3 (NO|BAD)/.test(b))
    if (!/(^|\r\n)\+/.test(cont)) throw new Error('APPEND rifiutato: ' + cont.trim())
    await c.scrivi(dati)
    await c.scrivi('\r\n')
    const fine = await c.leggiFino((b) => /(^|\r\n)a3 (OK|NO|BAD)/.test(b))
    if (!/(^|\r\n)a3 OK/.test(fine)) throw new Error('APPEND: ' + fine.trim())
    try { await comando('a4', 'LOGOUT') } catch { /* il server chiude */ }
    return { ok: true, cartella: inviata.nome }
  } catch (e) {
    return { ok: false, dettaglio: String((e as Error)?.message || e) }
  } finally {
    try { c?.conn.close() } catch { /* gia' chiusa */ }
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

// ---- Amazon SES (eu-central-1), dominio pmi360.it verificato con DKIM e MAIL FROM mail.pmi360.it ----
// Stesse chiavi dell'utente IAM del portale usate per Bedrock (secret BEDROCK_ACCESS_KEY_ID / _SECRET_ACCESS_KEY).
async function viaSes(to: Destinatario[], subject: string, html: string): Promise<EsitoInvio> {
  const accessKeyId = Deno.env.get('SES_ACCESS_KEY_ID') || Deno.env.get('BEDROCK_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('SES_SECRET_ACCESS_KEY') || Deno.env.get('BEDROCK_SECRET_ACCESS_KEY')
  if (!accessKeyId || !secretAccessKey) return { ok: false, via: 'ses', dettaglio: 'chiavi AWS non configurate' }
  const regione = Deno.env.get('SES_REGIONE') || 'eu-central-1'
  const url = `https://email.${regione}.amazonaws.com/v2/email/outbound-emails`
  const body = JSON.stringify({
    FromEmailAddress: conNome(MITTENTE),
    Destination: { ToAddresses: to.map(conNome) },
    Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Html: { Data: html, Charset: 'UTF-8' } } } },
  })
  try {
    const headers = await firmaSigV4({ url, body, regione, accessKeyId, secretAccessKey, servizio: 'ses' })
    const r = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(20000) })
    const testo = await r.text()
    return r.ok ? { ok: true, via: 'ses', dettaglio: testo.slice(0, 120) } : { ok: false, via: 'ses', dettaglio: `SES ${r.status}: ${testo.slice(0, 200)}` }
  } catch (e) {
    return { ok: false, via: 'ses', dettaglio: String((e as Error)?.message || e) }
  }
}

// la copia la fa un'altra funzione (con un suo limite di calcolo); se non riesce l'email e' comunque partita
async function chiediCopia(raw: string) {
  try {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/copia-posta-inviata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-chiave-servizio': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '' },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(25000),
    })
    console.log('Copia in posta inviata', r.status, (await r.text()).slice(0, 200))
  } catch (e) {
    console.log('Copia in posta inviata non riuscita', String(e))
  }
}

// Aruba sospende l'invio dalla casella quando vede accessi SMTP/IMAP dai server cloud di Supabase (IP sempre diversi:
// "accessi sospetti", poi "525 Invio temporaneamente disabilitato", 14/10/2026). Finche' non c'e' un servizio di invio
// adatto ai server (es. Amazon SES) l'invio da Aruba resta spento: si attiva solo con il secret ARUBA_INVIO_ATTIVO=si.
const arubaAttivo = () => Deno.env.get('ARUBA_INVIO_ATTIVO') === 'si'

export async function inviaEmail({ to, subject, html }: { to: Destinatario[]; subject: string; html: string }): Promise<EsitoInvio> {
  if (!arubaAttivo()) {
    // Amazon SES, poi Brevo di riserva (es. SES ancora in modalita' di prova: rifiuta gli indirizzi non verificati)
    const ses = await viaSes(to, subject, html)
    console.log('Invio email', JSON.stringify({ via: 'ses', ok: ses.ok, dettaglio: ses.dettaglio, a: to.map((d) => d.email) }))
    if (ses.ok) return ses
    const brevo = await viaBrevo(to, subject, html)
    console.log('Invio email', JSON.stringify({ via: 'brevo', ok: brevo.ok, dettaglio: brevo.dettaglio, a: to.map((d) => d.email) }))
    return brevo.ok ? { ...brevo, dettaglio: `riserva Brevo, SES non riuscito: ${ses.dettaglio}` } : { ok: false, via: null, dettaglio: `SES: ${ses.dettaglio}; ${brevo.dettaglio}` }
  }
  const raw = messaggioRfc822(to, subject, html)
  const aruba = await viaAruba(to, raw)
  console.log('Invio email', JSON.stringify({ via: 'aruba', ok: aruba.ok, dettaglio: aruba.dettaglio, a: to.map((d) => d.email) }))
  if (aruba.ok) {
    await chiediCopia(raw)
    return aruba
  }
  const brevo = await viaBrevo(to, subject, html)
  console.log('Invio email', JSON.stringify({ via: 'brevo', ok: brevo.ok, dettaglio: brevo.dettaglio, a: to.map((d) => d.email) }))
  return brevo.ok ? { ...brevo, dettaglio: `riserva Brevo, Aruba non riuscito: ${aruba.dettaglio}` } : { ok: false, via: null, dettaglio: `Aruba: ${aruba.dettaglio}; ${brevo.dettaglio}` }
}
