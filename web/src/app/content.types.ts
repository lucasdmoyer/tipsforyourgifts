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

export interface ReaderIntro {
  lead: string;
  giftIdea: string;
  bodyPlacement: 'before-products';
}

export interface SpecialtyLens {
  generalPurpose: string;
  specialty: string;
  signal: string;
}

export interface VisualAsset {
  id: string;
  src: string;
  alt: string;
  caption: string;
}

export interface ArticleVisual {
  styleVersion: 'gift-thread-editorial-cartoon-v1.0';
  generator: 'openai-built-in-imagegen';
  rightsPosture: 'founder-approved-original-ai-generated';
  hero: VisualAsset;
  scenes: VisualAsset[];
  productSceneIds: Record<string, string>;
  pairSceneIds: Record<string, string>;
}

export interface ArticleSummary {
  slug: string;
  title: string;
  description: string;
  publishDate: string;
  status: 'publication_ready';
  audience: string;
  occasion: string;
  priceBand: string;
  tags: string[];
  researchRun: string;
  evidenceScore: number;
  featured: boolean;
  productCount: number;
  pairCount: number;
  paidLinkCount: number;
  visual: Pick<ArticleVisual, 'hero'>;
}

export interface RelatedGuide {
  slug: string;
  title: string;
  description: string;
  occasion: string;
  priceBand: string;
  visual: Pick<ArticleVisual, 'hero'>;
}

export interface ArticleJourney {
  path: { slug: string; title: string; description: string } | null;
  guides: RelatedGuide[];
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
  readerFormat?: 'recipient-specialty-v1';
  readerIntro?: ReaderIntro;
  specialtyLens?: SpecialtyLens;
  products: Product[];
  pairs: ProductPair[];
  visual: ArticleVisual;
  contentHtml: string;
}

export interface ArticlePageData extends Article {
  journey: ArticleJourney;
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

export type AutomationTeamStatus =
  | 'ready'
  | 'limited_live'
  | 'blocked_external_configuration'
  | 'blocked_founder_configuration'
  | 'manual_fallback_verified'
  | 'founder_approval_required';

export interface AutomationReadiness {
  schemaVersion: '1.2.0';
  observedAt: string;
  sourceMode: 'versioned_snapshot_not_live_poll';
  posture: 'founder_action_required';
  summary: string;
  counts: { teams: number; ready: number; limited: number; blocked: number; founderActions: number };
  teams: Array<{
    id: 'research-generation' | 'deterministic-quality' | 'affiliate-monetization' | 'social-distribution' | 'growth-measurement' | 'preview-delivery' | 'production-release' | 'automatic-publication';
    label: string;
    status: AutomationTeamStatus;
    evidence: string;
    nextAction: string;
    actionUrl: string | null;
    founderActionRequired: boolean;
  }>;
  externalGates: Array<{
    id: 'openai-platform-credential' | 'firebase-preview-identity' | 'firebase-auto-production-identity';
    label: string;
    status: 'blocked_external_configuration';
    summary: string;
    evidenceUrl: string;
    diagnosticUrl: string;
    nextAction: string;
    authorityBoundary: string;
  }>;
  latestVerifiedPreview: {
    status: 'exact_preview_verified';
    sha: string;
    pullRequestUrl: string;
    reviewUrl: string;
    previewUrl: string;
    immutableArtifact: {
      source: 'github_actions';
      workflowRunId: string;
      artifactId: string;
      sha256: string;
    } | null;
    summary: string;
    nextAction: string;
  };
}

export interface AiAutomationPolicy {
  schemaVersion: '1.2.0';
  status: 'awaiting_founder_platform_budget' | 'budget_approved_awaiting_credential' | 'credential_verified_awaiting_activation' | 'active';
  policySha256: string;
  budgetConfiguration: {
    available: boolean;
    workflowUrl: string;
    approvalIssueUrl: string;
    confirmation: 'CONFIGURE-ai-automation-budget';
    evidenceMode: 'founder_attested_external_platform_configuration';
    command: string;
  };
  credentialVerification: {
    available: boolean;
    workflowUrl: string;
    approvalIssueUrl: string;
    environmentSettingsUrl: string;
    confirmation: 'VERIFY-ai-automation-credential';
    method: 'openai_models_endpoint';
    endpoint: 'https://api.openai.com/v1/models';
    command: string;
  };
  policyActivation: {
    available: boolean;
    workflowUrl: string;
    approvalIssueUrl: string;
    confirmation: 'ACTIVATE-ai-automation';
    command: string;
  };
  activationReady: boolean;
  activationBlockers: string[];
  protectedWorkflows: number;
  protectedModelCalls: number;
  credential: {
    secretName: 'OPENAI_API_KEY';
    status: 'not_configured' | 'configured_external';
    scope: 'dedicated_openai_project';
    valueStoredInGit: false;
    verification: {
      status: 'not_verified' | 'verified_external';
      method: 'openai_models_endpoint' | null;
      endpoint: 'https://api.openai.com/v1/models' | null;
      verifiedAt: string | null;
      evidenceUrl: string | null;
      receiptPath: 'config/ai-credential-verification.json' | null;
      receiptSha256: string | null;
      responseBodyStored: false;
      modelCalled: false;
    };
  };
  spendControl: {
    status: 'not_configured' | 'configured_external';
    enforcement: 'openai_project_hard_spend_limit';
    monthlyBudgetUsd: number | null;
    hardLimitEnabled: boolean;
    alertThresholdUsd: number | null;
    evidenceUrl: string | null;
    repositoryHardCap: false;
    enforcementLagAcknowledged: true;
    documentationUrl: 'https://developers.openai.com/api/docs/guides/spend-limits';
    activationRule: string;
    recommendation: {
      status: 'planning_only_not_approved';
      monthlyHardLimitUsd: number;
      alertThresholdUsd: number;
      rationale: string;
      reviewedAt: string;
    };
  };
  runtime: {
    action: 'openai/codex-action@v1';
    documentationUrl: 'https://learn.chatgpt.com/docs/github-action';
    safetyStrategy: 'drop-sudo';
    sandbox: 'workspace-write';
    sessionMode: 'ephemeral';
    modelPolicy: 'gpt-6.2-sol';
    effortPolicy: 'high';
    trustedInitiators: 'repository_write_collaborators_and_bounded_github_automation';
  };
  authority: {
    modelJobGithubContents: 'read';
    modelJobCanWritePullRequests: false;
    detachedWriterJobsMayOpenProposalPullRequests: true;
    writerJobsReceiveOpenAiKey: false;
    canDeployFirebase: false;
    canActivateAffiliateLinks: false;
    canPublishSocialPosts: false;
    canSendEmail: false;
    canCreateCredentials: false;
  };
  workflows: Array<{
    file: string;
    codexJobs: string[];
    codexSteps: number;
    searchEnabled: boolean;
    githubActionsBotAllowed: boolean;
    purpose: string;
  }>;
  directApiWorkflows: Array<{
    file: 'visual-production.yml' | 'social-creative-production.yml';
    modelJobs: ['produce', 'independent_review'];
    modelSteps: 2;
    maximumApiCallsPerRun: 13 | 2;
    maximumGeneratedAssetsPerRun: 12 | 1;
    endpoint: 'https://api.openai.com/v1/responses';
    responseModel: 'gpt-6.2-sol';
    imageToolModel: 'gpt-image-2.5-sunburst-2026-09-08';
    commands: {
      produce: 'visual:produce' | 'social:creative:produce';
      independent_review: 'visual:review' | 'social:creative:review';
    };
    purpose: string;
  }>;
  shutdownConditions: string[];
}

export interface CommercialScorecard {
  status: 'awaiting_observed_export' | 'partial_observed_window' | 'complete_observed_window';
  evidenceStage: 'awaiting_observed_export' | 'reach_observed' | 'qualified_traffic_observed' | 'merchant_intent_observed' | 'affiliate_outcome_observed';
  periodStart: string | null;
  periodEnd: string | null;
  reportingWindowDays: number | null;
  snapshotIds: string[];
  sourceConnectorIds: GrowthConnector['id'][];
  articleCount: number;
  knownMetrics: string[];
  missingMetrics: string[];
  totals: {
    searchImpressions: number | null;
    organicClicks: number | null;
    engagedSessions: number | null;
    outboundMerchantClicks: number | null;
    affiliateConversions: number | null;
    revenueUsd: number | null;
    socialImpressions: number | null;
    socialEngagements: number | null;
    ownedSiteClicks: number | null;
  };
  rates: {
    organicClickThrough: number | null;
    merchantClickThrough: number | null;
    affiliateConversion: number | null;
    earningsPerOutboundClickUsd: number | null;
    revenuePerConversionUsd: number | null;
    socialOwnedClickThrough: number | null;
  };
  leaders: Record<'organicClicks' | 'outboundMerchantClicks' | 'affiliateConversions' | 'revenueUsd' | 'ownedSiteClicks', { slug: string; value: number } | null>;
  profitabilityConclusion: 'unknown_until_observed_revenue_and_cost_evidence' | 'unknown_until_operating_cost_evidence';
  nextGate: string;
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
  automationReadiness: AutomationReadiness;
  aiAutomationPolicy: AiAutomationPolicy;
  automationFailures: {
    total: number;
    queue: Array<{
      failureId: string;
      recordSha256: string;
      status: 'retry_required';
      stage: 'strategy_proposal' | 'growth_analysis' | 'affiliate_review' | 'editorial_review';
      reasonCode: 'runtime_policy_failed' | 'credential_preflight_failed' | 'model_step_failed' | 'output_invalid';
      recordedAt: string;
      workflowName: 'strategy-intake.yml' | 'growth-review.yml' | 'affiliate-link-review.yml' | 'editorial-independent-review.yml';
      workflowRunUrl: string;
      targetKind: 'founder_strategy_issue' | 'growth_snapshot' | 'affiliate_link_candidate' | 'editorial_run';
      targetId: string;
      targetUrl: string | null;
      nextGate: string;
    }>;
  };
  researchRuns: number;
  validatedRuns: number;
  publicationReadyPosts: number;
  draftPosts: number;
  affiliateProgramsEnabled: number;
  affiliateProgramsProposed: number;
  affiliateProgramsFounderApproved: number;
  affiliateProgramsExternallyVerified: number;
  affiliateLinksLive: number;
  socialDrafts: number;
  socialApproved: number;
  socialPublished: number;
  approvedIdeas: number;
  proposedIdeas: number;
  pairingIdeas: number;
  recipientFrictionIdeas: number;
  editorialReview: {
    schemaVersion: '1.2.0';
    counts: {
      pendingBundles: number;
      founderSafetyReviewsRequired: number;
      founderSafetyApprovalsCurrent: number;
      independentReviewsRequired: number;
      highRiskClaims: number;
    };
    queue: Array<{
      runId: string;
      ideaId: string;
      articleSlug: string;
      status: 'drafted' | 'qa_failed';
      reviewerId: string;
      blockers: string[];
      warnings: string[];
      failedReview: {
        missionId: string;
        failedAt: string;
        receiptPath: string;
        receiptSha256: string;
        reviewedAt: string;
        workflowRunUrl: string;
        correctionPullRequestSearchUrl: string;
      } | null;
      highRiskClaims: Array<{ id: string; text: string; sourceIds: string[] }>;
      founderDecisionPacket: {
        workflowUrl: string;
        approvalIssueUrl: string;
        rejectionIssueUrl: string;
        approveCommand: string;
        rejectCommand: string;
        authorityBoundary: string;
      } | null;
      founderSafetyReviewRequired: boolean;
      founderSafetyReviewStatus: 'not_required' | 'approval_required' | 'approved_current' | 'rejected_current' | 'stale';
      safetyApproval: {
        status: 'approved_current' | 'rejected_current' | 'stale';
        revision: number;
        decision: 'approved' | 'rejected';
        reviewedAt: string;
        path: string;
        sha256: string;
      } | null;
      independentReviewRequired: true;
      sourcePaths: { run: string; article: string; social: string | null };
      sourceSha256: { run: string; article: string; social: string | null };
      nextGate: string;
    }>;
  };
  researchMissions: {
    total: number;
    active: number;
    completed: number;
    researchFailed: number;
    reviewFailed: number;
    qaFailed: number;
    visualPending: number;
    visualFailed: number;
    founderReviewRequired: number;
    automaticMergeEligible: number;
    queue: Array<{
      missionId: string;
      recordSha256: string;
      status: 'started' | 'research_failed' | 'review_failed' | 'qa_failed' | 'visual_pending' | 'completed';
      ideaId: string;
      ideaTitle: string;
      ideaRevision: number;
      ideaSha256: string;
      createdAt: string;
      completedAt: string | null;
      workflowRunId: string;
      failureReasonCode: 'model_step_failed' | 'draft_bundle_invalid' | 'review_model_step_failed' | 'review_result_invalid' | 'production_step_failed' | 'production_bundle_invalid' | 'review_step_failed' | 'review_findings_invalid' | 'review_verdict_failed' | null;
      failureWorkflowRunUrl: string | null;
      activeStage: 'research' | 'quality_review' | 'visual_production' | 'release_preparation' | 'growth_follow_up';
      runId: string | null;
      articleSlug: string | null;
      publicationReadiness: 'research_in_progress' | 'research_failed' | 'review_failed' | 'qa_failed' | 'visual_pending' | 'visual_failed' | 'founder_review_required' | 'automatic_merge_eligible';
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
    discoveryFailedMissions: number;
    reviewFailedMissions: number;
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
      status: 'started' | 'discovery_failed' | 'review_failed' | 'completed' | 'drafted' | 'validated';
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
      failureReasonCode: 'discovery_model_step_failed' | 'discovery_bundle_invalid' | 'review_model_step_failed' | 'review_result_invalid' | null;
      failureWorkflowRunUrl: string | null;
      nextGate: string;
    }>;
  };
  affiliate: {
    proposedPrograms: number;
    founderApprovedPrograms: number;
    externallyVerifiedPrograms: number;
    enabledPrograms: number;
    publicationReadyProductLinksCataloged: number;
    publicationReadyPaidLinksVerified: number;
    publicationReadyOrdinaryLinks: number;
    productsAssignedToPartnerResearch: number;
    productsWithoutPartnerResearch: number;
    productCoverageArtifactPath: string;
    productCoverageDefinition: string;
    enrollmentReadinessArtifactPath: string;
    enrollmentReadinessDefinition: string;
    publicApplicationPacketsReady: number;
    externalEnrollmentAllowedByRegistry: number;
    externalSubmissionRequiresActionTimeApproval: true;
    awaitingFounderProgramApproval: number;
    externallyEnrolledPrograms: number;
    siteApplicationDescription: string;
    sensitiveDataPolicy: string;
    linkCandidates: number;
    linkReviewsPassed: number;
    linkApprovals: number;
    activeOverlays: number;
    approvedOverlaySetSha256: string;
    activationProposals: Array<{
      id: string;
      status: 'approval_boundary';
      activationState: 'awaiting_founder_terms_acceptance' | 'activation_recorded';
      programId: string;
      expectedProgramRevision: number;
      approvalBoundarySha256: string;
      activation: {
        allowedDomains: string[];
        registeredSite: string;
        trackingMethod: 'path_redirect_to_query';
        trackingPathPrefix: '/a/';
        trackingParameterKeys: ['affiliate'];
        reportingExportApproved: false;
        requiredDisclosure: string;
        priceFeedAuthorized: false;
      };
      evidence: {
        termsSourceUrl: string;
        termsResolvedUrl: string;
        termsLastUpdated: string;
        programExplanationUrl: string;
        linkGuideUrl: string;
        disclosureGuideUrl: string;
        observedAt: string;
        publicTrackingIdentity: string;
        publicStorefrontUrl: string;
        observedPaidUrl: string;
        observedResolvedUrl: string;
        productIsbn: string;
        productId: string;
        articleSlug: string;
        automatedFetchStatus: 403;
        destinationObservationMethod: 'authenticated_browser_observation';
        observationReceiptPath: string;
        observationReceiptSha256: string;
        observerId: string;
        purchaseActionLabel: string;
      };
      assertions: {
        programStillDisabledAtProposalCreation: true;
        termsNotRecordedAcceptedAtProposalCreation: true;
        paidLinkCandidateCreatedAtProposalCreation: false;
        activationCreatesPaidLink: false;
        productionDeploymentAuthorized: false;
        customerDataExportApproved: false;
      };
    }>;
    expansionRequests: Array<{
      id: string;
      status: 'awaiting_founder_scope_approval_and_partner_export' | 'scope_approved_awaiting_partner_export';
      programId: string;
      articleSlug: string;
      requestedProducts: number;
      catalogProductsVerified: number;
      paidUrlsCollected: number;
      currentArticleMatchesIndependentReview: boolean;
      nextGate: string;
    }>;
    reportingRequests: Array<{
      id: string;
      status: 'queued_behind_existing_program_revision';
      programId: string;
      observedProgramRevision: number;
      reservedExpansionRevision: number;
      earliestReportingRevision: number;
      blockedByExpansionRequestId: string;
      liveArticles: number;
      livePaidLinks: number;
      allowedMetrics: ['affiliateConversions', 'revenueUsd'];
      minimumWindowDays: number;
      customerDataAllowed: false;
      requestBoundarySha256: string;
      officialSources: {
        dashboardGuideUrl: string;
        reportingGuideUrl: string;
        viewsRemovalUrl: string;
      };
      nextGate: string;
    }>;
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
      originSource: 'founder_supplied' | 'founder_attested_partner_export';
      originReferenceId: string | null;
      originSourceArtifactPath: string | null;
      originSourceSha256: string | null;
      stage: 'independent_review_required' | 'review_failed' | 'founder_approval_required' | 'approved_overlay';
      reviewVerdict: 'passed' | 'failed' | null;
      reviewPath: string | null;
      reviewSha256: string | null;
      reviewedAt: string | null;
      approvalPath: string | null;
      approvalSha256: string | null;
      approvedAt: string | null;
      approvalIssueUrl: string | null;
      nextGate: string;
    }>;
    programs: Array<{
      id: string;
      revision: number;
      priority: number;
      coverageRole: 'category_specialist' | 'broad_catalog' | 'retailer_alternative' | 'marketplace_contingency';
      name: string;
      status: 'proposed' | 'founder_approved' | 'externally_verified' | 'enabled' | 'paused' | 'rejected';
      founderDisposition: 'proposed' | 'approved' | 'paused' | 'rejected';
      eligibleArticleSlugs: string[];
      productSelectionMode: 'explicit_products' | 'all_products_in_eligible_articles' | 'all_publication_ready_products';
      productResearchCandidates: number;
      verifiedPaidLinks: number;
      enrollmentStage: 'founder_approval_required' | 'external_enrollment_required' | 'activation_evidence_required' | 'exact_link_research' | 'paused' | 'rejected';
      publicApplicationPacketReady: boolean;
      externalEnrollmentAllowedByRegistry: boolean;
      externalSubmissionStillRequiresActionTimeApproval: true;
      externalAccountEstablished: boolean;
      trackingIdentityConfigured: boolean;
      verificationStatus: 'not_started' | 'requested' | 'verified';
      publicTrackingIdentity: string | null;
      publicStorefrontUrl: string | null;
      weeklyReportsEnabled: boolean;
      applicationPositioning: string;
      userOnlyInputs: Array<'account_login' | 'operator_identity_contact' | 'tax_profile_if_requested' | 'payout_profile_if_requested' | 'public_social_account_selection' | 'ai_tools_written_approval_request'>;
      specialRequirements: string[];
      stopConditions: string[];
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
    creativeProductionWorkflowUrl: string;
    nextCreativePostId: string | null;
    channelsTotal: number;
    channelsConfigured: number;
    channelsActive: number;
    creativeCandidates: number;
    creativeFailures: number;
    creativeFailureReceipts: Array<{
      failureId: string;
      postId: string;
      stage: 'production' | 'independent-review';
      reasonCode: string;
      failedAt: string;
      nextGate: string;
    }>;
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
    durableVerifiedFounderReviewedReleaseCount: number;
    minimumSuccessfulFounderReviewedReleases: number;
    verifiedReleaseReceiptRequired: true;
    receiptRetentionDays: number;
    releaseEvidenceSource: 'github_production_deployments_at_enable_time';
    durableReceiptEvidenceSource: 'repository_verified_publication_receipts';
    exactReleaseApprovals: {
      total: number;
      active: number;
      currentContentSetApprovedRelease: {
        approvalId: string;
        approvalRecordPath: string;
        approvalRecordSha256: string;
        pullRequestNumber: number;
        pullRequestUrl: string;
        headSha: string;
        manifestId: string;
        contentSetSha256: string;
        approvedBy: string;
        approvedAt: string;
        evidenceUrl: string;
        previewUrl: string;
        scope: 'approved_for_exact_head_merge_only';
        nextGate: string;
      } | null;
    };
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
      founderSafetyApprovals: number;
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
    commercialScorecard: CommercialScorecard;
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
