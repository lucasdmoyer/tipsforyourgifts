import crypto from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';

const runIdSchema = z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const sharedReceiptShape = {
  runId: runIdSchema,
  articleSlug: slugSchema,
  reviewedAt: z.string().datetime(),
  reviewerRole: z.literal('independent-editor'),
  reviewerId: z.string().min(3),
  workflowRunId: z.string().min(1),
  verdict: z.enum(['passed', 'failed']),
  evidenceSha256: sha256Schema,
  articleSha256: sha256Schema,
  socialSha256: sha256Schema.nullable(),
  blockers: z.array(z.string().min(12)),
  warnings: z.array(z.string().min(12))
};

const legacyReceiptSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  receiptId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}-qa$/),
  ...sharedReceiptShape
}).strict();

const versionedReceiptSchema = z.object({
  schemaVersion: z.literal('1.1.0'),
  receiptId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}-qa-v[1-9]\d*$/),
  receiptRevision: z.number().int().positive(),
  ...sharedReceiptShape
}).strict().superRefine((receipt, context) => {
  if (receipt.receiptId !== `${receipt.runId}-qa-v${receipt.receiptRevision}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['receiptId'], message: 'must bind the run ID and review revision' });
  }
});

export const editorialReviewReceiptSchema = z.union([legacyReceiptSchema, versionedReceiptSchema]).superRefine((receipt, context) => {
  if (receipt.verdict === 'passed' && receipt.blockers.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['blockers'], message: 'a passing review cannot contain blockers' });
  }
  if (receipt.verdict === 'failed' && receipt.blockers.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['blockers'], message: 'a failed review must name at least one blocker' });
  }
});

export const editorialReviewFindingsSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  runId: runIdSchema,
  verdict: z.enum(['passed', 'failed']),
  blockers: z.array(z.string().min(12)),
  warnings: z.array(z.string().min(12))
}).strict().superRefine((findings, context) => {
  if (findings.verdict === 'passed' && findings.blockers.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['blockers'], message: 'a passing review cannot contain blockers' });
  }
  if (findings.verdict === 'failed' && findings.blockers.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['blockers'], message: 'a failed review must name at least one blocker' });
  }
});

export const reviewReceiptPathPattern = /^research\/reviews\/(\d{8}-[a-z0-9-]+-[a-f0-9]{8})\.qa\.v([1-9]\d*)\.json$/;

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function reviewableEvidenceSha256(run) {
  const reviewable = structuredClone(run);
  delete reviewable.qa;
  delete reviewable.completedAt;
  reviewable.status = 'review_pending';
  reviewable.article.status = 'review_pending';
  return sha256(`${JSON.stringify(reviewable)}\n`);
}

export function reviewedArticleSha256(articleRaw) {
  return sha256(articleRaw.toString('utf8').replace(/^status:\s*(?:draft|publication_ready)\s*$/m, 'status: review_pending'));
}

export function reviewReceiptFilename(runId, revision) {
  return `${runId}.qa.v${revision}.json`;
}

export function reviewReceiptPath(runId, revision) {
  return `research/reviews/${reviewReceiptFilename(runId, revision)}`;
}

export function parseReviewReceiptPath(value) {
  const match = reviewReceiptPathPattern.exec(value);
  if (!match) throw new Error(`Invalid review receipt path: ${value}`);
  return { runId: match[1], revision: Number(match[2]) };
}

export function assertReviewReceiptIdentity(receipt, receiptPathValue) {
  const parsed = editorialReviewReceiptSchema.parse(receipt);
  const pathIdentity = parseReviewReceiptPath(receiptPathValue);
  if (parsed.runId !== pathIdentity.runId) throw new Error('Review receipt run ID differs from its path');
  if (parsed.schemaVersion === '1.0.0') {
    if (pathIdentity.revision !== 1 || parsed.receiptId !== `${parsed.runId}-qa`) throw new Error('Legacy review receipt must use revision 1 identity');
  } else if (parsed.receiptRevision !== pathIdentity.revision) {
    throw new Error('Review receipt revision differs from its path');
  }
  return parsed;
}

export function nextReviewRevision(names, runId) {
  const revisions = names
    .map((name) => path.posix.basename(name))
    .map((name) => new RegExp(`^${runId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.qa\\.v([1-9]\\d*)\\.json$`).exec(name))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  return revisions.length === 0 ? 1 : Math.max(...revisions) + 1;
}

export function receiptMatchesCurrentContent({ receipt, run, articleRaw, socialRaw }) {
  const parsed = editorialReviewReceiptSchema.parse(receipt);
  return parsed.runId === run.runId
    && parsed.articleSlug === run.article.slug
    && parsed.evidenceSha256 === reviewableEvidenceSha256(run)
    && parsed.articleSha256 === reviewedArticleSha256(articleRaw)
    && parsed.socialSha256 === (socialRaw == null ? null : sha256(socialRaw));
}
