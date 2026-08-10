import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const runIdSchema = z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/);
const missionSchema = z.object({
  missionId: z.string().regex(/^research-mission-[1-9]\d*-[1-9]\d*$/),
  path: z.string().regex(/^research\/missions\/research-mission-[1-9]\d*-[1-9]\d*\.json$/),
  sha256: sha256Schema,
  workflowRunId: z.string().regex(/^[1-9]\d*$/),
  publicationReadiness: z.enum(['founder_review_required', 'automatic_merge_eligible'])
}).strict();
const socialPackSchema = z.object({
  packId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-launch$/),
  path: z.string().regex(/^social\/drafts\/[a-z0-9]+(?:-[a-z0-9]+)*-launch\.json$/),
  sha256: sha256Schema,
  status: z.literal('draft'),
  postCount: z.number().int().min(5)
}).strict();
const articleEntrySchema = z.object({
  articleSlug: slugSchema,
  title: z.string().min(12),
  route: z.string().regex(/^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  updatedAt: z.string().datetime(),
  articlePath: z.string().regex(/^src\/data\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/),
  articleSha256: sha256Schema,
  reviewedArticleSha256: sha256Schema,
  researchRunId: runIdSchema,
  researchRunPath: z.string().regex(/^research\/runs\/\d{8}-[a-z0-9-]+-[a-f0-9]{8}\.json$/),
  researchRunSha256: sha256Schema,
  independentReviewPath: z.string().regex(/^research\/reviews\/\d{8}-[a-z0-9-]+-[a-f0-9]{8}\.qa\.v1\.json$/),
  independentReviewSha256: sha256Schema,
  reviewedEvidenceSha256: sha256Schema,
  mission: missionSchema.nullable(),
  socialPack: socialPackSchema.nullable(),
  editorialScore: z.number().min(75).max(100),
  evidenceConfidence: z.number().min(70).max(100),
  evidenceMode: z.enum(['desk_research', 'hands_on', 'editorial_standard']),
  finalistCount: z.number().int().nonnegative(),
  productCount: z.number().int().nonnegative(),
  pairCount: z.number().int().nonnegative(),
  affiliateLinkCount: z.number().int().nonnegative(),
  quality: z.object({
    researchValidated: z.literal(true),
    independentReviewPassed: z.literal(true),
    articlePublicationReady: z.literal(true),
    socialLaunchPackReviewed: z.literal(true).nullable(),
    affiliateRegistryEnforced: z.literal(true),
    allArtifactsHashBound: z.literal(true)
  }).strict()
}).strict();

export const publicationManifestSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  manifestId: z.string().regex(/^publication-set-[a-f0-9]{16}$/),
  generatedAt: z.string().datetime(),
  status: z.literal('release_candidate'),
  projectId: z.literal('tipsforyourgifts'),
  siteId: z.literal('tipsforyourgifts'),
  publicBaseUrl: z.literal('https://tipsforyourgifts.web.app'),
  contentSetSha256: sha256Schema,
  counts: z.object({
    articles: z.number().int().positive(),
    researchRuns: z.number().int().positive(),
    independentReviews: z.number().int().positive(),
    socialLaunchPacks: z.number().int().nonnegative(),
    socialDrafts: z.number().int().nonnegative(),
    missionBoundArticles: z.number().int().nonnegative(),
    preMissionValidatedArticles: z.number().int().nonnegative(),
    affiliateLinks: z.number().int().nonnegative()
  }).strict(),
  affiliatePosture: z.object({
    registrySha256: sha256Schema,
    enabledProgramIds: z.array(z.string()).default([]),
    enabledProgramCount: z.number().int().nonnegative(),
    liveAffiliateLinkCount: z.number().int().nonnegative(),
    editorialRankingIndependent: z.literal(true)
  }).strict(),
  articles: z.array(articleEntrySchema).min(1)
}).strict().superRefine((manifest, context) => {
  const slugs = new Set();
  const runIds = new Set();
  let socialPacks = 0;
  let socialDrafts = 0;
  let missionBound = 0;
  let affiliateLinks = 0;
  for (const [index, article] of manifest.articles.entries()) {
    if (slugs.has(article.articleSlug)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['articles', index, 'articleSlug'], message: 'article slugs must be unique' });
    if (runIds.has(article.researchRunId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['articles', index, 'researchRunId'], message: 'research runs must map to exactly one article' });
    slugs.add(article.articleSlug);
    runIds.add(article.researchRunId);
    if (article.route !== `/blog/${article.articleSlug}`) context.addIssue({ code: z.ZodIssueCode.custom, path: ['articles', index, 'route'], message: 'article route must match slug' });
    if (article.mission) missionBound += 1;
    if (article.socialPack) {
      socialPacks += 1;
      socialDrafts += article.socialPack.postCount;
    }
    affiliateLinks += article.affiliateLinkCount;
  }
  const expectedCounts = {
    articles: manifest.articles.length,
    researchRuns: runIds.size,
    independentReviews: manifest.articles.length,
    socialLaunchPacks: socialPacks,
    socialDrafts,
    missionBoundArticles: missionBound,
    preMissionValidatedArticles: manifest.articles.length - missionBound,
    affiliateLinks
  };
  for (const [key, value] of Object.entries(expectedCounts)) {
    if (manifest.counts[key] !== value) context.addIssue({ code: z.ZodIssueCode.custom, path: ['counts', key], message: `expected ${value}` });
  }
  if (manifest.affiliatePosture.enabledProgramCount !== manifest.affiliatePosture.enabledProgramIds.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['affiliatePosture', 'enabledProgramCount'], message: 'enabled program count must match IDs' });
  if (manifest.affiliatePosture.liveAffiliateLinkCount !== affiliateLinks || manifest.counts.affiliateLinks !== affiliateLinks) context.addIssue({ code: z.ZodIssueCode.custom, path: ['affiliatePosture', 'liveAffiliateLinkCount'], message: 'affiliate link counts must match article evidence' });
  const expectedContentSetSha256 = canonicalSha256({ articles: manifest.articles, affiliatePosture: manifest.affiliatePosture });
  if (manifest.contentSetSha256 !== expectedContentSetSha256) context.addIssue({ code: z.ZodIssueCode.custom, path: ['contentSetSha256'], message: 'content set SHA-256 must bind the canonical article and affiliate posture' });
  if (manifest.manifestId !== `publication-set-${manifest.contentSetSha256.slice(0, 16)}`) context.addIssue({ code: z.ZodIssueCode.custom, path: ['manifestId'], message: 'manifest ID must bind the content set SHA-256' });
});

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}

function canonicalSha256(value) {
  return sha256(`${JSON.stringify(canonicalize(value))}\n`);
}

async function readJsonFiles(directory) {
  let names = [];
  try { names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort(); } catch {}
  return Promise.all(names.map(async (name) => {
    const raw = await fs.readFile(path.join(directory, name));
    return { name, raw, data: JSON.parse(raw.toString('utf8')) };
  }));
}

function reviewedEvidenceSha256(run) {
  const reviewable = structuredClone(run);
  delete reviewable.qa;
  delete reviewable.completedAt;
  reviewable.status = 'review_pending';
  reviewable.article.status = 'review_pending';
  return sha256(`${JSON.stringify(reviewable)}\n`);
}

function reviewedArticleSha256(raw) {
  return sha256(raw.toString().replace(/^status:\s*(?:draft|publication_ready)\s*$/m, 'status: review_pending'));
}

export async function buildPublicationManifest(root) {
  const runRecords = await readJsonFiles(path.join(root, 'research', 'runs'));
  const reviewRecords = await readJsonFiles(path.join(root, 'research', 'reviews'));
  const missionRecords = await readJsonFiles(path.join(root, 'research', 'missions'));
  const socialRecords = await readJsonFiles(path.join(root, 'social', 'drafts'));
  const runById = new Map(runRecords.map((record) => [record.data.runId, record]));
  const reviewByPath = new Map(reviewRecords.map((record) => [`research/reviews/${record.name}`, record]));
  const socialByRun = new Map(socialRecords.map((record) => [record.data.researchRun, record]));
  const missionByRun = new Map();
  for (const record of missionRecords) {
    if (record.data.status !== 'completed' || !record.data.completion) continue;
    if (missionByRun.has(record.data.completion.runId)) throw new Error(`${record.data.completion.runId}: multiple completed missions bind the same run`);
    missionByRun.set(record.data.completion.runId, record);
  }
  const affiliateRaw = await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'));
  const affiliate = JSON.parse(affiliateRaw);
  const enabledProgramIds = affiliate.programs.filter((program) => program.enabled).map((program) => program.id).sort();
  const articleNames = (await fs.readdir(path.join(root, 'src', 'data', 'blog'))).filter((name) => name.endsWith('.md')).sort();
  const articles = [];
  const dates = [];

  for (const name of articleNames) {
    const articleRaw = await fs.readFile(path.join(root, 'src', 'data', 'blog', name));
    const parsed = matter(articleRaw.toString());
    if (parsed.data.status !== 'publication_ready') continue;
    const slug = path.basename(name, '.md');
    const run = runById.get(parsed.data.researchRun);
    if (!run) throw new Error(`${slug}: publication-ready article has no research run`);
    if (run.data.status !== 'validated' || run.data.article.status !== 'publication_ready' || !run.data.qa?.passed || run.data.article.slug !== slug) throw new Error(`${slug}: research run is not publication ready`);
    const reviewPath = run.data.qa.receiptPath;
    const review = reviewByPath.get(reviewPath);
    if (!review || review.data.verdict !== 'passed' || review.data.blockers.length > 0 || review.data.runId !== run.data.runId || review.data.articleSlug !== slug || review.data.reviewerId === run.data.draftAuthor) throw new Error(`${slug}: independent review receipt is not a clean separated pass`);
    if (review.data.evidenceSha256 !== reviewedEvidenceSha256(run.data)) throw new Error(`${slug}: reviewed evidence digest changed`);
    if (review.data.articleSha256 !== reviewedArticleSha256(articleRaw)) throw new Error(`${slug}: reviewed article digest changed`);
    const social = socialByRun.get(run.data.runId) ?? null;
    if (social && (social.data.articleSlug !== slug || social.data.status !== 'draft' || review.data.socialSha256 !== sha256(social.raw))) throw new Error(`${slug}: reviewed social launch pack changed`);
    if (!social && review.data.socialSha256 !== null) throw new Error(`${slug}: review expects a missing social launch pack`);
    const mission = missionByRun.get(run.data.runId) ?? null;
    const articleSha = sha256(articleRaw);
    const runSha = sha256(run.raw);
    const reviewSha = sha256(review.raw);
    if (mission) {
      const completion = mission.data.completion;
      if (completion.runSha256 !== runSha || completion.articleSha256 !== articleSha || completion.reviewReceiptSha256 !== reviewSha || completion.reviewReceiptPath !== reviewPath || completion.articleSlug !== slug) throw new Error(`${slug}: completed mission hashes differ from release artifacts`);
      if (!social || completion.socialPackSha256 !== sha256(social.raw) || completion.socialPackId !== social.data.packId) throw new Error(`${slug}: completed mission social pack differs from release artifact`);
    }
    const productCount = Array.isArray(parsed.data.products) ? parsed.data.products.length : 0;
    const affiliateLinkCount = Array.isArray(parsed.data.products) ? parsed.data.products.filter((product) => product.affiliate).length : 0;
    if (affiliateLinkCount !== run.data.affiliateLinks.length) throw new Error(`${slug}: article and run affiliate link counts differ`);
    const updatedAt = new Date(parsed.data.updatedDate ?? parsed.data.publishDate).toISOString();
    dates.push(updatedAt, run.data.completedAt, review.data.reviewedAt, social?.data.createdAt, mission?.data.completedAt);
    articles.push({
      articleSlug: slug,
      title: parsed.data.title,
      route: `/blog/${slug}`,
      updatedAt,
      articlePath: `src/data/blog/${name}`,
      articleSha256: articleSha,
      reviewedArticleSha256: review.data.articleSha256,
      researchRunId: run.data.runId,
      researchRunPath: `research/runs/${run.name}`,
      researchRunSha256: runSha,
      independentReviewPath: reviewPath,
      independentReviewSha256: reviewSha,
      reviewedEvidenceSha256: review.data.evidenceSha256,
      mission: mission ? {
        missionId: mission.data.missionId,
        path: `research/missions/${mission.name}`,
        sha256: sha256(mission.raw),
        workflowRunId: mission.data.trigger.workflowRunId,
        publicationReadiness: mission.data.completion.publicationReadiness
      } : null,
      socialPack: social ? {
        packId: social.data.packId,
        path: `social/drafts/${social.name}`,
        sha256: sha256(social.raw),
        status: social.data.status,
        postCount: social.data.posts.length
      } : null,
      editorialScore: run.data.article.editorialScore,
      evidenceConfidence: run.data.article.evidenceConfidence,
      evidenceMode: run.data.article.evidenceMode,
      finalistCount: run.data.finalists.length,
      productCount,
      pairCount: Array.isArray(parsed.data.pairs) ? parsed.data.pairs.length : 0,
      affiliateLinkCount,
      quality: {
        researchValidated: true,
        independentReviewPassed: true,
        articlePublicationReady: true,
        socialLaunchPackReviewed: social ? true : null,
        affiliateRegistryEnforced: true,
        allArtifactsHashBound: true
      }
    });
  }
  const validatedRuns = runRecords.filter((record) => record.data.status === 'validated');
  if (validatedRuns.length !== articles.length) throw new Error(`Expected one publication-ready article for each validated run; found ${articles.length}/${validatedRuns.length}`);
  const affiliateLinkCount = articles.reduce((sum, article) => sum + article.affiliateLinkCount, 0);
  const affiliatePosture = {
    registrySha256: sha256(affiliateRaw),
    enabledProgramIds,
    enabledProgramCount: enabledProgramIds.length,
    liveAffiliateLinkCount: affiliateLinkCount,
    editorialRankingIndependent: true
  };
  const contentSetSha256 = canonicalSha256({ articles, affiliatePosture });
  const manifest = {
    schemaVersion: '1.0.0',
    manifestId: `publication-set-${contentSetSha256.slice(0, 16)}`,
    generatedAt: new Date(Math.max(...dates.filter(Boolean).map((value) => new Date(value).valueOf()))).toISOString(),
    status: 'release_candidate',
    projectId: 'tipsforyourgifts',
    siteId: 'tipsforyourgifts',
    publicBaseUrl: 'https://tipsforyourgifts.web.app',
    contentSetSha256,
    counts: {
      articles: articles.length,
      researchRuns: articles.length,
      independentReviews: articles.length,
      socialLaunchPacks: articles.filter((article) => article.socialPack).length,
      socialDrafts: articles.reduce((sum, article) => sum + (article.socialPack?.postCount ?? 0), 0),
      missionBoundArticles: articles.filter((article) => article.mission).length,
      preMissionValidatedArticles: articles.filter((article) => !article.mission).length,
      affiliateLinks: affiliateLinkCount
    },
    affiliatePosture,
    articles
  };
  return publicationManifestSchema.parse(manifest);
}

export function parsePublicationManifest(value) {
  return publicationManifestSchema.parse(value);
}
