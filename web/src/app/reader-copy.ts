import type { Article } from './content.types';

interface ReaderArticleCopy {
  title?: string;
  description: string;
  giftIdea: string;
  bodyHtml?: string;
}

const ARTICLE_READER_COPY: Record<string, ReaderArticleCopy> = {
  'gifts-for-a-golf-friend': {
    description: 'Golfers will debate a new club for six months and tolerate the same little annoyances forever. These gifts fix the parts of the game they have stopped complaining about.',
    giftIdea: 'Do not buy them a new golf identity. Fix the small annoyance they have learned to live with.'
  },
  'how-we-research-gifts': {
    title: 'The Gift Hiding in Plain Sight',
    description: 'A good gift should feel simple when it lands: you saw something, you understood it, and you chose well. The homework belongs to us.',
    giftIdea: 'The recommendation is not the gift. Feeling understood is.',
    bodyHtml: `<p>Most bad gifts begin with the occasion. Birthday. Christmas. Anniversary. A square on the calendar appears, and suddenly we are shopping for a person as if we have never met them.</p>
<p>The better gift usually showed itself weeks ago.</p>
<h2>The present is already in the room</h2>
<p>It is the towel they complain about every Saturday and never replace. The book they pick up in every bookstore. The hobby they insist is “not serious enough” for the good tools.</p>
<p>People tell us what they want all the time. Rarely in a sentence beginning with “please buy me.” More often it sounds like “someday,” “the old one still works,” or “I cannot really justify it.”</p>
<blockquote>That little refusal is not the end of the idea. Sometimes it is the idea.</blockquote>
<h2>Useful can still feel luxurious</h2>
<p>A thoughtful gift does not have to sit on a shelf and sparkle. The indulgence might be a tool that works beautifully, a routine without the usual annoyance, or permission to take a curiosity seriously.</p>
<p>The ordinary version solves a problem. The right version changes how the moment feels.</p>
<h2>Do not give them a new personality</h2>
<p>A telescope does not turn someone into an astronomer. A complicated kitchen gadget does not create a cook. The gift should meet a person where they already are and make the next step easier, richer, or more fun.</p>
<p>If you cannot picture them using it, do not let attractive packaging finish the story for you.</p>
<h2>The best reaction comes later</h2>
<p>The first reaction is nice. The better one happens three months later, when you see the gift on their desk, in their bag, or folded into a Saturday ritual.</p>
<p>That is when a present stops being an object and becomes proof: you were paying attention.</p>`
  },
  'language-learning-gifts-read-a-scene-say-it-aloud': {
    description: 'They do not need another promise to become fluent. They need a story worth repeating and a reason to speak before they feel perfectly ready.',
    giftIdea: 'Give them a small stage where practice feels more like play.'
  },
  'miniature-painting-wet-palette-recipe-pairs': {
    description: 'The perfect paint mix always disappears between sessions. Give them a way to keep the color alive—and remember how they made it.',
    giftIdea: 'The luxury is not more paint. It is returning tomorrow without starting over.'
  },
  'neighborhood-tree-walk-field-guide-loupe-gift-pairs': {
    description: 'They already stop to look at trees. This gives that curiosity a name, a closer look, and a reason to take the long way home.',
    giftIdea: 'Turn a habit they already have into a ritual they will look forward to.'
  },
  'night-sky-planisphere-red-light-gift-pairs': {
    description: 'A telescope is a commitment. A sky chart and a red light are an invitation: step outside, look up, and know what you are looking at.',
    giftIdea: 'Give them the beginning of a hobby, not the burden of becoming an expert.'
  },
  'one-photo-one-story-gift-pairs': {
    description: 'Every family has a photograph no one has explained yet. This gift turns one old image into a story everyone gets to keep.',
    giftIdea: 'The frame holds the photograph. The prompt gives the photograph back its voice.'
  },
  'puzzle-board-sorting-tray-gift-pairs': {
    description: 'The table is not the puzzle. The table is why the puzzle never gets started. Give them a way to pause without losing the whole afternoon.',
    giftIdea: 'Remove the small household negotiation standing between them and something they enjoy.'
  },
  'read-it-then-play-it-gift-pairs': {
    description: 'Some people finish a book and immediately want to argue with it. Give them somewhere to put that curiosity.',
    giftIdea: 'One gift opens the idea. The other lets them test it, bend it, and talk about it later.'
  },
  'useful-gifts-for-hard-to-shop-for-adults': {
    description: 'They buy what they need. That is exactly why you should give them the better version of something they keep settling for.',
    giftIdea: 'Look for the useful thing they would enjoy every week but cannot quite justify upgrading today.'
  }
};

const INTERNAL_SECTION_PATTERN = /<h2>(?:Every finalist has to earn its place|Four pairs we rejected|What did not qualify|What the research rejected|What we left out)<\/h2>[\s\S]*?(?=<h2>|$)/gi;

export function readerLanguage(value: string) {
  return value
    .replace(/\bThe pair clears a \d+\/100 coherence gate because\b/gi, 'The pair works because')
    .replace(/\bThis pair scores \d+\/100(?: for coherence)?\.\s*/gi, '')
    .replace(/\bThe pair scores \d+\/100\.\s*/gi, '')
    .replace(/\bstrongest researched anchor\b/gi, 'best fit here')
    .replace(/\bthis guide is the wrong research brief\b/gi, 'this is the wrong guide')
    .replace(/\bthis research did not find enough [^.]+? to (?:recommend|promote) (?:one|it)(?: here)?\b/gi, 'the fit is too hard to verify online, so I would skip it here')
    .replace(/\bcomplete evidence set\b/gi, 'complete set of clues')
    .replace(/\buse four gates\b/gi, 'ask four questions')
    .replace(/\bdimension-qualified\b/gi, 'properly sized')
    .replace(/\bindependently qualified\b/gi, 'well-supported')
    .replace(/\bconditionally qualified\b/gi, 'fit-sensitive')
    .replace(/\bqualified\b/gi, 'suitable')
    .replace(/\bdemoted\b/gi, 'left out')
    .replace(/\bcleared? (?:the|our) (?:same )?(?:product |evidence and drawback )?gates?\b/gi, 'passed the practical checks')
    .replace(/\bpublication-ready\b/gi, 'ready to share')
    .replace(/This draft must also pass independent editorial QA before it can become ready to share\./gi, '')
    .replace(/This bundle suitable on a time-limited Steam price, so hold it whenever a fresh subtotal no longer clears the approved ceiling/gi, 'This bundle fit the budget only on a time-limited Steam price, so skip it if the current subtotal no longer fits yours');
}

function readerArticleHtml(value: string) {
  const firstSection = value.indexOf('<h2>');
  const withoutPreamble = firstSection >= 0 ? value.slice(firstSection) : value;
  return readerLanguage(
    withoutPreamble
      .replace(INTERNAL_SECTION_PATTERN, '')
      .replace('<h2>One qualified record companion, two alternative palette configurations</h2>', '<h2>One way to remember the color, two palettes to choose from</h2>')
      .replace(/<h2>Qualified pair (one|two):/gi, '<h2>Pair $1:')
      .replace('<h2>Two independently qualified alternatives—not automatic pair members</h2>', '<h2>Two alternatives if the fit is better</h2>')
      .replace('<h2>The large-workspace unpaired alternative</h2>', '<h2>For a large, permanent workspace</h2>')
      .replace('<th>Research decision</th>', '<th>Best fit</th>')
  );
}

export function readerDescription(article: Article) {
  return ARTICLE_READER_COPY[article.slug]?.description ?? article.description;
}

export function readerTitle(article: Article) {
  return ARTICLE_READER_COPY[article.slug]?.title ?? article.title;
}

export function readerGiftIdea(article: Article) {
  return ARTICLE_READER_COPY[article.slug]?.giftIdea ?? 'Give them something that proves you noticed.';
}

export function readerTags(article: Article) {
  if (article.slug === 'how-we-research-gifts') return ['thoughtful gifts', 'gift ideas', 'how to choose'];
  return article.tags;
}

export function readerBodyHtml(article: Article) {
  return ARTICLE_READER_COPY[article.slug]?.bodyHtml ?? readerArticleHtml(article.contentHtml);
}
