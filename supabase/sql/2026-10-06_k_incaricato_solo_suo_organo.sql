-- Incaricato d'organo: accesso limitato al SOLO organo affidato, nemmeno in lettura su altro dell'azienda.
-- Prima vedeva in lettura l'anagrafica di tutte le persone dell'azienda (per scegliere i componenti) e i modelli
-- di verbale/atto e i tipi di atto personalizzati di tutti gli organi.

-- ---- Persone: solo i componenti e gli incaricati dei suoi organi ----
drop policy if exists membri_incaricato_lettura on public.membri;
create policy membri_incaricato_lettura on public.membri for select to authenticated using (
  id in (select om.membro_id from organo_membri om where om.organo_id in (select miei_organi()))
  or id in (select oi.membro_id from organo_incaricati oi where oi.organo_id in (select miei_organi()) and oi.data_revoca is null)
);
-- l'inserimento diretto non serve piu': i componenti si aggiungono con aggiungi_componente_organo()
drop policy if exists membri_incaricato_inserimento on public.membri;

-- Aggiunge una persona a un organo senza esporre l'anagrafica dell'azienda: se esiste gia' una persona
-- dell'azienda con la stessa email la collega, altrimenti la crea. Ammesso a chi gestisce l'azienda o l'organo.
create or replace function public.aggiungi_componente_organo(
  p_organo uuid, p_nome text, p_cognome text, p_email text, p_ruolo text, p_quota numeric default null
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_azienda uuid;
  v_membro uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  select azienda_id into v_azienda from organi where id = p_organo;
  if v_azienda is null then raise exception 'Organo non trovato.'; end if;
  if p_organo not in (select miei_organi()) and v_azienda not in (select mie_aziende_gestore()) then
    raise exception 'Non gestisci questo organo.';
  end if;
  if coalesce(trim(p_nome), '') = '' or coalesce(trim(p_cognome), '') = '' then
    raise exception 'Nome e cognome sono obbligatori.';
  end if;
  if v_email is not null and v_email !~ '^\S+@\S+\.\S+$' then raise exception 'Email non valida.'; end if;

  if v_email is not null then
    select id into v_membro from membri where azienda_id = v_azienda and lower(email) = v_email order by created_at limit 1;
  end if;
  if v_membro is null then
    insert into membri (azienda_id, nome, cognome, email, ruolo)
    values (v_azienda, trim(p_nome), trim(p_cognome), v_email, coalesce(nullif(trim(p_ruolo), ''), 'Componente'))
    returning id into v_membro;
  end if;

  if exists (select 1 from organo_membri where organo_id = p_organo and membro_id = v_membro) then
    raise exception 'Persona già presente.';
  end if;
  insert into organo_membri (organo_id, membro_id, ruolo, quota, data_nomina)
  values (p_organo, v_membro, nullif(trim(coalesce(p_ruolo, '')), ''), p_quota, current_date);
  return v_membro;
end
$$;
revoke all on function public.aggiungi_componente_organo(uuid, text, text, text, text, numeric) from public;
grant execute on function public.aggiungi_componente_organo(uuid, text, text, text, text, numeric) to authenticated;

-- ---- Modelli di verbale: del suo organo, o generici per il suo tipo di organo ----
drop policy if exists verbale_template_incaricato_lettura on public.verbale_template;
create policy verbale_template_incaricato_lettura on public.verbale_template for select to authenticated using (
  organo_id in (select miei_organi())
  or (organo_id is null and azienda_id in (select mie_aziende_incaricato())
      and (organo_tipo is null or exists (select 1 from miei_organi_tipo() m where m.azienda_id = verbale_template.azienda_id and m.tipo = verbale_template.organo_tipo)))
);

-- ---- Modelli di atto e tipi di atto personalizzati: solo quelli del suo tipo di organo (o senza organo) ----
drop policy if exists determina_template_incaricato on public.determina_template;
create policy determina_template_incaricato on public.determina_template for select to authenticated using (
  azienda_id in (select mie_aziende_incaricato())
  and (organo is null or exists (select 1 from miei_organi_tipo() m where m.azienda_id = determina_template.azienda_id and m.tipo = determina_template.organo))
);
drop policy if exists determina_tipi_custom_incaricato on public.determina_tipi_custom;
create policy determina_tipi_custom_incaricato on public.determina_tipi_custom for select to authenticated using (
  azienda_id in (select mie_aziende_incaricato())
  and (organo is null or exists (select 1 from miei_organi_tipo() m where m.azienda_id = determina_tipi_custom.azienda_id and m.tipo = determina_tipi_custom.organo))
);
