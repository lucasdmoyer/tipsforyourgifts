import { Injectable } from '@angular/core';
import { ARTICLES } from './generated/content.generated';

@Injectable({ providedIn: 'root' })
export class ContentService {
  readonly articles = [...ARTICLES]
    .filter((article) => article.status === 'publication_ready')
    .sort((a, b) => b.publishDate.localeCompare(a.publishDate));
  getArticle(slug: string | null) {
    return this.articles.find((article) => article.slug === slug);
  }
}
