-- ============================================================
-- Finanza: movimenti di cassa previsti inseriti a mano nell'Analisi dei flussi (rateizzazioni, acconti di imposta,
-- finanziamenti attesi, ...), una volta o ricorrenti, usati dalla proiezione della Tesoreria.
-- voce: gruppo della tabella cash flow; 'imposte_reddito' sostituisce, nello stesso mese, i versamenti di imposte sul
-- reddito calcolati dalla Tesoreria (saldo/acconti dal budget). Stesse regole di accesso delle altre tabelle fin_.
-- ============================================================
begin;
create table if not exists public.fin_movimenti_previsti (
  id uuid primary key default gen_random_uuid(),
  azienda_id uuid not null references public.aziende(id) on delete cascade,
  descrizione text not null,
  direzione text not null check (direzione in ('entrata', 'uscita')),
  voce text not null check (voce in ('imposte_reddito', 'imposte_altre', 'contributi', 'finanziamenti', 'personale', 'soci', 'clienti', 'fornitori', 'investimenti', 'altro')),
  importo numeric(14,2) not null check (importo > 0),
  prima_data date not null,
  frequenza text not null default 'una_volta' check (frequenza in ('una_volta', 'mensile', 'bimestrale', 'trimestrale', 'semestrale', 'annuale')),
  numero_rate integer check (numero_rate is null or numero_rate >= 1),
  certezza text not null default 'certo' check (certezza in ('certo', 'probabile')),
  conto text,
  note text,
  creato_il timestamptz not null default now(),
  creato_da uuid default auth.uid(),
  aggiornato_il timestamptz not null default now()
);
create index if not exists fin_movimenti_previsti_azienda on public.fin_movimenti_previsti (azienda_id, prima_data);
alter table public.fin_movimenti_previsti enable row level security;
drop policy if exists fin_movimenti_previsti_accesso on public.fin_movimenti_previsti;
create policy fin_movimenti_previsti_accesso on public.fin_movimenti_previsti for all to authenticated
  using (azienda_id in (select public.fin_mie_aziende())) with check (azienda_id in (select public.fin_mie_aziende()));
drop policy if exists mfa_aal2 on public.fin_movimenti_previsti;
create policy mfa_aal2 on public.fin_movimenti_previsti as restrictive for all to authenticated
  using ((select public.mfa_soddisfatta())) with check ((select public.mfa_soddisfatta()));
revoke all on public.fin_movimenti_previsti from anon;
grant select, insert, update, delete on public.fin_movimenti_previsti to authenticated;
commit;
notify pgrst, 'reload schema';
