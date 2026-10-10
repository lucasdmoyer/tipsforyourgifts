import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { affiliateCoverageSchema } from './lib/affiliate-coverage-contract.mjs';

const root = process.cwd();
const base = JSON.parse(await fs.readFile(path.join(root, 'public', 'affiliate-product-coverage.json'), 'utf8'));
affiliateCoverageSchema.parse(base);

function expectFailure(label, mutate) {
  const candidate = structuredClone(base);
  mutate(candidate);
  assert.throws(() => affiliateCoverageSchema.parse(candidate), undefined, label);
}

expectFailure('rejects incorrect catalog count', (coverage) => { coverage.counts.publicationReadyProductLinksCataloged += 1; });
expectFailure('rejects duplicate product keys', (coverage) => { coverage.products.push(structuredClone(coverage.products[0])); });
expectFailure('rejects duplicate candidate programs', (coverage) => { coverage.products[0].candidateProgramIds.push(coverage.products[0].candidateProgramIds[0]); });
expectFailure('rejects non-priority preferred program', (coverage) => { coverage.products[0].preferredResearchProgramId = coverage.products[0].candidateProgramIds.at(-1); });
expectFailure('rejects unsupported paid status', (coverage) => { coverage.products[0].status = 'verified_paid_link'; });
expectFailure('rejects unknown candidate program', (coverage) => { coverage.products[0].candidateProgramIds[0] = 'invented-partner'; coverage.products[0].preferredResearchProgramId = 'invented-partner'; });
expectFailure('rejects unknown verified paid program', (coverage) => { coverage.products[0].verifiedPaidProgramId = 'invented-partner'; coverage.products[0].status = 'verified_paid_link'; });
expectFailure('rejects duplicate program summaries', (coverage) => { coverage.programs.push(structuredClone(coverage.programs[0])); });
expectFailure('rejects priority gaps', (coverage) => { coverage.programs.at(-1).priority = 99; });
expectFailure('rejects false per-program research totals', (coverage) => { coverage.programs[0].productResearchCandidates += 1; });
expectFailure('rejects false per-program paid totals', (coverage) => { coverage.programs[0].verifiedPaidLinks += 1; });
expectFailure('rejects paid program outside product candidates', (coverage) => { coverage.products[0].verifiedPaidProgramId = 'bookshop-org-us-media'; coverage.products[0].status = 'verified_paid_link'; });
expectFailure('rejects candidate order outside registry priority', (coverage) => { coverage.products[0].candidateProgramIds.reverse(); coverage.products[0].preferredResearchProgramId = coverage.products[0].candidateProgramIds[0]; });

console.log(JSON.stringify({ affiliateCoverageGateTests: 'passed', checks: 13, sourceEditorialArtifactsMutated: false }, null, 2));
