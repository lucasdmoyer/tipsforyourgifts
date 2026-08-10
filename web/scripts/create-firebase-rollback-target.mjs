import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { rollbackTargetSchema } from './lib/publication-receipt-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const releaseSha = args['release-sha'];
const targetChannel = args['target-channel'];
const outputPath = args.output ?? 'rollback-target.json';
if (!releaseSha || !targetChannel) throw new Error('Release SHA and the successfully cloned Firebase target channel are required');

const target = rollbackTargetSchema.parse({
  strategy: 'firebase_channel_clone',
  projectId: 'tipsforyourgifts',
  siteId: 'tipsforyourgifts',
  sourceChannel: 'live',
  targetChannel,
  protectsReleaseSha: releaseSha,
  clonedAt: new Date().toISOString(),
  expiresAfter: '30d',
  firebaseToolsVersion: '15.26.0',
  rollbackCommand: `firebase hosting:clone tipsforyourgifts:${targetChannel} tipsforyourgifts:live --project tipsforyourgifts`,
  status: 'verified_clone'
});
await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(target, null, 2)}\n`, { flag: 'wx' });
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `rollback_target_path=${outputPath}\nrollback_channel=${targetChannel}\n`);
console.log(JSON.stringify({ rollbackTargetRecorded: true, strategy: target.strategy, targetChannel, protectsReleaseSha: releaseSha, expiresAfter: target.expiresAfter }, null, 2));
