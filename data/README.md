# Candidate archetype catalogue

candidate-archetypes.json is a versioned backend catalogue, persisted in Git and packaged in each Vercel Function deployment. It is not a table of real candidates and does not use private CRM histories. The public static route does not expose the catalogue wholesale.

The catalogue covers all 33 selectable roles. Each record has a stable id/version, role-specific mandate, skills, three-stage dated example career progression, anonymous employer types, professional summary, experience length, leadership scope, markets, technologies and three distinct achievement examples. Version 2026-10-21.2 adds 100 role-appropriate fictional scenario metrics across all 33 roles. Every figure carries context and a hypothetical flag; the Portfolio Manager scenario includes a unitless, mathematically consistent Sharpe ratio. Role lookup supports canonical titles and selected executive abbreviations. Sector context and preferred location personalise the output without implying a person lives there.

Search flow: validate input and rate limit -> retrieve the saved role archetype -> check Recruit CRM server-side read-only -> return the selected fictional example and a safe CRM connection status. Individual CRM records never reach this display. No actual candidate availability or synthetic match percentage is asserted.

The browser renders the returned archetype and uses it for the hiring market brief. It no longer imports or authors the complete role catalogue. Normal lead capture and its retention/consent controls remain unchanged.

To edit a role: update the record in JSON, bump catalogue/record versions, run the catalogue and privacy tests, deploy, and verify a live search. Changes persist across restarts and deployments through the versioned source. This catalogue does not require new database credentials or migrations.
