import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from './lib/front-matter.mjs';
import { buildAffiliateCoverage } from './lib/affiliate-coverage-contract.mjs';
import { validateAffiliateModel } from './lib/affiliate-contract.mjs';
import { loadAffiliateLinkState } from './lib/affiliate-link-contract.mjs';

const root = process.cwd();
const blogDir = path.join(root, 'src', 'data', 'blog');
const outputPath = path.join(root, 'public', 'affiliate-product-coverage.json');
const articles = [];
const publishedSlugs = new Set();
const publishedProductsByArticle = new Map();
for (const name of (await fs.readdir(blogDir)).filter((entry) => entry.endsWith('.md')).sort()) {
  const data = matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data;
  const article = { ...data, slug: path.basename(name, '.md') };
  articles.push(article);
  if (article.status === 'publication_ready') {
    publishedSlugs.add(article.slug);
    publishedProductsByArticle.set(article.slug, new Set((article.products ?? []).map((product) => product.id)));
  }
}
const linkState = await loadAffiliateLinkState(root);
const issues = validateAffiliateModel(linkState.affiliate, {
  publishedSlugs,
  publishedProductsByArticle,
  asOfDate: new Date().toISOString().slice(0, 10)
});
if (issues.length > 0) throw new Error(`Affiliate coverage source is invalid: ${issues.join('; ')}`);
const coverage = buildAffiliateCoverage({
  affiliate: linkState.affiliate,
  registrySha256: linkState.registrySha256,
  articles,
  overlays: linkState.overlays
});
await fs.writeFile(outputPath, `${JSON.stringify(coverage, null, 2)}\n`);
console.log(JSON.stringify({
  generated: path.relative(root, outputPath),
  products: coverage.counts.publicationReadyProductLinksCataloged,
  assignedToPartnerResearch: coverage.counts.productsAssignedToPartnerResearch,
  researchGaps: coverage.counts.productsWithoutPartnerResearch,
  verifiedPaidDestinations: coverage.counts.productsWithVerifiedPaidDestination
}, null, 2));
