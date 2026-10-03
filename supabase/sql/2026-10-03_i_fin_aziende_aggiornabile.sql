-- ============================================================
-- La vista fin_aziende (nomi di colonna EasyPMI) diventa aggiornabile per i
-- soli parametri finanziari: un UPDATE sulla vista scrive (o crea) la riga
-- di fin_parametri_azienda. L'anagrafica resta quella di Pmi 360° (aziende),
-- che dalla vista non si modifica. Esegue con i permessi di chi aggiorna:
-- valgono le regole di accesso di fin_parametri_azienda.
-- ============================================================
begin;

create or replace function public.fin_aziende_aggiorna()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  insert into fin_parametri_azienda as p (azienda_id, email, capogruppo, liquidazione_iva, aliquota_iva_vendite, aliquota_iva_acquisti,
    gg_medi_incasso, gg_medi_pagamento, ha_magazzino, dio_giorni, linee_credito_dichiarate, finanziamenti_dichiarati,
    termini_incasso_giorni, termini_pagamento_giorni, esposizioni_dichiarate, esposizioni_scadute_importo,
    esposizioni_scadute_giorni, esposizioni_scadute_al, aggiornata_il)
  values (old.id, new.email, new.capogruppo, new.liquidazione_iva, new.aliquota_iva_vendite, new.aliquota_iva_acquisti,
    new.gg_medi_incasso, new.gg_medi_pagamento, new.ha_magazzino, new.dio_giorni, new.linee_credito_dichiarate, new.finanziamenti_dichiarati,
    new.termini_incasso_giorni, new.termini_pagamento_giorni, new.esposizioni_dichiarate, new.esposizioni_scadute_importo,
    new.esposizioni_scadute_giorni, new.esposizioni_scadute_al, now())
  on conflict (azienda_id) do update set
    email = excluded.email, capogruppo = excluded.capogruppo, liquidazione_iva = excluded.liquidazione_iva,
    aliquota_iva_vendite = excluded.aliquota_iva_vendite, aliquota_iva_acquisti = excluded.aliquota_iva_acquisti,
    gg_medi_incasso = excluded.gg_medi_incasso, gg_medi_pagamento = excluded.gg_medi_pagamento,
    ha_magazzino = excluded.ha_magazzino, dio_giorni = excluded.dio_giorni,
    linee_credito_dichiarate = excluded.linee_credito_dichiarate, finanziamenti_dichiarati = excluded.finanziamenti_dichiarati,
    termini_incasso_giorni = excluded.termini_incasso_giorni, termini_pagamento_giorni = excluded.termini_pagamento_giorni,
    esposizioni_dichiarate = excluded.esposizioni_dichiarate, esposizioni_scadute_importo = excluded.esposizioni_scadute_importo,
    esposizioni_scadute_giorni = excluded.esposizioni_scadute_giorni, esposizioni_scadute_al = excluded.esposizioni_scadute_al,
    aggiornata_il = now();
  return new;
end $$;

drop trigger if exists fin_aziende_aggiorna on public.fin_aziende;
create trigger fin_aziende_aggiorna instead of update on public.fin_aziende
  for each row execute function public.fin_aziende_aggiorna();

commit;
