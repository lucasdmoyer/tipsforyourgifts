import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseAiCredentialVerificationReceipt } from './lib/ai-credential-verification-contract.mjs';
import { parseAiAutomationPolicy } from './lib/ai-automation-policy-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));

if (args.confirmation !== 'VERIFY-ai-automation-credential') {
  throw new Error('Action-time confirmation does not match AI credential verification');
}
if (args['founder-login'] !== 'lucasdmoyer') {
  throw new Error('Only the configured founder may record AI credential verification');
}
if (!/^[a-f0-9]{64}$/.test(args['expected-policy-sha256'] ?? '')) {
  throw new Error('expected-policy-sha256 must be a SHA-256 digest');
}
if (!args.receipt) throw new Error('A credential verification receipt is required');

const root = process.cwd();
const policyPath = path.join(root, 'config', 'ai-automation-policy.json');
const destinationReceiptPath = path.join(root, 'config', 'ai-credential-verification.json');
const policyRaw = await fs.readFile(policyPath);
const actualPolicySha256 = createHash('sha256').update(policyRaw).digest('hex');
if (actualPolicySha256 !== args['expected-policy-sha256']) {
  throw new Error('AI automation policy changed after credential verification began');
}

const policy = parseAiAutomationPolicy(JSON.parse(policyRaw.toString('utf8')));
if (policy.status !== 'budget_approved_awaiting_credential') {
  throw new Error('AI automation policy is not awaiting credential verification');
}
if (policy.credential.status !== 'not_configured' || policy.credential.verification.status !== 'not_verified') {
  throw new Error('AI credential verification has already been recorded');
}

const receiptRaw = await fs.readFile(path.resolve(root, args.receipt));
const receipt = parseAiCredentialVerificationReceipt(JSON.parse(receiptRaw.toString('utf8')));
if (receipt.basePolicySha256 !== actualPolicySha256) throw new Error('Credential receipt does not bind the exact policy SHA-256');
if (process.env.GITHUB_SHA && receipt.baseSha !== process.env.GITHUB_SHA) throw new Error('Credential receipt does not bind the checked-out base SHA');
const normalizedReceiptRaw = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
const receiptSha256 = createHash('sha256').update(normalizedReceiptRaw).digest('hex');

policy.status = 'credential_verified_awaiting_activation';
policy.credential.status = 'configured_external';
Object.assign(policy.credential.verification, {
  status: 'verified_external',
  method: receipt.method,
  endpoint: receipt.endpoint,
  verifiedAt: receipt.verifiedAt,
  evidenceUrl: receipt.workflowRunUrl,
  receiptPath: 'config/ai-credential-verification.json',
  receiptSha256
});
parseAiAutomationPolicy(policy);

await fs.writeFile(destinationReceiptPath, normalizedReceiptRaw);
await fs.writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
console.log(JSON.stringify({
  credentialVerificationRecorded: true,
  policyStatus: policy.status,
  receiptSha256,
  evidenceUrl: receipt.workflowRunUrl,
  secretValueStored: false,
  responseBodyStored: false,
  modelCalled: false,
  policyActivated: false
}, null, 2));
