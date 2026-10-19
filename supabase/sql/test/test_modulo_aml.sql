-- Test del modulo AML (in transazione annullata, sul progetto di prova). Utenti simulati:
-- G gestore dell'azienda A (mod_aml), O gestore di un'altra azienda, D membro di A con ruolo DSOS.
begin;
\set ON_ERROR_STOP 1
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'g@prova.it'),
  ('00000000-0000-0000-0000-0000000000a2', 'o@prova.it'),
  ('00000000-0000-0000-0000-0000000000a3', 'd@prova.it');
insert into public.aziende (id, nome, mod_aml) values ('00000000-0000-0000-0000-00000000000a', 'Prova AML', true), ('00000000-0000-0000-0000-00000000000b', 'Altra', true);
delete from public.utente_aziende where azienda_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
insert into public.utente_aziende (utente_id, azienda_id, ruolo) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000b', 'owner'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000000a', 'membro');
insert into public.membri (id, azienda_id, nome, cognome, user_id) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'Delegato', 'Sos', '00000000-0000-0000-0000-0000000000a3');
insert into public.ruoli (azienda_id, sigla, nome, membro_id) values ('00000000-0000-0000-0000-00000000000a', 'DSOS', 'Delegato SOS', '00000000-0000-0000-0000-0000000000d1');

create temp table esiti (n serial, test text, ok boolean);
grant all on esiti to authenticated; grant usage on sequence esiti_n_seq to authenticated;

-- ── G: gestore dell'azienda A ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', true);
insert into public.aml_clienti (id, azienda_id, tipo, denominazione) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'debitore', 'Mario Rossi');
do $$ begin
  insert into public.aml_clienti (azienda_id, tipo, denominazione) values ('00000000-0000-0000-0000-00000000000b', 'debitore', 'X');
  insert into esiti (test, ok) values ('G non scrive su azienda altrui', false);
exception when others then insert into esiti (test, ok) values ('G non scrive su azienda altrui', true); end $$;
insert into public.aml_valutazioni (id, azienda_id, cliente_id, tipo, classe_calcolata, classe, motivazione, prossima_revisione)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'iniziale', 'medio', 'medio', 'Debitore persona fisica, importo sotto soglia, paga da conto proprio.', current_date + 730);
insert into esiti (test, ok) select 'classe del cliente aggiornata', classe_rischio = 'medio' and prossima_revisione = current_date + 730 from public.aml_clienti where id = '00000000-0000-0000-0000-0000000000c1';
do $$ begin
  insert into public.aml_valutazioni (azienda_id, cliente_id, tipo, classe, motivazione) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'iniziale', 'basso', 'corta');
  insert into esiti (test, ok) values ('motivazione obbligatoria', false);
exception when check_violation then insert into esiti (test, ok) values ('motivazione obbligatoria', true); end $$;
do $$ begin
  insert into public.aml_valutazioni (azienda_id, cliente_id, tipo, classe, motivazione) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'riesame_periodico', 'basso', 'Riesame senza evidenze compilate del tutto');
  insert into esiti (test, ok) values ('riesame richiede informazioni, variazioni, conseguenze', false);
exception when check_violation then insert into esiti (test, ok) values ('riesame richiede informazioni, variazioni, conseguenze', true); end $$;
do $$ begin
  update public.aml_valutazioni set motivazione = 'Motivazione cambiata dopo il salvataggio' where id = '00000000-0000-0000-0000-0000000000e1';
  insert into esiti (test, ok) values ('valutazione non modificabile', false);
exception when others then insert into esiti (test, ok) values ('valutazione non modificabile', true); end $$;
update public.aml_valutazioni set validata_nome = 'G' where id = '00000000-0000-0000-0000-0000000000e1';
insert into esiti (test, ok) select 'validazione registrata', validata_da = '00000000-0000-0000-0000-0000000000a1' and validata_il is not null from public.aml_valutazioni where id = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  delete from public.aml_valutazioni where id = '00000000-0000-0000-0000-0000000000e1';
exception when others then null; end $$;
insert into esiti (test, ok) select 'valutazione non cancellabile', count(*) = 1 from public.aml_valutazioni where id = '00000000-0000-0000-0000-0000000000e1';

-- trigger AML-05
insert into public.aml_trigger (id, azienda_id, cliente_id, tipo, importo, descrizione) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'terzo_pagatore', 3000, 'Bonifico proposto dal cognato');
insert into esiti (test, ok) select 'trigger blocca la posizione', stato = 'bloccato' from public.aml_clienti where id = '00000000-0000-0000-0000-0000000000c1';
do $$ begin
  update public.aml_clienti set stato = 'attivo' where id = '00000000-0000-0000-0000-0000000000c1';
  insert into esiti (test, ok) values ('sblocco manuale impedito', false);
exception when others then insert into esiti (test, ok) values ('sblocco manuale impedito', true); end $$;
do $$ begin
  update public.aml_trigger set stato = 'archiviato' where id = '00000000-0000-0000-0000-0000000000f1';
  insert into esiti (test, ok) values ('chiusura richiede esito motivato', false);
exception when check_violation then insert into esiti (test, ok) values ('chiusura richiede esito motivato', true); end $$;
update public.aml_trigger set stato = 'archiviato', fonti_consultate = 'Liste UE/ONU, notizie avverse', esito_motivato = 'Legame familiare documentato, fondi da conto del cognato con dichiarazione: rischio basso.' where id = '00000000-0000-0000-0000-0000000000f1';
insert into esiti (test, ok) select 'chiusura sblocca la posizione', stato = 'attivo' from public.aml_clienti where id = '00000000-0000-0000-0000-0000000000c1';
insert into esiti (test, ok) select 'chiusura registra autore e data', chiuso_da = '00000000-0000-0000-0000-0000000000a1' and chiuso_il is not null from public.aml_trigger where id = '00000000-0000-0000-0000-0000000000f1';
do $$ begin
  update public.aml_trigger set esito_motivato = 'Esito riscritto dopo la chiusura del trigger' where id = '00000000-0000-0000-0000-0000000000f1';
  insert into esiti (test, ok) values ('trigger chiuso non modificabile', false);
exception when others then insert into esiti (test, ok) values ('trigger chiuso non modificabile', true); end $$;

-- SOS: G (non DSOS) segnala ma non legge
insert into public.aml_sos (azienda_id, cliente_id, descrizione, segnalante) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Segnalazione di prova del gestore', '00000000-0000-0000-0000-0000000000a1');
insert into esiti (test, ok) select 'il gestore non legge il registro SOS', count(*) = 0 from public.aml_sos;
insert into esiti (test, ok) select 'cronologia leggibile dal gestore', count(*) >= 5 from public.aml_registro where cliente_id = '00000000-0000-0000-0000-0000000000c1';

-- ── O: gestore di un'altra azienda ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated","aal":"aal2"}', true);
insert into esiti (test, ok) select 'altro gestore non vede i clienti', count(*) = 0 from public.aml_clienti;
insert into esiti (test, ok) select 'altro gestore non vede la cronologia', count(*) = 0 from public.aml_registro;

-- ── G senza secondo passaggio ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
insert into esiti (test, ok) select 'senza MFA nessun dato', count(*) = 0 from public.aml_clienti;

-- ── D: membro con ruolo DSOS ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated","aal":"aal1"}', true);
insert into public.aml_sos (azienda_id, descrizione, segnalante) values ('00000000-0000-0000-0000-00000000000a', 'Segnalazione del delegato stesso', '00000000-0000-0000-0000-0000000000a3');
insert into esiti (test, ok) select 'il DSOS legge tutte le segnalazioni', count(*) = 2 from public.aml_sos;
insert into esiti (test, ok) select 'il DSOS non vede i fascicoli', count(*) = 0 from public.aml_clienti;
do $$ begin
  update public.aml_sos set stato = 'archiviata' where azienda_id = '00000000-0000-0000-0000-00000000000a';
  insert into esiti (test, ok) values ('archiviazione SOS richiede motivazione', false);
exception when check_violation then insert into esiti (test, ok) values ('archiviazione SOS richiede motivazione', true); end $$;
update public.aml_sos set stato = 'archiviata', motivazione_decisione = 'Nessun elemento di sospetto dopo istruttoria', data_decisione = current_date where descrizione like 'Segnalazione del delegato%';
insert into esiti (test, ok) select 'il DSOS decide', count(*) = 1 from public.aml_sos where stato = 'archiviata';

reset role;
select n, test, case when ok then 'OK' else 'KO' end from esiti order by n;
rollback;
