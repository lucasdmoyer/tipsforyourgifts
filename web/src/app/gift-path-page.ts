import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContentService } from './content.service';
import { ArticleCardComponent } from './article-card';
import { findGiftPath, giftPathArticles, giftPathUrl } from './gift-paths';
import { SeoService } from './seo.service';

@Component({
  imports: [RouterLink, ArticleCardComponent],
  template: `
    @if (path) {
      <section class="shell finder-hero gift-path-hero">
        <div>
          <p class="eyebrow">{{ path.eyebrow }}</p>
          <h1>{{ path.title }}</h1>
          <p class="lede">{{ path.lead }}</p>
        </div>
        <aside class="panel gift-path-signal">
          <p class="eyebrow">The clue</p>
          <h2>Start with what you have noticed.</h2>
          <p>{{ path.shopperCue }}</p>
        </aside>
      </section>

      <section class="shell section compact-section">
        <div class="section-heading gift-path-heading">
          <div><p class="eyebrow">Ideas that fit the clue</p><h2>{{ guides.length }} ways to make it personal</h2></div>
          <p>{{ path.description }}</p>
        </div>
        <div class="grid three spaced-grid">
          @for (guide of guides; track guide.slug) { <tfg-article-card [article]="guide" /> }
        </div>
      </section>

      <section class="mint-section">
        <div class="shell section gift-path-closing">
          <div><p class="eyebrow">Still choosing?</p><h2>Let the person narrow the product.</h2></div>
          <p>Use one thing you have seen them do, postpone, or work around. That clue is more useful than a list of supposedly universal gifts.</p>
          <div class="actions">
            <a class="button" routerLink="/gift-finder">Use the gift finder</a>
            <a class="button secondary" routerLink="/gifts">Browse every guide</a>
          </div>
        </div>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GiftPathPage {
  private readonly route = inject(ActivatedRoute);
  private readonly content = inject(ContentService);
  private readonly seo = inject(SeoService);
  readonly path = findGiftPath(this.route.snapshot.data['giftPath'] as string | undefined);
  readonly guides = this.path ? giftPathArticles(this.path, this.content.articles) : [];

  constructor() {
    if (!this.path) return;
    const canonicalPath = giftPathUrl(this.path);
    this.seo.set({
      title: this.path.title,
      description: this.path.description,
      path: canonicalPath,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: this.path.title,
        description: this.path.description,
        url: `https://tipsforyourgifts.web.app${canonicalPath}`,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: this.guides.length,
          itemListElement: this.guides.map((article, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: article.title,
            url: `https://tipsforyourgifts.web.app/blog/${article.slug}`
          }))
        }
      }
    });
  }
}
