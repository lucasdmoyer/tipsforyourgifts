import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { validateAffiliateModel } from './lib/affiliate-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const activationWorkflow = await fs.readFile(path.join(scriptRoot, '..', '..', '.github', 'workflows', 'affiliate-program-activate.yml'), 'utf8');
assert.match(activationWorkflow, /environment: affiliate-activation/);
assert.match(activationWorkflow, /ACTIVATE-\$PROGRAM_ID/);
assert.match(activationWorkflow, /It creates no account, accepts no terms, creates no paid link/);
const base = JSON.parse(await fs.readFile(path.join(scriptRoot, '..', 'config', 'affiliate-programs.json'), 'utf8'));
const program = base.programs[0];
const testNow = new Date();
const sourceCheckedAt = new Date(testNow.valueOf() - 86_400_000).toISOString();
const termsAcceptedAt = new Date(testNow.valueOf() - 3_600_000).toISOString();
const sourceReviewExpiresAt = new Date(testNow.valueOf() + 30 * 86_400_000).toISOString().slice(0, 10);
program.sourceCheckedAt = sourceCheckedAt;
program.sourceReviewExpiresAt = sourceReviewExpiresAt;
base.updatedAt = sourceCheckedAt;
program.status = 'founder_approved';
program.founderDisposition = 'approved';
program.revision += 1;
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-affiliate-command-'));
await fs.mkdir(path.join(fixtureRoot, 'config'));
await fs.writeFile(path.join(fixtureRoot, 'config', 'affiliate-programs.json'), `${JSON.stringify(base, null, 2)}\n`);
const commonArgs = [
  path.join(scriptRoot, 'activate-affiliate-program.mjs'),
  `--program-id=${program.id}`,
  `--expected-revision=${program.revision}`,
  `--confirmation=ACTIVATE-${program.id}`,
  '--allowed-domains=bookshop.org',
  '--tracking-parameter-keys=affiliate',
  `--terms-accepted-at=${termsAcceptedAt}`,
  '--acceptance-evidence-url=https://github.com/lucasdmoyer/tipsforyourgifts/issues/42',
  '--reporting-export-approved=false',
  '--founder-login=lucasdmoyer'
];
await execFileAsync(process.execPath, commonArgs, { cwd: fixtureRoot });
const activated = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'config', 'affiliate-programs.json'), 'utf8'));
const activatedProgram = activated.programs.find((entry) => entry.id === program.id);
assert.equal(activatedProgram.status, 'enabled');
assert.equal(activatedProgram.enabled, true);
assert.equal(activatedProgram.priceFeedAuthorized, false);
assert.deepEqual(activatedProgram.registeredSites, ['https://tipsforyourgifts.web.app/']);
assert.deepEqual(validateAffiliateModel(activated, { asOfDate: testNow.toISOString().slice(0, 10) }), []);

const rejectedRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-affiliate-command-reject-'));
await fs.mkdir(path.join(rejectedRoot, 'config'));
await fs.writeFile(path.join(rejectedRoot, 'config', 'affiliate-programs.json'), `${JSON.stringify(base, null, 2)}\n`);
await assert.rejects(() => execFileAsync(process.execPath, commonArgs.map((argument) => argument.startsWith('--confirmation=') ? '--confirmation=ACTIVATE-something-else' : argument), { cwd: rejectedRoot }), /Action-time confirmation/);

console.log(JSON.stringify({ affiliateActivationCommandTests: 'passed', workflowSafetyChecks: 3, founderApprovedToEnabled: 'passed', noLinkCreation: 'passed', confirmationMismatchRejected: 'passed' }, null, 2));
