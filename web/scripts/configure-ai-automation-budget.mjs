import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseAiAutomationPolicy } from './lib/ai-automation-policy-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));

if (args.confirmation !== 'CONFIGURE-ai-automation-budget') {
  throw new Error('Action-time confirmation does not match the AI automation budget');
}
if (args['founder-login'] !== 'lucasdmoyer') {
  throw new Error('Only the configured founder may record the AI automation budget');
}
if (!/^[a-f0-9]{64}$/.test(args['expected-policy-sha256'] ?? '')) {
  throw new Error('expected-policy-sha256 must be a SHA-256 digest');
}

const budgetText = args['monthly-budget-usd'] ?? '';
if (!/^(?:0\.\d{1,2}|[1-9]\d{0,4}(?:\.\d{1,2})?)$/.test(budgetText)) {
  throw new Error('monthly-budget-usd must be a positive USD amount with at most two decimal places');
}
const monthlyBudgetUsd = Number(budgetText);
if (!Number.isFinite(monthlyBudgetUsd) || monthlyBudgetUsd <= 0 || monthlyBudgetUsd > 10000) {
  throw new Error('monthly-budget-usd must be greater than zero and no more than 10000');
}

let evidenceUrl;
try {
  evidenceUrl = new URL(args['platform-evidence-url'] ?? '');
} catch {
  throw new Error('platform-evidence-url must be a valid URL');
}
if (evidenceUrl.protocol !== 'https:' || evidenceUrl.hostname !== 'platform.openai.com') {
  throw new Error('platform-evidence-url must use HTTPS on platform.openai.com');
}
if (evidenceUrl.username || evidenceUrl.password || evidenceUrl.search || evidenceUrl.hash || !/^\/settings\/organization(?:\/[a-z0-9-]+)*\/?$/.test(evidenceUrl.pathname)) {
  throw new Error('platform-evidence-url must be a credential-free platform.openai.com organization settings path without query or fragment data');
}

const root = process.cwd();
const policyPath = path.join(root, 'config', 'ai-automation-policy.json');
const raw = await fs.readFile(policyPath);
const actualSha256 = createHash('sha256').update(raw).digest('hex');
if (actualSha256 !== args['expected-policy-sha256']) {
  throw new Error('AI automation policy changed after founder review');
}

const policy = parseAiAutomationPolicy(JSON.parse(raw.toString('utf8')));
if (policy.status !== 'awaiting_founder_platform_budget') {
  throw new Error('AI automation policy is not awaiting founder budget approval');
}
if (policy.credential.status !== 'not_configured') {
  throw new Error('Credential must remain unconfigured while the budget is recorded');
}
if (policy.spendControl.status !== 'not_configured' || policy.spendControl.monthlyBudgetUsd !== null || policy.spendControl.evidenceUrl !== null) {
  throw new Error('AI automation budget has already been configured');
}

policy.status = 'budget_approved_awaiting_credential';
policy.spendControl.status = 'configured_external';
policy.spendControl.monthlyBudgetUsd = monthlyBudgetUsd;
policy.spendControl.evidenceUrl = evidenceUrl.toString();
parseAiAutomationPolicy(policy);

await fs.writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
console.log(JSON.stringify({
  budgetRecorded: true,
  policyStatus: policy.status,
  monthlyBudgetUsd,
  platformEvidenceUrl: policy.spendControl.evidenceUrl,
  credentialConfigured: false,
  credentialValueStored: false,
  modelCalled: false,
  externalApiCalled: false,
  policyActivated: false
}, null, 2));
