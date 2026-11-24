import fs from 'node:fs/promises';
import path from 'node:path';
import { socialCreativeFailureSchema } from './lib/social-creative-production-contract.mjs';

const root = process.cwd();
const directory = path.join(root, 'social', 'failures');
let names = [];
try { names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const issues = [];
for (const name of names) {
  try {
    const record = socialCreativeFailureSchema.parse(JSON.parse(await fs.readFile(path.join(directory, name), 'utf8')));
    if (name !== `${record.failureId}.json`) issues.push(`${name}: filename must match failureId`);
  } catch (error) { issues.push(`${name}: ${error.message}`); }
}
if (issues.length) {
  console.error(`Social creative failure gate failed with ${issues.length} issue${issues.length === 1 ? '' : 's'}:`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else console.log(JSON.stringify({ socialCreativeFailureGate: 'passed', records: names.length }, null, 2));
