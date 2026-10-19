import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from './lib/front-matter.mjs';
import { validateAffiliateModel } from './lib/affiliate-contract.mjs';

const root = process.cwd();
const base = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const publishedSlugs = new Set([
  'gifts-for-a-golf-friend',
  'how-we-research-gifts',
  'knitting-crochet-project-bag-row-counter-gift-pairs',
  'language-learning-gifts-read-a-scene-say-it-aloud',
  'miniature-painting-wet-palette-recipe-pairs',
  'muddy-paw-washer-drying-towel-gift-pairs',
  'neighborhood-tree-walk-field-guide-loupe-gift-pairs',
  'night-sky-planisphere-red-light-gift-pairs',
  'one-photo-one-story-gift-pairs',
  'puzzle-board-sorting-tray-gift-pairs',
  'read-it-then-play-it-gift-pairs',
  'useful-gifts-for-hard-to-shop-for-adults',
  'vinyl-record-cleaner-inner-sleeve-gift-pairs'
]);
const blogDir = path.join(root, 'src', 'data', 'blog');
const publishedProductsByArticle = new Map();
for (const name of (await fs.readdir(blogDir)).filter((entry) => entry.endsWith('.md'))) {
  const article = matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data;
  if (article.status === 'publication_ready') {
    publishedProductsByArticle.set(path.basename(name, '.md'), new Set((article.products ?? []).map((product) => product.id)));
  }
}
const options = { publishedSlugs, publishedProductsByArticle, asOfDate: '2026-08-03' };

function copy(value) { return structuredClone(value); }
function programWithStatus(model, status) {
  let program = model.programs.find((candidate) => candidate.status === status);
  if (!program && status === 'founder_approved') {
    program = model.programs.find((candidate) => candidate.status === 'proposed');
    if (program) {
      program.status = 'founder_approved';
      program.founderDisposition = 'approved';
    }
  }
  if (!program) throw new Error(`fixture needs one ${status} affiliate program`);
  return program;
}
function addVerificationEvidence(program) {
  program.account.externalAccountEstablished = true;
  program.account.trackingIdentityConfigured = true;
  program.account.verificationStatus = 'verified';
  program.account.verificationObservedAt = '2026-08-03T09:00:00.000Z';
  program.account.publicTrackingIdentity = '129750';
  program.account.publicStorefrontUrl = 'https://bookshop.org/shop/tipsforyourgifts';
}
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
const proposedCandidate = programWithStatus(approvedCandidate, 'proposed');
proposedCandidate.status = 'founder_approved';
proposedCandidate.founderDisposition = 'approved';
proposedCandidate.revision += 1;
const approvedCandidateIssues = validateAffiliateModel(approvedCandidate, options);
if (approvedCandidateIssues.length > 0) throw new Error(`founder-approved disabled candidate should pass: ${approvedCandidateIssues.join('; ')}`);

const broadActivationCandidate = copy(base);
broadActivationCandidate.programs[1].activationProductSelection = { mode: 'explicit_products', eligibleProductIds: ['sapiens-us-paperback'] };
const broadActivationCandidateIssues = validateAffiliateModel(broadActivationCandidate, options);
if (broadActivationCandidateIssues.length > 0) throw new Error(`broad research with a narrow activation allowlist should pass: ${broadActivationCandidateIssues.join('; ')}`);

expectFailure('rejects duplicate IDs', (model) => { model.programs.push(copy(model.programs[0])); }, 'duplicate program id');
expectFailure('rejects duplicate priorities', (model) => { model.programs[1].priority = model.programs[0].priority; }, 'duplicate program priority');
expectFailure('rejects priority gaps', (model) => { model.programs[4].priority = 99; }, 'program priorities must be contiguous');
expectFailure('rejects unsorted priorities', (model) => { [model.programs[0], model.programs[1]] = [model.programs[1], model.programs[0]]; }, 'registry order must be ascending');
expectFailure('rejects duplicate eligible articles', (model) => { model.programs[0].eligibleArticleSlugs.push(model.programs[0].eligibleArticleSlugs[0]); }, 'eligible article slugs cannot contain duplicates');
expectFailure('rejects duplicate research candidate products', (model) => { model.programs[0].researchCandidateSelection.eligibleProductIds.push(model.programs[0].researchCandidateSelection.eligibleProductIds[0]); }, 'research candidate product ids cannot contain duplicates');
expectFailure('rejects unknown research candidate products', (model) => { model.programs[0].researchCandidateSelection.eligibleProductIds = ['invented-product']; }, 'unknown research candidate product');
expectFailure('rejects research candidate outside configured articles', (model) => { model.programs[0].researchCandidateSelection.eligibleProductIds = ['grooveit-minig']; }, 'unknown research candidate product');
expectFailure('rejects activation outside research candidates', (model) => { model.programs[0].activationProductSelection.eligibleProductIds = ['invented-product']; }, 'must also be an explicit research candidate');
expectFailure('all-article selection rejects explicit product IDs', (model) => { model.programs[1].researchCandidateSelection.eligibleProductIds = ['grooveit-minig']; }, 'expected array to have <=0 items');
expectFailure('automatic publication coverage rejects a manual article allowlist', (model) => { model.programs[1].eligibleArticleSlugs = ['gifts-for-a-golf-friend']; }, 'cannot carry a manual article allowlist');
expectFailure('explicit selection requires an article scope', (model) => { model.programs[0].eligibleArticleSlugs = []; }, 'requires at least one eligible article');
expectFailure('rejects unknown articles', (model) => { model.programs[0].eligibleArticleSlugs = ['invented-guide']; }, 'unknown publication-ready article');
expectFailure('proposals cannot contain tracking setup', (model) => { programWithStatus(model, 'proposed').trackingParameterKeys = ['tag']; }, 'cannot contain verification, activation, or tracking evidence');
expectFailure('founder-approved programs cannot contain tracking setup', (model) => { programWithStatus(model, 'founder_approved').trackingParameterKeys = ['tag']; }, 'cannot contain unreviewed verification, activation, or tracking evidence');
expectFailure('externally verified requires complete evidence', (model) => {
  const program = programWithStatus(model, 'founder_approved');
  program.status = 'externally_verified';
}, 'requires observed account');
expectFailure('enabled flag must match status', (model) => { programWithStatus(model, 'proposed').enabled = true; }, 'enabled flag must exactly match');
expectFailure('enabled requires account', (model) => {
  const program = programWithStatus(model, 'founder_approved');
  program.status = 'enabled';
  program.enabled = true;
  program.founderDisposition = 'approved';
}, 'externally established account');
expectFailure('enabled requires terms evidence', (model) => {
  const program = programWithStatus(model, 'founder_approved');
  program.status = 'enabled'; program.enabled = true; program.founderDisposition = 'approved';
  addVerificationEvidence(program);
  program.allowedDomains = ['bookshop.org']; program.registeredSites = ['https://tipsforyourgifts.web.app'];
  program.trackingParameterKeys = ['affiliate']; program.requiredDisclosure = model.policy.defaultDisclosure;
}, 'terms acceptance evidence');
expectFailure('enabled requires approved disclosure', (model) => {
  const program = programWithStatus(model, 'founder_approved');
  program.status = 'enabled'; program.enabled = true; program.founderDisposition = 'approved';
  addVerificationEvidence(program);
  Object.assign(program.account, { termsAcceptedByFounder: true, termsAcceptedAt: '2026-08-03T10:00:00.000Z', acceptanceEvidenceReference: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/1', reportingExportApproved: false });
  program.allowedDomains = ['bookshop.org']; program.registeredSites = ['https://tipsforyourgifts.web.app']; program.trackingParameterKeys = ['affiliate'];
}, 'approved disclosure');
expectFailure('enabled terms review expires', (model) => {
  const program = programWithStatus(model, 'founder_approved');
  program.status = 'enabled'; program.enabled = true; program.founderDisposition = 'approved';
  addVerificationEvidence(program);
  Object.assign(program.account, { termsAcceptedByFounder: true, termsAcceptedAt: '2026-08-03T10:00:00.000Z', acceptanceEvidenceReference: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/1', reportingExportApproved: false });
  program.allowedDomains = ['bookshop.org']; program.registeredSites = ['https://tipsforyourgifts.web.app']; program.trackingParameterKeys = ['affiliate']; program.requiredDisclosure = model.policy.defaultDisclosure;
  program.sourceReviewExpiresAt = '2026-08-02';
}, 'terms review has expired');

console.log(JSON.stringify({ affiliateNegativeGateTests: 'passed', checks: 21, founderApprovedDisabledCheck: 'passed', externallyVerifiedDisabledCheck: 'passed', researchActivationSeparation: 'passed', broadResearchNarrowActivation: 'passed' }, null, 2));
