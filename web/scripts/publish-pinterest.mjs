import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { assertSafePublicHttpsUrl, createPinterestPublicationPlan, readResponseBytesCapped, sha256Json, socialPublicationSchema, validateSocialModel } from './lib/social-contract.mjs';

const root = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=') || 'true'];
}));
const postId = args['post-id'] ?? '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(postId)) throw new Error('Usage: npm run social:pinterest:plan -- --post-id=<id> [--execute] --expected-approval-sha256=<sha256> --expected-media-record-sha256=<sha256>');

async function loadJsonRecords(directory) {
  let names = [];
  try { names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort(); } catch {}
  return Promise.all(names.map(async (name) => {
    const raw = await fs.readFile(path.join(directory, name));
    return { ...JSON.parse(raw), __sha256: createHash('sha256').update(raw).digest('hex') };
  }));
}

const config = JSON.parse(await fs.readFile(path.join(root, 'config', 'social-channels.json'), 'utf8'));
const packs = await loadJsonRecords(path.join(root, 'social', 'drafts'));
const approvals = await loadJsonRecords(path.join(root, 'social', 'approvals'));
const candidates = await loadJsonRecords(path.join(root, 'social', 'candidates'));
const assets = await loadJsonRecords(path.join(root, 'social', 'assets'));
const publications = await loadJsonRecords(path.join(root, 'social', 'publications'));
const plan = createPinterestPublicationPlan({ config, packs, approvals, assets, publications, candidates, postId });
const approval = approvals.find((entry) => entry.postId === postId);
if (args['expected-approval-sha256'] && approval?.__sha256 !== args['expected-approval-sha256']) throw new Error('approval receipt SHA-256 does not match the action-time reviewed digest');
if (args['expected-media-record-sha256'] && plan.mediaAssetRecordSha256 !== args['expected-media-record-sha256']) throw new Error('media asset record SHA-256 does not match the action-time reviewed digest');

if (args.execute !== 'true') {
  console.log(JSON.stringify({ ...plan, dryRun: true, externalWritesAttempted: false }, null, 2));
  process.exit(0);
}
if (process.env.CONFIRM_EXTERNAL_SOCIAL_PUBLISH !== `PUBLISH-${postId}`) throw new Error('action-time external publication confirmation is missing');
if (!args['expected-approval-sha256'] || !args['expected-media-record-sha256']) throw new Error('execute mode requires exact approval and media record SHA-256 inputs');
const token = process.env[plan.credentialSecretName];
if (!token) throw new Error(`Required official API credential is unavailable under ${plan.credentialSecretName}`);

const mediaResponse = await fetch(plan.request.media_source.url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
if (!mediaResponse.ok) throw new Error(`Approved media recheck failed with HTTP ${mediaResponse.status}`);
assertSafePublicHttpsUrl(mediaResponse.url, 'resolved public media URL');
const mediaBytes = await readResponseBytesCapped(mediaResponse);
const mediaSha256 = createHash('sha256').update(mediaBytes).digest('hex');
if (mediaSha256 !== plan.mediaContentSha256) throw new Error('public media bytes changed after founder approval');

const apiResponse = await fetch(plan.endpoint, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(plan.request),
  redirect: 'error',
  signal: AbortSignal.timeout(30_000)
});
const responseText = await apiResponse.text();
if (apiResponse.status !== 201) throw new Error(`Pinterest create Pin failed with HTTP ${apiResponse.status}; response body withheld`);
let responseBody;
try { responseBody = JSON.parse(responseText); } catch { throw new Error('Pinterest returned a non-JSON success response without a verifiable Pin ID'); }
if (!/^[A-Za-z0-9._:-]{2,160}$/.test(String(responseBody.id ?? ''))) throw new Error('Pinterest success response did not include a valid external Pin ID');

const receipt = socialPublicationSchema.parse({
  schemaVersion: '1.0.0',
  publicationId: `${postId}-publication`,
  approvalId: plan.approvalId,
  postId,
  packId: plan.packId,
  platform: 'pinterest',
  packSha256: plan.packSha256,
  postSha256: plan.postSha256,
  mediaAssetId: plan.mediaAssetId,
  mediaAssetRecordSha256: plan.mediaAssetRecordSha256,
  mediaContentSha256: mediaSha256,
  channelSha256: plan.channelSha256,
  requestSha256: plan.requestSha256,
  responseSha256: createHash('sha256').update(responseText).digest('hex'),
  endpoint: plan.endpoint,
  httpStatus: 201,
  externalPostId: String(responseBody.id),
  externalPostUrl: `https://www.pinterest.com/pin/${responseBody.id}/`,
  publishedAt: new Date().toISOString(),
  status: 'published'
});
const outputPath = path.join(root, 'social', 'publications', `${postId}.json`);
try { await fs.access(outputPath); throw new Error(`${postId} already has a publication receipt`); } catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
const validationIssues = validateSocialModel(config, packs, approvals, assets, [...publications, { ...receipt, __sha256: sha256Json(receipt) }], candidates);
if (validationIssues.length > 0) throw new Error(`Publication receipt failed validation: ${validationIssues.join('; ')}`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `post_id=${postId}\nexternal_post_id=${receipt.externalPostId}\npublication_path=${path.relative(root, outputPath)}\n`);
console.log(JSON.stringify({ published: true, postId, platform: 'pinterest', externalPostId: receipt.externalPostId, publicationReceipt: path.relative(root, outputPath) }, null, 2));
