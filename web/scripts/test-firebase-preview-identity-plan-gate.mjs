import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildFirebasePreviewIdentityPlan, parseFirebasePreviewIdentityPlan } from './lib/firebase-preview-identity-plan-contract.mjs';

const root = process.cwd();
const config = parseFirebasePreviewIdentityPlan(JSON.parse(await fs.readFile(path.join(root, 'config', 'firebase-preview-identity-plan.json'), 'utf8')));
const plan = buildFirebasePreviewIdentityPlan(config);
const readiness = JSON.parse(await fs.readFile(path.join(root, 'config', 'automation-readiness.json'), 'utf8'));
const previewGate = readiness.externalGates.find((gate) => gate.id === 'firebase-preview-identity');

assert.match(plan.configSha256, /^[a-f0-9]{64}$/);
assert.match(previewGate.nextAction, new RegExp(plan.configSha256));
assert.equal(plan.mode, 'review_only_no_execution');
assert.equal(plan.approvedHeadSha, '4a631984fb36cef60ec8faa6ae35875119a04e0e');
assert.equal(plan.pullRequestNumber, 124);
assert.equal(plan.auditCommands.length, 7);
assert.equal(plan.mutationCommands.length, 3);
assert.equal(plan.postflightCommands, plan.auditCommands);
assert.equal(plan.allowedServiceAccountProjectRoles.join(','), 'roles/firebasehosting.admin');
assert.match(plan.attributeCondition, /assertion\.repository_id=='171694140'/);
assert.match(plan.attributeCondition, /assertion\.repository_owner_id=='23782501'/);
assert.match(plan.attributeCondition, /assertion\.actor_id=='23782501'/);
assert.match(plan.attributeCondition, /assertion\.event_name=='pull_request'/);
assert.match(plan.attributeCondition, /assertion\.ref=='refs\/pull\/124\/merge'/);
assert.match(plan.attributeCondition, /firebase-preview-deploy\.yml@refs\/heads\/master/);
assert.equal(plan.principalSetMember, 'principalSet://iam.googleapis.com/projects/647657919626/locations/global/workloadIdentityPools/tips-github-preview/attribute.repository_id/171694140');

const commandText = JSON.stringify([...plan.auditCommands, ...plan.mutationCommands]);
const allCommands = [...plan.auditCommands, ...plan.mutationCommands];
const hasArgumentSequence = (sequence) => allCommands.some((entry) => sequence.every((value, index) => entry.args[index] === value));
assert.equal(hasArgumentSequence(['iam', 'service-accounts', 'create']), false);
assert.equal(hasArgumentSequence(['iam', 'service-accounts', 'keys', 'create']), false);
assert.doesNotMatch(commandText, /firebaseauth|firebase\.auth|roles\/owner|roles\/editor/i);
assert.doesNotMatch(commandText, /firebase deploy|hosting:channel:deploy|tips-github-auto-production/);
assert.match(commandText, /roles\/iam\.workloadIdentityUser/);
assert.match(commandText, /--project=tipsforyourgifts/);
assert.equal(plan.mutationCommands.filter((entry) => entry.mutatesCloud).length, 3);
assert.ok(plan.mutationCommands.every((entry) => entry.runWhen.startsWith('only_if_')));
assert.deepEqual(plan.invariants, {
  existingServiceAccountRequired: true,
  createServiceAccountAllowed: false,
  userManagedKeysAllowed: false,
  firebaseAuthAdminAllowed: false,
  productionProviderChangesAllowed: false,
  firebaseDeploymentAllowed: false,
  destructiveRecoveryAllowed: false,
  stopOnUnexpectedExistingState: true
});

const clone = () => structuredClone(config);
const negativeCases = [
  ['different project', (candidate) => { candidate.projectId = 'another-project'; }],
  ['different project number', (candidate) => { candidate.projectNumber = '1'; }],
  ['different pool', (candidate) => { candidate.poolId = 'production'; }],
  ['different provider', (candidate) => { candidate.providerId = 'production'; }],
  ['different service account', (candidate) => { candidate.serviceAccountEmail = 'other@example.iam.gserviceaccount.com'; }],
  ['different repository', (candidate) => { candidate.repositoryId = '1'; }],
  ['different owner', (candidate) => { candidate.repositoryOwnerId = '1'; }],
  ['different actor', (candidate) => { candidate.actorId = '1'; }],
  ['different event', (candidate) => { candidate.eventName = 'push'; }],
  ['different PR', (candidate) => { candidate.pullRequestNumber = 125; }],
  ['different merge ref', (candidate) => { candidate.ref = 'refs/pull/125/merge'; }],
  ['different workflow', (candidate) => { candidate.jobWorkflowRef = 'lucasdmoyer/tipsforyourgifts/.github/workflows/firebase-production.yml@refs/heads/master'; }],
  ['different approved SHA', (candidate) => { candidate.approvedHeadSha = 'a'.repeat(40); }],
  ['extra project role', (candidate) => { candidate.allowedServiceAccountProjectRoles.push('roles/firebaseauth.admin'); }],
  ['invented mapping', (candidate) => { candidate.attributeMapping['attribute.repository_id'] = 'assertion.repository'; }],
  ['changed authority', (candidate) => { candidate.authorityBoundary = 'Create anything needed.'; }]
];
for (const [label, mutate] of negativeCases) {
  const candidate = clone();
  mutate(candidate);
  assert.throws(() => parseFirebasePreviewIdentityPlan(candidate), undefined, label);
}

console.log(JSON.stringify({
  firebasePreviewIdentityPlanGateTests: 'passed',
  configSha256: plan.configSha256,
  auditCommands: plan.auditCommands.length,
  boundedMutationCommands: plan.mutationCommands.length,
  negativeChecks: negativeCases.length,
  cloudMutationAttempted: false,
  userManagedKeyAllowed: false,
  firebaseAuthAdminAllowed: false,
  productionDeploymentAuthorized: false
}, null, 2));
