import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  callOpenAiResponses,
  extractStructuredOutput,
  sha256,
  visualProductionDirectory,
  visualProductionManifestSchema,
  visualReviewFindingsSchema,
  visualReviewJsonSchema,
  visualReviewModelOutputSchema,
  VISUAL_REVIEW_MODEL
} from './lib/visual-production-contract.mjs';
import { loadVisualProductionTarget } from './lib/visual-production-store.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const requestId = args['request-id'];
if (!requestId) throw new Error('Usage: node scripts/review-visual-production-assets.mjs --request-id=<id>');
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) throw new Error('OPENAI_API_KEY is required for independent visual review');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { target } = await loadVisualProductionTarget(root, requestId);
const relativeDirectory = visualProductionDirectory(requestId);
const manifestPath = `${relativeDirectory}/manifest.json`;
const manifestRaw = await fs.readFile(path.join(root, manifestPath));
const manifest = visualProductionManifestSchema.parse(JSON.parse(manifestRaw));
if (manifest.requestId !== requestId) throw new Error('Manifest request ID differs from the requested target');
for (const [key, actual] of [
  ['requestSha256', target.requestRecord.sha256],
  ['missionSha256', target.missionRecord.sha256],
  ['runSha256', target.runRecord.sha256],
  ['articleSha256', target.articleRecord.sha256],
  ['baseRegistrySha256', target.registryRecord.sha256],
  ['basePromptBookSha256', target.promptBookRecord.sha256]
]) {
  if (manifest.bindings[key] !== actual) throw new Error(`Manifest ${key} is stale`);
}

async function verifiedDataUrl(record, expectedFormat) {
  const bytes = await fs.readFile(path.join(root, record.path));
  if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) throw new Error(`${record.path}: file digest or byte count differs from the manifest`);
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== expectedFormat || metadata.width !== record.width || metadata.height !== record.height) throw new Error(`${record.path}: file format or dimensions differ from the manifest`);
  return `data:image/${expectedFormat};base64,${bytes.toString('base64')}`;
}

const expectedAssets = new Map(target.requestRecord.data.assets.map((asset) => [asset.assetId, asset]));
const content = [{
  type: 'input_text',
  text: [
    `Independently review visual request ${requestId}.`,
    'Return a strict pass only when every image accurately depicts the exact brief, remains generic rather than copying product trade dress or copyrighted art, has coherent anatomy and object relationships, is legible at mobile size, contains no readable text or watermark, and is safe.',
    'Treat warnings as non-blocking observations only. Any uncertainty about a required scene fact, misleading product implication, brand/copyright boundary, distorted hands or tools, unreadable mobile composition, text, watermark, or unsafe behavior must fail the affected check and create a concrete blocker.',
    'The source and 480-pixel derivative for each asset follow in matching order.'
  ].join('\n')
}];
for (const asset of manifest.assets) {
  const expected = expectedAssets.get(asset.assetId);
  if (!expected) throw new Error(`${asset.assetId}: generated asset is not in the request`);
  if (asset.role !== expected.role || asset.pairId !== expected.pairId || JSON.stringify(asset.productIds) !== JSON.stringify(expected.productIds)) throw new Error(`${asset.assetId}: generated asset identity differs from the request`);
  const mobile = asset.derivatives.find((entry) => entry.label === '480x320');
  content.push({ type: 'input_text', text: `Asset ${asset.assetId}\nRole: ${asset.role}\nScene: ${expected.sceneDescription}\nAlt intent: ${expected.alt}\nCaption intent: ${expected.caption}` });
  content.push({ type: 'input_image', image_url: await verifiedDataUrl(asset.source, 'png'), detail: 'high' });
  content.push({ type: 'input_image', image_url: await verifiedDataUrl(mobile, 'webp'), detail: 'high' });
  await verifiedDataUrl(asset.delivery, 'webp');
  for (const derivative of asset.derivatives.filter((entry) => entry !== mobile)) await verifiedDataUrl(derivative, 'webp');
}
if (manifest.assets.length !== expectedAssets.size) throw new Error('Generated asset count differs from the request');

const safetyIdentifier = sha256(`tipsforyourgifts:visual-review:${requestId}`);
const response = await callOpenAiResponses({
  apiKey,
  body: {
    model: VISUAL_REVIEW_MODEL,
    store: false,
    safety_identifier: safetyIdentifier,
    instructions: 'You are the independent visual editor. You did not create these images. Inspect every image, follow the strict pass standard, and return only the requested JSON schema.',
    input: [{ role: 'user', content }],
    text: {
      verbosity: 'low',
      format: { type: 'json_schema', name: 'visual_review', strict: true, schema: visualReviewJsonSchema() }
    }
  }
});
const modelOutput = visualReviewModelOutputSchema.parse(extractStructuredOutput(response));
if (modelOutput.requestId !== requestId) throw new Error('Independent review returned a different request ID');
const reviewedIds = modelOutput.assets.map((asset) => asset.assetId);
if (new Set(reviewedIds).size !== reviewedIds.length || reviewedIds.length !== manifest.assets.length || reviewedIds.some((id) => !expectedAssets.has(id))) throw new Error('Independent review did not cover the exact requested asset set');

const workflowRunId = process.env.GITHUB_RUN_ID ?? args['workflow-run-id'];
const workflowRunAttempt = Number(process.env.GITHUB_RUN_ATTEMPT ?? args['workflow-run-attempt'] ?? '1');
if (!/^[1-9]\d*$/.test(workflowRunId ?? '') || !Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) throw new Error('Visual review needs a positive GitHub workflow run ID and attempt');
const findings = visualReviewFindingsSchema.parse({
  schemaVersion: '1.0.0',
  requestId,
  manifestPath,
  manifestSha256: sha256(manifestRaw),
  reviewedAt: args['reviewed-at'] ?? new Date().toISOString(),
  reviewer: {
    role: 'independent-visual-editor',
    model: VISUAL_REVIEW_MODEL,
    workflow: 'visual-production.yml',
    workflowRunId,
    workflowRunAttempt,
    responseId: response.id
  },
  verdict: modelOutput.verdict,
  assets: modelOutput.assets,
  blockers: modelOutput.blockers,
  warnings: modelOutput.warnings,
  privacy: { rawApiResponseStored: false, secretValueStored: false, personalDataSent: false }
});
const findingsPath = path.join(root, relativeDirectory, 'visual-review-findings.json');
await fs.writeFile(findingsPath, `${JSON.stringify(findings, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ requestId, verdict: findings.verdict, assetsReviewed: findings.assets.length, findingsPath: `${relativeDirectory}/visual-review-findings.json`, sourcePromoted: false, productionAuthorized: false }, null, 2));
