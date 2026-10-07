// =====================================================================
//  Edge Function: extract-visura
//  Estrae i dati di una visura camerale (PDF) tramite Claude e li
//  restituisce in JSON: anagrafica azienda, organo, componenti, soci.
//  Segreto richiesto: ANTHROPIC_API_KEY
// =====================================================================

const MODEL = 'claude-sonnet-5' // per risparmiare: 'claude-haiku-4-5-20251001'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ISTRUZIONI = `Sei un estrattore di dati da visure camerali italiane (Registro Imprese).
Leggi la visura allegata e restituisci ESCLUSIVAMENTE un oggetto JSON valido, senza testo prima o dopo, senza backtick.
Schema esatto (usa null dove il dato non e' presente):

{
  "azienda": {
    "denominazione": string,
    "forma_giuridica": string,
    "partita_iva": string,
    "codice_fiscale": string,
    "rea": string,
    "pec": string,
    "sede_via": string,
    "sede_comune": string,
    "sede_provincia": string,
    "sede_cap": string,
    "capitale_sociale": string,
    "data_costituzione": string,
    "ateco": string,
    "attivita": string,
    "oggetto_sociale": string,
    "settore_suggerito": string,
    "addetti_dipendenti": number,
    "addetti_indipendenti": number,
    "addetti_totale": number,
    "addetti_data": string
  },
  "organo": { "tipo": string, "nome": string },
  "componenti": [
    { "nome": string, "cognome": string, "ruolo": string, "codice_fiscale": string, "pec": string, "data_nomina": string }
  ],
  "soci": [
    { "denominazione": string, "persona_giuridica": boolean, "codice_fiscale": string, "quota_perc": number, "quota_valore": string, "rappresentante": string }
  ]
}

Regole:
- "data_costituzione" nel formato AAAA-MM-GG.
- Addetti (dato INPS): "addetti_totale" e' il numero nel riquadro "L'IMPRESA IN CIFRE" alla voce "Addetti al GG/MM/AAAA" (es. "Addetti al 30/06/2026  2" -> 2); "addetti_data" e' quella data in formato AAAA-MM-GG. "addetti_dipendenti" e "addetti_indipendenti" sono le righe "Dipendenti" e "Indipendenti" della tabella "Numero addetti dell'impresa rilevati nell'anno ..." (sezione "Attivita', albi ruoli e licenze"): prendi il valore della colonna "Valore" o, se manca, dell'ultimo trimestre; usa la tabella dell'IMPRESA, non quella "Addetti nel comune di ..." delle singole sedi. Restituisci sempre NUMERI interi (non stringhe); null solo se il dato non c'e' affatto.
- "oggetto_sociale" massimo 500 caratteri (riassumi se troppo lungo).
- "settore_suggerito": "edilizia" se ATECO inizia per 41/42/43, altrimenti "generico".
- Nella visura i nominativi sono spesso "COGNOME NOME": separa correttamente nome e cognome.
- "organo.tipo": uno tra "cda", "amministratore_unico", "collegio_sindacale", "altro".
- "data_nomina" di ogni componente nel formato AAAA-MM-GG (dalla "Data atto di nomina" o dalla data di nomina della carica in visura); null se non presente.
- In "componenti" includi solo persone fisiche con carica (Presidente, Amministratore Delegato, Consigliere, Amministratore Unico, Sindaco). NON includere societa' di revisione.

Regole per "soci" (compagine sociale / elenco soci / titolari di quote o azioni):
- Includi TUTTI i soci/titolari di quote riportati nella visura (sezione "Trasferimenti di quote", "Soci e titolari di diritti su azioni e quote", "Compagine sociale" o simili). Prendi la situazione ATTUALE (l'ultima), non gli storici.
- "denominazione": per una persona fisica usa "Nome Cognome" (nell'ordine leggibile); per una societa' usa la ragione sociale completa.
- "persona_giuridica": true se il socio e' una societa'/ente, false se e' una persona fisica.
- "quota_perc": la percentuale di partecipazione al capitale come NUMERO (es. 64.29). Se in visura c'e' solo il valore in euro, calcola la percentuale sul capitale sociale se possibile, altrimenti null.
- "quota_valore": il valore nominale della quota in euro come stringa (es. "83.772,00"), null se non presente.
- "rappresentante": per i soci persona giuridica, l'eventuale legale rappresentante o delegato indicato; altrimenti null.
- Se la visura non riporta alcun socio (es. per alcune SpA la compagine non e' in visura), restituisci "soci": [].
- Restituisci SOLO il JSON.`

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

    try {
      const { pdf_base64 } = await req.json()
      if (!pdf_base64) return json({ error: 'PDF mancante' }, 400)

      const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
      if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY non configurata' }, 500)

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } },
              { type: 'text', text: ISTRUZIONI },
            ],
          }],
        }),
      })

      if (!resp.ok) {
        const err = await resp.text()
        return json({ error: 'Errore API: ' + err }, 502)
      }

      const data = await resp.json()
      let testo = (data.content || []).map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
      testo = testo.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

      let estratto
      try {
        estratto = JSON.parse(testo)
      } catch (_e) {
        return json({ error: 'Risposta non interpretabile', raw: testo }, 500)
      }

      return json(estratto, 200)
    } catch (e) {
      return json({ error: String(e) }, 500)
    }
  },
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
