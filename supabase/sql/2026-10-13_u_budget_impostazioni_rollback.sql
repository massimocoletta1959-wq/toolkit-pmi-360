-- Rollback di 2026-10-13_u_budget_impostazioni
begin;
drop table if exists public.fin_budget_impostazioni;
commit;
notify pgrst, 'reload schema';
