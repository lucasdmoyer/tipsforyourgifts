import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateSocialModel } from './lib/social-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const channelId = args['channel-id'] ?? '';
if (!['pinterest', 'instagram', 'tiktok'].includes(channelId)) throw new Error('channel-id must be pinterest, instagram, or tiktok');
if (args.confirmation !== `ACTIVATE-${channelId}`) throw new Error('Action-time confirmation does not match the exact social channel');
if (!/^[a-f0-9]{64}$/.test(args['expected-config-sha256'] ?? '')) throw new Error('expected-config-sha256 must be a SHA-256 digest');

const root = process.cwd();
const configPath = path.join(root, 'config', 'social-channels.json');
const raw = await fs.readFile(configPath);
const actualSha256 = createHash('sha256').update(raw).digest('hex');
if (actualSha256 !== args['expected-config-sha256']) throw new Error('Social channel registry changed after founder review');
const model = JSON.parse(raw.toString('utf8'));
if (args['founder-login'] !== model.policy.founderApproverLogin) throw new Error('founder-login does not match the configured founder approver');
const channel = model.channels.find((entry) => entry.id === channelId);
if (!channel || channel.status !== 'configured' || !channel.founderApproved || channel.publishingEnabled) throw new Error(`${channelId} is not a founder-approved configured channel`);

const now = new Date().toISOString();
channel.status = 'active';
channel.publishingEnabled = true;
channel.activatedAt = now;
channel.nextGate = 'Approve one exact media record and one exact content receipt, then use the protected per-post official API workflow; active status does not publish or schedule any post.';
model.updatedAt = now;
const issues = validateSocialModel(model, [], [], [], [], []);
if (issues.length > 0) throw new Error(`Social channel activation would violate the contract: ${issues.join('; ')}`);
await fs.writeFile(configPath, `${JSON.stringify(model, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `channel_id=${channel.id}\n`);
console.log(JSON.stringify({ configured: true, activated: true, channelId: channel.id, postsPublished: 0, officialApiRequired: true }, null, 2));
