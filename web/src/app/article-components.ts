import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Article, Product, ProductPair, VisualAsset } from './content.types';
import { readerLanguage } from './reader-copy';
import { responsiveImageSrcset } from './responsive-image';

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
