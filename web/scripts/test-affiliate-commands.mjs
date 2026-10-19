import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { validateAffiliateModel } from './lib/affiliate-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const activationWorkflow = await fs.readFile(path.join(scriptRoot, '..', '..', '.github', 'workflows', 'affiliate-program-activate.yml'), 'utf8');
assert.match(activationWorkflow, /environment: affiliate-activation/);
assert.match(activationWorkflow, /ACTIVATE-\$PROGRAM_ID/);
assert.match(activationWorkflow, /tracking_method:/);
assert.match(activationWorkflow, /path_redirect_to_query/);
assert.match(activationWorkflow, /--registered-site="\$REGISTERED_SITE"/);
assert.match(activationWorkflow, /--tracking-method="\$TRACKING_METHOD"/);
assert.match(activationWorkflow, /--tracking-path-prefix="\$TRACKING_PATH_PREFIX"/);
assert.match(activationWorkflow, /It creates no account, accepts no terms, creates no paid link/);
const base = JSON.parse(await fs.readFile(path.join(scriptRoot, '..', 'config', 'affiliate-programs.json'), 'utf8'));
const program = base.programs[0];
const testNow = new Date();
const sourceCheckedAt = new Date(testNow.valueOf() - 86_400_000).toISOString();
const termsAcceptedAt = new Date(testNow.valueOf() - 3_600_000).toISOString();
const sourceReviewExpiresAt = new Date(testNow.valueOf() + 30 * 86_400_000).toISOString().slice(0, 10);
program.sourceCheckedAt = sourceCheckedAt;
program.sourceReviewExpiresAt = sourceReviewExpiresAt;
base.updatedAt = sourceCheckedAt;
program.status = 'founder_approved';
program.founderDisposition = 'approved';
program.revision += 1;
program.enabled = false;
program.allowedDomains = [];
program.registeredSites = [];
program.trackingParameterKeys = [];
program.requiredDisclosure = null;
program.account = {
  externalAccountEstablished: false,
  trackingIdentityConfigured: false,
  verificationStatus: 'not_started',
  verificationObservedAt: null,
  publicTrackingIdentity: null,
  publicStorefrontUrl: null,
  weeklyReportsEnabled: false,
  termsAcceptedByFounder: false,
  termsAcceptedAt: null,
  acceptanceEvidenceReference: null,
  reportingExportApproved: false
};
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-affiliate-command-'));
await fs.mkdir(path.join(fixtureRoot, 'config'));
await fs.writeFile(path.join(fixtureRoot, 'config', 'affiliate-programs.json'), `${JSON.stringify(base, null, 2)}\n`);
const verificationArgs = [
  path.join(scriptRoot, 'record-affiliate-verification.mjs'),
  `--program-id=${program.id}`,
  `--expected-revision=${program.revision}`,
  `--confirmation=RECORD-VERIFIED-${program.id}`,
  `--observed-at=${sourceCheckedAt}`,
  '--public-tracking-identity=129750',
  '--public-storefront-url=https://bookshop.org/shop/tipsforyourgifts',
  '--weekly-reports-enabled=true'
];
await execFileAsync(process.execPath, verificationArgs, { cwd: fixtureRoot });
const verified = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'config', 'affiliate-programs.json'), 'utf8'));
const verifiedProgram = verified.programs.find((entry) => entry.id === program.id);
assert.equal(verifiedProgram.status, 'externally_verified');
assert.equal(verifiedProgram.enabled, false);
assert.equal(verifiedProgram.account.publicTrackingIdentity, '129750');
assert.equal(verifiedProgram.account.weeklyReportsEnabled, true);

const commonArgs = [
  path.join(scriptRoot, 'activate-affiliate-program.mjs'),
  `--program-id=${program.id}`,
  `--expected-revision=${verifiedProgram.revision}`,
  `--confirmation=ACTIVATE-${program.id}`,
  '--allowed-domains=bookshop.org',
  '--registered-site=https://tipsforyourgifts.web.app/',
  '--tracking-method=path_redirect_to_query',
  '--tracking-path-prefix=/a/',
  '--tracking-parameter-keys=affiliate',
  `--terms-accepted-at=${termsAcceptedAt}`,
  '--acceptance-evidence-url=https://github.com/lucasdmoyer/tipsforyourgifts/issues/42',
  '--reporting-export-approved=false',
  '--founder-login=lucasdmoyer'
];
await execFileAsync(process.execPath, commonArgs, { cwd: fixtureRoot });
const activated = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'config', 'affiliate-programs.json'), 'utf8'));
const activatedProgram = activated.programs.find((entry) => entry.id === program.id);
assert.equal(activatedProgram.status, 'enabled');
assert.equal(activatedProgram.enabled, true);
assert.equal(activatedProgram.priceFeedAuthorized, false);
assert.deepEqual(activatedProgram.registeredSites, ['https://tipsforyourgifts.web.app/']);
assert.equal(activatedProgram.trackingMethod, 'path_redirect_to_query');
assert.equal(activatedProgram.trackingPathPrefix, '/a/');
assert.deepEqual(validateAffiliateModel(activated, { asOfDate: testNow.toISOString().slice(0, 10) }), []);

const rejectedRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-affiliate-command-reject-'));
await fs.mkdir(path.join(rejectedRoot, 'config'));
await fs.writeFile(path.join(rejectedRoot, 'config', 'affiliate-programs.json'), `${JSON.stringify(base, null, 2)}\n`);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--confirmation=') ? '--confirmation=ACTIVATE-something-else' : argument), { cwd: rejectedRoot }), /Action-time confirmation/);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--registered-site=') ? '--registered-site=http://tipsforyourgifts.web.app/' : argument), { cwd: rejectedRoot }), /registered-site must be a credential-free HTTPS URL/);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--registered-site=') ? '--registered-site=https://tipsforyourgifts.web.app/blog/' : argument), { cwd: rejectedRoot }), /registered-site must be the exact HTTPS site origin/);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--tracking-path-prefix=') ? '--tracking-path-prefix=' : argument), { cwd: rejectedRoot }), /path-redirect tracking requires/);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--tracking-method=') ? '--tracking-method=query_parameters' : argument), { cwd: rejectedRoot }), /query-parameter tracking cannot configure a path prefix/);
for (const privateSite of ['https://localhost/', 'https://127.0.0.1/', 'https://10.0.0.1/', 'https://172.16.0.1/', 'https://192.168.0.1/', 'https://169.254.0.1/', 'https://[::1]/']) {
  await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--registered-site=') ? `--registered-site=${privateSite}` : argument), { cwd: rejectedRoot }), /registered-site must use a public DNS hostname/);
}
for (const reservedSite of ['https://internal/', 'https://example.test/', 'https://example.invalid/', 'https://localhost./', 'https://example.test./']) {
  await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--registered-site=') ? `--registered-site=${reservedSite}` : argument), { cwd: rejectedRoot }), /registered-site must use a public DNS hostname/);
}
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--registered-site=') ? '--registered-site=https://example.com/' : argument), { cwd: rejectedRoot }), /registered-site must match the approved Tips for Your Gifts Firebase production origin/);
for (const invalidEvidenceUrl of ['https://localhost/issues/42', 'https://127.0.0.1/issues/42', 'https://example.com/issues/42', 'https://github.com:444/lucasdmoyer/tipsforyourgifts/issues/42', 'https://github.com/another/repository/issues/42', 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/0']) {
  await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--acceptance-evidence-url=') ? `--acceptance-evidence-url=${invalidEvidenceUrl}` : argument), { cwd: rejectedRoot }), /acceptance-evidence-url must be a numbered issue or pull request/);
}
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--terms-accepted-at=') ? `--terms-accepted-at=${new Date(Date.parse(sourceCheckedAt) - 3_600_000).toUTCString()}` : argument), { cwd: rejectedRoot }), /terms-accepted-at must be a canonical ISO timestamp/);

const evidenceRejectedRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-affiliate-command-evidence-reject-'));
await fs.mkdir(path.join(evidenceRejectedRoot, 'config'));
await fs.writeFile(path.join(evidenceRejectedRoot, 'config', 'affiliate-programs.json'), `${JSON.stringify(verified, null, 2)}\n`);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--terms-accepted-at=') ? `--terms-accepted-at=${new Date(Date.parse(sourceCheckedAt) - 3_600_000).toISOString()}` : argument), { cwd: evidenceRejectedRoot }), /terms acceptance must follow the recorded public source review/);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => {
  if (argument.startsWith('--tracking-method=')) return '--tracking-method=query_parameters';
  if (argument.startsWith('--tracking-path-prefix=')) return '--tracking-path-prefix=';
  return argument;
}), { cwd: evidenceRejectedRoot }), /tracking-method does not match the externally observed method/);

console.log(JSON.stringify({ affiliateActivationCommandTests: 'passed', workflowSafetyChecks: 8, founderApprovedToExternallyVerifiedToEnabled: 'passed', publicTrackingIdentityRecorded: 'passed', noLinkCreation: 'passed', activationNegativeChecks: 12, privateOrReservedOriginsRejected: 12, invalidEvidenceReferencesRejected: 6 }, null, 2));
