-- Rollback dell'anteprima dei documenti legali (le bozze in anteprima tornano invisibili)
begin;
drop view if exists public.documenti_legali_in_vigore;
create view public.documenti_legali_in_vigore with (security_invoker = true) as
  select distinct on (tipo) id, tipo, versione, titolo, testo, sha256, destinatari, richiede_accettazione, formula, pubblicato_il
    from public.documenti_legali
   where pubblicato_il is not null and pubblicato_il <= now()
   order by tipo, pubblicato_il desc;
grant select on public.documenti_legali_in_vigore to anon, authenticated;
drop policy if exists documenti_legali_lettura on public.documenti_legali;
create policy documenti_legali_lettura on public.documenti_legali for select to anon, authenticated
  using (pubblicato_il is not null and pubblicato_il <= now());
alter table public.documenti_legali drop column if exists anteprima;
commit;
