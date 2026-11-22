import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  approvalFilename,
  claimBindingsForRun,
  editorialSafetyApprovalSchema,
  reviewedContentDigests
} from './lib/editorial-safety-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const required = ['run-id', 'decision', 'approver-login', 'workflow-run-id', 'workflow-run-attempt', 'actor'];
for (const key of required) if (!args[key]) throw new Error(`Missing --${key}=...`);
if (!['approved', 'rejected'].includes(args.decision)) throw new Error('Decision must be approved or rejected');
if (args['approver-login'] !== 'lucasdmoyer' || args.actor !== 'lucasdmoyer') throw new Error('Only lucasdmoyer may record founder safety review');
if (!/^[1-9]\d*$/.test(args['workflow-run-id'])) throw new Error('Workflow run ID must be a positive integer');
const workflowRunAttempt = Number(args['workflow-run-attempt']);
if (!Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) throw new Error('Workflow run attempt must be a positive integer');

const root = process.cwd();
const runPath = path.join(root, 'research', 'runs', `${args['run-id']}.json`);
const runRaw = await fs.readFile(runPath);
const run = JSON.parse(runRaw.toString('utf8'));
if (!['drafted', 'qa_failed'].includes(run.status)) throw new Error('Founder safety review applies only to drafted or qa_failed bundles');
const highRiskClaims = claimBindingsForRun(run);
if (highRiskClaims.length === 0) throw new Error('This bundle has no explicitly classified high-risk claim to review');

const articlePath = path.join(root, 'src', 'data', 'blog', `${run.article.slug}.md`);
const articleRaw = await fs.readFile(articlePath);
const socialPath = path.join(root, 'social', 'drafts', `${run.article.slug}-launch.json`);
let socialRaw = null;
try { socialRaw = await fs.readFile(socialPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const approvalDirectory = path.join(root, 'research', 'safety-approvals');
let existingNames = [];
try { existingNames = await fs.readdir(approvalDirectory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const prefix = `${run.runId}.founder-safety.v`;
const revisions = existingNames
  .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
  .map((name) => Number(name.slice(prefix.length, -'.json'.length)))
  .filter(Number.isInteger);
const approvalRevision = revisions.length === 0 ? 1 : Math.max(...revisions) + 1;
const approval = editorialSafetyApprovalSchema.parse({
  schemaVersion: '1.0.0',
  approvalId: `${run.runId}-founder-safety-v${approvalRevision}`,
  approvalRevision,
  runId: run.runId,
  articleSlug: run.article.slug,
  reviewedAt: args['reviewed-at'] ?? new Date().toISOString(),
  approverLogin: args['approver-login'],
  workflow: {
    name: 'editorial-safety-approval.yml',
    runId: args['workflow-run-id'],
    runAttempt: workflowRunAttempt,
    actor: args.actor
  },
  decision: args.decision,
  reviewedContentSha256: reviewedContentDigests({ run, articleRaw, socialRaw }),
  highRiskClaims,
  acknowledgements: {
    exactReaderLanguageReviewed: true,
    notFirstHandProductTesting: true,
    independentQaStillRequired: true,
    publicationNotAuthorized: true
  }
});

await fs.mkdir(approvalDirectory, { recursive: true });
const outputPath = path.join(approvalDirectory, approvalFilename(approval));
await fs.writeFile(outputPath, `${JSON.stringify(approval, null, 2)}\n`, { flag: 'wx' });
if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(process.env.GITHUB_OUTPUT, `approval_id=${approval.approvalId}\napproval_path=${path.relative(root, outputPath)}\napproval_revision=${approval.approvalRevision}\n`);
}
console.log(JSON.stringify({
  approvalId: approval.approvalId,
  approvalRevision: approval.approvalRevision,
  decision: approval.decision,
  outputPath: path.relative(root, outputPath),
  highRiskClaims: approval.highRiskClaims.length,
  publicationAuthorized: false,
  externalWritesAttempted: false
}, null, 2));
