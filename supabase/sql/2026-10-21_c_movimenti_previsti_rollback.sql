begin;
drop table if exists public.fin_movimenti_previsti;
commit;
notify pgrst, 'reload schema';
