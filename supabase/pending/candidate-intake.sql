create table public.sp_candidate_submissions (
 id uuid primary key,
 reference text unique not null,
 full_name text not null check(length(full_name) between 1 and 120),
 email text not null check(length(email)<=254),
 linkedin_url text not null default '' check(length(linkedin_url)<=250),
 preferred_roles text not null check(length(preferred_roles) between 1 and 240),
 preferred_location text not null check(length(preferred_location) between 1 and 160),
 professional_summary text not null default '' check(length(professional_summary)<=6000),
 cv_path text,
 cv_name text not null default '',
 cv_text text not null default '' check(length(cv_text)<=20000),
 privacy_version text not null,
 consented_at timestamptz not null,
 ai_matching_consent boolean not null default false,
 ai_consented_at timestamptz,
 email_verified boolean not null default false,
 status text not null default 'submitted' check(status in ('submitted','reviewing','verified','withdrawn')),
 created_at timestamptz not null default now(),
 check(cv_path is not null or linkedin_url<>''),
 check(ai_matching_consent=(ai_consented_at is not null))
);
alter table public.sp_candidate_submissions enable row level security;
revoke all on public.sp_candidate_submissions from anon,authenticated;
grant all on public.sp_candidate_submissions to service_role;
create index sp_candidate_submissions_created on public.sp_candidate_submissions(created_at desc);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('candidate-cvs','candidate-cvs',false,2097152,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']);
comment on table public.sp_candidate_submissions is 'Private self-submitted talent network records. Unverified until reviewed. No automatic employer disclosure or CRM synchronisation.';
