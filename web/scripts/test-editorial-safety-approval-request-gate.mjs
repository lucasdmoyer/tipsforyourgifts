import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  editorialSafetyDecisionAuthorityLines,
  parseEditorialSafetyExactDecision,
  resolveEditorialSafetyDecisionIssue,
  resolveEditorialSafetyDecisionManual
} from './lib/editorial-safety-approval-request-contract.mjs';

const root = process.cwd();
const operations = JSON.parse(await fs.readFile(path.join(root, 'src', 'data', 'operations.json'), 'utf8'));
const review = operations.editorialReview.queue.find((entry) => entry.founderSafetyReviewStatus === 'approval_required');
assert.ok(review?.founderDecisionPacket, 'fixture requires one pending exact founder safety decision');

function issueFromUrl(urlValue) {
  const url = new URL(urlValue);
  return {
    title: url.searchParams.get('title'),
    body: url.searchParams.get('body').replaceAll('- [ ] ', '- [x] '),
    html_url: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/999',
    user: { login: 'lucasdmoyer' },
    author_association: 'OWNER'
  };
}

const approvedIssue = issueFromUrl(review.founderDecisionPacket.approvalIssueUrl);
const rejectedIssue = issueFromUrl(review.founderDecisionPacket.rejectionIssueUrl);
const approvedRequest = resolveEditorialSafetyDecisionIssue({ issue: approvedIssue, review });
const rejectedRequest = resolveEditorialSafetyDecisionIssue({ issue: rejectedIssue, review });
assert.equal(approvedRequest.decision, 'approved');
assert.equal(rejectedRequest.decision, 'rejected');
assert.equal(approvedRequest.confirmation, `REVIEW-${review.runId}-approved`);
assert.equal(approvedRequest.source, 'owner_issue');
for (const line of editorialSafetyDecisionAuthorityLines) assert.ok(approvedIssue.body.includes(`- [x] ${line}`));

const manual = resolveEditorialSafetyDecisionManual({
  runId: review.runId,
  decision: 'approved',
  confirmation: `REVIEW-${review.runId}-approved`,
  review
});
assert.equal(manual.source, 'workflow_dispatch');

function expectIssueFailure(label, mutate, pattern) {
  const issue = structuredClone(approvedIssue);
  const currentReview = structuredClone(review);
  mutate(issue, currentReview);
  assert.throws(() => resolveEditorialSafetyDecisionIssue({ issue, review: currentReview }), pattern, label);
}

expectIssueFailure('wrong actor rejected', (issue) => { issue.user.login = 'someone-else'; }, /repository owner/);
expectIssueFailure('wrong repository rejected', (issue) => { issue.html_url = 'https://github.com/other/repository/issues/999'; }, /canonical repository/);
expectIssueFailure('wrong title rejected', (issue) => { issue.title = `${issue.title} changed`; }, /title must be exactly/);
expectIssueFailure('unchecked authority rejected', (issue) => { issue.body = issue.body.replace('- [x] ', '- [ ] '); }, /authority check is missing/);
expectIssueFailure('duplicate exact decision rejected', (issue) => {
  const block = issue.body.match(/## Exact decision\s*\n```json\s*\n[\s\S]*?\n```/)[0];
  issue.body += `\n\n${block}`;
}, /exactly one/);
expectIssueFailure('stale run rejected', (_issue, current) => { current.sourceSha256.run = 'a'.repeat(64); }, /research run changed/);
expectIssueFailure('stale article rejected', (_issue, current) => { current.sourceSha256.article = 'b'.repeat(64); }, /article changed/);
expectIssueFailure('stale social rejected', (_issue, current) => { current.sourceSha256.social = 'c'.repeat(64); }, /social pack changed/);
expectIssueFailure('stale claims rejected', (_issue, current) => { current.highRiskClaims[0].text += ' changed'; }, /claims changed/);
expectIssueFailure('current approval rejects another decision', (_issue, current) => { current.founderSafetyReviewStatus = 'approved_current'; current.founderSafetyReviewRequired = false; }, /does not accept/);
expectIssueFailure('current rejection requires correction', (_issue, current) => { current.founderSafetyReviewStatus = 'rejected_current'; }, /does not accept/);
assert.throws(() => resolveEditorialSafetyDecisionManual({ runId: review.runId, decision: 'approved', confirmation: 'WRONG', review }), /manual confirmation/);
assert.throws(() => parseEditorialSafetyExactDecision(approvedIssue.body.replace('"schemaVersion": "1.0.0"', '"schemaVersion": "2.0.0"')), /schema version/);

for (const entry of operations.editorialReview.queue.filter((candidate) => candidate.founderDecisionPacket)) {
  for (const [decision, field] of [['approved', 'approvalIssueUrl'], ['rejected', 'rejectionIssueUrl']]) {
    const url = new URL(entry.founderDecisionPacket[field]);
    assert.equal(url.hostname, 'github.com');
    assert.equal(url.pathname, '/lucasdmoyer/tipsforyourgifts/issues/new');
    const exact = parseEditorialSafetyExactDecision(url.searchParams.get('body'));
    assert.equal(exact.runId, entry.runId);
    assert.equal(exact.decision, decision);
  }
}

const workflow = await fs.readFile(path.resolve(root, '..', '.github', 'workflows', 'editorial-safety-approval.yml'), 'utf8');
assert.match(workflow, /issues:\s*\n\s+types: \[opened, reopened\]/);
assert.match(workflow, /issues: read/);
assert.match(workflow, /github\.event\.issue\.user\.login == 'lucasdmoyer'/);
assert.match(workflow, /github\.event\.issue\.author_association == 'OWNER'/);
assert.match(workflow, /startsWith\(github\.event\.issue\.title, '\[Editorial Safety Decision\] '\)/);
assert.match(workflow, /resolve-editorial-safety-approval-request\.mjs --root=web --request-path=/);
assert.match(workflow, /RUN_ID: \$\{\{ steps\.request\.outputs\.run_id \}\}/);
assert.match(workflow, /DECISION: \$\{\{ steps\.request\.outputs\.decision \}\}/);
assert.match(workflow, /environment: editorial-safety-approval/);
assert.doesNotMatch(workflow, /firebase (?:deploy|hosting:channel:deploy)|google-github-actions\/auth|OPENAI_API_KEY/);

console.log(JSON.stringify({
  editorialSafetyApprovalRequestGateTests: 'passed',
  mobileOwnerIssue: 'passed',
  decisionPackets: operations.editorialReview.queue.filter((entry) => entry.founderDecisionPacket).length * 2,
  negativeChecks: 13,
  workflowSafetyChecks: 10,
  independentQaStillRequired: true,
  productionAuthorized: false
}, null, 2));
