import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from './seo.service';

@Component({
  imports: [RouterLink],
  template: `<section class="shell section"><p class="eyebrow">404</p><h1>No present here.</h1><p class="lede">This page wandered off. The person you are shopping for is still waiting.</p><a class="button" routerLink="/">Start again</a></section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundPage {
  private readonly seo = inject(SeoService);
  constructor() { this.seo.set({ title: 'Page not found', description: 'The requested Tips for Your Gifts page could not be found.', path: '/404', noindex: true }); }
}
