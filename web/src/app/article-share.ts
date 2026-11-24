import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

const SITE_ORIGIN = 'https://tipsforyourgifts.web.app';

export interface GuideShareData {
  title: string;
  text: string;
  url: string;
}

export interface ShareGateway {
  share?: (data: GuideShareData) => Promise<void>;
  writeText?: (value: string) => Promise<void>;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable';

export function articleShareUrl(slug: string) {
  return `${SITE_ORIGIN}/blog/${slug}`;
}

function isAbortError(error: unknown) {
  return (error instanceof DOMException && error.name === 'AbortError')
    || (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError');
}

export async function shareGuide(gateway: ShareGateway, data: GuideShareData, preferNative: boolean): Promise<ShareOutcome> {
  if (preferNative && gateway.share) {
    try {
      await gateway.share(data);
      return 'shared';
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
    }
  }
  if (!gateway.writeText) return 'unavailable';
  try {
    await gateway.writeText(data.url);
    return 'copied';
  } catch {
    return 'unavailable';
  }
}

@Component({
  selector: 'tfg-article-share',
  template: `
    <aside class="article-share-card" aria-labelledby="article-share-title">
      <div>
        <p class="eyebrow">Pass along the clue</p>
        <h2 id="article-share-title">Know who this sounds like?</h2>
        <p>Send this guide to the person doing the shopping—or save it for the next birthday.</p>
      </div>
      <div>
        <div class="actions article-share-actions">
          <button type="button" class="button" (click)="share()" data-event-name="article_share" data-share-method="native_or_copy" [attr.data-article-slug]="articleSlug()">Share this guide</button>
          <button type="button" class="button secondary" (click)="copy()" data-event-name="article_share" data-share-method="copy" [attr.data-article-slug]="articleSlug()">Copy link</button>
        </div>
        <p class="article-share-status" aria-live="polite">{{ status() }}</p>
      </div>
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArticleShareComponent {
  readonly articleSlug = input.required<string>();
  readonly articleTitle = input.required<string>();
  readonly articleDescription = input.required<string>();
  readonly status = signal('');

  async share() {
    await this.run(true);
  }

  async copy() {
    await this.run(false);
  }

  private async run(preferNative: boolean) {
    const browserNavigator = typeof navigator === 'undefined' ? undefined : navigator;
    const gateway: ShareGateway = {
      share: browserNavigator?.share ? (data) => browserNavigator.share(data) : undefined,
      writeText: browserNavigator?.clipboard?.writeText ? (value) => browserNavigator.clipboard.writeText(value) : undefined
    };
    const outcome = await shareGuide(gateway, {
      title: this.articleTitle(),
      text: this.articleDescription(),
      url: articleShareUrl(this.articleSlug())
    }, preferNative);
    this.status.set(outcome === 'shared'
      ? 'Shared.'
      : outcome === 'copied'
        ? 'Link copied.'
        : outcome === 'unavailable'
          ? "Copy this page's address from your browser."
          : '');
  }
}
