import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from './lib/front-matter.mjs';
import { validateAffiliateModel } from './lib/affiliate-contract.mjs';
import { affiliateActivationProposalSchema, validateAffiliateActivationProposals } from './lib/affiliate-activation-proposal-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...parts] = argument.replace(/^--/, '').split('=');
  return [key, parts.join('=')];
}));
const programId = args['program-id'] ?? '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(programId)) throw new Error('program-id must be a lowercase slug');
if (args.confirmation !== `ACTIVATE-${programId}`) throw new Error('Action-time confirmation does not match the exact affiliate program');
const proposalId = args['proposal-id'] ?? '';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(proposalId)) throw new Error('proposal-id must be a lowercase slug');
const expectedProposalSha256 = args['expected-proposal-sha256'] ?? '';
if (!/^[a-f0-9]{64}$/.test(expectedProposalSha256)) throw new Error('expected-proposal-sha256 must be a lowercase SHA-256');
const termsAcceptedAt = args['terms-accepted-at'];
const termsAcceptedAtMs = Date.parse(termsAcceptedAt ?? '');
if (!termsAcceptedAt || !Number.isFinite(termsAcceptedAtMs) || new Date(termsAcceptedAtMs).toISOString() !== termsAcceptedAt) {
  throw new Error('terms-accepted-at must be a canonical ISO timestamp');
}
const evidenceUrl = new URL(args['acceptance-evidence-url'] ?? '');
if (evidenceUrl.protocol !== 'https:' || evidenceUrl.username || evidenceUrl.password || evidenceUrl.search || evidenceUrl.hash ||
  evidenceUrl.origin !== 'https://github.com' || !/^\/lucasdmoyer\/tipsforyourgifts\/(?:issues|pull)\/[1-9]\d*$/.test(evidenceUrl.pathname)) {
  throw new Error('acceptance-evidence-url must be a numbered issue or pull request in github.com/lucasdmoyer/tipsforyourgifts');
}

const root = process.cwd();
const configPath = path.join(root, 'config', 'affiliate-programs.json');
const model = JSON.parse(await fs.readFile(configPath, 'utf8'));
const proposalPath = path.join(root, 'config', 'affiliate-activation-proposals.json');
const proposalDocument = affiliateActivationProposalSchema.parse(JSON.parse(await fs.readFile(proposalPath, 'utf8')));
const evidenceRecords = new Map(await Promise.all(proposalDocument.proposals.map(async (entry) => {
  const raw = await fs.readFile(path.join(root, entry.evidence.observationReceiptPath));
  return [entry.evidence.observationReceiptPath, { raw, data: JSON.parse(raw.toString('utf8')) }];
})));
const blogDir = path.join(root, 'src', 'data', 'blog');
const articleNames = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md')).sort();
const articles = await Promise.all(articleNames.map(async (name) => ({
  ...matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data,
  slug: name.replace(/\.md$/, '')
})));
const validatedProposals = validateAffiliateActivationProposals({ document: proposalDocument, affiliate: model, articles, evidenceRecords });
const proposal = validatedProposals.proposals.find((entry) => entry.id === proposalId);
if (!proposal) throw new Error(`Unknown affiliate activation proposal: ${proposalId}`);
if (proposal.programId !== programId) throw new Error('proposal does not belong to the requested affiliate program');
if (proposal.activationState !== 'awaiting_founder_terms_acceptance') throw new Error('proposal is not awaiting founder terms acceptance');
if (proposal.approvalBoundarySha256 !== expectedProposalSha256) throw new Error('expected proposal SHA-256 does not match the exact activation boundary');
if (args['founder-login'] !== model.policy.founderApproverLogin) throw new Error('founder-login does not match the configured founder approver');
const program = model.programs.find((entry) => entry.id === programId);
if (!program) throw new Error(`Unknown affiliate program: ${programId}`);
if (program.revision !== proposal.expectedProgramRevision) throw new Error(`${program.id} is revision ${program.revision}, not proposal revision ${proposal.expectedProgramRevision}`);
if (program.status !== 'externally_verified' || program.founderDisposition !== 'approved' || program.enabled) throw new Error(`${program.id} is not a disabled externally verified program`);
if (program.trackingMethod !== proposal.activation.trackingMethod) throw new Error(`${program.id}: tracking method does not match the exact activation boundary`);

const now = new Date();
if (termsAcceptedAtMs > now.valueOf()) throw new Error('terms acceptance cannot be recorded in the future');
if (termsAcceptedAtMs < Date.parse(program.sourceCheckedAt)) throw new Error('terms acceptance must follow the recorded public source review');
if (program.sourceReviewExpiresAt < now.toISOString().slice(0, 10)) throw new Error('affiliate terms review has expired and must be refreshed before activation');

program.revision += 1;
program.status = 'enabled';
program.enabled = true;
program.allowedDomains = proposal.activation.allowedDomains;
program.registeredSites = [proposal.activation.registeredSite];
program.trackingMethod = proposal.activation.trackingMethod;
program.trackingPathPrefix = proposal.activation.trackingPathPrefix;
program.trackingParameterKeys = proposal.activation.trackingParameterKeys;
program.requiredDisclosure = proposal.activation.requiredDisclosure;
program.account = {
  ...program.account,
  termsAcceptedByFounder: true,
  termsAcceptedAt,
  acceptanceEvidenceReference: evidenceUrl.toString(),
  reportingExportApproved: proposal.activation.reportingExportApproved,
  activationProposalId: proposal.id,
  activationProposalSha256: proposal.approvalBoundarySha256
};
program.priceFeedAuthorized = proposal.activation.priceFeedAuthorized;
program.nextGate = 'Create and independently review exact destination-link candidates with the approved disclosure and sponsored relationship; activation alone does not make a paid link live or authorize prices.';
model.updatedAt = now.toISOString();
const issues = validateAffiliateModel(model, { asOfDate: now.toISOString().slice(0, 10) });
if (issues.length > 0) throw new Error(`Affiliate activation would violate the contract: ${issues.join('; ')}`);
await fs.writeFile(configPath, `${JSON.stringify(model, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `program_id=${program.id}\nprogram_revision=${program.revision}\n`);
console.log(JSON.stringify({ activated: true, programId: program.id, revision: program.revision, enabled: program.enabled, affiliateLinksCreated: 0, priceFeedAuthorized: false }, null, 2));
