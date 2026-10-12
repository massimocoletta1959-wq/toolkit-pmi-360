-- Rollback: torna alla verifica in due passaggi obbligatoria per tutti (regola di 2026-10-10_r)
begin;
create or replace function public.controllo_mfa()
returns void language plpgsql stable as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') = 'authenticated' and not public.sessione_aal2() then
    raise sqlstate 'PT403' using message = 'Verifica in due passaggi richiesta', hint = 'mfa_richiesta';
  end if;
end $$;
do $$
declare t record;
begin
  for t in select tablename from pg_policies where schemaname = 'public' and policyname = 'mfa_aal2' loop
    execute format('drop policy mfa_aal2 on public.%I', t.tablename);
    execute format('create policy mfa_aal2 on public.%I as restrictive for all to authenticated using (public.sessione_aal2()) with check (public.sessione_aal2())', t.tablename);
  end loop;
end $$;
drop policy if exists mfa_aal2 on storage.objects;
create policy mfa_aal2 on storage.objects as restrictive for all to authenticated
  using (public.sessione_aal2()) with check (public.sessione_aal2());
create or replace function public.puo_azzerare_mfa(p_utente uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.sessione_aal2() and auth.uid() is not null and (
    is_proprietario()
    or (p_utente <> auth.uid() and exists (
          select 1 from membri m where m.user_id = p_utente and m.azienda_id in (select mie_aziende_gestore())))
  )
$$;
drop function if exists public.mfa_stato();
drop function if exists public.mfa_soddisfatta();
drop function if exists public.richiede_mfa(uuid);
commit;
notify pgrst, 'reload config';
