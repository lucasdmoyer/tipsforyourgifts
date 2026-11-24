import assert from 'node:assert/strict';
import { buildEditorialReviewQueue, parseEditorialReviewQueue } from './lib/editorial-review-queue-contract.mjs';

const sha = (character) => character.repeat(64);
const fixture = {
  run: {
    runId: '20261010-editorial-review-ab12cd34',
    ideaId: 'founder-idea-999',
    status: 'qa_failed',
    article: { slug: 'sample-gift-guide' },
    claims: [{ id: 'claim-safety-boundary', text: 'Keep the small parts away from children and follow the complete current label.', risk: 'high', sourceIds: ['src-official-label'] }],
    qa: {
      reviewerId: 'independent-editor-fixture',
      blockers: ['Founder review is required for the exact reader-facing safety wording.'],
      warnings: ['Recheck the current product label immediately before publication.']
    }
  },
  runPath: 'research/runs/20261010-editorial-review-ab12cd34.json',
  runSha256: sha('a'),
  articlePath: 'src/data/blog/sample-gift-guide.md',
  articleSha256: sha('b'),
  socialPath: 'social/drafts/sample-gift-guide-launch.json',
  socialSha256: sha('c'),
  safetyApproval: null
};

const queue = buildEditorialReviewQueue([fixture]);
assert.equal(queue.counts.pendingBundles, 1);
assert.equal(queue.counts.founderSafetyReviewsRequired, 1);
assert.equal(queue.counts.founderSafetyApprovalsCurrent, 0);
assert.equal(queue.counts.independentReviewsRequired, 1);
assert.equal(queue.counts.highRiskClaims, 1);
assert.equal(queue.queue[0].founderSafetyReviewRequired, true);
assert.equal(queue.queue[0].independentReviewRequired, true);
assert.equal(queue.queue[0].sourceSha256.article, sha('b'));
assert.equal(queue.queue[0].founderSafetyReviewStatus, 'approval_required');
assert.equal(queue.queue[0].failedReview, null);
assert.equal(queue.queue[0].founderDecisionPacket.approveCommand, 'gh workflow run editorial-safety-approval.yml -f run_id=20261010-editorial-review-ab12cd34 -f decision=approved -f confirmation=REVIEW-20261010-editorial-review-ab12cd34-approved');
assert.equal(queue.queue[0].founderDecisionPacket.rejectCommand, 'gh workflow run editorial-safety-approval.yml -f run_id=20261010-editorial-review-ab12cd34 -f decision=rejected -f confirmation=REVIEW-20261010-editorial-review-ab12cd34-rejected');
assert.equal(new URL(queue.queue[0].founderDecisionPacket.approvalIssueUrl).searchParams.get('title'), '[Editorial Safety Decision] 20261010-editorial-review-ab12cd34 approved');
assert.equal(new URL(queue.queue[0].founderDecisionPacket.rejectionIssueUrl).searchParams.get('title'), '[Editorial Safety Decision] 20261010-editorial-review-ab12cd34 rejected');

const approvedQueue = buildEditorialReviewQueue([{ ...fixture, safetyApproval: {
  status: 'approved_current',
  revision: 1,
  decision: 'approved',
  reviewedAt: '2026-11-22T12:00:00.000Z',
  path: 'research/safety-approvals/20261010-editorial-review-ab12cd34.founder-safety.v1.json',
  sha256: sha('d')
} }]);
assert.equal(approvedQueue.counts.founderSafetyReviewsRequired, 0);
assert.equal(approvedQueue.counts.founderSafetyApprovalsCurrent, 1);
assert.equal(approvedQueue.queue[0].founderSafetyReviewRequired, false);

const failedQueue = buildEditorialReviewQueue([{ ...fixture, qaFailureHandoff: {
  missionId: 'research-mission-12345-1',
  failedAt: '2026-11-23T18:00:00.000Z',
  workflowRunId: '12345',
  reviewReceiptPath: 'research/reviews/20261010-editorial-review-ab12cd34.qa.v1.json',
  reviewReceiptSha256: sha('e'),
  reviewerId: 'evidence-red-team-12345',
  reviewedAt: '2026-11-23T17:59:00.000Z',
  blockers: ['The exact product evidence does not support the central recipient-fit claim.'],
  warnings: ['Keep the article draft-only until the evidence gap is resolved.']
} }]);
assert.equal(failedQueue.queue[0].status, 'qa_failed');
assert.equal(failedQueue.queue[0].failedReview?.missionId, 'research-mission-12345-1');
assert.match(failedQueue.queue[0].failedReview?.correctionPullRequestSearchUrl ?? '', /content-research-mission-12345-1/);
assert.equal(failedQueue.queue[0].blockers[0], 'The exact product evidence does not support the central recipient-fit claim.');

function expectFailure(label, mutate) {
  const candidate = structuredClone(queue);
  mutate(candidate);
  assert.throws(() => parseEditorialReviewQueue(candidate), undefined, label);
}

expectFailure('counts cannot drift from the queue', (candidate) => { candidate.counts.pendingBundles = 0; });
expectFailure('high-risk claims cannot bypass founder review', (candidate) => { candidate.queue[0].founderSafetyReviewRequired = false; });
expectFailure('social path and digest must move together', (candidate) => { candidate.queue[0].sourceSha256.social = null; });
expectFailure('source identity must use sha256', (candidate) => { candidate.queue[0].sourceSha256.run = 'not-a-digest'; });
expectFailure('independent review remains mandatory', (candidate) => { candidate.queue[0].independentReviewRequired = false; });
expectFailure('approval status requires a matching receipt', (candidate) => { candidate.queue[0].founderSafetyReviewStatus = 'approved_current'; candidate.queue[0].founderSafetyReviewRequired = false; });
expectFailure('founder approval command cannot drift from the run ID', (candidate) => { candidate.queue[0].founderDecisionPacket.approveCommand = candidate.queue[0].founderDecisionPacket.approveCommand.replace('ab12cd34', 'deadbeef'); });
expectFailure('phone approval packet cannot drift from the current article', (candidate) => { candidate.queue[0].founderDecisionPacket.approvalIssueUrl = candidate.queue[0].founderDecisionPacket.approvalIssueUrl.replaceAll(sha('b'), sha('d')); });
expectFailure('high-risk claims cannot omit the founder decision packet', (candidate) => { candidate.queue[0].founderDecisionPacket = null; });

console.log(JSON.stringify({ editorialReviewQueueGateTests: 'passed', negativeChecks: 9, pendingBundles: queue.counts.pendingBundles, highRiskClaims: queue.counts.highRiskClaims, failedQaCorrectionPackets: failedQueue.queue.filter((entry) => entry.failedReview !== null).length, executiveActionPackets: queue.queue.filter((entry) => entry.founderDecisionPacket !== null).length }, null, 2));
