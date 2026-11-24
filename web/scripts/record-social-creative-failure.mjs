import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadSocialCreativeTarget, socialCreativeFailureSchema, socialCreativeProductionDirectory } from './lib/social-creative-production-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => { const [key, ...rest] = value.replace(/^--/, '').split('='); return [key, rest.join('=')]; }));
const postId = args['post-id'];
const stage = args.stage;
const reasonCode = args['reason-code'];
if (!postId || !['production', 'independent-review'].includes(stage) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reasonCode ?? '')) throw new Error('Usage: node scripts/record-social-creative-failure.mjs --post-id=<id> --stage=<production|independent-review> --reason-code=<slug>');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = await loadSocialCreativeTarget(root, { postId });
if (!target) throw new Error(`${postId}: eligible social creative target is missing`);
const workflowRunId = process.env.GITHUB_RUN_ID ?? args['workflow-run-id'];
const workflowRunAttempt = Number(process.env.GITHUB_RUN_ATTEMPT ?? args['workflow-run-attempt'] ?? '1');
if (!/^[1-9]\d*$/.test(workflowRunId ?? '') || !Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) throw new Error('Failure receipt needs a positive workflow run ID and attempt');
const failureId = `${target.candidateId}-${workflowRunId}-${workflowRunAttempt}`;
const failure = socialCreativeFailureSchema.parse({
  schemaVersion: '1.0.0', failureId, candidateId: target.candidateId, packId: target.pack.packId, postId: target.post.id,
  packSha256: target.packRecord.sha256, postSha256: target.postSha256, stage, reasonCode, workflowRunId, workflowRunAttempt,
  failedAt: args['failed-at'] ?? new Date().toISOString(), sourcePromoted: false, mediaApproved: false, contentApproved: false, externalPostCreated: false,
  nextGate: 'Correct the bounded production or independent-review failure, then rerun this exact post through a new isolated social creative workflow attempt.'
});
const outputPath = path.join(root, 'social', 'failures', `${failureId}.json`);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(failure, null, 2)}\n`, { flag: 'wx' });
await fs.rm(path.join(root, socialCreativeProductionDirectory(target.candidateId)), { recursive: true, force: true });
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `failure_id=${failureId}\n`);
console.log(JSON.stringify({ failureId, failurePath: `social/failures/${failureId}.json`, sourcePromoted: false, mediaApproved: false, externalPostCreated: false }, null, 2));
