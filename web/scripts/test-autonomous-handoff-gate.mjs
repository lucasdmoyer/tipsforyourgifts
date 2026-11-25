import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parse } from 'yaml';

const webRoot = process.cwd();
const repositoryRoot = path.resolve(webRoot, '..');
const workflowRoot = path.join(repositoryRoot, '.github', 'workflows');

async function readWorkflow(name) {
  const raw = await fs.readFile(path.join(workflowRoot, name), 'utf8');
  return { raw, parsed: parse(raw) };
}

function findStep(job, name) {
  return job.steps.find((step) => step.name === name);
}

function stepIndex(job, name) {
  return job.steps.findIndex((step) => step.name === name);
}

const strategy = await readWorkflow('strategy-approved-launch.yml');
const research = await readWorkflow('research-agent.yml');
const automatic = await readWorkflow('firebase-auto-production.yml');
const policy = JSON.parse(await fs.readFile(path.join(webRoot, 'config', 'publication-policy.json'), 'utf8'));

const strategyPush = strategy.parsed.on?.push;
assert.deepEqual(strategyPush?.branches, ['master'], 'strategy approval handoff must observe only master');
assert.deepEqual(strategyPush?.paths, ['web/src/data/strategy.json'], 'strategy handoff must react only to the governed strategy ledger');
assert.equal(strategy.parsed.permissions?.contents, 'read', 'strategy handoff needs read-only repository contents');
assert.equal(strategy.parsed.permissions?.actions, 'write', 'strategy handoff needs workflow-dispatch authority');

const launchJob = strategy.parsed.jobs?.classify_and_launch;
assert.ok(launchJob, 'strategy handoff job is missing');
const classifyStep = findStep(launchJob, 'Classify the exact strategy transition');
const gateStep = findStep(launchJob, 'Re-run every deterministic gate before dispatch');
const dispatchStep = findStep(launchJob, 'Dispatch the approved research mission');
assert.ok(classifyStep && gateStep && dispatchStep, 'strategy handoff must classify, validate, and dispatch');
assert.ok(stepIndex(launchJob, classifyStep.name) < stepIndex(launchJob, gateStep.name), 'strategy classification must precede validation');
assert.ok(stepIndex(launchJob, gateStep.name) < stepIndex(launchJob, dispatchStep.name), 'validation must precede research dispatch');
assert.equal(dispatchStep.if, "steps.transition.outputs.launch_research == 'true'", 'only an exact approval transition may dispatch research');
assert.match(gateStep.run, /npm run validate[\s\S]*npm run build[\s\S]*npm run smoke/, 'strategy handoff must run the complete local release gates');
assert.match(dispatchStep.run, /gh workflow run research-agent\.yml/, 'strategy handoff must dispatch the governed research workflow');
assert.match(dispatchStep.run, /--ref master/, 'research dispatch must execute trusted master workflow bytes');
assert.match(dispatchStep.run, /-f idea_id="\$IDEA_ID"/, 'research dispatch must pass only the classified idea ID');

const researchDispatch = research.parsed.on?.workflow_dispatch;
assert.equal(researchDispatch?.inputs?.idea_id?.required, true, 'research workflow requires the founder-approved idea ID');
assert.equal(research.parsed.permissions?.contents, 'read', 'model workflow default contents authority must remain read-only');
const researchJob = research.parsed.jobs?.research;
const qualityJob = research.parsed.jobs?.quality_review;
const writerJob = research.parsed.jobs?.open_pull_request;
assert.ok(researchJob && qualityJob && writerJob, 'research, independent QA, and detached writer jobs are all required');
assert.equal(writerJob.permissions?.contents, 'write', 'only the detached writer may push the reviewed branch');
assert.equal(writerJob.permissions?.['pull-requests'], 'write', 'only the detached writer may open the review pull request');
assert.equal(researchJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 1, 'research drafting needs exactly one Codex step');
assert.equal(qualityJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 1, 'independent QA needs exactly one separate Codex step');
assert.equal(writerJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 0, 'the GitHub writer must never receive a model step');
assert.match(research.raw, /web\/visuals\/requests\/<run-id>-visuals\.json/, 'research drafting must create a versioned visual-production request when approved art is absent');
assert.match(research.raw, /generation\.attempted false/, 'research drafting must not generate or claim visual output');
assert.doesNotMatch(research.raw, /web\/visuals\/article-visuals\.json\|web\/public\/blog-images/, 'draft and review allowlists must not permit registry or public-image mutation');

const visualAssessmentStep = findStep(qualityJob, 'Prove reviewer isolation and route the visual handoff');
assert.ok(visualAssessmentStep, 'independent QA must route the visual handoff');
assert.match(visualAssessmentStep.run, /research:visual:assess/, 'visual readiness must be classified by the deterministic contract');
assert.match(visualAssessmentStep.run, /release_route" = "publication_ready"[\s\S]*review:promote/, 'only a visually ready bundle may be promoted');
assert.match(visualAssessmentStep.run, /release_route" = "visual_pending"[\s\S]*remain unpromoted/, 'visual-pending drafts must remain unpromoted');
assert.match(visualAssessmentStep.run, /research:mission:visual-pending/, 'visual-pending work must become durable mission state');

const openPrStep = findStep(writerJob, 'Open founder-review pull request');
const autoMergeStep = findStep(writerJob, 'Enable check-gated auto-merge only under the proven policy');
assert.ok(openPrStep && autoMergeStep, 'research handoff must open a review PR and evaluate the proven policy');
assert.match(openPrStep.run, /--base master/, 'research output must return through a master-based review pull request');
assert.match(openPrStep.run, /gh pr create/, 'detached writer must create the review pull request');
assert.match(openPrStep.run, /RELEASE_ROUTE" = "visual_pending"[\s\S]*Visual production handoff/, 'visual-pending work must open an explicit queue handoff PR');
assert.match(autoMergeStep.run, /publication-policy\.json/, 'auto-merge decision must read the founder-controlled publication policy');
assert.match(autoMergeStep.run, /REVIEW_ROUTE" = "founder_safety"[\s\S]*auto-merge is disabled/, 'high-risk research must never request auto-merge');
assert.match(autoMergeStep.run, /RELEASE_ROUTE" = "visual_pending"[\s\S]*cannot auto-merge/, 'visual-pending research must never request auto-merge');
assert.match(autoMergeStep.run, /gh pr merge --auto --squash "\$PR_URL"/, 'only the proven policy may request check-gated squash auto-merge');

const automaticPush = automatic.parsed.on?.push;
assert.deepEqual(automaticPush?.branches, ['master'], 'automatic Firebase publication must observe only master');
assert.ok(automaticPush?.paths?.includes('web/**'), 'automatic publication must observe reviewed web changes');
const policyJob = automatic.parsed.jobs?.policy_gate;
const previewJob = automatic.parsed.jobs?.preview;
const releaseJob = automatic.parsed.jobs?.release;
assert.ok(policyJob && previewJob && releaseJob, 'automatic publication requires policy, preview, and release jobs');
assert.equal(previewJob.needs, 'policy_gate', 'Firebase preview must wait for the policy gate');
assert.equal(previewJob.if, "needs.policy_gate.outputs.enabled == 'true'", 'disabled policy must stop before Firebase preview authority');
assert.equal(releaseJob.needs, 'preview', 'live release must wait for the exact preview');
assert.equal(releaseJob.environment?.name, 'production', 'automatic live mutation must remain inside the production environment');
assert.equal(releaseJob.environment?.url, '${{ needs.preview.outputs.preview_url }}', 'production review must expose the exact preview URL');

assert.equal(policy.mode, 'founder_reviewed', 'current repository mode must remain founder-reviewed');
assert.equal(policy.automaticPromotion.enabled, false, 'automatic publication must remain dormant until the proven-policy approval');
assert.equal(policy.automaticPromotion.minimumSuccessfulFounderReviewedReleases, 10, 'automatic mode still requires ten founder-reviewed releases');

console.log(JSON.stringify({
  autonomousHandoffGateTests: 'passed',
  handoffs: [
    'strategy_approval_to_research_dispatch',
    'research_to_independent_qa',
    'editorial_qa_to_visual_production_queue',
    'qa_to_detached_pr_writer',
    'proven_policy_to_check_gated_merge',
    'master_to_exact_preview_to_firebase_release'
  ],
  modelJobsWithGithubWrite: 0,
  highRiskAutoMergeAllowed: false,
  automaticPublicationEnabled: false,
  productionMutationAuthorized: false
}, null, 2));
