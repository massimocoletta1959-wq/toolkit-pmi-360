-- Rischi AML di Intellcredit aggiornati al modello operativo (solo telefonico, portafogli bancari e commerciali,
-- verifiche manuali caso per caso): nuovi rischi e rischio sul contante riformulato
begin;
update public.rischi set descrizione = 'Debitore che propone o effettua pagamenti in contante, o frazionamenti volti a eludere le soglie'
 where azienda_id = '3bcc90e8-a801-402b-8d87-5909429f44b3' and categoria = 'Antiriciclaggio' and descrizione = 'Incassi in contante oltre la soglia di legge o frazionati artificiosamente';
insert into public.rischi (azienda_id, categoria, descrizione, fonte, note)
select '3bcc90e8-a801-402b-8d87-5909429f44b3', 'Antiriciclaggio', d, f, 'Autovalutazione AML (procedura AML-02): valutare probabilità (rischio inerente) e impatto tenendo conto dei presidi in essere.'
from (values
  ('Interna', 'Identificazione a distanza del debitore inadeguata prima della negoziazione di piani di rientro o saldi'),
  ('Interna', 'Mancata intercettazione di debitori PEP o in liste di sanzioni sotto le soglie di controllo per assenza di screening automatico («false clean»)'),
  ('Interna', 'Invio delle posizioni alla funzione AML lasciato alla discrezione dell''operatore telefonico, senza trigger oggettivi'),
  ('Interna', 'Verifiche manuali caso per caso senza traccia scritta di motivo, fonti consultate ed esito'),
  ('Esterna', 'Committente commerciale fittizio o interposto (frodi carosello, crediti di origine non documentata)')
) as v(f, d)
where not exists (select 1 from public.rischi r where r.azienda_id = '3bcc90e8-a801-402b-8d87-5909429f44b3' and r.categoria = 'Antiriciclaggio' and r.descrizione = v.d);
commit;
