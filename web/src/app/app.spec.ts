import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { ARTICLES, GROWTH, OPERATIONS, STRATEGY } from './generated/content.generated';
import { ArticlePage, FounderBriefPage, GiftFinderPage, PairCardComponent, ProductCardComponent, StudioPage } from './pages';
import { readerBodyComesFirst, readerBodyHtml, readerEvidenceHtml, readerLanguage, readerLead } from './reader-copy';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App, ArticlePage, StudioPage, FounderBriefPage, GiftFinderPage, ProductCardComponent, PairCardComponent], providers: [provideRouter([{ path: 'blog/:slug', component: ArticlePage }])] }).compileComponents();
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
    expect(image.alt.length).toBeGreaterThan(40);
    expect(image.getAttribute('aria-hidden')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('not a product photo');
    expect(fixture.nativeElement.textContent).toContain('A gift to consider');
    expect(fixture.nativeElement.textContent).not.toMatch(/Editorial \d+\/100/);
    expect(fixture.nativeElement.textContent).not.toMatch(/Evidence \d+\/100/);
    expect(link.dataset['articleSlug']).toBe(article.slug);
    expect(link.dataset['productId']).toBe(article.products[0].id);
    expect(link.dataset['paidLink']).toBe(String(article.products[0].affiliate));
    expect(link.href).toBe(article.products[0].url);
    expect(fixture.nativeElement.querySelectorAll('a')).toHaveLength(1);
  });

  it('opens every article with the person and explains each product pairing plainly', () => {
    for (const article of ARTICLES) {
      expect(readerLead(article)).toMatch(/^If you know someone/);
    }
    for (const article of ARTICLES) {
      for (const pair of article.pairs) {
        const fixture = TestBed.createComponent(PairCardComponent);
        fixture.componentRef.setInput('article', article);
        fixture.componentRef.setInput('pair', pair);
        fixture.detectChanges();
        const element = fixture.nativeElement as HTMLElement;
        const anchor = article.products.find((product) => product.id === pair.anchorProductId)!;
        const companion = article.products.find((product) => product.id === pair.companionProductId)!;
        const productLinks = element.querySelectorAll<HTMLAnchorElement>('[data-event-name="merchant_outbound_click"]');
        const pairImages = element.querySelectorAll<HTMLImageElement>('.pairing-context-visual img');
        expect(element.querySelectorAll('.reader-pair-product')).toHaveLength(2);
        expect(element.querySelectorAll('.product-caveat')).toHaveLength(2);
        expect(element.textContent).toContain(anchor.name);
        expect(element.textContent).toContain(companion.name);
        expect(element.textContent).toContain('Why this makes a good gift');
        expect(element.querySelector('.why-good-gift')?.getAttribute('aria-labelledby')).toBe(`${pair.id}-why-good-gift`);
        expect(element.textContent).toContain('Before you buy');
        expect(pairImages).toHaveLength(1);
        expect(pairImages[0].src).toContain('/blog-images/');
        expect((pairImages[0].getAttribute('alt') ?? '').length).toBeGreaterThan(40);
        expect(element.querySelector('.pairing-context-visual figcaption')?.textContent).toContain('not product photography');
        expect(Array.from(productLinks).map((link) => link.href)).toEqual([anchor.url, companion.url]);
        expect(element.querySelectorAll('a')).toHaveLength(2);
      }
    }
  });

  it('plainly labels a paid link inside a product pairing', () => {
    const article = ARTICLES.find((candidate) => candidate.pairs.length > 0)!;
    const pair = article.pairs[0];
    const paidArticle = {
      ...article,
      affiliateDisclosure: true,
      products: article.products.map((product) => product.id === pair.anchorProductId ? { ...product, affiliate: true } : product)
    };
    const fixture = TestBed.createComponent(PairCardComponent);
    fixture.componentRef.setInput('article', paidArticle);
    fixture.componentRef.setInput('pair', pair);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const links = element.querySelectorAll<HTMLAnchorElement>('[data-event-name="merchant_outbound_click"]');
    expect(links[0].textContent).toContain('(paid link)');
    expect(links[0].rel).toContain('sponsored');
    expect(links[0].rel).toContain('noopener');
    expect(links[0].dataset['paidLink']).toBe('true');
    expect(links[1].textContent).not.toContain('(paid link)');
  });

  it('renders the explanation before the visual shopping choices', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/blog/miniature-painting-wet-palette-recipe-pairs');
    await fixture.whenStable();
    fixture.detectChanges();
    const shell = fixture.nativeElement.querySelector('.article-shell') as HTMLElement;
    const specialtyLens = shell.querySelector('.specialty-lens') as HTMLElement;
    const explainer = shell.querySelector('.article-explainer') as HTMLElement;
    const pairings = shell.querySelector('.article-pairings') as HTMLElement;
    expect(specialtyLens).toBeTruthy();
    expect(specialtyLens.textContent).toContain('What they may already use');
    expect(specialtyLens.textContent).toContain('What this adds');
    expect(specialtyLens.textContent).toContain('The clue to look for');
    expect(explainer).toBeTruthy();
    expect(pairings).toBeTruthy();
    expect(Array.from(shell.children).indexOf(specialtyLens)).toBeLessThan(Array.from(shell.children).indexOf(explainer));
    expect(Array.from(shell.children).indexOf(explainer)).toBeLessThan(Array.from(shell.children).indexOf(pairings));
  });

  it('places a plain disclosure before a paid recommendation', async () => {
    const article = ARTICLES.find((candidate) => candidate.pairs.length > 0)!;
    const product = article.products.find((candidate) => candidate.id === article.pairs[0].anchorProductId)!;
    const originalDisclosure = article.affiliateDisclosure;
    const originalAffiliate = product.affiliate;
    article.affiliateDisclosure = true;
    product.affiliate = true;
    try {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      await TestBed.inject(Router).navigateByUrl(`/blog/${article.slug}`);
      await fixture.whenStable();
      fixture.detectChanges();
      const shell = fixture.nativeElement.querySelector('.article-shell') as HTMLElement;
      const disclosure = shell.querySelector('.disclosure') as HTMLElement;
      const recommendations = shell.querySelector('.article-pairings, .article-single-gifts') as HTMLElement;
      const paidLink = shell.querySelector<HTMLAnchorElement>('[data-paid-link="true"]')!;
      expect(disclosure.textContent).toContain('We may earn a commission');
      expect(Array.from(shell.children).indexOf(disclosure)).toBeLessThan(Array.from(shell.children).indexOf(recommendations));
      expect(paidLink.textContent).toContain('(paid link)');
      expect(paidLink.rel).toContain('sponsored');
      expect(paidLink.rel).toContain('noopener');
    } finally {
      article.affiliateDisclosure = originalDisclosure;
      product.affiliate = originalAffiliate;
    }
  });

  it('teaches an unfamiliar buyer what the miniature-painting gift is before presenting the products', () => {
    const article = ARTICLES.find((candidate) => candidate.slug === 'miniature-painting-wet-palette-recipe-pairs')!;
    const body = readerBodyHtml(article);
    expect(readerBodyComesFirst(article)).toBe(true);
    expect(body).toContain('What this gift actually is');
    expect(body).toContain('How it fits into their real life');
    expect(body).toContain('What they may already have');
    expect(body).toContain('What the specialty gift adds');
    expect(body).toContain('regular water-based acrylic');
    expect(body).toContain('We did not physically test these products');
    expect(body).not.toContain('strongest researched anchor');
    expect(body).not.toContain('qualified');
    expect(body).not.toContain('preserves the mix');
    expect(article.visual.hero.caption).toBe('The wet palette helps paint stay workable during the session; the notebook records the mix for next time.');
    expect(article.products.map((product) => product.whyItFits).join(' ')).not.toMatch(/keeps? regular acrylic paint moist/i);
  });

  it('explains every gift guide in plain language before presenting shopping choices', () => {
    const giftGuides = ARTICLES.filter((article) => article.products.length > 0);
    expect(giftGuides.length).toBeGreaterThanOrEqual(8);
    for (const article of giftGuides) {
      const body = readerBodyHtml(article);
      expect(article.readerFormat).toBe('recipient-specialty-v1');
      expect(article.readerIntro?.lead).toMatch(/^If you know someone/);
      expect(article.readerIntro?.bodyPlacement).toBe('before-products');
      expect(article.specialtyLens?.generalPurpose).toMatch(/^They may already/);
      expect(article.specialtyLens?.specialty.length).toBeGreaterThanOrEqual(50);
      expect(article.specialtyLens?.signal).toMatch(/^Look for/);
      expect(readerBodyComesFirst(article)).toBe(true);
      for (const heading of ['What this gift actually is', 'How it fits into their real life', 'What they may already have', 'What the specialty gift adds', 'Why this feels thoughtful', 'Before you order']) {
        expect(body.match(new RegExp(heading, 'g'))).toHaveLength(1);
      }
      expect(body).toMatch(/one gift (?:is|can be) enough/i);
      expect(body).not.toMatch(/coherence gate|editorial score|evidence score|candidate products|finalists?/i);
      for (const product of article.products) {
        expect(product.whyItFits.length).toBeGreaterThanOrEqual(80);
        expect(product.whyItFits).toMatch(/^What it is:/);
      }
    }
    const golf = giftGuides.find((article) => article.slug === 'gifts-for-a-golf-friend')!;
    expect(readerBodyHtml(golf)).toContain('<p>If you know someone');
    const readAndPlay = giftGuides.find((article) => article.slug === 'read-it-then-play-it-gift-pairs')!;
    expect(readerBodyHtml(readAndPlay)).not.toContain('Four pairs we left out');
    const readAndPlayEvidence = readerEvidenceHtml(readAndPlay);
    expect(readAndPlayEvidence).toContain('Sources behind the pairings');
    expect(readAndPlayEvidence).toContain('target="_blank" rel="noopener"');
    for (const product of readAndPlay.products) expect(readAndPlayEvidence).not.toContain(product.url);
    const productUrls = new Set(readAndPlay.products.map((product) => product.url.replaceAll('&amp;', '&')));
    const expectedSourceUrls = [...new Set([...readAndPlay.contentHtml.matchAll(/<a\b[^>]*\bhref=(?:"|')(https:[^"']+)(?:"|')[^>]*>/gi)]
      .map((match) => match[1].replaceAll('&amp;', '&'))
      .filter((url) => !productUrls.has(url)))];
    const renderedSourceUrls = [...readAndPlayEvidence.matchAll(/<a\b[^>]*\bhref=(?:"|')(https:[^"']+)(?:"|')[^>]*>/gi)]
      .map((match) => match[1].replaceAll('&amp;', '&'));
    expect(renderedSourceUrls).toEqual(expectedSourceUrls);
    expect(readerLanguage('advice from a qualified conservator')).toBe('advice from a qualified conservator');
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

  it('renders the exact editorial decision queue without self-approval', () => {
    const fixture = TestBed.createComponent(StudioPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const editorial = OPERATIONS.editorialReview;
    expect(element.textContent).toContain('Editorial decision queue');
    expect(element.textContent).toContain(`${editorial.counts.pendingBundles} exact bundle`);
    expect(element.textContent).toContain(`${editorial.counts.founderSafetyApprovalsPending} wording approval`);
    expect(element.textContent).toContain(`${editorial.counts.founderSafetyApprovalsRecorded} recorded`);
    expect(element.textContent).toContain(`${editorial.counts.independentReviewsRequired} fresh review`);
    expect(element.textContent).toContain('Nothing in this queue can publish itself.');
    expect(element.querySelectorAll('.editorial-review-card')).toHaveLength(editorial.queue.length);
    for (const review of editorial.queue) {
      expect(review.independentReviewRequired).toBe(true);
      expect(review.sourceSha256.run).toMatch(/^[a-f0-9]{64}$/);
      expect(review.sourceSha256.article).toMatch(/^[a-f0-9]{64}$/);
      expect(element.textContent).toContain(review.articleSlug);
      expect(element.textContent).toContain(review.sourceSha256.run);
      expect(element.textContent).toContain(review.sourceSha256.article);
      for (const blocker of review.blockers) expect(element.textContent).toContain(blocker);
      for (const claim of review.highRiskClaims) {
        expect(element.textContent).toContain(claim.id);
        expect(element.textContent).toContain(claim.text);
      }
    }
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
    expect(element.textContent).toContain(`${OPERATIONS.affiliate.publicationReadyProductLinksCataloged} publication-ready product links cataloged`);
    expect(element.textContent).toContain(`${OPERATIONS.affiliate.publicationReadyOrdinaryLinks} ordinary links`);
    expect(element.textContent).toContain(`${OPERATIONS.affiliate.productsAssignedToPartnerResearch}/${OPERATIONS.affiliate.publicationReadyProductLinksCataloged} assigned to partner research`);
    expect(element.textContent).toContain(`${OPERATIONS.affiliate.productsWithoutPartnerResearch} research gaps`);
    expect(element.querySelector(`a[href="${OPERATIONS.affiliate.productCoverageArtifactPath}"]`)).not.toBeNull();
    expect(element.textContent).toContain(`${OPERATIONS.affiliate.publicApplicationPacketsReady} public application packets ready`);
    expect(element.textContent).toContain(`${OPERATIONS.affiliate.externalEnrollmentAllowedByRegistry} eligible for external enrollment planning`);
    expect(element.textContent).toContain(`${OPERATIONS.affiliate.awaitingFounderProgramApproval} awaiting program approval`);
    expect(element.textContent).toContain('Every portal submission still requires action-time approval.');
    expect(element.textContent).toContain('portal submission requires action-time approval');
    expect(element.querySelector(`a[href="${OPERATIONS.affiliate.enrollmentReadinessArtifactPath}"]`)).not.toBeNull();
    expect(element.textContent).toContain(OPERATIONS.affiliate.siteApplicationDescription);
    expect(element.textContent).toContain(OPERATIONS.affiliate.sensitiveDataPolicy);
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
