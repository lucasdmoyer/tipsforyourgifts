import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import matter from './lib/front-matter.mjs';

const execFileAsync = promisify(execFile);
const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const missionPath = args['mission-path'];
const missionSha256 = args['mission-sha256'];
const modelOutcome = args['model-outcome'];
const outputPath = args.output;
if (!missionPath || !/^[a-f0-9]{64}$/.test(missionSha256 ?? '') || !modelOutcome || !outputPath) {
  throw new Error('Usage: node scripts/classify-research-draft-output.mjs --mission-path=<path> --mission-sha256=<sha256> --model-outcome=<success|failure> --output=<path>');
}

const root = process.cwd();
const result = { draftOutcome: 'failed', failureCode: modelOutcome === 'success' ? 'draft_bundle_invalid' : 'model_step_failed', runId: null, articleSlug: null, issueCodes: [] };
const finish = async () => {
  await fs.writeFile(path.resolve(root, outputPath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
};
if (modelOutcome !== 'success') {
  result.issueCodes.push('model_step_failed');
  await finish();
  process.exit(0);
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const allowedPath = /^(?:web\/research\/missions\/[a-z0-9-]+\.json|web\/research\/runs\/[a-z0-9-]+\.json|web\/social\/drafts\/[a-z0-9-]+-launch\.json|web\/src\/data\/blog\/[a-z0-9-]+\.md|web\/visuals\/requests\/[a-z0-9-]+-visuals\.json|web\/src\/data\/operations\.json|web\/src\/app\/generated\/(?:content|studio)\.generated\.ts|web\/public\/(?:publication-manifest\.json|sitemap\.xml))$/;
const { stdout } = await execFileAsync('git', ['diff', '--name-only', '--diff-filter=AM', 'HEAD'], { cwd: path.resolve(root, '..') });
const changedPaths = stdout.split(/\r?\n/).filter(Boolean);
for (const changedPath of changedPaths) if (!allowedPath.test(changedPath)) result.issueCodes.push('forbidden_path');
if (!changedPaths.includes(missionPath)) result.issueCodes.push('mission_missing_from_patch');

let mission;
try {
  const missionRaw = await fs.readFile(path.resolve(root, '..', missionPath));
  if (sha256(missionRaw) !== missionSha256) result.issueCodes.push('mission_digest_changed');
  mission = JSON.parse(missionRaw);
  if (mission.status !== 'started') result.issueCodes.push('mission_not_started');
} catch {
  result.issueCodes.push('mission_unreadable');
}

const runPaths = changedPaths.filter((entry) => /^web\/research\/runs\/[a-z0-9-]+\.json$/.test(entry));
if (runPaths.length !== 1) result.issueCodes.push('run_count_invalid');
if (runPaths.length === 1 && mission) {
  try {
    const run = JSON.parse(await fs.readFile(path.resolve(root, '..', runPaths[0]), 'utf8'));
    const runId = path.basename(runPaths[0], '.json');
    const articleSlug = run.article?.slug;
    if (run.runId !== runId || !/^\d{8}-[a-z0-9-]+-[a-f0-9]{8}$/.test(runId)) result.issueCodes.push('run_identity_invalid');
    if (run.status !== 'drafted' || run.article?.status !== 'draft' || run.qa?.passed !== false) result.issueCodes.push('run_not_unpromoted_draft');
    if (run.ideaId !== mission.idea?.id || run.ideaRevision !== mission.idea?.revision || run.ideaSha256 !== mission.idea?.sha256) result.issueCodes.push('run_mission_binding_invalid');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(articleSlug ?? '')) result.issueCodes.push('article_slug_invalid');
    if (result.issueCodes.length === 0) {
      const articlePath = `web/src/data/blog/${articleSlug}.md`;
      const socialPath = `web/social/drafts/${articleSlug}-launch.json`;
      if (!changedPaths.includes(articlePath)) result.issueCodes.push('article_missing_from_patch');
      if (!changedPaths.includes(socialPath)) result.issueCodes.push('social_pack_missing_from_patch');
      const article = matter(await fs.readFile(path.resolve(root, '..', articlePath), 'utf8'));
      if (article.data.status !== 'draft') result.issueCodes.push('article_not_draft');
      const social = JSON.parse(await fs.readFile(path.resolve(root, '..', socialPath), 'utf8'));
      if (social.researchRun !== runId) result.issueCodes.push('social_run_binding_invalid');
      const registry = JSON.parse(await fs.readFile(path.join(root, 'visuals/article-visuals.json'), 'utf8'));
      const visualMapped = (registry.articles ?? []).some((entry) => entry.slug === articleSlug);
      const requestPath = `web/visuals/requests/${runId}-visuals.json`;
      if (visualMapped && changedPaths.includes(requestPath)) result.issueCodes.push('unexpected_visual_request');
      if (!visualMapped && !changedPaths.includes(requestPath)) result.issueCodes.push('visual_request_missing');
      if (result.issueCodes.length === 0) {
        result.draftOutcome = 'ready';
        result.failureCode = null;
        result.runId = runId;
        result.articleSlug = articleSlug;
      }
    }
  } catch {
    result.issueCodes.push('draft_bundle_unreadable');
  }
}

result.issueCodes = [...new Set(result.issueCodes)].sort();
await finish();
