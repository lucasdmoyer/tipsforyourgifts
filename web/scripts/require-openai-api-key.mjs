import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseAiAutomationPolicy } from './lib/ai-automation-policy-contract.mjs';

const key = process.env.OPENAI_API_KEY?.trim();

if (!key) {
  console.error(
    '::error title=Autonomous agent credential missing::Repository secret OPENAI_API_KEY is required for this model job. Add it through GitHub Settings > Secrets and variables > Actions. No model call was attempted and no secret value was printed.'
  );
  process.exit(1);
}

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPolicyPath = path.join(webRoot, 'config', 'ai-automation-policy.json');
const requestedPolicyPath = process.env.AI_AUTOMATION_POLICY_PATH?.trim();
if (process.env.GITHUB_ACTIONS === 'true' && requestedPolicyPath) {
  console.error('::error title=Automation policy override rejected::GitHub Actions must use the reviewed repository policy path. No model call was attempted.');
  process.exit(1);
}
const policyPath = requestedPolicyPath || defaultPolicyPath;
const policy = parseAiAutomationPolicy(JSON.parse(await fs.readFile(policyPath, 'utf8')));

if (policy.status !== 'active') {
  console.error('::error title=AI automation policy not active::The versioned policy is waiting for a founder-approved OpenAI project hard spend limit, an earlier alert, and external evidence. No model call was attempted.');
  process.exit(1);
}

if (process.env.GITHUB_ACTIONS === 'true') {
  const workflowRef = process.env.GITHUB_WORKFLOW_REF ?? '';
  const workflowFile = workflowRef.match(/\/\.github\/workflows\/([^/@]+)@/)?.[1];
  const jobName = process.env.GITHUB_JOB ?? '';
  const codexWorkflow = policy.workflows.find((candidate) => candidate.file === workflowFile);
  const directWorkflow = policy.directApiWorkflows.find((candidate) => candidate.file === workflowFile);
  if ((!codexWorkflow || !codexWorkflow.codexJobs.includes(jobName)) && (!directWorkflow || !directWorkflow.modelJobs.includes(jobName))) {
    console.error('::error title=Unregistered AI automation context::This workflow or job is outside the versioned model-call allowlist. No model call was attempted.');
    process.exit(1);
  }
}

console.log('Autonomous agent credential and policy preflight passed; the secret value was not printed.');
