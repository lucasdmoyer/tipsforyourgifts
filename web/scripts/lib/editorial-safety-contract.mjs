import crypto from 'node:crypto';
import { z } from 'zod';

const runIdSchema = z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const reviewedContentShaSchema = z.object({
  run: sha256Schema,
  article: sha256Schema,
  social: sha256Schema.nullable()
}).strict();

const claimBindingSchema = z.object({
  claimId: z.string().min(4),
  claimSha256: sha256Schema
}).strict();

export const editorialSafetyPolicySchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  status: z.literal('active'),
  effectiveAt: z.string().datetime(),
  legacyDisposition: z.literal('independent_review_only_not_founder_approved'),
  legacyValidatedHighRiskRunIds: z.array(runIdSchema)
}).strict().superRefine((policy, context) => {
  if (new Set(policy.legacyValidatedHighRiskRunIds).size !== policy.legacyValidatedHighRiskRunIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['legacyValidatedHighRiskRunIds'], message: 'run IDs must be unique' });
  }
  if (JSON.stringify(policy.legacyValidatedHighRiskRunIds) !== JSON.stringify([...policy.legacyValidatedHighRiskRunIds].sort())) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['legacyValidatedHighRiskRunIds'], message: 'run IDs must be sorted' });
  }
});

export const editorialSafetyApprovalSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  approvalId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}-founder-safety-v[1-9]\d*$/),
  approvalRevision: z.number().int().positive(),
  runId: runIdSchema,
  articleSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  reviewedAt: z.string().datetime(),
  approverLogin: z.literal('lucasdmoyer'),
  workflow: z.object({
    name: z.literal('editorial-safety-approval.yml'),
    runId: z.string().regex(/^[1-9]\d*$/),
    runAttempt: z.number().int().positive(),
    actor: z.literal('lucasdmoyer')
  }).strict(),
  decision: z.enum(['approved', 'rejected']),
  reviewedContentSha256: reviewedContentShaSchema,
  highRiskClaims: z.array(claimBindingSchema).min(1),
  acknowledgements: z.object({
    exactReaderLanguageReviewed: z.literal(true),
    notFirstHandProductTesting: z.literal(true),
    independentQaStillRequired: z.literal(true),
    publicationNotAuthorized: z.literal(true)
  }).strict()
}).strict().superRefine((approval, context) => {
  if (approval.approvalId !== `${approval.runId}-founder-safety-v${approval.approvalRevision}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['approvalId'], message: 'must bind the run ID and approval revision' });
  }
  const claimIds = approval.highRiskClaims.map((claim) => claim.claimId);
  if (new Set(claimIds).size !== claimIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['highRiskClaims'], message: 'claim IDs must be unique' });
  }
});

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function highRiskClaimsForRun(run) {
  return (run.claims ?? []).filter((claim) => claim.risk === 'high');
}

export function claimBindingsForRun(run) {
  return highRiskClaimsForRun(run)
    .map((claim) => ({
      claimId: claim.id,
      claimSha256: sha256(`${JSON.stringify({ id: claim.id, text: claim.text, sourceIds: claim.sourceIds })}\n`)
    }))
    .sort((left, right) => left.claimId.localeCompare(right.claimId));
}

export function reviewedContentDigests({ run, articleRaw, socialRaw }) {
  const reviewableRun = structuredClone(run);
  delete reviewableRun.qa;
  delete reviewableRun.completedAt;
  reviewableRun.status = 'review_pending';
  reviewableRun.article.status = 'review_pending';
  const reviewableArticle = articleRaw
    .toString('utf8')
    .replace(/^status:\s*(?:draft|publication_ready)\s*$/m, 'status: review_pending');
  return {
    run: sha256(`${JSON.stringify(reviewableRun)}\n`),
    article: sha256(reviewableArticle),
    social: socialRaw == null ? null : sha256(socialRaw)
  };
}

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function assessEditorialSafetyApproval({ approval, run, currentReviewedContentSha256 }) {
  const parsed = editorialSafetyApprovalSchema.parse(approval);
  const expectedClaims = claimBindingsForRun(run);
  const identityMatches = parsed.runId === run.runId && parsed.articleSlug === run.article.slug;
  const sourceMatches = equal(parsed.reviewedContentSha256, currentReviewedContentSha256);
  const claimsMatch = equal(parsed.highRiskClaims, expectedClaims);
  const current = identityMatches && sourceMatches && claimsMatch;
  return {
    approval: parsed,
    identityMatches,
    sourceMatches,
    claimsMatch,
    current,
    status: !current ? 'stale' : parsed.decision === 'approved' ? 'approved_current' : 'rejected_current'
  };
}

export function requireCurrentFounderSafetyApproval({ run, currentReviewedContentSha256, approvals }) {
  const highRiskClaims = highRiskClaimsForRun(run);
  const safetyBlocker = (run.qa?.blockers ?? []).some((blocker) => /founder review|lucas must review|safety/i.test(blocker));
  if (highRiskClaims.length === 0) {
    if (safetyBlocker) throw new Error('Founder safety blocker exists without an explicitly classified high-risk claim');
    return { status: 'not_required', approval: null };
  }
  const matching = approvals
    .map((approval) => editorialSafetyApprovalSchema.parse(approval))
    .filter((approval) => approval.runId === run.runId)
    .sort((left, right) => right.approvalRevision - left.approvalRevision);
  if (matching.length === 0) throw new Error(`${run.runId}: founder safety approval is required for high-risk claims`);
  const latest = assessEditorialSafetyApproval({ approval: matching[0], run, currentReviewedContentSha256 });
  if (latest.status === 'stale') throw new Error(`${run.runId}: latest founder safety approval is stale for the current reviewable content or claims`);
  if (latest.status === 'rejected_current') throw new Error(`${run.runId}: founder rejected the current high-risk claim language`);
  return latest;
}

export function approvalFilename(approval) {
  return `${approval.runId}.founder-safety.v${approval.approvalRevision}.json`;
}
