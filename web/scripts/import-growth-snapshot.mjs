import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { growthSnapshotSchema, validateGrowthModel } from './lib/growth-contract.mjs';

const root = process.cwd();
const inputArg = process.argv.slice(2).find((argument) => argument.startsWith('--input='));
const ifExistsArg = process.argv.slice(2).find((argument) => argument.startsWith('--if-exists='));
const ifExists = ifExistsArg?.slice('--if-exists='.length) ?? 'error';
if (!['error', 'no-op'].includes(ifExists)) throw new Error('--if-exists must be error or no-op');
if (!inputArg) throw new Error('Usage: node scripts/import-growth-snapshot.mjs --input=/absolute/path/to/aggregate-snapshot.json');
const inputPath = path.resolve(inputArg.slice('--input='.length));
const growthPath = path.join(root, 'src', 'data', 'growth.json');
const snapshot = growthSnapshotSchema.parse(JSON.parse(await fs.readFile(inputPath, 'utf8')));
const growth = JSON.parse(await fs.readFile(growthPath, 'utf8'));
const existing = growth.snapshots.find((entry) => entry.id === snapshot.id);
if (existing) {
  if (ifExists === 'no-op' && JSON.stringify(existing) === JSON.stringify(snapshot)) {
    if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `imported=false\nsnapshot_id=${snapshot.id}\n`);
    console.log(JSON.stringify({ imported: false, reason: 'identical_snapshot_already_exists', snapshotId: snapshot.id, personalDataStored: false }, null, 2));
    process.exit(0);
  }
  throw new Error(`Growth snapshot ${snapshot.id} already exists${ifExists === 'no-op' ? ' with different bytes' : ''}`);
}
growth.snapshots.push(snapshot);
growth.snapshots.sort((left, right) => left.periodEnd.localeCompare(right.periodEnd) || left.id.localeCompare(right.id));
growth.updatedAt = [growth.updatedAt, snapshot.collectedAt].sort().at(-1);

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
if (issues.length > 0) throw new Error(`Growth snapshot rejected:\n- ${issues.join('\n- ')}`);

await fs.writeFile(growthPath, `${JSON.stringify(growth, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `imported=true\nsnapshot_id=${snapshot.id}\n`);
console.log(JSON.stringify({ imported: snapshot.id, articles: snapshot.articles.length, personalDataStored: false }, null, 2));
