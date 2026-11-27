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

const MYTHIC_REALM_NAMES = [
  'Aethelgard',
  'Valenmoor',
  'Solmere',
  'Cindervale',
  'Eldermere',
  'Vaeloria',
  'Stormreach',
  'Aurelia',
  'Thornhold',
  'Miravel',
  'Drakenmere',
  'Oakhaven',
] as const;

const GENERIC_WORLD_NAMES = new Set([
  '',
  'my world',
  'untitled realm',
  'world',
  'new world',
  'unnamed world',
]);

export function resolveEpicRealmName(
  worldName: string | undefined,
  state: SimulationState,
): string {
  const trimmed = (worldName ?? '').trim();
  if (trimmed && !GENERIC_WORLD_NAMES.has(trimmed.toLowerCase())) {
    return trimmed;
  }
  const namedRealms = Object.values(state.settlementNames ?? {})
    .map((n) => n.trim())
    .filter(Boolean);
  if (namedRealms.length > 0) {
    return namedRealms[0];
  }
  const seedHash = hashSeed(String(state.seed || 'AETHELGARD'));
  return pick(MYTHIC_REALM_NAMES, seedHash);
}

const EPOCH_EPIGRAPHS: readonly string[] = [
  'When stone and ember first answered mortal hands.',
  'When ore was drawn from the mountain and beaten into edge and crown.',
  'When banners rose above timbered keeps and roads bound valley to sea.',
  'When iron wheels turned through smoke and the horizon grew small.',
  'When mortals split the hidden fire that sleeps inside the dust.',
  'When thought outran the wind and glass remembered every voice.',
  'When towers pierced the thin blue dark above the clouds.',
  'When the stars themselves became harbors along an endless tide.',
];

export function getEpochEpigraph(epochIndex: number): string {
  return EPOCH_EPIGRAPHS[Math.max(0, Math.min(EPOCH_EPIGRAPHS.length - 1, epochIndex))] ?? EPOCH_EPIGRAPHS[0];
}

function poeticizeChronicleFact(rawText: string): string {
  let s = rawText.trim().replace(/[.!]+$/, '');
  // Translate mechanical game-log phrasing into mythic chronicle language
  s = s
    .replace(/\bGod Titan Death Beam\b/gi, 'the Brass Colossus’s pillar of blinding sun-fire')
    .replace(/\bDeath Beam\b/gi, 'pillar of blinding sun-fire')
    .replace(/\bGod Titan\b/gi, 'the Brass Colossus')
    .replace(/\bZombie Virus flask shattered,?\s*mutating (\d+) creatures? into zombies\b/gi, 'a green-glass vessel of blight shattered upon the earth, twisting $1 living souls into shambling husks')
    .replace(/\bZombie Virus\b/gi, 'the pale green blight')
    .replace(/\bmutating (\d+) creatures? into zombies\b/gi, 'twisting $1 living souls into shambling husks')
    .replace(/\bnuclear mushroom cloud\b/gi, 'towering crown of ash and blinding fire')
    .replace(/\bnuclear\b/gi, 'sun-forged')
    .replace(/\bnuke\b/gi, 'falling star of fire')
    .replace(/\bwas founded\b/gi, 'raised its first banners and hearth-fires')
    .replace(/\bdeclared war on\b/gi, 'drew steel and marched against')
    .replace(/\bsigned a peace treaty with\b/gi, 'broke bread and swore truce with')
    .replace(/\bHP\b/g, 'vigor')
    .replace(/\s*\([^)]*seed[^)]*\)/gi, '')
    .replace(/\s*\(\d+\s*,\s*\d+\)/g, '')
    .trim();

  if (!s) return 'the fates moved unseen across the land';
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function formatPoeticYear(year: number, seed: number): string {
  if (year <= 1) {
    return pick(
      [
        'In the first turning of the sun',
        'Before the first winter had laid its frost',
        'At the dawn of the First Year',
      ],
      seed,
    );
  }
  const seasons = ['spring thaw', 'high summer', 'late autumn', 'deep winter'];
  const s = pick(seasons, seed + year);
  const forms = [
    `In the ${s} of Year ${year}`,
    `When Year ${year} drew toward its ${s}`,
    `Under the wide skies of Year ${year}`,
    `As the ${s} of Year ${year} settled over the hills`,
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
  const fact = poeticizeChronicleFact(ev.text);
  const when = formatPoeticYear(year, seed);

  switch (category) {
    case 'titan': {
      const titles = ['The Walking Sun', 'Iron Descended', 'Where Thunder Walked', 'The Brass Colossus'];
      const closings = [
        'Where its shadow passed, rivers steamed and men forgot the cadence of their own prayers.',
        'Long after the glare faded from the clouds, the ridge still hummed like a struck bell.',
        'The earth kept the print of its stride long after the smoke drifted out beyond the shoals.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, the firmament split beneath a weight no mountain could endure, for ${fact}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'zombie': {
      const titles = ['The Green Vessel', 'What Rose From the Glass', 'The Pale Hunger', 'Blight of the Living'];
      const closings = [
        'By dusk, neither beast nor mortal remembered the warmth of a hearth, and the soil beneath the shards grew black.',
        'Watchfires burned red upon the hills through the night, yet the shambling silhouettes did not turn from the flame.',
        'From hollow throats came no war-cry, only the slow dragging of feet across the ruined grass.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, a sickly star fell from the heavens and ${fact}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'wonder': {
      const titles = ['Stone Against Time', 'The High Work', 'A Crown of Marble', 'Handiwork of Mortals'];
      const closings = [
        'Sailors sighting it from the outer reefs swore it caught the morning gold before the peaks themselves.',
        'Its long shadow measured the passing seasons, outliving the hands that laid its highest stone.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, mortal craft answered the sky itself—${fact}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'epoch': {
      const titles = [`Dawn of the ${epochName}`, 'Turning of the Great Wheel', 'New Fire on the Anvil', 'Songs of a New Age'];
      const closings = [
        'Old tools were hung above the lintel as a younger generation named the world anew.',
        'What had seemed a fable to their forebears became the quiet craft of every village square.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, the long tide of history turned toward the ${epochName}, as ${fact}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'war': {
      const titles = ['Iron in the Grass', 'The Broken Border', 'Drums Along the Ridge', 'Ash and Banner'];
      const closings = [
        'Ravens gathered along the fence-posts, and mothers listened to the wind for word from the mountain pass.',
        'Neither plow nor song could mend what steel divided before the harvest moon.',
        'The banners marched out bright at dawn and returned heavy with dust by nightfall.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, quiet valleys learned the tread of marching boots—${fact}. ${pick(closings, seed + 2)}`,
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
        body: `${when}, weary hands met across the council table—${fact}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'kingdom': {
      const titles = ['First Smoke on the Hill', 'Hearth and Crown', 'The Boundary Stone', 'A Name Upon the Map'];
      const closings = [
        'Timber rose against the wind, and the wild valley answered to a mortal name at last.',
        'From a single ring of campfires grew streets, granaries, and songs of belonging.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, wanderers drove their stakes into untamed ground—${fact}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'disaster': {
      const titles = ['The Sky Unbound', 'Ash Upon the Water', 'When the Earth Shook', 'The Dark Omen'];
      const closings = [
        'Smoke hung low over the valleys until autumn rain washed the soot down to the shore.',
        'Those who endured spoke softly for years afterward, glancing upward whenever the wind fell still.',
        'Yet even in the blackened furrow, small green shoots waited beneath the ash for another spring.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, the calm of the realm broke without warning—${fact}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'divine': {
      const titles = ['The Unseen Hand', 'Light Through the Cloud', 'A Quiet Grace', 'The Maker’s Breath'];
      const closings = [
        'Elders bowed their heads in the fields, knowing the sky was neither empty nor asleep.',
        'No scribe could say how it came to pass, only that the land felt lighter afterward.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, a hush fell across meadow and shore as ${fact}. ${pick(closings, seed + 2)}`,
      };
    }
    default: {
      const titles = ['A Passing Tale', 'Ink on Vellum', 'Remembered by the Hearth'];
      return {
        title: pick(titles, seed),
        body: `${when}, the chroniclers set down what the wind carried from afar—${fact}.`,
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
      const repeatPhrase =
        nextCount === 2
          ? ' Twice did the omen return before the snows melted.'
          : nextCount === 3
            ? ' Thrice the heavens answered before the year was spent.'
            : ' Many times over through the turning seasons did that same reckoning echo across the land.';
      lastEntry.body = lastEntry.body.replace(
        /\s*(?:Twice did the omen return before the snows melted\.|Thrice the heavens answered before the year was spent\.|Many times over through the turning seasons did that same reckoning echo across the land\.|Again and again the omen struck that year \(\d+ times recorded\)\.)\s*$/,
        '',
      );
      lastEntry.body += repeatPhrase;
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
  /** Flat 0-based page index for mobile single-page reading (0 = title, 1 = contents, 2+ = story). */
  pageIndex: number;
  entryCount: number;
}

export type LoreBookPage =
  | {
      kind: 'title';
      worldName: string;
      year: number;
      epochName: string;
      epigraph: string;
      colophon: string;
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
      chapterEpigraph: string;
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

function buildPoeticColophon(kingdomCount: number, population: number, wonderCount: number): string {
  const realmPart =
    kingdomCount === 0
      ? 'An untamed world endures beneath the sky'
      : kingdomCount === 1
        ? 'One realm endures beneath the turning sky'
        : `${kingdomCount} realms endure beneath the turning sky`;
  const soulPart =
    population > 0 ? `, home to ${population} living ${population === 1 ? 'soul' : 'souls'}` : '';
  const wonderPart =
    wonderCount > 0 ? ` and ${wonderCount} ${wonderCount === 1 ? 'great wonder' : 'great wonders'}` : '';
  return `${realmPart}${soulPart}${wonderPart}.`;
}

export function buildLoreBookSpreads(
  state: SimulationState,
  worldName: string,
): { spreads: LoreBookSpread[]; pages: LoreBookPage[]; chapters: LoreChapterSummary[] } {
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
    const chapterEpigraph = getEpochEpigraph(ch.epochIndex);
    // Spread 0 is Title + TOC, so storyPages[0] sits on Spread 1 (left), flat pageIndex 2
    const startStoryPageIdx = storyPages.length;
    const spreadIndex = 1 + Math.floor(startStoryPageIdx / 2);
    const pageIndex = 2 + startStoryPageIdx;

    chapters.push({
      chapterNumber,
      roman,
      title: chapterTitle,
      epochName: ch.epochName,
      startYear: ch.entries[0]?.year ?? 1,
      spreadIndex,
      pageIndex,
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
        chapterEpigraph,
        isChapterStart: j === 0,
        entries: ch.entries.slice(j, j + 2),
      });
    }
  });

  const population = state.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko').length;
  const kingdomCount = Object.keys(state.settlementNames ?? {}).length;
  const wonderCount = (state.worldWonders ?? []).filter((w) => (w.hp ?? 1) > 0).length;
  const epicWorldName = resolveEpicRealmName(worldName, state);

  const titlePage: LoreBookPage = {
    kind: 'title',
    worldName: epicWorldName,
    year: Math.max(1, Math.floor(state.year || 1)),
    epochName: getEpochName(state.epochIndex ?? 0),
    epigraph: 'Being a living chronicle of realms risen, wonders raised, and the unseen hand above the clouds.',
    colophon: buildPoeticColophon(kingdomCount, population, wonderCount),
    population,
    kingdomCount,
    wonderCount,
    miraclesCast: state.totalMiraclesCast ?? 0,
  };

  const tocPage: LoreBookPage = {
    kind: 'toc',
    chapters,
    totalEntries: entries.length,
  };

  // Flat pages for mobile single-page reading (no unnecessary trailing blank page)
  const pages: LoreBookPage[] = [titlePage, tocPage, ...storyPages];

  // Desktop 2-page spreads require an even number of story pages
  const spreadStoryPages = [...storyPages];
  if (spreadStoryPages.length % 2 === 1) {
    spreadStoryPages.push({
      kind: 'blank',
      pageNumber: pageNum++,
      epilogueQuote: 'The ink is still wet upon the vellum. What comes next awaits the turning of the seasons...',
    });
  }

  const spreads: LoreBookSpread[] = [
    {
      spreadIndex: 0,
      left: titlePage,
      right: tocPage,
    },
  ];

  for (let i = 0; i < spreadStoryPages.length; i += 2) {
    spreads.push({
      spreadIndex: 1 + i / 2,
      left: spreadStoryPages[i],
      right: spreadStoryPages[i + 1],
    });
  }

  return { spreads, pages, chapters };
}
