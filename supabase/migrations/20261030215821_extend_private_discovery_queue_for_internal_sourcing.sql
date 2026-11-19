alter table public.sp_public_discoveries add column source text not null default 'public' check (source in ('internal','public'));
comment on column public.sp_public_discoveries.source is 'Private provenance of a professional lead; internal CRM records never sent to public research.';
