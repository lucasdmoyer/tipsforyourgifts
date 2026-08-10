import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { affiliateLinkReviewSchema, sha256 } from './lib/affiliate-link-contract.mjs';

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
const program = registry.programs.find((entry) => entry.id === programId);
program.revision = 2; program.status = 'enabled'; program.enabled = true; program.founderDisposition = 'approved';
program.allowedDomains = ['bookshop.org']; program.registeredSites = ['https://tipsforyourgifts.web.app/']; program.trackingParameterKeys = ['affiliate']; program.requiredDisclosure = registry.policy.defaultDisclosure;
program.account = { externalAccountEstablished: true, trackingIdentityConfigured: true, termsAcceptedByFounder: true, termsAcceptedAt: '2026-08-05T10:00:00.000Z', acceptanceEvidenceReference: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/42', reportingExportApproved: false };
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
  destination: { httpStatus: 200, resolvedUrl: candidate.destination.paidUrl, resolvedHostname: 'bookshop.org', verifiedAt: '2026-08-06T11:00:00.000Z' },
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

console.log(JSON.stringify({ affiliateLinkCommandTests: 'passed', candidateCreation: 'passed', failedReviewBlocksApproval: 'passed', cleanReviewFounderApproval: 'passed', deployed: false }, null, 2));
