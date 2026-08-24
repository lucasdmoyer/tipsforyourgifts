import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { collectSearchConsoleSnapshot, latestFinalizedWeeklyWindow } from './lib/search-console-collector.mjs';
import { validateGrowthModel } from './lib/growth-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, '..', '..');
const configureWorkflow = await fs.readFile(path.join(repoRoot, '.github', 'workflows', 'search-console-configure.yml'), 'utf8');
const activateWorkflow = await fs.readFile(path.join(repoRoot, '.github', 'workflows', 'search-console-activate.yml'), 'utf8');
const collectWorkflow = await fs.readFile(path.join(repoRoot, '.github', 'workflows', 'search-console-collect.yml'), 'utf8');
assert.match(configureWorkflow, /stores no credential value, calls no Google API, imports no snapshot/);
assert.match(activateWorkflow, /environment: growth-measurement/);
assert.match(activateWorkflow, /calls no Google API and imports no snapshot/);
assert.match(collectWorkflow, /https:\/\/www\.googleapis\.com\/auth\/webmasters\.readonly/);
assert.match(collectWorkflow, /google-github-actions\/auth@v3/);
assert.doesNotMatch(collectWorkflow, /credentials_json/);
assert.match(collectWorkflow, /gh pr merge "\$pr_url" --auto --squash/);

const baseRaw = await fs.readFile(path.join(scriptRoot, '..', 'src', 'data', 'growth.json'));
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-search-console-command-'));
await fs.mkdir(path.join(fixtureRoot, 'src', 'data'), { recursive: true });
const growthPath = path.join(fixtureRoot, 'src', 'data', 'growth.json');
await fs.writeFile(growthPath, baseRaw);
const baseSha256 = createHash('sha256').update(baseRaw).digest('hex');
await execFileAsync(process.execPath, [
  path.join(scriptRoot, 'configure-search-console.mjs'), `--expected-growth-sha256=${baseSha256}`,
  '--property-reference=https://tipsforyourgifts.web.app/',
  '--configuration-evidence-url=https://github.com/lucasdmoyer/tipsforyourgifts/issues/84',
  '--confirmation=CONFIGURE-search-console', '--founder-login=lucasdmoyer'
], { cwd: fixtureRoot });
const configuredRaw = await fs.readFile(growthPath);
const configured = JSON.parse(configuredRaw.toString('utf8'));
const configuredConnector = configured.connectors.find((entry) => entry.id === 'search-console');
assert.equal(configuredConnector.status, 'configured');
assert.equal(configuredConnector.snapshotImportEnabled, false);
assert.equal(configuredConnector.automatedCollectionEnabled, false);
assert.deepEqual(configuredConnector.credentialSecretNames, ['SEARCH_CONSOLE_WIF_PROVIDER', 'SEARCH_CONSOLE_SERVICE_ACCOUNT']);
assert.deepEqual(validateGrowthModel(configured, { affiliateProgramsEnabled: 1 }), []);

const configuredSha256 = createHash('sha256').update(configuredRaw).digest('hex');
await execFileAsync(process.execPath, [
  path.join(scriptRoot, 'activate-search-console.mjs'), `--expected-growth-sha256=${configuredSha256}`,
  '--confirmation=ACTIVATE-search-console', '--founder-login=lucasdmoyer'
], { cwd: fixtureRoot });
const active = JSON.parse(await fs.readFile(growthPath, 'utf8'));
const activeConnector = active.connectors.find((entry) => entry.id === 'search-console');
assert.equal(activeConnector.status, 'active');
assert.equal(activeConnector.snapshotImportEnabled, true);
assert.equal(activeConnector.automatedCollectionEnabled, true);
assert.deepEqual(validateGrowthModel(active, { affiliateProgramsEnabled: 1 }), []);

await assert.rejects(() => execFileAsync(process.execPath, [
  path.join(scriptRoot, 'activate-search-console.mjs'), `--expected-growth-sha256=${'0'.repeat(64)}`,
  '--confirmation=ACTIVATE-search-console', '--founder-login=lucasdmoyer'
], { cwd: fixtureRoot }), /registry changed/);

const calls = [];
const fakeFetch = async (url, options = {}) => {
  calls.push({ url, options });
  if (!options.method) return new Response(JSON.stringify({ siteUrl: 'https://tipsforyourgifts.web.app/', permissionLevel: 'siteFullUser' }), { status: 200 });
  const body = JSON.parse(options.body);
  assert.equal(body.dataState, 'final');
  assert.deepEqual(body.dimensionFilterGroups[0].filters.map((filter) => filter.dimension), ['page']);
  assert.equal(JSON.stringify(body).includes('query'), false);
  const first = body.dimensionFilterGroups[0].filters[0].expression.endsWith('/gifts-for-a-golf-friend');
  return new Response(JSON.stringify(first
    ? { rows: [{ clicks: 3, impressions: 27 }], responseAggregationType: 'byPage' }
    : { responseAggregationType: 'byPage' }), { status: 200 });
};
const snapshot = await collectSearchConsoleSnapshot({
  connector: activeConnector,
  articles: [{ slug: 'read-it-then-play-it-gift-pairs' }, { slug: 'gifts-for-a-golf-friend' }],
  accessToken: 'test-access-token-never-store-this',
  evidenceUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/12345',
  periodStart: '2026-07-27', periodEnd: '2026-08-02', collectedAt: '2026-08-07T14:00:00.000Z', fetchImpl: fakeFetch
});
assert.equal(calls.length, 3);
assert.equal(snapshot.articles[0].slug, 'gifts-for-a-golf-friend');
assert.equal(snapshot.articles[0].organicClicks, 3);
assert.equal(snapshot.articles[1].organicClicks, 0);
assert.equal(snapshot.articles[0].engagedSessions, null);
assert.match(snapshot.sourceArtifactSha256, /^[a-f0-9]{64}$/);
assert.equal(JSON.stringify(snapshot).includes('test-access-token'), false);
const modelWithSnapshot = structuredClone(active);
modelWithSnapshot.snapshots = [snapshot];
assert.deepEqual(validateGrowthModel(modelWithSnapshot, {
  publishedSlugs: new Set(['how-we-research-gifts', 'gifts-for-a-golf-friend', 'read-it-then-play-it-gift-pairs', 'useful-gifts-for-hard-to-shop-for-adults']),
  affiliateProgramsEnabled: 0
}), []);

const inactive = structuredClone(activeConnector);
inactive.status = 'configured'; inactive.snapshotImportEnabled = false; inactive.automatedCollectionEnabled = false; inactive.activatedAt = null;
await assert.rejects(() => collectSearchConsoleSnapshot({ connector: inactive, articles: [{ slug: 'gifts-for-a-golf-friend' }], accessToken: 'test-access-token-never-store-this', evidenceUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/1', periodStart: '2026-07-27', periodEnd: '2026-08-02', fetchImpl: fakeFetch }), /not active/);
await assert.rejects(() => collectSearchConsoleSnapshot({ connector: activeConnector, articles: [{ slug: 'gifts-for-a-golf-friend' }], accessToken: 'test-access-token-never-store-this', evidenceUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/1', periodStart: '2026-08-03', periodEnd: '2026-08-09', collectedAt: '2026-08-10T17:00:00.000Z', fetchImpl: fakeFetch }), /at least four Pacific calendar days/);
assert.deepEqual(latestFinalizedWeeklyWindow(new Date('2026-08-07T17:00:00.000Z')), { periodStart: '2026-07-27', periodEnd: '2026-08-02' });
assert.deepEqual(latestFinalizedWeeklyWindow(new Date('2026-08-10T17:00:00.000Z')), { periodStart: '2026-07-27', periodEnd: '2026-08-02' });

console.log(JSON.stringify({ searchConsoleCommandTests: 'passed', workflowSafetyChecks: 7, configureWithoutExternalCall: 'passed', activateWithoutExternalCall: 'passed', pageAggregateCollector: 'passed', rawQueriesStored: false, personalDataStored: false, staleDigestRejected: 'passed' }, null, 2));
