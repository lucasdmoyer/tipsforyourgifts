import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { classifyStrategyChange } from './classify-strategy-change.mjs';
import { verifyStrategyApprovalChange } from './verify-strategy-approval-change.mjs';

const root = process.cwd();
const base = JSON.parse(await fs.readFile(path.join(root, 'src', 'data', 'strategy.json'), 'utf8'));
const proposedIdeaId = base.ideas.find((idea) => idea.founderDisposition === 'proposed')?.id;
assert.ok(proposedIdeaId, 'fixture requires one proposed idea');

function clone(value) {
  return structuredClone(value);
}

function advanceUpdatedAt(strategy) {
  strategy.updatedAt = new Date(Date.parse(strategy.updatedAt) + 1000).toISOString();
}

function validApproval(strategy) {
  const current = clone(strategy);
  const index = current.ideas.findIndex((idea) => idea.founderDisposition === 'proposed');
  assert.notEqual(index, -1, 'fixture requires one proposed idea');
  current.ideas[index].revision += 1;
  current.ideas[index].founderDisposition = 'approved_for_research';
  advanceUpdatedAt(current);
  return current;
}

function validProposal(strategy) {
  const current = clone(strategy);
  const highest = Math.max(...strategy.ideas.map((idea) => Number(/^founder-idea-(\d{3})$/.exec(idea.id)?.[1] ?? 0)));
  current.ideas.push({
    ...clone(strategy.ideas.at(-1)),
    id: `founder-idea-${String(highest + 1).padStart(3, '0')}`,
    revision: 1,
    founderDisposition: 'proposed',
    title: 'A distinct executive pairing proposal for handoff testing',
    researchBrief: 'Research a distinct two-item ritual pairing for boundary testing with exact observed friction, independent roles, one interaction, compatibility checks, and no assumed product claims.'
  });
  advanceUpdatedAt(current);
  return current;
}

function expectApprovalFailure(label, mutate) {
  const current = validApproval(base);
  mutate(current);
  assert.throws(() => verifyStrategyApprovalChange(base, current), undefined, label);
}

const approval = validApproval(base);
const approvalResult = verifyStrategyApprovalChange(base, approval);
assert.equal(approvalResult.ideaId, proposedIdeaId);
assert.equal(classifyStrategyChange(base, approval).changeType, 'approval');
assert.equal(classifyStrategyChange(base, validProposal(base)).changeType, 'proposal');
assert.equal(classifyStrategyChange(base, clone(base)).changeType, 'no_change');

expectApprovalFailure('cannot approve two ideas', (current) => {
  const second = current.ideas.findIndex((idea, index) => index > 0 && idea.founderDisposition === 'proposed');
  current.ideas[second].revision += 1;
  current.ideas[second].founderDisposition = 'approved_for_research';
});
expectApprovalFailure('cannot approve a previously approved idea', (current) => {
  current.ideas = clone(base.ideas);
  current.ideas[0].revision += 1;
  current.ideas[0].founderDisposition = 'approved_for_research';
});
expectApprovalFailure('cannot rewrite the title', (current) => { current.ideas.find((idea) => idea.id === proposedIdeaId).title = 'Rewritten during approval'; });
expectApprovalFailure('must advance exactly one revision', (current) => { current.ideas.find((idea) => idea.id === proposedIdeaId).revision += 1; });
expectApprovalFailure('cannot add an idea during approval', (current) => { current.ideas.push(clone(current.ideas.at(-1))); });
expectApprovalFailure('cannot remove an idea during approval', (current) => { current.ideas.pop(); });
expectApprovalFailure('must advance updatedAt', (current) => { current.updatedAt = base.updatedAt; });
expectApprovalFailure('cannot change the north star', (current) => { current.northStar = 'A different founder direction'; });
expectApprovalFailure('cannot pause instead of approving', (current) => { current.ideas.find((idea) => idea.id === proposedIdeaId).founderDisposition = 'paused'; });

console.log(JSON.stringify({
  strategyApprovalHandoffTests: 'passed',
  negativeChecks: 9,
  validApproval: approvalResult.ideaId,
  proposalClassification: 'passed',
  noChangeClassification: 'passed'
}, null, 2));
