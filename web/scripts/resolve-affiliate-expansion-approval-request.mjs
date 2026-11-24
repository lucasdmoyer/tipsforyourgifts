import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  affiliateExpansionApprovalBoundarySha256,
  parseAffiliateExpansionExactApproval,
  resolveAffiliateExpansionApprovalIssue,
  validateAffiliateExpansionRequests
} from './lib/affiliate-expansion-request-contract.mjs';

function readArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const root = path.resolve(readArgument('root') ?? process.cwd());
const requestDocument = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-expansion-requests.json'), 'utf8'));
const affiliate = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
await validateAffiliateExpansionRequests({ root, document: requestDocument, affiliate });

const requestPath = readArgument('request-path');
let result;
if (requestPath) {
  const issue = JSON.parse(await fs.readFile(path.resolve(requestPath), 'utf8'));
  const decision = parseAffiliateExpansionExactApproval(issue.body);
  const request = requestDocument.requests.find((entry) => entry.id === decision.requestId);
  if (!request) throw new Error(`Unknown affiliate expansion request: ${decision.requestId}`);
  result = resolveAffiliateExpansionApprovalIssue({ issue, request });
} else {
  const requestId = readArgument('request-id') ?? '';
  const request = requestDocument.requests.find((entry) => entry.id === requestId);
  if (!request) throw new Error(`Unknown affiliate expansion request: ${requestId}`);
  if (request.status !== 'awaiting_founder_scope_approval_and_partner_export') throw new Error(`${requestId} is not awaiting founder scope approval`);
  const expectedApprovalBoundarySha256 = readArgument('expected-approval-boundary-sha256') ?? '';
  const actualBoundary = affiliateExpansionApprovalBoundarySha256(request);
  if (expectedApprovalBoundarySha256 !== actualBoundary) throw new Error('Exact affiliate expansion approval boundary changed');
  const confirmation = readArgument('confirmation') ?? '';
  if (confirmation !== `APPROVE-${request.id}-${actualBoundary}`) throw new Error('Action-time confirmation does not match the exact affiliate expansion request');
  result = {
    requestId: request.id,
    expectedApprovalBoundarySha256: actualBoundary,
    confirmation,
    source: 'workflow_dispatch',
    issueUrl: null
  };
}

console.log(`request_id=${result.requestId}`);
console.log(`expected_approval_boundary_sha256=${result.expectedApprovalBoundarySha256}`);
console.log(`confirmation=${result.confirmation}`);
console.log(`request_source=${result.source}`);
if (result.issueUrl) console.log(`issue_url=${result.issueUrl}`);
