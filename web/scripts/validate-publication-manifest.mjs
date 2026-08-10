import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildPublicationManifest, parsePublicationManifest, sha256 } from './lib/publication-manifest-contract.mjs';

const root = process.cwd();
const manifestPath = path.join(root, 'public', 'publication-manifest.json');
const raw = await fs.readFile(manifestPath);
const actual = parsePublicationManifest(JSON.parse(raw));
const expected = await buildPublicationManifest(root);
assert.deepStrictEqual(actual, expected, 'publication manifest is stale or differs from the validated editorial artifacts');
console.log(JSON.stringify({ gate: 'passed', manifestId: actual.manifestId, manifestSha256: sha256(raw), contentSetSha256: actual.contentSetSha256, articles: actual.counts.articles, hashBoundReviews: actual.counts.independentReviews, missionBoundArticles: actual.counts.missionBoundArticles, socialDrafts: actual.counts.socialDrafts, affiliateLinks: actual.counts.affiliateLinks }, null, 2));
