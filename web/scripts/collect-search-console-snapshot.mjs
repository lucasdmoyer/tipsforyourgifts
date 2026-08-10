import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { collectSearchConsoleSnapshot, latestFinalizedWeeklyWindow } from './lib/search-console-collector.mjs';
import { growthSnapshotSchema } from './lib/growth-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
if (!args.output || !args['evidence-url']) throw new Error('Usage: collect-search-console-snapshot --output=/path/snapshot.json --evidence-url=https://github.com/.../actions/runs/... [--period-start=YYYY-MM-DD --period-end=YYYY-MM-DD]');
const accessToken = process.env.SEARCH_CONSOLE_ACCESS_TOKEN;
if (!accessToken) throw new Error('SEARCH_CONSOLE_ACCESS_TOKEN is required and must be supplied only through the environment');

const root = process.cwd();
const growth = JSON.parse(await fs.readFile(path.join(root, 'src', 'data', 'growth.json'), 'utf8'));
const connector = growth.connectors.find((entry) => entry.id === 'search-console');
const blogDir = path.join(root, 'src', 'data', 'blog');
const names = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md')).sort();
const articles = [];
for (const name of names) {
  const data = matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data;
  if (data.status === 'publication_ready') articles.push({ slug: path.basename(name, '.md') });
}
const defaultWindow = latestFinalizedWeeklyWindow();
const periodStart = args['period-start'] ?? defaultWindow.periodStart;
const periodEnd = args['period-end'] ?? defaultWindow.periodEnd;
const snapshot = growthSnapshotSchema.parse(await collectSearchConsoleSnapshot({
  connector, articles, accessToken, evidenceUrl: args['evidence-url'], periodStart, periodEnd
}));
const outputPath = path.resolve(args.output);
await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ collected: snapshot.id, periodStart, periodEnd, articles: snapshot.articles.length, rawQueriesStored: false, personalDataStored: false, accessTokenStored: false, outputPath }, null, 2));
