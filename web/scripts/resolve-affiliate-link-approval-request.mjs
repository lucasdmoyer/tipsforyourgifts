import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadAffiliateLinkState } from './lib/affiliate-link-contract.mjs';
import { resolveAffiliateLinkApprovalIssueRequest, resolveAffiliateLinkApprovalManualRequest } from './lib/affiliate-link-approval-request-contract.mjs';

function readArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function main() {
  const repositoryRoot = process.cwd();
  const state = await loadAffiliateLinkState(path.join(repositoryRoot, 'web'));
  const requestPath = readArgument('request-path');
  const result = requestPath
    ? resolveAffiliateLinkApprovalIssueRequest({ issue: JSON.parse(await fs.readFile(requestPath, 'utf8')), state })
    : resolveAffiliateLinkApprovalManualRequest({
        candidateId: readArgument('candidate-id'),
        expectedCandidateSha256: readArgument('expected-candidate-sha256'),
        expectedReviewSha256: readArgument('expected-review-sha256'),
        confirmation: readArgument('confirmation'),
        state
      });
  console.log(`candidate_id=${result.candidateId}`);
  console.log(`expected_candidate_sha256=${result.expectedCandidateSha256}`);
  console.log(`expected_review_sha256=${result.expectedReviewSha256}`);
  console.log(`confirmation=${result.confirmation}`);
  console.log(`request_source=${result.source}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
