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
  schemaVersion: z.literal('1.0.0'),
  status: z.enum(['awaiting_founder_platform_budget', 'active']),
  credential: z.object({
    secretName: z.literal('OPENAI_API_KEY'),
    status: z.enum(['not_configured', 'configured_external']),
    scope: z.literal('dedicated_openai_project'),
    valueStoredInGit: z.literal(false)
  }).strict(),
  spendControl: z.object({
    status: z.enum(['not_configured', 'configured_external']),
    enforcement: z.literal('openai_project_monthly_budget'),
    monthlyBudgetUsd: z.number().positive().max(10000).nullable(),
    evidenceUrl: httpsUrl.nullable(),
    repositoryHardCap: z.literal(false),
    activationRule: z.string().min(100)
  }).strict(),
  runtime: z.object({
    action: z.literal('openai/codex-action@v1'),
    documentationUrl: z.literal('https://learn.chatgpt.com/docs/github-action'),
    safetyStrategy: z.literal('drop-sudo'),
    sandbox: z.literal('workspace-write'),
    sessionMode: z.literal('ephemeral'),
    modelPolicy: z.literal('action_default'),
    effortPolicy: z.literal('action_default'),
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

  const activationReady = policy.credential.status === 'configured_external'
    && policy.spendControl.status === 'configured_external'
    && policy.spendControl.monthlyBudgetUsd !== null
    && policy.spendControl.evidenceUrl !== null;
  if (policy.status === 'active' && !activationReady) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'Active policy requires an externally configured credential and founder-approved platform budget evidence' });
  }
  if (policy.status !== 'active' && activationReady) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'A fully configured policy must be explicitly activated or its external status rolled back' });
  }
  if ((policy.spendControl.monthlyBudgetUsd === null) !== (policy.spendControl.evidenceUrl === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['spendControl'], message: 'Budget amount and platform evidence URL must be recorded together' });
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
  if (policy.spendControl.status !== 'configured_external') activationBlockers.push('OpenAI project monthly budget is not configured.');
  if (policy.spendControl.monthlyBudgetUsd === null || policy.spendControl.evidenceUrl === null) activationBlockers.push('Founder-approved budget amount and platform evidence are not recorded.');
  if (policy.status !== 'active') activationBlockers.push('Versioned automation policy is not active.');

  return {
    schemaVersion: policy.schemaVersion,
    status: policy.status,
    activationReady: activationBlockers.length === 0,
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
        const preflight = steps[index - 1];
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
        if ('model' in (step.with ?? {}) || 'effort' in (step.with ?? {})) {
          throw new Error(`${workflowPolicy.file}:${jobName} cannot override the policy's action-default model or effort.`);
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
