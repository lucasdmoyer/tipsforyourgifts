import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { loadAffiliateLinkState } from './lib/affiliate-link-contract.mjs';
import { resolveAffiliateReviewHandoffs } from './lib/affiliate-review-handoff-contract.mjs';

const execFile = promisify(execFileCallback);
const root = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const before = args.before;
const after = args.after;
if (!/^[a-f0-9]{40,64}$/.test(before ?? '') || !/^[a-f0-9]{40,64}$/.test(after ?? '')) {
  throw new Error('before and after must be lowercase Git commit object IDs');
}

async function git(...gitArgs) {
  const { stdout } = await execFile('git', gitArgs, { cwd: path.resolve(root, '..'), maxBuffer: 8 * 1024 * 1024 });
  return stdout.trim();
}

const checkedOutCommit = await git('rev-parse', 'HEAD^{commit}');
const afterCommit = await git('rev-parse', `${after}^{commit}`);
if (checkedOutCommit !== afterCommit) throw new Error('after must equal the exact checked-out commit');

const diffArgs = /^0+$/.test(before)
  ? ['diff-tree', '--root', '--no-commit-id', '--name-status', '--no-renames', '-r', '-z', after, '--', 'web/affiliate/candidates']
  : ['diff', '--name-status', '--no-renames', '-z', before, after, '--', 'web/affiliate/candidates'];
const { stdout: rawDiff } = await execFile('git', diffArgs, { cwd: path.resolve(root, '..'), maxBuffer: 8 * 1024 * 1024 });
const tokens = rawDiff.split('\0');
if (tokens.at(-1) === '') tokens.pop();
if (tokens.length % 2 !== 0) throw new Error('candidate diff was not a sequence of status and path pairs');
const changes = [];
for (let index = 0; index < tokens.length; index += 2) {
  changes.push({ status: tokens[index], path: tokens[index + 1].replace(/^web\//, '') });
}

const state = await loadAffiliateLinkState(root);
const handoffs = resolveAffiliateReviewHandoffs({ changes, candidates: state.candidates, reviews: state.reviews });
const outputPath = args.output ? path.resolve(args.output) : null;
if (outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, handoffs.map((handoff) => `${handoff.candidateId}\t${handoff.candidateSha256}`).join('\n') + (handoffs.length ? '\n' : ''));
}
if (process.env.GITHUB_OUTPUT) {
  if (!outputPath) throw new Error('--output is required when writing GitHub Actions outputs');
  await fs.appendFile(process.env.GITHUB_OUTPUT, `candidate_count=${handoffs.length}\nhandoff_file=${outputPath}\n`);
}
console.log(JSON.stringify({ after: afterCommit, candidateCount: handoffs.length, handoffs }, null, 2));
