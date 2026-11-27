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

function formatPoeticYear(year: number, seed: number): string {
  if (year <= 1) {
    return pick(
      ['In the first turning of the sun', 'Before the first winter had passed', 'At the dawn of the First Year'],
      seed,
    );
  }
  const seasons = ['spring thaw', 'high summer', 'late autumn', 'winter frost'];
  const s = pick(seasons, seed + year);
  const forms = [
    `In the ${s} of Year ${year}`,
    `When Year ${year} drew toward its ${s}`,
    `Under the pale skies of Year ${year}`,
    `By the ${s} of the ${year}th year`,
  ];
  return pick(forms, seed);
}

function weaveEpicVerse(
  ev: ChronicleEvent,
  category: LoreEntryCategory,
  epochName: string,
  year: number,
  seed: number,
): { title: string; body: string } {
  const raw = ev.text.trim().replace(/[.!]+$/, '');
  const factLower = raw.charAt(0).toLowerCase() + raw.slice(1);
  const when = formatPoeticYear(year, seed);

  switch (category) {
    case 'titan': {
      const titles = ['The Walking Sun', 'Iron Descended', 'Where Thunder Walked', 'The Colossus'];
      const closings = [
        'Where its shadow passed, rivers steamed and men forgot the sound of their own prayers.',
        'Long after the glow died from the clouds, the ridge still hummed like a struck bell.',
        'The earth kept the print of its footsteps long after the smoke drifted out to sea.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, the clouds parted to a weight no mountain could bear—${factLower}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'zombie': {
      const titles = ['The Green Vessel', 'What Rose From the Glass', 'The Pale Hunger', 'Blight of the Living'];
      const closings = [
        'By dusk, neither beast nor mortal remembered the warmth of a hearth, and the soil beneath the shards grew dark.',
        'Watchfires burned through the night, yet the shambling silhouettes did not turn from the flame.',
        'From hollow throats came no war-cry, only the slow dragging of feet across the ruined grass.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, a green star fell and broke open upon the earth—${factLower}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'wonder': {
      const titles = ['Stone Against Time', 'The High Work', 'A Crown of Marble', 'Handiwork of Mortals'];
      const closings = [
        'Sailors sighting it from the outer shoals swore it caught the morning light before the hills themselves.',
        'Its shadow measured the passing seasons, outliving the hands that set its highest stone.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, stone was set upon stone until the skyline itself changed—${factLower}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'epoch': {
      const titles = [`The ${epochName}`, 'Turning of the Wheel', 'New Fire on the Anvil', 'Songs of a New Age'];
      const closings = [
        'Old tools were hung above the lintel as a younger generation named the world anew.',
        'What had seemed impossible to their grandparents became the quiet craft of every village square.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, the long tide of memory turned toward the ${epochName}: ${factLower}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'war': {
      const titles = ['Iron in the Grass', 'The Broken Border', 'Drums Along the Ridge', 'Ash and Banner'];
      const closings = [
        'Ravens gathered on the fence-posts, and mothers listened to the wind for news from the pass.',
        'Neither plow nor song could mend what steel divided before the harvest moon.',
        'The banners fluttered bright at dawn and came home heavy with dust by nightfall.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, quiet fields learned the tread of marching boots—${factLower}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'peace': {
      const titles = ['The Quiet Ink', 'Swords Laid Down', 'Salt and Bread', 'The Long Truce'];
      const closings = [
        'Gates stood unbarred at twilight, and lanterns drifted once more across the border road.',
        'For a season, the smithies turned from spearheads back to hinges, bells, and plows.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, weary hands met across the table—${factLower}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'kingdom': {
      const titles = ['First Smoke on the Hill', 'Hearth and Crown', 'The Boundary Stone', 'A Name Upon the Map'];
      const closings = [
        'Timber went up against the wind, and the wild valley answered to a mortal name at last.',
        'From a single ring of campfires grew streets, granaries, and songs of belonging.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, travelers drove their stakes into untamed ground—${factLower}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'disaster': {
      const titles = ['The Sky Unbound', 'Ash Upon the Water', 'When the Earth Shook', 'The Dark Omen'];
      const closings = [
        'Smoke hung low over the valleys until rain washed the soot down to the shore.',
        'Those who endured spoke softly for years afterward, glancing upward whenever the wind fell still.',
        'Yet even in the blackened furrow, small green shoots waited beneath the ash for another spring.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, the calm of the world broke without warning—${factLower}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'divine': {
      const titles = ['The Unseen Hand', 'Light Through the Cloud', 'A Quiet Grace', 'The Maker’s Breath'];
      const closings = [
        'Elders bowed their heads in the fields, knowing the sky was neither empty nor asleep.',
        'No scribe could explain how it came to pass, only that the land felt lighter afterward.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, a hush fell across meadow and shore—${factLower}. ${pick(closings, seed + 2)}`,
      };
    }
    default: {
      const titles = ['A Passing Tale', 'Ink on Vellum', 'Remembered by the Hearth'];
      return {
        title: pick(titles, seed),
        body: `${when}, the chroniclers set down what the wind carried from afar—${factLower}.`,
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
    'Before any bell rang or any furrow was turned, stone lifted itself from the cold sea and drank the first sunlight.',
    'Out of salt water and drifting cloud, ridges rose into green valleys, waiting quietly for the first footprint in the moss.',
    'In the stillness before memory, the waters parted and a young world lay open beneath a wide, unhurried sky.',
  ];

  let prologueBody = pick(openingLines, seedNum);
  if (namedRealms.length > 0) {
    const realmList = namedRealms.slice(0, 3).join(', ');
    prologueBody += ` Along those coasts rose the hearths of ${realmList}, where ${civUnits.length} living souls first learned the shape of the hills.`;
  } else if (civUnits.length > 0) {
    prologueBody += ` Along the meadows wandered ${civUnits.length} early souls, carrying little more than fire and stubborn hope.`;
  } else {
    prologueBody += ' Only wind, tide, and wild creatures moved across the shores, awaiting whoever would come to name them.';
  }
  if (speciesSet.size > 1) {
    const speciesNames = Array.from(speciesSet)
      .slice(0, 4)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(', ');
    prologueBody += ` Folk of ${speciesNames} blood each claimed their own horizon.`;
  }

  entries.push({
    id: 'lore_prologue_creation',
    year: 1,
    yearLabel: 'Year 1',
    epochIndex: 0,
    epochName,
    category: 'creation',
    title: 'Before the First Bell',
    body: prologueBody,
    emblem: 'creation',
    timestamp: Date.now() - 10_000,
  });

  // Retroactively honor existing World Wonders if not already recorded in chronicle
  const wonders = state.worldWonders ?? [];
  for (const w of wonders) {
    if ((w.hp ?? 1) <= 0) continue;
    const realmName = state.settlementNames?.[w.settlementId] ?? 'a distant realm';
    entries.push({
      id: `lore_retro_wonder_${w.id}`,
      year: Math.max(1, Math.floor(state.year || 1)),
      yearLabel: `Year ${Math.max(1, Math.floor(state.year || 1))}`,
      epochIndex: state.epochIndex ?? 0,
      epochName: getEpochName(state.epochIndex ?? 0),
      category: 'wonder',
      title: `The ${w.name}`,
      body: `High above the roofs of ${realmName} stands the ${w.name}, carved against the years so the sea-wind itself might remember who built it.`,
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
