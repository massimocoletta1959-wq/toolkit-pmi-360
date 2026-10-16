-- Rollback di 2026-10-16_w_procedure_aml_intellcredit: toglie procedure e ruoli AML di Intellcredit (solo se i ruoli
-- non hanno ancora persone assegnate) e le eventuali adozioni delle procedure AML
begin;
delete from public.procedure_azienda where azienda_id = '3bcc90e8-a801-402b-8d87-5909429f44b3' and codice like 'AML-%';
delete from public.procedure_template where settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3' and codice like 'AML-%';
delete from public.procedure_catalogo where settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3' and codice like 'AML-%';
delete from public.ruoli where azienda_id = '3bcc90e8-a801-402b-8d87-5909429f44b3' and sigla in ('RAML', 'DSOS', 'ADV', 'RCI') and membro_id is null;
commit;
