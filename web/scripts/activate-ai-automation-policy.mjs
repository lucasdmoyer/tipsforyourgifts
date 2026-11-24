import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseAiCredentialVerificationReceipt } from './lib/ai-credential-verification-contract.mjs';
import { buildAiAutomationPolicySummary, parseAiAutomationPolicy } from './lib/ai-automation-policy-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));

if (args.confirmation !== 'ACTIVATE-ai-automation') {
  throw new Error('Action-time confirmation does not match AI automation activation');
}
if (args['founder-login'] !== 'lucasdmoyer') {
  throw new Error('Only the configured founder may activate AI automation');
}
if (!/^[a-f0-9]{64}$/.test(args['expected-policy-sha256'] ?? '')) {
  throw new Error('expected-policy-sha256 must be a SHA-256 digest');
}

const root = process.cwd();
const policyPath = path.join(root, 'config', 'ai-automation-policy.json');
const policyRaw = await fs.readFile(policyPath);
const actualPolicySha256 = createHash('sha256').update(policyRaw).digest('hex');
if (actualPolicySha256 !== args['expected-policy-sha256']) {
  throw new Error('AI automation policy changed after founder activation review');
}

const policy = parseAiAutomationPolicy(JSON.parse(policyRaw.toString('utf8')));
if (policy.status !== 'credential_verified_awaiting_activation') {
  throw new Error('AI automation policy is not awaiting explicit activation');
}
const receiptPath = path.join(root, policy.credential.verification.receiptPath);
const receiptRaw = await fs.readFile(receiptPath);
parseAiCredentialVerificationReceipt(JSON.parse(receiptRaw.toString('utf8')));
const receiptSha256 = createHash('sha256').update(receiptRaw).digest('hex');
if (receiptSha256 !== policy.credential.verification.receiptSha256) {
  throw new Error('Credential verification receipt changed after review');
}

policy.status = 'active';
parseAiAutomationPolicy(policy);
const summary = buildAiAutomationPolicySummary(policy);
if (!summary.activationReady || summary.activationBlockers.length !== 0) {
  throw new Error('AI automation policy prerequisites are not ready for activation');
}
await fs.writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
console.log(JSON.stringify({
  policyActivated: true,
  policyStatus: policy.status,
  credentialReceiptSha256: receiptSha256,
  secretValueStored: false,
  modelCalled: false,
  externalApiCalled: false,
  merged: false,
  deployed: false
}, null, 2));
