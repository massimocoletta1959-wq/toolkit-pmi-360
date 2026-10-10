// Chiamata ai modelli Claude, condivisa dalle funzioni che usano l'intelligenza artificiale
// (extract-visura, fin-estrai-documento, fin-genera-narrativa).
//
// Dove viene elaborato il contenuto:
//  - se sono configurate le credenziali Bedrock (chiavi IAM BEDROCK_ACCESS_KEY_ID/BEDROCK_SECRET_ACCESS_KEY, firma
//    SigV4, oppure chiave API BEDROCK_API_KEY) -> Amazon Bedrock nell'Unione europea (regione BEDROCK_REGIONE, default
//    eu-central-1 Francoforte, con profilo di inferenza "eu.": l'elaborazione resta nelle regioni UE);
//  - altrimenti -> API Anthropic (Stati Uniti), con ANTHROPIC_API_KEY.
// Con Bedrock configurato NON si ripiega mai su Anthropic: se Bedrock non risponde la funzione da' errore, cosi'
// nessun documento esce dall'UE senza che lo si sappia.
//
// Modelli su Bedrock: identificativi dei profili di inferenza UE nei secret
//   BEDROCK_MODELLO_PRINCIPALE (al posto di claude-sonnet-*) e BEDROCK_MODELLO_VELOCE (al posto di claude-haiku-*).

type Messaggio = { role: 'user' | 'assistant'; content: unknown }

export type RichiestaClaude = {
  modello: string // nome del modello sull'API Anthropic (es. 'claude-sonnet-5')
  max_tokens: number
  messages: Messaggio[]
}

export type RispostaClaude = {
  ok: boolean
  status: number
  data: { content?: { type?: string; text?: string }[]; stop_reason?: string; error?: { message?: string } } & Record<string, unknown>
  fornitore: 'bedrock-ue' | 'anthropic'
}

// Credenziali Bedrock: chiave API (BEDROCK_API_KEY, header Bearer) oppure chiavi di accesso di un utente IAM
// (BEDROCK_ACCESS_KEY_ID + BEDROCK_SECRET_ACCESS_KEY, firma AWS Signature V4).
function credenzialiBedrock() {
  const apiKey = Deno.env.get('BEDROCK_API_KEY')
  const accessKeyId = Deno.env.get('BEDROCK_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('BEDROCK_SECRET_ACCESS_KEY')
  if (accessKeyId && secretAccessKey) return { accessKeyId, secretAccessKey }
  if (apiKey) return { apiKey }
  return null
}

const enc = new TextEncoder()
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)))
async function hmac(chiave: ArrayBuffer | Uint8Array, s: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', chiave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(s))
}

// Firma AWS Signature V4 per una POST JSON a Bedrock. Per i servizi diversi da S3 il percorso canonico ha ogni
// segmento codificato due volte (l'id del modello contiene ':' -> '%3A' nell'URL -> '%253A' nella firma).
export async function firmaSigV4(p: { url: string; body: string; regione: string; accessKeyId: string; secretAccessKey: string; adesso?: Date }) {
  const u = new URL(p.url)
  const amzDate = (p.adesso || new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const giorno = amzDate.slice(0, 8)
  const percorso = u.pathname.split('/').map((seg) => encodeURIComponent(seg)).join('/')
  const intestazioni = `content-type:application/json\nhost:${u.host}\nx-amz-date:${amzDate}\n`
  const firmate = 'content-type;host;x-amz-date'
  const richiesta = ['POST', percorso, '', intestazioni, firmate, await sha256(p.body)].join('\n')
  const ambito = `${giorno}/${p.regione}/bedrock/aws4_request`
  const daFirmare = ['AWS4-HMAC-SHA256', amzDate, ambito, await sha256(richiesta)].join('\n')
  let k = await hmac(enc.encode(`AWS4${p.secretAccessKey}`), giorno)
  k = await hmac(k, p.regione)
  k = await hmac(k, 'bedrock')
  k = await hmac(k, 'aws4_request')
  const firma = hex(await hmac(k, daFirmare))
  return {
    'content-type': 'application/json',
    'x-amz-date': amzDate,
    Authorization: `AWS4-HMAC-SHA256 Credential=${p.accessKeyId}/${ambito}, SignedHeaders=${firmate}, Signature=${firma}`,
  }
}

export function fornitoreConfigurato(): 'bedrock-ue' | 'anthropic' | null {
  if (credenzialiBedrock()) return 'bedrock-ue'
  if (Deno.env.get('ANTHROPIC_API_KEY')) return 'anthropic'
  return null
}

function modelloBedrock(modello: string): string {
  const veloce = /haiku/i.test(modello)
  const id = Deno.env.get(veloce ? 'BEDROCK_MODELLO_VELOCE' : 'BEDROCK_MODELLO_PRINCIPALE')
  if (!id) throw new Error(`Secret ${veloce ? 'BEDROCK_MODELLO_VELOCE' : 'BEDROCK_MODELLO_PRINCIPALE'} non configurato su questo progetto Supabase.`)
  return id
}

export async function chiamaClaude(r: RichiestaClaude): Promise<RispostaClaude> {
  const cred = credenzialiBedrock()
  if (cred) {
    const regione = Deno.env.get('BEDROCK_REGIONE') || 'eu-central-1'
    const url = `https://bedrock-runtime.${regione}.amazonaws.com/model/${encodeURIComponent(modelloBedrock(r.modello))}/invoke`
    const body = JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', max_tokens: r.max_tokens, messages: r.messages })
    const headers = 'apiKey' in cred
      ? { Authorization: `Bearer ${cred.apiKey}`, 'content-type': 'application/json' }
      : await firmaSigV4({ url, body, regione, accessKeyId: cred.accessKeyId as string, secretAccessKey: cred.secretAccessKey as string })
    const resp = await fetch(url, { method: 'POST', headers, body })
    const testo = await resp.text()
    let data: RispostaClaude['data']
    try {
      data = JSON.parse(testo)
    } catch {
      data = {}
    }
    // Bedrock restituisce gli errori come { message } (o { Message }): li si porta nella forma di Anthropic
    if (!resp.ok) {
      const msg = (data as Record<string, unknown>).message || (data as Record<string, unknown>).Message || testo.slice(0, 300)
      data = { error: { message: `Amazon Bedrock (UE) ${resp.status}: ${msg}` } }
    }
    return { ok: resp.ok, status: resp.status, data, fornitore: 'bedrock-ue' }
  }

  const chiaveAnthropic = Deno.env.get('ANTHROPIC_API_KEY')
  if (!chiaveAnthropic) throw new Error('Nessun servizio di intelligenza artificiale configurato (BEDROCK_API_KEY o ANTHROPIC_API_KEY).')
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': chiaveAnthropic, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: r.modello, max_tokens: r.max_tokens, messages: r.messages }),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok && !data?.error?.message) data.error = { message: `Errore Anthropic API (${resp.status})` }
  return { ok: resp.ok, status: resp.status, data, fornitore: 'anthropic' }
}
