alter table public.sp_profile_approvals add column approval_basis text not null default 'candidate_permission' check (approval_basis in ('candidate_permission','owner_approved_anonymised_summary')), add column approved_by text;
comment on column public.sp_profile_approvals.external_sharing_consent is 'Legacy release-approval flag. Interpret with approval_basis: owner approval is not candidate consent.';
comment on column public.sp_profile_approvals.consent_evidence is 'Release evidence for the declared approval_basis; owner authorisation must not be described as candidate consent.';
