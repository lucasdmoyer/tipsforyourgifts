import fs from 'node:fs/promises';
import process from 'node:process';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const currentSha = process.env.CURRENT_SHA;
const outputPath = process.argv[2] ?? 'rollback-target.json';
if (!token || !repository || !/^[0-9a-f]{40}$/.test(currentSha ?? '')) {
  throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY, and a 40-character CURRENT_SHA are required');
}

const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'tipsforyourgifts-release-gate'
};
async function getJson(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${path} returned ${response.status}`);
  return response.json();
}

const deployments = await getJson('/deployments?environment=production&per_page=100');
let target;
for (const deployment of deployments) {
  if (deployment.sha === currentSha) continue;
  const statuses = await getJson(`/deployments/${deployment.id}/statuses?per_page=1`);
  if (statuses[0]?.state !== 'success') continue;
  target = {
    deploymentId: deployment.id,
    sha: deployment.sha,
    ref: deployment.ref,
    environment: deployment.environment,
    deployedAt: statuses[0].created_at,
    recordedAt: new Date().toISOString()
  };
  break;
}
if (!target || !/^[0-9a-f]{40}$/.test(target.sha)) throw new Error('No prior successful production deployment was available as a rollback target');
await fs.writeFile(outputPath, `${JSON.stringify(target, null, 2)}\n`);
console.log(JSON.stringify({ rollbackTargetRecorded: true, deploymentId: target.deploymentId, sha: target.sha }, null, 2));
