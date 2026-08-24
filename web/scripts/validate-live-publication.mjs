import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateLivePublicationState } from './lib/live-publication-contract.mjs';

const root = process.cwd();
const state = JSON.parse(await fs.readFile(path.join(root, 'config', 'live-publication.json'), 'utf8'));
const receiptDirectory = path.join(root, 'releases', 'receipts');
let receiptNames = [];
try { receiptNames = (await fs.readdir(receiptDirectory)).filter((name) => name.endsWith('.json')).sort(); } catch {}
const receiptsByPath = new Map(await Promise.all(receiptNames.map(async (name) => {
  const raw = await fs.readFile(path.join(receiptDirectory, name));
  return [`releases/receipts/${name}`, { raw, data: JSON.parse(raw.toString('utf8')) }];
})));
const issues = validateLivePublicationState(state, receiptsByPath);
if (issues.length > 0) {
  console.error(issues.map((issue) => `- ${issue}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ livePublicationState: state.status, durableReceipts: receiptsByPath.size, currentContentSetSha256: state.latestVerifiedContentRelease?.publicationManifest.contentSetSha256 ?? null }, null, 2));
}
