-- ============================================================
-- ripara_membro: ricrea il profilo mancante di un utente collegato a una scheda membro. Se l'utente e' un gestore
-- (licenza in gestori) o titolare/gestore di un'azienda (utente_aziende non 'membro'), il profilo e' 'consulente' sulla
-- sua azienda, non 'membro': prima un gestore collegato anche a una scheda membro veniva declassato e vedeva solo
-- "I miei task" (caso fabiana@studiocoletta.com, 08/10/2026).
-- ============================================================
begin;
create or replace function public.ripara_membro()
returns void language plpgsql security definer set search_path = public as $$
declare
  primo membri%rowtype;
  azienda_gestita uuid;
  e_gestore boolean;
begin
  if auth.uid() is null then return; end if;
  select * into primo from membri where user_id = auth.uid() order by created_at limit 1;
  if not found then return; end if;
  select azienda_id into azienda_gestita from utente_aziende
   where utente_id = auth.uid() and coalesce(ruolo, 'owner') <> 'membro' order by created_at limit 1;
  e_gestore := exists (select 1 from gestori where user_id = auth.uid()) or azienda_gestita is not null;
  insert into profili (id, email, nome, azienda_id, ruolo, membro_id)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', primo.email, ''), '',
          case when e_gestore then coalesce(azienda_gestita, primo.azienda_id) else primo.azienda_id end,
          case when e_gestore then 'consulente' else 'membro' end, primo.id)
  on conflict (id) do nothing;
  insert into utente_aziende (utente_id, azienda_id, ruolo)
  select distinct auth.uid(), azienda_id, 'membro' from membri where user_id = auth.uid()
  on conflict (utente_id, azienda_id) do nothing;
end $$;
commit;
