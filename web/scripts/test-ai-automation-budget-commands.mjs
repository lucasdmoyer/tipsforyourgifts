import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { buildAiAutomationPolicySummary, parseAiAutomationPolicy } from './lib/ai-automation-policy-contract.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, '..');
const sourcePolicyPath = path.join(webRoot, 'config', 'ai-automation-policy.json');
const commandPath = path.join(scriptDirectory, 'configure-ai-automation-budget.mjs');
const workflowPath = path.resolve(webRoot, '..', '.github', 'workflows', 'ai-automation-budget-configure.yml');
const sourcePolicyRaw = await fs.readFile(sourcePolicyPath);
const sourcePolicy = parseAiAutomationPolicy(JSON.parse(sourcePolicyRaw.toString('utf8')));
const awaitingPolicy = structuredClone(sourcePolicy);
awaitingPolicy.status = 'awaiting_founder_platform_budget';
awaitingPolicy.credential.status = 'not_configured';
awaitingPolicy.credential.verification.status = 'not_verified';
for (const key of ['method', 'endpoint', 'verifiedAt', 'evidenceUrl', 'receiptPath', 'receiptSha256']) awaitingPolicy.credential.verification[key] = null;
awaitingPolicy.spendControl.status = 'not_configured';
awaitingPolicy.spendControl.monthlyBudgetUsd = null;
awaitingPolicy.spendControl.hardLimitEnabled = false;
awaitingPolicy.spendControl.alertThresholdUsd = null;
awaitingPolicy.spendControl.evidenceUrl = null;
const awaitingPolicyRaw = Buffer.from(`${JSON.stringify(parseAiAutomationPolicy(awaitingPolicy), null, 2)}\n`);
const awaitingPolicySha256 = createHash('sha256').update(awaitingPolicyRaw).digest('hex');

async function createFixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tips-ai-budget-test-'));
  await fs.mkdir(path.join(directory, 'config'));
  await fs.writeFile(path.join(directory, 'config', 'ai-automation-policy.json'), awaitingPolicyRaw);
  return directory;
}

function run(directory, overrides = {}) {
  const values = {
    'expected-policy-sha256': awaitingPolicySha256,
    'monthly-budget-usd': '25',
    'hard-limit-enabled': 'true',
    'alert-threshold-usd': '10',
    'platform-evidence-url': 'https://platform.openai.com/settings/organization/limits',
    confirmation: 'CONFIGURE-ai-automation-budget',
    'founder-login': 'lucasdmoyer',
    ...overrides
  };
  return spawnSync(process.execPath, [commandPath, ...Object.entries(values).map(([key, value]) => `--${key}=${value}`)], {
    cwd: directory,
    encoding: 'utf8'
  });
}

const happyDirectory = await createFixture();
const happy = run(happyDirectory);
assert.equal(happy.status, 0, happy.stderr);
const configuredRaw = await fs.readFile(path.join(happyDirectory, 'config', 'ai-automation-policy.json'));
const configured = parseAiAutomationPolicy(JSON.parse(configuredRaw.toString('utf8')));
assert.equal(configured.status, 'budget_approved_awaiting_credential');
assert.equal(configured.spendControl.status, 'configured_external');
assert.equal(configured.spendControl.monthlyBudgetUsd, 25);
assert.equal(configured.spendControl.hardLimitEnabled, true);
assert.equal(configured.spendControl.alertThresholdUsd, 10);
assert.equal(configured.spendControl.evidenceUrl, 'https://platform.openai.com/settings/organization/limits');
assert.deepEqual(configured.credential, awaitingPolicy.credential);
assert.deepEqual(configured.runtime, awaitingPolicy.runtime);
assert.deepEqual(configured.authority, awaitingPolicy.authority);
assert.deepEqual(configured.workflows, awaitingPolicy.workflows);
const configuredSummary = buildAiAutomationPolicySummary(configured);
assert.equal(configuredSummary.activationReady, false);
assert.deepEqual(configuredSummary.activationBlockers, [
  'Dedicated OpenAI project credential is not configured.',
  'Versioned automation policy is not active.'
]);
const safeOutput = JSON.parse(happy.stdout);
assert.equal(safeOutput.credentialConfigured, false);
assert.equal(safeOutput.hardLimitEnabled, true);
assert.equal(safeOutput.alertThresholdUsd, 10);
assert.equal(safeOutput.credentialValueStored, false);
assert.equal(safeOutput.modelCalled, false);
assert.equal(safeOutput.externalApiCalled, false);
assert.equal(safeOutput.policyActivated, false);

const stale = run(await createFixture(), { 'expected-policy-sha256': '0'.repeat(64) });
assert.notEqual(stale.status, 0);
assert.match(stale.stderr, /changed after founder review/);
const wrongConfirmation = run(await createFixture(), { confirmation: 'CONFIGURE-something-else' });
assert.notEqual(wrongConfirmation.status, 0);
assert.match(wrongConfirmation.stderr, /confirmation/);
const wrongFounder = run(await createFixture(), { 'founder-login': 'someone-else' });
assert.notEqual(wrongFounder.status, 0);
assert.match(wrongFounder.stderr, /configured founder/);

for (const invalidEvidenceUrl of [
  'http://platform.openai.com/settings/organization/limits',
  'https://example.com/settings/organization/limits',
  'https://platform.openai.com/',
  'https://platform.openai.com/api-keys/not-evidence',
  'https://platform.openai.com/settings/organization/limits?token=never',
  'https://platform.openai.com/settings/organization/limits#private'
]) {
  const result = run(await createFixture(), { 'platform-evidence-url': invalidEvidenceUrl });
  assert.notEqual(result.status, 0, invalidEvidenceUrl);
}

for (const invalidBudget of ['0', '-1', '0.001', '10000.01', '25.999', 'not-money']) {
  const result = run(await createFixture(), { 'monthly-budget-usd': invalidBudget });
  assert.notEqual(result.status, 0, invalidBudget);
}

for (const invalidHardLimit of ['false', 'FALSE', '1', 'yes', '']) {
  const result = run(await createFixture(), { 'hard-limit-enabled': invalidHardLimit });
  assert.notEqual(result.status, 0, invalidHardLimit);
}

for (const invalidAlert of ['0', '-1', '0.001', '25', '26', '10000.01', 'not-money']) {
  const result = run(await createFixture(), { 'alert-threshold-usd': invalidAlert });
  assert.notEqual(result.status, 0, invalidAlert);
}

const repeatedSha256 = createHash('sha256').update(configuredRaw).digest('hex');
const repeated = run(happyDirectory, { 'expected-policy-sha256': repeatedSha256 });
assert.notEqual(repeated.status, 0);
assert.match(repeated.stderr, /not awaiting founder budget approval/);

const workflowSource = await fs.readFile(workflowPath, 'utf8');
const workflow = parseYaml(workflowSource);
assert.deepEqual(workflow.permissions, { contents: 'read' });
assert.deepEqual(workflow.jobs.prepare.permissions, { contents: 'read' });
assert.deepEqual(workflow.jobs.open_pull_request.permissions, { contents: 'write', 'pull-requests': 'write' });
assert.match(workflowSource, /CONFIGURE-ai-automation-budget/);
assert.match(workflowSource, /persist-credentials: false/);
assert.match(workflowSource, /git diff --binary HEAD > ai-budget\.patch/);
assert.match(workflowSource, /actions\/upload-artifact@v7/);
assert.match(workflowSource, /actions\/download-artifact@v8/);
assert.doesNotMatch(workflowSource, /OPENAI_API_KEY|CODEX_API_KEY|codex-action|firebase-tools|hosting:channel|google-github-actions\/auth|secrets\./iu);

console.log(JSON.stringify({
  aiAutomationBudgetCommandTests: 'passed',
  commandNegativeChecks: 28,
  workflowSafetyChecks: 9,
  transition: `${awaitingPolicy.status} -> ${configured.status}`,
  credentialValueStored: false,
  modelCalled: false,
  externalApiCalled: false,
  policyActivated: false
}, null, 2));
