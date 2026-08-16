export interface Product {
  id: string;
  name: string;
  merchant: string;
  url: string;
  affiliate: boolean;
  affiliateProgram?: string;
  priceBand?: string;
  whyItFits: string;
  drawback: string;
  editorialScore: number;
  evidenceConfidence: number;
  claimIds: string[];
}

export interface ProductPair {
  id: string;
  name: string;
  anchorProductId: string;
  companionProductId: string;
  whyTogether: string;
  interactionMoment: string;
  preGiftCheck: string;
  bundleDrawback: string;
  coherenceScore: number;
  claimIds: string[];
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  publishDate: string;
  updatedDate: string;
  status: 'draft' | 'publication_ready';
  audience: string;
  occasion: string;
  priceBand: string;
  tags: string[];
  researchRun: string;
  evidenceScore: number;
  evidenceMode: 'desk_research' | 'hands_on' | 'editorial_standard';
  featured: boolean;
  affiliateDisclosure: boolean;
  products: Product[];
  pairs: ProductPair[];
  contentHtml: string;
}

export interface StrategyIdea {
  id: string;
  revision: number;
  founderDisposition: 'proposed' | 'approved_for_research' | 'paused' | 'rejected';
  ideaType: 'editorial' | 'growth';
  thesisType: 'recipient_friction' | 'story_pairing' | 'ritual_pairing' | 'growth_distribution';
  title: string;
  audience: string;
  occasion: string;
  budget: string;
  priority: 'high' | 'medium' | 'low';
  insight: string;
  observedFriction: string;
  selfPurchaseReluctance: string;
  fitSignals: string[];
  avoidIf: string[];
  pairing?: {
    unifyingIdea: string;
    itemRoles: Array<{ item: string; role: string }>;
    interactionMoment: string;
    compatibilityChecks: string[];
    coherenceScore: number;
    clutterRisk: string;
  };
  successMetric: string;
  deliverables: {
    minimumFinalists: number;
    minimumQualifiedPairs: number;
    minimumSocialAngles: number;
  };
  researchBrief: string;
}

export interface Strategy {
  schemaVersion: '1.1.0';
  updatedAt: string;
  northStar: string;
  currentBet: string;
  thoughtfulnessFramework: {
    minimumPairCoherenceScore: number;
    principles: Array<{ id: string; label: string; question: string }>;
  };
  ideas: StrategyIdea[];
}

export interface Operations {
  generatedAt: string;
  founderAgenda: {
    schemaVersion: '1.0.0';
    generatedAt: string;
    posture: 'founder_decisions_required';
    primaryDecisionId: string;
    profitabilityEvidence: 'unknown_until_aggregate_measurement';
    operatingPrinciple: 'measure_before_scaling_and_rank_before_commission';
    decisions: Array<{
      id: 'review-release-candidate' | 'choose-next-thesis' | 'establish-measurement' | 'configure-first-social-channel' | 'choose-affiliate-pilot';
      rank: number;
      priorityScore: number;
      horizon: 'now' | 'next' | 'later';
      category: 'release' | 'editorial_direction' | 'measurement' | 'distribution' | 'monetization';
      title: string;
      recommendation: string;
      decisionQuestion: string;
      rationale: string;
      evidence: string[];
      unlocks: string;
      tradeoff: string;
      guardrail: string;
      reversibility: 'high' | 'medium' | 'low';
      founderActionRequired: true;
      action: { label: string; url: string; command: string | null };
    }>;
  };
  researchRuns: number;
  validatedRuns: number;
  publicationReadyPosts: number;
  draftPosts: number;
  affiliateProgramsEnabled: number;
  affiliateProgramsProposed: number;
  affiliateProgramsFounderApproved: number;
  affiliateLinksLive: number;
  socialDrafts: number;
  socialApproved: number;
  socialPublished: number;
  approvedIdeas: number;
  proposedIdeas: number;
  pairingIdeas: number;
  recipientFrictionIdeas: number;
  researchMissions: {
    total: number;
    active: number;
    completed: number;
    founderReviewRequired: number;
    automaticMergeEligible: number;
    queue: Array<{
      missionId: string;
      recordSha256: string;
      status: 'started' | 'completed';
      ideaId: string;
      ideaTitle: string;
      ideaRevision: number;
      ideaSha256: string;
      createdAt: string;
      completedAt: string | null;
      workflowRunId: string;
      activeStage: 'research' | 'quality_review' | 'release_preparation' | 'growth_follow_up';
      runId: string | null;
      articleSlug: string | null;
      publicationReadiness: 'research_in_progress' | 'founder_review_required' | 'automatic_merge_eligible';
      nextGate: string;
    }>;
  };
  opportunityScouting: {
    enabled: boolean;
    cadence: 'weekly';
    posture: 'policy_disabled' | 'founder_backlog_full' | 'scout_active' | 'capacity_available';
    maxOpenProposals: number;
    openProposals: number;
    capacityRemaining: number;
    totalMissions: number;
    activeMissions: number;
    completedMissions: number;
    draftedReports: number;
    validatedReports: number;
    passedReviews: number;
    policy: {
      minimumResearchPasses: number;
      minimumSources: number;
      minimumSourceClasses: number;
      minimumPublicSocialOrCommunitySources: number;
      minimumCandidates: number;
      maximumCandidates: number;
      minimumSignals: number;
      minimumEvidenceConfidence: number;
      minimumThoughtfulnessPotential: number;
      diminishingReturnThreshold: number;
      socialEvidencePolicy: 'public_only_no_personal_identifiers';
    };
    queue: Array<{
      scoutId: string;
      missionRecordSha256: string;
      reportRecordSha256: string | null;
      status: 'started' | 'completed' | 'drafted' | 'validated';
      createdAt: string;
      completedAt: string | null;
      expectedProposalId: string;
      selectedProposalId: string | null;
      selectedTitle: string | null;
      candidates: number;
      sources: number;
      sourceClasses: number;
      publicSocialOrCommunitySources: number;
      evidenceConfidence: number | null;
      thoughtfulnessPotential: number | null;
      reviewVerdict: 'passed' | 'failed' | null;
      nextGate: string;
    }>;
  };
  affiliate: {
    proposedPrograms: number;
    founderApprovedPrograms: number;
    enabledPrograms: number;
    linkCandidates: number;
    linkReviewsPassed: number;
    linkApprovals: number;
    activeOverlays: number;
    approvedOverlaySetSha256: string;
    linkQueue: Array<{
      candidateId: string;
      candidateRevision: number;
      candidatePath: string;
      candidateSha256: string;
      articleSlug: string;
      productId: string;
      programId: string;
      programRevision: number;
      destinationHostname: string;
      createdAt: string;
      createdBy: string;
      stage: 'independent_review_required' | 'review_failed' | 'founder_approval_required' | 'approved_overlay';
      reviewVerdict: 'passed' | 'failed' | null;
      reviewPath: string | null;
      reviewSha256: string | null;
      reviewedAt: string | null;
      approvalPath: string | null;
      approvalSha256: string | null;
      approvedAt: string | null;
      nextGate: string;
    }>;
    programs: Array<{
      id: string;
      revision: number;
      name: string;
      status: 'proposed' | 'founder_approved' | 'enabled' | 'paused' | 'rejected';
      founderDisposition: 'proposed' | 'approved' | 'paused' | 'rejected';
      eligibleArticleSlugs: string[];
      editorialFit: string;
      limitations: string[];
      sourceCheckedAt: string;
      sourceReviewExpiresAt: string;
      programHomepageUrl: string;
      termsUrl: string;
      nextGate: string;
    }>;
  };
  social: {
    officialApiOnly: true;
    configSha256: string;
    channelsTotal: number;
    channelsConfigured: number;
    channelsActive: number;
    creativeCandidates: number;
    mediaAssetsApproved: number;
    approvalReceipts: number;
    publicationReceipts: number;
    publishReady: number;
    channels: Array<{
      id: 'pinterest' | 'instagram' | 'tiktok';
      priority: number;
      status: 'not_connected' | 'configured' | 'active' | 'paused';
      founderApproved: boolean;
      publishingEnabled: boolean;
      publisher: 'pinterest-api-v5' | 'meta-graph-api' | 'tiktok-content-posting-api' | null;
      configurationEvidenceUrl: string | null;
      configuredAt: string | null;
      activatedAt: string | null;
      maxPostsPerWeek: number;
      nextGate: string;
    }>;
    queue: Array<{
      postId: string;
      packId: string;
      packSha256: string;
      articleSlug: string;
      platform: 'pinterest' | 'instagram' | 'tiktok';
      format: string;
      headline: string;
      angle: string;
      status: 'draft' | 'creative_candidate' | 'media_approved' | 'approved' | 'published';
      creativeCandidateId: string | null;
      creativeCandidateRecordSha256: string | null;
      creativeCandidateAssetPath: string | null;
      creativeCandidateContentSha256: string | null;
      creativeCandidateGeneratedAt: string | null;
      creativeCandidateRightsPosture: string | null;
      creativeCandidateAltText: string | null;
      mediaAssetId: string | null;
      mediaAssetRecordSha256: string | null;
      approvalId: string | null;
      externalPostId: string | null;
      externalPostUrl: string | null;
      publicationReceiptId: string | null;
      publishReadiness: 'blocked_creative' | 'blocked_media_approval' | 'blocked_content_approval' | 'blocked_channel' | 'ready_for_official_api' | 'published';
      claimCount: number;
      productCount: number;
      pairCount: number;
      destinationUrl: string;
      nextGate: string;
    }>;
  };
  publication: {
    mode: 'founder_reviewed' | 'automatic_after_proven';
    automaticPromotionEnabled: boolean;
    verifiedSuccessfulReleaseCount: number;
    minimumSuccessfulFounderReviewedReleases: number;
    verifiedReleaseReceiptRequired: true;
    receiptRetentionDays: number;
    releaseEvidenceSource: 'github_production_deployments_at_enable_time';
    currentLive: {
      status: 'no_verified_managed_release' | 'verified_managed_content_release';
      updatedAt: string | null;
      receiptId: string | null;
      receiptSha256: string | null;
      receiptPath: string | null;
      releaseSha: string | null;
      workflowRunUrl: string | null;
      manifestId: string | null;
      contentSetSha256: string | null;
      articles: number;
      affiliateLinks: number;
      matchesCurrentCandidate: boolean;
    };
    currentCandidate: {
      status: 'release_candidate';
      manifestId: string;
      contentSetSha256: string;
      articles: number;
      independentReviews: number;
      socialLaunchPacks: number;
      socialDrafts: number;
      missionBoundArticles: number;
      preMissionValidatedArticles: number;
      affiliateLinks: number;
    };
  };
  growth: {
    configSha256: string;
    measurementStatus: 'not_connected' | 'awaiting_snapshot' | 'measured';
    connectorsTotal: number;
    connectorsConfigured: number;
    connectorsActive: number;
    snapshotCount: number;
    latestPeriodEnd: string | null;
    proposedExperiments: number;
    approvedExperiments: number;
    runningExperiments: number;
    searchConsole: {
      status: 'not_connected' | 'configured' | 'active' | 'paused';
      founderApproved: boolean;
      propertyReference: string | null;
      collectionMethod: 'search_console_api_page_aggregate' | 'manual_aggregate_export' | null;
      authenticationMode: 'github_oidc_workload_identity' | 'founder_export' | null;
      configurationEvidenceUrl: string | null;
      configuredAt: string | null;
      activatedAt: string | null;
      snapshotImportEnabled: boolean;
      automatedCollectionEnabled: boolean;
      nextGate: string;
    };
  };
  ideaStages: Array<{ ideaId: string; stage: string; nextGate: string }>;
  pipeline: Record<string, number>;
  alerts: string[];
}

export interface GrowthConnector {
  id: 'search-console' | 'web-analytics' | 'affiliate-reporting' | 'social-reporting';
  name: string;
  status: 'not_connected' | 'configured' | 'active' | 'paused';
  founderApproved: boolean;
  metrics: string[];
  sourceReference: string | null;
  collectionMethod: 'search_console_api_page_aggregate' | 'manual_aggregate_export' | null;
  authenticationMode: 'github_oidc_workload_identity' | 'founder_export' | null;
  credentialSecretNames: string[];
  configurationEvidenceUrl: string | null;
  configuredAt: string | null;
  activatedAt: string | null;
  snapshotImportEnabled: boolean;
  automatedCollectionEnabled: boolean;
  nextGate: string;
}

export interface GrowthSnapshotArticle {
  slug: string;
  searchImpressions?: number | null;
  organicClicks?: number | null;
  engagedSessions?: number | null;
  outboundMerchantClicks?: number | null;
  affiliateConversions?: number | null;
  revenueUsd?: number | null;
  socialImpressions?: number | null;
  socialEngagements?: number | null;
  ownedSiteClicks?: number | null;
}

export interface GrowthSnapshot {
  id: string;
  source: string;
  periodStart: string;
  periodEnd: string;
  collectedAt: string;
  reportingWindowDays: number;
  sourceConnectorIds: GrowthConnector['id'][];
  sourceEvidenceUrl: string;
  sourceArtifactSha256: string;
  articles: GrowthSnapshotArticle[];
}

export interface GrowthExperiment {
  id: string;
  status: 'proposed' | 'approved' | 'running' | 'completed' | 'stopped';
  founderDisposition: 'proposed' | 'approved' | 'paused' | 'rejected';
  title: string;
  hypothesis: string;
  channel: string;
  targetArticleSlugs: string[];
  primaryMetric: string;
  secondaryMetrics: string[];
  decisionRule: string;
  stopConditions: string[];
  sourceSnapshotIds: string[];
  createdAt: string;
  nextReviewAt: string;
}

export interface Growth {
  schemaVersion: '1.1.0';
  updatedAt: string;
  measurementPolicy: {
    aggregateOnly: true;
    unknownValuesAreNull: true;
    minimumReportingWindowDays: number;
    founderApproverLogin: string;
    privacyReview: {
      decisionId: string;
      status: 'approved';
      approvedBy: string;
      approvedAt: string;
      clientCollectionEnabled: boolean;
      consentRequiredBeforeClientCollection: true;
      approvedEventNames: Array<'gift_finder_guide_open' | 'guide_open' | 'merchant_outbound_click'>;
      baselineStatus: 'awaiting_observed_export' | 'observed';
      baselineWindowStartedAt: string | null;
      decisionSummary: string;
    };
    forbiddenFields: string[];
  };
  connectors: GrowthConnector[];
  snapshots: GrowthSnapshot[];
  experiments: GrowthExperiment[];
}
