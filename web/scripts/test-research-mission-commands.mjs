import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { canonicalIdeaSha256, researchMissionSchema } from './lib/research-mission-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = process.cwd();
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-research-mission-'));
try {
  for (const directory of ['src/data', 'config', 'research/runs', 'research/reviews', 'social/drafts', 'src/data/blog']) await fs.mkdir(path.join(fixtureRoot, directory), { recursive: true });
  const idea = {
    id: 'founder-idea-005', revision: 1, ideaType: 'content', thesisType: 'ritual_pairing', founderDisposition: 'approved_for_research',
    title: 'Field guide and observation tool for a curious friend'
  };
  const strategy = { schemaVersion: '1.1.0', thoughtfulnessFramework: { minimumPairCoherenceScore: 80 }, ideas: [idea] };
  const policy = { mode: 'founder_reviewed', automaticPromotion: { enabled: false, verifiedSuccessfulReleaseCount: 0, minimumSuccessfulFounderReviewedReleases: 10 } };
  await fs.writeFile(path.join(fixtureRoot, 'src/data/strategy.json'), `${JSON.stringify(strategy, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'config/publication-policy.json'), `${JSON.stringify(policy, null, 2)}\n`);

  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/start-research-mission.mjs'), '--idea-id=founder-idea-005', `--base-sha=${'a'.repeat(40)}`, '--workflow-run-id=12345', '--workflow-run-attempt=1', '--actor=github-actions[bot]', '--created-at=2026-08-03T10:00:00.000Z'], { cwd: fixtureRoot });
  const missionId = 'research-mission-12345-1';
  const missionPath = path.join(fixtureRoot, 'research/missions', `${missionId}.json`);
  const started = researchMissionSchema.parse(JSON.parse(await fs.readFile(missionPath, 'utf8')));
  if (started.status !== 'started' || started.idea.sha256 !== canonicalIdeaSha256(idea) || started.trigger.type !== 'approved_strategy_dispatch' || started.trigger.actor !== 'github-actions[bot]') throw new Error('start command did not create the expected founder-authorized mission envelope');

  const runId = '20260803-field-guide-observation-a1b2c3d4';
  const reviewPath = `research/reviews/${runId}.qa.v1.json`;
  const run = { runId, ideaId: idea.id, ideaRevision: idea.revision, ideaSha256: canonicalIdeaSha256(idea), status: 'validated', article: { slug: 'field-guide-observation-tool', status: 'publication_ready' }, qa: { passed: true, receiptPath: reviewPath } };
  const social = { packId: 'field-guide-observation-tool-launch', researchRun: runId };
  const review = { runId, workflowRunId: '12345', verdict: 'passed', blockers: [] };
  await fs.writeFile(path.join(fixtureRoot, 'research/runs', `${runId}.json`), `${JSON.stringify(run, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'src/data/blog/field-guide-observation-tool.md'), '---\nstatus: publication_ready\n---\nEvidence-backed draft.\n');
  await fs.writeFile(path.join(fixtureRoot, 'social/drafts/field-guide-observation-tool-launch.json'), `${JSON.stringify(social, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, reviewPath), `${JSON.stringify(review, null, 2)}\n`);

  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/complete-research-mission.mjs'), `--mission-id=${missionId}`, `--run-id=${runId}`, '--completed-at=2026-08-03T11:00:00.000Z'], { cwd: fixtureRoot });
  const completed = researchMissionSchema.parse(JSON.parse(await fs.readFile(missionPath, 'utf8')));
  if (completed.status !== 'completed' || completed.completion?.publicationReadiness !== 'founder_review_required' || completed.completion?.runId !== runId) throw new Error('complete command did not bind the expected outputs');
  console.log(JSON.stringify({ researchMissionCommandIntegration: 'passed', commands: 2, missionId, completionStatus: completed.status, publicationReadiness: completed.completion.publicationReadiness }, null, 2));
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
