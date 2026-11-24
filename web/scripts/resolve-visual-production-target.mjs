import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadVisualProductionTarget } from './lib/visual-production-store.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { target } = await loadVisualProductionTarget(root, args['request-id'] || null);

if (!target) {
  if (process.env.GITHUB_OUTPUT) await import('node:fs/promises').then(({ appendFile }) => appendFile(process.env.GITHUB_OUTPUT, 'eligible=false\n'));
  console.log(JSON.stringify({ eligible: false, reason: 'no_visual_pending_request', productionAuthorized: false }, null, 2));
  process.exit(0);
}

const output = {
  eligible: true,
  requestId: target.requestRecord.data.requestId,
  requestPath: target.requestRecord.path,
  requestSha256: target.requestRecord.sha256,
  missionId: target.missionRecord.data.missionId,
  missionPath: target.missionRecord.path,
  missionSha256: target.missionRecord.sha256,
  runId: target.runRecord.data.runId,
  articleSlug: target.requestRecord.data.articleSlug,
  reviewReceiptPath: target.reviewRecord.path,
  productionAuthorized: false
};
if (process.env.GITHUB_OUTPUT) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_OUTPUT, [
    'eligible=true',
    `request_id=${output.requestId}`,
    `request_path=${output.requestPath}`,
    `request_sha256=${output.requestSha256}`,
    `mission_id=${output.missionId}`,
    `mission_path=${output.missionPath}`,
    `mission_sha256=${output.missionSha256}`,
    `run_id=${output.runId}`,
    `article_slug=${output.articleSlug}`,
    `review_receipt_path=${output.reviewReceiptPath}`,
    ''
  ].join('\n'));
}
console.log(JSON.stringify(output, null, 2));
