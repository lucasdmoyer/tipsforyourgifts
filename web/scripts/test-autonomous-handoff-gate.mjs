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
const opportunity = await readWorkflow('opportunity-scout.yml');
const research = await readWorkflow('research-agent.yml');
const automatic = await readWorkflow('firebase-auto-production.yml');
const policy = JSON.parse(await fs.readFile(path.join(webRoot, 'config', 'publication-policy.json'), 'utf8'));

const opportunityIssues = opportunity.parsed.on?.issues;
assert.deepEqual(opportunityIssues?.types, ['opened', 'reopened'], 'founder-directed scouting must react only to opened or reopened issues');
assert.equal(opportunity.parsed.permissions?.contents, 'read', 'opportunity model jobs need read-only repository contents');
assert.equal(opportunity.parsed.permissions?.issues, 'read', 'directed scouting needs read-only issue access');
const opportunityJob = opportunity.parsed.jobs?.discover;
assert.ok(opportunityJob, 'opportunity discovery job is missing');
assert.match(opportunityJob.if, /author_association == 'OWNER'/, 'directed scouting must require a repository-owner issue');
assert.match(opportunityJob.if, /startsWith\(github\.event\.issue\.title, '\[Scout\] '\)/, 'directed scouting must require the bounded scout title');
const captureDirectionStep = findStep(opportunityJob, 'Capture only an owner-authored scout direction');
const startScoutStep = findStep(opportunityJob, 'Open a mission only when the founder queue has capacity');
const scoutModelStep = opportunityJob.steps.find((step) => step.uses === 'openai/codex-action@v1');
assert.ok(captureDirectionStep && startScoutStep && scoutModelStep, 'directed scouting must capture, bind, and research one founder direction');
assert.ok(stepIndex(opportunityJob, captureDirectionStep.name) < stepIndex(opportunityJob, startScoutStep.name), 'owner issue capture must precede mission creation');
assert.ok(stepIndex(opportunityJob, startScoutStep.name) < opportunityJob.steps.indexOf(scoutModelStep), 'capacity-bound mission creation must precede the model call');
assert.match(captureDirectionStep.run, /author_association[\s\S]*OWNER/, 'the issue capture must recheck repository-owner authority');
assert.match(captureDirectionStep.run, /startswith\("\[Scout\] "\)/, 'the issue capture must recheck the bounded title');
assert.match(startScoutStep.env?.TRIGGER ?? '', /founder_direction/, 'issue events must become founder_direction missions');
assert.match(startScoutStep.run, /--directive-path="\$DIRECTIVE_PATH"/, 'the mission command must receive only the captured direction file');
assert.match(scoutModelStep.with?.prompt ?? '', /bounded research question[\s\S]*not product evidence/, 'the model must treat founder direction as a question rather than evidence');
assert.match(scoutModelStep.with?.prompt ?? '', /Reject the premise and make no proposal/, 'unsupported founder premises must fail closed');
assert.match(scoutModelStep.with?.prompt ?? '', /append exactly one strategy idea[\s\S]*founderDisposition proposed/, 'the scout may create at most one proposed idea');
assert.equal(scoutModelStep['continue-on-error'], true, 'a discovery-model failure must reach the trusted opportunity classifier');
const opportunityReviewJob = opportunity.parsed.jobs?.independent_review;
const opportunityFailureJob = opportunity.parsed.jobs?.record_failure;
const opportunityFailureWriterJob = opportunity.parsed.jobs?.open_failure_pull_request;
const opportunityWriterJob = opportunity.parsed.jobs?.open_pull_request;
assert.ok(opportunityReviewJob && opportunityFailureJob && opportunityFailureWriterJob && opportunityWriterJob, 'opportunity discovery, review, clean failure recording, and detached writers are required');
const opportunityReviewModelStep = opportunityReviewJob.steps.find((step) => step.uses === 'openai/codex-action@v1');
assert.ok(opportunityReviewModelStep, 'opportunity review needs one separate Codex step');
assert.equal(opportunityReviewModelStep['continue-on-error'], true, 'an opportunity-review model failure must reach the trusted review classifier');
assert.equal(opportunityFailureJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 0, 'the opportunity failure recorder must never receive a model step');
assert.equal(opportunityFailureWriterJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 0, 'the opportunity failure writer must never receive a model step');
assert.equal(opportunityWriterJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 0, 'the successful opportunity writer must never receive a model step');
const routeDiscoveryStep = findStep(opportunityJob, 'Route the exact discovery result');
const routeOpportunityReviewStep = findStep(opportunityReviewJob, 'Route the exact independent-review result');
const recordOpportunityFailureStep = findStep(opportunityFailureJob, 'Record only the credential-free opportunity failure handoff');
const proveOpportunityFailureStep = findStep(opportunityFailureJob, 'Prove and serialize the clean opportunity failure packet');
const openOpportunityFailurePrStep = findStep(opportunityFailureWriterJob, 'Open the opportunity correction pull request with auto-merge disabled');
assert.ok(routeDiscoveryStep && routeOpportunityReviewStep && recordOpportunityFailureStep && proveOpportunityFailureStep && openOpportunityFailurePrStep, 'opportunity model failures need a complete credential-free retry handoff');
assert.match(routeDiscoveryStep.run, /discovery_model_step_failed[\s\S]*discovery_bundle_invalid/, 'discovery failures must be classified by stage');
assert.match(routeOpportunityReviewStep.run, /review_model_step_failed[\s\S]*review_result_invalid/, 'review failures must be classified by stage');
assert.match(recordOpportunityFailureStep.run, /opportunity:scout:failed/, 'only the deterministic failure command may update the mission');
assert.match(proveOpportunityFailureStep.run, /test ! -e "web\/research\/opportunities\/\$MISSION_ID\.json"/, 'the failure recorder must prove no opportunity report survived');
assert.match(proveOpportunityFailureStep.run, /test ! -e "web\/research\/opportunity-reviews\/\$MISSION_ID\.qa\.v1\.json"/, 'the failure recorder must prove no review receipt was created');
assert.match(openOpportunityFailurePrStep.run, /does not preserve partial model output/, 'the correction PR must state that partial output was discarded');
assert.doesNotMatch(openOpportunityFailurePrStep.run, /gh pr merge/, 'opportunity failure packets must never request auto-merge');

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
const researchFailureJob = research.parsed.jobs?.record_research_failure;
const researchFailureWriterJob = research.parsed.jobs?.open_research_failure_pull_request;
const qualityJob = research.parsed.jobs?.quality_review;
const reviewFailureJob = research.parsed.jobs?.record_review_failure;
const reviewFailureWriterJob = research.parsed.jobs?.open_review_failure_pull_request;
const writerJob = research.parsed.jobs?.open_pull_request;
assert.ok(researchJob && researchFailureJob && researchFailureWriterJob && qualityJob && reviewFailureJob && reviewFailureWriterJob && writerJob, 'research, failure recorders, independent QA, and detached writer jobs are all required');
assert.equal(writerJob.permissions?.contents, 'write', 'only the detached writer may push the reviewed branch');
assert.equal(writerJob.permissions?.['pull-requests'], 'write', 'only the detached writer may open the review pull request');
const researchModelStep = researchJob.steps.find((step) => step.uses === 'openai/codex-action@v1');
assert.ok(researchModelStep, 'research drafting needs exactly one Codex step');
assert.equal(researchJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 1, 'research drafting needs exactly one Codex step');
assert.equal(researchModelStep['continue-on-error'], true, 'a model-step failure must reach the trusted failure classifier');
const reviewModelStep = qualityJob.steps.find((step) => step.uses === 'openai/codex-action@v1');
assert.ok(reviewModelStep, 'independent QA needs exactly one separate Codex step');
assert.equal(qualityJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 1, 'independent QA needs exactly one separate Codex step');
assert.equal(reviewModelStep['continue-on-error'], true, 'a reviewer-model failure must reach the trusted review-output classifier');
assert.equal(writerJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 0, 'the GitHub writer must never receive a model step');
assert.equal(researchFailureJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 0, 'the clean research-failure recorder must never receive a model step');
assert.equal(researchFailureWriterJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 0, 'the research-failure pull-request writer must never receive a model step');
assert.equal(reviewFailureJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 0, 'the clean review-failure recorder must never receive a model step');
assert.equal(reviewFailureWriterJob.steps.filter((step) => step.uses === 'openai/codex-action@v1').length, 0, 'the review-failure pull-request writer must never receive a model step');
const classifyDraftStep = findStep(researchJob, 'Classify and serialize only a complete draft bundle');
const recordResearchFailureStep = findStep(researchFailureJob, 'Record only the credential-free research failure handoff');
const openResearchFailurePrStep = findStep(researchFailureWriterJob, 'Open the correction pull request with auto-merge disabled');
assert.ok(classifyDraftStep && recordResearchFailureStep && openResearchFailurePrStep, 'research execution failure must have a complete trusted handoff');
assert.match(classifyDraftStep.run, /research:mission:draft:classify/, 'the trusted classifier must inspect draft completeness before serialization');
assert.match(classifyDraftStep.run, /if \[ "\$draft_outcome" = "ready" \][\s\S]*else[\s\S]*untrusted model workspace is not being promoted/i, 'invalid model output must be discarded rather than serialized');
assert.match(recordResearchFailureStep.run, /research:mission:research-failed/, 'a clean credential-free job must create the durable research-failed mission state');
assert.match(openResearchFailurePrStep.run, /does not preserve a partial draft/, 'the failure pull request must state that untrusted partial output was discarded');
assert.doesNotMatch(openResearchFailurePrStep.run, /gh pr merge/, 'research failure receipts must never request auto-merge');
const classifyReviewStep = findStep(qualityJob, 'Classify the isolated reviewer output before creating any receipt');
const recordReviewFailureStep = findStep(reviewFailureJob, 'Record the credential-free independent-review failure handoff');
const proveReviewFailureStep = findStep(reviewFailureJob, 'Prove and serialize the clean review-failure packet');
const openReviewFailurePrStep = findStep(reviewFailureWriterJob, 'Open the independent-review correction pull request with auto-merge disabled');
assert.ok(classifyReviewStep && recordReviewFailureStep && proveReviewFailureStep && openReviewFailurePrStep, 'review execution failure must have a complete trusted handoff');
assert.match(classifyReviewStep.run, /research:mission:review:classify/, 'reviewer output must be classified before any signed receipt is created');
assert.match(classifyReviewStep.run, /Partial or malformed reviewer output was discarded/, 'invalid reviewer output must be discarded rather than serialized');
assert.match(recordReviewFailureStep.run, /research:mission:review-failed/, 'a clean credential-free job must create the durable review-failed mission state');
assert.match(proveReviewFailureStep.run, /find web\/research\/reviews[\s\S]*= "0"/, 'review execution failure must prove no QA receipt was fabricated');
assert.match(openReviewFailurePrStep.run, /refused to create a QA receipt/, 'the review-failure pull request must state that no editorial verdict was invented');
assert.doesNotMatch(openReviewFailurePrStep.run, /gh pr merge/, 'review failure packets must never request auto-merge');
assert.match(research.raw, /web\/visuals\/requests\/<run-id>-visuals\.json/, 'research drafting must create a versioned visual-production request when approved art is absent');
assert.match(research.raw, /generation\.attempted false/, 'research drafting must not generate or claim visual output');
assert.doesNotMatch(research.raw, /web\/visuals\/article-visuals\.json\|web\/public\/blog-images/, 'draft and review allowlists must not permit registry or public-image mutation');

const exactHandoffStep = findStep(qualityJob, 'Record the isolated review and route the exact handoff');
assert.ok(exactHandoffStep, 'independent QA must record and route passed or failed review findings');
assert.match(exactHandoffStep.run, /editorial-review-result\.json/, 'independent QA must preserve structured findings before creating the receipt');
assert.match(exactHandoffStep.run, /research:mission:qa-failed/, 'a failed independent review must become durable mission state');
assert.match(exactHandoffStep.run, /release_route="qa_failed"/, 'a failed independent review must enter the correction route');
const failedQaBranch = exactHandoffStep.run.match(/elif \[ "\$verdict" = "failed" \][\s\S]*?else/)?.[0] ?? '';
assert.doesNotMatch(failedQaBranch, /review:promote|research:mission:complete/, 'failed QA must not promote or complete the mission');
assert.match(failedQaBranch, /post_failure_source_patch_sha=.*git diff --binary HEAD/, 'failed QA must recompute the exact source-bundle patch after recording its handoff');
assert.match(failedQaBranch, /test "\$post_failure_source_patch_sha" = "\$EXPECTED_SOURCE_PATCH_SHA"/, 'failed QA must prove the post-review source bundle still matches its pre-review hash');
assert.doesNotMatch(failedQaBranch, /git diff --exit-code HEAD/, 'failed QA must not compare a legitimate new draft directly with HEAD');
assert.match(research.raw, /git add -N \./, 'the applied research patch must expose new files to deterministic diff inspection');
const visualAssessmentStep = exactHandoffStep;
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
assert.match(openPrStep.run, /RELEASE_ROUTE" = "qa_failed"[\s\S]*Editorial correction required/, 'failed QA must open an explicit correction PR');
assert.match(autoMergeStep.run, /publication-policy\.json/, 'auto-merge decision must read the founder-controlled publication policy');
assert.match(autoMergeStep.run, /REVIEW_ROUTE" = "founder_safety"[\s\S]*auto-merge is disabled/, 'high-risk research must never request auto-merge');
assert.match(autoMergeStep.run, /RELEASE_ROUTE" = "visual_pending"[\s\S]*cannot auto-merge/, 'visual-pending research must never request auto-merge');
assert.match(autoMergeStep.run, /RELEASE_ROUTE" = "qa_failed"[\s\S]*cannot auto-merge/, 'QA-failed research must never request auto-merge');
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
    'founder_direction_to_opportunity_scout',
    'opportunity_discovery_failure_to_clean_correction_packet',
    'opportunity_review_failure_to_clean_correction_packet',
    'strategy_approval_to_research_dispatch',
    'research_failure_to_clean_correction_packet',
    'research_to_independent_qa',
    'review_failure_to_clean_correction_packet',
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
