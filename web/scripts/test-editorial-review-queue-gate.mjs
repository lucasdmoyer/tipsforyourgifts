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

console.log(JSON.stringify({ editorialReviewQueueGateTests: 'passed', negativeChecks: 6, pendingBundles: queue.counts.pendingBundles, highRiskClaims: queue.counts.highRiskClaims }, null, 2));
