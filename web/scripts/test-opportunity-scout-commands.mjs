import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { opportunityReportSchema, opportunityScoutMissionSchema } from './lib/opportunity-scout-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptRoot = process.cwd();
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tfyg-opportunity-scout-'));
const scoutId = 'opportunity-scout-12345-1';
try {
  for (const directory of ['src/data', 'config', 'research/opportunity-missions', 'research/opportunities', 'research/opportunity-reviews']) await fs.mkdir(path.join(fixtureRoot, directory), { recursive: true });
  const policy = {
    schemaVersion: '1.0.0', updatedAt: '2026-08-03T10:30:00.000Z', enabled: true, cadence: 'weekly', maxOpenProposals: 2,
    minimumResearchPasses: 3, minimumSources: 10, minimumSourceClasses: 5, minimumPublicSocialOrCommunitySources: 2,
    minimumCandidates: 3, maximumCandidates: 7, minimumSignals: 6, minimumEvidenceConfidence: 70, minimumThoughtfulnessPotential: 80,
    diminishingReturnThreshold: 0.1, requiredConsecutiveLowNoveltyPasses: 2, geography: 'United States', language: 'English',
    socialEvidencePolicy: 'public_only_no_personal_identifiers'
  };
  const existingIdea = { id: 'founder-idea-001', revision: 1, founderDisposition: 'proposed', ideaType: 'editorial', thesisType: 'recipient_friction', title: 'Existing thoughtful gift proposal' };
  const strategy = { schemaVersion: '1.1.0', updatedAt: '2026-08-03T10:00:00.000Z', ideas: [existingIdea] };
  await fs.writeFile(path.join(fixtureRoot, 'config/opportunity-scout-policy.json'), `${JSON.stringify(policy, null, 2)}\n`);
  await fs.writeFile(path.join(fixtureRoot, 'src/data/strategy.json'), `${JSON.stringify(strategy, null, 2)}\n`);

  const startResult = await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/start-opportunity-scout.mjs'), `--base-sha=${'a'.repeat(40)}`, '--workflow-run-id=12345', '--workflow-run-attempt=1', '--actor=github-actions[bot]', '--trigger=scheduled', '--created-at=2026-08-03T10:45:00.000Z'], { cwd: fixtureRoot });
  if (!startResult.stdout.includes('"shouldScout": true')) throw new Error('start command did not open a capacity-available scout mission');
  const missionPath = path.join(fixtureRoot, 'research/opportunity-missions', `${scoutId}.json`);
  const mission = opportunityScoutMissionSchema.parse(JSON.parse(await fs.readFile(missionPath, 'utf8')));
  if (mission.expectedProposalId !== 'founder-idea-002' || mission.authority.mayApproveResearch || mission.authority.mayPublish) throw new Error('mission authority or expected proposal binding is wrong');

  const proposal = { id: 'founder-idea-002', revision: 1, founderDisposition: 'proposed', ideaType: 'editorial', thesisType: 'ritual_pairing', title: 'Make a weather-watching ritual easier to begin' };
  strategy.ideas.push(proposal);
  strategy.updatedAt = '2026-08-03T11:30:00.000Z';
  await fs.writeFile(path.join(fixtureRoot, 'src/data/strategy.json'), `${JSON.stringify(strategy, null, 2)}\n`);
  const classes = ['manufacturer_category', 'merchant_catalog', 'independent_editorial', 'public_social', 'public_community', 'trend_calendar', 'safety_authority', 'search_discovery'];
  const sources = Array.from({ length: 10 }, (_, index) => ({ id: `opp-source-command-${index + 1}`, url: `https://source${index + 1}.example.com/evidence`, publisher: `Publisher ${index + 1}`, title: `Public evidence source number ${index + 1}`, accessedAt: '2026-08-03T11:00:00.000Z', sourceClass: classes[index % classes.length], trustTier: 'B', independenceGroup: `independent-${index + 1}`, publicContent: true, containsPersonalIdentifiers: false }));
  const kinds = ['recipient_language', 'observed_workaround', 'self_purchase_gap', 'pairing_behavior', 'seasonal_timing', 'editorial_gap'];
  const signals = kinds.map((kind, index) => ({ id: `opp-signal-command-${index + 1}`, kind, summary: `Multiple sources reveal a durable ${kind.replaceAll('_', ' ')} pattern in this public audience.`, interpretation: 'This pattern supports a specific gift-decision rule grounded in observed behavior rather than stereotypes.', limitations: 'Public discussion is directional and must be checked against the actual recipient before purchase.', sourceIds: [sources[index].id, sources[index + 1].id] }));
  const candidates = Array.from({ length: 3 }, (_, index) => ({ id: `opp-candidate-command-${index + 1}`, title: `Weather ritual candidate number ${index + 1}`, audience: 'A curious friend who already notices and talks about local weather', observedFriction: 'They repeatedly improvise observations and lose useful context between one weather event and the next.', selfPurchaseGap: 'Small supporting tools feel optional, so the recipient keeps postponing them.', pairingHypothesis: 'A visual reference and a simple observation aid create one low-pressure ritual.', whyNow: 'The idea is evergreen and can be evaluated without relying on a temporary trend.', editorialGap: 'Existing lists emphasize novelty more often than observed fit and rejection conditions.', monetizationPosture: 'broad_catalog_candidate', commissionIndependent: true, sourceIds: [sources[index].id, sources[index + 1].id, sources[index + 2].id], rejectionConditions: ['Reject when the recipient has not demonstrated this specific interest.', 'Reject tools requiring an unwanted account or complex maintenance.'], score: index === 0 ? { evidenceConfidence: 82, thoughtfulnessPotential: 91, differentiation: 84, evergreenValue: 88, productionFeasibility: 85, total: 86 } : { evidenceConfidence: 72, thoughtfulnessPotential: 76, differentiation: 70, evergreenValue: 74, productionFeasibility: 78, total: 74 } }));
  const report = opportunityReportSchema.parse({ schemaVersion: '1.0.0', scoutId, missionId: scoutId, status: 'drafted', createdAt: '2026-08-03T11:30:00.000Z', draftAuthor: 'opportunity-researcher', scope: { geography: 'United States', language: 'English', horizon: 'mixed', sensitiveCategoriesExcluded: true }, researchPasses: [{ pass: 1, objective: 'Map recipient language, recurring friction, and visible workarounds.', queries: ['weather watching gift friction', 'weather hobby public discussion'], newSignals: 5, materialNoveltyRate: 0.7 }, { pass: 2, objective: 'Challenge the initial hypothesis across independent source classes.', queries: ['weather observation routine gift', 'weather journal self purchase gap'], newSignals: 1, materialNoveltyRate: 0.08 }, { pass: 3, objective: 'Search explicitly for contradictions, risks, and editorial gaps.', queries: ['weather gadget clutter risk', 'weather gift compatibility concerns'], newSignals: 0, materialNoveltyRate: 0.04 }], sources, signals, candidates, selectedProposal: { proposalId: proposal.id, candidateId: candidates[0].id, title: proposal.title, rationale: 'The evidence shows a specific observed friction, a credible self-purchase gap, and a coherent ritual with explicit rejection conditions.', sourceIds: [sources[0].id, sources[1].id, sources[2].id] }, conflicts: ['Sources disagree about whether analog or connected observation tools create less friction.'], unknowns: ['Exact products and prices require article-level research.', 'Accessibility and storage needs vary by recipient and require confirmation.'], commercialBoundary: { commissionIndependent: true, revenueClaimsMade: false, affiliateEnrollmentChanged: false }, qa: null });
  await fs.writeFile(path.join(fixtureRoot, 'research/opportunities', `${scoutId}.json`), `${JSON.stringify(report, null, 2)}\n`);

  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/create-opportunity-review-receipt.mjs'), `--scout-id=${scoutId}`, '--reviewer-id=independent-editor', '--verdict=passed', '--workflow-run-id=12345', '--reviewed-at=2026-08-03T12:00:00.000Z'], { cwd: fixtureRoot });
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/promote-opportunity-report.mjs'), scoutId], { cwd: fixtureRoot });
  await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/validate-opportunity-scout.mjs')], { cwd: fixtureRoot });
  const completed = opportunityScoutMissionSchema.parse(JSON.parse(await fs.readFile(missionPath, 'utf8')));
  const validated = opportunityReportSchema.parse(JSON.parse(await fs.readFile(path.join(fixtureRoot, 'research/opportunities', `${scoutId}.json`), 'utf8')));
  if (completed.status !== 'completed' || validated.status !== 'validated' || validated.qa?.reviewerId !== 'independent-editor') throw new Error('review and promotion did not create the expected validated handoff');

  const backlogResult = await execFileAsync(process.execPath, [path.join(scriptRoot, 'scripts/start-opportunity-scout.mjs'), `--base-sha=${'b'.repeat(40)}`, '--workflow-run-id=12346', '--workflow-run-attempt=1', '--actor=github-actions[bot]', '--trigger=scheduled'], { cwd: fixtureRoot });
  if (!backlogResult.stdout.includes('"shouldScout": false') || !backlogResult.stdout.includes('founder_backlog_full')) throw new Error('full founder backlog did not stop the scout before model work');
  const missionNames = (await fs.readdir(path.join(fixtureRoot, 'research/opportunity-missions'))).filter((name) => name.endsWith('.json'));
  if (missionNames.length !== 1) throw new Error('backlog-full start created an unauthorized mission file');
  console.log(JSON.stringify({ opportunityScoutCommandIntegration: 'passed', commands: 5, scoutId, completionStatus: completed.status, nextGate: 'founder_review', backlogGate: 'founder_backlog_full' }, null, 2));
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
