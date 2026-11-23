import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const dist = path.join(root, 'dist');
const kib = 1024;
const budgets = {
  initialRawBytes: 320 * kib,
  initialGzipBytes: 110 * kib,
  publicHtmlBytes: 96 * kib,
  studioHtmlBytes: 320 * kib
};

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const read = (relative) => fs.readFile(path.join(dist, relative));

const indexBuffer = await read('index.html');
const indexHtml = indexBuffer.toString('utf8');
const localAssetNames = new Set();
for (const pattern of [
  /<link\b[^>]*\brel="(?:stylesheet|modulepreload)"[^>]*\bhref="([^"]+)"/g,
  /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g
]) {
  for (const match of indexHtml.matchAll(pattern)) {
    const asset = match[1].replace(/^\//, '');
    expect(!asset.includes('..') && !/^https?:/i.test(asset), `initial asset must remain local: ${match[1]}`);
    localAssetNames.add(asset);
  }
}
expect(localAssetNames.size > 0, 'no initial CSS or JavaScript assets were found in dist/index.html');

let initialRawBytes = 0;
let initialGzipBytes = 0;
const initialAssets = [];
for (const asset of [...localAssetNames].sort()) {
  const bytes = await read(asset);
  const gzipBytes = gzipSync(bytes, { level: 9 }).byteLength;
  initialRawBytes += bytes.byteLength;
  initialGzipBytes += gzipBytes;
  initialAssets.push({ asset, rawBytes: bytes.byteLength, gzipBytes });
}

expect(initialRawBytes <= budgets.initialRawBytes, `initial local assets are ${initialRawBytes} bytes; budget is ${budgets.initialRawBytes}`);
expect(initialGzipBytes <= budgets.initialGzipBytes, `initial local assets gzip to ${initialGzipBytes} bytes; budget is ${budgets.initialGzipBytes}`);

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
let studioHtmlBytes = null;
for (const filePath of htmlFiles) {
  const relative = path.relative(dist, filePath);
  const bytes = (await fs.stat(filePath)).size;
  if (relative === path.join('studio', 'index.html')) {
    studioHtmlBytes = bytes;
    continue;
  }
  expect(bytes <= budgets.publicHtmlBytes, `${relative} is ${bytes} bytes; public HTML budget is ${budgets.publicHtmlBytes}`);
  if (bytes > largestPublicRoute.bytes) largestPublicRoute = { route: relative === 'index.html' ? '/' : `/${path.dirname(relative)}`, bytes };
}
expect(studioHtmlBytes !== null, 'dist/studio/index.html is missing');
expect(studioHtmlBytes <= budgets.studioHtmlBytes, `studio HTML is ${studioHtmlBytes} bytes; budget is ${budgets.studioHtmlBytes}`);

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
  initialRawBytes,
  initialGzipBytes,
  initialAssets,
  prerenderedHtmlFiles: htmlFiles.length,
  largestPublicRoute,
  studioHtmlBytes,
  responsiveFallbackMaximumWidth: 1200
}, null, 2));
