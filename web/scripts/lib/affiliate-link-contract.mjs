import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from './front-matter.mjs';
import { z } from 'zod';
import { affiliateSchema, programSelectsProduct, validateAffiliateModel } from './affiliate-contract.mjs';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const httpsUrlSchema = z.string().url().refine((value) => value.startsWith('https://'), 'must use HTTPS');
const safeIdentitySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/);

export const affiliateLinkBatchInputSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  exportId: slugSchema,
  source: z.literal('founder_attested_partner_export'),
  exportedAt: z.string().datetime(),
  programId: slugSchema,
  expectedProgramRevision: z.number().int().positive(),
  records: z.array(z.object({
    articleSlug: slugSchema,
    productId: slugSchema,
    candidateRevision: z.number().int().positive(),
    expectedArticleSha256: sha256Schema,
    paidUrl: httpsUrlSchema,
    productIdentityEvidenceUrl: httpsUrlSchema
  }).strict()).min(1).max(250)
}).strict().superRefine((input, context) => {
  const productKeys = input.records.map((record) => `${record.articleSlug}:${record.productId}`);
  if (new Set(productKeys).size !== productKeys.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['records'], message: 'one batch cannot contain duplicate article-product keys' });
});

export const affiliateLinkBatchManifestSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  batchId: slugSchema,
  status: z.literal('imported'),
  programId: slugSchema,
  programRevision: z.number().int().positive(),
  importedAt: z.string().datetime(),
  importedBy: safeIdentitySchema,
  sourceArtifactPath: z.string().regex(/^affiliate\/source-artifacts\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/),
  sourceArtifactSha256: sha256Schema,
  candidateIds: z.array(slugSchema).min(1).max(250),
  candidateSha256: z.record(slugSchema, sha256Schema)
}).strict();

const sourceSchema = z.object({
  articlePath: z.string().regex(/^src\/data\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/),
  articleSha256: sha256Schema,
  researchRunPath: z.string().regex(/^research\/runs\/\d{8}-[a-z0-9-]+-[a-f0-9]{8}\.json$/),
  researchRunSha256: sha256Schema,
  independentReviewPath: z.string().regex(/^research\/reviews\/\d{8}-[a-z0-9-]+-[a-f0-9]{8}\.qa\.v1\.json$/),
  independentReviewSha256: sha256Schema,
  productEditorialSha256: sha256Schema,
  ordinaryUrl: httpsUrlSchema
}).strict();

export const affiliateLinkCandidateSchema = z.object({
  schemaVersion: z.literal('1.1.0'),
  candidateId: slugSchema,
  status: z.literal('candidate'),
  articleSlug: slugSchema,
  productId: slugSchema,
  programId: slugSchema,
  programRevision: z.number().int().positive(),
  candidateRevision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  createdBy: safeIdentitySchema,
  origin: z.object({
    source: z.enum(['founder_supplied', 'founder_attested_partner_export']),
    referenceId: slugSchema.nullable(),
    sourceArtifactPath: z.string().regex(/^affiliate\/source-artifacts\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/).nullable(),
    sourceSha256: sha256Schema.nullable()
  }).strict(),
  source: sourceSchema,
  destination: z.object({
    paidUrl: httpsUrlSchema,
    hostname: z.string().regex(/^[a-z0-9.-]+$/),
    trackingParameterKeys: z.array(z.string().regex(/^[A-Za-z0-9_-]+$/)).min(1),
    productIdentityEvidenceUrl: httpsUrlSchema
  }).strict(),
  assertions: z.object({
    editorialRankUnchanged: z.literal(true),
    productCopyUnchanged: z.literal(true),
    priceOrAvailabilityClaimAdded: z.literal(false)
  }).strict()
}).strict().superRefine((candidate, context) => {
  const attested = candidate.origin.source !== 'founder_supplied';
  if (attested && (!candidate.origin.referenceId || !candidate.origin.sourceArtifactPath || !candidate.origin.sourceSha256)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['origin'], message: 'founder-attested partner exports require a reference ID, source artifact path, and source SHA-256' });
  }
  if (!attested && (candidate.origin.referenceId !== null || candidate.origin.sourceArtifactPath !== null || candidate.origin.sourceSha256 !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['origin'], message: 'founder-supplied candidates cannot claim an automated source artifact' });
  }
});

const reviewCheckSchema = z.object({
  candidateHashBound: z.boolean(),
  programEnabledAtReview: z.boolean(),
  articleSourceBound: z.boolean(),
  productIdentityMatched: z.boolean(),
  destinationHttps: z.boolean(),
  finalDomainAllowed: z.boolean(),
  trackingKeysApproved: z.boolean(),
  trackingIdentityMatched: z.boolean(),
  trackingPreserved: z.boolean(),
  editorialRankingUntouched: z.boolean(),
  disclosureWillRender: z.boolean(),
  recommendationWorksWithoutPaidLink: z.boolean(),
  noPriceOrAvailabilityClaimAdded: z.boolean()
}).strict();

export const affiliateLinkReviewSchema = z.object({
  schemaVersion: z.literal('1.2.0'),
  reviewId: slugSchema,
  candidateId: slugSchema,
  candidatePath: z.string().regex(/^affiliate\/candidates\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/),
  candidateSha256: sha256Schema,
  reviewerId: safeIdentitySchema,
  reviewedAt: z.string().datetime(),
  verdict: z.enum(['passed', 'failed']),
  destination: z.object({
    httpStatus: z.number().int().min(100).max(599).nullable(),
    resolvedUrl: httpsUrlSchema.nullable(),
    resolvedHostname: z.string().regex(/^[a-z0-9.-]+$/).nullable(),
    verifiedAt: z.string().datetime().nullable()
  }).strict(),
  productIdentityEvidenceUrl: httpsUrlSchema,
  trackingIdentityEvidence: z.object({
    method: z.enum(['owner_gated_single_link_intake', 'founder_attested_partner_export']),
    referencePath: z.string().regex(/^affiliate\/(?:candidates|source-artifacts)\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/),
    sha256: sha256Schema
  }).strict(),
  checks: reviewCheckSchema,
  blockers: z.array(z.string().min(12)).max(20)
}).strict().superRefine((review, context) => {
  const checkValues = Object.values(review.checks);
  if (review.verdict === 'passed') {
    if (checkValues.some((value) => !value)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['checks'], message: 'passing review requires every check to pass' });
    if (review.blockers.length > 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ['blockers'], message: 'passing review cannot contain blockers' });
    if (review.destination.httpStatus === null || review.destination.resolvedUrl === null || review.destination.resolvedHostname === null || review.destination.verifiedAt === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['destination'], message: 'passing review requires live destination evidence' });
    }
  } else if (review.blockers.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['blockers'], message: 'failed review requires at least one blocker' });
  }
}).strict();

export const affiliateLinkApprovalSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  approvalId: slugSchema,
  candidateId: slugSchema,
  candidatePath: z.string().regex(/^affiliate\/candidates\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/),
  candidateSha256: sha256Schema,
  reviewPath: z.string().regex(/^affiliate\/reviews\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/),
  reviewSha256: sha256Schema,
  founderLogin: z.string().regex(/^[A-Za-z0-9-]+$/),
  approvedAt: z.string().datetime(),
  confirmation: z.string().min(12),
  status: z.literal('approved'),
  assertions: z.object({
    exactPaidDestinationApproved: z.literal(true),
    affiliateDisclosureRequired: z.literal(true),
    editorialRankingUnchanged: z.literal(true),
    firebasePreviewRequiredBeforeRelease: z.literal(true),
    productionDeploymentAuthorized: z.literal(false)
  }).strict()
}).strict();

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}

export function canonicalSha256(value) {
  return sha256(`${JSON.stringify(canonicalize(value))}\n`);
}

export function productEditorialSha256(product) {
  const editorial = structuredClone(product);
  delete editorial.url;
  delete editorial.affiliate;
  delete editorial.affiliateProgram;
  return canonicalSha256(editorial);
}

function assertSafePublicHttpsUrl(value, label) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${label} must be a valid URL`); }
  if (parsed.protocol !== 'https:') throw new Error(`${label} must use HTTPS`);
  if (parsed.username || parsed.password) throw new Error(`${label} cannot contain credentials`);
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname === '0.0.0.0' || hostname === '::1' || /^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^169\.254\./.test(hostname)) {
    throw new Error(`${label} must resolve through a public hostname`);
  }
  return parsed;
}

function trackingLike(key) {
  return /^(?:aff|affiliate|ascsubtag|campaign|camp|linkcode|ref(?:_|-)?|sid|source|subid|tag|tracking|utm_)/i.test(key);
}

function parameterKeys(url) {
  return [...new Set([...url.searchParams.keys()])].sort((left, right) => left.localeCompare(right));
}

function ensureTrackingPreserved(source, resolved, keys) {
  return keys.every((key) => {
    const expected = source.searchParams.getAll(key);
    const actual = resolved.searchParams.getAll(key);
    return expected.length > 0 && JSON.stringify(actual) === JSON.stringify(expected);
  });
}

async function readJsonRecords(root, relativeDirectory, schema) {
  const directory = path.join(root, relativeDirectory);
  let names = [];
  try { names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort(); } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return Promise.all(names.map(async (name) => {
    const raw = await fs.readFile(path.join(directory, name));
    const data = schema.parse(JSON.parse(raw.toString('utf8')));
    return { name, path: `${relativeDirectory}/${name}`, raw, sha256: sha256(raw), data };
  }));
}

async function loadRepositorySources(root) {
  const articleDirectory = path.join(root, 'src', 'data', 'blog');
  const articleNames = (await fs.readdir(articleDirectory)).filter((name) => name.endsWith('.md')).sort();
  const articles = new Map();
  for (const name of articleNames) {
    const raw = await fs.readFile(path.join(articleDirectory, name));
    const articleSlug = path.basename(name, '.md');
    articles.set(articleSlug, { name, raw, sha256: sha256(raw), data: matter(raw.toString('utf8')).data });
  }
  const runs = await readJsonRecords(root, 'research/runs', z.record(z.string(), z.unknown()));
  const reviews = await readJsonRecords(root, 'research/reviews', z.record(z.string(), z.unknown()));
  const affiliateSourceArtifacts = await readJsonRecords(root, 'affiliate/source-artifacts', affiliateLinkBatchInputSchema);
  return {
    articles,
    runsById: new Map(runs.map((record) => [record.data.runId, record])),
    reviewsByPath: new Map(reviews.map((record) => [record.path, record])),
    affiliateSourceArtifactsByPath: new Map(affiliateSourceArtifacts.map((record) => [record.path, record]))
  };
}

function validateCandidate(candidate, candidateRecord, programsById, sources, founderLogin) {
  const expectedId = `affiliate-link-${candidate.articleSlug}-${candidate.productId}-${candidate.programId}-v${candidate.candidateRevision}`;
  if (candidate.candidateId !== expectedId) throw new Error(`${candidate.candidateId}: candidate ID must be ${expectedId}`);
  if (candidateRecord.name !== `${candidate.candidateId}.json`) throw new Error(`${candidate.candidateId}: candidate filename must match candidate ID`);
  if (candidate.createdBy !== founderLogin) throw new Error(`${candidate.candidateId}: paid URL intake must identify the configured founder`);
  const program = programsById.get(candidate.programId);
  if (!program?.enabled || program.status !== 'enabled') throw new Error(`${candidate.candidateId}: affiliate program is not enabled`);
  if (program.revision !== candidate.programRevision) throw new Error(`${candidate.candidateId}: affiliate program revision changed`);
  const article = sources.articles.get(candidate.articleSlug);
  if (!article || article.data.status !== 'publication_ready') throw new Error(`${candidate.candidateId}: article is not publication ready`);
  if (candidate.source.articlePath !== `src/data/blog/${article.name}` || candidate.source.articleSha256 !== article.sha256) throw new Error(`${candidate.candidateId}: source article hash changed`);
  const run = sources.runsById.get(article.data.researchRun);
  if (!run || run.data.status !== 'validated') throw new Error(`${candidate.candidateId}: source research run is not validated`);
  if (run.data.article?.slug !== candidate.articleSlug || run.data.article?.status !== 'publication_ready' || !run.data.qa?.passed) throw new Error(`${candidate.candidateId}: source research run is not bound to the publication-ready article`);
  if (candidate.source.researchRunPath !== run.path || candidate.source.researchRunSha256 !== run.sha256) throw new Error(`${candidate.candidateId}: source research run hash changed`);
  const review = sources.reviewsByPath.get(run.data.qa?.receiptPath);
  if (!review || review.data.verdict !== 'passed' || review.data.blockers?.length > 0) throw new Error(`${candidate.candidateId}: source independent review is not a clean pass`);
  if (review.data.runId !== run.data.runId || review.data.articleSlug !== candidate.articleSlug || review.data.reviewerId === run.data.draftAuthor) throw new Error(`${candidate.candidateId}: source independent review separation or identity changed`);
  if (candidate.source.independentReviewPath !== review.path || candidate.source.independentReviewSha256 !== review.sha256) throw new Error(`${candidate.candidateId}: source independent review hash changed`);
  const product = (article.data.products ?? []).find((entry) => entry.id === candidate.productId);
  if (!product) throw new Error(`${candidate.candidateId}: source product no longer exists`);
  if (!programSelectsProduct(program, candidate.articleSlug, candidate.productId)) throw new Error(`${candidate.candidateId}: product is not eligible for this affiliate program`);
  if (product.affiliate) throw new Error(`${candidate.candidateId}: overlay candidates require an ordinary source link`);
  if (candidate.source.ordinaryUrl !== product.url) throw new Error(`${candidate.candidateId}: ordinary product URL changed`);
  if (candidate.source.productEditorialSha256 !== productEditorialSha256(product)) throw new Error(`${candidate.candidateId}: editorial product fields changed`);
  if (candidate.origin.source === 'founder_attested_partner_export') {
    const sourceArtifact = sources.affiliateSourceArtifactsByPath.get(candidate.origin.sourceArtifactPath);
    if (!sourceArtifact || sourceArtifact.sha256 !== candidate.origin.sourceSha256) throw new Error(`${candidate.candidateId}: founder-attested source artifact hash binding failed`);
    if (sourceArtifact.data.exportId !== candidate.origin.referenceId || sourceArtifact.data.programId !== candidate.programId || sourceArtifact.data.expectedProgramRevision !== candidate.programRevision) {
      throw new Error(`${candidate.candidateId}: founder-attested source artifact identity changed`);
    }
    const sourceRecord = sourceArtifact.data.records.find((entry) => entry.articleSlug === candidate.articleSlug && entry.productId === candidate.productId && entry.candidateRevision === candidate.candidateRevision);
    if (!sourceRecord || sourceRecord.expectedArticleSha256 !== candidate.source.articleSha256 || sourceRecord.paidUrl !== candidate.destination.paidUrl || sourceRecord.productIdentityEvidenceUrl !== candidate.destination.productIdentityEvidenceUrl) {
      throw new Error(`${candidate.candidateId}: founder-attested source artifact does not contain the exact candidate`);
    }
  }
  const paidUrl = assertSafePublicHttpsUrl(candidate.destination.paidUrl, `${candidate.candidateId} paid URL`);
  const evidenceUrl = assertSafePublicHttpsUrl(candidate.destination.productIdentityEvidenceUrl, `${candidate.candidateId} evidence URL`);
  if (candidate.destination.productIdentityEvidenceUrl !== product.url) throw new Error(`${candidate.candidateId}: product identity evidence must equal the ordinary editorial product URL`);
  if (evidenceUrl.search || evidenceUrl.hash) throw new Error(`${candidate.candidateId}: evidence URL cannot contain query parameters or a fragment`);
  if (paidUrl.hash) throw new Error(`${candidate.candidateId}: paid URL cannot contain a fragment`);
  if (paidUrl.hostname.toLowerCase() !== candidate.destination.hostname) throw new Error(`${candidate.candidateId}: paid URL hostname does not match the recorded hostname`);
  if (!program.allowedDomains.includes(candidate.destination.hostname)) throw new Error(`${candidate.candidateId}: paid URL hostname is not allowlisted`);
  const declaredKeys = [...new Set(candidate.destination.trackingParameterKeys.map((key) => key.toLowerCase()))].sort();
  if (declaredKeys.length !== candidate.destination.trackingParameterKeys.length || declaredKeys.some((key, index) => key !== candidate.destination.trackingParameterKeys[index])) throw new Error(`${candidate.candidateId}: tracking parameter keys must be unique, lowercase, and sorted`);
  const approvedKeys = new Set(program.trackingParameterKeys.map((key) => key.toLowerCase()));
  const actualKeys = parameterKeys(paidUrl);
  for (const key of declaredKeys) {
    if (!approvedKeys.has(key)) throw new Error(`${candidate.candidateId}: tracking parameter ${key} is not approved by the program registry`);
    if (!actualKeys.some((actual) => actual.toLowerCase() === key)) throw new Error(`${candidate.candidateId}: paid URL is missing declared tracking parameter ${key}`);
    if (paidUrl.searchParams.getAll(key).some((value) => value.length === 0)) throw new Error(`${candidate.candidateId}: tracking parameter ${key} has an empty value`);
  }
  for (const key of actualKeys) {
    if (trackingLike(key) && !declaredKeys.includes(key.toLowerCase())) throw new Error(`${candidate.candidateId}: tracking-like parameter ${key} is not declared and approved`);
  }
  return { program, article, run, review, product, paidUrl };
}

export async function buildCandidateFromRepository(root, input) {
  const affiliateRaw = await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'));
  const affiliate = affiliateSchema.parse(JSON.parse(affiliateRaw.toString('utf8')));
  const sources = await loadRepositorySources(root);
  const program = affiliate.programs.find((entry) => entry.id === input.programId);
  if (!program?.enabled || program.status !== 'enabled') throw new Error(`${input.programId}: affiliate program is not enabled`);
  if (program.revision !== input.expectedProgramRevision) throw new Error(`${input.programId}: expected program revision does not match`);
  const article = sources.articles.get(input.articleSlug);
  if (!article) throw new Error(`${input.articleSlug}: unknown article`);
  if (article.sha256 !== input.expectedArticleSha256) throw new Error(`${input.articleSlug}: expected article SHA-256 does not match`);
  const run = sources.runsById.get(article.data.researchRun);
  const review = run ? sources.reviewsByPath.get(run.data.qa?.receiptPath) : null;
  const product = (article.data.products ?? []).find((entry) => entry.id === input.productId);
  if (!run || !review || !product) throw new Error(`${input.articleSlug}/${input.productId}: incomplete reviewed source bundle`);
  const paidUrl = assertSafePublicHttpsUrl(input.paidUrl, 'paid URL');
  const trackingParameterKeys = parameterKeys(paidUrl)
    .filter((key) => program.trackingParameterKeys.some((approved) => approved.toLowerCase() === key.toLowerCase()))
    .map((key) => key.toLowerCase()).sort();
  if (!Number.isInteger(input.candidateRevision) || input.candidateRevision < 1) throw new Error('candidate revision must be a positive integer');
  const candidateId = `affiliate-link-${input.articleSlug}-${input.productId}-${input.programId}-v${input.candidateRevision}`;
  const candidate = affiliateLinkCandidateSchema.parse({
    schemaVersion: '1.1.0',
    candidateId,
    status: 'candidate',
    articleSlug: input.articleSlug,
    productId: input.productId,
    programId: input.programId,
    programRevision: program.revision,
    candidateRevision: input.candidateRevision,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    origin: input.origin ?? { source: 'founder_supplied', referenceId: null, sourceArtifactPath: null, sourceSha256: null },
    source: {
      articlePath: `src/data/blog/${article.name}`,
      articleSha256: article.sha256,
      researchRunPath: run.path,
      researchRunSha256: run.sha256,
      independentReviewPath: review.path,
      independentReviewSha256: review.sha256,
      productEditorialSha256: productEditorialSha256(product),
      ordinaryUrl: product.url
    },
    destination: {
      paidUrl: paidUrl.toString(),
      hostname: paidUrl.hostname.toLowerCase(),
      trackingParameterKeys,
      productIdentityEvidenceUrl: input.productIdentityEvidenceUrl
    },
    assertions: {
      editorialRankUnchanged: true,
      productCopyUnchanged: true,
      priceOrAvailabilityClaimAdded: false
    }
  });
  validateCandidate(candidate, { name: `${candidateId}.json` }, new Map(affiliate.programs.map((entry) => [entry.id, entry])), sources, affiliate.policy.founderApproverLogin);
  return candidate;
}

export async function loadAffiliateLinkState(root, options = {}) {
  const affiliateRaw = await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'));
  const affiliate = affiliateSchema.parse(JSON.parse(affiliateRaw.toString('utf8')));
  const modelIssues = validateAffiliateModel(affiliate, { asOfDate: options.asOfDate ?? new Date().toISOString().slice(0, 10) });
  if (modelIssues.length > 0) throw new Error(`Affiliate program registry is invalid: ${modelIssues.join('; ')}`);
  const programsById = new Map(affiliate.programs.map((program) => [program.id, program]));
  const sources = await loadRepositorySources(root);
  const candidates = await readJsonRecords(root, 'affiliate/candidates', affiliateLinkCandidateSchema);
  const reviews = await readJsonRecords(root, 'affiliate/reviews', affiliateLinkReviewSchema);
  const approvals = await readJsonRecords(root, 'affiliate/approvals', affiliateLinkApprovalSchema);
  const batches = await readJsonRecords(root, 'affiliate/batches', affiliateLinkBatchManifestSchema);
  const candidateById = new Map();
  const candidateRevisionKeys = new Set();
  for (const record of candidates) {
    if (candidateById.has(record.data.candidateId)) throw new Error(`${record.data.candidateId}: duplicate affiliate link candidate`);
    validateCandidate(record.data, record, programsById, sources, affiliate.policy.founderApproverLogin);
    const revisionKey = `${record.data.articleSlug}:${record.data.productId}:${record.data.programId}:v${record.data.candidateRevision}`;
    if (candidateRevisionKeys.has(revisionKey)) throw new Error(`${revisionKey}: duplicate affiliate link candidate revision`);
    candidateRevisionKeys.add(revisionKey);
    candidateById.set(record.data.candidateId, record);
  }
  const batchedCandidateIds = new Set();
  for (const record of batches) {
    const batch = record.data;
    if (record.name !== `${batch.batchId}.json`) throw new Error(`${batch.batchId}: affiliate batch filename must match batch ID`);
    if (batch.importedBy !== affiliate.policy.founderApproverLogin) throw new Error(`${batch.batchId}: affiliate batch importer must match the configured founder`);
    const sourceArtifact = sources.affiliateSourceArtifactsByPath.get(batch.sourceArtifactPath);
    if (!sourceArtifact || sourceArtifact.sha256 !== batch.sourceArtifactSha256 || sourceArtifact.data.exportId !== batch.batchId) throw new Error(`${batch.batchId}: source artifact binding failed`);
    if (batch.programId !== sourceArtifact.data.programId || batch.programRevision !== sourceArtifact.data.expectedProgramRevision) throw new Error(`${batch.batchId}: batch program binding does not match the source artifact`);
    if (batch.candidateIds.length !== Object.keys(batch.candidateSha256).length || new Set(batch.candidateIds).size !== batch.candidateIds.length) throw new Error(`${batch.batchId}: candidate manifest is incomplete or duplicated`);
    const expectedCandidateIds = sourceArtifact.data.records.map((sourceRecord) => `affiliate-link-${sourceRecord.articleSlug}-${sourceRecord.productId}-${sourceArtifact.data.programId}-v${sourceRecord.candidateRevision}`).sort();
    const manifestedCandidateIds = [...batch.candidateIds].sort();
    const manifestedCandidateHashIds = Object.keys(batch.candidateSha256).sort();
    if (JSON.stringify(manifestedCandidateIds) !== JSON.stringify(expectedCandidateIds) || JSON.stringify(manifestedCandidateHashIds) !== JSON.stringify(expectedCandidateIds)) {
      throw new Error(`${batch.batchId}: completion manifest must contain the exact source-artifact candidate set`);
    }
    for (const candidateId of batch.candidateIds) {
      if (batchedCandidateIds.has(candidateId)) throw new Error(`${candidateId}: candidate cannot belong to more than one affiliate batch`);
      const candidateRecord = candidateById.get(candidateId);
      if (!candidateRecord || batch.candidateSha256[candidateId] !== candidateRecord.sha256) throw new Error(`${batch.batchId}: candidate hash binding failed for ${candidateId}`);
      if (candidateRecord.data.origin.source !== 'founder_attested_partner_export' || candidateRecord.data.origin.referenceId !== batch.batchId || candidateRecord.data.origin.sourceArtifactPath !== batch.sourceArtifactPath || candidateRecord.data.origin.sourceSha256 !== batch.sourceArtifactSha256) {
        throw new Error(`${batch.batchId}: candidate provenance binding failed for ${candidateId}`);
      }
      if (candidateRecord.data.programId !== batch.programId || candidateRecord.data.programRevision !== batch.programRevision) throw new Error(`${batch.batchId}: candidate program binding failed for ${candidateId}`);
      batchedCandidateIds.add(candidateId);
    }
  }
  for (const record of candidates) {
    if (record.data.origin.source === 'founder_attested_partner_export' && !batchedCandidateIds.has(record.data.candidateId)) throw new Error(`${record.data.candidateId}: founder-attested candidate requires a completed batch manifest`);
  }
  const reviewByCandidate = new Map();
  for (const record of reviews) {
    const review = record.data;
    if (record.name !== `${review.reviewId}.json` || review.reviewId !== `${review.candidateId}-review`) throw new Error(`${review.reviewId}: review ID or filename is invalid`);
    if (reviewByCandidate.has(review.candidateId)) throw new Error(`${review.candidateId}: multiple affiliate link reviews are not allowed`);
    const candidateRecord = candidateById.get(review.candidateId);
    if (!candidateRecord || review.candidatePath !== candidateRecord.path || review.candidateSha256 !== candidateRecord.sha256) throw new Error(`${review.reviewId}: candidate hash binding failed`);
    if (review.reviewerId === candidateRecord.data.createdBy) throw new Error(`${review.reviewId}: candidate creator cannot independently review the same link`);
    if (review.productIdentityEvidenceUrl !== candidateRecord.data.destination.productIdentityEvidenceUrl) throw new Error(`${review.reviewId}: product identity evidence changed`);
    const expectedTrackingIdentityEvidence = candidateRecord.data.origin.source === 'founder_attested_partner_export'
      ? { method: 'founder_attested_partner_export', referencePath: candidateRecord.data.origin.sourceArtifactPath, sha256: candidateRecord.data.origin.sourceSha256 }
      : { method: 'owner_gated_single_link_intake', referencePath: candidateRecord.path, sha256: candidateRecord.sha256 };
    if (JSON.stringify(review.trackingIdentityEvidence) !== JSON.stringify(expectedTrackingIdentityEvidence)) throw new Error(`${review.reviewId}: tracking identity evidence is not bound to the trusted intake artifact`);
    if (review.verdict === 'passed') {
      const resolved = assertSafePublicHttpsUrl(review.destination.resolvedUrl, `${review.reviewId} resolved URL`);
      if (resolved.hostname.toLowerCase() !== review.destination.resolvedHostname) throw new Error(`${review.reviewId}: resolved hostname does not match URL`);
      if (!programsById.get(candidateRecord.data.programId).allowedDomains.includes(resolved.hostname.toLowerCase())) throw new Error(`${review.reviewId}: resolved domain is not allowlisted`);
      const paid = new URL(candidateRecord.data.destination.paidUrl);
      if (!ensureTrackingPreserved(paid, resolved, candidateRecord.data.destination.trackingParameterKeys)) throw new Error(`${review.reviewId}: approved tracking values were not preserved through destination resolution`);
      if (review.destination.httpStatus < 200 || review.destination.httpStatus >= 400) throw new Error(`${review.reviewId}: resolved destination did not return a successful status`);
    }
    reviewByCandidate.set(review.candidateId, record);
  }
  const approvalByCandidate = new Map();
  for (const record of approvals) {
    const approval = record.data;
    if (record.name !== `${approval.approvalId}.json` || approval.approvalId !== `${approval.candidateId}-approval`) throw new Error(`${approval.approvalId}: approval ID or filename is invalid`);
    if (approvalByCandidate.has(approval.candidateId)) throw new Error(`${approval.candidateId}: multiple affiliate link approvals are not allowed`);
    const candidateRecord = candidateById.get(approval.candidateId);
    const reviewRecord = reviewByCandidate.get(approval.candidateId);
    if (!candidateRecord || approval.candidatePath !== candidateRecord.path || approval.candidateSha256 !== candidateRecord.sha256) throw new Error(`${approval.approvalId}: candidate hash binding failed`);
    if (!reviewRecord || reviewRecord.data.verdict !== 'passed' || approval.reviewPath !== reviewRecord.path || approval.reviewSha256 !== reviewRecord.sha256) throw new Error(`${approval.approvalId}: clean review hash binding failed`);
    if (approval.founderLogin !== affiliate.policy.founderApproverLogin) throw new Error(`${approval.approvalId}: founder login does not match policy`);
    if (approval.confirmation !== `APPROVE-${approval.candidateId}`) throw new Error(`${approval.approvalId}: action-time confirmation does not match candidate`);
    approvalByCandidate.set(approval.candidateId, record);
  }
  const overlays = new Map();
  for (const [candidateId, approvalRecord] of approvalByCandidate) {
    const candidateRecord = candidateById.get(candidateId);
    const reviewRecord = reviewByCandidate.get(candidateId);
    const key = `${candidateRecord.data.articleSlug}:${candidateRecord.data.productId}`;
    if (overlays.has(key)) throw new Error(`${key}: multiple approved affiliate links target one product`);
    overlays.set(key, {
      articleSlug: candidateRecord.data.articleSlug,
      productId: candidateRecord.data.productId,
      programId: candidateRecord.data.programId,
      programRevision: candidateRecord.data.programRevision,
      paidUrl: candidateRecord.data.destination.paidUrl,
      candidateId,
      candidatePath: candidateRecord.path,
      candidateSha256: candidateRecord.sha256,
      reviewId: reviewRecord.data.reviewId,
      reviewPath: reviewRecord.path,
      reviewSha256: reviewRecord.sha256,
      approvalId: approvalRecord.data.approvalId,
      approvalPath: approvalRecord.path,
      approvalSha256: approvalRecord.sha256
    });
  }
  return {
    registrySha256: sha256(affiliateRaw),
    affiliate,
    candidates,
    batches,
    reviews,
    approvals,
    overlays,
    counts: {
      candidates: candidates.length,
      batches: batches.length,
      passedReviews: reviews.filter((record) => record.data.verdict === 'passed').length,
      failedReviews: reviews.filter((record) => record.data.verdict === 'failed').length,
      approvals: approvals.length,
      activeOverlays: overlays.size
    }
  };
}

export function applyAffiliateLinkOverlays(article, state) {
  const copy = structuredClone(article);
  let applied = 0;
  copy.products = (copy.products ?? []).map((product) => {
    const overlay = state.overlays.get(`${copy.slug}:${product.id}`);
    if (!overlay) return product;
    applied += 1;
    return { ...product, url: overlay.paidUrl, affiliate: true, affiliateProgram: overlay.programId };
  });
  if (applied > 0) copy.affiliateDisclosure = true;
  return copy;
}
