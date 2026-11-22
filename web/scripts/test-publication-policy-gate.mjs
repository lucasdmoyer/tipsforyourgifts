import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parsePublicationPolicy } from './lib/publication-policy-contract.mjs';

const base = JSON.parse(await fs.readFile(path.join(process.cwd(), 'config', 'publication-policy.json'), 'utf8'));
const repositoryRoot = path.resolve(process.cwd(), '..');
const manualWorkflow = await fs.readFile(path.join(repositoryRoot, '.github', 'workflows', 'firebase-production.yml'), 'utf8');
const automaticWorkflow = await fs.readFile(path.join(repositoryRoot, '.github', 'workflows', 'firebase-auto-production.yml'), 'utf8');
const previewWorkflow = await fs.readFile(path.join(repositoryRoot, '.github', 'workflows', 'firebase-preview-deploy.yml'), 'utf8');
const previewCallerWorkflow = await fs.readFile(path.join(repositoryRoot, '.github', 'workflows', 'firebase-preview.yml'), 'utf8');
const [previewBuildJob, previewDeployJob = ''] = previewWorkflow.split('\n  deploy:\n');
const previewAuthIndex = previewDeployJob.indexOf('id: google_auth');
const previewAfterAuth = previewAuthIndex >= 0 ? previewDeployJob.slice(previewAuthIndex) : '';
const clone = (value) => structuredClone(value);

function expectFailure(label, mutate) {
  const candidate = clone(base);
  mutate(candidate);
  assert.throws(() => parsePublicationPolicy(candidate), undefined, label);
}

parsePublicationPolicy(base);
expectFailure('minimum cannot be weakened', (policy) => { policy.automaticPromotion.minimumSuccessfulFounderReviewedReleases = 5; });
expectFailure('required QA cannot be disabled', (policy) => { policy.requiredGates.independentQaReceipt = false; });
expectFailure('required preview cannot be disabled', (policy) => { policy.requiredGates.firebaseExactShaPreview = false; });
expectFailure('release receipt cannot be disabled', (policy) => { policy.requiredGates.verifiedReleaseReceipt = false; });
expectFailure('disabled policy cannot claim automatic mode', (policy) => { policy.mode = 'automatic_after_proven'; });
expectFailure('enabled policy requires enough releases', (policy) => {
  policy.mode = 'automatic_after_proven'; policy.automaticPromotion.enabled = true; policy.automaticPromotion.founderApproved = true;
  policy.automaticPromotion.approvedBy = 'lucasdmoyer'; policy.automaticPromotion.approvedAt = policy.updatedAt;
});
expectFailure('enabled policy requires founder identity', (policy) => {
  policy.mode = 'automatic_after_proven'; policy.automaticPromotion.enabled = true; policy.automaticPromotion.founderApproved = true;
  policy.automaticPromotion.verifiedSuccessfulReleaseCount = 10; policy.automaticPromotion.approvedBy = 'someone-else'; policy.automaticPromotion.approvedAt = policy.updatedAt;
});
expectFailure('disabled policy cannot retain approval', (policy) => { policy.automaticPromotion.founderApproved = true; });
assert.match(manualWorkflow, /hosting:clone tipsforyourgifts:live/, 'founder-reviewed release must clone the current Firebase live release');
assert.match(manualWorkflow, /hosting:channel:create.*--expires 30d/, 'founder-reviewed rollback clone must receive the maximum bounded expiry');
assert.match(manualWorkflow, /publication:receipt/, 'founder-reviewed release must create a verified receipt');
assert.match(manualWorkflow, /--manifest=dist\/publication-manifest\.json/, 'founder-reviewed release receipt must bind the deployed publication manifest');
assert.match(automaticWorkflow, /hosting:clone tipsforyourgifts:live/, 'automatic release must clone the current Firebase live release');
assert.match(automaticWorkflow, /hosting:channel:create.*--expires 30d/, 'automatic rollback clone must receive the maximum bounded expiry');
assert.match(automaticWorkflow, /publication:receipt/, 'automatic release must create a verified receipt');
assert.match(automaticWorkflow, /--manifest=dist\/publication-manifest\.json/, 'automatic release receipt must bind the deployed publication manifest');
assert.match(manualWorkflow, /needs: preview/, 'founder-reviewed live release must wait for the exact-SHA preview job');
assert.match(manualWorkflow, /url: \$\{\{ needs\.preview\.outputs\.preview_url \}\}/, 'production approval must expose the exact preview URL');
assert.match(manualWorkflow, /actions\/download-artifact@v4/, 'founder-reviewed release must download the reviewed static artifact');
assert.doesNotMatch(manualWorkflow, /inputs\.preview_url/, 'founder-reviewed release must not trust a caller-supplied preview URL');
assert.match(manualWorkflow, /id-token: write/, 'founder-reviewed release must explicitly request a short-lived GitHub OIDC token');
assert.match(manualWorkflow, /tips-github-production\/providers\/github-production/, 'founder-reviewed release must use the isolated production identity pool');
assert.match(manualWorkflow, /service_account: github-production@tipsforyourgifts\.iam\.gserviceaccount\.com/, 'founder-reviewed release must use the dedicated production service account');
assert.doesNotMatch(manualWorkflow, /FIREBASE_SERVICE_ACCOUNT_TIPSFORYOURGIFTS/, 'founder-reviewed release must not depend on a long-lived service-account key');
assert.match(manualWorkflow, /firebase-tools@15\.26\.0 deploy --only hosting --project tipsforyourgifts --non-interactive/, 'founder-reviewed live deployment must target only Hosting in the explicit project');
assert.match(manualWorkflow, /hosting:channel:list[\s\S]*--site tipsforyourgifts[\s\S]*--project tipsforyourgifts/, 'founder-reviewed preview must resolve its exact Firebase site and project');
assert.match(manualWorkflow, /npm --prefix web run smoke:hosted -- "\$PREVIEW_URL"/, 'founder-reviewed preview must smoke every public route');
assert.match(manualWorkflow, /npm --prefix web run smoke:hosted -- https:\/\/tipsforyourgifts\.web\.app/, 'founder-reviewed production must smoke every public route');
assert.match(previewWorkflow, /workflow_call:/, 'preview deployment must be defined as a reusable workflow');
assert.doesNotMatch(previewBuildJob, /id-token:\s*write/, 'pull-request build job must not receive OIDC token authority');
assert.match(previewDeployJob, /id-token:\s*write/, 'preview deploy job must request only short-lived OIDC authority');
assert.match(previewDeployJob, /REPOSITORY_ID: \$\{\{ github\.repository_id \}\}[\s\S]*test "\$REPOSITORY_ID" = "171694140"/, 'preview deploy must bind the immutable repository ID');
assert.match(previewDeployJob, /REPOSITORY_OWNER_ID: \$\{\{ github\.repository_owner_id \}\}[\s\S]*test "\$REPOSITORY_OWNER_ID" = "23782501"/, 'preview deploy must bind the immutable repository-owner ID');
assert.match(previewDeployJob, /ACTOR_ID: \$\{\{ github\.actor_id \}\}[\s\S]*test "\$ACTOR_ID" = "23782501"/, 'preview deploy must bind the immutable founder actor ID');
assert.match(previewDeployJob, /test "\$EVENT_NAME" = "pull_request"/, 'preview deploy must accept only pull-request events');
assert.match(previewDeployJob, /test "\$BASE_REF" = "master"/, 'preview deploy must target only master');
assert.match(previewDeployJob, /test "\$HEAD_REPOSITORY_ID" = "\$REPOSITORY_ID"/, 'preview deploy must reject fork-controlled heads');
assert.match(previewDeployJob, /test "\$REF_VALUE" = "refs\/pull\/\$PR_NUMBER\/merge"/, 'preview deploy must bind the current merge ref and PR number');
assert.match(previewDeployJob, /ref: master[\s\S]*path: trusted-config[\s\S]*sparse-checkout: firebase\.json/, 'preview deploy must read Firebase configuration from trusted master');
assert.ok(previewDeployJob.indexOf('actions/download-artifact@v4') < previewAuthIndex, 'preview artifact must be downloaded before cloud authentication');
assert.match(previewDeployJob, /tips-github-preview\/providers\/github-preview/, 'preview deploy must use the isolated reusable-workflow provider');
assert.match(previewDeployJob, /service_account: github-action-171694140@tipsforyourgifts\.iam\.gserviceaccount\.com/, 'preview deploy must use the dedicated Hosting preview service account');
assert.doesNotMatch(previewAfterAuth, /actions\/checkout|npm (?:ci|run)|npm --prefix web/, 'preview deploy must not check out or execute pull-request application code after authentication');
assert.doesNotMatch(previewAfterAuth, /hosting:clone|deploy --only hosting/, 'preview deploy must not mutate the live Hosting channel');
assert.match(previewAfterAuth, /hosting:channel:deploy "\$CHANNEL_ID"[\s\S]*--project tipsforyourgifts/, 'preview deploy must target only the exact temporary channel and Firebase project');
assert.match(previewAfterAuth, /grep -F "Good gifts, minus the guesswork\."/, 'preview deploy must smoke the hosted channel after release');
assert.match(previewCallerWorkflow, /uses: lucasdmoyer\/tipsforyourgifts\/\.github\/workflows\/firebase-preview-deploy\.yml@master/, 'preview caller must pin the reusable trust boundary to master');
assert.match(previewCallerWorkflow, /classify:[\s\S]*permissions:[\s\S]*contents: read[\s\S]*deploy_preview:[\s\S]*permissions:[\s\S]*id-token: write/, 'preview caller must keep OIDC authority out of the classifier and grant it only to the reusable job');
assert.match(previewCallerWorkflow, /needs: classify[\s\S]*hosting_changed: \$\{\{ needs\.classify\.outputs\.hosting_changed == 'true' \}\}/, 'preview caller must bind deployment to the classifier output');
assert.match(previewCallerWorkflow, /pr_number: \$\{\{ github\.event\.number \}\}/, 'preview caller must pass the current event PR number');
assert.doesNotMatch(previewCallerWorkflow, /github-pr-20|refs\/pull\/20\/merge|test "\$CHANNEL_ID" = "pr-20"/, 'preview caller must not retain a one-pull-request credential boundary');
assert.doesNotMatch(previewCallerWorkflow, /google-github-actions\/auth|hosting:channel:deploy/, 'preview caller must delegate all authenticated behavior to the master-pinned reusable workflow');
assert.match(previewCallerWorkflow, /\n  preview:\n[\s\S]*name: preview[\s\S]*needs:[\s\S]*- deploy_preview[\s\S]*permissions: \{\}[\s\S]*test "\$DEPLOY_PREVIEW_RESULT" = "success"/, 'preview caller must preserve the required check name and fail it when delegated execution fails');

console.log(JSON.stringify({ publicationPolicyNegativeGateTests: 'passed', negativeChecks: 8, workflowReleaseChecks: 45 }, null, 2));
