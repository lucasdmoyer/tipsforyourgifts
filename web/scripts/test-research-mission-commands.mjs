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
  for (const directory of ['src/data', 'config', 'research/runs', 'research/reviews', 'social/drafts', 'src/data/blog', 'visuals/requests']) await fs.mkdir(path.join(fixtureRoot, directory), { recursive: true });
  const idea = {
    id: 'founder-idea-005', revision: 1, ideaType: 'content', thesisType: 'ritual_pairing', founderDisposition: 'approved_for_research',
    title: 'Field guide and observation tool for a curious friend'
  };
  const failedIdea = {
    id: 'founder-idea-006', revision: 1, ideaType: 'content', thesisType: 'recipient_friction', founderDisposition: 'approved_for_research',
    title: 'Observation upgrade for a careful neighborhood naturalist'
  };
  const executionFailedIdea = {
    id: 'founder-idea-007', revision: 1, ideaType: 'content', thesisType: 'recipient_friction', founderDisposition: 'approved_for_research',
    title: 'A careful retry path for a stalled gift research mission'
  };
  const reviewFailedIdea = {
    id: 'founder-idea-008', revision: 1, ideaType: 'content', thesisType: 'recipient_friction', founderDisposition: 'approved_for_research',
    title: 'A durable handoff when the independent editor cannot finish'
  };
  const strategy = { schemaVersion: '1.1.0', thoughtfulnessFramework: { minimumPairCoherenceScore: 80 }, ideas: [idea, failedIdea, executionFailedIdea, reviewFailedIdea] };
  const policy = { mode: 'founder_reviewed', automaticPromotion: { enabled: false, verifiedSuccessfulReleaseCount: 0, minimumSuccessfulFounderReviewedReleases: 10 } };
  await fs.writeFile(path.join(fixtureRoot, 'src/data/strategy.json'), `${JSON.stringify(strategy, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'config/publication-policy.json'), `${JSON.stringify(policy, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'visuals/article-visuals.json'), `${JSON.stringify({ articles: [{ slug: 'field-guide-observation-tool' }] }, null, 2)}\n`);

  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/start-research-mission.mjs'), '--idea-id=founder-idea-005', `--base-sha=${'a'.repeat(40)}`, '--workflow-run-id=12345', '--workflow-run-attempt=1', '--actor=github-actions[bot]', '--created-at=2026-08-03T10:00:00.000Z'], { cwd: fixtureRoot });
  const missionId = 'research-mission-12345-1';
  const missionPath = path.join(fixtureRoot, 'research/missions', `${missionId}.json`);
  const started = researchMissionSchema.parse(JSON.parse(await fs.readFile(missionPath, 'utf8')));
  if (started.status !== 'started' || started.idea.sha256 !== canonicalIdeaSha256(idea) || started.trigger.type !== 'approved_strategy_dispatch' || started.trigger.actor !== 'github-actions[bot]') throw new Error('start command did not create the expected founder-authorized mission envelope');

  const runId = '20260803-field-guide-observation-a1b2c3d4';
  const reviewPath = `research/reviews/${runId}.qa.v1.json`;
  const run = {
    runId, ideaId: idea.id, ideaRevision: idea.revision, ideaSha256: canonicalIdeaSha256(idea), draftAuthor: 'research-drafter-fixture',
    status: 'drafted', claims: [], article: { slug: 'field-guide-observation-tool', status: 'draft' },
    qa: { passed: false, reviewerRole: 'independent-editor', reviewerId: 'pending-independent-review', receiptPath: reviewPath, blockers: [], warnings: [] }
  };
  const social = { packId: 'field-guide-observation-tool-launch', researchRun: runId };
  await fs.writeFile(path.join(fixtureRoot, 'research/runs', `${runId}.json`), `${JSON.stringify(run, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'src/data/blog/field-guide-observation-tool.md'), '---\nstatus: draft\n---\nEvidence-backed draft.\n');
  await fs.writeFile(path.join(fixtureRoot, 'social/drafts/field-guide-observation-tool-launch.json'), `${JSON.stringify(social, null, 2)}\n`);

  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/create-review-receipt.mjs'), `--run-id=${runId}`, '--reviewer-id=evidence-red-team-12345', '--workflow-name=research-agent.yml', `--mission-id=${missionId}`, '--workflow-run-id=12345', '--verdict=passed', '--reviewed-at=2026-08-03T10:45:00.000Z'], { cwd: fixtureRoot });
  const review = JSON.parse(await fs.readFile(path.join(fixtureRoot, reviewPath), 'utf8'));
  if (review.schemaVersion !== '1.2.0' || review.workflowName !== 'research-agent.yml' || review.missionId !== missionId) throw new Error('review receipt did not preserve the trusted mission provenance');
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/promote-reviewed-run.mjs'), runId, `--receipt-path=${reviewPath}`], { cwd: fixtureRoot });

  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/complete-research-mission.mjs'), `--mission-id=${missionId}`, `--run-id=${runId}`, '--completed-at=2026-08-03T11:00:00.000Z'], { cwd: fixtureRoot });
  const completed = researchMissionSchema.parse(JSON.parse(await fs.readFile(missionPath, 'utf8')));
  if (completed.status !== 'completed' || completed.completion?.publicationReadiness !== 'founder_review_required' || completed.completion?.runId !== runId) throw new Error('complete command did not bind the expected outputs');

  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/start-research-mission.mjs'), '--idea-id=founder-idea-006', `--base-sha=${'b'.repeat(40)}`, '--workflow-run-id=12346', '--workflow-run-attempt=1', '--actor=github-actions[bot]', '--created-at=2026-08-03T12:00:00.000Z'], { cwd: fixtureRoot });
  const failedMissionId = 'research-mission-12346-1';
  const failedMissionPath = path.join(fixtureRoot, 'research/missions', `${failedMissionId}.json`);
  const failedRunId = '20260803-naturalist-observation-b1c2d3e4';
  const failedReviewPath = `research/reviews/${failedRunId}.qa.v1.json`;
  const failedRun = {
    runId: failedRunId, ideaId: failedIdea.id, ideaRevision: failedIdea.revision, ideaSha256: canonicalIdeaSha256(failedIdea), draftAuthor: 'research-drafter-fixture-two',
    status: 'drafted', claims: [], article: { slug: 'naturalist-observation-tool', status: 'draft' },
    qa: { passed: false, reviewerRole: 'independent-editor', reviewerId: 'pending-independent-review', receiptPath: failedReviewPath, blockers: [], warnings: [] }
  };
  const failedSocial = { packId: 'naturalist-observation-tool-launch', researchRun: failedRunId };
  await fs.writeFile(path.join(fixtureRoot, 'research/runs', `${failedRunId}.json`), `${JSON.stringify(failedRun, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'src/data/blog/naturalist-observation-tool.md'), '---\nstatus: draft\n---\nDraft with an evidence gap.\n');
  await fs.writeFile(path.join(fixtureRoot, 'social/drafts/naturalist-observation-tool-launch.json'), `${JSON.stringify(failedSocial, null, 2)}\n`);
  const findingsPath = path.join(fixtureRoot, 'editorial-review-result.json');
  await fs.writeFile(findingsPath, `${JSON.stringify({ schemaVersion: '1.0.0', runId: failedRunId, verdict: 'failed', blockers: ['The central recipient-fit claim needs a second exact-product independent source.'], warnings: ['Keep the article draft-only until the evidence gap is resolved.'] }, null, 2)}\n`);
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/create-review-receipt.mjs'), `--run-id=${failedRunId}`, '--reviewer-id=evidence-red-team-12346', '--workflow-name=research-agent.yml', `--mission-id=${failedMissionId}`, '--workflow-run-id=12346', '--findings-file=editorial-review-result.json', '--reviewed-at=2026-08-03T12:45:00.000Z'], { cwd: fixtureRoot });
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/mark-research-mission-qa-failed.mjs'), `--mission-id=${failedMissionId}`, `--run-id=${failedRunId}`, `--receipt-path=${failedReviewPath}`, '--failed-at=2026-08-03T12:46:00.000Z'], { cwd: fixtureRoot });
  const failedMission = researchMissionSchema.parse(JSON.parse(await fs.readFile(failedMissionPath, 'utf8')));
  if (failedMission.status !== 'qa_failed' || failedMission.qaFailureHandoff?.blockers.length !== 1 || failedMission.completion !== null) throw new Error('QA-failed command did not preserve the correction handoff');

  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/start-research-mission.mjs'), '--idea-id=founder-idea-007', `--base-sha=${'c'.repeat(40)}`, '--workflow-run-id=12347', '--workflow-run-attempt=1', '--actor=github-actions[bot]', '--created-at=2026-08-03T13:00:00.000Z'], { cwd: fixtureRoot });
  const executionFailedMissionId = 'research-mission-12347-1';
  const executionFailedMissionPath = path.join(fixtureRoot, 'research/missions', `${executionFailedMissionId}.json`);
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/mark-research-mission-research-failed.mjs'), `--mission-id=${executionFailedMissionId}`, '--reason-code=model_step_failed', '--failed-at=2026-08-03T13:05:00.000Z'], { cwd: fixtureRoot });
  const executionFailedMission = researchMissionSchema.parse(JSON.parse(await fs.readFile(executionFailedMissionPath, 'utf8')));
  if (executionFailedMission.status !== 'research_failed' || executionFailedMission.researchFailureHandoff?.reasonCode !== 'model_step_failed' || executionFailedMission.qaFailureHandoff !== null) throw new Error('Research-failed command did not preserve the clean execution failure handoff');

  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/start-research-mission.mjs'), '--idea-id=founder-idea-008', `--base-sha=${'d'.repeat(40)}`, '--workflow-run-id=12348', '--workflow-run-attempt=1', '--actor=github-actions[bot]', '--created-at=2026-08-03T14:00:00.000Z'], { cwd: fixtureRoot });
  const reviewFailedMissionId = 'research-mission-12348-1';
  const reviewFailedMissionPath = path.join(fixtureRoot, 'research/missions', `${reviewFailedMissionId}.json`);
  const reviewFailedRunId = '20260803-review-retry-c1d2e3f4';
  const reviewFailedSlug = 'review-retry-gift-pair';
  const reviewFailedRun = {
    runId: reviewFailedRunId, ideaId: reviewFailedIdea.id, ideaRevision: reviewFailedIdea.revision, ideaSha256: canonicalIdeaSha256(reviewFailedIdea), draftAuthor: 'research-drafter-fixture-three',
    status: 'drafted', claims: [], article: { slug: reviewFailedSlug, status: 'draft' },
    qa: { passed: false, reviewerRole: 'independent-editor', reviewerId: 'pending-independent-review', receiptPath: `research/reviews/${reviewFailedRunId}.qa.v1.json`, blockers: [], warnings: [] }
  };
  await fs.writeFile(path.join(fixtureRoot, 'research/runs', `${reviewFailedRunId}.json`), `${JSON.stringify(reviewFailedRun, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, `src/data/blog/${reviewFailedSlug}.md`), '---\nstatus: draft\n---\nExact draft preserved without a reviewer receipt.\n');
  await fs.writeFile(path.join(fixtureRoot, `social/drafts/${reviewFailedSlug}-launch.json`), `${JSON.stringify({ packId: `${reviewFailedSlug}-launch`, researchRun: reviewFailedRunId }, null, 2)}\n`);
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/mark-research-mission-review-failed.mjs'), `--mission-id=${reviewFailedMissionId}`, `--run-id=${reviewFailedRunId}`, '--reason-code=review_result_invalid', '--failed-at=2026-08-03T14:40:00.000Z'], { cwd: fixtureRoot });
  const reviewFailedMission = researchMissionSchema.parse(JSON.parse(await fs.readFile(reviewFailedMissionPath, 'utf8')));
  if (reviewFailedMission.status !== 'review_failed' || reviewFailedMission.reviewFailureHandoff?.reasonCode !== 'review_result_invalid' || reviewFailedMission.qaFailureHandoff !== null) throw new Error('Review-failed command did not preserve the exact draft without fabricating a QA receipt');
  console.log(JSON.stringify({ researchMissionCommandIntegration: 'passed', commands: 11, missionId, receiptSchemaVersion: review.schemaVersion, completionStatus: completed.status, publicationReadiness: completed.completion.publicationReadiness, failedMissionStatus: failedMission.status, failedReceiptPreserved: true, researchFailedMissionStatus: executionFailedMission.status, partialDraftPreserved: false, reviewFailedMissionStatus: reviewFailedMission.status, partialReviewPreserved: false, reviewReceiptFabricated: false }, null, 2));
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
