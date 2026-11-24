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

const exactAuthorityBoundary = 'Create only the PR-124-bound keyless preview pool, provider, and workloadIdentityUser impersonation binding for the existing Firebase Hosting Admin service account. Do not create a key, grant Firebase Auth Admin, change production identity, or deploy Firebase.';

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
  pullRequestNumber: z.literal(124),
  ref: z.literal('refs/pull/124/merge'),
  jobWorkflowRef: z.literal('lucasdmoyer/tipsforyourgifts/.github/workflows/firebase-preview-deploy.yml@refs/heads/master'),
  approvedHeadSha: z.literal('4a631984fb36cef60ec8faa6ae35875119a04e0e'),
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
  releaseReviewEvidenceUrl: z.literal('https://github.com/lucasdmoyer/tipsforyourgifts/pull/124#issuecomment-7120213608'),
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
    command('Create the dedicated disabled-by-absence preview pool', ['iam', 'workload-identity-pools', 'create', config.poolId, ...commonLocation, '--display-name=Tips GitHub PR preview'], true, 'only_if_pool_is_absent'),
    command('Create the PR-124-only GitHub OIDC provider', [
      'iam', 'workload-identity-pools', 'providers', 'create-oidc', config.providerId,
      `--workload-identity-pool=${config.poolId}`,
      ...commonLocation,
      `--issuer-uri=${config.issuerUri}`,
      `--attribute-mapping=${attributeMapping}`,
      `--attribute-condition=${attributeCondition}`,
      '--display-name=Tips PR 124 preview'
    ], true, 'only_if_provider_is_absent'),
    command('Grant short-lived impersonation to the exact repository identity', [
      'iam', 'service-accounts', 'add-iam-policy-binding', config.serviceAccountEmail,
      ...commonProject,
      '--role=roles/iam.workloadIdentityUser',
      `--member=${principalSetMember}`
    ], true, 'only_if_exact_binding_is_absent')
  ];
  return {
    schemaVersion: '1.0.0',
    mode: 'review_only_no_execution',
    configSha256,
    approvalConfirmation: `CREATE-PR-124-PREVIEW-IDENTITY-${configSha256}`,
    approvedHeadSha: config.approvedHeadSha,
    pullRequestNumber: config.pullRequestNumber,
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
    invariants: {
      existingServiceAccountRequired: true,
      createServiceAccountAllowed: false,
      userManagedKeysAllowed: false,
      firebaseAuthAdminAllowed: false,
      productionProviderChangesAllowed: false,
      firebaseDeploymentAllowed: false,
      destructiveRecoveryAllowed: false,
      stopOnUnexpectedExistingState: true
    },
    releaseReviewEvidenceUrl: config.releaseReviewEvidenceUrl,
    previewWorkflowUrl: config.previewWorkflowUrl,
    authorityBoundary: config.authorityBoundary
  };
}
