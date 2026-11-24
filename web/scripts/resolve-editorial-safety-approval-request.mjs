import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { buildEditorialReviewQueue } from './lib/editorial-review-queue-contract.mjs';
import { assessEditorialSafetyApproval, reviewedContentDigests } from './lib/editorial-safety-contract.mjs';
import { latestEditorialSafetyApproval, loadEditorialSafetyApprovalRecords } from './lib/editorial-safety-store.mjs';
import {
  parseEditorialSafetyExactDecision,
  resolveEditorialSafetyDecisionIssue,
  resolveEditorialSafetyDecisionManual
} from './lib/editorial-safety-approval-request-contract.mjs';

const sha256 = (raw) => createHash('sha256').update(raw).digest('hex');

function readArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function loadCurrentReview(root, runId) {
  const runPath = path.join(root, 'research', 'runs', `${runId}.json`);
  const runRaw = await fs.readFile(runPath);
  const run = JSON.parse(runRaw.toString('utf8'));
  if (run.runId !== runId) throw new Error('Editorial safety run file identity does not match its path');
  const articleName = `${run.article.slug}.md`;
  const articlePath = path.join(root, 'src', 'data', 'blog', articleName);
  const articleRaw = await fs.readFile(articlePath);
  const socialName = `${run.article.slug}-launch.json`;
  const socialPath = path.join(root, 'social', 'drafts', socialName);
  let socialRaw = null;
  try { socialRaw = await fs.readFile(socialPath); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const latestSafetyApproval = latestEditorialSafetyApproval(await loadEditorialSafetyApprovalRecords(root), runId);
  const safetyAssessment = latestSafetyApproval ? assessEditorialSafetyApproval({
    approval: latestSafetyApproval.data,
    run,
    currentReviewedContentSha256: reviewedContentDigests({ run, articleRaw, socialRaw })
  }) : null;
  const queue = buildEditorialReviewQueue([{
    run,
    runPath: `research/runs/${runId}.json`,
    runSha256: sha256(runRaw),
    articlePath: `src/data/blog/${articleName}`,
    articleSha256: sha256(articleRaw),
    socialPath: socialRaw ? `social/drafts/${socialName}` : null,
    socialSha256: socialRaw ? sha256(socialRaw) : null,
    safetyApproval: latestSafetyApproval ? {
      status: safetyAssessment.status,
      revision: latestSafetyApproval.data.approvalRevision,
      decision: latestSafetyApproval.data.decision,
      reviewedAt: latestSafetyApproval.data.reviewedAt,
      path: latestSafetyApproval.path,
      sha256: latestSafetyApproval.sha256
    } : null
  }]);
  return queue.queue[0];
}

async function main() {
  const root = path.resolve(readArgument('root') ?? process.cwd());
  const requestPath = readArgument('request-path');
  let result;
  if (requestPath) {
    const issue = JSON.parse(await fs.readFile(path.resolve(requestPath), 'utf8'));
    const exactDecision = parseEditorialSafetyExactDecision(issue.body);
    result = resolveEditorialSafetyDecisionIssue({ issue, review: await loadCurrentReview(root, exactDecision.runId) });
  } else {
    const runId = readArgument('run-id');
    result = resolveEditorialSafetyDecisionManual({
      runId,
      decision: readArgument('decision'),
      confirmation: readArgument('confirmation'),
      review: await loadCurrentReview(root, runId)
    });
  }
  console.log(`run_id=${result.runId}`);
  console.log(`decision=${result.decision}`);
  console.log(`confirmation=${result.confirmation}`);
  console.log(`expected_run_sha256=${result.expectedRunSha256}`);
  console.log(`expected_article_sha256=${result.expectedArticleSha256}`);
  console.log(`expected_social_sha256=${result.expectedSocialSha256 ?? ''}`);
  console.log(`expected_high_risk_claims_sha256=${result.expectedHighRiskClaimsSha256}`);
  console.log(`request_source=${result.source}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
