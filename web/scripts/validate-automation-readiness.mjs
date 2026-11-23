import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseAutomationReadinessEvidence } from './lib/automation-readiness-contract.mjs';

const root = process.cwd();
const evidence = parseAutomationReadinessEvidence(JSON.parse(await fs.readFile(path.join(root, 'config', 'automation-readiness.json'), 'utf8')));

console.log(JSON.stringify({
  gate: 'passed',
  sourceMode: evidence.sourceMode,
  observedAt: evidence.observedAt,
  externalGates: evidence.externalGates.map(({ id, status }) => ({ id, status })),
  latestVerifiedPreview: { status: evidence.latestVerifiedPreview.status, sha: evidence.latestVerifiedPreview.sha },
  sensitiveValuesStored: false,
  externalStateChanged: false
}, null, 2));
