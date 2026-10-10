-- ============================================================
-- Verifica in due passaggi obbligatoria anche nel database.
-- Un utente autenticato con sola password ha una sessione di livello aal1: il database gli risponde solo
-- quando la sessione e' aal2 (codice dell'app di autenticazione verificato). Tre livelli:
--  1. controllo_mfa(): eseguita da PostgREST prima di OGNI richiesta (tabelle, viste, funzioni rpc);
--  2. policy RESTRICTIVE "mfa_aal2" su ogni tabella public con RLS (vale anche per Realtime) e su storage.objects;
--  3. registro degli azzeramenti (telefono perso) e regola su chi puo' azzerare chi.
-- Esclusa solo sessioni_pmi360 (sessione unica: contiene solo l'identificativo della propria sessione).
-- I ruoli anon e service_role non sono toccati.
-- ============================================================

begin;

create or replace function public.sessione_aal2()
returns boolean language sql stable as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$$;

create or replace function public.controllo_mfa()
returns void language plpgsql stable as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') = 'authenticated' and not public.sessione_aal2() then
    raise sqlstate 'PT403' using message = 'Verifica in due passaggi richiesta', hint = 'mfa_richiesta';
  end if;
end $$;
grant execute on function public.sessione_aal2(), public.controllo_mfa() to anon, authenticated, service_role;

do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname <> 'sessioni_pmi360'
  loop
    execute format('drop policy if exists mfa_aal2 on public.%I', t.relname);
    execute format('create policy mfa_aal2 on public.%I as restrictive for all to authenticated using (public.sessione_aal2()) with check (public.sessione_aal2())', t.relname);
  end loop;
end $$;

drop policy if exists mfa_aal2 on storage.objects;
create policy mfa_aal2 on storage.objects as restrictive for all to authenticated
  using (public.sessione_aal2()) with check (public.sessione_aal2());

-- Registro degli azzeramenti della verifica (scritto dalla funzione azzera-mfa con la chiave di servizio)
create table if not exists public.mfa_azzeramenti (
  id bigint generated always as identity primary key,
  utente_id uuid references auth.users(id) on delete set null,
  utente_email text,
  eseguito_da uuid references auth.users(id) on delete set null,
  eseguito_da_email text,
  motivo text,
  fattori_rimossi integer not null default 0,
  creato_il timestamptz not null default now()
);
alter table public.mfa_azzeramenti enable row level security;
drop policy if exists mfa_azzeramenti_lettura on public.mfa_azzeramenti;
create policy mfa_azzeramenti_lettura on public.mfa_azzeramenti for select to authenticated
  using (is_proprietario() or eseguito_da = auth.uid() or utente_id = auth.uid());
drop policy if exists mfa_aal2 on public.mfa_azzeramenti;
create policy mfa_aal2 on public.mfa_azzeramenti as restrictive for all to authenticated
  using (public.sessione_aal2()) with check (public.sessione_aal2());

-- Chi puo' azzerare la verifica di un utente: il proprietario per chiunque; il gestore per i membri delle
-- proprie aziende (non per se stesso: un gestore che perde il telefono si rivolge al proprietario).
create or replace function public.puo_azzerare_mfa(p_utente uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.sessione_aal2() and auth.uid() is not null and (
    is_proprietario()
    or (p_utente <> auth.uid() and exists (
          select 1 from membri m where m.user_id = p_utente and m.azienda_id in (select mie_aziende_gestore())))
  )
$$;
revoke all on function public.puo_azzerare_mfa(uuid) from public, anon;
grant execute on function public.puo_azzerare_mfa(uuid) to authenticated;

commit;

-- Attivazione del controllo su ogni richiesta (fuori dalla transazione)
alter role authenticator set pgrst.db_pre_request = 'public.controllo_mfa';
notify pgrst, 'reload config';
