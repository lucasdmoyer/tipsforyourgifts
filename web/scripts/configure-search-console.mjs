import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateGrowthModel } from './lib/growth-contract.mjs';
import { assertSafePublicHttpsUrl } from './lib/social-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
if (args.confirmation !== 'CONFIGURE-search-console') throw new Error('Action-time confirmation does not match the Search Console connector');
if (!/^[a-f0-9]{64}$/.test(args['expected-growth-sha256'] ?? '')) throw new Error('expected-growth-sha256 must be a SHA-256 digest');
if (args['property-reference'] !== 'https://tipsforyourgifts.web.app/') throw new Error('property-reference must be the canonical URL-prefix property https://tipsforyourgifts.web.app/');
const evidenceUrl = assertSafePublicHttpsUrl(args['configuration-evidence-url'] ?? '', 'configuration evidence URL');

const root = process.cwd();
const growthPath = path.join(root, 'src', 'data', 'growth.json');
const raw = await fs.readFile(growthPath);
const actualSha256 = createHash('sha256').update(raw).digest('hex');
if (actualSha256 !== args['expected-growth-sha256']) throw new Error('Growth registry changed after founder review');
const growth = JSON.parse(raw.toString('utf8'));
if (args['founder-login'] !== growth.measurementPolicy.founderApproverLogin) throw new Error('founder-login does not match the configured founder approver');
const connector = growth.connectors.find((entry) => entry.id === 'search-console');
if (!connector || connector.status !== 'not_connected') throw new Error('search-console is not an unconfigured connector');

const now = new Date().toISOString();
Object.assign(connector, {
  status: 'configured',
  founderApproved: true,
  sourceReference: args['property-reference'],
  collectionMethod: 'search_console_api_page_aggregate',
  authenticationMode: 'github_oidc_workload_identity',
  credentialSecretNames: ['SEARCH_CONSOLE_WIF_PROVIDER', 'SEARCH_CONSOLE_SERVICE_ACCOUNT'],
  configurationEvidenceUrl: evidenceUrl.toString(),
  configuredAt: now,
  activatedAt: null,
  snapshotImportEnabled: false,
  automatedCollectionEnabled: false,
  nextGate: 'Lucas reviews this exact hash-bound property, credential references, read-only OAuth scope, and evidence in the protected activation workflow; configured status cannot query Google or import data.'
});
growth.updatedAt = now;
const issues = validateGrowthModel(growth, { affiliateProgramsEnabled: Number.MAX_SAFE_INTEGER });
if (issues.length > 0) throw new Error(`Search Console configuration would violate the growth contract: ${issues.join('; ')}`);
await fs.writeFile(growthPath, `${JSON.stringify(growth, null, 2)}\n`);
console.log(JSON.stringify({ configured: true, activated: false, connectorId: connector.id, propertyReference: connector.sourceReference, credentialValueStored: false, externalApiCalled: false }, null, 2));
