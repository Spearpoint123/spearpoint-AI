# Spearpoint AI — confidential candidate search

Employer signup → private company context → AI-drafted, employer-approved brief → evidence table of reviewed CRM summaries and public discoveries → saved candidates → specialist introduction pipeline. The earlier live Recruit CRM guided search remains at `/explore`.

The employer workflow uses Spearpoint branding and its existing server infrastructure. It does not use or claim access to a competitor’s proprietary technology. Generated candidate biographies and invented profiles are never substituted for missing candidates.

## Run and check

Node 22 or newer, no runtime packages. Run `npm test`, `npm run check`, then `npm run dev` with the existing secure environment configuration. Keep secrets out of source control, chat, screenshots and browser code. Preview deployments retain the existing signed-session/Basic staging gate; public access still requires the exact `ai.spearpointsearch.com` hostname on Vercel.

## Search contract

- Recruit CRM uses fixed-host GET requests, canonical role aliases and a maximum of two pages per title variant. A shared 45-request/minute provider budget bounds traffic. This is a bounded title search, not an exhaustive search of all records or a market-supply estimate.
- Off-limits, deleted, unavailable and incompatible-title records are excluded locally as well as by the upstream filter. Raw CRM data is never sent to the browser, used to generate public biographies, or logged.
- Only rows in the existing private `sp_profile_approvals` table can become results. A row requires a matching current CRM slug, recorded external-display approval, nonempty approval evidence, unexpired permission, no revocation, a review in the last 30 days, and manually approved public title, summary and 1–10 skill tags.
- Public copy must have been reviewed for names, employers, contact details, unique project histories and identifying combinations. Automatic contact-pattern checks are an additional filter, not an anonymisation guarantee. The private approval_basis distinguishes candidate_permission from owner_approved_anonymised_summary. Owner approval must name the approving operator and must not be presented as candidate consent or permission for an introduction. Legacy consent-named columns hold release approval and its expiry alongside this basis. Do not infer release approval merely from CRM membership or availability.
- All structured essential criteria must match: role/title, selected sector, location (unless flexible), and every separately entered essential skill. Sector and location use explicit terms in approved copy; skills use approved skill tags. Unknown evidence excludes a result. This deliberately prioritises precision and can miss relevant candidates with incomplete tags.
- Additional brief notes are NOT automatically assessed. The interface and API state this clearly. Notes are available to the specialist when the employer submits a briefing request. This guided path uses no LLM or generated-CV cache. The separately reviewed natural-language path is described below.
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

## Compliance workspace release

Natural-language mandates go through AI Gateway (Google Gemini 2.5 Flash Lite) for constrained criteria extraction only. The employer reviews the interpretation before matching against a manually reviewed compliance catalogue. No candidate data goes to the model. Evidence categories, explicit missing evidence and unmapped requirements are returned; partial results are never labelled complete matches. Catalogue reads do not query current CRM status: the 30-day approved summary is a dated snapshot, and availability is always unconfirmed.

Supabase Auth email/password workspaces require verified email. Tokens stay in an AES-GCM encrypted HttpOnly Secure SameSite cookie. Owners can save 50 mandates and 50 shortlists, check new fully evidenced matches in-app, generate/rotate/revoke 7-day read-only links and record confirmed outcomes. The first five saved searches are checked when the workspace opens. No alert email, team membership or automatic candidate outreach is implemented. Each account owns its records. Shared links are bearer access to current approved anonymised copy only.

Private workspace tables have RLS enabled and no anon/authenticated grants. Server queries always filter owner_id from verified Supabase identity. Shared link hashes are never returned to clients. Metrics count recorded searches and active search days, manually confirmed shortlist/introduction outcomes, reported minutes saved, and staff delivery time multiplied by hourly GBP cost. AI billing costs remain unknown until reconciled; no zero-cost claim is made. Metrics cover retained records only.

Apply workspace and outcome migrations before deployment. The extended nightly retention migration expires records after 180 days; confirm it is applied before describing physical deletion as active. Production email delivery/confirmation must be verified with an intended pilot user; default Supabase mail restrictions may require a custom SMTP provider. Do not disable email verification.

## All-niche expansion

Natural-language search now covers all eight sectors and eight role groups defined in views/talent-taxonomy.js. The model extracts a role, family, explicitly requested sectors, all/any sector semantics, location, supported capabilities and unmapped requirements. Sector and role filters are mandatory: a profile in another sector or at another role level is excluded rather than presented as a partial match. Missing capability evidence is an explicit gap; at least one requested capability must be evidenced before a partial result can appear. No sector implies an unrequested capability.

The reviewed catalogue contains 35 anonymised summaries at release. Coverage counts are computed from currently valid approvals, broken down by sector and role group. Counts overlap between sectors and do not represent market size or current availability. Legacy compliance saved searches are normalised on read; their criteria and owner isolation are retained. Shared shortlists can resolve any currently approved niche profile. Candidate data stays outside the interpretation model.

## Employer hiring workflow (30 October 2026)

- `/signup` and `/signin` use verified Supabase email/password accounts; confirmation is required. No Google login or automatic organisation membership is configured. Company records and roles belong to the verified account, with service-side owner checks.
- `/hiring` supports company setup, optional citation-backed public company research, AI brief interpretation, manual calibration, versioned brief approval, internal candidate comparison, private notes, saved/passed candidates and introduction requests. Editing a brief creates a new comparison version. Search is on demand, not continuous monitoring.
- All eight supported sectors and eight role groups share the same workflow. Internal comparisons use the current reviewed CRM summary catalogue. They do not scan every raw CRM record. The existing `/explore` guided search retains its bounded live CRM lookup.
- `google/gemini-2.5-flash-lite` through AI Gateway interprets the employer-entered role description and compensation. The employer explicitly reviews the result before activation.
- `perplexity/sonar` through the existing AI Gateway connection researches publicly indexed professional pages, including available LinkedIn `/in/` pages. This is not a direct LinkedIn API, authenticated LinkedIn access, or an exhaustive public-profile index. Provider citations must support each stored URL. Failures preserve internal results. Global allowance is 10 public searches/day, with 3 per owner/day, maximum five discoveries per call. Company research has a separate 10/day global and 2/day owner allowance. These limits bound traffic, not a guaranteed billing cap.
- Public candidate research receives only the approved structured role, sector, location and professional capability labels. Company names, raw job descriptions, compensation, private notes and CRM records are excluded from that request. Company research separately sends only the explicitly approved company name and website.
- Raw public names, employers, citations and excerpts remain in a service-only review queue. Employers see opaque pending rows. A trusted specialist must review the source and manually enter an anonymised summary with release authority evidence. Approved summaries expire within 30 days. URL deduplication is per role/brief version; cross-source CRM deduplication remains future work.
- Operator authority comes exclusively from the verified Auth `app_metadata.spearpoint_role=operator` claim. No operator has been silently provisioned. Client payloads and user metadata cannot grant this role. An intended verified operator account must be separately authorised before live specialist review can run.
- Introduction requests are private records. Nothing is sent and no identity is automatically released. The state machine requires documented candidate agreement before completion can be recorded. Revocable shared shortlist links include only currently approved anonymised summaries.
- The additive migration `20261030200804_add_employer_role_workspace_and_reviewed_public_discovery.sql` creates five private tables with RLS and no anon/authenticated table grants. Employer, role, pipeline and introduction access expires after 180 days; public discoveries after 30 days. Physical deletion of these new/workspace tables is not yet part of the existing nightly cleanup job; the pending retention extension requires separate approval.

### Verification scope

The Node suite covers owner isolation, private pending discoveries, trusted operator authority, citation grounding, research input boundaries, stale versions, paused roles and introduction consent transitions. An isolated local browser fixture verifies company → brief → internal table → saved candidate → introduction request, then a masked public discovery. It makes no production calls and writes no fabricated outcomes. Production email delivery, an intended verified employer account, operator provisioning and an authenticated live Sonar discovery remain operational checks; fixture results must not be represented as live provider verification.

### Simplified employer onboarding

One `/signup` page serves all employers. It asks only for work email, password and privacy acknowledgement; verified email is still required. Company setup requires only a name, with website optional and richer context behind an optional disclosure. Employers describe a role in plain language, review the brief, and search. Sector/niche selection is absent from this workflow; any professional sector context is inferred from the description. Detailed role classification and capability refinement are optional. Public catalogue totals and the older coverage-count display have been removed; individual search results still show their evidence and limits.

### Live signup test (30 October 2026)

The authorised owner mailbox signup was tested through the production endpoint. Auth created an unconfirmed account, the confirmation email arrived, and following it verified the account. The Supabase Site URL was still `http://localhost:3000`, causing a broken post-confirmation return; it has been corrected to `https://ai.spearpointsearch.com/signin` and checked after reloading the settings. Confirmation remains enabled. The default Supabase email sender is still in use, so general employer email delivery requires custom SMTP before public onboarding. The sign-in screen now initialises its mode before the account check completes.

The live owner walkthrough subsequently passed sign-in, company setup, Gemini brief interpretation, brief approval and internal search, returning two approved anonymised CTO summaries. One live Sonar research call completed with zero public discoveries; the UI now explicitly reports that empty result. The walkthrough role was labelled as a product test and paused afterward. No candidate outreach, introductions or claimed hiring outcomes were created. The browser sign-in rate counter was reset once with the owner’s explicit approval after prior testing exhausted it; limits remain unchanged.
