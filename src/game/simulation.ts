import {
  BUILDINGS,
  EPOCHS,
  FLYING_WILDLIFE_ROLES,
  GOD_POWERS,
  MYTHICAL_ROLE_SET,
  TERRAIN_TOOLS,
  UNITS,
  getDinosaurVariant,
  getDragonVariant,
  getMaxCityPopulation,
  getUnitMaxLifespan,
} from './catalog';
export { getMaxCityPopulation, getUnitMaxLifespan };
import {
  getPowerClusterCount,
  getPowerClusterTargets,
  getPowerEffectiveRadius,
  isInsidePixelCircle,
} from './brushSizes';
import {
  ActiveHazardZone,
  BuildingEntity,
  BuildingType,
  ChronicleEvent,
  CropType,
  DiplomaticRelation,
  EarthquakeFaultSegment,
  EarthquakeShapeKind,
  GodPowerType,
  RandomEventKind,
  Resources,
  SimulationState,
  SpeciesId,
  StrategicStrikeKind,
  StrategicWarStrike,
  TerrainToolType,
  TerrainType,
  TileData,
  UnitAgeStage,
  UnitEntity,
  UnitRole,
  VehicleEntity,
  VehicleType,
  VisualEffectEvent,
  VoidWispEntity,
  WarFrontBaseline,
  WorldEventState,
  WorldGenConfig,
  WorldRulesConfig,
  WorldStats,
  WorldTemplateId,
} from './types';
import { generateUnitGenes, generateUnitItems } from './entityInspector';
import {
  computeUnitEffectiveStats,
  generateUnitTraits,
  syncUnitDerivedStats,
} from './unitCustomization';
import { generateWorldTiles, normalizeSeed } from './worldGen';
import {
  SimulationTickIndex,
  buildSimulationTickIndex,
  decayUnitStatusEffects,
  forEachUnitInRadius,
  hasGatheringHelperNear,
} from './spatialIndex';
import {
  WorldGridBuffers,
  createWorldGridBuffers,
  syncTileToWorldGrid,
  syncWorldGridFromTiles,
} from './worldGrid';
import {
  CoarseChunkGraph,
  FlowFieldManager,
  TimeSlicedPathBudget,
} from './pathfinding';

const BUILDING_BY_TYPE = new Map(BUILDINGS.map((d) => [d.type, d]));
const UNIT_BY_ROLE = new Map(UNITS.map((d) => [d.role, d]));

export function createEmptyWorldStats(): WorldStats {
  return {
    totalDeaths: 0,
    civilianDeaths: 0,
    totalBirths: 0,
    citiesCreated: 0,
    citiesDestroyed: 0,
    wildlifeSpawned: 0,
    wildlifeDeaths: 0,
    mythicalSpawned: 0,
    mythicalDeaths: 0,
    hostilesSpawned: 0,
    hostilesKilled: 0,
    buildingsDestroyed: 0,
    warsStarted: 0,
    rebellionsTriggered: 0,
  };
}

export function ensureWorldStats(state: SimulationState): WorldStats {
  if (!state.worldStats) {
    state.worldStats = createEmptyWorldStats();
  }
  return state.worldStats;
}

let activeTickIndex: SimulationTickIndex | null = null;
let pooledTickIndex: SimulationTickIndex | undefined;
const simFlowFields = new FlowFieldManager(24);
const simCoarseGraph = new CoarseChunkGraph();
const simPathBudget = new TimeSlicedPathBudget(20);

const FIRE_SPREAD_OFFSETS: readonly [number, number, number][] = [
  [1, 0, 1.0],
  [-1, 0, 1.0],
  [0, 1, 1.0],
  [0, -1, 1.0],
  [1, 1, 0.35],
  [-1, 1, 0.35],
  [1, -1, 0.35],
  [-1, -1, 0.35],
];

/**
 * Ensures the flat TypedArray `WorldGridBuffers` acceleration structure exists on `state`.
 * Lazily created & synced so both newly generated and loaded IndexedDB worlds work identically.
 */
export function ensureWorldGrid(state: SimulationState): WorldGridBuffers {
  const existing = state.worldGrid as WorldGridBuffers | undefined;
  if (existing && existing.gridSize === state.gridSize) {
    return existing;
  }
  const grid = createWorldGridBuffers(state.gridSize);
  syncWorldGridFromTiles(grid, state.tiles, true);
  state.worldGrid = grid;
  return grid;
}

const HUMAN_FIRST_NAMES = [
  'Kaelen', 'Lyra', 'Theron', 'Vesper', 'Oakhart', 'Soren', 'Mira', 'Darian',
  'Elowen', 'Bram', 'Talia', 'Cassian', 'Nyx', 'Orin', 'Sylvi', 'Alden',
  'Rowan', 'Freya', 'Gideon', 'Isolde', 'Zarek', 'Ariadne', 'Cyrus', 'Veda',
  'Caleb', 'Maeve', 'Lucian', 'Clara', 'Garrick', 'Helena', 'Tobias', 'Astrid',
  'Julian', 'Elena', 'Marcus', 'Nora', 'Cedric', 'Vera', 'Alaric', 'linnea',
  'Corvus', 'Sabine', 'Declan', 'Iris', 'Evander', 'Serena', 'stellan', 'Wren',
].map((n) => n[0].toUpperCase() + n.slice(1));

const HUMAN_LAST_NAMES = [
  'Mercer', 'Ashford', 'Vance', 'Hawthorne', 'Greystone', 'Thorne', 'Hale', 'Locke',
  'Crest', 'Shaw', 'Brooks', 'Frost', 'Ward', 'Vane', 'Sterling', 'Flint',
  'Briar', 'Marsh', 'Holt', 'Drake', 'Cross', 'Reed', 'Blackwood', 'Barrow',
  'Sutton', 'Kestrel', 'Fletcher', 'Rowland', 'Tanner', 'Gale', 'Finch', 'Lark',
  'Pyke', 'Rook', 'Vale', 'Stone', 'Hart', 'Veyra', 'Calder', 'Weston',
];

const ELF_FIRST_NAMES = [
  'Aelar', 'Sylva', 'Luthien', 'Faelar', 'Elowen', 'Caelum', 'Thalia', 'Vaelis',
  'Sariel', 'Nym', 'Orophin', 'Vyril', 'Alari', 'Celeborn', 'Isilme', 'Tauriel',
  'Galad', 'Elaria', 'Thrand', 'Myriel', 'Lorien', 'Seraphis', 'Faelwen', 'Aranel',
  'Calen', 'Nimue', 'Valen', 'Yavanna', 'Ilien', 'Sylvar', 'Lirael', 'Haldir',
  'Aerin', 'Elenwe', 'Thalorin', 'Vaelora',
];

const ELF_SURNAMES = [
  'Moonwhisper', 'Starbreeze', 'Dawnleaf', 'Silverstream', 'Dewglade', 'Sunpetal',
  'Windwalker', 'Mistwood', 'Aetheriel', 'Oakbow', 'Frostbloom', 'Galewing',
  'Fernhollow', 'Nightbough', 'Lumenvale', 'Briarthorne', 'Stargazer', 'Mossbreeze',
  'Crystalkeep', 'Amberleaf', 'Skyweaver', 'Gladeborn', 'Silvershade', 'Springwillow',
  'Thornbrook', 'Brightriver', 'Cloudspire', 'petalwind', 'Evergrove', 'Moonlit',
].map((n) => n[0].toUpperCase() + n.slice(1));

const ORC_FIRST_NAMES = [
  'Grom', 'Thrak', 'Karg', 'Morg', 'Zug', 'Urzul', 'Bruk', 'Grish',
  'Drog', 'Skarn', 'Vorg', 'Ruk', 'Khor', 'Garok', 'Drak', 'Snag',
  'Gorim', 'Balg', 'Azog', 'Krag', 'Torg', 'Vrak', 'Ghaz', 'Nazg',
  'Kulg', 'Zorak', 'Muzgash', 'Shagrat', 'Ugluk', 'Bolg', 'Dush', 'Rogash',
  'Khar', 'Vorgath', 'Throkk', 'Ghorza',
];

const ORC_CLAN_NAMES = [
  'Ironjaw', 'Bloodfang', 'Skullsplitter', 'Ashhide', 'Bonecrusher', 'Blacktusks',
  'Doomhammer', 'Stonefist', 'Grimscar', 'Wargtooth', 'Redaxe', 'Cragborn',
  'Cindermaw', 'Flintclaw', 'Dreadhorn', 'Shattershield', 'Gloomfang', 'Wolfbane',
  'Obsidianhand', 'Thunderhide', 'Fleshrender', 'Spirebreaker', 'Smogblood', 'Khorborn',
  'Ashenpike', 'Stormtusk', 'Rustblade', 'Gorger', 'Hammerfall', 'Ravenspine',
];

function seededOrRandomInt(max: number, rng?: () => number): number {
  const r = rng ? rng() : Math.random();
  return Math.max(0, Math.min(max - 1, Math.floor(r * max)));
}

function hashSeedString(str: string, baseSeed = 0): number {
  let h = (baseSeed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function createUniqueCityName(
  species: SpeciesId = 'human',
  usedNames: Set<string> = new Set(),
  deterministicSeed?: number,
): string {
  let rngState = deterministicSeed !== undefined ? ((deterministicSeed ^ 0x9e3779b9) >>> 0) || 1 : 0;
  const rng =
    deterministicSeed !== undefined
      ? () => {
          rngState = (rngState + 0x6d2b79f5) >>> 0;
          let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
      : undefined;

  const pick = <T,>(arr: readonly T[]): T => arr[seededOrRandomInt(arr.length, rng)];

  const HUMAN_PREFIXES = [
    'Aurel', 'Valen', 'Alder', 'Caster', 'Bright', 'Iron', 'Sun', 'Crest', 'Durn', 'Veyr',
    'West', 'Oak', 'Crown', 'Carrow', 'Sol', 'Kestrel', 'Bram', 'Thorne', 'Corv', 'Mar',
    'Wind', 'Gold', 'Frost', 'River', 'Dawn', 'Storm', 'Hearth', 'Amber', 'Vesper', 'Cald',
    'Rowan', 'Barrow', 'Gale', 'Ash', 'Silver', 'Stone', 'North', 'Red', 'High', 'Drak',
  ];
  const HUMAN_SUFFIXES = [
    'haven', 'hold', 'ford', 'watch', 'crest', 'bridge', 'vale', 'spire', 'mere', 'brook',
    'stead', 'helm', 'wick', 'gard', 'port', 'fell', 'ridge', 'mark', 'wall', 'wood',
    'mont', 'keep', 'wicke', 'ton', 'burgh', 'gate',
  ];
  const HUMAN_ADJ = [
    'New', 'Port', 'Fort', 'High', 'Silver', 'Golden', 'Old', 'North', 'West', 'East',
    'Crown', 'Sun', 'River', 'Stone', 'Oak', 'Bright', 'Star', 'Amber', 'Dawn', 'Iron',
  ];
  const HUMAN_NOUN = [
    'Aurelia', 'Valen', 'Haven', 'Harbor', 'Veld', 'Hold', 'Crest', 'Ford', 'Vale', 'Bridge',
    'Watch', 'Point', 'Bastion', 'Cross', 'Reach', 'Hollow', 'Landing', 'Spire', 'Market',
  ];

  const ELF_SYL_A = [
    'Ael', 'Syl', 'Luth', 'Fael', 'Cael', 'Vael', 'Thal', 'Myr', 'Ser', 'Elen', 'Oroph',
    'Nym', 'Ili', 'Gal', 'Aran', 'Cele', 'Lor', 'Isil', 'Yav', 'Taur', 'Mir', 'Vyr', 'Alor',
    'Thyr', 'Sola', 'Elar', 'Cal', 'Vela', 'Naer', 'Ril',
  ];
  const ELF_SYL_B = [
    'indor', 'oria', 'veth', 'mere', 'aris', 'driel', 'wen', 'nor', 'thas', 'loth', 'ien',
    'ael', 'ion', 'riel', 'vael', 'eth', 'wyn', 'lor', 'ia', 'anor', 'elion', 'ath',
  ];
  const ELF_ADJ = [
    'Sylvan', 'Star', 'Moon', 'Silver', 'Aether', 'Crystal', 'Dew', 'Dawn', 'Whisper',
    'Lumen', 'Emerald', 'Mist', 'Briar', 'Glimmer', 'Azure', 'Twilight', 'Willow', 'Sun',
  ];
  const ELF_NOUN = [
    'Glade', 'Leaf', 'Bough', 'Well', 'Grove', 'Spire', 'Vale', 'Canopy', 'Sanctuary',
    'Dell', 'Haven', 'Hollow', 'Bloom', 'Stream', 'Arbor', 'Enclave',
  ];

  const ORC_SYL_A = [
    'Grom', 'Khor', 'Thrak', 'Skarn', 'Morg', 'Zug', 'Urz', 'Bruk', 'Grish', 'Drog', 'Vorg',
    'Ruk', 'Karg', 'Gar', 'Drak', 'Snag', 'Gor', 'Balg', 'Azog', 'Krag', 'Tor', 'Vrak',
    'Ghaz', 'Naz', 'Kulg', 'Zorak', 'Mog', 'Khar',
  ];
  const ORC_SYL_B = [
    'gash', 'mor', 'zul', 'thar', 'karr', 'vorr', 'bash', 'gul', 'rak', 'duk', 'fang',
    'tus', 'maw', 'gar', 'dak', 'grimm', 'krag', 'mok', 'gor', 'khor', 'zgul', 'nar',
  ];
  const ORC_ADJ = [
    'Blood', 'Iron', 'Ash', 'Skull', 'Obsidian', 'Shattered', 'Grim', 'Jagged', 'Cinder',
    'Bone', 'War', 'Fury', 'Crag', 'Dread', 'Ruin', 'Rust', 'Smog', 'Black',
  ];
  const ORC_NOUN = [
    'Crag', 'Hold', 'Peak', 'Bastion', 'Fort', 'Ridge', 'Pit', 'Anvil', 'Keep', 'Forge',
    'Gate', 'Maw', 'Fang', 'Citadel', 'Trench', 'Gorge',
  ];
  const DWARF_SYL_A = ['Khaz', 'Karak', 'Kazad', 'Thun', 'Grim', 'Durn', 'Brim', 'Krag', 'Vorn', 'Nid'];
  const DWARF_SYL_B = ['-Modan', '-Vorn', 'hearth', 'forge', 'deep', 'anvil', 'hall', 'delve', 'helm', 'bastion'];
  const DWARF_ADJ = ['Iron', 'Bronze', 'Runic', 'Granite', 'Anvil', 'Molten', 'Deep', 'Thunder', 'Copper', 'Hearth'];
  const DWARF_NOUN = ['Hold', 'Forge', 'Vault', 'Bastion', 'Hall', 'Delve', 'Citadel', 'Crag', 'Foundry', 'Gate'];

  const LIZARD_SYL_A = ['Itza', 'Xoch', 'Tlal', 'Quetz', 'Sotek', 'Chich', 'Coatl', 'Teot', 'Zotl', 'Kroq'];
  const LIZARD_SYL_B = ['-Sol', 'itl', 'ocan', '-Kyr', '-Vael', '-Ra', 'tlan', 'ac', 'tepec', 'ara'];
  const LIZARD_ADJ = ['Solar', 'Jade', 'Obsidian', 'Gilded', 'Sunlit', 'Emerald', 'Saurian', 'Verdant', 'Golden', 'Scaled'];
  const LIZARD_NOUN = ['Ziggurat', 'Pyramid', 'Sanctum', 'Spire', 'Temple', 'Citadel', 'Terrace', 'Altar', 'Bastion', 'Observatory'];

  for (let attempt = 0; attempt < 64; attempt++) {
    const roll = rng ? rng() : Math.random();
    let candidate = '';
    if (species === 'elf') {
      if (roll < 0.56) {
        candidate = `${pick(ELF_SYL_A)}${pick(ELF_SYL_B)}`;
      } else {
        const a = pick(ELF_ADJ);
        const n = pick(ELF_NOUN);
        candidate = `${a} ${n}`;
      }
    } else if (species === 'orc') {
      if (roll < 0.56) {
        candidate = `${pick(ORC_SYL_A)}${pick(ORC_SYL_B)}`;
      } else {
        const a = pick(ORC_ADJ);
        const n = pick(ORC_NOUN);
        candidate = `${a} ${n}`;
      }
    } else if (species === 'dwarf') {
      if (roll < 0.56) {
        candidate = `${pick(DWARF_SYL_A)}${pick(DWARF_SYL_B)}`;
      } else {
        candidate = `${pick(DWARF_ADJ)} ${pick(DWARF_NOUN)}`;
      }
    } else if (species === 'lizardfolk') {
      if (roll < 0.56) {
        candidate = `${pick(LIZARD_SYL_A)}${pick(LIZARD_SYL_B)}`;
      } else {
        candidate = `${pick(LIZARD_ADJ)} ${pick(LIZARD_NOUN)}`;
      }
    } else {
      if (roll < 0.6) {
        const pre = pick(HUMAN_PREFIXES);
        const suf = pick(HUMAN_SUFFIXES);
        if (!pre.toLowerCase().endsWith(suf.slice(0, 2).toLowerCase())) {
          candidate = `${pre}${suf}`;
        }
      }
      if (!candidate) {
        const a = pick(HUMAN_ADJ);
        const n = pick(HUMAN_NOUN);
        if (a.toLowerCase() !== n.toLowerCase()) {
          candidate = `${a} ${n}`;
        }
      }
    }
    if (candidate && !usedNames.has(candidate)) {
      return candidate;
    }
  }

  const fallbackRoot =
    species === 'elf'
      ? `${pick(ELF_SYL_A)}${pick(ELF_SYL_B)}`
      : species === 'orc'
        ? `${pick(ORC_SYL_A)}${pick(ORC_SYL_B)}`
        : species === 'dwarf'
          ? `${pick(DWARF_SYL_A)}${pick(DWARF_SYL_B)}`
          : species === 'lizardfolk'
            ? `${pick(LIZARD_SYL_A)}${pick(LIZARD_SYL_B)}`
            : `${pick(HUMAN_PREFIXES)}${pick(HUMAN_SUFFIXES)}`;
  return `${fallbackRoot} ${usedNames.size + 1}`;
}

export function createSeededNomadName(
  settlementId: string,
  worldSeed: number,
  species: SpeciesId = 'human',
): string {
  return createUniqueCityName(species, new Set(), hashSeedString(settlementId, worldSeed));
}

function createUniqueUnitName(
  state: SimulationState,
  role: UnitRole,
  species: SpeciesId,
  dinoDiet?: 'carnivore' | 'herbivore',
): string {
  const used = new Set(state.units.map((u) => u.name));
  const CREATURE_NAMES: Partial<Record<UnitRole, string[]>> = {
    cow: ['Bessie', 'Daisy', 'Clover', 'Buttercup', 'Mooana', 'Hazel', 'Maple', 'Willow', 'Poppy', 'Pebble', 'Nutmeg', 'Marigold'],
    pig: ['Porky', 'Truffle', 'Hamlet', 'Rosie', 'Pip', 'Oinkers', 'Bramble', 'Pudding', 'Acorn', 'Snuffles', 'Bacon', 'Barnaby'],
    chicken: ['Nugget', 'Sunny', 'Pippin', 'Clucky', 'Henrietta', 'Pebbles', 'Feather', 'Waffles', 'Cinnamon', 'Biscuit', 'Peep', 'Dandelion'],
    capybara: ['Gort', 'Mochi', 'Coconut', 'Boba', 'Chill', 'Yuzu', 'Pesto', 'Matcha', 'Taro', 'Mango', 'Wonton', 'Biscotti'],
    deer: ['Bambi', 'Fern', 'Rowan', 'Buckley', 'Fawn', 'Briar', 'Cedar', 'Aspen', 'Linden', 'Sylvan', 'Antler', 'Clover'],
    sheep: ['Woolly', 'Cloud', 'Cotton', 'Fluffy', 'Fleece', 'Puff', 'Mallow', 'Lanolin', 'Snowball', 'Baa', 'Dolly', 'Meadow'],
    rabbit: ['Thumper', 'Hoppy', 'Cotton', 'Nibbles', 'Cottontail', 'Clover', 'Mopsy', 'Pip', 'Binky', 'Bramble', 'Velvet', 'Juniper'],
    fox: ['Rusty', 'Vixen', 'Cinnamon', 'Sly', 'Amber', 'Copper', 'Ember', 'Flick', 'Saffron', 'Reynard', 'Kip', 'Russet'],
    boar: ['Tusker', 'Bristle', 'Truffles', 'Gnarl', 'Bramble', 'Razorback', 'Snort', 'Thorn', 'Tusk', 'Gruff', 'Bramblejaw', 'Mire'],
    lion: ['Aslan', 'Simba', 'Sovereign', 'Mane', 'Sol', 'Aurelius', 'Savanna', 'Kovu', 'Gilded', 'Pride', 'Rajah', 'Sunmane'],
    elephant: ['Babar', 'Jumbo', 'Tusk', 'Titan', 'Rumble', 'Ivory', 'Pachy', 'Ganesha', 'Boulders', 'Timber', 'Stomp', 'Kora'],
    camel: ['Dune', 'Sahara', 'Mirage', 'Oasis', 'Sirocco', 'Nomad', 'Gobi', 'Sands', 'Caravan', 'Khamsin', 'Hump', 'Amber'],
    penguin: ['Pingu', 'Waddles', 'Tux', 'Pebble', 'Chilly', 'Skipper', 'Flurry', 'Mumble', 'Pip', 'Glacier', 'Frosty', 'Sleet'],
    crocodile: ['Snapper', 'Chomps', 'Sobek', 'Bayou', 'Gator', 'Scales', 'Murk', 'Jaws', 'Lurker', 'Swampjaw', 'Riptide', 'Fang'],
    horse: ['Spirit', 'Mustang', 'Chestnut', 'Gallop', 'Thunder', 'Breeze', 'Clover', 'Copper', 'Sable', 'Blaze', 'Roan', 'Comet'],
    goat: ['Billy', 'Crag', 'Gruff', 'Pebble', 'Ramsey', 'Cliff', 'Bramble', 'Nanny', 'Summit', 'Horn', 'Scramble', 'Oat'],
    monkey: ['Bongo', 'Mango', 'Kiko', 'Zippy', 'Coco', 'Noodle', 'Tiki', 'Pip', 'Loco', 'Milo', 'Bramble', 'Kiwi'],
    panda: ['Bao', 'Mochi', 'Bamboo', 'Dumpling', 'Pao', 'Tofu', 'Ling', 'Pebble', 'Nori', 'Matcha', 'Wonton', 'Yuki'],
    polar_bear: ['Nanook', 'Glacier', 'Frost', 'Kodiak', 'Flurry', 'Iceberg', 'Sleet', 'Boreas', 'Tundra', 'Drift', 'Rime', 'Yuki'],
    hippo: ['Chonk', 'Bubbles', 'Motto', 'Barge', 'Puddle', 'Bramble', 'Tank', 'River', 'Wallow', 'Lump', 'Creek', 'Gumbo'],
    rhino: ['Tank', 'Boulder', 'Spike', 'Crusher', 'Rumble', 'Ironhorn', 'Dusty', 'Krag', 'Tundra', 'Brutus', 'Anvil', 'Horn'],
    turtle: ['Shelly', 'Pebble', 'Moss', 'Tide', 'Snap', 'Kooper', 'Lagoon', 'Drift', 'Kelp', 'Boulders', 'Scooter', 'Reef'],
    frog: ['Kermit', 'Ribbit', 'Hopper', 'Lily', 'Croak', 'Boggy', 'Puddle', 'Sprout', 'Tad', 'Pickle', 'Swamp', 'Pip'],
    crab: ['Pinchy', 'Claw', 'Snippy', 'Sandy', 'Shell', 'Coral', 'Krabs', 'Scuttle', 'Barnacle', 'Tide', 'Pebble', 'Nipper'],
    wolf: ['Fang', 'Fenrir', 'Timber', 'Shadow', 'Ash', 'Silver', 'Lupus', 'Ghost', 'Frostbite', 'Nightpaw', 'Cinder', 'Bane'],
    bear: ['Barnaby', 'Kodiak', 'Ursa', 'Grizz', 'Bramble', 'Thor', 'Boulder', 'Otis', 'Bruno', 'Baloo', 'Goliath', 'Cedar'],
    dinosaur:
      dinoDiet === 'carnivore'
        ? ['Rex', 'Chomper', 'Raptor', 'Fangjaw', 'Gorgon', 'Razor', 'Vex', 'Sauron', 'Ripper', 'Spikejaw', 'Cinderclaw', 'Apex']
        : ['Spike', 'Terra', 'Trixie', 'Bronty', 'Ankylo', 'Pebbleback', 'Cresthorn', 'Mosswalker', 'Fern', 'Titan', 'Plate', 'Bramble'],
    dragon: ['Ignis', 'Pyre', 'Zephyr', 'Vermithrax', 'Drakon', 'Scorch', 'Cinderwing', 'Embermaw', 'Obsidia', 'Aurelion', 'Balerion', 'Valyrax'],
    unicorn: ['Lumina', 'Aurelia', 'Starlight', 'Celeste', 'Seraph', 'Sylph', 'Dawnhorn', 'Moonbeam', 'Glimmer', 'Astrid', 'Iris', 'Elysia'],
    leviathan: ['Charybdis', 'Tiamat', 'Kraken', 'Jormungandr', 'Thalassor', 'Abyssal', 'Bloop', 'Maelstrom', 'Cetus', 'Nautilus', 'Tidecaller', 'Vortex'],
    phoenix: ['Fawkes', 'Solis', 'Ashwing', 'Helios', 'Sunburst', 'Cindercrest', 'Radiance', 'Aurelia', 'Ignis', 'Flare', 'Dawnfire', 'Pyra'],
    griffin: ['Aerie', 'Talon', 'Skylord', 'Gryphon', 'Windcrest', 'Stormwing', 'Valkor', 'Sunbeak', 'Highclaw', 'Aether', 'Zephyrus', 'Crest'],
    yeti: ['Boreas', 'Glacier', 'Avalanche', 'Frostfang', 'Tundra', 'Rime', 'Blizzard', 'Snowpeak', 'Kodiak', 'Permafrost', 'Ymir', 'Hail'],
    golem: ['Granite', 'Monolith', 'Basalt', 'Runestone', 'Colossus', 'Obsidian', 'Crag', 'Aegis', 'Bedrock', 'Quartz', 'Dolmen', 'Titan'],
    kitsune: ['Inari', 'Tamamo', 'Kuzunoha', 'Hoshi', 'Sakura', 'Kitsunebi', 'Miko', 'Yuki', 'Aoi', 'Kaguya', 'Ren', 'Shiro'],
    hydra: ['Lerna', 'Vipera', 'Slither', 'Venom', 'Mirefang', 'Scylla', 'Ouro', 'Blight', 'Basilisk', 'Tangle', 'Serpentis', 'Bogfang'],
    minotaur: ['Asterion', 'Taurus', 'Bramblehorn', 'Maze', 'Ironhoof', 'Brutus', 'Krag', 'Gorgor', 'Bellow', 'Cleave', 'Bull', 'Raze'],
    pegasus: ['Zephyr', 'Cloudwing', 'Skystride', 'Breeze', 'Nimbus', 'Gale', 'Starwing', 'Aether', 'Dawnwing', 'Cirrus', 'Feather', 'Sol'],
    cerberus: ['Cinder', 'Brimstone', 'Hades', 'Ember', 'Scorch', 'Fang', 'Ashhound', 'Pyre', 'Char', 'Fury', 'Vulcan', 'Coal'],
    ent: ['Oakheart', 'Barkbeard', 'Rootwalker', 'Mossback', 'Eldergrove', 'Bramble', 'Cedar', 'Thorn', 'Willow', 'Rowan', 'Timber', 'Ashwood'],
    giraffe: ['Stretch', 'Spotty', 'Acacia', 'Savanna', 'Longneck', 'Patches', 'Treetop', 'Sunny', 'Kibo', 'Zuri', 'Milo', 'Twig'],
    zebra: ['Zigzag', 'Stripes', 'Dazzle', 'Domino', 'Checkers', 'Dash', 'Bramble', 'Barcode', 'Bolt', 'Kora', 'Pebble', 'Sable'],
    tiger: ['Shere', 'Rajah', 'Stripe', 'Amber', 'Bengal', 'Saffron', 'Claw', 'Prowler', 'Tigre', 'Sundar', 'Cinder', 'Kahn'],
    gorilla: ['Kong', 'Bongo', 'Silverback', 'Rumble', 'Koko', 'Brutus', 'Tambo', 'Crag', 'Bramble', 'Mighty', 'Goliath', 'Chomp'],
    kangaroo: ['Boomer', 'Skippy', 'Hopper', 'Joey', 'Bounder', 'Outback', 'Rusty', 'Spring', 'Dusty', 'Kanga', 'Bouncer', 'Red'],
    moose: ['Bullwinkle', 'Antler', 'Timber', 'Spruce', 'Tundra', 'Rack', 'Maple', 'Kodiak', 'Cedar', 'Bramble', 'Moosey', 'Pine'],
    bison: ['Tatanka', 'Thunder', 'Shaggy', 'Plains', 'Boulder', 'Rumble', 'Stampede', 'Buffalo', 'Prairie', 'Dusty', 'Krag', 'Brutus'],
    flamingo: ['Pinky', 'Coral', 'Blush', 'Stilts', 'Lagoon', 'Rose', 'Shrimp', 'Tide', 'Salmon', 'Floss', 'Grace', 'Plume'],
    ostrich: ['Zippy', 'Feathers', 'Sprint', 'Duster', 'Plume', 'Runner', 'Speedy', 'Sandy', 'Strider', 'Beep', 'Scout', 'Dash'],
    seal: ['Flipper', 'Blubber', 'Pebble', 'Waddles', 'Splash', 'Chilly', 'Bork', 'Tide', 'Frosty', 'Mochi', 'Harbor', 'Kelp'],
    basilisk: ['Gorgon', 'Stonegaze', 'Vipera', 'Slyther', 'Medusa', 'Petrus', 'Fang', 'Scaleking', 'Blight', 'Jormun', 'Rattle', 'Onyx'],
    thunderbird: ['Tempest', 'Volt', 'Skybolt', 'Raijin', 'Stormwing', 'Zephyr', 'Arcus', 'Fulmin', 'Gale', 'Nimbus', 'Spark', 'Thorne'],
    kraken: ['Cthul', 'Tidebreaker', 'Inkmaw', 'Davy', 'Nautilus', 'Abyss', 'Scylla', 'Riptide', 'Trench', 'Gorgon', 'Bloop', 'Swell'],
    manticore: ['Stinger', 'Crimson', 'Venomtail', 'Maw', 'Scorpion', 'Raze', 'Fury', 'Brimclaw', 'Gorgor', 'Barb', 'Cinder', 'Bane'],
    gargoyle: ['Granite', 'Spire', 'Belfry', 'Obsidian', 'Goliath', 'Perch', 'Slate', 'Stonewing', 'Crag', 'Sentinel', 'Vesper', 'Basalt'],
    giant_spider: ['Arachne', 'Shelob', 'Venomfang', 'Widow', 'Silkspinner', 'Blightweaver', 'Tarantula', 'Nox', 'Webclaw', 'Mirebite', 'Chitin', 'Skitter'],
    firefly: ['Glimmer', 'Spark', 'Flicker', 'Lumen', 'Twinkle', 'Glowbug', 'Beam', 'Dusk', 'Shimmer', 'Wink', 'Flash', 'Ember'],
    glow_moth: ['Luna', 'Selene', 'Moonwing', 'Mist', 'Crescent', 'Sylph', 'Velvet', 'Luster', 'Aurora', 'Nyx', 'Gossamer', 'Opal'],
    lantern_jelly: ['Lumina', 'Aurelia', 'Drift', 'Beacon', 'Pulse', 'Prism', 'Astra', 'Halo', 'Nimbus', 'Glim', 'Lantern', 'Float'],
    fairy: ['Pip', 'Tinker', 'Blossom', 'Starlight', 'Dewdrop', 'Pixie', 'Petal', 'Sparkle', 'Breeze', 'Lilly', 'Sunbeam', 'Twinkle'],
    fae: ['Sylvan', 'Oberon', 'Titania', 'Elara', 'Thistle', 'Briar', 'Feywild', 'Grove', 'Verdant', 'Aether', 'Lyra', 'Willow'],
    will_o_wisp: ['Ignis', 'Wisp', 'Phantom', 'Mirelight', 'Lantern', 'Specter', 'Eerie', 'Glimmer', 'Shade', 'Drift', 'Aether', 'Cinder'],
  };

  const creaturePool = CREATURE_NAMES[role];
  if (creaturePool) {
    const unused = creaturePool.filter((n) => !used.has(n));
    if (unused.length > 0) {
      return unused[Math.floor(Math.random() * unused.length)];
    }
    const EPITHETS = ['Elder', 'Wild', 'Ancient', 'Gilded', 'Storm', 'Frost', 'Shadow', 'Crimson', 'Iron', 'Sunken'];
    for (let i = 0; i < 24; i++) {
      const cand = `${EPITHETS[Math.floor(Math.random() * EPITHETS.length)]} ${creaturePool[Math.floor(Math.random() * creaturePool.length)]}`;
      if (!used.has(cand)) return cand;
    }
    return `${creaturePool[Math.floor(Math.random() * creaturePool.length)]} ${state.units.length + 1}`;
  }

  const DWARF_FIRST = ['Thorin', 'Bardin', 'Dwalin', 'Helga', 'Astrid', 'Brokk', 'Runa', 'Durin', 'Thrain', 'Bram', 'Kilda', 'Orin'];
  const DWARF_LAST = ['Ironfoot', 'Stonehammer', 'Forgebeard', 'Anvilborn', 'Runesmith', 'Copperhelm', 'Deepdelver', 'Bronzeshield'];
  const LIZARD_FIRST = ['Kroq', 'Itzli', 'Xolotl', 'Quetzal', 'Zotl', 'Tlaloc', 'Sotek', 'Chaac', 'Coatl', 'Nahuatl', 'Tepetl', 'Xiuh'];
  const LIZARD_LAST = ['Sunscale', 'Jadefang', 'Goldcrest', 'Obsidian-Tail', 'Starprism', 'Templeguard', 'Suncaller', 'Verdant-Claw'];

  const firstPool =
    species === 'elf'
      ? ELF_FIRST_NAMES
      : species === 'orc'
        ? ORC_FIRST_NAMES
        : species === 'dwarf'
          ? DWARF_FIRST
          : species === 'lizardfolk'
            ? LIZARD_FIRST
            : HUMAN_FIRST_NAMES;
  const lastPool =
    species === 'elf'
      ? ELF_SURNAMES
      : species === 'orc'
        ? ORC_CLAN_NAMES
        : species === 'dwarf'
          ? DWARF_LAST
          : species === 'lizardfolk'
            ? LIZARD_LAST
            : HUMAN_LAST_NAMES;

  // Prefer single names or rich Name + Surname/Clan combinations, always avoiding duplicates!
  for (let attempt = 0; attempt < 48; attempt++) {
    const first = firstPool[Math.floor(Math.random() * firstPool.length)];
    const last = lastPool[Math.floor(Math.random() * lastPool.length)];
    const candidate = attempt < 10 && Math.random() < 0.25 ? first : `${first} ${last}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return `${firstPool[Math.floor(Math.random() * firstPool.length)]} ${lastPool[Math.floor(Math.random() * lastPool.length)]}`;
}

export const SETTLEMENT_AWARENESS_RADIUS = 12;
export const MAX_CITY_BUILDINGS = 60;
export const MAX_WORLD_CITIES = 10;
export const YEARS_PER_SEC_AT_1X = 1.0;

export function getMaxCityBuildings(epochIndex: number): number {
  if (epochIndex <= 0) return 18;
  if (epochIndex === 1) return 26;
  if (epochIndex === 2) return 34;
  if (epochIndex === 3) return 42; // Industrial: dense brick tenement cities + rail
  if (epochIndex === 4) return 50; // Atomic: mid-rise urban blocks + airport
  if (epochIndex === 5) return 56; // Information: high-density skyscraper metropolis + metro
  return MAX_CITY_BUILDINGS;
}

export function getMaxCityFarmFields(cityBuildingCount: number): number {
  return cityBuildingCount <= 0 ? 0 : Math.min(64, cityBuildingCount * 4);
}

let idCounter = 1000;
export function nextEntityId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export function getTileIndex(x: number, z: number, gridSize: number): number {
  return z * gridSize + x;
}

export function getTile(state: SimulationState, x: number, z: number): TileData | undefined {
  const rx = Math.round(x);
  const rz = Math.round(z);
  if (rx < 0 || rx >= state.gridSize || rz < 0 || rz >= state.gridSize) return undefined;
  return state.tiles[getTileIndex(rx, rz, state.gridSize)];
}

export function forEachTileInRadius(
  state: SimulationState,
  cx: number,
  cz: number,
  radius: number,
  fn: (tile: TileData, dSq: number) => void,
): void {
  const gs = state.gridSize;
  const tiles = state.tiles;
  const rSq = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(gs - 1, Math.ceil(cx + radius));
  const minZ = Math.max(0, Math.floor(cz - radius));
  const maxZ = Math.min(gs - 1, Math.ceil(cz + radius));
  for (let z = minZ; z <= maxZ; z++) {
    const dz = z - cz;
    const dzSq = dz * dz;
    const rowOff = z * gs;
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dSq = dx * dx + dzSq;
      if (dSq <= rSq) {
        const tile = tiles[rowOff + x];
        if (tile) fn(tile, dSq);
      }
    }
  }
}

export function forEachTileInBounds(
  state: SimulationState,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  fn: (tile: TileData) => void,
): void {
  const gs = state.gridSize;
  const tiles = state.tiles;
  const x0 = Math.max(0, Math.floor(minX));
  const x1 = Math.min(gs - 1, Math.ceil(maxX));
  const z0 = Math.max(0, Math.floor(minZ));
  const z1 = Math.min(gs - 1, Math.ceil(maxZ));
  for (let z = z0; z <= z1; z++) {
    const rowOff = z * gs;
    for (let x = x0; x <= x1; x++) {
      const tile = tiles[rowOff + x];
      if (tile) fn(tile);
    }
  }
}

export function formatYearLabel(year: number): string {
  const wholeYear = Math.max(0, Math.floor(year + 1e-6));
  return `Year ${wholeYear.toLocaleString()}`;
}

export function canAfford(current: Resources, cost: Partial<Resources>, sandboxFree = false): boolean {
  if (sandboxFree) return true;
  for (const [k, v] of Object.entries(cost)) {
    const key = k as keyof Resources;
    if ((v ?? 0) > (current[key] ?? 0)) return false;
  }
  return true;
}

export function deductCost(current: Resources, cost: Partial<Resources>, sandboxFree = false): Resources {
  if (sandboxFree) return { ...current };
  const next = { ...current };
  for (const [k, v] of Object.entries(cost)) {
    const key = k as keyof Resources;
    next[key] = Math.max(0, (next[key] ?? 0) - (v ?? 0));
  }
  return next;
}

const RESOURCE_KEYS: (keyof Resources)[] = [
  'food',
  'wood',
  'stone',
  'ore',
  'knowledge',
  'energy',
  'alloy',
  'faith',
];

function emptyResources(): Resources {
  return {
    food: 0,
    wood: 0,
    stone: 0,
    ore: 0,
    knowledge: 0,
    energy: 0,
    alloy: 0,
    faith: 0,
  };
}

const lastSyncedTotalsMap = new WeakMap<SimulationState, Resources>();

export function ensureKingdomResources(state: SimulationState, kingdomId: string): Resources {
  if (!state.kingdomResources) state.kingdomResources = {};
  if (!state.kingdomResources[kingdomId]) {
    state.kingdomResources[kingdomId] = emptyResources();
  }
  return state.kingdomResources[kingdomId];
}

function getLiveKingdomIds(state: SimulationState): string[] {
  const kids = new Set<string>();
  for (const b of state.buildings) {
    if (b.hp > 0 && b.settlementId) {
      kids.add(getKingdomId(state, b.settlementId));
    }
  }
  for (const u of state.units) {
    if (u.faction === 'civilization' && u.state !== 'ko' && u.hp > 0) {
      const kid = u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId;
      if (kid) kids.add(kid);
    }
  }
  return Array.from(kids);
}

const lastSyncedEpochMap = new WeakMap<SimulationState, number>();
const explicitEpochOverrideMap = new WeakMap<SimulationState, number>();

function clampEpochIndex(epochIdx: number): number {
  if (!Number.isFinite(epochIdx)) return 0;
  return Math.max(0, Math.min(EPOCHS.length - 1, Math.floor(epochIdx)));
}

export function getKingdomEpoch(state: SimulationState, kingdomId?: string): number {
  if (!kingdomId) return 0;
  const recorded = state.kingdomEpochs?.[kingdomId];
  if (recorded !== undefined) return clampEpochIndex(recorded);
  return 0;
}

export function setKingdomEpoch(
  state: SimulationState,
  kingdomId: string,
  epochIndex: number,
  resetProgress = true,
): void {
  if (!state.kingdomEpochs) state.kingdomEpochs = {};
  if (!state.kingdomEpochProgress) state.kingdomEpochProgress = {};
  explicitEpochOverrideMap.delete(state);
  const clamped = clampEpochIndex(epochIndex);
  state.kingdomEpochs[kingdomId] = clamped;
  if (resetProgress) {
    state.kingdomEpochProgress[kingdomId] = clamped >= EPOCHS.length - 1 ? 100 : 0;
  }
  syncAverageEpochFromKingdoms(state);
}

export function getSettlementEpoch(state: SimulationState, settlementId?: string): number {
  if (!settlementId) return 0;
  const kid = getKingdomId(state, settlementId);
  return getKingdomEpoch(state, kid);
}

export function getUnitEpoch(
  state: SimulationState,
  unit: Pick<UnitEntity, 'faction' | 'settlementId' | 'kingdomId'>,
): number {
  if (unit.faction !== 'civilization') return 0;
  const kid = unit.settlementId ? getKingdomId(state, unit.settlementId) : unit.kingdomId;
  if (!kid) return 0;
  return getKingdomEpoch(state, kid);
}

export function computeAverageCivilizationEpoch(state: SimulationState): {
  avgFloat: number;
  roundedIndex: number;
  civCount: number;
} {
  const liveKids = getLiveKingdomIds(state);
  if (liveKids.length === 0) {
    const fallback = clampEpochIndex(state.epochIndex);
    return { avgFloat: fallback, roundedIndex: fallback, civCount: 0 };
  }
  let sum = 0;
  for (let i = 0; i < liveKids.length; i++) {
    sum += getKingdomEpoch(state, liveKids[i]);
  }
  const avgFloat = sum / liveKids.length;
  const roundedIndex = Math.max(0, Math.min(EPOCHS.length - 1, Math.round(avgFloat)));
  return { avgFloat, roundedIndex, civCount: liveKids.length };
}

export function syncAverageEpochFromKingdoms(state: SimulationState): void {
  const liveKids = getLiveKingdomIds(state);
  if (liveKids.length === 0) {
    const clamped = clampEpochIndex(state.epochIndex);
    state.averageEpochIndex = clamped;
    state.epochIndex = clamped;
    lastSyncedEpochMap.set(state, state.epochIndex);
    return;
  }
  if (!state.kingdomEpochs) state.kingdomEpochs = {};
  if (!state.kingdomEpochProgress) state.kingdomEpochProgress = {};
  let sumEpoch = 0;
  let sumProg = 0;
  for (const kid of liveKids) {
    if (state.kingdomEpochs[kid] === undefined) {
      state.kingdomEpochs[kid] = 0;
    }
    if (state.kingdomEpochProgress[kid] === undefined) {
      state.kingdomEpochProgress[kid] = state.kingdomEpochs[kid] >= EPOCHS.length - 1 ? 100 : 0;
    }
    sumEpoch += clampEpochIndex(state.kingdomEpochs[kid]);
    sumProg += Math.max(0, Math.min(100, state.kingdomEpochProgress[kid] ?? 0));
  }
  const avgFloat = sumEpoch / liveKids.length;
  state.averageEpochIndex = avgFloat;
  state.epochIndex = Math.max(0, Math.min(EPOCHS.length - 1, Math.round(avgFloat)));
  state.epochProgress = Math.round(sumProg / liveKids.length);
  lastSyncedEpochMap.set(state, state.epochIndex);
}

function reconcileKingdomEpochs(state: SimulationState, clearExplicitOverride = false): void {
  if (!state.kingdomEpochs) state.kingdomEpochs = {};
  if (!state.kingdomEpochProgress) state.kingdomEpochProgress = {};

  const lastSynced = lastSyncedEpochMap.get(state);
  const clampedGlobal = clampEpochIndex(state.epochIndex);
  if (lastSynced !== undefined && clampedGlobal !== lastSynced) {
    // External caller (sandbox epoch tool or test setup) explicitly set state.epochIndex
    const liveKids = getLiveKingdomIds(state);
    for (const kid of liveKids) {
      state.kingdomEpochs[kid] = clampedGlobal;
      state.kingdomEpochProgress[kid] = clampedGlobal >= EPOCHS.length - 1 ? 100 : 0;
    }
    explicitEpochOverrideMap.set(state, clampedGlobal);
    state.averageEpochIndex = clampedGlobal;
    state.epochIndex = clampedGlobal;
    lastSyncedEpochMap.set(state, clampedGlobal);
  } else if (lastSynced === undefined) {
    lastSyncedEpochMap.set(state, clampedGlobal);
  }

  // Prune dead kingdoms from epoch maps so average age strictly reflects existing civilizations
  const liveSet = new Set(getLiveKingdomIds(state));
  for (const kid of Object.keys(state.kingdomEpochs)) {
    if (!liveSet.has(kid)) {
      delete state.kingdomEpochs[kid];
      delete state.kingdomEpochProgress[kid];
    }
  }
  for (const kid of liveSet) {
    if (state.kingdomEpochs[kid] === undefined) {
      state.kingdomEpochs[kid] = 0;
      state.kingdomEpochProgress[kid] = 0;
    }
  }
}

function getKingdomAnchor(state: SimulationState, kingdomId: string): { x: number; z: number } | null {
  let sx = 0;
  let sz = 0;
  let count = 0;
  for (let i = 0; i < state.buildings.length; i++) {
    const b = state.buildings[i];
    if (b.hp <= 0 || !b.settlementId) continue;
    if (getKingdomId(state, b.settlementId) === kingdomId) {
      sx += b.tileX;
      sz += b.tileZ;
      count++;
    }
  }
  if (count > 0) return { x: sx / count, z: sz / count };
  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
    const ukid = u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId;
    if (ukid === kingdomId) {
      sx += u.x;
      sz += u.z;
      count++;
    }
  }
  return count > 0 ? { x: sx / count, z: sz / count } : null;
}

export interface KingdomDiffusionInfo {
  diffusionBoost: number;
  maxNeighborEpoch: number;
  nearestAheadDist: number | null;
  isCatchingUp: boolean;
  strongestCurveFactor: number;
}

/**
 * Computes proximity-based technological diffusion for a civilization.
 * - Nearby civilizations strictly ahead in age accelerate a trailing civilization's growth.
 * - Growth follows a diminishing catch-up curve (steep when far behind, tapering smoothly as the gap closes).
 * - Diffusion drops to 0 once equal in age, so a trailing race cannot overtake a leading neighbor via diffusion
 *   until both civilizations are on equal age.
 */
export function computeKingdomProximityDiffusion(
  state: SimulationState,
  kingdomId: string,
): KingdomDiffusionInfo {
  const myEpoch = getKingdomEpoch(state, kingdomId);
  if (myEpoch >= EPOCHS.length - 1) {
    return {
      diffusionBoost: 0,
      maxNeighborEpoch: myEpoch,
      nearestAheadDist: null,
      isCatchingUp: false,
      strongestCurveFactor: 0,
    };
  }
  const myAnchor = getKingdomAnchor(state, kingdomId);
  if (!myAnchor) {
    return {
      diffusionBoost: 0,
      maxNeighborEpoch: myEpoch,
      nearestAheadDist: null,
      isCatchingUp: false,
      strongestCurveFactor: 0,
    };
  }
  const myProgress = Math.max(0, Math.min(100, state.kingdomEpochProgress?.[kingdomId] ?? 0));
  const myContinuous = myEpoch + myProgress / 100;

  // Consider all other living kingdoms that have at least one standing building and are strictly ahead in age
  const liveKids = getLiveKingdomIds(state);
  let bestInfluence = 0;
  let secondarySum = 0;
  let maxNeighborEpoch = myEpoch;
  let nearestAheadDist: number | null = null;
  let strongestCurveFactor = 0;

  for (let i = 0; i < liveKids.length; i++) {
    const otherKid = liveKids[i];
    if (otherKid === kingdomId) continue;
    const otherEpoch = getKingdomEpoch(state, otherKid);
    if (otherEpoch <= myEpoch) continue; // Only neighbors strictly ahead in age diffuse tech
    const otherAnchor = getKingdomAnchor(state, otherKid);
    if (!otherAnchor) continue;

    const otherProg = Math.max(0, Math.min(100, state.kingdomEpochProgress?.[otherKid] ?? 0));
    const otherContinuous = otherEpoch + otherProg / 100;
    const gap = Math.max(0, otherContinuous - myContinuous);
    if (gap <= 0) continue;

    const dist = Math.hypot(myAnchor.x - otherAnchor.x, myAnchor.z - otherAnchor.z);
    if (nearestAheadDist === null || dist < nearestAheadDist) {
      nearestAheadDist = dist;
    }
    if (otherEpoch > maxNeighborEpoch) {
      maxNeighborEpoch = otherEpoch;
    }

    // Proximity decay: 1.0 when <= 10 tiles apart, ~0.50 at 32 tiles, ~0.16 at 60 tiles, ~0.06 at 95 tiles
    const proximity = 1 / (1 + Math.pow(Math.max(0, dist - 10) / 22, 2));
    // Concave/diminishing catch-up curve: steep when gap is large (e.g. Stone vs Info), smoothly tapering as gap -> 0
    const curveFactor = Math.pow(gap, 1.35);
    const influence = proximity * curveFactor;

    if (influence > bestInfluence) {
      secondarySum += bestInfluence;
      bestInfluence = influence;
      strongestCurveFactor = curveFactor;
    } else {
      secondarySum += influence;
    }
  }

  const diffusionBoost = Math.min(16, bestInfluence + secondarySum * 0.25);
  return {
    diffusionBoost,
    maxNeighborEpoch,
    nearestAheadDist,
    isCatchingUp: maxNeighborEpoch > myEpoch && diffusionBoost > 0.005,
    strongestCurveFactor,
  };
}

function computeCombinedStock(state: SimulationState): Resources {
  const sum = emptyResources();
  const unalloc = state.unallocatedResources;
  if (unalloc) {
    for (const k of RESOURCE_KEYS) {
      sum[k] += Math.max(0, unalloc[k] ?? 0);
    }
  }
  const kMap = state.kingdomResources;
  if (kMap) {
    for (const kid of Object.keys(kMap)) {
      const kr = kMap[kid];
      if (!kr) continue;
      for (const k of RESOURCE_KEYS) {
        sum[k] += Math.max(0, kr[k] ?? 0);
      }
    }
  }
  return sum;
}

export function syncStateResourcesFromKingdoms(state: SimulationState): void {
  if (!state.kingdomResources) state.kingdomResources = {};
  if (!state.unallocatedResources) state.unallocatedResources = emptyResources();
  const sum = computeCombinedStock(state);
  state.resources = sum;
  lastSyncedTotalsMap.set(state, { ...sum });
}

export function reconcileAndSyncResources(state: SimulationState): void {
  if (!state.kingdomResources) state.kingdomResources = {};
  if (!state.unallocatedResources) state.unallocatedResources = emptyResources();
  const kids = getLiveKingdomIds(state);
  const prevTotal = lastSyncedTotalsMap.get(state);

  if (!prevTotal) {
    const curSum = computeCombinedStock(state);
    for (const k of RESOURCE_KEYS) {
      const diff = (state.resources[k] ?? 0) - curSum[k];
      if (Math.abs(diff) > 1e-6) {
        if (k !== 'faith' && kids.length > 0 && diff > 0) {
          const share = diff / kids.length;
          for (const kid of kids) {
            const kr = ensureKingdomResources(state, kid);
            kr[k] += share;
          }
        } else {
          state.unallocatedResources[k] = Math.max(0, (state.unallocatedResources[k] ?? 0) + diff);
        }
      }
    }
    syncStateResourcesFromKingdoms(state);
    return;
  }

  for (const k of RESOURCE_KEYS) {
    const extVal = Math.max(0, state.resources[k] ?? 0);
    const delta = extVal - (prevTotal[k] ?? 0);
    if (Math.abs(delta) <= 1e-6) continue;

    if (delta > 0) {
      if (k !== 'faith' && kids.length > 0) {
        const share = delta / kids.length;
        for (const kid of kids) {
          const kr = ensureKingdomResources(state, kid);
          kr[k] += share;
        }
      } else {
        state.unallocatedResources[k] = (state.unallocatedResources[k] ?? 0) + delta;
      }
    } else {
      let rem = -delta;
      if (k === 'faith') {
        const unTake = Math.min(rem, state.unallocatedResources[k] ?? 0);
        state.unallocatedResources[k] = Math.max(0, (state.unallocatedResources[k] ?? 0) - unTake);
        rem -= unTake;
      }
      if (rem > 1e-6) {
        const totalInK = Object.values(state.kingdomResources).reduce((acc, kr) => acc + Math.max(0, kr[k] ?? 0), 0);
        if (totalInK > 1e-6) {
          const ratio = Math.min(1, rem / totalInK);
          for (const kid of Object.keys(state.kingdomResources)) {
            const take = Math.max(0, state.kingdomResources[kid][k] ?? 0) * ratio;
            state.kingdomResources[kid][k] = Math.max(0, state.kingdomResources[kid][k] - take);
            rem -= take;
          }
        }
      }
      if (rem > 1e-6) {
        state.unallocatedResources[k] = Math.max(0, (state.unallocatedResources[k] ?? 0) - rem);
      }
    }
  }
  syncStateResourcesFromKingdoms(state);
}

function grantResourcesToKingdomOrPool(
  state: SimulationState,
  delta: Partial<Resources>,
  targetKingdomId?: string,
): void {
  reconcileAndSyncResources(state);
  const kids = getLiveKingdomIds(state);
  for (const [keyRaw, amt] of Object.entries(delta)) {
    if (!amt || amt <= 0) continue;
    const k = keyRaw as keyof Resources;
    if (targetKingdomId && k !== 'faith') {
      ensureKingdomResources(state, targetKingdomId)[k] += amt;
    } else if (k !== 'faith' && kids.length > 0) {
      const share = amt / kids.length;
      for (const kid of kids) {
        ensureKingdomResources(state, kid)[k] += share;
      }
    } else {
      if (!state.unallocatedResources) state.unallocatedResources = emptyResources();
      state.unallocatedResources[k] += amt;
    }
  }
  syncStateResourcesFromKingdoms(state);
}

function spendWorldCost(state: SimulationState, cost: Partial<Resources>, preferKingdomId?: string): void {
  reconcileAndSyncResources(state);
  for (const [keyRaw, val] of Object.entries(cost)) {
    let rem = val ?? 0;
    if (rem <= 0) continue;
    const k = keyRaw as keyof Resources;
    if (preferKingdomId && state.kingdomResources?.[preferKingdomId]) {
      const take = Math.min(rem, Math.max(0, state.kingdomResources[preferKingdomId][k] ?? 0));
      state.kingdomResources[preferKingdomId][k] -= take;
      rem -= take;
    }
    if (rem > 1e-6 && state.unallocatedResources) {
      const take = Math.min(rem, Math.max(0, state.unallocatedResources[k] ?? 0));
      state.unallocatedResources[k] -= take;
      rem -= take;
    }
    if (rem > 1e-6 && state.kingdomResources) {
      for (const kid of Object.keys(state.kingdomResources)) {
        if (rem <= 1e-6) break;
        const take = Math.min(rem, Math.max(0, state.kingdomResources[kid][k] ?? 0));
        state.kingdomResources[kid][k] -= take;
        rem -= take;
      }
    }
  }
  syncStateResourcesFromKingdoms(state);
}

function transferUnallocatedStockToKingdom(state: SimulationState, kingdomId: string): void {
  if (!state.unallocatedResources) return;
  const kr = ensureKingdomResources(state, kingdomId);
  for (const k of RESOURCE_KEYS) {
    if (k === 'faith') continue;
    const avail = state.unallocatedResources[k] ?? 0;
    if (avail > 0) {
      kr[k] += avail;
      state.unallocatedResources[k] = 0;
    }
  }
}

export const DEFAULT_WORLD_RULES: WorldRulesConfig = {
  allowFantasy: true,
  allowDinosaurs: true,
  raiderWaves: false,
  wildfireSpread: true,
  autoBuildEnabled: true,
  sandboxFreeMode: false,
  immortalEntities: false,
  dayNightCycle: false,
  allowReproduction: true,
  animalAttacks: true,
  allowRebellion: true,
  warsEnabled: true,
  randomEvents: true,
  startingEpochIndex: 0,
  startingSettlers: 'none',
};

export interface WorldTemplatePreset {
  id: WorldTemplateId;
  name: string;
  tagline: string;
  description: string;
  badge: string;
  accentColor: string;
  defaultWorldName: string;
  seaLevel: 'low' | 'normal' | 'high';
  mountainDensity: 'low' | 'normal' | 'high';
  climate: 'cold' | 'temperate' | 'warm';
  rules: WorldRulesConfig;
}

export const WORLD_TEMPLATES: WorldTemplatePreset[] = [
  {
    id: 'realistic',
    name: 'Realistic',
    tagline: 'Humans & natural wildlife',
    description: 'Standard terrestrial biomes with no fantasy creatures.',
    badge: 'Historical',
    accentColor: '#80ed99',
    defaultWorldName: 'My World',
    seaLevel: 'normal',
    mountainDensity: 'normal',
    climate: 'temperate',
    rules: {
      allowFantasy: false,
      allowDinosaurs: false,
      raiderWaves: false,
      wildfireSpread: true,
      autoBuildEnabled: true,
      sandboxFreeMode: false,
      immortalEntities: false,
      dayNightCycle: false,
      allowReproduction: true,
      animalAttacks: true,
      allowRebellion: true,
      warsEnabled: true,
      randomEvents: true,
      startingEpochIndex: 0,
      startingSettlers: 'pioneers',
    },
  },
  {
    id: 'fantastic',
    name: 'Fantasy',
    tagline: 'Elves, Orcs & Dragons',
    description: 'Fantasy world with magical creatures and crystal fields.',
    badge: 'Fantasy',
    accentColor: '#c084fc',
    defaultWorldName: 'My World',
    seaLevel: 'normal',
    mountainDensity: 'high',
    climate: 'temperate',
    rules: {
      allowFantasy: true,
      allowDinosaurs: true,
      raiderWaves: true,
      wildfireSpread: true,
      autoBuildEnabled: true,
      sandboxFreeMode: false,
      immortalEntities: false,
      dayNightCycle: false,
      allowReproduction: true,
      animalAttacks: true,
      allowRebellion: true,
      warsEnabled: true,
      randomEvents: true,
      startingEpochIndex: 0,
      startingSettlers: 'pioneers',
    },
  },
  {
    id: 'scifi',
    name: 'Sci-Fi',
    tagline: 'Space Age start',
    description: 'Starts in the Space Age with an advanced colony.',
    badge: 'Sci-Fi',
    accentColor: '#56cfe1',
    defaultWorldName: 'My World',
    seaLevel: 'normal',
    mountainDensity: 'normal',
    climate: 'temperate',
    rules: {
      allowFantasy: false,
      allowDinosaurs: false,
      raiderWaves: false,
      wildfireSpread: true,
      autoBuildEnabled: true,
      sandboxFreeMode: false,
      immortalEntities: false,
      dayNightCycle: false,
      allowReproduction: true,
      animalAttacks: true,
      allowRebellion: true,
      warsEnabled: true,
      randomEvents: true,
      startingEpochIndex: 6,
      startingSettlers: 'colony',
    },
  },
  {
    id: 'prehistoric',
    name: 'Prehistoric',
    tagline: 'Dinosaurs & jungles',
    description: 'Warm ancient continent roaming with Dinosaurs.',
    badge: 'Ancient',
    accentColor: '#fb923c',
    defaultWorldName: 'My World',
    seaLevel: 'low',
    mountainDensity: 'high',
    climate: 'warm',
    rules: {
      allowFantasy: false,
      allowDinosaurs: true,
      raiderWaves: false,
      wildfireSpread: true,
      autoBuildEnabled: true,
      sandboxFreeMode: false,
      immortalEntities: false,
      dayNightCycle: false,
      allowReproduction: true,
      animalAttacks: true,
      allowRebellion: true,
      warsEnabled: true,
      randomEvents: true,
      startingEpochIndex: 0,
      startingSettlers: 'pioneers',
    },
  },
  {
    id: 'archipelago',
    name: 'Islands',
    tagline: 'Island chains & shallow seas',
    description: 'Scattered islands and coastal lagoons.',
    badge: 'Islands',
    accentColor: '#38bdf8',
    defaultWorldName: 'My World',
    seaLevel: 'high',
    mountainDensity: 'normal',
    climate: 'warm',
    rules: {
      allowFantasy: true,
      allowDinosaurs: false,
      raiderWaves: false,
      wildfireSpread: true,
      autoBuildEnabled: true,
      sandboxFreeMode: false,
      immortalEntities: false,
      dayNightCycle: false,
      allowReproduction: true,
      animalAttacks: true,
      allowRebellion: true,
      warsEnabled: true,
      randomEvents: true,
      startingEpochIndex: 0,
      startingSettlers: 'pioneers',
    },
  },
  {
    id: 'scrap_sea',
    name: 'Ocean World',
    tagline: 'Open ocean & floating scrap',
    description: 'Open ocean world with coral reefs and floating scrap piles to build water cities.',
    badge: 'Ocean',
    accentColor: '#06b6d4',
    defaultWorldName: 'My World',
    seaLevel: 'high',
    mountainDensity: 'low',
    climate: 'warm',
    rules: {
      allowFantasy: true,
      allowDinosaurs: false,
      raiderWaves: false,
      wildfireSpread: false,
      autoBuildEnabled: true,
      sandboxFreeMode: false,
      immortalEntities: false,
      dayNightCycle: false,
      allowReproduction: true,
      animalAttacks: true,
      allowRebellion: true,
      warsEnabled: true,
      randomEvents: true,
      startingEpochIndex: 0,
      startingSettlers: 'pioneers',
    },
  },
  {
    id: 'single_biome',
    name: 'Single Biome',
    tagline: 'One biome across the world',
    description: 'Choose any biome to cover the entire landmass. All god powers remain available.',
    badge: 'Biome',
    accentColor: '#34d399',
    defaultWorldName: 'My World',
    seaLevel: 'normal',
    mountainDensity: 'normal',
    climate: 'temperate',
    rules: {
      ...DEFAULT_WORLD_RULES,
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    tagline: 'Tune land & climate',
    description: 'Manually adjust sea level, relief, and climate.',
    badge: 'Custom',
    accentColor: '#f5b742',
    defaultWorldName: 'My World',
    seaLevel: 'normal',
    mountainDensity: 'normal',
    climate: 'temperate',
    rules: {
      ...DEFAULT_WORLD_RULES,
    },
  },
];

export interface SingleBiomeOption {
  id: TerrainType;
  label: string;
  swatch: string;
}

export const SINGLE_BIOME_OPTIONS: SingleBiomeOption[] = [
  { id: 'grass', label: 'Grasslands', swatch: '#5fa853' },
  { id: 'fertile', label: 'Fertile Meadow', swatch: '#4f9d45' },
  { id: 'forest', label: 'Woodland Forest', swatch: '#3c7a3e' },
  { id: 'jungle', label: 'Tropical Jungle', swatch: '#2b6e3f' },
  { id: 'savanna', label: 'Golden Savanna', swatch: '#b7a14a' },
  { id: 'swamp', label: 'Misty Swamp', swatch: '#4c6642' },
  { id: 'sand', label: 'Arid Desert', swatch: '#d6bc72' },
  { id: 'badlands', label: 'Red Badlands', swatch: '#b96543' },
  { id: 'highland', label: 'Alpine Highlands', swatch: '#6d875c' },
  { id: 'mountain', label: 'Mountain Peaks', swatch: '#777b82' },
  { id: 'rock', label: 'Rocky Crags', swatch: '#6c6c6c' },
  { id: 'taiga', label: 'Boreal Taiga', swatch: '#3f6a56' },
  { id: 'tundra', label: 'Arctic Tundra', swatch: '#8a9b8e' },
  { id: 'snow', label: 'Snowfields', swatch: '#dce8f2' },
  { id: 'blossom', label: 'Blossom Grove', swatch: '#d98fb3' },
  { id: 'crystal_field', label: 'Crystal Field', swatch: '#56cfe1' },
  { id: 'volcanic_wasteland', label: 'Volcanic Wasteland', swatch: '#4a2b24' },
  { id: 'blighted_mire', label: 'Land of Blight', swatch: '#5a356d' },
  { id: 'floral_plains', label: 'Floral Plains', swatch: '#75c46b' },
  { id: 'scorched', label: 'Scorched Ashlands', swatch: '#443b37' },
  { id: 'void_goo', label: 'Void Mire', swatch: '#35224d' },
];

export function createWorldConfigFromTemplate(
  templateId: WorldTemplateId,
  overrides?: Partial<WorldGenConfig>,
): WorldGenConfig {
  const preset = WORLD_TEMPLATES.find((t) => t.id === templateId) ?? WORLD_TEMPLATES[0];
  return {
    worldName: overrides?.worldName ?? preset.defaultWorldName,
    seed: overrides?.seed ?? normalizeSeed(undefined),
    gridSize: overrides?.gridSize ?? 128,
    template: templateId,
    singleBiome:
      templateId === 'single_biome'
        ? (overrides?.singleBiome ?? 'forest')
        : overrides?.singleBiome,
    seaLevel: overrides?.seaLevel ?? preset.seaLevel,
    mountainDensity: overrides?.mountainDensity ?? preset.mountainDensity,
    climate: overrides?.climate ?? preset.climate,
    rules: {
      ...preset.rules,
      ...(overrides?.rules ?? {}),
    },
  };
}

export function createInitialSimulationState(
  gridSize = 128,
  seedInput?: number | string,
  config?: Partial<WorldGenConfig>,
): SimulationState {
  const resolvedGridSize = Math.max(32, Math.min(256, Math.round(config?.gridSize ?? gridSize)));
  const seed = normalizeSeed(config?.seed ?? seedInput);
  const template: WorldTemplateId = config?.template ?? 'fantastic';
  const rules: WorldRulesConfig = {
    ...DEFAULT_WORLD_RULES,
    ...(config?.rules ?? {}),
  };

  const seaLevelBias = config?.seaLevel ?? 'normal';
  const mountainBias = config?.mountainDensity ?? 'normal';
  const climateBias =
    config?.climate === 'cold'
      ? 'cold'
      : config?.climate === 'warm'
        ? 'warm'
        : 'balanced';

  const tiles = generateWorldTiles(resolvedGridSize, seed, {
    template,
    singleBiome: config?.singleBiome,
    seaLevelBias,
    mountainBias,
    climateBias,
    allowFantasyBiomes: rules.allowFantasy,
  });

  const cx = Math.floor(resolvedGridSize / 2);
  const cz = Math.floor(resolvedGridSize / 2);

  const startingEpochIdx = Math.max(0, Math.min(EPOCHS.length - 1, rules.startingEpochIndex ?? 0));
  const startingEpoch = EPOCHS[startingEpochIdx] || EPOCHS[0];
  const startingYear = 0;

  const isAdvancedStart = startingEpochIdx >= 4;
  const isSciFiStart = startingEpochIdx >= 6;
  const worldTitle = config?.worldName?.trim() || 'My World';

  const initialChronicle: ChronicleEvent[] = [
    {
      id: 'chr_1',
      yearLabel: formatYearLabel(startingYear),
      text: `${worldTitle} awakens in the ${startingEpoch.name} (Seed ${seed}).`,
      tone: startingEpochIdx > 0 ? 'epoch' : 'divine',
      timestamp: Date.now(),
    },
  ];

  const state: SimulationState = {
    seed,
    gridSize: resolvedGridSize,
    tiles,
    epochIndex: startingEpochIdx,
    epochProgress: 0,
    year: startingYear,
    resources: {
      food: isSciFiStart ? 600 : isAdvancedStart ? 250 : rules.startingSettlers === 'colony' ? 120 : rules.startingSettlers === 'pioneers' ? 45 : 0,
      wood: isSciFiStart ? 500 : isAdvancedStart ? 220 : rules.startingSettlers === 'colony' ? 100 : rules.startingSettlers === 'pioneers' ? 35 : 0,
      stone: isSciFiStart ? 500 : isAdvancedStart ? 220 : rules.startingSettlers === 'colony' ? 80 : rules.startingSettlers === 'pioneers' ? 15 : 0,
      ore: isSciFiStart ? 420 : isAdvancedStart ? 160 : 0,
      knowledge: isSciFiStart ? 850 : isAdvancedStart ? 300 : 0,
      energy: isSciFiStart ? 600 : isAdvancedStart ? 180 : 0,
      alloy: isSciFiStart ? 450 : isAdvancedStart ? 120 : 0,
      faith: isSciFiStart ? 300 : 150,
    },
    rates: {
      food: 0,
      wood: 0,
      stone: 0,
      ore: 0,
      knowledge: 0,
      energy: 0,
      alloy: 0,
      faith: 2,
    },
    buildings: [],
    units: [],
    vehicles: [],
    population: 0,
    populationCap: 0,
    happiness: 88,
    goldenAgeTimer: 0,
    autoBuildEnabled: rules.autoBuildEnabled,
    sandboxFreeMode: rules.sandboxFreeMode,
    chronicle: initialChronicle,
    pendingVfx: [],
    activeHazards: [],
    totalMiraclesCast: 0,
    totalStructuresBuilt: 0,
    totalRaidersDefeated: 0,
    worldStats: createEmptyWorldStats(),
    selectedEntityId: null,
    selectedTile: { x: cx, z: cz },
    outcome: 'none',
    civPlanTimer: 0,
    harvestAccumulator: emptyResources(),
    harvestRates: emptyResources(),
    harvestWindowTimer: 0,
    settlementNames: {},
    settlementSpecies: {},
    settlementKingdoms: {},
    kingdomEpochs: {},
    kingdomEpochProgress: {},
    averageEpochIndex: startingEpochIdx,
    kingdomResources: {},
    unallocatedResources: emptyResources(),
    kingdomUltimateCooldowns: {},
    kingdomRelations: {},
    kingdomPeacefulTraits: {},
    kingdomPeaceTreaties: {},
    kingdomTradePacts: {},
    kingdomWarStartYears: {},
    diplomacyTimer: 0,
    rebellionTimer: 0,
    worldEventTimer: 0,
    voidGooTimer: 0,
    voidWisps: [],
    activeWorldEvent: null,
    worldName: worldTitle,
    worldTemplate: template,
    worldRules: rules,
  };

  // Seed unallocatedResources from initial starting world preset before colonies claim it
  for (const k of RESOURCE_KEYS) {
    state.unallocatedResources![k] = state.resources[k] ?? 0;
  }
  lastSyncedTotalsMap.set(state, { ...state.resources });
  lastSyncedEpochMap.set(state, startingEpochIdx);
  if (startingEpochIdx > 0) {
    explicitEpochOverrideMap.set(state, startingEpochIdx);
  }

  // Seed starting wildlife if a world config was explicitly provided
  if (config) {
    seedWorldWildlife(state);
    state.wildlifeSeeded = true;
  }

  // Spawn starting pioneers or an established colony if configured
  if (config && rules.startingSettlers !== 'none') {
    let landTile: TileData | undefined;
    let bestDist = Infinity;
    for (const t of state.tiles) {
      if (t.height >= 1 && t.height <= 3 && !t.buildingId && t.terrain !== 'mountain') {
        const d = Math.hypot(t.x - cx, t.z - cz);
        if (d < bestDist) {
          bestDist = d;
          landTile = t;
        }
      }
    }
    // Fallback for all-ocean worlds like 'scrap_sea': pick central shallow water shoal for a floating settlement
    if (!landTile) {
      for (const t of state.tiles) {
        if (t.height === 0 && !t.buildingId) {
          const d = Math.hypot(t.x - cx, t.z - cz) + (t.terrain === 'shallow_water' ? 0 : 8);
          if (d < bestDist) {
            bestDist = d;
            landTile = t;
          }
        }
      }
    }

    if (landTile) {
      state.selectedTile = { x: landTile.x, z: landTile.z };
      const isWaterStart = landTile.height === 0;
      if (rules.startingSettlers === 'colony') {
        const colonyBuilds: BuildingType[] =
          startingEpochIdx >= 6
            ? [
                'bonfire',
                'forager_hut',
                'forager_hut',
                'forager_hut',
                'forager_hut',
                'granary',
                'steam_foundry',
                'observatory',
                'fission_reactor',
                'launch_arcology',
              ]
            : startingEpochIdx >= 3
              ? [
                  'bonfire',
                  'forager_hut',
                  'forager_hut',
                  'forager_hut',
                  'forager_hut',
                  'granary',
                  'smeltery',
                  'guildhall',
                  'steam_foundry',
                ]
              : [
                  'bonfire',
                  'forager_hut',
                  'forager_hut',
                  'forager_hut',
                  'forager_hut',
                  'shaman_totem',
                ];

        const prevFree = state.sandboxFreeMode;
        state.sandboxFreeMode = true;
        for (let bIdx = 0; bIdx < colonyBuilds.length; bIdx++) {
          const bType = colonyBuilds[bIdx];
          let targetTile: TileData | null = null;
          if (bIdx === 0) {
            targetTile = landTile;
          } else {
            const primarySid = state.buildings[0]?.settlementId ?? 'city_default';
            targetTile = findBuildableTileNear(state, landTile.x, landTile.z, 12, primarySid);
          }
          if (!targetTile) continue;
          const res = placeBuilding(state, bType, targetTile.x, targetTile.z);
          if (res.ok) {
            const placedBld = state.buildings[state.buildings.length - 1];
            if (placedBld) {
              placedBld.constructionProgress = 100;
              placedBld.epochLevel = startingEpochIdx;
            }
          }
        }
        const primarySid = state.buildings[0]?.settlementId;
        if (primarySid) {
          connectSettlementRoads(state, primarySid);
        }
        state.sandboxFreeMode = prevFree;

        const settlerCount = startingEpochIdx >= 6 ? 8 : 6;
        if (isWaterStart) {
          for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              const wt = getTile(state, landTile.x + dx, landTile.z + dz);
              if (wt && wt.height === 0 && !wt.buildingId) wt.terrain = 'stone_road';
            }
          }
          const sid = state.buildings[0]?.settlementId;
          if (sid && startingEpochIdx >= 2) {
            terraformSettlementDistrict(state, sid, startingEpochIdx >= 3);
            connectSettlementRoads(state, sid);
          }
        }
        for (let i = 0; i < settlerCount; i++) {
          const sx = Math.max(2, Math.min(resolvedGridSize - 3, landTile.x + ((i % 3) - 1)));
          const sz = Math.max(2, Math.min(resolvedGridSize - 3, landTile.z + (Math.floor(i / 3) - 1)));
          spawnUnit(state, 'human', sx, sz, true);
        }
      } else if (rules.startingSettlers === 'pioneers') {
        const prevFree = state.sandboxFreeMode;
        state.sandboxFreeMode = true;
        const hearthRes = placeBuilding(state, 'bonfire', landTile.x, landTile.z);
        if (hearthRes.ok) {
          const placedBld = state.buildings[state.buildings.length - 1];
          if (placedBld) {
            placedBld.constructionProgress = 100;
            placedBld.epochLevel = startingEpochIdx;
          }
        }
        state.sandboxFreeMode = prevFree;
        if (isWaterStart) {
          for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              const wt = getTile(state, landTile.x + dx, landTile.z + dz);
              if (wt && wt.height === 0 && !wt.buildingId) wt.terrain = 'stone_road';
            }
          }
          paveSettlementStreetsNear(state, landTile.x, landTile.z, state.buildings[0]?.settlementId ?? 'city_default');
        }
        for (let i = 0; i < 6; i++) {
          const sx = Math.max(2, Math.min(resolvedGridSize - 3, landTile.x + ((i % 3) - 1)));
          const sz = Math.max(2, Math.min(resolvedGridSize - 3, landTile.z + (Math.floor(i / 3) * 2 - 1)));
          spawnUnit(state, 'human', sx, sz, true);
        }
      }
    }
  }

  ensureSettlementKings(state);
  explicitEpochOverrideMap.delete(state);
  syncAverageEpochFromKingdoms(state);
  syncStateResourcesFromKingdoms(state);
  recalculateRatesAndCaps(state);
  return state;
}

export function recalculateRatesAndCaps(state: SimulationState): void {
  reconcileKingdomEpochs(state, false);
  const cityMaxPop = getMaxCityPopulation(state.gridSize);
  const settlementHousing = new Map<string, number>();
  for (const b of state.buildings) {
    if (b.constructionProgress >= 100) {
      const sid = b.settlementId ?? 'city_default';
      if (!settlementHousing.has(sid)) {
        const sEpoch = EPOCHS[getSettlementEpoch(state, sid)] || EPOCHS[0];
        settlementHousing.set(sid, sEpoch.populationBonus);
      }
    }
  }
  const hasSettlement = settlementHousing.size > 0;

  const rates: Resources = {
    food: 0,
    wood: 0,
    stone: 0,
    ore: 0,
    knowledge: 0,
    energy: 0,
    alloy: 0,
    faith: 2, // Ambient cosmic Faith regeneration so God is never soft-locked
  };

  for (const b of state.buildings) {
    if (b.constructionProgress < 100) continue;
    const def = BUILDINGS.find((d) => d.type === b.type);
    if (!def) continue;
    const sid = b.settlementId ?? 'city_default';
    const sEpochIdx = getSettlementEpoch(state, sid);
    const sEpoch = EPOCHS[sEpochIdx] || EPOCHS[0];
    settlementHousing.set(sid, (settlementHousing.get(sid) ?? sEpoch.populationBonus) + def.popCapBonus);

    const blessMult = b.blessedTimer > 0 ? 1.75 : b.cursedTimer > 0 ? 0.5 : 1.0;
    const epochMult = 1 + Math.min(4, sEpochIdx) * 0.1;
    const bSpecies: SpeciesId = b.species ?? (b.settlementId ? state.settlementSpecies?.[b.settlementId] : undefined) ?? 'human';
    const paceMult = state.sandboxFreeMode ? 1.5 : 0.85;

    for (const [k, v] of Object.entries(def.productionPerSec)) {
      const key = k as keyof Resources;
      let spMult = 1.0;
      if (bSpecies === 'human') {
        if (key === 'knowledge' || key === 'energy' || key === 'alloy') spMult = 1.3;
      } else if (bSpecies === 'elf') {
        if (key === 'faith' || key === 'knowledge') spMult = 1.25;
        else if (key === 'ore' || key === 'alloy') spMult = 0.78;
      } else if (bSpecies === 'orc') {
        if (key === 'knowledge' || key === 'energy') spMult = 0.35;
        else if (key === 'alloy') spMult = 0.5;
        else if (key === 'food' || key === 'ore') spMult = 1.15;
      }
      rates[key] += (v ?? 0) * blessMult * epochMult * spMult * paceMult;
    }
  }

  let popCap = 0;
  for (const rawCityCap of settlementHousing.values()) {
    popCap += Math.min(cityMaxPop, rawCityCap);
  }

  let civCount = 0;
  for (const u of state.units) {
    if (u.faction === 'civilization' && u.state !== 'ko') {
      civCount += 1;
    }
  }

  // Merge measured citizen harvesting & research haul rates (no passive fake income from idle units)
  const measured = state.harvestRates;
  if (measured) {
    for (const k of Object.keys(rates) as (keyof Resources)[]) {
      rates[k] += measured[k] ?? 0;
    }
  }

  if (civCount > 6) {
    const foodUpkeep = Math.floor((civCount - 6) * 0.1);
    rates.food = Math.max(hasSettlement ? 0 : -foodUpkeep, rates.food - foodUpkeep);
  }

  const mult = state.goldenAgeTimer > 0 ? 2 : 1;
  for (const k of Object.keys(rates) as (keyof Resources)[]) {
    rates[k] = Math.round(rates[k] * mult);
  }

  state.rates = rates;
  state.population = civCount;
  state.populationCap = popCap;
}

export function addChronicle(
  state: SimulationState,
  text: string,
  tone: ChronicleEvent['tone'] = 'divine',
  coords?: { x: number; z: number },
): void {
  if (state.chronicle.slice(0, 5).some((c) => c.text === text)) {
    return;
  }

  let resolvedX = coords?.x;
  let resolvedZ = coords?.z;

  // Smart fallback: extract explicit (x, z) from text, or locate mentioned settlement/kingdom/active event
  if (resolvedX === undefined || resolvedZ === undefined) {
    const coordMatch = text.match(/\((\d+),\s*(\d+)\)/);
    if (coordMatch) {
      resolvedX = Number(coordMatch[1]);
      resolvedZ = Number(coordMatch[2]);
    }
  }
  if ((resolvedX === undefined || resolvedZ === undefined) && state.settlementNames) {
    for (const [sid, sName] of Object.entries(state.settlementNames)) {
      if (sName && text.includes(sName)) {
        const b = state.buildings.find((bld) => bld.settlementId === sid);
        if (b) {
          resolvedX = b.tileX;
          resolvedZ = b.tileZ;
          break;
        }
      }
    }
  }
  if ((resolvedX === undefined || resolvedZ === undefined) && state.activeWorldEvent) {
    resolvedX = state.activeWorldEvent.targetX;
    resolvedZ = state.activeWorldEvent.targetZ;
  }

  state.chronicle = [
    {
      id: nextEntityId('chr'),
      yearLabel: formatYearLabel(state.year),
      text,
      tone,
      timestamp: Date.now(),
      ...(resolvedX !== undefined && resolvedZ !== undefined
        ? { x: Math.round(resolvedX), z: Math.round(resolvedZ) }
        : {}),
    },
    ...state.chronicle.slice(0, 119),
  ];
}

export function placeBuilding(
  state: SimulationState,
  buildingType: BuildingType,
  tileX: number,
  tileZ: number,
): { ok: boolean; reason?: string } {
  const def = BUILDINGS.find((b) => b.type === buildingType);
  if (!def) return { ok: false, reason: 'Unknown structure' };

  const tile = getTile(state, tileX, tileZ);
  if (!tile) return { ok: false, reason: 'Out of bounds' };
  if (tile.height < 0) {
    return { ok: false, reason: 'Invalid terrain height' };
  }
  if (tile.buildingId) {
    return { ok: false, reason: 'Tile already occupied by a structure' };
  }
  reconcileAndSyncResources(state);
  const nearby = findLocalSettlementBuilding(state, tile.x, tile.z, SETTLEMENT_AWARENESS_RADIUS);
  const candidateKingdomId = nearby?.settlementId ? getKingdomId(state, nearby.settlementId) : undefined;
  const checkBudget =
    candidateKingdomId && state.kingdomResources?.[candidateKingdomId] && Object.keys(state.kingdomResources).length === 1
      ? state.resources
      : state.resources;
  if (!canAfford(checkBudget, def.cost, state.sandboxFreeMode)) {
    return { ok: false, reason: 'Insufficient resources for construction' };
  }

  if (!state.sandboxFreeMode) {
    spendWorldCost(state, def.cost, candidateKingdomId);
  }

  reconcileKingdomEpochs(state, false);
  const settlementId = nearby?.settlementId ?? nextEntityId('city');
  if (!state.settlementNames) state.settlementNames = {};
  if (!state.settlementSpecies) state.settlementSpecies = {};
  if (!state.settlementKingdoms) state.settlementKingdoms = {};
  if (!state.kingdomEpochs) state.kingdomEpochs = {};
  if (!state.kingdomEpochProgress) state.kingdomEpochProgress = {};
  const species: SpeciesId = state.settlementSpecies[settlementId] ?? 'human';
  state.settlementSpecies[settlementId] = species;
  if (!state.settlementNames[settlementId]) {
    state.settlementNames[settlementId] = createVillageName(state, species);
    ensureWorldStats(state).citiesCreated += 1;
  }
  if (!state.settlementKingdoms[settlementId]) {
    state.settlementKingdoms[settlementId] = settlementId;
  }
  const resolvedPlaceKid = getKingdomId(state, settlementId);
  if (state.kingdomEpochs[resolvedPlaceKid] === undefined) {
    const explicitOverride = explicitEpochOverrideMap.get(state);
    state.kingdomEpochs[resolvedPlaceKid] =
      explicitOverride !== undefined ? clampEpochIndex(explicitOverride) : 0;
    state.kingdomEpochProgress[resolvedPlaceKid] =
      state.kingdomEpochs[resolvedPlaceKid] >= EPOCHS.length - 1 ? 100 : 0;
  }
  const placeKingdomEpoch = getKingdomEpoch(state, resolvedPlaceKid);
  ensureKingdomResources(state, resolvedPlaceKid);
  transferUnallocatedStockToKingdom(state, resolvedPlaceKid);
  syncStateResourcesFromKingdoms(state);

  const baseEpochIdx = Math.max(0, EPOCHS.findIndex((e) => e.id === def.epoch));
  const newBuilding: BuildingEntity = {
    id: nextEntityId('bld'),
    type: buildingType,
    settlementId,
    species,
    tileX: tile.x,
    tileZ: tile.z,
    hp: def.maxHp,
    maxHp: def.maxHp,
    constructionProgress: 100,
    epochLevel: placeKingdomEpoch === 0 ? 0 : Math.min(placeKingdomEpoch, baseEpochIdx),
    upgradeProgress: 0,
    blessedTimer: 0,
    cursedTimer: 0,
    shieldTimer: 0,
  };

  tile.buildingId = newBuilding.id;
  tile.resourceNode = 'none';
  tile.resourceAmount = 0;
  tile.farmSettlementId = undefined;
  if (tile.height === 0) {
    if (tile.terrain === 'stone_road' || tile.terrain === 'rail_track' || tile.terrain === 'runway') {
      tile.terrain = 'shallow_water';
    }
  } else if (tile.terrain === 'stone_road' || tile.terrain === 'runway') {
    tile.terrain = 'grass';
  }
  state.buildings.push(newBuilding);
  state.totalStructuresBuilt += 1;
  if (tile.height === 0 || newBuilding.epochLevel >= 1 || placeKingdomEpoch >= 1) {
    paveSettlementStreetsNear(state, tile.x, tile.z, settlementId);
  }
  if (buildingType === 'rail_station' || placeKingdomEpoch >= 3) {
    paveSettlementRailNetwork(state, settlementId);
  }
  if (buildingType === 'airport') {
    paveAirportRunwayForBuilding(state, tile.x, tile.z);
  }

  const placedKingdomId = getKingdomId(state, settlementId);
  for (const u of state.units) {
    if (u.faction === 'civilization' && u.state !== 'ko' && !u.settlementId && u.species === species) {
      if (Math.hypot(u.x - tile.x, u.z - tile.z) <= SETTLEMENT_AWARENESS_RADIUS) {
        u.settlementId = settlementId;
        u.kingdomId = placedKingdomId;
      }
    }
  }

  state.pendingVfx.push({
    id: nextEntityId('vfx'),
    type: 'build_complete',
    x: tile.x,
    y: tile.height * 0.45,
    z: tile.z,
    radius: 1.8,
    color: '#f5b742',
    createdAt: Date.now(),
  });

  const villageName = state.settlementNames[settlementId];
  addChronicle(state, `Constructed ${def.name} in ${villageName} at (${tile.x}, ${tile.z}).`, 'build');

  if (buildingType === 'dyson_spire' && placeKingdomEpoch < 7) {
    state.kingdomEpochs[placedKingdomId] = 7;
    state.kingdomEpochProgress[placedKingdomId] = 100;
    addChronicle(state, `${villageName}'s Dyson Ascension Relay pierces the heavens! Star Age achieved!`, 'epoch');
  }

  syncAverageEpochFromKingdoms(state);
  ensureSettlementKings(state);
  recalculateRatesAndCaps(state);
  return { ok: true };
}

export function spawnUnit(
  state: SimulationState,
  role: UnitRole,
  x: number,
  z: number,
  freeOverride = false,
  settlementIdOverride?: string,
  options?: {
    ageStage?: UnitAgeStage;
    appearanceSeed?: number;
    ageYears?: number;
    maxLifespan?: number;
    isBirth?: boolean;
  },
): { ok: boolean; reason?: string; unit?: UnitEntity } {
  const def = UNITS.find((u) => u.role === role);
  if (!def) return { ok: false, reason: 'Unknown unit role' };

  const tile = getTile(state, x, z);
  if (!tile) {
    return { ok: false, reason: 'Out of bounds' };
  }
  if (role === 'leviathan' && tile.height > 0) {
    return { ok: false, reason: 'Leviathan can only spawn in the sea' };
  }

  reconcileAndSyncResources(state);
  const isFree = freeOverride || state.sandboxFreeMode || def.faction === 'hostile';
  if (!isFree && !canAfford(state.resources, def.cost, false)) {
    return { ok: false, reason: 'Insufficient resources to train unit' };
  }

  if (!isFree) {
    spendWorldCost(state, def.cost);
  }

  const species: SpeciesId =
    def.species ??
    (role === 'elf'
      ? 'elf'
      : role === 'orc'
        ? 'orc'
        : role === 'dwarf'
          ? 'dwarf'
          : role === 'lizardfolk'
            ? 'lizardfolk'
            : 'human');

  let resolvedSettlementId = settlementIdOverride;
  if (def.faction === 'civilization' && !resolvedSettlementId) {
    const nearbyBld = findLocalSettlementBuilding(state, tile.x, tile.z, SETTLEMENT_AWARENESS_RADIUS);
    if (nearbyBld?.settlementId) {
      const bSpecies = state.settlementSpecies?.[nearbyBld.settlementId] ?? 'human';
      if (bSpecies === species) {
        resolvedSettlementId = nearbyBld.settlementId;
      }
    }
  }
  const resolvedKingdomId = resolvedSettlementId ? getKingdomId(state, resolvedSettlementId) : undefined;

  const appearanceSeed =
    options?.appearanceSeed ??
    (Math.abs(
      (Math.floor(Math.random() * 0x7fffffff) ^
        Math.imul(state.units.length + 1, 2654435761) ^
        Math.imul(Math.round(x) + 17, 73856093) ^
        Math.imul(Math.round(z) + 31, 19349663)) |
        1,
    ) >>>
      0);

  let ageStage: UnitAgeStage = options?.ageStage ?? 'adult';
  if (!options?.ageStage && def.faction === 'civilization' && resolvedSettlementId) {
    const isBasicRaceRole =
      role === 'human' ||
      role === 'elf' ||
      role === 'orc' ||
      role === 'dwarf' ||
      role === 'lizardfolk' ||
      role === 'villager';
    const adultSameSpeciesCount = state.units.filter(
      (u) =>
        u.faction === 'civilization' &&
        u.species === species &&
        u.state !== 'ko' &&
        u.ageStage !== 'child',
    ).length;
    if (isBasicRaceRole && adultSameSpeciesCount >= 3 && Math.random() < 0.34) {
      ageStage = 'child';
    }
  }

  const growthTimer = ageStage === 'child' ? 12 + (appearanceSeed % 7) : undefined;

  const dinoDiet = role === 'dinosaur' ? getDinosaurVariant(appearanceSeed).diet : undefined;
  const generatedName =
    def.faction === 'hostile'
      ? def.name
      : createUniqueUnitName(state, role, species, dinoDiet);

  const genes = generateUnitGenes(role, species, appearanceSeed, dinoDiet);
  const traits = generateUnitTraits(role, species, appearanceSeed);
  const items = generateUnitItems(
    role,
    species,
    resolvedKingdomId ? getKingdomEpoch(state, resolvedKingdomId) : 0,
    appearanceSeed,
    dinoDiet,
  );
  const effInit = computeUnitEffectiveStats(
    {
      role,
      species,
      ageStage,
      traits,
      genes,
      items,
      statusEffects: {},
    },
    def,
  );
  const maxHp = effInit.maxHp;
  const baseMaxLifespan = getUnitMaxLifespan({
    role,
    species,
    appearanceSeed,
    genes,
    maxLifespan: options?.maxLifespan,
  });
  const maxLifespan =
    options?.maxLifespan !== undefined
      ? baseMaxLifespan
      : Math.max(10, Math.round(baseMaxLifespan + effInit.lifespanBonus));

  const isOpenWaterTile =
    tile.height === 0 &&
    tile.terrain !== 'ice' &&
    tile.terrain !== 'stone_road' &&
    tile.terrain !== 'rail_track' &&
    tile.terrain !== 'runway' &&
    !tile.buildingId &&
    role !== 'dragon' &&
    role !== 'leviathan' &&
    role !== 'alien_ufo';

  const unit: UnitEntity = {
    id: nextEntityId('unit'),
    name: generatedName,
    role,
    species,
    faction: def.faction,
    settlementId: resolvedSettlementId,
    kingdomId: resolvedKingdomId,
    ageStage,
    growthTimer,
    appearanceSeed,
    x: tile.x + (Math.random() - 0.5) * 0.35,
    z: tile.z + (Math.random() - 0.5) * 0.35,
    targetX: tile.x,
    targetZ: tile.z,
    hp: maxHp,
    maxHp,
    state: 'idle',
    koTimer: 0,
    statusEffects: {},
    carryingType: null,
    carryingAmount: 0,
    actionCooldown: 0,
    windupTimer: 0,
    targetEntityId: null,
    harvestTimer: 0,
    favorite: false,
    traits,
    genes,
    items,
    bornYear: state.year,
    ageYears: Math.max(0, options?.ageYears ?? 0),
    maxLifespan,
    kills: 0,
    swimStamina: 100,
    isSwimming: isOpenWaterTile,
    altitude: role === 'alien_ufo' ? 4.6 : 0,
    leviathanSubmerged: role === 'leviathan' ? true : undefined,
    leviathanSurfaceTimer: role === 'leviathan' ? 10 + (appearanceSeed % 8) : undefined,
    leviathanBeamTimer: role === 'leviathan' ? 0 : undefined,
    leviathanBeamCooldown: role === 'leviathan' ? 4 : undefined,
    leviathanLeapTimer: role === 'leviathan' ? 0 : undefined,
    leviathanLeapCooldown: role === 'leviathan' ? 6 : undefined,
    leviathanEatIslandCooldown: role === 'leviathan' ? 45 + (appearanceSeed % 35) : undefined,
  };

  state.units.push(unit);
  const wStats = ensureWorldStats(state);
  if (options?.isBirth) {
    wStats.totalBirths += 1;
  }
  if (def.category === 'animal') {
    wStats.wildlifeSpawned += 1;
  } else if (def.category === 'mythical' || MYTHICAL_ROLE_SET.has(role)) {
    wStats.mythicalSpawned += 1;
  }
  if (def.faction === 'hostile') {
    wStats.hostilesSpawned += 1;
  }
  if (def.faction === 'civilization') {
    ensureSettlementKings(state);
  }
  recalculateRatesAndCaps(state);
  return { ok: true, unit };
}

export function isCultivableSoil(t: TileData): boolean {
  if (t.height <= 0 || t.height >= 6) return false;
  if (t.onFireTimer > 0 || t.cursedTimer > 0) return false;
  return (
    t.terrain === 'grass' ||
    t.terrain === 'fertile' ||
    t.terrain === 'forest' ||
    t.terrain === 'savanna' ||
    t.terrain === 'jungle' ||
    t.terrain === 'blossom' ||
    t.terrain === 'floral_plains' ||
    t.terrain === 'taiga'
  );
}

export function isHealthyTreeSoil(t: TileData): boolean {
  if (isCultivableSoil(t)) return true;
  if (t.height <= 0 || t.height >= 6) return false;
  if (t.onFireTimer > 0 || t.cursedTimer > 0) return false;
  return (
    t.terrain === 'swamp' ||
    t.terrain === 'highland' ||
    t.terrain === 'volcanic_wasteland' ||
    t.terrain === 'blighted_mire'
  );
}

function isBlossomSoil(t: TileData): boolean {
  if (t.height <= 0 || t.height >= 6) return false;
  return (
    t.terrain === 'grass' ||
    t.terrain === 'fertile' ||
    t.terrain === 'forest' ||
    t.terrain === 'savanna' ||
    t.terrain === 'jungle' ||
    t.terrain === 'blossom' ||
    t.terrain === 'floral_plains' ||
    t.terrain === 'taiga'
  );
}

function getBiomeResourceDeposit(
  terrain: TerrainType,
  toolType: 'boulder_rain' | 'seed_ore' | 'crystal_shower',
  x: number,
  z: number,
): { node: TileData['resourceNode']; amount: number } {
  if (toolType === 'boulder_rain') {
    if (terrain === 'mountain' || terrain === 'rock' || terrain === 'highland' || terrain === 'volcanic_wasteland') {
      return { node: 'stone_outcrop', amount: 440 };
    }
    if (terrain === 'scorched' || terrain === 'badlands' || terrain === 'blighted_mire') {
      return { node: 'stone_outcrop', amount: 400 };
    }
    if (terrain === 'snow' || terrain === 'tundra' || terrain === 'floral_plains') {
      return { node: 'stone_outcrop', amount: 360 };
    }
    if (terrain === 'sand' || terrain === 'savanna') {
      return { node: 'stone_outcrop', amount: 320 };
    }
    return { node: 'stone_outcrop', amount: 300 };
  }
  if (toolType === 'seed_ore') {
    if (terrain === 'crystal_field') {
      return { node: 'crystal_monolith', amount: 440 };
    }
    if (terrain === 'mountain' || terrain === 'rock' || terrain === 'scorched' || terrain === 'volcanic_wasteland') {
      return {
        node: (x + z) % 4 === 0 ? 'crystal_monolith' : 'ore_vein',
        amount: 420,
      };
    }
    if (terrain === 'badlands' || terrain === 'sand' || terrain === 'highland' || terrain === 'blighted_mire') {
      return { node: 'ore_vein', amount: 360 };
    }
    if (terrain === 'snow' || terrain === 'tundra' || terrain === 'floral_plains') {
      return {
        node: (x + z) % 4 === 0 ? 'crystal_monolith' : 'ore_vein',
        amount: 340,
      };
    }
    return { node: 'ore_vein', amount: 300 };
  }
  // crystal_shower
  if (terrain === 'crystal_field' || terrain === 'mountain' || terrain === 'snow' || terrain === 'floral_plains') {
    return { node: 'crystal_monolith', amount: 480 };
  }
  if (terrain === 'rock' || terrain === 'scorched' || terrain === 'blossom' || terrain === 'volcanic_wasteland' || terrain === 'blighted_mire') {
    return { node: 'crystal_monolith', amount: 420 };
  }
  return { node: 'crystal_monolith', amount: 360 };
}

function raiseWaterTileToLand(t: TileData, terrain: TerrainType, height = 1): void {
  t.height = Math.max(1, Math.min(10, height));
  t.terrain = terrain;
  t.isRiver = false;
  delete t.waterKind;
  delete t.frozenWaterBase;
  delete t.coralBleachTimer;
  t.onFireTimer = 0;
  t.cursedTimer = 0;
  clearBurntTreeState(t);
  delete t.treeBiomeOverride;
  if (
    t.resourceNode === 'coral_reef' ||
    t.resourceNode === 'scrap_flotsam' ||
    t.resourceNode === 'atlantis_ruin'
  ) {
    t.resourceNode = 'none';
    t.resourceAmount = 0;
  }
}

export function canApplyTerrainToolToTile(
  t: TileData,
  toolType: TerrainToolType,
  _centerHeight = t.height,
): boolean {
  switch (toolType) {
    case 'raise':
    case 'lower':
    case 'flatten':
    case 'carve_river':
    case 'lava_river':
    case 'poison_river':
    case 'abyssal_trench':
    case 'alpine_glacier':
    case 'volcanic_obsidian':
    case 'volcanic_wasteland':
    case 'canyon_carve':
    case 'mesa_plateau':
    case 'volcanic_crater':
    case 'smooth_terrain':
    case 'island_bridge':
      return true;
    case 'water_drop':
    case 'lava_drop':
    case 'poison_drop':
      return !t.buildingId;
    case 'seed_ore':
    case 'crystal_shower':
    case 'boulder_rain':
      return t.height > 0 && !t.buildingId;
    case 'stone_road':
    case 'rail_track':
      return t.height >= 0 && !t.buildingId;
    case 'fertile_meadow':
      return isCultivableSoil(t);
    case 'plant_forest':
      return isHealthyTreeSoil(t) && !t.buildingId;
    case 'blossom_rain':
    case 'floral_rain':
      return isBlossomSoil(t) || (toolType === 'floral_rain' && t.height > 0 && !t.buildingId);
    case 'jungle_bloom':
      return isCultivableSoil(t) || (t.height > 0 && t.terrain === 'swamp');
    case 'soil_enrich':
      return t.height > 0 && !t.buildingId && (t.terrain !== 'fertile' || t.cursedTimer > 0 || t.onFireTimer > 0);
    case 'desert_dunes':
      return t.height > 0 && t.height <= 4;
    case 'coral_reef_rain':
      return t.height === 0;
    case 'salvage_drop':
      return !t.buildingId;
    case 'atlantis_rise':
      return t.height === 0 && !t.buildingId;
    case 'swamp_mire':
    case 'blighted_mire':
    case 'floral_plains':
      return t.height > 0 && !t.buildingId;
  }
}

function applyTerrainToolTileMutation(
  t: TileData,
  toolType: TerrainToolType,
  targetFlattenHeight: number,
  _centerHeight: number,
  normDist = 0,
  state?: SimulationState,
): boolean {
  let tileModified = false;
  switch (toolType) {
        case 'raise': {
          // Organic feathered rim so sculpted hills & coastlines feel hand-painted rather than stamped circles
          if (normDist > 0.84 && (((t.x * 13 + t.z * 29) & 3) === 0)) {
            break;
          }
          tileModified = true;
          if (t.height === 0) {
            if (normDist <= 0.55) {
              raiseWaterTileToLand(t, 'grass', 2);
            } else {
              raiseWaterTileToLand(t, 'sand', 1);
            }
          } else {
            const liftStep = normDist <= 0.32 && t.height < 8 ? 2 : 1;
            t.height = Math.min(10, t.height + liftStep);
            if (t.height >= 8) {
              t.terrain = 'snow';
              if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
                delete t.treeBiomeOverride;
              }
            } else if (t.height >= 5) {
              if (
                t.terrain !== 'scorched' &&
                t.terrain !== 'volcanic_wasteland' &&
                t.terrain !== 'crystal_field' &&
                t.terrain !== 'rock' &&
                t.terrain !== 'badlands'
              ) {
                t.terrain = 'mountain';
              }
              if (t.resourceNode === 'berry_bush') {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            } else if (t.height >= 2 && t.terrain === 'sand') {
              t.terrain = 'grass';
            }
          }
          break;
        }
        case 'lower': {
          if (normDist > 0.84 && (((t.x * 17 + t.z * 23) & 3) === 0)) {
            break;
          }
          tileModified = true;
          if (t.height === 0) {
            if (t.terrain !== 'deep_water') {
              t.terrain = 'deep_water';
            }
          } else {
            t.height = Math.max(0, t.height - 1);
            if (t.height === 0) {
              t.terrain = 'shallow_water';
              delete t.waterKind;
              delete t.frozenWaterBase;
              t.isRiver = false;
              t.isLake = false;
              t.resourceNode = 'none';
              t.resourceAmount = 0;
              t.onFireTimer = 0;
              clearBurntTreeState(t);
              delete t.treeBiomeOverride;
            } else if (t.height <= 7 && t.terrain === 'snow') {
              t.terrain = 'mountain';
            } else if (t.height <= 4 && (t.terrain === 'rock' || t.terrain === 'mountain')) {
              t.terrain = 'highland';
            }
          }
          break;
        }
    case 'flatten': {
      if (t.height === 0) {
        const raisedTerrain: TerrainType =
          targetFlattenHeight >= 8
            ? 'snow'
            : targetFlattenHeight >= 5
              ? 'mountain'
              : targetFlattenHeight >= 2
                ? 'grass'
                : 'sand';
        raiseWaterTileToLand(t, raisedTerrain, targetFlattenHeight);
        tileModified = true;
      } else if (t.height > 0) {
        t.height = targetFlattenHeight;
        if (t.height >= 8) t.terrain = 'snow';
        else if (t.height >= 5 && t.terrain !== 'scorched' && t.terrain !== 'volcanic_wasteland' && t.terrain !== 'badlands' && t.terrain !== 'rock') {
          t.terrain = 'mountain';
        } else if (
          t.height < 5 &&
          (t.terrain === 'snow' || t.terrain === 'rock' || t.terrain === 'mountain')
        ) {
          t.terrain = 'highland';
        }
        tileModified = true;
      }
      break;
    }
        case 'stone_road': {
          if (t.height >= 0 && !t.buildingId) {
            t.terrain = 'stone_road';
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            tileModified = true;
          }
          break;
        }
        case 'rail_track': {
          if (t.height >= 0 && !t.buildingId) {
            t.terrain = 'rail_track';
            t.farmSettlementId = undefined;
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            tileModified = true;
          }
          break;
        }
        case 'fertile_meadow': {
          if (isCultivableSoil(t)) {
            t.terrain = 'fertile';
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            if (!t.buildingId) {
              t.resourceNode = 'berry_bush';
              t.resourceAmount = 220;
            }
            tileModified = true;
          }
          break;
        }
        case 'plant_forest': {
          if (isHealthyTreeSoil(t) && !t.buildingId) {
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            t.resourceNode = 'timber_grove';
            t.resourceAmount = 260;
            tileModified = true;
          }
          break;
        }
        case 'seed_ore': {
          if (t.height > 0 && !t.buildingId) {
            const deposit = getBiomeResourceDeposit(t.terrain, 'seed_ore', t.x, t.z);
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            t.resourceNode = deposit.node;
            t.resourceAmount = deposit.amount;
            tileModified = true;
          }
          break;
        }
        case 'crystal_shower': {
          if (t.height > 0 && !t.buildingId) {
            const deposit = getBiomeResourceDeposit(t.terrain, 'crystal_shower', t.x, t.z);
            t.onFireTimer = 0;
            t.cursedTimer = 0;
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            t.resourceNode = deposit.node;
            t.resourceAmount = deposit.amount;
            tileModified = true;
          }
          break;
        }
        case 'boulder_rain': {
          if (t.height > 0 && !t.buildingId) {
            const deposit = getBiomeResourceDeposit(t.terrain, 'boulder_rain', t.x, t.z);
            t.onFireTimer = 0;
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            t.resourceNode = deposit.node;
            t.resourceAmount = deposit.amount;
            tileModified = true;
          }
          break;
        }
        case 'blossom_rain': {
          if (isBlossomSoil(t)) {
            t.onFireTimer = 0;
            t.cursedTimer = 0;
            clearBurntTreeState(t);
            t.blessedTimer = Math.max(t.blessedTimer, 18);
            if (!t.buildingId) {
              const isBerry = (t.x + t.z) % 3 === 0;
              t.resourceNode = isBerry ? 'berry_bush' : 'timber_grove';
              t.resourceAmount = 280;
              if (isBerry) {
                delete t.treeBiomeOverride;
              } else {
                t.treeBiomeOverride = 'blossom';
              }
            }
            tileModified = true;
          }
          break;
        }
        case 'floral_rain': {
          if (t.height > 0 && !t.buildingId) {
            t.terrain = 'floral_plains';
            t.onFireTimer = 0;
            t.cursedTimer = 0;
            clearBurntTreeState(t);
            t.blessedTimer = Math.max(t.blessedTimer, 22);
            const roll = (t.x * 7 + t.z * 11) % 6;
            if (roll === 0) {
              t.resourceNode = 'stone_outcrop';
              t.resourceAmount = 260;
              delete t.treeBiomeOverride;
            } else if (roll <= 2) {
              t.resourceNode = 'berry_bush';
              t.resourceAmount = 260;
              delete t.treeBiomeOverride;
            } else {
              t.resourceNode = 'timber_grove';
              t.resourceAmount = 300;
              t.treeBiomeOverride = 'floral';
            }
            tileModified = true;
          }
          break;
        }
        case 'jungle_bloom': {
          if (isCultivableSoil(t) || (t.height > 0 && t.terrain === 'swamp')) {
            t.terrain = 'jungle';
            t.onFireTimer = 0;
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            if (!t.buildingId) {
              t.resourceNode = (t.x + t.z) % 4 === 0 ? 'berry_bush' : 'timber_grove';
              t.resourceAmount = 300;
            }
            tileModified = true;
          }
          break;
        }
        case 'soil_enrich': {
          if (t.height > 0 && !t.buildingId) {
            if (t.terrain !== 'fertile' || t.cursedTimer > 0 || t.onFireTimer > 0) {
              t.terrain = 'fertile';
              t.onFireTimer = 0;
              t.cursedTimer = 0;
              t.blessedTimer = Math.max(t.blessedTimer, 14);
              clearBurntTreeState(t);
              delete t.treeBiomeOverride;
              tileModified = true;
            }
          }
          break;
        }
        case 'desert_dunes': {
          if (t.height > 0 && t.height <= 4) {
            t.terrain = 'sand';
            t.onFireTimer = 0;
            delete t.treeBiomeOverride;
            t.tempOffset = Math.max(t.tempOffset ?? 0, 18);
            if (!t.buildingId) {
              if ((t.x * 3 + t.z * 5) % 9 === 0) {
                t.resourceNode = 'berry_bush';
                t.resourceAmount = 170;
              } else {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            }
            tileModified = true;
          }
          break;
        }
        case 'volcanic_obsidian': {
          if (t.height === 0) {
            raiseWaterTileToLand(t, 'scorched', 1);
          } else {
            t.terrain = 'scorched';
            delete t.treeBiomeOverride;
          }
          t.tempOffset = Math.min(60, (t.tempOffset ?? 0) + 25);
          if (!t.buildingId) {
            t.resourceNode = (t.x + t.z) % 2 === 0 ? 'ore_vein' : 'stone_outcrop';
            t.resourceAmount = 380;
          }
          tileModified = true;
          break;
        }
        case 'volcanic_wasteland': {
          if (t.height === 0) {
            raiseWaterTileToLand(t, 'volcanic_wasteland', 1);
          } else {
            t.terrain = 'volcanic_wasteland';
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
          }
          t.tempOffset = Math.min(65, Math.max(t.tempOffset ?? 0, 26));
          if (!t.buildingId) {
            const roll = (t.x * 13 + t.z * 17) % 7;
            if (roll <= 1) {
              t.resourceNode = 'timber_grove';
              t.resourceAmount = 240;
            } else if (roll === 2) {
              t.resourceNode = 'ore_vein';
              t.resourceAmount = 360;
            } else if (roll === 3) {
              t.resourceNode = 'stone_outcrop';
              t.resourceAmount = 310;
            } else {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
          }
          tileModified = true;
          break;
        }
        case 'blighted_mire': {
          if (t.height > 0 && !t.buildingId) {
            if (t.height > 3) t.height = 3;
            t.terrain = 'blighted_mire';
            t.onFireTimer = 0;
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            const roll = (t.x * 11 + t.z * 19) % 7;
            if (roll <= 2) {
              t.resourceNode = 'timber_grove';
              t.resourceAmount = 230;
            } else if (roll === 3) {
              t.resourceNode = 'stone_outcrop';
              t.resourceAmount = 270;
            } else if (roll === 4) {
              t.resourceNode = 'ore_vein';
              t.resourceAmount = 300;
            } else {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            tileModified = true;
          }
          break;
        }
        case 'floral_plains': {
          if (t.height > 0 && !t.buildingId) {
            t.terrain = 'floral_plains';
            t.onFireTimer = 0;
            t.cursedTimer = 0;
            t.blessedTimer = Math.max(t.blessedTimer, 18);
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            const roll = (t.x * 9 + t.z * 13) % 8;
            if (roll <= 2) {
              t.resourceNode = 'timber_grove';
              t.resourceAmount = 270;
            } else if (roll <= 4) {
              t.resourceNode = 'berry_bush';
              t.resourceAmount = 240;
            } else if (roll === 5) {
              t.resourceNode = 'stone_outcrop';
              t.resourceAmount = 250;
            } else {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            tileModified = true;
          }
          break;
        }
        case 'coral_reef_rain': {
          if (t.height === 0) {
            if (t.terrain === 'ice') {
              t.terrain = t.frozenWaterBase ?? 'shallow_water';
              delete t.frozenWaterBase;
            }
            delete t.coralBleachTimer;
            t.resourceNode = 'coral_reef';
            t.resourceAmount = 320;
            tileModified = true;
          }
          break;
        }
        case 'salvage_drop': {
          if (!t.buildingId) {
            if (t.height === 0) {
              if (t.terrain === 'ice') {
                t.terrain = t.frozenWaterBase ?? 'shallow_water';
                delete t.frozenWaterBase;
              }
              t.resourceNode = 'scrap_flotsam';
              t.resourceAmount = 300;
            } else {
              delete t.treeBiomeOverride;
              t.resourceNode = (t.x + t.z) % 2 === 0 ? 'ore_vein' : 'stone_outcrop';
              t.resourceAmount = 340;
            }
            tileModified = true;
          }
          break;
        }
        case 'carve_river': {
          tileModified = true;
          if (t.height === 0 && t.waterKind === 'lava') {
            // Water poured onto lava quenches it directly into steaming water
            t.height = 0;
            t.terrain = 'shallow_water';
            delete t.waterKind;
            t.isRiver = true;
            t.isLake = false;
            t.onFireTimer = 0;
            if ((t.tempOffset ?? 0) > 0) {
              t.tempOffset = Math.max(0, (t.tempOffset ?? 0) - 28);
            }
          } else if (t.height >= 3) {
            t.height = Math.max(1, t.height - 2);
            if (t.terrain === 'snow' || t.terrain === 'rock') t.terrain = 'rock';
          } else {
            t.height = 0;
            t.terrain = 'shallow_water';
            t.isRiver = true;
            delete t.waterKind;
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.onFireTimer = 0;
            delete t.treeBiomeOverride;
          }
          break;
        }
        case 'water_drop': {
          if (t.buildingId) break;
          tileModified = true;
          if (t.height === 0 && t.waterKind === 'lava') {
            t.height = 0;
            t.terrain = 'shallow_water';
            delete t.waterKind;
            t.isRiver = false;
            t.isLake = true;
            t.onFireTimer = 0;
            if ((t.tempOffset ?? 0) > 0) {
              t.tempOffset = Math.max(0, (t.tempOffset ?? 0) - 24);
            }
          } else if (t.height === 0 && t.waterKind === 'poison') {
            t.height = 0;
            t.terrain = 'shallow_water';
            delete t.waterKind;
            t.isRiver = false;
            t.isLake = true;
            t.onFireTimer = 0;
          } else {
            t.height = 0;
            t.terrain = 'shallow_water';
            t.isLake = true;
            t.isRiver = false;
            delete t.waterKind;
            delete t.frozenWaterBase;
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.onFireTimer = 0;
            t.crushedTimer = 0;
            t.farmSettlementId = undefined;
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            if ((t.tempOffset ?? 0) > 0) {
              t.tempOffset = Math.max(0, (t.tempOffset ?? 0) - 18);
            }
          }
          break;
        }
        case 'lava_drop': {
          tileModified = true;
          if (state) specialLiquidPossibleByState.set(state, true);
          if (t.height === 0 && t.waterKind === 'poison') {
            // Lava + Poison -> violent corrosive crater!
            t.height = 0;
            t.terrain = 'scorched';
            delete t.waterKind;
            t.isRiver = false;
            t.isLake = false;
            t.cursedTimer = Math.max(t.cursedTimer, 10);
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          } else if (t.height === 0 && !t.waterKind) {
            // Lava dropped onto ocean/lake/river/ice solidifies into Stone!
            t.height = 1;
            t.terrain = 'rock';
            delete t.waterKind;
            delete t.frozenWaterBase;
            delete t.liquidLevel;
            delete t.liquidKind;
            t.isRiver = false;
            t.isLake = false;
            t.onFireTimer = 0;
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.tempOffset = Math.min(35, (t.tempOffset ?? 0) + 12);
            if (state && state.pendingVfx.length < 48) {
              state.pendingVfx.push({
                id: nextEntityId('vfx'),
                type: 'hit_spark',
                x: t.x,
                y: 0.72,
                z: t.z,
                radius: 1.4,
                color: '#e2e8f0',
                createdAt: Date.now(),
              });
            }
          } else {
            t.height = 0;
            t.terrain = 'shallow_water';
            t.waterKind = 'lava';
            t.isRiver = true;
            t.isLake = false;
            delete t.frozenWaterBase;
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.onFireTimer = 0;
            t.crushedTimer = 0;
            t.farmSettlementId = undefined;
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
            t.tempOffset = Math.min(80, Math.max(t.tempOffset ?? 0, 35));
          }
          break;
        }
        case 'lava_river': {
          tileModified = true;
          if (state) specialLiquidPossibleByState.set(state, true);
          if (t.height === 0 && t.waterKind === 'poison') {
            // Lava + Poison -> violent corrosive crater!
            t.height = 0;
            t.terrain = 'scorched';
            delete t.waterKind;
            t.isRiver = false;
            t.isLake = false;
            t.cursedTimer = Math.max(t.cursedTimer, 10);
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          } else if (t.height === 0 && !t.waterKind && t.terrain !== 'ice') {
            // Lava poured into active water quenches immediately into steaming water
            t.height = 0;
            t.terrain = 'shallow_water';
            delete t.waterKind;
            t.isRiver = false;
            t.isLake = false;
            t.onFireTimer = 0;
            t.tempOffset = Math.min(25, (t.tempOffset ?? 0) + 10);
          } else {
            t.height = 0;
            t.terrain = 'shallow_water';
            t.waterKind = 'lava';
            t.isRiver = true;
            t.tempOffset = Math.min(80, Math.max(t.tempOffset ?? 0, 35));
            delete t.frozenWaterBase;
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.onFireTimer = 0;
            t.farmSettlementId = undefined;
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
          }
          break;
        }
        case 'poison_drop':
        case 'poison_river': {
          tileModified = true;
          if (state) specialLiquidPossibleByState.set(state, true);
          if (t.height === 0 && t.waterKind === 'lava') {
            // Poison + Lava -> violent corrosive crater!
            t.height = 0;
            t.terrain = 'scorched';
            delete t.waterKind;
            t.isRiver = false;
            t.isLake = false;
            t.cursedTimer = Math.max(t.cursedTimer, 10);
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          } else {
            t.height = 0;
            t.terrain = 'shallow_water';
            t.waterKind = 'poison';
            t.isRiver = true;
            delete t.frozenWaterBase;
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.onFireTimer = 0;
            t.farmSettlementId = undefined;
            clearBurntTreeState(t);
            delete t.treeBiomeOverride;
          }
          break;
        }
        case 'abyssal_trench': {
          if (t.height === 0 && t.waterKind === 'lava') {
            t.height = 0;
            t.terrain = 'deep_water';
            delete t.waterKind;
            t.isRiver = false;
            t.isLake = false;
            t.onFireTimer = 0;
            if ((t.tempOffset ?? 0) > 0) {
              t.tempOffset = Math.max(0, (t.tempOffset ?? 0) - 28);
            }
            tileModified = true;
            break;
          }
          t.height = 0;
          t.terrain = 'deep_water';
          t.isRiver = false;
          delete t.waterKind;
          delete t.frozenWaterBase;
          t.resourceNode = 'none';
          t.resourceAmount = 0;
          t.onFireTimer = 0;
          t.farmSettlementId = undefined;
          delete t.treeBiomeOverride;
          tileModified = true;
          break;
        }
        case 'atlantis_rise': {
          if (t.height === 0 && !t.buildingId) {
            delete t.frozenWaterBase;
            delete t.coralBleachTimer;
            t.terrain = 'shallow_water';
            t.resourceNode = 'atlantis_ruin';
            t.resourceAmount = 400;
            tileModified = true;
          }
          break;
        }
        case 'alpine_glacier': {
          tileModified = true;
          t.tempOffset = -35;
          t.onFireTimer = 0;
          if (t.height === 0) {
            if (t.terrain !== 'ice') {
              t.frozenWaterBase = t.terrain === 'deep_water' ? 'deep_water' : 'shallow_water';
            }
            t.terrain = 'ice';
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          } else {
            t.height = Math.min(10, Math.max(5, t.height + 2));
            t.terrain = t.height >= 7 ? 'snow' : 'mountain';
            if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
              delete t.treeBiomeOverride;
            }
          }
          break;
        }
        case 'swamp_mire': {
          if (t.height > 0 && !t.buildingId) {
            if (t.height > 2) t.height = 2;
            t.terrain = 'swamp';
            t.onFireTimer = 0;
            delete t.treeBiomeOverride;
            if (t.resourceNode === 'stone_outcrop' || t.resourceNode === 'ore_vein' || t.resourceNode === 'berry_bush') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            tileModified = true;
          }
          break;
        }
        case 'canyon_carve': {
          if (t.height > 0 && !t.buildingId) {
            const drop = normDist <= 0.55 ? 3 : 1;
            t.height = Math.max(1, t.height - drop);
            t.terrain = normDist <= 0.45 ? 'rock' : 'badlands';
            if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
              delete t.treeBiomeOverride;
            }
            tileModified = true;
          }
          break;
        }
        case 'mesa_plateau': {
          if (!t.buildingId) {
            if (t.height === 0) raiseWaterTileToLand(t, 'badlands', 1);
            const targetH = normDist <= 0.62
              ? Math.min(9, Math.max(5, targetFlattenHeight + 3))
              : Math.min(7, Math.max(3, targetFlattenHeight + 1));
            t.height = Math.max(t.height, targetH);
            t.terrain = normDist <= 0.62 ? 'badlands' : 'highland';
            if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
              delete t.treeBiomeOverride;
            }
            tileModified = true;
          }
          break;
        }
        case 'volcanic_crater': {
          if (!t.buildingId) {
            if (t.height === 0) raiseWaterTileToLand(t, 'rock', 1);
            if (normDist <= 0.52) {
              t.height = Math.max(1, targetFlattenHeight - 2);
              t.terrain = 'rock';
            } else {
              t.height = Math.min(9, Math.max(t.height, targetFlattenHeight + 2));
              t.terrain = t.height >= 5 ? 'mountain' : 'rock';
            }
            if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
              delete t.treeBiomeOverride;
            }
            tileModified = true;
          }
          break;
        }
        case 'smooth_terrain': {
          if (state && !t.buildingId) {
            let sum = 0;
            let cnt = 0;
            for (let oz = -1; oz <= 1; oz++) {
              for (let ox = -1; ox <= 1; ox++) {
                const nt = getTile(state, t.x + ox, t.z + oz);
                if (nt) {
                  sum += nt.height;
                  cnt++;
                }
              }
            }
            if (cnt > 0) {
              const avg = Math.round(sum / cnt);
              if (avg !== t.height) {
                if (t.height === 0 && avg > 0) {
                  raiseWaterTileToLand(t, 'sand', avg);
                } else if (t.height > 0 && avg === 0) {
                  t.height = 0;
                  t.terrain = 'shallow_water';
                  delete t.waterKind;
                  delete t.frozenWaterBase;
                  t.isRiver = false;
                  t.isLake = false;
                  t.onFireTimer = 0;
                  t.resourceNode = 'none';
                  t.resourceAmount = 0;
                } else {
                  t.height = avg;
                }
                tileModified = true;
              }
            }
          }
          break;
        }
        case 'island_bridge': {
          if (t.height === 0 && !t.buildingId) {
            raiseWaterTileToLand(t, 'stone_road', 1);
            tileModified = true;
          }
          break;
        }
      }
  return tileModified;
}

export type LiquidKind = 'water' | 'lava' | 'poison';

function getTileLiquidKind(t: TileData): LiquidKind | null {
  if ((t.liquidLevel ?? 0) > t.height) {
    return t.liquidKind ?? 'water';
  }
  if (t.height !== 0) return null;
  if (t.waterKind === 'lava') return 'lava';
  if (t.waterKind === 'poison') return 'poison';
  if (t.terrain === 'shallow_water' || t.terrain === 'deep_water') return 'water';
  return null;
}

function getTileSurfaceHeight(t: TileData): number {
  return Math.max(t.height, t.liquidLevel ?? 0);
}

function applyElevatedLiquidToTile(
  state: SimulationState,
  t: TileData,
  level: number,
  kind: LiquidKind,
): boolean {
  if (t.buildingId) return false;
  const clampedLevel = Math.max(t.height + 0.05, Math.min(10, level));
  const existingElevated = (t.liquidLevel ?? 0) > t.height ? (t.liquidKind ?? 'water') : null;
  const existingSea = t.height === 0 ? getTileLiquidKind(t) : null;
  const existing = existingElevated ?? existingSea;

  if (kind === 'lava' || kind === 'poison') {
    specialLiquidPossibleByState.set(state, true);
  }

  let finalKind: LiquidKind = kind;
  if ((existing === 'lava' && kind === 'poison') || (existing === 'poison' && kind === 'lava')) {
    // Violent corrosive reaction clears the pool on this tile and scorches the floor
    delete t.liquidLevel;
    delete t.liquidKind;
    t.terrain = 'scorched';
    t.cursedTimer = Math.max(t.cursedTimer, 10);
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    syncTileToWorldGrid(ensureWorldGrid(state), t);
    return true;
  } else if ((existing === 'lava' && kind === 'water') || (existing === 'water' && kind === 'lava')) {
    // Lava + Water solidifies into Stone with steam!
    delete t.liquidLevel;
    delete t.liquidKind;
    t.height = Math.max(1, Math.min(10, t.height));
    t.terrain = 'rock';
    t.onFireTimer = 0;
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    t.tempOffset = Math.min(35, Math.max(0, (t.tempOffset ?? 0) + (kind === 'lava' ? 12 : -18)));
    syncTileToWorldGrid(ensureWorldGrid(state), t);
    if (state.pendingVfx.length < 48) {
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'hit_spark',
        x: t.x,
        y: t.height * 0.45 + 0.35,
        z: t.z,
        radius: 1.4,
        color: '#e2e8f0',
        createdAt: Date.now(),
      });
    }
    return true;
  } else if (existing === 'poison' && kind === 'water') {
    finalKind = 'water';
  }

  if (
    t.liquidLevel !== undefined &&
    Math.abs(t.liquidLevel - clampedLevel) < 0.005 &&
    (t.liquidKind ?? 'water') === finalKind
  ) {
    return false;
  }

  t.liquidLevel = clampedLevel;
  t.liquidKind = finalKind;
  t.onFireTimer = 0;
  t.crushedTimer = 0;
  t.resourceNode = 'none';
  t.resourceAmount = 0;
  t.farmSettlementId = undefined;
  clearBurntTreeState(t);
  delete t.treeBiomeOverride;
  if (finalKind === 'lava') {
    t.tempOffset = Math.min(80, Math.max(t.tempOffset ?? 0, 35));
    if (t.height > 0 && t.terrain !== 'volcanic_wasteland' && t.terrain !== 'void_goo') {
      if ((t.terrain === 'snow' || t.terrain === 'tundra') && t.height > 1) {
        t.height = Math.max(1, t.height - 1);
      }
      t.terrain = 'volcanic_wasteland';
      syncTileToWorldGrid(ensureWorldGrid(state), t);
    }
  } else if (finalKind === 'poison') {
    t.cursedTimer = Math.max(t.cursedTimer, 12);
    if (
      t.height > 0 &&
      t.terrain !== 'blighted_mire' &&
      t.terrain !== 'void_goo' &&
      t.terrain !== 'volcanic_wasteland'
    ) {
      t.terrain = 'blighted_mire';
      syncTileToWorldGrid(ensureWorldGrid(state), t);
    }
  } else if (finalKind === 'water' && (t.tempOffset ?? 0) > 0) {
    t.tempOffset = Math.max(0, (t.tempOffset ?? 0) - 18);
  }
  return true;
}

function applyLiquidToTile(
  state: SimulationState,
  t: TileData,
  kind: LiquidKind,
  asLake = true,
): boolean {
  if (t.buildingId) return false;
  const existing = getTileLiquidKind(t);
  if (existing === kind && t.height === 0 && !(t.liquidLevel && t.liquidLevel > 0)) return false;

  if (kind === 'lava' || kind === 'poison') {
    specialLiquidPossibleByState.set(state, true);
  }

  delete t.liquidLevel;
  delete t.liquidKind;

  // Elemental liquid-on-liquid reactions
  if ((existing === 'lava' && kind === 'poison') || (existing === 'poison' && kind === 'lava')) {
    t.height = 0;
    t.terrain = 'scorched';
    delete t.waterKind;
    t.isRiver = false;
    t.isLake = false;
    t.cursedTimer = Math.max(t.cursedTimer, 10);
    t.resourceNode = 'none';
    t.resourceAmount = 0;
  } else if ((existing === 'lava' && kind === 'water') || (existing === 'water' && kind === 'lava')) {
    t.height = 0;
    t.terrain = 'shallow_water';
    delete t.waterKind;
    t.isRiver = false;
    t.isLake = asLake;
    t.onFireTimer = 0;
    t.tempOffset = Math.min(25, Math.max(0, (t.tempOffset ?? 0) + (kind === 'lava' ? 10 : -24)));
  } else {
    t.height = 0;
    t.terrain = 'shallow_water';
    t.isLake = asLake;
    t.isRiver = !asLake;
    if (kind === 'water') {
      delete t.waterKind;
      if ((t.tempOffset ?? 0) > 0) t.tempOffset = Math.max(0, (t.tempOffset ?? 0) - 18);
    } else if (kind === 'lava') {
      t.waterKind = 'lava';
      t.tempOffset = Math.min(80, Math.max(t.tempOffset ?? 0, 35));
    } else {
      t.waterKind = 'poison';
    }
    delete t.frozenWaterBase;
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    t.onFireTimer = 0;
    t.crushedTimer = 0;
    t.farmSettlementId = undefined;
    clearBurntTreeState(t);
    delete t.treeBiomeOverride;
  }

  syncTileToWorldGrid(ensureWorldGrid(state), t);
  return true;
}

/**
 * Dynamically fills and STACKS water, lava, or poison upward inside any enclosed hole, crater,
 * terraced mountain bowl, or valley!
 * - Rolls downhill from sloped inner walls to the bottom of the hole first.
 * - Raises the liquid surface by +1 height step (`liquidLevel`) across all enclosed tiles
 *   with `height < targetLevel`, stopping cleanly at the rim without flooding open plains or oceans.
 */
export function fillLiquidBasin(
  state: SimulationState,
  startX: number,
  startZ: number,
  kind: LiquidKind,
  maxTiles = 220,
): number {
  const initialTile = getTile(state, startX, startZ);
  if (!initialTile || initialTile.buildingId) return 0;

  const gs = state.gridSize;
  const dirs: ReadonlyArray<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  // 1. Gravity roll-down: if the player clicked a sloped inner wall of a crater/bowl,
  //    slide down to the local lowest floor tile so the hole fills from the bottom up.
  let seedTile = initialTile;
  for (let step = 0; step < 18; step++) {
    const curSurf = getTileSurfaceHeight(seedTile);
    let bestNb: TileData | null = null;
    let bestSurf = curSurf;
    for (let d = 0; d < 4; d++) {
      const nx = seedTile.x + dirs[d][0];
      const nz = seedTile.z + dirs[d][1];
      if (nx <= 0 || nz <= 0 || nx >= gs - 1 || nz >= gs - 1) continue;
      const nb = state.tiles[nz * gs + nx];
      if (!nb || nb.buildingId) continue;
      const nbSurf = getTileSurfaceHeight(nb);
      if (nbSurf < bestSurf) {
        bestSurf = nbSurf;
        bestNb = nb;
      }
    }
    if (!bestNb) break;
    seedTile = bestNb;
  }

  const curSurface = getTileSurfaceHeight(seedTile);
  if (curSurface >= 10) return 0;
  const targetLevel = Math.min(10, curSurface + 1);

  // 2. Bounded flood-fill at `targetLevel`: find all connected tiles strictly below `targetLevel`,
  //    grouped by BFS distance ring so water visibly ripples outward to fill the gap!
  const visited: TileData[] = [];
  const rings: TileData[][] = [];
  const seen = new Set<number>();
  const queue: TileData[] = [seedTile];
  const distQueue: number[] = [0];
  seen.add(seedTile.z * gs + seedTile.x);

  let rimContacts = 0;
  let enclosed = true;

  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    const dist = distQueue[qi];
    if (cur.x <= 0 || cur.z <= 0 || cur.x >= gs - 1 || cur.z >= gs - 1) {
      enclosed = false;
      break;
    }
    visited.push(cur);
    if (!rings[dist]) rings[dist] = [];
    rings[dist].push(cur);
    if (visited.length > maxTiles) {
      enclosed = false;
      break;
    }

    for (let d = 0; d < 4; d++) {
      const nx = cur.x + dirs[d][0];
      const nz = cur.z + dirs[d][1];
      const nIdx = nz * gs + nx;
      if (seen.has(nIdx)) continue;
      const nb = state.tiles[nIdx];
      if (!nb) continue;

      if (nb.height >= targetLevel || nb.buildingId) {
        rimContacts++;
        continue;
      }

      seen.add(nIdx);
      queue.push(nb);
      distQueue.push(dist + 1);
    }
  }

  if (!enclosed || visited.length === 0 || rimContacts < 4) {
    return 0;
  }

  let minX = seedTile.x;
  let maxX = seedTile.x;
  let minZ = seedTile.z;
  let maxZ = seedTile.z;
  for (let i = 0; i < visited.length; i++) {
    const vt = visited[i];
    if (vt.x < minX) minX = vt.x;
    if (vt.x > maxX) maxX = vt.x;
    if (vt.z < minZ) minZ = vt.z;
    if (vt.z > maxZ) maxZ = vt.z;
  }

  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const reactionRadius = Math.min(14, Math.ceil(Math.hypot(maxX - minX, maxZ - minZ) * 0.5) + 2);

  // Immediately splash the first ring (impact center) for instant visual feedback
  let filledCount = 0;
  const firstRing = rings[0] ?? [];
  for (let i = 0; i < firstRing.length; i++) {
    if (applyElevatedLiquidToTile(state, firstRing[i], targetLevel, kind)) {
      filledCount++;
    }
  }

  // Queue remaining outward BFS rings to animate smoothly in stepDynamicLiquidFlow
  if (rings.length > 1) {
    let activeWaves = pendingBasinWavesByState.get(state);
    if (!activeWaves) {
      activeWaves = [];
      pendingBasinWavesByState.set(state, activeWaves);
    }
    activeWaves.push({
      rings,
      nextRingIndex: 1,
      targetLevel,
      kind,
      timer: 0,
      centerX: cx,
      centerZ: cz,
      reactionRadius,
    });
  } else if (filledCount > 0) {
    resolveLiquidReactionsAround(state, cx, cz, reactionRadius);
  }

  return Math.max(filledCount, rings.length > 1 ? 1 : 0);
}

interface PendingBasinFillWave {
  rings: TileData[][];
  nextRingIndex: number;
  targetLevel: number;
  kind: LiquidKind;
  timer: number;
  centerX: number;
  centerZ: number;
  reactionRadius: number;
}

const pendingBasinWavesByState = new WeakMap<SimulationState, PendingBasinFillWave[]>();
const liquidFlowTimerByState = new WeakMap<SimulationState, number>();
let _liquidDeltaVolBuf = new Float32Array(0);
let _liquidDeltaKindBuf = new Uint8Array(0);
let _liquidTouchedBuf = new Int32Array(0);
let _liquidTouchedFlag = new Uint8Array(0);

/**
 * Dynamically flows water, lava, and poison into newly destroyed, crushed, or breached
 * terrain gaps — both at sea level AND from elevated stacked mountain lakes when a rim wall
 * is broken or a side chamber is carved!
 */
function stepDynamicLiquidFlow(state: SimulationState, dt: number): void {
  // 1. Advance animated outward-ripple basin fills smoothly (~18 rings/sec)
  const activeWaves = pendingBasinWavesByState.get(state);
  if (activeWaves && activeWaves.length > 0) {
    const RING_INTERVAL_SEC = 0.055;
    for (let wi = activeWaves.length - 1; wi >= 0; wi--) {
      const wave = activeWaves[wi];
      wave.timer += dt;
      while (wave.timer >= RING_INTERVAL_SEC && wave.nextRingIndex < wave.rings.length) {
        wave.timer -= RING_INTERVAL_SEC;
        const ring = wave.rings[wave.nextRingIndex++];
        let anyApplied = false;
        for (let i = 0; i < ring.length; i++) {
          const tile = ring[i];
          if (tile.buildingId || tile.height >= wave.targetLevel) continue;
          if (applyElevatedLiquidToTile(state, tile, wave.targetLevel, wave.kind)) {
            anyApplied = true;
          }
        }
        if (anyApplied && (wave.kind === 'lava' || wave.kind === 'poison')) {
          resolveLiquidReactionsAround(state, wave.centerX, wave.centerZ, wave.reactionRadius);
        }
      }
      if (wave.nextRingIndex >= wave.rings.length) {
        resolveLiquidReactionsAround(state, wave.centerX, wave.centerZ, wave.reactionRadius);
        activeWaves.splice(wi, 1);
      }
    }
  }

  const prevTimer = liquidFlowTimerByState.get(state) ?? 0;
  const nextTimer = prevTimer + dt;
  if (nextTimer < 0.095) {
    liquidFlowTimerByState.set(state, nextTimer);
    return;
  }
  liquidFlowTimerByState.set(state, 0);

  const gs = state.gridSize;
  const totalCells = gs * gs;
  if (_liquidDeltaVolBuf.length < totalCells) {
    _liquidDeltaVolBuf = new Float32Array(totalCells);
    _liquidDeltaKindBuf = new Uint8Array(totalCells);
    _liquidTouchedBuf = new Int32Array(totalCells);
    _liquidTouchedFlag = new Uint8Array(totalCells);
  }

  const tiles = state.tiles;
  const pendingSea: Array<{ tile: TileData; kind: LiquidKind }> = [];
  const MAX_SEA_FLOW_PER_PULSE = 48;
  let touchedCount = 0;

  const markTouched = (idx: number) => {
    if (_liquidTouchedFlag[idx] === 0) {
      _liquidTouchedFlag[idx] = 1;
      _liquidTouchedBuf[touchedCount++] = idx;
    }
  };

  const nbOffsets = [1, -1, gs, -gs];
  const nbWeights = [0, 0, 0, 0];

  for (let z = 1; z < gs - 1; z++) {
    const rowOff = z * gs;
    for (let x = 1; x < gs - 1; x++) {
      const idx = rowOff + x;
      const t = tiles[idx];
      if (!t) continue;

      // Clean up invalid elevated liquid if terrain was raised above it
      if ((t.liquidLevel ?? 0) > 0 && t.height >= (t.liquidLevel ?? 0)) {
        delete t.liquidLevel;
        delete t.liquidKind;
      }

      // A. Strictly volume-conserving shallow-water cellular flow for elevated liquids
      const rawLvl = t.liquidLevel ?? 0;
      if (rawLvl > t.height) {
        const vol = rawLvl - t.height;
        const kind: LiquidKind = t.liquidKind ?? 'water';
        const kindCode = kind === 'lava' ? 2 : kind === 'poison' ? 3 : 1;

        // Flowing water extinguishes fire & hydrates; flowing lava melts into volcanic rock & ignites; flowing poison corrodes into Land of Blight
        if (kind === 'water') {
          if (t.onFireTimer > 0) t.onFireTimer = 0;
          if (t.terrain === 'scorched') {
            t.terrain = 'grass';
            syncTileToWorldGrid(ensureWorldGrid(state), t);
          }
        } else if (kind === 'lava') {
          t.tempOffset = Math.min(80, Math.max(t.tempOffset ?? 0, 35));
          if (t.height > 0 && t.terrain !== 'volcanic_wasteland' && t.terrain !== 'void_goo') {
            if ((t.terrain === 'snow' || t.terrain === 'tundra') && t.height > 1) {
              t.height = Math.max(1, t.height - 1);
            }
            t.terrain = 'volcanic_wasteland';
            syncTileToWorldGrid(ensureWorldGrid(state), t);
          }
          // Ignite adjacent flammable vegetation/forests along the lava stream
          for (let d = 0; d < 4; d++) {
            const nb = tiles[idx + nbOffsets[d]];
            if (
              nb &&
              nb.height > 0 &&
              (nb.liquidLevel ?? 0) <= nb.height &&
              (nb.terrain === 'forest' || nb.terrain === 'grass' || nb.terrain === 'fertile' || nb.terrain === 'jungle' || nb.terrain === 'savanna' || nb.terrain === 'blossom' || nb.terrain === 'floral_plains')
            ) {
              nb.onFireTimer = Math.max(nb.onFireTimer, 8);
            }
          }
        } else if (kind === 'poison') {
          t.cursedTimer = Math.max(t.cursedTimer, 12);
          if (
            t.height > 0 &&
            t.terrain !== 'blighted_mire' &&
            t.terrain !== 'void_goo' &&
            t.terrain !== 'volcanic_wasteland'
          ) {
            t.terrain = 'blighted_mire';
            syncTileToWorldGrid(ensureWorldGrid(state), t);
          }
        }

        const surf = t.height + vol;
        let weightedTotal = 0;
        let maxRawDiff = 0;
        let hasLowerEscape = false;

        for (let d = 0; d < 4; d++) {
          nbWeights[d] = 0;
          const nbIdx = idx + nbOffsets[d];
          const nb = tiles[nbIdx];
          if (!nb || nb.buildingId) continue;

          if (nb.height === 0) {
            // Open sea/basin below acts as a true gravity sink so mountain runoff runs out!
            const diff = surf;
            nbWeights[d] = diff * 2.2;
            weightedTotal += nbWeights[d];
            if (diff > maxRawDiff) maxRawDiff = diff;
            hasLowerEscape = true;
          } else {
            const nbVol = Math.max(0, (nb.liquidLevel ?? 0) - nb.height);
            const nbSurf = nb.height + nbVol;
            if (nbSurf < surf - 0.012) {
              const diff = surf - nbSurf;
              const isDrop = nb.height < t.height;
              nbWeights[d] = diff * (isDrop ? 2.2 : 1.0);
              weightedTotal += nbWeights[d];
              if (diff > maxRawDiff) maxRawDiff = diff;
              if (isDrop || nbVol < 0.02) hasLowerEscape = true;
            }
          }
        }

        // Evaporate / cool tiny trailing films on open slopes only after they thin out little by little
        const minActiveVol = kind === 'lava' ? 0.032 : kind === 'poison' ? 0.028 : 0.038;
        if (vol < minActiveVol && hasLowerEscape) {
          markTouched(idx);
          _liquidDeltaVolBuf[idx] -= vol;
          continue;
        }

        if (weightedTotal > 0.0001) {
          // Viscosity-tuned flow rates: water flows briskly, poison oozes steadily, lava creeps thick & viscous
          const volFrac = kind === 'lava' ? 0.28 : kind === 'poison' ? 0.36 : 0.5;
          const diffFrac = kind === 'lava' ? 0.26 : kind === 'poison' ? 0.34 : 0.44;
          const maxOut = Math.min(vol * volFrac, maxRawDiff * diffFrac);
          let totalSent = 0;
          for (let d = 0; d < 4; d++) {
            if (nbWeights[d] <= 0) continue;
            const share = maxOut * (nbWeights[d] / weightedTotal);
            if (share <= 0.0004) continue;
            const nbIdx = idx + nbOffsets[d];
            const nb = tiles[nbIdx];
            totalSent += share;
            if (nb.height === 0) {
              const nbSeaKind = getTileLiquidKind(nb);
              if (kind === 'lava' && (nbSeaKind === 'water' || nb.terrain === 'ice')) {
                // Flowing lava pouring into ocean/lake water solidifies it into Stone with steam!
                nb.height = 1;
                nb.terrain = 'rock';
                delete nb.waterKind;
                delete nb.frozenWaterBase;
                nb.isRiver = false;
                nb.isLake = false;
                nb.onFireTimer = 0;
                nb.resourceNode = 'none';
                nb.resourceAmount = 0;
                syncTileToWorldGrid(ensureWorldGrid(state), nb);
                if (state.pendingVfx.length < 48) {
                  state.pendingVfx.push({
                    id: nextEntityId('vfx'),
                    type: 'hit_spark',
                    x: nb.x,
                    y: 0.72,
                    z: nb.z,
                    radius: 1.35,
                    color: '#e2e8f0',
                    createdAt: Date.now(),
                  });
                }
              } else if (nbSeaKind === null && pendingSea.length < MAX_SEA_FLOW_PER_PULSE) {
                pendingSea.push({ tile: nb, kind });
              }
            } else {
              markTouched(nbIdx);
              _liquidDeltaVolBuf[nbIdx] += share;
              if (_liquidDeltaKindBuf[nbIdx] === 0) {
                _liquidDeltaKindBuf[nbIdx] = kindCode;
              }
            }
          }
          if (totalSent > 0) {
            markTouched(idx);
            _liquidDeltaVolBuf[idx] -= totalSent;
            // Gradual soil absorption / cooling as a flowing front thins out far from its source
            if (vol < 0.18 && hasLowerEscape) {
              const loss = kind === 'lava' ? 0.008 : kind === 'poison' ? 0.007 : 0.015;
              _liquidDeltaVolBuf[idx] -= Math.min(Math.max(0, vol - totalSent), loss);
            }
          }
        }
        continue;
      }

      if (t.buildingId || pendingSea.length >= MAX_SEA_FLOW_PER_PULSE) continue;

      // B. Sea-level breach inflow (crushed, scorched, or dry height-0 gaps next to sea-level liquid)
      let requiredLiquidNeighbors = 0;
      if (t.height === 0) {
        if (getTileLiquidKind(t) !== null) continue;
        if (
          t.terrain === 'stone_road' ||
          t.terrain === 'rail_track' ||
          t.terrain === 'runway' ||
          t.terrain === 'ice' ||
          (t.terrain === 'scorched' && t.cursedTimer > 0)
        ) {
          continue;
        }
        requiredLiquidNeighbors = 1;
      } else if (t.height === 1) {
        if ((t.crushedTimer ?? 0) > 0 || t.terrain === 'scorched') {
          requiredLiquidNeighbors = 1;
        } else if (
          t.terrain === 'rock' ||
          t.terrain === 'volcanic_wasteland' ||
          t.terrain === 'badlands'
        ) {
          requiredLiquidNeighbors = 2;
        } else {
          continue;
        }
      } else {
        continue;
      }

      let waterN = 0;
      let lavaN = 0;
      let poisonN = 0;
      const n0 = getTileLiquidKind(tiles[rowOff + x + 1]);
      const n1 = getTileLiquidKind(tiles[rowOff + x - 1]);
      const n2 = getTileLiquidKind(tiles[rowOff + gs + x]);
      const n3 = getTileLiquidKind(tiles[rowOff - gs + x]);
      if (n0 === 'water') waterN++;
      else if (n0 === 'lava') lavaN++;
      else if (n0 === 'poison') poisonN++;
      if (n1 === 'water') waterN++;
      else if (n1 === 'lava') lavaN++;
      else if (n1 === 'poison') poisonN++;
      if (n2 === 'water') waterN++;
      else if (n2 === 'lava') lavaN++;
      else if (n2 === 'poison') poisonN++;
      if (n3 === 'water') waterN++;
      else if (n3 === 'lava') lavaN++;
      else if (n3 === 'poison') poisonN++;

      const totalLiquidN = waterN + lavaN + poisonN;
      if (totalLiquidN < requiredLiquidNeighbors) continue;

      const dominantKind: LiquidKind =
        lavaN >= waterN && lavaN >= poisonN && lavaN > 0
          ? 'lava'
          : poisonN >= waterN && poisonN > 0
            ? 'poison'
            : 'water';
      pendingSea.push({ tile: t, kind: dominantKind });
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let changed = 0;

  for (let i = 0; i < touchedCount; i++) {
    const idx = _liquidTouchedBuf[i];
    const dVol = _liquidDeltaVolBuf[idx];
    const dKindCode = _liquidDeltaKindBuf[idx];
    _liquidDeltaVolBuf[idx] = 0;
    _liquidDeltaKindBuf[idx] = 0;
    _liquidTouchedFlag[idx] = 0;

    if (Math.abs(dVol) < 0.0005) continue;
    const t = tiles[idx];
    if (!t || t.height <= 0) continue;

    const prevVol = Math.max(0, (t.liquidLevel ?? 0) - t.height);
    const nextVol = prevVol + dVol;
    if (nextVol < 0.025) {
      if ((t.liquidLevel ?? 0) > t.height) {
        delete t.liquidLevel;
        delete t.liquidKind;
        changed++;
        if (t.x < minX) minX = t.x;
        if (t.x > maxX) maxX = t.x;
        if (t.z < minZ) minZ = t.z;
        if (t.z > maxZ) maxZ = t.z;
      }
    } else {
      const incomingKind: LiquidKind =
        dKindCode === 2 ? 'lava' : dKindCode === 3 ? 'poison' : dKindCode === 1 ? 'water' : (t.liquidKind ?? 'water');
      const kind: LiquidKind =
        t.liquidKind && dKindCode !== 0 && t.liquidKind !== incomingKind
          ? incomingKind
          : (t.liquidKind ?? incomingKind);
      if (applyElevatedLiquidToTile(state, t, t.height + nextVol, kind)) {
        changed++;
        if (t.x < minX) minX = t.x;
        if (t.x > maxX) maxX = t.x;
        if (t.z < minZ) minZ = t.z;
        if (t.z > maxZ) maxZ = t.z;
      }
    }
  }

  for (let i = 0; i < pendingSea.length; i++) {
    const p = pendingSea[i];
    if (applyLiquidToTile(state, p.tile, p.kind, false)) {
      changed++;
      if (p.tile.x < minX) minX = p.tile.x;
      if (p.tile.x > maxX) maxX = p.tile.x;
      if (p.tile.z < minZ) minZ = p.tile.z;
      if (p.tile.z > maxZ) maxZ = p.tile.z;
    }
  }

  if (changed > 0) {
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const r = Math.min(12, Math.ceil(Math.hypot(maxX - minX, maxZ - minZ) * 0.5) + 2);
    resolveLiquidReactionsAround(state, cx, cz, r);
  }
}

const ruinScanTimerByState = new WeakMap<SimulationState, number>();

/**
 * Checks if any live civilization unit has discovered an unexplored overland Ancient Ruin.
 * Discovering a ruin awards a relic/knowledge trove (72%) or awakens ancient skeleton tomb guardians (28%).
 */
function stepAncientRuinExploration(state: SimulationState, dt: number): void {
  const nextT = (ruinScanTimerByState.get(state) ?? 0) + dt;
  if (nextT < 0.35) {
    ruinScanTimerByState.set(state, nextT);
    return;
  }
  ruinScanTimerByState.set(state, 0);

  const tiles = state.tiles;
  const units = state.units;
  if (units.length === 0) return;

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (!t || t.resourceNode !== 'ancient_ruin' || t.resourceAmount <= 0) continue;

    let explorer: UnitEntity | null = null;
    for (let ui = 0; ui < units.length; ui++) {
      const u = units[ui];
      if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
      const dx = u.x - t.x;
      const dz = u.z - t.z;
      if (dx * dx + dz * dz <= 4.41) {
        explorer = u;
        break;
      }
    }
    if (!explorer) continue;

    // Mark ruin explored (structure stays as weathered stone landmark, glowing orb vanishes)
    t.resourceAmount = 0;
    const sid = explorer.settlementId;
    const kid = sid ? getKingdomId(state, sid) : explorer.kingdomId;
    const townName = (sid && state.settlementNames?.[sid]) || 'their realm';
    const groundY = Math.max(0.4, t.height * 0.45 + 0.3);

    if (Math.random() < 0.72) {
      if (kid) {
        const stock = ensureKingdomResources(state, kid);
        stock.knowledge += 55;
        stock.ore += 40;
        stock.alloy += 20;
      } else {
        state.resources.knowledge += 55;
        state.resources.ore += 40;
      }
      explorer.statusEffects.blessed = Math.max(explorer.statusEffects.blessed ?? 0, 25);
      explorer.hp = explorer.maxHp;
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'festival_lanterns',
        x: t.x,
        y: groundY,
        z: t.z,
        radius: 3.2,
        color: '#38bdf8',
        createdAt: Date.now(),
      });
      addChronicle(
        state,
        `${explorer.name} of ${townName} uncovered an Ancient Relic! (+55 Knowledge, +40 Ore, +20 Alloy)`,
        'divine',
        { x: t.x, z: t.z },
      );
    } else {
      const guardCount = 2 + (Math.random() < 0.45 ? 1 : 0);
      for (let g = 0; g < guardCount; g++) {
        const ang = (g / guardCount) * Math.PI * 2;
        spawnUnit(
          state,
          'skeleton',
          Math.max(1, Math.min(state.gridSize - 2, t.x + Math.cos(ang) * 1.4)),
          Math.max(1, Math.min(state.gridSize - 2, t.z + Math.sin(ang) * 1.4)),
          true,
        );
      }
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'hit_spark',
        x: t.x,
        y: groundY + 0.4,
        z: t.z,
        radius: 2.6,
        color: '#a855f7',
        createdAt: Date.now(),
      });
      addChronicle(
        state,
        `${explorer.name} disturbed an Ancient Tomb near ${townName}! Skeleton guardians awakened!`,
        'warning',
        { x: t.x, z: t.z },
      );
    }
  }
}

const RACE_WONDER_INFO: Record<SpeciesId, { name: string; bonusSummary: string }> = {
  human: { name: 'Grand Sun Lighthouse', bonusSummary: '+3.5 Knowledge/s & +2.5 Faith/s' },
  elf: { name: 'World Tree Sanctuary', bonusSummary: '+3.5 Knowledge/s & +2.5 Faith/s' },
  orc: { name: 'Iron War Colossus', bonusSummary: '+3.5 Knowledge/s & +2.5 Faith/s' },
  dwarf: { name: 'Runic Titan Forge', bonusSummary: '+3.5 Knowledge/s & +2.5 Faith/s' },
  lizardfolk: { name: 'Great Solar Ziggurat', bonusSummary: '+3.5 Knowledge/s & +2.5 Faith/s' },
};

const wonderCheckTimerByState = new WeakMap<SimulationState, number>();

/**
 * Prosperous kingdoms (epoch >= 2 or 5+ completed buildings & 10+ citizens) autonomously
 * erect a bespoke race-themed World Wonder near their capital (1 per kingdom).
 * Wonders grant steady Knowledge & Faith buffs and collapse if sunk underwater.
 */
function stepWorldWonders(state: SimulationState, dt: number): void {
  if (!state.worldWonders) state.worldWonders = [];

  // Apply passive kingdom-wide Wonder buffs & prune any Wonder sunk into the sea
  for (let i = state.worldWonders.length - 1; i >= 0; i--) {
    const w = state.worldWonders[i];
    const t = getTile(state, w.tileX, w.tileZ);
    if (!t || t.height <= 0) {
      state.worldWonders.splice(i, 1);
      addChronicle(
        state,
        `The ${w.name} collapsed into the waters!`,
        'warning',
        { x: w.tileX, z: w.tileZ },
      );
      continue;
    }
    const stock = ensureKingdomResources(state, w.kingdomId);
    stock.knowledge += 3.5 * dt;
    if (!state.unallocatedResources) state.unallocatedResources = emptyResources();
    state.unallocatedResources.faith += 2.5 * dt;
  }

  const nextCheck = (wonderCheckTimerByState.get(state) ?? 0) + dt;
  if (nextCheck < 3.0) {
    wonderCheckTimerByState.set(state, nextCheck);
    return;
  }
  wonderCheckTimerByState.set(state, 0);

  if (state.worldWonders.length >= 8) return;

  const existingKids = new Set(state.worldWonders.map((w) => w.kingdomId));
  const buildingsByKid = new Map<string, BuildingEntity[]>();
  for (let i = 0; i < state.buildings.length; i++) {
    const b = state.buildings[i];
    if (b.constructionProgress < 100 || !b.settlementId) continue;
    const kid = getKingdomId(state, b.settlementId);
    let arr = buildingsByKid.get(kid);
    if (!arr) {
      arr = [];
      buildingsByKid.set(kid, arr);
    }
    arr.push(b);
  }

  const popByKid = new Map<string, number>();
  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.faction === 'civilization' && u.state !== 'ko' && u.hp > 0) {
      const kid = u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId;
      if (kid) popByKid.set(kid, (popByKid.get(kid) ?? 0) + 1);
    }
  }

  for (const [kid, blds] of buildingsByKid.entries()) {
    if (existingKids.has(kid)) continue;
    const kEpoch = state.kingdomEpochs?.[kid] ?? 0;
    const kPop = popByKid.get(kid) ?? 0;
    // Strictly Medieval Age (Epoch 2+) with an established kingdom — never in Stone or Bronze Age
    if (kEpoch < 2 || blds.length < 6 || kPop < 12) continue;

    const anchor = blds[0];
    const sid = anchor.settlementId!;
    const species: SpeciesId = anchor.species ?? state.settlementSpecies?.[sid] ?? 'human';
    let bestTile: TileData | null = null;
    for (let r = 3; r <= 8 && !bestTile; r++) {
      for (let dz = -r; dz <= r && !bestTile; dz++) {
        for (let dx = -r; dx <= r && !bestTile; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cand = getTile(state, anchor.tileX + dx, anchor.tileZ + dz);
          if (
            !cand ||
            cand.height < 1 ||
            cand.height > 6 ||
            cand.buildingId ||
            cand.farmSettlementId ||
            cand.resourceNode === 'ancient_ruin' ||
            (cand.liquidLevel ?? 0) > cand.height
          ) {
            continue;
          }
          if (state.worldWonders.some((ew) => Math.hypot(ew.tileX - cand.x, ew.tileZ - cand.z) < 6)) {
            continue;
          }
          bestTile = cand;
        }
      }
    }
    if (!bestTile) continue;

    bestTile.resourceNode = 'none';
    bestTile.resourceAmount = 0;
    const info = RACE_WONDER_INFO[species] ?? RACE_WONDER_INFO.human;
    const townName = state.settlementNames?.[sid] ?? 'A great realm';
    state.worldWonders.push({
      id: nextEntityId('wnd'),
      kingdomId: kid,
      settlementId: sid,
      species,
      name: info.name,
      tileX: bestTile.x,
      tileZ: bestTile.z,
      builtYear: Math.floor(state.year),
      bonusSummary: info.bonusSummary,
    });
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'festival_lanterns',
      x: bestTile.x,
      y: bestTile.height * 0.45 + 0.4,
      z: bestTile.z,
      radius: 5.5,
      color: '#ffd166',
      createdAt: Date.now(),
    });
    addChronicle(
      state,
      `${townName} completed a World Wonder: ${info.name}! (${info.bonusSummary})`,
      'epoch',
      { x: bestTile.x, z: bestTile.z },
    );
    break; // Build at most 1 Wonder per cycle
  }
}

interface CombatDeathCluster {
  x: number;
  z: number;
  count: number;
  lastYear: number;
  species?: SpeciesId;
}

const combatDeathClustersByState = new WeakMap<SimulationState, CombatDeathCluster[]>();

function recordCombatDeathForMemorial(state: SimulationState, u: UnitEntity): void {
  if (u.faction !== 'civilization' && u.faction !== 'hostile') return;
  if (!state.battleMemorials) state.battleMemorials = [];
  if (state.battleMemorials.length >= 24) return;

  let clusters = combatDeathClustersByState.get(state);
  if (!clusters) {
    clusters = [];
    combatDeathClustersByState.set(state, clusters);
  }

  let matched: CombatDeathCluster | null = null;
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    if (Math.hypot(c.x - u.x, c.z - u.z) <= 5.5) {
      c.count += 1;
      c.lastYear = state.year;
      matched = c;
      break;
    }
  }
  if (!matched) {
    matched = {
      x: u.x,
      z: u.z,
      count: 1,
      lastYear: state.year,
      species: u.species,
    };
    clusters.push(matched);
    if (clusters.length > 32) clusters.shift();
  }

  if (matched.count >= 4) {
    const tx = Math.max(1, Math.min(state.gridSize - 2, Math.round(matched.x)));
    const tz = Math.max(1, Math.min(state.gridSize - 2, Math.round(matched.z)));
    const tooClose = state.battleMemorials.some((m) => Math.hypot(m.tileX - tx, m.tileZ - tz) < 8);
    const tile = getTile(state, tx, tz);
    if (!tooClose && tile && tile.height >= 1 && !tile.buildingId) {
      const yearLabel = formatYearLabel(state.year);
      state.battleMemorials.push({
        id: nextEntityId('mem'),
        tileX: tile.x,
        tileZ: tile.z,
        yearLabel,
        fallenCount: matched.count,
        species: matched.species,
        label: `Battle Memorial (${yearLabel})`,
      });
      addChronicle(
        state,
        `A Battle Memorial was raised at (${tile.x}, ${tile.z}) to honor the fallen.`,
        'divine',
        { x: tile.x, z: tile.z },
      );
      matched.count = 0;
    }
  }
}

export function executeTerrainDropTileImpact(
  state: SimulationState,
  toolType: TerrainToolType,
  tileX: number,
  tileZ: number,
  options?: { skipSync?: boolean },
): boolean {
  const t = getTile(state, tileX, tileZ);
  if (!t) return false;
  let changed = false;
  const dropLiquidKind: LiquidKind | null =
    toolType === 'water_drop'
      ? 'water'
      : toolType === 'lava_drop'
        ? 'lava'
        : toolType === 'poison_drop'
          ? 'poison'
          : null;

  if (dropLiquidKind) {
    const filled = fillLiquidBasin(state, tileX, tileZ, dropLiquidKind, 220);
    if (filled > 0) {
      changed = true;
    } else if (t.height > 0 && !t.buildingId) {
      // Pour generous dynamic elevated liquid on hills, slopes, or plains so it visibly flows & thins out gradually!
      const nextLvl = Math.min(10, Math.max(t.height + 1.6, (t.liquidLevel ?? t.height) + 1.4));
      changed = applyElevatedLiquidToTile(state, t, nextLvl, dropLiquidKind);
      if (changed) {
        resolveLiquidReactionsAround(state, tileX, tileZ, 3);
      }
    } else {
      changed = applyTerrainToolTileMutation(t, toolType, Math.max(1, t.height), t.height, 0, state);
      if (changed) {
        syncTileToWorldGrid(ensureWorldGrid(state), t);
        resolveLiquidReactionsAround(state, tileX, tileZ, 3);
      }
    }
  } else {
    changed = applyTerrainToolTileMutation(t, toolType, Math.max(1, t.height), t.height, 0, state);
  }
  if (!changed) return false;

  if (!options?.skipSync) {
    if (toolType === 'blossom_rain' || toolType === 'floral_rain') {
      const clearRadiusSq = 2.25 * 2.25;
      for (const u of state.units) {
        if (
          u.state !== 'ko' &&
          u.faction !== 'hostile' &&
          (u.x - tileX) ** 2 + (u.z - tileZ) ** 2 <= clearRadiusSq
        ) {
          u.statusEffects.cursed = 0;
          u.statusEffects.plagued = 0;
          u.hp = Math.min(u.maxHp, u.hp + 18);
        }
      }
    }

    reconcileAndSyncResources(state);
    recalculateRatesAndCaps(state);
  }
  return true;
}

/**
 * Applies a batch of landed sky-drop tiles in a single pass, running blossom healing,
 * resource reconciliation, and rate recalculation once per batch instead of per tile.
 */
export function executeTerrainDropBatchImpact(
  state: SimulationState,
  toolType: TerrainToolType,
  coords: ReadonlyArray<{ x: number; z: number }>,
): number {
  let changedCount = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const batchLiquidKind: LiquidKind | null =
    toolType === 'water_drop'
      ? 'water'
      : toolType === 'lava_drop'
        ? 'lava'
        : toolType === 'poison_drop'
          ? 'poison'
          : null;

  if (batchLiquidKind) {
    // Allow up to 1 stack per droplet for small brushes (capped at 2 stacks per landed batch so liquid rises smoothly!)
    let basinStacksThisBatch = 0;
    const maxStacksPerBatch = coords.length >= 4 ? 2 : 1;
    let anyBasinHandled = false;

    for (let i = 0; i < coords.length; i++) {
      const c = coords[i];
      const t = getTile(state, c.x, c.z);
      if (!t) continue;
      if (basinStacksThisBatch < maxStacksPerBatch) {
        const filled = fillLiquidBasin(state, c.x, c.z, batchLiquidKind, 220);
        if (filled > 0) {
          basinStacksThisBatch++;
          anyBasinHandled = true;
          changedCount += filled;
          if (t.x < minX) minX = t.x;
          if (t.x > maxX) maxX = t.x;
          if (t.z < minZ) minZ = t.z;
          if (t.z > maxZ) maxZ = t.z;
          continue;
        }
      }
      if (anyBasinHandled) {
        // Already stacked this basin during this batch
        continue;
      }
      if (t.height > 0 && !t.buildingId) {
        // Pour generous dynamic elevated liquid onto hills, slopes, or open plains so it flows & thins out gradually!
        const curLvl = t.liquidLevel ?? t.height;
        const nextLvl = Math.min(10, Math.max(t.height + 1.6, curLvl + 1.4));
        if (applyElevatedLiquidToTile(state, t, nextLvl, batchLiquidKind)) {
          changedCount++;
          if (t.x < minX) minX = t.x;
          if (t.x > maxX) maxX = t.x;
          if (t.z < minZ) minZ = t.z;
          if (t.z > maxZ) maxZ = t.z;
        }
        continue;
      }
      if (applyTerrainToolTileMutation(t, toolType, Math.max(1, t.height), t.height, 0, state)) {
        syncTileToWorldGrid(ensureWorldGrid(state), t);
        changedCount++;
        if (t.x < minX) minX = t.x;
        if (t.x > maxX) maxX = t.x;
        if (t.z < minZ) minZ = t.z;
        if (t.z > maxZ) maxZ = t.z;
      }
    }
  } else {
    for (let i = 0; i < coords.length; i++) {
      const c = coords[i];
      const t = getTile(state, c.x, c.z);
      if (!t) continue;
      if (applyTerrainToolTileMutation(t, toolType, Math.max(1, t.height), t.height, 0, state)) {
        changedCount++;
        if (t.x < minX) minX = t.x;
        if (t.x > maxX) maxX = t.x;
        if (t.z < minZ) minZ = t.z;
        if (t.z > maxZ) maxZ = t.z;
      }
    }
  }

  if (changedCount === 0) return 0;

  if (batchLiquidKind) {
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const r = Math.min(14, Math.ceil(Math.hypot(maxX - minX, maxZ - minZ) * 0.5) + 2);
    resolveLiquidReactionsAround(state, cx, cz, r);
  }

  if (toolType === 'blossom_rain' || toolType === 'floral_rain') {
    const pad = 2.25;
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const r = Math.hypot((maxX - minX) * 0.5, (maxZ - minZ) * 0.5) + pad;
    const rSq = r * r;
    for (let ui = 0; ui < state.units.length; ui++) {
      const u = state.units[ui];
      if (u.state === 'ko' || u.faction === 'hostile') continue;
      if (u.x < minX - pad || u.x > maxX + pad || u.z < minZ - pad || u.z > maxZ + pad) continue;
      const dx = u.x - cx;
      const dz = u.z - cz;
      if (dx * dx + dz * dz <= rSq) {
        u.statusEffects.cursed = 0;
        u.statusEffects.plagued = 0;
        u.hp = Math.min(u.maxHp, u.hp + 18);
      }
    }
  }

  reconcileAndSyncResources(state);
  recalculateRatesAndCaps(state);
  return changedCount;
}

const POISON_CORRUPTIBLE_SOILS = new Set<TerrainType>([
  'grass',
  'fertile',
  'savanna',
  'forest',
  'jungle',
  'taiga',
  'blossom',
  'floral_plains',
  'sand',
  'tundra',
  'swamp',
]);

/**
 * Resolves emergent elemental liquid & terrain reactions in a bounded radius:
 * - Lava + Water -> quenches lava directly into steaming water (+ steam VFX)
 * - Lava + Poison -> violent corrosive crater (+ acid-magma VFX + unit damage)
 * - Poison + Open Water -> dilutes exposed tips into clean water (+ smooth shader plume)
 * - Poison + Dirt/Grass/Soil -> corrupts shoreline into purple Land of Blight (blighted_mire)
 * - Lava + Flammable land/trees/buildings -> sets surroundings on fire
 */
function resolveLiquidReactionsAround(
  state: SimulationState,
  cx: number,
  cz: number,
  radius: number,
): void {
  const gs = state.gridSize;
  const r = Math.ceil(radius) + 1;
  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(gs - 1, Math.ceil(cx + r));
  const minZ = Math.max(0, Math.floor(cz - r));
  const maxZ = Math.min(gs - 1, Math.ceil(cz + r));
  const dirs: ReadonlyArray<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let steamVfxCount = 0;
  let corrodeVfxCount = 0;
  const lavaToQuench: TileData[] = [];
  const poisonToDilute: TileData[] = [];

  for (let z = minZ; z <= maxZ; z++) {
    const rowOff = z * gs;
    for (let x = minX; x <= maxX; x++) {
      const t = state.tiles[rowOff + x];
      if (!t || t.height !== 0) continue;

      if (t.waterKind === 'lava') {
        specialLiquidPossibleByState.set(state, true);
        let touchedWater = false;
        let touchedPoison = false;
        for (let d = 0; d < 4; d++) {
          const nx = x + dirs[d][0];
          const nz = z + dirs[d][1];
          if (nx < 0 || nz < 0 || nx >= gs || nz >= gs) continue;
          const nb = state.tiles[nz * gs + nx];
          if (!nb) continue;
          if (nb.height === 0) {
            if (nb.waterKind === 'poison') {
              touchedPoison = true;
              // Corrode the meeting poison tile too
              nb.terrain = 'scorched';
              delete nb.waterKind;
              nb.isRiver = false;
              nb.isLake = false;
              nb.cursedTimer = Math.max(nb.cursedTimer, 10);
            } else if (!nb.waterKind && nb.terrain !== 'ice') {
              touchedWater = true;
            } else if (nb.terrain === 'ice') {
              nb.terrain = nb.frozenWaterBase ?? 'shallow_water';
              delete nb.frozenWaterBase;
              touchedWater = true;
            }
          } else if (
            nb.blessedTimer <= 0 &&
            (nb.buildingId ||
              nb.resourceNode === 'timber_grove' ||
              nb.resourceNode === 'berry_bush' ||
              isFlammableVegetationTerrain(nb.terrain))
          ) {
            // Lava sets adjacent flammable vegetation & structures on fire!
            nb.onFireTimer = Math.max(nb.onFireTimer, 4.5);
          }
        }

        if (touchedPoison) {
          t.height = 0;
          t.terrain = 'scorched';
          delete t.waterKind;
          t.isRiver = false;
          t.isLake = false;
          t.cursedTimer = Math.max(t.cursedTimer, 10);
          t.resourceNode = 'none';
          t.resourceAmount = 0;
          if (corrodeVfxCount < 4 && state.pendingVfx.length < 48) {
            corrodeVfxCount++;
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'hit_spark',
              x: t.x,
              y: 0.45,
              z: t.z,
              radius: 1.6,
              color: '#a3e635',
              createdAt: Date.now(),
            });
          }
          // Corrosive blast damages nearby unshielded units
          for (const u of state.units) {
            if (u.state === 'ko' || u.statusEffects.shielded) continue;
            if ((u.x - t.x) ** 2 + (u.z - t.z) ** 2 <= 9) {
              u.hp = Math.max(0, u.hp - 28);
              u.statusEffects.plagued = Math.max(u.statusEffects.plagued ?? 0, 8);
            }
          }
        } else if (touchedWater) {
          lavaToQuench.push(t);
        }
      } else if (t.waterKind === 'poison') {
        specialLiquidPossibleByState.set(state, true);
        let cleanWaterNeighbors = 0;
        // Poison touching dirt/grass/soil turns adjacent shoreline into purple Land of Blight!
        for (let d = 0; d < 4; d++) {
          const nx = x + dirs[d][0];
          const nz = z + dirs[d][1];
          if (nx < 0 || nz < 0 || nx >= gs || nz >= gs) continue;
          const nb = state.tiles[nz * gs + nx];
          if (!nb) continue;
          if (nb.height === 0 && !nb.waterKind && nb.terrain !== 'ice') {
            cleanWaterNeighbors++;
            continue;
          }
          if (nb.height <= 0 || nb.buildingId || nb.blessedTimer > 0) continue;
          if (POISON_CORRUPTIBLE_SOILS.has(nb.terrain)) {
            nb.terrain = 'blighted_mire';
            nb.farmSettlementId = undefined;
            delete nb.treeBiomeOverride;
          }
        }
        if (cleanWaterNeighbors >= 3) {
          poisonToDilute.push(t);
        }
      }
    }
  }

  for (let i = 0; i < lavaToQuench.length; i++) {
    const qt = lavaToQuench[i];
    qt.height = 0;
    qt.terrain = 'shallow_water';
    delete qt.waterKind;
    qt.isRiver = false;
    qt.isLake = false;
    qt.onFireTimer = 0;
    if ((qt.tempOffset ?? 0) > 0) {
      qt.tempOffset = Math.max(0, (qt.tempOffset ?? 0) - 28);
    }
    if (steamVfxCount < 4 && state.pendingVfx.length < 48) {
      steamVfxCount++;
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'hit_spark',
        x: qt.x,
        y: 0.55,
        z: qt.z,
        radius: 1.35,
        color: '#e2e8f0',
        createdAt: Date.now(),
      });
    }
  }

  for (let i = 0; i < poisonToDilute.length; i++) {
    const pt = poisonToDilute[i];
    delete pt.waterKind;
    pt.terrain = 'shallow_water';
    pt.isRiver = false;
    pt.isLake = false;
  }
}

export function applyTerrainTool(
  state: SimulationState,
  toolType: TerrainToolType,
  centerX: number,
  centerZ: number,
  brushRadius = 1,
  options?: { deferSkyImpact?: boolean; flattenHeightOverride?: number },
): { ok: boolean; reason?: string } {
  const def = TERRAIN_TOOLS.find((t) => t.type === toolType);
  if (!def) return { ok: false, reason: 'Unknown terrain tool' };

  const centerTile = getTile(state, centerX, centerZ);
  if (!centerTile) return { ok: false, reason: 'Out of bounds' };

  if (!state.sandboxFreeMode && state.resources.faith < def.faithCost) {
    return { ok: false, reason: 'Need more God Energy to sculpt terrain' };
  }

  const targetFlattenHeight =
    options?.flattenHeightOverride !== undefined
      ? Math.max(1, Math.min(10, Math.round(options.flattenHeightOverride)))
      : Math.max(1, centerTile.height);
  const clampedRadius = Math.max(0, Math.min(12, Math.floor(brushRadius)));
  const deferSkyImpact = Boolean(def.isSkyRain) && (options?.deferSkyImpact ?? true);
  let modifiedCount = 0;
  const dropTargets: Array<{ x: number; y: number; z: number }> = [];

  // Dynamic basin fill: pouring water, lava, or poison into an enclosed hole/crater fills the whole basin cleanly up to the rim!
  const basinLiquidKind: LiquidKind | null =
    !deferSkyImpact
      ? toolType === 'water_drop' || toolType === 'carve_river'
        ? 'water'
        : toolType === 'lava_drop' || toolType === 'lava_river'
          ? 'lava'
          : toolType === 'poison_drop' || toolType === 'poison_river'
            ? 'poison'
            : null
      : null;
  let filledBasinCount = 0;
  if (basinLiquidKind) {
    filledBasinCount = fillLiquidBasin(state, centerX, centerZ, basinLiquidKind, 220);
    if (filledBasinCount > 0) {
      modifiedCount += filledBasinCount;
      dropTargets.push({ x: centerTile.x, y: Math.max(0.36, getTileSurfaceHeight(centerTile) * 0.45 + 0.14), z: centerTile.z });
    } else if ((centerTile.liquidLevel ?? 0) > centerTile.height) {
      // Elevated crater is already filled to the brim — don't punch through its floor
      return { ok: true };
    }
  }

  if (filledBasinCount === 0) {
    for (let dz = -clampedRadius; dz <= clampedRadius; dz++) {
      for (let dx = -clampedRadius; dx <= clampedRadius; dx++) {
        if (!isInsidePixelCircle(dx, dz, clampedRadius)) continue;
        const t = getTile(state, centerX + dx, centerZ + dz);
        if (!t) continue;
        const normDist = clampedRadius > 0 ? Math.hypot(dx, dz) / clampedRadius : 0;
        const tileEligible = deferSkyImpact
          ? canApplyTerrainToolToTile(t, toolType, centerTile.height)
          : applyTerrainToolTileMutation(t, toolType, targetFlattenHeight, centerTile.height, normDist, state);

        if (tileEligible) {
          modifiedCount++;
          dropTargets.push({ x: t.x, y: Math.max(0.36, t.height * 0.45 + 0.25), z: t.z });
        }
      }
    }
  }

  if (modifiedCount === 0) {
    if (toolType === 'plant_forest' || toolType === 'fertile_meadow' || toolType === 'blossom_rain' || toolType === 'floral_rain') {
      return {
        ok: false,
        reason: 'Needs healthy land soil — revive barren land with Fertile Soil, Rain, or Bless first!',
      };
    }
    if (toolType === 'seed_ore' || toolType === 'boulder_rain' || toolType === 'crystal_shower') {
      return {
        ok: false,
        reason: 'Cast this sky drop over existing land!',
      };
    }
    if (
      toolType === 'soil_enrich' ||
      toolType === 'jungle_bloom' ||
      toolType === 'desert_dunes' ||
      toolType === 'swamp_mire' ||
      toolType === 'blighted_mire' ||
      toolType === 'floral_plains'
    ) {
      return {
        ok: false,
        reason: 'Cast this biome tool over existing land!',
      };
    }
    if (toolType === 'coral_reef_rain' || toolType === 'atlantis_rise') {
      return {
        ok: false,
        reason: 'Cast this ocean power over sea water!',
      };
    }
    return { ok: false, reason: 'Cannot apply tool on this terrain' };
  }

  if (!deferSkyImpact && (toolType === 'blossom_rain' || toolType === 'floral_rain')) {
    const clearRadiusSq = (clampedRadius + 2) ** 2;
    for (const u of state.units) {
      if (u.state !== 'ko' && u.faction !== 'hostile' && (u.x - centerX) ** 2 + (u.z - centerZ) ** 2 <= clearRadiusSq) {
        u.statusEffects.cursed = 0;
        u.statusEffects.plagued = 0;
        u.hp = Math.min(u.maxHp, u.hp + 18);
      }
    }
  }

  reconcileAndSyncResources(state);
  if (!state.sandboxFreeMode) {
    spendWorldCost(state, { faith: def.faithCost });
  }

  if (def.isSkyRain) {
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'sky_rain_drop',
      dropKind: toolType,
      dropTargets,
      deferImpact: deferSkyImpact,
      x: centerTile.x,
      y: centerTile.height * 0.45,
      z: centerTile.z,
      radius: Math.max(1.0, clampedRadius + 0.8),
      color: def.color,
      createdAt: Date.now(),
    });
  } else {
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'terrain_sculpt',
      x: centerTile.x,
      y: centerTile.height * 0.45,
      z: centerTile.z,
      radius: clampedRadius + 0.5,
      color: def.color,
      createdAt: Date.now(),
    });
  }

  if (
    toolType === 'water_drop' ||
    toolType === 'lava_drop' ||
    toolType === 'poison_drop' ||
    toolType === 'lava_river' ||
    toolType === 'poison_river' ||
    toolType === 'carve_river' ||
    toolType === 'abyssal_trench' ||
    toolType === 'lower' ||
    toolType === 'raise' ||
    toolType === 'flatten' ||
    toolType === 'canyon_carve' ||
    toolType === 'mesa_plateau' ||
    toolType === 'volcanic_crater' ||
    toolType === 'smooth_terrain' ||
    toolType === 'island_bridge' ||
    toolType === 'alpine_glacier'
  ) {
    resolveLiquidReactionsAround(state, centerTile.x, centerTile.z, clampedRadius + 2);
  }

  recalculateRatesAndCaps(state);
  return { ok: true };
}

export function generateEarthquakeFaultNetwork(
  targetX: number,
  targetZ: number,
  baseRadius: number,
  rng: () => number = Math.random,
): {
  quakeShapeKind: EarthquakeShapeKind;
  faultSegments: EarthquakeFaultSegment[];
  quakeExtent: number;
} {
  const roll = rng();
  const quakeShapeKind: EarthquakeShapeKind =
    roll < 0.22
      ? 'short_rupture'
      : roll < 0.5
        ? 'long_rift'
        : roll < 0.78
          ? 'branching_fault'
          : 'orogenic_uplift';

  const segments: EarthquakeFaultSegment[] = [];
  const mainAngle = rng() * Math.PI * 2;

  const growPolyline = (
    startX: number,
    startZ: number,
    startAngle: number,
    stepCount: number,
    stepLenMin: number,
    stepLenMax: number,
    width: number,
    upliftBias: number,
    bendMax: number,
    isBranch: boolean,
  ): Array<{ x: number; z: number; angle: number }> => {
    const joints: Array<{ x: number; z: number; angle: number }> = [
      { x: startX, z: startZ, angle: startAngle },
    ];
    let cx = startX;
    let cz = startZ;
    let ang = startAngle;
    for (let s = 0; s < stepCount; s++) {
      ang += (rng() - 0.5) * 2 * bendMax;
      const len = stepLenMin + rng() * (stepLenMax - stepLenMin);
      const nx = cx + Math.cos(ang) * len;
      const nz = cz + Math.sin(ang) * len;
      segments.push({
        x1: cx,
        z1: cz,
        x2: nx,
        z2: nz,
        width: width * (0.85 + rng() * 0.3),
        upliftBias: upliftBias + (rng() - 0.45) * 0.35,
        isBranch,
      });
      cx = nx;
      cz = nz;
      joints.push({ x: cx, z: cz, angle: ang });
    }
    return joints;
  };

  if (quakeShapeKind === 'short_rupture') {
    const fwdSteps = 1 + (rng() < 0.55 ? 1 : 0);
    const backSteps = 1;
    const baseUplift = rng() < 0.5 ? 0.35 : -0.15;
    const fJoints = growPolyline(targetX, targetZ, mainAngle, fwdSteps, 1.8, 2.7, 0.95, baseUplift, 0.5, false);
    growPolyline(targetX, targetZ, mainAngle + Math.PI + (rng() - 0.5) * 0.45, backSteps, 1.6, 2.5, 0.9, baseUplift, 0.45, false);
    if (rng() < 0.45 && fJoints.length > 1) {
      const side = rng() < 0.5 ? 1 : -1;
      growPolyline(fJoints[1].x, fJoints[1].z, mainAngle + side * (0.7 + rng() * 0.45), 1, 1.6, 2.4, 0.72, baseUplift, 0.35, true);
    }
  } else if (quakeShapeKind === 'long_rift') {
    const fwdSteps = 3 + (rng() < 0.5 ? 1 : 0);
    const backSteps = 2 + (rng() < 0.5 ? 1 : 0);
    const baseUplift = 0.25 + rng() * 0.45;
    const fJoints = growPolyline(targetX, targetZ, mainAngle, fwdSteps, 2.7, 4.0, 1.08, baseUplift, 0.44, false);
    const bJoints = growPolyline(targetX, targetZ, mainAngle + Math.PI + (rng() - 0.5) * 0.32, backSteps, 2.6, 3.8, 1.05, baseUplift, 0.44, false);
    const spurCount = rng() < 0.65 ? 2 : 1;
    const pool = [...fJoints.slice(1, -1), ...bJoints.slice(1, -1)];
    for (let bi = 0; bi < spurCount && pool.length > 0; bi++) {
      const idx = Math.floor(rng() * pool.length);
      const j = pool.splice(idx, 1)[0];
      const side = bi % 2 === 0 ? 1 : -1;
      growPolyline(j.x, j.z, j.angle + side * (0.62 + rng() * 0.55), 1 + (rng() < 0.4 ? 1 : 0), 2.1, 3.3, 0.78, baseUplift * 0.8, 0.4, true);
    }
  } else if (quakeShapeKind === 'branching_fault') {
    const fwdSteps = 2 + (rng() < 0.55 ? 1 : 0);
    const backSteps = 2;
    const baseUplift = 0.3 + rng() * 0.55;
    const fJoints = growPolyline(targetX, targetZ, mainAngle, fwdSteps, 2.5, 3.6, 1.05, baseUplift, 0.48, false);
    const bJoints = growPolyline(targetX, targetZ, mainAngle + Math.PI + (rng() - 0.5) * 0.42, backSteps, 2.3, 3.4, 1.0, baseUplift, 0.48, false);
    const branchCandidates = [...fJoints.slice(0, -1), ...bJoints.slice(1, -1)];
    const branchCount = 2 + Math.floor(rng() * 3); // 2..4 branches
    for (let bi = 0; bi < branchCount && branchCandidates.length > 0; bi++) {
      const idx = Math.floor(rng() * branchCandidates.length);
      const j = branchCandidates.splice(idx, 1)[0];
      const side = bi % 2 === 0 ? 1 : -1;
      const forkAngle = j.angle + side * (0.55 + rng() * 0.72);
      const subJoints = growPolyline(j.x, j.z, forkAngle, 2, 2.1, 3.3, 0.85, baseUplift + (rng() - 0.3) * 0.4, 0.48, true);
      if (bi === 0 && rng() < 0.55 && subJoints.length > 1) {
        growPolyline(
          subJoints[1].x,
          subJoints[1].z,
          forkAngle - side * (0.55 + rng() * 0.45),
          1,
          1.8,
          2.8,
          0.68,
          baseUplift,
          0.3,
          true,
        );
      }
    }
  } else {
    // orogenic_uplift: mountain-building tectonic collision & raised jagged ridge spurs
    const fwdSteps = 2 + (rng() < 0.5 ? 1 : 0);
    const backSteps = 2;
    const fJoints = growPolyline(targetX, targetZ, mainAngle, fwdSteps, 2.2, 3.4, 1.35, 1.15, 0.42, false);
    const bJoints = growPolyline(targetX, targetZ, mainAngle + Math.PI + (rng() - 0.5) * 0.35, backSteps, 2.1, 3.2, 1.3, 1.1, 0.42, false);
    const spurCount = 1 + Math.floor(rng() * 3); // 1..3 mountain spurs
    const allJoints = [fJoints[0], ...fJoints.slice(1, -1), ...bJoints.slice(1, -1)];
    for (let bi = 0; bi < spurCount && allJoints.length > 0; bi++) {
      const idx = Math.floor(rng() * allJoints.length);
      const j = allJoints.splice(idx, 1)[0];
      const side = bi % 2 === 0 ? 1 : -1;
      growPolyline(j.x, j.z, j.angle + side * (0.65 + rng() * 0.65), 1 + (rng() < 0.5 ? 1 : 0), 2.0, 3.0, 1.12, 1.25, 0.38, true);
    }
  }

  let maxDist = baseRadius;
  for (const s of segments) {
    const d1 = Math.hypot(s.x1 - targetX, s.z1 - targetZ) + s.width * 2.2;
    const d2 = Math.hypot(s.x2 - targetX, s.z2 - targetZ) + s.width * 2.2;
    if (d1 > maxDist) maxDist = d1;
    if (d2 > maxDist) maxDist = d2;
  }

  return {
    quakeShapeKind,
    faultSegments: segments,
    quakeExtent: Math.max(baseRadius, Math.min(20, maxDist)),
  };
}

export function closestFaultDistanceSq(
  px: number,
  pz: number,
  segments: EarthquakeFaultSegment[],
): { distSq: number; signedSide: number; segment: EarthquakeFaultSegment | null } {
  let bestDistSq = Infinity;
  let bestSide = 1;
  let bestSeg: EarthquakeFaultSegment | null = null;

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const vx = s.x2 - s.x1;
    const vz = s.z2 - s.z1;
    const lenSq = vx * vx + vz * vz;
    let t = 0;
    if (lenSq > 1e-6) {
      t = Math.max(0, Math.min(1, ((px - s.x1) * vx + (pz - s.z1) * vz) / lenSq));
    }
    const cx = s.x1 + vx * t;
    const cz = s.z1 + vz * t;
    const dx = px - cx;
    const dz = pz - cz;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestSeg = s;
      const cross = vx * (pz - s.z1) - vz * (px - s.x1);
      bestSide = cross >= 0 ? 1 : -1;
    }
  }

  return { distSq: bestDistSq, signedSide: bestSide, segment: bestSeg };
}

const waveAppliedIdsMap = new WeakMap<ActiveHazardZone, Set<string>>();

function getWaveAppliedSet(haz: ActiveHazardZone): Set<string> {
  let s = waveAppliedIdsMap.get(haz);
  if (!s) {
    s = new Set<string>();
    waveAppliedIdsMap.set(haz, s);
  }
  return s;
}

function getBaseBiomeTempC(terrain: TerrainType): number {
  switch (terrain) {
    case 'deep_water': return 9;
    case 'shallow_water': return 16;
    case 'ice': return -6;
    case 'sand': return 27;
    case 'grass': return 18;
    case 'fertile': return 20;
    case 'forest': return 15;
    case 'jungle': return 28;
    case 'savanna': return 30;
    case 'swamp': return 23;
    case 'highland': return 11;
    case 'mountain': return 4;
    case 'taiga': return 5;
    case 'tundra': return -3;
    case 'badlands': return 34;
    case 'blossom': return 19;
    case 'stone_road': return 20;
    case 'rail_track': return 21;
    case 'runway': return 22;
    case 'rock': return 10;
    case 'snow': return -11;
    case 'scorched': return 42;
    case 'crystal_field': return 7;
    case 'void_goo': return -18;
    case 'volcanic_wasteland': return 46;
    case 'blighted_mire': return 12;
    case 'floral_plains': return 21;
  }
}

function damageOrBleachWaterTile(
  t: TileData,
  dmgAmount: number,
  destroyWalkway = false,
): void {
  if (t.height !== 0) return;
  if (t.resourceNode === 'coral_reef') {
    t.resourceAmount = Math.max(0, t.resourceAmount - dmgAmount);
    if (t.resourceAmount <= 0) {
      t.resourceNode = 'coral_reef';
      t.resourceAmount = 0;
      t.coralBleachTimer = Math.max(t.coralBleachTimer ?? 0, 26);
    }
  } else if (t.resourceNode === 'scrap_flotsam' || t.resourceNode === 'atlantis_ruin') {
    t.resourceAmount = Math.max(0, t.resourceAmount - dmgAmount);
    if (t.resourceAmount <= 0) {
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }
  if (
    destroyWalkway &&
    !t.buildingId &&
    (t.terrain === 'stone_road' || t.terrain === 'rail_track' || t.terrain === 'runway')
  ) {
    t.terrain = 'shallow_water';
  }
}

type ExpandingWaveKind =
  | 'heat_wave_zone'
  | 'freeze_wave_zone'
  | 'blessing_wave'
  | 'curse_wave'
  | 'frenzy_wave'
  | 'terraform_wave';

function applyExpandingWaveSlice(
  state: SimulationState,
  kind: ExpandingWaveKind,
  targetX: number,
  targetZ: number,
  maxR: number,
  prevR: number,
  nextR: number,
  appliedIds: Set<string>,
  meta?: { waveWaterTarget?: boolean; waveTargetHeight?: number; waveEpochIdx?: number },
): void {
  const maxRSq = maxR * maxR;
  const tileMinR = Math.max(0, prevR - 0.35);
  const tileMinSq = prevR <= 0 ? 0 : tileMinR * tileMinR;
  const tileMaxSq = nextR * nextR;
  const unitMaxSq = (nextR + 0.15) ** 2;
  const allowSpread = state.worldRules?.wildfireSpread !== false;

  switch (kind) {
    case 'heat_wave_zone': {
      const shieldCheckedBlds = new Map<string, boolean>();
      forEachTileInBounds(state, targetX - maxR, targetX + maxR, targetZ - maxR, targetZ + maxR, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) return;
        if (prevR > 0 && dSq < tileMinSq) return;
        t.blessedTimer = 0;
        const normDistSq = dSq / Math.max(1, maxRSq);
        const heatDelta = normDistSq <= 0.58 ? 16 : 9;
        const prevTemp = t.tempOffset ?? 0;
        const effectiveHeat = prevTemp < 0 ? Math.max(heatDelta, Math.abs(prevTemp) * 0.65 + heatDelta * 0.5) : heatDelta;
        t.tempOffset = Math.min(80, prevTemp + effectiveHeat);
        const effC = getBaseBiomeTempC(t.terrain) + t.tempOffset;

        if (t.height === 0) {
          if (t.terrain === 'ice' && effC >= 0) {
            t.terrain = t.frozenWaterBase ?? 'shallow_water';
            delete t.frozenWaterBase;
          } else if (t.terrain === 'shallow_water' && !t.waterKind && (t.isRiver || t.isLake) && effC >= 34) {
            // Heat Wave evaporates inland shallow lakes & rivers into parched sand (open ocean never turns into fake land)
            t.height = 1;
            t.terrain = 'sand';
            t.isRiver = false;
            t.isLake = false;
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          } else if (effC >= 36) {
            damageOrBleachWaterTile(t, 140, false);
          }
          return;
        }

        const prevTerrain = t.terrain;
        const wasFlammable =
          isFlammableVegetationTerrain(prevTerrain) ||
          t.resourceNode === 'timber_grove' ||
          t.resourceNode === 'berry_bush' ||
          Boolean(t.farmSettlementId);
        // Holding/repeating Heat Wave superheats dried brush, forests, farms & buildings into active wildfire
        // without turning a single cool tap on temperate grass into an instant firestorm.
        const shouldIgnite = effC >= 46 && (prevTemp >= 14 || effC >= 54);

        if (!t.buildingId || t.terrain === 'snow' || t.terrain === 'tundra') {
          if (t.terrain === 'snow' && effC >= -2) {
            t.terrain = 'tundra';
          } else if (t.terrain === 'tundra' && effC >= 6) {
            t.terrain = 'grass';
          } else if (t.terrain === 'taiga' && effC >= 12) {
            t.terrain = 'grass';
          } else if (
            (t.terrain === 'swamp' ||
              t.terrain === 'fertile' ||
              t.terrain === 'blossom' ||
              t.terrain === 'floral_plains' ||
              t.terrain === 'grass' ||
              t.terrain === 'forest') &&
            effC >= 25
          ) {
            t.terrain = 'savanna';
            t.farmSettlementId = undefined;
          } else if (t.terrain === 'savanna' && effC >= 34 && !(shouldIgnite && wasFlammable)) {
            t.terrain = 'sand';
            t.farmSettlementId = undefined;
          } else if ((t.terrain === 'sand' || t.terrain === 'badlands') && effC >= 46) {
            t.terrain = 'badlands';
            t.farmSettlementId = undefined;
          }
        }

        if (shouldIgnite && !t.blessedTimer) {
          if (!t.buildingId && wasFlammable) {
            t.onFireTimer = Math.max(t.onFireTimer, allowSpread ? 5.2 : 3.4);
          } else if (t.buildingId && effC >= 52) {
            let unshielded = shieldCheckedBlds.get(t.buildingId);
            if (unshielded === undefined) {
              const bld = state.buildings.find((b) => b.id === t.buildingId);
              unshielded = Boolean(bld && bld.hp > 0 && bld.shieldTimer <= 0 && bld.blessedTimer <= 0);
              shieldCheckedBlds.set(t.buildingId, unshielded);
            }
            if (unshielded) {
              t.onFireTimer = Math.max(t.onFireTimer, allowSpread ? 4.4 : 3.0);
            }
          }
        } else if (effC >= 38 && t.resourceNode === 'berry_bush') {
          // Moderate drought withers berry bushes before superheat ignition threshold
          t.resourceNode = 'none';
          t.resourceAmount = 0;
        }
      });
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded || appliedIds.has(u.id)) continue;
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(u.id);
          delete u.statusEffects.frozen;
          const ut = getTile(state, Math.round(u.x), Math.round(u.z));
          const uEffC = ut ? getBaseBiomeTempC(ut.terrain) + (ut.tempOffset ?? 0) : 25;
          const dmg = u.role === 'dragon' ? 0 : uEffC >= 42 ? 48 : 12;
          if (dmg > 0) {
            u.hp = Math.max(0, u.hp - dmg);
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
              if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
            }
          }
        }
      }
      for (const b of state.buildings) {
        if (b.shieldTimer > 0 || appliedIds.has(b.id)) continue;
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(b.id);
          const bt = getTile(state, b.tileX, b.tileZ);
          const bEffC = bt ? getBaseBiomeTempC(bt.terrain) + (bt.tempOffset ?? 0) : 25;
          if (bEffC >= 40) {
            b.hp = Math.max(0, b.hp - 36);
          }
        }
      }
      for (const v of state.vehicles ?? []) {
        if (appliedIds.has(v.id)) continue;
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(v.id);
          const vt = getTile(state, Math.round(v.x), Math.round(v.z));
          const vEffC = vt ? getBaseBiomeTempC(vt.terrain) + (vt.tempOffset ?? 0) : 25;
          if (vEffC >= 40) {
            v.hp = Math.max(0, (v.hp ?? 100) - 40);
          }
        }
      }
      break;
    }

    case 'freeze_wave_zone': {
      forEachTileInBounds(state, targetX - maxR, targetX + maxR, targetZ - maxR, targetZ + maxR, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) return;
        if (prevR > 0 && dSq < tileMinSq) return;
        t.onFireTimer = 0;
        t.fireColor = undefined;
        t.cursedTimer = 0;
        const normDistSq = dSq / Math.max(1, maxRSq);
        const coolDelta = normDistSq <= 0.58 ? 15 : 9;
        const prevTemp = t.tempOffset ?? 0;
        const effectiveCool = prevTemp > 0 ? Math.max(coolDelta, prevTemp * 0.65 + coolDelta * 0.5) : coolDelta;
        t.tempOffset = Math.max(-65, prevTemp - effectiveCool);
        const effC = getBaseBiomeTempC(t.terrain) + t.tempOffset;

        if (t.height === 0) {
          // Gradually freeze water surface into walkable sea ice (height stays 0 — never creates fake land!)
          if ((t.terrain === 'shallow_water' || t.terrain === 'deep_water') && !t.buildingId && effC <= 0) {
            t.frozenWaterBase = t.terrain;
            t.terrain = 'ice';
          }
          return;
        }
        if (!t.buildingId) {
          if (t.terrain === 'scorched' && effC <= 20) {
            t.terrain = 'rock';
          } else if (
            (t.terrain === 'sand' ||
              t.terrain === 'badlands' ||
              t.terrain === 'savanna' ||
              t.terrain === 'jungle' ||
              t.terrain === 'swamp') &&
            effC <= 14
          ) {
            t.terrain = 'grass';
          } else if (
            (t.terrain === 'grass' || t.terrain === 'fertile' || t.terrain === 'blossom' || t.terrain === 'forest') &&
            effC <= 4
          ) {
            t.terrain = 'tundra';
          } else if (
            (t.terrain === 'tundra' ||
              t.terrain === 'taiga' ||
              t.terrain === 'rock' ||
              t.terrain === 'highland' ||
              t.terrain === 'mountain') &&
            effC <= -6
          ) {
            t.terrain = 'snow';
          }
        }
      });
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded || appliedIds.has(u.id)) continue;
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(u.id);
          const ut = getTile(state, Math.round(u.x), Math.round(u.z));
          const uEffC = ut ? getBaseBiomeTempC(ut.terrain) + (ut.tempOffset ?? 0) : 5;
          const deepChill = uEffC <= 2 || dSq <= maxRSq * 0.35;
          u.statusEffects.frozen = Math.max(u.statusEffects.frozen ?? 0, deepChill ? 5.5 : 2.2);
          const dmg = deepChill ? (u.role === 'dragon' ? 24 : 12) : 5;
          u.hp = Math.max(0, u.hp - dmg);
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.45;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          }
        }
      }
      for (const b of state.buildings) {
        if (b.shieldTimer > 0 || appliedIds.has(b.id)) continue;
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(b.id);
          const bt = getTile(state, b.tileX, b.tileZ);
          const bEffC = bt ? getBaseBiomeTempC(bt.terrain) + (bt.tempOffset ?? 0) : 5;
          if (bEffC <= -12) {
            b.hp = Math.max(0, b.hp - 22);
          }
        }
      }
      for (const v of state.vehicles ?? []) {
        if (appliedIds.has(v.id)) continue;
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(v.id);
          v.hp = Math.max(0, (v.hp ?? 100) - 18);
        }
      }
      break;
    }

    case 'blessing_wave': {
      forEachTileInBounds(state, targetX - maxR, targetX + maxR, targetZ - maxR, targetZ + maxR, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) return;
        if (prevR > 0 && dSq < tileMinSq) return;
        t.onFireTimer = 0;
        t.cursedTimer = 0;
        t.blessedTimer = 30;
        if (t.height <= 0) {
          if (t.resourceNode === 'coral_reef') {
            t.coralBleachTimer = 0;
            t.resourceAmount = Math.max(240, Math.min(360, t.resourceAmount + 140));
          }
          return;
        }
        if (t.terrain === 'scorched' || t.terrain === 'swamp' || t.terrain === 'sand' || t.terrain === 'void_goo') {
          t.terrain = dSq <= maxRSq * 0.45 ? 'fertile' : 'grass';
          clearBurntTreeState(t);
        } else if (t.terrain === 'grass' && dSq <= maxRSq * 0.35 && !t.buildingId) {
          t.terrain = 'fertile';
          clearBurntTreeState(t);
        } else if (t.burntTree) {
          clearBurntTreeState(t);
          if (!t.buildingId && t.resourceNode === 'none') {
            t.resourceNode = 'timber_grove';
            t.resourceAmount = 220;
          }
        }
        if (!t.buildingId && t.resourceNode === 'berry_bush') {
          t.resourceAmount = Math.min(400, t.resourceAmount + 120);
        } else if (
          !t.buildingId &&
          t.resourceNode === 'none' &&
          t.terrain === 'fertile' &&
          ((t.x * 19 + t.z * 23) & 7) === 0
        ) {
          t.resourceNode = 'berry_bush';
          t.resourceAmount = 220;
        }
      });
      for (const u of state.units) {
        if (u.faction === 'hostile' || u.state === 'ko' || appliedIds.has(u.id)) continue;
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(u.id);
          u.hp = u.maxHp;
          u.statusEffects.blessed = 32;
          delete u.statusEffects.cursed;
          delete u.statusEffects.plagued;
          delete u.statusEffects.frozen;
        }
      }
      for (const b of state.buildings) {
        if (appliedIds.has(b.id)) continue;
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(b.id);
          b.hp = b.maxHp;
          b.blessedTimer = 35;
          b.cursedTimer = 0;
          if (b.constructionProgress < 100) {
            b.constructionProgress = Math.min(100, b.constructionProgress + 35);
          }
        }
      }
      for (const v of state.vehicles ?? []) {
        if (appliedIds.has(v.id)) continue;
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(v.id);
          v.hp = v.maxHp ?? 150;
        }
      }
      break;
    }

    case 'curse_wave': {
      // Occult Abyssal Hex: corrupts souls & rots structures (leaves biome terrain & sea reefs distinct from Plague Spore!)
      forEachTileInBounds(state, targetX - maxR, targetX + maxR, targetZ - maxR, targetZ + maxR, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) return;
        if (prevR > 0 && dSq < tileMinSq) return;
        t.cursedTimer = 30;
        t.blessedTimer = 0;
      });
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded || appliedIds.has(u.id)) continue;
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(u.id);
          u.statusEffects.cursed = 30;
          delete u.statusEffects.blessed;
          u.hp = Math.max(5, u.hp - 45);
        }
      }
      for (const b of state.buildings) {
        if (b.shieldTimer > 0 || appliedIds.has(b.id)) continue;
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(b.id);
          b.cursedTimer = 30;
          b.blessedTimer = 0;
          b.hp = Math.max(10, b.hp - 55);
        }
      }
      for (const v of state.vehicles ?? []) {
        if (appliedIds.has(v.id)) continue;
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(v.id);
          v.hp = Math.max(0, (v.hp ?? 100) - 55);
        }
      }
      break;
    }

    case 'frenzy_wave': {
      forEachTileInBounds(state, targetX - maxR, targetX + maxR, targetZ - maxR, targetZ + maxR, (t) => {
        if (t.height <= 0 || t.buildingId) return;
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) return;
        if (prevR > 0 && dSq < tileMinSq) return;
        if (dSq <= 4.2) {
          if (t.resourceNode === 'timber_grove') {
            preserveTreeBiomeBeforeScorch(t);
            t.burntTree = true;
          }
          t.terrain = 'scorched';
        } else if (Math.abs(dSq - maxRSq * 0.68) < 2.0 && ((t.x * 13 + t.z * 7) % 6 === 0)) {
          t.onFireTimer = 6;
        }
      });
      for (const u of state.units) {
        if (u.state === 'ko' || appliedIds.has(u.id)) continue;
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(u.id);
          u.statusEffects.frenzied = 30;
          u.hp = u.maxHp;
          u.carryingAmount = 0;
          u.carryingType = null;
          u.actionCooldown = 0;
        }
      }
      break;
    }

    case 'terraform_wave': {
      const isWaterTarget = Boolean(meta?.waveWaterTarget);
      const targetH = meta?.waveTargetHeight ?? 3;
      const epochIdx = meta?.waveEpochIdx ?? state.epochIndex;
      forEachTileInBounds(state, targetX - maxR, targetX + maxR, targetZ - maxR, targetZ + maxR, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) return;
        if (prevR > 0 && dSq < tileMinSq) return;
        t.onFireTimer = 0;
        t.cursedTimer = 0;
        t.blessedTimer = 30;
        clearBurntTreeState(t);
        if (isWaterTarget) {
          if (dSq <= maxRSq * 0.38) {
            t.height = Math.max(2, t.height);
            t.terrain = epochIdx >= 6 ? 'crystal_field' : 'fertile';
            if (t.resourceNode === 'coral_reef' || t.resourceNode === 'scrap_flotsam' || t.resourceNode === 'atlantis_ruin') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
              t.coralBleachTimer = 0;
            }
          } else if (dSq <= maxRSq * 0.72) {
            t.height = Math.max(1, t.height);
            t.terrain = t.height >= 2 ? 'grass' : 'sand';
            if (t.resourceNode === 'coral_reef' || t.resourceNode === 'scrap_flotsam' || t.resourceNode === 'atlantis_ruin') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
              t.coralBleachTimer = 0;
            }
          } else if (t.height === 0) {
            t.terrain = 'shallow_water';
          }
        } else {
          if (t.height === 0) {
            if (dSq <= maxRSq * 0.65 && t.terrain === 'deep_water') {
              t.terrain = 'shallow_water';
            }
            return;
          }
          t.height = dSq <= maxRSq * 0.62 ? targetH : Math.max(1, targetH - 1);
          if (!t.buildingId) {
            if (epochIdx >= 6 && dSq <= maxRSq * 0.5) {
              t.terrain = 'crystal_field';
            } else if (t.terrain === 'scorched' || t.terrain === 'void_goo') {
              t.terrain = dSq <= maxRSq * 0.5 ? 'grass' : 'savanna';
            } else if (t.terrain === 'sand' || t.terrain === 'swamp' || t.terrain === 'badlands') {
              t.terrain = dSq <= maxRSq * 0.55 ? 'fertile' : 'grass';
            } else if (t.terrain === 'rock' || t.terrain === 'snow' || t.terrain === 'mountain' || t.terrain === 'tundra') {
              t.terrain = t.height >= 8 ? 'snow' : t.height >= 5 ? 'mountain' : 'grass';
            } else if (t.terrain === 'savanna') {
              t.terrain = 'grass';
            } else if ((t.terrain === 'grass' || t.terrain === 'blossom') && dSq <= maxRSq * 0.65) {
              t.terrain = 'fertile';
            }
          }
        }
      });
      break;
    }
  }
}

function findTargetedKingdomId(
  state: SimulationState,
  targetX: number,
  targetZ: number,
  maxRadius: number,
): string | undefined {
  const maxSq = maxRadius * maxRadius;
  let bestKid: string | undefined;
  let bestDistSq = maxSq;
  for (const b of state.buildings) {
    if (!b.settlementId || b.hp <= 0) continue;
    const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
    if (dSq <= bestDistSq) {
      bestDistSq = dSq;
      bestKid = getKingdomId(state, b.settlementId);
    }
  }
  for (const u of state.units) {
    if (u.faction !== 'civilization' || u.state === 'ko') continue;
    const kid = u.kingdomId ?? (u.settlementId ? getKingdomId(state, u.settlementId) : undefined);
    if (!kid) continue;
    const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
    if (dSq <= bestDistSq) {
      bestDistSq = dSq;
      bestKid = kid;
    }
  }
  return bestKid;
}

export function executeGodPowerImpact(
  state: SimulationState,
  powerType: GodPowerType,
  targetX: number,
  targetZ: number,
  options?: {
    faultSegments?: EarthquakeFaultSegment[];
    quakeShapeKind?: EarthquakeShapeKind;
    quakeExtent?: number;
    radiusOverride?: number;
  },
): boolean {
  const def = GOD_POWERS.find((p) => p.type === powerType);
  if (!def) return false;

  const r =
    options?.radiusOverride !== undefined && Number.isFinite(options.radiusOverride)
      ? Math.max(0.85, Math.min(28, options.radiusOverride))
      : def.radius;
  const rSq = r * r;
  const centerTile = getTile(state, targetX, targetZ);

  if (!state.activeHazards) state.activeHazards = [];
  let isHeavy = false;

  switch (powerType) {
    case 'blessing': {
      // Cancel overlapping opposite curse waves so opposing fronts don't fight behind this wave
      state.activeHazards = state.activeHazards.filter(
        (h) => h.kind !== 'curse_wave' || Math.hypot(h.x - targetX, h.z - targetZ) > r + h.radius,
      );
      const seedR = Math.min(r, 1.55);
      const haz: ActiveHazardZone = {
        id: nextEntityId('haz'),
        kind: 'blessing_wave',
        x: targetX,
        z: targetZ,
        currentRadius: seedR,
        maxRadius: r,
        radius: r,
        remaining: 1.45,
        duration: 1.45,
        tickTimer: 0,
      };
      applyExpandingWaveSlice(state, 'blessing_wave', targetX, targetZ, r, 0, seedR, getWaveAppliedSet(haz));
      state.activeHazards.push(haz);
      state.happiness = Math.min(100, state.happiness + 15);
      addChronicle(state, 'Divine Blessing radiated outward, healing citizens and blooming meadows.', 'divine');
      break;
    }

    case 'rain_of_plenty': {
      // Check if an arriving rain_cloud was already spawned at cast time (when deferImpact: true)
      const existingCloud = state.activeHazards.find(
        (h) =>
          h.kind === 'rain_cloud' &&
          h.impactPending &&
          Math.hypot((h.targetX ?? h.x) - targetX, (h.targetZ ?? h.z) - targetZ) < 1.5,
      );
      if (existingCloud) {
        existingCloud.arrivalRemaining = 0;
        existingCloud.impactPending = false;
        existingCloud.x = targetX - (existingCloud.windX ?? 0.78) * 1.5;
        existingCloud.z = targetZ - (existingCloud.windZ ?? 0.62) * 1.5;
        existingCloud.currentSpeed = 0.55;
      } else {
        const windAngle = 0.58 + (((targetX * 17 + targetZ * 31) & 7) - 3.5) * 0.08;
        const windX = Math.cos(windAngle);
        const windZ = Math.sin(windAngle);
        state.activeHazards.push({
          id: nextEntityId('haz'),
          kind: 'rain_cloud',
          x: targetX - windX * 1.5,
          z: targetZ - windZ * 1.5,
          targetX,
          targetZ,
          windX,
          windZ,
          arrivalRemaining: 0,
          arrivalDuration: 0.72,
          impactPending: false,
          currentSpeed: 0.55,
          radius: r,
          remaining: 10.5,
          duration: 10.5,
          tickTimer: 0,
        });
      }

      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height === 0) {
          t.cursedTimer = 0;
          t.blessedTimer = 25;
          if (t.resourceNode === 'coral_reef') {
            t.coralBleachTimer = 0;
            t.resourceAmount = Math.max(240, Math.min(360, t.resourceAmount + 130));
          }
        } else if (dSq <= rSq && t.height > 0) {
          t.onFireTimer = 0;
          t.cursedTimer = 0;
          t.blessedTimer = 25;
          const wasScorched = t.terrain === 'scorched' || t.terrain === 'void_goo';
          if (wasScorched) {
            t.terrain = 'grass';
          } else if ((t.terrain === 'sand' || t.terrain === 'savanna') && dSq <= rSq * 0.75) {
            t.terrain = dSq <= rSq * 0.3 ? 'fertile' : 'grass';
          }
          if (!t.buildingId && !wasScorched) {
            if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
              t.resourceAmount = Math.min(420, t.resourceAmount + 130);
            } else if (
              t.resourceNode === 'none' &&
              dSq <= 16.0 &&
              (t.terrain === 'grass' || t.terrain === 'fertile') &&
              ((t.x * 31 + t.z * 17 + Math.round(state.year * 10)) & 7) === 0
            ) {
              // Sparse natural sprouts on bare living soil — no wall-to-wall tree spam
              t.terrain = 'fertile';
              t.resourceNode = 'berry_bush';
              t.resourceAmount = 200;
            }
          }
        }
      });
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko') {
          u.hp = Math.min(u.maxHp, u.hp + 25);
        }
      }
      grantResourcesToKingdomOrPool(state, { food: 45, wood: 25 });
      addChronicle(state, 'Monsoon cloudburst doused all fires and revitalized parched land.', 'divine');
      break;
    }

    case 'eureka': {
      isHeavy = true;
      grantResourcesToKingdomOrPool(state, { knowledge: 140 });
      const liveKids = getLiveKingdomIds(state);
      const boostKids = new Set<string>();
      const reachSq = (r * 2.6) ** 2;
      for (const b of state.buildings) {
        if (b.settlementId && (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2 <= reachSq) {
          boostKids.add(getKingdomId(state, b.settlementId));
        }
      }
      for (const u of state.units) {
        if (u.faction === 'civilization' && u.state !== 'ko' && (u.x - targetX) ** 2 + (u.z - targetZ) ** 2 <= reachSq) {
          const kid = u.kingdomId ?? (u.settlementId ? getKingdomId(state, u.settlementId) : undefined);
          if (kid) boostKids.add(kid);
        }
      }
      const targetKids = boostKids.size > 0 ? Array.from(boostKids) : liveKids;
      if (targetKids.length > 0) {
        if (!state.kingdomEpochProgress) state.kingdomEpochProgress = {};
        for (const kid of targetKids) {
          const curEp = getKingdomEpoch(state, kid);
          if (curEp < EPOCHS.length - 1) {
            const nextProg = (state.kingdomEpochProgress[kid] ?? 0) + 22;
            if (nextProg >= 100) {
              advanceKingdomEpoch(state, kid, false, { freeFromProgress: true, skipAverageSync: true });
            } else {
              state.kingdomEpochProgress[kid] = nextProg;
            }
          }
        }
        syncAverageEpochFromKingdoms(state);
      } else {
        state.epochProgress = Math.min(100, state.epochProgress + 22);
      }

      const targetKidSet = new Set(targetKids);
      const cityReachSq = (r * 2.6) ** 2;
      for (const u of state.units) {
        if (u.faction !== 'civilization' || u.state === 'ko') continue;
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        const uKid = u.kingdomId ?? (u.settlementId ? getKingdomId(state, u.settlementId) : undefined);
        if (dSq <= rSq || (uKid && targetKidSet.has(uKid) && dSq <= cityReachSq)) {
          u.statusEffects.blessed = Math.max(u.statusEffects.blessed ?? 0, 25);
        }
      }
      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        const bKid = b.settlementId ? getKingdomId(state, b.settlementId) : undefined;
        if (dSq <= rSq || (bKid && targetKidSet.has(bKid) && dSq <= cityReachSq)) {
          b.constructionProgress = 100;
          b.hp = b.maxHp;
          b.blessedTimer = Math.max(b.blessedTimer, 25);
          b.cursedTimer = 0;
        }
      }
      for (const v of state.vehicles ?? []) {
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        if (dSq <= rSq) {
          v.hp = v.maxHp ?? 150;
        }
      }
      // Pave stone roads around structures & crystallize nearby stone outcrops
      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0) {
          if (t.resourceNode === 'stone_outcrop' && dSq <= rSq * 0.45) {
            t.resourceNode = 'crystal_monolith';
            t.resourceAmount = 360;
          } else if (
            !t.buildingId &&
            t.resourceNode === 'none' &&
            dSq <= 6.5 &&
            (t.x === targetX || t.z === targetZ)
          ) {
            t.terrain = 'stone_road';
          }
        }
      });
      addChronicle(state, 'Divine Insight granted +140 Knowledge, boosted kingdom eras, repaired ships & completed builds!', 'divine');
      break;
    }

    case 'golden_age': {
      isHeavy = true;
      state.goldenAgeTimer = 35;
      state.happiness = 100;
      grantResourcesToKingdomOrPool(state, { food: 120, wood: 80, faith: 60 });
      for (const u of state.units) {
        if (u.faction === 'civilization' && u.state !== 'ko') {
          u.hp = u.maxHp;
          u.statusEffects.blessed = 35;
          delete u.statusEffects.cursed;
          delete u.statusEffects.plagued;
          delete u.statusEffects.frozen;
        }
      }
      for (const b of state.buildings) {
        b.hp = b.maxHp;
        b.cursedTimer = 0;
        b.blessedTimer = Math.max(b.blessedTimer, 20);
      }
      for (const v of state.vehicles ?? []) {
        v.hp = v.maxHp ?? 150;
      }
      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0) {
          t.onFireTimer = 0;
          t.cursedTimer = 0;
          t.blessedTimer = 35;
          if (t.buildingId) {
            if (t.terrain === 'stone_road') t.terrain = 'grass';
          } else if (t.terrain === 'scorched' || t.terrain === 'savanna' || t.terrain === 'swamp') {
            t.terrain = 'fertile';
          } else if (t.terrain === 'grass' && dSq <= rSq * 0.5 && t.resourceNode === 'none') {
            t.terrain = (t.x === targetX || t.z === targetZ) && dSq > 1.5 ? 'stone_road' : 'fertile';
          }
        }
      });
      // Inspire a baby boom across active towns
      const settlementIds = Array.from(new Set(state.buildings.map((b) => b.settlementId ?? 'city_default')));
      for (const sid of settlementIds) {
        const hub = state.buildings.find((b) => b.settlementId === sid && b.constructionProgress >= 100);
        if (hub) {
          const sp = state.settlementSpecies?.[sid] ?? 'human';
          spawnUnit(state, sp, hub.tileX, hub.tileZ, true, sid, { ageStage: 'child', isBirth: true });
          spawnUnit(state, sp, hub.tileX, hub.tileZ, true, sid, { ageStage: 'adult' });
        }
      }
      addChronicle(state, 'Golden Age dawned! +60 God Energy, 2x kingdom output, full repairs & booming towns.', 'epoch');
      break;
    }

    case 'divine_shield': {
      isHeavy = true;
      const targetKid = findTargetedKingdomId(state, targetX, targetZ, Math.max(r + 4.5, 11));
      const domeRadius = Math.max(r, targetKid ? 7.5 : r);
      const domeRSq = domeRadius * domeRadius;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'shield_dome',
        x: targetX,
        z: targetZ,
        radius: domeRadius,
        remaining: 18.0,
        duration: 18.0,
        tickTimer: 0,
        ownerKingdomId: targetKid,
      });
      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        const bKid = b.settlementId ? getKingdomId(state, b.settlementId) : undefined;
        const belongsToTargetKingdom = Boolean(targetKid && bKid === targetKid);
        if (belongsToTargetKingdom || (!targetKid && dSq <= domeRSq)) {
          b.hp = b.maxHp;
          b.cursedTimer = 0;
          b.shieldTimer = Math.max(b.shieldTimer, 40);
        }
      }
      for (const u of state.units) {
        if (u.state === 'ko') continue;
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        const uKid =
          u.faction === 'civilization'
            ? u.kingdomId ?? (u.settlementId ? getKingdomId(state, u.settlementId) : undefined)
            : undefined;
        const isEnemyOfTarget =
          u.faction === 'hostile' ||
          Boolean(
            targetKid &&
              uKid &&
              uKid !== targetKid &&
              getKingdomRelation(state, targetKid, uKid) === 'war',
          );
        if (isEnemyOfTarget && dSq <= domeRSq) {
          // Shockwave repels hostile raiders and invading enemy-kingdom soldiers outside the dome!
          const dist = Math.max(0.25, Math.sqrt(dSq));
          u.x = Math.max(1, Math.min(state.gridSize - 2, targetX + ((u.x - targetX) / dist) * (domeRadius + 2.0)));
          u.z = Math.max(1, Math.min(state.gridSize - 2, targetZ + ((u.z - targetZ) / dist) * (domeRadius + 2.0)));
          if (!u.statusEffects.shielded) {
            u.hp = Math.max(0, u.hp - 35);
          }
        } else if (
          (targetKid && uKid === targetKid) ||
          (!targetKid && u.faction === 'civilization' && dSq <= domeRSq)
        ) {
          u.statusEffects.shielded = Math.max(u.statusEffects.shielded ?? 0, 35);
          delete u.statusEffects.plagued;
          delete u.statusEffects.cursed;
          delete u.statusEffects.frozen;
          u.hp = u.maxHp;
        }
      }
      forEachTileInBounds(state, targetX - domeRadius, targetX + domeRadius, targetZ - domeRadius, targetZ + domeRadius, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= domeRSq && t.height > 0) {
          t.onFireTimer = 0;
          t.cursedTimer = 0;
          t.blessedTimer = 30;
        }
      });
      addChronicle(
        state,
        targetKid
          ? 'Protective Shield raised around the kingdom, repelling enemies and shielding all citizens and buildings!'
          : 'Protective Shield dome raised, repelling foes and shielding all within!',
        'divine',
      );
      break;
    }

    case 'bloodlust_frenzy': {
      isHeavy = true;
      const seedR = Math.min(r, 1.55);
      const haz: ActiveHazardZone = {
        id: nextEntityId('haz'),
        kind: 'frenzy_wave',
        x: targetX,
        z: targetZ,
        currentRadius: seedR,
        maxRadius: r,
        radius: r,
        remaining: 1.4,
        duration: 1.4,
        tickTimer: 0,
      };
      applyExpandingWaveSlice(state, 'frenzy_wave', targetX, targetZ, r, 0, seedR, getWaveAppliedSet(haz));
      state.activeHazards.push(haz);
      addChronicle(state, 'Rage cast! Units healed and enraged (+150% combat damage).', 'warning');
      break;
    }

    case 'curse': {
      isHeavy = true;
      state.activeHazards = state.activeHazards.filter(
        (h) => h.kind !== 'blessing_wave' || Math.hypot(h.x - targetX, h.z - targetZ) > r + h.radius,
      );
      const seedR = Math.min(r, 1.55);
      const haz: ActiveHazardZone = {
        id: nextEntityId('haz'),
        kind: 'curse_wave',
        x: targetX,
        z: targetZ,
        currentRadius: seedR,
        maxRadius: r,
        radius: r,
        remaining: 1.55,
        duration: 1.55,
        tickTimer: 0,
      };
      applyExpandingWaveSlice(state, 'curse_wave', targetX, targetZ, r, 0, seedR, getWaveAppliedSet(haz));
      state.activeHazards.push(haz);
      state.happiness = Math.max(10, state.happiness - 10);
      addChronicle(state, 'Curse weakened units and damaged buildings across the area.', 'warning');
      break;
    }

    case 'plague_miasma': {
      isHeavy = true;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'plague_cloud',
        x: targetX,
        z: targetZ,
        radius: r,
        remaining: 14.0,
        duration: 14.0,
        tickTimer: 0,
      });
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        const isConstructOrImmune =
          u.role === 'skeleton' ||
          u.role === 'alien_trooper' ||
          u.role === 'alien_ufo' ||
          u.role === 'alien_walker' ||
          MYTHICAL_ROLE_SET.has(u.role);
        if (dSq <= rSq && !u.statusEffects.shielded && !isConstructOrImmune) {
          u.statusEffects.plagued = 26;
        }
      }
      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height === 0) {
          damageOrBleachWaterTile(t, 260, false);
        } else if (dSq <= rSq && t.height > 0) {
          if (!t.buildingId && dSq <= rSq * 0.65) {
            if (
              t.terrain === 'fertile' ||
              t.terrain === 'grass' ||
              t.terrain === 'forest' ||
              t.terrain === 'jungle' ||
              t.terrain === 'blossom' ||
              t.terrain === 'taiga'
            ) {
              t.terrain = 'swamp';
            } else if (t.terrain === 'savanna' || t.terrain === 'badlands') {
              t.terrain = dSq <= rSq * 0.3 ? 'swamp' : 'sand';
            }
          }
          if (t.resourceNode === 'berry_bush') {
            t.resourceAmount = Math.floor(t.resourceAmount * 0.35);
          }
        }
      });
      state.happiness = Math.max(15, state.happiness - 12);
      addChronicle(state, 'Plague cloud spread sickness and spoiled nearby crops!', 'warning');
      break;
    }

    case 'lightning_smite': {
      isHeavy = true;
      const isWaterStrike =
        !centerTile ||
        centerTile.height === 0 ||
        centerTile.terrain === 'deep_water' ||
        centerTile.terrain === 'shallow_water';
      const effectiveRSq = isWaterStrike ? (r * 1.45) ** 2 : rSq;

      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= effectiveRSq && u.state !== 'ko') {
          if (u.faction === 'hostile') {
            u.hp = 0;
            u.state = 'ko';
            u.koTimer = 0.45;
            state.totalRaidersDefeated += 1;
          } else if (!u.statusEffects.shielded) {
            u.hp = Math.max(0, u.hp - (isWaterStrike ? 235 : 185));
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
            } else {
              const dist = Math.max(0.25, Math.sqrt(dSq));
              u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + ((u.x - targetX) / dist) * 2.8));
              u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + ((u.z - targetZ) / dist) * 2.8));
              u.altitude = Math.max(u.altitude ?? 0, 0.8);
              u.vzVertical = Math.max(u.vzVertical ?? 0, 5.5);
              u.fallDamageArmed = true;
            }
          }
        }
      }
      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= effectiveRSq && b.shieldTimer <= 0) {
          const coreDmg = dSq <= (r * 0.68) ** 2 ? 390 : 240;
          b.hp = Math.max(0, b.hp - coreDmg);
          const bt = getTile(state, b.tileX, b.tileZ);
          if (bt && bt.height > 0 && bt.blessedTimer <= 0 && b.hp > 0) {
            bt.onFireTimer = Math.max(bt.onFireTimer, 8.0);
          }
        }
      }
      for (const v of state.vehicles ?? []) {
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        if (dSq <= effectiveRSq) {
          v.hp = Math.max(0, (v.hp ?? 100) - (isWaterStrike ? 280 : 230));
        }
      }
      forEachTileInBounds(state, targetX - Math.max(Math.sqrt(effectiveRSq), r * 1.15, 2.5), targetX + Math.max(Math.sqrt(effectiveRSq), r * 1.15, 2.5), targetZ - Math.max(Math.sqrt(effectiveRSq), r * 1.15, 2.5), targetZ + Math.max(Math.sqrt(effectiveRSq), r * 1.15, 2.5), (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (t.height === 0 && dSq <= effectiveRSq * 0.75) {
          damageOrBleachWaterTile(t, 280, dSq <= 4.5);
        } else if (dSq <= 4.5 && t.height > 0) {
          if (dSq <= 2.2 && t.height >= 2 && !t.buildingId) {
            t.height = Math.max(1, t.height - 1);
          }
          // Sand fuses into fulgurite crystal_field; snow melts to rock; vegetation chars to scorched
          if (t.resourceNode === 'timber_grove') {
            preserveTreeBiomeBeforeScorch(t);
          }
          if (t.terrain === 'sand') {
            t.terrain = 'crystal_field';
            if (!t.buildingId && dSq <= 1.2) {
              t.resourceNode = 'crystal_monolith';
              t.resourceAmount = 320;
            }
          } else if (t.terrain === 'snow') {
            t.terrain = 'rock';
          } else {
            t.terrain = 'scorched';
          }
          t.onFireTimer = dSq <= 0.5 && t.terrain !== 'rock' ? 6.0 : 0;
          if (!t.buildingId && t.resourceNode === 'timber_grove') {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.burntTree = true;
            state.resources.wood += 10;
          }
        } else if (dSq <= rSq * 1.18 && t.height > 0) {
          if (dSq <= 6.25 && !t.buildingId) {
            if (t.resourceNode === 'timber_grove') {
              preserveTreeBiomeBeforeScorch(t);
            }
            if (t.terrain === 'sand') t.terrain = 'crystal_field';
            else if (t.terrain === 'snow') t.terrain = 'rock';
            else t.terrain = 'scorched';
            if (t.resourceNode === 'timber_grove') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
              if (t.terrain === 'scorched') t.burntTree = true;
              state.resources.wood += 8;
            }
          }
          if (
            dSq > 5.2 &&
            t.blessedTimer <= 0 &&
            (t.resourceNode === 'timber_grove' ||
              t.resourceNode === 'berry_bush' ||
              t.terrain === 'forest' ||
              t.terrain === 'savanna' ||
              t.terrain === 'fertile' ||
              t.terrain === 'grass' ||
              t.terrain === 'taiga' ||
              t.terrain === 'blossom' ||
              t.terrain === 'jungle')
          ) {
            if (t.resourceNode === 'timber_grove' || (t.x * 13 + t.z * 7) % 3 === 0) {
              t.onFireTimer = Math.max(t.onFireTimer, 7.5);
            }
          }
        }
      });
      addChronicle(
        state,
        isWaterStrike
          ? 'Lightning struck the sea across a wide area!'
          : 'Lightning struck the ground, damaging targets and starting fires!',
        'warning',
      );
      break;
    }

    case 'meteor_strike': {
      isHeavy = true;
      const isWaterImpact =
        !centerTile ||
        centerTile.height === 0 ||
        centerTile.terrain === 'deep_water' ||
        centerTile.terrain === 'shallow_water';

      if (isWaterImpact) {
        // OCEAN / WATER ASTEROID IMPACT: Never creates new land! Deepens impact trench & unleashes a massive Tsunami wave scaled to asteroid size
        const tsunamiMaxRadius = r * 3.8; // ~23.5 tiles reach for r=6.2
        state.activeHazards.push({
          id: nextEntityId('haz'),
          kind: 'tsunami_wave',
          x: targetX,
          z: targetZ,
          currentRadius: 1.2,
          maxRadius: tsunamiMaxRadius,
          radius: r,
          remaining: 4.5,
          duration: 4.5,
          tickTimer: 0,
        });

        // Deepen shallow water in the impact core to deep_water & flood/erode immediate shoreline
        forEachTileInBounds(state, targetX - r * 1.55, targetX + r * 1.55, targetZ - r * 1.55, targetZ + r * 1.55, (t) => {
          const dx = t.x - targetX;
          const dz = t.z - targetZ;
          const dSq = dx * dx + dz * dz;
          if (dSq <= (r * 1.55) ** 2) {
            t.onFireTimer = 0;
            t.cursedTimer = 0;
            if (t.height === 0) {
              damageOrBleachWaterTile(t, 450, true);
              if (dSq <= rSq * 0.85) {
                t.terrain = 'deep_water';
              }
            } else if (t.height === 1) {
              // Low shoreline right next to ocean asteroid impact is submerged or washed into wet sand
              if (!t.buildingId && dSq <= (r * 1.15) ** 2) {
                t.height = 0;
                t.terrain = 'shallow_water';
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              } else {
                t.terrain = 'sand';
                if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
                  t.resourceNode = 'none';
                  t.resourceAmount = 0;
                }
              }
            } else if (t.height === 2 && dSq <= (r * 1.35) ** 2) {
              if (!t.buildingId && dSq <= (r * 0.95) ** 2) {
                t.height = 1;
                t.terrain = 'sand';
              } else if (t.terrain !== 'rock' && t.terrain !== 'snow') {
                t.terrain = 'swamp';
              }
              if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            }
          }
        });

        // Immediate inner blast wave on naval/coastal units & buildings
        for (const b of state.buildings) {
          const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
          if (dSq <= (r * 1.45) ** 2) {
            if (b.shieldTimer <= 0) {
              b.hp = dSq <= rSq ? 0 : Math.max(0, b.hp - 650);
            } else {
              b.shieldTimer = 0;
              b.hp = Math.max(0, b.hp - 180);
            }
          }
        }
        for (const u of state.units) {
          const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
          if (dSq <= (r * 1.6) ** 2 && u.state !== 'ko' && !u.statusEffects.shielded) {
            u.hp = Math.max(0, u.hp - (dSq <= rSq ? 600 : 260));
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.5;
              if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
            } else {
              const dist = Math.max(0.3, Math.sqrt(dSq));
              u.vxAir = ((u.x - targetX) / dist) * 9.0;
              u.vzAir = ((u.z - targetZ) / dist) * 9.0;
              u.altitude = Math.max(u.altitude ?? 0, 1.4);
              u.vzVertical = 9.5;
              u.fallDamageArmed = true;
            }
          }
        }
        for (const v of state.vehicles ?? []) {
          const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
          if (dSq <= (r * 1.6) ** 2) {
            v.hp = dSq <= rSq ? 0 : Math.max(0, (v.hp ?? 100) - 420);
          }
        }

        addChronicle(
          state,
          'Meteor hit the ocean, triggering a giant Tsunami wave!',
          'warning',
        );
        break;
      }

      // LAND ASTEROID IMPACT: Carves crater relative to existing land elevation without turning ocean tiles into land
      const baseH = Math.max(2, centerTile.height);
      let waterTilesInRadius = 0;
      let waterSumX = 0;
      let waterSumZ = 0;
      forEachTileInBounds(state, targetX - (r + 1.8), targetX + (r + 1.8), targetZ - (r + 1.8), targetZ + (r + 1.8), (t) => {
        const dx = t.x - targetX;
        const dz = t.z - targetZ;
        const dSq = dx * dx + dz * dz;
        if (dSq <= rSq) {
          if (t.height === 0) {
            // Water tiles stay water (never raise land in water!)
            waterTilesInRadius++;
            waterSumX += t.x;
            waterSumZ += t.z;
            damageOrBleachWaterTile(t, 400, true);
            t.terrain = dSq <= 12.0 ? 'deep_water' : 'shallow_water';
            delete t.frozenWaterBase;
            t.onFireTimer = 0;
            return;
          }

          const tileH = Math.max(1, t.height);
          const wasSand = t.terrain === 'sand';
          const angleNoise = ((((t.x * 73856093) ^ (t.z * 19349663)) & 255) / 255.0 - 0.5) * 0.85;
          const effDSq = dSq + angleNoise;

          if (dSq <= 4.2) {
            // 1. Deep circular molten impact pit (height - 2)
            t.height = Math.max(1, Math.min(baseH, tileH) - 2);
            t.terrain = 'scorched';
            if (dx === 0 && dz === 0) {
              t.onFireTimer = 5;
              if (!t.buildingId) {
                t.resourceNode = 'ore_vein';
                t.resourceAmount = 500;
              }
            } else {
              t.onFireTimer = 0;
              if (!t.buildingId) {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            }
          } else if (effDSq <= 13.5) {
            // 2. Clean circular stepped inner crater bowl (height - 1, charred volcanic obsidian & magma cracks)
            t.height = Math.max(1, Math.min(baseH, tileH) - 1);
            t.terrain = 'scorched';
            t.onFireTimer = 0;
            if (!t.buildingId) {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
          } else if (effDSq <= 23.5 && !t.buildingId) {
            // 3. Continuous 360-degree circular raised rocky crater rim (height + 1)
            t.height = Math.min(10, tileH + 1);
            // Desert sand fuses into glassy crystal_field on the rim; normal earth upheaves rock
            t.terrain = effDSq <= 19.2 ? (wasSand ? 'crystal_field' : 'rock') : 'scorched';
            t.onFireTimer = 0;
            if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            } else if (t.resourceNode === 'none' && ((t.x * 11 + t.z * 7) % 10 === 0)) {
              t.resourceNode = wasSand ? 'crystal_monolith' : 'stone_outcrop';
              t.resourceAmount = 260;
            }
          } else if (!t.buildingId) {
            // 4. Outer scorched blast ring with hot crater embers & standing charred trees
            const hadTree = t.resourceNode === 'timber_grove';
            if (hadTree) {
              preserveTreeBiomeBeforeScorch(t);
            }
            t.terrain = 'scorched';
            if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            if (hadTree) {
              t.burntTree = true;
            }
            if (dSq >= 26 && (t.x * 19 + t.z * 31) % 4 === 0) {
              t.onFireTimer = 9;
            } else {
              t.onFireTimer = 0;
            }
          }
        } else if (dSq <= (r + 1.8) ** 2 && t.height > 0 && t.blessedTimer <= 0) {
          // 5. Hot meteor ejecta embers scatter just beyond the crater lip, igniting surrounding forests, brush & structures
          const hasFlammableCover =
            t.resourceNode === 'timber_grove' ||
            t.resourceNode === 'berry_bush' ||
            t.terrain === 'forest' ||
            t.terrain === 'jungle' ||
            t.terrain === 'taiga' ||
            t.terrain === 'blossom' ||
            t.terrain === 'savanna' ||
            t.terrain === 'fertile' ||
            t.terrain === 'grass' ||
            Boolean(t.buildingId);
          if (hasFlammableCover && (t.resourceNode === 'timber_grove' || (t.x * 17 + t.z * 23) % 3 === 0)) {
            t.onFireTimer = Math.max(t.onFireTimer, 7.5);
          }
        }
      });

      // If the land impact hit right on a coastline with water nearby, also trigger a coastal tsunami wave from the water center
      if (waterTilesInRadius >= 6) {
        const waveOriginX = Math.round(waterSumX / waterTilesInRadius);
        const waveOriginZ = Math.round(waterSumZ / waterTilesInRadius);
        state.activeHazards.push({
          id: nextEntityId('haz'),
          kind: 'tsunami_wave',
          x: waveOriginX,
          z: waveOriginZ,
          currentRadius: 1.5,
          maxRadius: r * 3.2,
          radius: r,
          remaining: 3.8,
          duration: 3.8,
          tickTimer: 0,
        });
      }

      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= rSq) {
          if (b.shieldTimer <= 0) {
            // Asteroid impact one-shots buildings inside core blast radius and demolishes outer ring
            b.hp = dSq <= (r * 0.85) ** 2 ? 0 : Math.max(0, b.hp - 750);
          } else {
            b.shieldTimer = 0;
            b.hp = Math.max(0, b.hp - 220);
          }
        }
      }
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko' && !u.statusEffects.shielded) {
          const coreHit = dSq <= (r * 0.68) ** 2;
          u.hp = Math.max(0, u.hp - (coreHit ? 650 : 280));
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.5;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          } else {
            const dist = Math.max(0.3, Math.sqrt(dSq));
            u.vxAir = ((u.x - targetX) / dist) * 8.5;
            u.vzAir = ((u.z - targetZ) / dist) * 8.5;
            u.altitude = Math.max(u.altitude ?? 0, 1.6);
            u.vzVertical = 10.5;
            u.fallDamageArmed = true;
          }
        }
      }
      for (const v of state.vehicles ?? []) {
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        if (dSq <= rSq) {
          v.hp = dSq <= (r * 0.85) ** 2 ? 0 : Math.max(0, (v.hp ?? 100) - 520);
        }
      }
      state.resources.ore += 110;
      state.resources.alloy += 45;
      addChronicle(state, 'Meteor destroyed buildings and left a deep crater!', 'warning');
      break;
    }

    case 'terraform_beam': {
      isHeavy = true;
      // Mutagen Beam: evolves nearby units/wildlife into empowered champions & crystallizes ground with crystal monoliths
      let mutatedCount = 0;
      for (const u of state.units) {
        if (u.state === 'ko') continue;
        if ((u.x - targetX) ** 2 + (u.z - targetZ) ** 2 <= rSq) {
          u.maxHp = Math.min(900, Math.round(u.maxHp * 1.55));
          u.hp = u.maxHp;
          u.statusEffects.blessed = Math.max(u.statusEffects.blessed ?? 0, 28);
          u.statusEffects.shielded = Math.max(u.statusEffects.shielded ?? 0, 14);
          if (u.role === 'villager') {
            u.role = 'warrior';
          }
          if (u.faction === 'wildlife') {
            u.statusEffects.frenzied = Math.max(u.statusEffects.frenzied ?? 0, 18);
          }
          mutatedCount++;
        }
      }
      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > rSq || t.height <= 0 || t.buildingId) return;
        t.onFireTimer = 0;
        t.cursedTimer = 0;
        if (dSq <= rSq * 0.65) {
          t.terrain = 'crystal_field';
          if ((t.x * 11 + t.z * 17) % 7 === 0) {
            t.resourceNode = 'crystal_monolith';
            t.resourceAmount = 380;
          }
        }
      });
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'animal_attack',
        variant: 'horn_blast',
        originX: targetX,
        originZ: targetZ,
        x: targetX,
        y: (centerTile?.height ?? 2) * 0.45 + 0.5,
        z: targetZ,
        radius: r * 0.9,
        color: '#06d6a0',
        createdAt: Date.now(),
      });
      addChronicle(
        state,
        `Mutagen Beam crystallized the ground and evolved ${mutatedCount} creature${mutatedCount === 1 ? '' : 's'} into champions!`,
        'divine',
      );
      break;
    }

    case 'wormhole_ascension': {
      isHeavy = true;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'wormhole_rift',
        x: targetX,
        z: targetZ,
        radius: r,
        remaining: 5.5,
        duration: 5.5,
        tickTimer: 0,
        exploded: false,
      });
      grantResourcesToKingdomOrPool(state, { alloy: 140, knowledge: 160, faith: 25 });
      const liveKids = getLiveKingdomIds(state);
      const nearKids = new Set<string>();
      const kReachSq = (r * 2.8) ** 2;
      for (const b of state.buildings) {
        if (b.settlementId && (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2 <= kReachSq) {
          nearKids.add(getKingdomId(state, b.settlementId));
        }
      }
      const targetKids = nearKids.size > 0 ? Array.from(nearKids) : liveKids;
      if (targetKids.length > 0) {
        if (!state.kingdomEpochProgress) state.kingdomEpochProgress = {};
        for (const kid of targetKids) {
          if (getKingdomEpoch(state, kid) < EPOCHS.length - 1) {
            const np = (state.kingdomEpochProgress[kid] ?? 0) + 28;
            if (np >= 100) {
              advanceKingdomEpoch(state, kid, false, { freeFromProgress: true, skipAverageSync: true });
            } else {
              state.kingdomEpochProgress[kid] = np;
            }
          }
        }
        syncAverageEpochFromKingdoms(state);
      } else {
        state.epochProgress = Math.min(100, state.epochProgress + 28);
      }

      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0 && !t.buildingId) {
          if (dSq <= 12.5) {
            t.terrain = 'crystal_field';
            if (dSq <= 1.5 || (((t.x * 11 + t.z * 7) % 7 === 0) && dSq <= 9.5)) {
              t.resourceNode = 'crystal_monolith';
              t.resourceAmount = 500;
            }
          }
        }
      });
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko') {
          if (u.faction === 'hostile') {
            u.hp = Math.max(0, u.hp - 120);
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
              state.totalRaidersDefeated += 1;
            }
          } else {
            u.statusEffects.blessed = 25;
          }
        }
      }
      for (const v of state.vehicles ?? []) {
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        if (dSq <= rSq) {
          v.hp = Math.max(0, (v.hp ?? 100) - 120);
        }
      }
      addChronicle(state, 'Black Hole opened, boosting city alloy and research before exploding!', 'epoch');
      break;
    }

    case 'drag_entity': {
      isHeavy = false;
      break;
    }

    case 'heat_wave': {
      isHeavy = false;
      state.activeHazards = state.activeHazards.filter(
        (h) => h.kind !== 'freeze_wave_zone' || Math.hypot(h.x - targetX, h.z - targetZ) > r + h.radius,
      );
      const seedR = Math.min(r, 1.55);
      const haz: ActiveHazardZone = {
        id: nextEntityId('haz'),
        kind: 'heat_wave_zone',
        x: targetX,
        z: targetZ,
        currentRadius: seedR,
        maxRadius: r,
        radius: r,
        remaining: 0.45,
        duration: 0.45,
        tickTimer: 0,
      };
      applyExpandingWaveSlice(state, 'heat_wave_zone', targetX, targetZ, r, 0, seedR, getWaveAppliedSet(haz));
      state.activeHazards.push(haz);
      addChronicle(state, 'Heat Wave warmed the area, melting ice and drying out brush!', 'warning');
      break;
    }

    case 'freeze_snap': {
      isHeavy = false;
      state.activeHazards = state.activeHazards.filter(
        (h) => h.kind !== 'heat_wave_zone' || Math.hypot(h.x - targetX, h.z - targetZ) > r + h.radius,
      );
      const seedR = Math.min(r, 1.55);
      const haz: ActiveHazardZone = {
        id: nextEntityId('haz'),
        kind: 'freeze_wave_zone',
        x: targetX,
        z: targetZ,
        currentRadius: seedR,
        maxRadius: r,
        radius: r,
        remaining: 0.45,
        duration: 0.45,
        tickTimer: 0,
      };
      applyExpandingWaveSlice(state, 'freeze_wave_zone', targetX, targetZ, r, 0, seedR, getWaveAppliedSet(haz));
      state.activeHazards.push(haz);
      addChronicle(state, 'Freeze Wave cooled the area, freezing water and covering land in snow!', 'divine');
      break;
    }

    case 'tornado': {
      isHeavy = true;
      const nearbyTornado = state.activeHazards.find(
        (h) => h.kind === 'tornado_vortex' && Math.hypot(h.x - targetX, h.z - targetZ) <= 10.0,
      );
      if (nearbyTornado) {
        nearbyTornado.isSuper = true;
        nearbyTornado.radius = Math.max(nearbyTornado.radius, 8.2);
        nearbyTornado.remaining = Math.max(nearbyTornado.remaining, 16.0);
        nearbyTornado.duration = Math.max(nearbyTornado.duration, 16.0);
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'hit_spark',
          x: nearbyTornado.x,
          y: 2.2,
          z: nearbyTornado.z,
          radius: 3.6,
          color: '#7c3aed',
          createdAt: Date.now(),
        });
        addChronicle(state, 'Two cyclones collided and fused into a colossal Mega Tornado!', 'warning');
      } else {
        const heading = (((targetX * 17 + targetZ * 31) & 63) / 64) * Math.PI * 2;
        state.activeHazards.push({
          id: nextEntityId('haz'),
          kind: 'tornado_vortex',
          x: targetX,
          z: targetZ,
          heading,
          radius: r,
          remaining: 11.0,
          duration: 11.0,
          tickTimer: 0,
        });
        addChronicle(state, 'A Tornado touched down and swept across the land!', 'warning');
      }
      break;
    }

    case 'tsunami': {
      isHeavy = true;
      const tsunamiMaxRadius = r * 4.0;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'tsunami_wave',
        x: targetX,
        z: targetZ,
        currentRadius: 1.5,
        maxRadius: tsunamiMaxRadius,
        radius: r,
        remaining: 5.0,
        duration: 5.0,
        tickTimer: 0,
      });
      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= rSq && b.shieldTimer <= 0) {
          b.hp = Math.max(0, b.hp - 360);
        }
      }
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko' && u.role !== 'dragon' && !u.statusEffects.shielded) {
          u.hp = 0;
          u.state = 'ko';
          u.koTimer = 0.5;
          if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
        }
      }
      for (const v of state.vehicles ?? []) {
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        if (dSq <= rSq) {
          v.hp = (v.y ?? 0) <= 2.5 ? 0 : Math.max(0, (v.hp ?? 100) - 180);
        }
      }
      addChronicle(state, 'A Tsunami wave surged ashore, flooding coastal towns!', 'warning');
      break;
    }

    case 'earthquake': {
      isHeavy = true;
      const quakePlan =
        options?.faultSegments && options.faultSegments.length > 0
          ? {
              faultSegments: options.faultSegments,
              quakeShapeKind: options.quakeShapeKind ?? 'branching_fault',
              quakeExtent: options.quakeExtent ?? r,
            }
          : generateEarthquakeFaultNetwork(targetX, targetZ, r);

      const { faultSegments, quakeShapeKind, quakeExtent } = quakePlan;

      const isUnderwaterQuake = !centerTile || centerTile.height === 0;
      if (isUnderwaterQuake) {
        state.activeHazards.push({
          id: nextEntityId('haz'),
          kind: 'tsunami_wave',
          x: targetX,
          z: targetZ,
          currentRadius: 1.4,
          maxRadius: r * 3.1,
          radius: r,
          remaining: 4.0,
          duration: 4.0,
          tickTimer: 0,
        });
      }

      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'earthquake_zone',
        x: targetX,
        z: targetZ,
        radius: quakeExtent,
        remaining: quakeShapeKind === 'short_rupture' ? 2.8 : quakeShapeKind === 'long_rift' ? 4.1 : 3.6,
        duration: quakeShapeKind === 'short_rupture' ? 2.8 : quakeShapeKind === 'long_rift' ? 4.1 : 3.6,
        tickTimer: 0,
        faultSegments,
        quakeShapeKind,
        quakeExtent,
      });

      let minX = targetX - r;
      let maxX = targetX + r;
      let minZ = targetZ - r;
      let maxZ = targetZ + r;
      for (const seg of faultSegments) {
        const pad = seg.width * 3.0 + 1.5;
        minX = Math.min(minX, seg.x1 - pad, seg.x2 - pad);
        maxX = Math.max(maxX, seg.x1 + pad, seg.x2 + pad);
        minZ = Math.min(minZ, seg.z1 - pad, seg.z2 - pad);
        maxZ = Math.max(maxZ, seg.z1 + pad, seg.z2 + pad);
      }

      let displacedTiles = 0;
      let mountainsFormed = 0;
      const isOrogenic = quakeShapeKind === 'orogenic_uplift';

      forEachTileInBounds(state, minX, maxX, minZ, maxZ, (t) => {
        if (t.x < minX || t.x > maxX || t.z < minZ || t.z > maxZ) return;
        if (t.height === 0) {
          const { distSq, segment } = closestFaultDistanceSq(t.x, t.z, faultSegments);
          if (segment && distSq <= (segment.width * 1.5) ** 2) {
            damageOrBleachWaterTile(t, 260, true);
          }
          return; // Never thrust ocean floor tiles into dry land
        }

        const dCenterSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        const { distSq, signedSide, segment } = closestFaultDistanceSq(t.x, t.z, faultSegments);
        if (!segment) return;

        const segWidth = segment.width;
        const hashVal = Math.abs((t.x * 73856093) ^ (t.z * 19349663) ^ Math.round(targetX * 31));
        const jitter = ((hashVal & 15) / 15 - 0.5) * 0.72;
        const hBit = hashVal & 7;
        const dist = Math.sqrt(distSq);
        const effDist = Math.max(0, dist + jitter * 0.55);

        const coreBand = segWidth * (isOrogenic ? 0.55 : 1.05);
        const ridgeOuter = segWidth * (isOrogenic ? 2.85 : 2.35);

        if (!t.buildingId) {
          if (isOrogenic && effDist <= coreBand * 1.15 && hBit <= 4) {
            // Convergent mountain collision: heave towering central mountain spine skyward
            const lift = 3 + (hBit <= 1 ? 2 : 1);
            t.height = Math.min(10, Math.max(5, t.height + lift));
            t.farmSettlementId = undefined;
            t.terrain = t.height >= 8 ? 'snow' : 'mountain';
            if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
              t.resourceNode = hBit <= 2 ? 'stone_outcrop' : 'ore_vein';
              t.resourceAmount = 320;
            }
            displacedTiles++;
            mountainsFormed++;
          } else if (effDist <= coreBand) {
            // Tectonic fault trench splits open along the winding/branching fault line
            const drop = t.height >= 4 ? 2 : 1;
            t.height = Math.max(1, t.height - drop);
            t.terrain = effDist <= coreBand * 0.55 && hBit <= 2 ? 'scorched' : 'rock';
            t.farmSettlementId = undefined;
            if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            if (t.resourceNode === 'none' && hBit <= 1) {
              t.resourceNode = hBit === 0 ? 'ore_vein' : 'stone_outcrop';
              t.resourceAmount = 280;
            }
            displacedTiles++;
          } else if (effDist <= ridgeOuter) {
            // Asymmetric tectonic uplift: thrust ridges & new mountain chains along fault flanks
            const favoredSide = segment.upliftBias >= 0 || signedSide > 0 || isOrogenic;
            const upliftChance = isOrogenic ? 7 : favoredSide ? 5 : 3;
            if (hBit <= upliftChance) {
              const peakFactor = Math.max(0, 1 - (effDist - coreBand) / Math.max(0.5, ridgeOuter - coreBand));
              let boost = isOrogenic
                ? Math.round(2 + peakFactor * 3 + (hBit <= 1 ? 1 : 0))
                : segment.upliftBias > 0.55 && peakFactor > 0.45 && hBit <= 2
                  ? 3
                  : peakFactor > 0.5 && hBit <= 3
                    ? 2
                    : 1;
              if (segment.isBranch && !isOrogenic) {
                boost = Math.max(1, boost - (hBit > 2 ? 1 : 0));
              }
              t.height = Math.min(10, t.height + boost);
              t.farmSettlementId = undefined;
              if (t.height >= 8) {
                t.terrain = 'snow';
                mountainsFormed++;
              } else if (t.height >= 5) {
                t.terrain = t.terrain === 'badlands' && !isOrogenic ? 'badlands' : 'mountain';
                mountainsFormed++;
              } else if (
                t.terrain === 'stone_road' ||
                t.terrain === 'rail_track' ||
                t.terrain === 'grass' ||
                t.terrain === 'fertile'
              ) {
                t.terrain = t.height >= 4 ? 'highland' : t.terrain === 'stone_road' || t.terrain === 'rail_track' ? 'highland' : 'rock';
              }
              if (t.resourceNode === 'berry_bush') {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
              if (t.height >= 5 && t.resourceNode === 'timber_grove') {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
              if (t.height >= 5 && t.resourceNode === 'none' && hBit <= 1) {
                t.resourceNode = hBit === 0 ? 'ore_vein' : 'stone_outcrop';
                t.resourceAmount = 300;
              }
              displacedTiles++;
            } else if ((t.terrain === 'stone_road' || t.terrain === 'rail_track') && hBit <= 5) {
              t.terrain = 'highland';
              displacedTiles++;
            }
          } else if (dCenterSq <= rSq && (t.terrain === 'stone_road' || t.terrain === 'rail_track') && hBit <= 3) {
            t.terrain = 'highland';
            displacedTiles++;
          }
        }
      });

      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        const segHit = closestFaultDistanceSq(b.tileX, b.tileZ, faultSegments);
        const segReachSq = ((segHit.segment?.width ?? 1) * 2.1 + 1.6) ** 2;
        if ((dSq <= rSq || segHit.distSq <= segReachSq) && b.shieldTimer <= 0) {
          const proximity = 1 - Math.min(1, Math.sqrt(Math.min(dSq, segHit.distSq)) / Math.max(1, r));
          const dmg = Math.round(115 + proximity * 125);
          b.hp = Math.max(0, b.hp - dmg);
        }
      }

      for (const u of state.units) {
        const dx = u.x - targetX;
        const dz = u.z - targetZ;
        const dSq = dx * dx + dz * dz;
        const segHit = closestFaultDistanceSq(u.x, u.z, faultSegments);
        const segReachSq = ((segHit.segment?.width ?? 1) * 2.2 + 1.6) ** 2;
        if ((dSq <= rSq || segHit.distSq <= segReachSq) && u.state !== 'ko' && !u.statusEffects.shielded) {
          u.hp = Math.max(0, u.hp - 58);
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.45;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          } else {
            const dist = Math.max(0.3, Math.sqrt(dSq));
            u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + (dx / dist) * 2.1));
            u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + (dz / dist) * 2.1));
          }
        }
      }
      for (const v of state.vehicles ?? []) {
        if ((v.y ?? 0) > 1.8) continue;
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        const segHit = closestFaultDistanceSq(v.x, v.z, faultSegments);
        const segReachSq = ((segHit.segment?.width ?? 1) * 2.2 + 1.6) ** 2;
        if (dSq <= rSq || segHit.distSq <= segReachSq) {
          v.hp = Math.max(0, (v.hp ?? 100) - 160);
        }
      }

      state.happiness = Math.max(15, state.happiness - 8);
      const chronicleMsg =
        isUnderwaterQuake && displacedTiles === 0
          ? 'An undersea Earthquake shook the ocean floor and triggered a Tsunami!'
          : quakeShapeKind === 'orogenic_uplift' || mountainsFormed >= 12
            ? 'Earthquake pushed up new mountain peaks!'
            : quakeShapeKind === 'long_rift'
              ? 'A large earthquake fault split open across the land!'
              : quakeShapeKind === 'branching_fault'
                ? 'Earthquake fault lines cracked the ground and raised rocky ridges!'
                : displacedTiles > 0
                  ? 'An earthquake cracked the ground and damaged nearby buildings!'
                  : 'Earthquake tremors shook the ground!';
      addChronicle(state, chronicleMsg, 'warning');
      break;
    }

    case 'volcano_eruption': {
      isHeavy = true;
      const isUnderwaterEruption =
        !centerTile ||
        centerTile.height === 0 ||
        centerTile.terrain === 'deep_water' ||
        centerTile.terrain === 'shallow_water' ||
        centerTile.terrain === 'ice';

      if (isUnderwaterEruption) {
        // Underwater Hydrothermal / Submarine Eruption: boils sea, melts sea ice, unleashes Tsunami — NEVER creates dry land from water!
        const tsunamiMaxRadius = r * 3.4;
        state.activeHazards.push({
          id: nextEntityId('haz'),
          kind: 'tsunami_wave',
          x: targetX,
          z: targetZ,
          currentRadius: 1.2,
          maxRadius: tsunamiMaxRadius,
          radius: r,
          remaining: 4.2,
          duration: 4.2,
          tickTimer: 0,
        });
        forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
          const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
          if (dSq <= rSq) {
            t.blessedTimer = 0;
            t.tempOffset = Math.min(80, (t.tempOffset ?? 0) + 32);
            if (t.height === 0) {
              damageOrBleachWaterTile(t, 450, true);
              if (t.terrain === 'ice') {
                t.terrain = 'shallow_water';
                delete t.frozenWaterBase;
              }
              if (dSq <= rSq * 0.55 && t.terrain !== 'stone_road' && t.terrain !== 'rail_track') {
                t.terrain = 'deep_water';
              }
            } else if (!t.buildingId && dSq <= rSq * 0.65) {
              t.terrain = 'scorched';
            }
          }
        });
        for (const u of state.units) {
          const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
          if (dSq <= rSq && u.state !== 'ko' && !u.statusEffects.shielded) {
            u.hp = Math.max(0, u.hp - 180);
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
              if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
            }
          }
        }
        for (const v of state.vehicles ?? []) {
          const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
          if (dSq <= rSq) {
            v.hp = Math.max(0, (v.hp ?? 100) - 240);
          }
        }
        addChronicle(state, 'An underwater Volcano erupted, heating the sea and triggering a Tsunami!', 'warning');
        break;
      }

      const coneR = Math.max(4.5, r * 0.72);
      const coneRSq = coneR * coneR;
      const blastR = Math.max(r * 1.35, 8.5);
      const blastRSq = blastR * blastR;

      forEachTileInBounds(state, targetX - blastR, targetX + blastR, targetZ - blastR, targetZ + blastR, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > blastRSq) return;
        t.blessedTimer = 0;

        if (dSq <= coneRSq) {
          const dist = Math.sqrt(dSq);
          if (t.height === 0) {
            // Never raise ocean water tiles into land around coastal volcano!
            damageOrBleachWaterTile(t, 400, true);
            if (t.terrain === 'ice') {
              t.terrain = t.frozenWaterBase ?? 'shallow_water';
              delete t.frozenWaterBase;
            }
            return;
          }
          if (!t.buildingId) {
            t.farmSettlementId = undefined;
            if (dist <= 1.35) {
              // Deep glowing volcanic caldera crater
              t.height = Math.max(4, Math.min(8, Math.max(t.height + 2, 5)));
              t.terrain = 'scorched';
              t.onFireTimer = Math.max(t.onFireTimer, 18.0);
              t.fireColor = '#ff5400';
              if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
                t.resourceNode = 'ore_vein';
                t.resourceAmount = 420;
              }
            } else {
              // Sloped obsidian/mountain volcano flanks
              const slopeFactor = 1 - (dist - 1.35) / Math.max(0.5, coneR - 1.35);
              t.height = Math.min(9, Math.max(t.height, Math.round(3 + slopeFactor * 4.5)));
              t.terrain = slopeFactor > 0.58 ? 'mountain' : slopeFactor > 0.28 ? 'rock' : 'scorched';
              if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
                t.resourceNode = ((t.x * 7 + t.z * 11) & 3) === 0 ? 'ore_vein' : 'none';
                t.resourceAmount = t.resourceNode === 'ore_vein' ? 320 : 0;
              }
              if (((t.x * 13 + t.z * 17) & 3) === 0) {
                t.onFireTimer = Math.max(t.onFireTimer, 9.0);
              }
            }
          }
        } else if (t.height > 0 && !t.buildingId) {
          if (dSq <= rSq) {
            if (((t.x + t.z) & 1) === 0) {
              if (t.resourceNode === 'timber_grove') {
                preserveTreeBiomeBeforeScorch(t);
                t.burntTree = true;
              }
              t.terrain = 'scorched';
            }
            if (t.resourceNode === 'berry_bush') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
          }
          if (((t.x * 19 + t.z * 23) % 5) === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 7.5);
          }
        }
      });

      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= rSq && b.shieldTimer <= 0) {
          b.hp = dSq <= coneRSq * 0.4 ? 0 : Math.max(0, b.hp - 360);
        }
      }
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded) continue;
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq) {
          u.hp = Math.max(0, u.hp - (dSq <= coneRSq ? 320 : 125));
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.45;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          } else {
            const dist = Math.max(0.25, Math.sqrt(dSq));
            u.vxAir = ((u.x - targetX) / dist) * 9.5;
            u.vzAir = ((u.z - targetZ) / dist) * 9.5;
            u.altitude = Math.max(u.altitude ?? 0, 1.8);
            u.vzVertical = 9.0;
            u.fallDamageArmed = true;
          }
        }
      }
      for (const v of state.vehicles ?? []) {
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        if (dSq <= rSq) {
          v.hp = Math.max(0, (v.hp ?? 100) - 260);
        }
      }

      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'volcano_eruption',
        x: targetX,
        z: targetZ,
        radius: blastR,
        remaining: 9.5,
        duration: 9.5,
        tickTimer: 0.35,
      });
      state.resources.ore += 80;
      addChronicle(state, 'A Volcano erupted, throwing lava rocks across the area!', 'warning');
      break;
    }

    case 'super_tornado': {
      isHeavy = true;
      const heading = (((targetX * 19 + targetZ * 37) & 63) / 64) * Math.PI * 2;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'tornado_vortex',
        isSuper: true,
        x: targetX,
        z: targetZ,
        heading,
        radius: r,
        remaining: 14.0,
        duration: 14.0,
        tickTimer: 0,
      });
      addChronicle(state, 'A Mega Tornado formed and tore across the landscape!', 'warning');
      break;
    }

    case 'void_goo': {
      isHeavy = true;
      let infectedCount = 0;
      let revivedCount = 0;
      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > rSq) return;
        t.onFireTimer = 0;
        t.fireColor = undefined;
        t.blessedTimer = 0;
        t.cursedTimer = 0;
        if (t.height === 0) {
          // Never create fake elevated land out of open ocean, but poison & curse the sea surface!
          t.cursedTimer = 25;
          damageOrBleachWaterTile(t, 320, true);
          return;
        }
        t.terrain = 'void_goo';
        trackVoidGooTile(state, t.z * state.gridSize + t.x);
        t.farmSettlementId = undefined;
        if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
          t.resourceNode = 'none';
          t.resourceAmount = 0;
        }
        infectedCount++;
      });

      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= rSq && b.shieldTimer <= 0) {
          b.hp = dSq <= rSq * 0.6 ? 0 : Math.max(0, b.hp - 340);
        }
      }

      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded) continue;
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq) {
          killUnitIntoVoidWisp(state, u);
          revivedCount++;
        }
      }

      for (const v of state.vehicles ?? []) {
        const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
        if (dSq <= rSq) {
          v.hp = Math.max(0, (v.hp ?? 100) - 300);
        }
      }

      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'void_goo_splash',
        x: targetX,
        y: Math.max(0.36, (centerTile?.height ?? 0) * 0.45 + 0.2),
        z: targetZ,
        radius: r,
        color: '#a855f7',
        createdAt: Date.now(),
      });

      state.happiness = Math.max(8, state.happiness - 15);
      addChronicle(
        state,
        infectedCount === 0
          ? revivedCount > 0
            ? `Dark Ooze poisoned the waters and turned ${revivedCount} units into wisps!`
            : 'Dark Ooze poisoned the waters!'
          : revivedCount > 0
            ? `Dark Ooze covered ${infectedCount} tiles and turned ${revivedCount} units into wisps!`
            : `Dark Ooze spread across ${infectedCount} tiles!`,
        'warning',
      );
      break;
    }

    case 'undead_portal': {
      isHeavy = true;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'undead_portal',
        x: targetX,
        z: targetZ,
        radius: r,
        remaining: 22.0,
        duration: 22.0,
        tickTimer: 0.2,
        portalSpawnCount: 0,
      });
      // Immediately curse & darken the ground beneath the rift (without changing ocean height)
      const portalCurseRSq = Math.max(2.25, rSq);
      forEachTileInBounds(state, targetX - Math.max(1.5, r), targetX + Math.max(1.5, r), targetZ - Math.max(1.5, r), targetZ + Math.max(1.5, r), (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= portalCurseRSq) {
          t.cursedTimer = 25;
          t.blessedTimer = 0;
        }
      });
      // Initial vanguard skeletons
      for (let i = 0; i < 2; i++) {
        const sx = Math.max(2, Math.min(state.gridSize - 3, targetX + (i === 0 ? -1 : 1)));
        const sz = Math.max(2, Math.min(state.gridSize - 3, targetZ + (i === 0 ? 1 : -1)));
        spawnUnit(state, 'skeleton', sx, sz, true);
      }
      addChronicle(state, 'A Skeleton Portal opened, spawning hostile Skeletons!', 'warning');
      break;
    }

    case 'alien_invasion': {
      isHeavy = true;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'alien_mothership',
        x: targetX,
        z: targetZ,
        radius: r,
        remaining: 15.8,
        duration: 15.8,
        tickTimer: 0.4,
        beaconTimer: 2.0,
        laserSubTimer: 0.4,
        portalSpawnCount: 0,
      });
      addChronicle(state, 'Alien Invasion started! An Alien Mothership is entering low orbit!', 'warning');
      break;
    }

    case 'chrono_surge': {
      isHeavy = true;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'chrono_field',
        x: targetX,
        z: targetZ,
        radius: r,
        remaining: 14.0,
        duration: 14.0,
        tickTimer: 0.35,
      });
      // Immediate chronological pulse: regrow harvests, finish buildings, heal units/vehicles, boost nearby kingdom progress
      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0 && !t.buildingId) {
          if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
            t.resourceAmount = Math.min(450, t.resourceAmount + 180);
          } else if (t.terrain === 'fertile' && t.resourceNode === 'none' && ((t.x * 13 + t.z * 7) % 5 === 0)) {
            t.resourceNode = 'berry_bush';
            t.resourceAmount = 220;
          }
        }
      });
      const boostKids = new Set<string>();
      for (const b of state.buildings) {
        if ((b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2 <= rSq) {
          b.constructionProgress = 100;
          b.hp = b.maxHp;
          b.upgradeProgress = Math.min(99, (b.upgradeProgress ?? 0) + 45);
          if (b.settlementId) boostKids.add(getKingdomId(state, b.settlementId));
        }
      }
      for (const v of state.vehicles ?? []) {
        if ((v.x - targetX) ** 2 + (v.z - targetZ) ** 2 <= rSq) {
          v.hp = v.maxHp ?? 150;
        }
      }
      for (const u of state.units) {
        if (u.faction === 'civilization' && u.state !== 'ko' && (u.x - targetX) ** 2 + (u.z - targetZ) ** 2 <= rSq) {
          u.hp = Math.min(u.maxHp, u.hp + 55);
          u.statusEffects.blessed = 20;
          if (u.ageStage === 'child') {
            u.growthTimer = Math.max(0.5, (u.growthTimer ?? 12) * 0.25);
          }
          const kid = u.kingdomId ?? (u.settlementId ? getKingdomId(state, u.settlementId) : undefined);
          if (kid) boostKids.add(kid);
        }
      }
      if (boostKids.size > 0) {
        if (!state.kingdomEpochProgress) state.kingdomEpochProgress = {};
        for (const kid of boostKids) {
          if (getKingdomEpoch(state, kid) < EPOCHS.length - 1) {
            const np = (state.kingdomEpochProgress[kid] ?? 0) + 18;
            if (np >= 100) {
              advanceKingdomEpoch(state, kid, false, { freeFromProgress: true, skipAverageSync: true });
            } else {
              state.kingdomEpochProgress[kid] = np;
            }
          }
        }
        syncAverageEpochFromKingdoms(state);
      }
      addChronicle(state, 'Time Acceleration sped up the area! Builds finished, crops regrew, and cities advanced!', 'divine');
      break;
    }

    case 'harmony_dove': {
      isHeavy = false;
      const nearbyKids = new Set<string>();
      for (const b of state.buildings) {
        if (b.settlementId && (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2 <= rSq) {
          nearbyKids.add(getKingdomId(state, b.settlementId));
        }
      }
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko') {
          delete u.statusEffects.frenzied;
          delete u.statusEffects.cursed;
          delete u.statusEffects.plagued;
          if (u.faction === 'civilization') {
            u.hp = Math.min(u.maxHp, u.hp + 45);
            u.statusEffects.blessed = 20;
            const kid = u.kingdomId ?? (u.settlementId ? getKingdomId(state, u.settlementId) : undefined);
            if (kid) nearbyKids.add(kid);
          } else if (u.faction === 'wildlife') {
            u.state = 'idle';
            u.targetEntityId = null;
            u.underAttackTimer = 0;
          }
        }
      }
      const kidsArr = nearbyKids.size >= 2 ? Array.from(nearbyKids) : getLiveKingdomIds(state);
      if (!state.kingdomPeaceTreaties) state.kingdomPeaceTreaties = {};
      if (!state.kingdomWarStartYears) state.kingdomWarStartYears = {};
      for (let i = 0; i < kidsArr.length; i++) {
        for (let j = i + 1; j < kidsArr.length; j++) {
          setKingdomRelation(state, kidsArr[i], kidsArr[j], 'allied');
          const pKey = getKingdomPairKey(kidsArr[i], kidsArr[j]);
          state.kingdomPeaceTreaties[pKey] = Math.max(state.kingdomPeaceTreaties[pKey] ?? 0, state.year + 30);
          delete state.kingdomWarStartYears[pKey];
        }
      }
      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0) {
          t.cursedTimer = 0;
          t.onFireTimer = 0;
          t.blessedTimer = 30;
          clearBurntTreeState(t);
          if (!t.buildingId && dSq <= rSq * 0.55 && (t.terrain === 'grass' || t.terrain === 'savanna')) {
            t.terrain = (t.x + t.z) % 3 === 0 ? 'blossom' : 'fertile';
          }
        }
      });
      state.happiness = Math.min(100, state.happiness + 20);
      addChronicle(state, 'Peace Treaty ended wars, calmed predators, and grew meadows!', 'divine');
      break;
    }

    case 'start_war': {
      isHeavy = false;
      const affectedKids = new Set<string>();
      for (const b of state.buildings) {
        if (b.hp > 0 && b.settlementId && (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2 <= rSq) {
          affectedKids.add(getKingdomId(state, b.settlementId));
        }
      }
      for (const u of state.units) {
        if (u.state !== 'ko' && u.faction === 'civilization' && (u.x - targetX) ** 2 + (u.z - targetZ) ** 2 <= rSq) {
          const kid = u.kingdomId ?? (u.settlementId ? getKingdomId(state, u.settlementId) : undefined);
          if (kid) affectedKids.add(kid);
        }
      }
      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        const ownerSid = t.claimedSettlementId ?? t.farmSettlementId;
        if (ownerSid && (t.x - targetX) ** 2 + (t.z - targetZ) ** 2 <= rSq) {
          affectedKids.add(getKingdomId(state, ownerSid));
        }
      });

      const liveKids = getLiveKingdomIds(state);
      // Fallback: if cast slightly outside borders, pick nearest living kingdom within 18 tiles
      if (affectedKids.size === 0 && liveKids.length > 0) {
        let nearestKid: string | null = null;
        let bestDistSq = 18 * 18;
        for (const b of state.buildings) {
          if (b.hp <= 0 || !b.settlementId) continue;
          const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
          if (dSq <= bestDistSq) {
            bestDistSq = dSq;
            nearestKid = getKingdomId(state, b.settlementId);
          }
        }
        if (nearestKid) affectedKids.add(nearestKid);
      }

      if (affectedKids.size === 0) {
        addChronicle(state, 'Start War echoed over empty land — cast on a nation to ignite war!', 'warning');
        break;
      }

      if (!state.kingdomPeacefulTraits) state.kingdomPeacefulTraits = {};
      if (!state.kingdomPeaceTreaties) state.kingdomPeaceTreaties = {};
      if (!state.kingdomWarStartYears) state.kingdomWarStartYears = {};

      const affectedArr = Array.from(affectedKids);
      for (const kid of affectedArr) {
        // Turn affected nation aggressively expansionist
        state.kingdomPeacefulTraits[kid] = false;
      }

      const declaredPairs: Array<[string, string]> = [];
      const declareWarPair = (kA: string, kB: string) => {
        if (kA === kB) return;
        const pKey = getKingdomPairKey(kA, kB);
        const wasWar = getKingdomRelation(state, kA, kB) === 'war';
        delete state.kingdomPeaceTreaties![pKey];
        setKingdomRelation(state, kA, kB, 'war');
        state.kingdomWarStartYears![pKey] = state.year;
        if (!wasWar) {
          if (state.worldStats) state.worldStats.warsStarted += 1;
          declaredPairs.push([kA, kB]);
        }
      };

      if (affectedArr.length >= 2) {
        // Multiple nations caught in the cast radius -> ignite war between all of them
        for (let i = 0; i < affectedArr.length; i++) {
          for (let j = i + 1; j < affectedArr.length; j++) {
            declareWarPair(affectedArr[i], affectedArr[j]);
          }
        }
      } else {
        // Single nation targeted -> turn it aggressively expansionist and declare war on rival kingdoms
        const aggressor = affectedArr[0];
        const rivals = liveKids.filter((k) => k !== aggressor);
        // Sort rivals by distance to cast point so nearest neighbors are targeted first
        const rivalDist = new Map<string, number>();
        for (const rKid of rivals) {
          let minDSq = Infinity;
          for (const b of state.buildings) {
            if (b.hp <= 0 || !b.settlementId) continue;
            if (getKingdomId(state, b.settlementId) === rKid) {
              const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
              if (dSq < minDSq) minDSq = dSq;
            }
          }
          rivalDist.set(rKid, minDSq);
        }
        rivals.sort((a, b) => (rivalDist.get(a) ?? Infinity) - (rivalDist.get(b) ?? Infinity));
        // Prefer rivals not yet at war; declare war on up to 2 nearest rivals (or all if <= 2)
        const nonWarRivals = rivals.filter((k) => getKingdomRelation(state, aggressor, k) !== 'war');
        const warTargets = (nonWarRivals.length > 0 ? nonWarRivals : rivals).slice(0, 2);
        for (const tKid of warTargets) {
          declareWarPair(aggressor, tKid);
        }
      }

      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'animal_attack',
        variant: 'horn_blast',
        originX: targetX,
        originZ: targetZ,
        x: targetX,
        y: (centerTile?.height ?? 2) * 0.45 + 0.6,
        z: targetZ,
        radius: Math.max(4.5, r * 0.9),
        color: '#dc2626',
        createdAt: Date.now(),
      });

      const getKName = (kid: string) => state.settlementNames?.[kid] ?? 'Kingdom';
      if (state.worldRules?.warsEnabled === false) {
        addChronicle(
          state,
          `Start War turned ${affectedArr.map(getKName).join(', ')} Expansionist (enable Wars in World Rules for combat!).`,
          'warning',
        );
      } else if (declaredPairs.length > 0) {
        const [a, b] = declaredPairs[0];
        const extra = declaredPairs.length > 1 ? ` (+${declaredPairs.length - 1} more)` : '';
        addChronicle(
          state,
          `Start War! ${getKName(a)} turned aggressively expansionist and declared war on ${getKName(b)}${extra}!`,
          'warning',
        );
      } else {
        addChronicle(
          state,
          `Start War! ${affectedArr.map(getKName).join(', ')} turned aggressively expansionist and mobilized for war!`,
          'warning',
        );
      }
      break;
    }

    case 'solar_orbital_laser': {
      isHeavy = true;
      specialLiquidPossibleByState.set(state, true);
      const sweepAngle = (((targetX * 23 + targetZ * 41) & 63) / 64) * Math.PI * 2;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'orbital_beam',
        x: targetX,
        z: targetZ,
        radius: Math.max(3.6, r),
        remaining: 8.5,
        duration: 8.5,
        tickTimer: 0,
        beamDirX: Math.cos(sweepAngle),
        beamDirZ: Math.sin(sweepAngle),
        solarFlareTimer: 0.35,
        solarFlareCount: 0,
        solarProjectiles: [],
        recentSolarImpacts: [],
      });
      addChronicle(
        state,
        'A blazing Sun ignited overhead, channeling a Solar Beam and hurling molten solar flares across the world!',
        'warning',
      );
      break;
    }

    case 'gravity_flip': {
      isHeavy = true;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'gravity_anomaly',
        x: targetX,
        z: targetZ,
        radius: r,
        remaining: 5.5,
        duration: 5.5,
        tickTimer: 0,
        exploded: false,
      });
      addChronicle(state, 'Anti-Gravity lifted units and animals high into the air!', 'warning');
      break;
    }

    case 'lava_deluge': {
      isHeavy = true;
      specialLiquidPossibleByState.set(state, true);
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'biome_bloom_wave',
        biomeWaveKind: 'lava',
        elementAffinity: 'fire',
        x: targetX,
        z: targetZ,
        heading: (((targetX * 17 + targetZ * 29) & 31) / 32) * Math.PI * 2,
        radius: r,
        currentRadius: 0.7,
        maxRadius: r,
        remaining: 4.6,
        duration: 4.6,
        tickTimer: 0.05,
      });
      addChronicle(state, 'A surging Lava Deluge began melting the earth into flowing magma rivers and volcanic wasteland!', 'warning');
      break;
    }

    case 'blight_plague': {
      isHeavy = true;
      specialLiquidPossibleByState.set(state, true);
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'biome_bloom_wave',
        biomeWaveKind: 'blight',
        elementAffinity: 'poison',
        x: targetX,
        z: targetZ,
        heading: (((targetX * 19 + targetZ * 31) & 31) / 32) * Math.PI * 2,
        radius: r,
        currentRadius: 0.7,
        maxRadius: r,
        remaining: 4.6,
        duration: 4.6,
        tickTimer: 0.05,
      });
      addChronicle(state, 'A creeping Blight Plague began corrupting the land into dark purple mire and poison pools!', 'warning');
      break;
    }

    case 'floral_paradise': {
      isHeavy = false;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'biome_bloom_wave',
        biomeWaveKind: 'floral',
        elementAffinity: 'water',
        x: targetX,
        z: targetZ,
        radius: r,
        currentRadius: 0.7,
        maxRadius: r,
        remaining: 4.4,
        duration: 4.4,
        tickTimer: 0.05,
      });
      state.happiness = Math.min(100, state.happiness + 18);
      addChronicle(state, 'A radiant Floral Blossom began blooming outward across the land!', 'divine');
      break;
    }

    case 'fortify_walls': {
      isHeavy = true;
      const eyeR = Math.max(9.5, r);
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'sentinel_eye',
        elementAffinity: 'fire',
        x: targetX,
        z: targetZ,
        radius: eyeR,
        remaining: 18.0,
        duration: 18.0,
        tickTimer: 0.22,
        beamFireTimer: 0,
        eyeYaw: 0,
      });
      addChronicle(state, 'The Eye of Judgment manifested above the realm, firing searing laser beams at everyone in sight!', 'warning');
      break;
    }

    case 'bountiful_harvest': {
      isHeavy = false;
      const targetKid = findTargetedKingdomId(state, targetX, targetZ, Math.max(r + 5, 12));
      const anchorBld = targetKid
        ? state.buildings.find((b) => b.settlementId && getKingdomId(state, b.settlementId) === targetKid && b.hp > 0)
        : undefined;
      const sid = anchorBld?.settlementId;
      grantResourcesToKingdomOrPool(state, { food: 240, wood: 180, stone: 140, ore: 100 }, targetKid);
      let sprouted = 0;
      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        if ((t.x - targetX) ** 2 + (t.z - targetZ) ** 2 > rSq || t.height <= 0 || t.buildingId) return;
        if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove' || t.resourceNode === 'ore_vein' || t.resourceNode === 'stone_outcrop') {
          t.resourceAmount = Math.max(t.resourceAmount, 460);
        } else if (t.terrain === 'grass' || t.terrain === 'savanna' || t.terrain === 'fertile') {
          t.terrain = 'fertile';
          if (sid) t.farmSettlementId = sid;
          if ((t.x * 7 + t.z * 11) % 5 === 0) {
            t.resourceNode = 'berry_bush';
            t.resourceAmount = 320;
            sprouted++;
          }
        }
      });
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'build_complete',
        x: targetX,
        y: 1.0,
        z: targetZ,
        radius: 2.6,
        color: '#facc15',
        createdAt: Date.now(),
      });
      state.happiness = Math.min(100, state.happiness + 16);
      addChronicle(state, `Harvest Feast sprouted ${sprouted > 0 ? 'lush farms & groves and ' : ''}filled kingdom stockpiles!`, 'divine');
      break;
    }

    case 'recruit_legion': {
      isHeavy = false;
      const targetKid = findTargetedKingdomId(state, targetX, targetZ, Math.max(r + 5, 12));
      const anchorBld = targetKid
        ? state.buildings.find((b) => b.settlementId && getKingdomId(state, b.settlementId) === targetKid && b.hp > 0)
        : undefined;
      const sid = anchorBld?.settlementId;
      const sp = sid ? (state.settlementSpecies?.[sid] ?? 'human') : 'human';
      for (const u of state.units) {
        if (u.state === 'ko' || u.faction !== 'civilization') continue;
        if ((u.x - targetX) ** 2 + (u.z - targetZ) ** 2 <= rSq) {
          u.hp = u.maxHp;
          u.statusEffects.blessed = Math.max(u.statusEffects.blessed ?? 0, 22);
          u.statusEffects.shielded = Math.max(u.statusEffects.shielded ?? 0, 10);
        }
      }
      let recruited = 0;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const sx = Math.max(2, Math.min(state.gridSize - 3, Math.round(targetX + Math.cos(ang) * 2.2)));
        const sz = Math.max(2, Math.min(state.gridSize - 3, Math.round(targetZ + Math.sin(ang) * 2.2)));
        const t = getTile(state, sx, sz);
        if (!t || t.height <= 0) continue;
        const spawned = spawnUnit(state, 'warrior', sx, sz, true, sid);
        if (spawned.ok && spawned.unit) {
          spawned.unit.species = sp;
          spawned.unit.statusEffects.blessed = 24;
          spawned.unit.statusEffects.shielded = 10;
          recruited++;
        }
      }
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'animal_attack',
        variant: 'horn_blast',
        originX: targetX,
        originZ: targetZ,
        x: targetX,
        y: 0.7,
        z: targetZ,
        radius: 3.8,
        color: '#ef4444',
        createdAt: Date.now(),
      });
      addChronicle(state, `Rally Militia sounded the war horn and armed ${recruited} shielded warriors!`, 'divine');
      break;
    }

    case 'cleanse_land': {
      isHeavy = false;
      const cleanR = Math.max(6.0, r);
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'purify_wave',
        x: targetX,
        z: targetZ,
        radius: cleanR,
        currentRadius: 0.45,
        maxRadius: cleanR,
        remaining: 4.4,
        duration: 4.4,
        tickTimer: 0,
      });
      addChronicle(state, 'A radiant pillar of purifying light descended from the heavens and expanded outward to cleanse the land!', 'divine');
      break;
    }

    case 'summon_fleet': {
      isHeavy = false;
      const targetKid = findTargetedKingdomId(state, targetX, targetZ, Math.max(r + 6, 14));
      const anchorBld = targetKid
        ? state.buildings.find((b) => b.settlementId && getKingdomId(state, b.settlementId) === targetKid && b.hp > 0)
        : state.buildings[0];
      const sid = anchorBld?.settlementId ?? 'city_default';
      const kid = targetKid ?? (anchorBld?.settlementId ? getKingdomId(state, anchorBld.settlementId) : undefined);
      const sp = state.settlementSpecies?.[sid] ?? 'human';
      const cityEpoch = kid ? getKingdomEpoch(state, kid) : state.epochIndex;
      const waterSpots: Array<{ x: number; z: number }> = [];
      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        if (t.height === 0 && !t.buildingId && t.terrain !== 'ice' && t.waterKind !== 'lava' && (t.x - targetX) ** 2 + (t.z - targetZ) ** 2 <= rSq) {
          waterSpots.push({ x: t.x, z: t.z });
        }
      });
      if (!state.vehicles) state.vehicles = [];
      const shipCount = Math.min(3, waterSpots.length);
      const shipHp = 140 + cityEpoch * 40;
      for (let i = 0; i < shipCount; i++) {
        const spot = waterSpots[Math.floor((i * waterSpots.length) / shipCount)];
        state.vehicles.push({
          id: nextEntityId('veh_shp'),
          type: 'passenger_ship',
          species: sp,
          settlementId: sid,
          kingdomId: kid,
          hp: shipHp,
          maxHp: shipHp,
          epochLevel: cityEpoch,
          x: spot.x,
          y: cityEpoch >= 6 ? 0.22 : 0.12,
          z: spot.z,
          heading: Math.random() * Math.PI * 2,
          pitch: 0,
          bank: 0,
          speed: 2.8 + cityEpoch * 0.35,
          path: [{ x: spot.x, z: spot.z }],
          pathIndex: 0,
          variantSeed: state.vehicles.length + spot.x * 5 + spot.z * 11,
          passengerIds: [],
        });
      }
      addChronicle(
        state,
        shipCount > 0 ? `Launch Fleet built ${shipCount} ship${shipCount === 1 ? '' : 's'} on nearby water!` : 'Launch Fleet needs nearby open water to build ships.',
        'divine',
      );
      break;
    }

    case 'acid_rain': {
      isHeavy = true;
      const windAng = Math.random() * Math.PI * 2;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'acid_cloud',
        elementAffinity: 'poison',
        x: targetX,
        z: targetZ,
        windX: Math.cos(windAng) * 2.1,
        windZ: Math.sin(windAng) * 2.1,
        radius: Math.max(4.5, r * 0.85),
        remaining: 9.0,
        duration: 9.0,
        tickTimer: 0.12,
      });
      addChronicle(state, 'A corrosive Acid Cloud drifted over the region, dissolving foliage and poisoning soil!', 'warning');
      break;
    }

    case 'blizzard': {
      isHeavy = true;
      const blizR = Math.max(5.5, r * 0.85);
      const galeAng = Math.random() * Math.PI * 2;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'blizzard_gale',
        elementAffinity: 'ice',
        isSuper: true,
        x: targetX,
        z: targetZ,
        windX: Math.cos(galeAng) * 3.0,
        windZ: Math.sin(galeAng) * 3.0,
        radius: blizR,
        remaining: 8.0,
        duration: 8.0,
        tickTimer: 0.12,
      });
      addChronicle(state, 'A howling Blizzard Gale swept across the land, blowing units back and freezing lakes solid!', 'warning');
      break;
    }

    case 'sinkhole': {
      isHeavy = true;
      const pitR = Math.max(4.6, r);
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'sinkhole_collapse',
        x: targetX,
        z: targetZ,
        radius: pitR,
        currentRadius: 0.5,
        maxRadius: pitR,
        remaining: 4.6,
        duration: 4.6,
        tickTimer: 0.08,
      });
      addChronicle(state, 'The earth violently fractured and collapsed into a spiraling Sinkhole chasm!', 'warning');
      break;
    }

    case 'locust_swarm': {
      isHeavy = true;
      const heading = Math.random() * Math.PI * 2;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'locust_swarm',
        x: targetX,
        z: targetZ,
        heading,
        windX: Math.cos(heading),
        windZ: Math.sin(heading),
        radius: Math.max(4.0, r * 0.65),
        remaining: 10.5,
        duration: 10.5,
        tickTimer: 0.15,
      });
      addChronicle(state, 'A ravenous Locust Swarm descended, hunting nearby farms and forests!', 'warning');
      break;
    }

    case 'wildfire_ring': {
      isHeavy = true;
      specialLiquidPossibleByState.set(state, true);
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'magma_geyser',
        elementAffinity: 'fire',
        x: targetX,
        z: targetZ,
        radius: Math.max(5.0, r),
        currentRadius: 1.0,
        maxRadius: Math.max(5.0, r),
        remaining: 7.5,
        duration: 7.5,
        tickTimer: 0.14,
      });
      addChronicle(state, 'The earth fractured into a jagged Lava Fissure, building pressure before erupting molten magma!', 'warning');
      break;
    }
  }

  syncStateResourcesFromKingdoms(state);
  recalculateRatesAndCaps(state);
  return isHeavy;
}

export function castGodPower(
  state: SimulationState,
  powerType: GodPowerType,
  targetX: number,
  targetZ: number,
  options?: { deferImpact?: boolean; brushSize?: number; radiusOverride?: number },
): { ok: boolean; reason?: string; isHeavy?: boolean; count?: number; totalCost?: number } {
  const def = GOD_POWERS.find((p) => p.type === powerType);
  if (!def) return { ok: false, reason: 'Unknown divine power' };

  const hasExplicitRadius =
    options?.radiusOverride !== undefined && Number.isFinite(options.radiusOverride);
  const clusterCount =
    powerType === 'drag_entity' || hasExplicitRadius
      ? 1
      : getPowerClusterCount(options?.brushSize ?? 1);
  const totalFaithCost = def.faithCost * clusterCount;

  reconcileAndSyncResources(state);
  if (!state.sandboxFreeMode && state.resources.faith < totalFaithCost) {
    return { ok: false, reason: `Requires ${totalFaithCost} God Energy` };
  }

  if (!state.sandboxFreeMode) {
    spendWorldCost(state, { faith: totalFaithCost });
  }

  const singleRadius = hasExplicitRadius
    ? Math.max(0.85, Math.min(28, options!.radiusOverride!))
    : def.radius;

  const deferImpact = Boolean(options?.deferImpact);
  let isHeavy =
    powerType !== 'blessing' &&
    powerType !== 'floral_paradise' &&
    powerType !== 'rain_of_plenty' &&
    powerType !== 'freeze_snap' &&
    powerType !== 'heat_wave' &&
    powerType !== 'harmony_dove' &&
    powerType !== 'start_war' &&
    powerType !== 'drag_entity';

  const targets = getPowerClusterTargets(
    clusterCount,
    singleRadius,
    targetX,
    targetZ,
    state.gridSize,
  );

  for (let ti = 0; ti < targets.length; ti++) {
    const tx = targets[ti].x;
    const tz = targets[ti].z;
    const tTile = getTile(state, tx, tz);
    const baseHeight = tTile ? Math.max(0.36, tTile.height * 0.45) : 1.2;

    const earthquakePlan =
      powerType === 'earthquake' ? generateEarthquakeFaultNetwork(tx, tz, singleRadius) : null;

    if (!deferImpact) {
      const impactHeavy = executeGodPowerImpact(
        state,
        powerType,
        tx,
        tz,
        earthquakePlan
          ? { ...earthquakePlan, radiusOverride: singleRadius }
          : { radiusOverride: singleRadius },
      );
      if (impactHeavy) isHeavy = true;
    } else if (powerType === 'rain_of_plenty') {
      // Spawn the monsoon cloud upwind immediately so it rushes fast into the summoned spot (tx, tz)
      if (!state.activeHazards) state.activeHazards = [];
      const windAngle = 0.58 + (((tx * 17 + tz * 31) & 7) - 3.5) * 0.08;
      const windX = Math.cos(windAngle);
      const windZ = Math.sin(windAngle);
      const startDist = 18.5;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'rain_cloud',
        x: tx - windX * startDist,
        z: tz - windZ * startDist,
        targetX: tx,
        targetZ: tz,
        windX,
        windZ,
        arrivalRemaining: 0.72,
        arrivalDuration: 0.72,
        impactPending: true,
        currentSpeed: 42,
        radius: singleRadius,
        remaining: 10.5,
        duration: 10.5,
        tickTimer: 0,
      });
    }

    state.totalMiraclesCast += 1;
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: powerType,
      x: tx,
      y: baseHeight,
      z: tz,
      radius: earthquakePlan?.quakeExtent ?? singleRadius,
      color: def.color,
      createdAt: Date.now() + ti * 25,
      deferImpact,
      faultSegments: earthquakePlan?.faultSegments,
      quakeShapeKind: earthquakePlan?.quakeShapeKind,
      quakeExtent: earthquakePlan?.quakeExtent,
    });
  }

  return { ok: true, isHeavy, count: clusterCount, totalCost: totalFaithCost };
}

function createVillageName(state: SimulationState, species: SpeciesId = 'human'): string {
  const used = new Set(Object.values(state.settlementNames ?? {}));
  return createUniqueCityName(species, used);
}

export function getKingdomId(state: SimulationState, settlementId: string): string {
  return state.settlementKingdoms?.[settlementId] ?? settlementId;
}

export function getKingdomPairKey(kA: string, kB: string): string {
  return kA < kB ? `${kA}::${kB}` : `${kB}::${kA}`;
}

export function getKingdomRelation(
  state: SimulationState,
  kA: string,
  kB: string,
): DiplomaticRelation {
  if (!kA || !kB || kA === kB) return kA === kB ? 'allied' : 'neutral';
  return state.kingdomRelations?.[getKingdomPairKey(kA, kB)] ?? 'neutral';
}

function recordWarFrontBaselineIfMissing(
  state: SimulationState,
  kA: string,
  kB: string,
): void {
  if (!kA || !kB || kA === kB) return;
  const key = getKingdomPairKey(kA, kB);
  if (!state.warFrontBaselines) state.warFrontBaselines = {};
  if (state.warFrontBaselines[key]) return;
  const [firstId, secondId] = kA < kB ? [kA, kB] : [kB, kA];
  let bldA = 0;
  let bldB = 0;
  for (let i = 0; i < state.buildings.length; i++) {
    const b = state.buildings[i];
    if (b.hp <= 0 || !b.settlementId) continue;
    const bKid = getKingdomId(state, b.settlementId);
    if (bKid === firstId) bldA++;
    else if (bKid === secondId) bldB++;
  }
  state.warFrontBaselines[key] = {
    startYear: state.year ?? 0,
    initialTilesA: 0,
    initialTilesB: 0,
    initialBuildingsA: Math.max(1, bldA),
    initialBuildingsB: Math.max(1, bldB),
  };
}

export function setKingdomRelation(
  state: SimulationState,
  kA: string,
  kB: string,
  relation: DiplomaticRelation,
): void {
  if (!kA || !kB || kA === kB) return;
  if (!state.kingdomRelations) state.kingdomRelations = {};
  const key = getKingdomPairKey(kA, kB);
  state.kingdomRelations[key] = relation;
  if (relation === 'war') {
    recordWarFrontBaselineIfMissing(state, kA, kB);
  } else if (state.warFrontBaselines && state.warFrontBaselines[key]) {
    delete state.warFrontBaselines[key];
  }
}

function deterministicUnitFloat(seed: number, strA: string, strB = ''): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < strA.length; i++) {
    h = Math.imul(h ^ strA.charCodeAt(i), 16777619) >>> 0;
  }
  for (let i = 0; i < strB.length; i++) {
    h = Math.imul(h ^ strB.charCodeAt(i), 16777619) >>> 0;
  }
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function rollKingdomPeacefulTrait(
  state: SimulationState,
  kingdomId: string,
  species: SpeciesId,
  rollOverride?: number,
): boolean {
  if (!state.kingdomPeacefulTraits) state.kingdomPeacefulTraits = {};
  if (state.kingdomPeacefulTraits[kingdomId] !== undefined && rollOverride === undefined) {
    return state.kingdomPeacefulTraits[kingdomId];
  }
  const r = rollOverride ?? deterministicUnitFloat(state.seed ?? 1, kingdomId, species);
  // Humans, Elves & Dwarves favor trade and peace; Lizardfolk are balanced/territorial; Orcs are belligerent
  const peaceProb =
    species === 'orc'
      ? 0.12
      : species === 'elf'
        ? 0.82
        : species === 'dwarf'
          ? 0.76
          : species === 'lizardfolk'
            ? 0.62
            : 0.74;
  const isPeaceful = r < peaceProb;
  state.kingdomPeacefulTraits[kingdomId] = isPeaceful;
  return isPeaceful;
}

export function areKingdomsAtWar(
  state: SimulationState,
  kA?: string,
  kB?: string,
): boolean {
  if (state.worldRules?.warsEnabled === false) return false;
  if (!kA || !kB || kA === kB) return false;
  return getKingdomRelation(state, kA, kB) === 'war';
}

export function initializeKingdomDiplomacyPair(
  state: SimulationState,
  kA: string,
  spA: SpeciesId,
  kB: string,
  spB: SpeciesId,
): DiplomaticRelation {
  if (!kA || !kB || kA === kB) return 'allied';
  if (!state.kingdomRelations) state.kingdomRelations = {};
  const key = getKingdomPairKey(kA, kB);
  const existing = state.kingdomRelations[key];
  if (existing) return existing;

  const pA = rollKingdomPeacefulTrait(state, kA, spA);
  const pB = rollKingdomPeacefulTrait(state, kB, spB);
  const pairRoll = deterministicUnitFloat((state.seed ?? 1) + 73, key, `${spA}_${spB}`);
  const warsOn = state.worldRules?.warsEnabled !== false;

  let rel: DiplomaticRelation = 'neutral';
  if (!pA || !pB) {
    // At least one side is belligerent — still give a realistic chance of uneasy neutrality before war erupts
    const bothOrcOrVsOrc = spA === 'orc' || spB === 'orc';
    if (warsOn && (bothOrcOrVsOrc ? pairRoll < 0.42 : pairRoll < 0.2)) {
      rel = 'war';
    } else {
      rel = 'neutral';
    }
  } else {
    // Both kingdoms rolled peaceful inclinations -> form alliance, trade pact, or cordial peace
    rel = pairRoll < 0.48 ? 'allied' : 'neutral';
    if (pairRoll < 0.72) {
      if (!state.kingdomTradePacts) state.kingdomTradePacts = {};
      state.kingdomTradePacts[key] = state.year + 28;
    }
  }
  state.kingdomRelations[key] = rel;
  if (rel === 'war') {
    if (!state.kingdomWarStartYears) state.kingdomWarStartYears = {};
    state.kingdomWarStartYears[key] = state.year;
    recordWarFrontBaselineIfMissing(state, kA, kB);
  }
  return rel;
}

function getActiveKingdomSummaries(
  state: SimulationState,
): Array<{ kingdomId: string; species: SpeciesId; name: string }> {
  const map = new Map<string, { kingdomId: string; species: SpeciesId; name: string }>();
  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    const sid = b.settlementId ?? 'city_default';
    const kid = getKingdomId(state, sid);
    if (!map.has(kid)) {
      const sp = b.species ?? state.settlementSpecies?.[sid] ?? 'human';
      const name = state.settlementNames?.[kid] ?? state.settlementNames?.[sid] ?? kid;
      map.set(kid, { kingdomId: kid, species: sp, name });
    }
  }
  for (const u of state.units) {
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
    const kid = u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId;
    if (kid && !map.has(kid)) {
      map.set(kid, { kingdomId: kid, species: u.species, name: state.settlementNames?.[kid] ?? kid });
    }
  }
  return Array.from(map.values());
}

export function triggerCityRebellion(
  state: SimulationState,
  sid: string,
): boolean {
  if (state.worldRules?.allowRebellion === false) return false;
  const parentBuildings = state.buildings.filter((b) => (b.settlementId ?? 'city_default') === sid && b.hp > 0);
  if (parentBuildings.length === 0) return false;

  const anchor = getSettlementAnchorForId(state, sid);
  const parentKingdomId = getKingdomId(state, sid);
  const parentSpecies: SpeciesId =
    state.settlementSpecies?.[sid] ?? parentBuildings[0]?.species ?? 'human';
  const parentName = state.settlementNames?.[sid] ?? 'City';

  const candidates = state.units.filter(
    (u) =>
      u.faction === 'civilization' &&
      u.state !== 'ko' &&
      u.hp > 0 &&
      u.settlementId === sid &&
      !u.isKing &&
      u.ageStage !== 'child' &&
      u.expeditionTargetX === undefined,
  );
  if (candidates.length < 2) return false;

  const rebelCount = Math.min(3, Math.max(2, Math.floor(candidates.length * 0.45)));
  const rebelUnits = candidates.slice(0, rebelCount);
  const rebelKingdomId = nextEntityId('rebel_city');

  // Find a defensible breakaway camp site 18..30 tiles away (outside parent's city radius)
  let rebelSite: TileData | null = null;
  const gs = state.gridSize;
  for (let r = 18; r <= 30 && !rebelSite; r += 2) {
    for (let angleStep = 0; angleStep < 12; angleStep++) {
      const ang = (angleStep / 12) * Math.PI * 2 + (state.year % 6.28);
      const tx = Math.max(4, Math.min(gs - 5, Math.round(anchor.x + Math.cos(ang) * r)));
      const tz = Math.max(4, Math.min(gs - 5, Math.round(anchor.z + Math.sin(ang) * r)));
      const t = getTile(state, tx, tz);
      if (
        t &&
        t.height >= 1 &&
        t.height <= 4 &&
        !t.buildingId &&
        t.onFireTimer <= 0 &&
        !state.buildings.some((b) => Math.hypot(b.tileX - tx, b.tileZ - tz) < 12)
      ) {
        rebelSite = t;
        break;
      }
    }
  }
  if (!rebelSite) {
    rebelSite = findNewCitySite(state, anchor.x, anchor.z);
  }

  let rebelSettlementId: string | undefined;
  if (rebelSite && !rebelSite.buildingId) {
    if (!state.settlementNames) state.settlementNames = {};
    if (!state.settlementSpecies) state.settlementSpecies = {};
    if (!state.settlementKingdoms) state.settlementKingdoms = {};
    if (!state.kingdomEpochs) state.kingdomEpochs = {};
    if (!state.kingdomEpochProgress) state.kingdomEpochProgress = {};
    const parentEpoch = getKingdomEpoch(state, parentKingdomId);
    rebelSettlementId = rebelKingdomId;
    state.settlementNames[rebelSettlementId] = createVillageName(state, parentSpecies);
    ensureWorldStats(state).citiesCreated += 1;
    state.settlementSpecies[rebelSettlementId] = parentSpecies;
    state.settlementKingdoms[rebelSettlementId] = rebelKingdomId;
    state.kingdomEpochs[rebelKingdomId] = parentEpoch;
    state.kingdomEpochProgress[rebelKingdomId] = 0;
    const hearthDef = BUILDINGS.find((b) => b.type === 'bonfire')!;
    const hearth: BuildingEntity = {
      id: nextEntityId('bld'),
      type: 'bonfire',
      settlementId: rebelSettlementId,
      species: parentSpecies,
      tileX: rebelSite.x,
      tileZ: rebelSite.z,
      hp: hearthDef.maxHp,
      maxHp: hearthDef.maxHp,
      constructionProgress: 100,
      epochLevel: Math.max(0, parentEpoch === 0 ? 0 : 1),
      upgradeProgress: 0,
      blessedTimer: 0,
      cursedTimer: 0,
      shieldTimer: 0,
    };
    rebelSite.buildingId = hearth.id;
    rebelSite.resourceNode = 'none';
    rebelSite.resourceAmount = 0;
    if (rebelSite.terrain === 'stone_road' || rebelSite.terrain === 'forest') {
      rebelSite.terrain = 'grass';
    }
    state.buildings.push(hearth);
  }

  for (let i = 0; i < rebelUnits.length; i++) {
    const ru = rebelUnits[i];
    ru.isRebel = true;
    ru.settlementId = rebelSettlementId;
    ru.kingdomId = rebelKingdomId;
    ru.maxHp = Math.max(ru.maxHp, 155);
    ru.hp = ru.maxHp;
    if (i === 0) {
      ru.role = 'warrior';
      ru.isKing = true;
      if (!ru.name.startsWith('King ')) ru.name = `King ${ru.name}`;
    }
    if (rebelSite) {
      const rx = Math.max(3, Math.min(gs - 4, rebelSite.x + (i % 3) - 1));
      const rz = Math.max(3, Math.min(gs - 4, rebelSite.z + Math.floor(i / 3)));
      const rt = getTile(state, rx, rz);
      if (rt && rt.height >= 1) {
        ru.x = rx;
        ru.z = rz;
      } else {
        ru.x = rebelSite.x;
        ru.z = rebelSite.z;
      }
      ru.expeditionTargetX = undefined;
      ru.expeditionTargetZ = undefined;
      ru.targetX = rebelSite.x;
      ru.targetZ = rebelSite.z;
      ru.state = 'idle';
    }
  }

  if (!state.kingdomPeacefulTraits) state.kingdomPeacefulTraits = {};
  state.kingdomPeacefulTraits[rebelKingdomId] = false;
  // Transfer a fair share of the parent kingdom's stocked resources to the rebel movement
  const pStock = ensureKingdomResources(state, parentKingdomId);
  const rStock = ensureKingdomResources(state, rebelKingdomId);
  for (const k of RESOURCE_KEYS) {
    if (k === 'faith') continue;
    const take = Math.floor((pStock[k] ?? 0) * 0.25);
    if (take > 0) {
      pStock[k] -= take;
      rStock[k] += take;
    }
  }
  syncStateResourcesFromKingdoms(state);

  ensureWorldStats(state).rebellionsTriggered += 1;
  if (state.worldRules?.warsEnabled !== false) {
    if (getKingdomRelation(state, parentKingdomId, rebelKingdomId) !== 'war') {
      ensureWorldStats(state).warsStarted += 1;
    }
    setKingdomRelation(state, parentKingdomId, rebelKingdomId, 'war');
  } else {
    setKingdomRelation(state, parentKingdomId, rebelKingdomId, 'neutral');
  }
  addChronicle(
    state,
    `Rebellion erupted in ${parentName}! ${rebelUnits.length} ${parentSpecies} separatists broke away to forge a rival city-state.`,
    'warning',
  );
  return true;
}

function stepKingdomDiplomacyAndRebellions(state: SimulationState, dt: number): void {
  const kingdoms = getActiveKingdomSummaries(state);
  if (kingdoms.length > 1) {
    for (let i = 0; i < kingdoms.length; i++) {
      for (let j = i + 1; j < kingdoms.length; j++) {
        initializeKingdomDiplomacyPair(
          state,
          kingdoms[i].kingdomId,
          kingdoms[i].species,
          kingdoms[j].kingdomId,
          kingdoms[j].species,
        );
      }
    }
  }

  state.diplomacyTimer = (state.diplomacyTimer ?? 0) + dt;
  if (state.diplomacyTimer >= 12 && kingdoms.length > 1) {
    state.diplomacyTimer = 0;
    const warsOn = state.worldRules?.warsEnabled !== false;
    if (!state.kingdomPeaceTreaties) state.kingdomPeaceTreaties = {};
    if (!state.kingdomTradePacts) state.kingdomTradePacts = {};
    if (!state.kingdomWarStartYears) state.kingdomWarStartYears = {};

    for (let i = 0; i < kingdoms.length; i++) {
      for (let j = i + 1; j < kingdoms.length; j++) {
        const kA = kingdoms[i];
        const kB = kingdoms[j];
        const pairKey = getKingdomPairKey(kA.kingdomId, kB.kingdomId);
        const rel = getKingdomRelation(state, kA.kingdomId, kB.kingdomId);
        const roll = Math.random();
        const peaceA = rollKingdomPeacefulTrait(state, kA.kingdomId, kA.species);
        const peaceB = rollKingdomPeacefulTrait(state, kB.kingdomId, kB.species);

        // Expire finished treaties / trade pacts cleanly
        let peaceUntil = state.kingdomPeaceTreaties[pairKey] ?? 0;
        if (peaceUntil > 0 && state.year >= peaceUntil) {
          delete state.kingdomPeaceTreaties[pairKey];
          peaceUntil = 0;
        }
        let tradeUntil = state.kingdomTradePacts[pairKey] ?? 0;
        if (tradeUntil > 0 && (state.year >= tradeUntil || rel === 'war')) {
          delete state.kingdomTradePacts[pairKey];
          tradeUntil = 0;
        }

        // Active Trade Agreements enrich both kingdoms with mutual goods & shared knowledge every cycle
        if (tradeUntil > state.year && rel !== 'war') {
          const resA = ensureKingdomResources(state, kA.kingdomId);
          const resB = ensureKingdomResources(state, kB.kingdomId);
          const epA = getKingdomEpoch(state, kA.kingdomId);
          const epB = getKingdomEpoch(state, kB.kingdomId);
          const tradeBonus = 8 + Math.max(epA, epB) * 4;
          resA.food += tradeBonus;
          resB.food += tradeBonus;
          resA.wood += Math.round(tradeBonus * 0.65);
          resB.stone += Math.round(tradeBonus * 0.65);
          resA.ore += Math.round(tradeBonus * 0.45);
          resB.ore += Math.round(tradeBonus * 0.45);
          resA.knowledge += Math.round(tradeBonus * 0.55);
          resB.knowledge += Math.round(tradeBonus * 0.55);
          if (Math.max(epA, epB) >= 3) {
            resA.alloy += Math.round(tradeBonus * 0.35);
            resB.alloy += Math.round(tradeBonus * 0.35);
          }
        }

        const underPeaceTreaty = peaceUntil > state.year;
        const hasTradePact = tradeUntil > state.year;

        if (rel === 'neutral') {
          if (underPeaceTreaty) {
            // During an active Peace Treaty, realms cannot declare war — instead they may open trade or forge an alliance
            if (!hasTradePact && roll < (peaceA && peaceB ? 0.28 : 0.14)) {
              const years = 24 + Math.floor(Math.random() * 18);
              state.kingdomTradePacts[pairKey] = state.year + years;
              addChronicle(
                state,
                `${kA.name} and ${kB.name} signed a ${years}-year Trade Agreement, opening merchant routes.`,
                'divine',
              );
            } else if (peaceA && peaceB && roll > 0.84) {
              setKingdomRelation(state, kA.kingdomId, kB.kingdomId, 'allied');
              addChronicle(state, `${kA.name} and ${kB.name} forged a grand Alliance!`, 'divine');
            }
          } else {
            const warChance = warsOn ? (!peaceA || !peaceB ? 0.13 : 0.03) : 0;
            const tradeChance = !hasTradePact ? (peaceA && peaceB ? 0.24 : 0.1) : 0;
            const treatyChance = peaceA && peaceB ? 0.14 : 0.07;
            const allianceChance = peaceA && peaceB ? (hasTradePact ? 0.22 : 0.12) : 0.03;

            if (warChance > 0 && roll < warChance) {
              setKingdomRelation(state, kA.kingdomId, kB.kingdomId, 'war');
              state.kingdomWarStartYears[pairKey] = state.year;
              delete state.kingdomTradePacts[pairKey];
              ensureWorldStats(state).warsStarted += 1;
              addChronicle(state, `War declared between ${kA.name} and ${kB.name}!`, 'warning');
            } else if (roll < warChance + tradeChance) {
              const years = 25 + Math.floor(Math.random() * 20);
              state.kingdomTradePacts[pairKey] = state.year + years;
              addChronicle(
                state,
                `${kA.name} and ${kB.name} signed a ${years}-year Trade Agreement, exchanging goods and knowledge.`,
                'divine',
              );
            } else if (roll < warChance + tradeChance + treatyChance) {
              const years = 16 + Math.floor(Math.random() * 14);
              state.kingdomPeaceTreaties[pairKey] = state.year + years;
              addChronicle(
                state,
                `${kA.name} and ${kB.name} signed a ${years}-year Peace Treaty.`,
                'divine',
              );
            } else if (roll < warChance + tradeChance + treatyChance + allianceChance) {
              setKingdomRelation(state, kA.kingdomId, kB.kingdomId, 'allied');
              addChronicle(state, `${kA.name} and ${kB.name} signed a pact of alliance!`, 'divine');
            }
          }
        } else if (rel === 'allied') {
          if (!hasTradePact && roll < 0.3) {
            const years = 30 + Math.floor(Math.random() * 20);
            state.kingdomTradePacts[pairKey] = state.year + years;
            addChronicle(
              state,
              `Allies ${kA.name} and ${kB.name} established a ${years}-year Trade Pact.`,
              'divine',
            );
          }
        } else if (rel === 'war') {
          const warStart = state.kingdomWarStartYears[pairKey] ?? state.year;
          const warDuration = Math.max(0, state.year - warStart);
          // War exhaustion allows both peaceful and belligerent kingdoms to negotiate multi-year Peace Treaties
          if (warDuration >= 10) {
            const peaceChance =
              peaceA && peaceB
                ? Math.min(0.48, 0.14 + warDuration * 0.014)
                : Math.min(0.32, 0.06 + warDuration * 0.009);
            if (roll < peaceChance) {
              const treatyYears = 18 + Math.floor(Math.random() * 18);
              setKingdomRelation(state, kA.kingdomId, kB.kingdomId, 'neutral');
              state.kingdomPeaceTreaties[pairKey] = state.year + treatyYears;
              delete state.kingdomWarStartYears[pairKey];
              addChronicle(
                state,
                `${kA.name} and ${kB.name} signed a ${treatyYears}-year Peace Treaty, ending their war.`,
                'divine',
              );
            }
          }
        }
      }
    }
  }

  if (state.worldRules?.allowRebellion !== false) {
    state.rebellionTimer = (state.rebellionTimer ?? 0) + dt;
    if (state.rebellionTimer >= 9.5) {
      state.rebellionTimer = 0;
      const settlementIds = Array.from(
        new Set(
          state.buildings
            .filter((b) => b.constructionProgress >= 100 && b.settlementId)
            .map((b) => b.settlementId!),
        ),
      );

      // Multi-city empires face frequent colonial/regional secession movements
      const settlementsByKingdom = new Map<string, string[]>();
      for (const sid of settlementIds) {
        const kid = getKingdomId(state, sid);
        const list = settlementsByKingdom.get(kid) ?? [];
        list.push(sid);
        settlementsByKingdom.set(kid, list);
      }

      let rebellionTriggered = false;
      for (const [kid, kSids] of settlementsByKingdom) {
        if (kSids.length >= 2) {
          const isEmpireAtWar = kingdoms.some(
            (k) => k.kingdomId !== kid && areKingdomsAtWar(state, kid, k.kingdomId),
          );
          // Do not auto-fragment multi-city empires into splinter kingdoms merely for being at war with another nation;
          // provinces only secede when internal happiness drops or empire overextends (>= 5 cities) while not rallied in a foreign war
          const isUnstableEmpire =
            (!isEmpireAtWar && kSids.length >= 5) || state.happiness < 68;
          if (!isUnstableEmpire) continue;

          const satelliteSid = kSids[kSids.length - 1];
          const satPop = state.units.filter(
            (u) => u.faction === 'civilization' && u.state !== 'ko' && u.settlementId === satelliteSid,
          ).length;
          if (satPop >= 2 && Math.random() < 0.24) {
            if (!state.settlementKingdoms) state.settlementKingdoms = {};
            state.settlementKingdoms[satelliteSid] = satelliteSid;
            const satUnits = state.units.filter((u) => u.settlementId === satelliteSid);
            for (const su of satUnits) {
              su.kingdomId = satelliteSid;
            }
            const satName = state.settlementNames?.[satelliteSid] ?? 'Province';
            const parentName = state.settlementNames?.[kid] ?? 'Empire';
            const parentStock = ensureKingdomResources(state, kid);
            const secStock = ensureKingdomResources(state, satelliteSid);
            for (const rk of RESOURCE_KEYS) {
              if (rk === 'faith') continue;
              const share = Math.floor((parentStock[rk] ?? 0) * 0.32);
              if (share > 0) {
                parentStock[rk] -= share;
                secStock[rk] += share;
              }
            }
            syncStateResourcesFromKingdoms(state);
            setKingdomRelation(
              state,
              kid,
              satelliteSid,
              state.worldRules?.warsEnabled !== false ? 'war' : 'neutral',
            );
            addChronicle(
              state,
              `${satName} declared independence and seceded from ${parentName}!`,
              'warning',
            );
            ensureSettlementKings(state);
            rebellionTriggered = true;
            break;
          }
        }
      }

      if (!rebellionTriggered && settlementIds.length < MAX_WORLD_CITIES) {
        for (const sid of settlementIds) {
          const cityUnits = state.units.filter(
            (u) =>
              u.faction === 'civilization' &&
              u.state !== 'ko' &&
              u.settlementId === sid &&
              !u.isKing &&
              u.ageStage !== 'child',
          );
          if (cityUnits.length < 3) continue;
          const sidKid = getKingdomId(state, sid);
          const isAtWar = kingdoms.some(
            (k) => k.kingdomId !== sidKid && areKingdomsAtWar(state, sidKid, k.kingdomId),
          );
          const isLargeEmpire = (settlementsByKingdom.get(sidKid)?.length ?? 1) >= 2;
          let unrestProb =
            isAtWar || state.happiness < 72
              ? cityUnits.length >= 6
                ? 0.45
                : 0.32
              : cityUnits.length >= 18
                ? 0.25
                : 0;
          if (isLargeEmpire && (isAtWar || state.happiness < 75)) unrestProb += 0.18;
          if (state.happiness < 65) unrestProb += 0.22;
          if (unrestProb > 0 && Math.random() < Math.min(0.82, unrestProb)) {
            if (triggerCityRebellion(state, sid)) break;
          }
        }
      }
    }
  }
}

function resolvePrimarySettlementForKingdom(
  state: SimulationState,
  kingdomId: string,
  nearX: number,
  nearZ: number,
): string | undefined {
  let bestSid: string | undefined;
  let bestDistSq = Infinity;
  for (let i = 0; i < state.buildings.length; i++) {
    const b = state.buildings[i];
    if (b.hp <= 0 || !b.settlementId) continue;
    if (getKingdomId(state, b.settlementId) !== kingdomId) continue;
    const dSq = (b.tileX - nearX) ** 2 + (b.tileZ - nearZ) ** 2;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestSid = b.settlementId;
    }
  }
  if (bestSid) return bestSid;
  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
    const uKid = u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId;
    if (uKid === kingdomId && u.settlementId) return u.settlementId;
  }
  return state.settlementNames?.[kingdomId] ? kingdomId : undefined;
}

export function claimTerritoryAround(
  state: SimulationState,
  cx: number,
  cz: number,
  radius: number,
  settlementId: string | undefined,
  kingdomId: string | undefined,
  canConquerEnemy = false,
): number {
  if (!settlementId || !kingdomId) return 0;
  let claimed = 0;
  forEachTileInRadius(state, cx, cz, radius, (t) => {
    // Do not overwrite an intact enemy building tile until that building is destroyed
    if (t.buildingId) {
      const b = state.buildings.find((bld) => bld.id === t.buildingId && bld.hp > 0);
      if (b && b.settlementId && getKingdomId(state, b.settlementId) !== kingdomId) {
        return;
      }
    }
    const existingOwnerSid = t.claimedSettlementId ?? t.farmSettlementId;
    if (!existingOwnerSid) {
      t.claimedSettlementId = settlementId;
      claimed++;
      return;
    }
    const existingOwnerKid = getKingdomId(state, existingOwnerSid);
    if (existingOwnerKid === kingdomId) {
      if (!t.claimedSettlementId) t.claimedSettlementId = settlementId;
      return;
    }
    if (canConquerEnemy && areKingdomsAtWar(state, kingdomId, existingOwnerKid)) {
      t.claimedSettlementId = settlementId;
      if (t.farmSettlementId && getKingdomId(state, t.farmSettlementId) !== kingdomId) {
        t.farmSettlementId = settlementId;
      }
      claimed++;
    }
  });
  return claimed;
}

function resolveStrategicStrikeImpact(
  state: SimulationState,
  strike: StrategicWarStrike,
): void {
  const gs = state.gridSize;
  const tx = Math.max(1, Math.min(gs - 2, strike.targetX));
  const tz = Math.max(1, Math.min(gs - 2, strike.targetZ));
  const targetTile = getTile(state, tx, tz);
  const hitY = (targetTile?.height ?? 2) * 0.45 + 0.35;
  const originTile = getTile(state, strike.originX, strike.originZ);
  const originY = (originTile?.height ?? 2) * 0.45 + 0.55;

  const atkName = state.settlementNames?.[strike.attackerKingdomId] ?? 'Empire';
  const defName = state.settlementNames?.[strike.targetKingdomId] ?? 'Rival Realm';

  if (strike.kind === 'icbm_nuke') {
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'nuke_blast',
      originX: strike.originX,
      originY,
      originZ: strike.originZ,
      x: tx,
      y: hitY,
      z: tz,
      radius: strike.radius,
      color: '#ff9e00',
      createdAt: Date.now(),
    });
    applySuperweaponEnvironmentImpact(state, tx, tz, Math.max(4.6, strike.radius * 1.15), 'nuke');
    addChronicle(state, `${atkName}'s thermonuclear ICBM devastated ${defName}!`, 'warning');
  } else if (strike.kind === 'elf_astral_cataclysm') {
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'arcane_cataclysm',
      originX: strike.originX,
      originY,
      originZ: strike.originZ,
      x: tx,
      y: hitY,
      z: tz,
      radius: strike.radius * 1.15,
      color: '#c084fc',
      createdAt: Date.now(),
    });
    applySuperweaponEnvironmentImpact(state, tx, tz, Math.max(4.5, strike.radius * 1.12), 'arcane');
    addChronicle(state, `${atkName} called down a Starfall Cataclysm upon ${defName}!`, 'warning');
  } else if (strike.kind === 'orc_siege_boulder') {
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'animal_attack',
      variant: 'slam',
      originX: strike.originX,
      originZ: strike.originZ,
      x: tx,
      y: hitY,
      z: tz,
      radius: strike.radius * 1.15,
      color: '#ff5400',
      createdAt: Date.now(),
    });
    if (targetTile && targetTile.height > 0 && state.worldRules?.wildfireSpread !== false) {
      targetTile.onFireTimer = Math.max(targetTile.onFireTimer, 10.5);
      targetTile.fireColor = '#ff3b30';
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'fire_spread',
        x: tx,
        y: hitY,
        z: tz,
        radius: 2.4,
        color: '#ff3b30',
        createdAt: Date.now(),
      });
    }
    applyWarfareCraterImpact(state, tx, tz, Math.max(2.6, strike.radius * 0.95), 'orc', 2);
  } else if (strike.kind === 'orc_waagh_rocket') {
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'hit_spark',
      x: tx,
      y: hitY,
      z: tz,
      radius: strike.radius * 1.3,
      color: '#ff3b30',
      createdAt: Date.now(),
    });
    if (targetTile && targetTile.height > 0 && state.worldRules?.wildfireSpread !== false) {
      targetTile.onFireTimer = Math.max(targetTile.onFireTimer, 9.5);
      targetTile.fireColor = '#ff3b30';
    }
    applyWarfareCraterImpact(state, tx, tz, Math.max(2.5, strike.radius * 0.92), 'orc', 2);
  } else if (strike.kind === 'dwarf_seismic_hammer') {
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'nuke_blast',
      originX: strike.originX,
      originY,
      originZ: strike.originZ,
      x: tx,
      y: hitY,
      z: tz,
      radius: strike.radius * 1.15,
      color: '#f59e0b',
      createdAt: Date.now(),
    });
    applySuperweaponEnvironmentImpact(state, tx, tz, Math.max(4.6, strike.radius * 1.15), 'seismic');
    addChronicle(state, `${atkName}'s Tectonic Forge-Hammer shattered ${defName}!`, 'warning');
  } else if (strike.kind === 'lizard_solar_cataclysm') {
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'arcane_cataclysm',
      originX: strike.originX,
      originY,
      originZ: strike.originZ,
      x: tx,
      y: hitY,
      z: tz,
      radius: strike.radius * 1.15,
      color: '#facc15',
      createdAt: Date.now(),
    });
    applySuperweaponEnvironmentImpact(state, tx, tz, Math.max(4.5, strike.radius * 1.12), 'solar');
    addChronicle(state, `${atkName} unleashed a Sun-Prism Cataclysm upon ${defName}!`, 'warning');
  } else if (strike.kind === 'dwarf_quake_mortar') {
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'animal_attack',
      variant: 'slam',
      originX: strike.originX,
      originZ: strike.originZ,
      x: tx,
      y: hitY,
      z: tz,
      radius: strike.radius * 1.25,
      color: '#f59e0b',
      createdAt: Date.now(),
    });
    if (targetTile && targetTile.height > 0 && state.worldRules?.wildfireSpread !== false) {
      targetTile.onFireTimer = Math.max(targetTile.onFireTimer, 8.0);
      targetTile.fireColor = '#f59e0b';
    }
    applyWarfareCraterImpact(state, tx, tz, Math.max(2.6, strike.radius * 0.95), 'seismic', 2);
  } else if (strike.kind === 'lizard_solar_lance') {
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'hit_spark',
      x: tx,
      y: hitY,
      z: tz,
      radius: strike.radius * 1.3,
      color: '#facc15',
      createdAt: Date.now(),
    });
    if (targetTile && targetTile.height > 0 && state.worldRules?.wildfireSpread !== false) {
      targetTile.onFireTimer = Math.max(targetTile.onFireTimer, 9.0);
      targetTile.fireColor = '#facc15';
    }
    applyWarfareCraterImpact(state, tx, tz, Math.max(2.5, strike.radius * 0.92), 'solar', 1);
  } else if (strike.kind === 'elf_starfall_spell') {
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'hit_spark',
      x: tx,
      y: hitY,
      z: tz,
      radius: strike.radius * 1.3,
      color: '#c084fc',
      createdAt: Date.now(),
    });
    if (targetTile && targetTile.height > 0 && state.worldRules?.wildfireSpread !== false) {
      targetTile.onFireTimer = Math.max(targetTile.onFireTimer, 8.0);
      targetTile.fireColor = '#c084fc';
    }
    applyWarfareCraterImpact(state, tx, tz, Math.max(2.4, strike.radius * 0.9), 'arcane', 1);
  } else {
    // Conventional Human ICBM / ballistic missile strike
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'hit_spark',
      x: tx,
      y: hitY,
      z: tz,
      radius: strike.radius * 1.35,
      color: '#ff6b35',
      createdAt: Date.now(),
    });
    if (targetTile && targetTile.height > 0 && state.worldRules?.wildfireSpread !== false) {
      targetTile.onFireTimer = Math.max(targetTile.onFireTimer, 9.0);
      targetTile.fireColor = '#ff6b35';
    }
    applyWarfareCraterImpact(state, tx, tz, Math.max(2.6, strike.radius * 0.95), 'explosive', 2);
  }

  const r = strike.isSuperweapon ? strike.radius * 1.2 : strike.radius * 1.08;
  const effectiveDamage = strike.isSuperweapon ? strike.damage * 1.45 : strike.damage * 1.25;
  const isElfSpell = strike.kind === 'elf_starfall_spell' || strike.kind === 'elf_astral_cataclysm';
  const isHumanNuke = strike.kind === 'icbm_nuke';
  const isHeavyBlast =
    strike.kind === 'icbm_nuke' ||
    strike.kind === 'elf_astral_cataclysm' ||
    strike.kind === 'dwarf_seismic_hammer' ||
    strike.kind === 'lizard_solar_cataclysm' ||
    strike.kind === 'orc_siege_boulder' ||
    strike.kind === 'orc_waagh_rocket';

  for (let i = 0; i < state.units.length; i++) {
    const candidate = state.units[i];
    if (candidate.state === 'ko' || candidate.hp <= 0 || candidate.statusEffects?.shielded) continue;
    const cKid =
      candidate.faction === 'civilization'
        ? candidate.settlementId
          ? getKingdomId(state, candidate.settlementId)
          : candidate.kingdomId
        : undefined;
    if (cKid === strike.attackerKingdomId) {
      if (isElfSpell && Math.hypot(candidate.x - tx, candidate.z - tz) <= r + 1.5) {
        candidate.hp = Math.min(candidate.maxHp, candidate.hp + 25);
      }
      continue;
    }
    if (candidate.ageStage === 'child') continue;
    const d = Math.hypot(candidate.x - tx, candidate.z - tz);
    if (d <= r) {
      const falloff = d <= r * 0.55 ? 1.0 : 0.7;
      candidate.hp -= effectiveDamage * falloff;
      candidate.underAttackTimer = 8.0;
      if ((isElfSpell || isHumanNuke) && candidate.statusEffects) {
        candidate.statusEffects.cursed = Math.max(candidate.statusEffects.cursed ?? 0, isHumanNuke ? 18.0 : 8.5);
      }
      if (candidate.hp > 0 && isHeavyBlast) {
        const safeD = Math.max(0.35, d);
        const launchPower = strike.isSuperweapon ? 7.8 : 4.5;
        candidate.vxAir = ((candidate.x - tx) / safeD) * launchPower;
        candidate.vzAir = ((candidate.z - tz) / safeD) * launchPower;
        candidate.altitude = Math.max(candidate.altitude ?? 0, 0.9);
        candidate.vzVertical = strike.isSuperweapon ? 7.2 : 4.6;
        candidate.fallDamageArmed = true;
      }
    }
  }

  for (let vi = 0; vi < (state.vehicles?.length ?? 0); vi++) {
    const v = state.vehicles![vi];
    if ((v.hp ?? 0) <= 0) continue;
    const vKid = v.kingdomId ?? getKingdomId(state, v.settlementId);
    if (vKid === strike.attackerKingdomId) continue;
    if (Math.hypot(v.x - tx, v.z - tz) <= r) {
      v.hp = Math.max(0, (v.hp ?? 100) - effectiveDamage * 0.9);
    }
  }

  const bldMult =
    strike.kind === 'dwarf_seismic_hammer'
      ? 2.25
      : strike.isSuperweapon
        ? 2.0
        : strike.kind === 'orc_siege_boulder' || strike.kind === 'dwarf_quake_mortar'
          ? 1.75
          : 1.45;
  const attackerSid = resolvePrimarySettlementForKingdom(state, strike.attackerKingdomId, tx, tz);
  const shockedSettlements = new Set<string>();
  for (let bi = 0; bi < state.buildings.length; bi++) {
    const b = state.buildings[bi];
    if (b.hp <= 0) continue;
    const bKid = b.settlementId ? getKingdomId(state, b.settlementId) : undefined;
    if (bKid === strike.attackerKingdomId) continue;
    const bd = Math.hypot(b.tileX - tx, b.tileZ - tz);
    if (bd <= r + 0.6) {
      if (b.shieldTimer > 0) {
        if (strike.isSuperweapon && bd <= 4.0) b.shieldTimer = 0;
        else continue;
      }
      if (b.settlementId) shockedSettlements.add(b.settlementId);
      const bFalloff = bd <= r * 0.55 ? 1.0 : 0.72;
      b.hp = Math.max(0, b.hp - effectiveDamage * bldMult * bFalloff);
      const bt = getTile(state, b.tileX, b.tileZ);
      if (bt && state.worldRules?.wildfireSpread !== false) {
        bt.onFireTimer = Math.max(bt.onFireTimer, strike.isSuperweapon ? 11.0 : 7.5);
      }
      if (b.hp <= 0) {
        if (bt) {
          if (bt.buildingId === b.id) bt.buildingId = null;
          bt.terrain = 'scorched';
          bt.devastatedTimer = Math.max(bt.devastatedTimer ?? 0, strike.isSuperweapon ? 50 : 30);
        }
        if (attackerSid) {
          claimTerritoryAround(state, b.tileX, b.tileZ, 4.2, attackerSid, strike.attackerKingdomId, true);
        }
      }
    }
  }
  if (shockedSettlements.size > 0) {
    if (!state.settlementRebuildCooldowns) state.settlementRebuildCooldowns = {};
    const shockAdd = strike.isSuperweapon ? 24 : 14;
    for (const sid of shockedSettlements) {
      state.settlementRebuildCooldowns[sid] = Math.min(42, (state.settlementRebuildCooldowns[sid] ?? 0) + shockAdd);
    }
  }
  if (attackerSid) {
    claimTerritoryAround(state, tx, tz, Math.max(2.2, r * 0.85), attackerSid, strike.attackerKingdomId, true);
  }
}

export function stepStrategicWarfare(state: SimulationState, dt: number): void {
  // 1. Advance and resolve all in-flight transcontinental missiles, spells & siege barrages
  const strikes = state.activeStrategicStrikes;
  if (strikes && strikes.length > 0) {
    for (let i = strikes.length - 1; i >= 0; i--) {
      const s = strikes[i];
      s.elapsed += dt;
      if (s.elapsed >= s.flightDuration) {
        resolveStrategicStrikeImpact(state, s);
        strikes.splice(i, 1);
      }
    }
  }

  if (state.worldRules?.warsEnabled === false) return;

  state.strategicWarTimer = (state.strategicWarTimer ?? 0) + dt;
  if (state.strategicWarTimer < 3.6) return;
  state.strategicWarTimer = 0;

  if ((state.activeStrategicStrikes?.length ?? 0) >= 14) return;

  // 2. Gather living kingdoms & their military launch sites / targets
  interface KingdomWarInfo {
    kingdomId: string;
    species: SpeciesId;
    epoch: number;
    launchX: number;
    launchZ: number;
    hasLaunchPriority: boolean;
    buildings: BuildingEntity[];
    units: UnitEntity[];
  }
  const byKid = new Map<string, KingdomWarInfo>();

  for (let bi = 0; bi < state.buildings.length; bi++) {
    const b = state.buildings[bi];
    if (b.hp <= 0 || !b.settlementId) continue;
    const kid = getKingdomId(state, b.settlementId);
    const sp: SpeciesId = state.settlementSpecies?.[kid] ?? state.settlementSpecies?.[b.settlementId] ?? b.species ?? 'human';
    let info = byKid.get(kid);
    if (!info) {
      info = {
        kingdomId: kid,
        species: sp,
        epoch: getKingdomEpoch(state, kid),
        launchX: b.tileX,
        launchZ: b.tileZ,
        hasLaunchPriority: false,
        buildings: [],
        units: [],
      };
      byKid.set(kid, info);
    }
    info.buildings.push(b);
    const isPriorityLauncher =
      b.type === 'launch_arcology' ||
      b.type === 'dyson_spire' ||
      b.type === 'fission_reactor' ||
      b.type === 'airport' ||
      b.type === 'steam_foundry' ||
      b.type === 'observatory' ||
      b.type === 'ziggurat' ||
      b.type === 'shaman_totem';
    if (isPriorityLauncher && !info.hasLaunchPriority) {
      info.launchX = b.tileX;
      info.launchZ = b.tileZ;
      info.hasLaunchPriority = true;
    }
  }

  for (let ui = 0; ui < state.units.length; ui++) {
    const u = state.units[ui];
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
    const kid = u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId;
    if (!kid) continue;
    let info = byKid.get(kid);
    if (!info) {
      info = {
        kingdomId: kid,
        species: u.species,
        epoch: getKingdomEpoch(state, kid),
        launchX: u.x,
        launchZ: u.z,
        hasLaunchPriority: false,
        buildings: [],
        units: [],
      };
      byKid.set(kid, info);
    }
    info.units.push(u);
  }

  const kingdoms = Array.from(byKid.values());
  if (kingdoms.length < 2) return;

  if (!state.activeStrategicStrikes) state.activeStrategicStrikes = [];

  for (let ai = 0; ai < kingdoms.length; ai++) {
    if (state.activeStrategicStrikes.length >= 14) break;
    const atk = kingdoms[ai];
    const completedAtkBlds = atk.buildings.filter((b) => b.hp > 0 && b.constructionProgress >= 100);
    // Fight-back strategic barrages require a working population and established settlement infrastructure
    if (completedAtkBlds.length < 3 || atk.units.length < 5) continue;

    // Pick a warring enemy kingdom
    const enemies = kingdoms.filter(
      (def) =>
        def.kingdomId !== atk.kingdomId &&
        (def.buildings.length > 0 || def.units.length > 0) &&
        areKingdomsAtWar(state, atk.kingdomId, def.kingdomId),
    );
    if (enemies.length === 0) continue;

    const enemyIdx = Math.floor(Math.abs(state.year * 13 + ai * 7)) % enemies.length;
    const def = enemies[enemyIdx];

    // Pick a high-value target in enemy territory (building preferred, else warrior/king)
    let targetX = def.launchX;
    let targetZ = def.launchZ;
    if (def.buildings.length > 0) {
      const bPick = def.buildings[Math.floor(Math.random() * def.buildings.length)];
      targetX = bPick.tileX;
      targetZ = bPick.tileZ;
    } else if (def.units.length > 0) {
      const uPick = def.units[Math.floor(Math.random() * def.units.length)];
      targetX = uPick.x;
      targetZ = uPick.z;
    }

    // Pick a fresh launch building from attacker's completed settlements so salvos fan out naturally
    let originX = atk.launchX;
    let originZ = atk.launchZ;
    const launchCandidates = completedAtkBlds.filter(
      (b) =>
        b.type === 'launch_arcology' ||
        b.type === 'dyson_spire' ||
        b.type === 'fission_reactor' ||
        b.type === 'airport' ||
        b.type === 'steam_foundry' ||
        b.type === 'observatory' ||
        b.type === 'ziggurat' ||
        b.type === 'shaman_totem',
    );
    const pool = launchCandidates.length > 0 ? launchCandidates : completedAtkBlds;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    originX = picked.tileX;
    originZ = picked.tileZ;

    const dist = Math.hypot(targetX - originX, targetZ - originZ);
    if (dist < 7.5) continue;

    const hasIndustrialFacility = completedAtkBlds.some(
      (b) =>
        b.type === 'steam_foundry' ||
        b.type === 'dynamo_plant' ||
        b.type === 'fission_reactor' ||
        b.type === 'airport' ||
        b.type === 'launch_arcology' ||
        b.type === 'dyson_spire' ||
        b.type === 'smeltery' ||
        b.type === 'cyber_institute',
    );
    const hasSuperweaponFacility = completedAtkBlds.some(
      (b) =>
        b.type === 'fission_reactor' ||
        b.type === 'airport' ||
        b.type === 'launch_arcology' ||
        b.type === 'dyson_spire' ||
        b.type === 'cyber_institute' ||
        b.type === 'observatory',
    );
    const atkStock = ensureKingdomResources(state, atk.kingdomId);
    const trySpendStrikeCost = (cost: Partial<Resources>): boolean => {
      if (state.sandboxFreeMode) return true;
      if (!canAfford(atkStock, cost, false)) return false;
      spendWorldCost(state, cost, atk.kingdomId);
      return true;
    };

    const originTile = getTile(state, originX, originZ);
    const originY = (originTile?.height ?? 2) * 0.45 + 0.65;
    const targetTile = getTile(state, targetX, targetZ);
    const targetY = (targetTile?.height ?? 2) * 0.45 + 0.35;
    const kUltReady = (state.kingdomUltimateCooldowns?.[atk.kingdomId] ?? 0) <= 0;

    const queueStrike = (
      kind: StrategicStrikeKind,
      vfxSubtype: VisualEffectEvent['vfxSubtype'],
      tx: number,
      tz: number,
      flightDuration: number,
      damage: number,
      radius: number,
      color: string,
      isSuperweapon = false,
    ) => {
      const strikeId = nextEntityId('strike');
      state.activeStrategicStrikes!.push({
        id: strikeId,
        attackerKingdomId: atk.kingdomId,
        targetKingdomId: def.kingdomId,
        species: atk.species,
        kind,
        originX,
        originZ,
        targetX: tx,
        targetZ: tz,
        elapsed: 0,
        flightDuration,
        damage,
        radius,
        isSuperweapon,
      });
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'projectile_tracer',
        vfxSubtype,
        species: atk.species,
        originX,
        originY,
        originZ,
        x: tx,
        y: targetY,
        z: tz,
        radius: isSuperweapon ? 2.4 : 1.55,
        color,
        flightDuration,
        createdAt: Date.now(),
      });
    };

    if (atk.species === 'human') {
      // Humans prioritize transcontinental ballistic missile warfare — requires industrial/military buildings, population & munitions!
      if (
        atk.epoch >= 4 &&
        kUltReady &&
        completedAtkBlds.length >= 9 &&
        atk.units.length >= 16 &&
        hasSuperweaponFacility &&
        (def.buildings.length >= 2 || def.units.length >= 3) &&
        trySpendStrikeCost({ ore: 28, alloy: 20 })
      ) {
        if (!state.kingdomUltimateCooldowns) state.kingdomUltimateCooldowns = {};
        state.kingdomUltimateCooldowns[atk.kingdomId] = 42.0;
        const flightDur = Math.max(1.85, Math.min(3.8, 1.35 + dist * 0.032));
        queueStrike('icbm_nuke', 'icbm_missile', targetX, targetZ, flightDur, 220, 5.8, '#ff6b35', true);
      } else if (
        atk.epoch >= 3 &&
        completedAtkBlds.length >= 6 &&
        atk.units.length >= 10 &&
        hasIndustrialFacility &&
        trySpendStrikeCost({ ore: 12, alloy: 6 })
      ) {
        // Transcontinental cruise/ballistic missile salvo (1-2 missiles)
        const salvoCount = atk.epoch >= 5 ? 2 : 1;
        for (let si = 0; si < salvoCount; si++) {
          const jx = si === 0 ? 0 : (Math.random() - 0.5) * 3.5;
          const jz = si === 0 ? 0 : (Math.random() - 0.5) * 3.5;
          const tx = Math.max(2, Math.min(state.gridSize - 3, targetX + jx));
          const tz = Math.max(2, Math.min(state.gridSize - 3, targetZ + jz));
          const flightDur = Math.max(1.4, Math.min(3.3, 1.05 + dist * 0.028 + si * 0.25));
          queueStrike(
            'icbm_missile',
            'icbm_missile',
            tx,
            tz,
            flightDur,
            46 + atk.epoch * 12,
            2.6,
            atk.epoch >= 6 ? '#38bdf8' : '#ff6b35',
            false,
          );
        }
      } else if (atk.epoch >= 2 && dist <= 34 && trySpendStrikeCost({ stone: 10, ore: 6 })) {
        // Iron/Medieval Age long-range artillery barrage
        const flightDur = Math.max(1.1, Math.min(2.3, 0.85 + dist * 0.03));
        queueStrike('icbm_missile', 'cannon_shell', targetX, targetZ, flightDur, 36, 2.1, '#ffd166', false);
      }
    } else if (atk.species === 'elf') {
      // Elves weave long-range astral starfall spells — requires population, lore buildings & knowledge!
      if (
        atk.epoch >= 4 &&
        kUltReady &&
        completedAtkBlds.length >= 9 &&
        atk.units.length >= 16 &&
        hasSuperweaponFacility &&
        (def.buildings.length >= 2 || def.units.length >= 3) &&
        trySpendStrikeCost({ knowledge: 30, alloy: 16 })
      ) {
        if (!state.kingdomUltimateCooldowns) state.kingdomUltimateCooldowns = {};
        state.kingdomUltimateCooldowns[atk.kingdomId] = 42.0;
        const flightDur = Math.max(1.9, Math.min(3.7, 1.4 + dist * 0.03));
        queueStrike('elf_astral_cataclysm', 'elf_starfall_spell', targetX, targetZ, flightDur, 210, 5.6, '#c084fc', true);
      } else if (atk.epoch >= 1 && completedAtkBlds.length >= 4 && atk.units.length >= 7 && trySpendStrikeCost({ knowledge: 14, wood: 8 })) {
        const spellCount = atk.epoch >= 4 ? 2 : 1;
        for (let si = 0; si < spellCount; si++) {
          const jx = si === 0 ? 0 : (Math.random() - 0.5) * 3.8;
          const jz = si === 0 ? 0 : (Math.random() - 0.5) * 3.8;
          const tx = Math.max(2, Math.min(state.gridSize - 3, targetX + jx));
          const tz = Math.max(2, Math.min(state.gridSize - 3, targetZ + jz));
          const flightDur = Math.max(1.45, Math.min(3.4, 1.1 + dist * 0.028 + si * 0.28));
          queueStrike(
            'elf_starfall_spell',
            'elf_starfall_spell',
            tx,
            tz,
            flightDur,
            40 + atk.epoch * 11,
            2.7,
            si === 0 ? '#c084fc' : '#5eead4',
            false,
          );
        }
      }
    } else if (atk.species === 'dwarf') {
      // Dwarves: Runic Seismic Quake Mortars -> Tectonic Forge-Hammer superweapon!
      if (
        atk.epoch >= 4 &&
        kUltReady &&
        completedAtkBlds.length >= 9 &&
        atk.units.length >= 16 &&
        hasSuperweaponFacility &&
        (def.buildings.length >= 2 || def.units.length >= 3) &&
        trySpendStrikeCost({ ore: 30, alloy: 18 })
      ) {
        if (!state.kingdomUltimateCooldowns) state.kingdomUltimateCooldowns = {};
        state.kingdomUltimateCooldowns[atk.kingdomId] = 42.0;
        const flightDur = Math.max(1.85, Math.min(3.7, 1.35 + dist * 0.032));
        queueStrike('dwarf_seismic_hammer', 'dwarf_quake_mortar', targetX, targetZ, flightDur, 225, 5.8, '#f59e0b', true);
      } else if (atk.epoch >= 2 && completedAtkBlds.length >= 5 && atk.units.length >= 8 && trySpendStrikeCost({ ore: 12, stone: 8 })) {
        const salvoCount = atk.epoch >= 4 ? 2 : 1;
        for (let si = 0; si < salvoCount; si++) {
          const jx = si === 0 ? 0 : (Math.random() - 0.5) * 3.4;
          const jz = si === 0 ? 0 : (Math.random() - 0.5) * 3.4;
          const tx = Math.max(2, Math.min(state.gridSize - 3, targetX + jx));
          const tz = Math.max(2, Math.min(state.gridSize - 3, targetZ + jz));
          const flightDur = Math.max(1.3, Math.min(3.1, 1.0 + dist * 0.028 + si * 0.25));
          queueStrike('dwarf_quake_mortar', 'dwarf_quake_mortar', tx, tz, flightDur, 48 + atk.epoch * 11, 2.8, '#f59e0b', false);
        }
      }
    } else if (atk.species === 'lizardfolk') {
      // Lizardfolk: Solar Prism Lances -> Sun-Prism Cataclysm superweapon!
      if (
        atk.epoch >= 4 &&
        kUltReady &&
        completedAtkBlds.length >= 9 &&
        atk.units.length >= 16 &&
        hasSuperweaponFacility &&
        (def.buildings.length >= 2 || def.units.length >= 3) &&
        trySpendStrikeCost({ knowledge: 26, alloy: 16 })
      ) {
        if (!state.kingdomUltimateCooldowns) state.kingdomUltimateCooldowns = {};
        state.kingdomUltimateCooldowns[atk.kingdomId] = 42.0;
        const flightDur = Math.max(1.8, Math.min(3.6, 1.3 + dist * 0.03));
        queueStrike('lizard_solar_cataclysm', 'lizard_solar_lance', targetX, targetZ, flightDur, 215, 5.6, '#facc15', true);
      } else if (atk.epoch >= 1 && completedAtkBlds.length >= 4 && atk.units.length >= 7 && trySpendStrikeCost({ knowledge: 12, stone: 8 })) {
        const lanceCount = atk.epoch >= 4 ? 2 : 1;
        for (let si = 0; si < lanceCount; si++) {
          const jx = si === 0 ? 0 : (Math.random() - 0.5) * 3.6;
          const jz = si === 0 ? 0 : (Math.random() - 0.5) * 3.6;
          const tx = Math.max(2, Math.min(state.gridSize - 3, targetX + jx));
          const tz = Math.max(2, Math.min(state.gridSize - 3, targetZ + jz));
          const flightDur = Math.max(1.35, Math.min(3.2, 1.05 + dist * 0.026 + si * 0.24));
          queueStrike('lizard_solar_lance', 'lizard_solar_lance', tx, tz, flightDur, 42 + atk.epoch * 11, 2.7, si === 0 ? '#facc15' : '#10b981', false);
        }
      }
    } else {
      // Orcs: Flaming magma siege boulders early -> chaotic WAAAGH! scrap-rocket swarms when properly built & stocked!
      if (
        atk.epoch >= 3 &&
        completedAtkBlds.length >= 6 &&
        atk.units.length >= 10 &&
        hasIndustrialFacility &&
        trySpendStrikeCost({ ore: 16, wood: 10 })
      ) {
        const rocketCount = atk.epoch >= 5 ? 3 : 2;
        for (let ri = 0; ri < rocketCount; ri++) {
          const scatter = 2.8 + ri * 1.4;
          const tx = Math.max(2, Math.min(state.gridSize - 3, targetX + (Math.random() - 0.5) * scatter));
          const tz = Math.max(2, Math.min(state.gridSize - 3, targetZ + (Math.random() - 0.5) * scatter));
          const flightDur = Math.max(1.3, Math.min(3.1, 0.98 + dist * 0.026 + ri * 0.22));
          queueStrike(
            'orc_waagh_rocket',
            'orc_waagh_rocket',
            tx,
            tz,
            flightDur,
            34 + atk.epoch * 9,
            2.5,
            ri % 2 === 0 ? '#ff3b30' : '#ff6b1a',
            false,
          );
        }
      } else if (dist <= 46 && trySpendStrikeCost({ stone: 12, wood: 8 })) {
        // Brutal flaming magma siege boulder catapult barrage
        const flightDur = Math.max(1.35, Math.min(2.9, 1.05 + dist * 0.032));
        queueStrike('orc_siege_boulder', 'orc_siege_boulder', targetX, targetZ, flightDur, 42 + atk.epoch * 10, 2.6, '#ff5400', false);
      }
    }
  }
}

function findLocalSettlementBuilding(
  state: SimulationState,
  x: number,
  z: number,
  maxRadius = SETTLEMENT_AWARENESS_RADIUS,
): BuildingEntity | null {
  let nearest: BuildingEntity | null = null;
  let bestDistSq = maxRadius * maxRadius;
  for (const b of state.buildings) {
    const dSq = (b.tileX - x) ** 2 + (b.tileZ - z) ** 2;
    if (dSq <= bestDistSq) {
      bestDistSq = dSq;
      nearest = b;
    }
  }
  return nearest;
}

function getSettlementAnchorForId(state: SimulationState, settlementId: string): { x: number; z: number } {
  const matching = state.buildings.filter((b) => (b.settlementId ?? 'city_default') === settlementId);
  if (matching.length === 0) return getSettlementAnchor(state);
  const hearth = matching.find((b) => b.type === 'bonfire') ?? matching[0];
  return {
    x: hearth.tileX,
    z: hearth.tileZ,
  };
}

export function getSettlementAnchor(state: SimulationState): { x: number; z: number } {
  if (state.buildings.length > 0) {
    const primaryHearth = state.buildings.find((b) => b.type === 'bonfire') ?? state.buildings[0];
    return {
      x: primaryHearth.tileX,
      z: primaryHearth.tileZ,
    };
  }
  const civs = state.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko');
  if (civs.length > 0) {
    let sx = 0;
    let sz = 0;
    for (const u of civs) {
      sx += u.x;
      sz += u.z;
    }
    return {
      x: Math.round(sx / civs.length),
      z: Math.round(sz / civs.length),
    };
  }
  const c = Math.floor(state.gridSize / 2);
  return { x: c, z: c };
}

function getSettlementLayoutVariant(
  state: SimulationState,
  settlementId: string,
  ox: number,
  oz: number,
): number {
  let hash = Math.abs((ox * 31 + oz * 17 + (state.seed ?? 7)) | 0);
  for (let i = 0; i < settlementId.length; i++) {
    hash = (hash * 33 + settlementId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 4;
}

export function isSettlementRoadTile(dx: number, dz: number, variant: number): boolean {
  if (dx === 0 && dz === 0) return false; // Founding hearth sits at (0,0)
  const adx = Math.abs(dx);
  const adz = Math.abs(dz);
  const maxD = Math.max(adx, adz);
  if (maxD > 13) return false;

  switch (variant & 3) {
    case 0: {
      // Variant 0: Crisp 1-tile-wide Manhattan Block Grid (leaves 3x3 = 9-tile building blocks in every cell; ~74% building lots!)
      const onCrossSpine = dx === 0 || dz === 0;
      const onBlockStreets = (adx % 4 === 0 && adz <= 12) || (adz % 4 === 0 && adx <= 12);
      return onCrossSpine || onBlockStreets;
    }
    case 1: {
      // Variant 1: 1-tile-wide Avenues & Side Streets framing 2x3 rectangular residential/tower blocks (~70% building lots!)
      const onCrossSpine = dx === 0 || dz === 0;
      const onAvenues = (adx % 3 === 0 && adx <= 12 && adz <= 12) || (adz % 4 === 0 && adz <= 12 && adx <= 12);
      return onCrossSpine || onAvenues;
    }
    case 2: {
      // Variant 2: Concentric 1-tile Ring Boulevards at r=4, 8, 12 crossed by Cardinal Spokes (leaves 3x3 building blocks!)
      const onCrossSpine = dx === 0 || dz === 0;
      const onInnerRing = (adx === 4 && adz <= 4) || (adz === 4 && adx <= 4);
      const onMidRing = (adx === 8 && adz <= 8) || (adz === 8 && adx <= 8);
      const onOuterRing = (adx === 12 && adz <= 12) || (adz === 12 && adx <= 12);
      return onCrossSpine || onInnerRing || onMidRing || onOuterRing;
    }
    default: {
      // Variant 3: 1-tile-wide Terrace Boulevards framing 3x2 horizontal urban blocks (~70% building lots!)
      const onCrossSpine = dx === 0 || dz === 0;
      const onTerraceStreets = (adx % 4 === 0 && adx <= 12 && adz <= 12) || (adz % 3 === 0 && adz <= 12 && adx <= 12);
      return onCrossSpine || onTerraceStreets;
    }
  }
}

function getSettlementTargetGradeHeight(
  state: SimulationState,
  anchor: { x: number; z: number },
  settlementId: string,
): number {
  const anchorTile = getTile(state, anchor.x, anchor.z);
  if (anchorTile && anchorTile.height > 0) {
    return Math.max(1, Math.min(4, anchorTile.height));
  }
  const heights: number[] = [];
  for (const b of state.buildings) {
    if ((b.settlementId ?? 'city_default') !== settlementId) continue;
    const bt = getTile(state, b.tileX, b.tileZ);
    if (bt && bt.height > 0) heights.push(bt.height);
  }
  if (heights.length > 0) {
    heights.sort((a, b) => a - b);
    return Math.max(1, Math.min(4, heights[Math.floor(heights.length / 2)]));
  }
  return 2;
}

function paveRailTileIfClean(state: SimulationState, x: number, z: number, targetHeight?: number): boolean {
  const t = getTile(state, x, z);
  if (!t || t.height <= 0 || t.buildingId) return false;
  if (
    t.terrain === 'stone_road' ||
    t.terrain === 'crystal_field' ||
    t.terrain === 'rail_track' ||
    t.terrain === 'runway'
  ) {
    return false;
  }
  // Never complete a 2x2 solid rail clump: 8-way diagonal crossings remain connected without blocky squares
  const isRail = (tx: number, tz: number) => getTile(state, tx, tz)?.terrain === 'rail_track';
  for (const [ox, oz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    if (isRail(x + ox, z) && isRail(x, z + oz) && isRail(x + ox, z + oz)) {
      return false;
    }
  }
  if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove' || t.resourceNode === 'stone_outcrop') {
    t.resourceNode = 'none';
    t.resourceAmount = 0;
  }
  if (targetHeight !== undefined && Math.abs(t.height - targetHeight) > 0) {
    t.height = Math.max(1, Math.min(4, targetHeight));
  }
  t.terrain = 'rail_track';
  t.farmSettlementId = undefined;
  return true;
}

export function paveAirportRunwayForBuilding(
  state: SimulationState,
  apX: number,
  apZ: number,
): TileData[] {
  const apTile = getTile(state, apX, apZ);
  const targetHeight = Math.max(1, Math.min(5, apTile && apTile.height > 0 ? apTile.height : 2));

  // If airport already has >= 4 contiguous runway tiles nearby, return them
  const existing: TileData[] = [];
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const rt = getTile(state, apX + dx, apZ + dz);
      if (rt && rt.terrain === 'runway' && !rt.buildingId) {
        existing.push(rt);
      }
    }
  }
  if (existing.length >= 4) return existing;

  type CandidateStrip = { tiles: TileData[]; score: number };
  let best: CandidateStrip | null = null;

  const evalStrip = (coords: Array<[number, number]>) => {
    const tiles: TileData[] = [];
    let score = 0;
    for (const [cx, cz] of coords) {
      const t = getTile(state, cx, cz);
      if (!t || t.height <= 0 || t.buildingId || t.terrain === 'deep_water' || t.terrain === 'shallow_water') {
        return;
      }
      if (t.terrain === 'rail_track') return;
      tiles.push(t);
      if (t.terrain === 'runway') score += 20;
      else if (t.terrain === 'stone_road') score -= 12;
      else if (t.resourceNode !== 'none') score -= 4;
      else score += 6;
      score -= Math.abs(t.height - targetHeight) * 5;
    }
    if (!best || score > best.score) {
      best = { tiles, score };
    }
  };

  // Try horizontal (W-E) and vertical (N-S) 5-tile runways along each side of the airport terminal
  for (const offset of [1, -1, 2, -2]) {
    for (const shift of [0, 1, -1, 2, -2]) {
      const horiz: Array<[number, number]> = [];
      const vert: Array<[number, number]> = [];
      for (let k = -2; k <= 2; k++) {
        horiz.push([apX + shift + k, apZ + offset]);
        vert.push([apX + offset, apZ + shift + k]);
      }
      evalStrip(horiz);
      evalStrip(vert);
    }
  }

  if (!best) {
    // Shorter 3-tile emergency strip fallback if tightly surrounded by water/buildings
    for (const offset of [1, -1]) {
      const horiz: Array<[number, number]> = [
        [apX - 1, apZ + offset],
        [apX, apZ + offset],
        [apX + 1, apZ + offset],
      ];
      const vert: Array<[number, number]> = [
        [apX + offset, apZ - 1],
        [apX + offset, apZ],
        [apX + offset, apZ + 1],
      ];
      evalStrip(horiz);
      evalStrip(vert);
    }
  }

  if (!best) return [];
  for (const rt of (best as CandidateStrip).tiles) {
    rt.height = targetHeight;
    rt.terrain = 'runway';
    rt.farmSettlementId = undefined;
    rt.onFireTimer = 0;
    if (rt.resourceNode !== 'none') {
      rt.resourceNode = 'none';
      rt.resourceAmount = 0;
    }
  }
  return (best as CandidateStrip).tiles;
}

function findAirportRunwayEndpoints(
  state: SimulationState,
  ap: BuildingEntity,
): { start: { x: number; z: number }; end: { x: number; z: number }; heading: number } {
  const runwayTiles: TileData[] = [];
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      const rt = getTile(state, ap.tileX + dx, ap.tileZ + dz);
      if (rt && rt.terrain === 'runway') {
        runwayTiles.push(rt);
      }
    }
  }
  if (runwayTiles.length >= 2) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const rt of runwayTiles) {
      if (rt.x < minX) minX = rt.x;
      if (rt.x > maxX) maxX = rt.x;
      if (rt.z < minZ) minZ = rt.z;
      if (rt.z > maxZ) maxZ = rt.z;
    }
    const spanX = maxX - minX;
    const spanZ = maxZ - minZ;
    if (spanX >= spanZ) {
      const zAvg = runwayTiles.reduce((s, t) => s + t.z, 0) / runwayTiles.length;
      const start = { x: minX, z: zAvg };
      const end = { x: maxX, z: zAvg };
      return { start, end, heading: Math.atan2(end.x - start.x, end.z - start.z) };
    } else {
      const xAvg = runwayTiles.reduce((s, t) => s + t.x, 0) / runwayTiles.length;
      const start = { x: xAvg, z: minZ };
      const end = { x: xAvg, z: maxZ };
      return { start, end, heading: Math.atan2(end.x - start.x, end.z - start.z) };
    }
  }
  return {
    start: { x: ap.tileX - 1.5, z: ap.tileZ },
    end: { x: ap.tileX + 1.5, z: ap.tileZ },
    heading: Math.PI / 2,
  };
}

/**
 * Traces a thin, smooth 8-connected quadratic Bezier railway corridor between (sx,sz) -> (mx,mz) -> (ex,ez)
 * without creating 90-degree zigzag staircases or 2x2 micro-loops.
 */
function traceSmoothRailSpline(
  state: SimulationState,
  sx: number,
  sz: number,
  mx: number,
  mz: number,
  ex: number,
  ez: number,
  avoidTightLoops = true,
): Array<{ x: number; z: number }> {
  const totalDist = Math.hypot(ex - sx, ez - sz);
  const sampleCount = Math.max(8, Math.ceil(totalDist * 3.5));
  const rawPts: Array<{ x: number; z: number }> = [];

  const pushThinStep = (tx: number, tz: number) => {
    if (rawPts.length === 0) {
      rawPts.push({ x: tx, z: tz });
      return;
    }
    let cur = rawPts[rawPts.length - 1];
    let guard = 0;
    while ((cur.x !== tx || cur.z !== tz) && guard < 8) {
      guard += 1;
      const sxStep = Math.sign(tx - cur.x);
      const szStep = Math.sign(tz - cur.z);
      const nx = cur.x + sxStep;
      const nz = cur.z + szStep;
      rawPts.push({ x: nx, z: nz });
      cur = { x: nx, z: nz };
    }
  };

  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const u = 1 - t;
    const bx = Math.round(u * u * sx + 2 * u * t * mx + t * t * ex);
    const bz = Math.round(u * u * sz + 2 * u * t * mz + t * t * ez);
    pushThinStep(bx, bz);
  }

  // Collapse any accidental L-elbow triads (A -> B -> C where max(|A.x-C.x|,|A.z-C.z|) === 1)
  // so diagonal curves stay strictly 1-tile thin with zero 2x2 micro-loops or staircase zigzags
  const cleaned: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < rawPts.length; i++) {
    const p = rawPts[i];
    if (cleaned.length >= 2) {
      const a = cleaned[cleaned.length - 2];
      if (Math.max(Math.abs(p.x - a.x), Math.abs(p.z - a.z)) <= 1) {
        cleaned.pop();
      }
    }
    if (
      cleaned.length === 0 ||
      cleaned[cleaned.length - 1].x !== p.x ||
      cleaned[cleaned.length - 1].z !== p.z
    ) {
      cleaned.push(p);
    }
  }

  const wouldForm2x2RailClump = (x: number, z: number): boolean => {
    const isRail = (tx: number, tz: number) => getTile(state, tx, tz)?.terrain === 'rail_track';
    for (const [ox, oz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      if (isRail(x + ox, z) && isRail(x, z + oz) && isRail(x + ox, z + oz)) {
        return true;
      }
    }
    return false;
  };

  const paved: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < cleaned.length; i++) {
    const pt = cleaned[i];
    const cur = getTile(state, pt.x, pt.z);
    if (cur && cur.terrain === 'rail_track') {
      paved.push(pt);
      continue;
    }
    if (avoidTightLoops && wouldForm2x2RailClump(pt.x, pt.z)) {
      continue;
    }
    if (paveRailTileIfClean(state, pt.x, pt.z)) {
      paved.push(pt);
    }
  }
  return paved;
}

export function paveSettlementRailNetwork(state: SimulationState, settlementId = 'city_default'): void {
  const villageBuildings = state.buildings.filter((b) => (b.settlementId ?? 'city_default') === settlementId);
  if (villageBuildings.length === 0) return;

  const anchor = getSettlementAnchorForId(state, settlementId);
  const variant = getSettlementLayoutVariant(state, settlementId, anchor.x, anchor.z);

  const targetHeight = getSettlementTargetGradeHeight(state, anchor, settlementId);

  // Wide-distance rounded orbital transit loop (radius 11..13, diameter 22..26 tiles — never a tiny tight loop!)
  // Uses long straight tangents with wide 5-tile 45-degree chamfered corner arcs (chamfer = 5) so tracks curve gradually.
  const metroRadius = 11 + (variant % 3); // 11, 12, or 13
  const chamfer = 5;
  const straightHalf = Math.max(3, metroRadius - chamfer);

  const perimeterRing: Array<{ x: number; z: number }> = [];
  const pushRingPt = (rx: number, rz: number) => {
    const t = getTile(state, anchor.x + rx, anchor.z + rz);
    if (!t) return;
    paveRailTileIfClean(state, t.x, t.z, targetHeight);
    perimeterRing.push({ x: t.x, z: t.z });
  };

  // Top tangent (W -> E)
  for (let dx = -straightHalf; dx <= straightHalf; dx++) pushRingPt(dx, -metroRadius);
  // NE wide curve arc
  for (let k = 1; k < chamfer; k++) pushRingPt(straightHalf + k, -metroRadius + k);
  // East tangent (N -> S)
  for (let dz = -straightHalf; dz <= straightHalf; dz++) pushRingPt(metroRadius, dz);
  // SE wide curve arc
  for (let k = 1; k < chamfer; k++) pushRingPt(metroRadius - k, straightHalf + k);
  // Bottom tangent (E -> W)
  for (let dx = straightHalf; dx >= -straightHalf; dx--) pushRingPt(dx, metroRadius);
  // SW wide curve arc
  for (let k = 1; k < chamfer; k++) pushRingPt(-straightHalf - k, metroRadius - k);
  // West tangent (S -> N)
  for (let dz = straightHalf; dz >= -straightHalf; dz--) pushRingPt(-metroRadius, dz);
  // NW wide curve arc
  for (let k = 1; k < chamfer; k++) pushRingPt(-metroRadius + k, -straightHalf - k);

  // Link any rail_station smoothly onto the wide perimeter loop using a sweeping curved lead-in (not a tight box spur)
  for (const b of villageBuildings) {
    if (b.type !== 'rail_station' || perimeterRing.length === 0) continue;
    let bestRingPt = perimeterRing[0];
    let bestDist = Infinity;
    for (const rp of perimeterRing) {
      const d = Math.hypot(rp.x - b.tileX, rp.z - b.tileZ);
      if (d < bestDist) {
        bestDist = d;
        bestRingPt = rp;
      }
    }
    if (bestDist <= 1.6) continue;
    // Quadratic Bezier control point swings gently tangent to the ring so station track curves into the mainline
    const dirX = bestRingPt.x - b.tileX;
    const dirZ = bestRingPt.z - b.tileZ;
    const ctrlX = Math.round((b.tileX + bestRingPt.x) * 0.5 + (Math.abs(dirZ) > Math.abs(dirX) ? Math.sign(dirZ) * 2 : 0));
    const ctrlZ = Math.round((b.tileZ + bestRingPt.z) * 0.5 + (Math.abs(dirX) >= Math.abs(dirZ) ? Math.sign(dirX) * 2 : 0));
    traceSmoothRailSpline(state, b.tileX, b.tileZ, ctrlX, ctrlZ, bestRingPt.x, bestRingPt.z, true);
  }

  // Long-distance sweeping curved Inter-City railway corridors linking settlements across the map
  const allSids = Array.from(new Set(state.buildings.map((b) => b.settlementId ?? 'city_default')));
  if (allSids.length > 1) {
    const others = allSids
      .filter((o) => o !== settlementId)
      .map((o) => {
        const oa = getSettlementAnchorForId(state, o);
        const oVar = getSettlementLayoutVariant(state, o, oa.x, oa.z);
        return { sid: o, anchor: oa, radius: 11 + (oVar % 3), dist: Math.hypot(oa.x - anchor.x, oa.z - anchor.z) };
      })
      .filter((o) => o.dist > 14)
      .sort((a, b) => a.dist - b.dist);

    for (let oi = 0; oi < Math.min(2, others.length); oi++) {
      const other = others[oi];
      // Canonicalize city pair ordering so A->B and B->A always follow the exact same single curved corridor
      const selfInfo = { sid: settlementId, anchor, radius: metroRadius, variant };
      const otherVariant = getSettlementLayoutVariant(state, other.sid, other.anchor.x, other.anchor.z);
      const otherInfo = { sid: other.sid, anchor: other.anchor, radius: other.radius, variant: otherVariant };
      const [cityA, cityB] = selfInfo.sid <= otherInfo.sid ? [selfInfo, otherInfo] : [otherInfo, selfInfo];

      const vx = cityB.anchor.x - cityA.anchor.x;
      const vz = cityB.anchor.z - cityA.anchor.z;
      const len = Math.max(1, Math.hypot(vx, vz));
      const ux = vx / len;
      const uz = vz / len;
      const sx = Math.round(cityA.anchor.x + ux * cityA.radius);
      const sz = Math.round(cityA.anchor.z + uz * cityA.radius);
      const ex = Math.round(cityB.anchor.x - ux * cityB.radius);
      const ez = Math.round(cityB.anchor.z - uz * cityB.radius);

      // Gentle long-distance lateral curve bow (18% perpendicular sweep)
      const curveSign = (cityA.variant & 1) === 0 ? 1 : -1;
      const bow = Math.min(14, Math.max(3, Math.round(len * 0.18))) * curveSign;
      const mx = Math.round((sx + ex) * 0.5 - uz * bow);
      const mz = Math.round((sz + ez) * 0.5 + ux * bow);
      traceSmoothRailSpline(state, sx, sz, mx, mz, ex, ez, true);
    }
  }
}

function canConvertTileToRoad(t: TileData | undefined, allowWater: boolean): t is TileData {
  if (!t || t.buildingId) return false;
  if (t.onFireTimer > 0 || (t.devastatedTimer ?? 0) > 0) return false;
  if (t.height <= 0 && !allowWater) return false;
  if (
    t.terrain === 'crystal_field' ||
    t.terrain === 'rail_track' ||
    t.terrain === 'runway' ||
    t.terrain === 'void_goo'
  ) {
    return false;
  }
  return true;
}

/**
 * Levels the urban terrain plateau, clears obstacles inside street corridors, smooths perimeter slopes,
 * and in Atomic/Information/Orbital+ ages constructs engineered Artificial Islands along nearby coastlines.
 */
function terraformSettlementDistrict(
  state: SimulationState,
  settlementId: string,
  snapLevel = false,
): void {
  const cityEpoch = getSettlementEpoch(state, settlementId);
  if (cityEpoch < 2) return;
  const villageBuildings = state.buildings.filter((b) => (b.settlementId ?? 'city_default') === settlementId);
  if (villageBuildings.length === 0) return;

  const anchor = getSettlementAnchorForId(state, settlementId);
  const variant = getSettlementLayoutVariant(state, settlementId, anchor.x, anchor.z);
  const targetHeight = getSettlementTargetGradeHeight(state, anchor, settlementId);
  const isFloatingSettlement =
    state.worldTemplate === 'scrap_sea' || (getTile(state, anchor.x, anchor.z)?.height ?? 1) === 0;

  // 1. Grade & flatten urban plateau proportional to actual settlement size & tech epoch
  const bldSpan = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(villageBuildings.length) * 1.75)));
  const coreRadius = cityEpoch >= 5 ? Math.max(6, bldSpan) : cityEpoch >= 3 ? Math.max(5, bldSpan - 1) : 4;
  const gradeRadius = coreRadius + 2;

  for (let dz = -gradeRadius; dz <= gradeRadius; dz++) {
    for (let dx = -gradeRadius; dx <= gradeRadius; dx++) {
      const t = getTile(state, anchor.x + dx, anchor.z + dz);
      if (!t || t.height <= 0) continue;
      const dist = Math.hypot(dx, dz);
      const isUrbanTile = Boolean(t.buildingId) || t.terrain === 'stone_road' || t.terrain === 'rail_track';

      if (dist <= coreRadius || isUrbanTile) {
        if (t.height !== targetHeight) {
          if (snapLevel || cityEpoch >= 3 || isUrbanTile) {
            t.height = targetHeight;
          } else {
            t.height += Math.sign(targetHeight - t.height);
          }
        }
        // Clear intrusive boulders / scorched craters inside paved urban cores in Industrial+ ages
        if (cityEpoch >= 3 && (isSettlementRoadTile(dx, dz, variant) || t.terrain === 'stone_road')) {
          if (t.resourceNode === 'stone_outcrop' || t.resourceNode === 'berry_bush') {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          }
        }
        if (cityEpoch >= 3 && t.terrain === 'scorched' && !t.buildingId && t.onFireTimer <= 0) {
          t.terrain = 'grass';
          clearBurntTreeState(t);
        }
      } else if (dist <= gradeRadius) {
        // Gentle stepped apron outside the city plateau so cliffs aren't sheer 3-tier walls
        const diff = t.height - targetHeight;
        if (Math.abs(diff) > 1) {
          t.height -= Math.sign(diff);
        }
      }
    }
  }

  // 2. Atomic/Information/Orbital+ Artificial Island Reclamation along coastal edges
  if (cityEpoch >= 4 && !isFloatingSettlement && villageBuildings.length >= 4) {
    // Check 4 cardinal coastal quadrants at offset 8 from anchor; construct up to 2 engineered 4x4 island blocks + bridge causeway
    const islandDirs: ReadonlyArray<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    let islandsBuilt = 0;
    for (let di = 0; di < islandDirs.length && islandsBuilt < 2; di++) {
      const [ux, uz] = islandDirs[(di + variant) % islandDirs.length];
      const cx = anchor.x + ux * 8;
      const cz = anchor.z + uz * 8;
      const centerTile = getTile(state, cx, cz);
      if (!centerTile) continue;

      // Only reclaim if the target block is predominantly water (coastal bay/harbor)
      let waterTilesInBlock = 0;
      let validTilesInBlock = 0;
      for (let oz = -2; oz <= 2; oz++) {
        for (let ox = -2; ox <= 2; ox++) {
          const bt = getTile(state, cx + ox, cz + oz);
          if (!bt || bt.buildingId) continue;
          validTilesInBlock++;
          if (bt.height === 0) waterTilesInBlock++;
        }
      }
      if (validTilesInBlock < 16 || waterTilesInBlock < 8) continue;

      // Reclaim a crisp chamfered 5x5 Artificial Island platform with central avenue spine & 12 open building lots!
      for (let oz = -2; oz <= 2; oz++) {
        for (let ox = -2; ox <= 2; ox++) {
          if (Math.abs(ox) === 2 && Math.abs(oz) === 2) continue; // Chamfered octagonal engineered island silhouette
          const bt = getTile(state, cx + ox, cz + oz);
          if (!bt || bt.buildingId) continue;
          bt.height = targetHeight;
          bt.isRiver = false;
          bt.isLake = false;
          bt.farmSettlementId = undefined;
          if (bt.resourceNode === 'coral_reef' || bt.resourceNode === 'scrap_flotsam' || bt.resourceNode === 'atlantis_ruin') {
            bt.resourceNode = 'none';
            bt.resourceAmount = 0;
          }
          const isIslandSpine = (ux !== 0 && oz === 0) || (uz !== 0 && ox === 0);
          if (isIslandSpine && bt.terrain !== 'rail_track' && bt.terrain !== 'runway') {
            bt.terrain = 'stone_road';
          } else if (bt.terrain === 'deep_water' || bt.terrain === 'shallow_water') {
            bt.terrain = 'grass';
          }
        }
      }

      // Connect the Artificial Island cleanly back to the city road spine via a straight 1-tile engineered causeway
      for (let step = 1; step <= 6; step++) {
        const bx = anchor.x + ux * step;
        const bz = anchor.z + uz * step;
        const bridgeT = getTile(state, bx, bz);
        if (canConvertTileToRoad(bridgeT, true)) {
          bridgeT.height = targetHeight;
          bridgeT.isRiver = false;
          bridgeT.isLake = false;
          bridgeT.terrain = 'stone_road';
          bridgeT.farmSettlementId = undefined;
        }
      }
      islandsBuilt++;
      if (islandsBuilt === 1) {
        const vName = state.settlementNames?.[settlementId] ?? 'A coastal metropolis';
        addChronicle(
          state,
          `Engineers of ${vName} reclaimed an offshore Artificial Island connected by a coastal causeway!`,
          'build',
        );
      }
    }
  }

  // 3. Prune stranded single-tile water walkway dots (prevents scattered floating speckles in oceans)
  const pruneR = 15;
  for (let dz = -pruneR; dz <= pruneR; dz++) {
    for (let dx = -pruneR; dx <= pruneR; dx++) {
      const t = getTile(state, anchor.x + dx, anchor.z + dz);
      if (!t || t.height !== 0 || t.terrain !== 'stone_road' || t.buildingId) continue;
      let conn = 0;
      for (const [ox, oz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nt = getTile(state, t.x + ox, t.z + oz);
        if (nt && (nt.terrain === 'stone_road' || Boolean(nt.buildingId))) {
          conn++;
        }
      }
      if (conn === 0) {
        t.terrain = 'shallow_water';
      }
    }
  }
}

/**
 * Connects actual buildings in the settlement along clean 1-tile street corridors
 * without pre-paving empty wilderness or turning interior building lots into roads.
 */
function connectSettlementRoads(state: SimulationState, settlementId: string): void {
  const villageBuildings = state.buildings.filter((b) => (b.settlementId ?? 'city_default') === settlementId);
  if (villageBuildings.length === 0) return;

  const cityEpoch = getSettlementEpoch(state, settlementId);
  const anchor = getSettlementAnchorForId(state, settlementId);
  const variant = getSettlementLayoutVariant(state, settlementId, anchor.x, anchor.z);
  const targetHeight = getSettlementTargetGradeHeight(state, anchor, settlementId);
  const anchorTile = getTile(state, anchor.x, anchor.z);
  const isFloatingSettlement = Boolean(anchorTile && anchorTile.height === 0) || state.worldTemplate === 'scrap_sea';

  const paveTile = (t: TileData | undefined): boolean => {
    if (!canConvertTileToRoad(t, isFloatingSettlement)) return false;
    if (t.resourceNode !== 'none') {
      if (cityEpoch >= 2 && (t.resourceNode === 'berry_bush' || t.resourceNode === 'stone_outcrop')) {
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      } else {
        return false;
      }
    }
    if (t.height > 0 && cityEpoch >= 2) {
      t.height = targetHeight;
    }
    t.terrain = 'stone_road';
    t.farmSettlementId = undefined;
    return true;
  };

  // 1. Reclaim any non-masterplan stone_road tiles inside building blocks OR far away from actual buildings
  const cleanRadius = 15;
  for (let dz = -cleanRadius; dz <= cleanRadius; dz++) {
    for (let dx = -cleanRadius; dx <= cleanRadius; dx++) {
      const t = getTile(state, anchor.x + dx, anchor.z + dz);
      if (!t || t.terrain !== 'stone_road' || t.height <= 0 || t.buildingId) continue;
      // Preserve coastal artificial island causeways along the cardinal axes (dx===0 || dz===0) if they border water
      const bordersWater =
        getTile(state, t.x + 1, t.z)?.height === 0 ||
        getTile(state, t.x - 1, t.z)?.height === 0 ||
        getTile(state, t.x, t.z + 1)?.height === 0 ||
        getTile(state, t.x, t.z - 1)?.height === 0;
      if ((dx === 0 || dz === 0) && bordersWater && cityEpoch >= 4) continue;

      let minChebDist = Infinity;
      for (const b of state.buildings) {
        const d = Math.max(Math.abs(t.x - b.tileX), Math.abs(t.z - b.tileZ));
        if (d < minChebDist) minChebDist = d;
      }
      if (!isSettlementRoadTile(dx, dz, variant) || minChebDist > 3) {
        t.terrain = 'grass';
      }
    }
  }

  // 1b. Pave the 1-tile masterplan street corridors within the active built-up radius of the settlement
  let maxBldDist = 3;
  for (const b of villageBuildings) {
    const d = Math.max(Math.abs(b.tileX - anchor.x), Math.abs(b.tileZ - anchor.z));
    if (d > maxBldDist) maxBldDist = d;
  }
  const activeStreetRadius = Math.min(16, Math.max(3, maxBldDist + 1));
  for (let dz = -activeStreetRadius; dz <= activeStreetRadius; dz++) {
    for (let dx = -activeStreetRadius; dx <= activeStreetRadius; dx++) {
      if (!isSettlementRoadTile(dx, dz, variant)) continue;
      const t = getTile(state, anchor.x + dx, anchor.z + dz);
      if (!t || t.buildingId) continue;
      let nearBuilding = Math.max(Math.abs(dx), Math.abs(dz)) <= 2;
      if (!nearBuilding) {
        for (const b of villageBuildings) {
          if (Math.max(Math.abs(t.x - b.tileX), Math.abs(t.z - b.tileZ)) <= 2) {
            nearBuilding = true;
            break;
          }
        }
      }
      if (nearBuilding) {
        paveTile(t);
      }
    }
  }

  // 2. Pave planned 1-tile street frontages in the 3x3 ring around each existing building
  // and trace along the nearest 1-tile street corridor back to the anchor's central cross-spine
  for (const b of villageBuildings) {
    const ownTile = getTile(state, b.tileX, b.tileZ);
    if (ownTile && ownTile.terrain === 'stone_road') {
      ownTile.terrain = ownTile.height === 0 ? 'shallow_water' : 'grass';
    }

    let frontRoadTile: TileData | null = null;
    let bestFrontDist = Infinity;
    for (let oz = -1; oz <= 1; oz++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oz === 0) continue;
        const nx = b.tileX + ox;
        const nz = b.tileZ + oz;
        const relX = nx - anchor.x;
        const relZ = nz - anchor.z;
        if (!isSettlementRoadTile(relX, relZ, variant)) continue;
        const nt = getTile(state, nx, nz);
        if (paveTile(nt) || nt?.terrain === 'stone_road') {
          const cardPenalty = Math.abs(ox) + Math.abs(oz) === 1 ? 0 : 0.75;
          const d = Math.hypot(relX, relZ) + cardPenalty;
          if (d < bestFrontDist && nt) {
            bestFrontDist = d;
            frontRoadTile = nt;
          }
        }
      }
    }

    // If building sits in the center of a 3x3 block (no adjacent planned road), pick 1 cardinal frontage tile
    if (!frontRoadTile) {
      for (const [ox, oz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nt = getTile(state, b.tileX + ox, b.tileZ + oz);
        if (!nt || nt.buildingId) continue;
        const d = Math.hypot(nt.x - anchor.x, nt.z - anchor.z);
        if (d < bestFrontDist && (paveTile(nt) || nt.terrain === 'stone_road')) {
          bestFrontDist = d;
          frontRoadTile = nt;
        }
      }
    }

    // Walk along planned street corridors from frontRoadTile back to the central cross spine (dx === 0 || dz === 0) -> anchor
    if (frontRoadTile) {
      let cx = frontRoadTile.x;
      let cz = frontRoadTile.z;
      for (let step = 0; step < 22; step++) {
        const relX = cx - anchor.x;
        const relZ = cz - anchor.z;
        if (Math.abs(relX) + Math.abs(relZ) <= 1) break;

        const stepOptions: Array<[number, number]> = [];
        if (relX !== 0) stepOptions.push([cx - Math.sign(relX), cz]);
        if (relZ !== 0) stepOptions.push([cx, cz - Math.sign(relZ)]);

        // Prefer stepping along tiles that are designated 1-tile streets (`isSettlementRoadTile`)
        stepOptions.sort((a, bOpt) => {
          const aRoad = isSettlementRoadTile(a[0] - anchor.x, a[1] - anchor.z, variant) ? 0 : 1;
          const bRoad = isSettlementRoadTile(bOpt[0] - anchor.x, bOpt[1] - anchor.z, variant) ? 0 : 1;
          return aRoad - bRoad;
        });

        let moved = false;
        for (const [nx, nz] of stepOptions) {
          const nt = getTile(state, nx, nz);
          if (!nt) continue;
          if (nt.terrain === 'stone_road' || paveTile(nt)) {
            cx = nx;
            cz = nz;
            moved = true;
            break;
          }
          // If blocked by an existing building on the spine, sidestep 1 tile around it
          if (nt.buildingId) {
            for (const [sx, sz] of [
              [cx + (relZ !== 0 ? 1 : 0), cz + (relX !== 0 ? 1 : 0)],
              [cx - (relZ !== 0 ? 1 : 0), cz - (relX !== 0 ? 1 : 0)],
            ]) {
              const st = getTile(state, sx, sz);
              if (st && (st.terrain === 'stone_road' || paveTile(st))) {
                cx = sx;
                cz = sz;
                moved = true;
                break;
              }
            }
            if (moved) break;
          }
        }
        if (!moved) break;
      }
    }
  }

  // Ensure the 4 cardinal plaza approaches around the anchor are linked around the central hearth
  for (const [ox, oz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const) {
    const pt = getTile(state, anchor.x + ox, anchor.z + oz);
    if (pt && !pt.buildingId) {
      paveTile(pt);
    }
  }

  // 3. Stitch any disconnected 4-way road components into a single unified network (preferring masterplan street lines)
  const stitchRadius = 14;
  const findComponents = (): TileData[][] => {
    const roadMap = new Map<string, TileData>();
    for (let dz = -stitchRadius; dz <= stitchRadius; dz++) {
      for (let dx = -stitchRadius; dx <= stitchRadius; dx++) {
        const t = getTile(state, anchor.x + dx, anchor.z + dz);
        if (t && t.terrain === 'stone_road') {
          roadMap.set(`${t.x},${t.z}`, t);
        }
      }
    }
    const seen = new Set<string>();
    const comps: TileData[][] = [];
    for (const [key, startTile] of roadMap.entries()) {
      if (seen.has(key)) continue;
      const comp: TileData[] = [];
      const q: TileData[] = [startTile];
      seen.add(key);
      while (q.length > 0) {
        const cur = q.shift()!;
        comp.push(cur);
        for (const [ox, oz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nk = `${cur.x + ox},${cur.z + oz}`;
          const nt = roadMap.get(nk);
          if (nt && !seen.has(nk)) {
            seen.add(nk);
            q.push(nt);
          }
        }
      }
      comps.push(comp);
    }
    comps.sort((a, b) => {
      const distA = Math.min(...a.map((t) => Math.hypot(t.x - anchor.x, t.z - anchor.z)));
      const distB = Math.min(...b.map((t) => Math.hypot(t.x - anchor.x, t.z - anchor.z)));
      if (Math.abs(distA - distB) > 1.5) return distA - distB;
      return b.length - a.length;
    });
    return comps;
  };

  const comps = findComponents();
  if (comps.length > 1) {
    const mainSet = new Set<string>(comps[0].map((t) => `${t.x},${t.z}`));
    for (let ci = 1; ci < comps.length; ci++) {
      const comp = comps[ci];
      let bestPair: { from: TileData; toX: number; toZ: number; dist: number } | null = null;
      for (const ct of comp) {
        for (const mk of mainSet) {
          const [mx, mz] = mk.split(',').map(Number);
          const d = Math.abs(ct.x - mx) + Math.abs(ct.z - mz);
          if (!bestPair || d < bestPair.dist) {
            bestPair = { from: ct, toX: mx, toZ: mz, dist: d };
          }
        }
      }
      if (bestPair && bestPair.dist <= 8) {
        const q: Array<{ x: number; z: number; path: TileData[] }> = [
          { x: bestPair.from.x, z: bestPair.from.z, path: [] },
        ];
        const visitedBfs = new Set<string>([`${bestPair.from.x},${bestPair.from.z}`]);
        let bridged = false;
        while (q.length > 0) {
          const cur = q.shift()!;
          if (cur.path.length > 8) continue;
          for (const [ox, oz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const nx = cur.x + ox;
            const nz = cur.z + oz;
            const nk = `${nx},${nz}`;
            if (mainSet.has(nk)) {
              for (const pt of cur.path) {
                paveTile(pt);
                mainSet.add(`${pt.x},${pt.z}`);
              }
              for (const ct of comp) mainSet.add(`${ct.x},${ct.z}`);
              bridged = true;
              break;
            }
            if (visitedBfs.has(nk)) continue;
            if (Math.abs(nx - anchor.x) > stitchRadius || Math.abs(nz - anchor.z) > stitchRadius) continue;
            const nt = getTile(state, nx, nz);
            if (!nt) continue;
            const canBridge =
              nt.terrain === 'stone_road' ||
              (canConvertTileToRoad(nt, isFloatingSettlement) &&
                (nt.resourceNode === 'none' ||
                  (cityEpoch >= 2 && (nt.resourceNode === 'berry_bush' || nt.resourceNode === 'stone_outcrop'))));
            if (!canBridge) continue;
            visitedBfs.add(nk);
            q.push({ x: nx, z: nz, path: [...cur.path, nt] });
          }
          if (bridged) break;
        }
      }
    }

    const finalComps = findComponents();
    for (let ci = 1; ci < finalComps.length; ci++) {
      for (const orphan of finalComps[ci]) {
        orphan.terrain = orphan.height === 0 ? 'shallow_water' : 'grass';
      }
    }
  }
}

function paveSettlementStreetsNear(
  state: SimulationState,
  bx: number,
  bz: number,
  settlementId = 'city_default',
): void {
  const ownTile = getTile(state, bx, bz);
  if (ownTile && ownTile.buildingId && ownTile.terrain === 'stone_road') {
    ownTile.terrain = ownTile.height === 0 ? 'shallow_water' : 'grass';
  }
  connectSettlementRoads(state, settlementId);
}

function ensureSettlementDistricts(
  state: SimulationState,
  settlementId: string,
  anchorX: number,
  anchorZ: number,
) {
  if (!state.settlementDistricts) state.settlementDistricts = {};
  const existing = state.settlementDistricts[settlementId];
  if (existing) return existing;

  const dirs: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];

  // 1. Pick best dedicated 7x7 Farmland Territory (most dry gentle land)
  let bestFarmX = Math.max(5, Math.min(state.gridSize - 6, anchorX + 7));
  let bestFarmZ = anchorZ;
  let bestFarmScore = -Infinity;
  let bestFarmHeight = 2;

  for (const [ux, uz] of dirs) {
    const cx = Math.max(5, Math.min(state.gridSize - 6, Math.round(anchorX + ux * 7.5)));
    const cz = Math.max(5, Math.min(state.gridSize - 6, Math.round(anchorZ + uz * 7.5)));
    let score = 0;
    let hSum = 0;
    let hCount = 0;
    for (let oz = -3; oz <= 3; oz++) {
      for (let ox = -3; ox <= 3; ox++) {
        const t = getTile(state, cx + ox, cz + oz);
        if (!t || t.height <= 0 || t.buildingId) continue;
        hSum += t.height;
        hCount++;
        score += t.height <= 3 ? 3 : 1;
        if (t.terrain === 'fertile' || t.terrain === 'grass' || t.terrain === 'floral_plains') score += 2;
      }
    }
    if (score > bestFarmScore) {
      bestFarmScore = score;
      bestFarmX = cx;
      bestFarmZ = cz;
      bestFarmHeight = hCount > 0 ? Math.max(1, Math.min(3, Math.round(hSum / hCount))) : 2;
    }
  }

  // 2. Pick separate dedicated 5x5 Mining / Quarry Territory (favoring rocks, ore, hills, away from farmland)
  let bestQuarryX = Math.max(4, Math.min(state.gridSize - 5, anchorX - 7));
  let bestQuarryZ = anchorZ;
  let bestQuarryScore = -Infinity;
  let bestQuarryHeight = 2;

  for (const [ux, uz] of dirs) {
    const cx = Math.max(4, Math.min(state.gridSize - 5, Math.round(anchorX + ux * 8.0)));
    const cz = Math.max(4, Math.min(state.gridSize - 5, Math.round(anchorZ + uz * 8.0)));
    if (Math.hypot(cx - bestFarmX, cz - bestFarmZ) < 8) continue;
    let score = 0;
    let hSum = 0;
    let hCount = 0;
    for (let oz = -2; oz <= 2; oz++) {
      for (let ox = -2; ox <= 2; ox++) {
        const t = getTile(state, cx + ox, cz + oz);
        if (!t || t.height <= 0 || t.buildingId) continue;
        hSum += t.height;
        hCount++;
        score += 2;
        if (t.resourceNode === 'ore_vein') score += 9;
        else if (t.resourceNode === 'stone_outcrop') score += 7;
        if (t.terrain === 'rock' || t.terrain === 'mountain' || t.terrain === 'badlands' || t.terrain === 'highland') {
          score += 4;
        }
      }
    }
    if (score > bestQuarryScore) {
      bestQuarryScore = score;
      bestQuarryX = cx;
      bestQuarryZ = cz;
      bestQuarryHeight = hCount > 0 ? Math.max(1, Math.min(4, Math.round(hSum / hCount))) : 2;
    }
  }

  const created = {
    farmX: bestFarmX,
    farmZ: bestFarmZ,
    farmHalfSize: 4,
    farmTargetHeight: bestFarmHeight,
    quarryX: bestQuarryX,
    quarryZ: bestQuarryZ,
    quarryHalfSize: 3,
    quarryTargetHeight: bestQuarryHeight,
  };
  state.settlementDistricts[settlementId] = created;
  return created;
}

function findBuildableTileNear(
  state: SimulationState,
  anchorX: number,
  anchorZ: number,
  maxRadius = 18,
  settlementId = 'city_default',
  desiredType?: BuildingType,
): TileData | null {
  const anchorTile = getTile(state, anchorX, anchorZ);
  const isFloatingSettlement = Boolean(anchorTile && anchorTile.height === 0) || state.worldTemplate === 'scrap_sea';
  const preferredHeight = anchorTile && anchorTile.height > 0 ? anchorTile.height : isFloatingSettlement ? 0 : 2;
  const variant = getSettlementLayoutVariant(state, settlementId, anchorX, anchorZ);
  const districts = !isFloatingSettlement
    ? ensureSettlementDistricts(state, settlementId, anchorX, anchorZ)
    : undefined;
  const isFarmBuilding = desiredType === 'granary' || desiredType === 'forager_hut';
  const isQuarryBuilding = desiredType === 'smeltery' || desiredType === 'steam_foundry';
  const villageBuildings = state.buildings.filter(
    (b) => (b.settlementId ?? 'city_default') === settlementId,
  );
  // Allow coastal cities to expand onto floating water platforms if dry land is scarce or in water settlements
  const allowWaterLots = isFloatingSettlement || villageBuildings.length >= 3;

  let bestLot: TileData | null = null;
  let bestScore = Infinity;
  let emergencyFallback: TileData | null = null;

  for (let r = 1; r <= maxRadius; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const t = getTile(state, anchorX + dx, anchorZ + dz);
        if (!t || t.height >= 6 || t.buildingId) continue;
        if (t.onFireTimer > 0 || (t.devastatedTimer ?? 0) > 0) continue;
        if (t.height <= 0 && !allowWaterLots) continue;

        // Protect dedicated Farmland & Quarry territories from random residential buildings
        const inFarmZone = Boolean(
          districts &&
            Math.abs(t.x - districts.farmX) <= districts.farmHalfSize &&
            Math.abs(t.z - districts.farmZ) <= districts.farmHalfSize,
        );
        const inQuarryZone = Boolean(
          districts &&
            Math.abs(t.x - districts.quarryX) <= districts.quarryHalfSize &&
            Math.abs(t.z - districts.quarryZ) <= districts.quarryHalfSize,
        );
        if ((inFarmZone && !isFarmBuilding) || (inQuarryZone && !isQuarryBuilding)) {
          continue;
        }
        // Keep the actual center of the quarry pit open for rock/ore excavation
        if (
          inQuarryZone &&
          isQuarryBuilding &&
          districts &&
          Math.abs(t.x - districts.quarryX) <= 1 &&
          Math.abs(t.z - districts.quarryZ) <= 1
        ) {
          continue;
        }

        if (!emergencyFallback) emergencyFallback = t;

        // Never place buildings on rail tracks, runways, or designated 1-tile masterplan street corridors!
        // (Non-masterplan tiles inside city blocks can be built upon even if previously paved)
        if (
          t.terrain === 'rail_track' ||
          t.terrain === 'runway' ||
          isSettlementRoadTile(dx, dz, variant)
        ) {
          continue;
        }

        // Check cardinal neighbors for street frontage & unblocked access
        const cardinals = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        let touchesStreet = false;
        let openCardinalNeighbors = 0;
        for (const [cx, cz] of cardinals) {
          const nt = getTile(state, t.x + cx, t.z + cz);
          if (!nt || (nt.height <= 0 && !allowWaterLots)) continue;
          if (!nt.buildingId) openCardinalNeighbors += 1;
          if (
            nt.terrain === 'stone_road' ||
            isSettlementRoadTile(dx + cx, dz + cz, variant)
          ) {
            touchesStreet = true;
          }
        }
        // Avoid boxing in a building where all 4 sides would be blocked
        if (openCardinalNeighbors === 0) continue;

        // Check proximity to existing village buildings to form dense, cohesive urban blocks
        let nearCottageCount = 0;
        for (const b of villageBuildings) {
          const bDist = Math.max(Math.abs(b.tileX - t.x), Math.abs(b.tileZ - t.z));
          if (bDist === 1) nearCottageCount += 2;
          else if (bDist === 2) nearCottageCount += 1;
        }

        const dist = Math.hypot(dx, dz);
        let score = dist * 2.5;
        if (districts && isFarmBuilding) {
          score += Math.hypot(t.x - districts.farmX, t.z - districts.farmZ) * 4.5 - 25;
        } else if (districts && isQuarryBuilding) {
          score += Math.hypot(t.x - districts.quarryX, t.z - districts.quarryZ) * 4.5 - 25;
        }
        if (touchesStreet) score -= 20;
        if (nearCottageCount > 0) score -= Math.min(18, nearCottageCount * 5.0);
        if (t.height === preferredHeight) score -= 8;
        else score += Math.abs(t.height - preferredHeight) * 5;
        if (!isFloatingSettlement && t.height === 0) {
          score += t.terrain === 'shallow_water' ? 6 : 14;
        }
        if (t.resourceNode === 'none') score -= 7;
        else score += 9;

        const tieBreaker = (((t.x * 37 + t.z * 19 + variant * 13) & 15) / 16) * 1.4;
        score += tieBreaker;

        if (score < bestScore) {
          bestScore = score;
          bestLot = t;
        }
      }
    }
    if (bestLot && r >= 3 && bestScore < -12) {
      return bestLot;
    }
  }
  return bestLot ?? emergencyFallback;
}

export function advanceKingdomEpoch(
  state: SimulationState,
  kingdomId: string,
  divineLeapOverride = false,
  options?: { freeFromProgress?: boolean; skipAverageSync?: boolean },
): { ok: boolean; reason?: string; newEpoch?: typeof EPOCHS[number] } {
  reconcileKingdomEpochs(state, false);
  const currentEpochIdx = getKingdomEpoch(state, kingdomId);
  if (currentEpochIdx >= EPOCHS.length - 1) {
    state.outcome = 'ascension_victory';
    return { ok: false, reason: 'Already in the Star Age' };
  }

  reconcileAndSyncResources(state);
  const nextEpoch = EPOCHS[currentEpochIdx + 1];
  const free = divineLeapOverride || Boolean(options?.freeFromProgress) || state.sandboxFreeMode;
  const kStock = ensureKingdomResources(state, kingdomId);
  const kStockWithFaith: Resources = { ...kStock, faith: state.resources.faith };

  if (!free && !canAfford(kStockWithFaith, nextEpoch.unlockCost, false)) {
    return { ok: false, reason: `Insufficient resources to enter the ${nextEpoch.name}` };
  }

  if (!free) {
    spendWorldCost(state, nextEpoch.unlockCost, kingdomId);
  }

  const newEpochIdx = currentEpochIdx + 1;
  if (!state.kingdomEpochs) state.kingdomEpochs = {};
  if (!state.kingdomEpochProgress) state.kingdomEpochProgress = {};
  state.kingdomEpochs[kingdomId] = newEpochIdx;
  state.kingdomEpochProgress[kingdomId] = newEpochIdx >= EPOCHS.length - 1 ? 100 : 0;

  const kingdomBlds = state.buildings.filter(
    (b) => b.settlementId && getKingdomId(state, b.settlementId) === kingdomId,
  );

  // Heal this kingdom's structures and kick off their individual progression toward the new epoch
  for (const b of kingdomBlds) {
    b.hp = b.maxHp;
    const bTile = getTile(state, b.tileX, b.tileZ);
    if (bTile && bTile.terrain === 'stone_road') {
      bTile.terrain = 'grass';
    }
    if (b.epochLevel < newEpochIdx) {
      b.upgradeProgress = Math.max(b.upgradeProgress ?? 0, divineLeapOverride ? 35 : 18);
    }
  }

  const settlementIds = Array.from(new Set(kingdomBlds.map((b) => b.settlementId ?? 'city_default')));
  let anchor = getKingdomAnchor(state, kingdomId) ?? getSettlementAnchor(state);

  if (settlementIds.length > 0) {
    for (const sid of settlementIds) {
      terraformSettlementDistrict(state, sid, true);
      connectSettlementRoads(state, sid);
      if (newEpochIdx >= 3) {
        paveSettlementRailNetwork(state, sid);
      }
    }

    const primarySid = settlementIds[0];
    const primaryAnchor = getSettlementAnchorForId(state, primarySid);
    anchor = primaryAnchor;

    // Erect the signature landmark of the newly reached age on an unblocked lot (skip landmark spam during fast diffusion catch-up if already built)
    const epochBuildings = BUILDINGS.filter((b) => b.epoch === nextEpoch.id);
    if (epochBuildings.length > 0) {
      const bDef = epochBuildings[0];
      const alreadyHasLandmark = kingdomBlds.some((b) => b.type === bDef.type);
      if (!alreadyHasLandmark || divineLeapOverride) {
        const padTile = findBuildableTileNear(state, primaryAnchor.x, primaryAnchor.z, 15, primarySid);
        if (padTile) {
          if (padTile.terrain === 'stone_road' || padTile.terrain === 'rail_track') padTile.terrain = 'grass';
          padTile.resourceNode = 'none';
          padTile.resourceAmount = 0;
          const primarySpecies: SpeciesId = state.settlementSpecies?.[primarySid] ?? 'human';
          const newBld: BuildingEntity = {
            id: nextEntityId('bld'),
            type: bDef.type,
            settlementId: primarySid,
            species: primarySpecies,
            tileX: padTile.x,
            tileZ: padTile.z,
            hp: bDef.maxHp,
            maxHp: bDef.maxHp,
            constructionProgress: divineLeapOverride ? 100 : 25,
            epochLevel: newEpochIdx,
            blessedTimer: 15,
            cursedTimer: 0,
            shieldTimer: 0,
          };
          padTile.buildingId = newBld.id;
          state.buildings.push(newBld);
          state.totalStructuresBuilt += 1;
          paveSettlementStreetsNear(state, padTile.x, padTile.z, primarySid);
          if (newEpochIdx >= 3) {
            paveSettlementRailNetwork(state, primarySid);
          }
        }
      }
    }

    const bonusRole: UnitRole =
      newEpochIdx >= 6 ? 'astro_engineer' : newEpochIdx >= 2 ? 'scholar' : 'builder';
    spawnUnit(state, bonusRole, primaryAnchor.x, primaryAnchor.z, true, primarySid);
  }

  const centerTile = getTile(state, Math.round(anchor.x), Math.round(anchor.z));
  state.pendingVfx.push({
    id: nextEntityId('vfx'),
    type: 'epoch_up',
    x: anchor.x,
    y: (centerTile?.height ?? 3) * 0.45,
    z: anchor.z,
    radius: 6.5,
    color: nextEpoch.accentColor,
    createdAt: Date.now(),
  });
  state.pendingVfx.push({
    id: nextEntityId('vfx'),
    type: 'festival_lanterns',
    x: anchor.x,
    y: (centerTile?.height ?? 3) * 0.45 + 0.3,
    z: anchor.z,
    radius: 5.0,
    color: nextEpoch.accentColor,
    createdAt: Date.now(),
  });

  const realmName = state.settlementNames?.[settlementIds[0] ?? kingdomId] ?? 'A civilization';
  addChronicle(
    state,
    `${realmName} has ascended to the ${nextEpoch.name} (${formatYearLabel(state.year)})!`,
    'epoch',
    { x: anchor.x, z: anchor.z },
  );

  if (!options?.skipAverageSync) {
    syncAverageEpochFromKingdoms(state);
    syncStateResourcesFromKingdoms(state);
    recalculateRatesAndCaps(state);
  }
  return { ok: true, newEpoch: nextEpoch };
}

export function advanceEpoch(
  state: SimulationState,
  divineLeapOverride = false,
  targetKingdomId?: string,
): { ok: boolean; reason?: string; newEpoch?: typeof EPOCHS[number] } {
  reconcileKingdomEpochs(state, false);
  if (targetKingdomId) {
    return advanceKingdomEpoch(state, targetKingdomId, divineLeapOverride);
  }

  const liveKids = getLiveKingdomIds(state);
  if (liveKids.length === 0) {
    if (state.epochIndex >= EPOCHS.length - 1) {
      state.outcome = 'ascension_victory';
      return { ok: false, reason: 'Already in the Interstellar Age' };
    }
    reconcileAndSyncResources(state);
    const nextEpoch = EPOCHS[state.epochIndex + 1];
    const free = divineLeapOverride || state.sandboxFreeMode;
    if (!free && !canAfford(state.resources, nextEpoch.unlockCost, false)) {
      return { ok: false, reason: `Insufficient resources to enter the ${nextEpoch.name}` };
    }
    if (!free) {
      spendWorldCost(state, nextEpoch.unlockCost);
    }
    state.epochIndex += 1;
    state.averageEpochIndex = state.epochIndex;
    state.epochProgress = 0;
    lastSyncedEpochMap.set(state, state.epochIndex);
    explicitEpochOverrideMap.set(state, state.epochIndex);
    addChronicle(
      state,
      `Civilization has ascended to the ${nextEpoch.name} (${formatYearLabel(state.year)})!`,
      'epoch',
    );
    syncStateResourcesFromKingdoms(state);
    recalculateRatesAndCaps(state);
    return { ok: true, newEpoch: nextEpoch };
  }

  let advancedAny = false;
  let lastEpochDef: typeof EPOCHS[number] | undefined;
  let lastReason: string | undefined;
  for (const kid of liveKids) {
    const res = advanceKingdomEpoch(state, kid, divineLeapOverride, { skipAverageSync: true });
    if (res.ok) {
      advancedAny = true;
      lastEpochDef = res.newEpoch;
    } else if (res.reason) {
      lastReason = res.reason;
    }
  }

  syncAverageEpochFromKingdoms(state);
  syncStateResourcesFromKingdoms(state);
  recalculateRatesAndCaps(state);

  if (!advancedAny) {
    return { ok: false, reason: lastReason ?? 'Already in the Interstellar Age' };
  }
  return { ok: true, newEpoch: lastEpochDef ?? EPOCHS[state.epochIndex] };
}

export function spawnRaiderWave(state: SimulationState): void {
  const anchor = getSettlementAnchor(state);
  const ringDist = Math.min(Math.floor(state.gridSize * 0.35), 18);
  const archetypes: UnitRole[] = ['raider_swarmer', 'raider_ranged', 'raider_behemoth'];

  let spawnedCount = 0;
  for (let i = 0; i < 3; i++) {
    const role = archetypes[i % archetypes.length];
    const rx = Math.max(2, Math.min(state.gridSize - 3, i % 2 === 0 ? anchor.x - ringDist : anchor.x + ringDist));
    const rz = Math.max(2, Math.min(state.gridSize - 3, anchor.z + (i - 1) * 4));
    const tile = getTile(state, rx, rz);
    if (tile && tile.height === 0) {
      tile.height = 1;
      tile.terrain = 'sand';
    }
    const res = spawnUnit(state, role, rx, rz, true);
    if (res.ok) spawnedCount += 1;
  }

  if (spawnedCount > 0) {
    addChronicle(
      state,
      'Hostile Raiders spotted on the frontier! Use Guardians or Celestial Smite to defend your people.',
      'warning',
    );
  }
}

function recordHarvestDeposit(
  state: SimulationState,
  key: keyof Resources,
  amount: number,
  kingdomId?: string,
): void {
  if (amount <= 0) return;
  if (kingdomId && key !== 'faith') {
    ensureKingdomResources(state, kingdomId)[key] += amount;
  } else if (key !== 'faith') {
    const kids = getLiveKingdomIds(state);
    if (kids.length > 0) {
      ensureKingdomResources(state, kids[0])[key] += amount;
    } else {
      if (!state.unallocatedResources) state.unallocatedResources = emptyResources();
      state.unallocatedResources[key] += amount;
    }
  } else {
    if (!state.unallocatedResources) state.unallocatedResources = emptyResources();
    state.unallocatedResources[key] += amount;
  }
  syncStateResourcesFromKingdoms(state);
  if (!state.harvestAccumulator) state.harvestAccumulator = emptyResources();
  state.harvestAccumulator[key] += amount;
}

function pickDesiredAutobuildType(
  state: SimulationState,
  villageBuildings: BuildingEntity[],
  villagePop: number,
  species: SpeciesId = 'human',
  kRes?: Resources,
  cityEpoch = 0,
): BuildingType | null {
  const maxCityBuildings = getMaxCityBuildings(cityEpoch);
  if (villageBuildings.length >= maxCityBuildings) return null;

  const countType = (t: BuildingType) => villageBuildings.filter((b) => b.type === t).length;
  const targetCottages = Math.min(38, Math.max(12 + cityEpoch * 4, Math.ceil(villagePop * 1.65)));
  const candidates: BuildingType[] = [];
  const want = (t: BuildingType) => {
    if (!candidates.includes(t)) candidates.push(t);
  };

  if (countType('bonfire') === 0) want('bonfire');
  if (countType('forager_hut') < Math.min(8, targetCottages)) want('forager_hut');
  if (countType('shaman_totem') < 2) want('shaman_totem');

  if (species === 'elf' && countType('shaman_totem') < 3) want('shaman_totem');

  if (cityEpoch === 0) {
    if (countType('forager_hut') < Math.min(14, targetCottages)) want('forager_hut');
    if (countType('shaman_totem') < (species === 'elf' ? 4 : 3)) want('shaman_totem');
  } else if (species === 'orc') {
    if (countType('forager_hut') < Math.min(16, targetCottages)) want('forager_hut');
    if (countType('granary') < 4) want('granary');
    if (countType('smeltery') < 4) want('smeltery');
    if (cityEpoch >= 2 && countType('guildhall') < 4) want('guildhall');
    if (cityEpoch >= 2 && countType('observatory') < 2 && villageBuildings.length >= 8) want('observatory');
    if (cityEpoch >= 3 && countType('steam_foundry') < 4) want('steam_foundry');
    if (cityEpoch >= 3 && countType('rail_station') < 2 && villageBuildings.length >= 10) want('rail_station');
    if (cityEpoch >= 4 && countType('fission_reactor') < 3 && villageBuildings.length >= 12) want('fission_reactor');
    if (cityEpoch >= 5 && countType('cyber_institute') < 3 && villageBuildings.length >= 14) want('cyber_institute');
    if (cityEpoch >= 6 && countType('launch_arcology') < 3 && villageBuildings.length >= 16) want('launch_arcology');
    if (countType('forager_hut') < targetCottages) want('forager_hut');
  } else {
    if (cityEpoch >= 1) {
      if (countType('forager_hut') < Math.min(12, targetCottages)) want('forager_hut');
      if (countType('granary') < 3) want('granary');
      if (species === 'elf' && countType('ziggurat') < 3) want('ziggurat');
      if (species === 'human' && countType('smeltery') < 3) want('smeltery');
      if (countType('ziggurat') < 2) want('ziggurat');
      if (countType('forager_hut') < Math.min(16, targetCottages)) want('forager_hut');
      if (countType('smeltery') < (species === 'elf' ? 3 : 4)) want('smeltery');
      if (countType('granary') < 4) want('granary');
      if (countType('shaman_totem') < (species === 'elf' ? 4 : 3)) want('shaman_totem');
    }
    if (cityEpoch >= 2) {
      if (countType('guildhall') < 4) want('guildhall');
      if (countType('forager_hut') < Math.min(20, targetCottages)) want('forager_hut');
      if (species === 'elf' && countType('observatory') < 3) want('observatory');
      if (countType('observatory') < (species === 'human' || species === 'elf' ? 3 : 2)) want('observatory');
      if (countType('guildhall') < 5) want('guildhall');
    }
    if (cityEpoch >= 3) {
      if (countType('forager_hut') < Math.min(24, targetCottages)) want('forager_hut');
      if (countType('rail_station') < 2) want('rail_station');
      if (species === 'human' && countType('dynamo_plant') < 3) want('dynamo_plant');
      if (countType('steam_foundry') < (species === 'elf' ? 3 : 4)) want('steam_foundry');
      if (countType('dynamo_plant') < 4) want('dynamo_plant');
      if (countType('guildhall') < 6) want('guildhall');
    }
    if (cityEpoch >= 4) {
      if (countType('forager_hut') < Math.min(28, targetCottages)) want('forager_hut');
      if (countType('airport') < 2) want('airport');
      if (species === 'elf' && countType('cyber_institute') < 4) want('cyber_institute');
      if (countType('fission_reactor') < 4) want('fission_reactor');
      if (countType('cyber_institute') < 4) want('cyber_institute');
      if (countType('guildhall') < 8) want('guildhall');
    }
    if (cityEpoch >= 5) {
      if (countType('forager_hut') < Math.min(33, targetCottages)) want('forager_hut');
      if (countType('rail_station') < 3) want('rail_station');
      if (countType('cyber_institute') < 5) want('cyber_institute');
      if (countType('guildhall') < 10) want('guildhall');
    }
    if (cityEpoch >= 6) {
      if (countType('launch_arcology') < 4) want('launch_arcology');
      if (countType('forager_hut') < targetCottages) want('forager_hut');
    }
    if (cityEpoch >= 7) {
      if (countType('dyson_spire') < 2) want('dyson_spire');
    }
    if (countType('forager_hut') < targetCottages) want('forager_hut');
  }

  if (candidates.length === 0) return null;
  if (kRes && !state.sandboxFreeMode) {
    for (const cType of candidates) {
      const def = BUILDINGS.find((b) => b.type === cType);
      if (def && canAfford(kRes, def.cost, false)) {
        return cType;
      }
    }
  }
  return candidates[0];
}

export function ensureSettlementKings(state: SimulationState): void {
  if (!state.settlementKingdoms) state.settlementKingdoms = {};

  const activeKingdoms = new Set<string>();
  for (const b of state.buildings) {
    if (b.settlementId) {
      activeKingdoms.add(getKingdomId(state, b.settlementId));
    }
  }

  for (const u of state.units) {
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) {
      u.isKing = false;
      continue;
    }
    if (u.settlementId) {
      const kid = getKingdomId(state, u.settlementId);
      u.kingdomId = kid;
      activeKingdoms.add(kid);
    } else if (u.kingdomId) {
      activeKingdoms.add(u.kingdomId);
    }
  }

  const demoteExtraKing = (u: UnitEntity) => {
    u.isKing = false;
    if (u.name.startsWith('King ')) {
      u.name = u.name.slice(5);
    }
  };

  const crownGroupMonarch = (members: UnitEntity[], kid?: string) => {
    if (members.length === 0) return;
    const currentKings = members.filter((u) => u.isKing);
    if (currentKings.length === 1) return;
    if (currentKings.length > 1) {
      // Keep the highest-scoring / established monarch and demote any duplicates from branched zones
      currentKings.sort((a, b) => {
        const aScore = (a.role === 'warrior' ? 50 : 0) + a.maxHp + (a.kills ?? 0) * 15;
        const bScore = (b.role === 'warrior' ? 50 : 0) + b.maxHp + (b.kills ?? 0) * 15;
        return bScore - aScore;
      });
      for (let i = 1; i < currentKings.length; i++) {
        demoteExtraKing(currentKings[i]);
      }
      return;
    }

    // Crown the strongest adult (or citizen) across the entire kingdom (all its branched-out zones)
    const adults = members.filter((u) => u.ageStage !== 'child');
    const pool = adults.length > 0 ? adults : members;
    pool.sort((a, b) => {
      const aScore = (a.role === 'warrior' ? 50 : 0) + a.maxHp + (a.kills ?? 0) * 15;
      const bScore = (b.role === 'warrior' ? 50 : 0) + b.maxHp + (b.kills ?? 0) * 15;
      return bScore - aScore;
    });
    const monarch = pool[0];
    if (monarch) {
      monarch.isKing = true;
      monarch.ageStage = 'adult';
      if (!monarch.name.startsWith('King ')) {
        monarch.name = `King ${monarch.name}`;
      }
      const royalHp =
        monarch.species === 'orc'
          ? 260
          : monarch.species === 'dwarf'
            ? 245
            : monarch.species === 'lizardfolk'
              ? 215
              : monarch.species === 'elf'
                ? 190
                : 175;
      if (monarch.maxHp < royalHp) {
        monarch.maxHp = royalHp;
        monarch.hp = royalHp;
      }
      const realmName =
        (monarch.settlementId ? state.settlementNames?.[monarch.settlementId] : undefined) ??
        (kid ? state.settlementNames?.[kid] : undefined) ??
        'the realm';
      addChronicle(state, `${monarch.name} has been crowned monarch of ${realmName}!`, 'divine');
    }
  };

  for (const kid of activeKingdoms) {
    const members = state.units.filter(
      (u) =>
        u.faction === 'civilization' &&
        u.state !== 'ko' &&
        u.hp > 0 &&
        (u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId) === kid,
    );
    crownGroupMonarch(members, kid);
  }

  // Also ensure unattached pioneer bands on unclaimed land (grouped locally within 16 tiles) have 1 King per band
  for (const sp of ['human', 'elf', 'orc'] as SpeciesId[]) {
    const unattached = state.units.filter(
      (u) =>
        u.faction === 'civilization' &&
        u.state !== 'ko' &&
        u.hp > 0 &&
        u.species === sp &&
        !u.settlementId &&
        !u.kingdomId &&
        u.expeditionTargetX === undefined &&
        !state.buildings.some(
          (b) =>
            (b.species ?? (b.settlementId ? state.settlementSpecies?.[b.settlementId] : undefined) ?? 'human') !== sp &&
            Math.hypot(b.tileX - u.x, b.tileZ - u.z) <= 14,
        ),
    );
    const bands: UnitEntity[][] = [];
    for (const p of unattached) {
      let placedBand = false;
      for (const band of bands) {
        if (Math.hypot(band[0].x - p.x, band[0].z - p.z) <= SETTLEMENT_AWARENESS_RADIUS + 4) {
          band.push(p);
          placedBand = true;
          break;
        }
      }
      if (!placedBand) bands.push([p]);
    }
    for (const band of bands) {
      crownGroupMonarch(band);
    }
  }
}

function transformSettlementEnvironment(
  state: SimulationState,
  anchor: { x: number; z: number },
  villageBuildings: BuildingEntity[],
): void {
  if (villageBuildings.length === 0) return;

  const sampleBld =
    villageBuildings[Math.floor(Math.abs(state.year * 10) + villageBuildings.length * 7) % villageBuildings.length];
  if (!sampleBld || sampleBld.constructionProgress < 100) return;

  const sid = sampleBld.settlementId ?? 'city_default';
  const ownTile = getTile(state, sampleBld.tileX, sampleBld.tileZ);
  if (ownTile && (ownTile.terrain === 'stone_road' || ownTile.terrain === 'rail_track' || ownTile.terrain === 'runway')) {
    ownTile.terrain = 'grass';
  }

  // 1. Era-driven terrain flattening, artificial islands, connected streets & rail/runway transformation
  // Paused during post-destruction crisis so bombed/raided cities stay visibly scarred instead of instantly repaving!
  const pKid = getKingdomId(state, sid);
  const cityEpoch = getKingdomEpoch(state, pKid);
  const pStock = ensureKingdomResources(state, pKid);
  const isRecoveringFromDestruction = (state.settlementRebuildCooldowns?.[sid] ?? 0) > 0;
  if (!isRecoveringFromDestruction) {
    terraformSettlementDistrict(state, sid, false);
    if (cityEpoch >= 1 && (state.sandboxFreeMode || pStock.stone >= 8)) {
      if (!state.sandboxFreeMode) pStock.stone = Math.max(0, pStock.stone - 4);
      connectSettlementRoads(state, sid);
      paveSettlementStreetsNear(state, sampleBld.tileX, sampleBld.tileZ, sid);
      syncStateResourcesFromKingdoms(state);
    }
    if (cityEpoch >= 3 && (sampleBld.type === 'rail_station' || villageBuildings.length >= 6)) {
      paveSettlementRailNetwork(state, sid);
    }
    for (const b of villageBuildings) {
      if (b.type === 'airport' && b.constructionProgress >= 100) {
        paveAirportRunwayForBuilding(state, b.tileX, b.tileZ);
      }
    }
  }

  const offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, -1],
  ];
  const pickOff = offsets[Math.floor(Math.abs(state.year * 30) + sampleBld.tileX) % offsets.length];
  const adj = getTile(state, sampleBld.tileX + pickOff[0], sampleBld.tileZ + pickOff[1]);
  if (adj && adj.height > 0 && !adj.buildingId) {
    if (
      sampleBld.epochLevel >= 6 &&
      (sampleBld.type === 'launch_arcology' || sampleBld.type === 'dyson_spire') &&
      (adj.x + adj.z) % 4 === 0 &&
      adj.terrain !== 'stone_road' &&
      adj.terrain !== 'rail_track' &&
      adj.terrain !== 'runway'
    ) {
      adj.terrain = 'crystal_field';
      if (adj.resourceNode === 'none') {
        adj.resourceNode = 'crystal_monolith';
        adj.resourceAmount = 320;
      }
    }
  }

  // 2. Agricultural / hydroponic cultivation near food & civic hubs (strictly capped at 200% of parent city size)
  const maxFarmFields = getMaxCityFarmFields(villageBuildings.length);
  const ownedFarms: TileData[] = [];
  const scanR = SETTLEMENT_AWARENESS_RADIUS + 4;
  const minFX = Math.max(1, anchor.x - scanR);
  const maxFX = Math.min(state.gridSize - 2, anchor.x + scanR);
  const minFZ = Math.max(1, anchor.z - scanR);
  const maxFZ = Math.min(state.gridSize - 2, anchor.z + scanR);

  for (let fz = minFZ; fz <= maxFZ; fz++) {
    for (let fx = minFX; fx <= maxFX; fx++) {
      const ft = state.tiles[fz * state.gridSize + fx];
      if (!ft || ft.farmSettlementId !== sid) continue;
      if (ft.farmPlotKind === 'timber_plantation' || ft.farmPlotKind === 'quarry') continue;
      if (ft.buildingId || ft.height <= 0 || ft.terrain !== 'fertile') {
        ft.farmSettlementId = undefined;
        ft.farmPlotKind = undefined;
        continue;
      }
      ownedFarms.push(ft);
    }
  }

  // If the parent city shrank from raiders/disasters, reclaim outer surplus fields back to wild grassland
  if (ownedFarms.length > maxFarmFields) {
    ownedFarms.sort(
      (a, b) =>
        (b.x - anchor.x) ** 2 + (b.z - anchor.z) ** 2 - ((a.x - anchor.x) ** 2 + (a.z - anchor.z) ** 2),
    );
    const excess = ownedFarms.length - maxFarmFields;
    for (let i = 0; i < excess; i++) {
      const ex = ownedFarms[i];
      ex.farmSettlementId = undefined;
      ex.farmPlotKind = undefined;
      ex.terrain = 'grass';
      if (ex.resourceNode === 'berry_bush') {
        ex.resourceNode = 'none';
        ex.resourceAmount = 0;
      }
    }
  } else {
    // Replant crops on an already-owned fallow farm plot without expanding farmland footprint
    const fallowPlot = ownedFarms.find((f) => f.resourceNode === 'none');
    if (fallowPlot) {
      fallowPlot.resourceNode = 'berry_bush';
      fallowPlot.resourceAmount = 210;
    } else if (
      ownedFarms.length < maxFarmFields &&
      (sampleBld.type === 'forager_hut' ||
        sampleBld.type === 'granary' ||
        sampleBld.type === 'guildhall' ||
        sampleBld.type === 'launch_arcology' ||
        sampleBld.type === 'bonfire')
    ) {
      // Dedicated Farmland Territory: actively clear trees, rocks & uneven ground, then plant tidy square wheat plots
      const districts = ensureSettlementDistricts(state, sid, anchor.x, anchor.z);
      const farmKid = getKingdomId(state, sid);
      let workedFarmTiles = 0;
      for (
        let oz = -districts.farmHalfSize;
        oz <= districts.farmHalfSize && workedFarmTiles < 4 && ownedFarms.length + workedFarmTiles < maxFarmFields;
        oz++
      ) {
        for (
          let ox = -districts.farmHalfSize;
          ox <= districts.farmHalfSize && workedFarmTiles < 4 && ownedFarms.length + workedFarmTiles < maxFarmFields;
          ox++
        ) {
          // Keep a clean 1-tile central cross-lane between the 4 square crop fields
          if (ox === 0 || oz === 0) continue;
          const ft = getTile(state, districts.farmX + ox, districts.farmZ + oz);
          if (!ft || ft.height <= 0 || ft.buildingId) continue;
          if (ft.farmSettlementId === sid && ft.farmPlotKind === 'wheat' && ft.height === districts.farmTargetHeight) {
            continue;
          }
          // 1. Actively clear trees & rocks on the farmland lot (salvaging wood & stone!)
          if (ft.resourceNode === 'timber_grove') {
            ft.resourceNode = 'none';
            ft.resourceAmount = 0;
            delete ft.treeBiomeOverride;
            grantResourcesToKingdomOrPool(state, { wood: 18 }, farmKid);
          } else if (ft.resourceNode === 'stone_outcrop' || ft.resourceNode === 'ore_vein') {
            const wasOre = ft.resourceNode === 'ore_vein';
            ft.resourceNode = 'none';
            ft.resourceAmount = 0;
            grantResourcesToKingdomOrPool(state, wasOre ? { ore: 12, stone: 8 } : { stone: 16 }, farmKid);
          }
          // 2. Actively level uneven terrain toward the farmland district's flat elevation
          if (ft.height !== districts.farmTargetHeight) {
            ft.height += ft.height < districts.farmTargetHeight ? 1 : -1;
            ft.terrain = 'grass';
            workedFarmTiles++;
            continue;
          }
          // 3. Cultivate flat cleared tile into dedicated square farmland with diverse crops & growth stages
          if (ft.terrain !== 'stone_road' && ft.terrain !== 'rail_track' && ft.terrain !== 'runway') {
            const farmSpecies = state.settlementSpecies?.[sid] ?? 'human';
            ft.terrain = 'fertile';
            ft.resourceNode = 'berry_bush';
            ft.resourceAmount = 160;
            ft.farmSettlementId = sid;
            ft.farmPlotKind = 'wheat';
            ft.cropType = pickCropTypeForFarmQuadrant(farmSpecies, ox, oz);
            const initGrowth = (Math.abs(ox * 17 + oz * 31) % 30);
            ft.cropGrowth = initGrowth;
            ft.cropStage = initGrowth >= 25 ? 1 : 0;
            workedFarmTiles++;
          }
        }
      }
    }
  }

  // 2.4 Dedicated Mining / Quarry Territory: actively clear trees/bushes, terrace quarry floor & expose rock/ore faces
  {
    const districts = ensureSettlementDistricts(state, sid, anchor.x, anchor.z);
    const quarryKid = getKingdomId(state, sid);
    let workedQuarryTiles = 0;
    for (let oz = -districts.quarryHalfSize; oz <= districts.quarryHalfSize && workedQuarryTiles < 3; oz++) {
      for (let ox = -districts.quarryHalfSize; ox <= districts.quarryHalfSize && workedQuarryTiles < 3; ox++) {
        const qt = getTile(state, districts.quarryX + ox, districts.quarryZ + oz);
        if (!qt || qt.height <= 0 || qt.buildingId) continue;
        const isPitCore = Math.abs(ox) <= 1 && Math.abs(oz) <= 1;
        const targetQH = Math.max(1, districts.quarryTargetHeight - (isPitCore ? 1 : 0));
        if (qt.farmSettlementId === sid && qt.farmPlotKind === 'quarry' && qt.height === targetQH) continue;

        // Actively clear surface trees & bushes from the quarry site
        if (qt.resourceNode === 'timber_grove' || qt.resourceNode === 'berry_bush') {
          const wasTree = qt.resourceNode === 'timber_grove';
          qt.resourceNode = 'none';
          qt.resourceAmount = 0;
          delete qt.treeBiomeOverride;
          if (wasTree) grantResourcesToKingdomOrPool(state, { wood: 14 }, quarryKid);
        }
        // Step/level the quarry pit floor
        if (qt.height !== targetQH) {
          qt.height += qt.height < targetQH ? 1 : -1;
        }
        qt.terrain = isPitCore ? 'rock' : 'badlands';
        qt.farmSettlementId = sid;
        qt.farmPlotKind = 'quarry';
        if (qt.resourceNode === 'none' && ((ox + oz) & 1) === 0) {
          qt.resourceNode = isPitCore ? 'ore_vein' : 'stone_outcrop';
          qt.resourceAmount = 320;
        }
        workedQuarryTiles++;
      }
    }
  }

  // 2.5 Industrial Era+ Managed Square Tree Plantations (neat 3x3 organized forestry blocks on city outskirts)
  const plantationEpoch = getKingdomEpoch(state, getKingdomId(state, sid));
  if (plantationEpoch >= 3) {
    const plantationCenters: ReadonlyArray<readonly [number, number]> = [
      [8, -5],
      [-8, 5],
      [5, 8],
      [-5, -8],
    ];
    let replantedTrees = 0;
    for (const [px, pz] of plantationCenters) {
      if (replantedTrees >= 2) break;
      const baseX = anchor.x + px;
      const baseZ = anchor.z + pz;
      for (let oz = -1; oz <= 1 && replantedTrees < 2; oz++) {
        for (let ox = -1; ox <= 1 && replantedTrees < 2; ox++) {
          const pt = getTile(state, baseX + ox, baseZ + oz);
          if (
            pt &&
            pt.height > 0 &&
            pt.height <= 4 &&
            !pt.buildingId &&
            pt.resourceNode === 'none' &&
            (pt.terrain === 'grass' || pt.terrain === 'forest' || pt.terrain === 'fertile' || pt.terrain === 'savanna')
          ) {
            pt.terrain = 'forest';
            pt.resourceNode = 'timber_grove';
            pt.resourceAmount = 260;
            pt.farmSettlementId = sid;
            pt.farmPlotKind = 'timber_plantation';
            replantedTrees++;
          }
        }
      }
    }
  }

  // 3. Natural woodland regrowth outside this settlement's urban core
  const rx = Math.max(2, Math.min(state.gridSize - 3, anchor.x + Math.floor(Math.random() * 44) - 22));
  const rz = Math.max(2, Math.min(state.gridSize - 3, anchor.z + Math.floor(Math.random() * 44) - 22));
  const wt = getTile(state, rx, rz);
  if (
    wt &&
    wt.height > 0 &&
    !wt.buildingId &&
    wt.resourceNode === 'none' &&
    (wt.terrain === 'forest' || wt.terrain === 'jungle' || wt.terrain === 'taiga' || wt.terrain === 'blossom') &&
    Math.hypot(rx - anchor.x, rz - anchor.z) > 8
  ) {
    wt.resourceNode = 'timber_grove';
    wt.resourceAmount = 220;
  }
}

function findNewCitySite(
  state: SimulationState,
  fromX: number,
  fromZ: number,
): TileData | null {
  const gs = state.gridSize;
  const margin = 8;
  const minCitySepSq = 26 * 26;
  const activeExpeditions = state.units.filter((u) => u.expeditionTargetX !== undefined && u.expeditionTargetZ !== undefined);
  const isOceanWorld = state.worldTemplate === 'scrap_sea';

  let bestLandTile: TileData | null = null;
  let bestLandScore = -Infinity;
  let bestWaterTile: TileData | null = null;
  let bestWaterScore = -Infinity;

  // Coarse step-2 search across the world for fertile uninhabited valleys OR floating lagoon sites 26..64 tiles away
  for (let z = margin; z < gs - margin; z += 2) {
    for (let x = margin; x < gs - margin; x += 2) {
      const t = getTile(state, x, z);
      if (!t || t.height > 4 || t.buildingId || t.onFireTimer > 0) continue;
      if (t.height <= 0 && !isOceanWorld && t.terrain !== 'shallow_water') continue;
      if (
        t.height > 0 &&
        t.terrain !== 'grass' &&
        t.terrain !== 'fertile' &&
        t.terrain !== 'savanna' &&
        t.terrain !== 'forest' &&
        t.terrain !== 'jungle' &&
        t.terrain !== 'blossom' &&
        t.terrain !== 'sand'
      ) {
        continue;
      }

      const distFromOrigin = Math.hypot(x - fromX, z - fromZ);
      if (distFromOrigin < 26 || distFromOrigin > 64) continue;

      let tooClose = false;
      for (const b of state.buildings) {
        const dSq = (b.tileX - x) ** 2 + (b.tileZ - z) ** 2;
        if (dSq < minCitySepSq) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      for (const ex of activeExpeditions) {
        const dSq = ((ex.expeditionTargetX ?? 0) - x) ** 2 + ((ex.expeditionTargetZ ?? 0) - z) ** 2;
        if (dSq < minCitySepSq) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      let buildableNeighbors = 0;
      let nearbyResources = 0;
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nt = getTile(state, x + dx, z + dz);
          if (!nt || nt.height >= 6 || nt.buildingId) continue;
          if (nt.height > 0 || isOceanWorld || t.height === 0) {
            buildableNeighbors += 1;
          }
        }
      }
      if (buildableNeighbors < 8) continue;

      for (let dz = -5; dz <= 5; dz += 2) {
        for (let dx = -5; dx <= 5; dx += 2) {
          const rt = getTile(state, x + dx, z + dz);
          if (rt && rt.resourceNode !== 'none') nearbyResources += 1;
        }
      }

      let score = buildableNeighbors * 2.2 + nearbyResources * 3.5;
      if (t.terrain === 'fertile' || t.terrain === 'grass') score += 14;
      if (t.height === 2 || t.height === 3) score += 8;
      score -= Math.abs(distFromOrigin - 34) * 0.45;
      score += (((x * 31 + z * 17 + (state.seed ?? 1)) & 15) / 16) * 2.0;

      if (t.height > 0) {
        if (score > bestLandScore) {
          bestLandScore = score;
          bestLandTile = t;
        }
      } else if (score > bestWaterScore) {
        bestWaterScore = score;
        bestWaterTile = t;
      }
    }
  }

  if (isOceanWorld) {
    return bestWaterTile ?? bestLandTile;
  }
  const hasMaritimeTransport = (state.vehicles ?? []).some((v) => v.type === 'passenger_ship');
  return bestLandTile ?? (hasMaritimeTransport ? bestWaterTile : null);
}

function stepCivilizationPlanner(state: SimulationState, dt: number): void {
  const activeCivs = state.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko');
  if (activeCivs.length === 0) return;

  const hasArrivedPioneers = activeCivs.some((u) => !u.settlementId && u.expeditionTargetX === undefined);
  state.civPlanTimer = (state.civPlanTimer ?? 0) + dt;
  const interval = hasArrivedPioneers ? 0.6 : state.sandboxFreeMode ? 1.5 : 2.2;
  if (state.civPlanTimer < interval) return;
  state.civPlanTimer = 0;

  if (!state.settlementNames) state.settlementNames = {};
  if (!state.settlementSpecies) state.settlementSpecies = {};
  if (!state.settlementKingdoms) state.settlementKingdoms = {};

  // 1. Bind local homeless settlers to same-species settlement or gather resources first before founding hearth
  for (const pioneer of activeCivs) {
    if (pioneer.settlementId || pioneer.expeditionTargetX !== undefined || pioneer.embarkedVehicleId) continue;

    const nearbyBld = findLocalSettlementBuilding(state, pioneer.x, pioneer.z, SETTLEMENT_AWARENESS_RADIUS);
    if (nearbyBld?.settlementId) {
      const bSpecies = state.settlementSpecies[nearbyBld.settlementId] ?? 'human';
      const bKid = getKingdomId(state, nearbyBld.settlementId);
      if (bSpecies === pioneer.species && (!pioneer.isRebel || bKid === pioneer.kingdomId)) {
        pioneer.settlementId = nearbyBld.settlementId;
        pioneer.kingdomId = bKid;
        continue;
      }
    }

    const bandPioneers = activeCivs.filter(
      (other) =>
        !other.settlementId &&
        other.species === pioneer.species &&
        Math.hypot(other.x - pioneer.x, other.z - pioneer.z) <= SETTLEMENT_AWARENESS_RADIUS,
    );

    if (!state.sandboxFreeMode && !pioneer.isRebel) {
      const bandCarriedTotal = bandPioneers.reduce((sum, p) => sum + (p.carryingAmount ?? 0), 0);
      const nearestGatherNode = findNearestResourceTile(
        state,
        pioneer.x,
        pioneer.z,
        ['timber_grove', 'berry_bush', 'stone_outcrop', 'scrap_flotsam', 'coral_reef'],
        pioneer,
      );
      const nodeDist = nearestGatherNode
        ? Math.hypot(nearestGatherNode.x - pioneer.x, nearestGatherNode.z - pioneer.z)
        : Infinity;
      const waitedLongEnough = (pioneer.ageYears ?? 0) >= 6.0;
      if (bandCarriedTotal < 8 && nodeDist <= 14 && !waitedLongEnough) {
        continue;
      }
    }

    const px = Math.round(pioneer.x);
    const pz = Math.round(pioneer.z);
    let siteTile: TileData | undefined = getTile(state, px, pz);
    if (!siteTile || siteTile.buildingId) {
      siteTile = findBuildableTileNear(state, px, pz, 8) ?? undefined;
    }
    if (siteTile && siteTile.height >= 0 && !siteTile.buildingId) {
      const def = BUILDINGS.find((b) => b.type === 'bonfire')!;
      let siteBonusWood = 0;
      let siteBonusFood = 0;
      if (siteTile.resourceNode === 'timber_grove' || siteTile.resourceNode === 'scrap_flotsam') siteBonusWood = 10;
      else if (siteTile.resourceNode === 'berry_bush' || siteTile.resourceNode === 'coral_reef') siteBonusFood = 10;
      siteTile.resourceNode = 'none';
      siteTile.resourceAmount = 0;
      if (siteTile.height === 0) {
        if (siteTile.terrain === 'stone_road' || siteTile.terrain === 'rail_track') {
          siteTile.terrain = 'shallow_water';
        }
      } else if (siteTile.terrain === 'stone_road' || siteTile.terrain === 'forest') {
        siteTile.terrain = 'grass';
      }

      const newSettlementId = nextEntityId('city');
      const sp = pioneer.species ?? 'human';
      const villageName = createVillageName(state, sp);
      state.settlementNames[newSettlementId] = villageName;
      ensureWorldStats(state).citiesCreated += 1;
      state.settlementSpecies[newSettlementId] = sp;

      const isKingdomAlive = (kid: string) =>
        state.buildings.some((b) => b.settlementId && getKingdomId(state, b.settlementId) === kid && b.hp > 0) ||
        activeCivs.some(
          (u) =>
            u.id !== pioneer.id &&
            (u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId) === kid,
        );

      let resolvedKingdomId: string | undefined;
      if (pioneer.isRebel && pioneer.kingdomId) {
        resolvedKingdomId = pioneer.kingdomId;
      } else if (pioneer.kingdomId && isKingdomAlive(pioneer.kingdomId)) {
        resolvedKingdomId = pioneer.kingdomId;
      }
      if (!resolvedKingdomId) {
        const companion = activeCivs.find(
          (other) =>
            other.species === sp &&
            other.kingdomId &&
            Math.hypot(other.x - siteTile!.x, other.z - siteTile!.z) <= SETTLEMENT_AWARENESS_RADIUS &&
            isKingdomAlive(other.kingdomId),
        );
        if (companion?.kingdomId) {
          resolvedKingdomId = companion.kingdomId;
        }
      }
      if (!resolvedKingdomId) {
        resolvedKingdomId = newSettlementId;
        // All newly spawned races founding a brand-new independent civilization MUST start in Stone Age (0)
        if (!state.kingdomEpochs) state.kingdomEpochs = {};
        if (!state.kingdomEpochProgress) state.kingdomEpochProgress = {};
        state.kingdomEpochs[resolvedKingdomId] = 0;
        state.kingdomEpochProgress[resolvedKingdomId] = 0;
      }
      state.settlementKingdoms[newSettlementId] = resolvedKingdomId;
      const kStock = ensureKingdomResources(state, resolvedKingdomId);
      transferUnallocatedStockToKingdom(state, resolvedKingdomId);
      kStock.food += 18 + siteBonusFood;
      kStock.wood += 12 + siteBonusWood;

      const hearth: BuildingEntity = {
        id: nextEntityId('bld'),
        type: 'bonfire',
        settlementId: newSettlementId,
        species: sp,
        tileX: siteTile.x,
        tileZ: siteTile.z,
        hp: def.maxHp,
        maxHp: def.maxHp,
        constructionProgress: 20,
        epochLevel: 0,
        upgradeProgress: 0,
        blessedTimer: 0,
        cursedTimer: 0,
        shieldTimer: 0,
      };
      siteTile.buildingId = hearth.id;
      state.buildings.push(hearth);
      state.totalStructuresBuilt += 1;

      // Adopt nearby homeless/arriving pioneers of the same species and deposit their gathered stock
      for (const other of activeCivs) {
        if (
          !other.settlementId &&
          other.species === sp &&
          Math.hypot(other.x - siteTile.x, other.z - siteTile.z) <= SETTLEMENT_AWARENESS_RADIUS
        ) {
          other.settlementId = newSettlementId;
          other.kingdomId = resolvedKingdomId;
          other.expeditionTargetX = undefined;
          other.expeditionTargetZ = undefined;
          other.expeditionTimer = undefined;
          if (other.carryingType && other.carryingAmount > 0) {
            kStock[other.carryingType] += other.carryingAmount;
            if (!state.harvestAccumulator) state.harvestAccumulator = emptyResources();
            state.harvestAccumulator[other.carryingType] += other.carryingAmount;
            other.carryingAmount = 0;
            other.carryingType = null;
          }
        }
      }

      syncAverageEpochFromKingdoms(state);
      syncStateResourcesFromKingdoms(state);
      addChronicle(
        state,
        `${sp[0].toUpperCase() + sp.slice(1)} pioneers founded ${villageName} at (${siteTile.x}, ${siteTile.z}).`,
        'build',
      );
      recalculateRatesAndCaps(state);
    }
  }

  // Ensure legacy buildings have a settlementId
  for (const b of state.buildings) {
    if (!b.settlementId) {
      b.settlementId = 'city_default';
      if (!state.settlementSpecies['city_default']) state.settlementSpecies['city_default'] = 'human';
      if (!state.settlementNames['city_default']) {
        state.settlementNames['city_default'] = createVillageName(state, 'human');
        ensureWorldStats(state).citiesCreated += 1;
      }
    }
  }

  // 2. Step each independent village/city separately using its kingdom's own resource stockpile & age
  const settlementIds = Array.from(new Set(state.buildings.map((b) => b.settlementId!)));

  for (const sid of settlementIds) {
    const villageBuildings = state.buildings.filter((b) => b.settlementId === sid);
    if (villageBuildings.length === 0) continue;

    const villageAnchor = getSettlementAnchorForId(state, sid);
    const villageUnits = activeCivs.filter((u) => u.settlementId === sid);
    const completedBuildings = villageBuildings.filter((b) => b.constructionProgress >= 100);
    const hasCompletedHearth = completedBuildings.length > 0;
    const villageSpecies: SpeciesId = state.settlementSpecies[sid] ?? villageUnits[0]?.species ?? 'human';
    const sidKingdomId = getKingdomId(state, sid);
    const cityEpoch = getKingdomEpoch(state, sidKingdomId);
    const epoch = EPOCHS[cityEpoch] || EPOCHS[0];
    const kRes = ensureKingdomResources(state, sidKingdomId);

    const cityMaxPop = getMaxCityPopulation(state.gridSize);
    let rawVillagePopCap = hasCompletedHearth ? epoch.populationBonus : 0;
    for (const b of completedBuildings) {
      const def = BUILDINGS.find((d) => d.type === b.type);
      if (def) rawVillagePopCap += def.popCapBonus;
    }
    const villagePopCap = Math.min(cityMaxPop, rawVillagePopCap);

    // Autonomous Population Growth drawn strictly from this kingdom's food stockpile
    const birthFoodReq = villageUnits.length < 10 ? 22 : 32;
    const birthFoodCost = villageUnits.length < 10 ? 14 : 20;
    const totalLivingCivs = state.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko').length;
    if (
      state.worldRules?.allowReproduction !== false &&
      hasCompletedHearth &&
      villageUnits.length < villagePopCap &&
      totalLivingCivs < Math.max(villagePopCap, state.populationCap) &&
      kRes.food >= birthFoodReq &&
      state.happiness >= 35
    ) {
      kRes.food -= birthFoodCost;
      const spawnHub = completedBuildings[0];
      const birthAgeStage: UnitAgeStage = villageUnits.length >= 2 ? 'child' : 'adult';
      spawnUnit(state, villageSpecies, spawnHub.tileX, spawnHub.tileZ, true, sid, {
        ageStage: birthAgeStage,
        isBirth: true,
      });

      // Young bands with healthy food reserves can birth a second child so founders don't die before sustaining pop
      if (
        villageUnits.length < 8 &&
        villageUnits.length + 1 < villagePopCap &&
        totalLivingCivs + 1 < Math.max(villagePopCap, state.populationCap) &&
        kRes.food >= 28
      ) {
        kRes.food -= 14;
        spawnUnit(state, villageSpecies, spawnHub.tileX, spawnHub.tileZ, true, sid, {
          ageStage: 'child',
          isBirth: true,
        });
      }
    }

    // Autonomous Construction Planner scoped to THIS village & THIS kingdom's stocked resources & epoch
    const maxCityBuildings = getMaxCityBuildings(cityEpoch);
    let activeSites = villageBuildings.filter((b) => b.constructionProgress < 100).length;
    const orcSlowSkip =
      villageSpecies === 'orc' &&
      !state.sandboxFreeMode &&
      villageBuildings.length >= 6 &&
      Math.floor(Math.abs(state.year * 10)) % 3 === 1;

    const maxConcurrentSites = cityEpoch >= 3 ? 4 : cityEpoch >= 1 || villageUnits.length >= 5 ? 3 : 2;
    const isCityInRebuildCrisis = (state.settlementRebuildCooldowns?.[sid] ?? 0) > 0;
    const isKingdomAtWarNow = settlementIds.some((oSid) =>
      areKingdomsAtWar(state, sidKingdomId, getKingdomId(state, oSid)),
    );
    const sitesToPlaceThisTick = isCityInRebuildCrisis
      ? 0
      : isKingdomAtWarNow
        ? 1
        : state.sandboxFreeMode || kRes.wood >= 80
          ? 2
          : 1;

    for (let placeAttempt = 0; placeAttempt < sitesToPlaceThisTick; placeAttempt++) {
      if (
        !state.autoBuildEnabled ||
        state.worldRules?.autoBuildEnabled === false ||
        !hasCompletedHearth ||
        orcSlowSkip ||
        activeSites >= maxConcurrentSites ||
        villageBuildings.length >= maxCityBuildings
      ) {
        break;
      }
      const currentStock = ensureKingdomResources(state, sidKingdomId);
      const desiredType = pickDesiredAutobuildType(
        state,
        villageBuildings,
        villageUnits.length,
        villageSpecies,
        currentStock,
        cityEpoch,
      );
      if (!desiredType) break;
      const def = BUILDINGS.find((b) => b.type === desiredType);
      if (!def || !canAfford(currentStock, def.cost, state.sandboxFreeMode)) break;
      const site = findBuildableTileNear(state, villageAnchor.x, villageAnchor.z, 22, sid, desiredType);
      if (!site) break;

      state.kingdomResources![sidKingdomId] = deductCost(currentStock, def.cost, state.sandboxFreeMode);
      const refreshedStock = ensureKingdomResources(state, sidKingdomId);
      if (site.resourceNode === 'timber_grove') refreshedStock.wood += 12;
      else if (site.resourceNode === 'stone_outcrop') refreshedStock.stone += 12;
      site.resourceNode = 'none';
      site.resourceAmount = 0;
      site.farmSettlementId = undefined;
      if (site.height === 0) {
        if (site.terrain === 'stone_road' || site.terrain === 'rail_track') {
          site.terrain = 'shallow_water';
        }
      } else if (site.terrain === 'stone_road' || site.terrain === 'forest') {
        site.terrain = 'grass';
      }
      const baseEpochIdx = Math.max(0, EPOCHS.findIndex((e) => e.id === def.epoch));

      const siteBld: BuildingEntity = {
        id: nextEntityId('bld'),
        type: desiredType,
        settlementId: sid,
        species: villageSpecies,
        tileX: site.x,
        tileZ: site.z,
        hp: def.maxHp,
        maxHp: def.maxHp,
        constructionProgress: isKingdomAtWarNow ? 15 : 34,
        epochLevel: cityEpoch === 0 ? 0 : Math.min(cityEpoch, baseEpochIdx),
        upgradeProgress: 0,
        blessedTimer: 0,
        cursedTimer: 0,
        shieldTimer: 0,
      };
      site.buildingId = siteBld.id;
      site.farmSettlementId = undefined;
      site.claimedSettlementId = sid;
      state.buildings.push(siteBld);
      villageBuildings.push(siteBld);
      activeSites += 1;
      state.totalStructuresBuilt += 1;
      paveSettlementStreetsNear(state, site.x, site.z, sid);
      claimTerritoryAround(state, site.x, site.z, 3.2, sid, sidKingdomId, true);
      const isLandmarkBuild =
        def.type === 'dyson_spire' ||
        def.type === 'launch_arcology' ||
        def.type === 'fission_reactor' ||
        def.type === 'cyber_institute' ||
        def.type === 'observatory' ||
        def.type === 'ziggurat';
      if (isLandmarkBuild) {
        const vName = state.settlementNames[sid] ?? 'Settlement';
        addChronicle(state, `${vName} began constructing a grand ${def.name}.`, 'build');
      }
    }

    // Autonomous Territory Claiming: races constantly seek to claim as much territory as possible
    // (they can choose to build or just claim border/frontier territory like countries do, including annexing enemy land at war!)
    if (hasCompletedHearth && villageUnits.length >= 1) {
      const isAtWarWithAny = Object.entries(state.kingdomRelations ?? {}).some(
        ([kPair, rel]) => rel === 'war' && kPair.split('::').includes(sidKingdomId),
      );
      const claimOriginBld =
        villageBuildings[Math.floor(Math.abs(state.year * 17) + villageBuildings.length * 3) % villageBuildings.length];
      if (claimOriginBld) {
        const claimReach = Math.min(24, 6 + Math.floor(villageBuildings.length * 0.75) + cityEpoch * 2);
        const angle = ((state.year * 2.3 + claimOriginBld.tileX * 0.7 + claimOriginBld.tileZ * 1.1) % 1) * Math.PI * 2;
        const dist = 2 + (Math.abs(Math.sin(state.year * 3.7 + claimOriginBld.tileX)) * (claimReach - 2));
        const claimX = Math.max(1, Math.min(state.gridSize - 2, Math.round(claimOriginBld.tileX + Math.cos(angle) * dist)));
        const claimZ = Math.max(1, Math.min(state.gridSize - 2, Math.round(claimOriginBld.tileZ + Math.sin(angle) * dist)));
        claimTerritoryAround(state, claimX, claimZ, isAtWarWithAny ? 2.6 : 2.1, sid, sidKingdomId, isAtWarWithAny);
      }
    }

    // Autonomous Frontier Colonization from this kingdom's food stock
    const isAtMaxCitySize = villageBuildings.length >= maxCityBuildings;
    const isLargeAndCrowded =
      villageBuildings.length >= Math.min(maxCityBuildings, 6) &&
      villageUnits.length >= Math.max(7, Math.floor(villagePopCap * 0.65));
    const hasExpeditionInProgress = activeCivs.some(
      (u) => u.expeditionTargetX !== undefined && u.kingdomId === sidKingdomId,
    );
    const activeStock = ensureKingdomResources(state, sidKingdomId);

    if (
      hasCompletedHearth &&
      (isAtMaxCitySize || isLargeAndCrowded) &&
      villageUnits.length >= 5 &&
      settlementIds.length < MAX_WORLD_CITIES &&
      !hasExpeditionInProgress &&
      (state.sandboxFreeMode || activeStock.food >= 55)
    ) {
      const frontier = findNewCitySite(state, villageAnchor.x, villageAnchor.z);
      if (frontier) {
        const candidates = villageUnits.filter(
          (u) =>
            !u.isKing &&
            u.ageStage !== 'child' &&
            u.role !== 'warrior' &&
            u.carryingAmount === 0 &&
            u.expeditionTargetX === undefined,
        );
        const adultPool = villageUnits.filter((u) => !u.isKing && u.ageStage !== 'child');
        const colonistPool = candidates.length >= 2 ? candidates : adultPool;
        const maxColonistsToSend = Math.min(2, Math.max(0, villageUnits.length - 3));
        if (maxColonistsToSend > 0 && colonistPool.length >= maxColonistsToSend) {
          if (!state.sandboxFreeMode) {
            activeStock.food = Math.max(0, activeStock.food - 40);
          }
          for (let c = 0; c < maxColonistsToSend; c++) {
            const col = colonistPool[c];
            col.kingdomId = sidKingdomId;
            col.settlementId = undefined;
            col.expeditionTargetX = frontier.x;
            col.expeditionTargetZ = frontier.z;
            col.expeditionTimer = 0;
            col.targetX = frontier.x;
            col.targetZ = frontier.z;
            col.state = 'moving';
          }
          const vName = state.settlementNames[sid] ?? 'Settlement';
          addChronicle(
            state,
            `Pioneers from ${vName} set out to found a new city at (${frontier.x}, ${frontier.z})!`,
            'build',
          );
        }
      }
    }

    transformSettlementEnvironment(state, villageAnchor, villageBuildings);
  }

  syncStateResourcesFromKingdoms(state);
  ensureSettlementKings(state);
}

const tileTimerAccumByState = new WeakMap<SimulationState, number>();
const vehicleSpawnAccumByState = new WeakMap<SimulationState, number>();
const simTickCounterByState = new WeakMap<SimulationState, number>();
const voidGooPossibleByState = new WeakMap<SimulationState, boolean>();
const voidGooFrontierByState = new WeakMap<SimulationState, Set<number>>();
function trackVoidGooTile(state: SimulationState, tileIdx: number): void {
  voidGooPossibleByState.set(state, true);
  let frontier = voidGooFrontierByState.get(state);
  if (!frontier) {
    frontier = new Set<number>();
    voidGooFrontierByState.set(state, frontier);
  }
  frontier.add(tileIdx);
}
const specialLiquidPossibleByState = new WeakMap<SimulationState, boolean>();
const liquidReactionAccumByState = new WeakMap<SimulationState, number>();
const liquidContactAccumByState = new WeakMap<SimulationState, number>();
const solarBeamTileStateMap = new WeakMap<
  ActiveHazardZone,
  { burnAccum: Map<number, number>; evapAccum: Map<number, number>; evaporatedTiles: Set<number> }
>();

export function stepSimulation(
  state: SimulationState,
  rawDt: number,
  options?: { skipDragStep?: boolean; skipRandomEvents?: boolean },
): void {
  let remainingDt = Math.min(Math.max(rawDt, 0), 3.0);
  while (remainingDt > 0.0001) {
    const stepDt = Math.min(remainingDt, 0.1);
    remainingDt -= stepDt;
    stepSimulationSingle(state, stepDt, options);
  }
}

function stepSimulationSingle(
  state: SimulationState,
  dt: number,
  options?: { skipDragStep?: boolean; skipRandomEvents?: boolean },
): void {
  if (dt <= 0) return;
  const simTick = ((simTickCounterByState.get(state) ?? 0) + 1) | 0;
  simTickCounterByState.set(state, simTick);

  if ((simTick & 3) === 1) {
    reconcileKingdomEpochs(state, true);
  }
  reconcileAndSyncResources(state);

  if (!options?.skipDragStep) {
    stepDraggedUnitKinematics(state, dt);
  }

  // Decrement per-kingdom ultimate weapon cooldowns
  if (state.kingdomUltimateCooldowns) {
    for (const kid of Object.keys(state.kingdomUltimateCooldowns)) {
      if (state.kingdomUltimateCooldowns[kid] > 0) {
        state.kingdomUltimateCooldowns[kid] = Math.max(0, state.kingdomUltimateCooldowns[kid] - dt);
      }
    }
  }
  if (state.settlementRebuildCooldowns) {
    for (const sid of Object.keys(state.settlementRebuildCooldowns)) {
      if (state.settlementRebuildCooldowns[sid] > 0) {
        state.settlementRebuildCooldowns[sid] = Math.max(0, state.settlementRebuildCooldowns[sid] - dt);
        if (state.settlementRebuildCooldowns[sid] <= 0) {
          delete state.settlementRebuildCooldowns[sid];
        }
      }
    }
  }

  // 1. Advance historical year at 1 year per second on 1x speed (scales directly with speed multiplier)
  if (state.population > 0 || state.units.length > 0 || state.buildings.length > 0) {
    state.year += YEARS_PER_SEC_AT_1X * dt;
  }

  if (state.goldenAgeTimer > 0) {
    state.goldenAgeTimer = Math.max(0, state.goldenAgeTimer - dt);
  }

  // 2. Smoothly measure actual citizen harvest deposits over rolling 2.5s window
  state.harvestWindowTimer = (state.harvestWindowTimer ?? 0) + dt;
  if (state.harvestWindowTimer >= 2.5) {
    const win = state.harvestWindowTimer;
    const acc = state.harvestAccumulator ?? emptyResources();
    const prev = state.harvestRates ?? emptyResources();
    const nextRates = emptyResources();
    for (const k of Object.keys(nextRates) as (keyof Resources)[]) {
      nextRates[k] = prev[k] * 0.35 + (acc[k] / win) * 0.65;
    }
    state.harvestRates = nextRates;
    state.harvestAccumulator = emptyResources();
    state.harvestWindowTimer = 0;
  }

  // 3. Accumulate passive completed-building production into each kingdom's own stockpile & apply food upkeep
  if ((simTick & 1) === 1) {
    recalculateRatesAndCaps(state);
  }
  const paceMult = state.sandboxFreeMode ? 1.0 : 0.34;
  const goldenMult = state.goldenAgeTimer > 0 ? 2 : 1;

  if (!state.unallocatedResources) state.unallocatedResources = emptyResources();
  state.unallocatedResources.faith += 2 * goldenMult * dt;

  const prodByKid = new Map<string, Resources>();
  const ensureProd = (kid: string) => {
    let p = prodByKid.get(kid);
    if (!p) {
      p = emptyResources();
      prodByKid.set(kid, p);
    }
    return p;
  };

  for (const b of state.buildings) {
    if (b.constructionProgress < 100) continue;
    const def = BUILDING_BY_TYPE.get(b.type);
    if (!def) continue;
    const blessMult = b.blessedTimer > 0 ? 1.75 : b.cursedTimer > 0 ? 0.5 : 1.0;
    const bEpoch = getSettlementEpoch(state, b.settlementId);
    const epochMult = 1 + Math.min(4, bEpoch) * 0.1;
    const bSpecies: SpeciesId = b.species ?? (b.settlementId ? state.settlementSpecies?.[b.settlementId] : undefined) ?? 'human';
    const bKid = b.settlementId ? getKingdomId(state, b.settlementId) : 'unowned';
    const pRec = bKid !== 'unowned' ? ensureProd(bKid) : null;

    for (const [k, v] of Object.entries(def.productionPerSec)) {
      const key = k as keyof Resources;
      let spMult = 1.0;
      if (bSpecies === 'human') {
        if (key === 'knowledge' || key === 'energy' || key === 'alloy') spMult = 1.3;
      } else if (bSpecies === 'elf') {
        if (key === 'faith' || key === 'knowledge') spMult = 1.25;
        else if (key === 'ore' || key === 'alloy') spMult = 0.78;
      } else if (bSpecies === 'orc') {
        if (key === 'knowledge' || key === 'energy') spMult = 0.35;
        else if (key === 'alloy') spMult = 0.5;
        else if (key === 'food' || key === 'ore') spMult = 1.15;
      }
      const addVal = (v ?? 0) * blessMult * epochMult * spMult * paceMult * goldenMult * dt;
      if (pRec && key !== 'faith') pRec[key] += addVal;
      else if (key === 'faith') state.unallocatedResources.faith += addVal;
    }
  }

  const popByKid = new Map<string, number>();
  for (const u of state.units) {
    if (u.faction === 'civilization' && u.state !== 'ko' && u.hp > 0) {
      const ukid = u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId;
      if (ukid) popByKid.set(ukid, (popByKid.get(ukid) ?? 0) + 1);
    }
  }

  const allStockKids = new Set<string>([...prodByKid.keys(), ...popByKid.keys()]);
  for (const kid of allStockKids) {
    const stock = ensureKingdomResources(state, kid);
    const prod = prodByKid.get(kid);
    if (prod) {
      for (const k of RESOURCE_KEYS) {
        if (k !== 'faith') stock[k] += prod[k];
      }
    }
    const kPop = popByKid.get(kid) ?? 0;
    if (kPop > 6) {
      const kUpkeep = (kPop - 6) * 0.1 * goldenMult * dt;
      stock.food = Math.max(0, stock.food - kUpkeep);
    }
  }
  syncStateResourcesFromKingdoms(state);

  // 4. Autonomous Civilization Planner, Raider Waves & Wild Ecology Seeding
  if (!state.wildlifeSeeded) {
    state.wildlifeSeeded = true;
    seedWorldWildlife(state);
  }
  if (state.worldRules?.allowReproduction !== false) {
    stepWildlifeReproduction(state, dt);
    state.wildlifeRespawnTimer = (state.wildlifeRespawnTimer ?? 0) + dt;
    if (state.wildlifeRespawnTimer >= 22) {
      state.wildlifeRespawnTimer = 0;
      const livingWildlife = state.units.filter((u) => u.faction === 'wildlife' && u.state !== 'ko').length;
      const hiddenCap = getHiddenWorldWildlifeCap(state.gridSize);
      const targetEcosystemFloor = Math.max(36, Math.round(hiddenCap * 0.45));
      if (livingWildlife < targetEcosystemFloor) {
        seedWorldWildlife(state, Math.min(8, targetEcosystemFloor - livingWildlife));
      }
    }
  }
  if (state.worldRules?.raiderWaves && state.buildings.some((b) => b.constructionProgress >= 100)) {
    state.raiderWaveTimer = (state.raiderWaveTimer ?? 0) + dt;
    if (state.raiderWaveTimer >= 85) {
      state.raiderWaveTimer = 0;
      const activeRaiders = state.units.filter((u) => u.faction === 'hostile' && u.state !== 'ko').length;
      if (activeRaiders < 9) {
        spawnRaiderWave(state);
      }
    }
  } else {
    state.raiderWaveTimer = 0;
  }
  stepKingdomDiplomacyAndRebellions(state, dt);
  stepStrategicWarfare(state, dt);
  stepCivilizationPlanner(state, dt);
  stepCivilizationBridging(state, dt);
  stepFarmCropGrowth(state, dt);
  stepDynamicLiquidFlow(state, dt);
  stepAncientRuinExploration(state, dt);
  stepWorldWonders(state, dt);

  // 5. Per-Civilization Epoch Progression with Proximity Tech Diffusion & Non-Overtaking Catch-Up Curve
  const liveKids = getLiveKingdomIds(state);
  if (!state.kingdomEpochs) state.kingdomEpochs = {};
  if (!state.kingdomEpochProgress) state.kingdomEpochProgress = {};

  if (liveKids.length > 0) {
    const completedByKid = new Map<string, BuildingEntity[]>();
    for (let bi = 0; bi < state.buildings.length; bi++) {
      const b = state.buildings[bi];
      if (b.hp <= 0 || b.constructionProgress < 100 || !b.settlementId) continue;
      const kid = getKingdomId(state, b.settlementId);
      let list = completedByKid.get(kid);
      if (!list) {
        list = [];
        completedByKid.set(kid, list);
      }
      list.push(b);
    }

    // Snapshot diffusion before mutating any kingdom epochs this tick so simultaneous neighbors evaluate consistently
    const diffusionByKid = new Map<string, KingdomDiffusionInfo>();
    for (const kid of liveKids) {
      diffusionByKid.set(kid, computeKingdomProximityDiffusion(state, kid));
    }

    for (const kid of liveKids) {
      const kEpoch = getKingdomEpoch(state, kid);
      if (kEpoch >= EPOCHS.length - 1) {
        state.kingdomEpochProgress[kid] = 100;
        continue;
      }
      const kCompleted = completedByKid.get(kid);
      if (!kCompleted || kCompleted.length === 0) {
        state.kingdomEpochProgress[kid] = state.kingdomEpochProgress[kid] ?? 0;
        continue;
      }

      const nextEpoch = EPOCHS[kEpoch + 1];
      const kStock = ensureKingdomResources(state, kid);
      let ratioSum = 0;
      let ratioCount = 0;
      for (const [k, reqVal] of Object.entries(nextEpoch.unlockCost)) {
        if ((reqVal ?? 0) > 0) {
          const avail = k === 'faith' ? state.resources.faith : kStock[k as keyof Resources];
          ratioSum += Math.min(1, avail / reqVal);
          ratioCount += 1;
        }
      }
      const resReadiness = ratioCount > 0 ? ratioSum / ratioCount : 0;

      const completedCount = kCompleted.length;
      const kPop = popByKid.get(kid) ?? 0;
      const requiredStructures =
        kEpoch === 0
          ? 2
          : kEpoch === 1
            ? 5
            : kEpoch === 2
              ? 8
              : kEpoch === 3
                ? 12
                : kEpoch === 4
                  ? 16
                  : kEpoch === 5
                    ? 22
                    : 26;
      const requiredPop =
        kEpoch === 0
          ? 4
          : kEpoch === 1
            ? 8
            : kEpoch === 2
              ? 14
              : kEpoch === 3
                ? 20
                : kEpoch === 4
                  ? 26
                  : kEpoch === 5
                    ? 32
                    : 38;

      const upgradedCount = kCompleted.filter((b) => b.epochLevel >= kEpoch).length;
      const upgradeReady = kEpoch < 3 || upgradedCount >= Math.ceil(completedCount * 0.65);
      const eraInfraReady =
        kEpoch === 2
          ? kCompleted.some(
              (b) =>
                b.type === 'smeltery' ||
                b.type === 'guildhall' ||
                b.type === 'ziggurat' ||
                b.type === 'observatory',
            )
          : kEpoch === 3
            ? kCompleted.some(
                (b) => b.type === 'steam_foundry' || b.type === 'dynamo_plant' || b.type === 'rail_station',
              )
            : kEpoch === 5
              ? kCompleted.some((b) => b.type === 'cyber_institute' || b.type === 'fission_reactor')
              : kEpoch === 6
                ? kCompleted.some((b) => b.type === 'launch_arcology')
                : true;

      const hasFullFoundation =
        completedCount >= requiredStructures && kPop >= requiredPop && upgradeReady && eraInfraReady;
      // Diffusion catch-up can ease thresholds slightly (75% structures, 70% pop), but NEVER lets a 1-building outpost skip eras
      const hasDiffusionFoundation =
        completedCount >= Math.max(2, Math.ceil(requiredStructures * 0.75)) &&
        kPop >= Math.max(4, Math.ceil(requiredPop * 0.7)) &&
        eraInfraReady;

      // Full economic/structural readiness allows immediate organic ascension (respects species & stockpiles)
      const costWithFaith: Resources = { ...kStock, faith: state.resources.faith };
      if (hasFullFoundation && canAfford(costWithFaith, nextEpoch.unlockCost, false)) {
        advanceKingdomEpoch(state, kid, false, { skipAverageSync: true });
        continue;
      }

      // Continuous growth rate: native development + proximity diffusion catch-up curve from higher-age neighbors
      const kSpecies: SpeciesId =
        kCompleted[0]?.species ??
        (kCompleted[0]?.settlementId ? state.settlementSpecies?.[kCompleted[0].settlementId] : undefined) ??
        'human';
      const speciesPace = kSpecies === 'human' ? 1.15 : kSpecies === 'elf' ? 0.95 : 0.65;
      const structureFactor = Math.min(2.2, 0.35 + completedCount * 0.12);
      const popFactor = Math.min(2.0, 0.4 + kPop * 0.06);
      const readinessFactor = 0.25 + resReadiness * 1.45;
      const eraDifficulty = 1 + kEpoch * 0.55;
      const nativeRatePerSec =
        ((0.45 * structureFactor * popFactor * readinessFactor * speciesPace) / eraDifficulty) *
        (state.sandboxFreeMode ? 1.35 : 1.0);

      const diff = diffusionByKid.get(kid)!;
      if (diff.isCatchingUp && kEpoch < diff.maxNeighborEpoch) {
        // Proximity-based diminishing catch-up curve: steep when far behind a close neighbor, tapering as gap -> 0
        const diffusionRatePerSec = diff.diffusionBoost * (1.85 + 0.25 * Math.min(4, completedCount));
        const nextProg = (state.kingdomEpochProgress[kid] ?? 0) + (nativeRatePerSec + diffusionRatePerSec) * dt;
        if (nextProg >= 100 && hasDiffusionFoundation) {
          // Advance by +1 toward neighbor's age; reset progress to 0 so diffusion NEVER overtakes a leading neighbor!
          advanceKingdomEpoch(state, kid, false, { freeFromProgress: true, skipAverageSync: true });
          state.kingdomEpochProgress[kid] = 0;
        } else {
          state.kingdomEpochProgress[kid] = Math.min(99, nextProg);
        }
      } else {
        // Equal age or leading: zero diffusion boost — progression depends strictly on own civilization strength
        const nextProg = (state.kingdomEpochProgress[kid] ?? 0) + nativeRatePerSec * dt;
        const canAscendNatively = hasFullFoundation && (resReadiness >= 0.65 || state.sandboxFreeMode);
        if (nextProg >= 100 && canAscendNatively) {
          advanceKingdomEpoch(state, kid, false, { freeFromProgress: true, skipAverageSync: true });
          state.kingdomEpochProgress[kid] = 0;
        } else {
          state.kingdomEpochProgress[kid] = Math.min(99, nextProg);
        }
      }
    }

    syncAverageEpochFromKingdoms(state);
    syncStateResourcesFromKingdoms(state);
  } else {
    state.epochProgress = state.epochIndex >= EPOCHS.length - 1 ? 100 : 0;
    state.averageEpochIndex = state.epochIndex;
    lastSyncedEpochMap.set(state, state.epochIndex);
  }

  // 6. Active hazards (rain clouds, plague clouds, wormholes) & real tile fires
  if (!state.activeHazards) state.activeHazards = [];
  const remainingHazards = [];
  for (const haz of state.activeHazards) {
    if (haz.kind === 'rain_cloud') {
      const tx = haz.targetX ?? haz.x;
      const tz = haz.targetZ ?? haz.z;
      const wx = haz.windX ?? 0.78;
      const wz = haz.windZ ?? 0.62;
      const arrDur = Math.max(0.1, haz.arrivalDuration ?? 0.72);

      if ((haz.arrivalRemaining ?? 0) > 0) {
        // Phase 1: Move fast from upwind to arrive at the summoned target spot
        const arriveDt = Math.min(dt, 0.045);
        haz.arrivalRemaining = Math.max(0, (haz.arrivalRemaining ?? 0) - arriveDt);
        const u = 1 - haz.arrivalRemaining / arrDur; // 0 -> 1
        // Smooth fast swoop from -18.5 tiles upwind to -1.5 tiles at target entry
        const s = -1.5 - 17.0 * Math.pow(1 - u, 2.4);
        haz.currentSpeed = Math.max(0.6, (17.0 * 2.4 * Math.pow(1 - u, 1.4)) / arrDur);
        haz.x = tx + wx * s;
        haz.z = tz + wz * s;
        if (haz.arrivalRemaining <= 0 && haz.impactPending) {
          executeGodPowerImpact(state, 'rain_of_plenty', tx, tz);
        }
      } else {
        // Phase 2 & 3: Linger moving slowly at summoned spot depending on duration rate, then accelerate fast as it expires
        haz.remaining -= dt;
        const totalDur = Math.max(0.1, haz.duration);
        const progress = Math.max(0, Math.min(1, 1 - haz.remaining / totalDur));
        const isDeluge = Boolean(haz.isSuper);
        const lingerSplit = isDeluge ? 0.88 : 0.6;
        const lingerDistance = isDeluge ? 5.0 : 3.5;
        const lingerTime = lingerSplit * totalDur;
        const baseSlowSpeed = lingerDistance / Math.max(0.1, lingerTime);

        let s: number;
        let perpOffset: number;
        if (progress <= lingerSplit) {
          // Phase 2: Slow drift or circling monsoon over the impact basin
          const lingerFrac = progress / lingerSplit;
          s = (isDeluge ? -2.5 : -1.5) + lingerDistance * lingerFrac;
          haz.currentSpeed = baseSlowSpeed;
          perpOffset = Math.sin(progress * Math.PI * (isDeluge ? 6.0 : 3.0)) * (isDeluge ? 2.6 : 0.42);
        } else {
          // Phase 3: Slowly becomes fast as it expires (smooth acceleration ramp)
          const expireFrac = (progress - lingerSplit) / (1 - lingerSplit); // 0 -> 1
          const expireTime = (1 - lingerSplit) * totalDur;
          const accelDist = 23.0;
          s = (isDeluge ? 2.5 : 2.0) + baseSlowSpeed * expireTime * expireFrac + accelDist * Math.pow(expireFrac, 2.8);
          haz.currentSpeed =
            baseSlowSpeed + (accelDist * 2.8 * Math.pow(expireFrac, 1.8)) / Math.max(0.1, expireTime);
          perpOffset = Math.sin(progress * Math.PI * 3.0) * (isDeluge ? 1.8 : 0.42) * (1 - expireFrac * 0.65);
        }
        haz.x = tx + wx * s - wz * perpOffset;
        haz.z = tz + wz * s + wx * perpOffset;
      }
    } else {
      haz.remaining -= dt;
    }

    const usesOwnCountdownTimer =
      haz.kind === 'acid_cloud' ||
      haz.kind === 'sinkhole_collapse' ||
      haz.kind === 'locust_swarm' ||
      haz.kind === 'magma_geyser' ||
      haz.kind === 'sentinel_eye' ||
      haz.kind === 'blizzard_gale';
    if (!usesOwnCountdownTimer) {
      haz.tickTimer += dt;
    }
    if (!usesOwnCountdownTimer && haz.tickTimer >= 0.35) {
      haz.tickTimer -= 0.35;
      const rSq = haz.radius * haz.radius;
      if (haz.kind === 'rain_cloud') {
        forEachTileInRadius(state, haz.x, haz.z, haz.radius, (t, dSq) => {
          if (t.height > 0) {
            t.onFireTimer = 0;
            t.cursedTimer = 0;
            t.blessedTimer = Math.max(t.blessedTimer, 16);
            if (t.terrain === 'scorched') {
              t.terrain = 'grass';
            } else if ((t.terrain === 'sand' || t.terrain === 'savanna') && dSq <= rSq * 0.55) {
              t.terrain = 'grass';
            }
          }
        });
      } else if (haz.kind === 'plague_cloud') {
        for (const u of state.units) {
          const dSq = (u.x - haz.x) ** 2 + (u.z - haz.z) ** 2;
          if (dSq <= rSq && u.state !== 'ko' && !u.statusEffects.shielded && !u.statusEffects.blessed) {
            u.statusEffects.plagued = Math.max(u.statusEffects.plagued ?? 0, 16);
          }
        }
      } else if (haz.kind === 'earthquake_zone') {
        const aftershockRSq = (haz.radius * 0.78) ** 2;
        const segs = haz.faultSegments;
        for (const b of state.buildings) {
          const dSq = (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2;
          const segHit = segs && segs.length > 0 ? closestFaultDistanceSq(b.tileX, b.tileZ, segs) : null;
          const segReachSq = segHit?.segment ? (segHit.segment.width * 2.0 + 1.4) ** 2 : -1;
          if ((dSq <= aftershockRSq || (segHit && segHit.distSq <= segReachSq)) && b.shieldTimer <= 0) {
            b.hp = Math.max(0, b.hp - 16);
          }
        }
        for (const u of state.units) {
          const dx = u.x - haz.x;
          const dz = u.z - haz.z;
          const dSq = dx * dx + dz * dz;
          const segHit = segs && segs.length > 0 ? closestFaultDistanceSq(u.x, u.z, segs) : null;
          const segReachSq = segHit?.segment ? (segHit.segment.width * 2.1 + 1.5) ** 2 : -1;
          if ((dSq <= aftershockRSq || (segHit && segHit.distSq <= segReachSq)) && u.state !== 'ko' && !u.statusEffects.shielded) {
            u.hp = Math.max(0, u.hp - 12);
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
              if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
            }
          }
        }
        for (const v of state.vehicles ?? []) {
          if ((v.y ?? 0) > 1.8) continue;
          const dSq = (v.x - haz.x) ** 2 + (v.z - haz.z) ** 2;
          const segHit = segs && segs.length > 0 ? closestFaultDistanceSq(v.x, v.z, segs) : null;
          const segReachSq = segHit?.segment ? (segHit.segment.width * 2.1 + 1.5) ** 2 : -1;
          if (dSq <= aftershockRSq || (segHit && segHit.distSq <= segReachSq)) {
            v.hp = Math.max(0, (v.hp ?? 100) - 28);
          }
        }
      } else if (haz.kind === 'wormhole_rift') {
        // Gradually tear & excavate terrain blocks around the black hole into its swirling vortex
        const ripR = haz.radius * 1.05;
        let erodedThisTick = 0;
        forEachTileInRadius(state, haz.x, haz.z, ripR, (t, dSq) => {
          if (t.buildingId) return;
          if (t.height === 0) {
            damageOrBleachWaterTile(t, 260, true);
            return;
          }
          if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.terrain = 'scorched';
            erodedThisTick++;
          } else if (erodedThisTick < 3 && dSq <= (haz.radius * 0.78) ** 2 && t.height >= 2) {
            const hash = Math.abs((t.x * 73856093) ^ (t.z * 19349663) ^ Math.floor(haz.remaining * 10));
            if ((hash & 3) === 0) {
              t.height = Math.max(1, t.height - 1);
              t.terrain = dSq <= 4.0 ? 'scorched' : 'crystal_field';
              erodedThisTick++;
            }
          }
        });
      } else if (haz.kind === 'tornado_vortex') {
        // Tear up trees, crops & scatter debris along the tornado's ground track
        forEachTileInRadius(state, haz.x, haz.z, haz.radius * 0.72, (t) => {
          if (t.buildingId) return;
          if (t.height === 0) {
            damageOrBleachWaterTile(t, 260, true);
            return;
          }
          if (haz.elementAffinity !== 'fire') t.onFireTimer = 0;
          if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.terrain = 'grass';
            t.farmSettlementId = undefined;
          }
        });
      } else if (haz.kind === 'undead_portal') {
        // Spawn risen skeletons periodically from the necrotic portal (max 7 total)
        const spawned = haz.portalSpawnCount ?? 0;
        if (spawned < 7 && haz.remaining > 1.5) {
          const ang = (spawned * 2.1) % (Math.PI * 2);
          const sx = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + Math.cos(ang) * 1.6)));
          const sz = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + Math.sin(ang) * 1.6)));
          const skelRes = spawnUnit(state, 'skeleton', sx, sz, true);
          if (skelRes.ok) {
            haz.portalSpawnCount = spawned + 1;
            const st = getTile(state, sx, sz);
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'hit_spark',
              x: sx,
              y: (st?.height ?? 1) * 0.45 + 0.6,
              z: sz,
              radius: 1.5,
              color: '#a855f7',
              createdAt: Date.now(),
            });
          }
        }
      } else if (haz.kind === 'chrono_field') {
        // True 4x localized Time Bubble: accelerates construction, upgrades, child growth, cooldowns & movement inside the dome
        for (const b of state.buildings) {
          if ((b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2 <= rSq) {
            if (b.constructionProgress < 100) {
              b.constructionProgress = Math.min(100, b.constructionProgress + 28);
            } else {
              b.upgradeProgress = Math.min(99, (b.upgradeProgress ?? 0) + 18);
            }
          }
        }
        for (const u of state.units) {
          if (u.state !== 'ko' && (u.x - haz.x) ** 2 + (u.z - haz.z) ** 2 <= rSq) {
            u.actionCooldown = Math.max(0, u.actionCooldown - 0.6);
            if (u.weaponCooldown) u.weaponCooldown = Math.max(0, u.weaponCooldown - 0.6);
            if (u.ageStage === 'child' && u.growthTimer !== undefined) {
              u.growthTimer = Math.max(0, u.growthTimer - 4.0);
            }
            // Extra burst step toward current target so units visibly zip at ~4x speed inside the time dome!
            const dxT = u.targetX - u.x;
            const dzT = u.targetZ - u.z;
            const distT = Math.hypot(dxT, dzT);
            if (distT > 0.4 && u.state === 'moving') {
              const step = Math.min(distT - 0.2, 1.35);
              u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + (dxT / distT) * step));
              u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + (dzT / distT) * step));
            }
          }
        }
      }
    }

    // Continuous every-frame gravitational pull, terrain/building shear, orbital elevation & final Supernova Explosion for Black Hole (wormhole_rift)
    if (haz.kind === 'wormhole_rift') {
      const pullRadius = haz.radius * 1.65;
      const captureRadius = haz.radius * 1.45;
      for (const b of state.buildings) {
        const dSq = (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2;
        if (dSq <= (haz.radius * 0.95) ** 2 && b.shieldTimer <= 0) {
          b.hp = Math.max(0, b.hp - 135 * dt);
        }
      }
      for (const v of state.vehicles ?? []) {
        const dx = v.x - haz.x;
        const dz = v.z - haz.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= pullRadius) {
          const normDist = Math.min(1, dist / pullRadius);
          const curAngle = Math.atan2(dz, dx);
          const nextDist = Math.max(0.3, dist - (1.8 + (1 - normDist) * 2.4) * dt);
          const nextAngle = curAngle + (2.6 + (1 - normDist) * 3.8) * dt;
          v.x = Math.max(2, Math.min(state.gridSize - 3, haz.x + Math.cos(nextAngle) * nextDist));
          v.z = Math.max(2, Math.min(state.gridSize - 3, haz.z + Math.sin(nextAngle) * nextDist));
          v.hp = Math.max(0, (v.hp ?? 100) - (65 + (1 - normDist) * 95) * dt);
        }
      }
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded || u.draggedByPlayer) continue;
        const dx = u.x - haz.x;
        const dz = u.z - haz.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= pullRadius) {
          const normDist = Math.min(1, dist / pullRadius);
          const gravityStrength = 1.0 + Math.pow(1 - normDist, 1.5) * 2.6;
          const inwardSpeed = 1.45 * gravityStrength;
          const orbitLinearSpeed = 1.45 + (1 - normDist) * 3.1;

          const curAngle = Math.atan2(dz, dx);
          const nextDist = Math.max(0.24, dist - inwardSpeed * dt);
          const angularSpeed = orbitLinearSpeed / Math.max(0.35, nextDist);
          const nextAngle = curAngle + angularSpeed * dt;

          u.x = Math.max(1, Math.min(state.gridSize - 2, haz.x + Math.cos(nextAngle) * nextDist));
          u.z = Math.max(1, Math.min(state.gridSize - 2, haz.z + Math.sin(nextAngle) * nextDist));

          // Lift orbiting entities smoothly up into the accretion funnel
          const targetOrbitAlt = 0.85 + (1 - normDist) * 2.4;
          const curAlt = u.altitude ?? 0;
          u.altitude = curAlt + (targetOrbitAlt - curAlt) * Math.min(1, dt * 4.5);
          u.vzVertical = 0;

          if (dist <= captureRadius) {
            u.targetX = haz.x;
            u.targetZ = haz.z;
            u.state = 'moving';
          }

          // Continuous gravitational tidal DOT across the active vortex
          const dotRate = 28 + (1 - normDist) * 52;
          u.hp = Math.max(0, u.hp - dotRate * dt);
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.45;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          }
        }
      }

      // Final Collapse & Supernova Explosion when Black Hole timer reaches 0
      if (haz.remaining <= 0 && !haz.exploded) {
        haz.exploded = true;
        const cTile = getTile(state, Math.round(haz.x), Math.round(haz.z));
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'blackhole_explosion',
          x: haz.x,
          y: cTile ? cTile.height * 0.45 : 1.0,
          z: haz.z,
          radius: haz.radius * 1.45,
          color: '#e0aaff',
          createdAt: Date.now(),
        });
        for (const b of state.buildings) {
          const dSq = (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2;
          if (dSq <= (haz.radius * 1.05) ** 2 && b.shieldTimer <= 0) {
            b.hp = 0;
          }
        }
        for (const v of state.vehicles ?? []) {
          const dSq = (v.x - haz.x) ** 2 + (v.z - haz.z) ** 2;
          if (dSq <= (haz.radius * 1.45) ** 2) {
            v.hp = 0;
          }
        }
        forEachTileInRadius(state, haz.x, haz.z, haz.radius * 0.82, (t, dSq) => {
          if (t.buildingId) return;
          if (t.height === 0) {
            damageOrBleachWaterTile(t, 400, true);
            return;
          }
          if (t.height >= 2) t.height = Math.max(1, t.height - 1);
          t.terrain = dSq <= 6.0 ? 'scorched' : 'crystal_field';
          if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          }
        });
        // Fling all trapped / orbiting entities violently outward to random places across the map with high fall damage!
        for (let ui = 0; ui < state.units.length; ui++) {
          const u = state.units[ui];
          if (u.statusEffects.shielded || u.draggedByPlayer) continue;
          const dist = Math.hypot(u.x - haz.x, u.z - haz.z);
          if (dist <= haz.radius * 2.15) {
            const seed = Math.abs((u.appearanceSeed ?? ui * 131) + Math.round(haz.x * 17 + ui * 37));
            const scatterAngle = ((seed % 360) / 360) * Math.PI * 2 + Math.random() * 0.45;
            const flingSpeed = 12 + (seed % 14) + Math.random() * 6;
            u.vxAir = Math.cos(scatterAngle) * flingSpeed;
            u.vzAir = Math.sin(scatterAngle) * flingSpeed;
            u.altitude = Math.max(2.6, u.altitude ?? 2.6);
            u.vzVertical = 12.5 + Math.random() * 5.5;
            u.fallDamageArmed = true;
          }
        }
        addChronicle(state, 'The Black Hole exploded, knocking nearby units outward!', 'warning');
      }
    }

    // Roaming Cyclone Vortex (tornado_vortex / super_tornado): wanders across land/water, lifts, spins & flings units + shreds buildings
    if (haz.kind === 'tornado_vortex') {
      const isSuper = Boolean(haz.isSuper);
      const steer = Math.sin((haz.duration - haz.remaining) * (isSuper ? 1.85 : 1.45) + haz.x * 0.3) * 0.85;
      haz.heading = (haz.heading ?? 0) + steer * dt;
      const moveSpd = isSuper ? 6.9 : 4.6;
      haz.x += Math.cos(haz.heading) * moveSpd * dt;
      haz.z += Math.sin(haz.heading) * moveSpd * dt;
      if (haz.x < 4 || haz.x > state.gridSize - 5) {
        haz.heading = Math.PI - haz.heading;
        haz.x = Math.max(4, Math.min(state.gridSize - 5, haz.x));
      }
      if (haz.z < 4 || haz.z > state.gridSize - 5) {
        haz.heading = -haz.heading;
        haz.z = Math.max(4, Math.min(state.gridSize - 5, haz.z));
      }

      if (
        state.activeWorldEvent &&
        state.activeWorldEvent.linkedHazardId === haz.id &&
        state.activeWorldEvent.remaining > 0
      ) {
        const ht = getTile(state, Math.round(haz.x), Math.round(haz.z));
        state.activeWorldEvent.trackX = haz.x;
        state.activeWorldEvent.trackY = (ht?.height ?? 2) * 0.45 + 2.5;
        state.activeWorldEvent.trackZ = haz.z;
      }

      // Super tornadoes leave a torn path through terrain, trees & roads
      if (isSuper) {
        const swathR = Math.ceil(haz.radius * 0.62);
        const cx = Math.round(haz.x);
        const cz = Math.round(haz.z);
        for (let dz = -swathR; dz <= swathR; dz++) {
          for (let dx = -swathR; dx <= swathR; dx++) {
            if (dx * dx + dz * dz > (haz.radius * 0.62) ** 2) continue;
            const st = getTile(state, cx + dx, cz + dz);
            if (!st || st.height <= 0 || st.buildingId) continue;
            if (st.resourceNode === 'berry_bush' || st.resourceNode === 'timber_grove') {
              st.resourceNode = 'none';
              st.resourceAmount = 0;
            }
            if (
              (st.terrain === 'grass' || st.terrain === 'fertile' || st.terrain === 'forest' || st.terrain === 'stone_road') &&
              Math.random() < dt * 2.4
            ) {
              st.terrain = 'rock';
            }
          }
        }
      }

      const funnelPullR = haz.radius * (isSuper ? 1.72 : 1.5);
      for (const b of state.buildings) {
        const dSq = (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2;
        if (dSq <= (haz.radius * (isSuper ? 1.02 : 0.88)) ** 2 && b.shieldTimer <= 0) {
          b.hp = Math.max(0, b.hp - (isSuper ? 265 : 140) * dt);
        }
      }
      for (const v of state.vehicles ?? []) {
        const dist = Math.hypot(v.x - haz.x, v.z - haz.z);
        if (dist <= funnelPullR) {
          v.hp = Math.max(0, (v.hp ?? 100) - (isSuper ? 240 : 145) * dt);
        }
      }
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded || u.draggedByPlayer) continue;
        const dx = u.x - haz.x;
        const dz = u.z - haz.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= funnelPullR) {
          const normDist = Math.min(1, dist / funnelPullR);
          const curAngle = Math.atan2(dz, dx);
          const nextDist = Math.max(0.55, dist - (isSuper ? 5.0 : 3.6) * (1 - normDist * 0.4) * dt);
          const nextAngle = curAngle + ((isSuper ? 6.8 : 5.2) + (1 - normDist) * 4.5) * dt;
          u.x = Math.max(1, Math.min(state.gridSize - 2, haz.x + Math.cos(nextAngle) * nextDist));
          u.z = Math.max(1, Math.min(state.gridSize - 2, haz.z + Math.sin(nextAngle) * nextDist));
          u.altitude = Math.min(isSuper ? 7.5 : 5.0, (u.altitude ?? 0) + ((isSuper ? 6.2 : 4.2) - normDist * 2.0) * dt);
          u.vzVertical = 0;
          u.fallDamageArmed = (u.altitude ?? 0) >= 1.6;
          const cycloneDot = (isSuper ? 64 : 36) + (1 - normDist) * (isSuper ? 74 : 48);
          u.hp = Math.max(0, u.hp - cycloneDot * dt);
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.45;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          } else if (dist <= (isSuper ? 1.8 : 1.35) && Math.random() < dt * (isSuper ? 2.8 : 2.2)) {
            // Eject unit violently upward & outward from the top of the funnel!
            const ejectAngle = nextAngle + 0.5;
            const ejectSpd = isSuper ? 14 + Math.random() * 8 : 10 + Math.random() * 6;
            u.vxAir = Math.cos(ejectAngle) * ejectSpd;
            u.vzAir = Math.sin(ejectAngle) * ejectSpd;
            u.altitude = Math.max(isSuper ? 5.2 : 3.4, u.altitude ?? 3.4);
            u.vzVertical = (isSuper ? 13.5 : 9.5) + Math.random() * 4.0;
            u.fallDamageArmed = true;
          }
          // Apply tornado's absorbed elemental affinity to lifted units
          if (haz.elementAffinity === 'fire') {
            u.hp = Math.max(0, u.hp - 22 * dt);
          } else if (haz.elementAffinity === 'poison') {
            u.statusEffects.plagued = Math.max(u.statusEffects.plagued ?? 0, 10);
          } else if (haz.elementAffinity === 'ice') {
            u.statusEffects.frozen = Math.max(u.statusEffects.frozen ?? 0, 5);
          }
        }
      }

      // Environmental Affinity: tornado absorbs fire, poison, ice, water, or sand as it roams!
      const coreX = Math.round(haz.x);
      const coreZ = Math.round(haz.z);
      let fireHits = 0;
      let poisonHits = 0;
      let iceHits = 0;
      let waterHits = 0;
      let sandHits = 0;
      forEachTileInBounds(state, coreX - 2, coreX + 2, coreZ - 2, coreZ + 2, (st) => {
        if (st.onFireTimer > 0 || st.waterKind === 'lava' || st.terrain === 'volcanic_wasteland') fireHits++;
        else if (st.waterKind === 'poison' || st.terrain === 'blighted_mire' || st.terrain === 'swamp') poisonHits++;
        else if (st.terrain === 'snow' || st.terrain === 'ice') iceHits++;
        else if (st.height === 0 && !st.waterKind) waterHits++;
        else if (st.terrain === 'sand') sandHits++;
      });
      const prevAffinity = haz.elementAffinity ?? 'none';
      let nextAffinity = prevAffinity;
      if (fireHits >= 1) nextAffinity = 'fire';
      else if (poisonHits >= 2 && prevAffinity !== 'fire') nextAffinity = 'poison';
      else if (iceHits >= 3 && prevAffinity === 'none') nextAffinity = 'ice';
      else if (waterHits >= 4 && (prevAffinity === 'none' || prevAffinity === 'fire')) {
        // Crossing deep water cools a Firenado into a Waterspout!
        nextAffinity = 'water';
      } else if (sandHits >= 4 && prevAffinity === 'none') nextAffinity = 'sand';

      if (nextAffinity !== prevAffinity) {
        haz.elementAffinity = nextAffinity;
        const label =
          nextAffinity === 'fire'
            ? 'a raging Firestorm'
            : nextAffinity === 'poison'
              ? 'a Toxic Cyclone'
              : nextAffinity === 'ice'
                ? 'a Blizzard Vortex'
                : nextAffinity === 'water'
                  ? 'a surging Waterspout'
                  : 'a blinding Sandstorm';
        addChronicle(state, `The Tornado absorbed the surrounding terrain and transformed into ${label}!`, 'warning');
      }

      // Elemental trail effects as the infused tornado roams
      const aff = haz.elementAffinity ?? 'none';
      if (aff !== 'none') {
        const trailR = Math.max(2, Math.round(haz.radius * 0.58));
        forEachTileInBounds(state, coreX - trailR, coreX + trailR, coreZ - trailR, coreZ + trailR, (st) => {
          if ((st.x - haz.x) ** 2 + (st.z - haz.z) ** 2 > trailR * trailR) return;
          if (aff === 'fire') {
            if (st.height > 0 && st.blessedTimer <= 0 && Math.random() < dt * 3.5) {
              st.onFireTimer = Math.max(st.onFireTimer, 6.5);
              st.tempOffset = Math.min(80, (st.tempOffset ?? 0) + 12);
            } else if (st.height === 0 && st.terrain === 'ice') {
              st.terrain = st.frozenWaterBase ?? 'shallow_water';
              delete st.frozenWaterBase;
            }
          } else if (aff === 'poison') {
            if (st.height > 0 && !st.buildingId && st.blessedTimer <= 0 && POISON_CORRUPTIBLE_SOILS.has(st.terrain) && Math.random() < dt * 2.8) {
              st.terrain = 'blighted_mire';
              st.farmSettlementId = undefined;
            } else if (st.height === 0 && !st.waterKind && st.terrain === 'shallow_water' && Math.random() < dt * 1.8) {
              st.waterKind = 'poison';
              specialLiquidPossibleByState.set(state, true);
            }
          } else if (aff === 'ice') {
            st.onFireTimer = 0;
            st.tempOffset = Math.max(-50, (st.tempOffset ?? 0) - 18 * dt);
            if (st.height === 0 && st.terrain !== 'ice' && st.waterKind !== 'lava' && Math.random() < dt * 2.5) {
              st.frozenWaterBase = st.terrain === 'deep_water' ? 'deep_water' : 'shallow_water';
              st.terrain = 'ice';
            } else if (st.height > 0 && !st.buildingId && Math.random() < dt * 2.4) {
              st.terrain = 'snow';
            }
          } else if (aff === 'water') {
            st.onFireTimer = 0;
            if (st.height === 0 && st.waterKind === 'lava' && Math.random() < dt * 3.0) {
              st.height = 1;
              st.terrain = 'rock';
              delete st.waterKind;
            }
          } else if (aff === 'sand') {
            if (st.height > 0 && !st.buildingId && (st.terrain === 'grass' || st.terrain === 'fertile' || st.terrain === 'savanna') && Math.random() < dt * 2.2) {
              st.terrain = 'sand';
              st.farmSettlementId = undefined;
            }
          }
        });
      }

      // Emergent in-flight fusion: if two roaming tornadoes collide, merge them into a Mega Tornado!
      if (!haz.isSuper) {
        for (const other of state.activeHazards) {
          if (other.id !== haz.id && other.kind === 'tornado_vortex' && other.remaining > 0.2) {
            if ((other.x - haz.x) ** 2 + (other.z - haz.z) ** 2 <= 4.5 * 4.5) {
              other.isSuper = true;
              other.radius = Math.max(other.radius, 8.2);
              other.remaining = Math.max(other.remaining, 15.0);
              other.duration = Math.max(other.duration, 15.0);
              if (haz.elementAffinity && haz.elementAffinity !== 'none') {
                other.elementAffinity = haz.elementAffinity;
              }
              haz.remaining = 0;
              addChronicle(state, 'Two roaming tornadoes collided and merged into a colossal Mega Tornado!', 'warning');
              break;
            }
          }
        }
      }
    }

    // Drifting Corrosive Acid Cloud: erodes hill elevation, dissolves foliage, melts buildings & vehicles, and poisons water
    if (haz.kind === 'acid_cloud') {
      haz.x = Math.max(3, Math.min(state.gridSize - 4, haz.x + (haz.windX ?? 1.5) * dt));
      haz.z = Math.max(3, Math.min(state.gridSize - 4, haz.z + (haz.windZ ?? 0.8) * dt));
      haz.tickTimer -= dt;
      if (haz.tickTimer <= 0) {
        haz.tickTimer = 0.32;
        const cr = haz.radius;
        const crSq = cr * cr;
        forEachTileInBounds(state, haz.x - cr, haz.x + cr, haz.z - cr, haz.z + cr, (st) => {
          const dSq = (st.x - haz.x) ** 2 + (st.z - haz.z) ** 2;
          if (dSq > crSq || Math.random() > 0.35) return;
          if (st.height === 0) {
            if (st.waterKind === 'lava') {
              // Acid rain on lava triggers corrosion!
              st.terrain = 'scorched';
              delete st.waterKind;
              st.cursedTimer = Math.max(st.cursedTimer, 10);
            } else if (!st.waterKind && st.terrain === 'shallow_water') {
              st.waterKind = 'poison';
              specialLiquidPossibleByState.set(state, true);
            }
          } else {
            if (st.resourceNode === 'timber_grove' || st.resourceNode === 'berry_bush') {
              st.resourceNode = 'none';
              st.resourceAmount = 0;
              delete st.treeBiomeOverride;
            }
            if (!st.buildingId && st.height > 1 && dSq <= crSq * 0.32 && Math.random() < 0.35) {
              // Corrosive acid physically erodes hill elevation!
              st.height = Math.max(1, st.height - 1);
            }
            if (!st.buildingId && st.blessedTimer <= 0 && POISON_CORRUPTIBLE_SOILS.has(st.terrain)) {
              st.terrain = dSq <= crSq * 0.35 ? 'scorched' : 'blighted_mire';
              st.farmSettlementId = undefined;
            }
          }
        });
        for (const b of state.buildings) {
          if ((b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2 <= crSq && b.shieldTimer <= 0) {
            b.hp = Math.max(0, b.hp - Math.round(b.maxHp * 0.08));
          }
        }
        for (const u of state.units) {
          if (u.state === 'ko' || u.statusEffects.shielded) continue;
          if ((u.x - haz.x) ** 2 + (u.z - haz.z) ** 2 <= crSq) {
            u.hp = Math.max(0, u.hp - 12);
            u.statusEffects.plagued = Math.max(u.statusEffects.plagued ?? 0, 8);
          }
        }
      }
    }

    // Gradual Collapsing Sinkhole: pulls units inward while cracking rim tiles & collapsing ring-by-ring into deep water
    if (haz.kind === 'sinkhole_collapse') {
      const progress = Math.min(1, 1 - haz.remaining / Math.max(0.1, haz.duration));
      const maxR = haz.maxRadius ?? haz.radius;
      const prevR = haz.currentRadius ?? 0.5;
      const nextR = Math.max(0.6, maxR * Math.pow(progress, 0.78));
      haz.currentRadius = nextR;
      const pullR = nextR + 3.2;

      // Pull nearby units toward the collapsing pit rim
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded || FLYING_WILDLIFE_ROLES.has(u.role) || u.draggedByPlayer) continue;
        const dx = haz.x - u.x;
        const dz = haz.z - u.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.35 && dist <= pullR) {
          const pull = (1 - dist / pullR) * 4.2 * dt;
          u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + (dx / dist) * pull));
          u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + (dz / dist) * pull));
          if (dist <= nextR) {
            u.hp = Math.max(0, u.hp - 36 * dt);
            u.swimStamina = Math.min(u.swimStamina ?? 40, 18);
          }
        }
      }

      haz.tickTimer -= dt;
      if (haz.tickTimer <= 0 || nextR - prevR >= 0.4) {
        haz.tickTimer = 0.14;
        const innerR = Math.max(0.4, nextR * 0.72);
        const outerR = Math.min(maxR, nextR + 1.1);
        forEachTileInBounds(state, haz.x - outerR, haz.x + outerR, haz.z - outerR, haz.z + outerR, (st) => {
          const d = Math.hypot(st.x - haz.x, st.z - haz.z);
          if (d <= innerR) {
            if (st.height > 0 || st.terrain !== 'deep_water') {
              st.height = 0;
              st.terrain = d <= maxR * 0.52 ? 'deep_water' : 'shallow_water';
              delete st.waterKind;
              delete st.frozenWaterBase;
              st.resourceNode = 'none';
              st.resourceAmount = 0;
              st.onFireTimer = 0;
              st.farmSettlementId = undefined;
              clearBurntTreeState(st);
              delete st.treeBiomeOverride;
            }
          } else if (d <= outerR && st.height > 0) {
            // Cracking rim before it drops!
            st.height = Math.max(1, st.height - 1);
            if (!st.buildingId) st.terrain = 'rock';
          }
        });
        for (const b of state.buildings) {
          if (b.hp > 0 && b.shieldTimer <= 0 && (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2 <= innerR * innerR) {
            b.hp = 0;
          }
        }
      }
    }

    // Roaming Locust Swarm: actively hunts nearby farms, forests & city food stockpiles
    if (haz.kind === 'locust_swarm') {
      // Steer gently toward nearest farm/berry/forest tile or city building within 22 tiles
      let targetX: number | null = null;
      let targetZ: number | null = null;
      let bestDistSq = 22 * 22;
      for (const b of state.buildings) {
        if (b.hp <= 0) continue;
        const dSq = (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2;
        if (dSq > 4 && dSq < bestDistSq) {
          bestDistSq = dSq;
          targetX = b.tileX;
          targetZ = b.tileZ;
        }
      }
      if (targetX !== null && targetZ !== null) {
        const desired = Math.atan2(targetZ - haz.z, targetX - haz.x);
        const curH = haz.heading ?? 0;
        haz.heading = curH + wrapAngleRad(desired - curH) * Math.min(1, dt * 1.8);
      } else {
        haz.heading = (haz.heading ?? 0) + Math.sin((haz.duration - haz.remaining) * 2.1) * dt * 1.2;
      }
      const swarmSpd = 4.4;
      haz.x = Math.max(3, Math.min(state.gridSize - 4, haz.x + Math.cos(haz.heading ?? 0) * swarmSpd * dt));
      haz.z = Math.max(3, Math.min(state.gridSize - 4, haz.z + Math.sin(haz.heading ?? 0) * swarmSpd * dt));

      haz.tickTimer -= dt;
      if (haz.tickTimer <= 0) {
        haz.tickTimer = 0.25;
        const sr = haz.radius;
        const srSq = sr * sr;
        forEachTileInBounds(state, haz.x - sr, haz.x + sr, haz.z - sr, haz.z + sr, (st) => {
          if (st.height <= 0 || (st.x - haz.x) ** 2 + (st.z - haz.z) ** 2 > srSq) return;
          if (st.resourceNode === 'berry_bush' || st.resourceNode === 'timber_grove') {
            st.resourceNode = 'none';
            st.resourceAmount = 0;
            delete st.treeBiomeOverride;
          }
          if (st.farmSettlementId) {
            st.farmSettlementId = undefined;
          }
          if (!st.buildingId && (st.terrain === 'fertile' || st.terrain === 'floral_plains' || st.terrain === 'grass' || st.terrain === 'forest')) {
            st.terrain = 'savanna';
          }
        });
        const hitKid = findTargetedKingdomId(state, Math.round(haz.x), Math.round(haz.z), sr + 3);
        if (hitKid && state.kingdomResources?.[hitKid]) {
          state.kingdomResources[hitKid].food = Math.max(0, state.kingdomResources[hitKid].food - 14);
        }
        for (const u of state.units) {
          if (u.state === 'ko' || u.statusEffects.shielded) continue;
          if ((u.x - haz.x) ** 2 + (u.z - haz.z) ** 2 <= srSq) {
            u.hp = Math.max(0, u.hp - 5);
          }
        }
      }
    }

    // Tectonic Lava Fissure: Stage 1 tears open a jagged fault crack across the earth before Stage 2 unleashes pressurized magma eruptions!
    if (haz.kind === 'magma_geyser') {
      if (haz.heading === undefined) {
        haz.heading = (((Math.round(haz.x) * 19 + Math.round(haz.z) * 37) & 31) / 32) * Math.PI;
      }
      const progress = Math.min(1, 1 - haz.remaining / Math.max(0.1, haz.duration));
      const maxHalfLen = Math.max(6.5, (haz.maxRadius ?? haz.radius) * 1.25);
      const dirX = Math.cos(haz.heading);
      const dirZ = Math.sin(haz.heading);
      const perpX = -dirZ;
      const perpZ = dirX;

      const fissureCrackTile = (fx: number, fz: number, bankRadius: number, burstPower: number) => {
        const ft = getTile(state, fx, fz);
        if (ft && !ft.buildingId) {
          if (ft.height === 0 && ft.waterKind === 'poison') {
            ft.terrain = 'scorched';
            delete ft.waterKind;
            ft.cursedTimer = Math.max(ft.cursedTimer, 10);
          } else if (ft.height === 0 && !ft.waterKind && ft.terrain !== 'ice') {
            ft.height = 1;
            ft.terrain = 'rock';
          } else {
            ft.height = 0;
            ft.terrain = 'shallow_water';
            ft.waterKind = 'lava';
            ft.isRiver = true;
            ft.resourceNode = 'none';
            ft.resourceAmount = 0;
            ft.farmSettlementId = undefined;
            clearBurntTreeState(ft);
          }
        }
        // Scorch and ignite flanking banks along the crack
        for (let bDist = 1; bDist <= bankRadius; bDist++) {
          for (const bank of [-1, 1]) {
            const bx = Math.max(1, Math.min(state.gridSize - 2, Math.round(fx + perpX * bank * bDist)));
            const bz = Math.max(1, Math.min(state.gridSize - 2, Math.round(fz + perpZ * bank * bDist)));
            const bt = getTile(state, bx, bz);
            if (bt && bt.height > 0 && bt.blessedTimer <= 0) {
              if (burstPower >= 1 || bDist === 1) {
                bt.onFireTimer = Math.max(bt.onFireTimer, burstPower >= 1 ? 8.5 : 4.5);
              }
              bt.tempOffset = Math.min(80, (bt.tempOffset ?? 0) + (burstPower >= 1 ? 30 : 14));
              if (!bt.buildingId && (bt.terrain === 'grass' || bt.terrain === 'fertile' || bt.terrain === 'forest')) {
                bt.terrain = 'scorched';
              }
            }
          }
        }
      };

      haz.tickTimer -= dt;
      if (haz.tickTimer <= 0) {
        haz.tickTimer = 0.24;

        if (progress < 0.4) {
          // Stage 1: Tectonic ground cracking — jagged rift rips outward in both directions before eruption
          const splitFrac = Math.min(1, progress / 0.36);
          const curHalfLen = Math.max(1.0, maxHalfLen * splitFrac);
          haz.currentRadius = curHalfLen;

          for (const side of [-1, 1]) {
            const distAlong = side * curHalfLen;
            const normT = side * splitFrac;
            const jitter = Math.sin(normT * 9.5 + 0.7) * 0.65 + Math.cos(normT * 21) * 0.25;
            const fx = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + dirX * distAlong + perpX * jitter)));
            const fz = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + dirZ * distAlong + perpZ * jitter)));
            fissureCrackTile(fx, fz, 1, 0.4);

            for (const u of state.units) {
              if (u.state === 'ko' || u.statusEffects.shielded || u.role === 'dragon' || u.role === 'phoenix' || u.role === 'cerberus') continue;
              const dSq = (u.x - fx) ** 2 + (u.z - fz) ** 2;
              if (dSq <= 4.0) {
                u.hp = Math.max(0, u.hp - 8);
                const pushSign = (u.x - fx) * perpX + (u.z - fz) * perpZ >= 0 ? 1 : -1;
                u.vxAir = perpX * pushSign * 3.8;
                u.vzAir = perpZ * pushSign * 3.8;
                u.vzVertical = 2.6;
              }
            }
          }
          resolveLiquidReactionsAround(state, haz.x, haz.z, curHalfLen + 2);
        } else {
          // Stage 2: Pressurized Lava Eruption — massive rift burst followed by sustained magma plumes
          haz.currentRadius = maxHalfLen;
          if (!haz.exploded) {
            haz.exploded = true;
            const stepCount = Math.max(5, Math.round(maxHalfLen * 1.4));
            for (let si = 0; si <= stepCount; si++) {
              const normT = (si / stepCount) * 2 - 1;
              const distAlong = normT * maxHalfLen;
              const jitter = Math.sin(normT * 9.5 + 0.7) * 0.65 + Math.cos(normT * 21) * 0.25;
              const fx = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + dirX * distAlong + perpX * jitter)));
              const fz = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + dirZ * distAlong + perpZ * jitter)));
              fissureCrackTile(fx, fz, 2, 1.5);
              if (si % 2 === 0 && state.pendingVfx.length < 48) {
                state.pendingVfx.push({
                  id: nextEntityId('vfx'),
                  type: 'fire_spread',
                  originX: haz.x,
                  originY: 0.9,
                  originZ: haz.z,
                  x: fx,
                  y: 0.85,
                  z: fz,
                  radius: 1.9,
                  color: '#ff5400',
                  createdAt: Date.now(),
                });
              }
            }
            for (const u of state.units) {
              if (u.state === 'ko' || u.statusEffects.shielded || u.role === 'dragon' || u.role === 'phoenix' || u.role === 'cerberus') continue;
              const rx = u.x - haz.x;
              const rz = u.z - haz.z;
              const alongProj = rx * dirX + rz * dirZ;
              const perpDist = rx * perpX + rz * perpZ;
              if (Math.abs(alongProj) <= maxHalfLen + 1.5 && Math.abs(perpDist) <= 3.2) {
                u.hp = Math.max(0, u.hp - 34);
                const pushSign = perpDist >= 0 ? 1 : -1;
                u.vxAir = perpX * pushSign * 8.5;
                u.vzAir = perpZ * pushSign * 8.5;
                u.vzVertical = 7.5;
              }
            }
          } else if (progress <= 0.88) {
            // Sustained eruption pulses along staggered vents
            const ventFracs = [-0.65, 0, 0.65];
            for (let vi = 0; vi < ventFracs.length; vi++) {
              const normT = ventFracs[vi];
              const distAlong = normT * maxHalfLen;
              const jitter = Math.sin(normT * 9.5 + 0.7) * 0.65 + Math.cos(normT * 21) * 0.25;
              const fx = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + dirX * distAlong + perpX * jitter)));
              const fz = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + dirZ * distAlong + perpZ * jitter)));
              fissureCrackTile(fx, fz, 1, 1.0);
              for (const u of state.units) {
                if (u.state === 'ko' || u.statusEffects.shielded || u.role === 'dragon' || u.role === 'phoenix' || u.role === 'cerberus') continue;
                const dSq = (u.x - fx) ** 2 + (u.z - fz) ** 2;
                if (dSq <= 6.25) {
                  u.hp = Math.max(0, u.hp - 22);
                  const pushSign = (u.x - fx) * perpX + (u.z - fz) * perpZ >= 0 ? 1 : -1;
                  u.vxAir = perpX * pushSign * 7.2;
                  u.vzAir = perpZ * pushSign * 7.2;
                  u.vzVertical = 5.4;
                }
              }
            }
          }
          resolveLiquidReactionsAround(state, haz.x, haz.z, maxHalfLen + 2);
        }
      }
    }

    // Eye of Judgment: colossal hovering eye that tracks and blasts ANY unit or structure in range with searing laser beams
    if (haz.kind === 'sentinel_eye') {
      haz.beamFireTimer = Math.max(0, (haz.beamFireTimer ?? 0) - dt);
      haz.tickTimer -= dt;
      if (haz.tickTimer <= 0) {
        haz.tickTimer = 0.42;
        const scanR = haz.radius;
        const scanRSq = scanR * scanR;

        // Target the nearest living unit (any faction/species!) in range
        let bestUnit: UnitEntity | null = null;
        let bestDistSq = scanRSq;
        for (const u of state.units) {
          if (u.state === 'ko') continue;
          const dSq = (u.x - haz.x) ** 2 + (u.z - haz.z) ** 2;
          if (dSq <= bestDistSq) {
            bestDistSq = dSq;
            bestUnit = u;
          }
        }

        let aimX: number | undefined;
        let aimZ: number | undefined;
        let aimBld: BuildingEntity | null = null;
        if (bestUnit) {
          aimX = bestUnit.x;
          aimZ = bestUnit.z;
        } else {
          // If no living unit is in sight, vaporize nearby structures!
          let bestBldDistSq = scanRSq;
          for (const b of state.buildings) {
            if (b.hp <= 0) continue;
            const dSq = (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2;
            if (dSq <= bestBldDistSq) {
              bestBldDistSq = dSq;
              aimBld = b;
            }
          }
          if (aimBld) {
            aimX = aimBld.tileX;
            aimZ = aimBld.tileZ;
          }
        }

        if (aimX !== undefined && aimZ !== undefined) {
          haz.beamTargetX = aimX;
          haz.beamTargetZ = aimZ;
          haz.beamFireTimer = 0.34;
          haz.eyeYaw = Math.atan2(aimZ - haz.z, aimX - haz.x);

          // Direct hit + tight splash damage on any units near the laser strike
          const splashRSq = 1.65 * 1.65;
          for (const u of state.units) {
            if (u.state === 'ko' || u.statusEffects.shielded) continue;
            const dSq = (u.x - aimX) ** 2 + (u.z - aimZ) ** 2;
            if (u === bestUnit || dSq <= splashRSq) {
              const dmg = u === bestUnit ? 48 : 26;
              u.hp = Math.max(0, u.hp - dmg);
              const kdx = u.x - haz.x;
              const kdz = u.z - haz.z;
              const kLen = Math.max(0.25, Math.hypot(kdx, kdz));
              u.vxAir = (kdx / kLen) * 4.5;
              u.vzAir = (kdz / kLen) * 4.5;
              u.vzVertical = Math.max(u.vzVertical ?? 0, 2.8);
            }
          }

          // Damage targeted or splash buildings
          for (const b of state.buildings) {
            if (b.hp <= 0 || b.shieldTimer > 0) continue;
            const dSq = (b.tileX - aimX) ** 2 + (b.tileZ - aimZ) ** 2;
            if (b === aimBld || dSq <= splashRSq) {
              b.hp = Math.max(0, b.hp - Math.max(38, Math.round(b.maxHp * 0.14)));
            }
          }

          // Bounded scorch around impact point (strictly O(1) tiles via forEachTileInBounds)
          forEachTileInBounds(state, aimX - 1.3, aimX + 1.3, aimZ - 1.3, aimZ + 1.3, (st) => {
            if ((st.x - aimX!) ** 2 + (st.z - aimZ!) ** 2 > 1.75) return;
            if (st.height > 0 && st.blessedTimer <= 0) {
              st.onFireTimer = Math.max(st.onFireTimer, 4.5);
              st.tempOffset = Math.min(75, (st.tempOffset ?? 0) + 18);
              if (!st.buildingId && (st.terrain === 'grass' || st.terrain === 'fertile' || st.terrain === 'forest')) {
                st.terrain = 'scorched';
              }
            }
          });

          // Emit blazing laser_beam VFX from eye pupil down to target
          if (state.pendingVfx.length < 48) {
            const originTile = getTile(state, Math.round(haz.x), Math.round(haz.z));
            const targetTile = getTile(state, Math.round(aimX), Math.round(aimZ));
            const originGroundY = originTile ? Math.max(0.4, originTile.height * 0.45) : 0.6;
            const targetGroundY = targetTile ? Math.max(0.4, targetTile.height * 0.45) : 0.6;
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'projectile_tracer',
              vfxSubtype: 'laser_beam',
              originX: haz.x,
              originY: originGroundY + 5.2,
              originZ: haz.z,
              x: aimX,
              y: targetGroundY + 0.35,
              z: aimZ,
              radius: 2.35,
              color: '#ff4500',
              flightDuration: 0.28,
              createdAt: Date.now(),
            });
          }
        } else {
          // Idle sweeping gaze across the horizon
          haz.eyeYaw = (haz.eyeYaw ?? 0) + 0.72;
        }
      }
    }

    // 3-Phase Purify Sky Beam: Phase 1 (0–18%) sky descent, Phase 2 (18–78%) expanding light pillar & cleansing, Phase 3 (78–100%) skyward ascension
    if (haz.kind === 'purify_wave') {
      const progress = Math.min(1, 1 - haz.remaining / Math.max(0.1, haz.duration));
      const maxR = haz.maxRadius ?? haz.radius;
      const prevR = haz.currentRadius ?? 0.45;
      if (progress < 0.18) {
        // Beam still descending from the sky
        haz.currentRadius = 0.45;
      } else if (progress <= 0.78) {
        const expandP = (progress - 0.18) / 0.6;
        const nextR = Math.max(0.65, maxR * expandP);
        haz.currentRadius = nextR;
        const minRSq = Math.max(0, prevR - 0.6) ** 2;
        const maxRSq = nextR * nextR;

        forEachTileInBounds(state, haz.x - nextR, haz.x + nextR, haz.z - nextR, haz.z + nextR, (st) => {
          const dSq = (st.x - haz.x) ** 2 + (st.z - haz.z) ** 2;
          if (dSq > maxRSq || dSq < minRSq) return;
          st.onFireTimer = 0;
          st.cursedTimer = 0;
          st.blessedTimer = Math.max(st.blessedTimer, 14);
          clearBurntTreeState(st);
          if (st.height === 0) {
            if (st.waterKind === 'lava') {
              st.height = 1;
              st.terrain = 'rock';
              delete st.waterKind;
            } else if (st.waterKind === 'poison') {
              delete st.waterKind;
            }
          } else if (
            st.terrain === 'blighted_mire' ||
            st.terrain === 'volcanic_wasteland' ||
            st.terrain === 'scorched' ||
            st.terrain === 'void_goo'
          ) {
            st.terrain = 'grass';
          }
        });
        for (const u of state.units) {
          if (u.state === 'ko') continue;
          const dSq = (u.x - haz.x) ** 2 + (u.z - haz.z) ** 2;
          if (dSq <= maxRSq && dSq >= minRSq) {
            delete u.statusEffects.plagued;
            delete u.statusEffects.cursed;
            delete u.statusEffects.frozen;
            u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * 0.25));
          }
        }
      } else {
        // Phase 3: Beam contracts and retracts back up into the sky
        const retractP = (progress - 0.78) / 0.22;
        haz.currentRadius = Math.max(0.35, maxR * (1 - retractP * 0.88));
      }
    }

    // Gradually spreading Biome Bloom Wave (Floral Blossom, Blight Plague, Lava Deluge): creeps outward tile-by-tile
    if (haz.kind === 'biome_bloom_wave') {
      const bKind = haz.biomeWaveKind ?? 'floral';
      const progress = Math.min(1, 1 - haz.remaining / Math.max(0.1, haz.duration));
      const maxR = haz.maxRadius ?? haz.radius;
      const prevR = haz.currentRadius ?? 0.7;
      const nextR = Math.max(0.7, maxR * progress);
      haz.currentRadius = nextR;
      const minRSq = Math.max(0, prevR - 0.55) ** 2;
      const maxRSq = nextR * nextR;
      const rCos = Math.cos(haz.heading ?? 0);
      const rSin = Math.sin(haz.heading ?? 0);

      forEachTileInBounds(state, haz.x - nextR, haz.x + nextR, haz.z - nextR, haz.z + nextR, (st) => {
        const dx = st.x - haz.x;
        const dz = st.z - haz.z;
        const dSq = dx * dx + dz * dz;
        if (dSq > maxRSq || dSq < minRSq) return;
        // Organic ragged creeping edge
        const edgeJitter = Math.sin(st.x * 1.3 + st.z * 0.9) * 0.45;
        if (Math.sqrt(dSq) + edgeJitter > maxR) return;

        if (bKind === 'floral') {
          st.onFireTimer = 0;
          st.cursedTimer = 0;
          st.blessedTimer = Math.max(st.blessedTimer, 30);
          clearBurntTreeState(st);
          if (st.height === 0) {
            st.terrain = 'shallow_water';
            st.waterKind = 'floral';
            delete st.frozenWaterBase;
            delete st.coralBleachTimer;
          } else if (!st.buildingId) {
            st.terrain = 'floral_plains';
            delete st.treeBiomeOverride;
            const hRoll = Math.abs((st.x * 7 + st.z * 13) % 8);
            if (hRoll <= 2) {
              st.resourceNode = 'timber_grove';
              st.resourceAmount = 280;
            } else if (hRoll <= 4) {
              st.resourceNode = 'berry_bush';
              st.resourceAmount = 250;
            } else if (hRoll === 5) {
              st.resourceNode = 'stone_outcrop';
              st.resourceAmount = 260;
            }
          }
        } else if (bKind === 'blight') {
          st.blessedTimer = 0;
          st.onFireTimer = 0;
          const along = dx * rCos + dz * rSin;
          const perp = -dx * rSin + dz * rCos + Math.sin(along * 0.65) * 0.75;
          const isPoisonLake = dSq <= 2.4;
          const isPoisonStream = Math.abs(perp) <= 0.72 && dSq <= maxR * maxR * 0.82;
          if (!st.buildingId && (st.height === 0 || isPoisonLake || isPoisonStream)) {
            if (st.height === 0 && st.waterKind === 'lava') {
              st.terrain = 'scorched';
              delete st.waterKind;
              st.cursedTimer = Math.max(st.cursedTimer, 10);
            } else {
              st.height = 0;
              st.terrain = 'shallow_water';
              st.waterKind = 'poison';
              st.isLake = isPoisonLake || undefined;
              st.isRiver = !isPoisonLake || undefined;
              st.resourceNode = 'none';
              st.resourceAmount = 0;
              st.farmSettlementId = undefined;
              clearBurntTreeState(st);
              delete st.treeBiomeOverride;
            }
          } else if (st.height > 0 && !st.buildingId) {
            st.terrain = 'blighted_mire';
            st.farmSettlementId = undefined;
            clearBurntTreeState(st);
            delete st.treeBiomeOverride;
            const hRoll = Math.abs((st.x * 11 + st.z * 17) % 7);
            if (hRoll <= 2) {
              st.resourceNode = 'timber_grove';
              st.resourceAmount = 220;
            } else if (hRoll === 3) {
              st.resourceNode = 'stone_outcrop';
              st.resourceAmount = 260;
            } else if (st.resourceNode === 'berry_bush') {
              st.resourceNode = 'none';
              st.resourceAmount = 0;
            }
          }
        } else {
          // 'lava'
          st.blessedTimer = 0;
          st.tempOffset = Math.min(80, Math.max(st.tempOffset ?? 0, 36));
          const along = dx * rCos + dz * rSin;
          const perp = -dx * rSin + dz * rCos + Math.sin(along * 0.7) * 0.75;
          const isLavaLake = dSq <= 2.25;
          const isLavaStream = Math.abs(perp) <= 0.72 && dSq <= maxR * maxR * 0.85;
          if (!st.buildingId && (isLavaLake || isLavaStream || st.height === 0)) {
            if (st.height === 0 && st.waterKind === 'poison') {
              st.terrain = 'scorched';
              delete st.waterKind;
              st.cursedTimer = Math.max(st.cursedTimer, 10);
            } else if (st.height === 0 && !st.waterKind && st.terrain !== 'ice') {
              st.height = 1;
              st.terrain = 'rock';
            } else {
              st.height = 0;
              st.terrain = 'shallow_water';
              st.waterKind = 'lava';
              st.isLake = isLavaLake || undefined;
              st.isRiver = !isLavaLake || undefined;
              st.resourceNode = 'none';
              st.resourceAmount = 0;
              st.farmSettlementId = undefined;
              clearBurntTreeState(st);
              delete st.treeBiomeOverride;
            }
          } else if (st.height > 0 && !st.buildingId) {
            st.terrain = 'volcanic_wasteland';
            st.onFireTimer = Math.max(st.onFireTimer, 5.0);
            st.farmSettlementId = undefined;
            clearBurntTreeState(st);
            delete st.treeBiomeOverride;
            const hRoll = Math.abs((st.x * 13 + st.z * 23) % 7);
            if (hRoll <= 1) {
              st.resourceNode = 'timber_grove';
              st.resourceAmount = 240;
            } else if (hRoll === 2) {
              st.resourceNode = 'ore_vein';
              st.resourceAmount = 360;
            } else if (hRoll === 3) {
              st.resourceNode = 'stone_outcrop';
              st.resourceAmount = 300;
            } else if (st.resourceNode === 'berry_bush') {
              st.resourceNode = 'none';
              st.resourceAmount = 0;
            }
          }
        }
      });

      // Affect units & buildings as the wave front reaches them
      for (const u of state.units) {
        if (u.state === 'ko') continue;
        const dSq = (u.x - haz.x) ** 2 + (u.z - haz.z) ** 2;
        if (dSq > maxRSq || dSq < minRSq) continue;
        if (bKind === 'floral' && u.faction !== 'hostile') {
          u.hp = u.maxHp;
          u.statusEffects.blessed = 25;
          delete u.statusEffects.cursed;
          delete u.statusEffects.plagued;
        } else if (bKind === 'blight' && !u.statusEffects.shielded && u.role !== 'giant_spider') {
          u.statusEffects.plagued = 16;
          u.statusEffects.cursed = 12;
        } else if (bKind === 'lava' && !u.statusEffects.shielded && u.role !== 'dragon' && u.role !== 'phoenix' && u.role !== 'cerberus') {
          u.hp = Math.max(0, u.hp - 120);
        }
      }
      for (const b of state.buildings) {
        const dSq = (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2;
        if (dSq > maxRSq || dSq < minRSq) continue;
        if (bKind === 'floral') {
          b.hp = b.maxHp;
          b.blessedTimer = 25;
          b.cursedTimer = 0;
        } else if (bKind === 'lava' && b.shieldTimer <= 0) {
          b.hp = Math.max(0, b.hp - 220);
        }
      }

      // When wave reaches midpoint, spawn signature biome wildlife once
      if (!haz.exploded && progress >= 0.55) {
        haz.exploded = true;
        if (bKind === 'floral') {
          const floralAnimals: UnitRole[] =
            state.worldRules?.allowFantasy !== false ? ['deer', 'rabbit', 'unicorn'] : ['deer', 'rabbit', 'horse'];
          for (let i = 0; i < floralAnimals.length; i++) {
            const sx = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + (i - 1) * 2)));
            const sz = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + ((i % 2) * 2 - 1))));
            const st = getTile(state, sx, sz);
            if (st && st.height > 0 && !st.buildingId) spawnUnit(state, floralAnimals[i], sx, sz, true);
          }
        } else if (bKind === 'blight') {
          for (const [ox, oz] of [[2, 0], [-2, 1], [0, -2]]) {
            const sx = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + ox)));
            const sz = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + oz)));
            const st = getTile(state, sx, sz);
            if (st && st.height > 0 && !st.buildingId) spawnUnit(state, 'giant_spider', sx, sz, true);
          }
        }
        if (bKind === 'lava' || bKind === 'blight') {
          resolveLiquidReactionsAround(state, haz.x, haz.z, nextR + 1);
        }
      }
    }

    // Drifting Howling Blizzard Gale: moves across terrain blowing units sideways, freezing water & burying snow
    if (haz.kind === 'blizzard_gale') {
      const wx = haz.windX ?? 2.4;
      const wz = haz.windZ ?? 1.2;
      haz.x = Math.max(3, Math.min(state.gridSize - 4, haz.x + wx * dt));
      haz.z = Math.max(3, Math.min(state.gridSize - 4, haz.z + wz * dt));
      const br = haz.radius;
      const brSq = br * br;

      // Blow unshielded units sideways in the howling gale!
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded || u.draggedByPlayer) continue;
        if ((u.x - haz.x) ** 2 + (u.z - haz.z) ** 2 <= brSq) {
          u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + wx * 1.15 * dt));
          u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + wz * 1.15 * dt));
          u.statusEffects.frozen = Math.max(u.statusEffects.frozen ?? 0, 6);
          if (u.role !== 'yeti' && u.role !== 'polar_bear' && u.role !== 'penguin') {
            u.hp = Math.max(0, u.hp - 12 * dt);
          }
        }
      }

      haz.tickTimer -= dt;
      if (haz.tickTimer <= 0) {
        haz.tickTimer = 0.22;
        forEachTileInBounds(state, haz.x - br, haz.x + br, haz.z - br, haz.z + br, (st) => {
          if ((st.x - haz.x) ** 2 + (st.z - haz.z) ** 2 > brSq || Math.random() > 0.45) return;
          st.onFireTimer = 0;
          st.tempOffset = -45;
          if (st.height === 0) {
            if (st.terrain !== 'ice' && st.waterKind !== 'lava') {
              st.frozenWaterBase = st.terrain === 'deep_water' ? 'deep_water' : 'shallow_water';
              st.terrain = 'ice';
            }
          } else if (!st.buildingId) {
            st.terrain = 'snow';
            if (st.resourceNode === 'berry_bush') {
              st.resourceNode = 'none';
              st.resourceAmount = 0;
            }
          }
        });
      }
    }

    // Active Volcano Eruption: repeatedly hurls molten lava bombs onto surrounding tiles
    if (haz.kind === 'volcano_eruption') {
      haz.tickTimer -= dt;
      if (haz.tickTimer <= 0) {
        haz.tickTimer = 0.65;
        const bombCount = 1 + (Math.random() < 0.45 ? 1 : 0);
        for (let bi = 0; bi < bombCount; bi++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 2.4 + Math.random() * Math.max(4.5, haz.radius * 0.95);
          const bx = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + Math.cos(ang) * dist)));
          const bz = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + Math.sin(ang) * dist)));
          const bt = getTile(state, bx, bz);
          const calderaTile = getTile(state, Math.round(haz.x), Math.round(haz.z));
          const originY = (calderaTile?.height ?? 5) * 0.45 + 1.0;
          const destY = (bt?.height ?? 1) * 0.45 + 0.2;
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'volcanic_lava_bomb',
            x: bx,
            y: destY,
            z: bz,
            originX: haz.x,
            originY,
            originZ: haz.z,
            radius: 2.3,
            color: '#ff5400',
            createdAt: Date.now(),
          });
          if (bt && bt.height > 0) {
            if (!bt.buildingId) {
              bt.terrain = 'scorched';
              if (bt.resourceNode === 'berry_bush' || bt.resourceNode === 'timber_grove') {
                bt.resourceNode = 'none';
                bt.resourceAmount = 0;
              }
            }
            bt.onFireTimer = Math.max(bt.onFireTimer, 8.5);
          } else if (bt && bt.height === 0) {
            damageOrBleachWaterTile(bt, 160, false);
          }
          for (const b of state.buildings) {
            if (b.shieldTimer <= 0 && (b.tileX - bx) ** 2 + (b.tileZ - bz) ** 2 <= 4.5) {
              b.hp = Math.max(0, b.hp - 125);
            }
          }
          for (const u of state.units) {
            if (u.state !== 'ko' && !u.statusEffects.shielded && (u.x - bx) ** 2 + (u.z - bz) ** 2 <= 4.5) {
              u.hp = Math.max(0, u.hp - 135);
              if (u.hp <= 0) {
                u.state = 'ko';
                u.koTimer = 0.45;
                if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
              }
            }
          }
        }
      }
    }

    // Continuous radial expansion & coastal sweep for Tsunami waves (Asteroid water impact OR direct Tsunami power)
    if (haz.kind === 'tsunami_wave') {
      const progress = Math.max(0, Math.min(1, 1 - haz.remaining / Math.max(0.1, haz.duration)));
      const maxR = haz.maxRadius ?? haz.radius * 3.8;
      const prevR = haz.currentRadius ?? 1.0;
      const nextR = 1.0 + (maxR - 1.0) * (1 - Math.pow(1 - progress, 1.65));
      haz.currentRadius = nextR;

      const innerBandSq = Math.max(0, prevR - 1.8) ** 2;

      forEachTileInRadius(state, haz.x, haz.z, nextR + 0.9, (t, dSq) => {
        if (dSq >= innerBandSq) {
          t.onFireTimer = 0;
          t.cursedTimer = 0;
          if (t.height === 0) {
            damageOrBleachWaterTile(t, 260, dSq <= (haz.radius * 1.85) ** 2);
            if (t.terrain === 'ice') {
              t.terrain = t.frozenWaterBase ?? 'shallow_water';
              delete t.frozenWaterBase;
            }
            if (!t.isRiver && !t.isLake && dSq <= (haz.radius * 1.15) ** 2 && t.terrain !== 'stone_road' && t.terrain !== 'rail_track') {
              t.terrain = 'deep_water';
            }
          } else if (t.height === 1) {
            if (!t.buildingId && dSq <= (haz.radius * 1.65) ** 2) {
              t.height = 0;
              t.terrain = 'shallow_water';
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            } else if (!t.buildingId && dSq <= (haz.radius * 2.35) ** 2 && ((t.x * 13 + t.z * 7) & 3) === 0) {
              t.height = 0;
              t.terrain = 'shallow_water';
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            } else {
              if (t.terrain !== 'rock' && t.terrain !== 'mountain' && t.terrain !== 'snow' && t.terrain !== 'crystal_field') {
                t.terrain = dSq <= (haz.radius * 2.55) ** 2 ? 'sand' : 'swamp';
              }
              if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            }
          } else if (t.height === 2) {
            if (!t.buildingId && dSq <= (haz.radius * 1.25) ** 2) {
              t.height = 1;
              t.terrain = 'sand';
              if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            } else if (dSq <= (maxR * 0.9) ** 2) {
              if (
                t.terrain === 'grass' ||
                t.terrain === 'fertile' ||
                t.terrain === 'forest' ||
                t.terrain === 'savanna' ||
                t.terrain === 'jungle' ||
                t.terrain === 'blossom' ||
                t.terrain === 'taiga' ||
                t.terrain === 'scorched' ||
                t.terrain === 'stone_road'
              ) {
                t.terrain = dSq <= (haz.radius * 1.8) ** 2 && ((t.x + t.z) & 1) === 0 ? 'sand' : 'swamp';
              }
              if (
                t.resourceNode === 'berry_bush' ||
                (t.resourceNode === 'timber_grove' && dSq <= (haz.radius * 2.45) ** 2)
              ) {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            }
          } else if (t.height === 3 && dSq <= (maxR * 0.68) ** 2) {
            if (
              t.terrain === 'scorched' ||
              t.terrain === 'savanna' ||
              t.terrain === 'forest' ||
              t.terrain === 'fertile' ||
              t.terrain === 'blossom' ||
              t.terrain === 'jungle'
            ) {
              t.terrain = dSq <= (haz.radius * 1.7) ** 2 ? 'swamp' : 'grass';
            }
            if (t.resourceNode === 'berry_bush' && dSq <= (haz.radius * 1.8) ** 2) {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
          }
        }
      });

      // Lethal drowning & surge crushing on non-flying NPCs & wildlife caught in the crashing tsunami crest
      for (const u of state.units) {
        if (haz.sourceUnitId && (u.id === haz.sourceUnitId || u.role === 'leviathan')) continue;
        const dx = u.x - haz.x;
        const dz = u.z - haz.z;
        const dist = Math.hypot(dx, dz);
        if (Math.abs(dist - nextR) <= 2.45 && dist > 0.2 && u.state !== 'ko' && u.role !== 'dragon' && !u.statusEffects.shielded && !u.draggedByPlayer) {
          const uTile = getTile(state, Math.round(u.x), Math.round(u.z));
          if (!uTile || uTile.height <= 3) {
            const push = (u.role === 'leviathan' ? 4.5 : 9.0) * dt;
            u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + (dx / dist) * push));
            u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + (dz / dist) * push));
            const surgeDmgRate = u.role === 'leviathan' ? 180 : !uTile || uTile.height <= 1 ? 520 : uTile.height === 2 ? 420 : 280;
            u.hp = Math.max(0, u.hp - surgeDmgRate * dt);
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
              if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
            }
          }
        }
      }

      // Crushing flood surge damage to unshielded coastal buildings (height <= 3) and ground/naval vehicles
      for (const b of state.buildings) {
        const dist = Math.hypot(b.tileX - haz.x, b.tileZ - haz.z);
        if (Math.abs(dist - nextR) <= 2.35 && b.shieldTimer <= 0) {
          const bTile = getTile(state, b.tileX, b.tileZ);
          if (!bTile || bTile.height <= 3) {
            const dmgRate = !bTile || bTile.height <= 1 ? 650 : bTile.height === 2 ? 420 : 240;
            b.hp = Math.max(0, b.hp - dmgRate * dt);
          }
        }
      }
      for (const v of state.vehicles ?? []) {
        if ((v.y ?? 0) > 2.5) continue;
        const dist = Math.hypot(v.x - haz.x, v.z - haz.z);
        if (Math.abs(dist - nextR) <= 2.45) {
          v.hp = Math.max(0, (v.hp ?? 100) - 520 * dt);
        }
      }
    }

    // Cataclysmic Asteroid Shockwave: supersonic atmospheric blast front & hurricane winds
    if (haz.kind === 'asteroid_shockwave') {
      const prevR = haz.currentRadius ?? 8.0;
      const maxR = haz.maxRadius ?? 30.0;
      const progress = Math.max(0, Math.min(1, 1 - haz.remaining / Math.max(0.1, haz.duration)));
      const nextR = Math.min(maxR, 8.0 + (maxR - 8.0) * Math.pow(progress, 0.78));
      haz.currentRadius = nextR;
      const innerBandSq = Math.max(0, prevR - 1.8) ** 2;

      // Wide environmental blast wave: uproots forests/groves, chars vegetation, and scatters thermal brushfires out to 30 tiles
      forEachTileInRadius(state, haz.x, haz.z, nextR + 1.8, (t, dSq) => {
        if (dSq < innerBandSq) return;
        if (t.height === 0) {
          if (dSq <= 22.0 ** 2) {
            damageOrBleachWaterTile(t, 120 * dt, false);
          }
          return;
        }
        const dist = Math.sqrt(dSq);
        if (
          t.resourceNode === 'timber_grove' ||
          t.resourceNode === 'berry_bush'
        ) {
          t.resourceNode = 'none';
          t.resourceAmount = 0;
        }
        if (dist <= 25.0) {
          t.farmSettlementId = undefined;
        }
        if (!t.buildingId) {
          if (dist <= 22.5) {
            if (
              t.terrain === 'forest' ||
              t.terrain === 'jungle' ||
              t.terrain === 'blossom' ||
              t.terrain === 'taiga' ||
              t.terrain === 'grass' ||
              t.terrain === 'fertile' ||
              t.terrain === 'savanna'
            ) {
              t.terrain = dist <= 18.5 || ((t.x * 13 + t.z * 7) % 3 !== 0) ? 'scorched' : 'savanna';
            }
            if (((t.x * 17 + t.z * 29) % 5) === 0) {
              t.onFireTimer = Math.max(t.onFireTimer, 11);
            }
          } else if (dist <= maxR) {
            if (
              t.terrain === 'forest' ||
              t.terrain === 'jungle' ||
              t.terrain === 'blossom' ||
              t.terrain === 'taiga'
            ) {
              t.terrain = ((t.x + t.z) & 1) === 0 ? 'savanna' : 'grass';
            }
            if (((t.x * 23 + t.z * 19) % 9) === 0) {
              t.onFireTimer = Math.max(t.onFireTimer, 7);
            }
          }
        }
      });

      // Hurricane blast winds hurling units radially outward across a 60-tile diameter
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded || u.draggedByPlayer) continue;
        const dx = u.x - haz.x;
        const dz = u.z - haz.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= nextR + 2.4 && dist >= Math.max(1.0, prevR - 3.2)) {
          const distFactor = Math.max(0.28, 1 - dist / (maxR + 4.0));
          const safeDist = Math.max(0.3, dist);
          const windSpeed = (16.5 + 11.5 * distFactor) * (u.role === 'leviathan' || u.role === 'dragon' ? 0.45 : 1.0);
          u.vxAir = (dx / safeDist) * windSpeed;
          u.vzAir = (dz / safeDist) * windSpeed;
          u.altitude = Math.max(u.altitude ?? 0, 1.8 + 2.6 * distFactor);
          u.vzVertical = Math.max(u.vzVertical ?? 0, 9.5 + 6.5 * distFactor);
          u.fallDamageArmed = true;
          const overpressureDmg = (185 * distFactor + 45) * dt;
          u.hp = Math.max(0, u.hp - overpressureDmg);
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.45;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          }
        }
      }

      // Overpressure shockwave damage to buildings out to 24 tiles
      for (const b of state.buildings) {
        const dist = Math.hypot(b.tileX - haz.x, b.tileZ - haz.z);
        if (dist <= 24.5 && Math.abs(dist - nextR) <= 2.6 && b.shieldTimer <= 0) {
          const distFactor = Math.max(0.2, 1 - dist / 25.5);
          const blastDmg = (480 * distFactor + 110) * dt;
          b.hp = Math.max(0, b.hp - blastDmg);
        }
      }

      // Blast wind pushing and damaging vehicles & ships
      for (const v of state.vehicles ?? []) {
        const dx = v.x - haz.x;
        const dz = v.z - haz.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= nextR + 2.4 && dist >= Math.max(1.0, prevR - 2.8)) {
          const distFactor = Math.max(0.25, 1 - dist / (maxR + 3.0));
          const safeDist = Math.max(0.3, dist);
          const pushStep = (11.5 + 9.0 * distFactor) * dt;
          v.x = Math.max(2, Math.min(state.gridSize - 3, v.x + (dx / safeDist) * pushStep));
          v.z = Math.max(2, Math.min(state.gridSize - 3, v.z + (dz / safeDist) * pushStep));
          v.heading = wrapAngleRad(Math.atan2(dz, dx));
          v.hp = Math.max(0, (v.hp ?? 100) - (360 * distFactor + 80) * dt);
        }
      }
    }

    // Ocean Whirlpool (varying sizes): spins ships & swimmers inward and deals lethal maelstrom DOT while active
    if (haz.kind === 'whirlpool') {
      const pullR = haz.radius * 1.5;
      forEachTileInRadius(state, haz.x, haz.z, haz.radius * 0.95, (t) => {
        if (t.height !== 0) return;
        damageOrBleachWaterTile(t, 45 * dt, false);
      });
      for (const b of state.buildings) {
        if (b.shieldTimer > 0) continue;
        const bt = getTile(state, b.tileX, b.tileZ);
        if (!bt || bt.height <= 1) {
          const dist = Math.hypot(b.tileX - haz.x, b.tileZ - haz.z);
          if (dist <= haz.radius * 1.15) {
            b.hp = Math.max(0, b.hp - 95 * dt);
          }
        }
      }
      for (const v of state.vehicles ?? []) {
        if ((v.y ?? 0) > 1.8) continue;
        const dx = v.x - haz.x;
        const dz = v.z - haz.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= pullR) {
          const normDist = Math.min(1, dist / pullR);
          const curAngle = Math.atan2(dz, dx);
          const nextDist = Math.max(0.28, dist - (1.95 - normDist * 0.85) * dt);
          const nextAngle = curAngle + (3.4 + (1 - normDist) * 4.2) * dt;
          v.x = Math.max(2, Math.min(state.gridSize - 3, haz.x + Math.cos(nextAngle) * nextDist));
          v.z = Math.max(2, Math.min(state.gridSize - 3, haz.z + Math.sin(nextAngle) * nextDist));
          v.heading = wrapAngleRad(nextAngle + Math.PI * 0.5);
          const vDot = 65 + (1 - normDist) * 115;
          v.hp = Math.max(0, (v.hp ?? 100) - vDot * dt);
        }
      }
      for (const u of state.units) {
        if (u.state === 'ko' || u.role === 'dragon' || u.statusEffects.shielded || u.draggedByPlayer) continue;
        const ut = getTile(state, Math.round(u.x), Math.round(u.z));
        if (ut && ut.height > 1) continue;
        const dx = u.x - haz.x;
        const dz = u.z - haz.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= pullR) {
          const normDist = Math.min(1, dist / pullR);
          if (!u.embarkedVehicleId && dist > 0.02) {
            const curAngle = Math.atan2(dz, dx);
            const nextDist = Math.max(0.22, dist - (2.25 - normDist * 0.8) * dt);
            const nextAngle = curAngle + (3.8 + (1 - normDist) * 4.6) * dt;
            u.x = Math.max(1, Math.min(state.gridSize - 2, haz.x + Math.cos(nextAngle) * nextDist));
            u.z = Math.max(1, Math.min(state.gridSize - 2, haz.z + Math.sin(nextAngle) * nextDist));
          }
          u.swimStamina = Math.max(0, (u.swimStamina ?? 100) - 36 * dt);
          const vortexDot = 42 + (1 - normDist) * 68;
          u.hp = Math.max(0, u.hp - vortexDot * dt);
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.45;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          }
        }
      }
    }

    // Ocean Rogue Wave: towering wall of foaming water surging across the sea
    if (haz.kind === 'rogue_wave') {
      const wx = haz.windX ?? Math.cos(haz.heading ?? 0);
      const wz = haz.windZ ?? Math.sin(haz.heading ?? 0);
      const waveSpeed = 5.4;
      haz.x += wx * waveSpeed * dt;
      haz.z += wz * waveSpeed * dt;
      const centerTile = getTile(state, Math.round(haz.x), Math.round(haz.z));
      if (!centerTile || centerTile.height >= 2 || haz.x < 3 || haz.x > state.gridSize - 4 || haz.z < 3 || haz.z > state.gridSize - 4) {
        haz.remaining = 0;
      } else {
        const crestR = haz.radius;
        for (const v of state.vehicles ?? []) {
          if ((v.y ?? 0) > 1.5) continue;
          const dist = Math.hypot(v.x - haz.x, v.z - haz.z);
          if (dist <= crestR) {
            v.x = Math.max(2, Math.min(state.gridSize - 3, v.x + wx * 3.8 * dt));
            v.z = Math.max(2, Math.min(state.gridSize - 3, v.z + wz * 3.8 * dt));
            v.bank = Math.sin(haz.remaining * 10) * 0.35;
            v.hp = Math.max(0, (v.hp ?? 100) - 48 * dt);
          }
        }
        for (const u of state.units) {
          if (u.state === 'ko' || u.role === 'dragon' || u.role === 'leviathan' || (haz.sourceUnitId && u.id === haz.sourceUnitId) || u.statusEffects.shielded || u.embarkedVehicleId || u.draggedByPlayer) continue;
          const dist = Math.hypot(u.x - haz.x, u.z - haz.z);
          if (dist <= crestR) {
            u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + wx * 4.5 * dt));
            u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + wz * 4.5 * dt));
            u.swimStamina = Math.max(0, (u.swimStamina ?? 100) - 35 * dt);
            u.hp = Math.max(0, u.hp - 44 * dt);
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
              if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
            }
          }
        }
        for (const b of state.buildings) {
          if (b.shieldTimer > 0) continue;
          const bt = getTile(state, b.tileX, b.tileZ);
          if (bt && bt.height === 0 && Math.hypot(b.tileX - haz.x, b.tileZ - haz.z) <= crestR * 0.85) {
            b.hp = Math.max(0, b.hp - 55 * dt);
          }
        }
      }
    }

    // Incremental outward expanding wave powers (heat_wave, freeze_snap, blessing, curse, frenzy, terraform)
    if (
      haz.kind === 'heat_wave_zone' ||
      haz.kind === 'freeze_wave_zone' ||
      haz.kind === 'blessing_wave' ||
      haz.kind === 'curse_wave' ||
      haz.kind === 'frenzy_wave' ||
      haz.kind === 'terraform_wave'
    ) {
      const progress = Math.max(0, Math.min(1, 1 - haz.remaining / Math.max(0.1, haz.duration)));
      const maxR = haz.maxRadius ?? haz.radius;
      const seedR = Math.min(maxR, 1.55);
      const prevR = haz.currentRadius ?? seedR;
      const nextR = seedR + (maxR - seedR) * (1 - Math.pow(1 - progress, 1.45));
      haz.currentRadius = nextR;
      if (nextR > prevR + 0.001 || haz.remaining <= 0) {
        applyExpandingWaveSlice(
          state,
          haz.kind,
          haz.x,
          haz.z,
          maxR,
          prevR,
          haz.remaining <= 0 ? maxR : nextR,
          getWaveAppliedSet(haz),
          haz,
        );
      }
    }

    // Alien Mothership Siege ('alien_mothership'): beacon drop -> giant walkers + UFOs + troopers + orbital annihilation laser salvos
    if (haz.kind === 'alien_mothership') {
      if ((haz.beaconTimer ?? 0) > 0) {
        haz.beaconTimer = Math.max(0, (haz.beaconTimer ?? 0) - dt);
      } else {
        const phase = haz.portalSpawnCount ?? 0;
        const pickLandPoint = (angle: number, dist: number): { x: number; z: number; onLand: boolean } => {
          const distScales = [1.0, 0.65, 1.35, 1.85, 2.4];
          const angleOffsets = [0, 0.35, -0.35, 0.75, -0.75];
          for (const scale of distScales) {
            for (const aOff of angleOffsets) {
              const candX = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + Math.cos(angle + aOff) * dist * scale)));
              const candZ = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + Math.sin(angle + aOff) * dist * scale)));
              const ct = getTile(state, candX, candZ);
              if (ct && ct.height > 0 && !ct.buildingId) return { x: candX, z: candZ, onLand: true };
            }
          }
          for (const scale of distScales) {
            for (const aOff of angleOffsets) {
              const candX = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + Math.cos(angle + aOff) * dist * scale)));
              const candZ = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + Math.sin(angle + aOff) * dist * scale)));
              const ct = getTile(state, candX, candZ);
              if (ct && ct.height > 0) return { x: candX, z: candZ, onLand: true };
            }
          }
          const fx = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + Math.cos(angle) * dist * 0.65)));
          const fz = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + Math.sin(angle) * dist * 0.65)));
          return { x: fx, z: fz, onLand: false };
        };
        if (phase === 0) {
          haz.portalSpawnCount = 1;
          // Vanguard drop: 2 colossal AT-Walker mechs, 3+ Scout UFOs (extra UFOs over open ocean), and a 14-trooper invasion force
          let anyLandFound = false;
          for (let i = 0; i < 2; i++) {
            const pt = pickLandPoint(i * Math.PI + 0.5, 4.4);
            if (pt.onLand) anyLandFound = true;
            spawnUnit(state, 'alien_walker', pt.x, pt.z, true);
          }
          const ufoCount = anyLandFound ? 3 : 5;
          for (let i = 0; i < ufoCount; i++) {
            const ang = (i / ufoCount) * Math.PI * 2;
            const ux = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + Math.cos(ang) * 5.0)));
            const uz = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + Math.sin(ang) * 5.0)));
            spawnUnit(state, 'alien_ufo', ux, uz, true);
          }
          for (let i = 0; i < 14; i++) {
            const ringDist = i < 6 ? 2.4 : 4.1;
            const pt = pickLandPoint((i / 14) * Math.PI * 2 + 0.25, ringDist);
            spawnUnit(state, 'alien_trooper', pt.x, pt.z, true);
          }
          addChronicle(state, 'The Alien Mothership arrived overhead! Alien Walkers, Scout UFOs, and Troopers are landing!', 'warning');
        }
        // Only rain orbital salvos & drops while locked in stationary siege hover (cease before hyperspace jump-out)
        if (haz.remaining > 3.3) {
        // Continuous ground-invasion reinforcement waves across the ~10s siege hover
        const siegeElapsed = Math.max(0, haz.duration - 2.0 - haz.remaining);
        const targetDropWave = Math.min(7, 1 + Math.floor(siegeElapsed / 1.35));
        while ((haz.portalSpawnCount ?? 1) < targetDropWave) {
          const waveNum = (haz.portalSpawnCount ?? 1) + 1;
          haz.portalSpawnCount = waveNum;
          const waveDist = 2.4 + (waveNum % 3) * 1.4;
          let waveOnLand = false;
          for (let ti = 0; ti < 4; ti++) {
            const ang = (waveNum * 1.15) + (ti / 4) * Math.PI * 2;
            const rp = pickLandPoint(ang, waveDist);
            if (rp.onLand) waveOnLand = true;
            spawnUnit(state, 'alien_trooper', rp.x, rp.z, true);
          }
          if (waveNum === 2 || waveNum === 4) {
            const wp = pickLandPoint(waveNum * 1.7, 4.6);
            spawnUnit(state, 'alien_walker', wp.x, wp.z, true);
          }
          if (waveNum === 3 || (!waveOnLand && (waveNum === 2 || waveNum === 5))) {
            const ux = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.x + Math.cos(waveNum) * 4.5)));
            const uz = Math.max(2, Math.min(state.gridSize - 3, Math.round(haz.z + Math.sin(waveNum) * 4.5)));
            spawnUnit(state, 'alien_ufo', ux, uz, true);
          }
        }
        haz.laserSubTimer = (haz.laserSubTimer ?? 0) - dt;
        if (haz.laserSubTimer <= 0) {
          haz.laserSubTimer = 1.85;
          // Pick a nearby civilization building or unit within mothership shadow radius (or scorch random point inside shadow)
          let strikeX = haz.x + (Math.random() - 0.5) * haz.radius * 1.1;
          let strikeZ = haz.z + (Math.random() - 0.5) * haz.radius * 1.1;
          const bTarget = state.buildings.find(
            (b) => b.hp > 0 && (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2 <= (haz.radius * 1.15) ** 2,
          );
          if (bTarget) {
            strikeX = bTarget.tileX;
            strikeZ = bTarget.tileZ;
          } else {
            const uTarget = state.units.find(
              (u) => u.faction === 'civilization' && u.state !== 'ko' && (u.x - haz.x) ** 2 + (u.z - haz.z) ** 2 <= (haz.radius * 1.15) ** 2,
            );
            if (uTarget) {
              strikeX = uTarget.x;
              strikeZ = uTarget.z;
            }
          }
          strikeX = Math.max(2, Math.min(state.gridSize - 3, strikeX));
          strikeZ = Math.max(2, Math.min(state.gridSize - 3, strikeZ));
          const stTile = getTile(state, Math.round(strikeX), Math.round(strikeZ));
          const destY = (stTile?.height ?? 1) * 0.45 + 0.25;
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'projectile_tracer',
            vfxSubtype: 'laser_beam',
            x: strikeX,
            y: destY,
            z: strikeZ,
            originX: haz.x + (Math.random() - 0.5) * 3.0,
            originY: 22.0,
            originZ: haz.z + (Math.random() - 0.5) * 3.0,
            radius: 2.8,
            color: '#93c5fd',
            createdAt: Date.now(),
          });
          // Apply annihilation blast
          forEachTileInRadius(state, strikeX, strikeZ, 2.5, (t) => {
            if (t.height === 0) {
              damageOrBleachWaterTile(t, 280, true);
              if (t.terrain === 'ice') {
                t.terrain = t.frozenWaterBase ?? 'shallow_water';
                delete t.frozenWaterBase;
              }
            } else if (!t.buildingId) {
              t.terrain = 'scorched';
              t.onFireTimer = Math.max(t.onFireTimer, 6.0);
            }
          });
          for (const b of state.buildings) {
            if (b.shieldTimer <= 0 && (b.tileX - strikeX) ** 2 + (b.tileZ - strikeZ) ** 2 <= 6.5) {
              b.hp = Math.max(0, b.hp - 210);
            }
          }
          for (const u of state.units) {
            if (
              u.state !== 'ko' &&
              u.role !== 'alien_trooper' &&
              u.role !== 'alien_ufo' &&
              u.role !== 'alien_walker' &&
              !u.statusEffects.shielded &&
              (u.x - strikeX) ** 2 + (u.z - strikeZ) ** 2 <= 6.8
            ) {
              u.hp = Math.max(0, u.hp - 160);
              if (u.hp <= 0) {
                u.state = 'ko';
                u.koTimer = 0.45;
              }
            }
          }
          for (const v of state.vehicles ?? []) {
            if ((v.x - strikeX) ** 2 + (v.z - strikeZ) ** 2 <= 6.8) {
              v.hp = Math.max(0, (v.hp ?? 100) - 180);
            }
          }
        }
        }
      }
    }

    // Sweeping Helios Solar Beam ('orbital_beam'): blazing overhead Sun channels a searing laser
    // that burns through blocks, evaporates water into steam/seabed, and periodically launches solar flares!
    if (haz.kind === 'orbital_beam') {
      const bx = haz.beamDirX ?? 1;
      const bz = haz.beamDirZ ?? 0;
      haz.x = Math.max(3, Math.min(state.gridSize - 4, haz.x + bx * 2.65 * dt));
      haz.z = Math.max(3, Math.min(state.gridSize - 4, haz.z + bz * 2.65 * dt));
      // Gently steer back inward if approaching the map rim so the Sun keeps sweeping across the world
      if (haz.x <= 4 || haz.x >= state.gridSize - 5) haz.beamDirX = -bx;
      if (haz.z <= 4 || haz.z >= state.gridSize - 5) haz.beamDirZ = -bz;

      let beamState = solarBeamTileStateMap.get(haz);
      if (!beamState) {
        beamState = { burnAccum: new Map(), evapAccum: new Map(), evaporatedTiles: new Set() };
        solarBeamTileStateMap.set(haz, beamState);
      }
      const { burnAccum, evapAccum, evaporatedTiles } = beamState;

      const bR = haz.radius * 0.78;
      const bSq = bR * bR;
      const cutR = Math.max(1.85, bR * 0.68);
      const lavaTrenchR = Math.max(1.2, bR * 0.42);
      let carvedLavaThisTick = false;

      forEachTileInRadius(state, haz.x, haz.z, bR, (t) => {
        const d = Math.hypot(t.x - haz.x, t.z - haz.z);
        const falloff = Math.max(0.2, 1 - d / Math.max(0.5, bR));
        const idx = t.z * state.gridSize + t.x;
        t.blessedTimer = 0;
        t.tempOffset = Math.min(80, (t.tempOffset ?? 0) + 56 * dt);

        if (t.height === 0) {
          if (t.terrain === 'ice') {
            // Melt sea ice back to water first before evaporating on subsequent exposure
            t.terrain = t.frozenWaterBase ?? 'shallow_water';
            delete t.frozenWaterBase;
            evapAccum.set(idx, 0);
            return;
          }
          if (t.waterKind === 'lava') {
            return;
          }
          damageOrBleachWaterTile(t, 280 * dt, true);
          if (!t.buildingId && d <= cutR) {
            const nextEvap = (evapAccum.get(idx) ?? 0) + dt * (3.6 * falloff + 0.55);
            if (nextEvap >= 1.0) {
              evapAccum.set(idx, nextEvap - 1.0);
              if (t.terrain === 'deep_water' && !t.waterKind) {
                t.terrain = 'shallow_water';
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              } else {
                // Boil off shallow/poison/floral water into dry scorched/sandy seabed
                t.height = 1;
                t.terrain = d <= lavaTrenchR ? 'scorched' : 'sand';
                delete t.waterKind;
                delete t.frozenWaterBase;
                t.isRiver = false;
                t.isLake = false;
                t.resourceNode = 'none';
                t.resourceAmount = 0;
                t.onFireTimer = 0;
                evaporatedTiles.add(idx);
              }
            } else {
              evapAccum.set(idx, nextEvap);
            }
          }
          return;
        }

        if (!t.buildingId) {
          t.farmSettlementId = undefined;
          if (t.resourceNode === 'berry_bush') {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          } else if (t.resourceNode === 'timber_grove') {
            if (d <= cutR) {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
              clearBurntTreeState(t);
              delete t.treeBiomeOverride;
            } else {
              t.burntTree = true;
            }
          }
          if (t.terrain === 'sand') {
            t.terrain = 'crystal_field';
          } else if (t.terrain !== 'crystal_field') {
            t.terrain = d <= lavaTrenchR ? 'volcanic_wasteland' : 'scorched';
          }
          t.onFireTimer = Math.max(t.onFireTimer, 8.0);

          // Burn down blocks inside the concentrated solar beam core!
          if (d <= cutR) {
            const nextBurn = (burnAccum.get(idx) ?? 0) + dt * (4.4 * falloff + 0.7);
            if (nextBurn >= 1.0) {
              burnAccum.set(idx, nextBurn - 1.0);
              if (t.height > 1) {
                t.height -= 1;
                t.terrain = 'volcanic_wasteland';
                if (t.resourceNode === 'stone_outcrop' || t.resourceNode === 'ore_vein') {
                  t.resourceNode = 'none';
                  t.resourceAmount = 0;
                }
              } else if (d <= lavaTrenchR && !evaporatedTiles.has(idx)) {
                // Focal point melts the bottom terrain layer into an incandescent lava trench
                t.height = 0;
                t.terrain = 'shallow_water';
                t.waterKind = 'lava';
                t.isRiver = true;
                t.isLake = false;
                delete t.frozenWaterBase;
                t.resourceNode = 'none';
                t.resourceAmount = 0;
                t.onFireTimer = 0;
                clearBurntTreeState(t);
                delete t.treeBiomeOverride;
                carvedLavaThisTick = true;
              }
            } else {
              burnAccum.set(idx, nextBurn);
            }
          }
        }
      });

      if (carvedLavaThisTick) {
        specialLiquidPossibleByState.set(state, true);
        resolveLiquidReactionsAround(state, haz.x, haz.z, bR + 1.5);
      }

      for (const b of state.buildings) {
        if (b.shieldTimer <= 0 && (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2 <= bSq) {
          b.hp = Math.max(0, b.hp - 280 * dt);
        }
      }
      for (const v of state.vehicles ?? []) {
        if ((v.x - haz.x) ** 2 + (v.z - haz.z) ** 2 <= bSq) {
          v.hp = Math.max(0, (v.hp ?? 100) - 260 * dt);
        }
      }
      for (const u of state.units) {
        if (u.state !== 'ko' && !u.statusEffects.shielded && (u.x - haz.x) ** 2 + (u.z - haz.z) ** 2 <= bSq) {
          u.hp = Math.max(0, u.hp - 240 * dt);
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.45;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          }
        }
      }

      // Periodically launch map-wide flaming solar projectiles from the Sun's corona!
      if (!haz.solarProjectiles) haz.solarProjectiles = [];
      if (!haz.recentSolarImpacts) haz.recentSolarImpacts = [];
      haz.solarFlareTimer = (haz.solarFlareTimer ?? 0.35) - dt;
      if (haz.solarFlareTimer <= 0 && haz.remaining > 1.25) {
        haz.solarFlareTimer = 0.72;
        const salvoSize = haz.radius >= 6.0 ? 3 : 2;
        const margin = 4;
        const span = Math.max(8, state.gridSize - margin * 2);
        const halfSpan = span * 0.5;
        for (let s = 0; s < salvoSize; s++) {
          if (haz.solarProjectiles.length >= 24) break;
          const idx = (haz.solarFlareCount ?? 0) + 1;
          haz.solarFlareCount = idx;
          // Distribute projectiles evenly across ALL 4 map quadrants (NW, NE, SW, SE) using golden-ratio Halton spread
          const quad = (idx - 1) & 3;
          const rx = ((idx * 0.61803398875 + s * 0.371) % 1 + 1) % 1;
          const rz = ((idx * 0.38196601125 + s * 0.739) % 1 + 1) % 1;
          const qx = quad === 0 || quad === 2 ? 0 : halfSpan;
          const qz = quad === 0 || quad === 1 ? 0 : halfSpan;
          const tx = Math.max(margin, Math.min(state.gridSize - margin - 1, Math.round(margin + qx + rx * halfSpan)));
          const tz = Math.max(margin, Math.min(state.gridSize - margin - 1, Math.round(margin + qz + rz * halfSpan)));
          const dist = Math.hypot(tx - haz.x, tz - haz.z);
          const maxFlight = Math.max(0.55, Math.min(1.15, haz.remaining - 0.12));
          const flightDur = Math.min(maxFlight, 0.72 + (dist / Math.max(24, state.gridSize)) * 0.68);
          haz.solarProjectiles.push({
            id: nextEntityId('sproj'),
            startX: haz.x,
            startY: 17.6,
            startZ: haz.z,
            targetX: tx,
            targetZ: tz,
            progress: 0,
            duration: Math.max(0.5, flightDur),
            peakY: Math.min(34, Math.max(20.5, 18.2 + dist * 0.18)),
            impactRadius: 2.0 + (idx % 3) * 0.4,
          });
        }
      }

      // Advance in-flight solar projectiles and erupt glowing lava pools on landing!
      for (let pi = haz.solarProjectiles.length - 1; pi >= 0; pi--) {
        const proj = haz.solarProjectiles[pi];
        proj.progress += dt / Math.max(0.25, proj.duration);
        if (proj.progress >= 1) {
          specialLiquidPossibleByState.set(state, true);
          const impR = proj.impactRadius;
          const coreR = Math.max(1.25, impR * 0.68);
          const coreRSq = coreR * coreR;
          const outerR = impR + 0.95;
          const outerRSq = outerR * outerR;

          forEachTileInRadius(state, proj.targetX, proj.targetZ, outerR, (t) => {
            const dx = t.x - proj.targetX;
            const dz = t.z - proj.targetZ;
            const dSq = dx * dx + dz * dz;
            if (dSq > outerRSq) return;
            t.blessedTimer = 0;
            t.tempOffset = 80;
            if (t.buildingId) return;

            if (dSq <= coreRSq) {
              // Molten glowing liquid lava crater core on ALL parts of the map!
              t.height = 0;
              t.terrain = 'shallow_water';
              t.waterKind = 'lava';
              t.isLake = true;
              t.isRiver = false;
              delete t.frozenWaterBase;
              t.resourceNode = 'none';
              t.resourceAmount = 0;
              t.onFireTimer = 0;
              t.farmSettlementId = undefined;
              clearBurntTreeState(t);
              delete t.treeBiomeOverride;
            } else {
              // Scorched volcanic basalt/obsidian rim surrounding the lava pool
              if (t.height === 0 && t.waterKind !== 'lava') {
                // Boil open water / sea ice along the impact rim into volcanic rock crust
                t.height = 1;
                t.terrain = 'volcanic_wasteland';
                delete t.waterKind;
                delete t.frozenWaterBase;
                t.isRiver = false;
                t.isLake = false;
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              } else if (t.height > 0) {
                t.terrain = 'volcanic_wasteland';
                t.onFireTimer = Math.max(t.onFireTimer, 9.0);
                t.farmSettlementId = undefined;
                if (t.resourceNode === 'berry_bush') {
                  t.resourceNode = 'none';
                  t.resourceAmount = 0;
                } else if (t.resourceNode === 'timber_grove') {
                  t.burntTree = true;
                }
              }
            }
          });

          // Blast damage at the solar projectile landing zone
          const dmgRSq = (impR + 0.9) ** 2;
          for (const b of state.buildings) {
            if (b.shieldTimer <= 0 && (b.tileX - proj.targetX) ** 2 + (b.tileZ - proj.targetZ) ** 2 <= dmgRSq) {
              b.hp = Math.max(0, b.hp - 125);
            }
          }
          for (const v of state.vehicles ?? []) {
            if ((v.x - proj.targetX) ** 2 + (v.z - proj.targetZ) ** 2 <= dmgRSq) {
              v.hp = Math.max(0, (v.hp ?? 100) - 110);
            }
          }
          for (const u of state.units) {
            if (u.state !== 'ko' && !u.statusEffects.shielded && (u.x - proj.targetX) ** 2 + (u.z - proj.targetZ) ** 2 <= dmgRSq) {
              u.hp = Math.max(0, u.hp - 95);
              if (u.hp <= 0) {
                u.state = 'ko';
                u.koTimer = 0.45;
                if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
              }
            }
          }

          if (haz.recentSolarImpacts.length < 16) {
            haz.recentSolarImpacts.push({ x: proj.targetX, z: proj.targetZ, radius: impR });
          }
          haz.solarProjectiles.splice(pi, 1);
        }
      }
    }

    // Gravity Flux Anomaly ('gravity_anomaly'): floats ground units skyward, then violently slams them down on collapse!
    if (haz.kind === 'gravity_anomaly') {
      const pullSq = haz.radius * haz.radius;
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded || u.draggedByPlayer || u.role === 'dragon' || u.role === 'alien_ufo') continue;
        const dSq = (u.x - haz.x) ** 2 + (u.z - haz.z) ** 2;
        if (dSq <= pullSq) {
          if (haz.remaining > 0) {
            u.altitude = Math.min(8.4, (u.altitude ?? 0) + 3.2 * dt);
            u.vzVertical = 0;
            u.fallDamageArmed = true;
          }
        }
      }
      if (haz.remaining <= 0 && !haz.exploded) {
        haz.exploded = true;
        for (const u of state.units) {
          if (u.state === 'ko' || u.statusEffects.shielded || u.draggedByPlayer || u.role === 'dragon' || u.role === 'alien_ufo') continue;
          if ((u.x - haz.x) ** 2 + (u.z - haz.z) ** 2 <= pullSq) {
            u.vzVertical = -18.5;
            u.fallDamageArmed = true;
          }
        }
      }
    }

    // Protective Shield Dome ('shield_dome'): continuously shields friendly units/buildings and repels enemies
    if (haz.kind === 'shield_dome' && haz.remaining > 0) {
      const domeSq = haz.radius * haz.radius;
      const ownerKid = haz.ownerKingdomId;
      haz.tickTimer -= dt;
      if (haz.tickTimer <= 0) {
        haz.tickTimer = 0.25;
        for (const b of state.buildings) {
          const dSq = (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2;
          if (dSq > domeSq) continue;
          const bKid = b.settlementId ? getKingdomId(state, b.settlementId) : undefined;
          if (!ownerKid || bKid === ownerKid) {
            b.shieldTimer = Math.max(b.shieldTimer, 4.0);
            b.cursedTimer = 0;
          }
        }
        forEachTileInBounds(state, haz.x - haz.radius, haz.x + haz.radius, haz.z - haz.radius, haz.z + haz.radius, (t) => {
          if ((t.x - haz.x) ** 2 + (t.z - haz.z) ** 2 <= domeSq && t.onFireTimer > 0) {
            t.onFireTimer = 0;
          }
        });
      }
      for (const u of state.units) {
        if (u.state === 'ko') continue;
        const dSq = (u.x - haz.x) ** 2 + (u.z - haz.z) ** 2;
        if (dSq > domeSq) continue;
        const uKid =
          u.faction === 'civilization'
            ? u.kingdomId ?? (u.settlementId ? getKingdomId(state, u.settlementId) : undefined)
            : undefined;
        const isEnemy =
          u.faction === 'hostile' ||
          Boolean(
            ownerKid &&
              uKid &&
              uKid !== ownerKid &&
              getKingdomRelation(state, ownerKid, uKid) === 'war',
          );
        if (isEnemy) {
          const dist = Math.max(0.25, Math.sqrt(dSq));
          u.x = Math.max(1, Math.min(state.gridSize - 2, haz.x + ((u.x - haz.x) / dist) * (haz.radius + 1.2)));
          u.z = Math.max(1, Math.min(state.gridSize - 2, haz.z + ((u.z - haz.z) / dist) * (haz.radius + 1.2)));
        } else if ((!ownerKid && u.faction === 'civilization') || (ownerKid && uKid === ownerKid)) {
          u.statusEffects.shielded = Math.max(u.statusEffects.shielded ?? 0, 4.0);
        }
      }
    }

    if (haz.remaining > 0) {
      remainingHazards.push(haz);
    }
  }
  state.activeHazards = remainingHazards;

  // Periodic natural ocean events: Whirlpools (varying sizes) and Rogue Waves in open seas
  state.oceanEventTimer = (state.oceanEventTimer ?? 6) + dt;
  if (state.oceanEventTimer >= 16) {
    state.oceanEventTimer = 0;
    const activeOceanEvents = state.activeHazards.filter((h) => h.kind === 'whirlpool' || h.kind === 'rogue_wave').length;
    if (activeOceanEvents < 3) {
      const gs = state.gridSize;
      for (let attempt = 0; attempt < 24; attempt++) {
        const ox = 8 + Math.floor(Math.random() * (gs - 16));
        const oz = 8 + Math.floor(Math.random() * (gs - 16));
        const ot = getTile(state, ox, oz);
        if (ot && ot.height === 0 && !ot.isRiver && !ot.isLake && !ot.buildingId && ot.terrain !== 'stone_road') {
          const spawnWhirlpool = Math.random() < 0.58;
          if (spawnWhirlpool) {
            // Varying whirlpool sizes (small 2.2 up to giant 5.4 maelstrom)
            const wpRadius = 2.2 + Math.random() * 3.2;
            state.activeHazards.push({
              id: nextEntityId('haz_wp'),
              kind: 'whirlpool',
              x: ox,
              z: oz,
              radius: wpRadius,
              remaining: 18 + Math.random() * 10,
              duration: 24,
              tickTimer: 0,
            });
          } else {
            const heading = Math.random() * Math.PI * 2;
            state.activeHazards.push({
              id: nextEntityId('haz_rw'),
              kind: 'rogue_wave',
              x: ox,
              z: oz,
              radius: 3.4 + Math.random() * 2.2,
              remaining: 12 + Math.random() * 6,
              duration: 16,
              tickTimer: 0,
              heading,
              windX: Math.cos(heading),
              windZ: Math.sin(heading),
            });
          }
          break;
        }
      }
    }
  }

  // Throttle full-map tile timer sweep to 4 Hz with accumulated dt (cuts 16k-262k tile scans by ~75% with identical decay)
  const prevTileTimerAccum = tileTimerAccumByState.get(state) ?? 0;
  const nextTileTimerAccum = prevTileTimerAccum + dt;
  const runTileTimerSweep = nextTileTimerAccum >= 0.25;
  const tileSweepDt = runTileTimerSweep ? nextTileTimerAccum : 0;
  tileTimerAccumByState.set(state, runTileTimerSweep ? 0 : nextTileTimerAccum);

  const nextLiqAccum = (liquidReactionAccumByState.get(state) ?? 0) + tileSweepDt;
  const runLiquidEdgePulse = runTileTimerSweep && nextLiqAccum >= 1.25;
  if (runTileTimerSweep) {
    liquidReactionAccumByState.set(state, runLiquidEdgePulse ? 0 : nextLiqAccum);
  }
  const nextLiqContactAccum = (liquidContactAccumByState.get(state) ?? 0) + tileSweepDt;
  const runLiquidContactPulse = runTileTimerSweep && nextLiqContactAccum >= 0.45;
  if (runTileTimerSweep) {
    liquidContactAccumByState.set(state, runLiquidContactPulse ? 0 : nextLiqContactAccum);
  }
  const gsSweep = state.gridSize;

  let pendingFireIgnitions: Map<TileData, { duration: number; fireColor?: string }> | null = null;
  let pendingLavaQuench: TileData[] | null = null;
  let pendingLavaPoison: Array<[TileData, TileData]> | null = null;
  let pendingPoisonDilute: TileData[] | null = null;
  const tiles = state.tiles;
  const nTiles = runTileTimerSweep ? tiles.length : 0;
  const wildfireSpreadEnabled = state.worldRules?.wildfireSpread !== false;
  const fireSpreadOffsets = FIRE_SPREAD_OFFSETS;
  for (let i = 0; i < nTiles; i++) {
    const t = tiles[i];
    if (
      (runLiquidEdgePulse || runLiquidContactPulse) &&
      t.height === 0 &&
      (t.waterKind === 'lava' || t.waterKind === 'poison')
    ) {
      const lx = t.x;
      const lz = t.z;
      const isLava = t.waterKind === 'lava';
      const n0 = lx > 0 ? i - 1 : -1;
      const n1 = lx + 1 < gsSweep ? i + 1 : -1;
      const n2 = lz > 0 ? i - gsSweep : -1;
      const n3 = lz + 1 < gsSweep ? i + gsSweep : -1;
      let lavaHitWater = false;
      let lavaPoisonNb: TileData | null = null;
      let cleanWaterNeighbors = 0;
      let poisonNeighbors = 0;

      for (let ni = 0; ni < 4; ni++) {
        const nIdx = ni === 0 ? n0 : ni === 1 ? n1 : ni === 2 ? n2 : n3;
        if (nIdx < 0) continue;
        const nb = tiles[nIdx];
        if (!nb) continue;
        if (nb.height === 0) {
          if (runLiquidContactPulse) {
            if (isLava) {
              if (nb.waterKind === 'poison') {
                lavaPoisonNb = nb;
              } else if (!nb.waterKind && nb.terrain !== 'ice') {
                lavaHitWater = true;
              } else if (nb.terrain === 'ice') {
                nb.terrain = nb.frozenWaterBase ?? 'shallow_water';
                delete nb.frozenWaterBase;
                lavaHitWater = true;
              }
            } else {
              if (!nb.waterKind && nb.terrain !== 'ice') {
                cleanWaterNeighbors++;
              } else if (nb.waterKind === 'poison') {
                poisonNeighbors++;
              }
            }
          }
          continue;
        }
        if (!runLiquidEdgePulse || nb.blessedTimer > 0) continue;
        if (isLava) {
          if (
            nb.onFireTimer <= 0 &&
            (nb.buildingId ||
              nb.resourceNode === 'timber_grove' ||
              nb.resourceNode === 'berry_bush' ||
              isFlammableVegetationTerrain(nb.terrain)) &&
            Math.random() < 0.16
          ) {
            nb.onFireTimer = 4.6;
          }
        } else if (!nb.buildingId && POISON_CORRUPTIBLE_SOILS.has(nb.terrain) && Math.random() < 0.09) {
          nb.terrain = 'blighted_mire';
          nb.farmSettlementId = undefined;
          delete nb.treeBiomeOverride;
        }
      }

      if (runLiquidContactPulse) {
        if (isLava) {
          if (lavaPoisonNb) {
            if (!pendingLavaPoison) pendingLavaPoison = [];
            pendingLavaPoison.push([t, lavaPoisonNb]);
          } else if (lavaHitWater) {
            if (!pendingLavaQuench) pendingLavaQuench = [];
            pendingLavaQuench.push(t);
          }
        } else if (cleanWaterNeighbors > 0) {
          // Gradually dilute poison borders when connected to active open water
          const diluteProb =
            cleanWaterNeighbors >= 3
              ? 1.0
              : cleanWaterNeighbors === 2
                ? 0.24
                : poisonNeighbors <= 2
                  ? 0.08
                  : 0.03;
          if (diluteProb >= 1.0 || Math.random() < diluteProb) {
            if (!pendingPoisonDilute) pendingPoisonDilute = [];
            pendingPoisonDilute.push(t);
          }
        }
      }
    }
    // Fast-path skip for 99%+ of quiet tiles on 384x384 / 512x512 worlds
    if (
      t.onFireTimer === 0 &&
      t.blessedTimer === 0 &&
      t.cursedTimer === 0 &&
      !t.crushedTimer &&
      !t.tempOffset &&
      !t.coralBleachTimer
    ) {
      continue;
    }
    if (t.blessedTimer > 0) t.blessedTimer = Math.max(0, t.blessedTimer - tileSweepDt);
    if (t.cursedTimer > 0) t.cursedTimer = Math.max(0, t.cursedTimer - tileSweepDt);
    if ((t.crushedTimer ?? 0) > 0) {
      t.crushedTimer = Math.max(0, (t.crushedTimer ?? 0) - tileSweepDt);
    }
    if (t.tempOffset) {
      const decay = 0.38 * tileSweepDt;
      if (Math.abs(t.tempOffset) <= decay) {
        delete t.tempOffset;
      } else {
        t.tempOffset += t.tempOffset > 0 ? -decay : decay;
      }
      if (t.height === 0 && t.terrain === 'ice') {
        const iceEffC = getBaseBiomeTempC('ice') + (t.tempOffset ?? 0);
        if (iceEffC > 2) {
          t.terrain = t.frozenWaterBase ?? 'shallow_water';
          delete t.frozenWaterBase;
        }
      }
    }
    if (t.height === 0 && t.resourceNode === 'coral_reef') {
      if ((t.coralBleachTimer ?? 0) > 0) {
        t.coralBleachTimer = Math.max(0, (t.coralBleachTimer ?? 0) - tileSweepDt);
        if (t.coralBleachTimer === 0 && t.resourceAmount <= 0) {
          t.resourceAmount = 240;
        }
      }
    }
    if ((t.devastatedTimer ?? 0) > 0) {
      t.devastatedTimer = Math.max(0, (t.devastatedTimer ?? 0) - tileSweepDt);
      if (t.devastatedTimer <= 0) t.devastatedTimer = undefined;
    }
    if (t.onFireTimer > 0) {
      t.onFireTimer = Math.max(0, t.onFireTimer - tileSweepDt);
      if (t.height <= 0) {
        t.onFireTimer = 0;
        t.fireColor = undefined;
        continue;
      }
      const hasFlammableGround = isFlammableVegetationTerrain(t.terrain);
      // Burn vegetation down to scorched earth and char standing trees in-place (preserving their biome & scorching grass underneath)
      if (t.resourceNode === 'timber_grove') {
        preserveTreeBiomeBeforeScorch(t);
        if (t.resourceAmount > 0) {
          t.resourceAmount = Math.max(0, t.resourceAmount - 34 * tileSweepDt);
        }
        if (t.resourceAmount < 190 || t.onFireTimer <= 1.8) {
          t.burntTree = true;
          if (hasFlammableGround) {
            t.terrain = 'scorched';
            t.farmSettlementId = undefined;
          }
        }
        if (t.resourceAmount <= 0 || t.onFireTimer === 0) {
          t.burntTree = true;
          t.resourceNode = 'none';
          t.resourceAmount = 0;
          if (hasFlammableGround || t.terrain === 'scorched') {
            t.terrain = 'scorched';
            t.farmSettlementId = undefined;
          }
        }
      } else if (t.resourceNode === 'berry_bush') {
        if (t.resourceAmount > 0) {
          t.resourceAmount = Math.max(0, t.resourceAmount - 42 * tileSweepDt);
        }
        if (t.resourceAmount <= 0 || t.onFireTimer === 0) {
          t.resourceNode = 'none';
          t.resourceAmount = 0;
          if (hasFlammableGround) {
            t.terrain = 'scorched';
            t.farmSettlementId = undefined;
          }
        }
      } else if (hasFlammableGround && (t.onFireTimer <= 1.2 || t.onFireTimer === 0)) {
        t.terrain = 'scorched';
        t.farmSettlementId = undefined;
      }

      // Wildfire & urban conflagration spread from any burning tile (uses tileSweepDt so spread is brisk & responsive)
      if (t.onFireTimer > 0.5 && wildfireSpreadEnabled) {
        const sourceHeatBoost = t.buildingId
          ? 1.55
          : t.resourceNode === 'timber_grove' ||
              t.burntTree ||
              t.terrain === 'forest' ||
              t.terrain === 'jungle' ||
              t.terrain === 'scorched'
            ? 1.3
            : 1.1;
        for (let k = 0; k < fireSpreadOffsets.length; k++) {
          const [ox, oz, distWeight] = fireSpreadOffsets[k];
          const nb = getTile(state, t.x + ox, t.z + oz);
          if (!nb || nb.height <= 0 || nb.onFireTimer > 0 || nb.blessedTimer > 0) continue;
          if (pendingFireIgnitions?.has(nb)) continue;
          const rate = getTileFlammabilityRate(state, nb) * distWeight * sourceHeatBoost;
          if (rate <= 0) continue;
          const igniteProb = 1 - Math.exp(-rate * tileSweepDt);
          if (Math.random() < igniteProb) {
            const childDuration = nb.buildingId
              ? 8.5
              : nb.resourceNode === 'timber_grove' ||
                  nb.terrain === 'forest' ||
                  nb.terrain === 'jungle' ||
                  nb.terrain === 'taiga'
                ? 7.2
                : nb.terrain === 'savanna' ||
                    nb.terrain === 'blossom' ||
                    nb.terrain === 'fertile' ||
                    nb.resourceNode === 'berry_bush' ||
                    nb.farmSettlementId
                  ? 6.0
                  : 5.2;
            if (!pendingFireIgnitions) pendingFireIgnitions = new Map();
            pendingFireIgnitions.set(nb, {
              duration: childDuration,
              fireColor: t.fireColor,
            });
            if (state.pendingVfx.length < 48) {
              state.pendingVfx.push({
                id: nextEntityId('vfx'),
                type: 'fire_spread',
                originX: t.x,
                originY: t.height * 0.45 + 0.35,
                originZ: t.z,
                x: nb.x,
                y: nb.height * 0.45 + 0.35,
                z: nb.z,
                radius: 1.0,
                color: t.fireColor ?? '#ff6b00',
                createdAt: Date.now(),
              });
            }
          }
        }
      }

      if (t.onFireTimer === 0) {
        t.fireColor = undefined;
      }
    } else if (t.fireColor !== undefined) {
      t.fireColor = undefined;
    }
  }
  if (pendingFireIgnitions) {
    for (const [nb, ign] of pendingFireIgnitions) {
      nb.onFireTimer = ign.duration;
      nb.fireColor = ign.fireColor;
    }
  }
  if (pendingLavaQuench) {
    let steamVfxCount = 0;
    for (let i = 0; i < pendingLavaQuench.length; i++) {
      const qt = pendingLavaQuench[i];
      if (qt.height !== 0 || qt.waterKind !== 'lava') continue;
      qt.height = 0;
      qt.terrain = 'shallow_water';
      delete qt.waterKind;
      qt.isRiver = false;
      qt.isLake = false;
      qt.onFireTimer = 0;
      if ((qt.tempOffset ?? 0) > 0) {
        qt.tempOffset = Math.max(0, (qt.tempOffset ?? 0) - 28);
      }
      if (steamVfxCount < 4 && state.pendingVfx.length < 48) {
        steamVfxCount++;
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'hit_spark',
          x: qt.x,
          y: 0.55,
          z: qt.z,
          radius: 1.35,
          color: '#e2e8f0',
          createdAt: Date.now(),
        });
      }
    }
  }
  if (pendingLavaPoison) {
    let corrodeVfxCount = 0;
    for (let i = 0; i < pendingLavaPoison.length; i++) {
      const [lt, pt] = pendingLavaPoison[i];
      for (const ct of [lt, pt]) {
        ct.height = 0;
        ct.terrain = 'scorched';
        delete ct.waterKind;
        ct.isRiver = false;
        ct.isLake = false;
        ct.cursedTimer = Math.max(ct.cursedTimer, 10);
        ct.resourceNode = 'none';
        ct.resourceAmount = 0;
      }
      if (corrodeVfxCount < 3 && state.pendingVfx.length < 48) {
        corrodeVfxCount++;
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'hit_spark',
          x: lt.x,
          y: 0.45,
          z: lt.z,
          radius: 1.5,
          color: '#a3e635',
          createdAt: Date.now(),
        });
      }
    }
  }
  if (pendingPoisonDilute) {
    let diluteVfxCount = 0;
    for (let i = 0; i < pendingPoisonDilute.length; i++) {
      const pt = pendingPoisonDilute[i];
      if (pt.height !== 0 || pt.waterKind !== 'poison') continue;
      delete pt.waterKind;
      pt.terrain = 'shallow_water';
      pt.isRiver = false;
      pt.isLake = false;
      if (diluteVfxCount < 2 && state.pendingVfx.length < 48) {
        diluteVfxCount++;
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'hit_spark',
          x: pt.x,
          y: 0.35,
          z: pt.z,
          radius: 1.0,
          color: '#5eead4',
          createdAt: Date.now(),
        });
      }
    }
  }

  // 7. Update building timers & fire/curse damage
  // Precompute living citizen presence and building counts per settlement once (O(U + B) instead of O(B * (U + B)))
  const livingCitizenSids = new Set<string>();
  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.faction === 'civilization' && u.state !== 'ko' && u.hp > 0 && u.settlementId) {
      livingCitizenSids.add(u.settlementId);
    }
  }
  const bldCountBySid = new Map<string, number>();
  for (let i = 0; i < state.buildings.length; i++) {
    const sid = state.buildings[i].settlementId ?? 'city_default';
    bldCountBySid.set(sid, (bldCountBySid.get(sid) ?? 0) + 1);
  }

  for (const b of state.buildings) {
    if (b.blessedTimer > 0) b.blessedTimer = Math.max(0, b.blessedTimer - dt);
    if (b.cursedTimer > 0) {
      b.cursedTimer = Math.max(0, b.cursedTimer - dt);
      if (b.shieldTimer <= 0) b.hp = Math.max(0, b.hp - 1.8 * dt);
    }
    if (b.shieldTimer > 0) b.shieldTimer = Math.max(0, b.shieldTimer - dt);
    const bTile = getTile(state, b.tileX, b.tileZ);
    if (bTile && bTile.onFireTimer > 0 && b.shieldTimer <= 0) {
      const burnDps = b.epochLevel <= 2 ? 44 : 34;
      b.hp = Math.max(0, b.hp - burnDps * dt);
    }
    // Individual building age progression & abandoned/intruding structure decay
    const bSpecies: SpeciesId =
      b.species ?? (b.settlementId ? state.settlementSpecies?.[b.settlementId] : undefined) ?? 'human';
    const bSid = b.settlementId ?? 'city_default';
    const hasLivingCitizensInSettlement = livingCitizenSids.has(bSid);
    if (!hasLivingCitizensInSettlement && !state.sandboxFreeMode) {
      const settlementBldCount = bldCountBySid.get(bSid) ?? 0;
      const inEnemyTerritory = state.buildings.some(
        (ob) =>
          (ob.settlementId ?? 'city_default') !== bSid &&
          (ob.species ?? 'human') !== bSpecies &&
          (ob.tileX - b.tileX) ** 2 + (ob.tileZ - b.tileZ) ** 2 <= 24 * 24,
      );
      if (settlementBldCount <= 1 && b.constructionProgress < 100) {
        // Unfinished single structure planted by a killed intruder collapses immediately
        b.hp = 0;
      } else {
        // Abandoned buildings decay so surrounding kingdom territory slowly creeps in until destroyed
        b.hp = Math.max(0, b.hp - (inEnemyTerritory ? 28 : 12) * dt);
      }
    } else if (bSpecies === 'elf' && b.constructionProgress >= 100 && b.hp < b.maxHp) {
      b.hp = Math.min(b.maxHp, b.hp + 1.5 * dt);
    }
    const bSettlementEpoch = getSettlementEpoch(state, b.settlementId);
    if (b.constructionProgress >= 100 && b.epochLevel < bSettlementEpoch && b.cursedTimer <= 0) {
      const epochGap = bSettlementEpoch - b.epochLevel;
      const idOffset = ((b.id.charCodeAt(b.id.length - 1) + b.tileX * 3 + b.tileZ * 5) % 7) * 0.08;
      const blessBoost = b.blessedTimer > 0 ? 1.65 : 1.0;
      const speciesUpgradeMult =
        bSpecies === 'human'
          ? 1.25
          : bSpecies === 'elf'
            ? 0.78
            : state.sandboxFreeMode
              ? 0.65
              : 0.28;
      const baseRate = state.sandboxFreeMode ? 16 + epochGap * 6 : (3.4 + epochGap * 2.0) * (b.epochLevel >= 5 ? 0.55 : 1.0);
      const passiveUpgradeRate = baseRate * (0.82 + idOffset) * blessBoost * speciesUpgradeMult;
      b.upgradeProgress = (b.upgradeProgress ?? 0) + passiveUpgradeRate * dt;
      if (b.upgradeProgress >= 100) {
        b.upgradeProgress = 0;
        b.epochLevel = Math.min(bSettlementEpoch, b.epochLevel + 1);
        b.maxHp += 40;
        b.hp = Math.min(b.maxHp, b.hp + 55);
        if (bTile && bTile.terrain === 'stone_road') {
          bTile.terrain = 'grass';
        }
        if (b.epochLevel >= 1) {
          paveSettlementStreetsNear(state, b.tileX, b.tileZ, b.settlementId ?? 'city_default');
        }
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'build_complete',
          x: b.tileX,
          y: (bTile?.height ?? 2) * 0.45,
          z: b.tileZ,
          radius: 1.4,
          color: b.epochLevel >= 6 ? '#56cfe1' : b.epochLevel >= 5 ? '#3a86ff' : '#f5b742',
          createdAt: Date.now(),
        });
      }
    }
  }

  // 8. Update unit AI & status effects
  const remainingUnits: UnitEntity[] = [];
  const hazardsList = state.activeHazards ?? [];
  const hasWormholeRift = hazardsList.some((h) => h.kind === 'wormhole_rift');

  simPathBudget.resetTick();
  pooledTickIndex = buildSimulationTickIndex(
    state,
    (s, sid) => (sid ? getKingdomId(s, sid) : undefined),
    isCarnivoreAnimal,
    pooledTickIndex,
  );
  activeTickIndex = pooledTickIndex;
  try {
  for (const u of state.units) {
    u.prevX = u.x;
    u.prevZ = u.z;
    const suspendedInVortex =
      hasWormholeRift &&
      !u.statusEffects.shielded &&
      hazardsList.some(
        (h) => h.kind === 'wormhole_rift' && Math.hypot(u.x - h.x, u.z - h.z) <= h.radius * 1.45,
      );
    if (u.state === 'ko') {
      if (suspendedInVortex) {
        remainingUnits.push(u);
        continue;
      }
      const altKo = u.altitude ?? 0;
      const vzKo = u.vzVertical ?? 0;
      if (altKo > 0 || vzKo !== 0) {
        if (u.vxAir) {
          u.x += u.vxAir * dt;
          if (u.x < 1 || u.x > state.gridSize - 2) {
            u.x = Math.max(1, Math.min(state.gridSize - 2, u.x));
            u.vxAir *= -0.35;
          }
        }
        if (u.vzAir) {
          u.z += u.vzAir * dt;
          if (u.z < 1 || u.z > state.gridSize - 2) {
            u.z = Math.max(1, Math.min(state.gridSize - 2, u.z));
            u.vzAir *= -0.35;
          }
        }
        const nextVzKo = vzKo - 22.0 * dt;
        const nextAltKo = altKo + nextVzKo * dt;
        if (nextAltKo <= 0) {
          u.altitude = 0;
          u.vzVertical = 0;
          u.vxAir = 0;
          u.vzAir = 0;
        } else {
          u.altitude = nextAltKo;
          u.vzVertical = nextVzKo;
        }
        remainingUnits.push(u);
        continue;
      }
      u.koTimer -= dt;
      if (u.koTimer > 0) {
        remainingUnits.push(u);
      } else {
        const wStats = ensureWorldStats(state);
        wStats.totalDeaths += 1;
        const diedDef = UNIT_BY_ROLE.get(u.role);
        if (MYTHICAL_ROLE_SET.has(u.role) || diedDef?.category === 'mythical') {
          wStats.mythicalDeaths += 1;
        } else if (diedDef?.category === 'animal') {
          wStats.wildlifeDeaths += 1;
        }
        if (u.faction === 'hostile') {
          wStats.hostilesKilled += 1;
          recordCombatDeathForMemorial(state, u);
        } else if (u.faction === 'civilization') {
          wStats.civilianDeaths += 1;
          recordCombatDeathForMemorial(state, u);
        }
        if (u.isKing && (u.ageYears ?? 0) < (u.maxLifespan ?? 999)) {
          addChronicle(state, `${u.name} has fallen! The realm mourns and seeks a worthy successor.`, 'warning', { x: u.x, z: u.z });
        } else if (u.role === 'leviathan') {
          addChronicle(state, `The Leviathan (${u.name}) has been defeated! The seas are safe again.`, 'divine', { x: u.x, z: u.z });
        } else if (u.role === 'dragon') {
          addChronicle(state, `Dragon ${u.name} has been vanquished!`, 'divine', { x: u.x, z: u.z });
        }
      }
      continue;
    }

    decayUnitStatusEffects(u, dt);

    if (u.statusEffects.plagued) {
      u.hp -= 4.5 * dt;
      const tickNum = simTickCounterByState.get(state) ?? 0;
      if (activeTickIndex && ((tickNum + (u.appearanceSeed ?? 0)) & 3) === 0) {
        forEachUnitInRadius(activeTickIndex, u.x, u.z, 1.12, (other, dSq) => {
          if (
            other.id !== u.id &&
            other.state !== 'ko' &&
            !MYTHICAL_ROLE_SET.has(other.role) &&
            other.role !== 'skeleton' &&
            other.role !== 'alien_trooper' &&
            other.role !== 'alien_ufo' &&
            other.role !== 'alien_walker' &&
            !other.statusEffects.plagued &&
            !other.statusEffects.shielded &&
            !other.statusEffects.blessed &&
            dSq < 1.2
          ) {
            other.statusEffects.plagued = 14;
          }
        });
      }
    }

    const def = UNIT_BY_ROLE.get(u.role)!;
    const effStats = computeUnitEffectiveStats(u, def, {
      worldImmortal: state.worldRules?.immortalEntities === true,
    });

    if (u.maxLifespan === undefined) {
      u.maxLifespan = Math.max(10, Math.round(getUnitMaxLifespan(u) + effStats.lifespanBonus));
    }
    const immortalEntity = state.worldRules?.immortalEntities === true || effStats.immortal;
    u.ageYears = (u.ageYears ?? Math.max(0, state.year - (u.bornYear ?? state.year))) + YEARS_PER_SEC_AT_1X * dt;

    if (!immortalEntity && u.ageYears >= u.maxLifespan) {
      u.hp = 0;
      u.state = 'ko';
      u.koTimer = 0.45;
      if (u.isKing) {
        addChronicle(
          state,
          `${u.name} passed away peacefully of old age at ${Math.floor(u.ageYears)} years.`,
          'divine',
        );
      }
      remainingUnits.push(u);
      continue;
    }

    // Passive HP regeneration from traits, genes, items, or stat edits
    if (effStats.regenPerSec > 0 && u.hp > 0 && u.hp < u.maxHp) {
      u.hp = Math.min(u.maxHp, u.hp + effStats.regenPerSec * dt);
    }

    // Environmental liquid hazards: Lava & Poison lakes/rivers gradually kill non-flying, non-immune units
    if (!u.embarkedVehicleId && !u.statusEffects.shielded && !FLYING_WILDLIFE_ROLES.has(u.role) && u.role !== 'alien_ufo') {
      const liquidTile = getTile(state, u.x, u.z);
      if (liquidTile && liquidTile.height === 0) {
        if (
          liquidTile.waterKind === 'lava' &&
          !effStats.fireproof &&
          u.role !== 'golem' &&
          u.role !== 'cerberus' &&
          u.role !== 'gargoyle'
        ) {
          u.hp -= 28 * dt;
          u.underAttackTimer = Math.max(u.underAttackTimer ?? 0, 1.0);
        } else if (
          liquidTile.waterKind === 'poison' &&
          u.role !== 'giant_spider' &&
          u.role !== 'hydra' &&
          u.role !== 'basilisk'
        ) {
          u.hp -= 16 * dt;
          u.statusEffects.plagued = Math.max(u.statusEffects.plagued ?? 0, 5.0);
          u.underAttackTimer = Math.max(u.underAttackTimer ?? 0, 1.0);
        }
      }
    }

    if (u.hp <= 0) {
      // Phoenix signature power: Rebirth from Ashes (revives once in a fiery blast at 65% HP!)
      if (u.role === 'phoenix' && !u.phoenixReborn) {
        u.phoenixReborn = true;
        u.hp = Math.round(u.maxHp * 0.65);
        delete u.statusEffects.cursed;
        delete u.statusEffects.plagued;
        delete u.statusEffects.frozen;
        u.statusEffects.shielded = 3.0;
        u.attackAnimTimer = 0.65;
        const rebirthR = 4.2;
        const rebirthRSq = rebirthR * rebirthR;
        const scorchNearby = (other: UnitEntity, dSq: number) => {
          if (other.id === u.id || other.state === 'ko' || dSq > rebirthRSq) return;
          if (other.faction === 'hostile' || other.id === u.lastAttackerId) {
            other.hp -= 38;
            other.lastAttackerId = u.id;
            other.underAttackTimer = 8.0;
          }
        };
        if (activeTickIndex) {
          forEachUnitInRadius(activeTickIndex, u.x, u.z, rebirthR + 0.1, scorchNearby);
        } else {
          for (const other of state.units) {
            scorchNearby(other, (other.x - u.x) ** 2 + (other.z - u.z) ** 2);
          }
        }
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'animal_attack',
          variant: 'horn_blast',
          originX: u.x,
          originZ: u.z,
          x: u.x,
          y: 0.5,
          z: u.z,
          radius: 3.4,
          color: '#ff6b1a',
          createdAt: Date.now(),
        });
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'hit_spark',
          x: u.x,
          y: 0.7,
          z: u.z,
          radius: 2.8,
          color: '#fbbf24',
          createdAt: Date.now(),
        });
        addChronicle(state, `${u.name} burst into flames and rose again from the ashes!`, 'divine');
      } else {
        u.state = 'ko';
        u.koTimer = 0.45;
        if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
        remainingUnits.push(u);
        continue;
      }
    }

    if (u.ageStage === 'child') {
      u.growthTimer = (u.growthTimer ?? 24) - dt;
      if (u.growthTimer <= 0) {
        u.ageStage = 'adult';
        u.growthTimer = undefined;
        syncUnitDerivedStats(u, true);
      }
    }

    const tileUnder = getTile(state, u.x, u.z);
    const roadBoost = tileUnder?.terrain === 'stone_road' ? 1.45 : tileUnder?.terrain === 'crystal_field' ? 1.6 : 1.0;
    const statusSpeedMult =
      (u.statusEffects.blessed ? 1.6 : 1.0) *
      (u.statusEffects.frenzied ? 1.5 : 1.0) *
      (u.statusEffects.cursed ? 0.55 : 1.0) *
      (u.statusEffects.frozen ? 0.06 : 1.0);
    const moveSpeed = effStats.speed * roadBoost * statusSpeedMult;

    if (u.actionCooldown > 0) u.actionCooldown = Math.max(0, u.actionCooldown - dt);
    if (u.weaponCooldown && u.weaponCooldown > 0) {
      u.weaponCooldown = Math.max(0, u.weaponCooldown - dt);
    }
    if (u.underAttackTimer && u.underAttackTimer > 0) {
      u.underAttackTimer = Math.max(0, u.underAttackTimer - dt);
      if (u.underAttackTimer <= 0) u.lastAttackerId = undefined;
    }
    if (u.attackAnimTimer && u.attackAnimTimer > 0) {
      u.attackAnimTimer = Math.max(0, u.attackAnimTimer - dt);
    }
    if (u.battlewillActive && u.battlewillActive > 0) {
      u.battlewillActive = Math.max(0, u.battlewillActive - dt);
    }
    if (u.battlewillCooldown && u.battlewillCooldown > 0) {
      u.battlewillCooldown = Math.max(0, u.battlewillCooldown - dt);
    }
    if (u.battlewillSlashTimer && u.battlewillSlashTimer > 0) {
      u.battlewillSlashTimer = Math.max(0, u.battlewillSlashTimer - dt);
    }
    if (u.dragonBreathCooldown && u.dragonBreathCooldown > 0) {
      u.dragonBreathCooldown = Math.max(0, u.dragonBreathCooldown - dt);
    }

    const capturedByBlackHole =
      hasWormholeRift &&
      !u.statusEffects.shielded &&
      hazardsList.some(
        (h) => h.kind === 'wormhole_rift' && Math.hypot(u.x - h.x, u.z - h.z) <= h.radius * 1.45,
      );
    const capturedByTornado =
      !u.statusEffects.shielded &&
      hazardsList.some(
        (h) => h.kind === 'tornado_vortex' && Math.hypot(u.x - h.x, u.z - h.z) <= h.radius * 1.35,
      );
    const suspendedInGravity =
      !u.statusEffects.shielded &&
      u.role !== 'dragon' &&
      u.role !== 'alien_ufo' &&
      hazardsList.some(
        (h) => h.kind === 'gravity_anomaly' && h.remaining > 0 && Math.hypot(u.x - h.x, u.z - h.z) <= h.radius,
      );

    // Airborne ballistic arc & fall-damage resolution (Black Hole flings, Tornado tosses, Gravity Flux, Bombs, Drag-Tool drops)
    let isAirborneOrDragged = Boolean(u.draggedByPlayer) || suspendedInGravity;
    if (
      !u.draggedByPlayer &&
      !capturedByBlackHole &&
      !capturedByTornado &&
      !suspendedInGravity &&
      u.role !== 'alien_ufo' &&
      !(u.role === 'leviathan' && (u.leviathanLeapTimer ?? 0) > 0)
    ) {
      const alt = u.altitude ?? 0;
      const vz = u.vzVertical ?? 0;
      if (alt > 0 || vz !== 0) {
        isAirborneOrDragged = true;
        if (u.vxAir) {
          u.x += u.vxAir * dt;
          if (u.x < 1 || u.x > state.gridSize - 2) {
            u.x = Math.max(1, Math.min(state.gridSize - 2, u.x));
            u.vxAir *= -0.35;
          }
        }
        if (u.vzAir) {
          u.z += u.vzAir * dt;
          if (u.z < 1 || u.z > state.gridSize - 2) {
            u.z = Math.max(1, Math.min(state.gridSize - 2, u.z));
            u.vzAir *= -0.35;
          }
        }
        const nextVz = vz - 22.0 * dt;
        const nextAlt = alt + nextVz * dt;
        if (nextAlt <= 0) {
          const impactSpeed = Math.abs(nextVz);
          u.altitude = 0;
          u.vzVertical = 0;
          u.vxAir = 0;
          u.vzAir = 0;
          u.targetX = u.x;
          u.targetZ = u.z;
          const wasDragFling = Boolean(u.dragFlingNonLethal);
          u.dragFlingNonLethal = false;
          if (u.fallDamageArmed) {
            u.fallDamageArmed = false;
            const landTile = getTile(state, Math.round(u.x), Math.round(u.z));
            const isWaterLanding = !landTile || landTile.height === 0;
            if (u.role !== 'dragon' && !u.statusEffects.shielded && impactSpeed > 5.5) {
              let fallDmg = isWaterLanding
                ? Math.max(0, Math.round((impactSpeed - 8.0) * 3.5))
                : Math.max(30, Math.round(impactSpeed * 12.5));
              if (wasDragFling) {
                // Drag fling impacts deal scaled, non-lethal impact damage and never kill or KO
                fallDmg = Math.min(Math.max(0, u.hp - 1), Math.round(impactSpeed * 3.5));
              }
              if (fallDmg > 0) {
                u.hp = Math.max(wasDragFling ? 1 : 0, u.hp - fallDmg);
                state.pendingVfx.push({
                  id: nextEntityId('vfx'),
                  type: 'hit_spark',
                  x: u.x,
                  y: (landTile?.height ?? 0) * 0.45 + 0.25,
                  z: u.z,
                  radius: 1.05,
                  color: isWaterLanding ? '#4ea8de' : '#ff6b6b',
                  createdAt: Date.now(),
                });
                if (u.hp <= 0 && !wasDragFling) {
                  u.state = 'ko';
                  u.koTimer = 0.45;
                  if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
                }
              }
            }
          }
        } else {
          u.altitude = nextAlt;
          u.vzVertical = nextVz;
        }
      }
    }

    if (!capturedByBlackHole && !capturedByTornado && !isAirborneOrDragged && u.state !== 'ko' && !u.statusEffects.frozen) {
      if (u.faction === 'hostile') {
        stepHostileUnitAI(state, u, def, moveSpeed, dt);
      } else if (u.faction === 'wildlife') {
        stepWildlifeAI(state, u, def, moveSpeed, dt);
      } else {
        stepCivilianUnitAI(state, u, def, moveSpeed, dt);
      }
    }

    remainingUnits.push(u);
  }

  state.units = remainingUnits;

  // Remove destroyed buildings and immediately clean up wiped-out settlements & their zones
  const destroyedSettlementIds = new Set<string>();
  state.buildings = state.buildings.filter((b) => {
    if (b.hp <= 0) {
      ensureWorldStats(state).buildingsDestroyed += 1;
      const t = getTile(state, b.tileX, b.tileZ);
      if (t) {
        if (t.buildingId === b.id) t.buildingId = null;
        if (t.height > 0) {
          t.terrain = 'scorched';
          t.devastatedTimer = Math.max(t.devastatedTimer ?? 0, 28);
          if (state.worldRules?.wildfireSpread !== false) {
            t.onFireTimer = Math.max(t.onFireTimer, 6.0);
          }
        }
      }
      if (b.settlementId) {
        destroyedSettlementIds.add(b.settlementId);
        if (!state.settlementRebuildCooldowns) state.settlementRebuildCooldowns = {};
        state.settlementRebuildCooldowns[b.settlementId] = Math.min(
          38,
          (state.settlementRebuildCooldowns[b.settlementId] ?? 0) + 12,
        );
      }
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'hit_spark',
        x: b.tileX,
        y: (t?.height ?? 2) * 0.45 + 0.3,
        z: b.tileZ,
        radius: 1.4,
        color: '#ff6b6b',
        createdAt: Date.now(),
      });
      return false;
    }
    return true;
  });

  if (destroyedSettlementIds.size > 0) {
    const fallenIds = new Set<string>();
    for (const sid of destroyedSettlementIds) {
      const stillHasBlds = state.buildings.some((b) => b.settlementId === sid);
      const stillHasUnits = state.units.some(
        (u) => u.faction === 'civilization' && u.state !== 'ko' && u.hp > 0 && u.settlementId === sid,
      );
      if (!stillHasBlds && !stillHasUnits) {
        ensureWorldStats(state).citiesDestroyed += 1;
        const fallenName = state.settlementNames?.[sid];
        if (fallenName) {
          addChronicle(
            state,
            `The settlement of ${fallenName} has been completely destroyed and reduced to ruins!`,
            'warning',
          );
        }
        if (state.settlementNames) delete state.settlementNames[sid];
        if (state.settlementSpecies) delete state.settlementSpecies[sid];
        if (state.settlementKingdoms) delete state.settlementKingdoms[sid];
        fallenIds.add(sid);
      }
    }
    if (fallenIds.size > 0) {
      for (const t of state.tiles) {
        if (t.farmSettlementId && fallenIds.has(t.farmSettlementId)) {
          t.farmSettlementId = undefined;
        }
        if (t.claimedSettlementId && fallenIds.has(t.claimedSettlementId)) {
          t.claimedSettlementId = undefined;
        }
      }
    }
  }

  // 8b. Void Goo infection spread & Void Wisp soul kinematics
  stepVoidGooAndWisps(state, dt);

  // 8c. Guarantee strictly 1 living King per kingdom (checked every 2nd tick for fast succession with half the scan cost)
  if ((simTick & 1) === 1) {
    ensureSettlementKings(state);
  }

  // 9. Update transit vehicles (Trains on rail_track, Cars on stone_road, Planes at airports)
  stepVehicles(state, dt);
  } finally {
    activeTickIndex = null;
  }

  // 10. Rare autonomous World Events (asteroids, volcanoes, super tornadoes, mega-quakes, climate waves, starfalls)
  stepRandomWorldEvents(state, dt, options?.skipRandomEvents);
}

const VEHICLE_DIRS: ReadonlyArray<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

// Tracks each train's recent tile keys so trains never get trapped orbiting tight micro-loops
const trainRecentTileHistory = new WeakMap<VehicleEntity, string[]>();

function wrapAngleRad(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function stepVehicles(state: SimulationState, dt: number): void {
  if (!state.vehicles) state.vehicles = [];

  const standingBldsBySid = new Map<string, number>();
  const completedBldsBySid = new Map<string, number>();
  const maxBldEpochBySid = new Map<string, number>();
  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    const sid = b.settlementId ?? 'city_default';
    standingBldsBySid.set(sid, (standingBldsBySid.get(sid) ?? 0) + 1);
    if (b.constructionProgress >= 100) {
      completedBldsBySid.set(sid, (completedBldsBySid.get(sid) ?? 0) + 1);
      const prevMax = maxBldEpochBySid.get(sid) ?? 0;
      if (b.epochLevel > prevMax) maxBldEpochBySid.set(sid, b.epochLevel);
    }
  }

  let totalLivingCivUnits = 0;
  const livingCitizensBySid = new Map<string, number>();
  const livingCitizensByKid = new Map<string, number>();
  const unattachedCivUnits: UnitEntity[] = [];
  for (const u of state.units) {
    if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0) continue;
    totalLivingCivUnits++;
    if (u.settlementId) {
      livingCitizensBySid.set(u.settlementId, (livingCitizensBySid.get(u.settlementId) ?? 0) + 1);
      const kid = u.kingdomId ?? getKingdomId(state, u.settlementId);
      if (kid) {
        livingCitizensByKid.set(kid, (livingCitizensByKid.get(kid) ?? 0) + 1);
      }
    } else if (u.kingdomId) {
      livingCitizensByKid.set(u.kingdomId, (livingCitizensByKid.get(u.kingdomId) ?? 0) + 1);
      unattachedCivUnits.push(u);
    } else {
      unattachedCivUnits.push(u);
    }
  }

  // A settlement can only field or sustain vehicles if it still has standing buildings AND a living population!
  const isSettlementAliveAndPopulated = (sid: string): boolean => {
    if ((standingBldsBySid.get(sid) ?? 0) <= 0) return false;
    if (totalLivingCivUnits <= 0) return false;
    if ((livingCitizensBySid.get(sid) ?? 0) > 0) return true;
    const kid = getKingdomId(state, sid);
    if (kid && (livingCitizensByKid.get(kid) ?? 0) > 0) return true;
    if (unattachedCivUnits.length > 0) {
      const anchor = getSettlementAnchorForId(state, sid);
      const maxDistSq = (SETTLEMENT_AWARENESS_RADIUS + 4) ** 2;
      for (const u of unattachedCivUnits) {
        if ((u.x - anchor.x) ** 2 + (u.z - anchor.z) ** 2 <= maxDistSq) {
          return true;
        }
      }
    }
    return false;
  };

  // Compute each settlement's actual technological epoch from its own kingdom's age
  const getSettlementTechEpoch = (sid: string): number => {
    const kEpoch = getSettlementEpoch(state, sid);
    if (state.sandboxFreeMode || standingBldsBySid.size <= 1) return kEpoch;
    const maxBldEpoch = maxBldEpochBySid.get(sid) ?? 0;
    const completedCount = completedBldsBySid.get(sid) ?? 0;
    if (completedCount >= 6) return kEpoch;
    if (completedCount >= 3) return Math.min(kEpoch, Math.max(maxBldEpoch + 1, 1));
    return Math.min(kEpoch, maxBldEpoch);
  };

  // Prune vehicles whose HP reached 0, whose settlement/kingdom has fallen or lost all population, or whose epoch is unreached
  state.vehicles = state.vehicles.filter((v) => {
    if (v.hp === undefined) v.hp = v.maxHp ?? 100;
    if (v.maxHp === undefined) v.maxHp = Math.max(100, v.hp);
    const aliveSettlement = isSettlementAliveAndPopulated(v.settlementId);
    if (v.hp <= 0 || !aliveSettlement) {
      if (v.passengerIds && v.passengerIds.length > 0) {
        for (const pid of v.passengerIds) {
          const pu = activeTickIndex?.unitsById.get(pid) ?? state.units.find((u) => u.id === pid);
          if (pu) pu.embarkedVehicleId = undefined;
        }
      }
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'hit_spark',
        x: v.x,
        y: (v.y ?? 0.1) + 0.35,
        z: v.z,
        radius: v.isMilitary ? 1.85 : 1.25,
        color: '#ff6b35',
        createdAt: Date.now(),
      });
      return false;
    }
    const vEpoch = getSettlementTechEpoch(v.settlementId);
    if (v.type === 'passenger_ship') return true;
    if (v.type === 'plane') {
      return (
        vEpoch >= 4 &&
        state.buildings.some(
          (b) =>
            b.hp > 0 &&
            b.type === 'airport' &&
            b.constructionProgress >= 100 &&
            (b.settlementId ?? 'city_default') === v.settlementId,
        )
      );
    }
    if (v.type === 'warship') return vEpoch >= 1;
    if (
      v.type === 'train' ||
      v.type === 'car' ||
      v.type === 'tank' ||
      v.type === 'glider' ||
      v.type === 'airship' ||
      v.type === 'farm_tractor' ||
      v.type === 'quarry_truck'
    ) {
      return vEpoch >= 3;
    }
    if (v.type === 'bomber_plane' || v.type === 'helicopter' || v.type === 'orc_flyer') return vEpoch >= 4;
    if (v.type === 'roadster') return vEpoch >= 5;
    if (v.type === 'orbital_gunship') return vEpoch >= 6;
    return false;
  });

  const settlementIds = Array.from(completedBldsBySid.keys()).filter((sid) =>
    isSettlementAliveAndPopulated(sid),
  );

  // Throttle heavy vehicle spawning tile scans to ~0.8 Hz (movement in section D still runs at full tick rate)
  const vSpawnAccum = (vehicleSpawnAccumByState.get(state) ?? 1.2) + dt;
  const runVehicleSpawners = vSpawnAccum >= 1.2;
  vehicleSpawnAccumByState.set(state, runVehicleSpawners ? 0 : vSpawnAccum);

  if (runVehicleSpawners) {
  // A0. Maintain active Civilian / Passenger & Cargo Ships (Epoch 0+ canoes/rafts -> galleys -> medieval carracks/longships -> steam ferries -> car ferries -> cruise ships -> star-liners)
  for (const sid of settlementIds) {
    if (state.vehicles.filter((v) => v.type === 'passenger_ship').length >= 16) break;
    const cityEpoch = getSettlementTechEpoch(sid);
    const targetShipsPerCity = state.worldTemplate === 'scrap_sea' || state.worldTemplate === 'archipelago' ? 2 : 1;
    const existingShips = state.vehicles.filter((v) => v.type === 'passenger_ship' && v.settlementId === sid).length;
    if (existingShips >= targetShipsPerCity) continue;
    const anchor = getSettlementAnchorForId(state, sid);
    let coastalWater: TileData | null = null;
    for (let r = 1; r <= 16 && !coastalWater; r++) {
      for (let a = 0; a < 12; a++) {
        const ang = ((a + existingShips * 3) / 12) * Math.PI * 2;
        const wx = Math.round(anchor.x + Math.cos(ang) * r);
        const wz = Math.round(anchor.z + Math.sin(ang) * r);
        const wt = getTile(state, wx, wz);
        if (wt && wt.height === 0 && !wt.isLake && !wt.buildingId) {
          coastalWater = wt;
          break;
        }
      }
    }
    if (coastalWater) {
      const sp: SpeciesId = state.settlementSpecies?.[sid] ?? 'human';
      const shipHp = 130 + cityEpoch * 35;
      state.vehicles.push({
        id: nextEntityId('veh_shp'),
        type: 'passenger_ship',
        species: sp,
        settlementId: sid,
        kingdomId: getKingdomId(state, sid),
        hp: shipHp,
        maxHp: shipHp,
        epochLevel: cityEpoch,
        x: coastalWater.x,
        y: cityEpoch >= 6 ? 0.22 : 0.12,
        z: coastalWater.z,
        heading: Math.random() * Math.PI * 2,
        pitch: 0,
        bank: 0,
        speed: 2.6 + cityEpoch * 0.35,
        path: [{ x: coastalWater.x, z: coastalWater.z }],
        pathIndex: 0,
        variantSeed: existingShips + coastalWater.x * 5 + coastalWater.z * 11,
        passengerIds: [],
      });
    }
  }

  // A. Maintain active trains (Industrial Epoch 3+ per settlement)
  for (const sid of settlementIds) {
    const cityEpoch = getSettlementTechEpoch(sid);
    if (cityEpoch < 3) continue;
    const targetPerCity = cityEpoch >= 5 ? 2 : 1;
    if (state.vehicles.filter((v) => v.type === 'train').length >= 8) break;
    const existingCount = state.vehicles.filter((v) => v.type === 'train' && v.settlementId === sid).length;
    if (existingCount >= targetPerCity) continue;
    const anchor = getSettlementAnchorForId(state, sid);
    const railCandidates: TileData[] = [];
    for (let dz = -14; dz <= 14; dz++) {
      for (let dx = -14; dx <= 14; dx++) {
        const rt = getTile(state, anchor.x + dx, anchor.z + dz);
        if (rt && rt.terrain === 'rail_track') {
          railCandidates.push(rt);
        }
      }
    }
    if (railCandidates.length >= 4) {
      const startTile = railCandidates[(existingCount * 7) % railCandidates.length];
      let nextTile = startTile;
      for (const [ox, oz] of VEHICLE_DIRS) {
        const nb = getTile(state, startTile.x + ox, startTile.z + oz);
        if (nb && nb.terrain === 'rail_track') {
          nextTile = nb;
          break;
        }
      }
      const sp: SpeciesId = state.settlementSpecies?.[sid] ?? 'human';
      state.vehicles.push({
        id: nextEntityId('veh_trn'),
        type: 'train',
        species: sp,
        settlementId: sid,
        hp: 160,
        maxHp: 160,
        epochLevel: cityEpoch,
        x: startTile.x,
        y: 0.03,
        z: startTile.z,
        heading: Math.atan2(nextTile.x - startTile.x, nextTile.z - startTile.z),
        pitch: 0,
        bank: 0,
        speed: 3.0,
        path: [
          { x: startTile.x, z: startTile.z },
          { x: nextTile.x, z: nextTile.z },
        ],
        pathIndex: 1,
        variantSeed: railCandidates.length + existingCount,
      });
    }
  }

  // B. Maintain active automobiles (Industrial Epoch 3+ per settlement)
  for (const sid of settlementIds) {
    const cityEpoch = getSettlementTechEpoch(sid);
    if (cityEpoch < 3) continue;
    const targetCarsPerCity = cityEpoch === 3 ? 2 : cityEpoch === 4 ? 4 : 6;
    if (state.vehicles.filter((v) => v.type === 'car').length >= 24) break;
    const existingCount = state.vehicles.filter((v) => v.type === 'car' && v.settlementId === sid).length;
    if (existingCount >= targetCarsPerCity) continue;
    const anchor = getSettlementAnchorForId(state, sid);
    const roadCandidates: TileData[] = [];
    for (let dz = -14; dz <= 14; dz++) {
      for (let dx = -14; dx <= 14; dx++) {
        const rt = getTile(state, anchor.x + dx, anchor.z + dz);
        if (rt && rt.terrain === 'stone_road') {
          roadCandidates.push(rt);
        }
      }
    }
    if (roadCandidates.length >= 4) {
      const startTile = roadCandidates[(existingCount * 5 + 1) % roadCandidates.length];
      let nextTile = startTile;
      for (const [ox, oz] of VEHICLE_DIRS) {
        const nb = getTile(state, startTile.x + ox, startTile.z + oz);
        if (nb && nb.terrain === 'stone_road') {
          nextTile = nb;
          break;
        }
      }
      const sp: SpeciesId = state.settlementSpecies?.[sid] ?? 'human';
      state.vehicles.push({
        id: nextEntityId('veh_car'),
        type: 'car',
        species: sp,
        settlementId: sid,
        hp: 90,
        maxHp: 90,
        epochLevel: cityEpoch,
        x: startTile.x,
        y: cityEpoch >= 6 ? 0.14 : 0.02,
        z: startTile.z,
        heading: Math.atan2(nextTile.x - startTile.x, nextTile.z - startTile.z),
        pitch: 0,
        bank: 0,
        speed: 2.6,
        path: [
          { x: startTile.x, z: startTile.z },
          { x: nextTile.x, z: nextTile.z },
        ],
        pathIndex: 1,
        variantSeed: existingCount + startTile.x * 7 + startTile.z * 13,
      });
    }
  }

  // B1.5. Maintain Industrial+ Farm Tractors (working dedicated farmland plots) & Quarry Haul Trucks (mining stone/ore)
  for (const sid of settlementIds) {
    const cityEpoch = getSettlementTechEpoch(sid);
    if (cityEpoch < 3) continue;
    const sp: SpeciesId = state.settlementSpecies?.[sid] ?? 'human';
    const kid = getKingdomId(state, sid);
    const anchor = getSettlementAnchorForId(state, sid);

    // Farm Tractor: spawns when settlement has >= 4 farmland tiles around its windmill/granary
    if (
      state.vehicles.filter((v) => v.type === 'farm_tractor').length < 12 &&
      !state.vehicles.some((v) => v.type === 'farm_tractor' && v.settlementId === sid)
    ) {
      const farmTiles: TileData[] = [];
      for (let dz = -14; dz <= 14; dz++) {
        for (let dx = -14; dx <= 14; dx++) {
          const ft = getTile(state, anchor.x + dx, anchor.z + dz);
          if (ft && ft.farmSettlementId === sid && ft.farmPlotKind === 'wheat' && ft.height > 0 && !ft.buildingId) {
            farmTiles.push(ft);
          }
        }
      }
      if (farmTiles.length >= 4) {
        const startF = farmTiles[0];
        const nextF = farmTiles[Math.min(1, farmTiles.length - 1)];
        state.vehicles.push({
          id: nextEntityId('veh_trc'),
          type: 'farm_tractor',
          species: sp,
          settlementId: sid,
          kingdomId: kid,
          hp: 110,
          maxHp: 110,
          epochLevel: cityEpoch,
          x: startF.x,
          y: 0.02,
          z: startF.z,
          heading: Math.atan2(nextF.x - startF.x, nextF.z - startF.z),
          pitch: 0,
          bank: 0,
          speed: 1.85,
          path: [
            { x: startF.x, z: startF.z },
            { x: nextF.x, z: nextF.z },
          ],
          pathIndex: 1,
          variantSeed: startF.x * 7 + startF.z * 13,
        });
      }
    }

    // Quarry Truck: spawns when settlement has a Smeltery or Steam Foundry to haul rock & ore from dedicated Quarry Territory
    if (
      state.vehicles.filter((v) => v.type === 'quarry_truck').length < 12 &&
      !state.vehicles.some((v) => v.type === 'quarry_truck' && v.settlementId === sid)
    ) {
      const quarryHub = state.buildings.find(
        (b) =>
          b.settlementId === sid &&
          b.constructionProgress >= 100 &&
          (b.type === 'steam_foundry' || b.type === 'smeltery'),
      );
      if (quarryHub) {
        const districts = state.settlementDistricts?.[sid];
        let quarryTile: TileData | null = districts ? getTile(state, districts.quarryX, districts.quarryZ) ?? null : null;
        if (quarryTile && (quarryTile.height <= 0 || quarryTile.buildingId)) {
          quarryTile = null;
        }
        let bestDistSq = Infinity;
        if (!quarryTile) {
          for (let dz = -16; dz <= 16; dz++) {
            for (let dx = -16; dx <= 16; dx++) {
              const qt = getTile(state, quarryHub.tileX + dx, quarryHub.tileZ + dz);
              if (!qt || qt.height <= 0 || qt.buildingId) continue;
              if (
                qt.farmPlotKind === 'quarry' ||
                qt.resourceNode === 'ore_vein' ||
                qt.resourceNode === 'stone_outcrop' ||
                qt.terrain === 'rock' ||
                qt.terrain === 'mountain' ||
                qt.terrain === 'badlands'
              ) {
                const dSq = dx * dx + dz * dz;
                if (dSq >= 4 && dSq < bestDistSq) {
                  bestDistSq = dSq;
                  quarryTile = qt;
                }
              }
            }
          }
        }
        if (quarryTile) {
          state.vehicles.push({
            id: nextEntityId('veh_qry'),
            type: 'quarry_truck',
            species: sp,
            settlementId: sid,
            kingdomId: kid,
            hp: 165,
            maxHp: 165,
            epochLevel: cityEpoch,
            x: quarryHub.tileX,
            y: 0.02,
            z: quarryHub.tileZ,
            heading: Math.atan2(quarryTile.x - quarryHub.tileX, quarryTile.z - quarryHub.tileZ),
            pitch: 0,
            bank: 0,
            speed: 2.05,
            path: [
              { x: quarryHub.tileX, z: quarryHub.tileZ },
              { x: quarryTile.x, z: quarryTile.z },
            ],
            pathIndex: 1,
            variantSeed: quarryHub.tileX * 5 + quarryHub.tileZ * 11,
          });
        }
      }
    }
  }

  // B2. Easter Egg: Latest Tesla Roadster with SpaceX Cold-Gas Thruster Stunts (Information Age Epoch 5+ per settlement)
  for (const sid of settlementIds) {
    const cityEpoch = getSettlementTechEpoch(sid);
    if (cityEpoch < 5) continue;
    if (state.vehicles.filter((v) => v.type === 'roadster').length >= 2) break;
    const alreadyHas = state.vehicles.some((v) => v.type === 'roadster' && v.settlementId === sid);
    if (alreadyHas) continue;
    const anchor = getSettlementAnchorForId(state, sid);
    const roadCandidates: TileData[] = [];
    for (let dz = -14; dz <= 14; dz++) {
      for (let dx = -14; dx <= 14; dx++) {
        const rt = getTile(state, anchor.x + dx, anchor.z + dz);
        if (rt && rt.terrain === 'stone_road') {
          roadCandidates.push(rt);
        }
      }
    }
    if (roadCandidates.length >= 6) {
      const startTile = roadCandidates[Math.floor(roadCandidates.length / 2)];
      let nextTile = startTile;
      for (const [ox, oz] of VEHICLE_DIRS) {
        const nb = getTile(state, startTile.x + ox, startTile.z + oz);
        if (nb && nb.terrain === 'stone_road') {
          nextTile = nb;
          break;
        }
      }
      const sp: SpeciesId = state.settlementSpecies?.[sid] ?? 'human';
      const roadsterCount = state.vehicles.filter((v) => v.type === 'roadster').length;
      state.vehicles.push({
        id: nextEntityId('veh_rds'),
        type: 'roadster',
        species: sp,
        settlementId: sid,
        hp: 110,
        maxHp: 110,
        epochLevel: cityEpoch,
        x: startTile.x,
        y: cityEpoch >= 6 ? 0.12 : 0.02,
        z: startTile.z,
        heading: Math.atan2(nextTile.x - startTile.x, nextTile.z - startTile.z),
        pitch: 0,
        bank: 0,
        speed: 6.4,
        path: [
          { x: startTile.x, z: startTile.z },
          { x: nextTile.x, z: nextTile.z },
        ],
        pathIndex: 1,
        variantSeed: roadsterCount * 17 + startTile.x * 3 + startTile.z * 11,
        stuntPhase: 'cruise',
        stuntTimer: 2.2 + roadsterCount * 1.1,
        stuntDuration: 2.2,
        thrusterActive: false,
      });
      const cityName = state.settlementNames?.[sid] ?? 'the metropolis';
      addChronicle(
        state,
        `Easter Egg: A thruster-equipped Tesla Roadster hit the streets of ${cityName} pulling aerial propulsion stunts!`,
        'divine',
      );
    }
  }

  // C. Maintain active aircraft at completed airports (Atomic Epoch 4+ per settlement)
  const airports = state.buildings.filter(
    (b) =>
      b.hp > 0 &&
      b.type === 'airport' &&
      b.constructionProgress >= 100 &&
      isSettlementAliveAndPopulated(b.settlementId ?? 'city_default'),
  );
  if (airports.length > 0) {
    for (const ap of airports) {
      if (state.vehicles.filter((v) => v.type === 'plane').length >= 6) break;
      const apSid = ap.settlementId ?? 'city_default';
      const cityEpoch = getSettlementTechEpoch(apSid);
      if (cityEpoch < 4) continue;
      const targetPlanesPerAirport = cityEpoch >= 5 ? 2 : 1;
      const existingAtSid = state.vehicles.filter(
        (v) => v.type === 'plane' && v.settlementId === apSid,
      ).length;
      if (existingAtSid >= targetPlanesPerAirport) continue;
      const sp: SpeciesId = ap.species ?? state.settlementSpecies?.[apSid] ?? 'human';
      state.vehicles.push({
        id: nextEntityId('veh_pln'),
        type: 'plane',
        species: sp,
        settlementId: apSid,
        hp: 140,
        maxHp: 140,
        epochLevel: cityEpoch,
        x: ap.tileX,
        y: 0.06,
        z: ap.tileZ,
        heading: Math.PI / 2,
        pitch: 0,
        bank: 0,
        speed: 4.5,
        path: [{ x: ap.tileX, z: ap.tileZ }],
        pathIndex: 0,
        variantSeed: ap.tileX + existingAtSid * 17,
        flightPhase: 'parked',
        phaseTimer: existingAtSid * 1.4,
      });
    }
  }
  }

  const airports = state.buildings.filter(
    (b) =>
      b.hp > 0 &&
      b.type === 'airport' &&
      b.constructionProgress >= 100,
  );

  // D. Advance every vehicle smoothly
  for (const v of state.vehicles) {
    v.epochLevel = getSettlementTechEpoch(v.settlementId);

    if (v.type === 'passenger_ship') {
      const cityEpoch = v.epochLevel ?? state.epochIndex;
      v.speed = 2.6 + cityEpoch * 0.38;
      v.y = cityEpoch >= 6 ? 0.22 : 0.12;
      if (!v.passengerIds) v.passengerIds = [];

      // Keep only living embarked passengers and sync their position to the ship deck
      v.passengerIds = v.passengerIds.filter((pid) => {
        const pu = state.units.find((u) => u.id === pid);
        if (!pu || pu.state === 'ko' || pu.hp <= 0) return false;
        pu.embarkedVehicleId = v.id;
        pu.x = v.x;
        pu.z = v.z;
        pu.isSwimming = false;
        pu.swimStamina = 100;
        return true;
      });

      const homeAnchor = getSettlementAnchorForId(state, v.settlementId);
      const myKid = v.kingdomId ?? getKingdomId(state, v.settlementId);

      // 1. Pick up nearby units who are swimming in open water OR need sea transport across water
      if (v.passengerIds.length < 4) {
        for (const u of state.units) {
          if (v.passengerIds.length >= 4) break;
          if (u.faction !== 'civilization' || u.state === 'ko' || u.hp <= 0 || u.embarkedVehicleId) continue;
          const uKid = u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId;
          if (myKid && uKid && myKid !== uKid) continue;
          const dShip = Math.hypot(u.x - v.x, u.z - v.z);
          if (dShip > 4.2) continue;

          const destX = u.expeditionTargetX ?? u.targetX;
          const destZ = u.expeditionTargetZ ?? u.targetZ;
          const destDist = Math.hypot(destX - u.x, destZ - u.z);
          const midTile = getTile(state, Math.round((u.x + destX) * 0.5), Math.round((u.z + destZ) * 0.5));
          const needsWaterCrossing =
            Boolean(u.isSwimming) ||
            (destDist >= 6 && Boolean(midTile && midTile.height === 0 && midTile.terrain !== 'stone_road'));

          if (needsWaterCrossing) {
            v.passengerIds.push(u.id);
            u.embarkedVehicleId = v.id;
            u.isSwimming = false;
            u.swimStamina = 100;
            v.targetIslandX = destX;
            v.targetIslandZ = destZ;
          }
        }
      }

      // 2. Disembark passengers when the ship arrives near their target island / coast / floating city
      if (v.passengerIds.length > 0) {
        const firstPassenger = state.units.find((u) => u.id === v.passengerIds![0]);
        const pDestX = firstPassenger ? (firstPassenger.expeditionTargetX ?? firstPassenger.targetX) : (v.targetIslandX ?? homeAnchor.x);
        const pDestZ = firstPassenger ? (firstPassenger.expeditionTargetZ ?? firstPassenger.targetZ) : (v.targetIslandZ ?? homeAnchor.z);
        v.targetIslandX = pDestX;
        v.targetIslandZ = pDestZ;

        const distToDest = Math.hypot(pDestX - v.x, pDestZ - v.z);
        // Check if there is land, a walkway, or the destination itself within 2.5 tiles of the ship
        let landingTile: TileData | null = null;
        if (distToDest <= 5.5) {
          for (let dz = -2; dz <= 2 && !landingTile; dz++) {
            for (let dx = -2; dx <= 2; dx++) {
              const lt = getTile(state, Math.round(v.x) + dx, Math.round(v.z) + dz);
              if (
                lt &&
                (lt.height > 0 ||
                  lt.terrain === 'stone_road' ||
                  lt.buildingId ||
                  Math.hypot(lt.x - pDestX, lt.z - pDestZ) <= 1.8)
              ) {
                landingTile = lt;
                break;
              }
            }
          }
        }
        if (landingTile) {
          for (const pid of v.passengerIds) {
            const pu = state.units.find((u) => u.id === pid);
            if (pu) {
              pu.embarkedVehicleId = undefined;
              pu.x = landingTile.x + (Math.random() - 0.5) * 0.4;
              pu.z = landingTile.z + (Math.random() - 0.5) * 0.4;
              pu.isSwimming = false;
              pu.swimStamina = 100;
            }
          }
          v.passengerIds = [];
          v.targetIslandX = undefined;
          v.targetIslandZ = undefined;
        }
      }

      // 3. Determine navigation goal: passenger destination, waiting coastal swimmer/colonist, sea resource node, or coastal cruise
      let goalX = v.targetIslandX;
      let goalZ = v.targetIslandZ;

      if (goalX === undefined || goalZ === undefined) {
        // Check if any friendly citizen within 24 tiles is swimming or waiting to cross water
        for (const u of state.units) {
          if (u.faction !== 'civilization' || u.state === 'ko' || u.embarkedVehicleId) continue;
          const uKid = u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId;
          if (myKid && uKid && myKid !== uKid) continue;
          if (Math.hypot(u.x - v.x, u.z - v.z) <= 24 && (u.isSwimming || u.expeditionTargetX !== undefined)) {
            goalX = u.x;
            goalZ = u.z;
            break;
          }
        }
      }

      if (goalX === undefined || goalZ === undefined) {
        // Look for nearby sea resources (scrap_flotsam, coral_reef, atlantis_ruin) to harvest for the kingdom
        let bestSeaNode: TileData | null = null;
        let bestNodeDist = 26;
        const rx = Math.round(v.x);
        const rz = Math.round(v.z);
        for (let dz = -20; dz <= 20; dz += 2) {
          for (let dx = -20; dx <= 20; dx += 2) {
            const st = getTile(state, rx + dx, rz + dz);
            if (
              st &&
              st.height === 0 &&
              st.resourceAmount > 0 &&
              (st.coralBleachTimer ?? 0) <= 0 &&
              (st.resourceNode === 'scrap_flotsam' ||
                st.resourceNode === 'coral_reef' ||
                st.resourceNode === 'atlantis_ruin')
            ) {
              const nd = Math.hypot(st.x - v.x, st.z - v.z);
              if (nd < bestNodeDist) {
                bestNodeDist = nd;
                bestSeaNode = st;
              }
            }
          }
        }
        if (bestSeaNode) {
          goalX = bestSeaNode.x;
          goalZ = bestSeaNode.z;
          if (bestNodeDist <= 2.2) {
            const take = Math.min(bestSeaNode.resourceAmount, Math.max(1, Math.round(12 * dt * 3)));
            if (Math.random() < dt * 2.5) {
              bestSeaNode.resourceAmount = Math.max(0, bestSeaNode.resourceAmount - take);
              if (bestSeaNode.resourceNode === 'scrap_flotsam') {
                recordHarvestDeposit(state, 'wood', take * 0.6, myKid);
                recordHarvestDeposit(state, 'stone', take * 0.4, myKid);
                recordHarvestDeposit(state, 'ore', take * 0.3, myKid);
              } else if (bestSeaNode.resourceNode === 'coral_reef') {
                recordHarvestDeposit(state, 'food', take * 0.8, myKid);
                recordHarvestDeposit(state, 'knowledge', take * 0.25, myKid);
              } else if (bestSeaNode.resourceNode === 'atlantis_ruin') {
                recordHarvestDeposit(state, 'knowledge', take * 0.7, myKid);
                recordHarvestDeposit(state, 'alloy', take * 0.5, myKid);
                recordHarvestDeposit(state, 'faith', take * 0.4, myKid);
              }
              if (bestSeaNode.resourceAmount <= 0) {
                if (bestSeaNode.resourceNode === 'coral_reef') {
                  bestSeaNode.resourceNode = 'coral_reef';
                  bestSeaNode.resourceAmount = 0;
                  bestSeaNode.coralBleachTimer = 26;
                } else {
                  bestSeaNode.resourceNode = 'none';
                  bestSeaNode.resourceAmount = 0;
                }
              }
            }
          }
        }
      }

      if (goalX === undefined || goalZ === undefined) {
        const orbitR = 9 + (v.variantSeed % 7);
        const orbitAng = (state.year * 0.48 + v.variantSeed * 1.3) % (Math.PI * 2);
        goalX = Math.max(3, Math.min(state.gridSize - 4, homeAnchor.x + Math.cos(orbitAng) * orbitR));
        goalZ = Math.max(3, Math.min(state.gridSize - 4, homeAnchor.z + Math.sin(orbitAng) * orbitR));
      }

      const dx = goalX - v.x;
      const dz = goalZ - v.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.25) {
        const desiredHeading = Math.atan2(dx, dz);
        const turnDelta = wrapAngleRad(desiredHeading - v.heading);
        v.heading = wrapAngleRad(v.heading + Math.max(-2.4 * dt, Math.min(2.4 * dt, turnDelta)));
        const step = v.speed * dt;
        const nx = Math.max(2, Math.min(state.gridSize - 3, v.x + Math.sin(v.heading) * step));
        const nz = Math.max(2, Math.min(state.gridSize - 3, v.z + Math.cos(v.heading) * step));
        const nt = getTile(state, Math.round(nx), Math.round(nz));
        if (nt && nt.height === 0 && !nt.buildingId) {
          v.x = nx;
          v.z = nz;
        } else {
          // Steer around land/obstacles in water
          let foundWaterDir = false;
          for (const offsetAng of [0.65, -0.65, 1.3, -1.3, 2.1, -2.1]) {
            const testH = wrapAngleRad(v.heading + offsetAng);
            const tx = Math.max(2, Math.min(state.gridSize - 3, v.x + Math.sin(testH) * step));
            const tz = Math.max(2, Math.min(state.gridSize - 3, v.z + Math.cos(testH) * step));
            const tt = getTile(state, Math.round(tx), Math.round(tz));
            if (tt && tt.height === 0 && !tt.buildingId) {
              v.heading = testH;
              v.x = tx;
              v.z = tz;
              foundWaterDir = true;
              break;
            }
          }
          if (!foundWaterDir) {
            v.heading = wrapAngleRad(v.heading + Math.PI * dt);
          }
        }
      }
      continue;
    }

    if (v.type === 'train') {
      const vEpoch = v.epochLevel ?? 3;
      v.speed = vEpoch <= 3 ? 2.9 : vEpoch === 4 ? 4.0 : vEpoch === 5 ? 5.4 : 6.8;
      // Information Age (5) and Space Age (6+) trains ride high on suspended viaducts above streets!
      v.y = vEpoch >= 5 ? 0.78 : 0.03;
      const target = v.path[1] ?? v.path[0] ?? { x: v.x, z: v.z };
      const dx = target.x - v.x;
      const dz = target.z - v.z;
      const dist = Math.hypot(dx, dz);
      const step = v.speed * dt;
      if (dist > step && dist > 0.02) {
        v.x += (dx / dist) * step;
        v.z += (dz / dist) * step;
        const desiredHeading = Math.atan2(dx, dz);
        v.heading += wrapAngleRad(desiredHeading - v.heading) * Math.min(1, dt * 12);
      } else {
        v.x = target.x;
        v.z = target.z;
        const prev = v.path[0] ?? target;
        const curX = Math.round(target.x);
        const curZ = Math.round(target.z);

        let history = trainRecentTileHistory.get(v);
        if (!history) {
          history = [];
          trainRecentTileHistory.set(v, history);
        }
        const curKey = `${curX},${curZ}`;
        if (history[history.length - 1] !== curKey) {
          history.push(curKey);
          if (history.length > 16) history.shift();
        }

        const candidates: Array<{ x: number; z: number; cost: number }> = [];
        for (const [ox, oz] of VEHICLE_DIRS) {
          const nx = curX + ox;
          const nz = curZ + oz;
          const nt = getTile(state, nx, nz);
          if (!nt) continue;
          let destTile: TileData | null = null;
          if (nt.terrain === 'rail_track') {
            destTile = nt;
          } else if (nt.terrain === 'stone_road') {
            // Allow smooth grade crossing across 1- or 2-tile boulevards onto continuation rail_track
            const beyond1 = getTile(state, nx + ox, nz + oz);
            if (beyond1 && beyond1.terrain === 'rail_track') {
              destTile = beyond1;
            } else if (beyond1 && beyond1.terrain === 'stone_road') {
              const beyond2 = getTile(state, nx + ox * 2, nz + oz * 2);
              if (beyond2 && beyond2.terrain === 'rail_track') {
                destTile = beyond2;
              }
            }
          }
          if (!destTile) continue;

          const isReverse = Math.abs(destTile.x - prev.x) < 0.2 && Math.abs(destTile.z - prev.z) < 0.2;
          const candHeading = Math.atan2(destTile.x - target.x, destTile.z - target.z);
          const angDiff = Math.abs(wrapAngleRad(candHeading - v.heading));
          // Strongly prefer smooth gradual curves & straightaways over sharp 90° bends
          let cost = isReverse ? 500 : angDiff * 36;
          // Penalize turning back onto any recently traversed tile (prevents small micro-loops)
          const recentIdx = history.lastIndexOf(`${destTile.x},${destTile.z}`);
          if (recentIdx >= 0) {
            cost += (recentIdx + 1) * 14;
          }
          candidates.push({ x: destTile.x, z: destTile.z, cost });
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => a.cost - b.cost);
          // If nearly tied forward paths exist, break ties deterministically with seed
          const bestCost = candidates[0].cost;
          const topPool = candidates.filter((c) => c.cost <= bestCost + 6);
          const pickIdx =
            topPool.length === 1
              ? 0
              : Math.abs(v.variantSeed + curX * 3 + curZ * 5) % topPool.length;
          const chosen = topPool[pickIdx];
          v.path = [{ x: target.x, z: target.z }, { x: chosen.x, z: chosen.z }];
        }
      }
    } else if (v.type === 'car') {
      const vEpoch = v.epochLevel ?? 3;
      const isStarHybrid = vEpoch >= 7;
      const isAirborneMode = isStarHybrid && v.flightPhase === 'cruise';
      v.speed = vEpoch <= 3 ? 2.2 : vEpoch === 4 ? 3.2 : vEpoch === 5 ? 4.2 : isAirborneMode ? 7.2 : 5.4;

      if (!isStarHybrid) {
        v.y = vEpoch >= 6 ? 0.14 : 0.02;
        v.pitch = 0;
        v.bank = 0;
      }

      const target = v.path[1] ?? v.path[0] ?? { x: v.x, z: v.z };
      const dx = target.x - v.x;
      const dz = target.z - v.z;
      const dist = Math.hypot(dx, dz);
      const step = v.speed * dt;
      if (dist > step && dist > 0.02) {
        v.x += (dx / dist) * step;
        v.z += (dz / dist) * step;
        const desiredHeading = Math.atan2(dx, dz);
        const turnDelta = wrapAngleRad(desiredHeading - v.heading);
        v.heading += turnDelta * Math.min(1, dt * (isAirborneMode ? 6.5 : 14));

        if (isStarHybrid) {
          // Smooth hybrid altitude curve: climb into aerial sky-lane in mid-flight, descend smoothly toward destination street
          const legStart = v.path[0] ?? target;
          const totalLeg = Math.max(1, Math.hypot(target.x - legStart.x, target.z - legStart.z));
          const progress = Math.max(0, Math.min(1, 1 - dist / totalLeg));
          const cruiseAlt = 1.65 + (v.variantSeed % 4) * 0.24;
          const targetY = isAirborneMode
            ? 0.14 + Math.sin(progress * Math.PI) * cruiseAlt
            : 0.14;
          const prevY = v.y;
          v.y += (targetY - v.y) * Math.min(1, dt * 6.5);
          const climbRate = (v.y - prevY) / Math.max(0.016, dt);
          v.pitch = Math.max(-0.28, Math.min(0.28, -climbRate * 0.12));
          v.bank = isAirborneMode
            ? Math.max(-0.38, Math.min(0.38, -turnDelta * 0.55))
            : v.bank * Math.max(0, 1 - dt * 8);
          v.thrusterActive = v.y > 0.32;
        }
      } else {
        v.x = target.x;
        v.z = target.z;
        if (isStarHybrid) {
          v.y = 0.14;
          v.pitch = 0;
          v.bank = 0;
          v.thrusterActive = false;
          // Alternate between road cruising and aerial sky-lane hops (~45% chance to take off after a road leg!)
          const shouldTakeOff =
            !isAirborneMode &&
            ((v.variantSeed + Math.floor(state.year * 17) + Math.round(target.x * 3 + target.z * 7)) % 5 < 2);
          if (shouldTakeOff && v.settlementId) {
            const anchor = getSettlementAnchorForId(state, v.settlementId);
            const skyTargets: Array<{ x: number; z: number }> = [];
            for (let sz = -16; sz <= 16; sz += 2) {
              for (let sx = -16; sx <= 16; sx += 2) {
                const st = getTile(state, anchor.x + sx, anchor.z + sz);
                if (st && st.terrain === 'stone_road') {
                  const d = Math.hypot(st.x - target.x, st.z - target.z);
                  if (d >= 7 && d <= 22) skyTargets.push({ x: st.x, z: st.z });
                }
              }
            }
            if (skyTargets.length > 0) {
              const pick = skyTargets[Math.abs(v.variantSeed + Math.floor(state.year * 23)) % skyTargets.length];
              v.flightPhase = 'cruise';
              v.path = [{ x: target.x, z: target.z }, pick];
              continue;
            }
          }
          v.flightPhase = undefined;
        }

        const prev = v.path[0] ?? target;
        const candidates: Array<{ x: number; z: number; ang: number }> = [];
        for (const [ox, oz] of VEHICLE_DIRS) {
          const nx = Math.round(target.x + ox);
          const nz = Math.round(target.z + oz);
          const nt = getTile(state, nx, nz);
          if (nt && nt.terrain === 'stone_road') {
            const isReverse = Math.abs(nx - prev.x) < 0.2 && Math.abs(nz - prev.z) < 0.2;
            const candHeading = Math.atan2(nx - target.x, nz - target.z);
            const ang = isReverse ? 99 : Math.abs(wrapAngleRad(candHeading - v.heading));
            candidates.push({ x: nx, z: nz, ang });
          }
        }
        if (candidates.length > 0) {
          candidates.sort((a, b) => a.ang - b.ang);
          // Favor smooth forward/diagonal curves (~75% forward bias) while still exploring crossroads
          const smoothPool = candidates.filter((c) => c.ang <= Math.PI * 0.56);
          const pool = smoothPool.length > 0 ? smoothPool : candidates;
          const pickIdx =
            (v.variantSeed + Math.floor(Math.abs(state.year * 100)) + Math.round(target.x + target.z)) %
            pool.length;
          const nextPt = pool[Math.abs(pickIdx)];
          v.path = [{ x: target.x, z: target.z }, { x: nextPt.x, z: nextPt.z }];
        }
      }
    } else if (v.type === 'farm_tractor') {
      const vEpoch = v.epochLevel ?? 3;
      v.speed = vEpoch <= 3 ? 1.85 : vEpoch === 4 ? 2.25 : 2.75;
      v.y = 0.02;
      const target = v.path[1] ?? v.path[0] ?? { x: v.x, z: v.z };
      const dx = target.x - v.x;
      const dz = target.z - v.z;
      const dist = Math.hypot(dx, dz);
      const step = v.speed * dt;
      if (dist > step && dist > 0.04) {
        v.x += (dx / dist) * step;
        v.z += (dz / dist) * step;
        const desiredHeading = Math.atan2(dx, dz);
        v.heading += wrapAngleRad(desiredHeading - v.heading) * Math.min(1, dt * 10);
      } else {
        v.x = target.x;
        v.z = target.z;
        // Harvest crops at this farmland tile & replant so mechanized farming stays super productive
        const curFarmTile = getTile(state, Math.round(v.x), Math.round(v.z));
        if (curFarmTile && curFarmTile.farmSettlementId === v.settlementId && curFarmTile.farmPlotKind === 'wheat') {
          const harvestYield = 10 + Math.min(8, (vEpoch - 3) * 3);
          const vKid = v.kingdomId ?? getKingdomId(state, v.settlementId);
          grantResourcesToKingdomOrPool(state, { food: harvestYield }, vKid);
          curFarmTile.resourceNode = 'berry_bush';
          curFarmTile.resourceAmount = 220;
        }
        // Pick next farmland tile in the settlement's organized farm rows
        const anchor = getSettlementAnchorForId(state, v.settlementId);
        const farmRows: TileData[] = [];
        for (let fz = -14; fz <= 14; fz++) {
          for (let fx = -14; fx <= 14; fx++) {
            const ft = getTile(state, anchor.x + fx, anchor.z + fz);
            if (ft && ft.farmSettlementId === v.settlementId && ft.farmPlotKind === 'wheat' && ft.height > 0 && !ft.buildingId) {
              farmRows.push(ft);
            }
          }
        }
        if (farmRows.length > 0) {
          const nextIdx = (v.pathIndex + 1) % farmRows.length;
          v.pathIndex = nextIdx;
          const nextTile = farmRows[nextIdx];
          v.path = [{ x: v.x, z: v.z }, { x: nextTile.x, z: nextTile.z }];
        }
      }
    } else if (v.type === 'quarry_truck') {
      const vEpoch = v.epochLevel ?? 3;
      v.speed = vEpoch <= 3 ? 2.0 : vEpoch === 4 ? 2.5 : 3.1;
      v.y = 0.02;
      const target = v.path[1] ?? v.path[0] ?? { x: v.x, z: v.z };
      const dx = target.x - v.x;
      const dz = target.z - v.z;
      const dist = Math.hypot(dx, dz);
      const step = v.speed * dt;
      if (dist > step && dist > 0.05) {
        v.x += (dx / dist) * step;
        v.z += (dz / dist) * step;
        const desiredHeading = Math.atan2(dx, dz);
        v.heading += wrapAngleRad(desiredHeading - v.heading) * Math.min(1, dt * 9);
      } else {
        v.x = target.x;
        v.z = target.z;
        // Shuttle back and forth between quarry hub (path[0]) and rock/ore deposit (path[1])
        const hubPt = v.path[0] ?? { x: v.x, z: v.z };
        const depositPt = v.path[1] ?? { x: v.x, z: v.z };
        const vKid = v.kingdomId ?? getKingdomId(state, v.settlementId);
        // When returning to quarry hub (pathIndex === 0), deposit high-efficiency Stone, Ore & Alloy
        if (v.pathIndex === 0) {
          const stoneHaul = 14 + Math.min(10, (vEpoch - 3) * 4);
          const oreHaul = 12 + Math.min(10, (vEpoch - 3) * 3);
          const alloyHaul = vEpoch >= 5 ? 6 : 0;
          grantResourcesToKingdomOrPool(state, { stone: stoneHaul, ore: oreHaul, alloy: alloyHaul }, vKid);
        }
        v.pathIndex = v.pathIndex === 1 ? 0 : 1;
        v.path = [depositPt, hubPt];
      }
    } else if (v.type === 'roadster') {
      const vEpoch = v.epochLevel ?? 5;
      const baseRoadY = vEpoch >= 6 ? 0.12 : 0.02;
      const baseCruiseSpeed = vEpoch >= 6 ? 7.2 : 6.2;
      const stuntPhase = v.stuntPhase ?? 'cruise';
      v.stuntTimer = (v.stuntTimer ?? 2.5) - dt;

      // Advance along stone_road network cleanly so aerial stunts stay centered over city corridors
      const target = v.path[1] ?? v.path[0] ?? { x: v.x, z: v.z };
      const dx = target.x - v.x;
      const dz = target.z - v.z;
      const dist = Math.hypot(dx, dz);
      const speedMult =
        stuntPhase === 'charge'
          ? 0.45
          : stuntPhase === 'cruise'
            ? 1.0
            : 1.38;
      v.speed = baseCruiseSpeed * speedMult;
      const step = v.speed * dt;
      if (dist > step && dist > 0.02) {
        v.x += (dx / dist) * step;
        v.z += (dz / dist) * step;
        if (stuntPhase !== 'hover_spin') {
          const desiredHeading = Math.atan2(dx, dz);
          v.heading += wrapAngleRad(desiredHeading - v.heading) * Math.min(1, dt * 16);
        }
      } else {
        v.x = target.x;
        v.z = target.z;
        const prev = v.path[0] ?? target;
        const candidates: Array<{ x: number; z: number; ang: number }> = [];
        for (const [ox, oz] of VEHICLE_DIRS) {
          const nx = Math.round(target.x + ox);
          const nz = Math.round(target.z + oz);
          const nt = getTile(state, nx, nz);
          if (nt && nt.terrain === 'stone_road') {
            const isReverse = Math.abs(nx - prev.x) < 0.2 && Math.abs(nz - prev.z) < 0.2;
            const candHeading = Math.atan2(nx - target.x, nz - target.z);
            const ang = isReverse ? 99 : Math.abs(wrapAngleRad(candHeading - v.heading));
            candidates.push({ x: nx, z: nz, ang });
          }
        }
        if (candidates.length > 0) {
          candidates.sort((a, b) => a.ang - b.ang);
          const smoothPool = candidates.filter((c) => c.ang <= Math.PI * 0.56);
          const pool = smoothPool.length > 0 ? smoothPool : candidates;
          const pickIdx =
            (v.variantSeed + Math.floor(Math.abs(state.year * 140)) + Math.round(target.x * 3 + target.z)) %
            pool.length;
          const nextPt = pool[Math.abs(pickIdx)];
          v.path = [{ x: target.x, z: target.z }, { x: nextPt.x, z: nextPt.z }];
        }
      }

      if (stuntPhase === 'cruise') {
        v.y = baseRoadY;
        v.pitch = 0;
        v.bank = 0;
        v.thrusterActive = false;
        if (v.stuntTimer <= 0) {
          v.stuntPhase = 'charge';
          v.stuntDuration = 0.34;
          v.stuntTimer = 0.34;
          v.thrusterActive = true;
        }
      } else if (stuntPhase === 'charge') {
        const dur = Math.max(0.1, v.stuntDuration ?? 0.34);
        const p = Math.min(1, Math.max(0, 1 - (v.stuntTimer ?? 0) / dur));
        v.y = baseRoadY + p * 0.14;
        v.pitch = -0.22 * p;
        v.bank = 0;
        v.thrusterActive = true;
        if ((v.stuntTimer ?? 0) <= 0) {
          const tricks: Array<'launch_flip' | 'barrel_roll' | 'hover_spin'> = [
            'launch_flip',
            'barrel_roll',
            'hover_spin',
          ];
          const nextTrick = tricks[Math.abs(v.variantSeed) % tricks.length];
          v.variantSeed += 1;
          v.stuntPhase = nextTrick;
          const trickDur = nextTrick === 'hover_spin' ? 1.65 : nextTrick === 'launch_flip' ? 1.55 : 1.45;
          v.stuntDuration = trickDur;
          v.stuntTimer = trickDur;
          v.thrusterActive = true;
        }
      } else {
        // Aerial propulsion stunt arc
        const dur = Math.max(0.4, v.stuntDuration ?? 1.5);
        const p = Math.min(1, Math.max(0, 1 - (v.stuntTimer ?? 0) / dur));
        const arc = Math.sin(p * Math.PI);
        v.thrusterActive = p < 0.88;
        if (stuntPhase === 'launch_flip') {
          v.y = baseRoadY + arc * 2.45;
          v.pitch = -p * Math.PI * 2;
          v.bank = 0;
        } else if (stuntPhase === 'barrel_roll') {
          v.y = baseRoadY + arc * 2.15;
          v.pitch = -0.18 * arc;
          v.bank = p * Math.PI * 2;
        } else {
          // hover_spin: VTOL cold-gas levitation + 720-degree thruster spin
          v.y = baseRoadY + arc * 1.95;
          v.pitch = -0.12 * arc;
          v.bank = Math.sin(p * Math.PI * 2) * 0.24;
          v.heading = wrapAngleRad(v.heading + dt * 9.8);
        }

        if ((v.stuntTimer ?? 0) <= 0) {
          v.stuntPhase = 'cruise';
          const cooldown = 3.2 + (Math.abs(v.variantSeed) % 3) * 0.9;
          v.stuntDuration = cooldown;
          v.stuntTimer = cooldown;
          v.y = baseRoadY;
          v.pitch = 0;
          v.bank = 0;
          v.thrusterActive = false;
        }
      }
    } else if (v.type === 'plane') {
      const homeAirport =
        airports.find((a) => (a.settlementId ?? 'city_default') === v.settlementId) ?? airports[0];
      if (!homeAirport) continue;

      const rwy = findAirportRunwayEndpoints(state, homeAirport);
      const rwyDirX = Math.sin(rwy.heading);
      const rwyDirZ = Math.cos(rwy.heading);
      const cruiseAlt = 4.6 + (v.variantSeed % 3) * 0.5;
      const vEpoch = v.epochLevel ?? 4;
      const cruiseSpeed = vEpoch <= 4 ? 5.0 : vEpoch === 5 ? 6.8 : 8.5;
      v.phaseTimer = (v.phaseTimer ?? 0) + dt;

      if (v.flightPhase === 'parked' || !v.flightPhase) {
        // Sit on the runway threshold and smoothly turn toward takeoff heading
        v.x += (rwy.start.x - v.x) * Math.min(1, dt * 4.5);
        v.z += (rwy.start.z - v.z) * Math.min(1, dt * 4.5);
        v.y = 0.06;
        v.pitch = 0;
        v.bank = 0;
        v.heading = wrapAngleRad(v.heading + wrapAngleRad(rwy.heading - v.heading) * Math.min(1, dt * 4.5));
        if (v.phaseTimer >= 1.4) {
          v.x = rwy.start.x;
          v.z = rwy.start.z;
          v.heading = rwy.heading;
          const waypoints: Array<{ x: number; z: number }> = [];
          const destAirport =
            airports.length > 1
              ? airports[(airports.indexOf(homeAirport) + 1) % airports.length]
              : homeAirport;
          const climbTarget = {
            x: Math.max(6, Math.min(state.gridSize - 7, rwy.end.x + rwyDirX * 10)),
            z: Math.max(6, Math.min(state.gridSize - 7, rwy.end.z + rwyDirZ * 10)),
          };
          waypoints.push({ x: rwy.end.x, z: rwy.end.z });
          waypoints.push(climbTarget);

          if (destAirport !== homeAirport) {
            waypoints.push({ x: destAirport.tileX, z: destAirport.tileZ });
          } else {
            const otherCities = settlementIds.filter((s) => s !== v.settlementId);
            if (otherCities.length > 0) {
              const oa = getSettlementAnchorForId(state, otherCities[v.variantSeed % otherCities.length]);
              waypoints.push({ x: oa.x, z: oa.z });
            } else {
              const perpX = -rwyDirZ;
              const perpZ = rwyDirX;
              waypoints.push({
                x: Math.max(6, Math.min(state.gridSize - 7, homeAirport.tileX + rwyDirX * 12 + perpX * 11)),
                z: Math.max(6, Math.min(state.gridSize - 7, homeAirport.tileZ + rwyDirZ * 12 + perpZ * 11)),
              });
              waypoints.push({
                x: Math.max(6, Math.min(state.gridSize - 7, homeAirport.tileX + rwyDirX * 10 - perpX * 11)),
                z: Math.max(6, Math.min(state.gridSize - 7, homeAirport.tileZ + rwyDirZ * 10 - perpZ * 11)),
              });
            }
          }

          // Final approach straight onto the far runway end, then roll back down the tarmac to park at threshold
          waypoints.push({
            x: Math.max(5, Math.min(state.gridSize - 6, rwy.end.x + rwyDirX * 6.0)),
            z: Math.max(5, Math.min(state.gridSize - 6, rwy.end.z + rwyDirZ * 6.0)),
          });
          waypoints.push({ x: rwy.end.x, z: rwy.end.z });
          waypoints.push({ x: rwy.start.x, z: rwy.start.z });

          v.path = waypoints;
          v.pathIndex = 0;
          v.flightPhase = 'takeoff';
          v.phaseTimer = 0;
        }
      } else if (v.flightPhase === 'takeoff') {
        const takeoffDur = 2.4;
        const frac = Math.min(1, v.phaseTimer / takeoffDur);
        const rollPortion = 0.52;
        if (frac < rollPortion) {
          // Ground acceleration down the dedicated runway strip
          const rollFrac = frac / rollPortion;
          const runwayTarget = v.path[0] ?? rwy.end;
          const desiredHeading = Math.atan2(runwayTarget.x - v.x, runwayTarget.z - v.z);
          v.heading = wrapAngleRad(
            v.heading + wrapAngleRad(desiredHeading - v.heading) * Math.min(1, dt * 6.0),
          );
          const rollSpeed = cruiseSpeed * (0.28 + 0.58 * rollFrac);
          v.x += Math.sin(v.heading) * rollSpeed * dt;
          v.z += Math.cos(v.heading) * rollSpeed * dt;
          v.y = 0.06;
          v.pitch = rollFrac > 0.72 ? -0.14 * ((rollFrac - 0.72) / 0.28) : 0;
          v.bank = 0;
        } else {
          // Wheels-up climbout after clearing the runway strip
          const climbFrac = (frac - rollPortion) / (1 - rollPortion);
          const climbWp = v.path[1] ?? { x: v.x + rwyDirX * 8, z: v.z + rwyDirZ * 8 };
          const desiredHeading = Math.atan2(climbWp.x - v.x, climbWp.z - v.z);
          v.heading = wrapAngleRad(
            v.heading + wrapAngleRad(desiredHeading - v.heading) * Math.min(1, dt * 2.5),
          );
          const climbSpeed = cruiseSpeed * (0.86 + 0.14 * climbFrac);
          v.x += Math.sin(v.heading) * climbSpeed * dt;
          v.z += Math.cos(v.heading) * climbSpeed * dt;
          v.y = 0.06 + climbFrac * climbFrac * (cruiseAlt - 0.06);
          v.pitch = -0.26 * Math.sin(climbFrac * Math.PI * 0.85);
          v.bank = 0;
        }
        if (frac >= 1) {
          v.flightPhase = 'cruise';
          v.phaseTimer = 0;
          v.pathIndex = Math.min(v.path.length - 1, 1);
        }
      } else if (v.flightPhase === 'cruise') {
        const wp = v.path[v.pathIndex] ?? { x: homeAirport.tileX, z: homeAirport.tileZ };
        const dx = wp.x - v.x;
        const dz = wp.z - v.z;
        const dist = Math.hypot(dx, dz);
        const desiredHeading = Math.atan2(dx, dz);
        const turnDelta = wrapAngleRad(desiredHeading - v.heading);
        const maxTurn = 2.4 * dt;
        const appliedTurn = Math.max(-maxTurn, Math.min(maxTurn, turnDelta));
        v.heading = wrapAngleRad(v.heading + appliedTurn);
        v.bank = Math.max(-0.42, Math.min(0.42, (appliedTurn / Math.max(0.001, dt)) * 0.22));
        v.pitch = 0;
        v.y += (cruiseAlt - v.y) * Math.min(1, dt * 4);
        v.x += Math.sin(v.heading) * cruiseSpeed * dt;
        v.z += Math.cos(v.heading) * cruiseSpeed * dt;

        if (dist < 2.2) {
          if (v.pathIndex < v.path.length - 3) {
            v.pathIndex += 1;
          } else {
            v.pathIndex = Math.max(0, v.path.length - 2);
            v.flightPhase = 'landing';
            v.phaseTimer = 0;
          }
        }
      } else if (v.flightPhase === 'landing') {
        const touchdownIdx = Math.max(0, v.path.length - 2);
        const stopIdx = Math.max(0, v.path.length - 1);
        const targetPt = v.path[v.pathIndex] ?? rwy.start;
        const dx = targetPt.x - v.x;
        const dz = targetPt.z - v.z;
        const dist = Math.hypot(dx, dz);
        const desiredHeading = Math.atan2(dx, dz);
        const turnDelta = wrapAngleRad(desiredHeading - v.heading);

        if (v.pathIndex <= touchdownIdx && v.path.length >= 2 && touchdownIdx !== stopIdx) {
          // Final glide slope onto the runway touchdown threshold
          const approachSpeed = cruiseSpeed * Math.max(0.45, Math.min(0.85, dist / 6.5));
          v.heading = wrapAngleRad(v.heading + Math.max(-2.5 * dt, Math.min(2.5 * dt, turnDelta)));
          v.bank = Math.max(-0.22, Math.min(0.22, turnDelta * 0.45));
          v.pitch = 0.11;
          if (dist > 0.65) {
            v.x += (dx / dist) * approachSpeed * dt;
            v.z += (dz / dist) * approachSpeed * dt;
            v.y = Math.max(0.06, Math.min(cruiseAlt, (dist / 6.5) * cruiseAlt));
          } else {
            // Wheels down on the runway -> transition to tarmac rollout
            v.x = targetPt.x;
            v.z = targetPt.z;
            v.y = 0.06;
            v.pitch = 0;
            v.bank = 0;
            v.pathIndex = stopIdx;
          }
        } else {
          // Decelerating ground rollout down the runway toward terminal apron
          const rolloutSpeed = cruiseSpeed * Math.max(0.22, Math.min(0.62, dist / 3.2));
          v.heading = wrapAngleRad(v.heading + Math.max(-3.0 * dt, Math.min(3.0 * dt, turnDelta)));
          v.bank = 0;
          v.pitch = 0;
          v.y = 0.06;
          if (dist > 0.35) {
            v.x += (dx / dist) * rolloutSpeed * dt;
            v.z += (dz / dist) * rolloutSpeed * dt;
          } else {
            v.x = targetPt.x;
            v.z = targetPt.z;
            v.y = 0.06;
            v.flightPhase = 'parked';
            v.phaseTimer = 0;
          }
        }
      }
    }
  }

  // E. Military Battle Vehicles (Historical Timeline Progression):
  //    - Sea: Warship (Epoch 1 Bronze Oared Galley -> Epoch 2 Sailing Galleon -> Epoch 3 Steam Ironclad -> Epoch 4 Gun Destroyer -> Epoch 5 Stealth Missile Destroyer -> Epoch 6+ Plasma Cruiser)
  //    - Land: Tank (Epoch 3 WWI Riveted Trench Tank -> Epoch 4 Atomic Cast-Turret Tank -> Epoch 5 Composite MBT -> Epoch 6+ Hover Railgun Tank)
  //    - Fixed-Wing Air (NON-HOVERING): Propeller Biplane Fighter ('glider', Epoch 3 Industrial) -> Bomber Plane (Epoch 4 Multi-Engine Prop Heavy Bomber -> Epoch 5 Supersonic Stealth Jet Bomber -> Epoch 6+ Plasma Delta Bomber)
  //    - Lighter-Than-Air / Rotor / VTOL Air: Rigid Airship / Sky-Ship (Epoch 3 Industrial) -> Helicopter / Orc Flyer (Epoch 4 Utility Chopper / Orc Skull-Chopper -> Epoch 5 Attack Gunship / Dread-Kopter) -> Orbital Gunship (Epoch 6+)
  const getEvolvedMilitaryAirType = (
    currentType: VehicleType,
    epochIdx: number,
    sp: SpeciesId,
  ): VehicleType => {
    if (currentType === 'warship' || currentType === 'tank') return currentType;
    if (currentType === 'glider' || currentType === 'bomber_plane') {
      return epochIdx >= 4 ? 'bomber_plane' : 'glider';
    }
    if (epochIdx >= 6) return 'orbital_gunship';
    if (epochIdx >= 4) return sp === 'orc' ? 'orc_flyer' : 'helicopter';
    return 'airship';
  };

  const getMilitaryVehicleStats = (mType: VehicleType, epochIdx: number) => {
    const e = Math.max(1, epochIdx);
    const tierBoost = 1 + (e - 1) * 0.24;
    if (mType === 'warship') {
      return {
        maxHp: Math.round(210 * tierBoost),
        speed: 2.9 + Math.min(3.0, (e - 1) * 0.45),
        fireRange: e >= 6 ? 12.5 : e >= 4 ? 11.0 : 9.5,
        fireCooldown: Math.max(1.25, 2.25 - (e - 1) * 0.16),
        dmg: Math.round(30 * (1 + (e - 1) * 0.3)),
        cruiseY: e >= 6 ? 0.24 : 0.14,
      };
    }
    if (mType === 'tank') {
      return {
        maxHp: Math.round(260 * (1 + Math.max(0, e - 3) * 0.26)),
        speed: e >= 6 ? 4.4 : 2.7 + Math.max(0, e - 3) * 0.42,
        fireRange: e >= 6 ? 10.2 : 7.8 + Math.max(0, e - 3) * 0.5,
        fireCooldown: Math.max(1.3, 2.05 - Math.max(0, e - 3) * 0.18),
        dmg: Math.round(36 * (1 + Math.max(0, e - 3) * 0.32)),
        cruiseY: e >= 6 ? 0.24 : 0.05,
      };
    }
    if (mType === 'helicopter') {
      return {
        maxHp: Math.round(215 * (1 + Math.max(0, e - 4) * 0.24)),
        speed: 4.9 + Math.max(0, e - 4) * 0.55,
        fireRange: 9.2,
        fireCooldown: Math.max(0.85, 1.35 - Math.max(0, e - 4) * 0.14),
        dmg: Math.round(28 * (1 + Math.max(0, e - 4) * 0.28)),
        cruiseY: 3.55,
      };
    }
    if (mType === 'orbital_gunship') {
      return {
        maxHp: Math.round(360 * (1 + Math.max(0, e - 6) * 0.3)),
        speed: 8.4 + Math.max(0, e - 6) * 0.9,
        fireRange: 13.0,
        fireCooldown: Math.max(1.05, 1.45 - Math.max(0, e - 6) * 0.15),
        dmg: Math.round(48 * (1 + Math.max(0, e - 6) * 0.35)),
        cruiseY: 6.4,
      };
    }
    if (mType === 'bomber_plane') {
      return {
        maxHp: Math.round(240 * (1 + Math.max(0, e - 4) * 0.25)),
        speed: 7.4 + Math.max(0, e - 4) * 0.85,
        fireRange: 11.4,
        fireCooldown: Math.max(1.65, 2.35 - Math.max(0, e - 4) * 0.18),
        dmg: Math.round(52 * (1 + Math.max(0, e - 4) * 0.28)),
        cruiseY: 5.2,
      };
    }
    if (mType === 'airship' || mType === 'orc_flyer') {
      return {
        maxHp: mType === 'airship' ? Math.round(220 * (1 + Math.max(0, e - 3) * 0.22)) : Math.round(210 * (1 + Math.max(0, e - 4) * 0.25)),
        speed: (mType === 'orc_flyer' ? 5.1 : 4.3) + Math.max(0, e - 3) * 0.35,
        fireRange: mType === 'airship' ? 10.2 : 8.5,
        fireCooldown: Math.max(1.25, 1.8 - Math.max(0, e - 3) * 0.12),
        dmg: Math.round((mType === 'orc_flyer' ? 32 : 28) * (1 + Math.max(0, e - 3) * 0.24)),
        cruiseY: mType === 'airship' ? 4.0 : 3.4,
      };
    }
    return {
      maxHp: Math.round(145 * (1 + Math.max(0, e - 3) * 0.28)),
      speed: 6.4 + Math.max(0, e - 3) * 0.45,
      fireRange: 8.2,
      fireCooldown: 1.35,
      dmg: Math.round(26 * (1 + Math.max(0, e - 3) * 0.25)),
      cruiseY: 3.1,
    };
  };

  if (settlementIds.length > 0) {
    // 0. Evolve existing military vehicles automatically as their home settlement advances through the ages
    for (const v of state.vehicles) {
      if (!v.isMilitary || (v.hp ?? 0) <= 0) continue;
      const cityEpoch = getSettlementTechEpoch(v.settlementId);
      const desiredType =
        v.type === 'warship' || v.type === 'tank'
          ? v.type
          : getEvolvedMilitaryAirType(v.type, cityEpoch, v.species);
      const nextStats = getMilitaryVehicleStats(desiredType, cityEpoch);
      if (v.type !== desiredType || v.maxHp !== nextStats.maxHp || v.speed !== nextStats.speed || v.epochLevel !== cityEpoch) {
        const evolvedTier = v.type !== desiredType || v.epochLevel !== cityEpoch;
        const oldMax = Math.max(1, v.maxHp ?? nextStats.maxHp);
        const curHp = v.hp ?? oldMax;
        v.type = desiredType;
        v.maxHp = nextStats.maxHp;
        v.hp = evolvedTier
          ? Math.min(nextStats.maxHp, Math.max(1, Math.round((curHp / oldMax) * nextStats.maxHp + nextStats.maxHp * 0.25)))
          : Math.min(nextStats.maxHp, Math.max(1, Math.round((curHp / oldMax) * nextStats.maxHp)));
        v.speed = nextStats.speed;
        v.y = nextStats.cruiseY;
        v.epochLevel = cityEpoch;
        if (evolvedTier) {
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'build_complete',
            x: v.x,
            y: nextStats.cruiseY,
            z: v.z,
            radius: 1.6,
            color: desiredType === 'orbital_gunship' ? '#56cfe1' : '#ffd166',
            createdAt: Date.now(),
          });
        }
      }
    }

    // Compute era-scaled global military vehicle cap so Industrial has a few vehicles per city
    // while Information Age+ superpowers field full armored columns and air wings.
    let industrialAtomicCities = 0;
    let infoPlusCities = 0;
    for (const sid of settlementIds) {
      const ce = getSettlementTechEpoch(sid);
      if (ce >= 5) infoPlusCities++;
      else if (ce >= 3) industrialAtomicCities++;
    }
    const maxGlobalMilitaryVehicles = Math.min(72, 24 + industrialAtomicCities * 3 + infoPlusCities * 7);

    const militaryVehiclesCount = state.vehicles.filter((v) => v.isMilitary).length;
    if (runVehicleSpawners && militaryVehiclesCount < maxGlobalMilitaryVehicles) {
      let currentGlobalMilCount = militaryVehiclesCount;
      for (const sid of settlementIds) {
        if (currentGlobalMilCount >= maxGlobalMilitaryVehicles) break;
        const cityEpoch = getSettlementTechEpoch(sid);
        if (cityEpoch < 1) continue;
        const sp: SpeciesId = state.settlementSpecies?.[sid] ?? 'human';
        const kid = getKingdomId(state, sid);
        const cityAtWar = Boolean(
          kid &&
            (activeTickIndex
              ? (activeTickIndex.warEnemiesByKingdom.get(kid)?.size ?? 0) > 0
              : settlementIds.some((otherSid) => areKingdomsAtWar(state, kid, getKingdomId(state, otherSid)))),
        );
        const anchor = getSettlementAnchorForId(state, sid);
        const cityMilitary = state.vehicles.filter((v) => v.isMilitary && v.settlementId === sid);
        const countType = (t: VehicleType) => cityMilitary.filter((v) => v.type === t).length;
        const countTypes = (types: VehicleType[]) => cityMilitary.filter((v) => types.includes(v.type)).length;

        // Per-city vehicle doctrine by epoch:
        // - Epoch 1-2 (Bronze/Medieval): 1 coastal warship
        // - Epoch 3 (Industrial): few war vehicles supporting infantry armies (cap 4-5: 1-2 tanks, 1 fighter, 1 airship, 1 warship)
        // - Epoch 4 (Atomic): mechanized combined-arms corps (cap 7: 3 tanks, 2 choppers, 1-2 bombers, 1 warship)
        // - Epoch 5 (Information): vehicle-dominated modern military (cap 10: 4 tanks, 3 choppers, 2 stealth bombers, 2 warships)
        // - Epoch 6+ (Orbital/Interstellar): full mechanized & aerospace armada (cap 12: 4 hover tanks, 3 orbital gunships, 3 plasma bombers, 2 cruisers)
        const cityCap =
          cityEpoch >= 6
            ? 12
            : cityEpoch === 5
              ? 10
              : cityEpoch === 4
                ? 7
                : cityEpoch === 3
                  ? cityAtWar
                    ? 5
                    : 4
                  : 1;
        if (cityMilitary.length >= cityCap) continue;

        const maxWarships = cityEpoch >= 5 ? 2 : 1;
        const maxTanks =
          cityEpoch >= 5
            ? 4
            : cityEpoch === 4
              ? 3
              : cityEpoch === 3
                ? cityAtWar
                  ? 2
                  : 1
                : 0;
        const maxFixedWing =
          cityEpoch >= 6
            ? 3
            : cityEpoch === 5
              ? 2
              : cityEpoch === 4
                ? cityAtWar
                  ? 2
                  : 1
                : cityEpoch === 3
                  ? 1
                  : 0;
        const maxHoverAir =
          cityEpoch >= 5
            ? 3
            : cityEpoch === 4
              ? 2
              : cityEpoch === 3
                ? 1
                : 0;

        let spawnedThisCity = false;
        const trySpawnMilitary = (mType: VehicleType, sx: number, sz: number) => {
          const stats = getMilitaryVehicleStats(mType, cityEpoch);
          state.vehicles!.push({
            id: nextEntityId('veh_mil'),
            type: mType,
            species: sp,
            settlementId: sid,
            kingdomId: kid,
            isMilitary: true,
            hp: stats.maxHp,
            maxHp: stats.maxHp,
            attackCooldown: 0.6,
            strafeExtendTimer: 0,
            epochLevel: cityEpoch,
            x: sx,
            y: stats.cruiseY,
            z: sz,
            heading: Math.random() * Math.PI * 2,
            pitch: 0,
            bank: 0,
            speed: stats.speed,
            path: [{ x: sx, z: sz }],
            pathIndex: 0,
            variantSeed: cityMilitary.length * 13 + Math.round(sx * 3 + sz * 7),
          });
          cityMilitary.push(state.vehicles![state.vehicles!.length - 1]);
          currentGlobalMilCount++;
          spawnedThisCity = true;
        };

        // Spawn at most 1 new military vehicle per settlement per spawner cycle (~1.2s) for natural factory cadence
        // 1. Ground Battle Vehicle (Epoch 3+ WWI Trench Tank -> Atomic Tank -> Composite MBT -> Hover Railgun Tank)
        // Prioritized first in Industrial+ so land battlefields rapidly fill with armor
        if (!spawnedThisCity && cityEpoch >= 3 && countType('tank') < maxTanks && cityMilitary.length < cityCap) {
          const tankIdx = countType('tank');
          let tankTile: TileData | null = null;
          for (let attempt = 0; attempt < 8 && !tankTile; attempt++) {
            const ang = ((tankIdx * 2 + attempt) / 8) * Math.PI * 2;
            const rad = 2 + (attempt % 3) * 1.5;
            const tx = Math.max(2, Math.min(state.gridSize - 3, Math.round(anchor.x + Math.cos(ang) * rad)));
            const tz = Math.max(2, Math.min(state.gridSize - 3, Math.round(anchor.z + Math.sin(ang) * rad)));
            const tt = getTile(state, tx, tz);
            if (tt && (cityEpoch >= 6 ? tt.height <= 6 : tt.height >= 1 && tt.height <= 5)) {
              tankTile = tt;
            }
          }
          if (tankTile) {
            trySpawnMilitary('tank', tankTile.x, tankTile.z);
          }
        }

        // 2. Lighter-Than-Air / Rotor / VTOL Assault branch (Epoch 3 Airship -> Epoch 4-5 Helicopter / Orc Flyer -> Epoch 6+ Orbital Gunship)
        if (
          !spawnedThisCity &&
          cityEpoch >= 3 &&
          countTypes(['airship', 'helicopter', 'orc_flyer', 'orbital_gunship']) < maxHoverAir &&
          cityMilitary.length < cityCap
        ) {
          const targetHoverType = getEvolvedMilitaryAirType('airship', cityEpoch, sp);
          const airIdx = countTypes(['airship', 'helicopter', 'orc_flyer', 'orbital_gunship']);
          const ang = (airIdx / Math.max(1, maxHoverAir)) * Math.PI * 2 + 0.7;
          const sx = Math.max(2, Math.min(state.gridSize - 3, anchor.x + Math.cos(ang) * 2.5));
          const sz = Math.max(2, Math.min(state.gridSize - 3, anchor.z + Math.sin(ang) * 2.5));
          trySpawnMilitary(targetHoverType, sx, sz);
        }

        // 3. Fixed-Wing Fighter / Bomber branch (Epoch 3 Biplane -> Epoch 4 Prop Heavy Bomber -> Epoch 5+ Stealth Jet / Plasma Bomber)
        if (
          !spawnedThisCity &&
          cityEpoch >= 3 &&
          countTypes(['glider', 'bomber_plane']) < maxFixedWing &&
          cityMilitary.length < cityCap
        ) {
          const targetFixedType = getEvolvedMilitaryAirType('glider', cityEpoch, sp);
          const fwIdx = countTypes(['glider', 'bomber_plane']);
          const ang = (fwIdx / Math.max(1, maxFixedWing)) * Math.PI * 2;
          const sx = Math.max(2, Math.min(state.gridSize - 3, anchor.x + Math.cos(ang) * 2.0));
          const sz = Math.max(2, Math.min(state.gridSize - 3, anchor.z + Math.sin(ang) * 2.0));
          trySpawnMilitary(targetFixedType, sx, sz);
        }

        // 4. Seaborne Warship if open coastal sea exists nearby (Epoch 1+ Galley -> Galleon -> Ironclad -> Destroyer -> Plasma Cruiser)
        if (!spawnedThisCity && cityEpoch >= 1 && countType('warship') < maxWarships && cityMilitary.length < cityCap) {
          let coastalWater: TileData | null = null;
          let fallbackWater: TileData | null = null;
          for (let r = 4; r <= 18 && !coastalWater; r += 2) {
            for (let a = 0; a < 8; a++) {
              const ang = ((a + countType('warship') * 3) / 8) * Math.PI * 2;
              const wx = Math.round(anchor.x + Math.cos(ang) * r);
              const wz = Math.round(anchor.z + Math.sin(ang) * r);
              const wt = getTile(state, wx, wz);
              if (wt && wt.height === 0 && !wt.isLake) {
                if (!wt.isRiver) {
                  coastalWater = wt;
                  break;
                } else if (!fallbackWater) {
                  fallbackWater = wt;
                }
              }
            }
          }
          const spawnSea = coastalWater ?? fallbackWater;
          if (spawnSea) {
            trySpawnMilitary('warship', spawnSea.x, spawnSea.z);
          }
        }
      }
    }

    // Update & fight with military vehicles
    const vehTickNum = simTickCounterByState.get(state) ?? 0;
    for (const v of state.vehicles) {
      if (!v.isMilitary || (v.hp ?? 0) <= 0) continue;
      if ((v.attackCooldown ?? 0) > 0) v.attackCooldown = Math.max(0, (v.attackCooldown ?? 0) - dt);
      if ((v.strafeExtendTimer ?? 0) > 0) v.strafeExtendTimer = Math.max(0, (v.strafeExtendTimer ?? 0) - dt);
      const myKid = v.kingdomId ?? getKingdomId(state, v.settlementId);
      const anchor = getSettlementAnchorForId(state, v.settlementId);
      const vEpoch = v.epochLevel ?? getSettlementTechEpoch(v.settlementId);
      const warEnemiesSet = myKid && activeTickIndex ? activeTickIndex.warEnemiesByKingdom.get(myKid) : undefined;
      const isAtWar = Boolean(warEnemiesSet && warEnemiesSet.size > 0);

      // Wartime theater search range scales drastically by era so Industrial+ vehicles spearhead invasions
      // and Info Age+ armored columns & air wings deploy across the entire battlefield!
      const warTheaterRange = isAtWar
        ? vEpoch >= 5
          ? 180
          : vEpoch === 4
            ? 110
            : vEpoch === 3
              ? 78
              : 48
        : 32;

      // Find nearest valid threat: local raiders/predators/units, plus theater-wide enemy vehicles/buildings/forces during war
      let targetX: number | null = null;
      let targetZ: number | null = null;
      let foundVehTargetUnit: UnitEntity | null = null;
      let targetBld: BuildingEntity | null = null;
      let targetVeh: VehicleEntity | null = null;
      let bestDistSq = warTheaterRange * warTheaterRange;

      const considerVehThreat = (other: UnitEntity, dSq: number) => {
        if (other.state === 'ko' || other.hp <= 0 || dSq >= bestDistSq) return;
        const isThreat =
          other.faction === 'hostile' ||
          (other.faction === 'wildlife' &&
            (other.role === 'leviathan' ||
              other.role === 'dragon' ||
              (other.role === 'dinosaur' && isCarnivoreAnimal(other.role, other.appearanceSeed))) &&
            (other.role === 'leviathan' || Math.hypot(other.x - anchor.x, other.z - anchor.z) <= 26)) ||
          (other.faction === 'civilization' &&
            other.ageStage !== 'child' &&
            areKingdomsAtWar(
              state,
              myKid,
              other.settlementId ? getKingdomId(state, other.settlementId) : other.kingdomId,
            ));
        if (!isThreat) return;
        bestDistSq = dSq;
        foundVehTargetUnit = other;
        targetX = other.x;
        targetZ = other.z;
      };

      // 1. Local immediate threats (raiders, beasts, nearby frontline infantry within 32 tiles)
      if (activeTickIndex) {
        forEachUnitInRadius(activeTickIndex, v.x, v.z, 32, considerVehThreat);
      } else {
        for (const other of state.units) {
          considerVehThreat(other, (other.x - v.x) ** 2 + (other.z - v.z) ** 2);
        }
      }

      // 2. Enemy vehicles across the wartime theater (in Atomic/Info+ Ages, prioritize vehicle-vs-vehicle clashes!)
      const localUnitThreat = foundVehTargetUnit !== null && bestDistSq <= 16 * 16;
      if (!localUnitThreat) {
        let bestEnemyVehDistSq = vEpoch >= 4 ? warTheaterRange * warTheaterRange : bestDistSq;
        for (const ov of state.vehicles) {
          if (ov.id === v.id || (ov.hp ?? 0) <= 0) continue;
          const oKid = ov.kingdomId ?? getKingdomId(state, ov.settlementId);
          if (!areKingdomsAtWar(state, myKid, oKid)) continue;
          // Prioritize enemy military vehicles over civilian cars/trains
          const priorityMult = ov.isMilitary ? 0.65 : 1.15;
          const rawDSq = (ov.x - v.x) ** 2 + (ov.z - v.z) ** 2;
          const weightedDSq = rawDSq * priorityMult * priorityMult;
          if (rawDSq <= warTheaterRange * warTheaterRange && weightedDSq < bestEnemyVehDistSq) {
            bestEnemyVehDistSq = weightedDSq;
            targetVeh = ov;
            foundVehTargetUnit = null;
            targetX = ov.x;
            targetZ = ov.z;
          }
        }
        if (targetVeh) {
          bestDistSq = (targetVeh.x - v.x) ** 2 + (targetVeh.z - v.z) ** 2;
        }
      }

      // 3. Enemy wartime buildings across the theater so tanks, helicopters, bombers, and warships actively invade & capture cities
      if (!foundVehTargetUnit && !targetVeh && isAtWar) {
        for (const b of state.buildings) {
          if (b.hp <= 0 || b.shieldTimer > 0) continue;
          const bKid = b.settlementId ? getKingdomId(state, b.settlementId) : undefined;
          if (!areKingdomsAtWar(state, myKid, bKid)) continue;
          const dSq = (b.tileX - v.x) ** 2 + (b.tileZ - v.z) ** 2;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            targetBld = b;
            targetX = b.tileX;
            targetZ = b.tileZ;
          }
        }
      }

      // 4. Fallback: long-range wartime enemy units if no buildings or vehicles found
      if (!foundVehTargetUnit && !targetVeh && !targetBld && isAtWar && activeTickIndex && warEnemiesSet) {
        for (const enemyKid of warEnemiesSet) {
          const enemyUnits = activeTickIndex.livingCivByKingdom.get(enemyKid);
          if (!enemyUnits) continue;
          const step = enemyUnits.length > 40 ? 4 : 1;
          const offset = (vehTickNum + v.variantSeed) % step;
          for (let ei = offset; ei < enemyUnits.length; ei += step) {
            const eUnit = enemyUnits[ei];
            considerVehThreat(eUnit, (eUnit.x - v.x) ** 2 + (eUnit.z - v.z) ** 2);
          }
        }
      }

      const targetUnit = foundVehTargetUnit as UnitEntity | null;

      const vStats = getMilitaryVehicleStats(v.type, vEpoch);
      const isNaval = v.type === 'warship';
      const isGround = v.type === 'tank';
      const isFixedWing = v.type === 'glider' || v.type === 'bomber_plane';
      const isHoverTank = isGround && vEpoch >= 6;
      const cruiseY = vStats.cruiseY;
      v.y = cruiseY;

      let goalX: number;
      let goalZ: number;
      if (targetX !== null && targetZ !== null) {
        if (isFixedWing && (v.strafeExtendTimer ?? 0) > 0) {
          // Fixed-wing planes NEVER stop or hover over target: extend straight past after pass, then bank around
          goalX = Math.max(3, Math.min(state.gridSize - 4, v.x + Math.sin(v.heading) * 14));
          goalZ = Math.max(3, Math.min(state.gridSize - 4, v.z + Math.cos(v.heading) * 14));
        } else {
          goalX = targetX;
          goalZ = targetZ;
        }
      } else {
        // Patrol smoothly around home city (or coastal ring for warships)
        const patrolOrbit = isNaval ? 10 + (v.variantSeed % 5) : isFixedWing ? 11 + (v.variantSeed % 6) : 7 + (v.variantSeed % 7);
        const patrolAngle = (state.year * (isGround ? 0.32 : isFixedWing ? 0.85 : 0.65) + v.variantSeed * 1.37) % (Math.PI * 2);
        goalX = Math.max(3, Math.min(state.gridSize - 4, anchor.x + Math.cos(patrolAngle) * patrolOrbit));
        goalZ = Math.max(3, Math.min(state.gridSize - 4, anchor.z + Math.sin(patrolAngle) * patrolOrbit));
      }

      const dx = goalX - v.x;
      const dz = goalZ - v.z;
      const dist = Math.hypot(dx, dz);
      const targetDist = targetX !== null && targetZ !== null ? Math.hypot(targetX - v.x, targetZ - v.z) : dist;
      const fireRange = vStats.fireRange;

      if (isFixedWing && targetX !== null && targetZ !== null && targetDist <= 2.6 && (v.strafeExtendTimer ?? 0) <= 0) {
        v.strafeExtendTimer = 1.9;
      }

      const turnRate = isFixedWing ? 2.15 : v.type === 'helicopter' || v.type === 'orc_flyer' || v.type === 'orbital_gunship' ? 3.4 : 2.3;
      let attackBearingDelta = 0;

      if (dist > 0.15 || isFixedWing) {
        const desiredHeading = dist > 0.15 ? Math.atan2(dx, dz) : v.heading;
        const turnDelta = wrapAngleRad(desiredHeading - v.heading);
        v.heading = wrapAngleRad(v.heading + Math.max(-turnRate * dt, Math.min(turnRate * dt, turnDelta)));
        v.bank = isNaval || isGround ? 0 : Math.max(-0.46, Math.min(0.46, turnDelta * (isFixedWing ? 0.62 : 0.4)));
        v.pitch = isFixedWing ? -0.05 : v.type === 'helicopter' || v.type === 'orc_flyer' ? (dist > fireRange * 0.72 ? 0.12 : 0.02) : 0;

        const shouldCloseIn = isFixedWing || targetX === null || targetDist > fireRange * 0.72;
        if (shouldCloseIn) {
          const step = v.speed * dt;
          if (isNaval || isGround) {
            const canPassTile = (t: TileData | undefined): boolean => {
              if (!t) return false;
              if (isNaval) return t.height === 0;
              if (isHoverTank) return t.height <= 6;
              return (t.height >= 1 && t.height <= 5) || (t.height === 0 && isWalkableOrWalkwayTile(t));
            };
            const fanOffsets = [0, 0.45, -0.45, 0.95, -0.95, 1.45, -1.45];
            let moved = false;
            for (const off of fanOffsets) {
              const testHeading = wrapAngleRad(v.heading + off);
              const nx = Math.max(1, Math.min(state.gridSize - 2, v.x + Math.sin(testHeading) * step));
              const nz = Math.max(1, Math.min(state.gridSize - 2, v.z + Math.cos(testHeading) * step));
              const nt = getTile(state, Math.round(nx), Math.round(nz));
              if (canPassTile(nt)) {
                v.x = nx;
                v.z = nz;
                if (off !== 0) {
                  v.heading = wrapAngleRad(v.heading + off * Math.min(1, dt * 4.5));
                }
                moved = true;
                break;
              }
            }
            if (!moved) {
              v.heading = wrapAngleRad(v.heading + 1.8 * dt);
            }
          } else {
            const nx = Math.max(1, Math.min(state.gridSize - 2, v.x + Math.sin(v.heading) * step));
            const nz = Math.max(1, Math.min(state.gridSize - 2, v.z + Math.cos(v.heading) * step));
            v.x = nx;
            v.z = nz;
            // Fixed-wing turns gracefully around map edges if extending toward border
            if (isFixedWing && (nx <= 2.5 || nx >= state.gridSize - 3.5 || nz <= 2.5 || nz >= state.gridSize - 3.5)) {
              v.heading = wrapAngleRad(v.heading + 1.6 * dt);
            }
          }
        }
      }

      if (targetX !== null && targetZ !== null) {
        attackBearingDelta = Math.abs(wrapAngleRad(Math.atan2(targetX - v.x, targetZ - v.z) - v.heading));
      }

      const canPlaneAttack =
        !isFixedWing || attackBearingDelta <= 0.92 || (v.type === 'bomber_plane' && targetDist <= 5.5);

      if (targetX !== null && targetZ !== null && targetDist <= fireRange && canPlaneAttack && (v.attackCooldown ?? 0) <= 0) {
        v.attackCooldown = vStats.fireCooldown;
        const dmg = vStats.dmg;
        const tracerColor =
          v.type === 'orbital_gunship' || (vEpoch >= 6 && (v.type === 'tank' || v.type === 'warship' || v.type === 'bomber_plane'))
            ? v.species === 'dwarf'
              ? '#fbbf24'
              : v.species === 'lizardfolk'
                ? '#facc15'
                : '#56cfe1'
            : v.species === 'elf'
              ? '#c084fc'
              : v.species === 'orc'
                ? '#ff3b30'
                : v.species === 'dwarf'
                  ? '#f59e0b'
                  : v.species === 'lizardfolk'
                    ? '#facc15'
                    : '#ffd166';
        const hitTile = getTile(state, targetX, targetZ);
        const hitY = (hitTile?.height ?? 2) * 0.45 + 0.35;

        const vfxSubtype: VisualEffectEvent['vfxSubtype'] =
          v.species === 'elf'
            ? v.type === 'orbital_gunship' || vEpoch >= 6
              ? 'plasma_beam'
              : v.type === 'bomber_plane' || v.type === 'warship' || (v.type === 'tank' && vEpoch >= 3)
                ? 'elf_starfall_spell'
                : 'arcane_bolt'
            : v.species === 'dwarf'
              ? v.type === 'orbital_gunship' || vEpoch >= 6
                ? 'plasma_beam'
                : v.type === 'bomber_plane' || v.type === 'warship' || v.type === 'tank'
                  ? 'dwarf_quake_mortar'
                  : 'cannon_shell'
              : v.species === 'lizardfolk'
                ? v.type === 'orbital_gunship' || vEpoch >= 6
                  ? 'plasma_beam'
                  : v.type === 'bomber_plane' || v.type === 'warship' || (v.type === 'tank' && vEpoch >= 2)
                    ? 'lizard_solar_lance'
                    : 'arcane_bolt'
                : v.species === 'orc'
                  ? vEpoch >= 3
                    ? v.type === 'orc_flyer' || v.type === 'bomber_plane' || v.type === 'warship' || v.type === 'tank'
                      ? 'orc_waagh_rocket'
                      : 'bullet'
                    : 'orc_siege_boulder'
                  : v.type === 'orbital_gunship' || (vEpoch >= 6 && (v.type === 'tank' || v.type === 'warship' || v.type === 'bomber_plane'))
                    ? 'plasma_beam'
                    : v.type === 'bomber_plane'
                      ? targetDist <= 6.2
                        ? 'bomb'
                        : 'missile'
                      : v.type === 'glider'
                        ? 'bullet'
                        : v.type === 'helicopter'
                          ? Math.floor(state.year * 10 + v.variantSeed) % 2 === 0
                            ? 'missile'
                            : 'bullet'
                          : vEpoch >= 4 && (v.type === 'warship' || v.type === 'tank') && targetDist >= 6.5
                            ? 'missile'
                            : 'cannon_shell';

        // Evolved Atomic+ Bombers & Orbital Gunships deliver tactical payloads only when kingdom ultimate cooldown is ready against tough targets
        const kUltReady = !myKid || (state.kingdomUltimateCooldowns?.[myKid] ?? 0) <= 0;
        const isHighValueTarget =
          targetBld !== null ||
          (targetUnit !== null && (targetUnit.maxHp >= 180 || targetUnit.isKing || targetUnit.role === 'leviathan'));
        const isStrategicPayload =
          kUltReady &&
          isHighValueTarget &&
          (v.type === 'bomber_plane' || v.type === 'orbital_gunship') &&
          vEpoch >= 4;

        if (isStrategicPayload) {
          if (myKid) {
            if (!state.kingdomUltimateCooldowns) state.kingdomUltimateCooldowns = {};
            state.kingdomUltimateCooldowns[myKid] = 42.0;
          }
          const splashDmg = dmg * 1.9;
          if (v.species === 'elf') {
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'projectile_tracer',
              vfxSubtype: 'elf_starfall_spell',
              species: 'elf',
              originX: v.x,
              originY: cruiseY + 0.15,
              originZ: v.z,
              x: targetX,
              y: hitY,
              z: targetZ,
              radius: 2.3,
              color: '#c084fc',
              flightDuration: 0.72,
              createdAt: Date.now(),
            });
          } else if (v.species === 'orc') {
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'projectile_tracer',
              vfxSubtype: 'orc_waagh_rocket',
              species: 'orc',
              originX: v.x,
              originY: cruiseY + 0.15,
              originZ: v.z,
              x: targetX,
              y: hitY,
              z: targetZ,
              radius: 2.4,
              color: '#ff4d1a',
              flightDuration: 0.7,
              createdAt: Date.now(),
            });
          } else if (v.species === 'dwarf') {
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'projectile_tracer',
              vfxSubtype: 'dwarf_quake_mortar',
              species: 'dwarf',
              originX: v.x,
              originY: cruiseY + 0.12,
              originZ: v.z,
              x: targetX,
              y: hitY,
              z: targetZ,
              radius: 2.35,
              color: '#f59e0b',
              flightDuration: 0.68,
              createdAt: Date.now(),
            });
          } else if (v.species === 'lizardfolk') {
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'projectile_tracer',
              vfxSubtype: 'lizard_solar_lance',
              species: 'lizardfolk',
              originX: v.x,
              originY: cruiseY + 0.15,
              originZ: v.z,
              x: targetX,
              y: hitY,
              z: targetZ,
              radius: 2.3,
              color: '#facc15',
              flightDuration: 0.68,
              createdAt: Date.now(),
            });
          } else {
            // Human tactical air-launched missile / falling bomb into target
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'projectile_tracer',
              vfxSubtype: v.type === 'bomber_plane' ? 'bomb' : 'icbm_missile',
              species: 'human',
              originX: v.x,
              originY: cruiseY + 0.1,
              originZ: v.z,
              x: targetX,
              y: hitY,
              z: targetZ,
              radius: 2.2,
              color: '#ff9e00',
              flightDuration: 0.65,
              createdAt: Date.now(),
            });
          }
          const isSolarOrArcanePayload = v.species === 'elf' || v.species === 'lizardfolk';
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: isSolarOrArcanePayload ? 'arcane_cataclysm' : 'nuke_blast',
            originX: v.x,
            originY: cruiseY + 0.25,
            originZ: v.z,
            x: targetX,
            y: hitY,
            z: targetZ,
            radius: 3.4,
            color:
              v.species === 'elf'
                ? '#c084fc'
                : v.species === 'lizardfolk'
                  ? '#facc15'
                  : v.species === 'dwarf'
                    ? '#f59e0b'
                    : '#ff9e00',
            createdAt: Date.now(),
          });
          applySuperweaponEnvironmentImpact(
            state,
            targetX,
            targetZ,
            3.2,
            isSolarOrArcanePayload ? 'arcane' : 'nuke',
          );
          for (const ou of state.units) {
            if (ou.state === 'ko' || ou.hp <= 0 || ou.statusEffects.shielded) continue;
            if (ou.ageStage === 'child') continue;
            const oKid =
              ou.faction === 'civilization'
                ? ou.settlementId
                  ? getKingdomId(state, ou.settlementId)
                  : ou.kingdomId
                : undefined;
            if (myKid && oKid === myKid) continue;
            if (Math.hypot(ou.x - targetX, ou.z - targetZ) <= 3.2) {
              ou.hp -= splashDmg;
              ou.lastAttackerId = v.id;
              ou.underAttackTimer = 8.0;
            }
          }
          for (const ob of state.buildings) {
            if (ob.hp <= 0 || ob.shieldTimer > 0) continue;
            const bKid = ob.settlementId ? getKingdomId(state, ob.settlementId) : undefined;
            if (myKid && bKid === myKid) continue;
            if (Math.hypot(ob.tileX - targetX, ob.tileZ - targetZ) <= 3.0) {
              ob.hp = Math.max(0, ob.hp - splashDmg * 1.45);
            }
          }
        } else {
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'projectile_tracer',
            vfxSubtype,
            originX: v.x,
            originY: cruiseY + 0.25,
            originZ: v.z,
            x: targetX,
            y: hitY,
            z: targetZ,
            radius:
              v.type === 'tank' || v.type === 'bomber_plane' || v.type === 'orbital_gunship' || v.type === 'warship'
                ? 1.55
                : 1.05,
            color: tracerColor,
            createdAt: Date.now(),
          });

          if (hitTile && hitTile.height === 0) {
            damageOrBleachWaterTile(hitTile, dmg * 1.2, false);
          }

          if (targetUnit) {
            targetUnit.hp -= dmg;
            targetUnit.lastAttackerId = v.id;
            targetUnit.underAttackTimer = 8.0;
            if (targetUnit.role === 'leviathan') {
              targetUnit.leviathanSubmerged = false;
            }
            // Defenders, hostile raiders & apex beasts return anti-vehicle counter-fire/wear so war vehicles are never immortal
            const counterFire =
              targetUnit.role === 'dragon' || targetUnit.role === 'leviathan'
                ? 22
                : targetUnit.faction === 'hostile' || targetUnit.role === 'warrior' || targetUnit.isKing
                  ? vEpoch >= 4
                    ? 8
                    : 12
                  : vEpoch >= 4
                    ? 4
                    : 7;
            v.hp = Math.max(0, (v.hp ?? 100) - counterFire);
          } else if (targetVeh) {
            targetVeh.hp = Math.max(0, (targetVeh.hp ?? 100) - dmg);
            if (targetVeh.hp <= 0) {
              state.pendingVfx.push({
                id: nextEntityId('vfx'),
                type: 'hit_spark',
                x: targetVeh.x,
                y: targetVeh.y + 0.4,
                z: targetVeh.z,
                radius: 2.0,
                color: '#ff6b35',
                createdAt: Date.now(),
              });
            }
          } else if (targetBld && targetBld.shieldTimer <= 0) {
            targetBld.hp = Math.max(0, targetBld.hp - dmg * 1.35);
            // Fortified settlements return defensive flak/turret fire against attacking vehicles
            v.hp = Math.max(0, (v.hp ?? 100) - 8);
            if (targetBld.hp <= 0 && v.settlementId && myKid) {
              claimTerritoryAround(state, targetBld.tileX, targetBld.tileZ, 4.2, v.settlementId, myKid, true);
              targetBld.settlementId = v.settlementId;
              targetBld.species = v.species ?? 'human';
              targetBld.hp = Math.max(45, Math.round(targetBld.maxHp * 0.45));
              targetBld.constructionProgress = 100;
            }
          }
          if (v.settlementId && myKid) {
            claimTerritoryAround(state, targetX, targetZ, 2.0, v.settlementId, myKid, true);
          }

          // AoE splash damage + miniature craters for explosive & magical vehicle ordnance across all races
          const vehSplashRadius =
            vfxSubtype === 'bomb'
              ? 2.55
              : vfxSubtype === 'missile' ||
                  vfxSubtype === 'elf_starfall_spell' ||
                  vfxSubtype === 'orc_waagh_rocket' ||
                  vfxSubtype === 'orc_siege_boulder' ||
                  vfxSubtype === 'dwarf_quake_mortar' ||
                  vfxSubtype === 'lizard_solar_lance'
                ? 2.25
                : vfxSubtype === 'cannon_shell'
                  ? 1.85
                  : vfxSubtype === 'plasma_beam'
                    ? 1.5
                    : vfxSubtype === 'arcane_bolt'
                      ? 1.25
                      : 0;
          if (vehSplashRadius > 0) {
            const vehCraterMode: 'explosive' | 'arcane' | 'orc' =
              v.species === 'elf' || v.species === 'lizardfolk'
                ? 'arcane'
                : v.species === 'orc' || v.species === 'dwarf'
                  ? 'orc'
                  : 'explosive';
            applyWarfareAreaSplash(
              state,
              targetX,
              targetZ,
              vehSplashRadius,
              dmg,
              v.id,
              myKid,
              v.species,
              vehCraterMode,
              {
                excludeUnitId: targetUnit?.id,
                excludeVehicleId: targetVeh?.id,
                excludeBuildingId: targetBld?.id,
                craterRadius: vfxSubtype === 'arcane_bolt' ? 0.95 : Math.min(2.1, vehSplashRadius * 0.78),
                knockback: vehSplashRadius >= 1.85,
              },
            );
          }
        }
      }
    }
  }
}

/**
 * Environmental destruction for rivaling racial superweapons:
 * - Human Nuke: deep blast crater, scorched/vitrified wasteland, obliterates trees/resources/crops & sparks rim fires
 * - Elf Arcane Cataclysm: crystalline arcane crater, shattered flora/minerals, jagged crystal_field scars
 * - Orc Battlewill Slash: wide directional tectonic slash trench, splintered forest/boulders, rock/badlands/scorched cleave path
 */
function applySuperweaponEnvironmentImpact(
  state: SimulationState,
  cx: number,
  cz: number,
  radius: number,
  mode: 'nuke' | 'arcane' | 'seismic' | 'solar' | 'battlewill',
  slashHeadingRad?: number,
): void {
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(state.gridSize - 1, Math.ceil(cx + radius + 1));
  const minZ = Math.max(0, Math.floor(cz - radius - 1));
  const maxZ = Math.min(state.gridSize - 1, Math.ceil(cz + radius + 1));
  const allowFire = state.worldRules?.wildfireSpread !== false;

  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      const t = getTile(state, x, z);
      if (!t) continue;
      const dx = x - cx;
      const dz = z - cz;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;

      if (mode === 'battlewill' && slashHeadingRad !== undefined && d > 2.4) {
        const tileAng = Math.atan2(dx, dz);
        const angDiff = Math.abs(wrapAngleRad(tileAng - slashHeadingRad));
        if (angDiff > 1.28) continue;
      }

      t.blessedTimer = 0;

      if (t.height === 0) {
        damageOrBleachWaterTile(t, 400, true);
        if (mode === 'solar' && d <= radius * 0.5 && t.terrain === 'shallow_water') {
          t.height = 1;
          t.terrain = 'scorched';
          t.devastatedTimer = Math.max(t.devastatedTimer ?? 0, 40);
          if (allowFire) {
            t.onFireTimer = Math.max(t.onFireTimer, 9.0);
            t.fireColor = '#facc15';
          }
          continue;
        }
        if (d <= radius * 0.55) {
          t.terrain = 'deep_water';
        }
        t.onFireTimer = 0;
        continue;
      }

      // Clear environmental cover: trees, berry bushes, outcrops, farms & inner craters
      if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      } else if (d <= radius * 0.78 && t.resourceNode !== 'none') {
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      }
      if (t.farmSettlementId) {
        t.farmSettlementId = undefined;
      }

      // Lingering war-devastation scar prevents instant city rebuilding & road repaving
      t.devastatedTimer = Math.max(t.devastatedTimer ?? 0, d <= radius * 0.65 ? 55 : 38);

      if (mode === 'nuke') {
        // Human Thermonuclear ICBM: deep terraced blast crater, blazing firestorm & radioactive fallout
        const wasSand = t.terrain === 'sand';
        t.cursedTimer = Math.max(t.cursedTimer, d <= radius * 0.65 ? 36 : 22);
        if (d <= radius * 0.42) {
          t.height = Math.max(1, t.height - 2);
          t.terrain = 'scorched';
          if (allowFire) {
            t.onFireTimer = Math.max(t.onFireTimer, 13.5);
            t.fireColor = '#ff6b00';
          }
        } else if (d <= radius * 0.75) {
          t.height = Math.max(1, t.height - 1);
          t.terrain = (t.x + t.z) % 4 === 0 ? 'blighted_mire' : 'scorched';
          if (allowFire && (t.x * 13 + t.z * 7) % 2 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 10.5);
            t.fireColor = '#ff6b00';
          }
        } else if (!t.buildingId) {
          t.terrain = wasSand ? 'crystal_field' : 'scorched';
          if (allowFire && (t.x * 17 + t.z * 11) % 3 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 8.0);
            t.fireColor = '#ff6b00';
          }
        }
      } else if (mode === 'arcane') {
        // Elf Starfall Cataclysm: glasses terrain into glowing crystal fields + violet mana-fire
        t.cursedTimer = Math.max(t.cursedTimer, d <= radius * 0.6 ? 20 : 12);
        if (d <= radius * 0.42) {
          t.height = Math.max(1, t.height - 2);
          t.terrain = 'crystal_field';
          if (allowFire) {
            t.onFireTimer = Math.max(t.onFireTimer, 12.0);
            t.fireColor = '#c084fc';
          }
        } else if (d <= radius * 0.74) {
          t.height = Math.max(1, t.height - 1);
          t.terrain = (t.x + t.z) % 3 === 0 ? 'scorched' : 'crystal_field';
          if (allowFire && (t.x * 11 + t.z * 7) % 2 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 9.5);
            t.fireColor = '#c084fc';
          }
        } else if (!t.buildingId) {
          t.terrain = 'crystal_field';
          if (t.resourceNode === 'none' && (t.x * 19 + t.z * 23) % 11 === 0) {
            t.resourceNode = 'crystal_monolith';
            t.resourceAmount = 220;
          }
          if (allowFire && (t.x * 13 + t.z * 5) % 3 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 7.5);
            t.fireColor = '#c084fc';
          }
        }
      } else if (mode === 'seismic') {
        // Dwarf Tectonic Forge-Hammer: shatters earth into deep rocky volcanic chasms + molten forge-fire
        if (d <= radius * 0.44) {
          t.height = Math.max(1, t.height - 3);
          t.terrain = (t.x + t.z) % 2 === 0 ? 'volcanic_wasteland' : 'rock';
          if (allowFire) {
            t.onFireTimer = Math.max(t.onFireTimer, 12.5);
            t.fireColor = '#f59e0b';
          }
        } else if (d <= radius * 0.76) {
          t.height = Math.max(1, t.height - 1);
          t.terrain = (t.x + t.z) % 3 === 0 ? 'scorched' : 'rock';
          if (allowFire && (t.x * 7 + t.z * 13) % 2 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 9.5);
            t.fireColor = '#f59e0b';
          }
        } else if (!t.buildingId) {
          t.terrain = (t.x + t.z) % 2 === 0 ? 'badlands' : 'scorched';
          if (allowFire && (t.x * 5 + t.z * 11) % 3 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 7.5);
            t.fireColor = '#f59e0b';
          }
        }
      } else if (mode === 'solar') {
        // Lizardfolk Sun-Prism Cataclysm: orbital solar glassing into sun-baked sand/crystal + golden sunfire
        if (d <= radius * 0.42) {
          t.height = Math.max(1, t.height - 2);
          t.terrain = (t.x + t.z) % 2 === 0 ? 'crystal_field' : 'scorched';
          if (allowFire) {
            t.onFireTimer = Math.max(t.onFireTimer, 14.0);
            t.fireColor = '#facc15';
          }
        } else if (d <= radius * 0.76) {
          t.height = Math.max(1, t.height - 1);
          t.terrain = (t.x + t.z) % 2 === 0 ? 'scorched' : 'sand';
          if (allowFire && (t.x * 13 + t.z * 5) % 2 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 11.0);
            t.fireColor = '#facc15';
          }
        } else if (!t.buildingId) {
          t.terrain = (t.x + t.z) % 3 === 0 ? 'sand' : 'scorched';
          if (allowFire && (t.x * 17 + t.z * 7) % 3 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 8.5);
            t.fireColor = '#facc15';
          }
        }
      } else {
        // Orc Battlewill titanic sword cleave: splits towering mountains and carves rocky badland ravines
        const slashStep = Math.max(2, Math.round(t.height * 0.55));
        if (d <= radius * 0.55) {
          t.height = Math.max(1, t.height >= 6 ? t.height - slashStep : t.height - 2);
          t.terrain = (t.x + t.z) % 2 === 0 ? 'badlands' : 'scorched';
        } else if (d <= radius * 0.85) {
          t.height = Math.max(1, t.height - (t.height >= 6 ? 3 : 1));
          t.terrain = (t.x + t.z) % 2 === 0 ? 'rock' : 'badlands';
        } else if (!t.buildingId) {
          t.terrain = (t.x * 7 + t.z * 5) % 3 === 0 ? 'rock' : 'scorched';
        }
        if (allowFire && (t.x * 11 + t.z * 17) % 3 === 0) {
          t.onFireTimer = Math.max(t.onFireTimer, 8.5);
          t.fireColor = '#ff3b30';
        }
      }
    }
  }
}

/**
 * Miniature crater & battlefield scar generator for conventional racial warfare ordnance:
 * - 'explosive' (Human missiles, bombs, ICBMs, shells): crater, scorched earth & incendiary fire
 * - 'arcane' (Elf starfall & astral magic): shimmering crystalline crater & violet mana-fire
 * - 'orc' (Orc WAAAGH! rockets & flaming magma boulders): jagged badlands/volcanic crater & red inferno
 * - 'seismic' (Dwarf quake mortars): fractured rocky crater & amber forge-embers
 * - 'solar' (Lizardfolk solar lances): sun-vitrified sand/scorched crater & golden sunfire
 */
function applyWarfareCraterImpact(
  state: SimulationState,
  cx: number,
  cz: number,
  radius: number,
  mode: 'explosive' | 'arcane' | 'orc' | 'seismic' | 'solar',
  craterDepth = 1,
): void {
  const clampedR = Math.max(0.9, Math.min(3.8, radius));
  const minX = Math.max(0, Math.floor(cx - clampedR));
  const maxX = Math.min(state.gridSize - 1, Math.ceil(cx + clampedR));
  const minZ = Math.max(0, Math.floor(cz - clampedR));
  const maxZ = Math.min(state.gridSize - 1, Math.ceil(cz + clampedR));
  const allowFire = state.worldRules?.wildfireSpread !== false;

  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      const t = getTile(state, x, z);
      if (!t) continue;
      const d = Math.hypot(x - cx, z - cz);
      if (d > clampedR) continue;

      if (t.height === 0) {
        damageOrBleachWaterTile(t, 85, false);
        continue;
      }

      t.blessedTimer = 0;

      // Clear foliage/crops inside the crater core
      if (d <= clampedR * 0.72) {
        if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
          t.resourceNode = 'none';
          t.resourceAmount = 0;
        }
        if (t.farmSettlementId) {
          t.farmSettlementId = undefined;
        }
      }

      const inCore = d <= Math.max(0.85, clampedR * 0.52);
      if (inCore && t.height > 1 && !t.buildingId) {
        t.height = Math.max(1, t.height - craterDepth);
      }
      t.devastatedTimer = Math.max(t.devastatedTimer ?? 0, inCore ? 28 : 18);

      if (mode === 'arcane') {
        if (inCore || (!t.buildingId && d <= clampedR * 0.85)) {
          t.terrain = 'crystal_field';
          if (allowFire && (inCore || (x * 7 + z * 11) % 3 === 0)) {
            t.onFireTimer = Math.max(t.onFireTimer, inCore ? 8.0 : 5.5);
            t.fireColor = '#c084fc';
          }
        }
      } else if (mode === 'seismic') {
        if (inCore) {
          t.terrain = (x + z) % 2 === 0 ? 'volcanic_wasteland' : 'rock';
          if (allowFire) {
            t.onFireTimer = Math.max(t.onFireTimer, 8.5);
            t.fireColor = '#f59e0b';
          }
        } else if (!t.buildingId && d <= clampedR * 0.85) {
          t.terrain = (x + z) % 2 === 0 ? 'rock' : 'scorched';
          if (allowFire && (x * 5 + z * 11) % 3 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 6.0);
            t.fireColor = '#f59e0b';
          }
        }
      } else if (mode === 'solar') {
        if (inCore) {
          t.terrain = (x + z) % 2 === 0 ? 'scorched' : 'crystal_field';
          if (allowFire) {
            t.onFireTimer = Math.max(t.onFireTimer, 9.5);
            t.fireColor = '#facc15';
          }
        } else if (!t.buildingId && d <= clampedR * 0.85) {
          t.terrain = (x + z) % 2 === 0 ? 'sand' : 'scorched';
          if (allowFire && (x * 11 + z * 7) % 2 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 7.0);
            t.fireColor = '#facc15';
          }
        }
      } else if (mode === 'orc') {
        if (inCore) {
          t.terrain = (x + z) % 2 === 0 ? 'volcanic_wasteland' : 'scorched';
          if (allowFire) {
            t.onFireTimer = Math.max(t.onFireTimer, 9.5);
            t.fireColor = '#ff3b30';
          }
        } else if (!t.buildingId && d <= clampedR * 0.85) {
          t.terrain = (x + z) % 2 === 0 ? 'scorched' : 'badlands';
          if (allowFire && (x * 7 + z * 13) % 2 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 7.0);
            t.fireColor = '#ff3b30';
          }
        }
      } else {
        if (inCore) {
          t.terrain = 'scorched';
          if (allowFire) {
            t.onFireTimer = Math.max(t.onFireTimer, 8.5);
            t.fireColor = '#ff6b35';
          }
        } else if (!t.buildingId && d <= clampedR * 0.85) {
          t.terrain = t.terrain === 'sand' ? 'crystal_field' : 'scorched';
          if (allowFire && (x * 11 + z * 5) % 2 === 0) {
            t.onFireTimer = Math.max(t.onFireTimer, 6.2);
            t.fireColor = '#ff6b35';
          }
        }
      }
    }
  }
}

/**
 * Shared AoE splash damage + miniature crater resolver for racial missiles, shells, bombs & magic.
 */
function applyWarfareAreaSplash(
  state: SimulationState,
  cx: number,
  cz: number,
  splashRadius: number,
  baseDamage: number,
  attackerId: string,
  attackerKingdomId: string | undefined,
  species: string | undefined,
  craterMode: 'explosive' | 'arcane' | 'orc',
  options?: {
    excludeUnitId?: string;
    excludeVehicleId?: string;
    excludeBuildingId?: string;
    craterRadius?: number;
    knockback?: boolean;
    onUnitKill?: () => void;
  },
): void {
  if (splashRadius <= 0) return;
  const isArcane = craterMode === 'arcane' || species === 'elf';
  const craterR = options?.craterRadius ?? Math.min(2.2, splashRadius * 0.76);
  if (craterR >= 0.9) {
    applyWarfareCraterImpact(state, cx, cz, craterR, craterMode, 1);
  }

  for (let i = 0; i < state.units.length; i++) {
    const cand = state.units[i];
    if (
      cand.id === attackerId ||
      cand.id === options?.excludeUnitId ||
      cand.state === 'ko' ||
      cand.hp <= 0 ||
      cand.statusEffects.shielded ||
      cand.ageStage === 'child'
    ) {
      continue;
    }
    const cKid =
      cand.faction === 'civilization'
        ? cand.settlementId
          ? getKingdomId(state, cand.settlementId)
          : cand.kingdomId
        : undefined;
    if (attackerKingdomId && cKid === attackerKingdomId) continue;
    const d = Math.hypot(cand.x - cx, cand.z - cz);
    if (d <= splashRadius) {
      const falloff = d <= splashRadius * 0.45 ? 0.72 : 0.46;
      cand.hp -= baseDamage * falloff;
      cand.lastAttackerId = attackerId;
      cand.underAttackTimer = 7.0;
      if (isArcane && cand.statusEffects) {
        cand.statusEffects.cursed = Math.max(cand.statusEffects.cursed ?? 0, 3.5);
      }
      if (cand.hp > 0 && options?.knockback && d <= splashRadius * 0.85) {
        const safeD = Math.max(0.35, d);
        cand.vxAir = ((cand.x - cx) / safeD) * 2.8;
        cand.vzAir = ((cand.z - cz) / safeD) * 2.8;
        cand.altitude = Math.max(cand.altitude ?? 0, 0.45);
        cand.vzVertical = Math.max(cand.vzVertical ?? 0, 2.8);
      }
      if (cand.hp <= 0) {
        options?.onUnitKill?.();
      }
    }
  }

  if (state.vehicles) {
    for (let vi = 0; vi < state.vehicles.length; vi++) {
      const ev = state.vehicles[vi];
      if (ev.id === attackerId || ev.id === options?.excludeVehicleId || (ev.hp ?? 100) <= 0) continue;
      const vKid = ev.kingdomId ?? getKingdomId(state, ev.settlementId);
      if (attackerKingdomId && vKid === attackerKingdomId) continue;
      if (Math.hypot(ev.x - cx, ev.z - cz) <= splashRadius + 0.55) {
        ev.hp = Math.max(0, (ev.hp ?? 100) - baseDamage * 0.58);
      }
    }
  }

  for (let bi = 0; bi < state.buildings.length; bi++) {
    const b = state.buildings[bi];
    if (b.id === options?.excludeBuildingId || b.hp <= 0 || b.shieldTimer > 0) continue;
    const bKid = b.settlementId ? getKingdomId(state, b.settlementId) : undefined;
    if (attackerKingdomId && bKid === attackerKingdomId) continue;
    if (Math.hypot(b.tileX - cx, b.tileZ - cz) <= splashRadius + 0.4) {
      b.hp = Math.max(0, b.hp - baseDamage * 0.65);
    }
  }
}

function stampWalkerFootprints(
  state: SimulationState,
  u: UnitEntity,
  prevX: number,
  prevZ: number,
): void {
  if (u.walkerPrevStepX === undefined || u.walkerPrevStepZ === undefined) {
    u.walkerPrevStepX = prevX;
    u.walkerPrevStepZ = prevZ;
    u.walkerStepParity = 0;
  }
  const sdx = u.x - u.walkerPrevStepX;
  const sdz = u.z - u.walkerPrevStepZ;
  const distSq = sdx * sdx + sdz * sdz;
  if (distSq < 1.15 * 1.15) return;

  const dist = Math.sqrt(distSq);
  const fwdX = sdx / dist;
  const fwdZ = sdz / dist;
  const sideSign = u.walkerStepParity ? 1 : -1;
  u.walkerStepParity = u.walkerStepParity ? 0 : 1;
  u.walkerPrevStepX = u.x;
  u.walkerPrevStepZ = u.z;

  // Stamp deep alternating flank footpad impressions (~1.05 tiles lateral offset from centerline)
  const footCenterX = u.x - fwdZ * sideSign * 1.05;
  const footCenterZ = u.z + fwdX * sideSign * 1.05;
  const minX = Math.max(1, Math.floor(footCenterX - 1.0));
  const maxX = Math.min(state.gridSize - 2, Math.ceil(footCenterX + 1.0));
  const minZ = Math.max(1, Math.floor(footCenterZ - 1.0));
  const maxZ = Math.min(state.gridSize - 2, Math.ceil(footCenterZ + 1.0));

  for (let tz = minZ; tz <= maxZ; tz++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if ((tx - footCenterX) ** 2 + (tz - footCenterZ) ** 2 > 1.25) continue;
      const t = getTile(state, tx, tz);
      if (!t || t.height <= 0) continue; // Never alter ocean water height === 0
      // Flatten raised terrain under colossal walker tonnage (min height stays 1)
      if (t.height >= 2 && !t.buildingId) {
        t.height = t.height >= 4 ? Math.max(1, t.height - 2) : Math.max(1, t.height - 1);
      }
      if (!t.buildingId && t.resourceNode === 'berry_bush') {
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      }
      t.crushedTimer = 90;
    }
  }
}

function stepHostileUnitAI(
  state: SimulationState,
  u: UnitEntity,
  def: typeof UNITS[number],
  moveSpeed: number,
  dt: number,
): void {
  const startX = u.x;
  const startZ = u.z;
  if (u.role === 'alien_ufo') {
    u.altitude = 4.6;
  }

  if (u.role === 'raider_behemoth') {
    let nearestBld: BuildingEntity | null = null;
    let bestDistSq = Infinity;
    for (const b of state.buildings) {
      const dSq = (b.tileX - u.x) ** 2 + (b.tileZ - u.z) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        nearestBld = b;
      }
    }
    if (nearestBld) {
      const dist = Math.sqrt(bestDistSq);
      if (dist <= def.attackRange) {
        u.state = 'fighting';
        u.windupTimer += dt;
        if (u.windupTimer >= 0.65) {
          u.windupTimer = 0;
          if (nearestBld.shieldTimer <= 0) {
            nearestBld.hp = Math.max(0, nearestBld.hp - def.attackDamage);
          }
        }
      } else {
        u.state = 'moving';
        u.windupTimer = 0;
        const dx = (nearestBld.tileX - u.x) / dist;
        const dz = (nearestBld.tileZ - u.z) / dist;
        u.x += dx * moveSpeed * dt;
        u.z += dz * moveSpeed * dt;
      }
      return;
    }
  }

  let nearestCiv: UnitEntity | null = null;
  let bestDistSq = Infinity;
  for (const other of state.units) {
    if (
      other.state !== 'ko' &&
      (other.faction === 'civilization' || (other.id === u.lastAttackerId && (u.underAttackTimer ?? 0) > 0))
    ) {
      const dSq = (other.x - u.x) ** 2 + (other.z - u.z) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        nearestCiv = other;
      }
    }
  }

  let nearestBldFallback: BuildingEntity | null = null;
  let bestBldDistSq = bestDistSq;
  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    const dSq = (b.tileX - u.x) ** 2 + (b.tileZ - u.z) ** 2;
    if (dSq < bestBldDistSq) {
      bestBldDistSq = dSq;
      nearestBldFallback = b;
    }
  }

  const isAlienRanged = u.role === 'alien_trooper' || u.role === 'alien_ufo' || u.role === 'alien_walker';
  const beamColor = u.role === 'alien_walker' ? '#ef4444' : u.role === 'alien_ufo' ? '#22d3ee' : '#34d399';
  const fireBeamVfx = (tx: number, tz: number, ty: number): void => {
    const ut = getTile(state, Math.round(u.x), Math.round(u.z));
    const originY = (ut?.height ?? 1) * 0.45 + (u.role === 'alien_ufo' ? 4.4 : u.role === 'alien_walker' ? 3.65 : 0.7);
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'projectile_tracer',
      vfxSubtype: 'laser_beam',
      x: tx,
      y: ty,
      z: tz,
      originX: u.x,
      originY,
      originZ: u.z,
      radius: u.role === 'alien_walker' ? 1.5 : 0.9,
      color: beamColor,
      createdAt: Date.now(),
    });
  };

  if (nearestBldFallback && (!nearestCiv || bestBldDistSq + 4 < bestDistSq)) {
    const bDist = Math.sqrt(bestBldDistSq);
    if (bDist <= Math.max(1.8, def.attackRange)) {
      u.state = 'fighting';
      u.targetX = nearestBldFallback.tileX;
      u.targetZ = nearestBldFallback.tileZ;
      if (u.actionCooldown <= 0) {
        u.actionCooldown = u.role === 'alien_walker' ? 1.05 : 0.85;
        if (nearestBldFallback.shieldTimer <= 0) {
          nearestBldFallback.hp = Math.max(0, nearestBldFallback.hp - def.attackDamage * 1.25);
        }
        if (isAlienRanged) {
          const bt = getTile(state, nearestBldFallback.tileX, nearestBldFallback.tileZ);
          fireBeamVfx(nearestBldFallback.tileX, nearestBldFallback.tileZ, (bt?.height ?? 1) * 0.45 + 0.5);
        }
      }
    } else {
      u.state = 'moving';
      const dx = (nearestBldFallback.tileX - u.x) / bDist;
      const dz = (nearestBldFallback.tileZ - u.z) / bDist;
      u.targetX = nearestBldFallback.tileX;
      u.targetZ = nearestBldFallback.tileZ;
      u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + dx * moveSpeed * dt));
      u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + dz * moveSpeed * dt));
      if (u.role === 'alien_walker') stampWalkerFootprints(state, u, startX, startZ);
    }
    return;
  }

  if (!nearestCiv) {
    // Roam slowly around current location when no targets remain
    if (u.actionCooldown <= 0) {
      u.actionCooldown = 2.2;
      const ang = Math.random() * Math.PI * 2;
      u.targetX = Math.max(2, Math.min(state.gridSize - 3, u.x + Math.cos(ang) * 4));
      u.targetZ = Math.max(2, Math.min(state.gridSize - 3, u.z + Math.sin(ang) * 4));
    }
    const rdx = (u.targetX ?? u.x) - u.x;
    const rdz = (u.targetZ ?? u.z) - u.z;
    const rDist = Math.hypot(rdx, rdz);
    if (rDist > 0.4) {
      u.state = 'moving';
      u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + (rdx / rDist) * moveSpeed * 0.65 * dt));
      u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + (rdz / rDist) * moveSpeed * 0.65 * dt));
      if (u.role === 'alien_walker') stampWalkerFootprints(state, u, startX, startZ);
    } else {
      u.state = 'idle';
    }
    return;
  }
  const dist = Math.sqrt(bestDistSq);

  const hostileEff = computeUnitEffectiveStats(u, def);

  if (u.role === 'raider_ranged' || isAlienRanged) {
    const kiteMin = u.role === 'alien_ufo' ? 2.2 : 2.1;
    if (dist < kiteMin && u.role !== 'alien_walker') {
      u.state = 'moving';
      const dx = (u.x - nearestCiv.x) / Math.max(0.1, dist);
      const dz = (u.z - nearestCiv.z) / Math.max(0.1, dist);
      u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + dx * moveSpeed * dt));
      u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + dz * moveSpeed * dt));
    } else if (dist <= Math.max(def.attackRange, hostileEff.attackRange)) {
      u.state = 'fighting';
      u.targetX = nearestCiv.x;
      u.targetZ = nearestCiv.z;
      if (u.actionCooldown <= 0) {
        u.actionCooldown = (u.role === 'alien_walker' ? 1.25 : 0.95) / hostileEff.attackSpeedMult;
        if (!nearestCiv.statusEffects.shielded) {
          const defEff = computeUnitEffectiveStats(nearestCiv);
          const isCrit = Math.random() * 100 < hostileEff.critChance;
          const dealt = Math.max(1, hostileEff.attackDamage * (isCrit ? 1.65 : 1) * (1 - defEff.armor / 100));
          nearestCiv.hp -= dealt;
          nearestCiv.lastAttackerId = u.id;
          nearestCiv.underAttackTimer = 8.0;
          if (hostileEff.vampiric && u.hp > 0) u.hp = Math.min(u.maxHp, u.hp + dealt * 0.2);
          if (hostileEff.venomous) nearestCiv.statusEffects.plagued = Math.max(nearestCiv.statusEffects.plagued ?? 0, 7);
          if (nearestCiv.hp <= 0) u.kills = (u.kills ?? 0) + 1;
        }
        if (u.role === 'alien_walker') {
          // Twin heavy laser splash damage
          for (const other of state.units) {
            if (
              other.id !== nearestCiv.id &&
              other.faction === 'civilization' &&
              other.state !== 'ko' &&
              !other.statusEffects.shielded &&
              (other.x - nearestCiv.x) ** 2 + (other.z - nearestCiv.z) ** 2 <= 3.2
            ) {
              const otherEff = computeUnitEffectiveStats(other);
              other.hp -= Math.max(1, Math.round(hostileEff.attackDamage * 0.45 * (1 - otherEff.armor / 100)));
            }
          }
        }
        if (isAlienRanged) {
          const nt = getTile(state, Math.round(nearestCiv.x), Math.round(nearestCiv.z));
          fireBeamVfx(nearestCiv.x, nearestCiv.z, (nt?.height ?? 1) * 0.45 + 0.5);
        }
      }
    } else {
      u.state = 'moving';
      u.targetX = nearestCiv.x;
      u.targetZ = nearestCiv.z;
      const dx = (nearestCiv.x - u.x) / dist;
      const dz = (nearestCiv.z - u.z) / dist;
      u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + dx * moveSpeed * dt));
      u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + dz * moveSpeed * dt));
      if (u.role === 'alien_walker') stampWalkerFootprints(state, u, startX, startZ);
    }
    return;
  }

  if (dist <= Math.max(def.attackRange, hostileEff.attackRange)) {
    u.state = 'fighting';
    u.targetX = nearestCiv.x;
    u.targetZ = nearestCiv.z;
    if (u.actionCooldown <= 0) {
      u.actionCooldown = 0.75 / hostileEff.attackSpeedMult;
      if (!nearestCiv.statusEffects.shielded) {
        const defEff = computeUnitEffectiveStats(nearestCiv);
        const isCrit = Math.random() * 100 < hostileEff.critChance;
        const dealt = Math.max(1, hostileEff.attackDamage * (isCrit ? 1.65 : 1) * (1 - defEff.armor / 100));
        nearestCiv.hp -= dealt;
        nearestCiv.lastAttackerId = u.id;
        nearestCiv.underAttackTimer = 8.0;
        if (hostileEff.vampiric && u.hp > 0) u.hp = Math.min(u.maxHp, u.hp + dealt * 0.2);
        if (hostileEff.venomous) nearestCiv.statusEffects.plagued = Math.max(nearestCiv.statusEffects.plagued ?? 0, 7);
        if (defEff.thorns && !u.statusEffects.shielded) u.hp -= Math.max(1, dealt * 0.25);
        if (nearestCiv.hp <= 0) u.kills = (u.kills ?? 0) + 1;
      }
    }
  } else {
    u.state = 'moving';
    u.targetX = nearestCiv.x;
    u.targetZ = nearestCiv.z;
    const dx = (nearestCiv.x - u.x) / dist;
    const dz = (nearestCiv.z - u.z) / dist;
    u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + dx * moveSpeed * dt));
    u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + dz * moveSpeed * dt));
  }
}

type BurntTreeBiomeKey = NonNullable<TileData['burntTreeBiome']>;

function getTileTreeBiome(terrain: TerrainType): BurntTreeBiomeKey {
  if (terrain === 'jungle') return 'jungle';
  if (terrain === 'taiga' || terrain === 'tundra' || terrain === 'snow') return 'taiga';
  if (terrain === 'blossom') return 'blossom';
  if (terrain === 'savanna' || terrain === 'badlands' || terrain === 'sand') return 'savanna';
  if (terrain === 'swamp') return 'swamp';
  if (terrain === 'volcanic_wasteland') return 'volcanic';
  if (terrain === 'blighted_mire') return 'blight';
  if (terrain === 'floral_plains') return 'floral';
  if (terrain === 'highland' || terrain === 'mountain' || terrain === 'rock') return 'highland';
  if (terrain === 'grass' || terrain === 'fertile') return 'meadow';
  return 'forest';
}

function isFlammableVegetationTerrain(terrain: TerrainType): boolean {
  return (
    terrain === 'forest' ||
    terrain === 'jungle' ||
    terrain === 'savanna' ||
    terrain === 'taiga' ||
    terrain === 'blossom' ||
    terrain === 'floral_plains' ||
    terrain === 'blighted_mire' ||
    terrain === 'fertile' ||
    terrain === 'grass' ||
    terrain === 'highland' ||
    terrain === 'swamp'
  );
}

function clearBurntTreeState(t: TileData): void {
  delete t.burntTree;
  delete t.burntTreeBiome;
}

function preserveTreeBiomeBeforeScorch(t: TileData): void {
  if (!t.burntTreeBiome && t.terrain !== 'scorched') {
    t.burntTreeBiome = t.treeBiomeOverride ?? getTileTreeBiome(t.terrain);
  }
}

function getTileFlammabilityRate(state: SimulationState, t: TileData): number {
  if (!t || t.height <= 0 || t.onFireTimer > 0 || t.blessedTimer > 0) return 0;
  if (t.buildingId) {
    const bld = state.buildings.find((b) => b.id === t.buildingId);
    if (!bld || bld.hp <= 0 || bld.shieldTimer > 0 || bld.blessedTimer > 0) return 0;
    return bld.epochLevel <= 2 ? 0.42 : 0.32;
  }
  if (t.resourceNode === 'timber_grove') return 0.48;
  if (t.resourceNode === 'berry_bush') return 0.36;
  if (t.terrain === 'forest' || t.terrain === 'jungle' || t.terrain === 'taiga') {
    return 0.38;
  }
  if (t.terrain === 'savanna') return 0.38;
  if (t.terrain === 'blossom' || t.terrain === 'floral_plains' || t.terrain === 'fertile') {
    return 0.32;
  }
  if (t.terrain === 'grass') {
    return t.farmSettlementId ? 0.34 : 0.28;
  }
  if (t.terrain === 'highland' || t.terrain === 'blighted_mire') return 0.22;
  if (t.terrain === 'swamp') return 0.14;
  return 0;
}

export function isCarnivoreAnimal(role: UnitRole, appearanceSeed?: number): boolean {
  if (
    role === 'wolf' ||
    role === 'bear' ||
    role === 'fox' ||
    role === 'lion' ||
    role === 'tiger' ||
    role === 'crocodile' ||
    role === 'polar_bear' ||
    role === 'giant_spider' ||
    role === 'griffin' ||
    role === 'yeti' ||
    role === 'hydra' ||
    role === 'minotaur' ||
    role === 'cerberus' ||
    role === 'basilisk' ||
    role === 'thunderbird' ||
    role === 'kraken' ||
    role === 'manticore' ||
    role === 'gargoyle'
  ) {
    return true;
  }
  if (role === 'dinosaur') return getDinosaurVariant(appearanceSeed).diet === 'carnivore';
  return false;
}

export function isHerbivoreAnimal(role: UnitRole, appearanceSeed?: number): boolean {
  if (
    role === 'cow' ||
    role === 'pig' ||
    role === 'chicken' ||
    role === 'capybara' ||
    role === 'deer' ||
    role === 'sheep' ||
    role === 'rabbit' ||
    role === 'elephant' ||
    role === 'camel' ||
    role === 'penguin' ||
    role === 'horse' ||
    role === 'goat' ||
    role === 'monkey' ||
    role === 'panda' ||
    role === 'turtle' ||
    role === 'frog' ||
    role === 'crab' ||
    role === 'giraffe' ||
    role === 'zebra' ||
    role === 'kangaroo' ||
    role === 'flamingo' ||
    role === 'ostrich' ||
    role === 'seal'
  ) {
    return true;
  }
  if (role === 'dinosaur') return getDinosaurVariant(appearanceSeed).diet === 'herbivore';
  return false;
}

function isPredatorRole(role: UnitRole, appearanceSeed?: number): boolean {
  return (
    role === 'dragon' ||
    role === 'boar' ||
    role === 'hippo' ||
    role === 'rhino' ||
    role === 'gorilla' ||
    role === 'moose' ||
    role === 'bison' ||
    role === 'golem' ||
    role === 'phoenix' ||
    role === 'kitsune' ||
    role === 'pegasus' ||
    role === 'ent' ||
    isCarnivoreAnimal(role, appearanceSeed)
  );
}

function isPreyAnimalRole(role: UnitRole): boolean {
  return (
    role === 'cow' ||
    role === 'pig' ||
    role === 'chicken' ||
    role === 'capybara' ||
    role === 'deer' ||
    role === 'sheep' ||
    role === 'rabbit' ||
    role === 'camel' ||
    role === 'penguin' ||
    role === 'horse' ||
    role === 'goat' ||
    role === 'monkey' ||
    role === 'turtle' ||
    role === 'frog' ||
    role === 'crab' ||
    role === 'giraffe' ||
    role === 'zebra' ||
    role === 'kangaroo' ||
    role === 'flamingo' ||
    role === 'ostrich' ||
    role === 'seal'
  );
}

function tileIsPlantGrazeGround(t: TileData, allowTrees: boolean): boolean {
  if (t.height <= 0 || t.buildingId || t.onFireTimer > 0 || t.cursedTimer > 0) return false;
  if (t.resourceNode === 'berry_bush' && t.resourceAmount > 0) return true;
  if (allowTrees && t.resourceNode === 'timber_grove' && t.resourceAmount > 0) return true;
  return (
    t.terrain === 'fertile' ||
    t.terrain === 'blossom' ||
    t.terrain === 'floral_plains' ||
    t.terrain === 'grass' ||
    t.terrain === 'savanna' ||
    t.terrain === 'highland' ||
    (allowTrees && (t.terrain === 'forest' || t.terrain === 'jungle'))
  );
}

function tileMatchesWildlifeHabitat(
  state: SimulationState,
  t: TileData,
  role: UnitRole,
  appearanceSeed?: number,
): boolean {
  if (role === 'kraken') {
    return t.height === 0 && !t.isRiver && !t.isLake && (t.terrain === 'deep_water' || t.terrain === 'shallow_water');
  }
  if (role === 'giant_spider') {
    return t.height > 0 && (t.terrain === 'blighted_mire' || t.terrain === 'swamp' || t.terrain === 'forest');
  }
  if (role === 'penguin' || role === 'polar_bear' || role === 'seal') {
    if (role === 'seal' && t.terrain === 'shallow_water') return true;
    return t.terrain === 'snow' || t.terrain === 'tundra' || t.terrain === 'ice' || t.terrain === 'taiga';
  }
  if (role === 'turtle' || role === 'crab' || role === 'flamingo') {
    if (role !== 'flamingo' && t.terrain === 'shallow_water') return true;
    if (t.terrain === 'sand' || t.terrain === 'swamp') {
      for (const [ox, oz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nt = getTile(state, t.x + ox, t.z + oz);
        if (nt && (nt.terrain === 'shallow_water' || nt.terrain === 'deep_water' || nt.terrain === 'swamp')) return true;
      }
    }
    return t.terrain === 'sand';
  }
  if (t.height <= 0) return false;
  if (role === 'cow') return t.terrain === 'grass' || t.terrain === 'fertile' || t.terrain === 'floral_plains' || t.terrain === 'savanna';
  if (role === 'horse' || role === 'bison') return t.terrain === 'grass' || t.terrain === 'fertile' || t.terrain === 'floral_plains' || t.terrain === 'savanna' || t.terrain === 'highland';
  if (role === 'chicken') return t.terrain === 'grass' || t.terrain === 'fertile' || t.terrain === 'blossom' || t.terrain === 'floral_plains';
  if (role === 'pig') return t.terrain === 'grass' || t.terrain === 'forest' || t.terrain === 'swamp' || t.terrain === 'fertile';
  if (role === 'deer') return t.terrain === 'forest' || t.terrain === 'blossom' || t.terrain === 'floral_plains' || t.terrain === 'fertile' || t.terrain === 'grass';
  if (role === 'moose') return t.terrain === 'taiga' || t.terrain === 'forest' || t.terrain === 'snow' || t.terrain === 'tundra';
  if (role === 'sheep') return t.terrain === 'grass' || t.terrain === 'fertile' || t.terrain === 'floral_plains' || t.terrain === 'highland';
  if (role === 'goat') return t.terrain === 'highland' || t.terrain === 'mountain' || t.terrain === 'rock' || t.terrain === 'taiga';
  if (role === 'monkey' || role === 'gorilla' || role === 'tiger') return t.terrain === 'jungle' || t.terrain === 'forest' || t.terrain === 'blossom';
  if (role === 'panda') return t.terrain === 'forest' || t.terrain === 'blossom' || t.terrain === 'floral_plains' || t.terrain === 'jungle' || t.terrain === 'fertile';
  if (role === 'rabbit') return t.terrain === 'grass' || t.terrain === 'fertile' || t.terrain === 'blossom' || t.terrain === 'floral_plains' || t.terrain === 'forest' || t.terrain === 'tundra';
  if (role === 'fox') return t.terrain === 'forest' || t.terrain === 'taiga' || t.terrain === 'blossom' || t.terrain === 'floral_plains' || t.terrain === 'grass' || t.terrain === 'tundra';
  if (role === 'boar') return t.terrain === 'forest' || t.terrain === 'swamp' || t.terrain === 'savanna' || t.terrain === 'badlands';
  if (role === 'lion' || role === 'rhino' || role === 'giraffe' || role === 'zebra' || role === 'ostrich') return t.terrain === 'savanna' || t.terrain === 'badlands' || t.terrain === 'grass' || t.terrain === 'sand';
  if (role === 'kangaroo') return t.terrain === 'savanna' || t.terrain === 'badlands' || t.terrain === 'sand';
  if (role === 'elephant') return t.terrain === 'savanna' || t.terrain === 'jungle' || t.terrain === 'fertile';
  if (role === 'camel') return t.terrain === 'sand' || t.terrain === 'badlands' || t.terrain === 'savanna';
  if (role === 'capybara' || role === 'crocodile' || role === 'hippo' || role === 'frog' || role === 'hydra' || role === 'basilisk') {
    if (t.terrain === 'swamp' || t.terrain === 'blighted_mire' || t.terrain === 'jungle' || (role === 'basilisk' && (t.terrain === 'badlands' || t.terrain === 'rock'))) return true;
    if (t.terrain === 'sand' || t.terrain === 'grass' || t.terrain === 'fertile') {
      for (const [ox, oz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nt = getTile(state, t.x + ox, t.z + oz);
        if (nt && (nt.terrain === 'shallow_water' || nt.terrain === 'swamp')) return true;
      }
    }
    return false;
  }
  if (role === 'wolf') return t.terrain === 'forest' || t.terrain === 'taiga' || t.terrain === 'tundra' || t.terrain === 'highland';
  if (role === 'bear') return t.terrain === 'forest' || t.terrain === 'taiga' || t.terrain === 'mountain' || t.terrain === 'tundra';
  if (role === 'dinosaur') {
    if (getDinosaurVariant(appearanceSeed).diet === 'herbivore') {
      return (
        t.terrain === 'jungle' ||
        t.terrain === 'forest' ||
        t.terrain === 'fertile' ||
        t.terrain === 'savanna' ||
        t.terrain === 'blossom' ||
        t.terrain === 'floral_plains'
      );
    }
    return t.terrain === 'jungle' || t.terrain === 'badlands' || t.terrain === 'highland' || t.terrain === 'savanna';
  }
  if (role === 'dragon') return t.terrain === 'mountain' || t.terrain === 'volcanic_wasteland' || t.terrain === 'badlands' || t.terrain === 'rock' || t.terrain === 'highland';
  if (role === 'unicorn' || role === 'pegasus') return t.terrain === 'floral_plains' || t.terrain === 'blossom' || t.terrain === 'forest' || t.terrain === 'fertile' || t.terrain === 'grass' || t.terrain === 'highland';
  if (role === 'phoenix') return t.terrain === 'volcanic_wasteland' || t.terrain === 'blossom' || t.terrain === 'mountain' || t.terrain === 'badlands' || t.terrain === 'savanna';
  if (role === 'griffin' || role === 'thunderbird') return t.terrain === 'highland' || t.terrain === 'mountain' || t.terrain === 'rock' || t.terrain === 'taiga';
  if (role === 'yeti') return t.terrain === 'snow' || t.terrain === 'tundra' || t.terrain === 'mountain' || t.terrain === 'taiga';
  if (role === 'golem' || role === 'gargoyle') return t.terrain === 'mountain' || t.terrain === 'volcanic_wasteland' || t.terrain === 'rock' || t.terrain === 'highland' || t.terrain === 'crystal_field' || t.terrain === 'badlands';
  if (role === 'kitsune') return t.terrain === 'floral_plains' || t.terrain === 'blossom' || t.terrain === 'forest' || t.terrain === 'fertile' || t.terrain === 'mountain';
  if (role === 'minotaur' || role === 'manticore') return t.terrain === 'badlands' || t.terrain === 'rock' || t.terrain === 'highland' || t.terrain === 'savanna' || t.terrain === 'sand';
  if (role === 'cerberus') return t.terrain === 'volcanic_wasteland' || t.terrain === 'badlands' || t.terrain === 'rock' || t.terrain === 'mountain' || t.terrain === 'scorched';
  if (role === 'ent') return t.terrain === 'forest' || t.terrain === 'jungle' || t.terrain === 'blossom' || t.terrain === 'floral_plains' || t.terrain === 'taiga';
  return true;
}

function findDeterministicDinoSeedForMorph(targetMorph: 0 | 1 | 2, base: number): number {
  for (let offset = 1; offset < 64; offset++) {
    const candidate = Math.max(1, base + offset);
    if (getDinosaurVariant(candidate).morph === targetMorph) return candidate;
  }
  return 1;
}

export function seedWorldWildlife(state: SimulationState, maxToAdd?: number): void {
  const gs = state.gridSize;
  const allowFantasy = state.worldRules?.allowFantasy !== false;
  const allowDinosaurs = state.worldRules?.allowDinosaurs !== false;
  const isPrehistoric = state.worldTemplate === 'prehistoric';

  // Scale natural ecosystem density smoothly with map size so large worlds never feel barren
  const mapDensityScale = Math.max(1, Math.min(2.8, gs / 96));
  const scaled = (base: number) => Math.max(1, Math.round(base * mapDensityScale));

  let cursor = (state.seed * 2654435761 + state.units.length * 19349663) >>> 0;
  const nextRand = () => {
    cursor = (Math.imul(cursor, 1664525) + 1013904223) >>> 0;
    return cursor / 4294967296;
  };

  type WildlifeQuota = {
    role: UnitRole;
    count: number;
    predator: boolean;
    herdSize?: number;
    appearanceSeed?: number;
  };

  const respawnPool: WildlifeQuota[] = [
    { role: 'deer', count: 2, predator: false, herdSize: 2 },
    { role: 'sheep', count: 2, predator: false, herdSize: 2 },
    { role: 'rabbit', count: 2, predator: false, herdSize: 2 },
    { role: 'horse', count: 2, predator: false, herdSize: 2 },
    { role: 'goat', count: 2, predator: false, herdSize: 2 },
    { role: 'monkey', count: 2, predator: false, herdSize: 2 },
    { role: 'panda', count: 1, predator: false },
    { role: 'turtle', count: 2, predator: false },
    { role: 'frog', count: 2, predator: false, herdSize: 2 },
    { role: 'crab', count: 2, predator: false, herdSize: 2 },
    { role: 'cow', count: 1, predator: false },
    { role: 'pig', count: 1, predator: false },
    { role: 'chicken', count: 2, predator: false, herdSize: 2 },
    { role: 'capybara', count: 1, predator: false },
    { role: 'camel', count: 1, predator: false },
    { role: 'penguin', count: 2, predator: false, herdSize: 2 },
    { role: 'elephant', count: 1, predator: false },
    { role: 'fox', count: 1, predator: true },
    { role: 'boar', count: 1, predator: true },
    { role: 'wolf', count: 1, predator: true },
    { role: 'lion', count: 1, predator: true },
    { role: 'polar_bear', count: 1, predator: true },
    { role: 'hippo', count: 1, predator: true },
    { role: 'rhino', count: 1, predator: true },
    { role: 'crocodile', count: 1, predator: true },
    { role: 'giant_spider', count: 2, predator: true, herdSize: 2 },
    { role: 'giraffe', count: 2, predator: false, herdSize: 2 },
    { role: 'zebra', count: 2, predator: false, herdSize: 2 },
    { role: 'kangaroo', count: 2, predator: false, herdSize: 2 },
    { role: 'flamingo', count: 2, predator: false, herdSize: 2 },
    { role: 'ostrich', count: 2, predator: false },
    { role: 'seal', count: 2, predator: false, herdSize: 2 },
    { role: 'tiger', count: 1, predator: true },
    { role: 'gorilla', count: 1, predator: true },
    { role: 'moose', count: 1, predator: true },
    { role: 'bison', count: 2, predator: true, herdSize: 2 },
  ];

  // Rotate respawn pool deterministically so successive ecosystem refills diversify every biome
  const rotOffset = Math.floor(nextRand() * respawnPool.length);
  const rotatedRespawn = [
    ...respawnPool.slice(rotOffset),
    ...respawnPool.slice(0, rotOffset),
  ];

  const baseQuotas: WildlifeQuota[] = maxToAdd
    ? rotatedRespawn
    : [
        // Lively grazing herds & biome critters
        { role: 'deer', count: scaled(4), predator: false, herdSize: 3 },
        { role: 'sheep', count: scaled(4), predator: false, herdSize: 3 },
        { role: 'rabbit', count: scaled(5), predator: false, herdSize: 3 },
        { role: 'horse', count: scaled(4), predator: false, herdSize: 3 },
        { role: 'goat', count: scaled(4), predator: false, herdSize: 2 },
        { role: 'monkey', count: scaled(4), predator: false, herdSize: 3 },
        { role: 'panda', count: scaled(3), predator: false, herdSize: 2 },
        { role: 'turtle', count: scaled(4), predator: false, herdSize: 2 },
        { role: 'frog', count: scaled(5), predator: false, herdSize: 3 },
        { role: 'crab', count: scaled(5), predator: false, herdSize: 3 },
        { role: 'giraffe', count: scaled(3), predator: false, herdSize: 2 },
        { role: 'zebra', count: scaled(4), predator: false, herdSize: 3 },
        { role: 'kangaroo', count: scaled(4), predator: false, herdSize: 3 },
        { role: 'flamingo', count: scaled(4), predator: false, herdSize: 3 },
        { role: 'ostrich', count: scaled(3), predator: false, herdSize: 2 },
        { role: 'seal', count: scaled(4), predator: false, herdSize: 3 },
        { role: 'cow', count: scaled(3), predator: false, herdSize: 2 },
        { role: 'pig', count: scaled(3), predator: false, herdSize: 2 },
        { role: 'chicken', count: scaled(4), predator: false, herdSize: 3 },
        { role: 'capybara', count: scaled(3), predator: false, herdSize: 2 },
        { role: 'camel', count: scaled(3), predator: false, herdSize: 2 },
        { role: 'elephant', count: scaled(2), predator: false, herdSize: 2 },
        { role: 'penguin', count: scaled(4), predator: false, herdSize: 3 },
        // Biome predators & heavy territorial bruisers
        { role: 'fox', count: scaled(3), predator: true },
        { role: 'boar', count: scaled(3), predator: true },
        { role: 'wolf', count: scaled(3), predator: true, herdSize: 2 },
        { role: 'bear', count: scaled(2), predator: true },
        { role: 'polar_bear', count: scaled(2), predator: true },
        { role: 'lion', count: scaled(2), predator: true, herdSize: 2 },
        { role: 'tiger', count: scaled(2), predator: true },
        { role: 'gorilla', count: scaled(2), predator: true, herdSize: 2 },
        { role: 'moose', count: scaled(3), predator: true },
        { role: 'bison', count: scaled(3), predator: true, herdSize: 2 },
        { role: 'hippo', count: scaled(2), predator: true },
        { role: 'rhino', count: scaled(2), predator: true },
        { role: 'crocodile', count: scaled(2), predator: true },
        { role: 'giant_spider', count: scaled(3), predator: true, herdSize: 2 },
        // Prehistoric dinosaurs
        { role: 'dinosaur', count: isPrehistoric ? scaled(3) : 1, predator: false, appearanceSeed: findDeterministicDinoSeedForMorph(1, 10) },
        { role: 'dinosaur', count: isPrehistoric ? scaled(3) : 1, predator: false, appearanceSeed: findDeterministicDinoSeedForMorph(2, 20) },
        { role: 'dinosaur', count: isPrehistoric ? scaled(4) : 2, predator: true, appearanceSeed: findDeterministicDinoSeedForMorph(0, 30) },
        // Rare Mythical Creatures anchored to signature biomes
        { role: 'unicorn', count: Math.min(3, Math.max(1, Math.round(mapDensityScale))), predator: false },
        { role: 'pegasus', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.8))), predator: false },
        { role: 'kitsune', count: Math.min(3, Math.max(1, Math.round(mapDensityScale))), predator: false },
        { role: 'phoenix', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.8))), predator: false },
        { role: 'ent', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.8))), predator: false },
        { role: 'griffin', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.8))), predator: true },
        { role: 'yeti', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.8))), predator: true },
        { role: 'golem', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.8))), predator: true },
        { role: 'hydra', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.7))), predator: true },
        { role: 'minotaur', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.7))), predator: true },
        { role: 'cerberus', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.7))), predator: true },
        { role: 'basilisk', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.7))), predator: true },
        { role: 'thunderbird', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.7))), predator: true },
        { role: 'manticore', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.7))), predator: true },
        { role: 'gargoyle', count: Math.min(2, Math.max(1, Math.round(mapDensityScale * 0.7))), predator: true },
        { role: 'dragon', count: Math.min(3, Math.max(1, Math.round(mapDensityScale))), predator: true },
      ];

  const quotas = baseQuotas.filter((q) => {
    if (!allowFantasy && MYTHICAL_ROLE_SET.has(q.role)) return false;
    if (!allowDinosaurs && q.role === 'dinosaur') return false;
    return true;
  });

  const isNearCivilization = (tx: number, tz: number, safeDist: number) => {
    for (const b of state.buildings) {
      if (Math.hypot(b.tileX - tx, b.tileZ - tz) < safeDist) return true;
    }
    for (const u of state.units) {
      if (u.faction === 'civilization' && Math.hypot(u.x - tx, u.z - tz) < safeDist) return true;
    }
    return false;
  };

  let spawnedTotal = 0;

  const trySpawnHerdAt = (q: WildlifeQuota, anchorX: number, anchorZ: number, remaining: number): number => {
    const want = Math.min(remaining, q.herdSize ?? 1);
    let added = 0;
    for (let m = 0; m < want; m++) {
      if (maxToAdd !== undefined && spawnedTotal >= maxToAdd) break;
      const sx =
        m === 0
          ? anchorX
          : Math.max(3, Math.min(gs - 4, anchorX + Math.round((nextRand() - 0.5) * 4)));
      const sz =
        m === 0
          ? anchorZ
          : Math.max(3, Math.min(gs - 4, anchorZ + Math.round((nextRand() - 0.5) * 4)));
      const st = getTile(state, sx, sz);
      if (!st || st.buildingId || st.onFireTimer > 0) continue;
      const okIce = (q.role === 'penguin' || q.role === 'polar_bear' || q.role === 'seal') && st.terrain === 'ice';
      const okShallow = (q.role === 'turtle' || q.role === 'crab' || q.role === 'seal') && st.terrain === 'shallow_water';
      if (st.height <= 0 && !okIce && !okShallow) continue;
      const seedForSlot =
        q.appearanceSeed !== undefined
          ? findDeterministicDinoSeedForMorph(getDinosaurVariant(q.appearanceSeed).morph, q.appearanceSeed + (spawnedTotal + m) * 7)
          : undefined;
      const res = spawnUnit(state, q.role, sx, sz, true, undefined, seedForSlot ? { appearanceSeed: seedForSlot } : undefined);
      if (res.ok) {
        added++;
        spawnedTotal++;
      }
    }
    return added;
  };

  for (const q of quotas) {
    if (maxToAdd !== undefined && spawnedTotal >= maxToAdd) break;
    let placed = 0;
    const minCivDist = q.predator ? 15 : 5;

    // Pass 1: habitat-matched tiles (spawning small natural herd clusters)
    for (let attempt = 0; attempt < 95 && placed < q.count; attempt++) {
      if (maxToAdd !== undefined && spawnedTotal >= maxToAdd) break;
      const tx = 4 + Math.floor(nextRand() * (gs - 8));
      const tz = 4 + Math.floor(nextRand() * (gs - 8));
      const t = getTile(state, tx, tz);
      if (!t || t.buildingId || t.onFireTimer > 0) continue;
      const okIce = (q.role === 'penguin' || q.role === 'polar_bear' || q.role === 'seal') && t.terrain === 'ice';
      const okShallow = (q.role === 'turtle' || q.role === 'crab' || q.role === 'seal') && t.terrain === 'shallow_water';
      if (t.height <= 0 && !okIce && !okShallow) continue;
      if (!tileMatchesWildlifeHabitat(state, t, q.role, q.appearanceSeed)) continue;
      if (isNearCivilization(tx, tz, minCivDist)) continue;
      placed += trySpawnHerdAt(q, tx, tz, q.count - placed);
    }

    // Pass 2: fallback any dry wilderness tile (skipping strict polar specialists if none exist on template)
    const strictSpecialist = q.role === 'penguin' || q.role === 'polar_bear' || q.role === 'yeti' || q.role === 'seal' || q.role === 'giant_spider';
    for (let attempt = 0; attempt < (strictSpecialist ? 0 : 35) && placed < q.count; attempt++) {
      if (maxToAdd !== undefined && spawnedTotal >= maxToAdd) break;
      const tx = 4 + Math.floor(nextRand() * (gs - 8));
      const tz = 4 + Math.floor(nextRand() * (gs - 8));
      const t = getTile(state, tx, tz);
      if (!t || t.height <= 0 || t.buildingId || t.onFireTimer > 0) continue;
      if (isNearCivilization(tx, tz, minCivDist)) continue;
      placed += trySpawnHerdAt(q, tx, tz, q.count - placed);
    }
  }

  // Seed 1-2 Leviathans & 1-2 Krakens in deep/open ocean tiles if not already present
  const existingLeviathans = state.units.filter((u) => u.role === 'leviathan' && u.state !== 'ko').length;
  const targetLeviathans = state.worldTemplate === 'scrap_sea' || state.worldTemplate === 'archipelago' ? 2 : 1;
  if (allowFantasy && existingLeviathans < targetLeviathans && (maxToAdd === undefined || spawnedTotal < maxToAdd)) {
    let levPlaced = 0;
    for (let attempt = 0; attempt < 90 && existingLeviathans + levPlaced < targetLeviathans; attempt++) {
      const tx = 6 + Math.floor(nextRand() * (gs - 12));
      const tz = 6 + Math.floor(nextRand() * (gs - 12));
      const t = getTile(state, tx, tz);
      if (!t || t.height > 0 || t.isRiver || t.isLake || t.buildingId) continue;
      if (isNearCivilization(tx, tz, 14)) continue;
      const res = spawnUnit(state, 'leviathan', tx, tz, true);
      if (res.ok) {
        levPlaced++;
        spawnedTotal++;
      }
    }
  }
  const existingKrakens = state.units.filter((u) => u.role === 'kraken' && u.state !== 'ko').length;
  const targetKrakens = state.worldTemplate === 'scrap_sea' || state.worldTemplate === 'archipelago' ? 2 : 1;
  if (allowFantasy && existingKrakens < targetKrakens && (maxToAdd === undefined || spawnedTotal < maxToAdd)) {
    let krakPlaced = 0;
    for (let attempt = 0; attempt < 90 && existingKrakens + krakPlaced < targetKrakens; attempt++) {
      const tx = 6 + Math.floor(nextRand() * (gs - 12));
      const tz = 6 + Math.floor(nextRand() * (gs - 12));
      const t = getTile(state, tx, tz);
      if (!t || t.height > 0 || t.isRiver || t.isLake || t.buildingId) continue;
      if (isNearCivilization(tx, tz, 12)) continue;
      const res = spawnUnit(state, 'kraken', tx, tz, true);
      if (res.ok) {
        krakPlaced++;
        spawnedTotal++;
      }
    }
  }
}

const wildlifeBreedCooldownMap = new WeakMap<UnitEntity, number>();
const wildlifeBreedTickMap = new WeakMap<SimulationState, number>();

/** Hidden world-size wildlife population limit (never displayed in HUD). */
function getHiddenWorldWildlifeCap(gridSize: number): number {
  return Math.round(Math.min(640, Math.max(70, gridSize * 1.45)));
}

/** Hidden per-species population cap scaled by world size so no single species crowds out the map. */
function getHiddenSpeciesWildlifeCap(gridSize: number, role: UnitRole): number {
  if (MYTHICAL_ROLE_SET.has(role)) {
    return Math.max(1, Math.min(4, Math.round(gridSize / 64)));
  }
  return Math.max(4, Math.min(18, Math.round(gridSize / 16)));
}

/**
 * Natural wildlife reproduction:
 * - Strictly respects `state.worldRules.allowReproduction !== false`.
 * - Enforces hidden world-size total and per-species caps.
 * - Healthy, mature, well-fed animals pair with a nearby same-species mate (or trigger rare
 *   herd recovery if they are the lone survivor of a non-mythic species) to birth a juvenile.
 */
function stepWildlifeReproduction(state: SimulationState, dt: number): void {
  if (state.worldRules?.allowReproduction === false) return;

  const acc = (wildlifeBreedTickMap.get(state) ?? 0) + dt;
  if (acc < 3.2) {
    wildlifeBreedTickMap.set(state, acc);
    return;
  }
  wildlifeBreedTickMap.set(state, 0);

  const worldCap = getHiddenWorldWildlifeCap(state.gridSize);
  const livingWildlife: UnitEntity[] = [];
  const countByRole = new Map<UnitRole, number>();
  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (u.faction !== 'wildlife' || u.state === 'ko') continue;
    livingWildlife.push(u);
    countByRole.set(u.role, (countByRole.get(u.role) ?? 0) + 1);
  }

  let totalWildlife = livingWildlife.length;
  if (totalWildlife >= worldCap || totalWildlife === 0) return;

  const nowYear = state.year ?? 0;
  const maxBirthsPerCycle = Math.min(6, worldCap - totalWildlife);
  let birthsThisCycle = 0;
  const pairedThisCycle = new Set<string>();

  for (let i = 0; i < livingWildlife.length && birthsThisCycle < maxBirthsPerCycle; i++) {
    const parentA = livingWildlife[i];
    if (pairedThisCycle.has(parentA.id)) continue;
    if (parentA.state === 'fighting' || parentA.draggedByPlayer) continue;
    if (parentA.hp < parentA.maxHp * 0.55) continue;
    if ((parentA.ageYears ?? 0) < 1.5) continue;
    if ((parentA.statusEffects?.plagued ?? 0) > 0) continue;

    const nextReadyA = wildlifeBreedCooldownMap.get(parentA) ?? 0;
    if (nowYear < nextReadyA) continue;

    const roleCount = countByRole.get(parentA.role) ?? 0;
    const speciesCap = getHiddenSpeciesWildlifeCap(state.gridSize, parentA.role);
    if (roleCount >= speciesCap) continue;

    const isMythic = MYTHICAL_ROLE_SET.has(parentA.role);
    let mate: UnitEntity | null = null;
    for (let j = i + 1; j < livingWildlife.length; j++) {
      const cand = livingWildlife[j];
      if (cand.role !== parentA.role || pairedThisCycle.has(cand.id)) continue;
      if (cand.state === 'fighting' || cand.draggedByPlayer) continue;
      if (cand.hp < cand.maxHp * 0.55 || (cand.ageYears ?? 0) < 1.5 || (cand.statusEffects?.plagued ?? 0) > 0) continue;
      if (nowYear < (wildlifeBreedCooldownMap.get(cand) ?? 0)) continue;
      const distSq = (cand.x - parentA.x) ** 2 + (cand.z - parentA.z) ** 2;
      if (distSq <= 14 * 14) {
        mate = cand;
        break;
      }
    }

    // Allow lone surviving non-mythic animals in good health to slowly repopulate so species don't vanish permanently
    const allowLoneRecovery = !mate && !isMythic && roleCount === 1 && parentA.hp >= parentA.maxHp * 0.75;
    if (!mate && !allowLoneRecovery) continue;

    // Pick a valid spawn spot right beside parentA matching parentA's land/water habitat
    const px = Math.round(parentA.x);
    const pz = Math.round(parentA.z);
    const parentTile = getTile(state, px, pz);
    const parentInWater = Boolean(parentTile && parentTile.height === 0);
    let spawnX = px;
    let spawnZ = pz;
    const offsets: readonly [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [0, 0],
    ];
    for (let oi = 0; oi < offsets.length; oi++) {
      const cx = Math.max(1, Math.min(state.gridSize - 2, px + offsets[oi][0]));
      const cz = Math.max(1, Math.min(state.gridSize - 2, pz + offsets[oi][1]));
      const ct = getTile(state, cx, cz);
      if (!ct || ct.buildingId) continue;
      if (parentInWater ? ct.height === 0 : ct.height > 0) {
        spawnX = cx;
        spawnZ = cz;
        break;
      }
    }

    const res = spawnUnit(state, parentA.role, spawnX, spawnZ, true, undefined, {
      ageStage: 'child',
      ageYears: 0,
      isBirth: true,
    });
    if (!res.ok || !res.unit) continue;

    // Cooldown in simulation years (~6-7 years for normal wildlife, ~18 years for mythics)
    const cooldownYears = isMythic ? 18 : 6.5;
    wildlifeBreedCooldownMap.set(parentA, nowYear + cooldownYears);
    pairedThisCycle.add(parentA.id);
    if (mate) {
      wildlifeBreedCooldownMap.set(mate, nowYear + cooldownYears);
      pairedThisCycle.add(mate.id);
    }

    // Subtle soft-pink birth spark VFX
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'hit_spark',
      x: spawnX,
      y: (getTile(state, spawnX, spawnZ)?.height ?? 1) * 0.45 + 0.35,
      z: spawnZ,
      radius: 0.55,
      color: '#f9a8d4',
      createdAt: Date.now(),
    });

    countByRole.set(parentA.role, roleCount + 1);
    totalWildlife++;
    birthsThisCycle++;
  }
}

function stepWildlifeAI(
  state: SimulationState,
  u: UnitEntity,
  def: typeof UNITS[number],
  moveSpeed: number,
  dt: number,
): void {
  const gs = state.gridSize;
  const isFlying = FLYING_WILDLIFE_ROLES.has(u.role) && !(u.role === 'gargoyle' && u.gargoylePetrified);
  const canWalkIce = u.role === 'penguin' || u.role === 'yeti' || u.role === 'polar_bear' || u.role === 'seal';
  const canWalkShallows =
    u.role === 'turtle' ||
    u.role === 'crab' ||
    u.role === 'frog' ||
    u.role === 'hippo' ||
    u.role === 'crocodile' ||
    u.role === 'hydra' ||
    u.role === 'basilisk' ||
    u.role === 'seal' ||
    u.role === 'kraken';
  const canWalkDeepWater = u.role === 'kraken';
  if (u.role === 'kraken') {
    u.isSwimming = false;
    u.swimStamina = 100;
  }
  if ((u.attackAnimTimer ?? 0) > 0) {
    u.attackAnimTimer = Math.max(0, (u.attackAnimTimer ?? 0) - dt);
  }
  if ((u.wildlifeSkillCooldown ?? 0) > 0) {
    u.wildlifeSkillCooldown = Math.max(0, (u.wildlifeSkillCooldown ?? 0) - dt);
  }
  if ((u.dinoRushTimer ?? 0) > 0) {
    u.dinoRushTimer = Math.max(0, (u.dinoRushTimer ?? 0) - dt);
  }
  const curTile = getTile(state, u.x, u.z);
  if (!isFlying && !canWalkDeepWater && u.role !== 'leviathan') {
    const onLiquidWater = Boolean(
      curTile &&
        curTile.height === 0 &&
        curTile.terrain !== 'ice' &&
        !(canWalkShallows && curTile.terrain === 'shallow_water'),
    );
    u.isSwimming = onLiquidWater;
  }
  // Cerberus hellhound flaming pawprints: walking erupts fire along its path & ignites surrounding tiles
  if (
    u.role === 'cerberus' &&
    u.state !== 'ko' &&
    curTile &&
    curTile.height > 0 &&
    (u.state === 'moving' || u.state === 'fighting')
  ) {
    curTile.onFireTimer = Math.max(curTile.onFireTimer, 6.5);
    if (curTile.terrain === 'snow' || curTile.terrain === 'tundra') {
      curTile.terrain = 'scorched';
    }
    if (Math.random() < dt * 2.4) {
      const dirs: ReadonlyArray<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      const [ox, oz] = dirs[Math.floor(Math.random() * dirs.length)];
      const nb = getTile(state, curTile.x + ox, curTile.z + oz);
      if (nb && nb.height > 0) {
        nb.onFireTimer = Math.max(nb.onFireTimer, 4.8);
      }
    }
  }
  if (
    curTile &&
    curTile.onFireTimer > 0 &&
    !u.statusEffects.shielded &&
    !isFlying &&
    u.role !== 'golem' &&
    u.role !== 'cerberus' &&
    u.role !== 'gargoyle'
  ) {
    u.hp -= 10 * dt;
  }
  // Hydra passive multi-head regeneration & Stone Golem rock-armor mending
  if (u.role === 'hydra' && u.state !== 'ko' && u.hp < u.maxHp) {
    u.hp = Math.min(u.maxHp, u.hp + 14 * dt);
  } else if (u.role === 'golem' && u.state !== 'ko' && u.hp < u.maxHp) {
    u.hp = Math.min(u.maxHp, u.hp + 4.5 * dt);
  }
  // Wake disguised Treant / petrified Gargoyle immediately if dragged or attacked
  if (u.role === 'ent' && (u.draggedByPlayer || (u.underAttackTimer ?? 0) > 0)) {
    u.treantDisguised = false;
    u.treantIdleTimer = 0;
  }
  if (u.role === 'gargoyle' && (u.draggedByPlayer || (u.underAttackTimer ?? 0) > 0)) {
    u.gargoylePetrified = false;
    u.treantIdleTimer = 0;
  }

  // Leviathan:
  // - Roams open seas as a terrifying undulating silhouette (leviathanSubmerged = true) when hidden
  // - Unleashes a 7-second stationary high-pressure Water Beam with gaping mouth (10s cooldown) that destroys buildings, units & landmasses
  // - Performs a slow-motion Breach Jump every 30s: dives deep for 2.2s while seas appear calm, bursts out head-first in slow motion for 4.0s,
  //   and slams head-first back into the sea to trigger omnidirectional Tsunamis & Rogue Waves
  // - Generates Rogue Waves when attacking, and rarely devours small islands in the deep seas (never islands in shallow seas)
  if (u.role === 'leviathan') {
    u.isSwimming = false;
    u.swimStamina = 100;
    u.leviathanSurfaceTimer = (u.leviathanSurfaceTimer ?? 10) - dt;
    if ((u.leviathanBeamTimer ?? 0) <= 0) {
      u.leviathanBeamCooldown = Math.max(0, (u.leviathanBeamCooldown ?? 0) - dt);
    }
    if ((u.leviathanLeapTimer ?? 0) <= 0) {
      u.leviathanLeapCooldown = Math.max(0, (u.leviathanLeapCooldown ?? 0) - dt);
    }
    u.leviathanEatIslandCooldown = Math.max(0, (u.leviathanEatIslandCooldown ?? 60) - dt);

    // Helper: checks if a land tile is part of a small island situated in the DEEP SEAS (and NOT in shallow seas)
    const isDeepSeaIslandTile = (tx: number, tz: number): boolean => {
      const centerT = getTile(state, tx, tz);
      if (!centerT || centerT.height <= 0) return false;
      let deepCount = 0;
      let shallowCount = 0;
      let landCount = 0;
      for (let oz = -3; oz <= 3; oz++) {
        for (let ox = -3; ox <= 3; ox++) {
          const nt = getTile(state, tx + ox, tz + oz);
          if (!nt) continue;
          if (nt.height > 0) {
            landCount++;
          } else if (nt.terrain === 'deep_water') {
            deepCount++;
          } else if (nt.terrain === 'shallow_water') {
            shallowCount++;
          }
        }
      }
      // Must be surrounded predominantly by deep_water with virtually no shallow_water shelf, and be a small island
      return deepCount >= 8 && shallowCount <= deepCount * 0.2 && landCount <= 16;
    };

    // 1. ACTIVE SLOW-MOTION BREACH JUMP SEQUENCE (6.2s total: 2.2s deep dive + 4.0s slow-mo head-first arc -> omnidirectional Tsunami impact)
    if ((u.leviathanLeapTimer ?? 0) > 0) {
      const prevLeap = u.leviathanLeapTimer!;
      u.leviathanLeapTimer = Math.max(0, prevLeap - dt);
      const LEAP_TOTAL = 6.2;
      const DIVE_DUR = 2.2;
      const AIR_DUR = LEAP_TOTAL - DIVE_DUR; // 4.0s slow-motion airtime
      const prevElapsed = LEAP_TOTAL - prevLeap;
      const elapsedLeap = LEAP_TOTAL - u.leviathanLeapTimer;

      if (elapsedLeap < DIVE_DUR) {
        // Phase 1 (0.0s .. 2.2s): Deep dive — the seas appear deceptively calm above while the Leviathan gathers momentum in the abyss
        u.leviathanSubmerged = true;
        u.state = 'moving';
        const diveProg = elapsedLeap / DIVE_DUR;
        u.altitude = -1.35 * Math.sin(diveProg * Math.PI * 0.5);
        return;
      }

      // Phase 2 (2.2s .. 6.2s): Bursts out of the ocean HEAD-FIRST in majestic slow-motion!
      u.leviathanSubmerged = false;
      u.state = 'fighting';
      if (prevElapsed < DIVE_DUR && elapsedLeap >= DIVE_DUR) {
        // Erupt from the deep!
        const sx = u.leviathanLeapStartX ?? u.x;
        const sz = u.leviathanLeapStartZ ?? u.z;
        const tx = u.leviathanLeapTargetX ?? u.targetX;
        const tz = u.leviathanLeapTargetZ ?? u.targetZ;
        const bHeading = Math.atan2(tz - sz, tx - sx);
        state.activeHazards.push({
          id: nextEntityId('haz'),
          kind: 'rogue_wave',
          x: sx,
          z: sz,
          windX: Math.cos(bHeading),
          windZ: Math.sin(bHeading),
          heading: bHeading,
          radius: 4.2,
          remaining: 5.5,
          duration: 5.5,
          tickTimer: 0,
          sourceUnitId: u.id,
        });
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'tsunami',
          x: sx,
          y: 0.35,
          z: sz,
          radius: 5.2,
          color: '#00f5d4',
          createdAt: Date.now(),
        });
      }

      const airProg = Math.min(1, Math.max(0, (elapsedLeap - DIVE_DUR) / AIR_DUR));
      const sx = u.leviathanLeapStartX ?? u.x;
      const sz = u.leviathanLeapStartZ ?? u.z;
      const tx = u.leviathanLeapTargetX ?? u.targetX;
      const tz = u.leviathanLeapTargetZ ?? u.targetZ;
      u.x = Math.max(3, Math.min(gs - 4, sx + (tx - sx) * airProg));
      u.z = Math.max(3, Math.min(gs - 4, sz + (tz - sz) * airProg));
      u.targetX = tx;
      u.targetZ = tz;
      // High, slow-motion parabolic arc (reaching 5.8 units above the sea)
      u.altitude = Math.sin(airProg * Math.PI) * 5.8;

      if (u.leviathanLeapTimer <= 0) {
        // Phase 3 (t = 6.2s): Cataclysmic HEAD-FIRST reentry impact — unleashes Tsunamis & Rogue Waves in ALL directions!
        u.altitude = 0;
        u.leviathanLeapCooldown = 30.0; // Strictly 30-second cooldown!
        u.attackAnimTimer = 0.75;

        // Omnidirectional radial Tsunami Wave expanding in all directions
        state.activeHazards.push({
          id: nextEntityId('haz'),
          kind: 'tsunami_wave',
          x: u.x,
          z: u.z,
          radius: 4.5,
          currentRadius: 1.2,
          maxRadius: 15.5,
          remaining: 7.5,
          duration: 7.5,
          tickTimer: 0,
          sourceUnitId: u.id,
        });

        // 8 radial Rogue Waves surging outward in all compass directions
        for (let dirIdx = 0; dirIdx < 8; dirIdx++) {
          const ang = (dirIdx * Math.PI) / 4;
          state.activeHazards.push({
            id: nextEntityId('haz'),
            kind: 'rogue_wave',
            x: u.x + Math.cos(ang) * 1.5,
            z: u.z + Math.sin(ang) * 1.5,
            windX: Math.cos(ang),
            windZ: Math.sin(ang),
            heading: ang,
            radius: 3.8,
            remaining: 5.5,
            duration: 5.5,
            tickTimer: 0,
            sourceUnitId: u.id,
          });
        }

        // Direct impact crushing damage around the landing point
        for (const v of state.vehicles ?? []) {
          if (Math.hypot(v.x - u.x, v.z - u.z) <= 5.2) {
            v.hp = Math.max(0, (v.hp ?? 100) - 240);
          }
        }
        for (const other of state.units) {
          if (other.id === u.id || other.state === 'ko' || other.statusEffects.shielded) continue;
          if (Math.hypot(other.x - u.x, other.z - u.z) <= 5.2) {
            other.hp = Math.max(0, other.hp - 160);
            if (other.hp <= 0) {
              other.state = 'ko';
              other.koTimer = 0.45;
            }
          }
        }
        for (const b of state.buildings) {
          if (b.shieldTimer <= 0 && Math.hypot(b.tileX - u.x, b.tileZ - u.z) <= 5.2) {
            b.hp = Math.max(0, b.hp - 260);
          }
        }

        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'tsunami',
          x: u.x,
          y: 0.4,
          z: u.z,
          radius: 7.5,
          color: '#00bbf9',
          createdAt: Date.now(),
        });
      }
      return;
    }

    // 2. ACTIVE 7-SECOND STATIONARY WATER BEAM ATTACK (mouth gapes wide open, cannot move, destroys buildings, units & landmasses)
    if ((u.leviathanBeamTimer ?? 0) > 0) {
      const prevBeam = u.leviathanBeamTimer!;
      u.leviathanBeamTimer = Math.max(0, prevBeam - dt);
      u.leviathanSubmerged = false;
      u.state = 'fighting';
      u.attackAnimTimer = 0.55;
      u.altitude = 0;

      // Lock position while firing the Water Beam (cannot move during the 7-second channel!)
      if (u.leviathanBeamOriginX !== undefined && u.leviathanBeamOriginZ !== undefined) {
        u.x = u.leviathanBeamOriginX;
        u.z = u.leviathanBeamOriginZ;
      }

      const btx = u.leviathanBeamTargetX ?? u.targetX;
      const btz = u.leviathanBeamTargetZ ?? u.targetZ;
      u.targetX = btx;
      u.targetZ = btz;
      u.attackTargetX = btx;
      u.attackTargetZ = btz;

      const bdx = btx - u.x;
      const bdz = btz - u.z;
      const bLen = Math.max(1.0, Math.hypot(bdx, bdz));
      const dirX = bdx / bLen;
      const dirZ = bdz / bLen;

      // Helper: distance from point (px, pz) to the active Water Beam segment from (u.x, u.z) to (btx, btz)
      const distToBeam = (px: number, pz: number): number => {
        const vx = px - u.x;
        const vz = pz - u.z;
        const proj = Math.max(0, Math.min(bLen + 1.5, vx * dirX + vz * dirZ));
        const cx = u.x + dirX * proj;
        const cz = u.z + dirZ * proj;
        return Math.hypot(px - cx, pz - cz);
      };

      // Destroy buildings, ships, and units caught in the pressurized Water Beam
      for (const b of state.buildings) {
        if (b.hp <= 0 || b.shieldTimer > 0) continue;
        if (distToBeam(b.tileX, b.tileZ) <= 2.35) {
          b.hp = Math.max(0, b.hp - 195 * dt);
        }
      }
      for (const v of state.vehicles ?? []) {
        if ((v.hp ?? 0) <= 0) continue;
        if (distToBeam(v.x, v.z) <= 2.35) {
          v.hp = Math.max(0, (v.hp ?? 100) - 210 * dt);
        }
      }
      for (const other of state.units) {
        if (other.id === u.id || other.state === 'ko' || other.statusEffects.shielded) continue;
        const isProvokedDragon = other.role === 'dragon' && (u.underAttackTimer ?? 0) > 0 && other.id === u.lastAttackerId;
        if (other.role === 'dragon' && !isProvokedDragon) continue;
        if (distToBeam(other.x, other.z) <= 2.25) {
          other.hp = Math.max(0, other.hp - 115 * dt);
          if (other.hp <= 0) {
            other.state = 'ko';
            other.koTimer = 0.45;
            if (other.faction === 'hostile') state.totalRaidersDefeated += 1;
          }
        }
      }

      // Erode & destroy landmasses along the Water Beam path every 0.5s pulse
      if (Math.floor(prevBeam * 2.0) !== Math.floor(u.leviathanBeamTimer * 2.0)) {
        const steps = Math.ceil(bLen);
        for (let s = 2; s <= steps + 1; s++) {
          const sx = Math.round(u.x + dirX * s);
          const sz = Math.round(u.z + dirZ * s);
          for (let oz = -1; oz <= 1; oz++) {
            for (let ox = -1; ox <= 1; ox++) {
              if (Math.abs(ox) + Math.abs(oz) > 1 && s < steps) continue;
              const lt = getTile(state, sx + ox, sz + oz);
              if (!lt) continue;
              if (lt.height === 0) {
                damageOrBleachWaterTile(lt, 220, true);
              } else if (lt.height >= 1) {
                lt.height = Math.max(0, lt.height - 1);
                lt.onFireTimer = 0;
                if (lt.height === 0) {
                  lt.terrain = isDeepSeaIslandTile(sx + ox, sz + oz) ? 'deep_water' : 'shallow_water';
                  lt.resourceNode = 'none';
                  lt.resourceAmount = 0;
                  if (lt.buildingId) {
                    const hitBld = state.buildings.find((b) => b.id === lt.buildingId);
                    if (hitBld && hitBld.shieldTimer <= 0) hitBld.hp = 0;
                  }
                } else if (lt.terrain !== 'rock' && lt.terrain !== 'mountain') {
                  lt.terrain = 'sand';
                  if (lt.resourceNode === 'timber_grove' || lt.resourceNode === 'berry_bush') {
                    lt.resourceNode = 'none';
                    lt.resourceAmount = 0;
                  }
                }
              }
            }
          }
        }
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'hit_spark',
          x: btx,
          y: 0.35,
          z: btz,
          radius: 4.2,
          color: '#00f5d4',
          createdAt: Date.now(),
        });
      }

      if (u.leviathanBeamTimer <= 0) {
        // Strictly 10-second cooldown after the 7-second Water Beam finishes!
        u.leviathanBeamCooldown = 10.0;
      }
      return;
    }

    // 3. ACQUIRE COMBAT TARGETS (ships, swimmers/coastal units, coastal/floating buildings)
    let targetShip: VehicleEntity | null = null;
    let targetUnit: UnitEntity | null = null;
    let targetBld: BuildingEntity | null = null;
    let bestDist = 16.0;

    for (const v of state.vehicles ?? []) {
      if ((v.hp ?? 0) <= 0 || (v.type !== 'passenger_ship' && v.type !== 'warship')) continue;
      const d = Math.hypot(v.x - u.x, v.z - u.z);
      if (d < bestDist) {
        bestDist = d;
        targetShip = v;
      }
    }
    for (const other of state.units) {
      if (other.id === u.id || other.state === 'ko' || other.hp <= 0 || other.role === 'leviathan') continue;
      const isAttacker = (u.underAttackTimer ?? 0) > 0 && other.id === u.lastAttackerId;
      if (!isAttacker && other.role === 'dragon') continue;
      const ot = getTile(state, Math.round(other.x), Math.round(other.z));
      if (!isAttacker && (!ot || ot.height > 2)) continue;
      const d = Math.hypot(other.x - u.x, other.z - u.z);
      const effD = isAttacker ? d * 0.7 : d;
      if (effD < bestDist) {
        bestDist = effD;
        targetUnit = other;
        targetShip = null;
      }
    }
    if (!targetShip && !targetUnit && (state.worldRules?.animalAttacks !== false || u.statusEffects.frenzied)) {
      for (const b of state.buildings) {
        if (b.hp <= 0 || b.shieldTimer > 0) continue;
        const bt = getTile(state, b.tileX, b.tileZ);
        if (!bt || bt.height > 2) continue;
        const d = Math.hypot(b.tileX - u.x, b.tileZ - u.z);
        if (d < bestDist) {
          bestDist = d;
          targetBld = b;
        }
      }
    }

    const hasTarget = Boolean(targetShip || targetUnit || targetBld);
    if (hasTarget) {
      const tx = targetShip ? targetShip.x : targetUnit ? targetUnit.x : targetBld!.tileX;
      const tz = targetShip ? targetShip.z : targetUnit ? targetUnit.z : targetBld!.tileZ;
      u.targetX = tx;
      u.targetZ = tz;
      const dx = tx - u.x;
      const dz = tz - u.z;
      const dist = Math.hypot(dx, dz);

      // Priority A: Trigger Slow-Motion Breach Jump (30s cooldown) when target is 3.0..14.0 tiles away
      if ((u.leviathanLeapCooldown ?? 0) <= 0 && dist >= 3.0 && dist <= 14.0) {
        let landX = tx;
        let landZ = tz;
        const tTile = getTile(state, Math.round(tx), Math.round(tz));
        if (!tTile || tTile.height > 0) {
          // Pick nearest water tile adjacent to the coastal target so the Leviathan lands in the sea
          let bestWDist = 999;
          for (let oz = -3; oz <= 3; oz++) {
            for (let ox = -3; ox <= 3; ox++) {
              const wt = getTile(state, Math.round(tx) + ox, Math.round(tz) + oz);
              if (wt && wt.height === 0) {
                const wd = Math.hypot(wt.x - tx, wt.z - tz);
                if (wd < bestWDist) {
                  bestWDist = wd;
                  landX = wt.x;
                  landZ = wt.z;
                }
              }
            }
          }
        }
        u.leviathanLeapTimer = 6.2; // 2.2s dive + 4.0s slow-motion head-first breach leap
        u.leviathanLeapCooldown = 30.0;
        u.leviathanLeapStartX = u.x;
        u.leviathanLeapStartZ = u.z;
        u.leviathanLeapTargetX = landX;
        u.leviathanLeapTargetZ = landZ;
        u.leviathanSubmerged = true;
        addChronicle(
          state,
          `The enraged Leviathan (${u.name}) breaches skyward from the abyss to crush coastal targets!`,
          'warning',
        );
        return;
      }

      // Priority B: Trigger 7-Second Stationary Water Beam (10s cooldown) when target is within 1.0..13.5 tiles
      if ((u.leviathanBeamCooldown ?? 0) <= 0 && dist >= 1.0 && dist <= 13.5) {
        u.leviathanSubmerged = false;
        u.leviathanBeamTimer = 7.0; // Channels for 7 seconds while stationary with gaping jaws!
        u.leviathanBeamCooldown = 10.0;
        u.leviathanBeamOriginX = u.x;
        u.leviathanBeamOriginZ = u.z;
        u.leviathanBeamTargetX = tx;
        u.leviathanBeamTargetZ = tz;
        u.attackTargetX = tx;
        u.attackTargetZ = tz;
        u.attackAnimTimer = 0.7;
        u.state = 'fighting';
        addChronicle(
          state,
          `The enraged Leviathan (${u.name}) unhinges its jaws and unleashes a pressurized abyssal Hydro-Beam!`,
          'warning',
        );
        return;
      }

      // Priority C: Surface to melee thrash & unleash surging Rogue Waves!
      u.leviathanSubmerged = false;
      if (dist <= 4.8) {
        u.state = 'fighting';
        u.attackTargetX = tx;
        u.attackTargetZ = tz;
        if (u.actionCooldown <= 0) {
          u.actionCooldown = 1.25;
          u.attackAnimTimer = 0.65;
          if (targetShip) {
            targetShip.hp = Math.max(0, (targetShip.hp ?? 100) - def.attackDamage * 1.15);
            if (targetShip.type === 'warship') {
              u.hp = Math.max(0, u.hp - 18);
            }
          } else if (targetUnit && !targetUnit.statusEffects.shielded) {
            if (!targetUnit.statusEffects.shielded) {
              targetUnit.hp = Math.max(0, targetUnit.hp - def.attackDamage);
            }
            targetUnit.lastAttackerId = u.id;
            targetUnit.underAttackTimer = 8.0;
            if (targetUnit.hp <= 0) {
              targetUnit.state = 'ko';
              targetUnit.koTimer = 0.45;
              if (targetUnit.faction === 'hostile') state.totalRaidersDefeated += 1;
            }
            if (targetUnit.hp > 0 && (targetUnit.faction === 'civilization' || targetUnit.faction === 'hostile' || targetUnit.role === 'dragon')) {
              u.hp = Math.max(0, u.hp - (targetUnit.role === 'warrior' || targetUnit.isKing ? 14 : 8));
            }
          } else if (targetBld && targetBld.shieldTimer <= 0) {
            targetBld.hp = Math.max(0, targetBld.hp - def.attackDamage * 1.45);
          }

          addChronicle(
            state,
            `The enraged Leviathan (${u.name}) thrashes at the surface, unleashing surging rogue waves!`,
            'warning',
          );

          // Spawn a surging Rogue Wave when attacking!
          const waveHeading = Math.atan2(dz, dx);
          state.activeHazards.push({
            id: nextEntityId('haz'),
            kind: 'rogue_wave',
            x: u.x + Math.cos(waveHeading) * 1.4,
            z: u.z + Math.sin(waveHeading) * 1.4,
            windX: Math.cos(waveHeading),
            windZ: Math.sin(waveHeading),
            heading: waveHeading,
            radius: 3.4,
            remaining: 4.5,
            duration: 4.5,
            tickTimer: 0,
            sourceUnitId: u.id,
          });

          // Smash water walkways & bleach coral reefs around the Leviathan's jaws
          const hitRx = Math.round(tx);
          const hitRz = Math.round(tz);
          for (let oz = -1; oz <= 1; oz++) {
            for (let ox = -1; ox <= 1; ox++) {
              const wt = getTile(state, hitRx + ox, hitRz + oz);
              if (wt && wt.height === 0) {
                damageOrBleachWaterTile(wt, 180, true);
              }
            }
          }
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'hit_spark',
            x: tx,
            y: 0.25,
            z: tz,
            radius: 3.8,
            color: '#00bbf9',
            createdAt: Date.now(),
          });
        }
      } else {
        u.state = 'moving';
        const nx = Math.max(3, Math.min(gs - 4, u.x + (dx / dist) * moveSpeed * 1.25 * dt));
        const nz = Math.max(3, Math.min(gs - 4, u.z + (dz / dist) * moveSpeed * 1.25 * dt));
        const nt = getTile(state, Math.round(nx), Math.round(nz));
        if (nt && nt.height === 0) {
          damageOrBleachWaterTile(nt, 120, true);
          u.x = nx;
          u.z = nz;
        }
      }
      return;
    }

    // 4. RARELY DEVOUR DEEP-SEA ISLANDS (never islands in shallow seas!)
    if ((u.leviathanEatIslandCooldown ?? 0) <= 0) {
      let bestDeepIsland: TileData | null = null;
      let bestIslandDist = 20.0;
      const uxR = Math.round(u.x);
      const uzR = Math.round(u.z);
      for (let oz = -18; oz <= 18; oz += 2) {
        for (let ox = -18; ox <= 18; ox += 2) {
          const tx = uxR + ox;
          const tz = uzR + oz;
          if (tx < 4 || tx >= gs - 4 || tz < 4 || tz >= gs - 4) continue;
          const d = Math.hypot(ox, oz);
          if (d < bestIslandDist && isDeepSeaIslandTile(tx, tz)) {
            bestIslandDist = d;
            bestDeepIsland = getTile(state, tx, tz)!;
          }
        }
      }
      if (bestDeepIsland) {
        u.targetX = bestDeepIsland.x;
        u.targetZ = bestDeepIsland.z;
        const dxI = bestDeepIsland.x - u.x;
        const dzI = bestDeepIsland.z - u.z;
        const distI = Math.hypot(dxI, dzI);
        if (distI <= 4.2) {
          // Breach with gaping maw and devour the deep-sea island whole!
          u.leviathanSubmerged = false;
          u.leviathanSurfaceTimer = 5.0;
          u.leviathanEatIslandCooldown = 115.0; // Rare event (~2 minutes between island devours)
          u.attackAnimTimer = 0.85;
          u.attackTargetX = bestDeepIsland.x;
          u.attackTargetZ = bestDeepIsland.z;
          u.state = 'fighting';

          for (let oz = -2; oz <= 2; oz++) {
            for (let ox = -2; ox <= 2; ox++) {
              const it = getTile(state, bestDeepIsland.x + ox, bestDeepIsland.z + oz);
              if (it && it.height > 0 && isDeepSeaIslandTile(it.x, it.z)) {
                it.height = 0;
                it.terrain = 'deep_water';
                it.resourceNode = 'none';
                it.resourceAmount = 0;
                if (it.buildingId) {
                  const bld = state.buildings.find((b) => b.id === it.buildingId);
                  if (bld) bld.hp = 0;
                }
              }
            }
          }
          const eatHeading = Math.atan2(dzI, dxI);
          state.activeHazards.push({
            id: nextEntityId('haz'),
            kind: 'rogue_wave',
            x: bestDeepIsland.x,
            z: bestDeepIsland.z,
            windX: Math.cos(eatHeading),
            windZ: Math.sin(eatHeading),
            heading: eatHeading,
            radius: 3.8,
            remaining: 4.5,
            duration: 4.5,
            tickTimer: 0,
            sourceUnitId: u.id,
          });
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'tsunami',
            x: bestDeepIsland.x,
            y: 0.35,
            z: bestDeepIsland.z,
            radius: 5.0,
            color: '#00f5d4',
            createdAt: Date.now(),
          });
          addChronicle(state, 'A giant Leviathan surfaced from the deep and destroyed a small island!', 'warning');
          return;
        } else {
          u.state = 'moving';
          const nx = Math.max(3, Math.min(gs - 4, u.x + (dxI / distI) * moveSpeed * 1.15 * dt));
          const nz = Math.max(3, Math.min(gs - 4, u.z + (dzI / distI) * moveSpeed * 1.15 * dt));
          const nt = getTile(state, Math.round(nx), Math.round(nz));
          if (nt && nt.height === 0) {
            u.x = nx;
            u.z = nz;
            return;
          }
        }
      }
    }

    // 5. NO TARGET: Roam the open seas predominantly as a terrifying submerged silhouette (~16s submerged, ~4s surfaced)
    if (u.leviathanSurfaceTimer <= 0) {
      u.leviathanSubmerged = !u.leviathanSubmerged;
      u.leviathanSurfaceTimer = u.leviathanSubmerged ? 15 + ((u.appearanceSeed ?? 0) % 7) : 4.0 + ((u.appearanceSeed ?? 0) % 3);
    }

    const dxW = u.targetX - u.x;
    const dzW = u.targetZ - u.z;
    const distW = Math.hypot(dxW, dzW);
    if (u.actionCooldown <= 0 || distW <= 1.2) {
      u.actionCooldown = 3.2;
      for (let attempt = 0; attempt < 16; attempt++) {
        const wx = Math.max(4, Math.min(gs - 5, Math.round(u.x + (Math.random() - 0.5) * 26)));
        const wz = Math.max(4, Math.min(gs - 5, Math.round(u.z + (Math.random() - 0.5) * 26)));
        const wt = getTile(state, wx, wz);
        if (wt && wt.height === 0 && !wt.isLake && !wt.isRiver && !wt.buildingId) {
          u.targetX = wx;
          u.targetZ = wz;
          break;
        }
      }
    }
    const dxM = u.targetX - u.x;
    const dzM = u.targetZ - u.z;
    const distM = Math.hypot(dxM, dzM);
    if (distM > 0.5) {
      const nx = Math.max(3, Math.min(gs - 4, u.x + (dxM / distM) * moveSpeed * 0.85 * dt));
      const nz = Math.max(3, Math.min(gs - 4, u.z + (dzM / distM) * moveSpeed * 0.85 * dt));
      const nt = getTile(state, Math.round(nx), Math.round(nz));
      if (nt && nt.height === 0 && !nt.buildingId) {
        u.state = 'moving';
        u.x = nx;
        u.z = nz;
      } else {
        u.actionCooldown = 0;
        u.state = 'idle';
      }
    } else {
      u.state = 'idle';
    }
    return;
  }

  // Benevolent Mythical Auras (Unicorn, Phoenix, Kitsune, Pegasus, Treant, Fairy, Fae): heal/bless nearby friendly units and revive scorched ground / forests
  if (
    (u.role === 'unicorn' ||
      u.role === 'phoenix' ||
      u.role === 'kitsune' ||
      u.role === 'pegasus' ||
      u.role === 'ent' ||
      u.role === 'fairy' ||
      u.role === 'fae') &&
    (u.wildlifeSkillCooldown ?? 0) <= 0
  ) {
    let blessedAny = false;
    const auraR = u.role === 'phoenix' || u.role === 'pegasus' ? 5.6 : 4.55;
    const auraRSq = auraR * auraR;
    const blessUnit = (other: UnitEntity, dSq: number) => {
      if (other.id === u.id || other.state === 'ko' || dSq > auraRSq) return;
      const isFriendly =
        other.faction === 'civilization' ||
        (other.faction === 'wildlife' && isHerbivoreAnimal(other.role, other.appearanceSeed));
      if (!isFriendly) return;
      if (other.hp < other.maxHp || other.statusEffects.plagued || other.statusEffects.cursed) {
        other.hp = Math.min(other.maxHp, other.hp + (u.role === 'phoenix' ? 20 : 14));
        delete other.statusEffects.plagued;
        delete other.statusEffects.cursed;
        blessedAny = true;
      }
      if ((u.role === 'kitsune' || u.role === 'pegasus' || u.role === 'fairy') && !other.statusEffects.blessed && dSq <= 18) {
        other.statusEffects.blessed = 10;
        blessedAny = true;
      } else if (u.role === 'phoenix' && !other.statusEffects.shielded && other.hp < other.maxHp * 0.75) {
        other.statusEffects.shielded = 6;
        blessedAny = true;
      }
    };
    if (activeTickIndex) {
      forEachUnitInRadius(activeTickIndex, u.x, u.z, auraR + 0.05, blessUnit);
    } else {
      for (const other of state.units) {
        blessUnit(other, (other.x - u.x) ** 2 + (other.z - u.z) ** 2);
      }
    }
    if (u.role === 'unicorn' || u.role === 'phoenix' || u.role === 'ent' || u.role === 'fae') {
      const rx = Math.round(u.x);
      const rz = Math.round(u.z);
      let regrewTree = false;
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nt = getTile(state, rx + dx, rz + dz);
          if (!nt || nt.height <= 0 || nt.buildingId) continue;
          if (nt.terrain === 'scorched') {
            nt.terrain = u.role === 'ent' ? 'forest' : 'blossom';
            nt.onFireTimer = 0;
            blessedAny = true;
          } else if (
            u.role === 'ent' &&
            !regrewTree &&
            nt.resourceNode === 'none' &&
            nt.onFireTimer <= 0 &&
            (nt.terrain === 'forest' || nt.terrain === 'grass' || nt.terrain === 'fertile')
          ) {
            nt.terrain = 'forest';
            nt.resourceNode = 'timber_grove';
            nt.resourceAmount = 100;
            nt.burntTree = false;
            regrewTree = true;
            blessedAny = true;
          }
        }
      }
    }
    u.wildlifeSkillCooldown = blessedAny ? 3.8 : 1.6;
  }

  // Thunderbird Localized Rainstorm: extinguishes fires and hydrates scorched/dry ground beneath its flight path
  if (u.role === 'thunderbird' && (u.wildlifeSkillCooldown ?? 0) <= 0) {
    const rx = Math.round(u.x);
    const rz = Math.round(u.z);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dz * dz > 5) continue;
        const nt = getTile(state, rx + dx, rz + dz);
        if (!nt || nt.height <= 0) continue;
        if (nt.onFireTimer > 0) {
          nt.onFireTimer = 0;
        }
        if (!nt.buildingId) {
          if (nt.terrain === 'scorched') {
            nt.terrain = 'grass';
          } else if (nt.terrain === 'grass' && Math.random() < 0.06) {
            nt.terrain = 'fertile';
          }
        }
      }
    }
    u.wildlifeSkillCooldown = 1.2;
  }

  const isFrenzied = Boolean(u.statusEffects.frenzied);
  const isHerbivore = isHerbivoreAnimal(u.role, u.appearanceSeed);

  // Herbivore behavior: ONLY flee carnivores/hostiles and eat plants (never attack units or smash buildings/rocks unless frenzied!)
  if (isHerbivore && !isFrenzied) {
    let foundThreat: UnitEntity | null = null;
    const fleeRadius = u.role === 'dinosaur' ? 6.5 : 5.0;
    let bestThreatDistSq = fleeRadius * fleeRadius;
    const checkThreat = (other: UnitEntity, dSq: number) => {
      if (other.id === u.id || other.state === 'ko' || dSq >= bestThreatDistSq) return;
      if (
        other.faction === 'hostile' ||
        other.role === 'dragon' ||
        isCarnivoreAnimal(other.role, other.appearanceSeed) ||
        Boolean(other.statusEffects.frenzied)
      ) {
        bestThreatDistSq = dSq;
        foundThreat = other;
      }
    };
    const wildlifeTick = simTickCounterByState.get(state) ?? 0;
    const runPreyThreatScan = (u.underAttackTimer ?? 0) > 0 || ((wildlifeTick + (u.appearanceSeed ?? 0)) % 3) === 0;
    if (runPreyThreatScan) {
      if (activeTickIndex) {
        forEachUnitInRadius(activeTickIndex, u.x, u.z, fleeRadius + 0.05, checkThreat);
      } else {
        for (const other of state.units) {
          checkThreat(other, (other.x - u.x) ** 2 + (other.z - u.z) ** 2);
        }
      }
    }
    const threat = foundThreat as UnitEntity | null;
    if (threat) {
      const baseAngle = Math.atan2(u.z - threat.z, u.x - threat.x);
      const fleeBurst = u.role === 'dinosaur' ? 1.38 : 1.45;
      const stepDist = moveSpeed * fleeBurst * dt;
      let moved = false;
      for (const offset of [0, 0.55, -0.55, 1.15, -1.15, 1.8, -1.8, 2.4, -2.4]) {
        const ang = baseAngle + offset;
        const dirX = Math.cos(ang);
        const dirZ = Math.sin(ang);
        const fx = Math.max(2, Math.min(gs - 3, u.x + dirX * 5.0));
        const fz = Math.max(2, Math.min(gs - 3, u.z + dirZ * 5.0));
        const nextX = u.x + dirX * stepDist;
        const nextZ = u.z + dirZ * stepDist;
        const nextTile = getTile(state, nextX, nextZ);
        if (nextTile && nextTile.height > 0 && nextTile.onFireTimer <= 0) {
          u.targetX = fx;
          u.targetZ = fz;
          u.state = 'moving';
          u.x = Math.max(1, Math.min(gs - 2, nextX));
          u.z = Math.max(1, Math.min(gs - 2, nextZ));
          moved = true;
          break;
        }
      }
      if (!moved) {
        u.state = 'moving';
      }
      return;
    }

    // Herbivore plant-foraging: seek berry bushes (and trees for herbivore dinosaurs & giraffes) to eat
    const canEatTrees = u.role === 'dinosaur' || u.role === 'giraffe';
    const plantSearchRange = canEatTrees ? 9 : 7;
    const plantRangeSq = plantSearchRange * plantSearchRange;
    let bestPlantTile: TileData | null = null;

    // Fast path: reuse current target tile if it is still a valid plant within foraging range
    const curTarget = getTile(state, Math.round(u.targetX), Math.round(u.targetZ));
    if (
      curTarget &&
      curTarget.height > 0 &&
      !curTarget.buildingId &&
      curTarget.onFireTimer <= 0 &&
      curTarget.cursedTimer <= 0 &&
      curTarget.resourceAmount > 0 &&
      (curTarget.resourceNode === 'berry_bush' || (canEatTrees && curTarget.resourceNode === 'timber_grove'))
    ) {
      const cdSq = (curTarget.x - u.x) ** 2 + (curTarget.z - u.z) ** 2;
      if (cdSq <= plantRangeSq) {
        bestPlantTile = curTarget;
      }
    }

    if (!bestPlantTile && u.actionCooldown <= 0) {
      const ux = Math.round(u.x);
      const uz = Math.round(u.z);
      const minX = Math.max(1, ux - plantSearchRange);
      const maxX = Math.min(gs - 2, ux + plantSearchRange);
      const minZ = Math.max(1, uz - plantSearchRange);
      const maxZ = Math.min(gs - 2, uz + plantSearchRange);
      let bestPlantScore = Infinity;

      for (let tz = minZ; tz <= maxZ; tz++) {
        const rowOffset = tz * gs;
        for (let tx = minX; tx <= maxX; tx++) {
          const tile = state.tiles[rowOffset + tx];
          if (!tile || tile.height <= 0 || tile.buildingId || tile.onFireTimer > 0 || tile.cursedTimer > 0) {
            continue;
          }
          const isBerry = tile.resourceNode === 'berry_bush' && tile.resourceAmount > 0;
          const isTree = canEatTrees && tile.resourceNode === 'timber_grove' && tile.resourceAmount > 0;
          if (!isBerry && !isTree) continue;
          const dSq = (tx - u.x) ** 2 + (tz - u.z) ** 2;
          if (dSq > plantRangeSq) continue;
          const penalty = isBerry ? 0 : 1.2;
          if (bestPlantScore < Infinity) {
            const maxDist = bestPlantScore - penalty;
            if (maxDist <= 0 || dSq >= maxDist * maxDist) continue;
          }
          const score = Math.sqrt(dSq) + penalty;
          if (score < bestPlantScore) {
            bestPlantScore = score;
            bestPlantTile = tile;
          }
        }
      }

      if (!bestPlantTile) {
        u.actionCooldown = 1.2 + ((u.appearanceSeed ?? 0) & 3) * 0.15;
      }
    }

    if (bestPlantTile) {
      const dist = Math.hypot(bestPlantTile.x - u.x, bestPlantTile.z - u.z);
      const eatRange = canEatTrees ? 1.55 : 1.25;
      const isTreeTarget = canEatTrees && bestPlantTile.resourceNode === 'timber_grove';
      const canTreeHeadbuttRush = isTreeTarget && (u.wildlifeSkillCooldown ?? 0) <= 0;
      u.targetX = bestPlantTile.x;
      u.targetZ = bestPlantTile.z;
      if (dist <= eatRange) {
        u.state = 'gathering';
        if (u.actionCooldown <= 0) {
          const usedHeadbuttSkill = canTreeHeadbuttRush;
          const eatAmt = usedHeadbuttSkill ? 65 : canEatTrees ? 45 : 24;
          bestPlantTile.resourceAmount = Math.max(0, bestPlantTile.resourceAmount - eatAmt);
          if (bestPlantTile.resourceAmount <= 0) {
            bestPlantTile.resourceNode = 'none';
          }
          u.hp = Math.min(u.maxHp, u.hp + (canEatTrees ? 14 : 6));
          u.actionCooldown = canEatTrees ? 1.8 : 2.1;
          u.attackAnimTimer = usedHeadbuttSkill ? 0.52 : 0.42;
          u.attackTargetX = bestPlantTile.x;
          u.attackTargetZ = bestPlantTile.z;
          u.dinoRushTimer = 0;
          if (usedHeadbuttSkill) {
            u.wildlifeSkillCooldown = 5.5;
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'animal_attack',
              variant: 'crunch',
              originX: u.x,
              originZ: u.z,
              x: bestPlantTile.x,
              y: 0,
              z: bestPlantTile.z,
              radius: 1.8,
              color: '#84cc16',
              createdAt: Date.now(),
            });
          }
        }
      } else {
        u.state = 'moving';
        if (canTreeHeadbuttRush && dist <= 5.5) {
          u.dinoRushTimer = Math.max(u.dinoRushTimer ?? 0, 0.35);
        }
        const isRushingTree = (u.dinoRushTimer ?? 0) > 0;
        const grazeSpeed = moveSpeed * (isRushingTree ? 1.72 : canEatTrees ? 0.88 : 0.8);
        const nx = u.x + ((bestPlantTile.x - u.x) / dist) * grazeSpeed * dt;
        const nz = u.z + ((bestPlantTile.z - u.z) / dist) * grazeSpeed * dt;
        const nt = getTile(state, nx, nz);
        if (nt && nt.height > 0 && nt.onFireTimer <= 0) {
          u.x = Math.max(1, Math.min(gs - 2, nx));
          u.z = Math.max(1, Math.min(gs - 2, nz));
        }
      }
      return;
    }

    // Gentle passive grazing recovery when resting on lush plant biomes
    if (curTile && tileIsPlantGrazeGround(curTile, canEatTrees) && u.hp < u.maxHp) {
      u.hp = Math.min(u.maxHp, u.hp + 1.5 * dt);
    }
  }

  const emitDragonBreathAt = (
    targetX: number,
    targetZ: number,
    dmg: number,
    options?: {
      unitTarget?: UnitEntity;
      buildingTarget?: BuildingEntity;
      isEnvAttack?: boolean;
      cooldownOverride?: number;
    },
  ) => {
    const dragonGlowHex = getDragonVariant(u.appearanceSeed).glowHex;
    const defaultBreathCd = isFrenzied ? 3.2 : 4.6;
    const breathCd = options?.cooldownOverride ?? defaultBreathCd;
    u.dragonBreathCooldown = breathCd;
    u.actionCooldown = Math.max(u.actionCooldown, breathCd);
    u.attackAnimTimer = 0.85;
    u.attackTargetX = targetX;
    u.attackTargetZ = targetZ;

    if (options?.unitTarget) {
      options.unitTarget.hp -= dmg;
      options.unitTarget.lastAttackerId = u.id;
      options.unitTarget.underAttackTimer = 8.0;
    }
    if (options?.buildingTarget && options.buildingTarget.shieldTimer <= 0) {
      options.buildingTarget.hp = Math.max(0, options.buildingTarget.hp - dmg * 0.85);
      const sName =
        (options.buildingTarget.settlementId && state.settlementNames?.[options.buildingTarget.settlementId]) ||
        'a settlement';
      addChronicle(state, `Dragon ${u.name} strafes ${sName} with scorching dragonfire!`, 'warning');
    }

    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'dragon_fire_breath',
      variant: 'fire_breath',
      sourceUnitId: u.id,
      originX: u.x,
      originZ: u.z,
      x: targetX,
      y: 0,
      z: targetZ,
      radius: 2.0,
      color: dragonGlowHex,
      createdAt: Date.now(),
    });

    // Fire breath splashes heat onto adjacent foes & buildings
    for (const splashTarget of state.units) {
      if (
        splashTarget.id !== options?.unitTarget?.id &&
        splashTarget.id !== u.id &&
        splashTarget.state !== 'ko' &&
        !splashTarget.statusEffects.shielded &&
        splashTarget.role !== 'dragon' &&
        (splashTarget.faction !== 'civilization' || Boolean(options?.buildingTarget) || isFrenzied)
      ) {
        const sdSq = (splashTarget.x - targetX) ** 2 + (splashTarget.z - targetZ) ** 2;
        if (sdSq <= 2.56) {
          splashTarget.hp -= dmg * 0.35;
          splashTarget.lastAttackerId = u.id;
          splashTarget.underAttackTimer = 8.0;
        }
      }
    }
    for (const sb of state.buildings) {
      if (sb.id !== options?.buildingTarget?.id && sb.hp > 0 && sb.shieldTimer <= 0) {
        const bdSq = (sb.tileX - targetX) ** 2 + (sb.tileZ - targetZ) ** 2;
        if (bdSq <= 2.25) {
          sb.hp = Math.max(0, sb.hp - dmg * 0.3);
        }
      }
    }
    if (state.vehicles) {
      for (const sv of state.vehicles) {
        if ((sv.hp ?? 100) <= 0) continue;
        const vdSq = (sv.x - targetX) ** 2 + (sv.z - targetZ) ** 2;
        if (vdSq <= 3.24) {
          sv.hp = Math.max(0, (sv.hp ?? 100) - dmg * 0.65);
        }
      }
    }

    // Scorch & ignite the struck tile and adjacent dry vegetation in the dragon's fire color
    const igniteTile = (tile: TileData | undefined, directHit: boolean) => {
      if (!tile) return;
      if (tile.height <= 0) {
        damageOrBleachWaterTile(tile, directHit ? 260 : 140, directHit);
        return;
      }
      if (tile.terrain === 'rock' || tile.terrain === 'snow') return;
      if (tile.buildingId && !options?.buildingTarget) return;
      if (!tile.buildingId && tile.blessedTimer > 0 && !directHit) return;

      tile.onFireTimer = Math.max(tile.onFireTimer, directHit ? 5.5 : 4.2);
      tile.fireColor = dragonGlowHex;

      if (!tile.buildingId) {
        if (tile.resourceNode === 'timber_grove' || tile.resourceNode === 'berry_bush') {
          if (tile.resourceNode === 'timber_grove') {
            preserveTreeBiomeBeforeScorch(tile);
          }
          tile.resourceAmount = Math.max(0, tile.resourceAmount - (directHit ? 140 : 55));
          if (tile.resourceNode === 'timber_grove') {
            tile.burntTree = true;
            if (isFlammableVegetationTerrain(tile.terrain)) {
              tile.terrain = 'scorched';
              tile.farmSettlementId = undefined;
            }
          }
          if (tile.resourceAmount <= 0) {
            tile.resourceNode = 'none';
            tile.terrain = 'scorched';
            tile.farmSettlementId = undefined;
          }
        } else if (tile.resourceNode === 'stone_outcrop' || tile.resourceNode === 'crystal_monolith') {
          if (directHit) {
            tile.resourceAmount = Math.max(0, tile.resourceAmount - 95);
            if (tile.resourceAmount <= 0) {
              tile.resourceNode = 'none';
              tile.terrain = 'scorched';
            }
          }
        } else if (directHit && isFlammableVegetationTerrain(tile.terrain)) {
          tile.terrain = 'scorched';
          tile.farmSettlementId = undefined;
        }
      }
    };

    const tTile = getTile(state, targetX, targetZ);
    igniteTile(tTile, true);
    if (tTile && state.worldRules?.wildfireSpread !== false) {
      let spreadCount = 0;
      for (const [ox, oz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (spreadCount >= 2) break;
        const nb = getTile(state, tTile.x + ox, tTile.z + oz);
        if (
          nb &&
          nb.height > 0 &&
          !nb.buildingId &&
          nb.onFireTimer <= 0 &&
          (nb.resourceNode === 'timber_grove' ||
            nb.resourceNode === 'berry_bush' ||
            nb.terrain === 'forest' ||
            nb.terrain === 'jungle' ||
            nb.terrain === 'taiga' ||
            nb.terrain === 'blossom' ||
            nb.terrain === 'savanna' ||
            nb.terrain === 'fertile' ||
            nb.terrain === 'grass')
        ) {
          igniteTile(nb, false);
          spreadCount++;
        }
      }
    }
  };

  if (u.role === 'dragon') {
    if (u.dragonRunDirX === undefined || u.dragonRunDirZ === undefined) {
      const dx = u.targetX - u.x;
      const dz = u.targetZ - u.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        u.dragonRunDirX = dx / d;
        u.dragonRunDirZ = dz / d;
      } else {
        const seedAng = ((u.appearanceSeed ?? 1) % 360) * (Math.PI / 180);
        u.dragonRunDirX = Math.cos(seedAng);
        u.dragonRunDirZ = Math.sin(seedAng);
      }
    }
  }

  const steerDragonToward = (
    goalX: number,
    goalZ: number,
    maxTurnRate: number,
    lockTurnSign?: number,
  ): { dirX: number; dirZ: number; angleDiff: number } => {
    const curDirX = u.dragonRunDirX ?? 1;
    const curDirZ = u.dragonRunDirZ ?? 0;
    const curAngle = Math.atan2(curDirZ, curDirX);
    const dx = goalX - u.x;
    const dz = goalZ - u.z;
    if (dx * dx + dz * dz < 1e-4) {
      return { dirX: curDirX, dirZ: curDirZ, angleDiff: 0 };
    }
    const desiredAngle = Math.atan2(dz, dx);
    const diff = Math.atan2(Math.sin(desiredAngle - curAngle), Math.cos(desiredAngle - curAngle));
    const maxStep = maxTurnRate * dt;
    const turnDir =
      lockTurnSign !== undefined && Math.abs(diff) > 1.85
        ? lockTurnSign
        : Math.sign(diff) || 1;
    const step = Math.abs(diff) <= maxStep ? diff : turnDir * maxStep;
    const nextAngle = curAngle + step;
    const nextDirX = Math.cos(nextAngle);
    const nextDirZ = Math.sin(nextAngle);
    u.dragonRunDirX = nextDirX;
    u.dragonRunDirZ = nextDirZ;
    const remDiff = Math.atan2(Math.sin(desiredAngle - nextAngle), Math.cos(desiredAngle - nextAngle));
    return { dirX: nextDirX, dirZ: nextDirZ, angleDiff: remDiff };
  };

  const isPredator = isPredatorRole(u.role, u.appearanceSeed);
  const allowAnimalAttacks = state.worldRules?.animalAttacks !== false;

  // Predators (Carnivores + Dragons), Unicorns & Frenzied Animals combat / hunting (obeys God Rule animalAttacks unless Frenzied)
  if ((allowAnimalAttacks && (isPredator || u.role === 'unicorn')) || isFrenzied) {
    const isCarnivoreDino = u.role === 'dinosaur' && isCarnivoreAnimal(u.role, u.appearanceSeed);
    let target: UnitEntity | null = null;
    let bestScore = Infinity;

    const predScanR =
      u.role === 'dragon' || u.role === 'thunderbird'
        ? 16.05
        : u.role === 'phoenix' || u.role === 'griffin' || u.role === 'pegasus' || u.role === 'cerberus' || u.role === 'manticore' || u.role === 'kraken'
          ? 12.05
          : isCarnivoreDino || isFrenzied || u.role === 'lion' || u.role === 'tiger' || u.role === 'polar_bear' || u.role === 'hydra' || u.role === 'minotaur' || u.role === 'basilisk'
            ? 11.05
            : u.role === 'wolf' || u.role === 'yeti' || u.role === 'golem' || u.role === 'kitsune' || u.role === 'ent' || u.role === 'gargoyle'
              ? 10.05
              : u.role === 'bear' || u.role === 'fox' || u.role === 'rhino' || u.role === 'hippo' || u.role === 'gorilla' || u.role === 'moose' || u.role === 'bison'
                ? 9.05
                : u.role === 'crocodile' || u.role === 'boar'
                  ? 7.05
                  : 5.05;
    const isRetaliationTarget = (other: UnitEntity) =>
      Boolean(u.lastAttackerId && other.id === u.lastAttackerId && (u.underAttackTimer ?? 0) > 0);
    const evaluatePredTarget = (other: UnitEntity, dSq: number) => {
      if (other.id === u.id || other.state === 'ko' || other.statusEffects.shielded) return;
      // Immediate self-defense: Kitsune (and any mythical/territorial unit) fires back at whoever attacked it!
      if (isRetaliationTarget(other) && dSq <= predScanR * predScanR) {
        const retScore = Math.max(0, dSq - 36);
        if (retScore < bestScore) {
          bestScore = retScore;
          target = other;
        }
        return;
      }
      if (other.faction === 'hostile') {
        const maxSq =
          u.role === 'dragon' || u.role === 'thunderbird'
            ? 256
            : u.role === 'phoenix' || u.role === 'griffin' || u.role === 'cerberus' || u.role === 'pegasus' || u.role === 'manticore' || u.role === 'kraken'
              ? 144
              : u.role === 'unicorn'
                ? 25
                : u.role === 'ent' && u.treantDisguised
                  ? 36
                  : u.role === 'gargoyle' && u.gargoylePetrified
                    ? 72
                    : isCarnivoreDino || u.role === 'golem' || u.role === 'yeti' || u.role === 'hydra' || u.role === 'minotaur' || u.role === 'ent' || u.role === 'basilisk' || u.role === 'gargoyle'
                      ? 121
                      : 100;
        if (dSq <= maxSq && dSq < bestScore) {
          bestScore = dSq;
          target = other;
        }
      } else if (isFrenzied && other.role !== u.role) {
        if (dSq <= 121 && dSq + 6 < bestScore) {
          bestScore = dSq + 6;
          target = other;
        }
      } else if (
        u.role === 'dragon' &&
        (other.role === 'dinosaur' || other.role === 'bear' || other.role === 'wolf' || other.role === 'lion' || other.role === 'tiger' || other.role === 'polar_bear')
      ) {
        if (dSq <= 100 && dSq + 10 < bestScore) {
          bestScore = dSq + 10;
          target = other;
        }
      } else if (u.role === 'phoenix' || u.role === 'kitsune' || u.role === 'golem' || u.role === 'pegasus' || u.role === 'ent' || u.role === 'thunderbird' || u.role === 'gargoyle') {
        // Guardians & Kitsune self-defense: strike back at predators/dangerous beasts approaching too close
        const threatPred =
          isCarnivoreAnimal(other.role, other.appearanceSeed) || other.role === 'dragon';
        const defenseSq =
          u.role === 'ent' && u.treantDisguised
            ? 30
            : u.role === 'kitsune' || u.role === 'thunderbird'
              ? 64
              : 49;
        if (threatPred && other.role !== u.role && dSq <= defenseSq) {
          if (dSq + 8 < bestScore) {
            bestScore = dSq + 8;
            target = other;
          }
        }
      } else if (u.role === 'cerberus' || u.role === 'minotaur' || u.role === 'hydra' || u.role === 'basilisk' || u.role === 'manticore' || u.role === 'kraken') {
        if ((isPreyAnimalRole(other.role) || other.role === 'wolf' || other.role === 'bear' || other.role === 'lion' || other.role === 'tiger' || other.role === 'boar') && dSq <= 100) {
          if (dSq + 5 < bestScore) {
            bestScore = dSq + 5;
            target = other;
          }
        } else if (other.faction === 'civilization' && dSq <= (u.role === 'kraken' ? 49 : 25)) {
          if (dSq + 10 < bestScore) {
            bestScore = dSq + 10;
            target = other;
          }
        }
      } else if (u.role === 'griffin') {
        if ((isPreyAnimalRole(other.role) || other.role === 'wolf' || other.role === 'fox' || other.role === 'boar') && dSq <= 121) {
          const bias = other.role === 'sheep' || other.role === 'rabbit' || other.role === 'deer' || other.role === 'goat' ? 3 : 7;
          if (dSq + bias < bestScore) {
            bestScore = dSq + bias;
            target = other;
          }
        }
      } else if (u.role === 'yeti') {
        // Yeti fiercely guards frozen peaks against predators & trespassers (throwing blocky ice balls from range!)
        if ((other.role === 'wolf' || other.role === 'bear' || other.role === 'polar_bear' || isPreyAnimalRole(other.role)) && dSq <= 100) {
          if (dSq + 6 < bestScore) {
            bestScore = dSq + 6;
            target = other;
          }
        } else if (other.faction === 'civilization' && dSq <= 30) {
          if (dSq + 10 < bestScore) {
            bestScore = dSq + 10;
            target = other;
          }
        }
      } else if (isCarnivoreDino) {
        if (isHerbivoreAnimal(other.role, other.appearanceSeed) && dSq <= 121) {
          const herbBias = other.role === 'dinosaur' ? 4 : 6;
          if (dSq + herbBias < bestScore) {
            bestScore = dSq + herbBias;
            target = other;
          }
        } else if ((other.role === 'wolf' || other.role === 'bear' || other.role === 'lion' || other.role === 'tiger' || other.role === 'polar_bear') && dSq <= 100) {
          if (dSq + 9 < bestScore) {
            bestScore = dSq + 9;
            target = other;
          }
        } else if (other.faction === 'civilization' && dSq <= 36) {
          if (dSq + 14 < bestScore) {
            bestScore = dSq + 14;
            target = other;
          }
        }
      } else if (u.role === 'fox') {
        if ((other.role === 'rabbit' || other.role === 'chicken' || other.role === 'frog') && dSq <= 81) {
          if (dSq + 2 < bestScore) {
            bestScore = dSq + 2;
            target = other;
          }
        }
      } else if (u.role === 'boar' || u.role === 'hippo' || u.role === 'rhino' || u.role === 'gorilla' || u.role === 'moose' || u.role === 'bison') {
        // Territorial bruisers charge predators & close intruders
        const radSq = u.role === 'boar' ? 36 : 49;
        if ((other.role === 'wolf' || other.role === 'fox' || other.role === 'lion' || other.role === 'tiger' || other.role === 'crocodile') && dSq <= radSq) {
          if (dSq + 5 < bestScore) {
            bestScore = dSq + 5;
            target = other;
          }
        } else if (u.role !== 'boar' && other.faction === 'civilization' && dSq <= 9) {
          if (dSq + 12 < bestScore) {
            bestScore = dSq + 12;
            target = other;
          }
        }
      } else if (u.role === 'lion' || u.role === 'tiger' || u.role === 'polar_bear') {
        if ((isPreyAnimalRole(other.role) || other.role === 'boar' || other.role === 'wolf') && dSq <= 110) {
          const preyBias =
            u.role === 'polar_bear'
              ? other.role === 'penguin' || other.role === 'seal' || other.role === 'rabbit' || other.role === 'deer'
                ? 2
                : 6
              : u.role === 'tiger'
                ? other.role === 'deer' || other.role === 'monkey' || other.role === 'pig'
                  ? 2
                  : 6
                : other.role === 'zebra' || other.role === 'giraffe' || other.role === 'deer' || other.role === 'sheep' || other.role === 'camel' || other.role === 'horse'
                  ? 3
                  : 6;
          if (dSq + preyBias < bestScore) {
            bestScore = dSq + preyBias;
            target = other;
          }
        } else if (other.faction === 'civilization' && dSq <= 9) {
          if (dSq + 14 < bestScore) {
            bestScore = dSq + 14;
            target = other;
          }
        }
      } else if (u.role === 'crocodile') {
        if ((isPreyAnimalRole(other.role) || other.role === 'boar' || other.role === 'fox') && dSq <= 49) {
          if (dSq + 3 < bestScore) {
            bestScore = dSq + 3;
            target = other;
          }
        } else if (other.faction === 'civilization' && dSq <= 6.25) {
          if (dSq + 10 < bestScore) {
            bestScore = dSq + 10;
            target = other;
          }
        }
      } else if (u.role === 'wolf' || u.role === 'giant_spider') {
        if (isPreyAnimalRole(other.role) && dSq <= 100) {
          const preyBias =
            other.role === 'chicken' || other.role === 'rabbit' || other.role === 'frog'
              ? 2
              : other.role === 'sheep' || other.role === 'deer' || other.role === 'pig' || other.role === 'capybara' || other.role === 'goat' || other.role === 'kangaroo'
                ? 4
                : 7;
          if (dSq + preyBias < bestScore) {
            bestScore = dSq + preyBias;
            target = other;
          }
        } else if (other.faction === 'civilization' && dSq <= (u.role === 'giant_spider' ? 16 : 5.5)) {
          if (dSq + 12 < bestScore) {
            bestScore = dSq + 12;
            target = other;
          }
        }
      } else if (u.role === 'bear') {
        if ((isPreyAnimalRole(other.role) || other.role === 'wolf' || other.role === 'fox' || other.role === 'boar') && dSq <= 81) {
          const bearBias = other.role === 'wolf' ? 8 : 5;
          if (dSq + bearBias < bestScore) {
            bestScore = dSq + bearBias;
            target = other;
          }
        } else if (other.faction === 'civilization' && dSq <= 6.25) {
          if (dSq + 14 < bestScore) {
            bestScore = dSq + 14;
            target = other;
          }
        }
      }
    };
    const predTick = simTickCounterByState.get(state) ?? 0;
    if (activeTickIndex && u.targetEntityId) {
      const cachedTarget = activeTickIndex.unitsById.get(u.targetEntityId);
      if (cachedTarget && cachedTarget.state !== 'ko' && cachedTarget.hp > 0) {
        const cdSq = (cachedTarget.x - u.x) ** 2 + (cachedTarget.z - u.z) ** 2;
        if (cdSq <= predScanR * predScanR) {
          evaluatePredTarget(cachedTarget, cdSq);
        }
      }
    }
    const runPredScan = !target && (((predTick + (u.appearanceSeed ?? 0)) & 1) === 0 || (u.underAttackTimer ?? 0) > 0);
    if (runPredScan) {
      if (activeTickIndex) {
        forEachUnitInRadius(activeTickIndex, u.x, u.z, predScanR, evaluatePredTarget);
      } else {
        for (const other of state.units) {
          evaluatePredTarget(other, (other.x - u.x) ** 2 + (other.z - u.z) ** 2);
        }
      }
    }
    target = target as UnitEntity | null;
    if (target) u.targetEntityId = target.id;

    // Environmental rampage: Dragons remain unchanged (torch everything);
    // Carnivore dinosaurs smash buildings, trees, bushes & boulders; Bears smash trees, bushes & nearby structures; Frenzied beasts smash surroundings.
    type EnvTarget =
      | { kind: 'building'; building: BuildingEntity; x: number; z: number; score: number }
      | { kind: 'tile'; tile: TileData; x: number; z: number; score: number };
    let envTarget: EnvTarget | null = null;

    const canAttackEnv =
      !target &&
      (u.role === 'dragon' ||
        isFrenzied ||
        ((isCarnivoreDino || u.role === 'bear') &&
          u.actionCooldown <= 0.35 &&
          (u.wildlifeSkillCooldown ?? 0) <= 0));

    if (canAttackEnv) {
      const envRange = u.role === 'dragon' ? 12 : isFrenzied ? 7 : 5;
      const envRangeSq = envRange * envRange;

      if (u.role === 'dragon' || isCarnivoreDino || isFrenzied) {
        for (const b of state.buildings) {
          if (b.hp <= 0 || b.shieldTimer > 0) continue;
          const dSq = (b.tileX - u.x) ** 2 + (b.tileZ - u.z) ** 2;
          if (dSq <= envRangeSq) {
            const score = Math.sqrt(dSq) + (u.role === 'dragon' ? 0.8 : 1.5);
            if (!envTarget || score < envTarget.score) {
              envTarget = { kind: 'building', building: b, x: b.tileX, z: b.tileZ, score };
            }
          }
        }
      }

      const ux = Math.round(u.x);
      const uz = Math.round(u.z);
      const minX = Math.max(1, ux - envRange);
      const maxX = Math.min(gs - 2, ux + envRange);
      const minZ = Math.max(1, uz - envRange);
      const maxZ = Math.min(gs - 2, uz + envRange);
      const seedBias = (u.appearanceSeed ?? 1) & 7;

      for (let tz = minZ; tz <= maxZ; tz++) {
        for (let tx = minX; tx <= maxX; tx++) {
          const tile = state.tiles[tz * gs + tx];
          if (!tile || tile.height <= 0 || tile.buildingId || tile.onFireTimer > 0 || tile.blessedTimer > 0) {
            continue;
          }
          const dSq = (tx - u.x) ** 2 + (tz - u.z) ** 2;
          if (dSq > envRangeSq) continue;

          const hasDestructibleProp =
            tile.resourceNode === 'timber_grove' ||
            tile.resourceNode === 'berry_bush' ||
            ((u.role === 'dragon' || isCarnivoreDino) &&
              (tile.resourceNode === 'stone_outcrop' || tile.resourceNode === 'crystal_monolith'));
          const isFlammableBiome =
            u.role === 'dragon' &&
            (tile.terrain === 'forest' ||
              tile.terrain === 'jungle' ||
              tile.terrain === 'taiga' ||
              tile.terrain === 'blossom' ||
              tile.terrain === 'savanna' ||
              tile.terrain === 'fertile' ||
              tile.terrain === 'grass');

          if (!hasDestructibleProp && !isFlammableBiome) continue;
          const jitter = (((tx * 13 + tz * 7 + seedBias) & 7) / 7) * 0.45;
          const score = Math.sqrt(dSq) + (hasDestructibleProp ? 0.4 : 4.2) + jitter;
          if (!envTarget || score < envTarget.score) {
            envTarget = { kind: 'tile', tile, x: tx, z: tz, score };
          }
        }
      }
    }

    // Specialized 3-phase Dragon Gliding Breath-Run & Banking Orbit AI (gated by breath cooldown)
    if (
      u.role === 'dragon' &&
      (target || envTarget || u.dragonRunPhase === 'strafe' || u.dragonRunPhase === 'turn')
    ) {
      const dmg = def.attackDamage * (isFrenzied ? 1.65 : 1.0);
      const canBreathe = (u.dragonBreathCooldown ?? 0) <= 0 && u.actionCooldown <= 0;
      const hasLiveGoal = Boolean(target || envTarget);
      const goalX = target ? target.x : envTarget ? envTarget.x : (u.dragonAnchorX ?? u.x);
      const goalZ = target ? target.z : envTarget ? envTarget.z : (u.dragonAnchorZ ?? u.z);
      const distToGoal = Math.hypot(goalX - u.x, goalZ - u.z);

      // First-time engagement when spawning directly in attack range with breath ready: begin strafe immediately
      if (u.dragonRunPhase === undefined && hasLiveGoal && distToGoal <= def.attackRange && canBreathe) {
        if (distToGoal > 0.05) {
          u.dragonRunDirX = (goalX - u.x) / distToGoal;
          u.dragonRunDirZ = (goalZ - u.z) / distToGoal;
        }
        u.dragonRunPhase = 'strafe';
        u.dragonRunTimer = 0.95;
        u.dragonAnchorX = goalX;
        u.dragonAnchorZ = goalZ;
      } else if (u.dragonRunPhase === undefined) {
        u.dragonRunPhase = 'approach';
        u.dragonAnchorX = goalX;
        u.dragonAnchorZ = goalZ;
      }

      if (u.dragonRunPhase === 'strafe') {
        u.dragonRunTimer = Math.max(0, (u.dragonRunTimer ?? 0.95) - dt);
        let dirX = u.dragonRunDirX ?? 1;
        let dirZ = u.dragonRunDirZ ?? 0;

        // Subtle forward course trim if tracking a moving unit ahead of the dragon
        if (target) {
          const toTx = target.x - u.x;
          const toTz = target.z - u.z;
          const toDist = Math.hypot(toTx, toTz);
          if (toDist > 0.4 && (toTx * dirX + toTz * dirZ) / toDist > 0.35) {
            const steered = steerDragonToward(target.x, target.z, 0.95);
            dirX = steered.dirX;
            dirZ = steered.dirZ;
          }
          u.dragonAnchorX = target.x;
          u.dragonAnchorZ = target.z;
        } else if (envTarget?.kind === 'building') {
          u.dragonAnchorX = envTarget.x;
          u.dragonAnchorZ = envTarget.z;
        }

        // Glide smoothly forward through the target zone while firing a single decisive breath burst
        const glideSpeed = moveSpeed * 1.18;
        u.x = Math.max(2, Math.min(gs - 3, u.x + dirX * glideSpeed * dt));
        u.z = Math.max(2, Math.min(gs - 3, u.z + dirZ * glideSpeed * dt));
        u.state = 'moving';
        u.targetX = u.x + dirX * 6.0;
        u.targetZ = u.z + dirZ * 6.0;
        u.attackAnimTimer = Math.max(u.attackAnimTimer ?? 0, 0.45);
        u.attackTargetX = u.x + dirX * 2.4;
        u.attackTargetZ = u.z + dirZ * 2.4;

        if ((u.dragonBreathCooldown ?? 0) <= 0 && u.actionCooldown <= 0) {
          const forwardCheckX = u.x + dirX * 1.8;
          const forwardCheckZ = u.z + dirZ * 1.8;
          if (
            target &&
            Math.hypot(target.x - u.x, target.z - u.z) <= def.attackRange + 0.8 &&
            (target.x - u.x) * dirX + (target.z - u.z) * dirZ >= -0.25
          ) {
            emitDragonBreathAt(target.x, target.z, dmg, {
              unitTarget: target,
            });
          } else if (
            envTarget &&
            Math.hypot(envTarget.x - u.x, envTarget.z - u.z) <= def.attackRange + 0.8 &&
            (envTarget.x - u.x) * dirX + (envTarget.z - u.z) * dirZ >= -0.25
          ) {
            emitDragonBreathAt(envTarget.x, envTarget.z, dmg, {
              buildingTarget: envTarget.kind === 'building' ? envTarget.building : undefined,
              isEnvAttack: true,
            });
          } else {
            const bombX = Math.max(1, Math.min(gs - 2, forwardCheckX));
            const bombZ = Math.max(1, Math.min(gs - 2, forwardCheckZ));
            emitDragonBreathAt(bombX, bombZ, dmg, {
              isEnvAttack: true,
            });
          }
          // Complete a brief fly-over tail after discharging fire before banking to recharge
          u.dragonRunTimer = Math.min(u.dragonRunTimer, 0.52);
        }

        if (u.dragonRunTimer <= 0) {
          u.dragonRunPhase = 'turn';
          u.dragonRunTimer = 1.65;
          u.dragonTurnSign = ((u.appearanceSeed ?? 1) + Math.round(u.x + u.z)) % 2 === 0 ? 1 : -1;
          u.attackAnimTimer = 0;
        }
        return;
      }

      if (u.dragonRunPhase === 'turn') {
        u.dragonRunTimer = Math.max(0, (u.dragonRunTimer ?? 1.4) - dt);
        u.attackAnimTimer = 0;
        if (hasLiveGoal) {
          u.dragonAnchorX = goalX;
          u.dragonAnchorZ = goalZ;
        }
        const anchorX = u.dragonAnchorX ?? goalX;
        const anchorZ = u.dragonAnchorZ ?? goalZ;
        const distAnchor = Math.hypot(anchorX - u.x, anchorZ - u.z);
        const curAngle = Math.atan2(u.dragonRunDirZ ?? 0, u.dragonRunDirX ?? 1);
        const desiredAngle = Math.atan2(anchorZ - u.z, anchorX - u.x);
        const rawDiff = Math.atan2(
          Math.sin(desiredAngle - curAngle),
          Math.cos(desiredAngle - curAngle),
        );

        let dirX = u.dragonRunDirX ?? 1;
        let dirZ = u.dragonRunDirZ ?? 0;
        let remDiff = rawDiff;

        // Fly out smoothly if too close to anchor or while recharging breath cooldown
        if (distAnchor < 4.5 && Math.abs(rawDiff) > 0.85) {
          const gentleAngle = curAngle + (u.dragonTurnSign ?? 1) * 1.1 * dt;
          dirX = Math.cos(gentleAngle);
          dirZ = Math.sin(gentleAngle);
          u.dragonRunDirX = dirX;
          u.dragonRunDirZ = dirZ;
        } else {
          const steered = steerDragonToward(anchorX, anchorZ, 2.55, u.dragonTurnSign ?? 1);
          dirX = steered.dirX;
          dirZ = steered.dirZ;
          remDiff = steered.angleDiff;
        }

        const turnSpeed = moveSpeed * 1.05;
        u.x = Math.max(2, Math.min(gs - 3, u.x + dirX * turnSpeed * dt));
        u.z = Math.max(2, Math.min(gs - 3, u.z + dirZ * turnSpeed * dt));
        u.state = 'moving';
        u.targetX = u.x + dirX * 6.0;
        u.targetZ = u.z + dirZ * 6.0;

        if (u.dragonRunTimer <= 0 || (canBreathe && distAnchor >= 2.2 && Math.abs(remDiff) <= 0.32)) {
          if (!hasLiveGoal) {
            u.dragonRunPhase = undefined;
          } else if (canBreathe && distToGoal <= def.attackRange && Math.abs(remDiff) <= 0.4) {
            u.dragonRunPhase = 'strafe';
            u.dragonRunTimer = 0.95;
          } else {
            u.dragonRunPhase = 'approach';
          }
        }
        return;
      }

      // Phase: 'approach' — circle/orbit while recharging breath cooldown, then dive into strafe range when ready
      u.dragonAnchorX = goalX;
      u.dragonAnchorZ = goalZ;
      const curAngle = Math.atan2(u.dragonRunDirZ ?? 0, u.dragonRunDirX ?? 1);
      const desiredAngle = Math.atan2(goalZ - u.z, goalX - u.x);
      const rawDiff = Math.atan2(
        Math.sin(desiredAngle - curAngle),
        Math.cos(desiredAngle - curAngle),
      );

      let dirX = u.dragonRunDirX ?? 1;
      let dirZ = u.dragonRunDirZ ?? 0;
      let remDiff = rawDiff;

      const minOrbitDist = canBreathe ? 3.0 : 5.8;
      if (distToGoal < minOrbitDist && (!canBreathe || Math.abs(rawDiff) > 0.85)) {
        // Maintain a graceful aerial orbit until breath cooldown recovers
        const bankSign = u.dragonTurnSign ?? (rawDiff >= 0 ? 1 : -1);
        const nextAngle = curAngle + bankSign * 1.15 * dt;
        dirX = Math.cos(nextAngle);
        dirZ = Math.sin(nextAngle);
        u.dragonRunDirX = dirX;
        u.dragonRunDirZ = dirZ;
      } else {
        const steered = steerDragonToward(goalX, goalZ, canBreathe ? 3.0 : 2.1);
        dirX = steered.dirX;
        dirZ = steered.dirZ;
        remDiff = steered.angleDiff;
      }

      const approachSpeed = moveSpeed * (canBreathe ? 1.1 : 0.96);
      u.x = Math.max(2, Math.min(gs - 3, u.x + dirX * approachSpeed * dt));
      u.z = Math.max(2, Math.min(gs - 3, u.z + dirZ * approachSpeed * dt));
      u.state = 'moving';
      u.targetX = u.x + dirX * 6.0;
      u.targetZ = u.z + dirZ * 6.0;

      const updatedDist = Math.hypot(goalX - u.x, goalZ - u.z);
      if (canBreathe && updatedDist <= def.attackRange && Math.abs(remDiff) <= 0.42) {
        u.dragonRunPhase = 'strafe';
        u.dragonRunTimer = 0.95;
        emitDragonBreathAt(goalX, goalZ, dmg, {
          unitTarget: target ?? undefined,
          buildingTarget: envTarget?.kind === 'building' ? envTarget.building : undefined,
          isEnvAttack: !target,
        });
        u.dragonRunTimer = 0.52;
      }
      return;
    }

    if (target) {
      // Treant & Gargoyle ambush wake-up when a hostile/predator comes close!
      if (u.role === 'ent' && u.treantDisguised) {
        u.treantDisguised = false;
        u.treantIdleTimer = 0;
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'animal_attack',
          variant: 'slam',
          originX: u.x,
          originZ: u.z,
          x: u.x,
          y: 0.4,
          z: u.z,
          radius: 2.0,
          color: '#22c55e',
          createdAt: Date.now(),
        });
      }
      if (u.role === 'gargoyle' && u.gargoylePetrified) {
        u.gargoylePetrified = false;
        u.treantIdleTimer = 0;
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'hit_spark',
          x: u.x,
          y: 0.6,
          z: u.z,
          radius: 1.5,
          color: '#94a3b8',
          createdAt: Date.now(),
        });
      }

      // Kitsune signature defense: Spirit Blink away when cornered in melee!
      let dist = Math.hypot(target.x - u.x, target.z - u.z);
      if (u.role === 'kitsune' && dist < 2.25 && (u.wildlifeSkillCooldown ?? 0) <= 0) {
        const awayAng = Math.atan2(u.z - target.z, u.x - target.x);
        for (const angOff of [0, 0.55, -0.55, 1.2, -1.2]) {
          const bx = Math.max(2, Math.min(gs - 3, u.x + Math.cos(awayAng + angOff) * 3.6));
          const bz = Math.max(2, Math.min(gs - 3, u.z + Math.sin(awayAng + angOff) * 3.6));
          const bt = getTile(state, Math.round(bx), Math.round(bz));
          if (bt && bt.height > 0 && !bt.buildingId && bt.onFireTimer <= 0) {
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'hit_spark',
              x: u.x,
              y: 0.55,
              z: u.z,
              radius: 1.35,
              color: '#ff6b1a',
              createdAt: Date.now(),
            });
            u.x = bx;
            u.z = bz;
            u.wildlifeSkillCooldown = 5.5;
            u.actionCooldown = 0; // immediately counter-fire a flame ball after blinking!
            dist = Math.hypot(target.x - u.x, target.z - u.z);
            break;
          }
        }
      }

      u.targetX = target.x;
      u.targetZ = target.z;
      const wildEff = computeUnitEffectiveStats(u, def);
      const reach = Math.max(
        wildEff.attackRange,
        target.role === 'alien_walker' ? 2.8 : target.role === 'alien_ufo' ? 4.8 : def.attackRange,
      );
      if (dist <= reach) {
        u.state = 'fighting';
        if (u.actionCooldown <= 0) {
          const isChargeHit =
            (u.role === 'dinosaur' || u.role === 'minotaur' || u.role === 'bison' || u.role === 'rhino') &&
            (u.dinoRushTimer ?? 0) > 0 &&
            (u.wildlifeSkillCooldown ?? 0) <= 0;
          const isCrit = Math.random() * 100 < wildEff.critChance;
          const dmg =
            wildEff.attackDamage *
            (isFrenzied ? 1.8 : 1.0) *
            (isChargeHit ? 1.38 : 1.0) *
            (isCrit ? 1.65 : 1.0);
          u.actionCooldown =
            (u.role === 'wolf' || u.role === 'fox' || u.role === 'kitsune'
              ? 0.72
              : u.role === 'golem' || u.role === 'kraken'
                ? 1.25
                : u.role === 'hydra' || u.role === 'basilisk' || u.role === 'thunderbird'
                  ? 1.1
                  : 0.9) / wildEff.attackSpeedMult;
          u.attackAnimTimer = 0.48;
          u.attackTargetX = target.x;
          u.attackTargetZ = target.z;
          u.dinoRushTimer = 0;
          if (isChargeHit) {
            u.wildlifeSkillCooldown = 5.2;
          }
          const targetEff = computeUnitEffectiveStats(target);
          const petrifiedMult = target.role === 'gargoyle' && target.gargoylePetrified ? 0.5 : 1.0;
          const targetArmorMult = (1 - targetEff.armor / 100) * petrifiedMult;
          if (!target.statusEffects.shielded) {
            const dealt = Math.max(1, dmg * targetArmorMult);
            target.hp -= dealt;
            if (wildEff.vampiric && u.hp > 0) u.hp = Math.min(u.maxHp, u.hp + dealt * 0.2);
            if (wildEff.venomous) target.statusEffects.plagued = Math.max(target.statusEffects.plagued ?? 0, 7);
            if (targetEff.thorns && dist <= 2.4 && !u.statusEffects.shielded) {
              u.hp -= Math.max(1, dealt * 0.25);
            }
            if (target.hp <= 0) u.kills = (u.kills ?? 0) + 1;
          }
          target.lastAttackerId = u.id;
          target.underAttackTimer = 8.0;

          // Helper for knockback
          const knockUnitAway = (victim: UnitEntity, fromX: number, fromZ: number, pushDist: number) => {
            const kdx = victim.x - fromX;
            const kdz = victim.z - fromZ;
            const kLen = Math.hypot(kdx, kdz) || 1;
            const kx = Math.max(2, Math.min(gs - 3, victim.x + (kdx / kLen) * pushDist));
            const kz = Math.max(2, Math.min(gs - 3, victim.z + (kdz / kLen) * pushDist));
            const kt = getTile(state, Math.round(kx), Math.round(kz));
            if (kt && (kt.height > 0 || victim.role === 'kraken' || victim.role === 'leviathan')) {
              victim.x = kx;
              victim.z = kz;
            }
          };

          // Signature mythical attacks:
          // - Hydra: Emerald Bio-Laser Beam + acid splash/curse
          // - Basilisk: Golden-Lime Petrifying Gaze Laser Beam (4.0s stone freeze + curse)
          // - Thunderbird: Sky Lightning Strike (lightning_smite + chain shock AoE)
          // - Yeti: Blocky voxel ice balls (freeze + splash)
          // - Kitsune / Phoenix / Cerberus: Blocky flame balls (Cerberus fires triple hellfire volley!)
          // - Manticore: Double blocky poison tail spikes (venom_ball + curse)
          // - Kraken: Tidal tentacle AoE slam + blinding ink cloud (cursed)
          // - Griffin / Pegasus: Wing-gust knockback blast
          // - Stone Golem / Minotaur / Treant / Gargoyle: Seismic/root/cleave AoE slam
          const isHydraLaser = u.role === 'hydra';
          const isBasiliskGaze = u.role === 'basilisk';
          const isThunderbirdStrike = u.role === 'thunderbird';
          const isYetiIceThrow = u.role === 'yeti' && dist > 1.85;
          const isFlameBallShot =
            u.role === 'kitsune' ||
            (u.role === 'phoenix' && dist > 1.6) ||
            (u.role === 'cerberus' && dist > 1.5);
          const isManticoreSpikes = u.role === 'manticore' && dist > 1.5;

          if (u.role === 'yeti') {
            target.statusEffects.frozen = Math.max(target.statusEffects.frozen ?? 0, isYetiIceThrow ? 2.6 : 2.2);
            if (isYetiIceThrow) {
              const iceSplash = (other: UnitEntity, dSq: number) => {
                if (other.id === u.id || other.id === target!.id || other.state === 'ko' || dSq > 2.89) return;
                if (other.faction === 'hostile' || (isFrenzied && other.role !== 'yeti')) {
                  other.hp -= dmg * 0.35;
                  other.statusEffects.frozen = Math.max(other.statusEffects.frozen ?? 0, 1.4);
                  other.lastAttackerId = u.id;
                }
              };
              if (activeTickIndex) {
                forEachUnitInRadius(activeTickIndex, target.x, target.z, 1.75, iceSplash);
              }
            }
          } else if (u.role === 'hydra') {
            target.statusEffects.cursed = Math.max(target.statusEffects.cursed ?? 0, 3.5);
            const acidSplash = (other: UnitEntity, dSq: number) => {
              if (other.id === u.id || other.id === target!.id || other.state === 'ko' || dSq > 3.24) return;
              if (other.faction === 'hostile' || other.id === u.lastAttackerId || (isFrenzied && other.role !== 'hydra')) {
                other.hp -= dmg * 0.38;
                other.statusEffects.cursed = Math.max(other.statusEffects.cursed ?? 0, 2.5);
                other.lastAttackerId = u.id;
              }
            };
            if (activeTickIndex) {
              forEachUnitInRadius(activeTickIndex, target.x, target.z, 1.85, acidSplash);
            }
          } else if (u.role === 'basilisk') {
            // Petrifying Gaze turns enemies to stone!
            target.statusEffects.frozen = Math.max(target.statusEffects.frozen ?? 0, 4.0);
            target.statusEffects.cursed = Math.max(target.statusEffects.cursed ?? 0, 4.0);
          } else if (u.role === 'thunderbird') {
            // Chain lightning shocks up to 2 nearby foes
            let chains = 0;
            const chainShock = (other: UnitEntity, dSq: number) => {
              if (chains >= 2 || other.id === u.id || other.id === target!.id || other.state === 'ko' || dSq > 7.84) return;
              if (other.faction === 'hostile' || isCarnivoreAnimal(other.role, other.appearanceSeed) || (isFrenzied && other.role !== 'thunderbird')) {
                other.hp -= dmg * 0.45;
                other.lastAttackerId = u.id;
                chains++;
              }
            };
            if (activeTickIndex) {
              forEachUnitInRadius(activeTickIndex, target.x, target.z, 2.85, chainShock);
            }
          } else if (u.role === 'kraken') {
            target.statusEffects.cursed = Math.max(target.statusEffects.cursed ?? 0, 4.0);
            knockUnitAway(target, u.x, u.z, 1.4);
            const tentacleSplash = (other: UnitEntity, dSq: number) => {
              if (other.id === u.id || other.id === target!.id || other.state === 'ko' || dSq > 9.0) return;
              if (other.faction === 'hostile' || other.faction === 'civilization' || (isFrenzied && other.role !== 'kraken')) {
                other.hp -= dmg * 0.55;
                other.statusEffects.cursed = Math.max(other.statusEffects.cursed ?? 0, 3.0);
                knockUnitAway(other, u.x, u.z, 1.1);
                other.lastAttackerId = u.id;
              }
            };
            if (activeTickIndex) {
              forEachUnitInRadius(activeTickIndex, target.x, target.z, 3.05, tentacleSplash);
            }
          } else if (u.role === 'manticore' || u.role === 'giant_spider') {
            target.statusEffects.cursed = Math.max(target.statusEffects.cursed ?? 0, 4.5);
            if (u.role === 'giant_spider') {
              target.statusEffects.plagued = Math.max(target.statusEffects.plagued ?? 0, 5.5);
            }
          } else if (u.role === 'griffin' || u.role === 'pegasus') {
            const gustPush = u.role === 'pegasus' ? 1.8 : 1.35;
            knockUnitAway(target, u.x, u.z, gustPush);
            const gustSplash = (other: UnitEntity, dSq: number) => {
              if (other.id === u.id || other.id === target!.id || other.state === 'ko' || dSq > 6.25) return;
              if (other.faction === 'hostile' || isCarnivoreAnimal(other.role, other.appearanceSeed)) {
                if (u.role === 'griffin') other.hp -= dmg * 0.35;
                knockUnitAway(other, u.x, u.z, gustPush * 0.85);
                other.lastAttackerId = u.id;
              }
            };
            if (activeTickIndex) {
              forEachUnitInRadius(activeTickIndex, target.x, target.z, 2.55, gustSplash);
            }
          } else if (u.role === 'golem' || u.role === 'minotaur' || u.role === 'ent' || u.role === 'gargoyle') {
            if (u.role === 'minotaur' && isChargeHit) {
              knockUnitAway(target, u.x, u.z, 1.6);
            }
            const quakeSplash = (other: UnitEntity, dSq: number) => {
              if (other.id === u.id || other.id === target!.id || other.state === 'ko' || dSq > 4.84) return;
              if (other.faction === 'hostile' || (isFrenzied && other.role !== u.role)) {
                other.hp -= dmg * 0.55;
                other.lastAttackerId = u.id;
              }
            };
            if (activeTickIndex) {
              forEachUnitInRadius(activeTickIndex, target.x, target.z, 2.25, quakeSplash);
            }
          } else if (u.role === 'cerberus') {
            const tgtTile = getTile(state, target.x, target.z);
            if (tgtTile && tgtTile.height > 0 && !tgtTile.buildingId) {
              tgtTile.onFireTimer = Math.max(tgtTile.onFireTimer, 3.0);
            }
          }

          if (isHydraLaser || isBasiliskGaze) {
            const originTile = getTile(state, u.x, u.z);
            const targetTile = getTile(state, target.x, target.z);
            const originY = (originTile?.height ?? 1) * 0.46 + (isHydraLaser ? 1.55 : 0.95);
            const targetY = (targetTile?.height ?? 1) * 0.46 + 0.4;
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'projectile_tracer',
              vfxSubtype: 'laser_beam',
              originX: u.x,
              originY,
              originZ: u.z,
              x: target.x,
              y: targetY,
              z: target.z,
              radius: isHydraLaser ? 1.55 : 1.25,
              color: isHydraLaser ? '#22ff88' : '#a3e635',
              createdAt: Date.now(),
            });
          } else if (isThunderbirdStrike) {
            const targetTile = getTile(state, target.x, target.z);
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'lightning_smite',
              x: target.x,
              y: (targetTile?.height ?? 1) * 0.46,
              z: target.z,
              radius: 2.2,
              color: '#38bdf8',
              createdAt: Date.now(),
            });
          } else if (isYetiIceThrow || isFlameBallShot || isManticoreSpikes) {
            const originTile = getTile(state, u.x, u.z);
            const targetTile = getTile(state, target.x, target.z);
            const originY = (originTile?.height ?? 1) * 0.46 + (isFlying ? 1.85 : 0.85);
            const targetY = (targetTile?.height ?? 1) * 0.46 + 0.35;
            const volleyCount = u.role === 'cerberus' ? 3 : isManticoreSpikes ? 2 : 1;
            for (let vi = 0; vi < volleyCount; vi++) {
              const lateralOff = volleyCount === 1 ? 0 : (vi - (volleyCount - 1) * 0.5) * 0.32;
              state.pendingVfx.push({
                id: nextEntityId('vfx'),
                type: 'projectile_tracer',
                vfxSubtype: isYetiIceThrow
                  ? 'ice_ball'
                  : isManticoreSpikes
                    ? 'venom_ball'
                    : 'foxfire_ball',
                originX: u.x + lateralOff,
                originY: originY + (vi % 2) * 0.14,
                originZ: u.z - lateralOff * 0.6,
                x: target.x + lateralOff * 0.45,
                y: targetY,
                z: target.z - lateralOff * 0.3,
                radius: isYetiIceThrow ? 1.55 : u.role === 'cerberus' ? 1.25 : 1.15,
                color: isYetiIceThrow
                  ? '#bae6fd'
                  : isManticoreSpikes
                    ? vi === 0 ? '#84cc16' : '#a3e635'
                    : u.role === 'kitsune'
                      ? '#ff6b1a'
                      : u.role === 'cerberus'
                        ? vi === 1 ? '#fbbf24' : '#ef4444'
                        : '#fb923c',
                createdAt: Date.now(),
              });
            }
          } else {
            const variant =
              u.role === 'wolf' ||
              u.role === 'fox' ||
              u.role === 'lion' ||
              u.role === 'tiger' ||
              u.role === 'crocodile' ||
              u.role === 'polar_bear' ||
              u.role === 'hippo' ||
              u.role === 'cerberus' ||
              u.role === 'manticore' ||
              u.role === 'giant_spider'
                ? 'bite'
                : u.role === 'bear' ||
                    u.role === 'yeti' ||
                    u.role === 'golem' ||
                    u.role === 'elephant' ||
                    u.role === 'boar' ||
                    u.role === 'rhino' ||
                    u.role === 'gorilla' ||
                    u.role === 'moose' ||
                    u.role === 'bison' ||
                    u.role === 'minotaur' ||
                    u.role === 'ent' ||
                    u.role === 'kraken' ||
                    u.role === 'gargoyle'
                  ? 'slam'
                  : u.role === 'dinosaur'
                    ? 'crunch'
                    : u.role === 'unicorn' || u.role === 'phoenix' || u.role === 'kitsune' || u.role === 'pegasus' || u.role === 'griffin'
                      ? 'horn_blast'
                      : 'peck';
            const color =
              u.role === 'wolf' || u.role === 'fox' || u.role === 'lion' || u.role === 'tiger' || u.role === 'minotaur' || u.role === 'manticore'
                ? '#f87171'
                : u.role === 'crocodile' || u.role === 'ent' || u.role === 'giant_spider'
                  ? '#4ade80'
                  : u.role === 'yeti' || u.role === 'polar_bear'
                    ? '#67e8f9'
                    : u.role === 'kraken'
                      ? '#6366f1'
                      : u.role === 'gargoyle'
                        ? '#94a3b8'
                        : u.role === 'golem'
                          ? '#fbbf24'
                          : u.role === 'phoenix' || u.role === 'cerberus'
                            ? '#ff7b00'
                            : u.role === 'kitsune'
                              ? '#ff6b1a'
                              : u.role === 'griffin'
                                ? '#fde047'
                                : u.role === 'pegasus'
                                  ? '#e0f2fe'
                                  : u.role === 'bear' || u.role === 'boar' || u.role === 'rhino' || u.role === 'hippo' || u.role === 'gorilla' || u.role === 'moose' || u.role === 'bison'
                                    ? '#f59e0b'
                                    : u.role === 'dinosaur'
                                      ? '#fb923c'
                                      : u.role === 'unicorn'
                                        ? '#f472b6'
                                        : '#fde047';
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'animal_attack',
              variant,
              originX: u.x,
              originZ: u.z,
              x: target.x,
              y: 0,
              z: target.z,
              radius:
                isChargeHit || u.role === 'golem' || u.role === 'yeti' || u.role === 'minotaur' || u.role === 'ent' || u.role === 'kraken' || u.role === 'gargoyle'
                  ? 1.95
                  : u.role === 'dinosaur' || u.role === 'phoenix' || u.role === 'cerberus' || u.role === 'griffin' || u.role === 'pegasus'
                    ? 1.3
                    : u.role === 'bear' || u.role === 'polar_bear' || u.role === 'lion' || u.role === 'tiger' || u.role === 'rhino' || u.role === 'hippo' || u.role === 'gorilla' || u.role === 'moose' || u.role === 'bison'
                      ? 0.95
                      : 0.72,
              color,
              createdAt: Date.now(),
            });
          }
        }
      } else {
        u.state = 'moving';
        if (
          (u.role === 'dinosaur' || u.role === 'minotaur' || u.role === 'bison' || u.role === 'rhino') &&
          (u.wildlifeSkillCooldown ?? 0) <= 0 &&
          dist <= 7.2 &&
          dist >= 2.0
        ) {
          u.dinoRushTimer = Math.max(u.dinoRushTimer ?? 0, u.role === 'minotaur' ? 0.65 : 0.4);
        }
        const chaseMult = (u.dinoRushTimer ?? 0) > 0 ? (u.role === 'minotaur' ? 1.85 : 1.68) : 1.0;
        const nx = u.x + ((target.x - u.x) / dist) * moveSpeed * chaseMult * dt;
        const nz = u.z + ((target.z - u.z) / dist) * moveSpeed * chaseMult * dt;
        const nt = getTile(state, nx, nz);
        if (
          isFlying ||
          (nt &&
            (nt.height > 0 ||
              (canWalkIce && nt.terrain === 'ice') ||
              (canWalkShallows && nt.terrain === 'shallow_water') ||
              (canWalkDeepWater && nt.height === 0)))
        ) {
          u.x = Math.max(1, Math.min(gs - 2, nx));
          u.z = Math.max(1, Math.min(gs - 2, nz));
        }
      }
      return;
    }

    if (envTarget) {
      const dist = Math.hypot(envTarget.x - u.x, envTarget.z - u.z);
      u.targetX = envTarget.x;
      u.targetZ = envTarget.z;
      if (dist <= def.attackRange) {
        u.state = 'fighting';
        if (u.actionCooldown <= 0) {
          const dmg = def.attackDamage * (isFrenzied ? 1.8 : 1.0);
          u.actionCooldown = isFrenzied ? 1.2 : 5.2;
          u.wildlifeSkillCooldown = isFrenzied ? 2.5 : 5.5;
          u.dinoRushTimer = 0;
          u.attackAnimTimer = 0.52;
          u.attackTargetX = envTarget.x;
          u.attackTargetZ = envTarget.z;
          if (envTarget.kind === 'building' && envTarget.building.shieldTimer <= 0) {
            envTarget.building.hp = Math.max(0, envTarget.building.hp - dmg * 0.7);
          } else if (envTarget.kind === 'tile') {
            const et = envTarget.tile;
            et.resourceAmount = Math.max(0, et.resourceAmount - (u.role === 'dinosaur' ? 120 : 85));
            if (et.resourceAmount <= 0) {
              et.resourceNode = 'none';
              if (et.terrain === 'forest' || et.terrain === 'jungle') {
                et.terrain = 'grass';
              }
            } else if ((u.role === 'dinosaur' || u.role === 'bear') && et.resourceAmount >= 95) {
              // When still far from destroying a tough rock/tree, pick a random roam destination instead of camping it
              const roamAng = Math.random() * Math.PI * 2;
              const roamDist = 6 + Math.random() * 5;
              const rx = Math.max(2, Math.min(gs - 3, Math.round(u.x + Math.cos(roamAng) * roamDist)));
              const rz = Math.max(2, Math.min(gs - 3, Math.round(u.z + Math.sin(roamAng) * roamDist)));
              const rt = getTile(state, rx, rz);
              if (rt && rt.height > 0) {
                u.targetX = rx;
                u.targetZ = rz;
                u.state = 'moving';
              }
            }
          }
          const variant =
            u.role === 'wolf'
              ? 'bite'
              : u.role === 'bear'
                ? 'slam'
                : u.role === 'dinosaur'
                  ? 'crunch'
                  : u.role === 'unicorn'
                    ? 'horn_blast'
                    : 'peck';
          const color =
            u.role === 'wolf'
              ? '#f87171'
              : u.role === 'bear'
                ? '#f59e0b'
                : u.role === 'dinosaur'
                  ? '#fb923c'
                  : u.role === 'unicorn'
                    ? '#f472b6'
                    : '#fde047';
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'animal_attack',
            variant,
            originX: u.x,
            originZ: u.z,
            x: envTarget.x,
            y: 0,
            z: envTarget.z,
            radius: u.role === 'dinosaur' ? 1.85 : u.role === 'bear' ? 1.75 : 0.85,
            color,
            createdAt: Date.now(),
          });
        }
      } else {
        u.state = 'moving';
        if (u.role === 'dinosaur' && dist <= 5.5) {
          u.dinoRushTimer = Math.max(u.dinoRushTimer ?? 0, 0.4);
        }
        const rushMult = (u.dinoRushTimer ?? 0) > 0 ? 1.78 : 1.0;
        const nx = u.x + ((envTarget.x - u.x) / dist) * moveSpeed * rushMult * dt;
        const nz = u.z + ((envTarget.z - u.z) / dist) * moveSpeed * rushMult * dt;
        const nt = getTile(state, nx, nz);
        if (isFlying || (nt && nt.height > 0)) {
          u.x = Math.max(1, Math.min(gs - 2, nx));
          u.z = Math.max(1, Math.min(gs - 2, nz));
        }
      }
      return;
    }
  }

  // Treant Tree Disguise: when resting peacefully on dry land with no enemies around, root into an ordinary-looking oak tree!
  if (u.role === 'ent' && !u.draggedByPlayer && curTile && curTile.height > 0 && curTile.onFireTimer <= 0) {
    u.treantIdleTimer = (u.treantIdleTimer ?? 0) + dt;
    if (u.treantIdleTimer >= 2.6) {
      u.treantDisguised = true;
      u.state = 'idle';
      if (u.hp < u.maxHp) {
        u.hp = Math.min(u.maxHp, u.hp + 6.5 * dt);
      }
      return;
    }
  }
  // Gargoyle Stone Statue Perch: when resting or wounded with no threats nearby, land and petrify into a regenerating stone statue!
  if (u.role === 'gargoyle' && !u.draggedByPlayer && curTile && curTile.height > 0 && curTile.onFireTimer <= 0) {
    u.treantIdleTimer = (u.treantIdleTimer ?? 0) + dt;
    if (u.gargoylePetrified || u.hp < u.maxHp * 0.85 || u.treantIdleTimer >= 3.2) {
      u.gargoylePetrified = true;
      u.state = 'idle';
      if (u.hp < u.maxHp) {
        u.hp = Math.min(u.maxHp, u.hp + 14 * dt);
      }
      return;
    }
  }

  // Natural wandering across matching biome tiles (livelier cadence)
  const distToTarget = Math.hypot(u.targetX - u.x, u.targetZ - u.z);
  const canStepOn = (tile: TileData | undefined) =>
    Boolean(
      tile &&
        ((!canWalkDeepWater && tile.height > 0) ||
          (canWalkIce && tile.terrain === 'ice') ||
          (canWalkShallows && tile.terrain === 'shallow_water') ||
          (canWalkDeepWater && tile.height === 0 && !tile.buildingId)),
    );
  const currentTileInvalid = !isFlying && !canStepOn(curTile);
  if (
    distToTarget < (isFlying ? 2.2 : 0.35) ||
    currentTileInvalid ||
    (u.state === 'idle' && Math.random() < dt * 0.85)
  ) {
    const roamRadius = isFlying ? 18 : canWalkDeepWater ? 14 : isPredator ? 10 : 6.5;
    let chosen: TileData | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const candX = Math.max(2, Math.min(gs - 3, Math.round(u.x + (Math.random() - 0.5) * roamRadius * 2)));
      const candZ = Math.max(2, Math.min(gs - 3, Math.round(u.z + (Math.random() - 0.5) * roamRadius * 2)));
      const ct = getTile(state, candX, candZ);
      if (!ct || ct.onFireTimer > 0) continue;
      if (!isFlying && !canStepOn(ct)) continue;
      chosen = ct;
      if (tileMatchesWildlifeHabitat(state, ct, u.role, u.appearanceSeed)) break;
    }
    if (chosen) {
      u.targetX = chosen.x + (Math.random() - 0.5) * 0.4;
      u.targetZ = chosen.z + (Math.random() - 0.5) * 0.4;
      u.state = 'moving';
    } else {
      u.state = 'idle';
    }
  }

  if (u.state === 'moving') {
    if (u.role === 'dragon') {
      const steered = steerDragonToward(u.targetX, u.targetZ, 2.0);
      const pace = 0.98;
      u.x = Math.max(2, Math.min(gs - 3, u.x + steered.dirX * moveSpeed * pace * dt));
      u.z = Math.max(2, Math.min(gs - 3, u.z + steered.dirZ * moveSpeed * pace * dt));
    } else {
      const dx = u.targetX - u.x;
      const dz = u.targetZ - u.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.1) {
        const pace = isFlying ? 0.92 : currentTileInvalid ? 0.65 : isHerbivore ? 0.72 : 0.84;
        const nx = u.x + (dx / dist) * moveSpeed * pace * dt;
        const nz = u.z + (dz / dist) * moveSpeed * pace * dt;
        const nt = getTile(state, nx, nz);
        if (isFlying || canStepOn(nt) || (currentTileInvalid && nt)) {
          u.x = Math.max(1, Math.min(gs - 2, nx));
          u.z = Math.max(1, Math.min(gs - 2, nz));
        } else {
          u.state = 'idle';
        }
      } else {
        u.state = 'idle';
      }
    }
  }
}

const RACE_CROP_QUADRANTS: Record<SpeciesId, readonly [CropType, CropType, CropType, CropType]> = {
  human: ['wheat', 'pumpkin', 'corn', 'sunflower'],
  elf: ['berry_vine', 'sunflower', 'wheat', 'root_crop'],
  dwarf: ['root_crop', 'wheat', 'pumpkin', 'corn'],
  lizardfolk: ['corn', 'pumpkin', 'sunflower', 'berry_vine'],
  orc: ['root_crop', 'pumpkin', 'wheat', 'corn'],
};

function pickCropTypeForFarmQuadrant(species: SpeciesId, ox: number, oz: number): CropType {
  const palette = RACE_CROP_QUADRANTS[species] ?? RACE_CROP_QUADRANTS.human;
  const quadIdx = (ox > 0 ? 1 : 0) + (oz > 0 ? 2 : 0);
  return palette[quadIdx];
}

const farmGrowthAccumMap = new WeakMap<SimulationState, number>();

/**
 * Advances growth phases (0=seeded -> 1=sprouting -> 2=growing -> 3=ripe) on all cultivated farm plots.
 * Windmills at the center of Bronze+ farm districts boost nearby crop growth by 1.5x.
 */
function stepFarmCropGrowth(state: SimulationState, dt: number): void {
  const acc = (farmGrowthAccumMap.get(state) ?? 0) + dt;
  if (acc < 0.45) {
    farmGrowthAccumMap.set(state, acc);
    return;
  }
  farmGrowthAccumMap.set(state, 0);

  const districtsMap = state.settlementDistricts;
  const tiles = state.tiles;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (!t.farmSettlementId || t.farmPlotKind !== 'wheat' || t.resourceNode !== 'berry_bush') continue;

    // Backfill legacy/existing farm plots without cropType
    if (!t.cropType) {
      const sp = state.settlementSpecies?.[t.farmSettlementId] ?? 'human';
      const dist = districtsMap?.[t.farmSettlementId];
      const ox = dist ? t.x - dist.farmX : (t.x % 2 === 0 ? 1 : -1);
      const oz = dist ? t.z - dist.farmZ : (t.z % 2 === 0 ? 1 : -1);
      t.cropType = pickCropTypeForFarmQuadrant(sp, ox, oz);
    }

    const curGrowth = t.cropGrowth ?? (t.cropStage !== undefined ? t.cropStage * 33 : 100);
    if (curGrowth >= 100) {
      t.cropGrowth = 100;
      t.cropStage = 3;
      if (t.resourceAmount <= 0) t.resourceAmount = 160;
      continue;
    }

    // Windmill bonus: settlements at Epoch >= 1 have an active windmill at their farm district center
    const farmEpoch = getSettlementEpoch(state, t.farmSettlementId);
    const dist = districtsMap?.[t.farmSettlementId];
    const hasWindmillBonus =
      farmEpoch >= 1 &&
      dist !== undefined &&
      Math.abs(t.x - dist.farmX) <= dist.farmHalfSize + 1 &&
      Math.abs(t.z - dist.farmZ) <= dist.farmHalfSize + 1;

    let rate = 3.8; // ~26s from freshly seeded to ripe; ~17s with windmill
    if (hasWindmillBonus) rate *= 1.5;
    if (t.blessedTimer > 0) rate *= 1.4;
    if (t.cursedTimer > 0 || t.onFireTimer > 0) rate *= 0.35;

    const prevStage = t.cropStage ?? 0;
    const nextGrowth = Math.min(100, curGrowth + rate * acc);
    t.cropGrowth = nextGrowth;
    const nextStage: 0 | 1 | 2 | 3 =
      nextGrowth >= 95 ? 3 : nextGrowth >= 60 ? 2 : nextGrowth >= 25 ? 1 : 0;
    t.cropStage = nextStage;
    if (prevStage < 3 && nextStage === 3 && t.resourceAmount < 120) {
      t.resourceAmount = 160;
    }
  }
}

function findNearestResourceTile(
  state: SimulationState,
  ux: number,
  uz: number,
  preferredNodes: TileData['resourceNode'][],
  unit?: UnitEntity,
): TileData | null {
  const rx = Math.round(ux);
  const rz = Math.round(uz);
  const indivHash = unit
    ? Math.abs((unit.appearanceSeed ?? 1) * 31 + unit.id.charCodeAt(unit.id.length - 1) * 17)
    : 0;
  const isHelperPersonality = indivHash % 2 === 0;
  const curTile = getTile(state, rx, rz);
  const unitOnWaterOrWalkway = Boolean(curTile && curTile.height === 0) || state.worldTemplate === 'scrap_sea';

  let bestTile: TileData | null = null;
  let bestScore = Infinity;

  for (const radius of [14, 26, 42]) {
    const minX = Math.max(1, rx - radius);
    const maxX = Math.min(state.gridSize - 2, rx + radius);
    const minZ = Math.max(1, rz - radius);
    const maxZ = Math.min(state.gridSize - 2, rz + radius);

    for (let tz = minZ; tz <= maxZ; tz++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const t = state.tiles[tz * state.gridSize + tx];
        if (!t || t.resourceAmount <= 0 || (t.coralBleachTimer ?? 0) > 0 || t.resourceNode === 'none') continue;
        // Cultivated farm plots can ONLY be harvested when ripe (Stage 3)!
        if (t.farmSettlementId && t.farmPlotKind === 'wheat' && (t.cropStage ?? 3) < 3) continue;
        const dist = Math.hypot(tx - ux, tz - uz);
        if (t.height <= 0 && !unitOnWaterOrWalkway && dist > 6.5) continue;
        const prefIdx = preferredNodes.indexOf(t.resourceNode);
        if (prefIdx === -1) continue;

        let score = dist + prefIdx * 3.2;
        if (t.height === 0 && !unitOnWaterOrWalkway) score += 8.0;
        // Citizens actively prioritize harvesting ripe crops in their own settlement's farmfields
        if (
          t.farmSettlementId &&
          t.farmPlotKind === 'wheat' &&
          t.cropStage === 3 &&
          (!unit?.settlementId || t.farmSettlementId === unit.settlementId)
        ) {
          score -= 6.5;
        }

        if (unit) {
          // O(1) count of fellow villagers already heading to or working at this node
          let workersOnNode = 0;
          if (activeTickIndex) {
            workersOnNode = activeTickIndex.gatherersByTileKey.get(tz * state.gridSize + tx) ?? 0;
            if (Math.abs(unit.targetX - tx) < 0.85 && Math.abs(unit.targetZ - tz) < 0.85 && workersOnNode > 0) {
              workersOnNode--;
            }
          } else {
            for (const other of state.units) {
              if (
                other.id !== unit.id &&
                other.faction === 'civilization' &&
                other.state !== 'ko' &&
                Math.abs(other.targetX - tx) < 0.85 &&
                Math.abs(other.targetZ - tz) < 0.85
              ) {
                workersOnNode++;
              }
            }
          }

          if (
            (t.resourceNode === 'timber_grove' ||
              t.resourceNode === 'stone_outcrop' ||
              t.resourceNode === 'ore_vein' ||
              t.resourceNode === 'scrap_flotsam') &&
            workersOnNode === 1 &&
            dist <= 12 &&
            isHelperPersonality
          ) {
            // Context-sensitive cooperation: help a single person cut a tree or quarry stone together!
            score -= 4.8;
          } else if (workersOnNode >= 2 || (t.resourceNode === 'berry_bush' && workersOnNode >= 1)) {
            // Avoid crowding onto the same node so individuals spread out naturally across the territory
            score += workersOnNode * 20;
          } else if (workersOnNode === 1) {
            score += 4.5;
          }

          // Personal spatial scatter so individuals don't pick identical nodes in lockstep
          const personalJitter = (((tx * 19 + tz * 37 + indivHash) % 13) / 13) * 3.8;
          score += personalJitter;
        }

        if (score < bestScore) {
          bestScore = score;
          bestTile = t;
        }
      }
    }
    if (bestTile) return bestTile;
  }
  return bestTile;
}

const unitBridgeNextTimeMap = new WeakMap<UnitEntity, number>();
const civBridgePlannerTimerMap = new WeakMap<SimulationState, { timer: number; cursor: number; announced: Set<string> }>();

function layBridgeTile(state: SimulationState, tile: TileData): boolean {
  if (tile.height > 0 || tile.buildingId) return false;
  raiseWaterTileToLand(tile, 'stone_road', 1);
  tile.isLake = false;
  tile.farmSettlementId = undefined;
  syncTileToWorldGrid(ensureWorldGrid(state), tile);
  return true;
}

/**
 * Traces a 4-connected grid line from (startX, startZ) toward (targetX, targetZ).
 * If it enters open water and reaches solid land on the far shore within `maxSpan` water tiles,
 * returns the ordered list of water tiles to bridge. Otherwise returns null.
 */
function findBridgeableWaterLine(
  state: SimulationState,
  startX: number,
  startZ: number,
  targetX: number,
  targetZ: number,
  maxSpan: number,
): TileData[] | null {
  const dxTotal = targetX - startX;
  const dzTotal = targetZ - startZ;
  const dist = Math.hypot(dxTotal, dzTotal);
  if (dist < 1.2) return null;

  const stepX = dxTotal / dist;
  const stepZ = dzTotal / dist;
  const maxProbe = Math.min(Math.ceil(dist) + 2, maxSpan + 18);

  const waterTiles: TileData[] = [];
  const seen = new Set<number>();
  let prevX = startX;
  let prevZ = startZ;
  let enteredWater = false;

  const pushIfWater = (tx: number, tz: number): 'water' | 'land' | 'blocked' => {
    const t = getTile(state, tx, tz);
    if (!t) return 'blocked';
    if (isWalkableOrWalkwayTile(t)) return 'land';
    if (t.buildingId) return 'blocked';
    const key = tz * state.gridSize + tx;
    if (!seen.has(key)) {
      seen.add(key);
      waterTiles.push(t);
    }
    return 'water';
  };

  for (let i = 1; i <= maxProbe; i++) {
    const cx = Math.round(startX + stepX * i);
    const cz = Math.round(startZ + stepZ * i);
    if (cx === prevX && cz === prevZ) continue;

    // Ensure 4-connectivity (no diagonal jumps across water corners)
    const intermediates: Array<[number, number]> =
      cx !== prevX && cz !== prevZ
        ? [
            [cx, prevZ],
            [cx, cz],
          ]
        : [[cx, cz]];

    for (const [ix, iz] of intermediates) {
      const res = pushIfWater(ix, iz);
      if (res === 'blocked') return null;
      if (res === 'water') {
        enteredWater = true;
        if (waterTiles.length > maxSpan) return null;
      } else if (enteredWater) {
        // Reached solid land on the far side!
        return waterTiles.length > 0 ? waterTiles : null;
      }
    }

    prevX = cx;
    prevZ = cz;
  }

  return null;
}

/**
 * Allows blocked civilization units (soldiers marching to war, settlers, gatherers)
 * to actively construct a bridge tile-by-tile across bridgeable rivers/straits.
 * Returns:
 * - 'built': laid a bridge tile and stepped onto it
 * - 'building': waiting on short construction cooldown (stay on shore, keep target)
 * - 'none': gap is not bridgeable
 */
function tryBuildUnitFieldBridge(
  state: SimulationState,
  u: UnitEntity,
): 'built' | 'building' | 'none' {
  if (u.faction !== 'civilization') return 'none';
  const curX = Math.round(u.x);
  const curZ = Math.round(u.z);
  const tgtX = Math.round(u.targetX);
  const tgtZ = Math.round(u.targetZ);
  if (Math.hypot(tgtX - curX, tgtZ - curZ) < 1.5) return 'none';

  const myKid = u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId;
  let isAtWar = false;
  if (myKid && state.kingdomRelations) {
    for (const [pairKey, rel] of Object.entries(state.kingdomRelations)) {
      if (rel === 'war' && pairKey.includes(myKid)) {
        isAtWar = true;
        break;
      }
    }
  }
  const isWarOrExpedition =
    isAtWar ||
    u.state === 'fighting' ||
    u.attackTargetX !== undefined ||
    u.expeditionTargetX !== undefined;

  const maxSpan = isWarOrExpedition ? 16 : 10;
  const waterLine = findBridgeableWaterLine(state, curX, curZ, tgtX, tgtZ, maxSpan);
  if (!waterLine || waterLine.length === 0) return 'none';

  const now = state.year;
  const nextAllowed = unitBridgeNextTimeMap.get(u) ?? 0;
  // ~0.45s during war, ~0.85s during peace (state.year advances ~0.35/s, use 0.14 / 0.28 year units)
  const cooldown = isWarOrExpedition ? 0.14 : 0.28;
  if (now < nextAllowed) {
    return 'building';
  }

  // Spend a modest resource cost when available (war sappers can always build emergency bridges)
  if (!state.sandboxFreeMode && myKid && state.kingdomResources?.[myKid]) {
    const kRes = state.kingdomResources[myKid];
    if ((kRes.stone ?? 0) >= 1) {
      kRes.stone = Math.max(0, (kRes.stone ?? 0) - 1);
    } else if ((kRes.wood ?? 0) >= 1) {
      kRes.wood = Math.max(0, (kRes.wood ?? 0) - 1);
    }
  }

  const nextWaterTile = waterLine[0];
  if (!layBridgeTile(state, nextWaterTile)) return 'none';
  unitBridgeNextTimeMap.set(u, now + cooldown);

  u.x = Math.max(1, Math.min(state.gridSize - 2, nextWaterTile.x));
  u.z = Math.max(1, Math.min(state.gridSize - 2, nextWaterTile.z));
  u.isSwimming = false;
  u.swimStamina = 100;
  return 'built';
}

/**
 * Proactive strategic bridge builder:
 * 1. Kingdoms at war actively construct war bridges across bridgeable channels (up to 18 tiles)
 *    between their closest settlement and the enemy's closest settlement.
 * 2. Peaceful settlements gradually bridge narrow rivers/straits (2-10 tiles) to reach nearby
 *    unreached land/islands so citizens can expand and gather across water.
 */
function stepCivilizationBridging(state: SimulationState, dt: number): void {
  let tracker = civBridgePlannerTimerMap.get(state);
  if (!tracker) {
    tracker = { timer: 0, cursor: 0, announced: new Set<string>() };
    civBridgePlannerTimerMap.set(state, tracker);
  }
  tracker.timer += dt;
  if (tracker.timer < 0.9) return;
  tracker.timer = 0;

  if (state.buildings.length === 0) return;

  // Group completed buildings by kingdom and settlement
  const bldByKingdom = new Map<string, BuildingEntity[]>();
  const settlementAnchors: Array<{ settlementId: string; kingdomId: string; x: number; z: number }> = [];
  const seenSettlements = new Set<string>();

  for (let i = 0; i < state.buildings.length; i++) {
    const b = state.buildings[i];
    if (b.hp <= 0 || b.constructionProgress < 100 || !b.settlementId) continue;
    const kid = getKingdomId(state, b.settlementId);
    let list = bldByKingdom.get(kid);
    if (!list) {
      list = [];
      bldByKingdom.set(kid, list);
    }
    list.push(b);
    if (!seenSettlements.has(b.settlementId)) {
      seenSettlements.add(b.settlementId);
      settlementAnchors.push({ settlementId: b.settlementId, kingdomId: kid, x: b.tileX, z: b.tileZ });
    }
  }

  // 1. Active War Bridges between warring kingdoms
  if (state.kingdomRelations) {
    const warPairsProcessed = new Set<string>();
    for (const [pairKey, rel] of Object.entries(state.kingdomRelations)) {
      if (rel !== 'war' || warPairsProcessed.has(pairKey)) continue;
      warPairsProcessed.add(pairKey);
      const [kA, kB] = pairKey.split('::');
      if (!kA || !kB) continue;
      const listA = bldByKingdom.get(kA);
      const listB = bldByKingdom.get(kB);
      if (!listA || !listB || listA.length === 0 || listB.length === 0) continue;

      // Find closest building pair between kA and kB
      let bestA = listA[0];
      let bestB = listB[0];
      let bestDistSq = Infinity;
      for (let i = 0; i < listA.length; i++) {
        const a = listA[i];
        for (let j = 0; j < listB.length; j++) {
          const b = listB[j];
          const dSq = (a.tileX - b.tileX) ** 2 + (a.tileZ - b.tileZ) ** 2;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestA = a;
            bestB = b;
          }
        }
      }

      // Check if there's a bridgeable water crossing (up to 18 tiles) along the war front
      const warWaterLine = findBridgeableWaterLine(
        state,
        bestA.tileX,
        bestA.tileZ,
        bestB.tileX,
        bestB.tileZ,
        18,
      );
      if (warWaterLine && warWaterLine.length > 0) {
        const epochA = state.kingdomEpochs?.[kA] ?? 0;
        const tilesToLay = epochA >= 2 ? 2 : 1;
        let laid = 0;
        for (let tIdx = 0; tIdx < Math.min(tilesToLay, warWaterLine.length); tIdx++) {
          if (layBridgeTile(state, warWaterLine[tIdx])) {
            laid++;
          }
        }
        if (laid > 0 && !tracker.announced.has(`war:${pairKey}`)) {
          tracker.announced.add(`war:${pairKey}`);
          const nameA = state.settlementNames?.[kA] ?? state.settlementNames?.[bestA.settlementId!] ?? 'A kingdom';
          const nameB = state.settlementNames?.[kB] ?? state.settlementNames?.[bestB.settlementId!] ?? 'its rival';
          addChronicle(
            state,
            `War engineers of ${nameA} began bridging the waters to march on ${nameB}!`,
            'warning',
          );
        }
      }
    }
  }

  // 2. Proactive Expansion Bridges for settlements near bridgeable rivers/straits (1 settlement per cycle)
  if (settlementAnchors.length > 0) {
    const anchor = settlementAnchors[tracker.cursor % settlementAnchors.length];
    tracker.cursor = (tracker.cursor + 1) % settlementAnchors.length;
    const dirs: readonly [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ];
    for (let d = 0; d < dirs.length; d++) {
      const [dx, dz] = dirs[d];
      const probeDist = 18;
      const targetX = Math.max(1, Math.min(state.gridSize - 2, anchor.x + dx * probeDist));
      const targetZ = Math.max(1, Math.min(state.gridSize - 2, anchor.z + dz * probeDist));
      const waterLine = findBridgeableWaterLine(state, anchor.x, anchor.z, targetX, targetZ, 10);
      if (!waterLine || waterLine.length === 0) continue;

      // If we are already extending this bridge (tile directly behind is stone_road), keep going!
      // Otherwise avoid starting a brand-new parallel bridge right next to an existing crossing.
      const firstTile = waterLine[0];
      const behindTile = getTile(state, firstTile.x - dx, firstTile.z - dz);
      const isContinuingBridge = Boolean(behindTile && behindTile.terrain === 'stone_road' && behindTile.height === 1);
      if (!isContinuingBridge) {
        let nearbyBridge = false;
        for (let oz = -3; oz <= 3 && !nearbyBridge; oz++) {
          for (let ox = -3; ox <= 3; ox++) {
            if (ox === 0 && oz === 0) continue;
            const nt = getTile(state, firstTile.x + ox, firstTile.z + oz);
            if (nt && nt.terrain === 'stone_road' && nt.height === 1) {
              const adjW =
                getTile(state, nt.x + 1, nt.z)?.height === 0 ||
                getTile(state, nt.x - 1, nt.z)?.height === 0 ||
                getTile(state, nt.x, nt.z + 1)?.height === 0 ||
                getTile(state, nt.x, nt.z - 1)?.height === 0;
              if (adjW) {
                nearbyBridge = true;
                break;
              }
            }
          }
        }
        if (nearbyBridge) continue;
      }

      // Spend 2 wood or stone if not in sandbox free mode
      if (!state.sandboxFreeMode) {
        const kRes = state.kingdomResources?.[anchor.kingdomId];
        if (!kRes || ((kRes.wood ?? 0) < 2 && (kRes.stone ?? 0) < 2)) break;
        if ((kRes.stone ?? 0) >= 2) kRes.stone -= 2;
        else kRes.wood -= 2;
      }

      if (layBridgeTile(state, firstTile)) {
        const announceKey = `exp:${anchor.settlementId}:${d}`;
        if (!tracker.announced.has(announceKey) && waterLine.length >= 3) {
          tracker.announced.add(announceKey);
          const sName = state.settlementNames?.[anchor.settlementId] ?? 'A settlement';
          addChronicle(state, `Builders of ${sName} started bridging the waters to expand.`, 'build');
        }
        break;
      }
    }
  }
}

function isWalkableOrWalkwayTile(t: TileData | undefined): boolean {
  if (!t) return false;
  if (t.height > 0) return true;
  return Boolean(
    t.buildingId ||
      t.terrain === 'ice' ||
      t.terrain === 'stone_road' ||
      t.terrain === 'rail_track' ||
      t.terrain === 'runway',
  );
}

/**
 * Enforces Sea Update movement rules:
 * - Units cannot walk at full speed across open water without a Water Walkway ('stone_road'/'rail_track'),
 *   Floating Building Platform, or Passenger Ship.
 * - If a unit enters open water, they swim slowly (0.36x speed) and drain swimStamina, drowning when exhausted.
 * - Units avoid stepping into open water unless necessary (e.g. nearby shallow resource, returning to shore, or boarding a ship).
 */
function advanceUnitPositionWithWaterRules(
  state: SimulationState,
  u: UnitEntity,
  dirX: number,
  dirZ: number,
  moveSpeed: number,
  dt: number,
  allowEnterWater = false,
): void {
  const curTile = getTile(state, Math.round(u.x), Math.round(u.z));
  const currentlyOnSolid = isWalkableOrWalkwayTile(curTile);

  const effectiveSpeed = currentlyOnSolid ? moveSpeed : moveSpeed * 0.36;
  const nx = Math.max(1, Math.min(state.gridSize - 2, u.x + dirX * effectiveSpeed * dt));
  const nz = Math.max(1, Math.min(state.gridSize - 2, u.z + dirZ * effectiveSpeed * dt));
  const nextTile = getTile(state, Math.round(nx), Math.round(nz));
  const nextIsSolid = isWalkableOrWalkwayTile(nextTile);

  if (nextIsSolid) {
    u.x = nx;
    u.z = nz;
    u.isSwimming = false;
    u.swimStamina = Math.min(100, (u.swimStamina ?? 100) + 35 * dt);
    return;
  }

  // Next tile is open water! Try cached flatqueue FlowField / coarse HPA* steering first so armies
  // and settlers smoothly route around bays, rivers, and mountain ridges on large maps.
  if (currentlyOnSolid) {
    const goalDistSq = (u.targetX - u.x) ** 2 + (u.targetZ - u.z) ** 2;
    if (goalDistSq > 9 && simPathBudget.tryConsume()) {
      const grid = ensureWorldGrid(state);
      let steerX = u.targetX;
      let steerZ = u.targetZ;
      if (goalDistSq > 46 * 46) {
        const coarsePath = simCoarseGraph.findCoarsePath(grid, u.x, u.z, u.targetX, u.targetZ);
        if (coarsePath && coarsePath.length > 0) {
          steerX = coarsePath[0].centerX;
          steerZ = coarsePath[0].centerZ;
        }
      }
      const field = simFlowFields.getOrBuildFlowField(grid, steerX, steerZ, state.year, 48, false);
      const flowDir = simFlowFields.sampleDirection(field, u.x, u.z);
      if (flowDir) {
        const fLen = Math.hypot(flowDir.dx, flowDir.dz) || 1;
        const fx = Math.max(1, Math.min(state.gridSize - 2, u.x + (flowDir.dx / fLen) * moveSpeed * dt));
        const fz = Math.max(1, Math.min(state.gridSize - 2, u.z + (flowDir.dz / fLen) * moveSpeed * dt));
        if (isWalkableOrWalkwayTile(getTile(state, Math.round(fx), Math.round(fz)))) {
          u.x = fx;
          u.z = fz;
          u.isSwimming = false;
          u.swimStamina = Math.min(100, (u.swimStamina ?? 100) + 35 * dt);
          return;
        }
      }
    }

    const sdx = Math.sign(dirX);
    const sdz = Math.sign(dirZ);
    const detourDirs: readonly [number, number][] = [
      [sdx, 0],
      [0, sdz],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (let di = 0; di < detourDirs.length; di++) {
      const ox = detourDirs[di][0];
      const oz = detourDirs[di][1];
      if (ox === 0 && oz === 0) continue;
      const candX = Math.round(u.x) + ox;
      const candZ = Math.round(u.z) + oz;
      const candTile = getTile(state, candX, candZ);
      if (isWalkableOrWalkwayTile(candTile)) {
        const dot = ox * dirX + oz * dirZ;
        if (dot > 0.15) {
          const stepLen = Math.hypot(ox, oz);
          u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + (ox / stepLen) * moveSpeed * dt));
          u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + (oz / stepLen) * moveSpeed * dt));
          u.isSwimming = false;
          u.swimStamina = Math.min(100, (u.swimStamina ?? 100) + 35 * dt);
          return;
        }
      }
    }

    // If a passenger ship is nearby (within 12 tiles), wait on the shore to board the ship instead of swimming!
    const myKid = u.settlementId ? getKingdomId(state, u.settlementId) : u.kingdomId;
    const nearbyFerry = (state.vehicles ?? []).find(
      (v) =>
        v.type === 'passenger_ship' &&
        (v.hp ?? 0) > 0 &&
        (v.passengerIds?.length ?? 0) < 4 &&
        (!myKid || (v.kingdomId ?? getKingdomId(state, v.settlementId)) === myKid) &&
        Math.hypot(v.x - u.x, v.z - u.z) <= 14,
    );
    if (nearbyFerry) {
      u.isSwimming = false;
      u.swimStamina = Math.min(100, (u.swimStamina ?? 100) + 35 * dt);
      if (Math.hypot(nearbyFerry.x - u.x, nearbyFerry.z - u.z) <= 3.8) {
        if (!nearbyFerry.passengerIds) nearbyFerry.passengerIds = [];
        nearbyFerry.passengerIds.push(u.id);
        u.embarkedVehicleId = nearbyFerry.id;
        nearbyFerry.targetIslandX = u.expeditionTargetX ?? u.targetX;
        nearbyFerry.targetIslandZ = u.expeditionTargetZ ?? u.targetZ;
      }
      return;
    }

    // Actively bridge across bridgeable rivers/channels when destination is unreachable on foot
    const bridgeAttempt = tryBuildUnitFieldBridge(state, u);
    if (bridgeAttempt === 'built' || bridgeAttempt === 'building') {
      u.isSwimming = false;
      u.swimStamina = Math.min(100, (u.swimStamina ?? 100) + 35 * dt);
      return;
    }

    // Do not casually step into open water if stamina is low or water entry is not needed
    if (!allowEnterWater || (u.swimStamina ?? 100) < 45) {
      u.isSwimming = false;
      u.swimStamina = Math.min(100, (u.swimStamina ?? 100) + 35 * dt);
      u.targetX = u.x;
      u.targetZ = u.z;
      u.state = 'idle';
      return;
    }
  }

  // Unit is swimming in open water
  u.x = nx;
  u.z = nz;
  u.isSwimming = true;
  const drainRate = nextTile?.terrain === 'deep_water' ? 22 : 14;
  u.swimStamina = Math.max(0, (u.swimStamina ?? 100) - drainRate * dt);
  if (u.swimStamina <= 0 && !u.statusEffects.shielded) {
    // Exhausted from swimming too far from shore -> drowns!
    u.hp = Math.max(0, u.hp - 28 * dt);
  }
}

function findNearestDropoffBuilding(
  state: SimulationState,
  x: number,
  z: number,
  settlementId?: string,
): BuildingEntity | null {
  let best: BuildingEntity | null = null;
  let bestDistSq = settlementId ? Infinity : SETTLEMENT_AWARENESS_RADIUS ** 2;
  for (const b of state.buildings) {
    if (b.constructionProgress < 100) continue;
    if (settlementId && b.settlementId !== settlementId) continue;
    const dSq = (b.tileX - x) ** 2 + (b.tileZ - z) ** 2;
    if (dSq <= bestDistSq) {
      bestDistSq = dSq;
      best = b;
    }
  }
  if (!best && settlementId) {
    // Allow dropping off at own settlement's founding hearth while under construction
    best = state.buildings.find((b) => b.settlementId === settlementId) ?? null;
  }
  return best;
}

function stepCivilianUnitAI(
  state: SimulationState,
  u: UnitEntity,
  def: typeof UNITS[number],
  baseMoveSpeed: number,
  dt: number,
): void {
  // If embarked on a passenger ship / ferry, stay aboard until the ship disembarks at destination
  if (u.embarkedVehicleId) {
    const ship = (state.vehicles ?? []).find((v) => v.id === u.embarkedVehicleId && (v.hp ?? 0) > 0);
    if (ship) {
      u.x = ship.x;
      u.z = ship.z;
      u.isSwimming = false;
      u.swimStamina = 100;
      u.state = 'moving';
      return;
    }
    u.embarkedVehicleId = undefined;
  }

  const indivHash = Math.abs((u.appearanceSeed ?? 1) * 31 + u.id.charCodeAt(u.id.length - 1) * 17);
  // Subtle individual walking pace variation so citizens never march like robotic clones
  const moveSpeed = baseMoveSpeed * (0.92 + (indivHash % 17) * 0.01);
  const personalAngle = ((indivHash % 12) / 12) * Math.PI * 2;
  const personalOffsetX = Math.cos(personalAngle) * 0.38;
  const personalOffsetZ = Math.sin(personalAngle) * 0.38;

  // 0. Bind nomadic units only if a same-species settlement is within local awareness radius (never intercept colonists on expedition!)
  if (!u.settlementId && u.expeditionTargetX === undefined) {
    const nearbyBld = findLocalSettlementBuilding(state, u.x, u.z, SETTLEMENT_AWARENESS_RADIUS);
    if (nearbyBld?.settlementId) {
      const bSpecies = state.settlementSpecies?.[nearbyBld.settlementId] ?? 'human';
      if (bSpecies === u.species) {
        u.settlementId = nearbyBld.settlementId;
        u.kingdomId = getKingdomId(state, nearbyBld.settlementId);
      }
    }
  }

  // Burning tile hurts unshielded units; also update swimming/stamina if standing on open water while idle
  const curTile = getTile(state, u.x, u.z);
  if (curTile && curTile.onFireTimer > 0 && !u.statusEffects.shielded) {
    u.hp -= 10 * dt;
  }
  if (curTile && !isWalkableOrWalkwayTile(curTile)) {
    u.isSwimming = true;
    const drain = curTile.terrain === 'deep_water' ? 18 : 11;
    u.swimStamina = Math.max(0, (u.swimStamina ?? 100) - drain * dt);
    if (u.swimStamina <= 0 && !u.statusEffects.shielded) {
      u.hp = Math.max(0, u.hp - 26 * dt);
    }
    // If stamina is getting low while in open water, swim urgently toward nearest land, walkway, or ship!
    if ((u.swimStamina ?? 100) < 55) {
      let bestRescueX: number | null = null;
      let bestRescueZ: number | null = null;
      let bestRescueDist = 18;
      for (const v of state.vehicles ?? []) {
        if (v.type === 'passenger_ship' && (v.hp ?? 0) > 0 && (v.passengerIds?.length ?? 0) < 4) {
          const vd = Math.hypot(v.x - u.x, v.z - u.z);
          if (vd < bestRescueDist) {
            bestRescueDist = vd;
            bestRescueX = v.x;
            bestRescueZ = v.z;
          }
        }
      }
      const rx = Math.round(u.x);
      const rz = Math.round(u.z);
      for (let r = 1; r <= 10 && bestRescueDist > r; r++) {
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const st = getTile(state, rx + dx, rz + dz);
            if (isWalkableOrWalkwayTile(st)) {
              const d = Math.hypot(dx, dz);
              if (d < bestRescueDist) {
                bestRescueDist = d;
                bestRescueX = rx + dx;
                bestRescueZ = rz + dz;
              }
            }
          }
        }
      }
      if (bestRescueX !== null && bestRescueZ !== null && bestRescueDist > 0.2) {
        u.state = 'moving';
        const rdx = (bestRescueX - u.x) / bestRescueDist;
        const rdz = (bestRescueZ - u.z) / bestRescueDist;
        u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + rdx * moveSpeed * 0.42 * dt));
        u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + rdz * moveSpeed * 0.42 * dt));
        return;
      }
    }
  } else {
    u.isSwimming = false;
    u.swimStamina = Math.min(100, (u.swimStamina ?? 100) + 35 * dt);
  }

  const isChild = u.ageStage === 'child';

  // 1. Combat defense, Cooperative City Defense & Racial Combat Doctrines:
  // - Humans: Fast tech progress, but rely heavily on technology (weaker without completed tech structures, stronger with them)
  // - Elves: Peaceful (never initiate unprovoked wars outside their territory), use ranged magic & magic technology to fight and heal
  // - Orcs: Barbarians (fierce melee attackers and border skirmishers, but very slow builders/researchers)
  const idx = activeTickIndex;
  const sInfo = u.settlementId && idx ? idx.settlements.get(u.settlementId) : undefined;
  const allOwnSettlementBlds = sInfo
    ? sInfo.allBuildings
    : u.settlementId
      ? state.buildings.filter((b) => b.settlementId === u.settlementId)
      : [];
  const ownVillageBuildings = sInfo
    ? sInfo.completedBuildings
    : allOwnSettlementBlds.filter((b) => b.constructionProgress >= 100);
  const homeAnchor = sInfo
    ? { x: sInfo.homeAnchorX, z: sInfo.homeAnchorZ }
    : allOwnSettlementBlds.length > 0
      ? { x: allOwnSettlementBlds[0].tileX, z: allOwnSettlementBlds[0].tileZ }
      : { x: u.x, z: u.z };

  const myKingdomId = idx
    ? idx.unitKingdomId.get(u.id)
    : u.settlementId
      ? getKingdomId(state, u.settlementId)
      : u.kingdomId;
  const unitEpoch = myKingdomId ? getKingdomEpoch(state, myKingdomId) : 0;

  const hasHumanTechSupport = sInfo
    ? u.species !== 'human' || unitEpoch === 0 || sInfo.hasHumanTechSupport
    : u.species !== 'human' ||
      unitEpoch === 0 ||
      ownVillageBuildings.some(
        (b) =>
          b.type === 'smeltery' ||
          b.type === 'observatory' ||
          b.type === 'steam_foundry' ||
          b.type === 'dynamo_plant' ||
          b.type === 'fission_reactor' ||
          b.type === 'cyber_institute' ||
          b.type === 'launch_arcology' ||
          b.type === 'dyson_spire',
      );
  const hasElfArcaneTech = sInfo
    ? u.species === 'elf' && sInfo.hasElfArcaneTech
    : u.species === 'elf' &&
      ownVillageBuildings.some(
        (b) =>
          b.type === 'shaman_totem' ||
          b.type === 'ziggurat' ||
          b.type === 'observatory' ||
          b.type === 'cyber_institute' ||
          b.type === 'dyson_spire',
      );

  // Elves passively weave restorative magic; settled citizens gently recover out of combat
  if (u.species === 'elf' && u.hp < u.maxHp) {
    u.hp = Math.min(u.maxHp, u.hp + (hasElfArcaneTech ? 2.5 : 1.4) * dt);
  } else if (u.settlementId && u.state !== 'fighting' && (u.underAttackTimer ?? 0) <= 0 && u.hp < u.maxHp) {
    u.hp = Math.min(u.maxHp, u.hp + 1.2 * dt);
  }

  const warsEnabled = state.worldRules?.warsEnabled !== false;
  const maxOwnedEpoch = sInfo
    ? sInfo.maxOwnedEpoch
    : ownVillageBuildings.reduce((acc, b) => Math.max(acc, b.epochLevel), unitEpoch);
  const myEpoch = Math.max(unitEpoch, maxOwnedEpoch);

  let nearestEnemy: UnitEntity | null = null;
  let enemyDistSq = Infinity;
  const warEnemiesSet = myKingdomId && idx ? idx.warEnemiesByKingdom.get(myKingdomId) : undefined;
  const mySettlementAttackers = u.settlementId && idx ? idx.attackersOfSettlement.get(u.settlementId) : undefined;
  const myKingdomAttackers = myKingdomId && idx ? idx.attackersOfKingdom.get(myKingdomId) : undefined;
  const isWarriorOrKingOrOrc = u.role === 'warrior' || u.isKing || u.species === 'orc';
  // Era-driven battlefield doctrine:
  // - Prehistoric/Bronze/Medieval (Epoch 0-2): mass foot armies march across the map
  // - Industrial (Epoch 3): still armies of individuals backed by early tanks, biplanes & airships
  // - Atomic (Epoch 4): mechanized combined arms; civilians defend home while warriors deploy
  // - Info Age+ (Epoch 5+): vehicles dominate the battlefield; only a small elite foot vanguard deploys outward
  const isInfoVanguard =
    (u.role === 'warrior' && indivHash % 4 === 0) || (u.species === 'orc' && indivHash % 3 === 0);
  const warMaxR =
    myEpoch >= 5
      ? isInfoVanguard
        ? u.species === 'orc'
          ? 28
          : 26
        : u.role === 'warrior'
          ? 16
          : u.isKing
            ? 14
            : 11
      : myEpoch === 4
        ? isWarriorOrKingOrOrc
          ? 30
          : 15
        : myEpoch === 3
          ? isWarriorOrKingOrOrc
            ? 46
            : 26
          : isWarriorOrKingOrOrc
            ? 52
            : 34;

  const considerEnemyCandidate = (other: UnitEntity, dSq: number) => {
    if (other.id === u.id || other.state === 'ko' || other.hp <= 0 || dSq >= enemyDistSq) return;
    const otherKingdomId =
      other.faction === 'civilization'
        ? idx
          ? idx.unitKingdomId.get(other.id)
          : other.settlementId
            ? getKingdomId(state, other.settlementId)
            : other.kingdomId
        : undefined;
    const isSameKingdom = Boolean(myKingdomId && otherKingdomId && myKingdomId === otherKingdomId);
    // Fast-path reject 95% of friendly neighbors in O(1) before any combat/beast checks
    if (isSameKingdom) return;
    const isDirectAttacker = (u.underAttackTimer ?? 0) > 0 && other.id === u.lastAttackerId;
    const isHostileRaider = other.faction === 'hostile';
    const isDangerousBeast =
      other.faction === 'wildlife' &&
      (other.role === 'leviathan' ||
        other.role === 'dragon' ||
        other.role === 'wolf' ||
        other.role === 'bear' ||
        (other.role === 'dinosaur' && isCarnivoreAnimal(other.role, other.appearanceSeed))) &&
      (isDirectAttacker ||
        other.state === 'fighting' ||
        dSq <= (other.role === 'leviathan' ? 14 * 14 : 6 * 6) ||
        ((u.role === 'warrior' || u.isKing) &&
          allOwnSettlementBlds.length > 0 &&
          (other.x - homeAnchor.x) ** 2 + (other.z - homeAnchor.z) ** 2 <= (other.role === 'leviathan' ? 24 * 24 : 16 * 16)));

    const isKingdomWar =
      !isChild &&
      warsEnabled &&
      other.faction === 'civilization' &&
      other.ageStage !== 'child' &&
      Boolean(
        myKingdomId &&
          otherKingdomId &&
          (warEnemiesSet ? warEnemiesSet.has(otherKingdomId) : areKingdomsAtWar(state, myKingdomId, otherKingdomId)),
      );

    // O(1) kin defense lookup (replaces O(N^3) state.units.some scan)
    const isAttackingKin =
      other.faction === 'civilization' &&
      other.state === 'fighting' &&
      dSq <= 14 * 14 &&
      (isKingdomWar ||
        Boolean(mySettlementAttackers?.has(other.id)) ||
        Boolean(myKingdomAttackers?.has(other.id)));

    const isRivalFrenzy = !isChild && Boolean(u.statusEffects.frenzied);

    if (
      !isDirectAttacker &&
      !isHostileRaider &&
      !isDangerousBeast &&
      !isKingdomWar &&
      !isAttackingKin &&
      !isRivalFrenzy
    ) {
      return;
    }

    const maxEngageSq =
      isDirectAttacker || isHostileRaider
        ? Infinity
        : isKingdomWar
          ? warMaxR * warMaxR
          : isAttackingKin || isDangerousBeast
            ? other.role === 'leviathan'
              ? 24 * 24
              : 20 * 20
            : isRivalFrenzy
              ? 144
              : 100;
    if (dSq <= maxEngageSq && dSq < enemyDistSq) {
      enemyDistSq = dSq;
      nearestEnemy = other;
    }
  };

  if (idx) {
    // 1. Direct attacker in O(1)
    if ((u.underAttackTimer ?? 0) > 0 && u.lastAttackerId) {
      const attacker = idx.unitsById.get(u.lastAttackerId);
      if (attacker) {
        considerEnemyCandidate(attacker, (attacker.x - u.x) ** 2 + (attacker.z - u.z) ** 2);
      }
    }
    // 2. Hostile raiders (small global bucket)
    for (let hi = 0; hi < idx.hostileUnits.length; hi++) {
      const hUnit = idx.hostileUnits[hi];
      considerEnemyCandidate(hUnit, (hUnit.x - u.x) ** 2 + (hUnit.z - u.z) ** 2);
    }
    // 3. Dangerous wildlife (small global bucket)
    for (let wi = 0; wi < idx.dangerousWildlife.length; wi++) {
      const wUnit = idx.dangerousWildlife[wi];
      considerEnemyCandidate(wUnit, (wUnit.x - u.x) ** 2 + (wUnit.z - u.z) ** 2);
    }
    // 4. Kin-defense attackers in O(K) directly from attacker ID sets (never scans friendly neighbors!)
    if (mySettlementAttackers && mySettlementAttackers.size > 0) {
      for (const attId of mySettlementAttackers) {
        const attUnit = idx.unitsById.get(attId);
        if (attUnit) {
          considerEnemyCandidate(attUnit, (attUnit.x - u.x) ** 2 + (attUnit.z - u.z) ** 2);
        }
      }
    }
    if (myKingdomAttackers && myKingdomAttackers.size > 0) {
      for (const attId of myKingdomAttackers) {
        const attUnit = idx.unitsById.get(attId);
        if (attUnit) {
          considerEnemyCandidate(attUnit, (attUnit.x - u.x) ** 2 + (attUnit.z - u.z) ** 2);
        }
      }
    }
    // 5. Active kingdom war enemies — O(1) cached target -> fast local spatial query -> staggered far-range scan
    if (!isChild && warsEnabled && warEnemiesSet && warEnemiesSet.size > 0) {
      if (u.targetEntityId) {
        const curTarget = idx.unitsById.get(u.targetEntityId);
        if (curTarget && curTarget.state !== 'ko' && curTarget.hp > 0) {
          considerEnemyCandidate(curTarget, (curTarget.x - u.x) ** 2 + (curTarget.z - u.z) ** 2);
        }
      }
      const tickNum = simTickCounterByState.get(state) ?? 0;
      const seed = u.appearanceSeed ?? 0;
      const localStrideMask = u.role === 'warrior' || u.state === 'fighting' ? 1 : 3;
      const localStrideHit = ((tickNum + seed) & localStrideMask) === 0;
      const farStrideHit = ((tickNum + seed) & 3) === 0;
      if (!nearestEnemy && localStrideHit) {
        // Fast local spatial search catches all nearby frontline enemies without scanning friendly neighbors every tick
        forEachUnitInRadius(idx, u.x, u.z, 13.5, considerEnemyCandidate);
      }
      if (!nearestEnemy && farStrideHit) {
        for (const enemyKid of warEnemiesSet) {
          const enemyUnits = idx.livingCivByKingdom.get(enemyKid);
          if (!enemyUnits) continue;
          // Sample-strided scan when enemy army is huge (>50 units) so lategame mega-wars stay O(1) per unit
          const step = enemyUnits.length > 50 ? 4 : 1;
          const offset = (tickNum + seed) % step;
          for (let ei = offset; ei < enemyUnits.length; ei += step) {
            const eUnit = enemyUnits[ei];
            considerEnemyCandidate(eUnit, (eUnit.x - u.x) ** 2 + (eUnit.z - u.z) ** 2);
          }
        }
      }
    }
    // 6. Local spatial scan ONLY for frenzied units (rare status effect)
    if (!isChild && u.statusEffects.frenzied) {
      forEachUnitInRadius(idx, u.x, u.z, 12.05, considerEnemyCandidate);
    }
  } else {
    for (const other of state.units) {
      considerEnemyCandidate(other, (other.x - u.x) ** 2 + (other.z - u.z) ** 2);
    }
  }
  nearestEnemy = nearestEnemy as UnitEntity | null;

  let speciesCombatMult = 1.0;
  if (u.species === 'orc') {
    speciesCombatMult = 1.48;
  } else if (u.species === 'elf') {
    speciesCombatMult = hasElfArcaneTech ? 1.38 : 1.18;
  } else if (u.species === 'dwarf') {
    speciesCombatMult = 1.22 + myEpoch * 0.06;
  } else if (u.species === 'lizardfolk') {
    speciesCombatMult = 1.18 + myEpoch * 0.07;
  } else if (u.species === 'human') {
    speciesCombatMult = hasHumanTechSupport ? 1.05 + myEpoch * 0.1 : 0.74;
  }
  const kingMult = u.isKing ? 1.35 : 1.0;

  if (!isChild && nearestEnemy) {
    const dist = Math.sqrt(enemyDistSq);
    const hasHumanGuns = u.species === 'human' && myEpoch >= 3;
    const hasElfGuns = u.species === 'elf' && myEpoch >= 3;
    const orcCanBattlewill =
      u.species === 'orc' && (myEpoch >= 4 || (myEpoch >= 3 && (u.role === 'warrior' || u.isKing)));

    const enemyTileCheck = getTile(state, Math.round(nearestEnemy.x), Math.round(nearestEnemy.z));
    const isNavalOrColossalTarget =
      nearestEnemy.role === 'leviathan' ||
      nearestEnemy.role === 'dragon' ||
      nearestEnemy.role === 'alien_walker' ||
      nearestEnemy.role === 'alien_ufo' ||
      Boolean(enemyTileCheck && enemyTileCheck.height === 0);

    const attackerEff = computeUnitEffectiveStats(u, def);
    const baseRange =
      u.species === 'human'
        ? hasHumanGuns
          ? Math.max(5.8, attackerEff.attackRange)
          : myEpoch >= 1
            ? Math.max(2.0, attackerEff.attackRange)
            : attackerEff.attackRange
        : u.species === 'elf'
          ? hasElfGuns
            ? Math.max(6.2, attackerEff.attackRange)
            : Math.max(4.2, attackerEff.attackRange)
          : u.species === 'dwarf'
            ? myEpoch >= 3
              ? Math.max(5.4, attackerEff.attackRange)
              : myEpoch >= 2
                ? Math.max(3.6, attackerEff.attackRange)
                : attackerEff.attackRange
            : u.species === 'lizardfolk'
              ? myEpoch >= 3
                ? Math.max(6.0, attackerEff.attackRange)
                : Math.max(4.0, attackerEff.attackRange)
              : (u.battlewillActive ?? 0) > 0 || (orcCanBattlewill && (u.battlewillCooldown ?? 0) <= 0)
                ? Math.max(4.2, attackerEff.attackRange)
                : Math.max(1.85, attackerEff.attackRange);
    const effectiveRange = isNavalOrColossalTarget ? Math.max(5.5, baseRange) : baseRange;

    if (dist <= effectiveRange) {
      u.state = 'fighting';
      u.attackTargetX = nearestEnemy.x;
      u.attackTargetZ = nearestEnemy.z;

      // Activate Orc Battlewill Avatar Extension (follows caster physically, NOT an autonomous summon!)
      if (orcCanBattlewill && (u.battlewillActive ?? 0) <= 0 && (u.battlewillCooldown ?? 0) <= 0) {
        u.battlewillActive = 9.0;
        u.battlewillCooldown = 14.0;
        u.battlewillHeading = Math.atan2(nearestEnemy.x - u.x, nearestEnemy.z - u.z);
      }

      if (u.actionCooldown <= 0) {
        u.actionCooldown =
          (u.statusEffects.frenzied ? 0.45 : u.species === 'elf' ? 0.68 : 0.78) /
          attackerEff.attackSpeedMult;
        u.attackAnimTimer = 0.45;

        const baseDmg =
          attackerEff.attackDamage *
          speciesCombatMult *
          kingMult *
          (u.statusEffects.frenzied ? 2.4 : 1.0);
        const enemyTile = getTile(state, nearestEnemy.x, nearestEnemy.z);
        const originY = (curTile?.height ?? 2) * 0.45 + 0.42;
        const targetY = (enemyTile?.height ?? 2) * 0.45 + 0.35;

        // Rivaling Racial Ultimate Weapons / Techniques:
        // Shared kingdom-wide ultimate cooldown (40s) + worthy-threat escalation prevents spam nuking lone soldiers!
        const kUltReady = !myKingdomId || (state.kingdomUltimateCooldowns?.[myKingdomId] ?? 0) <= 0;
        let nearbyEnemies = 0;
        let nearbyBossThreat = false;
        if (kUltReady && (u.weaponCooldown ?? 0) <= 0) {
          const checkUltNearby = (ce: UnitEntity, dSq: number) => {
            if (ce.state === 'ko' || ce.hp <= 0 || dSq > 25) return;
            const ceKid =
              ce.faction === 'civilization'
                ? idx
                  ? idx.unitKingdomId.get(ce.id)
                  : ce.settlementId
                    ? getKingdomId(state, ce.settlementId)
                    : ce.kingdomId
                : undefined;
            if (myKingdomId && ceKid === myKingdomId) return;
            if (
              ce.faction === 'hostile' ||
              ce.isKing ||
              (myKingdomId &&
                ceKid &&
                (warEnemiesSet ? warEnemiesSet.has(ceKid) : areKingdomsAtWar(state, myKingdomId, ceKid)))
            ) {
              nearbyEnemies++;
              if (ce.maxHp >= 180 || ce.role === 'leviathan' || Boolean(ce.isKing)) {
                nearbyBossThreat = true;
              }
              if (nearbyEnemies >= 3 && nearbyBossThreat) return true;
            }
          };
          if (idx) {
            forEachUnitInRadius(idx, nearestEnemy.x, nearestEnemy.z, 5.05, checkUltNearby);
          } else {
            for (const ce of state.units) {
              if (checkUltNearby(ce, (ce.x - nearestEnemy.x) ** 2 + (ce.z - nearestEnemy.z) ** 2)) break;
            }
          }
        }
        const worthyUltThreat =
          nearestEnemy.maxHp >= 180 ||
          nearestEnemy.role === 'leviathan' ||
          Boolean(nearestEnemy.isKing) ||
          nearestEnemy.faction === 'hostile' ||
          nearbyBossThreat ||
          nearbyEnemies >= 3;

        const triggerHumanNuke =
          kUltReady &&
          worthyUltThreat &&
          u.species === 'human' &&
          myEpoch >= 4 &&
          (u.weaponCooldown ?? 0) <= 0 &&
          (u.role === 'warrior' || u.isKing || dist > 2.2 || nearbyBossThreat || nearestEnemy.maxHp >= 180);
        const triggerElfCataclysm =
          kUltReady &&
          worthyUltThreat &&
          u.species === 'elf' &&
          myEpoch >= 4 &&
          (u.weaponCooldown ?? 0) <= 0 &&
          (u.role === 'warrior' || u.role === 'priest' || u.isKing || dist > 2.2 || nearbyBossThreat || nearestEnemy.maxHp >= 180);
        const triggerOrcBattlewillSlash =
          kUltReady &&
          worthyUltThreat &&
          u.species === 'orc' &&
          (u.battlewillActive ?? 0) > 0 &&
          (u.weaponCooldown ?? 0) <= 0;

        if (triggerHumanNuke) {
          u.weaponCooldown = 18.0;
          if (myKingdomId) {
            if (!state.kingdomUltimateCooldowns) state.kingdomUltimateCooldowns = {};
            state.kingdomUltimateCooldowns[myKingdomId] = 40.0;
          }
          const blastRadius = 6.8;
          const blastDmg = Math.max(240, baseDmg * 5.8);
          // Launch a visible incoming ballistic missile trail from the Human homeland/launcher so nukes never appear out of thin air
          let launchX = u.x;
          let launchZ = u.z;
          if (myKingdomId) {
            for (let bi = 0; bi < state.buildings.length; bi++) {
              const kb = state.buildings[bi];
              if (kb.hp > 0 && kb.settlementId && getKingdomId(state, kb.settlementId) === myKingdomId) {
                launchX = kb.tileX;
                launchZ = kb.tileZ;
                if (
                  kb.type === 'launch_arcology' ||
                  kb.type === 'fission_reactor' ||
                  kb.type === 'airport' ||
                  kb.type === 'steam_foundry'
                ) {
                  break;
                }
              }
            }
          }
          const launchDist = Math.hypot(nearestEnemy.x - launchX, nearestEnemy.z - launchZ);
          if (launchDist < 4) {
            launchX = Math.max(2, Math.min(state.gridSize - 3, u.x - (nearestEnemy.x - u.x) * 2.5));
            launchZ = Math.max(2, Math.min(state.gridSize - 3, u.z - (nearestEnemy.z - u.z) * 2.5));
          }
          const launchTile = getTile(state, launchX, launchZ);
          const launchY = (launchTile?.height ?? 2) * 0.45 + 0.5;
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'projectile_tracer',
            vfxSubtype: 'icbm_missile',
            species: 'human',
            originX: launchX,
            originY: launchY,
            originZ: launchZ,
            x: nearestEnemy.x,
            y: targetY,
            z: nearestEnemy.z,
            radius: 2.2,
            color: '#ff6b35',
            flightDuration: Math.max(0.75, Math.min(1.6, 0.55 + launchDist * 0.025)),
            createdAt: Date.now(),
          });
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'nuke_blast',
            x: nearestEnemy.x,
            y: targetY,
            z: nearestEnemy.z,
            originX: launchX,
            originY: launchY,
            originZ: launchZ,
            radius: blastRadius,
            color: '#ff9e00',
            createdAt: Date.now(),
          });
          applySuperweaponEnvironmentImpact(state, nearestEnemy.x, nearestEnemy.z, 6.4, 'nuke');
          for (const candidate of state.units) {
            if (candidate.state === 'ko' || candidate.hp <= 0 || candidate.statusEffects.shielded) continue;
            if (candidate.ageStage === 'child' && candidate.id !== nearestEnemy.id) continue;
            const cKid =
              candidate.faction === 'civilization'
                ? candidate.settlementId
                  ? getKingdomId(state, candidate.settlementId)
                  : candidate.kingdomId
                : undefined;
            if (candidate.id === u.id || (myKingdomId && cKid === myKingdomId)) continue;
            const candDist = Math.hypot(candidate.x - nearestEnemy.x, candidate.z - nearestEnemy.z);
            if (candDist <= blastRadius) {
              const dmgScale = candDist <= 3.8 ? 1.0 : 0.68;
              candidate.hp -= blastDmg * dmgScale;
              candidate.lastAttackerId = u.id;
              candidate.underAttackTimer = 8.0;
              if (candidate.hp <= 0) {
                u.kills = (u.kills ?? 0) + 1;
              } else {
                const safeDist = Math.max(0.35, candDist);
                candidate.vxAir = ((candidate.x - nearestEnemy.x) / safeDist) * 7.5;
                candidate.vzAir = ((candidate.z - nearestEnemy.z) / safeDist) * 7.5;
                candidate.altitude = Math.max(candidate.altitude ?? 0, 1.1);
                candidate.vzVertical = 7.2;
                candidate.fallDamageArmed = true;
              }
            }
          }
          for (const v of state.vehicles ?? []) {
            if ((v.hp ?? 0) <= 0) continue;
            const vKid = v.kingdomId ?? getKingdomId(state, v.settlementId);
            if (myKingdomId && vKid === myKingdomId) continue;
            if (Math.hypot(v.x - nearestEnemy.x, v.z - nearestEnemy.z) <= blastRadius) {
              v.hp = Math.max(0, (v.hp ?? 100) - blastDmg * 0.9);
            }
          }
          for (const b of state.buildings) {
            if (b.hp <= 0) continue;
            const bKid = b.settlementId ? getKingdomId(state, b.settlementId) : undefined;
            if (myKingdomId && bKid === myKingdomId) continue;
            const bDist = Math.hypot(b.tileX - nearestEnemy.x, b.tileZ - nearestEnemy.z);
            if (bDist <= 5.8) {
              if (b.shieldTimer > 0) {
                if (bDist <= 3.2) b.shieldTimer = 0;
                else continue;
              }
              b.hp = bDist <= 3.0 ? 0 : Math.max(0, b.hp - blastDmg * 1.45);
            }
          }
        } else if (triggerElfCataclysm) {
          u.weaponCooldown = 18.0;
          if (myKingdomId) {
            if (!state.kingdomUltimateCooldowns) state.kingdomUltimateCooldowns = {};
            state.kingdomUltimateCooldowns[myKingdomId] = 40.0;
          }
          const cataclysmRadius = 6.5;
          const arcaneDmg = Math.max(240, baseDmg * 5.8);
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'projectile_tracer',
            vfxSubtype: 'elf_starfall_spell',
            species: 'elf',
            x: nearestEnemy.x,
            y: targetY,
            z: nearestEnemy.z,
            originX: u.x,
            originY,
            originZ: u.z,
            radius: 2.4,
            color: '#c084fc',
            flightDuration: 0.9,
            createdAt: Date.now(),
          });
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'arcane_cataclysm',
            x: nearestEnemy.x,
            y: targetY,
            z: nearestEnemy.z,
            originX: u.x,
            originY,
            originZ: u.z,
            radius: cataclysmRadius,
            color: '#c084fc',
            createdAt: Date.now(),
          });
          applySuperweaponEnvironmentImpact(state, nearestEnemy.x, nearestEnemy.z, 6.0, 'arcane');
          for (const candidate of state.units) {
            if (candidate.state === 'ko' || candidate.hp <= 0) continue;
            const cKid =
              candidate.faction === 'civilization'
                ? candidate.settlementId
                  ? getKingdomId(state, candidate.settlementId)
                  : candidate.kingdomId
                : undefined;
            if (myKingdomId && cKid === myKingdomId) {
              if (Math.hypot(candidate.x - u.x, candidate.z - u.z) <= 5.0) {
                candidate.hp = Math.min(candidate.maxHp, candidate.hp + 40);
              }
              continue;
            }
            const candDist = Math.hypot(candidate.x - nearestEnemy.x, candidate.z - nearestEnemy.z);
            if (
              !candidate.statusEffects.shielded &&
              (candidate.ageStage !== 'child' || candidate.id === nearestEnemy.id) &&
              candDist <= cataclysmRadius
            ) {
              const dmgScale = candDist <= 3.8 ? 1.0 : 0.7;
              candidate.hp -= arcaneDmg * dmgScale;
              candidate.lastAttackerId = u.id;
              candidate.underAttackTimer = 8.0;
              if (candidate.hp <= 0) {
                u.kills = (u.kills ?? 0) + 1;
              } else {
                const safeDist = Math.max(0.35, candDist);
                candidate.vxAir = ((candidate.x - nearestEnemy.x) / safeDist) * 7.0;
                candidate.vzAir = ((candidate.z - nearestEnemy.z) / safeDist) * 7.0;
                candidate.altitude = Math.max(candidate.altitude ?? 0, 1.0);
                candidate.vzVertical = 6.8;
                candidate.fallDamageArmed = true;
              }
            }
          }
          for (const v of state.vehicles ?? []) {
            if ((v.hp ?? 0) <= 0) continue;
            const vKid = v.kingdomId ?? getKingdomId(state, v.settlementId);
            if (myKingdomId && vKid === myKingdomId) continue;
            if (Math.hypot(v.x - nearestEnemy.x, v.z - nearestEnemy.z) <= cataclysmRadius) {
              v.hp = Math.max(0, (v.hp ?? 100) - arcaneDmg * 0.9);
            }
          }
          for (const b of state.buildings) {
            if (b.hp <= 0) continue;
            const bKid = b.settlementId ? getKingdomId(state, b.settlementId) : undefined;
            if (myKingdomId && bKid === myKingdomId) continue;
            const bDist = Math.hypot(b.tileX - nearestEnemy.x, b.tileZ - nearestEnemy.z);
            if (bDist <= 5.6) {
              if (b.shieldTimer > 0) {
                if (bDist <= 3.0) b.shieldTimer = 0;
                else continue;
              }
              b.hp = bDist <= 2.8 ? 0 : Math.max(0, b.hp - arcaneDmg * 1.4);
            }
          }
        } else if (triggerOrcBattlewillSlash) {
          u.weaponCooldown = 16.0;
          if (myKingdomId) {
            if (!state.kingdomUltimateCooldowns) state.kingdomUltimateCooldowns = {};
            state.kingdomUltimateCooldowns[myKingdomId] = 40.0;
          }
          u.battlewillSlashTimer = 0.85;
          const slashHeading = Math.atan2(nearestEnemy.x - u.x, nearestEnemy.z - u.z);
          u.battlewillHeading = slashHeading;
          const cleaveRadius = 8.4;
          const cleaveDmg = Math.max(240, baseDmg * 5.8);
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'battlewill_slash',
            x: nearestEnemy.x,
            y: targetY,
            z: nearestEnemy.z,
            originX: u.x,
            originY,
            originZ: u.z,
            sourceUnitId: u.id,
            radius: cleaveRadius,
            color: '#ff3b30',
            createdAt: Date.now(),
          });
          applySuperweaponEnvironmentImpact(state, u.x, u.z, 8.2, 'battlewill', slashHeading);
          for (const candidate of state.units) {
            if (candidate.state === 'ko' || candidate.hp <= 0 || candidate.statusEffects.shielded) continue;
            if (candidate.ageStage === 'child' && candidate.id !== nearestEnemy.id) continue;
            const cKid =
              candidate.faction === 'civilization'
                ? candidate.settlementId
                  ? getKingdomId(state, candidate.settlementId)
                  : candidate.kingdomId
                : undefined;
            if (candidate.id === u.id || (myKingdomId && cKid === myKingdomId)) continue;
            const candDist = Math.hypot(candidate.x - u.x, candidate.z - u.z);
            const candAngDiff = Math.abs(wrapAngleRad(Math.atan2(candidate.x - u.x, candidate.z - u.z) - slashHeading));
            const inSlash = candDist <= 4.4 || (candDist <= cleaveRadius && candAngDiff <= 1.32);
            if (inSlash) {
              candidate.hp -= cleaveDmg;
              candidate.lastAttackerId = u.id;
              candidate.underAttackTimer = 8.0;
              if (candidate.hp <= 0) {
                u.kills = (u.kills ?? 0) + 1;
              } else {
                const safeDist = Math.max(0.35, candDist);
                candidate.vxAir = ((candidate.x - u.x) / safeDist) * 8.2;
                candidate.vzAir = ((candidate.z - u.z) / safeDist) * 8.2;
                candidate.altitude = Math.max(candidate.altitude ?? 0, 1.15);
                candidate.vzVertical = 7.4;
                candidate.fallDamageArmed = true;
              }
            }
          }
          for (const v of state.vehicles ?? []) {
            if ((v.hp ?? 0) <= 0) continue;
            const vKid = v.kingdomId ?? getKingdomId(state, v.settlementId);
            if (myKingdomId && vKid === myKingdomId) continue;
            if (Math.hypot(v.x - u.x, v.z - u.z) <= cleaveRadius) {
              v.hp = Math.max(0, (v.hp ?? 100) - cleaveDmg * 0.9);
            }
          }
          for (const b of state.buildings) {
            if (b.hp <= 0) continue;
            const bKid = b.settlementId ? getKingdomId(state, b.settlementId) : undefined;
            if (myKingdomId && bKid === myKingdomId) continue;
            const bDist = Math.hypot(b.tileX - u.x, b.tileZ - u.z);
            const bAngDiff = Math.abs(wrapAngleRad(Math.atan2(b.tileX - u.x, b.tileZ - u.z) - slashHeading));
            if (bDist <= 4.0 || (bDist <= 7.8 && bAngDiff <= 1.3)) {
              if (b.shieldTimer > 0) {
                if (bDist <= 3.2) b.shieldTimer = 0;
                else continue;
              }
              b.hp = bDist <= 3.0 ? 0 : Math.max(0, b.hp - cleaveDmg * 1.45);
            }
          }
        } else {
          // Multi-weapon Racial Arsenals across epochs so troops use rifles, launchers, spells & axes instead of ultimate spam
          const shotCycle = Math.abs(indivHash + Math.floor(state.year * 25 + (u.kills ?? 0)));
          let isRangedShot = false;
          let weaponSubtype: VisualEffectEvent['vfxSubtype'] = 'bullet';
          let weaponColor = '#ffd166';
          let weaponSplash = 0;

          const forceVerticalRanged =
            nearestEnemy.role === 'alien_ufo' || (isNavalOrColossalTarget && dist > 1.75);

          if (u.species === 'elf') {
            // Elves strictly weave magic & astral spells — NEVER steel missiles or gunpowder cannons
            if (u.statusEffects && !u.statusEffects.shielded && hasElfArcaneTech && shotCycle % 4 === 0) {
              u.statusEffects.shielded = 4.0;
            }
            isRangedShot = myEpoch >= 1 || dist > 1.5 || forceVerticalRanged;
            if (myEpoch >= 6) {
              weaponSubtype = shotCycle % 3 === 0 ? 'plasma_beam' : shotCycle % 3 === 1 ? 'elf_starfall_spell' : 'arcane_bolt';
              weaponColor = weaponSubtype === 'plasma_beam' ? '#56cfe1' : '#e879f9';
              weaponSplash = weaponSubtype === 'elf_starfall_spell' ? 2.15 : weaponSubtype === 'plasma_beam' ? 1.45 : 1.25;
            } else if (myEpoch >= 3) {
              weaponSubtype = shotCycle % 3 === 0 ? 'elf_starfall_spell' : shotCycle % 3 === 1 ? 'plasma_beam' : 'arcane_bolt';
              weaponColor = weaponSubtype === 'plasma_beam' ? '#38bdf8' : '#c084fc';
              weaponSplash = weaponSubtype === 'elf_starfall_spell' ? 1.9 : weaponSubtype === 'plasma_beam' ? 1.35 : 1.15;
            } else {
              weaponSubtype = shotCycle % 4 === 0 && myEpoch >= 2 ? 'elf_starfall_spell' : 'arcane_bolt';
              weaponColor = hasElfArcaneTech ? '#5eead4' : '#c084fc';
              weaponSplash = weaponSubtype === 'elf_starfall_spell' ? 1.55 : myEpoch >= 2 ? 1.05 : 0;
            }
          } else if (u.species === 'human') {
            isRangedShot = hasHumanGuns || (myEpoch >= 1 && dist > 1.6) || forceVerticalRanged;
            if (myEpoch >= 6) {
              weaponSubtype = shotCycle % 3 === 0 ? 'plasma_beam' : shotCycle % 3 === 1 ? 'missile' : 'cannon_shell';
              weaponColor = weaponSubtype === 'plasma_beam' ? '#56cfe1' : '#38bdf8';
              weaponSplash = weaponSubtype === 'missile' ? 2.15 : weaponSubtype === 'cannon_shell' ? 1.85 : 1.4;
            } else if (myEpoch >= 4) {
              weaponSubtype = shotCycle % 4 === 0 ? 'missile' : shotCycle % 4 === 1 ? 'cannon_shell' : 'bullet';
              weaponColor = weaponSubtype === 'missile' ? '#ff6b35' : '#ffd166';
              weaponSplash = weaponSubtype === 'missile' ? 2.0 : weaponSubtype === 'cannon_shell' ? 1.7 : 0;
            } else if (hasHumanGuns) {
              weaponSubtype = shotCycle % 4 === 0 ? 'cannon_shell' : 'bullet';
              weaponColor = '#ffd166';
              weaponSplash = weaponSubtype === 'cannon_shell' ? 1.55 : 0;
            } else {
              weaponSubtype = 'bullet';
              weaponColor = '#fca311';
            }
          } else if (u.species === 'dwarf') {
            // Dwarven arsenal: Heavy Runic Quake Mortars, forged artillery shells & golden forge-plasma beams
            isRangedShot = myEpoch >= 2 || dist > 1.75 || forceVerticalRanged;
            if (myEpoch >= 6) {
              weaponSubtype = shotCycle % 3 === 0 ? 'plasma_beam' : shotCycle % 3 === 1 ? 'dwarf_quake_mortar' : 'cannon_shell';
              weaponColor = weaponSubtype === 'plasma_beam' ? '#fbbf24' : '#f59e0b';
              weaponSplash = weaponSubtype === 'dwarf_quake_mortar' ? 2.25 : weaponSubtype === 'cannon_shell' ? 1.85 : 1.45;
            } else if (myEpoch >= 3) {
              weaponSubtype = shotCycle % 3 === 0 ? 'dwarf_quake_mortar' : shotCycle % 3 === 1 ? 'cannon_shell' : 'bullet';
              weaponColor = '#f59e0b';
              weaponSplash = weaponSubtype === 'dwarf_quake_mortar' ? 2.05 : weaponSubtype === 'cannon_shell' ? 1.7 : 0;
            } else {
              weaponSubtype = shotCycle % 3 === 0 ? 'dwarf_quake_mortar' : 'cannon_shell';
              weaponColor = '#d97706';
              weaponSplash = weaponSubtype === 'dwarf_quake_mortar' ? 1.7 : 1.35;
            }
          } else if (u.species === 'lizardfolk') {
            // Lizardfolk arsenal: Radiant Solar Prism Lances, emerald-jade arcane bolts & sun-gold beams
            isRangedShot = myEpoch >= 1 || dist > 1.6 || forceVerticalRanged;
            if (myEpoch >= 6) {
              weaponSubtype = shotCycle % 3 === 0 ? 'plasma_beam' : shotCycle % 3 === 1 ? 'lizard_solar_lance' : 'arcane_bolt';
              weaponColor = weaponSubtype === 'arcane_bolt' ? '#10b981' : '#facc15';
              weaponSplash = weaponSubtype === 'lizard_solar_lance' ? 2.15 : weaponSubtype === 'plasma_beam' ? 1.5 : 1.25;
            } else if (myEpoch >= 3) {
              weaponSubtype = shotCycle % 3 === 0 ? 'lizard_solar_lance' : shotCycle % 3 === 1 ? 'plasma_beam' : 'arcane_bolt';
              weaponColor = weaponSubtype === 'arcane_bolt' ? '#10b981' : '#facc15';
              weaponSplash = weaponSubtype === 'lizard_solar_lance' ? 1.95 : weaponSubtype === 'plasma_beam' ? 1.35 : 1.15;
            } else {
              weaponSubtype = shotCycle % 3 === 0 ? 'lizard_solar_lance' : 'arcane_bolt';
              weaponColor = weaponSubtype === 'lizard_solar_lance' ? '#facc15' : '#10b981';
              weaponSplash = weaponSubtype === 'lizard_solar_lance' ? 1.65 : myEpoch >= 2 ? 1.05 : 0;
            }
          } else {
            // Orc arsenal: Flaming siege boulders early -> chaotic WAAAGH! scrap-rockets & dakka later
            isRangedShot = myEpoch >= 3 || (myEpoch >= 2 && dist > 2.2) || forceVerticalRanged;
            if (myEpoch >= 5) {
              weaponSubtype = shotCycle % 3 === 0 ? 'orc_waagh_rocket' : shotCycle % 3 === 1 ? 'orc_siege_boulder' : 'plasma_beam';
              weaponColor = '#ff5400';
              weaponSplash = weaponSubtype === 'plasma_beam' ? 1.5 : 2.1;
            } else if (myEpoch >= 3) {
              weaponSubtype = shotCycle % 3 === 0 ? 'orc_waagh_rocket' : shotCycle % 3 === 1 ? 'orc_siege_boulder' : 'bullet';
              weaponColor = '#ff4d1a';
              weaponSplash = weaponSubtype !== 'bullet' ? 1.85 : 0;
            } else {
              weaponSubtype = 'orc_siege_boulder';
              weaponColor = '#ff3b30';
              weaponSplash = 1.55;
            }
          }

          if (isRangedShot) {
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'projectile_tracer',
              vfxSubtype: weaponSubtype,
              species: u.species,
              x: nearestEnemy.x,
              y: targetY,
              z: nearestEnemy.z,
              originX: u.x,
              originY,
              originZ: u.z,
              radius: weaponSplash > 0 ? Math.max(1.35, weaponSplash * 0.78) : 0.92,
              color: weaponColor,
              createdAt: Date.now(),
            });
          } else {
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'hit_spark',
              x: nearestEnemy.x,
              y: targetY,
              z: nearestEnemy.z,
              radius: (u.battlewillActive ?? 0) > 0 ? 1.35 : 0.85,
              color: u.species === 'orc' ? '#ff4d4d' : u.species === 'elf' ? '#5eead4' : '#fca311',
              createdAt: Date.now(),
            });
          }

          const isCrit = Math.random() * 100 < attackerEff.critChance;
          const strikeDmg =
            baseDmg *
            ((u.battlewillActive ?? 0) > 0 ? 1.55 : 1.0) *
            (weaponSplash > 0 ? 1.18 : 1.0) *
            (isCrit ? 1.65 : 1.0);
          if (!nearestEnemy.statusEffects.shielded) {
            const defEff = computeUnitEffectiveStats(nearestEnemy);
            const dealt = Math.max(1, strikeDmg * (1 - defEff.armor / 100));
            nearestEnemy.hp -= dealt;
            if (attackerEff.vampiric && u.hp > 0) {
              u.hp = Math.min(u.maxHp, u.hp + dealt * 0.2);
            }
            if (attackerEff.venomous) {
              nearestEnemy.statusEffects.plagued = Math.max(nearestEnemy.statusEffects.plagued ?? 0, 7.0);
            }
            if (!isRangedShot && defEff.thorns && !u.statusEffects.shielded) {
              u.hp -= Math.max(1, dealt * 0.25);
            }
          }
          nearestEnemy.lastAttackerId = u.id;
          nearestEnemy.underAttackTimer = 8.0;
          if (nearestEnemy.role === 'leviathan') {
            if (nearestEnemy.leviathanSubmerged) {
              addChronicle(
                state,
                `The Leviathan (${nearestEnemy.name}) was provoked by an attack and surfaced!`,
                'warning',
              );
            } else if (
              nearestEnemy.hp > 0 &&
              nearestEnemy.hp <= nearestEnemy.maxHp * 0.5 &&
              nearestEnemy.hp + strikeDmg > nearestEnemy.maxHp * 0.5
            ) {
              addChronicle(state, `The wounded Leviathan (${nearestEnemy.name}) went into a frenzy!`, 'warning');
            }
            nearestEnemy.leviathanSubmerged = false;
          }
          if (nearestEnemy.hp <= 0) {
            u.kills = (u.kills ?? 0) + 1;
            const claimSid =
              u.settlementId ??
              (myKingdomId ? resolvePrimarySettlementForKingdom(state, myKingdomId, nearestEnemy.x, nearestEnemy.z) : undefined);
            if (claimSid && myKingdomId) {
              claimTerritoryAround(state, nearestEnemy.x, nearestEnemy.z, 3.0, claimSid, myKingdomId, true);
            }
          }
          if (isRangedShot && weaponSplash > 0) {
            const unitCraterMode: 'explosive' | 'arcane' | 'orc' =
              u.species === 'elf' || u.species === 'lizardfolk'
                ? 'arcane'
                : u.species === 'orc' || u.species === 'dwarf'
                  ? 'orc'
                  : 'explosive';
            const heavyOrdnance =
              weaponSubtype === 'missile' ||
              weaponSubtype === 'cannon_shell' ||
              weaponSubtype === 'elf_starfall_spell' ||
              weaponSubtype === 'orc_waagh_rocket' ||
              weaponSubtype === 'orc_siege_boulder' ||
              weaponSubtype === 'dwarf_quake_mortar' ||
              weaponSubtype === 'lizard_solar_lance';
            applyWarfareAreaSplash(
              state,
              nearestEnemy.x,
              nearestEnemy.z,
              weaponSplash,
              strikeDmg,
              u.id,
              myKingdomId,
              u.species,
              unitCraterMode,
              {
                excludeUnitId: nearestEnemy.id,
                craterRadius: heavyOrdnance ? Math.min(1.65, weaponSplash * 0.78) : 0.95,
                knockback: heavyOrdnance,
                onUnitKill: () => {
                  u.kills = (u.kills ?? 0) + 1;
                },
              },
            );
          }
        }
      }
    } else {
      u.state = 'moving';
      u.targetX = nearestEnemy.x + personalOffsetX * 0.5;
      u.targetZ = nearestEnemy.z + personalOffsetZ * 0.5;
      const dx = (nearestEnemy.x - u.x) / dist;
      const dz = (nearestEnemy.z - u.z) / dist;
      advanceUnitPositionWithWaterRules(state, u, dx, dz, moveSpeed, dt, dist <= 8.0);
      const claimSid =
        u.settlementId ?? (myKingdomId ? resolvePrimarySettlementForKingdom(state, myKingdomId, u.x, u.z) : undefined);
      if (claimSid && myKingdomId) {
        claimTerritoryAround(state, u.x, u.z, 1.8, claimSid, myKingdomId, true);
      }
    }
    return;
  }

  // 1a. Attack, Annex & Capture Enemy Vehicles or Enemy Buildings belonging to Kingdoms at War!
  if (!isChild && (allOwnSettlementBlds.length > 0 || u.isRebel)) {
    if (state.vehicles && state.vehicles.length > 0) {
      let nearestEnemyVeh: VehicleEntity | null = null;
      let bestVehDistSq = Infinity;
      for (const ev of state.vehicles) {
        if ((ev.hp ?? 100) <= 0) continue;
        const vKid = ev.kingdomId ?? getKingdomId(state, ev.settlementId);
        if (myKingdomId && vKid && myKingdomId === vKid) continue;
        const atWarWithVeh = Boolean(
          warsEnabled && myKingdomId && vKid && areKingdomsAtWar(state, myKingdomId, vKid),
        );
        if (!atWarWithVeh && !u.statusEffects.frenzied) continue;
        const distToHomeSq = (ev.x - homeAnchor.x) ** 2 + (ev.z - homeAnchor.z) ** 2;
        const distToUnitSq = (ev.x - u.x) ** 2 + (ev.z - u.z) ** 2;
        if (distToHomeSq > 26 * 26 && distToUnitSq > 20 * 20 && !u.statusEffects.frenzied) continue;
        if (distToUnitSq < bestVehDistSq) {
          bestVehDistSq = distToUnitSq;
          nearestEnemyVeh = ev;
        }
      }

      if (nearestEnemyVeh) {
        const vDist = Math.sqrt(bestVehDistSq);
        const isShipVeh = nearestEnemyVeh.type === 'passenger_ship' || nearestEnemyVeh.type === 'warship';
        const antiVehRange =
          myEpoch >= 3 && u.species !== 'orc'
            ? 7.5
            : u.species === 'elf'
              ? 6.5
              : Math.max(isShipVeh ? 5.5 : 3.2, def.attackRange + 1.8);
        if (vDist <= antiVehRange) {
          u.state = 'fighting';
          if (u.actionCooldown <= 0) {
            u.actionCooldown = u.statusEffects.frenzied ? 0.45 : 0.72;
            const vehDmg =
              def.attackDamage *
              speciesCombatMult *
              kingMult *
              1.45 *
              (u.statusEffects.frenzied ? 2.0 : 1.0);
            nearestEnemyVeh.hp = Math.max(0, (nearestEnemyVeh.hp ?? 100) - vehDmg);
            const avSubtype: VisualEffectEvent['vfxSubtype'] =
              u.species === 'elf'
                ? myEpoch >= 3
                  ? 'elf_starfall_spell'
                  : 'arcane_bolt'
                : u.species === 'dwarf'
                  ? myEpoch >= 2
                    ? 'dwarf_quake_mortar'
                    : 'cannon_shell'
                  : u.species === 'lizardfolk'
                    ? myEpoch >= 2
                      ? 'lizard_solar_lance'
                      : 'arcane_bolt'
                    : u.species === 'orc'
                      ? myEpoch >= 3
                        ? 'orc_waagh_rocket'
                        : myEpoch >= 2
                          ? 'orc_siege_boulder'
                          : undefined
                      : myEpoch >= 4
                        ? 'missile'
                        : myEpoch >= 3
                          ? 'cannon_shell'
                          : undefined;
            const avSplash =
              avSubtype === 'missile' ||
              avSubtype === 'elf_starfall_spell' ||
              avSubtype === 'orc_waagh_rocket' ||
              avSubtype === 'dwarf_quake_mortar' ||
              avSubtype === 'lizard_solar_lance'
                ? 1.9
                : avSubtype === 'cannon_shell' || avSubtype === 'orc_siege_boulder'
                  ? 1.6
                  : avSubtype === 'arcane_bolt' && myEpoch >= 2
                    ? 1.1
                    : 0;
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: avSubtype ? 'projectile_tracer' : 'hit_spark',
              vfxSubtype: avSubtype,
              species: u.species,
              x: nearestEnemyVeh.x,
              y: (nearestEnemyVeh.y ?? 0.2) + 0.35,
              z: nearestEnemyVeh.z,
              originX: u.x,
              originY: (curTile?.height ?? 2) * 0.45 + 0.35,
              originZ: u.z,
              radius: avSplash > 0 ? Math.max(1.25, avSplash * 0.78) : 1.0,
              color:
                u.species === 'elf'
                  ? '#c084fc'
                  : u.species === 'orc'
                    ? '#ff4d1a'
                    : u.species === 'dwarf'
                      ? '#f59e0b'
                      : u.species === 'lizardfolk'
                        ? '#facc15'
                        : '#ff6b35',
              createdAt: Date.now(),
            });
            if (avSplash > 0) {
              applyWarfareAreaSplash(
                state,
                nearestEnemyVeh.x,
                nearestEnemyVeh.z,
                avSplash,
                vehDmg,
                u.id,
                myKingdomId,
                u.species,
                u.species === 'elf' || u.species === 'lizardfolk'
                  ? 'arcane'
                  : u.species === 'orc' || u.species === 'dwarf'
                    ? 'orc'
                    : 'explosive',
                {
                  excludeVehicleId: nearestEnemyVeh.id,
                  craterRadius: avSubtype === 'arcane_bolt' ? 0.95 : Math.min(1.55, avSplash * 0.76),
                  knockback: avSplash >= 1.6,
                },
              );
            }
          }
          return;
        } else if (vDist <= 14.0) {
          u.state = 'moving';
          u.targetX = nearestEnemyVeh.x;
          u.targetZ = nearestEnemyVeh.z;
          const dx = (nearestEnemyVeh.x - u.x) / Math.max(0.1, vDist);
          const dz = (nearestEnemyVeh.z - u.z) / Math.max(0.1, vDist);
          advanceUnitPositionWithWaterRules(state, u, dx, dz, moveSpeed, dt, vDist <= 7.0);
          return;
        }
      }
    }

    let nearestForeignBld: BuildingEntity | null = null;
    let bestForeignBldDistSq = Infinity;
    const isInvasionUnit =
      myEpoch >= 5
        ? isInfoVanguard
        : myEpoch === 4
          ? u.role === 'warrior' || u.species === 'orc'
          : myEpoch === 3
            ? u.role === 'warrior' || u.isKing || u.species === 'orc' || indivHash % 2 === 0
            : u.role === 'warrior' || u.isKing || u.species === 'orc' || indivHash % 3 !== 0;
    const bldInvasionMaxDist =
      myEpoch >= 5
        ? isInvasionUnit
          ? 32
          : 14
        : myEpoch === 4
          ? isInvasionUnit
            ? 40
            : 18
          : myEpoch === 3
            ? isInvasionUnit
              ? 76
              : 26
            : isInvasionUnit
              ? 96
              : 38;
    const maxSearchDistSq = bldInvasionMaxDist * bldInvasionMaxDist;
    for (const b of state.buildings) {
      if (b.hp <= 0) continue;
      const bKid = b.settlementId ? getKingdomId(state, b.settlementId) : undefined;
      if (myKingdomId && bKid && myKingdomId === bKid) continue;
      const atWarWithBld = Boolean(
        warsEnabled && myKingdomId && bKid && areKingdomsAtWar(state, myKingdomId, bKid),
      );
      if (!atWarWithBld && !u.statusEffects.frenzied) continue;
      const distToHomeSq = (b.tileX - homeAnchor.x) ** 2 + (b.tileZ - homeAnchor.z) ** 2;
      const distToUnitSq = (b.tileX - u.x) ** 2 + (b.tileZ - u.z) ** 2;
      const encroachingHome = distToHomeSq <= maxSearchDistSq || distToUnitSq <= maxSearchDistSq;
      if (!encroachingHome && !u.statusEffects.frenzied) continue;
      if (distToUnitSq < bestForeignBldDistSq) {
        bestForeignBldDistSq = distToUnitSq;
        nearestForeignBld = b;
      }
    }

    if (nearestForeignBld) {
      const bDist = Math.sqrt(bestForeignBldDistSq);
      const bTile = getTile(state, nearestForeignBld.tileX, nearestForeignBld.tileZ);
      const isFloatingBld = Boolean(bTile && bTile.height === 0);
      const effectiveRange =
        myEpoch >= 3 && u.species !== 'orc'
          ? 5.2
          : u.species === 'elf' || u.species === 'lizardfolk'
            ? Math.max(3.8, def.attackRange)
            : u.species === 'dwarf' && myEpoch >= 2
              ? Math.max(3.4, def.attackRange)
              : Math.max(isFloatingBld ? 4.2 : 1.6, def.attackRange);
      const claimSid =
        u.settlementId ??
        (myKingdomId ? resolvePrimarySettlementForKingdom(state, myKingdomId, nearestForeignBld.tileX, nearestForeignBld.tileZ) : undefined);
      if (bDist <= effectiveRange) {
        u.state = 'fighting';
        if (claimSid && myKingdomId) {
          claimTerritoryAround(state, u.x, u.z, 2.2, claimSid, myKingdomId, true);
        }
        if (u.actionCooldown <= 0) {
          u.actionCooldown = u.statusEffects.frenzied ? 0.45 : 0.75;
          const bldDmg =
            def.attackDamage *
            speciesCombatMult *
            kingMult *
            1.65 *
            (u.statusEffects.frenzied ? 2.2 : 1.0);
          if (nearestForeignBld.shieldTimer <= 0) {
            nearestForeignBld.hp = Math.max(0, nearestForeignBld.hp - bldDmg);
            // When an enemy building is conquered in war, annex its territory and capture/claim the structure for our kingdom!
            if (nearestForeignBld.hp <= 0 && claimSid && myKingdomId) {
              claimTerritoryAround(
                state,
                nearestForeignBld.tileX,
                nearestForeignBld.tileZ,
                4.8,
                claimSid,
                myKingdomId,
                true,
              );
              // Capture and occupy the conquered building into the attacker's settlement so the territory flips immediately
              nearestForeignBld.settlementId = claimSid;
              nearestForeignBld.species = u.species;
              nearestForeignBld.hp = Math.max(45, Math.round(nearestForeignBld.maxHp * 0.45));
              nearestForeignBld.constructionProgress = 100;
            }
          }
          const siegeSubtype: VisualEffectEvent['vfxSubtype'] =
            u.species === 'elf'
              ? myEpoch >= 3
                ? 'elf_starfall_spell'
                : 'arcane_bolt'
              : u.species === 'dwarf'
                ? myEpoch >= 2
                  ? 'dwarf_quake_mortar'
                  : 'cannon_shell'
                : u.species === 'lizardfolk'
                  ? myEpoch >= 2
                    ? 'lizard_solar_lance'
                    : 'arcane_bolt'
                  : u.species === 'orc'
                    ? myEpoch >= 3
                      ? 'orc_waagh_rocket'
                      : myEpoch >= 2
                        ? 'orc_siege_boulder'
                        : undefined
                    : myEpoch >= 4
                      ? 'missile'
                      : myEpoch >= 3
                        ? 'cannon_shell'
                        : undefined;
          const siegeSplash =
            siegeSubtype === 'missile' ||
            siegeSubtype === 'elf_starfall_spell' ||
            siegeSubtype === 'orc_waagh_rocket' ||
            siegeSubtype === 'dwarf_quake_mortar' ||
            siegeSubtype === 'lizard_solar_lance'
              ? 1.85
              : siegeSubtype === 'cannon_shell' || siegeSubtype === 'orc_siege_boulder'
                ? 1.55
                : siegeSubtype === 'arcane_bolt' && myEpoch >= 2
                  ? 1.05
                  : 0;
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: siegeSubtype ? 'projectile_tracer' : 'hit_spark',
            vfxSubtype: siegeSubtype,
            species: u.species,
            x: nearestForeignBld.tileX,
            y: (bTile?.height ?? 2) * 0.45 + 0.35,
            z: nearestForeignBld.tileZ,
            originX: siegeSubtype ? u.x : undefined,
            originY: siegeSubtype ? (curTile?.height ?? 2) * 0.45 + 0.35 : undefined,
            originZ: siegeSubtype ? u.z : undefined,
            radius: siegeSplash > 0 ? Math.max(1.25, siegeSplash * 0.78) : 0.9,
            color:
              u.species === 'elf'
                ? '#c084fc'
                : u.species === 'orc'
                  ? '#ff4d1a'
                  : u.species === 'dwarf'
                    ? '#f59e0b'
                    : u.species === 'lizardfolk'
                      ? '#facc15'
                      : '#ff6b35',
            createdAt: Date.now(),
          });
          if (siegeSplash > 0) {
            applyWarfareAreaSplash(
              state,
              nearestForeignBld.tileX,
              nearestForeignBld.tileZ,
              siegeSplash,
              bldDmg * 0.72,
              u.id,
              myKingdomId,
              u.species,
              u.species === 'elf' || u.species === 'lizardfolk'
                ? 'arcane'
                : u.species === 'orc' || u.species === 'dwarf'
                  ? 'orc'
                  : 'explosive',
              {
                excludeBuildingId: nearestForeignBld.id,
                craterRadius: siegeSubtype === 'arcane_bolt' ? 0.95 : Math.min(1.5, siegeSplash * 0.75),
                knockback: siegeSplash >= 1.55,
              },
            );
          }
        }
      } else {
        u.state = 'moving';
        u.targetX = nearestForeignBld.tileX + personalOffsetX;
        u.targetZ = nearestForeignBld.tileZ + personalOffsetZ;
        const dx = (u.targetX - u.x) / Math.max(0.1, bDist);
        const dz = (u.targetZ - u.z) / Math.max(0.1, bDist);
        advanceUnitPositionWithWaterRules(state, u, dx, dz, moveSpeed, dt, bDist <= 9.0);
        if (claimSid && myKingdomId) {
          claimTerritoryAround(state, u.x, u.z, 1.85, claimSid, myKingdomId, true);
        }
      }
      return;
    }
  }

  // Children stay playfully near their home settlement and forage nearby berries lightly (never fight or desert town)
  if (isChild) {
    const townBlds = allOwnSettlementBlds;
    if (nearestEnemy && enemyDistSq < 16 && townBlds.length > 0) {
      const safeBld = townBlds[0];
      const sx = safeBld.tileX - u.x;
      const sz = safeBld.tileZ - u.z;
      const sd = Math.hypot(sx, sz);
      if (sd > 0.6) {
        u.state = 'moving';
        u.targetX = safeBld.tileX;
        u.targetZ = safeBld.tileZ;
        advanceUnitPositionWithWaterRules(state, u, sx / sd, sz / sd, moveSpeed * 1.2, dt, false);
        return;
      }
    }
    const dxC = u.targetX - u.x;
    const dzC = u.targetZ - u.z;
    const dC = Math.hypot(dxC, dzC);
    if (u.actionCooldown <= 0 || dC <= 0.35) {
      u.actionCooldown = 1.4 + ((u.appearanceSeed ?? 1) % 3) * 0.4;
      if (townBlds.length > 0) {
        const pick = townBlds[Math.floor(Math.random() * townBlds.length)];
        u.targetX = Math.max(1, Math.min(state.gridSize - 2, pick.tileX + (Math.random() - 0.5) * 4.5));
        u.targetZ = Math.max(1, Math.min(state.gridSize - 2, pick.tileZ + (Math.random() - 0.5) * 4.5));
      } else {
        u.targetX = Math.max(1, Math.min(state.gridSize - 2, u.x + (Math.random() - 0.5) * 3.5));
        u.targetZ = Math.max(1, Math.min(state.gridSize - 2, u.z + (Math.random() - 0.5) * 3.5));
      }
    }
    const dxN = u.targetX - u.x;
    const dzN = u.targetZ - u.z;
    const dN = Math.hypot(dxN, dzN);
    if (dN > 0.35) {
      u.state = 'moving';
      advanceUnitPositionWithWaterRules(state, u, dxN / dN, dzN / dN, moveSpeed, dt, false);
    } else {
      u.state = 'idle';
    }
    return;
  }

  // 1b. Colonist expedition march to distant frontier site to found a brand-new city
  if (u.expeditionTargetX !== undefined && u.expeditionTargetZ !== undefined) {
    u.expeditionTimer = (u.expeditionTimer ?? 0) + dt;
    const edx = u.expeditionTargetX - u.x;
    const edz = u.expeditionTargetZ - u.z;
    const edist = Math.hypot(edx, edz);
    if (edist <= 1.6 || u.expeditionTimer > 45) {
      u.expeditionTargetX = undefined;
      u.expeditionTargetZ = undefined;
      u.expeditionTimer = undefined;
      u.state = 'idle';
    } else {
      u.state = 'moving';
      u.targetX = u.expeditionTargetX;
      u.targetZ = u.expeditionTargetZ;
      const expSpeed = moveSpeed * 1.15;
      advanceUnitPositionWithWaterRules(state, u, edx / edist, edz / edist, expSpeed, dt, edist <= 7.0);
      return;
    }
  }

  // 2. Priests & Elves heal/cleanse plagued or injured allies nearby
  if (u.role === 'priest' || (u.species === 'elf' && indivHash % 3 === 0)) {
    let healedAlly = false;
    const tryHealAlly = (ally: UnitEntity, dSq: number) => {
      if (
        ally.faction === 'civilization' &&
        ally.species === u.species &&
        ally.state !== 'ko' &&
        dSq <= 12 &&
        (ally.hp < ally.maxHp * 0.85 || ally.statusEffects.plagued || ally.statusEffects.cursed)
      ) {
        u.state = 'praying';
        ally.hp = Math.min(ally.maxHp, ally.hp + 15 * dt);
        delete ally.statusEffects.plagued;
        delete ally.statusEffects.cursed;
        healedAlly = true;
        return true;
      }
    };
    if (idx) {
      forEachUnitInRadius(idx, u.x, u.z, 3.5, tryHealAlly);
    } else {
      for (const ally of state.units) {
        if (tryHealAlly(ally, (ally.x - u.x) ** 2 + (ally.z - u.z) ** 2)) break;
      }
    }
    if (healedAlly) return;
  }

  const villageBuildings = allOwnSettlementBlds;

  // 3. Construct or repair unfinished buildings belonging to this citizen's settlement (O(1) slot lookup)
  const unfinished = villageBuildings.find((b) => {
    if (b.constructionProgress >= 100) return false;
    if (idx) {
      let buildersHere = idx.buildersByBuildingId.get(b.id) ?? 0;
      if (
        u.carryingAmount === 0 &&
        (u.state === 'building' || u.state === 'moving') &&
        (u.targetX - b.tileX) ** 2 + (u.targetZ - b.tileZ) ** 2 <= 1.44 &&
        buildersHere > 0
      ) {
        buildersHere--;
      }
      return buildersHere < 2;
    }
    const buildersHere = state.units.filter(
      (other) =>
        other.id !== u.id &&
        other.settlementId === u.settlementId &&
        other.state !== 'ko' &&
        other.ageStage !== 'child' &&
        other.carryingAmount === 0 &&
        (other.state === 'building' || other.state === 'moving') &&
        Math.hypot(other.targetX - b.tileX, other.targetZ - b.tileZ) <= 1.2,
    ).length;
    return buildersHere < 2;
  });

  const isBuilderInclined =
    u.role === 'builder' ||
    villageBuildings.length <= 1 ||
    indivHash % 3 === 0 ||
    (unfinished && Math.hypot(unfinished.tileX - u.x, unfinished.tileZ - u.z) <= 8);

  if (unfinished && u.carryingAmount === 0 && isBuilderInclined) {
    const wasTargetingThis =
      (u.state === 'building' || u.state === 'moving') &&
      (u.targetX - unfinished.tileX) ** 2 + (u.targetZ - unfinished.tileZ) ** 2 <= 1.44;
    if (idx && !wasTargetingThis) {
      idx.buildersByBuildingId.set(unfinished.id, (idx.buildersByBuildingId.get(unfinished.id) ?? 0) + 1);
    }
    const destX = unfinished.tileX + personalOffsetX;
    const destZ = unfinished.tileZ + personalOffsetZ;
    const dx = destX - u.x;
    const dz = destZ - u.z;
    const dist = Math.hypot(dx, dz);
    u.targetX = destX;
    u.targetZ = destZ;
    if (dist > 1.05) {
      u.state = 'moving';
      advanceUnitPositionWithWaterRules(state, u, dx / dist, dz / dist, moveSpeed, dt, dist <= 4.5);
    } else {
      u.state = 'building';
      const speciesBuildBase =
        u.species === 'dwarf'
          ? 26
          : u.species === 'human'
            ? 24
            : u.species === 'lizardfolk'
              ? 21
              : u.species === 'elf'
                ? 19
                : state.sandboxFreeMode
                  ? 26
                  : 14;
      const buildSpeed =
        (u.role === 'builder' ? 28 : speciesBuildBase) *
        (unfinished.type === 'bonfire' ? 1.8 : 1.0) *
        (u.statusEffects.blessed ? 1.6 : 1.0);
      unfinished.constructionProgress = Math.min(100, unfinished.constructionProgress + buildSpeed * dt);
      unfinished.hp = Math.min(unfinished.maxHp, unfinished.hp + 14 * dt);
      if (unfinished.constructionProgress >= 100) {
        const bDef = BUILDINGS.find((d) => d.type === unfinished.type);
        const tile = getTile(state, unfinished.tileX, unfinished.tileZ);
        state.pendingVfx.push({
          id: nextEntityId('vfx'),
          type: 'build_complete',
          x: unfinished.tileX,
          y: (tile?.height ?? 2) * 0.45,
          z: unfinished.tileZ,
          radius: 1.5,
          color: '#f5b742',
          createdAt: Date.now(),
        });
        const vName = (unfinished.settlementId && state.settlementNames?.[unfinished.settlementId]) || 'Settlement';
        addChronicle(
          state,
          `${vName} completed ${bDef?.name ?? unfinished.type} at (${unfinished.tileX}, ${unfinished.tileZ}).`,
          'build',
        );
        recalculateRatesAndCaps(state);
      }
    }
    return;
  }

  // 3b. Builders and mason-inclined villagers upgrade older-epoch buildings (O(1) slot lookup)
  const upgradeTarget = villageBuildings.find((b) => {
    if (b.constructionProgress < 100 || b.epochLevel >= unitEpoch) return false;
    if (idx) {
      let upgradersHere = idx.upgradersByBuildingId.get(b.id) ?? 0;
      if (
        u.carryingAmount === 0 &&
        (u.state === 'building' || u.state === 'moving') &&
        (u.targetX - b.tileX) ** 2 + (u.targetZ - b.tileZ) ** 2 <= 1.44 &&
        upgradersHere > 0
      ) {
        upgradersHere--;
      }
      return upgradersHere < 1;
    }
    const upgradersHere = state.units.filter(
      (other) =>
        other.id !== u.id &&
        other.settlementId === u.settlementId &&
        other.state !== 'ko' &&
        other.ageStage !== 'child' &&
        other.carryingAmount === 0 &&
        (other.state === 'building' || other.state === 'moving') &&
        Math.hypot(other.targetX - b.tileX, other.targetZ - b.tileZ) <= 1.2,
    ).length;
    return upgradersHere < 1;
  });
  if (
    upgradeTarget &&
    u.carryingAmount === 0 &&
    (u.role === 'builder' || (u.role === 'villager' && indivHash % 4 === 0))
  ) {
    const destX = upgradeTarget.tileX + personalOffsetX;
    const destZ = upgradeTarget.tileZ + personalOffsetZ;
    const dx = destX - u.x;
    const dz = destZ - u.z;
    const dist = Math.hypot(dx, dz);
    u.targetX = destX;
    u.targetZ = destZ;
    if (dist > 1.05) {
      u.state = 'moving';
      advanceUnitPositionWithWaterRules(state, u, dx / dist, dz / dist, moveSpeed, dt, dist <= 4.5);
    } else {
      u.state = 'building';
      const speciesUpgMult =
        u.species === 'dwarf'
          ? 1.25
          : u.species === 'human'
            ? 1.2
            : u.species === 'lizardfolk'
              ? 0.95
              : u.species === 'elf'
                ? 0.8
                : 0.35;
      const upgSpeed = (u.role === 'builder' ? 13 : 9) * speciesUpgMult * (u.statusEffects.blessed ? 1.5 : 1.0);
      upgradeTarget.upgradeProgress = (upgradeTarget.upgradeProgress ?? 0) + upgSpeed * dt;
      upgradeTarget.hp = Math.min(upgradeTarget.maxHp, upgradeTarget.hp + 12 * dt);
    }
    return;
  }

  const depositKid = myKingdomId ?? u.kingdomId;

  // 4. Hauling harvested resources back to OWN settlement storage
  const carryCap = u.role === 'forager' || u.role === 'miner' ? 12 : 8;
  if (u.carryingAmount >= carryCap && u.carryingType) {
    const dropoff = findNearestDropoffBuilding(state, u.x, u.z, u.settlementId);
    if (dropoff) {
      const destX = dropoff.tileX + personalOffsetX * 0.7;
      const destZ = dropoff.tileZ + personalOffsetZ * 0.7;
      const dx = destX - u.x;
      const dz = destZ - u.z;
      const dist = Math.hypot(dx, dz);
      u.targetX = destX;
      u.targetZ = destZ;
      if (dist > 1.1) {
        u.state = 'moving';
        advanceUnitPositionWithWaterRules(state, u, dx / dist, dz / dist, moveSpeed, dt, true);
      } else {
        recordHarvestDeposit(state, u.carryingType, u.carryingAmount, depositKid);
        u.carryingAmount = 0;
        u.carryingType = null;
        u.actionCooldown = 0.25 + (indivHash % 5) * 0.1;
        u.state = 'idle';
      }
      return;
    }
  }

  // 5. Dedicated Sanctum / Research / Engineering duties within OWN settlement
  if ((u.role === 'priest' || u.role === 'scholar' || u.role === 'astro_engineer') && villageBuildings.length > 0) {
    const targetBld =
      villageBuildings.find((b) =>
        u.role === 'priest'
          ? b.type === 'shaman_totem' || b.type === 'ziggurat'
          : u.role === 'scholar'
            ? b.type === 'observatory' || b.type === 'cyber_institute' || b.type === 'shaman_totem'
            : b.type === 'launch_arcology' || b.type === 'dyson_spire' || b.type === 'fission_reactor',
      ) ?? findNearestDropoffBuilding(state, u.x, u.z, u.settlementId);

    if (targetBld) {
      const destX = targetBld.tileX + personalOffsetX;
      const destZ = targetBld.tileZ + personalOffsetZ;
      const dx = destX - u.x;
      const dz = destZ - u.z;
      const dist = Math.hypot(dx, dz);
      u.targetX = destX;
      u.targetZ = destZ;
      if (dist > 1.35) {
        u.state = 'moving';
        advanceUnitPositionWithWaterRules(state, u, dx / dist, dz / dist, moveSpeed, dt, false);
      } else {
        u.state = u.role === 'priest' ? 'praying' : 'researching';
        const researchPace =
          u.species === 'human'
            ? 1.15
            : u.species === 'lizardfolk'
              ? 1.1
              : u.species === 'dwarf'
                ? 1.05
                : u.species === 'elf'
                  ? 1.0
                  : 0.35;
        u.harvestTimer = (u.harvestTimer ?? 0) + dt * researchPace * (u.statusEffects.blessed ? 1.7 : 1.0);
        if (u.harvestTimer >= 1.2) {
          u.harvestTimer -= 1.2;
          if (u.role === 'priest') {
            recordHarvestDeposit(state, 'faith', u.species === 'elf' ? 3.2 : 2.2, depositKid);
          } else if (u.role === 'scholar') {
            recordHarvestDeposit(state, 'knowledge', 2.4 + unitEpoch * 0.7, depositKid);
          } else {
            recordHarvestDeposit(state, 'energy', 2.8, depositKid);
            recordHarvestDeposit(state, 'alloy', 1.8, depositKid);
            recordHarvestDeposit(state, 'knowledge', 1.5, depositKid);
          }
        }
      }
      return;
    }
  }

  // 6. Real Gathering Loop (Chopping trees, foraging berries, mining stone/ore/crystals, salvaging sea scrap/coral/atlantis)
  const dxT = u.targetX - u.x;
  const dzT = u.targetZ - u.z;
  const distToTarget = Math.hypot(dxT, dzT);
  const targetTile = getTile(state, Math.round(u.targetX), Math.round(u.targetZ));

  if (
    targetTile &&
    targetTile.resourceNode !== 'none' &&
    targetTile.resourceAmount > 0 &&
    (targetTile.coralBleachTimer ?? 0) <= 0 &&
    !(targetTile.farmSettlementId && targetTile.farmPlotKind === 'wheat' && (targetTile.cropStage ?? 3) < 3)
  ) {
    if (distToTarget > 0.95) {
      u.state = 'moving';
      advanceUnitPositionWithWaterRules(
        state,
        u,
        dxT / distToTarget,
        dzT / distToTarget,
        moveSpeed,
        dt,
        distToTarget <= 4.5 || state.worldTemplate === 'scrap_sea',
      );
    } else {
      u.state = 'gathering';
      const hasHelperHere = idx
        ? hasGatheringHelperNear(idx, targetTile.x, targetTile.z, u.id)
        : state.units.some(
            (other) =>
              other.id !== u.id &&
              other.faction === 'civilization' &&
              other.state === 'gathering' &&
              Math.hypot(other.x - targetTile.x, other.z - targetTile.z) <= 1.5,
          );
      const coopMult = hasHelperHere ? 1.35 : 1.0;
      const harvestEff = computeUnitEffectiveStats(u, def);
      const workMult =
        (def.harvestRate / 6) *
        harvestEff.harvestMult *
        coopMult *
        (u.statusEffects.blessed ? 1.75 : 1.0) *
        (u.statusEffects.cursed ? 0.5 : 1.0);
      u.harvestTimer = (u.harvestTimer ?? 0) + dt * workMult;
      if (u.harvestTimer >= 0.8) {
        u.harvestTimer -= 0.8;
        const isCultivatedCrop = Boolean(targetTile.farmSettlementId && targetTile.farmPlotKind === 'wheat');
        const windmillBonus =
          isCultivatedCrop && getSettlementEpoch(state, targetTile.farmSettlementId!) >= 1 ? 1.25 : 1.0;
        const baseTake = Math.round((8 + def.harvestRate * harvestEff.harvestMult * 0.5) * windmillBonus);
        const take = Math.min(targetTile.resourceAmount, baseTake);
        targetTile.resourceAmount -= take;

        const yieldType: keyof Resources =
          targetTile.resourceNode === 'timber_grove'
            ? 'wood'
            : targetTile.resourceNode === 'berry_bush' || targetTile.resourceNode === 'coral_reef'
              ? 'food'
              : targetTile.resourceNode === 'stone_outcrop'
                ? 'stone'
                : targetTile.resourceNode === 'ore_vein'
                  ? 'ore'
                  : targetTile.resourceNode === 'scrap_flotsam'
                    ? (indivHash % 3 === 0 ? 'wood' : indivHash % 3 === 1 ? 'stone' : 'ore')
                    : targetTile.resourceNode === 'atlantis_ruin'
                      ? 'knowledge'
                      : unitEpoch >= 4
                        ? 'energy'
                        : 'knowledge';

        if (!u.carryingType || u.carryingType === yieldType) {
          u.carryingType = yieldType;
          u.carryingAmount += take;
        } else {
          recordHarvestDeposit(state, u.carryingType, u.carryingAmount, depositKid);
          u.carryingType = yieldType;
          u.carryingAmount = take;
        }

        if (targetTile.resourceAmount <= 0) {
          const oldNode = targetTile.resourceNode;
          if (oldNode === 'coral_reef') {
            targetTile.resourceNode = 'coral_reef';
            targetTile.resourceAmount = 0;
            targetTile.coralBleachTimer = 26;
          } else if (isCultivatedCrop) {
            // Re-seed cultivated farm field back to Stage 0 so it visibly regrows through all 4 phases!
            targetTile.resourceNode = 'berry_bush';
            targetTile.cropStage = 0;
            targetTile.cropGrowth = 0;
            targetTile.resourceAmount = 160;
          } else {
            targetTile.resourceNode = 'none';
            targetTile.resourceAmount = 0;
          }

          if (oldNode === 'timber_grove' && targetTile.terrain === 'forest') {
            targetTile.terrain = 'grass';
          } else if ((oldNode === 'stone_outcrop' || oldNode === 'ore_vein') && targetTile.terrain === 'rock') {
            targetTile.terrain = 'highland';
          }

          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'hit_spark',
            x: targetTile.x,
            y: targetTile.height * 0.45,
            z: targetTile.z,
            radius: 0.9,
            color:
              oldNode === 'timber_grove'
                ? '#7a5032'
                : oldNode === 'berry_bush'
                  ? '#7ec88b'
                  : oldNode === 'coral_reef'
                    ? '#94a3b8'
                    : '#b0a99f',
            createdAt: Date.now(),
          });
        }
      }
    }
    return;
  }

  // 7. Pick next individual task: help a nearby ally cut a tree, gather according to personal specialty, or patrol town
  if (u.actionCooldown <= 0) {
    u.actionCooldown = 0.65 + (indivHash % 5) * 0.15;

    if (indivHash % 2 === 0 && u.role !== 'warrior') {
      const settlementGatherers =
        idx && u.settlementId ? idx.gatheringBySettlement.get(u.settlementId) ?? [] : state.units;
      let allyChopping: UnitEntity | undefined;
      for (let gi = 0; gi < settlementGatherers.length; gi++) {
        const other = settlementGatherers[gi];
        if (
          other.id === u.id ||
          other.settlementId !== u.settlementId ||
          other.state !== 'gathering'
        ) {
          continue;
        }
        const dSq = (other.x - u.x) ** 2 + (other.z - u.z) ** 2;
        if (dSq > 121) continue;
        const otX = Math.round(other.targetX);
        const otZ = Math.round(other.targetZ);
        const ot = getTile(state, otX, otZ);
        if (
          !ot ||
          (ot.resourceNode !== 'timber_grove' &&
            ot.resourceNode !== 'stone_outcrop' &&
            ot.resourceNode !== 'ore_vein' &&
            ot.resourceNode !== 'scrap_flotsam')
        ) {
          continue;
        }
        let helpersAlready: number;
        if (idx) {
          const otKey = ot.z * state.gridSize + ot.x;
          helpersAlready = idx.gatherersByTileKey.get(otKey) ?? 0;
          if (Math.round(u.targetX) === ot.x && Math.round(u.targetZ) === ot.z && helpersAlready > 0) {
            helpersAlready--;
          }
        } else {
          helpersAlready = state.units.filter(
            (w) =>
              w.id !== u.id &&
              w.state !== 'ko' &&
              Math.hypot(w.targetX - ot.x, w.targetZ - ot.z) <= 1.2,
          ).length;
        }
        if (helpersAlready === 1) {
          allyChopping = other;
          break;
        }
      }

      if (allyChopping) {
        const otX = Math.round(allyChopping.targetX);
        const otZ = Math.round(allyChopping.targetZ);
        if (idx) {
          const otKey = otZ * state.gridSize + otX;
          idx.gatherersByTileKey.set(otKey, (idx.gatherersByTileKey.get(otKey) ?? 0) + 1);
        }
        u.targetX = otX + personalOffsetX;
        u.targetZ = otZ + personalOffsetZ;
        u.state = 'moving';
        return;
      }
    }

    const ownSettlementPop = sInfo
      ? sInfo.population
      : state.units.filter(
          (other) => other.faction === 'civilization' && other.state !== 'ko' && other.settlementId === u.settlementId,
        ).length;

    const kStock = depositKid ? ensureKingdomResources(state, depositKid) : state.resources;
    let preferred: TileData['resourceNode'][];
    if (u.role === 'forager') {
      preferred =
        kStock.food <= kStock.wood
          ? ['berry_bush', 'coral_reef', 'timber_grove', 'scrap_flotsam']
          : ['timber_grove', 'scrap_flotsam', 'berry_bush', 'coral_reef'];
    } else if (u.role === 'miner') {
      preferred =
        kStock.ore < kStock.stone
          ? ['ore_vein', 'scrap_flotsam', 'stone_outcrop', 'crystal_monolith', 'atlantis_ruin']
          : ['stone_outcrop', 'scrap_flotsam', 'ore_vein', 'crystal_monolith', 'atlantis_ruin'];
    } else {
      const vocation = indivHash % 5;
      const foodBufferTarget = ownSettlementPop < getMaxCityPopulation(state.gridSize) ? 40 : 20;
      if (kStock.food < foodBufferTarget) {
        preferred = ['berry_bush', 'coral_reef', 'timber_grove', 'scrap_flotsam', 'stone_outcrop'];
      } else if (kStock.wood < 25 || villageBuildings.length <= 1) {
        preferred = ['timber_grove', 'scrap_flotsam', 'berry_bush', 'coral_reef', 'stone_outcrop'];
      } else if (kStock.stone < 22) {
        preferred = ['stone_outcrop', 'ore_vein', 'timber_grove', 'berry_bush'];
      } else if (vocation === 0) {
        preferred = ['timber_grove', 'scrap_flotsam', 'berry_bush', 'stone_outcrop', 'ore_vein'];
      } else if (vocation === 1) {
        preferred = ['berry_bush', 'coral_reef', 'timber_grove', 'scrap_flotsam', 'stone_outcrop'];
      } else if (vocation === 2) {
        preferred = ['stone_outcrop', 'scrap_flotsam', 'timber_grove', 'ore_vein', 'berry_bush'];
      } else if (vocation === 3) {
        preferred = ['ore_vein', 'scrap_flotsam', 'stone_outcrop', 'crystal_monolith', 'atlantis_ruin'];
      } else {
        const pairs: [TileData['resourceNode'], number][] = [
          ['berry_bush', kStock.food],
          ['timber_grove', kStock.wood],
          ['stone_outcrop', kStock.stone],
          ['ore_vein', kStock.ore + (unitEpoch === 0 ? 40 : 0)],
          ['scrap_flotsam', Math.min(kStock.wood, kStock.stone)],
          ['coral_reef', kStock.food],
        ];
        pairs.sort((a, b) => a[1] - b[1]);
        preferred = pairs.map((p) => p[0]);
      }
    }

    const shouldPatrolTown =
      ((u.isKing && ownSettlementPop >= 4) || u.role === 'warrior' || (indivHash + Math.floor(state.year * 10)) % 8 === 0) &&
      villageBuildings.length >= 2;

    if (!shouldPatrolTown) {
      const nodeTile = findNearestResourceTile(state, u.x, u.z, preferred, u);
      if (nodeTile) {
        u.targetX = nodeTile.x + personalOffsetX;
        u.targetZ = nodeTile.z + personalOffsetZ;
        u.state = 'moving';
        return;
      }
    }

    // Patrol or march out to claim frontier territory (race's main goal: expand & claim as much territory as possible!)
    const claimSid =
      u.settlementId ?? (myKingdomId ? resolvePrimarySettlementForKingdom(state, myKingdomId, u.x, u.z) : undefined);
    const hasActiveWarEnemy = Boolean(warEnemiesSet && warEnemiesSet.size > 0);
    if (claimSid && myKingdomId) {
      claimTerritoryAround(state, u.x, u.z, hasActiveWarEnemy ? 2.2 : 1.75, claimSid, myKingdomId, hasActiveWarEnemy);
    }

    if (villageBuildings.length > 0) {
      const b = villageBuildings[(indivHash + Math.floor(Math.random() * villageBuildings.length)) % villageBuildings.length];
      const expandRadius = u.role === 'warrior' || shouldPatrolTown ? 11 : 6.5;
      u.targetX = Math.max(2, Math.min(state.gridSize - 3, b.tileX + (Math.random() - 0.5) * expandRadius * 2));
      u.targetZ = Math.max(2, Math.min(state.gridSize - 3, b.tileZ + (Math.random() - 0.5) * expandRadius * 2));
    } else {
      u.targetX = Math.max(2, Math.min(state.gridSize - 3, u.x + (Math.random() - 0.5) * 6));
      u.targetZ = Math.max(2, Math.min(state.gridSize - 3, u.z + (Math.random() - 0.5) * 6));
    }
  } else if (distToTarget > 0.35) {
    u.state = 'moving';
    advanceUnitPositionWithWaterRules(state, u, dxT / distToTarget, dzT / distToTarget, moveSpeed, dt, false);
    const claimSid =
      u.settlementId ?? (myKingdomId ? resolvePrimarySettlementForKingdom(state, myKingdomId, u.x, u.z) : undefined);
    const hasActiveWarEnemy = Boolean(warEnemiesSet && warEnemiesSet.size > 0);
    const moveTick = simTickCounterByState.get(state) ?? 0;
    if (claimSid && myKingdomId && ((moveTick + indivHash) & 3) === 0 && (u.role === 'warrior' || hasActiveWarEnemy || indivHash % 3 === 0)) {
      claimTerritoryAround(state, u.x, u.z, hasActiveWarEnemy ? 2.0 : 1.5, claimSid, myKingdomId, hasActiveWarEnemy);
    }
  } else {
    u.state = 'idle';
  }
}

export function beginDragUnit(state: SimulationState, unitId: string): UnitEntity | null {
  const unit = state.units.find((u) => u.id === unitId && u.state !== 'ko');
  if (!unit) return null;
  unit.draggedByPlayer = true;
  unit.dragTargetX = unit.x;
  unit.dragTargetZ = unit.z;
  unit.dragTargetAltitude = Math.max(unit.altitude ?? 0, 2.4);
  unit.vxAir = 0;
  unit.vzAir = 0;
  unit.vzVertical = 0;
  unit.altitude = Math.max(unit.altitude ?? 0, 1.8);
  unit.fallDamageArmed = false;
  unit.dragFlingNonLethal = false;
  unit.state = 'idle';
  return unit;
}

export function updateDragUnit(
  state: SimulationState,
  unitId: string,
  worldX: number,
  worldZ: number,
  altitude = 2.6,
): UnitEntity | null {
  const unit = state.units.find((u) => u.id === unitId && u.state !== 'ko');
  if (!unit) return null;
  const maxCoord = state.gridSize - 2;
  unit.draggedByPlayer = true;
  unit.dragTargetX = Math.max(1, Math.min(maxCoord, worldX));
  unit.dragTargetZ = Math.max(1, Math.min(maxCoord, worldZ));
  unit.dragTargetAltitude = Math.max(1.2, altitude);
  unit.vzVertical = 0;
  unit.fallDamageArmed = false;
  return unit;
}

export function stepDraggedUnitKinematics(state: SimulationState, realDt: number): void {
  const stepDt = Math.min(0.08, Math.max(0.001, realDt));
  const maxCoord = state.gridSize - 2;
  for (let i = 0; i < state.units.length; i++) {
    const u = state.units[i];
    if (!u.draggedByPlayer || u.state === 'ko') continue;
    const tx = u.dragTargetX ?? u.x;
    const tz = u.dragTargetZ ?? u.z;
    const tAlt = u.dragTargetAltitude ?? 2.6;

    // Weight-scaled physical drag lag so entities feel noticeably heavier & trailed by telekinesis
    const followRate =
      u.role === 'dragon' ||
      u.role === 'dinosaur' ||
      u.role === 'bear' ||
      u.role === 'polar_bear' ||
      u.role === 'elephant' ||
      u.role === 'rhino' ||
      u.role === 'hippo' ||
      u.role === 'golem' ||
      u.role === 'yeti' ||
      u.role === 'hydra' ||
      u.role === 'minotaur' ||
      u.role === 'ent' ||
      u.role === 'kraken' ||
      u.role === 'basilisk' ||
      u.role === 'bison' ||
      u.role === 'moose' ||
      u.role === 'gorilla'
        ? 3.4
        : u.role === 'cow' ||
            u.role === 'unicorn' ||
            u.role === 'pegasus' ||
            u.role === 'horse' ||
            u.role === 'giraffe' ||
            u.role === 'zebra' ||
            u.role === 'tiger' ||
            u.role === 'panda' ||
            u.role === 'pig' ||
            u.role === 'orc' ||
            u.role === 'lion' ||
            u.role === 'camel' ||
            u.role === 'crocodile' ||
            u.role === 'boar' ||
            u.role === 'griffin' ||
            u.role === 'phoenix' ||
            u.role === 'cerberus' ||
            u.role === 'thunderbird' ||
            u.role === 'manticore' ||
            u.role === 'gargoyle'
          ? 4.6
          : 5.8;

    const posAlpha = 1 - Math.exp(-followRate * stepDt);
    const altAlpha = 1 - Math.exp(-(followRate * 1.15) * stepDt);

    const prevX = u.x;
    const prevZ = u.z;
    u.x = Math.max(1, Math.min(maxCoord, prevX + (tx - prevX) * posAlpha));
    u.z = Math.max(1, Math.min(maxCoord, prevZ + (tz - prevZ) * posAlpha));
    u.targetX = u.x;
    u.targetZ = u.z;

    const curAlt = u.altitude ?? 0;
    u.altitude = curAlt + (tAlt - curAlt) * altAlpha;
    u.vzVertical = 0;

    const instVx = (u.x - prevX) / stepDt;
    const instVz = (u.z - prevZ) / stepDt;
    u.vxAir = (u.vxAir ?? 0) * 0.45 + instVx * 0.55;
    u.vzAir = (u.vzAir ?? 0) * 0.45 + instVz * 0.55;
  }
}

export function releaseDragUnit(
  state: SimulationState,
  unitId: string,
  throwVx = 0,
  throwVz = 0,
): UnitEntity | null {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return null;
  const lagVx = unit.vxAir ?? 0;
  const lagVz = unit.vzAir ?? 0;
  unit.draggedByPlayer = false;
  unit.dragTargetX = undefined;
  unit.dragTargetZ = undefined;
  unit.dragTargetAltitude = undefined;
  if (unit.state === 'ko') return unit;

  // Blend cursor release velocity with actual trailing swing momentum, or zero if explicitly dropped
  const isExplicitDrop = throwVx === 0 && throwVz === 0;
  const combVx = isExplicitDrop ? 0 : lagVx * 0.6 + throwVx * 0.55;
  const combVz = isExplicitDrop ? 0 : lagVz * 0.6 + throwVz * 0.55;
  const maxSpeed = 24;
  const spd = Math.hypot(combVx, combVz);

  // If released with low speed (< 2.0) or dropped stationary:
  // safely settle the entity onto the ground with zero fall damage and zero risk of death
  if (spd < 2.0) {
    unit.vxAir = 0;
    unit.vzAir = 0;
    unit.vzVertical = 0;
    unit.altitude = 0;
    unit.fallDamageArmed = false;
    unit.dragFlingNonLethal = false;
    unit.targetX = unit.x;
    unit.targetZ = unit.z;
    return unit;
  }

  // Fast intentional fling / throw: ballistic arc with non-lethal impact
  if (spd > maxSpeed && spd > 0.001) {
    unit.vxAir = (combVx / spd) * maxSpeed;
    unit.vzAir = (combVz / spd) * maxSpeed;
  } else {
    unit.vxAir = combVx;
    unit.vzAir = combVz;
  }
  unit.altitude = Math.max(unit.altitude ?? 1.5, 1.5);
  unit.vzVertical = Math.min(8.5, Math.max(-2.0, spd * 0.35));
  unit.fallDamageArmed = true;
  unit.dragFlingNonLethal = true;
  return unit;
}

const VOID_WISP_PALETTE = [
  '#38bdf8',
  '#c084fc',
  '#f472b6',
  '#fde047',
  '#4ade80',
  '#fb7185',
  '#a78bfa',
  '#67e8f9',
  '#fb923c',
  '#e0f2fe',
];
const MAX_VOID_WISPS = 260;

function spawnVoidWispsFromUnit(state: SimulationState, u: UnitEntity): void {
  if (!state.voidWisps) state.voidWisps = [];
  const seedBase = Math.abs((u.appearanceSeed ?? 19) + Math.round(u.x * 13 + u.z * 7));
  const isLarge = u.role === 'dragon' || u.role === 'dinosaur' || u.role === 'leviathan' || u.isKing;
  const count = isLarge ? 2 : 1;
  for (let i = 0; i < count; i++) {
    if (state.voidWisps.length >= MAX_VOID_WISPS) {
      state.voidWisps.shift();
    }
    const colorIdx = (seedBase + i * 3 + state.voidWisps.length) % VOID_WISP_PALETTE.length;
    const sizeRaw = isLarge
      ? 0.92 + ((seedBase + i * 17) % 45) / 100
      : 0.42 + ((seedBase + i * 29) % 72) / 100;
    const ang = ((seedBase + i * 71) % 360) * (Math.PI / 180);
    const spd = 1.6 + ((seedBase + i * 13) % 10) * 0.22;
    const wisp: VoidWispEntity = {
      id: nextEntityId('wisp'),
      x: Math.max(1.5, Math.min(state.gridSize - 2.5, u.x + (i === 0 ? 0 : 0.45))),
      y: Math.max(0.75, (u.altitude ?? 0) + 0.95),
      z: Math.max(1.5, Math.min(state.gridSize - 2.5, u.z + (i === 0 ? 0 : -0.35))),
      vx: Math.cos(ang) * spd,
      vz: Math.sin(ang) * spd,
      size: Number(sizeRaw.toFixed(2)),
      color: VOID_WISP_PALETTE[colorIdx],
      phase: ((seedBase + i * 37) % 100) * 0.0628,
      bobSpeed: 2.4 + ((seedBase + i * 11) % 12) * 0.18,
    };
    state.voidWisps.push(wisp);
  }
}

function killUnitIntoVoidWisp(state: SimulationState, u: UnitEntity): void {
  if (u.state === 'ko') return;
  u.hp = 0;
  u.state = 'ko';
  u.koTimer = 0.35;
  if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
  spawnVoidWispsFromUnit(state, u);
  if (u.isKing || u.role === 'leviathan' || u.role === 'dragon') {
    addChronicle(state, `${u.name} was consumed by Dark Ooze and turned into a wisp!`, 'warning');
  } else {
    addChronicle(
      state,
      `Spreading Dark Ooze consumed nearby units and turned them into wisps!`,
      'warning',
    );
  }
}

function stepVoidGooAndWisps(state: SimulationState, dt: number): void {
  if (!state.voidWisps) state.voidWisps = [];

  let voidGooActive = voidGooPossibleByState.get(state);
  if (voidGooActive === undefined) {
    voidGooActive = false;
    const frontier = new Set<number>();
    for (let i = 0; i < state.tiles.length; i++) {
      if (state.tiles[i].terrain === 'void_goo') {
        voidGooActive = true;
        frontier.add(i);
      }
    }
    voidGooPossibleByState.set(state, voidGooActive);
    if (frontier.size > 0) {
      voidGooFrontierByState.set(state, frontier);
    }
  }

  if (voidGooActive) {
    // 1. Living non-shielded units standing directly on Void Goo terrain die and revive as moving wisps
    for (const u of state.units) {
      if (u.state === 'ko' || u.hp <= 0 || u.statusEffects.shielded || u.draggedByPlayer) continue;
      if ((u.altitude ?? 0) >= 1.25) continue;
      const ut = getTile(state, Math.round(u.x), Math.round(u.z));
      if (ut && ut.terrain === 'void_goo') {
        killUnitIntoVoidWisp(state, u);
      }
    }

    // 2. Periodically creep Void Goo outward onto neighboring land tiles & damage unshielded structures
    state.voidGooTimer = (state.voidGooTimer ?? 0) + dt;
    if (state.voidGooTimer >= 0.48) {
      state.voidGooTimer = 0;
      const gs = state.gridSize;
      let frontier = voidGooFrontierByState.get(state);
      if (!frontier) {
        frontier = new Set<number>();
        for (let i = 0; i < state.tiles.length; i++) {
          if (state.tiles[i].terrain === 'void_goo') frontier.add(i);
        }
        voidGooFrontierByState.set(state, frontier);
      }
      if (frontier.size === 0) {
        voidGooPossibleByState.set(state, false);
      } else if (frontier.size < state.tiles.length * 0.92) {
        const toInfect = new Set<TileData>();
        const dirs: readonly [number, number][] = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ];
        // Prune cured or completely surrounded interior tiles so frontier stays O(perimeter)
        const stride = frontier.size > 900 ? 2 : 1;
        const offset = Math.floor(Math.random() * stride);
        let seen = 0;
        for (const tileIdx of frontier) {
          const vt = state.tiles[tileIdx];
          if (!vt || vt.terrain !== 'void_goo') {
            frontier.delete(tileIdx);
            continue;
          }
          if (stride > 1 && (seen++ & 1) !== offset) continue;
          let hasUninfectedLandNeighbor = false;
          for (let k = 0; k < dirs.length; k++) {
            const [ox, oz] = dirs[k];
            const nx = vt.x + ox;
            const nz = vt.z + oz;
            if (nx < 0 || nz < 0 || nx >= gs || nz >= gs) continue;
            const nb = state.tiles[nz * gs + nx];
            if (!nb || nb.terrain === 'void_goo' || nb.height <= 0) continue;
            hasUninfectedLandNeighbor = true;
            if (nb.blessedTimer > 0) continue;
            const isDiag = k >= 4;
            const chance = isDiag ? 0.24 : 0.62;
            if (Math.random() < chance) {
              toInfect.add(nb);
            }
            if (toInfect.size >= 52) break;
          }
          if (!hasUninfectedLandNeighbor) {
            frontier.delete(tileIdx);
          }
          if (toInfect.size >= 52) break;
        }

        for (const targetTile of toInfect) {
          if (targetTile.height <= 0) continue;
          targetTile.terrain = 'void_goo';
          frontier.add(targetTile.z * gs + targetTile.x);
          targetTile.onFireTimer = 0;
          targetTile.fireColor = undefined;
          targetTile.cursedTimer = 0;
          targetTile.farmSettlementId = undefined;
          if (targetTile.resourceNode === 'berry_bush' || targetTile.resourceNode === 'timber_grove') {
            targetTile.resourceNode = 'none';
            targetTile.resourceAmount = 0;
          }
        }

        for (const b of state.buildings) {
          if (b.hp <= 0 || b.shieldTimer > 0) continue;
          const bt = getTile(state, b.tileX, b.tileZ);
          if (bt && bt.terrain === 'void_goo') {
            b.hp = Math.max(0, b.hp - 36);
          }
        }
      }
    }
  }

  // 3. Move & bob all revived Void Wisps
  const maxCoord = state.gridSize - 2.5;
  for (let i = 0; i < state.voidWisps.length; i++) {
    const w = state.voidWisps[i];
    w.phase += w.bobSpeed * dt;
    const steer = Math.sin(w.phase * 0.7 + i * 1.13) * 1.45;
    const cosS = Math.cos(steer * dt);
    const sinS = Math.sin(steer * dt);
    const nvx = w.vx * cosS - w.vz * sinS;
    const nvz = w.vx * sinS + w.vz * cosS;
    w.vx = nvx;
    w.vz = nvz;
    w.x += w.vx * dt;
    w.z += w.vz * dt;
    if (w.x < 2 || w.x > maxCoord) {
      w.vx = -w.vx;
      w.x = Math.max(2, Math.min(maxCoord, w.x));
    }
    if (w.z < 2 || w.z > maxCoord) {
      w.vz = -w.vz;
      w.z = Math.max(2, Math.min(maxCoord, w.z));
    }
    const wt = getTile(state, Math.round(w.x), Math.round(w.z));
    const groundY = (wt?.height ?? 1) * 0.45;
    const targetY = groundY + 0.85 + w.size * 0.45 + Math.sin(w.phase) * 0.35;
    w.y = w.y + (targetY - w.y) * Math.min(1, dt * 4.5);
  }
}

export function executeHugeAsteroidImpact(
  state: SimulationState,
  targetX: number,
  targetZ: number,
): void {
  const r = 14.5;
  const rSq = r * r;
  const centerTile = getTile(state, targetX, targetZ);

  if (!state.activeHazards) state.activeHazards = [];

  // Spawn multi-year post-impact deluge rains lasting 15 to 20 years (strictly <= 20 years max)
  const rainYears = Math.min(20, 15 + (Math.abs(targetX * 7 + targetZ * 13) % 6));
  const spawnPostImpactDelugeClouds = () => {
    const cloudOffsets = [
      { dx: 0, dz: 0, angle: 0.45, radius: 13.5 },
      { dx: -5.5, dz: 4.5, angle: 2.35, radius: 11.5 },
      { dx: 5.5, dz: -4.5, angle: 4.25, radius: 11.5 },
    ];
    for (let i = 0; i < cloudOffsets.length; i++) {
      const c = cloudOffsets[i];
      const cx = Math.max(4, Math.min(state.gridSize - 5, targetX + c.dx));
      const cz = Math.max(4, Math.min(state.gridSize - 5, targetZ + c.dz));
      const wx = Math.cos(c.angle);
      const wz = Math.sin(c.angle);
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'rain_cloud',
        x: cx,
        z: cz,
        targetX: cx,
        targetZ: cz,
        windX: wx,
        windZ: wz,
        heading: c.angle,
        arrivalDuration: 0,
        arrivalRemaining: 0,
        impactPending: false,
        currentSpeed: 0.35,
        radius: c.radius,
        remaining: rainYears,
        duration: rainYears,
        tickTimer: i * 0.12,
        isSuper: true,
      });
    }
  };

  // Always unleash the expanding supersonic atmospheric shockwave & hurricane blast winds out to 30 tiles
  state.activeHazards.push({
    id: nextEntityId('haz'),
    kind: 'asteroid_shockwave',
    x: targetX,
    z: targetZ,
    currentRadius: 8.0,
    maxRadius: 30.0,
    radius: 30.0,
    remaining: 3.2,
    duration: 3.2,
    tickTimer: 0,
    isSuper: true,
  });

  if (!centerTile || centerTile.height === 0) {
    state.activeHazards.push({
      id: nextEntityId('haz'),
      kind: 'tsunami_wave',
      x: targetX,
      z: targetZ,
      currentRadius: 2.0,
      maxRadius: 48,
      radius: r,
      remaining: 6.4,
      duration: 6.4,
      tickTimer: 0,
    });
    forEachTileInRadius(state, targetX, targetZ, r, (t, dSq) => {
      if (t.height === 0) {
        damageOrBleachWaterTile(t, 450, true);
        t.terrain = dSq <= 36 ? 'deep_water' : 'shallow_water';
        delete t.frozenWaterBase;
      }
    });
    for (const b of state.buildings) {
      if ((b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2 <= rSq && b.shieldTimer <= 0) {
        b.hp = 0;
      }
    }
    for (const u of state.units) {
      if (u.state !== 'ko' && !u.statusEffects.shielded && (u.x - targetX) ** 2 + (u.z - targetZ) ** 2 <= rSq) {
        u.hp = 0;
        u.state = 'ko';
        u.koTimer = 0.5;
      }
    }
    spawnPostImpactDelugeClouds();
    addChronicle(
      state,
      `Giant Asteroid hit the ocean, triggering huge tsunamis and a ${rainYears}-year heavy rainstorm!`,
      'warning',
    );
    return;
  }

  const baseH = Math.max(3, centerTile.height);
  forEachTileInRadius(state, targetX, targetZ, 21.5, (t, dSq) => {
    if (t.height === 0) {
      damageOrBleachWaterTile(t, 450, true);
      t.terrain = dSq <= 36 ? 'deep_water' : 'shallow_water';
      delete t.frozenWaterBase;
      t.onFireTimer = 0;
      return;
    }

    const tileH = Math.max(1, t.height);
    const wasSand = t.terrain === 'sand';
    const angleNoise = ((((t.x * 73856093) ^ (t.z * 19349663)) & 255) / 255.0 - 0.5) * 2.2;
    const effDSq = dSq + angleNoise;

    if (dSq <= 20.0) {
      t.height = Math.max(1, Math.min(baseH, tileH) - 3);
      t.terrain = 'scorched';
      if (dSq <= 3.6 && !t.buildingId) {
        t.onFireTimer = 16;
        t.resourceNode = 'ore_vein';
        t.resourceAmount = 750;
      } else if (!t.buildingId) {
        t.onFireTimer = dSq <= 10.0 ? 12 : 0;
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      }
    } else if (effDSq <= 32.0) {
      t.height = Math.max(1, Math.min(baseH, tileH) - 2);
      t.terrain = 'scorched';
      if (!t.buildingId) {
        t.resourceNode = 'none';
        t.resourceAmount = 0;
        if (((t.x * 13 + t.z * 17) % 3) === 0) {
          t.onFireTimer = Math.max(t.onFireTimer, 12);
        }
      }
    } else if (effDSq <= 118.0 && !t.buildingId) {
      const rimBoost = effDSq <= 88.0 ? 3 : 2;
      t.height = Math.min(10, tileH + rimBoost);
      t.terrain = effDSq <= 96.0 ? (wasSand ? 'crystal_field' : 'rock') : 'scorched';
      if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      } else if (t.resourceNode === 'none' && ((t.x * 11 + t.z * 7) % 7 === 0)) {
        t.resourceNode = wasSand ? 'crystal_monolith' : 'ore_vein';
        t.resourceAmount = 420;
      }
    } else if (!t.buildingId) {
      t.terrain = dSq <= rSq * 1.25 ? 'scorched' : t.terrain === 'forest' || t.terrain === 'jungle' ? 'savanna' : 'scorched';
      if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      }
      t.farmSettlementId = undefined;
      if (((t.x * 19 + t.z * 31) % 3) === 0) {
        t.onFireTimer = Math.max(t.onFireTimer, 11);
      }
    }
  });

  const blastBuildingRSq = (r * 1.35) ** 2;
  for (const b of state.buildings) {
    const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
    if (dSq <= blastBuildingRSq) {
      if (b.shieldTimer <= 0) {
        b.hp = dSq <= (r * 0.92) ** 2 ? 0 : Math.max(0, b.hp - 920);
      } else {
        b.shieldTimer = 0;
        b.hp = Math.max(0, b.hp - 360);
      }
    }
  }

  const immediateWindRSq = 26.0 * 26.0;
  for (const u of state.units) {
    const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
    if (dSq <= immediateWindRSq && u.state !== 'ko' && !u.statusEffects.shielded) {
      const coreHit = dSq <= (r * 0.72) ** 2;
      const midHit = dSq <= rSq;
      const dmg = coreHit ? 950 : midHit ? 380 : 120;
      u.hp = Math.max(0, u.hp - dmg);
      if (u.hp <= 0) {
        u.state = 'ko';
        u.koTimer = 0.5;
        if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
      } else {
        const dist = Math.max(0.3, Math.sqrt(dSq));
        const windFactor = Math.max(0.35, 1 - dist / 28.0);
        const launchSpeed = 14.5 + 10.5 * windFactor;
        u.vxAir = ((u.x - targetX) / dist) * launchSpeed;
        u.vzAir = ((u.z - targetZ) / dist) * launchSpeed;
        u.altitude = Math.max(u.altitude ?? 0, 2.6 + 2.4 * windFactor);
        u.vzVertical = 11.5 + 5.5 * windFactor;
        u.fallDamageArmed = true;
      }
    }
  }
  for (const v of state.vehicles ?? []) {
    const dSq = (v.x - targetX) ** 2 + (v.z - targetZ) ** 2;
    if (dSq <= blastBuildingRSq) {
      v.hp = dSq <= (r * 0.85) ** 2 ? 0 : Math.max(0, (v.hp ?? 100) - 720);
    }
  }

  spawnPostImpactDelugeClouds();

  state.resources.ore += 240;
  state.resources.alloy += 120;
  syncStateResourcesFromKingdoms(state);
  recalculateRatesAndCaps(state);
  addChronicle(
    state,
    `A GIANT ASTEROID struck the land, sending out shockwaves and a ${rainYears}-year heavy rainstorm!`,
    'warning',
  );
}

function pickRandomEventTile(state: SimulationState, preferLand: boolean): TileData {
  const gs = state.gridSize;
  const cx = Math.floor(gs / 2);
  const cz = Math.floor(gs / 2);
  let bestTile: TileData = getTile(state, cx, cz) ?? state.tiles[0];
  for (let i = 0; i < 48; i++) {
    const margin = Math.max(10, Math.floor(gs * 0.14));
    const tx = margin + Math.floor(Math.random() * Math.max(8, gs - margin * 2));
    const tz = margin + Math.floor(Math.random() * Math.max(8, gs - margin * 2));
    const t = getTile(state, tx, tz);
    if (!t) continue;
    if (!preferLand || t.height > 0) {
      return t;
    }
    bestTile = t;
  }
  return bestTile;
}

export function triggerRandomWorldEvent(
  state: SimulationState,
  forcedKind?: RandomEventKind,
  forcedX?: number,
  forcedZ?: number,
): WorldEventState | null {
  if (!state.activeHazards) state.activeHazards = [];
  const roll = Math.random();
  const kind: RandomEventKind =
    forcedKind ??
    (roll < 0.14
      ? 'huge_asteroid'
      : roll < 0.28
        ? 'volcano_eruption'
        : roll < 0.42
          ? 'super_tornado'
          : roll < 0.56
            ? 'mega_earthquake'
            : roll < 0.72
              ? 'heatwave_drought'
              : roll < 0.86
                ? 'deep_freeze'
                : 'starfall_aurora');

  const needLand =
    kind === 'volcano_eruption' ||
    kind === 'mega_earthquake' ||
    kind === 'starfall_aurora' ||
    kind === 'heatwave_drought';
  const pickedTile =
    forcedX !== undefined && forcedZ !== undefined
      ? getTile(state, Math.round(forcedX), Math.round(forcedZ)) ?? pickRandomEventTile(state, needLand)
      : pickRandomEventTile(state, needLand);

  const tx = pickedTile.x;
  const tz = pickedTile.z;
  const ty = Math.max(0.25, pickedTile.height * 0.45 + 0.3);

  let eventState: WorldEventState;

  if (kind === 'huge_asteroid') {
    const startX = tx + 24;
    const startY = ty + 54;
    const startZ = tz - 24;
    const impactDelay = 4.6;
    const duration = 10.2;
    eventState = {
      id: nextEntityId('evt'),
      kind,
      title: 'ASTEROID IMPACT',
      subtitle: 'Crashes into the ground, leaving a huge crater and shockwave.',
      accentColor: '#ff6b35',
      trackX: startX * 0.65 + tx * 0.35,
      trackY: startY * 0.65 + ty * 0.35,
      trackZ: startZ * 0.65 + tz * 0.35,
      targetX: tx,
      targetZ: tz,
      startX,
      startY,
      startZ,
      elapsed: 0,
      impactDelay,
      duration,
      remaining: duration,
      cinematicActive: true,
      dismissedByUser: false,
      impactTriggered: false,
      destructive: true,
      startedAtYear: state.year,
    };
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'huge_asteroid_strike',
      x: tx,
      y: ty,
      z: tz,
      originX: startX,
      originY: startY,
      originZ: startZ,
      radius: 15.0,
      color: '#ff5400',
      createdAt: Date.now(),
      deferImpact: true,
    });
    addChronicle(state, 'A giant asteroid is falling toward the world!', 'warning');
  } else if (kind === 'volcano_eruption') {
    executeGodPowerImpact(state, 'volcano_eruption', tx, tz);
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'volcano_eruption',
      x: tx,
      y: ty,
      z: tz,
      radius: 7.5,
      color: '#ff5400',
      createdAt: Date.now(),
    });
    eventState = {
      id: nextEntityId('evt'),
      kind,
      title: 'VOLCANO ERUPTION',
      subtitle: 'Raises a volcano that throws lava rocks and starts fires.',
      accentColor: '#ff5400',
      trackX: tx,
      trackY: ty + 2.4,
      trackZ: tz,
      targetX: tx,
      targetZ: tz,
      elapsed: 0,
      impactDelay: 0,
      duration: 7.2,
      remaining: 7.2,
      cinematicActive: true,
      dismissedByUser: false,
      impactTriggered: true,
      destructive: true,
      startedAtYear: state.year,
    };
  } else if (kind === 'super_tornado') {
    const beforeLen = state.activeHazards.length;
    executeGodPowerImpact(state, 'super_tornado', tx, tz);
    const createdHaz = state.activeHazards.length > beforeLen ? state.activeHazards[state.activeHazards.length - 1] : undefined;
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'super_tornado',
      x: tx,
      y: ty,
      z: tz,
      radius: 8.5,
      color: '#818cf8',
      createdAt: Date.now(),
    });
    eventState = {
      id: nextEntityId('evt'),
      kind,
      title: 'MEGA TORNADO',
      subtitle: 'Spawns a massive tornado that pulls in units and destroys buildings.',
      accentColor: '#818cf8',
      trackX: tx,
      trackY: ty + 2.6,
      trackZ: tz,
      targetX: tx,
      targetZ: tz,
      elapsed: 0,
      impactDelay: 0,
      duration: 8.2,
      remaining: 8.2,
      cinematicActive: true,
      dismissedByUser: false,
      impactTriggered: true,
      linkedHazardId: createdHaz?.id,
      destructive: true,
      startedAtYear: state.year,
    };
  } else if (kind === 'mega_earthquake') {
    const quakePlan = generateEarthquakeFaultNetwork(tx, tz, 10.5);
    executeGodPowerImpact(state, 'earthquake', tx, tz, quakePlan);
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'earthquake',
      x: tx,
      y: ty,
      z: tz,
      radius: quakePlan.quakeExtent,
      color: '#e07a2b',
      createdAt: Date.now(),
      faultSegments: quakePlan.faultSegments,
      quakeShapeKind: quakePlan.quakeShapeKind,
      quakeExtent: quakePlan.quakeExtent,
    });
    eventState = {
      id: nextEntityId('evt'),
      kind,
      title: 'MAJOR EARTHQUAKE',
      subtitle: 'Cracks the ground open, damages buildings, and raises rocky ridges.',
      accentColor: '#e07a2b',
      trackX: tx,
      trackY: ty + 1.2,
      trackZ: tz,
      targetX: tx,
      targetZ: tz,
      elapsed: 0,
      impactDelay: 0,
      duration: 5.8,
      remaining: 5.8,
      cinematicActive: true,
      dismissedByUser: false,
      impactTriggered: true,
      destructive: true,
      startedAtYear: state.year,
    };
  } else if (kind === 'heatwave_drought') {
    executeGodPowerImpact(state, 'heat_wave', tx, tz);
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'heat_wave',
      x: tx,
      y: ty,
      z: tz,
      radius: 10.0,
      color: '#ff7b00',
      createdAt: Date.now(),
    });
    eventState = {
      id: nextEntityId('evt'),
      kind,
      title: 'HEAT WAVE',
      subtitle: 'Dries out plants, melts ice, and starts brush fires.',
      accentColor: '#ff9e00',
      trackX: tx,
      trackY: ty + 1.4,
      trackZ: tz,
      targetX: tx,
      targetZ: tz,
      elapsed: 0,
      impactDelay: 0,
      duration: 5.4,
      remaining: 5.4,
      cinematicActive: true,
      dismissedByUser: false,
      impactTriggered: true,
      destructive: true,
      startedAtYear: state.year,
    };
  } else if (kind === 'deep_freeze') {
    executeGodPowerImpact(state, 'freeze_snap', tx, tz);
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'freeze_snap',
      x: tx,
      y: ty,
      z: tz,
      radius: 10.0,
      color: '#7dd3fc',
      createdAt: Date.now(),
    });
    eventState = {
      id: nextEntityId('evt'),
      kind,
      title: 'DEEP FREEZE',
      subtitle: 'Freezes water into ice and covers the land in snow.',
      accentColor: '#7dd3fc',
      trackX: tx,
      trackY: ty + 1.4,
      trackZ: tz,
      targetX: tx,
      targetZ: tz,
      elapsed: 0,
      impactDelay: 0,
      duration: 5.4,
      remaining: 5.4,
      cinematicActive: true,
      dismissedByUser: false,
      impactTriggered: true,
      destructive: false,
      startedAtYear: state.year,
    };
  } else {
    // Rare celestial wonder: Aurora Shower
    executeGodPowerImpact(state, 'blessing', tx, tz);
    grantResourcesToKingdomOrPool(state, { faith: 80, knowledge: 90 });
    forEachTileInRadius(state, tx, tz, 5, (t) => {
      if (t.height > 0 && !t.buildingId && t.resourceNode === 'none' && ((t.x * 13 + t.z * 7) % 11 === 0)) {
        t.terrain = 'crystal_field';
        t.resourceNode = 'crystal_monolith';
        t.resourceAmount = 320;
      }
    });
    state.pendingVfx.push({
      id: nextEntityId('vfx'),
      type: 'eureka',
      x: tx,
      y: ty,
      z: tz,
      radius: 7.5,
      color: '#56cfe1',
      createdAt: Date.now(),
    });
    addChronicle(state, 'An Aurora Shower lit up the sky, healing units and growing crystals!', 'divine');
    eventState = {
      id: nextEntityId('evt'),
      kind: 'starfall_aurora',
      title: 'AURORA SHOWER',
      subtitle: 'Heals nearby units, boosts faith, and grows crystals.',
      accentColor: '#56cfe1',
      trackX: tx,
      trackY: ty + 1.8,
      trackZ: tz,
      targetX: tx,
      targetZ: tz,
      elapsed: 0,
      impactDelay: 0,
      duration: 5.6,
      remaining: 5.6,
      cinematicActive: true,
      dismissedByUser: false,
      impactTriggered: true,
      destructive: false,
      startedAtYear: state.year,
    };
  }

  state.activeWorldEvent = eventState;
  state.worldEventTimer = 0;
  return eventState;
}

export function dismissWorldEventCinematic(state: SimulationState): void {
  if (state.activeWorldEvent) {
    state.activeWorldEvent.dismissedByUser = true;
    state.activeWorldEvent.cinematicActive = false;
  }
}

function stepRandomWorldEvents(
  state: SimulationState,
  dt: number,
  skipTriggers = false,
): void {
  if (state.activeWorldEvent) {
    state.activeWorldEvent.elapsed += dt;
    state.activeWorldEvent.remaining = Math.max(0, state.activeWorldEvent.remaining - dt);
    if (state.activeWorldEvent.remaining <= 0) {
      state.activeWorldEvent = null;
    }
    return;
  }

  if (skipTriggers || state.worldRules?.randomEvents === false) {
    return;
  }

  // Only start random events once world time is actively ticking and avoid spamming early in brand-new empty worlds
  state.worldEventTimer = (state.worldEventTimer ?? 0) + dt;
  // Rare cadence: roughly every ~150-220 seconds of simulated time (mean ~185s)
  const triggerThreshold = 150 + (((Math.floor(state.year * 13) + state.seed) % 70));
  if (state.worldEventTimer >= triggerThreshold) {
    state.worldEventTimer = 0;
    triggerRandomWorldEvent(state);
  }
}


