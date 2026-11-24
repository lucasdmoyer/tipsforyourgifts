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

const result = validateAffiliateReportingRequests({ document, affiliate, expansionDocument, linkState });
console.log(`Validated ${result.summaries.length} affiliate reporting request(s): aggregate-only, no customer data, no activation.`);
