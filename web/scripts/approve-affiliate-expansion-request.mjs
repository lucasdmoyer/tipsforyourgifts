import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  affiliateExpansionApprovalBoundarySha256,
  validateAffiliateExpansionRequests
} from './lib/affiliate-expansion-request-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const requestId = args['request-id'] ?? '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestId)) throw new Error('request-id must be a lowercase slug');
const expectedBoundary = args['expected-approval-boundary-sha256'] ?? '';
if (!/^[a-f0-9]{64}$/.test(expectedBoundary)) throw new Error('expected-approval-boundary-sha256 must be a SHA-256 digest');
const evidenceUrl = new URL(args['approval-evidence-url'] ?? '');
if (evidenceUrl.protocol !== 'https:' || evidenceUrl.hostname !== 'github.com' || evidenceUrl.search || evidenceUrl.hash || !evidenceUrl.pathname.startsWith('/lucasdmoyer/tipsforyourgifts/actions/runs/')) {
  throw new Error('approval-evidence-url must be an exact credential-free GitHub workflow run URL');
}

const root = process.cwd();
const requestPath = path.join(root, 'config', 'affiliate-expansion-requests.json');
const affiliatePath = path.join(root, 'config', 'affiliate-programs.json');
const document = JSON.parse(await fs.readFile(requestPath, 'utf8'));
const affiliate = JSON.parse(await fs.readFile(affiliatePath, 'utf8'));
await validateAffiliateExpansionRequests({ root, document, affiliate });

if (args['founder-login'] !== affiliate.policy.founderApproverLogin) throw new Error('founder-login does not match the configured founder');
const request = document.requests.find((entry) => entry.id === requestId);
if (!request) throw new Error(`Unknown affiliate expansion request: ${requestId}`);
if (request.status !== 'awaiting_founder_scope_approval_and_partner_export') throw new Error(`${requestId} is not awaiting founder scope approval`);
const approvalBoundarySha256 = affiliateExpansionApprovalBoundarySha256(request);
if (approvalBoundarySha256 !== expectedBoundary) throw new Error('Exact affiliate expansion approval boundary changed');
if (args.confirmation !== `APPROVE-${requestId}-${approvalBoundarySha256}`) throw new Error('Action-time confirmation does not match the exact affiliate expansion request');

const program = affiliate.programs.find((entry) => entry.id === request.programId);
if (!program) throw new Error(`Unknown affiliate program: ${request.programId}`);
const expandedProductIds = [...request.currentActivationProductIds, ...request.requestedProductIds];
program.revision = request.proposedProgramRevision;
program.activationProductSelection = { mode: 'explicit_products', eligibleProductIds: expandedProductIds };
program.nextGate = 'Accept only a founder-attested partner export containing exact Bookshop-issued URLs. Each candidate still requires independent destination, tracking, and purchase-action review plus separate founder approval.';
const approvedAt = new Date().toISOString();
request.status = 'scope_approved_awaiting_partner_export';
request.scopeApproval = {
  approvedBy: args['founder-login'],
  approvedAt,
  evidenceUrl: evidenceUrl.toString(),
  approvalBoundarySha256
};
document.updatedAt = approvedAt;
affiliate.updatedAt = approvedAt;
await validateAffiliateExpansionRequests({ root, document, affiliate });

const requestTemp = `${requestPath}.tmp`;
const affiliateTemp = `${affiliatePath}.tmp`;
await fs.writeFile(requestTemp, `${JSON.stringify(document, null, 2)}\n`, { flag: 'wx' });
await fs.writeFile(affiliateTemp, `${JSON.stringify(affiliate, null, 2)}\n`, { flag: 'wx' });
try {
  await fs.rename(requestTemp, requestPath);
  await fs.rename(affiliateTemp, affiliatePath);
} catch (error) {
  await Promise.allSettled([fs.unlink(requestTemp), fs.unlink(affiliateTemp)]);
  throw error;
}
if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(process.env.GITHUB_OUTPUT, `request_id=${request.id}\nprogram_id=${program.id}\nprogram_revision=${program.revision}\nproduct_count=${expandedProductIds.length}\napproval_boundary_sha256=${approvalBoundarySha256}\n`);
}
console.log(JSON.stringify({
  affiliateExpansionScopeApproved: true,
  requestId: request.id,
  programId: program.id,
  programRevision: program.revision,
  activatedProductCount: expandedProductIds.length,
  paidUrlsCollected: 0,
  affiliateCandidatesCreated: 0,
  productionDeploymentAuthorized: false
}, null, 2));
