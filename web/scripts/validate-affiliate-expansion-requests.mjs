import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { validateAffiliateExpansionRequests } from './lib/affiliate-expansion-request-contract.mjs';

const root = process.cwd();
const document = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-expansion-requests.json'), 'utf8'));
const affiliate = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const validated = await validateAffiliateExpansionRequests({ root, document, affiliate });
console.log(JSON.stringify({
  affiliateExpansionRequests: 'valid',
  requests: validated.summaries.length,
  requestedProducts: validated.summaries.reduce((sum, item) => sum + item.requestedProducts, 0),
  catalogProductsVerified: validated.summaries.reduce((sum, item) => sum + item.catalogProductsVerified, 0),
  paidUrlsCollected: 0,
  activationScopeChanged: false,
  productionDeploymentAuthorized: false
}, null, 2));
