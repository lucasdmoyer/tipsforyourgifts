import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArticleCardComponent } from './article-card';
import { ContentService } from './content.service';
import { GIFT_PATHS, giftPathUrl } from './gift-paths';
import { SeoService } from './seo.service';

@Component({
  imports: [RouterLink, ArticleCardComponent],
  template: `
    <section class="shell section">
      <p class="eyebrow">Gift guides</p>
      <h1>The things they will not buy themselves.</h1>
      <p class="lede">A better tool for the hobby. A small luxury. The upgrade they keep postponing because the old one still works. Start there.</p>
      <div class="grid three gift-path-grid">
        @for (path of giftPaths; track path.id) {
          <article class="panel gift-path-card">
            <p class="eyebrow">{{ path.eyebrow }}</p>
            <h2>{{ path.title }}</h2>
            <p>{{ path.description }}</p>
            <a class="read" [routerLink]="giftPathUrl(path)">Follow this clue →</a>
          </article>
        }
      </div>
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
  readonly guides = this.content.articles.filter((article) => article.productCount > 0);
  readonly giftPaths = GIFT_PATHS;
  readonly giftPathUrl = giftPathUrl;
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Thoughtful gift guides', description: 'Gift ideas for the hobbies, useful upgrades, and small luxuries people keep postponing for themselves.', path: '/gifts' });
  }
}
