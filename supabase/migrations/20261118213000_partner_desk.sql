-- Stage 3 partner desk. Additive. service_role only. No plaintext names.

alter table public.sp_calls add column if not exists slots jsonb not null default '[]'::jsonb;
alter table public.sp_notes add column if not exists raw_text text not null default '';

do $$
declare r record;
begin
 for r in select conname from pg_constraint where conrelid='public.sp_calls'::regclass and contype='c'
 loop
  execute format('alter table public.sp_calls drop constraint %I', r.conname);
 end loop;
end $$;
alter table public.sp_calls add constraint sp_calls_kind_check check (kind in ('onboarding','weekly','interview'));

do $$
declare r record;
begin
 for r in select conname from pg_constraint where conrelid='public.sp_audit_log'::regclass and contype='c'
 loop
  execute format('alter table public.sp_audit_log drop constraint %I', r.conname);
 end loop;
end $$;
alter table public.sp_audit_log add constraint sp_audit_log_action_check check (action in ('reveal','export','verification','engagement','outreach','consent'));

create table if not exists public.sp_candidate_links (
 id uuid primary key,
 token_hash text not null unique,
 candidate_id uuid not null references public.sp_candidates(id) on delete cascade,
 organisation_id uuid not null references public.sp_organisations(id) on delete cascade,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 expires_at timestamptz not null,
 created_by uuid,
 created_at timestamptz not null default now()
);
alter table public.sp_candidate_links enable row level security;
revoke all on public.sp_candidate_links from public, anon, authenticated;
grant all on public.sp_candidate_links to service_role;

alter table public.sp_product_events drop constraint if exists sp_product_events_name_check;
alter table public.sp_product_events add constraint sp_product_events_name_check check (name in ('brief_created','search_run','candidates_surfaced','intro_requested','shortlist_shared','csv_imported','outreach_drafted','role_created','brief_completed','call_booked','engagement_chosen','client_search','portal_opened','request_opened','portal_exported','partner_opened','stage_moved','time_logged','consent_decided'));
