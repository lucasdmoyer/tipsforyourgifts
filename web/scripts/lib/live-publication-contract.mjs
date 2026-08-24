import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parsePublicationReceipt } from './publication-receipt-contract.mjs';

const gitSha = z.string().regex(/^[a-f0-9]{40}$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime();

const verifiedContentReleaseSchema = z.object({
  receiptId: z.string().regex(/^firebase-[a-f0-9]{12}-[0-9]+-[0-9]+$/),
  receiptPath: z.string().regex(/^releases\/receipts\/firebase-[a-f0-9]{12}-[0-9]+-[0-9]+\.json$/),
  receiptSha256: sha256,
  releaseSha: gitSha,
  releaseMode: z.enum(['founder_reviewed', 'automatic_after_proven']),
  sourceWorkflow: z.enum(['firebase-production', 'firebase-auto-production']),
  workflowRunUrl: z.string().url().regex(/^https:\/\/github\.com\/lucasdmoyer\/tipsforyourgifts\/actions\/runs\/[0-9]+$/),
  createdAt: timestamp,
  productionVerifiedAt: timestamp,
  publicationManifest: z.object({
    manifestId: z.string().regex(/^publication-set-[a-f0-9]{16}$/),
    sha256,
    contentSetSha256: sha256,
    articles: z.number().int().positive(),
    independentReviews: z.number().int().positive(),
    affiliateLinks: z.number().int().nonnegative()
  }).strict(),
  rollbackChannel: z.string().regex(/^rollback-[a-f0-9]{12}-[0-9]+-[0-9]+$/)
}).strict();

export const livePublicationStateSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  projectId: z.literal('tipsforyourgifts'),
  siteId: z.literal('tipsforyourgifts'),
  hostingChannel: z.literal('live'),
  productionUrl: z.literal('https://tipsforyourgifts.web.app/'),
  status: z.enum(['no_verified_managed_release', 'verified_managed_content_release']),
  updatedAt: timestamp.nullable(),
  latestVerifiedContentRelease: verifiedContentReleaseSchema.nullable()
}).strict().superRefine((state, context) => {
  const hasRelease = state.latestVerifiedContentRelease !== null;
  if (state.status === 'verified_managed_content_release' && (!hasRelease || state.updatedAt === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'verified status requires a timestamped content-release receipt' });
  }
  if (state.status === 'no_verified_managed_release' && (hasRelease || state.updatedAt !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'unverified status cannot claim release evidence' });
  }
  if (hasRelease && state.updatedAt !== state.latestVerifiedContentRelease.createdAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['updatedAt'], message: 'index timestamp must bind the receipt creation time' });
  }
});

export function parseLivePublicationState(value) {
  return livePublicationStateSchema.parse(value);
}

export function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function summarizeVerifiedContentRelease(receiptInput, receiptRaw) {
  const receipt = parsePublicationReceipt(receiptInput);
  return verifiedContentReleaseSchema.parse({
    receiptId: receipt.receiptId,
    receiptPath: `releases/receipts/${receipt.receiptId}.json`,
    receiptSha256: sha256Bytes(receiptRaw),
    releaseSha: receipt.releaseSha,
    releaseMode: receipt.releaseMode,
    sourceWorkflow: receipt.sourceWorkflow,
    workflowRunUrl: `https://github.com/${receipt.workflow.repository}/actions/runs/${receipt.workflow.runId}`,
    createdAt: receipt.createdAt,
    productionVerifiedAt: receipt.production.verifiedAt,
    publicationManifest: {
      manifestId: receipt.publicationManifest.manifestId,
      sha256: receipt.publicationManifest.sha256,
      contentSetSha256: receipt.publicationManifest.contentSetSha256,
      articles: receipt.publicationManifest.articles,
      independentReviews: receipt.publicationManifest.independentReviews,
      affiliateLinks: receipt.publicationManifest.affiliateLinks
    },
    rollbackChannel: receipt.rollbackTarget.targetChannel
  });
}

export function validateLivePublicationState(stateInput, receiptsByPath = new Map()) {
  const issues = [];
  let state;
  try {
    state = parseLivePublicationState(stateInput);
  } catch (error) {
    if (error instanceof z.ZodError) return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return [String(error?.message ?? error)];
  }
  const summary = state.latestVerifiedContentRelease;
  if (!summary) return issues;
  const receiptRecord = receiptsByPath.get(summary.receiptPath);
  if (!receiptRecord) return [`${summary.receiptPath}: indexed release receipt is missing`];
  try {
    const expected = summarizeVerifiedContentRelease(receiptRecord.data, receiptRecord.raw);
    if (JSON.stringify(summary) !== JSON.stringify(expected)) issues.push(`${summary.receiptPath}: indexed release summary differs from the verified receipt`);
  } catch (error) {
    issues.push(`${summary.receiptPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return issues;
}
