import { createHash } from 'node:crypto';
import { z } from 'zod';
import { validateAffiliateModel } from './affiliate-contract.mjs';
import { affiliateCoverageSchema } from './affiliate-coverage-contract.mjs';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const productKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/);
const httpsUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
}, 'must use credential-free HTTPS without userinfo, query, or fragment');
export const CANONICAL_AFFILIATE_SITE_URL = 'https://tipsforyourgifts.web.app/';

const sensitiveValuePatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:password|passcode|secret|token|api[-_ ]?key|access[-_ ]?key|credential)\s*(?:=|:|\bis\b)\s*["']?[^\s,"']{4,}/i,
  /\b(?:password|passcode|secret|token|api[-_ ]?key|access[-_ ]?key)\s+(?:is\s+)?["']?[A-Za-z0-9+/_-]{4,}/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:routing|account)\s+(?:number|no\.?|#)?\s*(?:=|:|\bis\b)?\s*\d{6,}\b/i
];

function publicSafeText(minimum) {
  return z.string().min(minimum).refine(
    (value) => sensitiveValuePatterns.every((pattern) => !pattern.test(value)),
    'must not contain credential, contact, tax, or payout values'
  );
}

const userOnlyInput = z.enum([
  'account_login',
  'operator_identity_contact',
  'tax_profile_if_requested',
  'payout_profile_if_requested',
  'public_social_account_selection',
  'ai_tools_written_approval_request'
]);

const publicPortalField = z.enum([
  'site_name',
  'site_url',
  'about_copy',
  'promotion_method',
  'public_social_profiles_if_used',
  'profile_image_if_used',
  'banner_image_if_used'
]);

const siteProfileSchema = z.object({
  siteName: publicSafeText(4),
  productionUrl: z.literal(CANONICAL_AFFILIATE_SITE_URL),
  publisherType: z.literal('independent_editorial_publication'),
  applicationDescription: publicSafeText(160),
  promotionMethods: z.array(z.literal('owned_editorial_website')).length(1),
  audienceClaim: publicSafeText(80),
  sensitiveDataPolicy: publicSafeText(100)
}).strict();

const planProgramSchema = z.object({
  programId: slug,
  programRevision: z.number().int().positive(),
  applicationPositioning: publicSafeText(100),
  userOnlyInputs: z.array(userOnlyInput).min(1),
  publicPortalFields: z.array(publicPortalField).min(3),
  specialRequirements: z.array(publicSafeText(60)).min(2),
  stopConditions: z.array(publicSafeText(60)).min(2)
}).strict().superRefine((program, context) => {
  if (new Set(program.userOnlyInputs).size !== program.userOnlyInputs.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['userOnlyInputs'], message: 'user-only input labels must be unique' });
  }
  if (new Set(program.publicPortalFields).size !== program.publicPortalFields.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['publicPortalFields'], message: 'public portal field labels must be unique' });
  }
  for (const required of ['site_name', 'site_url', 'about_copy']) {
    if (!program.publicPortalFields.includes(required)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['publicPortalFields'], message: `public application packet requires ${required}` });
    }
  }
});

export const affiliateEnrollmentPlanSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  updatedAt: z.string().datetime(),
  siteProfile: siteProfileSchema,
  programs: z.array(planProgramSchema).min(1)
}).strict();

const stageSchema = z.enum([
  'founder_approval_required',
  'external_enrollment_required',
  'activation_evidence_required',
  'exact_link_research',
  'paused',
  'rejected'
]);

const readinessProgramSchema = planProgramSchema.extend({
  programName: publicSafeText(8),
  priority: z.number().int().positive(),
  registryStatus: z.enum(['proposed', 'founder_approved', 'enabled', 'paused', 'rejected']),
  stage: stageSchema,
  publicApplicationPacketReady: z.literal(true),
  externalEnrollmentAllowedByRegistry: z.boolean(),
  externalSubmissionStillRequiresActionTimeApproval: z.literal(true),
  externalAccountEstablished: z.boolean(),
  trackingIdentityConfigured: z.boolean(),
  productResearchProductKeys: z.array(productKey),
  verifiedPaidProductKeys: z.array(productKey),
  productResearchCandidates: z.number().int().nonnegative(),
  verifiedPaidLinks: z.number().int().nonnegative(),
  programHomepageUrl: httpsUrl,
  termsUrl: httpsUrl,
  nextGate: publicSafeText(80)
}).strict();

export const affiliateEnrollmentReadinessSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  registryUpdatedAt: z.string().datetime(),
  planUpdatedAt: z.string().datetime(),
  definition: z.literal('Application packets contain public site facts, non-sensitive positioning, and labels for portal-only founder inputs. They do not create accounts, accept terms, submit forms, assert acceptance, store credentials, or authorize paid links.'),
  siteProfile: siteProfileSchema,
  productResearchProductKeys: z.array(productKey),
  verifiedPaidProductKeys: z.array(productKey),
  counts: z.object({
    totalPrograms: z.number().int().nonnegative(),
    publicApplicationPacketsReady: z.number().int().nonnegative(),
    externalEnrollmentAllowedByRegistry: z.number().int().nonnegative(),
    awaitingFounderProgramApproval: z.number().int().nonnegative(),
    externallyEnrolled: z.number().int().nonnegative(),
    enabledPrograms: z.number().int().nonnegative(),
    productResearchCandidates: z.number().int().nonnegative(),
    verifiedPaidLinks: z.number().int().nonnegative()
  }).strict(),
  programs: z.array(readinessProgramSchema)
}).strict().superRefine((readiness, context) => {
  const ids = readiness.programs.map((program) => program.programId);
  const priorities = readiness.programs.map((program) => program.priority);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs'], message: 'readiness program IDs must be unique' });
  if (new Set(priorities).size !== priorities.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs'], message: 'readiness priorities must be unique' });
  for (const [index, program] of readiness.programs.entries()) {
    if (program.priority !== index + 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'priority'], message: 'readiness priorities must be contiguous and sorted' });
    const expectedStage = stageFor(program);
    if (program.stage !== expectedStage) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'stage'], message: `stage must be ${expectedStage}` });
    const expectedEnrollmentAllowed = ['founder_approved', 'enabled'].includes(program.registryStatus);
    if (program.externalEnrollmentAllowedByRegistry !== expectedEnrollmentAllowed) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'externalEnrollmentAllowedByRegistry'], message: 'enrollment permission must match registry status' });
    if (program.trackingIdentityConfigured && !program.externalAccountEstablished) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'trackingIdentityConfigured'], message: 'tracking identity requires an external account' });
    if (program.registryStatus === 'proposed' && (program.externalAccountEstablished || program.trackingIdentityConfigured)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index], message: 'proposed state cannot claim account or tracking setup' });
    if (program.registryStatus === 'enabled' && (!program.externalAccountEstablished || !program.trackingIdentityConfigured)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index], message: 'enabled program requires account and tracking setup' });
    if (!program.publicApplicationPacketReady) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'publicApplicationPacketReady'], message: 'tracked readiness artifact may contain only complete public packets' });
    if (new Set(program.productResearchProductKeys).size !== program.productResearchProductKeys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'productResearchProductKeys'], message: 'program product research keys must be unique' });
    const sortedProgramProductKeys = [...program.productResearchProductKeys].sort();
    if (sortedProgramProductKeys.some((productKeyValue, productIndex) => productKeyValue !== program.productResearchProductKeys[productIndex])) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'productResearchProductKeys'], message: 'program product research keys must be sorted' });
    if (program.productResearchProductKeys.some((productKeyValue) => !readiness.productResearchProductKeys.includes(productKeyValue))) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'productResearchProductKeys'], message: 'program product research keys must belong to the global product key set' });
    if (program.productResearchCandidates !== program.productResearchProductKeys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'productResearchCandidates'], message: 'program research count must match its explicit product key set' });
    if (new Set(program.verifiedPaidProductKeys).size !== program.verifiedPaidProductKeys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'verifiedPaidProductKeys'], message: 'program paid product keys must be unique' });
    const sortedProgramPaidKeys = [...program.verifiedPaidProductKeys].sort();
    if (sortedProgramPaidKeys.some((productKeyValue, productIndex) => productKeyValue !== program.verifiedPaidProductKeys[productIndex])) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'verifiedPaidProductKeys'], message: 'program paid product keys must be sorted' });
    if (program.verifiedPaidProductKeys.some((productKeyValue) => !program.productResearchProductKeys.includes(productKeyValue) || !readiness.verifiedPaidProductKeys.includes(productKeyValue))) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'verifiedPaidProductKeys'], message: 'program paid product keys must belong to its research roster and the global paid roster' });
    if (program.verifiedPaidLinks !== program.verifiedPaidProductKeys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'verifiedPaidLinks'], message: 'program paid-link count must match its explicit paid product key set' });
    if (program.registryStatus !== 'enabled' && program.verifiedPaidProductKeys.length > 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'verifiedPaidProductKeys'], message: 'only enabled programs may claim verified paid product keys' });
  }
  const expectedCounts = {
    totalPrograms: readiness.programs.length,
    publicApplicationPacketsReady: readiness.programs.filter((program) => program.publicApplicationPacketReady).length,
    externalEnrollmentAllowedByRegistry: readiness.programs.filter((program) => program.externalEnrollmentAllowedByRegistry).length,
    awaitingFounderProgramApproval: readiness.programs.filter((program) => program.registryStatus === 'proposed').length,
    externallyEnrolled: readiness.programs.filter((program) => program.externalAccountEstablished).length,
    enabledPrograms: readiness.programs.filter((program) => program.registryStatus === 'enabled').length,
    verifiedPaidLinks: readiness.programs.reduce((sum, program) => sum + program.verifiedPaidLinks, 0)
  };
  for (const [key, expected] of Object.entries(expectedCounts)) {
    if (readiness.counts[key] !== expected) context.addIssue({ code: z.ZodIssueCode.custom, path: ['counts', key], message: `${key} must derive from program records` });
  }
  if (new Set(readiness.productResearchProductKeys).size !== readiness.productResearchProductKeys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['productResearchProductKeys'], message: 'product research keys must be unique' });
  const sortedProductKeys = [...readiness.productResearchProductKeys].sort();
  if (sortedProductKeys.some((productKey, index) => productKey !== readiness.productResearchProductKeys[index])) context.addIssue({ code: z.ZodIssueCode.custom, path: ['productResearchProductKeys'], message: 'product research keys must be sorted' });
  const programResearchUnion = [...new Set(readiness.programs.flatMap((program) => program.productResearchProductKeys))].sort();
  if (programResearchUnion.length !== readiness.productResearchProductKeys.length || programResearchUnion.some((productKeyValue, index) => productKeyValue !== readiness.productResearchProductKeys[index])) context.addIssue({ code: z.ZodIssueCode.custom, path: ['productResearchProductKeys'], message: 'global product research keys must equal the union of program research rosters' });
  if (readiness.counts.productResearchCandidates !== readiness.productResearchProductKeys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['counts', 'productResearchCandidates'], message: 'unique product research count must match the explicit product key set' });
  if (new Set(readiness.verifiedPaidProductKeys).size !== readiness.verifiedPaidProductKeys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['verifiedPaidProductKeys'], message: 'verified paid product keys must be unique' });
  const sortedPaidKeys = [...readiness.verifiedPaidProductKeys].sort();
  if (sortedPaidKeys.some((productKeyValue, index) => productKeyValue !== readiness.verifiedPaidProductKeys[index])) context.addIssue({ code: z.ZodIssueCode.custom, path: ['verifiedPaidProductKeys'], message: 'verified paid product keys must be sorted' });
  const programPaidUnion = [...new Set(readiness.programs.flatMap((program) => program.verifiedPaidProductKeys))].sort();
  if (programPaidUnion.length !== readiness.verifiedPaidProductKeys.length || programPaidUnion.some((productKeyValue, index) => productKeyValue !== readiness.verifiedPaidProductKeys[index])) context.addIssue({ code: z.ZodIssueCode.custom, path: ['verifiedPaidProductKeys'], message: 'global verified paid product keys must equal the union of program paid rosters' });
  if (readiness.verifiedPaidProductKeys.some((productKeyValue) => !readiness.productResearchProductKeys.includes(productKeyValue))) context.addIssue({ code: z.ZodIssueCode.custom, path: ['verifiedPaidProductKeys'], message: 'verified paid product keys must belong to the global research roster' });
  if (readiness.counts.verifiedPaidLinks !== readiness.verifiedPaidProductKeys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['counts', 'verifiedPaidLinks'], message: 'verified paid-link count must match the explicit paid product key set' });
});

function stageFor(program) {
  const status = program.status ?? program.registryStatus;
  if (status === 'enabled') return 'exact_link_research';
  if (status === 'founder_approved') {
    const accountEstablished = program.account?.externalAccountEstablished ?? program.externalAccountEstablished;
    return accountEstablished ? 'activation_evidence_required' : 'external_enrollment_required';
  }
  return status === 'proposed' ? 'founder_approval_required' : status;
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`${label} cannot contain duplicates`);
}

export function buildAffiliateEnrollmentReadiness({ affiliate, coverage, plan: inputPlan }) {
  const affiliateIssues = validateAffiliateModel(affiliate);
  if (affiliateIssues.length > 0) throw new Error(`affiliate registry is invalid: ${affiliateIssues.join('; ')}`);
  coverage = affiliateCoverageSchema.parse(coverage);
  const affiliateRegistrySha256 = createHash('sha256').update(`${JSON.stringify(affiliate, null, 2)}\n`).digest('hex');
  if (coverage.registrySha256 !== affiliateRegistrySha256) throw new Error('affiliate coverage registry SHA-256 does not match the affiliate registry');
  if (coverage.registryUpdatedAt !== affiliate.updatedAt) throw new Error('affiliate coverage update time does not match the affiliate registry');
  const plan = affiliateEnrollmentPlanSchema.parse(inputPlan);
  assertUnique(plan.programs.map((entry) => entry.programId), 'affiliate enrollment program IDs');
  for (const entry of plan.programs) {
    assertUnique(entry.userOnlyInputs, `${entry.programId} user-only inputs`);
    assertUnique(entry.publicPortalFields, `${entry.programId} public portal fields`);
  }

  const registryIds = affiliate.programs.map((program) => program.id);
  const planIds = plan.programs.map((entry) => entry.programId);
  const missingPlans = registryIds.filter((id) => !planIds.includes(id));
  const unknownPlans = planIds.filter((id) => !registryIds.includes(id));
  if (missingPlans.length > 0) throw new Error(`affiliate enrollment plan is missing programs: ${missingPlans.join(', ')}`);
  if (unknownPlans.length > 0) throw new Error(`affiliate enrollment plan has unknown programs: ${unknownPlans.join(', ')}`);

  const coverageByProgram = new Map(coverage.programs.map((entry) => [entry.programId, entry]));
  const unknownCoveragePrograms = coverage.programs.map((entry) => entry.programId).filter((programId) => !registryIds.includes(programId));
  if (unknownCoveragePrograms.length > 0) throw new Error(`affiliate coverage has unknown programs: ${unknownCoveragePrograms.join(', ')}`);
  const planByProgram = new Map(plan.programs.map((entry) => [entry.programId, entry]));
  const programs = [...affiliate.programs]
    .sort((left, right) => left.priority - right.priority)
    .map((program) => {
      const entry = planByProgram.get(program.id);
      if (entry.programRevision !== program.revision) {
        throw new Error(`${program.id} enrollment plan revision ${entry.programRevision} does not match registry revision ${program.revision}`);
      }
      const programCoverage = coverageByProgram.get(program.id);
      if (!programCoverage) throw new Error(`${program.id} has no affiliate coverage record`);
      if (programCoverage.programRevision !== program.revision) throw new Error(`${program.id} coverage revision does not match the affiliate registry`);
      if (programCoverage.priority !== program.priority) throw new Error(`${program.id} coverage priority does not match the affiliate registry`);
      if (programCoverage.status !== program.status) throw new Error(`${program.id} coverage status does not match the affiliate registry`);
      if (programCoverage.selectionMode !== program.productSelection.mode) throw new Error(`${program.id} coverage selection mode does not match the affiliate registry`);
      const selectedCoverageArticleCount = new Set(
        coverage.products
          .filter((product) => product.candidateProgramIds.includes(program.id))
          .map((product) => product.articleSlug)
      ).size;
      if (programCoverage.eligibleArticleCount !== selectedCoverageArticleCount) throw new Error(`${program.id} coverage article count does not match exact product assignments`);
      const productResearchProductKeys = coverage.products
        .filter((product) => product.candidateProgramIds.includes(program.id))
        .map((product) => `${product.articleSlug}:${product.productId}`)
        .sort();
      const verifiedPaidProductKeys = coverage.products
        .filter((product) => product.verifiedPaidProgramId === program.id)
        .map((product) => `${product.articleSlug}:${product.productId}`)
        .sort();
      if (productResearchProductKeys.length !== programCoverage.productResearchCandidates) throw new Error(`${program.id} coverage research count does not match exact product assignments`);
      if (verifiedPaidProductKeys.length !== programCoverage.verifiedPaidLinks) throw new Error(`${program.id} coverage paid-link count does not match exact paid product assignments`);
      return {
        ...entry,
        programName: program.name,
        priority: program.priority,
        registryStatus: program.status,
        stage: stageFor(program),
        publicApplicationPacketReady: true,
        externalEnrollmentAllowedByRegistry: ['founder_approved', 'enabled'].includes(program.status),
        externalSubmissionStillRequiresActionTimeApproval: true,
        externalAccountEstablished: program.account.externalAccountEstablished,
        trackingIdentityConfigured: program.account.trackingIdentityConfigured,
        productResearchProductKeys,
        verifiedPaidProductKeys,
        productResearchCandidates: programCoverage.productResearchCandidates,
        verifiedPaidLinks: programCoverage.verifiedPaidLinks,
        programHomepageUrl: program.programHomepageUrl,
        termsUrl: program.termsUrl,
        nextGate: program.nextGate
      };
    });

  const artifact = {
    schemaVersion: '1.0.0',
    registryUpdatedAt: affiliate.updatedAt,
    planUpdatedAt: plan.updatedAt,
    definition: 'Application packets contain public site facts, non-sensitive positioning, and labels for portal-only founder inputs. They do not create accounts, accept terms, submit forms, assert acceptance, store credentials, or authorize paid links.',
    siteProfile: plan.siteProfile,
    productResearchProductKeys: coverage.products
      .filter((product) => product.candidateProgramIds.length > 0)
      .map((product) => `${product.articleSlug}:${product.productId}`)
      .sort(),
    verifiedPaidProductKeys: coverage.products
      .filter((product) => product.verifiedPaidProgramId !== null)
      .map((product) => `${product.articleSlug}:${product.productId}`)
      .sort(),
    counts: {
      totalPrograms: programs.length,
      publicApplicationPacketsReady: programs.filter((entry) => entry.publicApplicationPacketReady).length,
      externalEnrollmentAllowedByRegistry: programs.filter((entry) => entry.externalEnrollmentAllowedByRegistry).length,
      awaitingFounderProgramApproval: programs.filter((entry) => entry.registryStatus === 'proposed').length,
      externallyEnrolled: programs.filter((entry) => entry.externalAccountEstablished).length,
      enabledPrograms: programs.filter((entry) => entry.registryStatus === 'enabled').length,
      productResearchCandidates: coverage.counts.productsAssignedToPartnerResearch,
      verifiedPaidLinks: coverage.counts.productsWithVerifiedPaidDestination
    },
    programs
  };
  return affiliateEnrollmentReadinessSchema.parse(artifact);
}
