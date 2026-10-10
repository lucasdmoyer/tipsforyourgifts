import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  affiliateLinkBatchInputSchema,
  affiliateLinkBatchManifestSchema,
  buildCandidateFromRepository,
  loadAffiliateLinkState,
  sha256
} from './lib/affiliate-link-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
if (!args.input) throw new Error('Missing required --input argument');
if (!args['founder-login']) throw new Error('Missing required --founder-login argument');

const root = process.cwd();
const inputPath = path.resolve(root, args.input);
const raw = await fs.readFile(inputPath);
const input = affiliateLinkBatchInputSchema.parse(JSON.parse(raw.toString('utf8')));
const inputSha256 = sha256(raw);
if (args.confirmation !== `IMPORT-${input.exportId}-${inputSha256}`) throw new Error(`Action-time confirmation must equal IMPORT-${input.exportId}-${inputSha256}`);

const sourceArtifactPath = `affiliate/source-artifacts/${input.exportId}.json`;
const sourceTarget = path.join(root, sourceArtifactPath);
const candidateDirectory = path.join(root, 'affiliate', 'candidates');
const batchDirectory = path.join(root, 'affiliate', 'batches');
const batchTarget = path.join(batchDirectory, `${input.exportId}.json`);
const newlyWritten = [];

async function existingBytes(target) {
  try { return await fs.readFile(target); } catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

async function writeIdempotent(target, expected) {
  const existing = await existingBytes(target);
  if (existing) {
    if (!existing.equals(expected)) throw new Error(`${path.relative(root, target)} already exists with different bytes`);
    return false;
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, expected, { flag: 'wx' });
  newlyWritten.push(target);
  return true;
}

let candidates = [];
let candidatesCreated = 0;
try {
  await writeIdempotent(sourceTarget, raw);
  for (const record of input.records) {
    candidates.push(await buildCandidateFromRepository(root, {
      ...record,
      programId: input.programId,
      expectedProgramRevision: input.expectedProgramRevision,
      createdBy: args['founder-login'],
      createdAt: input.exportedAt,
      origin: { source: input.source, referenceId: input.exportId, sourceArtifactPath, sourceSha256: inputSha256 }
    }));
  }

  const candidateBytes = new Map(candidates.map((candidate) => [candidate.candidateId, Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`)]));
  const manifest = affiliateLinkBatchManifestSchema.parse({
    schemaVersion: '1.0.0',
    batchId: input.exportId,
    status: 'imported',
    programId: input.programId,
    programRevision: input.expectedProgramRevision,
    importedAt: input.exportedAt,
    importedBy: args['founder-login'],
    sourceArtifactPath,
    sourceArtifactSha256: inputSha256,
    candidateIds: candidates.map((candidate) => candidate.candidateId),
    candidateSha256: Object.fromEntries(candidates.map((candidate) => [candidate.candidateId, sha256(candidateBytes.get(candidate.candidateId))]))
  });

  await fs.mkdir(candidateDirectory, { recursive: true });
  for (const candidate of candidates) {
    if (await writeIdempotent(path.join(candidateDirectory, `${candidate.candidateId}.json`), candidateBytes.get(candidate.candidateId))) candidatesCreated += 1;
  }
  await writeIdempotent(batchTarget, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  await loadAffiliateLinkState(root);
} catch (error) {
  await Promise.allSettled(newlyWritten.reverse().map((target) => fs.unlink(target)));
  throw error;
}

if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(process.env.GITHUB_OUTPUT, `candidate_count=${candidates.length}\ncandidates_created=${candidatesCreated}\nexport_id=${input.exportId}\nexport_sha256=${inputSha256}\nsource_artifact_path=${sourceArtifactPath}\nbatch_manifest_path=affiliate/batches/${input.exportId}.json\n`);
}
console.log(JSON.stringify({
  batchImported: true,
  exportId: input.exportId,
  exportSha256: inputSha256,
  programId: input.programId,
  candidatesInBatch: candidates.length,
  candidatesCreated,
  candidatesReused: candidates.length - candidatesCreated,
  sourceArtifactPath,
  batchManifestPath: `affiliate/batches/${input.exportId}.json`,
  candidateIds: candidates.map((candidate) => candidate.candidateId),
  reviewed: false,
  approved: false,
  published: false
}, null, 2));
