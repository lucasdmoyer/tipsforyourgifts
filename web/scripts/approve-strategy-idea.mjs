import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const strategyPath = path.join(root, 'src', 'data', 'strategy.json');
const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));

if (!/^founder-idea-\d{3}$/.test(args['idea-id'] ?? '')) {
  throw new Error('Usage: npm run strategy:approve -- --idea-id=founder-idea-005 --expected-revision=1');
}
const expectedRevision = Number(args['expected-revision']);
if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new Error('expected-revision must be a positive integer');

const strategy = JSON.parse(await fs.readFile(strategyPath, 'utf8'));
const idea = strategy.ideas.find((entry) => entry.id === args['idea-id']);
if (!idea) throw new Error(`Unknown strategy idea: ${args['idea-id']}`);
if (idea.revision !== expectedRevision) throw new Error(`${idea.id} is revision ${idea.revision}, not expected revision ${expectedRevision}`);
if (idea.founderDisposition !== 'proposed') throw new Error(`${idea.id} is ${idea.founderDisposition}; only proposed ideas can be approved`);

idea.revision += 1;
idea.founderDisposition = 'approved_for_research';
strategy.updatedAt = new Date().toISOString();
await fs.writeFile(strategyPath, `${JSON.stringify(strategy, null, 2)}\n`);

if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(process.env.GITHUB_OUTPUT, `idea_id=${idea.id}\nidea_revision=${idea.revision}\n`);
}
console.log(JSON.stringify({ approved: true, ideaId: idea.id, revision: idea.revision }, null, 2));
