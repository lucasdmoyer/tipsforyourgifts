import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function fail(errors) {
  const error = new Error(`Strategy approval handoff failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:\n- ${errors.join('\n- ')}`);
  error.issues = errors;
  throw error;
}

export function verifyStrategyApprovalChange(base, current) {
  const errors = [];
  const allowedTopLevel = ['schemaVersion', 'updatedAt', 'northStar', 'currentBet', 'thoughtfulnessFramework', 'ideas'];
  if (!same(Object.keys(base).sort(), allowedTopLevel.slice().sort()) || !same(Object.keys(current).sort(), allowedTopLevel.slice().sort())) {
    errors.push('strategy top-level keys changed');
  }
  for (const key of ['schemaVersion', 'northStar', 'currentBet', 'thoughtfulnessFramework']) {
    if (!same(base[key], current[key])) errors.push(`${key} must remain unchanged during approval`);
  }
  if (!Array.isArray(base.ideas) || !Array.isArray(current.ideas)) errors.push('ideas must remain arrays');
  if (errors.length) fail(errors);

  if (current.ideas.length !== base.ideas.length) errors.push('strategy approval cannot add or remove ideas');
  const changedIndexes = base.ideas
    .map((idea, index) => same(idea, current.ideas[index]) ? -1 : index)
    .filter((index) => index >= 0);
  if (changedIndexes.length !== 1) errors.push('strategy approval must change exactly one existing idea');
  if (errors.length) fail(errors);

  const index = changedIndexes[0];
  const prior = base.ideas[index];
  const approved = current.ideas[index];
  if (approved.id !== prior.id) errors.push('approved idea ID cannot change');
  if (prior.founderDisposition !== 'proposed') errors.push(`${prior.id}: only a proposed idea can become approved for research`);
  if (approved.founderDisposition !== 'approved_for_research') errors.push(`${prior.id}: approval must set founderDisposition to approved_for_research`);
  if (approved.revision !== prior.revision + 1) errors.push(`${prior.id}: approval must advance the revision exactly once`);

  const normalized = { ...approved, revision: prior.revision, founderDisposition: prior.founderDisposition };
  if (!same(prior, normalized)) errors.push(`${prior.id}: approval cannot rewrite the thesis, research brief, evidence requirements, or deliverables`);

  const baseUpdatedAt = Date.parse(base.updatedAt);
  const currentUpdatedAt = Date.parse(current.updatedAt);
  if (!Number.isFinite(currentUpdatedAt) || currentUpdatedAt <= baseUpdatedAt) errors.push('updatedAt must advance during approval');
  if (errors.length) fail(errors);

  return {
    gate: 'passed',
    changeType: 'approval',
    launchResearch: true,
    ideaId: approved.id,
    ideaRevision: approved.revision
  };
}

async function main() {
  const [basePath, currentPath] = process.argv.slice(2);
  if (!basePath || !currentPath) throw new Error('Usage: node verify-strategy-approval-change.mjs <base-strategy.json> <current-strategy.json>');
  const [base, current] = await Promise.all([
    fs.readFile(path.resolve(basePath), 'utf8').then(JSON.parse),
    fs.readFile(path.resolve(currentPath), 'utf8').then(JSON.parse)
  ]);
  console.log(JSON.stringify(verifyStrategyApprovalChange(base, current), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
