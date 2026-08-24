import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const httpsUrl = z.string().url().refine((value) => value.startsWith('https://'), 'must use HTTPS');

const accountSchema = z.object({
  externalAccountEstablished: z.boolean(),
  trackingIdentityConfigured: z.boolean(),
  termsAcceptedByFounder: z.boolean(),
  termsAcceptedAt: z.string().datetime().nullable(),
  acceptanceEvidenceReference: httpsUrl.nullable(),
  reportingExportApproved: z.boolean()
}).strict();

const programSchema = z.object({
  id: slug,
  revision: z.number().int().positive(),
  name: z.string().min(8),
  status: z.enum(['proposed', 'founder_approved', 'enabled', 'paused', 'rejected']),
  enabled: z.boolean(),
  founderDisposition: z.enum(['proposed', 'approved', 'paused', 'rejected']),
  programHomepageUrl: httpsUrl,
  termsUrl: httpsUrl,
  sourceCheckedAt: z.string().datetime(),
  sourceReviewExpiresAt: isoDate,
  eligibleArticleSlugs: z.array(slug).min(1),
  editorialFit: z.string().min(80),
  limitations: z.array(z.string().min(40)).min(2),
  allowedDomains: z.array(z.string().regex(/^[a-z0-9.-]+$/)).default([]),
  registeredSites: z.array(httpsUrl).default([]),
  trackingParameterKeys: z.array(z.string().regex(/^[A-Za-z0-9_-]+$/)).default([]),
  requiredDisclosure: z.string().min(20).nullable(),
  account: accountSchema,
  priceFeedAuthorized: z.boolean(),
  nextGate: z.string().min(80)
}).strict();

export const affiliateSchema = z.object({
  schemaVersion: z.literal('1.1.0'),
  updatedAt: z.string().datetime(),
  programs: z.array(programSchema),
  policy: z.object({
    requireHttps: z.literal(true),
    requireSponsoredRel: z.literal(true),
    allowInventedTrackingParameters: z.literal(false),
    allowExactPricesWithoutAuthorizedFeed: z.literal(false),
    founderApproverLogin: z.string().regex(/^[A-Za-z0-9-]+$/),
    proposalReviewValidityDays: z.number().int().min(30).max(180),
    activationRequires: z.array(z.string().min(8)).min(8),
    defaultDisclosure: z.string().min(50)
  }).strict()
}).strict();

export function validateAffiliateModel(input, options = {}) {
  const issues = [];
  let model;
  try {
    model = affiliateSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return [String(error?.message ?? error)];
  }

  const ids = new Set();
  const publishedSlugs = options.publishedSlugs ?? new Set();
  for (const program of model.programs) {
    if (ids.has(program.id)) issues.push(`${program.id}: duplicate program ID`);
    ids.add(program.id);
    if (program.sourceCheckedAt > model.updatedAt) issues.push(`${program.id}: source check occurs after registry update`);
    if (program.sourceReviewExpiresAt < program.sourceCheckedAt.slice(0, 10)) issues.push(`${program.id}: source review expiry precedes source check`);
    for (const articleSlug of program.eligibleArticleSlugs) {
      if (publishedSlugs.size > 0 && !publishedSlugs.has(articleSlug)) issues.push(`${program.id}: unknown publication-ready article ${articleSlug}`);
    }

    const account = program.account;
    const activationFieldsPresent = program.allowedDomains.length > 0 || program.registeredSites.length > 0 ||
      program.trackingParameterKeys.length > 0 || program.requiredDisclosure !== null ||
      account.externalAccountEstablished || account.trackingIdentityConfigured || account.termsAcceptedByFounder ||
      account.termsAcceptedAt !== null || account.acceptanceEvidenceReference !== null || account.reportingExportApproved;

    if (program.status === 'proposed') {
      if (program.enabled || program.founderDisposition !== 'proposed') issues.push(`${program.id}: proposed program must remain disabled and proposed`);
      if (activationFieldsPresent) issues.push(`${program.id}: proposed program cannot contain activation evidence or tracking configuration`);
    }
    if (program.status === 'founder_approved') {
      if (program.enabled || program.founderDisposition !== 'approved') issues.push(`${program.id}: founder-approved program must remain disabled with approved disposition`);
    }
    if (program.status === 'rejected' && (program.enabled || program.founderDisposition !== 'rejected')) {
      issues.push(`${program.id}: rejected program must be disabled and rejected`);
    }
    if (program.status === 'paused' && program.enabled) issues.push(`${program.id}: paused program must be disabled`);
    if (program.enabled !== (program.status === 'enabled')) issues.push(`${program.id}: enabled flag must exactly match enabled status`);

    if (program.status === 'enabled') {
      if (program.founderDisposition !== 'approved') issues.push(`${program.id}: enabled program requires founder approval`);
      if (!account.externalAccountEstablished) issues.push(`${program.id}: enabled program requires an externally established account`);
      if (!account.trackingIdentityConfigured) issues.push(`${program.id}: enabled program requires a program-provided tracking identity`);
      if (!account.termsAcceptedByFounder || !account.termsAcceptedAt || !account.acceptanceEvidenceReference) {
        issues.push(`${program.id}: enabled program requires founder-recorded terms acceptance evidence`);
      }
      if (program.allowedDomains.length === 0) issues.push(`${program.id}: enabled program requires allowlisted destination domains`);
      if (program.registeredSites.length === 0) issues.push(`${program.id}: enabled program requires at least one registered site`);
      if (program.trackingParameterKeys.length === 0) issues.push(`${program.id}: enabled program requires approved tracking parameter keys`);
      if (!program.requiredDisclosure) issues.push(`${program.id}: enabled program requires approved disclosure language`);
      const asOfDate = options.asOfDate ?? model.updatedAt.slice(0, 10);
      if (program.sourceReviewExpiresAt < asOfDate) issues.push(`${program.id}: enabled program terms review has expired`);
    }
  }
  return issues;
}
