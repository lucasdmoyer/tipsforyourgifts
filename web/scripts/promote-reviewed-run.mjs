import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { requireCurrentFounderSafetyApproval, reviewedContentDigests } from './lib/editorial-safety-contract.mjs';
import { loadEditorialSafetyApprovalRecords } from './lib/editorial-safety-store.mjs';
import {
  assertReviewReceiptIdentity,
  nextReviewRevision,
  parseReviewReceiptPath,
  receiptMatchesCurrentContent,
  reviewReceiptPath
} from './lib/editorial-review-receipt-contract.mjs';

const positional = process.argv.slice(2).filter((value) => !value.startsWith('--'));
const args = Object.fromEntries(process.argv.slice(2).filter((value) => value.startsWith('--')).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const runId = positional[0];
if (!runId) throw new Error('Usage: node scripts/promote-reviewed-run.mjs <run-id>');
const root = process.cwd();
const runPath = path.join(root, 'research', 'runs', `${runId}.json`);
const runRaw = await fs.readFile(runPath);
const run = JSON.parse(runRaw.toString('utf8'));
const reviewDirectory = path.join(root, 'research', 'reviews');
const reviewNames = (await fs.readdir(reviewDirectory)).filter((name) => name.startsWith(`${runId}.qa.v`) && name.endsWith('.json'));
if (reviewNames.length === 0) throw new Error('No independent review receipt exists for this run');
const selectedReceiptPath = args['receipt-path'] ?? reviewReceiptPath(runId, nextReviewRevision(reviewNames, runId) - 1);
const selectedIdentity = parseReviewReceiptPath(selectedReceiptPath);
if (selectedIdentity.runId !== runId) throw new Error('Review receipt path must belong to the requested run');
const receiptPath = path.join(root, selectedReceiptPath);
const receipt = assertReviewReceiptIdentity(JSON.parse(await fs.readFile(receiptPath, 'utf8')), selectedReceiptPath);
if (receipt.verdict !== 'passed' || receipt.blockers.length > 0) throw new Error('Independent review did not pass cleanly');
if (receipt.runId !== runId || receipt.articleSlug !== run.article.slug) throw new Error('Review receipt identity mismatch');
if (receipt.reviewerId === run.draftAuthor) throw new Error('Draft author cannot promote their own work');
const articlePath = path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`);
const articleRaw = await fs.readFile(articlePath, 'utf8');
const socialPath = path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`);
let socialRaw = null;
try { socialRaw = await fs.readFile(socialPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!receiptMatchesCurrentContent({ receipt, run, articleRaw, socialRaw })) throw new Error('Run, article, or social content changed after independent review');
const safetyApprovalRecords = await loadEditorialSafetyApprovalRecords(root);
requireCurrentFounderSafetyApproval({
  run,
  currentReviewedContentSha256: reviewedContentDigests({ run, articleRaw, socialRaw }),
  approvals: safetyApprovalRecords.map((record) => record.data)
});
run.status = 'validated';
run.completedAt = receipt.reviewedAt;
run.article.status = 'publication_ready';
run.qa = {
  passed: true,
  reviewerRole: 'independent-editor',
  reviewerId: receipt.reviewerId,
  receiptPath: selectedReceiptPath,
  blockers: receipt.blockers,
  warnings: receipt.warnings
};
await fs.writeFile(runPath, `${JSON.stringify(run, null, 2)}\n`);
if (!/^status:\s*(?:draft|publication_ready)\s*$/m.test(articleRaw)) throw new Error('Article status field is missing');
await fs.writeFile(articlePath, articleRaw.replace(/^status:\s*(?:draft|publication_ready)\s*$/m, 'status: publication_ready'));
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `run_id=${runId}\narticle_slug=${run.article.slug}\nreceipt_path=${selectedReceiptPath}\n`);
console.log(JSON.stringify({ promoted: runId, articleSlug: run.article.slug, receiptPath: selectedReceiptPath, status: 'publication_ready' }, null, 2));
