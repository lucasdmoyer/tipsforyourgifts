import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parsePublicationPolicy } from './lib/publication-policy-contract.mjs';

const base = JSON.parse(await fs.readFile(path.join(process.cwd(), 'config', 'publication-policy.json'), 'utf8'));
const repositoryRoot = path.resolve(process.cwd(), '..');
const manualWorkflow = await fs.readFile(path.join(repositoryRoot, '.github', 'workflows', 'firebase-production.yml'), 'utf8');
const automaticWorkflow = await fs.readFile(path.join(repositoryRoot, '.github', 'workflows', 'firebase-auto-production.yml'), 'utf8');
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

console.log(JSON.stringify({ publicationPolicyNegativeGateTests: 'passed', negativeChecks: 8, workflowReleaseChecks: 12 }, null, 2));
