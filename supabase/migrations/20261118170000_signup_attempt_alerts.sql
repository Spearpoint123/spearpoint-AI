-- Records signup blocks made by the Auth hook when the request never reaches the app.
-- The app emails the owner itself for signups and blocks it handles.
-- Apply once, then confirm Authentication > Hooks > Before user created still calls public.sp_before_employer_signup.

create table if not exists public.sp_signup_attempts (
 id uuid primary key default gen_random_uuid(),
 email text not null check (length(email) between 3 and 254),
 domain text not null default '' check (length(domain)<=253),
 outcome text not null check (outcome in ('blocked_personal','blocked_agency')),
 source text not null default 'auth_hook',
 created_at timestamptz not null default now(),
 alerted_at timestamptz
);
alter table public.sp_signup_attempts enable row level security;
revoke all on public.sp_signup_attempts from public, anon, authenticated;
grant all on public.sp_signup_attempts to service_role;

create or replace function public.sp_record_signup_attempt(p_email text, p_domain text, p_outcome text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_outcome not in ('blocked_personal','blocked_agency') then return; end if;
 insert into public.sp_signup_attempts(email, domain, outcome, source)
 values (left(coalesce(p_email,''),254), left(coalesce(p_domain,''),253), p_outcome, 'auth_hook');
exception when others then
 null;
end;
$$;
revoke all on function public.sp_record_signup_attempt(text,text,text) from public, anon, authenticated;
grant execute on function public.sp_record_signup_attempt(text,text,text) to supabase_auth_admin, service_role;

create or replace function public.sp_before_employer_signup(event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d text := lower(split_part(event->'user'->>'email','@',2));
declare address text := lower(coalesce(event->'user'->>'email',''));
begin
 if d is null or d = '' or d ~ '^(gmail[.]com|googlemail[.]com|yahoo[.].+|hotmail[.].+|outlook[.].+|live[.].+|msn[.].+|icloud[.]com|me[.]com|mac[.]com|aol[.]com|proton[.]me|protonmail[.]com|gmx[.].+|mail[.]com|yandex[.].+|mailinator[.]com|guerrillamail[.].+|yopmail[.]com|tempmail[.].+)$' then
  perform public.sp_record_signup_attempt(address, coalesce(d,''), 'blocked_personal');
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Please use your company work email to register as an employer.'));
 end if;
 if exists(select 1 from public.sp_employer_domains r where r.status='blocked' and (d=r.domain or right(d,length(r.domain)+1)='.'||r.domain)) then
  perform public.sp_record_signup_attempt(address, d, 'blocked_agency');
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Employer access is not available to recruitment agencies.'));
 end if;
 return '{}'::jsonb;
end;
$$;
revoke all on function public.sp_before_employer_signup(jsonb) from public, anon, authenticated;
grant execute on function public.sp_before_employer_signup(jsonb) to supabase_auth_admin;
