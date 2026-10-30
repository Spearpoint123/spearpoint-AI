# Spearpoint AI — confidential candidate search

Employer mandate → live, read-only Recruit CRM lookup → current sharing approvals → evidence checks → anonymised profiles → specialist introduction request.

This version removes the generated CV experience entirely. It never substitutes invented profiles for missing candidates. The existing brand, four-step journey, hiring market brief and HubSpot booking link are preserved.

## Run and check

Node 22 or newer, no runtime packages. Run `npm test`, `npm run check`, then `npm run dev` with the existing secure environment configuration. Keep secrets out of source control, chat, screenshots and browser code. Preview deployments retain the existing signed-session/Basic staging gate; public access still requires the exact `ai.spearpointsearch.com` hostname on Vercel.

## Search contract

- Recruit CRM uses fixed-host GET requests, canonical role aliases and a maximum of two pages per title variant. A shared 45-request/minute provider budget bounds traffic. This is a bounded title search, not an exhaustive search of all records or a market-supply estimate.
- Off-limits, deleted, unavailable and incompatible-title records are excluded locally as well as by the upstream filter. Raw CRM data is never sent to the browser, used to generate public biographies, or logged.
- Only rows in the existing private `sp_profile_approvals` table can become results. A row requires a matching current CRM slug, recorded external-display approval, nonempty approval evidence, unexpired permission, no revocation, a review in the last 30 days, and manually approved public title, summary and 1–10 skill tags.
- Public copy must have been reviewed for names, employers, contact details, unique project histories and identifying combinations. Automatic contact-pattern checks are an additional filter, not an anonymisation guarantee. The private approval_basis distinguishes candidate_permission from owner_approved_anonymised_summary. Owner approval must name the approving operator and must not be presented as candidate consent or permission for an introduction. Legacy consent-named columns hold release approval and its expiry alongside this basis. Do not infer release approval merely from CRM membership or availability.
- All structured essential criteria must match: role/title, selected sector, location (unless flexible), and every separately entered essential skill. Sector and location use explicit terms in approved copy; skills use approved skill tags. Unknown evidence excludes a result. This deliberately prioritises precision and can miss relevant candidates with incomplete tags.
- Additional brief notes are NOT automatically assessed. The interface and API state this clearly. Notes are available to the specialist when the employer submits a briefing request. No LLM or generated-CV cache is used.
- Responses return only approved public copy, criteria explanations, review date and a keyed opaque reference. They contain no raw CRM slug, contact details, private notes or consent evidence. No suitability percentage or verified-availability claim is made. Up to six matches are shown, ordered by sharing-review date.
- An empty successful lookup returns `200`, `outcome: no_shareable_matches` and `profiles: []`. CRM, approval-store and connector failures return `503`; these are not described as a successful empty search. Neither case generates a substitute profile.

## Introduction requests

“Request a confidential introduction” opens the existing consented employer form with the selected profile reference; it does not contact a candidate or automatically share identity. The employer submits the form explicitly. The existing private brief table stores the request, essential criteria and additional notes with its 30-day retention controls. A specialist must still confirm current fit, interest and permission before any introduction.

To resolve a public reference internally, an authorised operator can run `node scripts/profile-reference.mjs SP-…` with the same server-side Supabase configuration and `RATE_LIMIT_HMAC_KEY`. The script reads current approvals and prints the matching CRM slug only to the operator's terminal. It is not a web route. References are not authorisation tokens and are never accepted to retrieve candidate identity through the public API.

## Existing infrastructure

The app uses Supabase project `pcezdsdhmjxpjakxtdhz` and the existing `sp_` tables. Apply the additive record_anonymised_profile_approval_basis migration before this version; it records the basis and approving operator without changing table access grants. Preserve private table RLS/grants, exact-origin POST checks, staging authentication, shared rate limits and retention. Environment names are in `.env.example`. CRM must be enabled and configured on the server. Do not enable automatic HubSpot contact creation without separate authorisation.

Booking: https://meetings-eu1.hubspot.com/sam-w/new-client-hiring-briefing-clone

## Acceptance before release

1. Verify the deployment source is the updated `staging-mvp` lineage, not the older `main` prototype.
2. Confirm CRM access and private approval-table reads with the deployed server credentials. Inspect approved-record counts/expiry without exporting identities.
3. Use an explicitly consented, manually redacted record to verify a real match. Verify an expired/revoked/off-limits record does not appear. Do not create consent or permission as a testing shortcut.
4. Verify no-shareable-match and disconnected/error paths, preserved request/retention controls, mobile and desktop layouts, and candidate-reference follow-up context.
5. Remove test-only brief records through the established process. Do not claim live matching or production deployment from fixture tests alone.

See `CONFIDENTIAL-SEARCH.md` for the verification record and remaining live dependencies. Historical implementation details are retained in Git history and `STATUS.md`; this README describes current behaviour.
