import crypto from 'node:crypto';
import { z } from 'zod';

export const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
export const VISUAL_PRODUCER_MODEL = 'gpt-6.2-sol';
export const VISUAL_IMAGE_TOOL_MODEL = 'gpt-image-2.5-sunburst-2026-09-08';
export const VISUAL_REVIEW_MODEL = 'gpt-6.2-sol';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const runIdSchema = z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/);
const requestIdSchema = z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}-visuals$/);
const missionIdSchema = z.string().regex(/^research-mission-[1-9]\d*-[1-9]\d*$/);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const relativePathSchema = z.string().regex(/^(?!\/)(?!.*\.\.)(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+$/);

const generatedFileSchema = z.object({
  path: relativePathSchema,
  sha256: sha256Schema,
  bytes: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
}).strict();

const derivativeSchema = generatedFileSchema.extend({
  label: z.enum(['480x320', '768x512', '1200x800'])
}).strict();

const generatedAssetSchema = z.object({
  assetId: slugSchema,
  role: z.enum(['hero', 'pair_scene']),
  pairId: slugSchema.nullable(),
  productIds: z.array(slugSchema).min(1),
  prompt: z.string().min(500).max(8000),
  promptSha256: sha256Schema,
  revisedPrompt: z.string().min(20).max(8000).nullable(),
  source: generatedFileSchema,
  delivery: generatedFileSchema,
  derivatives: z.array(derivativeSchema).length(3),
  usage: z.object({
    totalTokens: z.number().int().nonnegative().nullable(),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable()
  }).strict()
}).strict().superRefine((asset, context) => {
  if (asset.promptSha256 !== sha256(asset.prompt)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['promptSha256'], message: 'must match the submitted prompt' });
  if (asset.source.width !== 1536 || asset.source.height !== 1024) context.addIssue({ code: z.ZodIssueCode.custom, path: ['source'], message: 'source must be 1536x1024' });
  if (asset.delivery.width !== 1536 || asset.delivery.height !== 1024) context.addIssue({ code: z.ZodIssueCode.custom, path: ['delivery'], message: 'delivery must be 1536x1024' });
  const expected = new Map([['480x320', [480, 320]], ['768x512', [768, 512]], ['1200x800', [1200, 800]]]);
  if (new Set(asset.derivatives.map((entry) => entry.label)).size !== 3) context.addIssue({ code: z.ZodIssueCode.custom, path: ['derivatives'], message: 'derivative labels must be unique' });
  for (const derivative of asset.derivatives) {
    const [width, height] = expected.get(derivative.label) ?? [];
    if (derivative.width !== width || derivative.height !== height) context.addIssue({ code: z.ZodIssueCode.custom, path: ['derivatives'], message: `${derivative.label} dimensions are invalid` });
  }
});

export const visualProductionManifestSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  requestId: requestIdSchema,
  status: z.literal('generated_awaiting_independent_review'),
  generatedAt: z.string().datetime(),
  generatedBy: z.object({
    workflow: z.literal('visual-production.yml'),
    workflowRunId: z.string().regex(/^[1-9]\d*$/),
    workflowRunAttempt: z.number().int().positive(),
    model: z.literal(VISUAL_PRODUCER_MODEL),
    imageToolModel: z.literal(VISUAL_IMAGE_TOOL_MODEL)
  }).strict(),
  bindings: z.object({
    missionId: missionIdSchema,
    missionPath: z.string().regex(/^research\/missions\/research-mission-[1-9]\d*-[1-9]\d*\.json$/),
    missionSha256: sha256Schema,
    requestPath: z.string().regex(/^visuals\/requests\/\d{8}-[a-z0-9-]+-[a-f0-9]{8}-visuals\.json$/),
    requestSha256: sha256Schema,
    runId: runIdSchema,
    runPath: z.string().regex(/^research\/runs\/\d{8}-[a-z0-9-]+-[a-f0-9]{8}\.json$/),
    runSha256: sha256Schema,
    articleSlug: slugSchema,
    articlePath: z.string().regex(/^src\/data\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/),
    articleSha256: sha256Schema,
    baseRegistryPath: z.literal('visuals/article-visuals.json'),
    baseRegistrySha256: sha256Schema,
    basePromptBookPath: z.literal('visuals/PROMPTS.md'),
    basePromptBookSha256: sha256Schema,
    styleReferencePath: z.literal('visuals/sources/read-it-big-history.png'),
    styleReferenceSha256: sha256Schema
  }).strict(),
  assets: z.array(generatedAssetSchema).min(1).max(12),
  safety: z.object({
    safetyIdentifierSha256: sha256Schema,
    rawApiResponseStored: z.literal(false),
    secretValueStored: z.literal(false),
    externalSourceImagesUsed: z.literal(false)
  }).strict()
}).strict().superRefine((manifest, context) => {
  if (manifest.requestId !== `${manifest.bindings.runId}-visuals`) context.addIssue({ code: z.ZodIssueCode.custom, path: ['requestId'], message: 'must bind the run ID' });
  if (new Set(manifest.assets.map((asset) => asset.assetId)).size !== manifest.assets.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['assets'], message: 'asset IDs must be unique' });
});

const visualCheckSchema = z.object({
  styleMatch: z.boolean(),
  sceneAccuracy: z.boolean(),
  productContextTruth: z.boolean(),
  copyrightAndTradeDressBoundary: z.boolean(),
  anatomyAndObjectCoherence: z.boolean(),
  mobileLegibility: z.boolean(),
  textAndWatermarkFree: z.boolean(),
  safeDepiction: z.boolean()
}).strict();

export const visualReviewModelOutputSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  requestId: requestIdSchema,
  verdict: z.enum(['passed', 'failed']),
  assets: z.array(z.object({
    assetId: slugSchema,
    checks: visualCheckSchema,
    blockers: z.array(z.string().min(12)),
    warnings: z.array(z.string().min(12))
  }).strict()).min(1).max(12),
  blockers: z.array(z.string().min(12)),
  warnings: z.array(z.string().min(12))
}).strict().superRefine((result, context) => {
  const failedChecks = result.assets.some((asset) => Object.values(asset.checks).some((value) => value === false) || asset.blockers.length > 0);
  if (result.verdict === 'passed' && (result.blockers.length > 0 || failedChecks)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['verdict'], message: 'a pass cannot retain failed checks or blockers' });
  if (result.verdict === 'failed' && result.blockers.length === 0 && !failedChecks) context.addIssue({ code: z.ZodIssueCode.custom, path: ['blockers'], message: 'a failure needs a concrete blocker or failed check' });
});

export const visualReviewFindingsSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  requestId: requestIdSchema,
  manifestPath: z.string().regex(/^visuals\/production\/\d{8}-[a-z0-9-]+-[a-f0-9]{8}-visuals\/manifest\.json$/),
  manifestSha256: sha256Schema,
  reviewedAt: z.string().datetime(),
  reviewer: z.object({
    role: z.literal('independent-visual-editor'),
    model: z.literal(VISUAL_REVIEW_MODEL),
    workflow: z.literal('visual-production.yml'),
    workflowRunId: z.string().regex(/^[1-9]\d*$/),
    workflowRunAttempt: z.number().int().positive(),
    responseId: z.string().min(8),
    usage: z.object({
      totalTokens: z.number().int().nonnegative().nullable(),
      inputTokens: z.number().int().nonnegative().nullable(),
      outputTokens: z.number().int().nonnegative().nullable()
    }).strict()
  }).strict(),
  verdict: z.enum(['passed', 'failed']),
  assets: visualReviewModelOutputSchema.shape.assets,
  blockers: visualReviewModelOutputSchema.shape.blockers,
  warnings: visualReviewModelOutputSchema.shape.warnings,
  privacy: z.object({
    rawApiResponseStored: z.literal(false),
    secretValueStored: z.literal(false),
    personalDataSent: z.literal(false)
  }).strict()
}).strict().superRefine((findings, context) => {
  const modelResult = visualReviewModelOutputSchema.safeParse({
    schemaVersion: findings.schemaVersion,
    requestId: findings.requestId,
    verdict: findings.verdict,
    assets: findings.assets,
    blockers: findings.blockers,
    warnings: findings.warnings
  });
  if (!modelResult.success) context.addIssue({ code: z.ZodIssueCode.custom, path: ['verdict'], message: modelResult.error.issues.map((issue) => issue.message).join('; ') });
});

const reviewedAssetSchema = z.object({
  assetId: slugSchema,
  assetRecordSha256: sha256Schema,
  promptSectionSha256: sha256Schema,
  sourcePath: z.string().regex(/^visuals\/sources\/[a-z0-9]+(?:-[a-z0-9]+)*\.png$/),
  sourceSha256: sha256Schema,
  publicPaths: z.array(z.string().regex(/^public\/blog-images\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?(?:-(?:480|768|1200))?\.webp$/)).length(4),
  publicSha256: z.array(sha256Schema).length(4)
}).strict();

export const visualReviewReceiptSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  receiptId: z.string().regex(/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}-visuals-visual-qa-v1$/),
  receiptRevision: z.literal(1),
  requestId: requestIdSchema,
  runId: runIdSchema,
  missionId: missionIdSchema,
  articleSlug: slugSchema,
  reviewedAt: z.string().datetime(),
  reviewerRole: z.literal('independent-visual-editor'),
  reviewerId: z.string().min(12),
  producerModel: z.literal(VISUAL_PRODUCER_MODEL),
  imageToolModel: z.literal(VISUAL_IMAGE_TOOL_MODEL),
  reviewerModel: z.literal(VISUAL_REVIEW_MODEL),
  workflowName: z.literal('visual-production.yml'),
  workflowRunId: z.string().regex(/^[1-9]\d*$/),
  verdict: z.literal('passed'),
  requestPath: z.string().regex(/^visuals\/requests\/\d{8}-[a-z0-9-]+-[a-f0-9]{8}-visuals\.json$/),
  requestSha256: sha256Schema,
  manifestSha256: sha256Schema,
  findingsSha256: sha256Schema,
  registryPath: z.literal('visuals/article-visuals.json'),
  registrySha256: sha256Schema,
  promptBookPath: z.literal('visuals/PROMPTS.md'),
  promptBookSha256: sha256Schema,
  articleMappingSha256: sha256Schema,
  assets: z.array(reviewedAssetSchema).min(1).max(12),
  checks: visualCheckSchema.extend({
    sourceAndPromptProvenance: z.literal(true),
    fileIntegrity: z.literal(true),
    responsiveDerivatives: z.literal(true),
    draftIsolationPreservedUntilPass: z.literal(true)
  }).strict(),
  blockers: z.array(z.never()).length(0),
  warnings: z.array(z.string().min(12)),
  usage: z.object({
    production: z.object({
      apiCalls: z.number().int().min(1).max(12),
      assetsGenerated: z.number().int().min(1).max(12),
      totalTokens: z.number().int().nonnegative().nullable(),
      inputTokens: z.number().int().nonnegative().nullable(),
      outputTokens: z.number().int().nonnegative().nullable()
    }).strict(),
    independentReview: z.object({
      apiCalls: z.literal(1),
      totalTokens: z.number().int().nonnegative().nullable(),
      inputTokens: z.number().int().nonnegative().nullable(),
      outputTokens: z.number().int().nonnegative().nullable()
    }).strict(),
    maximumApiCallsAllowed: z.literal(13),
    pricedCostUsd: z.null(),
    pricingStatus: z.literal('not_priced_requires_external_billing_evidence')
  }).strict(),
  sourcePromotionAuthorized: z.literal(true),
  productionDeploymentAuthorized: z.literal(false)
}).strict().superRefine((receipt, context) => {
  if (receipt.receiptId !== `${receipt.requestId}-visual-qa-v1`) context.addIssue({ code: z.ZodIssueCode.custom, path: ['receiptId'], message: 'must bind the request ID' });
  if (receipt.requestId !== `${receipt.runId}-visuals`) context.addIssue({ code: z.ZodIssueCode.custom, path: ['runId'], message: 'must bind the request run ID' });
  if (new Set(receipt.assets.map((asset) => asset.assetId)).size !== receipt.assets.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['assets'], message: 'asset IDs must be unique' });
  if (receipt.usage.production.assetsGenerated !== receipt.assets.length || receipt.usage.production.apiCalls !== receipt.assets.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['usage', 'production'], message: 'production usage must record exactly one API call per reviewed asset' });
  }
  if (receipt.usage.production.apiCalls + receipt.usage.independentReview.apiCalls > receipt.usage.maximumApiCallsAllowed) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['usage', 'maximumApiCallsAllowed'], message: 'recorded API calls exceed the approved per-run ceiling' });
  }
});

export const legacyVisualReviewReceiptSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  receiptId: z.literal('gift-thread-v1-independent-visual-qa'),
  reviewedAt: z.string().datetime({ offset: true }),
  reviewerRole: z.literal('independent-visual-editor'),
  reviewerId: z.string().min(12),
  workflowRunId: z.string().min(8),
  verdict: z.literal('passed'),
  registryPath: z.literal('visuals/article-visuals.json'),
  registrySha256: sha256Schema,
  promptBookPath: z.literal('visuals/PROMPTS.md'),
  promptBookSha256: sha256Schema,
  scope: z.object({
    sourceAssetsReviewed: z.number().int().positive(),
    publicAssetsReviewed: z.number().int().nonnegative(),
    draftOnlyAssetsReviewed: z.number().int().nonnegative(),
    articleMappingsReviewed: z.number().int().positive(),
    productMappingsReviewed: z.number().int().positive(),
    pairMappingsReviewed: z.number().int().nonnegative()
  }).strict(),
  checks: z.object({
    sourceAndPromptProvenance: z.literal(true),
    fileIntegrity: z.literal(true),
    productContextTruth: z.literal(true),
    copyrightAndTradeDressBoundary: z.literal(true),
    accessibilitySemantics: z.literal(true),
    responsiveLayout: z.literal(true),
    draftIsolation: z.literal(true)
  }).strict(),
  blockers: z.array(z.never()).length(0),
  warnings: z.array(z.string())
}).strict();

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}

export function canonicalSha256(value) {
  return sha256(`${JSON.stringify(canonicalize(value))}\n`);
}

export function visualProductionDirectory(requestId) {
  return `visuals/production/${requestId}`;
}

export function visualReviewReceiptPath(requestId) {
  return `visuals/reviews/${requestId}.qa.v1.json`;
}

export function buildVisualPrompt({ request, asset }) {
  const roleInstruction = asset.role === 'hero'
    ? 'Make this the single clear article hero: one recipient routine that explains the whole gift idea before the caption is read.'
    : `Make this a focused pair scene for ${asset.pairId}: show the two different jobs interacting in one shared moment, while each object remains useful alone.`;
  return [
    'Draw an original wide 3:2 editorial illustration for Tips for Your Gifts. Use the founder-approved Gift-Thread visual language: gentle three-quarter top-down viewpoint, simplified geometric forms, chunky deep-evergreen ink contours, soft matte gouache fills, subtle risograph misregistration, recycled-paper grain, and a mature warm editorial tone. Use parchment cream, deep evergreen, muted mint, saffron gold, restrained coral, and occasional dusty blue. A loose saffron ribbon may connect the useful roles in the gift without becoming a logo or label.',
    roleInstruction,
    `Scene: ${asset.sceneDescription}`,
    `The intended accessible meaning is: ${asset.alt}`,
    `The editorial takeaway is: ${asset.caption}`,
    'Compose for 1536x1024 landscape output and keep the main action readable when reduced to 480x320. Use breathing room and one dominant interaction. Adults only unless the brief explicitly requires otherwise. Make hands, tools, animals, furniture, and object relationships anatomically and mechanically coherent.',
    'Illustrate generic product categories and the lived routine, never an exact SKU likeness. Do not reproduce logos, wordmarks, brand colors, packaging, book covers, game interfaces, maps, characters, copyrighted art, or another artist style. Do not add readable words, letters, numbers, labels, prices, ratings, captions, signatures, or watermarks. Do not imply first-hand product testing, performance, safety, compatibility, or preservation guarantees.',
    'Avoid photorealism, glossy 3D rendering, anime, childish sweetness, catalog arrangements, visual clutter, distorted fingers, extra hands, unsafe behavior, and unsupported recipient facts. The result must be a new composition, not a product photograph or an imitation of a named artist.',
    `Visual system: ${request.visualSystem.styleVersion}. Generation rights boundary: original composition, no brand marks, no branded packaging, no exact product-photo replication, and no artist imitation.`
  ].join('\n\n');
}

export function buildImageGenerationBody({ prompt, safetyIdentifier, styleReferenceDataUrl }) {
  return {
    model: VISUAL_PRODUCER_MODEL,
    store: false,
    safety_identifier: safetyIdentifier,
    instructions: 'Generate exactly one original editorial illustration. Use the image-generation tool once and do not return prose.',
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: `${prompt}\n\nThe attached image is a founder-approved style reference only. Preserve its visual language, not its people, objects, layout, or scene.` },
        { type: 'input_image', image_url: styleReferenceDataUrl, detail: 'high' }
      ]
    }],
    tools: [{
      type: 'image_generation',
      model: VISUAL_IMAGE_TOOL_MODEL,
      action: 'generate',
      size: '1536x1024',
      quality: 'high',
      background: 'opaque',
      output_format: 'png'
    }],
    tool_choice: { type: 'image_generation' }
  };
}

export function visualReviewJsonSchema() {
  const checks = {
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(['styleMatch', 'sceneAccuracy', 'productContextTruth', 'copyrightAndTradeDressBoundary', 'anatomyAndObjectCoherence', 'mobileLegibility', 'textAndWatermarkFree', 'safeDepiction'].map((key) => [key, { type: 'boolean' }])),
    required: ['styleMatch', 'sceneAccuracy', 'productContextTruth', 'copyrightAndTradeDressBoundary', 'anatomyAndObjectCoherence', 'mobileLegibility', 'textAndWatermarkFree', 'safeDepiction']
  };
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      schemaVersion: { type: 'string', enum: ['1.0.0'] },
      requestId: { type: 'string' },
      verdict: { type: 'string', enum: ['passed', 'failed'] },
      assets: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            assetId: { type: 'string' },
            checks,
            blockers: { type: 'array', items: { type: 'string' } },
            warnings: { type: 'array', items: { type: 'string' } }
          },
          required: ['assetId', 'checks', 'blockers', 'warnings']
        }
      },
      blockers: { type: 'array', items: { type: 'string' } },
      warnings: { type: 'array', items: { type: 'string' } }
    },
    required: ['schemaVersion', 'requestId', 'verdict', 'assets', 'blockers', 'warnings']
  };
}

export async function callOpenAiResponses({ apiKey, body, fetchImpl = fetch }) {
  if (!apiKey?.trim()) throw new Error('OPENAI_API_KEY is required');
  const response = await fetchImpl(OPENAI_RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`OpenAI Responses API returned HTTP ${response.status}; response body was not stored`);
  return response.json();
}

export function extractSingleGeneratedImage(response) {
  const calls = (response?.output ?? []).filter((entry) => entry?.type === 'image_generation_call' && typeof entry.result === 'string');
  if (calls.length !== 1) throw new Error(`Expected exactly one completed image-generation call, found ${calls.length}`);
  return { bytes: Buffer.from(calls[0].result, 'base64'), revisedPrompt: calls[0].revised_prompt ?? null };
}

export function extractStructuredOutput(response) {
  if (response?.status !== 'completed') throw new Error(`Independent visual review response did not complete (${response?.status ?? 'unknown'})`);
  const refusal = (response.output ?? []).flatMap((item) => item.content ?? []).find((entry) => entry.type === 'refusal');
  if (refusal) throw new Error('Independent visual reviewer refused the request');
  const text = response.output_text ?? (response.output ?? []).flatMap((item) => item.content ?? []).find((entry) => entry.type === 'output_text')?.text;
  if (!text) throw new Error('Independent visual reviewer returned no structured output');
  return JSON.parse(text);
}
