import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parse as parseYaml } from 'yaml';
import {
  buildSocialCreativePrompt,
  isSocialCreativePostEligible,
  loadSocialCreativeTarget,
  routeSocialCreativeResult,
  socialCreativeFailureSchema,
  socialCreativeReviewModelOutputSchema
} from './lib/social-creative-production-contract.mjs';

const root = process.cwd();
const mixedPlatforms = [
  { id: 'unsupported-first', platform: 'tiktok', status: 'draft' },
  { id: 'supported-second', platform: 'pinterest', status: 'draft' }
];
assert.equal(mixedPlatforms.find((post) => isSocialCreativePostEligible({ post }))?.id, 'supported-second');
assert.equal(isSocialCreativePostEligible({ post: mixedPlatforms[1], hasCandidate: true }), false);
const target = await loadSocialCreativeTarget(root, { postId: 'pair-or-pile-diagnostic' });
assert.equal(target.post.id, 'pair-or-pile-diagnostic');
assert.equal(target.candidateId, 'pair-or-pile-diagnostic-v1');
assert.match(buildSocialCreativePrompt({ target }), /unapproved creative candidate/);
assert.match(buildSocialCreativePrompt({ target }), /Do not reproduce logos/);
await assert.rejects(() => loadSocialCreativeTarget(root, { postId: 'read-play-disagree' }), /no eligible static social post/);

assert.deepEqual(routeSocialCreativeResult({ productionOutcome: 'failed', productionFailureCode: 'production-bundle-invalid' }), { route: 'failure', stage: 'production', reasonCode: 'production-bundle-invalid' });
assert.deepEqual(routeSocialCreativeResult({ productionOutcome: 'ready', reviewOutcome: 'failed', reviewFailureCode: 'review-findings-invalid' }), { route: 'failure', stage: 'independent-review', reasonCode: 'review-findings-invalid' });
assert.deepEqual(routeSocialCreativeResult({ productionOutcome: 'ready', reviewOutcome: 'ready', reviewVerdict: 'failed' }), { route: 'failure', stage: 'independent-review', reasonCode: 'review-verdict-failed' });
assert.deepEqual(routeSocialCreativeResult({ productionOutcome: 'ready', reviewOutcome: 'ready', reviewVerdict: 'passed' }), { route: 'candidate' });

assert.throws(() => socialCreativeReviewModelOutputSchema.parse({
  schemaVersion: '1.0.0', candidateId: target.candidateId, verdict: 'passed',
  checks: { briefFidelity: true, sourcePostAccuracy: true, textAndWatermarkFree: true, noThirdPartyLogos: true, noMerchantImagery: true, noUnsupportedProductClaims: false, anatomyAndObjectCoherence: true, mobileLegibility: true, safeDepiction: true },
  blockers: [], warnings: []
}), /pass cannot retain failed checks/);
assert.throws(() => socialCreativeFailureSchema.parse({
  schemaVersion: '1.0.0', failureId: 'bad', candidateId: target.candidateId, packId: target.pack.packId, postId: target.post.id,
  packSha256: target.packRecord.sha256, postSha256: target.postSha256, stage: 'production', reasonCode: 'production-step-failed', workflowRunId: '1', workflowRunAttempt: 1,
  failedAt: new Date().toISOString(), sourcePromoted: true, mediaApproved: false, contentApproved: false, externalPostCreated: false, nextGate: 'Correct this exact bounded failure before another isolated attempt can run safely.'
}), /Invalid input: expected false/);

const workflowRaw = await fs.readFile(path.join(root, '..', '.github', 'workflows', 'social-creative-production.yml'), 'utf8');
const workflow = parseYaml(workflowRaw);
assert.ok(workflow.jobs.produce && workflow.jobs.independent_review && workflow.jobs.detached_writer);
assert.equal(workflow.jobs.produce.permissions.contents, 'read');
assert.equal(workflow.jobs.independent_review.permissions.contents, 'read');
assert.equal(workflow.jobs.detached_writer.permissions.contents, 'write');
assert.doesNotMatch(JSON.stringify(workflow.jobs.detached_writer), /OPENAI_API_KEY/);
assert.doesNotMatch(workflowRaw, /firebase deploy|social:pinterest:plan|PINTEREST_ACCESS_TOKEN/);
assert.match(workflowRaw, /Record only a bounded credential-free failure receipt/);
assert.match(workflowRaw, /mediaApproved: false|approved no media/);
assert.match(workflowRaw, /externalPostCreated: false|created no external post/);
assert.match(workflowRaw, /social\/failures/);

const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
for (const command of ['social:creative:target', 'social:creative:produce', 'social:creative:review', 'social:creative:finalize', 'social:creative:failure:record']) assert.ok(packageJson.scripts[command]);

console.log(JSON.stringify({
  socialCreativeProductionGateTests: 'passed',
  eligibleTargetResolution: 'passed',
  existingCandidateRefusal: 'passed',
  independentReviewSeparation: 'passed',
  failedOrMalformedOutputRoutesToReceiptOnly: true,
  mediaApprovalCreated: false,
  contentApprovalCreated: false,
  externalPostCreated: false
}, null, 2));
