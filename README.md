# Spearpoint AI — private staging MVP

Free employer search → profile exploration → retained-search hiring briefing.

Booking: https://meetings-eu1.hubspot.com/sam-w/new-client-hiring-briefing-clone

## Run and verify

Node 22 or newer, zero runtime packages. `npm test`, `npm run check`, then `npm run dev` after securely configuring the environment. No environment values are committed. Protected pages and endpoints require a signed session from the browser sign-in form (or HTTP Basic Authentication); a missing password or password shorter than 20 characters denies all access. Assets live in `views/` and are served through the protected function, not an unprotected static directory.

## Secure staging setup

1. In Supabase project **pcezdsdhmjxpjakxtdhz**, inspect existing migrations, then apply `supabase/migrations/202610210001_staging.sql`. It creates only `sp_` prefixed tables/functions; no existing records are altered. Do not apply twice.
2. Enable Supabase Cron and schedule `select public.sp_purge_staging();` daily. Verify the job succeeds before setting `RETENTION_JOB_CONFIRMED=true`.
3. Configure Vercel **Preview** environment variables in its secure dashboard: `SUPABASE_URL` (the exact project URL), `SUPABASE_SERVICE_ROLE_KEY` (sensitive), `RATE_LIMIT_HMAC_KEY` (random ≥32 characters, sensitive), `STAGING_USER`, `STAGING_PASSWORD` (random ≥20 characters, sensitive), `APP_ORIGIN` (exact deployment or stable staging origin), and `RETENTION_JOB_CONFIRMED`. See `.env.example` for names only. Never paste credentials into chat, commits, query strings or browser code.
4. Keep Vercel deployment protection enabled. Use a Preview deployment, with no production domain. Keep password credentials in your password manager and share them only with authorised testers. Do not use `NEXT_PUBLIC_` prefixes.
5. Set `RECRUIT_CRM_API_KEY` securely, verify the GET `/v1/candidates/search` response/filter contract in this account, and only then set `RECRUIT_CRM_ENABLED=true`. The public API reference was checked at https://docs.recruitcrm.io/docs/rcrm-api-reference/253721386feef-search-for-candidates; the deployed application still needs a live credential smoke test. The ChatGPT Recruit CRM connection does not supply credentials to a hosted application.
6. Add consent approvals through an authorised operator only. Each row requires explicit external-sharing consent evidence, expiry, a recent review, and manually approved redacted public copy. Names, exact employers, contact details, URLs, unique project history and other identifying combinations must be removed during review. Do not bulk infer consent from general CRM membership. Revoke or expire the approval to remove publication. Review off-limits and current source status before approval, and after any material change.
7. Keep `HUBSPOT_SYNC_AUTHORIZED=false` until the owner explicitly authorises automatic contact creation. The booking CTA works independently. If enabled, contact sync sends name, email and company only; failure is recorded for operator review. Existing contacts can return a duplicate response and are marked `needs_review`; there is no automatic overwrite or retry.

## Behaviour and limits

- All Recruit CRM requests use a fixed server-side host and GET only. No CRM write endpoint exists. CRM results remain in memory and are never returned raw or logged.
- A real profile requires a matching CRM slug, explicit consent, no revocation, unexpired permission and a review in the last 30 days. Only approved public fields leave the server. Availability is never asserted.
- No shareable real result, disabled connector or CRM error produces explicitly labelled synthetic templates. These are not fabricated candidates and contain no names or availability claims. Templates are deterministic; this MVP does not perform generative AI ranking.
- Searches query the CRM first when its server credential is configured and the connector is enabled. The documented `position` and `marked_as_off_limit=false` filters are used; common executive title/acronym variants are queried with at most two pages each. A shared 45-request/minute provider budget limits upstream traffic. This bounded search is not comprehensive market coverage.
- Only current consented approvals can produce real cards. Scoring uses approved public title (40%), comma-separated experience/skill criteria (40%, proportional) and location evidence in approved copy (20%). Missing evidence earns no points. Admission requires role alignment and at least 80%; an 80% score can therefore include a location gap, which is explicitly shown. This is criteria coverage, not a validated suitability prediction. No protected personal characteristics enter the score. Raw CRM experience and contact data are not used as public explanations.
- Real and synthetic cards share Experience / Why it could fit / Gaps to discuss / booking sections. Synthetic cards never receive a real-match score. When live lookup is disabled or fails, the UI explicitly says that the CRM check was not completed; it does not claim the database contains no fit.
- Supabase backs atomic hourly limits: 20 searches and 5 briefs per keyed IP hash. Missing database or limiter configuration returns 503. No in-memory production limiter fallback.
- Exact-origin JSON POSTs, input bounds, a honeypot, no-store responses, CSP, anti-framing, no indexing and staging authentication apply. Search inputs and briefs are not logged by application code.
- Briefs are private under RLS, accessible only server-side and to trusted operators. Record retention is 30 days plus the daily purge interval. Rate hashes expire after their window plus a day. Scheduled deletion must be configured before lead capture is enabled.
- This is a private test environment. Public launch requires a completed legal-controller/privacy contact notice and an operational privacy process. Do not submit real personal data during staging.

## Required live acceptance checks

Verify an authenticated page and assets load, and anonymous protected-page/API requests are denied and the sign-in page is shown. Confirm no source or secret files are served. Verify the deployment’s security headers, mobile layout and booking destination. Test Supabase schema and RLS using anon/authenticated roles; rate-limit concurrency; 21st search and 6th brief limits; missing database rejection; a synthetic fallback; an explicitly approved fixture; expiry/revocation; CRM timeout; successful test brief storage; retention execution. Remove test data. Capture deployment state and live response checks before claiming the MVP is operational.

Local security tests are necessary but do not verify Vercel, Supabase or Recruit CRM connectivity. Deployment and integration status are tracked separately in `STATUS.md`.
