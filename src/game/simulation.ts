import {
  BUILDINGS,
  EPOCHS,
  GOD_POWERS,
  TERRAIN_TOOLS,
  UNITS,
} from './catalog';
import {
  BuildingEntity,
  BuildingType,
  ChronicleEvent,
  GodPowerType,
  Resources,
  SimulationState,
  SpeciesId,
  TerrainToolType,
  TileData,
  UnitEntity,
  UnitRole,
} from './types';
import { generateWorldTiles, normalizeSeed } from './worldGen';

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
  'Aurelia', 'Valen', 'Oakhaven', 'Solis', 'Veld', 'Selen',
  'Cyra', 'Ilios', 'Aldenreach', 'Highford', 'Sunvale', 'Stonebridge',
];

const ELF_VILLAGE_NAMES = [
  'Sylvaria', 'Starleaf', 'Lothal', 'Greenbough', 'Moonwell', 'Aethelgard',
];

const ORC_VILLAGE_NAMES = [
  'Khor', 'Thar', 'Gromhold', 'Ironcrag', 'Bloodaxe', 'Ashpeak',
];

export const SETTLEMENT_AWARENESS_RADIUS = 22;
export const YEARS_PER_SEC_AT_1X = 0.1;

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

export function createInitialSimulationState(
  gridSize = 128,
  seedInput?: number | string,
): SimulationState {
  const seed = normalizeSeed(seedInput);
  const tiles = generateWorldTiles(gridSize, seed);

  const cx = Math.floor(gridSize / 2);
  const cz = Math.floor(gridSize / 2);

  const initialChronicle: ChronicleEvent[] = [
    {
      id: 'chr_1',
      yearLabel: '10,000 BCE',
      text: `An untouched world awakens (World Seed ${seed}). Spawn Settler Citizens on land to spark civilization.`,
      tone: 'divine',
      timestamp: Date.now(),
    },
  ];

  const state: SimulationState = {
    seed,
    gridSize,
    tiles,
    epochIndex: 0,
    epochProgress: 0,
    year: -10000,
    resources: {
      food: 0,
      wood: 0,
      stone: 0,
      ore: 0,
      knowledge: 0,
      energy: 0,
      alloy: 0,
      faith: 150,
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
    population: 0,
    populationCap: 0,
    happiness: 85,
    goldenAgeTimer: 0,
    autoBuildEnabled: true,
    sandboxFreeMode: false,
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
  };

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
    const epochMult = 1 + state.epochIndex * 0.16;

    for (const [k, v] of Object.entries(def.productionPerSec)) {
      const key = k as keyof Resources;
      rates[key] += (v ?? 0) * blessMult * epochMult;
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
  const species: SpeciesId = state.settlementSpecies[settlementId] ?? 'human';
  state.settlementSpecies[settlementId] = species;
  if (!state.settlementNames[settlementId]) {
    state.settlementNames[settlementId] = createVillageName(state, species);
  }

  const newBuilding: BuildingEntity = {
    id: nextEntityId('bld'),
    type: buildingType,
    settlementId,
    tileX: tile.x,
    tileZ: tile.z,
    hp: def.maxHp,
    maxHp: def.maxHp,
    constructionProgress: 100,
    epochLevel: state.epochIndex,
    blessedTimer: 0,
    cursedTimer: 0,
    shieldTimer: 0,
  };

  tile.buildingId = newBuilding.id;
  tile.resourceNode = 'none';
  tile.resourceAmount = 0;
  state.buildings.push(newBuilding);
  state.totalStructuresBuilt += 1;

  for (const u of state.units) {
    if (u.faction === 'civilization' && u.state !== 'ko' && !u.settlementId) {
      if (Math.hypot(u.x - tile.x, u.z - tile.z) <= SETTLEMENT_AWARENESS_RADIUS) {
        u.settlementId = settlementId;
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

  if (buildingType === 'dyson_spire' && state.epochIndex < 6) {
    state.epochIndex = 6;
    state.epochProgress = 100;
    addChronicle(state, 'The Dyson Ascension Relay pierces the heavens! Interstellar Age achieved!', 'epoch');
  }

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

  const namePool =
    species === 'elf' ? ELF_NAMES : species === 'orc' ? ORC_NAMES : CITIZEN_NAMES;

  const unit: UnitEntity = {
    id: nextEntityId('unit'),
    name:
      def.faction === 'hostile'
        ? def.name
        : namePool[(state.units.length * 3 + Math.floor(x + z)) % namePool.length],
    role,
    species,
    faction: def.faction,
    settlementId: resolvedSettlementId,
    x: tile.x + (Math.random() - 0.5) * 0.35,
    z: tile.z + (Math.random() - 0.5) * 0.35,
    targetX: tile.x,
    targetZ: tile.z,
    hp: def.maxHp,
    maxHp: def.maxHp,
    state: 'idle',
    koTimer: 0,
    statusEffects: {},
    carryingType: null,
    carryingAmount: 0,
    actionCooldown: 0,
    windupTimer: 0,
    targetEntityId: null,
    harvestTimer: 0,
  };

  state.units.push(unit);
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
    t.terrain === 'savanna'
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
  let modifiedCount = 0;

  for (let dz = -brushRadius; dz <= brushRadius; dz++) {
    for (let dx = -brushRadius; dx <= brushRadius; dx++) {
      if (dx * dx + dz * dz > brushRadius * brushRadius + 0.5) continue;
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
            t.height = Math.min(8, t.height + 1);
            if (t.height >= 7) {
              t.terrain = 'snow';
              if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            } else if (t.height >= 5) {
              if (t.terrain !== 'scorched' && t.terrain !== 'crystal_field') {
                t.terrain = 'rock';
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
            } else if (t.height <= 6 && t.terrain === 'snow') {
              t.terrain = 'rock';
            } else if (t.height <= 4 && t.terrain === 'rock') {
              t.terrain = 'savanna';
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
            if (t.height >= 7) t.terrain = 'snow';
            else if (t.height >= 5 && t.terrain !== 'scorched') t.terrain = 'rock';
            else if (t.height < 5 && (t.terrain === 'snow' || t.terrain === 'rock')) t.terrain = 'savanna';
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

export function executeGodPowerImpact(
  state: SimulationState,
  powerType: GodPowerType,
  targetX: number,
  targetZ: number,
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
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.faction === 'civilization' && u.state !== 'ko') {
          u.hp = u.maxHp;
          u.statusEffects.blessed = 32;
          delete u.statusEffects.cursed;
          delete u.statusEffects.plagued;
        }
      }
      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= rSq) {
          b.hp = b.maxHp;
          b.blessedTimer = 35;
          b.cursedTimer = 0;
          if (b.constructionProgress < 100) {
            b.constructionProgress = Math.min(100, b.constructionProgress + 35);
          }
        }
      }
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0) {
          t.onFireTimer = 0;
          t.cursedTimer = 0;
          t.blessedTimer = 30;
          if (t.terrain === 'scorched' || t.terrain === 'swamp' || t.terrain === 'sand') {
            t.terrain = dSq <= rSq * 0.45 ? 'fertile' : 'grass';
          } else if (t.terrain === 'grass' && dSq <= rSq * 0.35 && !t.buildingId) {
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
      }
      state.happiness = Math.min(100, state.happiness + 15);
      addChronicle(state, 'Divine Blessing sanctified the earth, healed citizens, and bloomed meadows.', 'divine');
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
            t.terrain = 'stone_road';
          } else if (t.terrain === 'scorched' || t.terrain === 'savanna' || t.terrain === 'swamp') {
            t.terrain = 'fertile';
          } else if (t.terrain === 'grass' && dSq <= rSq * 0.5 && t.resourceNode === 'none') {
            t.terrain = dSq <= 4.5 || t.x === targetX || t.z === targetZ ? 'stone_road' : 'fertile';
          }
        }
      }
      // Inspire a baby boom across active towns
      const settlementIds = Array.from(new Set(state.buildings.map((b) => b.settlementId ?? 'city_default')));
      for (const sid of settlementIds) {
        const hub = state.buildings.find((b) => b.settlementId === sid && b.constructionProgress >= 100);
        if (hub) {
          const sp = state.settlementSpecies?.[sid] ?? 'human';
          spawnUnit(state, sp, hub.tileX, hub.tileZ, true, sid);
          spawnUnit(state, sp, hub.tileX, hub.tileZ, true, sid);
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
          } else if (u.state !== 'ko') {
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
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko') {
          u.statusEffects.frenzied = 30;
          u.hp = u.maxHp;
          // Drop passive work so enraged units immediately charge into combat
          u.carryingAmount = 0;
          u.carryingType = null;
          u.actionCooldown = 0;
        }
      }
      // Scorch circular crimson war-arena & ignite peripheral war-braziers
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0 && !t.buildingId) {
          if (dSq <= 4.2) {
            t.terrain = 'scorched';
          } else if (Math.abs(dSq - rSq * 0.68) < 2.0 && ((t.x * 13 + t.z * 7) % 6 === 0)) {
            t.onFireTimer = 6;
          }
        }
      }
      addChronicle(state, 'Bloodlust Fury erupted! Units healed and enraged (+150% combat damage).', 'warning');
      break;
    }

    case 'curse': {
      isHeavy = true;
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko' && !u.statusEffects.shielded) {
          u.statusEffects.cursed = 30;
          delete u.statusEffects.blessed;
          u.hp = Math.max(5, u.hp - 45);
        }
      }
      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= rSq && b.shieldTimer <= 0) {
          b.cursedTimer = 30;
          b.blessedTimer = 0;
          b.hp = Math.max(10, b.hp - 55);
        }
      }
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0) {
          t.cursedTimer = 30;
          t.blessedTimer = 0;
          if (!t.buildingId) {
            // Dynamic degradation based on existing biome instead of overwriting rock/snow into mud
            if (t.terrain === 'fertile' || t.terrain === 'forest') {
              t.terrain = dSq <= rSq * 0.45 ? 'swamp' : 'savanna';
            } else if (t.terrain === 'grass') {
              t.terrain = dSq <= 4.5 ? 'scorched' : dSq <= rSq * 0.6 ? 'swamp' : 'savanna';
            } else if (t.terrain === 'savanna' || t.terrain === 'sand') {
              t.terrain = dSq <= rSq * 0.5 ? 'scorched' : 'sand';
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
      }
      state.happiness = Math.max(10, state.happiness - 10);
      addChronicle(state, 'Abyssal Curse blighted the soil into dark mire and withered life.', 'warning');
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
            if (t.terrain === 'fertile' || t.terrain === 'grass' || t.terrain === 'forest') {
              t.terrain = 'swamp';
            } else if (t.terrain === 'savanna') {
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
            u.hp = Math.max(0, u.hp - (isWaterStrike ? 115 : 95));
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
            } else {
              const dist = Math.max(0.25, Math.sqrt(dSq));
              u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + ((u.x - targetX) / dist) * 2.4));
              u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + ((u.z - targetZ) / dist) * 2.4));
            }
          }
        }
      }
      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= rSq && b.shieldTimer <= 0) {
          b.hp = Math.max(0, b.hp - 110);
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
          t.onFireTimer = dSq <= 0.5 && t.terrain !== 'rock' ? 5 : 0;
          if (!t.buildingId && t.resourceNode === 'timber_grove') {
            t.resourceNode = 'none';
            t.resourceAmount = 0;
            state.resources.wood += 10;
          }
        } else if (dSq <= rSq && t.height > 0) {
          if (dSq <= 10.5 && !t.buildingId) {
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
            dSq > 8.5 &&
            (t.terrain === 'forest' ||
              t.terrain === 'savanna' ||
              t.terrain === 'fertile' ||
              t.terrain === 'grass')
          ) {
            if ((t.x * 13 + t.z * 7) % 6 === 0) {
              t.onFireTimer = Math.max(t.onFireTimer, 8);
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
          if (dSq <= (r * 1.45) ** 2 && b.shieldTimer <= 0) {
            b.hp = Math.max(0, b.hp - 160);
          }
        }
        for (const u of state.units) {
          const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
          if (dSq <= (r * 1.6) ** 2 && u.state !== 'ko' && !u.statusEffects.shielded) {
            u.hp = Math.max(0, u.hp - 110);
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.5;
              if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
            } else {
              const dist = Math.max(0.3, Math.sqrt(dSq));
              u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + ((u.x - targetX) / dist) * 5.0));
              u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + ((u.z - targetZ) / dist) * 5.0));
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
            t.height = Math.min(8, tileH + 1);
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
            // 4. Outer scorched blast ring with sparse peripheral brushfires
            t.terrain = 'scorched';
            if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            }
            if ((t.x * 19 + t.z * 31) % 8 === 0) {
              t.onFireTimer = 9;
            } else {
              t.onFireTimer = 0;
            }
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
        if (dSq <= rSq && b.shieldTimer <= 0) {
          const dmg = dSq <= 9.0 ? 360 : 180;
          b.hp = Math.max(0, b.hp - dmg);
        }
      }
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko' && !u.statusEffects.shielded) {
          u.hp = Math.max(0, u.hp - 195);
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.5;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          } else {
            const dist = Math.max(0.3, Math.sqrt(dSq));
            u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + ((u.x - targetX) / dist) * 3.8));
            u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + ((u.z - targetZ) / dist) * 3.8));
          }
        }
      }
      state.resources.ore += 110;
      state.resources.alloy += 45;
      addChronicle(state, 'Cataclysmic Meteor carved a circular volcanic crater and raised a rocky rim!', 'warning');
      break;
    }

    case 'terraform_beam': {
      isHeavy = true;
      const isWaterTarget =
        !centerTile ||
        centerTile.height === 0 ||
        centerTile.terrain === 'deep_water' ||
        centerTile.terrain === 'shallow_water';

      if (isWaterTarget) {
        // Oceanic Terraform: Raises a natural volcanic/coral island atoll from the sea floor
        for (const t of state.tiles) {
          const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
          if (dSq <= rSq) {
            t.onFireTimer = 0;
            t.cursedTimer = 0;
            t.blessedTimer = 30;
            if (dSq <= rSq * 0.38) {
              t.height = Math.max(2, t.height);
              t.terrain = state.epochIndex >= 5 ? 'crystal_field' : 'fertile';
            } else if (dSq <= rSq * 0.72) {
              t.height = Math.max(1, t.height);
              t.terrain = t.height >= 2 ? 'grass' : 'sand';
            } else if (t.height === 0) {
              t.terrain = 'shallow_water';
            }
          }
        }
        addChronicle(state, 'Orbital Terraform raised a lush sanctuary island atoll from the sea!', 'divine');
      } else {
        // Land Terraform: Dynamically terraces & upgrades existing land biomes without overwriting ocean water
        const targetH = Math.max(2, Math.min(6, centerTile.height + 1));
        for (const t of state.tiles) {
          const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
          if (dSq <= rSq) {
            t.onFireTimer = 0;
            t.cursedTimer = 0;
            t.blessedTimer = 30;
            if (t.height === 0) {
              // Shallow coastal shoals without stamping hard land circles into the ocean
              if (dSq <= rSq * 0.65 && t.terrain === 'deep_water') {
                t.terrain = 'shallow_water';
              }
              continue;
            }
            t.height = dSq <= rSq * 0.62 ? targetH : Math.max(1, targetH - 1);
            if (!t.buildingId) {
              if (state.epochIndex >= 5 && dSq <= rSq * 0.5) {
                t.terrain = 'crystal_field';
              } else if (t.terrain === 'scorched') {
                t.terrain = dSq <= rSq * 0.5 ? 'grass' : 'savanna';
              } else if (t.terrain === 'sand' || t.terrain === 'swamp') {
                t.terrain = dSq <= rSq * 0.55 ? 'fertile' : 'grass';
              } else if (t.terrain === 'rock' || t.terrain === 'snow') {
                t.terrain = t.height >= 5 ? 'rock' : 'grass';
              } else if (t.terrain === 'savanna') {
                t.terrain = 'grass';
              } else if (t.terrain === 'grass' && dSq <= rSq * 0.65) {
                t.terrain = 'fertile';
              }
            }
          }
        }
        addChronicle(state, 'Orbital Terraform sculpted and revitalized the terrain into a stepped plateau!', 'divine');
      }
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
        remaining: 9.0,
        duration: 9.0,
        tickTimer: 0,
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
      addChronicle(state, 'Singularity Rift crystallized the terrain and surged cosmic resources!', 'epoch');
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
    powerType !== 'blessing' && powerType !== 'rain_of_plenty';

  if (!deferImpact) {
    isHeavy = executeGodPowerImpact(state, powerType, targetX, targetZ);
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
    radius: def.radius,
    color: def.color,
    createdAt: Date.now(),
    deferImpact,
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
  let sx = 0;
  let sz = 0;
  for (const b of matching) {
    sx += b.tileX;
    sz += b.tileZ;
  }
  return {
    x: Math.round(sx / matching.length),
    z: Math.round(sz / matching.length),
  };
}

export function getSettlementAnchor(state: SimulationState): { x: number; z: number } {
  if (state.buildings.length > 0) {
    let sx = 0;
    let sz = 0;
    for (const b of state.buildings) {
      sx += b.tileX;
      sz += b.tileZ;
    }
    return {
      x: Math.round(sx / state.buildings.length),
      z: Math.round(sz / state.buildings.length),
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

function findBuildableTileNear(
  state: SimulationState,
  anchorX: number,
  anchorZ: number,
  maxRadius = 18,
): TileData | null {
  let fallback: TileData | null = null;
  for (let r = 2; r <= maxRadius; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const t = getTile(state, anchorX + dx, anchorZ + dz);
        if (!t || t.height <= 0 || t.height >= 6 || t.buildingId) continue;
        if (t.terrain === 'deep_water' || t.terrain === 'shallow_water') continue;
        if (t.resourceNode === 'none') {
          return t;
        }
        if (!fallback) fallback = t;
      }
    }
    if (fallback) return fallback;
  }
  return fallback;
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

  const epochYears = [-10000, -3000, 1150, 1860, 1975, 2110, 2450];
  state.year = epochYears[state.epochIndex] ?? state.year + 500;

  // Upgrade existing structures visually to the new epoch level and heal them
  for (const b of state.buildings) {
    b.epochLevel = state.epochIndex;
    b.hp = b.maxHp;
  }

  const anchor = getSettlementAnchor(state);

  // Transform civic plaza around each independent settlement & erect epoch landmark
  if (state.buildings.length > 0) {
    const plazaTerrain = state.epochIndex >= 5 ? 'crystal_field' : 'stone_road';
    const settlementIds = Array.from(new Set(state.buildings.map((b) => b.settlementId ?? 'city_default')));

    for (const sid of settlementIds) {
      const cityAnchor = getSettlementAnchorForId(state, sid);
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dz * dz > 5) continue;
          const pt = getTile(state, cityAnchor.x + dx, cityAnchor.z + dz);
          if (pt && pt.height > 0 && !pt.buildingId && pt.resourceNode === 'none') {
            pt.terrain = plazaTerrain;
          }
        }
      }
    }

    const primarySid = settlementIds[0];
    const primaryAnchor = getSettlementAnchorForId(state, primarySid);

    // Erect the signature landmark of the newly reached age if space is available
    const epochBuildings = BUILDINGS.filter((b) => b.epoch === nextEpoch.id);
    if (epochBuildings.length > 0) {
      const bDef = epochBuildings[0];
      const padTile = findBuildableTileNear(state, primaryAnchor.x, primaryAnchor.z, 12);
      if (padTile) {
        padTile.terrain = state.epochIndex >= 5 ? 'crystal_field' : 'stone_road';
        padTile.resourceNode = 'none';
        padTile.resourceAmount = 0;
        const newBld: BuildingEntity = {
          id: nextEntityId('bld'),
          type: bDef.type,
          settlementId: primarySid,
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
      }
    }

    const bonusRole: UnitRole =
      state.epochIndex >= 5 ? 'astro_engineer' : state.epochIndex >= 2 ? 'scholar' : 'builder';
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
): BuildingType | null {
  const countType = (t: BuildingType) => villageBuildings.filter((b) => b.type === t).length;

  if (countType('bonfire') === 0) return 'bonfire';
  if (countType('forager_hut') < Math.min(4, Math.max(1, Math.floor(villagePop / 4)))) return 'forager_hut';
  if (countType('shaman_totem') < (state.epochIndex >= 1 ? 2 : 1)) return 'shaman_totem';

  if (state.epochIndex >= 1) {
    if (countType('granary') < 2) return 'granary';
    if (countType('smeltery') < 2) return 'smeltery';
    if (countType('ziggurat') < 1) return 'ziggurat';
  }
  if (state.epochIndex >= 2) {
    if (countType('guildhall') < 2) return 'guildhall';
    if (countType('observatory') < 2) return 'observatory';
  }
  if (state.epochIndex >= 3) {
    if (countType('steam_foundry') < 2) return 'steam_foundry';
    if (countType('dynamo_plant') < 2) return 'dynamo_plant';
  }
  if (state.epochIndex >= 4) {
    if (countType('fission_reactor') < 2) return 'fission_reactor';
    if (countType('cyber_institute') < 2) return 'cyber_institute';
  }
  if (state.epochIndex >= 5) {
    if (countType('launch_arcology') < 2) return 'launch_arcology';
  }
  if (state.epochIndex >= 6) {
    if (countType('dyson_spire') < 1) return 'dyson_spire';
  }
  return null;
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

  // 1. Era-driven road & high-tech terrain transformation around completed buildings
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
      state.epochIndex >= 5 &&
      (sampleBld.type === 'launch_arcology' || sampleBld.type === 'dyson_spire')
    ) {
      adj.terrain = 'crystal_field';
      if (adj.resourceNode === 'none' && (adj.x + adj.z) % 3 === 0) {
        adj.resourceNode = 'crystal_monolith';
        adj.resourceAmount = 320;
      }
    } else if (
      state.epochIndex >= 3 &&
      (sampleBld.type === 'steam_foundry' || sampleBld.type === 'fission_reactor')
    ) {
      if (adj.resourceNode === 'none') {
        adj.terrain = 'stone_road';
      } else if (adj.resourceNode === 'timber_grove' && adj.blessedTimer <= 0) {
        adj.resourceNode = 'none';
        adj.resourceAmount = 0;
        adj.terrain = 'stone_road';
      }
    } else if (state.epochIndex >= 1 && adj.resourceNode === 'none') {
      adj.terrain = 'stone_road';
    }
  }

  // 2. Agricultural cultivation near food & civic hubs (forager_hut, granary, guildhall)
  if (
    sampleBld.type === 'forager_hut' ||
    sampleBld.type === 'granary' ||
    sampleBld.type === 'guildhall'
  ) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const fx = sampleBld.tileX + Math.floor(Math.random() * 7) - 3;
      const fz = sampleBld.tileZ + Math.floor(Math.random() * 7) - 3;
      const ft = getTile(state, fx, fz);
      if (
        ft &&
        ft.height > 0 &&
        ft.height <= 4 &&
        !ft.buildingId &&
        ft.resourceNode === 'none' &&
        (ft.terrain === 'grass' || ft.terrain === 'savanna' || ft.terrain === 'fertile')
      ) {
        ft.terrain = 'fertile';
        ft.resourceNode = 'berry_bush';
        ft.resourceAmount = 190;
        break;
      }
    }
  }

  // 3. Natural woodland & wild flora regrowth outside this settlement's urban core
  const rx = Math.max(2, Math.min(state.gridSize - 3, anchor.x + Math.floor(Math.random() * 44) - 22));
  const rz = Math.max(2, Math.min(state.gridSize - 3, anchor.z + Math.floor(Math.random() * 44) - 22));
  const wt = getTile(state, rx, rz);
  if (
    wt &&
    wt.height > 0 &&
    !wt.buildingId &&
    wt.resourceNode === 'none' &&
    Math.hypot(rx - anchor.x, rz - anchor.z) > 8
  ) {
    if (wt.terrain === 'forest') {
      wt.resourceNode = 'timber_grove';
      wt.resourceAmount = 220;
    } else if (wt.terrain === 'fertile') {
      wt.resourceNode = 'berry_bush';
      wt.resourceAmount = 180;
    }
  }
}

function stepCivilizationPlanner(state: SimulationState, dt: number): void {
  const activeCivs = state.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko');
  if (activeCivs.length === 0) return;

  const hasHomelessPioneers = activeCivs.some((u) => !u.settlementId);
  state.civPlanTimer = (state.civPlanTimer ?? 0) + dt;
  const interval = hasHomelessPioneers ? 0.5 : 1.8;
  if (state.civPlanTimer < interval) return;
  state.civPlanTimer = 0;

  if (!state.settlementNames) state.settlementNames = {};
  if (!state.settlementSpecies) state.settlementSpecies = {};

  // 1. Bind local homeless settlers to same-species settlement or found their own village!
  for (const pioneer of activeCivs) {
    if (pioneer.settlementId) continue;

    const nearbyBld = findLocalSettlementBuilding(state, pioneer.x, pioneer.z, SETTLEMENT_AWARENESS_RADIUS);
    if (nearbyBld?.settlementId) {
      const bSpecies = state.settlementSpecies[nearbyBld.settlementId] ?? 'human';
      if (bSpecies === pioneer.species) {
        pioneer.settlementId = nearbyBld.settlementId;
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

      const newSettlementId = nextEntityId('city');
      const sp = pioneer.species ?? 'human';
      const villageName = createVillageName(state, sp);
      state.settlementNames[newSettlementId] = villageName;
      state.settlementSpecies[newSettlementId] = sp;

      const hearth: BuildingEntity = {
        id: nextEntityId('bld'),
        type: 'bonfire',
        settlementId: newSettlementId,
        tileX: siteTile.x,
        tileZ: siteTile.z,
        hp: def.maxHp,
        maxHp: def.maxHp,
        constructionProgress: 30,
        epochLevel: state.epochIndex,
        blessedTimer: 0,
        cursedTimer: 0,
        shieldTimer: 0,
      };
      siteTile.buildingId = hearth.id;
      state.buildings.push(hearth);
      state.totalStructuresBuilt += 1;

      // Adopt nearby homeless pioneers of the same species
      for (const other of activeCivs) {
        if (
          !other.settlementId &&
          other.species === sp &&
          Math.hypot(other.x - siteTile.x, other.z - siteTile.z) <= SETTLEMENT_AWARENESS_RADIUS
        ) {
          other.settlementId = newSettlementId;
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

  // 2. Step each independent village/city separately (its own growth, autobuild & terrain evolution)
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

    // Autonomous Population Growth for THIS village in its own species
    if (
      hasCompletedHearth &&
      villageUnits.length < villagePopCap &&
      state.resources.food >= 28 &&
      state.happiness >= 35
    ) {
      state.resources.food -= 20;
      const spawnHub = completedBuildings[0];
      spawnUnit(state, villageSpecies, spawnHub.tileX, spawnHub.tileZ, true, sid);
    }

    // Autonomous Construction Planner scoped to THIS village
    const activeSites = villageBuildings.filter((b) => b.constructionProgress < 100).length;
    if (state.autoBuildEnabled && hasCompletedHearth && activeSites < 2) {
      const desiredType = pickDesiredAutobuildType(state, villageBuildings, villageUnits.length);
      if (desiredType) {
        const def = BUILDINGS.find((b) => b.type === desiredType);
        if (def && canAfford(state.resources, def.cost, false)) {
          const site = findBuildableTileNear(state, villageAnchor.x, villageAnchor.z, 18);
          if (site) {
            state.resources = deductCost(state.resources, def.cost, false);
            if (site.resourceNode === 'timber_grove') state.resources.wood += 12;
            else if (site.resourceNode === 'stone_outcrop') state.resources.stone += 12;
            site.resourceNode = 'none';
            site.resourceAmount = 0;
            if (state.epochIndex >= 1) site.terrain = 'stone_road';

            const siteBld: BuildingEntity = {
              id: nextEntityId('bld'),
              type: desiredType,
              settlementId: sid,
              tileX: site.x,
              tileZ: site.z,
              hp: def.maxHp,
              maxHp: def.maxHp,
              constructionProgress: 12,
              epochLevel: state.epochIndex,
              blessedTimer: 0,
              cursedTimer: 0,
              shieldTimer: 0,
            };
            site.buildingId = siteBld.id;
            state.buildings.push(siteBld);
            state.totalStructuresBuilt += 1;
            const vName = state.settlementNames[sid] ?? 'Settlement';
            addChronicle(state, `Settlers of ${vName} break ground on a ${def.name} at (${site.x}, ${site.z}).`, 'build');
          }
        }
      }
    }

    // Era-based Environment Transformation around THIS village
    transformSettlementEnvironment(state, villageAnchor, villageBuildings);
  }
}

export function stepSimulation(state: SimulationState, rawDt: number): void {
  let remainingDt = Math.min(Math.max(rawDt, 0), 1.5);
  while (remainingDt > 0.0001) {
    const stepDt = Math.min(remainingDt, 0.1);
    remainingDt -= stepDt;
    stepSimulationSingle(state, stepDt);
  }
}

function stepSimulationSingle(state: SimulationState, dt: number): void {
  if (dt <= 0) return;

  // 1. Advance historical year at 1 year per 10 seconds on 1x speed (once mortals walk the earth)
  if (state.population > 0 || state.buildings.length > 0) {
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
  const epoch = EPOCHS[state.epochIndex] || EPOCHS[0];
  const passiveRates = emptyResources();
  passiveRates.faith = 2;
  for (const b of state.buildings) {
    if (b.constructionProgress < 100) continue;
    const def = BUILDINGS.find((d) => d.type === b.type);
    if (!def) continue;
    const blessMult = b.blessedTimer > 0 ? 1.75 : b.cursedTimer > 0 ? 0.5 : 1.0;
    const epochMult = 1 + state.epochIndex * 0.16;
    for (const [k, v] of Object.entries(def.productionPerSec)) {
      const key = k as keyof Resources;
      passiveRates[key] += (v ?? 0) * blessMult * epochMult;
    }
  }
  const foodUpkeep = state.population > 4 ? (state.population - 4) * 0.18 : 0;
  passiveRates.food = Math.max(-foodUpkeep, passiveRates.food - foodUpkeep);
  const goldenMult = state.goldenAgeTimer > 0 ? 2 : 1;
  for (const k of Object.keys(passiveRates) as (keyof Resources)[]) {
    state.resources[k] = Math.max(0, state.resources[k] + passiveRates[k] * goldenMult * dt);
  }

  // 4. Autonomous Civilization Planner (hearth founding, expansion, population growth, environment transformation)
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

    const completedCount = state.buildings.filter((b) => b.constructionProgress >= 100).length;
    const requiredStructures = Math.max(2, (state.epochIndex + 1) * 2);
    if (completedCount >= requiredStructures && canAfford(state.resources, nextEpoch.unlockCost, false)) {
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
      } else if (haz.kind === 'wormhole_rift') {
        for (const u of state.units) {
          const dx = haz.x - u.x;
          const dz = haz.z - u.z;
          const dSq = dx * dx + dz * dz;
          if (dSq <= rSq && dSq > 0.25 && u.state !== 'ko' && !u.statusEffects.shielded) {
            const dist = Math.sqrt(dSq);
            u.x += (dx / dist) * 1.1;
            u.z += (dz / dist) * 1.1;
            if (u.faction === 'hostile') {
              u.hp -= 12;
            }
          }
        }
      }
    }

    // Continuous radial expansion & coastal sweep for Tsunami waves (spawned when an Asteroid hits water)
    if (haz.kind === 'tsunami_wave') {
      const progress = Math.max(0, Math.min(1, 1 - haz.remaining / Math.max(0.1, haz.duration)));
      const maxR = haz.maxRadius ?? haz.radius * 3.8;
      const prevR = haz.currentRadius ?? 1.0;
      // Fast initial surge that gradually decelerates at maximum reach
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
            // Tsunami wave crashes over low-lying coastal land (height 1)
            if (!t.buildingId && dSq <= (haz.radius * 1.65) ** 2) {
              // Submerge inner low shoreline into shallow sea
              t.height = 0;
              t.terrain = 'shallow_water';
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            } else if (!t.buildingId && dSq <= (haz.radius * 2.35) ** 2 && ((t.x * 13 + t.z * 7) & 3) === 0) {
              // Carve tidal flood pools further along the low coast
              t.height = 0;
              t.terrain = 'shallow_water';
              t.resourceNode = 'none';
              t.resourceAmount = 0;
            } else {
              // Wash grass, forest, fertile meadows, roads, or scorched soil into wet coastal sand & marshland
              if (t.terrain !== 'rock' && t.terrain !== 'snow' && t.terrain !== 'crystal_field') {
                t.terrain = dSq <= (haz.radius * 2.55) ** 2 ? 'sand' : 'swamp';
              }
              if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            }
          } else if (t.height === 2) {
            // Towering tsunami wave surges onto mid-elevation coastal plains (height 2)
            if (!t.buildingId && dSq <= (haz.radius * 1.25) ** 2) {
              // Erode coastal bluffs down to beach level
              t.height = 1;
              t.terrain = 'sand';
              if (t.resourceNode === 'berry_bush' || t.resourceNode === 'timber_grove') {
                t.resourceNode = 'none';
                t.resourceAmount = 0;
              }
            } else if (dSq <= (maxR * 0.9) ** 2) {
              // Inundate grass, forest, fertile, savanna, roads, and scorched land into waterlogged swamp or sand
              if (
                t.terrain === 'grass' ||
                t.terrain === 'fertile' ||
                t.terrain === 'forest' ||
                t.terrain === 'savanna' ||
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
            // Heavy wave spray & run-up on height 3 coastal hills
            if (
              t.terrain === 'scorched' ||
              t.terrain === 'savanna' ||
              t.terrain === 'forest' ||
              t.terrain === 'fertile'
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

      // Sweep units outward along the tsunami wave front on water and low/mid land
      for (const u of state.units) {
        const dx = u.x - haz.x;
        const dz = u.z - haz.z;
        const dist = Math.hypot(dx, dz);
        if (Math.abs(dist - nextR) <= 2.2 && dist > 0.2 && u.state !== 'ko' && !u.statusEffects.shielded) {
          const uTile = getTile(state, Math.round(u.x), Math.round(u.z));
          if (!uTile || uTile.height <= 3) {
            const push = 7.5 * dt;
            u.x = Math.max(1, Math.min(state.gridSize - 2, u.x + (dx / dist) * push));
            u.z = Math.max(1, Math.min(state.gridSize - 2, u.z + (dz / dist) * push));
            u.hp = Math.max(0, u.hp - 36 * dt);
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
              if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
            }
          }
        }
      }

      // Flood surge damage to unshielded coastal buildings (height <= 3)
      for (const b of state.buildings) {
        const dist = Math.hypot(b.tileX - haz.x, b.tileZ - haz.z);
        if (Math.abs(dist - nextR) <= 2.0 && b.shieldTimer <= 0) {
          const bTile = getTile(state, b.tileX, b.tileZ);
          if (!bTile || bTile.height <= 3) {
            const dmgRate = !bTile || bTile.height <= 1 ? 85 : 55;
            b.hp = Math.max(0, b.hp - dmgRate * dt);
          }
        }
      }
    }

    if (haz.remaining > 0) {
      remainingHazards.push(haz);
    }
  }
  state.activeHazards = remainingHazards;

  for (const t of state.tiles) {
    if (t.blessedTimer > 0) t.blessedTimer = Math.max(0, t.blessedTimer - dt);
    if (t.cursedTimer > 0) t.cursedTimer = Math.max(0, t.cursedTimer - dt);
    if (t.onFireTimer > 0) {
      const prevTimer = t.onFireTimer;
      t.onFireTimer = Math.max(0, t.onFireTimer - dt);
      if (t.height <= 0) {
        t.onFireTimer = 0;
        continue;
      }
      // Burn vegetation down to scorched earth as fire consumes the tile
      if (t.resourceAmount > 0 && (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush')) {
        t.resourceAmount = Math.max(0, t.resourceAmount - 26 * dt);
        if (t.resourceAmount <= 0) {
          t.resourceNode = 'none';
          t.terrain = 'scorched';
        }
      } else if (t.onFireTimer === 0 && (t.terrain === 'forest' || t.terrain === 'savanna')) {
        t.terrain = 'scorched';
      }
      // Occasional slow wildfire spread to 1 dry/forest neighbor
      if (Math.floor(prevTimer) !== Math.floor(t.onFireTimer) && Math.random() < 0.14) {
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        const d = dirs[(t.x + t.z + Math.floor(prevTimer)) & 3];
        const nb = getTile(state, t.x + d[0], t.z + d[1]);
        if (
          nb &&
          nb.height > 0 &&
          nb.onFireTimer <= 0 &&
          nb.blessedTimer <= 0 &&
          (nb.terrain === 'forest' || nb.terrain === 'savanna' || nb.terrain === 'fertile')
        ) {
          nb.onFireTimer = 5.5;
        }
      }
    }
  }

  // 7. Update building timers & fire/curse damage
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
    b.epochLevel = Math.max(b.epochLevel, epoch.index);
  }

  // 8. Update unit AI & status effects
  const remainingUnits: UnitEntity[] = [];

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

    if (u.hp <= 0) {
      u.state = 'ko';
      u.koTimer = 0.45;
      if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
      remainingUnits.push(u);
      continue;
    }

    const def = UNITS.find((d) => d.role === u.role)!;
    const tileUnder = getTile(state, u.x, u.z);
    const roadBoost = tileUnder?.terrain === 'stone_road' ? 1.45 : tileUnder?.terrain === 'crystal_field' ? 1.6 : 1.0;
    const statusSpeedMult =
      (u.statusEffects.blessed ? 1.6 : 1.0) *
      (u.statusEffects.frenzied ? 1.5 : 1.0) *
      (u.statusEffects.cursed ? 0.55 : 1.0);
    const moveSpeed = def.speed * roadBoost * statusSpeedMult;

    if (u.actionCooldown > 0) u.actionCooldown = Math.max(0, u.actionCooldown - dt);

    if (u.faction === 'hostile') {
      stepHostileUnitAI(state, u, def, moveSpeed, dt);
    } else {
      stepCivilianUnitAI(state, u, def, moveSpeed, dt);
    }

    remainingUnits.push(u);
  }

  state.units = remainingUnits;

  // Remove destroyed buildings (preserve primary hearth if others stand, collapse if all fail)
  state.buildings = state.buildings.filter((b) => {
    if (b.hp <= 0) {
      const t = getTile(state, b.tileX, b.tileZ);
      if (t && t.buildingId === b.id) t.buildingId = null;
      return false;
    }
    return true;
  });
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

function findNearestResourceTile(
  state: SimulationState,
  ux: number,
  uz: number,
  preferredNodes: TileData['resourceNode'][],
): TileData | null {
  const rx = Math.round(ux);
  const rz = Math.round(uz);
  let bestTile: TileData | null = null;
  let bestScore = Infinity;

  for (const radius of [12, 24, 42]) {
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
        const score = dist + prefIdx * 3.5;
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
  moveSpeed: number,
  dt: number,
): void {
  // 0. Bind nomadic units only if a same-species settlement is within local awareness radius
  if (!u.settlementId) {
    const nearbyBld = findLocalSettlementBuilding(state, u.x, u.z, SETTLEMENT_AWARENESS_RADIUS);
    if (nearbyBld?.settlementId) {
      const bSpecies = state.settlementSpecies?.[nearbyBld.settlementId] ?? 'human';
      if (bSpecies === u.species) {
        u.settlementId = nearbyBld.settlementId;
      }
    }
  }

  // Burning tile hurts unshielded units
  const curTile = getTile(state, u.x, u.z);
  if (curTile && curTile.onFireTimer > 0 && !u.statusEffects.shielded) {
    u.hp -= 10 * dt;
  }

  // 1. Combat defense (Warriors, Frenzied berserkers, Orc border clashes, or self-defense vs raiders)
  let nearestEnemy: UnitEntity | null = null;
  let enemyDistSq = Infinity;
  for (const other of state.units) {
    if (other.id === u.id || other.state === 'ko') continue;
    const isHostileRaider = other.faction === 'hostile';
    const isRivalFrenzy = Boolean(u.statusEffects.frenzied && other.species !== u.species);
    const isOrcSkirmish =
      u.species === 'orc' && other.species !== 'orc' && other.faction === 'civilization';
    if (!isHostileRaider && !isRivalFrenzy && !isOrcSkirmish) continue;

    const dSq = (other.x - u.x) ** 2 + (other.z - u.z) ** 2;
    const maxEngageSq = isHostileRaider ? Infinity : isRivalFrenzy ? 100 : 36;
    if (dSq <= maxEngageSq && dSq < enemyDistSq) {
      enemyDistSq = dSq;
      nearestEnemy = other;
    }
  }

  if (
    nearestEnemy &&
    (u.role === 'warrior' ||
      u.statusEffects.frenzied ||
      (u.species === 'orc' && enemyDistSq <= 36) ||
      enemyDistSq < 10)
  ) {
    const dist = Math.sqrt(enemyDistSq);
    if (dist <= def.attackRange) {
      u.state = 'fighting';
      if (u.actionCooldown <= 0) {
        u.actionCooldown = u.statusEffects.frenzied ? 0.45 : 0.8;
        const speciesCombatMult = u.species === 'orc' ? 1.3 : 1.0;
        const dmg = def.attackDamage * speciesCombatMult * (u.statusEffects.frenzied ? 2.5 : 1.0);
        nearestEnemy.hp -= dmg;
      }
    } else {
      u.state = 'moving';
      u.targetX = nearestEnemy.x;
      u.targetZ = nearestEnemy.z;
      const dx = (nearestEnemy.x - u.x) / dist;
      const dz = (nearestEnemy.z - u.z) / dist;
      u.x += dx * moveSpeed * dt;
      u.z += dz * moveSpeed * dt;
    }
    return;
  }

  // 2. Priests heal/cleanse plagued or injured allies
  if (u.role === 'priest') {
    for (const ally of state.units) {
      if (
        ally.faction === 'civilization' &&
        ally.state !== 'ko' &&
        (ally.hp < ally.maxHp || ally.statusEffects.plagued || ally.statusEffects.cursed)
      ) {
        const dSq = (ally.x - u.x) ** 2 + (ally.z - u.z) ** 2;
        if (dSq <= 9) {
          u.state = 'praying';
          ally.hp = Math.min(ally.maxHp, ally.hp + 15 * dt);
          delete ally.statusEffects.plagued;
          delete ally.statusEffects.cursed;
          return;
        }
      }
    }
  }

  const villageBuildings = u.settlementId
    ? state.buildings.filter((b) => b.settlementId === u.settlementId)
    : [];

  // 3. Construct or repair unfinished buildings belonging strictly to this citizen's settlement
  const unfinished = villageBuildings.find((b) => b.constructionProgress < 100);
  if (
    unfinished &&
    u.carryingAmount === 0 &&
    (u.role === 'builder' || u.role === 'villager' || u.species === 'human' || villageBuildings.length <= 2)
  ) {
    const dx = unfinished.tileX - u.x;
    const dz = unfinished.tileZ - u.z;
    const dist = Math.hypot(dx, dz);
    u.targetX = unfinished.tileX;
    u.targetZ = unfinished.tileZ;
    if (dist > 1.05) {
      u.state = 'moving';
      u.x += (dx / dist) * moveSpeed * dt;
      u.z += (dz / dist) * moveSpeed * dt;
    } else {
      u.state = 'building';
      const buildSpeed =
        (u.role === 'builder' ? 28 : u.species === 'human' ? 22 : 16) *
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

  // 4. Hauling harvested resources back to OWN settlement storage
  const carryCap = u.role === 'forager' || u.role === 'miner' ? 12 : 8;
  if (u.carryingAmount >= carryCap && u.carryingType) {
    const dropoff = findNearestDropoffBuilding(state, u.x, u.z, u.settlementId);
    if (dropoff) {
      const dx = dropoff.tileX - u.x;
      const dz = dropoff.tileZ - u.z;
      const dist = Math.hypot(dx, dz);
      u.targetX = dropoff.tileX;
      u.targetZ = dropoff.tileZ;
      if (dist > 1.1) {
        u.state = 'moving';
        u.x += (dx / dist) * moveSpeed * dt;
        u.z += (dz / dist) * moveSpeed * dt;
      } else {
        recordHarvestDeposit(state, u.carryingType, u.carryingAmount);
        u.carryingAmount = 0;
        u.carryingType = null;
        u.actionCooldown = 0.25;
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
      const dx = targetBld.tileX - u.x;
      const dz = targetBld.tileZ - u.z;
      const dist = Math.hypot(dx, dz);
      u.targetX = targetBld.tileX;
      u.targetZ = targetBld.tileZ;
      if (dist > 1.35) {
        u.state = 'moving';
        u.x += (dx / dist) * moveSpeed * dt;
        u.z += (dz / dist) * moveSpeed * dt;
      } else {
        u.state = u.role === 'priest' ? 'praying' : 'researching';
        u.harvestTimer = (u.harvestTimer ?? 0) + dt * (u.statusEffects.blessed ? 1.7 : 1.0);
        if (u.harvestTimer >= 1.2) {
          u.harvestTimer -= 1.2;
          if (u.role === 'priest') {
            recordHarvestDeposit(state, 'faith', 2.8);
          } else if (u.role === 'scholar') {
            recordHarvestDeposit(state, 'knowledge', 3.4 + state.epochIndex * 1.1);
          } else {
            recordHarvestDeposit(state, 'energy', 4.0);
            recordHarvestDeposit(state, 'alloy', 2.5);
            recordHarvestDeposit(state, 'knowledge', 2.2);
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
  const targetTile = getTile(state, u.targetX, u.targetZ);

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
      const workMult =
        (def.harvestRate / 6) *
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
            targetTile.terrain =
              state.epochIndex >= 1 && (targetTile.x + targetTile.z) % 3 === 0 ? 'fertile' : 'grass';
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

  // 7. Pick next resource node matching role & settlement shortages
  if (u.actionCooldown <= 0) {
    u.actionCooldown = 0.6;
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
      // Villagers & others dynamically balance food, wood, stone, ore
      const pairs: [TileData['resourceNode'], number][] = [
        ['berry_bush', state.resources.food],
        ['timber_grove', state.resources.wood],
        ['stone_outcrop', state.resources.stone],
        ['ore_vein', state.resources.ore + (state.epochIndex === 0 ? 40 : 0)],
      ];
      pairs.sort((a, b) => a[1] - b[1]);
      preferred = pairs.map((p) => p[0]);
    }

    const nodeTile = findNearestResourceTile(state, u.x, u.z, preferred);
    if (nodeTile) {
      u.targetX = nodeTile.x + ((u.id.charCodeAt(u.id.length - 1) % 3) - 1) * 0.2;
      u.targetZ = nodeTile.z + ((u.id.charCodeAt(0) % 3) - 1) * 0.2;
      u.state = 'moving';
      return;
    }

    // Patrol around OWN settlement if no resource nodes are nearby
    if (villageBuildings.length > 0) {
      const b = villageBuildings[u.id.charCodeAt(u.id.length - 1) % villageBuildings.length];
      u.targetX = b.tileX + (Math.random() - 0.5) * 4;
      u.targetZ = b.tileZ + (Math.random() - 0.5) * 4;
    } else {
      u.targetX = Math.max(2, Math.min(state.gridSize - 3, u.x + (Math.random() - 0.5) * 4));
      u.targetZ = Math.max(2, Math.min(state.gridSize - 3, u.z + (Math.random() - 0.5) * 4));
    }
  } else if (distToTarget > 0.35) {
    u.state = 'moving';
    u.x += (dxT / distToTarget) * moveSpeed * dt;
    u.z += (dzT / distToTarget) * moveSpeed * dt;
  } else {
    u.state = 'idle';
  }
}
