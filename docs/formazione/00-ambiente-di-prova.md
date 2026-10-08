# Ambiente di prova (pmi360-test)

Progetto Supabase **pmi360-test** (`kzwxgdzzzbvqhysyhxqt`, regione eu-central-1, organizzazione di Pmi 360°),
creato l'8/10/2026 come prerequisito della Fase 1 del modulo Formazione: **ogni migrazione e il suo rollback si
provano qui prima della produzione** (`vwbixmbbcutjcplskjvg`). Per fare posto al progetto (limite di 2 progetti
del piano gratuito) il progetto `easypmi` e' stato messo in pausa.

## Contenuto
- Schema `public` identico alla produzione all'8/10/2026 (73 tabelle, 126 policy RLS, 42 funzioni, 13 trigger),
  bucket di storage `loghi`, `fascicoli`, `fin-documenti` con le 13 policy, pubblicazione realtime
  (`sessioni_pmi360`).
- Solo dati di riferimento non personali: `fin_voci_cee`, `fin_voci_sp`, `procedure_catalogo`,
  `procedure_template`, mappature conti globali. **Nessuna azienda, persona o documento.**
- Edge Functions: non ancora pubblicate (si pubblicano quando servono ai test end-to-end).

## Come eseguire SQL sul progetto di prova
La password del database non e' nel repository: sta in `~/.pmi360-test-db-password` (permessi 600) sul Mac di
sviluppo. Il progetto collegato alla CLI (`supabase/.temp`) resta la **produzione**: per la prova si usa una
connessione esplicita, cosi' non si rischia di lanciare comandi sul progetto sbagliato.

```bash
export PGPASSWORD=$(cat ~/.pmi360-test-db-password)
/opt/homebrew/opt/postgresql@14/bin/psql \
  -h aws-1-eu-central-1.pooler.supabase.com -p 5432 \
  -U postgres.kzwxgdzzzbvqhysyhxqt -d postgres \
  -v ON_ERROR_STOP=1 -f supabase/sql/<migrazione>.sql
```

Sequenza per ogni migrazione: applica su prova → test (RLS con ruoli simulati, funzioni) → rollback su prova →
riapplica → solo allora produzione (`supabase db query --linked -f ...`).

## Riallineare lo schema alla produzione
`supabase db dump --linked -s public -f schema.sql`, poi applicarlo con `psql` come sopra su un progetto di prova
vuoto (o dopo aver eliminato e ricreato lo schema `public`). Bucket, policy di storage e pubblicazione realtime
non sono nel dump dello schema `public` e vanno ricreati a parte.
