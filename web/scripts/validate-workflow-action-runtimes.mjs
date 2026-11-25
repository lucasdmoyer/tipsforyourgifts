import path from 'node:path';
import process from 'node:process';
import { validateWorkflowActionRuntimes } from './lib/workflow-action-runtime-contract.mjs';

const repoRoot = path.resolve(process.cwd(), '..');
const result = await validateWorkflowActionRuntimes({
  workflowsDir: path.join(repoRoot, '.github', 'workflows')
});

console.log(JSON.stringify({
  gate: 'passed',
  ...result,
  productionMutationAuthorized: false
}, null, 2));
