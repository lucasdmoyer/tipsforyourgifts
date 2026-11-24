import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { visualFailureReceiptSchema } from './lib/visual-failure-contract.mjs';
import { loadVisualProductionTarget } from './lib/visual-production-store.mjs';

const root = process.cwd();
const directory = path.join(root, 'visuals', 'failures');
let files = [];
try { files = (await fs.readdir(directory)).filter((file) => file.endsWith('.json')).sort(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const receipts = [];
const ids = new Set();
for (const file of files) {
  const receipt = visualFailureReceiptSchema.parse(JSON.parse(await fs.readFile(path.join(directory, file), 'utf8')));
  if (file !== `${receipt.failureId}.json`) throw new Error(`${file}: filename must match failureId`);
  if (ids.has(receipt.failureId)) throw new Error(`${file}: duplicate failureId`);
  ids.add(receipt.failureId);
  let requestStillPending = true;
  try {
    await fs.access(path.join(root, receipt.bindings.requestPath));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    requestStillPending = false;
  }
  if (requestStillPending) {
    const { target } = await loadVisualProductionTarget(root, receipt.bindings.requestId);
    for (const [label, actual, expected] of [
      ['request', target.requestRecord.sha256, receipt.bindings.requestSha256],
      ['mission', target.missionRecord.sha256, receipt.bindings.missionSha256]
    ]) if (actual !== expected) throw new Error(`${file}: ${label} binding is stale`);
    if (target.runRecord.data.runId !== receipt.bindings.runId || target.requestRecord.data.articleSlug !== receipt.bindings.articleSlug) throw new Error(`${file}: current request identity differs from the receipt`);
  }
  receipts.push(receipt);
}
console.log(JSON.stringify({ gate: 'passed', visualFailureReceipts: receipts.length, generationFailures: receipts.filter((receipt) => receipt.stage === 'production').length, reviewFailures: receipts.filter((receipt) => receipt.stage === 'independent_review').length, partialOutputPreserved: false, reviewReceiptFabricated: false, generatedAssetsPromoted: false, productionAuthorized: false }, null, 2));
