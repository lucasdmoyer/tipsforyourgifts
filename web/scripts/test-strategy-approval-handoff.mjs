import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { classifyStrategyChange } from './classify-strategy-change.mjs';
import { strategyApprovalIssueUrl } from './lib/founder-agenda-contract.mjs';
import { resolveIssueApprovalRequest, resolveManualApprovalRequest, strategyApprovalAuthorityLines } from './resolve-strategy-approval-request.mjs';
import { verifyStrategyApprovalChange } from './verify-strategy-approval-change.mjs';

const root = process.cwd();
const repositoryStrategy = JSON.parse(await fs.readFile(path.join(root, 'src', 'data', 'strategy.json'), 'utf8'));
const base = structuredClone(repositoryStrategy);
let proposedFixtureCount = base.ideas.filter((idea) => idea.founderDisposition === 'proposed').length;
for (const seed of [...base.ideas].reverse()) {
  if (proposedFixtureCount >= 2) break;
  if (seed.founderDisposition !== 'approved_for_research') continue;
  seed.founderDisposition = 'proposed';
  seed.revision = Math.max(1, seed.revision - 1);
  proposedFixtureCount += 1;
}
const proposedIdeaId = base.ideas.find((idea) => idea.founderDisposition === 'proposed')?.id;
assert.ok(proposedIdeaId, 'fixture requires one proposed idea');
const proposedIdea = base.ideas.find((idea) => idea.id === proposedIdeaId);

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

const approvalUrl = new URL(strategyApprovalIssueUrl(proposedIdea));
assert.equal(approvalUrl.origin, 'https://github.com');
assert.equal(approvalUrl.pathname, '/lucasdmoyer/tipsforyourgifts/issues/new');
const issueTitle = approvalUrl.searchParams.get('title');
const uncheckedIssueBody = approvalUrl.searchParams.get('body');
assert.equal(issueTitle, `[Approve Strategy] ${proposedIdea.id} revision ${proposedIdea.revision}`);
assert.ok(uncheckedIssueBody?.includes('## Exact decision'));
for (const line of strategyApprovalAuthorityLines) assert.ok(uncheckedIssueBody.includes(`- [ ] ${line}`));

const checkedIssueBody = uncheckedIssueBody.replaceAll('- [ ] ', '- [x] ');
const validIssue = {
  title: issueTitle,
  body: checkedIssueBody,
  html_url: 'https://github.com/lucasdmoyer/tipsforyourgifts/issues/999',
  user: { login: 'lucasdmoyer' },
  author_association: 'OWNER'
};
const issueResolution = resolveIssueApprovalRequest({ issue: validIssue, strategy: base });
assert.equal(issueResolution.ideaId, proposedIdea.id);
assert.equal(issueResolution.expectedRevision, proposedIdea.revision);
assert.equal(issueResolution.source, 'owner_issue');

const manualResolution = resolveManualApprovalRequest({ ideaId: proposedIdea.id, expectedRevision: String(proposedIdea.revision), strategy: base });
assert.equal(manualResolution.ideaSha256, issueResolution.ideaSha256);
assert.equal(manualResolution.source, 'workflow_dispatch');

assert.throws(() => resolveIssueApprovalRequest({ issue: { ...validIssue, body: uncheckedIssueBody }, strategy: base }), /authority check is missing/, 'unchecked authority must fail');
assert.throws(() => resolveIssueApprovalRequest({ issue: { ...validIssue, user: { login: 'not-the-owner' } }, strategy: base }), /repository owner/, 'non-owner issue must fail');
assert.throws(() => resolveIssueApprovalRequest({ issue: { ...validIssue, html_url: 'https://github.com/elsewhere/repository/issues/999' }, strategy: base }), /outside the canonical repository/, 'wrong repository must fail');
assert.throws(() => resolveIssueApprovalRequest({ issue: { ...validIssue, body: checkedIssueBody.replace(issueResolution.ideaSha256, '0'.repeat(64)) }, strategy: base }), /digest does not match/, 'changed digest must fail');
assert.throws(() => resolveIssueApprovalRequest({ issue: { ...validIssue, body: `${checkedIssueBody}\n\n## Exact decision\n\n\`\`\`json\n{}\n\`\`\`` }, strategy: base }), /exactly one/, 'duplicate decision block must fail');

const workflowSource = await fs.readFile(path.join(root, '..', '.github', 'workflows', 'strategy-approval.yml'), 'utf8');
assert.match(workflowSource, /issues:\s*\n\s+types: \[opened, reopened\]/);
assert.match(workflowSource, /github\.event\.issue\.author_association == 'OWNER'/);
assert.match(workflowSource, /resolve-strategy-approval-request\.mjs --request-path=/);
assert.doesNotMatch(workflowSource, /strategy:approve[^\n]*inputs\.idea_id/);

console.log(JSON.stringify({
  strategyApprovalHandoffTests: 'passed',
  negativeChecks: 14,
  validApproval: approvalResult.ideaId,
  mobileOwnerIssue: 'passed',
  exactIdeaDigest: issueResolution.ideaSha256,
  workflowDispatchFallback: 'passed',
  proposalClassification: 'passed',
  noChangeClassification: 'passed'
}, null, 2));
