import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const runId = '20260803-useful-gifts-hard-to-shop-for-adults-ceca335c';
const slug = 'useful-gifts-for-hard-to-shop-for-adults';
const thoughtfulRunId = '20260803-gifts-for-golf-friend-53cb00a5';
const thoughtfulSlug = 'gifts-for-a-golf-friend';

async function makeFixture() {
  const fixture = await fs.mkdtemp(path.join(root, '.gate-fixture-'));
  for (const relative of ['config', 'research', 'social', 'src/data']) {
    await fs.cp(path.join(root, relative), path.join(fixture, relative), { recursive: true });
  }
  await fs.mkdir(path.join(fixture, 'scripts'), { recursive: true });
  await fs.copyFile(path.join(root, 'scripts', 'validate-research.mjs'), path.join(fixture, 'scripts', 'validate-research.mjs'));
  return fixture;
}

function executeGate(fixture) {
  return spawnSync(process.execPath, ['scripts/validate-research.mjs'], { cwd: fixture, encoding: 'utf8' });
}

async function updateJson(filePath, update) {
  const value = JSON.parse(await fs.readFile(filePath, 'utf8'));
  update(value);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const failures = [];
let checks = 0;
async function expectFailure(label, mutate) {
  const fixture = await makeFixture();
  try {
    await mutate(fixture);
    const result = executeGate(fixture);
    checks += 1;
    if (result.status === 0) failures.push(`${label}: validator unexpectedly passed`);
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
}

const baseline = await makeFixture();
try {
  const result = executeGate(baseline);
  checks += 1;
  if (result.status !== 0) failures.push(`baseline: ${result.stderr || result.stdout}`);
} finally {
  await fs.rm(baseline, { recursive: true, force: true });
}

await expectFailure('publication-ready article with non-validated run', async (fixture) => {
  await updateJson(path.join(fixture, 'research', 'runs', `${runId}.json`), (run) => { run.status = 'researching'; });
});

await expectFailure('missing independent QA receipt', async (fixture) => {
  await fs.rm(path.join(fixture, 'research', 'reviews', `${runId}.qa.v1.json`));
});

await expectFailure('duplicate source ID', async (fixture) => {
  await updateJson(path.join(fixture, 'research', 'runs', `${runId}.json`), (run) => { run.sources[1].id = run.sources[0].id; });
});

await expectFailure('two independent reviews from one group', async (fixture) => {
  await updateJson(path.join(fixture, 'research', 'runs', `${runId}.json`), (run) => {
    const first = run.sources.find((source) => source.id === 'src-thermopop-angrybbq');
    const second = run.sources.find((source) => source.id === 'src-thermopop-foodnetwork');
    second.independenceGroup = first.independenceGroup;
  });
});

await expectFailure('article product absent from finalists', async (fixture) => {
  const articlePath = path.join(fixture, 'src', 'data', 'blog', `${slug}.md`);
  const article = await fs.readFile(articlePath, 'utf8');
  await fs.writeFile(articlePath, article.replace('id: peak-design-packing-cube-medium', 'id: unreviewed-product'));
});

await expectFailure('tracking parameters on a non-affiliate link', async (fixture) => {
  const articlePath = path.join(fixture, 'src', 'data', 'blog', `${slug}.md`);
  const article = await fs.readFile(articlePath, 'utf8');
  await fs.writeFile(articlePath, article.replace('https://www.peakdesign.com/products/packing-cube"', 'https://www.peakdesign.com/products/packing-cube?utm_source=unapproved"'));
});

await expectFailure('social post linking away from owned content', async (fixture) => {
  await updateJson(path.join(fixture, 'social', 'drafts', `${slug}-launch.json`), (pack) => {
    pack.posts[0].destinationUrl = 'https://example.com/merchant';
  });
});

await expectFailure('pairing thesis missing compatibility checks', async (fixture) => {
  await updateJson(path.join(fixture, 'src', 'data', 'strategy.json'), (strategy) => {
    strategy.ideas.find((idea) => idea.id === 'founder-idea-004').pairing.compatibilityChecks = [];
  });
});

await expectFailure('pairing below the thoughtfulness coherence gate', async (fixture) => {
  await updateJson(path.join(fixture, 'src', 'data', 'strategy.json'), (strategy) => {
    strategy.ideas.find((idea) => idea.id === 'founder-idea-004').pairing.coherenceScore = 60;
  });
});

await expectFailure('research run bound to a stale strategy digest', async (fixture) => {
  await updateJson(path.join(fixture, 'research', 'runs', `${thoughtfulRunId}.json`), (run) => {
    run.ideaSha256 = '0'.repeat(64);
  });
});

await expectFailure('thoughtful finalist missing its recipient scorecard', async (fixture) => {
  await updateJson(path.join(fixture, 'research', 'runs', `${thoughtfulRunId}.json`), (run) => {
    delete run.finalists[0].thoughtfulness;
  });
});

await expectFailure('gift pair using the same product twice', async (fixture) => {
  await updateJson(path.join(fixture, 'research', 'runs', `${thoughtfulRunId}.json`), (run) => {
    run.pairs[0].companionCandidateId = run.pairs[0].anchorCandidateId;
  });
});

await expectFailure('gift pair below the reviewed coherence threshold', async (fixture) => {
  await updateJson(path.join(fixture, 'research', 'runs', `${thoughtfulRunId}.json`), (run) => {
    run.pairs[0].score = { sharedCuriosity: 10, complementaryRoles: 10, interactionLoop: 10, observableTrigger: 10, independentValue: 5, compatibility: 5, ownershipEase: 3, total: 53 };
  });
});

await expectFailure('social draft referencing an unreviewed gift pair', async (fixture) => {
  await updateJson(path.join(fixture, 'social', 'drafts', `${thoughtfulSlug}-launch.json`), (pack) => {
    pack.posts[0].pairIds = ['unreviewed-pair'];
  });
});

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ negativeGateTests: 'passed', checks }, null, 2));
}
