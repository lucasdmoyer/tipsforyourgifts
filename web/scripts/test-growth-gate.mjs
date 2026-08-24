import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateGrowthModel } from './lib/growth-contract.mjs';

const root = process.cwd();
const base = JSON.parse(await fs.readFile(path.join(root, 'src', 'data', 'growth.json'), 'utf8'));
const publishedSlugs = new Set([
  'how-we-research-gifts',
  'gifts-for-a-golf-friend',
  'read-it-then-play-it-gift-pairs',
  'useful-gifts-for-hard-to-shop-for-adults'
]);
const options = { publishedSlugs, affiliateProgramsEnabled: 0 };
const validSnapshot = {
  id: 'growth-snapshot-20260803-fixture',
  source: 'combined_aggregate_export',
  periodStart: '2026-07-27',
  periodEnd: '2026-08-02',
  collectedAt: '2026-08-03T08:00:00.000Z',
  reportingWindowDays: 7,
  sourceConnectorIds: ['search-console'],
  sourceEvidenceUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/12345',
  sourceArtifactSha256: 'a'.repeat(64),
  articles: [{
    slug: 'read-it-then-play-it-gift-pairs',
    searchImpressions: null,
    organicClicks: null,
    engagedSessions: null,
    outboundMerchantClicks: null,
    affiliateConversions: null,
    revenueUsd: null,
    socialImpressions: null,
    socialEngagements: null,
    ownedSiteClicks: null
  }]
};

function copy(value) { return structuredClone(value); }
function activateSearchConnector(model) {
  const connector = model.connectors.find((entry) => entry.id === 'search-console');
  Object.assign(connector, {
    status: 'active', founderApproved: true, sourceReference: 'https://tipsforyourgifts.web.app/',
    collectionMethod: 'search_console_api_page_aggregate', authenticationMode: 'github_oidc_workload_identity',
    credentialSecretNames: ['SEARCH_CONSOLE_WIF_PROVIDER', 'SEARCH_CONSOLE_SERVICE_ACCOUNT'],
    configurationEvidenceUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/84',
    configuredAt: '2026-08-03T07:00:00.000Z', activatedAt: '2026-08-03T07:30:00.000Z',
    snapshotImportEnabled: true, automatedCollectionEnabled: true
  });
}
function expectFailure(label, mutate, expectedText) {
  const model = copy(base);
  activateSearchConnector(model);
  model.snapshots = [copy(validSnapshot)];
  mutate(model);
  const issues = validateGrowthModel(model, options);
  if (issues.length === 0 || !issues.join('\n').toLowerCase().includes(expectedText.toLowerCase())) {
    throw new Error(`${label}: expected an issue containing ${JSON.stringify(expectedText)}, received ${JSON.stringify(issues)}`);
  }
}

const cleanIssues = validateGrowthModel(base, options);
if (cleanIssues.length > 0) throw new Error(`base growth model should pass: ${cleanIssues.join('; ')}`);

expectFailure('rejects personal data', (model) => { model.snapshots[0].articles[0].email = 'private@example.com'; }, 'unrecognized key');
expectFailure('rejects negative metrics', (model) => { model.snapshots[0].articles[0].organicClicks = -1; }, 'too small');
expectFailure('rejects duplicate snapshots', (model) => { model.snapshots.push(copy(model.snapshots[0])); }, 'duplicate snapshot');
expectFailure('rejects unknown articles', (model) => { model.snapshots[0].articles[0].slug = 'not-a-published-article'; }, 'unknown publication-ready article');
expectFailure('requires founder approval for running experiments', (model) => { model.experiments[0].status = 'running'; }, 'requires founder approval');
expectFailure('rejects missing experiment sources', (model) => { model.experiments[0].sourceSnapshotIds = ['growth-snapshot-20260803-missing']; }, 'missing source snapshot');
expectFailure('blocks affiliate exports while disabled', (model) => { model.snapshots[0].source = 'affiliate_network_export'; }, 'affiliate export is not allowed');
expectFailure('requires connector approval', (model) => { model.connectors[0].founderApproved = false; }, 'requires founder approval');
expectFailure('requires an active source connector', (model) => { model.connectors[0].status = 'paused'; model.connectors[0].snapshotImportEnabled = false; model.connectors[0].automatedCollectionEnabled = false; }, 'not active for snapshot import');
expectFailure('rejects cross-source metrics', (model) => { model.snapshots[0].articles[0].engagedSessions = 4; }, 'requires active source connector web-analytics');
expectFailure('rejects signed evidence URLs', (model) => { model.snapshots[0].sourceEvidenceUrl = 'https://example.com/export?token=secret'; }, 'query parameters');
expectFailure('rejects duplicate source windows', (model) => { const duplicate = copy(model.snapshots[0]); duplicate.id = 'growth-snapshot-20260803-fixture-two'; duplicate.sourceArtifactSha256 = 'b'.repeat(64); model.snapshots.push(duplicate); }, 'duplicate reporting window');

console.log(JSON.stringify({ growthNegativeGateTests: 'passed', checks: 12 }, null, 2));
