-- Applied through the authenticated Supabase SQL editor, 2026-10-21.
-- No CRM records or raw job descriptions are stored in this cache.
begin;
create table if not exists public.sp_generated_archetypes (cache_key text primary key, profile jsonb not null, version text not null, created_at timestamptz not null default now(), expires_at timestamptz not null);
create table if not exists public.sp_ai_budget (month date primary key, attempts integer not null check (attempts between 0 and 200));
alter table public.sp_generated_archetypes enable row level security;
alter table public.sp_ai_budget enable row level security;
revoke all on public.sp_generated_archetypes, public.sp_ai_budget from public, anon, authenticated;
grant select, insert, update on public.sp_generated_archetypes to service_role;
grant select, insert, update on public.sp_ai_budget to service_role;
create or replace function public.sp_reserve_ai_attempt() returns boolean language sql security invoker set search_path = '' as $$
with reserved as (insert into public.sp_ai_budget(month,attempts) values (date_trunc('month',now() at time zone 'UTC')::date,1) on conflict (month) do update set attempts=sp_ai_budget.attempts+1 where sp_ai_budget.attempts<200 returning attempts) select exists(select 1 from reserved);
$$;
revoke all on function public.sp_reserve_ai_attempt() from public, anon, authenticated;
grant execute on function public.sp_reserve_ai_attempt() to service_role;
select cron.schedule('sp-generated-cv-retention','27 3 * * *',$job$delete from public.sp_generated_archetypes where expires_at < now()$job$);
commit;
