-- Staff search, demo visibility and the read-only RecruitCRM import job.

create table if not exists public.sp_settings (
 key text primary key,
 value jsonb not null default '{}',
 updated_at timestamptz not null default now()
);
insert into public.sp_settings (key, value) values ('show_demo_profiles', '{"enabled":true}'::jsonb)
on conflict (key) do nothing;
alter table public.sp_settings enable row level security;
revoke all on public.sp_settings from public, anon, authenticated;
grant all on public.sp_settings to service_role;

create table if not exists public.sp_import_jobs (
 id uuid primary key,
 status text not null,
 page integer not null default 1,
 imported integer not null default 0,
 updated_count integer not null default 0,
 skipped integer not null default 0,
 last_error text not null default '',
 updated_at timestamptz not null default now()
);
alter table public.sp_import_jobs enable row level security;
revoke all on public.sp_import_jobs from public, anon, authenticated;
grant all on public.sp_import_jobs to service_role;
create unique index if not exists sp_candidates_crm_slug_key on public.sp_candidates (crm_slug) where crm_slug is not null and crm_slug<>'';

do $$
declare r record;
begin
 for r in select conname from pg_constraint where conrelid='public.sp_audit_log'::regclass and contype='c'
 loop
  execute format('alter table public.sp_audit_log drop constraint %I', r.conname);
 end loop;
end $$;
alter table public.sp_audit_log add constraint sp_audit_log_action_check check (action in ('reveal','export','verification','engagement','outreach','consent','identity_view'));
