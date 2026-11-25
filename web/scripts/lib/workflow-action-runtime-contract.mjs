import fs from 'node:fs/promises';
import path from 'node:path';

const requiredTags = new Map([
  ['actions/setup-node', 'v7'],
  ['actions/upload-artifact', 'v7'],
  ['actions/download-artifact', 'v8']
]);

const actionPattern = /^\s*(?:-\s*)?uses:\s*(actions\/(?:setup-node|upload-artifact|download-artifact))@([^\s#]+)/gm;

export async function validateWorkflowActionRuntimes({ workflowsDir }) {
  const entries = (await fs.readdir(workflowsDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.ya?ml$/u.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (entries.length === 0) throw new Error('No GitHub workflow files were found');

  const counts = Object.fromEntries([...requiredTags.keys()].map((action) => [action, 0]));
  const violations = [];
  let actionReferences = 0;

  for (const entry of entries) {
    const source = await fs.readFile(path.join(workflowsDir, entry.name), 'utf8');
    for (const match of source.matchAll(actionPattern)) {
      const [, action, actualTag] = match;
      const requiredTag = requiredTags.get(action);
      const line = source.slice(0, match.index).split('\n').length;
      actionReferences += 1;
      counts[action] += 1;
      if (actualTag !== requiredTag) {
        violations.push(entry.name + ':' + line + ' uses ' + action + '@' + actualTag + '; required ' + action + '@' + requiredTag);
      }
    }
  }

  if (actionReferences === 0) throw new Error('No guarded GitHub action references were found');
  if (violations.length > 0) {
    throw new Error('Deprecated or unapproved GitHub action runtimes:\n' + violations.join('\n'));
  }

  return {
    workflows: entries.length,
    actionReferences,
    requiredTags: Object.fromEntries(requiredTags),
    counts
  };
}
