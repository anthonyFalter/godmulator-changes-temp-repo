import { EPOCHS } from './catalog';
import {
  ChronicleEvent,
  LoreBookState,
  LoreEntry,
  LoreEntryCategory,
  SimulationState,
} from './types';

const MAX_LORE_ENTRIES = 120;
const MAX_PROCESSED_IDS = 240;

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function toRoman(n: number): string {
  if (n >= 1 && n <= ROMAN_NUMERALS.length) return ROMAN_NUMERALS[n - 1];
  return String(n);
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function parseYearFromLabel(yearLabel: string, fallbackYear: number): number {
  const m = /(\d+)/.exec(yearLabel);
  if (m) {
    const parsed = Number.parseInt(m[1], 10);
    if (Number.isFinite(parsed) && parsed >= 1) return parsed;
  }
  return Math.max(1, Math.floor(fallbackYear || 1));
}

function getEpochName(epochIndex: number): string {
  return EPOCHS[epochIndex]?.name ?? `Age ${epochIndex + 1}`;
}

export function classifyChronicleEvent(ev: ChronicleEvent): {
  category: LoreEntryCategory;
  emblem: string;
} {
  const lower = ev.text.toLowerCase();
  if (lower.includes('god titan') || lower.includes('death beam') || lower.includes('orbital strike')) {
    return { category: 'titan', emblem: 'titan' };
  }
  if (lower.includes('zombie')) {
    return { category: 'zombie', emblem: 'zombie' };
  }
  if (lower.includes('wonder') || lower.includes('monument') || lower.includes('colossus') || lower.includes('pyramid')) {
    return { category: 'wonder', emblem: 'wonder' };
  }
  if (ev.tone === 'epoch' || lower.includes('age') || lower.includes('epoch') || lower.includes('ascend') || lower.includes('era')) {
    return { category: 'epoch', emblem: 'epoch' };
  }
  if (lower.includes('peace') || lower.includes('treaty') || lower.includes('alliance') || lower.includes('harmony')) {
    return { category: 'peace', emblem: 'peace' };
  }
  if (
    lower.includes('war') ||
    lower.includes('rebel') ||
    lower.includes('invad') ||
    lower.includes('siege') ||
    lower.includes('conquer') ||
    lower.includes('raider') ||
    lower.includes('battle') ||
    lower.includes('skeleton') ||
    lower.includes('alien')
  ) {
    return { category: 'war', emblem: 'war' };
  }
  if (
    lower.includes('founded') ||
    lower.includes('settlement') ||
    lower.includes('kingdom') ||
    lower.includes('king') ||
    lower.includes('crowned') ||
    lower.includes('capital') ||
    lower.includes('reclaimed an offshore')
  ) {
    return { category: 'kingdom', emblem: 'kingdom' };
  }
  if (
    lower.includes('meteor') ||
    lower.includes('asteroid') ||
    lower.includes('volcan') ||
    lower.includes('earthquake') ||
    lower.includes('tsunami') ||
    lower.includes('tornado') ||
    lower.includes('plague') ||
    lower.includes('wildfire') ||
    lower.includes('blight') ||
    lower.includes('nuke') ||
    lower.includes('void') ||
    lower.includes('dragon') ||
    ev.tone === 'warning'
  ) {
    return { category: 'disaster', emblem: 'disaster' };
  }
  if (ev.tone === 'divine' || lower.includes('bless') || lower.includes('miracle') || lower.includes('divine') || lower.includes('rain')) {
    return { category: 'divine', emblem: 'divine' };
  }
  return { category: 'legend', emblem: 'legend' };
}

function weaveEpicVerse(
  ev: ChronicleEvent,
  category: LoreEntryCategory,
  epochName: string,
  year: number,
  seed: number,
): { title: string; body: string } {
  const cleanFact = ev.text.trim().replace(/\.$/, '');
  const yearPhrase = `In the ${year === 1 ? 'First Year' : `Year ${year}`} of the ${epochName}`;

  switch (category) {
    case 'titan': {
      const titles = [
        'Descent of the Iron God',
        'Wrath of the Divine Titan',
        'When the Heavens Shattered',
        'Footsteps of the Colossus',
      ];
      const intros = [
        `${yearPhrase}, the clouds parted before an engine of celestial judgment.`,
        `${yearPhrase}, mortals fell to their knees as thunder walked the earth.`,
        `${yearPhrase}, a towering titan of divine steel descended upon the realm.`,
      ];
      const outros = [
        'Songs of that blinding radiance were whispered for generations.',
        'The scarred horizon bore witness to the sovereign might from above.',
        'No fortress or banner could stand unshaken beneath its gaze.',
      ];
      return {
        title: pick(titles, seed),
        body: `${pick(intros, seed + 1)} ${cleanFact}. ${pick(outros, seed + 2)}`,
      };
    }
    case 'zombie': {
      const titles = [
        'The Green Contagion',
        'Shards of the Undying',
        'Night of the Risen Flesh',
        'The Necrotic Flask',
      ];
      const intros = [
        `${yearPhrase}, a wicked vial plummeted from the firmament and shattered upon the soil.`,
        `${yearPhrase}, an unnatural green mist crept across field and den alike.`,
        `${yearPhrase}, the boundary between the living and the dead was violently undone.`,
      ];
      const outros = [
        'Beast, myth, and mortal alike stumbled forth with hollow, hungering eyes.',
        'Watchfires were lit across every border to hold back the shambling tide.',
        'The corrupted earth remembers the hour the plague took root.',
      ];
      return {
        title: pick(titles, seed),
        body: `${pick(intros, seed + 1)} ${cleanFact}. ${pick(outros, seed + 2)}`,
      };
    }
    case 'wonder': {
      const titles = [
        'A Monument for the Ages',
        'Stone Raised to Eternity',
        'Triumph of Mortal Hands',
        'The Great Wonder',
      ];
      const intros = [
        `${yearPhrase}, master builders crowned the skyline with a marvel of ambition.`,
        `${yearPhrase}, pilgrims traveled from distant shores to behold a newfound wonder.`,
      ];
      return {
        title: pick(titles, seed),
        body: `${pick(intros, seed + 1)} ${cleanFact}. Its silhouette became a beacon of pride and legend.`,
      };
    }
    case 'epoch': {
      const titles = [
        `Dawn of the ${epochName}`,
        'The Turning of the Age',
        'A New Chapter of Civilization',
        'The Great Awakening',
      ];
      const intros = [
        `${yearPhrase}, the old world shed its skin as wisdom and craft surged forward.`,
        `${yearPhrase}, bells rang across the realm to herald a bold new era.`,
      ];
      return {
        title: pick(titles, seed),
        body: `${pick(intros, seed + 1)} ${cleanFact}. Scholars marked the date in gold ink upon the royal scrolls.`,
      };
    }
    case 'war': {
      const titles = [
        'Drums of War',
        'Blood Upon the Banner',
        'The Clash of Realms',
        'Iron and Ash',
      ];
      const intros = [
        `${yearPhrase}, horns of battle echoed across valley and ridge.`,
        `${yearPhrase}, steel was drawn and the peace of the realm fractured.`,
        `${yearPhrase}, banners marched beneath darkening skies.`,
      ];
      const outros = [
        'Chroniclers recorded the valor and sorrow of all who stood the line.',
        'The fate of borders hung upon the edge of every blade.',
      ];
      return {
        title: pick(titles, seed),
        body: `${pick(intros, seed + 1)} ${cleanFact}. ${pick(outros, seed + 2)}`,
      };
    }
    case 'peace': {
      const titles = [
        'The Olive Accord',
        'Truce Beneath Quiet Skies',
        'Swords Sheathed in Harmony',
      ];
      return {
        title: pick(titles, seed),
        body: `${yearPhrase}, envoys laid down their arms and swore an oath of renewal. ${cleanFact}. Markets reopened and hearthfires burned bright once more.`,
      };
    }
    case 'kingdom': {
      const titles = [
        'Crown and Hearth',
        'Rise of a Realm',
        'Founding of the Banner',
        'A Kingdom Takes Root',
      ];
      const intros = [
        `${yearPhrase}, pioneers drove their stakes into the wild earth and raised a proud banner.`,
        `${yearPhrase}, a new seat of power rose to claim its place in history.`,
      ];
      return {
        title: pick(titles, seed),
        body: `${pick(intros, seed + 1)} ${cleanFact}. From humble timber and stone, a lasting legacy began.`,
      };
    }
    case 'disaster': {
      const titles = [
        'Fury of the Elements',
        'The Day the Sky Wept Fire',
        'Calamity Unbound',
        'Trial of Ash and Ruin',
      ];
      const intros = [
        `${yearPhrase}, terror swept the land as nature and wrath collided.`,
        `${yearPhrase}, the heavens offered no mercy to the settlements below.`,
        `${yearPhrase}, a dark omen became sudden cataclysm.`,
      ];
      const outros = [
        'Survivors clung to hope amidst the smoke, vowing to rebuild.',
        'Yet even where ash settles, life stubbornly waits to return.',
      ];
      return {
        title: pick(titles, seed),
        body: `${pick(intros, seed + 1)} ${cleanFact}. ${pick(outros, seed + 2)}`,
      };
    }
    case 'divine': {
      const titles = [
        'Hand of the Creator',
        'A Miracle Bestowed',
        'Grace from Beyond the Clouds',
        'The Whisper of Providence',
      ];
      const intros = [
        `${yearPhrase}, golden light spilled through the clouds in answer to mortal prayers.`,
        `${yearPhrase}, an unseen architect reshaped destiny with a single gesture.`,
      ];
      return {
        title: pick(titles, seed),
        body: `${pick(intros, seed + 1)} ${cleanFact}. Priests inscribed the omen as proof of a watchful deity.`,
      };
    }
    default: {
      const titles = [
        'Echoes of the Realm',
        'A Tale Worth Keeping',
        'Annals of the World',
      ];
      return {
        title: pick(titles, seed),
        body: `${yearPhrase}, a memorable turn unfolded across the lands. ${cleanFact}.`,
      };
    }
  }
}

function buildRetroactivePrologueEntries(state: SimulationState): LoreEntry[] {
  const entries: LoreEntry[] = [];
  const seedNum = hashSeed(String(state.seed || 'GODMULATOR'));
  const epochName = getEpochName(0);
  const civUnits = state.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko');
  const speciesSet = new Set(civUnits.map((u) => u.species));
  const namedRealms = Object.values(state.settlementNames ?? {}).filter(Boolean);

  const openingLines = [
    'Before the first banner was sewn or the first hearth kindled, land rose from the endless sea at the command of an unseen creator.',
    'Out of primordial mist and shifting stone, a living world took shape beneath the watchful gaze of the heavens.',
    'In the quiet hush of the First Dawn, mountains lifted their crowns and green valleys awaited the footsteps of mortals.',
  ];

  let prologueBody = pick(openingLines, seedNum);
  if (namedRealms.length > 0) {
    const realmList = namedRealms.slice(0, 3).join(', ');
    prologueBody += ` Across these shores arose the realms of ${realmList}, carrying the hopes of ${civUnits.length} living souls.`;
  } else if (civUnits.length > 0) {
    prologueBody += ` Early wanderers (${civUnits.length} strong) began charting the wilds in search of shelter and destiny.`;
  } else {
    prologueBody += ' The continents lay untamed, humming with wildlife and awaiting the spark of civilization.';
  }
  if (speciesSet.size > 1) {
    const speciesNames = Array.from(speciesSet)
      .slice(0, 4)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(', ');
    prologueBody += ` Peoples of ${speciesNames} heritage would each leave their mark upon its soil.`;
  }

  entries.push({
    id: 'lore_prologue_creation',
    year: 1,
    yearLabel: 'Year 1',
    epochIndex: 0,
    epochName,
    category: 'creation',
    title: 'The Dawn of Creation',
    body: prologueBody,
    emblem: 'creation',
    timestamp: Date.now() - 10_000,
  });

  // Retroactively honor existing World Wonders if not already recorded in chronicle
  const wonders = state.worldWonders ?? [];
  for (const w of wonders) {
    if ((w.hp ?? 1) <= 0) continue;
    const realmName = state.settlementNames?.[w.settlementId] ?? 'a proud realm';
    entries.push({
      id: `lore_retro_wonder_${w.id}`,
      year: Math.max(1, Math.floor(state.year || 1)),
      yearLabel: `Year ${Math.max(1, Math.floor(state.year || 1))}`,
      epochIndex: state.epochIndex ?? 0,
      epochName: getEpochName(state.epochIndex ?? 0),
      category: 'wonder',
      title: `The ${w.name}`,
      body: `Standing tall as a testament to mortal ambition, the ${w.name} was raised by the artisans of ${realmName}. Travelers speak of its splendor from across the seas.`,
      emblem: 'wonder',
      x: w.tileX,
      z: w.tileZ,
      timestamp: Date.now() - 5_000,
    });
  }

  return entries;
}

export function ensureLoreBook(state: SimulationState): LoreBookState {
  if (!state.loreBook) {
    state.loreBook = {
      entries: [],
      processedChronicleIds: [],
      unreadCount: 0,
      seededRetroactive: false,
    };
  }
  if (!state.loreBook.seededRetroactive) {
    state.loreBook.seededRetroactive = true;
    const retroEntries = buildRetroactivePrologueEntries(state);
    for (const entry of retroEntries) {
      if (!state.loreBook.entries.some((e) => e.id === entry.id)) {
        state.loreBook.entries.push(entry);
      }
    }
  }
  syncLoreBookFromChronicle(state, false);
  return state.loreBook;
}

/**
 * Incrementally converts unprocessed ChronicleEvents into epic LoreBook verses.
 * Processes oldest-to-newest so retroactive worlds read in chronological order.
 */
export function syncLoreBookFromChronicle(
  state: SimulationState,
  countAsUnread = true,
): number {
  if (!state.loreBook) {
    state.loreBook = {
      entries: [],
      processedChronicleIds: [],
      unreadCount: 0,
      seededRetroactive: false,
    };
  }
  const book = state.loreBook;
  if (!book.seededRetroactive) {
    book.seededRetroactive = true;
    const retroEntries = buildRetroactivePrologueEntries(state);
    for (const entry of retroEntries) {
      if (!book.entries.some((e) => e.id === entry.id)) {
        book.entries.push(entry);
      }
    }
  }

  const processed = new Set(book.processedChronicleIds);
  const chronicle = state.chronicle ?? [];
  // state.chronicle is newest-first; iterate oldest-first for chronological storytelling
  let addedCount = 0;

  for (let i = chronicle.length - 1; i >= 0; i--) {
    const ev = chronicle[i];
    if (!ev || !ev.id || processed.has(ev.id)) continue;
    processed.add(ev.id);
    book.processedChronicleIds.push(ev.id);

    // Skip trivial routine build chatter so the lore book stays epic & readable
    if (ev.tone === 'build' && !/wonder|capital|founded|reclaimed|monument/i.test(ev.text)) {
      continue;
    }

    const { category, emblem } = classifyChronicleEvent(ev);
    const year = parseYearFromLabel(ev.yearLabel, state.year);
    const epochIndex = state.epochIndex ?? 0;
    const epochName = getEpochName(epochIndex);
    const seed = hashSeed(`${ev.id}_${ev.text}_${year}`);

    // Anti-spam coalescing: merge repeated same-category bursts within the same year
    const lastEntry = book.entries[book.entries.length - 1];
    if (
      lastEntry &&
      lastEntry.category === category &&
      lastEntry.year === year &&
      category !== 'wonder' &&
      category !== 'epoch' &&
      category !== 'creation'
    ) {
      const nextCount = (lastEntry.count ?? 1) + 1;
      lastEntry.count = nextCount;
      if (!lastEntry.body.includes('again and again') && nextCount === 2) {
        lastEntry.body += ` Again and again the omen struck that year (${nextCount} times recorded).`;
      } else if (nextCount > 2) {
        lastEntry.body = lastEntry.body.replace(
          /\(\d+ times recorded\)\./,
          `(${nextCount} times recorded).`,
        );
      }
      if (ev.x !== undefined && ev.z !== undefined) {
        lastEntry.x = ev.x;
        lastEntry.z = ev.z;
      }
      continue;
    }

    const { title, body } = weaveEpicVerse(ev, category, epochName, year, seed);
    book.entries.push({
      id: `lore_${ev.id}`,
      year,
      yearLabel: ev.yearLabel || `Year ${year}`,
      epochIndex,
      epochName,
      category,
      title,
      body,
      emblem,
      x: ev.x,
      z: ev.z,
      timestamp: ev.timestamp || Date.now(),
      sourceChronicleId: ev.id,
      count: 1,
    });
    addedCount++;
    if (countAsUnread) {
      book.unreadCount = Math.min(99, (book.unreadCount ?? 0) + 1);
    }
  }

  if (book.entries.length > MAX_LORE_ENTRIES) {
    // Always preserve the Creation Prologue at index 0
    const prologue = book.entries[0];
    const tail = book.entries.slice(-(MAX_LORE_ENTRIES - 1));
    book.entries = prologue?.category === 'creation' ? [prologue, ...tail] : tail;
  }
  if (book.processedChronicleIds.length > MAX_PROCESSED_IDS) {
    book.processedChronicleIds = book.processedChronicleIds.slice(-MAX_PROCESSED_IDS);
  }

  return addedCount;
}

export function markLoreBookRead(state: SimulationState): void {
  if (state.loreBook) {
    state.loreBook.unreadCount = 0;
  }
}

export interface LoreChapterSummary {
  chapterNumber: number;
  roman: string;
  title: string;
  epochName: string;
  startYear: number;
  spreadIndex: number;
  entryCount: number;
}

export type LoreBookPage =
  | {
      kind: 'title';
      worldName: string;
      seed: string;
      year: number;
      epochName: string;
      population: number;
      kingdomCount: number;
      wonderCount: number;
      miraclesCast: number;
    }
  | {
      kind: 'toc';
      chapters: LoreChapterSummary[];
      totalEntries: number;
    }
  | {
      kind: 'story';
      pageNumber: number;
      chapterNumber: number;
      chapterRoman: string;
      chapterTitle: string;
      isChapterStart: boolean;
      entries: LoreEntry[];
    }
  | {
      kind: 'blank';
      pageNumber: number;
      epilogueQuote: string;
    };

export interface LoreBookSpread {
  spreadIndex: number;
  left: LoreBookPage;
  right: LoreBookPage;
}

export function buildLoreBookSpreads(
  state: SimulationState,
  worldName: string,
): { spreads: LoreBookSpread[]; chapters: LoreChapterSummary[] } {
  const book = ensureLoreBook(state);
  const entries = book.entries;

  // Group entries into chapters by epochIndex
  interface RawChapter {
    epochIndex: number;
    epochName: string;
    entries: LoreEntry[];
  }
  const rawChapters: RawChapter[] = [];
  for (const entry of entries) {
    const prev = rawChapters[rawChapters.length - 1];
    if (prev && prev.epochIndex === entry.epochIndex) {
      prev.entries.push(entry);
    } else {
      rawChapters.push({
        epochIndex: entry.epochIndex,
        epochName: entry.epochName || getEpochName(entry.epochIndex),
        entries: [entry],
      });
    }
  }

  const storyPages: LoreBookPage[] = [];
  const chapters: LoreChapterSummary[] = [];
  let pageNum = 1;

  rawChapters.forEach((ch, idx) => {
    const chapterNumber = idx + 1;
    const roman = toRoman(chapterNumber);
    const chapterTitle =
      chapterNumber === 1 && ch.epochIndex === 0
        ? `The ${ch.epochName}`
        : ch.epochName;
    // Spread 0 is Title + TOC, so storyPages[0] sits on Spread 1 (left), storyPages[1] on Spread 1 (right), etc.
    const startStoryPageIdx = storyPages.length;
    const spreadIndex = 1 + Math.floor(startStoryPageIdx / 2);

    chapters.push({
      chapterNumber,
      roman,
      title: chapterTitle,
      epochName: ch.epochName,
      startYear: ch.entries[0]?.year ?? 1,
      spreadIndex,
      entryCount: ch.entries.length,
    });

    // Pack 2 lore entries per parchment page for clean readability
    for (let j = 0; j < ch.entries.length; j += 2) {
      storyPages.push({
        kind: 'story',
        pageNumber: pageNum++,
        chapterNumber,
        chapterRoman: roman,
        chapterTitle,
        isChapterStart: j === 0,
        entries: ch.entries.slice(j, j + 2),
      });
    }
  });

  if (storyPages.length % 2 === 1) {
    storyPages.push({
      kind: 'blank',
      pageNumber: pageNum++,
      epilogueQuote: 'The ink is still wet. Future deeds await the turning of the seasons...',
    });
  }

  const population = state.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko').length;
  const kingdomCount = Object.keys(state.settlementNames ?? {}).length;
  const wonderCount = (state.worldWonders ?? []).filter((w) => (w.hp ?? 1) > 0).length;

  const spreads: LoreBookSpread[] = [
    {
      spreadIndex: 0,
      left: {
        kind: 'title',
        worldName: worldName || 'Untitled Realm',
        seed: String(state.seed || 'ANCIENT'),
        year: Math.max(1, Math.floor(state.year || 1)),
        epochName: getEpochName(state.epochIndex ?? 0),
        population,
        kingdomCount,
        wonderCount,
        miraclesCast: state.totalMiraclesCast ?? 0,
      },
      right: {
        kind: 'toc',
        chapters,
        totalEntries: entries.length,
      },
    },
  ];

  for (let i = 0; i < storyPages.length; i += 2) {
    spreads.push({
      spreadIndex: 1 + i / 2,
      left: storyPages[i],
      right: storyPages[i + 1],
    });
  }

  return { spreads, chapters };
}
