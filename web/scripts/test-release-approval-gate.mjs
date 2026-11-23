import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseReleaseApproval, summarizeReleaseApprovals } from './lib/release-approval-contract.mjs';

const root = process.cwd();
const relativePath = 'releases/approvals/pr-104-7b2cdda.json';
const raw = await fs.readFile(path.join(root, relativePath));
const base = parseReleaseApproval(JSON.parse(raw.toString('utf8')));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'public', 'publication-manifest.json'), 'utf8'));
const clone = (value) => structuredClone(value);

function expectFailure(label, mutate) {
  const candidate = clone(base);
  mutate(candidate);
  assert.throws(() => parseReleaseApproval(candidate), undefined, label);
}

expectFailure('approval ID must bind exact PR head', (record) => { record.approvalId = 'release-approval-pr-104-0000000'; });
expectFailure('repository cannot drift', (record) => { record.repository = 'someone/else'; });
expectFailure('PR URL must bind PR number', (record) => { record.pullRequest.url = 'https://github.com/lucasdmoyer/tipsforyourgifts/pull/105'; });
expectFailure('approval source must bind exact comment', (record) => { record.approval.source.commentId = '1'; });
expectFailure('approval source body must be hash-bound', (record) => { record.approval.source.bodySha256 = 'not-a-hash'; });
expectFailure('manifest ID must bind content set', (record) => { record.candidate.publicationManifestId = 'publication-set-0000000000000000'; });
expectFailure('hosted smoke must cover all articles', (record) => { record.previewReview.hostedSmoke.articles -= 1; });
expectFailure('preview must remain on Firebase Hosting', (record) => { record.previewReview.url = 'https://example.com/'; });
expectFailure('merge authority cannot expand to production', (record) => { record.authority.allowed = ['firebase_production_deployment']; });
expectFailure('production exclusion cannot disappear', (record) => { record.authority.excluded = record.authority.excluded.filter((item) => item !== 'firebase_production_deployment'); });
expectFailure('exclusions cannot be duplicated', (record) => { record.authority.excluded[0] = record.authority.excluded[1]; });
expectFailure('approval cannot be observed before issue', (record) => { record.approval.source.observedAt = '2026-11-23T20:00:00.000Z'; });
expectFailure('unexpected fields fail closed', (record) => { record.productionApproved = true; });

const record = { path: relativePath, sha256: createHash('sha256').update(raw).digest('hex'), data: base };
const summary = summarizeReleaseApprovals([record], manifest);
assert.equal(summary.currentContentSetApprovedRelease?.approvalId, base.approvalId);
assert.equal(summary.currentContentSetApprovedRelease?.headSha, base.pullRequest.headSha);

const otherManifest = clone(manifest);
otherManifest.contentSetSha256 = 'f'.repeat(64);
assert.equal(summarizeReleaseApprovals([record], otherManifest).currentContentSetApprovedRelease, null, 'approval must not transfer to another content set');

console.log(JSON.stringify({
  releaseApprovalGateTests: 'passed',
  negativeChecks: 13,
  exactApprovalId: base.approvalId,
  transferToDifferentContentSet: 'rejected'
}, null, 2));
