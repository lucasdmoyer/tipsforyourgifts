import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parse } from 'yaml';
import { resolveAffiliateReviewHandoffs } from './lib/affiliate-review-handoff-contract.mjs';

const webRoot = process.cwd();
const workflowRoot = path.resolve(webRoot, '..', '.github', 'workflows');
const candidateId = 'affiliate-link-article-product-program-v1';
const candidatePath = `affiliate/candidates/${candidateId}.json`;
const candidateSha256 = 'a'.repeat(64);
const candidateRecord = { path: candidatePath, sha256: candidateSha256, data: { candidateId } };

assert.deepEqual(resolveAffiliateReviewHandoffs({
  changes: [{ status: 'A', path: candidatePath }],
  candidates: [candidateRecord],
  reviews: []
}), [{ candidateId, candidateSha256 }]);
assert.deepEqual(resolveAffiliateReviewHandoffs({
  changes: [{ status: 'A', path: candidatePath }],
  candidates: [candidateRecord],
  reviews: [{ data: { candidateId } }]
}), []);
assert.throws(() => resolveAffiliateReviewHandoffs({ changes: [{ status: 'M', path: candidatePath }], candidates: [candidateRecord], reviews: [] }), /immutable/);
assert.throws(() => resolveAffiliateReviewHandoffs({ changes: [{ status: 'A', path: candidatePath }], candidates: [], reviews: [] }), /missing from the validated affiliate state/);
assert.throws(() => resolveAffiliateReviewHandoffs({ changes: [{ status: 'A', path: candidatePath }, { status: 'A', path: candidatePath }], candidates: [candidateRecord], reviews: [] }), /changed more than once/);

const handoff = parse(await fs.readFile(path.join(workflowRoot, 'affiliate-review-handoff.yml'), 'utf8'));
assert.deepEqual(handoff.on?.push?.branches, ['master'], 'affiliate review handoff must observe only trusted master');
assert.deepEqual(handoff.on?.push?.paths, ['web/affiliate/candidates/*.json'], 'affiliate review handoff must observe only exact candidate records');
assert.equal(handoff.permissions?.contents, 'read', 'affiliate handoff repository access must remain read-only');
assert.equal(handoff.permissions?.actions, 'write', 'affiliate handoff needs only workflow-dispatch authority');
const handoffJob = handoff.jobs?.classify_and_launch;
assert.ok(handoffJob, 'affiliate review handoff job is missing');
assert.equal(handoffJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 0, 'affiliate handoff must be credential-free');
const resolveStep = handoffJob.steps.find((step) => step.name === 'Resolve only newly merged, hash-bound candidates');
const gateStep = handoffJob.steps.find((step) => step.name === 'Re-run every deterministic gate before review dispatch');
const dispatchStep = handoffJob.steps.find((step) => step.name === 'Dispatch each exact candidate once');
assert.ok(resolveStep && gateStep && dispatchStep, 'affiliate handoff must resolve, validate, and dispatch');
assert.match(resolveStep.run, /affiliate:link:review-handoff/, 'candidate selection must use the deterministic resolver');
assert.match(gateStep.run, /npm run validate[\s\S]*npm run build[\s\S]*npm run smoke/, 'affiliate review handoff must run full release gates');
assert.match(dispatchStep.run, /gh workflow run affiliate-link-review\.yml --ref master/, 'affiliate review must run trusted master workflow bytes');
assert.match(dispatchStep.run, /display_title[\s\S]*queued[\s\S]*in_progress[\s\S]*success/, 'affiliate review dispatch must suppress exact duplicate work');
assert.doesNotMatch(dispatchStep.run, /affiliate-link-approval|gh pr merge|firebase/i, 'review handoff cannot approve, merge, or deploy');

const review = parse(await fs.readFile(path.join(workflowRoot, 'affiliate-link-review.yml'), 'utf8'));
assert.match(review['run-name'] ?? '', /inputs\.candidate_id/, 'review run title must expose the exact candidate for idempotent dispatch');
assert.equal(review.permissions?.contents, 'read', 'affiliate evidence model must retain read-only default repository access');
assert.ok(review.jobs?.review?.steps.some((step) => step.uses === 'openai/codex-action@v1'), 'affiliate review must remain an independent model job');
assert.equal(review.jobs?.open_review_pull_request?.permissions?.contents, 'write', 'only the detached review writer may push');

console.log(JSON.stringify({
  affiliateReviewHandoffGateTests: 'passed',
  automaticHandoff: 'new_exact_candidate_to_independent_evidence_review',
  founderApprovalAutomatic: false,
  productionMutationAuthorized: false
}, null, 2));
