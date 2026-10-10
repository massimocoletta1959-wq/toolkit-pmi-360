-- Rollback dei documenti legali e delle accettazioni (elimina anche il registro delle accettazioni!)
begin;
drop function if exists public.accetta_documenti(uuid[]);
drop function if exists public.documenti_da_accettare();
drop view if exists public.documenti_legali_in_vigore;
drop table if exists public.accettazioni_documenti;
drop table if exists public.documenti_legali;
drop function if exists public.documenti_legali_immutabili();
commit;
