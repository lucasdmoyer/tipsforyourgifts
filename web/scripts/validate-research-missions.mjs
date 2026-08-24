import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateResearchMissionRecords } from './lib/research-mission-contract.mjs';

const root = process.cwd();

async function jsonRecords(directory) {
  let names = [];
  try { names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return Promise.all(names.map(async (filename) => {
    const raw = await fs.readFile(path.join(directory, filename));
    return { filename, raw, data: JSON.parse(raw) };
  }));
}

const [missionRecords, runRecords, socialRecords, reviewRecords] = await Promise.all([
  jsonRecords(path.join(root, 'research/missions')),
  jsonRecords(path.join(root, 'research/runs')),
  jsonRecords(path.join(root, 'social/drafts')),
  jsonRecords(path.join(root, 'research/reviews'))
]);
const strategy = JSON.parse(await fs.readFile(path.join(root, 'src/data/strategy.json'), 'utf8'));
const publicationPolicy = JSON.parse(await fs.readFile(path.join(root, 'config/publication-policy.json'), 'utf8'));
const runsById = new Map(runRecords.map((record) => [record.data.runId, record]));
const socialByRunId = new Map(socialRecords.map((record) => [record.data.researchRun, record]));
const reviewsByPath = new Map(reviewRecords.map((record) => [`research/reviews/${record.filename}`, record]));
const articlesBySlug = new Map();
for (const runRecord of runRecords) {
  const slug = runRecord.data.article?.slug;
  if (!slug || articlesBySlug.has(slug)) continue;
  try {
    const raw = await fs.readFile(path.join(root, 'src/data/blog', `${slug}.md`));
    articlesBySlug.set(slug, { filename: `${slug}.md`, raw, data: { slug } });
  } catch {}
}

const result = validateResearchMissionRecords({ records: missionRecords, strategy, publicationPolicy, runsById, articlesBySlug, socialByRunId, reviewsByPath });
if (result.issues.length > 0) {
  console.error(result.issues.map((issue) => `- ${issue}`).join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({
  gate: 'passed',
  missions: result.missions.length,
  activeMissions: result.missions.filter((mission) => mission.status === 'started').length,
  completedMissions: result.missions.filter((mission) => mission.status === 'completed').length,
  founderReviewRequired: result.missions.filter((mission) => mission.completion?.publicationReadiness === 'founder_review_required').length,
  automaticMergeEligible: result.missions.filter((mission) => mission.completion?.publicationReadiness === 'automatic_merge_eligible').length,
  externalWritesAttempted: false
}, null, 2));
