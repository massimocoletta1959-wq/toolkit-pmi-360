-- ============================================================
-- Documenti legali (informativa privacy, condizioni di servizio, ...) con versioni e
-- registro delle accettazioni. Un documento e' in vigore quando ha pubblicato_il: da quel
-- momento il testo non si modifica piu' (una revisione = nuova versione). Gli utenti a cui
-- il documento e' destinato lo devono accettare al primo accesso utile; l'accettazione
-- registra utente, email, data, IP, browser e impronta SHA-256 del testo accettato.
-- Finche' nessun documento e' pubblicato, il portale non chiede nulla.
-- ============================================================

begin;

create table if not exists public.documenti_legali (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('informativa_portale', 'condizioni_servizio', 'accordo_responsabile', 'cookie_policy', 'sub_responsabili')),
  versione text not null,
  titolo text not null,
  testo text not null,
  sha256 text generated always as (encode(extensions.digest(testo, 'sha256'), 'hex')) stored,
  -- tutti = ogni utente del portale; consulenti = chi gestisce aziende (non i membri operativi)
  destinatari text not null default 'tutti' check (destinatari in ('tutti', 'consulenti')),
  -- false = solo consultabile (es. elenco sub-responsabili), true = da accettare / prendere visione
  richiede_accettazione boolean not null default true,
  -- formula del consenso mostrata accanto alla casella
  formula text not null default 'Ho letto e accetto',
  pubblicato_il timestamptz,
  creato_il timestamptz not null default now(),
  unique (tipo, versione)
);

-- Testo pubblicato immutabile; un documento pubblicato non si elimina (le accettazioni vi fanno riferimento)
create or replace function public.documenti_legali_immutabili()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.pubblicato_il is not null then raise exception 'Documento pubblicato: non si elimina'; end if;
    return old;
  end if;
  if old.pubblicato_il is not null and (new.testo is distinct from old.testo or new.versione is distinct from old.versione
       or new.tipo is distinct from old.tipo or new.pubblicato_il is distinct from old.pubblicato_il) then
    raise exception 'Documento pubblicato: per modificarlo pubblica una nuova versione';
  end if;
  return new;
end $$;
drop trigger if exists documenti_legali_immutabili on public.documenti_legali;
create trigger documenti_legali_immutabili before update or delete on public.documenti_legali
  for each row execute function public.documenti_legali_immutabili();

alter table public.documenti_legali enable row level security;
-- I documenti pubblicati sono pubblici (consultabili anche dal sito); le bozze no.
-- Nessuna policy di scrittura: si pubblicano solo da SQL / chiave di servizio.
drop policy if exists documenti_legali_lettura on public.documenti_legali;
create policy documenti_legali_lettura on public.documenti_legali for select to anon, authenticated
  using (pubblicato_il is not null and pubblicato_il <= now());

create table if not exists public.accettazioni_documenti (
  id bigint generated always as identity primary key,
  -- set null: se l'account viene eliminato resta la prova dell'accettazione (email, data, impronta)
  user_id uuid references auth.users(id) on delete set null,
  email text,
  documento_id uuid not null references public.documenti_legali(id),
  sha256 text not null,
  accettato_il timestamptz not null default now(),
  ip text,
  user_agent text,
  unique (user_id, documento_id)
);
create index if not exists accettazioni_documenti_documento on public.accettazioni_documenti (documento_id);
alter table public.accettazioni_documenti enable row level security;
drop policy if exists accettazioni_proprie on public.accettazioni_documenti;
create policy accettazioni_proprie on public.accettazioni_documenti for select to authenticated
  using (user_id = auth.uid() or is_proprietario());
-- Scrittura solo tramite accetta_documenti()

-- Ultima versione in vigore di ogni tipo
create or replace view public.documenti_legali_in_vigore with (security_invoker = true) as
  select distinct on (tipo) id, tipo, versione, titolo, testo, sha256, destinatari, richiede_accettazione, formula, pubblicato_il
    from public.documenti_legali
   where pubblicato_il is not null and pubblicato_il <= now()
   order by tipo, pubblicato_il desc;
grant select on public.documenti_legali_in_vigore to anon, authenticated;

-- Documenti in vigore che l'utente corrente deve ancora accettare
create or replace function public.documenti_da_accettare()
returns table (id uuid, tipo text, versione text, titolo text, testo text, sha256 text, formula text, pubblicato_il timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, d.tipo, d.versione, d.titolo, d.testo, d.sha256, d.formula, d.pubblicato_il
    from documenti_legali_in_vigore d
   where auth.uid() is not null
     and d.richiede_accettazione
     and (d.destinatari = 'tutti'
          or (d.destinatari = 'consulenti' and coalesce((select p.ruolo from profili p where p.id = auth.uid()), 'consulente') <> 'membro'))
     and not exists (select 1 from accettazioni_documenti a where a.documento_id = d.id and a.user_id = auth.uid())
   order by case d.tipo when 'informativa_portale' then 1 when 'condizioni_servizio' then 2 when 'accordo_responsabile' then 3 else 9 end
$$;

-- Registra l'accettazione dei documenti indicati (solo quelli effettivamente da accettare)
create or replace function public.accetta_documenti(p_ids uuid[])
returns integer language plpgsql security definer set search_path = public, auth as $$
declare
  h  json := nullif(current_setting('request.headers', true), '')::json;
  ip text := trim(split_part(coalesce(h ->> 'x-forwarded-for', h ->> 'x-real-ip', ''), ',', 1));
  n  integer;
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  insert into accettazioni_documenti (user_id, email, documento_id, sha256, ip, user_agent)
  select auth.uid(), (select u.email from auth.users u where u.id = auth.uid()), d.id, d.sha256, nullif(ip, ''), left(h ->> 'user-agent', 300)
    from documenti_da_accettare() d
   where d.id = any(p_ids)
  on conflict (user_id, documento_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.documenti_da_accettare(), public.accetta_documenti(uuid[]) from public, anon;
grant execute on function public.documenti_da_accettare(), public.accetta_documenti(uuid[]) to authenticated;

commit;
