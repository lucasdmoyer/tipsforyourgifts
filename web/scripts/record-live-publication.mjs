import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseLivePublicationState, summarizeVerifiedContentRelease } from './lib/live-publication-contract.mjs';
import { parsePublicationReceipt } from './lib/publication-receipt-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
if (!args.receipt) throw new Error('Usage: npm run publication:live:record -- --receipt=/path/to/publication-receipt.json [--expected-workflow-run-id=123] [--expected-release-sha=<sha>]');

const root = process.cwd();
const statePath = path.join(root, 'config', 'live-publication.json');
const state = parseLivePublicationState(JSON.parse(await fs.readFile(statePath, 'utf8')));
const receiptRaw = await fs.readFile(path.resolve(args.receipt));
const receipt = parsePublicationReceipt(JSON.parse(receiptRaw.toString('utf8')));
if (args['expected-workflow-run-id'] && receipt.workflow.runId !== args['expected-workflow-run-id']) throw new Error('Receipt workflow run ID does not match the triggering release workflow');
if (args['expected-release-sha'] && receipt.releaseSha !== args['expected-release-sha']) throw new Error('Receipt release SHA does not match the triggering release workflow');
if (args['expected-source-workflow'] && receipt.sourceWorkflow !== args['expected-source-workflow']) throw new Error('Receipt source workflow does not match the triggering release workflow');

const summary = summarizeVerifiedContentRelease(receipt, receiptRaw);
const current = state.latestVerifiedContentRelease;
if (current?.publicationManifest.contentSetSha256 === summary.publicationManifest.contentSetSha256) {
  console.log(JSON.stringify({ recorded: false, reason: 'content_set_already_recorded', receiptId: current.receiptId, contentSetSha256: current.publicationManifest.contentSetSha256 }, null, 2));
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, 'changed=false\n');
  process.exit(0);
}
if (current && Date.parse(summary.createdAt) <= Date.parse(current.createdAt)) throw new Error('A new live content release must be newer than the indexed receipt');

const nextState = parseLivePublicationState({
  ...state,
  status: 'verified_managed_content_release',
  updatedAt: summary.createdAt,
  latestVerifiedContentRelease: summary
});
const receiptPath = path.join(root, summary.receiptPath);
await fs.mkdir(path.dirname(receiptPath), { recursive: true });
try {
  await fs.writeFile(receiptPath, receiptRaw, { flag: 'wx' });
} catch (error) {
  if (error?.code !== 'EEXIST') throw error;
  const existing = await fs.readFile(receiptPath);
  if (!existing.equals(receiptRaw)) throw new Error('Receipt ID already exists with different bytes');
}
await fs.writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `changed=true\nreceipt_path=${summary.receiptPath}\nreceipt_id=${summary.receiptId}\n`);
console.log(JSON.stringify({ recorded: true, receiptId: summary.receiptId, receiptPath: summary.receiptPath, releaseSha: summary.releaseSha, contentSetSha256: summary.publicationManifest.contentSetSha256 }, null, 2));
