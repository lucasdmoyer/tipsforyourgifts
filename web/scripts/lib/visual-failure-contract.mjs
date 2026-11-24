import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const runIdSchema = z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/);
const requestIdSchema = z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}-visuals$/);
const missionIdSchema = z.string().regex(/^research-mission-[1-9]\d*-[1-9]\d*$/);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const visualFailureReceiptSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  failureId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}-visuals-run[1-9]\d*-attempt[1-9]\d*$/),
  status: z.literal('retry_required'),
  stage: z.enum(['production', 'independent_review']),
  reasonCode: z.enum(['production_step_failed', 'production_bundle_invalid', 'review_step_failed', 'review_findings_invalid', 'review_verdict_failed']),
  recordedAt: z.string().datetime(),
  workflow: z.object({
    name: z.literal('visual-production.yml'),
    runId: z.string().regex(/^[1-9]\d*$/),
    runAttempt: z.number().int().positive(),
    url: z.string().url()
  }).strict(),
  bindings: z.object({
    requestId: requestIdSchema,
    requestPath: z.string().regex(/^visuals\/requests\/\d{8}-[a-z0-9-]+-[a-f0-9]{8}-visuals\.json$/),
    requestSha256: sha256Schema,
    missionId: missionIdSchema,
    missionPath: z.string().regex(/^research\/missions\/research-mission-[1-9]\d*-[1-9]\d*\.json$/),
    missionSha256: sha256Schema,
    runId: runIdSchema,
    articleSlug: slugSchema
  }).strict(),
  evidence: z.object({
    manifestSha256: sha256Schema.nullable(),
    findingsSha256: sha256Schema.nullable(),
    reviewVerdict: z.literal('failed').nullable(),
    blockers: z.array(z.string().min(12)),
    warnings: z.array(z.string().min(12))
  }).strict(),
  handling: z.object({
    partialOutputPreserved: z.literal(false),
    generatedAssetsPromoted: z.literal(false),
    reviewReceiptCreated: z.literal(false),
    productionDeploymentAuthorized: z.literal(false)
  }).strict(),
  nextGate: z.string().min(50)
}).strict().superRefine((receipt, context) => {
  if (receipt.failureId !== `${receipt.bindings.requestId}-run${receipt.workflow.runId}-attempt${receipt.workflow.runAttempt}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['failureId'], message: 'must bind the workflow run and attempt' });
  }
  if (receipt.bindings.requestId !== `${receipt.bindings.runId}-visuals`) context.addIssue({ code: z.ZodIssueCode.custom, path: ['bindings', 'requestId'], message: 'must bind the research run' });
  const expectedUrl = `https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/${receipt.workflow.runId}`;
  if (receipt.workflow.url !== expectedUrl) context.addIssue({ code: z.ZodIssueCode.custom, path: ['workflow', 'url'], message: 'must bind the exact workflow run' });
  if (receipt.reasonCode.startsWith('production_') && receipt.stage !== 'production') context.addIssue({ code: z.ZodIssueCode.custom, path: ['stage'], message: 'production failure codes require the production stage' });
  if (receipt.reasonCode.startsWith('review_') && receipt.stage !== 'independent_review') context.addIssue({ code: z.ZodIssueCode.custom, path: ['stage'], message: 'review failure codes require the independent-review stage' });
  if (receipt.reasonCode === 'review_verdict_failed') {
    if (!receipt.evidence.manifestSha256 || !receipt.evidence.findingsSha256 || receipt.evidence.reviewVerdict !== 'failed' || receipt.evidence.blockers.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['evidence'], message: 'a failed review verdict requires exact manifest and findings hashes plus at least one blocker' });
    }
  } else if (receipt.evidence.manifestSha256 !== null || receipt.evidence.findingsSha256 !== null || receipt.evidence.reviewVerdict !== null || receipt.evidence.blockers.length > 0 || receipt.evidence.warnings.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['evidence'], message: 'invalid or partial model output must not be preserved as evidence' });
  }
});
