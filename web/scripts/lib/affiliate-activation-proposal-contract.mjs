import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CANONICAL_AFFILIATE_SITE_URL } from './affiliate-enrollment-contract.mjs';
import { validateAffiliateModel } from './affiliate-contract.mjs';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const httpsUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'must use credential-free HTTPS');
const trackingIdentity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/);
const observationReceiptPath = z.string().regex(/^affiliate\/evidence\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/);
const EXACT_TERMS_SOURCE_URL = 'https://bookshop.org/info/terms-of-use';
const EXACT_TERMS_RESOLVED_URL = 'https://bookshop-webflow.bkshp.org/terms-of-use';
const EXACT_PROGRAM_EXPLANATION_URL = 'https://support.bookshop.org/en/support/solutions/articles/65000191390-can-you-explain-bookshop-org-s-affiliate-program-';
const EXACT_LINK_GUIDE_URL = 'https://support.bookshop.org/en/support/solutions/articles/65000189603-how-do-affiliate-links-widgets-work-on-bookshop-org-';
const EXACT_DISCLOSURE_GUIDE_URL = 'https://support.bookshop.org/en/support/solutions/articles/65000168990-if-i-m-an-affiliate-do-i-have-to-disclose-that-on-my-website-newsletter-or-social-media-posts-';

export const affiliateActivationObservationReceiptSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  receiptId: slug,
  observerId: trackingIdentity,
  observationMethod: z.literal('authenticated_browser_observation'),
  observedAt: z.string().datetime(),
  programId: slug,
  publicTrackingIdentity: trackingIdentity,
  publicStorefrontUrl: httpsUrl,
  articleSlug: slug,
  productId: slug,
  productIsbn: z.string().regex(/^\d{13}$/),
  paidUrl: httpsUrl,
  resolvedUrl: httpsUrl,
  purchaseActionLabel: z.string().min(3),
  storefrontLabel: z.literal('Tips for Your Gifts'),
  automatedFetch: z.object({
    lastKnownStatus: z.literal(403),
    redirectsObserved: z.literal(0),
    treatedAsPassingEvidence: z.literal(false)
  }).strict(),
  assertions: z.object({
    intendedEditionObserved: z.literal(true),
    trackingIdentityObserved: z.literal(true),
    purchaseActionObserved: z.literal(true),
    independentAffiliateLinkReviewCompleted: z.literal(false),
    paidLinkApproved: z.literal(false),
    productionDeploymentAuthorized: z.literal(false)
  }).strict()
}).strict();

export const affiliateActivationProposalSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  updatedAt: z.string().datetime(),
  proposals: z.array(z.object({
    id: slug,
    status: z.literal('approval_boundary'),
    programId: slug,
    expectedProgramRevision: z.number().int().positive(),
    activation: z.object({
      allowedDomains: z.array(z.string().regex(/^[a-z0-9.-]+$/)).length(1),
      registeredSite: z.literal(CANONICAL_AFFILIATE_SITE_URL),
      trackingMethod: z.literal('path_redirect_to_query'),
      trackingPathPrefix: z.literal('/a/'),
      trackingParameterKeys: z.array(z.literal('affiliate')).length(1),
      reportingExportApproved: z.literal(false),
      requiredDisclosure: z.string().min(80),
      priceFeedAuthorized: z.literal(false)
    }).strict(),
    evidence: z.object({
      termsSourceUrl: httpsUrl,
      termsResolvedUrl: httpsUrl,
      termsLastUpdated: z.string().date(),
      programExplanationUrl: httpsUrl,
      linkGuideUrl: httpsUrl,
      disclosureGuideUrl: httpsUrl,
      observedAt: z.string().datetime(),
      publicTrackingIdentity: trackingIdentity,
      publicStorefrontUrl: httpsUrl,
      observedPaidUrl: httpsUrl,
      observedResolvedUrl: httpsUrl,
      productIsbn: z.string().regex(/^\d{13}$/),
      productId: slug,
      articleSlug: slug,
      automatedFetchStatus: z.literal(403),
      destinationObservationMethod: z.literal('authenticated_browser_observation'),
      observationReceiptPath,
      observationReceiptSha256: sha256,
      observerId: trackingIdentity,
      purchaseActionLabel: z.string().min(3)
    }).strict(),
    assertions: z.object({
      programStillDisabledAtProposalCreation: z.literal(true),
      termsNotRecordedAcceptedAtProposalCreation: z.literal(true),
      paidLinkCandidateCreatedAtProposalCreation: z.literal(false),
      activationCreatesPaidLink: z.literal(false),
      productionDeploymentAuthorized: z.literal(false),
      customerDataExportApproved: z.literal(false)
    }).strict()
  }).strict()).min(1)
}).strict().superRefine((document, context) => {
  const ids = document.proposals.map((proposal) => proposal.id);
  const programIds = document.proposals.map((proposal) => proposal.programId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['proposals'], message: 'proposal IDs must be unique' });
  if (new Set(programIds).size !== programIds.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['proposals'], message: 'program IDs must be unique' });
});

export function affiliateActivationApprovalBoundarySha256(proposal) {
  const boundary = { id: proposal.id, programId: proposal.programId, expectedProgramRevision: proposal.expectedProgramRevision, activation: proposal.activation, evidence: proposal.evidence };
  return createHash('sha256').update(`${JSON.stringify(boundary, null, 2)}\n`).digest('hex');
}

function requireExactQuery(resolved, expected) {
  const entries = [...resolved.searchParams.entries()];
  const lowerKeys = entries.map(([key]) => key.toLowerCase());
  if (entries.length !== Object.keys(expected).length || new Set(lowerKeys).size !== entries.length) throw new Error('resolved URL contains duplicate, case-colliding, missing, or extra parameters');
  const expectedKeys = Object.keys(expected).sort();
  if ([...lowerKeys].sort().some((key, index) => key !== expectedKeys[index])) throw new Error('resolved URL contains duplicate, case-colliding, missing, or extra parameters');
  for (const [key, value] of entries) {
    if (key !== key.toLowerCase() || expected[key] !== value) throw new Error(`resolved ${key} value is missing or changed`);
  }
}

function evidenceRecordFor(proposal, evidenceRecords) {
  const record = evidenceRecords?.get?.(proposal.evidence.observationReceiptPath);
  if (!record?.raw || !record?.data) throw new Error(`${proposal.id} observation receipt is missing`);
  const digest = createHash('sha256').update(record.raw).digest('hex');
  if (digest !== proposal.evidence.observationReceiptSha256) throw new Error(`${proposal.id} observation receipt SHA-256 differs from the proposal`);
  return affiliateActivationObservationReceiptSchema.parse(record.data);
}

export function validateAffiliateActivationProposals({ document: inputDocument, affiliate, articles, evidenceRecords }) {
  const affiliateIssues = validateAffiliateModel(affiliate);
  if (affiliateIssues.length > 0) throw new Error(`affiliate registry is invalid: ${affiliateIssues.join('; ')}`);
  const document = affiliateActivationProposalSchema.parse(inputDocument);
  const articleBySlug = new Map(articles.map((article) => [article.slug ?? article.id, article]));
  const programById = new Map(affiliate.programs.map((program) => [program.id, program]));

  const proposals = document.proposals.map((proposal) => {
    const approvalBoundarySha256 = affiliateActivationApprovalBoundarySha256(proposal);
    const program = programById.get(proposal.programId);
    if (!program) throw new Error(`${proposal.id} references unknown program ${proposal.programId}`);
    if (program.account?.verificationStatus !== 'verified') throw new Error(`${proposal.id} requires verified account evidence`);
    if (program.account?.publicTrackingIdentity !== proposal.evidence.publicTrackingIdentity) throw new Error(`${proposal.id} tracking identity differs from the verified registry`);
    if (program.account?.publicStorefrontUrl !== proposal.evidence.publicStorefrontUrl) throw new Error(`${proposal.id} storefront differs from the verified registry`);
    if (program.account?.weeklyReportsEnabled !== true) throw new Error(`${proposal.id} requires the observed weekly report setting`);
    if (program.activationProductSelection?.mode !== 'explicit_products' || !program.activationProductSelection.eligibleProductIds.includes(proposal.evidence.productId)) throw new Error(`${proposal.id} product is outside the narrow activation allowlist`);

    let activationState;
    if (program.status === 'externally_verified' && program.enabled === false) {
      activationState = 'awaiting_founder_terms_acceptance';
      if (program.revision !== proposal.expectedProgramRevision) throw new Error(`${proposal.id} does not bind current program revision`);
      if (program.account?.termsAcceptedByFounder !== false || program.account?.termsAcceptedAt !== null) throw new Error(`${proposal.id} must remain pending while terms acceptance is unrecorded`);
      if (program.account?.activationProposalId != null || program.account?.activationProposalSha256 != null) throw new Error(`${proposal.id} disabled program cannot claim an activation proposal receipt`);
      if (program.requiredDisclosure !== null || program.allowedDomains.length > 0 || program.registeredSites.length > 0) throw new Error(`${proposal.id} cannot mutate activation fields before approval`);
    } else if (program.status === 'enabled' && program.enabled === true) {
      activationState = 'activation_recorded';
      if (program.revision !== proposal.expectedProgramRevision + 1) throw new Error(`${proposal.id} activated program revision is not the approved next revision`);
      if (!program.account?.termsAcceptedByFounder || !program.account?.termsAcceptedAt || !program.account?.acceptanceEvidenceReference) throw new Error(`${proposal.id} recorded activation requires founder terms evidence`);
      if (program.account.activationProposalId !== proposal.id || program.account.activationProposalSha256 !== approvalBoundarySha256) throw new Error(`${proposal.id} program activation is not bound to the approved proposal digest`);
      if (JSON.stringify(program.allowedDomains) !== JSON.stringify(proposal.activation.allowedDomains) || JSON.stringify(program.registeredSites) !== JSON.stringify([proposal.activation.registeredSite]) || program.trackingMethod !== proposal.activation.trackingMethod || program.trackingPathPrefix !== proposal.activation.trackingPathPrefix || JSON.stringify(program.trackingParameterKeys) !== JSON.stringify(proposal.activation.trackingParameterKeys) || program.requiredDisclosure !== proposal.activation.requiredDisclosure || program.account.reportingExportApproved !== proposal.activation.reportingExportApproved || program.priceFeedAuthorized !== proposal.activation.priceFeedAuthorized) throw new Error(`${proposal.id} enabled program differs from the approved activation boundary`);
    } else {
      throw new Error(`${proposal.id} requires either an externally verified disabled program or a digest-bound enabled program`);
    }

    const article = articleBySlug.get(proposal.evidence.articleSlug);
    if (!article) throw new Error(`${proposal.id} references unknown article ${proposal.evidence.articleSlug}`);
    const product = article.products?.find((entry) => entry.id === proposal.evidence.productId);
    if (!product) throw new Error(`${proposal.id} references unknown article product ${proposal.evidence.productId}`);
    if (!String(product.name).includes(proposal.evidence.productIsbn)) throw new Error(`${proposal.id} ISBN does not match the researched product name`);
    if (product.affiliate !== false) throw new Error(`${proposal.id} requires the source article to remain non-affiliate`);

    const paid = new URL(proposal.evidence.observedPaidUrl);
    const resolved = new URL(proposal.evidence.observedResolvedUrl);
    const storefront = new URL(proposal.evidence.publicStorefrontUrl);
    const ordinary = new URL(product.url);
    if (proposal.activation.allowedDomains[0] !== paid.hostname || resolved.hostname !== paid.hostname || storefront.hostname !== paid.hostname) throw new Error(`${proposal.id} observed URLs must remain on the allowed domain`);
    if (paid.search || paid.hash || paid.pathname !== `/a/${proposal.evidence.publicTrackingIdentity}/${proposal.evidence.productIsbn}`) throw new Error(`${proposal.id} paid path must bind only the tracking identity and ISBN`);
    if (resolved.hash || `${resolved.origin}${resolved.pathname}` !== `${ordinary.origin}${ordinary.pathname}`) throw new Error(`${proposal.id} resolved product path differs from the researched ordinary URL`);
    requireExactQuery(resolved, { ean: proposal.evidence.productIsbn, affiliate: proposal.evidence.publicTrackingIdentity });
    if (proposal.activation.requiredDisclosure !== 'Disclosure: We may earn a commission if you purchase through a paid link on this page. Recommendations are selected independently.') throw new Error(`${proposal.id} disclosure differs from the approved activation proposal language`);
    if (proposal.evidence.termsSourceUrl !== EXACT_TERMS_SOURCE_URL || proposal.evidence.termsSourceUrl !== program.termsUrl) throw new Error(`${proposal.id} terms source URL differs from the registry`);
    if (proposal.evidence.termsResolvedUrl !== EXACT_TERMS_RESOLVED_URL) throw new Error(`${proposal.id} resolved terms URL differs from the reviewed canonical document`);
    if (proposal.evidence.programExplanationUrl !== EXACT_PROGRAM_EXPLANATION_URL || proposal.evidence.linkGuideUrl !== EXACT_LINK_GUIDE_URL || proposal.evidence.disclosureGuideUrl !== EXACT_DISCLOSURE_GUIDE_URL) throw new Error(`${proposal.id} official support evidence URL differs from the reviewed source`);
    if (proposal.evidence.termsLastUpdated !== '2025-07-10') throw new Error(`${proposal.id} terms update date must match the reviewed source`);

    const observation = evidenceRecordFor(proposal, evidenceRecords);
    for (const [recordKey, proposalKey] of [['programId', 'programId'], ['publicTrackingIdentity', 'publicTrackingIdentity'], ['publicStorefrontUrl', 'publicStorefrontUrl'], ['articleSlug', 'articleSlug'], ['productId', 'productId'], ['productIsbn', 'productIsbn'], ['paidUrl', 'observedPaidUrl'], ['resolvedUrl', 'observedResolvedUrl'], ['purchaseActionLabel', 'purchaseActionLabel'], ['observerId', 'observerId'], ['observedAt', 'observedAt']]) {
      const expected = proposalKey === 'programId' ? proposal.programId : proposal.evidence[proposalKey];
      if (observation[recordKey] !== expected) throw new Error(`${proposal.id} observation receipt ${recordKey} differs from the proposal`);
    }
    const verificationObservedAt = Date.parse(program.account.verificationObservedAt ?? '');
    const observedAt = Date.parse(proposal.evidence.observedAt);
    if (!Number.isFinite(verificationObservedAt) || observedAt < verificationObservedAt || observedAt > Date.parse(document.updatedAt)) throw new Error(`${proposal.id} observation chronology is invalid`);

    return {
      ...proposal,
      activationState,
      approvalBoundarySha256
    };
  });

  return { ...document, proposals };
}
