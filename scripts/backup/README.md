# Backup giornaliero di Pmi 360°

`backup_pmi360.py` copia ogni giorno il database di produzione (struttura dello schema `public`, dati di `public`, `auth`, `storage`) e tutti i file di Storage in `~/Backup-pmi360/AAAA-MM-GG_HHMM/`, tiene le ultime 30 copie riuscite e mostra una notifica sul Mac.

- Avvio: launchd (`it.pmi360.backup.plist` in `~/Library/LaunchAgents/`) all'accesso e poi ogni ora; lo script fa **una sola copia al giorno** e, senza rete, riprova all'ora successiva.
- Script installato in `~/Library/Application Support/pmi360-backup/` (dopo una modifica qui, ricopiarlo lì).
- Accesso: ruolo temporaneo della Supabase CLI (Management API, 5 minuti) con il token della CLI letto dal portachiavi; `pg_dump` 17 di Homebrew (`brew install postgresql@17`). Nessuna credenziale su disco.
- Registro: `~/Backup-pmi360/backup.log`. Copia manuale immediata: `python3 backup_pmi360.py --forza`.
- Le copie contengono dati personali: cartella leggibile solo dall'utente, disco cifrato con FileVault.

Ripristino (indicativo): creare il progetto o usare quello esistente, applicare `2_struttura.sql`, poi `3_dati.sql` con `psql`, e ricaricare i file di `4_file/<bucket>/` in Storage con lo stesso percorso.
