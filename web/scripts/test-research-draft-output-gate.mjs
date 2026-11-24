import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptPath = path.join(process.cwd(), 'scripts/classify-research-draft-output.mjs');
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-draft-classifier-'));
const webRoot = path.join(fixtureRoot, 'web');
const runId = '20261123-careful-gift-research-a1b2c3d4';
const slug = 'careful-gift-research';
const missionPath = 'web/research/missions/research-mission-12345-1.json';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const writeJson = async (filePath, value) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

async function classify(modelOutcome, outputName) {
  await execFileAsync('git', ['add', '-N', '.'], { cwd: fixtureRoot });
  const missionRaw = await fs.readFile(path.join(fixtureRoot, missionPath));
  const outputPath = path.join(fixtureRoot, outputName);
  await execFileAsync(process.execPath, [scriptPath, `--mission-path=${missionPath}`, `--mission-sha256=${sha256(missionRaw)}`, `--model-outcome=${modelOutcome}`, `--output=${outputPath}`], { cwd: webRoot });
  return JSON.parse(await fs.readFile(outputPath, 'utf8'));
}

try {
  await fs.mkdir(webRoot, { recursive: true });
  await writeJson(path.join(webRoot, 'visuals/article-visuals.json'), { articles: [{ slug }] });
  await execFileAsync('git', ['init'], { cwd: fixtureRoot });
  await execFileAsync('git', ['config', 'user.name', 'fixture'], { cwd: fixtureRoot });
  await execFileAsync('git', ['config', 'user.email', 'fixture@example.com'], { cwd: fixtureRoot });
  await execFileAsync('git', ['add', '.'], { cwd: fixtureRoot });
  await execFileAsync('git', ['commit', '-m', 'fixture base'], { cwd: fixtureRoot });

  const mission = { status: 'started', idea: { id: 'founder-idea-015', revision: 2, sha256: 'a'.repeat(64) } };
  const run = {
    runId, ideaId: mission.idea.id, ideaRevision: mission.idea.revision, ideaSha256: mission.idea.sha256,
    status: 'drafted', article: { slug, status: 'draft' }, qa: { passed: false }
  };
  await writeJson(path.join(fixtureRoot, missionPath), mission);
  await writeJson(path.join(webRoot, 'research/runs', `${runId}.json`), run);
  await fs.mkdir(path.join(webRoot, 'src/data/blog'), { recursive: true });
  await fs.writeFile(path.join(webRoot, 'src/data/blog', `${slug}.md`), '---\nstatus: draft\n---\nCredential-free fixture.\n');
  await writeJson(path.join(webRoot, 'social/drafts', `${slug}-launch.json`), { packId: `${slug}-launch`, researchRun: runId });

  const valid = await classify('success', 'valid-route.json');
  if (valid.draftOutcome !== 'ready' || valid.runId !== runId || valid.articleSlug !== slug) throw new Error(`valid draft did not route to review: ${JSON.stringify(valid)}`);

  const modelFailure = await classify('failure', 'model-failure-route.json');
  if (modelFailure.draftOutcome !== 'failed' || modelFailure.failureCode !== 'model_step_failed') throw new Error('model failure did not route to the clean failure lane');

  await fs.writeFile(path.join(fixtureRoot, 'forbidden.txt'), 'untrusted partial output\n');
  const forbidden = await classify('success', 'forbidden-route.json');
  if (forbidden.draftOutcome !== 'failed' || !forbidden.issueCodes.includes('forbidden_path')) throw new Error('forbidden draft output did not fail closed');

  console.log(JSON.stringify({ researchDraftOutputGateTests: 'passed', validDraftRoutesTo: 'independent_review', modelFailureRoutesTo: 'research_failed', forbiddenOutputRoutesTo: 'research_failed', partialDraftPromoted: false }, null, 2));
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
