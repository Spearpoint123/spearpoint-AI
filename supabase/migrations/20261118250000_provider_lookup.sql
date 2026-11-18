-- Allow the partner desk to audit RocketReach lookups and unpublished imports.

do $$
declare r record;
begin
 for r in select conname from pg_constraint where conrelid='public.sp_audit_log'::regclass and contype='c'
 loop
  execute format('alter table public.sp_audit_log drop constraint %I', r.conname);
 end loop;
end $$;
alter table public.sp_audit_log add constraint sp_audit_log_action_check check (action in ('reveal','export','verification','engagement','outreach','consent','identity_view','provider_lookup','provider_import'));
