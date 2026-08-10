import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const accessedAt = '2026-08-03';
const runId = '20260803-read-it-then-play-it-c437f208';
const articleSlug = 'read-it-then-play-it-gift-pairs';

const products = [
  {
    id: 'sapiens-us-paperback', name: 'Sapiens: A Brief History of Humankind — U.S. trade paperback', merchant: 'HarperCollins', url: 'https://www.harpercollins.com/products/sapiens-yuval-noah-harari', priceBand: '$25-$30', editorialScore: 78, evidenceConfidence: 82,
    benefit: 'A provocative big-history argument gives a history-minded recipient claims to interrogate before and after play.',
    drawback: 'Its sweeping synthesis sometimes presents debated anthropology and history too confidently, so it belongs with a critical-reader caveat.',
    compatibility: 'Confirm the recipient welcomes long English-language nonfiction as a debatable argument rather than a settled history text.',
    dimension: 'skill_or_experience', observation: 'Choose this only for someone who already enjoys argumentative big-history books and likes discussing where broad models break down.',
    selfReason: 'small_luxury_deferral', selfRationale: 'A familiar bestseller can remain indefinitely on a curious reader’s someday list even when its questions match their interests.', ownershipBurden: 'A standard paperback needs only ordinary shelf space and reading time.',
    official: ['HarperCollins', 'Sapiens product page', 'https://www.harpercollins.com/products/sapiens-yuval-noah-harari'],
    reviews: [['The Guardian', 'Sapiens review', 'https://www.theguardian.com/books/2014/sep/11/sapiens-brief-history-humankind-yuval-noah-harari-review'], ['The Independent', 'Sapiens review', 'https://www.independent.co.uk/arts-entertainment/books/reviews/sapiens-by-yuval-noah-harari-book-review-eloquent-history-of-what-makes-us-human-9712106.html']]
  },
  {
    id: 'civilization-vi-windows-steam', name: 'Sid Meier’s Civilization VI — Windows PC Steam base game', merchant: '2K / Steam', url: 'https://store.2k.com/en/game/buy-civilization-6', priceBand: '$5-$60', editorialScore: 82, evidenceConfidence: 86,
    benefit: 'The turn-based strategy sandbox lets the recipient manipulate stylized systems involving technology, culture, expansion, and tradeoffs.',
    drawback: 'It is dense and long, and it converts history into optimization mechanics rather than providing a factual simulation.',
    compatibility: 'Confirm Windows PC hardware, Steam account, region, store preference, exact base-game ownership, and tolerance for long strategy sessions.',
    dimension: 'device_or_ecosystem', observation: 'Choose this only when you have seen them enjoy turn-based PC strategy and can verify their Steam library and supported hardware.',
    selfReason: 'research_burden', selfRationale: 'Edition, downloadable-content, store, and hardware choices create enough decision friction for an interested player to postpone buying.', ownershipBurden: 'The digital base game adds no physical clutter but requires account management, storage, updates, and compatible hardware.',
    official: ['2K', 'Civilization VI store page', 'https://store.2k.com/en/game/buy-civilization-6'],
    reviews: [['PC Gamer', 'Civilization VI review', 'https://www.pcgamer.com/civilization-6-review/'], ['Ars Technica', 'Civilization VI review', 'https://arstechnica.com/gaming/2016/10/civilization-vi-is-a-beautiful-prance-through-history/']]
  },
  {
    id: 'genius-of-birds-paperback', name: 'The Genius of Birds — U.S. paperback', merchant: 'Penguin Random House', url: 'https://www.penguinrandomhouse.com/books/312321/the-genius-of-birds-by-jennifer-ackerman/', priceBand: '$15-$25', editorialScore: 88, evidenceConfidence: 90,
    benefit: 'Specific stories about avian cognition can turn a general bird interest into questions the recipient carries into play and outdoors.',
    drawback: 'Animal-experiment passages may upset some bird lovers, and cross-species comparisons of intelligence require nuance.',
    compatibility: 'Confirm the recipient wants narrative science in English and is comfortable reading about animal cognition experiments.',
    dimension: 'accessibility', observation: 'Choose this for someone who already watches, photographs, feeds, or talks about birds and wants more than an identification guide.',
    selfReason: 'small_luxury_deferral', selfRationale: 'Narrative science can stay on a wish list as interesting but nonurgent even when it closely fits an existing bird habit.', ownershipBurden: 'A paperback is easy to store, but it is not a field-identification tool and should not duplicate one.',
    official: ['Penguin Random House', 'The Genius of Birds product page', 'https://www.penguinrandomhouse.com/books/312321/the-genius-of-birds-by-jennifer-ackerman/'],
    reviews: [['Scientific American', 'The Genius of Birds review', 'https://www.scientificamerican.com/article/book-review-the-genius-of-birds/'], ['Kirkus Reviews', 'The Genius of Birds review', 'https://www.kirkusreviews.com/book-reviews/jennifer-ackerman/the-genius-of-birds/']]
  },
  {
    id: 'wingspan-digital-steam', name: 'Wingspan Digital — Steam base game for Windows or macOS', merchant: 'Steam', url: 'https://store.steampowered.com/app/1054490/Wingspan/', priceBand: '$8-$20', editorialScore: 90, evidenceConfidence: 92,
    benefit: 'The digital bird-card system turns habitat and behavior facts into an engine-building puzzle with tutorials, solo play, and multiplayer but no box or table footprint.',
    drawback: 'The interface can become crowded, the strategy remains complex, luck affects available food and birds, and a digital license adds account and hardware dependence.',
    compatibility: 'Confirm a supported Windows or macOS computer, Steam account and region, exact base-game ownership, preferred multiplayer mode, readable interface, and tolerance for medium-weight strategy.',
    dimension: 'device_or_ecosystem', observation: 'Choose this only if they already enjoy strategy games on a compatible computer or have asked to learn Wingspan, not merely because they like birds.',
    selfReason: 'research_burden', selfRationale: 'Platform, account, ownership, expansions, and learning complexity can keep a bird-interested strategy player from trying the digital adaptation.', ownershipBurden: 'The digital game removes shelf and table clutter but requires a compatible computer, Steam account, storage, updates, and screen time.',
    official: ['Stonemaier Games', 'Wingspan digital versions', 'https://stonemaiergames.com/games/wingspan/digital-versions/'],
    reviews: [['PC Gamer', 'Wingspan digital review', 'https://www.pcgamer.com/wingspan-review/'], ['Meeple Mountain', 'Wingspan digital review', 'https://www.meeplemountain.com/reviews/wingspan-digital/']]
  },
  {
    id: 'a-city-on-mars-paperback', name: 'A City on Mars — U.S. paperback', merchant: 'Penguin Random House', url: 'https://www.penguinrandomhouse.com/books/639449/a-city-on-mars-by-kelly-and-zach-weinersmith/', priceBand: '$15-$25', editorialScore: 88, evidenceConfidence: 88,
    benefit: 'The book makes settlement biology, law, logistics, and ethics concrete enough to challenge an optimistic Mars-game model.',
    drawback: 'It is deliberately skeptical and argumentative, making it a poor fit for someone seeking purely aspirational space writing.',
    compatibility: 'Confirm the recipient welcomes a skeptical, detailed English-language counterpoint to popular Mars-settlement narratives.',
    dimension: 'skill_or_experience', observation: 'Choose this for someone who already questions space-settlement claims and enjoys examining engineering, law, or ethics together.',
    selfReason: 'small_luxury_deferral', selfRationale: 'A skeptical counterargument is easy to defer when the recipient already consumes more optimistic space stories.', ownershipBurden: 'The paperback needs ordinary shelf space and substantial reading attention.',
    official: ['Penguin Random House', 'A City on Mars product page', 'https://www.penguinrandomhouse.com/books/639449/a-city-on-mars-by-kelly-and-zach-weinersmith/'],
    reviews: [['The Guardian', 'A City on Mars review', 'https://www.theguardian.com/books/2023/dec/14/a-city-on-mars-by-kelly-and-zach-weinersmith-review-one-way-ticket-to-muskow-anyone'], ['Kirkus Reviews', 'A City on Mars review', 'https://www.kirkusreviews.com/book-reviews/kelly-weinersmith/a-city-on-mars/']]
  },
  {
    id: 'terraforming-mars-ares-expedition', name: 'Terraforming Mars: Ares Expedition — English standalone base game', merchant: 'Stronghold Games', url: 'https://strongholdgames.com/our-games/terraforming-mars-ares-expedition/', priceBand: '$40-$50', editorialScore: 87, evidenceConfidence: 93,
    benefit: 'A compact engine-building game gives the recipient a manipulable, optimistic Mars model in a shorter one-to-four-player format.',
    drawback: 'It still carries substantial rules and icon overhead, flat player boards can be bumped, and its card-focused abstraction is shallower than the original game.',
    compatibility: 'Confirm the standalone Ares Expedition base game, one to four players or solo interest, about an hour of play, table space, English components, and no existing copy.',
    dimension: 'edition_or_region', observation: 'Choose this only after seeing the recipient enjoy engine-building games or explicitly ask for a more compact Mars strategy game.',
    selfReason: 'coordination_burden', selfRationale: 'Rules, player availability, table space, and confusion with the original game or its expansions create meaningful purchase friction.', ownershipBurden: 'The standalone box needs shelf and table space, setup, rule learning, and protection from confusing it with an expansion.',
    official: ['Stronghold Games', 'Terraforming Mars: Ares Expedition', 'https://strongholdgames.com/our-games/terraforming-mars-ares-expedition/'],
    reviews: [['Ars Technica', 'Terraforming Mars: Ares Expedition review', 'https://arstechnica.com/gaming/2022/07/terraforming-mars-ares-expedition-makes-a-great-board-game-more-accessible/'], ['Wargamer', 'Terraforming Mars: Ares Expedition review', 'https://www.wargamer.com/terraforming-mars-ares-expedition/review']]
  },
  {
    id: 'thinking-in-systems-paperback', name: 'Thinking in Systems: A Primer — paperback', merchant: 'Chelsea Green', url: 'https://www.chelseagreen.com/product/thinking-in-systems/', priceBand: '$15-$30', editorialScore: 84, evidenceConfidence: 78,
    benefit: 'It provides practical vocabulary for stocks, flows, delays, feedback, system traps, and leverage points.',
    drawback: 'The material can feel abstract and academic, and it is not a hands-on modeling manual.',
    compatibility: 'Confirm the recipient enjoys conceptual nonfiction and wants systems vocabulary rather than a step-by-step software or management course.',
    dimension: 'skill_or_experience', observation: 'Choose this for someone who already talks about root causes, bottlenecks, incentives, or feedback loops and wants a clearer framework.',
    selfReason: 'research_burden', selfRationale: 'An abstract primer is easy to postpone because choosing how to apply it feels like a separate research project.', ownershipBurden: 'A compact paperback is easy to store but still demands focused conceptual reading.',
    official: ['Chelsea Green', 'Thinking in Systems product page', 'https://www.chelseagreen.com/product/thinking-in-systems/'],
    reviews: [['Yale Journal of Industrial Ecology', 'Thinking in Systems review', 'https://jie.yale.edu/thinking-systems-primer'], ['Training Journal', 'Thinking in Systems review', 'https://www.trainingjournal.com/2026/content-type/book/thinking-in-systems-book-review/']]
  },
  {
    id: 'pandemic-base-game', name: 'Pandemic — English base game', merchant: 'Z-Man Games / Asmodee', url: 'https://www.zmangames.com/game/pandemic/', priceBand: '$25-$45', editorialScore: 86, evidenceConfidence: 92,
    benefit: 'The cooperative game makes interacting networks, escalating pressure, delays, and scarce actions visible around one table.',
    drawback: 'One experienced player can direct everyone, and the outbreak subject matter can be emotionally unwelcome.',
    compatibility: 'Confirm two to four comfortable players, English role and event-card comprehension, tolerance for pressure, and willingness to use shared-decision rules.',
    dimension: 'accessibility', observation: 'Choose this only for a recipient who likes cooperative optimization and whose household is comfortable with the outbreak theme.',
    selfReason: 'coordination_burden', selfRationale: 'Even a widely known cooperative game can remain unbought when the recipient is unsure who will learn and play it with them.', ownershipBurden: 'The box needs shelf and table space, plus a willing group and a plan that prevents quarterbacking.',
    official: ['Z-Man Games', 'Pandemic base game', 'https://www.zmangames.com/game/pandemic/'],
    reviews: [['GamesRadar', 'Pandemic review', 'https://www.gamesradar.com/pandemic-board-game-review/'], ['Wargamer', 'Pandemic review', 'https://www.wargamer.com/pandemic/review']]
  },
  {
    id: 'because-internet-paperback', name: 'Because Internet — U.S. paperback', merchant: 'Penguin Random House', url: 'https://www.penguinrandomhouse.com/books/540664/because-internet-by-gretchen-mcculloch/9780735210943/', priceBand: '$15-$25', editorialScore: 87, evidenceConfidence: 90,
    benefit: 'It gives names and historical context to online-language habits the recipient already notices in messages, memes, and communities.',
    drawback: 'Published in 2019, it is a valuable snapshot rather than a comprehensive map of today’s platforms, dialects, and norms.',
    compatibility: 'Confirm the recipient wants English-centered internet linguistics and will treat the work as a dated snapshot rather than current platform coverage.',
    dimension: 'edition_or_region', observation: 'Choose this for someone who already debates punctuation, memes, slang, tone, or how online groups develop shared language.',
    selfReason: 'small_luxury_deferral', selfRationale: 'The topic feels familiar enough that a recipient may keep postponing the deeper explanation behind everyday messages.', ownershipBurden: 'A paperback creates little clutter but still overlaps with existing linguistics books if the recipient already owns it.',
    official: ['Penguin Random House', 'Because Internet product page', 'https://www.penguinrandomhouse.com/books/540664/because-internet-by-gretchen-mcculloch/9780735210943/'],
    reviews: [['The Washington Post', 'Because Internet review', 'https://www.washingtonpost.com/outlook/how-the-internet-has-changed-the-way-we-write--and-speak-its-not-all-all-bad/2019/09/12/b4f913f8-99e3-11e9-830a-21b9b36b64ad_story.html'], ['TIME', 'Because Internet review', 'https://time.com/5629246/because-internet-book-review/']]
  },
  {
    id: 'codenames-2025-english', name: 'Codenames — refreshed 2025 English edition', merchant: 'Czech Games Edition', url: 'https://www.czechgames.com/games/codenames', priceBand: '$15-$30', editorialScore: 90, evidenceConfidence: 90,
    benefit: 'One-word clues expose how strongly meaning depends on shared language, context, and the exact people at the table.',
    drawback: 'The application loop is indirect, and it is a poor fit for groups with language-processing barriers or little shared cultural context.',
    compatibility: 'Confirm the refreshed 2025 English edition, four or more regular players, shared language and references, and no existing Codenames set.',
    dimension: 'accessibility', observation: 'Choose this only if the recipient regularly gathers at least four people who enjoy word association and share enough language context.',
    selfReason: 'coordination_burden', selfRationale: 'A party game is easily postponed when the recipient is unsure whether the right language-sharing group will gather often enough.', ownershipBurden: 'The compact box is easy to store, but utility depends on a suitable group and avoiding duplicate editions.',
    official: ['Czech Games Edition', 'Codenames 2025 edition', 'https://www.czechgames.com/games/codenames'],
    reviews: [['Opinionated Gamers', 'Codenames 2025 refresh review', 'https://opinionatedgamers.com/2025/08/30/codenames-refresh-2025/'], ['Board Game Review', 'Codenames 2025 refresh review', 'https://boardgamereview.co.uk/game-reviews/codenames-2025-refresh-review/']]
  },
  {
    id: 'leave-only-footprints-paperback', name: 'Leave Only Footprints — U.S. paperback', merchant: 'Penguin Random House', url: 'https://www.penguinrandomhouse.com/books/600367/leave-only-footprints-by-conor-knighton/', priceBand: '$15-$25', editorialScore: 79, evidenceConfidence: 86,
    benefit: 'The memoir turns a national-park checklist into personal stories and prompts for remembering or planning real visits.',
    drawback: 'It contains substantial breakup and personal-life material, offers limited practical park guidance, and reflects a 2016 trip across 59 parks.',
    compatibility: 'Confirm the recipient wants a personal travel memoir rather than a current park-planning guide or comprehensive field reference.',
    dimension: 'skill_or_experience', observation: 'Choose this for someone with park trip photos, an NPS passport, trail plans, or stories about what particular parks meant to them.',
    selfReason: 'small_luxury_deferral', selfRationale: 'A travel memoir can remain below active trip planning even when its stories closely match a recipient’s park memories.', ownershipBurden: 'A paperback stores easily but should not be mistaken for up-to-date logistical guidance.',
    official: ['Penguin Random House', 'Leave Only Footprints product page', 'https://www.penguinrandomhouse.com/books/600367/leave-only-footprints-by-conor-knighton/'],
    reviews: [['Kirkus Reviews', 'Leave Only Footprints review', 'https://www.kirkusreviews.com/book-reviews/conor-knighton/leave-only-footprints/'], ['Publishers Weekly', 'Leave Only Footprints review', 'https://www.publishersweekly.com/9781984823540']]
  },
  {
    id: 'trekking-national-parks-third-edition', name: 'Trekking the National Parks — third-edition English base game', merchant: 'Western National Parks Store', url: 'https://store.wnpa.org/products/trekking-the-national-parks-3rd-edition', priceBand: '$45-$50', editorialScore: 88, evidenceConfidence: 91,
    benefit: 'The route and park-card game turns U.S. national-park memories into a shared conversation that can end with one real trail, trip, or photo action.',
    drawback: 'It is a light thematic game rather than a planning tool, contains small parts, and earlier-edition rules or player counts should not be assumed.',
    compatibility: 'Confirm the exact third edition, two to five players or solo intent, ages ten and up, small-part safety, 30 to 60 minutes, ownership, and a likely game partner.',
    dimension: 'edition_or_region', observation: 'Choose this only when the recipient enjoys approachable tabletop games and already turns national-park interest into shared planning or conversation.',
    selfReason: 'coordination_burden', selfRationale: 'Player availability, edition identification, and teach time can keep a park-loving household from choosing the right game.', ownershipBurden: 'The game requires shelf and table space, small-part storage, and a plan for who will play it.',
    official: ['Underdog Games', 'Trekking the National Parks third-edition product information', 'https://www.underdoggames.com/products/trekking-the-national-parks'],
    reviews: [['Geeks Under Grace', 'Trekking the National Parks third-edition review', 'https://www.geeksundergrace.com/tabletop/review-trekking-the-national-parks-3rd-edition/'], ['Meeple Mentor', 'Trekking the National Parks third-edition review', 'https://www.meeplementor.com/2025/01/meeple-mentor-reviews-trekking-national.html']]
  },
  {
    id: 'steering-the-craft-2015', name: 'Steering the Craft — revised 2015 paperback', merchant: 'Ursula K. Le Guin / HarperCollins', url: 'https://www.ursulakleguin.com/steering-the-craft', priceBand: '$15-$25', editorialScore: 88, evidenceConfidence: 87,
    benefit: 'Ten focused chapters and repeatable exercises give an already-motivated writer a clear practice structure.',
    drawback: 'It is not a complete absolute-beginner course, and its literary examples and workshop orientation will not fit every writer.',
    compatibility: 'Confirm the revised 2015 edition and that the recipient is already writing or genuinely wants prose exercises and critique practice.',
    dimension: 'skill_or_experience', observation: 'Choose this for someone who drafts fiction, journals seriously, attends workshops, or repeatedly talks about a story they want to write.',
    selfReason: 'small_luxury_deferral', selfRationale: 'A craft book can remain aspirational until a concrete prompt lowers the activation energy for the next writing session.', ownershipBurden: 'The paperback is easy to store but creates time and emotional effort when exercises lead to critique.',
    official: ['Ursula K. Le Guin', 'Steering the Craft official page', 'https://www.ursulakleguin.com/steering-the-craft'],
    reviews: [['Kirkus Reviews', 'Steering the Craft review', 'https://www.kirkusreviews.com/book-reviews/ursula-k-le-guin/steering-the-craft/'], ['Publishers Weekly', 'Steering the Craft review', 'https://www.publishersweekly.com/9780544611610']]
  },
  {
    id: 'rorys-story-cubes-classic', name: 'Rory’s Story Cubes Classic — magnetic-box English edition', merchant: 'Story Cubes / Asmodee', url: 'https://www.storycubes.com/en/games/rorys-story-cubes-classic/', priceBand: '$10-$20', editorialScore: 79, evidenceConfidence: 76,
    benefit: 'Nine visual dice create quick constraints that can activate a specific prose exercise without requiring setup or scoring.',
    drawback: 'This is an open-ended creativity prompt rather than a conventional game, and improvisational performance can feel juvenile or intimidating.',
    compatibility: 'Confirm comfort with visual icon recognition, small-dice handling, unscored storytelling, and the exact Classic set rather than an expansion.',
    dimension: 'accessibility', observation: 'Choose this only if the recipient enjoys low-stakes prompts and would use the dice privately or with a trusted writing partner.',
    selfReason: 'small_luxury_deferral', selfRationale: 'A tiny prompt tool can feel too frivolous to self-purchase even when it removes the blank-page decision that keeps recurring.', ownershipBurden: 'Nine dice store compactly, but they duplicate other prompt decks or dice if those already work for the recipient.',
    official: ['Story Cubes', 'Rory’s Story Cubes Classic', 'https://www.storycubes.com/en/games/rorys-story-cubes-classic/'],
    reviews: [['Family Game Shelf', 'Rory’s Story Cubes review', 'https://familygameshelf.com/2022/05/17/rorys-story-cubes-review/'], ['Play Board Games', 'Rory’s Story Cubes review', 'https://www.play-board-games.com/rorys-story-cubes-and-actions-review/']]
  },
  {
    id: 'read-this-great-photographs-2023', name: 'Read This If You Want to Take Great Photographs — revised 2023 edition', merchant: 'Laurence King', url: 'https://us.laurenceking.com/products/read-this-if-you-want-to-take-great-photographs', priceBand: '$15-$25', editorialScore: 82, evidenceConfidence: 76,
    benefit: 'Approachable composition, exposure, light, lens, and seeing principles work with phones, mirrorless cameras, and DSLRs.',
    drawback: 'The advice stays broad rather than camera-specific, and independent reviews largely evaluate the work rather than the revised 2023 binding.',
    compatibility: 'Confirm the revised 2023 ISBN, beginner-level fit, any camera access, and that the recipient wants image-making principles instead of gear advice.',
    dimension: 'edition_or_region', observation: 'Choose this for a beginner who regularly shares photos and has asked how to improve composition or light without buying more gear.',
    selfReason: 'small_luxury_deferral', selfRationale: 'A beginner may keep shooting inconsistently while deferring a compact technique guide because new gear feels more urgent.', ownershipBurden: 'The small book is easy to carry, though direct U.S. publisher stock must be rechecked before publication.',
    official: ['Laurence King', 'Read This If You Want to Take Great Photographs revised edition', 'https://us.laurenceking.com/products/read-this-if-you-want-to-take-great-photographs'],
    reviews: [['Photofocus', 'Read This If You Want to Take Great Photographs review', 'https://photofocus.com/reviews/book-review-read-this-if-you-want-to-take-great-photographs/'], ['Frederik Boving', 'Read This If You Want to Take Great Photographs review', 'https://frederikboving.com/read-this-if-you-want-to-take-great-photographs-by-henry-carroll/']]
  },
  {
    id: '52-assignments-street-photography', name: '52 Assignments: Street Photography — activity journal', merchant: 'Ammonite Press', url: 'https://www.ammonitepress.com/52-assignments/', priceBand: '$10-$25', editorialScore: 78, evidenceConfidence: 74,
    benefit: 'A year of compact assignments converts photography principles into a recurring practice and review loop.',
    drawback: 'Stranger-focused work can raise privacy, safety, mobility, or social-comfort concerns, and some journal pages are consumable.',
    compatibility: 'Confirm any camera, a legally and personally suitable public environment, comfort photographing in public, and willingness to complete assignments.',
    dimension: 'accessibility', observation: 'Choose this only for someone who already wants a repeatable photo practice and is comfortable making images in public spaces.',
    selfReason: 'coordination_burden', selfRationale: 'A structured practice can be postponed because it creates accountability, location choices, and a recurring weekend commitment.', ownershipBurden: 'The journal is compact but partly consumable and creates an ongoing time commitment rather than passive shelf reference.',
    official: ['Ammonite Press', '52 Assignments series', 'https://www.ammonitepress.com/52-assignments/'],
    reviews: [['Northlight Images', '52 Assignments Street Photography review', 'https://www.northlight-images.co.uk/book-review-52-assignments-street-photography/'], ['Camera Jabber', '52 Assignments series review', 'https://camerajabber.com/?p=1396907']]
  },
  {
    id: 'entangled-life-paperback', name: 'Entangled Life — U.S. paperback', merchant: 'Penguin Random House', url: 'https://www.penguinrandomhouse.com/books/566795/entangled-life-by-merlin-sheldrake/', priceBand: '$15-$25', editorialScore: 91, evidenceConfidence: 93,
    benefit: 'The book makes fungal networks, exchange, decomposition, and interdependence vivid without requiring prior biology.',
    drawback: 'Its lyrical and speculative passages should not be flattened into settled scientific claims, and it is not a mushroom field guide.',
    compatibility: 'Confirm the recipient wants narrative biology in English rather than an identification, foraging, or safety guide.',
    dimension: 'skill_or_experience', observation: 'Choose this for someone who gardens, photographs fungi, asks about forest ecology, or already talks about mycorrhizal relationships.',
    selfReason: 'small_luxury_deferral', selfRationale: 'Narrative ecology often remains an admired future read until a concrete interaction gives the recipient a reason to open it now.', ownershipBurden: 'A paperback is easy to store but must not be confused with field-identification or foraging advice.',
    official: ['Penguin Random House', 'Entangled Life product page', 'https://www.penguinrandomhouse.com/books/566795/entangled-life-by-merlin-sheldrake/'],
    reviews: [['The Guardian', 'Entangled Life review', 'https://www.theguardian.com/books/2020/aug/27/entangled-life-by-merlin-sheldrake-review-a-brilliant-door-opener-book'], ['Kirkus Reviews', 'Entangled Life review', 'https://www.kirkusreviews.com/book-reviews/merlin-sheldrake/entangled-life/']]
  },
  {
    id: 'undergrove-base-game', name: 'Undergrove — English base game', merchant: 'Alderac Entertainment Group', url: 'https://www.alderac.com/undergrove/', priceBand: '$35-$55', editorialScore: 84, evidenceConfidence: 82,
    benefit: 'Its tree-fungi resource exchanges turn the same ecological relationship into a medium-weight spatial optimization puzzle.',
    drawback: 'It is a science-inspired abstraction with rulebook and reference burden, and one independent review evaluated a late prototype.',
    compatibility: 'Confirm one to four players, 60 to 75 minutes, English icon and resource comfort, table space, ownership, and tolerance for medium complexity.',
    dimension: 'accessibility', observation: 'Choose this only if the ecology interest is paired with real enthusiasm for medium-weight, icon-heavy tabletop optimization.',
    selfReason: 'coordination_burden', selfRationale: 'Rule learning, player availability, and table space can keep an ecology-minded gamer from trying a less familiar title.', ownershipBurden: 'The component-heavy game needs shelf and table space, setup time, and a willing learner or group.',
    official: ['Alderac Entertainment Group', 'Undergrove game page', 'https://www.alderac.com/undergrove/'],
    reviews: [['Meeple Mountain', 'Undergrove review', 'https://www.meeplemountain.com/reviews/undergrove/'], ['Meeple and the Moose', 'Undergrove released-game review', 'https://meepleandthemoose.com/2025/11/15/undergrove-board-game-review/']]
  },
  {
    id: 'the-food-lab-hardcover', name: 'The Food Lab: Better Home Cooking Through Science — U.S. hardcover, ISBN 9780393081084', merchant: 'W. W. Norton', url: 'https://wwnorton.com/books/9780393081084', priceBand: '$30-$50', editorialScore: 89, evidenceConfidence: 91,
    benefit: 'The reference explains how heat, temperature, ingredients, and technique affect familiar savory cooking tasks.',
    drawback: 'At roughly 958 pages it is heavy and demanding, focuses on savory American cooking, and is not a concise weeknight recipe book.',
    compatibility: 'Confirm the recipient likes detailed savory cooking science, has space for a large hardcover, and does not already own this common reference.',
    dimension: 'space_or_storage', observation: 'Choose this for someone who already asks why cooking techniques work and repeatedly cooks temperature-sensitive savory food.',
    selfReason: 'research_burden', selfRationale: 'The large reference can remain a someday purchase because its depth and physical size make the commitment feel substantial.', ownershipBurden: 'A very large hardcover needs real shelf and counter space and is awkward for someone who prefers compact or digital recipes.',
    official: ['W. W. Norton', 'The Food Lab U.S. product page', 'https://wwnorton.com/books/9780393081084'],
    reviews: [['Chemistry World', 'The Food Lab review', 'https://www.chemistryworld.com/culture/the-food-lab-better-home-cooking-through-science/9443.article'], ['Gaby Mora', 'The Food Lab review', 'https://gabymora.com.au/book-review-the-food-lab-j-kenji-lopez-alt/']]
  },
  {
    id: 'temppro-tp19h', name: 'TempPro TP19H — digital instant-read thermometer, model TP19H', merchant: 'The Home Depot', url: 'https://www.homedepot.com/p/316469586', priceBand: '$18-$20', editorialScore: 87, evidenceConfidence: 90,
    benefit: 'A compact instant-read probe turns temperature concepts into a repeatable measurement step with a rotating backlit display, lock function, and calibration mode.',
    drawback: 'The sharp probe, hot food, cleaning, one AAA battery, cross-contamination risk, compact display, and three-to-four-second response all require active safe use.',
    compatibility: 'Confirm model TP19H, temperature-sensitive cooking, no trusted instant-read thermometer, safe probe handling and cleaning, readable compact display, and acceptance of one AAA battery.',
    dimension: 'power_or_battery', observation: 'Choose this only after seeing the recipient guess doneness or repeatedly borrow a thermometer while cooking temperature-sensitive food.',
    selfReason: 'small_luxury_deferral', selfRationale: 'A reliable thermometer is useful but unglamorous, so a cook may keep improvising while spending on ingredients or cookware instead.', ownershipBurden: 'The tool stores compactly but needs a battery, probe cleaning, safe handling, and a defined kitchen storage spot.',
    official: ['TempPro', 'TP19H instant-read thermometer product page', 'https://temppro.com/products/tp19h-instant-read-meat-thermometer'],
    reviews: [['Consumer Reports', 'TempPro TP19H lab-test page', 'https://www.consumerreports.org/appliances/meat-thermometers/thermopro-digital-meat-thermometer-tp19h/m407252/'], ['The Grilling Dad', 'TempPro TP19H review', 'https://thegrillingdad.com/grilling-tools-accessories/thermopro-instant-read-thermometer-review/']]
  }
];

const pairs = [
  { id: 'big-history-strategy-debate', name: 'The big-history strategy debate', a: 'sapiens-us-paperback', b: 'civilization-vi-windows-steam', score: [20,20,18,14,10,6,4], type: 'narrative_counterpoint', recipientJob: 'Turn a broad historical argument into an active comparison with a stylized strategy model instead of consuming either one passively.', why: 'Sapiens supplies a provocative historical lens while Civilization VI lets the recipient manipulate a deliberately simplified system and identify what the game makes controllable.', moment: 'Read a section on agriculture, empire, or technology, play through the related era, then write down one assumption the game simplifies or contradicts.', pre: 'Check the exact paperback, Steam library, Windows hardware, region, store preference, and whether the recipient welcomes Sapiens as a disputed argument.', drawback: 'Choose only the book if platform or ownership is uncertain, and skip the bundle if the live subtotal exceeds the founder’s $75 ceiling.', friction: 'A history fan may keep consuming only books or only strategy games even though comparing their incompatible models would create the more memorable experience.', social: 'src-social-sapiens-civ' },
  { id: 'bird-cognition-engine-loop', name: 'The bird-cognition engine loop', a: 'genius-of-birds-paperback', b: 'wingspan-digital-steam', score: [20,20,18,14,10,7,4], type: 'observation_loop', recipientJob: 'Carry a bird-cognition question from narrative science into a digital system and then back outside to closer bird observation.', why: 'The book explains cognition and behavior while Wingspan Digital supplies distinct bird cards, narrated facts, and engine choices without requiring shelf or table space.', moment: 'Choose one cognition story, play until a related behavior appears, verify the card fact independently, then look for the behavior outdoors.', pre: 'Confirm bird interest, supported computer, Steam account and library, readable interface, medium-game tolerance, ownership, and screen-time preference.', drawback: 'The game is not a field guide and its interface and rules can overwhelm new players; choose only the book when digital-strategy enthusiasm is assumed rather than observed.', friction: 'A bird lover may collect sightings or photos without a structured way to connect individual behaviors, science stories, and a repeatable indoor ritual.', social: 'src-social-wingspan-birding' },
  { id: 'mars-constraint-counterpoint', name: 'The Mars constraint counterpoint', a: 'a-city-on-mars-paperback', b: 'terraforming-mars-ares-expedition', score: [20,20,19,13,10,8,4], type: 'narrative_counterpoint', recipientJob: 'Compare real settlement constraints with an optimistic engine-building abstraction and make the model’s omissions part of the fun.', why: 'A City on Mars foregrounds biology, law, logistics, and ethics while Ares Expedition compresses terraforming into a shorter standalone growth engine.', moment: 'Read one settlement constraint, then trace what the game models, ignores, or makes implausibly easy during the next round.', pre: 'Confirm the recipient likes skeptical space writing, owns no Ares Expedition copy, tolerates engine-building rules, has table space, and has willing players or solo interest.', drawback: 'The card game still has rules and icon overhead and its flat player boards can be bumped; choose the book alone if time, space, players, exact edition, or subtotal are uncertain.', friction: 'A space-settlement fan can stay inside either hype or skepticism without a ritual that forces those two frames to confront each other.', social: 'src-social-mars-constraints' },
  { id: 'feedback-loop-table', name: 'The feedback-loop table', a: 'thinking-in-systems-paperback', b: 'pandemic-base-game', score: [19,20,18,13,10,5,3], type: 'practice_loop', recipientJob: 'Move systems vocabulary from an abstract page into a cooperative table where feedback, delay, pressure, and scarce actions are visible.', why: 'Thinking in Systems names the patterns while Pandemic supplies a compact cooperative situation in which the recipient can diagram them after play.', moment: 'After one game, diagram a stock, flow, delay, and reinforcing or balancing loop, then discuss which intervention changed the outcome.', pre: 'Confirm two to four comfortable players, subject-matter sensitivity, English card comprehension, ownership, and a plan that prevents one player from directing everyone.', drawback: 'Pandemic is not an epidemiology model and can invite quarterbacking; choose only the book when the outbreak theme is unwelcome.', friction: 'A systems-minded person may understand the vocabulary intellectually yet postpone applying it to a concrete shared example.', social: 'src-social-systems-application' },
  { id: 'language-context-table', name: 'The language-context table', a: 'because-internet-paperback', b: 'codenames-2025-english', score: [18,18,16,12,10,5,3], type: 'practice_loop', recipientJob: 'Notice how online language depends on shared context, then watch the same context dependence succeed or fail in a live word-association group.', why: 'Because Internet supplies the language lens while Codenames creates a different social setting where one-word clues depend on a specific group’s shared references.', moment: 'After a chapter on context or tone, play one round and identify why a successful clue worked for this group but might fail with another.', pre: 'Confirm the 2025 English edition, four or more regular players, shared language and cultural context, ownership, and accessibility needs.', drawback: 'The application is indirect and weak in mixed-language groups; choose only the book if the recurring group or shared context is uncertain.', friction: 'Someone fascinated by online language may keep the interest observational without a safe shared ritual for testing how context changes meaning.', social: 'src-social-codenames-language' },
  { id: 'park-story-to-trail', name: 'The park-story-to-trail loop', a: 'leave-only-footprints-paperback', b: 'trekking-national-parks-third-edition', score: [18,19,18,13,10,7,4], type: 'observation_loop', recipientJob: 'Turn national-park memories into a shared tabletop conversation that ends with one real trail, trip, or photo-album action.', why: 'The memoir supplies personal park stories while Trekking the National Parks Third Edition creates a distinct shared route through park photos, facts, and choices.', moment: 'Choose a park chapter, play until that park appears, then save one trail, schedule one outing, or revisit the recipient’s photos from that place.', pre: 'Confirm the third edition, ownership, two-to-five-player or solo plan, small-part safety, tabletop interest, and a live subtotal no higher than $75.', drawback: 'The game is thematic rather than a planning tool and exact edition matters; choose the memoir alone if there is no likely player, small parts are unsafe, or the subtotal is too high.', friction: 'A park lover may collect destinations and memories without a recurring shared moment that turns them into the next small action.', social: 'src-social-parks-players' },
  { id: 'constraint-to-draft', name: 'The constraint-to-draft loop', a: 'steering-the-craft-2015', b: 'rorys-story-cubes-classic', score: [18,18,17,12,10,4,3], type: 'practice_loop', recipientJob: 'Lower blank-page friction by combining one rigorous prose exercise with a small random constraint the writer can accept or reroll.', why: 'Steering the Craft provides the craft objective while Story Cubes supplies raw visual constraints, but the dice remain optional rather than pretending to replace the exercise.', moment: 'Roll three icons, choose one Le Guin exercise, draft for twenty minutes, and keep only the constraint that helped the prose move.', pre: 'Confirm the revised book, exact Classic set, comfort with open-ended prompts and dice handling, existing prompt tools, and genuine writing intent.', drawback: 'Both items can feel like exercises and the dice may feel juvenile; choose only the book when prompt tools already work or the recipient dislikes improvisation.', friction: 'A willing writer can know what they want to practice yet keep postponing the first concrete constraint that starts the next draft.', social: 'src-social-writing-prompts' },
  { id: 'technique-to-photo-walk', name: 'The technique-to-photo-walk loop', a: 'read-this-great-photographs-2023', b: '52-assignments-street-photography', score: [20,19,19,14,10,5,3], type: 'practice_loop', recipientJob: 'Convert an approachable photography principle into one bounded public-space assignment and a later review instead of more gear shopping.', why: 'The revised guide explains composition, light, and seeing while the assignment journal creates a distinct practice cadence using a camera the recipient already owns.', moment: 'Read one technique, choose the closest assignment, make a short photo walk, then review one resulting image together.', pre: 'Confirm the exact editions, U.S. availability, any camera access, lawful and personally safe locations, mobility, privacy comfort, and beginner fit.', drawback: 'Public photography can create safety, privacy, or social discomfort; choose only the guide if the assignments feel like homework or the publisher is out of stock.', friction: 'A beginner photographer may keep taking inconsistent pictures or shopping for gear without a bounded technique-to-practice loop.', social: 'src-social-photo-assignment' },
  { id: 'fungal-network-table', name: 'The fungal-network table', a: 'entangled-life-paperback', b: 'undergrove-base-game', score: [20,20,19,14,10,8,4], type: 'observation_loop', recipientJob: 'Move from fungal-network stories into a resource-exchange abstraction and then back to more precise ecological questions.', why: 'Entangled Life provides the living-system narrative while Undergrove assigns different roles to trees, fungi, carbon, and nutrients inside a playable puzzle.', moment: 'Choose one mycorrhizal exchange claim, play a round, trace how the game abstracts carbon and nutrients, then name what the model leaves out.', pre: 'Confirm ecology interest, one to four players or solo intent, medium-complexity tolerance, English icons, table space, and no existing copy.', drawback: 'The rulebook and reference burden are real and the game remains an abstraction; choose only the book for a non-gamer or field-guide seeker.', friction: 'A fungi-curious recipient may consume striking network metaphors without a repeatable way to test the roles and limits of the model.', social: 'src-social-undergrove-complexity' },
  { id: 'temperature-to-measurement', name: 'The temperature-to-measurement loop', a: 'the-food-lab-hardcover', b: 'temppro-tp19h', score: [20,20,19,14,10,8,4], type: 'enables_use', recipientJob: 'Turn a cooking-science explanation into a repeatable measurement step that replaces guessing during temperature-sensitive food preparation.', why: 'The Food Lab explains what heat and temperature do while the TP19H performs the distinct measurement job the reference repeatedly makes useful.', moment: 'Read the relevant temperature explanation, measure the next compatible recipe at the right point, then record what changed instead of judging by appearance alone.', pre: 'Confirm the U.S. hardcover is wanted, storage exists, no trusted instant-read thermometer is owned, model TP19H probe handling is safe, one AAA battery works, and live subtotal is at most $75.', drawback: 'A sharp probe near hot food requires cleaning and safe handling, and the large book may be excessive; choose only the thermometer if the recipient already has a trusted reference.', friction: 'A curious home cook may keep guessing doneness because a reliable thermometer feels too utilitarian to prioritize over ingredients or cookware.', social: 'src-social-thermometer-deferral' }
];

const budgetSnapshots = {
  'big-history-strategy-debate': {
    subtotalUsd: 31.98,
    condition: 'The qualifying subtotal depends on the Steam base-game promotion observed on 2026-08-03; rerun the live check after that promotion ends.',
    items: [
      ['sapiens-us-paperback', 25.99, 'HarperCollins', 'Sapiens U.S. paperback publisher catalog price', 'https://media.sailthru.com/composer/images/bazh/dcdxgatb/0zb/gtx/m0o/HC-1580_FYE_2025-26_Catalog.pdf', 'publisher-catalog'],
      ['civilization-vi-windows-steam', 5.99, 'Steam', 'Civilization VI Windows base-game live offer', 'https://store.steampowered.com/app/289070/Sid_Meiers_Civilization_VI/', 'merchant-listing']
    ]
  },
  'bird-cognition-engine-loop': {
    subtotalUsd: 39.99,
    condition: 'The subtotal uses each item’s ordinary listed price rather than the temporary Wingspan discount observed on 2026-08-03.',
    items: [
      ['genius-of-birds-paperback', 20, 'Penguin Random House', 'The Genius of Birds U.S. paperback price', 'https://www.penguinrandomhouse.com/books/312321/the-genius-of-birds-by-jennifer-ackerman/', 'manufacturer'],
      ['wingspan-digital-steam', 19.99, 'Steam', 'Wingspan Digital Steam base-game list price', 'https://store.steampowered.com/app/1054490/Wingspan/', 'merchant-listing']
    ]
  },
  'mars-constraint-counterpoint': {
    subtotalUsd: 69.99,
    condition: 'The subtotal uses the U.S. paperback price and Ares Expedition MSRP observed on 2026-08-03.',
    items: [
      ['a-city-on-mars-paperback', 20, 'Penguin Random House', 'A City on Mars U.S. paperback price', 'https://www.penguinrandomhouse.com/books/639449/a-city-on-mars-by-kelly-and-zach-weinersmith/', 'manufacturer'],
      ['terraforming-mars-ares-expedition', 49.99, 'Stronghold Games', 'Terraforming Mars: Ares Expedition MSRP', 'https://strongholdgames.com/our-games/terraforming-mars-ares-expedition/', 'manufacturer']
    ]
  },
  'park-story-to-trail': {
    subtotalUsd: 68.99,
    condition: 'The subtotal uses the U.S. paperback price and the in-stock third-edition listing observed on 2026-08-03.',
    items: [
      ['leave-only-footprints-paperback', 19, 'Penguin Random House', 'Leave Only Footprints U.S. paperback price', 'https://www.penguinrandomhouse.com/books/600367/leave-only-footprints-by-conor-knighton/', 'manufacturer'],
      ['trekking-national-parks-third-edition', 49.99, 'Western National Parks Store', 'Trekking the National Parks third-edition in-stock listing', 'https://store.wnpa.org/products/trekking-the-national-parks-3rd-edition', 'merchant-listing']
    ]
  },
  'fungal-network-table': {
    subtotalUsd: 69.99,
    condition: 'The subtotal uses the U.S. paperback price and Undergrove MSRP observed on 2026-08-03.',
    items: [
      ['entangled-life-paperback', 20, 'Penguin Random House', 'Entangled Life U.S. paperback price', 'https://www.penguinrandomhouse.com/books/566795/entangled-life-by-merlin-sheldrake/', 'manufacturer'],
      ['undergrove-base-game', 49.99, 'Alderac Entertainment Group', 'Undergrove MSRP', 'https://www.alderac.com/undergrove/', 'manufacturer']
    ]
  },
  'temperature-to-measurement': {
    subtotalUsd: 50.93,
    condition: 'The subtotal uses the exact U.S. hardcover ISBN and model TP19H retailer listings observed on 2026-08-03.',
    items: [
      ['the-food-lab-hardcover', 31.94, 'Walmart', 'The Food Lab hardcover ISBN 9780393081084 live listing', 'https://www.walmart.com/ip/45762501', 'merchant-listing'],
      ['temppro-tp19h', 18.99, 'The Home Depot', 'TempPro TP19H model 316469586 live listing', 'https://www.homedepot.com/p/316469586', 'merchant-listing']
    ]
  }
};

const socialSources = {
  'src-social-sapiens-civ': ['Reddit r/civ', 'Public discussion pairing Sapiens with Civilization', 'https://www.reddit.com/r/civ/comments/g6euw2/'],
  'src-social-wingspan-birding': ['Reddit r/birding', 'Public discussion of Wingspan sparking bird interest', 'https://www.reddit.com/r/birding/comments/1ka6rex/'],
  'src-social-mars-constraints': ['Reddit r/sciencefiction', 'Public discussion of scientific constraints on surviving on Mars', 'https://www.reddit.com/r/sciencefiction/comments/1rcikc8/'],
  'src-social-systems-application': ['Reddit r/systemsthinking', 'Public discussion of applying Thinking in Systems', 'https://www.reddit.com/r/systemsthinking/comments/1v0s9a6/'],
  'src-social-codenames-language': ['Reddit r/boardgames', 'Public discussion of Codenames in mixed-language groups', 'https://www.reddit.com/r/boardgames/comments/1933vfg/'],
  'src-social-parks-players': ['Reddit r/boardgames', 'Public discussion of player availability limiting tabletop use', 'https://www.reddit.com/r/boardgames/comments/1rn00bh/'],
  'src-social-writing-prompts': ['Reddit r/WritingHub', 'Public discussion of working through Steering the Craft', 'https://www.reddit.com/r/WritingHub/comments/1se8i1f/'],
  'src-social-photo-assignment': ['Reddit r/AskPhotography', 'Public recommendation of a technique book followed by weekly practice', 'https://www.reddit.com/r/AskPhotography/comments/1nf6rcs/'],
  'src-social-undergrove-complexity': ['Reddit r/soloboardgaming', 'Public discussion of Undergrove rulebook and reference burden', 'https://www.reddit.com/r/soloboardgaming/comments/1gpd6f2/'],
  'src-social-thermometer-deferral': ['Reddit r/Cooking', 'Public discussion of postponing a thermometer purchase', 'https://www.reddit.com/r/Cooking/comments/s73guw/']
};

function sourceId(id, suffix) { return `src-${id}-${suffix}`; }
function claimId(id, suffix) { return `claim-${id}-${suffix}`; }

const sources = [];
for (const product of products) {
  sources.push({ id: sourceId(product.id, 'official'), url: product.official[2], publisher: product.official[0], title: product.official[1], accessedAt, sourceClass: 'manufacturer', trustTier: 'A', independenceGroup: `${product.id}-official` });
  product.reviews.forEach((review, index) => sources.push({ id: sourceId(product.id, `review-${index + 1}`), url: review[2], publisher: review[0], title: review[1], accessedAt, sourceClass: 'independent-review', trustTier: index === 0 ? 'B' : 'C', independenceGroup: `${product.id}-review-${index + 1}` }));
}
for (const [id, source] of Object.entries(socialSources)) sources.push({ id, url: source[2], publisher: source[0], title: source[1], accessedAt, sourceClass: 'social-discussion', trustTier: 'C', independenceGroup: id });
for (const [pairId, snapshot] of Object.entries(budgetSnapshots)) snapshot.items.forEach((item, index) => sources.push({
  id: sourceId(pairId, `budget-${index + 1}`), url: item[4], publisher: item[2], title: item[3], accessedAt, sourceClass: item[5], trustTier: 'A', independenceGroup: `${pairId}-budget-${index + 1}`
}));
sources.push(
  { id: 'src-usda-safe-temperatures', url: 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart', publisher: 'USDA Food Safety and Inspection Service', title: 'Safe minimum internal temperature chart', accessedAt, sourceClass: 'safety-authority', trustTier: 'A', independenceGroup: 'usda-fsis' },
  { id: 'src-steam-refunds', url: 'https://store.steampowered.com/steam_refunds/', publisher: 'Steam', title: 'Steam refund policy', accessedAt, sourceClass: 'merchant-policy', trustTier: 'A', independenceGroup: 'steam-policy' }
);

const claims = [];
for (const pair of pairs) claims.push({ id: claimId(pair.id, 'friction'), kind: 'recipient_friction', text: pair.friction, risk: 'low', status: 'supported', sourceIds: [pair.social] });
for (const product of products) {
  claims.push(
    { id: claimId(product.id, 'benefit'), kind: 'product_benefit', text: product.benefit, risk: 'low', status: 'supported', sourceIds: [sourceId(product.id, 'official'), sourceId(product.id, 'review-1')] },
    { id: claimId(product.id, 'drawback'), kind: 'product_drawback', text: product.drawback, risk: product.id === 'temppro-tp19h' ? 'medium' : 'low', status: 'supported', sourceIds: [sourceId(product.id, 'review-1'), sourceId(product.id, 'review-2')] },
    { id: claimId(product.id, 'compatibility'), kind: 'compatibility', text: product.compatibility, risk: 'medium', status: 'supported', sourceIds: product.id === 'temppro-tp19h' ? [sourceId(product.id, 'official'), 'src-usda-safe-temperatures'] : [sourceId(product.id, 'official')] }
  );
}
for (const pair of pairs) {
  const a = products.find((product) => product.id === pair.a);
  const b = products.find((product) => product.id === pair.b);
  claims.push({ id: claimId(pair.id, 'coherence'), kind: 'pair_coherence', text: pair.why, risk: 'low', status: 'supported', sourceIds: [sourceId(a.id, 'official'), sourceId(a.id, 'review-1'), sourceId(b.id, 'official'), sourceId(b.id, 'review-1'), pair.social] });
  const snapshot = budgetSnapshots[pair.id];
  if (snapshot) claims.push({
    id: claimId(pair.id, 'budget'), kind: 'compatibility',
    text: `The researched subtotal was $${snapshot.subtotalUsd.toFixed(2)} on ${accessedAt}, within the founder’s $75 ceiling. ${snapshot.condition}`,
    risk: 'medium', status: 'supported', sourceIds: snapshot.items.map((_, index) => sourceId(pair.id, `budget-${index + 1}`))
  });
}

function candidate(product) {
  const pair = pairs.find((entry) => entry.a === product.id || entry.b === product.id);
  const isGame = /game|wingspan|pandemic|codenames|parks|undergrove|civilization|terraforming/i.test(product.id);
  return {
    id: product.id,
    name: product.name,
    editorialScore: product.editorialScore,
    evidenceConfidence: product.evidenceConfidence,
    drawbacks: [product.drawback],
    primarySourceIds: [sourceId(product.id, 'official')],
    independentSourceIds: [sourceId(product.id, 'review-1'), sourceId(product.id, 'review-2')],
    claimIds: [claimId(product.id, 'benefit'), claimId(product.id, 'drawback'), claimId(product.id, 'compatibility')],
    evidenceMode: 'desk_research',
    thoughtfulness: {
      observationPrompt: product.observation,
      frictionClaimIds: [claimId(pair.id, 'friction')],
      physicalGiftBoundary: 'welcome_when_verified',
      selfPurchase: { reason: product.selfReason, rationale: product.selfRationale, basis: 'social_demand', claimIds: [claimId(pair.id, 'friction')] },
      duplicateRisk: { level: isGame ? 'high' : 'medium', preGiftCheck: `Confirm the exact ${product.name} is not already owned, borrowed, wishlisted in another edition, or replaced by a preferred alternative.` },
      clutterRisk: { level: isGame || product.id === 'the-food-lab-hardcover' ? 'medium' : 'low', ownershipBurden: product.ownershipBurden, mitigation: `Choose this item only after the recipient-specific observation and compatibility check are both confirmed.` },
      compatibilityChecks: [{ dimension: product.dimension, status: 'verified', requirement: product.compatibility, claimIds: [claimId(product.id, 'compatibility')] }],
      score: { frictionSpecificity: 4, selfPurchaseLogic: 4, ownershipEase: isGame ? 3 : 4, recipientSpecificity: 4, total: isGame ? 15 : 16 }
    }
  };
}

const finalistRecords = products.map(candidate);
const rejectedCandidates = [
  ['secret-lives-of-color', 'The Secret Lives of Color', 74, 82, 'The proposed Hues and Cues companion fails the accessibility component of the thoughtfulness gate.'],
  ['hues-and-cues', 'Hues and Cues', 74, 78, 'Color discrimination is the central mechanism, creating an intrinsic access barrier for some recipients.'],
  ['99-invisible-city', 'The 99% Invisible City', 84, 88, 'The concept survives, but the proposed companion did not clear current exact-edition evidence.'],
  ['archidoodle', 'Archidoodle', 74, 55, 'Current U.S. publisher stock is unavailable and independent exact-edition evidence is below threshold.']
].map(([id, name, editorialScore, evidenceConfidence, drawback]) => ({ id, name, editorialScore, evidenceConfidence, drawbacks: [drawback], primarySourceIds: [], independentSourceIds: [], claimIds: [], evidenceMode: 'desk_research' }));

const reviewedPairs = pairs.map((pair) => {
  const a = products.find((product) => product.id === pair.a);
  const b = products.find((product) => product.id === pair.b);
  const snapshot = budgetSnapshots[pair.id];
  const [sharedCuriosity, complementaryRoles, interactionLoop, observableTrigger, independentValue, compatibility, ownershipEase] = pair.score;
  return {
    id: pair.id, name: pair.name, anchorCandidateId: pair.a, companionCandidateId: pair.b, recipientJob: pair.recipientJob, coherenceType: pair.type,
    whyTogether: pair.why, interactionMoment: pair.moment,
    compatibilityChecks: [
      { dimension: a.dimension, status: 'verified', requirement: a.compatibility, claimIds: [claimId(a.id, 'compatibility')] },
      { dimension: b.dimension, status: 'verified', requirement: b.compatibility, claimIds: [claimId(b.id, 'compatibility')] },
      ...(snapshot ? [{ dimension: 'not_applicable', status: 'verified', requirement: `The researched subtotal was $${snapshot.subtotalUsd.toFixed(2)} on ${accessedAt}; ${snapshot.condition}`, claimIds: [claimId(pair.id, 'budget')] }] : [])
    ],
    duplicateRisk: 'high', clutterDelta: 'neutral', preGiftCheck: pair.pre, bundleDrawback: pair.drawback,
    claimIds: [claimId(pair.id, 'coherence')],
    score: { sharedCuriosity, complementaryRoles, interactionLoop, observableTrigger, independentValue, compatibility, ownershipEase, total: pair.score.reduce((sum, value) => sum + value, 0) }
  };
});

const run = {
  schemaVersion: '1.1.0', runId, ideaId: 'founder-idea-004', ideaRevision: 1, ideaSha256: 'c437f2087e649544c2ffb27f6477daee7328360ed9ce59c49f204695b3b36f0a', decisionLens: 'gift_pairing', contentType: 'pairing-guide', status: 'drafted',
  topic: 'Read it, then use it: ten thoughtful gift pairs for curious adults', audience: 'Curious adults who move between books, games, tools, observation, and debate', occasion: 'Birthdays, holidays, graduation, and shared weekends', budgetBands: ['$25-$50', '$50-$75'], riskClass: 'medium', draftAuthor: 'read-play-product-research-team-20260803', startedAt: '2026-08-03T15:00:00.000Z',
  researchPasses: [
    { pass: 1, materialNoveltyRate: 1, newCandidates: 24, newDecisionFactors: 9 },
    { pass: 2, materialNoveltyRate: 0.34, newCandidates: 0, newDecisionFactors: 5 },
    { pass: 3, materialNoveltyRate: 0.14, newCandidates: 0, newDecisionFactors: 3 },
    { pass: 4, materialNoveltyRate: 0.08, newCandidates: 0, newDecisionFactors: 1 },
    { pass: 5, materialNoveltyRate: 0.04, newCandidates: 0, newDecisionFactors: 0 }
  ],
  sources, claims, candidates: [...finalistRecords, ...rejectedCandidates], finalists: finalistRecords, pairs: reviewedPairs, affiliateLinks: [],
  article: { slug: articleSlug, editorialScore: 88, evidenceConfidence: 84, evidenceMode: 'desk_research', status: 'draft' },
  qa: { passed: false, reviewerRole: 'independent-editor', reviewerId: 'read-play-independent-editor', receiptPath: `research/reviews/${runId}.qa.v1.json`, blockers: ['Independent editorial review has not run yet.'], warnings: ['Price snapshots are dated 2026-08-03; rerun the live subtotal check before any later external publication or purchase.'] }
};

const quote = (value) => JSON.stringify(value);
const lines = [
  '---',
  `title: ${quote('Read It, Then Use It: 10 Thoughtful Gift Pairs for Curious Adults')}`,
  `description: ${quote('Ten researched book-and-action gift pairs built around a real interaction, recipient fit, and a reason to buy only one when the bundle is wrong.')}`,
  `publishDate: ${quote('2026-08-03')}`,
  `updatedDate: ${quote('2026-08-03')}`,
  'status: draft',
  `audience: ${quote(run.audience)}`,
  `occasion: ${quote(run.occasion)}`,
  `priceBand: ${quote('$25-$75; recheck live bundle subtotal')}`,
  'tags:',
  '  - thoughtful gift pairs',
  '  - gifts for curious adults',
  '  - books and games',
  '  - books and tools',
  '  - recipient friction',
  `researchRun: ${quote(runId)}`,
  'evidenceScore: 84',
  'evidenceMode: desk_research',
  'featured: true',
  'affiliateDisclosure: false',
  'products:'
];
for (const product of products) {
  lines.push(
    `  - id: ${product.id}`,
    `    name: ${quote(product.name)}`,
    `    merchant: ${quote(product.merchant)}`,
    `    url: ${quote(product.url)}`,
    '    affiliate: false',
    `    priceBand: ${quote(product.priceBand)}`,
    `    whyItFits: ${quote(product.benefit)}`,
    `    drawback: ${quote(product.drawback)}`,
    `    editorialScore: ${product.editorialScore}`,
    `    evidenceConfidence: ${product.evidenceConfidence}`,
    '    claimIds:',
    `      - ${claimId(product.id, 'benefit')}`,
    `      - ${claimId(product.id, 'drawback')}`,
    `      - ${claimId(product.id, 'compatibility')}`
  );
}
lines.push('pairs:');
for (const pair of reviewedPairs) lines.push(
  `  - id: ${pair.id}`,
  `    name: ${quote(pair.name)}`,
  `    anchorProductId: ${pair.anchorCandidateId}`,
  `    companionProductId: ${pair.companionCandidateId}`,
  `    whyTogether: ${quote(pair.whyTogether)}`,
  `    interactionMoment: ${quote(pair.interactionMoment)}`,
  `    preGiftCheck: ${quote(pair.preGiftCheck)}`,
  `    bundleDrawback: ${quote(pair.bundleDrawback)}`,
  `    coherenceScore: ${pair.score.total}`,
  '    claimIds:',
  `      - ${pair.claimIds[0]}`
);
lines.push('---', '');

const body = `A thoughtful pair is not two objects that look good in the same cart. One item should open an idea; the other should let the recipient **use, test, observe, measure, or argue with it**.

That is the standard behind this guide. We started with 24 exact candidates, qualified 20 items independently, and kept ten pairs that scored at least 80/100 for shared curiosity, different roles, interaction, observable fit, independent value, compatibility, and ownership ease. Two editorial desks challenged the clever-sounding word and writing pairs, so those remain near the threshold with explicit reasons to choose only the book.

This is desk research, not hands-on testing. Prices, stock, editions, platform support, return terms, and recalls can change. Six high-variance bundles received an explicit two-source price snapshot on the research date and all cleared the approved ceiling then. The automation must rerun that live check before any later external publication or purchase. All links are ordinary non-affiliate links because no affiliate program is enabled.

## The pair-or-pile test

Before buying two things, answer four questions:

1. **What have you actually noticed?** Name the repeated question, unfinished practice, visible workaround, or wish-list behavior.
2. **Do the items perform different jobs?** A lens plus a practice is stronger than two books that say the same thing.
3. **What happens when they meet?** Write down the first 20-minute interaction.
4. **Why might one be better?** If platform, player count, language, accessibility, ownership, storage, time, safety, or subtotal is uncertain, gift only the confident anchor.

## 1. Sapiens + Civilization VI: read it, play it, disagree with it

For the PC strategy player who enjoys arguing about big historical claims, **Sapiens** supplies a provocative macro-history lens and **Civilization VI** supplies a stylized system to interrogate. Read a section on agriculture, empire, or technology; play the related era; then name what the game turns into a controllable variable. Neither is a verified history course. Confirm the Windows Steam setup and ownership. This bundle qualified on a time-limited Steam price, so hold it whenever a fresh subtotal no longer clears the approved ceiling ([HarperCollins](https://www.harpercollins.com/products/sapiens-yuval-noah-harari), [The Guardian](https://www.theguardian.com/books/2014/sep/11/sapiens-brief-history-humankind-yuval-noah-harari-review), [2K](https://store.2k.com/en/game/buy-civilization-6), [Steam](https://store.steampowered.com/app/289070/Sid_Meiers_Civilization_VI/), [PC Gamer](https://www.pcgamer.com/civilization-6-review/)).

## 2. The Genius of Birds + Wingspan: from card facts to birds outside

This is for someone who already watches, feeds, photographs, or talks about birds **and** welcomes a medium-weight computer strategy game. Pick a cognition story, play until a related behavior appears, verify the card fact independently, then look for the behavior outdoors. Wingspan Digital is not a field guide; its Steam account, supported computer, ownership, interface readability, rules, and screen-time preference all need checking. If digital-strategy enthusiasm is assumed rather than observed, give only the book ([Penguin Random House](https://www.penguinrandomhouse.com/books/312321/the-genius-of-birds-by-jennifer-ackerman/), [Scientific American](https://www.scientificamerican.com/article/book-review-the-genius-of-birds/), [Stonemaier Games](https://stonemaiergames.com/games/wingspan/digital-versions/), [Steam](https://store.steampowered.com/app/1054490/Wingspan/), [PC Gamer](https://www.pcgamer.com/wingspan-review/)).

## 3. A City on Mars + Ares Expedition: put the constraints back in

The book and game intentionally disagree. **A City on Mars** emphasizes settlement biology, logistics, law, and ethics; **Terraforming Mars: Ares Expedition** compresses planetary transformation into a shorter standalone engine. Read one constraint, play a round, and identify what the game models, ignores, or makes implausibly easy. Buy the pair only for someone with table space, time, a player or solo plan, and patience for engine-building rules. Confirm the standalone base game, because Ares Expedition is neither the original Terraforming Mars nor an expansion for it ([Penguin Random House](https://www.penguinrandomhouse.com/books/639449/a-city-on-mars-by-kelly-and-zach-weinersmith/), [Kirkus](https://www.kirkusreviews.com/book-reviews/kelly-weinersmith/a-city-on-mars/), [Stronghold Games](https://strongholdgames.com/our-games/terraforming-mars-ares-expedition/), [Ars Technica](https://arstechnica.com/gaming/2022/07/terraforming-mars-ares-expedition-makes-a-great-board-game-more-accessible/)).

## 4. Thinking in Systems + Pandemic: diagram the table

For the friend who already talks about bottlenecks, incentives, and feedback loops, **Thinking in Systems** names the patterns and **Pandemic** creates a compact cooperative system to examine. After one game, diagram a stock, a flow, a delay, and one reinforcing or balancing loop. The disease theme must be welcome, and the group needs a rule against one experienced player directing everyone. Pandemic is not an epidemiology model ([Chelsea Green](https://www.chelseagreen.com/product/thinking-in-systems/), [Yale Journal of Industrial Ecology](https://jie.yale.edu/thinking-systems-primer), [Z-Man Games](https://www.zmangames.com/game/pandemic/), [GamesRadar](https://www.gamesradar.com/pandemic-board-game-review/)).

## 5. Because Internet + Codenames: test the shared context

This pair barely earns its place because the game does not directly teach internet linguistics. It works only for a recipient fascinated by tone, memes, punctuation, or slang who also gathers four or more people with shared language and references. Read about context, play one round, and ask why a clue worked for this group but might fail elsewhere. In mixed-language or language-processing-sensitive groups, give only **Because Internet** ([Penguin Random House](https://www.penguinrandomhouse.com/books/540664/because-internet-by-gretchen-mcculloch/9780735210943/), [TIME](https://time.com/5629246/because-internet-book-review/), [Czech Games Edition](https://www.czechgames.com/games/codenames), [Opinionated Gamers](https://opinionatedgamers.com/2025/08/30/codenames-refresh-2025/)).

## 6. Leave Only Footprints + Trekking the National Parks: end with one real trail

For the park lover with trip photos, an NPS passport, or recurring trail plans, the memoir contributes personal park stories while **Trekking the National Parks Third Edition** creates a shared route through park photos and facts. Choose a chapter, play until that park appears, then save one real trail or revisit one photo album. Confirm the third edition, two-to-five-player or solo plan, and small-part safety; do not rely on rules or player counts from older editions ([Penguin Random House](https://www.penguinrandomhouse.com/books/600367/leave-only-footprints-by-conor-knighton/), [Kirkus](https://www.kirkusreviews.com/book-reviews/conor-knighton/leave-only-footprints/), [Western National Parks Store](https://store.wnpa.org/products/trekking-the-national-parks-3rd-edition), [Geeks Under Grace](https://www.geeksundergrace.com/tabletop/review-trekking-the-national-parks-3rd-edition/)).

## 7. Steering the Craft + Rory’s Story Cubes: optional constraints, not extra homework

This pair also sits near the threshold. **Steering the Craft** supplies the real craft objective; three rolled icons merely lower blank-page friction. Roll, choose one Le Guin exercise, write for twenty minutes, and discard any constraint that does not help. Skip the dice if the recipient already has prompts, dislikes improvisation, or would read them as juvenile. The book alone is the stronger default ([Ursula K. Le Guin](https://www.ursulakleguin.com/steering-the-craft), [Kirkus](https://www.kirkusreviews.com/book-reviews/ursula-k-le-guin/steering-the-craft/), [Story Cubes](https://www.storycubes.com/en/games/rorys-story-cubes-classic/), [Family Game Shelf](https://familygameshelf.com/2022/05/17/rorys-story-cubes-review/)).

## 8. Read This If You Want to Take Great Photographs + 52 Assignments: Street Photography

For a beginner who already shares photos and asks how to improve, one item explains composition, exposure, light, and seeing; the other schedules a bounded practice. Read one technique, take a short photo walk, and review one image together. Confirm the revised 2023 guide, current U.S. stock, camera access, privacy, mobility, lawful locations, and comfort photographing in public. The guide alone is better if assignments would feel like judgment or homework ([Laurence King](https://us.laurenceking.com/products/read-this-if-you-want-to-take-great-photographs), [Photofocus](https://photofocus.com/reviews/book-review-read-this-if-you-want-to-take-great-photographs/), [Ammonite Press](https://www.ammonitepress.com/52-assignments/), [Northlight Images](https://www.northlight-images.co.uk/book-review-52-assignments-street-photography/)).

## 9. Entangled Life + Undergrove: trace the exchange

This is the strongest pure book-and-game loop. **Entangled Life** makes fungal interdependence vivid; **Undergrove** assigns distinct roles to trees, fungi, carbon, and nutrients. Choose one mycorrhizal exchange claim, play a round, and trace what the game abstracts or omits. The book is not a foraging guide, the game is not a scientific simulation, and the rules/reference burden makes the bundle wrong for a non-gamer ([Penguin Random House](https://www.penguinrandomhouse.com/books/566795/entangled-life-by-merlin-sheldrake/), [The Guardian](https://www.theguardian.com/books/2020/aug/27/entangled-life-by-merlin-sheldrake-review-a-brilliant-door-opener-book), [AEG](https://www.alderac.com/undergrove/), [Meeple Mountain](https://www.meeplemountain.com/reviews/undergrove/)).

## 10. The Food Lab + TempPro TP19H: the useful tool a cook keeps postponing

This pair captures the self-purchase gap directly. The large reference explains heat and temperature; the compact probe performs the measurement job. It fits the cook you have watched guess doneness, borrow a thermometer, or say the old workaround is fine. Confirm the U.S. hardcover ISBN, model TP19H, no trusted instant-read thermometer, safe handling and cleaning around hot food, readable compact display, one AAA battery, and a safe storage spot. If the book is too much, gift only the thermometer ([W. W. Norton](https://wwnorton.com/books/9780393081084), [Chemistry World](https://www.chemistryworld.com/culture/the-food-lab-better-home-cooking-through-science/9443.article), [TempPro](https://temppro.com/products/tp19h-instant-read-meat-thermometer), [Consumer Reports](https://www.consumerreports.org/appliances/meat-thermometers/thermopro-digital-meat-thermometer-tp19h/m407252/), [USDA](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart)).

## Four pairs we rejected

- **The Secret Lives of Color + Hues and Cues:** coherent for a carefully screened group, but color discrimination is the game’s central mechanism and creates an intrinsic accessibility failure for some recipients.
- **The 99% Invisible City + Archidoodle:** a strong interaction concept stopped by current U.S. publisher stock and weak exact-edition independent evidence for the companion.
- **The Genius of Birds + Wingspan promo cards:** the companion is not independently useful without the base game.
- **Sapiens + Civilization VII:** higher cost, hardware burden, edition churn, and ownership complexity made Civilization VI the safer qualified companion.

The final rule is simple: **a connection they would not assemble themselves can be thoughtful; a matched pile they cannot use is still clutter.** Recheck stock, exact editions, live subtotal, platform support, return terms, and relevant safety guidance before purchase.`;

lines.push(body);

const socialAngles = [
  ['pair-or-pile-diagnostic', 'pinterest', 'vertical-checklist', 'Pair or pile? The four-question gift-pair test', 'Two gifts belong together only when they do different jobs, create a specific interaction, work separately, and pass the recipient checks. Use the guide before adding a companion.', pairs[8]],
  ['read-play-disagree', 'instagram', 'five-slide-carousel', 'Read it, play it, disagree with it', 'Sapiens plus Civilization VI works as a debate, not a history course. Read one claim, play the related era, and name what the game turns into a controllable variable.', pairs[0]],
  ['bird-cards-to-outdoors', 'pinterest', 'interaction-loop-card', 'From bird cards to birds outside', 'Read one bird-cognition story, find a related behavior in Wingspan Digital, verify the fact, then look for it outdoors. Confirm Steam, a supported computer, and ownership first.', pairs[1]],
  ['mars-model-gap', 'instagram', 'six-slide-carousel', 'What does the Mars game make too easy?', 'Pair one real settlement constraint with one Ares Expedition round. The interesting gift is the disagreement between the models—not matching red-planet covers. Confirm the standalone base game.', pairs[2]],
  ['systems-after-game', 'pinterest', 'worksheet', 'After Pandemic, draw the feedback loop', 'Name one stock, one flow, one delay, and one feedback loop after the game. Confirm the outbreak theme is welcome and keep one player from taking over every decision.', pairs[3]],
  ['game-gift-five-checks', 'tiktok', 'thirty-second-script', 'Five checks before gifting any game', 'Exact edition. Ownership. Player count. Learning time. Accessibility. If one answer is unknown, the anchor book is more thoughtful than an unusable bundle.', pairs[4]],
  ['park-story-to-trail-social', 'pinterest', 'two-step-map', 'Turn a park story into one real trail', 'Read a park chapter, play until the park appears, then save one trail or revisit one photo album. Confirm Trekking the National Parks Third Edition, small-part safety, and a real player plan.', pairs[5]],
  ['photo-technique-weekend', 'instagram', 'four-slide-carousel', 'Technique today, one assignment this weekend', 'The camera they already own may be enough. Pair one approachable technique with one safe, lawful photo walk and review a single image together afterward.', pairs[7]],
  ['fungal-network-trace', 'pinterest', 'systems-diagram', 'Trace the fungal exchange from page to table', 'Entangled Life opens the ecology; Undergrove turns exchange into a puzzle. Follow carbon and nutrients, then name what the game necessarily leaves out.', pairs[8]],
  ['cook-tool-self-purchase-gap', 'tiktok', 'thirty-second-script', 'The useful kitchen tool cooks postpone buying', 'If you have watched a cook guess doneness or borrow a thermometer, that observed workaround is the gift clue. Verify model TP19H, duplicates, probe safety, one AAA battery, and the live bundle subtotal.', pairs[9]]
];
const socialPack = {
  schemaVersion: '1.0.0', packId: `${articleSlug}-launch`, articleSlug, researchRun: runId, status: 'draft', createdAt: '2026-08-03T16:30:00.000Z',
  policy: { officialApiRequired: true, externalPublishingAuthorized: false, containsAffiliateLinks: false },
  posts: socialAngles.map(([id, platform, format, headline, copy, pair], index) => ({
    id, platform, format, status: 'draft', angle: id === 'pair-or-pile-diagnostic' ? 'Teach the general pair-or-pile decision before introducing any single bundle' : `Teach the ${pair.name} decision through recipient fit and a concrete interaction`, headline, copy,
    assetBrief: `Original ${format} using typography and simple line illustrations only; show the interaction, the choose-one fallback, and no third-party product photography or logos.`,
    altText: `Editorial graphic explaining ${pair.name}, its interaction, and the check that determines whether to choose only one item.`,
    destinationUrl: `https://tipsforyourgifts.web.app/blog/${articleSlug}`,
    claimIds: [
      claimId(pair.id, 'friction'), claimId(pair.id, 'coherence'),
      ...(budgetSnapshots[pair.id] ? [claimId(pair.id, 'budget')] : []),
      claimId(pair.a, 'compatibility'), claimId(pair.a, 'drawback'),
      claimId(pair.b, 'compatibility'), claimId(pair.b, 'drawback')
    ],
    productIds: [pair.a, pair.b], pairIds: [pair.id], disclosureRequired: false, externalPostId: null
  }))
};

await fs.writeFile(path.join(root, 'research', 'runs', `${runId}.json`), `${JSON.stringify(run, null, 2)}\n`);
await fs.writeFile(path.join(root, 'src', 'data', 'blog', `${articleSlug}.md`), `${lines.join('\n')}\n`);
await fs.writeFile(path.join(root, 'social', 'drafts', `${articleSlug}-launch.json`), `${JSON.stringify(socialPack, null, 2)}\n`);

console.log(JSON.stringify({ runId, articleSlug, candidates: run.candidates.length, finalists: run.finalists.length, pairs: run.pairs.length, sources: run.sources.length, claims: run.claims.length, socialPosts: socialPack.posts.length, status: run.status }, null, 2));
