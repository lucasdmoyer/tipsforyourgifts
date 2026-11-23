import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { canonicalIdeaSha256, researchMissionSchema } from './lib/research-mission-contract.mjs';
import { sha256, visualProductionManifestSchema, visualReviewFindingsSchema, VISUAL_IMAGE_TOOL_MODEL, VISUAL_PRODUCER_MODEL, VISUAL_REVIEW_MODEL } from './lib/visual-production-contract.mjs';
import { visualFailureReceiptSchema } from './lib/visual-failure-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = process.cwd();
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-visual-failure-'));
const webRoot = path.join(fixtureRoot, 'web');
const runId = '20261123-visual-failure-a1b2c3d4';
const requestId = `${runId}-visuals`;
const missionId = 'research-mission-123-1';
const articleSlug = 'visual-failure-fixture';
const write = async (relativePath, value) => {
  const filePath = path.join(webRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const raw = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  await fs.writeFile(filePath, raw);
  return raw;
};
const fileRecord = (relativePath, bytes, width, height) => ({ path: relativePath, sha256: sha256(bytes), bytes: bytes.length, width, height });

try {
  const idea = { id: 'founder-idea-003', revision: 1, ideaType: 'content', thesisType: 'recipient_friction', founderDisposition: 'approved_for_research', title: 'A durable visual retry for a thoughtful gift article' };
  const run = { runId, ideaId: idea.id, ideaRevision: idea.revision, ideaSha256: canonicalIdeaSha256(idea), status: 'drafted', article: { slug: articleSlug, status: 'draft' }, qa: { passed: false } };
  const runRaw = await write(`research/runs/${runId}.json`, run);
  const articleRaw = await write(`src/data/blog/${articleSlug}.md`, `---\nstatus: draft\nresearchRun: ${runId}\n---\nVisual failure fixture.\n`);
  const review = { schemaVersion: '1.2.0', runId, missionId, verdict: 'passed', blockers: [] };
  const reviewPath = `research/reviews/${runId}.qa.v1.json`;
  const reviewRaw = await write(reviewPath, review);
  const registryRaw = await write('visuals/article-visuals.json', { schemaVersion: '1.0.0', assets: [], articles: [] });
  const promptBookRaw = await write('visuals/PROMPTS.md', '# Fixture prompt book\n');
  const request = {
    schemaVersion: '1.0.0', requestId, status: 'requested', runId, articleSlug, createdAt: '2026-11-23T00:00:00.000Z',
    createdBy: { role: 'research-editorial-team', workflow: 'research-agent.yml', workflowRunId: '122', workflowRunAttempt: 1 },
    bindings: { researchRunPath: `research/runs/${runId}.json`, researchRunSha256: sha256(runRaw), articlePath: `src/data/blog/${articleSlug}.md`, articleSha256: sha256(articleRaw), productIds: ['sample-product'], pairIds: [] },
    visualSystem: { styleVersion: 'gift-thread-editorial-cartoon-v1.0', generator: 'openai-built-in-imagegen', rightsPosture: 'founder-approved-original-ai-generated', dimensions: { width: 1536, height: 1024 } },
    assets: [{ assetId: 'visual-failure-hero', role: 'hero', pairId: null, productIds: ['sample-product'], sceneDescription: 'An adult uses a useful general-purpose gift while a specialty companion waits nearby during a familiar and carefully observed routine.', alt: 'An adult uses a general-purpose gift beside a specialty companion during a familiar routine.', caption: 'The useful foundation and specialty companion show why the pair feels thoughtful.', promptSummary: 'A warm editorial scene showing a useful foundation and one specialty improvement.' }],
    rightsBoundary: { originalCompositionRequired: true, forbidBrandLogos: true, forbidBrandedPackaging: true, forbidExactProductPhotoReplication: true, forbidArtistImitation: true, implyFirstHandUse: false },
    publicationBoundary: { articleMustRemainDraft: true, publicAssetPathsAllowed: false, independentVisualReviewRequired: true, responsiveDerivativesRequired: ['480x320', '768x512', '1200x800'] },
    generation: { attempted: false, outputPaths: [] },
    nextGate: 'Generate original art, run independent multimodal review, then open a credential-free promotion pull request.'
  };
  const requestRaw = await write(`visuals/requests/${requestId}.json`, request);
  const mission = researchMissionSchema.parse({
    schemaVersion: '1.4.0', missionId, status: 'visual_pending', createdAt: '2026-11-23T00:00:00.000Z', failedAt: null, completedAt: null,
    trigger: { type: 'approved_strategy_dispatch', workflow: 'research-agent.yml', workflowRunId: '123', workflowRunAttempt: 1, actor: 'lucasdmoyer', baseSha: 'a'.repeat(40) },
    idea: { id: idea.id, revision: idea.revision, sha256: canonicalIdeaSha256(idea), title: idea.title, thesisType: idea.thesisType },
    teamStages: [
      { id: 'research', role: 'research-editorial-team', authority: 'draft_only', status: 'completed' },
      { id: 'quality_review', role: 'independent-evidence-editor', authority: 'review_receipt_only', status: 'completed' },
      { id: 'visual_production', role: 'visual-production-team', authority: 'original_assets_and_visual_receipt_only', status: 'in_progress' },
      { id: 'release_preparation', role: 'release-operator', authority: 'preview_and_pr_only', status: 'queued' },
      { id: 'growth_follow_up', role: 'growth-analyst', authority: 'aggregate_measurement_only', status: 'queued' }
    ],
    deliverables: { researchRuns: 1, articles: 1, socialLaunchPacks: 1, independentReviewReceipts: 1, approvedVisualSets: 1 },
    qualityGates: { minimumResearchPasses: 3, minimumSourceClasses: 5, minimumFinalists: 5, minimumEditorialScore: 75, minimumEvidenceConfidence: 70, minimumThoughtfulnessScore: 15, minimumPairCoherenceScore: 80, independentReviewerRequired: true, affiliatePosture: 'enabled_registry_only' },
    publicationPolicySnapshot: { mode: 'founder_reviewed', automaticPromotionEnabled: false, verifiedSuccessfulReleaseCount: 0, minimumSuccessfulFounderReviewedReleases: 10 },
    researchFailureHandoff: null, reviewFailureHandoff: null, qaFailureHandoff: null,
    visualHandoff: { runId, runSha256: sha256(runRaw), articleSlug, articleSha256: sha256(articleRaw), socialPackId: `${articleSlug}-launch`, socialPackSha256: 'b'.repeat(64), reviewReceiptPath: reviewPath, reviewReceiptSha256: sha256(reviewRaw), visualRequestPath: `visuals/requests/${requestId}.json`, visualRequestSha256: sha256(requestRaw), nextGate: request.nextGate },
    completion: null
  });
  const missionRaw = await write(`research/missions/${missionId}.json`, mission);

  const productionDirectory = `visuals/production/${requestId}`;
  const sourceBytes = await sharp({ create: { width: 1536, height: 1024, channels: 4, background: '#f4ead7' } }).png().toBuffer();
  const masterBytes = await sharp(sourceBytes).webp().toBuffer();
  const derivativeSpecs = [[480, 320], [768, 512], [1200, 800]];
  await write(`${productionDirectory}/sources/visual-failure-hero.png`, sourceBytes);
  await write(`${productionDirectory}/delivery/visual-failure-hero.webp`, masterBytes);
  const derivatives = [];
  for (const [width, height] of derivativeSpecs) {
    const bytes = await sharp(sourceBytes).resize(width, height).webp().toBuffer();
    const relativePath = `${productionDirectory}/delivery/visual-failure-hero-${width}.webp`;
    await write(relativePath, bytes);
    derivatives.push({ label: `${width}x${height}`, ...fileRecord(relativePath, bytes, width, height) });
  }
  const prompt = 'Original Gift-Thread editorial illustration. '.repeat(20);
  const manifest = visualProductionManifestSchema.parse({
    schemaVersion: '1.0.0', requestId, status: 'generated_awaiting_independent_review', generatedAt: '2026-11-23T00:02:00.000Z',
    generatedBy: { workflow: 'visual-production.yml', workflowRunId: '123', workflowRunAttempt: 1, model: VISUAL_PRODUCER_MODEL, imageToolModel: VISUAL_IMAGE_TOOL_MODEL },
    bindings: { missionId, missionPath: `research/missions/${missionId}.json`, missionSha256: sha256(missionRaw), requestPath: `visuals/requests/${requestId}.json`, requestSha256: sha256(requestRaw), runId, runPath: `research/runs/${runId}.json`, runSha256: sha256(runRaw), articleSlug, articlePath: `src/data/blog/${articleSlug}.md`, articleSha256: sha256(articleRaw), baseRegistryPath: 'visuals/article-visuals.json', baseRegistrySha256: sha256(registryRaw), basePromptBookPath: 'visuals/PROMPTS.md', basePromptBookSha256: sha256(promptBookRaw), styleReferencePath: 'visuals/sources/read-it-big-history.png', styleReferenceSha256: 'c'.repeat(64) },
    assets: [{ assetId: 'visual-failure-hero', role: 'hero', pairId: null, productIds: ['sample-product'], prompt, promptSha256: sha256(prompt), revisedPrompt: null, source: fileRecord(`${productionDirectory}/sources/visual-failure-hero.png`, sourceBytes, 1536, 1024), delivery: fileRecord(`${productionDirectory}/delivery/visual-failure-hero.webp`, masterBytes, 1536, 1024), derivatives, usage: { totalTokens: null, inputTokens: null, outputTokens: null } }],
    safety: { safetyIdentifierSha256: 'd'.repeat(64), rawApiResponseStored: false, secretValueStored: false, externalSourceImagesUsed: false }
  });
  const manifestRaw = await write(`${productionDirectory}/manifest.json`, manifest);

  const productionClassify = await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/classify-visual-production-output.mjs'), `--request-id=${requestId}`, '--model-outcome=success'], { cwd: webRoot });
  const productionRoute = JSON.parse(productionClassify.stdout);
  if (productionRoute.productionOutcome !== 'ready' || productionRoute.manifestSha256 !== sha256(manifestRaw)) throw new Error('complete visual production bundle did not route to independent review');

  const checks = { styleMatch: true, sceneAccuracy: true, productContextTruth: true, copyrightAndTradeDressBoundary: true, anatomyAndObjectCoherence: true, mobileLegibility: false, textAndWatermarkFree: true, safeDepiction: true };
  const findings = visualReviewFindingsSchema.parse({
    schemaVersion: '1.0.0', requestId, manifestPath: `${productionDirectory}/manifest.json`, manifestSha256: sha256(manifestRaw), reviewedAt: '2026-11-23T00:03:00.000Z',
    reviewer: { role: 'independent-visual-editor', model: VISUAL_REVIEW_MODEL, workflow: 'visual-production.yml', workflowRunId: '123', workflowRunAttempt: 1, responseId: 'resp_fixture_123', usage: { totalTokens: null, inputTokens: null, outputTokens: null } },
    verdict: 'failed', assets: [{ assetId: 'visual-failure-hero', checks, blockers: ['The mobile derivative loses the specialty companion at reading size.'], warnings: [] }], blockers: [], warnings: [],
    privacy: { rawApiResponseStored: false, secretValueStored: false, personalDataSent: false }
  });
  await write(`${productionDirectory}/visual-review-findings.json`, findings);
  const reviewClassify = await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/classify-visual-review-output.mjs'), `--request-id=${requestId}`, '--model-outcome=success', `--expected-manifest-sha256=${sha256(manifestRaw)}`], { cwd: webRoot });
  const reviewRoute = JSON.parse(reviewClassify.stdout);
  if (reviewRoute.reviewOutcome !== 'ready' || reviewRoute.verdict !== 'failed' || reviewRoute.failureCode !== 'review_verdict_failed') throw new Error('failed independent visual verdict did not route to the correction packet');

  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/record-visual-production-failure.mjs'), `--request-id=${requestId}`, '--stage=independent_review', '--reason-code=review_verdict_failed', '--workflow-run-id=123', '--workflow-run-attempt=1', '--recorded-at=2026-11-23T00:04:00.000Z'], { cwd: webRoot });
  const failureId = `${requestId}-run123-attempt1`;
  const receipt = visualFailureReceiptSchema.parse(JSON.parse(await fs.readFile(path.join(webRoot, 'visuals/failures', `${failureId}.json`), 'utf8')));
  if (receipt.evidence.blockers.length === 0 || receipt.handling.generatedAssetsPromoted || receipt.handling.reviewReceiptCreated) throw new Error('visual failure receipt did not preserve the safe correction boundary');
  try { await fs.access(path.join(webRoot, productionDirectory)); throw new Error('failed visual workspace was preserved'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/validate-visual-failures.mjs')], { cwd: webRoot });

  console.log(JSON.stringify({ visualFailureCommandIntegration: 'passed', productionBundleRoutesTo: 'independent_review', failedReviewRoutesTo: 'correction_packet', failureReceipt: failureId, concreteBlockers: receipt.evidence.blockers.length, partialOutputPreserved: false, generatedAssetsPromoted: false, reviewReceiptFabricated: false, productionAuthorized: false }, null, 2));
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
