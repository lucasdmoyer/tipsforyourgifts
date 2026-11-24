import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildFirebasePreviewIdentityPlan, resolveFirebasePreviewIdentityApprovalIssue } from './lib/firebase-preview-identity-plan-contract.mjs';

function readArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const root = path.resolve(readArgument('root') ?? process.cwd());
const requestPath = readArgument('request-path');
if (!requestPath) throw new Error('Firebase preview identity approval resolver requires --request-path');

const config = JSON.parse(await fs.readFile(path.join(root, 'config', 'firebase-preview-identity-plan.json'), 'utf8'));
const currentPlan = buildFirebasePreviewIdentityPlan(config);
const issue = JSON.parse(await fs.readFile(path.resolve(requestPath), 'utf8'));
const result = resolveFirebasePreviewIdentityApprovalIssue({ issue, currentPlan });

console.log(`decision=${result.decision}`);
console.log(`config_sha256=${result.configSha256}`);
console.log(`approved_head_sha=${result.approvedHeadSha}`);
console.log(`pull_request_number=${result.pullRequestNumber}`);
console.log(`confirmation=${result.confirmation}`);
console.log(`request_source=${result.source}`);
console.log(`issue_url=${result.issueUrl}`);
