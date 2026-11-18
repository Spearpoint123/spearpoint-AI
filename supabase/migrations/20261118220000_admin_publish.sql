-- Stage 4. Imported profiles stay unpublished until an admin publishes them.
alter table public.sp_candidates add column if not exists publication text not null default 'published';
alter table public.sp_candidates drop constraint if exists sp_candidates_publication_check;
alter table public.sp_candidates add constraint sp_candidates_publication_check check (publication in ('published','unpublished'));

alter table public.sp_product_events drop constraint if exists sp_product_events_name_check;
alter table public.sp_product_events add constraint sp_product_events_name_check check (name in ('brief_created','search_run','candidates_surfaced','intro_requested','shortlist_shared','csv_imported','outreach_drafted','role_created','brief_completed','call_booked','engagement_chosen','client_search','portal_opened','request_opened','portal_exported','partner_opened','stage_moved','time_logged','consent_decided','verification_decided','candidate_published','crm_import'));
