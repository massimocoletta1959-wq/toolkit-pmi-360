-- Sessione unica, avviso immediato: la riga di sessioni_pmi360 dell'utente e' trasmessa in tempo reale
-- (Supabase Realtime), cosi' il dispositivo superato riceve subito il cambio di sessione. Ognuno legge solo
-- la propria riga; le scritture restano solo tramite sessione_valida().
drop policy if exists sessioni_pmi360_propria on public.sessioni_pmi360;
create policy sessioni_pmi360_propria on public.sessioni_pmi360 for select to authenticated using (user_id = auth.uid());
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'sessioni_pmi360') then
    alter publication supabase_realtime add table public.sessioni_pmi360;
  end if;
end $$;
