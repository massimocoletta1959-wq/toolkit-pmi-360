-- ============================================================
-- Fase 1 — Incaricati d'organo
-- Il gestore nomina una persona (anche esterna, registrata al portale)
-- incaricata della gestione di uno o più organi: per quegli organi ha
-- accesso completo (componenti, adunanze, OdG, presenze, delibere, voti,
-- verbali, modelli di verbale, determine/istruttorie dell'organo,
-- task di riunione), per il resto dell'azienda nessuno.
-- Le regole qui sotto si AGGIUNGONO a quelle dei gestori (policy permissive).
-- ============================================================

begin;

create table if not exists public.organo_incaricati (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  organo_id uuid not null references public.organi(id) on delete cascade,
  membro_id uuid not null references public.membri(id) on delete cascade,
  nominato_da uuid references auth.users(id),
  data_nomina date not null default current_date,
  data_revoca date,
  created_at timestamptz not null default now(),
  unique (organo_id, membro_id)
);
alter table public.organo_incaricati enable row level security;

-- Organi di cui l'utente è incaricato (nomina attiva). Il membro si riconosce
-- dall'account collegato o dall'email, come per i task.
create or replace function public.miei_organi()
returns setof uuid language sql stable security definer set search_path = public as $$
  select oi.organo_id from organo_incaricati oi
   where oi.data_revoca is null and oi.membro_id in (select miei_membri_ids_set())
$$;

create or replace function public.mie_aziende_incaricato()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct oi.azienda_id from organo_incaricati oi
   where oi.data_revoca is null and oi.membro_id in (select miei_membri_ids_set())
$$;

-- Elenco per la voce "I miei organi"
create or replace function public.elenco_miei_organi()
returns table (organo_id uuid, organo_nome text, organo_tipo text, azienda_id uuid, azienda_nome text)
language sql stable security definer set search_path = public as $$
  select o.id, o.nome, o.tipo, a.id, a.nome
    from organi o join aziende a on a.id = o.azienda_id
   where o.id in (select miei_organi())
   order by a.nome, o.nome
$$;

grant execute on function public.miei_organi(), public.mie_aziende_incaricato(), public.elenco_miei_organi() to authenticated;

-- Nomine: le gestiscono i gestori; l'incaricato vede le proprie
create policy "organo_incaricati_gestore" on public.organo_incaricati for all to authenticated
  using (azienda_id in (select mie_aziende_gestore())) with check (azienda_id in (select mie_aziende_gestore()));
create policy "organo_incaricati_propri" on public.organo_incaricati for select to authenticated
  using (membro_id in (select miei_membri_ids_set()));

-- Organo: lettura e modifica (non creazione/eliminazione dell'organo stesso)
create policy "organi_incaricato_lettura" on public.organi for select to authenticated
  using (id in (select miei_organi()));
create policy "organi_incaricato_modifica" on public.organi for update to authenticated
  using (id in (select miei_organi())) with check (id in (select miei_organi()));

-- Componenti dell'organo
create policy "organo_membri_incaricato" on public.organo_membri for all to authenticated
  using (organo_id in (select miei_organi())) with check (organo_id in (select miei_organi()));

-- Anagrafica: legge le persone dell'azienda e ne aggiunge (anche esterni);
-- modifica solo chi è componente dei suoi organi
create policy "membri_incaricato_lettura" on public.membri for select to authenticated
  using (azienda_id in (select mie_aziende_incaricato()));
create policy "membri_incaricato_inserimento" on public.membri for insert to authenticated
  with check (azienda_id in (select mie_aziende_incaricato()));
create policy "membri_incaricato_modifica" on public.membri for update to authenticated
  using (id in (select membro_id from organo_membri where organo_id in (select miei_organi())))
  with check (azienda_id in (select mie_aziende_incaricato()));

-- Adunanze e tutto ciò che vi è collegato
create policy "adunanze_incaricato" on public.adunanze for all to authenticated
  using (organo_id in (select miei_organi())) with check (organo_id in (select miei_organi()));
create policy "adunanza_punti_incaricato" on public.adunanza_punti for all to authenticated
  using (adunanza_id in (select id from adunanze where organo_id in (select miei_organi())))
  with check (adunanza_id in (select id from adunanze where organo_id in (select miei_organi())));
create policy "adunanza_presenze_incaricato" on public.adunanza_presenze for all to authenticated
  using (adunanza_id in (select id from adunanze where organo_id in (select miei_organi())))
  with check (adunanza_id in (select id from adunanze where organo_id in (select miei_organi())));
create policy "adunanza_delibere_incaricato" on public.adunanza_delibere for all to authenticated
  using (adunanza_id in (select id from adunanze where organo_id in (select miei_organi())))
  with check (adunanza_id in (select id from adunanze where organo_id in (select miei_organi())));
create policy "delibere_incaricato" on public.delibere for all to authenticated
  using (adunanza_id in (select id from adunanze where organo_id in (select miei_organi())))
  with check (adunanza_id in (select id from adunanze where organo_id in (select miei_organi())));
create policy "voti_incaricato" on public.voti for all to authenticated
  using (delibera_id in (select d.id from delibere d join adunanze a on a.id = d.adunanza_id where a.organo_id in (select miei_organi())))
  with check (delibera_id in (select d.id from delibere d join adunanze a on a.id = d.adunanza_id where a.organo_id in (select miei_organi())));

-- Determine/istruttorie dell'organo (collegate per tipo: cda, amministratore_unico, assemblea)
create or replace function public.miei_organi_tipo()
returns table (azienda_id uuid, tipo text) language sql stable security definer set search_path = public as $$
  select o.azienda_id, o.tipo from organi o where o.id in (select miei_organi())
$$;
grant execute on function public.miei_organi_tipo() to authenticated;

create policy "determine_incaricato" on public.determine for all to authenticated
  using (exists (select 1 from miei_organi_tipo() m where m.azienda_id = determine.azienda_id and m.tipo = determine.organo))
  with check (exists (select 1 from miei_organi_tipo() m where m.azienda_id = determine.azienda_id and m.tipo = determine.organo));
-- l'assemblea richiama anche gli atti di CdA e Amministratore Unico (sola lettura)
create policy "determine_incaricato_assemblea" on public.determine for select to authenticated
  using (exists (select 1 from miei_organi_tipo() m where m.azienda_id = determine.azienda_id and m.tipo = 'assemblea')
         and organo in ('cda', 'amministratore_unico'));

create policy "determina_allegati_incaricato" on public.determina_allegati for all to authenticated
  using (determina_id in (select id from determine)) with check (determina_id in (select id from determine));
create policy "determina_pareri_incaricato" on public.determina_pareri for all to authenticated
  using (determina_id in (select id from determine)) with check (determina_id in (select id from determine));
create policy "determina_rischi_incaricato" on public.determina_rischi for all to authenticated
  using (determina_id in (select id from determine)) with check (determina_id in (select id from determine));
create policy "determina_simulazioni_incaricato" on public.determina_simulazioni for select to authenticated
  using (determina_id in (select id from determine));

-- Riferimenti per le istruttorie (modelli, tipi personalizzati, voci di checklist): lettura
create policy "determina_template_incaricato" on public.determina_template for select to authenticated
  using (azienda_id in (select mie_aziende_incaricato()));
create policy "determina_tipi_custom_incaricato" on public.determina_tipi_custom for select to authenticated
  using (azienda_id in (select mie_aziende_incaricato()));
create policy "checklist_voci_incaricato" on public.checklist_voci for select to authenticated
  using (azienda_id in (select mie_aziende_incaricato()));

-- Fascicoli (Storage): cartella azienda/determina/… delle determine accessibili
create policy "fascicoli_incaricato_select" on storage.objects for select to authenticated
  using (bucket_id = 'fascicoli' and (storage.foldername(name))[2] in (select id::text from public.determine
          where azienda_id in (select mie_aziende_incaricato())));
create policy "fascicoli_incaricato_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'fascicoli' and (storage.foldername(name))[2] in (select id::text from public.determine
          where azienda_id in (select mie_aziende_incaricato())));
create policy "fascicoli_incaricato_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'fascicoli' and (storage.foldername(name))[2] in (select id::text from public.determine
          where azienda_id in (select mie_aziende_incaricato())));

-- Eventi di governance delle sue adunanze/atti
create policy "governance_eventi_incaricato" on public.governance_eventi for all to authenticated
  using (adunanza_id in (select id from adunanze where organo_id in (select miei_organi()))
         or determina_id in (select id from determine where azienda_id in (select mie_aziende_incaricato())))
  with check (adunanza_id in (select id from adunanze where organo_id in (select miei_organi()))
         or determina_id in (select id from determine where azienda_id in (select mie_aziende_incaricato())));

-- Task di riunione/organo (circolarizzazioni, incarichi)
create policy "ticket_incaricato" on public.ticket for all to authenticated
  using (organo_id in (select miei_organi())) with check (organo_id in (select miei_organi()));

-- Modelli di verbale: usa quelli dell'azienda, crea e modifica i propri (legati all'organo)
alter table public.verbale_template add column if not exists organo_id uuid references public.organi(id) on delete cascade;
create policy "verbale_template_incaricato_lettura" on public.verbale_template for select to authenticated
  using (azienda_id in (select mie_aziende_incaricato()));
create policy "verbale_template_incaricato_scrittura" on public.verbale_template for all to authenticated
  using (organo_id in (select miei_organi())) with check (organo_id in (select miei_organi()));

commit;
