import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const gitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const workflowSchema = z.enum(['strategy-intake.yml', 'growth-review.yml', 'affiliate-link-review.yml', 'editorial-independent-review.yml']);
const stageSchema = z.enum(['strategy_proposal', 'growth_analysis', 'affiliate_review', 'editorial_review']);
const targetKindSchema = z.enum(['founder_strategy_issue', 'growth_snapshot', 'affiliate_link_candidate', 'editorial_run']);

export const automationFailureMappings = Object.freeze({
  'strategy-intake.yml': { stage: 'strategy_proposal', targetKind: 'founder_strategy_issue' },
  'growth-review.yml': { stage: 'growth_analysis', targetKind: 'growth_snapshot' },
  'affiliate-link-review.yml': { stage: 'affiliate_review', targetKind: 'affiliate_link_candidate' },
  'editorial-independent-review.yml': { stage: 'editorial_review', targetKind: 'editorial_run' }
});

export const automationFailureReceiptSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  failureId: z.string().regex(/^automation-failure-(strategy-intake|growth-review|affiliate-link-review|editorial-independent-review)-run[1-9]\d*-attempt[1-9]\d*$/),
  status: z.literal('retry_required'),
  stage: stageSchema,
  reasonCode: z.enum(['runtime_policy_failed', 'credential_preflight_failed', 'model_step_failed', 'output_invalid']),
  recordedAt: z.string().datetime(),
  workflow: z.object({
    name: workflowSchema,
    runId: z.string().regex(/^[1-9]\d*$/),
    runAttempt: z.number().int().positive(),
    eventName: z.enum(['issues', 'workflow_dispatch', 'schedule', 'push']),
    actor: z.string().regex(/^[A-Za-z0-9-]+(?:\[bot\])?$/),
    baseSha: gitShaSchema,
    ref: z.string().min(3).max(200),
    url: z.string().url()
  }).strict(),
  target: z.object({
    kind: targetKindSchema,
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
    sourceSha256: sha256Schema,
    url: z.string().url().nullable()
  }).strict(),
  handling: z.object({
    partialModelOutputPreserved: z.literal(false),
    authoritativeProposalPreserved: z.literal(false),
    reviewReceiptCreated: z.literal(false),
    externalStateChanged: z.literal(false),
    productionDeploymentAuthorized: z.literal(false)
  }).strict(),
  nextGate: z.string().min(60)
}).strict().superRefine((receipt, context) => {
  const mapping = automationFailureMappings[receipt.workflow.name];
  if (receipt.stage !== mapping.stage || receipt.target.kind !== mapping.targetKind) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['stage'], message: 'workflow, stage, and target kind must use one registered failure lane' });
  }
  const workflowSlug = receipt.workflow.name.replace(/\.yml$/, '');
  if (receipt.failureId !== `automation-failure-${workflowSlug}-run${receipt.workflow.runId}-attempt${receipt.workflow.runAttempt}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['failureId'], message: 'must bind the exact workflow run and attempt' });
  }
  if (receipt.workflow.url !== `https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/${receipt.workflow.runId}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['workflow', 'url'], message: 'must bind the exact owned workflow run' });
  }
  if (receipt.target.kind === 'founder_strategy_issue') {
    const expected = `https://github.com/lucasdmoyer/tipsforyourgifts/issues/${receipt.target.id}`;
    if (receipt.target.url !== expected) context.addIssue({ code: z.ZodIssueCode.custom, path: ['target', 'url'], message: 'founder strategy issue URL must bind the exact owned issue' });
  }
});

export function parseAutomationFailureReceipt(value) {
  return automationFailureReceiptSchema.parse(value);
}
