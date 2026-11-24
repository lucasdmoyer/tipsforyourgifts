import { z } from 'zod';
import { buildEditorialSafetyDecisionIssueUrl, hashEditorialSafetyClaims, parseEditorialSafetyExactDecision } from './editorial-safety-approval-request-contract.mjs';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const highRiskClaimSchema = z.object({
  id: z.string().min(4),
  text: z.string().min(12),
  sourceIds: z.array(z.string().min(4)).min(1)
}).strict();

const founderDecisionPacketSchema = z.object({
  workflowUrl: z.literal('https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/editorial-safety-approval.yml'),
  approvalIssueUrl: z.string().url().refine((value) => value.startsWith('https://github.com/lucasdmoyer/tipsforyourgifts/issues/new?')),
  rejectionIssueUrl: z.string().url().refine((value) => value.startsWith('https://github.com/lucasdmoyer/tipsforyourgifts/issues/new?')),
  approveCommand: z.string().min(80),
  rejectCommand: z.string().min(80),
  authorityBoundary: z.literal('This decision binds only the exact current run, article, social, and high-risk claim hashes. It does not replace independent QA, merge a pull request, or authorize publication.')
}).strict();

const failedReviewSchema = z.object({
  missionId: z.string().regex(/^research-mission-[1-9]\d*-[1-9]\d*$/),
  failedAt: z.string().datetime(),
  receiptPath: z.string().regex(/^research\/reviews\/[a-z0-9-]+\.qa\.v[1-9]\d*\.json$/),
  receiptSha256: sha256Schema,
  reviewedAt: z.string().datetime(),
  workflowRunUrl: z.string().url(),
  correctionPullRequestSearchUrl: z.string().url()
}).strict();

const queueEntrySchema = z.object({
  runId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/),
  ideaId: z.string().min(3),
  articleSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.enum(['drafted', 'qa_failed']),
  reviewerId: z.string().min(3),
  blockers: z.array(z.string().min(12)).min(1),
  warnings: z.array(z.string().min(12)),
  failedReview: failedReviewSchema.nullable(),
  highRiskClaims: z.array(highRiskClaimSchema),
  founderDecisionPacket: founderDecisionPacketSchema.nullable(),
  founderSafetyReviewRequired: z.boolean(),
  founderSafetyReviewStatus: z.enum(['not_required', 'approval_required', 'approved_current', 'rejected_current', 'stale']),
  safetyApproval: z.object({
    status: z.enum(['approved_current', 'rejected_current', 'stale']),
    revision: z.number().int().positive(),
    decision: z.enum(['approved', 'rejected']),
    reviewedAt: z.string().datetime(),
    path: z.string().regex(/^research\/safety-approvals\/.+\.json$/),
    sha256: sha256Schema
  }).strict().nullable(),
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
  const expectedReviewRequired = entry.founderSafetyReviewStatus !== 'not_required' && entry.founderSafetyReviewStatus !== 'approved_current';
  if (entry.founderSafetyReviewRequired !== expectedReviewRequired) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderSafetyReviewRequired'], message: `must be ${expectedReviewRequired} for ${entry.founderSafetyReviewStatus}` });
  }
  if (entry.highRiskClaims.length > 0 && entry.founderSafetyReviewStatus === 'not_required') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderSafetyReviewRequired'], message: 'high-risk claims require a current founder safety approval' });
  }
  if (entry.highRiskClaims.length === 0 && entry.founderDecisionPacket !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderDecisionPacket'], message: 'a founder decision packet requires at least one high-risk claim' });
  }
  if (entry.highRiskClaims.length > 0) {
    const expectedApprove = `gh workflow run editorial-safety-approval.yml -f run_id=${entry.runId} -f decision=approved -f confirmation=REVIEW-${entry.runId}-approved`;
    const expectedReject = `gh workflow run editorial-safety-approval.yml -f run_id=${entry.runId} -f decision=rejected -f confirmation=REVIEW-${entry.runId}-rejected`;
    if (entry.founderDecisionPacket === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderDecisionPacket'], message: 'high-risk claims require an exact founder decision packet' });
    } else {
      if (entry.founderDecisionPacket.approveCommand !== expectedApprove) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderDecisionPacket', 'approveCommand'], message: 'must bind the exact run ID and approved confirmation' });
      }
      if (entry.founderDecisionPacket.rejectCommand !== expectedReject) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderDecisionPacket', 'rejectCommand'], message: 'must bind the exact run ID and rejected confirmation' });
      }
      for (const [decision, field] of [['approved', 'approvalIssueUrl'], ['rejected', 'rejectionIssueUrl']]) {
        try {
          const issueUrl = new URL(entry.founderDecisionPacket[field]);
          const request = parseEditorialSafetyExactDecision(issueUrl.searchParams.get('body'));
          const expectedTitle = `[Editorial Safety Decision] ${entry.runId} ${decision}`;
          if (issueUrl.searchParams.get('title') !== expectedTitle || request.runId !== entry.runId || request.decision !== decision || request.expectedRunSha256 !== entry.sourceSha256.run || request.expectedArticleSha256 !== entry.sourceSha256.article || request.expectedSocialSha256 !== entry.sourceSha256.social || request.expectedHighRiskClaimsSha256 !== hashEditorialSafetyClaims(entry.highRiskClaims)) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderDecisionPacket', field], message: `must bind the exact ${decision} decision and current content hashes` });
          }
        } catch (error) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ['founderDecisionPacket', field], message: `is not a valid exact ${decision} issue packet: ${error.message}` });
        }
      }
    }
  }
  if (entry.founderSafetyReviewStatus === 'not_required' && entry.safetyApproval !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['safetyApproval'], message: 'an unnecessary safety review cannot bind an approval record' });
  }
  if (entry.founderSafetyReviewStatus === 'approval_required' && entry.safetyApproval !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['safetyApproval'], message: 'approval_required means no approval record exists' });
  }
  if (['approved_current', 'rejected_current', 'stale'].includes(entry.founderSafetyReviewStatus)) {
    if (entry.safetyApproval === null || entry.safetyApproval.status !== entry.founderSafetyReviewStatus) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['safetyApproval'], message: 'safety approval record must match the current status' });
    }
  }
  if ((entry.sourcePaths.social === null) !== (entry.sourceSha256.social === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceSha256', 'social'], message: 'social path and digest must be present or absent together' });
  }
  if (entry.failedReview !== null && entry.status !== 'qa_failed') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'a mission-bound failed review must surface as qa_failed' });
  }
});

export const editorialReviewQueueSchema = z.object({
  schemaVersion: z.literal('1.2.0'),
  counts: z.object({
    pendingBundles: z.number().int().nonnegative(),
    founderSafetyReviewsRequired: z.number().int().nonnegative(),
    founderSafetyApprovalsCurrent: z.number().int().nonnegative(),
    independentReviewsRequired: z.number().int().nonnegative(),
    highRiskClaims: z.number().int().nonnegative()
  }).strict(),
  queue: z.array(queueEntrySchema)
}).strict().superRefine((reviewQueue, context) => {
  const expected = {
    pendingBundles: reviewQueue.queue.length,
    founderSafetyReviewsRequired: reviewQueue.queue.filter((entry) => entry.founderSafetyReviewRequired).length,
    founderSafetyApprovalsCurrent: reviewQueue.queue.filter((entry) => entry.founderSafetyReviewStatus === 'approved_current').length,
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
    .map(({ run, runPath, runSha256, articlePath, articleSha256, socialPath, socialSha256, safetyApproval, qaFailureHandoff = null }) => {
      const effectiveBlockers = qaFailureHandoff?.blockers ?? run.qa.blockers;
      const effectiveWarnings = qaFailureHandoff?.warnings ?? run.qa.warnings;
      const highRiskClaims = (run.claims ?? [])
        .filter((claim) => claim.risk === 'high')
        .map((claim) => ({ id: claim.id, text: claim.text, sourceIds: claim.sourceIds }));
      const carriesSafetyBoundary = highRiskClaims.length > 0 || effectiveBlockers.some((blocker) => /founder review|lucas must review|safety/i.test(blocker));
      const founderSafetyReviewStatus = !carriesSafetyBoundary ? 'not_required' : safetyApproval?.status ?? 'approval_required';
      const founderSafetyReviewRequired = carriesSafetyBoundary && founderSafetyReviewStatus !== 'approved_current';
      const sourceSha256 = { run: runSha256, article: articleSha256, social: socialSha256 };
      const reviewIdentity = { runId: run.runId, articleSlug: run.article.slug, highRiskClaims, sourceSha256, founderSafetyReviewRequired, founderSafetyReviewStatus };
      const founderDecisionPacket = highRiskClaims.length === 0 ? null : {
        workflowUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/editorial-safety-approval.yml',
        approvalIssueUrl: buildEditorialSafetyDecisionIssueUrl({ review: reviewIdentity, decision: 'approved' }),
        rejectionIssueUrl: buildEditorialSafetyDecisionIssueUrl({ review: reviewIdentity, decision: 'rejected' }),
        approveCommand: `gh workflow run editorial-safety-approval.yml -f run_id=${run.runId} -f decision=approved -f confirmation=REVIEW-${run.runId}-approved`,
        rejectCommand: `gh workflow run editorial-safety-approval.yml -f run_id=${run.runId} -f decision=rejected -f confirmation=REVIEW-${run.runId}-rejected`,
        authorityBoundary: 'This decision binds only the exact current run, article, social, and high-risk claim hashes. It does not replace independent QA, merge a pull request, or authorize publication.'
      };
      const failedReview = qaFailureHandoff ? {
        missionId: qaFailureHandoff.missionId,
        failedAt: qaFailureHandoff.failedAt,
        receiptPath: qaFailureHandoff.reviewReceiptPath,
        receiptSha256: qaFailureHandoff.reviewReceiptSha256,
        reviewedAt: qaFailureHandoff.reviewedAt,
        workflowRunUrl: `https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/${qaFailureHandoff.workflowRunId}`,
        correctionPullRequestSearchUrl: `https://github.com/lucasdmoyer/tipsforyourgifts/pulls?q=is%3Apr+head%3Acodex%2Fcontent-${qaFailureHandoff.missionId}`
      } : null;
      return {
        runId: run.runId,
        ideaId: run.ideaId,
        articleSlug: run.article.slug,
        status: failedReview ? 'qa_failed' : run.status,
        reviewerId: qaFailureHandoff?.reviewerId ?? run.qa.reviewerId,
        blockers: effectiveBlockers,
        warnings: effectiveWarnings,
        failedReview,
        highRiskClaims,
        founderDecisionPacket,
        founderSafetyReviewRequired,
        founderSafetyReviewStatus,
        safetyApproval,
        independentReviewRequired: true,
        sourcePaths: { run: runPath, article: articlePath, social: socialPath },
        sourceSha256,
        nextGate: failedReview
          ? 'Open the exact correction pull request, resolve every recorded blocker without deleting the failed receipt, then require a new independent review before visual production or promotion.'
          : founderSafetyReviewStatus === 'approved_current'
          ? 'Founder safety approval matches the current bytes; merging that decision dispatches the separate independent editor automatically, with the Studio workflow available for recovery before promotion.'
          : founderSafetyReviewStatus === 'rejected_current'
            ? 'Do not publish this bundle. Revise or remove the rejected high-risk claim language, then request a new founder safety review on the changed bytes.'
            : founderSafetyReviewStatus === 'stale'
              ? 'The source bytes or claims changed after founder review. Request a new founder safety approval revision before independent QA can promote the bundle.'
              : founderSafetyReviewRequired
                ? 'Lucas records an owner-only, hash-bound decision on the exact high-risk claim language; approval still does not replace independent QA or authorize publication.'
                : 'A separate independent editor reviews the exact run, article, and social hashes and issues a new clean receipt before promotion.'
      };
    })
    .sort((left, right) => left.articleSlug.localeCompare(right.articleSlug));

  return editorialReviewQueueSchema.parse({
    schemaVersion: '1.2.0',
    counts: {
      pendingBundles: queue.length,
      founderSafetyReviewsRequired: queue.filter((entry) => entry.founderSafetyReviewRequired).length,
      founderSafetyApprovalsCurrent: queue.filter((entry) => entry.founderSafetyReviewStatus === 'approved_current').length,
      independentReviewsRequired: queue.length,
      highRiskClaims: queue.reduce((sum, entry) => sum + entry.highRiskClaims.length, 0)
    },
    queue
  });
}

export function parseEditorialReviewQueue(value) {
  return editorialReviewQueueSchema.parse(value);
}
