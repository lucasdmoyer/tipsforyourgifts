import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Article, Product, ProductPair, VisualAsset } from './content.types';
import { ContentService } from './content.service';
import { findGiftGuides, type GiftShape, type RecipientSignal } from './gift-finder';
import { readerBodyComesFirst, readerBodyHtml, readerDescription, readerEvidenceHtml, readerGiftIdea, readerLanguage, readerLead, readerTags, readerTitle } from './reader-copy';
import { SeoService } from './seo.service';

const responsiveImageSrcset = (src: string) => src.endsWith('.webp')
  ? `${src.replace(/\.webp$/, '-768.webp')} 768w, ${src.replace(/\.webp$/, '-1200.webp')} 1200w, ${src} 1536w`
  : null;

@Component({
  selector: 'tfg-article-card',
  imports: [RouterLink],
  template: `
    <article class="article-card">
      <a class="article-card-visual" [routerLink]="['/blog', article().slug]" [attr.aria-label]="'Read ' + title(article())">
        <img [src]="article().visual.hero.src" [attr.srcset]="imageSrcset(article().visual.hero.src)" sizes="(max-width: 620px) calc(100vw - 28px), (max-width: 860px) calc((100vw - 60px) / 2), 380px" [alt]="article().visual.hero.alt" width="1536" height="1024" loading="lazy" decoding="async">
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
  readonly imageSrcset = responsiveImageSrcset;
  readonly description = readerDescription;
  readonly tags = readerTags;
  readonly title = readerTitle;
}

@Component({
  selector: 'tfg-product-card',
  template: `
    <article class="product-card" [id]="product().id">
      <figure class="product-context-visual">
        <img [src]="visual().src" [attr.srcset]="imageSrcset(visual().src)" sizes="(max-width: 620px) calc(100vw - 68px), (max-width: 1080px) calc(100vw - 92px), 988px" [alt]="visual().alt" width="1536" height="1024" loading="lazy" decoding="async">
        <figcaption>Original illustration of the gift idea—not a product photo.</figcaption>
      </figure>
      <p class="eyebrow">A gift to consider</p>
      <h3>{{ product().name }}</h3>
      <p>{{ display(product().whyItFits) }}</p>
      <p class="drawback"><strong>Before you buy:</strong> {{ display(product().drawback) }}</p>
      <p class="quiet">From {{ product().merchant }} @if (product().priceBand) { · {{ product().priceBand }} }</p>
      <a class="button" [href]="product().url" target="_blank" [attr.rel]="product().affiliate ? 'sponsored noopener' : 'noopener'" data-event-name="merchant_outbound_click" [attr.data-article-slug]="articleSlug()" [attr.data-product-id]="product().id" [attr.data-paid-link]="product().affiliate">
        See product details at {{ product().merchant }}{{ product().affiliate ? ' (paid link)' : '' }}
      </a>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly articleSlug = input.required<string>();
  readonly visual = input.required<VisualAsset>();
  readonly imageSrcset = responsiveImageSrcset;
  readonly display = readerLanguage;
}

@Component({
  selector: 'tfg-pair-card',
  template: `
    <article class="reader-pair-card" [id]="pair().id">
      <p class="eyebrow">A thoughtful pair</p>
      <h2>{{ pair().name }}</h2>
      <figure class="pairing-context-visual">
        <img [src]="pairVisual().src" [attr.srcset]="imageSrcset(pairVisual().src)" sizes="(max-width: 620px) calc(100vw - 68px), (max-width: 1080px) calc(100vw - 100px), 978px" [alt]="pairVisual().alt" width="1536" height="1024" loading="lazy" decoding="async">
        <figcaption>{{ display(pairVisual().caption) }} Original illustration of the gift idea—not product photography.</figcaption>
      </figure>
      <div class="reader-pair-products">
        @if (anchorProduct(); as product) {
          <section class="reader-pair-product">
            <p class="pair-role">Start with</p>
            <h3>{{ product.name }}</h3>
            <p>{{ display(product.whyItFits) }}</p>
            <p class="product-caveat"><strong>Good to know:</strong> {{ display(product.drawback) }}</p>
            <a class="read" [href]="product.url" target="_blank" [attr.rel]="product.affiliate ? 'sponsored noopener' : 'noopener'" data-event-name="merchant_outbound_click" [attr.data-article-slug]="article().slug" [attr.data-product-id]="product.id" [attr.data-paid-link]="product.affiliate">See product details at {{ product.merchant }}{{ product.affiliate ? ' (paid link)' : '' }} →</a>
          </section>
        }
        @if (companionProduct(); as product) {
          <section class="reader-pair-product">
            <p class="pair-role">Pair it with</p>
            <h3>{{ product.name }}</h3>
            <p>{{ display(product.whyItFits) }}</p>
            <p class="product-caveat"><strong>Good to know:</strong> {{ display(product.drawback) }}</p>
            <a class="read" [href]="product.url" target="_blank" [attr.rel]="product.affiliate ? 'sponsored noopener' : 'noopener'" data-event-name="merchant_outbound_click" [attr.data-article-slug]="article().slug" [attr.data-product-id]="product.id" [attr.data-paid-link]="product.affiliate">See product details at {{ product.merchant }}{{ product.affiliate ? ' (paid link)' : '' }} →</a>
          </section>
        }
      </div>
      <p class="illustration-note">The links below open the current product pages.</p>
      <section class="why-good-gift" [attr.aria-labelledby]="pair().id + '-why-good-gift'">
        <h3 [id]="pair().id + '-why-good-gift'">Why this makes a good gift</h3>
        <p>{{ display(pair().whyTogether) }}</p>
        <p><strong>The moment it creates:</strong> {{ display(pair().interactionMoment) }}</p>
      </section>
      <section class="before-you-buy">
        <h3>Before you buy</h3>
        <p>{{ display(pair().preGiftCheck) }}</p>
        <p><strong>If one gift is enough:</strong> {{ display(pair().bundleDrawback) }}</p>
      </section>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PairCardComponent {
  readonly article = input.required<Article>();
  readonly pair = input.required<ProductPair>();
  readonly imageSrcset = responsiveImageSrcset;
  readonly display = readerLanguage;
  anchorProduct() { return this.article().products.find((product) => product.id === this.pair().anchorProductId); }
  companionProduct() { return this.article().products.find((product) => product.id === this.pair().companionProductId); }
  pairVisual(): VisualAsset {
    const article = this.article();
    const sceneId = article.visual.pairSceneIds[this.pair().id];
    return article.visual.scenes.find((scene) => scene.id === sceneId) ?? article.visual.hero;
  }
}

@Component({
  imports: [RouterLink, ArticleCardComponent],
  template: `
    <section class="shell hero">
      <div>
        <p class="eyebrow">The gifts people remember</p>
        <h1>Good gifts, minus the guesswork.</h1>
        <p class="lede">The best gifts are often the things someone would love, use, and never quite buy for themselves. Sometimes they already own the everyday version. The gift is the specialty extra made for the part they love most.</p>
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
          <div class="panel"><span class="number">03</span><h3>Add, do not erase</h3><p>Keep the useful thing they already trust. Give the specialty extra that makes one favorite part of their life better.</p></div>
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
            <li>Does this add something special without replacing a general-purpose thing they already like?</li>
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
  imports: [DatePipe, RouterLink, ProductCardComponent, PairCardComponent],
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
          <img [src]="article.visual.hero.src" [attr.srcset]="imageSrcset(article.visual.hero.src)" sizes="(max-width: 620px) calc(100vw - 28px), (max-width: 1080px) calc(100vw - 40px), 1040px" [alt]="article.visual.hero.alt" width="1536" height="1024" fetchpriority="high" decoding="async">
          <figcaption>{{ display(article.visual.hero.caption) }} <span>Original illustration made for this guide.</span></figcaption>
        </figure>
        <aside class="panel gift-premise">
          <p class="eyebrow">Start with the person</p>
          <h2>{{ lead(article) }}</h2>
          <p>{{ giftIdea(article) }}</p>
        </aside>
        @if (article.affiliateDisclosure) {
          <aside class="disclosure"><strong>Affiliate disclosure:</strong> We may earn a commission when you purchase through links on this page. That never changes who the gift is for or why it belongs here.</aside>
        }
        @if (article.specialtyLens; as lens) {
          <section class="specialty-lens" [attr.aria-labelledby]="article.slug + '-specialty-lens-title'">
            <p class="eyebrow">The quick version</p>
            <h2 [id]="article.slug + '-specialty-lens-title'">The gift may be the extra tool, not a replacement.</h2>
            <div class="specialty-lens-grid">
              <div><h3>What they may already use</h3><p>{{ lens.generalPurpose }}</p></div>
              <div><h3>What this adds</h3><p>{{ lens.specialty }}</p></div>
              <div><h3>The clue to look for</h3><p>{{ lens.signal }}</p></div>
            </div>
          </section>
        }
        @if (bodyComesFirst(article)) {
          <section class="article-explainer" aria-label="A simple explanation of this gift idea">
            <div class="prose" [innerHTML]="body(article)"></div>
          </section>
        }
        @if (article.pairs.length > 0) {
          <section aria-labelledby="pairings" class="article-pairings">
            <p class="eyebrow">Two products, one idea</p>
            <h2 id="pairings">Gift pairings for this person</h2>
            <div class="reader-pair-list">
              @for (pair of article.pairs; track pair.id) {
                <tfg-pair-card [article]="article" [pair]="pair" />
              }
            </div>
          </section>
        }
        @if (unpairedProducts().length > 0) {
          <section aria-labelledby="recommendations" class="article-single-gifts">
            <p class="eyebrow">One gift can be enough</p>
            <h2 id="recommendations">Good gifts on their own</h2>
            <div class="product-list">
              @for (product of unpairedProducts(); track product.id) { <tfg-product-card [product]="product" [articleSlug]="article.slug" [visual]="productVisual(product.id)" /> }
            </div>
          </section>
        }
        @if (!bodyComesFirst(article)) {
          @if (article.products.length === 0) {
            <div class="prose article-explainer" [innerHTML]="body(article)"></div>
          } @else {
            <section class="article-explainer" aria-label="Why this gift idea works">
              <div class="prose" [innerHTML]="body(article)"></div>
            </section>
          }
        }
        @if (evidence(article)) {
          <section class="article-evidence" aria-label="Sources behind this guide">
            <div class="prose" [innerHTML]="evidence(article)"></div>
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
  readonly lead = readerLead;
  readonly title = readerTitle;
  readonly body = readerBodyHtml;
  readonly bodyComesFirst = readerBodyComesFirst;
  readonly evidence = readerEvidenceHtml;
  readonly display = readerLanguage;
  readonly imageSrcset = responsiveImageSrcset;
  unpairedProducts() {
    if (!this.article) return [];
    const pairedIds = new Set(this.article.pairs.flatMap((pair) => [pair.anchorProductId, pair.companionProductId]));
    return this.article.products.filter((product) => !pairedIds.has(product.id));
  }
  productVisual(productId: string): VisualAsset {
    if (!this.article) throw new Error('Cannot resolve a product visual without an article');
    const sceneId = this.article.visual.productSceneIds[productId];
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
        <h2>The everyday thing can stay.</h2>
        <p>Someone may already own a good general-purpose version: the phone app, the old towel, the plain palette, the ordinary storage box. That does not make the gift idea redundant.</p>
        <p>Look for the specialty extra built for the exact moment they care about. It should do one narrow job better without asking them to throw away something that already works.</p>
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
        @if (paidLinkCount > 0) {
          <p>{{ paidLinkCount }} paid {{ paidLinkCount === 1 ? 'link is' : 'links are' }} currently active. Each one is labeled where it appears.</p>
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
  readonly paidLinkCount = inject(ContentService).articles
    .flatMap((article) => article.products)
    .filter((product) => product.affiliate).length;
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Affiliate disclosure', description: 'A plain-language explanation of paid links on Tips for Your Gifts.', path: '/affiliate-disclosure' });
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
