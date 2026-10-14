// Edge Function: copia-posta-inviata — salva un messaggio gia' spedito nella cartella della posta inviata della casella
// assistenza@pmi360.it (IMAP su Aruba). La chiamano solo le altre funzioni del portale, dopo l'invio (vedi
// _shared/posta.ts): accetta solo la chiave di servizio. E' separata dall'invio perche' ogni funzione ha un suo
// limite di calcolo.
import { copiaInPostaInviata } from '../_shared/posta.ts'

Deno.serve(async (req) => {
  const chiave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!chiave || req.headers.get('x-chiave-servizio') !== chiave) return new Response('Non autorizzato', { status: 401 })
  try {
    const { raw } = await req.json()
    if (typeof raw !== 'string' || !raw || raw.length > 5_000_000) return new Response('Messaggio mancante', { status: 400 })
    const esito = await copiaInPostaInviata(raw)
    return new Response(JSON.stringify(esito), { status: esito.ok ? 200 : 500, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, dettaglio: String(e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
