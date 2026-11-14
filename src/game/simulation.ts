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

const CITIZEN_NAMES = [
  'Kaelen', 'Lyra', 'Theron', 'Vesper', 'Oakhart', 'Soren', 'Mira', 'Darian',
  'Elowen', 'Bram', 'Talia', 'Cassian', 'Nyx', 'Orin', 'Sylvi', 'Alden',
  'Rowan', 'Freya', 'Gideon', 'Isolde', 'Zarek', 'Ariadne', 'Cyrus', 'Veda',
];

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
  if (year < 0) return `${Math.abs(Math.round(year)).toLocaleString()} BCE`;
  return `${Math.round(year).toLocaleString()} CE`;
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

export function createInitialSimulationState(gridSize = 128): SimulationState {
  const tiles: TileData[] = [];
  const center = (gridSize - 1) / 2;
  const maxRadius = Math.max(10, gridSize * 0.46);

  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const dx = x - center;
      const dz = z - center;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const normDist = dist / maxRadius;

      // Multi-octave continent & archipelago heightfield scaled to gridSize
      const macroWave = Math.sin(x * 0.085 + 1.1) * Math.cos(z * 0.078 - 0.7) * 1.9;
      const mesoWave = Math.sin(x * 0.19 - z * 0.16) * 1.05;
      const microWave = Math.cos((x + z) * 0.41) * 0.45;
      const falloff = Math.pow(normDist, 1.85) * 4.7;
      const rawHeight = 3.35 - falloff + macroWave + mesoWave + microWave;

      let height = Math.max(0, Math.min(7, Math.round(rawHeight)));

      // Carve a scenic winding river / harbor channel sweeping through the south-east quadrant
      const riverCenter = dz * 0.68 + Math.sin(dz * 0.14) * 3.2;
      if (Math.abs(dx - riverCenter) < 1.65 && dx > 2 && dz > 2) {
        height = Math.min(height, 0);
      }

      // Flatten central acropolis plaza so initial settlement sits on a grand terrace
      if (dist < 4.5) {
        height = 3;
      } else if (dist >= 4.5 && dist < 7.2) {
        height = Math.max(2, Math.min(4, height));
      }

      let terrain: TileData['terrain'] = 'grass';
      let resourceNode: TileData['resourceNode'] = 'none';
      let resourceAmount = 0;

      // Smooth grove clusters so forests, meadows, and mineral ridges form natural regions
      const groveWave = Math.sin(x * 0.21 + 0.4) * Math.cos(z * 0.24 - 1.1);
      const nearStart = dist >= 4.2 && dist <= 9.5;

      if (height === 0) {
        terrain = normDist > 0.86 ? 'deep_water' : 'shallow_water';
      } else if (height === 1) {
        terrain = (x + z) % 3 === 0 ? 'sand' : 'fertile';
        if (terrain === 'fertile' && ((x * 7 + z * 13) % 7 === 0 && groveWave > -0.25)) {
          resourceNode = 'berry_bush';
          resourceAmount = 180;
        }
      } else if (height >= 5) {
        terrain = 'rock';
        if ((x * 3 + z * 5) % 5 === 0) {
          resourceNode = height >= 6 ? 'crystal_monolith' : 'ore_vein';
          resourceAmount = 320;
        } else if ((x * 7 + z * 11) % 6 === 0) {
          resourceNode = 'stone_outcrop';
          resourceAmount = 260;
        }
      } else {
        // Mid-elevation terraces (2..4)
        if (dist < 3.2) {
          terrain = 'stone_road';
        } else if (groveWave > 0.22 || (nearStart && (x * 11 + z * 5) % 5 === 0)) {
          terrain = 'forest';
          if ((x * 5 + z * 3) % 2 === 0 || (x + z * 3) % 5 === 0) {
            resourceNode = 'timber_grove';
            resourceAmount = 240;
          }
        } else if (groveWave < -0.3 || (nearStart && (x * 5 + z * 9) % 7 === 0)) {
          terrain = 'fertile';
          if ((x * 7 + z * 5) % 3 === 0) {
            resourceNode = 'berry_bush';
            resourceAmount = 200;
          }
        } else if ((x * 13 + z * 3) % 19 === 0 && dist > 4.8) {
          terrain = 'rock';
          resourceNode = (x + z) % 2 === 0 ? 'stone_outcrop' : 'ore_vein';
          resourceAmount = 260;
        } else {
          terrain = 'grass';
        }
      }

      tiles.push({
        x,
        z,
        height,
        terrain,
        resourceNode,
        resourceAmount,
        blessedTimer: 0,
        cursedTimer: 0,
        onFireTimer: 0,
        buildingId: null,
      });
    }
  }

  const cx = Math.floor(gridSize / 2);
  const cz = Math.floor(gridSize / 2);

  const initialBuildings: BuildingEntity[] = [
    {
      id: 'bld_bonfire_1',
      type: 'bonfire',
      tileX: cx,
      tileZ: cz,
      hp: 350,
      maxHp: 350,
      constructionProgress: 100,
      epochLevel: 0,
      blessedTimer: 0,
      cursedTimer: 0,
      shieldTimer: 0,
    },
    {
      id: 'bld_forager_1',
      type: 'forager_hut',
      tileX: cx - 2,
      tileZ: cz - 1,
      hp: 220,
      maxHp: 220,
      constructionProgress: 100,
      epochLevel: 0,
      blessedTimer: 0,
      cursedTimer: 0,
      shieldTimer: 0,
    },
    {
      id: 'bld_totem_1',
      type: 'shaman_totem',
      tileX: cx + 2,
      tileZ: cz - 1,
      hp: 260,
      maxHp: 260,
      constructionProgress: 100,
      epochLevel: 0,
      blessedTimer: 0,
      cursedTimer: 0,
      shieldTimer: 0,
    },
  ];

  for (const b of initialBuildings) {
    const t = tiles[getTileIndex(b.tileX, b.tileZ, gridSize)];
    if (t) {
      t.buildingId = b.id;
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }

  const starterRoles: UnitRole[] = [
    'villager',
    'forager',
    'miner',
    'builder',
    'warrior',
    'priest',
    'scholar',
  ];

  const initialUnits: UnitEntity[] = starterRoles.map((role, idx) => {
    const def = UNITS.find((u) => u.role === role)!;
    const angle = (idx / starterRoles.length) * Math.PI * 2;
    const ux = cx + Math.cos(angle) * 2.2;
    const uz = cz + Math.sin(angle) * 2.2;
    return {
      id: `unit_${idx + 1}`,
      name: CITIZEN_NAMES[idx % CITIZEN_NAMES.length],
      role,
      faction: 'civilization',
      x: ux,
      z: uz,
      targetX: ux,
      targetZ: uz,
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
    };
  });

  const initialChronicle: ChronicleEvent[] = [
    {
      id: 'chr_1',
      yearLabel: '10,000 BCE',
      text: 'The First Hearth is kindled on the high stone terrace. Guide your mortals from flint to the stars.',
      tone: 'divine',
      timestamp: Date.now(),
    },
  ];

  const state: SimulationState = {
    gridSize,
    tiles,
    epochIndex: 0,
    epochProgress: 15,
    year: -10000,
    resources: {
      food: 160,
      wood: 140,
      stone: 110,
      ore: 45,
      knowledge: 25,
      energy: 10,
      alloy: 10,
      faith: 120,
    },
    rates: {
      food: 6,
      wood: 4,
      stone: 2,
      ore: 1,
      knowledge: 3,
      energy: 0,
      alloy: 0,
      faith: 6,
    },
    buildings: initialBuildings,
    units: initialUnits,
    population: initialUnits.length,
    populationCap: 28,
    happiness: 88,
    goldenAgeTimer: 0,
    autoBuildEnabled: true,
    sandboxFreeMode: false,
    chronicle: initialChronicle,
    pendingVfx: [],
    totalMiraclesCast: 0,
    totalStructuresBuilt: initialBuildings.length,
    totalRaidersDefeated: 0,
    selectedEntityId: null,
    selectedTile: { x: cx, z: cz },
    outcome: 'none',
  };

  recalculateRatesAndCaps(state);
  return state;
}

export function recalculateRatesAndCaps(state: SimulationState): void {
  const epoch = EPOCHS[state.epochIndex] || EPOCHS[0];
  let popCap = epoch.populationBonus;

  const rates: Resources = {
    food: 1,
    wood: 1,
    stone: 1,
    ore: 0,
    knowledge: 1 + state.epochIndex,
    energy: state.epochIndex >= 3 ? 2 : 0,
    alloy: state.epochIndex >= 3 ? 1 : 0,
    faith: 2,
  };

  for (const b of state.buildings) {
    if (b.constructionProgress < 100) continue;
    const def = BUILDINGS.find((d) => d.type === b.type);
    if (!def) continue;
    popCap += def.popCapBonus;

    const blessMult = b.blessedTimer > 0 ? 1.75 : b.cursedTimer > 0 ? 0.5 : 1.0;
    const epochMult = 1 + state.epochIndex * 0.18;

    for (const [k, v] of Object.entries(def.productionPerSec)) {
      const key = k as keyof Resources;
      rates[key] += (v ?? 0) * blessMult * epochMult;
    }
  }

  // Citizen specialist contributions
  let civCount = 0;
  for (const u of state.units) {
    if (u.faction !== 'civilization' || u.state === 'ko') continue;
    civCount += 1;
    const mult = u.statusEffects.blessed ? 1.8 : u.statusEffects.cursed ? 0.5 : 1.0;
    if (u.role === 'forager') {
      rates.food += 1.5 * mult;
      rates.wood += 1.5 * mult;
    } else if (u.role === 'miner') {
      rates.stone += 1.5 * mult;
      rates.ore += 1.2 * mult;
    } else if (u.role === 'priest') {
      rates.faith += 2.2 * mult;
    } else if (u.role === 'scholar') {
      rates.knowledge += 2.8 * mult;
    } else if (u.role === 'astro_engineer') {
      rates.energy += 3.0 * mult;
      rates.alloy += 2.5 * mult;
      rates.knowledge += 2.0 * mult;
    }
  }

  // Food upkeep is gentle so resources stay net positive when managed
  const foodUpkeep = Math.max(0, Math.floor(civCount * 0.35));
  rates.food = Math.max(1, rates.food - foodUpkeep);

  if (state.goldenAgeTimer > 0) {
    for (const k of Object.keys(rates) as (keyof Resources)[]) {
      rates[k] = Math.round(rates[k] * 2);
    }
  } else {
    for (const k of Object.keys(rates) as (keyof Resources)[]) {
      rates[k] = Math.round(rates[k]);
    }
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

  const newBuilding: BuildingEntity = {
    id: nextEntityId('bld'),
    type: buildingType,
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

  addChronicle(state, `Constructed ${def.name} at terrace (${tile.x}, ${tile.z}).`, 'build');

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

  const unit: UnitEntity = {
    id: nextEntityId('unit'),
    name:
      def.faction === 'hostile'
        ? def.name
        : CITIZEN_NAMES[(state.units.length * 3 + Math.floor(x + z)) % CITIZEN_NAMES.length],
    role,
    faction: def.faction,
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
          if (t.height >= 5) {
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

  // Automatically erect the new Epoch's signature structures on nearby open terrace tiles
  const cx = Math.floor(state.gridSize / 2);
  const cz = Math.floor(state.gridSize / 2);
  const epochBuildings = BUILDINGS.filter((b) => b.epoch === nextEpoch.id);
  const spiralOffsets = [
    [0, -2], [-2, 1], [2, 1], [0, 2], [-3, -1], [3, -1],
    [-2, -3], [2, -3], [-3, 2], [3, 2], [0, -4], [0, 4],
  ];
  for (const bDef of epochBuildings) {
    for (const [ox, oz] of spiralOffsets) {
      const tx = cx + ox;
      const tz = cz + oz;
      const tile = getTile(state, tx, tz);
      if (tile && tile.height > 0 && !tile.buildingId) {
        tile.terrain = 'stone_road';
        const newBld: BuildingEntity = {
          id: nextEntityId('bld'),
          type: bDef.type,
          tileX: tx,
          tileZ: tz,
          hp: bDef.maxHp,
          maxHp: bDef.maxHp,
          constructionProgress: 100,
          epochLevel: state.epochIndex,
          blessedTimer: 15,
          cursedTimer: 0,
          shieldTimer: 0,
        };
        tile.buildingId = newBld.id;
        tile.resourceNode = 'none';
        tile.resourceAmount = 0;
        state.buildings.push(newBld);
        state.totalStructuresBuilt += 1;
        break;
      }
    }
  }

  // Spawn 2 celebration specialists for the new age
  const bonusRole: UnitRole =
    state.epochIndex >= 5 ? 'astro_engineer' : state.epochIndex >= 3 ? 'scholar' : 'builder';
  spawnUnit(state, bonusRole, cx + 1, cz + 1, true);

  const centerTile = getTile(state, cx, cz);
  state.pendingVfx.push({
    id: nextEntityId('vfx'),
    type: 'epoch_up',
    x: cx,
    y: (centerTile?.height ?? 3) * 0.45,
    z: cz,
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
  const cx = Math.floor(state.gridSize / 2);
  const cz = Math.floor(state.gridSize / 2);
  const ringDist = Math.min(Math.floor(state.gridSize * 0.4), 16);
  const archetypes: UnitRole[] = ['raider_swarmer', 'raider_ranged', 'raider_behemoth'];

  let spawnedCount = 0;
  for (let i = 0; i < 3; i++) {
    const role = archetypes[i % archetypes.length];
    const rx = Math.max(2, Math.min(state.gridSize - 3, i % 2 === 0 ? cx - ringDist : cx + ringDist));
    const rz = Math.max(2, Math.min(state.gridSize - 3, cz + (i - 1) * 4));
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

export function stepSimulation(state: SimulationState, rawDt: number): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.1);
  if (dt <= 0) return;

  // 1. Advance historical year based on epoch speed
  const yearsPerSec =
    state.epochIndex === 0
      ? 120
      : state.epochIndex === 1
        ? 60
        : state.epochIndex === 2
          ? 15
          : state.epochIndex === 3
            ? 4
            : 2;
  state.year += yearsPerSec * dt;

  if (state.goldenAgeTimer > 0) {
    state.goldenAgeTimer = Math.max(0, state.goldenAgeTimer - dt);
  }

  // 2. Accumulate resources
  recalculateRatesAndCaps(state);
  for (const k of Object.keys(state.rates) as (keyof Resources)[]) {
    state.resources[k] = Math.max(0, state.resources[k] + state.rates[k] * dt);
  }

  // 3. Epoch progression bar
  if (state.epochIndex < EPOCHS.length - 1) {
    const nextEpoch = EPOCHS[state.epochIndex + 1];
    const reqKnow = Math.max(50, nextEpoch.unlockCost.knowledge);
    const ratio = Math.min(100, Math.round((state.resources.knowledge / reqKnow) * 100));
    state.epochProgress = Math.max(state.epochProgress, ratio);
  } else {
    state.epochProgress = 100;
  }

  // 4. Update tile timers
  for (const t of state.tiles) {
    if (t.blessedTimer > 0) t.blessedTimer = Math.max(0, t.blessedTimer - dt);
    if (t.cursedTimer > 0) t.cursedTimer = Math.max(0, t.cursedTimer - dt);
    if (t.onFireTimer > 0) t.onFireTimer = Math.max(0, t.onFireTimer - dt);
  }

  // 5. Update building timers
  for (const b of state.buildings) {
    if (b.blessedTimer > 0) b.blessedTimer = Math.max(0, b.blessedTimer - dt);
    if (b.cursedTimer > 0) b.cursedTimer = Math.max(0, b.cursedTimer - dt);
    if (b.shieldTimer > 0) b.shieldTimer = Math.max(0, b.shieldTimer - dt);
  }

  // 6. Update unit AI & status effects
  const remainingUnits: UnitEntity[] = [];

  for (const u of state.units) {
    if (u.state === 'ko') {
      u.koTimer -= dt;
      if (u.koTimer > 0) {
        remainingUnits.push(u);
      }
      continue;
    }

    // Status timers
    for (const eff of Object.keys(u.statusEffects) as (keyof typeof u.statusEffects)[]) {
      const val = u.statusEffects[eff] ?? 0;
      if (val > 0) {
        const nextVal = val - dt;
        if (nextVal <= 0) delete u.statusEffects[eff];
        else u.statusEffects[eff] = nextVal;
      }
    }

    // Plague damage & contagion
    if (u.statusEffects.plagued) {
      u.hp -= 4.5 * dt;
      // Contagion to very close unshielded units
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
    const roadBoost = tileUnder?.terrain === 'stone_road' ? 1.45 : 1.0;
    const statusSpeedMult =
      (u.statusEffects.blessed ? 1.6 : 1.0) *
      (u.statusEffects.frenzied ? 1.5 : 1.0) *
      (u.statusEffects.cursed ? 0.55 : 1.0);
    const moveSpeed = def.speed * roadBoost * statusSpeedMult;

    if (u.actionCooldown > 0) u.actionCooldown = Math.max(0, u.actionCooldown - dt);

    if (u.faction === 'hostile') {
      // 3 distinct hostile AI policies:
      // 1) raider_swarmer: rushes nearest civilian unit
      // 2) raider_ranged: kites at distance 3.0..4.2 from nearest unit/building
      // 3) raider_behemoth: targets buildings with a telegraph windup slam
      stepHostileUnitAI(state, u, def, moveSpeed, dt);
    } else {
      stepCivilianUnitAI(state, u, def, moveSpeed, dt);
    }

    remainingUnits.push(u);
  }

  state.units = remainingUnits;

  // Remove destroyed buildings (always keep at least the main bonfire standing at 20% HP unless smited)
  state.buildings = state.buildings.filter((b, idx) => {
    if (b.hp <= 0) {
      if (idx === 0) {
        b.hp = Math.round(b.maxHp * 0.25);
        return true;
      }
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
    // Policy 3: Line-of-Sight Siege Charger — seeks nearest structure
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
    }
    return;
  }

  // Find nearest civilian unit
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
    // Policy 2: Kiter/Ranged — backs away if civilian gets closer than 2.2 tiles, fires between 2.2..4.2
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

  // Policy 1: Swarmer — fast direct pursuit & rapid melee
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

function stepCivilianUnitAI(
  state: SimulationState,
  u: UnitEntity,
  def: typeof UNITS[number],
  moveSpeed: number,
  dt: number,
): void {
  // 1. Check if hostile raiders are nearby (Warriors or Frenzied citizens engage!)
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

  if (nearestHostile && (u.role === 'warrior' || u.statusEffects.frenzied || hostileDistSq < 12)) {
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

  // 3. Move toward targetX, targetZ or pick a new productive task around the settlement
  const dx = u.targetX - u.x;
  const dz = u.targetZ - u.z;
  const distToTarget = Math.sqrt(dx * dx + dz * dz);

  if (distToTarget > 0.25) {
    u.state = 'moving';
    u.x += (dx / distToTarget) * moveSpeed * dt;
    u.z += (dz / distToTarget) * moveSpeed * dt;
  } else {
    // Reached destination: perform role activity briefly then pick next destination
    if (u.actionCooldown <= 0) {
      u.actionCooldown = 2.2 + (u.id.charCodeAt(u.id.length - 1) % 3) * 0.6;

      // Pick a nearby resource node or building within local radius (avoids full 128x128 scan)
      const ux = Math.round(u.x);
      const uz = Math.round(u.z);
      const searchR = 14;
      const minX = Math.max(1, ux - searchR);
      const maxX = Math.min(state.gridSize - 2, ux + searchR);
      const minZ = Math.max(1, uz - searchR);
      const maxZ = Math.min(state.gridSize - 2, uz + searchR);
      const candidateTiles: TileData[] = [];
      for (let tz = minZ; tz <= maxZ; tz++) {
        for (let tx = minX; tx <= maxX; tx++) {
          const t = state.tiles[tz * state.gridSize + tx];
          if (t && t.height > 0 && (t.resourceNode !== 'none' || t.buildingId !== null)) {
            candidateTiles.push(t);
          }
        }
      }

      if (candidateTiles.length > 0) {
        const chosen =
          candidateTiles[
            (Math.floor(Math.abs(state.year) + u.x * 7 + u.z * 11) + u.id.charCodeAt(u.id.length - 1)) %
              candidateTiles.length
          ];
        u.targetX = chosen.x + (Math.random() - 0.5) * 0.4;
        u.targetZ = chosen.z + (Math.random() - 0.5) * 0.4;
      } else if (state.buildings.length > 0) {
        const b = state.buildings[u.id.charCodeAt(u.id.length - 1) % state.buildings.length];
        u.targetX = b.tileX + (Math.random() - 0.5) * 2.0;
        u.targetZ = b.tileZ + (Math.random() - 0.5) * 2.0;
      }
    } else {
      u.state =
        u.role === 'priest'
          ? 'praying'
          : u.role === 'scholar'
            ? 'researching'
            : u.role === 'builder'
              ? 'building'
              : 'gathering';
    }
  }
}
