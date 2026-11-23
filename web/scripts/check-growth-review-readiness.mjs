import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { growthSchema } from './lib/growth-contract.mjs';

export function assessGrowthReviewReadiness(input) {
  const growth = growthSchema.parse(input);
  const snapshotCount = growth.snapshots.length;

  if (snapshotCount === 0) {
    return {
      shouldReview: false,
      reason: 'no_complete_aggregate_snapshot',
      snapshotCount,
      latestSnapshotId: null,
      latestSnapshotSha256: null,
      latestSnapshotUrl: null,
      modelInvocationAuthorized: false
    };
  }

  const latestSnapshot = [...growth.snapshots]
    .sort((left, right) => right.periodEnd.localeCompare(left.periodEnd) || right.id.localeCompare(left.id))[0];

  return {
    shouldReview: true,
    reason: 'complete_aggregate_snapshot_available',
    snapshotCount,
    latestSnapshotId: latestSnapshot.id,
    latestSnapshotSha256: createHash('sha256').update(JSON.stringify(latestSnapshot)).digest('hex'),
    latestSnapshotUrl: latestSnapshot.sourceEvidenceUrl,
    modelInvocationAuthorized: true
  };
}

async function run() {
  const growthArg = process.argv.slice(2).find((argument) => argument.startsWith('--growth='));
  const growthPath = growthArg
    ? path.resolve(growthArg.slice('--growth='.length))
    : path.join(process.cwd(), 'src', 'data', 'growth.json');
  const growth = JSON.parse(await fs.readFile(growthPath, 'utf8'));
  const assessment = assessGrowthReviewReadiness(growth);

  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, [
      `should_review=${assessment.shouldReview}`,
      `reason=${assessment.reason}`,
      `snapshot_count=${assessment.snapshotCount}`,
      `latest_snapshot_id=${assessment.latestSnapshotId ?? ''}`,
      `latest_snapshot_sha256=${assessment.latestSnapshotSha256 ?? ''}`,
      `latest_snapshot_url=${assessment.latestSnapshotUrl ?? ''}`,
      `model_invocation_authorized=${assessment.modelInvocationAuthorized}`,
      ''
    ].join('\n'));
  }

  console.log(JSON.stringify(assessment, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await run();
