import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { researchMissionSchema } from './lib/research-mission-contract.mjs';
import { parsePublicationPolicy } from './lib/publication-policy-contract.mjs';
import { resolveVisualAutoMerge } from './lib/visual-auto-merge-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
if (!/^research-mission-[1-9]\d*-[1-9]\d*$/.test(args['mission-id'] ?? '')) throw new Error('A valid mission ID is required');
if (!['promotion', 'failure'].includes(args.route ?? '')) throw new Error('Visual result route must be promotion or failure');

const root = process.cwd();
const publicationPolicy = parsePublicationPolicy(JSON.parse(await fs.readFile(path.join(root, 'config', 'publication-policy.json'), 'utf8')));
const mission = researchMissionSchema.parse(JSON.parse(await fs.readFile(path.join(root, 'research', 'missions', `${args['mission-id']}.json`), 'utf8')));
const result = resolveVisualAutoMerge({ route: args.route, publicationPolicy, mission });
if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(process.env.GITHUB_OUTPUT, [
    `eligible=${result.eligible}`,
    `reason=${result.reason}`,
    ''
  ].join('\n'));
}
console.log(JSON.stringify({ ...result, autoMergeRequested: false, productionAuthorized: false }, null, 2));
