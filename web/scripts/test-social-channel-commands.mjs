import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { validateSocialModel } from './lib/social-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const configureWorkflow = await fs.readFile(path.join(scriptRoot, '..', '..', '.github', 'workflows', 'social-channel-configure.yml'), 'utf8');
const activateWorkflow = await fs.readFile(path.join(scriptRoot, '..', '..', '.github', 'workflows', 'social-channel-activate.yml'), 'utf8');
assert.match(configureWorkflow, /social:channel:configure/);
assert.match(configureWorkflow, /It stores no credential value, enables no publishing, publishes no post/);
assert.match(activateWorkflow, /environment: social-production/);
assert.match(activateWorkflow, /test -z "\$\(git status --short web\/social\/publications\)"/);
const baseRaw = await fs.readFile(path.join(scriptRoot, '..', 'config', 'social-channels.json'));
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-social-channel-command-'));
await fs.mkdir(path.join(fixtureRoot, 'config'));
const configPath = path.join(fixtureRoot, 'config', 'social-channels.json');
await fs.writeFile(configPath, baseRaw);
const baseSha256 = createHash('sha256').update(baseRaw).digest('hex');
await execFileAsync(process.execPath, [
  path.join(scriptRoot, 'configure-social-channel.mjs'), '--channel-id=pinterest', `--expected-config-sha256=${baseSha256}`,
  '--official-account-reference=@tipsforyourgifts', '--official-publication-target-id=123456789012345678', '--max-posts-per-week=3',
  '--configuration-evidence-url=https://github.com/lucasdmoyer/tipsforyourgifts/issues/42', '--confirmation=CONFIGURE-pinterest', '--founder-login=lucasdmoyer'
], { cwd: fixtureRoot });
const configuredRaw = await fs.readFile(configPath);
const configured = JSON.parse(configuredRaw.toString('utf8'));
assert.equal(configured.channels[0].status, 'configured');
assert.equal(configured.channels[0].publishingEnabled, false);
assert.equal(configured.channels[0].apiCredentialSecretName, 'PINTEREST_ACCESS_TOKEN');
assert.deepEqual(validateSocialModel(configured, [], [], [], [], []), []);

const configuredSha256 = createHash('sha256').update(configuredRaw).digest('hex');
await execFileAsync(process.execPath, [
  path.join(scriptRoot, 'activate-social-channel.mjs'), '--channel-id=pinterest', `--expected-config-sha256=${configuredSha256}`,
  '--confirmation=ACTIVATE-pinterest', '--founder-login=lucasdmoyer'
], { cwd: fixtureRoot });
const active = JSON.parse(await fs.readFile(configPath, 'utf8'));
assert.equal(active.channels[0].status, 'active');
assert.equal(active.channels[0].publishingEnabled, true);
assert.deepEqual(validateSocialModel(active, [], [], [], [], []), []);

await assert.rejects(() => execFileAsync(process.execPath, [
  path.join(scriptRoot, 'activate-social-channel.mjs'), '--channel-id=instagram', `--expected-config-sha256=${'0'.repeat(64)}`,
  '--confirmation=ACTIVATE-instagram', '--founder-login=lucasdmoyer'
], { cwd: fixtureRoot }), /registry changed/);

console.log(JSON.stringify({ socialChannelCommandTests: 'passed', workflowSafetyChecks: 4, configureWithoutPublish: 'passed', activateWithoutPost: 'passed', staleDigestRejected: 'passed' }, null, 2));
