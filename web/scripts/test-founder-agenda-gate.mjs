import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildFounderAgenda, parseFounderAgenda } from './lib/founder-agenda-contract.mjs';

const root = process.cwd();
const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
const strategy = await readJson('src/data/strategy.json');
const affiliate = await readJson('config/affiliate-programs.json');
const socialChannelsRaw = await fs.readFile(path.join(root, 'config/social-channels.json'));
const socialChannels = JSON.parse(socialChannelsRaw.toString('utf8'));
const socialChannelsSha256 = createHash('sha256').update(socialChannelsRaw).digest('hex');
const livePublication = await readJson('config/live-publication.json');
const publicationPolicy = await readJson('config/publication-policy.json');
const publicationManifest = await readJson('public/publication-manifest.json');
const growthRaw = await fs.readFile(path.join(root, 'src/data/growth.json'));
const growth = JSON.parse(growthRaw.toString('utf8'));
const growthSha256 = createHash('sha256').update(growthRaw).digest('hex');
const socialDraftNames = (await fs.readdir(path.join(root, 'social/drafts'))).filter((name) => name.endsWith('.json'));
const socialDraftPacks = await Promise.all(socialDraftNames.map((name) => readJson(`social/drafts/${name}`)));
let socialCandidateCount = 0;
try { socialCandidateCount = (await fs.readdir(path.join(root, 'social/candidates'))).filter((name) => name.endsWith('.json')).length; } catch {}
const proposedIdeas = strategy.ideas.filter((idea) => idea.founderDisposition === 'proposed');
const baseInput = {
  generatedAt: publicationManifest.generatedAt,
  strategy,
  affiliate,
  socialChannels,
  publicationPolicy,
  publicationManifest,
  livePublication,
  growth,
  openStrategyProposals: proposedIdeas.length,
  maxOpenStrategyProposals: 5,
  socialDraftCount: socialDraftPacks.reduce((sum, pack) => sum + pack.posts.length, 0),
  socialCreativeCandidateCount: socialCandidateCount,
  socialChannelsSha256,
  growthSha256,
  affiliateLinks: { candidates: 0, passedReviews: 0, approvals: 0, activeOverlays: 0, queue: [] }
};
const base = buildFounderAgenda(baseInput);

const currentContentIsVerified = livePublication.status === 'verified_managed_content_release'
  && livePublication.latestVerifiedContentRelease?.publicationManifest?.contentSetSha256 === publicationManifest.contentSetSha256;
assert.equal(base.primaryDecisionId, currentContentIsVerified ? 'establish-measurement' : 'review-release-candidate');
assert.equal(base.decisions.some((decision) => decision.id === 'review-release-candidate'), !currentContentIsVerified);
assert.equal(base.profitabilityEvidence, 'unknown_until_aggregate_measurement');
assert.deepEqual(base.decisions.map((decision) => decision.rank), base.decisions.map((_decision, index) => index + 1));
const priorityWeight = { high: 3, medium: 2, low: 1 };
const expectedStrategyCandidate = [...proposedIdeas].sort((left, right) => (priorityWeight[right.priority] ?? 0) - (priorityWeight[left.priority] ?? 0) || (right.pairing?.coherenceScore ?? 0) - (left.pairing?.coherenceScore ?? 0) || left.id.localeCompare(right.id))[0];
if (expectedStrategyCandidate) assert.match(base.decisions.find((decision) => decision.id === 'choose-next-thesis').recommendation, new RegExp(`${expectedStrategyCandidate.id} revision ${expectedStrategyCandidate.revision}`));

const verifiedLiveInput = structuredClone(baseInput);
verifiedLiveInput.livePublication = {
  schemaVersion: '1.0.0', projectId: 'tipsforyourgifts', siteId: 'tipsforyourgifts', hostingChannel: 'live', productionUrl: 'https://tipsforyourgifts.web.app/',
  status: 'verified_managed_content_release', updatedAt: '2026-08-09T12:01:00.000Z',
  latestVerifiedContentRelease: {
    receiptId: 'firebase-aaaaaaaaaaaa-12345-1', receiptPath: 'releases/receipts/firebase-aaaaaaaaaaaa-12345-1.json', receiptSha256: 'a'.repeat(64), releaseSha: 'b'.repeat(40),
    releaseMode: 'founder_reviewed', sourceWorkflow: 'firebase-production', workflowRunUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/12345', createdAt: '2026-08-09T12:01:00.000Z', productionVerifiedAt: '2026-08-09T12:01:00.000Z',
    publicationManifest: { manifestId: publicationManifest.manifestId, sha256: 'c'.repeat(64), contentSetSha256: publicationManifest.contentSetSha256, articles: publicationManifest.counts.articles, independentReviews: publicationManifest.counts.independentReviews, affiliateLinks: publicationManifest.counts.affiliateLinks },
    rollbackChannel: 'rollback-bbbbbbbbbbbb-12345-1'
  }
};
const verifiedLiveAgenda = buildFounderAgenda(verifiedLiveInput);
assert.equal(verifiedLiveAgenda.decisions.some((decision) => decision.id === 'review-release-candidate'), false, 'current verified live content must not be proposed for release again');

const configuredMeasurementInput = structuredClone(baseInput);
const configuredSearch = configuredMeasurementInput.growth.connectors.find((connector) => connector.id === 'search-console');
Object.assign(configuredSearch, {
  status: 'configured', founderApproved: true, sourceReference: 'https://tipsforyourgifts.web.app/', collectionMethod: 'search_console_api_page_aggregate',
  authenticationMode: 'github_oidc_workload_identity', credentialSecretNames: ['SEARCH_CONSOLE_WIF_PROVIDER', 'SEARCH_CONSOLE_SERVICE_ACCOUNT'],
  configurationEvidenceUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/84', configuredAt: '2026-08-10T12:00:00.000Z', activatedAt: null,
  snapshotImportEnabled: false, automatedCollectionEnabled: false
});
const configuredDecision = buildFounderAgenda(configuredMeasurementInput).decisions.find((decision) => decision.id === 'establish-measurement');
assert.match(configuredDecision.action.url, /search-console-activate\.yml$/);
assert.match(configuredDecision.action.command, new RegExp(growthSha256));
const activeMeasurementInput = structuredClone(configuredMeasurementInput);
const activeSearch = activeMeasurementInput.growth.connectors.find((connector) => connector.id === 'search-console');
Object.assign(activeSearch, { status: 'active', activatedAt: '2026-08-10T13:00:00.000Z', snapshotImportEnabled: true, automatedCollectionEnabled: true });
const activeDecision = buildFounderAgenda(activeMeasurementInput).decisions.find((decision) => decision.id === 'establish-measurement');
assert.match(activeDecision.action.url, /search-console-collect\.yml$/);

const enabledAffiliateInput = structuredClone(baseInput);
for (const program of enabledAffiliateInput.affiliate.programs) { program.status = 'rejected'; program.enabled = false; program.founderDisposition = 'rejected'; }
enabledAffiliateInput.affiliate.programs[0].status = 'enabled';
enabledAffiliateInput.affiliate.programs[0].enabled = true;
enabledAffiliateInput.affiliate.programs[0].founderDisposition = 'approved';
enabledAffiliateInput.affiliateLinks = {
  candidates: 1,
  passedReviews: 0,
  approvals: 0,
  activeOverlays: 0,
  queue: [{ candidateId: 'affiliate-link-test-v1', candidateSha256: 'a'.repeat(64), reviewSha256: null, stage: 'independent_review_required' }]
};
const linkReviewDecision = buildFounderAgenda(enabledAffiliateInput).decisions.find((decision) => decision.id === 'choose-affiliate-pilot');
assert.match(linkReviewDecision.action.url, /affiliate-link-review\.yml$/);
enabledAffiliateInput.affiliateLinks.passedReviews = 1;
enabledAffiliateInput.affiliateLinks.queue[0].stage = 'founder_approval_required';
enabledAffiliateInput.affiliateLinks.queue[0].reviewSha256 = 'b'.repeat(64);
const linkApprovalDecision = buildFounderAgenda(enabledAffiliateInput).decisions.find((decision) => decision.id === 'choose-affiliate-pilot');
assert.match(linkApprovalDecision.action.url, /affiliate-link-approval\.yml$/);

const clone = (value) => structuredClone(value);
const fixtureInput = clone(baseInput);
fixtureInput.livePublication = {
  schemaVersion: livePublication.schemaVersion,
  projectId: livePublication.projectId,
  siteId: livePublication.siteId,
  hostingChannel: livePublication.hostingChannel,
  productionUrl: livePublication.productionUrl,
  status: 'no_verified_managed_release',
  updatedAt: null,
  latestVerifiedContentRelease: null
};
for (const idea of fixtureInput.strategy.ideas) idea.founderDisposition = 'paused';
fixtureInput.strategy.ideas[0].founderDisposition = 'proposed';
fixtureInput.strategy.ideas[0].priority = 'high';
fixtureInput.openStrategyProposals = 1;
for (const connector of fixtureInput.growth.connectors) connector.status = 'not_connected';
for (const channel of fixtureInput.socialChannels.channels) {
  channel.status = 'not_connected'; channel.founderApproved = false; channel.officialAccountReference = null; channel.officialPublicationTargetId = null;
  channel.configurationEvidenceUrl = null; channel.configuredAt = null; channel.activatedAt = null;
  channel.publisher = null; channel.publishingEnabled = false; channel.apiCredentialSecretName = null; channel.maxPostsPerWeek = 0;
}
fixtureInput.socialDraftCount = Math.max(1, fixtureInput.socialDraftCount);
for (const program of fixtureInput.affiliate.programs) { program.status = 'rejected'; program.enabled = false; program.founderDisposition = 'rejected'; }
fixtureInput.affiliate.programs[0].status = 'proposed';
fixtureInput.affiliate.programs[0].founderDisposition = 'proposed';
const fullAgenda = buildFounderAgenda(fixtureInput);
assert.equal(fullAgenda.decisions.length, 5, 'full founder decision fixture must exercise every decision category');

function expectFailure(label, mutate) {
  const candidate = clone(fullAgenda);
  mutate(candidate);
  assert.throws(() => parseFounderAgenda(candidate), undefined, label);
}

expectFailure('primary decision must match rank one', (agenda) => { agenda.primaryDecisionId = 'choose-next-thesis'; });
expectFailure('ranks must be sequential', (agenda) => { agenda.decisions[1].rank = 4; });
expectFailure('priority scores must descend', (agenda) => { agenda.decisions[1].priorityScore = 100; });
expectFailure('categories cannot duplicate', (agenda) => { agenda.decisions[1].category = 'release'; });
expectFailure('founder authority cannot be removed', (agenda) => { agenda.decisions[0].founderActionRequired = false; });
expectFailure('profitability cannot be invented', (agenda) => { agenda.profitabilityEvidence = 'profitable'; });
expectFailure('actions must use HTTPS', (agenda) => { agenda.decisions[0].action.url = 'http://example.com'; });
expectFailure('evidence cannot disappear', (agenda) => { agenda.decisions[0].evidence = []; });
expectFailure('unexpected fields rejected', (agenda) => { agenda.estimatedRevenue = 5000; });

console.log(JSON.stringify({ founderAgendaGateTests: 'passed', negativeChecks: 9, currentDecisions: base.decisions.map(({ rank, id, priorityScore }) => ({ rank, id, priorityScore })), allDecisionCategoriesFixture: 'passed', verifiedLiveDeduplication: 'passed', recommendedStrategyIdea: expectedStrategyCandidate?.id ?? null, profitabilityEvidence: base.profitabilityEvidence }, null, 2));
