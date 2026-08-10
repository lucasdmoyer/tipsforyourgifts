# Founder playbook

## Start with the ranked agenda

Open `/studio` and read **Founder agenda** before the detailed operating queues. It is generated from versioned strategy, release, growth, social, and affiliate evidence. The order is deliberate:

1. review the exact publication manifest so the modern owned site can become the trustworthy destination;
2. choose one proposed recipient problem so the research team and opportunity scout regain capacity;
3. establish aggregate measurement before scaling traffic work;
4. configure one official social channel before approving or publishing individual posts; and
5. evaluate a narrow affiliate pilot only after editorial rank is fixed.

Each decision states the recommendation, evidence, unlock, tradeoff, guardrail, reversibility, and exact founder action. Profitability remains `unknown_until_aggregate_measurement`; the agenda must never turn missing traffic, conversion, or revenue data into a positive or negative claim.

For measurement, follow the exact staged action shown in Studio: configure the canonical Search Console URL-prefix property with credential-free evidence, merge the review pull request, activate it through the protected environment, then let the read-only Friday collector propose aggregate snapshots. Configuration and activation do not contact Google; collection remains disabled until both are merged.

After a managed Firebase release, the release card remains until the strict post-deploy receipt is synchronized into `web/config/live-publication.json` and its content-set SHA-256 matches the current candidate. This avoids repeatedly asking you to release content that Git can prove is already live. Affiliate and social cards automatically advance from selection to activation handoffs as their founder-controlled registries change state.

## The executive brief

Use `/studio` or the GitHub executive-content issue form to record:

- recipient or audience
- occasion and timing
- budget range
- geography
- exclusions or safety constraints
- what a successful article should help the reader decide
- the recurring problem, worn item, or workaround you have noticed
- why the recipient would welcome the improvement but postpone buying it
- the proof-of-fit and compatibility questions the team must answer
- when two gifts belong together, the shared idea and different role of each item

Submitting an owner-authored `[Strategy]` issue starts the strategy council automatically. It may create one proposed brief, but cannot approve it. Review the proposal pull request, then run **Approve strategy idea for research** with the exact ID and revision shown in Studio. When that second pull request merges, a separate workflow verifies that exactly one unchanged proposed thesis advanced one revision to `approved_for_research`, reruns all gates, and automatically queues its research mission. The merge authorizes only that research mission.

Example:

```text
npm --prefix web run strategy:resolve -- founder-idea-003
```

The resolver accepts only a founder-approved idea and emits its exact revision and SHA-256 digest. The research run is bound to that identity.

## The autonomous opportunity desk

The weekly scout is the system's permission to look for the next thoughtful thesis—not permission to research products, publish, or monetize. It searches public sources for recipient language, recurring workarounds, a self-purchase gap, editorial whitespace, and honest rejection conditions. It considers several candidates and may append only one commission-independent proposal after a separate editor issues a hash-bound clean review.

The current founder queue cap is five open proposals. At the cap, the scheduled run exits before an AI credential is used and records `founder_backlog_full`. Resolve a proposal by approving, pausing, or rejecting it; the next scheduled scout then regains capacity without a configuration change.

Use Studio to inspect the posture and exact thresholds. Manual recovery is available through **Scout thoughtful gift opportunities**, but it follows the same cap, evidence, reviewer-separation, and proposal-only rules. See `OPPORTUNITY_SCOUTING.md`.

## What the team returns

- stable research run ID
- dated source and claim ledger
- candidate and finalist scorecards when it is a roundup
- recipient-friction, self-purchase, ownership, duplicate, clutter, and compatibility scorecards
- pair-coherence evidence when two items are meant to work together
- matching Markdown article
- independent QA result
- affiliate posture and any stop conditions
- exact validation, test, build, and smoke results
- a reviewable branch or pull request, never an unreviewed production mutation

## Founder decisions that cannot be delegated

- accepting affiliate program terms or adding account identifiers
- granting OpenAI, Firebase, analytics, or social credentials
- approving high-risk categories, sponsored or free products, and hands-on claims
- selecting public social accounts, cadence, and brand voice
- approving the first ten production content releases
- changing Firestore or Realtime Database from deny-by-default

## Weekly executive review

Use `/studio` and the workbook to answer six questions:

1. Which audience and occasion deserves the next research run?
2. Which pages earn qualified search impressions and outbound clicks?
3. Where is the pipeline blocked by evidence, affiliate, or account setup?
4. Which recommendation or claim is aging fastest?
5. What should the team stop doing next week?
6. Which proposed thesis should be approved, paused, or rejected so the opportunity desk can keep learning without flooding the queue?

## Publication-mode decision

Keep `founder_reviewed` for the first ten successful production releases. Studio displays the versioned policy snapshot; **Enable proven automatic publication** independently recounts unique successful GitHub `production` deployments and refuses to propose the change below ten. Inspect the incident rate, research corrections, preview failures, rollback readiness, and traffic quality before running it. Its pull request is the final go/no-go artifact; do not merge it until branch protection, GitHub auto-merge, least-privilege Firebase credentials, notifications, and the production environment match `PUBLICATION_AUTOMATION.md`.
