-- Rollback di 2026-10-16_x_rischi_aml_intellcredit (solo i rischi AML non ancora valutati)
begin;
delete from public.rischi where azienda_id = '3bcc90e8-a801-402b-8d87-5909429f44b3' and categoria = 'Antiriciclaggio' and probabilita is null and impatto is null;
commit;
