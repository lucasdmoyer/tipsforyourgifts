import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  callOpenAiResponses,
  extractStructuredOutput,
  loadSocialCreativeTarget,
  sha256,
  socialCreativeProductionDirectory,
  socialCreativeProductionManifestSchema,
  socialCreativeReviewFindingsSchema,
  socialCreativeReviewJsonSchema,
  socialCreativeReviewModelOutputSchema,
  SOCIAL_CREATIVE_REVIEW_MODEL
} from './lib/social-creative-production-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const postId = args['post-id'];
if (!postId) throw new Error('Usage: node scripts/review-social-creative-candidate.mjs --post-id=<id>');
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) throw new Error('OPENAI_API_KEY is required for independent social creative review');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = await loadSocialCreativeTarget(root, { postId });
if (!target) throw new Error(`${postId}: eligible social creative target is missing`);
const relativeDirectory = socialCreativeProductionDirectory(target.candidateId);
const manifestPath = `${relativeDirectory}/manifest.json`;
const manifestRaw = await fs.readFile(path.join(root, manifestPath));
const manifest = socialCreativeProductionManifestSchema.parse(JSON.parse(manifestRaw));
if (manifest.bindings.packSha256 !== target.packRecord.sha256 || manifest.bindings.postSha256 !== target.postSha256 || manifest.bindings.postId !== postId) throw new Error('Social creative manifest is stale');

for (const [record, format] of [[manifest.source, 'png'], [manifest.delivery, 'jpeg']]) {
  const bytes = await fs.readFile(path.join(root, record.path));
  if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) throw new Error(`${record.path}: file digest or byte count differs from manifest`);
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== format || metadata.width !== 1024 || metadata.height !== 1536) throw new Error(`${record.path}: format or dimensions differ from manifest`);
}
const delivery = await fs.readFile(path.join(root, manifest.delivery.path));
const safetyIdentifier = sha256(`tipsforyourgifts:social-review:${target.candidateId}`);
const response = await callOpenAiResponses({
  apiKey,
  body: {
    model: SOCIAL_CREATIVE_REVIEW_MODEL,
    store: false,
    safety_identifier: safetyIdentifier,
    instructions: 'You are the independent social visual editor. You did not create this image. Apply the strict pass standard and return only the requested JSON schema.',
    input: [{ role: 'user', content: [
      { type: 'input_text', text: [
        `Independently review candidate ${target.candidateId} for post ${postId}.`,
        `Angle: ${target.post.angle}`,
        `Headline context: ${target.post.headline}`,
        `Caption context: ${target.post.copy}`,
        `Visual brief: ${target.post.assetBrief}`,
        `Required alt meaning: ${target.post.altText}`,
        'Pass only if the image accurately expresses the brief and source post, contains no readable text or watermark, has no third-party logos or merchant imagery, makes no unsupported product claim, is anatomically and mechanically coherent, remains legible on mobile, and depicts a safe generic routine. Any uncertainty must fail the affected check and name a concrete blocker.'
      ].join('\n') },
      { type: 'input_image', image_url: `data:image/jpeg;base64,${delivery.toString('base64')}`, detail: 'high' }
    ] }],
    text: { verbosity: 'low', format: { type: 'json_schema', name: 'social_creative_review', strict: true, schema: socialCreativeReviewJsonSchema() } }
  }
});
const output = socialCreativeReviewModelOutputSchema.parse(extractStructuredOutput(response));
if (output.candidateId !== target.candidateId) throw new Error('Independent review returned a different candidate ID');
const workflowRunId = process.env.GITHUB_RUN_ID ?? args['workflow-run-id'];
const workflowRunAttempt = Number(process.env.GITHUB_RUN_ATTEMPT ?? args['workflow-run-attempt'] ?? '1');
if (!/^[1-9]\d*$/.test(workflowRunId ?? '') || !Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) throw new Error('Social creative review needs a positive workflow run ID and attempt');
const findings = socialCreativeReviewFindingsSchema.parse({
  schemaVersion: '1.0.0',
  candidateId: target.candidateId,
  manifestPath,
  manifestSha256: sha256(manifestRaw),
  reviewedAt: args['reviewed-at'] ?? new Date().toISOString(),
  reviewer: {
    role: 'independent-social-visual-editor', model: SOCIAL_CREATIVE_REVIEW_MODEL, workflow: 'social-creative-production.yml', workflowRunId, workflowRunAttempt,
    responseId: response.id,
    usage: { totalTokens: response.usage?.total_tokens ?? null, inputTokens: response.usage?.input_tokens ?? null, outputTokens: response.usage?.output_tokens ?? null }
  },
  verdict: output.verdict,
  checks: output.checks,
  blockers: output.blockers,
  warnings: output.warnings,
  privacy: { rawApiResponseStored: false, secretValueStored: false, personalDataSent: false }
});
await fs.writeFile(path.join(root, relativeDirectory, 'review-findings.json'), `${JSON.stringify(findings, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ candidateId: target.candidateId, verdict: findings.verdict, sourcePromoted: false, mediaApproved: false, externalPostCreated: false }, null, 2));
