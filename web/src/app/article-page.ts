import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PairCardComponent, ProductCardComponent } from './article-components';
import type { Article, VisualAsset } from './content.types';
import { readerBodyComesFirst, readerBodyHtml, readerDescription, readerEvidenceHtml, readerGiftIdea, readerLanguage, readerLead, readerTitle } from './reader-copy';
import { responsiveImageSrcset } from './responsive-image';
import { SeoService } from './seo.service';

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
  private readonly seo = inject(SeoService);
  readonly article = this.route.snapshot.data['article'] as Article | undefined;
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
