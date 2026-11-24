import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseAiAutomationPolicy } from './lib/ai-automation-policy-contract.mjs';
import { resolveAiAutomationBudgetIssueRequest, resolveAiAutomationBudgetManualRequest } from './lib/ai-automation-budget-request-contract.mjs';

function readArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function main() {
  const raw = await fs.readFile(path.join(process.cwd(), 'web', 'config', 'ai-automation-policy.json'));
  const actualPolicySha256 = createHash('sha256').update(raw).digest('hex');
  const policyStatus = parseAiAutomationPolicy(JSON.parse(raw.toString('utf8'))).status;
  const requestPath = readArgument('request-path');
  const result = requestPath
    ? resolveAiAutomationBudgetIssueRequest({ issue: JSON.parse(await fs.readFile(requestPath, 'utf8')), actualPolicySha256, policyStatus })
    : resolveAiAutomationBudgetManualRequest({
        expectedPolicySha256: readArgument('expected-policy-sha256'),
        monthlyBudgetUsd: readArgument('monthly-budget-usd'),
        hardLimitEnabled: readArgument('hard-limit-enabled'),
        alertThresholdUsd: readArgument('alert-threshold-usd'),
        platformEvidenceUrl: readArgument('platform-evidence-url'),
        confirmation: readArgument('confirmation'),
        actualPolicySha256,
        policyStatus
      });
  console.log(`expected_policy_sha256=${result.expectedPolicySha256}`);
  console.log(`monthly_budget_usd=${result.monthlyBudgetUsd}`);
  console.log(`hard_limit_enabled=${result.hardLimitEnabled}`);
  console.log(`alert_threshold_usd=${result.alertThresholdUsd}`);
  console.log(`platform_evidence_url=${result.platformEvidenceUrl}`);
  console.log(`confirmation=${result.confirmation}`);
  console.log(`request_source=${result.source}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
