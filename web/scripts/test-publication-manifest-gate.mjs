import assert from 'node:assert/strict';
import process from 'node:process';
import { buildPublicationManifest, parsePublicationManifest } from './lib/publication-manifest-contract.mjs';

const base = await buildPublicationManifest(process.cwd());
const clone = (value) => structuredClone(value);
function expectFailure(label, mutate) {
  const candidate = clone(base);
  mutate(candidate);
  assert.throws(() => parsePublicationManifest(candidate), undefined, label);
}

parsePublicationManifest(base);
expectFailure('wrong Firebase project rejected', (manifest) => { manifest.projectId = 'another-project'; });
expectFailure('manifest ID must bind content set', (manifest) => { manifest.manifestId = 'publication-set-0000000000000000'; });
expectFailure('content set digest must bind article evidence', (manifest) => { manifest.articles[0].articleSha256 = 'f'.repeat(64); });
expectFailure('article count cannot drift', (manifest) => { manifest.counts.articles += 1; });
expectFailure('review count cannot drift', (manifest) => { manifest.counts.independentReviews -= 1; });
expectFailure('social count cannot drift', (manifest) => { manifest.counts.socialDrafts += 1; });
expectFailure('mission count cannot drift', (manifest) => { manifest.counts.missionBoundArticles += 1; });
expectFailure('affiliate count cannot drift', (manifest) => { manifest.affiliatePosture.liveAffiliateLinkCount += 1; });
expectFailure('quality pass cannot be weakened', (manifest) => { manifest.articles[0].quality.independentReviewPassed = false; });
expectFailure('article route must bind slug', (manifest) => { manifest.articles[0].route = '/blog/something-else'; });
expectFailure('duplicate article slug rejected', (manifest) => { manifest.articles[1].articleSlug = manifest.articles[0].articleSlug; manifest.articles[1].route = manifest.articles[0].route; });
expectFailure('duplicate research run rejected', (manifest) => { manifest.articles[1].researchRunId = manifest.articles[0].researchRunId; });
expectFailure('unexpected fields rejected', (manifest) => { manifest.unverifiedNote = 'trust me'; });
console.log(JSON.stringify({ publicationManifestNegativeGateTests: 'passed', checks: 13, articles: base.counts.articles, hashBoundReviews: base.counts.independentReviews }, null, 2));
