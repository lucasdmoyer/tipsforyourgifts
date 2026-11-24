import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseAiAutomationPolicy } from './lib/ai-automation-policy-contract.mjs';
import { resolveAiAutomationCredentialIssueRequest, resolveAiAutomationCredentialManualRequest } from './lib/ai-automation-credential-request-contract.mjs';

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
    ? resolveAiAutomationCredentialIssueRequest({ issue: JSON.parse(await fs.readFile(requestPath, 'utf8')), actualPolicySha256, policyStatus })
    : resolveAiAutomationCredentialManualRequest({
        expectedPolicySha256: readArgument('expected-policy-sha256'),
        confirmation: readArgument('confirmation'),
        actualPolicySha256,
        policyStatus
      });
  console.log(`expected_policy_sha256=${result.expectedPolicySha256}`);
  console.log(`confirmation=${result.confirmation}`);
  console.log(`request_source=${result.source}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
