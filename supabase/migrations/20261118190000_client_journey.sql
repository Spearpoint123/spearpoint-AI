-- Stage 1 client journey. Additive. RLS on. service_role only.
-- Identity ciphertext is written by the app (AES-GCM). This file stores no names.

create table if not exists public.sp_organisations (
 id uuid primary key,
 legal_name text not null,
 domain text not null unique,
 website text not null default '',
 verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
 verified_by uuid,
 verified_at timestamptz,
 verification_note text not null default '',
 created_at timestamptz not null default now()
);
create table if not exists public.sp_memberships (
 id uuid primary key,
 user_id uuid not null,
 organisation_id uuid not null references public.sp_organisations(id) on delete cascade,
 role text not null check (role in ('client_admin','hiring_manager','talent_lead')),
 created_at timestamptz not null default now(),
 unique (user_id, organisation_id)
);
create table if not exists public.sp_searches (
 id uuid primary key,
 organisation_id uuid not null references public.sp_organisations(id) on delete cascade,
 created_by uuid not null,
 partner_id uuid,
 title text not null default '',
 status text not null default 'draft' check (status in ('draft','market_view','verification_pending','call_booked','live','paused','closed')),
 profile jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.sp_candidates (
 id uuid primary key,
 source text not null check (source in ('recruitcrm','talent_network','consented')),
 crm_slug text,
 level text not null,
 seniority text not null,
 years_bucket text not null,
 region text not null,
 firm_type text not null,
 sector text not null,
 pay_band text not null,
 scope jsonb not null default '{}',
 sector_history jsonb not null default '[]',
 skills text[] not null default '{}',
 summary text not null,
 fictional boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.sp_candidate_identity (
 id uuid primary key,
 candidate_id uuid not null references public.sp_candidates(id) on delete cascade,
 ciphertext text not null,
 key_version integer not null default 1,
 created_at timestamptz not null default now()
);
create table if not exists public.sp_consents (
 id uuid primary key,
 candidate_id uuid not null references public.sp_candidates(id) on delete cascade,
 purpose text not null check (purpose in ('in_database','anonymised_matching')),
 granted_at timestamptz not null default now(),
 withdrawn_at timestamptz,
 evidence text not null default ''
);
create table if not exists public.sp_search_matches (
 id uuid primary key,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 candidate_id uuid not null references public.sp_candidates(id),
 rank integer not null,
 score integer not null,
 why text not null default '',
 strong boolean not null default false,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '180 days'
);
create table if not exists public.sp_market_snapshots (
 id uuid primary key,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 captured_at timestamptz not null default now(),
 counts jsonb not null default '{}',
 pay_band text not null default '',
 strong_match_count integer not null default 0,
 beyond_database boolean not null default false,
 expires_at timestamptz not null default now() + interval '180 days'
);
create table if not exists public.sp_client_queries (
 id uuid primary key,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 query text not null default '',
 filters jsonb not null default '{}',
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '180 days'
);
create table if not exists public.sp_pipeline (
 id uuid primary key,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 candidate_id uuid not null references public.sp_candidates(id),
 stage text not null check (stage in ('approached','interested','shortlisted','interviewing','offer','hired','withdrawn')),
 updated_at timestamptz not null default now(),
 updated_by uuid
);
create table if not exists public.sp_reveal_approvals (
 id uuid primary key,
 candidate_id uuid not null references public.sp_candidates(id) on delete cascade,
 organisation_id uuid not null references public.sp_organisations(id) on delete cascade,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 approved_at timestamptz not null default now(),
 withdrawn_at timestamptz,
 unique (candidate_id, organisation_id, search_id)
);
create table if not exists public.sp_outreach_drafts (
 id uuid primary key,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 candidate_id uuid not null references public.sp_candidates(id),
 body text not null default '',
 status text not null default 'draft' check (status in ('draft','sent_by_partner')),
 sent_at timestamptz,
 partner_id uuid,
 created_at timestamptz not null default now()
);
create table if not exists public.sp_notes (
 id uuid primary key,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 candidate_id uuid references public.sp_candidates(id),
 kind text not null check (kind in ('call','interview','offer')),
 body text not null,
 author_id uuid,
 created_at timestamptz not null default now()
);
create table if not exists public.sp_requests (
 id uuid primary key,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 type text not null check (type in ('change_brief','add_target','pause','question')),
 status text not null default 'open' check (status in ('open','done')),
 assignee_id uuid,
 opened_by uuid,
 completed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.sp_time_entries (
 id uuid primary key,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 partner_id uuid,
 hours numeric not null check (hours >= 0 and hours <= 24),
 worked_on date not null default current_date,
 note text not null default ''
);
create table if not exists public.sp_calls (
 id uuid primary key,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 kind text not null check (kind in ('onboarding','weekly')),
 status text not null default 'scheduled',
 meeting_url text not null default '',
 starts_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.sp_engagements (
 id uuid primary key,
 organisation_id uuid not null references public.sp_organisations(id) on delete cascade,
 search_id uuid references public.sp_searches(id) on delete set null,
 type text not null check (type in ('single','core','enterprise')),
 label text not null,
 fee_percent numeric not null,
 engagement_fee numeric not null default 0,
 monthly_amount numeric not null default 0,
 note text not null default '',
 status text not null default 'recorded',
 invoicing text not null default 'manual',
 created_at timestamptz not null default now()
);
create table if not exists public.sp_search_activity (
 id uuid primary key,
 search_id uuid not null references public.sp_searches(id) on delete cascade,
 actor_id uuid,
 summary text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '180 days'
);
create table if not exists public.sp_audit_log (
 id uuid primary key,
 actor_id uuid,
 action text not null check (action in ('reveal','export','verification','engagement')),
 entity text not null,
 at timestamptz not null default now(),
 meta jsonb not null default '{}'
);

alter table public.sp_organisations enable row level security;
alter table public.sp_memberships enable row level security;
alter table public.sp_searches enable row level security;
alter table public.sp_candidates enable row level security;
alter table public.sp_candidate_identity enable row level security;
alter table public.sp_consents enable row level security;
alter table public.sp_search_matches enable row level security;
alter table public.sp_market_snapshots enable row level security;
alter table public.sp_client_queries enable row level security;
alter table public.sp_pipeline enable row level security;
alter table public.sp_reveal_approvals enable row level security;
alter table public.sp_outreach_drafts enable row level security;
alter table public.sp_notes enable row level security;
alter table public.sp_requests enable row level security;
alter table public.sp_time_entries enable row level security;
alter table public.sp_calls enable row level security;
alter table public.sp_engagements enable row level security;
alter table public.sp_search_activity enable row level security;
alter table public.sp_audit_log enable row level security;

revoke all on public.sp_organisations, public.sp_memberships, public.sp_searches, public.sp_candidates, public.sp_candidate_identity, public.sp_consents, public.sp_search_matches, public.sp_market_snapshots, public.sp_client_queries, public.sp_pipeline, public.sp_reveal_approvals, public.sp_outreach_drafts, public.sp_notes, public.sp_requests, public.sp_time_entries, public.sp_calls, public.sp_engagements, public.sp_search_activity, public.sp_audit_log from public, anon, authenticated;
grant all on public.sp_organisations, public.sp_memberships, public.sp_searches, public.sp_candidates, public.sp_candidate_identity, public.sp_consents, public.sp_search_matches, public.sp_market_snapshots, public.sp_client_queries, public.sp_pipeline, public.sp_reveal_approvals, public.sp_outreach_drafts, public.sp_notes, public.sp_requests, public.sp_time_entries, public.sp_calls, public.sp_engagements, public.sp_search_activity, public.sp_audit_log to service_role;

insert into public.sp_candidates (id, source, level, seniority, years_bucket, region, firm_type, sector, pay_band, scope, sector_history, skills, summary, fictional) values
('c1000001-0000-4000-8000-000000000001','recruitcrm','Senior','senior','10–15 yrs','Dubai','crypto market maker','digital assets','250–350','{"team":"6–15","pnl":"single desk","asset_classes":["crypto"],"products":["market making","basis"]}'::jsonb,'["crypto market maker","prop trading"]'::jsonb,array['research','crypto','market making','python','risk'],'Senior quantitative researcher on a crypto market-making desk. Dubai. Pay band 250–350.',true),
('c1000001-0000-4000-8000-000000000002','talent_network','Senior','senior','10–15 yrs','London','crypto market maker','digital assets','250–350','{"team":"6–15","pnl":"single desk","asset_classes":["crypto","equities"],"products":["market making"]}'::jsonb,'["crypto market maker","tier-1 HFT"]'::jsonb,array['research','crypto','market making','statistics'],'Senior researcher. Crypto and equity market making. London. Pay band 250–350.',true),
('c1000001-0000-4000-8000-000000000003','recruitcrm','Director','director','15–20 yrs','London','tier-1 HFT','equities','350–500','{"team":"15–40","pnl":"multi-desk","asset_classes":["equities"],"products":["market making","execution"]}'::jsonb,'["tier-1 HFT","prop trading"]'::jsonb,array['leadership','equities','execution','research'],'Director. Systematic equities at a tier-1 HFT. London. Pay band 350–500.',true),
('c1000001-0000-4000-8000-000000000004','consented','VP','vp','10–15 yrs','Dubai','crypto exchange','digital assets','250–350','{"team":"15–40","pnl":"venue","asset_classes":["crypto"],"products":["spot","derivatives"]}'::jsonb,'["crypto exchange","fintech"]'::jsonb,array['venue','crypto','derivatives','management'],'VP. Crypto exchange, spot and derivatives. Dubai. Pay band 250–350.',true),
('c1000001-0000-4000-8000-000000000005','recruitcrm','Staff','staff','10–15 yrs','London','market maker','equities','200–250','{"team":"6–15","pnl":"single desk","asset_classes":["equities"],"products":["low latency"]}'::jsonb,'["market maker"]'::jsonb,array['low latency','c++','equities'],'Staff engineer. Low-latency equities. London. Pay band 200–250.',true),
('c1000001-0000-4000-8000-000000000006','talent_network','Senior','senior','5–10 yrs','London','hedge fund','equities','150–200','{"team":"2–5","pnl":"pod","asset_classes":["equities"],"products":["stat arb"]}'::jsonb,'["hedge fund"]'::jsonb,array['research','equities','python'],'Senior researcher. Equity statistical arbitrage. London. Pay band 150–200.',true),
('c1000001-0000-4000-8000-000000000007','recruitcrm','Head','director','15–20 yrs','London','hedge fund','multi-asset','350–500','{"team":"15–40","pnl":"book","asset_classes":["equities","macro"],"products":["portfolio"]}'::jsonb,'["hedge fund","bank"]'::jsonb,array['portfolio','leadership','macro'],'Head of trading. Multi-asset hedge fund. London. Pay band 350–500.',true),
('c1000001-0000-4000-8000-000000000008','consented','VP','vp','10–15 yrs','Europe','fintech','payments','200–250','{"team":"15–40","pnl":"product line","asset_classes":["payments"],"products":["platform"]}'::jsonb,'["fintech","bank"]'::jsonb,array['platform','payments','management'],'VP engineering. Payments platform. Europe. Pay band 200–250.',true),
('c1000001-0000-4000-8000-000000000009','recruitcrm','Senior','senior','10–15 yrs','Dubai','prop trading','digital assets','250–350','{"team":"2–5","pnl":"pod","asset_classes":["crypto"],"products":["research"]}'::jsonb,'["prop trading","crypto market maker"]'::jsonb,array['research','crypto','statistics'],'Senior quantitative researcher. Crypto prop desk. Dubai. Pay band 250–350.',true),
('c1000001-0000-4000-8000-00000000000a','talent_network','Director','director','15–20 yrs','London','bank','markets','200–250','{"team":"40+","pnl":"division","asset_classes":["rates","credit"],"products":["risk"]}'::jsonb,'["bank"]'::jsonb,array['risk','markets','leadership'],'Director. Markets risk at a bank. London. Pay band 200–250.',true)
on conflict (id) do nothing;

alter table public.sp_product_events drop constraint if exists sp_product_events_name_check;
alter table public.sp_product_events add constraint sp_product_events_name_check check (name in ('brief_created','search_run','candidates_surfaced','intro_requested','shortlist_shared','csv_imported','outreach_drafted','role_created','brief_completed','call_booked','engagement_chosen','client_search'));

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
 delete from public.sp_search_matches where expires_at<now();
 delete from public.sp_market_snapshots where expires_at<now();
 delete from public.sp_client_queries where expires_at<now();
 delete from public.sp_search_activity where expires_at<now();
$$;
