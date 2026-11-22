import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');
const guardPath = path.join(webRoot, 'scripts', 'require-openai-api-key.mjs');
const workflowDir = path.join(repoRoot, '.github', 'workflows');
const secretExpression = '${{ secrets.OPENAI_API_KEY }}';
const fakeSecret = 'test-only-openai-key-never-send-or-store';
const policyPath = path.join(webRoot, 'config', 'ai-automation-policy.json');

const missing = spawnSync(process.execPath, [guardPath], {
  cwd: webRoot,
  encoding: 'utf8',
  env: { ...process.env, OPENAI_API_KEY: '' }
});

if (missing.status === 0 || !missing.stderr.includes('Autonomous agent credential missing')) {
  throw new Error('The credential guard must fail with an actionable error when OPENAI_API_KEY is absent.');
}

const blockedByPolicy = spawnSync(process.execPath, [guardPath], {
  cwd: webRoot,
  encoding: 'utf8',
  env: { ...process.env, OPENAI_API_KEY: fakeSecret }
});

if (blockedByPolicy.status === 0 || !blockedByPolicy.stderr.includes('AI automation policy not active')) {
  throw new Error('A configured credential must remain blocked until the versioned budget policy is active.');
}

const activePolicy = JSON.parse(await fs.readFile(policyPath, 'utf8'));
activePolicy.status = 'active';
activePolicy.credential.status = 'configured_external';
activePolicy.spendControl.status = 'configured_external';
activePolicy.spendControl.monthlyBudgetUsd = 25;
activePolicy.spendControl.evidenceUrl = 'https://platform.openai.com/settings/organization/limits';
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'tips-openai-guard-test-'));
const activePolicyPath = path.join(temporaryDirectory, 'active-policy.json');
await fs.writeFile(activePolicyPath, `${JSON.stringify(activePolicy, null, 2)}\n`);

const configured = spawnSync(process.execPath, [guardPath], {
  cwd: webRoot,
  encoding: 'utf8',
  env: { ...process.env, OPENAI_API_KEY: fakeSecret, AI_AUTOMATION_POLICY_PATH: activePolicyPath }
});

if (configured.status !== 0) throw new Error(configured.stderr || configured.stdout);
if (`${missing.stdout}${missing.stderr}${blockedByPolicy.stdout}${blockedByPolicy.stderr}${configured.stdout}${configured.stderr}`.includes(fakeSecret)) {
  throw new Error('The credential guard exposed the secret value.');
}

const workflowNames = (await fs.readdir(workflowDir)).filter((name) => name.endsWith('.yml')).sort();
let codexSteps = 0;
const protectedWorkflows = [];

for (const workflowName of workflowNames) {
  const workflow = parse(await fs.readFile(path.join(workflowDir, workflowName), 'utf8'));
  let workflowUsesCodex = false;

  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    const steps = job.steps ?? [];
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      if (step.uses !== 'openai/codex-action@v1') continue;

      workflowUsesCodex = true;
      codexSteps += 1;
      const preflight = steps[index - 1];
      if (!preflight || preflight.name !== 'Verify autonomous agent credential') {
        throw new Error(`${workflowName}:${jobName} must put the credential preflight immediately before Codex.`);
      }
      if (preflight.run?.trim() !== 'node web/scripts/require-openai-api-key.mjs') {
        throw new Error(`${workflowName}:${jobName} does not use the reviewed credential guard.`);
      }
      if (preflight.env?.OPENAI_API_KEY !== secretExpression) {
        throw new Error(`${workflowName}:${jobName} does not bind the repository secret only to the preflight step.`);
      }
      if ((preflight.if ?? null) !== (step.if ?? null)) {
        throw new Error(`${workflowName}:${jobName} preflight and Codex conditions can diverge.`);
      }
      if (step.with?.['openai-api-key'] !== secretExpression) {
        throw new Error(`${workflowName}:${jobName} must pass only secrets.OPENAI_API_KEY to Codex.`);
      }
      if (step.with?.['safety-strategy'] !== 'drop-sudo' || step.with?.sandbox !== 'workspace-write') {
        throw new Error(`${workflowName}:${jobName} must use the explicit reviewed privilege boundary.`);
      }
      const codexArgs = JSON.parse(step.with?.['codex-args'] ?? '[]');
      if (!codexArgs.includes('--ephemeral')) {
        throw new Error(`${workflowName}:${jobName} must use an ephemeral Codex session.`);
      }
      const permissions = job.permissions ?? workflow.permissions ?? {};
      if (permissions.contents !== 'read' || Object.values(permissions).includes('write')) {
        throw new Error(`${workflowName}:${jobName} cannot expose the model key in a GitHub write-capable job.`);
      }
    }
  }

  if (workflowUsesCodex) protectedWorkflows.push(workflowName);
}

if (codexSteps !== 8 || protectedWorkflows.length !== 6) {
  throw new Error(`Expected 8 Codex steps across 6 workflows, found ${codexSteps} across ${protectedWorkflows.length}.`);
}

console.log(JSON.stringify({
  openAiCredentialGateTests: 'passed',
  codexSteps,
  protectedWorkflows,
  missingCredentialFailsBeforeModelCall: true,
  inactivePolicyFailsBeforeModelCall: true,
  modelJobsWithGithubWrite: 0,
  secretValuePrinted: false
}, null, 2));
