begin;
alter table public.fin_mappature_flussi_conti drop column if exists includi_in_banca_cassa;
commit;
notify pgrst, 'reload schema';
