-- ============================================================
-- Fase 2 — Modulo "Finanza e Controllo" (da EasyPMI)
-- Crea il modulo (attivazione per azienda, per utente, in licenza), le
-- tabelle fin_* ricalcate sullo schema reale di EasyPMI (export del
-- 2026-10-02, ~/easypmi-export/schema.sql) e le regole di accesso:
-- dati di un'azienda solo a chi ne è gestore CON il modulo attivo
-- (sull'azienda e sul proprio collegamento), più il proprietario.
-- Tipi di colonna invariati rispetto a EasyPMI per non alterare i calcoli.
-- Le tabelle nascono vuote: i dati arrivano con la fase 3.
-- ============================================================

begin;

-- ── 1. Il modulo ──
alter table public.aziende                  add column if not exists mod_finanza boolean not null default false;
alter table public.utente_aziende           add column if not exists mod_finanza boolean not null default true;
alter table public.gestori                  add column if not exists incl_finanza boolean not null default false;
alter table public.gestori_preassegnazioni  add column if not exists mod_finanza boolean not null default true;

-- solo lo Studio cambia i moduli di un collegamento (ora anche Finanza)
create or replace function public.blocca_moduli_non_autorizzati()
returns trigger language plpgsql as $$
begin
  if is_proprietario() then
    return new;
  end if;
  if (old.mod_rischi, old.mod_procedure, old.mod_governance, old.mod_finanza) is distinct from (true, true, true, true) then
    if new.mod_rischi is distinct from old.mod_rischi
       or new.mod_procedure is distinct from old.mod_procedure
       or new.mod_governance is distinct from old.mod_governance
       or new.mod_finanza is distinct from old.mod_finanza then
      raise exception 'Solo lo Studio, dal portale licenze, puo modificare i moduli assegnati.';
    end if;
  end if;
  return new;
end;
$$;

-- il gestore pre-registrato riceve anche il modulo Finanza delle preassegnazioni
create or replace function public.claim_gestore()
returns void language plpgsql security definer set search_path = public as $$
declare
  em  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  gid uuid;
  p   record;
  primo uuid;
begin
  if auth.uid() is null or em = '' then return; end if;
  update gestori set user_id = auth.uid()
   where user_id is null and lower(email) = em
  returning id into gid;
  if gid is null then return; end if;

  for p in select * from gestori_preassegnazioni where gestore_id = gid loop
    if primo is null then primo := p.azienda_id; end if;
    insert into utente_aziende (utente_id, azienda_id, mod_rischi, mod_procedure, mod_governance, mod_finanza)
    values (auth.uid(), p.azienda_id, p.mod_rischi, p.mod_procedure, p.mod_governance, p.mod_finanza)
    on conflict (utente_id, azienda_id) do nothing;
  end loop;
  if primo is null then return; end if;

  insert into profili (id, email, nome, azienda_id)
  values (auth.uid(), em, '', primo)
  on conflict (id) do nothing;
  delete from gestori_preassegnazioni where gestore_id = gid;
end $$;

-- Aziende di cui l'utente vede i dati finanziari
create or replace function public.fin_mie_aziende()
returns setof uuid language sql stable security definer set search_path = public as $$
  select ua.azienda_id from utente_aziende ua join aziende a on a.id = ua.azienda_id
   where ua.utente_id = auth.uid() and coalesce(ua.ruolo, 'owner') <> 'membro'
     and a.mod_finanza and ua.mod_finanza
  union
  select id from aziende where is_proprietario()
$$;
grant execute on function public.fin_mie_aziende() to authenticated;

-- ── 2. Parametri finanziari dell'azienda (campi che EasyPMI teneva su "aziende") ──
create table public.fin_parametri_azienda (
  azienda_id uuid primary key references public.aziende(id) on delete cascade,
  email character varying,
  capogruppo character varying,
  liquidazione_iva character varying default 'trimestrale',
  aliquota_iva_vendite double precision default 22.0,
  aliquota_iva_acquisti double precision default 22.0,
  gg_medi_incasso integer default 30,
  gg_medi_pagamento integer default 30,
  ha_magazzino boolean,
  dio_giorni double precision check (dio_giorni is null or dio_giorni >= 0),
  linee_credito_dichiarate boolean,
  finanziamenti_dichiarati boolean,
  termini_incasso_giorni double precision check (termini_incasso_giorni is null or termini_incasso_giorni >= 0),
  termini_pagamento_giorni double precision check (termini_pagamento_giorni is null or termini_pagamento_giorni >= 0),
  esposizioni_dichiarate boolean,
  esposizioni_scadute_importo double precision check (esposizioni_scadute_importo is null or esposizioni_scadute_importo >= 0),
  esposizioni_scadute_giorni integer check (esposizioni_scadute_giorni is null or esposizioni_scadute_giorni >= 0),
  esposizioni_scadute_al date,
  aggiornata_il timestamp without time zone default now()
);

-- Vista con i nomi di colonna di EasyPMI (lettura): anagrafica Pmi 360° + parametri.
-- Rispetta le regole di accesso di chi legge (security_invoker).
create view public.fin_aziende with (security_invoker = true) as
select a.id, a.nome, a.piva as partita_iva, p.email, true as attiva,
       a.created_at as creata_il, p.aggiornata_il,
       p.liquidazione_iva, p.aliquota_iva_vendite, p.aliquota_iva_acquisti, p.gg_medi_incasso, p.gg_medi_pagamento,
       concat_ws(', ', a.sede_via, nullif(concat_ws(' ', a.sede_cap, a.sede_comune), ''), a.sede_provincia) as sede_legale,
       a.rea as numero_rea, a.ateco as codice_ateco, a.forma_giuridica, p.capogruppo, a.capitale_sociale, a.tipo_soggetto,
       p.ha_magazzino, p.dio_giorni, p.linee_credito_dichiarate, p.finanziamenti_dichiarati,
       p.termini_incasso_giorni, p.termini_pagamento_giorni, p.esposizioni_dichiarate,
       p.esposizioni_scadute_importo, p.esposizioni_scadute_giorni, p.esposizioni_scadute_al
  from public.aziende a
  left join public.fin_parametri_azienda p on p.azienda_id = a.id
 where a.id in (select fin_mie_aziende());

-- ── 3. Tabelle di riferimento (piano dei conti CEE e Stato Patrimoniale) ──
create table public.fin_voci_cee (
  id uuid primary key, codice character varying not null unique, sezione character varying, numero integer,
  descrizione character varying not null, tipo character varying not null, segno integer, ordine integer not null,
  livello integer, totale boolean, parent_codice character varying
);
create table public.fin_voci_sp (
  id uuid primary key default gen_random_uuid(), codice character varying not null unique, sezione character varying, numero integer,
  descrizione character varying not null, tipo character varying not null, segno integer, ordine integer not null,
  livello integer, totale boolean default false, parent_codice character varying
);

-- ── 4. Tabelle per azienda ──
create table public.fin_documenti (
  id uuid primary key, azienda_id uuid not null references public.aziende(id) on delete cascade,
  nome_file character varying not null, tipo_file character varying not null, tipo_documento character varying not null,
  anno character varying not null, stato character varying, percorso character varying not null,
  dati_estratti text, caricato_il timestamp without time zone, mese_fine integer
);
create index fin_documenti_azienda on public.fin_documenti (azienda_id);

create table public.fin_analisi_flussi (
  id uuid primary key default gen_random_uuid(), azienda_id uuid not null references public.aziende(id) on delete cascade,
  documento_id uuid not null unique references public.fin_documenti(id) on delete cascade,
  anno integer, dati jsonb not null, creata_il timestamp without time zone default now()
);

create table public.fin_budget (
  id uuid primary key, azienda_id uuid not null references public.aziende(id) on delete cascade,
  anno character varying not null, stato character varying, note character varying,
  creato_il timestamp without time zone, approvato_il timestamp without time zone
);
create index fin_budget_azienda on public.fin_budget (azienda_id);

create table public.fin_budget_voci (
  id uuid primary key, budget_id uuid not null references public.fin_budget(id) on delete cascade,
  categoria character varying not null, descrizione character varying not null, totale_annuo double precision,
  gen double precision, feb double precision, mar double precision, apr double precision, mag double precision, giu double precision,
  lug double precision, ago double precision, set double precision, ott double precision, nov double precision, dic double precision,
  soggetto_iva boolean default true
);
create index fin_budget_voci_budget on public.fin_budget_voci (budget_id);

create table public.fin_cashflow (
  id uuid primary key, azienda_id uuid not null references public.aziende(id) on delete cascade,
  anno character varying not null, mese integer not null, tipo character varying not null,
  incassi double precision, pagamenti double precision, flusso_operativo double precision, flusso_investimenti double precision,
  flusso_finanziario double precision, flusso_netto double precision, saldo_iniziale double precision, saldo_finale double precision,
  debito_rate double precision, dscr double precision, creato_il timestamp without time zone,
  incassi_clienti double precision default 0, altri_incassi double precision default 0, tot_entrate double precision default 0,
  pagamenti_fornitori double precision default 0, pagamenti_personale double precision default 0, pagamenti_iva double precision default 0,
  rate_banche double precision default 0, tasse double precision default 0, altri_pagamenti double precision default 0,
  tot_uscite double precision default 0, interessi double precision default 0, pfn double precision default 0
);
create index fin_cashflow_azienda on public.fin_cashflow (azienda_id);

create table public.fin_controlli_tesoreria (
  id uuid primary key default gen_random_uuid(), azienda_id uuid not null references public.aziende(id) on delete cascade,
  tipo text not null check (tipo in ('mensile', 'trimestrale')), periodo text not null,
  voci jsonb not null default '{}'::jsonb, note text, completato boolean not null default false,
  data_completamento date, creato_il timestamptz not null default now(),
  unique (azienda_id, tipo, periodo)
);

create table public.fin_finanziamenti (
  id uuid primary key default gen_random_uuid(), azienda_id uuid not null references public.aziende(id) on delete cascade,
  descrizione text not null, importo_rata double precision not null check (importo_rata > 0),
  periodicita text not null check (periodicita in ('mensile', 'trimestrale')), data_prossima_rata date not null,
  numero_rate_residue integer not null check (numero_rate_residue > 0), creato_il timestamptz not null default now()
);
create index fin_finanziamenti_azienda on public.fin_finanziamenti (azienda_id);

create table public.fin_investimenti (
  id uuid primary key default gen_random_uuid(), azienda_id uuid not null references public.aziende(id) on delete cascade,
  descrizione text not null, importo double precision not null check (importo > 0), soggetto_iva boolean not null default true,
  tranche jsonb not null check (jsonb_typeof(tranche) = 'array'), impatto_costi_annuo double precision not null default 0,
  beneficio_annuo double precision not null default 0,
  tasso_attualizzazione_pct double precision not null default 5 check (tasso_attualizzazione_pct >= 0),
  creato_il timestamptz not null default now()
);
create index fin_investimenti_azienda on public.fin_investimenti (azienda_id);

create table public.fin_kpi_tesoreria (
  id uuid primary key, azienda_id uuid not null references public.aziende(id) on delete cascade,
  data_snapshot timestamp without time zone not null, dso_giorni double precision, dpo_giorni double precision,
  ccc_giorni double precision, saldo_corrente double precision, buffer_minimo double precision, semaforo character varying(8),
  past_due_flag boolean not null, alert_concentrazione boolean not null, errore_forecast_pct double precision,
  dettaglio_json jsonb, creato_il timestamp without time zone not null,
  unique (azienda_id, data_snapshot)
);

create table public.fin_linee_credito (
  id uuid primary key default gen_random_uuid(), azienda_id uuid not null references public.aziende(id) on delete cascade,
  tipo text not null check (tipo in ('fido_conto_corrente', 'anticipo_fatture', 'factoring', 'altro')), descrizione text,
  accordato double precision not null check (accordato >= 0), utilizzato double precision not null default 0 check (utilizzato >= 0),
  utilizzato_al date not null default current_date, scadenza date, creato_il timestamptz not null default now()
);
create index fin_linee_credito_azienda on public.fin_linee_credito (azienda_id);

create table public.fin_manovre_scorte (
  id uuid primary key default gen_random_uuid(), azienda_id uuid not null references public.aziende(id) on delete cascade,
  mese text not null check (mese ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  tipo text not null check (tipo in ('incremento_scorte', 'riduzione_scorte', 'acquisto_lotto')),
  importo double precision not null check (importo > 0), soggetto_iva boolean not null default true, descrizione text,
  creato_il timestamptz not null default now()
);
create index fin_manovre_scorte_azienda on public.fin_manovre_scorte (azienda_id);

create table public.fin_mappature_conti (
  id uuid primary key, azienda_id uuid references public.aziende(id) on delete cascade,
  conto_origine character varying not null, voce_budget_descrizione character varying not null,
  categoria character varying not null, globale boolean, creata_il timestamp without time zone, codice_cee character varying
);
create index fin_mappature_conti_azienda on public.fin_mappature_conti (azienda_id);

create table public.fin_mappature_flussi_conti (
  id uuid primary key default gen_random_uuid(), azienda_id uuid not null references public.aziende(id) on delete cascade,
  conto_origine character varying not null, voce_flusso character varying not null,
  creata_il timestamp without time zone default now(), escludi_da_banca_cassa boolean not null default false
);
create index fin_mappature_flussi_azienda on public.fin_mappature_flussi_conti (azienda_id);

create table public.fin_movimenti_tesoreria (
  id uuid primary key, azienda_id uuid not null references public.aziende(id) on delete cascade,
  direzione character varying(7) not null, categoria character varying(64) not null, controparte character varying(255),
  tipo_dato character varying(16) not null, probabilita integer not null, data_competenza timestamp without time zone not null,
  data_presunta_incasso timestamp without time zone, mese_budget integer not null, importo double precision not null,
  scenario_ottimistico_pct double precision not null, scenario_pessimistico_pct double precision not null,
  note text, fonte character varying(32) not null, creato_il timestamp without time zone not null
);
create index fin_mov_tes_azienda_mese on public.fin_movimenti_tesoreria (azienda_id, mese_budget);

create table public.fin_narrativa_report (
  id uuid primary key default gen_random_uuid(), azienda_id uuid not null references public.aziende(id) on delete cascade,
  doc_id_corrente character varying not null, doc_id_precedente character varying, anno_corrente character varying,
  anno_precedente character varying, rating character varying, narrativa jsonb not null,
  generata_il timestamp without time zone default now(),
  unique (azienda_id, doc_id_corrente)
);

create table public.fin_saldi_cassa_reali (
  id uuid primary key default gen_random_uuid(), azienda_id uuid not null references public.aziende(id) on delete cascade,
  data date not null, saldo double precision not null, note text, creato_il timestamptz not null default now(),
  unique (azienda_id, data)
);

create table public.fin_scadenze_escluse (
  id uuid primary key default gen_random_uuid(), azienda_id uuid not null references public.aziende(id) on delete cascade,
  conto text not null, direzione text not null check (direzione in ('entrata', 'uscita')), descrizione text, motivo text,
  creato_il timestamptz not null default now(),
  unique (azienda_id, conto)
);

create table public.fin_scenari_tesoreria (
  id uuid primary key, azienda_id uuid not null references public.aziende(id) on delete cascade,
  nome character varying(128) not null, tipo character varying(32) not null, mese_riferimento integer not null,
  orizzonte_mesi integer not null, piano_json jsonb not null, saldo_finale_base double precision, semaforo character varying(8),
  buffer_minimo_pct double precision not null, saldo_iniziale double precision not null,
  fatturato_mensile_medio double precision not null, creato_il timestamp without time zone not null,
  aggiornato_il timestamp without time zone
);
create index fin_scenari_tesoreria_azienda on public.fin_scenari_tesoreria (azienda_id);

create table public.fin_scostamenti (
  id uuid primary key, budget_id uuid not null references public.fin_budget(id) on delete cascade,
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  anno character varying not null, mese integer not null, categoria character varying not null, descrizione character varying not null,
  valore_budget double precision, valore_reale double precision, scostamento double precision, scostamento_perc double precision,
  creato_il timestamp without time zone
);
create index fin_scostamenti_azienda on public.fin_scostamenti (azienda_id);

-- ── 5. Regole di accesso ──
alter table public.fin_parametri_azienda enable row level security;
alter table public.fin_voci_cee enable row level security;
alter table public.fin_voci_sp enable row level security;

create policy "fin_parametri_accesso" on public.fin_parametri_azienda for all to authenticated
  using (azienda_id in (select fin_mie_aziende())) with check (azienda_id in (select fin_mie_aziende()));
-- piano dei conti: lettura a tutti gli utenti, modifica solo dello Studio
create policy "fin_voci_cee_lettura" on public.fin_voci_cee for select to authenticated using (true);
create policy "fin_voci_cee_studio" on public.fin_voci_cee for all to authenticated using (is_proprietario()) with check (is_proprietario());
create policy "fin_voci_sp_lettura" on public.fin_voci_sp for select to authenticated using (true);
create policy "fin_voci_sp_studio" on public.fin_voci_sp for all to authenticated using (is_proprietario()) with check (is_proprietario());

do $$
declare t text;
begin
  foreach t in array array['fin_documenti','fin_analisi_flussi','fin_budget','fin_cashflow','fin_controlli_tesoreria',
    'fin_finanziamenti','fin_investimenti','fin_kpi_tesoreria','fin_linee_credito','fin_manovre_scorte','fin_mappature_conti',
    'fin_mappature_flussi_conti','fin_movimenti_tesoreria','fin_narrativa_report','fin_saldi_cassa_reali','fin_scadenze_escluse',
    'fin_scenari_tesoreria','fin_scostamenti'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (azienda_id in (select fin_mie_aziende())) with check (azienda_id in (select fin_mie_aziende()))', t || '_accesso', t);
  end loop;
end $$;

-- voci di budget: tramite il budget (che è già filtrato per azienda)
alter table public.fin_budget_voci enable row level security;
create policy "fin_budget_voci_accesso" on public.fin_budget_voci for all to authenticated
  using (budget_id in (select id from fin_budget)) with check (budget_id in (select id from fin_budget));

-- ── 6. Storage dei documenti contabili (bucket privato) ──
insert into storage.buckets (id, name, public, file_size_limit)
values ('fin-documenti', 'fin-documenti', false, 52428800)   -- 50 MB per file (libri giornale lunghi)
on conflict (id) do nothing;

create policy "fin_documenti_storage_select" on storage.objects for select to authenticated
  using (bucket_id = 'fin-documenti' and (storage.foldername(name))[1] in (select (fin_mie_aziende())::text));
create policy "fin_documenti_storage_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'fin-documenti' and (storage.foldername(name))[1] in (select (fin_mie_aziende())::text));
create policy "fin_documenti_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'fin-documenti' and (storage.foldername(name))[1] in (select (fin_mie_aziende())::text));

commit;
