-- ============================================================
-- Registro accessi (consultabile solo dal proprietario, nel portale licenze)
-- L'app registra ogni apertura con sessione valida ("accesso", al massimo una
-- ogni 30 minuti per utente) e ogni "uscita". IP e browser dalle intestazioni
-- della richiesta.
-- ============================================================

begin;

create table if not exists public.log_accessi (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  evento text not null check (evento in ('accesso', 'uscita')),
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists log_accessi_user_data on public.log_accessi (user_id, created_at desc);
alter table public.log_accessi enable row level security;
create policy "log_accessi_proprietario" on public.log_accessi for select to authenticated using (is_proprietario());

-- Scrittura: solo tramite questa funzione, per l'utente stesso
create or replace function public.registra_accesso(p_evento text default 'accesso')
returns void language plpgsql security definer set search_path = public as $$
declare
  h  json := nullif(current_setting('request.headers', true), '')::json;
  ip text := trim(split_part(coalesce(h ->> 'x-forwarded-for', h ->> 'x-real-ip', ''), ',', 1));
begin
  if auth.uid() is null or p_evento not in ('accesso', 'uscita') then return; end if;
  if p_evento = 'accesso' and exists (
       select 1 from log_accessi where user_id = auth.uid() and evento = 'accesso'
          and created_at > now() - interval '30 minutes') then
    return;
  end if;
  insert into log_accessi (user_id, evento, ip, user_agent)
  values (auth.uid(), p_evento, nullif(ip, ''), left(h ->> 'user-agent', 300));
end $$;
revoke all on function public.registra_accesso(text) from public, anon;
grant execute on function public.registra_accesso(text) to authenticated;

-- Ruoli di un utente: proprietario, gestore, incaricato (d'organo), membro
create or replace function public.ruoli_utente(uid uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when exists (select 1 from proprietari where user_id = uid) then 'proprietario' end,
    case when exists (select 1 from gestori where user_id = uid)
           or exists (select 1 from utente_aziende where utente_id = uid and coalesce(ruolo, 'owner') <> 'membro') then 'gestore' end,
    case when exists (select 1 from organo_incaricati oi join membri m on m.id = oi.membro_id
                       where oi.data_revoca is null and m.user_id = uid) then 'incaricato' end,
    case when exists (select 1 from utente_aziende where utente_id = uid and ruolo = 'membro')
           or exists (select 1 from membri where user_id = uid) then 'membro' end
  ], null)
$$;

-- Riepilogo per utente (solo proprietario)
create or replace function public.admin_riepilogo_accessi()
returns table (user_id uuid, email text, nome text, ruoli text[], aziende text, licenza text,
               registrato_il timestamptz, ultimo_accesso timestamptz, accessi_30gg bigint,
               sessioni_attive bigint, ultimo_ip text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_proprietario() then raise exception 'Riservato al proprietario'; end if;
  return query
  select u.id, u.email::text,
         coalesce(nullif(p.nome, ''), (select trim(m.nome || ' ' || m.cognome) from membri m where m.user_id = u.id limit 1)),
         ruoli_utente(u.id),
         (select string_agg(distinct a.nome, ', ') from utente_aziende ua join aziende a on a.id = ua.azienda_id where ua.utente_id = u.id),
         (select g.stato from gestori g where g.user_id = u.id limit 1),
         u.created_at,
         greatest(u.last_sign_in_at, (select max(l.created_at) from log_accessi l where l.user_id = u.id and l.evento = 'accesso')),
         (select count(*) from log_accessi l where l.user_id = u.id and l.evento = 'accesso' and l.created_at > now() - interval '30 days'),
         (select count(*) from auth.sessions s where s.user_id = u.id and (s.not_after is null or s.not_after > now())),
         (select l.ip from log_accessi l where l.user_id = u.id order by l.created_at desc limit 1)
    from auth.users u
    left join profili p on p.id = u.id
   order by 8 desc nulls last;
end $$;

-- Dettaglio eventi (solo proprietario), facoltativamente per un utente
create or replace function public.admin_log_accessi(p_user uuid default null, p_giorni int default 90)
returns table (created_at timestamptz, user_id uuid, email text, evento text, ip text, user_agent text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_proprietario() then raise exception 'Riservato al proprietario'; end if;
  return query
  select l.created_at, l.user_id, u.email::text, l.evento, l.ip, l.user_agent
    from log_accessi l join auth.users u on u.id = l.user_id
   where (p_user is null or l.user_id = p_user)
     and l.created_at > now() - make_interval(days => greatest(p_giorni, 1))
   order by l.created_at desc
   limit 1000;
end $$;

revoke all on function public.admin_riepilogo_accessi(), public.admin_log_accessi(uuid, int), public.ruoli_utente(uuid) from public, anon;
grant execute on function public.admin_riepilogo_accessi(), public.admin_log_accessi(uuid, int) to authenticated;

-- Storico iniziale: le sessioni ancora presenti (data di accesso, IP, browser)
insert into public.log_accessi (user_id, evento, ip, user_agent, created_at)
select s.user_id, 'accesso', host(s.ip), left(s.user_agent, 300), s.created_at from auth.sessions s;

commit;
