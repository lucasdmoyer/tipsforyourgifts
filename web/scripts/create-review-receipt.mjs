import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const runId = args['run-id'];
const reviewerId = args['reviewer-id'];
const verdict = args.verdict;
if (!runId || !reviewerId || !['passed', 'failed'].includes(verdict)) {
  throw new Error('Usage: node scripts/create-review-receipt.mjs --run-id=<id> --reviewer-id=<id> --verdict=passed|failed [--workflow-run-id=<id>]');
}

const root = process.cwd();
const runPath = path.join(root, 'research', 'runs', `${runId}.json`);
const run = JSON.parse(await fs.readFile(runPath, 'utf8'));
if (run.draftAuthor === reviewerId) throw new Error('The independent reviewer cannot be the draft author');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const reviewable = structuredClone(run);
delete reviewable.qa;
delete reviewable.completedAt;
reviewable.status = 'review_pending';
reviewable.article.status = 'review_pending';
const articleRaw = await fs.readFile(path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`));
const articleSha256 = sha256(articleRaw.toString().replace(/^status:\s*(?:draft|publication_ready)\s*$/m, 'status: review_pending'));
const socialPath = path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`);
let socialSha256 = null;
try { socialSha256 = sha256(await fs.readFile(socialPath)); } catch {}
const reviewedAt = new Date().toISOString();
const receipt = {
  schemaVersion: '1.0.0',
  receiptId: `${runId}-qa`,
  runId,
  articleSlug: run.article.slug,
  reviewedAt,
  reviewerRole: 'independent-editor',
  reviewerId,
  workflowRunId: args['workflow-run-id'] || process.env.GITHUB_RUN_ID || 'local-independent-review',
  verdict,
  evidenceSha256: sha256(`${JSON.stringify(reviewable)}\n`),
  articleSha256,
  socialSha256,
  blockers: verdict === 'failed' ? ['Independent review did not approve this bundle.'] : [],
  warnings: []
};
const outputPath = path.join(root, 'research', 'reviews', `${runId}.qa.v1.json`);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`Created ${path.relative(root, outputPath)} with verdict ${verdict}`);
