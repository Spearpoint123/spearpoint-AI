create unique index if not exists sp_activity_unique_shortlist_acceptance on public.sp_activity(owner_id,shortlist_id,event_type) where event_type='shortlist_accepted';
create unique index if not exists sp_activity_unique_introduction_outcome on public.sp_activity(owner_id,shortlist_id,profile_ref,event_type) where event_type in ('introduction_requested','introduction_accepted');
