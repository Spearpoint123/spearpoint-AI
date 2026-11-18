# Spearpoint AI

Employer workspace for confidential senior hiring, plus a Spearpoint team desk for day-to-day search. Clients describe a role, review an AI interpretation, compare anonymised evidence and request a specialist introduction. The team can see names, search more deeply, import a LinkedIn Recruiter export and draft outreach. Nothing is sent automatically.

The public wording on the marketing pages is unchanged in substance. This repository is the application behind [ai.spearpointsearch.com](https://ai.spearpointsearch.com/).

## Architecture

- One Vercel serverless function, `api/index.mjs`, serves the HTML, CSS and JSON API. There is no separate static host, so security headers apply to every response.
- Employer accounts use Supabase Auth. The session cookie is encrypted, HttpOnly and `SameSite=Strict`.
- RecruitCRM is read on the server. A note is written only when `RECRUIT_CRM_WRITE=true` and a recruiter confirms it.
- Public-web research, where configured, goes through the existing provider adapters. Spearpoint does not scrape LinkedIn. Licensed sources plug in behind `lib/sourcing/providers.mjs`. LinkedIn Recruiter is used by pasting a generated Boolean string, or by uploading a CSV the recruiter exported themselves.
- Client surfaces stay anonymised. The team desk at `/recruit` is limited to staff (`spearpoint_owner`, `spearpoint_role=operator` or `spearpoint_role=recruiter` on the Supabase user’s `app_metadata`).
- First-party product events (briefs, searches, candidates surfaced, introduction requests) are stored for the team metrics panel. There is no advertising cookie.

## Run the demonstration

Node.js 22 or newer.

```bash
npm install
npm test
npm run dev
```

Open http://127.0.0.1:3000. `npm run dev` enables the fictional demonstration when no Supabase service key is set.

| Desk | Email | Password |
|---|---|---|
| Client portal (`/signin`, then `/hiring`) | `client@demo.spearpoint.test` | `demo-client-pass` |
| Live search (`/begin/portal`) | `portal@harbour-lane.example` | `demo-portal-pass` |
| Partner desk (`/begin/desk`) | `recruiter@demo.spearpoint.test` | `demo-recruiter-pass` |
| Team workspace (`/recruit`) | `recruiter@demo.spearpoint.test` | `demo-recruiter-pass` |

The demonstration password works only while `SPEARPOINT_DEMO=true`, no Supabase service key is present, and `VERCEL_ENV` is not `production`. Every demo person is invented. Do not turn the demonstration on for `ai.spearpointsearch.com`.

Suggested walk-through:

1. Sign in on `/recruit` and search “quantitative equities python”. Results are labelled fictional.
2. Build a LinkedIn Recruiter string and import a small CSV. Confirm the draft outreach says nothing was sent.
3. Sign out, sign in as the client, and run a search with three must-haves. Names and email addresses are not shown.

## Environment

See `.env.example`. Set real values in Vercel, not in git.

| Name | Purpose |
|---|---|
| `APP_ORIGIN` | Exact browser origin allowed to POST |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database and auth. Required outside the demo |
| `RATE_LIMIT_HMAC_KEY` | 32+ characters. Hashes IP rate limits and seals session cookies |
| `STAGING_USER`, `STAGING_PASSWORD` | Basic auth for private deployments. Password at least 20 characters |
| `RECRUIT_CRM_ENABLED`, `RECRUIT_CRM_API_KEY` | Live ATS search. Without them, the team desk shows the fictional set |
| `RECRUIT_CRM_WRITE` | Must be `true` before a confirmed note is saved to RecruitCRM |
| `AI_GATEWAY_API_KEY` | Employer brief interpretation |
| `ROCKETREACH_API_KEY` | Optional licensed enrichment already used by employer search |
| `PEOPLE_DATA_LABS_API_KEY`, `CORESIGNAL_API_KEY` | Reserved. The adapters are stubs and make no requests |
| `CRON_SECRET` | 20+ characters. Authorises `GET /api/internal/retention` |
| `OWNER_ALERT_EMAIL` | The only address that receives signup alerts. Set this to `sam@spearpointsearch.com` |
| `ALERT_FROM_EMAIL` | From address on a domain verified in Resend |
| `RESEND_API_KEY` | Resend API key. If it is empty, alerts are skipped and signup still succeeds |
| `SPEARPOINT_DEMO` | `true` only for local or preview rehearsals without a database |

Staff metadata, set in Supabase Auth on the user (never in the browser):

```json
{"spearpoint_role":"recruiter"}
```

Owners keep `spearpoint_owner: true`. Operators keep `spearpoint_role: "operator"`.

## Database

Apply the SQL files in `supabase/migrations` in filename order if they are not already present. The new file `20261118153000_retention_events_and_imports.sql` replaces `sp_purge_staging` so expired public-research leads are deleted, and adds `sp_product_events`, `sp_import_leads` and `sp_recruiter_pipeline`.

Schedule is declared in `vercel.json` (03:17 UTC daily). It calls `/api/internal/retention` with `Authorization: Bearer $CRON_SECRET`. Until `CRON_SECRET` is set and the function exists in the database, deletion does not run. Ask Spearpoint to delete a person’s record in the meantime. The same job emails any signup blocks recorded by the auth hook and not yet sent.

## Signup alerts

A new employer account, or a signup the app blocks (personal email, agency domain, or a missing direct-employer declaration), emails `OWNER_ALERT_EMAIL` through Resend. The send is registered with Vercel `waitUntil` and also awaited for at most three seconds, so the function cannot freeze before the message is handed to Resend. Signup still succeeds if the alert fails. Logs are `owner_alert_sent`, `owner_alert_skipped`, and `owner_alert_failed`. The message includes the address, domain, whether that domain is new or already pending, whether it is a personal or agency domain, the time in Europe/London, and a link to `/owner`. The applicant is not emailed.

The same address is limited to one alert an hour. If `RESEND_API_KEY` or `ALERT_FROM_EMAIL` is missing, the alert is logged and skipped. A failed send does not fail signup.

Blocks that reach Supabase Auth directly, without the app, are rejected by `public.sp_before_employer_signup` and stored in `sp_signup_attempts`. The daily retention call sends those as one digest. In the Supabase dashboard, Authentication → Hooks → Before user created must call `public.sp_before_employer_signup`. Apply `supabase/migrations/20261118170000_signup_attempt_alerts.sql` once so the hook can record those attempts.

## Client journey

`/begin` is the new client path: work-email sign-up, a short brief, an editable search profile, a market map, a plain-English profile search, anonymised profiles, the HubSpot booking link, and an engagement choice. `/begin/portal` is the live search for a verified employer with an active engagement. It shows the pipeline, an updated market map, plain-English activity in `sp_search_activity` (the older `sp_activity` table is the workspace outcomes log and is not reused), the next weekly call, and tracked requests. Identity stays hidden unless that candidate has an open reveal for that employer and the reveal is in `sp_audit_log`. It reads `sp_candidates` only. RocketReach and other licensed providers are not called. RecruitCRM is not written to. Apply `supabase/migrations/20261118190000_client_journey.sql` and `supabase/migrations/20261118201000_client_portal.sql`. Set `CANDIDATE_IDENTITY_KEY` before storing identity. Leave `HUBSPOT_MEETINGS_AUTOBOOK` false until a HubSpot Meetings API is connected. The local demo seeds fictional anonymised profiles when those migrations are not applied.

The local demo sets a throwaway identity key when none is configured, so the sample reveal can be shown. Do not reuse that key. The local portal sign-in is `portal@harbour-lane.example` / `demo-portal-pass`. `client@demo.spearpoint.test` stays unverified, so the portal shows the closed state.

## Partner desk

`/begin/desk` is for a recruiter, operator or owner. It lists assigned searches with the next action and overdue items, then one search workspace: pipeline moves, notes, plain-English activity, the client request queue, time entries, outreach drafts, interview slots, call summaries and an offer comparison against pay bands already in the database. Outreach is drafted by Gemini when `AI_GATEWAY_API_KEY` is set, otherwise by a fixed note. It is sent only after an explicit confirm, and only from an address on `PARTNER_OUTREACH_DOMAIN`. A reveal link is copied, not emailed. The candidate opens `/begin/consent` and approves or withdraws for that one employer. Apply `supabase/migrations/20261118213000_partner_desk.sql`. `RECRUIT_CRM_WRITE` stays false. Licensed provider search is not called from this desk.

`/` and `/begin` both serve the search front. A visitor can try a search and see counts, pay bands and three anonymised teasers before creating an account. `/signin`, `/signup`, `/hiring`, `/workspace`, `/recruit`, `/owner`, `/talent-network`, `/consult`, `/privacy` and `/api/*` are unchanged. The previous marketing page, including its `#how` section, is at `/classic`. `/begin/admin` is for an owner or operator: verify an employer, activate an engagement, set terms, read the report, review reveals and exports, publish imported profiles, and hide the fictional demo set. A RecruitCRM pull is not run from this release. Imported profiles stay unpublished until an admin publishes them. Licensed providers are listed on the partner desk as disabled adapters and are not called. Client search still rejects them. Outreach can be sent only from an address on `PARTNER_OUTREACH_DOMAIN`, after an explicit click, and the send is logged. Apply `supabase/migrations/20261118220000_admin_publish.sql`, then `supabase/migrations/20261118230000_demo_profiles.sql`. The second file inserts 82 fictional published profiles with `source='demo'` and no identity rows. It does nothing when the id already exists. Hide them from Admin, or run `update public.sp_candidates set publication='unpublished' where source='demo' and fictional=true;`. Remove only those rows with `delete from public.sp_candidates where source='demo' and fictional=true;`.

## Checks

`npm test` runs the suite. `npm run check` parses the entrypoints.

## Founder actions before this is relied on in production

- Rotate any Supabase service key, staging password, RecruitCRM key or HubSpot token that has ever been pasted into a chat, a ticket or a deployed bundle. This tree does not contain those values; the project URL in `.env.example` is not itself a secret, but the service-role key for that project must stay private.
- Set the Vercel env vars above on the staging project first. Do not set `SPEARPOINT_DEMO` on production.
- Apply the new SQL migration and set `CRON_SECRET`.
- Put `spearpoint_role` on each teammate’s Supabase user before they use `/recruit`.
- Buy a web licence for GT Canon and GT Standard if those faces should return. The trial files have been removed. Pages now use Georgia and the system sans.
- Decide whether People Data Labs, Coresignal or another licensed source should be implemented. The stubs do not call those APIs.
- Replace the HubSpot booking slug if `new-client-hiring-briefing-clone` should not be the public link. It is still the live booking URL and has not been changed.
