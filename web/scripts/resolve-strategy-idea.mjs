import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const strategyPath = path.join(root, 'src', 'data', 'strategy.json');
const ideaId = process.argv[2];

if (!ideaId || !/^founder-idea-\d{3}$/.test(ideaId)) {
  throw new Error('Usage: npm run strategy:resolve -- founder-idea-003');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

const strategy = JSON.parse(await fs.readFile(strategyPath, 'utf8'));
const idea = strategy.ideas.find((entry) => entry.id === ideaId);
if (!idea) throw new Error(`Unknown strategy idea: ${ideaId}`);
if (idea.founderDisposition !== 'approved_for_research') {
  throw new Error(`${ideaId} is ${idea.founderDisposition}; only founder-approved ideas can start research`);
}

const canonicalIdea = JSON.stringify(canonicalize(idea));
const ideaSha256 = crypto.createHash('sha256').update(`${canonicalIdea}\n`).digest('hex');
const resolved = {
  strategySchemaVersion: strategy.schemaVersion,
  ideaId: idea.id,
  ideaRevision: idea.revision,
  ideaSha256,
  idea
};
const resolvedJson = JSON.stringify(resolved, null, 2);

if (process.env.GITHUB_OUTPUT) {
  const delimiter = `RESOLVED_IDEA_${crypto.randomBytes(8).toString('hex')}`;
  await fs.appendFile(process.env.GITHUB_OUTPUT, `idea_id=${idea.id}\nidea_revision=${idea.revision}\nidea_sha256=${ideaSha256}\nresolved_json<<${delimiter}\n${resolvedJson}\n${delimiter}\n`);
} else {
  console.log(resolvedJson);
}
