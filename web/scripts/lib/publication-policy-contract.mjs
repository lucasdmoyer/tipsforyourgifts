import { z } from 'zod';

export const publicationPolicySchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  updatedAt: z.string().datetime(),
  mode: z.enum(['founder_reviewed', 'automatic_after_proven']),
  requiredApproverLogin: z.literal('lucasdmoyer'),
  automaticPromotion: z.object({
    enabled: z.boolean(),
    minimumSuccessfulFounderReviewedReleases: z.number().int().min(10),
    verifiedSuccessfulReleaseCount: z.number().int().nonnegative(),
    founderApproved: z.boolean(),
    approvedBy: z.string().min(1).nullable(),
    approvedAt: z.string().datetime().nullable()
  }),
  requiredGates: z.object({
    independentQaReceipt: z.literal(true),
    deterministicValidation: z.literal(true),
    firebaseExactShaPreview: z.literal(true),
    productionSmoke: z.literal(true),
    rollbackTargetRecorded: z.literal(true),
    verifiedReleaseReceipt: z.literal(true)
  })
}).superRefine((policy, context) => {
  const automatic = policy.automaticPromotion;
  if (!automatic.enabled) {
    if (policy.mode !== 'founder_reviewed') context.addIssue({ code: z.ZodIssueCode.custom, path: ['mode'], message: 'disabled automation must remain founder_reviewed' });
    if (automatic.founderApproved || automatic.approvedBy || automatic.approvedAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ['automaticPromotion'], message: 'disabled automation cannot carry an active founder approval' });
    return;
  }
  if (policy.mode !== 'automatic_after_proven') context.addIssue({ code: z.ZodIssueCode.custom, path: ['mode'], message: 'enabled automation must use automatic_after_proven' });
  if (!automatic.founderApproved || !automatic.approvedBy || !automatic.approvedAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ['automaticPromotion'], message: 'automatic promotion requires an explicit founder approval record' });
  if (automatic.approvedBy !== policy.requiredApproverLogin) context.addIssue({ code: z.ZodIssueCode.custom, path: ['automaticPromotion', 'approvedBy'], message: 'automatic promotion must be approved by the configured founder login' });
  if (automatic.verifiedSuccessfulReleaseCount < automatic.minimumSuccessfulFounderReviewedReleases) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['automaticPromotion', 'verifiedSuccessfulReleaseCount'], message: 'automatic promotion requires the minimum successful founder-reviewed releases' });
  }
});

export function parsePublicationPolicy(value) {
  return publicationPolicySchema.parse(value);
}
