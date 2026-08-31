import type { Article } from './content.types';

interface ReaderArticleCopy {
  title?: string;
  description: string;
  lead: string;
  giftIdea: string;
  bodyHtml?: string;
}

const ARTICLE_READER_COPY: Record<string, ReaderArticleCopy> = {
  'gifts-for-a-golf-friend': {
    description: 'Golfers will debate a new club for six months and tolerate the same little annoyances forever. These gifts fix the parts of the game they have stopped complaining about.',
    lead: 'If you know someone who likes golf, start with the little course-day annoyance they have learned to live with.',
    giftIdea: 'Do not buy them a new golf identity. Fix the small annoyance they have learned to live with.',
    bodyHtml: `<h2>What makes this feel personal</h2>
<p>A golfer usually has opinions about clubs, balls, shoes, and every other piece of serious equipment. The safer gift is often the useful upgrade hiding in plain sight: a better way to clean a club, handle wet weather, or practice the shot they already talk about.</p>
<p>Look at what is worn, missing, or improvised in their current routine. That small observation is what turns golf gear into their gift.</p>`
  },
  'how-we-research-gifts': {
    title: 'The Gift Hiding in Plain Sight',
    description: 'A good gift should feel simple when it lands: you saw something, you understood it, and you chose well. The homework belongs to us.',
    lead: 'If you know someone well enough to notice what they postpone, you already know where the best gifts begin.',
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
    lead: 'If you know someone who likes learning Spanish, give them a story to read and a reason to say it out loud.',
    giftIdea: 'Give them a small stage where practice feels more like play.',
    bodyHtml: `<h2>What makes this feel personal</h2>
<p>Language practice becomes easier when it has a scene, a character, and something worth saying. Start with a book at the learner's real level. Then add a playful prompt only if they enjoy speaking, improvising, or playing with other people.</p>
<p>The pairing should make practice feel lighter. If it would feel like assigned homework, the book alone is the better gift.</p>`
  },
  'miniature-painting-wet-palette-recipe-pairs': {
    description: 'The perfect paint mix always disappears between sessions. Give them a way to keep the color alive—and remember how they made it.',
    lead: 'If you know someone who likes painting miniatures, help them keep the color they mixed today for the model they paint tomorrow.',
    giftIdea: 'The luxury is not more paint. It is returning tomorrow without starting over.',
    bodyHtml: `<h2>What makes this feel personal</h2>
<p>Miniature painters often lose time in two places: the paint dries while they work, and the recipe disappears before the next session. A wet palette helps with the first problem. A simple paint journal helps with the second.</p>
<p>Choose one palette for the desk space they actually have. Pair it with the journal only if they are the kind of painter who enjoys keeping notes.</p>`
  },
  'neighborhood-tree-walk-field-guide-loupe-gift-pairs': {
    description: 'They already stop to look at trees. This gives that curiosity a name, a closer look, and a reason to take the long way home.',
    lead: 'If you know someone who likes stopping to look at trees, give them a guide for the big picture and a loupe for the tiny details.',
    giftIdea: 'Turn a habit they already have into a ritual they will look forward to.',
    bodyHtml: `<h2>What makes this feel personal</h2>
<p>The right field guide makes a familiar walk feel new. A small loupe adds the pleasure of seeing the details people usually pass by: a bud, a leaf edge, or the texture of a twig.</p>
<p>Choose the guide for the place they actually walk. Add the loupe only if close-up viewing is comfortable and genuinely sounds like their kind of fun.</p>`
  },
  'night-sky-planisphere-red-light-gift-pairs': {
    description: 'A telescope is a commitment. A sky chart and a red light are an invitation: step outside, look up, and know what you are looking at.',
    lead: 'If you know someone who likes looking at the night sky, give them a simple way to find one pattern and then another.',
    giftIdea: 'Give them the beginning of a hobby, not the burden of becoming an expert.',
    bodyHtml: `<h2>What makes this feel personal</h2>
<p>A planisphere answers the first question—what am I looking at?—without asking someone to buy a telescope or learn an app. A dim red light lets them check the chart without flooding the moment with bright white light.</p>
<p>The important detail is latitude. Choose the wheel for the place where they normally look up, and skip the pair if they prefer using their phone.</p>`
  },
  'one-photo-one-story-gift-pairs': {
    description: 'Every family has a photograph no one has explained yet. This gift turns one old image into a story everyone gets to keep.',
    lead: 'If you know someone who likes family stories, help them turn one old photograph into a memory everyone can keep.',
    giftIdea: 'The photograph starts the memory. The prompt gives it room to speak.',
    bodyHtml: `<h2>What makes this feel personal</h2>
<p>Choose one ordinary photograph with a story behind it. A gentle prompt can help the story begin, while a separate caption page or envelope keeps the names, date, and place close to the picture.</p>
<p>This works only when the storyteller wants to take part. Keep the conversation short, let them skip any question, and never write on or attach anything to the original photograph.</p>`
  },
  'puzzle-board-sorting-tray-gift-pairs': {
    description: 'The table is not the puzzle. The table is why the puzzle never gets started. Give them a way to pause without losing the whole afternoon.',
    lead: 'If you know someone who likes jigsaw puzzles, remove the part where the dining table has to stay occupied for a week.',
    giftIdea: 'Remove the small household negotiation standing between them and something they enjoy.',
    bodyHtml: `<h2>What makes this feel personal</h2>
<p>A puzzle board protects the part they have already built. Sorting trays protect the little systems they make along the way. Together, they make it easier to stop for dinner and begin again tomorrow.</p>
<p>Measure the finished puzzles they usually buy and the place where the board will be stored. A beautiful system is not useful if it does not fit the house.</p>`
  },
  'read-it-then-play-it-gift-pairs': {
    description: 'Some people finish a book and immediately want to argue with it. Give them somewhere to put that curiosity.',
    lead: 'If you know someone who likes books, games, and talking about ideas, pair something to read with something that lets them test the idea.',
    giftIdea: 'One gift opens the idea. The other lets them test it, bend it, and talk about it later.',
    bodyHtml: `<h2>What makes this feel personal</h2>
<p>A book-and-game pair works when both gifts circle the same question in different ways. The book gives them an argument, story, or way of seeing. The game gives them choices to make and something to talk about afterward.</p>
<p>Match the game to the people, platform, time, and rules they already enjoy. If any of that is uncertain, the book can still be a complete gift on its own.</p>`
  },
  'useful-gifts-for-hard-to-shop-for-adults': {
    description: 'They buy what they need. That is exactly why you should give them the better version of something they keep settling for.',
    lead: 'If you know someone who likes useful things but rarely upgrades them, give them the better version they keep talking themselves out of.',
    giftIdea: 'Look for the useful thing they would enjoy every week but cannot quite justify upgrading today.',
    bodyHtml: `<h2>What makes this feel personal</h2>
<p>Useful gifts work when they replace an annoyance you have actually seen. Think about the chaotic travel bag, the noisy mouse, the phone flashlight on every dog walk, or the wrong screwdriver pressed into service again.</p>
<p>The object may be practical. The thought is personal: I noticed where your day keeps getting harder than it needs to be.</p>`
  }
};

const INTERNAL_SECTION_PATTERN = /<h2>(?:Every finalist has to earn its place|Four pairs we rejected|What did not qualify|What the research rejected|What we left out)<\/h2>[\s\S]*?(?=<h2>|$)/gi;

export function readerLanguage(value: string) {
  return value
    .replace(/\bThe pair clears a \d+\/100 coherence gate because\b/gi, 'The pair works because')
    .replace(/\bThis pair scores \d+\/100(?: for coherence)?\.\s*/gi, '')
    .replace(/\bThe pair scores \d+\/100\.\s*/gi, '')
    .replace(/\bstrongest researched anchor\b/gi, 'best fit here')
    .replace(/\bresearched analog guide\b/gi, 'analog guide')
    .replace(/\bindependently reviewed artist system\b/gi, 'small artist palette')
    .replace(/\bindependently reviewed XL system\b/gi, 'XL palette')
    .replace(/\bindependently qualified alternative\b/gi, 'straightforward alternative')
    .replace(/\bindependent exact-edition reviews disagree about whether\b/gi, 'Readers disagree about whether')
    .replace(/\bindependent reviews report\b/gi, 'Some users report')
    .replace(/\bcurrent owner reviews on the product page report\b/gi, 'some owners report')
    .replace(/\bthe same qualified\b/gi, 'the same')
    .replace(/\bthe qualified\b/gi, 'the')
    .replace(/\bpair qualifies only\b/gi, 'pair works best only')
    .replace(/\bfounder’s \$75 ceiling\b/gi, '$75 budget')
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

export function readerLead(article: Article) {
  return ARTICLE_READER_COPY[article.slug]?.lead ?? `If you know someone who likes ${article.audience}, start with what they already enjoy.`;
}

export function readerTags(article: Article) {
  if (article.slug === 'how-we-research-gifts') return ['thoughtful gifts', 'gift ideas', 'how to choose'];
  return article.tags;
}

export function readerBodyHtml(article: Article) {
  return ARTICLE_READER_COPY[article.slug]?.bodyHtml ?? readerArticleHtml(article.contentHtml);
}
