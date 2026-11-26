import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { highRiskClaimsForRun } from './lib/editorial-safety-contract.mjs';
import { researchMissionSchema } from './lib/research-mission-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const runId = args['run-id'];
const missionId = args['mission-id'];
if (!runId || !missionId) throw new Error('Usage: node scripts/resolve-research-review-route.mjs --run-id=<id> --mission-id=<id>');

const root = process.cwd();
const run = JSON.parse(await fs.readFile(path.join(root, 'research', 'runs', `${runId}.json`), 'utf8'));
const mission = researchMissionSchema.parse(JSON.parse(await fs.readFile(path.join(root, 'research', 'missions', `${missionId}.json`), 'utf8')));
if (!['drafted', 'qa_failed'].includes(run.status) || run.article?.status !== 'draft' || run.qa?.passed !== false) {
  throw new Error('Research review routing requires one unpromoted draft bundle');
}
if (mission.status !== 'started') throw new Error('Research review routing requires a started mission');
if (run.ideaId !== mission.idea.id || run.ideaRevision !== mission.idea.revision || run.ideaSha256 !== mission.idea.sha256) {
  throw new Error('Research bundle is not bound to the trusted mission idea');
}

const highRiskClaims = highRiskClaimsForRun(run);
const reviewRoute = highRiskClaims.length > 0 ? 'founder_safety' : 'independent_review';
if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(process.env.GITHUB_OUTPUT, `review_route=${reviewRoute}\nhigh_risk_claims=${highRiskClaims.length}\n`);
}
console.log(JSON.stringify({
  runId,
  missionId,
  reviewRoute,
  highRiskClaims: highRiskClaims.map((claim) => claim.id),
  independentReviewDeferred: reviewRoute === 'founder_safety',
  publicationAuthorized: false
}, null, 2));
