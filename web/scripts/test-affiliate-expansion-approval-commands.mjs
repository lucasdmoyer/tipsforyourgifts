import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  affiliateExpansionApprovalAuthorityLines,
  affiliateExpansionApprovalBoundarySha256,
  buildAffiliateExpansionApprovalIssueUrl,
  parseAffiliateExpansionExactApproval,
  resolveAffiliateExpansionApprovalIssue,
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
assert.match(workflow, /issues:\s*\n\s+types: \[opened, reopened\]/);
assert.match(workflow, /issues: read/);
assert.match(workflow, /resolve-affiliate-expansion-approval-request\.mjs --root=web --request-path=/);
assert.match(workflow, /prepare:\s*[\s\S]*permissions:\s*\n\s+contents: read\s*\n\s+issues: read/);
assert.match(workflow, /approve:\s*[\s\S]*permissions:\s*\n\s+contents: write\s*\n\s+pull-requests: write/);

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
const approvalUrl = new URL(buildAffiliateExpansionApprovalIssueUrl(request));
assert.equal(approvalUrl.origin, 'https://github.com');
assert.equal(approvalUrl.pathname, '/lucasdmoyer/tipsforyourgifts/issues/new');
assert.equal(approvalUrl.searchParams.get('title'), `[Approve Affiliate Expansion] ${request.id} ${boundary.slice(0, 12)}`);
assert.ok(approvalUrl.toString().length < 12_000);
const uncheckedBody = approvalUrl.searchParams.get('body');
const decision = parseAffiliateExpansionExactApproval(uncheckedBody);
assert.equal(decision.requestId, request.id);
assert.equal(decision.approvalBoundarySha256, boundary);
assert.deepEqual(decision.requestedProductIds, request.requestedProductIds);
for (const line of affiliateExpansionApprovalAuthorityLines) assert.match(uncheckedBody, new RegExp(`- \\[ \\] ${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
const validIssue = {
  title: approvalUrl.searchParams.get('title'),
  body: uncheckedBody.replaceAll('- [ ] ', '- [x] '),
  html_url: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/130',
  user: { login: 'lucasdmoyer' },
  author_association: 'OWNER'
};
const issueResolution = resolveAffiliateExpansionApprovalIssue({ issue: validIssue, request });
assert.equal(issueResolution.requestId, request.id);
assert.equal(issueResolution.expectedApprovalBoundarySha256, boundary);
assert.equal(issueResolution.source, 'owner_issue');

const issueNegativeCases = [
  ['unchecked authority', (issue) => { issue.body = uncheckedBody; }],
  ['wrong owner', (issue) => { issue.user.login = 'someone-else'; }],
  ['wrong association', (issue) => { issue.author_association = 'MEMBER'; }],
  ['wrong repository', (issue) => { issue.html_url = 'https://github.com/example/repository/issues/130'; }],
  ['wrong title', (issue) => { issue.title = `${issue.title} changed`; }],
  ['changed boundary', (issue) => { issue.body = issue.body.replaceAll(boundary, 'a'.repeat(64)); }],
  ['changed product scope', (issue) => { issue.body = issue.body.replaceAll(request.requestedProductIds[0], 'different-product'); }],
  ['duplicate decision block', (issue) => { issue.body += `\n\n## Exact approval\n\`\`\`json\n${JSON.stringify(decision, null, 2)}\n\`\`\``; }]
];
for (const [label, mutate] of issueNegativeCases) {
  const issue = structuredClone(validIssue);
  mutate(issue);
  assert.throws(() => resolveAffiliateExpansionApprovalIssue({ issue, request }), undefined, label);
}

const issuePath = path.join(root, 'affiliate-expansion-issue.json');
await fs.writeFile(issuePath, `${JSON.stringify(validIssue, null, 2)}\n`);
const resolver = await execFileAsync(process.execPath, [path.join(root, 'scripts', 'resolve-affiliate-expansion-approval-request.mjs'), `--root=${root}`, `--request-path=${issuePath}`], { cwd: root });
assert.match(resolver.stdout, new RegExp(`request_id=${request.id}`));
assert.match(resolver.stdout, new RegExp(`expected_approval_boundary_sha256=${boundary}`));
assert.match(resolver.stdout, /request_source=owner_issue/);
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
console.log(JSON.stringify({ affiliateExpansionApprovalCommandTests: 'passed', workflowSafetyChecks: 9, mobileOwnerIssue: 'passed', issueNegativeChecks: issueNegativeCases.length, exactBoundaryRequired: true, activatedProducts: 10, paidLinksCreated: false, productionDeploymentAuthorized: false }, null, 2));
