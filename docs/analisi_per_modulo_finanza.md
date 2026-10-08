# Analisi del repository Pmi 360° per il modulo "Finanza e Controllo"

Analisi in sola lettura del repository `toolkit-rischio-360` (app "Toolkit Pmi 360°") e, dove serve, del database Supabase collegato (progetto `vwbixmbbcutjcplskjvg`, letto con query di sola lettura su `information_schema`, `pg_policies`, `pg_constraint`). Data: 2026-10-02.
Nessun valore segreto è riportato: solo i nomi delle variabili.

---

## 1. STACK E STRUTTURA

### Frontend
| Elemento | Valore | Fonte |
|---|---|---|
| Framework / build | **Create React App** (`react-scripts` 5.0.1). Non Vite, non Next.js | `package.json` |
| React | `^18.2.0` (+ `react-dom` `^18.2.0`) | `package.json` |
| Router | `react-router-dom` `^6.21.0` è installato ma **non usato**: la navigazione è uno stato stringa (`page`) e una mappa `pages` in `src/App.js` | `src/App.js` |
| Libreria UI | Nessuna libreria di componenti. `lucide-react` (icone) installato; nel codice prevalgono emoji | `package.json` |
| Grafici | `recharts` `^2.10.0` | `package.json` |
| Altre librerie | `pdf-lib` (PDF del Dossier BJR), `xlsx` (import/export), `@supabase/supabase-js` `^2.39.0` | `package.json` |
| Stato | React `useState` + un unico Context (`AppContext`, hook `useApp()`) definito in `src/App.js`. Nessun Redux/Zustand/React Query | `src/App.js` |
| Stile | **Nessun Tailwind**, nessun CSS-in-JS. Un foglio globale `src/index.css` con variabili CSS (`:root`) e classi utility (`btn`, `card`, `modal`, `form-control`, `badge`, `alert`, `table-wrap`…), più molti `style={{…}}` inline | `src/index.css` |
| Lingua | UI, commenti e dominio in italiano | tutto il codice |

### Struttura delle cartelle
```
src/
  App.js              radice: sessione, profilo, azienda attiva, routing a stringa, AppContext
  index.js, index.css
  components/         Layout.js (shell gestore + registro moduli), LayoutMembro.js (shell membro),
                      SimulazioneImpatto.js, AggiornaDaVisura.js
  pages/              una pagina per file (Cruscotto, RegistroRischi, Procedure, Governance,
                      NuovaDetermina, DettaglioAdunanza, DossierBJR, Impostazioni, Setup, ...)
  lib/                supabase.js (client), constants.js, fascicoli.js, procedure.js,
                      generaProcedura.js, lavoro.js, modalitaSolo.js, reparti.js
supabase/
  functions/<nome>/index.ts   Edge Function (Deno)
  sql/                        script SQL applicati a mano (vedi §7)
build/                        output di build versionato nel repo (vedi §10)
.github/workflows/deploy.yml  CI di deploy
```

### Hosting e deploy
- **Frontend**: GitHub Pages, `homepage: https://massimocoletta1959-wq.github.io/toolkit-pmi-360` (`package.json`).
- **CI**: `.github/workflows/deploy.yml`, a ogni push su `main` esegue: checkout, Node 20, `npm install`, `npm run build`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`.
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Function Deno), un solo progetto. Riferimento locale: `supabase/.temp/project-ref`.
- **Ambienti dev/prod**: NON TROVATO un ambiente di staging separato. URL e chiave anon del progetto sono scritti nel sorgente (`src/lib/supabase.js`, costanti `SUPABASE_URL` e la chiave anon), quindi dev locale (`npm start`) e produzione usano **lo stesso database**. Nessun file `.env` nel repo.
- **Seconda app**: il portale licenze è un repo separato (`../toolkit-licenze`, CRA, GitHub Pages `…/toolkit-licenze`), stesso progetto Supabase, accesso riservato al "proprietario".

---

## 2. ARCHITETTURA DEI MODULI

I moduli **non** sono cartelle separate: le pagine stanno tutte in `src/pages/`. Un modulo è definito da tre cose.

**a) Il registro dei moduli e dei menu**: `src/components/Layout.js`, oggetto `MODULI`:
```js
const MODULI = {
  rischi: {
    label: 'Rischi', colore: '#378ADD',
    voci: [
      { id: 'cruscotto', label: 'Cruscotto', icon: '📊' },
      { id: 'registro', label: 'Registro rischi', icon: '📋' },
      { id: 'piano', label: "Piano d'azione", icon: '✅' },
      { id: 'ticket', label: 'Ticket', icon: '🎫' },
    ],
  },
  procedure: { label: 'Procedure', colore: '#1D9E75', voci: [ /* procedure, tracciamento, ticket */ ] },
  governance: { label: 'Governance', colore: '#7F77DD', voci: [ /* governance, au_registro, modelli_determina,
                verbali, modelli_verbale, dossier_bjr, ticket */ ] },
}
```
Voci comuni a tutti i moduli: `COMUNI` (impostazioni, membri, organigramma) nello stesso file.

**b) La mappa delle pagine ("route")**: `src/App.js`, oggetto `pages` (chiave stringa → componente). Si naviga con `setPage('chiave')`.

**c) L'ingresso nel modulo**: `src/App.js`:
```js
function entraModulo(m) {
  const defaultPage = { rischi: 'cruscotto', procedure: 'procedure', governance: 'governance' }[m]
  setModulo(m)
  setPage(defaultPage || 'home')
}
```
Le card dei moduli in Home leggono `azienda.mod_*` (`src/pages/Home.js` righe 26-28).

### Passi concreti per aggiungere il modulo "finanza"
1. **DB**: colonna `mod_finanza boolean` su `aziende` (default false), su `utente_aziende` (default true) e su `gestori_preassegnazioni`; `incl_finanza boolean` su `gestori` (licenza).
2. **Trigger** `blocca_moduli_non_autorizzati` (su `utente_aziende`): estenderlo a `mod_finanza` (oggi confronta solo i tre campi esistenti).
3. **Funzione** `claim_gestore()` (`supabase/sql/2026-10-02_a_funzioni_sicure.sql`): copiare anche `mod_finanza` dalle preassegnazioni.
4. **`src/App.js`**:
   - nel `select` di `loadDati` aggiungere `mod_finanza` e l'incrocio `!!r.aziende.mod_finanza && r.mod_finanza !== false`;
   - in `entraModulo` aggiungere la pagina di default;
   - nella mappa `pages` aggiungere le nuove chiavi;
   - aggiungere gli `import`.
5. **`src/components/Layout.js`**: nuova voce in `MODULI` (label, colore, voci).
6. **`src/pages/Home.js`**: card del modulo, abilitata da `azienda.mod_finanza`.
7. **`src/pages/Impostazioni.js`**: aggiungere l'elemento all'elenco `{ campo: 'mod_finanza', incl: 'incl_finanza', … }` (righe ~352-354).
8. **`src/pages/Setup.js`**: scelta dei moduli alla creazione (`moduliScelti`, ~righe 177-187) e `incl(...)`.
9. **Portale licenze** (`../toolkit-licenze/src/pages/GestioneLicenze.js`): `incl_finanza` per gestore e `mod_finanza` per assegnazione.
10. **Pagine** nuove in `src/pages/` e, per un backend esterno, chiamate `fetch` con il JWT della sessione (vedi §4).

---

## 3. ATTIVAZIONE MODULI PER AZIENDA E PER UTENTE

### Tabelle e colonne (schema completo delle colonne rilevanti)
**`aziende`**: `mod_rischi boolean NOT NULL default true`, `mod_procedure boolean NOT NULL default false`, `mod_governance boolean NOT NULL default false`, `moduli ARRAY NULL` (colonna presente ma **non usata** nel codice: tutte le righe sono `null`). Schema completo in §5.

**`utente_aziende`** (collegamento utente ↔ azienda):
| colonna | tipo | null | default |
|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() |
| utente_id | uuid | NOT NULL | — FK auth.users ON DELETE CASCADE |
| azienda_id | uuid | NOT NULL | — FK aziende ON DELETE CASCADE |
| ruolo | text | NOT NULL | 'owner' (valori usati: 'owner', 'membro') |
| created_at | timestamptz | NOT NULL | now() |
| mod_rischi / mod_procedure / mod_governance | boolean | NOT NULL | true |

Vincolo `UNIQUE (utente_id, azienda_id)`.

**`gestori`** (licenza): `id`, `user_id` (UNIQUE, FK auth.users), `ragione_sociale`, `email`, `piano text NOT NULL default 'base'`, `stato text NOT NULL default 'attivo'` CHECK in ('attivo','sospeso','scaduto','cessato'), `data_attivazione date NOT NULL`, `data_scadenza date`, `max_aziende integer`, `incl_rischi boolean NOT NULL default true`, `incl_procedure` / `incl_governance boolean NOT NULL default false`, `note`, `created_at`, `updated_at`.

**`gestori_preassegnazioni`**: `gestore_id` (FK gestori), `azienda_id` (FK aziende), `mod_rischi/mod_procedure/mod_governance boolean NOT NULL default true`; UNIQUE (gestore_id, azienda_id).

### Dove si applica il controllo
| Livello | Cosa controlla | Dove |
|---|---|---|
| Frontend | Moduli visibili = `aziende.mod_X` **AND** `utente_aziende.mod_X` | `src/App.js` righe ~160-166 |
| Frontend | In Impostazioni si può attivare un modulo solo se incluso nella licenza (`gestori.incl_X`) | `src/pages/Impostazioni.js` ~352-360 |
| DB trigger | `trg_blocca_moduli_utente_aziende` → `blocca_moduli_non_autorizzati()`: solo il proprietario può cambiare i moduli di un collegamento | trigger su `utente_aziende` |
| DB trigger | `trg_limite_aziende` → `controlla_limite_aziende()`: rispetta `gestori.max_aziende` | trigger su `utente_aziende` |
| RLS | **NON** filtra per modulo: le policy sono per azienda e ruolo (gestore/membro/incaricato), non per `mod_X` | `pg_policies` |
| Edge Function | NON TROVATO alcun controllo sui moduli | `supabase/functions/*` |

Nota: su `aziende.mod_X` non c'è trigger. Un gestore può attivarlo via API anche senza `incl_X` in licenza: il vincolo è solo nell'interfaccia.

### Licenza / abbonamento
Sì, esiste: la tabella `gestori` (piano, stato, scadenza, `max_aziende`, `incl_*`), gestita dal portale licenze (`../toolkit-licenze`). `App.js` blocca l'accesso a un consulente senza riga `gestori` con `stato = 'attivo'` (`licenzaBloccata`). Pagamenti o piani commerciali: NON TROVATO (`piano` è un testo libero con default `'base'`).

---

## 4. AUTENTICAZIONE, RUOLI E MULTI-AZIENDA

### Supabase Auth
- **Login**: email + password (`signInWithPassword`, `signUp`) in `src/pages/Login.js`. Recupero password con l'evento `PASSWORD_RECOVERY` (`src/App.js`, `src/pages/ResetPassword.js`). OAuth / magic link / OTP: NON TROVATO.
- **Claim personalizzati nel JWT**: NON TROVATO (nessun custom access token hook; il codice legge solo `sub` ed `email` via `auth.uid()` e `auth.jwt() ->> 'email'`).

### Ruoli (definiti nei dati, non nel JWT)
| Ruolo | Come si riconosce | Dove |
|---|---|---|
| Proprietario (lo "Studio") | riga in `proprietari`; funzione `is_proprietario()` | tabella `proprietari` |
| Gestore (consulente) | `utente_aziende.ruolo <> 'membro'`; licenza in `gestori`; funzioni `is_gestore(aid)`, `mie_aziende_gestore()` | `supabase/sql/2026-10-02_a…`, `…_b…` |
| Membro (operativo) | `utente_aziende.ruolo = 'membro'` e/o `membri.user_id`; vede solo i propri task | `profili.ruolo = 'membro'` |
| Incaricato d'organo | `organo_incaricati` (attivo) → funzione `miei_organi()` | `supabase/sql/2026-10-02_d_incaricati_organo.sql` |

`profili.ruolo` ('consulente' / 'membro') sceglie la "shell" dell'interfaccia in `App.js`.

### Multi-azienda
Sì: un utente gestisce più aziende tramite `utente_aziende`, e l'azienda attiva si cambia con `switchAzienda()`, persistita in `localStorage` alla chiave `azienda_attiva`. Il proprietario è trattato come gestore di **tutte** le aziende (`mie_aziende_gestore()` include `select id from aziende where is_proprietario()`). Uno "studio con più clienti" coincide con un gestore che ha più collegamenti.

### Policy RLS sulle tabelle principali (sintesi)
- **`aziende`**: SELECT per qualunque collegamento (`aziende_gestore`, `p_aziende_select`); UPDATE/DELETE per `id IN (SELECT mie_aziende_gestore())`; INSERT per `is_gestore_attivo() OR is_proprietario()`; ALL per il proprietario.
- **`utente_aziende`**: SELECT/UPDATE/DELETE solo sulle proprie righe; **nessun INSERT dal browser**. Le righe le creano funzioni SECURITY DEFINER (`accetta_invito`, `claim_gestore`, `ripara_membro`) e il trigger `trg_collega_creatore_azienda`. `trg_blocca_cambio_ruolo` impedisce di cambiarsi il ruolo.
- **Tabelle di business**: pieno accesso con `azienda_id IN (SELECT mie_aziende_gestore())`, più policy aggiuntive per incaricati d'organo e membri.
- Copia integrale delle policy prima della revisione: `supabase/sql/2026-10-02_backup_policy_prima.sql`.

### Validare il JWT di Supabase da un servizio esterno (FastAPI)
- **Chiavi di firma**: l'endpoint pubblico `https://vwbixmbbcutjcplskjvg.supabase.co/auth/v1/.well-known/jwks.json` espone una chiave **ES256** (EC, `use: sig`). Il progetto usa quindi chiavi di firma **asimmetriche** e i token utente si possono verificare con la **JWKS**, senza segreti condivisi.
- La chiave **anon** nel client è un JWT legacy con header `alg: HS256` (solo header letto, valore non riportato).
- **Variabili d'ambiente presenti** nei secrets delle Edge Function (solo nomi): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, più `ANTHROPIC_API_KEY`, `BREVO_API_KEY`, `RESEND_API_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `FROM_EMAIL`, `EASYPMI_URL`, `PMI360_SERVICE_TOKEN`. Un `SUPABASE_JWT_SECRET` (HS256 legacy): NON TROVATO tra i secrets elencati.
- **Schema consigliato**: FastAPI scarica e mette in cache la JWKS e verifica `alg=ES256`, `aud=authenticated` e `exp`. Per i dati usa il token dell'utente verso PostgREST, così le RLS restano valide, oppure la service role solo lato server.
- **Esempio già presente** di validazione server-side (Edge Function) tramite `/auth/v1/user`:
```ts
const ur = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { 'apikey': serviceKey,
  'Authorization': req.headers.get('Authorization') || '' } })
const utente = ur.ok ? await ur.json() : null
if (!utente?.id) return errore(401, 'NON_AUTORIZZATO', 'Sessione non valida.')
```
(`supabase/functions/simulazione-impatto/index.ts`; stesso schema in `nomina-incaricato`)

---

## 5. ANAGRAFICA AZIENDE E LETTURA VISURA CCIAA

### Tabella `aziende` (schema completo)
| colonna | tipo | null | default / vincolo |
|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid(), PK |
| nome | text | NOT NULL | |
| settore | text | NULL | (valori UI: Manifatturiero, Servizi, Commercio, Edilizia, Sanità, Tecnologia, Agricoltura, Trasporti, Hotel, Altro) |
| dimensione | text | NULL | (fascia testuale es. "Piccola (10-49)") |
| created_at | timestamptz | NULL | now() |
| piva | text | NULL | nessun vincolo DB |
| logo_url | text | NULL | |
| mod_rischi | boolean | NOT NULL | true |
| mod_procedure | boolean | NOT NULL | false |
| mod_governance | boolean | NOT NULL | false |
| codice_fiscale, forma_giuridica, rea, pec | text | NULL | |
| sede_via, sede_comune, sede_provincia, sede_cap | text | NULL | |
| capitale_sociale | text | NULL | (stringa come in visura) |
| data_costituzione | date | NULL | |
| ateco | text | NULL | |
| attivita, oggetto_sociale | text | NULL | |
| moduli | ARRAY | NULL | non usata |
| modalita_solo | boolean | NOT NULL | false |
| tipo_soggetto | text | NOT NULL | 'societa'; CHECK in ('societa','individuale') |
| ccnl | text | NULL | |
| inquadramento_inps | text | NULL | CHECK in (industria, artigianato, commercio_terziario, cooperative, agricoltura, credito_assicurazioni, altro) |
| numero_dipendenti | integer | NULL | CHECK ≥ 0 |
| tasso_inail_pct | numeric(6,3) | NULL | CHECK 0–30 |
| mensilita | smallint | NULL | CHECK in (12,13,14,15) |
| aliquota_inps_datore_pct | numeric(5,2) | NULL | CHECK 0–50 |

Indici: solo `aziende_pkey (id)`. Nessun indice e nessun UNIQUE su `piva`.

### `piva`
- **Nullable**, nessun vincolo a livello DB.
- **Normalizzazione e validazione nel frontend**: si tolgono i non-numerici, poi si verificano 11 cifre e il checksum. Doppioni: avviso di "P.IVA già presente" solo tra le aziende visibili.
```js
const pivaClean = (editForm.piva || '').replace(/[^0-9]/g, '')
if (pivaClean && !pivaValida(pivaClean)) { setError('Partita IVA non valida: controlla le 11 cifre.') ... }
```
(`src/pages/Impostazioni.js`, `src/pages/Setup.js`, funzione `pivaValida`)
- Dati attuali: tutte le P.IVA presenti sono di 11 cifre; un'azienda ha `piva = null`.

### `ateco`
- Testo libero, **un solo codice** (primario). Codici secondari: NON TROVATO.
- Formato osservato nei dati: `NN.NN.N` o `NN.NN.NN` (es. "68.20.0", "82.20.00", "01.11.4").
- Versione (ATECO 2007 o 2025): NON TROVATO nel codice; il valore è quello letto dalla visura così com'è.
- Uso: `settoreDaAteco()` in `src/pages/Setup.js` (55 → Hotel; 41/42/43 → Edilizia).

### Tabelle collegate
- **`membri`** (anagrafica persone): `id`, `azienda_id` (FK CASCADE), `nome NOT NULL`, `cognome NOT NULL`, `email`, `telefono`, `ruolo`, `user_id` (FK auth.users), `created_at`, `pec`, `cellulare`.
- **`organi`**: `id`, `azienda_id` (FK CASCADE), `tipo NOT NULL` CHECK in (cda, comitato, collegio_sindacale, amministratore_unico, assemblea, altro), `nome NOT NULL`, `monocratico`, `quorum_presenza`, `quorum_delibera`, `attivo`, `created_at`. Indice `idx_organi_azienda`.
- **`organo_membri`** (cariche e soci): `organo_id` (FK), `membro_id` (FK), `ruolo NOT NULL`, `data_nomina`, `data_cessazione`, `quota numeric` (quota % per l'assemblea); UNIQUE (organo_id, membro_id, ruolo). I soci sono componenti dell'organo «assemblea» con `quota`.
- **`ruoli`** (organigramma): `azienda_id`, `sigla`, `nome`, `membro_id`, `fascia`, `parent_id`; UNIQUE (azienda_id, sigla).
- Tabelle dedicate per sedi secondarie / unità locali / codici ATECO multipli / soci societari: NON TROVATO.

### Flusso di import della visura
1. **Caricamento del PDF**: nel browser, come base64 (`FileReader.readAsDataURL`). Due punti:
   - `src/pages/Setup.js`: creazione di una nuova azienda;
   - `src/components/AggiornaDaVisura.js`: aggiornamento di un'azienda esistente, aperto da Impostazioni.
2. **Edge Function `extract-visura`** (`supabase/functions/extract-visura/index.ts`): invia il PDF all'API Anthropic come blocco `document`.
   - Modello: `const MODEL = 'claude-sonnet-5'` (commento alternativo: `'claude-haiku-4-5-20251001'`), `max_tokens: 3000`.
   - Prompt: costante `ISTRUZIONI` nello stesso file.
   - Segreto: `ANTHROPIC_API_KEY`.
3. **Schema JSON di output** (estratto):
```jsonc
{ "azienda": { "denominazione", "forma_giuridica", "partita_iva", "codice_fiscale", "rea", "pec",
               "sede_via", "sede_comune", "sede_provincia", "sede_cap", "capitale_sociale",
               "data_costituzione", "ateco", "attivita", "oggetto_sociale", "settore_suggerito",
               "addetti_dipendenti", "addetti_indipendenti", "addetti_data" },
  "organo": { "tipo", "nome" },
  "componenti": [ { "nome", "cognome", "ruolo", "codice_fiscale", "pec", "data_nomina" } ],
  "soci": [ { "denominazione", "persona_giuridica", "codice_fiscale", "quota_perc", "quota_valore", "rappresentante" } ] }
```
4. **Errori gestiti dalla funzione**:
   - PDF mancante → 400;
   - `ANTHROPIC_API_KEY` assente → 500;
   - errore dell'API → 502 con il testo restituito;
   - JSON non interpretabile → 500 con `raw`.

   Il client mostra «Non sono riuscito a leggere la visura: …». Per i campi mancanti l'LLM restituisce `null` e il client salva `null`.
5. **Creazione** (`Setup.js`): insert in `aziende` con i campi estratti. Se la Governance è attiva, crea l'organo amministrativo con i componenti e l'Assemblea con soci e quote.
6. **Reimport / aggiornamento** (`AggiornaDaVisura.js`):
   - confronto campo per campo; si applicano solo i campi spuntati;
   - blocco se la P.IVA della visura è diversa da quella dell'azienda;
   - organi, componenti e soci **non** vengono aggiornati.
7. **Salvataggio del PDF**: **NON TROVATO**, il PDF non viene conservato. Bucket esistenti: `loghi` (pubblico), `fascicoli` (privato, allegati delle determine).
8. Il sorgente di `extract-visura` era solo su Supabase ed è stato aggiunto al repo il 2026-10-02. Lo chiama `supabase.functions.invoke` (verify_jwt = true).

---

## 6. EDGE FUNCTION

| Funzione | Descrizione | verify_jwt |
|---|---|---|
| `extract-visura` | Estrae i dati da una visura PDF con Claude (Anthropic API) | true |
| `simulazione-impatto` | Chiama EasyPMI, scarica e verifica (sha256) i 2 PDF, li ri-ospita nel bucket `fascicoli`, salva la sintesi | true |
| `nomina-incaricato` | Nomina un incaricato d'organo (verifica che il chiamante sia gestore), crea l'invito, invia l'email con Brevo | true |
| `invia-invito` | Crea un invito per un membro e invia l'email (Brevo) | **false** |
| `invia-presa-visione` | Email unica a un membro con le procedure assegnate (+ invito se non registrato) | true |
| `invia-email` | Invio email generico (es. circolarizzazione dalle adunanze) | **false** |
| `invita-gestore` | Invito di un gestore (usato dal portale licenze) | true |
| `reminder-scadenze` | Promemoria delle scadenze dei task | **false** |

Fonte: `supabase functions list`; i sorgenti sono in `supabase/functions/*/index.ts`.

**Timeout e limiti trovati nel codice**
- `simulazione-impatto`: `const TIMEOUT_MS = 30000` con `AbortController` sia sulla chiamata a EasyPMI sia sul download dei PDF.
- Limite dimensione allegati nel fascicolo: costante `MAX_FILE_MB` in `src/pages/NuovaDetermina.js`.
- `extract-visura`: `max_tokens: 3000`; nessun limite esplicito sulla dimensione del PDF: NON TROVATO.
- Problemi di dimensione documentati nei commenti: NON TROVATO.

**Chiamate a servizi esterni**: sempre `fetch` diretto, con i segreti letti da `Deno.env.get('NOME')`:
- Anthropic: header `x-api-key`;
- Brevo: header `api-key`;
- EasyPMI: `Authorization: Bearer` con `PMI360_SERVICE_TOKEN`, URL da `EASYPMI_URL`;
- DB e Storage: REST con `SUPABASE_SERVICE_ROLE_KEY`.

Errori: le funzioni recenti usano una busta comune `{ errore: { codice, messaggio, dettagli? } }`; quelle storiche usano `{ error }`.

---

## 7. DATABASE E MIGRAZIONI

- **`supabase/migrations`: NON TROVATO.** Non esiste una cronologia delle migrazioni. Lo schema nasce da modifiche fatte direttamente sul progetto (SQL Editor o CLI).
- Dal 2026-10-02 c'è la cartella **`supabase/sql/`**, con script applicati a mano tramite `supabase db query --linked -f`. Convenzione: `AAAA-MM-GG_<lettera>_<descrizione>.sql`:
  - `…_a_funzioni_sicure.sql`
  - `…_b_proprietario_e_procedura_task.sql`
  - `…_c_regole_accesso.sql`
  - `…_d_incaricati_organo.sql`
  - `…_e_log_accessi.sql`
  - backup delle policy: `…_backup_policy_prima.sql`

  Gli script C e D sono dentro `begin; … commit;`.
- **Tabelle di backup** nello schema `public` (RLS attiva): `_backup_membri_email`, `_bkp_adozioni_generico`, `_bkp_catalogo_generico`, `_bkp_template_generico`.
- **Audit, hash, immutabilità**:
  - **Determine firmate**: alla firma si calcolano numero, `data_firma` e `hash_documento` SHA-256 del testo. In seguito l'atto è in sola lettura nell'interfaccia; nel DB: NON TROVATO un blocco.
```js
const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
...
if (firma) { campi.numero = numero; campi.data_firma = data_firma; campi.hash_documento = hash }
```
(`src/pages/NuovaDetermina.js` righe 126 e 461; anche `adunanze.hash_documento`, mostrato nel Dossier BJR)
  - **`registro_attivita`**: append-only, il trigger `trg_registro_append_only` → `blocca_modifiche_registro()` impedisce UPDATE e DELETE:
```sql
raise exception 'registro_attivita e'' append-only: operazione % non consentita', TG_OP;
```
  - **`governance_eventi`**: cronologia degli eventi di adunanze e atti.
  - **`log_accessi`**: accessi e uscite degli utenti (IP, user agent), leggibile solo dal proprietario.
  - **Numerazione**: funzioni `prossimo_numero_determina`, `prossimo_numero_adunanza`.

---

## 8. INTEGRAZIONE EASYPMI GIÀ PRESENTE

| Elemento | Stato | Dove |
|---|---|---|
| "Simula impatto" (UI) | Implementato nello step Analisi del wizard delle determine, per gli atti con `con_analisi_economica` | `src/components/SimulazioneImpatto.js`, montato in `src/pages/NuovaDetermina.js` (step 2) |
| Tipi supportati | leasing, acquisto_bene, finanziamento (rateale), costo_ricorrente, costo_una_tantum, personale, composta (≤5 componenti); `ipotesi_ricavi` su tutti; `iva_regime` | `SimulazioneImpatto.js` (`TIPI_IMPATTO`, `IMPATTI_PER_TIPO`, `costruisciDecisione`) |
| Edge Function | `simulazione-impatto`: chiamata a EasyPMI, ri-ospitatura dei PDF (sha256/bytes), scrittura di `determina_allegati` + `determina_simulazioni`; la nuova simulazione sostituisce la precedente | `supabase/functions/simulazione-impatto/index.ts` |
| Tabella | `determina_simulazioni` (determina_id UNIQUE, simulazione_id, richiesta jsonb, sintesi jsonb senza URL firmati, versione_motore, creata_da) | DB |
| `bozzaProvvId` | Bozza provvisoria creata dal wizard allo step Fascicolo / alla prima simulazione; `attoId = determinaId \|\| bozzaProvvId` viene inviato come `determina_ref` | `src/pages/NuovaDetermina.js` (~righe 154, 371-422, 509) |
| Esito mostrato | CE prima/dopo, cassa mese per mese, stress test, avvisi, contributo dei componenti | `SimulazioneImpatto.js` |
| PDF nel fascicolo | voce `"Simulazione d'impatto (EasyPMI)"`, non eliminabile a mano | `NuovaDetermina.js` (`FascicoloChecklist`) |
| Dossier BJR | Incorpora gli allegati del fascicolo (quindi anche i PDF della simulazione) nel PDF del dossier | `src/pages/DossierBJR.js` |
| Dati lavoro per `personale` | `ccnl`, `mensilita`, `inquadramento_inps`, `numero_dipendenti`, `aliquota_inps_datore_pct`, `tasso_inail_pct` su `aziende` | `src/pages/Impostazioni.js`, `src/lib/lavoro.js` |
| Contratto | Documenti del contratto (v7, v8): NON TROVATO nel repo (stanno nel repo EasyPMI) | — |

---

## 9. DESIGN SYSTEM

- **Token** (`src/index.css`, `:root`): `--blue-dark #1A3A5C`, `--blue-med #2B5FA5`, `--blue-light #D6E8F7`, `--blue-xl #EBF4FC`, `--gray-dark #333`, `--gray-med #666`, `--gray-light #F5F5F5`, `--red #C0392B`, `--orange #E67E22`, `--green #27AE60` (con varianti `-light`), `--border #E0E0E0`, `--radius 8px`, `--shadow`, `--shadow-lg`. Sfondo pagina `#F7F8FA`.
- **Font**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`, 14px. Nessun web font.
- **Colori dei moduli** (`Layout.js`): Rischi `#378ADD`, Procedure `#1D9E75`, Governance `#7F77DD`.
- **Classi condivise** (`src/index.css`):
  - layout: `.app-layout`, `.sidebar`, `.sidebar-nav`, `.nav-item`, `.main-content`, `.page-header`;
  - contenitori: `.card`, `.card-header`, `.card-title`, `.stats-grid`, `.stat-card`, `.stat-num`, `.stat-label`;
  - pulsanti: `.btn`, `.btn-primary`, `.btn-danger`, `.btn-sm`;
  - form: `.form-group`, `.form-label`, `.form-control`;
  - modali: `.modal-overlay`, `.modal`, `.modal-header`, `.modal-title`, `.modal-footer`;
  - griglie: `.grid-2`, `.grid-3`;
  - stati: `.badge`, `.alert`, `.alert-error`, `.empty-state`, `.spinner`;
  - tabelle: `.table-wrap`.
- **Tabelle**: stile globale con `thead tr { background: var(--blue-dark) }` e `thead th { color: white }`. Uno sfondo chiaro nell'intestazione rende il testo illeggibile: problema già incontrato.
- **Componenti React riutilizzabili**: pochi. Shell (`Layout`, `LayoutMembro`); i componenti di form sono interni ai file, per esempio `Campo`, `Num`, `Scelta`, `Data` in `SimulazioneImpatto.js`.
- **Responsive**: un solo breakpoint `@media (max-width: 768px)` per la sidebar.

---

## 10. RISCHI E NOTE

1. **Stack diverso.** EasyPMI usa Next.js e Tailwind (secondo la richiesta); qui ci sono CRA, React 18, CSS globale e stili inline, senza router né Tailwind. Le pagine importate vanno **riscritte** come componenti CRA, oppure servite come app separata (iframe o sottodominio).
2. **Nessun router.** Le «route» sono chiavi stringa in `App.js`: niente URL profondi, niente lazy loading per modulo. Un modulo grande appesantisce il bundle unico (oggi ~515 kB gzip).
3. **Hosting statico** su GitHub Pages: niente server-side rendering, niente API routes, niente segreti nel frontend. Un backend Python va ospitato altrove con CORS verso l'origine `https://massimocoletta1959-wq.github.io`.
4. **JWT.** I token utente sono firmati **ES256 (JWKS pubblica)**: FastAPI li può validare senza segreti condivisi. Nessun claim personalizzato, quindi azienda, ruolo e modulo vanno verificati interrogando il DB (con il token utente, così valgono le RLS) o tramite una funzione SECURITY DEFINER dedicata.
5. **Moduli non applicati dalle RLS.** L'attivazione dei moduli è solo nell'interfaccia (più un trigger su `utente_aziende`). Per "Finanza" con dati sensibili conviene un controllo anche lato DB o lato backend (es. una funzione `modulo_attivo(azienda, 'finanza')`).
6. **Nessuna migrazione versionata.** Lo schema non si può ricreare da zero dal repo e c'è un solo ambiente (dev = prod). Prima di un modulo nuovo conviene introdurre `supabase/migrations` o uno staging.
7. **Edge Function senza verifica JWT** (`invia-invito`, `invia-email`, `reminder-scadenze`). In particolare `invia-invito` non controlla chi la chiama.
8. **`build/` versionata nel repo** anche se la CI ricompila: genera rumore nei diff.
9. **Doppioni.** `aziende.moduli` (array) non è usata e convive con le colonne `mod_*`. Le tabelle `_backup_*` / `_bkp_*` stanno nello schema `public`.
10. **P.IVA senza vincoli DB** (né UNIQUE né CHECK) e un solo ATECO senza versione: se il modulo Finanza deve agganciare EasyPMI per P.IVA (come la simulazione), la qualità del dato dipende dal frontend.
11. **PDF della visura non conservato**: per audit o ri-elaborazioni andrebbe salvato in un bucket privato.
12. **File spuri nella root** (`Casks`, `Searching`) e `CLAUDE.md` non tracciato.
