import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  buildSocialCreativePrompt,
  buildSocialImageGenerationBody,
  callOpenAiResponses,
  extractSingleGeneratedImage,
  loadSocialCreativeTarget,
  sha256,
  socialCreativeProductionDirectory,
  socialCreativeProductionManifestSchema,
  SOCIAL_CREATIVE_IMAGE_MODEL,
  SOCIAL_CREATIVE_PRODUCER_MODEL
} from './lib/social-creative-production-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const postId = args['post-id'];
if (!postId) throw new Error('Usage: node scripts/generate-social-creative-candidate.mjs --post-id=<id>');
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) throw new Error('OPENAI_API_KEY is required for social creative production');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = await loadSocialCreativeTarget(root, { postId });
if (!target) throw new Error(`${postId}: eligible social creative target is missing`);
const relativeDirectory = socialCreativeProductionDirectory(target.candidateId);
const productionDirectory = path.join(root, relativeDirectory);
try { await fs.access(productionDirectory); throw new Error(`Production directory already exists: ${relativeDirectory}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const workflowRunId = process.env.GITHUB_RUN_ID ?? args['workflow-run-id'];
const workflowRunAttempt = Number(process.env.GITHUB_RUN_ATTEMPT ?? args['workflow-run-attempt'] ?? '1');
if (!/^[1-9]\d*$/.test(workflowRunId ?? '') || !Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) throw new Error('Social creative production needs a positive workflow run ID and attempt');
const styleReferenceRaw = await fs.readFile(path.join(root, 'visuals/sources/read-it-big-history.png'));
const prompt = buildSocialCreativePrompt({ target });
const safetyIdentifier = sha256(`tipsforyourgifts:social-creative:${target.candidateId}`);
const response = await callOpenAiResponses({
  apiKey,
  body: buildSocialImageGenerationBody({ prompt, safetyIdentifier, styleReferenceDataUrl: `data:image/png;base64,${styleReferenceRaw.toString('base64')}` })
});
const generated = extractSingleGeneratedImage(response);
const metadata = await sharp(generated.bytes).metadata();
if (metadata.format !== 'png' || metadata.width !== 1024 || metadata.height !== 1536) throw new Error('Generated social source must be a 1024x1536 PNG');

let delivery = null;
for (let quality = 88; quality >= 44; quality -= 4) {
  const encoded = await sharp(generated.bytes).jpeg({ quality, mozjpeg: true }).toBuffer();
  if (encoded.length <= 1_000_000) { delivery = encoded; break; }
}
if (!delivery) throw new Error('Could not encode the social creative within the 1,000,000-byte budget');
await fs.mkdir(productionDirectory, { recursive: true });
const sourcePath = `${relativeDirectory}/source.png`;
const deliveryPath = `${relativeDirectory}/delivery.jpg`;
await fs.writeFile(path.join(root, sourcePath), generated.bytes, { flag: 'wx' });
await fs.writeFile(path.join(root, deliveryPath), delivery, { flag: 'wx' });
const generatedAt = args['generated-at'] ?? new Date().toISOString();
const manifest = socialCreativeProductionManifestSchema.parse({
  schemaVersion: '1.0.0',
  candidateId: target.candidateId,
  status: 'generated_awaiting_independent_review',
  generatedAt,
  generatedBy: { workflow: 'social-creative-production.yml', workflowRunId, workflowRunAttempt, model: SOCIAL_CREATIVE_PRODUCER_MODEL, imageToolModel: SOCIAL_CREATIVE_IMAGE_MODEL },
  bindings: {
    packId: target.pack.packId,
    packPath: target.packRecord.path,
    packSha256: target.packRecord.sha256,
    postId: target.post.id,
    postSha256: target.postSha256,
    platform: target.post.platform,
    articleSlug: target.pack.articleSlug
  },
  prompt,
  promptSha256: sha256(prompt),
  revisedPrompt: generated.revisedPrompt,
  source: { path: sourcePath, sha256: sha256(generated.bytes), bytes: generated.bytes.length, width: 1024, height: 1536, contentType: 'image/png' },
  delivery: { path: deliveryPath, sha256: sha256(delivery), bytes: delivery.length, width: 1024, height: 1536, contentType: 'image/jpeg' },
  usage: { totalTokens: response.usage?.total_tokens ?? null, inputTokens: response.usage?.input_tokens ?? null, outputTokens: response.usage?.output_tokens ?? null },
  safety: { safetyIdentifierSha256: sha256(safetyIdentifier), rawApiResponseStored: false, secretValueStored: false, externalSourceImagesUsed: false, personalDataSent: false }
});
const manifestRaw = `${JSON.stringify(manifest, null, 2)}\n`;
await fs.writeFile(path.join(productionDirectory, 'manifest.json'), manifestRaw, { flag: 'wx' });
console.log(JSON.stringify({ candidateId: manifest.candidateId, postId, manifestPath: `${relativeDirectory}/manifest.json`, manifestSha256: sha256(manifestRaw), sourcePromoted: false, mediaApproved: false, externalPostCreated: false }, null, 2));
