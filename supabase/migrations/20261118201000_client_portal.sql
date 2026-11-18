-- Stage 2 client portal. Additive. Does not reuse public.sp_activity:
-- that table is the workspace outcomes log. Portal lines live in sp_search_activity.

alter table public.sp_requests add column if not exists body text not null default '';
do $$
declare r record;
begin
 for r in select conname from pg_constraint where conrelid='public.sp_requests'::regclass and contype='c'
 loop
  execute format('alter table public.sp_requests drop constraint %I', r.conname);
 end loop;
end $$;
alter table public.sp_requests add constraint sp_requests_type_check check (type in ('change_brief','add_target','pause','question','add_candidate','move_interview'));
alter table public.sp_requests add constraint sp_requests_status_check check (status in ('open','in_progress','done'));
alter table public.sp_calls add column if not exists previous_id uuid references public.sp_calls(id);

create table if not exists public.sp_request_events (
 id uuid primary key,
 request_id uuid not null references public.sp_requests(id) on delete cascade,
 status text not null check (status in ('open','in_progress','done')),
 note text not null default '',
 actor_id uuid,
 at timestamptz not null default now()
);
create unique index if not exists sp_pipeline_search_candidate on public.sp_pipeline(search_id, candidate_id);

alter table public.sp_request_events enable row level security;
revoke all on public.sp_request_events from public, anon, authenticated;
grant all on public.sp_request_events to service_role;

-- Authenticated and anon have no grants. The API uses service_role and, on every portal read
-- and export, checks organisation membership, a verified employer and an active engagement.
-- A reveal is returned only when sp_reveal_approvals is open and sp_audit_log has action reveal.
-- Every export inserts sp_audit_log.

alter table public.sp_product_events drop constraint if exists sp_product_events_name_check;
alter table public.sp_product_events add constraint sp_product_events_name_check check (name in ('brief_created','search_run','candidates_surfaced','intro_requested','shortlist_shared','csv_imported','outreach_drafted','role_created','brief_completed','call_booked','engagement_chosen','client_search','portal_opened','request_opened','portal_exported'));

insert into public.sp_employer_domains(domain,status,company_type,review_evidence)
values ('harbour-lane.example','blocked','unknown','Fictional sample domain for the client portal. Not a real employer. Signup is closed.')
on conflict (domain) do nothing;

insert into public.sp_organisations (id, legal_name, domain, website, verification_status, verified_at, verification_note, created_at)
values ('a1000001-0000-4000-8000-000000000001','Harbour Lane Capital (fictional)','harbour-lane.example','','verified','2026-11-11T09:00:00Z','Fictional sample. Not a real company.','2026-11-11T09:00:00Z')
on conflict (id) do nothing;

insert into public.sp_searches (id, organisation_id, created_by, title, status, profile, created_at, updated_at)
values ('a1000001-0000-4000-8000-000000000002','a1000001-0000-4000-8000-000000000001','a1000001-0000-4000-8000-0000000000aa','Head of quantitative research','live','{"title":"Head of quantitative research","function":"Quantitative research","seniority":"Senior","location":"Dubai or London","remote_policy":"Hybrid","base_pay":"250–350","total_pay":"400–600","must_haves":"crypto market making","nice_to_haves":"Python","target_firms":"crypto market makers","excluded_firms":"retail brokers","start_date":"Next quarter"}'::jsonb,'2026-11-11T09:00:00Z','2026-11-11T09:00:00Z')
on conflict (id) do nothing;

insert into public.sp_engagements (id, organisation_id, search_id, type, label, fee_percent, engagement_fee, monthly_amount, note, status, invoicing, created_at)
values ('a1000001-0000-4000-8000-000000000003','a1000001-0000-4000-8000-000000000001','a1000001-0000-4000-8000-000000000002','single','Single search',17.5,5000,0,'Fictional sample engagement.','active','manual','2026-11-11T09:00:00Z')
on conflict (id) do nothing;

insert into public.sp_pipeline (id, search_id, candidate_id, stage, updated_at) values
('a1000001-0000-4000-8000-000000000010','a1000001-0000-4000-8000-000000000002','c1000001-0000-4000-8000-000000000001','approached','2026-11-11T09:00:00Z'),
('a1000001-0000-4000-8000-000000000011','a1000001-0000-4000-8000-000000000002','c1000001-0000-4000-8000-000000000002','interested','2026-11-11T09:00:00Z'),
('a1000001-0000-4000-8000-000000000012','a1000001-0000-4000-8000-000000000002','c1000001-0000-4000-8000-000000000003','shortlisted','2026-11-11T09:00:00Z'),
('a1000001-0000-4000-8000-000000000013','a1000001-0000-4000-8000-000000000002','c1000001-0000-4000-8000-000000000004','interviewing','2026-11-11T09:00:00Z'),
('a1000001-0000-4000-8000-000000000014','a1000001-0000-4000-8000-000000000002','c1000001-0000-4000-8000-000000000005','offer','2026-11-11T09:00:00Z'),
('a1000001-0000-4000-8000-000000000015','a1000001-0000-4000-8000-000000000002','c1000001-0000-4000-8000-000000000006','hired','2026-11-11T09:00:00Z')
on conflict (id) do nothing;

insert into public.sp_search_activity (id, search_id, summary, created_at) values
('a1000001-0000-4000-8000-000000000020','a1000001-0000-4000-8000-000000000002','A senior researcher in Dubai was approached.','2026-11-11T09:00:00Z'),
('a1000001-0000-4000-8000-000000000021','a1000001-0000-4000-8000-000000000002','A London researcher moved to interested. Identity is still hidden from other searches.','2026-11-11T10:00:00Z'),
('a1000001-0000-4000-8000-000000000022','a1000001-0000-4000-8000-000000000002','The market map was refreshed for this search.','2026-11-11T11:00:00Z'),
('a1000001-0000-4000-8000-000000000023','a1000001-0000-4000-8000-000000000002','A request was opened to add someone from a crypto market maker.','2026-11-11T12:00:00Z')
on conflict (id) do nothing;

insert into public.sp_requests (id, search_id, type, status, body, created_at)
values ('a1000001-0000-4000-8000-000000000004','a1000001-0000-4000-8000-000000000002','add_candidate','in_progress','Add a candidate from a crypto market maker.','2026-11-11T09:00:00Z')
on conflict (id) do nothing;

insert into public.sp_request_events (id, request_id, status, note, at) values
('a1000001-0000-4000-8000-000000000031','a1000001-0000-4000-8000-000000000004','open','Opened.','2026-11-11T09:00:00Z'),
('a1000001-0000-4000-8000-000000000032','a1000001-0000-4000-8000-000000000004','in_progress','A partner is looking at firm types.','2026-11-12T09:00:00Z')
on conflict (id) do nothing;

insert into public.sp_calls (id, search_id, kind, status, meeting_url, starts_at)
values ('a1000001-0000-4000-8000-000000000040','a1000001-0000-4000-8000-000000000002','weekly','reminder','https://meetings-eu1.hubspot.com/sam-w/new-client-hiring-briefing-clone', now() + interval '7 days')
on conflict (id) do nothing;

insert into public.sp_reveal_approvals (id, candidate_id, organisation_id, search_id, approved_at, withdrawn_at) values
('a1000001-0000-4000-8000-000000000051','c1000001-0000-4000-8000-000000000002','a1000001-0000-4000-8000-000000000001','a1000001-0000-4000-8000-000000000002','2026-11-11T09:00:00Z',null),
('a1000001-0000-4000-8000-000000000052','c1000001-0000-4000-8000-000000000003','a1000001-0000-4000-8000-000000000001','a1000001-0000-4000-8000-000000000002','2026-11-11T09:00:00Z',null),
('a1000001-0000-4000-8000-000000000053','c1000001-0000-4000-8000-000000000004','a1000001-0000-4000-8000-000000000001','a1000001-0000-4000-8000-000000000002','2026-11-11T09:00:00Z',now())
on conflict (id) do nothing;

insert into public.sp_audit_log (id, action, entity, at, meta)
values ('a1000001-0000-4000-8000-000000000061','reveal','reveal:c1000001-0000-4000-8000-000000000002:a1000001-0000-4000-8000-000000000001:a1000001-0000-4000-8000-000000000002','2026-11-11T09:00:00Z','{"candidate_id":"c1000001-0000-4000-8000-000000000002","organisation_id":"a1000001-0000-4000-8000-000000000001","search_id":"a1000001-0000-4000-8000-000000000002","fictional":true}'::jsonb)
on conflict (id) do nothing;
