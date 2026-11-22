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

assert.equal(summary.activationReady, false);
assert.equal(summary.protectedWorkflows, 6);
assert.equal(summary.protectedModelCalls, 8);
assert.equal(validation.modelJobsWithGithubWrite, 0);
assert.equal(validation.writerJobsReceivingOpenAiKey, 0);

const clone = (value) => structuredClone(value);
assert.throws(() => parseAiAutomationPolicy({ ...clone(rawPolicy), unexpectedSecret: 'never-allowed' }));
assert.throws(() => parseAiAutomationPolicy({ ...clone(rawPolicy), status: 'active' }), /Active policy requires/);
const mismatchedBudget = clone(rawPolicy);
mismatchedBudget.spendControl.monthlyBudgetUsd = 25;
assert.throws(() => parseAiAutomationPolicy(mismatchedBudget), /Budget amount and platform evidence URL/);
const budgetApprovedPolicy = clone(rawPolicy);
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
assert.throws(() => parseAiAutomationPolicy(budgetApprovedWithCredential), /must keep the credential unconfigured/);
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

const activePolicy = clone(rawPolicy);
activePolicy.status = 'active';
activePolicy.credential.status = 'configured_external';
activePolicy.spendControl.status = 'configured_external';
activePolicy.spendControl.monthlyBudgetUsd = 25;
activePolicy.spendControl.evidenceUrl = 'https://platform.openai.com/settings/organization/limits';
assert.equal(buildAiAutomationPolicySummary(activePolicy).activationReady, true);

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'tips-ai-policy-test-'));
const activePolicyPath = path.join(temporaryDirectory, 'active-policy.json');
await fs.writeFile(activePolicyPath, `${JSON.stringify(activePolicy, null, 2)}\n`);

console.log(JSON.stringify({
  aiAutomationPolicyGateTests: 'passed',
  negativeChecks: 8,
  protectedWorkflows: validation.protectedWorkflows,
  protectedModelCalls: validation.protectedModelCalls,
  currentActivationReady: summary.activationReady,
  activePolicyFixture: activePolicyPath,
  secretValueStored: false
}, null, 2));
