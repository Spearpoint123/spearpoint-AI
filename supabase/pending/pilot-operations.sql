alter table public.sp_candidate_submissions add column matching_approved boolean not null default false,
 add column approved_copy jsonb, add column verification_evidence text,
 add column reviewed_by uuid references auth.users(id) on delete set null, add column reviewed_at timestamptz;
create table public.sp_search_runs(
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 criteria jsonb not null,internal_status text not null,public_status text not null,
 profile_count integer not null default 0,matched_count integer not null default 0,
 source_diagnostics jsonb not null default '{}',duration_ms integer not null default 0,
 employer_feedback text not null default 'not_reviewed' check(employer_feedback in ('not_reviewed','useful','not_useful')),
 feedback_at timestamptz,accepted_refs text[] not null default '{}',shortlist_accepted_at timestamptz,staff_minutes numeric check(staff_minutes>=0 and staff_minutes<=10000),
 reported_provider_cost_usd numeric check(reported_provider_cost_usd>=0 and reported_provider_cost_usd<=100000),
 cost_recorded_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '180 days'
);
create index on public.sp_search_runs(owner_id,created_at desc);
create table public.sp_profile_requests(
 id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 search_id uuid references public.sp_search_runs(id) on delete cascade,reference text not null check(reference ~ '^SP-[A-F0-9]{16}$'),
 status text not null default 'requested' check(status in ('requested','reviewing','permission_requested','candidate_agreed','introduced','declined')),
 request_note text not null default '' check(length(request_note)<=1500),
 permission_evidence text not null default '' check(length(permission_evidence)<=1500),
 operator_note text not null default '' check(length(operator_note)<=1500),updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '180 days',unique(owner_id,search_id,reference)
);
create index on public.sp_profile_requests(status,created_at);
create table public.sp_pilots(
 id uuid primary key,employer_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 2 and 160),status text not null check(status in ('prospect','active','complete','cancelled')),
 pricing_model text not null check(pricing_model in ('undecided','subscription','per_search','success_fee','hybrid')),
 amount_paid numeric not null default 0 check(amount_paid>=0),currency text not null check(currency in ('USD','AED','GBP','EUR')),
 payment_evidence text not null default '' check(length(payment_evidence)<=1500),
 updated_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.sp_operations_log(id uuid primary key,actor_id uuid references auth.users(id) on delete set null,action text not null,entity_id uuid not null,created_at timestamptz not null default now());
alter table public.sp_search_runs enable row level security;
alter table public.sp_profile_requests enable row level security;
alter table public.sp_pilots enable row level security;
alter table public.sp_operations_log enable row level security;
revoke all on public.sp_search_runs,public.sp_profile_requests,public.sp_pilots,public.sp_operations_log from anon,authenticated;
grant all on public.sp_search_runs,public.sp_profile_requests,public.sp_pilots,public.sp_operations_log to service_role;
