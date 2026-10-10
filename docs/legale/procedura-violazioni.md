# Procedura di gestione delle violazioni dei dati personali

Documento interno di F.C. CONSULTING S.A.S. DI MASSIMO COLETTA & C. per il servizio Pmi 360°, ai sensi degli articoli 33 e 34 del GDPR e delle Linee guida EDPB 9/2022 sulla notifica delle violazioni.

## 1. Scopo e ruoli

La procedura stabilisce cosa fare quando si scopre, o si sospetta, una violazione dei dati personali trattati con Pmi 360°.

- **Referente per le violazioni:** Massimo Coletta, legale rappresentante. Decide le azioni, le valutazioni e le notifiche.
- **Supporto tecnico:** chi gestisce il portale (sviluppo e configurazione) esegue il contenimento e raccoglie le prove.
- **Canale di segnalazione:** privacy@pmi360.it. Chiunque, interno o esterno, deve segnalare subito ogni sospetto, anche se incerto.

Pmi 360° ha due ruoli diversi, e da questo dipende a chi si notifica:
- **titolare** per i dati degli account degli utenti (nome, email, accessi, IP): notifica al Garante e, se serve, agli interessati;
- **responsabile** per i dati che i clienti caricano nel portale: notifica al **cliente**, che decide se notificare al Garante.

## 2. Che cos'è una violazione

È una violazione ogni evento che compromette la **riservatezza** (dati visti da chi non doveva), l'**integrità** (dati alterati) o la **disponibilità** (dati persi o inaccessibili) dei dati personali. Esempi tipici per Pmi 360°:

- un utente vede dati di un'azienda a cui non è abilitato (errore nelle regole di accesso);
- credenziali di un utente rubate o usate da altri;
- una chiave tecnica esposta: chiave di servizio Supabase, chiavi AWS di Bedrock, token di Cloudflare, chiave di Brevo, password del database di prova, chiavi conservate sul computer dell'amministratore;
- un'email del portale inviata al destinatario sbagliato con documenti allegati;
- dati cancellati o danneggiati e non ripristinabili dai backup;
- furto o compromissione del computer o del telefono dell'amministratore;
- un fornitore (Supabase, Cloudflare, AWS, Brevo, Aruba) comunica una violazione che riguarda i nostri dati.

## 3. Le fasi

### Fase 1 — Rilevazione e segnalazione (subito)

Chi scopre l'evento scrive a privacy@pmi360.it e avvisa il referente per telefono. Annota data e ora della scoperta: **da quel momento decorrono i termini** di 48 ore (clienti) e 72 ore (Garante).

### Fase 2 — Contenimento (entro poche ore)

Le azioni dipendono dall'evento. Le principali:

| Situazione | Azione |
|---|---|
| Account di un utente compromesso | cambio password, chiusura di tutte le sessioni dell'utente, sospensione dell'accesso se necessario |
| Chiave tecnica esposta | revoca e sostituzione immediata della chiave nel servizio interessato e nei secret di Supabase o GitHub (elenco al punto 6) |
| Errore nelle regole di accesso | blocco della funzione o della pagina interessata e correzione, provata prima sul progetto di prova |
| Email al destinatario sbagliato | richiesta al destinatario di cancellare il messaggio e di confermarlo per iscritto |
| Perdita di dati | ripristino dal backup giornaliero più recente |
| Violazione presso un fornitore | richiesta di dettagli al fornitore e applicazione delle sue indicazioni |

Le prove (registri degli accessi, messaggi, schermate) vanno conservate prima di modificare qualcosa, se possibile.

### Fase 3 — Valutazione (entro 24 ore dalla scoperta)

Il referente stabilisce:

1. quali dati sono coinvolti, di quante persone, di quali aziende clienti;
2. se la violazione riguarda dati di cui siamo titolari, responsabili o entrambi;
3. il livello di rischio per le persone:
   - **nessun rischio probabile** (es. dati cifrati o recuperati prima di ogni accesso): solo registro;
   - **rischio** (es. accesso a email e ruoli di utenti): notifica al Garante, se siamo titolari;
   - **rischio elevato** (es. documenti contabili, verbali o dati di persone esposti a terzi): notifica al Garante e comunicazione agli interessati.

Nella valutazione si considerano tipo e quantità dei dati, facilità di identificare le persone, gravità delle conseguenze, numero di persone coinvolte, persone vulnerabili.

### Fase 4 — Notifiche

**Ai clienti (come responsabile), entro 48 ore dalla scoperta**, per ogni azienda o studio i cui dati sono coinvolti, anche se la valutazione non è conclusa. Si scrive al gestore del cliente per email e, se grave, per PEC. Contenuto:

- natura della violazione e momento della scoperta;
- categorie e numero approssimativo di persone e di dati coinvolti;
- probabili conseguenze;
- misure adottate e proposte per limitare i danni;
- referente da contattare (privacy@pmi360.it).

Le informazioni non ancora disponibili si inviano appena possibile, in più comunicazioni.

**Al Garante (come titolare), entro 72 ore dalla scoperta**, se c'è un rischio per le persone. La notifica si fa con la procedura online del Garante (servizi.gpdp.it, sezione «Data breach»). Oltre le 72 ore va indicato il motivo del ritardo.

**Agli interessati (come titolare), senza ingiustificato ritardo**, se il rischio è elevato, con linguaggio semplice: cosa è successo, conseguenze probabili, cosa abbiamo fatto, cosa possono fare (ad esempio cambiare password), chi contattare.

### Fase 5 — Ripristino e chiusura

Si eliminano le cause, si verifica che le correzioni funzionino e si ripristina il servizio normale. Il referente chiude l'evento nel registro.

### Fase 6 — Riesame

Entro 30 giorni dalla chiusura si valuta cosa ha funzionato e cosa no, e si aggiornano misure e procedura.

## 4. Registro delle violazioni

Ogni violazione, **anche se non notificata**, si annota nel registro (art. 33.5 GDPR), che contiene:

- data e ora dell'evento e della scoperta;
- descrizione, dati e persone coinvolti, aziende clienti interessate;
- valutazione del rischio e motivazione;
- azioni di contenimento e ripristino;
- notifiche fatte (clienti, Garante, interessati) con data e ora, oppure motivo per cui non sono state fatte;
- esito del riesame.

Il registro si conserva per almeno 10 anni ed è messo a disposizione del Garante su richiesta.

## 5. Cosa riceviamo dai fornitori

I sub-responsabili notificano a Pmi 360° le violazioni che li riguardano secondo i loro accordi sul trattamento dei dati. Quando arriva una loro comunicazione si applica questa procedura dalla fase 1.

## 6. Chiavi e accessi da revocare in caso di compromissione

| Chiave o accesso | Dove si revoca |
|---|---|
| Chiave di servizio e segreto JWT di Supabase | pannello Supabase, impostazioni API del progetto |
| Password del database di produzione e di prova | pannello Supabase, impostazioni del database |
| Chiavi AWS per Bedrock (utente `pmi360-portale`) | console AWS, IAM, credenziali di sicurezza dell'utente |
| Token API di Cloudflare | Cloudflare, profilo, token API |
| Chiave API di Brevo | Brevo, impostazioni SMTP e API |
| Secret di pubblicazione su GitHub | GitHub, impostazioni del repository, secret delle Actions |
| Accesso al dominio e alla posta | Aruba, area clienti |

Dopo ogni sostituzione si aggiornano i secret di Supabase e si verifica che il portale funzioni.

Versione 1.0 del 10 ottobre 2026.
