import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateAffiliateModel } from './lib/affiliate-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const programId = args['program-id'] ?? '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(programId)) throw new Error('program-id must be a lowercase slug');
const expectedRevision = Number(args['expected-revision']);
if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new Error('expected-revision must be a positive integer');
if (args.confirmation !== `RECORD-VERIFIED-${programId}`) throw new Error('Confirmation does not match the exact affiliate program');
const observedAt = args['observed-at'];
if (!observedAt || !Number.isFinite(Date.parse(observedAt))) throw new Error('observed-at must be an ISO timestamp');
if (Date.parse(observedAt) > Date.now()) throw new Error('verification observation cannot be recorded in the future');
const publicTrackingIdentity = args['public-tracking-identity'] ?? '';
if (!/^[A-Za-z0-9_-]+$/.test(publicTrackingIdentity)) throw new Error('public-tracking-identity must use only letters, numbers, underscores, or hyphens');
const storefrontUrl = new URL(args['public-storefront-url'] ?? '');
if (storefrontUrl.protocol !== 'https:' || storefrontUrl.username || storefrontUrl.password || storefrontUrl.search || storefrontUrl.hash) {
  throw new Error('public-storefront-url must be credential-free HTTPS without query or fragment');
}
if (!['true', 'false'].includes(args['weekly-reports-enabled'])) throw new Error('weekly-reports-enabled must be true or false');

const root = process.cwd();
const configPath = path.join(root, 'config', 'affiliate-programs.json');
const model = JSON.parse(await fs.readFile(configPath, 'utf8'));
const program = model.programs.find((entry) => entry.id === programId);
if (!program) throw new Error(`Unknown affiliate program: ${programId}`);
if (program.revision !== expectedRevision) throw new Error(`${program.id} is revision ${program.revision}, not expected revision ${expectedRevision}`);
if (program.status !== 'founder_approved' || program.founderDisposition !== 'approved' || program.enabled) {
  throw new Error(`${program.id} is not a disabled founder-approved program`);
}

program.revision += 1;
program.status = 'externally_verified';
program.account = {
  ...program.account,
  externalAccountEstablished: true,
  trackingIdentityConfigured: true,
  verificationStatus: 'verified',
  verificationObservedAt: new Date(observedAt).toISOString(),
  publicTrackingIdentity,
  publicStorefrontUrl: storefrontUrl.toString(),
  weeklyReportsEnabled: args['weekly-reports-enabled'] === 'true'
};
program.nextGate = 'Review and explicitly accept the current affiliate terms, registered production site, allowed destination domain, Bookshop-issued tracking behavior, disclosure, and aggregate reporting boundary before activation; no paid link is live.';
model.updatedAt = new Date(observedAt).toISOString();
const issues = validateAffiliateModel(model, { asOfDate: model.updatedAt.slice(0, 10) });
if (issues.length > 0) throw new Error(`Affiliate verification record would violate the contract: ${issues.join('; ')}`);
await fs.writeFile(configPath, `${JSON.stringify(model, null, 2)}\n`);
console.log(JSON.stringify({ recorded: true, programId: program.id, revision: program.revision, status: program.status, enabled: program.enabled, weeklyReportsEnabled: program.account.weeklyReportsEnabled }, null, 2));
