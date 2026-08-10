import { z } from 'zod';

const gitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime();

const previewUrlSchema = z.string().url().superRefine((value, context) => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/^tipsforyourgifts--[a-z0-9-]+\.web\.app$/.test(url.hostname) || url.username || url.password || url.hash) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'preview URL must be a public tipsforyourgifts Firebase Hosting preview channel' });
  }
});

export const rollbackTargetSchema = z.object({
  strategy: z.literal('firebase_channel_clone'),
  projectId: z.literal('tipsforyourgifts'),
  siteId: z.literal('tipsforyourgifts'),
  sourceChannel: z.literal('live'),
  targetChannel: z.string().regex(/^rollback-[a-f0-9]{12}-[0-9]+-[0-9]+$/),
  protectsReleaseSha: gitShaSchema,
  clonedAt: timestampSchema,
  expiresAfter: z.literal('30d'),
  firebaseToolsVersion: z.literal('15.26.0'),
  rollbackCommand: z.string().min(1),
  status: z.literal('verified_clone')
}).strict().superRefine((target, context) => {
  if (!target.targetChannel.startsWith(`rollback-${target.protectsReleaseSha.slice(0, 12)}-`)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetChannel'], message: 'rollback channel must bind the protected release SHA' });
  }
  const expected = `firebase hosting:clone tipsforyourgifts:${target.targetChannel} tipsforyourgifts:live --project tipsforyourgifts`;
  if (target.rollbackCommand !== expected) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['rollbackCommand'], message: 'rollback command must bind the verified Firebase channel' });
  }
});

export const publicationReceiptSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  receiptId: z.string().regex(/^firebase-[a-f0-9]{12}-[0-9]+-[0-9]+$/),
  projectId: z.literal('tipsforyourgifts'),
  hostingChannel: z.literal('live'),
  releaseSha: gitShaSchema,
  releaseMode: z.enum(['founder_reviewed', 'automatic_after_proven']),
  sourceWorkflow: z.enum(['firebase-production', 'firebase-auto-production']),
  preview: z.object({
    url: previewUrlSchema,
    verifiedAt: timestampSchema
  }).strict(),
  production: z.object({
    url: z.literal('https://tipsforyourgifts.web.app/'),
    verifiedAt: timestampSchema
  }).strict(),
  publicationManifest: z.object({
    manifestId: z.string().regex(/^publication-set-[a-f0-9]{16}$/),
    path: z.literal('publication-manifest.json'),
    sha256: sha256Schema,
    contentSetSha256: sha256Schema,
    articles: z.number().int().positive(),
    independentReviews: z.number().int().positive(),
    socialLaunchPacks: z.number().int().nonnegative(),
    socialDrafts: z.number().int().nonnegative(),
    missionBoundArticles: z.number().int().nonnegative(),
    affiliateLinks: z.number().int().nonnegative()
  }).strict(),
  rollbackTarget: rollbackTargetSchema,
  gates: z.object({
    exactMasterSha: z.literal(true),
    independentQaReceipt: z.literal(true),
    deterministicValidation: z.literal(true),
    staticBuild: z.literal(true),
    builtArtifactSmoke: z.literal(true),
    publicationManifestValidated: z.literal(true),
    firebaseExactShaPreview: z.literal(true),
    previewSmoke: z.literal(true),
    rollbackTargetRecorded: z.literal(true),
    productionSmoke: z.literal(true)
  }).strict(),
  workflow: z.object({
    repository: z.literal('lucasdmoyer/tipsforyourgifts'),
    runId: z.string().regex(/^[0-9]+$/),
    runAttempt: z.number().int().positive(),
    actor: z.string().min(1).max(100),
    eventName: z.enum(['workflow_dispatch', 'push'])
  }).strict(),
  createdAt: timestampSchema,
  status: z.literal('verified_success')
}).strict().superRefine((receipt, context) => {
  if (receipt.receiptId !== `firebase-${receipt.releaseSha.slice(0, 12)}-${receipt.workflow.runId}-${receipt.workflow.runAttempt}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['receiptId'], message: 'receipt ID must bind the exact release SHA and workflow run' });
  }
  if (receipt.rollbackTarget.protectsReleaseSha !== receipt.releaseSha) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['rollbackTarget', 'protectsReleaseSha'], message: 'rollback clone must bind the release it protects' });
  }
  if (receipt.publicationManifest.manifestId !== `publication-set-${receipt.publicationManifest.contentSetSha256.slice(0, 16)}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['publicationManifest', 'manifestId'], message: 'publication manifest ID must bind the content set SHA-256' });
  }
  if (receipt.publicationManifest.independentReviews !== receipt.publicationManifest.articles) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['publicationManifest', 'independentReviews'], message: 'every released article must have an independent review' });
  }
  if (receipt.publicationManifest.missionBoundArticles > receipt.publicationManifest.articles) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['publicationManifest', 'missionBoundArticles'], message: 'mission-bound article count cannot exceed the release set' });
  }
  if (receipt.sourceWorkflow === 'firebase-production' && (receipt.releaseMode !== 'founder_reviewed' || receipt.workflow.eventName !== 'workflow_dispatch')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceWorkflow'], message: 'manual production workflow requires founder-reviewed workflow_dispatch evidence' });
  }
  if (receipt.sourceWorkflow === 'firebase-auto-production' && (receipt.releaseMode !== 'automatic_after_proven' || receipt.workflow.eventName !== 'push')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceWorkflow'], message: 'automatic workflow requires automatic-after-proven push evidence' });
  }
});

export function parsePublicationReceipt(value) {
  return publicationReceiptSchema.parse(value);
}
