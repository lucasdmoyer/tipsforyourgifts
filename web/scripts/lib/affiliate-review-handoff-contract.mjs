const candidatePathPattern = /^affiliate\/candidates\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/;

export function resolveAffiliateReviewHandoffs({ changes, candidates, reviews }) {
  if (!Array.isArray(changes) || !Array.isArray(candidates) || !Array.isArray(reviews)) {
    throw new Error('affiliate review handoff inputs must be arrays');
  }

  const candidatesByPath = new Map(candidates.map((record) => [record.path, record]));
  const reviewedCandidateIds = new Set(reviews.map((record) => record.data.candidateId));
  const seenPaths = new Set();
  const handoffs = [];

  for (const change of changes) {
    const match = candidatePathPattern.exec(change.path ?? '');
    if (!match) continue;
    if (seenPaths.has(change.path)) throw new Error(`${change.path}: candidate path changed more than once`);
    seenPaths.add(change.path);
    if (change.status !== 'A') {
      throw new Error(`${change.path}: affiliate candidates are immutable; only a newly added exact candidate may launch review`);
    }
    const record = candidatesByPath.get(change.path);
    if (!record) throw new Error(`${change.path}: added candidate is missing from the validated affiliate state`);
    if (record.data.candidateId !== match[1]) throw new Error(`${change.path}: candidate ID does not match its filename`);
    if (reviewedCandidateIds.has(record.data.candidateId)) continue;
    handoffs.push({ candidateId: record.data.candidateId, candidateSha256: record.sha256 });
  }

  return handoffs.sort((left, right) => left.candidateId.localeCompare(right.candidateId));
}
