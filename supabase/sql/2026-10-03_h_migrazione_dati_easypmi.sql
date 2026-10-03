-- ============================================================
-- Fase 3 — dall'appoggio easypmi_import alle tabelle fin_* di Pmi 360°
-- ============================================================

-- Abbinamento aziende: EasyPMI id -> Pmi 360° id (per P.IVA; le nuove tengono l'id di EasyPMI)
create temp table mappa_aziende (easy_id uuid primary key, pmi_id uuid not null, nuova boolean not null);

insert into mappa_aziende
select e.id, a.id, false
  from easypmi_import.aziende e join public.aziende a on a.piva = regexp_replace(e.partita_iva, '\D', '', 'g');

-- Azienda di prova esclusa
delete from mappa_aziende where easy_id = 'cbb2308b-c7b5-4dfa-9242-581cadff564b';

-- Aziende nuove (tutte tranne quella di prova e quelle già abbinate)
insert into public.aziende (id, nome, piva, forma_giuridica, rea, sede_via, capitale_sociale, ateco, tipo_soggetto,
                            mod_rischi, mod_procedure, mod_governance, mod_finanza)
select e.id, e.nome, regexp_replace(e.partita_iva, '\D', '', 'g'), e.forma_giuridica, e.numero_rea, e.sede_legale,
       e.capitale_sociale, e.codice_ateco, coalesce(e.tipo_soggetto, 'societa'),
       false, false, false, true
  from easypmi_import.aziende e
 where e.id <> 'cbb2308b-c7b5-4dfa-9242-581cadff564b'
   and e.id not in (select easy_id from mappa_aziende);
insert into mappa_aziende
select e.id, e.id, true from easypmi_import.aziende e
 where e.id <> 'cbb2308b-c7b5-4dfa-9242-581cadff564b' and e.id not in (select easy_id from mappa_aziende);

-- Le nuove aziende: gestite dal proprietario (massimo@studiocoletta.com). Sull'azienda è
-- attivo solo Finanza; il collegamento consente tutti i moduli (si accendono da Impostazioni)
insert into public.utente_aziende (utente_id, azienda_id, ruolo, mod_rischi, mod_procedure, mod_governance, mod_finanza)
select 'ca4da08f-0c68-4212-b3e2-44fc4c2796a4', pmi_id, 'owner', true, true, true, true
  from mappa_aziende where nuova;

-- Aziende comuni: Finanza attivo sull'azienda; tra i collegamenti esistenti resta
-- visibile solo al proprietario (agli altri gestori si accende con la licenza)
update public.aziende set mod_finanza = true where id in (select pmi_id from mappa_aziende where not nuova);
-- (modifica dei moduli di un collegamento: la fa lo Studio, come richiede il trigger)
select set_config('request.jwt.claims', '{"sub":"ca4da08f-0c68-4212-b3e2-44fc4c2796a4","role":"authenticated"}', true);
update public.utente_aziende set mod_finanza = false
 where azienda_id in (select pmi_id from mappa_aziende where not nuova)
   and utente_id <> 'ca4da08f-0c68-4212-b3e2-44fc4c2796a4';
select set_config('request.jwt.claims', '', true);
-- licenza del proprietario: Finanza incluso
update public.gestori set incl_finanza = true where user_id = 'ca4da08f-0c68-4212-b3e2-44fc4c2796a4';

-- Parametri finanziari
insert into public.fin_parametri_azienda (azienda_id, email, capogruppo, liquidazione_iva, aliquota_iva_vendite, aliquota_iva_acquisti,
  gg_medi_incasso, gg_medi_pagamento, ha_magazzino, dio_giorni, linee_credito_dichiarate, finanziamenti_dichiarati,
  termini_incasso_giorni, termini_pagamento_giorni, esposizioni_dichiarate, esposizioni_scadute_importo,
  esposizioni_scadute_giorni, esposizioni_scadute_al, aggiornata_il)
select m.pmi_id, e.email, e.capogruppo, e.liquidazione_iva, e.aliquota_iva_vendite, e.aliquota_iva_acquisti,
  e.gg_medi_incasso, e.gg_medi_pagamento, e.ha_magazzino, e.dio_giorni, e.linee_credito_dichiarate, e.finanziamenti_dichiarati,
  e.termini_incasso_giorni, e.termini_pagamento_giorni, e.esposizioni_dichiarate, e.esposizioni_scadute_importo,
  e.esposizioni_scadute_giorni, e.esposizioni_scadute_al, e.aggiornata_il
  from easypmi_import.aziende e join mappa_aziende m on m.easy_id = e.id;

-- Piano dei conti
insert into public.fin_voci_cee select * from easypmi_import.voci_cee;
insert into public.fin_voci_sp  select * from easypmi_import.voci_sp;

-- Documenti: percorso normalizzato in <azienda Pmi 360°>/<nome file>; "generated/..." resta un'etichetta
insert into public.fin_documenti (id, azienda_id, nome_file, tipo_file, tipo_documento, anno, stato, percorso, dati_estratti, caricato_il, mese_fine)
select d.id, m.pmi_id, d.nome_file, d.tipo_file, d.tipo_documento, d.anno, d.stato,
       case when d.percorso like 'generated/%' then d.percorso
            else m.pmi_id::text || '/' || regexp_replace(d.percorso, '^.*/', '') end,
       d.dati_estratti, d.caricato_il, d.mese_fine
  from easypmi_import.documenti d join mappa_aziende m on m.easy_id = d.azienda_id;

insert into public.fin_analisi_flussi (id, azienda_id, documento_id, anno, dati, creata_il)
select x.id, m.pmi_id, x.documento_id, x.anno, x.dati, x.creata_il
  from easypmi_import.analisi_flussi x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_budget (id, azienda_id, anno, stato, note, creato_il, approvato_il)
select x.id, m.pmi_id, x.anno, x.stato, x.note, x.creato_il, x.approvato_il
  from easypmi_import.budget x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_budget_voci
select v.* from easypmi_import.budget_voci v where v.budget_id in (select id from public.fin_budget);

insert into public.fin_cashflow
select x.id, m.pmi_id, x.anno, x.mese, x.tipo, x.incassi, x.pagamenti, x.flusso_operativo, x.flusso_investimenti, x.flusso_finanziario,
       x.flusso_netto, x.saldo_iniziale, x.saldo_finale, x.debito_rate, x.dscr, x.creato_il, x.incassi_clienti, x.altri_incassi,
       x.tot_entrate, x.pagamenti_fornitori, x.pagamenti_personale, x.pagamenti_iva, x.rate_banche, x.tasse, x.altri_pagamenti,
       x.tot_uscite, x.interessi, x.pfn
  from easypmi_import.cashflow x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_controlli_tesoreria
select x.id, m.pmi_id, x.tipo, x.periodo, x.voci, x.note, x.completato, x.data_completamento, x.creato_il
  from easypmi_import.controlli_tesoreria x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_finanziamenti
select x.id, m.pmi_id, x.descrizione, x.importo_rata, x.periodicita, x.data_prossima_rata, x.numero_rate_residue, x.creato_il
  from easypmi_import.finanziamenti x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_investimenti
select x.id, m.pmi_id, x.descrizione, x.importo, x.soggetto_iva, x.tranche, x.impatto_costi_annuo, x.beneficio_annuo,
       x.tasso_attualizzazione_pct, x.creato_il
  from easypmi_import.investimenti x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_kpi_tesoreria
select x.id, m.pmi_id, x.data_snapshot, x.dso_giorni, x.dpo_giorni, x.ccc_giorni, x.saldo_corrente, x.buffer_minimo, x.semaforo,
       x.past_due_flag, x.alert_concentrazione, x.errore_forecast_pct, x.dettaglio_json, x.creato_il
  from easypmi_import.kpi_tesoreria x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_linee_credito
select x.id, m.pmi_id, x.tipo, x.descrizione, x.accordato, x.utilizzato, x.utilizzato_al, x.scadenza, x.creato_il
  from easypmi_import.linee_credito x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_manovre_scorte
select x.id, m.pmi_id, x.mese, x.tipo, x.importo, x.soggetto_iva, x.descrizione, x.creato_il
  from easypmi_import.manovre_scorte x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_mappature_conti
select x.id, m.pmi_id, x.conto_origine, x.voce_budget_descrizione, x.categoria, x.globale, x.creata_il, x.codice_cee
  from easypmi_import.mappature_conti x join mappa_aziende m on m.easy_id = x.azienda_id;

-- mappature globali (comuni a tutte le aziende)
insert into public.fin_mappature_conti
select x.id, null, x.conto_origine, x.voce_budget_descrizione, x.categoria, x.globale, x.creata_il, x.codice_cee
  from easypmi_import.mappature_conti x where x.azienda_id is null;

insert into public.fin_mappature_flussi_conti
select x.id, m.pmi_id, x.conto_origine, x.voce_flusso, x.creata_il, x.escludi_da_banca_cassa
  from easypmi_import.mappature_flussi_conti x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_movimenti_tesoreria
select x.id, m.pmi_id, x.direzione, x.categoria, x.controparte, x.tipo_dato, x.probabilita, x.data_competenza, x.data_presunta_incasso,
       x.mese_budget, x.importo, x.scenario_ottimistico_pct, x.scenario_pessimistico_pct, x.note, x.fonte, x.creato_il
  from easypmi_import.movimenti_tesoreria x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_narrativa_report
select x.id, m.pmi_id, x.doc_id_corrente, x.doc_id_precedente, x.anno_corrente, x.anno_precedente, x.rating, x.narrativa, x.generata_il
  from easypmi_import.narrativa_report x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_saldi_cassa_reali
select x.id, m.pmi_id, x.data, x.saldo, x.note, x.creato_il
  from easypmi_import.saldi_cassa_reali x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_scadenze_escluse
select x.id, m.pmi_id, x.conto, x.direzione, x.descrizione, x.motivo, x.creato_il
  from easypmi_import.scadenze_escluse x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_scenari_tesoreria
select x.id, m.pmi_id, x.nome, x.tipo, x.mese_riferimento, x.orizzonte_mesi, x.piano_json, x.saldo_finale_base, x.semaforo,
       x.buffer_minimo_pct, x.saldo_iniziale, x.fatturato_mensile_medio, x.creato_il, x.aggiornato_il
  from easypmi_import.scenari_tesoreria x join mappa_aziende m on m.easy_id = x.azienda_id;

insert into public.fin_scostamenti
select x.id, x.budget_id, m.pmi_id, x.anno, x.mese, x.categoria, x.descrizione, x.valore_budget, x.valore_reale,
       x.scostamento, x.scostamento_perc, x.creato_il
  from easypmi_import.scostamenti x join mappa_aziende m on m.easy_id = x.azienda_id
 where x.budget_id in (select id from public.fin_budget);

-- ── Rapporto: righe nell'origine, escluse (azienda di prova), migrate ──
create temp table rapporto as
with origine as (
  select 'aziende' t, count(*) n, count(*) filter (where id = 'cbb2308b-c7b5-4dfa-9242-581cadff564b') prova from easypmi_import.aziende
  union all select 'documenti', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.documenti
  union all select 'analisi_flussi', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.analisi_flussi
  union all select 'budget', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.budget
  union all select 'budget_voci', count(*), count(*) filter (where budget_id in (select id from easypmi_import.budget where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b')) from easypmi_import.budget_voci
  union all select 'cashflow', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.cashflow
  union all select 'finanziamenti', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.finanziamenti
  union all select 'kpi_tesoreria', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.kpi_tesoreria
  union all select 'mappature_conti', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.mappature_conti
  union all select 'mappature_flussi_conti', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.mappature_flussi_conti
  union all select 'narrativa_report', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.narrativa_report
  union all select 'scadenze_escluse', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.scadenze_escluse
  union all select 'scenari_tesoreria', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.scenari_tesoreria
  union all select 'scostamenti', count(*), count(*) filter (where azienda_id='cbb2308b-c7b5-4dfa-9242-581cadff564b') from easypmi_import.scostamenti
  union all select 'voci_cee', count(*), 0 from easypmi_import.voci_cee
  union all select 'voci_sp', count(*), 0 from easypmi_import.voci_sp
), destinazione as (
  select 'aziende' t, (select count(*) from fin_parametri_azienda) n
  union all select 'documenti', count(*) from fin_documenti
  union all select 'analisi_flussi', count(*) from fin_analisi_flussi
  union all select 'budget', count(*) from fin_budget
  union all select 'budget_voci', count(*) from fin_budget_voci
  union all select 'cashflow', count(*) from fin_cashflow
  union all select 'finanziamenti', count(*) from fin_finanziamenti
  union all select 'kpi_tesoreria', count(*) from fin_kpi_tesoreria
  union all select 'mappature_conti', count(*) from fin_mappature_conti
  union all select 'mappature_flussi_conti', count(*) from fin_mappature_flussi_conti
  union all select 'narrativa_report', count(*) from fin_narrativa_report
  union all select 'scadenze_escluse', count(*) from fin_scadenze_escluse
  union all select 'scenari_tesoreria', count(*) from fin_scenari_tesoreria
  union all select 'scostamenti', count(*) from fin_scostamenti
  union all select 'voci_cee', count(*) from fin_voci_cee
  union all select 'voci_sp', count(*) from fin_voci_sp
)
select o.t tabella, o.n origine, o.prova escluse_prova, d.n migrate, (o.n - o.prova = d.n) quadra
  from origine o join destinazione d using (t);

drop schema easypmi_import cascade;
