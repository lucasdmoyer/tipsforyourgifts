import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { affiliateCoverageSchema, buildAffiliateCoverage } from './lib/affiliate-coverage-contract.mjs';
import { loadAffiliateLinkState } from './lib/affiliate-link-contract.mjs';

const root = process.cwd();
const blogDir = path.join(root, 'src', 'data', 'blog');
const coveragePath = path.join(root, 'public', 'affiliate-product-coverage.json');
const articles = await Promise.all((await fs.readdir(blogDir)).filter((entry) => entry.endsWith('.md')).sort().map(async (name) => ({
  ...matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data,
  slug: path.basename(name, '.md')
})));
const linkState = await loadAffiliateLinkState(root);
const actual = affiliateCoverageSchema.parse(JSON.parse(await fs.readFile(coveragePath, 'utf8')));
const expected = buildAffiliateCoverage({
  affiliate: linkState.affiliate,
  registrySha256: linkState.registrySha256,
  articles,
  overlays: linkState.overlays
});
assert.deepEqual(actual, expected, 'affiliate product coverage artifact is stale or does not match repository sources');
if (actual.counts.publicationReadyProductLinksCataloged === 0) throw new Error('affiliate coverage cannot pass with zero publication-ready product links');
console.log(JSON.stringify({
  gate: 'passed',
  products: actual.counts.publicationReadyProductLinksCataloged,
  assignedToPartnerResearch: actual.counts.productsAssignedToPartnerResearch,
  researchGaps: actual.counts.productsWithoutPartnerResearch,
  verifiedPaidDestinations: actual.counts.productsWithVerifiedPaidDestination,
  assignmentsAssertAvailability: false
}, null, 2));
