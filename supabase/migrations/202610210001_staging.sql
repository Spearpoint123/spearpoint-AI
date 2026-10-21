-- Additive staging-only tables. Run exclusively in project pcezdsdhmjxpjakxtdhz.
begin;
create table public.sp_briefs (
 id uuid primary key, name text not null, email text not null, company text not null,
 role text not null, location text not null, skills text not null, notes text not null,
 privacy_version text not null, consented_at timestamptz not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 days',
 hubspot_status text not null default 'disabled' check (hubspot_status in ('disabled','synced','needs_review'))
);
create table public.sp_profile_approvals (
 crm_slug text primary key,
 external_sharing_consent boolean not null default false,
 consent_evidence text not null, consent_expires_at timestamptz not null,
 revoked_at timestamptz, reviewed_at timestamptz not null,
 public_title text not null, public_summary text not null, public_skills text[] not null,
 check (cardinality(public_skills) between 1 and 10)
);
create table public.sp_rate_limits (key text primary key, count integer not null, reset_at timestamptz not null);
alter table public.sp_briefs enable row level security;
alter table public.sp_profile_approvals enable row level security;
alter table public.sp_rate_limits enable row level security;
revoke all on public.sp_briefs, public.sp_profile_approvals, public.sp_rate_limits from anon, authenticated;
grant all on public.sp_briefs, public.sp_profile_approvals, public.sp_rate_limits to service_role;
create function public.sp_take_rate_limit(p_key text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
declare consumed integer;
begin
 if p_limit<1 or p_limit>100 or p_window_seconds<60 or p_window_seconds>86400 then return false; end if;
 insert into public.sp_rate_limits as r(key,count,reset_at) values(p_key,1,now()+make_interval(secs=>p_window_seconds))
 on conflict(key) do update set count=case when r.reset_at<=now() then 1 else r.count+1 end,
 reset_at=case when r.reset_at<=now() then now()+make_interval(secs=>p_window_seconds) else r.reset_at end
 returning count into consumed;
 return consumed<=p_limit;
end; $$;
revoke all on function public.sp_take_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.sp_take_rate_limit(text,integer,integer) to service_role;
create function public.sp_purge_staging() returns void language sql security invoker set search_path=pg_catalog,public as $$
 delete from public.sp_briefs where expires_at<now();
 delete from public.sp_rate_limits where reset_at<now()-interval '1 day';
 delete from public.sp_profile_approvals where consent_expires_at<now() or revoked_at is not null;
$$;
revoke all on function public.sp_purge_staging() from public,anon,authenticated;
grant execute on function public.sp_purge_staging() to service_role;
commit;
-- Schedule SELECT public.sp_purge_staging() daily with Supabase Cron after checking extension availability.
