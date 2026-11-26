# Publication automation policy

## Current mode

`web/config/publication-policy.json` is the versioned source of truth. It currently uses `founder_reviewed`: validated research opens a pull request, and a founder starts the protected production workflow for an exact approved `master` SHA. That workflow builds and smokes the exact SHA, deploys a temporary release-candidate channel, and then pauses at the GitHub `production` environment with the preview URL attached. Lucas reviews that exact preview before approving the second job, which downloads and promotes the same static artifact.

The policy treats a finished model response as insufficient. Independent QA, deterministic validation, an exact-SHA Firebase preview, a recorded rollback target, a post-release smoke check, and a validated production receipt remain required in every mode.

Every generated build also carries `publication-manifest.json`, a deterministic public release-candidate ledger. It binds each publication-ready article to the exact article bytes, validated research run, separate QA receipt, reviewed evidence digest, optional completed research mission, and optional reviewed social launch pack. It records the affiliate registry plus every active paid-link overlay's candidate, independent-review, and founder-approval paths and hashes. Pending records contribute zero live links. The manifest's `release_candidate` status means only that the prepared content set passed local gates; it is not a deployment claim.

Immediately before the founder-reviewed production workflow mutates `live`, it uses a least-privilege Firebase Hosting identity reached through short-lived GitHub OIDC credentials to create a 30-day rollback channel and clone the current `tipsforyourgifts:live` release into it. The provider is restricted to this repository, Lucas, `workflow_dispatch`, `master`, and the exact production workflow path; it has no service-account key. This is the first-release-safe rollback source and does not depend on a prior GitHub deployment record. After the new live smoke passes, the workflow creates a strict receipt binding the released SHA, reviewed preview URL, deployed publication-manifest byte digest and content-set digest, `tipsforyourgifts` project, live URL, rollback channel, workflow identity, release mode, and every required gate. GitHub retains the receipt and rollback metadata as separate 90-day artifacts. No success receipt is created when a pre-release gate, clone, deployment, hosted smoke, or manifest validation fails. The automatic path remains disabled. Its repository workflow now requires a separate keyless identity, but that external identity is only a reviewed specification until Lucas separately authorizes and verifies the Google Cloud configuration tracked in [issue 43](https://github.com/lucasdmoyer/tipsforyourgifts/issues/43).

## Durable live-content synchronization

Workflow artifacts expire, so `.github/workflows/publication-live-state.yml` follows either successful production workflow and looks for exactly one strict publication-receipt artifact. It checks out trusted `master`, never the triggering workflow's code, validates the artifact against the release run ID, head SHA, workflow identity, manifest, rollback record, and receipt contract, then opens a check-gated pull request containing:

- the immutable full receipt under `web/releases/receipts/`;
- `web/config/live-publication.json`, a small pointer to the latest verified managed content set; and
- regenerated executive Studio data.

The recorder treats the same content-set digest as a no-op, preventing a receipt-only synchronization release from creating an infinite deployment loop. A missing receipt is also a no-op because a successful policy-gate workflow can legitimately skip live deployment. The index says `no_verified_managed_release` until this process succeeds; that does not claim Firebase is empty or that historical legacy state is absent.

The founder agenda compares the current publication-manifest content digest with the durable live digest. It removes the release decision only when those exact content sets match. A workflow completion, preview, or local build alone cannot do that.

## Reusable pull-request preview trust

The repository contains a dormant reusable workflow at `.github/workflows/firebase-preview-deploy.yml`. It is the planned replacement for one-provider-per-pull-request preview credentials, but adding the file does not activate it or change Google Cloud IAM. Activation requires a separate reviewed caller change and an action-time founder approval for the exact Workload Identity Federation configuration.

The intended caller references the reusable workflow from `master`, never from pull-request-controlled bytes. The reusable workflow separates the untrusted build from the OIDC-enabled deploy job: the build job executes the pull request without `id-token: write`, uploads only the static `web/dist` artifact, and the deploy job downloads that artifact alongside `firebase.json` checked out from trusted `master`. The deploy job does not execute pull-request scripts after cloud authentication.

The future `tips-github-preview/github-preview` provider must accept only tokens satisfying all of these claims:

- repository ID `171694140`;
- repository-owner ID `23782501`;
- actor ID `23782501`;
- event name `pull_request`;
- a merge ref matching the current pull request;
- and `job_workflow_ref` equal to `lucasdmoyer/tipsforyourgifts/.github/workflows/firebase-preview-deploy.yml@refs/heads/master`.

The provider belongs in its own `tips-github-preview` pool. The existing preview service account remains limited to Firebase Hosting, receives only short-lived impersonation, has no Firebase Auth Admin role, and has no user-managed key. The workflow also repeats the repository, owner, actor, event, base-branch, head-repository, PR-number, and ref checks before authentication. Neither the provider nor the reusable workflow authorizes a production Hosting deployment.

## Proven automatic mode

After at least ten successful founder-reviewed production deployments exist in the GitHub `production` environment, Lucas may run **Enable proven automatic publication**. That workflow:

1. requires the repository owner as the actor;
2. counts unique successful production SHAs from GitHub deployment history, so rerunning one release cannot inflate the evidence, while each individual release also carries its own validated artifact receipt;
3. refuses to continue below the versioned minimum;
4. creates a deterministic policy patch with no AI credential; and
5. opens a final founder-review pull request.

Merging that pull request enables two bounded behaviors:

- a newly validated research pull request may request GitHub check-gated auto-merge; and
- a resulting `master` commit may run an exact-SHA temporary Firebase preview, smoke that preview, clone the current Firebase live release to a bounded rollback channel, promote the verified checkout to `live`, smoke production, and issue the immutable release receipt.

The automatic workflow keeps build authority and cloud authority distinct. It validates and builds the exact current `master` SHA, uploads the static artifact, installs the pinned Firebase CLI, and only then requests a short-lived token. A separate protected release job downloads and re-smokes that same artifact and preview before minting its own short-lived token. Both jobs remove their local credential file before executing repository receipt or hosted-smoke code. The Firebase CLI deploys a unique temporary channel, then the workflow resolves that exact channel from `hosting:channel:list --json`; the resulting URL supplies the preview smoke and protected environment link.

## External configuration required before enabling

- `master` branch protection requires content quality and Firebase preview checks.
- GitHub auto-merge is enabled for the repository.
- A dedicated OpenAI Platform project has a founder-approved monthly budget recorded with HTTPS platform evidence in the active `web/config/ai-automation-policy.json`; only then may `OPENAI_API_KEY` exist for the read-only drafting and review jobs. Model jobs use explicit `drop-sudo`, `workspace-write`, and ephemeral sessions. Credential-free writer jobs alone may open proposal pull requests.
- The production GitHub OIDC provider is restricted to repository `lucasdmoyer/tipsforyourgifts`, actor `lucasdmoyer`, `workflow_dispatch`, `refs/heads/master`, and `.github/workflows/firebase-production.yml@refs/heads/master`.
- `github-production@tipsforyourgifts.iam.gserviceaccount.com` is limited to Firebase Hosting and has no user-managed key.
- The automatic-production GitHub OIDC provider is isolated in `tips-github-auto-production`, accepts only repository ID `171694140`, repository-owner ID `23782501`, event `push`, ref `refs/heads/master`, and `job_workflow_ref` `lucasdmoyer/tipsforyourgifts/.github/workflows/firebase-auto-production.yml@refs/heads/master`.
- `github-auto-production@tipsforyourgifts.iam.gserviceaccount.com` receives only short-lived impersonation and the minimum Firebase Hosting permissions needed for a temporary preview, rollback clone, and live Hosting deployment. It has no Firebase Auth Admin role and no user-managed key.
- The `production` environment requires Lucas as its per-release reviewer and shows the exact release-candidate preview URL. Remove that reviewer only when the proven automatic policy is intentionally being enabled.
- The Firebase service account can create a preview channel and clone the current live Hosting version; rollback channels expire after 30 days, while the live release history remains the longer-lived console fallback.
- Firebase Hosting notifications and GitHub Actions failure notifications reach Lucas.

Automatic publication never authorizes affiliate enrollment, price feeds, analytics identifiers, social posting, paid spend, Firestore or Realtime Database rules changes, or changes to the strategy and policy gates.

## Disable or incident response

Set the policy back to `founder_reviewed` in a reviewed pull request, re-enable the GitHub production-environment reviewer, and disable repository auto-merge before further content releases. Use the retained `firebase-rollback-target-*` artifact to identify the exact cloned channel, then run its recorded clone-to-live command only through a separately approved rollback procedure. After 30 days, use the corresponding prior version in Firebase Hosting release history.
