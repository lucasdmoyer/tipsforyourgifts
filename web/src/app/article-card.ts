import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ArticleSummary } from './content.types';
import { readerDescription, readerTags, readerTitle } from './reader-copy';
import { responsiveImageFallback, responsiveImageSrcset } from './responsive-image';

@Component({
  selector: 'tfg-article-card',
  imports: [RouterLink],
  template: `
    <article class="article-card">
      <a class="article-card-visual" [routerLink]="['/blog', article().slug]" [attr.aria-label]="'Read ' + title(article())">
        <img [src]="imageFallback(article().visual.hero.src)" [attr.srcset]="imageSrcset(article().visual.hero.src)" sizes="(max-width: 620px) calc(100vw - 28px), (max-width: 860px) calc((100vw - 60px) / 2), 380px" [alt]="article().visual.hero.alt" width="1536" height="1024" loading="lazy" decoding="async">
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
  readonly article = input.required<ArticleSummary>();
  readonly imageFallback = responsiveImageFallback;
  readonly imageSrcset = responsiveImageSrcset;
  readonly description = readerDescription;
  readonly tags = readerTags;
  readonly title = readerTitle;
}
