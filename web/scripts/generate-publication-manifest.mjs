import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildPublicationManifest } from './lib/publication-manifest-contract.mjs';

const root = process.cwd();
const manifest = await buildPublicationManifest(root);
const outputPath = path.join(root, 'public', 'publication-manifest.json');
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ generated: path.relative(root, outputPath), manifestId: manifest.manifestId, contentSetSha256: manifest.contentSetSha256, articles: manifest.counts.articles, independentReviews: manifest.counts.independentReviews, socialDrafts: manifest.counts.socialDrafts, affiliateLinks: manifest.counts.affiliateLinks }, null, 2));
