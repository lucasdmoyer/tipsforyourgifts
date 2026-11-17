import fs from 'node:fs/promises';
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

const missing = spawnSync(process.execPath, [guardPath], {
  cwd: webRoot,
  encoding: 'utf8',
  env: { ...process.env, OPENAI_API_KEY: '' }
});

if (missing.status === 0 || !missing.stderr.includes('Autonomous agent credential missing')) {
  throw new Error('The credential guard must fail with an actionable error when OPENAI_API_KEY is absent.');
}

const configured = spawnSync(process.execPath, [guardPath], {
  cwd: webRoot,
  encoding: 'utf8',
  env: { ...process.env, OPENAI_API_KEY: fakeSecret }
});

if (configured.status !== 0) throw new Error(configured.stderr || configured.stdout);
if (`${missing.stdout}${missing.stderr}${configured.stdout}${configured.stderr}`.includes(fakeSecret)) {
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
    }
  }

  if (workflowUsesCodex) protectedWorkflows.push(workflowName);
}

if (codexSteps !== 7 || protectedWorkflows.length !== 5) {
  throw new Error(`Expected 7 Codex steps across 5 workflows, found ${codexSteps} across ${protectedWorkflows.length}.`);
}

console.log(JSON.stringify({
  openAiCredentialGateTests: 'passed',
  codexSteps,
  protectedWorkflows,
  missingCredentialFailsBeforeModelCall: true,
  secretValuePrinted: false
}, null, 2));
