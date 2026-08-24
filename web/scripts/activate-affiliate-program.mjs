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
if (args.confirmation !== `ACTIVATE-${programId}`) throw new Error('Action-time confirmation does not match the exact affiliate program');

function parseList(value, pattern, label) {
  const entries = String(value ?? '').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  if (entries.length === 0 || entries.some((entry) => !pattern.test(entry))) throw new Error(`${label} must contain a comma-separated allowlist`);
  if (new Set(entries).size !== entries.length) throw new Error(`${label} cannot contain duplicates`);
  return entries;
}

const allowedDomains = parseList(args['allowed-domains'], /^[a-z0-9.-]+$/, 'allowed-domains');
const trackingParameterKeys = parseList(args['tracking-parameter-keys'], /^[a-z0-9_-]+$/i, 'tracking-parameter-keys');
const termsAcceptedAt = args['terms-accepted-at'];
if (!termsAcceptedAt || !Number.isFinite(Date.parse(termsAcceptedAt))) throw new Error('terms-accepted-at must be an ISO timestamp');
const evidenceUrl = new URL(args['acceptance-evidence-url'] ?? '');
if (evidenceUrl.protocol !== 'https:' || evidenceUrl.username || evidenceUrl.password || evidenceUrl.search || evidenceUrl.hash) throw new Error('acceptance-evidence-url must be a credential-free HTTPS URL without query or fragment');
if (!['true', 'false'].includes(args['reporting-export-approved'])) throw new Error('reporting-export-approved must be true or false');

const root = process.cwd();
const configPath = path.join(root, 'config', 'affiliate-programs.json');
const model = JSON.parse(await fs.readFile(configPath, 'utf8'));
if (args['founder-login'] !== model.policy.founderApproverLogin) throw new Error('founder-login does not match the configured founder approver');
const program = model.programs.find((entry) => entry.id === programId);
if (!program) throw new Error(`Unknown affiliate program: ${programId}`);
if (program.revision !== expectedRevision) throw new Error(`${program.id} is revision ${program.revision}, not expected revision ${expectedRevision}`);
if (program.status !== 'founder_approved' || program.founderDisposition !== 'approved' || program.enabled) throw new Error(`${program.id} is not a disabled founder-approved program`);

const now = new Date();
if (Date.parse(termsAcceptedAt) > now.valueOf()) throw new Error('terms acceptance cannot be recorded in the future');
if (termsAcceptedAt < program.sourceCheckedAt) throw new Error('terms acceptance must follow the recorded public source review');
if (program.sourceReviewExpiresAt < now.toISOString().slice(0, 10)) throw new Error('affiliate terms review has expired and must be refreshed before activation');

program.revision += 1;
program.status = 'enabled';
program.enabled = true;
program.allowedDomains = allowedDomains;
program.registeredSites = ['https://tipsforyourgifts.web.app/'];
program.trackingParameterKeys = trackingParameterKeys;
program.requiredDisclosure = model.policy.defaultDisclosure;
program.account = {
  externalAccountEstablished: true,
  trackingIdentityConfigured: true,
  termsAcceptedByFounder: true,
  termsAcceptedAt: new Date(termsAcceptedAt).toISOString(),
  acceptanceEvidenceReference: evidenceUrl.toString(),
  reportingExportApproved: args['reporting-export-approved'] === 'true'
};
program.priceFeedAuthorized = false;
program.nextGate = 'Create and independently review exact destination-link candidates with the approved disclosure and sponsored relationship; activation alone does not make a paid link live or authorize prices.';
model.updatedAt = now.toISOString();
const issues = validateAffiliateModel(model, { asOfDate: now.toISOString().slice(0, 10) });
if (issues.length > 0) throw new Error(`Affiliate activation would violate the contract: ${issues.join('; ')}`);
await fs.writeFile(configPath, `${JSON.stringify(model, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `program_id=${program.id}\nprogram_revision=${program.revision}\n`);
console.log(JSON.stringify({ activated: true, programId: program.id, revision: program.revision, enabled: program.enabled, affiliateLinksCreated: 0, priceFeedAuthorized: false }, null, 2));
