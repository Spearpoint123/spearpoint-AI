create or replace function public.sp_purge_staging() returns void language sql set search_path=pg_catalog,public as $$
delete from public.sp_briefs where expires_at<now();
delete from public.sp_rate_limits where reset_at<now()-interval '1 day';
delete from public.sp_profile_approvals where consent_expires_at<now() or revoked_at is not null;
delete from public.sp_activity where expires_at<now();
delete from public.sp_saved_searches where expires_at<now();
delete from public.sp_shortlists where expires_at<now();
$$;
revoke all on function public.sp_purge_staging() from public,anon,authenticated;
grant execute on function public.sp_purge_staging() to service_role;
