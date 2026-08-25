import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Article, Product, StrategyIdea, VisualAsset } from './content.types';
import { ContentService } from './content.service';
import { assessFounderBrief, buildFounderBriefMarkdown, buildStrategyIssueUrl, EMPTY_FOUNDER_BRIEF, type FounderBriefDraft } from './founder-brief';
import { findGiftGuides, type GiftShape, type RecipientSignal } from './gift-finder';
import { readerBodyHtml, readerDescription, readerGiftIdea, readerLanguage, readerTags, readerTitle } from './reader-copy';
import { SeoService } from './seo.service';

@Component({
  selector: 'tfg-article-card',
  imports: [RouterLink],
  template: `
    <article class="article-card">
      <a class="article-card-visual" [routerLink]="['/blog', article().slug]" [attr.aria-label]="'Read ' + title(article())">
        <img [src]="article().visual.hero.src" [alt]="article().visual.hero.alt" width="1536" height="1024" loading="lazy" decoding="async">
      </a>
      <div class="meta">
        <span>{{ article().occasion }}</span><span>·</span><span>{{ article().priceBand }}</span>
      </div>
      <h3><a [routerLink]="['/blog', article().slug]">{{ title(article()) }}</a></h3>
      <p>{{ description(article()) }}</p>
      <div>
        @for (tag of tags(article()).slice(0, 3); track tag) { <span class="tag">{{ tag }}</span> }
      </div>
      <a class="read" [routerLink]="['/blog', article().slug]" data-event-name="guide_open" [attr.data-guide-slug]="article().slug">Find the gift →</a>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArticleCardComponent {
  readonly article = input.required<Article>();
  readonly description = readerDescription;
  readonly tags = readerTags;
  readonly title = readerTitle;
}

@Component({
  selector: 'tfg-product-card',
  template: `
    <article class="product-card" [id]="product().id">
      <figure class="product-context-visual">
        <img [src]="visual().src" alt="" aria-hidden="true" width="1536" height="1024" loading="lazy" decoding="async">
        <figcaption>Original illustration · shows the use, not the exact product.</figcaption>
      </figure>
      <p class="eyebrow">The thought behind it</p>
      <h3>{{ product().name }}</h3>
      <p>{{ display(product().whyItFits) }}</p>
      <p class="drawback"><strong>Before you wrap it:</strong> {{ display(product().drawback) }}</p>
      <p class="quiet">From {{ product().merchant }} @if (product().priceBand) { · {{ product().priceBand }} }</p>
      <a class="button" [href]="product().url" target="_blank" [attr.rel]="product().affiliate ? 'sponsored noopener' : 'noopener'" data-event-name="merchant_outbound_click" [attr.data-article-slug]="articleSlug()" [attr.data-product-id]="product().id" [attr.data-paid-link]="product().affiliate">
        See it at {{ product().merchant }}{{ product().affiliate ? ' (paid link)' : '' }}
      </a>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly articleSlug = input.required<string>();
  readonly visual = input.required<VisualAsset>();
  readonly display = readerLanguage;
}

@Component({
  imports: [RouterLink, ArticleCardComponent],
  template: `
    <section class="shell hero">
      <div>
        <p class="eyebrow">The gifts people remember</p>
        <h1>Good gifts, minus the guesswork.</h1>
        <p class="lede">The best gifts are often the things someone would love, use, and never quite buy for themselves. We look for the little desire hiding behind “I’m fine”—and turn it into a gift that feels like you noticed.</p>
        <div class="actions">
          <a class="button" routerLink="/gift-finder">Find their gift</a>
          <a class="button secondary" routerLink="/gifts">Browse every idea</a>
          <a class="button secondary" routerLink="/standards">Our gift philosophy</a>
        </div>
      </div>
      <div class="gift-stack" aria-hidden="true">
        <div class="gift-card-visual">
          <span class="visual-label">THE REAL GIFT</span>
          <p class="visual-quote">Not the thing they need. The thing they keep talking themselves out of.</p>
          <div class="visual-meta"><span>Seen</span><span>Personal</span><span>A little indulgent</span></div>
        </div>
      </div>
    </section>

    <section class="section mint-section">
      <div class="shell">
        <div class="section-heading">
          <div><p class="eyebrow">The idea</p><h2>Give them permission to enjoy it.</h2></div>
          <p>People are good at buying necessities. They are worse at buying the nicer version, the curious side project, or the small luxury with no practical excuse. That is where thoughtful gifts live.</p>
        </div>
        <div class="grid three">
          <div class="panel"><span class="number">01</span><h3>Notice the almost</h3><p>The hobby they circle. The worn workaround. The better version they pick up, admire, and put back.</p></div>
          <div class="panel"><span class="number">02</span><h3>Find the hesitation</h3><p>Too indulgent. Too niche. Too hard to compare. A gift removes the excuse without creating a burden.</p></div>
          <div class="panel"><span class="number">03</span><h3>Make it personal</h3><p>The present should say, “I know why you will love this,” before the paper is even off.</p></div>
        </div>
      </div>
    </section>

    <section class="shell section">
      <div class="section-heading">
        <div><p class="eyebrow">Things worth giving</p><h2>A good gift starts with a person.</h2></div>
        <a routerLink="/blog">Read every story →</a>
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
      description: 'Thoughtful gift ideas for the hobbies, small luxuries, and useful upgrades people rarely buy for themselves.',
      path: '/',
      structuredData: {
        '@context': 'https://schema.org', '@type': 'WebSite', name: 'Tips for Your Gifts',
        url: 'https://tipsforyourgifts.web.app',
        description: 'Thoughtful gift ideas for the hobbies, small luxuries, and useful upgrades people rarely buy for themselves.'
      }
    });
  }
}

@Component({
  imports: [RouterLink],
  template: `
    <section class="shell finder-hero">
      <div>
        <p class="eyebrow">Gift finder</p>
        <h1>Who are they when no one is shopping for them?</h1>
        <p class="lede">Think about what they do, what gets in their way, and what they keep meaning to try. The clue is usually already there. You just have to notice it.</p>
      </div>
      <aside class="panel finder-boundary">
        <p class="eyebrow">The only rule</p>
        <h2>Do not invent a new person for them.</h2>
        <p>The best surprise recognizes who they already are. Check what they own, what fits, and whether the gift makes their life better instead of merely fuller.</p>
      </aside>
    </section>

    <section class="shell finder-layout">
      <form class="panel finder-controls" (submit)="$event.preventDefault()">
        <div><p class="eyebrow">1 · Start with them</p><h2>What have you noticed?</h2></div>
        <label>
          <span>Strongest clue</span>
          <select name="signal" [value]="signal" (change)="updateSignal($event)">
            <option value="unsure">Show me a few ways to think</option>
            <option value="observed_friction">Something they tolerate instead of replacing</option>
            <option value="golf_routine">A little annoyance in their golf routine</option>
            <option value="shared_curiosity">An interest that could become an experience</option>
          </select>
        </label>
        <label>
          <span>Gift shape</span>
          <select name="shape" [value]="shape" (change)="updateShape($event)">
            <option value="either">One great thing or a pair with a story</option>
            <option value="single">One thing they will actually use</option>
            <option value="pair">Two gifts that create one moment</option>
          </select>
        </label>
        <div class="finder-checklist">
          <strong>Before you buy, ask:</strong>
          <ul>
            <li>Have I actually seen them want, need, or postpone this?</li>
            <li>Do I know the size, edition, platform, or version that fits?</li>
            <li>Are they denying themselves a pleasure—or simply uninterested?</li>
            <li>Will this become part of their life instead of part of their closet?</li>
          </ul>
        </div>
      </form>

      <div class="finder-results" aria-live="polite">
        <div class="section-heading finder-heading">
          <div><p class="eyebrow">Places to begin</p><h2>{{ results.length }} gift idea{{ results.length === 1 ? '' : 's' }} for the person you know</h2></div>
          <p>These are starting points, not personality predictions. Choose the one that sounds most like them.</p>
        </div>
        @if (results.length > 0) {
          <div class="finder-result-list">
            @for (result of results; track result.article.slug; let rank = $index) {
              <article class="finder-result">
                <div class="finder-result-rank" aria-hidden="true">0{{ rank + 1 }}</div>
                <div>
                  <p class="eyebrow">{{ result.article.priceBand }} · {{ result.article.products.length }} idea{{ result.article.products.length === 1 ? '' : 's' }}@if (result.article.pairs.length > 0) { · {{ result.article.pairs.length }} pairing{{ result.article.pairs.length === 1 ? '' : 's' }} }</p>
                  <h3>{{ result.article.title }}</h3>
                  <p class="finder-reason">{{ result.matchReason }}</p>
                  <p>{{ description(result.article) }}</p>
                  <p class="quiet">Check the current price, fit, delivery, and return policy before making it theirs.</p>
                  <a class="button" [routerLink]="['/blog', result.article.slug]" data-event-name="gift_finder_guide_open" [attr.data-guide-slug]="result.article.slug" [attr.data-result-rank]="rank + 1">See why it works →</a>
                </div>
              </article>
            }
          </div>
        } @else {
          <div class="panel finder-empty">
            <p class="eyebrow">Try a wider clue</p>
            <h2>Nothing here sounds enough like them yet.</h2>
            <p>Change the gift shape or return to what you have noticed. A weak match does not become thoughtful because it comes in a nice box.</p>
            <a class="button secondary" routerLink="/standards">Read our gift philosophy</a>
          </div>
        }
      </div>
    </section>

    <section class="mint-section finder-method">
      <div class="shell section">
        <div class="section-heading">
          <div><p class="eyebrow">A better way to shop</p><h2>One clue is usually enough.</h2></div>
          <p>You do not need to know every product. You need to recognize the moment when a product becomes personal.</p>
        </div>
        <div class="grid three">
          <article class="panel"><span class="number">01</span><h3>Notice</h3><p>Begin with a workaround, a repeated phrase, a worn object, or the nicer version they keep postponing.</p></article>
          <article class="panel"><span class="number">02</span><h3>Imagine</h3><p>Picture the first ten minutes after they open it. If no real moment appears, keep looking.</p></article>
          <article class="panel"><span class="number">03</span><h3>Choose</h3><p>Make sure it fits their life, then give it without turning the present into an assignment.</p></article>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GiftFinderPage {
  private readonly content = inject(ContentService);
  private readonly seo = inject(SeoService);
  signal: RecipientSignal = 'unsure';
  shape: GiftShape = 'either';
  readonly description = readerDescription;

  get results() { return findGiftGuides(this.content.articles, this.signal, this.shape); }

  constructor() {
    const guides = findGiftGuides(this.content.articles, 'unsure', 'either');
    this.seo.set({
      title: 'Thoughtful gift finder',
      description: 'Turn one thing you have noticed about someone into a gift that feels personal, useful, and just indulgent enough.',
      path: '/gift-finder',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Tips for Your Gifts thoughtful gift finder',
        description: 'A gift finder built around the person you know and the little things they rarely buy for themselves.',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: guides.length,
          itemListElement: guides.map(({ article }, index) => ({
            '@type': 'ListItem', position: index + 1, name: article.title,
            url: `https://tipsforyourgifts.web.app/blog/${article.slug}`
          }))
        }
      }
    });
  }

  updateSignal(event: Event) { this.signal = (event.target as HTMLSelectElement).value as RecipientSignal; }
  updateShape(event: Event) { this.shape = (event.target as HTMLSelectElement).value as GiftShape; }
}

@Component({
  imports: [RouterLink, ArticleCardComponent],
  template: `
    <section class="shell section">
      <p class="eyebrow">Gift guides</p>
      <h1>The things they will not buy themselves.</h1>
      <p class="lede">A better tool for the hobby. A small luxury. The upgrade they keep postponing because the old one still works. Start there.</p>
      @if (guides.length > 0) {
        <div class="grid three spaced-grid">
          @for (post of guides; track post.slug) { <tfg-article-card [article]="post" /> }
        </div>
      } @else {
        <div class="panel empty-panel">
          <p class="eyebrow">More ideas are coming</p>
          <h2>We have not found the right one yet.</h2>
          <p>A page full of generic gifts is easy. A gift that sounds like someone you love takes longer.</p>
          <a class="button" routerLink="/standards">Read our gift philosophy</a>
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
    this.seo.set({ title: 'Thoughtful gift guides', description: 'Gift ideas for the hobbies, useful upgrades, and small luxuries people keep postponing for themselves.', path: '/gifts' });
  }
}

@Component({
  imports: [ArticleCardComponent],
  template: `
    <section class="shell section">
      <p class="eyebrow">The gift journal</p>
      <h1>A gift starts before the shopping.</h1>
      <p class="lede">It starts when someone mentions the same annoyance twice. When they light up around a subject. When they choose the sensible version again. That is the part worth writing down.</p>
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
    this.seo.set({ title: 'The gift journal', description: 'Stories and gift ideas built around the interests, rituals, and small indulgences that make people feel known.', path: '/blog' });
  }
}

@Component({
  imports: [DatePipe, RouterLink, ProductCardComponent],
  template: `
    @if (article) {
      <article class="article-shell">
        <p class="eyebrow">{{ article.occasion }} · {{ article.priceBand }}</p>
        <h1>{{ title(article) }}</h1>
        <p class="dek">{{ description(article) }}</p>
        <div class="meta-row">
          <time [attr.datetime]="article.publishDate">Published {{ article.publishDate | date: 'MMMM d, y': 'UTC' }}</time>
          <span>·</span><span>For {{ article.audience }}</span>
        </div>
        <figure class="article-hero-visual">
          <img [src]="article.visual.hero.src" [alt]="article.visual.hero.alt" width="1536" height="1024" fetchpriority="high" decoding="async">
          <figcaption>{{ display(article.visual.hero.caption) }} <span>Original illustration made for this guide.</span></figcaption>
        </figure>
        <aside class="panel gift-premise">
          <p class="eyebrow">The thought behind the gift</p>
          <h2>{{ giftIdea(article) }}</h2>
        </aside>
        @if (article.affiliateDisclosure) {
          <aside class="disclosure"><strong>Affiliate disclosure:</strong> We may earn a commission when you purchase through links on this page. That never changes who the gift is for or why it belongs here.</aside>
        }
        <div class="prose" [innerHTML]="body(article)"></div>
        @if (article.products.length > 0) {
          <section aria-labelledby="recommendations">
            <h2 id="recommendations">What to give</h2>
            <div class="product-list">
              @for (product of article.products; track product.id) { <tfg-product-card [product]="product" [articleSlug]="article.slug" [visual]="productVisual(product.id)" /> }
            </div>
          </section>
        }
        @if (article.pairs.length > 0) {
          <section aria-labelledby="pairings" class="article-pairings">
            <p class="eyebrow">The part that makes it personal</p>
            <h2 id="pairings">Two gifts, one good story</h2>
            <div class="product-list">
              @for (pair of article.pairs; track pair.id) {
                <article class="product-card pairing-product-card">
                  <figure class="pairing-context-visual">
                    <img [src]="pairVisual(pair.id).src" alt="" aria-hidden="true" width="1536" height="1024" loading="lazy" decoding="async">
                    <figcaption>{{ display(pairVisual(pair.id).caption) }}</figcaption>
                  </figure>
                  <p class="eyebrow">The pairing</p>
                  <h3>{{ pair.name }}</h3>
                  <p><strong>{{ productName(pair.anchorProductId) }}</strong> + <strong>{{ productName(pair.companionProductId) }}</strong></p>
                  <p>{{ display(pair.whyTogether) }}</p>
                  <p><strong>The moment it creates:</strong> {{ display(pair.interactionMoment) }}</p>
                  <p><strong>Make sure:</strong> {{ display(pair.preGiftCheck) }}</p>
                  <p class="drawback"><strong>If one gift is enough:</strong> {{ display(pair.bundleDrawback) }}</p>
                </article>
              }
            </div>
          </section>
        }
      </article>
    } @else {
      <section class="shell section">
        <p class="eyebrow">404</p><h1>No present here.</h1>
        <p class="lede">This idea wandered off, changed names, or was never quite right.</p>
        <a class="button" routerLink="/blog">Find another idea</a>
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
  readonly description = readerDescription;
  readonly giftIdea = readerGiftIdea;
  readonly title = readerTitle;
  readonly body = readerBodyHtml;
  readonly display = readerLanguage;
  productName(productId: string) { return this.article?.products.find((product) => product.id === productId)?.name ?? productId; }
  productVisual(productId: string): VisualAsset {
    if (!this.article) throw new Error('Cannot resolve a product visual without an article');
    const sceneId = this.article.visual.productSceneIds[productId];
    return this.article.visual.scenes.find((scene) => scene.id === sceneId) ?? this.article.visual.hero;
  }
  pairVisual(pairId: string): VisualAsset {
    if (!this.article) throw new Error('Cannot resolve a pair visual without an article');
    const sceneId = this.article.visual.pairSceneIds[pairId];
    return this.article.visual.scenes.find((scene) => scene.id === sceneId) ?? this.article.visual.hero;
  }

  constructor() {
    if (!this.article) {
      this.seo.set({ title: 'Guide not found', description: 'The requested gift guide could not be found.', path: this.route.snapshot.url.join('/'), noindex: true });
      return;
    }
    const path = `/blog/${this.article.slug}`;
    this.seo.set({
      title: readerTitle(this.article),
      description: readerDescription(this.article),
      path,
      type: 'article',
      image: this.article.visual.hero.src,
      structuredData: {
        '@context': 'https://schema.org', '@type': 'Article', headline: readerTitle(this.article),
        description: readerDescription(this.article), datePublished: this.article.publishDate,
        dateModified: this.article.updatedDate,
        author: { '@type': 'Organization', name: 'Tips for Your Gifts Editorial Team' },
        publisher: { '@type': 'Organization', name: 'Tips for Your Gifts' },
        mainEntityOfPage: `https://tipsforyourgifts.web.app${path}`,
        image: `https://tipsforyourgifts.web.app${this.article.visual.hero.src}`,
        about: this.article.tags
      }
    });
  }
}

@Component({
  template: `
    <article class="article-shell">
      <p class="eyebrow">Our gift philosophy</p>
      <h1>Buy the thing they would talk themselves out of.</h1>
      <p class="dek">People buy what they need. Gifts are for the better version, the curious detour, and the small luxury that never survives a practical conversation with yourself.</p>
      <div class="prose">
        <h2>People are good at buying what they need.</h2>
        <p>They replace the empty toothpaste. They order the charging cable. They buy the ordinary pan because dinner still has to happen.</p>
        <p>But the quieter wants are easy to postpone. The field guide for walks they already take. The nicer tool for a hobby they refuse to call serious. The small upgrade that would make every Saturday better, but feels too indulgent on a Tuesday.</p>
        <blockquote>A thoughtful gift says: I noticed the part of your life you keep putting second.</blockquote>
        <h2>Notice the almost.</h2>
        <p>Listen for “I have been meaning to.” Look for the improvised fix that has become permanent. Pay attention to what they borrow, admire, save, or keep researching without buying.</p>
        <p>The object is not the idea. The idea is that you saw the hesitation and understood what was underneath it.</p>
        <h2>A little indulgence is the point.</h2>
        <p>A gift does not need to be frivolous. It needs to cross a line the recipient will not cross alone: from good enough to genuinely enjoyable, from vague curiosity to a first real step, from someday to this weekend.</p>
        <h2>When two gifts belong together.</h2>
        <p>Do not make a gift basket just because two products share a color. One thing should open the door and the other should create a moment: read and play, remember and record, notice and look closer.</p>
        <h2>Let the shopping disappear.</h2>
        <p>By the time the gift reaches them, the comparisons, dead ends, and practical checks should be invisible. What remains is a simple feeling: this is for me.</p>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StandardsPage {
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Our gift philosophy', description: 'A better gift begins with what someone loves, postpones, and rarely gives themselves permission to enjoy.', path: '/standards', structuredData: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Tips for Your Gifts gift philosophy' } });
  }
}

@Component({
  template: `
    <article class="article-shell">
      <p class="eyebrow">A simple disclosure</p><h1>The idea comes before the link.</h1>
      <div class="prose">
        <p>Tips for Your Gifts may eventually earn a commission from certain links. When a link is paid, we will say so plainly before you click it.</p>
        <p>The person comes first, the gift idea comes second, and the link comes last. A commission never turns the wrong gift into the right one.</p>
        @if (content.operations.affiliate.activeOverlays > 0) {
          <p>{{ content.operations.affiliate.activeOverlays }} paid {{ content.operations.affiliate.activeOverlays === 1 ? 'link is' : 'links are' }} currently active. Each one is labeled where it appears.</p>
        } @else if (content.operations.affiliate.enabledPrograms > 0) {
          <p>{{ content.operations.affiliate.enabledPrograms }} affiliate {{ content.operations.affiliate.enabledPrograms === 1 ? 'partnership is' : 'partnerships are' }} available, but the links on the site remain ordinary, unpaid links unless they are labeled otherwise.</p>
        } @else {
          <p>No affiliate partnership is active today. Every product destination is an ordinary, unpaid link.</p>
        }
        <p>That may change as the site grows. The way we talk about gifts will not.</p>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AffiliateDisclosurePage {
  readonly content = inject(ContentService);
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Affiliate disclosure', description: 'A plain-language explanation of paid links on Tips for Your Gifts.', path: '/affiliate-disclosure' });
  }
}

@Component({
  imports: [RouterLink],
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
          <a class="button" routerLink="/studio/brief">Compose a thoughtful brief</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/issues/new?template=strategy-idea.yml" target="_blank" rel="noopener">Open raw issue form</a>
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
          <p><strong>Privacy review:</strong> {{ displayStatus(content.growth.measurementPolicy.privacyReview.status) }} · client collection {{ content.growth.measurementPolicy.privacyReview.clientCollectionEnabled ? 'enabled' : 'disabled' }}.</p>
          <p><strong>Baseline:</strong> {{ displayStatus(content.growth.measurementPolicy.privacyReview.baselineStatus) }}. Unknown traffic is not reported as zero.</p>
          <details><summary>Founder-approved measurement boundary</summary><p>{{ content.growth.measurementPolicy.privacyReview.decisionSummary }}</p><div class="command">decision: {{ content.growth.measurementPolicy.privacyReview.decisionId }}<br>approved: {{ content.growth.measurementPolicy.privacyReview.approvedAt }}<br>events: {{ content.growth.measurementPolicy.privacyReview.approvedEventNames.join(', ') }}</div></details>
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
  template: `
    <section class="shell studio-hero brief-hero">
      <p class="eyebrow">Founder brief builder</p>
      <h1>Notice the gift before naming the product.</h1>
      <p class="lede">Give the AI team a high-level direction. This private-in-your-browser worksheet checks the thoughtfulness logic, then opens a reviewable owner-authored GitHub issue. It does not start research or publish anything by itself.</p>
      <p><a routerLink="/studio">← Return to Executive Studio</a></p>
    </section>

    <section class="shell compact-section brief-layout">
      <form class="panel brief-form" (submit)="$event.preventDefault()">
        <div class="brief-form-heading">
          <div><p class="eyebrow">1 · Frame the direction</p><h2>What should the team investigate?</h2></div>
          <span class="status" [class.approved_for_research]="assessment.ready">{{ assessment.passed }}/{{ assessment.total }} complete</span>
        </div>

        <label>Idea shape
          <select name="mode" [value]="draft.mode" (change)="updateMode($event)">
            <option value="recipient_friction">One recipient-friction opportunity</option>
            <option value="coherent_pair">Two gifts that create one interaction</option>
          </select>
        </label>
        <label>Strategic direction
          <input name="title" [value]="draft.title" (input)="updateText('title', $event)" maxlength="180" placeholder="Small golf frustrations players tolerate instead of fixing">
        </label>
        <div class="brief-field-grid">
          <label>Recipient or audience
            <input name="audience" [value]="draft.audience" (input)="updateText('audience', $event)" maxlength="180" placeholder="Recreational golfers who play most weekends">
          </label>
          <label>Occasion and timing
            <input name="occasion" [value]="draft.occasion" (input)="updateText('occasion', $event)" maxlength="180" placeholder="Evergreen birthdays and Father’s Day">
          </label>
          <label>Budget boundary
            <input name="budget" [value]="draft.budget" (input)="updateText('budget', $event)" maxlength="80" placeholder="$25–$100">
          </label>
          <label>Geography
            <input name="geography" [value]="draft.geography" (input)="updateText('geography', $event)" maxlength="100">
          </label>
        </div>

        <label>What have you actually noticed?
          <textarea name="observedFriction" [value]="draft.observedFriction" (input)="updateText('observedFriction', $event)" rows="4" maxlength="1200" placeholder="Name the workaround, worn item, repeated complaint, or routine—not a product trend."></textarea>
        </label>
        <label>Why would they welcome it but postpone buying it?
          <textarea name="selfPurchaseGap" [value]="draft.selfPurchaseGap" (input)="updateText('selfPurchaseGap', $event)" rows="4" maxlength="1200" placeholder="Replacement inertia, research burden, a deferred small luxury, or coordination burden—not simply ‘they would never buy it.’"></textarea>
        </label>
        <div class="brief-field-grid">
          <label>Proof-of-fit signals <span>one per line</span>
            <textarea name="fitSignals" [value]="draft.fitSignals" (input)="updateText('fitSignals', $event)" rows="5" maxlength="1400" placeholder="I have seen the workaround&#10;I know the size, platform, routine, or current setup"></textarea>
          </label>
          <label>Reject the idea when <span>one per line</span>
            <textarea name="rejectionConditions" [value]="draft.rejectionConditions" (input)="updateText('rejectionConditions', $event)" rows="5" maxlength="1400" placeholder="They already own a good version&#10;It creates storage, maintenance, or compatibility burden"></textarea>
          </label>
        </div>

        @if (draft.mode === 'coherent_pair') {
          <fieldset class="pair-builder">
            <legend>2 · Make the pair interact</legend>
            <p>A pair must do more than match. Each item should qualify alone, perform a different role, and create one observable use-together moment.</p>
            <div class="brief-field-grid">
              <label>Anchor gift
                <input name="pairAnchor" [value]="draft.pairAnchor" (input)="updateText('pairAnchor', $event)" maxlength="180" placeholder="The idea-opening gift">
              </label>
              <label>Companion gift
                <input name="pairCompanion" [value]="draft.pairCompanion" (input)="updateText('pairCompanion', $event)" maxlength="180" placeholder="The gift that lets them act on it">
              </label>
            </div>
            <label>Different roles and interaction moment
              <textarea name="pairInteraction" [value]="draft.pairInteraction" (input)="updateText('pairInteraction', $event)" rows="4" maxlength="1200" placeholder="Explain what the recipient can do, discuss, test, or notice because the gifts are together."></textarea>
            </label>
            <label>Compatibility, ownership, and clutter checks <span>one per line</span>
              <textarea name="compatibilityChecks" [value]="draft.compatibilityChecks" (input)="updateText('compatibilityChecks', $event)" rows="5" maxlength="1400" placeholder="Confirm platform or edition compatibility&#10;Confirm they do not already own either item"></textarea>
            </label>
          </fieldset>
        }

        <label>Exclusions and guardrails
          <textarea name="exclusions" [value]="draft.exclusions" (input)="updateText('exclusions', $event)" rows="3" maxlength="1000" placeholder="Categories, claims, merchants, subscriptions, geographies, or risks to exclude."></textarea>
        </label>
        <label>What would a successful result help us decide?
          <textarea name="desiredOutcome" [value]="draft.desiredOutcome" (input)="updateText('desiredOutcome', $event)" rows="3" maxlength="1000" placeholder="Five defensible finalists, one evergreen guide, and three testable distribution angles."></textarea>
        </label>

        <fieldset class="authority-checks">
          <legend>3 · Keep authority explicit</legend>
          <label><input type="checkbox" name="authorityConfirmed" [checked]="draft.authorityConfirmed" (change)="updateBoolean('authorityConfirmed', $event)"> I understand this issue can create only a proposed brief. A separate founder approval is required before research.</label>
          <label><input type="checkbox" name="noSensitiveDataConfirmed" [checked]="draft.noSensitiveDataConfirmed" (change)="updateBoolean('noSensitiveDataConfirmed', $event)"> I included no credentials, tracking IDs, private customer data, or private-group content.</label>
        </fieldset>
        @if (assessment.credentialLikeTextDetected) {
          <p class="brief-warning"><strong>Stop:</strong> credential-like text was detected. Remove it before opening GitHub.</p>
        }
      </form>

      <aside class="brief-sidebar">
        <div class="panel brief-readiness">
          <p class="eyebrow">Draft readiness</p>
          <h2>{{ assessment.ready ? 'Ready for founder review.' : 'Strengthen the brief.' }}</h2>
          <ul class="brief-checks">
            @for (check of assessment.checks; track check.id) {
              <li [class.passed]="check.passed"><span aria-hidden="true">{{ check.passed ? '✓' : '○' }}</span>{{ check.label }}</li>
            }
          </ul>
          @if (issueUrl) {
            <a class="button brief-submit" [href]="issueUrl" target="_blank" rel="noopener">Review issue in GitHub →</a>
          } @else {
            <span class="button brief-submit disabled" aria-disabled="true">Complete the missing decisions</span>
          }
          <p class="quiet">GitHub shows the final issue before submission. Submitting it starts only the proposal workflow; it does not approve research.</p>
        </div>
        <div class="panel brief-prompts">
          <p class="eyebrow">Use observation, not assumption</p>
          <h3>Signals worth bringing to the team</h3>
          <ul>
            <li>A workaround they repeat.</li>
            <li>A worn item they tolerate.</li>
            <li>A small upgrade deferred behind bigger purchases.</li>
            <li>Two interests that become one shared activity.</li>
          </ul>
        </div>
        <details class="panel brief-preview-card">
          <summary>Preview the exact issue body</summary>
          <pre class="brief-preview">{{ briefMarkdown }}</pre>
        </details>
      </aside>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FounderBriefPage {
  readonly draft: FounderBriefDraft = { ...EMPTY_FOUNDER_BRIEF };
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Founder brief builder', description: 'Compose a thoughtful, bounded strategy brief for the Tips for Your Gifts research team.', path: '/studio/brief', noindex: true });
  }
  get assessment() { return assessFounderBrief(this.draft); }
  get issueUrl() { return buildStrategyIssueUrl(this.draft); }
  get briefMarkdown() { return buildFounderBriefMarkdown(this.draft); }
  updateMode(event: Event) { this.draft.mode = (event.target as HTMLSelectElement).value as FounderBriefDraft['mode']; }
  updateText(field: Exclude<keyof FounderBriefDraft, 'mode' | 'authorityConfirmed' | 'noSensitiveDataConfirmed'>, event: Event) {
    this.draft[field] = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
  updateBoolean(field: 'authorityConfirmed' | 'noSensitiveDataConfirmed', event: Event) {
    this.draft[field] = (event.target as HTMLInputElement).checked;
  }
}

@Component({
  imports: [RouterLink],
  template: `<section class="shell section"><p class="eyebrow">404</p><h1>No present here.</h1><p class="lede">This page wandered off. The person you are shopping for is still waiting.</p><a class="button" routerLink="/">Start again</a></section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundPage {
  private readonly seo = inject(SeoService);
  constructor() { this.seo.set({ title: 'Page not found', description: 'The requested Tips for Your Gifts page could not be found.', path: '/404', noindex: true }); }
}
