# Confidential search implementation — 30 October 2026

## Implemented

- Removed the generated CV route, generation/cache modules, fictional catalogue and their obsolete tests.
- Search now calls the existing CRM-first matching path and requires current, evidenced sharing approval.
- Every essential structured requirement must match approved information. Additional notes are explicitly for consultant review.
- Results show approved anonymised summaries, evidence, sharing-review date and opaque profile references. No invented history, performance figures, suitability score or availability claim.
- Introduction requests use the existing private employer briefing form. A selected reference is included for specialist follow-up; no candidate outreach occurs automatically.
- Empty results contain no substitute profiles. Connector/provider/approval-store failures produce a service-unavailable response, distinct from a successful empty search.
- Updated website copy and both privacy notices. Existing host restrictions, staging authentication, CSRF/origin checks, shared rate limits and brief retention remain in force.
- Added an internal reference-resolution utility. No new public identity-retrieval route or database migration.

## Verification

- 28 automated tests passed, including real approved match projection, no raw identity/slug/consent-evidence leakage, expired/revoked/unconsented records, off-limits flags, hard requirement checks, no-match responses, CRM/approval-store failures, no generation calls, staging access and existing brief storage.
- JavaScript syntax and Git whitespace checks passed.
- Local browser test through the actual interface and API with an isolated, explicitly marked TEST DATA fixture: sector → specialism → CTO → London → essential Python skill → approved match rendered; introduction button carried opaque reference into form; explicit test submission acknowledged by local fixture storage.
- Editing the search cleared the previous result and introduction context. Searching for unsupported Rust returned no shareable matches; the hiring brief remained available.
- Fixture server has no production credentials, no live candidate records and performs no external writes. Fixture verification is not live integration verification.

## Live dependencies still pending

Supabase and Vercel access have been restored and verified. The existing approval table contains zero records. No production deployment or live candidate match is claimed yet. The owner authorised publishing the code and reviewing candidate-profile approvals; each profile still needs recorded permission and manually reviewed anonymised copy before external display.

Before release, verify live CRM and approval-table access, current approved-record coverage, an explicitly consented/redacted match and no-match/error paths on a protected deployment. Existing approvals must cover the intended external presentation; neither general CRM inclusion nor openness to opportunities is a substitute. Do not broaden table grants or approve records just to make a demo return results.

## Current limits

Matching is deterministic and deliberately strict. It relies on approved text/skill tags and can miss candidates with incomplete tags or alternative wording. CRM pagination remains bounded to two pages per role variant, so this is not an exhaustive search across all records. Private candidate onboarding/consent management, semantic ranking, saved employer workspaces and ATS integrations remain future work, rather than claims of this release.
