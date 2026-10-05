-- Documentazione circolarizzata ai componenti di un organo (presa visione di una seduta).
-- All'invio si fissa in ticket.documenti cosa e' stato inviato: atti richiamati nella seduta (testo con le analisi
-- d'impatto e sua impronta SHA-256) e allegati (comprese le simulazioni d'impatto). Il componente vede e apre
-- solo quei documenti; la sua presa visione si riferisce a quella versione.

alter table public.ticket add column if not exists documenti jsonb;
comment on column public.ticket.documenti is
  'Istantanea dei documenti inviati in presa visione: { inviato_il, atti: [{ determina_id, oggetto, numero, testo, hash_testo, allegati: [{ id, nome_file, voce, storage_path, dimensione, created_at }] }] }';

-- Allegato incluso nei documenti di un ticket del componente collegato
create or replace function public.allegato_circolarizzato_a_me(p_path text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
      from ticket t
           cross join lateral jsonb_array_elements(coalesce(t.documenti -> 'atti', '[]'::jsonb)) a
           cross join lateral jsonb_array_elements(coalesce(a -> 'allegati', '[]'::jsonb)) f
     where f ->> 'storage_path' = p_path
       and t.membro_id in (select miei_membri_ids_set())
  )
$$;
revoke all on function public.allegato_circolarizzato_a_me(text) from public;
grant execute on function public.allegato_circolarizzato_a_me(text) to authenticated;

drop policy if exists fascicoli_membro_select on storage.objects;
create policy fascicoli_membro_select on storage.objects
  for select to authenticated
  using (bucket_id = 'fascicoli' and public.allegato_circolarizzato_a_me(name));

-- L'istantanea non si modifica dopo l'invio, se non da chi gestisce l'azienda o l'organo (il componente puo'
-- aggiornare il proprio ticket, es. la presa visione, ma non cosa gli e' stato inviato)
create or replace function public.tg_blocca_documenti_ticket()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.documenti is distinct from old.documenti
     and auth.uid() is not null                      -- operazioni lato server (senza utente) ammesse
     and old.azienda_id not in (select mie_aziende_gestore())
     and (old.organo_id is null or old.organo_id not in (select miei_organi())) then
    raise exception 'I documenti inviati in presa visione non si possono modificare.';
  end if;
  return new;
end
$$;
drop trigger if exists blocca_documenti_ticket on public.ticket;
create trigger blocca_documenti_ticket before update on public.ticket
  for each row execute function public.tg_blocca_documenti_ticket();
