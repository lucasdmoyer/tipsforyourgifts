import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { validateAffiliateModel } from './lib/affiliate-contract.mjs';
import { affiliateActivationApprovalBoundarySha256 } from './lib/affiliate-activation-proposal-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const activationWorkflow = await fs.readFile(path.join(scriptRoot, '..', '..', '.github', 'workflows', 'affiliate-program-activate.yml'), 'utf8');
assert.match(activationWorkflow, /environment: affiliate-activation/);
assert.match(activationWorkflow, /ACTIVATE-\$PROGRAM_ID/);
assert.match(activationWorkflow, /proposal_id:/);
assert.match(activationWorkflow, /expected_proposal_sha256:/);
assert.match(activationWorkflow, /--proposal-id="\$PROPOSAL_ID"/);
assert.match(activationWorkflow, /--expected-proposal-sha256="\$EXPECTED_PROPOSAL_SHA256"/);
assert.doesNotMatch(activationWorkflow, /allowed_domains:|tracking_method:|tracking_parameter_keys:|reporting_export_approved:/);
assert.match(activationWorkflow, /It creates no account, creates no paid link/);
assert.match(activationWorkflow, /web\/config\/affiliate-enrollment-plans\.json/);
const base = JSON.parse(await fs.readFile(path.join(scriptRoot, '..', 'config', 'affiliate-programs.json'), 'utf8'));
const sourceEnrollmentPlan = JSON.parse(await fs.readFile(path.join(scriptRoot, '..', 'config', 'affiliate-enrollment-plans.json'), 'utf8'));
const sourceProposalDocument = JSON.parse(await fs.readFile(path.join(scriptRoot, '..', 'config', 'affiliate-activation-proposals.json'), 'utf8'));
const sourceProposal = sourceProposalDocument.proposals[0];
const sourceObservationRaw = await fs.readFile(path.join(scriptRoot, '..', sourceProposal.evidence.observationReceiptPath));
const sourceArticleRaw = await fs.readFile(path.join(scriptRoot, '..', 'src', 'data', 'blog', `${sourceProposal.evidence.articleSlug}.md`));
async function writeProposalSupportFiles(fixtureRoot, proposalDocument) {
  const proposal = proposalDocument.proposals[0];
  await fs.mkdir(path.join(fixtureRoot, 'affiliate', 'evidence'), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, 'src', 'data', 'blog'), { recursive: true });
  await fs.writeFile(path.join(fixtureRoot, 'config', 'affiliate-activation-proposals.json'), `${JSON.stringify(proposalDocument, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, proposal.evidence.observationReceiptPath), sourceObservationRaw);
  await fs.writeFile(path.join(fixtureRoot, 'src', 'data', 'blog', `${proposal.evidence.articleSlug}.md`), sourceArticleRaw);
}
async function writeEnrollmentPlan(fixtureRoot, programId, programRevision) {
  const plan = structuredClone(sourceEnrollmentPlan);
  plan.updatedAt = testNow.toISOString();
  const entry = plan.programs.find((candidate) => candidate.programId === programId);
  entry.programRevision = programRevision;
  await fs.writeFile(path.join(fixtureRoot, 'config', 'affiliate-enrollment-plans.json'), `${JSON.stringify(plan, null, 2)}\n`);
}
const program = base.programs[0];
const testNow = new Date();
const sourceCheckedAt = new Date(Date.parse(sourceProposal.evidence.observedAt) - 86_400_000).toISOString();
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
program.trackingPathPrefix = null;
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
const fixtureProposalDocument = structuredClone(sourceProposalDocument);
fixtureProposalDocument.updatedAt = testNow.toISOString();
fixtureProposalDocument.proposals[0].id = `bookshop-org-us-media-revision-${verifiedProgram.revision}`;
fixtureProposalDocument.proposals[0].expectedProgramRevision = verifiedProgram.revision;
await writeProposalSupportFiles(fixtureRoot, fixtureProposalDocument);
const fixtureProposal = fixtureProposalDocument.proposals[0];
const fixtureProposalSha256 = affiliateActivationApprovalBoundarySha256(fixtureProposal);
await writeEnrollmentPlan(fixtureRoot, program.id, verifiedProgram.revision);

const commonArgs = [
  path.join(scriptRoot, 'activate-affiliate-program.mjs'),
  `--program-id=${program.id}`,
  `--proposal-id=${fixtureProposal.id}`,
  `--expected-proposal-sha256=${fixtureProposalSha256}`,
  `--confirmation=ACTIVATE-${program.id}`,
  `--terms-accepted-at=${termsAcceptedAt}`,
  '--acceptance-evidence-url=https://github.com/lucasdmoyer/tipsforyourgifts/issues/42',
  '--founder-login=lucasdmoyer'
];
await execFileAsync(process.execPath, commonArgs, { cwd: fixtureRoot });
const activated = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'config', 'affiliate-programs.json'), 'utf8'));
const activatedProgram = activated.programs.find((entry) => entry.id === program.id);
const activatedEnrollmentPlan = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'config', 'affiliate-enrollment-plans.json'), 'utf8'));
const activatedEnrollmentPlanProgram = activatedEnrollmentPlan.programs.find((entry) => entry.programId === program.id);
assert.equal(activatedProgram.status, 'enabled');
assert.equal(activatedProgram.enabled, true);
assert.equal(activatedProgram.priceFeedAuthorized, false);
assert.deepEqual(activatedProgram.registeredSites, ['https://tipsforyourgifts.web.app/']);
assert.equal(activatedProgram.trackingMethod, 'path_redirect_to_query');
assert.equal(activatedProgram.trackingPathPrefix, '/a/');
assert.equal(activatedProgram.account.activationProposalId, fixtureProposal.id);
assert.equal(activatedProgram.account.activationProposalSha256, fixtureProposalSha256);
assert.equal(activatedEnrollmentPlanProgram.programRevision, activatedProgram.revision);
assert.deepEqual(validateAffiliateModel(activated, { asOfDate: testNow.toISOString().slice(0, 10) }), []);
const { stdout: activatedProposalValidationOutput } = await execFileAsync(process.execPath, [path.join(scriptRoot, 'validate-affiliate-activation-proposals.mjs')], { cwd: fixtureRoot });
const activatedProposalValidation = JSON.parse(activatedProposalValidationOutput);
assert.equal(activatedProposalValidation.programsEnabled, 1);
assert.equal(activatedProposalValidation.paidLinkCandidatesCreated, 0);
assert.equal(activatedProposalValidation.productionDeploymentsAuthorized, 0);

const rejectedRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-affiliate-command-reject-'));
await fs.mkdir(path.join(rejectedRoot, 'config'));
await fs.writeFile(path.join(rejectedRoot, 'config', 'affiliate-programs.json'), `${JSON.stringify(verified, null, 2)}\n`);
await writeEnrollmentPlan(rejectedRoot, program.id, verifiedProgram.revision);
await writeProposalSupportFiles(rejectedRoot, fixtureProposalDocument);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--confirmation=') ? '--confirmation=ACTIVATE-something-else' : argument), { cwd: rejectedRoot }), /Action-time confirmation/);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--expected-proposal-sha256=') ? `--expected-proposal-sha256=${'f'.repeat(64)}` : argument), { cwd: rejectedRoot }), /does not match the exact activation boundary/);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--proposal-id=') ? '--proposal-id=unknown-proposal' : argument), { cwd: rejectedRoot }), /Unknown affiliate activation proposal/);

async function expectDivergentProposal(label, mutate, expectedText) {
  const divergentRoot = await fs.mkdtemp(path.join(os.tmpdir(), `tfyg-affiliate-divergence-${label}-`));
  await fs.mkdir(path.join(divergentRoot, 'config'));
  await fs.writeFile(path.join(divergentRoot, 'config', 'affiliate-programs.json'), `${JSON.stringify(verified, null, 2)}\n`);
  await writeEnrollmentPlan(divergentRoot, program.id, verifiedProgram.revision);
  const divergentDocument = structuredClone(fixtureProposalDocument);
  mutate(divergentDocument.proposals[0]);
  await writeProposalSupportFiles(divergentRoot, divergentDocument);
  await assert.rejects(() => execFileAsync(process.execPath, commonArgs, { cwd: divergentRoot }), (error) => String(error?.stderr ?? error?.message ?? error).includes(expectedText));
}
await expectDivergentProposal('domain', (proposal) => { proposal.activation.allowedDomains = ['example.com']; }, 'observed URLs must remain on the allowed domain');
await expectDivergentProposal('site', (proposal) => { proposal.activation.registeredSite = 'https://example.com/'; }, 'Invalid input');
await expectDivergentProposal('path', (proposal) => { proposal.activation.trackingPathPrefix = '/b/'; }, 'Invalid input');
await expectDivergentProposal('key', (proposal) => { proposal.activation.trackingParameterKeys = ['subid']; }, 'Invalid input');
await expectDivergentProposal('reporting', (proposal) => { proposal.activation.reportingExportApproved = true; }, 'Invalid input');
for (const invalidEvidenceUrl of ['https://localhost/issues/42', 'https://127.0.0.1/issues/42', 'https://example.com/issues/42', 'https://github.com:444/lucasdmoyer/tipsforyourgifts/issues/42', 'https://github.com/another/repository/issues/42', 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/0']) {
  await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--acceptance-evidence-url=') ? `--acceptance-evidence-url=${invalidEvidenceUrl}` : argument), { cwd: rejectedRoot }), /acceptance-evidence-url must be a numbered issue or pull request/);
}
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--terms-accepted-at=') ? `--terms-accepted-at=${new Date(Date.parse(sourceCheckedAt) - 3_600_000).toUTCString()}` : argument), { cwd: rejectedRoot }), /terms-accepted-at must be a canonical ISO timestamp/);

const evidenceRejectedRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-affiliate-command-evidence-reject-'));
await fs.mkdir(path.join(evidenceRejectedRoot, 'config'));
await fs.writeFile(path.join(evidenceRejectedRoot, 'config', 'affiliate-programs.json'), `${JSON.stringify(verified, null, 2)}\n`);
await writeEnrollmentPlan(evidenceRejectedRoot, program.id, verifiedProgram.revision);
await writeProposalSupportFiles(evidenceRejectedRoot, fixtureProposalDocument);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--terms-accepted-at=') ? `--terms-accepted-at=${new Date(Date.parse(sourceCheckedAt) - 3_600_000).toISOString()}` : argument), { cwd: evidenceRejectedRoot }), /terms acceptance must follow the recorded public source review/);

console.log(JSON.stringify({ affiliateActivationCommandTests: 'passed', workflowSafetyChecks: 9, founderApprovedToExternallyVerifiedToEnabled: 'passed', publicTrackingIdentityRecorded: 'passed', exactProposalDigestBound: 'passed', activationSettingsDerivedFromProposal: 'passed', noLinkCreation: 'passed', activationNegativeChecks: 10, invalidEvidenceReferencesRejected: 6 }, null, 2));
