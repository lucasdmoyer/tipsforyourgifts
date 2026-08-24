import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { canonicalIdeaSha256, researchMissionSchema, sha256 } from './lib/research-mission-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const required = ['idea-id', 'base-sha', 'workflow-run-id', 'workflow-run-attempt', 'actor'];
for (const key of required) if (!args[key]) throw new Error(`Missing --${key}=...`);

const root = process.cwd();
const strategy = JSON.parse(await fs.readFile(path.join(root, 'src/data/strategy.json'), 'utf8'));
const publicationPolicy = JSON.parse(await fs.readFile(path.join(root, 'config/publication-policy.json'), 'utf8'));
const idea = strategy.ideas.find((entry) => entry.id === args['idea-id']);
if (!idea) throw new Error(`Unknown strategy idea: ${args['idea-id']}`);
if (idea.founderDisposition !== 'approved_for_research') throw new Error(`${idea.id} is not founder-approved for research`);
const ideaSha256 = canonicalIdeaSha256(idea);
if (args['expected-idea-revision'] && Number(args['expected-idea-revision']) !== idea.revision) throw new Error('Resolved idea revision changed before mission start');
if (args['expected-idea-sha256'] && args['expected-idea-sha256'] !== ideaSha256) throw new Error('Resolved idea digest changed before mission start');
if (!/^[a-f0-9]{40}$/.test(args['base-sha'])) throw new Error('Base SHA must be an exact 40-character Git commit SHA');
if (!/^[1-9]\d*$/.test(args['workflow-run-id'])) throw new Error('Workflow run ID must be a positive integer');
const workflowRunAttempt = Number(args['workflow-run-attempt']);
if (!Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) throw new Error('Workflow run attempt must be a positive integer');
if (!/^[A-Za-z0-9-]+(?:\[bot\])?$/.test(args.actor)) throw new Error('Actor must be a GitHub login or bot actor');

const missionId = `research-mission-${args['workflow-run-id']}-${workflowRunAttempt}`;
const createdAt = args['created-at'] ?? new Date().toISOString();
const mission = researchMissionSchema.parse({
  schemaVersion: '1.0.0',
  missionId,
  status: 'started',
  createdAt,
  completedAt: null,
  trigger: {
    type: 'approved_strategy_dispatch', workflow: 'research-agent.yml', workflowRunId: args['workflow-run-id'],
    workflowRunAttempt, actor: args.actor, baseSha: args['base-sha']
  },
  idea: { id: idea.id, revision: idea.revision, sha256: ideaSha256, title: idea.title, thesisType: idea.thesisType },
  teamStages: [
    { id: 'research', role: 'research-editorial-team', authority: 'draft_only', status: 'in_progress' },
    { id: 'quality_review', role: 'independent-evidence-editor', authority: 'review_receipt_only', status: 'queued' },
    { id: 'release_preparation', role: 'release-operator', authority: 'preview_and_pr_only', status: 'queued' },
    { id: 'growth_follow_up', role: 'growth-analyst', authority: 'aggregate_measurement_only', status: 'queued' }
  ],
  deliverables: { researchRuns: 1, articles: 1, socialLaunchPacks: 1, independentReviewReceipts: 1 },
  qualityGates: {
    minimumResearchPasses: 3, minimumSourceClasses: 5, minimumFinalists: 5, minimumEditorialScore: 75,
    minimumEvidenceConfidence: 70, minimumThoughtfulnessScore: 15,
    minimumPairCoherenceScore: strategy.thoughtfulnessFramework.minimumPairCoherenceScore,
    independentReviewerRequired: true, affiliatePosture: 'enabled_registry_only'
  },
  publicationPolicySnapshot: {
    mode: publicationPolicy.mode,
    automaticPromotionEnabled: publicationPolicy.automaticPromotion.enabled,
    verifiedSuccessfulReleaseCount: publicationPolicy.automaticPromotion.verifiedSuccessfulReleaseCount,
    minimumSuccessfulFounderReviewedReleases: publicationPolicy.automaticPromotion.minimumSuccessfulFounderReviewedReleases
  },
  completion: null
});

const missionDir = path.join(root, 'research/missions');
const outputPath = path.join(missionDir, `${missionId}.json`);
await fs.mkdir(missionDir, { recursive: true });
try { await fs.access(outputPath); throw new Error(`Mission already exists: ${missionId}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const raw = `${JSON.stringify(mission, null, 2)}\n`;
await fs.writeFile(outputPath, raw, { flag: 'wx' });
const missionSha256 = sha256(raw);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `mission_id=${missionId}\nmission_path=web/research/missions/${missionId}.json\nmission_sha256=${missionSha256}\n`);
console.log(JSON.stringify({ missionId, missionPath: `research/missions/${missionId}.json`, missionSha256, status: mission.status }, null, 2));
