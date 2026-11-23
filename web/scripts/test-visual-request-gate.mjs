import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { canonicalIdeaSha256 } from './lib/research-mission-contract.mjs';
import { sha256, validateVisualRequestRecords } from './lib/visual-request-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = process.cwd();
const runId = '20261123-curious-birdwatcher-a1b2c3d4';
const articleSlug = 'curious-birdwatcher-field-kit';
const missionId = 'research-mission-12345-1';
const articleRaw = Buffer.from(`---
status: draft
researchRun: ${runId}
products:
  - id: field-guide
  - id: compact-binoculars
pairs:
  - id: notice-and-identify
    anchorProductId: field-guide
    companionProductId: compact-binoculars
---
Evidence-backed draft.
`);
const articleData = {
  status: 'draft',
  researchRun: runId,
  products: [{ id: 'field-guide' }, { id: 'compact-binoculars' }],
  pairs: [{ id: 'notice-and-identify', anchorProductId: 'field-guide', companionProductId: 'compact-binoculars' }]
};
const run = {
  runId,
  ideaId: 'founder-idea-005',
  ideaRevision: 1,
  ideaSha256: 'a'.repeat(64),
  status: 'drafted',
  draftAuthor: 'research-drafter-fixture',
  article: { slug: articleSlug, status: 'draft' },
  qa: { passed: false, receiptPath: `research/reviews/${runId}.qa.v1.json`, blockers: [], warnings: [] }
};
const runRaw = Buffer.from(`${JSON.stringify(run, null, 2)}\n`);

function requestFixture() {
  return {
    schemaVersion: '1.0.0',
    requestId: `${runId}-visuals`,
    status: 'requested',
    runId,
    articleSlug,
    createdAt: '2026-11-23T12:00:00.000Z',
    createdBy: { role: 'research-editorial-team', workflow: 'research-agent.yml', workflowRunId: '12345', workflowRunAttempt: 1 },
    bindings: {
      researchRunPath: `research/runs/${runId}.json`,
      researchRunSha256: sha256(runRaw),
      articlePath: `src/data/blog/${articleSlug}.md`,
      articleSha256: sha256(articleRaw),
      productIds: ['field-guide', 'compact-binoculars'],
      pairIds: ['notice-and-identify']
    },
    visualSystem: {
      styleVersion: 'gift-thread-editorial-cartoon-v1.0',
      generator: 'openai-built-in-imagegen',
      rightsPosture: 'founder-approved-original-ai-generated',
      dimensions: { width: 1536, height: 1024 }
    },
    assets: [
      {
        assetId: 'curious-birdwatcher-field-kit-hero', role: 'hero', pairId: null,
        productIds: ['field-guide', 'compact-binoculars'],
        sceneDescription: 'A warm editorial-cartoon scene of a curious adult pausing on a neighborhood walk with a field guide and compact binoculars used as simple observation tools.',
        alt: 'A curious walker uses a field guide and compact binoculars to identify a bird nearby.',
        caption: 'The gift turns an ordinary walk into a small notice-and-identify ritual.',
        promptSummary: 'Warm Gift-Thread editorial cartoon showing an approachable neighborhood birdwatching ritual.'
      },
      {
        assetId: 'curious-birdwatcher-notice-and-identify', role: 'pair_scene', pairId: 'notice-and-identify',
        productIds: ['field-guide', 'compact-binoculars'],
        sceneDescription: 'A top-down editorial-cartoon composition with the field guide open beside compact binoculars, a handwritten observation note, and a simple leaf-and-feather trail.',
        alt: 'An open field guide and compact binoculars sit beside a short bird observation note.',
        caption: 'One item helps them notice detail; the other helps them identify what they found.',
        promptSummary: 'Top-down Gift-Thread still life that explains the pair without copying product photography.'
      }
    ],
    rightsBoundary: {
      originalCompositionRequired: true, forbidBrandLogos: true, forbidBrandedPackaging: true,
      forbidExactProductPhotoReplication: true, forbidArtistImitation: true, implyFirstHandUse: false
    },
    publicationBoundary: {
      articleMustRemainDraft: true, publicAssetPathsAllowed: false, independentVisualReviewRequired: true,
      responsiveDerivativesRequired: ['480x320', '768x512', '1200x800']
    },
    generation: { attempted: false, outputPaths: [] },
    nextGate: 'A separate visual producer creates the original assets, responsive derivatives, registry mapping, and independent visual review receipt.'
  };
}

function model(requests = [requestFixture()]) {
  return {
    records: requests.map((data) => ({ filename: `${data.requestId}.json`, raw: Buffer.from(JSON.stringify(data)), data })),
    articlesBySlug: new Map([[articleSlug, { raw: articleRaw, data: structuredClone(articleData) }]]),
    runsById: new Map([[runId, { raw: runRaw, data: structuredClone(run) }]]),
    visualArticleSlugs: new Set()
  };
}

function expectFailure(name, mutate, expected) {
  const input = model();
  mutate(input);
  const result = validateVisualRequestRecords(input);
  assert.match(result.issues.join(' '), new RegExp(expected, 'i'), `${name} should fail with ${expected}: ${result.issues.join('; ')}`);
}

assert.deepEqual(validateVisualRequestRecords(model()).issues, [], 'valid pending visual request should pass');
expectFailure('stale article binding', (input) => { input.records[0].data.bindings.articleSha256 = 'b'.repeat(64); }, 'article digest is stale');
expectFailure('missing pair scene', (input) => { input.records[0].data.assets.pop(); }, 'needs one pair-scene brief');
expectFailure('unknown product', (input) => { input.records[0].data.assets[0].productIds.push('invented-product'); }, 'unknown product');
expectFailure('mapping collision', (input) => { input.visualArticleSlugs.add(articleSlug); }, 'cannot coexist');
expectFailure('missing request', (input) => { input.records = []; }, 'needs one pending visual request');
expectFailure('public article without visuals', (input) => { input.records = []; input.articlesBySlug.get(articleSlug).data.status = 'publication_ready'; }, 'publication-ready article has no approved visual mapping');
expectFailure('generation attempt', (input) => { input.records[0].data.generation.attempted = true; }, 'expected false');

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-visual-request-'));
try {
  for (const directory of ['research/runs', 'research/reviews', 'research/missions', 'social/drafts', 'src/data/blog', 'visuals/requests']) {
    await fs.mkdir(path.join(fixtureRoot, directory), { recursive: true });
  }
  const idea = {
    id: 'founder-idea-005', revision: 1, title: 'A field kit for a curious neighborhood birdwatcher',
    thesisType: 'ritual_pairing'
  };
  run.ideaSha256 = canonicalIdeaSha256(idea);
  const fixtureRunRaw = Buffer.from(`${JSON.stringify(run, null, 2)}\n`);
  const request = requestFixture();
  request.bindings.researchRunSha256 = sha256(fixtureRunRaw);
  request.bindings.articleSha256 = sha256(articleRaw);
  const mission = {
    schemaVersion: '1.1.0', missionId, status: 'started', createdAt: '2026-11-23T11:00:00.000Z', completedAt: null,
    trigger: { type: 'approved_strategy_dispatch', workflow: 'research-agent.yml', workflowRunId: '12345', workflowRunAttempt: 1, actor: 'lucasdmoyer', baseSha: 'a'.repeat(40) },
    idea: { ...idea, sha256: run.ideaSha256 },
    teamStages: [
      { id: 'research', role: 'research-editorial-team', authority: 'draft_only', status: 'in_progress' },
      { id: 'quality_review', role: 'independent-evidence-editor', authority: 'review_receipt_only', status: 'queued' },
      { id: 'visual_production', role: 'visual-production-team', authority: 'original_assets_and_visual_receipt_only', status: 'queued' },
      { id: 'release_preparation', role: 'release-operator', authority: 'preview_and_pr_only', status: 'queued' },
      { id: 'growth_follow_up', role: 'growth-analyst', authority: 'aggregate_measurement_only', status: 'queued' }
    ],
    deliverables: { researchRuns: 1, articles: 1, socialLaunchPacks: 1, independentReviewReceipts: 1, approvedVisualSets: 1 },
    qualityGates: {
      minimumResearchPasses: 3, minimumSourceClasses: 5, minimumFinalists: 5, minimumEditorialScore: 75,
      minimumEvidenceConfidence: 70, minimumThoughtfulnessScore: 15, minimumPairCoherenceScore: 80,
      independentReviewerRequired: true, affiliatePosture: 'enabled_registry_only'
    },
    publicationPolicySnapshot: { mode: 'founder_reviewed', automaticPromotionEnabled: false, verifiedSuccessfulReleaseCount: 0, minimumSuccessfulFounderReviewedReleases: 10 },
    visualHandoff: null,
    completion: null
  };
  const social = { packId: `${articleSlug}-launch`, researchRun: runId };
  await fs.writeFile(path.join(fixtureRoot, 'research/runs', `${runId}.json`), fixtureRunRaw);
  await fs.writeFile(path.join(fixtureRoot, 'src/data/blog', `${articleSlug}.md`), articleRaw);
  await fs.writeFile(path.join(fixtureRoot, 'social/drafts', `${articleSlug}-launch.json`), `${JSON.stringify(social, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'research/missions', `${missionId}.json`), `${JSON.stringify(mission, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'visuals/requests', `${request.requestId}.json`), `${JSON.stringify(request, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'visuals/article-visuals.json'), `${JSON.stringify({ articles: [] }, null, 2)}\n`);

  await execFileAsync(process.execPath, [
    path.join(scriptRoot, 'scripts/create-review-receipt.mjs'), `--run-id=${runId}`, '--reviewer-id=evidence-red-team-12345',
    '--workflow-name=research-agent.yml', `--mission-id=${missionId}`, '--workflow-run-id=12345', '--verdict=failed',
    '--reviewed-at=2026-11-23T12:15:00.000Z'
  ], { cwd: fixtureRoot });
  const exactPassingReceiptPath = `research/reviews/${runId}.qa.v2.json`;
  await execFileAsync(process.execPath, [
    path.join(scriptRoot, 'scripts/create-review-receipt.mjs'), `--run-id=${runId}`, '--reviewer-id=evidence-red-team-67890',
    '--workflow-name=editorial-independent-review.yml', `--mission-id=${missionId}`, '--workflow-run-id=67890', '--verdict=passed',
    '--reviewed-at=2026-11-23T12:30:00.000Z'
  ], { cwd: fixtureRoot });
  const pending = await execFileAsync(process.execPath, [
    path.join(scriptRoot, 'scripts/assess-visual-release-readiness.mjs'), `--run-id=${runId}`, `--mission-id=${missionId}`, `--receipt-path=${exactPassingReceiptPath}`
  ], { cwd: fixtureRoot });
  assert.equal(JSON.parse(pending.stdout).releaseRoute, 'visual_pending', 'reviewed draft without approved art must route to visual production');
  await execFileAsync(process.execPath, [
    path.join(scriptRoot, 'scripts/mark-research-mission-visual-pending.mjs'), `--run-id=${runId}`, `--mission-id=${missionId}`, `--receipt-path=${exactPassingReceiptPath}`
  ], { cwd: fixtureRoot });
  const visualPendingMission = JSON.parse(await fs.readFile(path.join(fixtureRoot, 'research/missions', `${missionId}.json`), 'utf8'));
  assert.equal(visualPendingMission.status, 'visual_pending', 'visual handoff must become durable mission state');
  assert.equal(visualPendingMission.teamStages.find((stage) => stage.id === 'visual_production')?.status, 'in_progress', 'visual production must become the active mission stage');

  await fs.writeFile(path.join(fixtureRoot, 'research/missions', `${missionId}.json`), `${JSON.stringify(mission, null, 2)}\n`);
  await fs.unlink(path.join(fixtureRoot, 'visuals/requests', `${request.requestId}.json`));
  await fs.writeFile(path.join(fixtureRoot, 'visuals/article-visuals.json'), `${JSON.stringify({ articles: [{ slug: articleSlug }] }, null, 2)}\n`);
  const ready = await execFileAsync(process.execPath, [
    path.join(scriptRoot, 'scripts/assess-visual-release-readiness.mjs'), `--run-id=${runId}`, `--mission-id=${missionId}`, `--receipt-path=${exactPassingReceiptPath}`
  ], { cwd: fixtureRoot });
  assert.equal(JSON.parse(ready.stdout).releaseRoute, 'publication_ready', 'reviewed draft with approved art may proceed to promotion');
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  visualRequestGateTests: 'passed',
  negativeChecks: 7,
  durableMissionState: 'visual_pending',
  draftWithoutArtRoutesTo: 'visual_pending',
  approvedVisualMappingRoutesTo: 'publication_ready',
  exactLaterReceiptBound: true,
  draftingAgentGeneratedImages: false,
  automaticMergeWhileVisualPending: false
}, null, 2));
