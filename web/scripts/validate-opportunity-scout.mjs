import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateOpportunityScoutRecords } from './lib/opportunity-scout-contract.mjs';

const root = process.cwd();

async function loadRecords(directory) {
  let names = [];
  try { names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort(); } catch {}
  return Promise.all(names.map(async (filename) => {
    const raw = await fs.readFile(path.join(directory, filename));
    return { filename, raw, data: JSON.parse(raw) };
  }));
}

const [policy, strategy, missions, reports, reviews] = await Promise.all([
  fs.readFile(path.join(root, 'config/opportunity-scout-policy.json'), 'utf8').then(JSON.parse),
  fs.readFile(path.join(root, 'src/data/strategy.json'), 'utf8').then(JSON.parse),
  loadRecords(path.join(root, 'research/opportunity-missions')),
  loadRecords(path.join(root, 'research/opportunities')),
  loadRecords(path.join(root, 'research/opportunity-reviews'))
]);

const result = validateOpportunityScoutRecords({ policy, strategy, missions, reports, reviews });
if (result.issues.length > 0) {
  console.error(`Opportunity scout gate failed with ${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}:`);
  for (const issue of result.issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    gate: 'passed',
    missions: result.missions.length,
    draftedReports: result.reports.filter((report) => report.status === 'drafted').length,
    validatedReports: result.reports.filter((report) => report.status === 'validated').length,
    reviewReceipts: result.reviews.length,
    externalWritesAttempted: false
  }, null, 2));
}
