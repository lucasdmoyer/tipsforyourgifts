import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { affiliateLinkBatchInputSchema, sha256 } from './lib/affiliate-link-contract.mjs';

const rawInput = process.env.AFFILIATE_BATCH_JSON;
const outputPath = process.env.AFFILIATE_BATCH_INPUT_PATH;
if (!rawInput || !outputPath) throw new Error('AFFILIATE_BATCH_JSON and AFFILIATE_BATCH_INPUT_PATH are required');

const bytes = Buffer.from(rawInput.endsWith('\n') ? rawInput : `${rawInput}\n`);
const input = affiliateLinkBatchInputSchema.parse(JSON.parse(bytes.toString('utf8')));
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, bytes, { flag: 'wx' });

const inputSha256 = sha256(bytes);
if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(process.env.GITHUB_OUTPUT, `input_path=${outputPath}\nexport_id=${input.exportId}\nexport_sha256=${inputSha256}\n`);
}
console.log(JSON.stringify({ batchInputPrepared: true, exportId: input.exportId, records: input.records.length, paidUrlsPrinted: false }, null, 2));
