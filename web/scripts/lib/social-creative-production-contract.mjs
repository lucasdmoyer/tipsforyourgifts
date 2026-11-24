import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { socialCreativeCandidateSchema, socialPostSha256 } from './social-contract.mjs';
import {
  callOpenAiResponses,
  extractSingleGeneratedImage,
  extractStructuredOutput,
  VISUAL_IMAGE_TOOL_MODEL,
  VISUAL_PRODUCER_MODEL,
  VISUAL_REVIEW_MODEL
} from './visual-production-contract.mjs';

export const SOCIAL_CREATIVE_PRODUCER_MODEL = VISUAL_PRODUCER_MODEL;
export const SOCIAL_CREATIVE_IMAGE_MODEL = VISUAL_IMAGE_TOOL_MODEL;
export const SOCIAL_CREATIVE_REVIEW_MODEL = VISUAL_REVIEW_MODEL;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const relativePath = z.string().regex(/^(?!\/)(?!.*\.\.)(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+$/);
const generatedFile = z.object({
  path: relativePath,
  sha256: sha256Schema,
  bytes: z.number().int().positive().max(20_000_000),
  width: z.literal(1024),
  height: z.literal(1536),
  contentType: z.enum(['image/png', 'image/jpeg'])
}).strict();

export const socialCreativeProductionManifestSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  candidateId: slug,
  status: z.literal('generated_awaiting_independent_review'),
  generatedAt: z.string().datetime(),
  generatedBy: z.object({
    workflow: z.literal('social-creative-production.yml'),
    workflowRunId: z.string().regex(/^[1-9]\d*$/),
    workflowRunAttempt: z.number().int().positive(),
    model: z.literal(SOCIAL_CREATIVE_PRODUCER_MODEL),
    imageToolModel: z.literal(SOCIAL_CREATIVE_IMAGE_MODEL)
  }).strict(),
  bindings: z.object({
    packId: slug,
    packPath: z.string().regex(/^social\/drafts\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/),
    packSha256: sha256Schema,
    postId: slug,
    postSha256: sha256Schema,
    platform: z.enum(['pinterest', 'instagram']),
    articleSlug: slug
  }).strict(),
  prompt: z.string().min(700).max(8000),
  promptSha256: sha256Schema,
  revisedPrompt: z.string().min(20).max(8000).nullable(),
  source: generatedFile.extend({ contentType: z.literal('image/png') }).strict(),
  delivery: generatedFile.extend({ bytes: z.number().int().positive().max(1_000_000), contentType: z.literal('image/jpeg') }).strict(),
  usage: z.object({
    totalTokens: z.number().int().nonnegative().nullable(),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable()
  }).strict(),
  safety: z.object({
    safetyIdentifierSha256: sha256Schema,
    rawApiResponseStored: z.literal(false),
    secretValueStored: z.literal(false),
    externalSourceImagesUsed: z.literal(false),
    personalDataSent: z.literal(false)
  }).strict()
}).strict().superRefine((manifest, context) => {
  if (manifest.candidateId !== `${manifest.bindings.postId}-v1`) context.addIssue({ code: z.ZodIssueCode.custom, path: ['candidateId'], message: 'must be the first immutable candidate revision for the selected post' });
  if (manifest.promptSha256 !== sha256(manifest.prompt)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['promptSha256'], message: 'must match the submitted prompt' });
});

const socialCreativeChecksSchema = z.object({
  briefFidelity: z.boolean(),
  sourcePostAccuracy: z.boolean(),
  textAndWatermarkFree: z.boolean(),
  noThirdPartyLogos: z.boolean(),
  noMerchantImagery: z.boolean(),
  noUnsupportedProductClaims: z.boolean(),
  anatomyAndObjectCoherence: z.boolean(),
  mobileLegibility: z.boolean(),
  safeDepiction: z.boolean()
}).strict();

export const socialCreativeReviewModelOutputSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  candidateId: slug,
  verdict: z.enum(['passed', 'failed']),
  checks: socialCreativeChecksSchema,
  blockers: z.array(z.string().min(12)),
  warnings: z.array(z.string().min(12))
}).strict().superRefine((result, context) => {
  const failed = Object.values(result.checks).some((value) => value === false);
  if (result.verdict === 'passed' && (failed || result.blockers.length > 0)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['verdict'], message: 'a pass cannot retain failed checks or blockers' });
  if (result.verdict === 'failed' && !failed && result.blockers.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ['blockers'], message: 'a failure needs a concrete blocker or failed check' });
});

export const socialCreativeReviewFindingsSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  candidateId: slug,
  manifestPath: z.string().regex(/^social\/production\/[a-z0-9]+(?:-[a-z0-9]+)*\/manifest\.json$/),
  manifestSha256: sha256Schema,
  reviewedAt: z.string().datetime(),
  reviewer: z.object({
    role: z.literal('independent-social-visual-editor'),
    model: z.literal(SOCIAL_CREATIVE_REVIEW_MODEL),
    workflow: z.literal('social-creative-production.yml'),
    workflowRunId: z.string().regex(/^[1-9]\d*$/),
    workflowRunAttempt: z.number().int().positive(),
    responseId: z.string().min(8),
    usage: z.object({ totalTokens: z.number().int().nonnegative().nullable(), inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable() }).strict()
  }).strict(),
  verdict: z.enum(['passed', 'failed']),
  checks: socialCreativeChecksSchema,
  blockers: z.array(z.string().min(12)),
  warnings: z.array(z.string().min(12)),
  privacy: z.object({ rawApiResponseStored: z.literal(false), secretValueStored: z.literal(false), personalDataSent: z.literal(false) }).strict()
}).strict().superRefine((findings, context) => {
  const parsed = socialCreativeReviewModelOutputSchema.safeParse({ schemaVersion: findings.schemaVersion, candidateId: findings.candidateId, verdict: findings.verdict, checks: findings.checks, blockers: findings.blockers, warnings: findings.warnings });
  if (!parsed.success) context.addIssue({ code: z.ZodIssueCode.custom, path: ['verdict'], message: parsed.error.issues.map((issue) => issue.message).join('; ') });
});

export const socialCreativeFailureSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  failureId: slug,
  candidateId: slug,
  packId: slug,
  postId: slug,
  packSha256: sha256Schema,
  postSha256: sha256Schema,
  stage: z.enum(['production', 'independent-review']),
  reasonCode: slug,
  workflowRunId: z.string().regex(/^[1-9]\d*$/),
  workflowRunAttempt: z.number().int().positive(),
  failedAt: z.string().datetime(),
  sourcePromoted: z.literal(false),
  mediaApproved: z.literal(false),
  contentApproved: z.literal(false),
  externalPostCreated: z.literal(false),
  nextGate: z.string().min(60)
}).strict();

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function socialCreativeProductionDirectory(candidateId) {
  return `social/production/${candidateId}`;
}

export function isSocialCreativePostEligible({ post, packStatus = 'draft', hasCandidate = false }) {
  return packStatus === 'draft'
    && post?.status === 'draft'
    && ['pinterest', 'instagram'].includes(post?.platform)
    && !hasCandidate;
}

async function readJsonRecords(directory, prefix) {
  let names = [];
  try { names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return Promise.all(names.map(async (name) => {
    const raw = await fs.readFile(path.join(directory, name));
    return { path: `${prefix}/${name}`, raw, sha256: sha256(raw), data: JSON.parse(raw.toString('utf8')) };
  }));
}

export async function loadSocialCreativeTarget(root, { postId = null, packPath = null } = {}) {
  const packs = await readJsonRecords(path.join(root, 'social', 'drafts'), 'social/drafts');
  const candidates = await readJsonRecords(path.join(root, 'social', 'candidates'), 'social/candidates');
  const candidatePosts = new Set(candidates.map((record) => socialCreativeCandidateSchema.parse(record.data).postId));
  const normalizedPackPath = packPath ? packPath.replace(/^web\//, '') : null;
  const eligible = [];
  for (const packRecord of packs) {
    if (normalizedPackPath && packRecord.path !== normalizedPackPath) continue;
    const pack = packRecord.data;
    if (pack.status !== 'draft') continue;
    for (const post of pack.posts ?? []) {
      if (postId && post.id !== postId) continue;
      if (!isSocialCreativePostEligible({ post, packStatus: pack.status, hasCandidate: candidatePosts.has(post.id) })) continue;
      eligible.push({
        candidateId: `${post.id}-v1`,
        pack: { ...pack, __sha256: packRecord.sha256 },
        packRecord,
        post,
        postSha256: socialPostSha256(post)
      });
    }
  }
  eligible.sort((left, right) => `${left.pack.packId}:${left.post.id}`.localeCompare(`${right.pack.packId}:${right.post.id}`));
  if (postId && eligible.length === 0) throw new Error(`${postId}: no eligible static social post without an existing creative candidate`);
  if (eligible.length === 0) return null;
  return eligible[0];
}

export function buildSocialCreativePrompt({ target }) {
  const { post, pack } = target;
  return [
    'Create one original vertical 2:3 editorial illustration for Tips for Your Gifts. Use the established Gift-Thread visual language: a gentle three-quarter top-down viewpoint, simplified geometric forms, chunky deep-evergreen ink contours, soft matte gouache fills, subtle risograph misregistration, recycled-paper grain, and a mature warm editorial tone. Use parchment cream, deep evergreen, muted mint, saffron gold, restrained coral, and occasional dusty blue. A loose saffron ribbon may connect the two useful roles without becoming a logo or label.',
    `Social post: ${post.id}. Platform: ${post.platform}. Format intent: ${post.format}.`,
    `Editorial angle: ${post.angle}`,
    `Headline context, for meaning only and not for rendering as text: ${post.headline}`,
    `Caption context, for meaning only and not for rendering as text: ${post.copy}`,
    `Visual brief: ${post.assetBrief}`,
    `Accessible meaning: ${post.altText}`,
    `Destination article: ${pack.articleSlug}.`,
    'Render exactly one 1024x1536 portrait scene with one dominant interaction and enough breathing room for mobile use. Translate any requested checklist, worksheet, carousel, diagram, or typography into a single text-free visual metaphor. The social caption carries the words; the image must not attempt to typeset them.',
    'Illustrate generic product categories and the lived routine, never an exact SKU likeness. Do not reproduce logos, wordmarks, brand colors, packaging, book covers, game interfaces, maps, characters, copyrighted art, merchant imagery, screenshots, prices, ratings, labels, readable words, letters, numbers, signatures, or watermarks. Do not imply first-hand product testing, safety, compatibility, preservation, or performance guarantees.',
    'Avoid photorealism, glossy 3D rendering, anime, childish sweetness, catalog arrangements, clutter, distorted fingers, extra hands, unsafe behavior, unsupported recipient facts, and imitation of any named artist. Make hands, tools, animals, furniture, and object relationships coherent. This is an unapproved creative candidate; it does not authorize media rights, content approval, publication, or external posting.'
  ].join('\n\n');
}

export function buildSocialImageGenerationBody({ prompt, safetyIdentifier, styleReferenceDataUrl }) {
  return {
    model: SOCIAL_CREATIVE_PRODUCER_MODEL,
    store: false,
    safety_identifier: safetyIdentifier,
    instructions: 'Generate exactly one original vertical editorial illustration. Use the image-generation tool once and do not return prose.',
    input: [{ role: 'user', content: [
      { type: 'input_text', text: `${prompt}\n\nThe attached image is a founder-approved style reference only. Preserve its visual language, not its people, objects, layout, or scene.` },
      { type: 'input_image', image_url: styleReferenceDataUrl, detail: 'high' }
    ] }],
    tools: [{ type: 'image_generation', model: SOCIAL_CREATIVE_IMAGE_MODEL, action: 'generate', size: '1024x1536', quality: 'high', background: 'opaque', output_format: 'png' }],
    tool_choice: { type: 'image_generation' }
  };
}

export function socialCreativeReviewJsonSchema() {
  const checkNames = ['briefFidelity', 'sourcePostAccuracy', 'textAndWatermarkFree', 'noThirdPartyLogos', 'noMerchantImagery', 'noUnsupportedProductClaims', 'anatomyAndObjectCoherence', 'mobileLegibility', 'safeDepiction'];
  return {
    type: 'object', additionalProperties: false,
    properties: {
      schemaVersion: { type: 'string', enum: ['1.0.0'] },
      candidateId: { type: 'string' },
      verdict: { type: 'string', enum: ['passed', 'failed'] },
      checks: { type: 'object', additionalProperties: false, properties: Object.fromEntries(checkNames.map((name) => [name, { type: 'boolean' }])), required: checkNames },
      blockers: { type: 'array', items: { type: 'string' } },
      warnings: { type: 'array', items: { type: 'string' } }
    },
    required: ['schemaVersion', 'candidateId', 'verdict', 'checks', 'blockers', 'warnings']
  };
}

export function routeSocialCreativeResult({ productionOutcome, productionFailureCode, reviewOutcome, reviewFailureCode, reviewVerdict }) {
  if (productionOutcome !== 'ready') return { route: 'failure', stage: 'production', reasonCode: productionFailureCode || 'production-step-failed' };
  if (reviewOutcome !== 'ready') return { route: 'failure', stage: 'independent-review', reasonCode: reviewFailureCode || 'review-step-failed' };
  if (reviewVerdict === 'failed') return { route: 'failure', stage: 'independent-review', reasonCode: 'review-verdict-failed' };
  if (reviewVerdict === 'passed') return { route: 'candidate' };
  throw new Error('Social creative result could not be routed safely');
}

export { callOpenAiResponses, extractSingleGeneratedImage, extractStructuredOutput };
