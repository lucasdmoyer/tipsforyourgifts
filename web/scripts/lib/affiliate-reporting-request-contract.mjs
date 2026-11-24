import { createHash } from 'node:crypto';
import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const officialSupportUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'support.bookshop.org' && !url.search && !url.hash;
}, 'must be a clean official Bookshop support URL');

export const affiliateReportingRequestSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  updatedAt: z.string().datetime(),
  requests: z.array(z.object({
    id: slug,
    status: z.literal('queued_behind_existing_program_revision'),
    programId: slug,
    observedProgramRevision: z.number().int().positive(),
    blockedByExpansionRequestId: slug,
    reservedExpansionRevision: z.number().int().positive(),
    earliestReportingRevision: z.number().int().positive(),
    liveScope: z.object({
      articleSlugs: z.array(slug).min(1),
      productIds: z.array(slug).min(1),
      candidateIds: z.array(slug).min(1)
    }).strict(),
    reporting: z.object({
      reportType: z.literal('commission_report'),
      attributionDateBasis: z.literal('date_sold'),
      minimumWindowDays: z.number().int().min(7),
      commissionStates: z.tuple([
        z.literal('pending'),
        z.literal('payable'),
        z.literal('paid'),
        z.literal('canceled')
      ]),
      inputMode: z.literal('founder_sanitized_aggregate'),
      allowedMetrics: z.tuple([z.literal('affiliateConversions'), z.literal('revenueUsd')])
    }).strict(),
    privacy: z.object({
      includeCustomerData: z.literal(false),
      exportCustomerList: z.literal(false),
      storeRawReportRows: z.literal(false),
      storeOrderIdentifiers: z.literal(false),
      storeEmailAddresses: z.literal(false)
    }).strict(),
    officialSources: z.object({
      dashboardGuideUrl: officialSupportUrl,
      reportingGuideUrl: officialSupportUrl,
      viewsRemovalUrl: officialSupportUrl
    }).strict(),
    requiredGates: z.tuple([
      z.literal('founder_revision_sequence_decision'),
      z.literal('separate_founder_reporting_export_approval'),
      z.literal('founder_generated_sanitized_aggregate'),
      z.literal('independent_aggregate_review'),
      z.literal('exact_snapshot_import')
    ]),
    assertions: z.object({
      reportingExportApproved: z.literal(false),
      externalReportGenerated: z.literal(false),
      connectorActivated: z.literal(false),
      customerDataAuthorized: z.literal(false),
      programRevisionChanged: z.literal(false),
      productionDeploymentAuthorized: z.literal(false)
    }).strict()
  }).strict()).min(1)
}).strict();

export function affiliateReportingRequestBoundarySha256(request) {
  return createHash('sha256').update(`${JSON.stringify(request, null, 2)}\n`).digest('hex');
}

function sameSet(left, right) {
  return new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.length === right.length
    && left.every((value) => right.includes(value));
}

export function validateAffiliateReportingRequests({ document: input, affiliate, expansionDocument, linkState }) {
  const document = affiliateReportingRequestSchema.parse(input);
  const programs = new Map(affiliate.programs.map((program) => [program.id, program]));
  const expansions = new Map(expansionDocument.requests.map((request) => [request.id, request]));
  const summaries = [];
  const requestIds = new Set();

  for (const request of document.requests) {
    if (requestIds.has(request.id)) throw new Error(`${request.id} is duplicated`);
    requestIds.add(request.id);
    const program = programs.get(request.programId);
    if (!program?.enabled || program.status !== 'enabled') throw new Error(`${request.id} requires an enabled affiliate program`);
    if (program.revision !== request.observedProgramRevision) throw new Error(`${request.id} observed program revision is stale`);
    if (program.account?.reportingExportApproved !== false) throw new Error(`${request.id} requires reporting export to remain unapproved`);
    if (program.account?.weeklyReportsEnabled !== true) throw new Error(`${request.id} requires observed weekly reports`);

    const expansion = expansions.get(request.blockedByExpansionRequestId);
    if (!expansion || expansion.programId !== request.programId) throw new Error(`${request.id} expansion dependency is missing or belongs to another program`);
    if (expansion.expectedProgramRevision !== request.observedProgramRevision || expansion.proposedProgramRevision !== request.reservedExpansionRevision) throw new Error(`${request.id} expansion revision reservation differs`);
    if (request.earliestReportingRevision !== request.reservedExpansionRevision + 1) throw new Error(`${request.id} earliest reporting revision must follow the reserved expansion revision`);

    const liveOverlays = [...linkState.overlays.values()].filter((overlay) => overlay.programId === request.programId);
    if (!sameSet(request.liveScope.articleSlugs, [...new Set(liveOverlays.map((overlay) => overlay.articleSlug))])) throw new Error(`${request.id} article scope differs from approved live overlays`);
    if (!sameSet(request.liveScope.productIds, [...new Set(liveOverlays.map((overlay) => overlay.productId))])) throw new Error(`${request.id} product scope differs from approved live overlays`);
    if (!sameSet(request.liveScope.candidateIds, liveOverlays.map((overlay) => overlay.candidateId))) throw new Error(`${request.id} candidate scope differs from approved live overlays`);

    summaries.push({
      id: request.id,
      status: request.status,
      programId: request.programId,
      observedProgramRevision: request.observedProgramRevision,
      reservedExpansionRevision: request.reservedExpansionRevision,
      earliestReportingRevision: request.earliestReportingRevision,
      blockedByExpansionRequestId: request.blockedByExpansionRequestId,
      liveArticles: request.liveScope.articleSlugs.length,
      livePaidLinks: request.liveScope.candidateIds.length,
      allowedMetrics: request.reporting.allowedMetrics,
      minimumWindowDays: request.reporting.minimumWindowDays,
      customerDataAllowed: false,
      requestBoundarySha256: affiliateReportingRequestBoundarySha256(request),
      officialSources: request.officialSources,
      nextGate: 'Lucas chooses whether affiliate expansion remains revision 6 or aggregate reporting is explicitly re-sequenced ahead of it; either path still requires a separate reporting-export approval.'
    });
  }

  return { document, summaries };
}
