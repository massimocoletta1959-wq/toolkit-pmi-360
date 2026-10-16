-- Rischio AML/TULPS di Intellcredit: registro giornale degli affari non aggiornato giorno per giorno
begin;
insert into public.rischi (azienda_id, categoria, descrizione, fonte, note)
select '3bcc90e8-a801-402b-8d87-5909429f44b3', 'Antiriciclaggio',
       'Registro giornale degli affari (art. 120 TULPS) non aggiornato giorno per giorno: oggi le annotazioni si fanno ogni 15-20 giorni',
       'Interna', 'Il registro va aggiornato quotidianamente in ordine cronologico e in ispezione deve riflettere la situazione fino al giorno del controllo (procedure AML-01 e AML-12).'
where not exists (select 1 from public.rischi where azienda_id = '3bcc90e8-a801-402b-8d87-5909429f44b3' and descrizione like 'Registro giornale degli affari (art. 120 TULPS)%');
commit;
