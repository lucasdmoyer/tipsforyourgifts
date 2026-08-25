import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { ARTICLES, GROWTH, OPERATIONS, STRATEGY } from './generated/content.generated';
import { FounderBriefPage, GiftFinderPage, ProductCardComponent, StudioPage } from './pages';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App, StudioPage, FounderBriefPage, GiftFinderPage, ProductCardComponent], providers: [provideRouter([])] }).compileComponents();
  });

  it('renders the editorial brand and primary navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.brand')?.textContent).toContain('Tips for Your Gifts');
    expect(element.querySelectorAll('.nav-links a')).toHaveLength(4);
    expect(element.querySelector('a[href="/gift-finder"]')?.textContent).toContain('Gift finder');
    expect(element.querySelector('a[href="/studio"]')).toBeNull();
  });

  it('ships a founder-approved visual for every public article, product, and pair', () => {
    expect(ARTICLES.length).toBeGreaterThan(0);
    for (const article of ARTICLES) {
      expect(article.visual.styleVersion).toBe('gift-thread-editorial-cartoon-v1.0');
      expect(article.visual.generator).toBe('openai-built-in-imagegen');
      expect(article.visual.rightsPosture).toBe('founder-approved-original-ai-generated');
      expect(article.visual.hero.src).toMatch(/^\/blog-images\/.+\.webp$/);
      expect(article.visual.hero.alt.length).toBeGreaterThan(40);
      for (const product of article.products) {
        const sceneId = article.visual.productSceneIds[product.id];
        expect(article.visual.scenes.some((scene) => scene.id === sceneId)).toBe(true);
      }
      for (const pair of article.pairs) {
        const sceneId = article.visual.pairSceneIds[pair.id];
        expect(article.visual.scenes.some((scene) => scene.id === sceneId)).toBe(true);
      }
    }
  });

  it('renders a person-first finder from the publication-ready catalog', () => {
    const fixture = TestBed.createComponent(GiftFinderPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Who are they when no one is shopping for them?');
    expect(element.textContent).toContain('Do not invent a new person for them.');
    expect(element.querySelectorAll('.finder-result').length).toBeGreaterThanOrEqual(3);
    const finderLinks = element.querySelectorAll<HTMLAnchorElement>('[data-event-name="gift_finder_guide_open"]');
    expect(finderLinks).toHaveLength(element.querySelectorAll('.finder-result').length);
    expect(finderLinks[0].dataset['guideSlug']).toBeTruthy();
    expect(finderLinks[0].dataset['resultRank']).toBe('1');
    expect(element.textContent).toContain('These are starting points, not personality predictions.');
    expect(element.querySelector('[data-event-name="merchant_outbound_click"]')).toBeNull();
  });

  it('labels merchant intent without adding an analytics client', () => {
    const article = ARTICLES.find((candidate) => candidate.products.length > 0)!;
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', article.products[0]);
    fixture.componentRef.setInput('articleSlug', article.slug);
    const sceneId = article.visual.productSceneIds[article.products[0].id];
    fixture.componentRef.setInput('visual', article.visual.scenes.find((scene) => scene.id === sceneId) ?? article.visual.hero);
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('.product-context-visual img') as HTMLImageElement;
    const link = fixture.nativeElement.querySelector('[data-event-name="merchant_outbound_click"]') as HTMLAnchorElement;
    expect(image.src).toContain('/blog-images/');
    expect(image.alt).toBe('');
    expect(image.getAttribute('aria-hidden')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('shows the use, not the exact product');
    expect(fixture.nativeElement.textContent).toContain('The thought behind it');
    expect(fixture.nativeElement.textContent).not.toMatch(/Editorial \d+\/100/);
    expect(fixture.nativeElement.textContent).not.toMatch(/Evidence \d+\/100/);
    expect(link.dataset['articleSlug']).toBe(article.slug);
    expect(link.dataset['productId']).toBe(article.products[0].id);
    expect(link.dataset['paidLink']).toBe(String(article.products[0].affiliate));
    expect(link.href).toBe(article.products[0].url);
  });

  it('renders the aggregate-only growth and experiment controls', () => {
    const fixture = TestBed.createComponent(StudioPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Measure first. Scale what earns attention.');
    expect(element.textContent).toContain('Personal data stored');
    const connectorLists = element.querySelectorAll('.connector-list');
    expect(connectorLists[connectorLists.length - 1].querySelectorAll('.connector-row')).toHaveLength(OPERATIONS.growth.connectorsTotal);
    const experimentGrids = element.querySelectorAll('.experiment-grid');
    expect(experimentGrids[experimentGrids.length - 1].querySelectorAll('.experiment-card')).toHaveLength(GROWTH.experiments.length);
  });

  it('renders the founder strategy intake and approval controls', () => {
    const fixture = TestBed.createComponent(StudioPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Ideas flow in. Authority stays separated.');
    expect(element.textContent).toContain('Strategy proposals');
    expect(element.querySelector('a[href*="strategy-approval.yml"]')).not.toBeNull();
    expect(element.querySelector('a[href*="strategy-idea.yml"]')).not.toBeNull();
    expect(element.querySelector('a[href="/studio/brief"]')?.textContent).toContain('Compose a thoughtful brief');
    const proposedIdeas = STRATEGY.ideas.filter((idea) => idea.founderDisposition === 'proposed').sort((left, right) => ({ high: 0, medium: 1, low: 2 }[left.priority] ?? 3) - ({ high: 0, medium: 1, low: 2 }[right.priority] ?? 3) || (right.pairing?.coherenceScore ?? 0) - (left.pairing?.coherenceScore ?? 0) || left.id.localeCompare(right.id));
    if (proposedIdeas[0]) {
      expect(element.textContent).toContain(`${proposedIdeas.length} thoughtful ${proposedIdeas.length === 1 ? 'thesis awaits' : 'theses await'} your decision`);
      expect(element.textContent).toContain(`gh workflow run strategy-approval.yml -f idea_id=${proposedIdeas[0].id} -f expected_revision=${proposedIdeas[0].revision}`);
      expect(element.textContent).toContain(proposedIdeas[0].title);
    }
    expect(element.textContent).toContain(`Publication mode: ${OPERATIONS.publication.mode.replaceAll('_', ' ')}`);
    expect(element.textContent).toContain(`policy snapshot ${OPERATIONS.publication.verifiedSuccessfulReleaseCount}/${OPERATIONS.publication.minimumSuccessfulFounderReviewedReleases}`);
    expect(element.textContent).toContain('recounts unique successful GitHub production deployments');
    expect(element.querySelector('a[href*="publication-policy-enable.yml"]')).not.toBeNull();
    expect(element.querySelector('a[href*="firebase-production.yml"]')).not.toBeNull();
    expect(element.textContent).toContain('pauses with its preview URL for production approval');
    expect(element.textContent).toContain('promotes the same static artifact');
    expect(element.textContent).toContain('Current release candidate: publication-set-');
    const candidate = OPERATIONS.publication.currentCandidate;
    expect(element.textContent).toContain(`${candidate.articles} articles · ${candidate.independentReviews} independent receipts · ${candidate.socialLaunchPacks} launch packs · ${candidate.socialDrafts} social drafts · ${candidate.affiliateLinks} affiliate links`);
    expect(element.textContent).toContain('prepared bytes; it is not proof of a live deployment');
    expect(element.textContent).toContain('Exact candidate content digest');
    if (OPERATIONS.publication.currentLive.status === 'verified_managed_content_release') {
      expect(element.textContent).toContain(`Git-recorded live content: ${OPERATIONS.publication.currentLive.manifestId}`);
      expect(element.textContent).toContain(`candidate match ${OPERATIONS.publication.currentLive.matchesCurrentCandidate ? 'yes' : 'no'}`);
      expect(element.querySelector(`a[href="${OPERATIONS.publication.currentLive.workflowRunUrl}"]`)).not.toBeNull();
    } else {
      expect(element.textContent).toContain('no verified managed release is recorded');
      expect(element.textContent).toContain('legacy or out-of-band state remains unknown');
    }
    expect(element.textContent).toContain('machine-validated receipt retained for 90 days');
  });

  it('renders the fail-closed founder brief builder', () => {
    const fixture = TestBed.createComponent(FounderBriefPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Notice the gift before naming the product.');
    expect(element.textContent).toContain('1/12 complete');
    expect(element.textContent).toContain('Complete the missing decisions');
    expect(element.querySelector('a[href*="github.com/lucasdmoyer/tipsforyourgifts/issues/new"]')).toBeNull();
    expect(element.textContent).toContain('proposal workflow');
  });

  it('renders a ranked evidence-backed founder agenda', () => {
    const fixture = TestBed.createComponent(StudioPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const agenda = OPERATIONS.founderAgenda;
    expect(element.textContent).toContain(`${agenda.decisions.length} ${agenda.decisions.length === 1 ? 'decision' : 'decisions'}. One clear order.`);
    expect(element.textContent).toContain('Profitability remains unknown until aggregate measurement.');
    for (const decision of agenda.decisions) {
      expect(element.textContent).toContain(`Decision ${decision.rank} · ${decision.category.replaceAll('_', ' ')}`);
      expect(element.textContent).toContain(decision.title);
      expect(element.textContent).toContain(decision.recommendation);
      if (decision.action.command) expect(element.textContent).toContain(decision.action.command);
      expect(element.querySelector(`a[href="${decision.action.url}"]`)).not.toBeNull();
    }
    expect(element.querySelectorAll('.agenda-card')).toHaveLength(Math.max(0, agenda.decisions.length - 1));
  });

  it('renders the fail-closed autonomous opportunity desk', () => {
    const fixture = TestBed.createComponent(StudioPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Autonomous opportunity desk');
    expect(element.textContent).toContain('Deep weekly research. One proposal at a time.');
    expect(element.textContent).toContain(`${OPERATIONS.opportunityScouting.openProposals}/${OPERATIONS.opportunityScouting.maxOpenProposals} founder proposals open.`);
    if (OPERATIONS.opportunityScouting.posture === 'founder_backlog_full') expect(element.textContent).toContain('The weekly run stops before calling a model.');
    else expect(element.textContent).toContain(`${OPERATIONS.opportunityScouting.capacityRemaining} proposal slot`);
    expect(element.textContent).toContain('10+ public sources');
    expect(element.textContent).toContain('80+ thoughtful');
    expect(element.querySelector('a[href*="opportunity-scout.yml"]')).not.toBeNull();
  });

  it('renders fail-closed affiliate and social approval operations', () => {
    const fixture = TestBed.createComponent(StudioPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain(`${OPERATIONS.affiliate.proposedPrograms} programs proposed. ${OPERATIONS.affiliate.activeOverlays} paid links active.`);
    expect(element.textContent).toContain(`${OPERATIONS.affiliate.linkCandidates} exact candidates · ${OPERATIONS.affiliate.linkReviewsPassed} clean independent reviews · ${OPERATIONS.affiliate.linkApprovals} founder approvals.`);
    expect(element.textContent).toContain(`${OPERATIONS.social.channelsActive}/${OPERATIONS.social.channelsTotal} channels active.`);
    expect(element.textContent).toContain(`Open the ${OPERATIONS.social.queue.length}-post approval queue`);
    expect(element.querySelector('a[href*="affiliate-program-approval.yml"]')).not.toBeNull();
    expect(element.querySelector('a[href*="affiliate-program-activate.yml"]')).not.toBeNull();
    expect(element.querySelector('a[href*="affiliate-link-candidate.yml"]')).not.toBeNull();
    expect(element.querySelector('a[href*="affiliate-link-review.yml"]')).not.toBeNull();
    expect(element.querySelector('a[href*="affiliate-link-approval.yml"]')).not.toBeNull();
    expect(element.textContent).toContain(OPERATIONS.affiliate.approvedOverlaySetSha256);
    expect(element.querySelector('a[href*="social-channel-configure.yml"]')).not.toBeNull();
    expect(element.querySelector('a[href*="social-channel-activate.yml"]')).not.toBeNull();
    expect(element.querySelector('a[href*="social-media-approval.yml"]')).not.toBeNull();
    expect(element.querySelector('a[href*="social-content-approval.yml"]')).not.toBeNull();
    expect(element.querySelector('a[href*="social-pinterest-publish.yml"]')).not.toBeNull();
    expect(element.textContent).toContain(`${OPERATIONS.social.creativeCandidates} original creative candidates · ${OPERATIONS.social.mediaAssetsApproved} approved media · ${OPERATIONS.social.approvalReceipts} content receipts · ${OPERATIONS.social.publishReady} ready for official API.`);
    expect(element.textContent).toContain(OPERATIONS.social.configSha256);
    const visualCandidate = OPERATIONS.social.queue.find((post) => post.creativeCandidateAssetPath);
    if (visualCandidate) {
      expect(element.querySelector(`img[src="${visualCandidate.creativeCandidateAssetPath}"]`)).not.toBeNull();
      expect(element.textContent).toContain('generated, locally verified, not rights-approved or published');
    }
  });

  it('renders the hash-bound research mission operating model', () => {
    const fixture = TestBed.createComponent(StudioPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Research mission control');
    expect(element.textContent).toContain('One founder decision. Four accountable roles.');
    expect(element.textContent).toContain('Research editorial team');
    expect(element.textContent).toContain('Independent evidence editor');
    expect(element.textContent).toContain('Release operator');
    expect(element.textContent).toContain('Growth analyst');
    expect(element.textContent).toContain(`${OPERATIONS.researchMissions.completed} completed · ${OPERATIONS.researchMissions.active} active`);
    if (OPERATIONS.researchMissions.queue.length === 0) expect(element.textContent).toContain('No automated mission has completed yet.');
    else expect(element.textContent).toContain(OPERATIONS.researchMissions.queue[0].missionId);
  });
});
