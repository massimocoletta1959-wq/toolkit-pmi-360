// Chiamata ai modelli Claude, condivisa dalle funzioni che usano l'intelligenza artificiale
// (extract-visura, fin-estrai-documento, fin-genera-narrativa).
//
// Dove viene elaborato il contenuto:
//  - se e' configurato BEDROCK_API_KEY -> Amazon Bedrock nell'Unione europea (regione BEDROCK_REGIONE, default
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

export function fornitoreConfigurato(): 'bedrock-ue' | 'anthropic' | null {
  if (Deno.env.get('BEDROCK_API_KEY')) return 'bedrock-ue'
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
  const chiaveBedrock = Deno.env.get('BEDROCK_API_KEY')
  if (chiaveBedrock) {
    const regione = Deno.env.get('BEDROCK_REGIONE') || 'eu-central-1'
    const url = `https://bedrock-runtime.${regione}.amazonaws.com/model/${encodeURIComponent(modelloBedrock(r.modello))}/invoke`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chiaveBedrock}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', max_tokens: r.max_tokens, messages: r.messages }),
    })
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
