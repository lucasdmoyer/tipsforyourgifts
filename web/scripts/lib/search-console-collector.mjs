import { createHash } from 'node:crypto';

const propertyReference = 'https://tipsforyourgifts.web.app/';
const publicBaseUrl = 'https://tipsforyourgifts.web.app';

function isoDateInPacific(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function addUtcDays(isoDate, days) {
  const value = new Date(`${isoDate}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function latestFinalizedWeeklyWindow(now = new Date()) {
  const today = isoDateInPacific(now);
  const todayDate = new Date(`${today}T12:00:00Z`);
  const daysSinceSunday = todayDate.getUTCDay();
  let periodEnd = addUtcDays(today, -daysSinceSunday);
  if (daysSinceSunday < 4) periodEnd = addUtcDays(periodEnd, -7);
  return { periodStart: addUtcDays(periodEnd, -6), periodEnd };
}

function finiteNonnegative(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a finite nonnegative number`);
  return number;
}

async function readJson(response, label) {
  const text = await response.text();
  let value;
  try { value = text ? JSON.parse(text) : {}; } catch { throw new Error(`${label} returned invalid JSON`); }
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`);
  return value;
}

export async function collectSearchConsoleSnapshot({ connector, articles, accessToken, evidenceUrl, periodStart, periodEnd, collectedAt = new Date().toISOString(), fetchImpl = fetch }) {
  if (!connector || connector.id !== 'search-console' || connector.status !== 'active' || !connector.snapshotImportEnabled || !connector.automatedCollectionEnabled) {
    throw new Error('Search Console connector is not active for automated aggregate collection');
  }
  if (connector.sourceReference !== propertyReference || connector.collectionMethod !== 'search_console_api_page_aggregate' || connector.authenticationMode !== 'github_oidc_workload_identity') {
    throw new Error('Search Console connector configuration does not match the approved collector');
  }
  if (typeof accessToken !== 'string' || accessToken.length < 20) throw new Error('A read-only Search Console access token is required');
  const evidence = new URL(evidenceUrl);
  if (evidence.protocol !== 'https:' || evidence.username || evidence.password || evidence.search || evidence.hash) throw new Error('Evidence URL must be credential-free HTTPS without query parameters or fragments');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) throw new Error('A valid inclusive reporting window is required');
  const reportingWindowDays = Math.round((Date.parse(`${periodEnd}T00:00:00Z`) - Date.parse(`${periodStart}T00:00:00Z`)) / 86400000) + 1;
  if (reportingWindowDays !== 7) throw new Error('Automated Search Console snapshots must use exactly seven complete days');
  const latestAllowedEnd = addUtcDays(isoDateInPacific(new Date(collectedAt)), -4);
  if (periodEnd > latestAllowedEnd) throw new Error('Automated Search Console snapshots must end at least four Pacific calendar days before collection');
  const uniqueSlugs = [...new Set(articles.map((article) => article.slug))].sort();
  if (uniqueSlugs.length === 0 || uniqueSlugs.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) throw new Error('At least one valid publication-ready article slug is required');

  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyReference)}`;
  const headers = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
  const site = await readJson(await fetchImpl(endpoint, { headers }), 'Search Console property check');
  if (site.siteUrl !== propertyReference || site.permissionLevel === 'siteUnverifiedUser') throw new Error('Authenticated identity does not have verified read access to the exact Search Console property');

  const normalizedSource = [];
  const snapshotArticles = [];
  for (const slug of uniqueSlugs) {
    const pageUrl = `${publicBaseUrl}/blog/${slug}`;
    const request = {
      startDate: periodStart,
      endDate: periodEnd,
      type: 'web',
      dataState: 'final',
      aggregationType: 'auto',
      dimensionFilterGroups: [{ groupType: 'and', filters: [{ dimension: 'page', operator: 'equals', expression: pageUrl }] }],
      rowLimit: 1,
      startRow: 0
    };
    const result = await readJson(await fetchImpl(`${endpoint}/searchAnalytics/query`, { method: 'POST', headers, body: JSON.stringify(request) }), `Search Analytics aggregate for ${slug}`);
    if ((result.rows?.length ?? 0) > 1) throw new Error(`Search Analytics returned more than one aggregate row for ${slug}`);
    const row = result.rows?.[0];
    const organicClicks = row ? finiteNonnegative(row.clicks, `${slug} clicks`) : 0;
    const searchImpressions = row ? finiteNonnegative(row.impressions, `${slug} impressions`) : 0;
    normalizedSource.push({ slug, pageUrl, organicClicks, searchImpressions, responseAggregationType: result.responseAggregationType ?? 'auto' });
    snapshotArticles.push({
      slug, searchImpressions, organicClicks, engagedSessions: null, outboundMerchantClicks: null,
      affiliateConversions: null, revenueUsd: null, socialImpressions: null, socialEngagements: null, ownedSiteClicks: null
    });
  }
  const sourceArtifactSha256 = createHash('sha256').update(`${JSON.stringify({ propertyReference, periodStart, periodEnd, rows: normalizedSource })}\n`).digest('hex');
  return {
    id: `growth-snapshot-${periodEnd.replaceAll('-', '')}-search-console`,
    source: 'search_console_export',
    periodStart,
    periodEnd,
    collectedAt,
    reportingWindowDays,
    sourceConnectorIds: ['search-console'],
    sourceEvidenceUrl: evidence.toString(),
    sourceArtifactSha256,
    articles: snapshotArticles
  };
}
