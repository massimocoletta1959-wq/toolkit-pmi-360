-- Assestamenti di periodo (stime) di un libro giornale infrannuale: rimanenze finali, ammortamenti, TFR,
-- fatture da ricevere/emettere, aliquota imposte. Salvati sul documento, separati dai dati estratti.
alter table public.fin_documenti add column if not exists assestamenti jsonb;
comment on column public.fin_documenti.assestamenti is 'Assestamenti di periodo stimati (Bilancio riclassificato): { attivi, rimanenze_finali, ammortamenti, tfr, fatture_da_ricevere, fatture_da_emettere, aliquota_imposte, aggiornato_il }';
