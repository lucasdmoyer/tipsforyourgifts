import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { affiliateEnrollmentReadinessSchema, buildAffiliateEnrollmentReadiness } from './lib/affiliate-enrollment-contract.mjs';

const root = process.cwd();
const affiliate = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const coverage = JSON.parse(await fs.readFile(path.join(root, 'public', 'affiliate-product-coverage.json'), 'utf8'));
const plan = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-enrollment-plans.json'), 'utf8'));

function copy(value) { return structuredClone(value); }
function expectFailure(label, mutate, expectedText) {
  const model = { affiliate: copy(affiliate), coverage: copy(coverage), plan: copy(plan) };
  mutate(model);
  assert.throws(
    () => buildAffiliateEnrollmentReadiness(model),
    (error) => String(error?.message ?? error).toLowerCase().includes(expectedText.toLowerCase()),
    label
  );
}
function expectArtifactFailure(label, mutate, expectedText) {
  const artifact = copy(clean);
  mutate(artifact);
  assert.throws(
    () => affiliateEnrollmentReadinessSchema.parse(artifact),
    (error) => String(error?.message ?? error).toLowerCase().includes(expectedText.toLowerCase()),
    label
  );
}

const clean = buildAffiliateEnrollmentReadiness({ affiliate, coverage, plan });
assert.equal(clean.counts.totalPrograms, 5);
assert.equal(clean.counts.publicApplicationPacketsReady, 5);
assert.equal(clean.counts.externalEnrollmentAllowedByRegistry, 1);
assert.equal(clean.counts.awaitingFounderProgramApproval, 4);
assert.equal(clean.counts.externallyEnrolled, 1);
assert.equal(clean.counts.enabledPrograms, 0);
assert.equal(clean.programs.find((entry) => entry.programId === 'bookshop-org-us-media').stage, 'activation_evidence_required');
assert.equal(clean.programs.find((entry) => entry.programId === 'amazon-associates-us').stage, 'founder_approval_required');

expectFailure('rejects missing program packet', ({ plan: value }) => { value.programs.pop(); }, 'missing programs');
expectFailure('rejects unknown program packet', ({ plan: value }) => { value.programs.push({ ...value.programs[0], programId: 'invented-program' }); }, 'unknown programs');
expectFailure('rejects duplicate program packet', ({ plan: value }) => { value.programs[1].programId = value.programs[0].programId; }, 'cannot contain duplicates');
expectFailure('rejects stale program revision', ({ plan: value }) => { value.programs[0].programRevision += 1; }, 'does not match registry revision');
expectFailure('rejects duplicate private-input labels', ({ plan: value }) => { value.programs[0].userOnlyInputs.push(value.programs[0].userOnlyInputs[0]); }, 'must be unique');
expectFailure('rejects duplicate portal-field labels', ({ plan: value }) => { value.programs[0].publicPortalFields.push(value.programs[0].publicPortalFields[0]); }, 'must be unique');
expectFailure('rejects missing coverage record', ({ coverage: value }) => { value.programs = value.programs.filter((entry) => entry.programId !== 'ebay-partner-network-us'); }, 'unknown candidate program');
expectFailure('rejects arbitrary private-input values', ({ plan: value }) => { value.programs[0].userOnlyInputs = ['actual-password']; }, 'invalid option');
expectFailure('rejects unbounded promotion methods', ({ plan: value }) => { value.siteProfile.promotionMethods = ['email_list']; }, 'invalid input');
expectFailure('rejects credential-like free text', ({ plan: value }) => { value.programs[0].applicationPositioning = 'Use this public positioning only after login. password=not-a-real-value must never enter a public artifact or repository field.'; }, 'must not contain credential');
expectFailure('rejects credential-like free text without punctuation', ({ plan: value }) => { value.programs[0].applicationPositioning = 'Use this public positioning only after login. password not-a-real-value must never enter a public artifact or repository field.'; }, 'must not contain credential');
expectFailure('rejects private contact values in free text', ({ plan: value }) => { value.programs[0].applicationPositioning = 'This deliberately overlong application positioning contains a private-contact@example.com value that must never enter a public artifact or repository field.'; }, 'must not contain credential');
expectFailure('rejects noncanonical production URL', ({ plan: value }) => { value.siteProfile.productionUrl = 'https://example.com/'; }, 'invalid input');
expectFailure('rejects incomplete public portal packet', ({ plan: value }) => { value.programs[0].publicPortalFields = ['site_name', 'about_copy', 'profile_image_if_used']; }, 'requires site_url');
expectFailure('rejects stale coverage registry hash', ({ coverage: value }) => { value.registrySha256 = 'f'.repeat(64); }, 'registry sha-256');
expectFailure('rejects stale coverage registry timestamp', ({ coverage: value }) => { value.registryUpdatedAt = '2026-10-09T00:00:00.000Z'; }, 'update time');
expectFailure('rejects stale coverage program revision', ({ coverage: value }) => { value.programs[0].programRevision += 1; }, 'coverage revision');
expectFailure('rejects unknown zero-count coverage program', ({ coverage: value }) => {
  value.programs.push({
    programId: 'invented-zero-program',
    programRevision: 1,
    priority: 6,
    status: 'proposed',
    selectionMode: 'all_products_in_eligible_articles',
    eligibleArticleCount: 0,
    productResearchCandidates: 0,
    verifiedPaidLinks: 0
  });
}, 'coverage has unknown programs');
expectFailure('rejects credential-like site name', ({ plan: value }) => { value.siteProfile.siteName = 'Password DEMO_PASSWORD_12345'; }, 'must not contain credential');
expectArtifactFailure('artifact rejects duplicate program IDs', (artifact) => { artifact.programs[1].programId = artifact.programs[0].programId; }, 'must be unique');
expectArtifactFailure('artifact rejects false global counts', (artifact) => { artifact.counts.totalPrograms = 999; }, 'must derive');
expectArtifactFailure('artifact rejects plausible false product coverage', (artifact) => { artifact.counts.productResearchCandidates = 61; }, 'match the explicit product key set');
expectArtifactFailure('artifact rejects orphan global research keys', (artifact) => {
  artifact.productResearchProductKeys.push('invented-guide:invented-product');
  artifact.counts.productResearchCandidates += 1;
}, 'equal the union of program research rosters');
expectArtifactFailure('artifact rejects impossible proposed stage', (artifact) => { artifact.programs[1].stage = 'exact_link_research'; }, 'stage must be founder_approval_required');
expectArtifactFailure('artifact rejects proposed enrollment permission', (artifact) => { artifact.programs[1].externalEnrollmentAllowedByRegistry = true; artifact.counts.externalEnrollmentAllowedByRegistry += 1; }, 'enrollment permission');
expectArtifactFailure('artifact rejects proposed account and tracking claims', (artifact) => { artifact.programs[1].externalAccountEstablished = true; artifact.programs[1].trackingIdentityConfigured = true; artifact.counts.externallyEnrolled += 1; }, 'proposed state');
expectArtifactFailure('artifact rejects false per-program product coverage', (artifact) => { artifact.programs[0].productResearchCandidates += 1; }, 'match its explicit product key set');
expectArtifactFailure('artifact rejects false per-program product roster', (artifact) => { artifact.programs[0].productResearchProductKeys.pop(); }, 'match its explicit product key set');
expectArtifactFailure('artifact rejects paid-link claims for disabled programs', (artifact) => {
  const productKey = artifact.programs[0].productResearchProductKeys[0];
  artifact.programs[0].verifiedPaidProductKeys = [productKey];
  artifact.programs[0].verifiedPaidLinks = 1;
  artifact.verifiedPaidProductKeys = [productKey];
  artifact.counts.verifiedPaidLinks = 1;
}, 'only enabled programs');
expectArtifactFailure('artifact rejects orphan global paid keys', (artifact) => {
  const productKey = artifact.programs[0].productResearchProductKeys[0];
  artifact.verifiedPaidProductKeys = [productKey];
  artifact.counts.verifiedPaidLinks = 1;
}, 'equal the union of program paid rosters');
expectArtifactFailure('artifact rejects URLs with embedded credentials', (artifact) => { artifact.programs[0].programHomepageUrl = 'https://user:pass@bookshop.org/'; }, 'credential-free');
expectArtifactFailure('artifact rejects URLs with credential-like query strings', (artifact) => { artifact.programs[0].programHomepageUrl = 'https://bookshop.org/?token=DEMO_SECRET_123'; }, 'query');
expectArtifactFailure('artifact rejects credential-like program names', (artifact) => { artifact.programs[0].programName = 'Password DEMO_PASSWORD_12345'; }, 'must not contain credential');
expectArtifactFailure('artifact rejects credential-like next gates', (artifact) => { artifact.programs[0].nextGate = 'Portal password DEMO_PASSWORD_12345 should never appear inside the public readiness artifact.'; }, 'must not contain credential');

const paused = copy(clean);
const pausedBookshop = paused.programs.find((program) => program.programId === 'bookshop-org-us-media');
pausedBookshop.registryStatus = 'paused';
pausedBookshop.stage = 'paused';
pausedBookshop.externalEnrollmentAllowedByRegistry = false;
pausedBookshop.externalAccountEstablished = true;
pausedBookshop.trackingIdentityConfigured = true;
paused.counts.externalEnrollmentAllowedByRegistry = 0;
paused.counts.externallyEnrolled = 1;
affiliateEnrollmentReadinessSchema.parse(paused);

console.log(JSON.stringify({ affiliateEnrollmentGateTests: 'passed', checks: 35, sensitiveValuesStored: false, externalSubmissionsAttempted: false }, null, 2));
