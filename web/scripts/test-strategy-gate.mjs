import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { verifyStrategyProposal } from './verify-strategy-proposal-patch.mjs';

const root = process.cwd();
const base = JSON.parse(await fs.readFile(path.join(root, 'src', 'data', 'strategy.json'), 'utf8'));

function clone(value) {
  return structuredClone(value);
}

function validProposal(strategy) {
  const next = clone(strategy);
  next.updatedAt = new Date(Date.parse(strategy.updatedAt) + 1000).toISOString();
  next.ideas.push({
    ...clone(strategy.ideas.at(-1)),
    id: `founder-idea-${String(strategy.ideas.length + 1).padStart(3, '0')}`,
    revision: 1,
    founderDisposition: 'proposed',
    title: 'A distinct strategy proposal for boundary testing',
    researchBrief: 'Research a distinct recipient-friction strategy proposal for boundary testing, with observable fit signals, explicit exclusions, and no assumed product claims.'
  });
  return next;
}

function expectFailure(label, mutate) {
  const current = validProposal(base);
  mutate(current);
  assert.throws(() => verifyStrategyProposal(base, current), undefined, label);
}

assert.deepEqual(verifyStrategyProposal(base, clone(base)), { gate: 'passed', hasProposal: false, proposalId: null });
const nextIdeaNumber = Math.max(...base.ideas.map((idea) => Number(/^founder-idea-(\d{3})$/.exec(idea.id)?.[1] ?? 0))) + 1;
const expectedProposalId = `founder-idea-${String(nextIdeaNumber).padStart(3, '0')}`;
assert.equal(verifyStrategyProposal(base, validProposal(base)).proposalId, expectedProposalId);

expectFailure('cannot change north star', (current) => { current.northStar = 'Changed by the AI'; });
expectFailure('cannot revise existing ideas', (current) => { current.ideas[0].priority = 'low'; });
expectFailure('cannot self-approve', (current) => { current.ideas.at(-1).founderDisposition = 'approved_for_research'; });
expectFailure('must start at revision one', (current) => { current.ideas.at(-1).revision = 2; });
expectFailure('must use the sequential ID', (current) => { current.ideas.at(-1).id = 'founder-idea-099'; });
expectFailure('cannot add multiple proposals', (current) => { current.ideas.push(clone(current.ideas.at(-1))); });
expectFailure('must advance updatedAt', (current) => { current.updatedAt = base.updatedAt; });
expectFailure('cannot duplicate a title', (current) => { current.ideas.at(-1).title = base.ideas[0].title; });

console.log(JSON.stringify({ strategyNegativeGateTests: 'passed', checks: 8, noChangeCheck: 'passed', validProposalCheck: 'passed' }, null, 2));
