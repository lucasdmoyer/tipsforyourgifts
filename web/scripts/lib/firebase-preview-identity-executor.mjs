import { createHash } from 'node:crypto';

const missingPatterns = [/\bnot[_ -]?found\b/i, /does not exist/i, /was not found/i, /could not fetch resource/i];

function canonicalObject(value) {
  return JSON.stringify(Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right)));
}

function parseJsonResult(result, label) {
  try { return JSON.parse(result.stdout); } catch { throw new Error(`${label} did not return valid JSON`); }
}

function isMissing(result) {
  return result.exitCode !== 0 && missingPatterns.some((pattern) => pattern.test(`${result.stderr}\n${result.stdout}`));
}

function assertSucceeded(result, label) {
  if (result.exitCode !== 0) throw new Error(`${label} failed without an approved recovery path`);
}

function exactProjectBindings(policy, serviceAccountEmail) {
  const member = `serviceAccount:${serviceAccountEmail}`;
  return (policy.bindings ?? []).filter((binding) => (binding.members ?? []).includes(member));
}

function exactImpersonationBinding(policy, principalSetMember) {
  return (policy.bindings ?? []).filter((binding) => binding.role === 'roles/iam.workloadIdentityUser' && (binding.members ?? []).includes(principalSetMember));
}

function assertExactPool(pool, plan) {
  const expectedName = `projects/${plan.projectNumber}/locations/global/workloadIdentityPools/${plan.poolId}`;
  if (pool.name !== expectedName || pool.state !== 'ACTIVE' || pool.displayName !== 'Tips GitHub PR preview') throw new Error('Existing preview identity pool differs from the exact plan');
}

function assertExactProvider(provider, plan) {
  const expectedName = `projects/${plan.projectNumber}/locations/global/workloadIdentityPools/${plan.poolId}/providers/${plan.providerId}`;
  if (provider.name !== expectedName || provider.state !== 'ACTIVE' || provider.displayName !== 'Tips PR 124 preview') throw new Error('Existing GitHub preview provider identity differs from the exact plan');
  if (provider.oidc?.issuerUri !== 'https://token.actions.githubusercontent.com') throw new Error('Existing GitHub preview provider issuer differs from the exact plan');
  if (provider.attributeCondition !== plan.attributeCondition) throw new Error('Existing GitHub preview provider condition differs from the exact plan');
  const expectedMapping = {
    'google.subject': 'assertion.sub',
    'attribute.repository_id': 'assertion.repository_id',
    'attribute.repository_owner_id': 'assertion.repository_owner_id',
    'attribute.actor_id': 'assertion.actor_id',
    'attribute.event_name': 'assertion.event_name',
    'attribute.ref': 'assertion.ref',
    'attribute.job_workflow_ref': 'assertion.job_workflow_ref'
  };
  if (canonicalObject(provider.attributeMapping) !== canonicalObject(expectedMapping)) throw new Error('Existing GitHub preview provider attribute mapping differs from the exact plan');
}

function assertPlan(plan) {
  if (!/^[a-f0-9]{64}$/.test(plan.configSha256) || !/^[a-f0-9]{64}$/.test(plan.executionPlanSha256)) throw new Error('Firebase preview identity plan digests are invalid');
  if (plan.mode !== 'review_only_no_execution' || plan.auditCommands.length !== 7 || plan.mutationCommands.length !== 3) throw new Error('Firebase preview identity execution shape differs from the reviewed contract');
  if (JSON.stringify(plan.postflightCommands) !== JSON.stringify(plan.auditCommands)) throw new Error('Firebase preview identity postflight differs from the reviewed audit contract');
  if ([...plan.auditCommands, ...plan.mutationCommands].some((entry) => entry.executable !== 'gcloud')) throw new Error('Firebase preview identity plan contains an unapproved executable');
  if (plan.auditCommands.some((entry) => entry.mutatesCloud || entry.runWhen !== 'always')) throw new Error('Firebase preview identity audit command is not read-only');
  if (!plan.mutationCommands.every((entry) => entry.mutatesCloud && entry.runWhen.startsWith('only_if_') && entry.args.includes('--quiet'))) throw new Error('Firebase preview identity mutation is not conditional and non-interactive');
  if (!plan.mutationCommands[2].args.includes('--condition=None')) throw new Error('Firebase preview identity impersonation binding must be explicitly unconditional');
  if (JSON.stringify(plan.allowedServiceAccountProjectRoles) !== JSON.stringify(['roles/firebasehosting.admin'])) throw new Error('Firebase preview identity project-role allowlist is not exact');
  const expectedInvariants = {
    existingServiceAccountRequired: true,
    createServiceAccountAllowed: false,
    userManagedKeysAllowed: false,
    firebaseAuthAdminAllowed: false,
    productionProviderChangesAllowed: false,
    firebaseDeploymentAllowed: false,
    destructiveRecoveryAllowed: false,
    stopOnUnexpectedExistingState: true
  };
  if (JSON.stringify(plan.invariants) !== JSON.stringify(expectedInvariants)) throw new Error('Firebase preview identity invariants are not fail-closed');
  const recomputedExecutionPlanSha256 = createHash('sha256').update(JSON.stringify({
    schemaVersion: plan.schemaVersion,
    configSha256: plan.configSha256,
    auditCommands: plan.auditCommands,
    mutationCommands: plan.mutationCommands,
    postflightCommands: plan.postflightCommands,
    invariants: plan.invariants
  }), 'utf8').digest('hex');
  if (recomputedExecutionPlanSha256 !== plan.executionPlanSha256) throw new Error('Firebase preview identity execution plan digest does not match its commands');
}

export async function auditFirebasePreviewIdentity({ plan, runGcloud }) {
  assertPlan(plan);
  const [projectCommand, serviceAccountCommand, projectPolicyCommand, keysCommand, poolCommand, providerCommand, serviceAccountPolicyCommand] = plan.auditCommands;

  const projectResult = await runGcloud(projectCommand.args);
  assertSucceeded(projectResult, projectCommand.purpose);
  const project = parseJsonResult(projectResult, projectCommand.purpose);
  if (String(project.projectNumber) !== plan.projectNumber || project.projectId !== plan.projectId) throw new Error('Google Cloud project identity differs from the exact plan');

  const serviceAccountResult = await runGcloud(serviceAccountCommand.args);
  assertSucceeded(serviceAccountResult, serviceAccountCommand.purpose);
  const serviceAccount = parseJsonResult(serviceAccountResult, serviceAccountCommand.purpose);
  if (serviceAccount.email !== plan.serviceAccountEmail || serviceAccount.disabled === true) throw new Error('Existing preview service account differs from the exact plan');

  const projectPolicyResult = await runGcloud(projectPolicyCommand.args);
  assertSucceeded(projectPolicyResult, projectPolicyCommand.purpose);
  const projectBindings = exactProjectBindings(parseJsonResult(projectPolicyResult, projectPolicyCommand.purpose), plan.serviceAccountEmail);
  if (projectBindings.some((binding) => binding.condition != null)) throw new Error('Preview service-account project role has an unexpected IAM condition');
  const projectRoles = projectBindings.map((binding) => binding.role).sort();
  if (JSON.stringify(projectRoles) !== JSON.stringify([...plan.allowedServiceAccountProjectRoles].sort())) throw new Error('Preview service-account project roles differ from the exact allowlist');

  const keysResult = await runGcloud(keysCommand.args);
  assertSucceeded(keysResult, keysCommand.purpose);
  const userManagedKeys = parseJsonResult(keysResult, keysCommand.purpose);
  if (!Array.isArray(userManagedKeys) || userManagedKeys.length !== 0) throw new Error('User-managed preview service-account key exists');

  const poolResult = await runGcloud(poolCommand.args);
  const poolExists = poolResult.exitCode === 0;
  if (!poolExists && !isMissing(poolResult)) throw new Error('Preview identity pool audit failed with unexpected state');
  if (poolExists) assertExactPool(parseJsonResult(poolResult, poolCommand.purpose), plan);

  const providerResult = await runGcloud(providerCommand.args);
  const providerExists = providerResult.exitCode === 0;
  if (!providerExists && !isMissing(providerResult)) throw new Error('GitHub preview provider audit failed with unexpected state');
  if (providerExists) assertExactProvider(parseJsonResult(providerResult, providerCommand.purpose), plan);
  if (providerExists && !poolExists) throw new Error('GitHub preview provider exists without the exact preview pool');

  const serviceAccountPolicyResult = await runGcloud(serviceAccountPolicyCommand.args);
  assertSucceeded(serviceAccountPolicyResult, serviceAccountPolicyCommand.purpose);
  const impersonationBindings = exactImpersonationBinding(parseJsonResult(serviceAccountPolicyResult, serviceAccountPolicyCommand.purpose), plan.principalSetMember);
  if (impersonationBindings.some((binding) => binding.condition != null)) throw new Error('Exact preview impersonation member has an unexpected IAM condition');
  if (impersonationBindings.length > 1) throw new Error('Exact preview impersonation member has duplicate IAM bindings');

  return {
    projectVerified: true,
    serviceAccountVerified: true,
    projectRoles,
    userManagedKeyCount: 0,
    poolExists,
    providerExists,
    impersonationBindingExists: impersonationBindings.length === 1
  };
}

export async function executeFirebasePreviewIdentityPlan({ plan, approval, execute, runGcloud, now = () => new Date() }) {
  assertPlan(plan);
  if (approval.configSha256 !== plan.configSha256 || approval.executionPlanSha256 !== plan.executionPlanSha256 || approval.approvedHeadSha !== plan.approvedHeadSha || approval.pullRequestNumber !== plan.pullRequestNumber) {
    throw new Error('Founder approval does not match the exact Firebase preview identity execution plan');
  }
  if (approval.confirmation !== plan.approvalConfirmation || approval.source !== 'owner_issue') throw new Error('Firebase preview identity execution requires the exact repository-owner issue approval');

  const before = await auditFirebasePreviewIdentity({ plan, runGcloud });
  const needed = [!before.poolExists, !before.providerExists, !before.impersonationBindingExists];
  const plannedMutations = plan.mutationCommands.filter((_command, index) => needed[index]).map((command) => ({ purpose: command.purpose, runWhen: command.runWhen }));
  if (!execute) {
    return {
      schemaVersion: '1.0.0',
      mode: 'approved_dry_run',
      configSha256: plan.configSha256,
      executionPlanSha256: plan.executionPlanSha256,
      approvalIssueUrl: approval.issueUrl,
      before,
      plannedMutations,
      cloudMutationAttempted: false,
      productionDeploymentAuthorized: false
    };
  }

  const mutationsApplied = [];
  for (const [index, command] of plan.mutationCommands.entries()) {
    if (!needed[index]) continue;
    const result = await runGcloud(command.args);
    assertSucceeded(result, command.purpose);
    mutationsApplied.push({ purpose: command.purpose, runWhen: command.runWhen });
  }

  const after = await auditFirebasePreviewIdentity({ plan, runGcloud });
  if (!after.poolExists || !after.providerExists || !after.impersonationBindingExists) throw new Error('Firebase preview identity postflight did not prove all exact resources');
  const recordedAt = now().toISOString();
  const receipt = {
    schemaVersion: '1.0.0',
    receiptId: `firebase-preview-identity-${plan.configSha256.slice(0, 12)}-${recordedAt.replace(/[-:.TZ]/g, '').slice(0, 14)}`,
    recordedAt,
    projectId: plan.projectId,
    configSha256: plan.configSha256,
    executionPlanSha256: plan.executionPlanSha256,
    approvedHeadSha: plan.approvedHeadSha,
    pullRequestNumber: plan.pullRequestNumber,
    approvalIssueUrl: approval.issueUrl,
    before,
    mutationsApplied,
    after,
    assertions: {
      exactResourcesVerified: true,
      userManagedKeysCreated: false,
      firebaseAuthAdminGranted: false,
      productionIdentityChanged: false,
      firebaseDeploymentAttempted: false,
      destructiveRecoveryAttempted: false
    }
  };
  return { ...receipt, receiptSha256: createHash('sha256').update(`${JSON.stringify(receipt, null, 2)}\n`).digest('hex') };
}
