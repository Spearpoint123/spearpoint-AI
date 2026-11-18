-- Retention for public-research leads, plus first-party metrics and recruiter imports.
-- Apply once in the Supabase SQL editor after the earlier sp_ migrations.
-- Then set CRON_SECRET in Vercel (20+ characters) so the daily job can call /api/internal/retention.

create table if not exists public.sp_product_events (
 id uuid primary key,
 owner_id uuid,
 name text not null check (name in ('brief_created','search_run','candidates_surfaced','intro_requested','shortlist_shared','csv_imported','outreach_drafted','role_created')),
 props jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create table if not exists public.sp_import_leads (
 id uuid primary key,
 owner_id uuid,
 source text not null default 'linkedin_recruiter_export',
 full_name text not null check (length(full_name) between 2 and 180),
 title text not null default '',
 company text not null default '',
 location text not null default '',
 profile_url text not null default '',
 fictional boolean not null default false,
 pipeline_stage text not null default 'imported',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '30 days'
);
create table if not exists public.sp_recruiter_pipeline (
 id uuid primary key,
 owner_id uuid,
 candidate_key text not null,
 stage text not null check (stage in ('new','shortlisted','outreach_drafted','intro_requested','interviewing','placed','archived','imported')),
 note text not null default '',
 created_at timestamptz not null default now()
);
alter table public.sp_product_events enable row level security;
alter table public.sp_import_leads enable row level security;
alter table public.sp_recruiter_pipeline enable row level security;
revoke all on public.sp_product_events, public.sp_import_leads, public.sp_recruiter_pipeline from anon, authenticated;
grant all on public.sp_product_events, public.sp_import_leads, public.sp_recruiter_pipeline to service_role;

create or replace function public.sp_purge_staging() returns void language sql security invoker set search_path=pg_catalog,public as $$
 delete from public.sp_briefs where expires_at<now();
 delete from public.sp_rate_limits where reset_at<now()-interval '1 day';
 delete from public.sp_profile_approvals where consent_expires_at<now() or revoked_at is not null;
 delete from public.sp_activity where expires_at<now();
 delete from public.sp_saved_searches where expires_at<now();
 delete from public.sp_shortlists where expires_at<now();
 delete from public.sp_public_discoveries where expires_at<now() or (review_status='rejected' and discovered_at<now()-interval '30 days');
 delete from public.sp_import_leads where expires_at<now();
 delete from public.sp_product_events where created_at<now()-interval '180 days';
$$;
revoke all on function public.sp_purge_staging() from public, anon, authenticated;
grant execute on function public.sp_purge_staging() to service_role;
