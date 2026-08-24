import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildCandidateFromRepository } from './lib/affiliate-link-contract.mjs';

const root = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
for (const key of ['article-slug', 'product-id', 'program-id', 'expected-program-revision', 'candidate-revision', 'expected-article-sha256', 'paid-url', 'product-identity-evidence-url', 'created-by']) {
  if (!args[key]) throw new Error(`Missing required --${key} argument`);
}
if (!/^[a-f0-9]{64}$/.test(args['expected-article-sha256'])) throw new Error('expected-article-sha256 must be a lowercase SHA-256 digest');
const candidate = await buildCandidateFromRepository(root, {
  articleSlug: args['article-slug'],
  productId: args['product-id'],
  programId: args['program-id'],
  expectedProgramRevision: Number(args['expected-program-revision']),
  candidateRevision: Number(args['candidate-revision']),
  expectedArticleSha256: args['expected-article-sha256'],
  paidUrl: args['paid-url'],
  productIdentityEvidenceUrl: args['product-identity-evidence-url'],
  createdBy: args['created-by'],
  createdAt: new Date().toISOString()
});
if (args.confirmation !== `CANDIDATE-${candidate.candidateId}`) throw new Error(`Action-time confirmation must equal CANDIDATE-${candidate.candidateId}`);
const outputPath = path.join(root, 'affiliate', 'candidates', `${candidate.candidateId}.json`);
try { await fs.access(outputPath); throw new Error(`${candidate.candidateId} already exists`); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `candidate_id=${candidate.candidateId}\ncandidate_path=${path.relative(root, outputPath)}\n`);
console.log(JSON.stringify({ candidateCreated: true, candidateId: candidate.candidateId, reviewed: false, approved: false, published: false }, null, 2));
