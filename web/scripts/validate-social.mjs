import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateSocialModel } from './lib/social-contract.mjs';

const root = process.cwd();
const config = JSON.parse(await fs.readFile(path.join(root, 'config', 'social-channels.json'), 'utf8'));
const draftsDir = path.join(root, 'social', 'drafts');
const approvalsDir = path.join(root, 'social', 'approvals');
const candidatesDir = path.join(root, 'social', 'candidates');
const assetsDir = path.join(root, 'social', 'assets');
const publicationsDir = path.join(root, 'social', 'publications');
const draftNames = (await fs.readdir(draftsDir)).filter((name) => name.endsWith('.json')).sort();
const packs = [];
for (const name of draftNames) {
  const raw = await fs.readFile(path.join(draftsDir, name));
  packs.push({ ...JSON.parse(raw), __sha256: createHash('sha256').update(raw).digest('hex') });
}
let approvalNames = [];
try { approvalNames = (await fs.readdir(approvalsDir)).filter((name) => name.endsWith('.json')).sort(); } catch {}
const receipts = await Promise.all(approvalNames.map(async (name) => JSON.parse(await fs.readFile(path.join(approvalsDir, name), 'utf8'))));
async function loadHashedRecords(directory) {
  let names = [];
  try { names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort(); } catch {}
  return Promise.all(names.map(async (name) => {
    const raw = await fs.readFile(path.join(directory, name));
    return { ...JSON.parse(raw), __sha256: createHash('sha256').update(raw).digest('hex') };
  }));
}
const assets = await loadHashedRecords(assetsDir);
const publications = await loadHashedRecords(publicationsDir);
const candidates = await loadHashedRecords(candidatesDir);
const issues = validateSocialModel(config, packs, receipts, assets, publications, candidates);
for (const candidate of candidates) {
  try {
    const assetPath = path.join(root, 'public', String(candidate.assetPath ?? '').replace(/^\//, ''));
    const bytes = await fs.readFile(assetPath);
    const actualSha256 = createHash('sha256').update(bytes).digest('hex');
    if (actualSha256 !== candidate.contentSha256) issues.push(`${candidate.candidateId}: local creative bytes do not match the candidate SHA-256`);
    if (bytes.byteLength !== candidate.byteLength) issues.push(`${candidate.candidateId}: local creative byte length does not match the candidate record`);
    if (candidate.contentType === 'image/png') {
      const pngSignature = bytes.subarray(0, 8).toString('hex');
      if (pngSignature !== '89504e470d0a1a0a') issues.push(`${candidate.candidateId}: local creative is not a valid PNG`);
      else if (bytes.readUInt32BE(16) !== candidate.width || bytes.readUInt32BE(20) !== candidate.height) issues.push(`${candidate.candidateId}: local creative dimensions do not match the candidate record`);
    }
  } catch (error) { issues.push(`${candidate.candidateId}: local creative asset is missing or unreadable (${error.message})`); }
}

if (issues.length > 0) {
  console.error(`Social gate failed with ${issues.length} issue${issues.length === 1 ? '' : 's'}:`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  const posts = packs.flatMap((pack) => pack.posts);
  console.log(JSON.stringify({
    gate: 'passed',
    channels: config.channels.length,
    activeChannels: config.channels.filter((channel) => channel.status === 'active').length,
    draftPacks: packs.length,
    posts: posts.length,
    creativeCandidates: candidates.length,
    approvedMediaAssets: assets.length,
    approvalReceipts: receipts.length,
    publicationReceipts: publications.length,
    publishedPosts: publications.length,
    externalWritesAttempted: false
  }, null, 2));
}
