import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildFirebasePreviewIdentityPlan } from './lib/firebase-preview-identity-plan-contract.mjs';

const root = process.cwd();
const configPath = path.join(root, 'config', 'firebase-preview-identity-plan.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const plan = buildFirebasePreviewIdentityPlan(config);
const readiness = JSON.parse(await fs.readFile(path.join(root, 'config', 'automation-readiness.json'), 'utf8'));
const previewGate = readiness.externalGates?.find((gate) => gate.id === 'firebase-preview-identity');
if (!previewGate?.nextAction?.includes(plan.configSha256)) {
  throw new Error('Automation readiness must bind the exact Firebase preview identity plan SHA-256');
}

console.log(JSON.stringify(process.argv.includes('--summary') ? {
  firebasePreviewIdentityPlan: 'valid',
  mode: plan.mode,
  configSha256: plan.configSha256,
  approvedHeadSha: plan.approvedHeadSha,
  pullRequestNumber: plan.pullRequestNumber,
  auditCommands: plan.auditCommands.length,
  boundedMutationCommands: plan.mutationCommands.length,
  cloudMutationAttempted: false,
  productionDeploymentAuthorized: false
} : plan, null, 2));
