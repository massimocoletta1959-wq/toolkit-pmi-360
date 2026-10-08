-- Un solo dispositivo per utente in Pmi 360°: vale l'accesso piu' recente. Ogni accesso crea una sessione di
-- Supabase Auth (auth.sessions) il cui id e' nel token ("session_id"). Il portale registra in sessioni_pmi360 la
-- propria sessione: la registrazione passa a una sessione nuova solo se e' stata creata DOPO quella registrata
-- (o se quella registrata non esiste piu'), quindi non c'e' "ping-pong" tra due dispositivi. Le sessioni di altre
-- applicazioni sullo stesso progetto (es. portale licenze) non si registrano e non disconnettono nessuno.
-- Le schede dello stesso browser condividono la sessione. Controllo lato portale: src/components/ControlloSessione.js
create table if not exists public.sessioni_pmi360 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  creata_il timestamptz not null,
  aggiornata_il timestamptz not null default now()
);
alter table public.sessioni_pmi360 enable row level security;
-- nessuna policy: si legge e si scrive solo tramite la funzione qui sotto

create or replace function public.sessione_valida()
returns boolean
language plpgsql volatile security definer
set search_path = public, auth
as $$
declare
  v_corrente uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_creata timestamptz;
  v_reg record;
  v_reg_viva boolean;
begin
  if auth.uid() is null or v_corrente is null then return true; end if;   -- token senza id di sessione: non si blocca
  select created_at into v_creata from auth.sessions where id = v_corrente;
  select * into v_reg from sessioni_pmi360 where user_id = auth.uid();
  if v_reg is null or v_reg.session_id = v_corrente then
    insert into sessioni_pmi360 (user_id, session_id, creata_il) values (auth.uid(), v_corrente, coalesce(v_creata, now()))
      on conflict (user_id) do update set aggiornata_il = now(), session_id = excluded.session_id, creata_il = excluded.creata_il;
    return true;
  end if;
  select exists (select 1 from auth.sessions s where s.id = v_reg.session_id and (s.not_after is null or s.not_after > now())) into v_reg_viva;
  -- accesso piu' recente di quello registrato, o registrato non piu' attivo: questa sessione diventa quella valida
  if not v_reg_viva or coalesce(v_creata, now()) > v_reg.creata_il then
    update sessioni_pmi360 set session_id = v_corrente, creata_il = coalesce(v_creata, now()), aggiornata_il = now() where user_id = auth.uid();
    return true;
  end if;
  return false;
end
$$;
revoke all on function public.sessione_valida() from public;
grant execute on function public.sessione_valida() to authenticated;
