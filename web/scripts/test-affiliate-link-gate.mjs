import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { applyAffiliateLinkOverlays, buildCandidateFromRepository, loadAffiliateLinkState, sha256 } from './lib/affiliate-link-contract.mjs';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(scriptRoot, '..');
const articleSlug = 'read-it-then-play-it-gift-pairs';
const productId = 'sapiens-us-paperback';
const programId = 'bookshop-org-us-media';

async function makeFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-affiliate-link-gate-'));
  for (const relative of ['config', 'src/data/blog', 'research/runs', 'research/reviews']) {
    await fs.mkdir(path.join(root, relative), { recursive: true });
  }
  await fs.cp(path.join(webRoot, 'src', 'data', 'blog'), path.join(root, 'src', 'data', 'blog'), { recursive: true });
  await fs.cp(path.join(webRoot, 'research', 'runs'), path.join(root, 'research', 'runs'), { recursive: true });
  await fs.cp(path.join(webRoot, 'research', 'reviews'), path.join(root, 'research', 'reviews'), { recursive: true });
  const registry = JSON.parse(await fs.readFile(path.join(webRoot, 'config', 'affiliate-programs.json'), 'utf8'));
  const program = registry.programs.find((entry) => entry.id === programId);
  program.revision = 2;
  program.status = 'enabled';
  program.enabled = true;
  program.founderDisposition = 'approved';
  program.allowedDomains = ['bookshop.org'];
  program.registeredSites = ['https://tipsforyourgifts.web.app/'];
  program.trackingParameterKeys = ['affiliate'];
  program.requiredDisclosure = registry.policy.defaultDisclosure;
  program.account = {
    externalAccountEstablished: true,
    trackingIdentityConfigured: true,
    termsAcceptedByFounder: true,
    termsAcceptedAt: '2026-08-05T10:00:00.000Z',
    acceptanceEvidenceReference: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/42',
    reportingExportApproved: false
  };
  registry.updatedAt = '2026-08-05T10:00:00.000Z';
  await fs.writeFile(path.join(root, 'config', 'affiliate-programs.json'), `${JSON.stringify(registry, null, 2)}\n`);
  return root;
}

async function candidateFor(root, overrides = {}) {
  const articleRaw = await fs.readFile(path.join(root, 'src', 'data', 'blog', `${articleSlug}.md`));
  return buildCandidateFromRepository(root, {
    articleSlug,
    productId,
    programId,
    expectedProgramRevision: 2,
    candidateRevision: 1,
    expectedArticleSha256: sha256(articleRaw),
    paidUrl: 'https://bookshop.org/p/books/sapiens/123?affiliate=test-fixture-only',
    productIdentityEvidenceUrl: 'https://www.harpercollins.com/products/sapiens-yuval-noah-harari',
    createdBy: 'lucasdmoyer',
    createdAt: '2026-08-06T10:00:00.000Z',
    ...overrides
  });
}

async function writeJson(root, relative, value) {
  const target = path.join(root, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
  return fs.readFile(target);
}

async function addReviewAndApproval(root, candidate, overrides = {}) {
  const candidateRaw = await writeJson(root, `affiliate/candidates/${candidate.candidateId}.json`, candidate);
  const review = {
    schemaVersion: '1.0.0',
    reviewId: `${candidate.candidateId}-review`,
    candidateId: candidate.candidateId,
    candidatePath: `affiliate/candidates/${candidate.candidateId}.json`,
    candidateSha256: sha256(candidateRaw),
    reviewerId: 'evidence-red-team-123',
    reviewedAt: '2026-08-06T11:00:00.000Z',
    verdict: 'passed',
    destination: {
      httpStatus: 200,
      resolvedUrl: candidate.destination.paidUrl,
      resolvedHostname: candidate.destination.hostname,
      verifiedAt: '2026-08-06T11:00:00.000Z'
    },
    productIdentityEvidenceUrl: candidate.destination.productIdentityEvidenceUrl,
    checks: {
      candidateHashBound: true,
      programEnabledAtReview: true,
      articleSourceBound: true,
      productIdentityMatched: true,
      destinationHttps: true,
      finalDomainAllowed: true,
      trackingKeysApproved: true,
      trackingPreserved: true,
      editorialRankingUntouched: true,
      disclosureWillRender: true,
      recommendationWorksWithoutPaidLink: true,
      noPriceOrAvailabilityClaimAdded: true
    },
    blockers: [],
    ...overrides.review
  };
  const reviewRaw = await writeJson(root, `affiliate/reviews/${review.reviewId}.json`, review);
  const approval = {
    schemaVersion: '1.0.0',
    approvalId: `${candidate.candidateId}-approval`,
    candidateId: candidate.candidateId,
    candidatePath: `affiliate/candidates/${candidate.candidateId}.json`,
    candidateSha256: sha256(candidateRaw),
    reviewPath: `affiliate/reviews/${review.reviewId}.json`,
    reviewSha256: sha256(reviewRaw),
    founderLogin: 'lucasdmoyer',
    approvedAt: '2026-08-06T12:00:00.000Z',
    confirmation: `APPROVE-${candidate.candidateId}`,
    status: 'approved',
    assertions: {
      exactPaidDestinationApproved: true,
      affiliateDisclosureRequired: true,
      editorialRankingUnchanged: true,
      firebasePreviewRequiredBeforeRelease: true,
      productionDeploymentAuthorized: false
    },
    ...overrides.approval
  };
  await writeJson(root, `affiliate/approvals/${approval.approvalId}.json`, approval);
  return { review, approval };
}

const cleanRoot = await makeFixture();
const cleanCandidate = await candidateFor(cleanRoot);
await addReviewAndApproval(cleanRoot, cleanCandidate);
const cleanState = await loadAffiliateLinkState(cleanRoot, { asOfDate: '2026-08-10' });
assert.equal(cleanState.counts.activeOverlays, 1);
const sourceArticle = { slug: articleSlug, affiliateDisclosure: false, products: [{ id: productId, url: cleanCandidate.source.ordinaryUrl, affiliate: false }] };
const renderedArticle = applyAffiliateLinkOverlays(sourceArticle, cleanState);
assert.equal(sourceArticle.products[0].affiliate, false, 'source article must remain ordinary');
assert.equal(renderedArticle.products[0].affiliate, true);
assert.equal(renderedArticle.products[0].affiliateProgram, programId);
assert.equal(renderedArticle.affiliateDisclosure, true);

const pendingRoot = await makeFixture();
const pendingCandidate = await candidateFor(pendingRoot);
await writeJson(pendingRoot, `affiliate/candidates/${pendingCandidate.candidateId}.json`, pendingCandidate);
assert.equal((await loadAffiliateLinkState(pendingRoot, { asOfDate: '2026-08-10' })).counts.activeOverlays, 0, 'candidate alone cannot render');

const staleArticleRoot = await makeFixture();
const staleArticleCandidate = await candidateFor(staleArticleRoot);
await addReviewAndApproval(staleArticleRoot, staleArticleCandidate);
await fs.appendFile(path.join(staleArticleRoot, 'src', 'data', 'blog', `${articleSlug}.md`), '\n');
await assert.rejects(() => loadAffiliateLinkState(staleArticleRoot, { asOfDate: '2026-08-10' }), /source article hash changed/);

const selfReviewRoot = await makeFixture();
const selfReviewCandidate = await candidateFor(selfReviewRoot);
await addReviewAndApproval(selfReviewRoot, selfReviewCandidate, { review: { reviewerId: selfReviewCandidate.createdBy } });
await assert.rejects(() => loadAffiliateLinkState(selfReviewRoot, { asOfDate: '2026-08-10' }), /cannot independently review/);

const staleProgramRoot = await makeFixture();
const staleProgramCandidate = await candidateFor(staleProgramRoot);
await addReviewAndApproval(staleProgramRoot, staleProgramCandidate);
const staleRegistryPath = path.join(staleProgramRoot, 'config', 'affiliate-programs.json');
const staleRegistry = JSON.parse(await fs.readFile(staleRegistryPath, 'utf8'));
staleRegistry.programs.find((entry) => entry.id === programId).revision = 3;
await fs.writeFile(staleRegistryPath, `${JSON.stringify(staleRegistry, null, 2)}\n`);
await assert.rejects(() => loadAffiliateLinkState(staleProgramRoot, { asOfDate: '2026-08-10' }), /program revision changed/);

const unapprovedTrackingRoot = await makeFixture();
await assert.rejects(() => candidateFor(unapprovedTrackingRoot, { paidUrl: 'https://bookshop.org/p/books/sapiens/123?affiliate=test-fixture-only&utm_source=invented' }), /tracking-like parameter utm_source is not declared and approved/);

const disabledRoot = await makeFixture();
const disabledRegistryPath = path.join(disabledRoot, 'config', 'affiliate-programs.json');
const disabledRegistry = JSON.parse(await fs.readFile(disabledRegistryPath, 'utf8'));
const disabledProgram = disabledRegistry.programs.find((entry) => entry.id === programId);
disabledProgram.status = 'paused';
disabledProgram.enabled = false;
await fs.writeFile(disabledRegistryPath, `${JSON.stringify(disabledRegistry, null, 2)}\n`);
await assert.rejects(() => candidateFor(disabledRoot), /program is not enabled/);

console.log(JSON.stringify({ affiliateLinkGateTests: 'passed', checks: 7, approvedOverlays: cleanState.counts.activeOverlays, sourceEditorialArtifactsMutated: false }, null, 2));
