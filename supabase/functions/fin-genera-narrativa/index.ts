// Edge Function: fin-genera-narrativa (modulo Finanza e Controllo di Pmi 360°)
// Portata da EasyPMI (genera-narrativa). In più: solo chi ha accesso ad almeno
// un'azienda con il modulo Finanza può usarla (evita consumi AI da altri utenti).
//
// Riceve un prompt già costruito lato client (src/lib/analisiNarrativa.js,
// porting di backend/api/analisi_narrativa.py::costruisci_prompt) e chiama
// Anthropic tenendo la chiave come secret. Stesso pattern di estrai-documento.

import { createClient } from 'npm:@supabase/supabase-js@2'

import { chiamaClaude, fornitoreConfigurato } from '../_shared/claude.ts'
import { richiedeUtenteAal2 } from '../_shared/mfa.ts'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const MODEL = 'claude-sonnet-5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function puliciJson(testo: string): unknown {
  const t = testo.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
  try {
    return JSON.parse(t)
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1))
    throw new Error('JSON non trovato nella risposta')
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const negato = await richiedeUtenteAal2(req, corsHeaders)
  if (negato) return negato

  if (!fornitoreConfigurato()) {
    return new Response(JSON.stringify({ errore: 'Servizio di intelligenza artificiale non configurato (BEDROCK_API_KEY o ANTHROPIC_API_KEY) su questo progetto Supabase.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const comeUtente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  })
  const { data: aziendeFin } = await comeUtente.rpc('fin_mie_aziende')
  if (!aziendeFin || aziendeFin.length === 0) {
    return new Response(JSON.stringify({ errore: 'Modulo Finanza non attivo per questo utente.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const { prompt } = await req.json()
    if (!prompt || String(prompt).trim().length < 20) {
      return new Response(JSON.stringify({ errore: 'Prompt mancante o troppo corto.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { ok, status, data } = await chiamaClaude({ modello: MODEL, max_tokens: 8192, messages: [{ role: 'user', content: String(prompt) }] })
    if (!ok) {
      return new Response(JSON.stringify({ errore: data?.error?.message || `Errore del servizio di intelligenza artificiale (${status})` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const bloccoTesto = (data?.content || []).find((b: { type?: string }) => b?.type === 'text')
    const testoRisposta = (bloccoTesto as { text?: string } | undefined)?.text || ''

    let dati: unknown
    try {
      dati = puliciJson(testoRisposta)
    } catch {
      const troncato = data?.stop_reason === 'max_tokens' ? ' (risposta troncata: max_tokens raggiunto)' : ''
      const anteprima = testoRisposta.slice(0, 300) || '[nessun blocco di testo nella risposta]'
      return new Response(JSON.stringify({ errore: `Risposta AI non in formato JSON valido${troncato}. Anteprima: ${anteprima}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(dati), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ errore: String((e as Error)?.message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
