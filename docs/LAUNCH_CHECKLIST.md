# Launch checklist

## Repository controls

- Protect `master`; require content quality and Firebase preview checks.
- Create the GitHub `production` environment and require Lucas as a reviewer for the first ten releases.
- Before adding `OPENAI_API_KEY`, create one dedicated OpenAI Platform project and set a founder-approved monthly project budget. From Studio, open **Record Lucas-approved budget** and dispatch `ai-automation-budget-configure.yml` with the exact displayed policy SHA-256, approved amount, credential-free `https://platform.openai.com/...` settings URL, and `CONFIGURE-ai-automation-budget` confirmation. The workflow records only a founder attestation in a review pull request; it does not create or verify the external budget, add a key, call a model, activate the policy, merge, or deploy. Its read-only preparation job passes a binary patch to a separate credential-free writer job, following the [trusted CI separation recommended by OpenAI](https://learn.chatgpt.com/docs/non-interactive-mode). Review and merge that pull request, verify the dedicated credential through a separate gate, and activate the versioned policy in another reviewed pull request before adding the key only as the repository secret. Every Codex step runs the reviewed credential-and-policy preflight immediately before model execution; a missing key or inactive budget policy fails before the model action starts and never prints a secret value.
- Confirm the budget record produces the intermediate `budget_approved_awaiting_credential` state. It must retain `credential.status: not_configured`, `activationReady: false`, and the remaining credential and policy-activation blockers. A budget receipt is never runtime authorization.
- Confirm `npm --prefix web run validate:ai-automation-policy` reports six protected workflows, eight model steps, zero model jobs with GitHub write permission, and zero writer jobs receiving the OpenAI key. Every model step must explicitly use `drop-sudo`, `workspace-write`, and an ephemeral session. The separate writer jobs may open proposal pull requests but have no model credential and no Firebase, affiliate-activation, social-publishing, email, or credential-creation authority.
- Confirm owner-authored `[Strategy]` issues can run the strategy-intake workflow and that non-owner issues cannot access the AI job.
- Confirm `/studio/brief` blocks incomplete or credential-like drafts, opens the exact owner-authored GitHub issue for review, and grants no research or publication authority by itself.
- Require review on strategy proposal and strategy approval pull requests; the AI proposal job must never set `approved_for_research`.
- Confirm the weekly opportunity scout exits before model execution at the founder proposal cap, creates no mission file in that posture, and can append at most one `proposed` idea when capacity exists.
- Require a separate hash-bound opportunity editor receipt; the scout author must never validate their own report or advance a proposal to `approved_for_research`.
- Create the protected `editorial-safety-approval` environment with Lucas as required reviewer. Confirm only repository owner `lucasdmoyer` can record a decision, the workflow has no model or Firebase credential, and it can open but cannot merge or deploy its pull request.
- Confirm an approved safety-decision merge triggers the read-only independent recheck, while a rejection exits without a model call. Verify the model can create only structured findings and the credential-free job creates the next immutable `qa.vN` receipt.
- Test both review outcomes: a failed receipt remains auditable without changing the article, while a clean current receipt alone may promote and open a pull request. Neither path may merge or deploy.
- Test the research router with both claim postures: low-risk drafts reach the independent editor; high-risk drafts skip that model call, create no premature receipt, remain non-public, and open a founder-safety handoff with auto-merge disabled.
- Confirm a post-safety passing receipt binds the original research mission even though it came from the separate recheck workflow, and that mission completion rejects a receipt bound to another mission.
- Configure the founder-reviewed production workflow with its dedicated, workflow-path-bound GitHub OIDC provider and keyless Firebase Hosting service account; never add a long-lived service-account JSON key.
- Keep Dependabot enabled for `/web`.

## Firebase controls

- Verify the explicit project and site are both `tipsforyourgifts`.
- Confirm `web/dist` is the only Hosting public directory.
- Treat the pre-modern live homepage as historical, unverified state. The read-only 2026-08-10 baseline still exposed a legacy Sapiens merchant pitch, the short link `https://amzn.to/2UiRnkY`, and a personal-email footer; none of those observations authorizes an affiliate relationship or reuse in the modern release. Confirm the exact preview contains no forbidden legacy marker and reports zero active paid links unless a separately reviewed overlay exists.
- Verify Firestore and Realtime Database production rules before any rules deployment.
- Confirm the founder release workflow builds and smokes the exact current `master` SHA, attaches its generated preview URL to the protected production approval, and downloads the same static artifact after approval.
- Confirm the protected job clones the current `tipsforyourgifts:live` release to a unique 30-day rollback channel before live mutation.
- Require the validated exact-SHA publication receipt and separate rollback artifact after the hosted smoke passes.
- Confirm the live-content synchronization workflow downloads only the strict receipt from the completed production run, checks out trusted `master`, and opens a receipt-only check-gated pull request.

## Proven automatic publication

- Complete at least ten successful founder-reviewed production deployments recorded in the GitHub `production` environment.
- Review correction rate, preview failures, incident history, and rollback drills before changing the policy.
- Enable GitHub auto-merge and retain required content-quality and Firebase-preview checks.
- Provision the dedicated `tips-github-auto-production/github-auto-production` provider and `github-auto-production@tipsforyourgifts.iam.gserviceaccount.com` only after action-time approval. Bind it to the immutable repository and owner IDs, `push`, `refs/heads/master`, and the exact master-pinned automatic workflow path; create no user-managed key and grant no Firebase Auth Admin role.
- Confirm the automatic release workflow clones the current Firebase live release to a unique rollback channel before live mutation and issues no success receipt before hosted smoke.
- Merge the publication-policy pull request only after intentionally deciding whether to remove the production environment's per-release reviewer.
- Test the emergency return to `founder_reviewed` mode and notification path.

## Measurement controls

- Connect Google Search Console and submit `/sitemap.xml`.
- Add consent-aware analytics only after defining the privacy posture.
- Track article views, engaged sessions, outbound merchant clicks, and affiliate conversions separately.
- Never put customer identifiers, credentials, or raw private social data in analytics or the executive workbook.

## Thoughtfulness controls

- Bind each new research run to an approved strategy idea revision and SHA-256 digest.
- Confirm the workflow creates one trusted `research-mission-<run>-<attempt>` envelope before the research model receives a key.
- Confirm mission completion binds the exact research run, article, social pack, and independent QA receipt hashes.
- Require an observation prompt; never present a private recipient behavior as a researched fact.
- Distinguish a deferred useful purchase from something the recipient does not want.
- Require compatibility, duplicate, clutter, ownership-burden, and rejection checks for every finalist.
- Require pair coherence of at least 80 and prove that both items qualify independently and perform different roles.
- For every explicitly high-risk claim, review the exact reader-facing language and source bindings through the owner workflow. Treat approval as language acceptance only; require a fresh independent QA receipt afterward.
- Confirm that changing the run, article, social draft, or high-risk claim content makes the latest founder safety decision stale and blocks promotion.

## Affiliate controls

- Approve one program at a time.
- Treat `proposed`, `founder_approved`, and `externally_verified` as disabled states. External verification may record a public partner-issued identity and storefront, but it does not authorize terms acceptance, activation, or paid links.
- Recheck the official program and terms sources before their recorded review-expiry date.
- Record allowed domains, registered sites, disclosure requirements, price-display constraints, and tracking identity.
- Create the protected `affiliate-activation` environment before using the audited activation workflow; store no tracking values in its inputs or repository output.
- Create protected `affiliate-links` and `affiliate-link-approval` environments before recording or approving exact paid destinations. Require the repository owner, preserve the independent-review job, and never approve a failed or stale hash.
- On every paid-link pull request, inspect the Firebase preview for the exact product destination, disclosure before recommendations, the `(paid link)` label, `rel="sponsored noopener"`, unchanged product order and copy, and ordinary-link fallback when the approval record is absent.
- Test redirect destination and disclosure placement on a Firebase preview.
- Do not enable exact prices unless an authorized, fresh program feed supports them.

## Social controls

- Approve an official account, API, rights-cleared media source, cadence, and rollback process.
- Use the hash-bound configure workflow first, then the protected `social-production` activation workflow; neither is a per-post publication approval.
- Review each original creative candidate in the exact-SHA Firebase preview; candidate status is not media approval.
- Keep each account reference and credential secret name in the channel registry, but keep the credential value outside Git and logs.
- Create one hash-bound receipt per reviewed post; any source-pack or copy change requires a new review.
- Do not call a receipt a publication event; require an official API result and external post ID.
- Begin in draft-only mode and review the first twenty posts.
- Prefer several genuinely distinct creative angles over near-duplicate automated posts.
- Label material relationships and do not invent product use or consumer testimonials.
