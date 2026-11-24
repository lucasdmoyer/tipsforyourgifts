import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadSocialCreativeTarget } from './lib/social-creative-production-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = await loadSocialCreativeTarget(root, {
  postId: args['post-id'] || null,
  packPath: args['pack-path'] || null
});

const output = target
  ? {
      eligible: true,
      candidateId: target.candidateId,
      postId: target.post.id,
      packId: target.pack.packId,
      packPath: target.packRecord.path,
      platform: target.post.platform,
      articleSlug: target.pack.articleSlug,
      packSha256: target.packRecord.sha256,
      postSha256: target.postSha256
    }
  : { eligible: false };

if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs/promises');
  await fs.appendFile(process.env.GITHUB_OUTPUT, Object.entries(output).map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}=${value}\n`).join(''));
}
console.log(JSON.stringify(output, null, 2));
