-- Cache anonymised wider-market snapshots. No names, employers or contact details.
create table if not exists public.sp_external_cache (
 id uuid primary key,
 search_key text not null unique,
 snapshots jsonb not null default '[]',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '7 days'
);
alter table public.sp_external_cache enable row level security;
revoke all on public.sp_external_cache from public, anon, authenticated;
grant all on public.sp_external_cache to service_role;
