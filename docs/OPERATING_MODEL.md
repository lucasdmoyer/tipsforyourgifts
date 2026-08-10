# Operating model

## Team design

The system models a small editorial and growth company without pretending that one model response is independent review.

| Role | Responsibility | Hard boundary |
|---|---|---|
| Founder | Sets audience, occasion, budget, exclusions, and success metric | Does not need to direct individual searches |
| Research lead | Discovers candidates and records dated sources | Social chatter is demand evidence, not product proof |
| Product analyst | Scores fit, value, reliability, safety, and tradeoffs | Commission is excluded from ranking |
| Editorial writer | Produces the decision framework and article | No fabricated use, testing, quotes, or prices |
| Independent editor | Challenges claims, drawbacks, links, disclosures, and rights | Cannot be the drafting identity |
| Release engineer | Runs schemas, tests, build, smoke, and preview | Cannot skip a failed gate |
| Growth lead | Creates channel-specific drafts and measures qualified traffic | No external post without an approved account and API |
| Executive analyst | Converts complete aggregate snapshots into falsifiable experiment proposals | Cannot infer missing metrics or approve its own experiment |
| Strategy council | Structures one owner-authored executive issue into a versioned thoughtful-gift proposal | Cannot alter existing ideas or mark its proposal approved |

The team uses the [thoughtful gift framework](THOUGHTFUL_GIFT_FRAMEWORK.md) before product research. Recipient-friction ideas must explain the workaround, self-purchase gap, proof of fit, ownership burden, and rejection condition. Gift pairs must score at least 80 for coherence and make each item change how the other is experienced.

## Executive decision layer

The Angular Studio generates a ranked founder agenda from committed operating evidence. It places the accountable release before new volume, selects the next proposed thesis by strategic priority and pair coherence rather than commission, places aggregate measurement before distribution experiments, and keeps social and affiliate activation behind their separate external-account gates. The agenda may recommend and explain; it cannot approve, enroll, publish, spend, or deploy.

The release decision is state-derived rather than permanent. A strict post-deploy receipt is synchronized into Git after a managed Firebase release, and the agenda removes that decision only when the receipt's exact content-set digest matches the current publication manifest. Preview or workflow status alone is insufficient.

## State machine

```text
idea -> researching -> drafted -> independent QA -> validated -> preview -> founder approval -> production
          |               |             |             |
          +---- blocked / qa_failed / rejected <-------+
```

A validated roundup requires at least 12 candidates, five finalists, five source classes, three research passes, two final passes below 10 percent material novelty, supported claims, an editorial score of at least 75, evidence confidence of at least 70, and a clean independent review.

## Publication architecture

Git is the content database. A research run and its matching Markdown article are versioned together. Deterministic scripts generate typed Angular data, the operating dashboard, and the sitemap. Angular prerenders the public site into `web/dist`; Firebase Hosting serves that exact artifact.

Each founder-started Codex workflow is represented by a versioned research mission receipt. The trusted envelope fixes the approved idea, base commit, team roles, required deliverables, quality thresholds, and publication policy before the drafting role begins. The independent review and completion scripts bind exact artifact hashes; a model response alone cannot complete a mission.

Mission completion advances the bundle to release preparation. While publication mode is founder reviewed, it still requires the exact-SHA pull request, Firebase preview, and founder merge decision. Once the separately approved automatic-after-proven policy is active, the same completion receipt can make the pull request eligible for required-check automatic merge.

The GitHub research job has read-only repository permission while the OpenAI key is present. It serializes a patch, rejects edits outside content-only paths, and discards the credential. A second job with write permission applies the patch, reruns every gate without the AI credential, pushes a branch, and opens a pull request.

The strategy-intake job follows the same separation. It accepts only an owner-authored `[Strategy]` issue, exposes the issue to the AI as untrusted data, permits at most one appended `proposed` idea, and regenerates only deterministic operating files. Approval is a different workflow with no AI credential; it advances the exact proposed revision and opens a founder-controlled pull request.

Publication begins in `founder_reviewed` mode. After ten successful founder-reviewed production deployments, the repository owner may open a deterministic policy PR that enables proven automatic promotion. Even then, research QA, branch checks, an exact-SHA Firebase preview, rollback-target evidence, and hosted smoke remain mandatory. See [publication automation](PUBLICATION_AUTOMATION.md).

## Affiliate posture

No affiliate program is enabled by default. Public program research may add a `proposed` candidate with official source URLs, editorial fit, limitations, and a review-expiry date, but a proposal must contain no account evidence, tracking configuration, registered sites, or disclosure approval. The repository-owner workflow may record `founder_approved`; that state still cannot create an account, accept terms, or enable links.

Enabling a program later requires the founder to establish the account externally, accept current terms personally, and approve permitted domains, registered sites, a program-provided tracking identity, disclosure language, and reporting posture in a separate audited configuration pull request. Agents may never infer or invent a tag. The current candidates are decision research, not enrollment recommendations or income forecasts.

The activation command stores only evidence references, approved parameter names, and booleans about external setup. It never stores the tracking value, creates a paid link, enables a price feed, or changes editorial rank.

Paid links must be clearly disclosed, land on the intended product, preserve approved tracking, and use `rel="sponsored noopener"`. Recommendations and ranking must remain the same when the paid tracking is removed.

## Growth posture

Start with high-intent owned content and Pinterest-ready creative because evergreen gift discovery maps well to visual search. AI may generate an original creative candidate and bind it to exact source and byte hashes, but that candidate remains unapproved until its stable Firebase URL is released and the founder records current media rights evidence. Social output remains gated until official accounts, platform policies, API credentials, and founder-approved cadence exist. Never automate browser posting or scrape private groups.

Track content-level impressions, clicks, engaged sessions, outbound merchant clicks, approved affiliate conversions, revenue, and article age. The first decision is whether a page helps a reader; the second is whether qualified traffic grows; revenue comes after both.

Aggregate measurement lives in `web/src/data/growth.json` under the contract in `docs/GROWTH_MEASUREMENT.md`. Search Console setup uses separate hash-bound configuration and protected activation pull requests. Only an active connector allows the Friday OIDC collector to request finalized, page-filtered data with the read-only scope and propose an aggregate snapshot; the job exits before authentication otherwise. The Monday growth-review job is intentionally a proposal engine: it produces no patch when evidence is missing, and any material experiment still enters through a founder-reviewed pull request.

Social content approval is separate from publication. `web/config/social-channels.json` must identify a founder-approved official account, secret name, cadence, and platform formats before a one-post hash-bound receipt can be created under `web/social/approvals/`. The source pack and post hashes make later copy drift fail closed. A receipt approves content and rights evidence only; an official-API publisher and a verified external post ID are still required to claim publication.

Channel configuration and activation are also separate. Configuration records a non-secret account/target/evidence boundary with publishing disabled. Protected activation changes only the registry posture; it does not schedule or publish a post.
