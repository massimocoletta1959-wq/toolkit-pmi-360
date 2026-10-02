-- ============================================================
-- Fase 0 / passo C — regole di accesso: pieno accesso solo ai gestori
-- (utente_aziende.ruolo <> 'membro'); ai membri solo cio' che serve alla
-- vista 'I miei task'. Rollback: 2026-10-02_backup_policy_prima.sql
-- ============================================================
begin;

drop policy if exists "p_adun_delib" on public.adunanza_delibere;
create policy "p_adun_delib" on public.adunanza_delibere as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_adunanza_presenze" on public.adunanza_presenze;
create policy "p_adunanza_presenze" on public.adunanza_presenze as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_punti" on public.adunanza_punti;
create policy "p_punti" on public.adunanza_punti as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_adunanze" on public.adunanze;
create policy "p_adunanze" on public.adunanze as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "aziende_delete" on public.aziende;
create policy "aziende_delete" on public.aziende as permissive for delete to public using ((id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "aziende_update" on public.aziende;
create policy "aziende_update" on public.aziende as permissive for update to public using ((id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_aziende_insert" on public.aziende;
drop policy if exists "azioni_azienda" on public.azioni;
drop policy if exists "azioni_gestore" on public.azioni;
create policy "azioni_gestore" on public.azioni as permissive for all to authenticated using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_checklist_voci" on public.checklist_voci;
create policy "p_checklist_voci" on public.checklist_voci as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_delibere" on public.delibere;
create policy "p_delibere" on public.delibere as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_det_alleg" on public.determina_allegati;
create policy "p_det_alleg" on public.determina_allegati as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_detpareri" on public.determina_pareri;
create policy "p_detpareri" on public.determina_pareri as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_detrischi" on public.determina_rischi;
create policy "p_detrischi" on public.determina_rischi as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "lettura simulazioni azienda" on public.determina_simulazioni;
create policy "lettura simulazioni azienda" on public.determina_simulazioni as permissive for select to public using ((is_gestore(azienda_id)));
drop policy if exists "p_dettpl" on public.determina_template;
create policy "p_dettpl" on public.determina_template as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_determina_tipi_custom" on public.determina_tipi_custom;
create policy "p_determina_tipi_custom" on public.determina_tipi_custom as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_determine" on public.determine;
create policy "p_determine" on public.determine as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "documenti_gestore" on public.documenti;
create policy "documenti_gestore" on public.documenti as permissive for all to authenticated using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "documento_collegamenti_gestore" on public.documento_collegamenti;
create policy "documento_collegamenti_gestore" on public.documento_collegamenti as permissive for all to authenticated using ((documento_id IN ( SELECT d.id FROM documenti d WHERE (d.azienda_id IN ( SELECT mie_aziende_gestore()))))) with check ((documento_id IN ( SELECT d.id FROM documenti d WHERE (d.azienda_id IN ( SELECT mie_aziende_gestore())))));
drop policy if exists "p_govev_insert" on public.governance_eventi;
create policy "p_govev_insert" on public.governance_eventi as permissive for insert to public with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p_govev_select" on public.governance_eventi;
create policy "p_govev_select" on public.governance_eventi as permissive for select to public using ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "inviti_delete" on public.inviti;
create policy "inviti_delete" on public.inviti as permissive for delete to public using (((azienda_id IN ( SELECT mie_aziende_gestore())) OR is_proprietario()));
drop policy if exists "inviti_select" on public.inviti;
drop policy if exists "inviti_update" on public.inviti;
create policy "inviti_update" on public.inviti as permissive for update to public using (((azienda_id IN ( SELECT mie_aziende_gestore())) OR is_proprietario()));
drop policy if exists "membri_azienda" on public.membri;
drop policy if exists "notifiche_scope" on public.notifiche;
create policy "notifiche_scope" on public.notifiche as permissive for all to public using ((ticket_id IN ( SELECT ticket.id FROM ticket WHERE (ticket.azienda_id IN ( SELECT mie_aziende_gestore()))))) with check ((ticket_id IN ( SELECT ticket.id FROM ticket WHERE (ticket.azienda_id IN ( SELECT mie_aziende_gestore())))));
drop policy if exists "organi_gestore" on public.organi;
create policy "organi_gestore" on public.organi as permissive for all to authenticated using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "organo_membri_gestore" on public.organo_membri;
create policy "organo_membri_gestore" on public.organo_membri as permissive for all to authenticated using ((organo_id IN ( SELECT o.id FROM organi o WHERE (o.azienda_id IN ( SELECT mie_aziende_gestore()))))) with check ((organo_id IN ( SELECT o.id FROM organi o WHERE (o.azienda_id IN ( SELECT mie_aziende_gestore())))));
drop policy if exists "presenze_azienda" on public.presenze;
drop policy if exists "procedure_adottate_gestore" on public.procedure_adottate;
create policy "procedure_adottate_gestore" on public.procedure_adottate as permissive for all to authenticated using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "procedure_azienda_scope" on public.procedure_azienda;
drop policy if exists "procedure_template_all" on public.procedure_template;
drop policy if exists "insert_profili" on public.profili;
drop policy if exists "punti_odg_azienda" on public.punti_odg;
drop policy if exists "punti_odg_gestore" on public.punti_odg;
create policy "punti_odg_gestore" on public.punti_odg as permissive for all to authenticated using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "registro_attivita_gestore" on public.registro_attivita;
create policy "registro_attivita_gestore" on public.registro_attivita as permissive for all to authenticated using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "p2" on public.rischi;
create policy "p2" on public.rischi as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "rischi_azienda" on public.rischi;
drop policy if exists "rischi_gestore" on public.rischi;
create policy "rischi_gestore" on public.rischi as permissive for all to authenticated using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "riunioni_azienda" on public.riunioni;
drop policy if exists "riunioni_gestore" on public.riunioni;
create policy "riunioni_gestore" on public.riunioni as permissive for all to authenticated using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "ruoli_azienda" on public.ruoli;
drop policy if exists "p_ruolo_team" on public.ruolo_team;
create policy "p_ruolo_team" on public.ruolo_team as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "ticket_gestore" on public.ticket;
create policy "ticket_gestore" on public.ticket as permissive for all to authenticated using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "ticket_note_scope" on public.ticket_note;
create policy "ticket_note_scope" on public.ticket_note as permissive for all to public using ((ticket_id IN ( SELECT ticket.id FROM ticket WHERE (ticket.azienda_id IN ( SELECT mie_aziende_gestore()))))) with check ((ticket_id IN ( SELECT ticket.id FROM ticket WHERE (ticket.azienda_id IN ( SELECT mie_aziende_gestore())))));
drop policy if exists "p_ua_insert" on public.utente_aziende;
drop policy if exists "utente_aziende_self" on public.utente_aziende;
drop policy if exists "utente_vede_sue_aziende" on public.utente_aziende;
drop policy if exists "p_verbtpl" on public.verbale_template;
create policy "p_verbtpl" on public.verbale_template as permissive for all to public using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "verbali_azienda" on public.verbali;
drop policy if exists "verbali_gestore" on public.verbali;
create policy "verbali_gestore" on public.verbali as permissive for all to authenticated using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "voti_azienda" on public.voti;
drop policy if exists "voti_gestore" on public.voti;
create policy "voti_gestore" on public.voti as permissive for all to authenticated using ((azienda_id IN ( SELECT mie_aziende_gestore()))) with check ((azienda_id IN ( SELECT mie_aziende_gestore())));
drop policy if exists "fascicoli_delete" on storage.objects;
create policy "fascicoli_delete" on storage.objects as permissive for delete to public using (((bucket_id = 'fascicoli'::text) AND ((storage.foldername(name))[1] IN ( SELECT (mie_aziende_gestore())::text))));
drop policy if exists "fascicoli_insert" on storage.objects;
create policy "fascicoli_insert" on storage.objects as permissive for insert to public with check (((bucket_id = 'fascicoli'::text) AND ((storage.foldername(name))[1] IN ( SELECT (mie_aziende_gestore())::text))));
drop policy if exists "fascicoli_select" on storage.objects;
create policy "fascicoli_select" on storage.objects as permissive for select to public using (((bucket_id = 'fascicoli'::text) AND ((storage.foldername(name))[1] IN ( SELECT (mie_aziende_gestore())::text))));
drop policy if exists "loghi_update" on storage.objects;
drop policy if exists "loghi_write" on storage.objects;

-- ── Regole riscritte a mano ──

-- Anagrafica membri: gestori tutto; un membro vede solo la propria scheda
create policy "membri_gestore" on public.membri for all to authenticated
  using (azienda_id in (select mie_aziende_gestore())) with check (azienda_id in (select mie_aziende_gestore()));
create policy "membri_membro_lettura" on public.membri for select to authenticated
  using (user_id = auth.uid());

-- Procedure e organigramma: solo gestori. Ai membri la procedura del proprio
-- task la restituisce la funzione dati_procedura_task.
create policy "procedure_azienda_gestore" on public.procedure_azienda for all to authenticated
  using (azienda_id in (select mie_aziende_gestore())) with check (azienda_id in (select mie_aziende_gestore()));
create policy "ruoli_gestore" on public.ruoli for all to authenticated
  using (azienda_id in (select mie_aziende_gestore())) with check (azienda_id in (select mie_aziende_gestore()));

-- Note sui task: i membri leggono e scrivono solo sui propri task
create policy "ticket_note_membro" on public.ticket_note for select to authenticated
  using (ticket_id in (select id from ticket where membro_id in (select miei_membri_ids_set())));
create policy "ticket_note_membro_insert" on public.ticket_note for insert to authenticated
  with check (ticket_id in (select id from ticket where membro_id in (select miei_membri_ids_set())));

-- Standard delle procedure (condivisi): lettura a tutti, modifica a gestori con licenza e Studio
create policy "procedure_template_lettura" on public.procedure_template for select to authenticated using (true);
create policy "procedure_template_scrittura" on public.procedure_template for all to authenticated
  using (is_gestore_attivo() or is_proprietario()) with check (is_gestore_attivo() or is_proprietario());

-- Inviti: solo i gestori dell'azienda e lo Studio (il token si verifica in accetta_invito)
create policy "inviti_select" on public.inviti for select to authenticated
  using (azienda_id in (select mie_aziende_gestore()) or is_proprietario());

-- Collegamenti utente-azienda: si leggono (p_ua_select), si aggiornano (moduli; il
-- ruolo lo blocca il trigger) e si cancellano i propri; non si creano dal browser
create policy "utente_aziende_self_update" on public.utente_aziende for update to authenticated
  using (utente_id = auth.uid()) with check (utente_id = auth.uid());
create policy "utente_aziende_self_delete" on public.utente_aziende for delete to authenticated
  using (utente_id = auth.uid());

-- Profili: ciascuno crea solo il proprio
create policy "insert_profili" on public.profili for insert to authenticated
  with check (id = auth.uid() or is_proprietario());

-- Nuove aziende: solo gestori con licenza attiva (o lo Studio)
create policy "p_aziende_insert" on public.aziende for insert to authenticated
  with check (is_gestore_attivo() or is_proprietario());

-- Loghi: lettura pubblica invariata; scrittura solo nella cartella delle proprie aziende
create policy "loghi_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'loghi' and ((storage.foldername(name))[1] in (select (mie_aziende_gestore())::text) or is_proprietario()));
create policy "loghi_update" on storage.objects for update to authenticated
  using (bucket_id = 'loghi' and ((storage.foldername(name))[1] in (select (mie_aziende_gestore())::text) or is_proprietario()));

commit;
