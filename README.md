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
| `SPEARPOINT_DEMO` | `true` only for local or preview rehearsals without a database |

Staff metadata, set in Supabase Auth on the user (never in the browser):

```json
{"spearpoint_role":"recruiter"}
```

Owners keep `spearpoint_owner: true`. Operators keep `spearpoint_role: "operator"`.

## Database

Apply the SQL files in `supabase/migrations` in filename order if they are not already present. The new file `20261118153000_retention_events_and_imports.sql` replaces `sp_purge_staging` so expired public-research leads are deleted, and adds `sp_product_events`, `sp_import_leads` and `sp_recruiter_pipeline`.

Schedule is declared in `vercel.json` (03:17 UTC daily). It calls `/api/internal/retention` with `Authorization: Bearer $CRON_SECRET`. Until `CRON_SECRET` is set and the function exists in the database, deletion does not run. Ask Spearpoint to delete a person’s record in the meantime.

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
