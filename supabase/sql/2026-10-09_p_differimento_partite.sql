-- Tesoreria, partite aperte: oltre a escludere una partita dal cash flow si puo' differirla di N giorni.
-- Una riga per conto: differimento_giorni NULL = partita esclusa; valorizzato = partita differita (resta nei flussi,
-- con la scadenza stimata spostata in avanti).
alter table fin_scadenze_escluse
  add column if not exists differimento_giorni integer
  check (differimento_giorni is null or differimento_giorni between 1 and 730);

comment on column fin_scadenze_escluse.differimento_giorni is
  'NULL = partita esclusa dal cash flow; N = partita differita di N giorni rispetto alla scadenza stimata';
