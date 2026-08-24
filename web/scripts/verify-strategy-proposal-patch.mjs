import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function fail(errors) {
  const error = new Error(`Strategy proposal boundary failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:\n- ${errors.join('\n- ')}`);
  error.issues = errors;
  throw error;
}

function nextIdeaId(ideas) {
  const highest = ideas.reduce((maximum, idea) => {
    const match = /^founder-idea-(\d{3})$/.exec(idea.id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `founder-idea-${String(highest + 1).padStart(3, '0')}`;
}

export function verifyStrategyProposal(base, current) {
  const errors = [];
  const allowedTopLevel = ['schemaVersion', 'updatedAt', 'northStar', 'currentBet', 'thoughtfulnessFramework', 'ideas'];
  if (!same(Object.keys(current).sort(), allowedTopLevel.slice().sort())) errors.push('strategy top-level keys changed');
  for (const key of ['schemaVersion', 'northStar', 'currentBet', 'thoughtfulnessFramework']) {
    if (!same(base[key], current[key])) errors.push(`${key} is founder-controlled and cannot change in a proposal`);
  }
  if (!Array.isArray(base.ideas) || !Array.isArray(current.ideas)) errors.push('ideas must remain arrays');
  if (errors.length) fail(errors);

  if (current.ideas.length === base.ideas.length) {
    if (!same(base, current)) errors.push('a no-proposal result must leave strategy.json byte-equivalent as data');
    if (errors.length) fail(errors);
    return { gate: 'passed', hasProposal: false, proposalId: null };
  }

  if (current.ideas.length !== base.ideas.length + 1) errors.push('the strategy council may append at most one proposal');
  if (!same(current.ideas.slice(0, base.ideas.length), base.ideas)) errors.push('existing strategy ideas are immutable in the proposal stage');
  const proposal = current.ideas[base.ideas.length];
  if (!proposal || typeof proposal !== 'object') errors.push('the appended proposal is missing');
  if (errors.length) fail(errors);

  const expectedId = nextIdeaId(base.ideas);
  if (proposal.id !== expectedId) errors.push(`proposal ID must be the next sequential ID: ${expectedId}`);
  if (proposal.revision !== 1) errors.push('a new proposal must start at revision 1');
  if (proposal.founderDisposition !== 'proposed') errors.push('the AI strategy council cannot approve its own proposal');
  if (base.ideas.some((idea) => idea.title.trim().toLowerCase() === proposal.title?.trim().toLowerCase())) errors.push('proposal title duplicates an existing idea');
  if (base.ideas.some((idea) => idea.researchBrief.trim().toLowerCase() === proposal.researchBrief?.trim().toLowerCase())) errors.push('proposal research brief duplicates an existing idea');

  const baseUpdatedAt = Date.parse(base.updatedAt);
  const currentUpdatedAt = Date.parse(current.updatedAt);
  if (!Number.isFinite(currentUpdatedAt) || currentUpdatedAt <= baseUpdatedAt) errors.push('updatedAt must advance when a proposal is appended');
  if (errors.length) fail(errors);

  return { gate: 'passed', hasProposal: true, proposalId: proposal.id };
}

async function main() {
  const [basePath, currentPath] = process.argv.slice(2);
  if (!basePath || !currentPath) throw new Error('Usage: node verify-strategy-proposal-patch.mjs <base-strategy.json> <current-strategy.json>');
  const [base, current] = await Promise.all([
    fs.readFile(path.resolve(basePath), 'utf8').then(JSON.parse),
    fs.readFile(path.resolve(currentPath), 'utf8').then(JSON.parse)
  ]);
  console.log(JSON.stringify(verifyStrategyProposal(base, current), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
