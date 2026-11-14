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

const VILLAGE_NAMES = [
  'Aurelia', 'Valen', 'Oakhaven', 'Khor', 'Solis', 'Veld', 'Thar', 'Selen',
  'Cyra', 'Nadir', 'Barrow', 'Ilios', 'Kaelholm', 'Vespera', 'Myra', 'Aldenreach',
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
  if (!state.settlementNames[settlementId]) {
    state.settlementNames[settlementId] = createVillageName(state);
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

  let resolvedSettlementId = settlementIdOverride;
  if (def.faction === 'civilization' && !resolvedSettlementId) {
    const nearbyBld = findLocalSettlementBuilding(state, tile.x, tile.z, SETTLEMENT_AWARENESS_RADIUS);
    if (nearbyBld?.settlementId) {
      resolvedSettlementId = nearbyBld.settlementId;
    }
  }

  const unit: UnitEntity = {
    id: nextEntityId('unit'),
    name:
      def.faction === 'hostile'
        ? def.name
        : CITIZEN_NAMES[(state.units.length * 3 + Math.floor(x + z)) % CITIZEN_NAMES.length],
    role,
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
  if (!state.sandboxFreeMode) {
    state.resources.faith = Math.max(0, state.resources.faith - def.faithCost);
  }

  const targetFlattenHeight = Math.max(1, centerTile.height);

  for (let dz = -brushRadius; dz <= brushRadius; dz++) {
    for (let dx = -brushRadius; dx <= brushRadius; dx++) {
      if (dx * dx + dz * dz > brushRadius * brushRadius + 0.5) continue;
      const t = getTile(state, centerX + dx, centerZ + dz);
      if (!t) continue;

      switch (toolType) {
        case 'raise': {
          t.height = Math.min(8, t.height + 1);
          if (t.height >= 7) {
            t.terrain = 'snow';
          } else if (t.height >= 5) {
            t.terrain = 'rock';
          } else if (t.height >= 1 && (t.terrain === 'deep_water' || t.terrain === 'shallow_water')) {
            t.terrain = 'grass';
          }
          break;
        }
        case 'lower': {
          t.height = Math.max(0, t.height - 1);
          if (t.height === 0) {
            t.terrain = 'shallow_water';
            t.resourceNode = 'none';
            t.resourceAmount = 0;
          }
          break;
        }
        case 'flatten': {
          t.height = targetFlattenHeight;
          if (t.height > 0 && (t.terrain === 'deep_water' || t.terrain === 'shallow_water')) {
            t.terrain = 'grass';
          }
          break;
        }
        case 'stone_road': {
          if (t.height === 0) t.height = 1;
          t.terrain = 'stone_road';
          break;
        }
        case 'fertile_meadow': {
          if (t.height === 0) t.height = 1;
          t.terrain = 'fertile';
          if (!t.buildingId) {
            t.resourceNode = 'berry_bush';
            t.resourceAmount = 220;
          }
          break;
        }
        case 'plant_forest': {
          if (t.height === 0) t.height = 1;
          t.terrain = 'forest';
          if (!t.buildingId) {
            t.resourceNode = 'timber_grove';
            t.resourceAmount = 260;
          }
          break;
        }
        case 'seed_ore': {
          if (t.height === 0) t.height = 2;
          t.terrain = 'rock';
          if (!t.buildingId) {
            t.resourceNode = (t.x + t.z) % 3 === 0 ? 'crystal_monolith' : 'ore_vein';
            t.resourceAmount = 350;
          }
          break;
        }
        case 'carve_river': {
          t.height = 0;
          t.terrain = 'shallow_water';
          t.resourceNode = 'none';
          t.resourceAmount = 0;
          break;
        }
      }
    }
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

export function castGodPower(
  state: SimulationState,
  powerType: GodPowerType,
  targetX: number,
  targetZ: number,
): { ok: boolean; reason?: string; isHeavy?: boolean } {
  const def = GOD_POWERS.find((p) => p.type === powerType);
  if (!def) return { ok: false, reason: 'Unknown divine power' };

  if (!state.sandboxFreeMode && state.resources.faith < def.faithCost) {
    return { ok: false, reason: `Requires ${def.faithCost} Faith` };
  }

  if (!state.sandboxFreeMode) {
    state.resources.faith = Math.max(0, state.resources.faith - def.faithCost);
  }

  const r = def.radius;
  const rSq = r * r;
  const centerTile = getTile(state, targetX, targetZ);
  const baseHeight = centerTile ? centerTile.height * 0.45 : 1.2;

  let isHeavy = false;

  switch (powerType) {
    case 'blessing': {
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.faction === 'civilization' && u.state !== 'ko') {
          u.hp = u.maxHp;
          u.statusEffects.blessed = 25;
          delete u.statusEffects.cursed;
          delete u.statusEffects.plagued;
        }
      }
      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= rSq) {
          b.hp = b.maxHp;
          b.blessedTimer = 30;
          b.cursedTimer = 0;
        }
      }
      state.happiness = Math.min(100, state.happiness + 8);
      addChronicle(state, 'Divine Blessing bestowed! Citizens healed and inspired.', 'divine');
      break;
    }

    case 'rain_of_plenty': {
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0) {
          t.onFireTimer = 0;
          t.cursedTimer = 0;
          t.blessedTimer = 25;
          if (!t.buildingId) {
            if ((t.x + t.z) % 2 === 0) {
              t.terrain = 'fertile';
              t.resourceNode = 'berry_bush';
              t.resourceAmount = 260;
            } else {
              t.terrain = 'forest';
              t.resourceNode = 'timber_grove';
              t.resourceAmount = 280;
            }
          }
        }
      }
      state.resources.food += 75;
      state.resources.wood += 60;
      addChronicle(state, 'Rain of Plenty turns the land into lush orchards and timber groves.', 'divine');
      break;
    }

    case 'eureka': {
      state.resources.knowledge += 140;
      state.epochProgress = Math.min(100, state.epochProgress + 18);
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.faction === 'civilization') {
          u.statusEffects.blessed = 20;
        }
      }
      addChronicle(state, 'A Divine Eureka illuminates mortal minds (+140 Knowledge)!', 'divine');
      break;
    }

    case 'golden_age': {
      isHeavy = true;
      state.goldenAgeTimer = 30;
      state.happiness = 100;
      state.resources.food += 100;
      state.resources.faith += 50;
      for (const u of state.units) {
        if (u.faction === 'civilization' && u.state !== 'ko') {
          u.hp = u.maxHp;
          u.statusEffects.blessed = 30;
        }
      }
      addChronicle(state, 'A Golden Age dawns! Civilization output doubled for 30 seconds.', 'epoch');
      break;
    }

    case 'divine_shield': {
      for (const b of state.buildings) {
        const dSq = (b.tileX - targetX) ** 2 + (b.tileZ - targetZ) ** 2;
        if (dSq <= rSq) {
          b.hp = b.maxHp;
          b.shieldTimer = 35;
        }
      }
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.faction === 'civilization') {
          u.statusEffects.shielded = 30;
          u.hp = u.maxHp;
        }
      }
      addChronicle(state, 'Aegis Sanctuary shields your structures and mortals from harm.', 'divine');
      break;
    }

    case 'bloodlust_frenzy': {
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko') {
          u.statusEffects.frenzied = 25;
        }
      }
      addChronicle(state, 'Zealot Frenzy ignites! Units surge with +150% combat ferocity.', 'warning');
      break;
    }

    case 'curse': {
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko') {
          u.statusEffects.cursed = 25;
          delete u.statusEffects.blessed;
          if (u.faction === 'hostile') {
            u.hp = Math.max(10, u.hp - 45);
          }
        }
      }
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq && t.height > 0) {
          t.cursedTimer = 25;
          t.blessedTimer = 0;
        }
      }
      addChronicle(state, 'Shadow Hex cast upon the land, sapping strength and withering soil.', 'warning');
      break;
    }

    case 'plague_miasma': {
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && !u.statusEffects.shielded) {
          u.statusEffects.plagued = 22;
        }
      }
      state.happiness = Math.max(20, state.happiness - 10);
      addChronicle(state, 'Virulent Miasma released! Mortal healers scramble to contain the contagion.', 'warning');
      break;
    }

    case 'lightning_smite': {
      isHeavy = true;
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko') {
          if (u.faction === 'hostile') {
            u.hp = 0;
            u.state = 'ko';
            u.koTimer = 0.45;
            state.totalRaidersDefeated += 1;
          } else if (!u.statusEffects.shielded) {
            u.hp = Math.max(0, u.hp - 65);
            if (u.hp <= 0) {
              u.state = 'ko';
              u.koTimer = 0.45;
            }
          }
        }
      }
      if (centerTile && centerTile.height > 0) {
        centerTile.terrain = 'scorched';
        centerTile.onFireTimer = 10;
      }
      addChronicle(state, 'Celestial Smite strikes from the heavens with blinding thunder!', 'warning');
      break;
    }

    case 'meteor_strike': {
      isHeavy = true;
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq) {
          if (dSq <= 2.2) {
            t.height = Math.max(1, t.height - 1);
            t.terrain = 'scorched';
            t.onFireTimer = 14;
            if (!t.buildingId) {
              t.resourceNode = 'ore_vein';
              t.resourceAmount = 420;
            }
          } else if (t.height > 0 && !t.buildingId && (t.x + t.z) % 2 === 0) {
            t.terrain = 'rock';
            t.resourceNode = 'crystal_monolith';
            t.resourceAmount = 360;
          }
        }
      }
      for (const u of state.units) {
        const dSq = (u.x - targetX) ** 2 + (u.z - targetZ) ** 2;
        if (dSq <= rSq && u.state !== 'ko' && !u.statusEffects.shielded) {
          u.hp = Math.max(0, u.hp - 140);
          if (u.hp <= 0) {
            u.state = 'ko';
            u.koTimer = 0.5;
            if (u.faction === 'hostile') state.totalRaidersDefeated += 1;
          }
        }
      }
      state.resources.ore += 90;
      state.resources.alloy += 35;
      addChronicle(state, 'Starfall Meteor craters the earth, depositing star-iron and rare alloy veins!', 'warning');
      break;
    }

    case 'terraform_beam': {
      isHeavy = true;
      const targetH = centerTile ? Math.max(3, centerTile.height) : 3;
      for (const t of state.tiles) {
        const dSq = (t.x - targetX) ** 2 + (t.z - targetZ) ** 2;
        if (dSq <= rSq) {
          t.height = targetH;
          t.terrain = dSq <= 2.5 ? 'stone_road' : 'crystal_field';
          t.onFireTimer = 0;
          t.cursedTimer = 0;
          t.blessedTimer = 30;
          if (!t.buildingId && dSq > 2.5 && (t.x + t.z) % 2 === 0) {
            t.resourceNode = 'crystal_monolith';
            t.resourceAmount = 400;
          }
        }
      }
      addChronicle(state, 'Genesis Terraformer levels a radiant terrace of crystal monoliths.', 'divine');
      break;
    }

    case 'wormhole_ascension': {
      isHeavy = true;
      state.resources.energy += 200;
      state.resources.alloy += 120;
      state.resources.knowledge += 150;
      state.epochProgress = Math.min(100, state.epochProgress + 25);
      if (centerTile && centerTile.height > 0 && !centerTile.buildingId) {
        centerTile.terrain = 'crystal_field';
        centerTile.resourceNode = 'crystal_monolith';
        centerTile.resourceAmount = 500;
      }
      addChronicle(
        state,
        'Stellar Singularity opened! +200 Energy, +120 Alloy, and +150 Knowledge harvested from the cosmos.',
        'epoch',
      );
      break;
    }
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
  });

  recalculateRatesAndCaps(state);
  return { ok: true, isHeavy };
}

function createVillageName(state: SimulationState): string {
  const used = new Set(Object.values(state.settlementNames ?? {}));
  for (const name of VILLAGE_NAMES) {
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

function chooseNeededSpecialistRole(state: SimulationState, villageCivs: UnitEntity[]): UnitRole {
  const countRole = (r: UnitRole) => villageCivs.filter((u) => u.role === r).length;
  const pop = villageCivs.length;

  if (countRole('forager') < Math.max(1, Math.floor(pop * 0.28))) return 'forager';
  if (countRole('builder') < Math.max(1, Math.floor(pop * 0.2))) return 'builder';
  if (countRole('miner') < Math.max(1, Math.floor(pop * 0.22))) return 'miner';
  if (countRole('warrior') < Math.max(1, Math.floor(pop * 0.14))) return 'warrior';
  if (state.epochIndex >= 1 && countRole('priest') < Math.max(1, Math.floor(pop * 0.12))) return 'priest';
  if (state.epochIndex >= 1 && countRole('scholar') < Math.max(1, Math.floor(pop * 0.16))) return 'scholar';
  if (state.epochIndex >= 5 && countRole('astro_engineer') < Math.max(1, Math.floor(pop * 0.16))) {
    return 'astro_engineer';
  }
  return 'villager';
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

  // 1. Bind local homeless settlers or let distant pioneers found their own independent village!
  for (const pioneer of activeCivs) {
    if (pioneer.settlementId) continue;

    const nearbyBld = findLocalSettlementBuilding(state, pioneer.x, pioneer.z, SETTLEMENT_AWARENESS_RADIUS);
    if (nearbyBld?.settlementId) {
      pioneer.settlementId = nearbyBld.settlementId;
      continue;
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
      const villageName = createVillageName(state);
      state.settlementNames[newSettlementId] = villageName;

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

      // Adopt all homeless pioneers nearby this newly staked hearth
      for (const other of activeCivs) {
        if (!other.settlementId && Math.hypot(other.x - siteTile.x, other.z - siteTile.z) <= SETTLEMENT_AWARENESS_RADIUS) {
          other.settlementId = newSettlementId;
        }
      }

      addChronicle(
        state,
        `Mortal pioneers found ${villageName} at (${siteTile.x}, ${siteTile.z})!`,
        'build',
      );
      recalculateRatesAndCaps(state);
    }
  }

  // Ensure legacy buildings have a settlementId
  for (const b of state.buildings) {
    if (!b.settlementId) {
      b.settlementId = 'city_default';
      if (!state.settlementNames['city_default']) {
        state.settlementNames['city_default'] = createVillageName(state);
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

    let villagePopCap = hasCompletedHearth ? epoch.populationBonus : 0;
    for (const b of completedBuildings) {
      const def = BUILDINGS.find((d) => d.type === b.type);
      if (def) villagePopCap += def.popCapBonus;
    }

    // Autonomous Population Growth for THIS village
    if (
      hasCompletedHearth &&
      villageUnits.length < villagePopCap &&
      state.resources.food >= 28 &&
      state.happiness >= 35
    ) {
      state.resources.food -= 20;
      const role = chooseNeededSpecialistRole(state, villageUnits);
      const spawnHub = completedBuildings[0];
      spawnUnit(state, role, spawnHub.tileX, spawnHub.tileZ, true, sid);
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

  // 6. Update tile timers
  for (const t of state.tiles) {
    if (t.blessedTimer > 0) t.blessedTimer = Math.max(0, t.blessedTimer - dt);
    if (t.cursedTimer > 0) t.cursedTimer = Math.max(0, t.cursedTimer - dt);
    if (t.onFireTimer > 0) t.onFireTimer = Math.max(0, t.onFireTimer - dt);
  }

  // 7. Update building timers
  for (const b of state.buildings) {
    if (b.blessedTimer > 0) b.blessedTimer = Math.max(0, b.blessedTimer - dt);
    if (b.cursedTimer > 0) b.cursedTimer = Math.max(0, b.cursedTimer - dt);
    if (b.shieldTimer > 0) b.shieldTimer = Math.max(0, b.shieldTimer - dt);
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
  // 0. Bind nomadic units only if a settlement is within local awareness radius
  if (!u.settlementId) {
    const nearbyBld = findLocalSettlementBuilding(state, u.x, u.z, SETTLEMENT_AWARENESS_RADIUS);
    if (nearbyBld?.settlementId) {
      u.settlementId = nearbyBld.settlementId;
    }
  }

  // 1. Combat defense (Warriors, Frenzied citizens, or self-defense vs adjacent raiders)
  let nearestHostile: UnitEntity | null = null;
  let hostileDistSq = Infinity;
  for (const other of state.units) {
    if (other.faction === 'hostile' && other.state !== 'ko') {
      const dSq = (other.x - u.x) ** 2 + (other.z - u.z) ** 2;
      if (dSq < hostileDistSq) {
        hostileDistSq = dSq;
        nearestHostile = other;
      }
    }
  }

  if (nearestHostile && (u.role === 'warrior' || u.statusEffects.frenzied || hostileDistSq < 10)) {
    const dist = Math.sqrt(hostileDistSq);
    if (dist <= def.attackRange) {
      u.state = 'fighting';
      if (u.actionCooldown <= 0) {
        u.actionCooldown = u.statusEffects.frenzied ? 0.45 : 0.8;
        const dmg = def.attackDamage * (u.statusEffects.frenzied ? 2.5 : 1.0);
        nearestHostile.hp -= dmg;
      }
    } else {
      u.state = 'moving';
      u.targetX = nearestHostile.x;
      u.targetZ = nearestHostile.z;
      const dx = (nearestHostile.x - u.x) / dist;
      const dz = (nearestHostile.z - u.z) / dist;
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
    (u.role === 'builder' || u.role === 'villager' || villageBuildings.length <= 2)
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
        (u.role === 'builder' ? 28 : 16) * (u.statusEffects.blessed ? 1.6 : 1.0);
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
