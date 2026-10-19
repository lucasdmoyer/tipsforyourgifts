import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  claimSha256,
  FOUNDER_SAFETY_REPOSITORY,
  FOUNDER_SAFETY_WORKFLOW_REF,
  founderSafetyReviewRequired,
  founderSafetyReviewSchema,
  loadFounderSafetyContext
} from './lib/founder-safety-review-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const runId = args['run-id'] ?? '';
if (!/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/.test(runId)) throw new Error('run-id must identify one exact research run');
if (args.confirmation !== `APPROVE-SAFETY-${runId}`) throw new Error('Action-time confirmation does not match the exact research run');

const root = process.cwd();
const policy = JSON.parse(await fs.readFile(path.join(root, 'config', 'publication-policy.json'), 'utf8'));
const github = {
  actions: process.env.GITHUB_ACTIONS,
  repository: process.env.GITHUB_REPOSITORY,
  workflowRef: process.env.GITHUB_WORKFLOW_REF,
  eventName: process.env.GITHUB_EVENT_NAME,
  actor: process.env.GITHUB_ACTOR,
  runId: process.env.GITHUB_RUN_ID,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  sourceCommitSha: process.env.GITHUB_SHA
};
if (github.actions !== 'true' || github.repository !== FOUNDER_SAFETY_REPOSITORY || github.workflowRef !== FOUNDER_SAFETY_WORKFLOW_REF || github.eventName !== 'workflow_dispatch') throw new Error('Founder safety approval must run in the exact protected GitHub workflow on master');
if (github.actor !== policy.requiredApproverLogin) throw new Error('GitHub actor does not match publication policy');
if (!/^[1-9]\d*$/.test(github.runId ?? '') || !/^[1-9]\d*$/.test(github.runAttempt ?? '') || !/^[a-f0-9]{40}$/.test(github.sourceCommitSha ?? '')) throw new Error('GitHub workflow provenance is incomplete or invalid');
const context = await loadFounderSafetyContext(root, runId);
if (!founderSafetyReviewRequired(context.run) || context.claims.length === 0) throw new Error(`${runId}: no exact high-risk claim set requires founder approval`);
if (context.run.founderSafetyApproval) throw new Error(`${runId}: research run already carries an immutable founder safety approval binding`);

for (const key of ['run', 'article', 'social']) {
  const expected = args[`expected-${key}-sha256`] || null;
  if (expected !== context.sourceSha256[key]) throw new Error(`${key} source digest changed after founder review`);
}
const approvedClaimIds = String(args['approved-claim-ids'] ?? '').split(',').map((value) => value.trim()).filter(Boolean).sort();
const currentClaimIds = context.claims.map((claim) => claim.id).sort();
if (JSON.stringify(approvedClaimIds) !== JSON.stringify(currentClaimIds)) throw new Error('approved-claim-ids must exactly equal the complete current high-risk claim set');

const reviewedAt = new Date().toISOString();
const receipt = founderSafetyReviewSchema.parse({
  schemaVersion: '1.0.0',
  receiptId: `${runId}-founder-safety`,
  runId,
  articleSlug: context.run.article.slug,
  reviewedAt,
  reviewerRole: 'founder',
  founderLogin: github.actor,
  workflowRunId: github.runId,
  provenance: {
    repository: github.repository,
    workflowRef: github.workflowRef,
    eventName: github.eventName,
    actor: github.actor,
    runId: github.runId,
    runAttempt: github.runAttempt,
    sourceCommitSha: github.sourceCommitSha
  },
  decision: 'approved_exact_wording',
  sourcePaths: context.sourcePaths,
  sourceSha256: context.sourceSha256,
  reviewableSha256: context.reviewableSha256,
  claimApprovals: context.claims.map((claim) => ({ claimId: claim.id, claimSha256: claimSha256(claim) })),
  scope: 'exact_high_risk_wording_only',
  independentReviewStillRequired: true,
  publicationAuthorized: false,
  productionDeploymentAuthorized: false
});
const outputPath = path.join(root, 'research', 'founder-safety-reviews', `${runId}.founder.v1.json`);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
const receiptRaw = `${JSON.stringify(receipt, null, 2)}\n`;
try { await fs.writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' }); } catch (error) {
  if (error.code === 'EEXIST') throw new Error(`${runId}: founder safety receipt already exists and is immutable`);
  throw error;
}
context.run.founderSafetyApproval = {
  path: `research/founder-safety-reviews/${runId}.founder.v1.json`,
  sha256: crypto.createHash('sha256').update(receiptRaw).digest('hex'),
  reviewedAt,
  workflowRunId: github.runId,
  sourceCommitSha: github.sourceCommitSha
};
await fs.writeFile(path.join(root, context.sourcePaths.run), `${JSON.stringify(context.run, null, 2)}\n`);
console.log(JSON.stringify({ approved: true, runId, claimIds: approvedClaimIds, independentReviewStillRequired: true, publicationAuthorized: false, productionDeploymentAuthorized: false }, null, 2));
