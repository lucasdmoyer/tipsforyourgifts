import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import process from 'node:process';
import { affiliateExpansionRequestSchema } from './lib/affiliate-expansion-request-contract.mjs';
import { loadAffiliateLinkState } from './lib/affiliate-link-contract.mjs';
import { validateAffiliateReportingRequests } from './lib/affiliate-reporting-request-contract.mjs';

const root = process.cwd();
const [affiliate, expansionDocument, document, linkState] = await Promise.all([
  fs.readFile('config/affiliate-programs.json', 'utf8').then(JSON.parse),
  fs.readFile('config/affiliate-expansion-requests.json', 'utf8').then(JSON.parse).then((value) => affiliateExpansionRequestSchema.parse(value)),
  fs.readFile('config/affiliate-reporting-requests.json', 'utf8').then(JSON.parse),
  loadAffiliateLinkState(root)
]);

const clone = (value) => structuredClone(value);
const validate = (candidate, affiliateCandidate = affiliate, expansionCandidate = expansionDocument) => validateAffiliateReportingRequests({
  document: candidate,
  affiliate: affiliateCandidate,
  expansionDocument: expansionCandidate,
  linkState
});

assert.equal(validate(document).summaries.length, 1);

for (const field of ['includeCustomerData', 'exportCustomerList', 'storeRawReportRows', 'storeOrderIdentifiers', 'storeEmailAddresses']) {
  const candidate = clone(document);
  candidate.requests[0].privacy[field] = true;
  assert.throws(() => validate(candidate));
}

{
  const candidate = clone(document);
  candidate.requests[0].reporting.allowedMetrics[1] = 'customerEmail';
  assert.throws(() => validate(candidate));
}
{
  const candidate = clone(document);
  candidate.requests[0].officialSources.dashboardGuideUrl += '?affiliate=129750';
  assert.throws(() => validate(candidate));
}
{
  const affiliateCandidate = clone(affiliate);
  affiliateCandidate.programs.find((program) => program.id === 'bookshop-org-us-media').revision = 6;
  assert.throws(() => validate(document, affiliateCandidate));
}
{
  const affiliateCandidate = clone(affiliate);
  affiliateCandidate.programs.find((program) => program.id === 'bookshop-org-us-media').account.reportingExportApproved = true;
  assert.throws(() => validate(document, affiliateCandidate));
}
{
  const affiliateCandidate = clone(affiliate);
  affiliateCandidate.programs.find((program) => program.id === 'bookshop-org-us-media').account.weeklyReportsEnabled = false;
  assert.throws(() => validate(document, affiliateCandidate));
}
{
  const expansionCandidate = clone(expansionDocument);
  expansionCandidate.requests[0].proposedProgramRevision = 7;
  assert.throws(() => validate(document, affiliate, expansionCandidate));
}
{
  const candidate = clone(document);
  candidate.requests[0].assertions.productionDeploymentAuthorized = true;
  assert.throws(() => validate(candidate));
}
{
  const candidate = clone(document);
  candidate.requests[0].liveScope.candidateIds.push(candidate.requests[0].liveScope.candidateIds[0]);
  assert.throws(() => validate(candidate));
}
{
  const candidate = clone(document);
  candidate.requests.push(clone(candidate.requests[0]));
  assert.throws(() => validate(candidate));
}

console.log('Affiliate reporting request gate passed 14 aggregate/privacy/revision checks.');
