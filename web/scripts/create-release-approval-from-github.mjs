import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { z } from 'zod';
import { parseReleaseApproval } from './lib/release-approval-contract.mjs';

const releaseCandidateManifestSchema = z.object({
  schemaVersion: z.enum(['1.2.0', '1.4.0']),
  manifestId: z.string().regex(/^publication-set-[a-f0-9]{16}$/),
  contentSetSha256: z.string().regex(/^[a-f0-9]{64}$/),
  counts: z.object({
    articles: z.number().int().positive(),
    affiliateLinks: z.number().int().nonnegative()
  }).passthrough()
}).passthrough().superRefine((manifest, context) => {
  if (manifest.manifestId !== `publication-set-${manifest.contentSetSha256.slice(0, 16)}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['manifestId'], message: 'manifest ID must bind the content-set SHA-256' });
  }
});

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const requiredPath = (name) => {
  const value = args[name];
  if (!value) throw new Error(`${name} is required`);
  return path.resolve(value);
};
const expectedHeadSha = args['expected-head-sha'] ?? '';
if (!/^[a-f0-9]{40}$/.test(expectedHeadSha)) throw new Error('expected-head-sha must be a full lowercase Git SHA');
const observedAt = args['observed-at'] ?? '';
if (!Number.isFinite(Date.parse(observedAt))) throw new Error('observed-at must be an ISO timestamp');
if (Date.parse(observedAt) > Date.now()) throw new Error('observed-at cannot be in the future');

const pullRequest = JSON.parse(await fs.readFile(requiredPath('pull-request-json'), 'utf8'));
const comment = JSON.parse(await fs.readFile(requiredPath('approval-comment-json'), 'utf8'));
const manifest = releaseCandidateManifestSchema.parse(JSON.parse(await fs.readFile(requiredPath('publication-manifest'), 'utf8')));
const outputPath = requiredPath('output');
const repository = 'lucasdmoyer/tipsforyourgifts';
const prNumber = Number(pullRequest.number);

if (!Number.isInteger(prNumber) || prNumber < 1) throw new Error('pull request number must be positive');
if (args.confirmation !== `RECORD-PR-${prNumber}-${expectedHeadSha}`) throw new Error('confirmation does not bind the exact pull request head');
if (pullRequest.state !== 'open') throw new Error('only an open pull request can receive an active merge approval record');
if (pullRequest.html_url !== `https://github.com/${repository}/pull/${prNumber}`) throw new Error('pull request URL does not bind the repository');
if (pullRequest.head?.sha !== expectedHeadSha) throw new Error('pull request head changed from the expected SHA');
if (pullRequest.head?.repo?.full_name !== repository) throw new Error('release approval recording accepts only same-repository pull requests');
if (pullRequest.base?.ref !== 'master' || !/^[a-f0-9]{40}$/.test(pullRequest.base?.sha ?? '')) throw new Error('release candidate must target an exact master base');
if (comment.user?.login !== 'lucasdmoyer' || comment.author_association !== 'OWNER') throw new Error('approval comment must be authored by the repository owner');
if (comment.created_at !== comment.updated_at) throw new Error('edited approval comments are rejected; issue a new immutable owner comment');
if (comment.html_url !== `${pullRequest.html_url}#issuecomment-${comment.id}`) throw new Error('approval comment URL does not bind the pull request and comment ID');

const body = comment.body ?? '';
const requireBody = (pattern, message) => {
  const match = body.match(pattern);
  if (!match) throw new Error(message);
  return match;
};
requireBody(/^## Founder release approval — exact candidate only$/m, 'approval heading is missing');
const bodyHeadSha = requireBody(/^- PR head: `([a-f0-9]{40})`$/m, 'approval body does not name an exact PR head')[1];
if (bodyHeadSha !== expectedHeadSha) throw new Error('approval body head SHA differs from the expected PR head');
const artifact = requireBody(/^- GitHub artifact: `([0-9]+)` from workflow run `([0-9]+)`$/m, 'approval body lacks an exact GitHub artifact binding');
const artifactSha256 = requireBody(/^- Artifact SHA-256: `([a-f0-9]{64})`$/m, 'approval body lacks an artifact SHA-256')[1];
const previewUrl = requireBody(/^- Firebase preview: (https:\/\/tipsforyourgifts--[a-z0-9-]+\.web\.app\/?)[ \t]*$/m, 'approval body lacks a valid Firebase preview URL')[1];
const smoke = requireBody(/^- hosted smoke: ([0-9]+) routes \/ ([0-9]+) public articles passed$/m, 'approval body lacks hosted smoke counts');
const lighthouseHome = requireBody(/^- Lighthouse [^:\n]+ homepage: (100) Performance \/ (100) Accessibility \/ (100) Best Practices; .*LCP ([0-9.]+)s, .*CLS ([0-9.]+)$/m, 'approval body lacks complete homepage Lighthouse evidence');
const lighthouseStudio = requireBody(/^- Lighthouse [^:\n]+ Studio: (100) \/ (100) \/ (100); .*LCP ([0-9.]+)s, .*CLS ([0-9.]+)$/m, 'approval body lacks complete Studio Lighthouse evidence');
requireBody(/^- Bookshop pilot: .*disclosure before recommendation$/m, 'approval body lacks affiliate-disclosure review evidence');
requireBody(/^- security headers present; preview sends `X-Robots-Tag: noindex`$/m, 'approval body lacks security-header review evidence');
const exactMergeBoundary = `Approved for merge **only while the PR head remains exactly \`${expectedHeadSha}\`**.`;
if (!body.includes(exactMergeBoundary)) throw new Error('approval boundary does not bind exact-head merge only');
requireBody(/This approval does not transfer to a changed head, merge commit, replay, or later artifact\./, 'approval transfer exclusions are missing');
requireBody(/It does not authorize Firebase production deployment, IAM changes, credentials, affiliate expansion, social publishing, email, or spend\./, 'approval authority exclusions are missing');

const record = parseReleaseApproval({
  schemaVersion: '1.0.0',
  approvalId: `release-approval-pr-${prNumber}-${expectedHeadSha.slice(0, 7)}`,
  repository,
  pullRequest: {
    number: prNumber,
    url: pullRequest.html_url,
    headSha: expectedHeadSha,
    baseSha: pullRequest.base.sha
  },
  candidate: {
    publicationManifestId: manifest.manifestId,
    contentSetSha256: manifest.contentSetSha256,
    articles: manifest.counts.articles,
    affiliateLinks: manifest.counts.affiliateLinks
  },
  approval: {
    status: 'approved_for_exact_head_merge_only',
    approvedBy: comment.user.login,
    authorAssociation: comment.author_association,
    approvedAt: new Date(comment.created_at).toISOString(),
    source: {
      kind: 'github_owner_comment',
      url: comment.html_url,
      commentId: String(comment.id),
      bodySha256: createHash('sha256').update(body, 'utf8').digest('hex'),
      observedAt: new Date(observedAt).toISOString()
    }
  },
  previewReview: {
    status: 'exact_preview_verified',
    url: previewUrl,
    artifactId: artifact[1],
    artifactSha256,
    hostedSmoke: { routes: Number(smoke[1]), articles: Number(smoke[2]) },
    lighthouse: {
      homepage: { performance: Number(lighthouseHome[1]), accessibility: Number(lighthouseHome[2]), bestPractices: Number(lighthouseHome[3]) },
      studio: { performance: Number(lighthouseStudio[1]), accessibility: Number(lighthouseStudio[2]), bestPractices: Number(lighthouseStudio[3]) },
      lcpSeconds: Math.max(Number(lighthouseHome[4]), Number(lighthouseStudio[4])),
      cls: Math.max(Number(lighthouseHome[5]), Number(lighthouseStudio[5]))
    },
    affiliateDisclosureVerified: true,
    securityHeadersVerified: true
  },
  authority: {
    allowed: ['merge_exact_pull_request_head'],
    excluded: [
      'changed_head', 'merge_commit', 'replay', 'later_artifact', 'firebase_production_deployment', 'iam_changes',
      'credentials', 'affiliate_expansion', 'social_publishing', 'email', 'spend'
    ]
  },
  nextGate: `Rerun the required preview check and merge only if pull request ${prNumber} remains exactly ${expectedHeadSha}; after merge, require a new exact master-SHA preview, readback, and action-time production approval.`,
  recordedAt: new Date(observedAt).toISOString(),
  status: 'active_exact_head_approval'
});

try { await fs.access(outputPath); throw new Error(`output already exists: ${outputPath}`); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `approval_id=${record.approvalId}\napproval_file=${record.approvalId}.json\n`);
console.log(JSON.stringify({ recorded: true, approvalId: record.approvalId, exactHeadSha: expectedHeadSha, mergeOnly: true, productionAuthorized: false }, null, 2));
