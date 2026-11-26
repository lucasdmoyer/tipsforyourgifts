import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  affiliateExpansionApprovalBoundarySha256,
  validateAffiliateExpansionRequests
} from './lib/affiliate-expansion-request-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(scriptRoot, '..');
const workflow = await fs.readFile(path.join(webRoot, '..', '.github', 'workflows', 'affiliate-expansion-approve.yml'), 'utf8');
assert.match(workflow, /environment: affiliate-expansion/);
assert.match(workflow, /Only the repository owner may approve an affiliate expansion/);
assert.match(workflow, /APPROVE-\$REQUEST_ID-\$EXPECTED_BOUNDARY/);
assert.match(workflow, /does not create paid links, merge, preview, or deploy/);

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-affiliate-expansion-approval-'));
for (const relative of ['config', 'src/data/blog', 'research/runs', 'research/reviews', 'scripts']) await fs.mkdir(path.join(root, relative), { recursive: true });
await fs.copyFile(path.join(webRoot, 'config', 'affiliate-programs.json'), path.join(root, 'config', 'affiliate-programs.json'));
await fs.copyFile(path.join(webRoot, 'config', 'affiliate-expansion-requests.json'), path.join(root, 'config', 'affiliate-expansion-requests.json'));
const initialDocument = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-expansion-requests.json'), 'utf8'));
for (const request of initialDocument.requests) {
  const source = path.join(webRoot, request.catalogObservation.path);
  const destination = path.join(root, request.catalogObservation.path);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}
await fs.cp(path.join(webRoot, 'src', 'data', 'blog'), path.join(root, 'src', 'data', 'blog'), { recursive: true });
await fs.cp(path.join(webRoot, 'research', 'runs'), path.join(root, 'research', 'runs'), { recursive: true });
await fs.cp(path.join(webRoot, 'research', 'reviews'), path.join(root, 'research', 'reviews'), { recursive: true });
await fs.cp(path.join(webRoot, 'scripts'), path.join(root, 'scripts'), { recursive: true });
await fs.symlink(path.join(webRoot, 'node_modules'), path.join(root, 'node_modules'));

const initialAffiliate = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const clean = await validateAffiliateExpansionRequests({ root, document: initialDocument, affiliate: initialAffiliate });
assert.equal(clean.summaries.length, 1);
const request = initialDocument.requests[0];
const boundary = affiliateExpansionApprovalBoundarySha256(request);
const command = [
  path.join(root, 'scripts', 'approve-affiliate-expansion-request.mjs'),
  `--request-id=${request.id}`,
  `--expected-approval-boundary-sha256=${boundary}`,
  '--approval-evidence-url=https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/123456789',
  '--founder-login=lucasdmoyer',
  `--confirmation=APPROVE-${request.id}-${boundary}`
];
await assert.rejects(() => execFileAsync(process.execPath, command.map((arg) => arg.startsWith('--confirmation=') ? '--confirmation=APPROVE-wrong' : arg), { cwd: root }), /Action-time confirmation/);
await execFileAsync(process.execPath, command, { cwd: root });

const approvedDocument = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-expansion-requests.json'), 'utf8'));
const approvedAffiliate = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const approvedRequest = approvedDocument.requests[0];
const approvedProgram = approvedAffiliate.programs.find((entry) => entry.id === approvedRequest.programId);
assert.equal(approvedRequest.status, 'scope_approved_awaiting_partner_export');
assert.equal(approvedRequest.scopeApproval.approvalBoundarySha256, boundary);
assert.equal(approvedProgram.revision, approvedRequest.proposedProgramRevision);
assert.deepEqual(approvedProgram.activationProductSelection.eligibleProductIds, [...approvedRequest.currentActivationProductIds, ...approvedRequest.requestedProductIds]);
assert.equal(approvedProgram.activationProductSelection.eligibleProductIds.length, 10);
await validateAffiliateExpansionRequests({ root, document: approvedDocument, affiliate: approvedAffiliate });
await assert.rejects(() => fs.access(path.join(root, 'affiliate', 'candidates')), (error) => error?.code === 'ENOENT');
console.log(JSON.stringify({ affiliateExpansionApprovalCommandTests: 'passed', workflowSafetyChecks: 4, exactBoundaryRequired: true, activatedProducts: 10, paidLinksCreated: false, productionDeploymentAuthorized: false }, null, 2));
