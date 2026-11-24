import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { executeFirebasePreviewIdentityPlan } from './lib/firebase-preview-identity-executor.mjs';
import { buildFirebasePreviewIdentityPlan, resolveFirebasePreviewIdentityApprovalIssue } from './lib/firebase-preview-identity-plan-contract.mjs';

const execFileAsync = promisify(execFile);

function readArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const execute = process.argv.includes('--execute');
const root = path.resolve(readArgument('root') ?? process.cwd());
const requestPath = readArgument('request-path');
const confirmation = readArgument('confirmation');
const receiptPath = readArgument('receipt-path');
if (!requestPath || !confirmation) throw new Error('Firebase preview identity executor requires --request-path and --confirmation');
if (execute && !receiptPath) throw new Error('Firebase preview identity execution requires --receipt-path');

const config = JSON.parse(await fs.readFile(path.join(root, 'config', 'firebase-preview-identity-plan.json'), 'utf8'));
const plan = buildFirebasePreviewIdentityPlan(config);
const issue = JSON.parse(await fs.readFile(path.resolve(requestPath), 'utf8'));
const approval = resolveFirebasePreviewIdentityApprovalIssue({ issue, currentPlan: plan });
if (confirmation !== approval.confirmation) throw new Error('Firebase preview identity confirmation does not match the exact approved plan');

let absoluteReceiptPath = null;
let receiptHandle = null;
if (execute) {
  absoluteReceiptPath = path.resolve(receiptPath);
  await fs.mkdir(path.dirname(absoluteReceiptPath), { recursive: true });
  receiptHandle = await fs.open(absoluteReceiptPath, 'wx', 0o600);
}

async function runGcloud(args) {
  try {
    const { stdout = '', stderr = '' } = await execFileAsync('gcloud', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      stdout: String(error.stdout ?? ''),
      stderr: String(error.stderr ?? error.message ?? '')
    };
  }
}

let result;
try {
  result = await executeFirebasePreviewIdentityPlan({ plan, approval, execute, runGcloud });
  if (receiptHandle) {
    await receiptHandle.writeFile(`${JSON.stringify(result, null, 2)}\n`);
    await receiptHandle.sync();
    await receiptHandle.close();
    receiptHandle = null;
  }
} catch (error) {
  if (receiptHandle) {
    const failure = {
      schemaVersion: '1.0.0',
      mode: 'execution_incomplete_reaudit_required',
      recordedAt: new Date().toISOString(),
      configSha256: plan.configSha256,
      executionPlanSha256: plan.executionPlanSha256,
      approvalIssueUrl: approval.issueUrl,
      error: String(error.message ?? 'Firebase preview identity execution failed'),
      productionDeploymentAttempted: false
    };
    await receiptHandle.writeFile(`${JSON.stringify(failure, null, 2)}\n`);
    await receiptHandle.sync();
    await receiptHandle.close();
    receiptHandle = null;
  }
  throw error;
}

if (execute) {
  console.log(JSON.stringify({
    mode: 'executed_and_verified',
    receiptPath: absoluteReceiptPath,
    receiptSha256: result.receiptSha256,
    mutationsApplied: result.mutationsApplied.length,
    exactResourcesVerified: result.assertions.exactResourcesVerified,
    productionDeploymentAttempted: result.assertions.firebaseDeploymentAttempted
  }, null, 2));
} else {
  console.log(JSON.stringify({
    mode: result.mode,
    configSha256: result.configSha256,
    executionPlanSha256: result.executionPlanSha256,
    plannedMutations: result.plannedMutations,
    cloudMutationAttempted: result.cloudMutationAttempted,
    productionDeploymentAuthorized: result.productionDeploymentAuthorized
  }, null, 2));
}
