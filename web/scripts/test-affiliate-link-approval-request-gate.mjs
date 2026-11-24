import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parse } from 'yaml';
import {
  affiliateLinkApprovalAuthorityLines,
  buildAffiliateLinkApprovalIssueUrl,
  resolveAffiliateLinkApprovalIssueRequest,
  resolveAffiliateLinkApprovalManualRequest
} from './lib/affiliate-link-approval-request-contract.mjs';

const candidateId = 'affiliate-link-test-article-test-product-test-program-v1';
const candidateSha256 = 'a'.repeat(64);
const reviewSha256 = 'b'.repeat(64);
const candidate = {
  path: `affiliate/candidates/${candidateId}.json`,
  sha256: candidateSha256,
  data: {
    candidateId,
    articleSlug: 'test-article',
    productId: 'test-product',
    programId: 'test-program',
    programRevision: 3,
    destination: { paidUrl: 'https://merchant.example/paid/test-product' }
  }
};
const review = {
  path: `affiliate/reviews/${candidateId}-review.json`,
  sha256: reviewSha256,
  data: {
    candidateId,
    candidateSha256,
    verdict: 'passed',
    destination: { resolvedUrl: 'https://merchant.example/products/test-product?affiliate=verified' },
    availability: { purchaseActionLabel: 'Add to cart' }
  }
};
const state = { candidates: [candidate], reviews: [review], approvals: [] };

const packetUrl = new URL(buildAffiliateLinkApprovalIssueUrl({ candidate, review }));
assert.equal(packetUrl.pathname, '/lucasdmoyer/tipsforyourgifts/issues/new');
assert.equal(packetUrl.searchParams.get('title'), `[Approve Affiliate Link] ${candidateId}`);
const uncheckedBody = packetUrl.searchParams.get('body');
assert.match(uncheckedBody, /Paid destination:[*][*] https:\/\/merchant\.example\/paid\/test-product/);
assert.match(uncheckedBody, new RegExp(candidateSha256));
assert.match(uncheckedBody, new RegExp(reviewSha256));
for (const line of affiliateLinkApprovalAuthorityLines) assert.ok(uncheckedBody.includes(`- [ ] ${line}`));
const checkedBody = uncheckedBody.replaceAll('- [ ] ', '- [x] ');
const issue = {
  user: { login: 'lucasdmoyer' },
  author_association: 'OWNER',
  html_url: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/123',
  title: packetUrl.searchParams.get('title'),
  body: checkedBody
};
const issueRequest = resolveAffiliateLinkApprovalIssueRequest({ issue, state });
assert.equal(issueRequest.candidateId, candidateId);
assert.equal(issueRequest.source, 'owner_issue');
assert.equal(issueRequest.confirmation, `APPROVE-${candidateId}`);
const manualRequest = resolveAffiliateLinkApprovalManualRequest({ candidateId, expectedCandidateSha256: candidateSha256, expectedReviewSha256: reviewSha256, confirmation: `APPROVE-${candidateId}`, state });
assert.equal(manualRequest.source, 'workflow_dispatch');

assert.throws(() => resolveAffiliateLinkApprovalIssueRequest({ issue: { ...issue, body: uncheckedBody }, state }), /authority check is missing/);
assert.throws(() => resolveAffiliateLinkApprovalIssueRequest({ issue: { ...issue, user: { login: 'someone-else' } }, state }), /repository owner/);
assert.throws(() => resolveAffiliateLinkApprovalIssueRequest({ issue: { ...issue, html_url: 'https://github.com/elsewhere/repo/issues/1' }, state }), /canonical repository/);
assert.throws(() => resolveAffiliateLinkApprovalIssueRequest({ issue: { ...issue, title: `${issue.title} changed` }, state }), /title must be exactly/);
assert.throws(() => resolveAffiliateLinkApprovalIssueRequest({ issue, state: { ...state, candidates: [{ ...candidate, sha256: 'c'.repeat(64) }] } }), /candidate changed/);
assert.throws(() => resolveAffiliateLinkApprovalIssueRequest({ issue, state: { ...state, reviews: [{ ...review, data: { ...review.data, verdict: 'failed' } }] } }), /clean independent review/);
assert.throws(() => resolveAffiliateLinkApprovalIssueRequest({ issue, state: { ...state, approvals: [{ data: { candidateId } }] } }), /already has a founder approval/);
assert.throws(() => resolveAffiliateLinkApprovalManualRequest({ candidateId, expectedCandidateSha256: candidateSha256, expectedReviewSha256: reviewSha256, confirmation: 'APPROVE-something-else', state }), /confirmation is invalid/);

const workflow = parse(await fs.readFile(path.resolve(process.cwd(), '..', '.github', 'workflows', 'affiliate-link-approval.yml'), 'utf8'));
assert.deepEqual(workflow.on?.issues?.types, ['opened', 'reopened'], 'affiliate approval must support a mobile owner issue');
assert.equal(workflow.permissions?.issues, 'read', 'affiliate approval needs read-only issue access');
const job = workflow.jobs?.approve;
assert.match(job?.if ?? '', /author_association == 'OWNER'/, 'affiliate issue approval must require owner association');
assert.match(job?.if ?? '', /\[Approve Affiliate Link\]/, 'affiliate issue approval must require the bounded title');
const resolveStep = job.steps.find((step) => step.name === 'Install and resolve the exact founder approval request');
const receiptStep = job.steps.find((step) => step.name === 'Create one immutable founder approval receipt');
const pullRequestStep = job.steps.find((step) => step.name === 'Open exact-link approval pull request');
assert.ok(resolveStep && receiptStep && pullRequestStep, 'affiliate issue approval requires resolver, receipt, and pull-request steps');
assert.match(resolveStep.run, /resolve-affiliate-link-approval-request\.mjs/, 'mobile and manual requests must share the exact-state resolver');
assert.equal(receiptStep.env.CANDIDATE_ID, '${{ steps.request.outputs.candidate_id }}');
assert.equal(receiptStep.env.EXPECTED_CANDIDATE_SHA256, '${{ steps.request.outputs.expected_candidate_sha256 }}');
assert.equal(receiptStep.env.EXPECTED_REVIEW_SHA256, '${{ steps.request.outputs.expected_review_sha256 }}');
assert.doesNotMatch(JSON.stringify(job), /openai\/codex-action|firebase deploy|gh pr merge/i, 'affiliate approval cannot call a model, deploy, or merge');

console.log(JSON.stringify({
  affiliateLinkApprovalRequestGateTests: 'passed',
  mobileOwnerIssue: 'passed',
  exactCandidateBound: true,
  exactReviewBound: true,
  mergeAuthorized: false,
  productionAuthorized: false
}, null, 2));
