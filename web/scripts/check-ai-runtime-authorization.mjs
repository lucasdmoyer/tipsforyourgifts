import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseAiAutomationPolicy } from './lib/ai-automation-policy-contract.mjs';

export function assessAiRuntimeAuthorization(policyInput, context = {}) {
  const policy = parseAiAutomationPolicy(policyInput);
  if (policy.status !== 'active') {
    return {
      authorized: false,
      reason: 'policy_not_active',
      policyStatus: policy.status,
      workflowFile: null,
      jobName: null,
      credentialRead: false,
      modelCalled: false
    };
  }

  let workflowFile = null;
  let jobName = null;
  if (context.githubActions) {
    workflowFile = context.workflowRef?.match(/\/\.github\/workflows\/([^/@]+)@/)?.[1] ?? null;
    jobName = context.jobName ?? null;
    const workflow = policy.workflows.find((candidate) => candidate.file === workflowFile);
    if (!workflow || !workflow.codexJobs.includes(jobName)) {
      return {
        authorized: false,
        reason: 'unregistered_runtime_context',
        policyStatus: policy.status,
        workflowFile,
        jobName,
        credentialRead: false,
        modelCalled: false
      };
    }
  }

  return {
    authorized: true,
    reason: 'active_policy_and_registered_context',
    policyStatus: policy.status,
    workflowFile,
    jobName,
    credentialRead: false,
    modelCalled: false
  };
}

async function run() {
  const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const defaultPolicyPath = path.join(webRoot, 'config', 'ai-automation-policy.json');
  const requestedPolicyPath = process.env.AI_AUTOMATION_POLICY_PATH?.trim();
  if (process.env.GITHUB_ACTIONS === 'true' && requestedPolicyPath) {
    console.error('::error title=Automation policy override rejected::GitHub Actions must use the reviewed repository policy path. No credential was read and no model call was attempted.');
    process.exit(1);
  }

  const policyPath = requestedPolicyPath || defaultPolicyPath;
  const policy = JSON.parse(await fs.readFile(policyPath, 'utf8'));
  const assessment = assessAiRuntimeAuthorization(policy, {
    githubActions: process.env.GITHUB_ACTIONS === 'true',
    workflowRef: process.env.GITHUB_WORKFLOW_REF,
    jobName: process.env.GITHUB_JOB
  });

  if (!assessment.authorized) {
    const title = assessment.reason === 'policy_not_active'
      ? 'AI automation policy not active'
      : 'Unregistered AI automation context';
    console.error(`::error title=${title}::Runtime authorization failed before credential access. No credential was read and no model call was attempted.`);
    process.exit(1);
  }

  console.log(JSON.stringify(assessment, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await run();
