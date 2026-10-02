-- ============================================================
-- Fase 0 / passo A2
-- 1) Il proprietario (lo Studio) è gestore di tutte le aziende.
-- 2) I membri non leggono più organigramma e procedure dell'azienda:
--    la procedura di un task di presa visione arriva da una funzione
--    che la restituisce solo a chi ha quel task.
-- ============================================================

create or replace function public.mie_aziende_gestore()
returns setof uuid language sql stable security definer set search_path = public as $$
  select azienda_id from utente_aziende
   where utente_id = auth.uid() and coalesce(ruolo, 'owner') <> 'membro'
  union
  select id from aziende where is_proprietario()
$$;

create or replace function public.is_gestore(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_proprietario() or exists (
    select 1 from utente_aziende
     where utente_id = auth.uid() and azienda_id = aid
       and coalesce(ruolo, 'owner') <> 'membro')
$$;

-- Dati per comporre la procedura di un task di presa visione:
-- solo se il task è dell'utente e cita quel codice procedura.
create or replace function public.dati_procedura_task(p_ticket uuid, p_codice text)
returns json language plpgsql security definer set search_path = public as $$
declare
  t   ticket%rowtype;
  az  aziende%rowtype;
  ado procedure_azienda%rowtype;
begin
  select * into t from ticket
   where id = p_ticket and membro_id in (select miei_membri_ids_set());
  if not found then raise exception 'Task non trovato'; end if;
  if p_codice is null or position(p_codice in coalesce(t.procedura_id::text, '') || ' ' || coalesce(t.istruzioni, '') || ' ' || coalesce(t.titolo, '')) = 0 then
    raise exception 'La procedura non è collegata a questo task';
  end if;
  select * into az from aziende where id = t.azienda_id;

  select * into ado from procedure_azienda where azienda_id = t.azienda_id and codice = p_codice;
  if found and ado.data_emissione is null then
    update procedure_azienda set data_emissione = current_date where id = ado.id;
    ado.data_emissione := current_date;
  end if;

  return json_build_object(
    'tpl', coalesce((select json_agg(row_to_json(x)) from (
              select codice, settore, corpo_html from procedure_template
               where codice = p_codice and settore in (coalesce(az.settore, ''), 'generico')) x), '[]'::json),
    'ruoli', coalesce((select json_agg(json_build_object('sigla', r.sigla, 'nome', r.nome,
              'membri', (select json_build_object('nome', m.nome, 'cognome', m.cognome) from membri m where m.id = r.membro_id)))
              from ruoli r where r.azienda_id = t.azienda_id), '[]'::json),
    'adoz', case when ado.id is null then null else json_build_object(
              'id', ado.id, 'data_emissione', ado.data_emissione, 'stato', ado.stato,
              'corpo_html', ado.corpo_html, 'titolo', ado.titolo) end
  );
end $$;

revoke all on function public.dati_procedura_task(uuid, text) from public, anon;
grant execute on function public.dati_procedura_task(uuid, text) to authenticated;
