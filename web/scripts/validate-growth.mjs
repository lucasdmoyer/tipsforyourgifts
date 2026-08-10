import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { validateGrowthModel } from './lib/growth-contract.mjs';

const root = process.cwd();
const growth = JSON.parse(await fs.readFile(path.join(root, 'src', 'data', 'growth.json'), 'utf8'));
const affiliate = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const blogDir = path.join(root, 'src', 'data', 'blog');
const articleNames = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md'));
const articleData = await Promise.all(articleNames.map(async (name) => ({
  slug: path.basename(name, '.md'),
  ...matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data
})));
const publishedSlugs = new Set(articleData.filter((article) => article.status === 'publication_ready').map((article) => article.slug));
const issues = validateGrowthModel(growth, {
  publishedSlugs,
  affiliateProgramsEnabled: affiliate.programs.filter((program) => program.enabled).length
});

if (issues.length > 0) {
  console.error(`Growth gate failed with ${issues.length} issue${issues.length === 1 ? '' : 's'}:`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    gate: 'passed',
    connectors: growth.connectors.length,
    activeConnectors: growth.connectors.filter((connector) => connector.status === 'active').length,
    snapshots: growth.snapshots.length,
    experiments: growth.experiments.length,
    approvedExperiments: growth.experiments.filter((experiment) => experiment.founderDisposition === 'approved').length,
    personalDataStored: false
  }, null, 2));
}
