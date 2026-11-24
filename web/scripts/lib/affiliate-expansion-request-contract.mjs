import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import matter from './front-matter.mjs';
import { reviewedArticleSha256 } from './editorial-review-receipt-contract.mjs';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === 'https:', 'must use HTTPS');
const safeIdentity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/);
const repository = 'lucasdmoyer/tipsforyourgifts';

export const affiliateExpansionApprovalAuthorityLines = Object.freeze([
  'I reviewed the exact nine-edition scope, ISBNs, program revisions, and approval-boundary digest shown in this packet.',
  'I authorize the protected workflow to record only this exact activation allowlist in a review pull request.',
  'This does not authorize a partner export, paid URL, account or terms change, editorial reranking, merge, Firebase preview, or production deployment.'
]);

function isbn13IsValid(value) {
  const digits = [...value].map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

const productSchema = z.object({
  productId: slug,
  productName: z.string().min(8),
  isbn13: z.string().regex(/^97[89]\d{10}$/).refine(isbn13IsValid, 'invalid ISBN-13 check digit'),
  ordinaryEditorialUrl: httpsUrl,
  officialEditionEvidenceUrl: httpsUrl,
  cleanBookshopCatalogUrl: httpsUrl.nullable()
}).strict();

const catalogObservationSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  receiptId: slug,
  observerId: safeIdentity,
  observationMethod: z.literal('independent_browser_observation'),
  observedAt: z.string().datetime(),
  programId: slug,
  articleSlug: slug,
  records: z.array(z.object({
    productId: slug,
    isbn13: z.string().regex(/^97[89]\d{10}$/).refine(isbn13IsValid, 'invalid ISBN-13 check digit'),
    catalogUrl: httpsUrl,
    pageRendered: z.literal(true),
    isbnObserved: z.literal(true)
  }).strict()).min(1),
  assertions: z.object({
    cleanCatalogUrlsOnly: z.literal(true),
    trackingIdentityUsed: z.literal(false),
    paidUrlsGenerated: z.literal(false),
    availabilityAssessed: z.literal(false),
    activationScopeChanged: z.literal(false),
    productionDeploymentAuthorized: z.literal(false)
  }).strict()
}).strict();

export const affiliateExpansionRequestSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  updatedAt: z.string().datetime(),
  requests: z.array(z.object({
    id: slug,
    status: z.enum(['awaiting_founder_scope_approval_and_partner_export', 'scope_approved_awaiting_partner_export']),
    programId: slug,
    expectedProgramRevision: z.number().int().positive(),
    proposedProgramRevision: z.number().int().positive(),
    articleSlug: slug,
    articleSha256: sha256,
    researchRun: z.object({ id: slug, path: z.string(), sha256 }).strict(),
    independentReview: z.object({
      path: z.string(),
      sha256,
      recordedArticleSha256: sha256,
      currentArticleMatchesReceipt: z.boolean(),
      nextGate: z.string().min(30)
    }).strict(),
    catalogObservation: z.object({
      path: z.string().regex(/^affiliate\/evidence\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/),
      sha256,
      observedAt: z.string().datetime(),
      recordCount: z.number().int().positive()
    }).strict(),
    currentActivationProductIds: z.array(slug).min(1),
    requestedProductIds: z.array(slug).min(1),
    products: z.array(productSchema).min(1),
    requiredGates: z.array(z.enum([
      'founder_expansion_scope_approval',
      'founder_attested_partner_export_with_exact_paid_urls',
      'exact_candidate_import',
      'independent_destination_and_tracking_review',
      'separate_founder_link_approval',
      'exact_commit_firebase_preview'
    ])).length(6),
    assertions: z.object({
      paidUrlsCollected: z.literal(false),
      trackingParametersInvented: z.literal(false),
      activationScopeChanged: z.literal(false),
      affiliateCandidatesCreated: z.literal(false),
      editorialRankingChanged: z.literal(false),
      productionDeploymentAuthorized: z.literal(false)
    }).strict(),
    scopeApproval: z.object({
      approvedBy: safeIdentity,
      approvedAt: z.string().datetime(),
      evidenceUrl: httpsUrl,
      approvalBoundarySha256: sha256
    }).strict().nullable().optional()
  }).strict()).min(1)
}).strict();

export function affiliateExpansionApprovalBoundarySha256(request) {
  const { status: _status, scopeApproval: _scopeApproval, ...boundary } = request;
  return createHash('sha256').update(`${JSON.stringify(boundary, null, 2)}\n`).digest('hex');
}

function exactAffiliateExpansionDecision(request) {
  return {
    schemaVersion: '1.0.0',
    decision: 'approve_affiliate_expansion_scope',
    requestId: request.id,
    approvalBoundarySha256: affiliateExpansionApprovalBoundarySha256(request),
    programId: request.programId,
    expectedProgramRevision: request.expectedProgramRevision,
    proposedProgramRevision: request.proposedProgramRevision,
    articleSlug: request.articleSlug,
    requestedProductIds: request.requestedProductIds
  };
}

export function parseAffiliateExpansionExactApproval(body) {
  const blocks = [];
  const pattern = /(?:^|\n)## Exact approval\s*\n```json\s*\n([\s\S]*?)\n```/g;
  for (const match of String(body ?? '').replaceAll('\r\n', '\n').matchAll(pattern)) blocks.push(match[1]);
  if (blocks.length !== 1) throw new Error('Affiliate expansion request must contain exactly one Exact approval JSON block');
  let decision;
  try { decision = JSON.parse(blocks[0]); } catch { throw new Error('Affiliate expansion Exact approval block is not valid JSON'); }
  const expectedKeys = ['approvalBoundarySha256', 'articleSlug', 'decision', 'expectedProgramRevision', 'programId', 'proposedProgramRevision', 'requestId', 'requestedProductIds', 'schemaVersion'];
  if (!decision || Array.isArray(decision) || JSON.stringify(Object.keys(decision).sort()) !== JSON.stringify(expectedKeys)) {
    throw new Error('Affiliate expansion Exact approval contains unexpected fields');
  }
  if (decision.schemaVersion !== '1.0.0' || decision.decision !== 'approve_affiliate_expansion_scope') throw new Error('Affiliate expansion decision is unsupported');
  if (!slug.safeParse(decision.requestId).success || !slug.safeParse(decision.programId).success || !slug.safeParse(decision.articleSlug).success) throw new Error('Affiliate expansion approval identity is invalid');
  if (!sha256.safeParse(decision.approvalBoundarySha256).success) throw new Error('Affiliate expansion approval boundary SHA-256 is invalid');
  if (!Number.isInteger(decision.expectedProgramRevision) || !Number.isInteger(decision.proposedProgramRevision)) throw new Error('Affiliate expansion program revisions are invalid');
  if (!Array.isArray(decision.requestedProductIds) || decision.requestedProductIds.length < 1 || decision.requestedProductIds.some((id) => !slug.safeParse(id).success)) throw new Error('Affiliate expansion requested product IDs are invalid');
  return decision;
}

function assertAffiliateExpansionAuthority(body) {
  const normalized = String(body ?? '').replaceAll('\r\n', '\n').toLowerCase();
  for (const line of affiliateExpansionApprovalAuthorityLines) {
    if (!normalized.includes(`- [x] ${line}`.toLowerCase())) throw new Error(`Affiliate expansion authority check is missing: ${line}`);
  }
}

export function buildAffiliateExpansionApprovalIssueUrl(request) {
  if (request.status !== 'awaiting_founder_scope_approval_and_partner_export') throw new Error('Affiliate expansion approval packet requires a pending scope request');
  const decision = exactAffiliateExpansionDecision(request);
  const title = `[Approve Affiliate Expansion] ${request.id} ${decision.approvalBoundarySha256.slice(0, 12)}`;
  const body = [
    '# Approve one exact Bookshop activation scope',
    '',
    'Lucas, this packet expands the eligible Bookshop allowlist from one reviewed edition to ten. It does not create paid links. Review every edition, check all three authority boxes, then submit. The protected workflow will independently verify the current repository state and may open a review pull request only.',
    '',
    '## Scope',
    '',
    `- **Request:** ${request.id}`,
    `- **Program:** ${request.programId}, revision ${request.expectedProgramRevision} to ${request.proposedProgramRevision}`,
    `- **Article:** ${request.articleSlug}`,
    `- **Existing active product:** ${request.currentActivationProductIds.join(', ')}`,
    `- **New editions:** ${request.products.length}`,
    `- **Approval boundary SHA-256:** ${decision.approvalBoundarySha256}`,
    '',
    '## Exact editions',
    '',
    ...request.products.map((product, index) => `${index + 1}. **${product.productName}** — ISBN ${product.isbn13} — [clean Bookshop catalog page](${product.cleanBookshopCatalogUrl})`),
    '',
    '## Exact approval',
    '',
    '```json',
    JSON.stringify(decision, null, 2),
    '```',
    '',
    '## Authority boundary',
    '',
    ...affiliateExpansionApprovalAuthorityLines.map((line) => `- [ ] ${line}`),
    '',
    '> A founder-attested partner export, one immutable candidate per paid URL, independent destination and tracking review, separate founder approval for each link, and an exact-commit Firebase preview remain mandatory.'
  ].join('\n');
  const url = new URL(`https://github.com/${repository}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  if (url.toString().length > 12_000) throw new Error('Affiliate expansion approval issue exceeds the safe GitHub URL limit');
  return url.toString();
}

export function resolveAffiliateExpansionApprovalIssue({ issue, request }) {
  if (issue?.user?.login !== 'lucasdmoyer' || issue?.author_association !== 'OWNER') throw new Error('Affiliate expansion approval must be submitted by repository owner lucasdmoyer');
  if (!new RegExp(`^https://github\\.com/${repository.replace('/', '\\/')}/issues/[1-9]\\d*$`).test(issue?.html_url ?? '')) throw new Error('Affiliate expansion approval URL is outside the canonical repository');
  if (request.status !== 'awaiting_founder_scope_approval_and_partner_export') throw new Error('Affiliate expansion request is not awaiting founder scope approval');
  const decision = parseAffiliateExpansionExactApproval(issue.body);
  const expected = exactAffiliateExpansionDecision(request);
  if (JSON.stringify(decision) !== JSON.stringify(expected)) throw new Error('Affiliate expansion approval does not match the current exact request');
  const expectedTitle = `[Approve Affiliate Expansion] ${request.id} ${expected.approvalBoundarySha256.slice(0, 12)}`;
  if (issue.title !== expectedTitle) throw new Error(`Affiliate expansion approval title must be exactly ${expectedTitle}`);
  assertAffiliateExpansionAuthority(issue.body);
  return {
    requestId: request.id,
    expectedApprovalBoundarySha256: expected.approvalBoundarySha256,
    confirmation: `APPROVE-${request.id}-${expected.approvalBoundarySha256}`,
    source: 'owner_issue',
    issueUrl: issue.html_url
  };
}

async function readBoundJson(root, reference) {
  const raw = await fs.readFile(path.join(root, reference.path));
  const digest = createHash('sha256').update(raw).digest('hex');
  if (digest !== reference.sha256) throw new Error(`${reference.path} SHA-256 differs from expansion request`);
  return JSON.parse(raw.toString('utf8'));
}

export async function validateAffiliateExpansionRequests({ root, document: input, affiliate }) {
  const document = affiliateExpansionRequestSchema.parse(input);
  const programById = new Map(affiliate.programs.map((program) => [program.id, program]));
  const summaries = [];

  for (const request of document.requests) {
    const program = programById.get(request.programId);
    if (!program?.enabled || program.status !== 'enabled') throw new Error(`${request.id} requires an enabled program`);
    const scopePending = request.status === 'awaiting_founder_scope_approval_and_partner_export';
    if (request.proposedProgramRevision !== request.expectedProgramRevision + 1) throw new Error(`${request.id} proposed program revision is not the next revision`);
    if (scopePending && program.revision !== request.expectedProgramRevision) throw new Error(`${request.id} pending program revision boundary is stale`);
    if (!scopePending && program.revision !== request.proposedProgramRevision) throw new Error(`${request.id} approved program revision boundary is stale`);
    if (program.sourceReviewExpiresAt < document.updatedAt.slice(0, 10)) throw new Error(`${request.id} program source review is expired`);

    const articlePath = path.join(root, 'src', 'data', 'blog', `${request.articleSlug}.md`);
    const articleRaw = await fs.readFile(articlePath);
    const articleDigest = createHash('sha256').update(articleRaw).digest('hex');
    if (articleDigest !== request.articleSha256) throw new Error(`${request.id} article SHA-256 differs from expansion request`);
    const article = matter(articleRaw.toString('utf8')).data;
    if (article.status !== 'publication_ready') throw new Error(`${request.id} article is not publication-ready`);
    const articleProducts = new Map(article.products.map((product) => [product.id, product]));

    const run = await readBoundJson(root, request.researchRun);
    if (run.runId !== request.researchRun.id || run.article?.slug !== request.articleSlug) throw new Error(`${request.id} research run identity differs`);
    const review = await readBoundJson(root, request.independentReview);
    if (review.articleSha256 !== request.independentReview.recordedArticleSha256) throw new Error(`${request.id} independent review article digest differs`);
    if ((review.articleSha256 === reviewedArticleSha256(articleRaw)) !== request.independentReview.currentArticleMatchesReceipt) throw new Error(`${request.id} independent review freshness assertion differs`);
    const catalogObservation = catalogObservationSchema.parse(await readBoundJson(root, request.catalogObservation));
    if (catalogObservation.programId !== request.programId || catalogObservation.articleSlug !== request.articleSlug) throw new Error(`${request.id} catalog observation identity differs`);
    if (catalogObservation.observedAt !== request.catalogObservation.observedAt || catalogObservation.records.length !== request.catalogObservation.recordCount) throw new Error(`${request.id} catalog observation summary differs`);
    if (catalogObservation.observedAt > document.updatedAt) throw new Error(`${request.id} catalog observation is newer than the request update`);
    const catalogByProductId = new Map(catalogObservation.records.map((record) => [record.productId, record]));

    const currentActivation = program.activationProductSelection?.eligibleProductIds ?? [];
    const requestedSet = new Set(request.requestedProductIds);
    if (requestedSet.size !== request.requestedProductIds.length || request.products.length !== requestedSet.size) throw new Error(`${request.id} requested products must be unique and complete`);
    if (request.currentActivationProductIds.some((id) => requestedSet.has(id))) throw new Error(`${request.id} requested products overlap the current activation scope`);
    const researchEligible = new Set(program.researchCandidateSelection?.eligibleProductIds ?? []);

    for (const product of request.products) {
      if (!requestedSet.has(product.productId) || !researchEligible.has(product.productId)) throw new Error(`${product.productId} is outside the requested or research-eligible scope`);
      const editorial = articleProducts.get(product.productId);
      if (!editorial || editorial.affiliate !== false) throw new Error(`${product.productId} must remain a non-affiliate editorial product`);
      for (const value of [product.ordinaryEditorialUrl, product.officialEditionEvidenceUrl, product.cleanBookshopCatalogUrl].filter(Boolean)) {
        const parsed = new URL(value);
        const forbidden = [...parsed.searchParams.keys()].some((key) => ['aid', 'affiliate', 'tag', 'ref'].includes(key.toLowerCase()));
        if (forbidden) throw new Error(`${product.productId} contains an affiliate or referral parameter`);
      }
      if (editorial.name !== product.productName || editorial.url !== product.ordinaryEditorialUrl) throw new Error(`${product.productId} editorial identity differs`);
      if (product.cleanBookshopCatalogUrl) {
        const catalog = new URL(product.cleanBookshopCatalogUrl);
        if (catalog.hostname !== 'bookshop.org' || catalog.search || catalog.hash || !catalog.pathname.startsWith('/p/books/')) throw new Error(`${product.productId} Bookshop catalog URL is not clean`);
      }
      const catalogEvidence = catalogByProductId.get(product.productId);
      if (!catalogEvidence || catalogEvidence.isbn13 !== product.isbn13 || catalogEvidence.catalogUrl !== product.cleanBookshopCatalogUrl) throw new Error(`${product.productId} catalog observation differs from the requested edition`);
    }
    if (catalogByProductId.size !== request.products.length) throw new Error(`${request.id} catalog observation product set is incomplete`);

    const approvalBoundarySha256 = affiliateExpansionApprovalBoundarySha256(request);
    if (scopePending) {
      if (request.scopeApproval != null) throw new Error(`${request.id} pending request cannot contain scope approval evidence`);
      if (JSON.stringify(currentActivation) !== JSON.stringify(request.currentActivationProductIds)) throw new Error(`${request.id} current activation scope changed before founder approval`);
    } else {
      if (!request.scopeApproval) throw new Error(`${request.id} approved request is missing scope approval evidence`);
      if (request.scopeApproval.approvalBoundarySha256 !== approvalBoundarySha256) throw new Error(`${request.id} scope approval boundary differs`);
      if (request.scopeApproval.approvedBy !== affiliate.policy.founderApproverLogin) throw new Error(`${request.id} scope approval actor differs from the configured founder`);
      if (request.scopeApproval.approvedAt !== document.updatedAt) throw new Error(`${request.id} scope approval timestamp differs from the document update`);
      const evidenceUrl = new URL(request.scopeApproval.evidenceUrl);
      if (evidenceUrl.hostname !== 'github.com' || evidenceUrl.search || evidenceUrl.hash || !evidenceUrl.pathname.startsWith('/lucasdmoyer/tipsforyourgifts/actions/runs/')) throw new Error(`${request.id} scope approval evidence URL is not an exact GitHub workflow run`);
      const expandedActivation = [...request.currentActivationProductIds, ...request.requestedProductIds];
      if (JSON.stringify(currentActivation) !== JSON.stringify(expandedActivation)) throw new Error(`${request.id} approved activation scope does not equal the exact requested union`);
    }

    summaries.push({
      id: request.id,
      status: request.status,
      programId: request.programId,
      expectedProgramRevision: request.expectedProgramRevision,
      proposedProgramRevision: request.proposedProgramRevision,
      articleSlug: request.articleSlug,
      requestedProducts: request.products.length,
      requestedProductIds: request.requestedProductIds,
      products: request.products.map((product) => ({ productId: product.productId, productName: product.productName, isbn13: product.isbn13 })),
      catalogProductsVerified: catalogObservation.records.length,
      paidUrlsCollected: 0,
      currentArticleMatchesIndependentReview: request.independentReview.currentArticleMatchesReceipt,
      approvalBoundarySha256,
      approvalIssueUrl: scopePending ? buildAffiliateExpansionApprovalIssueUrl(request) : null,
      nextGate: scopePending ? 'Lucas approves this exact nine-book scope, then supplies a founder-attested Bookshop export containing partner-issued URLs.' : 'Supply a founder-attested Bookshop export containing exact partner-issued URLs; every destination still requires independent review and separate founder approval.'
    });
  }
  return { document, summaries };
}
