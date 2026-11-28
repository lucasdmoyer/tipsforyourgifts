import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ContentService } from './content.service';
import { browseGiftGuides, emptyGiftBrowseFilters, giftBudgets, giftRecipients, giftTopics, readGiftBrowseFilters, type GiftBrowseFilters } from './gift-browse';
import { readerDescription, readerTitle } from './reader-copy';
import { SeoService } from './seo.service';

@Component({
  imports: [RouterLink],
  templateUrl: './gift-browse-page.html',
  styleUrl: './gift-browse-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GiftBrowsePage {
  private readonly content = inject(ContentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly budgets = giftBudgets;
  readonly topics = giftTopics;
  readonly recipients = giftRecipients;
  readonly title = readerTitle;
  readonly description = readerDescription;
  readonly filters = computed(() => readGiftBrowseFilters(this.query()));
  readonly results = computed(() => browseGiftGuides(this.content.articles, this.filters()));
  readonly closedFilters = computed(() => !Object.values(this.filters()).some(Boolean));
  readonly badges = computed(() => {
    const filters = this.filters();
    return [
      { key: 'budget', label: this.budgets.find(({ value }) => value === filters.budget)?.label },
      { key: 'topic', label: this.topics.find(({ value }) => value === filters.topic)?.label },
      { key: 'for', label: this.recipients.find(({ value }) => value === filters.for)?.label },
    ] as const;
  });

  constructor() {
    inject(SeoService).set({
      title: 'Thoughtful gift guides by budget, interest and recipient',
      description: 'Find a thoughtful gift by what they love, who you are shopping for, and what you want to spend.',
      path: '/gifts',
    });
  }

  changeFilter(key: keyof GiftBrowseFilters, event: Event) {
    this.updateQuery({ [key]: (event.target as HTMLSelectElement).value });
  }

  removeFilter(key: keyof GiftBrowseFilters) {
    this.updateQuery({ [key]: '' });
  }

  private updateQuery(update: Partial<Record<keyof GiftBrowseFilters, string>>) {
    const next = { ...this.filters(), ...update };
    const safe = readGiftBrowseFilters({ get: (key) => next[key as keyof GiftBrowseFilters] ?? null });
    void this.router.navigate([], {
      relativeTo: this.route,
      scroll: 'manual',
      queryParamsHandling: 'merge',
      queryParams: { budget: safe.budget || null, topic: safe.topic || null, for: safe.for || null },
    });
  }

  resetFilters() {
    this.updateQuery(emptyGiftBrowseFilters);
  }
}
