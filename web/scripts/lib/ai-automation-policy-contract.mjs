import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { parse as parseYaml } from 'yaml';

const httpsUrl = z.string().url().refine((value) => value.startsWith('https://'), 'must use HTTPS');
const workflowFile = z.enum([
  'research-agent.yml',
  'opportunity-scout.yml',
  'editorial-independent-review.yml',
  'growth-review.yml',
  'strategy-intake.yml',
  'affiliate-link-review.yml'
]);

const workflowPolicySchema = z.object({
  file: workflowFile,
  codexJobs: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1),
  codexSteps: z.number().int().min(1).max(2),
  searchEnabled: z.boolean(),
  githubActionsBotAllowed: z.boolean(),
  purpose: z.string().min(50)
}).strict().superRefine((workflow, context) => {
  if (new Set(workflow.codexJobs).size !== workflow.codexJobs.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['codexJobs'], message: 'Codex job names must be unique' });
  }
  if (workflow.codexJobs.length !== workflow.codexSteps) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['codexSteps'], message: 'Each protected job must contain exactly one Codex step' });
  }
});

export const aiAutomationPolicySchema = z.object({
  schemaVersion: z.literal('1.1.0'),
  status: z.enum(['awaiting_founder_platform_budget', 'budget_approved_awaiting_credential', 'credential_verified_awaiting_activation', 'active']),
  credential: z.object({
    secretName: z.literal('OPENAI_API_KEY'),
    status: z.enum(['not_configured', 'configured_external']),
    scope: z.literal('dedicated_openai_project'),
    valueStoredInGit: z.literal(false),
    verification: z.object({
      status: z.enum(['not_verified', 'verified_external']),
      method: z.literal('openai_models_endpoint').nullable(),
      endpoint: z.literal('https://api.openai.com/v1/models').nullable(),
      verifiedAt: z.string().datetime({ offset: true }).nullable(),
      evidenceUrl: httpsUrl.nullable(),
      receiptPath: z.literal('config/ai-credential-verification.json').nullable(),
      receiptSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
      responseBodyStored: z.literal(false),
      modelCalled: z.literal(false)
    }).strict()
  }).strict(),
  spendControl: z.object({
    status: z.enum(['not_configured', 'configured_external']),
    enforcement: z.literal('openai_project_hard_spend_limit'),
    monthlyBudgetUsd: z.number().positive().max(10000).nullable(),
    hardLimitEnabled: z.boolean(),
    alertThresholdUsd: z.number().positive().max(10000).nullable(),
    evidenceUrl: httpsUrl.nullable(),
    repositoryHardCap: z.literal(false),
    enforcementLagAcknowledged: z.literal(true),
    documentationUrl: z.literal('https://developers.openai.com/api/docs/guides/spend-limits'),
    activationRule: z.string().min(100),
    recommendation: z.object({
      status: z.literal('planning_only_not_approved'),
      monthlyHardLimitUsd: z.number().positive().max(10000),
      alertThresholdUsd: z.number().positive().max(10000),
      rationale: z.string().min(100),
      reviewedAt: z.string().datetime({ offset: true })
    }).strict()
  }).strict(),
  runtime: z.object({
    action: z.literal('openai/codex-action@v1'),
    documentationUrl: z.literal('https://learn.chatgpt.com/docs/github-action'),
    safetyStrategy: z.literal('drop-sudo'),
    sandbox: z.literal('workspace-write'),
    sessionMode: z.literal('ephemeral'),
    modelPolicy: z.literal('gpt-6.2-sol'),
    effortPolicy: z.literal('high'),
    trustedInitiators: z.literal('repository_write_collaborators_and_bounded_github_automation')
  }).strict(),
  authority: z.object({
    modelJobGithubContents: z.literal('read'),
    modelJobCanWritePullRequests: z.literal(false),
    detachedWriterJobsMayOpenProposalPullRequests: z.literal(true),
    writerJobsReceiveOpenAiKey: z.literal(false),
    canDeployFirebase: z.literal(false),
    canActivateAffiliateLinks: z.literal(false),
    canPublishSocialPosts: z.literal(false),
    canSendEmail: z.literal(false),
    canCreateCredentials: z.literal(false)
  }).strict(),
  workflows: z.array(workflowPolicySchema).length(6),
  shutdownConditions: z.array(z.string().min(50)).min(6)
}).strict().superRefine((policy, context) => {
  const expectedFiles = workflowFile.options;
  const files = policy.workflows.map((workflow) => workflow.file);
  if (new Set(files).size !== files.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows'], message: 'Workflow files must be unique' });
  }
  for (const expectedFile of expectedFiles) {
    if (!files.includes(expectedFile)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows'], message: `Missing protected workflow ${expectedFile}` });
    }
  }
  const codexSteps = policy.workflows.reduce((total, workflow) => total + workflow.codexSteps, 0);
  if (codexSteps !== 8) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['workflows'], message: `Expected 8 protected Codex steps, found ${codexSteps}` });
  }

  const budgetConfigured = policy.spendControl.status === 'configured_external'
    && policy.spendControl.monthlyBudgetUsd !== null
    && policy.spendControl.hardLimitEnabled
    && policy.spendControl.alertThresholdUsd !== null
    && policy.spendControl.evidenceUrl !== null;
  const verification = policy.credential.verification;
  const verificationValues = [verification.method, verification.endpoint, verification.verifiedAt, verification.evidenceUrl, verification.receiptPath, verification.receiptSha256];
  const credentialVerified = policy.credential.status === 'configured_external'
    && verification.status === 'verified_external'
    && verificationValues.every((value) => value !== null);
  const activationReady = credentialVerified && budgetConfigured;
  if (policy.spendControl.status === 'not_configured' && (policy.spendControl.monthlyBudgetUsd !== null || policy.spendControl.hardLimitEnabled || policy.spendControl.alertThresholdUsd !== null || policy.spendControl.evidenceUrl !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['spendControl'], message: 'An unconfigured spend control cannot retain a limit, hard-limit claim, alert, or platform evidence URL' });
  }
  if (policy.spendControl.status === 'configured_external' && !budgetConfigured) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['spendControl'], message: 'A configured spend control requires an amount, hard-limit enforcement, an earlier alert, and platform evidence URL' });
  }
  if (policy.spendControl.alertThresholdUsd !== null && policy.spendControl.monthlyBudgetUsd !== null && policy.spendControl.alertThresholdUsd >= policy.spendControl.monthlyBudgetUsd) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['spendControl', 'alertThresholdUsd'], message: 'Spend alert threshold must be lower than the monthly hard limit' });
  }
  if (policy.spendControl.recommendation.alertThresholdUsd >= policy.spendControl.recommendation.monthlyHardLimitUsd) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['spendControl', 'recommendation', 'alertThresholdUsd'], message: 'Recommended alert threshold must be lower than the recommended hard limit' });
  }
  if (verification.status === 'not_verified' && verificationValues.some((value) => value !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['credential', 'verification'], message: 'An unverified credential cannot retain verification evidence' });
  }
  if (verification.status === 'verified_external' && !credentialVerified) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['credential', 'verification'], message: 'A verified credential requires complete external verification evidence' });
  }
  if (policy.credential.status === 'not_configured' && verification.status !== 'not_verified') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['credential'], message: 'An unconfigured credential cannot claim external verification' });
  }
  if (policy.credential.status === 'configured_external' && verification.status !== 'verified_external') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['credential'], message: 'A configured credential requires a complete external verification receipt' });
  }
  if (policy.status === 'awaiting_founder_platform_budget' && (budgetConfigured || credentialVerified)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'The awaiting-budget state cannot contain a configured budget or credential' });
  }
  if (policy.status === 'budget_approved_awaiting_credential' && (!budgetConfigured || credentialVerified)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'The budget-approved state requires budget evidence and must keep the credential unconfigured' });
  }
  if (policy.status === 'credential_verified_awaiting_activation' && !activationReady) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'The credential-verified state requires current budget and credential verification evidence' });
  }
  if (policy.status === 'active' && !activationReady) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'Active policy requires an externally configured credential and founder-approved platform budget evidence' });
  }
  const spendEvidenceValues = [policy.spendControl.monthlyBudgetUsd, policy.spendControl.alertThresholdUsd, policy.spendControl.evidenceUrl];
  if (spendEvidenceValues.some((value) => value === null) && spendEvidenceValues.some((value) => value !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['spendControl'], message: 'Hard limit, early alert, and platform evidence URL must be recorded together' });
  }
});

export function parseAiAutomationPolicy(value) {
  return aiAutomationPolicySchema.parse(value);
}

export function buildAiAutomationPolicySummary(value) {
  const policy = parseAiAutomationPolicy(value);
  const codexSteps = policy.workflows.reduce((total, workflow) => total + workflow.codexSteps, 0);
  const activationBlockers = [];
  if (policy.credential.status !== 'configured_external') activationBlockers.push('Dedicated OpenAI project credential is not configured.');
  else if (policy.credential.verification.status !== 'verified_external') activationBlockers.push('Dedicated OpenAI project credential is not externally verified.');
  if (policy.spendControl.status !== 'configured_external' || policy.spendControl.monthlyBudgetUsd === null || !policy.spendControl.hardLimitEnabled || policy.spendControl.alertThresholdUsd === null || policy.spendControl.evidenceUrl === null) activationBlockers.push('Founder-approved OpenAI project hard spend limit, earlier alert, and platform evidence are not recorded.');
  if (policy.status !== 'active') activationBlockers.push('Versioned automation policy is not active.');

  return {
    schemaVersion: policy.schemaVersion,
    status: policy.status,
    activationReady: policy.credential.verification.status === 'verified_external'
      && policy.spendControl.status === 'configured_external'
      && policy.spendControl.monthlyBudgetUsd !== null
      && policy.spendControl.hardLimitEnabled
      && policy.spendControl.alertThresholdUsd !== null
      && policy.spendControl.evidenceUrl !== null,
    activationBlockers,
    protectedWorkflows: policy.workflows.length,
    protectedModelCalls: codexSteps,
    credential: policy.credential,
    spendControl: policy.spendControl,
    runtime: policy.runtime,
    authority: policy.authority,
    workflows: policy.workflows,
    shutdownConditions: policy.shutdownConditions
  };
}

function effectivePermissions(workflow, job) {
  const permissions = job.permissions ?? workflow.permissions;
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) return {};
  return permissions;
}

function parseCodexArgs(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) throw new Error('codex-args JSON must be an array of strings');
    return parsed;
  }
  return trimmed.split(/\s+/);
}

export function validateAiWorkflowDocument({ policy, workflowPolicy, workflow }) {
  const secretExpression = '${{ secrets.OPENAI_API_KEY }}';
  const expectedJobs = new Set(workflowPolicy.codexJobs);
  const observedJobs = new Set();
  let codexSteps = 0;

  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    const steps = job.steps ?? [];
    const jobText = JSON.stringify(job);
    const permissions = effectivePermissions(workflow, job);
    const hasWritePermission = Object.values(permissions).some((value) => value === 'write');
    const jobUsesSecret = jobText.includes(secretExpression);
    const modelSteps = steps.filter((step) => step.uses === policy.runtime.action);

    if (modelSteps.length > 0) {
      observedJobs.add(jobName);
      if (!expectedJobs.has(jobName)) throw new Error(`${workflowPolicy.file}:${jobName} is an unregistered Codex job.`);
      if (modelSteps.length !== 1) throw new Error(`${workflowPolicy.file}:${jobName} must contain exactly one Codex step.`);
      if (permissions.contents !== policy.authority.modelJobGithubContents || hasWritePermission) {
        throw new Error(`${workflowPolicy.file}:${jobName} must have effective contents: read and no GitHub write permission.`);
      }

      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index];
        if (step.uses !== policy.runtime.action) continue;
        codexSteps += 1;
        const runtimeAuthorization = steps[index - 2];
        const preflight = steps[index - 1];
        if (!runtimeAuthorization || runtimeAuthorization.name !== 'Authorize AI automation runtime') {
          throw new Error(`${workflowPolicy.file}:${jobName} must authorize the versioned runtime before credential access.`);
        }
        if (runtimeAuthorization.run?.trim() !== 'node web/scripts/check-ai-runtime-authorization.mjs') {
          throw new Error(`${workflowPolicy.file}:${jobName} must use the credential-free runtime authorization guard.`);
        }
        if (!preflight || preflight.name !== 'Verify autonomous agent credential') {
          throw new Error(`${workflowPolicy.file}:${jobName} must put the credential preflight immediately before Codex.`);
        }
        if (preflight.run?.trim() !== 'node web/scripts/require-openai-api-key.mjs') {
          throw new Error(`${workflowPolicy.file}:${jobName} must use the reviewed credential and policy guard.`);
        }
        if (preflight.env?.OPENAI_API_KEY !== secretExpression || step.with?.['openai-api-key'] !== secretExpression) {
          throw new Error(`${workflowPolicy.file}:${jobName} must bind only secrets.OPENAI_API_KEY to the guard and Codex action.`);
        }
        if ((preflight.if ?? null) !== (step.if ?? null)) {
          throw new Error(`${workflowPolicy.file}:${jobName} preflight and Codex conditions can diverge.`);
        }
        if ((runtimeAuthorization.if ?? null) !== (step.if ?? null)) {
          throw new Error(`${workflowPolicy.file}:${jobName} runtime authorization and Codex conditions can diverge.`);
        }
        if (JSON.stringify(runtimeAuthorization).includes(secretExpression)) {
          throw new Error(`${workflowPolicy.file}:${jobName} runtime authorization must not receive OPENAI_API_KEY.`);
        }
        if (step.with?.['safety-strategy'] !== policy.runtime.safetyStrategy) {
          throw new Error(`${workflowPolicy.file}:${jobName} must explicitly use ${policy.runtime.safetyStrategy}.`);
        }
        if (step.with?.sandbox !== policy.runtime.sandbox) {
          throw new Error(`${workflowPolicy.file}:${jobName} must explicitly use sandbox ${policy.runtime.sandbox}.`);
        }
        const args = parseCodexArgs(step.with?.['codex-args']);
        if (!args.includes('--ephemeral')) throw new Error(`${workflowPolicy.file}:${jobName} must run an ephemeral Codex session.`);
        if (workflowPolicy.searchEnabled !== args.includes('--search')) {
          throw new Error(`${workflowPolicy.file}:${jobName} search authority does not match the versioned policy.`);
        }
        const allowBots = step.with?.['allow-bots'] === true || step.with?.['allow-bots'] === 'true';
        if (allowBots !== workflowPolicy.githubActionsBotAllowed) {
          throw new Error(`${workflowPolicy.file}:${jobName} GitHub Actions bot authority does not match the versioned policy.`);
        }
        if (step.with?.model !== policy.runtime.modelPolicy) {
          throw new Error(`${workflowPolicy.file}:${jobName} must pin model ${policy.runtime.modelPolicy}.`);
        }
        if (step.with?.effort !== policy.runtime.effortPolicy) {
          throw new Error(`${workflowPolicy.file}:${jobName} must pin reasoning effort ${policy.runtime.effortPolicy}.`);
        }
      }

      const secretReferences = jobText.split(secretExpression).length - 1;
      if (secretReferences !== modelSteps.length * 2) {
        throw new Error(`${workflowPolicy.file}:${jobName} exposes the model credential outside the guard and Codex action.`);
      }
    } else if (jobUsesSecret) {
      throw new Error(`${workflowPolicy.file}:${jobName} receives OPENAI_API_KEY without running a registered Codex step.`);
    }
  }

  if (codexSteps !== workflowPolicy.codexSteps) {
    throw new Error(`${workflowPolicy.file} expected ${workflowPolicy.codexSteps} Codex steps, found ${codexSteps}.`);
  }
  for (const expectedJob of expectedJobs) {
    if (!observedJobs.has(expectedJob)) throw new Error(`${workflowPolicy.file} is missing protected job ${expectedJob}.`);
  }

  const detachedWriterJobs = Object.entries(workflow.jobs ?? {}).filter(([, job]) => {
    const permissions = effectivePermissions(workflow, job);
    return Object.values(permissions).some((value) => value === 'write');
  });
  if (detachedWriterJobs.length === 0) throw new Error(`${workflowPolicy.file} must keep proposal publication in a separate write-capable job.`);
  for (const [jobName, job] of detachedWriterJobs) {
    if (JSON.stringify(job).includes(secretExpression)) {
      throw new Error(`${workflowPolicy.file}:${jobName} cannot receive OPENAI_API_KEY in a write-capable job.`);
    }
  }

  return { file: workflowPolicy.file, codexSteps, modelJobs: [...observedJobs], detachedWriterJobs: detachedWriterJobs.map(([name]) => name) };
}

export async function validateAiAutomationWorkflows({ repoRoot, policy: value }) {
  const policy = parseAiAutomationPolicy(value);
  const workflows = [];
  for (const workflowPolicy of policy.workflows) {
    const workflowPath = path.join(repoRoot, '.github', 'workflows', workflowPolicy.file);
    const workflow = parseYaml(await fs.readFile(workflowPath, 'utf8'));
    workflows.push(validateAiWorkflowDocument({ policy, workflowPolicy, workflow }));
  }
  return {
    workflows,
    protectedWorkflows: workflows.length,
    protectedModelCalls: workflows.reduce((total, workflow) => total + workflow.codexSteps, 0),
    modelJobsWithGithubWrite: 0,
    writerJobsReceivingOpenAiKey: 0
  };
}
