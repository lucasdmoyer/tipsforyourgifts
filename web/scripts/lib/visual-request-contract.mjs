import crypto from 'node:crypto';
import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const runIdSchema = z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const requestedAssetSchema = z.object({
  assetId: slugSchema,
  role: z.enum(['hero', 'pair_scene']),
  pairId: slugSchema.nullable(),
  productIds: z.array(slugSchema).min(1),
  sceneDescription: z.string().min(80).max(1200),
  alt: z.string().min(40).max(240),
  caption: z.string().min(30).max(280),
  promptSummary: z.string().min(40).max(600)
}).strict().superRefine((asset, context) => {
  if (asset.role === 'hero' && asset.pairId !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['pairId'], message: 'hero assets cannot bind a pair' });
  }
  if (asset.role === 'pair_scene' && asset.pairId === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['pairId'], message: 'pair scenes must bind one pair' });
  }
  if (/^image (of|showing)/i.test(asset.alt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['alt'], message: 'alt text must describe purpose, not start with image of/showing' });
  }
});

export const visualRequestSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  requestId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}-visuals$/),
  status: z.literal('requested'),
  runId: runIdSchema,
  articleSlug: slugSchema,
  createdAt: z.string().datetime(),
  createdBy: z.object({
    role: z.literal('research-editorial-team'),
    workflow: z.literal('research-agent.yml'),
    workflowRunId: z.string().regex(/^[1-9]\d*$/),
    workflowRunAttempt: z.number().int().positive()
  }).strict(),
  bindings: z.object({
    researchRunPath: z.string().regex(/^research\/runs\/\d{8}-[a-z0-9-]+-[a-f0-9]{8}\.json$/),
    researchRunSha256: sha256Schema,
    articlePath: z.string().regex(/^src\/data\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/),
    articleSha256: sha256Schema,
    productIds: z.array(slugSchema).min(1),
    pairIds: z.array(slugSchema)
  }).strict(),
  visualSystem: z.object({
    styleVersion: z.literal('gift-thread-editorial-cartoon-v1.0'),
    generator: z.literal('openai-built-in-imagegen'),
    rightsPosture: z.literal('founder-approved-original-ai-generated'),
    dimensions: z.object({ width: z.literal(1536), height: z.literal(1024) }).strict()
  }).strict(),
  assets: z.array(requestedAssetSchema).min(1).max(12),
  rightsBoundary: z.object({
    originalCompositionRequired: z.literal(true),
    forbidBrandLogos: z.literal(true),
    forbidBrandedPackaging: z.literal(true),
    forbidExactProductPhotoReplication: z.literal(true),
    forbidArtistImitation: z.literal(true),
    implyFirstHandUse: z.literal(false)
  }).strict(),
  publicationBoundary: z.object({
    articleMustRemainDraft: z.literal(true),
    publicAssetPathsAllowed: z.literal(false),
    independentVisualReviewRequired: z.literal(true),
    responsiveDerivativesRequired: z.array(z.enum(['480x320', '768x512', '1200x800'])).length(3)
  }).strict(),
  generation: z.object({
    attempted: z.literal(false),
    outputPaths: z.array(z.string()).length(0)
  }).strict(),
  nextGate: z.string().min(40)
}).strict().superRefine((request, context) => {
  if (request.requestId !== `${request.runId}-visuals`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['requestId'], message: 'must bind the research run ID' });
  }
  if (request.bindings.researchRunPath !== `research/runs/${request.runId}.json`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['bindings', 'researchRunPath'], message: 'must bind the research run path' });
  }
  if (request.bindings.articlePath !== `src/data/blog/${request.articleSlug}.md`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['bindings', 'articlePath'], message: 'must bind the article path' });
  }
  const heroCount = request.assets.filter((asset) => asset.role === 'hero').length;
  if (heroCount !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['assets'], message: 'must contain exactly one hero brief' });
  }
  const derivativeSet = new Set(request.publicationBoundary.responsiveDerivativesRequired);
  if (derivativeSet.size !== 3 || !['480x320', '768x512', '1200x800'].every((value) => derivativeSet.has(value))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['publicationBoundary', 'responsiveDerivativesRequired'], message: 'must require the canonical responsive derivative set' });
  }
});

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameSet(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

export function validateVisualRequestRecords({ records, articlesBySlug, runsById, visualArticleSlugs = new Set() }) {
  const issues = [];
  const requests = [];
  const requestIds = new Set();
  const requestedArticles = new Set();
  const requestedRuns = new Set();

  for (const record of records) {
    const parsed = visualRequestSchema.safeParse(record.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) issues.push(`${record.filename} ${issue.path.join('.')}: ${issue.message}`);
      continue;
    }
    const request = parsed.data;
    requests.push(request);
    if (record.filename !== `${request.requestId}.json`) issues.push(`${request.requestId}: filename must match requestId`);
    if (requestIds.has(request.requestId)) issues.push(`${request.requestId}: duplicate request ID`);
    if (requestedArticles.has(request.articleSlug)) issues.push(`${request.articleSlug}: more than one pending visual request`);
    if (requestedRuns.has(request.runId)) issues.push(`${request.runId}: more than one pending visual request`);
    requestIds.add(request.requestId);
    requestedArticles.add(request.articleSlug);
    requestedRuns.add(request.runId);

    const runRecord = runsById.get(request.runId);
    const articleRecord = articlesBySlug.get(request.articleSlug);
    if (!runRecord) issues.push(`${request.requestId}: bound research run is missing`);
    if (!articleRecord) issues.push(`${request.requestId}: bound article is missing`);
    if (visualArticleSlugs.has(request.articleSlug)) issues.push(`${request.requestId}: pending request cannot coexist with an approved visual mapping`);
    if (!runRecord || !articleRecord) continue;

    if (!['drafted', 'qa_failed'].includes(runRecord.data.status)) issues.push(`${request.requestId}: research run must remain drafted or qa_failed`);
    if (runRecord.data.article?.slug !== request.articleSlug || runRecord.data.article?.status !== 'draft') issues.push(`${request.requestId}: research run must bind the same draft article`);
    if (articleRecord.data.status !== 'draft') issues.push(`${request.requestId}: article must remain draft while visuals are pending`);
    if (articleRecord.data.researchRun !== request.runId) issues.push(`${request.requestId}: article researchRun differs from the visual request`);
    if (sha256(runRecord.raw) !== request.bindings.researchRunSha256) issues.push(`${request.requestId}: research run digest is stale`);
    if (sha256(articleRecord.raw) !== request.bindings.articleSha256) issues.push(`${request.requestId}: article digest is stale`);

    const productIds = (articleRecord.data.products ?? []).map((product) => product.id);
    const pairIds = (articleRecord.data.pairs ?? []).map((pair) => pair.id);
    if (!sameSet(request.bindings.productIds, productIds)) issues.push(`${request.requestId}: product scope differs from the article`);
    if (!sameSet(request.bindings.pairIds, pairIds)) issues.push(`${request.requestId}: pair scope differs from the article`);

    const assetIds = new Set();
    const representedProducts = new Set();
    const representedPairs = new Set();
    for (const asset of request.assets) {
      if (assetIds.has(asset.assetId)) issues.push(`${request.requestId}: duplicate requested asset ${asset.assetId}`);
      assetIds.add(asset.assetId);
      for (const productId of asset.productIds) {
        if (!productIds.includes(productId)) issues.push(`${request.requestId}: asset ${asset.assetId} references unknown product ${productId}`);
        representedProducts.add(productId);
      }
      if (asset.pairId !== null) {
        if (!pairIds.includes(asset.pairId)) issues.push(`${request.requestId}: asset ${asset.assetId} references unknown pair ${asset.pairId}`);
        if (representedPairs.has(asset.pairId)) issues.push(`${request.requestId}: pair ${asset.pairId} has more than one requested scene`);
        representedPairs.add(asset.pairId);
      }
    }
    for (const productId of productIds) if (!representedProducts.has(productId)) issues.push(`${request.requestId}: product ${productId} is absent from every visual brief`);
    for (const pairId of pairIds) if (!representedPairs.has(pairId)) issues.push(`${request.requestId}: pair ${pairId} needs one pair-scene brief`);
  }

  for (const [slug, articleRecord] of articlesBySlug) {
    if (visualArticleSlugs.has(slug)) continue;
    if (articleRecord.data.status === 'publication_ready') issues.push(`${slug}: publication-ready article has no approved visual mapping`);
    else if (articleRecord.data.status === 'draft' && !requestedArticles.has(slug)) issues.push(`${slug}: draft without approved visuals needs one pending visual request`);
  }

  return { issues, requests };
}
