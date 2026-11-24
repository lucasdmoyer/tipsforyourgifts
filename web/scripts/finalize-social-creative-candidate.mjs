import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { socialCreativeCandidateSchema } from './lib/social-contract.mjs';
import {
  loadSocialCreativeTarget,
  sha256,
  socialCreativeProductionDirectory,
  socialCreativeProductionManifestSchema,
  socialCreativeReviewFindingsSchema
} from './lib/social-creative-production-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => { const [key, ...rest] = value.replace(/^--/, '').split('='); return [key, rest.join('=')]; }));
const postId = args['post-id'];
if (!postId) throw new Error('Usage: node scripts/finalize-social-creative-candidate.mjs --post-id=<id>');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = await loadSocialCreativeTarget(root, { postId });
if (!target) throw new Error(`${postId}: eligible social creative target is missing`);
const directory = socialCreativeProductionDirectory(target.candidateId);
const manifestRaw = await fs.readFile(path.join(root, directory, 'manifest.json'));
const findingsRaw = await fs.readFile(path.join(root, directory, 'review-findings.json'));
const manifest = socialCreativeProductionManifestSchema.parse(JSON.parse(manifestRaw));
const findings = socialCreativeReviewFindingsSchema.parse(JSON.parse(findingsRaw));
if (findings.verdict !== 'passed' || Object.values(findings.checks).some((value) => !value) || findings.blockers.length > 0) throw new Error('Only an independently reviewed pass can become a creative candidate');
if (manifest.bindings.packSha256 !== target.packRecord.sha256 || manifest.bindings.postSha256 !== target.postSha256 || findings.manifestSha256 !== sha256(manifestRaw)) throw new Error('Social creative source or review binding is stale');
const delivery = await fs.readFile(path.join(root, manifest.delivery.path));
const metadata = await sharp(delivery).metadata();
if (sha256(delivery) !== manifest.delivery.sha256 || delivery.length !== manifest.delivery.bytes || metadata.format !== 'jpeg' || metadata.width !== 1024 || metadata.height !== 1536) throw new Error('Reviewed delivery file differs from its manifest');

const assetPath = `/social-media/${target.candidateId}.jpg`;
const publicPath = path.join(root, 'public', assetPath.slice(1));
const candidatePath = path.join(root, 'social', 'candidates', `${target.candidateId}.json`);
for (const destination of [publicPath, candidatePath]) {
  try { await fs.access(destination); throw new Error(`Refusing to overwrite existing candidate output: ${path.relative(root, destination)}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const candidate = socialCreativeCandidateSchema.parse({
  schemaVersion: '1.0.0',
  candidateId: target.candidateId,
  packId: target.pack.packId,
  postId: target.post.id,
  platform: target.post.platform,
  packSha256: target.packRecord.sha256,
  postSha256: target.postSha256,
  assetPath,
  publicUrl: `https://tipsforyourgifts.web.app${assetPath}`,
  contentSha256: sha256(delivery),
  contentType: 'image/jpeg',
  byteLength: delivery.length,
  width: 1024,
  height: 1536,
  aspectRatio: '2:3',
  altText: target.post.altText,
  generator: 'openai-built-in-imagegen',
  generatedAt: manifest.generatedAt,
  rightsPosture: 'original-ai-generated-candidate-unapproved',
  status: 'candidate',
  automatedChecks: {
    exactTextVerified: findings.checks.textAndWatermarkFree,
    postBriefMatch: findings.checks.briefFidelity && findings.checks.sourcePostAccuracy,
    noThirdPartyLogos: findings.checks.noThirdPartyLogos,
    noMerchantImagery: findings.checks.noMerchantImagery,
    noProductClaims: findings.checks.noUnsupportedProductClaims,
    dimensionsVerified: true
  }
});
await fs.mkdir(path.dirname(publicPath), { recursive: true });
await fs.mkdir(path.dirname(candidatePath), { recursive: true });
await fs.writeFile(publicPath, delivery, { flag: 'wx' });
await fs.writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, { flag: 'wx' });
await fs.rm(path.join(root, directory), { recursive: true, force: true });
console.log(JSON.stringify({ candidateId: candidate.candidateId, candidatePath: `social/candidates/${candidate.candidateId}.json`, assetPath: `public${assetPath}`, mediaApproved: false, contentApproved: false, externalPostCreated: false }, null, 2));
