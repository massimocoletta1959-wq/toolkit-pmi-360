# Documenti legali di Pmi 360° — bozze

**Stato: versione 1.2 pubblicata il 10/10/2026** (portale: informativa, condizioni, accordo art. 28, sub-responsabili; sito: informativa in public/privacy.html del repository pmi360-sito). I testi pubblicati sono immutabili: ogni modifica si pubblica come nuova versione.

| File | Documento | Dove va | Nel portale (`documenti_legali.tipo`) |
|---|---|---|---|
| `informativa-portale.md` | Informativa per gli utenti del portale | presa visione al primo accesso, per tutti | `informativa_portale`, destinatari `tutti`, formula «Ho preso visione» |
| `condizioni-servizio.md` | Condizioni generali di servizio | accettazione al primo accesso, per i consulenti | `condizioni_servizio`, destinatari `consulenti`, formula «Ho letto e accetto» |
| `accordo-responsabile.md` | Accordo art. 28 GDPR | accettazione insieme alle condizioni, per i consulenti | `accordo_responsabile`, destinatari `consulenti` |
| `sub-responsabili.md` | Elenco dei sub-responsabili | solo consultazione | `sub_responsabili`, `richiede_accettazione = false` |
| `informativa-sito.md` | Informativa del sito pmi360.it | pagina del sito e modulo demo | — (sito) |
| `procedura-violazioni.md` | Procedura di gestione delle violazioni (art. 33-34 GDPR) | uso interno, richiamata nell'accordo art. 28 | — (interno) |

La cookie policy si genera con il servizio di gestione dei cookie acquistato su Aruba.

## Come funziona l'accettazione nel portale

- Un documento è in vigore quando ha `pubblicato_il`. Da quel momento il testo non si modifica né si cancella (trigger): una revisione è una **nuova versione**, che il portale ripropone a tutti al primo accesso.
- Dopo l'accesso, chi ha documenti in vigore non ancora accettati vede la pagina «Prima di continuare» e non entra finché non spunta tutto. Il membro operativo vede solo i documenti con destinatari `tutti`.
- Ogni accettazione registra utente, email, data e ora, indirizzo IP, browser e impronta SHA-256 del testo accettato (`accettazioni_documenti`). Ogni utente vede solo le proprie; il proprietario le vede tutte.
- Tutti consultano i documenti in vigore e le proprie accettazioni dal link «Privacy e documenti legali» in fondo alla barra laterale.
- Finché nessun documento è pubblicato, il portale non chiede nulla.

## Pubblicare un documento (dopo l'approvazione dei testi)

Il testo nel database è il Markdown del file (titoli `#`, elenchi `-` e `1.`, tabelle `|`, grassetto `**`). Esempio, eseguito con `supabase db query --linked` dopo la prova su pmi360-test:

```sql
insert into documenti_legali (tipo, versione, titolo, testo, destinatari, formula, pubblicato_il)
values ('informativa_portale', '1.0', 'Informativa privacy per gli utenti del portale',
        $testo$ ...contenuto del file... $testo$, 'tutti', 'Ho preso visione', now());
```

Per una prova senza bloccare gli utenti si può inserire il documento con `pubblicato_il` nel futuro: non è in vigore finché non arriva quella data.
