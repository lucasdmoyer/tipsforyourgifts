import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createPinterestPublicationPlan, sha256Json, socialPostSha256, validateSocialModel } from './lib/social-contract.mjs';

const root = process.cwd();
const config = JSON.parse(await fs.readFile(path.join(root, 'config', 'social-channels.json'), 'utf8'));
const packPath = path.join(root, 'social', 'drafts', 'gifts-for-a-golf-friend-launch.json');
const packRaw = await fs.readFile(packPath);
const basePack = { ...JSON.parse(packRaw), __sha256: createHash('sha256').update(packRaw).digest('hex') };

function copy(value) { return structuredClone(value); }
function configurePinterest(model, active = false) {
  Object.assign(model.channels[0], {
    status: active ? 'active' : 'configured',
    founderApproved: true,
    officialAccountReference: '@tipsforyourgifts',
    officialPublicationTargetId: '123456789012345678',
    configurationEvidenceUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/1',
    configuredAt: '2026-08-03T09:50:00.000Z',
    activatedAt: active ? '2026-08-03T09:55:00.000Z' : null,
    publisher: 'pinterest-api-v5',
    apiCredentialSecretName: 'PINTEREST_ACCESS_TOKEN',
    maxPostsPerWeek: 3,
    publishingEnabled: active
  });
}

const approvedPost = basePack.posts[0];
const validCandidate = {
  schemaVersion: '1.0.0', candidateId: `${approvedPost.id}-v1`, packId: basePack.packId, postId: approvedPost.id,
  platform: approvedPost.platform, packSha256: basePack.__sha256, postSha256: socialPostSha256(approvedPost),
  assetPath: '/social-media/golf-friction.png', publicUrl: 'https://tipsforyourgifts.web.app/social-media/golf-friction.png',
  contentSha256: 'b'.repeat(64), contentType: 'image/png', byteLength: 120000, width: 1024, height: 1536, aspectRatio: '2:3',
  altText: approvedPost.altText, generator: 'openai-built-in-imagegen', generatedAt: '2026-08-03T09:59:00.000Z',
  rightsPosture: 'original-ai-generated-candidate-unapproved', status: 'candidate',
  automatedChecks: { exactTextVerified: true, postBriefMatch: true, noThirdPartyLogos: true, noMerchantImagery: true, noProductClaims: true, dimensionsVerified: true },
  __sha256: 'e'.repeat(64)
};
const validAsset = {
  schemaVersion: '1.0.0', mediaAssetId: `${approvedPost.id}-image`, creativeCandidateId: validCandidate.candidateId,
  creativeCandidateRecordSha256: validCandidate.__sha256, packId: basePack.packId, postId: approvedPost.id,
  platform: approvedPost.platform, packSha256: basePack.__sha256, postSha256: socialPostSha256(approvedPost), mediaType: 'image',
  publicUrl: 'https://tipsforyourgifts.web.app/social-media/golf-friction.png', contentSha256: 'b'.repeat(64), contentType: 'image/png', byteLength: 120000,
  altText: approvedPost.altText, rightsEvidenceUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/1', founderLogin: 'lucasdmoyer',
  approvedAt: '2026-08-03T10:00:00.000Z', status: 'approved', __sha256: 'a'.repeat(64)
};
const validReceipt = {
  schemaVersion: '1.1.0', approvalId: `${approvedPost.id}-approval`, packId: basePack.packId, postId: approvedPost.id,
  platform: approvedPost.platform, packSha256: basePack.__sha256, postSha256: socialPostSha256(approvedPost),
  mediaAssetId: validAsset.mediaAssetId, mediaAssetRecordSha256: validAsset.__sha256, founderLogin: 'lucasdmoyer',
  approvedAt: '2026-08-03T10:01:00.000Z', rightsEvidenceUrl: validAsset.rightsEvidenceUrl,
  approvals: { originalOrLicensedAsset: true, copy: true, destination: true, disclosure: true }, status: 'approved', externalPostId: null
};

function expectFailure(label, mutate, expectedText) {
  const model = copy(config);
  const packs = [copy(basePack)];
  const receipts = [];
  const assets = [];
  const publications = [];
  const candidates = [];
  mutate(model, packs, receipts, assets, publications, candidates);
  const issues = validateSocialModel(model, packs, receipts, assets, publications, candidates);
  if (issues.length === 0 || !issues.join('\n').toLowerCase().includes(expectedText.toLowerCase())) {
    throw new Error(`${label}: expected ${JSON.stringify(expectedText)}, received ${JSON.stringify(issues)}`);
  }
}

const cleanIssues = validateSocialModel(config, [basePack], [], [], []);
if (cleanIssues.length > 0) throw new Error(`base social model should pass: ${cleanIssues.join('; ')}`);

const configuredModel = copy(config);
configurePinterest(configuredModel);
const positiveReceiptIssues = validateSocialModel(configuredModel, [basePack], [validReceipt], [validAsset], [], [validCandidate]);
if (positiveReceiptIssues.length > 0) throw new Error(`valid media and content receipts should pass: ${positiveReceiptIssues.join('; ')}`);

const activeModel = copy(config);
configurePinterest(activeModel, true);
const plan = createPinterestPublicationPlan({ config: activeModel, packs: [basePack], approvals: [validReceipt], assets: [validAsset], candidates: [validCandidate], postId: approvedPost.id });
if (plan.endpoint !== 'https://api.pinterest.com/v5/pins' || plan.networkCallsPlanned !== 2 || plan.request.media_source.source_type !== 'image_url') {
  throw new Error('valid Pinterest plan must use the official v5 endpoint and approved image_url asset');
}

expectFailure('rejects duplicate channel priorities', (model) => { model.channels[1].priority = 1; }, 'duplicate channel priority');
expectFailure('not-connected channels cannot carry setup', (model) => { model.channels[0].founderApproved = true; }, 'not-connected channel cannot contain');
expectFailure('active channels require publishing authorization', (model) => {
  configurePinterest(model, true); model.channels[0].publishingEnabled = false;
}, 'active channel requires publishingenabled');
expectFailure('rejects unallowlisted formats', (_model, packs) => { packs[0].posts[0].format = 'invented-format'; }, 'not allowlisted');
expectFailure('draft packs cannot self-assert publication', (_model, packs) => { packs[0].posts[0].externalPostId = '123'; }, 'draft packs are immutable');
expectFailure('approval requires configured channel', (_model, _packs, receipts, assets, _publications, candidates) => { receipts.push(copy(validReceipt)); assets.push(copy(validAsset)); candidates.push(copy(validCandidate)); }, 'requires a founder-approved configured channel');
expectFailure('approval hashes are immutable', (model, _packs, receipts, assets, _publications, candidates) => {
  configurePinterest(model); const receipt = copy(validReceipt); receipt.packSha256 = '0'.repeat(64); receipts.push(receipt); assets.push(copy(validAsset)); candidates.push(copy(validCandidate));
}, 'source pack changed');
expectFailure('approval requires configured founder identity', (model, _packs, receipts, assets, _publications, candidates) => {
  configurePinterest(model); const receipt = copy(validReceipt); receipt.founderLogin = 'someone-else'; receipts.push(receipt); assets.push(copy(validAsset)); candidates.push(copy(validCandidate));
}, 'configured founder');
expectFailure('rejects private media hosts', (_model, _packs, _receipts, assets, _publications, candidates) => {
  const asset = copy(validAsset); asset.publicUrl = 'https://127.0.0.1/image.png'; assets.push(asset); candidates.push(copy(validCandidate));
}, 'public host');
expectFailure('content approval binds exact media record', (model, _packs, receipts, assets, _publications, candidates) => {
  configurePinterest(model); const receipt = copy(validReceipt); receipt.mediaAssetRecordSha256 = 'c'.repeat(64); receipts.push(receipt); assets.push(copy(validAsset)); candidates.push(copy(validCandidate));
}, 'media asset record changed');
expectFailure('media approval binds exact creative candidate', (_model, _packs, _receipts, assets, _publications, candidates) => {
  const asset = copy(validAsset); asset.creativeCandidateRecordSha256 = 'c'.repeat(64); assets.push(asset); candidates.push(copy(validCandidate));
}, 'creative candidate record changed');

try {
  createPinterestPublicationPlan({ config: activeModel, packs: [basePack], approvals: [], assets: [validAsset], candidates: [validCandidate], postId: approvedPost.id });
  throw new Error('missing approval plan should fail');
} catch (error) { if (!String(error.message).includes('approval is missing')) throw error; }

const publication = {
  schemaVersion: '1.0.0', publicationId: `${approvedPost.id}-publication`, approvalId: validReceipt.approvalId, postId: approvedPost.id,
  packId: basePack.packId, platform: 'pinterest', packSha256: basePack.__sha256, postSha256: socialPostSha256(approvedPost),
  mediaAssetId: validAsset.mediaAssetId, mediaAssetRecordSha256: validAsset.__sha256, mediaContentSha256: validAsset.contentSha256,
  channelSha256: sha256Json(activeModel.channels[0]), requestSha256: plan.requestSha256, responseSha256: 'd'.repeat(64),
  endpoint: plan.endpoint, httpStatus: 201, externalPostId: '987654321', externalPostUrl: 'https://www.pinterest.com/pin/987654321/',
  publishedAt: '2026-08-03T10:02:00.000Z', status: 'published'
};
const publishedIssues = validateSocialModel(activeModel, [basePack], [validReceipt], [validAsset], [publication], [validCandidate]);
if (publishedIssues.length > 0) throw new Error(`valid publication receipt should pass: ${publishedIssues.join('; ')}`);
try {
  createPinterestPublicationPlan({ config: activeModel, packs: [basePack], approvals: [validReceipt], assets: [validAsset], publications: [publication], candidates: [validCandidate], postId: approvedPost.id });
  throw new Error('duplicate publication plan should fail');
} catch (error) { if (!String(error.message).includes('already exists')) throw error; }

expectFailure('publication requires a verifiable external ID', (model, _packs, receipts, assets, publications, candidates) => {
  configurePinterest(model, true); receipts.push(copy(validReceipt)); assets.push(copy(validAsset)); candidates.push(copy(validCandidate)); const invalid = copy(publication); invalid.externalPostId = ''; publications.push(invalid);
}, 'externalPostId');

console.log(JSON.stringify({ socialNegativeGateTests: 'passed', checks: 13, validCreativeCandidateCheck: 'passed', validMediaReceiptCheck: 'passed', validContentReceiptCheck: 'passed', dryRunPlanCheck: 'passed', validPublicationReceiptCheck: 'passed' }, null, 2));
