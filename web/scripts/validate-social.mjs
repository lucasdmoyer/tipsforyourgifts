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

function readJpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('invalid JPEG signature');
  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) throw new Error('invalid JPEG segment');
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) throw new Error('invalid JPEG frame');
      return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    }
    offset += segmentLength;
  }
  throw new Error('JPEG dimensions are unavailable');
}

function readWebpDimensions(bytes) {
  if (bytes.length < 30 || bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') throw new Error('invalid WebP signature');
  const chunk = bytes.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X') {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3)
    };
  }
  if (chunk === 'VP8 ') {
    if (bytes.subarray(23, 26).toString('hex') !== '9d012a') throw new Error('invalid VP8 frame');
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff
    };
  }
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) throw new Error('invalid VP8L frame');
    const dimensions = bytes.readUInt32LE(21);
    return {
      width: 1 + (dimensions & 0x3fff),
      height: 1 + ((dimensions >>> 14) & 0x3fff)
    };
  }
  throw new Error(`unsupported WebP chunk ${chunk}`);
}

function readCreativeDimensions(bytes, contentType) {
  if (contentType === 'image/png') {
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('invalid PNG signature');
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (contentType === 'image/jpeg') return readJpegDimensions(bytes);
  if (contentType === 'image/webp') return readWebpDimensions(bytes);
  throw new Error(`unsupported creative content type ${contentType}`);
}

for (const candidate of candidates) {
  try {
    const assetPath = path.join(root, 'public', String(candidate.assetPath ?? '').replace(/^\//, ''));
    const bytes = await fs.readFile(assetPath);
    const actualSha256 = createHash('sha256').update(bytes).digest('hex');
    if (actualSha256 !== candidate.contentSha256) issues.push(`${candidate.candidateId}: local creative bytes do not match the candidate SHA-256`);
    if (bytes.byteLength !== candidate.byteLength) issues.push(`${candidate.candidateId}: local creative byte length does not match the candidate record`);
    const dimensions = readCreativeDimensions(bytes, candidate.contentType);
    if (dimensions.width !== candidate.width || dimensions.height !== candidate.height) issues.push(`${candidate.candidateId}: local creative dimensions do not match the candidate record`);
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
