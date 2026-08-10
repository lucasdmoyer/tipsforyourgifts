import process from 'node:process';
import { loadAffiliateLinkState } from './lib/affiliate-link-contract.mjs';

try {
  const state = await loadAffiliateLinkState(process.cwd());
  console.log(JSON.stringify({
    gate: 'passed',
    ...state.counts,
    editorialArtifactsChangedByOverlay: false,
    productionDeploymentAuthorized: false
  }, null, 2));
} catch (error) {
  console.error(`Affiliate link gate failed: ${error.message}`);
  process.exitCode = 1;
}
