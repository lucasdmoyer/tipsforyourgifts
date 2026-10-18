import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from './lib/front-matter.mjs';
import { validateAffiliateModel } from './lib/affiliate-contract.mjs';

const root = process.cwd();
const configPath = path.join(root, 'config', 'affiliate-programs.json');
const blogDir = path.join(root, 'src', 'data', 'blog');
const model = JSON.parse(await fs.readFile(configPath, 'utf8'));
const articleNames = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md'));
const publishedSlugs = new Set();
const publishedProductsByArticle = new Map();
for (const name of articleNames) {
  const article = matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data;
  if (article.status === 'publication_ready') {
    const articleSlug = path.basename(name, '.md');
    publishedSlugs.add(articleSlug);
    publishedProductsByArticle.set(articleSlug, new Set((article.products ?? []).map((product) => product.id)));
  }
}
const issues = validateAffiliateModel(model, { publishedSlugs, publishedProductsByArticle, asOfDate: new Date().toISOString().slice(0, 10) });

if (issues.length > 0) {
  console.error(`Affiliate gate failed with ${issues.length} issue${issues.length === 1 ? '' : 's'}:`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    gate: 'passed',
    proposedPrograms: model.programs.filter((program) => program.status === 'proposed').length,
    founderApprovedPrograms: model.programs.filter((program) => program.status === 'founder_approved').length,
    externallyVerifiedPrograms: model.programs.filter((program) => program.status === 'externally_verified').length,
    enabledPrograms: model.programs.filter((program) => program.enabled).length,
    publicTrackingIdentitiesStored: model.programs.filter((program) => program.account.publicTrackingIdentity).length,
    externalAccountsChanged: false
  }, null, 2));
}
