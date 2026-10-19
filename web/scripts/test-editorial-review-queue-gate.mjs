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
  socialSha256: sha('c')
};

const queue = buildEditorialReviewQueue([fixture]);
assert.equal(queue.counts.pendingBundles, 1);
assert.equal(queue.counts.founderSafetyReviewsRequired, 1);
assert.equal(queue.counts.founderSafetyClassificationsPending, 0);
assert.equal(queue.counts.founderSafetyApprovalsPending, 1);
assert.equal(queue.counts.founderSafetyApprovalsRecorded, 0);
assert.equal(queue.counts.independentReviewsRequired, 1);
assert.equal(queue.counts.highRiskClaims, 1);
assert.equal(queue.queue[0].founderSafetyReviewRequired, true);
assert.equal(queue.queue[0].founderSafetyReviewStatus, 'approval_required');
assert.equal(queue.queue[0].independentReviewRequired, true);
assert.equal(queue.queue[0].highRiskClaimIds, 'claim-safety-boundary');
assert.equal(queue.queue[0].sourceSha256.article, sha('b'));

const approvedQueue = buildEditorialReviewQueue([{ ...fixture, founderSafetyApproval: { path: `research/founder-safety-reviews/${fixture.run.runId}.founder.v1.json`, sha256: sha('d') } }]);
assert.equal(approvedQueue.counts.founderSafetyApprovalsPending, 0);
assert.equal(approvedQueue.counts.founderSafetyApprovalsRecorded, 1);
assert.equal(approvedQueue.queue[0].founderSafetyReviewStatus, 'approved');
assert.equal(approvedQueue.queue[0].founderSafetyApprovalSha256, sha('d'));

const unclassifiedFixture = structuredClone(fixture);
unclassifiedFixture.run.claims[0].risk = 'low';
unclassifiedFixture.run.qa.blockers = ['Safety wording needs exact claim classification before founder review.'];
const unclassifiedQueue = buildEditorialReviewQueue([unclassifiedFixture]);
assert.equal(unclassifiedQueue.counts.founderSafetyReviewsRequired, 0);
assert.equal(unclassifiedQueue.counts.founderSafetyClassificationsPending, 1);
assert.equal(unclassifiedQueue.queue[0].founderSafetyReviewStatus, 'classification_required');
assert.equal(unclassifiedQueue.queue[0].highRiskClaimIds, '');

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
expectFailure('approval status requires receipt identity', (candidate) => { candidate.queue[0].founderSafetyReviewStatus = 'approved'; });

console.log(JSON.stringify({ editorialReviewQueueGateTests: 'passed', negativeChecks: 6, pendingBundles: queue.counts.pendingBundles, highRiskClaims: queue.counts.highRiskClaims, founderSafetyApprovalsPending: queue.counts.founderSafetyApprovalsPending, approvedReceiptTransition: 'passed', unclassifiedSafetyBlockerTransition: 'passed' }, null, 2));
