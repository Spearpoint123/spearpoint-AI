# Spearpoint AI — private staging MVP

Free employer search → profile exploration → retained-search hiring briefing.

Booking: https://meetings-eu1.hubspot.com/sam-w/new-client-hiring-briefing-clone

## Run and verify

Node 22 or newer, zero runtime packages. `npm test`, `npm run check`, then `npm run dev` after securely configuring the environment. No environment values are committed. All pages and endpoints require HTTP Basic Authentication; a missing password or password shorter than 20 characters denies all access. Assets live in `views/` and are served through the protected function, not an unprotected static directory.

## Secure staging setup

1. In Supabase project **pcezdsdhmjxpjakxtdhz**, inspect existing migrations, then apply `supabase/migrations/202610210001_staging.sql`. It creates only `sp_` prefixed tables/functions; no existing records are altered. Do not apply twice.
2. Enable Supabase Cron and schedule `select public.sp_purge_staging();` daily. Verify the job succeeds before setting `RETENTION_JOB_CONFIRMED=true`.
3. Configure Vercel **Preview** environment variables in its secure dashboard: `SUPABASE_URL` (the exact project URL), `SUPABASE_SERVICE_ROLE_KEY` (sensitive), `RATE_LIMIT_HMAC_KEY` (random ≥32 characters, sensitive), `STAGING_USER`, `STAGING_PASSWORD` (random ≥20 characters, sensitive), `APP_ORIGIN` (exact deployment or stable staging origin), and `RETENTION_JOB_CONFIRMED`. See `.env.example` for names only. Never paste credentials into chat, commits, query strings or browser code.
4. Keep Vercel deployment protection enabled. Use a Preview deployment, with no production domain. Keep password credentials in your password manager and share them only with authorised testers. Do not use `NEXT_PUBLIC_` prefixes.
5. Set `RECRUIT_CRM_API_KEY` securely, verify the GET `/v1/candidates/search` response/filter contract in this account, and only then set `RECRUIT_CRM_ENABLED=true`. This connector is implemented but remains disabled until a live contract test. The ChatGPT Recruit CRM connection does not supply credentials to a hosted application.
6. Add consent approvals through an authorised operator only. Each row requires explicit external-sharing consent evidence, expiry, a recent review, and manually approved redacted public copy. Names, exact employers, contact details, URLs, unique project history and other identifying combinations must be removed during review. Do not bulk infer consent from general CRM membership. Revoke or expire the approval to remove publication. Review off-limits and current source status before approval, and after any material change.
7. Keep `HUBSPOT_SYNC_AUTHORIZED=false` until the owner explicitly authorises automatic contact creation. The booking CTA works independently. If enabled, contact sync sends name, email and company only; failure is recorded for operator review. Existing contacts can return a duplicate response and are marked `needs_review`; there is no automatic overwrite or retry.

## Behaviour and limits

- All Recruit CRM requests use a fixed server-side host and GET only. No CRM write endpoint exists. CRM results remain in memory and are never returned raw or logged.
- A real profile requires a matching CRM slug, explicit consent, no revocation, unexpired permission and a review in the last 30 days. Only approved public fields leave the server. Availability is never asserted.
- No shareable real result, disabled connector or CRM error produces explicitly labelled synthetic templates. These are not fabricated candidates and contain no names or availability claims. Templates are deterministic; this MVP does not perform generative AI ranking.
- Searches support role and city matching. Essential experience is captured for the consultant and illustrative templates; it is not a validated CRM skills filter. Do not present this as comprehensive market coverage. A single upstream page (25 results) and up to 100 approval rows are considered. No total supply counts are shown.
- Supabase backs atomic hourly limits: 20 searches and 5 briefs per keyed IP hash. Missing database or limiter configuration returns 503. No in-memory production limiter fallback.
- Exact-origin JSON POSTs, input bounds, a honeypot, no-store responses, CSP, anti-framing, no indexing and staging authentication apply. Search inputs and briefs are not logged by application code.
- Briefs are private under RLS, accessible only server-side and to trusted operators. Record retention is 30 days plus the daily purge interval. Rate hashes expire after their window plus a day. Scheduled deletion must be configured before lead capture is enabled.
- This is a private test environment. Public launch requires a completed legal-controller/privacy contact notice and an operational privacy process. Do not submit real personal data during staging.

## Required live acceptance checks

Verify an authenticated page and assets load, and anonymous page/API/assets requests are denied. Confirm no source or secret files are served. Verify the deployment’s security headers, mobile layout and booking destination. Test Supabase schema and RLS using anon/authenticated roles; rate-limit concurrency; 21st search and 6th brief limits; missing database rejection; a synthetic fallback; an explicitly approved fixture; expiry/revocation; CRM timeout; successful test brief storage; retention execution. Remove test data. Capture deployment state and live response checks before claiming the MVP is operational.

Local security tests are necessary but do not verify Vercel, Supabase or Recruit CRM connectivity. Deployment and integration status are tracked separately in `STATUS.md`.
