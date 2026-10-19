-- Analisi dei flussi: conti da trattare come banca/cassa anche se nello Stato patrimoniale sono riclassificati
-- altrove (es. conti correnti sempre a saldo passivo, sotto fido, esposti tra i debiti verso banche).
-- Lo decide l'utente quando l'Analisi dei flussi glielo chiede.
begin;
alter table public.fin_mappature_flussi_conti add column if not exists includi_in_banca_cassa boolean not null default false;
commit;
notify pgrst, 'reload schema';
