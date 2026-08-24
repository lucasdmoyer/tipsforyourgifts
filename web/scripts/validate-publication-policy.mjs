import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parsePublicationPolicy } from './lib/publication-policy-contract.mjs';

const policy = parsePublicationPolicy(JSON.parse(await fs.readFile(path.join(process.cwd(), 'config', 'publication-policy.json'), 'utf8')));
console.log(JSON.stringify({
  gate: 'passed',
  mode: policy.mode,
  automaticPromotionEnabled: policy.automaticPromotion.enabled,
  successfulReleaseEvidence: policy.automaticPromotion.verifiedSuccessfulReleaseCount,
  minimumSuccessfulReleases: policy.automaticPromotion.minimumSuccessfulFounderReviewedReleases,
  allReleaseGatesRequired: Object.values(policy.requiredGates).every(Boolean)
}, null, 2));
