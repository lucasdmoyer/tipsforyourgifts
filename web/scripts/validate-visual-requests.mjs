import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from './lib/front-matter.mjs';
import { validateVisualRequestRecords } from './lib/visual-request-contract.mjs';

const root = process.cwd();

async function jsonRecords(directory) {
  let names = [];
  try {
    names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return Promise.all(names.map(async (filename) => {
    const raw = await fs.readFile(path.join(directory, filename));
    return { filename, raw, data: JSON.parse(raw) };
  }));
}

const requestRecords = await jsonRecords(path.join(root, 'visuals', 'requests'));
const runRecords = await jsonRecords(path.join(root, 'research', 'runs'));
const runsById = new Map(runRecords.map((record) => [record.data.runId, record]));
const articlesBySlug = new Map();
for (const filename of (await fs.readdir(path.join(root, 'src', 'data', 'blog'))).filter((name) => name.endsWith('.md')).sort()) {
  const raw = await fs.readFile(path.join(root, 'src', 'data', 'blog', filename));
  const parsed = matter(raw.toString('utf8'));
  articlesBySlug.set(path.basename(filename, '.md'), { filename, raw, data: parsed.data });
}
const visualRegistry = JSON.parse(await fs.readFile(path.join(root, 'visuals', 'article-visuals.json'), 'utf8'));
const visualArticleSlugs = new Set((visualRegistry.articles ?? []).map((entry) => entry.slug));
const result = validateVisualRequestRecords({ records: requestRecords, articlesBySlug, runsById, visualArticleSlugs });

if (result.issues.length > 0) {
  console.error(`Visual request validation failed with ${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}:`);
  for (const issue of result.issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(JSON.stringify({
  gate: 'passed',
  pendingVisualRequests: result.requests.length,
  mappedArticles: visualArticleSlugs.size,
  externalGenerationAttempted: false,
  productionAuthorized: false
}, null, 2));
