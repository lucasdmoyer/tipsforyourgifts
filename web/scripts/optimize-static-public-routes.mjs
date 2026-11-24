import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { isInteractiveRoute, optimizeStaticPublicHtml, publicEnhancementsSource } from './lib/static-public-performance-contract.mjs';

const dist = path.join(process.cwd(), 'dist');
const enhancementHash = crypto.createHash('sha256').update(publicEnhancementsSource).digest('hex').slice(0, 12);
const enhancementName = `public-enhancements-${enhancementHash}.js`;
const enhancementPath = `/${enhancementName}`;
const htmlFiles = [];

async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.name === 'index.html') htmlFiles.push(fullPath);
  }
}

await walk(dist);
let optimizedRoutes = 0;
let originalBytes = 0;
let optimizedBytes = 0;
let enhancedArticleRoutes = 0;

for (const filePath of htmlFiles) {
  const relativePath = path.relative(dist, filePath);
  if (isInteractiveRoute(relativePath)) continue;
  const original = await fs.readFile(filePath, 'utf8');
  const optimized = optimizeStaticPublicHtml(original, enhancementPath);
  if (optimized.includes(enhancementPath)) enhancedArticleRoutes += 1;
  await fs.writeFile(filePath, optimized);
  optimizedRoutes += 1;
  originalBytes += Buffer.byteLength(original);
  optimizedBytes += Buffer.byteLength(optimized);
}

await fs.writeFile(path.join(dist, enhancementName), publicEnhancementsSource);

console.log(JSON.stringify({
  staticPublicOptimization: 'complete',
  optimizedRoutes,
  enhancedArticleRoutes,
  interactiveRoutesPreserved: htmlFiles.length - optimizedRoutes,
  htmlBytesRemoved: originalBytes - optimizedBytes,
  enhancementAsset: enhancementName,
  enhancementBytes: Buffer.byteLength(publicEnhancementsSource)
}, null, 2));
