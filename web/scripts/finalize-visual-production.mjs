import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  canonicalSha256,
  sha256,
  visualProductionDirectory,
  visualProductionManifestSchema,
  visualReviewFindingsSchema,
  visualReviewReceiptPath,
  visualReviewReceiptSchema
} from './lib/visual-production-contract.mjs';
import { loadVisualProductionTarget } from './lib/visual-production-store.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const requestId = args['request-id'];
if (!requestId) throw new Error('Usage: node scripts/finalize-visual-production.mjs --request-id=<id>');
if (process.env.OPENAI_API_KEY) throw new Error('The detached visual writer must not receive OPENAI_API_KEY');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { target } = await loadVisualProductionTarget(root, requestId);
const relativeDirectory = visualProductionDirectory(requestId);
const manifestRaw = await fs.readFile(path.join(root, relativeDirectory, 'manifest.json'));
const findingsRaw = await fs.readFile(path.join(root, relativeDirectory, 'visual-review-findings.json'));
const manifest = visualProductionManifestSchema.parse(JSON.parse(manifestRaw));
const findings = visualReviewFindingsSchema.parse(JSON.parse(findingsRaw));
if (findings.verdict !== 'passed' || findings.blockers.length > 0 || findings.assets.some((asset) => asset.blockers.length > 0 || Object.values(asset.checks).some((value) => !value))) throw new Error('Only an exact, clean independent visual pass can promote source assets');
if (findings.manifestSha256 !== sha256(manifestRaw) || findings.requestId !== requestId || manifest.requestId !== requestId) throw new Error('Visual findings are not bound to this exact manifest');
for (const [key, actual] of [
  ['requestSha256', target.requestRecord.sha256],
  ['missionSha256', target.missionRecord.sha256],
  ['runSha256', target.runRecord.sha256],
  ['articleSha256', target.articleRecord.sha256],
  ['baseRegistrySha256', target.registryRecord.sha256],
  ['basePromptBookSha256', target.promptBookRecord.sha256]
]) if (manifest.bindings[key] !== actual) throw new Error(`Visual production ${key} is stale`);

const request = target.requestRecord.data;
const requestAssets = new Map(request.assets.map((asset) => [asset.assetId, asset]));
const reviewedAssets = new Map(findings.assets.map((asset) => [asset.assetId, asset]));
const registry = structuredClone(target.registryRecord.data);
if ((registry.articles ?? []).some((entry) => entry.slug === request.articleSlug)) throw new Error('Article already has a visual mapping');
const receiptPath = visualReviewReceiptPath(requestId);
const promoted = [];
const pairSceneIds = {};

async function copyVerified(record, destinationRelativePath) {
  const bytes = await fs.readFile(path.join(root, record.path));
  if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) throw new Error(`${record.path}: staging file changed after review`);
  const destination = path.join(root, destinationRelativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try { await fs.access(destination); throw new Error(`Refusing to overwrite ${destinationRelativePath}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.copyFile(path.join(root, record.path), destination);
  return { path: destinationRelativePath, sha256: record.sha256 };
}

for (const generated of manifest.assets) {
  const brief = requestAssets.get(generated.assetId);
  const review = reviewedAssets.get(generated.assetId);
  if (!brief || !review) throw new Error(`${generated.assetId}: request or review coverage is missing`);
  const source = await copyVerified(generated.source, `visuals/sources/${generated.assetId}.png`);
  const publicBase = brief.role === 'hero' ? 'hero' : brief.pairId;
  if (!publicBase) throw new Error(`${generated.assetId}: pair scene has no pair ID`);
  const publicDirectory = `public/blog-images/${request.articleSlug}`;
  const delivery = await copyVerified(generated.delivery, `${publicDirectory}/${publicBase}.webp`);
  const responsive = [];
  for (const derivative of generated.derivatives) {
    const suffix = derivative.label.split('x')[0];
    responsive.push(await copyVerified(derivative, `${publicDirectory}/${publicBase}-${suffix}.webp`));
  }
  const assetRecord = {
    id: generated.assetId,
    src: `/${delivery.path.replace(/^public\//, '')}`,
    alt: brief.alt,
    caption: brief.caption,
    sourceSha256: source.sha256,
    fileSha256: delivery.sha256,
    promptSummary: brief.sceneDescription,
    reviewReceiptPath: receiptPath
  };
  registry.assets.push(assetRecord);
  if (brief.role === 'pair_scene') pairSceneIds[brief.pairId] = generated.assetId;
  promoted.push({ generated, brief, source, delivery, responsive, assetRecord });
}
const hero = promoted.find((entry) => entry.brief.role === 'hero');
if (!hero || promoted.filter((entry) => entry.brief.role === 'hero').length !== 1) throw new Error('Visual request must promote exactly one hero');
const articleMapping = { slug: request.articleSlug, heroId: hero.generated.assetId };
if (Object.keys(pairSceneIds).length > 0) articleMapping.pairSceneIds = Object.fromEntries(Object.entries(pairSceneIds).sort(([left], [right]) => left.localeCompare(right)));
registry.articles.push(articleMapping);

let promptBook = target.promptBookRecord.raw.toString('utf8').replace(/\s+$/, '');
for (const entry of promoted) promptBook += `\n\n## ${entry.generated.assetId}\n\n${entry.generated.prompt}`;
promptBook += '\n';
const registryRaw = `${JSON.stringify(registry, null, 2)}\n`;
const reviewedAt = findings.reviewedAt;
const receipt = visualReviewReceiptSchema.parse({
  schemaVersion: '1.0.0',
  receiptId: `${requestId}-visual-qa-v1`,
  receiptRevision: 1,
  requestId,
  runId: request.runId,
  missionId: target.missionRecord.data.missionId,
  articleSlug: request.articleSlug,
  reviewedAt,
  reviewerRole: 'independent-visual-editor',
  reviewerId: `openai-responses-${findings.reviewer.responseId}`,
  producerModel: manifest.generatedBy.model,
  imageToolModel: manifest.generatedBy.imageToolModel,
  reviewerModel: findings.reviewer.model,
  workflowName: 'visual-production.yml',
  workflowRunId: findings.reviewer.workflowRunId,
  verdict: 'passed',
  requestPath: target.requestRecord.path,
  requestSha256: target.requestRecord.sha256,
  manifestSha256: sha256(manifestRaw),
  findingsSha256: sha256(findingsRaw),
  registryPath: 'visuals/article-visuals.json',
  registrySha256: sha256(registryRaw),
  promptBookPath: 'visuals/PROMPTS.md',
  promptBookSha256: sha256(promptBook),
  articleMappingSha256: canonicalSha256(articleMapping),
  assets: promoted.map((entry) => ({
    assetId: entry.generated.assetId,
    assetRecordSha256: canonicalSha256(entry.assetRecord),
    promptSectionSha256: sha256(`${entry.generated.prompt}\n`),
    sourcePath: entry.source.path,
    sourceSha256: entry.source.sha256,
    publicPaths: [entry.delivery.path, ...entry.responsive.map((item) => item.path)],
    publicSha256: [entry.delivery.sha256, ...entry.responsive.map((item) => item.sha256)]
  })),
  checks: {
    styleMatch: true,
    sceneAccuracy: true,
    productContextTruth: true,
    copyrightAndTradeDressBoundary: true,
    anatomyAndObjectCoherence: true,
    mobileLegibility: true,
    textAndWatermarkFree: true,
    safeDepiction: true,
    sourceAndPromptProvenance: true,
    fileIntegrity: true,
    responsiveDerivatives: true,
    draftIsolationPreservedUntilPass: true
  },
  blockers: [],
  warnings: findings.warnings,
  sourcePromotionAuthorized: true,
  productionDeploymentAuthorized: false
});

await fs.mkdir(path.join(root, 'visuals', 'reviews'), { recursive: true });
await fs.writeFile(path.join(root, receiptPath), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
await fs.writeFile(path.join(root, 'visuals', 'article-visuals.json'), registryRaw);
await fs.writeFile(path.join(root, 'visuals', 'PROMPTS.md'), promptBook);
await fs.unlink(path.join(root, target.requestRecord.path));
await fs.rm(path.join(root, relativeDirectory), { recursive: true, force: true });
console.log(JSON.stringify({ requestId, articleSlug: request.articleSlug, assetsPromoted: promoted.length, receiptPath, requestRemoved: true, productionAuthorized: false }, null, 2));
