# Tips for Your Gifts

An evidence-backed gift publication built as a prerendered Angular 21 app and hosted on Firebase Hosting. The repository also contains the operating system for founder-directed Codex research, independent editorial review, affiliate controls, Firebase previews, and production releases.

## Start here

Use the bundled Node 24.14 runtime or another compatible Node 24 release.

```bash
npm run install:web
npm run dev
```

Before handing off a content or product change:

```bash
npm run validate
npm run build
npm run smoke
```

The current site is in `web/`. The original Angular 7 application remains at the repository root as a recoverable legacy source; Firebase Hosting serves only `web/dist`.

## Founder workflow

There are two ways to create the next proposed thesis:

1. The weekly **Scout thoughtful gift opportunities** workflow researches public online and social/community evidence, scores several commission-independent theses, obtains a separate hash-bound editorial receipt, and may open one founder-review proposal pull request. It stops before any model call when five proposals are already open.
2. In `/studio`, open the GitHub issue form and propose the audience, occasion, observed friction, self-purchase gap, proof of fit, compatibility risks, and success metric. An owner-authored `[Strategy]` issue starts the strategy council, which can append one proposed brief and open a pull request.

Both paths stop at `proposed`. Review the resulting thesis, then run **Approve strategy idea for research** with its exact ID and revision. This deterministic, no-AI workflow opens a separate approval pull request. When that approval merges, the system reclassifies the exact before/after strategy transition, reruns all gates, and automatically dispatches **Start gift research agent** for that one approved ID. The manual research workflow remains available only for recovery. The article-research job resolves the exact revision and digest before the AI credential is present.

The workflow creates a trusted, hash-bound research mission envelope before Codex receives a key. The automated team researches, drafts, completes a separate independent review, binds the exact run, article, social pack, and QA receipt by SHA-256, and opens a pull request. The pull request receives a temporary Firebase preview. Every build includes a deterministic `publication-manifest.json` that accounts for the exact publication-ready articles and their review evidence; its release-candidate status is not a deployment claim. After merge, a founder starts the protected production workflow with the exact current `master` SHA. That workflow builds its own exact-SHA candidate, attaches the generated preview URL to the protected production approval, promotes the same static artifact after approval, clones the prior Firebase live version to a 30-day rollback channel, and emits a validated release receipt binding the deployed manifest only after live smoke passes. See `docs/RESEARCH_MISSIONS.md` and `docs/PUBLICATION_AUTOMATION.md`.

A separate Friday collector can propose finalized Search Console page aggregates only after Lucas verifies the exact URL-prefix property, records the reviewed OIDC boundary, and merges separate configuration and protected activation pull requests. Before activation it exits without authentication. The Monday growth workflow reads only committed aggregate snapshots and may propose a bounded experiment in a pull request, but it cannot invent missing metrics, approve its own proposal, publish social content, add affiliate tracking, spend money, or deploy. See `docs/GROWTH_MEASUREMENT.md`.

Affiliate and social decisions use the same separation. Public program research may create a disabled program candidate; only the repository owner can approve external onboarding, and approval still does not enroll, accept terms, add tracking, or enable links. After audited program activation, an exact paid URL moves through a founder-supplied candidate, an isolated evidence-editor receipt, and a separate founder approval. Static generation overlays only that final hash-bound state onto the unchanged editorial winner; pending, failed, stale, or unapproved records render no paid link. Social publication requires an original creative candidate, a stable Firebase asset URL, byte-verified founder media approval, a hash-bound content receipt, an active official channel, protected action-time approval, and an external platform ID. Pinterest now has this official-API path and its first golf-friction visual candidate, but it remains disabled until Lucas completes the external account, release, and environment gates. See `docs/AFFILIATE_OPERATIONS.md` and `docs/SOCIAL_OPERATIONS.md`.

The first ten content releases retain founder review. After GitHub records ten successful production deployments, Lucas may run **Enable proven automatic publication**. It opens a final policy pull request; only after that merge can validated research PRs request check-gated auto-merge and exact-SHA Firebase preview-to-live promotion. A model merely finishing is never the publication signal. See `docs/PUBLICATION_AUTOMATION.md`.

## Operating surfaces

- Public Angular site: `/`, `/blog`, `/gifts`, `/standards`, and `/affiliate-disclosure`
- Executive view: `/studio` (no-index, public, and intentionally free of secrets or private data)
- Deterministic founder agenda: `web/scripts/lib/founder-agenda-contract.mjs`
- Research artifacts: `web/research/runs/`
- Research mission receipts: `web/research/missions/`
- Articles: `web/src/data/blog/`
- Affiliate registry: `web/config/affiliate-programs.json`
- Exact paid-link candidates, independent reviews, and founder approvals: `web/affiliate/candidates/`, `web/affiliate/reviews/`, and `web/affiliate/approvals/`
- Official social-channel registry: `web/config/social-channels.json`
- Versioned original creative candidates: `web/social/candidates/` and `web/public/social-media/`
- Affiliate candidate approval: `.github/workflows/affiliate-program-approval.yml`
- Exact paid-link candidate, evidence review, and approval: `.github/workflows/affiliate-link-candidate.yml`, `.github/workflows/affiliate-link-review.yml`, and `.github/workflows/affiliate-link-approval.yml`
- Hash-bound social content approval: `.github/workflows/social-content-approval.yml`
- Byte-verified social media approval: `.github/workflows/social-media-approval.yml`
- Protected official Pinterest publisher: `.github/workflows/social-pinterest-publish.yml`
- Aggregate growth contract: `web/src/data/growth.json`
- Founder-gated Search Console setup and activation: `.github/workflows/search-console-configure.yml` and `.github/workflows/search-console-activate.yml`
- Read-only finalized Search Console collector: `.github/workflows/search-console-collect.yml`
- Scheduled executive growth review: `.github/workflows/growth-review.yml`
- Evidence policy for autonomous opportunity discovery: `web/config/opportunity-scout-policy.json`
- Autonomous opportunity reports and receipts: `web/research/opportunities/`, `web/research/opportunity-missions/`, and `web/research/opportunity-reviews/`
- Weekly bounded opportunity scout: `.github/workflows/opportunity-scout.yml`
- Automated founder-idea intake: `.github/workflows/strategy-intake.yml`
- Founder-controlled strategy approval: `.github/workflows/strategy-approval.yml`
- Validated approval-to-research handoff: `.github/workflows/strategy-approved-launch.yml`
- Versioned publication mode: `web/config/publication-policy.json`
- Public release-candidate content ledger: `web/public/publication-manifest.json`
- Durable verified live-content index and receipts: `web/config/live-publication.json` and `web/releases/receipts/`
- Founder-reviewed exact-SHA release: `.github/workflows/firebase-production.yml`
- Post-release receipt synchronization: `.github/workflows/publication-live-state.yml`
- Proven auto-publication workflows: `.github/workflows/publication-policy-enable.yml` and `.github/workflows/firebase-auto-production.yml`
- Publication-manifest and release-receipt contracts: `web/scripts/lib/publication-manifest-contract.mjs` and `web/scripts/lib/publication-receipt-contract.mjs`
- Founder-gated affiliate and channel activation: `.github/workflows/affiliate-program-activate.yml`, `.github/workflows/social-channel-configure.yml`, and `.github/workflows/social-channel-activate.yml`
- Repo research skill: `.agents/skills/research-gift-opportunities/`
- Founder briefs: GitHub issue template or workflow dispatch input

Read [the thoughtful gift framework](docs/THOUGHTFUL_GIFT_FRAMEWORK.md), [autonomous opportunity scouting](docs/OPPORTUNITY_SCOUTING.md), [the operating model](docs/OPERATING_MODEL.md), [affiliate operations](docs/AFFILIATE_OPERATIONS.md), [social operations](docs/SOCIAL_OPERATIONS.md), [the founder playbook](docs/FOUNDER_PLAYBOOK.md), and [the launch checklist](docs/LAUNCH_CHECKLIST.md) before enabling credentials or production automation.

## Release truth

A local build is not a preview, and a preview is not production. Report each state separately:

- local and uncommitted
- committed on a branch
- pushed to GitHub
- preview deployed from an exact commit
- merged to `master`
- production deployed and smoke-verified from a manually approved exact SHA

No production deployment was performed while creating this system.
