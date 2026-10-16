begin;
delete from public.rischi where azienda_id = '3bcc90e8-a801-402b-8d87-5909429f44b3' and descrizione like 'Registro giornale degli affari (art. 120 TULPS)%';
commit;
