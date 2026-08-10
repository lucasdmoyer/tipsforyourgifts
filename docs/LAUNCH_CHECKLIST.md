# Launch checklist

## Repository controls

- Protect `master`; require content quality and Firebase preview checks.
- Create the GitHub `production` environment and require Lucas as a reviewer for the first ten releases.
- Add `OPENAI_API_KEY` as a repository secret for the read-only research job.
- Confirm owner-authored `[Strategy]` issues can run the strategy-intake workflow and that non-owner issues cannot access the AI job.
- Require review on strategy proposal and strategy approval pull requests; the AI proposal job must never set `approved_for_research`.
- Confirm the weekly opportunity scout exits before model execution at the founder proposal cap, creates no mission file in that posture, and can append at most one `proposed` idea when capacity exists.
- Require a separate hash-bound opportunity editor receipt; the scout author must never validate their own report or advance a proposal to `approved_for_research`.
- Add `FIREBASE_SERVICE_ACCOUNT_TIPSFORYOURGIFTS` only after creating a least-privilege Firebase Hosting service account.
- Keep Dependabot enabled for `/web`.

## Firebase controls

- Verify the explicit project and site are both `tipsforyourgifts`.
- Confirm `web/dist` is the only Hosting public directory.
- Verify Firestore and Realtime Database production rules before any rules deployment.
- Confirm the founder release workflow builds and smokes the exact current `master` SHA, attaches its generated preview URL to the protected production approval, and downloads the same static artifact after approval.
- Confirm the protected job clones the current `tipsforyourgifts:live` release to a unique 30-day rollback channel before live mutation.
- Require the validated exact-SHA publication receipt and separate rollback artifact after the hosted smoke passes.
- Confirm the live-content synchronization workflow downloads only the strict receipt from the completed production run, checks out trusted `master`, and opens a receipt-only check-gated pull request.

## Proven automatic publication

- Complete at least ten successful founder-reviewed production deployments recorded in the GitHub `production` environment.
- Review correction rate, preview failures, incident history, and rollback drills before changing the policy.
- Enable GitHub auto-merge and retain required content-quality and Firebase-preview checks.
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

## Affiliate controls

- Approve one program at a time.
- Treat `proposed` and `founder_approved` as disabled states; neither authorizes signup, terms acceptance, tracking, or links.
- Recheck the official program and terms sources before their recorded review-expiry date.
- Record allowed domains, registered sites, disclosure requirements, price-display constraints, and tracking identity.
- Create the protected `affiliate-activation` environment before using the audited activation workflow; store no tracking values in its inputs or repository output.
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
