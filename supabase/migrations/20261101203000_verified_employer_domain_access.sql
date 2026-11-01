create table public.sp_employer_domains (
 domain text primary key check (domain = lower(domain) and domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,}$'),
 status text not null default 'pending' check (status in ('pending','approved','blocked')),
 company_type text not null default 'unknown' check (company_type in ('unknown','direct_employer','recruitment_agency')),
 company_name text not null default '' check (length(company_name)<=160),
 review_evidence text not null default '' check (length(review_evidence)<=1500),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (status <> 'approved' or (company_type='direct_employer' and length(company_name)>=2 and length(review_evidence)>=12 and reviewed_by is not null and reviewed_at is not null))
);
alter table public.sp_employer_domains enable row level security;
revoke all on public.sp_employer_domains from public, anon, authenticated;
grant all on public.sp_employer_domains to service_role;
grant select on public.sp_employer_domains to supabase_auth_admin;
create policy auth_domain_check on public.sp_employer_domains for select to supabase_auth_admin using (true);
create function public.sp_register_employer_domain(p_domain text) returns void language sql security invoker set search_path='' as $$
 insert into public.sp_employer_domains(domain) values(lower(p_domain)) on conflict(domain) do nothing;
$$;
revoke all on function public.sp_register_employer_domain(text) from public,anon,authenticated;
grant execute on function public.sp_register_employer_domain(text) to service_role;
insert into public.sp_employer_domains(domain,status,company_type,review_evidence)
select domain,'blocked','recruitment_agency','Known recruitment-agency domain; employer access is not available.'
from unnest(array['hays.com','hays.co.uk','randstad.com','roberthalf.com','michaelpage.com','pagegroup.com','adecco.com','manpower.com','manpowergroup.com','kornferry.com','spencerstuart.com','heidrick.com','russellreynolds.com']) domain;
insert into public.sp_employer_domains(domain) select distinct lower(split_part(email,'@',2)) from auth.users where email like '%@%' on conflict(domain) do nothing;
create function public.sp_before_employer_signup(event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d text := lower(split_part(event->'user'->>'email','@',2));
begin
 if d is null or d = '' or d ~ '^(gmail[.]com|googlemail[.]com|yahoo[.].+|hotmail[.].+|outlook[.].+|live[.].+|msn[.].+|icloud[.]com|me[.]com|mac[.]com|aol[.]com|proton[.]me|protonmail[.]com|gmx[.].+|mail[.]com|yandex[.].+|mailinator[.]com|guerrillamail[.].+|yopmail[.]com|tempmail[.].+)$' then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Please use your company work email to register as an employer.'));
 end if;
 if exists(select 1 from public.sp_employer_domains r where r.status='blocked' and (d=r.domain or right(d,length(r.domain)+1)='.'||r.domain)) then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Employer access is not available to recruitment agencies.'));
 end if;
 return '{}'::jsonb;
end;
$$;
revoke all on function public.sp_before_employer_signup(jsonb) from public,anon,authenticated;
grant execute on function public.sp_before_employer_signup(jsonb) to supabase_auth_admin;
