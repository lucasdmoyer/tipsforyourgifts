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
  durableFounderReviewedReleases: 2,
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
assert.match(base.teams.find((team) => team.id === 'automatic-publication').evidence, /2 of 10/);
assert.match(base.teams.find((team) => team.id === 'automatic-publication').evidence, /live GitHub deployment recount/);
assert.equal(base.latestVerifiedPreview.sha, evidence.latestVerifiedPreview.sha);

const clone = (value) => structuredClone(value);
function expectEvidenceFailure(label, mutate) {
  const candidate = clone(evidence);
  mutate(candidate);
  assert.throws(() => parseAutomationReadinessEvidence(candidate), undefined, label);
}

expectEvidenceFailure('gate IDs cannot duplicate', (candidate) => { candidate.externalGates[1].id = candidate.externalGates[0].id; });
expectEvidenceFailure('evidence links must use HTTPS', (candidate) => { candidate.externalGates[0].evidenceUrl = 'http://example.com'; });
expectEvidenceFailure('preview must name exact SHA prefix', (candidate) => { candidate.latestVerifiedPreview.previewUrl = 'https://tipsforyourgifts--release-wrong.web.app/'; });
expectEvidenceFailure('preview must use the owned Firebase site', (candidate) => { candidate.latestVerifiedPreview.previewUrl = `https://example--${candidate.latestVerifiedPreview.sha.slice(0, 7)}.web.app/`; });
expectEvidenceFailure('verified preview must name an owned pull request', (candidate) => { candidate.latestVerifiedPreview.pullRequestUrl = 'https://example.com/lucasdmoyer/tipsforyourgifts/pull/999'; });
expectEvidenceFailure('review receipt must belong to the exact preview PR', (candidate) => { candidate.latestVerifiedPreview.reviewUrl = 'https://github.com/lucasdmoyer/tipsforyourgifts/pull/83#issuecomment-1'; });
expectEvidenceFailure('preview identity evidence cannot point at a stale PR', (candidate) => { candidate.externalGates.find((gate) => gate.id === 'firebase-preview-identity').evidenceUrl = 'https://github.com/lucasdmoyer/tipsforyourgifts/pull/90#issuecomment-1'; });
expectEvidenceFailure('preview identity summary must name the current SHA', (candidate) => { candidate.externalGates.find((gate) => gate.id === 'firebase-preview-identity').summary = 'A different exact preview passed every protected check, but the current Workload Identity Federation provider remains absent and automated Firebase delivery is blocked before authentication.'; });
expectEvidenceFailure('preview identity action cannot target a stale SHA', (candidate) => { candidate.externalGates.find((gate) => gate.id === 'firebase-preview-identity').nextAction = 'After fresh action-time founder approval, create the pull-request-only keyless preview provider for a stale release candidate and rerun its required preview check.'; });
expectEvidenceFailure('unexpected secret values are rejected', (candidate) => { candidate.externalGates[0].secretValue = 'not-allowed'; });
expectEvidenceFailure('verified preview SHA must be exact', (candidate) => { candidate.latestVerifiedPreview.sha = '011b110'; });

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
  durableFounderReviewedReleases: 3,
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
  durableFounderReviewedReleases: -1,
  minimumFounderReviewedReleases: 10
}), /durableFounderReviewedReleases/);

console.log(JSON.stringify({
  automationReadinessGateTests: 'passed',
  negativeChecks: 13,
  teams: base.teams.length,
  ready: base.counts.ready,
  limited: base.counts.limited,
  blocked: base.counts.blocked,
  founderActions: base.counts.founderActions,
  sensitiveValuesStored: false
}, null, 2));
