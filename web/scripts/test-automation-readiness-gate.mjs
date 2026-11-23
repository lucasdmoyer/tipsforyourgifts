import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildAutomationReadiness, parseAutomationReadiness, parseAutomationReadinessEvidence } from './lib/automation-readiness-contract.mjs';

const root = process.cwd();
const evidence = parseAutomationReadinessEvidence(JSON.parse(await fs.readFile(path.join(root, 'config', 'automation-readiness.json'), 'utf8')));
const base = buildAutomationReadiness({
  evidence,
  validatedRuns: 14,
  publicationReadyPosts: 10,
  activeAffiliateOverlays: 1,
  activeSocialChannels: 0,
  socialDrafts: 78,
  activeGrowthConnectors: 0,
  growthSnapshots: 0,
  verifiedFounderReviewedReleases: 0,
  minimumFounderReviewedReleases: 10
});

assert.equal(base.teams.length, 8);
assert.equal(base.counts.ready, 1);
assert.equal(base.counts.limited, 2);
assert.equal(base.counts.blocked, 4);
assert.equal(base.counts.founderActions, 6);
assert.equal(base.teams.find((team) => team.id === 'research-generation').status, 'blocked_external_configuration');
assert.equal(base.teams.find((team) => team.id === 'preview-delivery').status, 'manual_fallback_verified');
assert.equal(base.teams.find((team) => team.id === 'production-release').status, 'founder_approval_required');
assert.equal(base.teams.find((team) => team.id === 'automatic-publication').status, 'blocked_external_configuration');
assert.match(base.teams.find((team) => team.id === 'automatic-publication').evidence, /0 of 10/);
assert.equal(base.releaseCandidate.sha, evidence.releaseCandidate.sha);

const clone = (value) => structuredClone(value);
function expectEvidenceFailure(label, mutate) {
  const candidate = clone(evidence);
  mutate(candidate);
  assert.throws(() => parseAutomationReadinessEvidence(candidate), undefined, label);
}

expectEvidenceFailure('gate IDs cannot duplicate', (candidate) => { candidate.externalGates[1].id = candidate.externalGates[0].id; });
expectEvidenceFailure('evidence links must use HTTPS', (candidate) => { candidate.externalGates[0].evidenceUrl = 'http://example.com'; });
expectEvidenceFailure('preview must name exact SHA prefix', (candidate) => { candidate.releaseCandidate.previewUrl = 'https://tipsforyourgifts--release-wrong.web.app/'; });
expectEvidenceFailure('preview must use the owned Firebase site', (candidate) => { candidate.releaseCandidate.previewUrl = `https://example--${candidate.releaseCandidate.sha.slice(0, 7)}.web.app/`; });
expectEvidenceFailure('unexpected secret values are rejected', (candidate) => { candidate.externalGates[0].secretValue = 'not-allowed'; });
expectEvidenceFailure('release SHA must be exact', (candidate) => { candidate.releaseCandidate.sha = '011b110'; });

const falsifiedCounts = clone(base);
falsifiedCounts.counts.ready += 1;
assert.throws(() => parseAutomationReadiness(falsifiedCounts), undefined, 'derived counts cannot be falsified');

const fullyConfigured = buildAutomationReadiness({
  evidence,
  validatedRuns: 14,
  publicationReadyPosts: 10,
  activeAffiliateOverlays: 2,
  activeSocialChannels: 1,
  socialDrafts: 78,
  activeGrowthConnectors: 1,
  growthSnapshots: 1,
  verifiedFounderReviewedReleases: 3,
  minimumFounderReviewedReleases: 10
});
assert.equal(fullyConfigured.teams.find((team) => team.id === 'social-distribution').status, 'limited_live');
assert.equal(fullyConfigured.teams.find((team) => team.id === 'growth-measurement').status, 'limited_live');
assert.match(fullyConfigured.teams.find((team) => team.id === 'automatic-publication').evidence, /3 of 10/);

assert.throws(() => buildAutomationReadiness({
  evidence,
  validatedRuns: 14,
  publicationReadyPosts: 10,
  activeAffiliateOverlays: 1,
  activeSocialChannels: 0,
  socialDrafts: 78,
  activeGrowthConnectors: 0,
  growthSnapshots: 0,
  verifiedFounderReviewedReleases: -1,
  minimumFounderReviewedReleases: 10
}), /verifiedFounderReviewedReleases/);

console.log(JSON.stringify({
  automationReadinessGateTests: 'passed',
  negativeChecks: 8,
  teams: base.teams.length,
  ready: base.counts.ready,
  limited: base.counts.limited,
  blocked: base.counts.blocked,
  founderActions: base.counts.founderActions,
  sensitiveValuesStored: false
}, null, 2));
