import { z } from 'zod';
import { isIP } from 'node:net';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const httpsUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
}, 'must use credential-free HTTPS without userinfo, query, or fragment');

export function assertPublicHttpsOrigin(value, label = 'site') {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be a valid URL`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must be a credential-free HTTPS URL without query or fragment`);
  }
  if (url.pathname !== '/' || url.toString() !== `${url.origin}/`) {
    throw new Error(`${label} must be the exact HTTPS site origin with a trailing slash`);
  }
  const hostname = url.hostname.toLowerCase();
  const normalizedHostname = hostname.replace(/\.$/, '');
  const unbracketedHostname = normalizedHostname.replace(/^\[|\]$/g, '');
  const reservedSuffixes = ['.localhost', '.local', '.internal', '.home', '.lan', '.localdomain', '.test', '.example', '.invalid', '.onion'];
  if (!normalizedHostname.includes('.') || normalizedHostname === 'localhost' || reservedSuffixes.some((suffix) => normalizedHostname.endsWith(suffix)) || isIP(unbracketedHostname) !== 0) {
    throw new Error(`${label} must use a public DNS hostname`);
  }
  return url;
}

const accountSchema = z.object({
  externalAccountEstablished: z.boolean(),
  trackingIdentityConfigured: z.boolean(),
  verificationStatus: z.enum(['not_started', 'requested', 'verified']).default('not_started'),
  verificationObservedAt: z.string().datetime().nullable().default(null),
  publicTrackingIdentity: z.string().regex(/^[A-Za-z0-9_-]+$/).nullable().default(null),
  publicStorefrontUrl: httpsUrl.nullable().default(null),
  weeklyReportsEnabled: z.boolean().default(false),
  termsAcceptedByFounder: z.boolean(),
  termsAcceptedAt: z.string().datetime().nullable(),
  acceptanceEvidenceReference: httpsUrl.nullable(),
  reportingExportApproved: z.boolean()
}).strict();

const researchCandidateSelectionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('explicit_products'),
    eligibleProductIds: z.array(slug).min(1)
  }).strict(),
  z.object({
    mode: z.literal('all_products_in_eligible_articles'),
    eligibleProductIds: z.array(slug).length(0)
  }).strict(),
  z.object({
    mode: z.literal('all_publication_ready_products'),
    eligibleProductIds: z.array(slug).length(0)
  }).strict()
]);

const activationProductSelectionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('explicit_products'),
    eligibleProductIds: z.array(slug).min(1)
  }).strict(),
  z.object({
    mode: z.literal('discovery_only'),
    eligibleProductIds: z.array(slug).length(0)
  }).strict()
]);

const programSchema = z.object({
  id: slug,
  revision: z.number().int().positive(),
  priority: z.number().int().positive(),
  coverageRole: z.enum(['category_specialist', 'broad_catalog', 'retailer_alternative', 'marketplace_contingency']),
  name: z.string().min(8),
  status: z.enum(['proposed', 'founder_approved', 'externally_verified', 'enabled', 'paused', 'rejected']),
  enabled: z.boolean(),
  founderDisposition: z.enum(['proposed', 'approved', 'paused', 'rejected']),
  programHomepageUrl: httpsUrl,
  termsUrl: httpsUrl,
  sourceCheckedAt: z.string().datetime(),
  sourceReviewExpiresAt: isoDate,
  eligibleArticleSlugs: z.array(slug),
  researchCandidateSelection: researchCandidateSelectionSchema,
  activationProductSelection: activationProductSelectionSchema,
  editorialFit: z.string().min(80),
  limitations: z.array(z.string().min(40)).min(2),
  allowedDomains: z.array(z.string().regex(/^[a-z0-9.-]+$/)).default([]),
  registeredSites: z.array(httpsUrl).default([]),
  trackingMethod: z.enum(['query_parameters', 'path_redirect_to_query']).default('query_parameters'),
  trackingPathPrefix: z.string().regex(/^\/[a-z0-9-]+\/$/).nullable().default(null),
  trackingParameterKeys: z.array(z.string().regex(/^[A-Za-z0-9_-]+$/)).default([]),
  requiredDisclosure: z.string().min(20).nullable(),
  account: accountSchema,
  priceFeedAuthorized: z.boolean(),
  nextGate: z.string().min(80)
}).strict();

export const affiliateSchema = z.object({
  schemaVersion: z.literal('1.2.0'),
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

export function programSelectsResearchCandidate(program, articleSlug, productId) {
  if (program.researchCandidateSelection.mode === 'all_publication_ready_products') return true;
  if (!program.eligibleArticleSlugs.includes(articleSlug)) return false;
  return program.researchCandidateSelection.mode === 'all_products_in_eligible_articles' ||
    program.researchCandidateSelection.eligibleProductIds.includes(productId);
}

export function programAllowsPaidProduct(program, articleSlug, productId) {
  return program.activationProductSelection.mode === 'explicit_products' &&
    program.activationProductSelection.eligibleProductIds.includes(productId) &&
    programSelectsResearchCandidate(program, articleSlug, productId);
}

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
  const priorities = new Set();
  const publishedSlugs = options.publishedSlugs ?? new Set();
  for (const [programIndex, program] of model.programs.entries()) {
    if (ids.has(program.id)) issues.push(`${program.id}: duplicate program ID`);
    ids.add(program.id);
    if (priorities.has(program.priority)) issues.push(`${program.id}: duplicate program priority ${program.priority}`);
    priorities.add(program.priority);
    const expectedPriority = programIndex + 1;
    if (program.priority !== expectedPriority) {
      issues.push(`${program.id}: program priorities must be contiguous and registry order must be ascending; expected ${expectedPriority}, received ${program.priority}`);
    }
    if (new Set(program.eligibleArticleSlugs).size !== program.eligibleArticleSlugs.length) {
      issues.push(`${program.id}: eligible article slugs cannot contain duplicates`);
    }
    if (new Set(program.researchCandidateSelection.eligibleProductIds).size !== program.researchCandidateSelection.eligibleProductIds.length) {
      issues.push(`${program.id}: research candidate product IDs cannot contain duplicates`);
    }
    if (new Set(program.activationProductSelection.eligibleProductIds).size !== program.activationProductSelection.eligibleProductIds.length) {
      issues.push(`${program.id}: activation product IDs cannot contain duplicates`);
    }
    if (program.researchCandidateSelection.mode === 'all_publication_ready_products' && program.eligibleArticleSlugs.length > 0) {
      issues.push(`${program.id}: automatic publication-ready coverage cannot carry a manual article allowlist`);
    }
    if (program.researchCandidateSelection.mode !== 'all_publication_ready_products' && program.eligibleArticleSlugs.length === 0) {
      issues.push(`${program.id}: configured research candidate selection requires at least one eligible article`);
    }
    for (const productId of program.activationProductSelection.eligibleProductIds) {
      if (program.researchCandidateSelection.mode === 'explicit_products' && !program.researchCandidateSelection.eligibleProductIds.includes(productId)) {
        issues.push(`${program.id}: activation product ${productId} must also be an explicit research candidate`);
      }
    }
    if (program.sourceCheckedAt > model.updatedAt) issues.push(`${program.id}: source check occurs after registry update`);
    if (program.sourceReviewExpiresAt < program.sourceCheckedAt.slice(0, 10)) issues.push(`${program.id}: source review expiry precedes source check`);
    for (const registeredSite of program.registeredSites) {
      try { assertPublicHttpsOrigin(registeredSite, `${program.id}: registered site`); } catch (error) { issues.push(error.message); }
    }
    for (const articleSlug of program.eligibleArticleSlugs) {
      if (publishedSlugs.size > 0 && !publishedSlugs.has(articleSlug)) issues.push(`${program.id}: unknown publication-ready article ${articleSlug}`);
    }
    const publishedProductsByArticle = options.publishedProductsByArticle ?? new Map();
    if (publishedProductsByArticle.size > 0 && program.researchCandidateSelection.mode === 'explicit_products') {
      for (const productId of program.researchCandidateSelection.eligibleProductIds) {
        const matchingArticles = program.eligibleArticleSlugs.filter((articleSlug) => publishedProductsByArticle.get(articleSlug)?.has(productId));
        if (matchingArticles.length === 0) issues.push(`${program.id}: unknown research candidate product ${productId} in configured publication-ready articles`);
        if (matchingArticles.length > 1) issues.push(`${program.id}: research candidate product ${productId} is ambiguous across configured articles`);
      }
    }
    if (publishedProductsByArticle.size > 0 && program.activationProductSelection.mode === 'explicit_products') {
      const activationArticleSlugs = program.eligibleArticleSlugs.length > 0
        ? program.eligibleArticleSlugs
        : [...publishedProductsByArticle.keys()];
      for (const productId of program.activationProductSelection.eligibleProductIds) {
        const matchingArticles = activationArticleSlugs.filter((articleSlug) => publishedProductsByArticle.get(articleSlug)?.has(productId));
        if (matchingArticles.length === 0) issues.push(`${program.id}: unknown activation product ${productId} in configured publication-ready articles`);
        if (matchingArticles.length > 1) issues.push(`${program.id}: activation product ${productId} is ambiguous across configured articles`);
      }
    }

    const account = program.account;
    const externalVerificationFieldsPresent = account.externalAccountEstablished || account.trackingIdentityConfigured ||
      account.verificationStatus !== 'not_started' || account.verificationObservedAt !== null ||
      account.publicTrackingIdentity !== null || account.publicStorefrontUrl !== null || account.weeklyReportsEnabled;
    const activationFieldsPresent = program.allowedDomains.length > 0 || program.registeredSites.length > 0 ||
      program.trackingParameterKeys.length > 0 || program.trackingPathPrefix !== null || program.requiredDisclosure !== null || account.termsAcceptedByFounder ||
      account.termsAcceptedAt !== null || account.acceptanceEvidenceReference !== null || account.reportingExportApproved;

    if (program.status === 'proposed') {
      if (program.enabled || program.founderDisposition !== 'proposed') issues.push(`${program.id}: proposed program must remain disabled and proposed`);
      if (externalVerificationFieldsPresent || activationFieldsPresent) issues.push(`${program.id}: proposed program cannot contain verification, activation, or tracking evidence`);
    }
    if (program.status === 'founder_approved') {
      if (program.enabled || program.founderDisposition !== 'approved') issues.push(`${program.id}: founder-approved program must remain disabled with approved disposition`);
      if (externalVerificationFieldsPresent || activationFieldsPresent) issues.push(`${program.id}: founder-approved program cannot contain unreviewed verification, activation, or tracking evidence`);
    }
    if (program.status === 'externally_verified') {
      if (program.enabled || program.founderDisposition !== 'approved') issues.push(`${program.id}: externally verified program must remain disabled with approved disposition`);
      if (!account.externalAccountEstablished || !account.trackingIdentityConfigured || account.verificationStatus !== 'verified' ||
        !account.verificationObservedAt || !account.publicTrackingIdentity || !account.publicStorefrontUrl) {
        issues.push(`${program.id}: externally verified program requires observed account, tracking identity, and storefront evidence`);
      }
      if (account.verificationObservedAt && account.verificationObservedAt > model.updatedAt) issues.push(`${program.id}: verification observation occurs after registry update`);
      if (activationFieldsPresent) issues.push(`${program.id}: externally verified program cannot contain terms acceptance or activation configuration`);
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
      if (account.verificationStatus !== 'verified' || !account.verificationObservedAt || !account.publicTrackingIdentity || !account.publicStorefrontUrl) {
        issues.push(`${program.id}: enabled program requires recorded external verification evidence`);
      }
      if (!account.termsAcceptedByFounder || !account.termsAcceptedAt || !account.acceptanceEvidenceReference) {
        issues.push(`${program.id}: enabled program requires founder-recorded terms acceptance evidence`);
      }
      if (program.allowedDomains.length === 0) issues.push(`${program.id}: enabled program requires allowlisted destination domains`);
      if (program.registeredSites.length === 0) issues.push(`${program.id}: enabled program requires at least one registered site`);
      if (program.trackingParameterKeys.length === 0) issues.push(`${program.id}: enabled program requires approved tracking parameter keys`);
      if (program.trackingMethod === 'query_parameters' && program.trackingPathPrefix !== null) issues.push(`${program.id}: query-parameter tracking cannot configure a path prefix`);
      if (program.trackingMethod === 'path_redirect_to_query' && program.trackingPathPrefix === null) issues.push(`${program.id}: path-redirect tracking requires a path prefix`);
      if (program.activationProductSelection.mode !== 'explicit_products') issues.push(`${program.id}: enabled program requires an explicit paid-product allowlist`);
      if (!program.requiredDisclosure) issues.push(`${program.id}: enabled program requires approved disclosure language`);
      const asOfDate = options.asOfDate ?? model.updatedAt.slice(0, 10);
      if (program.sourceReviewExpiresAt < asOfDate) issues.push(`${program.id}: enabled program terms review has expired`);
    }
  }
  return issues;
}
