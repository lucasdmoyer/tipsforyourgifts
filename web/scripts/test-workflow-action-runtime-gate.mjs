import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateWorkflowActionRuntimes } from './lib/workflow-action-runtime-contract.mjs';

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tips-workflow-runtime-'));
const cleanDir = path.join(fixtureRoot, 'clean');
const staleDir = path.join(fixtureRoot, 'stale');
const movingTagDir = path.join(fixtureRoot, 'moving-tag');

const cleanWorkflow = [
  'name: fixture',
  'jobs:',
  '  verify:',
  '    steps:',
  '      - uses: actions/setup-node@v7',
  '      - uses: actions/upload-artifact@v7',
  '      - uses: actions/download-artifact@v8',
  ''
].join('\n');

try {
  await Promise.all([cleanDir, staleDir, movingTagDir].map((directory) => fs.mkdir(directory, { recursive: true })));
  await fs.writeFile(path.join(cleanDir, 'fixture.yml'), cleanWorkflow);
  await fs.writeFile(path.join(staleDir, 'fixture.yml'), cleanWorkflow.replace('actions/setup-node@v7', 'actions/setup-node@v4'));
  await fs.writeFile(path.join(movingTagDir, 'fixture.yml'), cleanWorkflow.replace('actions/download-artifact@v8', 'actions/download-artifact@main'));

  const clean = await validateWorkflowActionRuntimes({ workflowsDir: cleanDir });
  assert.equal(clean.actionReferences, 3);
  assert.equal(clean.counts['actions/setup-node'], 1);
  assert.equal(clean.counts['actions/upload-artifact'], 1);
  assert.equal(clean.counts['actions/download-artifact'], 1);

  await assert.rejects(
    validateWorkflowActionRuntimes({ workflowsDir: staleDir }),
    /actions\/setup-node@v4; required actions\/setup-node@v7/u
  );
  await assert.rejects(
    validateWorkflowActionRuntimes({ workflowsDir: movingTagDir }),
    /actions\/download-artifact@main; required actions\/download-artifact@v8/u
  );
  await assert.rejects(
    validateWorkflowActionRuntimes({ workflowsDir: path.join(fixtureRoot, 'missing') }),
    /ENOENT/u
  );

  console.log(JSON.stringify({
    workflowActionRuntimeGateTests: 'passed',
    negativeChecks: 3,
    guardedActions: Object.keys(clean.requiredTags).length,
    actionReferences: clean.actionReferences,
    productionMutationAuthorized: false
  }, null, 2));
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
