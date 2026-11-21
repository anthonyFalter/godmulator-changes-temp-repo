import {
  BUILDINGS,
  EPOCHS,
  GOD_POWERS,
  TERRAIN_TOOLS,
  UNITS,
  getDinosaurVariant,
  getDragonVariant,
  getMaxCityPopulation,
  getUnitMaxLifespan,
} from './catalog';
export { getMaxCityPopulation, getUnitMaxLifespan };
import { getPowerEffectiveRadius, isInsidePixelCircle } from './brushSizes';
import {
  ActiveHazardZone,
  BuildingEntity,
  BuildingType,
  ChronicleEvent,
  DiplomaticRelation,
  EarthquakeFaultSegment,
  EarthquakeShapeKind,
  GodPowerType,
  RandomEventKind,
  Resources,
  SimulationState,
  SpeciesId,
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
  WorldEventState,
  WorldGenConfig,
  WorldRulesConfig,
  WorldTemplateId,
} from './types';
import { generateUnitGenes, generateUnitItems } from './entityInspector';
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
  syncWorldGridFromTiles,
} from './worldGrid';
import {
  CoarseChunkGraph,
  FlowFieldManager,
  TimeSlicedPathBudget,
} from './pathfinding';

const BUILDING_BY_TYPE = new Map(BUILDINGS.map((d) => [d.type, d]));
const UNIT_BY_ROLE = new Map(UNITS.map((d) => [d.role, d]));
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
    wolf: ['Fang', 'Fenrir', 'Timber', 'Shadow', 'Ash', 'Silver', 'Lupus', 'Ghost', 'Frostbite', 'Nightpaw', 'Cinder', 'Bane'],
    bear: ['Barnaby', 'Kodiak', 'Ursa', 'Grizz', 'Bramble', 'Thor', 'Boulder', 'Otis', 'Bruno', 'Baloo', 'Goliath', 'Cedar'],
    dinosaur:
      dinoDiet === 'carnivore'
        ? ['Rex', 'Chomper', 'Raptor', 'Fangjaw', 'Gorgon', 'Razor', 'Vex', 'Sauron', 'Ripper', 'Spikejaw', 'Cinderclaw', 'Apex']
        : ['Spike', 'Terra', 'Trixie', 'Bronty', 'Ankylo', 'Pebbleback', 'Cresthorn', 'Mosswalker', 'Fern', 'Titan', 'Plate', 'Bramble'],
    dragon: ['Ignis', 'Pyre', 'Zephyr', 'Vermithrax', 'Drakon', 'Scorch', 'Cinderwing', 'Embermaw', 'Obsidia', 'Aurelion', 'Balerion', 'Valyrax'],
    unicorn: ['Lumina', 'Aurelia', 'Starlight', 'Celeste', 'Seraph', 'Sylph', 'Dawnhorn', 'Moonbeam', 'Glimmer', 'Astrid', 'Iris', 'Elysia'],
    leviathan: ['Charybdis', 'Tiamat', 'Kraken', 'Jormungandr', 'Thalassor', 'Abyssal', 'Bloop', 'Maelstrom', 'Cetus', 'Nautilus', 'Tidecaller', 'Vortex'],
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

  const firstPool =
    species === 'elf' ? ELF_FIRST_NAMES : species === 'orc' ? ORC_FIRST_NAMES : HUMAN_FIRST_NAMES;
  const lastPool =
    species === 'elf' ? ELF_SURNAMES : species === 'orc' ? ORC_CLAN_NAMES : HUMAN_LAST_NAMES;

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
  return cityBuildingCount <= 0 ? 0 : cityBuildingCount * 2;
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
): void {
  if (state.chronicle.slice(0, 5).some((c) => c.text === text)) {
    return;
  }
  state.chronicle = [
    {
      id: nextEntityId('chr'),
      yearLabel: formatYearLabel(state.year),
      text,
      tone,
      timestamp: Date.now(),
    },
    ...state.chronicle.slice(0, 49),
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
  options?: { ageStage?: UnitAgeStage; appearanceSeed?: number; ageYears?: number; maxLifespan?: number },
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
    def.species ?? (role === 'elf' ? 'elf' : role === 'orc' ? 'orc' : 'human');

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
    const isBasicRaceRole = role === 'human' || role === 'elf' || role === 'orc' || role === 'villager';
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

  const maxHp = ageStage === 'child' ? Math.max(45, Math.round(def.maxHp * 0.68)) : def.maxHp;
  const growthTimer = ageStage === 'child' ? 12 + (appearanceSeed % 7) : undefined;

  const dinoDiet = role === 'dinosaur' ? getDinosaurVariant(appearanceSeed).diet : undefined;
  const generatedName =
    def.faction === 'hostile'
      ? def.name
      : createUniqueUnitName(state, role, species, dinoDiet);

  const genes = generateUnitGenes(role, species, appearanceSeed, dinoDiet);
  const maxLifespan = getUnitMaxLifespan({
    role,
    species,
    appearanceSeed,
    genes,
    maxLifespan: options?.maxLifespan,
  });

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
    genes,
    items: generateUnitItems(
      role,
      species,
      resolvedKingdomId ? getKingdomEpoch(state, resolvedKingdomId) : 0,
      appearanceSeed,
      dinoDiet,
    ),
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
    t.terrain === 'taiga'
  );
}

function raiseWaterTileToLand(t: TileData, terrain: TerrainType, height = 1): void {
  t.height = Math.max(1, Math.min(10, height));
  t.terrain = terrain;
  t.isRiver = false;
  delete t.frozenWaterBase;
  delete t.coralBleachTimer;
  t.onFireTimer = 0;
  t.cursedTimer = 0;
  clearBurntTreeState(t);
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
    case 'abyssal_trench':
    case 'alpine_glacier':
    case 'seed_ore':
    case 'crystal_shower':
    case 'boulder_rain':
    case 'volcanic_obsidian':
      return true;
    case 'stone_road':
    case 'rail_track':
      return t.height >= 0 && !t.buildingId;
    case 'fertile_meadow':
    case 'plant_forest':
      return t.height === 0 || isCultivableSoil(t);
    case 'blossom_rain':
      return (
        t.height === 0 ||
        (t.height > 0 &&
          t.height < 6 &&
          (t.terrain === 'grass' ||
            t.terrain === 'fertile' ||
            t.terrain === 'forest' ||
            t.terrain === 'savanna' ||
            t.terrain === 'jungle' ||
            t.terrain === 'blossom' ||
            t.terrain === 'taiga'))
      );
    case 'jungle_bloom':
      return t.height === 0 || isCultivableSoil(t) || t.terrain === 'swamp';
    case 'soil_enrich':
      return (
        t.height === 0 ||
        (t.height > 0 &&
          (t.terrain === 'scorched' ||
            t.terrain === 'void_goo' ||
            t.terrain === 'badlands' ||
            t.terrain === 'rock' ||
            t.terrain === 'swamp' ||
            t.terrain === 'sand' ||
            t.terrain === 'tundra' ||
            t.cursedTimer > 0 ||
            t.onFireTimer > 0 ||
            t.terrain === 'grass'))
      );
    case 'desert_dunes':
      return t.height === 0 || (t.height > 0 && t.height <= 4);
    case 'coral_reef_rain':
      return t.height === 0;
    case 'salvage_drop':
      return !t.buildingId;
    case 'atlantis_rise':
      return t.height === 0 && !t.buildingId;
    case 'swamp_mire':
      return (t.height === 0 || t.height > 0) && !t.buildingId;
  }
}

function applyTerrainToolTileMutation(
  t: TileData,
  toolType: TerrainToolType,
  targetFlattenHeight: number,
  _centerHeight: number,
): boolean {
  let tileModified = false;
  switch (toolType) {
        case 'raise': {
          tileModified = true;
          if (t.height === 0) {
            raiseWaterTileToLand(t, 'sand', 1);
          } else {
            t.height = Math.min(10, t.height + 1);
            if (t.height >= 8) {
              t.terrain = 'snow';
              if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            } else if (t.height >= 5) {
              if (
                t.terrain !== 'scorched' &&
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
              t.terrain = 'savanna';
            }
          }
          break;
        }
        case 'lower': {
          tileModified = true;
          if (t.height === 0) {
            if (t.terrain !== 'deep_water') {
              t.terrain = 'deep_water';
            }
          } else {
            t.height = Math.max(0, t.height - 1);
            if (t.height === 0) {
              t.terrain = 'shallow_water';
              t.resourceNode = 'none';
              t.resourceAmount = 0;
              t.onFireTimer = 0;
              clearBurntTreeState(t);
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
        else if (t.height >= 5 && t.terrain !== 'scorched' && t.terrain !== 'badlands' && t.terrain !== 'rock') {
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
            if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            tileModified = true;
          }
          break;
        }
        case 'fertile_meadow': {
          if (t.height === 0) {
            raiseWaterTileToLand(t, 'fertile', 1);
            if (!t.buildingId) {
              t.resourceNode = 'berry_bush';
              t.resourceAmount = 220;
            }
            tileModified = true;
          } else if (isCultivableSoil(t)) {
            t.terrain = 'fertile';
            clearBurntTreeState(t);
            if (!t.buildingId) {
              t.resourceNode = 'berry_bush';
              t.resourceAmount = 220;
            }
            tileModified = true;
          }
          break;
        }
        case 'plant_forest': {
          if (t.height === 0) {
            raiseWaterTileToLand(t, 'forest', 1);
            if (!t.buildingId) {
              t.resourceNode = 'timber_grove';
              t.resourceAmount = 260;
            }
            tileModified = true;
          } else if (isCultivableSoil(t)) {
            if (
              t.terrain !== 'jungle' &&
              t.terrain !== 'taiga' &&
              t.terrain !== 'blossom' &&
              t.terrain !== 'savanna'
            ) {
              t.terrain = 'forest';
            }
            clearBurntTreeState(t);
            if (!t.buildingId) {
              t.resourceNode = 'timber_grove';
              t.resourceAmount = 260;
            }
            tileModified = true;
          }
          break;
        }
        case 'seed_ore': {
          if (t.height === 0) {
            raiseWaterTileToLand(t, 'rock', 1);
          } else if (t.terrain !== 'scorched' && t.terrain !== 'snow') {
            t.terrain = 'rock';
          }
          if (!t.buildingId) {
            t.resourceNode = (t.x + t.z) % 3 === 0 ? 'crystal_monolith' : 'ore_vein';
            t.resourceAmount = 350;
          }
          tileModified = true;
          break;
        }
        case 'crystal_shower': {
          if (t.height === 0) {
            raiseWaterTileToLand(t, 'crystal_field', 1);
          } else {
            t.terrain = 'crystal_field';
            t.onFireTimer = 0;
            t.cursedTimer = 0;
          }
          if (!t.buildingId) {
            t.resourceNode = 'crystal_monolith';
            t.resourceAmount = 420;
          }
          tileModified = true;
          break;
        }
        case 'boulder_rain': {
          if (t.height === 0) {
            raiseWaterTileToLand(t, 'rock', 1);
          } else {
            t.terrain = t.height >= 5 ? 'mountain' : 'rock';
            t.onFireTimer = 0;
          }
          if (!t.buildingId) {
            t.resourceNode = 'stone_outcrop';
            t.resourceAmount = 360;
          }
          tileModified = true;
          break;
        }
        case 'blossom_rain': {
          const livingBiome =
            t.height > 0 &&
            t.height < 6 &&
            (t.terrain === 'grass' ||
              t.terrain === 'fertile' ||
              t.terrain === 'forest' ||
              t.terrain === 'savanna' ||
              t.terrain === 'jungle' ||
              t.terrain === 'blossom' ||
              t.terrain === 'taiga');
          if (t.height === 0 || livingBiome) {
            if (t.height === 0) {
              raiseWaterTileToLand(t, 'blossom', 1);
            } else {
              t.terrain = 'blossom';
              t.onFireTimer = 0;
              t.cursedTimer = 0;
              clearBurntTreeState(t);
            }
            t.blessedTimer = Math.max(t.blessedTimer, 18);
            if (!t.buildingId) {
              t.resourceNode = (t.x + t.z) % 3 === 0 ? 'berry_bush' : 'timber_grove';
              t.resourceAmount = 280;
            }
            tileModified = true;
          }
          break;
        }
        case 'jungle_bloom': {
          if (t.height === 0 || isCultivableSoil(t) || t.terrain === 'swamp') {
            if (t.height === 0) {
              raiseWaterTileToLand(t, 'jungle', 1);
            } else {
              t.terrain = 'jungle';
              t.onFireTimer = 0;
              clearBurntTreeState(t);
            }
            if (!t.buildingId) {
              t.resourceNode = (t.x + t.z) % 4 === 0 ? 'berry_bush' : 'timber_grove';
              t.resourceAmount = 300;
            }
            tileModified = true;
          }
          break;
        }
        case 'soil_enrich': {
          if (t.height === 0) {
            raiseWaterTileToLand(t, 'grass', 1);
            t.blessedTimer = Math.max(t.blessedTimer, 14);
            if (!t.buildingId && (t.x + t.z) % 3 === 0) {
              t.resourceNode = 'berry_bush';
              t.resourceAmount = 190;
            }
            tileModified = true;
          } else if (t.height > 0) {
            const harsh =
              t.terrain === 'scorched' ||
              t.terrain === 'void_goo' ||
              t.terrain === 'badlands' ||
              t.terrain === 'rock' ||
              t.terrain === 'swamp' ||
              t.terrain === 'sand' ||
              t.terrain === 'tundra' ||
              t.cursedTimer > 0 ||
              t.onFireTimer > 0;
            if (harsh || t.terrain === 'grass') {
              t.terrain = harsh ? 'grass' : 'fertile';
              t.onFireTimer = 0;
              t.cursedTimer = 0;
              t.blessedTimer = Math.max(t.blessedTimer, 14);
              clearBurntTreeState(t);
              if (!t.buildingId && t.resourceNode === 'none' && (t.x + t.z) % 2 === 0) {
                t.resourceNode = 'berry_bush';
                t.resourceAmount = 190;
              }
              tileModified = true;
            }
          }
          break;
        }
        case 'desert_dunes': {
          if (t.height === 0 || (t.height > 0 && t.height <= 4)) {
            if (t.height === 0) {
              raiseWaterTileToLand(t, 'sand', 1);
            } else {
              t.terrain = 'sand';
              t.onFireTimer = 0;
            }
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
          }
          t.tempOffset = Math.min(60, (t.tempOffset ?? 0) + 25);
          if (!t.buildingId) {
            t.resourceNode = (t.x + t.z) % 2 === 0 ? 'ore_vein' : 'stone_outcrop';
            t.resourceAmount = 380;
          }
          tileModified = true;
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
              t.resourceNode = (t.x + t.z) % 2 === 0 ? 'ore_vein' : 'stone_outcrop';
              t.resourceAmount = 340;
            }
            tileModified = true;
          }
          break;
        }
        case 'carve_river': {
          tileModified = true;
          if (t.height >= 3) {
            t.height = Math.max(1, t.height - 2);
            if (t.terrain === 'snow' || t.terrain === 'rock') t.terrain = 'rock';
          } else {
            t.height = 0;
            t.terrain = 'shallow_water';
            t.isRiver = true;
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.onFireTimer = 0;
          }
          break;
        }
        case 'abyssal_trench': {
          t.height = 0;
          t.terrain = 'deep_water';
          t.isRiver = false;
          delete t.frozenWaterBase;
          t.resourceNode = 'none';
          t.resourceAmount = 0;
          t.onFireTimer = 0;
          t.farmSettlementId = undefined;
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
            }
          }
          break;
        }
        case 'swamp_mire': {
          if (!t.buildingId) {
            if (t.height === 0) {
              raiseWaterTileToLand(t, 'swamp', 1);
            } else {
              if (t.height > 2) t.height = 2;
              t.terrain = 'swamp';
              t.onFireTimer = 0;
            }
            if (t.resourceNode === 'stone_outcrop' || t.resourceNode === 'ore_vein' || t.resourceNode === 'berry_bush') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            tileModified = true;
          }
          break;
        }
      }
  return tileModified;
}

export function executeTerrainDropTileImpact(
  state: SimulationState,
  toolType: TerrainToolType,
  tileX: number,
  tileZ: number,
): boolean {
  const t = getTile(state, tileX, tileZ);
  if (!t) return false;
  const changed = applyTerrainToolTileMutation(t, toolType, Math.max(1, t.height), t.height);
  if (!changed) return false;

  if (toolType === 'blossom_rain') {
    const clearRadiusSq = 2.25 * 2.25;
    for (const u of state.units) {
      if (
        u.state !== 'ko' &&
        u.faction !== 'hostile' &&
        (u.x - tileX) ** 2 + (u.z - tileZ) ** 2 <= clearRadiusSq
      ) {
        u.statusEffects.cursed = 0;
        u.hp = Math.min(u.maxHp, u.hp + 15);
      }
    }
  }

  reconcileAndSyncResources(state);
  recalculateRatesAndCaps(state);
  return true;
}

export function applyTerrainTool(
  state: SimulationState,
  toolType: TerrainToolType,
  centerX: number,
  centerZ: number,
  brushRadius = 1,
  options?: { deferSkyImpact?: boolean },
): { ok: boolean; reason?: string } {
  const def = TERRAIN_TOOLS.find((t) => t.type === toolType);
  if (!def) return { ok: false, reason: 'Unknown terrain tool' };

  const centerTile = getTile(state, centerX, centerZ);
  if (!centerTile) return { ok: false, reason: 'Out of bounds' };

  if (!state.sandboxFreeMode && state.resources.faith < def.faithCost) {
    return { ok: false, reason: 'Need more God Energy to sculpt terrain' };
  }

  const targetFlattenHeight = Math.max(1, centerTile.height);
  const clampedRadius = Math.max(0, Math.min(12, Math.floor(brushRadius)));
  const deferSkyImpact = Boolean(def.isSkyRain) && (options?.deferSkyImpact ?? true);
  let modifiedCount = 0;
  const dropTargets: Array<{ x: number; y: number; z: number }> = [];

  for (let dz = -clampedRadius; dz <= clampedRadius; dz++) {
    for (let dx = -clampedRadius; dx <= clampedRadius; dx++) {
      if (!isInsidePixelCircle(dx, dz, clampedRadius)) continue;
      const t = getTile(state, centerX + dx, centerZ + dz);
      if (!t) continue;
      const tileEligible = deferSkyImpact
        ? canApplyTerrainToolToTile(t, toolType, centerTile.height)
        : applyTerrainToolTileMutation(t, toolType, targetFlattenHeight, centerTile.height);

      if (tileEligible) {
        modifiedCount++;
        dropTargets.push({ x: t.x, y: Math.max(0.36, t.height * 0.45 + 0.25), z: t.z });
      }
    }
  }

  if (modifiedCount === 0) {
    if (toolType === 'plant_forest' || toolType === 'fertile_meadow' || toolType === 'blossom_rain') {
      return {
        ok: false,
        reason: 'Cannot cultivate dead or barren land — revive soil with Rain, Soil Revive, or Bless first!',
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

  if (!deferSkyImpact && toolType === 'blossom_rain') {
    const clearRadiusSq = (clampedRadius + 2) ** 2;
    for (const u of state.units) {
      if (u.state !== 'ko' && u.faction !== 'hostile' && (u.x - centerX) ** 2 + (u.z - centerZ) ** 2 <= clearRadiusSq) {
        u.statusEffects.cursed = 0;
        u.hp = Math.min(u.maxHp, u.hp + 15);
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
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) continue;
        if (prevR > 0 && dSq < tileMinSq) continue;
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
          } else if (effC >= 36) {
            damageOrBleachWaterTile(t, 140, false);
          }
          continue;
        }

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
              t.terrain === 'grass' ||
              t.terrain === 'forest') &&
            effC >= 27
          ) {
            t.terrain = 'savanna';
          } else if (t.terrain === 'savanna' && effC >= 36) {
            t.terrain = 'sand';
            t.farmSettlementId = undefined;
          } else if ((t.terrain === 'sand' || t.terrain === 'badlands') && effC >= 48) {
            t.terrain = 'scorched';
            t.farmSettlementId = undefined;
          }
        }

        const isSuperheated = effC >= 42 || t.tempOffset >= 24;
        const flammable =
          t.resourceNode === 'timber_grove' ||
          t.resourceNode === 'berry_bush' ||
          isFlammableVegetationTerrain(t.terrain) ||
          t.terrain === 'scorched' ||
          Boolean(t.buildingId);
        if (isSuperheated && flammable && (normDistSq <= 0.32 || (allowSpread && ((t.x * 13 + t.z * 7) % 3 === 0)))) {
          t.onFireTimer = Math.max(t.onFireTimer, 6.5);
        }
      }
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
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) continue;
        if (prevR > 0 && dSq < tileMinSq) continue;
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
          continue;
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
      }
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
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) continue;
        if (prevR > 0 && dSq < tileMinSq) continue;
        t.onFireTimer = 0;
        t.cursedTimer = 0;
        t.blessedTimer = 30;
        if (t.height <= 0) {
          if (t.resourceNode === 'coral_reef') {
            t.coralBleachTimer = 0;
            t.resourceAmount = Math.max(240, Math.min(360, t.resourceAmount + 140));
          }
          continue;
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
      }
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
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) continue;
        if (prevR > 0 && dSq < tileMinSq) continue;
        t.cursedTimer = 30;
        t.blessedTimer = 0;
      }
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
      for (const t of state.tiles) {
        if (t.height <= 0 || t.buildingId) continue;
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) continue;
        if (prevR > 0 && dSq < tileMinSq) continue;
        if (dSq <= 4.2) {
          if (t.resourceNode === 'timber_grove') {
            preserveTreeBiomeBeforeScorch(t);
            t.burntTree = true;
          }
          t.terrain = 'scorched';
        } else if (Math.abs(dSq - maxRSq * 0.68) < 2.0 && ((t.x * 13 + t.z * 7) % 6 === 0)) {
          t.onFireTimer = 6;
        }
      }
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
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) continue;
        if (prevR > 0 && dSq < tileMinSq) continue;
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
            continue;
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
      }
      break;
    }
  }
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

      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.faction === 'civilization') {
          u.statusEffects.blessed = 25;
        }
      }
      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= rSq) {
          b.constructionProgress = 100;
          b.hp = b.maxHp;
          b.blessedTimer = 25;
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
          spawnUnit(state, sp, hub.tileX, hub.tileZ, true, sid, { ageStage: 'child' });
          spawnUnit(state, sp, hub.tileX, hub.tileZ, true, sid, { ageStage: 'adult' });
        }
      }
      addChronicle(state, 'Golden Age dawned! +60 God Energy, 2x kingdom output, full repairs & booming towns.', 'epoch');
      break;
    }

    case 'divine_shield': {
      isHeavy = true;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'shield_dome',
        x: targetX,
        z: targetZ,
        radius: r,
        remaining: 14.0,
        duration: 14.0,
        tickTimer: 0,
      });
      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= rSq) {
          b.hp = b.maxHp;
          b.shieldTimer = 40;
        }
      }
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq) {
          if (u.faction === 'civilization') {
            u.statusEffects.shielded = 35;
            delete u.statusEffects.plagued;
            delete u.statusEffects.cursed;
            u.hp = u.maxHp;
          } else if (u.faction === 'hostile' && u.state !== 'ko') {
            // Shockwave repels hostile raiders outside the sanctuary dome!
            const dist = Math.max(0.25, Math.sqrt(dSq));
            u.x = Math.max(1, Math.min(state.gridSize - 2, targetX + ((u.x - targetX) / dist) * (r + 1.5)));
            u.z = Math.max(1, Math.min(state.gridSize - 2, targetZ + ((u.z - targetZ) / dist) * (r + 1.5)));
            u.hp = Math.max(0, u.hp - 35);
          }
        }
      }
      forEachTileInBounds(state, targetX - r, targetX + r, targetZ - r, targetZ + r, (t) => {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0) {
          t.onFireTimer = 0;
          t.cursedTimer = 0;
          t.blessedTimer = 30;
        }
      });
      addChronicle(state, 'Aegis Sanctuary dome erected, repelling foes and shielding all within!', 'divine');
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
          u.role === 'unicorn' ||
          u.role === 'dragon';
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
      const isWaterTarget =
        !centerTile ||
        centerTile.height === 0 ||
        centerTile.terrain === 'deep_water' ||
        centerTile.terrain === 'shallow_water';
      const targetH = !isWaterTarget && centerTile ? Math.max(2, Math.min(6, centerTile.height + 1)) : 3;
      const seedR = Math.min(r, 1.55);
      const haz: ActiveHazardZone = {
        id: nextEntityId('haz'),
        kind: 'terraform_wave',
        x: targetX,
        z: targetZ,
        currentRadius: seedR,
        maxRadius: r,
        waveWaterTarget: isWaterTarget,
        waveTargetHeight: targetH,
        waveEpochIdx: state.epochIndex,
        radius: r,
        remaining: 1.6,
        duration: 1.6,
        tickTimer: 0,
      };
      applyExpandingWaveSlice(state, 'terraform_wave', targetX, targetZ, r, 0, seedR, getWaveAppliedSet(haz), haz);
      state.activeHazards.push(haz);
      addChronicle(
        state,
        isWaterTarget
          ? 'Terraform raised a flat island from the sea!'
          : 'Terraform shaped the ground into a flat stepped plateau!',
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
      for (let i = 0; i < kidsArr.length; i++) {
        for (let j = i + 1; j < kidsArr.length; j++) {
          setKingdomRelation(state, kidsArr[i], kidsArr[j], 'allied');
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

    case 'solar_orbital_laser': {
      isHeavy = true;
      const sweepAngle = (((targetX * 23 + targetZ * 41) & 63) / 64) * Math.PI * 2;
      state.activeHazards.push({
        id: nextEntityId('haz'),
        kind: 'orbital_beam',
        x: targetX,
        z: targetZ,
        radius: r,
        remaining: 4.5,
        duration: 4.5,
        tickTimer: 0,
        beamDirX: Math.cos(sweepAngle),
        beamDirZ: Math.sin(sweepAngle),
      });
      addChronicle(state, 'Solar Beam fired from above, burning a path across the ground!', 'warning');
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
): { ok: boolean; reason?: string; isHeavy?: boolean } {
  const def = GOD_POWERS.find((p) => p.type === powerType);
  if (!def) return { ok: false, reason: 'Unknown divine power' };

  const centerTile = getTile(state, targetX, targetZ);

  reconcileAndSyncResources(state);
  if (!state.sandboxFreeMode && state.resources.faith < def.faithCost) {
    return { ok: false, reason: `Requires ${def.faithCost} God Energy` };
  }

  if (!state.sandboxFreeMode) {
    spendWorldCost(state, { faith: def.faithCost });
  }

  const baseHeight = centerTile ? Math.max(0.36, centerTile.height * 0.45) : 1.2;
  const scaledRadius =
    options?.radiusOverride !== undefined && Number.isFinite(options.radiusOverride)
      ? Math.max(0.85, Math.min(28, options.radiusOverride))
      : powerType === 'drag_entity'
        ? def.radius
        : getPowerEffectiveRadius(def.radius, options?.brushSize ?? 1);

  const deferImpact = Boolean(options?.deferImpact);
  let isHeavy =
    powerType !== 'blessing' &&
    powerType !== 'rain_of_plenty' &&
    powerType !== 'freeze_snap' &&
    powerType !== 'heat_wave' &&
    powerType !== 'harmony_dove' &&
    powerType !== 'drag_entity';

  const earthquakePlan =
    powerType === 'earthquake' ? generateEarthquakeFaultNetwork(targetX, targetZ, scaledRadius) : null;

  if (!deferImpact) {
    isHeavy = executeGodPowerImpact(
      state,
      powerType,
      targetX,
      targetZ,
      earthquakePlan
        ? { ...earthquakePlan, radiusOverride: scaledRadius }
        : { radiusOverride: scaledRadius },
    );
  } else if (powerType === 'rain_of_plenty') {
    // Spawn the monsoon cloud upwind immediately so it rushes fast into the summoned spot (targetX, targetZ)
    if (!state.activeHazards) state.activeHazards = [];
    const windAngle = 0.58 + (((targetX * 17 + targetZ * 31) & 7) - 3.5) * 0.08;
    const windX = Math.cos(windAngle);
    const windZ = Math.sin(windAngle);
    const startDist = 18.5;
    state.activeHazards.push({
      id: nextEntityId('haz'),
      kind: 'rain_cloud',
      x: targetX - windX * startDist,
      z: targetZ - windZ * startDist,
      targetX,
      targetZ,
      windX,
      windZ,
      arrivalRemaining: 0.72,
      arrivalDuration: 0.72,
      impactPending: true,
      currentSpeed: 42,
      radius: scaledRadius,
      remaining: 10.5,
      duration: 10.5,
      tickTimer: 0,
    });
  }

  state.totalMiraclesCast += 1;
  state.pendingVfx.push({
    id: nextEntityId('vfx'),
    type: powerType,
    x: targetX,
    y: baseHeight,
    z: targetZ,
    radius: earthquakePlan?.quakeExtent ?? scaledRadius,
    color: def.color,
    createdAt: Date.now(),
    deferImpact,
    faultSegments: earthquakePlan?.faultSegments,
    quakeShapeKind: earthquakePlan?.quakeShapeKind,
    quakeExtent: earthquakePlan?.quakeExtent,
  });

  return { ok: true, isHeavy };
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

export function setKingdomRelation(
  state: SimulationState,
  kA: string,
  kB: string,
  relation: DiplomaticRelation,
): void {
  if (!kA || !kB || kA === kB) return;
  if (!state.kingdomRelations) state.kingdomRelations = {};
  state.kingdomRelations[getKingdomPairKey(kA, kB)] = relation;
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
  // Humans & Elves have a high chance of peaceful diplomacy; Orcs are barbaric by default with a rare peace chance
  const peaceProb = species === 'orc' ? 0.12 : species === 'elf' ? 0.82 : 0.74;
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
    // At least one side is barbaric/belligerent (e.g., standard Orcs)
    const bothOrcOrVsOrc = spA === 'orc' || spB === 'orc';
    if (warsOn && (bothOrcOrVsOrc ? pairRoll < 0.9 : pairRoll < 0.48)) {
      rel = 'war';
    } else {
      rel = 'neutral';
    }
  } else {
    // Both kingdoms rolled peaceful inclinations -> form alliance or cordial peace
    rel = pairRoll < 0.62 ? 'allied' : 'neutral';
  }
  state.kingdomRelations[key] = rel;
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

  if (state.worldRules?.warsEnabled !== false) {
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
  if (state.diplomacyTimer >= 14 && kingdoms.length > 1) {
    state.diplomacyTimer = 0;
    const warsOn = state.worldRules?.warsEnabled !== false;
    for (let i = 0; i < kingdoms.length; i++) {
      for (let j = i + 1; j < kingdoms.length; j++) {
        const kA = kingdoms[i];
        const kB = kingdoms[j];
        const rel = getKingdomRelation(state, kA.kingdomId, kB.kingdomId);
        const roll = Math.random();
        const peaceA = rollKingdomPeacefulTrait(state, kA.kingdomId, kA.species);
        const peaceB = rollKingdomPeacefulTrait(state, kB.kingdomId, kB.species);
        if (warsOn && rel === 'neutral') {
          const warChance = !peaceA || !peaceB ? 0.35 : 0.08;
          if (roll < warChance) {
            setKingdomRelation(state, kA.kingdomId, kB.kingdomId, 'war');
            addChronicle(state, `War declared between ${kA.name} and ${kB.name}!`, 'warning');
          } else if (peaceA && peaceB && roll > 0.72) {
            setKingdomRelation(state, kA.kingdomId, kB.kingdomId, 'allied');
            addChronicle(state, `${kA.name} and ${kB.name} signed a pact of alliance.`, 'divine');
          }
        } else if (rel === 'war' && peaceA && peaceB && roll < 0.14) {
          setKingdomRelation(state, kA.kingdomId, kB.kingdomId, 'neutral');
          addChronicle(state, `${kA.name} and ${kB.name} agreed to a ceasefire.`, 'divine');
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
          const isUnstableEmpire =
            kSids.length >= 4 || isEmpireAtWar || state.happiness < 75;
          if (!isUnstableEmpire) continue;

          const satelliteSid = kSids[kSids.length - 1];
          const satPop = state.units.filter(
            (u) => u.faction === 'civilization' && u.state !== 'ko' && u.settlementId === satelliteSid,
          ).length;
          if (satPop >= 2 && Math.random() < 0.36) {
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

function findBuildableTileNear(
  state: SimulationState,
  anchorX: number,
  anchorZ: number,
  maxRadius = 18,
  settlementId = 'city_default',
): TileData | null {
  const anchorTile = getTile(state, anchorX, anchorZ);
  const isFloatingSettlement = Boolean(anchorTile && anchorTile.height === 0) || state.worldTemplate === 'scrap_sea';
  const preferredHeight = anchorTile && anchorTile.height > 0 ? anchorTile.height : isFloatingSettlement ? 0 : 2;
  const variant = getSettlementLayoutVariant(state, settlementId, anchorX, anchorZ);
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
        if (t.height <= 0 && !allowWaterLots) continue;

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

  const realmName = state.settlementNames?.[settlementIds[0] ?? kingdomId] ?? 'A civilization';
  addChronicle(
    state,
    `${realmName} has ascended to the ${nextEpoch.name} (${formatYearLabel(state.year)})!`,
    'epoch',
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
      const royalHp = monarch.species === 'orc' ? 260 : monarch.species === 'elf' ? 190 : 175;
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
  const pKid = getKingdomId(state, sid);
  const cityEpoch = getKingdomEpoch(state, pKid);
  const pStock = ensureKingdomResources(state, pKid);
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
      if (ft.buildingId || ft.height <= 0 || ft.terrain !== 'fertile') {
        ft.farmSettlementId = undefined;
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
      fallowPlot.resourceAmount = 190;
    } else if (
      ownedFarms.length < maxFarmFields &&
      (sampleBld.type === 'forager_hut' ||
        sampleBld.type === 'granary' ||
        sampleBld.type === 'guildhall' ||
        sampleBld.type === 'launch_arcology' ||
        sampleBld.type === 'bonfire')
    ) {
      const variant = getSettlementLayoutVariant(state, sid, anchor.x, anchor.z);
      for (let attempt = 0; attempt < 5; attempt++) {
        const fx = sampleBld.tileX + Math.floor(Math.random() * 9) - 4;
        const fz = sampleBld.tileZ + Math.floor(Math.random() * 9) - 4;
        const ft = getTile(state, fx, fz);
        if (
          ft &&
          ft.height > 0 &&
          ft.height <= 4 &&
          !ft.buildingId &&
          !ft.farmSettlementId &&
          ft.resourceNode === 'none' &&
          !isSettlementRoadTile(ft.x - anchor.x, ft.z - anchor.z, variant) &&
          (ft.terrain === 'grass' ||
            ft.terrain === 'savanna' ||
            ft.terrain === 'fertile' ||
            ft.terrain === 'jungle' ||
            ft.terrain === 'blossom')
        ) {
          ft.terrain = 'fertile';
          ft.resourceNode = 'berry_bush';
          ft.resourceAmount = 190;
          ft.farmSettlementId = sid;
          break;
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
    const sitesToPlaceThisTick = state.sandboxFreeMode || kRes.wood >= 80 ? 2 : 1;

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
      const site = findBuildableTileNear(state, villageAnchor.x, villageAnchor.z, 22, sid);
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
        constructionProgress: 34,
        epochLevel: cityEpoch === 0 ? 0 : Math.min(cityEpoch, baseEpochIdx),
        upgradeProgress: 0,
        blessedTimer: 0,
        cursedTimer: 0,
        shieldTimer: 0,
      };
      site.buildingId = siteBld.id;
      site.farmSettlementId = undefined;
      state.buildings.push(siteBld);
      villageBuildings.push(siteBld);
      activeSites += 1;
      state.totalStructuresBuilt += 1;
      paveSettlementStreetsNear(state, site.x, site.z, sid);
      const vName = state.settlementNames[sid] ?? 'Settlement';
      addChronicle(state, `Settlers of ${vName} break ground on a ${def.name} at (${site.x}, ${site.z}).`, 'build');
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

  reconcileKingdomEpochs(state, true);
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
  recalculateRatesAndCaps(state);
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
    state.wildlifeRespawnTimer = (state.wildlifeRespawnTimer ?? 0) + dt;
    if (state.wildlifeRespawnTimer >= 26) {
      state.wildlifeRespawnTimer = 0;
      const livingWildlife = state.units.filter((u) => u.faction === 'wildlife' && u.state !== 'ko').length;
      if (livingWildlife < 20) {
        seedWorldWildlife(state, 4);
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
  stepCivilizationPlanner(state, dt);

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

      const upgradedCount = kCompleted.filter((b) => b.epochLevel >= kEpoch).length;
      const upgradeReady = kEpoch < 4 || upgradedCount >= Math.ceil(completedCount * 0.75);
      const lateTechReady =
        kEpoch === 5
          ? kCompleted.some((b) => b.type === 'cyber_institute' || b.type === 'fission_reactor')
          : kEpoch === 6
            ? kCompleted.some((b) => b.type === 'launch_arcology')
            : true;

      // Full economic/structural readiness allows immediate organic ascension (respects species & stockpiles)
      const costWithFaith: Resources = { ...kStock, faith: state.resources.faith };
      if (
        completedCount >= requiredStructures &&
        upgradeReady &&
        lateTechReady &&
        canAfford(costWithFaith, nextEpoch.unlockCost, false)
      ) {
        advanceKingdomEpoch(state, kid, false, { skipAverageSync: true });
        continue;
      }

      // Continuous growth rate: native development + proximity diffusion catch-up curve from higher-age neighbors
      const kPop = popByKid.get(kid) ?? 0;
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
        if (nextProg >= 100) {
          // Advance by +1 toward neighbor's age; reset progress to 0 so diffusion NEVER overtakes a leading neighbor!
          advanceKingdomEpoch(state, kid, false, { freeFromProgress: true, skipAverageSync: true });
          state.kingdomEpochProgress[kid] = 0;
        } else {
          state.kingdomEpochProgress[kid] = Math.min(99.9, nextProg);
        }
      } else {
        // Equal age or leading: zero diffusion boost — progression depends strictly on own civilization strength
        const nextProg = (state.kingdomEpochProgress[kid] ?? 0) + nativeRatePerSec * dt;
        const canAscendNatively =
          completedCount >= Math.min(requiredStructures, Math.max(2, kEpoch + 2)) &&
          upgradeReady &&
          lateTechReady &&
          (resReadiness >= 0.65 || state.sandboxFreeMode);
        if (nextProg >= 100 && canAscendNatively) {
          advanceKingdomEpoch(state, kid, false, { freeFromProgress: true, skipAverageSync: true });
          state.kingdomEpochProgress[kid] = 0;
        } else {
          state.kingdomEpochProgress[kid] = Math.min(99, Math.max(nextProg, resReadiness * 100 * 0.5));
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

    haz.tickTimer += dt;
    if (haz.tickTimer >= 0.35) {
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
          t.onFireTimer = 0;
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
        // Periodically regrow farms/groves and accelerate upgrades inside the chrono distortion
        for (const b of state.buildings) {
          if ((b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2 <= rSq) {
            b.hp = Math.min(b.maxHp, b.hp + 15);
            b.upgradeProgress = Math.min(99, (b.upgradeProgress ?? 0) + 5);
          }
        }
        for (const u of state.units) {
          if (u.faction === 'civilization' && u.state !== 'ko' && (u.x - haz.x) ** 2 + (u.z - haz.z) ** 2 <= rSq) {
            u.hp = Math.min(u.maxHp, u.hp + 8);
            if (!u.statusEffects.blessed) u.statusEffects.blessed = 4;
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
        }
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

    // Sweeping Helios Solar Orbital Beam ('orbital_beam'): tracks across land superheating terrain, melting ice & vaporizing targets
    if (haz.kind === 'orbital_beam') {
      const bx = haz.beamDirX ?? 1;
      const bz = haz.beamDirZ ?? 0;
      haz.x = Math.max(2, Math.min(state.gridSize - 3, haz.x + bx * 4.2 * dt));
      haz.z = Math.max(2, Math.min(state.gridSize - 3, haz.z + bz * 4.2 * dt));
      const bR = haz.radius * 0.72;
      const bSq = bR * bR;
      forEachTileInRadius(state, haz.x, haz.z, bR, (t) => {
        t.tempOffset = Math.min(80, (t.tempOffset ?? 0) + 45 * dt);
        if (t.height === 0) {
          if (t.terrain === 'ice') {
            t.terrain = t.frozenWaterBase ?? 'shallow_water';
            delete t.frozenWaterBase;
          }
          damageOrBleachWaterTile(t, 260 * dt, true);
        } else if (!t.buildingId) {
          if (t.terrain === 'sand') t.terrain = 'crystal_field';
          else if (t.terrain !== 'crystal_field') t.terrain = 'scorched';
          t.onFireTimer = Math.max(t.onFireTimer, 7.5);
        }
      });
      for (const b of state.buildings) {
        if (b.shieldTimer <= 0 && (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2 <= bSq) {
          b.hp = Math.max(0, b.hp - 260 * dt);
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

  let pendingFireIgnitions: Map<TileData, { duration: number; fireColor?: string }> | null = null;
  const tiles = state.tiles;
  const nTiles = tiles.length;
  const wildfireSpreadEnabled = state.worldRules?.wildfireSpread !== false;
  const fireSpreadOffsets = FIRE_SPREAD_OFFSETS;
  for (let i = 0; i < nTiles; i++) {
    const t = tiles[i];
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
    if (t.blessedTimer > 0) t.blessedTimer = Math.max(0, t.blessedTimer - dt);
    if (t.cursedTimer > 0) t.cursedTimer = Math.max(0, t.cursedTimer - dt);
    if ((t.crushedTimer ?? 0) > 0) {
      t.crushedTimer = Math.max(0, (t.crushedTimer ?? 0) - dt);
    }
    if (t.tempOffset) {
      const decay = 0.38 * dt;
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
        t.coralBleachTimer = Math.max(0, (t.coralBleachTimer ?? 0) - dt);
        if (t.coralBleachTimer === 0 && t.resourceAmount <= 0) {
          t.resourceAmount = 240;
        }
      }
    }
    if (t.onFireTimer > 0) {
      t.onFireTimer = Math.max(0, t.onFireTimer - dt);
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
          t.resourceAmount = Math.max(0, t.resourceAmount - 34 * dt);
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
          t.resourceAmount = Math.max(0, t.resourceAmount - 42 * dt);
        }
        if (t.resourceAmount <= 0 || t.onFireTimer === 0) {
          t.resourceNode = 'none';
          t.resourceAmount = 0;
          if (hasFlammableGround) {
            t.terrain = 'scorched';
            t.farmSettlementId = undefined;
          }
        }
      } else if (hasFlammableGround && (t.onFireTimer <= 0.8 || t.onFireTimer === 0)) {
        t.terrain = 'scorched';
        t.farmSettlementId = undefined;
      }

      // Wildfire spread from any burning tile (meteor embers, lightning, dragon fire, war-braziers)
      if (t.onFireTimer > 0.6 && wildfireSpreadEnabled) {
        const sourceHeatBoost =
          t.resourceNode === 'timber_grove' ||
          t.burntTree ||
          t.terrain === 'forest' ||
          t.terrain === 'jungle' ||
          t.terrain === 'scorched'
            ? 1.15
            : 1.0;
        for (let k = 0; k < fireSpreadOffsets.length; k++) {
          const [ox, oz, distWeight] = fireSpreadOffsets[k];
          const nb = getTile(state, t.x + ox, t.z + oz);
          if (!nb || nb.height <= 0 || nb.onFireTimer > 0 || nb.blessedTimer > 0) continue;
          if (pendingFireIgnitions?.has(nb)) continue;
          const rate = getTileFlammabilityRate(state, nb) * distWeight * sourceHeatBoost;
          if (rate <= 0) continue;
          const igniteProb = 1 - Math.exp(-rate * dt);
          if (Math.random() < igniteProb) {
            const childDuration =
              nb.buildingId ||
              nb.resourceNode === 'timber_grove' ||
              nb.terrain === 'forest' ||
              nb.terrain === 'jungle' ||
              nb.terrain === 'taiga'
                ? 4.4
                : nb.terrain === 'savanna' ||
                    nb.terrain === 'blossom' ||
                    nb.terrain === 'fertile' ||
                    nb.resourceNode === 'berry_bush' ||
                    nb.farmSettlementId
                  ? 3.9
                  : 3.6;
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
      b.hp = Math.max(0, b.hp - 12 * dt);
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
        if (u.isKing && (u.ageYears ?? 0) < (u.maxLifespan ?? 999)) {
          addChronicle(state, `${u.name} has fallen! The realm mourns and seeks a worthy successor.`, 'warning');
        } else if (u.role === 'leviathan') {
          addChronicle(state, `The Leviathan (${u.name}) has been defeated! The seas are safe again.`, 'divine');
        } else if (u.role === 'dragon') {
          addChronicle(state, `Dragon ${u.name} has been vanquished!`, 'divine');
        }
      }
      continue;
    }

    decayUnitStatusEffects(u, dt);

    if (u.statusEffects.plagued) {
      u.hp -= 4.5 * dt;
      if (activeTickIndex) {
        forEachUnitInRadius(activeTickIndex, u.x, u.z, 1.12, (other, dSq) => {
          if (
            other.id !== u.id &&
            other.state !== 'ko' &&
            other.role !== 'unicorn' &&
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

    if (u.maxLifespan === undefined) {
      u.maxLifespan = getUnitMaxLifespan(u);
    }
    const immortalEntities = state.worldRules?.immortalEntities === true;
    u.ageYears = (u.ageYears ?? Math.max(0, state.year - (u.bornYear ?? state.year))) + YEARS_PER_SEC_AT_1X * dt;

    if (!immortalEntities && u.ageYears >= u.maxLifespan) {
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

    if (u.hp <= 0) {
      u.state = 'ko';
      u.koTimer = 0.45;
      if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
      remainingUnits.push(u);
      continue;
    }

    const def = UNIT_BY_ROLE.get(u.role)!;
    if (u.ageStage === 'child') {
      u.growthTimer = (u.growthTimer ?? 24) - dt;
      if (u.growthTimer <= 0) {
        u.ageStage = 'adult';
        u.growthTimer = undefined;
        u.maxHp = def.maxHp;
        u.hp = Math.min(u.maxHp, u.hp + 30);
      }
    }

    const tileUnder = getTile(state, u.x, u.z);
    const roadBoost = tileUnder?.terrain === 'stone_road' ? 1.45 : tileUnder?.terrain === 'crystal_field' ? 1.6 : 1.0;
    const statusSpeedMult =
      (u.statusEffects.blessed ? 1.6 : 1.0) *
      (u.statusEffects.frenzied ? 1.5 : 1.0) *
      (u.statusEffects.cursed ? 0.55 : 1.0) *
      (u.statusEffects.frozen ? 0.06 : 1.0);
    const ageSpeedMult = u.ageStage === 'child' ? 1.14 : 1.0;
    const moveSpeed = def.speed * roadBoost * statusSpeedMult * ageSpeedMult;

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
      const t = getTile(state, b.tileX, b.tileZ);
      if (t && t.buildingId === b.id) t.buildingId = null;
      if (b.settlementId) destroyedSettlementIds.add(b.settlementId);
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'hit_spark',
        x: b.tileX,
        y: (t?.height ?? 2) * 0.45 + 0.3,
        z: b.tileZ,
        radius: 1.2,
        color: '#ff6b6b',
        createdAt: Date.now(),
      });
      return false;
    }
    return true;
  });

  if (destroyedSettlementIds.size > 0) {
    for (const sid of destroyedSettlementIds) {
      const stillHasBlds = state.buildings.some((b) => b.settlementId === sid);
      const stillHasUnits = state.units.some(
        (u) => u.faction === 'civilization' && u.state !== 'ko' && u.hp > 0 && u.settlementId === sid,
      );
      if (!stillHasBlds && !stillHasUnits) {
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
        for (const t of state.tiles) {
          if (t.farmSettlementId === sid) {
            t.farmSettlementId = undefined;
          }
        }
      }
    }
  }

  // 8b. Void Goo infection spread & Void Wisp soul kinematics
  stepVoidGooAndWisps(state, dt);

  // 8c. Guarantee strictly 1 living King per kingdom on every tick (handles immediate succession when a King falls)
  ensureSettlementKings(state);

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
          const pu = state.units.find((u) => u.id === pid);
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
    if (v.type === 'train' || v.type === 'car' || v.type === 'tank' || v.type === 'glider' || v.type === 'airship') {
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
      v.speed = vEpoch <= 3 ? 2.2 : vEpoch === 4 ? 3.2 : vEpoch === 5 ? 4.2 : 5.2;
      v.y = vEpoch >= 6 ? 0.14 : 0.02;
      const target = v.path[1] ?? v.path[0] ?? { x: v.x, z: v.z };
      const dx = target.x - v.x;
      const dz = target.z - v.z;
      const dist = Math.hypot(dx, dz);
      const step = v.speed * dt;
      if (dist > step && dist > 0.02) {
        v.x += (dx / dist) * step;
        v.z += (dz / dist) * step;
        const desiredHeading = Math.atan2(dx, dz);
        v.heading += wrapAngleRad(desiredHeading - v.heading) * Math.min(1, dt * 14);
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

    const militaryVehiclesCount = state.vehicles.filter((v) => v.isMilitary).length;
    if (militaryVehiclesCount < 24) {
      for (const sid of settlementIds) {
        if (state.vehicles.filter((v) => v.isMilitary).length >= 24) break;
        const cityEpoch = getSettlementTechEpoch(sid);
        if (cityEpoch < 1) continue;
        const sp: SpeciesId = state.settlementSpecies?.[sid] ?? 'human';
        const kid = getKingdomId(state, sid);
        const anchor = getSettlementAnchorForId(state, sid);
        const cityMilitary = state.vehicles.filter((v) => v.isMilitary && v.settlementId === sid);
        const hasType = (t: VehicleType) => cityMilitary.some((v) => v.type === t);

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
            variantSeed: cityMilitary.length + Math.round(sx * 3 + sz * 7),
          });
          cityMilitary.push(state.vehicles![state.vehicles!.length - 1]);
        };

        // 1. Seaborne Warship if coastal water exists nearby (Epoch 1+ Bronze Galley -> Galleon -> Steam Ironclad -> Destroyer -> Plasma Cruiser)
        if (cityEpoch >= 1 && !hasType('warship') && cityMilitary.length < 4) {
          let coastalWater: TileData | null = null;
          for (let r = 4; r <= 18 && !coastalWater; r += 2) {
            for (let a = 0; a < 8; a++) {
              const ang = (a / 8) * Math.PI * 2;
              const wx = Math.round(anchor.x + Math.cos(ang) * r);
              const wz = Math.round(anchor.z + Math.sin(ang) * r);
              const wt = getTile(state, wx, wz);
              if (wt && wt.height === 0) {
                coastalWater = wt;
                break;
              }
            }
          }
          if (coastalWater) {
            trySpawnMilitary('warship', coastalWater.x, coastalWater.z);
          }
        }

        // 2. Ground Battle Vehicle (Epoch 3+ WWI Riveted Trench Tank -> Cast-Turret Tank -> Composite MBT -> Hover Railgun Tank)
        if (cityEpoch >= 3 && !hasType('tank') && cityMilitary.length < 4) {
          const tankX = Math.max(2, Math.min(state.gridSize - 3, anchor.x + 2));
          const tankZ = Math.max(2, Math.min(state.gridSize - 3, anchor.z + 2));
          const tt = getTile(state, tankX, tankZ);
          if (tt && tt.height >= 1 && tt.height <= 5) {
            trySpawnMilitary('tank', tt.x, tt.z);
          }
        }

        // 3. Fixed-Wing Fighter / Bomber branch (Epoch 3 Industrial Propeller Biplane Fighter -> Epoch 4 Prop Heavy Bomber -> Epoch 5+ Stealth Jet / Plasma Bomber; ZERO aircraft in Medieval!)
        if (cityEpoch >= 3 && cityMilitary.length < 4 && !hasType('glider') && !hasType('bomber_plane')) {
          const targetFixedType = getEvolvedMilitaryAirType('glider', cityEpoch, sp);
          trySpawnMilitary(targetFixedType, anchor.x, anchor.z);
        }

        // 4. Lighter-Than-Air / Rotor / VTOL Assault branch (Epoch 3 Industrial Rigid Zeppelin / Sky-Ship -> Epoch 4 Chopper / Orc Skull-Chopper -> Epoch 5 Attack Gunship -> Epoch 6+ Orbital Gunship; ZERO airships in Medieval!)
        if (cityEpoch >= 3 && cityMilitary.length < 4) {
          const targetHoverType = getEvolvedMilitaryAirType('airship', cityEpoch, sp);
          if (
            !hasType('airship') &&
            !hasType('helicopter') &&
            !hasType('orc_flyer') &&
            !hasType('orbital_gunship')
          ) {
            trySpawnMilitary(targetHoverType, anchor.x - 1.5, anchor.z + 1.5);
          }
        }
      }
    }

    // Update & fight with military vehicles
    for (const v of state.vehicles) {
      if (!v.isMilitary || (v.hp ?? 0) <= 0) continue;
      if ((v.attackCooldown ?? 0) > 0) v.attackCooldown = Math.max(0, (v.attackCooldown ?? 0) - dt);
      if ((v.strafeExtendTimer ?? 0) > 0) v.strafeExtendTimer = Math.max(0, (v.strafeExtendTimer ?? 0) - dt);
      const myKid = v.kingdomId ?? getKingdomId(state, v.settlementId);
      const anchor = getSettlementAnchorForId(state, v.settlementId);

      // Find nearest valid threat: hostile raiders, marauding predators near territory, wartime units/buildings/vehicles
      let targetX: number | null = null;
      let targetZ: number | null = null;
      let foundVehTargetUnit: UnitEntity | null = null;
      let targetBld: BuildingEntity | null = null;
      let targetVeh: VehicleEntity | null = null;
      let bestDistSq = 28 * 28;

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
      if (activeTickIndex) {
        forEachUnitInRadius(activeTickIndex, v.x, v.z, 28, considerVehThreat);
      } else {
        for (const other of state.units) {
          considerVehThreat(other, (other.x - v.x) ** 2 + (other.z - v.z) ** 2);
        }
      }
      const targetUnit = foundVehTargetUnit as UnitEntity | null;

      if (!targetUnit) {
        for (const ov of state.vehicles) {
          if (ov.id === v.id || (ov.hp ?? 0) <= 0) continue;
          const oKid = ov.kingdomId ?? getKingdomId(state, ov.settlementId);
          if (!areKingdomsAtWar(state, myKid, oKid)) continue;
          const dSq = (ov.x - v.x) ** 2 + (ov.z - v.z) ** 2;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            targetVeh = ov;
            targetX = ov.x;
            targetZ = ov.z;
          }
        }
      }

      if (!targetUnit && !targetVeh) {
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

      const vEpoch = v.epochLevel ?? getSettlementTechEpoch(v.settlementId);
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
          const nx = Math.max(1, Math.min(state.gridSize - 2, v.x + Math.sin(v.heading) * step));
          const nz = Math.max(1, Math.min(state.gridSize - 2, v.z + Math.cos(v.heading) * step));
          const nextTile = getTile(state, Math.round(nx), Math.round(nz));
          if (isNaval) {
            if (nextTile && nextTile.height === 0) {
              v.x = nx;
              v.z = nz;
            } else {
              // Steer along coastline
              v.heading = wrapAngleRad(v.heading + 1.2 * dt);
            }
          } else if (isGround) {
            if (nextTile && (isHoverTank ? nextTile.height <= 6 : nextTile.height >= 1 && nextTile.height <= 5)) {
              v.x = nx;
              v.z = nz;
            } else {
              v.heading = wrapAngleRad(v.heading + 1.4 * dt);
            }
          } else {
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
            ? '#56cfe1'
            : v.species === 'elf'
              ? '#c084fc'
              : v.species === 'orc'
                ? '#ff3b30'
                : '#ffd166';
        const hitTile = getTile(state, targetX, targetZ);
        const hitY = (hitTile?.height ?? 2) * 0.45 + 0.35;

        const vfxSubtype: VisualEffectEvent['vfxSubtype'] =
          v.type === 'orbital_gunship' || (vEpoch >= 6 && (v.type === 'tank' || v.type === 'warship' || v.type === 'bomber_plane'))
            ? 'plasma_beam'
            : v.species === 'elf' && vEpoch >= 2 && v.type !== 'glider'
              ? 'arcane_bolt'
              : v.type === 'bomber_plane'
                ? targetDist <= 6.2
                  ? 'bomb'
                  : 'bullet'
                : v.type === 'glider'
                  ? 'bullet'
                  : v.type === 'helicopter' || v.type === 'orc_flyer'
                    ? Math.floor(state.year * 10 + v.variantSeed) % 2 === 0
                      ? 'missile'
                      : 'bullet'
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
          if (v.type === 'bomber_plane') {
            // Also drop a visible falling bomb into target just before detonation
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'projectile_tracer',
              vfxSubtype: 'bomb',
              originX: v.x,
              originY: cruiseY + 0.1,
              originZ: v.z,
              x: targetX,
              y: hitY,
              z: targetZ,
              radius: 2.1,
              color: '#ff9e00',
              createdAt: Date.now(),
            });
          }
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: v.species === 'elf' ? 'arcane_cataclysm' : 'nuke_blast',
            originX: v.x,
            originY: cruiseY + 0.25,
            originZ: v.z,
            x: targetX,
            y: hitY,
            z: targetZ,
            radius: 3.4,
            color: v.species === 'elf' ? '#c084fc' : '#ff9e00',
            createdAt: Date.now(),
          });
          applySuperweaponEnvironmentImpact(
            state,
            targetX,
            targetZ,
            3.2,
            v.species === 'elf' ? 'arcane' : 'nuke',
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
                  ? 12
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
          } else if (targetBld) {
            targetBld.hp = Math.max(0, targetBld.hp - dmg * 1.35);
            // Fortified settlements return defensive flak/turret fire against attacking vehicles
            v.hp = Math.max(0, (v.hp ?? 100) - 8);
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
  mode: 'nuke' | 'arcane' | 'battlewill',
  slashHeadingRad?: number,
): void {
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(state.gridSize - 1, Math.ceil(cx + radius + 1));
  const minZ = Math.max(0, Math.floor(cz - radius - 1));
  const maxZ = Math.min(state.gridSize - 1, Math.ceil(cz + radius + 1));

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
      } else if (d <= radius * 0.72 && t.resourceNode !== 'none') {
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      }
      if (t.farmSettlementId) {
        t.farmSettlementId = undefined;
      }

      if (mode === 'nuke') {
        const wasSand = t.terrain === 'sand';
        if (d <= radius * 0.36) {
          t.height = Math.max(1, t.height - 2);
          t.terrain = 'scorched';
          t.onFireTimer = state.worldRules?.wildfireSpread ? 6.0 : 0;
        } else if (d <= radius * 0.68) {
          t.height = Math.max(1, t.height - 1);
          t.terrain = 'scorched';
          if (state.worldRules?.wildfireSpread && (t.x * 13 + t.z * 7) % 3 === 0) {
            t.onFireTimer = 6.5;
          }
        } else if (!t.buildingId) {
          t.terrain = wasSand ? 'crystal_field' : 'scorched';
          if (state.worldRules?.wildfireSpread && (t.x * 17 + t.z * 11) % 4 === 0) {
            t.onFireTimer = 5.0;
          }
        }
      } else if (mode === 'arcane') {
        if (d <= radius * 0.36) {
          t.height = Math.max(1, t.height - 2);
          t.terrain = 'crystal_field';
        } else if (d <= radius * 0.68) {
          t.height = Math.max(1, t.height - 1);
          t.terrain = (t.x + t.z) % 3 === 0 ? 'scorched' : 'crystal_field';
        } else if (!t.buildingId) {
          t.terrain = 'crystal_field';
          if (t.resourceNode === 'none' && (t.x * 19 + t.z * 23) % 13 === 0) {
            t.resourceNode = 'crystal_monolith';
            t.resourceAmount = 220;
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
        if (state.worldRules?.wildfireSpread && (t.x * 11 + t.z * 17) % 5 === 0) {
          t.onFireTimer = 4.5;
        }
      }
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

  if (u.role === 'raider_ranged' || isAlienRanged) {
    const kiteMin = u.role === 'alien_ufo' ? 2.2 : 2.1;
    if (dist < kiteMin && u.role !== 'alien_walker') {
      u.state = 'moving';
      const dx = (u.x - nearestCiv.x) / Math.max(0.1, dist);
      const dz = (u.z - nearestCiv.z) / Math.max(0.1, dist);
      u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + dx * moveSpeed * dt));
      u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + dz * moveSpeed * dt));
    } else if (dist <= def.attackRange) {
      u.state = 'fighting';
      u.targetX = nearestCiv.x;
      u.targetZ = nearestCiv.z;
      if (u.actionCooldown <= 0) {
        u.actionCooldown = u.role === 'alien_walker' ? 1.25 : 0.95;
        if (!nearestCiv.statusEffects.shielded) {
          nearestCiv.hp -= def.attackDamage;
          nearestCiv.lastAttackerId = u.id;
          nearestCiv.underAttackTimer = 8.0;
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
              other.hp -= Math.round(def.attackDamage * 0.45);
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

  if (dist <= def.attackRange) {
    u.state = 'fighting';
    u.targetX = nearestCiv.x;
    u.targetZ = nearestCiv.z;
    if (u.actionCooldown <= 0) {
      u.actionCooldown = 0.75;
      if (!nearestCiv.statusEffects.shielded) {
        nearestCiv.hp -= def.attackDamage;
        nearestCiv.lastAttackerId = u.id;
        nearestCiv.underAttackTimer = 8.0;
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
    t.burntTreeBiome = getTileTreeBiome(t.terrain);
  }
}

function getTileFlammabilityRate(state: SimulationState, t: TileData): number {
  if (!t || t.height <= 0 || t.onFireTimer > 0 || t.blessedTimer > 0) return 0;
  if (t.buildingId) {
    const bld = state.buildings.find((b) => b.id === t.buildingId);
    if (!bld || bld.hp <= 0 || bld.shieldTimer > 0 || bld.blessedTimer > 0) return 0;
    return 0.12;
  }
  if (t.resourceNode === 'timber_grove') return 0.24;
  if (t.resourceNode === 'berry_bush') return 0.17;
  if (t.terrain === 'forest' || t.terrain === 'jungle' || t.terrain === 'taiga') {
    return 0.18;
  }
  if (t.terrain === 'savanna') return 0.18;
  if (t.terrain === 'blossom' || t.terrain === 'fertile') {
    return 0.16;
  }
  if (t.terrain === 'grass') {
    return t.farmSettlementId ? 0.16 : 0.13;
  }
  if (t.terrain === 'highland') return 0.11;
  if (t.terrain === 'swamp') return 0.08;
  return 0;
}

export function isCarnivoreAnimal(role: UnitRole, appearanceSeed?: number): boolean {
  if (role === 'wolf' || role === 'bear') return true;
  if (role === 'dinosaur') return getDinosaurVariant(appearanceSeed).diet === 'carnivore';
  return false;
}

export function isHerbivoreAnimal(role: UnitRole, appearanceSeed?: number): boolean {
  if (role === 'cow' || role === 'pig' || role === 'chicken' || role === 'capybara') return true;
  if (role === 'dinosaur') return getDinosaurVariant(appearanceSeed).diet === 'herbivore';
  return false;
}

function isPredatorRole(role: UnitRole, appearanceSeed?: number): boolean {
  return role === 'dragon' || isCarnivoreAnimal(role, appearanceSeed);
}

function isPreyAnimalRole(role: UnitRole): boolean {
  return role === 'cow' || role === 'pig' || role === 'chicken' || role === 'capybara';
}

function tileIsPlantGrazeGround(t: TileData, allowTrees: boolean): boolean {
  if (t.height <= 0 || t.buildingId || t.onFireTimer > 0 || t.cursedTimer > 0) return false;
  if (t.resourceNode === 'berry_bush' && t.resourceAmount > 0) return true;
  if (allowTrees && t.resourceNode === 'timber_grove' && t.resourceAmount > 0) return true;
  return (
    t.terrain === 'fertile' ||
    t.terrain === 'blossom' ||
    t.terrain === 'grass' ||
    t.terrain === 'savanna' ||
    (allowTrees && (t.terrain === 'forest' || t.terrain === 'jungle'))
  );
}

function tileMatchesWildlifeHabitat(
  state: SimulationState,
  t: TileData,
  role: UnitRole,
  appearanceSeed?: number,
): boolean {
  if (t.height <= 0) return false;
  if (role === 'cow') return t.terrain === 'grass' || t.terrain === 'fertile' || t.terrain === 'savanna';
  if (role === 'chicken') return t.terrain === 'grass' || t.terrain === 'fertile' || t.terrain === 'blossom';
  if (role === 'pig') return t.terrain === 'grass' || t.terrain === 'forest' || t.terrain === 'swamp' || t.terrain === 'fertile';
  if (role === 'capybara') {
    if (t.terrain === 'swamp' || t.terrain === 'jungle') return true;
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
        t.terrain === 'blossom'
      );
    }
    return t.terrain === 'jungle' || t.terrain === 'badlands' || t.terrain === 'highland' || t.terrain === 'savanna';
  }
  if (role === 'dragon') return t.terrain === 'mountain' || t.terrain === 'badlands' || t.terrain === 'rock' || t.terrain === 'highland';
  if (role === 'unicorn') return t.terrain === 'blossom' || t.terrain === 'forest' || t.terrain === 'fertile' || t.terrain === 'grass';
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

  const baseQuotas: Array<{ role: UnitRole; count: number; predator: boolean; appearanceSeed?: number }> = maxToAdd
    ? [
        { role: 'cow', count: 1, predator: false },
        { role: 'pig', count: 1, predator: false },
        { role: 'chicken', count: 1, predator: false },
        { role: 'capybara', count: 1, predator: false },
      ]
    : [
        { role: 'cow', count: 4, predator: false },
        { role: 'pig', count: 4, predator: false },
        { role: 'chicken', count: 5, predator: false },
        { role: 'capybara', count: 4, predator: false },
        { role: 'wolf', count: 4, predator: true },
        { role: 'bear', count: 3, predator: true },
        { role: 'dinosaur', count: isPrehistoric ? 3 : 1, predator: false, appearanceSeed: findDeterministicDinoSeedForMorph(1, 10) },
        { role: 'dinosaur', count: isPrehistoric ? 3 : 1, predator: false, appearanceSeed: findDeterministicDinoSeedForMorph(2, 20) },
        { role: 'dinosaur', count: isPrehistoric ? 4 : 2, predator: true, appearanceSeed: findDeterministicDinoSeedForMorph(0, 30) },
        { role: 'unicorn', count: 2, predator: false },
        { role: 'dragon', count: 2, predator: true },
      ];

  const quotas = baseQuotas.filter((q) => {
    if (!allowFantasy && (q.role === 'unicorn' || q.role === 'dragon')) return false;
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
  let cursor = (state.seed * 2654435761 + state.units.length * 19349663) >>> 0;
  const nextRand = () => {
    cursor = (Math.imul(cursor, 1664525) + 1013904223) >>> 0;
    return cursor / 4294967296;
  };

  for (const q of quotas) {
    if (maxToAdd !== undefined && spawnedTotal >= maxToAdd) break;
    let placed = 0;
    const minCivDist = q.predator ? 16 : 6;

    // Pass 1: habitat-matched tiles
    for (let attempt = 0; attempt < 90 && placed < q.count; attempt++) {
      const tx = 4 + Math.floor(nextRand() * (gs - 8));
      const tz = 4 + Math.floor(nextRand() * (gs - 8));
      const t = getTile(state, tx, tz);
      if (!t || t.height <= 0 || t.buildingId || t.onFireTimer > 0) continue;
      if (!tileMatchesWildlifeHabitat(state, t, q.role, q.appearanceSeed)) continue;
      if (isNearCivilization(tx, tz, minCivDist)) continue;
      const seedForSlot =
        q.appearanceSeed !== undefined
          ? findDeterministicDinoSeedForMorph(getDinosaurVariant(q.appearanceSeed).morph, q.appearanceSeed + placed * 7)
          : undefined;
      const res = spawnUnit(state, q.role, tx, tz, true, undefined, seedForSlot ? { appearanceSeed: seedForSlot } : undefined);
      if (res.ok) {
        placed++;
        spawnedTotal++;
      }
    }

    // Pass 2: fallback any dry wilderness tile
    for (let attempt = 0; attempt < 40 && placed < q.count; attempt++) {
      const tx = 4 + Math.floor(nextRand() * (gs - 8));
      const tz = 4 + Math.floor(nextRand() * (gs - 8));
      const t = getTile(state, tx, tz);
      if (!t || t.height <= 0 || t.buildingId || t.onFireTimer > 0) continue;
      if (isNearCivilization(tx, tz, minCivDist)) continue;
      const seedForSlot =
        q.appearanceSeed !== undefined
          ? findDeterministicDinoSeedForMorph(getDinosaurVariant(q.appearanceSeed).morph, q.appearanceSeed + placed * 7)
          : undefined;
      const res = spawnUnit(state, q.role, tx, tz, true, undefined, seedForSlot ? { appearanceSeed: seedForSlot } : undefined);
      if (res.ok) {
        placed++;
        spawnedTotal++;
      }
    }
  }

  // Seed 1-2 Leviathans ("Bloop") in deep/open ocean tiles if not already present
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
}

function stepWildlifeAI(
  state: SimulationState,
  u: UnitEntity,
  def: typeof UNITS[number],
  moveSpeed: number,
  dt: number,
): void {
  const gs = state.gridSize;
  const isFlying = u.role === 'dragon';
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
  if (curTile && curTile.onFireTimer > 0 && !u.statusEffects.shielded && !isFlying) {
    u.hp -= 10 * dt;
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
            targetUnit.hp = Math.max(0, targetUnit.hp - def.attackDamage);
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

  // Unicorn Mythical Aura: gently blesses & heals nearby friendly citizens and revives scorched earth
  if (u.role === 'unicorn' && u.actionCooldown <= 0) {
    let blessedAny = false;
    const blessUnit = (other: UnitEntity, dSq: number) => {
      if (
        other.faction === 'civilization' &&
        other.state !== 'ko' &&
        dSq <= 20.25 &&
        (other.hp < other.maxHp || other.statusEffects.plagued || other.statusEffects.cursed)
      ) {
        other.hp = Math.min(other.maxHp, other.hp + 14);
        delete other.statusEffects.plagued;
        delete other.statusEffects.cursed;
        blessedAny = true;
      }
    };
    if (activeTickIndex) {
      forEachUnitInRadius(activeTickIndex, u.x, u.z, 4.55, blessUnit);
    } else {
      for (const other of state.units) {
        blessUnit(other, (other.x - u.x) ** 2 + (other.z - u.z) ** 2);
      }
    }
    const rx = Math.round(u.x);
    const rz = Math.round(u.z);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nt = getTile(state, rx + dx, rz + dz);
        if (nt && nt.height > 0 && nt.terrain === 'scorched') {
          nt.terrain = 'blossom';
          blessedAny = true;
        }
      }
    }
    if (blessedAny) {
      u.actionCooldown = 3.2;
    } else {
      u.actionCooldown = 1.2;
    }
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
    if (activeTickIndex) {
      forEachUnitInRadius(activeTickIndex, u.x, u.z, fleeRadius + 0.05, checkThreat);
    } else {
      for (const other of state.units) {
        checkThreat(other, (other.x - u.x) ** 2 + (other.z - u.z) ** 2);
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

    // Herbivore plant-foraging: seek berry bushes (and trees for herbivore dinosaurs) to eat
    const canEatTrees = u.role === 'dinosaur';
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
        u.actionCooldown = 0.55;
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

    const predScanR = u.role === 'dragon' ? 16.05 : isCarnivoreDino || isFrenzied ? 11.05 : u.role === 'wolf' ? 10.05 : u.role === 'bear' ? 9.05 : 5.05;
    const evaluatePredTarget = (other: UnitEntity, dSq: number) => {
      if (other.id === u.id || other.state === 'ko' || other.statusEffects.shielded) return;
      if (other.faction === 'hostile') {
        const maxSq = u.role === 'dragon' ? 256 : u.role === 'unicorn' ? 25 : isCarnivoreDino ? 121 : 100;
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
        (other.role === 'dinosaur' || other.role === 'bear' || other.role === 'wolf')
      ) {
        if (dSq <= 100 && dSq + 10 < bestScore) {
          bestScore = dSq + 10;
          target = other;
        }
      } else if (isCarnivoreDino) {
        // Apex carnivore dinosaur specialty: hunts herbivore dinosaurs, prey animals, rival wolves/bears & nearby citizens
        if (isHerbivoreAnimal(other.role, other.appearanceSeed) && dSq <= 121) {
          const herbBias = other.role === 'dinosaur' ? 4 : 6;
          if (dSq + herbBias < bestScore) {
            bestScore = dSq + herbBias;
            target = other;
          }
        } else if ((other.role === 'wolf' || other.role === 'bear') && dSq <= 100) {
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
      } else if (u.role === 'wolf') {
        // Wolf specialty: swift pack predator targeting small/medium herbivores (chicken, pig, capybara, cow)
        if (isPreyAnimalRole(other.role) && dSq <= 100) {
          const preyBias =
            other.role === 'chicken' ? 2 : other.role === 'pig' || other.role === 'capybara' ? 4 : 7;
          if (dSq + preyBias < bestScore) {
            bestScore = dSq + preyBias;
            target = other;
          }
        } else if (other.faction === 'civilization' && dSq <= 5.5) {
          if (dSq + 14 < bestScore) {
            bestScore = dSq + 14;
            target = other;
          }
        }
      } else if (u.role === 'bear') {
        // Bear specialty: heavy predator hunting herbivores, rival wolves & close trespassers
        if ((isPreyAnimalRole(other.role) || other.role === 'wolf') && dSq <= 81) {
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
    if (activeTickIndex) {
      forEachUnitInRadius(activeTickIndex, u.x, u.z, predScanR, evaluatePredTarget);
    } else {
      for (const other of state.units) {
        evaluatePredTarget(other, (other.x - u.x) ** 2 + (other.z - u.z) ** 2);
      }
    }
    target = target as UnitEntity | null;

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
      const dist = Math.hypot(target.x - u.x, target.z - u.z);
      u.targetX = target.x;
      u.targetZ = target.z;
      const reach = Math.max(
        def.attackRange,
        target.role === 'alien_walker' ? 2.8 : target.role === 'alien_ufo' ? 4.8 : def.attackRange,
      );
      if (dist <= reach) {
        u.state = 'fighting';
        if (u.actionCooldown <= 0) {
          const isDinoChargeHit = u.role === 'dinosaur' && (u.dinoRushTimer ?? 0) > 0 && (u.wildlifeSkillCooldown ?? 0) <= 0;
          const dmg = def.attackDamage * (isFrenzied ? 1.8 : 1.0) * (isDinoChargeHit ? 1.35 : 1.0);
          u.actionCooldown = u.role === 'wolf' ? 0.72 : 0.9;
          u.attackAnimTimer = 0.48;
          u.attackTargetX = target.x;
          u.attackTargetZ = target.z;
          u.dinoRushTimer = 0;
          if (isDinoChargeHit) {
            u.wildlifeSkillCooldown = 5.5;
          }
          target.hp -= dmg;
          target.lastAttackerId = u.id;
          target.underAttackTimer = 8.0;
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
            x: target.x,
            y: 0,
            z: target.z,
            radius: isDinoChargeHit ? 1.8 : u.role === 'dinosaur' ? 0.95 : u.role === 'bear' ? 0.85 : 0.72,
            color,
            createdAt: Date.now(),
          });
        }
      } else {
        u.state = 'moving';
        if (u.role === 'dinosaur' && (u.wildlifeSkillCooldown ?? 0) <= 0 && dist <= 5.2 && dist >= 1.8) {
          u.dinoRushTimer = Math.max(u.dinoRushTimer ?? 0, 0.35);
        }
        const chaseMult = (u.dinoRushTimer ?? 0) > 0 ? 1.68 : 1.0;
        const nx = u.x + ((target.x - u.x) / dist) * moveSpeed * chaseMult * dt;
        const nz = u.z + ((target.z - u.z) / dist) * moveSpeed * chaseMult * dt;
        const nt = getTile(state, nx, nz);
        if (isFlying || (nt && nt.height > 0)) {
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

  // Natural wandering across matching biome tiles (livelier cadence)
  const distToTarget = Math.hypot(u.targetX - u.x, u.targetZ - u.z);
  const currentTileInvalid = !isFlying && (!curTile || curTile.height <= 0);
  if (
    distToTarget < (isFlying ? 2.2 : 0.35) ||
    currentTileInvalid ||
    (u.state === 'idle' && Math.random() < dt * 0.85)
  ) {
    const roamRadius = isFlying ? 18 : isPredator ? 10 : 6.5;
    let chosen: TileData | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const candX = Math.max(2, Math.min(gs - 3, Math.round(u.x + (Math.random() - 0.5) * roamRadius * 2)));
      const candZ = Math.max(2, Math.min(gs - 3, Math.round(u.z + (Math.random() - 0.5) * roamRadius * 2)));
      const ct = getTile(state, candX, candZ);
      if (!ct || ct.height <= 0 || ct.onFireTimer > 0) continue;
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
        const pace = isHerbivore ? 0.72 : 0.84;
        const nx = u.x + (dx / dist) * moveSpeed * pace * dt;
        const nz = u.z + (dz / dist) * moveSpeed * pace * dt;
        const nt = getTile(state, nx, nz);
        if (nt && nt.height > 0) {
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
        const dist = Math.hypot(tx - ux, tz - uz);
        if (t.height <= 0 && !unitOnWaterOrWalkway && dist > 6.5) continue;
        const prefIdx = preferredNodes.indexOf(t.resourceNode);
        if (prefIdx === -1) continue;

        let score = dist + prefIdx * 3.2;
        if (t.height === 0 && !unitOnWaterOrWalkway) score += 8.0;

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
  const warMaxR = isWarriorOrKingOrOrc ? 28 : 18;

  const considerEnemyCandidate = (other: UnitEntity, dSq: number) => {
    if (other.id === u.id || other.state === 'ko' || other.hp <= 0 || dSq >= enemyDistSq) return;
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

    const otherKingdomId =
      other.faction === 'civilization'
        ? idx
          ? idx.unitKingdomId.get(other.id)
          : other.settlementId
            ? getKingdomId(state, other.settlementId)
            : other.kingdomId
        : undefined;
    const isSameKingdom = Boolean(myKingdomId && otherKingdomId && myKingdomId === otherKingdomId);
    const isKingdomWar =
      !isChild &&
      warsEnabled &&
      other.faction === 'civilization' &&
      other.ageStage !== 'child' &&
      !isSameKingdom &&
      Boolean(
        myKingdomId &&
          otherKingdomId &&
          (warEnemiesSet ? warEnemiesSet.has(otherKingdomId) : areKingdomsAtWar(state, myKingdomId, otherKingdomId)),
      );

    // O(1) kin defense lookup (replaces O(N^3) state.units.some scan)
    const isAttackingKin =
      other.faction === 'civilization' &&
      !isSameKingdom &&
      other.state === 'fighting' &&
      dSq <= 14 * 14 &&
      (isKingdomWar ||
        Boolean(mySettlementAttackers?.has(other.id)) ||
        Boolean(myKingdomAttackers?.has(other.id)));

    const isRivalFrenzy = !isChild && Boolean(u.statusEffects.frenzied && !isSameKingdom);

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
    // 5. Active kingdom war enemies — scan ONLY enemy-kingdom units (skips 100% of allies & wildlife)
    if (!isChild && warsEnabled && warEnemiesSet && warEnemiesSet.size > 0) {
      for (const enemyKid of warEnemiesSet) {
        const enemyUnits = idx.livingCivByKingdom.get(enemyKid);
        if (!enemyUnits) continue;
        for (let ei = 0; ei < enemyUnits.length; ei++) {
          const eUnit = enemyUnits[ei];
          considerEnemyCandidate(eUnit, (eUnit.x - u.x) ** 2 + (eUnit.z - u.z) ** 2);
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

    const baseRange =
      u.species === 'human'
        ? hasHumanGuns
          ? 5.8
          : myEpoch >= 1
            ? Math.max(2.0, def.attackRange)
            : def.attackRange
        : u.species === 'elf'
          ? hasElfGuns
            ? 6.2
            : Math.max(4.2, def.attackRange)
          : (u.battlewillActive ?? 0) > 0 || (orcCanBattlewill && (u.battlewillCooldown ?? 0) <= 0)
            ? 4.2
            : Math.max(1.85, def.attackRange);
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
        u.actionCooldown = u.statusEffects.frenzied ? 0.45 : u.species === 'elf' ? 0.68 : 0.78;
        u.attackAnimTimer = 0.45;

        const baseDmg =
          def.attackDamage *
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
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'nuke_blast',
            x: nearestEnemy.x,
            y: targetY,
            z: nearestEnemy.z,
            originX: u.x,
            originY,
            originZ: u.z,
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
            if (u.statusEffects && !u.statusEffects.shielded && hasElfArcaneTech && shotCycle % 4 === 0) {
              u.statusEffects.shielded = 4.0;
            }
            isRangedShot = myEpoch >= 1 || dist > 1.5 || forceVerticalRanged;
            if (myEpoch >= 6) {
              weaponSubtype = shotCycle % 3 === 0 ? 'plasma_beam' : shotCycle % 3 === 1 ? 'arcane_bolt' : 'missile';
              weaponColor = weaponSubtype === 'plasma_beam' ? '#56cfe1' : '#e879f9';
              weaponSplash = weaponSubtype === 'missile' ? 1.8 : 0;
            } else if (myEpoch >= 4) {
              weaponSubtype = shotCycle % 4 === 0 ? 'missile' : shotCycle % 4 === 1 ? 'plasma_beam' : 'arcane_bolt';
              weaponColor = weaponSubtype === 'plasma_beam' ? '#38bdf8' : '#c084fc';
              weaponSplash = weaponSubtype === 'missile' ? 1.6 : 0;
            } else {
              weaponSubtype = shotCycle % 4 === 0 && myEpoch >= 2 ? 'cannon_shell' : 'arcane_bolt';
              weaponColor = hasElfArcaneTech ? '#5eead4' : '#c084fc';
            }
          } else if (u.species === 'human') {
            isRangedShot = hasHumanGuns || (myEpoch >= 1 && dist > 1.6) || forceVerticalRanged;
            if (myEpoch >= 6) {
              weaponSubtype = shotCycle % 3 === 0 ? 'plasma_beam' : shotCycle % 3 === 1 ? 'missile' : 'cannon_shell';
              weaponColor = weaponSubtype === 'plasma_beam' ? '#56cfe1' : '#38bdf8';
              weaponSplash = weaponSubtype !== 'plasma_beam' ? 1.8 : 0;
            } else if (myEpoch >= 4) {
              weaponSubtype = shotCycle % 4 === 0 ? 'missile' : shotCycle % 4 === 1 ? 'cannon_shell' : 'bullet';
              weaponColor = weaponSubtype === 'missile' ? '#ff6b35' : '#ffd166';
              weaponSplash = weaponSubtype !== 'bullet' ? 1.7 : 0;
            } else if (hasHumanGuns) {
              weaponSubtype = shotCycle % 4 === 0 ? 'cannon_shell' : 'bullet';
              weaponColor = '#ffd166';
              weaponSplash = weaponSubtype === 'cannon_shell' ? 1.4 : 0;
            } else {
              weaponSubtype = 'bullet';
              weaponColor = '#fca311';
            }
          } else {
            // Orc arsenal: Iron axes/cleavers early -> Dakka cannons, flak shells & iron rockets later
            isRangedShot = myEpoch >= 3 || (myEpoch >= 2 && dist > 2.2) || forceVerticalRanged;
            if (myEpoch >= 5) {
              weaponSubtype = shotCycle % 3 === 0 ? 'missile' : shotCycle % 3 === 1 ? 'cannon_shell' : 'plasma_beam';
              weaponColor = '#ff5400';
              weaponSplash = 1.9;
            } else if (myEpoch >= 3) {
              weaponSubtype = shotCycle % 3 === 0 ? 'missile' : shotCycle % 3 === 1 ? 'cannon_shell' : 'bullet';
              weaponColor = '#ff4d4d';
              weaponSplash = weaponSubtype !== 'bullet' ? 1.65 : 0;
            } else {
              weaponSubtype = 'cannon_shell';
              weaponColor = '#ff3b30';
            }
          }

          if (isRangedShot) {
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: 'projectile_tracer',
              vfxSubtype: weaponSubtype,
              x: nearestEnemy.x,
              y: targetY,
              z: nearestEnemy.z,
              originX: u.x,
              originY,
              originZ: u.z,
              radius: weaponSplash > 0 ? 1.35 : 0.92,
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

          const strikeDmg =
            baseDmg *
            ((u.battlewillActive ?? 0) > 0 ? 1.55 : 1.0) *
            (weaponSplash > 0 ? 1.18 : 1.0);
          nearestEnemy.hp -= strikeDmg;
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
          }
          if (weaponSplash > 0) {
            for (const cand of state.units) {
              if (cand.id === nearestEnemy.id || cand.id === u.id || cand.state === 'ko' || cand.hp <= 0) continue;
              const cKid =
                cand.faction === 'civilization'
                  ? cand.settlementId
                    ? getKingdomId(state, cand.settlementId)
                    : cand.kingdomId
                  : undefined;
              if (myKingdomId && cKid === myKingdomId) continue;
              if (Math.hypot(cand.x - nearestEnemy.x, cand.z - nearestEnemy.z) <= weaponSplash) {
                cand.hp -= strikeDmg * 0.42;
                cand.lastAttackerId = u.id;
                cand.underAttackTimer = 6.0;
                if (cand.hp <= 0) u.kills = (u.kills ?? 0) + 1;
              }
            }
            if (state.vehicles) {
              for (const ev of state.vehicles) {
                if ((ev.hp ?? 100) <= 0) continue;
                const vKid = ev.kingdomId ?? getKingdomId(state, ev.settlementId);
                if (myKingdomId && vKid === myKingdomId) continue;
                if (Math.hypot(ev.x - nearestEnemy.x, ev.z - nearestEnemy.z) <= weaponSplash + 0.6) {
                  ev.hp = Math.max(0, (ev.hp ?? 100) - strikeDmg * 0.55);
                }
              }
            }
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
    }
    return;
  }

  // 1a. Attack & Destroy Enemy Vehicles or Enemy Buildings belonging to Kingdoms at War!
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
            state.pendingVfx.push({
              id: nextEntityId('vfx'),
              type: myEpoch >= 3 || u.species === 'elf' ? 'projectile_tracer' : 'hit_spark',
              vfxSubtype:
                u.species === 'elf'
                  ? 'arcane_bolt'
                  : myEpoch >= 5
                    ? 'missile'
                    : myEpoch >= 3
                      ? 'bullet'
                      : undefined,
              x: nearestEnemyVeh.x,
              y: (nearestEnemyVeh.y ?? 0.2) + 0.35,
              z: nearestEnemyVeh.z,
              originX: u.x,
              originY: (curTile?.height ?? 2) * 0.45 + 0.35,
              originZ: u.z,
              radius: 1.0,
              color: u.species === 'elf' ? '#56cfe1' : u.species === 'orc' ? '#ff4d4d' : '#ffd166',
              createdAt: Date.now(),
            });
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
      const encroachingHome = distToHomeSq <= 26 * 26 || distToUnitSq <= 24 * 24;
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
          : u.species === 'elf'
            ? Math.max(3.8, def.attackRange)
            : Math.max(isFloatingBld ? 4.2 : 1.6, def.attackRange);
      if (bDist <= effectiveRange) {
        u.state = 'fighting';
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
          }
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: myEpoch >= 3 && u.species !== 'orc' ? 'projectile_tracer' : 'hit_spark',
            x: nearestForeignBld.tileX,
            y: (bTile?.height ?? 2) * 0.45 + 0.35,
            z: nearestForeignBld.tileZ,
            originX: u.species === 'elf' || myEpoch >= 3 ? u.x : undefined,
            originY: u.species === 'elf' || myEpoch >= 3 ? (curTile?.height ?? 2) * 0.45 + 0.35 : undefined,
            originZ: u.species === 'elf' || myEpoch >= 3 ? u.z : undefined,
            radius: 0.9,
            color: u.species === 'elf' ? '#56cfe1' : u.species === 'orc' ? '#ff4d4d' : '#ff9f68',
            createdAt: Date.now(),
          });
        }
      } else {
        u.state = 'moving';
        u.targetX = nearestForeignBld.tileX + personalOffsetX;
        u.targetZ = nearestForeignBld.tileZ + personalOffsetZ;
        const dx = (u.targetX - u.x) / Math.max(0.1, bDist);
        const dz = (u.targetZ - u.z) / Math.max(0.1, bDist);
        advanceUnitPositionWithWaterRules(state, u, dx, dz, moveSpeed, dt, bDist <= 9.0);
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
        u.species === 'human'
          ? 24
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
      const speciesUpgMult = u.species === 'human' ? 1.2 : u.species === 'elf' ? 0.8 : 0.35;
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
        const researchPace = u.species === 'human' ? 1.15 : u.species === 'elf' ? 1.0 : 0.35;
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
    (targetTile.coralBleachTimer ?? 0) <= 0
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
      const workMult =
        (def.harvestRate / 6) *
        coopMult *
        (u.statusEffects.blessed ? 1.75 : 1.0) *
        (u.statusEffects.cursed ? 0.5 : 1.0);
      u.harvestTimer = (u.harvestTimer ?? 0) + dt * workMult;
      if (u.harvestTimer >= 0.8) {
        u.harvestTimer -= 0.8;
        const take = Math.min(targetTile.resourceAmount, 8 + Math.round(def.harvestRate * 0.5));
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

    // Patrol or stroll around OWN settlement (preferring dry land or walkways)
    if (villageBuildings.length > 0) {
      const b = villageBuildings[(indivHash + Math.floor(Math.random() * villageBuildings.length)) % villageBuildings.length];
      u.targetX = Math.max(2, Math.min(state.gridSize - 3, b.tileX + (Math.random() - 0.5) * 5));
      u.targetZ = Math.max(2, Math.min(state.gridSize - 3, b.tileZ + (Math.random() - 0.5) * 5));
    } else {
      u.targetX = Math.max(2, Math.min(state.gridSize - 3, u.x + (Math.random() - 0.5) * 4));
      u.targetZ = Math.max(2, Math.min(state.gridSize - 3, u.z + (Math.random() - 0.5) * 4));
    }
  } else if (distToTarget > 0.35) {
    u.state = 'moving';
    advanceUnitPositionWithWaterRules(state, u, dxT / distToTarget, dzT / distToTarget, moveSpeed, dt, false);
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
      u.role === 'dragon' || u.role === 'dinosaur' || u.role === 'bear'
        ? 3.4
        : u.role === 'cow' || u.role === 'unicorn' || u.role === 'pig' || u.role === 'orc'
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
    const voidIndices: number[] = [];
    for (let i = 0; i < state.tiles.length; i++) {
      if (state.tiles[i].terrain === 'void_goo') {
        voidIndices.push(i);
      }
    }
    if (voidIndices.length > 0 && voidIndices.length < state.tiles.length * 0.92) {
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
      // Shuffle starting offset deterministically so expansion looks organic
      const stride = voidIndices.length > 900 ? 2 : 1;
      const offset = Math.floor(Math.random() * stride);
      for (let idx = offset; idx < voidIndices.length && toInfect.size < 52; idx += stride) {
        const vt = state.tiles[voidIndices[idx]];
        for (let k = 0; k < dirs.length; k++) {
          const [ox, oz] = dirs[k];
          const nx = vt.x + ox;
          const nz = vt.z + oz;
          if (nx < 0 || nz < 0 || nx >= gs || nz >= gs) continue;
          const nb = state.tiles[nz * gs + nx];
          if (!nb || nb.terrain === 'void_goo' || nb.blessedTimer > 0) continue;
          const isDiag = k >= 4;
          if (nb.height > 0) {
            const chance = isDiag ? 0.24 : 0.62;
            if (Math.random() < chance) {
              toInfect.add(nb);
            }
          }
          if (toInfect.size >= 52) break;
        }
      }

      for (const targetTile of toInfect) {
        if (targetTile.height <= 0) continue;
        targetTile.terrain = 'void_goo';
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
    for (const t of state.tiles) {
      const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
      if (dSq <= rSq && t.height === 0) {
        damageOrBleachWaterTile(t, 450, true);
        t.terrain = dSq <= 36 ? 'deep_water' : 'shallow_water';
        delete t.frozenWaterBase;
      }
    }
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
  const outerApronSq = 21.5 * 21.5;
  for (const t of state.tiles) {
    const dx = t.x - targetX;
    const dz = t.z - targetZ;
    const dSq = dx * dx + dz * dz;
    if (dSq > outerApronSq) continue;

    if (t.height === 0) {
      damageOrBleachWaterTile(t, 450, true);
      t.terrain = dSq <= 36 ? 'deep_water' : 'shallow_water';
      delete t.frozenWaterBase;
      t.onFireTimer = 0;
      continue;
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
  }

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
    for (const t of state.tiles) {
      if (t.height > 0 && !t.buildingId && t.resourceNode === 'none') {
        const dSq = (t.x - tx) ** 2 + (t.z - tz) ** 2;
        if (dSq <= 25 && ((t.x * 13 + t.z * 7) % 11 === 0)) {
          t.terrain = 'crystal_field';
          t.resourceNode = 'crystal_monolith';
          t.resourceAmount = 320;
        }
      }
    }
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


