import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { parse } from 'yaml';
import { buildAiAutomationPolicySummary, parseAiAutomationPolicy, validateAiAutomationWorkflows, validateAiWorkflowDocument } from './lib/ai-automation-policy-contract.mjs';

const webRoot = process.cwd();
const repoRoot = path.resolve(webRoot, '..');
const rawPolicy = JSON.parse(await fs.readFile(path.join(webRoot, 'config', 'ai-automation-policy.json'), 'utf8'));
const policy = parseAiAutomationPolicy(rawPolicy);
const summary = buildAiAutomationPolicySummary(policy);
const validation = await validateAiAutomationWorkflows({ repoRoot, policy });

assert.equal(summary.activationReady, ['credential_verified_awaiting_activation', 'active'].includes(policy.status));
assert.equal(summary.protectedWorkflows, 6);
assert.equal(summary.protectedModelCalls, 8);
assert.equal(validation.modelJobsWithGithubWrite, 0);
assert.equal(validation.writerJobsReceivingOpenAiKey, 0);

const clone = (value) => structuredClone(value);
assert.throws(() => parseAiAutomationPolicy({ ...clone(rawPolicy), unexpectedSecret: 'never-allowed' }));
const awaitingPolicy = clone(rawPolicy);
awaitingPolicy.status = 'awaiting_founder_platform_budget';
awaitingPolicy.credential.status = 'not_configured';
awaitingPolicy.credential.verification.status = 'not_verified';
for (const key of ['method', 'endpoint', 'verifiedAt', 'evidenceUrl', 'receiptPath', 'receiptSha256']) awaitingPolicy.credential.verification[key] = null;
awaitingPolicy.spendControl.status = 'not_configured';
awaitingPolicy.spendControl.monthlyBudgetUsd = null;
awaitingPolicy.spendControl.evidenceUrl = null;
parseAiAutomationPolicy(awaitingPolicy);
assert.throws(() => parseAiAutomationPolicy({ ...clone(awaitingPolicy), status: 'active' }), /Active policy requires/);
const mismatchedBudget = clone(awaitingPolicy);
mismatchedBudget.spendControl.monthlyBudgetUsd = 25;
assert.throws(() => parseAiAutomationPolicy(mismatchedBudget), /Budget amount and platform evidence URL/);
const budgetApprovedPolicy = clone(awaitingPolicy);
budgetApprovedPolicy.status = 'budget_approved_awaiting_credential';
budgetApprovedPolicy.spendControl.status = 'configured_external';
budgetApprovedPolicy.spendControl.monthlyBudgetUsd = 25;
budgetApprovedPolicy.spendControl.evidenceUrl = 'https://platform.openai.com/settings/organization/limits';
assert.deepEqual(buildAiAutomationPolicySummary(budgetApprovedPolicy).activationBlockers, [
  'Dedicated OpenAI project credential is not configured.',
  'Versioned automation policy is not active.'
]);
const budgetApprovedWithCredential = clone(budgetApprovedPolicy);
budgetApprovedWithCredential.credential.status = 'configured_external';
assert.throws(() => parseAiAutomationPolicy(budgetApprovedWithCredential), /complete external verification receipt/);
const awaitingWithBudget = clone(budgetApprovedPolicy);
awaitingWithBudget.status = 'awaiting_founder_platform_budget';
assert.throws(() => parseAiAutomationPolicy(awaitingWithBudget), /cannot contain a configured budget/);

const workflowPolicy = policy.workflows.find((entry) => entry.file === 'growth-review.yml');
const workflow = parse(await fs.readFile(path.join(repoRoot, '.github', 'workflows', workflowPolicy.file), 'utf8'));
const unsafeWorkflow = clone(workflow);
unsafeWorkflow.jobs.analyze.permissions = { contents: 'write' };
assert.throws(() => validateAiWorkflowDocument({ policy, workflowPolicy, workflow: unsafeWorkflow }), /no GitHub write permission/);
const persistentWorkflow = clone(workflow);
const codexStep = persistentWorkflow.jobs.analyze.steps.find((step) => step.uses === policy.runtime.action);
codexStep.with['codex-args'] = '["--search"]';
assert.throws(() => validateAiWorkflowDocument({ policy, workflowPolicy, workflow: persistentWorkflow }), /ephemeral/);
const botExpandedWorkflow = clone(workflow);
botExpandedWorkflow.jobs.analyze.steps.find((step) => step.uses === policy.runtime.action).with['allow-bots'] = true;
assert.throws(() => validateAiWorkflowDocument({ policy, workflowPolicy, workflow: botExpandedWorkflow }), /bot authority/);

const activePolicy = clone(budgetApprovedPolicy);
activePolicy.status = 'active';
activePolicy.credential.status = 'configured_external';
Object.assign(activePolicy.credential.verification, {
  status: 'verified_external',
  method: 'openai_models_endpoint',
  endpoint: 'https://api.openai.com/v1/models',
  verifiedAt: '2026-11-22T18:00:00.000Z',
  evidenceUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/12345',
  receiptPath: 'config/ai-credential-verification.json',
  receiptSha256: 'a'.repeat(64)
});
activePolicy.spendControl.status = 'configured_external';
activePolicy.spendControl.monthlyBudgetUsd = 25;
activePolicy.spendControl.evidenceUrl = 'https://platform.openai.com/settings/organization/limits';
assert.equal(buildAiAutomationPolicySummary(activePolicy).activationReady, true);

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'tips-ai-policy-test-'));
const activePolicyPath = path.join(temporaryDirectory, 'active-policy.json');
await fs.writeFile(activePolicyPath, `${JSON.stringify(activePolicy, null, 2)}\n`);

console.log(JSON.stringify({
  aiAutomationPolicyGateTests: 'passed',
  negativeChecks: 9,
  protectedWorkflows: validation.protectedWorkflows,
  protectedModelCalls: validation.protectedModelCalls,
  currentActivationReady: summary.activationReady,
  activePolicyFixture: activePolicyPath,
  secretValueStored: false
}, null, 2));
