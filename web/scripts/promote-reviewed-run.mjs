import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const runId = process.argv[2];
if (!runId) throw new Error('Usage: node scripts/promote-reviewed-run.mjs <run-id>');
const root = process.cwd();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const runPath = path.join(root, 'research', 'runs', `${runId}.json`);
const receiptPath = path.join(root, 'research', 'reviews', `${runId}.qa.v1.json`);
const run = JSON.parse(await fs.readFile(runPath, 'utf8'));
const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
if (receipt.verdict !== 'passed' || receipt.blockers.length > 0) throw new Error('Independent review did not pass cleanly');
if (receipt.runId !== runId || receipt.articleSlug !== run.article.slug) throw new Error('Review receipt identity mismatch');
if (receipt.reviewerId === run.draftAuthor) throw new Error('Draft author cannot promote their own work');
const reviewable = structuredClone(run);
delete reviewable.qa;
delete reviewable.completedAt;
reviewable.status = 'review_pending';
reviewable.article.status = 'review_pending';
if (receipt.evidenceSha256 !== sha256(`${JSON.stringify(reviewable)}\n`)) throw new Error('Evidence changed after review');
const articlePath = path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`);
const articleRaw = await fs.readFile(articlePath, 'utf8');
if (receipt.articleSha256 !== sha256(articleRaw.replace(/^status:\s*(?:draft|publication_ready)\s*$/m, 'status: review_pending'))) throw new Error('Article changed after review');
const socialPath = path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`);
let socialSha256 = null;
try { socialSha256 = sha256(await fs.readFile(socialPath)); } catch {}
if (receipt.socialSha256 !== socialSha256) throw new Error('Social package changed after review');
run.status = 'validated';
run.completedAt = receipt.reviewedAt;
run.article.status = 'publication_ready';
run.qa = {
  passed: true,
  reviewerRole: 'independent-editor',
  reviewerId: receipt.reviewerId,
  receiptPath: `research/reviews/${runId}.qa.v1.json`,
  blockers: receipt.blockers,
  warnings: receipt.warnings
};
await fs.writeFile(runPath, `${JSON.stringify(run, null, 2)}\n`);
if (!/^status:\s*(?:draft|publication_ready)\s*$/m.test(articleRaw)) throw new Error('Article status field is missing');
await fs.writeFile(articlePath, articleRaw.replace(/^status:\s*(?:draft|publication_ready)\s*$/m, 'status: publication_ready'));
console.log(`Promoted ${runId} to publication_ready after independent review`);
