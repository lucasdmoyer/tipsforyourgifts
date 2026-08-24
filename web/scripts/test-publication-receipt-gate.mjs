import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { parsePublicationReceipt } from './lib/publication-receipt-contract.mjs';

const execFileAsync = promisify(execFile);

const releaseSha = 'a'.repeat(40);
const base = {
  schemaVersion: '1.0.0',
  receiptId: `firebase-${releaseSha.slice(0, 12)}-12345-1`,
  projectId: 'tipsforyourgifts',
  hostingChannel: 'live',
  releaseSha,
  releaseMode: 'founder_reviewed',
  sourceWorkflow: 'firebase-production',
  preview: { url: 'https://tipsforyourgifts--pr-42.web.app/', verifiedAt: '2026-08-09T12:00:00.000Z' },
  production: { url: 'https://tipsforyourgifts.web.app/', verifiedAt: '2026-08-09T12:01:00.000Z' },
  publicationManifest: {
    manifestId: `publication-set-${'b'.repeat(16)}`,
    path: 'publication-manifest.json',
    sha256: 'c'.repeat(64),
    contentSetSha256: 'b'.repeat(64),
    articles: 4,
    independentReviews: 4,
    socialLaunchPacks: 3,
    socialDrafts: 24,
    missionBoundArticles: 0,
    affiliateLinks: 0
  },
  rollbackTarget: {
    strategy: 'firebase_channel_clone', projectId: 'tipsforyourgifts', siteId: 'tipsforyourgifts', sourceChannel: 'live',
    targetChannel: 'rollback-aaaaaaaaaaaa-12345-1', protectsReleaseSha: releaseSha, clonedAt: '2026-08-09T11:59:00.000Z', expiresAfter: '30d', firebaseToolsVersion: '15.26.0',
    rollbackCommand: 'firebase hosting:clone tipsforyourgifts:rollback-aaaaaaaaaaaa-12345-1 tipsforyourgifts:live --project tipsforyourgifts', status: 'verified_clone'
  },
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
  workflow: { repository: 'lucasdmoyer/tipsforyourgifts', runId: '12345', runAttempt: 1, actor: 'lucasdmoyer', eventName: 'workflow_dispatch' },
  createdAt: '2026-08-09T12:01:00.000Z',
  status: 'verified_success'
};
const clone = (value) => structuredClone(value);
function expectFailure(label, mutate) {
  const candidate = clone(base);
  mutate(candidate);
  assert.throws(() => parsePublicationReceipt(candidate), undefined, label);
}

parsePublicationReceipt(base);
expectFailure('wrong Firebase project rejected', (receipt) => { receipt.projectId = 'some-other-project'; });
expectFailure('non-preview host rejected', (receipt) => { receipt.preview.url = 'https://example.com/'; });
expectFailure('HTTP preview rejected', (receipt) => { receipt.preview.url = 'http://tipsforyourgifts--pr-42.web.app/'; });
expectFailure('wrong production URL rejected', (receipt) => { receipt.production.url = 'https://tipsforyourgifts.firebaseapp.com/'; });
expectFailure('manifest ID must bind content set', (receipt) => { receipt.publicationManifest.manifestId = 'publication-set-0000000000000000'; });
expectFailure('manifest bytes must be hash bound', (receipt) => { receipt.publicationManifest.sha256 = 'not-a-digest'; });
expectFailure('every article requires independent review', (receipt) => { receipt.publicationManifest.independentReviews = 3; });
expectFailure('mission count cannot exceed articles', (receipt) => { receipt.publicationManifest.missionBoundArticles = 5; });
expectFailure('manifest validation gate cannot be weakened', (receipt) => { receipt.gates.publicationManifestValidated = false; });
expectFailure('receipt ID must bind workflow and SHA', (receipt) => { receipt.receiptId = 'firebase-aaaaaaaaaaaa-99999-1'; });
expectFailure('rollback must bind release SHA', (receipt) => { receipt.rollbackTarget.protectsReleaseSha = 'b'.repeat(40); });
expectFailure('rollback channel must bind release SHA', (receipt) => { receipt.rollbackTarget.targetChannel = 'rollback-bbbbbbbbbbbb-12345-1'; });
expectFailure('rollback command must bind exact channel', (receipt) => { receipt.rollbackTarget.rollbackCommand = 'firebase hosting:clone something-else'; });
expectFailure('rollback clone must use live source', (receipt) => { receipt.rollbackTarget.sourceChannel = 'preview'; });
expectFailure('failed smoke cannot be recorded as success', (receipt) => { receipt.gates.productionSmoke = false; });
expectFailure('manual workflow cannot claim automatic mode', (receipt) => { receipt.releaseMode = 'automatic_after_proven'; });
expectFailure('manual workflow cannot claim push evidence', (receipt) => { receipt.workflow.eventName = 'push'; });
expectFailure('unexpected fields rejected', (receipt) => { receipt.notes = 'trust me'; });

const automatic = clone(base);
automatic.releaseMode = 'automatic_after_proven';
automatic.sourceWorkflow = 'firebase-auto-production';
automatic.workflow.eventName = 'push';
parsePublicationReceipt(automatic);

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-publication-receipt-'));
let commandReceipt;
try {
  const scriptRoot = process.cwd();
  const rollbackPath = path.join(fixtureRoot, 'rollback-target.json');
  const receiptPath = path.join(fixtureRoot, 'publication-receipt.json');
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/create-firebase-rollback-target.mjs'), `--release-sha=${releaseSha}`, '--target-channel=rollback-aaaaaaaaaaaa-12345-1', `--output=${rollbackPath}`], { cwd: fixtureRoot });
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/create-publication-receipt.mjs'), `--release-sha=${releaseSha}`, '--mode=founder_reviewed', '--source-workflow=firebase-production', '--preview-url=https://tipsforyourgifts--release-test.web.app/', `--rollback-target=${rollbackPath}`, `--manifest=${path.join(scriptRoot, 'public/publication-manifest.json')}`, `--output=${receiptPath}`], {
    cwd: fixtureRoot,
    env: { ...process.env, GITHUB_REPOSITORY: 'lucasdmoyer/tipsforyourgifts', GITHUB_RUN_ID: '12345', GITHUB_RUN_ATTEMPT: '1', GITHUB_ACTOR: 'lucasdmoyer', GITHUB_EVENT_NAME: 'workflow_dispatch' }
  });
  commandReceipt = parsePublicationReceipt(JSON.parse(await fs.readFile(receiptPath, 'utf8')));
  assert.equal(commandReceipt.publicationManifest.articles, commandReceipt.publicationManifest.independentReviews, 'receipt command must bind one independent review per article');
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
console.log(JSON.stringify({ publicationReceiptNegativeGateTests: 'passed', checks: 18, modesVerified: 2, commandIntegration: 'passed', publicationManifestId: commandReceipt.publicationManifest.manifestId }, null, 2));
