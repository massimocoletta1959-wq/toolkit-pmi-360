-- Rollback: elimina i differimenti (le righe differite non devono diventare esclusioni) e la colonna.
delete from fin_scadenze_escluse where differimento_giorni is not null;
alter table fin_scadenze_escluse drop column if exists differimento_giorni;
