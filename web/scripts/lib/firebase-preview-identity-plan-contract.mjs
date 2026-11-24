import { createHash } from 'node:crypto';
import { z } from 'zod';

const expectedAttributeMapping = Object.freeze({
  'google.subject': 'assertion.sub',
  'attribute.repository_id': 'assertion.repository_id',
  'attribute.repository_owner_id': 'assertion.repository_owner_id',
  'attribute.actor_id': 'assertion.actor_id',
  'attribute.event_name': 'assertion.event_name',
  'attribute.ref': 'assertion.ref',
  'attribute.job_workflow_ref': 'assertion.job_workflow_ref'
});

const exactAuthorityBoundary = 'Create only the PR-131-bound keyless preview pool, provider, and workloadIdentityUser impersonation binding for the existing Firebase Hosting Admin service account. Do not create a key, grant Firebase Auth Admin, change production identity, or deploy Firebase.';

export const firebasePreviewIdentityApprovalAuthorityLines = Object.freeze([
  'I reviewed this exact plan digest, PR 131 head, OIDC condition, principal set, service account, and three conditional mutations.',
  'I authorize only the seven read-only checks and three conditional mutations in this exact plan, with an immediate stop on unexpected existing state.',
  'This does not authorize service-account creation, user-managed keys, Firebase Auth Admin, production-provider changes, destructive recovery, Firebase deployment, PR merge, or production deployment.'
]);

export const firebasePreviewIdentityPlanSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  projectId: z.literal('tipsforyourgifts'),
  projectNumber: z.literal('647657919626'),
  location: z.literal('global'),
  poolId: z.literal('tips-github-preview'),
  providerId: z.literal('github-preview'),
  issuerUri: z.literal('https://token.actions.githubusercontent.com'),
  serviceAccountEmail: z.literal('github-action-171694140@tipsforyourgifts.iam.gserviceaccount.com'),
  repository: z.literal('lucasdmoyer/tipsforyourgifts'),
  repositoryId: z.literal('171694140'),
  repositoryOwnerId: z.literal('23782501'),
  actorId: z.literal('23782501'),
  eventName: z.literal('pull_request'),
  pullRequestNumber: z.literal(131),
  ref: z.literal('refs/pull/131/merge'),
  jobWorkflowRef: z.literal('lucasdmoyer/tipsforyourgifts/.github/workflows/firebase-preview-deploy.yml@refs/heads/master'),
  approvedHeadSha: z.literal('de7156cf796bde99f933536c7bf713a86af97c6d'),
  attributeMapping: z.object({
    'google.subject': z.literal(expectedAttributeMapping['google.subject']),
    'attribute.repository_id': z.literal(expectedAttributeMapping['attribute.repository_id']),
    'attribute.repository_owner_id': z.literal(expectedAttributeMapping['attribute.repository_owner_id']),
    'attribute.actor_id': z.literal(expectedAttributeMapping['attribute.actor_id']),
    'attribute.event_name': z.literal(expectedAttributeMapping['attribute.event_name']),
    'attribute.ref': z.literal(expectedAttributeMapping['attribute.ref']),
    'attribute.job_workflow_ref': z.literal(expectedAttributeMapping['attribute.job_workflow_ref'])
  }).strict(),
  allowedServiceAccountProjectRoles: z.tuple([z.literal('roles/firebasehosting.admin')]),
  releaseReviewEvidenceUrl: z.literal('https://github.com/lucasdmoyer/tipsforyourgifts/pull/131#issuecomment-7122574287'),
  previewWorkflowUrl: z.literal('https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/firebase-preview.yml'),
  authorityBoundary: z.literal(exactAuthorityBoundary)
}).strict();

const command = (purpose, args, mutatesCloud = false, runWhen = 'always') => ({
  purpose,
  executable: 'gcloud',
  args,
  mutatesCloud,
  runWhen
});

export function parseFirebasePreviewIdentityPlan(value) {
  return firebasePreviewIdentityPlanSchema.parse(value);
}

function exactApprovalDecision(plan) {
  return {
    schemaVersion: '1.0.0',
    decision: 'approve_pr_preview_identity_plan',
    configSha256: plan.configSha256,
    executionPlanSha256: plan.executionPlanSha256,
    approvedHeadSha: plan.approvedHeadSha,
    pullRequestNumber: plan.pullRequestNumber,
    projectId: plan.projectId,
    projectNumber: plan.projectNumber,
    poolId: plan.poolId,
    providerId: plan.providerId,
    serviceAccountEmail: plan.serviceAccountEmail,
    attributeCondition: plan.attributeCondition,
    principalSetMember: plan.principalSetMember
  };
}

export function parseFirebasePreviewIdentityExactApproval(body) {
  const blocks = [];
  const pattern = /(?:^|\n)## Exact approval\s*\n```json\s*\n([\s\S]*?)\n```/g;
  for (const match of String(body ?? '').replaceAll('\r\n', '\n').matchAll(pattern)) blocks.push(match[1]);
  if (blocks.length !== 1) throw new Error('Firebase preview identity request must contain exactly one Exact approval JSON block');
  let decision;
  try { decision = JSON.parse(blocks[0]); } catch { throw new Error('Firebase preview identity Exact approval block is not valid JSON'); }
  const expectedKeys = ['approvedHeadSha', 'attributeCondition', 'configSha256', 'decision', 'executionPlanSha256', 'poolId', 'principalSetMember', 'projectId', 'projectNumber', 'providerId', 'pullRequestNumber', 'schemaVersion', 'serviceAccountEmail'];
  if (!decision || Array.isArray(decision) || JSON.stringify(Object.keys(decision).sort()) !== JSON.stringify(expectedKeys)) {
    throw new Error('Firebase preview identity Exact approval contains unexpected fields');
  }
  if (decision.schemaVersion !== '1.0.0' || decision.decision !== 'approve_pr_preview_identity_plan') throw new Error('Firebase preview identity decision is unsupported');
  if (!/^[a-f0-9]{64}$/.test(decision.configSha256 ?? '')) throw new Error('Firebase preview identity plan SHA-256 is invalid');
  if (!/^[a-f0-9]{64}$/.test(decision.executionPlanSha256 ?? '')) throw new Error('Firebase preview identity execution-plan SHA-256 is invalid');
  if (!/^[a-f0-9]{40}$/.test(decision.approvedHeadSha ?? '')) throw new Error('Firebase preview identity approved head SHA is invalid');
  if (decision.pullRequestNumber !== 131) throw new Error('Firebase preview identity approval must target PR 131');
  return decision;
}

function assertApprovalAuthority(body) {
  const normalized = String(body ?? '').replaceAll('\r\n', '\n').toLowerCase();
  for (const line of firebasePreviewIdentityApprovalAuthorityLines) {
    if (!normalized.includes(`- [x] ${line}`.toLowerCase())) throw new Error(`Firebase preview identity authority check is missing: ${line}`);
  }
}

export function buildFirebasePreviewIdentityApprovalIssueUrl(plan) {
  const decision = exactApprovalDecision(plan);
  const title = `[Firebase Preview Identity Approval] PR ${plan.pullRequestNumber} ${plan.configSha256.slice(0, 12)}`;
  const body = [
    '# Approve one exact keyless Firebase preview identity plan',
    '',
    'Lucas, this packet records an action-time decision for one reviewed plan. Check the identities, condition, mutations, and boundaries below. All three boxes must be checked before submission. Submitting the issue records approval evidence only; it does not run gcloud, change Firebase, merge a pull request, or deploy production.',
    '',
    '## Release identity',
    '',
    `- **Pull request:** ${plan.pullRequestNumber}`,
    `- **Approved head:** ${plan.approvedHeadSha}`,
    `- **Plan SHA-256:** ${plan.configSha256}`,
    `- **Execution plan SHA-256:** ${plan.executionPlanSha256}`,
    `- **Project:** ${plan.projectId} (${plan.projectNumber})`,
    `- **Pool/provider:** ${plan.poolId}/${plan.providerId}`,
    `- **Existing service account:** ${plan.serviceAccountEmail}`,
    '',
    '## Exact OIDC boundary',
    '',
    `- **Attribute condition:** \`${plan.attributeCondition}\``,
    `- **Principal set:** \`${plan.principalSetMember}\``,
    `- **Existing project role retained:** ${plan.allowedServiceAccountProjectRoles.join(', ')}`,
    '',
    '## Conditional mutations',
    '',
    ...plan.mutationCommands.map((entry, index) => `${index + 1}. ${entry.purpose} (${entry.runWhen}).`),
    '',
    '## Exact approval',
    '',
    '```json',
    JSON.stringify(decision, null, 2),
    '```',
    '',
    '## Authority boundary',
    '',
    ...firebasePreviewIdentityApprovalAuthorityLines.map((line) => `- [ ] ${line}`),
    '',
    `> Confirmation: ${plan.approvalConfirmation}`
  ].join('\n');
  const url = new URL(`https://github.com/${plan.repository}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  if (url.toString().length > 12_000) throw new Error('Firebase preview identity approval issue exceeds the safe GitHub URL limit');
  return url.toString();
}

export function resolveFirebasePreviewIdentityApprovalIssue({ issue, currentPlan }) {
  if (issue?.user?.login !== 'lucasdmoyer' || issue?.author_association !== 'OWNER') throw new Error('Firebase preview identity approval must be submitted by repository owner lucasdmoyer');
  if (!/^https:\/\/github\.com\/lucasdmoyer\/tipsforyourgifts\/issues\/[1-9]\d*$/.test(issue?.html_url ?? '')) throw new Error('Firebase preview identity approval URL is outside the canonical repository');
  const decision = parseFirebasePreviewIdentityExactApproval(issue.body);
  const expected = exactApprovalDecision(currentPlan);
  if (JSON.stringify(decision) !== JSON.stringify(expected)) throw new Error('Firebase preview identity approval does not match the current exact plan');
  const expectedTitle = `[Firebase Preview Identity Approval] PR ${currentPlan.pullRequestNumber} ${currentPlan.configSha256.slice(0, 12)}`;
  if (issue.title !== expectedTitle) throw new Error(`Firebase preview identity approval title must be exactly ${expectedTitle}`);
  assertApprovalAuthority(issue.body);
  return {
    decision: decision.decision,
    configSha256: decision.configSha256,
    executionPlanSha256: decision.executionPlanSha256,
    approvedHeadSha: decision.approvedHeadSha,
    pullRequestNumber: decision.pullRequestNumber,
    confirmation: currentPlan.approvalConfirmation,
    source: 'owner_issue',
    issueUrl: issue.html_url
  };
}

export function buildFirebasePreviewIdentityPlan(rawConfig) {
  const config = parseFirebasePreviewIdentityPlan(rawConfig);
  const canonicalConfig = JSON.stringify(config);
  const configSha256 = createHash('sha256').update(canonicalConfig, 'utf8').digest('hex');
  const attributeCondition = [
    `assertion.repository_id=='${config.repositoryId}'`,
    `assertion.repository_owner_id=='${config.repositoryOwnerId}'`,
    `assertion.actor_id=='${config.actorId}'`,
    `assertion.event_name=='${config.eventName}'`,
    `assertion.ref=='${config.ref}'`,
    `assertion.job_workflow_ref=='${config.jobWorkflowRef}'`
  ].join(' && ');
  const attributeMapping = Object.entries(config.attributeMapping)
    .map(([googleAttribute, githubAssertion]) => `${googleAttribute}=${githubAssertion}`)
    .join(',');
  const principalSetMember = `principalSet://iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.poolId}/attribute.repository_id/${config.repositoryId}`;
  const commonProject = [`--project=${config.projectId}`];
  const commonLocation = [`--location=${config.location}`, ...commonProject];
  const auditCommands = [
    command('Verify the immutable Google Cloud project number', ['projects', 'describe', config.projectId, '--format=json']),
    command('Verify the existing preview service account', ['iam', 'service-accounts', 'describe', config.serviceAccountEmail, ...commonProject, '--format=json']),
    command('Verify the service account retains only the approved project role', ['projects', 'get-iam-policy', config.projectId, '--format=json']),
    command('Verify no user-managed service-account key exists', ['iam', 'service-accounts', 'keys', 'list', `--iam-account=${config.serviceAccountEmail}`, '--managed-by=user', ...commonProject, '--format=json']),
    command('Inspect the dedicated preview identity pool', ['iam', 'workload-identity-pools', 'describe', config.poolId, ...commonLocation, '--format=json']),
    command('Inspect the dedicated GitHub preview provider', ['iam', 'workload-identity-pools', 'providers', 'describe', config.providerId, `--workload-identity-pool=${config.poolId}`, ...commonLocation, '--format=json']),
    command('Inspect the service-account impersonation policy', ['iam', 'service-accounts', 'get-iam-policy', config.serviceAccountEmail, ...commonProject, '--format=json'])
  ];
  const mutationCommands = [
    command('Create the dedicated disabled-by-absence preview pool', ['iam', 'workload-identity-pools', 'create', config.poolId, ...commonLocation, '--display-name=Tips GitHub PR preview', '--quiet'], true, 'only_if_pool_is_absent'),
    command('Create the PR-131-only GitHub OIDC provider', [
      'iam', 'workload-identity-pools', 'providers', 'create-oidc', config.providerId,
      `--workload-identity-pool=${config.poolId}`,
      ...commonLocation,
      `--issuer-uri=${config.issuerUri}`,
      `--attribute-mapping=${attributeMapping}`,
      `--attribute-condition=${attributeCondition}`,
      '--display-name=Tips PR 131 preview',
      '--quiet'
    ], true, 'only_if_provider_is_absent'),
    command('Grant short-lived impersonation to the exact repository identity', [
      'iam', 'service-accounts', 'add-iam-policy-binding', config.serviceAccountEmail,
      ...commonProject,
      '--role=roles/iam.workloadIdentityUser',
      `--member=${principalSetMember}`,
      '--condition=None',
      '--quiet'
    ], true, 'only_if_exact_binding_is_absent')
  ];
  const invariants = {
    existingServiceAccountRequired: true,
    createServiceAccountAllowed: false,
    userManagedKeysAllowed: false,
    firebaseAuthAdminAllowed: false,
    productionProviderChangesAllowed: false,
    firebaseDeploymentAllowed: false,
    destructiveRecoveryAllowed: false,
    stopOnUnexpectedExistingState: true
  };
  const executionPlanSha256 = createHash('sha256').update(JSON.stringify({
    schemaVersion: '1.0.0',
    configSha256,
    auditCommands,
    mutationCommands,
    postflightCommands: auditCommands,
    invariants
  }), 'utf8').digest('hex');
  const plan = {
    schemaVersion: '1.0.0',
    mode: 'review_only_no_execution',
    configSha256,
    executionPlanSha256,
    approvalConfirmation: `CREATE-PR-131-PREVIEW-IDENTITY-${configSha256}-${executionPlanSha256}`,
    approvedHeadSha: config.approvedHeadSha,
    pullRequestNumber: config.pullRequestNumber,
    repository: config.repository,
    projectId: config.projectId,
    projectNumber: config.projectNumber,
    poolId: config.poolId,
    providerId: config.providerId,
    serviceAccountEmail: config.serviceAccountEmail,
    attributeCondition,
    principalSetMember,
    allowedServiceAccountProjectRoles: config.allowedServiceAccountProjectRoles,
    auditCommands,
    mutationCommands,
    postflightCommands: auditCommands,
    invariants,
    releaseReviewEvidenceUrl: config.releaseReviewEvidenceUrl,
    previewWorkflowUrl: config.previewWorkflowUrl,
    authorityBoundary: config.authorityBoundary
  };
  return { ...plan, approvalIssueUrl: buildFirebasePreviewIdentityApprovalIssueUrl(plan) };
}
