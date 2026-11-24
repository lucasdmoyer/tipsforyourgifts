import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  buildFirebasePreviewIdentityPlan,
  firebasePreviewIdentityApprovalAuthorityLines,
  parseFirebasePreviewIdentityExactApproval,
  parseFirebasePreviewIdentityPlan,
  resolveFirebasePreviewIdentityApprovalIssue
} from './lib/firebase-preview-identity-plan-contract.mjs';

const root = process.cwd();
const config = parseFirebasePreviewIdentityPlan(JSON.parse(await fs.readFile(path.join(root, 'config', 'firebase-preview-identity-plan.json'), 'utf8')));
const plan = buildFirebasePreviewIdentityPlan(config);
const readiness = JSON.parse(await fs.readFile(path.join(root, 'config', 'automation-readiness.json'), 'utf8'));
const previewGate = readiness.externalGates.find((gate) => gate.id === 'firebase-preview-identity');

assert.match(plan.configSha256, /^[a-f0-9]{64}$/);
assert.match(plan.executionPlanSha256, /^[a-f0-9]{64}$/);
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
const approvalIssueUrl = new URL(plan.approvalIssueUrl);
assert.equal(approvalIssueUrl.origin, 'https://github.com');
assert.equal(approvalIssueUrl.pathname, '/lucasdmoyer/tipsforyourgifts/issues/new');
assert.equal(approvalIssueUrl.searchParams.get('title'), `[Firebase Preview Identity Approval] PR 124 ${plan.configSha256.slice(0, 12)}`);
assert.ok(plan.approvalIssueUrl.length < 12_000);
const uncheckedApprovalBody = approvalIssueUrl.searchParams.get('body');
const exactApproval = parseFirebasePreviewIdentityExactApproval(uncheckedApprovalBody);
assert.equal(exactApproval.configSha256, plan.configSha256);
assert.equal(exactApproval.executionPlanSha256, plan.executionPlanSha256);
assert.equal(exactApproval.approvedHeadSha, plan.approvedHeadSha);
assert.equal(exactApproval.attributeCondition, plan.attributeCondition);
assert.equal(exactApproval.principalSetMember, plan.principalSetMember);
for (const line of firebasePreviewIdentityApprovalAuthorityLines) assert.match(uncheckedApprovalBody, new RegExp(`- \\[ \\] ${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

const checkedApprovalBody = uncheckedApprovalBody.replaceAll('- [ ] ', '- [x] ');
const validIssue = {
  title: approvalIssueUrl.searchParams.get('title'),
  body: checkedApprovalBody,
  html_url: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/129',
  user: { login: 'lucasdmoyer' },
  author_association: 'OWNER'
};
const resolvedApproval = resolveFirebasePreviewIdentityApprovalIssue({ issue: validIssue, currentPlan: plan });
assert.equal(resolvedApproval.configSha256, plan.configSha256);
assert.equal(resolvedApproval.executionPlanSha256, plan.executionPlanSha256);
assert.equal(resolvedApproval.confirmation, plan.approvalConfirmation);
assert.equal(resolvedApproval.source, 'owner_issue');

const approvalNegativeCases = [
  ['unchecked authority', (issue) => { issue.body = uncheckedApprovalBody; }],
  ['wrong owner', (issue) => { issue.user.login = 'someone-else'; }],
  ['wrong association', (issue) => { issue.author_association = 'MEMBER'; }],
  ['wrong repository', (issue) => { issue.html_url = 'https://github.com/example/repository/issues/129'; }],
  ['wrong title', (issue) => { issue.title = `${issue.title} changed`; }],
  ['changed digest', (issue) => { issue.body = issue.body.replaceAll(plan.configSha256, 'a'.repeat(64)); }],
  ['changed execution digest', (issue) => { issue.body = issue.body.replaceAll(plan.executionPlanSha256, 'c'.repeat(64)); }],
  ['changed head', (issue) => { issue.body = issue.body.replaceAll(plan.approvedHeadSha, 'b'.repeat(40)); }],
  ['duplicate decision block', (issue) => { issue.body += `\n\n## Exact approval\n\`\`\`json\n${JSON.stringify(exactApproval, null, 2)}\n\`\`\``; }]
];
for (const [label, mutate] of approvalNegativeCases) {
  const issue = structuredClone(validIssue);
  mutate(issue);
  assert.throws(() => resolveFirebasePreviewIdentityApprovalIssue({ issue, currentPlan: plan }), undefined, label);
}

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
assert.ok(plan.mutationCommands.every((entry) => entry.args.includes('--quiet')));
assert.ok(plan.mutationCommands.find((entry) => entry.purpose.includes('impersonation')).args.includes('--condition=None'));
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
  executionPlanSha256: plan.executionPlanSha256,
  auditCommands: plan.auditCommands.length,
  boundedMutationCommands: plan.mutationCommands.length,
  negativeChecks: negativeCases.length,
  mobileApprovalPacket: 'passed',
  approvalNegativeChecks: approvalNegativeCases.length,
  cloudMutationAttempted: false,
  userManagedKeyAllowed: false,
  firebaseAuthAdminAllowed: false,
  productionDeploymentAuthorized: false
}, null, 2));
