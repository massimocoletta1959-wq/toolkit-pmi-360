-- ============================================================
-- Documenti legali in anteprima: un documento con anteprima = true e non ancora pubblicato (pubblicato_il null)
-- e' visibile e da accettare SOLO per il proprietario, che lo prova come lo vedranno gli utenti. Il testo resta
-- modificabile (il blocco scatta alla pubblicazione). Per renderlo effettivo per tutti:
--   update documenti_legali set anteprima = false, pubblicato_il = now() where id = ...;
-- (le accettazioni del proprietario date in anteprima si cancellano prima, cosi' accetta il testo definitivo)
-- ============================================================

begin;

alter table public.documenti_legali add column if not exists anteprima boolean not null default false;

drop policy if exists documenti_legali_lettura on public.documenti_legali;
create policy documenti_legali_lettura on public.documenti_legali for select to anon, authenticated
  using ((pubblicato_il is not null and pubblicato_il <= now()) or (anteprima and pubblicato_il is null and is_proprietario()));

-- Per il proprietario l'anteprima prevale sulla versione in vigore dello stesso tipo
create or replace view public.documenti_legali_in_vigore with (security_invoker = true) as
  select distinct on (tipo) id, tipo, versione, titolo, testo, sha256, destinatari, richiede_accettazione, formula, pubblicato_il, anteprima
    from public.documenti_legali
   where (pubblicato_il is not null and pubblicato_il <= now())
      or (anteprima and pubblicato_il is null and is_proprietario())
   order by tipo, (anteprima and pubblicato_il is null) desc, pubblicato_il desc nulls last;
grant select on public.documenti_legali_in_vigore to anon, authenticated;

commit;
