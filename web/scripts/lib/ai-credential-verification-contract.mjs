import { z } from 'zod';

const sha40 = z.string().regex(/^[a-f0-9]{40}$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const aiCredentialVerificationReceiptSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  secretName: z.literal('OPENAI_API_KEY'),
  method: z.literal('openai_models_endpoint'),
  endpoint: z.literal('https://api.openai.com/v1/models'),
  outcome: z.literal('authenticated'),
  httpStatus: z.literal(200),
  verifiedAt: z.string().datetime({ offset: true }),
  repository: z.literal('lucasdmoyer/tipsforyourgifts'),
  actor: z.literal('lucasdmoyer'),
  ref: z.literal('refs/heads/master'),
  baseSha: sha40,
  basePolicySha256: sha256,
  workflowRunId: z.string().regex(/^[1-9]\d*$/),
  workflowRunAttempt: z.number().int().positive(),
  workflowRunUrl: z.string().url().regex(/^https:\/\/github\.com\/lucasdmoyer\/tipsforyourgifts\/actions\/runs\/[1-9]\d*$/),
  secretValueStored: z.literal(false),
  responseBodyStored: z.literal(false),
  modelCalled: z.literal(false),
  policyActivated: z.literal(false)
}).strict().superRefine((receipt, context) => {
  if (!receipt.workflowRunUrl.endsWith(`/runs/${receipt.workflowRunId}`)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['workflowRunUrl'], message: 'Workflow run URL must bind the exact workflow run ID' });
  }
});

export function parseAiCredentialVerificationReceipt(value) {
  return aiCredentialVerificationReceiptSchema.parse(value);
}
