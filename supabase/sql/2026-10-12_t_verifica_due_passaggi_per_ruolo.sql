-- ============================================================
-- Verifica in due passaggi obbligatoria solo per chi vede dati riservati di piu' aziende o degli organi:
-- proprietario, gestori (consulenti) e incaricati d'organo attivi. Il membro operativo entra con la sola
-- password; se ha attivato la verifica di sua iniziativa, gli resta richiesta.
-- Sostituisce la regola "aal2 per tutti" di 2026-10-10_r: stesso controllo su ogni richiesta (controllo_mfa)
-- e stesse policy RESTRICTIVE "mfa_aal2", con la nuova condizione mfa_soddisfatta().
-- ============================================================

begin;

-- chi deve usare la verifica in due passaggi
create or replace function public.richiede_mfa(uid uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select uid is not null and (
       exists (select 1 from proprietari where user_id = uid)
    or exists (select 1 from gestori where user_id = uid)
    or exists (select 1 from utente_aziende where utente_id = uid and coalesce(ruolo, 'owner') <> 'membro')
    or exists (select 1 from organo_incaricati oi join membri m on m.id = oi.membro_id
                where oi.data_revoca is null and m.user_id = uid)
    or exists (select 1 from auth.mfa_factors f where f.user_id = uid and f.status = 'verified')
  )
$$;
revoke all on function public.richiede_mfa(uuid) from public, anon, authenticated;

-- la richiesta corrente rispetta la regola? (sessione aal2, oppure utente che non deve usarla)
create or replace function public.mfa_soddisfatta()
returns boolean language sql stable security definer set search_path = public as $$
  select public.sessione_aal2() or not public.richiede_mfa(auth.uid())
$$;
grant execute on function public.mfa_soddisfatta() to anon, authenticated, service_role;

create or replace function public.controllo_mfa()
returns void language plpgsql stable as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') = 'authenticated' and not public.mfa_soddisfatta() then
    raise sqlstate 'PT403' using message = 'Verifica in due passaggi richiesta', hint = 'mfa_richiesta';
  end if;
end $$;

-- per il portale: se la chiamata arriva qui la regola e' rispettata; dice se l'utente deve usare la verifica
create or replace function public.mfa_stato()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('richiesta', public.richiede_mfa(auth.uid()), 'aal2', public.sessione_aal2())
$$;
revoke all on function public.mfa_stato() from public, anon;
grant execute on function public.mfa_stato() to authenticated;

-- policy restrittive con la nuova condizione (valutata una volta per query)
do $$
declare t record;
begin
  for t in select tablename from pg_policies where schemaname = 'public' and policyname = 'mfa_aal2' loop
    execute format('drop policy mfa_aal2 on public.%I', t.tablename);
    execute format('create policy mfa_aal2 on public.%I as restrictive for all to authenticated using ((select public.mfa_soddisfatta())) with check ((select public.mfa_soddisfatta()))', t.tablename);
  end loop;
end $$;
drop policy if exists mfa_aal2 on storage.objects;
create policy mfa_aal2 on storage.objects as restrictive for all to authenticated
  using ((select public.mfa_soddisfatta())) with check ((select public.mfa_soddisfatta()));

-- azzeramento: il gestore puo' azzerare la verifica dei membri delle proprie aziende anche se non e' obbligatoria
create or replace function public.puo_azzerare_mfa(p_utente uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_soddisfatta() and auth.uid() is not null and (
    is_proprietario()
    or (p_utente <> auth.uid() and exists (
          select 1 from membri m where m.user_id = p_utente and m.azienda_id in (select mie_aziende_gestore())))
  )
$$;

commit;
notify pgrst, 'reload config';
