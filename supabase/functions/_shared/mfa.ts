// Controllo comune delle funzioni chiamate dal portale: la richiesta deve venire da un utente autenticato che
// ha completato la verifica in due passaggi (sessione aal2) oppure non e' tenuto a usarla (membro operativo),
// con la stessa regola del database (controllo_mfa).
// Le chiamate interne con la chiave di servizio (es. promemoria pianificati) restano ammesse.
// Il token viene sempre validato presso il servizio di autenticazione, anche per le funzioni pubblicate senza
// verifica automatica del JWT.

function payload(token: string): Record<string, unknown> | null {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(parte + '='.repeat((4 - (parte.length % 4)) % 4)))
  } catch {
    return null
  }
}

export async function richiedeUtenteAal2(req: Request, cors: Record<string, string>): Promise<Response | null> {
  const rifiuta = (status: number, errore: string) =>
    new Response(JSON.stringify({ error: errore, errore }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  // chiamate interne con la chiave di servizio (vecchio formato JWT o nuovo formato sb_secret_...)
  const servizio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (token && servizio && token === servizio) return null
  const p = token ? payload(token) : null
  if (!p) return rifiuta(401, 'Accesso richiesto')
  if (p.role !== 'authenticated') return rifiuta(401, 'Accesso richiesto')

  const url = Deno.env.get('SUPABASE_URL') || ''
  const chiave = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: chiave, Authorization: `Bearer ${token}` } })
  if (!r.ok) return rifiuta(401, 'Sessione non valida o scaduta: accedi di nuovo')
  if (p.aal === 'aal2') return null
  // senza secondo passaggio: ammesso solo chi non e' tenuto a usarlo (membro operativo). Decide il database,
  // che per gli altri risponde 403 "mfa_richiesta" (controllo_mfa).
  const stato = await fetch(`${url}/rest/v1/rpc/mfa_stato`, {
    method: 'POST',
    headers: { apikey: chiave, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!stato.ok) return rifiuta(403, 'Verifica in due passaggi richiesta')
  return null
}
