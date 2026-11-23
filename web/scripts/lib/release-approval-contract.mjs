import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const gitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime();
const repository = 'lucasdmoyer/tipsforyourgifts';
const requiredExclusions = [
  'changed_head',
  'merge_commit',
  'replay',
  'later_artifact',
  'firebase_production_deployment',
  'iam_changes',
  'credentials',
  'affiliate_expansion',
  'social_publishing',
  'email',
  'spend'
];

const httpsUrl = z.string().url().refine((value) => value.startsWith('https://'), 'must use HTTPS');

const firebasePreviewUrl = httpsUrl.superRefine((value, context) => {
  const url = new URL(value);
  if (!/^tipsforyourgifts--[a-z0-9-]+\.web\.app$/.test(url.hostname) || url.username || url.password || url.hash) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a tipsforyourgifts Firebase Hosting preview URL' });
  }
});

export const releaseApprovalSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  approvalId: z.string().regex(/^release-approval-pr-[0-9]+-[a-f0-9]{7}$/),
  repository: z.literal(repository),
  pullRequest: z.object({
    number: z.number().int().positive(),
    url: httpsUrl,
    headSha: gitShaSchema,
    baseSha: gitShaSchema
  }).strict(),
  candidate: z.object({
    publicationManifestId: z.string().regex(/^publication-set-[a-f0-9]{16}$/),
    contentSetSha256: sha256Schema,
    articles: z.number().int().positive(),
    affiliateLinks: z.number().int().nonnegative()
  }).strict(),
  approval: z.object({
    status: z.literal('approved_for_exact_head_merge_only'),
    approvedBy: z.literal('lucasdmoyer'),
    authorAssociation: z.literal('OWNER'),
    approvedAt: timestampSchema,
    source: z.object({
      kind: z.literal('github_owner_comment'),
      url: httpsUrl,
      commentId: z.string().regex(/^[0-9]+$/),
      bodySha256: sha256Schema,
      observedAt: timestampSchema
    }).strict()
  }).strict(),
  previewReview: z.object({
    status: z.literal('exact_preview_verified'),
    url: firebasePreviewUrl,
    artifactId: z.string().regex(/^[0-9]+$/),
    artifactSha256: sha256Schema,
    hostedSmoke: z.object({
      routes: z.number().int().positive(),
      articles: z.number().int().positive()
    }).strict(),
    lighthouse: z.object({
      homepage: z.object({ performance: z.literal(100), accessibility: z.literal(100), bestPractices: z.literal(100) }).strict(),
      studio: z.object({ performance: z.literal(100), accessibility: z.literal(100), bestPractices: z.literal(100) }).strict(),
      lcpSeconds: z.number().nonnegative(),
      cls: z.number().nonnegative()
    }).strict(),
    affiliateDisclosureVerified: z.literal(true),
    securityHeadersVerified: z.literal(true)
  }).strict(),
  authority: z.object({
    allowed: z.tuple([z.literal('merge_exact_pull_request_head')]),
    excluded: z.array(z.enum(requiredExclusions)).length(requiredExclusions.length)
  }).strict(),
  nextGate: z.string().min(80),
  recordedAt: timestampSchema,
  status: z.literal('active_exact_head_approval')
}).strict().superRefine((record, context) => {
  const expectedApprovalId = `release-approval-pr-${record.pullRequest.number}-${record.pullRequest.headSha.slice(0, 7)}`;
  if (record.approvalId !== expectedApprovalId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['approvalId'], message: 'approval ID must bind the pull request and exact head SHA' });
  }
  const expectedPrUrl = `https://github.com/${repository}/pull/${record.pullRequest.number}`;
  if (record.pullRequest.url !== expectedPrUrl) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['pullRequest', 'url'], message: 'pull request URL must bind the repository and pull request number' });
  }
  const expectedCommentUrl = `${expectedPrUrl}#issuecomment-${record.approval.source.commentId}`;
  if (record.approval.source.url !== expectedCommentUrl) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['approval', 'source', 'url'], message: 'approval source URL must bind the pull request and comment ID' });
  }
  if (record.candidate.publicationManifestId !== `publication-set-${record.candidate.contentSetSha256.slice(0, 16)}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['candidate', 'publicationManifestId'], message: 'manifest ID must bind the content-set SHA-256' });
  }
  if (record.previewReview.hostedSmoke.articles !== record.candidate.articles) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['previewReview', 'hostedSmoke', 'articles'], message: 'hosted smoke must cover every approved article' });
  }
  if (new Set(record.authority.excluded).size !== requiredExclusions.length || requiredExclusions.some((item) => !record.authority.excluded.includes(item))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['authority', 'excluded'], message: 'approval exclusions must preserve the complete authority boundary' });
  }
  if (record.recordedAt < record.approval.approvedAt || record.approval.source.observedAt < record.approval.approvedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['recordedAt'], message: 'approval cannot be recorded or observed before it was issued' });
  }
});

export function parseReleaseApproval(value) {
  return releaseApprovalSchema.parse(value);
}

export async function loadReleaseApprovals(root) {
  const directory = path.join(root, 'releases', 'approvals');
  const names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(names.map(async (name) => {
    const raw = await fs.readFile(path.join(directory, name));
    return {
      path: `releases/approvals/${name}`,
      sha256: createHash('sha256').update(raw).digest('hex'),
      data: parseReleaseApproval(JSON.parse(raw.toString('utf8')))
    };
  }));
}

export function summarizeReleaseApprovals(records, publicationManifest) {
  const parsed = records.map((record) => ({ ...record, data: parseReleaseApproval(record.data) }));
  const active = parsed.filter((record) => record.data.status === 'active_exact_head_approval');
  const matching = active
    .filter((record) => record.data.candidate.contentSetSha256 === publicationManifest.contentSetSha256)
    .sort((left, right) => right.data.approval.approvedAt.localeCompare(left.data.approval.approvedAt));
  const latest = matching[0] ?? null;
  return {
    total: parsed.length,
    active: active.length,
    currentContentSetApprovedRelease: latest ? {
      approvalId: latest.data.approvalId,
      approvalRecordPath: latest.path,
      approvalRecordSha256: latest.sha256,
      pullRequestNumber: latest.data.pullRequest.number,
      pullRequestUrl: latest.data.pullRequest.url,
      headSha: latest.data.pullRequest.headSha,
      manifestId: latest.data.candidate.publicationManifestId,
      contentSetSha256: latest.data.candidate.contentSetSha256,
      approvedBy: latest.data.approval.approvedBy,
      approvedAt: latest.data.approval.approvedAt,
      evidenceUrl: latest.data.approval.source.url,
      previewUrl: latest.data.previewReview.url,
      scope: latest.data.approval.status,
      nextGate: latest.data.nextGate
    } : null
  };
}
