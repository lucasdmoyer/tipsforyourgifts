import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { automationFailureReceiptSchema } from './lib/automation-failure-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = process.cwd();
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-automation-failure-'));
const commandEnv = { ...process.env };
for (const name of ['GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_ACTOR', 'GITHUB_SHA', 'GITHUB_REF', 'GITHUB_EVENT_NAME', 'GITHUB_OUTPUT']) delete commandEnv[name];
try {
  const issueSha = 'a'.repeat(64);
  await execFileAsync(process.execPath, [
    path.join(scriptRoot, 'scripts/record-automation-failure.mjs'),
    '--workflow=strategy-intake.yml',
    '--stage=strategy_proposal',
    '--reason-code=model_step_failed',
    '--target-kind=founder_strategy_issue',
    '--target-id=77',
    `--target-sha256=${issueSha}`,
    '--target-url=https://github.com/lucasdmoyer/tipsforyourgifts/issues/77',
    '--workflow-run-id=12345',
    '--workflow-run-attempt=2',
    '--actor=lucasdmoyer',
    `--base-sha=${'b'.repeat(40)}`,
    '--ref=refs/heads/master',
    '--event-name=issues',
    '--recorded-at=2026-11-23T20:30:00.000Z'
  ], { cwd: fixtureRoot, env: commandEnv });
  const failureId = 'automation-failure-strategy-intake-run12345-attempt2';
  const receipt = automationFailureReceiptSchema.parse(JSON.parse(await fs.readFile(path.join(fixtureRoot, 'automation/failures', `${failureId}.json`), 'utf8')));
  assert.equal(receipt.target.sourceSha256, issueSha);
  assert.equal(receipt.workflow.baseSha, 'b'.repeat(40));
  assert.equal(receipt.handling.partialModelOutputPreserved, false);
  assert.equal(receipt.handling.authoritativeProposalPreserved, false);
  assert.equal(receipt.handling.reviewReceiptCreated, false);
  const snapshotSha = 'c'.repeat(64);
  await execFileAsync(process.execPath, [
    path.join(scriptRoot, 'scripts/record-automation-failure.mjs'),
    '--workflow=growth-review.yml',
    '--stage=growth_analysis',
    '--reason-code=output_invalid',
    '--target-kind=growth_snapshot',
    '--target-id=growth-snapshot-20261122-search-console',
    `--target-sha256=${snapshotSha}`,
    '--target-url=https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/12345',
    '--workflow-run-id=12347',
    '--workflow-run-attempt=1',
    '--actor=lucasdmoyer',
    `--base-sha=${'d'.repeat(40)}`,
    '--ref=refs/heads/master',
    '--event-name=schedule',
    '--recorded-at=2026-11-23T20:31:00.000Z'
  ], { cwd: fixtureRoot, env: commandEnv });
  const growthFailureId = 'automation-failure-growth-review-run12347-attempt1';
  const growthReceipt = automationFailureReceiptSchema.parse(JSON.parse(await fs.readFile(path.join(fixtureRoot, 'automation/failures', `${growthFailureId}.json`), 'utf8')));
  assert.equal(growthReceipt.target.kind, 'growth_snapshot');
  assert.equal(growthReceipt.target.sourceSha256, snapshotSha);
  assert.equal(growthReceipt.target.url, 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/12345');
  assert.equal(growthReceipt.handling.partialModelOutputPreserved, false);
  assert.equal(growthReceipt.handling.authoritativeProposalPreserved, false);
  assert.equal(growthReceipt.handling.reviewReceiptCreated, false);
  const candidateSha = 'e'.repeat(64);
  const candidateId = 'affiliate-link-sapiens-bookshop-v2';
  const candidateUrl = `https://github.com/lucasdmoyer/tipsforyourgifts/blob/${'f'.repeat(40)}/web/affiliate/candidates/${candidateId}.json`;
  await execFileAsync(process.execPath, [
    path.join(scriptRoot, 'scripts/record-automation-failure.mjs'),
    '--workflow=affiliate-link-review.yml',
    '--stage=affiliate_review',
    '--reason-code=credential_preflight_failed',
    '--target-kind=affiliate_link_candidate',
    `--target-id=${candidateId}`,
    `--target-sha256=${candidateSha}`,
    `--target-url=${candidateUrl}`,
    '--workflow-run-id=12348',
    '--workflow-run-attempt=3',
    '--actor=lucasdmoyer',
    `--base-sha=${'f'.repeat(40)}`,
    '--ref=refs/heads/master',
    '--event-name=workflow_dispatch',
    '--recorded-at=2026-11-23T20:32:00.000Z'
  ], { cwd: fixtureRoot, env: commandEnv });
  const affiliateFailureId = 'automation-failure-affiliate-link-review-run12348-attempt3';
  const affiliateReceipt = automationFailureReceiptSchema.parse(JSON.parse(await fs.readFile(path.join(fixtureRoot, 'automation/failures', `${affiliateFailureId}.json`), 'utf8')));
  assert.equal(affiliateReceipt.target.kind, 'affiliate_link_candidate');
  assert.equal(affiliateReceipt.target.id, candidateId);
  assert.equal(affiliateReceipt.target.sourceSha256, candidateSha);
  assert.equal(affiliateReceipt.target.url, candidateUrl);
  assert.equal(affiliateReceipt.handling.partialModelOutputPreserved, false);
  assert.equal(affiliateReceipt.handling.authoritativeProposalPreserved, false);
  assert.equal(affiliateReceipt.handling.reviewReceiptCreated, false);
  assert.equal(affiliateReceipt.handling.externalStateChanged, false);
  assert.equal(affiliateReceipt.handling.productionDeploymentAuthorized, false);
  const editorialSha = '1'.repeat(64);
  const editorialBaseSha = '2'.repeat(40);
  const editorialRunId = '20261123-editorial-recheck-a1b2c3d4';
  const editorialUrl = `https://github.com/lucasdmoyer/tipsforyourgifts/blob/${editorialBaseSha}/web/research/runs/${editorialRunId}.json`;
  await execFileAsync(process.execPath, [
    path.join(scriptRoot, 'scripts/record-automation-failure.mjs'),
    '--workflow=editorial-independent-review.yml',
    '--stage=editorial_review',
    '--reason-code=output_invalid',
    '--target-kind=editorial_run',
    `--target-id=${editorialRunId}`,
    `--target-sha256=${editorialSha}`,
    `--target-url=${editorialUrl}`,
    '--workflow-run-id=12349',
    '--workflow-run-attempt=1',
    '--actor=github-actions[bot]',
    `--base-sha=${editorialBaseSha}`,
    '--ref=refs/heads/master',
    '--event-name=push',
    '--recorded-at=2026-11-23T20:33:00.000Z'
  ], { cwd: fixtureRoot, env: commandEnv });
  const editorialFailureId = 'automation-failure-editorial-independent-review-run12349-attempt1';
  const editorialReceipt = automationFailureReceiptSchema.parse(JSON.parse(await fs.readFile(path.join(fixtureRoot, 'automation/failures', `${editorialFailureId}.json`), 'utf8')));
  assert.equal(editorialReceipt.target.kind, 'editorial_run');
  assert.equal(editorialReceipt.target.id, editorialRunId);
  assert.equal(editorialReceipt.target.sourceSha256, editorialSha);
  assert.equal(editorialReceipt.target.url, editorialUrl);
  assert.equal(editorialReceipt.handling.partialModelOutputPreserved, false);
  assert.equal(editorialReceipt.handling.authoritativeProposalPreserved, false);
  assert.equal(editorialReceipt.handling.reviewReceiptCreated, false);
  assert.equal(editorialReceipt.handling.externalStateChanged, false);
  assert.equal(editorialReceipt.handling.productionDeploymentAuthorized, false);
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/validate-automation-failures.mjs')], { cwd: fixtureRoot, env: commandEnv });
  await assert.rejects(execFileAsync(process.execPath, [
    path.join(scriptRoot, 'scripts/record-automation-failure.mjs'),
    '--workflow=strategy-intake.yml', '--stage=growth_analysis', '--reason-code=output_invalid', '--target-kind=founder_strategy_issue', '--target-id=77', `--target-sha256=${issueSha}`, '--target-url=https://github.com/lucasdmoyer/tipsforyourgifts/issues/77', '--workflow-run-id=12346', '--workflow-run-attempt=1', '--actor=lucasdmoyer', `--base-sha=${'b'.repeat(40)}`, '--ref=refs/heads/master', '--event-name=issues'
  ], { cwd: fixtureRoot, env: commandEnv }));
  console.log(JSON.stringify({ automationFailureCommandTests: 'passed', failureIds: [failureId, growthFailureId, affiliateFailureId, editorialFailureId], workflows: [receipt.workflow.name, growthReceipt.workflow.name, affiliateReceipt.workflow.name, editorialReceipt.workflow.name], stages: [receipt.stage, growthReceipt.stage, affiliateReceipt.stage, editorialReceipt.stage], reasonCodes: [receipt.reasonCode, growthReceipt.reasonCode, affiliateReceipt.reasonCode, editorialReceipt.reasonCode], partialModelOutputPreserved: false, authoritativeProposalPreserved: false, reviewReceiptFabricated: false, externalStateChanged: false, productionAuthorized: false }, null, 2));
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
