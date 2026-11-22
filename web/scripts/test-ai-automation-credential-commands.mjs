import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { parseAiCredentialVerificationReceipt } from './lib/ai-credential-verification-contract.mjs';
import { buildAiAutomationPolicySummary, parseAiAutomationPolicy } from './lib/ai-automation-policy-contract.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, '..');
const repoRoot = path.resolve(webRoot, '..');
const sourcePolicy = parseAiAutomationPolicy(JSON.parse(await fs.readFile(path.join(webRoot, 'config', 'ai-automation-policy.json'), 'utf8')));
const recordCommandPath = path.join(scriptDirectory, 'record-ai-automation-credential-verification.mjs');
const activateCommandPath = path.join(scriptDirectory, 'activate-ai-automation-policy.mjs');
const baseSha = '1'.repeat(40);
const budgetApprovedPolicy = structuredClone(sourcePolicy);
budgetApprovedPolicy.status = 'budget_approved_awaiting_credential';
budgetApprovedPolicy.credential.status = 'not_configured';
budgetApprovedPolicy.credential.verification.status = 'not_verified';
for (const key of ['method', 'endpoint', 'verifiedAt', 'evidenceUrl', 'receiptPath', 'receiptSha256']) budgetApprovedPolicy.credential.verification[key] = null;
budgetApprovedPolicy.spendControl.status = 'configured_external';
budgetApprovedPolicy.spendControl.monthlyBudgetUsd = 25;
budgetApprovedPolicy.spendControl.evidenceUrl = 'https://platform.openai.com/settings/organization/limits';
const budgetApprovedRaw = Buffer.from(`${JSON.stringify(parseAiAutomationPolicy(budgetApprovedPolicy), null, 2)}\n`);
const budgetApprovedSha256 = createHash('sha256').update(budgetApprovedRaw).digest('hex');

function makeReceipt(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    secretName: 'OPENAI_API_KEY',
    method: 'openai_models_endpoint',
    endpoint: 'https://api.openai.com/v1/models',
    outcome: 'authenticated',
    httpStatus: 200,
    verifiedAt: '2026-11-22T18:30:00.000Z',
    repository: 'lucasdmoyer/tipsforyourgifts',
    actor: 'lucasdmoyer',
    ref: 'refs/heads/master',
    baseSha,
    basePolicySha256: budgetApprovedSha256,
    workflowRunId: '12345',
    workflowRunAttempt: 1,
    workflowRunUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/12345',
    secretValueStored: false,
    responseBodyStored: false,
    modelCalled: false,
    policyActivated: false,
    ...overrides
  };
}

async function createFixture(policyRaw = budgetApprovedRaw, receipt = makeReceipt()) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tips-ai-credential-test-'));
  await fs.mkdir(path.join(directory, 'config'));
  await fs.writeFile(path.join(directory, 'config', 'ai-automation-policy.json'), policyRaw);
  await fs.writeFile(path.join(directory, 'credential-verification.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return directory;
}

function record(directory, overrides = {}) {
  const values = {
    receipt: 'credential-verification.json',
    'expected-policy-sha256': budgetApprovedSha256,
    confirmation: 'VERIFY-ai-automation-credential',
    'founder-login': 'lucasdmoyer',
    ...overrides
  };
  return spawnSync(process.execPath, [recordCommandPath, ...Object.entries(values).map(([key, value]) => `--${key}=${value}`)], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_SHA: baseSha }
  });
}

function activate(directory, expectedPolicySha256, overrides = {}) {
  const values = {
    'expected-policy-sha256': expectedPolicySha256,
    confirmation: 'ACTIVATE-ai-automation',
    'founder-login': 'lucasdmoyer',
    ...overrides
  };
  return spawnSync(process.execPath, [activateCommandPath, ...Object.entries(values).map(([key, value]) => `--${key}=${value}`)], {
    cwd: directory,
    encoding: 'utf8'
  });
}

const happyDirectory = await createFixture();
const recordedResult = record(happyDirectory);
assert.equal(recordedResult.status, 0, recordedResult.stderr);
const recordedRaw = await fs.readFile(path.join(happyDirectory, 'config', 'ai-automation-policy.json'));
const recorded = parseAiAutomationPolicy(JSON.parse(recordedRaw.toString('utf8')));
assert.equal(recorded.status, 'credential_verified_awaiting_activation');
assert.equal(recorded.credential.status, 'configured_external');
assert.equal(recorded.credential.verification.status, 'verified_external');
assert.equal(recorded.credential.verification.endpoint, 'https://api.openai.com/v1/models');
assert.equal(recorded.credential.verification.evidenceUrl, 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/12345');
assert.equal(recorded.credential.verification.responseBodyStored, false);
assert.equal(recorded.credential.verification.modelCalled, false);
const retainedReceiptRaw = await fs.readFile(path.join(happyDirectory, 'config', 'ai-credential-verification.json'));
const retainedReceipt = parseAiCredentialVerificationReceipt(JSON.parse(retainedReceiptRaw.toString('utf8')));
assert.equal(createHash('sha256').update(retainedReceiptRaw).digest('hex'), recorded.credential.verification.receiptSha256);
assert.equal(buildAiAutomationPolicySummary(recorded).activationReady, true);
assert.deepEqual(buildAiAutomationPolicySummary(recorded).activationBlockers, ['Versioned automation policy is not active.']);
const recordOutput = JSON.parse(recordedResult.stdout);
assert.equal(recordOutput.secretValueStored, false);
assert.equal(recordOutput.responseBodyStored, false);
assert.equal(recordOutput.modelCalled, false);
assert.equal(recordOutput.policyActivated, false);

const recordedSha256 = createHash('sha256').update(recordedRaw).digest('hex');
const activatedResult = activate(happyDirectory, recordedSha256);
assert.equal(activatedResult.status, 0, activatedResult.stderr);
const active = parseAiAutomationPolicy(JSON.parse(await fs.readFile(path.join(happyDirectory, 'config', 'ai-automation-policy.json'), 'utf8')));
assert.equal(active.status, 'active');
assert.equal(buildAiAutomationPolicySummary(active).activationReady, true);
assert.deepEqual(buildAiAutomationPolicySummary(active).activationBlockers, []);
const activationOutput = JSON.parse(activatedResult.stdout);
assert.equal(activationOutput.secretValueStored, false);
assert.equal(activationOutput.modelCalled, false);
assert.equal(activationOutput.externalApiCalled, false);
assert.equal(activationOutput.merged, false);
assert.equal(activationOutput.deployed, false);

for (const [label, overrides, pattern] of [
  ['stale policy', { 'expected-policy-sha256': '0'.repeat(64) }, /policy changed/],
  ['wrong confirmation', { confirmation: 'VERIFY-something-else' }, /confirmation/],
  ['wrong founder', { 'founder-login': 'someone-else' }, /configured founder/]
]) {
  const result = record(await createFixture(), overrides);
  assert.notEqual(result.status, 0, label);
  assert.match(result.stderr, pattern, label);
}

for (const [label, receipt, pattern] of [
  ['wrong repository', makeReceipt({ repository: 'someone/else' }), /Invalid input/],
  ['wrong actor', makeReceipt({ actor: 'someone-else' }), /Invalid input/],
  ['wrong ref', makeReceipt({ ref: 'refs/heads/feature' }), /Invalid input/],
  ['wrong base SHA', makeReceipt({ baseSha: '2'.repeat(40) }), /checked-out base SHA/],
  ['wrong policy SHA', makeReceipt({ basePolicySha256: '2'.repeat(64) }), /exact policy SHA-256/],
  ['wrong outcome', makeReceipt({ outcome: 'failed' }), /Invalid input/],
  ['wrong status', makeReceipt({ httpStatus: 401 }), /Invalid input/],
  ['response retained', makeReceipt({ responseBodyStored: true }), /Invalid input/],
  ['model called', makeReceipt({ modelCalled: true }), /Invalid input/],
  ['run URL mismatch', makeReceipt({ workflowRunUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/99999' }), /exact workflow run ID/]
]) {
  const result = record(await createFixture(budgetApprovedRaw, receipt));
  assert.notEqual(result.status, 0, label);
  assert.match(result.stderr, pattern, label);
}

const repeated = record(happyDirectory, { 'expected-policy-sha256': createHash('sha256').update(await fs.readFile(path.join(happyDirectory, 'config', 'ai-automation-policy.json'))).digest('hex') });
assert.notEqual(repeated.status, 0);
assert.match(repeated.stderr, /not awaiting credential verification/);
const prematureActivation = activate(await createFixture(), budgetApprovedSha256);
assert.notEqual(prematureActivation.status, 0);
assert.match(prematureActivation.stderr, /not awaiting explicit activation/);
const staleActivation = activate(happyDirectory, '0'.repeat(64));
assert.notEqual(staleActivation.status, 0);
assert.match(staleActivation.stderr, /policy changed/);
for (const [label, overrides, pattern] of [
  ['wrong activation confirmation', { confirmation: 'ACTIVATE-something-else' }, /confirmation/],
  ['wrong activation founder', { 'founder-login': 'someone-else' }, /configured founder/]
]) {
  const fixture = await createFixture();
  const result = record(fixture);
  assert.equal(result.status, 0, result.stderr);
  const sha256 = createHash('sha256').update(await fs.readFile(path.join(fixture, 'config', 'ai-automation-policy.json'))).digest('hex');
  const activation = activate(fixture, sha256, overrides);
  assert.notEqual(activation.status, 0, label);
  assert.match(activation.stderr, pattern, label);
}

const verifyWorkflowSource = await fs.readFile(path.join(repoRoot, '.github', 'workflows', 'ai-automation-credential-verify.yml'), 'utf8');
const verifyWorkflow = parseYaml(verifyWorkflowSource);
const verifyJob = verifyWorkflow.jobs.verify;
assert.deepEqual(verifyWorkflow.permissions, { contents: 'read' });
assert.deepEqual(verifyWorkflow.jobs.prepare.permissions, { contents: 'read' });
assert.deepEqual(verifyJob.permissions, {});
assert.equal(verifyJob.environment, 'ai-automation-credential');
assert.equal(verifyJob.steps.some((step) => step.uses === 'actions/checkout@v5'), false);
assert.equal(verifyJob.steps.filter((step) => step.env?.OPENAI_API_KEY === '${{ secrets.OPENAI_API_KEY }}').length, 1);
assert.equal(JSON.stringify(verifyWorkflow.jobs.open_pull_request).includes('secrets.OPENAI_API_KEY'), false);
assert.match(verifyWorkflowSource, /https:\/\/api\.openai\.com\/v1\/models/);
assert.match(verifyWorkflowSource, /responseBodyStored:false,modelCalled:false,policyActivated:false/);
assert.match(verifyWorkflowSource, /refs\/heads\/master/);
assert.doesNotMatch(verifyWorkflowSource, /openai\/codex-action|responses|chat\/completions|gh pr merge|firebase-tools/iu);

const activationWorkflowSource = await fs.readFile(path.join(repoRoot, '.github', 'workflows', 'ai-automation-activate.yml'), 'utf8');
const activationWorkflow = parseYaml(activationWorkflowSource);
assert.deepEqual(activationWorkflow.permissions, { contents: 'read' });
assert.equal(activationWorkflow.jobs.prepare.environment, 'ai-automation-activation');
assert.deepEqual(activationWorkflow.jobs.open_pull_request.permissions, { contents: 'write', 'pull-requests': 'write' });
assert.match(activationWorkflowSource, /ACTIVATE-ai-automation/);
assert.doesNotMatch(activationWorkflowSource, /OPENAI_API_KEY|secrets\.|api\.openai\.com|openai\/codex-action|gh pr merge|firebase-tools/iu);

console.log(JSON.stringify({
  aiAutomationCredentialCommandTests: 'passed',
  credentialTransition: 'budget_approved_awaiting_credential -> credential_verified_awaiting_activation',
  activationTransition: 'credential_verified_awaiting_activation -> active',
  commandNegativeChecks: 18,
  workflowSafetyChecks: 16,
  secretValueStored: false,
  responseBodyStored: false,
  modelCalled: false,
  policyActivatedInRepository: false
}, null, 2));
