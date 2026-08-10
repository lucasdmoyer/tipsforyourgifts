import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parsePublicationPolicy } from './lib/publication-policy-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const successfulReleaseCount = Number(args['successful-release-count']);
const approvedBy = args['approved-by'];
if (!Number.isInteger(successfulReleaseCount) || successfulReleaseCount < 0 || !approvedBy) {
  throw new Error('Usage: node enable-publication-policy.mjs --successful-release-count=10 --approved-by=lucasdmoyer');
}

const policyPath = path.join(process.cwd(), 'config', 'publication-policy.json');
const policy = parsePublicationPolicy(JSON.parse(await fs.readFile(policyPath, 'utf8')));
if (policy.automaticPromotion.enabled) throw new Error('Automatic promotion is already enabled');
if (approvedBy !== policy.requiredApproverLogin) throw new Error(`Only ${policy.requiredApproverLogin} may approve automatic promotion`);
if (successfulReleaseCount < policy.automaticPromotion.minimumSuccessfulFounderReviewedReleases) {
  throw new Error(`Only ${successfulReleaseCount} successful production releases were verified; ${policy.automaticPromotion.minimumSuccessfulFounderReviewedReleases} are required`);
}

const now = new Date().toISOString();
policy.updatedAt = now;
policy.mode = 'automatic_after_proven';
policy.automaticPromotion.enabled = true;
policy.automaticPromotion.verifiedSuccessfulReleaseCount = successfulReleaseCount;
policy.automaticPromotion.founderApproved = true;
policy.automaticPromotion.approvedBy = approvedBy;
policy.automaticPromotion.approvedAt = now;
parsePublicationPolicy(policy);
await fs.writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
console.log(JSON.stringify({ enabled: true, mode: policy.mode, successfulReleaseCount, approvedBy }, null, 2));
