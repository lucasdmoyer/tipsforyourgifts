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
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/validate-automation-failures.mjs')], { cwd: fixtureRoot, env: commandEnv });
  await assert.rejects(execFileAsync(process.execPath, [
    path.join(scriptRoot, 'scripts/record-automation-failure.mjs'),
    '--workflow=strategy-intake.yml', '--stage=growth_analysis', '--reason-code=output_invalid', '--target-kind=founder_strategy_issue', '--target-id=77', `--target-sha256=${issueSha}`, '--target-url=https://github.com/lucasdmoyer/tipsforyourgifts/issues/77', '--workflow-run-id=12346', '--workflow-run-attempt=1', '--actor=lucasdmoyer', `--base-sha=${'b'.repeat(40)}`, '--ref=refs/heads/master', '--event-name=issues'
  ], { cwd: fixtureRoot, env: commandEnv }));
  console.log(JSON.stringify({ automationFailureCommandTests: 'passed', failureId, workflow: receipt.workflow.name, stage: receipt.stage, reasonCode: receipt.reasonCode, partialModelOutputPreserved: false, authoritativeProposalPreserved: false, reviewReceiptFabricated: false, externalStateChanged: false, productionAuthorized: false }, null, 2));
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
