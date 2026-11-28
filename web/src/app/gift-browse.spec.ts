import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { GiftBrowsePage } from './gift-browse-page';
import { browseGiftGuides, browseRules, emptyGiftBrowseFilters, readGiftBrowseFilters, softPriceCeiling, topicsForGift } from './gift-browse';
import { ARTICLES } from './generated/content.generated';

describe('gift guide shopping filters', () => {
  it('uses whole-item estimate ceilings, including open upper bounds, not pair totals or current price', () => {
    expect(softPriceCeiling('$25–$70')).toBe(70);
    expect(softPriceCeiling('Under $25')).toBe(25);
    expect(softPriceCeiling('$39.99')).toBe(39.99);
    for (const band of [undefined, '$75-$25', '$20 and up', '$25-$75; recheck live bundle subtotal', 'All budgets']) {
      expect(softPriceCeiling(band)).toBeNull();
    }
  });

  it('accepts only defined query options', () => {
    expect(readGiftBrowseFilters(new URLSearchParams('budget=25&topic=games&for=wife'))).toEqual({ budget: '25', topic: 'games', for: 'wife' });
    expect(readGiftBrowseFilters(new URLSearchParams('budget=-1&topic=secret&for=unknown'))).toEqual(emptyGiftBrowseFilters);
  });

  it('matches topic and budget on the same product and links to a real article section', () => {
    const results = browseGiftGuides(ARTICLES, { budget: '25', topic: 'games', for: 'wife' });
    expect(results.flatMap(({ picks }) => picks.map(({ product }) => product.id))).toContain('wingspan-digital-steam');
    expect(results.flatMap(({ picks }) => picks.map(({ product }) => product.id))).not.toContain('civilization-vi-windows-steam');
    expect(results.flatMap(({ picks }) => picks.map(({ product }) => product.id))).not.toContain('genius-of-birds-paperback');
    for (const { article, picks } of results) for (const { product, fragment } of picks) {
      expect(topicsForGift(article, product)).toContain('games');
      expect(softPriceCeiling(product.priceBand)).toBeLessThanOrEqual(25);
      expect([product.id, ...article.pairs.map(({ id }) => id)]).toContain(fragment);
    }
  });

  it('keeps draft, editorial-only and unreviewed child suggestions out, and treats parent roles equally', () => {
    const draft = { ...ARTICLES[0], status: 'draft' as const };
    expect(browseGiftGuides([...ARTICLES, draft], emptyGiftBrowseFilters)).toHaveLength(ARTICLES.filter((article) => article.products.length).length);
    expect(browseGiftGuides(ARTICLES, { ...emptyGiftBrowseFilters, for: 'kids' })).toEqual([]);
    expect(browseGiftGuides(ARTICLES, { ...emptyGiftBrowseFilters, for: 'mom' })).toEqual(browseGiftGuides(ARTICLES, { ...emptyGiftBrowseFilters, for: 'dad' }));
    expect(browseGiftGuides(ARTICLES, { ...emptyGiftBrowseFilters, for: 'mom' }).map(({ article }) => article.slug)).toContain('one-photo-one-story-gift-pairs');
    expect(browseGiftGuides(ARTICLES, { ...emptyGiftBrowseFilters, for: 'niece' }).map(({ article }) => article.slug)).not.toContain('one-photo-one-story-gift-pairs');
  });

  it('gates catalog changes on explicit audience and topic coverage', () => {
    const guides = ARTICLES.filter((article) => article.products.length);
    for (const guide of guides) {
      expect(browseRules[guide.slug]?.audiences.length, guide.slug).toBeGreaterThan(0);
      for (const product of guide.products) expect(topicsForGift(guide, product).length, product.id).toBeGreaterThan(0);
      for (const productId of Object.keys(browseRules[guide.slug]?.productTopics ?? {})) expect(guide.products.map(({ id }) => id)).toContain(productId);
    }
  });

  it('hydrates the form from a shareable URL, changes it using the controls and clears only filters', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'gifts', component: GiftBrowsePage }])] });
    const harness = await RouterTestingHarness.create('/gifts?topic=games&for=wife&utm_source=test');
    const root = harness.routeNativeElement!;
    const select = root.querySelector<HTMLSelectElement>('#gift-budget')!;
    expect(root.querySelector<HTMLSelectElement>('#gift-topic')?.value).toBe('games');
    expect(root.querySelector<HTMLSelectElement>('#gift-for')?.value).toBe('wife');
    select.value = '25';
    select.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
    const router = TestBed.inject(Router);
    expect(router.url).toContain('budget=25');
    expect(root.querySelector('[role="status"]')?.textContent).toMatch(/\d+ guides? found/);
    expect(root.querySelectorAll('.shop-badges button')).toHaveLength(3);
    root.querySelector<HTMLButtonElement>('.shop-reset')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/gifts?utm_source=test');
    expect(root.querySelectorAll('.shop-card')).toHaveLength(ARTICLES.filter((article) => article.products.length).length);
  });
});
