import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const metric = z.number().finite().nonnegative().nullable().optional();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const connectorId = z.enum(['search-console', 'web-analytics', 'affiliate-reporting', 'social-reporting']);
const httpsUrl = z.string().url().superRefine((value, context) => {
  const url = new URL(value);
  if (url.protocol !== 'https:') context.addIssue({ code: z.ZodIssueCode.custom, message: 'must use HTTPS' });
  if (url.username || url.password) context.addIssue({ code: z.ZodIssueCode.custom, message: 'must not contain credentials' });
  if (url.search) context.addIssue({ code: z.ZodIssueCode.custom, message: 'must not contain query parameters or signed secrets' });
  if (url.hash) context.addIssue({ code: z.ZodIssueCode.custom, message: 'must not contain a fragment' });
  if (url.hostname === 'localhost' || url.hostname.endsWith('.local') || url.hostname === '127.0.0.1' || url.hostname === '::1') context.addIssue({ code: z.ZodIssueCode.custom, message: 'must use a public host' });
});

export const growthSnapshotSchema = z.object({
  id: z.string().regex(/^growth-snapshot-\d{8}-[a-z0-9-]+$/),
  source: z.enum(['search_console_export', 'privacy_safe_analytics_export', 'affiliate_network_export', 'social_platform_export', 'combined_aggregate_export']),
  periodStart: isoDate,
  periodEnd: isoDate,
  collectedAt: z.string().datetime(),
  reportingWindowDays: z.number().int().positive(),
  sourceConnectorIds: z.array(connectorId).min(1).max(4),
  sourceEvidenceUrl: httpsUrl,
  sourceArtifactSha256: sha256,
  articles: z.array(z.object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    searchImpressions: metric,
    organicClicks: metric,
    engagedSessions: metric,
    outboundMerchantClicks: metric,
    affiliateConversions: metric,
    revenueUsd: metric,
    socialImpressions: metric,
    socialEngagements: metric,
    ownedSiteClicks: metric
  }).strict()).min(1)
}).strict();

const connectorSchema = z.object({
  id: connectorId,
  name: z.string().min(12),
  status: z.enum(['not_connected', 'configured', 'active', 'paused']),
  founderApproved: z.boolean(),
  metrics: z.array(z.enum([
    'searchImpressions', 'organicClicks', 'engagedSessions', 'outboundMerchantClicks',
    'affiliateConversions', 'revenueUsd', 'socialImpressions', 'socialEngagements', 'ownedSiteClicks'
  ])).min(1),
  sourceReference: z.string().min(8).max(300).nullable(),
  collectionMethod: z.enum(['search_console_api_page_aggregate', 'manual_aggregate_export']).nullable(),
  authenticationMode: z.enum(['github_oidc_workload_identity', 'founder_export']).nullable(),
  credentialSecretNames: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{4,99}$/)).max(4),
  configurationEvidenceUrl: httpsUrl.nullable(),
  configuredAt: z.string().datetime().nullable(),
  activatedAt: z.string().datetime().nullable(),
  snapshotImportEnabled: z.boolean(),
  automatedCollectionEnabled: z.boolean(),
  nextGate: z.string().min(30)
}).strict();

const experimentSchema = z.object({
  id: z.string().regex(/^growth-exp-\d{3}$/),
  status: z.enum(['proposed', 'approved', 'running', 'completed', 'stopped']),
  founderDisposition: z.enum(['proposed', 'approved', 'paused', 'rejected']),
  title: z.string().min(12),
  hypothesis: z.string().min(50),
  channel: z.enum(['owned_site', 'owned_social', 'search', 'pinterest', 'instagram', 'tiktok', 'email']),
  targetArticleSlugs: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1),
  primaryMetric: z.enum(['searchImpressions', 'organicClicks', 'engagedSessions', 'outboundMerchantClicks', 'affiliateConversions', 'revenueUsd', 'socialImpressions', 'socialEngagements', 'ownedSiteClicks']),
  secondaryMetrics: z.array(z.enum(['searchImpressions', 'organicClicks', 'engagedSessions', 'outboundMerchantClicks', 'affiliateConversions', 'revenueUsd', 'socialImpressions', 'socialEngagements', 'ownedSiteClicks'])).default([]),
  decisionRule: z.string().min(80),
  stopConditions: z.array(z.string().min(30)).min(2),
  sourceSnapshotIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  nextReviewAt: isoDate
}).strict();

export const growthSchema = z.object({
  schemaVersion: z.literal('1.1.0'),
  updatedAt: z.string().datetime(),
  measurementPolicy: z.object({
    aggregateOnly: z.literal(true),
    unknownValuesAreNull: z.literal(true),
    minimumReportingWindowDays: z.number().int().min(7),
    founderApproverLogin: z.string().regex(/^[A-Za-z0-9-]{1,39}$/),
    forbiddenFields: z.array(z.string().min(2)).min(6)
  }).strict(),
  connectors: z.array(connectorSchema).length(4),
  snapshots: z.array(growthSnapshotSchema),
  experiments: z.array(experimentSchema)
}).strict();

const forbiddenKey = /^(?:user_?id|email|phone|ip_?address|cookie_?id|device_?id|precise_?location|raw_?query)$/i;
const expectedConnectorBySource = {
  search_console_export: ['search-console'],
  privacy_safe_analytics_export: ['web-analytics'],
  affiliate_network_export: ['affiliate-reporting'],
  social_platform_export: ['social-reporting']
};
const metricConnector = {
  searchImpressions: 'search-console',
  organicClicks: 'search-console',
  engagedSessions: 'web-analytics',
  outboundMerchantClicks: 'web-analytics',
  affiliateConversions: 'affiliate-reporting',
  revenueUsd: 'affiliate-reporting',
  socialImpressions: 'social-reporting',
  socialEngagements: 'social-reporting',
  ownedSiteClicks: 'social-reporting'
};

function scanForbiddenKeys(value, at, issues) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbiddenKeys(entry, `${at}[${index}]`, issues));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (forbiddenKey.test(key)) issues.push(`${at}.${key}: personal or raw query data is prohibited`);
    scanForbiddenKeys(entry, `${at}.${key}`, issues);
  }
}

export function validateGrowthModel(input, options = {}) {
  const issues = [];
  let growth;
  try {
    growth = growthSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    }
    return [String(error?.message ?? error)];
  }

  const connectorIds = new Set(growth.connectors.map((connector) => connector.id));
  const connectorById = new Map(growth.connectors.map((connector) => [connector.id, connector]));
  if (connectorIds.size !== growth.connectors.length) issues.push('connector IDs must be unique');
  for (const connector of growth.connectors) {
    if (['configured', 'active'].includes(connector.status) && !connector.founderApproved) {
      issues.push(`${connector.id}: configured or active connector requires founder approval`);
    }
    const setupFields = [connector.sourceReference, connector.collectionMethod, connector.authenticationMode, connector.configurationEvidenceUrl, connector.configuredAt];
    if (connector.status === 'not_connected') {
      if (connector.founderApproved || setupFields.some((value) => value !== null) || connector.activatedAt !== null || connector.credentialSecretNames.length > 0 || connector.snapshotImportEnabled || connector.automatedCollectionEnabled) {
        issues.push(`${connector.id}: not_connected connector cannot retain configuration or enable collection`);
      }
    }
    if (connector.status === 'configured') {
      if (setupFields.some((value) => value === null) || connector.activatedAt !== null || connector.snapshotImportEnabled || connector.automatedCollectionEnabled) {
        issues.push(`${connector.id}: configured connector requires complete evidence but cannot import or collect yet`);
      }
    }
    if (connector.status === 'active') {
      if (setupFields.some((value) => value === null) || connector.activatedAt === null || !connector.snapshotImportEnabled) {
        issues.push(`${connector.id}: active connector requires complete configuration, activation time, and snapshot import authority`);
      }
      if (connector.configuredAt && connector.activatedAt && connector.activatedAt < connector.configuredAt) issues.push(`${connector.id}: activatedAt precedes configuredAt`);
    }
    if (connector.status === 'paused' && (connector.snapshotImportEnabled || connector.automatedCollectionEnabled)) {
      issues.push(`${connector.id}: paused connector cannot import or collect snapshots`);
    }
    if (connector.id === 'search-console' && connector.status !== 'not_connected') {
      if (connector.sourceReference !== 'https://tipsforyourgifts.web.app/') issues.push('search-console: property reference must match the canonical URL-prefix property');
      if (connector.collectionMethod !== 'search_console_api_page_aggregate') issues.push('search-console: collection must use page-aggregate Search Analytics queries');
      if (connector.authenticationMode !== 'github_oidc_workload_identity') issues.push('search-console: authentication must use GitHub OIDC workload identity');
      const expectedSecrets = ['SEARCH_CONSOLE_WIF_PROVIDER', 'SEARCH_CONSOLE_SERVICE_ACCOUNT'];
      if (connector.credentialSecretNames.join(',') !== expectedSecrets.join(',')) issues.push('search-console: credential secret references must use the approved names');
      if (connector.status === 'active' && !connector.automatedCollectionEnabled) issues.push('search-console: active status must enable the approved aggregate collector');
    }
  }

  const snapshotIds = new Set();
  const reportingWindows = new Set();
  const publishedSlugs = options.publishedSlugs ?? new Set();
  for (const snapshot of growth.snapshots) {
    if (snapshotIds.has(snapshot.id)) issues.push(`${snapshot.id}: duplicate snapshot ID`);
    snapshotIds.add(snapshot.id);
    if (snapshot.periodStart > snapshot.periodEnd) issues.push(`${snapshot.id}: periodStart is after periodEnd`);
    const expectedWindow = Math.round((Date.parse(`${snapshot.periodEnd}T00:00:00Z`) - Date.parse(`${snapshot.periodStart}T00:00:00Z`)) / 86400000) + 1;
    if (snapshot.reportingWindowDays !== expectedWindow) issues.push(`${snapshot.id}: reportingWindowDays does not match the inclusive period`);
    if (snapshot.reportingWindowDays < growth.measurementPolicy.minimumReportingWindowDays) issues.push(`${snapshot.id}: reporting window is shorter than policy`);
    if (snapshot.collectedAt.slice(0, 10) < snapshot.periodEnd) issues.push(`${snapshot.id}: collectedAt precedes the reporting period end`);
    if (new Set(snapshot.sourceConnectorIds).size !== snapshot.sourceConnectorIds.length) issues.push(`${snapshot.id}: source connector IDs must be unique`);
    const expectedSourceConnectors = expectedConnectorBySource[snapshot.source];
    if (expectedSourceConnectors && snapshot.sourceConnectorIds.join(',') !== expectedSourceConnectors.join(',')) issues.push(`${snapshot.id}: source does not match its connector`);
    for (const connectorIdValue of snapshot.sourceConnectorIds) {
      const connector = connectorById.get(connectorIdValue);
      if (!connector || connector.status !== 'active' || !connector.snapshotImportEnabled) issues.push(`${snapshot.id}: connector ${connectorIdValue} is not active for snapshot import`);
      const windowKey = `${connectorIdValue}:${snapshot.periodStart}:${snapshot.periodEnd}`;
      if (reportingWindows.has(windowKey)) issues.push(`${snapshot.id}: duplicate reporting window for ${connectorIdValue}`);
      reportingWindows.add(windowKey);
    }
    const articleSlugs = new Set();
    for (const article of snapshot.articles) {
      if (articleSlugs.has(article.slug)) issues.push(`${snapshot.id}: duplicate article ${article.slug}`);
      articleSlugs.add(article.slug);
      if (publishedSlugs.size > 0 && !publishedSlugs.has(article.slug)) issues.push(`${snapshot.id}: unknown publication-ready article ${article.slug}`);
      for (const [metricName, requiredConnector] of Object.entries(metricConnector)) {
        if (article[metricName] !== null && article[metricName] !== undefined && !snapshot.sourceConnectorIds.includes(requiredConnector)) {
          issues.push(`${snapshot.id}: ${metricName} requires active source connector ${requiredConnector}`);
        }
      }
    }
    if (snapshot.source === 'affiliate_network_export' && (options.affiliateProgramsEnabled ?? 0) === 0) {
      issues.push(`${snapshot.id}: affiliate export is not allowed while no affiliate program is enabled`);
    }
  }
  scanForbiddenKeys(growth.snapshots, 'snapshots', issues);

  const experimentIds = new Set();
  for (const experiment of growth.experiments) {
    if (experimentIds.has(experiment.id)) issues.push(`${experiment.id}: duplicate experiment ID`);
    experimentIds.add(experiment.id);
    if (experiment.secondaryMetrics.includes(experiment.primaryMetric)) issues.push(`${experiment.id}: primary metric cannot be repeated as a secondary metric`);
    for (const slug of experiment.targetArticleSlugs) {
      if (publishedSlugs.size > 0 && !publishedSlugs.has(slug)) issues.push(`${experiment.id}: unknown publication-ready article ${slug}`);
    }
    for (const snapshotId of experiment.sourceSnapshotIds) {
      if (!snapshotIds.has(snapshotId)) issues.push(`${experiment.id}: missing source snapshot ${snapshotId}`);
    }
    if (['approved', 'running'].includes(experiment.status) && experiment.founderDisposition !== 'approved') {
      issues.push(`${experiment.id}: approved or running experiment requires founder approval`);
    }
    if (experiment.status === 'running' && experiment.sourceSnapshotIds.length === 0) {
      issues.push(`${experiment.id}: running experiment requires an aggregate baseline snapshot`);
    }
  }
  return issues;
}
