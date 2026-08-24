import { createHash } from 'node:crypto';
import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const httpsUrl = z.string().url().refine((value) => value.startsWith('https://'), 'must use HTTPS');
const externalId = z.string().min(2).max(160).regex(/^[A-Za-z0-9._:-]+$/);

function isPrivateIpv4(hostname) {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
}

export function assertSafePublicHttpsUrl(value, label = 'URL') {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:') throw new Error(`${label} must use HTTPS`);
  if (url.username || url.password) throw new Error(`${label} cannot contain embedded credentials`);
  if (url.search) throw new Error(`${label} cannot contain query parameters or signed secrets`);
  if (url.hash) throw new Error(`${label} cannot contain a fragment`);
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === '::1' || isPrivateIpv4(hostname)) {
    throw new Error(`${label} must use a public host`);
  }
  return url;
}

export async function readResponseBytesCapped(response, maximumBytes = 20_000_000) {
  if (!response.body) throw new Error('Media response did not include a body');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel('media exceeds byte limit');
      throw new Error(`Approved media exceeds the ${maximumBytes} byte safety limit`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

const channelSchema = z.object({
  id: z.enum(['pinterest', 'instagram', 'tiktok']),
  priority: z.number().int().min(1).max(3),
  status: z.enum(['not_connected', 'configured', 'active', 'paused']),
  founderApproved: z.boolean(),
  officialAccountReference: z.string().min(2).nullable(),
  officialPublicationTargetId: z.string().min(2).max(160).nullable(),
  configurationEvidenceUrl: httpsUrl.nullable(),
  configuredAt: z.string().datetime().nullable(),
  activatedAt: z.string().datetime().nullable(),
  publisher: z.enum(['pinterest-api-v5', 'meta-graph-api', 'tiktok-content-posting-api']).nullable(),
  publishingEnabled: z.boolean(),
  apiCredentialSecretName: z.string().regex(/^[A-Z][A-Z0-9_]+$/).nullable(),
  allowedFormats: z.array(slug).min(1),
  maxPostsPerWeek: z.number().int().nonnegative().max(21),
  nextGate: z.string().min(80)
}).strict();

export const socialChannelsSchema = z.object({
  schemaVersion: z.literal('1.2.0'),
  updatedAt: z.string().datetime(),
  policy: z.object({
    officialApiOnly: z.literal(true),
    browserPostingAllowed: z.literal(false),
    credentialsInRepositoryAllowed: z.literal(false),
    perPostApprovalReceiptRequired: z.literal(true),
    mediaRightsEvidenceRequired: z.literal(true),
    publicationReceiptRequired: z.literal(true),
    founderApproverLogin: z.string().regex(/^[A-Za-z0-9-]+$/),
    aggregateReportingRequiredBeforeAutopilot: z.literal(true),
    ownedDestinationHosts: z.array(z.string().min(3)).min(1)
  }).strict(),
  channels: z.array(channelSchema).length(3)
}).strict();

export const socialCreativeCandidateSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  candidateId: slug,
  packId: slug,
  postId: slug,
  platform: z.enum(['pinterest', 'instagram', 'tiktok']),
  packSha256: sha256,
  postSha256: sha256,
  assetPath: z.string().regex(/^\/social-media\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpg|jpeg|webp)$/),
  publicUrl: httpsUrl,
  contentSha256: sha256,
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  byteLength: z.number().int().positive().max(20_000_000),
  width: z.number().int().min(600).max(3840),
  height: z.number().int().min(600).max(3840),
  aspectRatio: z.literal('2:3'),
  altText: z.string().min(10).max(500),
  generator: z.literal('openai-built-in-imagegen'),
  generatedAt: z.string().datetime(),
  rightsPosture: z.literal('original-ai-generated-candidate-unapproved'),
  status: z.literal('candidate'),
  automatedChecks: z.object({
    exactTextVerified: z.literal(true),
    postBriefMatch: z.literal(true),
    noThirdPartyLogos: z.literal(true),
    noMerchantImagery: z.literal(true),
    noProductClaims: z.literal(true),
    dimensionsVerified: z.literal(true)
  }).strict()
}).strict();

export const socialMediaAssetSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  mediaAssetId: slug,
  creativeCandidateId: slug,
  creativeCandidateRecordSha256: sha256,
  packId: slug,
  postId: slug,
  platform: z.enum(['pinterest', 'instagram', 'tiktok']),
  packSha256: sha256,
  postSha256: sha256,
  mediaType: z.literal('image'),
  publicUrl: httpsUrl,
  contentSha256: sha256,
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  byteLength: z.number().int().positive().max(20_000_000),
  altText: z.string().min(10).max(500),
  rightsEvidenceUrl: httpsUrl,
  founderLogin: z.string().regex(/^[A-Za-z0-9-]+$/),
  approvedAt: z.string().datetime(),
  status: z.literal('approved')
}).strict();

export const socialApprovalSchema = z.object({
  schemaVersion: z.literal('1.1.0'),
  approvalId: slug,
  packId: slug,
  postId: slug,
  platform: z.enum(['pinterest', 'instagram', 'tiktok']),
  packSha256: sha256,
  postSha256: sha256,
  mediaAssetId: slug,
  mediaAssetRecordSha256: sha256,
  founderLogin: z.string().regex(/^[A-Za-z0-9-]+$/),
  approvedAt: z.string().datetime(),
  rightsEvidenceUrl: httpsUrl,
  approvals: z.object({
    originalOrLicensedAsset: z.literal(true),
    copy: z.literal(true),
    destination: z.literal(true),
    disclosure: z.literal(true)
  }).strict(),
  status: z.literal('approved'),
  externalPostId: z.null()
}).strict();

export const socialPublicationSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  publicationId: slug,
  approvalId: slug,
  postId: slug,
  packId: slug,
  platform: z.literal('pinterest'),
  packSha256: sha256,
  postSha256: sha256,
  mediaAssetId: slug,
  mediaAssetRecordSha256: sha256,
  mediaContentSha256: sha256,
  channelSha256: sha256,
  requestSha256: sha256,
  responseSha256: sha256,
  endpoint: z.literal('https://api.pinterest.com/v5/pins'),
  httpStatus: z.literal(201),
  externalPostId: externalId,
  externalPostUrl: httpsUrl,
  publishedAt: z.string().datetime(),
  status: z.literal('published')
}).strict();

export function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function socialPostSha256(post) {
  return sha256Json(post);
}

function parseReceipt(schema, input, prefix, issues) {
  try {
    const { __sha256: _internalSha256, ...publicInput } = input;
    return schema.parse(publicInput);
  } catch (error) {
    if (error instanceof z.ZodError) {
      for (const issue of error.issues) issues.push(`${prefix} ${issue.path.join('.')}: ${issue.message}`);
    } else issues.push(`${prefix}: ${String(error?.message ?? error)}`);
    return null;
  }
}

export function validateSocialModel(configInput, packs, receipts, assets = [], publications = [], candidates = []) {
  const issues = [];
  let config;
  try {
    config = socialChannelsSchema.parse(configInput);
  } catch (error) {
    if (error instanceof z.ZodError) return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return [String(error?.message ?? error)];
  }

  const channelIds = new Set();
  const priorities = new Set();
  const channelById = new Map();
  for (const channel of config.channels) {
    if (channelIds.has(channel.id)) issues.push(`${channel.id}: duplicate channel ID`);
    channelIds.add(channel.id);
    if (priorities.has(channel.priority)) issues.push(`${channel.id}: duplicate channel priority`);
    priorities.add(channel.priority);
    channelById.set(channel.id, channel);
    if (new Set(channel.allowedFormats).size !== channel.allowedFormats.length) issues.push(`${channel.id}: duplicate allowed format`);
    if (channel.status === 'not_connected') {
      if (channel.founderApproved || channel.publishingEnabled || channel.officialAccountReference || channel.officialPublicationTargetId || channel.configurationEvidenceUrl || channel.configuredAt || channel.activatedAt || channel.publisher || channel.apiCredentialSecretName || channel.maxPostsPerWeek !== 0) {
        issues.push(`${channel.id}: not-connected channel cannot contain account, target, publisher, credential, cadence, or publishing authorization`);
      }
    }
    if (['configured', 'active'].includes(channel.status)) {
      if (!channel.founderApproved || !channel.officialAccountReference || !channel.officialPublicationTargetId || !channel.configurationEvidenceUrl || !channel.configuredAt || !channel.publisher || !channel.apiCredentialSecretName || channel.maxPostsPerWeek < 1) {
        issues.push(`${channel.id}: configured or active channel requires founder-approved account, publication target, official publisher, secret reference, and cadence`);
      }
    }
    if (channel.status === 'configured' && channel.activatedAt !== null) issues.push(`${channel.id}: configured channel cannot claim activation time`);
    if (channel.status === 'active' && (!channel.activatedAt || channel.activatedAt < channel.configuredAt)) issues.push(`${channel.id}: active channel requires activation at or after configuration`);
    if (channel.status === 'paused' && channel.publishingEnabled) issues.push(`${channel.id}: paused channel cannot retain publishing authorization`);
    if (channel.id === 'pinterest' && channel.publisher && channel.publisher !== 'pinterest-api-v5') issues.push('pinterest: publisher must be pinterest-api-v5');
    if (channel.id === 'pinterest' && channel.apiCredentialSecretName && channel.apiCredentialSecretName !== 'PINTEREST_ACCESS_TOKEN') issues.push('pinterest: credential secret reference must be PINTEREST_ACCESS_TOKEN');
    if (channel.status === 'active' && !channel.publishingEnabled) issues.push(`${channel.id}: active channel requires publishingEnabled`);
    if (channel.publishingEnabled && channel.status !== 'active') issues.push(`${channel.id}: publishing authorization requires active channel status`);
  }

  const postIndex = new Map();
  const packIndex = new Map();
  for (const pack of packs) {
    if (packIndex.has(pack.packId)) issues.push(`${pack.packId}: duplicate social pack ID`);
    packIndex.set(pack.packId, pack);
    for (const post of pack.posts ?? []) {
      if (postIndex.has(post.id)) issues.push(`${post.id}: duplicate social post ID across packs`);
      postIndex.set(post.id, { pack, post });
      const channel = channelById.get(post.platform);
      if (!channel) issues.push(`${post.id}: unknown social platform ${post.platform}`);
      else if (!channel.allowedFormats.includes(post.format)) issues.push(`${post.id}: format ${post.format} is not allowlisted for ${post.platform}`);
      if (post.status === 'published' || post.externalPostId !== null) issues.push(`${post.id}: draft packs are immutable; publication truth belongs in a publication receipt`);
      try {
        const destination = assertSafePublicHttpsUrl(post.destinationUrl, `${post.id} destination URL`);
        if (!config.policy.ownedDestinationHosts.includes(destination.hostname)) issues.push(`${post.id}: destination host is not owned and allowlisted`);
      } catch (error) { issues.push(`${post.id}: ${error.message}`); }
    }
  }

  const candidateIds = new Set();
  const candidateById = new Map();
  for (const input of candidates) {
    const candidate = parseReceipt(socialCreativeCandidateSchema, input, 'creative candidate', issues);
    if (!candidate) continue;
    if (candidateIds.has(candidate.candidateId)) issues.push(`${candidate.candidateId}: duplicate creative candidate ID`);
    candidateIds.add(candidate.candidateId);
    candidateById.set(candidate.candidateId, { ...candidate, __sha256: input.__sha256 });
    if (!input.__sha256 || !sha256.safeParse(input.__sha256).success) issues.push(`${candidate.candidateId}: creative candidate record is missing its file SHA-256`);
    const indexed = postIndex.get(candidate.postId);
    if (!indexed) { issues.push(`${candidate.postId}: creative candidate references unknown social post`); continue; }
    if (indexed.pack.packId !== candidate.packId || indexed.pack.__sha256 !== candidate.packSha256) issues.push(`${candidate.postId}: creative candidate source pack changed after generation`);
    if (indexed.post.platform !== candidate.platform || socialPostSha256(indexed.post) !== candidate.postSha256) issues.push(`${candidate.postId}: creative candidate source post changed after generation`);
    if (indexed.post.altText !== candidate.altText) issues.push(`${candidate.postId}: creative candidate alt text must exactly match the source post`);
    try {
      const publicUrl = assertSafePublicHttpsUrl(candidate.publicUrl, `${candidate.postId} creative public URL`);
      if (!config.policy.ownedDestinationHosts.includes(publicUrl.hostname)) issues.push(`${candidate.postId}: creative public host is not owned and allowlisted`);
      if (publicUrl.pathname !== candidate.assetPath) issues.push(`${candidate.postId}: creative public URL path does not match the Firebase asset path`);
    } catch (error) { issues.push(`${candidate.postId}: ${error.message}`); }
    if (candidate.width * 3 !== candidate.height * 2) issues.push(`${candidate.postId}: creative dimensions do not match the declared 2:3 aspect ratio`);
  }

  const assetIds = new Set();
  const assetById = new Map();
  const assetByPost = new Map();
  for (const input of assets) {
    const asset = parseReceipt(socialMediaAssetSchema, input, 'media asset', issues);
    if (!asset) continue;
    if (assetIds.has(asset.mediaAssetId)) issues.push(`${asset.mediaAssetId}: duplicate media asset ID`);
    assetIds.add(asset.mediaAssetId);
    if (assetByPost.has(asset.postId)) issues.push(`${asset.postId}: more than one active approved media asset`);
    assetById.set(asset.mediaAssetId, { ...asset, __sha256: input.__sha256 });
    assetByPost.set(asset.postId, asset.mediaAssetId);
    if (!input.__sha256 || !sha256.safeParse(input.__sha256).success) issues.push(`${asset.mediaAssetId}: media asset record is missing its file SHA-256`);
    const candidate = candidateById.get(asset.creativeCandidateId);
    if (!candidate || candidate.postId !== asset.postId) issues.push(`${asset.postId}: approved media requires its exact creative candidate record`);
    else {
      if (candidate.__sha256 !== asset.creativeCandidateRecordSha256) issues.push(`${asset.postId}: creative candidate record changed after media approval`);
      if (candidate.publicUrl !== asset.publicUrl || candidate.contentSha256 !== asset.contentSha256 || candidate.contentType !== asset.contentType || candidate.byteLength !== asset.byteLength || candidate.altText !== asset.altText) {
        issues.push(`${asset.postId}: approved media differs from its creative candidate`);
      }
    }
    if (asset.founderLogin !== config.policy.founderApproverLogin) issues.push(`${asset.postId}: media asset was not approved by the configured founder`);
    const indexed = postIndex.get(asset.postId);
    if (!indexed) { issues.push(`${asset.postId}: media asset references unknown social post`); continue; }
    if (indexed.pack.packId !== asset.packId || indexed.pack.__sha256 !== asset.packSha256) issues.push(`${asset.postId}: media asset source pack changed after approval`);
    if (indexed.post.platform !== asset.platform || socialPostSha256(indexed.post) !== asset.postSha256) issues.push(`${asset.postId}: media asset source post changed after approval`);
    if (indexed.post.altText !== asset.altText) issues.push(`${asset.postId}: approved media alt text must exactly match the source post`);
    try { assertSafePublicHttpsUrl(asset.publicUrl, `${asset.postId} media URL`); } catch (error) { issues.push(`${asset.postId}: ${error.message}`); }
  }

  const receiptIds = new Set();
  const approvalByPost = new Map();
  for (const input of receipts) {
    const receipt = parseReceipt(socialApprovalSchema, input, 'approval', issues);
    if (!receipt) continue;
    if (receiptIds.has(receipt.approvalId)) issues.push(`${receipt.approvalId}: duplicate approval ID`);
    receiptIds.add(receipt.approvalId);
    if (approvalByPost.has(receipt.postId)) issues.push(`${receipt.postId}: more than one active approval receipt`);
    approvalByPost.set(receipt.postId, receipt);
    if (receipt.founderLogin !== config.policy.founderApproverLogin) issues.push(`${receipt.postId}: approval was not recorded by the configured founder`);
    const indexed = postIndex.get(receipt.postId);
    if (!indexed) { issues.push(`${receipt.postId}: approval references unknown social post`); continue; }
    if (indexed.pack.packId !== receipt.packId) issues.push(`${receipt.postId}: approval pack does not match source pack`);
    if (indexed.post.platform !== receipt.platform) issues.push(`${receipt.postId}: approval platform does not match source post`);
    if (indexed.pack.__sha256 !== receipt.packSha256) issues.push(`${receipt.postId}: source pack changed after social approval`);
    if (socialPostSha256(indexed.post) !== receipt.postSha256) issues.push(`${receipt.postId}: source post changed after social approval`);
    const asset = assetById.get(receipt.mediaAssetId);
    if (!asset || asset.postId !== receipt.postId) issues.push(`${receipt.postId}: approval requires the post's approved media asset`);
    else {
      if (asset.__sha256 !== receipt.mediaAssetRecordSha256) issues.push(`${receipt.postId}: media asset record changed after content approval`);
      if (asset.rightsEvidenceUrl !== receipt.rightsEvidenceUrl) issues.push(`${receipt.postId}: content approval rights evidence must match the media asset receipt`);
    }
    const channel = channelById.get(receipt.platform);
    if (!channel || !channel.founderApproved || !['configured', 'active'].includes(channel.status)) issues.push(`${receipt.postId}: content approval requires a founder-approved configured channel`);
  }

  const publicationIds = new Set();
  const publishedPosts = new Set();
  for (const input of publications) {
    const publication = parseReceipt(socialPublicationSchema, input, 'publication', issues);
    if (!publication) continue;
    if (publicationIds.has(publication.publicationId)) issues.push(`${publication.publicationId}: duplicate publication ID`);
    publicationIds.add(publication.publicationId);
    if (publishedPosts.has(publication.postId)) issues.push(`${publication.postId}: more than one publication receipt`);
    publishedPosts.add(publication.postId);
    const indexed = postIndex.get(publication.postId);
    const approval = approvalByPost.get(publication.postId);
    const asset = assetById.get(publication.mediaAssetId);
    const channel = channelById.get(publication.platform);
    if (!indexed || !approval || !asset || !channel) { issues.push(`${publication.postId}: publication receipt is missing its source post, approval, media, or channel`); continue; }
    if (approval.approvalId !== publication.approvalId) issues.push(`${publication.postId}: publication approval ID mismatch`);
    if (indexed.pack.packId !== publication.packId || indexed.pack.__sha256 !== publication.packSha256 || socialPostSha256(indexed.post) !== publication.postSha256) issues.push(`${publication.postId}: publication source changed after posting`);
    if (asset.__sha256 !== publication.mediaAssetRecordSha256 || asset.contentSha256 !== publication.mediaContentSha256) issues.push(`${publication.postId}: publication media evidence mismatch`);
    if (sha256Json(channel) !== publication.channelSha256) issues.push(`${publication.postId}: active channel configuration changed after posting`);
    if (channel.status !== 'active' || !channel.publishingEnabled || channel.publisher !== 'pinterest-api-v5') issues.push(`${publication.postId}: publication receipt requires an active Pinterest API channel`);
    if (!publication.externalPostUrl.endsWith(`/${publication.externalPostId}/`)) issues.push(`${publication.postId}: publication URL does not match the external post ID`);
  }
  return issues;
}

export function createPinterestPublicationPlan({ config, packs, approvals, assets, publications = [], candidates = [], postId }) {
  const issues = validateSocialModel(config, packs, approvals, assets, publications, candidates);
  if (issues.length > 0) throw new Error(`Social model is invalid: ${issues.join('; ')}`);
  const indexed = packs.flatMap((pack) => (pack.posts ?? []).map((post) => ({ pack, post }))).find((entry) => entry.post.id === postId);
  if (!indexed) throw new Error(`Unknown social post: ${postId}`);
  if (indexed.post.platform !== 'pinterest') throw new Error(`${postId}: only Pinterest image publishing is implemented`);
  if (publications.some((receipt) => receipt.postId === postId)) throw new Error(`${postId}: a publication receipt already exists`);
  const approval = approvals.find((receipt) => receipt.postId === postId);
  if (!approval) throw new Error(`${postId}: hash-bound founder content approval is missing`);
  const asset = assets.find((entry) => entry.mediaAssetId === approval.mediaAssetId);
  if (!asset) throw new Error(`${postId}: approved media asset is missing`);
  const channel = config.channels.find((entry) => entry.id === 'pinterest');
  if (!channel || channel.status !== 'active' || !channel.founderApproved || !channel.publishingEnabled) throw new Error(`${postId}: Pinterest channel is not active and authorized for publishing`);
  if (channel.publisher !== 'pinterest-api-v5') throw new Error(`${postId}: Pinterest official API v5 publisher is not configured`);
  if (!channel.officialPublicationTargetId || !channel.apiCredentialSecretName) throw new Error(`${postId}: Pinterest board target or credential secret reference is missing`);
  if (asset.mediaType !== 'image') throw new Error(`${postId}: Pinterest publisher currently accepts only approved image assets`);
  if (indexed.post.disclosureRequired) throw new Error(`${postId}: disclosure-required social publishing is not implemented; keep the post non-affiliate`);

  const request = {
    link: indexed.post.destinationUrl,
    title: indexed.post.headline,
    description: indexed.post.copy,
    alt_text: asset.altText,
    board_id: channel.officialPublicationTargetId,
    media_source: { source_type: 'image_url', url: asset.publicUrl, is_standard: true }
  };
  if (request.title.length > 100) throw new Error(`${postId}: Pinterest title exceeds the 100-character operating limit`);
  if (request.description.length > 800) throw new Error(`${postId}: Pinterest description exceeds the 800-character operating limit`);
  return {
    schemaVersion: '1.0.0',
    dryRun: true,
    networkCallsPlanned: 2,
    platform: 'pinterest',
    publisher: channel.publisher,
    endpoint: 'https://api.pinterest.com/v5/pins',
    credentialSecretName: channel.apiCredentialSecretName,
    postId,
    packId: indexed.pack.packId,
    packSha256: indexed.pack.__sha256,
    postSha256: socialPostSha256(indexed.post),
    approvalId: approval.approvalId,
    mediaAssetId: asset.mediaAssetId,
    mediaAssetRecordSha256: asset.__sha256,
    mediaContentSha256: asset.contentSha256,
    channelSha256: sha256Json(channel),
    requestSha256: sha256Json(request),
    request
  };
}
