import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { socialPostSha256, validateSocialModel } from './lib/social-contract.mjs';

const root = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const postId = args['post-id'] ?? '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(postId)) {
  throw new Error('Usage: npm run social:approve -- --post-id=<id> --expected-pack-sha256=<sha256> --media-asset-id=<id> --expected-media-record-sha256=<sha256> --rights-evidence-url=https://... --founder-login=lucasdmoyer');
}
if (!/^[a-f0-9]{64}$/.test(args['expected-pack-sha256'] ?? '')) throw new Error('expected-pack-sha256 must be a lowercase SHA-256 digest');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args['media-asset-id'] ?? '')) throw new Error('media-asset-id must be a lowercase slug');
if (!/^[a-f0-9]{64}$/.test(args['expected-media-record-sha256'] ?? '')) throw new Error('expected-media-record-sha256 must be a lowercase SHA-256 digest');
if (!String(args['rights-evidence-url'] ?? '').startsWith('https://')) throw new Error('rights-evidence-url must be an HTTPS evidence reference');

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
const channel = config.channels.find((entry) => entry.id === indexed.post.platform);
if (!channel?.founderApproved || !['configured', 'active'].includes(channel.status)) {
  throw new Error(`${indexed.post.platform} is not a founder-approved configured channel`);
}
const mediaPath = path.join(root, 'social', 'assets', `${args['media-asset-id']}.json`);
const mediaRaw = await fs.readFile(mediaPath);
const media = { ...JSON.parse(mediaRaw), __sha256: createHash('sha256').update(mediaRaw).digest('hex') };
if (media.__sha256 !== args['expected-media-record-sha256']) throw new Error('media asset record SHA-256 does not match the exact reviewed record');
if (media.postId !== postId || media.packId !== indexed.pack.packId || media.packSha256 !== indexed.pack.__sha256 || media.postSha256 !== socialPostSha256(indexed.post)) {
  throw new Error('approved media asset is not bound to the exact source post and pack');
}
if (media.rightsEvidenceUrl !== args['rights-evidence-url']) throw new Error('rights-evidence-url must exactly match the approved media record');
const candidateRaw = await fs.readFile(path.join(root, 'social', 'candidates', `${media.creativeCandidateId}.json`));
const candidate = { ...JSON.parse(candidateRaw), __sha256: createHash('sha256').update(candidateRaw).digest('hex') };

const receipt = {
  schemaVersion: '1.1.0',
  approvalId: `${postId}-approval`,
  packId: indexed.pack.packId,
  postId,
  platform: indexed.post.platform,
  packSha256: indexed.pack.__sha256,
  postSha256: socialPostSha256(indexed.post),
  mediaAssetId: media.mediaAssetId,
  mediaAssetRecordSha256: media.__sha256,
  founderLogin: args['founder-login'],
  approvedAt: new Date().toISOString(),
  rightsEvidenceUrl: args['rights-evidence-url'],
  approvals: { originalOrLicensedAsset: true, copy: true, destination: true, disclosure: true },
  status: 'approved',
  externalPostId: null
};
const approvalPath = path.join(root, 'social', 'approvals', `${postId}.json`);
try { await fs.access(approvalPath); throw new Error(`${postId} already has an approval receipt`); } catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
const issues = validateSocialModel(config, packs, [receipt], [media], [], [candidate]);
if (issues.length > 0) throw new Error(`Social approval would violate the contract: ${issues.join('; ')}`);
await fs.mkdir(path.dirname(approvalPath), { recursive: true });
await fs.writeFile(approvalPath, `${JSON.stringify(receipt, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `post_id=${postId}\napproval_path=${path.relative(root, approvalPath)}\n`);
console.log(JSON.stringify({ approved: true, published: false, postId, platform: indexed.post.platform, receipt: path.relative(root, approvalPath) }, null, 2));
