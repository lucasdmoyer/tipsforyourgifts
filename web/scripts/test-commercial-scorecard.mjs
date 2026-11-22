import assert from 'node:assert/strict';
import { buildCommercialScorecard } from './lib/commercial-scorecard.mjs';

const empty = buildCommercialScorecard({ snapshots: [] });
assert.equal(empty.status, 'awaiting_observed_export');
assert.equal(empty.evidenceStage, 'awaiting_observed_export');
assert.equal(empty.totals.revenueUsd, null);
assert.equal(empty.rates.affiliateConversion, null);
assert.equal(empty.profitabilityConclusion, 'unknown_until_observed_revenue_and_cost_evidence');

const period = {
  periodStart: '2026-11-02',
  periodEnd: '2026-11-08',
  collectedAt: '2026-11-09T08:00:00.000Z',
  reportingWindowDays: 7,
  sourceEvidenceUrl: 'https://github.com/lucasdmoyer/tipsforyourgifts/actions/runs/123',
  sourceArtifactSha256: 'a'.repeat(64)
};
const article = (slug, metrics) => ({ slug, ...metrics });
const snapshots = [
  {
    ...period, id: 'growth-snapshot-20261109-search', source: 'search_console_export', sourceConnectorIds: ['search-console'],
    articles: [article('alpha-guide', { searchImpressions: 1000, organicClicks: 100 }), article('beta-guide', { searchImpressions: 500, organicClicks: 25 })]
  },
  {
    ...period, id: 'growth-snapshot-20261109-site', source: 'privacy_safe_analytics_export', sourceConnectorIds: ['web-analytics'],
    articles: [article('alpha-guide', { engagedSessions: 80, outboundMerchantClicks: 20 }), article('beta-guide', { engagedSessions: 20, outboundMerchantClicks: 2 })]
  },
  {
    ...period, id: 'growth-snapshot-20261109-affiliate', source: 'affiliate_network_export', sourceConnectorIds: ['affiliate-reporting'],
    articles: [article('alpha-guide', { affiliateConversions: 2, revenueUsd: 18 }), article('beta-guide', { affiliateConversions: 0, revenueUsd: 0 })]
  },
  {
    ...period, id: 'growth-snapshot-20261109-social', source: 'social_platform_export', sourceConnectorIds: ['social-reporting'],
    articles: [article('alpha-guide', { socialImpressions: 1000, socialEngagements: 100, ownedSiteClicks: 40 }), article('beta-guide', { socialImpressions: 200, socialEngagements: 10, ownedSiteClicks: 5 })]
  },
  {
    ...period,
    id: 'growth-snapshot-20261001-old',
    periodStart: '2026-09-21',
    periodEnd: '2026-09-27',
    source: 'search_console_export',
    sourceConnectorIds: ['search-console'],
    articles: [article('alpha-guide', { searchImpressions: 999999, organicClicks: 999999 })]
  }
];

const observed = buildCommercialScorecard({ snapshots });
assert.equal(observed.status, 'complete_observed_window');
assert.equal(observed.evidenceStage, 'affiliate_outcome_observed');
assert.equal(observed.periodStart, '2026-11-02');
assert.equal(observed.periodEnd, '2026-11-08');
assert.equal(observed.articleCount, 2);
assert.deepEqual(observed.sourceConnectorIds, ['affiliate-reporting', 'search-console', 'social-reporting', 'web-analytics']);
assert.equal(observed.totals.searchImpressions, 1500);
assert.equal(observed.totals.organicClicks, 125);
assert.equal(observed.totals.engagedSessions, 100);
assert.equal(observed.totals.outboundMerchantClicks, 22);
assert.equal(observed.totals.affiliateConversions, 2);
assert.equal(observed.totals.revenueUsd, 18);
assert.equal(observed.totals.socialImpressions, 1200);
assert.equal(observed.totals.ownedSiteClicks, 45);
assert.equal(observed.rates.organicClickThrough, 125 / 1500);
assert.equal(observed.rates.merchantClickThrough, 22 / 100);
assert.equal(observed.rates.affiliateConversion, 2 / 22);
assert.equal(observed.rates.earningsPerOutboundClickUsd, 18 / 22);
assert.equal(observed.rates.revenuePerConversionUsd, 9);
assert.equal(observed.rates.socialOwnedClickThrough, 45 / 1200);
assert.deepEqual(observed.leaders.revenueUsd, { slug: 'alpha-guide', value: 18 });
assert.equal(observed.profitabilityConclusion, 'unknown_until_operating_cost_evidence');

const zeroDenominator = buildCommercialScorecard({ snapshots: [{
  ...period,
  id: 'growth-snapshot-20261109-zero',
  source: 'combined_aggregate_export',
  sourceConnectorIds: ['web-analytics', 'affiliate-reporting'],
  articles: [article('alpha-guide', { engagedSessions: 0, outboundMerchantClicks: 0, affiliateConversions: 0, revenueUsd: 0 })]
}] });
assert.equal(zeroDenominator.rates.merchantClickThrough, null);
assert.equal(zeroDenominator.rates.affiliateConversion, null);
assert.equal(zeroDenominator.rates.earningsPerOutboundClickUsd, null);
assert.equal(zeroDenominator.rates.revenuePerConversionUsd, null);

const incompleteArticleCoverage = buildCommercialScorecard({ snapshots: [
  snapshots[0],
  { ...snapshots[1], articles: [snapshots[1].articles[0]] }
] });
assert.equal(incompleteArticleCoverage.totals.organicClicks, 125);
assert.equal(incompleteArticleCoverage.totals.engagedSessions, null);
assert.equal(incompleteArticleCoverage.totals.outboundMerchantClicks, null);
assert.equal(incompleteArticleCoverage.rates.merchantClickThrough, null);
assert.equal(incompleteArticleCoverage.status, 'partial_observed_window');

assert.throws(() => buildCommercialScorecard({ snapshots: [snapshots[0], { ...snapshots[0], id: 'growth-snapshot-20261109-duplicate' }] }), /duplicate observed/);

console.log(JSON.stringify({
  commercialScorecardTests: 'passed',
  emptyValuesRemainUnknown: true,
  latestComparableWindowSelected: true,
  incompleteArticleCoverageRemainsUnknown: true,
  rateChecks: 6,
  profitabilityClaimed: false
}, null, 2));
