import {
  BUILDINGS,
  EPOCHS,
  GOD_POWERS,
  TERRAIN_TOOLS,
  UNITS,
  getDinosaurVariant,
  getDragonVariant,
  getUnitMaxLifespan,
} from './catalog';
export { getUnitMaxLifespan };
import {
  ActiveHazardZone,
  BuildingEntity,
  BuildingType,
  ChronicleEvent,
  EarthquakeFaultSegment,
  EarthquakeShapeKind,
  GodPowerType,
  Resources,
  SimulationState,
  SpeciesId,
  TerrainToolType,
  TileData,
  UnitAgeStage,
  UnitEntity,
  UnitRole,
  VehicleEntity,
  WorldGenConfig,
  WorldRulesConfig,
  WorldTemplateId,
} from './types';
import { generateUnitGenes, generateUnitItems } from './entityInspector';
import { generateWorldTiles, normalizeSeed } from './worldGen';

const BUILDING_BY_TYPE = new Map(BUILDINGS.map((d) => [d.type, d]));
const UNIT_BY_ROLE = new Map(UNITS.map((d) => [d.role, d]));

const CITIZEN_NAMES = [
  'Kaelen', 'Lyra', 'Theron', 'Vesper', 'Oakhart', 'Soren', 'Mira', 'Darian',
  'Elowen', 'Bram', 'Talia', 'Cassian', 'Nyx', 'Orin', 'Sylvi', 'Alden',
  'Rowan', 'Freya', 'Gideon', 'Isolde', 'Zarek', 'Ariadne', 'Cyrus', 'Veda',
];

const ELF_NAMES = [
  'Aelar', 'Sylva', 'Luthien', 'Faelar', 'Elowen', 'Caelum', 'Thalia', 'Vaelis',
  'Sariel', 'Lyra', 'Nym', 'Orophin',
];

const ORC_NAMES = [
  'Grom', 'Thrak', 'Karg', 'Morg', 'Zug', 'Urzul', 'Bruk', 'Grish',
  'Drog', 'Skarn', 'Vorg', 'Ruk',
];

const VILLAGE_NAMES = [
  'New Aurelia', 'Silver Valen', 'Oak Haven', 'Sun Harbor', 'High Veld', 'Dawn Hold',
  'Star Crest', 'Iron Ford', 'Gold Vale', 'Stone Bridge', 'River Watch', 'Crown Point',
];

const ELF_VILLAGE_NAMES = [
  'Sylvan Glade', 'Star Leaf', 'Silver Bough', 'Moon Well', 'Aether Grove', 'Crystal Spire',
];

const ORC_VILLAGE_NAMES = [
  'Khor Crag', 'Thar Hold', 'Grom Peak', 'Iron Skull', 'Blood Axe', 'Ash Ridge',
];

export const SETTLEMENT_AWARENESS_RADIUS = 12;
export const MAX_CITY_BUILDINGS = 32;
export const MAX_WORLD_CITIES = 8;
export const YEARS_PER_SEC_AT_1X = 1.0;

export function getMaxCityBuildings(epochIndex: number): number {
  if (epochIndex <= 0) return 8;
  if (epochIndex === 1) return 12;
  if (epochIndex === 2) return 15;
  if (epochIndex === 3) return 21; // Industrial: dense brick tenement cities + rail
  if (epochIndex === 4) return 25; // Atomic: mid-rise urban blocks + airport
  if (epochIndex === 5) return 29; // Information: high-density skyscraper metropolis + metro
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

export function formatYearLabel(year: number): string {
  const wholeYear = Math.floor(year + 1e-6);
  if (wholeYear < 0) return `${Math.abs(wholeYear).toLocaleString()} BCE`;
  return `${wholeYear.toLocaleString()} CE`;
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
    defaultWorldName: 'Terra',
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
      startingEpochIndex: 0,
      startingSettlers: 'pioneers',
    },
  },
  {
    id: 'fantastic',
    name: 'Fantastic',
    tagline: 'Elves, Orcs & Dragons',
    description: 'High fantasy realm with mythic beasts and crystal groves.',
    badge: 'Fantasy',
    accentColor: '#c084fc',
    defaultWorldName: 'Aethelgard',
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
      startingEpochIndex: 0,
      startingSettlers: 'pioneers',
    },
  },
  {
    id: 'scifi',
    name: 'Sci-Fi',
    tagline: 'Orbital Age start',
    description: 'Begins in 2150 CE with an established orbital colony.',
    badge: 'Orbital',
    accentColor: '#56cfe1',
    defaultWorldName: 'Helios',
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
      startingEpochIndex: 6,
      startingSettlers: 'colony',
    },
  },
  {
    id: 'prehistoric',
    name: 'Prehistoric',
    tagline: 'Dinosaurs & jungles',
    description: 'Warm primeval continent roaming with Dinosaurs.',
    badge: 'Primeval',
    accentColor: '#fb923c',
    defaultWorldName: 'Pangaea',
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
      startingEpochIndex: 0,
      startingSettlers: 'pioneers',
    },
  },
  {
    id: 'archipelago',
    name: 'Archipelago',
    tagline: 'Island chains & seas',
    description: 'Scattered islands and coastal lagoons.',
    badge: 'Islands',
    accentColor: '#38bdf8',
    defaultWorldName: 'Azure Isles',
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
    defaultWorldName: 'Eden',
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
    seaLevelBias,
    mountainBias,
    climateBias,
    allowFantasyBiomes: rules.allowFantasy,
  });

  const cx = Math.floor(resolvedGridSize / 2);
  const cz = Math.floor(resolvedGridSize / 2);

  const startingEpochIdx = Math.max(0, Math.min(EPOCHS.length - 1, rules.startingEpochIndex ?? 0));
  const startingEpoch = EPOCHS[startingEpochIdx] || EPOCHS[0];
  const startingYearMap = [-10000, -3000, 500, 1820, 1955, 2005, 2150, 2400];
  const startingYear = startingYearMap[startingEpochIdx] ?? -10000;

  const isAdvancedStart = startingEpochIdx >= 4;
  const isSciFiStart = startingEpochIdx >= 6;
  const worldTitle = config?.worldName?.trim() || 'Untouched World';

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
      food: isSciFiStart ? 600 : isAdvancedStart ? 250 : rules.startingSettlers === 'colony' ? 120 : 0,
      wood: isSciFiStart ? 500 : isAdvancedStart ? 220 : rules.startingSettlers === 'colony' ? 100 : 0,
      stone: isSciFiStart ? 500 : isAdvancedStart ? 220 : rules.startingSettlers === 'colony' ? 80 : 0,
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
    worldName: worldTitle,
    worldTemplate: template,
    worldRules: rules,
  };

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

    if (landTile) {
      state.selectedTile = { x: landTile.x, z: landTile.z };
      if (rules.startingSettlers === 'colony') {
        const colonyBuilds: BuildingType[] =
          startingEpochIdx >= 6
            ? [
                'bonfire',
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
                  'granary',
                  'smeltery',
                  'guildhall',
                  'steam_foundry',
                ]
              : ['bonfire', 'forager_hut', 'forager_hut', 'shaman_totem'];

        const prevFree = state.sandboxFreeMode;
        state.sandboxFreeMode = true;
        let bIdx = 0;
        for (let r = 0; r <= 7 && bIdx < colonyBuilds.length; r++) {
          for (let dz = -r; dz <= r && bIdx < colonyBuilds.length; dz++) {
            for (let dx = -r; dx <= r && bIdx < colonyBuilds.length; dx++) {
              if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
              const tx = landTile.x + dx * 2;
              const tz = landTile.z + dz * 2;
              const cand = getTile(state, tx, tz);
              if (!cand || cand.height <= 0 || cand.height >= 4 || cand.buildingId) continue;
              const bType = colonyBuilds[bIdx];
              const res = placeBuilding(state, bType, tx, tz);
              if (res.ok) {
                const placedBld = state.buildings[state.buildings.length - 1];
                if (placedBld) {
                  placedBld.constructionProgress = 100;
                  placedBld.epochLevel = startingEpochIdx;
                }
                bIdx += 1;
              }
            }
          }
        }
        state.sandboxFreeMode = prevFree;

        const settlerCount = startingEpochIdx >= 6 ? 8 : 6;
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
        for (let i = 0; i < 4; i++) {
          const sx = Math.max(2, Math.min(resolvedGridSize - 3, landTile.x + ((i % 2) * 2 - 1)));
          const sz = Math.max(2, Math.min(resolvedGridSize - 3, landTile.z + (Math.floor(i / 2) * 2 - 1)));
          spawnUnit(state, 'human', sx, sz, true);
        }
      }
    }
  }

  ensureSettlementKings(state);
  recalculateRatesAndCaps(state);
  return state;
}

export function recalculateRatesAndCaps(state: SimulationState): void {
  const epoch = EPOCHS[state.epochIndex] || EPOCHS[0];
  const activeSettlementIds = new Set<string>();
  for (const b of state.buildings) {
    if (b.constructionProgress >= 100) {
      activeSettlementIds.add(b.settlementId ?? 'city_default');
    }
  }
  const hasSettlement = activeSettlementIds.size > 0;
  let popCap = activeSettlementIds.size * epoch.populationBonus;

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
    popCap += def.popCapBonus;

    const blessMult = b.blessedTimer > 0 ? 1.75 : b.cursedTimer > 0 ? 0.5 : 1.0;
    const epochMult = 1 + Math.min(4, state.epochIndex) * 0.1;
    const bSpecies: SpeciesId = b.species ?? (b.settlementId ? state.settlementSpecies?.[b.settlementId] : undefined) ?? 'human';
    const paceMult = state.sandboxFreeMode ? 1.0 : 0.62;

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

  if (civCount > 4) {
    const foodUpkeep = Math.floor((civCount - 4) * 0.18);
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
  state.chronicle = [
    {
      id: nextEntityId('chr'),
      yearLabel: formatYearLabel(state.year),
      text,
      tone,
      timestamp: Date.now(),
    },
    ...state.chronicle.slice(0, 29),
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
  if (tile.height <= 0 || tile.terrain === 'deep_water' || tile.terrain === 'shallow_water') {
    return { ok: false, reason: 'Must build on dry land terrace' };
  }
  if (tile.buildingId) {
    return { ok: false, reason: 'Tile already occupied by a structure' };
  }
  if (!canAfford(state.resources, def.cost, state.sandboxFreeMode)) {
    return { ok: false, reason: 'Insufficient resources for construction' };
  }

  state.resources = deductCost(state.resources, def.cost, state.sandboxFreeMode);

  const nearby = findLocalSettlementBuilding(state, tile.x, tile.z, SETTLEMENT_AWARENESS_RADIUS);
  const settlementId = nearby?.settlementId ?? nextEntityId('city');
  if (!state.settlementNames) state.settlementNames = {};
  if (!state.settlementSpecies) state.settlementSpecies = {};
  if (!state.settlementKingdoms) state.settlementKingdoms = {};
  const species: SpeciesId = state.settlementSpecies[settlementId] ?? 'human';
  state.settlementSpecies[settlementId] = species;
  if (!state.settlementNames[settlementId]) {
    state.settlementNames[settlementId] = createVillageName(state, species);
  }
  if (!state.settlementKingdoms[settlementId]) {
    state.settlementKingdoms[settlementId] = settlementId;
  }

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
    epochLevel: state.epochIndex === 0 ? 0 : baseEpochIdx,
    upgradeProgress: 0,
    blessedTimer: 0,
    cursedTimer: 0,
    shieldTimer: 0,
  };

  tile.buildingId = newBuilding.id;
  tile.resourceNode = 'none';
  tile.resourceAmount = 0;
  tile.farmSettlementId = undefined;
  if (tile.terrain === 'stone_road' || tile.terrain === 'runway') {
    tile.terrain = 'grass';
  }
  state.buildings.push(newBuilding);
  state.totalStructuresBuilt += 1;
  if (newBuilding.epochLevel >= 1 || state.epochIndex >= 1) {
    paveSettlementStreetsNear(state, tile.x, tile.z, settlementId);
  }
  if (buildingType === 'rail_station' || state.epochIndex >= 3) {
    paveSettlementRailNetwork(state, settlementId);
  }
  if (buildingType === 'airport') {
    paveAirportRunwayForBuilding(state, tile.x, tile.z);
  }

  const placedKingdomId = getKingdomId(state, settlementId);
  for (const u of state.units) {
    if (u.faction === 'civilization' && u.state !== 'ko' && !u.settlementId) {
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

  if (buildingType === 'dyson_spire' && state.epochIndex < 7) {
    state.epochIndex = 7;
    state.epochProgress = 100;
    addChronicle(state, 'The Dyson Ascension Relay pierces the heavens! Star Age achieved!', 'epoch');
  }

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
  if (!tile || tile.height <= 0) {
    return { ok: false, reason: 'Units must spawn on dry land' };
  }

  const isFree = freeOverride || state.sandboxFreeMode || def.faction === 'hostile';
  if (!isFree && !canAfford(state.resources, def.cost, false)) {
    return { ok: false, reason: 'Insufficient resources to train unit' };
  }

  if (!isFree) {
    state.resources = deductCost(state.resources, def.cost, false);
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
  const growthTimer = ageStage === 'child' ? 22 + (appearanceSeed % 12) : undefined;

  const dinoDiet = role === 'dinosaur' ? getDinosaurVariant(appearanceSeed).diet : undefined;
  const CREATURE_NAMES: Partial<Record<UnitRole, string[]>> = {
    cow: ['Bessie', 'Daisy', 'Clover', 'Buttercup', 'Mooana'],
    pig: ['Porky', 'Truffle', 'Hamlet', 'Rosie', 'Pip'],
    chicken: ['Nugget', 'Sunny', 'Pippin', 'Clucky', 'Henrietta'],
    capybara: ['Gort', 'Mochi', 'Coconut', 'Boba', 'Chill'],
    wolf: ['Fang', 'Fenrir', 'Timber', 'Shadow', 'Ash'],
    bear: ['Barnaby', 'Kodiak', 'Ursa', 'Grizz', 'Bramble'],
    dinosaur:
      dinoDiet === 'carnivore'
        ? ['Rex', 'Chomper', 'Raptor', 'Fangjaw', 'Gorgon']
        : ['Spike', 'Terra', 'Trixie', 'Bronty', 'Ankylo'],
    dragon: ['Ignis', 'Pyre', 'Zephyr', 'Vermithrax', 'Drakon'],
    unicorn: ['Lumina', 'Aurelia', 'Starlight', 'Celeste', 'Seraph'],
  };

  const namePool =
    CREATURE_NAMES[role] ??
    (species === 'elf' ? ELF_NAMES : species === 'orc' ? ORC_NAMES : CITIZEN_NAMES);
  const nameIdx = Math.abs(appearanceSeed + state.units.length * 7) % namePool.length;

  const genes = generateUnitGenes(role, species, appearanceSeed, dinoDiet);
  const maxLifespan = getUnitMaxLifespan({
    role,
    species,
    appearanceSeed,
    genes,
    maxLifespan: options?.maxLifespan,
  });

  const unit: UnitEntity = {
    id: nextEntityId('unit'),
    name: def.faction === 'hostile' ? def.name : namePool[nameIdx],
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
    items: generateUnitItems(role, species, state.epochIndex, appearanceSeed, dinoDiet),
    bornYear: state.year,
    ageYears: Math.max(0, options?.ageYears ?? 0),
    maxLifespan,
    kills: 0,
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

export function applyTerrainTool(
  state: SimulationState,
  toolType: TerrainToolType,
  centerX: number,
  centerZ: number,
  brushRadius = 1,
): { ok: boolean; reason?: string } {
  const def = TERRAIN_TOOLS.find((t) => t.type === toolType);
  if (!def) return { ok: false, reason: 'Unknown terrain tool' };

  const centerTile = getTile(state, centerX, centerZ);
  if (!centerTile) return { ok: false, reason: 'Out of bounds' };

  if (!state.sandboxFreeMode && state.resources.faith < def.faithCost) {
    return { ok: false, reason: 'Need more Faith to sculpt terrain' };
  }

  const targetFlattenHeight = Math.max(1, centerTile.height);
  const clampedRadius = Math.max(0, Math.floor(brushRadius));
  let modifiedCount = 0;

  for (let dz = -clampedRadius; dz <= clampedRadius; dz++) {
    for (let dx = -clampedRadius; dx <= clampedRadius; dx++) {
      if (clampedRadius > 0 && dx * dx + dz * dz > clampedRadius * clampedRadius + 0.5) continue;
      const t = getTile(state, centerX + dx, centerZ + dz);
      if (!t) continue;

      switch (toolType) {
        case 'raise': {
          modifiedCount++;
          if (t.height === 0 && t.terrain === 'deep_water') {
            t.terrain = 'shallow_water';
          } else if (t.height === 0) {
            t.height = 1;
            t.terrain = 'sand';
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
          modifiedCount++;
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
            } else if (t.height <= 7 && t.terrain === 'snow') {
              t.terrain = 'mountain';
            } else if (t.height <= 4 && (t.terrain === 'rock' || t.terrain === 'mountain')) {
              t.terrain = 'highland';
            }
          }
          break;
        }
        case 'flatten': {
          if (t.height === 0 && centerTile.height > 0) {
            if (t.terrain === 'shallow_water') {
              t.height = 1;
              t.terrain = 'sand';
              modifiedCount++;
            }
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
            modifiedCount++;
          }
          break;
        }
        case 'stone_road': {
          // Only pave on solid land above water
          if (t.height > 0) {
            t.terrain = 'stone_road';
            if (!t.buildingId && (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove')) {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            modifiedCount++;
          }
          break;
        }
        case 'rail_track': {
          if (t.height > 0 && !t.buildingId) {
            t.terrain = 'rail_track';
            t.farmSettlementId = undefined;
            if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            modifiedCount++;
          }
          break;
        }
        case 'fertile_meadow': {
          // Only cultivate living, non-dead soil (never on scorched ash, bare rock, snow, sand, swamp, or water)
          if (isCultivableSoil(t)) {
            t.terrain = 'fertile';
            if (!t.buildingId) {
              t.resourceNode = 'berry_bush';
              t.resourceAmount = 220;
            }
            modifiedCount++;
          }
          break;
        }
        case 'plant_forest': {
          // Only plant trees on living, cultivable land (never on scorched dead earth, rock, snow, sand, swamp, or water)
          if (isCultivableSoil(t)) {
            t.terrain = 'forest';
            if (!t.buildingId) {
              t.resourceNode = 'timber_grove';
              t.resourceAmount = 260;
            }
            modifiedCount++;
          }
          break;
        }
        case 'seed_ore': {
          if (t.height > 0) {
            if (t.terrain !== 'scorched' && t.terrain !== 'snow') {
              t.terrain = 'rock';
            }
            if (!t.buildingId) {
              t.resourceNode = (t.x + t.z) % 3 === 0 ? 'crystal_monolith' : 'ore_vein';
              t.resourceAmount = 350;
            }
            modifiedCount++;
          }
          break;
        }
        case 'carve_river': {
          modifiedCount++;
          if (t.height >= 3) {
            t.height = Math.max(1, t.height - 2);
            if (t.terrain === 'snow' || t.terrain === 'rock') t.terrain = 'rock';
          } else if (t.height > 0) {
            t.height = 0;
            t.terrain = 'shallow_water';
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.onFireTimer = 0;
          } else {
            t.terrain = 'deep_water';
          }
          break;
        }
      }
    }
  }

  if (modifiedCount === 0) {
    if (toolType === 'plant_forest' || toolType === 'fertile_meadow') {
      return {
        ok: false,
        reason: 'Cannot cultivate dead or barren land — revive soil with Rain or Bless first!',
      };
    }
    return { ok: false, reason: 'Cannot apply tool on this terrain' };
  }

  if (!state.sandboxFreeMode) {
    state.resources.faith = Math.max(0, state.resources.faith - def.faithCost);
  }

  state.pendingVfx.push({
    id: nextEntityId('vfx'),
    type: 'terrain_sculpt',
    x: centerTile.x,
    y: centerTile.height * 0.45,
    z: centerTile.z,
    radius: brushRadius + 0.5,
    color: def.color,
    createdAt: Date.now(),
  });

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
        if (t.height === 0) {
          if (t.terrain === 'shallow_water' && dSq <= maxRSq * 0.35 && !t.buildingId) {
            t.height = 1;
            t.terrain = 'sand';
          }
          continue;
        }
        if (t.terrain === 'snow' || t.terrain === 'tundra') {
          t.terrain = dSq <= maxRSq * 0.45 ? 'grass' : 'rock';
        } else if (t.terrain === 'swamp') {
          t.terrain = 'savanna';
        } else if (t.terrain === 'fertile' || t.terrain === 'blossom') {
          t.terrain = dSq <= maxRSq * 0.45 ? 'scorched' : 'savanna';
          t.farmSettlementId = undefined;
        } else if (t.terrain === 'grass' || t.terrain === 'taiga') {
          t.terrain = dSq <= maxRSq * 0.38 ? 'scorched' : 'savanna';
        }
        const flammable =
          t.resourceNode === 'timber_grove' ||
          t.resourceNode === 'berry_bush' ||
          t.terrain === 'forest' ||
          t.terrain === 'jungle' ||
          t.terrain === 'savanna' ||
          t.terrain === 'scorched' ||
          Boolean(t.buildingId);
        if (flammable && (dSq <= 4.5 || (allowSpread && ((t.x * 13 + t.z * 7) % 3 === 0)))) {
          t.onFireTimer = Math.max(t.onFireTimer, 6.5);
        }
      }
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded || appliedIds.has(u.id)) continue;
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(u.id);
          delete u.statusEffects.frozen;
          const dmg = u.role === 'dragon' ? 0 : 75;
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
          b.hp = Math.max(0, b.hp - 55);
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
        if (t.height === 0) {
          if (t.terrain === 'shallow_water' && dSq <= maxRSq * 0.3 && !t.buildingId) {
            t.terrain = 'snow';
            t.height = 1;
          }
          continue;
        }
        if (!t.buildingId) {
          if (dSq <= maxRSq * 0.55) {
            t.terrain = 'snow';
          } else if (
            t.terrain === 'grass' ||
            t.terrain === 'fertile' ||
            t.terrain === 'savanna' ||
            t.terrain === 'swamp' ||
            t.terrain === 'scorched' ||
            t.terrain === 'blossom'
          ) {
            t.terrain = 'tundra';
          }
        }
      }
      for (const u of state.units) {
        if (u.state === 'ko' || u.statusEffects.shielded || appliedIds.has(u.id)) continue;
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= unitMaxSq && dSq <= maxRSq) {
          appliedIds.add(u.id);
          u.statusEffects.frozen = 7.5;
          u.hp = Math.max(0, u.hp - 28);
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.45;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          }
        }
      }
      break;
    }

    case 'blessing_wave': {
      for (const t of state.tiles) {
        if (t.height <= 0) continue;
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) continue;
        if (prevR > 0 && dSq < tileMinSq) continue;
        t.onFireTimer = 0;
        t.cursedTimer = 0;
        t.blessedTimer = 30;
        if (t.terrain === 'scorched' || t.terrain === 'swamp' || t.terrain === 'sand') {
          t.terrain = dSq <= maxRSq * 0.45 ? 'fertile' : 'grass';
        } else if (t.terrain === 'grass' && dSq <= maxRSq * 0.35 && !t.buildingId) {
          t.terrain = 'fertile';
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
      break;
    }

    case 'curse_wave': {
      for (const t of state.tiles) {
        if (t.height <= 0) continue;
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) continue;
        if (prevR > 0 && dSq < tileMinSq) continue;
        t.cursedTimer = 30;
        t.blessedTimer = 0;
        if (!t.buildingId) {
          if (t.terrain === 'fertile' || t.terrain === 'forest' || t.terrain === 'jungle' || t.terrain === 'blossom') {
            t.terrain = dSq <= maxRSq * 0.45 ? 'swamp' : 'savanna';
          } else if (t.terrain === 'grass' || t.terrain === 'taiga') {
            t.terrain = dSq <= 4.5 ? 'scorched' : dSq <= maxRSq * 0.6 ? 'swamp' : 'savanna';
          } else if (t.terrain === 'savanna' || t.terrain === 'sand' || t.terrain === 'badlands') {
            t.terrain = dSq <= maxRSq * 0.5 ? 'scorched' : 'sand';
          } else if (t.terrain === 'tundra') {
            t.terrain = 'rock';
          }
        }
        if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
          t.resourceAmount = Math.floor(t.resourceAmount * 0.4);
          if (t.resourceAmount < 20) {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          }
        }
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
      break;
    }

    case 'frenzy_wave': {
      for (const t of state.tiles) {
        if (t.height <= 0 || t.buildingId) continue;
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq > tileMaxSq || dSq > maxRSq) continue;
        if (prevR > 0 && dSq < tileMinSq) continue;
        if (dSq <= 4.2) {
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
        if (isWaterTarget) {
          if (dSq <= maxRSq * 0.38) {
            t.height = Math.max(2, t.height);
            t.terrain = epochIdx >= 6 ? 'crystal_field' : 'fertile';
          } else if (dSq <= maxRSq * 0.72) {
            t.height = Math.max(1, t.height);
            t.terrain = t.height >= 2 ? 'grass' : 'sand';
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
            } else if (t.terrain === 'scorched') {
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
  },
): boolean {
  const def = GOD_POWERS.find((p) => p.type === powerType);
  if (!def) return false;

  const r = def.radius;
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

      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0) {
          t.onFireTimer = 0;
          t.cursedTimer = 0;
          t.blessedTimer = 25;
          const wasScorched = t.terrain === 'scorched';
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
      }
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko') {
          u.hp = Math.min(u.maxHp, u.hp + 25);
        }
      }
      state.resources.food += 45;
      state.resources.wood += 25;
      addChronicle(state, 'Monsoon cloudburst doused all fires and revitalized parched land.', 'divine');
      break;
    }

    case 'eureka': {
      isHeavy = true;
      state.resources.knowledge += 140;
      state.epochProgress = Math.min(100, state.epochProgress + 22);
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
        }
      }
      // Pave stone roads around structures & crystallize nearby stone outcrops
      for (const t of state.tiles) {
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
      }
      addChronicle(state, 'Divine Insight granted +140 Research, completed builds, and paved roads!', 'divine');
      break;
    }

    case 'golden_age': {
      isHeavy = true;
      state.goldenAgeTimer = 35;
      state.happiness = 100;
      state.resources.food += 120;
      state.resources.wood += 80;
      state.resources.faith += 60;
      for (const u of state.units) {
        if (u.faction === 'civilization' && u.state !== 'ko') {
          u.hp = u.maxHp;
          u.statusEffects.blessed = 35;
        }
      }
      for (const t of state.tiles) {
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
      }
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
      addChronicle(state, 'Golden Age dawned! 2x output, imperial roads, and booming towns.', 'epoch');
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
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0) {
          t.onFireTimer = 0;
          t.cursedTimer = 0;
          t.blessedTimer = 30;
        }
      }
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
      addChronicle(state, 'Bloodlust Fury surged outward! Units healed and enraged (+150% combat damage).', 'warning');
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
      addChronicle(state, 'Abyssal Curse crept outward across the land into dark mire.', 'warning');
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
        if (dSq <= rSq && !u.statusEffects.shielded) {
          u.statusEffects.plagued = 26;
        }
      }
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0) {
          t.cursedTimer = 20;
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
      }
      state.happiness = Math.max(15, state.happiness - 12);
      addChronicle(state, 'Bio-Toxic Plague Miasma corrupted the land into a festering swamp!', 'warning');
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
        if (dSq <= rSq && b.shieldTimer <= 0) {
          const coreDmg = dSq <= (r * 0.68) ** 2 ? 390 : 240;
          b.hp = Math.max(0, b.hp - coreDmg);
          const bt = getTile(state, b.tileX, b.tileZ);
          if (bt && bt.height > 0 && bt.blessedTimer <= 0 && b.hp > 0) {
            bt.onFireTimer = Math.max(bt.onFireTimer, 8.0);
          }
        }
      }
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= 4.5 && t.height > 0) {
          if (dSq <= 2.2 && t.height >= 2 && !t.buildingId) {
            t.height = Math.max(1, t.height - 1);
          }
          // Sand fuses into fulgurite crystal_field; snow melts to rock; vegetation chars to scorched
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
            state.resources.wood += 10;
          }
        } else if (dSq <= rSq * 1.18 && t.height > 0) {
          if (dSq <= 6.25 && !t.buildingId) {
            if (t.terrain === 'sand') t.terrain = 'crystal_field';
            else if (t.terrain === 'snow') t.terrain = 'rock';
            else t.terrain = 'scorched';
            if (t.resourceNode === 'timber_grove') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
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
      }
      addChronicle(
        state,
        isWaterStrike
          ? 'Chain Lightning electrified the sea across an expanded conductive radius!'
          : 'Chain Lightning shattered the earth, blasting targets and igniting fires!',
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
        for (const t of state.tiles) {
          const dx = t.x - targetX;
          const dz = t.z - targetZ;
          const dSq = dx * dx + dz * dz;
          if (dSq <= (r * 1.55) ** 2) {
            t.onFireTimer = 0;
            t.cursedTimer = 0;
            if (t.height === 0) {
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
        }

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

        addChronicle(
          state,
          'Asteroid plunged into the sea, unleashing a colossal Tsunami wave across the coastlines!',
          'warning',
        );
        break;
      }

      // LAND ASTEROID IMPACT: Carves crater relative to existing land elevation without turning ocean tiles into land
      const baseH = Math.max(2, centerTile.height);
      let waterTilesInRadius = 0;
      let waterSumX = 0;
      let waterSumZ = 0;
      for (const t of state.tiles) {
        const dx = t.x - targetX;
        const dz = t.z - targetZ;
        const dSq = dx * dx + dz * dz;
        if (dSq <= rSq) {
          if (t.height === 0) {
            // Water tiles stay water (never raise land in water!)
            waterTilesInRadius++;
            waterSumX += t.x;
            waterSumZ += t.z;
            t.terrain = dSq <= 12.0 ? 'deep_water' : 'shallow_water';
            t.onFireTimer = 0;
            continue;
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
            // 4. Outer scorched blast ring with hot crater embers
            t.terrain = 'scorched';
            if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
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
      }

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
      state.resources.ore += 110;
      state.resources.alloy += 45;
      addChronicle(state, 'Cataclysmic Meteor obliterated structures, carved a crater & raised a rocky rim!', 'warning');
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
          ? 'Orbital Terraform began sculpting a sanctuary atoll ring by ring from the sea!'
          : 'Orbital Terraform began revitalizing the terrain outward into a stepped plateau!',
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
      state.resources.energy += 220;
      state.resources.alloy += 140;
      state.resources.knowledge += 160;
      state.epochProgress = Math.min(100, state.epochProgress + 28);
      for (const t of state.tiles) {
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
      }
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
      addChronicle(state, 'Black Hole singularity tore open, orbiting land & life before critical collapse!', 'epoch');
      break;
    }

    case 'drag_entity': {
      isHeavy = false;
      break;
    }

    case 'heat_wave': {
      isHeavy = true;
      // Cancel any expanding freeze front nearby so opposing waves don't re-freeze behind this heat wave
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
        remaining: 1.65,
        duration: 1.65,
        tickTimer: 0,
      };
      applyExpandingWaveSlice(state, 'heat_wave_zone', targetX, targetZ, r, 0, seedR, getWaveAppliedSet(haz));
      state.activeHazards.push(haz);
      addChronicle(state, 'A scorching Heat Wave swept outward, melting frost and igniting dry ground!', 'warning');
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
        remaining: 1.75,
        duration: 1.75,
        tickTimer: 0,
      };
      applyExpandingWaveSlice(state, 'freeze_wave_zone', targetX, targetZ, r, 0, seedR, getWaveAppliedSet(haz));
      state.activeHazards.push(haz);
      addChronicle(state, 'A Sub-Zero Frost Wave crept across the earth, extinguishing fires and freezing units!', 'divine');
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
      addChronicle(state, 'A roaring Tornado cyclone touched down, sweeping across the realm!', 'warning');
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
      addChronicle(state, 'A towering Tsunami surged forth, drowning shores and smashing coastal towns!', 'warning');
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

      for (const t of state.tiles) {
        if (t.height === 0) continue; // Never thrust ocean floor tiles into dry land
        if (t.x < minX || t.x > maxX || t.z < minZ || t.z > maxZ) continue;

        const dCenterSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        const { distSq, signedSide, segment } = closestFaultDistanceSq(t.x, t.z, faultSegments);
        if (!segment) continue;

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
      }

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

      state.happiness = Math.max(15, state.happiness - 8);
      const chronicleMsg =
        quakeShapeKind === 'orogenic_uplift' || mountainsFormed >= 12
          ? 'Tectonic upheaval slammed plates together, forging jagged new mountain peaks!'
          : quakeShapeKind === 'long_rift'
            ? 'A colossal winding fault rift tore across the landscape!'
            : quakeShapeKind === 'branching_fault'
              ? 'Branching fault fractures forked across the earth and heaved rocky ridges!'
              : displacedTiles > 0
                ? 'A sharp tectonic rupture split open terrain and rattled nearby foundations!'
                : 'Seismic tremors shook the earth and rattled foundations!';
      addChronicle(state, chronicleMsg, 'warning');
      break;
    }
  }

  recalculateRatesAndCaps(state);
  return isHeavy;
}

export function castGodPower(
  state: SimulationState,
  powerType: GodPowerType,
  targetX: number,
  targetZ: number,
  options?: { deferImpact?: boolean },
): { ok: boolean; reason?: string; isHeavy?: boolean } {
  const def = GOD_POWERS.find((p) => p.type === powerType);
  if (!def) return { ok: false, reason: 'Unknown divine power' };

  if (!state.sandboxFreeMode && state.resources.faith < def.faithCost) {
    return { ok: false, reason: `Requires ${def.faithCost} Faith` };
  }

  if (!state.sandboxFreeMode) {
    state.resources.faith = Math.max(0, state.resources.faith - def.faithCost);
  }

  const centerTile = getTile(state, targetX, targetZ);
  const baseHeight = centerTile ? centerTile.height * 0.45 : 1.2;

  const deferImpact = Boolean(options?.deferImpact);
  let isHeavy =
    powerType !== 'blessing' &&
    powerType !== 'rain_of_plenty' &&
    powerType !== 'freeze_snap' &&
    powerType !== 'drag_entity';

  const earthquakePlan =
    powerType === 'earthquake' ? generateEarthquakeFaultNetwork(targetX, targetZ, def.radius) : null;

  if (!deferImpact) {
    isHeavy = executeGodPowerImpact(
      state,
      powerType,
      targetX,
      targetZ,
      earthquakePlan ?? undefined,
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
      radius: def.radius,
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
    radius: earthquakePlan?.quakeExtent ?? def.radius,
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
  const pool =
    species === 'elf'
      ? ELF_VILLAGE_NAMES
      : species === 'orc'
        ? ORC_VILLAGE_NAMES
        : VILLAGE_NAMES;
  for (const name of pool) {
    if (!used.has(name)) return name;
  }
  return `Haven ${used.size + 1}`;
}

function getKingdomId(state: SimulationState, settlementId: string): string {
  return state.settlementKingdoms?.[settlementId] ?? settlementId;
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
      // Variant 0: Perimeter Loops & Crossroads (scales outward for dense urbanized blocks)
      const onPerimeterLoop = (maxD === 4 || maxD === 8 || maxD === 12) && adx <= maxD && adz <= maxD;
      const onCrossAvenue = (dx === 0 && dz >= -12 && dz <= 12) || (dz === 0 && dx >= -12 && dx <= 12);
      return onPerimeterLoop || onCrossAvenue;
    }
    case 1: {
      // Variant 1: Twin Boulevards & Cross Streets
      const onBoulevard = (dz === -9 || dz === -5 || dz === -1 || dz === 3 || dz === 7 || dz === 11) && adx <= 12;
      const onCross = (dx === -10 || dx === -6 || dx === -2 || dx === 2 || dx === 6 || dx === 10) && adz <= 11;
      return onBoulevard || onCross;
    }
    case 2: {
      // Variant 2: Civic Plaza Ring & Radial Spokes
      const onRing = maxD === 2 || maxD === 6 || maxD === 10;
      const onSpoke = (dx === 0 && adz >= 2 && adz <= 12) || (dz === 0 && adx >= 2 && adx <= 12);
      return onRing || onSpoke;
    }
    default: {
      // Variant 3: Urban Commons with staggered T-junctions & outer ring
      const onMainSpine = (dz === 1 && dx >= -12 && dx <= 12) || (dx === -1 && dz >= -12 && dz <= 12);
      const onLoopBranch =
        (dx === 3 && dz >= -6 && dz <= 7) ||
        (dx === -5 && dz >= -4 && dz <= 6) ||
        (dz === -3 && dx >= -6 && dx <= 6) ||
        (dz === 5 && dx >= -6 && dx <= 6) ||
        maxD === 10;
      return onMainSpine || onLoopBranch;
    }
  }
}

function paveRailTileIfClean(state: SimulationState, x: number, z: number): boolean {
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
  if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
    t.resourceNode = 'none';
    t.resourceAmount = 0;
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

export function paveSettlementRailNetwork(state: SimulationState, settlementId = 'city_default'): void {
  const villageBuildings = state.buildings.filter((b) => (b.settlementId ?? 'city_default') === settlementId);
  if (villageBuildings.length === 0) return;

  const anchor = getSettlementAnchorForId(state, settlementId);
  const variant = getSettlementLayoutVariant(state, settlementId, anchor.x, anchor.z);
  // Choose a perimeter metro loop ring that minimizes road overlap for each street layout
  const metroRadius = (variant & 3) === 0 ? 6 : (variant & 3) === 1 ? 8 : 8;

  for (let d = -metroRadius; d <= metroRadius; d++) {
    paveRailTileIfClean(state, anchor.x + d, anchor.z - metroRadius);
    paveRailTileIfClean(state, anchor.x + d, anchor.z + metroRadius);
    paveRailTileIfClean(state, anchor.x - metroRadius, anchor.z + d);
    paveRailTileIfClean(state, anchor.x + metroRadius, anchor.z + d);
  }

  // Link any rail_station in this settlement directly to the city metro loop
  for (const b of villageBuildings) {
    if (b.type !== 'rail_station') continue;
    const targetRingX =
      Math.abs(b.tileX - anchor.x) >= Math.abs(b.tileZ - anchor.z)
        ? anchor.x + (b.tileX >= anchor.x ? metroRadius : -metroRadius)
        : b.tileX;
    const targetRingZ =
      Math.abs(b.tileZ - anchor.z) > Math.abs(b.tileX - anchor.x)
        ? anchor.z + (b.tileZ >= anchor.z ? metroRadius : -metroRadius)
        : b.tileZ;
    let cx = b.tileX;
    let cz = b.tileZ;
    let guard = 0;
    while ((cx !== targetRingX || cz !== targetRingZ) && guard < 24) {
      guard += 1;
      if (cx !== targetRingX) cx += cx < targetRingX ? 1 : -1;
      else if (cz !== targetRingZ) cz += cz < targetRingZ ? 1 : -1;
      paveRailTileIfClean(state, cx, cz);
    }
  }

  // Inter-city railway corridor linking this city's metro ring to the nearest other settlement
  const allSids = Array.from(new Set(state.buildings.map((b) => b.settlementId ?? 'city_default')));
  if (allSids.length > 1) {
    let nearestOther: { x: number; z: number } | null = null;
    let bestDist = Infinity;
    for (const otherSid of allSids) {
      if (otherSid === settlementId) continue;
      const oa = getSettlementAnchorForId(state, otherSid);
      const d = Math.hypot(oa.x - anchor.x, oa.z - anchor.z);
      if (d < bestDist && d > 12) {
        bestDist = d;
        nearestOther = oa;
      }
    }
    if (nearestOther) {
      let cx = anchor.x + (nearestOther.x >= anchor.x ? metroRadius : -metroRadius);
      let cz = anchor.z + 2;
      const tx = nearestOther.x;
      const tz = nearestOther.z + 2;
      let steps = 0;
      while ((cx !== tx || cz !== tz) && steps < state.gridSize * 2) {
        steps += 1;
        if (Math.abs(cx - tx) >= Math.abs(cz - tz) && cx !== tx) {
          cx += cx < tx ? 1 : -1;
        } else if (cz !== tz) {
          cz += cz < tz ? 1 : -1;
        }
        paveRailTileIfClean(state, cx, cz);
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
  const anchor = getSettlementAnchorForId(state, settlementId);
  const variant = getSettlementLayoutVariant(state, settlementId, anchor.x, anchor.z);

  const ownTile = getTile(state, bx, bz);
  if (ownTile && ownTile.buildingId && ownTile.terrain === 'stone_road') {
    ownTile.terrain = 'grass';
  }

  let pavedAdjacent = false;
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const t = getTile(state, bx + dx, bz + dz);
      if (!t || t.height <= 0 || t.buildingId || t.resourceNode !== 'none') continue;
      if (
        t.terrain === 'deep_water' ||
        t.terrain === 'shallow_water' ||
        t.terrain === 'crystal_field' ||
        t.terrain === 'rail_track' ||
        t.terrain === 'runway'
      ) {
        continue;
      }
      const relX = t.x - anchor.x;
      const relZ = t.z - anchor.z;
      if (isSettlementRoadTile(relX, relZ, variant)) {
        t.terrain = 'stone_road';
        t.farmSettlementId = undefined;
        if (Math.abs(dx) + Math.abs(dz) === 1) pavedAdjacent = true;
      }
    }
  }

  // Ensure every completed building has at least 1 unblocked street tile along its frontage
  if (!pavedAdjacent) {
    const dirs = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    for (const [ox, oz] of dirs) {
      const nt = getTile(state, bx + ox, bz + oz);
      if (nt && nt.height > 0 && !nt.buildingId && nt.resourceNode === 'none') {
        if (nt.terrain === 'stone_road') {
          pavedAdjacent = true;
          break;
        }
      }
    }
    if (!pavedAdjacent) {
      for (const [ox, oz] of dirs) {
        const nt = getTile(state, bx + ox, bz + oz);
        if (
          nt &&
          nt.height > 0 &&
          !nt.buildingId &&
          nt.resourceNode === 'none' &&
          nt.terrain !== 'crystal_field' &&
          nt.terrain !== 'rail_track' &&
          nt.terrain !== 'runway'
        ) {
          nt.terrain = 'stone_road';
          nt.farmSettlementId = undefined;
          break;
        }
      }
    }
  }
}

function findBuildableTileNear(
  state: SimulationState,
  anchorX: number,
  anchorZ: number,
  maxRadius = 18,
  settlementId = 'city_default',
): TileData | null {
  const anchorTile = getTile(state, anchorX, anchorZ);
  const preferredHeight = anchorTile && anchorTile.height > 0 ? anchorTile.height : 2;
  const variant = getSettlementLayoutVariant(state, settlementId, anchorX, anchorZ);
  const villageBuildings = state.buildings.filter(
    (b) => (b.settlementId ?? 'city_default') === settlementId,
  );

  let bestLot: TileData | null = null;
  let bestScore = Infinity;
  let emergencyFallback: TileData | null = null;

  for (let r = 1; r <= maxRadius; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const t = getTile(state, anchorX + dx, anchorZ + dz);
        if (!t || t.height <= 0 || t.height >= 6 || t.buildingId) continue;
        if (t.terrain === 'deep_water' || t.terrain === 'shallow_water') continue;

        if (!emergencyFallback) emergencyFallback = t;

        // Never place buildings on existing roads, rail tracks, runways, or designated street corridors!
        if (
          t.terrain === 'stone_road' ||
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
          if (!nt || nt.height <= 0) continue;
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

        // Check proximity to existing village buildings to form cohesive cottage clusters
        let nearCottageCount = 0;
        for (const b of villageBuildings) {
          const bDist = Math.max(Math.abs(b.tileX - t.x), Math.abs(b.tileZ - t.z));
          if (bDist === 1) nearCottageCount += 2;
          else if (bDist === 2) nearCottageCount += 1;
        }

        const dist = Math.hypot(dx, dz);
        let score = dist * 2.4;
        if (touchesStreet) score -= 18;
        if (nearCottageCount > 0) score -= Math.min(14, nearCottageCount * 4.5);
        if (t.height === preferredHeight) score -= 8;
        else score += Math.abs(t.height - preferredHeight) * 5;
        if (t.resourceNode === 'none') score -= 7;
        else score += 9;

        // Deterministic micro-tiebreaker for organic neighborhood variety
        const tieBreaker = (((t.x * 37 + t.z * 19 + variant * 13) & 15) / 16) * 1.4;
        score += tieBreaker;

        if (score < bestScore) {
          bestScore = score;
          bestLot = t;
        }
      }
    }
    if (bestLot && r >= 4 && bestScore < -10) {
      return bestLot;
    }
  }
  return bestLot ?? emergencyFallback;
}

export function advanceEpoch(
  state: SimulationState,
  divineLeapOverride = false,
): { ok: boolean; reason?: string; newEpoch?: typeof EPOCHS[number] } {
  if (state.epochIndex >= EPOCHS.length - 1) {
    state.outcome = 'ascension_victory';
    return { ok: false, reason: 'Already in the Interstellar Age' };
  }

  const nextEpoch = EPOCHS[state.epochIndex + 1];
  const free = divineLeapOverride || state.sandboxFreeMode;

  if (!free && !canAfford(state.resources, nextEpoch.unlockCost, false)) {
    return { ok: false, reason: `Insufficient resources to enter the ${nextEpoch.name}` };
  }

  if (!free) {
    state.resources = deductCost(state.resources, nextEpoch.unlockCost, false);
  }

  state.epochIndex += 1;
  state.epochProgress = 0;

  const epochYears = [-10000, -3000, 1150, 1860, 1965, 2015, 2130, 2480];
  state.year = epochYears[state.epochIndex] ?? state.year + 500;

  // Heal existing structures and kick off their individual progression toward the new epoch
  for (const b of state.buildings) {
    b.hp = b.maxHp;
    const bTile = getTile(state, b.tileX, b.tileZ);
    if (bTile && bTile.terrain === 'stone_road') {
      bTile.terrain = 'grass';
    }
    if (b.epochLevel < state.epochIndex) {
      b.upgradeProgress = Math.max(b.upgradeProgress ?? 0, divineLeapOverride ? 35 : 18);
    }
  }

  const anchor = getSettlementAnchor(state);

  // Transform street & rail transit network around each independent settlement & erect epoch landmark
  if (state.buildings.length > 0) {
    const settlementIds = Array.from(new Set(state.buildings.map((b) => b.settlementId ?? 'city_default')));

    for (const sid of settlementIds) {
      const cityAnchor = getSettlementAnchorForId(state, sid);
      const variant = getSettlementLayoutVariant(state, sid, cityAnchor.x, cityAnchor.z);
      const radius = state.epochIndex >= 3 ? 9 : 5;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (!isSettlementRoadTile(dx, dz, variant)) continue;
          const pt = getTile(state, cityAnchor.x + dx, cityAnchor.z + dz);
          if (pt && pt.height > 0 && !pt.buildingId && pt.resourceNode === 'none' && pt.terrain !== 'rail_track') {
            pt.terrain = 'stone_road';
            pt.farmSettlementId = undefined;
          }
        }
      }
      if (state.epochIndex >= 3) {
        paveSettlementRailNetwork(state, sid);
      }
    }

    const primarySid = settlementIds[0];
    const primaryAnchor = getSettlementAnchorForId(state, primarySid);

    // Erect the signature landmark of the newly reached age on an unblocked lot
    const epochBuildings = BUILDINGS.filter((b) => b.epoch === nextEpoch.id);
    if (epochBuildings.length > 0) {
      const bDef = epochBuildings[0];
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
          epochLevel: state.epochIndex,
          blessedTimer: 15,
          cursedTimer: 0,
          shieldTimer: 0,
        };
        padTile.buildingId = newBld.id;
        state.buildings.push(newBld);
        state.totalStructuresBuilt += 1;
        paveSettlementStreetsNear(state, padTile.x, padTile.z, primarySid);
        if (state.epochIndex >= 3) {
          paveSettlementRailNetwork(state, primarySid);
        }
      }
    }

    const bonusRole: UnitRole =
      state.epochIndex >= 6 ? 'astro_engineer' : state.epochIndex >= 2 ? 'scholar' : 'builder';
    spawnUnit(state, bonusRole, primaryAnchor.x, primaryAnchor.z, true, primarySid);
  }

  const centerTile = getTile(state, anchor.x, anchor.z);
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

  addChronicle(
    state,
    `Civilization has ascended to the ${nextEpoch.name} (${nextEpoch.yearLabel})!`,
    'epoch',
  );

  recalculateRatesAndCaps(state);
  return { ok: true, newEpoch: nextEpoch };
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
): void {
  if (amount <= 0) return;
  state.resources[key] += amount;
  if (!state.harvestAccumulator) state.harvestAccumulator = emptyResources();
  state.harvestAccumulator[key] += amount;
}

function pickDesiredAutobuildType(
  state: SimulationState,
  villageBuildings: BuildingEntity[],
  villagePop: number,
  species: SpeciesId = 'human',
): BuildingType | null {
  const maxCityBuildings = getMaxCityBuildings(state.epochIndex);
  if (villageBuildings.length >= maxCityBuildings) return null;

  const countType = (t: BuildingType) => villageBuildings.filter((b) => b.type === t).length;
  const targetCottages = Math.min(18, Math.max(4, Math.floor(villagePop * 0.9)));

  if (countType('bonfire') === 0) return 'bonfire';
  if (countType('forager_hut') < Math.min(4, targetCottages)) return 'forager_hut';
  if (countType('shaman_totem') < 1) return 'shaman_totem';

  // Elves strongly prioritize magical & arcane-tech sanctums
  if (species === 'elf' && countType('shaman_totem') < 2) return 'shaman_totem';

  if (state.epochIndex === 0) {
    if (countType('forager_hut') < Math.min(6, targetCottages)) return 'forager_hut';
    if (countType('shaman_totem') < (species === 'elf' ? 3 : 2)) return 'shaman_totem';
    return null;
  }

  // Orcs are barbarian clans that build more huts/granaries/forges before slowly adopting higher-age structures
  if (species === 'orc') {
    if (countType('forager_hut') < Math.min(8, targetCottages)) return 'forager_hut';
    if (countType('granary') < 2) return 'granary';
    if (countType('smeltery') < 2) return 'smeltery';
    if (state.epochIndex >= 2 && countType('guildhall') < 2) return 'guildhall';
    if (state.epochIndex >= 2 && countType('observatory') < 1 && villageBuildings.length >= 10) return 'observatory';
    if (state.epochIndex >= 3 && countType('steam_foundry') < 2) return 'steam_foundry';
    if (state.epochIndex >= 3 && countType('rail_station') < 1 && villageBuildings.length >= 12) return 'rail_station';
    if (state.epochIndex >= 4 && countType('fission_reactor') < 1 && villageBuildings.length >= 15) return 'fission_reactor';
    if (state.epochIndex >= 5 && countType('cyber_institute') < 1 && villageBuildings.length >= 18) return 'cyber_institute';
    if (state.epochIndex >= 6 && countType('launch_arcology') < 1 && villageBuildings.length >= 20) return 'launch_arcology';
    if (countType('forager_hut') < targetCottages) return 'forager_hut';
    return null;
  }

  if (state.epochIndex >= 1) {
    if (countType('granary') < 1) return 'granary';
    if (species === 'elf' && countType('ziggurat') < 2) return 'ziggurat';
    if (species === 'human' && countType('smeltery') < 2) return 'smeltery';
    if (countType('ziggurat') < 1) return 'ziggurat';
    if (countType('forager_hut') < Math.min(7, targetCottages)) return 'forager_hut';
    if (countType('smeltery') < (species === 'elf' ? 1 : 2)) return 'smeltery';
    if (countType('granary') < 2) return 'granary';
    if (countType('shaman_totem') < (species === 'elf' ? 3 : 2)) return 'shaman_totem';
  }
  if (state.epochIndex >= 2) {
    if (species === 'elf' && countType('observatory') < 2) return 'observatory';
    if (countType('guildhall') < 2) return 'guildhall';
    if (countType('forager_hut') < Math.min(9, targetCottages)) return 'forager_hut';
    if (countType('observatory') < (species === 'human' || species === 'elf' ? 2 : 1)) return 'observatory';
    if (countType('guildhall') < 3) return 'guildhall';
  }
  if (state.epochIndex >= 3) {
    if (countType('rail_station') < 1) return 'rail_station';
    if (species === 'human' && countType('dynamo_plant') < 2) return 'dynamo_plant';
    if (countType('steam_foundry') < (species === 'elf' ? 1 : 2)) return 'steam_foundry';
    if (countType('dynamo_plant') < 2) return 'dynamo_plant';
    if (countType('guildhall') < 4) return 'guildhall';
    if (countType('forager_hut') < Math.min(12, targetCottages)) return 'forager_hut';
  }
  if (state.epochIndex >= 4) {
    if (countType('airport') < 1) return 'airport';
    if (species === 'elf' && countType('cyber_institute') < 2) return 'cyber_institute';
    if (countType('fission_reactor') < 2) return 'fission_reactor';
    if (countType('cyber_institute') < 2) return 'cyber_institute';
    if (countType('guildhall') < 5) return 'guildhall';
    if (countType('forager_hut') < Math.min(14, targetCottages)) return 'forager_hut';
  }
  if (state.epochIndex >= 5) {
    if (countType('rail_station') < 2) return 'rail_station';
    if (countType('cyber_institute') < 3) return 'cyber_institute';
    if (countType('guildhall') < 7) return 'guildhall';
    if (countType('forager_hut') < Math.min(16, targetCottages)) return 'forager_hut';
  }
  if (state.epochIndex >= 6) {
    if (countType('launch_arcology') < 2) return 'launch_arcology';
    if (countType('forager_hut') < targetCottages) return 'forager_hut';
  }
  if (state.epochIndex >= 7) {
    if (countType('dyson_spire') < 1) return 'dyson_spire';
  }
  if (countType('forager_hut') < targetCottages) return 'forager_hut';
  return null;
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

  const crownGroupMonarch = (members: UnitEntity[]) => {
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
    crownGroupMonarch(members);
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

  // 1. Era-driven street, rail, runway & high-tech terrain transformation around completed buildings
  paveSettlementStreetsNear(state, sampleBld.tileX, sampleBld.tileZ, sid);
  if (state.epochIndex >= 3 && (sampleBld.type === 'rail_station' || villageBuildings.length >= 6)) {
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

  let bestTile: TileData | null = null;
  let bestScore = -Infinity;

  // Coarse step-2 search across the world for fertile uninhabited valleys 28..58 tiles away
  for (let z = margin; z < gs - margin; z += 2) {
    for (let x = margin; x < gs - margin; x += 2) {
      const t = getTile(state, x, z);
      if (!t || t.height <= 0 || t.height > 4 || t.buildingId || t.onFireTimer > 0) continue;
      if (
        t.terrain !== 'grass' &&
        t.terrain !== 'fertile' &&
        t.terrain !== 'savanna' &&
        t.terrain !== 'forest' &&
        t.terrain !== 'jungle' &&
        t.terrain !== 'blossom'
      ) {
        continue;
      }

      const distFromOrigin = Math.hypot(x - fromX, z - fromZ);
      if (distFromOrigin < 27 || distFromOrigin > 64) continue;

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

      // Require spacious buildable land around the new city center so it can grow big
      let buildableNeighbors = 0;
      let nearbyResources = 0;
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nt = getTile(state, x + dx, z + dz);
          if (!nt || nt.height <= 0 || nt.height >= 6 || nt.buildingId) continue;
          if (nt.terrain === 'deep_water' || nt.terrain === 'shallow_water') continue;
          buildableNeighbors += 1;
        }
      }
      if (buildableNeighbors < 16) continue;

      for (let dz = -5; dz <= 5; dz += 2) {
        for (let dx = -5; dx <= 5; dx += 2) {
          const rt = getTile(state, x + dx, z + dz);
          if (rt && rt.resourceNode !== 'none') nearbyResources += 1;
        }
      }

      // Check overland connectivity so pioneers strongly prefer walkable routes on the same continent
      let waterSamples = 0;
      for (let s = 1; s <= 5; s++) {
        const frac = s / 6;
        const sx = Math.round(fromX + (x - fromX) * frac);
        const sz = Math.round(fromZ + (z - fromZ) * frac);
        const st = getTile(state, sx, sz);
        if (!st || st.height <= 0) waterSamples += 1;
      }

      let score = buildableNeighbors * 2.2 + nearbyResources * 3.0;
      if (t.terrain === 'fertile' || t.terrain === 'grass') score += 12;
      if (t.height === 2 || t.height === 3) score += 8;
      // Sweet spot distance ~30..44 tiles away from parent city
      score -= Math.abs(distFromOrigin - 34) * 0.45;
      score -= waterSamples * 24;
      score += (((x * 31 + z * 17 + (state.seed ?? 1)) & 15) / 16) * 2.0;

      if (score > bestScore) {
        bestScore = score;
        bestTile = t;
      }
    }
  }

  return bestTile;
}

function stepCivilizationPlanner(state: SimulationState, dt: number): void {
  const activeCivs = state.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko');
  if (activeCivs.length === 0) return;

  const hasArrivedPioneers = activeCivs.some((u) => !u.settlementId && u.expeditionTargetX === undefined);
  state.civPlanTimer = (state.civPlanTimer ?? 0) + dt;
  const interval = hasArrivedPioneers ? 0.5 : 1.8;
  if (state.civPlanTimer < interval) return;
  state.civPlanTimer = 0;

  if (!state.settlementNames) state.settlementNames = {};
  if (!state.settlementSpecies) state.settlementSpecies = {};
  if (!state.settlementKingdoms) state.settlementKingdoms = {};

  // 1. Bind local homeless settlers to same-species settlement or found their own village!
  for (const pioneer of activeCivs) {
    if (pioneer.settlementId || pioneer.expeditionTargetX !== undefined) continue;

    const nearbyBld = findLocalSettlementBuilding(state, pioneer.x, pioneer.z, SETTLEMENT_AWARENESS_RADIUS);
    if (nearbyBld?.settlementId) {
      const bSpecies = state.settlementSpecies[nearbyBld.settlementId] ?? 'human';
      if (bSpecies === pioneer.species) {
        pioneer.settlementId = nearbyBld.settlementId;
        pioneer.kingdomId = getKingdomId(state, nearbyBld.settlementId);
        continue;
      }
    }

    const px = Math.round(pioneer.x);
    const pz = Math.round(pioneer.z);
    let siteTile: TileData | undefined = getTile(state, px, pz);
    if (!siteTile || siteTile.height <= 0 || siteTile.buildingId) {
      siteTile = findBuildableTileNear(state, px, pz, 8) ?? undefined;
    }
    if (siteTile && siteTile.height > 0 && !siteTile.buildingId) {
      const def = BUILDINGS.find((b) => b.type === 'bonfire')!;
      if (siteTile.resourceNode === 'timber_grove') state.resources.wood += 15;
      else if (siteTile.resourceNode === 'berry_bush') state.resources.food += 15;
      siteTile.resourceNode = 'none';
      siteTile.resourceAmount = 0;
      if (siteTile.terrain === 'stone_road' || siteTile.terrain === 'forest') {
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
      if (pioneer.kingdomId && isKingdomAlive(pioneer.kingdomId)) {
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
      }
      state.settlementKingdoms[newSettlementId] = resolvedKingdomId;

      const hearth: BuildingEntity = {
        id: nextEntityId('bld'),
        type: 'bonfire',
        settlementId: newSettlementId,
        species: sp,
        tileX: siteTile.x,
        tileZ: siteTile.z,
        hp: def.maxHp,
        maxHp: def.maxHp,
        constructionProgress: 30,
        epochLevel: 0,
        upgradeProgress: 0,
        blessedTimer: 0,
        cursedTimer: 0,
        shieldTimer: 0,
      };
      siteTile.buildingId = hearth.id;
      state.buildings.push(hearth);
      state.totalStructuresBuilt += 1;

      // Adopt nearby homeless/arriving pioneers of the same species
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
        }
      }

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

  // 2. Step each independent village/city separately (its own growth, autobuild, colonization & terrain evolution)
  const epoch = EPOCHS[state.epochIndex] || EPOCHS[0];
  const settlementIds = Array.from(new Set(state.buildings.map((b) => b.settlementId!)));

  for (const sid of settlementIds) {
    const villageBuildings = state.buildings.filter((b) => b.settlementId === sid);
    if (villageBuildings.length === 0) continue;

    const villageAnchor = getSettlementAnchorForId(state, sid);
    const villageUnits = activeCivs.filter((u) => u.settlementId === sid);
    const completedBuildings = villageBuildings.filter((b) => b.constructionProgress >= 100);
    const hasCompletedHearth = completedBuildings.length > 0;
    const villageSpecies: SpeciesId = state.settlementSpecies[sid] ?? villageUnits[0]?.species ?? 'human';

    let villagePopCap = hasCompletedHearth ? epoch.populationBonus : 0;
    for (const b of completedBuildings) {
      const def = BUILDINGS.find((d) => d.type === b.type);
      if (def) villagePopCap += def.popCapBonus;
    }

    // Autonomous Population Growth for THIS village in its own species (obeys God Rule allowReproduction)
    if (
      state.worldRules?.allowReproduction !== false &&
      hasCompletedHearth &&
      villageUnits.length < villagePopCap &&
      state.resources.food >= 28 &&
      state.happiness >= 35
    ) {
      state.resources.food -= 20;
      const spawnHub = completedBuildings[0];
      const birthAgeStage: UnitAgeStage = villageUnits.length >= 2 ? 'child' : 'adult';
      spawnUnit(state, villageSpecies, spawnHub.tileX, spawnHub.tileZ, true, sid, {
        ageStage: birthAgeStage,
      });
    }

    // Autonomous Construction Planner scoped to THIS village (capped at getMaxCityBuildings)
    // Orcs progress way slower than other races; Humans progress fastest
    const maxCityBuildings = getMaxCityBuildings(state.epochIndex);
    const activeSites = villageBuildings.filter((b) => b.constructionProgress < 100).length;
    const orcSlowSkip =
      villageSpecies === 'orc' &&
      !state.sandboxFreeMode &&
      villageBuildings.length >= 2 &&
      Math.floor(Math.abs(state.year * 10)) % 3 !== 0;

    if (
      state.autoBuildEnabled &&
      state.worldRules?.autoBuildEnabled !== false &&
      hasCompletedHearth &&
      !orcSlowSkip &&
      activeSites < (villageSpecies === 'human' ? 2 : 1) &&
      villageBuildings.length < maxCityBuildings
    ) {
      const desiredType = pickDesiredAutobuildType(state, villageBuildings, villageUnits.length, villageSpecies);
      if (desiredType) {
        const def = BUILDINGS.find((b) => b.type === desiredType);
        if (def && canAfford(state.resources, def.cost, false)) {
          const site = findBuildableTileNear(state, villageAnchor.x, villageAnchor.z, 18, sid);
          if (site) {
            state.resources = deductCost(state.resources, def.cost, false);
            if (site.resourceNode === 'timber_grove') state.resources.wood += 12;
            else if (site.resourceNode === 'stone_outcrop') state.resources.stone += 12;
            site.resourceNode = 'none';
            site.resourceAmount = 0;
            site.farmSettlementId = undefined;
            if (site.terrain === 'stone_road' || site.terrain === 'forest') {
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
              constructionProgress: 12,
              epochLevel: baseEpochIdx,
              upgradeProgress: 0,
              blessedTimer: 0,
              cursedTimer: 0,
              shieldTimer: 0,
            };
            site.buildingId = siteBld.id;
            site.farmSettlementId = undefined;
            state.buildings.push(siteBld);
            state.totalStructuresBuilt += 1;
            paveSettlementStreetsNear(state, site.x, site.z, sid);
            const vName = state.settlementNames[sid] ?? 'Settlement';
            addChronicle(state, `Settlers of ${vName} break ground on a ${def.name} at (${site.x}, ${site.z}).`, 'build');
          }
        }
      }
    }

    // Autonomous Frontier Colonization:
    // Once a city reaches max size (or grows large and crowded), surplus settlers launch an expedition to found a new city!
    const isAtMaxCitySize = villageBuildings.length >= maxCityBuildings;
    const isLargeAndCrowded =
      villageBuildings.length >= Math.min(maxCityBuildings, 6) &&
      villageUnits.length >= Math.max(7, Math.floor(villagePopCap * 0.65));
    const sidKingdomId = getKingdomId(state, sid);
    const hasExpeditionInProgress = activeCivs.some(
      (u) => u.expeditionTargetX !== undefined && u.kingdomId === sidKingdomId,
    );

    if (
      hasCompletedHearth &&
      (isAtMaxCitySize || isLargeAndCrowded) &&
      villageUnits.length >= 5 &&
      settlementIds.length < MAX_WORLD_CITIES &&
      !hasExpeditionInProgress &&
      (state.sandboxFreeMode || state.resources.food >= 30)
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
            state.resources.food = Math.max(0, state.resources.food - 25);
          }
          const parentKingdomId = getKingdomId(state, sid);
          for (let c = 0; c < maxColonistsToSend; c++) {
            const col = colonistPool[c];
            col.kingdomId = parentKingdomId;
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

    // Era-based Environment Transformation around THIS village
    transformSettlementEnvironment(state, villageAnchor, villageBuildings);
  }

  // Ensure every active kingdom/settlement has 1 living King marked on the map
  ensureSettlementKings(state);
}

export function stepSimulation(
  state: SimulationState,
  rawDt: number,
  options?: { skipDragStep?: boolean },
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
  options?: { skipDragStep?: boolean },
): void {
  if (dt <= 0) return;

  if (!options?.skipDragStep) {
    stepDraggedUnitKinematics(state, dt);
  }

  // 1. Advance historical year at 1 year per second on 1x speed (scales directly with speed multiplier)
  if (state.population > 0 || state.units.length > 0 || state.buildings.length > 0) {
    state.year += YEARS_PER_SEC_AT_1X * dt;
  }

  if (state.goldenAgeTimer > 0) {
    state.goldenAgeTimer = Math.max(0, state.goldenAgeTimer - dt);
  }

  // 2. Smoothly measure actual citizen harvest deposits over rolling 3s window
  state.harvestWindowTimer = (state.harvestWindowTimer ?? 0) + dt;
  if (state.harvestWindowTimer >= 3.0) {
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

  // 3. Accumulate passive completed-building production & apply population food upkeep
  recalculateRatesAndCaps(state);
  const passiveRates = emptyResources();
  passiveRates.faith = 2;
  const paceMult = state.sandboxFreeMode ? 1.0 : 0.62;
  for (const b of state.buildings) {
    if (b.constructionProgress < 100) continue;
    const def = BUILDING_BY_TYPE.get(b.type);
    if (!def) continue;
    const blessMult = b.blessedTimer > 0 ? 1.75 : b.cursedTimer > 0 ? 0.5 : 1.0;
    const epochMult = 1 + Math.min(4, state.epochIndex) * 0.1;
    const bSpecies: SpeciesId = b.species ?? (b.settlementId ? state.settlementSpecies?.[b.settlementId] : undefined) ?? 'human';
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
      passiveRates[key] += (v ?? 0) * blessMult * epochMult * spMult * paceMult;
    }
  }
  const foodUpkeep = state.population > 4 ? (state.population - 4) * 0.18 : 0;
  passiveRates.food = Math.max(-foodUpkeep, passiveRates.food - foodUpkeep);
  const goldenMult = state.goldenAgeTimer > 0 ? 2 : 1;
  for (const k of Object.keys(passiveRates) as (keyof Resources)[]) {
    state.resources[k] = Math.max(0, state.resources[k] + passiveRates[k] * goldenMult * dt);
  }

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
  stepCivilizationPlanner(state, dt);

  // 5. Real Epoch progression check & organic Epoch Ascension
  if (state.epochIndex < EPOCHS.length - 1 && state.buildings.some((b) => b.constructionProgress >= 100)) {
    const nextEpoch = EPOCHS[state.epochIndex + 1];
    let ratioSum = 0;
    let ratioCount = 0;
    for (const [k, reqVal] of Object.entries(nextEpoch.unlockCost)) {
      if ((reqVal ?? 0) > 0) {
        ratioSum += Math.min(1, state.resources[k as keyof Resources] / reqVal);
        ratioCount += 1;
      }
    }
    const avgPct = ratioCount > 0 ? Math.round((ratioSum / ratioCount) * 100) : 0;
    state.epochProgress = Math.max(0, Math.min(100, avgPct));

    const completedBlds = state.buildings.filter((b) => b.constructionProgress >= 100);
    const completedCount = completedBlds.length;
    // Lengthen Industrial -> Atomic -> Information -> Orbital -> Star progression with higher urbanization & tech readiness
    const requiredStructures =
      state.epochIndex === 0
        ? 2
        : state.epochIndex === 1
          ? 5
          : state.epochIndex === 2
            ? 8
            : state.epochIndex === 3
              ? 12
              : state.epochIndex === 4
                ? 16
                : state.epochIndex === 5
                  ? 22
                  : 26;

    // For late ages (especially Information Age -> Orbital Age -> Star Age), require buildings to actually upgrade into the current age first
    const upgradedCount = completedBlds.filter((b) => b.epochLevel >= state.epochIndex).length;
    const upgradeReady =
      state.epochIndex < 4 || upgradedCount >= Math.ceil(completedCount * 0.75);
    const lateTechReady =
      state.epochIndex === 5
        ? completedBlds.some((b) => b.type === 'cyber_institute' || b.type === 'fission_reactor')
        : state.epochIndex === 6
          ? completedBlds.some((b) => b.type === 'launch_arcology')
          : true;

    if (
      completedCount >= requiredStructures &&
      upgradeReady &&
      lateTechReady &&
      canAfford(state.resources, nextEpoch.unlockCost, false)
    ) {
      advanceEpoch(state, false);
    }
  } else if (state.epochIndex >= EPOCHS.length - 1) {
    state.epochProgress = 100;
  } else {
    state.epochProgress = 0;
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
        const lingerSplit = 0.6; // First 60% of duration lingers slowly over target; final 40% accelerates away
        const lingerDistance = 3.5; // -1.5 to +2.0 tiles across the summoned target zone
        const lingerTime = lingerSplit * totalDur;
        const baseSlowSpeed = lingerDistance / Math.max(0.1, lingerTime); // ~0.55 tiles/s (scales with timeScale/dt)

        let s: number;
        let perpOffset: number;
        if (progress <= lingerSplit) {
          // Phase 2: Slow drift right across the summoned area
          const lingerFrac = progress / lingerSplit;
          s = -1.5 + lingerDistance * lingerFrac;
          haz.currentSpeed = baseSlowSpeed;
          perpOffset = Math.sin(progress * Math.PI * 3.0) * 0.42;
        } else {
          // Phase 3: Slowly becomes fast as it expires (smooth acceleration ramp)
          const expireFrac = (progress - lingerSplit) / (1 - lingerSplit); // 0 -> 1
          const expireTime = (1 - lingerSplit) * totalDur;
          const accelDist = 23.0;
          s = 2.0 + baseSlowSpeed * expireTime * expireFrac + accelDist * Math.pow(expireFrac, 2.8);
          haz.currentSpeed =
            baseSlowSpeed + (accelDist * 2.8 * Math.pow(expireFrac, 1.8)) / Math.max(0.1, expireTime);
          perpOffset = Math.sin(progress * Math.PI * 3.0) * 0.42 * (1 - expireFrac * 0.65);
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
        for (const t of state.tiles) {
          const dSq = (t.x - haz.x) ** 2 + (t.z - haz.z) ** 2;
          if (dSq <= rSq && t.height > 0) {
            t.onFireTimer = 0;
            t.cursedTimer = 0;
            t.blessedTimer = Math.max(t.blessedTimer, 16);
            if (t.terrain === 'scorched') {
              t.terrain = 'grass';
            } else if ((t.terrain === 'sand' || t.terrain === 'savanna') && dSq <= rSq * 0.55) {
              t.terrain = 'grass';
            }
          }
        }
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
      } else if (haz.kind === 'wormhole_rift') {
        // Gradually tear & excavate terrain blocks around the black hole into its swirling vortex
        const ripR = haz.radius * 1.05;
        const ripRSq = ripR * ripR;
        let erodedThisTick = 0;
        for (const t of state.tiles) {
          const dSq = (t.x - haz.x) ** 2 + (t.z - haz.z) ** 2;
          if (dSq > ripRSq || t.height === 0 || t.buildingId) continue;
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
        }
      } else if (haz.kind === 'tornado_vortex') {
        // Tear up trees, crops & scatter debris along the tornado's ground track
        const tearRSq = (haz.radius * 0.72) ** 2;
        for (const t of state.tiles) {
          const dSq = (t.x - haz.x) ** 2 + (t.z - haz.z) ** 2;
          if (dSq > tearRSq || t.height === 0 || t.buildingId) continue;
          t.onFireTimer = 0;
          if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            t.terrain = 'grass';
            t.farmSettlementId = undefined;
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
        if (dSq <= (haz.radius * 0.88) ** 2 && b.shieldTimer <= 0) {
          b.hp = Math.max(0, b.hp - 125 * dt);
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

          if (dist <= 2.5 && u.faction === 'hostile') {
            u.hp = Math.max(0, u.hp - 36 * dt);
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
              state.totalRaidersDefeated += 1;
            }
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
        for (const t of state.tiles) {
          const dSq = (t.x - haz.x) ** 2 + (t.z - haz.z) ** 2;
          if (dSq <= (haz.radius * 0.82) ** 2 && t.height > 0 && !t.buildingId) {
            if (t.height >= 2) t.height = Math.max(1, t.height - 1);
            t.terrain = dSq <= 6.0 ? 'scorched' : 'crystal_field';
            if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
          }
        }
        // Fling all trapped / orbiting entities violently outward to random places across the map with high fall damage!
        for (let ui = 0; ui < state.units.length; ui++) {
          const u = state.units[ui];
          if (u.state === 'ko' || u.statusEffects.shielded || u.draggedByPlayer) continue;
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
        addChronicle(state, 'The Black Hole collapsed in a violent Supernova, scattering entities across the realm!', 'warning');
      }
    }

    // Roaming Cyclone Vortex (tornado_vortex): wanders across land/water, lifts, spins & flings units + shreds buildings
    if (haz.kind === 'tornado_vortex') {
      const steer = Math.sin((haz.duration - haz.remaining) * 1.45 + haz.x * 0.3) * 0.85;
      haz.heading = (haz.heading ?? 0) + steer * dt;
      const moveSpd = 4.6;
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

      const funnelPullR = haz.radius * 1.5;
      for (const b of state.buildings) {
        const dSq = (b.tileX - haz.x) ** 2 + (b.tileZ - haz.z) ** 2;
        if (dSq <= (haz.radius * 0.82) ** 2 && b.shieldTimer <= 0) {
          b.hp = Math.max(0, b.hp - 135 * dt);
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
          const nextDist = Math.max(0.55, dist - 3.6 * (1 - normDist * 0.4) * dt);
          const nextAngle = curAngle + (5.2 + (1 - normDist) * 4.5) * dt;
          u.x = Math.max(1, Math.min(state.gridSize - 2, haz.x + Math.cos(nextAngle) * nextDist));
          u.z = Math.max(1, Math.min(state.gridSize - 2, haz.z + Math.sin(nextAngle) * nextDist));
          u.altitude = Math.min(5.0, (u.altitude ?? 0) + (4.2 - normDist * 2.0) * dt);
          u.vzVertical = 0;
          u.fallDamageArmed = (u.altitude ?? 0) >= 1.6;
          u.hp = Math.max(0, u.hp - 22 * dt);
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.45;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          } else if (dist <= 1.35 && Math.random() < dt * 2.2) {
            // Eject unit violently upward & outward from the top of the funnel!
            const ejectAngle = nextAngle + 0.5;
            u.vxAir = Math.cos(ejectAngle) * (10 + Math.random() * 6);
            u.vzAir = Math.sin(ejectAngle) * (10 + Math.random() * 6);
            u.altitude = Math.max(3.4, u.altitude ?? 3.4);
            u.vzVertical = 9.5 + Math.random() * 4.0;
            u.fallDamageArmed = true;
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
      const outerBandSq = (nextR + 0.9) ** 2;

      for (const t of state.tiles) {
        const dx = t.x - haz.x;
        const dz = t.z - haz.z;
        const dSq = dx * dx + dz * dz;
        if (dSq >= innerBandSq && dSq <= outerBandSq) {
          t.onFireTimer = 0;
          t.cursedTimer = 0;
          if (t.height === 0) {
            if (dSq <= (haz.radius * 1.15) ** 2) {
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
      }

      // Lethal drowning & surge crushing on non-flying NPCs & wildlife caught in the crashing tsunami crest
      for (const u of state.units) {
        const dx = u.x - haz.x;
        const dz = u.z - haz.z;
        const dist = Math.hypot(dx, dz);
        if (Math.abs(dist - nextR) <= 2.45 && dist > 0.2 && u.state !== 'ko' && u.role !== 'dragon' && !u.statusEffects.shielded && !u.draggedByPlayer) {
          const uTile = getTile(state, Math.round(u.x), Math.round(u.z));
          if (!uTile || uTile.height <= 3) {
            const push = 9.0 * dt;
            u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + (dx / dist) * push));
            u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + (dz / dist) * push));
            const surgeDmgRate = !uTile || uTile.height <= 1 ? 520 : uTile.height === 2 ? 420 : 280;
            u.hp = Math.max(0, u.hp - surgeDmgRate * dt);
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
              if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
            }
          }
        }
      }

      // Crushing flood surge damage to unshielded coastal buildings (height <= 3)
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

    if (haz.remaining > 0) {
      remainingHazards.push(haz);
    }
  }
  state.activeHazards = remainingHazards;

  let pendingFireIgnitions: Map<TileData, { duration: number; fireColor?: string }> | null = null;
  for (let i = 0; i < state.tiles.length; i++) {
    const t = state.tiles[i];
    if (t.blessedTimer > 0) t.blessedTimer = Math.max(0, t.blessedTimer - dt);
    if (t.cursedTimer > 0) t.cursedTimer = Math.max(0, t.cursedTimer - dt);
    if (t.onFireTimer > 0) {
      t.onFireTimer = Math.max(0, t.onFireTimer - dt);
      if (t.height <= 0) {
        t.onFireTimer = 0;
        t.fireColor = undefined;
        continue;
      }
      // Burn vegetation down to scorched earth as fire consumes the tile
      if (t.resourceAmount > 0 && (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush')) {
        t.resourceAmount = Math.max(0, t.resourceAmount - 26 * dt);
        if (t.resourceAmount <= 0) {
          t.resourceNode = 'none';
          t.terrain = 'scorched';
          t.farmSettlementId = undefined;
        }
      } else if (
        t.onFireTimer === 0 &&
        (t.terrain === 'forest' ||
          t.terrain === 'jungle' ||
          t.terrain === 'savanna' ||
          t.terrain === 'taiga' ||
          t.terrain === 'blossom' ||
          t.terrain === 'fertile' ||
          t.terrain === 'grass')
      ) {
        t.terrain = 'scorched';
        t.farmSettlementId = undefined;
      }

      // Wildfire spread from any burning tile (meteor embers, lightning, dragon fire, war-braziers)
      if (t.onFireTimer > 1.0 && state.worldRules?.wildfireSpread !== false) {
        const sourceHeatBoost =
          t.resourceNode === 'timber_grove' ||
          t.terrain === 'forest' ||
          t.terrain === 'jungle' ||
          t.terrain === 'scorched'
            ? 1.15
            : 1.0;
        for (const [ox, oz, distWeight] of [
          [1, 0, 1.0],
          [-1, 0, 1.0],
          [0, 1, 1.0],
          [0, -1, 1.0],
          [1, 1, 0.35],
          [-1, 1, 0.35],
          [1, -1, 0.35],
          [-1, -1, 0.35],
        ] as const) {
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
                ? 3.8
                : nb.terrain === 'grass' && nb.resourceNode === 'none' && !nb.farmSettlementId
                  ? 2.6
                  : 3.4;
            if (!pendingFireIgnitions) pendingFireIgnitions = new Map();
            pendingFireIgnitions.set(nb, {
              duration: childDuration,
              fireColor: t.fireColor,
            });
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
    if (b.constructionProgress >= 100 && b.epochLevel < state.epochIndex) {
      const epochGap = state.epochIndex - b.epochLevel;
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
      const baseRate = state.sandboxFreeMode ? 16 + epochGap * 9 : (6.5 + epochGap * 3.5) * (b.epochLevel >= 5 ? 0.55 : 1.0);
      const passiveUpgradeRate = baseRate * (0.82 + idOffset) * blessBoost * speciesUpgradeMult;
      b.upgradeProgress = (b.upgradeProgress ?? 0) + passiveUpgradeRate * dt;
      if (b.upgradeProgress >= 100) {
        b.upgradeProgress = 0;
        b.epochLevel = Math.min(state.epochIndex, b.epochLevel + 1);
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

  for (const u of state.units) {
    if (u.state === 'ko') {
      u.koTimer -= dt;
      if (u.koTimer > 0) {
        remainingUnits.push(u);
      }
      continue;
    }

    for (const eff of Object.keys(u.statusEffects) as (keyof typeof u.statusEffects)[]) {
      const val = u.statusEffects[eff] ?? 0;
      if (val > 0) {
        const nextVal = val - dt;
        if (nextVal <= 0) delete u.statusEffects[eff];
        else u.statusEffects[eff] = nextVal;
      }
    }

    if (u.statusEffects.plagued) {
      u.hp -= 4.5 * dt;
      for (const other of state.units) {
        if (
          other.id !== u.id &&
          other.state !== 'ko' &&
          other.role !== 'unicorn' &&
          !other.statusEffects.plagued &&
          !other.statusEffects.shielded &&
          !other.statusEffects.blessed
        ) {
          const dSq = (other.x - u.x) ** 2 + (other.z - u.z) ** 2;
          if (dSq < 1.2) {
            other.statusEffects.plagued = 14;
          }
        }
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

    // Airborne ballistic arc & fall-damage resolution (Black Hole flings, Tornado tosses, Bombs, Drag-Tool drops)
    let isAirborneOrDragged = Boolean(u.draggedByPlayer);
    if (!u.draggedByPlayer && !capturedByBlackHole && !capturedByTornado) {
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
          if (u.fallDamageArmed) {
            u.fallDamageArmed = false;
            const landTile = getTile(state, Math.round(u.x), Math.round(u.z));
            const isWaterLanding = !landTile || landTile.height === 0;
            if (u.role !== 'dragon' && !u.statusEffects.shielded && impactSpeed > 5.5) {
              const fallDmg = isWaterLanding
                ? Math.max(0, Math.round((impactSpeed - 8.0) * 3.5))
                : Math.max(30, Math.round(impactSpeed * 12.5));
              if (fallDmg > 0) {
                u.hp = Math.max(0, u.hp - fallDmg);
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
                if (u.hp <= 0) {
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

  // 8b. Guarantee strictly 1 living King per kingdom on every tick (handles immediate succession when a King falls)
  ensureSettlementKings(state);

  // 9. Update transit vehicles (Trains on rail_track, Cars on stone_road, Planes at airports)
  stepVehicles(state, dt);
}

const VEHICLE_DIRS: ReadonlyArray<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function wrapAngleRad(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function stepVehicles(state: SimulationState, dt: number): void {
  if (!state.vehicles) state.vehicles = [];
  if (state.epochIndex < 3 && state.vehicles.length === 0) return;

  // Prune vehicles that belong to an age before transit unlocked
  state.vehicles = state.vehicles.filter((v) => {
    if (v.type === 'plane') {
      return (
        state.epochIndex >= 4 &&
        state.buildings.some((b) => b.type === 'airport' && b.constructionProgress >= 100)
      );
    }
    if (v.type === 'train') return state.epochIndex >= 3;
    if (v.type === 'car') return state.epochIndex >= 3;
    if (v.type === 'roadster') return state.epochIndex >= 5;
    return false;
  });

  const settlementIds = Array.from(
    new Set(
      state.buildings
        .filter((b) => b.constructionProgress >= 100)
        .map((b) => b.settlementId ?? 'city_default'),
    ),
  );

  // A. Maintain active trains (Industrial+)
  if (state.epochIndex >= 3) {
    const targetPerCity = state.epochIndex >= 5 ? 2 : 1;
    for (const sid of settlementIds) {
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
          epochLevel: state.epochIndex,
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
  }

  // B. Maintain active automobiles (Industrial+)
  if (state.epochIndex >= 3) {
    const targetCarsPerCity =
      state.epochIndex === 3 ? 2 : state.epochIndex === 4 ? 4 : 6;
    for (const sid of settlementIds) {
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
          epochLevel: state.epochIndex,
          x: startTile.x,
          y: state.epochIndex >= 6 ? 0.14 : 0.02,
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
  }

  // B2. Easter Egg: Latest Tesla Roadster with SpaceX Cold-Gas Thruster Stunts (Information Age+)
  if (state.epochIndex >= 5) {
    for (const sid of settlementIds) {
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
          epochLevel: state.epochIndex,
          x: startTile.x,
          y: state.epochIndex >= 6 ? 0.12 : 0.02,
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
  }

  // C. Maintain active aircraft at completed airports (Atomic+)
  const airports = state.buildings.filter((b) => b.type === 'airport' && b.constructionProgress >= 100);
  if (state.epochIndex >= 4 && airports.length > 0) {
    const targetPlanesPerAirport = state.epochIndex >= 5 ? 2 : 1;
    for (const ap of airports) {
      if (state.vehicles.filter((v) => v.type === 'plane').length >= 6) break;
      const apSid = ap.settlementId ?? 'city_default';
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
        epochLevel: state.epochIndex,
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
    v.epochLevel = state.epochIndex;

    if (v.type === 'train') {
      v.speed =
        state.epochIndex <= 3 ? 2.9 : state.epochIndex === 4 ? 4.0 : state.epochIndex === 5 ? 5.4 : 6.8;
      // Information Age (5) and Space Age (6+) trains ride high on suspended viaducts above streets!
      v.y = state.epochIndex >= 5 ? 0.78 : 0.03;
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
        const candidates: Array<{ x: number; z: number }> = [];
        for (const [ox, oz] of VEHICLE_DIRS) {
          const nx = Math.round(target.x + ox);
          const nz = Math.round(target.z + oz);
          const nt = getTile(state, nx, nz);
          if (!nt) continue;
          if (nt.terrain === 'rail_track') {
            candidates.push({ x: nx, z: nz });
          } else if (nt.terrain === 'stone_road') {
            // Allow smooth grade crossing across a 1-tile road onto continuation rail_track
            const beyond = getTile(state, nx + ox, nz + oz);
            if (beyond && beyond.terrain === 'rail_track') {
              candidates.push({ x: beyond.x, z: beyond.z });
            }
          }
        }
        const nonReverse = candidates.filter(
          (c) => Math.abs(c.x - prev.x) > 0.2 || Math.abs(c.z - prev.z) > 0.2,
        );
        const pool = nonReverse.length > 0 ? nonReverse : candidates;
        if (pool.length > 0) {
          const pickIdx = (v.variantSeed + Math.round(target.x * 3 + target.z * 5)) % pool.length;
          const nextPt = pool[Math.abs(pickIdx)];
          v.path = [{ x: target.x, z: target.z }, nextPt];
        }
      }
    } else if (v.type === 'car') {
      v.speed =
        state.epochIndex <= 3 ? 2.2 : state.epochIndex === 4 ? 3.2 : state.epochIndex === 5 ? 4.2 : 5.2;
      v.y = state.epochIndex >= 6 ? 0.14 : 0.02;
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
        const candidates: Array<{ x: number; z: number }> = [];
        for (const [ox, oz] of VEHICLE_DIRS) {
          const nx = Math.round(target.x + ox);
          const nz = Math.round(target.z + oz);
          const nt = getTile(state, nx, nz);
          if (nt && nt.terrain === 'stone_road') {
            candidates.push({ x: nx, z: nz });
          }
        }
        const nonReverse = candidates.filter(
          (c) => Math.abs(c.x - prev.x) > 0.2 || Math.abs(c.z - prev.z) > 0.2,
        );
        const pool = nonReverse.length > 0 ? nonReverse : candidates;
        if (pool.length > 0) {
          const pickIdx =
            (v.variantSeed + Math.floor(Math.abs(state.year * 100)) + Math.round(target.x + target.z)) %
            pool.length;
          const nextPt = pool[Math.abs(pickIdx)];
          v.path = [{ x: target.x, z: target.z }, nextPt];
        }
      }
    } else if (v.type === 'roadster') {
      const baseRoadY = state.epochIndex >= 6 ? 0.12 : 0.02;
      const baseCruiseSpeed = state.epochIndex >= 6 ? 7.2 : 6.2;
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
        const candidates: Array<{ x: number; z: number }> = [];
        for (const [ox, oz] of VEHICLE_DIRS) {
          const nx = Math.round(target.x + ox);
          const nz = Math.round(target.z + oz);
          const nt = getTile(state, nx, nz);
          if (nt && nt.terrain === 'stone_road') {
            candidates.push({ x: nx, z: nz });
          }
        }
        const nonReverse = candidates.filter(
          (c) => Math.abs(c.x - prev.x) > 0.2 || Math.abs(c.z - prev.z) > 0.2,
        );
        const pool = nonReverse.length > 0 ? nonReverse : candidates;
        if (pool.length > 0) {
          const pickIdx =
            (v.variantSeed + Math.floor(Math.abs(state.year * 140)) + Math.round(target.x * 3 + target.z)) %
            pool.length;
          const nextPt = pool[Math.abs(pickIdx)];
          v.path = [{ x: target.x, z: target.z }, nextPt];
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
      const cruiseSpeed = state.epochIndex <= 4 ? 5.0 : state.epochIndex === 5 ? 6.8 : 8.5;
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
}

function stepHostileUnitAI(
  state: SimulationState,
  u: UnitEntity,
  def: typeof UNITS[number],
  moveSpeed: number,
  dt: number,
): void {
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
    if (other.faction === 'civilization' && other.state !== 'ko') {
      const dSq = (other.x - u.x) ** 2 + (other.z - u.z) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        nearestCiv = other;
      }
    }
  }

  if (!nearestCiv) return;
  const dist = Math.sqrt(bestDistSq);

  if (u.role === 'raider_ranged') {
    if (dist < 2.1) {
      u.state = 'moving';
      const dx = (u.x - nearestCiv.x) / Math.max(0.1, dist);
      const dz = (u.z - nearestCiv.z) / Math.max(0.1, dist);
      u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + dx * moveSpeed * dt));
      u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + dz * moveSpeed * dt));
    } else if (dist <= def.attackRange) {
      u.state = 'fighting';
      if (u.actionCooldown <= 0) {
        u.actionCooldown = 1.1;
        if (!nearestCiv.statusEffects.shielded) {
          nearestCiv.hp -= def.attackDamage;
        }
      }
    } else {
      u.state = 'moving';
      const dx = (nearestCiv.x - u.x) / dist;
      const dz = (nearestCiv.z - u.z) / dist;
      u.x += dx * moveSpeed * dt;
      u.z += dz * moveSpeed * dt;
    }
    return;
  }

  if (dist <= def.attackRange) {
    u.state = 'fighting';
    if (u.actionCooldown <= 0) {
      u.actionCooldown = 0.75;
      if (!nearestCiv.statusEffects.shielded) {
        nearestCiv.hp -= def.attackDamage;
      }
    }
  } else {
    u.state = 'moving';
    const dx = (nearestCiv.x - u.x) / dist;
    const dz = (nearestCiv.z - u.z) / dist;
    u.x += dx * moveSpeed * dt;
    u.z += dz * moveSpeed * dt;
  }
}

function getTileFlammabilityRate(state: SimulationState, t: TileData): number {
  if (!t || t.height <= 0 || t.onFireTimer > 0 || t.blessedTimer > 0) return 0;
  if (t.buildingId) {
    const bld = state.buildings.find((b) => b.id === t.buildingId);
    if (!bld || bld.hp <= 0 || bld.shieldTimer > 0 || bld.blessedTimer > 0) return 0;
    return 0.11;
  }
  if (t.resourceNode === 'timber_grove') return 0.21;
  if (t.resourceNode === 'berry_bush') return 0.11;
  if (t.terrain === 'forest' || t.terrain === 'jungle' || t.terrain === 'taiga') {
    return 0.15;
  }
  if (t.terrain === 'savanna' || t.terrain === 'blossom' || t.terrain === 'fertile') {
    return 0.1;
  }
  if (t.terrain === 'grass') {
    return t.farmSettlementId ? 0.06 : 0.025;
  }
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
  const curTile = getTile(state, u.x, u.z);
  if (curTile && curTile.onFireTimer > 0 && !u.statusEffects.shielded && !isFlying) {
    u.hp -= 10 * dt;
  }

  // Unicorn Mythical Aura: gently blesses & heals nearby friendly citizens and revives scorched earth
  if (u.role === 'unicorn' && u.actionCooldown <= 0) {
    let blessedAny = false;
    for (const other of state.units) {
      if (other.faction === 'civilization' && other.state !== 'ko') {
        const dSq = (other.x - u.x) ** 2 + (other.z - u.z) ** 2;
        if (dSq <= 20.25 && (other.hp < other.maxHp || other.statusEffects.plagued || other.statusEffects.cursed)) {
          other.hp = Math.min(other.maxHp, other.hp + 14);
          delete other.statusEffects.plagued;
          delete other.statusEffects.cursed;
          blessedAny = true;
        }
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
      u.actionCooldown = 1.6;
      state.pendingVfx.push({
        id: nextEntityId('vfx'),
        type: 'hit_spark',
        x: u.x,
        y: 0.6,
        z: u.z,
        radius: 1.4,
        color: '#f472b6',
        createdAt: Date.now(),
      });
    } else {
      u.actionCooldown = 1.0;
    }
  }

  const isFrenzied = Boolean(u.statusEffects.frenzied);
  const isHerbivore = isHerbivoreAnimal(u.role, u.appearanceSeed);

  // Herbivore behavior: ONLY flee carnivores/hostiles and eat plants (never attack units or smash buildings/rocks unless frenzied!)
  if (isHerbivore && !isFrenzied) {
    let threat: UnitEntity | null = null;
    let bestThreatDistSq = u.role === 'dinosaur' ? 42.25 : 25.0; // 6.5 tiles for herbivore dinos, 5.0 tiles for small prey
    for (const other of state.units) {
      if (other.id === u.id || other.state === 'ko') continue;
      if (
        other.faction === 'hostile' ||
        other.role === 'dragon' ||
        isCarnivoreAnimal(other.role, other.appearanceSeed) ||
        Boolean(other.statusEffects.frenzied)
      ) {
        const dSq = (other.x - u.x) ** 2 + (other.z - u.z) ** 2;
        if (dSq < bestThreatDistSq) {
          bestThreatDistSq = dSq;
          threat = other;
        }
      }
    }
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
    const ux = Math.round(u.x);
    const uz = Math.round(u.z);
    const minX = Math.max(1, ux - plantSearchRange);
    const maxX = Math.min(gs - 2, ux + plantSearchRange);
    const minZ = Math.max(1, uz - plantSearchRange);
    const maxZ = Math.min(gs - 2, uz + plantSearchRange);
    let bestPlantTile: TileData | null = null;
    let bestPlantScore = Infinity;

    for (let tz = minZ; tz <= maxZ; tz++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const tile = state.tiles[tz * gs + tx];
        if (!tile || tile.height <= 0 || tile.buildingId || tile.onFireTimer > 0 || tile.cursedTimer > 0) {
          continue;
        }
        const isBerry = tile.resourceNode === 'berry_bush' && tile.resourceAmount > 0;
        const isTree = canEatTrees && tile.resourceNode === 'timber_grove' && tile.resourceAmount > 0;
        if (!isBerry && !isTree) continue;
        const dSq = (tx - u.x) ** 2 + (tz - u.z) ** 2;
        if (dSq > plantRangeSq) continue;
        const score = Math.sqrt(dSq) + (isBerry ? 0 : 1.2);
        if (score < bestPlantScore) {
          bestPlantScore = score;
          bestPlantTile = tile;
        }
      }
    }

    if (bestPlantTile) {
      const dist = Math.hypot(bestPlantTile.x - u.x, bestPlantTile.z - u.z);
      const eatRange = canEatTrees ? 1.55 : 1.25;
      u.targetX = bestPlantTile.x;
      u.targetZ = bestPlantTile.z;
      if (dist <= eatRange) {
        u.state = 'gathering';
        if (u.actionCooldown <= 0) {
          const eatAmt = canEatTrees ? 45 : 24;
          bestPlantTile.resourceAmount = Math.max(0, bestPlantTile.resourceAmount - eatAmt);
          if (bestPlantTile.resourceAmount <= 0) {
            bestPlantTile.resourceNode = 'none';
          }
          u.hp = Math.min(u.maxHp, u.hp + (canEatTrees ? 14 : 6));
          u.actionCooldown = canEatTrees ? 1.8 : 2.1;
          u.attackAnimTimer = 0.42;
          u.attackTargetX = bestPlantTile.x;
          u.attackTargetZ = bestPlantTile.z;
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'hit_spark',
            x: bestPlantTile.x,
            y: 0.45,
            z: bestPlantTile.z,
            radius: canEatTrees ? 0.95 : 0.7,
            color: '#80ed99',
            createdAt: Date.now(),
          });
        }
      } else {
        u.state = 'moving';
        const grazeSpeed = moveSpeed * (canEatTrees ? 0.88 : 0.8);
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
    }
    if (options?.buildingTarget && options.buildingTarget.shieldTimer <= 0) {
      options.buildingTarget.hp = Math.max(0, options.buildingTarget.hp - dmg * 0.85);
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

    // Scorch & ignite the struck tile and adjacent dry vegetation in the dragon's fire color
    const igniteTile = (tile: TileData | undefined, directHit: boolean) => {
      if (!tile || tile.height <= 0 || tile.terrain === 'rock' || tile.terrain === 'snow') return;
      if (tile.buildingId && !options?.buildingTarget) return;
      if (!tile.buildingId && tile.blessedTimer > 0 && !directHit) return;

      tile.onFireTimer = Math.max(tile.onFireTimer, directHit ? 5.5 : 4.2);
      tile.fireColor = dragonGlowHex;

      if (!tile.buildingId) {
        if (tile.resourceNode === 'timber_grove' || tile.resourceNode === 'berry_bush') {
          tile.resourceAmount = Math.max(0, tile.resourceAmount - (directHit ? 140 : 55));
          if (tile.resourceAmount <= 0) {
            tile.resourceNode = 'none';
            tile.terrain = 'scorched';
          }
        } else if (tile.resourceNode === 'stone_outcrop' || tile.resourceNode === 'crystal_monolith') {
          if (directHit) {
            tile.resourceAmount = Math.max(0, tile.resourceAmount - 95);
            if (tile.resourceAmount <= 0) {
              tile.resourceNode = 'none';
              tile.terrain = 'scorched';
            }
          }
        } else if (
          directHit &&
          (tile.terrain === 'forest' ||
            tile.terrain === 'jungle' ||
            tile.terrain === 'taiga' ||
            tile.terrain === 'blossom' ||
            tile.terrain === 'savanna' ||
            tile.terrain === 'fertile' ||
            tile.terrain === 'grass')
        ) {
          tile.terrain = 'scorched';
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

    for (const other of state.units) {
      if (other.id === u.id || other.state === 'ko' || other.statusEffects.shielded) continue;
      const dSq = (other.x - u.x) ** 2 + (other.z - u.z) ** 2;

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
    }

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
        ((isCarnivoreDino || u.role === 'bear') && u.actionCooldown <= 0.35));

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
      if (dist <= def.attackRange) {
        u.state = 'fighting';
        if (u.actionCooldown <= 0) {
          const dmg = def.attackDamage * (isFrenzied ? 1.8 : 1.0);
          u.actionCooldown = u.role === 'wolf' ? 0.72 : 0.9;
          u.attackAnimTimer = 0.48;
          u.attackTargetX = target.x;
          u.attackTargetZ = target.z;
          target.hp -= dmg;
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
            radius: u.role === 'dinosaur' ? 1.55 : u.role === 'bear' ? 1.35 : 1.05,
            color,
            createdAt: Date.now(),
          });
        }
      } else {
        u.state = 'moving';
        const nx = u.x + ((target.x - u.x) / dist) * moveSpeed * dt;
        const nz = u.z + ((target.z - u.z) / dist) * moveSpeed * dt;
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
          u.actionCooldown = isFrenzied ? 0.95 : 2.8;
          u.attackAnimTimer = 0.48;
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
            radius: u.role === 'dinosaur' ? 1.55 : u.role === 'bear' ? 1.35 : 1.05,
            color,
            createdAt: Date.now(),
          });
        }
      } else {
        u.state = 'moving';
        const nx = u.x + ((envTarget.x - u.x) / dist) * moveSpeed * dt;
        const nz = u.z + ((envTarget.z - u.z) / dist) * moveSpeed * dt;
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
        if (!t || t.height <= 0 || t.resourceAmount <= 0 || t.resourceNode === 'none') continue;
        const prefIdx = preferredNodes.indexOf(t.resourceNode);
        if (prefIdx === -1) continue;

        const dist = Math.hypot(tx - ux, tz - uz);
        let score = dist + prefIdx * 3.2;

        if (unit) {
          // Count how many fellow villagers are already heading to or working at this node
          let workersOnNode = 0;
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

          if (
            (t.resourceNode === 'timber_grove' ||
              t.resourceNode === 'stone_outcrop' ||
              t.resourceNode === 'ore_vein') &&
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

  // Burning tile hurts unshielded units
  const curTile = getTile(state, u.x, u.z);
  if (curTile && curTile.onFireTimer > 0 && !u.statusEffects.shielded) {
    u.hp -= 10 * dt;
  }

  const isChild = u.ageStage === 'child';

  // 1. Combat defense, Cooperative City Defense & Racial Combat Doctrines:
  // - Humans: Fast tech progress, but rely heavily on technology (weaker without completed tech structures, stronger with them)
  // - Elves: Peaceful (never initiate unprovoked wars outside their territory), use ranged magic & magic technology to fight and heal
  // - Orcs: Barbarians (fierce melee attackers and border skirmishers, but very slow builders/researchers)
  const allOwnSettlementBlds = u.settlementId
    ? state.buildings.filter((b) => b.settlementId === u.settlementId)
    : [];
  const ownVillageBuildings = allOwnSettlementBlds.filter((b) => b.constructionProgress >= 100);
  const homeAnchor =
    allOwnSettlementBlds.length > 0
      ? { x: allOwnSettlementBlds[0].tileX, z: allOwnSettlementBlds[0].tileZ }
      : { x: u.x, z: u.z };

  const hasHumanTechSupport =
    u.species !== 'human' ||
    state.epochIndex === 0 ||
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
  const hasElfArcaneTech =
    u.species === 'elf' &&
    ownVillageBuildings.some(
      (b) =>
        b.type === 'shaman_totem' ||
        b.type === 'ziggurat' ||
        b.type === 'observatory' ||
        b.type === 'cyber_institute' ||
        b.type === 'dyson_spire',
    );

  // Elves passively weave restorative magic for themselves & nearby kin
  if (u.species === 'elf' && u.hp < u.maxHp) {
    u.hp = Math.min(u.maxHp, u.hp + (hasElfArcaneTech ? 2.5 : 1.2) * dt);
  }

  let nearestEnemy: UnitEntity | null = null;
  let enemyDistSq = Infinity;
  for (const other of state.units) {
    if (other.id === u.id || other.state === 'ko' || other.hp <= 0) continue;
    const isHostileRaider = other.faction === 'hostile';
    const isDangerousBeastNearCity =
      other.faction === 'wildlife' &&
      (other.role === 'dragon' || other.role === 'wolf' || other.role === 'bear') &&
      other.state === 'fighting' &&
      (other.x - homeAnchor.x) ** 2 + (other.z - homeAnchor.z) ** 2 <= 18 * 18;

    // Foreign race trespassing inside this kingdom's territory or attacking a fellow citizen!
    const isForeignIntruderInCity =
      !isChild &&
      other.ageStage !== 'child' &&
      other.faction === 'civilization' &&
      other.species !== u.species &&
      allOwnSettlementBlds.some(
        (b) => (other.x - b.tileX) ** 2 + (other.z - b.tileZ) ** 2 <= 18 * 18,
      );

    // Helping a fellow citizen who is in combat nearby
    const isAttackingKin =
      other.faction === 'civilization' &&
      other.species !== u.species &&
      other.state === 'fighting' &&
      (other.x - u.x) ** 2 + (other.z - u.z) ** 2 <= 16 * 16;

    const isRivalFrenzy =
      !isChild && Boolean(u.statusEffects.frenzied && other.species !== u.species);
    const isOrcSkirmish =
      !isChild &&
      other.ageStage !== 'child' &&
      u.species === 'orc' &&
      other.species !== 'orc' &&
      other.faction === 'civilization';

    if (
      !isHostileRaider &&
      !isDangerousBeastNearCity &&
      !isForeignIntruderInCity &&
      !isAttackingKin &&
      !isRivalFrenzy &&
      !isOrcSkirmish
    ) {
      continue;
    }

    const dSq = (other.x - u.x) ** 2 + (other.z - u.z) ** 2;
    const maxEngageSq = isHostileRaider
      ? Infinity
      : isForeignIntruderInCity || isAttackingKin || isDangerousBeastNearCity
        ? 20 * 20
        : isRivalFrenzy
          ? 100
          : isOrcSkirmish
            ? 64
            : 36;
    if (dSq <= maxEngageSq && dSq < enemyDistSq) {
      enemyDistSq = dSq;
      nearestEnemy = other;
    }
  }

  let speciesCombatMult = 1.0;
  if (u.species === 'orc') {
    speciesCombatMult = 1.42;
  } else if (u.species === 'elf') {
    speciesCombatMult = hasElfArcaneTech ? 1.35 : 1.15;
  } else if (u.species === 'human') {
    speciesCombatMult = hasHumanTechSupport ? 1.0 + state.epochIndex * 0.08 : 0.68;
  }
  const kingMult = u.isKing ? 1.35 : 1.0;

  if (
    !isChild &&
    nearestEnemy &&
    (u.role === 'warrior' ||
      u.isKing ||
      u.statusEffects.frenzied ||
      (u.species === 'orc' && enemyDistSq <= 64) ||
      enemyDistSq <= 18 * 18)
  ) {
    const dist = Math.sqrt(enemyDistSq);
    const effectiveRange = u.species === 'elf' ? Math.max(3.4, def.attackRange) : def.attackRange;
    if (dist <= effectiveRange) {
      u.state = 'fighting';
      if (u.actionCooldown <= 0) {
        u.actionCooldown = u.statusEffects.frenzied ? 0.45 : u.species === 'elf' ? 0.72 : 0.8;
        if (u.species === 'elf') {
          if (!u.statusEffects.shielded && hasElfArcaneTech && Math.random() < 0.28) {
            u.statusEffects.shielded = 4.0;
          }
          const eTile = getTile(state, nearestEnemy.x, nearestEnemy.z);
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'hit_spark',
            x: nearestEnemy.x,
            y: (eTile?.height ?? 2) * 0.45 + 0.35,
            z: nearestEnemy.z,
            originX: u.x,
            originY: (curTile?.height ?? 2) * 0.45 + 0.35,
            originZ: u.z,
            radius: 0.75,
            color: hasElfArcaneTech ? '#56cfe1' : '#c084fc',
            createdAt: Date.now(),
          });
        }
        const dmg =
          def.attackDamage *
          speciesCombatMult *
          kingMult *
          (u.statusEffects.frenzied ? 2.5 : 1.0);
        nearestEnemy.hp -= dmg;
        if (nearestEnemy.hp <= 0) {
          u.kills = (u.kills ?? 0) + 1;
        }
      }
    } else {
      u.state = 'moving';
      u.targetX = nearestEnemy.x + personalOffsetX * 0.5;
      u.targetZ = nearestEnemy.z + personalOffsetZ * 0.5;
      const dx = (nearestEnemy.x - u.x) / dist;
      const dz = (nearestEnemy.z - u.z) / dist;
      u.x += dx * moveSpeed * dt;
      u.z += dz * moveSpeed * dt;
    }
    return;
  }

  // 1a. Attack & Destroy Foreign Race Buildings Built Inside or Encroaching on This Kingdom's Territory!
  if (!isChild && allOwnSettlementBlds.length > 0) {
    let nearestForeignBld: BuildingEntity | null = null;
    let bestForeignBldDistSq = Infinity;
    for (const b of state.buildings) {
      if (b.hp <= 0) continue;
      const bSp = b.species ?? (b.settlementId ? state.settlementSpecies?.[b.settlementId] : undefined) ?? 'human';
      if (bSp === u.species) continue;
      const distToHomeSq = (b.tileX - homeAnchor.x) ** 2 + (b.tileZ - homeAnchor.z) ** 2;
      const distToUnitSq = (b.tileX - u.x) ** 2 + (b.tileZ - u.z) ** 2;
      const encroachingHome = distToHomeSq <= 24 * 24 || allOwnSettlementBlds.some(
        (ob) => (ob.tileX - b.tileX) ** 2 + (ob.tileZ - b.tileZ) ** 2 <= 18 * 18,
      );
      if (!encroachingHome && !(u.species === 'orc' && distToUnitSq <= 16 * 16) && !u.statusEffects.frenzied) {
        continue;
      }
      if (distToUnitSq < bestForeignBldDistSq) {
        bestForeignBldDistSq = distToUnitSq;
        nearestForeignBld = b;
      }
    }

    if (nearestForeignBld) {
      const bDist = Math.sqrt(bestForeignBldDistSq);
      const effectiveRange = u.species === 'elf' ? Math.max(3.4, def.attackRange) : Math.max(1.45, def.attackRange);
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
          const bTile = getTile(state, nearestForeignBld.tileX, nearestForeignBld.tileZ);
          state.pendingVfx.push({
            id: nextEntityId('vfx'),
            type: 'hit_spark',
            x: nearestForeignBld.tileX,
            y: (bTile?.height ?? 2) * 0.45 + 0.35,
            z: nearestForeignBld.tileZ,
            originX: u.species === 'elf' ? u.x : undefined,
            originY: u.species === 'elf' ? (curTile?.height ?? 2) * 0.45 + 0.35 : undefined,
            originZ: u.species === 'elf' ? u.z : undefined,
            radius: 0.85,
            color: u.species === 'elf' ? '#56cfe1' : '#ff9f68',
            createdAt: Date.now(),
          });
        }
      } else {
        u.state = 'moving';
        u.targetX = nearestForeignBld.tileX + personalOffsetX;
        u.targetZ = nearestForeignBld.tileZ + personalOffsetZ;
        const dx = (u.targetX - u.x) / Math.max(0.1, bDist);
        const dz = (u.targetZ - u.z) / Math.max(0.1, bDist);
        u.x += dx * moveSpeed * dt;
        u.z += dz * moveSpeed * dt;
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
        u.x += (sx / sd) * moveSpeed * 1.2 * dt;
        u.z += (sz / sd) * moveSpeed * dt;
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
      const nt = getTile(state, u.x + (dxN / dN) * moveSpeed * dt, u.z + (dzN / dN) * moveSpeed * dt);
      if (nt && nt.height > 0) {
        u.state = 'moving';
        u.x += (dxN / dN) * moveSpeed * dt;
        u.z += (dzN / dN) * moveSpeed * dt;
      } else {
        u.targetX = u.x;
        u.targetZ = u.z;
        u.state = 'idle';
      }
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
      u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + (edx / edist) * expSpeed * dt));
      u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + (edz / edist) * expSpeed * dt));
      return;
    }
  }

  // 2. Priests & Elves heal/cleanse plagued or injured allies nearby
  if (u.role === 'priest' || (u.species === 'elf' && indivHash % 3 === 0)) {
    for (const ally of state.units) {
      if (
        ally.faction === 'civilization' &&
        ally.species === u.species &&
        ally.state !== 'ko' &&
        (ally.hp < ally.maxHp * 0.85 || ally.statusEffects.plagued || ally.statusEffects.cursed)
      ) {
        const dSq = (ally.x - u.x) ** 2 + (ally.z - u.z) ** 2;
        if (dSq <= 12) {
          u.state = 'praying';
          ally.hp = Math.min(ally.maxHp, ally.hp + 15 * dt);
          delete ally.statusEffects.plagued;
          delete ally.statusEffects.cursed;
          return;
        }
      }
    }
  }

  const villageBuildings = allOwnSettlementBlds;

  // 3. Construct or repair unfinished buildings belonging to this citizen's settlement
  // Cap builders per construction site to 2 so the whole town doesn't march in a single-file line!
  const unfinished = villageBuildings.find((b) => {
    if (b.constructionProgress >= 100) return false;
    const buildersHere = state.units.filter(
      (other) =>
        other.id !== u.id &&
        other.settlementId === u.settlementId &&
        other.state !== 'ko' &&
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
    const destX = unfinished.tileX + personalOffsetX;
    const destZ = unfinished.tileZ + personalOffsetZ;
    const dx = destX - u.x;
    const dz = destZ - u.z;
    const dist = Math.hypot(dx, dz);
    u.targetX = destX;
    u.targetZ = destZ;
    if (dist > 1.05) {
      u.state = 'moving';
      u.x += (dx / dist) * moveSpeed * dt;
      u.z += (dz / dist) * moveSpeed * dt;
    } else {
      u.state = 'building';
      const speciesBuildBase =
        u.species === 'human'
          ? 25
          : u.species === 'elf'
            ? 16
            : state.sandboxFreeMode
              ? 14
              : 8.5;
      const buildSpeed =
        (u.role === 'builder' ? 28 : speciesBuildBase) *
        (u.statusEffects.blessed ? 1.6 : 1.0);
      unfinished.constructionProgress = Math.min(100, unfinished.constructionProgress + buildSpeed * dt);
      unfinished.hp = Math.min(unfinished.maxHp, unfinished.hp + 20 * dt);
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

  // 3b. Builders and mason-inclined villagers upgrade older-epoch buildings (max 1-2 per building)
  const upgradeTarget = villageBuildings.find((b) => {
    if (b.constructionProgress < 100 || b.epochLevel >= state.epochIndex) return false;
    const upgradersHere = state.units.filter(
      (other) =>
        other.id !== u.id &&
        other.settlementId === u.settlementId &&
        other.state !== 'ko' &&
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
      u.x += (dx / dist) * moveSpeed * dt;
      u.z += (dz / dist) * moveSpeed * dt;
    } else {
      u.state = 'building';
      const speciesUpgMult = u.species === 'human' ? 1.25 : u.species === 'elf' ? 0.85 : 0.35;
      const upgSpeed = (u.role === 'builder' ? 28 : 18) * speciesUpgMult * (u.statusEffects.blessed ? 1.6 : 1.0);
      upgradeTarget.upgradeProgress = (upgradeTarget.upgradeProgress ?? 0) + upgSpeed * dt;
      upgradeTarget.hp = Math.min(upgradeTarget.maxHp, upgradeTarget.hp + 15 * dt);
    }
    return;
  }

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
        u.x += (dx / dist) * moveSpeed * dt;
        u.z += (dz / dist) * moveSpeed * dt;
      } else {
        recordHarvestDeposit(state, u.carryingType, u.carryingAmount);
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
        u.x += (dx / dist) * moveSpeed * dt;
        u.z += (dz / dist) * moveSpeed * dt;
      } else {
        u.state = u.role === 'priest' ? 'praying' : 'researching';
        const researchPace = u.species === 'human' ? 1.3 : u.species === 'elf' ? 1.1 : 0.38;
        u.harvestTimer = (u.harvestTimer ?? 0) + dt * researchPace * (u.statusEffects.blessed ? 1.7 : 1.0);
        if (u.harvestTimer >= 1.2) {
          u.harvestTimer -= 1.2;
          if (u.role === 'priest') {
            recordHarvestDeposit(state, 'faith', u.species === 'elf' ? 3.6 : 2.6);
          } else if (u.role === 'scholar') {
            recordHarvestDeposit(state, 'knowledge', 2.8 + state.epochIndex * 0.8);
          } else {
            recordHarvestDeposit(state, 'energy', 3.2);
            recordHarvestDeposit(state, 'alloy', 2.0);
            recordHarvestDeposit(state, 'knowledge', 1.8);
          }
        }
      }
      return;
    }
  }

  // 6. Real Gathering Loop (Chopping trees, foraging berries, mining stone/ore/crystals)
  const dxT = u.targetX - u.x;
  const dzT = u.targetZ - u.z;
  const distToTarget = Math.hypot(dxT, dzT);
  const targetTile = getTile(state, Math.round(u.targetX), Math.round(u.targetZ));

  if (
    targetTile &&
    targetTile.height > 0 &&
    targetTile.resourceNode !== 'none' &&
    targetTile.resourceAmount > 0
  ) {
    if (distToTarget > 0.95) {
      u.state = 'moving';
      u.x += (dxT / distToTarget) * moveSpeed * dt;
      u.z += (dzT / distToTarget) * moveSpeed * dt;
    } else {
      u.state = 'gathering';
      // Cooperative bonus when a fellow citizen is helping chop the same tree / mine the same rock!
      const hasHelperHere = state.units.some(
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
            : targetTile.resourceNode === 'berry_bush'
              ? 'food'
              : targetTile.resourceNode === 'stone_outcrop'
                ? 'stone'
                : targetTile.resourceNode === 'ore_vein'
                  ? 'ore'
                  : state.epochIndex >= 4
                    ? 'energy'
                    : 'knowledge';

        if (!u.carryingType || u.carryingType === yieldType) {
          u.carryingType = yieldType;
          u.carryingAmount += take;
        } else {
          // Deposit previous small bundle automatically if switching node type
          recordHarvestDeposit(state, u.carryingType, u.carryingAmount);
          u.carryingType = yieldType;
          u.carryingAmount = take;
        }

        // If node depleted: fell tree / clear bush / exhaust quarry & transform terrain!
        if (targetTile.resourceAmount <= 0) {
          const oldNode = targetTile.resourceNode;
          targetTile.resourceNode = 'none';
          targetTile.resourceAmount = 0;

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

    // Context-sensitive helping: if a fellow villager is cutting a tree or mining nearby alone, go help them!
    if (indivHash % 2 === 0 && u.role !== 'warrior') {
      const allyChopping = state.units.find((other) => {
        if (
          other.id === u.id ||
          other.settlementId !== u.settlementId ||
          other.state !== 'gathering'
        ) {
          return false;
        }
        const d = Math.hypot(other.x - u.x, other.z - u.z);
        if (d > 11) return false;
        const ot = getTile(state, Math.round(other.targetX), Math.round(other.targetZ));
        if (!ot || (ot.resourceNode !== 'timber_grove' && ot.resourceNode !== 'stone_outcrop' && ot.resourceNode !== 'ore_vein')) {
          return false;
        }
        const helpersAlready = state.units.filter(
          (w) =>
            w.id !== u.id &&
            w.state !== 'ko' &&
            Math.hypot(w.targetX - ot.x, w.targetZ - ot.z) <= 1.2,
        ).length;
        return helpersAlready === 1;
      });

      if (allyChopping) {
        const otX = Math.round(allyChopping.targetX);
        const otZ = Math.round(allyChopping.targetZ);
        u.targetX = otX + personalOffsetX;
        u.targetZ = otZ + personalOffsetZ;
        u.state = 'moving';
        return;
      }
    }

    let preferred: TileData['resourceNode'][];
    if (u.role === 'forager') {
      preferred =
        state.resources.food <= state.resources.wood
          ? ['berry_bush', 'timber_grove']
          : ['timber_grove', 'berry_bush'];
    } else if (u.role === 'miner') {
      preferred =
        state.resources.ore < state.resources.stone
          ? ['ore_vein', 'stone_outcrop', 'crystal_monolith']
          : ['stone_outcrop', 'ore_vein', 'crystal_monolith'];
    } else {
      // Give each individual their own vocational preference (Forester, Forager, Quarrier, Prospector, or Balanced)
      const vocation = indivHash % 5;
      if (state.resources.food < 15) {
        preferred = ['berry_bush', 'timber_grove', 'stone_outcrop', 'ore_vein'];
      } else if (state.resources.wood < 15 || villageBuildings.length <= 1) {
        preferred = ['timber_grove', 'berry_bush', 'stone_outcrop', 'ore_vein'];
      } else if (vocation === 0) {
        preferred = ['timber_grove', 'berry_bush', 'stone_outcrop', 'ore_vein'];
      } else if (vocation === 1) {
        preferred = ['berry_bush', 'timber_grove', 'stone_outcrop', 'ore_vein'];
      } else if (vocation === 2) {
        preferred = ['stone_outcrop', 'timber_grove', 'ore_vein', 'berry_bush'];
      } else if (vocation === 3) {
        preferred = ['ore_vein', 'stone_outcrop', 'crystal_monolith', 'timber_grove', 'berry_bush'];
      } else {
        const pairs: [TileData['resourceNode'], number][] = [
          ['berry_bush', state.resources.food],
          ['timber_grove', state.resources.wood],
          ['stone_outcrop', state.resources.stone],
          ['ore_vein', state.resources.ore + (state.epochIndex === 0 ? 40 : 0)],
        ];
        pairs.sort((a, b) => a[1] - b[1]);
        preferred = pairs.map((p) => p[0]);
      }
    }

    const ownSettlementPop = state.units.filter(
      (other) => other.faction === 'civilization' && other.state !== 'ko' && other.settlementId === u.settlementId,
    ).length;

    // Kings and Guards prefer patrolling their city streets once settled, while pitching in during early founding
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

    // Patrol or stroll around OWN settlement
    if (villageBuildings.length > 0) {
      const b = villageBuildings[(indivHash + Math.floor(Math.random() * villageBuildings.length)) % villageBuildings.length];
      u.targetX = Math.max(2, Math.min(state.gridSize - 3, b.tileX + (Math.random() - 0.5) * 6));
      u.targetZ = Math.max(2, Math.min(state.gridSize - 3, b.tileZ + (Math.random() - 0.5) * 6));
    } else {
      u.targetX = Math.max(2, Math.min(state.gridSize - 3, u.x + (Math.random() - 0.5) * 5));
      u.targetZ = Math.max(2, Math.min(state.gridSize - 3, u.z + (Math.random() - 0.5) * 5));
    }
  } else if (distToTarget > 0.35) {
    u.state = 'moving';
    u.x += (dxT / distToTarget) * moveSpeed * dt;
    u.z += (dzT / distToTarget) * moveSpeed * dt;
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
  unit.fallDamageArmed = true;
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
  unit.fallDamageArmed = true;
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

  // Blend cursor release velocity with actual trailing swing momentum
  const combVx = lagVx * 0.6 + throwVx * 0.55;
  const combVz = lagVz * 0.6 + throwVz * 0.55;
  const maxSpeed = 24;
  const spd = Math.hypot(combVx, combVz);
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
  return unit;
}

