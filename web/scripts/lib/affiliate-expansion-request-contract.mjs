import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import matter from './front-matter.mjs';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === 'https:', 'must use HTTPS');

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

export const affiliateExpansionRequestSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  updatedAt: z.string().datetime(),
  requests: z.array(z.object({
    id: slug,
    status: z.literal('awaiting_founder_scope_approval_and_partner_export'),
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
    currentActivationProductIds: z.array(slug).min(1),
    requestedProductIds: z.array(slug).min(1),
    products: z.array(productSchema).min(1),
    requiredGates: z.array(z.enum([
      'founder_expansion_scope_approval',
      'founder_attested_partner_export_with_exact_paid_urls',
      'exact_candidate_import',
      'fresh_independent_article_and_destination_review',
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
    }).strict()
  }).strict()).min(1)
}).strict();

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
    if (program.revision !== request.expectedProgramRevision || request.proposedProgramRevision !== program.revision + 1) throw new Error(`${request.id} program revision boundary is stale`);
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
    if ((review.articleSha256 === articleDigest) !== request.independentReview.currentArticleMatchesReceipt) throw new Error(`${request.id} independent review freshness assertion differs`);

    const currentActivation = program.activationProductSelection?.eligibleProductIds ?? [];
    if (JSON.stringify(currentActivation) !== JSON.stringify(request.currentActivationProductIds)) throw new Error(`${request.id} current activation scope changed`);
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
    }

    summaries.push({
      id: request.id,
      status: request.status,
      programId: request.programId,
      articleSlug: request.articleSlug,
      requestedProducts: request.products.length,
      paidUrlsCollected: 0,
      currentArticleMatchesIndependentReview: request.independentReview.currentArticleMatchesReceipt,
      nextGate: 'Lucas approves this exact nine-book scope, then supplies a founder-attested Bookshop export containing partner-issued URLs.'
    });
  }
  return { document, summaries };
}
