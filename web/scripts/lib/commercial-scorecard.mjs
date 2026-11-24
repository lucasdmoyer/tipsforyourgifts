const METRICS = [
  'searchImpressions',
  'organicClicks',
  'engagedSessions',
  'outboundMerchantClicks',
  'affiliateConversions',
  'revenueUsd',
  'socialImpressions',
  'socialEngagements',
  'ownedSiteClicks'
];

function emptyMetricRecord() {
  return Object.fromEntries(METRICS.map((metric) => [metric, null]));
}
function ratio(numerator, denominator) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function selectLatestComparableWindow(snapshots) {
  const groups = new Map();
  for (const snapshot of snapshots) {
    const key = `${snapshot.periodStart}:${snapshot.periodEnd}`;
    const group = groups.get(key) ?? [];
    group.push(snapshot);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => {
    const byEnd = right[0].periodEnd.localeCompare(left[0].periodEnd);
    if (byEnd !== 0) return byEnd;
    const rightConnectors = new Set(right.flatMap((snapshot) => snapshot.sourceConnectorIds)).size;
    const leftConnectors = new Set(left.flatMap((snapshot) => snapshot.sourceConnectorIds)).size;
    if (rightConnectors !== leftConnectors) return rightConnectors - leftConnectors;
    return right[0].reportingWindowDays - left[0].reportingWindowDays;
  })[0] ?? null;
}

function leaderFor(articles, metric) {
  const ranked = [...articles.values()]
    .filter((article) => article[metric] !== null)
    .sort((left, right) => right[metric] - left[metric] || left.slug.localeCompare(right.slug));
  return ranked.length > 0 ? { slug: ranked[0].slug, value: ranked[0][metric] } : null;
}

function evidenceStage(totals) {
  if (totals.affiliateConversions !== null || totals.revenueUsd !== null) return 'affiliate_outcome_observed';
  if (totals.outboundMerchantClicks !== null) return 'merchant_intent_observed';
  if (totals.organicClicks !== null || totals.ownedSiteClicks !== null || totals.engagedSessions !== null) return 'qualified_traffic_observed';
  return 'reach_observed';
}

export function buildCommercialScorecard(growth) {
  const windowSnapshots = selectLatestComparableWindow(growth.snapshots ?? []);
  if (!windowSnapshots) {
    return {
      status: 'awaiting_observed_export',
      evidenceStage: 'awaiting_observed_export',
      periodStart: null,
      periodEnd: null,
      reportingWindowDays: null,
      snapshotIds: [],
      sourceConnectorIds: [],
      articleCount: 0,
      knownMetrics: [],
      missingMetrics: [...METRICS],
      totals: emptyMetricRecord(),
      rates: {
        organicClickThrough: null,
        merchantClickThrough: null,
        affiliateConversion: null,
        earningsPerOutboundClickUsd: null,
        revenuePerConversionUsd: null,
        socialOwnedClickThrough: null
      },
      leaders: {
        organicClicks: null,
        outboundMerchantClicks: null,
        affiliateConversions: null,
        revenueUsd: null,
        ownedSiteClicks: null
      },
      profitabilityConclusion: 'unknown_until_observed_revenue_and_cost_evidence',
      nextGate: 'Import one complete approved aggregate reporting window. Missing traffic, conversion, and revenue remain unknown rather than zero.'
    };
  }

  const articles = new Map();
  for (const snapshot of windowSnapshots) {
    for (const sourceArticle of snapshot.articles) {
      const article = articles.get(sourceArticle.slug) ?? { slug: sourceArticle.slug, ...emptyMetricRecord() };
      for (const metric of METRICS) {
        const value = sourceArticle[metric];
        if (value === null || value === undefined) continue;
        if (article[metric] !== null) throw new Error(`${sourceArticle.slug}: duplicate observed ${metric} in one reporting window`);
        article[metric] = value;
      }
      articles.set(sourceArticle.slug, article);
    }
  }

  const totals = emptyMetricRecord();
  for (const metric of METRICS) {
    const observedValues = [...articles.values()].map((article) => article[metric]).filter((value) => value !== null);
    if (articles.size > 0 && observedValues.length === articles.size) {
      totals[metric] = observedValues.reduce((sum, value) => sum + value, 0);
    }
  }
  const knownMetrics = METRICS.filter((metric) => totals[metric] !== null);
  const missingMetrics = METRICS.filter((metric) => totals[metric] === null);
  const stage = evidenceStage(totals);
  const nextGate = stage === 'affiliate_outcome_observed'
    ? 'Compare complete windows and approved experiments. Revenue is evidence, but profit remains unknown because operating costs are not part of this registry.'
    : stage === 'merchant_intent_observed'
      ? 'Import an approved affiliate-network aggregate window before evaluating conversion or revenue.'
      : stage === 'qualified_traffic_observed'
        ? 'Add consent-aware aggregate engagement and merchant-outbound evidence before evaluating commercial intent.'
        : 'Add qualified traffic evidence before interpreting reach as reader demand.';

  return {
    status: missingMetrics.length === 0 ? 'complete_observed_window' : 'partial_observed_window',
    evidenceStage: stage,
    periodStart: windowSnapshots[0].periodStart,
    periodEnd: windowSnapshots[0].periodEnd,
    reportingWindowDays: windowSnapshots[0].reportingWindowDays,
    snapshotIds: windowSnapshots.map((snapshot) => snapshot.id).sort(),
    sourceConnectorIds: [...new Set(windowSnapshots.flatMap((snapshot) => snapshot.sourceConnectorIds))].sort(),
    articleCount: articles.size,
    knownMetrics,
    missingMetrics,
    totals,
    rates: {
      organicClickThrough: ratio(totals.organicClicks, totals.searchImpressions),
      merchantClickThrough: ratio(totals.outboundMerchantClicks, totals.engagedSessions),
      affiliateConversion: ratio(totals.affiliateConversions, totals.outboundMerchantClicks),
      earningsPerOutboundClickUsd: ratio(totals.revenueUsd, totals.outboundMerchantClicks),
      revenuePerConversionUsd: ratio(totals.revenueUsd, totals.affiliateConversions),
      socialOwnedClickThrough: ratio(totals.ownedSiteClicks, totals.socialImpressions)
    },
    leaders: {
      organicClicks: leaderFor(articles, 'organicClicks'),
      outboundMerchantClicks: leaderFor(articles, 'outboundMerchantClicks'),
      affiliateConversions: leaderFor(articles, 'affiliateConversions'),
      revenueUsd: leaderFor(articles, 'revenueUsd'),
      ownedSiteClicks: leaderFor(articles, 'ownedSiteClicks')
    },
    profitabilityConclusion: 'unknown_until_operating_cost_evidence',
    nextGate
  };
}
