import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { affiliateLinkReviewSchema, loadAffiliateLinkState, sha256 } from './lib/affiliate-link-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(scriptRoot, '..');
const articleSlug = 'read-it-then-play-it-gift-pairs';
const productId = 'sapiens-us-paperback';
const programId = 'bookshop-org-us-media';
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-affiliate-link-command-'));
for (const relative of ['config', 'src/data/blog', 'research/runs', 'research/reviews', 'scripts']) await fs.mkdir(path.join(root, relative), { recursive: true });
await fs.cp(path.join(webRoot, 'src', 'data', 'blog'), path.join(root, 'src', 'data', 'blog'), { recursive: true });
await fs.cp(path.join(webRoot, 'research', 'runs'), path.join(root, 'research', 'runs'), { recursive: true });
await fs.cp(path.join(webRoot, 'research', 'reviews'), path.join(root, 'research', 'reviews'), { recursive: true });
await fs.symlink(path.join(webRoot, 'node_modules'), path.join(root, 'node_modules'));
await fs.cp(path.join(webRoot, 'scripts'), path.join(root, 'scripts'), { recursive: true });
const registry = JSON.parse(await fs.readFile(path.join(webRoot, 'config', 'affiliate-programs.json'), 'utf8'));
for (const entry of registry.programs) {
  entry.sourceCheckedAt = '2026-08-05T09:00:00.000Z';
  entry.sourceReviewExpiresAt = '2026-11-03';
}
const program = registry.programs.find((entry) => entry.id === programId);
program.revision = 2; program.status = 'enabled'; program.enabled = true; program.founderDisposition = 'approved';
program.allowedDomains = ['bookshop.org']; program.registeredSites = ['https://tipsforyourgifts.web.app/']; program.trackingParameterKeys = ['affiliate']; program.requiredDisclosure = registry.policy.defaultDisclosure;
program.account = { externalAccountEstablished: true, trackingIdentityConfigured: true, verificationStatus: 'verified', verificationObservedAt: '2026-08-05T09:30:00.000Z', publicTrackingIdentity: '129750', publicStorefrontUrl: 'https://bookshop.org/shop/tipsforyourgifts', weeklyReportsEnabled: true, termsAcceptedByFounder: true, termsAcceptedAt: '2026-08-05T10:00:00.000Z', acceptanceEvidenceReference: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/42', reportingExportApproved: false };
registry.updatedAt = '2026-08-05T10:00:00.000Z';
await fs.writeFile(path.join(root, 'config', 'affiliate-programs.json'), `${JSON.stringify(registry, null, 2)}\n`);
const articleRaw = await fs.readFile(path.join(root, 'src', 'data', 'blog', `${articleSlug}.md`));
const candidateId = `affiliate-link-${articleSlug}-${productId}-${programId}-v1`;
const candidateArgs = [
  path.join(root, 'scripts', 'create-affiliate-link-candidate.mjs'),
  `--article-slug=${articleSlug}`,
  `--product-id=${productId}`,
  `--program-id=${programId}`,
  '--expected-program-revision=2',
  '--candidate-revision=1',
  `--expected-article-sha256=${sha256(articleRaw)}`,
  '--paid-url=https://bookshop.org/p/books/sapiens/123?affiliate=test-fixture-only',
  '--product-identity-evidence-url=https://www.harpercollins.com/products/sapiens-yuval-noah-harari',
  '--created-by=lucasdmoyer',
  `--confirmation=CANDIDATE-${candidateId}`
];
await execFileAsync(process.execPath, candidateArgs, { cwd: root });
const candidatePath = path.join(root, 'affiliate', 'candidates', `${candidateId}.json`);
const candidateRaw = await fs.readFile(candidatePath);
const candidate = JSON.parse(candidateRaw);
assert.equal(candidate.source.articleSha256, sha256(articleRaw));
assert.equal(candidate.assertions.editorialRankUnchanged, true);
assert.deepEqual(candidate.origin, { source: 'founder_supplied', referenceId: null, sourceArtifactPath: null, sourceSha256: null });

const batchInputPath = path.join(root, 'bookshop-official-export-fixture.json');
const batchInput = {
  schemaVersion: '1.0.0',
  exportId: 'bookshop-official-export-fixture-1',
  source: 'founder_attested_partner_export',
  exportedAt: '2026-08-06T10:30:00.000Z',
  programId,
  expectedProgramRevision: 2,
  records: [
    {
      articleSlug,
      productId: 'genius-of-birds-paperback',
      candidateRevision: 1,
      expectedArticleSha256: sha256(articleRaw),
      paidUrl: 'https://bookshop.org/p/books/the-genius-of-birds/456?affiliate=test-fixture-only',
      productIdentityEvidenceUrl: 'https://www.penguinrandomhouse.com/books/312321/the-genius-of-birds-by-jennifer-ackerman/'
    },
    {
      articleSlug,
      productId: 'a-city-on-mars-paperback',
      candidateRevision: 1,
      expectedArticleSha256: sha256(articleRaw),
      paidUrl: 'https://bookshop.org/p/books/a-city-on-mars/789?affiliate=test-fixture-only',
      productIdentityEvidenceUrl: 'https://www.penguinrandomhouse.com/books/639449/a-city-on-mars-by-kelly-and-zach-weinersmith/'
    }
  ]
};
await execFileAsync(process.execPath, [path.join(root, 'scripts', 'prepare-affiliate-link-batch.mjs')], {
  cwd: root,
  env: {
    ...process.env,
    AFFILIATE_BATCH_JSON: JSON.stringify(batchInput, null, 2),
    AFFILIATE_BATCH_INPUT_PATH: batchInputPath
  }
});
const batchRaw = await fs.readFile(batchInputPath);
const batchArgs = [
  path.join(root, 'scripts', 'create-affiliate-link-batch.mjs'),
  `--input=${batchInputPath}`,
  '--founder-login=lucasdmoyer',
  `--confirmation=IMPORT-${batchInput.exportId}-${sha256(batchRaw)}`
];
await execFileAsync(process.execPath, batchArgs, { cwd: root });
const batchCandidateRecords = new Map();
for (const record of batchInput.records) {
  const batchCandidateId = `affiliate-link-${record.articleSlug}-${record.productId}-${programId}-v${record.candidateRevision}`;
  const batchCandidatePath = path.join(root, 'affiliate', 'candidates', `${batchCandidateId}.json`);
  const batchCandidateRaw = await fs.readFile(batchCandidatePath);
  const batchCandidate = JSON.parse(batchCandidateRaw);
  assert.equal(batchCandidate.createdBy, 'lucasdmoyer');
  assert.deepEqual(batchCandidate.origin, {
    source: 'founder_attested_partner_export',
    referenceId: batchInput.exportId,
    sourceArtifactPath: `affiliate/source-artifacts/${batchInput.exportId}.json`,
    sourceSha256: sha256(batchRaw)
  });
  batchCandidateRecords.set(batchCandidateId, { path: batchCandidatePath, raw: batchCandidateRaw });
}
assert.equal(batchCandidateRecords.size, batchInput.records.length, 'every batch record must create a candidate');
assert.deepEqual(await fs.readFile(path.join(root, 'affiliate', 'source-artifacts', `${batchInput.exportId}.json`)), batchRaw, 'the exact credential-free source artifact must be preserved');
const batchManifestPath = path.join(root, 'affiliate', 'batches', `${batchInput.exportId}.json`);
const batchManifestRaw = await fs.readFile(batchManifestPath);
const batchManifest = JSON.parse(batchManifestRaw);
assert.deepEqual(batchManifest.candidateIds, [...batchCandidateRecords.keys()]);

await execFileAsync(process.execPath, batchArgs, { cwd: root });
for (const record of batchCandidateRecords.values()) assert.deepEqual(await fs.readFile(record.path), record.raw, 'idempotent rerun must leave candidate bytes unchanged');
assert.deepEqual(await fs.readFile(batchManifestPath), batchManifestRaw, 'idempotent rerun must leave the completion manifest unchanged');

const interruptedCandidate = [...batchCandidateRecords.values()][1];
await fs.unlink(interruptedCandidate.path);
await fs.unlink(batchManifestPath);
await execFileAsync(process.execPath, batchArgs, { cwd: root });
assert.deepEqual(await fs.readFile(interruptedCandidate.path), interruptedCandidate.raw, 'rerun must recover a candidate missing before the completion marker');
assert.deepEqual(await fs.readFile(batchManifestPath), batchManifestRaw, 'rerun must restore the exact completion manifest');

const truncatedBatchManifest = structuredClone(batchManifest);
const omittedCandidateId = truncatedBatchManifest.candidateIds.pop();
delete truncatedBatchManifest.candidateSha256[omittedCandidateId];
await fs.writeFile(batchManifestPath, `${JSON.stringify(truncatedBatchManifest, null, 2)}\n`);
await assert.rejects(() => loadAffiliateLinkState(root, { asOfDate: '2026-08-10' }), /exact source-artifact candidate set/);
await fs.writeFile(batchManifestPath, batchManifestRaw);

const wrongProgramBatchManifest = { ...batchManifest, programId: 'wrong-program' };
await fs.writeFile(batchManifestPath, `${JSON.stringify(wrongProgramBatchManifest, null, 2)}\n`);
await assert.rejects(() => loadAffiliateLinkState(root, { asOfDate: '2026-08-10' }), /batch program binding/);
await fs.writeFile(batchManifestPath, batchManifestRaw);

const failedReviewArgs = [
  path.join(root, 'scripts', 'review-affiliate-link.mjs'),
  `--candidate-id=${candidateId}`,
  `--expected-candidate-sha256=${sha256(candidateRaw)}`,
  '--reviewer-id=evidence-red-team-123',
  '--verdict=failed',
  '--blocker=The destination product identity could not be independently confirmed.'
];
await execFileAsync(process.execPath, failedReviewArgs, { cwd: root });
const failedReview = JSON.parse(await fs.readFile(path.join(root, 'affiliate', 'reviews', `${candidateId}-review.json`), 'utf8'));
const failedReviewRaw = await fs.readFile(path.join(root, 'affiliate', 'reviews', `${candidateId}-review.json`));
assert.equal(failedReview.verdict, 'failed');
await assert.rejects(() => execFileAsync(process.execPath, [
  path.join(root, 'scripts', 'approve-affiliate-link.mjs'),
  `--candidate-id=${candidateId}`,
  `--expected-candidate-sha256=${sha256(candidateRaw)}`,
  `--expected-review-sha256=${sha256(failedReviewRaw)}`,
  '--founder-login=lucasdmoyer',
  `--confirmation=APPROVE-${candidateId}`
], { cwd: root }), /clean independent review/);

await fs.rm(path.join(root, 'affiliate', 'reviews', `${candidateId}-review.json`));
const passedReview = affiliateLinkReviewSchema.parse({
  ...failedReview,
  verdict: 'passed',
  destination: { observationMethod: 'automated_fetch', httpStatus: 200, resolvedUrl: candidate.destination.paidUrl, resolvedHostname: 'bookshop.org', verifiedAt: '2026-08-06T11:00:00.000Z' },
  availability: { status: 'available_for_purchase', observedAt: '2026-08-06T11:00:00.000Z', purchaseActionLabel: 'Add to cart', evidenceUrl: candidate.destination.paidUrl },
  checks: Object.fromEntries(Object.keys(failedReview.checks).map((key) => [key, true])),
  blockers: []
});
const passedReviewPath = path.join(root, 'affiliate', 'reviews', `${candidateId}-review.json`);
await fs.writeFile(passedReviewPath, `${JSON.stringify(passedReview, null, 2)}\n`);
const passedReviewRaw = await fs.readFile(passedReviewPath);
await execFileAsync(process.execPath, [
  path.join(root, 'scripts', 'approve-affiliate-link.mjs'),
  `--candidate-id=${candidateId}`,
  `--expected-candidate-sha256=${sha256(candidateRaw)}`,
  `--expected-review-sha256=${sha256(passedReviewRaw)}`,
  '--founder-login=lucasdmoyer',
  `--confirmation=APPROVE-${candidateId}`
], { cwd: root });
const approval = JSON.parse(await fs.readFile(path.join(root, 'affiliate', 'approvals', `${candidateId}-approval.json`), 'utf8'));
assert.equal(approval.assertions.productionDeploymentAuthorized, false);

console.log(JSON.stringify({ affiliateLinkCommandTests: 'passed', candidateCreation: 'passed', founderAttestedPartnerBatchImport: 'passed', completeBatchManifest: 'passed', exactSetBinding: 'passed', programBinding: 'passed', idempotentRecovery: 'passed', failedReviewBlocksApproval: 'passed', cleanReviewFounderApproval: 'passed', deployed: false }, null, 2));
