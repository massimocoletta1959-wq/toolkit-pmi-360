import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Simulazione d'impatto di una decisione (oggi: leasing) tramite EasyPMI.
// Contratto: "Simulazione d'impatto EasyPMI ↔ Pmi 360° — v7".
//
// Garanzie verso EasyPMI (vedi scambio sulla cancellazione a cascata):
//  1. riferimento e sintesi si scrivono SOLO dopo che i due PDF sono stati
//     scaricati, verificati (sha256 + bytes) e ri-ospitati nel bucket `fascicoli`;
//  2. se scarico/verifica/upload falliscono non resta nulla (file rimossi,
//     nessuna riga) e l'esito è un fallimento, mai un successo parziale;
//  3. gli URL firmati di EasyPMI non vengono mai salvati: dopo l'allegato la
//     delibera non rilegge più nulla da EasyPMI.
// Una nuova simulazione sulla stessa bozza SOSTITUISCE la precedente.

const EASYPMI_URL = (Deno.env.get('EASYPMI_URL') || '').replace(/\/$/, '')
const EASYPMI_TOKEN = Deno.env.get('PMI360_SERVICE_TOKEN') || ''
const VOCE_SIMULAZIONE = "Simulazione d'impatto (Finanza e Controllo)"
const VOCE_SIMULAZIONE_PRECEDENTE = "Simulazione d'impatto (EasyPMI)"
const TIMEOUT_MS = 30000

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
const risposta = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
const errore = (status: number, codice: string, messaggio: string, dettagli?: unknown) =>
  risposta(status, { errore: { codice, messaggio, ...(dettagli ? { dettagli } : {}) } })

async function sha256Hex(bytes: Uint8Array) {
  const h = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function conTimeout(url: string, init: RequestInit, ms = TIMEOUT_MS) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...init, signal: ctrl.signal }) } finally { clearTimeout(t) }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return errore(405, 'METODO_NON_CONSENTITO', 'Usa POST.')
  if (!EASYPMI_URL || !EASYPMI_TOKEN) return errore(500, 'CONFIGURAZIONE_MANCANTE', 'Integrazione EasyPMI non configurata (EASYPMI_URL / PMI360_SERVICE_TOKEN).')

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const db = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
  const dbJson = { ...db, 'Content-Type': 'application/json' }
  const storage = `${supabaseUrl}/storage/v1/object/fascicoli`

  let body: { determina_id?: string; decisione?: Record<string, unknown> }
  try { body = await req.json() } catch { return errore(400, 'JSON_MALFORMATO', 'Corpo della richiesta non valido.') }
  const { determina_id, decisione } = body || {}
  if (!determina_id || !decisione) return errore(400, 'PARAMETRI_MANCANTI', 'determina_id e decisione sono obbligatori.')

  // ── Chi chiama: utente autenticato, collegato all'azienda della determina ──
  const ur = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { 'apikey': serviceKey, 'Authorization': req.headers.get('Authorization') || '' } })
  const utente = ur.ok ? await ur.json() : null
  if (!utente?.id) return errore(401, 'NON_AUTORIZZATO', 'Sessione non valida.')

  const dr = await fetch(`${supabaseUrl}/rest/v1/determine?id=eq.${encodeURIComponent(determina_id)}&select=id,azienda_id,stato,con_analisi_economica,aziende(piva)`, { headers: db })
  const det = (await dr.json())[0]
  if (!det) return errore(404, 'DETERMINA_NON_TROVATA', 'Atto non trovato.')
  const lr = await fetch(`${supabaseUrl}/rest/v1/utente_aziende?utente_id=eq.${utente.id}&azienda_id=eq.${det.azienda_id}&select=azienda_id`, { headers: db })
  if (!(await lr.json())[0]) return errore(403, 'NON_AUTORIZZATO', 'Non hai accesso a questa azienda.')
  if (det.stato !== 'bozza') return errore(409, 'ATTO_NON_IN_BOZZA', "La simulazione si può allegare solo a un atto in bozza.")
  if (det.con_analisi_economica === false) return errore(409, 'ATTO_SENZA_IMPEGNO', "L'atto non prevede un impegno economico-finanziario.")
  const piva = det.aziende?.piva
  if (!piva) return errore(422, 'PIVA_MANCANTE', "Manca la Partita IVA dell'azienda: inseriscila in Impostazioni.")

  // ── Chiamata a EasyPMI ──
  let esito: Record<string, any>
  try {
    const er = await conTimeout(`${EASYPMI_URL}/functions/v1/simulazione-impatto`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${EASYPMI_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ partita_iva: piva, determina_ref: determina_id, decisione }),
    })
    const txt = await er.text()
    let json: any = null
    try { json = JSON.parse(txt) } catch { /* risposta non JSON */ }
    if (!er.ok) {
      if (json?.errore) return risposta(er.status, json)   // busta EasyPMI così com'è (409 → messaggio per l'utente)
      return errore(502, 'EASYPMI_NON_DISPONIBILE', `EasyPMI ha risposto ${er.status}.`)
    }
    esito = json
  } catch (e) {
    const scaduto = (e as Error)?.name === 'AbortError'
    return errore(502, 'EASYPMI_NON_DISPONIBILE', scaduto ? 'EasyPMI non ha risposto entro 30 secondi.' : 'EasyPMI non raggiungibile.')
  }
  if (!esito?.simulazione_id || !esito?.documenti) return errore(502, 'EASYPMI_RISPOSTA_NON_VALIDA', 'Risposta di EasyPMI incompleta.')

  // ── Ri-ospitatura dei due PDF (scarico + verifica + upload) ──
  const caricati: string[] = []
  const rimuovi = async (paths: string[]) => {
    if (!paths.length) return
    await fetch(storage, { method: 'DELETE', headers: dbJson, body: JSON.stringify({ prefixes: paths }) }).catch(() => {})
  }
  const DOC = [
    { chiave: 'pdf_economico', nome: 'Simulazione impatto economico.pdf' },
    { chiave: 'pdf_finanziario', nome: 'Simulazione impatto finanziario.pdf' },
  ]
  const allegati: Record<string, unknown>[] = []
  try {
    const ts = Date.now()
    for (const d of DOC) {
      const doc = esito.documenti[d.chiave]
      if (!doc?.valore) throw new Error(`${d.chiave} assente`)
      const pr = await conTimeout(doc.valore, {})
      if (!pr.ok) throw new Error(`scarico ${d.chiave}: ${pr.status}`)
      const bytes = new Uint8Array(await pr.arrayBuffer())
      if (doc.bytes && bytes.length !== doc.bytes) throw new Error(`${d.chiave}: dimensione non corrispondente`)
      if (doc.sha256 && (await sha256Hex(bytes)) !== String(doc.sha256).toLowerCase()) throw new Error(`${d.chiave}: sha256 non corrispondente`)
      const path = `${det.azienda_id}/${determina_id}/${ts}-${d.nome.replace(/[^\w.\-]+/g, '_')}`
      const up = await fetch(`${storage}/${path}`, { method: 'POST', headers: { ...db, 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: bytes })
      if (!up.ok) throw new Error(`upload ${d.chiave}: ${up.status}`)
      caricati.push(path)
      allegati.push({ azienda_id: det.azienda_id, determina_id, voce: VOCE_SIMULAZIONE, nome_file: d.nome, storage_path: path, dimensione: bytes.length })
    }
  } catch (e) {
    await rimuovi(caricati)
    return errore(502, 'RIOSPITATURA_FALLITA', 'Non è stato possibile salvare i PDF della simulazione: nessun allegato è stato aggiunto. Riprova.', String((e as Error)?.message || e))
  }

  // ── Solo ora si scrivono i riferimenti (sostituendo la simulazione precedente) ──
  const vr = await fetch(`${supabaseUrl}/rest/v1/determina_allegati?determina_id=eq.${determina_id}&voce=in.(${encodeURIComponent(`"${VOCE_SIMULAZIONE}","${VOCE_SIMULAZIONE_PRECEDENTE}"`)})&select=id,storage_path`, { headers: db })
  const vecchi: { id: string; storage_path: string }[] = vr.ok ? await vr.json() : []

  // Sintesi: tutta la risposta tranne gli URL firmati (restano sha256 e bytes)
  const documenti: Record<string, unknown> = {}
  for (const d of DOC) { const { valore: _v, scade_il: _s, ...resto } = esito.documenti[d.chiave] || {}; documenti[d.chiave] = resto }
  const sintesi = { ...esito, documenti }

  const ar = await fetch(`${supabaseUrl}/rest/v1/determina_allegati`, { method: 'POST', headers: { ...dbJson, 'Prefer': 'return=representation' }, body: JSON.stringify(allegati) })
  const nuovi: { id: string }[] = ar.ok ? await ar.json() : []
  if (!ar.ok) { await rimuovi(caricati); return errore(500, 'SALVATAGGIO_FALLITO', 'Salvataggio degli allegati non riuscito: nessun allegato è stato aggiunto.') }

  const sr = await fetch(`${supabaseUrl}/rest/v1/determina_simulazioni?on_conflict=determina_id`, {
    method: 'POST',
    headers: { ...dbJson, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      determina_id, azienda_id: det.azienda_id, simulazione_id: esito.simulazione_id,
      richiesta: decisione, sintesi, versione_motore: esito.versione_motore || null,
      creata_da: utente.id, created_at: new Date().toISOString(),
    }),
  })
  if (!sr.ok) {
    await fetch(`${supabaseUrl}/rest/v1/determina_allegati?id=in.(${nuovi.map(n => n.id).join(',')})`, { method: 'DELETE', headers: db })
    await rimuovi(caricati)
    return errore(500, 'SALVATAGGIO_FALLITO', 'Salvataggio della sintesi non riuscito: nessun allegato è stato aggiunto.')
  }

  // Rimozione della simulazione precedente (best-effort: la nuova è già completa)
  if (vecchi.length) {
    await fetch(`${supabaseUrl}/rest/v1/determina_allegati?id=in.(${vecchi.map(v => v.id).join(',')})`, { method: 'DELETE', headers: db }).catch(() => {})
    await rimuovi(vecchi.map(v => v.storage_path))
  }

  return risposta(200, { simulazione: (await sr.json())[0] })
})
