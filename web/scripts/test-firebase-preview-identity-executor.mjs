import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { executeFirebasePreviewIdentityPlan } from './lib/firebase-preview-identity-executor.mjs';
import {
  buildFirebasePreviewIdentityPlan,
  resolveFirebasePreviewIdentityApprovalIssue
} from './lib/firebase-preview-identity-plan-contract.mjs';

const root = process.cwd();
const config = JSON.parse(await fs.readFile(path.join(root, 'config', 'firebase-preview-identity-plan.json'), 'utf8'));
const plan = buildFirebasePreviewIdentityPlan(config);
const approvalUrl = new URL(plan.approvalIssueUrl);
const issue = {
  title: approvalUrl.searchParams.get('title'),
  body: approvalUrl.searchParams.get('body').replaceAll('- [ ] ', '- [x] '),
  html_url: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/130',
  user: { login: 'lucasdmoyer' },
  author_association: 'OWNER'
};
const approval = resolveFirebasePreviewIdentityApprovalIssue({ issue, currentPlan: plan });

const expectedMapping = {
  'attribute.job_workflow_ref': 'assertion.job_workflow_ref',
  'attribute.ref': 'assertion.ref',
  'attribute.event_name': 'assertion.event_name',
  'attribute.actor_id': 'assertion.actor_id',
  'attribute.repository_owner_id': 'assertion.repository_owner_id',
  'attribute.repository_id': 'assertion.repository_id',
  'google.subject': 'assertion.sub'
};

function createFake(overrides = {}) {
  const state = {
    project: { projectId: plan.projectId, projectNumber: plan.projectNumber },
    serviceAccount: { email: plan.serviceAccountEmail, disabled: false },
    projectPolicy: { bindings: [{ role: 'roles/firebasehosting.admin', members: [`serviceAccount:${plan.serviceAccountEmail}`] }] },
    keys: [],
    pool: null,
    provider: null,
    serviceAccountPolicy: { bindings: [{ role: 'roles/viewer', members: ['user:legacy@example.com'] }] },
    ...structuredClone(overrides.state ?? {})
  };
  const calls = [];
  const auditKey = new Map(plan.auditCommands.map((command, index) => [JSON.stringify(command.args), index]));
  const mutationKey = new Map(plan.mutationCommands.map((command, index) => [JSON.stringify(command.args), index]));
  const json = (value) => ({ exitCode: 0, stdout: JSON.stringify(value), stderr: '' });
  const missing = () => ({ exitCode: 1, stdout: '', stderr: 'ERROR: (gcloud) NOT_FOUND: resource was not found' });
  const runGcloud = async (args) => {
    const key = JSON.stringify(args);
    if (auditKey.has(key)) {
      const index = auditKey.get(key);
      calls.push({ type: 'audit', index });
      if (overrides.auditFailure?.index === index) return overrides.auditFailure.result;
      if (index === 0) return json(state.project);
      if (index === 1) return json(state.serviceAccount);
      if (index === 2) return json(state.projectPolicy);
      if (index === 3) return json(state.keys);
      if (index === 4) return state.pool ? json(state.pool) : missing();
      if (index === 5) return state.provider ? json(state.provider) : missing();
      return json(state.serviceAccountPolicy);
    }
    if (mutationKey.has(key)) {
      const index = mutationKey.get(key);
      calls.push({ type: 'mutation', index });
      if (overrides.mutationFailureIndex === index) return { exitCode: 1, stdout: '', stderr: 'permission denied' };
      if (index === 0) state.pool = {
        name: `projects/${plan.projectNumber}/locations/global/workloadIdentityPools/${plan.poolId}`,
        state: 'ACTIVE',
        displayName: 'Tips GitHub PR preview'
      };
      if (index === 1) state.provider = {
        name: `projects/${plan.projectNumber}/locations/global/workloadIdentityPools/${plan.poolId}/providers/${plan.providerId}`,
        state: 'ACTIVE',
        displayName: 'Tips PR 124 preview',
        oidc: { issuerUri: 'https://token.actions.githubusercontent.com' },
        attributeCondition: plan.attributeCondition,
        attributeMapping: expectedMapping
      };
      if (index === 2) state.serviceAccountPolicy.bindings.push({ role: 'roles/iam.workloadIdentityUser', members: [plan.principalSetMember] });
      return json({ done: true });
    }
    throw new Error(`Fake gcloud received an unreviewed command: ${key}`);
  };
  return { state, calls, runGcloud };
}

const dryRunFake = createFake();
const dryRun = await executeFirebasePreviewIdentityPlan({ plan, approval, execute: false, runGcloud: dryRunFake.runGcloud });
assert.equal(dryRun.mode, 'approved_dry_run');
assert.equal(dryRun.plannedMutations.length, 3);
assert.equal(dryRun.cloudMutationAttempted, false);
assert.equal(dryRun.productionDeploymentAuthorized, false);
assert.equal(dryRunFake.calls.filter((call) => call.type === 'mutation').length, 0);

const executeFake = createFake();
const receipt = await executeFirebasePreviewIdentityPlan({
  plan,
  approval,
  execute: true,
  runGcloud: executeFake.runGcloud,
  now: () => new Date('2026-11-24T12:00:00.000Z')
});
assert.deepEqual(executeFake.calls.filter((call) => call.type === 'mutation').map((call) => call.index), [0, 1, 2]);
assert.equal(receipt.mutationsApplied.length, 3);
assert.equal(receipt.after.poolExists, true);
assert.equal(receipt.after.providerExists, true);
assert.equal(receipt.after.impersonationBindingExists, true);
assert.match(receipt.receiptSha256, /^[a-f0-9]{64}$/);
assert.deepEqual(receipt.assertions, {
  exactResourcesVerified: true,
  userManagedKeysCreated: false,
  firebaseAuthAdminGranted: false,
  productionIdentityChanged: false,
  firebaseDeploymentAttempted: false,
  destructiveRecoveryAttempted: false
});
assert.doesNotMatch(JSON.stringify(receipt), /stdout|stderr|access_token|private_key/i);

executeFake.calls.length = 0;
const idempotentReceipt = await executeFirebasePreviewIdentityPlan({ plan, approval, execute: true, runGcloud: executeFake.runGcloud });
assert.equal(executeFake.calls.filter((call) => call.type === 'mutation').length, 0);
assert.equal(idempotentReceipt.mutationsApplied.length, 0);

const rejectAudit = async (overrides, errorPattern) => {
  const fake = createFake(overrides);
  await assert.rejects(
    executeFirebasePreviewIdentityPlan({ plan, approval, execute: false, runGcloud: fake.runGcloud }),
    errorPattern
  );
  assert.equal(fake.calls.filter((call) => call.type === 'mutation').length, 0);
};

await rejectAudit({ auditFailure: { index: 4, result: { exitCode: 1, stdout: '', stderr: 'permission denied' } } }, /unexpected state/);
await rejectAudit({ state: { project: { projectId: plan.projectId, projectNumber: '1' } } }, /project identity/);
await rejectAudit({ state: { projectPolicy: { bindings: [
  { role: 'roles/firebasehosting.admin', members: [`serviceAccount:${plan.serviceAccountEmail}`] },
  { role: 'roles/firebaseauth.admin', members: [`serviceAccount:${plan.serviceAccountEmail}`] }
] } } }, /project roles/);
await rejectAudit({ state: { projectPolicy: { bindings: [
  { role: 'roles/firebasehosting.admin', members: [`serviceAccount:${plan.serviceAccountEmail}`], condition: { title: 'unexpected' } }
] } } }, /project role has an unexpected IAM condition/);
await rejectAudit({ state: { keys: [{ name: 'projects/x/serviceAccounts/y/keys/z' }] } }, /User-managed/);
await rejectAudit({ state: { pool: { name: 'wrong', state: 'ACTIVE', displayName: 'Tips GitHub PR preview' } } }, /pool differs/);
await rejectAudit({ state: {
  pool: { name: `projects/${plan.projectNumber}/locations/global/workloadIdentityPools/${plan.poolId}`, state: 'ACTIVE', displayName: 'Tips GitHub PR preview' },
  provider: {
    name: `projects/${plan.projectNumber}/locations/global/workloadIdentityPools/${plan.poolId}/providers/${plan.providerId}`,
    state: 'ACTIVE', displayName: 'Tips PR 124 preview', oidc: { issuerUri: 'https://token.actions.githubusercontent.com' },
    attributeCondition: 'assertion.repository_id==\'wrong\'', attributeMapping: expectedMapping
  }
} }, /condition differs/);
await rejectAudit({ state: { serviceAccountPolicy: { bindings: [
  { role: 'roles/iam.workloadIdentityUser', members: [plan.principalSetMember], condition: { title: 'unexpected' } },
  { role: 'roles/iam.workloadIdentityUser', members: [plan.principalSetMember] }
] } } }, /condition|duplicate/);

const failedMutationFake = createFake({ mutationFailureIndex: 1 });
await assert.rejects(
  executeFirebasePreviewIdentityPlan({ plan, approval, execute: true, runGcloud: failedMutationFake.runGcloud }),
  /failed without an approved recovery path/
);
assert.deepEqual(failedMutationFake.calls.filter((call) => call.type === 'mutation').map((call) => call.index), [0, 1]);
assert.equal(failedMutationFake.calls.filter((call) => call.type === 'audit').length, 7);

await assert.rejects(
  executeFirebasePreviewIdentityPlan({ plan, approval: { ...approval, executionPlanSha256: 'a'.repeat(64) }, execute: false, runGcloud: createFake().runGcloud }),
  /approval does not match/
);
const unapprovedExecutablePlan = structuredClone(plan);
unapprovedExecutablePlan.auditCommands[0].executable = 'bash';
await assert.rejects(
  executeFirebasePreviewIdentityPlan({ plan: unapprovedExecutablePlan, approval, execute: false, runGcloud: createFake().runGcloud }),
  /unapproved executable/
);
const interactiveBindingPlan = structuredClone(plan);
interactiveBindingPlan.mutationCommands[2].args = interactiveBindingPlan.mutationCommands[2].args.filter((arg) => arg !== '--condition=None');
await assert.rejects(
  executeFirebasePreviewIdentityPlan({ plan: interactiveBindingPlan, approval, execute: false, runGcloud: createFake().runGcloud }),
  /explicitly unconditional/
);

console.log(JSON.stringify({
  firebasePreviewIdentityExecutorTests: 'passed',
  dryRunMutationsAttempted: 0,
  exactMutationsApplied: receipt.mutationsApplied.length,
  idempotentMutationsApplied: idempotentReceipt.mutationsApplied.length,
  failClosedChecks: 12,
  userManagedKeysCreated: false,
  firebaseAuthAdminGranted: false,
  firebaseDeploymentAttempted: false
}, null, 2));
