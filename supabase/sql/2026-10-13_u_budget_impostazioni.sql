-- ============================================================
-- Finanza: impostazioni del budget dai valori effettivi (pagina Budget, modalita' "Dai valori effettivi"),
-- una riga per azienda: costi variabili, valori decisi, importi periodici, eccezioni di macrocategoria e rettifiche
-- dei movimenti registrati sul conto sbagliato (vedi src/finanza/lib/budgetConsuntivo).
-- Stesse regole di accesso di fin_budget (fin_mie_aziende) e verifica in due passaggi (mfa_aal2).
-- ============================================================
begin;
create table if not exists public.fin_budget_impostazioni (
  azienda_id uuid primary key references public.aziende(id) on delete cascade,
  impostazioni jsonb not null default '{}'::jsonb,
  aggiornato_il timestamptz not null default now(),
  aggiornato_da uuid default auth.uid()
);
alter table public.fin_budget_impostazioni enable row level security;
drop policy if exists fin_budget_impostazioni_accesso on public.fin_budget_impostazioni;
create policy fin_budget_impostazioni_accesso on public.fin_budget_impostazioni for all to authenticated
  using (azienda_id in (select public.fin_mie_aziende())) with check (azienda_id in (select public.fin_mie_aziende()));
drop policy if exists mfa_aal2 on public.fin_budget_impostazioni;
create policy mfa_aal2 on public.fin_budget_impostazioni as restrictive for all to authenticated
  using ((select public.mfa_soddisfatta())) with check ((select public.mfa_soddisfatta()));
revoke all on public.fin_budget_impostazioni from anon;
grant select, insert, update, delete on public.fin_budget_impostazioni to authenticated;
commit;
notify pgrst, 'reload schema';
