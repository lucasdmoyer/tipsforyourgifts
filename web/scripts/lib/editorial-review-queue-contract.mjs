import { z } from 'zod';
import { founderSafetyClassificationRequired as needsFounderSafetyClassification } from './founder-safety-review-contract.mjs';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const highRiskClaimSchema = z.object({
  id: z.string().min(4),
  text: z.string().min(12),
  sourceIds: z.array(z.string().min(4)).min(1)
}).strict();

const queueEntrySchema = z.object({
  runId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/),
  ideaId: z.string().min(3),
  articleSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.enum(['drafted', 'qa_failed']),
  reviewerId: z.string().min(3),
  blockers: z.array(z.string().min(12)).min(1),
  warnings: z.array(z.string().min(12)),
  highRiskClaims: z.array(highRiskClaimSchema),
  highRiskClaimIds: z.string(),
  founderSafetyReviewRequired: z.boolean(),
  founderSafetyClassificationRequired: z.boolean(),
  founderSafetyReviewStatus: z.enum(['not_required', 'classification_required', 'approval_required', 'approved']),
  founderSafetyApprovalPath: z.string().regex(/^research\/founder-safety-reviews\/.+\.founder\.v1\.json$/).nullable(),
  founderSafetyApprovalSha256: sha256Schema.nullable(),
  independentReviewRequired: z.literal(true),
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
  nextGate: z.string().min(40)
}).strict().superRefine((entry, context) => {
  if (entry.highRiskClaimIds !== entry.highRiskClaims.map((claim) => claim.id).join(',')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['highRiskClaimIds'], message: 'must equal the exact ordered high-risk claim IDs' });
  }
  if (entry.highRiskClaims.length > 0 && !entry.founderSafetyReviewRequired) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderSafetyReviewRequired'], message: 'high-risk claims require founder safety review' });
  }
  if (entry.founderSafetyClassificationRequired && (entry.highRiskClaims.length > 0 || entry.founderSafetyReviewRequired || entry.founderSafetyReviewStatus !== 'classification_required')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderSafetyClassificationRequired'], message: 'classification is required only for an unclassified safety blocker' });
  }
  const approvalPresent = entry.founderSafetyApprovalPath !== null && entry.founderSafetyApprovalSha256 !== null;
  if ((entry.founderSafetyApprovalPath === null) !== (entry.founderSafetyApprovalSha256 === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderSafetyApprovalPath'], message: 'approval path and digest must be present or absent together' });
  }
  if (!entry.founderSafetyReviewRequired && !entry.founderSafetyClassificationRequired && (entry.founderSafetyReviewStatus !== 'not_required' || approvalPresent)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderSafetyReviewStatus'], message: 'non-safety bundles cannot carry a founder safety approval' });
  }
  if (entry.founderSafetyReviewRequired && !['approval_required', 'approved'].includes(entry.founderSafetyReviewStatus)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderSafetyReviewStatus'], message: 'required safety review must be pending approval or approved' });
  }
  if ((entry.founderSafetyReviewStatus === 'approved') !== approvalPresent) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderSafetyReviewStatus'], message: 'approved status requires an exact approval receipt and only an approved status may carry one' });
  }
  if ((entry.sourcePaths.social === null) !== (entry.sourceSha256.social === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceSha256', 'social'], message: 'social path and digest must be present or absent together' });
  }
});

export const editorialReviewQueueSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  counts: z.object({
    pendingBundles: z.number().int().nonnegative(),
    founderSafetyReviewsRequired: z.number().int().nonnegative(),
    founderSafetyClassificationsPending: z.number().int().nonnegative(),
    founderSafetyApprovalsPending: z.number().int().nonnegative(),
    founderSafetyApprovalsRecorded: z.number().int().nonnegative(),
    independentReviewsRequired: z.number().int().nonnegative(),
    highRiskClaims: z.number().int().nonnegative()
  }).strict(),
  queue: z.array(queueEntrySchema)
}).strict().superRefine((reviewQueue, context) => {
  const expected = {
    pendingBundles: reviewQueue.queue.length,
    founderSafetyReviewsRequired: reviewQueue.queue.filter((entry) => entry.founderSafetyReviewRequired).length,
    founderSafetyClassificationsPending: reviewQueue.queue.filter((entry) => entry.founderSafetyClassificationRequired).length,
    founderSafetyApprovalsPending: reviewQueue.queue.filter((entry) => entry.founderSafetyReviewStatus === 'approval_required').length,
    founderSafetyApprovalsRecorded: reviewQueue.queue.filter((entry) => entry.founderSafetyReviewStatus === 'approved').length,
    independentReviewsRequired: reviewQueue.queue.filter((entry) => entry.independentReviewRequired).length,
    highRiskClaims: reviewQueue.queue.reduce((sum, entry) => sum + entry.highRiskClaims.length, 0)
  };
  for (const [key, value] of Object.entries(expected)) {
    if (reviewQueue.counts[key] !== value) context.addIssue({ code: z.ZodIssueCode.custom, path: ['counts', key], message: `must equal derived value ${value}` });
  }
  if (new Set(reviewQueue.queue.map((entry) => entry.runId)).size !== reviewQueue.queue.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['queue'], message: 'run IDs must be unique' });
  }
});

export function buildEditorialReviewQueue(records) {
  const queue = records
    .filter(({ run }) => ['drafted', 'qa_failed'].includes(run.status))
    .map(({ run, runPath, runSha256, articlePath, articleSha256, socialPath, socialSha256, founderSafetyApproval = null }) => {
      const highRiskClaims = (run.claims ?? [])
        .filter((claim) => claim.risk === 'high')
        .map((claim) => ({ id: claim.id, text: claim.text, sourceIds: claim.sourceIds }));
      const founderSafetyClassificationRequired = needsFounderSafetyClassification(run);
      const exactFounderSafetyReviewRequired = highRiskClaims.length > 0;
      const applicableFounderSafetyApproval = exactFounderSafetyReviewRequired ? founderSafetyApproval : null;
      return {
        runId: run.runId,
        ideaId: run.ideaId,
        articleSlug: run.article.slug,
        status: run.status,
        reviewerId: run.qa.reviewerId,
        blockers: run.qa.blockers,
        warnings: run.qa.warnings,
        highRiskClaims,
        highRiskClaimIds: highRiskClaims.map((claim) => claim.id).join(','),
        founderSafetyReviewRequired: exactFounderSafetyReviewRequired,
        founderSafetyClassificationRequired,
        founderSafetyReviewStatus: founderSafetyClassificationRequired ? 'classification_required' : exactFounderSafetyReviewRequired ? applicableFounderSafetyApproval ? 'approved' : 'approval_required' : 'not_required',
        founderSafetyApprovalPath: applicableFounderSafetyApproval?.path ?? null,
        founderSafetyApprovalSha256: applicableFounderSafetyApproval?.sha256 ?? null,
        independentReviewRequired: true,
        sourcePaths: { run: runPath, article: articlePath, social: socialPath },
        sourceSha256: { run: runSha256, article: articleSha256, social: socialSha256 },
        nextGate: founderSafetyClassificationRequired
          ? 'The drafting desk must classify the exact reader-facing safety wording as one or more high-risk claims with source bindings before Lucas can approve it.'
          : exactFounderSafetyReviewRequired && !applicableFounderSafetyApproval
          ? 'Lucas reviews the exact high-risk claim language and records a hash-bound founder receipt; this does not approve publication.'
          : applicableFounderSafetyApproval
            ? 'The exact founder safety wording is approved; a separate independent editor must now issue a fresh hash-bound evidence receipt.'
          : 'A separate independent editor reviews the exact run, article, and social hashes and issues a new clean receipt before promotion.'
      };
    })
    .sort((left, right) => left.articleSlug.localeCompare(right.articleSlug));

  return editorialReviewQueueSchema.parse({
    schemaVersion: '1.0.0',
    counts: {
      pendingBundles: queue.length,
      founderSafetyReviewsRequired: queue.filter((entry) => entry.founderSafetyReviewRequired).length,
      founderSafetyClassificationsPending: queue.filter((entry) => entry.founderSafetyClassificationRequired).length,
      founderSafetyApprovalsPending: queue.filter((entry) => entry.founderSafetyReviewStatus === 'approval_required').length,
      founderSafetyApprovalsRecorded: queue.filter((entry) => entry.founderSafetyReviewStatus === 'approved').length,
      independentReviewsRequired: queue.length,
      highRiskClaims: queue.reduce((sum, entry) => sum + entry.highRiskClaims.length, 0)
    },
    queue
  });
}

export function parseEditorialReviewQueue(value) {
  return editorialReviewQueueSchema.parse(value);
}
