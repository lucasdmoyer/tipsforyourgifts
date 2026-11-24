import assert from 'node:assert/strict';
import { isInteractiveRoute, optimizeStaticPublicHtml, publicEnhancementsSource } from './lib/static-public-performance-contract.mjs';

const fixture = `<!doctype html><html><head><link rel="stylesheet" href="styles-HASH.css"><link rel="modulepreload" href="chunk-A.js"></head><body><!--nghm--><tfg-root ng-version="21.2.25" ngh="2" ng-server-context="ssg"><a routerlink="/blog" routerlinkactive="active" href="/blog">Blog</a><button data-event-name="article_share" data-share-method="copy" data-article-slug="test-guide">Copy link</button><p class="article-share-status"></p></tfg-root><script src="main-HASH.js" type="module"></script><script id="ng-state" type="application/json">{"private":"hydration"}</script></body></html>`;
const enhancementPath = '/public-enhancements-test.js';
const optimized = optimizeStaticPublicHtml(fixture, enhancementPath);

assert.ok(optimized.includes('styles-HASH.css'), 'static optimization must retain site styles');
assert.ok(optimized.includes('href="/blog"'), 'static optimization must retain ordinary navigation');
assert.ok(optimized.includes(enhancementPath), 'article share controls must receive the tiny enhancement asset');
assert.doesNotMatch(optimized, /modulepreload|main-HASH|ng-state|ng-version|ng-server-context|\sngh=|routerlink/i, 'static public routes must not retain Angular hydration work');
assert.equal(optimizeStaticPublicHtml(optimized, enhancementPath), optimized, 'static optimization must be idempotent');
assert.equal(isInteractiveRoute('gift-finder/index.html'), true);
assert.equal(isInteractiveRoute('studio/index.html'), true);
assert.equal(isInteractiveRoute('studio/brief/index.html'), true);
assert.equal(isInteractiveRoute('blog/test-guide/index.html'), false);
assert.match(publicEnhancementsSource, /navigator\.share/);
assert.match(publicEnhancementsSource, /navigator\.clipboard/);
assert.doesNotMatch(publicEnhancementsSource, /eval\(|innerHTML|document\.write/);

console.log(JSON.stringify({
  staticPublicPerformanceGateTests: 'passed',
  staticNavigationPreserved: true,
  articleShareProgressivelyEnhanced: true,
  giftFinderInteractive: true,
  studioInteractive: true
}, null, 2));
