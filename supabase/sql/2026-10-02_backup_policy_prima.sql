create policy "p_adun_delib" on public.adunanza_delibere as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "p_adunanza_presenze" on public.adunanza_presenze as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "p_punti" on public.adunanza_punti as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "p_adunanze" on public.adunanze as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "aziende_delete" on public.aziende as permissive for delete to public using ((id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "aziende_gestore" on public.aziende as permissive for select to authenticated using ((id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "aziende_proprietario" on public.aziende as permissive for all to public using (is_proprietario()) with check (is_proprietario());
create policy "aziende_update" on public.aziende as permissive for update to public using ((id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "p_aziende_insert" on public.aziende as permissive for insert to public with check ((auth.uid() IS NOT NULL));
create policy "p_aziende_select" on public.aziende as permissive for select to public using ((id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "azioni_azienda" on public.azioni as permissive for all to authenticated using ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid())))) with check ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid()))));
create policy "azioni_gestore" on public.azioni as permissive for all to authenticated using ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "p_checklist_voci" on public.checklist_voci as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "p_delibere" on public.delibere as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "p_det_alleg" on public.determina_allegati as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "p_detpareri" on public.determina_pareri as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "p_detrischi" on public.determina_rischi as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "lettura simulazioni azienda" on public.determina_simulazioni as permissive for select to public using ((EXISTS ( SELECT 1
   FROM utente_aziende ua
  WHERE ((ua.utente_id = auth.uid()) AND (ua.azienda_id = determina_simulazioni.azienda_id)))));
create policy "p_dettpl" on public.determina_template as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "p_determina_tipi_custom" on public.determina_tipi_custom as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "p_determine" on public.determine as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "documenti_gestore" on public.documenti as permissive for all to authenticated using ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "documento_collegamenti_gestore" on public.documento_collegamenti as permissive for all to authenticated using ((documento_id IN ( SELECT d.id
   FROM documenti d
  WHERE (d.azienda_id IN ( SELECT ua.azienda_id
           FROM utente_aziende ua
          WHERE (ua.utente_id = auth.uid())))))) with check ((documento_id IN ( SELECT d.id
   FROM documenti d
  WHERE (d.azienda_id IN ( SELECT ua.azienda_id
           FROM utente_aziende ua
          WHERE (ua.utente_id = auth.uid()))))));
create policy "gestori_claim" on public.gestori as permissive for update to public using (((user_id IS NULL) AND (lower(email) = lower((auth.jwt() ->> 'email'::text))))) with check ((user_id = auth.uid()));
create policy "gestori_claim_select" on public.gestori as permissive for select to public using (((user_id IS NULL) AND (lower(email) = lower((auth.jwt() ->> 'email'::text)))));
create policy "gestori_proprietario" on public.gestori as permissive for all to authenticated using (is_proprietario()) with check (is_proprietario());
create policy "gestori_self_read" on public.gestori as permissive for select to authenticated using ((user_id = auth.uid()));
create policy "gestori_preassegnazioni_proprietario" on public.gestori_preassegnazioni as permissive for all to public using (is_proprietario()) with check (is_proprietario());
create policy "gestori_preassegnazioni_self_delete" on public.gestori_preassegnazioni as permissive for delete to public using ((gestore_id IN ( SELECT gestori.id
   FROM gestori
  WHERE (gestori.user_id = auth.uid()))));
create policy "gestori_preassegnazioni_self_select" on public.gestori_preassegnazioni as permissive for select to public using ((gestore_id IN ( SELECT gestori.id
   FROM gestori
  WHERE (gestori.user_id = auth.uid()))));
create policy "p_govev_insert" on public.governance_eventi as permissive for insert to public with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "p_govev_select" on public.governance_eventi as permissive for select to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "inviti_delete" on public.inviti as permissive for delete to public using (((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))) OR is_proprietario()));
create policy "inviti_insert_proprietario" on public.inviti as permissive for insert to public with check (is_proprietario());
create policy "inviti_select" on public.inviti as permissive for select to public using (((accettato = false) OR is_proprietario()));
create policy "inviti_update" on public.inviti as permissive for update to public using (((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))) OR is_proprietario()));
create policy "membri_azienda" on public.membri as permissive for all to public using (((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))) OR (user_id = auth.uid()) OR (azienda_id IN ( SELECT mie_aziende_membro() AS mie_aziende_membro))));
create policy "membri_proprietario" on public.membri as permissive for all to public using (is_proprietario()) with check (is_proprietario());
create policy "notifiche_proprietario" on public.notifiche as permissive for all to public using (is_proprietario()) with check (is_proprietario());
create policy "notifiche_scope" on public.notifiche as permissive for all to public using ((ticket_id IN ( SELECT ticket.id
   FROM ticket
  WHERE (ticket.azienda_id IN ( SELECT utente_aziende.azienda_id
           FROM utente_aziende
          WHERE (utente_aziende.utente_id = auth.uid())))))) with check ((ticket_id IN ( SELECT ticket.id
   FROM ticket
  WHERE (ticket.azienda_id IN ( SELECT utente_aziende.azienda_id
           FROM utente_aziende
          WHERE (utente_aziende.utente_id = auth.uid()))))));
create policy "organi_gestore" on public.organi as permissive for all to authenticated using ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "organo_membri_gestore" on public.organo_membri as permissive for all to authenticated using ((organo_id IN ( SELECT o.id
   FROM organi o
  WHERE (o.azienda_id IN ( SELECT ua.azienda_id
           FROM utente_aziende ua
          WHERE (ua.utente_id = auth.uid())))))) with check ((organo_id IN ( SELECT o.id
   FROM organi o
  WHERE (o.azienda_id IN ( SELECT ua.azienda_id
           FROM utente_aziende ua
          WHERE (ua.utente_id = auth.uid()))))));
create policy "presenze_azienda" on public.presenze as permissive for all to authenticated using ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid())))) with check ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid()))));
create policy "procedure_adottate_gestore" on public.procedure_adottate as permissive for all to authenticated using ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "procedure_azienda_proprietario" on public.procedure_azienda as permissive for all to public using (is_proprietario()) with check (is_proprietario());
create policy "procedure_azienda_scope" on public.procedure_azienda as permissive for all to public using (((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))) OR (azienda_id IN ( SELECT membri.azienda_id
   FROM membri
  WHERE (membri.user_id = auth.uid())))));
create policy "cat_lettura" on public.procedure_catalogo as permissive for select to authenticated using (true);
create policy "cat_scrittura" on public.procedure_catalogo as permissive for all to authenticated using (is_proprietario()) with check (is_proprietario());
create policy "procedure_template_all" on public.procedure_template as permissive for all to authenticated using (true) with check (true);
create policy "insert_profili" on public.profili as permissive for insert to public with check (true);
create policy "p4" on public.profili as permissive for all to public using ((id = auth.uid()));
create policy "profili_proprietario" on public.profili as permissive for all to public using (is_proprietario()) with check (is_proprietario());
create policy "proprietari_admin" on public.proprietari as permissive for all to authenticated using (is_proprietario()) with check (is_proprietario());
create policy "punti_odg_azienda" on public.punti_odg as permissive for all to authenticated using ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid())))) with check ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid()))));
create policy "punti_odg_gestore" on public.punti_odg as permissive for all to authenticated using ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "registro_attivita_gestore" on public.registro_attivita as permissive for all to authenticated using ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "p2" on public.rischi as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "rischi_azienda" on public.rischi as permissive for all to authenticated using ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid())))) with check ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid()))));
create policy "rischi_gestore" on public.rischi as permissive for all to authenticated using ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "riunioni_azienda" on public.riunioni as permissive for all to authenticated using ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid())))) with check ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid()))));
create policy "riunioni_gestore" on public.riunioni as permissive for all to authenticated using ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "ruoli_azienda" on public.ruoli as permissive for all to public using (((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))) OR (azienda_id IN ( SELECT membri.azienda_id
   FROM membri
  WHERE (membri.user_id = auth.uid())))));
create policy "ruoli_proprietario" on public.ruoli as permissive for all to public using (is_proprietario()) with check (is_proprietario());
create policy "p_ruolo_team" on public.ruolo_team as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "ticket_gestore" on public.ticket as permissive for all to authenticated using ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "ticket_membro_select" on public.ticket as permissive for select to public using ((membro_id IN ( SELECT miei_membri_ids_set() AS miei_membri_ids_set)));
create policy "ticket_membro_update" on public.ticket as permissive for update to public using ((membro_id IN ( SELECT miei_membri_ids_set() AS miei_membri_ids_set))) with check ((membro_id IN ( SELECT miei_membri_ids_set() AS miei_membri_ids_set)));
create policy "ticket_note_proprietario" on public.ticket_note as permissive for all to public using (is_proprietario()) with check (is_proprietario());
create policy "ticket_note_scope" on public.ticket_note as permissive for all to public using ((ticket_id IN ( SELECT ticket.id
   FROM ticket
  WHERE (ticket.azienda_id IN ( SELECT utente_aziende.azienda_id
           FROM utente_aziende
          WHERE (utente_aziende.utente_id = auth.uid())))))) with check ((ticket_id IN ( SELECT ticket.id
   FROM ticket
  WHERE (ticket.azienda_id IN ( SELECT utente_aziende.azienda_id
           FROM utente_aziende
          WHERE (utente_aziende.utente_id = auth.uid()))))));
create policy "p_ua_insert" on public.utente_aziende as permissive for insert to public with check ((utente_id = auth.uid()));
create policy "p_ua_select" on public.utente_aziende as permissive for select to public using ((utente_id = auth.uid()));
create policy "utente_aziende_proprietario" on public.utente_aziende as permissive for all to public using (is_proprietario()) with check (is_proprietario());
create policy "utente_aziende_self" on public.utente_aziende as permissive for all to authenticated using ((utente_id = auth.uid())) with check ((utente_id = auth.uid()));
create policy "utente_vede_sue_aziende" on public.utente_aziende as permissive for all to authenticated using ((utente_id = auth.uid())) with check ((utente_id = auth.uid()));
create policy "p_verbtpl" on public.verbale_template as permissive for all to public using ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT utente_aziende.azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid()))));
create policy "verbali_azienda" on public.verbali as permissive for all to authenticated using ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid())))) with check ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid()))));
create policy "verbali_gestore" on public.verbali as permissive for all to authenticated using ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "voti_azienda" on public.voti as permissive for all to authenticated using ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid())))) with check ((azienda_id IN ( SELECT m.azienda_id
   FROM membri m
  WHERE (m.user_id = auth.uid()))));
create policy "voti_gestore" on public.voti as permissive for all to authenticated using ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid())))) with check ((azienda_id IN ( SELECT ua.azienda_id
   FROM utente_aziende ua
  WHERE (ua.utente_id = auth.uid()))));
create policy "fascicoli_delete" on storage.objects as permissive for delete to public using (((bucket_id = 'fascicoli'::text) AND ((storage.foldername(name))[1] IN ( SELECT (utente_aziende.azienda_id)::text AS azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))));
create policy "fascicoli_insert" on storage.objects as permissive for insert to public with check (((bucket_id = 'fascicoli'::text) AND ((storage.foldername(name))[1] IN ( SELECT (utente_aziende.azienda_id)::text AS azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))));
create policy "fascicoli_select" on storage.objects as permissive for select to public using (((bucket_id = 'fascicoli'::text) AND ((storage.foldername(name))[1] IN ( SELECT (utente_aziende.azienda_id)::text AS azienda_id
   FROM utente_aziende
  WHERE (utente_aziende.utente_id = auth.uid())))));
create policy "loghi_read" on storage.objects as permissive for select to public using ((bucket_id = 'loghi'::text));
create policy "loghi_update" on storage.objects as permissive for update to authenticated using ((bucket_id = 'loghi'::text));
create policy "loghi_write" on storage.objects as permissive for insert to authenticated with check ((bucket_id = 'loghi'::text));
