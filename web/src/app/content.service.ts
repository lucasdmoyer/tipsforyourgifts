import { Injectable } from '@angular/core';
import { ARTICLE_SUMMARIES, CONTENT_STATS } from './generated/content-summary.generated';

@Injectable({ providedIn: 'root' })
export class ContentService {
  readonly articles = [...ARTICLE_SUMMARIES].sort((a, b) => b.publishDate.localeCompare(a.publishDate));
  readonly paidLinkCount = CONTENT_STATS.paidLinkCount;
}
