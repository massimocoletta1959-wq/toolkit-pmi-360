-- Rollback di 2026-10-14_v_ripara_membro_gestori: versione precedente di ripara_membro
begin;
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
commit;
