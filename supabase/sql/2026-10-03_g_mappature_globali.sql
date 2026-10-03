-- Mappature conti "globali" (azienda_id NULL, globale = true): regole di
-- riclassificazione comuni a tutte le aziende, come il piano dei conti.
-- Lettura per gli utenti del modulo Finanza, modifica solo dello Studio.
begin;
create policy "fin_mappature_globali_lettura" on public.fin_mappature_conti for select to authenticated
  using (azienda_id is null and globale is true and exists (select 1 from fin_mie_aziende()));
create policy "fin_mappature_globali_studio" on public.fin_mappature_conti for all to authenticated
  using (azienda_id is null and is_proprietario()) with check (azienda_id is null and is_proprietario());
commit;
