import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { automationFailureReceiptSchema } from './lib/automation-failure-contract.mjs';

const directory = path.join(process.cwd(), 'automation', 'failures');
let files = [];
try { files = (await fs.readdir(directory)).filter((file) => file.endsWith('.json')).sort(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const receipts = [];
const ids = new Set();
for (const file of files) {
  const receipt = automationFailureReceiptSchema.parse(JSON.parse(await fs.readFile(path.join(directory, file), 'utf8')));
  if (file !== `${receipt.failureId}.json`) throw new Error(`${file}: filename must match failureId`);
  if (ids.has(receipt.failureId)) throw new Error(`${file}: duplicate failureId`);
  ids.add(receipt.failureId);
  receipts.push(receipt);
}
console.log(JSON.stringify({ gate: 'passed', automationFailureReceipts: receipts.length, workflows: Object.fromEntries([...new Set(receipts.map((receipt) => receipt.workflow.name))].map((name) => [name, receipts.filter((receipt) => receipt.workflow.name === name).length])), partialModelOutputPreserved: false, authoritativeProposalPreserved: false, reviewReceiptFabricated: false, externalStateChanged: false, productionAuthorized: false }, null, 2));
