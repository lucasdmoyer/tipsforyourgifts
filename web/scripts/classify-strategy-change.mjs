import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyStrategyProposal } from './verify-strategy-proposal-patch.mjs';
import { verifyStrategyApprovalChange } from './verify-strategy-approval-change.mjs';

export function classifyStrategyChange(base, current) {
  try {
    const proposal = verifyStrategyProposal(base, current);
    if (proposal.hasProposal) {
      return { gate: 'passed', changeType: 'proposal', launchResearch: false, proposalId: proposal.proposalId };
    }
    return { gate: 'passed', changeType: 'no_change', launchResearch: false };
  } catch (proposalError) {
    try {
      return verifyStrategyApprovalChange(base, current);
    } catch (approvalError) {
      throw new Error(`Strategy change is neither a valid proposal nor a valid approval.\nProposal boundary: ${proposalError.message}\nApproval boundary: ${approvalError.message}`);
    }
  }
}

async function main() {
  const [basePath, currentPath] = process.argv.slice(2);
  if (!basePath || !currentPath) throw new Error('Usage: node classify-strategy-change.mjs <base-strategy.json> <current-strategy.json>');
  const [base, current] = await Promise.all([
    fs.readFile(path.resolve(basePath), 'utf8').then(JSON.parse),
    fs.readFile(path.resolve(currentPath), 'utf8').then(JSON.parse)
  ]);
  console.log(JSON.stringify(classifyStrategyChange(base, current), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
