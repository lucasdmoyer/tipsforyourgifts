import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from './content.service';
import { findGiftGuides, type GiftShape, type RecipientSignal } from './gift-finder';
import { readerDescription } from './reader-copy';
import { responsiveImageFallback, responsiveImageSrcset } from './responsive-image';
import { SeoService } from './seo.service';

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
            <option value="unsure">Show me four thoughtful starting points</option>
            <option value="practical_relief">They keep working around a small annoyance</option>
            <option value="maker_pause">They make, paint, knit, or puzzle</option>
            <option value="learning_by_doing">They love learning by doing</option>
            <option value="look_closer">They notice nature, trees, or the night sky</option>
            <option value="family_story">They light up around family stories and old photos</option>
            <option value="golf_routine">They play golf and have a course-day workaround</option>
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
                <a class="finder-result-visual" [routerLink]="['/blog', result.article.slug]" [attr.aria-label]="'Read ' + result.article.title">
                  <span class="finder-result-rank" aria-hidden="true">0{{ rank + 1 }}</span>
                  <img [src]="imageFallback(result.article.visual.hero.src)" [attr.srcset]="imageSrcset(result.article.visual.hero.src)" sizes="(max-width: 620px) calc(100vw - 56px), 240px" [alt]="result.article.visual.hero.alt" width="1536" height="1024" loading="lazy" decoding="async">
                </a>
                <div class="finder-result-copy">
                  <p class="eyebrow">{{ result.article.priceBand }} · {{ result.article.productCount }} idea{{ result.article.productCount === 1 ? '' : 's' }}@if (result.article.pairCount > 0) { · {{ result.article.pairCount }} pairing{{ result.article.pairCount === 1 ? '' : 's' }} }</p>
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
  readonly imageFallback = responsiveImageFallback;
  readonly imageSrcset = responsiveImageSrcset;

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
