import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { parseAiCredentialVerificationReceipt } from './lib/ai-credential-verification-contract.mjs';
import { buildAiAutomationPolicySummary, parseAiAutomationPolicy, validateAiAutomationWorkflows } from './lib/ai-automation-policy-contract.mjs';

const webRoot = process.cwd();
const repoRoot = path.resolve(webRoot, '..');
const policy = parseAiAutomationPolicy(JSON.parse(await fs.readFile(path.join(webRoot, 'config', 'ai-automation-policy.json'), 'utf8')));
const summary = buildAiAutomationPolicySummary(policy);
const workflowValidation = await validateAiAutomationWorkflows({ repoRoot, policy });
let credentialReceiptVerified = false;
if (policy.credential.verification.status === 'verified_external') {
  const receiptPath = path.join(webRoot, policy.credential.verification.receiptPath);
  const receiptRaw = await fs.readFile(receiptPath);
  const receipt = parseAiCredentialVerificationReceipt(JSON.parse(receiptRaw.toString('utf8')));
  const receiptSha256 = createHash('sha256').update(receiptRaw).digest('hex');
  if (receiptSha256 !== policy.credential.verification.receiptSha256) throw new Error('AI credential verification receipt digest does not match the policy');
  if (receipt.workflowRunUrl !== policy.credential.verification.evidenceUrl || receipt.verifiedAt !== policy.credential.verification.verifiedAt) throw new Error('AI credential verification receipt evidence does not match the policy');
  credentialReceiptVerified = true;
} else {
  try {
    await fs.access(path.join(webRoot, 'config', 'ai-credential-verification.json'));
    throw new Error('Unverified AI policy cannot retain a credential verification receipt');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

console.log(JSON.stringify({
  gate: 'passed',
  policyStatus: policy.status,
  activationReady: summary.activationReady,
  activationBlockers: summary.activationBlockers,
  spendLimitRecorded: policy.spendControl.monthlyBudgetUsd !== null,
  credentialReceiptVerified,
  repositoryHardCapClaimed: policy.spendControl.repositoryHardCap,
  ...workflowValidation,
  secretValueStored: policy.credential.valueStoredInGit,
  externalStateChanged: false
}, null, 2));
