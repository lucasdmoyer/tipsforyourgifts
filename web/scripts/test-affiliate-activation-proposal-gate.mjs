import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from './lib/front-matter.mjs';
import { affiliateActivationApprovalBoundarySha256, affiliateActivationProposalSchema, validateAffiliateActivationProposals } from './lib/affiliate-activation-proposal-contract.mjs';

const root = process.cwd();
const document = affiliateActivationProposalSchema.parse(JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-activation-proposals.json'), 'utf8')));
const evidenceRecords = new Map(await Promise.all(document.proposals.map(async (proposal) => {
  const raw = await fs.readFile(path.join(root, proposal.evidence.observationReceiptPath));
  return [proposal.evidence.observationReceiptPath, { raw, data: JSON.parse(raw.toString('utf8')) }];
})));
const affiliate = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const blogDir = path.join(root, 'src', 'data', 'blog');
const articleNames = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md')).sort();
const articles = await Promise.all(articleNames.map(async (name) => ({
  ...matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data,
  slug: name.replace(/\.md$/, '')
})));

function copy(value) { return structuredClone(value); }
function expectFailure(label, mutate, expectedText) {
  const model = {
    document: copy(document),
    affiliate: copy(affiliate),
    articles: copy(articles),
    evidenceRecords: new Map([...evidenceRecords].map(([key, record]) => [key, { raw: Buffer.from(record.raw), data: copy(record.data) }]))
  };
  const originalActivationDigest = model.affiliate.programs[0].account.activationProposalSha256;
  mutate(model);
  if (model.affiliate.programs[0].enabled === true && model.affiliate.programs[0].account.activationProposalSha256 === originalActivationDigest) {
    model.affiliate.programs[0].account.activationProposalSha256 = affiliateActivationApprovalBoundarySha256(model.document.proposals[0]);
  }
  assert.throws(
    () => validateAffiliateActivationProposals(model),
    (error) => String(error?.message ?? error).toLowerCase().includes(expectedText.toLowerCase()),
    label
  );
}

const clean = validateAffiliateActivationProposals({ document, affiliate, articles, evidenceRecords });
assert.equal(clean.proposals.length, 1);
const activationRecorded = affiliate.programs[0].status === 'enabled' && affiliate.programs[0].enabled === true;
assert.equal(clean.proposals[0].activationState, activationRecorded ? 'activation_recorded' : 'awaiting_founder_terms_acceptance');
assert.match(clean.proposals[0].approvalBoundarySha256, /^[a-f0-9]{64}$/);
expectFailure('rejects a changed tracking identity', ({ document: value }) => { value.proposals[0].evidence.publicTrackingIdentity = '999999'; }, 'tracking identity');
expectFailure('rejects a paid path that does not bind the identity and ISBN', ({ document: value }) => { value.proposals[0].evidence.observedPaidUrl = 'https://bookshop.org/a/129750/9780000000000'; }, 'paid path');
expectFailure('rejects a redirect that loses tracking', ({ document: value }) => { value.proposals[0].evidence.observedResolvedUrl = value.proposals[0].evidence.observedResolvedUrl.replace('affiliate=129750', 'affiliate=999999'); }, 'resolved affiliate value');
expectFailure('rejects duplicate tracking parameters', ({ document: value }) => { value.proposals[0].evidence.observedResolvedUrl += '&affiliate=evil'; }, 'duplicate, case-colliding');
expectFailure('rejects case-colliding tracking parameters', ({ document: value }) => { value.proposals[0].evidence.observedResolvedUrl += '&Affiliate=evil'; }, 'duplicate, case-colliding');
expectFailure('rejects unapproved extra parameters', ({ document: value }) => { value.proposals[0].evidence.observedResolvedUrl += '&subid=evil'; }, 'duplicate, case-colliding');
expectFailure('rejects the wrong resolved product path', ({ document: value }) => { value.proposals[0].evidence.observedResolvedUrl = value.proposals[0].evidence.observedResolvedUrl.replace('/031a784adc6e9de4?', '/wrong-product?'); }, 'resolved product path');
expectFailure('rejects a changed edition', ({ document: value }) => { value.proposals[0].evidence.productIsbn = '9780000000000'; }, 'isbn');
expectFailure('rejects a product outside the activation allowlist', ({ document: value }) => { value.proposals[0].evidence.productId = 'genius-of-birds-paperback'; }, 'activation allowlist');
expectFailure('rejects activation with a changed proposal receipt', ({ affiliate: value }) => { value.programs[0].account.activationProposalSha256 = 'f'.repeat(64); }, 'program activation is not bound');
expectFailure('rejects activation without founder terms acceptance', ({ affiliate: value }) => { value.programs[0].account.termsAcceptedByFounder = false; value.programs[0].account.termsAcceptedAt = null; }, 'terms acceptance evidence');
expectFailure('rejects an unrelated path on the terms host', ({ document: value }) => { value.proposals[0].evidence.termsResolvedUrl = 'https://bookshop-webflow.bkshp.org/unrelated'; }, 'resolved terms url');
expectFailure('rejects a changed observation receipt digest', ({ document: value }) => { value.proposals[0].evidence.observationReceiptSha256 = 'f'.repeat(64); }, 'receipt sha-256');
expectFailure('rejects a receipt whose observer differs', ({ evidenceRecords: value, document: proposalDocument }) => { value.get(proposalDocument.proposals[0].evidence.observationReceiptPath).data.observerId = 'different-observer'; }, 'observerid differs');
expectFailure('rejects observation before account verification', ({ affiliate: value }) => { value.programs[0].account.verificationObservedAt = '2026-10-19T01:30:00.000Z'; value.updatedAt = '2026-10-19T01:31:00.000Z'; }, 'chronology');
expectFailure('rejects an article already mutated into affiliate content', ({ articles: value }) => { value.find((article) => article.slug === 'read-it-then-play-it-gift-pairs').products.find((product) => product.id === 'sapiens-us-paperback').affiliate = true; }, 'non-affiliate');
expectFailure('rejects reporting expansion', ({ document: value }) => { value.proposals[0].activation.reportingExportApproved = true; }, 'invalid input');
expectFailure('rejects production authority expansion', ({ document: value }) => { value.proposals[0].assertions.productionDeploymentAuthorized = true; }, 'invalid input');

console.log(JSON.stringify({ affiliateActivationProposalGateTests: 'passed', checks: 21, termsAccepted: activationRecorded, paidLinksCreated: false, productionDeploymentsAuthorized: false }, null, 2));
