import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SeoService } from './seo.service';

@Component({
  template: `
    <article class="article-shell">
      <p class="eyebrow">Our gift philosophy</p>
      <h1>Buy the thing they would talk themselves out of.</h1>
      <p class="dek">People buy what they need. Gifts are for the better version, the curious detour, and the small luxury that never survives a practical conversation with yourself.</p>
      <div class="prose">
        <h2>People are good at buying what they need.</h2>
        <p>They replace the empty toothpaste. They order the charging cable. They buy the ordinary pan because dinner still has to happen.</p>
        <p>But the quieter wants are easy to postpone. The field guide for walks they already take. The nicer tool for a hobby they refuse to call serious. The small upgrade that would make every Saturday better, but feels too indulgent on a Tuesday.</p>
        <blockquote>A thoughtful gift says: I noticed the part of your life you keep putting second.</blockquote>
        <h2>Notice the almost.</h2>
        <p>Listen for “I have been meaning to.” Look for the improvised fix that has become permanent. Pay attention to what they borrow, admire, save, or keep researching without buying.</p>
        <p>The object is not the idea. The idea is that you saw the hesitation and understood what was underneath it.</p>
        <h2>A little indulgence is the point.</h2>
        <p>A gift does not need to be frivolous. It needs to cross a line the recipient will not cross alone: from good enough to genuinely enjoyable, from vague curiosity to a first real step, from someday to this weekend.</p>
        <h2>The everyday thing can stay.</h2>
        <p>Someone may already own a good general-purpose version: the phone app, the old towel, the plain palette, the ordinary storage box. That does not make the gift idea redundant.</p>
        <p>Look for the specialty extra built for the exact moment they care about. It should do one narrow job better without asking them to throw away something that already works.</p>
        <h2>When two gifts belong together.</h2>
        <p>Do not make a gift basket just because two products share a color. One thing should open the door and the other should create a moment: read and play, remember and record, notice and look closer.</p>
        <h2>Let the shopping disappear.</h2>
        <p>By the time the gift reaches them, the comparisons, dead ends, and practical checks should be invisible. What remains is a simple feeling: this is for me.</p>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StandardsPage {
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Our gift philosophy', description: 'A better gift begins with what someone loves, postpones, and rarely gives themselves permission to enjoy.', path: '/standards', structuredData: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Tips for Your Gifts gift philosophy' } });
  }
}
