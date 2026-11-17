import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { affiliateCoverageSchema } from './lib/affiliate-coverage-contract.mjs';
import { buildAffiliateEnrollmentReadiness } from './lib/affiliate-enrollment-contract.mjs';

const root = process.cwd();
const affiliate = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const coverage = affiliateCoverageSchema.parse(JSON.parse(await fs.readFile(path.join(root, 'public', 'affiliate-product-coverage.json'), 'utf8')));
const plan = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-enrollment-plans.json'), 'utf8'));
const artifact = buildAffiliateEnrollmentReadiness({ affiliate, coverage, plan });
const outputPath = path.join(root, 'public', 'affiliate-enrollment-readiness.json');
await fs.writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({
  generated: path.relative(root, outputPath),
  programs: artifact.counts.totalPrograms,
  packetsReady: artifact.counts.publicApplicationPacketsReady,
  enrollmentAllowed: artifact.counts.externalEnrollmentAllowedByRegistry,
  awaitingFounderApproval: artifact.counts.awaitingFounderProgramApproval,
  enabledPrograms: artifact.counts.enabledPrograms
}, null, 2));
