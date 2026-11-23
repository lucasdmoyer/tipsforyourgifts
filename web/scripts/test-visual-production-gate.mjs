import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  buildImageGenerationBody,
  buildVisualPrompt,
  extractSingleGeneratedImage,
  extractStructuredOutput,
  visualReviewFindingsSchema,
  visualReviewModelOutputSchema,
  OPENAI_RESPONSES_ENDPOINT,
  VISUAL_IMAGE_TOOL_MODEL,
  VISUAL_PRODUCER_MODEL,
  VISUAL_REVIEW_MODEL
} from './lib/visual-production-contract.mjs';
import { parseAiAutomationPolicy, validateDirectApiWorkflowDocument } from './lib/ai-automation-policy-contract.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');
const request = {
  visualSystem: { styleVersion: 'gift-thread-editorial-cartoon-v1.0' },
  assets: []
};
const asset = {
  assetId: 'sample-hero',
  role: 'hero',
  pairId: null,
  productIds: ['sample-product'],
  sceneDescription: 'An adult uses one useful generic object during a familiar routine while a specialty companion waits nearby.',
  alt: 'An adult uses a useful generic gift during a familiar routine beside its specialty companion.',
  caption: 'The pair respects what already works and adds one thoughtful specialty improvement.'
};
const prompt = buildVisualPrompt({ request, asset });
assert.ok(prompt.length >= 500);
assert.match(prompt, /never an exact SKU likeness/);
assert.match(prompt, /no brand marks/i);
const generationBody = buildImageGenerationBody({ prompt, safetyIdentifier: 'a'.repeat(64), styleReferenceDataUrl: 'data:image/png;base64,AA==' });
assert.equal(generationBody.model, VISUAL_PRODUCER_MODEL);
assert.equal(generationBody.store, false);
assert.equal(generationBody.tools[0].model, VISUAL_IMAGE_TOOL_MODEL);
assert.deepEqual(generationBody.tool_choice, { type: 'image_generation' });
assert.equal(OPENAI_RESPONSES_ENDPOINT, 'https://api.openai.com/v1/responses');
assert.equal(extractSingleGeneratedImage({ output: [{ type: 'image_generation_call', result: Buffer.from('image').toString('base64') }] }).bytes.toString(), 'image');
assert.throws(() => extractSingleGeneratedImage({ output: [] }), /exactly one/);
assert.deepEqual(extractStructuredOutput({ status: 'completed', output_text: '{"ok":true}' }), { ok: true });
assert.throws(() => extractStructuredOutput({ status: 'incomplete' }), /did not complete/);

const cleanChecks = Object.fromEntries(['styleMatch', 'sceneAccuracy', 'productContextTruth', 'copyrightAndTradeDressBoundary', 'anatomyAndObjectCoherence', 'mobileLegibility', 'textAndWatermarkFree', 'safeDepiction'].map((key) => [key, true]));
const passed = {
  schemaVersion: '1.0.0',
  requestId: '20261123-sample-aaaaaaaa-visuals',
  verdict: 'passed',
  assets: [{ assetId: 'sample-hero', checks: cleanChecks, blockers: [], warnings: [] }],
  blockers: [],
  warnings: []
};
assert.equal(visualReviewModelOutputSchema.parse(passed).verdict, 'passed');
assert.equal(visualReviewModelOutputSchema.safeParse({ ...passed, assets: [{ ...passed.assets[0], checks: { ...cleanChecks, mobileLegibility: false } }] }).success, false);
assert.equal(visualReviewFindingsSchema.safeParse({
  ...passed,
  manifestPath: 'visuals/production/20261123-sample-aaaaaaaa-visuals/manifest.json',
  manifestSha256: 'a'.repeat(64),
  reviewedAt: '2026-11-23T00:00:00.000Z',
  reviewer: { role: 'independent-visual-editor', model: VISUAL_REVIEW_MODEL, workflow: 'visual-production.yml', workflowRunId: '123', workflowRunAttempt: 1, responseId: 'resp_12345678' },
  privacy: { rawApiResponseStored: false, secretValueStored: false, personalDataSent: false }
}).success, true);

const policy = parseAiAutomationPolicy(JSON.parse(await fs.readFile(path.join(webRoot, 'config', 'ai-automation-policy.json'), 'utf8')));
const workflow = parseYaml(await fs.readFile(path.join(repoRoot, '.github', 'workflows', 'visual-production.yml'), 'utf8'));
const workflowPolicy = policy.directApiWorkflows[0];
const validation = validateDirectApiWorkflowDocument({ policy, workflowPolicy, workflow });
assert.equal(validation.directApiCalls, 2);
assert.deepEqual(validation.modelJobs.sort(), ['independent_review', 'produce']);
assert.deepEqual(validation.detachedWriterJobs, ['detached_writer']);
const workflowSource = await fs.readFile(path.join(repoRoot, '.github', 'workflows', 'visual-production.yml'), 'utf8');
assert.doesNotMatch(workflowSource, /firebase deploy/);
assert.match(workflowSource, /needs\.independent_review\.outputs\.verdict == 'passed'/);
assert.match(workflowSource, /review:promote/);
assert.match(workflowSource, /research:mission:complete/);
const writerText = JSON.stringify(workflow.jobs.detached_writer);
assert.doesNotMatch(writerText, /OPENAI_API_KEY/);
assert.match(writerText, /contents":"write/);
assert.match(writerText, /pull-requests":"write/);
for (const jobName of ['produce', 'independent_review']) {
  assert.equal(workflow.jobs[jobName].permissions.contents, 'read');
  assert.doesNotMatch(JSON.stringify(workflow.jobs[jobName].permissions), /write/);
}

console.log(JSON.stringify({ gate: 'passed', directApiModelCalls: 2, independentReviewRequired: true, failedReviewPromotionBlocked: true, writerReceivesOpenAiKey: false, firebaseDeploymentAuthorized: false }, null, 2));
