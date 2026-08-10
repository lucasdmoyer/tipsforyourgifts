import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateAffiliateModel } from './lib/affiliate-contract.mjs';

const root = process.cwd();
const configPath = path.join(root, 'config', 'affiliate-programs.json');
const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args['program-id'] ?? '')) {
  throw new Error('Usage: npm run affiliate:approve -- --program-id=bookshop-org-us-media --expected-revision=1 --founder-login=lucasdmoyer');
}
const expectedRevision = Number(args['expected-revision']);
if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new Error('expected-revision must be a positive integer');

const model = JSON.parse(await fs.readFile(configPath, 'utf8'));
if (args['founder-login'] !== model.policy.founderApproverLogin) throw new Error('founder-login does not match the configured founder approver');
const program = model.programs.find((entry) => entry.id === args['program-id']);
if (!program) throw new Error(`Unknown affiliate program: ${args['program-id']}`);
if (program.revision !== expectedRevision) throw new Error(`${program.id} is revision ${program.revision}, not expected revision ${expectedRevision}`);
if (program.status !== 'proposed' || program.founderDisposition !== 'proposed' || program.enabled) {
  throw new Error(`${program.id} is not a disabled proposed program`);
}

program.revision += 1;
program.status = 'founder_approved';
program.founderDisposition = 'approved';
program.nextGate = 'Lucas completes external enrollment and current terms review personally, then a separate audited configuration pull request may record registered sites, program-provided tracking, disclosure, and link allowlists.';
model.updatedAt = new Date().toISOString();
const issues = validateAffiliateModel(model);
if (issues.length > 0) throw new Error(`Affiliate approval would violate the contract: ${issues.join('; ')}`);
await fs.writeFile(configPath, `${JSON.stringify(model, null, 2)}\n`);

if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(process.env.GITHUB_OUTPUT, `program_id=${program.id}\nprogram_revision=${program.revision}\n`);
}
console.log(JSON.stringify({ approvedForExternalReview: true, enabled: false, programId: program.id, revision: program.revision }, null, 2));
