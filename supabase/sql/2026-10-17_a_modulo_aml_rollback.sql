-- Rollback del modulo AML (ATTENZIONE: cancella i dati AML inseriti). Il bucket aml-documenti non si elimina da SQL:
-- svuotarlo ed eliminarlo dalla console Storage (o con la Storage API).
begin;
drop policy if exists aml_documenti_select on storage.objects;
drop policy if exists aml_documenti_insert on storage.objects;
drop table if exists public.aml_registro, public.aml_sos, public.aml_trigger, public.aml_documenti, public.aml_valutazioni,
  public.aml_soggetti, public.aml_clienti, public.aml_impostazioni cascade;
drop function if exists public.aml_tg_registro(), public.aml_tg_aggiornato(), public.aml_tg_valutazione_immutabile(),
  public.aml_tg_valutazione_cliente(), public.aml_tg_trigger_stato(), public.aml_tg_trigger_blocco(), public.aml_tg_cliente_blocco(),
  public.aml_mie_aziende(), public.aml_dsos_aziende(), public.aml_aziende_utente();
alter table public.aziende drop column if exists mod_aml;
commit;
notify pgrst, 'reload schema';
