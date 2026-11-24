import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ArticleCardComponent } from './article-card';
import { ContentService } from './content.service';
import { SeoService } from './seo.service';

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
