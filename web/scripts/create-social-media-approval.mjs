import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { assertSafePublicHttpsUrl, readResponseBytesCapped, socialCreativeCandidateSchema, socialMediaAssetSchema, socialPostSha256 } from './lib/social-contract.mjs';

const root = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const postId = args['post-id'] ?? '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(postId)) {
  throw new Error('Usage: npm run social:media:approve -- --post-id=<id> --expected-pack-sha256=<sha256> --candidate-id=<id> --expected-candidate-record-sha256=<sha256> --rights-evidence-url=https://... --founder-login=lucasdmoyer');
}
if (!/^[a-f0-9]{64}$/.test(args['expected-pack-sha256'] ?? '')) throw new Error('expected-pack-sha256 must be a lowercase SHA-256 digest');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args['candidate-id'] ?? '')) throw new Error('candidate-id must be a lowercase slug');
if (!/^[a-f0-9]{64}$/.test(args['expected-candidate-record-sha256'] ?? '')) throw new Error('expected-candidate-record-sha256 must be a lowercase SHA-256 digest');
assertSafePublicHttpsUrl(args['rights-evidence-url'] ?? '', 'rights evidence URL');

const config = JSON.parse(await fs.readFile(path.join(root, 'config', 'social-channels.json'), 'utf8'));
if (args['founder-login'] !== config.policy.founderApproverLogin) throw new Error('founder-login does not match the configured founder approver');
const draftsDir = path.join(root, 'social', 'drafts');
const names = (await fs.readdir(draftsDir)).filter((name) => name.endsWith('.json')).sort();
const packs = [];
for (const name of names) {
  const raw = await fs.readFile(path.join(draftsDir, name));
  packs.push({ ...JSON.parse(raw), __sha256: createHash('sha256').update(raw).digest('hex') });
}
const indexed = packs.flatMap((pack) => pack.posts.map((post) => ({ pack, post }))).find((entry) => entry.post.id === postId);
if (!indexed) throw new Error(`Unknown social post: ${postId}`);
if (indexed.pack.__sha256 !== args['expected-pack-sha256']) throw new Error('source pack SHA-256 does not match the exact reviewed pack');
if (indexed.post.platform !== 'pinterest') throw new Error('The first media approval lane supports Pinterest image posts only');
const candidatePath = path.join(root, 'social', 'candidates', `${args['candidate-id']}.json`);
const candidateRaw = await fs.readFile(candidatePath);
const candidateRecordSha256 = createHash('sha256').update(candidateRaw).digest('hex');
if (candidateRecordSha256 !== args['expected-candidate-record-sha256']) throw new Error('creative candidate record SHA-256 does not match the exact reviewed record');
const candidate = socialCreativeCandidateSchema.parse(JSON.parse(candidateRaw));
if (candidate.postId !== postId || candidate.packId !== indexed.pack.packId || candidate.packSha256 !== indexed.pack.__sha256 || candidate.postSha256 !== socialPostSha256(indexed.post)) {
  throw new Error('creative candidate is not bound to the exact source post and pack');
}
assertSafePublicHttpsUrl(candidate.publicUrl, 'candidate public media URL');

const response = await fetch(candidate.publicUrl, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`Approved media could not be downloaded: HTTP ${response.status}`);
assertSafePublicHttpsUrl(response.url, 'resolved public media URL');
const contentLength = Number(response.headers.get('content-length'));
if (Number.isFinite(contentLength) && contentLength > 20_000_000) throw new Error('Approved media exceeds the 20 MB safety limit');
const contentType = String(response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
if (contentType !== candidate.contentType) throw new Error(`Approved media content type changed from ${candidate.contentType} to ${contentType || 'missing'}`);
const bytes = await readResponseBytesCapped(response);
if (bytes.byteLength === 0 || bytes.byteLength > 20_000_000) throw new Error('Approved media byte length is outside the allowed range');
const contentSha256 = createHash('sha256').update(bytes).digest('hex');
if (contentSha256 !== candidate.contentSha256) throw new Error('downloaded media SHA-256 does not match the reviewed creative candidate');
if (bytes.byteLength !== candidate.byteLength) throw new Error('downloaded media byte length does not match the reviewed creative candidate');

const record = socialMediaAssetSchema.parse({
  schemaVersion: '1.0.0',
  mediaAssetId: `${postId}-image`,
  creativeCandidateId: candidate.candidateId,
  creativeCandidateRecordSha256: candidateRecordSha256,
  packId: indexed.pack.packId,
  postId,
  platform: indexed.post.platform,
  packSha256: indexed.pack.__sha256,
  postSha256: socialPostSha256(indexed.post),
  mediaType: 'image',
  publicUrl: candidate.publicUrl,
  contentSha256,
  contentType,
  byteLength: bytes.byteLength,
  altText: candidate.altText,
  rightsEvidenceUrl: args['rights-evidence-url'],
  founderLogin: args['founder-login'],
  approvedAt: new Date().toISOString(),
  status: 'approved'
});
const outputPath = path.join(root, 'social', 'assets', `${record.mediaAssetId}.json`);
try { await fs.access(outputPath); throw new Error(`${record.mediaAssetId} already has an approved media record`); } catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `post_id=${postId}\nmedia_asset_id=${record.mediaAssetId}\nasset_path=${path.relative(root, outputPath)}\n`);
console.log(JSON.stringify({ mediaApproved: true, published: false, postId, mediaAssetId: record.mediaAssetId, contentSha256, record: path.relative(root, outputPath) }, null, 2));
