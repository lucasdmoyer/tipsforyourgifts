# Founder editorial safety decisions

This directory contains immutable, versioned decisions for exact high-risk reader-facing language.

Only `.github/workflows/editorial-safety-approval.yml` may create a record. The protected workflow requires repository owner `lucasdmoyer`, an action-time confirmation, and the `editorial-safety-approval` environment. It has no model credential and opens a pull request without merging or deploying.

Each record binds:

- the research run and article identity;
- canonical reviewable run and article content plus the exact social draft, when present;
- every claim explicitly classified `risk: high` and its source IDs;
- the decision, workflow run, owner identity, timestamp, and required acknowledgements.

An `approved` decision does not certify the evidence, approve affiliate links, accept terms, merge a pull request, or authorize publication. A separate independent editor must still pass the bundle. Any substantive change makes the latest decision stale and requires a new revision. Rejections remain part of the audit history and fail closed until the content changes and Lucas records a new decision.
