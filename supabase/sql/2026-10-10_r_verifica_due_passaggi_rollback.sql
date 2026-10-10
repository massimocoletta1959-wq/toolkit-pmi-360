-- Rollback della verifica in due passaggi nel database (il registro degli azzeramenti viene eliminato)
alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';

begin;
do $$
declare t record;
begin
  for t in select tablename from pg_policies where schemaname = 'public' and policyname = 'mfa_aal2' loop
    execute format('drop policy if exists mfa_aal2 on public.%I', t.tablename);
  end loop;
end $$;
drop policy if exists mfa_aal2 on storage.objects;
drop function if exists public.puo_azzerare_mfa(uuid);
drop table if exists public.mfa_azzeramenti;
drop function if exists public.controllo_mfa();
drop function if exists public.sessione_aal2();
commit;
