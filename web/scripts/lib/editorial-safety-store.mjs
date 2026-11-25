import fs from 'node:fs/promises';
import path from 'node:path';
import { editorialSafetyApprovalSchema, sha256 } from './editorial-safety-contract.mjs';

export async function loadEditorialSafetyApprovalRecords(root) {
  const directory = path.join(root, 'research', 'safety-approvals');
  let names = [];
  try { names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return Promise.all(names.map(async (name) => {
    const raw = await fs.readFile(path.join(directory, name));
    return {
      name,
      path: `research/safety-approvals/${name}`,
      raw,
      sha256: sha256(raw),
      data: editorialSafetyApprovalSchema.parse(JSON.parse(raw.toString('utf8')))
    };
  }));
}

export function latestEditorialSafetyApproval(records, runId) {
  return records
    .filter((record) => record.data.runId === runId)
    .sort((left, right) => right.data.approvalRevision - left.data.approvalRevision)[0] ?? null;
}
