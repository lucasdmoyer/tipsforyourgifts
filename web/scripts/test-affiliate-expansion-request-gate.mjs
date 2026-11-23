import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateAffiliateExpansionRequests } from './lib/affiliate-expansion-request-contract.mjs';

const root = process.cwd();
const sourceDocument = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-expansion-requests.json'), 'utf8'));
const sourceAffiliate = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const copy = (value) => structuredClone(value);
async function expectFailure(label, mutate, expected) {
  const document = copy(sourceDocument);
  const affiliate = copy(sourceAffiliate);
  mutate({ document, affiliate });
  await assert.rejects(() => validateAffiliateExpansionRequests({ root, document, affiliate }), (error) => String(error?.message ?? error).toLowerCase().includes(expected), label);
}

const clean = await validateAffiliateExpansionRequests({ root, document: sourceDocument, affiliate: sourceAffiliate });
assert.equal(clean.summaries[0].requestedProducts, 9);
assert.equal(clean.summaries[0].paidUrlsCollected, 0);
await expectFailure('rejects silent activation expansion', ({ affiliate }) => affiliate.programs[0].activationProductSelection.eligibleProductIds.push('genius-of-birds-paperback'), 'activation scope changed');
await expectFailure('rejects invented tracking', ({ document }) => { document.requests[0].products[0].ordinaryEditorialUrl += '?affiliate=129750'; }, 'affiliate or referral parameter');
await expectFailure('rejects a non-Bookshop catalog host', ({ document }) => { document.requests[0].products[5].cleanBookshopCatalogUrl = 'https://example.com/p/books/fake'; }, 'catalog url is not clean');
await expectFailure('rejects a stale article binding', ({ document }) => { document.requests[0].articleSha256 = 'f'.repeat(64); }, 'article sha-256');
await expectFailure('rejects production authority', ({ document }) => { document.requests[0].assertions.productionDeploymentAuthorized = true; }, 'invalid input');
console.log(JSON.stringify({ affiliateExpansionRequestGateTests: 'passed', checks: 6, requestedProducts: 9, paidUrlsCreated: false, productionDeploymentsAuthorized: false }, null, 2));
