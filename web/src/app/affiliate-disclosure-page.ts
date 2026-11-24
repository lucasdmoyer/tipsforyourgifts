import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ContentService } from './content.service';
import { SeoService } from './seo.service';

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
  readonly paidLinkCount = inject(ContentService).paidLinkCount;
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Affiliate disclosure', description: 'A plain-language explanation of paid links on Tips for Your Gifts.', path: '/affiliate-disclosure' });
  }
}
