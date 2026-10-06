-- Incaricato d'organo: fa funzionare SOLO atti (delibere/determine) e verbali del proprio organo.
-- Composizione dell'organo, impostazioni dell'organo e anagrafica delle persone spettano al gestore.
-- Vede solo gli atti del proprio organo (tolta l'eccezione che dava all'incaricato di un'assemblea la lettura
-- degli atti di CdA e amministratore unico).

-- composizione: solo lettura
drop policy if exists organo_membri_incaricato on public.organo_membri;
create policy organo_membri_incaricato on public.organo_membri for select to authenticated
  using (organo_id in (select miei_organi()));

-- persone e organo: nessuna modifica
drop policy if exists membri_incaricato_modifica on public.membri;
drop policy if exists organi_incaricato_modifica on public.organi;

-- atti: solo quelli del proprio organo
drop policy if exists determine_incaricato_assemblea on public.determine;

-- aggiunta di componenti: solo il gestore dell'azienda
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
  if v_azienda not in (select mie_aziende_gestore()) then
    raise exception 'La composizione dell''organo è gestita dal gestore dell''azienda.';
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
