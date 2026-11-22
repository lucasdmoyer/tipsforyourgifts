import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  editorialReviewFindingsSchema,
  editorialReviewReceiptSchema,
  nextReviewRevision,
  reviewedArticleSha256,
  reviewableEvidenceSha256,
  reviewReceiptFilename,
  sha256
} from './lib/editorial-review-receipt-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const runId = args['run-id'];
const reviewerId = args['reviewer-id'];
if (!runId || !reviewerId || (!args['findings-file'] && !['passed', 'failed'].includes(args.verdict))) {
  throw new Error('Usage: node scripts/create-review-receipt.mjs --run-id=<id> --reviewer-id=<id> (--findings-file=<path>|--verdict=passed|failed) [--workflow-run-id=<id>]');
}

const root = process.cwd();
const runPath = path.join(root, 'research', 'runs', `${runId}.json`);
const run = JSON.parse(await fs.readFile(runPath, 'utf8'));
if (run.draftAuthor === reviewerId) throw new Error('The independent reviewer cannot be the draft author');
if (!['drafted', 'qa_failed'].includes(run.status)) throw new Error('Independent re-review applies only to drafted or qa_failed bundles');
const findings = args['findings-file']
  ? editorialReviewFindingsSchema.parse(JSON.parse(await fs.readFile(path.resolve(root, args['findings-file']), 'utf8')))
  : editorialReviewFindingsSchema.parse({
    schemaVersion: '1.0.0',
    runId,
    verdict: args.verdict,
    blockers: args.verdict === 'failed' ? ['Independent review did not approve this bundle.'] : [],
    warnings: []
  });
if (findings.runId !== runId) throw new Error('Review findings run ID differs from the requested run');
const articleRaw = await fs.readFile(path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`));
const socialPath = path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`);
let socialRaw = null;
try { socialRaw = await fs.readFile(socialPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const reviewDirectory = path.join(root, 'research', 'reviews');
let existingNames = [];
try { existingNames = await fs.readdir(reviewDirectory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const receiptRevision = nextReviewRevision(existingNames, runId);
const receipt = editorialReviewReceiptSchema.parse({
  schemaVersion: '1.1.0',
  receiptId: `${runId}-qa-v${receiptRevision}`,
  receiptRevision,
  runId,
  articleSlug: run.article.slug,
  reviewedAt: args['reviewed-at'] ?? new Date().toISOString(),
  reviewerRole: 'independent-editor',
  reviewerId,
  workflowRunId: args['workflow-run-id'] || process.env.GITHUB_RUN_ID || 'local-independent-review',
  verdict: findings.verdict,
  evidenceSha256: reviewableEvidenceSha256(run),
  articleSha256: reviewedArticleSha256(articleRaw),
  socialSha256: socialRaw == null ? null : sha256(socialRaw),
  blockers: findings.blockers,
  warnings: findings.warnings
});
const outputPath = path.join(reviewDirectory, reviewReceiptFilename(runId, receiptRevision));
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
const relativePath = path.relative(root, outputPath);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `receipt_path=${relativePath}\nreceipt_revision=${receiptRevision}\nverdict=${receipt.verdict}\n`);
console.log(JSON.stringify({ receiptPath: relativePath, receiptRevision, verdict: receipt.verdict, runId }, null, 2));
