import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';
import { isInteractiveRoute } from './lib/static-public-performance-contract.mjs';

const root = process.cwd();
const dist = path.join(root, 'dist');
const kib = 1024;
const budgets = {
  staticPublicRawBytes: 40 * kib,
  staticPublicGzipBytes: 10 * kib,
  interactiveRawBytes: 325 * kib,
  interactiveGzipBytes: 110 * kib,
  publicHtmlBytes: 96 * kib,
  studioHtmlBytes: 320 * kib
};

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const read = (relative) => fs.readFile(path.join(dist, relative));

async function assetGraph(relativeHtmlPath, html) {
  const localAssetNames = new Set();
  for (const pattern of [
    /<link\b[^>]*\brel="(?:stylesheet|modulepreload)"[^>]*\bhref="([^"]+)"/g,
    /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g
  ]) {
    for (const match of html.matchAll(pattern)) {
      const asset = match[1].replace(/^\//, '');
      expect(!asset.includes('..') && !/^https?:/i.test(asset), `${relativeHtmlPath} initial asset must remain local: ${match[1]}`);
      localAssetNames.add(asset);
    }
  }
  expect(localAssetNames.size > 0, `${relativeHtmlPath} has no initial CSS or JavaScript assets`);
  let rawBytes = 0;
  let gzipBytes = 0;
  const assets = [];
  for (const asset of [...localAssetNames].sort()) {
    const bytes = await read(asset);
    const compressedBytes = gzipSync(bytes, { level: 9 }).byteLength;
    rawBytes += bytes.byteLength;
    gzipBytes += compressedBytes;
    assets.push({ asset, rawBytes: bytes.byteLength, gzipBytes: compressedBytes });
  }
  return { rawBytes, gzipBytes, assets };
}

const indexHtml = (await read('index.html')).toString('utf8');
const giftFinderHtml = (await read('gift-finder/index.html')).toString('utf8');
const staticPublicInitial = await assetGraph('index.html', indexHtml);
const interactiveInitial = await assetGraph('gift-finder/index.html', giftFinderHtml);

expect(!/modulepreload|\bmain-[A-Z0-9]+\.js|id="ng-state"|\sngh=/i.test(indexHtml), 'static home must not hydrate Angular in the browser');
expect(/\bmain-[A-Z0-9]+\.js/i.test(giftFinderHtml) && giftFinderHtml.includes('id="ng-state"'), 'gift finder must retain its interactive Angular runtime');
expect(staticPublicInitial.rawBytes <= budgets.staticPublicRawBytes, `static public assets are ${staticPublicInitial.rawBytes} bytes; budget is ${budgets.staticPublicRawBytes}`);
expect(staticPublicInitial.gzipBytes <= budgets.staticPublicGzipBytes, `static public assets gzip to ${staticPublicInitial.gzipBytes} bytes; budget is ${budgets.staticPublicGzipBytes}`);
expect(interactiveInitial.rawBytes <= budgets.interactiveRawBytes, `interactive assets are ${interactiveInitial.rawBytes} bytes; budget is ${budgets.interactiveRawBytes}`);
expect(interactiveInitial.gzipBytes <= budgets.interactiveGzipBytes, `interactive assets gzip to ${interactiveInitial.gzipBytes} bytes; budget is ${budgets.interactiveGzipBytes}`);

const htmlFiles = [];
const walk = async (directory) => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.name === 'index.html') htmlFiles.push(fullPath);
  }
};
await walk(dist);

let largestPublicRoute = { route: '/', bytes: 0 };
let largestStudioRoute = { route: '/studio', bytes: 0 };
let staticPublicRoutes = 0;
let interactiveRoutes = 0;
for (const filePath of htmlFiles) {
  const relative = path.relative(dist, filePath);
  const normalized = relative.replaceAll('\\', '/');
  const bytes = (await fs.stat(filePath)).size;
  const html = await fs.readFile(filePath, 'utf8');
  const route = relative === 'index.html' ? '/' : `/${path.dirname(relative)}`;
  if (isInteractiveRoute(relative)) {
    interactiveRoutes += 1;
    expect(/\bmain-[A-Z0-9]+\.js/i.test(html) && html.includes('id="ng-state"'), `${normalized} lost its interactive Angular runtime`);
  } else {
    staticPublicRoutes += 1;
    expect(!/modulepreload|\bmain-[A-Z0-9]+\.js|id="ng-state"|\sngh=/i.test(html), `${normalized} retains Angular hydration work`);
    if (normalized.startsWith('blog/') && normalized !== 'blog/index.html') {
      expect(/public-enhancements-[a-f0-9]{12}\.js/.test(html), `${normalized} lost its lightweight share enhancement`);
    }
  }
  if (normalized.startsWith('studio/')) {
    expect(bytes <= budgets.studioHtmlBytes, `${normalized} is ${bytes} bytes; studio HTML budget is ${budgets.studioHtmlBytes}`);
    if (bytes > largestStudioRoute.bytes) largestStudioRoute = { route, bytes };
  } else {
    expect(bytes <= budgets.publicHtmlBytes, `${normalized} is ${bytes} bytes; public HTML budget is ${budgets.publicHtmlBytes}`);
    if (bytes > largestPublicRoute.bytes) largestPublicRoute = { route, bytes };
  }
}

const fallbackPattern = /<img\b[^>]*\bsrc="(\/blog-images\/[^"]+\.webp)"/g;
for (const filePath of htmlFiles) {
  const html = await fs.readFile(filePath, 'utf8');
  for (const match of html.matchAll(fallbackPattern)) {
    expect(match[1].endsWith('-1200.webp'), `${path.relative(dist, filePath)} uses an unbounded image fallback: ${match[1]}`);
  }
}

console.log(JSON.stringify({
  builtPerformance: 'valid',
  budgets,
  staticPublicInitial,
  interactiveInitial,
  prerenderedHtmlFiles: htmlFiles.length,
  staticPublicRoutes,
  interactiveRoutes,
  largestPublicRoute,
  largestStudioRoute,
  responsiveFallbackMaximumWidth: 1200
}, null, 2));
