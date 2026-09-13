import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';

const blogDir = path.join(process.cwd(), 'src', 'data', 'blog');
const files = (await fs.readdir(blogDir)).filter((name) => name.endsWith('.md')).sort();
const errors = [];
const requiredHeadings = [
  'What this gift actually is',
  'How it fits into their real life',
  'What they may already have',
  'What the specialty gift adds',
  'Why this feels thoughtful',
  'Before you order'
];

const expect = (condition, message) => { if (!condition) errors.push(message); };
let guideCount = 0;

for (const fileName of files) {
  const source = await fs.readFile(path.join(blogDir, fileName), 'utf8');
  const { data, content } = matter(source);
  const products = Array.isArray(data.products) ? data.products : [];
  if (products.length === 0) continue;
  guideCount += 1;
  const label = data.slug ?? path.basename(fileName, '.md');

  expect(data.readerFormat === 'recipient-specialty-v1', `${label}: readerFormat must be recipient-specialty-v1`);
  expect(data.readerIntro?.bodyPlacement === 'before-products', `${label}: readerIntro.bodyPlacement must be before-products`);
  expect(/^If you know someone\b/.test(data.readerIntro?.lead ?? ''), `${label}: readerIntro.lead must begin "If you know someone"`);
  expect((data.readerIntro?.giftIdea?.length ?? 0) >= 40, `${label}: readerIntro.giftIdea must explain the gift idea in plain language`);
  expect(/^They may already\b/.test(data.specialtyLens?.generalPurpose ?? ''), `${label}: specialtyLens.generalPurpose must begin "They may already"`);
  expect((data.specialtyLens?.specialty?.length ?? 0) >= 50, `${label}: specialtyLens.specialty must explain the additional specialty value`);
  expect(/^Look for\b/.test(data.specialtyLens?.signal ?? ''), `${label}: specialtyLens.signal must begin "Look for"`);

  const h2Headings = [...content.matchAll(/^## (.+?)\s*$/gm)].map((match) => match[1]);
  for (const heading of requiredHeadings) {
    const matches = h2Headings.filter((candidate) => candidate === heading);
    expect(matches.length === 1, `${label}: body must contain exactly one "## ${heading}" heading (found ${matches.length})`);
  }
  expect(requiredHeadings.every((heading, index) => h2Headings[index] === heading), `${label}: the six standard H2 sections must appear first and in the required order`);
  const isReadAndPlayAppendix = label === 'read-it-then-play-it-gift-pairs';
  if (isReadAndPlayAppendix) {
    expect((content.match(/<!-- reader-details -->/g) ?? []).length === 1, `${label}: the deep pairing appendix needs one explicit reader-details boundary`);
    const appendixHeadings = h2Headings.slice(requiredHeadings.length);
    expect(appendixHeadings.length === 10 && appendixHeadings.every((heading, index) => heading.startsWith(`${index + 1}. If you know someone`)), `${label}: the appendix must retain ten ordered recipient-first pairing sections`);
  } else {
    expect(h2Headings.length === requiredHeadings.length, `${label}: product-choice guidance must use H3 so the six H2 sections remain standard`);
  }

  expect(!/\b(?:editorial score|evidence score|coherence gate|candidate products?|finalists?)\b/i.test(content), `${label}: reader body contains internal scoring or workflow language`);
  expect(/\bone gift (?:is|can be) enough\b/i.test(content), `${label}: body must explain that one gift can be enough`);

  for (const product of products) {
    expect(typeof product.url === 'string' && product.url.startsWith('https://'), `${label}/${product.id ?? 'unknown-product'}: product URL must use HTTPS`);
    expect(/^What it is:\s+/.test(product.whyItFits ?? ''), `${label}/${product.id ?? 'unknown-product'}: whyItFits must begin "What it is:"`);
    expect((product.whyItFits?.length ?? 0) >= 80, `${label}/${product.id ?? 'unknown-product'}: whyItFits must plainly explain the product and recipient fit`);
    expect((product.drawback?.length ?? 0) >= 35, `${label}/${product.id ?? 'unknown-product'}: drawback must contain a useful pre-purchase check`);
  }
}

expect(guideCount >= 12, `Expected at least 12 recommendation guides, found ${guideCount}`);

if (errors.length > 0) {
  console.error(`Guide format validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Guide format validation passed for ${guideCount} recommendation guides.`);
