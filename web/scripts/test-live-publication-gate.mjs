import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { parseLivePublicationState, summarizeVerifiedContentRelease, validateLivePublicationState } from './lib/live-publication-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const liveStateWorkflow = await fs.readFile(path.join(scriptRoot, '..', '..', '.github', 'workflows', 'publication-live-state.yml'), 'utf8');
assert.match(liveStateWorkflow, /workflow_run:/, 'live-state recorder must follow completed release workflows');
assert.match(liveStateWorkflow, /ref: master/, 'write-capable recorder must checkout trusted master');
assert.match(liveStateWorkflow, /actions\/download-artifact@v5/, 'cross-run receipt download must use the current artifact action');
assert.match(liveStateWorkflow, /run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/, 'receipt download must bind the triggering run');
assert.match(liveStateWorkflow, /publication:live:record/, 'workflow must use the strict recorder');
assert.match(liveStateWorkflow, /receipt_path="\$\(realpath "\$\{receipt_paths\[0\]\}"\)"/, 'workflow must pass an absolute receipt path across the npm prefix boundary');
assert.match(liveStateWorkflow, /--receipt="\$receipt_path"/, 'strict recorder must receive the absolute receipt path');
assert.match(liveStateWorkflow, /gh pr merge "\$pr_url" --auto --squash/, 'receipt-only PR must remain check-gated');
const releaseSha = 'a'.repeat(40);
const receipt = {
  schemaVersion: '1.0.0', receiptId: 'firebase-aaaaaaaaaaaa-12345-1', projectId: 'tipsforyourgifts', hostingChannel: 'live', releaseSha,
  releaseMode: 'founder_reviewed', sourceWorkflow: 'firebase-production',
  preview: { url: 'https://tipsforyourgifts--release-test.web.app/', verifiedAt: '2026-08-09T12:00:00.000Z' },
  production: { url: 'https://tipsforyourgifts.web.app/', verifiedAt: '2026-08-09T12:01:00.000Z' },
  publicationManifest: { manifestId: `publication-set-${'b'.repeat(16)}`, path: 'publication-manifest.json', sha256: 'c'.repeat(64), contentSetSha256: 'b'.repeat(64), articles: 4, independentReviews: 4, socialLaunchPacks: 3, socialDrafts: 24, missionBoundArticles: 0, affiliateLinks: 0 },
  rollbackTarget: { strategy: 'firebase_channel_clone', projectId: 'tipsforyourgifts', siteId: 'tipsforyourgifts', sourceChannel: 'live', targetChannel: 'rollback-aaaaaaaaaaaa-12345-1', protectsReleaseSha: releaseSha, clonedAt: '2026-08-09T11:59:00.000Z', expiresAfter: '30d', firebaseToolsVersion: '15.26.0', rollbackCommand: 'firebase hosting:clone tipsforyourgifts:rollback-aaaaaaaaaaaa-12345-1 tipsforyourgifts:live --project tipsforyourgifts', status: 'verified_clone' },
  gates: { exactMasterSha: true, independentQaReceipt: true, deterministicValidation: true, staticBuild: true, builtArtifactSmoke: true, publicationManifestValidated: true, firebaseExactShaPreview: true, previewSmoke: true, rollbackTargetRecorded: true, productionSmoke: true },
  workflow: { repository: 'lucasdmoyer/tipsforyourgifts', runId: '12345', runAttempt: 1, actor: 'lucasdmoyer', eventName: 'workflow_dispatch' },
  createdAt: '2026-08-09T12:01:00.000Z', status: 'verified_success'
};
const receiptRaw = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
const emptyState = { schemaVersion: '1.0.0', projectId: 'tipsforyourgifts', siteId: 'tipsforyourgifts', hostingChannel: 'live', productionUrl: 'https://tipsforyourgifts.web.app/', status: 'no_verified_managed_release', updatedAt: null, latestVerifiedContentRelease: null };
assert.deepEqual(validateLivePublicationState(emptyState), []);
const summary = summarizeVerifiedContentRelease(receipt, receiptRaw);
const validState = { ...emptyState, status: 'verified_managed_content_release', updatedAt: summary.createdAt, latestVerifiedContentRelease: summary };
assert.deepEqual(validateLivePublicationState(validState, new Map([[summary.receiptPath, { raw: receiptRaw, data: receipt }]])), []);

function expectFailure(label, mutate, expectedText) {
  const state = structuredClone(validState);
  const records = new Map([[summary.receiptPath, { raw: receiptRaw, data: structuredClone(receipt) }]]);
  mutate(state, records);
  const issues = validateLivePublicationState(state, records);
  if (!issues.join('\n').toLowerCase().includes(expectedText.toLowerCase())) throw new Error(`${label}: expected ${expectedText}, received ${JSON.stringify(issues)}`);
}
expectFailure('missing receipt', (_state, records) => records.clear(), 'missing');
expectFailure('digest drift', (state) => { state.latestVerifiedContentRelease.receiptSha256 = 'd'.repeat(64); }, 'differs');
expectFailure('manifest drift', (state) => { state.latestVerifiedContentRelease.publicationManifest.articles = 5; }, 'differs');
expectFailure('status mismatch', (state) => { state.status = 'no_verified_managed_release'; }, 'cannot claim');
expectFailure('timestamp mismatch', (state) => { state.updatedAt = '2026-08-09T12:02:00.000Z'; }, 'must bind');
expectFailure('unexpected field', (state) => { state.notes = 'trust me'; }, 'unrecognized');

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-live-publication-'));
await fs.mkdir(path.join(fixtureRoot, 'config'), { recursive: true });
await fs.writeFile(path.join(fixtureRoot, 'config', 'live-publication.json'), `${JSON.stringify(emptyState, null, 2)}\n`);
await fs.writeFile(path.join(fixtureRoot, 'publication-receipt.json'), receiptRaw);
await execFileAsync(process.execPath, [path.join(scriptRoot, 'record-live-publication.mjs'), '--receipt=publication-receipt.json', '--expected-workflow-run-id=12345', `--expected-release-sha=${releaseSha}`, '--expected-source-workflow=firebase-production'], { cwd: fixtureRoot });
const recorded = parseLivePublicationState(JSON.parse(await fs.readFile(path.join(fixtureRoot, 'config', 'live-publication.json'), 'utf8')));
assert.equal(recorded.latestVerifiedContentRelease.receiptId, receipt.receiptId);
assert.equal(recorded.latestVerifiedContentRelease.receiptSha256, summary.receiptSha256);
assert.deepEqual(await fs.readFile(path.join(fixtureRoot, summary.receiptPath)), receiptRaw);
const duplicate = await execFileAsync(process.execPath, [path.join(scriptRoot, 'record-live-publication.mjs'), '--receipt=publication-receipt.json'], { cwd: fixtureRoot });
assert.match(duplicate.stdout, /content_set_already_recorded/);

console.log(JSON.stringify({ livePublicationGateTests: 'passed', negativeChecks: 6, workflowSafetyChecks: 8, recorderIntegration: 'passed', duplicateContentSetNoOp: 'passed' }, null, 2));
