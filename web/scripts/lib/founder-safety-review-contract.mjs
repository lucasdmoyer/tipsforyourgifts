import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const runIdSchema = z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const FOUNDER_SAFETY_REPOSITORY = 'lucasdmoyer/tipsforyourgifts';
export const FOUNDER_SAFETY_WORKFLOW_REF = 'lucasdmoyer/tipsforyourgifts/.github/workflows/editorial-founder-safety-review.yml@refs/heads/master';
export const founderSafetyPolicySchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  effectiveAt: z.string().datetime(),
  repository: z.literal(FOUNDER_SAFETY_REPOSITORY),
  workflowRef: z.literal(FOUNDER_SAFETY_WORKFLOW_REF),
  oidcReceiptAttestationRequired: z.literal(true),
  releaseProvenanceVerificationRequired: z.literal(true),
  legacyValidatedRunIds: z.array(runIdSchema).superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'legacy validated run IDs must be unique' });
  })
}).strict();

export async function loadFounderSafetyPolicy(root) {
  const policyPath = path.join(root, 'config', 'founder-safety-policy.json');
  const raw = await fs.readFile(policyPath);
  return { data: founderSafetyPolicySchema.parse(JSON.parse(raw.toString('utf8'))), path: 'config/founder-safety-policy.json', sha256: sha256(raw) };
}

export const founderSafetyReviewSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  receiptId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}-founder-safety$/),
  runId: runIdSchema,
  articleSlug: slugSchema,
  reviewedAt: z.string().datetime(),
  reviewerRole: z.literal('founder'),
  founderLogin: z.string().regex(/^[A-Za-z0-9-]+$/),
  workflowRunId: z.string().regex(/^[1-9]\d*$/),
  provenance: z.object({
    repository: z.literal(FOUNDER_SAFETY_REPOSITORY),
    workflowRef: z.literal(FOUNDER_SAFETY_WORKFLOW_REF),
    eventName: z.literal('workflow_dispatch'),
    actor: z.string().regex(/^[A-Za-z0-9-]+$/),
    runId: z.string().regex(/^[1-9]\d*$/),
    runAttempt: z.string().regex(/^[1-9]\d*$/),
    sourceCommitSha: z.string().regex(/^[a-f0-9]{40}$/)
  }).strict(),
  decision: z.literal('approved_exact_wording'),
  sourcePaths: z.object({
    run: z.string().regex(/^research\/runs\/.+\.json$/),
    article: z.string().regex(/^src\/data\/blog\/.+\.md$/),
    social: z.string().regex(/^social\/drafts\/.+\.json$/).nullable()
  }).strict(),
  sourceSha256: z.object({
    run: sha256Schema,
    article: sha256Schema,
    social: sha256Schema.nullable()
  }).strict(),
  reviewableSha256: z.object({
    evidence: sha256Schema,
    article: sha256Schema,
    social: sha256Schema.nullable()
  }).strict(),
  claimApprovals: z.array(z.object({
    claimId: z.string().min(4),
    claimSha256: sha256Schema
  }).strict()).min(1),
  scope: z.literal('exact_high_risk_wording_only'),
  independentReviewStillRequired: z.literal(true),
  publicationAuthorized: z.literal(false),
  productionDeploymentAuthorized: z.literal(false)
}).strict().superRefine((receipt, context) => {
  if (receipt.receiptId !== `${receipt.runId}-founder-safety`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['receiptId'], message: 'must bind the exact run ID' });
  }
  if ((receipt.sourcePaths.social === null) !== (receipt.sourceSha256.social === null) ||
      (receipt.sourcePaths.social === null) !== (receipt.reviewableSha256.social === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['sourcePaths', 'social'], message: 'social path and digests must be present or absent together' });
  }
  if (new Set(receipt.claimApprovals.map((claim) => claim.claimId)).size !== receipt.claimApprovals.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['claimApprovals'], message: 'claim IDs must be unique' });
  }
  if (receipt.workflowRunId !== receipt.provenance.runId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['workflowRunId'], message: 'must equal the provenance run ID' });
  }
  if (receipt.founderLogin !== receipt.provenance.actor) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderLogin'], message: 'must equal the provenance actor' });
  }
});

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function highRiskClaims(run) {
  return (run.claims ?? []).filter((claim) => claim.risk === 'high');
}

export function founderSafetyReviewRequired(run) {
  return highRiskClaims(run).length > 0;
}

export function founderSafetyClassificationRequired(run) {
  return highRiskClaims(run).length === 0 && (run.qa?.blockers ?? []).some((blocker) => /founder review|lucas must review|safety/i.test(blocker));
}

export function reviewableRunSha256(run) {
  const reviewable = structuredClone(run);
  delete reviewable.qa;
  delete reviewable.completedAt;
  delete reviewable.founderSafetyApproval;
  reviewable.status = 'review_pending';
  reviewable.article.status = 'review_pending';
  return sha256(`${JSON.stringify(reviewable)}\n`);
}

export function reviewableArticleSha256(articleRaw) {
  return sha256(articleRaw.replace(/^status:\s*(?:draft|publication_ready)\s*$/m, 'status: review_pending'));
}

export function claimSha256(claim) {
  return sha256(`${JSON.stringify({ id: claim.id, text: claim.text, sourceIds: claim.sourceIds })}\n`);
}

export async function loadFounderSafetyContext(root, runId) {
  const runPath = path.join(root, 'research', 'runs', `${runId}.json`);
  const runRaw = await fs.readFile(runPath, 'utf8');
  const run = JSON.parse(runRaw);
  if (run.runId !== runId) throw new Error(`${runId}: research run identity mismatch`);
  const articlePath = path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`);
  const articleRaw = await fs.readFile(articlePath, 'utf8');
  const socialPath = path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`);
  let socialRaw = null;
  try { socialRaw = await fs.readFile(socialPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const claims = highRiskClaims(run);
  return {
    run,
    claims,
    sourcePaths: {
      run: `research/runs/${runId}.json`,
      article: `src/data/blog/${run.article.slug}.md`,
      social: socialRaw ? `social/drafts/${run.article.slug}-launch.json` : null
    },
    sourceSha256: {
      run: sha256(runRaw),
      article: sha256(articleRaw),
      social: socialRaw ? sha256(socialRaw) : null
    },
    reviewableSha256: {
      evidence: reviewableRunSha256(run),
      article: reviewableArticleSha256(articleRaw),
      social: socialRaw ? sha256(socialRaw) : null
    }
  };
}

export function validateFounderSafetyReceipt(receiptInput, context, requiredFounderLogin) {
  const receipt = founderSafetyReviewSchema.parse(receiptInput);
  const issues = [];
  const promoted = context.run.status === 'validated' && context.run.article?.status === 'publication_ready';
  const durableApprovalBound = Boolean(context.run.founderSafetyApproval);
  if (receipt.runId !== context.run.runId || receipt.articleSlug !== context.run.article.slug) issues.push('receipt identity does not match the research bundle');
  if (receipt.founderLogin !== requiredFounderLogin) issues.push('receipt founder login does not match publication policy');
  for (const key of ['run', 'article', 'social']) {
    if (receipt.sourcePaths[key] !== context.sourcePaths[key]) issues.push(`${key} source path changed after founder review`);
    // Promotion changes only run QA/status metadata and the article status line. The
    // normalized reviewable digests below remain mandatory across that transition.
    const rawDigestMustMatch = key === 'social' || (key === 'article' && !promoted) || (key === 'run' && !promoted && !durableApprovalBound);
    if (rawDigestMustMatch && receipt.sourceSha256[key] !== context.sourceSha256[key]) issues.push(`${key} source digest changed after founder review`);
    if (receipt.reviewableSha256[key === 'run' ? 'evidence' : key] !== context.reviewableSha256[key === 'run' ? 'evidence' : key]) issues.push(`${key} reviewable digest changed after founder review`);
  }
  const expectedClaims = context.claims.map((claim) => ({ claimId: claim.id, claimSha256: claimSha256(claim) })).sort((left, right) => left.claimId.localeCompare(right.claimId));
  const actualClaims = [...receipt.claimApprovals].sort((left, right) => left.claimId.localeCompare(right.claimId));
  if (JSON.stringify(actualClaims) !== JSON.stringify(expectedClaims)) issues.push('receipt does not approve the exact complete high-risk claim set');
  if (issues.length > 0) throw new Error(`${context.run.runId}: invalid founder safety receipt: ${issues.join('; ')}`);
  return receipt;
}

export async function requireFounderSafetyReceipt(root, runId) {
  const context = await loadFounderSafetyContext(root, runId);
  if (founderSafetyClassificationRequired(context.run)) throw new Error(`${runId}: exact safety wording must be classified as at least one high-risk claim before independent review`);
  if (!founderSafetyReviewRequired(context.run)) return { required: false, context, receipt: null, path: null, sha256: null };
  const policy = JSON.parse(await fs.readFile(path.join(root, 'config', 'publication-policy.json'), 'utf8'));
  const relativePath = `research/founder-safety-reviews/${runId}.founder.v1.json`;
  const raw = await fs.readFile(path.join(root, relativePath), 'utf8').catch((error) => {
    if (error.code === 'ENOENT') throw new Error(`${runId}: founder safety approval is required before a passing independent review`);
    throw error;
  });
  const receipt = validateFounderSafetyReceipt(JSON.parse(raw), context, policy.requiredApproverLogin);
  const receiptSha256 = sha256(raw);
  const marker = context.run.founderSafetyApproval;
  if (!marker || marker.path !== relativePath || marker.sha256 !== receiptSha256 || marker.reviewedAt !== receipt.reviewedAt || marker.workflowRunId !== receipt.workflowRunId || marker.sourceCommitSha !== receipt.provenance.sourceCommitSha) {
    throw new Error(`${runId}: research run is missing the exact durable founder safety approval binding`);
  }
  return { required: true, context, receipt, path: relativePath, sha256: receiptSha256 };
}
