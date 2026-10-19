-- ============================================================
-- Modulo Antiriciclaggio (AML, D.Lgs. 231/2007) — prima fase, attivo per ora solo su INTELLCREDIT S.P.A.
-- Procedure di riferimento AML-03 (profilatura), AML-04/05/06 (adeguata verifica, trigger, titolare effettivo),
-- AML-07 (controllo costante), AML-08 (conservazione), AML-09 (SOS).
--  - aziende.mod_aml: flag del modulo (lo imposta lo Studio)
--  - aml_clienti: mandanti e debitori; aml_soggetti: titolari effettivi, legali rappresentanti, terzi pagatori
--  - aml_valutazioni: profilatura e riesami, solo in aggiunta (nessuna modifica o cancellazione dopo il salvataggio,
--    salvo la validazione): ogni riga e' l'evidenza scritta di fattori, motivazione, variazioni e conseguenze
--  - aml_documenti: documenti del fascicolo con impronta SHA-256 e scadenza (bucket privato aml-documenti)
--  - aml_trigger: posizioni bloccate per trigger oggettivi (AML-05) ed esito motivato della funzione AML
--  - aml_sos: segnalazioni interne e registro SOS, leggibile SOLO dal Delegato SOS (ruolo DSOS dell'organigramma)
--  - aml_impostazioni: dati del registro giornale degli affari (cartaceo) e impostazioni del modulo
--  - aml_registro: cronologia delle operazioni (audit trail), scritta dai trigger
-- Accesso: gestori dell'azienda con mod_aml (aml_mie_aziende) + verifica in due passaggi (mfa_aal2).
-- ============================================================
begin;

alter table public.aziende add column if not exists mod_aml boolean not null default false;

create or replace function public.aml_mie_aziende()
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select g.id from public.aziende g
   where g.mod_aml and g.id in (select public.mie_aziende_gestore())
$$;

-- aziende in cui l'utente e' il Delegato SOS (persona assegnata al ruolo DSOS dell'organigramma)
create or replace function public.aml_dsos_aziende()
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select r.azienda_id from public.ruoli r
    join public.membri m on m.id = r.membro_id
    join public.aziende a on a.id = r.azienda_id
   where r.sigla = 'DSOS' and m.user_id = auth.uid() and a.mod_aml
$$;

-- aziende con modulo AML a cui l'utente e' collegato (anche come membro): possono inviare segnalazioni interne
create or replace function public.aml_aziende_utente()
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select ua.azienda_id from public.utente_aziende ua join public.aziende a on a.id = ua.azienda_id
   where ua.utente_id = auth.uid() and a.mod_aml
  union
  select m.azienda_id from public.membri m join public.aziende a on a.id = m.azienda_id
   where m.user_id = auth.uid() and a.mod_aml
$$;

-- ── Impostazioni e registro giornale degli affari ──
create table if not exists public.aml_impostazioni (
  azienda_id uuid primary key references public.aziende(id) on delete cascade,
  registro_responsabile text,
  registro_luogo text,
  registro_ultimo_aggiornamento date,
  impostazioni jsonb not null default '{}'::jsonb,
  aggiornato_il timestamptz not null default now(),
  aggiornato_da uuid default auth.uid()
);

-- ── Clienti: mandanti e debitori ──
create table if not exists public.aml_clienti (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  tipo text not null check (tipo in ('mandante', 'debitore')),
  natura text not null default 'persona_giuridica' check (natura in ('persona_fisica', 'persona_giuridica')),
  denominazione text not null,
  codice_fiscale text,
  partita_iva text,
  paese text not null default 'IT',
  indirizzo text,
  mandante_id uuid references public.aml_clienti(id) on delete set null,
  portafoglio text check (portafoglio in ('bancario', 'commerciale')),
  riferimento_pratica text,
  importo numeric(14,2),
  scopo_natura text,
  data_apertura date not null default current_date,
  stato text not null default 'attivo' check (stato in ('attivo', 'bloccato', 'chiuso')),
  data_chiusura date,
  classe_rischio text check (classe_rischio in ('basso', 'medio', 'alto')),
  ultima_valutazione date,
  prossima_revisione date,
  note text,
  creato_da uuid default auth.uid(),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create index if not exists aml_clienti_azienda on public.aml_clienti (azienda_id, tipo);
create index if not exists aml_clienti_mandante on public.aml_clienti (mandante_id);

-- ── Soggetti collegati: titolare effettivo, legale rappresentante, esecutore, terzo pagatore ──
create table if not exists public.aml_soggetti (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  cliente_id uuid not null references public.aml_clienti(id) on delete cascade,
  ruolo text not null check (ruolo in ('titolare_effettivo', 'legale_rappresentante', 'esecutore', 'terzo_pagatore')),
  nome text not null,
  codice_fiscale text,
  data_nascita date,
  paese text default 'IT',
  quota_pct numeric(6,2),
  criterio text,               -- proprieta' / controllo / residuale (legale rappresentante), legame col debitore
  pep boolean,
  esito_liste text check (esito_liste in ('negativo', 'omonimia', 'positivo')),
  fonte_verifica text,
  verificato_il date,
  note text,
  creato_da uuid default auth.uid(),
  creato_il timestamptz not null default now()
);
create index if not exists aml_soggetti_cliente on public.aml_soggetti (cliente_id);

-- ── Valutazioni: profilatura iniziale e riesami (evidenza del controllo costante) ──
create table if not exists public.aml_valutazioni (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  cliente_id uuid not null references public.aml_clienti(id) on delete cascade,
  tipo text not null check (tipo in ('iniziale', 'riesame_periodico', 'evento', 'trigger')),
  data date not null default current_date,
  fattori jsonb not null default '[]'::jsonb,   -- [{codice, fattore, scelta, punti, forza_alto, nota}]
  punteggio numeric(6,1),
  classe_calcolata text check (classe_calcolata in ('basso', 'medio', 'alto')),
  classe text not null check (classe in ('basso', 'medio', 'alto')),
  motivazione text not null check (length(btrim(motivazione)) >= 20),
  informazioni_verificate text,
  variazioni text,
  conseguenze text,
  prossima_revisione date,
  autore uuid default auth.uid(),
  autore_nome text,
  creato_il timestamptz not null default now(),
  validata_da uuid,
  validata_nome text,
  validata_il timestamptz,
  check (tipo = 'iniziale' or (informazioni_verificate is not null and variazioni is not null and conseguenze is not null))
);
create index if not exists aml_valutazioni_cliente on public.aml_valutazioni (cliente_id, data desc);

-- ── Documenti del fascicolo (cliente_id null = documenti aziendali: licenza, modulistica in bianco, manuale) ──
create table if not exists public.aml_documenti (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  cliente_id uuid references public.aml_clienti(id) on delete cascade,
  soggetto_id uuid references public.aml_soggetti(id) on delete set null,
  categoria text not null,
  descrizione text,
  data_documento date,
  scadenza date,
  storage_path text,
  nome_file text,
  dimensione bigint,
  sha256 text,
  annullato boolean not null default false,
  motivo_annullamento text,
  caricato_da uuid default auth.uid(),
  caricato_il timestamptz not null default now()
);
create index if not exists aml_documenti_cliente on public.aml_documenti (azienda_id, cliente_id);

-- ── Trigger AML-05: posizione bloccata e passata alla funzione AML ──
create table if not exists public.aml_trigger (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  cliente_id uuid not null references public.aml_clienti(id) on delete cascade,
  tipo text not null check (tipo in ('soglia_15000', 'terzo_pagatore', 'frazionamento', 'estero', 'fretta', 'rimborso', 'contante', 'altro')),
  data_rilevazione date not null default current_date,
  importo numeric(14,2),
  descrizione text not null,
  rilevato_da uuid default auth.uid(),
  rilevato_nome text,
  stato text not null default 'aperto' check (stato in ('aperto', 'archiviato', 'segnalato_dsos')),
  fonti_consultate text,
  esito_motivato text,
  chiuso_da uuid,
  chiuso_nome text,
  chiuso_il timestamptz,
  ticket_id uuid,
  creato_il timestamptz not null default now(),
  check (stato = 'aperto' or (length(btrim(coalesce(esito_motivato, ''))) >= 20 and length(btrim(coalesce(fonti_consultate, ''))) > 0))
);
create index if not exists aml_trigger_azienda on public.aml_trigger (azienda_id, stato);

-- ── Segnalazioni interne e registro SOS (riservato al Delegato SOS) ──
create table if not exists public.aml_sos (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  cliente_id uuid references public.aml_clienti(id) on delete set null,
  trigger_id uuid references public.aml_trigger(id) on delete set null,
  data_segnalazione date not null default current_date,
  segnalante uuid default auth.uid(),
  segnalante_nome text,
  soggetto text,                 -- nominativo del cliente/operazione come indicato dal segnalante
  descrizione text not null,
  stato text not null default 'ricevuta' check (stato in ('ricevuta', 'in_istruttoria', 'archiviata', 'inviata_uif')),
  istruttoria text,
  motivazione_decisione text,
  data_decisione date,
  protocollo_uif text,
  data_invio_uif date,
  allegati jsonb not null default '[]'::jsonb,   -- [{nome, path, sha256, caricato_il}]
  decisa_da uuid,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  check (stato in ('ricevuta', 'in_istruttoria') or (length(btrim(coalesce(motivazione_decisione, ''))) >= 20 and data_decisione is not null)),
  check (stato <> 'inviata_uif' or (protocollo_uif is not null and data_invio_uif is not null))
);
create index if not exists aml_sos_azienda on public.aml_sos (azienda_id, stato);

-- ── Cronologia (audit trail) ──
create table if not exists public.aml_registro (
  id bigint generated always as identity primary key,
  azienda_id uuid not null,
  cliente_id uuid,
  tabella text not null,
  record_id uuid,
  azione text not null,
  dati jsonb,
  utente uuid default auth.uid(),
  utente_email text,
  quando timestamptz not null default now()
);
create index if not exists aml_registro_cliente on public.aml_registro (azienda_id, cliente_id, quando desc);

-- ============================================================
-- Trigger di database
-- ============================================================

-- cronologia: ogni inserimento/modifica/cancellazione delle tabelle del fascicolo
create or replace function public.aml_tg_registro()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r jsonb; v_cliente uuid;
begin
  r := to_jsonb(coalesce(new, old));
  v_cliente := case when tg_table_name = 'aml_clienti' then (r->>'id')::uuid else nullif(r->>'cliente_id', '')::uuid end;
  insert into public.aml_registro (azienda_id, cliente_id, tabella, record_id, azione, dati, utente, utente_email)
  values ((r->>'azienda_id')::uuid, v_cliente, tg_table_name, (r->>'id')::uuid, lower(tg_op),
          case when tg_op = 'UPDATE' then jsonb_build_object('prima', to_jsonb(old), 'dopo', to_jsonb(new)) else r end,
          auth.uid(), (select email from auth.users where id = auth.uid()));
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['aml_clienti', 'aml_soggetti', 'aml_valutazioni', 'aml_documenti', 'aml_trigger'] loop
    execute format('drop trigger if exists aml_registro on public.%I', t);
    execute format('create trigger aml_registro after insert or update or delete on public.%I for each row execute function public.aml_tg_registro()', t);
  end loop;
end $$;

-- data di aggiornamento
create or replace function public.aml_tg_aggiornato()
returns trigger language plpgsql as $$
begin new.aggiornato_il := now(); return new; end $$;
drop trigger if exists aml_aggiornato on public.aml_clienti;
create trigger aml_aggiornato before update on public.aml_clienti for each row execute function public.aml_tg_aggiornato();
drop trigger if exists aml_aggiornato on public.aml_sos;
create trigger aml_aggiornato before update on public.aml_sos for each row execute function public.aml_tg_aggiornato();
drop trigger if exists aml_aggiornato on public.aml_impostazioni;
create trigger aml_aggiornato before update on public.aml_impostazioni for each row execute function public.aml_tg_aggiornato();

-- valutazioni: solo in aggiunta; dopo il salvataggio si puo' soltanto validare (una volta)
create or replace function public.aml_tg_valutazione_immutabile()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Le valutazioni AML non si cancellano: sono l''evidenza del controllo costante.';
  end if;
  if old.validata_il is not null
     or (to_jsonb(new) - array['validata_da', 'validata_nome', 'validata_il']) is distinct from (to_jsonb(old) - array['validata_da', 'validata_nome', 'validata_il']) then
    raise exception 'Una valutazione AML salvata non si modifica: registrare un nuovo riesame.';
  end if;
  new.validata_da := auth.uid();
  new.validata_il := now();
  return new;
end $$;
drop trigger if exists aml_valutazione_immutabile on public.aml_valutazioni;
create trigger aml_valutazione_immutabile before update or delete on public.aml_valutazioni
  for each row execute function public.aml_tg_valutazione_immutabile();

-- la valutazione piu' recente aggiorna classe e prossima revisione del cliente
create or replace function public.aml_tg_valutazione_cliente()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update public.aml_clienti c set classe_rischio = v.classe, ultima_valutazione = v.data, prossima_revisione = v.prossima_revisione
    from (select classe, data, prossima_revisione from public.aml_valutazioni
           where cliente_id = new.cliente_id order by data desc, creato_il desc limit 1) v
   where c.id = new.cliente_id;
  return new;
end $$;
drop trigger if exists aml_valutazione_cliente on public.aml_valutazioni;
create trigger aml_valutazione_cliente after insert on public.aml_valutazioni
  for each row execute function public.aml_tg_valutazione_cliente();

-- trigger AML-05: all'apertura la posizione si blocca; chiusi tutti i trigger torna attiva. Un trigger chiuso
-- non si riapre ne' si modifica.
create or replace function public.aml_tg_trigger_stato()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'UPDATE' and old.stato <> 'aperto' then
    if (to_jsonb(new) - 'ticket_id') is distinct from (to_jsonb(old) - 'ticket_id') then
      raise exception 'Un trigger AML chiuso non si modifica.';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.stato <> 'aperto' then
    new.chiuso_da := auth.uid();
    new.chiuso_il := now();
  end if;
  return new;
end $$;
drop trigger if exists aml_trigger_stato on public.aml_trigger;
create trigger aml_trigger_stato before update on public.aml_trigger
  for each row execute function public.aml_tg_trigger_stato();

create or replace function public.aml_tg_trigger_blocco()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.aml_trigger where cliente_id = new.cliente_id and stato = 'aperto') then
    update public.aml_clienti set stato = 'bloccato' where id = new.cliente_id and stato = 'attivo';
  else
    update public.aml_clienti set stato = 'attivo' where id = new.cliente_id and stato = 'bloccato';
  end if;
  return new;
end $$;
drop trigger if exists aml_trigger_blocco on public.aml_trigger;
create trigger aml_trigger_blocco after insert or update of stato on public.aml_trigger
  for each row execute function public.aml_tg_trigger_blocco();

-- un cliente bloccato da trigger aperti non si sblocca a mano
create or replace function public.aml_tg_cliente_blocco()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.stato = 'bloccato' and new.stato = 'attivo'
     and exists (select 1 from public.aml_trigger where cliente_id = new.id and stato = 'aperto') then
    raise exception 'La posizione resta bloccata finche'' la funzione AML non chiude i trigger aperti con esito motivato.';
  end if;
  return new;
end $$;
drop trigger if exists aml_cliente_blocco on public.aml_clienti;
create trigger aml_cliente_blocco before update of stato on public.aml_clienti
  for each row execute function public.aml_tg_cliente_blocco();

-- ============================================================
-- Accesso (RLS)
-- ============================================================
alter table public.aml_impostazioni enable row level security;
alter table public.aml_clienti enable row level security;
alter table public.aml_soggetti enable row level security;
alter table public.aml_valutazioni enable row level security;
alter table public.aml_documenti enable row level security;
alter table public.aml_trigger enable row level security;
alter table public.aml_sos enable row level security;
alter table public.aml_registro enable row level security;

do $$ declare t text; begin
  foreach t in array array['aml_impostazioni', 'aml_clienti', 'aml_soggetti', 'aml_documenti', 'aml_trigger'] loop
    execute format('drop policy if exists aml_accesso on public.%I', t);
    execute format('create policy aml_accesso on public.%I for all to authenticated using (azienda_id in (select public.aml_mie_aziende())) with check (azienda_id in (select public.aml_mie_aziende()))', t);
  end loop;
  foreach t in array array['aml_impostazioni', 'aml_clienti', 'aml_soggetti', 'aml_valutazioni', 'aml_documenti', 'aml_trigger', 'aml_sos', 'aml_registro'] loop
    execute format('drop policy if exists mfa_aal2 on public.%I', t);
    execute format('create policy mfa_aal2 on public.%I as restrictive for all to authenticated using ((select public.mfa_soddisfatta())) with check ((select public.mfa_soddisfatta()))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- valutazioni: lettura e inserimento; l'aggiornamento serve solo alla validazione (controllata dal trigger)
drop policy if exists aml_lettura on public.aml_valutazioni;
create policy aml_lettura on public.aml_valutazioni for select to authenticated using (azienda_id in (select public.aml_mie_aziende()));
drop policy if exists aml_inserimento on public.aml_valutazioni;
create policy aml_inserimento on public.aml_valutazioni for insert to authenticated with check (azienda_id in (select public.aml_mie_aziende()));
drop policy if exists aml_validazione on public.aml_valutazioni;
create policy aml_validazione on public.aml_valutazioni for update to authenticated using (azienda_id in (select public.aml_mie_aziende())) with check (azienda_id in (select public.aml_mie_aziende()));

-- cronologia: solo lettura (la scrive il trigger)
drop policy if exists aml_lettura on public.aml_registro;
create policy aml_lettura on public.aml_registro for select to authenticated using (azienda_id in (select public.aml_mie_aziende()));

-- SOS: chiunque sia collegato all'azienda puo' inviare una segnalazione interna; legge e gestisce solo il DSOS
drop policy if exists aml_segnalazione on public.aml_sos;
create policy aml_segnalazione on public.aml_sos for insert to authenticated
  with check (azienda_id in (select public.aml_aziende_utente()) and segnalante = auth.uid() and stato = 'ricevuta');
drop policy if exists aml_dsos on public.aml_sos;
create policy aml_dsos on public.aml_sos for all to authenticated
  using (azienda_id in (select public.aml_dsos_aziende())) with check (azienda_id in (select public.aml_dsos_aziende()));

grant select, insert, update, delete on public.aml_impostazioni, public.aml_clienti, public.aml_soggetti, public.aml_documenti, public.aml_trigger, public.aml_sos to authenticated;
grant select, insert, update on public.aml_valutazioni to authenticated;
grant select on public.aml_registro to authenticated;

-- ============================================================
-- Archivio documenti: bucket privato; la cartella <azienda>/sos/ e' riservata al Delegato SOS
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('aml-documenti', 'aml-documenti', false, 52428800)
on conflict (id) do nothing;

drop policy if exists aml_documenti_select on storage.objects;
create policy aml_documenti_select on storage.objects for select to authenticated using (
  bucket_id = 'aml-documenti' and (
    ((storage.foldername(name))[2] is distinct from 'sos' and (storage.foldername(name))[1] in (select public.aml_mie_aziende()::text))
    or ((storage.foldername(name))[2] = 'sos' and (storage.foldername(name))[1] in (select public.aml_dsos_aziende()::text))));
drop policy if exists aml_documenti_insert on storage.objects;
create policy aml_documenti_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'aml-documenti' and (
    ((storage.foldername(name))[2] is distinct from 'sos' and (storage.foldername(name))[1] in (select public.aml_mie_aziende()::text))
    or ((storage.foldername(name))[2] = 'sos' and (storage.foldername(name))[1] in (select public.aml_dsos_aziende()::text))));
-- nessuna cancellazione: conservazione decennale (AML-08); un documento errato si annulla con motivazione

-- ============================================================
-- Attivazione per Intellcredit
-- ============================================================
update public.aziende set mod_aml = true where id = '3bcc90e8-a801-402b-8d87-5909429f44b3';

commit;
notify pgrst, 'reload schema';
