import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  buildImageGenerationBody,
  buildVisualPrompt,
  callOpenAiResponses,
  extractSingleGeneratedImage,
  sha256,
  visualProductionDirectory,
  visualProductionManifestSchema,
  VISUAL_IMAGE_TOOL_MODEL,
  VISUAL_PRODUCER_MODEL
} from './lib/visual-production-contract.mjs';
import { loadVisualProductionTarget } from './lib/visual-production-store.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const requestId = args['request-id'];
if (!requestId) throw new Error('Usage: node scripts/generate-visual-production-assets.mjs --request-id=<id>');
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) throw new Error('OPENAI_API_KEY is required for visual production');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { target } = await loadVisualProductionTarget(root, requestId);
const request = target.requestRecord.data;
const relativeDirectory = visualProductionDirectory(requestId);
const productionDirectory = path.join(root, relativeDirectory);
try {
  await fs.access(productionDirectory);
  throw new Error(`Visual production directory already exists: ${relativeDirectory}`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const workflowRunId = process.env.GITHUB_RUN_ID ?? args['workflow-run-id'];
const workflowRunAttempt = Number(process.env.GITHUB_RUN_ATTEMPT ?? args['workflow-run-attempt'] ?? '1');
if (!/^[1-9]\d*$/.test(workflowRunId ?? '') || !Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) throw new Error('Visual production needs a positive GitHub workflow run ID and attempt');
const generatedAt = args['generated-at'] ?? new Date().toISOString();
const styleReferencePath = 'visuals/sources/read-it-big-history.png';
const styleReferenceRaw = await fs.readFile(path.join(root, styleReferencePath));
const styleReferenceDataUrl = `data:image/png;base64,${styleReferenceRaw.toString('base64')}`;
const safetyIdentifier = sha256(`tipsforyourgifts:${requestId}`);

async function writeFileRecord(relativePath, bytes, width, height) {
  const absolutePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes, { flag: 'wx' });
  return { path: relativePath, sha256: sha256(bytes), bytes: bytes.length, width, height };
}

async function webpWithinBudget(input, width, height, budget) {
  for (let quality = 78; quality >= 38; quality -= 4) {
    const output = await sharp(input).resize(width, height, { fit: 'fill' }).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
    if (output.length <= budget) return output;
  }
  throw new Error(`Could not encode ${width}x${height} WebP within ${budget} bytes`);
}

await fs.mkdir(path.join(productionDirectory, 'sources'), { recursive: true });
await fs.mkdir(path.join(productionDirectory, 'delivery'), { recursive: true });
const generatedAssets = [];

for (const asset of request.assets) {
  const prompt = buildVisualPrompt({ request, asset });
  const response = await callOpenAiResponses({
    apiKey,
    body: buildImageGenerationBody({ prompt, safetyIdentifier, styleReferenceDataUrl })
  });
  const generated = extractSingleGeneratedImage(response);
  const metadata = await sharp(generated.bytes).metadata();
  if (metadata.format !== 'png' || metadata.width !== 1536 || metadata.height !== 1024) throw new Error(`${asset.assetId}: generated source must be a 1536x1024 PNG`);

  const source = await writeFileRecord(`${relativeDirectory}/sources/${asset.assetId}.png`, generated.bytes, 1536, 1024);
  const masterBytes = await webpWithinBudget(generated.bytes, 1536, 1024, 600 * 1024);
  const delivery = await writeFileRecord(`${relativeDirectory}/delivery/${asset.assetId}.webp`, masterBytes, 1536, 1024);
  const derivativeSpecs = [
    { label: '480x320', width: 480, height: 320, budget: 50 * 1024 },
    { label: '768x512', width: 768, height: 512, budget: 80 * 1024 },
    { label: '1200x800', width: 1200, height: 800, budget: 140 * 1024 }
  ];
  const derivatives = [];
  for (const spec of derivativeSpecs) {
    const bytes = await webpWithinBudget(generated.bytes, spec.width, spec.height, spec.budget);
    const suffix = spec.width;
    derivatives.push({
      label: spec.label,
      ...await writeFileRecord(`${relativeDirectory}/delivery/${asset.assetId}-${suffix}.webp`, bytes, spec.width, spec.height)
    });
  }
  generatedAssets.push({
    assetId: asset.assetId,
    role: asset.role,
    pairId: asset.pairId,
    productIds: asset.productIds,
    prompt,
    promptSha256: sha256(prompt),
    revisedPrompt: generated.revisedPrompt,
    source,
    delivery,
    derivatives,
    usage: {
      totalTokens: response.usage?.total_tokens ?? null,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null
    }
  });
}

const manifest = visualProductionManifestSchema.parse({
  schemaVersion: '1.0.0',
  requestId,
  status: 'generated_awaiting_independent_review',
  generatedAt,
  generatedBy: {
    workflow: 'visual-production.yml',
    workflowRunId,
    workflowRunAttempt,
    model: VISUAL_PRODUCER_MODEL,
    imageToolModel: VISUAL_IMAGE_TOOL_MODEL
  },
  bindings: {
    missionId: target.missionRecord.data.missionId,
    missionPath: target.missionRecord.path,
    missionSha256: target.missionRecord.sha256,
    requestPath: target.requestRecord.path,
    requestSha256: target.requestRecord.sha256,
    runId: target.runRecord.data.runId,
    runPath: target.runRecord.path,
    runSha256: target.runRecord.sha256,
    articleSlug: request.articleSlug,
    articlePath: target.articleRecord.path,
    articleSha256: target.articleRecord.sha256,
    baseRegistryPath: target.registryRecord.path,
    baseRegistrySha256: target.registryRecord.sha256,
    basePromptBookPath: target.promptBookRecord.path,
    basePromptBookSha256: target.promptBookRecord.sha256,
    styleReferencePath,
    styleReferenceSha256: sha256(styleReferenceRaw)
  },
  assets: generatedAssets,
  safety: {
    safetyIdentifierSha256: sha256(safetyIdentifier),
    rawApiResponseStored: false,
    secretValueStored: false,
    externalSourceImagesUsed: false
  }
});
const manifestRaw = `${JSON.stringify(manifest, null, 2)}\n`;
await fs.writeFile(path.join(productionDirectory, 'manifest.json'), manifestRaw, { flag: 'wx' });
console.log(JSON.stringify({
  requestId,
  missionId: manifest.bindings.missionId,
  articleSlug: manifest.bindings.articleSlug,
  assetsGenerated: manifest.assets.length,
  manifestPath: `${relativeDirectory}/manifest.json`,
  manifestSha256: sha256(manifestRaw),
  rawApiResponseStored: false,
  secretValueStored: false,
  sourcePromoted: false,
  productionAuthorized: false
}, null, 2));
