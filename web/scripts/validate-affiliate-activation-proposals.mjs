import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from './lib/front-matter.mjs';
import { affiliateActivationProposalSchema, validateAffiliateActivationProposals } from './lib/affiliate-activation-proposal-contract.mjs';

const root = process.cwd();
const document = affiliateActivationProposalSchema.parse(JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-activation-proposals.json'), 'utf8')));
const evidenceRecords = new Map(await Promise.all(document.proposals.map(async (proposal) => {
  const raw = await fs.readFile(path.join(root, proposal.evidence.observationReceiptPath));
  return [proposal.evidence.observationReceiptPath, { raw, data: JSON.parse(raw.toString('utf8')) }];
})));
const affiliate = JSON.parse(await fs.readFile(path.join(root, 'config', 'affiliate-programs.json'), 'utf8'));
const blogDir = path.join(root, 'src', 'data', 'blog');
const articleNames = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md')).sort();
const articles = await Promise.all(articleNames.map(async (name) => {
  const parsed = matter(await fs.readFile(path.join(blogDir, name), 'utf8')).data;
  return { ...parsed, slug: name.replace(/\.md$/, '') };
}));
const validated = validateAffiliateActivationProposals({ document, affiliate, articles, evidenceRecords });
const programsEnabled = affiliate.programs.filter((program) => program.enabled).length;
console.log(JSON.stringify({ affiliateActivationProposals: 'valid', proposals: validated.proposals.length, programsEnabled, paidLinkCandidatesCreated: 0, productionDeploymentsAuthorized: 0 }, null, 2));
