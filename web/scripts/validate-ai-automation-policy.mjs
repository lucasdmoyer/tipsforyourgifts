import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildAiAutomationPolicySummary, parseAiAutomationPolicy, validateAiAutomationWorkflows } from './lib/ai-automation-policy-contract.mjs';

const webRoot = process.cwd();
const repoRoot = path.resolve(webRoot, '..');
const policy = parseAiAutomationPolicy(JSON.parse(await fs.readFile(path.join(webRoot, 'config', 'ai-automation-policy.json'), 'utf8')));
const summary = buildAiAutomationPolicySummary(policy);
const workflowValidation = await validateAiAutomationWorkflows({ repoRoot, policy });

console.log(JSON.stringify({
  gate: 'passed',
  policyStatus: policy.status,
  activationReady: summary.activationReady,
  activationBlockers: summary.activationBlockers,
  spendLimitRecorded: policy.spendControl.monthlyBudgetUsd !== null,
  repositoryHardCapClaimed: policy.spendControl.repositoryHardCap,
  ...workflowValidation,
  secretValueStored: policy.credential.valueStoredInGit,
  externalStateChanged: false
}, null, 2));
