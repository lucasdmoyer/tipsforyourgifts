import process from 'node:process';
import { loadReleaseApprovals, summarizeReleaseApprovals } from './lib/release-approval-contract.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const records = await loadReleaseApprovals(root);
const manifest = JSON.parse(await fs.readFile(path.join(root, 'public', 'publication-manifest.json'), 'utf8'));
const summary = summarizeReleaseApprovals(records, manifest);

console.log(JSON.stringify({
  releaseApprovalValidation: 'passed',
  records: summary.total,
  active: summary.active,
  currentContentSetApprovalId: summary.currentContentSetApprovedRelease?.approvalId ?? null,
  exactHeadSha: summary.currentContentSetApprovedRelease?.headSha ?? null
}, null, 2));
