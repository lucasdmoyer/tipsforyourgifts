import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { assertSafePublicHttpsUrl, validateSocialModel } from './lib/social-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const channelId = args['channel-id'] ?? '';
const channelDefaults = {
  pinterest: { publisher: 'pinterest-api-v5', secretName: 'PINTEREST_ACCESS_TOKEN' },
  instagram: { publisher: 'meta-graph-api', secretName: 'META_GRAPH_ACCESS_TOKEN' },
  tiktok: { publisher: 'tiktok-content-posting-api', secretName: 'TIKTOK_ACCESS_TOKEN' }
};
if (!channelDefaults[channelId]) throw new Error('channel-id must be pinterest, instagram, or tiktok');
if (args.confirmation !== `CONFIGURE-${channelId}`) throw new Error('Action-time confirmation does not match the exact social channel');
if (!/^[a-f0-9]{64}$/.test(args['expected-config-sha256'] ?? '')) throw new Error('expected-config-sha256 must be a SHA-256 digest');
if (!/^@?[A-Za-z0-9._:-]{2,160}$/.test(args['official-account-reference'] ?? '')) throw new Error('official-account-reference must be a non-secret stable account handle or ID');
if (!/^[A-Za-z0-9._:-]{2,160}$/.test(args['official-publication-target-id'] ?? '')) throw new Error('official-publication-target-id must be a non-secret platform target ID');
const maxPostsPerWeek = Number(args['max-posts-per-week']);
if (!Number.isInteger(maxPostsPerWeek) || maxPostsPerWeek < 1 || maxPostsPerWeek > 7) throw new Error('max-posts-per-week must be an integer from 1 through 7');
const evidenceUrl = assertSafePublicHttpsUrl(args['configuration-evidence-url'] ?? '', 'configuration evidence URL');

const root = process.cwd();
const configPath = path.join(root, 'config', 'social-channels.json');
const raw = await fs.readFile(configPath);
const actualSha256 = createHash('sha256').update(raw).digest('hex');
if (actualSha256 !== args['expected-config-sha256']) throw new Error('Social channel registry changed after founder review');
const model = JSON.parse(raw.toString('utf8'));
if (args['founder-login'] !== model.policy.founderApproverLogin) throw new Error('founder-login does not match the configured founder approver');
const channel = model.channels.find((entry) => entry.id === channelId);
if (!channel || channel.status !== 'not_connected') throw new Error(`${channelId} is not an unconfigured channel`);

const now = new Date().toISOString();
Object.assign(channel, {
  status: 'configured',
  founderApproved: true,
  officialAccountReference: args['official-account-reference'],
  officialPublicationTargetId: args['official-publication-target-id'],
  configurationEvidenceUrl: evidenceUrl.toString(),
  configuredAt: now,
  activatedAt: null,
  publisher: channelDefaults[channelId].publisher,
  publishingEnabled: false,
  apiCredentialSecretName: channelDefaults[channelId].secretName,
  maxPostsPerWeek,
  nextGate: 'Lucas reviews this exact hash-bound configuration in the protected activation workflow; configured status permits media and copy approval but cannot publish externally.'
});
model.updatedAt = now;
const issues = validateSocialModel(model, [], [], [], [], []);
if (issues.length > 0) throw new Error(`Social channel configuration would violate the contract: ${issues.join('; ')}`);
await fs.writeFile(configPath, `${JSON.stringify(model, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `channel_id=${channel.id}\n`);
console.log(JSON.stringify({ configured: true, activated: false, channelId: channel.id, publisher: channel.publisher, credentialValueStored: false, maxPostsPerWeek }, null, 2));
