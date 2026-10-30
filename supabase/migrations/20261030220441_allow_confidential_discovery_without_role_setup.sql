alter table public.sp_public_discoveries alter column role_id drop not null;
alter table public.sp_public_discoveries add column search_id uuid, add column search_criteria jsonb;
alter table public.sp_public_discoveries add constraint sp_discovery_context_check check ((role_id is not null and search_id is null) or (role_id is null and search_id is not null and search_criteria is not null));
create index sp_discovery_owner_search on public.sp_public_discoveries(owner_id,search_id) where search_id is not null;
