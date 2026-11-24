import fs from 'node:fs/promises';
import path from 'node:path';
import matter from './front-matter.mjs';
import { researchMissionSchema } from './research-mission-contract.mjs';
import { visualRequestSchema } from './visual-request-contract.mjs';
import { sha256 } from './visual-production-contract.mjs';

async function readJsonRecord(root, relativePath) {
  const raw = await fs.readFile(path.join(root, relativePath));
  return { path: relativePath, raw, data: JSON.parse(raw.toString('utf8')), sha256: sha256(raw) };
}

export async function loadVisualProductionTarget(root, requestedId = null) {
  const requestDirectory = path.join(root, 'visuals', 'requests');
  let requestNames = [];
  try { requestNames = (await fs.readdir(requestDirectory)).filter((name) => name.endsWith('.json')).sort(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (requestedId) requestNames = requestNames.filter((name) => name === `${requestedId}.json`);
  if (requestedId && requestNames.length === 0) throw new Error(`Requested visual production target does not exist: ${requestedId}`);

  const missionDirectory = path.join(root, 'research', 'missions');
  let missionNames = [];
  try { missionNames = (await fs.readdir(missionDirectory)).filter((name) => name.endsWith('.json')).sort(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const missions = [];
  for (const name of missionNames) {
    const record = await readJsonRecord(root, `research/missions/${name}`);
    missions.push({ ...record, data: researchMissionSchema.parse(record.data) });
  }

  const registryRecord = await readJsonRecord(root, 'visuals/article-visuals.json');
  const promptBookRaw = await fs.readFile(path.join(root, 'visuals', 'PROMPTS.md'));
  const mappedSlugs = new Set((registryRecord.data.articles ?? []).map((entry) => entry.slug));
  const eligible = [];

  for (const name of requestNames) {
    const requestRecord = await readJsonRecord(root, `visuals/requests/${name}`);
    const request = visualRequestSchema.parse(requestRecord.data);
    if (name !== `${request.requestId}.json`) throw new Error(`${request.requestId}: request filename differs from requestId`);
    if (mappedSlugs.has(request.articleSlug)) throw new Error(`${request.requestId}: article already has an approved visual mapping`);
    const matches = missions.filter((mission) => mission.data.status === 'visual_pending'
      && mission.data.visualHandoff?.runId === request.runId
      && mission.data.visualHandoff?.articleSlug === request.articleSlug
      && mission.data.visualHandoff?.visualRequestPath === requestRecord.path);
    if (matches.length !== 1) throw new Error(`${request.requestId}: expected exactly one visual-pending mission, found ${matches.length}`);
    const missionRecord = matches[0];
    const handoff = missionRecord.data.visualHandoff;
    if (handoff.visualRequestSha256 !== requestRecord.sha256) throw new Error(`${request.requestId}: mission visual-request digest is stale`);

    const runRecord = await readJsonRecord(root, `research/runs/${request.runId}.json`);
    if (runRecord.sha256 !== handoff.runSha256 || runRecord.sha256 !== request.bindings.researchRunSha256) throw new Error(`${request.requestId}: run digest differs from the request or mission handoff`);
    if (!['drafted', 'qa_failed'].includes(runRecord.data.status) || runRecord.data.article?.status !== 'draft' || runRecord.data.article?.slug !== request.articleSlug) throw new Error(`${request.requestId}: research bundle is not an unpromoted draft`);

    const articlePath = `src/data/blog/${request.articleSlug}.md`;
    const articleRaw = await fs.readFile(path.join(root, articlePath));
    const article = matter(articleRaw.toString('utf8'));
    if (sha256(articleRaw) !== handoff.articleSha256 || sha256(articleRaw) !== request.bindings.articleSha256) throw new Error(`${request.requestId}: article digest differs from the request or mission handoff`);
    if (article.data.status !== 'draft' || article.data.researchRun !== request.runId) throw new Error(`${request.requestId}: article is not the bound draft`);

    const reviewRecord = await readJsonRecord(root, handoff.reviewReceiptPath);
    if (reviewRecord.sha256 !== handoff.reviewReceiptSha256 || reviewRecord.data.verdict !== 'passed' || (reviewRecord.data.blockers ?? []).length > 0) throw new Error(`${request.requestId}: independent editorial receipt is missing, stale, or not a clean pass`);
    if (reviewRecord.data.missionId !== missionRecord.data.missionId || reviewRecord.data.runId !== request.runId) throw new Error(`${request.requestId}: independent editorial receipt has different mission provenance`);

    eligible.push({
      requestRecord: { ...requestRecord, data: request },
      missionRecord,
      runRecord,
      articleRecord: { path: articlePath, raw: articleRaw, data: article.data, sha256: sha256(articleRaw) },
      reviewRecord,
      registryRecord,
      promptBookRecord: { path: 'visuals/PROMPTS.md', raw: promptBookRaw, sha256: sha256(promptBookRaw) }
    });
  }

  if (requestedId && eligible.length !== 1) throw new Error(`${requestedId}: visual production target is not eligible`);
  if (!requestedId && eligible.length > 1) throw new Error(`Multiple visual requests are eligible; dispatch one exact request ID: ${eligible.map((entry) => entry.requestRecord.data.requestId).join(', ')}`);
  return { target: eligible[0] ?? null, eligibleCount: eligible.length };
}
