-- ============================================================
-- Fase 0 / passo A — funzioni sicure (nessuna regola ristretta qui)
-- I collegamenti utente↔azienda non si scrivono più dal browser ma
-- da funzioni che verificano i requisiti (token d'invito, licenza,
-- preassegnazione). Compatibile con il client precedente.
-- ============================================================

-- ── Chi è gestore (non membro) di un'azienda ──
create or replace function public.mie_aziende_gestore()
returns setof uuid language sql stable security definer set search_path = public as $$
  select azienda_id from utente_aziende
   where utente_id = auth.uid() and coalesce(ruolo, 'owner') <> 'membro'
$$;

create or replace function public.is_gestore(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from utente_aziende
                  where utente_id = auth.uid() and azienda_id = aid
                    and coalesce(ruolo, 'owner') <> 'membro')
$$;

-- Gestore con licenza attiva (può creare aziende, modificare gli standard)
create or replace function public.is_gestore_attivo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from gestori where user_id = auth.uid() and stato = 'attivo')
$$;

-- ── Chi crea un'azienda ne diventa gestore (sostituisce l'insert dal browser) ──
create or replace function public.tg_collega_creatore_azienda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and is_gestore_attivo() then
    insert into utente_aziende (utente_id, azienda_id)
    values (auth.uid(), new.id)
    on conflict (utente_id, azienda_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_collega_creatore_azienda on public.aziende;
create trigger trg_collega_creatore_azienda
  after insert on public.aziende
  for each row execute function public.tg_collega_creatore_azienda();

-- ── Il ruolo di un collegamento non si cambia da soli ──
create or replace function public.tg_blocca_cambio_ruolo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_proprietario() then return new; end if;
  if new.ruolo is distinct from old.ruolo
     or new.utente_id is distinct from old.utente_id
     or new.azienda_id is distinct from old.azienda_id then
    raise exception 'Il ruolo e il collegamento azienda non sono modificabili.';
  end if;
  return new;
end $$;

drop trigger if exists trg_blocca_cambio_ruolo on public.utente_aziende;
create trigger trg_blocca_cambio_ruolo
  before update on public.utente_aziende
  for each row execute function public.tg_blocca_cambio_ruolo();

-- ── Accettazione invito: tutto lato server, verificando il token ──
create or replace function public.accetta_invito(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv  inviti%rowtype;
  prof profili%rowtype;
  em   text := coalesce(auth.jwt() ->> 'email', '');
begin
  if auth.uid() is null then raise exception 'Non autenticato'; end if;
  select * into inv from inviti
   where token = p_token and accettato = false
   for update;
  if not found then return null; end if;
  if inv.expires_at is not null and inv.expires_at < now() then return null; end if;

  select * into prof from profili where id = auth.uid();
  if not found then
    insert into profili (id, email, nome, azienda_id, ruolo, membro_id)
    values (auth.uid(), em, '', inv.azienda_id, 'membro', inv.membro_id);
  end if;
  -- (un gestore che accetta un invito resta gestore: nessun declassamento)

  insert into utente_aziende (utente_id, azienda_id, ruolo)
  values (auth.uid(), inv.azienda_id, 'membro')
  on conflict (utente_id, azienda_id) do nothing;

  if inv.membro_id is not null then
    update membri set user_id = auth.uid() where id = inv.membro_id;
  end if;
  update inviti set accettato = true where id = inv.id;
  return inv.azienda_id;
end $$;

-- ── Gestore pre-registrato dal portale licenze: collega account e aziende ──
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
    insert into utente_aziende (utente_id, azienda_id, mod_rischi, mod_procedure, mod_governance)
    values (auth.uid(), p.azienda_id, p.mod_rischi, p.mod_procedure, p.mod_governance)
    on conflict (utente_id, azienda_id) do nothing;
  end loop;
  if primo is null then return; end if;

  insert into profili (id, email, nome, azienda_id)
  values (auth.uid(), em, '', primo)
  on conflict (id) do nothing;
  delete from gestori_preassegnazioni where gestore_id = gid;
end $$;

-- ── Membro già collegato (membri.user_id) ma senza profilo/collegamenti ──
create or replace function public.ripara_membro()
returns void language plpgsql security definer set search_path = public as $$
declare primo membri%rowtype;
begin
  if auth.uid() is null then return; end if;
  select * into primo from membri where user_id = auth.uid() order by created_at limit 1;
  if not found then return; end if;
  insert into profili (id, email, nome, azienda_id, ruolo, membro_id)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', primo.email, ''), '', primo.azienda_id, 'membro', primo.id)
  on conflict (id) do nothing;
  insert into utente_aziende (utente_id, azienda_id, ruolo)
  select distinct auth.uid(), azienda_id, 'membro' from membri where user_id = auth.uid()
  on conflict (utente_id, azienda_id) do nothing;
end $$;

revoke all on function public.accetta_invito(text), public.claim_gestore(), public.ripara_membro() from public, anon;
grant execute on function public.accetta_invito(text), public.claim_gestore(), public.ripara_membro() to authenticated;
grant execute on function public.mie_aziende_gestore(), public.is_gestore(uuid), public.is_gestore_attivo() to authenticated;
