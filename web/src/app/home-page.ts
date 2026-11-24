import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArticleCardComponent } from './article-card';
import { HOME_ARTICLE_SUMMARIES } from './generated/home-summary.generated';
import { SeoService } from './seo.service';

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
        @for (post of articles; track post.slug) { <tfg-article-card [article]="post" /> }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage {
  readonly articles = HOME_ARTICLE_SUMMARIES;
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
