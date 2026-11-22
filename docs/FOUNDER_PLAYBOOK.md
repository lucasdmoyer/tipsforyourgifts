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

## Set the AI operating budget

The **AI authority and spend** card in `/studio` shows the exact SHA-256 of the versioned policy. First set a real monthly limit inside the dedicated OpenAI Platform project. Then use **Record Lucas-approved budget** with that exact digest, the approved USD amount, and a credential-free OpenAI Platform settings URL. The owner-only workflow validates the repository, prepares a narrow patch, validates it again in a separate writer job, and opens a pull request for review.

That pull request records your attestation; it does not independently verify or change the external account. It also cannot add a credential, call a model, activate the policy, merge, deploy Firebase, publish content, activate affiliate links, post to social media, or send email. After it merges, Studio moves to `budget approved awaiting credential`. Credential verification and policy activation remain separate founder-controlled decisions before any AI run can spend money.

After the budget pull request merges, add the dedicated project key as repository secret `OPENAI_API_KEY` and create the protected `ai-automation-credential` environment with yourself as reviewer. Use **Verify dedicated AI credential** from Studio. The secret exists only inside one protected verifier step that checks out and runs no repository code. It authenticates against OpenAI's documented models endpoint, discards the response body, calls no model, and hands a credential-free receipt to a separate writer job. Review and merge that receipt pull request.

Studio then offers **Propose AI policy activation**. This second protected workflow receives no OpenAI key and calls no external service. It opens an exact-hash pull request changing only the versioned policy. Review what becomes eligible—the six allowlisted, read-only model workflows and their credential-free writer jobs—then merge only if you intend those bounded jobs to begin using the approved monthly platform budget. Until that merge, the key remains unusable by the model preflight.

## The executive brief

Use `/studio/brief` for a guided completeness check, or use the raw GitHub executive-content issue form, to record:

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

The Angular builder performs only local completeness and credential-pattern checks, then opens a prefilled issue for final review in GitHub. It stores nothing and does not bypass GitHub ownership or approval controls. Submitting an owner-authored `[Strategy]` issue starts the strategy council automatically. It may create one proposed brief, but cannot approve it. Review the proposal pull request, then run **Approve strategy idea for research** with the exact ID and revision shown in Studio. When that second pull request merges, a separate workflow verifies that exactly one unchanged proposed thesis advanced one revision to `approved_for_research`, reruns all gates, and automatically queues its research mission. The merge authorizes only that research mission.

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

## High-risk editorial language

High-risk claims never become publication-ready because an agent checked its own box. Studio lists the exact claim text, source IDs, current article bundle hashes, and whether the latest founder decision is missing, current, rejected, or stale.

The research workflow classifies this route before the independent-review model receives a credential. Low-risk drafts continue to the separate evidence editor. A draft with any explicitly classified high-risk claim skips that model call, remains excluded from the public site, and opens a founder-safety handoff pull request with auto-merge disabled. Merging that pull request stores only the versioned draft and started mission on `master`; it does not publish the article or complete the mission.

Use **Record founder editorial safety decision** only after reading the exact run, article, and social draft. Enter the run ID, choose `approved` or `rejected`, and confirm `REVIEW-<run-id>-<decision>`. The protected `editorial-safety-approval` environment permits only repository owner `lucasdmoyer`; the workflow creates an immutable, versioned receipt and opens a pull request. It has no OpenAI credential, cannot merge, and cannot deploy.

Studio generates the exact approve and reject commands for every bundle that contains a high-risk claim. Each command repeats the run ID in its action-time confirmation so the decision cannot silently drift to another draft. The command is an executive shortcut, not delegated authority: Lucas still selects the decision, GitHub still enforces the owner-only protected environment, and approval still does not replace independent QA or authorize publication.

The receipt binds the reviewable run and article content, the social draft, and every explicitly classified high-risk claim by SHA-256. Lifecycle-only changes from draft to publication-ready do not invalidate it; any substantive source, article, social, or claim change does. Approval means only that Lucas accepted the exact reader-facing safety boundary. A separate independent editor must still issue a fresh clean receipt, and the exact-SHA preview and release approval remain separate.

After an approved safety-decision pull request merges, **Run independent editorial recheck** selects that exact run automatically. Its model job has read-only repository permission and may produce only one structured findings file. A separate job without the OpenAI credential converts those findings into the next immutable `qa.vN` receipt. Failed receipts remain in Git without changing the article; a later revision cannot overwrite them. Only a clean receipt matching the current run, article, social draft, and safety decision can promote the bundle, complete the original mission when one exists, and open a review pull request. Studio exposes the manual workflow only as recovery when an automatic dispatch fails.

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
