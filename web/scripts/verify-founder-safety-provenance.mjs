import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parsePublicationManifest } from './lib/publication-manifest-contract.mjs';
import { FOUNDER_SAFETY_REPOSITORY } from './lib/founder-safety-review-contract.mjs';

const execFileAsync = promisify(execFile);
const FOUNDER_SAFETY_SIGNER_WORKFLOW = `${FOUNDER_SAFETY_REPOSITORY}/.github/workflows/editorial-founder-safety-review.yml`;

export function founderSafetyAttestationArgs(approval) {
  return [
    'attestation',
    'verify',
    path.resolve(process.cwd(), approval.path),
    '--repo',
    FOUNDER_SAFETY_REPOSITORY,
    '--signer-workflow',
    FOUNDER_SAFETY_SIGNER_WORKFLOW,
    '--source-ref',
    'refs/heads/master',
    '--source-digest',
    approval.sourceCommitSha
  ];
}

export function assertFounderSafetyWorkflowRun(run, approval, founderLogin = 'lucasdmoyer') {
  const failures = [];
  if (run.repository?.full_name !== FOUNDER_SAFETY_REPOSITORY) failures.push('repository mismatch');
  if (run.path !== '.github/workflows/editorial-founder-safety-review.yml') failures.push('workflow path mismatch');
  if (run.event !== 'workflow_dispatch') failures.push('event was not workflow_dispatch');
  if (run.head_branch !== 'master') failures.push('workflow did not run from master');
  if (run.head_sha !== approval.sourceCommitSha) failures.push('source commit mismatch');
  if (String(run.id) !== approval.workflowRunId) failures.push('workflow run ID mismatch');
  if (String(run.run_attempt) !== approval.runAttempt) failures.push('workflow run attempt mismatch');
  if (run.actor?.login !== founderLogin) failures.push('workflow actor mismatch');
  if (run.status !== 'completed' || run.conclusion !== 'success') failures.push('workflow did not complete successfully');
  if (failures.length > 0) throw new Error(`Founder safety workflow provenance failed: ${failures.join('; ')}`);
  return true;
}

async function main() {
  const manifestArgument = process.argv.slice(2).find((argument) => argument.startsWith('--manifest='));
  if (!manifestArgument) throw new Error('Usage: node scripts/verify-founder-safety-provenance.mjs --manifest=<publication-manifest.json>');
  const manifestPath = path.resolve(process.cwd(), manifestArgument.slice('--manifest='.length));
  const manifest = parsePublicationManifest(JSON.parse(await fs.readFile(manifestPath, 'utf8')));
  const approvals = manifest.articles.filter((article) => article.founderSafetyApproval).map((article) => ({ runId: article.researchRunId, ...article.founderSafetyApproval }));
  if (approvals.length === 0) {
    console.log(JSON.stringify({ founderSafetyWorkflowProvenance: 'passed', approvalsVerified: 0, networkCalls: 0 }, null, 2));
    return;
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required to verify founder safety workflow provenance');
  for (const approval of approvals) {
    const response = await fetch(`https://api.github.com/repos/${FOUNDER_SAFETY_REPOSITORY}/actions/runs/${approval.workflowRunId}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!response.ok) throw new Error(`${approval.runId}: GitHub Actions provenance lookup failed with HTTP ${response.status}`);
    assertFounderSafetyWorkflowRun(await response.json(), approval);
    await execFileAsync('gh', founderSafetyAttestationArgs(approval), { env: { ...process.env, GH_TOKEN: token } });
  }
  console.log(JSON.stringify({ founderSafetyWorkflowProvenance: 'passed', approvalsVerified: approvals.length, githubRunsVerified: approvals.length, receiptAttestationsVerified: approvals.length }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
