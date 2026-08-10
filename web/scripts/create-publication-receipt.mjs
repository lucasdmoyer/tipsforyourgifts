import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parsePublicationReceipt, rollbackTargetSchema } from './lib/publication-receipt-contract.mjs';
import { parsePublicationManifest } from './lib/publication-manifest-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const releaseSha = args['release-sha'];
const releaseMode = args.mode;
const sourceWorkflow = args['source-workflow'];
const previewUrl = args['preview-url'];
const rollbackTargetPath = args['rollback-target'];
const manifestPath = args.manifest;
const outputPath = args.output ?? 'publication-receipt.json';
const runId = process.env.GITHUB_RUN_ID;
const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
const repository = process.env.GITHUB_REPOSITORY;
const actor = process.env.GITHUB_ACTOR;
const eventName = process.env.GITHUB_EVENT_NAME;

if (!releaseSha || !releaseMode || !sourceWorkflow || !previewUrl || !rollbackTargetPath || !manifestPath || !runId || !Number.isInteger(runAttempt) || !repository || !actor || !eventName) {
  throw new Error('Release SHA, mode, source workflow, preview URL, rollback target, publication manifest, and GitHub workflow identity are required');
}

const rollbackTarget = rollbackTargetSchema.parse(JSON.parse(await fs.readFile(rollbackTargetPath, 'utf8')));
const publicationManifestRaw = await fs.readFile(manifestPath);
const publicationManifest = parsePublicationManifest(JSON.parse(publicationManifestRaw.toString('utf8')));
const now = new Date().toISOString();
const receipt = parsePublicationReceipt({
  schemaVersion: '1.0.0',
  receiptId: `firebase-${releaseSha.slice(0, 12)}-${runId}-${runAttempt}`,
  projectId: 'tipsforyourgifts',
  hostingChannel: 'live',
  releaseSha,
  releaseMode,
  sourceWorkflow,
  preview: { url: previewUrl, verifiedAt: now },
  production: { url: 'https://tipsforyourgifts.web.app/', verifiedAt: now },
  publicationManifest: {
    manifestId: publicationManifest.manifestId,
    path: 'publication-manifest.json',
    sha256: createHash('sha256').update(publicationManifestRaw).digest('hex'),
    contentSetSha256: publicationManifest.contentSetSha256,
    articles: publicationManifest.counts.articles,
    independentReviews: publicationManifest.counts.independentReviews,
    socialLaunchPacks: publicationManifest.counts.socialLaunchPacks,
    socialDrafts: publicationManifest.counts.socialDrafts,
    missionBoundArticles: publicationManifest.counts.missionBoundArticles,
    affiliateLinks: publicationManifest.counts.affiliateLinks
  },
  rollbackTarget,
  gates: {
    exactMasterSha: true,
    independentQaReceipt: true,
    deterministicValidation: true,
    staticBuild: true,
    builtArtifactSmoke: true,
    publicationManifestValidated: true,
    firebaseExactShaPreview: true,
    previewSmoke: true,
    rollbackTargetRecorded: true,
    productionSmoke: true
  },
  workflow: { repository, runId, runAttempt, actor, eventName },
  createdAt: now,
  status: 'verified_success'
});
const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
const receiptSha256 = createHash('sha256').update(serialized).digest('hex');
await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await fs.writeFile(outputPath, serialized, { flag: 'wx' });
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `receipt_path=${outputPath}\nreceipt_sha256=${receiptSha256}\nreceipt_id=${receipt.receiptId}\n`);
console.log(JSON.stringify({ receiptId: receipt.receiptId, releaseSha, publicationManifestId: publicationManifest.manifestId, publicationManifestSha256: receipt.publicationManifest.sha256, rollbackChannel: rollbackTarget.targetChannel, receiptSha256, status: receipt.status }, null, 2));
