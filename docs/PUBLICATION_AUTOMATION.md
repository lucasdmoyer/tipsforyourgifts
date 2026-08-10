# Publication automation policy

## Current mode

`web/config/publication-policy.json` is the versioned source of truth. It currently uses `founder_reviewed`: validated research opens a pull request, and a founder starts the protected production workflow for an exact approved `master` SHA. That workflow builds and smokes the exact SHA, deploys a temporary release-candidate channel, and then pauses at the GitHub `production` environment with the preview URL attached. Lucas reviews that exact preview before approving the second job, which downloads and promotes the same static artifact.

The policy treats a finished model response as insufficient. Independent QA, deterministic validation, an exact-SHA Firebase preview, a recorded rollback target, a post-release smoke check, and a validated production receipt remain required in every mode.

Every generated build also carries `publication-manifest.json`, a deterministic public release-candidate ledger. It binds each publication-ready article to the exact article bytes, validated research run, separate QA receipt, reviewed evidence digest, optional completed research mission, and optional reviewed social launch pack. It records the affiliate registry plus every active paid-link overlay's candidate, independent-review, and founder-approval paths and hashes. Pending records contribute zero live links. The manifest's `release_candidate` status means only that the prepared content set passed local gates; it is not a deployment claim.

Immediately before either production workflow mutates `live`, it uses the existing least-privilege Firebase service account to create a 30-day rollback channel and clone the current `tipsforyourgifts:live` release into it. This is the first-release-safe rollback source; it does not depend on a prior GitHub deployment record. After the new live smoke passes, the workflow creates a strict receipt binding the released SHA, reviewed preview URL, deployed publication-manifest byte digest and content-set digest, `tipsforyourgifts` project, live URL, rollback channel, workflow identity, release mode, and every required gate. GitHub retains the receipt and rollback metadata as separate 90-day artifacts. No success receipt is created when a pre-release gate, clone, deployment, hosted smoke, or manifest validation fails.

## Durable live-content synchronization

Workflow artifacts expire, so `.github/workflows/publication-live-state.yml` follows either successful production workflow and looks for exactly one strict publication-receipt artifact. It checks out trusted `master`, never the triggering workflow's code, validates the artifact against the release run ID, head SHA, workflow identity, manifest, rollback record, and receipt contract, then opens a check-gated pull request containing:

- the immutable full receipt under `web/releases/receipts/`;
- `web/config/live-publication.json`, a small pointer to the latest verified managed content set; and
- regenerated executive Studio data.

The recorder treats the same content-set digest as a no-op, preventing a receipt-only synchronization release from creating an infinite deployment loop. A missing receipt is also a no-op because a successful policy-gate workflow can legitimately skip live deployment. The index says `no_verified_managed_release` until this process succeeds; that does not claim Firebase is empty or that historical legacy state is absent.

The founder agenda compares the current publication-manifest content digest with the durable live digest. It removes the release decision only when those exact content sets match. A workflow completion, preview, or local build alone cannot do that.

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

The Firebase Hosting action's declared `details_url` output supplies the exact preview URL used by the smoke gate: https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/action.yml#L60-L68

## External configuration required before enabling

- `master` branch protection requires content quality and Firebase preview checks.
- GitHub auto-merge is enabled for the repository.
- `OPENAI_API_KEY` exists only for the read-only drafting and review jobs.
- `FIREBASE_SERVICE_ACCOUNT_TIPSFORYOURGIFTS` is least-privilege and limited to Firebase Hosting.
- The `production` environment requires Lucas as its per-release reviewer and shows the exact release-candidate preview URL. Remove that reviewer only when the proven automatic policy is intentionally being enabled.
- The Firebase service account can create a preview channel and clone the current live Hosting version; rollback channels expire after 30 days, while the live release history remains the longer-lived console fallback.
- Firebase Hosting notifications and GitHub Actions failure notifications reach Lucas.

Automatic publication never authorizes affiliate enrollment, price feeds, analytics identifiers, social posting, paid spend, Firestore or Realtime Database rules changes, or changes to the strategy and policy gates.

## Disable or incident response

Set the policy back to `founder_reviewed` in a reviewed pull request, re-enable the GitHub production-environment reviewer, and disable repository auto-merge before further content releases. Use the retained `firebase-rollback-target-*` artifact to identify the exact cloned channel, then run its recorded clone-to-live command only through a separately approved rollback procedure. After 30 days, use the corresponding prior version in Firebase Hosting release history.
