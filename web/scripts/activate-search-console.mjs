import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateGrowthModel } from './lib/growth-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
if (args.confirmation !== 'ACTIVATE-search-console') throw new Error('Action-time confirmation does not match the Search Console connector');
if (!/^[a-f0-9]{64}$/.test(args['expected-growth-sha256'] ?? '')) throw new Error('expected-growth-sha256 must be a SHA-256 digest');

const root = process.cwd();
const growthPath = path.join(root, 'src', 'data', 'growth.json');
const raw = await fs.readFile(growthPath);
const actualSha256 = createHash('sha256').update(raw).digest('hex');
if (actualSha256 !== args['expected-growth-sha256']) throw new Error('Growth registry changed after founder review');
const growth = JSON.parse(raw.toString('utf8'));
if (args['founder-login'] !== growth.measurementPolicy.founderApproverLogin) throw new Error('founder-login does not match the configured founder approver');
const connector = growth.connectors.find((entry) => entry.id === 'search-console');
if (!connector || connector.status !== 'configured' || !connector.founderApproved || connector.snapshotImportEnabled) throw new Error('search-console is not a founder-approved configured connector');

const now = new Date().toISOString();
connector.status = 'active';
connector.activatedAt = now;
connector.snapshotImportEnabled = true;
connector.automatedCollectionEnabled = true;
connector.nextGate = 'The scheduled read-only collector may query finalized page-level clicks and impressions, open a gate-checked aggregate snapshot pull request, and no-op when the reporting window already exists; it cannot collect queries or personal identifiers.';
growth.updatedAt = now;
const issues = validateGrowthModel(growth, { affiliateProgramsEnabled: Number.MAX_SAFE_INTEGER });
if (issues.length > 0) throw new Error(`Search Console activation would violate the growth contract: ${issues.join('; ')}`);
await fs.writeFile(growthPath, `${JSON.stringify(growth, null, 2)}\n`);
console.log(JSON.stringify({ configured: true, activated: true, connectorId: connector.id, readOnlyScopeRequired: true, snapshotsImported: 0, externalApiCalled: false }, null, 2));
