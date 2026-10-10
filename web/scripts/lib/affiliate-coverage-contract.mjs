import { z } from 'zod';
import { programSelectsProduct } from './affiliate-contract.mjs';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const httpsUrl = z.string().url().refine((value) => value.startsWith('https://'), 'must use HTTPS');

const programCoverageSchema = z.object({
  programId: slug,
  programRevision: z.number().int().positive(),
  priority: z.number().int().positive(),
  status: z.enum(['proposed', 'founder_approved', 'enabled', 'paused', 'rejected']),
  selectionMode: z.enum(['explicit_products', 'all_products_in_eligible_articles', 'all_publication_ready_products']),
  eligibleArticleCount: z.number().int().nonnegative(),
  productResearchCandidates: z.number().int().nonnegative(),
  verifiedPaidLinks: z.number().int().nonnegative()
}).strict();

const productCoverageSchema = z.object({
  articleSlug: slug,
  productId: slug,
  productName: z.string().min(3),
  ordinaryUrl: httpsUrl,
  ordinaryHostname: z.string().min(3),
  candidateProgramIds: z.array(slug),
  preferredResearchProgramId: slug.nullable(),
  verifiedPaidProgramId: slug.nullable(),
  status: z.enum(['research_gap', 'ordinary_link_research_assigned', 'verified_paid_link'])
}).strict();

export const affiliateCoverageSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  registrySha256: sha256,
  registryUpdatedAt: z.string().datetime(),
  definition: z.literal('Program assignments are research queues only. They do not assert exact-product availability, account acceptance, tracking validity, or commission eligibility.'),
  counts: z.object({
    publicationReadyProductLinksCataloged: z.number().int().nonnegative(),
    productsAssignedToPartnerResearch: z.number().int().nonnegative(),
    productsWithoutPartnerResearch: z.number().int().nonnegative(),
    productsWithVerifiedPaidDestination: z.number().int().nonnegative()
  }).strict(),
  programs: z.array(programCoverageSchema),
  products: z.array(productCoverageSchema)
}).strict().superRefine((coverage, context) => {
  const programIds = coverage.programs.map((program) => program.programId);
  const programPriorities = coverage.programs.map((program) => program.priority);
  if (new Set(programIds).size !== programIds.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs'], message: 'program coverage IDs must be unique' });
  if (new Set(programPriorities).size !== programPriorities.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs'], message: 'program coverage priorities must be unique' });
  for (const [index, program] of coverage.programs.entries()) {
    if (program.priority !== index + 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'priority'], message: 'program coverage must be contiguous and sorted by priority' });
  }
  const programsById = new Map(coverage.programs.map((program) => [program.programId, program]));
  const productKeys = coverage.products.map((product) => `${product.articleSlug}:${product.productId}`);
  if (new Set(productKeys).size !== productKeys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['products'], message: 'product coverage keys must be unique' });
  const assigned = coverage.products.filter((product) => product.candidateProgramIds.length > 0).length;
  const gaps = coverage.products.length - assigned;
  const paid = coverage.products.filter((product) => product.verifiedPaidProgramId !== null).length;
  if (coverage.counts.publicationReadyProductLinksCataloged !== coverage.products.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['counts', 'publicationReadyProductLinksCataloged'], message: 'cataloged count must match products' });
  if (coverage.counts.productsAssignedToPartnerResearch !== assigned) context.addIssue({ code: z.ZodIssueCode.custom, path: ['counts', 'productsAssignedToPartnerResearch'], message: 'assigned count must match products' });
  if (coverage.counts.productsWithoutPartnerResearch !== gaps) context.addIssue({ code: z.ZodIssueCode.custom, path: ['counts', 'productsWithoutPartnerResearch'], message: 'gap count must match products' });
  if (coverage.counts.productsWithVerifiedPaidDestination !== paid) context.addIssue({ code: z.ZodIssueCode.custom, path: ['counts', 'productsWithVerifiedPaidDestination'], message: 'paid count must match products' });
  for (const [index, product] of coverage.products.entries()) {
    if (new Set(product.candidateProgramIds).size !== product.candidateProgramIds.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['products', index, 'candidateProgramIds'], message: 'candidate program IDs must be unique' });
    for (const candidateProgramId of product.candidateProgramIds) {
      if (!programsById.has(candidateProgramId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['products', index, 'candidateProgramIds'], message: `unknown candidate program ${candidateProgramId}` });
    }
    const expectedCandidateOrder = [...product.candidateProgramIds].sort((left, right) => (programsById.get(left)?.priority ?? Number.MAX_SAFE_INTEGER) - (programsById.get(right)?.priority ?? Number.MAX_SAFE_INTEGER));
    if (expectedCandidateOrder.some((programId, candidateIndex) => programId !== product.candidateProgramIds[candidateIndex])) context.addIssue({ code: z.ZodIssueCode.custom, path: ['products', index, 'candidateProgramIds'], message: 'candidate programs must follow registry priority' });
    if (product.verifiedPaidProgramId !== null && !programsById.has(product.verifiedPaidProgramId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['products', index, 'verifiedPaidProgramId'], message: 'verified paid program must exist in program coverage' });
    if (product.verifiedPaidProgramId !== null && !product.candidateProgramIds.includes(product.verifiedPaidProgramId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['products', index, 'verifiedPaidProgramId'], message: 'verified paid program must be an eligible candidate for the product' });
    if (product.preferredResearchProgramId !== (product.candidateProgramIds[0] ?? null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['products', index, 'preferredResearchProgramId'], message: 'preferred program must be the first priority candidate' });
    const expectedStatus = product.verifiedPaidProgramId ? 'verified_paid_link' : product.candidateProgramIds.length > 0 ? 'ordinary_link_research_assigned' : 'research_gap';
    if (product.status !== expectedStatus) context.addIssue({ code: z.ZodIssueCode.custom, path: ['products', index, 'status'], message: 'product status does not match coverage evidence' });
  }
  for (const [index, program] of coverage.programs.entries()) {
    const expectedCandidates = coverage.products.filter((product) => product.candidateProgramIds.includes(program.programId)).length;
    const expectedPaid = coverage.products.filter((product) => product.verifiedPaidProgramId === program.programId).length;
    if (program.productResearchCandidates !== expectedCandidates) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'productResearchCandidates'], message: 'program research count must match product assignments' });
    if (program.verifiedPaidLinks !== expectedPaid) context.addIssue({ code: z.ZodIssueCode.custom, path: ['programs', index, 'verifiedPaidLinks'], message: 'program paid-link count must match product assignments' });
  }
});

export function buildAffiliateCoverage({ affiliate, registrySha256, articles, overlays }) {
  const sortedPrograms = [...affiliate.programs].sort((left, right) => left.priority - right.priority);
  const products = articles
    .filter((article) => article.status === 'publication_ready')
    .flatMap((article) => (article.products ?? []).map((product) => ({ articleSlug: article.slug, product })))
    .filter(({ product }) => typeof product.url === 'string' && product.url.startsWith('https://'))
    .sort((left, right) => left.articleSlug.localeCompare(right.articleSlug) || left.product.id.localeCompare(right.product.id))
    .map(({ articleSlug, product }) => {
      const candidates = sortedPrograms.filter((program) => !['paused', 'rejected'].includes(program.status) && programSelectsProduct(program, articleSlug, product.id));
      const overlay = overlays.get(`${articleSlug}:${product.id}`) ?? null;
      if (overlay && !candidates.some((program) => program.id === overlay.programId)) {
        throw new Error(`${articleSlug}:${product.id}: approved overlay program is outside configured product selection`);
      }
      const candidateProgramIds = candidates.map((program) => program.id);
      return {
        articleSlug,
        productId: product.id,
        productName: product.name,
        ordinaryUrl: product.url,
        ordinaryHostname: new URL(product.url).hostname.toLowerCase(),
        candidateProgramIds,
        preferredResearchProgramId: candidateProgramIds[0] ?? null,
        verifiedPaidProgramId: overlay?.programId ?? null,
        status: overlay ? 'verified_paid_link' : candidateProgramIds.length > 0 ? 'ordinary_link_research_assigned' : 'research_gap'
      };
    });
  const programCoverage = sortedPrograms.map((program) => {
    const selectedProducts = products.filter((product) => product.candidateProgramIds.includes(program.id));
    return {
      programId: program.id,
      programRevision: program.revision,
      priority: program.priority,
      status: program.status,
      selectionMode: program.productSelection.mode,
      eligibleArticleCount: new Set(selectedProducts.map((product) => product.articleSlug)).size,
      productResearchCandidates: selectedProducts.length,
      verifiedPaidLinks: products.filter((product) => product.verifiedPaidProgramId === program.id).length
    };
  });
  const assigned = products.filter((product) => product.candidateProgramIds.length > 0).length;
  const paid = products.filter((product) => product.verifiedPaidProgramId !== null).length;
  return affiliateCoverageSchema.parse({
    schemaVersion: '1.0.0',
    registrySha256,
    registryUpdatedAt: affiliate.updatedAt,
    definition: 'Program assignments are research queues only. They do not assert exact-product availability, account acceptance, tracking validity, or commission eligibility.',
    counts: {
      publicationReadyProductLinksCataloged: products.length,
      productsAssignedToPartnerResearch: assigned,
      productsWithoutPartnerResearch: products.length - assigned,
      productsWithVerifiedPaidDestination: paid
    },
    programs: programCoverage,
    products
  });
}
