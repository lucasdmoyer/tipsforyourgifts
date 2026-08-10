import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateAffiliateModel } from './lib/affiliate-contract.mjs';

const root = process.cwd();
const base = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const publishedSlugs = new Set([
  'gifts-for-a-golf-friend',
  'how-we-research-gifts',
  'read-it-then-play-it-gift-pairs',
  'useful-gifts-for-hard-to-shop-for-adults'
]);
const options = { publishedSlugs, asOfDate: '2026-08-03' };

function copy(value) { return structuredClone(value); }
function expectFailure(label, mutate, expectedText) {
  const model = copy(base);
  mutate(model);
  const issues = validateAffiliateModel(model, options);
  if (issues.length === 0 || !issues.join('\n').toLowerCase().includes(expectedText.toLowerCase())) {
    throw new Error(`${label}: expected ${JSON.stringify(expectedText)}, received ${JSON.stringify(issues)}`);
  }
}

const cleanIssues = validateAffiliateModel(base, options);
if (cleanIssues.length > 0) throw new Error(`base affiliate model should pass: ${cleanIssues.join('; ')}`);

const approvedCandidate = copy(base);
approvedCandidate.programs[0].status = 'founder_approved';
approvedCandidate.programs[0].founderDisposition = 'approved';
approvedCandidate.programs[0].revision += 1;
const approvedCandidateIssues = validateAffiliateModel(approvedCandidate, options);
if (approvedCandidateIssues.length > 0) throw new Error(`founder-approved disabled candidate should pass: ${approvedCandidateIssues.join('; ')}`);

expectFailure('rejects duplicate IDs', (model) => { model.programs.push(copy(model.programs[0])); }, 'duplicate program id');
expectFailure('rejects unknown articles', (model) => { model.programs[0].eligibleArticleSlugs = ['invented-guide']; }, 'unknown publication-ready article');
expectFailure('proposals cannot contain tracking setup', (model) => { model.programs[0].trackingParameterKeys = ['tag']; }, 'cannot contain activation evidence');
expectFailure('enabled flag must match status', (model) => { model.programs[0].enabled = true; }, 'enabled flag must exactly match');
expectFailure('enabled requires account', (model) => {
  model.programs[0].status = 'enabled';
  model.programs[0].enabled = true;
  model.programs[0].founderDisposition = 'approved';
}, 'externally established account');
expectFailure('enabled requires terms evidence', (model) => {
  const program = model.programs[0];
  program.status = 'enabled'; program.enabled = true; program.founderDisposition = 'approved';
  program.account.externalAccountEstablished = true; program.account.trackingIdentityConfigured = true;
  program.allowedDomains = ['bookshop.org']; program.registeredSites = ['https://tipsforyourgifts.web.app'];
  program.trackingParameterKeys = ['affiliate']; program.requiredDisclosure = model.policy.defaultDisclosure;
}, 'terms acceptance evidence');
expectFailure('enabled requires approved disclosure', (model) => {
  const program = model.programs[0];
  program.status = 'enabled'; program.enabled = true; program.founderDisposition = 'approved';
  program.account = { externalAccountEstablished: true, trackingIdentityConfigured: true, termsAcceptedByFounder: true, termsAcceptedAt: '2026-08-03T10:00:00.000Z', acceptanceEvidenceReference: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/1', reportingExportApproved: false };
  program.allowedDomains = ['bookshop.org']; program.registeredSites = ['https://tipsforyourgifts.web.app']; program.trackingParameterKeys = ['affiliate'];
}, 'approved disclosure');
expectFailure('enabled terms review expires', (model) => {
  const program = model.programs[0];
  program.status = 'enabled'; program.enabled = true; program.founderDisposition = 'approved';
  program.account = { externalAccountEstablished: true, trackingIdentityConfigured: true, termsAcceptedByFounder: true, termsAcceptedAt: '2026-08-03T10:00:00.000Z', acceptanceEvidenceReference: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/1', reportingExportApproved: false };
  program.allowedDomains = ['bookshop.org']; program.registeredSites = ['https://tipsforyourgifts.web.app']; program.trackingParameterKeys = ['affiliate']; program.requiredDisclosure = model.policy.defaultDisclosure;
  program.sourceReviewExpiresAt = '2026-08-02';
}, 'terms review has expired');

console.log(JSON.stringify({ affiliateNegativeGateTests: 'passed', checks: 8, founderApprovedDisabledCheck: 'passed' }, null, 2));
