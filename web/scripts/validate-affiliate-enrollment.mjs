import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { affiliateCoverageSchema } from './lib/affiliate-coverage-contract.mjs';
import { affiliateEnrollmentReadinessSchema, buildAffiliateEnrollmentReadiness } from './lib/affiliate-enrollment-contract.mjs';

const root = process.cwd();
const affiliate = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const coverage = affiliateCoverageSchema.parse(JSON.parse(await fs.readFile(path.join(root, 'public', 'affiliate-product-coverage.json'), 'utf8')));
const plan = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-enrollment-plans.json'), 'utf8'));
const actual = affiliateEnrollmentReadinessSchema.parse(JSON.parse(await fs.readFile(path.join(root, 'public', 'affiliate-enrollment-readiness.json'), 'utf8')));
const expected = buildAffiliateEnrollmentReadiness({ affiliate, coverage, plan });
assert.deepEqual(actual, expected, 'affiliate enrollment readiness artifact is stale or does not match repository sources');
assert.equal(actual.counts.totalPrograms, affiliate.programs.length, 'every affiliate program needs an enrollment packet');
assert.equal(actual.counts.publicApplicationPacketsReady, actual.counts.totalPrograms, 'every affiliate program needs a complete public application packet');
console.log(JSON.stringify({
  gate: 'passed',
  programs: actual.counts.totalPrograms,
  packetsReady: actual.counts.publicApplicationPacketsReady,
  enrollmentAllowed: actual.counts.externalEnrollmentAllowedByRegistry,
  awaitingFounderApproval: actual.counts.awaitingFounderProgramApproval,
  externallyEnrolled: actual.counts.externallyEnrolled,
  enabledPrograms: actual.counts.enabledPrograms,
  sensitiveValuesStored: false,
  externalSubmissionsAttempted: false
}, null, 2));
