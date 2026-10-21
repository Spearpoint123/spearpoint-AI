# Delivery status

## CRM-first matching and consistent profile cards

- Connected read-only Recruit CRM search verified in this chat on the user's Spearpoint Search account. This does not automatically provision a hosted API credential.
- Public REST API contract checked in the official documentation: GET /v1/candidates/search, position filter, marked_as_off_limit=false, data[].position and data[].skill. The earlier unverified job_title/current_job_title mapping has been replaced.
- Implemented an 80% criteria-coverage gate (role 40 / requested experience 40 / location evidence 20) using approved shareable copy. Role alignment and current external-sharing consent are also mandatory. No hiring-success probability is asserted.
- Real and synthetic cards share Experience, Why it could fit and Gaps to discuss sections with the same booking CTA. Synthetic examples have no numeric match score.
- Fifteen local tests passed, including CRM GET-only requests, consent/off-limit exclusion, private-field suppression, threshold boundaries and honest disabled-connector behaviour.
- Vercel still has no RECRUIT_CRM_API_KEY. The Recruit CRM browser session is signed out. Live hosted CRM matching remains disabled until secure key setup and an account-specific smoke test. No candidate records or consent approvals were exported or created.

## Employer curiosity and booking showcase

- Added a prominent synthetic CTO/financial-technology showcase before the search form, with a target-experience narrative, potential impact and direct booking CTA.
- Each fallback search archetype now includes distinct experience/impact prompts and its own briefing link. No real identities, invented availability, employers or candidate track records are claimed.
- All synthetic profiles explicitly state they are illustrative and not real available candidates.

## Browser sign-in page

- Added a normal sign-in page so testers do not need a browser HTTP authentication popup. Username defaults to staging; the password stays in Vercel.
- Login is same-origin, rate-limited to 10 attempts per hour, and issues an 8-hour Secure/HttpOnly/SameSite=Strict signed cookie. Password rotation invalidates existing cookies. Protected content remains inaccessible without valid authentication.
- Ten local security tests passed. The deployment must be confirmed before this change is treated as live.

## Staging password and rate-limit configuration

- User saved a Secret under `STAGINGPASSWORD`; the app accepts this alias alongside `STAGING_PASSWORD`, preserving the 20-character minimum. The saved value was not read.
- Supabase server key is now saved as a Vercel Secret. It was shared in chat and still needs owner-led replacement.
- A cryptographically random RATE_LIMIT_HMAC_KEY was generated directly into Vercel's Secret form without printing or writing it locally.
- Eight local security tests passed, including the password alias and minimum length. Redeployment and authenticated browser verification remain pending.

## Database configuration completed

- Accessed the authorised Supabase project through the signed-in dashboard and created the three `sp_` tables and two server-only functions.
- Verified RLS is enabled on all three tables, and anon/authenticated roles have no SELECT privilege.
- Verified the rate-limit function accepts the first fixture request and rejects the next above the configured cap, within a rolled-back test transaction.
- Functions use SECURITY INVOKER, a fixed search path and explicit service_role-only execute privileges.
- Enabled pg_cron, scheduled `spearpoint-staging-retention` daily at 03:17 UTC, verified active status, and successfully invoked the retention function in a rolled-back test transaction.
- Saved non-secret Vercel Production environment configuration in the separate staging project: APP_ORIGIN (stable staging domain), SUPABASE_URL, STAGING_USER=staging, RETENTION_JOB_CONFIRMED=true, RECRUIT_CRM_ENABLED=false, HUBSPOT_SYNC_AUTHORIZED=false.
- Prepared an unsaved Vercel Secret entry form for STAGING_PASSWORD, SUPABASE_SERVICE_ROLE_KEY, RATE_LIMIT_HMAC_KEY and RECRUIT_CRM_API_KEY. No credential values were read or entered. User entry, redeployment and live acceptance tests remain required.

## Latest verified deployment

- Browser deployment in the user's actual **Spearpoint AI** workspace succeeded. Vercel reports **Ready**, deployment `dpl_7SctzG9DzW9ZriR4pTtVZUeG7Luk`, build duration 7 seconds.
- URL: https://spearpoint-ai-staging-a7oou2n6a-spearpoint-ai.vercel.app/
- Stable staging domain: https://spearpoint-ai-staging-psi.vercel.app/
- Source: `staging-mvp` branch, commit `0765bd6cbbe24ec8691743ffe18fb3d0ace192e6`.
- The browser dialog offered Create Preview Deployment, but the resulting deployment details explicitly label the environment **Production** inside this separate staging project. Do not describe it as a verified Preview environment.
- The deployed URL requires authentication; browser navigation returned invalid authentication credentials. Authenticated application behaviour is not yet verified. Supabase storage, retention, live CRM and secure environment setup remain pending.
- The earlier `sw-6031` project is a separate connector scope. The user's browser workspace is `spearpoint-ai` (team `team_mw1a0wr2OHTIU1olIElYrmMw`); native connector access to it still returns 403.

## Earlier build and access findings

- Source implemented; seven local security tests passed. A local browser fixture verified labelled synthetic results, the booking destination, and rejection of brief submission without storage readiness. Fixture mode exists only outside the deployable source, uses no live data and is not deployed.
- GitHub `Spearpoint123/spearpoint-AI` was confirmed empty. No prior Spearpoint Intelligence prototype was available in the workspace or that repository.
- Supabase connection lists no projects and rejects access to `pcezdsdhmjxpjakxtdhz`. Migration and live database tests are pending access restoration.
- Source saved to GitHub `Spearpoint123/spearpoint-AI`, main branch.
- Created Vercel project `spearpoint-ai-staging` (`prj_BXVhTHQTuor7260zwm8ECSv20aYR`) with SSO protection on all deployments. The returned owner is team `team_rpJF40On4QFTQP4WNYgUIVfm` (`sw-6031`).
- Vercel Git connection failed because its account needs a GitHub Login Connection. Direct-source Preview deployment was then rejected with 403: the connection lacks access to team `sw-6031`. No deployed URL exists and no deployment is claimed.
- No live Recruit CRM API key was accessed or requested in chat. Hosted connector remains disabled pending secure configuration and contract verification.
- HubSpot automatic contact creation is disabled; the supplied booking URL is wired into every booking CTA.
- Do not treat an uploaded or built deployment as a working end-to-end MVP until the documented live acceptance checks pass.
