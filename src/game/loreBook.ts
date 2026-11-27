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
    lower.includes('rebel') ||
    lower.includes('uprising') ||
    lower.includes('revolt') ||
    lower.includes('seced') ||
    lower.includes('broke away') ||
    lower.includes('civil war') ||
    lower.includes('independence')
  ) {
    return { category: 'rebellion', emblem: 'rebellion' };
  }
  if (
    lower.includes('culture') ||
    lower.includes('festival') ||
    lower.includes('tradition') ||
    lower.includes('rite') ||
    lower.includes('folklore') ||
    lower.includes('myth') ||
    lower.includes('song') ||
    lower.includes('guild') ||
    lower.includes('scholar') ||
    lower.includes('temple') ||
    lower.includes('golden age')
  ) {
    return { category: 'culture', emblem: 'culture' };
  }
  if (
    lower.includes('war') ||
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

function stripBracketsAndStats(rawText: string): string {
  return rawText
    .replace(/<([^<>]+)>/g, '$1')
    .replace(/[<>]/g, '')
    .replace(/\s*\([^)]*(?:seed|\+|\d+\s*,\s*\d+|%|damage|speed|knowledge|ore|alloy|hp)[^)]*\)/gi, '')
    .replace(/\s*at \(\d+\s*,\s*\d+\)/gi, '')
    .replace(/\+\d+\s*[a-zA-Z%]+/g, '')
    .replace(/\b\d+x\s+kingdom output\b/gi, 'abundant harvests and bustling forges')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[.!]+$/, '');
}

function poeticizeChronicleFact(rawText: string): string {
  let s = stripBracketsAndStats(rawText);
  s = s
    .replace(/\bGod Titan Death Beam\b/gi, 'the Brass Colossus’s pillar of blinding sun-fire')
    .replace(/\bDeath Beam\b/gi, 'pillar of blinding sun-fire')
    .replace(/\bGod Titan\b/gi, 'the Brass Colossus')
    .replace(/\bZombie Virus\b/gi, 'the pale green blight')
    .replace(/\bnuclear mushroom cloud\b/gi, 'towering crown of ash and blinding fire')
    .replace(/\bnuclear\b/gi, 'sun-forged')
    .replace(/\bnuke\b/gi, 'falling star of fire')
    .replace(/\bunits\b/gi, 'folk')
    .replace(/\bHP\b/g, 'vigor')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!s) return 'the fates moved unseen across the land';
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function formatPoeticYear(year: number, seed: number): string {
  if (year <= 1) {
    return pick(
      [
        'In the first turning of the sun',
        'Before the first winter laid its frost upon the hills',
        'At the dawn of the First Year',
      ],
      seed,
    );
  }
  const seasons = ['spring thaw', 'high summer', 'late autumn', 'deep winter'];
  const s = pick(seasons, seed + year);
  const forms = [
    `In the ${s} of Year ${year}`,
    `When Year ${year} drew toward ${s}`,
    `Beneath the turning skies of Year ${year}`,
    `As ${s} settled over the valleys in Year ${year}`,
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
  const clean = stripBracketsAndStats(ev.text);
  const lower = clean.toLowerCase();
  const when = formatPoeticYear(year, seed);

  // --- Specific legendary event patterns (pure myth, zero raw game-log phrasing) ---

  // 1. Monarch crowned
  const crownMatch = /^(.+?)\s+has been crowned monarch of\s+(.+)$/i.exec(clean);
  if (crownMatch) {
    const [, monarch, realm] = crownMatch;
    return {
      title: pick(['The Crown of ' + realm, 'Anointed by Hearthfire', 'A Sovereign Rises'], seed),
      body: `${when}, ${monarch} took the crown of ${realm} before hearth and banner. Horns echoed from the watchtowers, and the scattered folk swore fealty beneath a single crest.`,
    };
  }

  // 2. Fallen hero / monarch
  const fallenMatch = /^(.+?)\s+has fallen\b/i.exec(clean);
  if (fallenMatch) {
    const [, hero] = fallenMatch;
    return {
      title: pick(['Lament for ' + hero, 'The Quiet Bier', 'When a Great Light Passed'], seed),
      body: `${when}, ${hero} passed beyond the western mist, and silence fell over hall and market square. Bards sang through the night of deeds carved deeper than stone, awaiting the heir who would bear the mantle next.`,
    };
  }

  // 3. Dragon / Leviathan / Phoenix legends
  const dragonSlain = /^Dragon\s+(.+?)\s+has been vanquished/i.exec(clean);
  if (dragonSlain) {
    const [, name] = dragonSlain;
    return {
      title: pick(['The Fall of ' + name, 'Wyrm-Bane', 'Ashes of the Great Wing'], seed),
      body: `${when}, mortal courage at last broke the dread wyrm ${name}. Its final roar shook the valleys like distant thunder, and from that dusk onward, the high passes belonged once more to the living.`,
    };
  }

  const dragonStrafe = /^Dragon\s+(.+?)\s+strafes\s+(.+?)\s+with/i.exec(clean);
  if (dragonStrafe) {
    const [, name, realm] = dragonStrafe;
    return {
      title: pick(['Shadow of ' + name, 'Fire Over ' + realm, 'The Burning Sky'], seed),
      body: `${when}, the winged terror ${name} descended upon ${realm} in a tempest of cinders. Roofs flared like dry straw beneath its shadow, and bells tolled frantically across the smoke-choked hills.`,
    };
  }

  const leviathanSlain = /^The Leviathan\s*\((.+?)\)\s*has been defeated/i.exec(clean);
  if (leviathanSlain) {
    const [, name] = leviathanSlain;
    return {
      title: pick(['Bane of the Deep', 'The Quieting of ' + name, 'Masters of the Tide'], seed),
      body: `${when}, harpoons and iron songs brought down ${name}, ancient sovereign of the abyss. The churning swells grew still, and sailors hung lanterns along the prows to give thanks to the sea.`,
    };
  }

  const phoenixMatch = /^(?:Phoenix\s+)?(.+?)\s+(?:erupted from the ashes|burst into flames and rose again)/i.exec(clean);
  if (phoenixMatch) {
    const [, name] = phoenixMatch;
    return {
      title: pick(['Rebirth of ' + name, 'The Undying Ember', 'Wings of Dawn'], seed),
      body: `${when}, where only cold cinders lay, ${name} rose anew in a crown of living gold. Those who beheld the bright ascent swore that not even death holds sway over the fires of heaven.`,
    };
  }

  // 4. Ancient Relic / Tomb
  const relicMatch = /^(.+?)\s+of\s+(.+?)\s+uncovered an Ancient Relic/i.exec(clean);
  if (relicMatch) {
    const [, explorer, realm] = relicMatch;
    return {
      title: pick(['The Forgotten Relic', 'Treasure of the Elder Age', 'Gift of the Ruins'], seed),
      body: `${when}, ${explorer} of ${realm} unsealed a weathered vault beneath the moss and bore home a relic of the elder world. Wise elders marveled at its gleaming craft, and fresh lore kindled in every hall.`,
    };
  }

  const tombMatch = /^(.+?)\s+disturbed an Ancient Tomb near\s+(.+)$/i.exec(clean);
  if (tombMatch) {
    const [, explorer, realm] = tombMatch;
    return {
      title: pick(['The Waking Barrow', 'Bones Beneath ' + realm, 'The Broken Seal'], seed),
      body: `${when}, ${explorer} broke the quiet seal of an ancient barrow near ${realm}. Cold wind poured from the stone steps, and pale bone-clad wardens marched out beneath the stars.`,
    };
  }

  // 5. Kingdom founded
  const foundedMatch = /^(?:The Kingdom of\s+)?(.+?)\s+was founded/i.exec(clean);
  if (foundedMatch) {
    const [, realm] = foundedMatch;
    return {
      title: pick(['The Founding of ' + realm, 'First Smoke Upon the Hill', 'Hearth and Banner'], seed),
      body: `${when}, wanderers drove their stakes into untamed earth and named the valley ${realm}. Timber rose against the wind, hearth-fires answered the twilight, and a new realm entered the memory of the world.`,
    };
  }

  // 6. World Wonder built or fallen
  const wonderFoundation = /^(.+?)\s+laid the foundation for a World Wonder:\s*(.+)$/i.exec(clean);
  if (wonderFoundation) {
    const [, realm, wonder] = wonderFoundation;
    return {
      title: pick(['The ' + wonder, 'Stone Against Time', 'The High Work of ' + realm], seed),
      body: `${when}, the masons of ${realm} set the cornerstone of the ${wonder}. Song and chisel rang through the valley, for they meant their handiwork to outlast the very kings who commissioned it.`,
    };
  }

  const wonderFall = /^The\s+(.+?)\s+(?:collapsed|was shattered|fell into ruin)/i.exec(clean);
  if (wonderFall) {
    const [, wonder] = wonderFall;
    return {
      title: pick(['Ruin of the ' + wonder, 'Fallen Marble', 'What Time Unmade'], seed),
      body: `${when}, the proud ${wonder} gave way with a grief-stricken roar, scattering carved stone across the dust. Travelers still linger among its broken pillars, whispering of the hands that once raised it.`,
    };
  }

  // 7. Specific Divine Powers & Cataclysms (pure mythic narration)
  if (category === 'titan') {
    const titles = ['The Walking Sun', 'The Brass Colossus', 'Where Thunder Walked', 'Iron From Heaven'];
    const bodies = [
      `${when}, the firmament parted to a weight no mountain could endure, and the Brass Colossus strode down through blinding cloud. Where its shadow fell, rivers steamed and men forgot the cadence of their own prayers.`,
      `${when}, a pillar of searing sun-fire split the heavens at the Colossus’s command, crowning the horizon in ash and light. Long after the glare died, the ridge still hummed like a struck bell.`,
    ];
    return { title: pick(titles, seed), body: pick(bodies, seed) };
  }

  if (category === 'zombie') {
    const titles = ['The Green Vessel', 'What Rose From the Glass', 'The Pale Hunger', 'Blight of the Living'];
    const bodies = [
      `${when}, a vessel of sickly green glass fell out of the dusk and shattered upon the earth. Before the moon climbed high, a pale hunger crept through meadow and street, turning the living into hollow wanderers who remembered neither kin nor fire.`,
      `${when}, an emerald mist uncoiled from broken shards and drank the warmth from beast and mortal alike. Watchfires burned sleepless along the ridges, yet the shambling silhouettes did not turn from the flame.`,
    ];
    return { title: pick(titles, seed), body: pick(bodies, seed) };
  }

  if (lower.includes('meteor') || lower.includes('asteroid')) {
    return {
      title: pick(['The Falling Star', 'Hammer of the Sky', 'Fire From the Void'], seed),
      body: `${when}, a burning star tore a bright wound across the heavens and struck the earth with the roar of a breaking mountain. Timber and stone vanished in cinders, leaving a smoking basin that shepherds still cross themselves to pass.`,
    };
  }

  if (lower.includes('volcano')) {
    return {
      title: pick(['The Mountain Woke', 'Rivers of Living Fire', 'Wrath Beneath the Stone'], seed),
      body: `${when}, the deep earth groaned and split open into a crest of molten flame. Glowing rivers spilled down the blackened slopes while ash drifted like grey snow over silent roofs.`,
    };
  }

  if (lower.includes('tsunami')) {
    return {
      title: pick(['The Rising Wall of Sea', 'When the Ocean Walked Inland', 'The Salt Reckoning'], seed),
      body: `${when}, the tide drew back until the seabed lay bare, then returned as a towering wall of dark water. Harbors and coastal meadows vanished beneath white foam before the sea reclaimed its ancient hush.`,
    };
  }

  if (lower.includes('tornado') || lower.includes('cyclone')) {
    return {
      title: pick(['The Spinning Spire', 'Fury of the Gale', 'The Sky’s Finger'], seed),
      body: `${when}, the clouds twisted into a howling spire that danced across field and roof alike. Trees bowed and snapped like reeds until the tempest spent its breath beyond the distant hills.`,
    };
  }

  if (lower.includes('earthquake')) {
    return {
      title: pick(['When the Earth Shook', 'The Broken Ground', 'Tremor of the Deep'], seed),
      body: `${when}, the solid ground rolled like an angry sea beneath mortal feet. Walls cracked and boulders tumbled from the crags, reminding every realm how lightly it rests upon the slumbering stone.`,
    };
  }

  if (lower.includes('alien') || lower.includes('mothership')) {
    return {
      title: pick(['Visitors Beyond the Stars', 'Silver Shadows Overhead', 'The Sky-Armada'], seed),
      body: `${when}, strange silver vessels drifted out of the high dark, casting cold blue beams across bewildered towns. Neither priest nor scholar had a name for the star-born host that descended upon the fields.`,
    };
  }

  if (lower.includes('black hole')) {
    return {
      title: pick(['The Hungry Dark', 'The Eye of the Abyss', 'Where Light Bent'], seed),
      body: `${when}, a ring of violet fire opened around a sphere of utter night, drawing stone, dust, and starlight alike toward its silent center before vanishing in a shuddering burst of force.`,
    };
  }

  if (lower.includes('skeleton portal')) {
    return {
      title: pick(['The Violet Gate', 'March of the Unburied', 'Rift of Bone'], seed),
      body: `${when}, a rent of violet light tore open above the grass, and hollow warriors of bone stepped forth into the sun. Bells sounded the alarm across the hills as blades were drawn against the ancient dead.`,
    };
  }

  if (lower.includes('dark ooze')) {
    return {
      title: pick(['The Creeping Shadow', 'Tide of Pitch', 'What Crawled From the Mire'], seed),
      body: `${when}, a glistening blackness welled up across the soil, swallowing flower and furrow beneath a cold hush. Pale wisps rose where the mire lingered, flickering like drowned lanterns in the dusk.`,
    };
  }

  if (lower.includes('golden age')) {
    return {
      title: pick(['The Golden Season', 'When Granaries Overflowed', 'Sunlit Prosperity'], seed),
      body: `${when}, a rare and radiant grace settled over town and harbor alike. Forges rang with cheerful song, granaries swelled to the rafters, and the realms grew strong beneath an unclouded sky.`,
    };
  }

  if (lower.includes('divine insight') || lower.includes('eureka')) {
    return {
      title: pick(['The Spark of Wisdom', 'A Sudden Clarity', 'Light Upon the Scroll'], seed),
      body: `${when}, inspiration fell like morning dew upon thinkers and craftsmen across the land. Secrets that had eluded generations yielded at once, and workshops hummed with newfound mastery.`,
    };
  }

  if (lower.includes('divine blessing') || lower.includes('aurora')) {
    return {
      title: pick(['The Unseen Grace', 'Light Through the Cloud', 'A Quiet Miracle'], seed),
      body: `${when}, warm radiance drifted down from the heavens, mending weary limbs and coaxing fresh green shoots from scarred earth. Elders bowed their heads in the fields, knowing the sky was neither empty nor asleep.`,
    };
  }

  if (lower.includes('monsoon') || lower.includes('rain')) {
    return {
      title: pick(['Mercy of the Clouds', 'The Silver Downpour', 'When the Fires Slept'], seed),
      body: `${when}, heavy silver clouds gathered and loosed a generous rain upon parched hills and smoldering timber. Smoke yielded to the scent of wet moss as streams ran bright once more.`,
    };
  }

  if (lower.includes('peace treaty')) {
    return {
      title: pick(['Salt and Bread', 'Swords Laid Down', 'The Long Truce'], seed),
      body: `${when}, weary hands met across the council table and sealed a lasting peace. Gates stood unbarred at twilight, and smithies turned from spearheads back to hinges, bells, and plows.`,
    };
  }

  if (lower.includes('rage cast') || lower.includes('bloodlust')) {
    return {
      title: pick(['The Crimson Fever', 'Fury in the Blood', 'Drums of Wrath'], seed),
      body: `${when}, a fierce scarlet wind swept through the ranks, setting eyes aflame with reckless valor. Even the wounded rose with a roar, charging into the fray as though iron itself could not stay them.`,
    };
  }

  if (lower.includes('curse weakened')) {
    return {
      title: pick(['The Heavy Hex', 'Shadow on the Threshold', 'Bane of the Weakened'], seed),
      body: `${when}, a violet gloom settled upon roof and shield, sapping strength from arm and stone alike. Folk spoke in hushed voices behind shuttered windows until the bleak omen lifted.`,
    };
  }

  if (lower.includes('plague')) {
    return {
      title: pick(['The Bitter Mist', 'Fever on the Wind', 'The Pale Season'], seed),
      body: `${when}, a sour mist drifted low through orchard and lane, spoiling the grain and laying strong folk low. Herbs burned in every doorway while healers kept vigil through the long nights.`,
    };
  }

  // --- General mythic fallback by category (always stripped of <> and raw stats) ---
  const fact = poeticizeChronicleFact(clean);

  switch (category) {
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
    case 'rebellion': {
      const titles = ['The Broken Crown', 'Oath of the Defiant', 'Fire in the Provinces', 'The Great Uprising'];
      const closings = [
        'Old banners were torn from the gatehouse and stitched anew by candlelight before the cock crowed.',
        'Songs of that defiance traveled faster than royal riders, carried from hearth to hearth in low voices.',
        'Even those who feared the bloodshed remembered the day a province refused to kneel.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, long-buried grievances spilled into open street and hill—${fact}. ${pick(closings, seed + 2)}`,
      };
    }
    case 'culture': {
      const titles = ['Songs of the Hearth', 'The Old Custom', 'Rites of the Folk', 'Lanterns and Lore'];
      const closings = [
        'Children learned the verses before they could read, keeping the memory of their elders alive.',
        'So the custom took root, outlasting kings and borders alike.',
      ];
      return {
        title: pick(titles, seed),
        body: `${when}, a lasting custom took hold among the people—${fact}. ${pick(closings, seed + 2)}`,
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

function weaveLivingWorldMythsAndCultures(state: SimulationState, book: LoreBookState): void {
  const existingIds = new Set(book.entries.map((e) => e.id));
  const year = Math.max(1, Math.floor(state.year || 1));
  const epochIndex = state.epochIndex ?? 0;
  const epochName = getEpochName(epochIndex);
  const seedBase = hashSeed(String(state.seed || 'GODMULATOR'));

  // 1. Living Race Cultures, Folklore & Rites (one mythic cultural chronicle per active race per Age)
  const speciesGroups = new Map<string, { count: number; sampleX: number; sampleZ: number; settlementId?: string }>();
  for (const u of state.units) {
    if (u.faction !== 'civilization' || u.state === 'ko') continue;
    const prev = speciesGroups.get(u.species);
    if (!prev) {
      speciesGroups.set(u.species, { count: 1, sampleX: u.x, sampleZ: u.z, settlementId: u.settlementId });
    } else {
      prev.count += 1;
      if (!prev.settlementId && u.settlementId) prev.settlementId = u.settlementId;
    }
  }

  const cultureTemplates: Record<
    string,
    { titles: string[]; bodies: (realm: string, count: number, epoch: string) => string[] }
  > = {
    human: {
      titles: ['The Lantern Charter', 'Guilds of the Hearth', 'Songs of the Sea-Road'],
      bodies: (realm, count, epoch) => [
        `In ${realm}, the human folk (${count} strong) hung paper lanterns along the eaves each autumn—a quiet custom of the ${epoch} meant to guide lost travelers and remember the founders who first cleared the timber.`,
        `Across the market squares of ${realm}, human artisans swore the Guild-Oath of salt and iron, singing work-ballads that turned stone-laying and harvest into shared ritual.`,
      ],
    },
    elf: {
      titles: ['The Silver-Bough Vigil', 'Ballads of the High Canopy', 'Starlight Oaths'],
      bodies: (realm, count, epoch) => [
        `Beneath the boughs of ${realm}, ${count} elven singers kept the Silver-Bough Vigil, weaving memories of the ${epoch} into long harmonies sung only when the wind stilled at dusk.`,
        `The elves of ${realm} raised no boastful statues; instead they planted memory-groves whose leaves were said to whisper the names of every bygone season.`,
      ],
    },
    dwarf: {
      titles: ['Hymns of the Deep Anvil', 'The Stone-Oath', 'Runes of the Mountain Hall'],
      bodies: (realm, count, epoch) => [
        `In the echoing halls of ${realm}, ${count} dwarven smiths struck their hammers in three-beat measure—the Anvil Hymn of the ${epoch}, sworn so every arch and blade carried the honor of its maker.`,
        `Dwarven chroniclers of ${realm} chiselled their lineage straight into bedrock, holding that ink fades while granite remembers.`,
      ],
    },
    orc: {
      titles: ['The Bone-Drum Rite', 'Feast of Ash and Iron', 'The Blood-Oath'],
      bodies: (realm, count, epoch) => [
        `Around the great bonfires of ${realm}, ${count} orcs beat rawhide drums until the hills answered back—a fierce rite of the ${epoch} where young warriors proved their nerve and named their scars.`,
        `Among the clans of ${realm}, no vow or grudge was spoken lightly; every oath was sealed over ember-heated steel and remembered by the whole warband.`,
      ],
    },
    lizardfolk: {
      titles: ['Rites of the Sun-Stone', 'The Tidal Chant', 'Prophecies of the Reed Temple'],
      bodies: (realm, count, epoch) => [
        `Upon warm flat stones beside ${realm}, ${count} lizardfolk gathered at noon for the Sun-Stone Rite of the ${epoch}, reading omens in the drift of river reeds and the turn of the tide.`,
        `The elders of ${realm} kept time not by bells but by the migration of marsh-birds, humming low chants that echoed across the water at dawn.`,
      ],
    },
  };

  for (const [species, info] of speciesGroups.entries()) {
    const entryId = `lore_culture_${species}_${epochIndex}`;
    if (existingIds.has(entryId)) continue;
    const tpl = cultureTemplates[species];
    if (!tpl) continue;
    const realm =
      (info.settlementId && state.settlementNames?.[info.settlementId]) ||
      Object.values(state.settlementNames ?? {}).find(Boolean) ||
      'the young frontier';
    const s = seedBase + hashSeed(species) + epochIndex * 17;
    const bodies = tpl.bodies(realm, info.count, epochName);
    book.entries.push({
      id: entryId,
      year,
      yearLabel: `Year ${year}`,
      epochIndex,
      epochName,
      category: 'culture',
      title: pick(tpl.titles, s),
      body: pick(bodies, s + 1),
      emblem: 'culture',
      x: Math.round(info.sampleX),
      z: Math.round(info.sampleZ),
      timestamp: Date.now() - 2_000,
    });
    existingIds.add(entryId);
  }

  // 2. Greatest Rebellions & Uprisings
  const rebels = state.units.filter((u) => u.isRebel && u.state !== 'ko');
  if (rebels.length > 0) {
    const rebId = `lore_rebellion_yr_${Math.floor(year / 5)}`;
    if (!existingIds.has(rebId)) {
      const lead = rebels[0];
      const spName = lead.species.charAt(0).toUpperCase() + lead.species.slice(1);
      book.entries.push({
        id: rebId,
        year,
        yearLabel: `Year ${year}`,
        epochIndex,
        epochName,
        category: 'rebellion',
        title: `The ${spName} Uprising`,
        body: `In Year ${year}, ${rebels.length} defiant ${spName.toLowerCase()} rebels led by ${lead.name} cast off their old allegiance, marching beneath torn cloth to claim a destiny of their own. Songs of that defiance traveled faster than royal riders.`,
        emblem: 'rebellion',
        x: Math.round(lead.x),
        z: Math.round(lead.z),
        timestamp: Date.now() - 1_500,
      });
      existingIds.add(rebId);
    }
  }

  // 3. Living Monarchs & Legendary Champions
  const kings = state.units.filter((u) => u.isKing && u.state !== 'ko').slice(0, 2);
  for (const king of kings) {
    const kId = `lore_king_${king.id}`;
    if (existingIds.has(kId)) continue;
    const realm = (king.settlementId && state.settlementNames?.[king.settlementId]) || 'the realm';
    const spName = king.species.charAt(0).toUpperCase() + king.species.slice(1);
    const deedClause =
      (king.kills ?? 0) >= 2 ? `, remembered for ${king.kills} victories on the field` : '';
    book.entries.push({
      id: kId,
      year,
      yearLabel: `Year ${year}`,
      epochIndex,
      epochName,
      category: 'legend',
      title: `Reign of ${king.name}`,
      body: `The crown of ${realm} rested upon ${king.name}, sovereign of the ${spName.toLowerCase()} people${deedClause}. Bards sang of their court long after the candles burned low.`,
      emblem: 'kingdom',
      x: Math.round(king.x),
      z: Math.round(king.z),
      timestamp: Date.now() - 1_000,
    });
    existingIds.add(kId);
  }
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
  weaveLivingWorldMythsAndCultures(state, state.loreBook);
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
