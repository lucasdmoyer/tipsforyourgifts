import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

interface SeoOptions {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  type?: 'website' | 'article';
  image?: string;
  structuredData?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly origin = 'https://tipsforyourgifts.web.app';
  private readonly siteName = 'Tips for Your Gifts';

  set(options: SeoOptions) {
    const fullTitle = options.title === this.siteName ? options.title : `${options.title} | ${this.siteName}`;
    const canonical = new URL(options.path, this.origin).toString();
    const image = options.image ? new URL(options.image, this.origin).toString() : `${this.origin}/social-card.svg`;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: options.description });
    this.meta.updateTag({ name: 'robots', content: options.noindex ? 'noindex,nofollow' : 'index,follow' });
    this.meta.updateTag({ property: 'og:type', content: options.type ?? 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: this.siteName });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: options.description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: options.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    this.document.head.querySelector('link[rel="canonical"]')?.remove();
    const link = this.document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', canonical);
    this.document.head.appendChild(link);

    this.document.head.querySelector('script[data-tfg-json-ld]')?.remove();
    if (options.structuredData) {
      const script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-tfg-json-ld', 'true');
      script.textContent = JSON.stringify(options.structuredData).replace(/</g, '\\u003c');
      this.document.head.appendChild(script);
    }
  }
}
