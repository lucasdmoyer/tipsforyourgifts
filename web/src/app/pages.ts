import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Article, Product, StrategyIdea } from './content.types';
import { ContentService } from './content.service';
import { SeoService } from './seo.service';

@Component({
  selector: 'tfg-article-card',
  imports: [DatePipe, RouterLink],
  template: `
    <article class="article-card">
      <div class="meta">
        <time [attr.datetime]="article().publishDate">{{ article().publishDate | date: 'MMM d, y': 'UTC' }}</time>
        <span>·</span><span>{{ article().audience }}</span>
      </div>
      <h3><a [routerLink]="['/blog', article().slug]">{{ article().title }}</a></h3>
      <p>{{ article().description }}</p>
      <div>
        @for (tag of article().tags.slice(0, 3); track tag) { <span class="tag">{{ tag }}</span> }
      </div>
      <a class="read" [routerLink]="['/blog', article().slug]">Read the guide →</a>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArticleCardComponent { readonly article = input.required<Article>(); }

@Component({
  selector: 'tfg-product-card',
  template: `
    <article class="product-card" [id]="product().id">
      <p class="eyebrow">Researched recommendation</p>
      <h3>{{ product().name }}</h3>
      <p>{{ product().whyItFits }}</p>
      <div class="scores" aria-label="Recommendation scores">
        <span class="score">Editorial {{ product().editorialScore }}/100</span>
        <span class="score">Evidence {{ product().evidenceConfidence }}/100</span>
      </div>
      <p class="drawback"><strong>Know before buying:</strong> {{ product().drawback }}</p>
      <p class="quiet">Merchant: {{ product().merchant }} @if (product().priceBand) { · {{ product().priceBand }} }</p>
      <a class="button" [href]="product().url" target="_blank" [attr.rel]="product().affiliate ? 'sponsored noopener' : 'noopener'">
        Check with {{ product().merchant }}{{ product().affiliate ? ' (paid link)' : '' }}
      </a>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardComponent { readonly product = input.required<Product>(); }

@Component({
  imports: [RouterLink, ArticleCardComponent],
  template: `
    <section class="shell hero">
      <div>
        <p class="eyebrow">Make the gift feel obvious</p>
        <h1>Good gifts, minus the guesswork.</h1>
        <p class="lede">We turn scattered reviews, product facts, real-world concerns, and budget tradeoffs into useful recommendations you can trust.</p>
        <div class="actions">
          <a class="button" routerLink="/gifts">Explore gift guides</a>
          <a class="button secondary" routerLink="/standards">See how we research</a>
        </div>
      </div>
      <div class="gift-stack" aria-hidden="true">
        <div class="gift-card-visual">
          <span class="visual-label">THE GIFT TEST</span>
          <p class="visual-quote">Would we still recommend it with no commission attached?</p>
          <div class="visual-meta"><span>Useful</span><span>Defensible</span><span>Delightful</span></div>
        </div>
      </div>
    </section>

    <section class="section mint-section">
      <div class="shell">
        <div class="section-heading">
          <div><p class="eyebrow">The standard</p><h2>Advice that earns the click.</h2></div>
          <p>Every product must clear a minimum editorial score, cite current evidence, name at least one drawback, and remain worthy when the affiliate link is removed.</p>
        </div>
        <div class="grid three">
          <div class="panel"><span class="number">12+</span><h3>candidate products</h3><p>Roundups begin broad, then narrow through repeat research passes.</p></div>
          <div class="panel"><span class="number">75</span><h3>minimum editorial score</h3><p>Commission never changes the ranking. Reader fit and evidence lead.</p></div>
          <div class="panel"><span class="number">2×</span><h3>independent review</h3><p>The drafting agent cannot certify its own claims or compliance.</p></div>
        </div>
      </div>
    </section>

    <section class="shell section">
      <div class="section-heading">
        <div><p class="eyebrow">Fresh from the desk</p><h2>Guides with receipts.</h2></div>
        <a routerLink="/blog">View every article →</a>
      </div>
      <div class="grid three">
        @for (post of content.articles.slice(0, 3); track post.slug) { <tfg-article-card [article]="post" /> }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage {
  readonly content = inject(ContentService);
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({
      title: 'Tips for Your Gifts',
      description: 'Evidence-backed gift guides with honest tradeoffs, transparent affiliate disclosures, and no fake testing.',
      path: '/',
      structuredData: {
        '@context': 'https://schema.org', '@type': 'WebSite', name: 'Tips for Your Gifts',
        url: 'https://tipsforyourgifts.web.app',
        description: 'Evidence-backed gift guides with honest tradeoffs and transparent affiliate disclosures.'
      }
    });
  }
}

@Component({
  imports: [RouterLink, ArticleCardComponent],
  template: `
    <section class="shell section">
      <p class="eyebrow">Gift guides</p>
      <h1>Fewer lists. Better reasons.</h1>
      <p class="lede">A guide only appears here after its product set, sources, drawbacks, merchant links, and disclosures pass validation.</p>
      @if (guides.length > 0) {
        <div class="grid three spaced-grid">
          @for (post of guides; track post.slug) { <tfg-article-card [article]="post" /> }
        </div>
      } @else {
        <div class="panel empty-panel">
          <p class="eyebrow">Research in progress</p>
          <h2>The first product roundup is still at the evidence gate.</h2>
          <p>That is intentional. We will not publish placeholder products, invented affiliate links, or merchant copy just to make this page look full.</p>
          <a class="button" routerLink="/standards">Review the gate</a>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GiftsPage {
  private readonly content = inject(ContentService);
  readonly guides = this.content.articles.filter((article) => article.products.length > 0);
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Gift guides', description: 'Gift recommendations selected with transparent evidence standards, independent quality review, and honest drawbacks.', path: '/gifts' });
  }
}

@Component({
  imports: [ArticleCardComponent],
  template: `
    <section class="shell section">
      <p class="eyebrow">The research journal</p>
      <h1>Every guide starts with a question.</h1>
      <p class="lede">We publish fewer, stronger pages: original analysis, dated evidence, honest drawbacks, and clear disclosure when a link may earn money.</p>
      <div class="grid three spaced-grid">
        @for (post of content.articles; track post.slug) { <tfg-article-card [article]="post" /> }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlogPage {
  readonly content = inject(ContentService);
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Gift research journal', description: 'Browse evidence-backed gift guides, decision frameworks, and transparent research notes from Tips for Your Gifts.', path: '/blog' });
  }
}

@Component({
  imports: [DatePipe, RouterLink, ProductCardComponent],
  template: `
    @if (article) {
      <article class="article-shell">
        <p class="eyebrow">{{ article.occasion }} · {{ article.priceBand }}</p>
        <h1>{{ article.title }}</h1>
        <p class="dek">{{ article.description }}</p>
        <div class="meta-row">
          <time [attr.datetime]="article.publishDate">Published {{ article.publishDate | date: 'MMMM d, y': 'UTC' }}</time>
          <span>·</span><span>{{ evidenceMode }}</span>
          <span>·</span><span>Evidence {{ article.evidenceScore }}/100</span>
        </div>
        @if (article.affiliateDisclosure) {
          <aside class="disclosure"><strong>Affiliate disclosure:</strong> We may earn a commission when you purchase through links on this page. Recommendations are selected using our published research method.</aside>
        }
        <div class="prose" [innerHTML]="article.contentHtml"></div>
        @if (article.products.length > 0) {
          <section aria-labelledby="recommendations">
            <h2 id="recommendations">The recommendations</h2>
            <div class="product-list">
              @for (product of article.products; track product.id) { <tfg-product-card [product]="product" /> }
            </div>
          </section>
        }
        @if (article.pairs.length > 0) {
          <section aria-labelledby="pairings" class="article-pairings">
            <p class="eyebrow">More than a bundle</p>
            <h2 id="pairings">Gift pairs that make each other better</h2>
            <div class="product-list">
              @for (pair of article.pairs; track pair.id) {
                <article class="product-card pairing-product-card">
                  <p class="eyebrow">Pair coherence {{ pair.coherenceScore }}/100</p>
                  <h3>{{ pair.name }}</h3>
                  <p><strong>{{ productName(pair.anchorProductId) }}</strong> + <strong>{{ productName(pair.companionProductId) }}</strong></p>
                  <p>{{ pair.whyTogether }}</p>
                  <p><strong>Use them together:</strong> {{ pair.interactionMoment }}</p>
                  <p><strong>Check before buying:</strong> {{ pair.preGiftCheck }}</p>
                  <p class="drawback"><strong>When the pair is too much:</strong> {{ pair.bundleDrawback }}</p>
                </article>
              }
            </div>
          </section>
        }
        <hr class="article-rule">
        <p class="quiet">Research run: {{ article.researchRun }}. This identifier links the published page to its versioned source and quality report.</p>
        <p class="quiet">This guide contains {{ documentedSections }} documented sections.</p>
      </article>
    } @else {
      <section class="shell section">
        <p class="eyebrow">404</p><h1>That guide is hiding.</h1>
        <p class="lede">It moved, retired, or never cleared the evidence gate.</p>
        <a class="button" routerLink="/blog">Return to the journal</a>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArticlePage {
  private readonly route = inject(ActivatedRoute);
  private readonly content = inject(ContentService);
  private readonly seo = inject(SeoService);
  readonly article = this.content.getArticle(this.route.snapshot.paramMap.get('slug'));
  readonly evidenceMode = this.article?.evidenceMode.replaceAll('_', ' ') ?? '';
  readonly documentedSections = this.article?.contentHtml.match(/<h[23]/g)?.length ?? 0;
  productName(productId: string) { return this.article?.products.find((product) => product.id === productId)?.name ?? productId; }

  constructor() {
    if (!this.article) {
      this.seo.set({ title: 'Guide not found', description: 'The requested gift guide could not be found.', path: this.route.snapshot.url.join('/'), noindex: true });
      return;
    }
    const path = `/blog/${this.article.slug}`;
    this.seo.set({
      title: this.article.title,
      description: this.article.description,
      path,
      type: 'article',
      structuredData: {
        '@context': 'https://schema.org', '@type': 'Article', headline: this.article.title,
        description: this.article.description, datePublished: this.article.publishDate,
        dateModified: this.article.updatedDate,
        author: { '@type': 'Organization', name: 'Tips for Your Gifts Editorial Team' },
        publisher: { '@type': 'Organization', name: 'Tips for Your Gifts' },
        mainEntityOfPage: `https://tipsforyourgifts.web.app${path}`, about: this.article.tags
      }
    });
  }
}

@Component({
  template: `
    <article class="article-shell">
      <p class="eyebrow">The research standard</p>
      <h1>Trust is the product.</h1>
      <p class="dek">AI helps us search broadly and organize evidence. It does not get to invent experience, certify its own work, or trade a better commission for a better ranking.</p>
      <div class="prose">
        <h2>What a serious roundup requires</h2>
        <ul>
          <li>At least 12 candidate products and five qualified finalists.</li>
          <li>Five source classes: official product facts, seller policies, independent reviews, public consumer discussion, and relevant safety or recall authorities.</li>
          <li>At least three research passes, ending only after two consecutive passes add little material information.</li>
          <li>A documented benefit and drawback for every finalist.</li>
          <li>An editorial score of at least 75 and evidence confidence of at least 70.</li>
        </ul>
        <h2>What we will never claim</h2>
        <p>If we did not physically test a product, we do not say “we tested,” “we used,” or imply personal ownership. Desk research can still be useful, but it must be labeled honestly and connected to its dated sources.</p>
        <h2>How affiliate links work</h2>
        <p>Editorial ranking is completed before commission is considered. Paid links are a separate overlay: one exact candidate, one independent destination-and-product review, and one founder approval must all stay hash-bound to the unchanged editorial winner. If any link evidence drifts, we omit the paid tracking rather than inventing it.</p>
        <h2>How publishing works</h2>
        <p>The research agent creates a versioned evidence bundle and article draft. A separate quality role challenges the claims. Deterministic checks validate source coverage, scores, link policy, metadata, structured content, and the static build. Only then can the exact Git commit move to a Firebase preview and publication approval.</p>
        <blockquote>A model finishing its response is not a publication event. Passing the evidence and release gates is.</blockquote>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StandardsPage {
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Our research standards', description: 'The evidence, editorial, affiliate, and publication gates behind every Tips for Your Gifts recommendation.', path: '/standards', structuredData: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Tips for Your Gifts research standards' } });
  }
}

@Component({
  template: `
    <article class="article-shell">
      <p class="eyebrow">Disclosure</p><h1>How the business earns.</h1>
      <div class="prose">
        <p>Tips for Your Gifts may earn a commission when you purchase through certain links. When that applies, the article includes a clear disclosure before its recommendations and paid links are identified near the action.</p>
        <p>Affiliate relationships do not determine which products qualify or how they rank. A product must meet the same evidence and editorial standard even when no paid link is available.</p>
        @if (content.operations.affiliate.activeOverlays > 0) {
          <p>{{ content.operations.affiliate.activeOverlays }} independently reviewed and founder-approved paid {{ content.operations.affiliate.activeOverlays === 1 ? 'link is' : 'links are' }} active in the current generated candidate. Every paid action is labeled, uses a sponsored relationship, and remains subject to the separate Firebase preview and release gate.</p>
        } @else if (content.operations.affiliate.enabledPrograms > 0) {
          <p>{{ content.operations.affiliate.enabledPrograms }} affiliate {{ content.operations.affiliate.enabledPrograms === 1 ? 'program is' : 'programs are' }} enabled, but no exact paid-link overlay is approved. Published recommendations therefore continue to use ordinary non-affiliate merchant links.</p>
        } @else {
          <p>No affiliate program is currently enabled in the automated registry. Until Lucas approves an account, tracking identifier, registered site, program terms, and disclosure language, published links must remain ordinary non-affiliate merchant links.</p>
        }
        <p>This page explains the editorial operating policy and is not legal advice.</p>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AffiliateDisclosurePage {
  readonly content = inject(ContentService);
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Affiliate disclosure', description: 'How Tips for Your Gifts uses affiliate links while keeping editorial recommendations independent.', path: '/affiliate-disclosure' });
  }
}

@Component({
  template: `
    <section class="shell studio-hero">
      <p class="eyebrow">Executive studio</p><h1>Set the direction. Let the system run.</h1>
      <p class="lede">This is the strategy and control surface generated from versioned operating data. It is intentionally no-index and contains no credentials or private customer data.</p>
    </section>
    <section class="shell compact-section"><div class="kpi-grid">
      @for (kpi of kpis; track kpi.label) { <div class="kpi"><strong>{{ kpi.value }}</strong><span>{{ kpi.label }}</span></div> }
    </div></section>
    <section class="shell compact-section founder-agenda">
      <div class="section-heading">
        <div><p class="eyebrow">Founder agenda</p><h2>{{ content.operations.founderAgenda.decisions.length }} decision{{ content.operations.founderAgenda.decisions.length === 1 ? '' : 's' }}. One clear order.</h2></div>
        <p>Ranked from versioned operating evidence—not revenue guesses. Profitability remains {{ displayStatus(content.operations.founderAgenda.profitabilityEvidence) }}.</p>
      </div>
      @for (decision of content.operations.founderAgenda.decisions; track decision.id) {
        @if (decision.rank === 1) {
          <article class="panel agenda-primary">
            <div class="experiment-header"><p class="eyebrow">Decision {{ decision.rank }} · {{ displayStatus(decision.category) }}</p><span class="status">{{ displayStatus(decision.horizon) }}</span></div>
            <h2>{{ decision.title }}</h2>
            <p class="agenda-recommendation"><strong>Team recommendation:</strong> {{ decision.recommendation }}</p>
            <p class="lede">{{ decision.decisionQuestion }}</p>
            <div class="agenda-proof-grid">
              <div><strong>Why now</strong><p>{{ decision.rationale }}</p></div>
              <div><strong>What it unlocks</strong><p>{{ decision.unlocks }}</p></div>
              <div><strong>Tradeoff</strong><p>{{ decision.tradeoff }}</p></div>
            </div>
            <p><strong>Current evidence:</strong></p><ul>@for (item of decision.evidence; track item) { <li>{{ item }}</li> }</ul>
            <p class="agenda-guardrail"><strong>Guardrail:</strong> {{ decision.guardrail }} <span>Reversibility: {{ decision.reversibility }}.</span></p>
            <p><a class="button" [href]="decision.action.url" target="_blank" rel="noopener">{{ decision.action.label }}</a></p>
            @if (decision.action.command) { <details><summary>Exact founder command</summary><div class="command">{{ decision.action.command }}</div></details> }
          </article>
        }
      }
      <div class="experiment-grid agenda-grid">
        @for (decision of content.operations.founderAgenda.decisions; track decision.id) {
          @if (decision.rank > 1) {
            <article class="experiment-card agenda-card">
              <div class="experiment-header"><p class="eyebrow">Decision {{ decision.rank }} · {{ displayStatus(decision.category) }}</p><span class="status">{{ displayStatus(decision.horizon) }}</span></div>
              <h3>{{ decision.title }}</h3>
              <p><strong>Recommendation:</strong> {{ decision.recommendation }}</p>
              <p>{{ decision.rationale }}</p>
              <details><summary>Open decision evidence</summary><p><strong>Question:</strong> {{ decision.decisionQuestion }}</p><ul>@for (item of decision.evidence; track item) { <li>{{ item }}</li> }</ul><p><strong>Unlocks:</strong> {{ decision.unlocks }}</p><p><strong>Tradeoff:</strong> {{ decision.tradeoff }}</p><p><strong>Guardrail:</strong> {{ decision.guardrail }}</p></details>
              <p><a class="button secondary" [href]="decision.action.url" target="_blank" rel="noopener">{{ decision.action.label }}</a></p>
              @if (decision.action.command) { <details><summary>Exact founder command</summary><div class="command">{{ decision.action.command }}</div></details> }
            </article>
          }
        }
      </div>
    </section>
    <section class="shell compact-section"><div class="grid two">
      <div class="panel"><p class="eyebrow">North star</p><h2>{{ content.strategy.northStar }}</h2></div>
      <div class="panel"><p class="eyebrow">Current bet</p><h2>{{ content.strategy.currentBet }}</h2></div>
    </div></section>
    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Thoughtfulness engine</p><h2>Notice first. Recommend second.</h2></div>
        <p>A gift idea does not enter research because a product is popular. It enters because we can explain the recipient signal, the purchase they postpone, and the reason it will not become clutter.</p>
      </div>
      <div class="principle-grid">
        @for (principle of content.strategy.thoughtfulnessFramework.principles; track principle.id; let index = $index) {
          <article class="principle-card"><span>0{{ index + 1 }}</span><h3>{{ principle.label }}</h3><p>{{ principle.question }}</p></article>
        }
      </div>
    </section>
    <section class="shell compact-section opportunity-desk">
      <div class="section-heading">
        <div><p class="eyebrow">Autonomous opportunity desk</p><h2>Deep weekly research. One proposal at a time.</h2></div>
        <p>The scout looks for the annoyance a recipient tolerates, the upgrade they keep postponing, and pairs that create one coherent story or ritual. It ranks ideas before affiliate economics and cannot approve its own proposal.</p>
      </div>
      <div class="grid two">
        <div class="panel scout-posture">
          <div class="experiment-header"><p class="eyebrow">Current posture</p><span class="status" [class.blocked_on_account]="content.operations.opportunityScouting.posture === 'founder_backlog_full'">{{ displayStatus(content.operations.opportunityScouting.posture) }}</span></div>
          <h2>{{ content.operations.opportunityScouting.openProposals }}/{{ content.operations.opportunityScouting.maxOpenProposals }} founder proposals open.</h2>
          @if (content.operations.opportunityScouting.posture === 'founder_backlog_full') {
            <p>The weekly run stops before calling a model. Resolve one proposal and the next scheduled scout regains capacity automatically.</p>
          } @else {
            <p>{{ content.operations.opportunityScouting.capacityRemaining }} proposal slot{{ content.operations.opportunityScouting.capacityRemaining === 1 ? '' : 's' }} remain. The next scout may draft one thesis for independent review.</p>
          }
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/opportunity-scout.yml" target="_blank" rel="noopener">Inspect opportunity scout</a>
        </div>
        <div class="panel">
          <p class="eyebrow">Authority boundary</p>
          <h2>Propose only. Never self-approve.</h2>
          <p>The research role may append one commission-independent proposal. A different editor must issue a hash-bound receipt. Founder approval, article research, affiliate enrollment, social posting, spend, credentials, Firebase release, and production remain separate gates.</p>
        </div>
      </div>
      <div class="principle-grid scout-thresholds">
        <article class="principle-card"><span>Evidence</span><h3>{{ content.operations.opportunityScouting.policy.minimumSources }}+ public sources</h3><p>Across at least {{ content.operations.opportunityScouting.policy.minimumSourceClasses }} source classes, including {{ content.operations.opportunityScouting.policy.minimumPublicSocialOrCommunitySources }} independent public social or community sources.</p></article>
        <article class="principle-card"><span>Depth</span><h3>{{ content.operations.opportunityScouting.policy.minimumResearchPasses }}+ research passes</h3><p>Research stops only after two consecutive passes add less than {{ content.operations.opportunityScouting.policy.diminishingReturnThreshold * 100 }}% material novelty.</p></article>
        <article class="principle-card"><span>Choice</span><h3>{{ content.operations.opportunityScouting.policy.minimumCandidates }}–{{ content.operations.opportunityScouting.policy.maximumCandidates }} scored theses</h3><p>Every selected idea must name observed friction, a self-purchase gap, fit evidence, editorial whitespace, and rejection conditions.</p></article>
        <article class="principle-card"><span>Quality</span><h3>{{ content.operations.opportunityScouting.policy.minimumThoughtfulnessPotential }}+ thoughtful</h3><p>The selected idea also needs at least {{ content.operations.opportunityScouting.policy.minimumEvidenceConfidence }} evidence confidence and must remain commission-independent.</p></article>
      </div>
      @if (content.operations.opportunityScouting.queue.length > 0) {
        <div class="experiment-grid mission-grid">
          @for (scout of content.operations.opportunityScouting.queue; track scout.scoutId) {
            <article class="experiment-card">
              <div class="experiment-header"><p class="eyebrow">{{ scout.expectedProposalId }}</p><span class="status">{{ displayStatus(scout.status) }}</span></div>
              <h3>{{ scout.selectedTitle ?? 'Opportunity research in progress' }}</h3>
              <p><strong>Evidence field:</strong> {{ scout.sources }} sources · {{ scout.sourceClasses }} classes · {{ scout.candidates }} candidates.</p>
              <p><strong>Selected scores:</strong> {{ scout.evidenceConfidence ?? 'Pending' }} evidence · {{ scout.thoughtfulnessPotential ?? 'Pending' }} thoughtfulness.</p>
              <p><strong>Next gate:</strong> {{ scout.nextGate }}</p>
              <details><summary>Exact scout identifiers</summary><div class="command">scout: {{ scout.scoutId }}<br>mission sha256: {{ scout.missionRecordSha256 }}<br>report sha256: {{ scout.reportRecordSha256 ?? 'not drafted' }}<br>review: {{ scout.reviewVerdict ?? 'not reviewed' }}</div></details>
            </article>
          }
        </div>
      }
    </section>
    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Executive idea queue</p><h2>Where the team goes next.</h2></div>
        <div class="actions executive-actions">
          <a class="button" href="https://github.com/lucasdmoyer/tipsforyourgifts/issues/new?template=strategy-idea.yml" target="_blank" rel="noopener">Suggest an idea</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/strategy-approval.yml" target="_blank" rel="noopener">Approve a proposal</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/research-agent.yml" target="_blank" rel="noopener">Manual research recovery</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/opportunity-scout.yml" target="_blank" rel="noopener">Run opportunity scout</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/growth-review.yml" target="_blank" rel="noopener">Run growth review</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-program-approval.yml" target="_blank" rel="noopener">Review affiliate candidate</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-media-approval.yml" target="_blank" rel="noopener">Approve social media</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-content-approval.yml" target="_blank" rel="noopener">Approve social draft</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-pinterest-publish.yml" target="_blank" rel="noopener">Publish approved Pin</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/firebase-production.yml" target="_blank" rel="noopener">Release approved SHA</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/publication-policy-enable.yml" target="_blank" rel="noopener">Review publication mode</a>
        </div>
      </div>
      <div class="idea-list">
        @for (idea of content.strategy.ideas; track idea.id) {
          <article class="idea-card">
            <div class="idea-card-header">
              <div><p class="eyebrow">{{ displayStatus(idea.thesisType) }}</p><h3>{{ idea.title }}</h3><p class="quiet">{{ idea.audience }} · {{ idea.occasion }} · {{ idea.budget }}</p></div>
              <span class="status" [class.blocked_on_account]="stageFor(idea.id) === 'blocked_on_account'" [class.approved_for_research]="stageFor(idea.id) === 'approved_for_research'">{{ displayStatus(stageFor(idea.id)) }}</span>
            </div>
            <p class="idea-insight">{{ idea.insight }}</p>
            <div class="idea-proof-grid">
              <div><strong>Observed friction</strong><p>{{ idea.observedFriction }}</p></div>
              <div><strong>Why they postpone it</strong><p>{{ idea.selfPurchaseReluctance }}</p></div>
              <div><strong>Proof of fit</strong><ul>@for (signal of idea.fitSignals; track signal) { <li>{{ signal }}</li> }</ul></div>
            </div>
            @if (idea.pairing) {
              <div class="pairing-card">
                <div><p class="eyebrow">Pair coherence {{ idea.pairing.coherenceScore }}/100</p><h3>{{ idea.pairing.unifyingIdea }}</h3></div>
                <div class="pair-roles">
                  @for (item of idea.pairing.itemRoles; track item.item) { <div><strong>{{ item.item }}</strong><p>{{ item.role }}</p></div> }
                </div>
                <p><strong>The interaction:</strong> {{ idea.pairing.interactionMoment }}</p>
                <p class="drawback"><strong>Clutter and compatibility risk:</strong> {{ idea.pairing.clutterRisk }}</p>
              </div>
            }
            <details class="idea-details">
              <summary>Open decision brief</summary>
              <p><strong>Next gate:</strong> {{ nextGateFor(idea.id) }}</p>
              <p><strong>Exact founder action:</strong></p>
              <div class="command">{{ founderActionFor(idea) }}</div>
              @if (stageFor(idea.id) === 'proposed') {
                <p><a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/strategy-approval.yml" target="_blank" rel="noopener">Open approval workflow</a></p>
              } @else if (stageFor(idea.id) === 'approved_for_research') {
                <p><a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/research-agent.yml" target="_blank" rel="noopener">Open research recovery</a></p>
              }
              <p><strong>Success:</strong> {{ idea.successMetric }}</p>
              <p><strong>Skip when:</strong></p><ul>@for (risk of idea.avoidIf; track risk) { <li>{{ risk }}</li> }</ul>
              @if (idea.pairing) { <p><strong>Compatibility checks:</strong></p><ul>@for (check of idea.pairing.compatibilityChecks; track check) { <li>{{ check }}</li> }</ul> }
              <p><strong>Research brief:</strong></p><div class="command">{{ idea.researchBrief }}</div>
            </details>
          </article>
        }
      </div>
    </section>
    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Monetization and distribution</p><h2>Proposals move. Authority does not leak.</h2></div>
        <p>Affiliate candidates and social assets can be researched and queued automatically. Account enrollment, terms, tracking identities, asset rights, cadence, and public posting remain separately recorded founder decisions.</p>
      </div>
      <div class="grid two">
        <div class="panel">
          <p class="eyebrow">Affiliate decision queue</p>
          <h2>{{ content.operations.affiliate.proposedPrograms }} programs proposed. {{ content.operations.affiliate.activeOverlays }} paid links active.</h2>
          <p><strong>{{ content.operations.affiliate.linkCandidates }}</strong> exact candidates · <strong>{{ content.operations.affiliate.linkReviewsPassed }}</strong> clean independent reviews · <strong>{{ content.operations.affiliate.linkApprovals }}</strong> founder approvals.</p>
          <p><a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-program-approval.yml" target="_blank" rel="noopener">Program onboarding approval</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-program-activate.yml" target="_blank" rel="noopener">Program activation</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-link-candidate.yml" target="_blank" rel="noopener">Exact-link candidate</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-link-review.yml" target="_blank" rel="noopener">Independent link review</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-link-approval.yml" target="_blank" rel="noopener">Founder link approval</a></p>
          <details><summary>Exact approved-overlay digest</summary><div class="command">{{ content.operations.affiliate.approvedOverlaySetSha256 }}</div></details>
          <div class="connector-list">
            @for (program of content.operations.affiliate.programs; track program.id) {
              <div class="connector-row">
                <div><strong>{{ program.name }}</strong><p>Revision {{ program.revision }} · review expires {{ program.sourceReviewExpiresAt }}</p></div>
                <span class="status" [class.blocked_on_account]="program.status === 'proposed'">{{ displayStatus(program.status) }}</span>
                <p class="connector-gate">{{ program.editorialFit }}</p>
                <p class="connector-gate"><strong>Next gate:</strong> {{ program.nextGate }}</p>
                <p class="connector-gate"><a [href]="program.programHomepageUrl" target="_blank" rel="noopener">Official program page</a> · <a [href]="program.termsUrl" target="_blank" rel="noopener">Current terms source</a></p>
              </div>
            }
          </div>
          @if (content.operations.affiliate.linkQueue.length > 0) {
            <div class="connector-list">
              @for (candidate of content.operations.affiliate.linkQueue; track candidate.candidateId) {
                <div class="connector-row">
                  <div><strong>{{ candidate.productId }}</strong><p>{{ candidate.articleSlug }} · {{ candidate.destinationHostname }} · candidate v{{ candidate.candidateRevision }}</p></div>
                  <span class="status" [class.blocked_on_account]="candidate.stage === 'review_failed'">{{ displayStatus(candidate.stage) }}</span>
                  <p class="connector-gate"><strong>Next gate:</strong> {{ candidate.nextGate }}</p>
                  <details><summary>Exact candidate digest</summary><div class="command">{{ candidate.candidateSha256 }}</div></details>
                </div>
              }
            </div>
          }
        </div>
        <div class="panel">
          <p class="eyebrow">Official channel registry</p>
          <h2>{{ content.operations.social.channelsActive }}/{{ content.operations.social.channelsTotal }} channels active.</h2>
          <p><strong>{{ content.operations.social.creativeCandidates }}</strong> original creative candidates · <strong>{{ content.operations.social.mediaAssetsApproved }}</strong> approved media · <strong>{{ content.operations.social.approvalReceipts }}</strong> content receipts · <strong>{{ content.operations.social.publishReady }}</strong> ready for official API.</p>
          <p><a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-channel-configure.yml" target="_blank" rel="noopener">Configure official channel</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-channel-activate.yml" target="_blank" rel="noopener">Activate publishing boundary</a></p>
          <details><summary>Exact channel-registry digest</summary><div class="command">{{ content.operations.social.configSha256 }}</div></details>
          <div class="connector-list">
            @for (channel of content.operations.social.channels; track channel.id) {
              <div class="connector-row">
                <div><strong>{{ displayStatus(channel.id) }}</strong><p>Priority {{ channel.priority }} · {{ channel.maxPostsPerWeek }} approved posts/week</p></div>
                <span class="status" [class.blocked_on_account]="channel.status === 'not_connected'">{{ displayStatus(channel.status) }}</span>
                <p class="connector-gate">{{ channel.nextGate }}</p>
              </div>
            }
          </div>
        </div>
      </div>
      <details class="queue-details">
        <summary>Open the {{ content.operations.social.queue.length }}-post approval queue</summary>
        <div class="experiment-grid">
          @for (post of content.operations.social.queue; track post.postId) {
            <article class="experiment-card">
              <div class="experiment-header"><p class="eyebrow">{{ displayStatus(post.platform) }} · {{ displayStatus(post.format) }}</p><span class="status" [class.blocked_on_account]="post.publishReadiness.startsWith('blocked')">{{ displayStatus(post.status) }}</span></div>
              <h3>{{ post.headline }}</h3>
              @if (post.creativeCandidateAssetPath) {
                <figure class="creative-preview">
                  <img [src]="post.creativeCandidateAssetPath" [alt]="post.creativeCandidateAltText ?? post.headline" loading="lazy" width="1024" height="1536">
                  <figcaption>Original creative candidate · generated, locally verified, not rights-approved or published.</figcaption>
                </figure>
              }
              <p>{{ post.angle }}</p>
              <p><strong>Evidence bindings:</strong> {{ post.claimCount }} claims · {{ post.productCount }} products · {{ post.pairCount }} pairs</p>
              <p><strong>Publish readiness:</strong> {{ displayStatus(post.publishReadiness) }}</p>
              <p><strong>Next gate:</strong> {{ post.nextGate }}</p>
              @if (post.externalPostUrl) { <p><a [href]="post.externalPostUrl" target="_blank" rel="noopener">Open verified external post</a></p> }
              <details><summary>Exact approval identifiers</summary><div class="command">post: {{ post.postId }}<br>pack: {{ post.packId }}<br>pack sha256: {{ post.packSha256 }}<br>creative candidate: {{ post.creativeCandidateId ?? 'not generated' }}<br>candidate record sha256: {{ post.creativeCandidateRecordSha256 ?? 'not generated' }}<br>creative bytes sha256: {{ post.creativeCandidateContentSha256 ?? 'not generated' }}<br>media: {{ post.mediaAssetId ?? 'not approved' }}<br>media record sha256: {{ post.mediaAssetRecordSha256 ?? 'not approved' }}<br>content approval: {{ post.approvalId ?? 'not approved' }}<br>publication receipt: {{ post.publicationReceiptId ?? 'not published' }}<br>external post ID: {{ post.externalPostId ?? 'not published' }}</div></details>
            </article>
          }
        </div>
      </details>
    </section>
    <section class="shell compact-section"><div class="grid two">
      <div class="panel"><p class="eyebrow">Distribution queue</p><h2>Traffic assets are prepared, not posted.</h2><p><strong>{{ content.operations.socialDrafts }}</strong> drafts lack content approval. <strong>{{ content.operations.social.creativeCandidates }}</strong> have an original locally verified visual candidate, <strong>{{ content.operations.social.mediaAssetsApproved }}</strong> have founder-approved byte-verified media, <strong>{{ content.operations.socialApproved }}</strong> are content-approved and unpublished, <strong>{{ content.operations.social.publishReady }}</strong> are ready for the official API, and <strong>{{ content.operations.socialPublished }}</strong> have verified external post IDs.</p></div>
      <div class="panel"><p class="eyebrow">Automation posture</p><h2>Ideas flow in. Authority stays separated.</h2><p>The weekly opportunity desk can propose one deeply researched thesis when the founder queue has capacity. A founder-authored strategy issue can also become a proposed brief. A separate deterministic workflow records approval; after that approval pull request merges, the exact strategy transition is revalidated and the hash-bound article research mission is queued automatically. Git review, Firebase preview, affiliate enrollment, and official social APIs remain separate gates.</p><p><strong>Publication mode:</strong> {{ displayStatus(content.operations.publication.mode) }} · policy snapshot {{ content.operations.publication.verifiedSuccessfulReleaseCount }}/{{ content.operations.publication.minimumSuccessfulFounderReviewedReleases }}. The enable workflow recounts unique successful GitHub production deployments before proposing automatic mode.</p><p><strong>Current release candidate:</strong> {{ content.operations.publication.currentCandidate.manifestId }} · {{ content.operations.publication.currentCandidate.articles }} articles · {{ content.operations.publication.currentCandidate.independentReviews }} independent receipts · {{ content.operations.publication.currentCandidate.socialLaunchPacks }} launch packs · {{ content.operations.publication.currentCandidate.socialDrafts }} social drafts · {{ content.operations.publication.currentCandidate.affiliateLinks }} affiliate links. This manifest describes prepared bytes; it is not proof of a live deployment.</p><details><summary>Exact candidate content digest</summary><div class="command">{{ content.operations.publication.currentCandidate.contentSetSha256 }}</div></details>@if (content.operations.publication.currentLive.status === 'verified_managed_content_release') { <p><strong>Git-recorded live content:</strong> {{ content.operations.publication.currentLive.manifestId }} · {{ content.operations.publication.currentLive.articles }} articles · candidate match {{ content.operations.publication.currentLive.matchesCurrentCandidate ? 'yes' : 'no' }}.</p><p><a [href]="content.operations.publication.currentLive.workflowRunUrl" target="_blank" rel="noopener">Open verified release workflow</a></p><details><summary>Exact durable release evidence</summary><div class="command">receipt: {{ content.operations.publication.currentLive.receiptId }}<br>receipt sha256: {{ content.operations.publication.currentLive.receiptSha256 }}<br>release sha: {{ content.operations.publication.currentLive.releaseSha }}<br>content set sha256: {{ content.operations.publication.currentLive.contentSetSha256 }}</div></details> } @else { <p><strong>Git-recorded live content:</strong> no verified managed release is recorded. This does not claim Firebase is empty; legacy or out-of-band state remains unknown until a managed receipt is synchronized.</p> }<p><strong>Release proof:</strong> the founder workflow builds an exact-SHA candidate, pauses with its preview URL for production approval, then promotes the same static artifact and records the deployed manifest, rollback target, live smoke, and a machine-validated receipt retained for {{ content.operations.publication.receiptRetentionDays }} days.</p></div>
    </div></section>
    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Research mission control</p><h2>One founder decision. Four accountable roles.</h2></div>
        <p>The trusted envelope binds the approved idea, base commit, thresholds, team authority, expected deliverables, and publication policy before Codex receives a key. Completion binds the exact run, article, social pack, and independent QA receipt by SHA-256.</p>
      </div>
      <div class="principle-grid">
        <article class="principle-card"><span>01</span><h3>Research editorial team</h3><p>Deep public research, claim ledger, thoughtful finalists, article draft, and social launch pack. Draft authority only.</p></article>
        <article class="principle-card"><span>02</span><h3>Independent evidence editor</h3><p>Challenges every claim, compatibility assumption, drawback, affiliate posture, and pair. Receipt authority only.</p></article>
        <article class="principle-card"><span>03</span><h3>Release operator</h3><p>Re-runs deterministic gates, opens the exact mission branch and pull request, and prepares Firebase preview evidence.</p></article>
        <article class="principle-card"><span>04</span><h3>Growth analyst</h3><p>Waits for complete aggregate reporting windows, then measures traffic, engagement, merchant clicks, conversions, and revenue.</p></article>
      </div>
      <div class="grid two mission-summary">
        <div class="panel"><p class="eyebrow">Mission receipts</p><h2>{{ content.operations.researchMissions.completed }} completed · {{ content.operations.researchMissions.active }} active</h2><p>{{ content.operations.researchMissions.founderReviewRequired }} await founder release review; {{ content.operations.researchMissions.automaticMergeEligible }} qualify for the separately approved automatic-merge policy.</p></div>
        <div class="panel"><p class="eyebrow">Completion boundary</p><h2>Research done is not production live.</h2><p>A completed mission hands one validated article to release preparation. Production is proven only by the exact deployment receipt and post-release checks.</p></div>
      </div>
      @if (content.operations.researchMissions.queue.length > 0) {
        <div class="experiment-grid mission-grid">
          @for (mission of content.operations.researchMissions.queue; track mission.missionId) {
            <article class="experiment-card">
              <div class="experiment-header"><p class="eyebrow">{{ mission.ideaId }} · revision {{ mission.ideaRevision }}</p><span class="status">{{ displayStatus(mission.status) }}</span></div>
              <h3>{{ mission.ideaTitle }}</h3>
              <p><strong>Active handoff:</strong> {{ displayStatus(mission.activeStage) }}</p>
              <p><strong>Publication readiness:</strong> {{ displayStatus(mission.publicationReadiness) }}</p>
              <p><strong>Next gate:</strong> {{ mission.nextGate }}</p>
              <details><summary>Exact mission identifiers</summary><div class="command">mission: {{ mission.missionId }}<br>record sha256: {{ mission.recordSha256 }}<br>idea sha256: {{ mission.ideaSha256 }}<br>workflow run: {{ mission.workflowRunId }}<br>research run: {{ mission.runId ?? 'not completed' }}<br>article: {{ mission.articleSlug ?? 'not completed' }}</div></details>
            </article>
          }
        </div>
      } @else {
        <div class="panel empty-mission"><p class="eyebrow">Ready for first workflow receipt</p><h2>No automated mission has completed yet.</h2><p>The four existing validated guides predate this mission ledger. The next founder-started run will create the first durable envelope and completion receipt.</p></div>
      }
    </section>
    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Profitability loop</p><h2>Measure first. Scale what earns attention.</h2></div>
        <p>Only aggregate, consent-aware exports enter this view. Missing traffic, conversion, and revenue values stay unknown—not zero—and no experiment can run without a founder-approved baseline.</p>
      </div>
      <div class="grid two">
        <div class="panel">
          <p class="eyebrow">Measurement connectors</p>
          <div class="connector-list">
            @for (connector of content.growth.connectors; track connector.id) {
              <div class="connector-row">
                <div><strong>{{ connector.name }}</strong><p>{{ connector.metrics.map(metricLabel).join(' · ') }}</p></div>
                <span class="status" [class.blocked_on_account]="connector.status === 'not_connected'">{{ displayStatus(connector.status) }}</span>
                <p class="connector-gate">{{ connector.nextGate }}</p>
                @if (connector.configurationEvidenceUrl) { <p><a [href]="connector.configurationEvidenceUrl" target="_blank" rel="noopener">Review configuration evidence</a></p> }
              </div>
            }
          </div>
        </div>
        <div class="panel measurement-panel">
          <p class="eyebrow">Data quality</p>
          <h2>{{ displayStatus(content.operations.growth.measurementStatus) }}</h2>
          <dl class="measurement-list">
            <div><dt>Aggregate snapshots</dt><dd>{{ content.operations.growth.snapshotCount }}</dd></div>
            <div><dt>Active connectors</dt><dd>{{ content.operations.growth.connectorsActive }}/{{ content.operations.growth.connectorsTotal }}</dd></div>
            <div><dt>Latest complete period</dt><dd>{{ content.operations.growth.latestPeriodEnd ?? 'Unknown' }}</dd></div>
            <div><dt>Personal data stored</dt><dd>No</dd></div>
          </dl>
          <p><strong>Search Console:</strong> {{ displayStatus(content.operations.growth.searchConsole.status) }} · automated aggregate collection {{ content.operations.growth.searchConsole.automatedCollectionEnabled ? 'enabled' : 'disabled' }}.</p>
          @if (content.operations.growth.searchConsole.propertyReference) { <p><strong>Exact property:</strong> {{ content.operations.growth.searchConsole.propertyReference }}</p> }
          <p><a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-configure.yml" target="_blank" rel="noopener">Configure Search Console</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-activate.yml" target="_blank" rel="noopener">Activate collector</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-collect.yml" target="_blank" rel="noopener">Collect aggregate snapshot</a></p>
          <details><summary>Exact growth registry digest</summary><div class="command">{{ content.operations.growth.configSha256 }}</div></details>
          <p class="quiet">Import only complete aggregate windows of at least {{ content.growth.measurementPolicy.minimumReportingWindowDays }} days. The gate rejects identifiers, raw queries, negative metrics, unknown articles, and unapproved affiliate exports.</p>
        </div>
      </div>
      <div class="experiment-grid">
        @for (experiment of content.growth.experiments; track experiment.id) {
          <article class="experiment-card">
            <div class="experiment-header"><p class="eyebrow">{{ displayStatus(experiment.channel) }}</p><span class="status">{{ displayStatus(experiment.founderDisposition) }}</span></div>
            <h3>{{ experiment.title }}</h3>
            <p>{{ experiment.hypothesis }}</p>
            <p><strong>Primary signal:</strong> {{ metricLabel(experiment.primaryMetric) }}</p>
            <p><strong>Decision rule:</strong> {{ experiment.decisionRule }}</p>
            <details><summary>Stop conditions</summary><ul>@for (condition of experiment.stopConditions; track condition) { <li>{{ condition }}</li> }</ul></details>
          </article>
        }
      </div>
    </section>
    <section class="shell compact-section"><div class="grid two">
      <div class="panel"><p class="eyebrow">Operating alerts</p><h2>Needs founder attention.</h2><ul class="alert-list">@for (alert of content.operations.alerts; track alert) { <li>{{ alert }}</li> }</ul></div>
      <div class="panel">
        <p class="eyebrow">Start the next run</p>
        @if (nextResearchIdea) {
          <h2>{{ nextResearchIdea.title }}</h2>
          <p>This founder-approved thesis is awaiting its hash-bound mission receipt. Confirm the approval handoff dispatched it; use the command only if the automatic dispatch failed.</p>
          <div class="command">Recovery only: gh workflow run research-agent.yml -f idea_id={{ nextResearchIdea.id }}</div>
        } @else {
          @if (nextFounderDecision) {
            <h2>{{ nextFounderDecision.title }}</h2>
            <p><strong>{{ proposedIdeas.length }}</strong> thoughtful {{ proposedIdeas.length === 1 ? 'thesis awaits' : 'theses await' }} your decision. This is the highest-priority proposal; merging its approval pull request automatically queues research and authorizes nothing beyond that mission.</p>
            <div class="command">{{ founderActionFor(nextFounderDecision) }}</div>
          } @else {
            <h2>No approved idea is waiting.</h2>
            <p>Suggest or revise a strategy thesis before starting another research run.</p>
          }
        }
      </div>
    </div></section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudioPage {
  readonly content = inject(ContentService);
  private readonly ideaStages = new Map(this.content.operations.ideaStages.map((idea) => [idea.ideaId, idea]));
  readonly nextResearchIdea = this.content.strategy.ideas.find((idea) => this.ideaStages.get(idea.id)?.stage === 'approved_for_research');
  readonly proposedIdeas = this.content.strategy.ideas
    .filter((idea) => idea.founderDisposition === 'proposed')
    .sort((left, right) => ({ high: 0, medium: 1, low: 2 }[left.priority] ?? 3) - ({ high: 0, medium: 1, low: 2 }[right.priority] ?? 3) || (right.pairing?.coherenceScore ?? 0) - (left.pairing?.coherenceScore ?? 0) || left.id.localeCompare(right.id));
  readonly nextFounderDecision = this.proposedIdeas[0];
  readonly kpis = [
    { label: 'Founder decisions', value: this.content.operations.founderAgenda.decisions.length },
    { label: 'Research runs', value: this.content.operations.researchRuns },
    { label: 'Validated', value: this.content.operations.validatedRuns },
    { label: 'Publication ready', value: this.content.operations.publicationReadyPosts },
    { label: 'Social drafts', value: this.content.operations.socialDrafts },
    { label: 'Affiliate candidates', value: this.content.operations.affiliateProgramsProposed },
    { label: 'Affiliate enabled', value: this.content.operations.affiliateProgramsEnabled },
    { label: 'Strategy proposals', value: this.content.operations.proposedIdeas },
    { label: 'Scout posture', value: this.displayStatus(this.content.operations.opportunityScouting.posture) },
    { label: 'Scout reports', value: this.content.operations.opportunityScouting.validatedReports },
    { label: 'Auto release', value: this.content.operations.publication.automaticPromotionEnabled ? 'ON' : 'OFF' },
    { label: 'Ready to research', value: this.content.operations.pipeline['ready'] ?? 0 },
    { label: 'Missions active', value: this.content.operations.researchMissions.active },
    { label: 'Missions completed', value: this.content.operations.researchMissions.completed },
    { label: 'Growth snapshots', value: this.content.operations.growth.snapshotCount },
    { label: 'Social channels active', value: this.content.operations.social.channelsActive },
    { label: 'Creative candidates', value: this.content.operations.social.creativeCandidates },
    { label: 'Social publish ready', value: this.content.operations.social.publishReady },
    { label: 'Experiments proposed', value: this.content.operations.growth.proposedExperiments }
  ];
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Executive studio', description: 'Founder strategy, editorial pipeline, operating alerts, and next actions for Tips for Your Gifts.', path: '/studio', noindex: true });
  }
  displayStatus(status: string) { return status.replaceAll('_', ' '); }
  readonly metricLabel = (metric: string) => metric.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  stageFor(ideaId: string) { return this.ideaStages.get(ideaId)?.stage ?? 'untracked'; }
  nextGateFor(ideaId: string) { return this.ideaStages.get(ideaId)?.nextGate ?? 'Connect this idea to the strategy pipeline.'; }
  founderActionFor(idea: StrategyIdea) {
    const stage = this.stageFor(idea.id);
    if (stage === 'proposed') return `gh workflow run strategy-approval.yml -f idea_id=${idea.id} -f expected_revision=${idea.revision}`;
    if (stage === 'approved_for_research') return `Confirm the approval handoff queued ${idea.id}. Recovery only: gh workflow run research-agent.yml -f idea_id=${idea.id}`;
    if (stage === 'research_mission_active') return `Monitor the hash-bound mission receipt for ${idea.id}; do not start a duplicate run.`;
    if (stage === 'publication_ready') return `Review the exact-SHA pull request and Firebase preview for ${idea.id} before production release.`;
    if (stage === 'blocked_on_account') return `Resolve the founder-approved account, rights, cadence, and official API gates for ${idea.id}.`;
    return `Hold ${idea.id}; revise or reject the thesis before any new research authority is granted.`;
  }
}

@Component({
  imports: [RouterLink],
  template: `<section class="shell section"><p class="eyebrow">404</p><h1>That gift is hiding.</h1><p class="lede">The page moved, retired, or never cleared the evidence gate.</p><a class="button" routerLink="/">Return home</a></section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundPage {
  private readonly seo = inject(SeoService);
  constructor() { this.seo.set({ title: 'Page not found', description: 'The requested Tips for Your Gifts page could not be found.', path: '/404', noindex: true }); }
}
