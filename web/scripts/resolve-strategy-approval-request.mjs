import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalIdeaSha256 } from './lib/research-mission-contract.mjs';

const repository = 'lucasdmoyer/tipsforyourgifts';
const ideaIdPattern = /^founder-idea-\d{3}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

export const strategyApprovalAuthorityLines = Object.freeze([
  'I authorize deterministic approval of this exact proposed revision for research.',
  'I understand that merging the resulting pull request may start one hash-bound research mission.',
  'This does not authorize publication, affiliate enrollment, social posting, credentials, spend, or Firebase deployment.'
]);

function assertIdeaId(value) {
  if (!ideaIdPattern.test(value ?? '')) throw new Error('Strategy approval idea ID is invalid');
  return value;
}

function assertRevision(value) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Strategy approval revision must be a positive integer');
  return revision;
}

function findProposedIdea(strategy, ideaId, expectedRevision) {
  const idea = strategy.ideas?.find((candidate) => candidate.id === ideaId);
  if (!idea) throw new Error(`Strategy idea ${ideaId} does not exist`);
  if (idea.founderDisposition !== 'proposed') throw new Error(`Strategy idea ${ideaId} is not proposed`);
  if (idea.revision !== expectedRevision) throw new Error(`Strategy idea ${ideaId} is revision ${idea.revision}, not ${expectedRevision}`);
  return idea;
}

function exactDecisionBlocks(body) {
  const blocks = [];
  const pattern = /(?:^|\n)## Exact decision\s*\n```json\s*\n([\s\S]*?)\n```/g;
  for (const match of String(body ?? '').replaceAll('\r\n', '\n').matchAll(pattern)) blocks.push(match[1]);
  return blocks;
}

function parseExactDecision(body) {
  const blocks = exactDecisionBlocks(body);
  if (blocks.length !== 1) throw new Error('Strategy approval issue must contain exactly one Exact decision JSON block');
  let decision;
  try {
    decision = JSON.parse(blocks[0]);
  } catch {
    throw new Error('Strategy approval Exact decision block is not valid JSON');
  }
  const expectedKeys = ['decision', 'expectedRevision', 'ideaId', 'ideaSha256', 'schemaVersion'];
  const keys = Object.keys(decision).sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) throw new Error('Strategy approval Exact decision contains unexpected fields');
  if (decision.schemaVersion !== '1.0.0') throw new Error('Strategy approval schema version is unsupported');
  if (decision.decision !== 'approve_for_research') throw new Error('Strategy approval decision is invalid');
  assertIdeaId(decision.ideaId);
  assertRevision(decision.expectedRevision);
  if (!sha256Pattern.test(decision.ideaSha256 ?? '')) throw new Error('Strategy approval idea digest is invalid');
  return decision;
}

function assertAuthorityChecks(body) {
  const normalized = String(body ?? '').replaceAll('\r\n', '\n');
  for (const line of strategyApprovalAuthorityLines) {
    const checked = `- [x] ${line}`;
    if (!normalized.toLowerCase().includes(checked.toLowerCase())) throw new Error(`Strategy approval authority check is missing: ${line}`);
  }
}

export function resolveIssueApprovalRequest({ issue, strategy }) {
  if (issue?.user?.login !== 'lucasdmoyer' || issue?.author_association !== 'OWNER') throw new Error('Strategy approval issue must be submitted by repository owner lucasdmoyer');
  if (!new RegExp(`^https://github\\.com/${repository.replace('/', '\\/')}/issues/[1-9]\\d*$`).test(issue?.html_url ?? '')) throw new Error('Strategy approval issue URL is outside the canonical repository');
  const decision = parseExactDecision(issue.body);
  const expectedTitle = `[Approve Strategy] ${decision.ideaId} revision ${decision.expectedRevision}`;
  if (issue.title !== expectedTitle) throw new Error(`Strategy approval title must be exactly ${expectedTitle}`);
  assertAuthorityChecks(issue.body);
  const idea = findProposedIdea(strategy, decision.ideaId, decision.expectedRevision);
  if (canonicalIdeaSha256(idea) !== decision.ideaSha256) throw new Error('Strategy approval idea digest does not match the current proposed revision');
  return { ideaId: decision.ideaId, expectedRevision: decision.expectedRevision, ideaSha256: decision.ideaSha256, source: 'owner_issue' };
}

export function resolveManualApprovalRequest({ ideaId, expectedRevision, strategy }) {
  const safeIdeaId = assertIdeaId(ideaId);
  const safeRevision = assertRevision(expectedRevision);
  const idea = findProposedIdea(strategy, safeIdeaId, safeRevision);
  return { ideaId: safeIdeaId, expectedRevision: safeRevision, ideaSha256: canonicalIdeaSha256(idea), source: 'workflow_dispatch' };
}

function readArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function main() {
  const root = process.cwd();
  const strategy = JSON.parse(await fs.readFile(path.join(root, 'web', 'src', 'data', 'strategy.json'), 'utf8'));
  const requestPath = readArgument('request-path');
  const result = requestPath
    ? resolveIssueApprovalRequest({ issue: JSON.parse(await fs.readFile(requestPath, 'utf8')), strategy })
    : resolveManualApprovalRequest({ ideaId: readArgument('idea-id'), expectedRevision: readArgument('expected-revision'), strategy });
  console.log(`idea_id=${result.ideaId}`);
  console.log(`expected_revision=${result.expectedRevision}`);
  console.log(`idea_sha256=${result.ideaSha256}`);
  console.log(`request_source=${result.source}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
