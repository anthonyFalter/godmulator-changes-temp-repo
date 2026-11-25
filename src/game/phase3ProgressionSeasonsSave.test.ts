import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  DEFAULT_WORLD_RULES,
  advanceKingdomEpoch,
  createInitialSimulationState,
  getEntityIdCounter,
  getEpochRequiredPopulation,
  getKingdomEpoch,
  getKingdomId,
  getTile,
  getTileFlammabilityRate,
  placeBuilding,
  setWorldEpoch,
  shouldTriggerAgeProgressBanner,
  spawnUnit,
  stepSimulation,
  syncAverageEpochFromKingdoms,
} from './simulation';
import { EPOCHS, getMaxCityPopulation } from './catalog';
import { getEntityInspectProfile } from './entityInspector';
import { buildTileLocalEpochBytes } from './skyAndSea';
import { stepSeasonWeightsVector } from './worldSeasons';
import {
  createMemoryWorldStorageAdapter,
  restoreSimulationFromSave,
  saveWorldToLocalCache,
  updateSavedWorldRules,
} from './worldStorage';
import { DEFAULT_ZONE_TOGGLES } from './zones';

function findLandTile(
  sim: ReturnType<typeof createInitialSimulationState>,
  minDistFromEdge = 6,
) {
  for (let z = minDistFromEdge; z < sim.gridSize - minDistFromEdge; z++) {
    for (let x = minDistFromEdge; x < sim.gridSize - minDistFromEdge; x++) {
      const t = getTile(sim, x, z);
      if (t && t.height > 0 && t.height <= 4 && !t.buildingId && t.terrain === 'grass') {
        return t;
      }
    }
  }
  for (let z = minDistFromEdge; z < sim.gridSize - minDistFromEdge; z++) {
    for (let x = minDistFromEdge; x < sim.gridSize - minDistFromEdge; x++) {
      const t = getTile(sim, x, z);
      if (t && t.height > 0 && !t.buildingId) {
        return t;
      }
    }
  }
  throw new Error('No land tile found');
}

test('Phase 3 (C7): 64x64 and 96x96 single-city kingdoms can progress all the way to Interstellar Age', () => {
  for (const gridSize of [64, 96, 128]) {
    const cityCap = getMaxCityPopulation(gridSize);
    for (let ep = 0; ep < EPOCHS.length - 1; ep++) {
      const reqPop = getEpochRequiredPopulation(ep, gridSize);
      assert.ok(
        reqPop <= cityCap,
        `gridSize=${gridSize} epoch=${ep}: requiredPop ${reqPop} must be <= cityCap ${cityCap}`,
      );
    }
  }

  // Verify an actual 64x64 single-city kingdom at Orbital Age (6) with city-cap pop advances to Star Age (7)
  const sim = createInitialSimulationState(64, 4242, {
    rules: { ...DEFAULT_WORLD_RULES, startingSettlers: 'colony', startingEpochIndex: 6 },
  });
  const b = sim.buildings[0];
  assert.ok(b?.settlementId, 'Expected starter settlement');
  const kid = getKingdomId(sim, b.settlementId);
  const req = getEpochRequiredPopulation(6, 64);
  assert.ok(req <= 28, `Expected Orbital->Star pop requirement <= 28, got ${req}`);

  // Provide required Orbital Age infrastructure (launch_arcology + 34 completed epoch-6 structures)
  sim.sandboxFreeMode = true;
  const landTiles = sim.tiles.filter(
    (t) => t.height > 0 && t.height <= 4 && !t.buildingId && !t.waterKind,
  );
  let placedIdx = 0;
  if (!sim.buildings.some((bld) => bld.settlementId === b.settlementId && bld.type === 'launch_arcology')) {
    const arcologyTile = landTiles[placedIdx++];
    assert.ok(arcologyTile, 'Expected land tile for launch_arcology');
    const arcId = `ent_arcology_${placedIdx}`;
    sim.buildings.push({
      ...b,
      id: arcId,
      type: 'launch_arcology',
      tileX: arcologyTile.x,
      tileZ: arcologyTile.z,
      epochLevel: 6,
      constructionProgress: 100,
      settlementId: b.settlementId,
    });
    arcologyTile.buildingId = arcId;
  }
  while (
    sim.buildings.filter((bld) => bld.settlementId === b.settlementId && bld.constructionProgress >= 100).length < 34 &&
    placedIdx < landTiles.length
  ) {
    const t = landTiles[placedIdx++];
    const newId = `ent_c7_struct_${placedIdx}`;
    sim.buildings.push({
      ...b,
      id: newId,
      type: b.type,
      tileX: t.x,
      tileZ: t.z,
      epochLevel: 6,
      constructionProgress: 100,
      settlementId: b.settlementId,
    });
    t.buildingId = newId;
  }

  // Top up population to meet scaled requirement and provide stockpiles
  const land = findLandTile(sim);
  let safety = 0;
  while (
    sim.units.filter((u) => u.faction === 'civilization' && u.hp > 0).length < req &&
    safety++ < 60
  ) {
    const res = spawnUnit(sim, 'human', land.x, land.z);
    if (res.ok && res.unit) {
      res.unit.settlementId = b.settlementId;
      res.unit.kingdomId = kid;
    }
  }
  sim.resources.food = 50_000;
  sim.resources.wood = 50_000;
  sim.resources.stone = 50_000;
  sim.resources.ore = 50_000;
  sim.resources.knowledge = 50_000;
  sim.resources.energy = 50_000;
  sim.resources.alloy = 50_000;
  sim.resources.faith = 10_000;
  if (!sim.kingdomResources) sim.kingdomResources = {};
  sim.kingdomResources[kid] = {
    food: 50_000,
    wood: 50_000,
    stone: 50_000,
    ore: 50_000,
    knowledge: 50_000,
    energy: 50_000,
    alloy: 50_000,
    faith: 10_000,
  };
  if (!sim.kingdomEpochProgress) sim.kingdomEpochProgress = {};
  sim.kingdomEpochProgress[kid] = 99;

  for (let i = 0; i < 60; i++) {
    stepSimulation(sim, 0.5);
    if (getKingdomEpoch(sim, kid) >= 7) break;
  }
  assert.equal(getKingdomEpoch(sim, kid), 7, '64x64 single-city kingdom should reach Interstellar Age (7)');
});

test('Phase 3 (C8 & M15): restoreSimulationFromSave reseeds ID counter past saved IDs and recalculates rates/caps', async () => {
  const sim = createInitialSimulationState(64, 9001, {
    rules: { ...DEFAULT_WORLD_RULES, startingSettlers: 'colony' },
  });
  // Inject high-numbered IDs simulating a long-running previous session
  const b = sim.buildings[0];
  assert.ok(b, 'Expected starter building');
  b.id = 'ent_98765';
  const u = sim.units[0];
  assert.ok(u, 'Expected starter unit');
  u.id = 'ent_98770';
  const targetTile = getTile(sim, b.tileX, b.tileZ);
  if (targetTile) targetTile.buildingId = b.id;

  // Corrupt cached rates & cap to verify restore recomputes them
  sim.populationCap = 0;
  sim.rates = { food: 0, wood: 0, stone: 0, ore: 0, faith: 0, knowledge: 0, energy: 0, alloy: 0 };

  const adapter = createMemoryWorldStorageAdapter();
  const saved = await saveWorldToLocalCache(
    {
      name: 'ID Reseed World',
      thumbnailDataUrl: null,
      lightingPreset: 'noon',
      seasonPreset: 'winter',
      activeZones: DEFAULT_ZONE_TOGGLES,
      sim,
    },
    adapter,
  );

  const restored = restoreSimulationFromSave(saved);
  assert.ok(
    getEntityIdCounter() >= 98770,
    `Expected entity ID counter >= 98770 after restore, got ${getEntityIdCounter()}`,
  );
  assert.equal(restored.seasonPreset, 'winter', 'seasonPreset must round-trip through save/load');
  assert.ok(restored.populationCap > 0, 'restoreSimulationFromSave must recalculate populationCap');

  const land = findLandTile(restored);
  const spawned = spawnUnit(restored, 'human', land.x, land.z);
  assert.ok(spawned.ok && spawned.unit, 'Should spawn unit after restore');
  const numericId = Number(spawned.unit.id.replace(/\D+/g, ''));
  assert.ok(
    numericId > 98770,
    `New entity ID (${spawned.unit.id}) must exceed highest saved ID (98770)`,
  );
});

test('Phase 3 (H1): seasons drive crop growth speed, winter fire suppression, and seasonal freeze/thaw', () => {
  const sim = createInitialSimulationState(64, 7171);

  // 1. Flammability: snow/tundra always 0; freezing winter suppresses grass fire vs summer
  const grassTile = findLandTile(sim);
  grassTile.terrain = 'grass';
  grassTile.height = 1;
  grassTile.tempOffset = 0;

  sim.seasonPreset = 'summer';
  const summerFlammability = getTileFlammabilityRate(sim, grassTile);
  assert.ok(summerFlammability > 0.25, `Summer grass should be flammable, got ${summerFlammability}`);

  sim.seasonPreset = 'winter';
  grassTile.tempOffset = -12; // guarantee freezing winter temp
  const freezingFlammability = getTileFlammabilityRate(sim, grassTile);
  assert.equal(freezingFlammability, 0, 'Freezing winter tile must suppress wildfire ignition');

  grassTile.terrain = 'snow';
  assert.equal(getTileFlammabilityRate(sim, grassTile), 0, 'Snow tile must have 0 flammability');
  grassTile.terrain = 'tundra';
  assert.equal(getTileFlammabilityRate(sim, grassTile), 0, 'Tundra tile must have 0 flammability');

  // 2. Crop growth slower in freezing winter than warm summer
  const farmSummer = createInitialSimulationState(64, 7172, {
    rules: { ...DEFAULT_WORLD_RULES, startingSettlers: 'colony' },
  });
  const farmWinter = createInitialSimulationState(64, 7172, {
    rules: { ...DEFAULT_WORLD_RULES, startingSettlers: 'colony' },
  });
  const tS = findLandTile(farmSummer);
  const tW = getTile(farmWinter, tS.x, tS.z)!;
  const sid = farmSummer.buildings[0]?.settlementId ?? 'set_1';
  for (const ft of [tS, tW]) {
    ft.terrain = 'fertile';
    ft.farmSettlementId = sid;
    ft.farmPlotKind = 'wheat';
    ft.resourceNode = 'berry_bush';
    ft.cropGrowth = 0;
    ft.cropStage = 0;
    ft.tempOffset = 0;
  }
  farmSummer.seasonPreset = 'summer';
  farmWinter.seasonPreset = 'winter';
  tW.tempOffset = -10;

  for (let i = 0; i < 20; i++) {
    stepSimulation(farmSummer, 0.5);
    stepSimulation(farmWinter, 0.5);
  }
  assert.ok(
    (tS.cropGrowth ?? 0) > (tW.cropGrowth ?? 0) * 2.0,
    `Summer crop growth (${tS.cropGrowth}) should be much faster than freezing winter (${tW.cropGrowth})`,
  );

  // 3. Seasonal freeze in winter & thaw in summer on shallow/inland water
  const iceSim = createInitialSimulationState(64, 7173);
  const lakeTiles: Array<NonNullable<ReturnType<typeof getTile>>> = [];
  for (const t of iceSim.tiles) {
    if (t.height === 0 && (t.terrain === 'shallow_water' || t.isLake || t.isRiver) && !t.waterKind) {
      t.tempOffset = -10;
      lakeTiles.push(t);
    }
  }
  assert.ok(lakeTiles.length > 0, 'Expected shallow/inland water tiles');
  iceSim.seasonPreset = 'winter';
  for (let i = 0; i < 40; i++) {
    stepSimulation(iceSim, 0.5);
  }
  const frozenCount = lakeTiles.filter((t) => t.terrain === 'ice' && t.frozenWaterBase).length;
  assert.ok(frozenCount > 0, 'Winter should freeze calm cold water tiles with frozenWaterBase');

  // Switch to summer and warm them so they thaw back
  iceSim.seasonPreset = 'summer';
  for (const t of lakeTiles) {
    t.tempOffset = 8;
  }
  for (let i = 0; i < 80; i++) {
    stepSimulation(iceSim, 0.5);
  }
  const stillFrozen = lakeTiles.filter((t) => t.terrain === 'ice' && t.frozenWaterBase).length;
  assert.ok(stillFrozen < frozenCount, `Summer should thaw seasonal ice (${stillFrozen} < ${frozenCount})`);
});

test('Phase 3 (H2): startingEpochIndex > 0 and empty-world Age Slider persist when first settlement is founded', () => {
  // Case A: startingEpochIndex = 4 with startingSettlers = 'none'
  const emptyAtomic = createInitialSimulationState(64, 5151, {
    rules: { ...DEFAULT_WORLD_RULES, startingEpochIndex: 4, startingSettlers: 'none' },
  });
  emptyAtomic.sandboxFreeMode = true;
  assert.equal(emptyAtomic.buildings.length, 0);
  assert.equal(emptyAtomic.epochIndex, 4);

  const landA = findLandTile(emptyAtomic);
  const resA = placeBuilding(emptyAtomic, 'bonfire', landA.x, landA.z);
  assert.ok(resA.ok, `Should place first bonfire on empty Atomic world: ${resA.reason ?? ''}`);
  const placedA = emptyAtomic.buildings[emptyAtomic.buildings.length - 1];
  assert.ok(placedA?.settlementId);
  assert.equal(placedA.epochLevel, 4, 'First building on startingEpochIndex=4 world must keep epoch 4');
  assert.equal(
    getKingdomEpoch(emptyAtomic, getKingdomId(emptyAtomic, placedA.settlementId)),
    4,
    'First kingdom on startingEpochIndex=4 world must stay at Atomic Age (4)',
  );

  // Case B: Empty world starts at Stone Age (0), player drags Age Slider to Orbital (6) via setWorldEpoch, then places settlement
  const emptySlide = createInitialSimulationState(64, 5152, {
    rules: { ...DEFAULT_WORLD_RULES, startingEpochIndex: 0, startingSettlers: 'none' },
  });
  emptySlide.sandboxFreeMode = true;
  setWorldEpoch(emptySlide, 6);
  assert.equal(emptySlide.epochIndex, 6);
  const landB = findLandTile(emptySlide);
  const resB = placeBuilding(emptySlide, 'bonfire', landB.x, landB.z);
  assert.ok(resB.ok, `Should place bonfire after setWorldEpoch: ${resB.reason ?? ''}`);
  const placedB = emptySlide.buildings[emptySlide.buildings.length - 1];
  assert.ok(placedB?.settlementId);
  assert.equal(placedB.epochLevel, 6, 'Empty-world Age Slider override must persist onto first founded settlement');
  assert.equal(
    getKingdomEpoch(emptySlide, getKingdomId(emptySlide, placedB.settlementId)),
    6,
  );
});

test('Phase 3 (M6): season transition blend uses smooth 1.4 default without hardcoded 2.4 override', () => {
  const cur = new THREE.Vector4(0, 1, 0, 0);
  const target = { spring: 0, summer: 0, autumn: 0, winter: 1 };
  stepSeasonWeightsVector(cur, target, 0.25);
  // 1 - exp(-0.25 * 1.4) ≈ 0.2953
  assert.ok(cur.w > 0.25 && cur.w < 0.35, `Expected default 1.4 blend ~0.295, got ${cur.w}`);

  const canvasSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/IsometricWorldCanvas.tsx'),
    'utf8',
  );
  assert.ok(
    !canvasSrc.includes('stepSeasonWeightsVector(renderedSeasonWeights, activeSeasonState.weights, dt, 2.4)'),
    'IsometricWorldCanvas.tsx must not override stepSeasonWeightsVector speed with 2.4',
  );
});

test('Phase 3 (M7): mixed-era kingdoms isolate unit inspector gear and per-tile terrain shader epoch map', () => {
  const sim = createInitialSimulationState(64, 8080, {
    rules: { ...DEFAULT_WORLD_RULES, startingSettlers: 'colony' },
  });
  sim.sandboxFreeMode = true;
  const b1 = sim.buildings[0];
  assert.ok(b1?.settlementId, 'Expected starter settlement');
  const k1 = getKingdomId(sim, b1.settlementId);

  // Create a second distant settlement in Orbital Age (6), keep first in Stone Age (0)
  const farTile = sim.tiles.find(
    (t) =>
      t.height > 0 &&
      t.height <= 4 &&
      !t.buildingId &&
      Math.hypot(t.x - b1.tileX, t.z - b1.tileZ) > 18,
  );
  assert.ok(farTile, 'Expected distant land tile');
  const res2 = placeBuilding(sim, 'bonfire', farTile.x, farTile.z);
  assert.ok(res2.ok, `Expected distant bonfire placement: ${res2.reason ?? ''}`);
  const b2 = sim.buildings[sim.buildings.length - 1];
  assert.ok(b2);
  // Assign a guaranteed distinct settlement & kingdom for b2 so k1 and k2 represent separate kingdoms
  const s2 = 'set_orbital_isolated';
  const k2 = 'kingdom_orbital_isolated';
  b2.settlementId = s2;
  if (!sim.settlementKingdoms) sim.settlementKingdoms = {};
  sim.settlementKingdoms[s2] = k2;
  assert.notEqual(k1, k2, 'Test kingdoms must be distinct');
  // Spawn a warrior belonging to Stone Age kingdom k1 BEFORE setting global epochIndex = 6
  // (avoids triggering reconcileKingdomEpochs' legacy global-slider override inside spawnUnit)
  const warriorRes = spawnUnit(sim, 'warrior', b1.tileX, b1.tileZ);
  assert.ok(warriorRes.ok && warriorRes.unit);
  const warrior = warriorRes.unit;
  warrior.settlementId = b1.settlementId;
  warrior.kingdomId = k1;
  warrior.items = undefined; // force era-derived gear generation

  sim.kingdomEpochs![k1] = 0;
  sim.kingdomEpochs![k2] = 6;
  b1.epochLevel = 0;
  b2.epochLevel = 6;
  sim.epochIndex = 6; // Global epoch is 6, while k1 remains Stone Age (0)

  const profile = getEntityInspectProfile(sim, warrior);
  const joinedItems = profile.items.join(' | ');
  assert.match(
    joinedItems,
    /Flint|Club|Spear|Stone|Bone|Hide/i,
    `Stone Age warrior must keep Stone gear even when global epoch is 6, got "${joinedItems}"`,
  );

  // Verify buildTileLocalEpochBytes encodes 0 for Stone Age city tile and 6 for Orbital Age city tile
  const bytes = buildTileLocalEpochBytes(
    sim.gridSize,
    sim.tiles,
    sim.buildings,
    sim.settlementKingdoms,
    sim.kingdomEpochs,
  );
  const idx1 = (b1.tileZ * sim.gridSize + b1.tileX) * 4;
  const idx2 = (b2.tileZ * sim.gridSize + b2.tileX) * 4;
  const decoded1 = Math.round(bytes[idx1] / 16) - 1;
  const decoded2 = Math.round(bytes[idx2] / 16) - 1;
  assert.equal(decoded1, 0, 'Stone Age settlement tile must decode to epoch 0');
  assert.equal(decoded2, 6, 'Orbital Age settlement tile must decode to epoch 6');
});

test('Phase 3 (M8): Industrial/Atomic/Info/Interstellar starting states have era-appropriate stockpiles, buildings, and progress', () => {
  const ind = createInitialSimulationState(64, 3030, {
    rules: { ...DEFAULT_WORLD_RULES, startingSettlers: 'colony', startingEpochIndex: 3 },
  });
  assert.ok(
    ind.resources.ore > 0 && ind.resources.knowledge > 0 && ind.resources.energy > 0 && ind.resources.alloy > 0,
    'Industrial Age start must grant non-zero ore, knowledge, energy, and alloy',
  );

  const atomic = createInitialSimulationState(64, 3031, {
    rules: { ...DEFAULT_WORLD_RULES, startingSettlers: 'colony', startingEpochIndex: 4 },
  });
  assert.ok(
    atomic.buildings.some((b) => b.type === 'fission_reactor'),
    'Atomic Age start must spawn a fission_reactor',
  );
  assert.ok(
    !atomic.buildings.some((b) => b.type === 'cyber_institute'),
    'Atomic Age start should not spawn an Info-Age cyber_institute',
  );

  const info = createInitialSimulationState(64, 3032, {
    rules: { ...DEFAULT_WORLD_RULES, startingSettlers: 'colony', startingEpochIndex: 5 },
  });
  assert.ok(info.buildings.some((b) => b.type === 'fission_reactor'), 'Info Age start should include fission_reactor');
  assert.ok(info.buildings.some((b) => b.type === 'cyber_institute'), 'Info Age start should include cyber_institute');

  const star = createInitialSimulationState(64, 3033, {
    rules: { ...DEFAULT_WORLD_RULES, startingSettlers: 'colony', startingEpochIndex: 7 },
  });
  assert.equal(star.epochProgress, 100, 'Interstellar Age start must initialize epochProgress to 100');
});

test('Phase 3 (M15): updateSavedWorldRules scales building HP, updates vehicles & startingEpochIndex, and quota errors propagate', async () => {
  const sim = createInitialSimulationState(64, 6060, {
    rules: { ...DEFAULT_WORLD_RULES, startingSettlers: 'colony', startingEpochIndex: 1 },
  });
  const baseBld = sim.buildings[0];
  assert.ok(baseBld?.settlementId, 'Expected starter building');
  const origMaxHp = baseBld.maxHp;
  const origHp = baseBld.hp;
  if (!sim.vehicles) sim.vehicles = [];
  sim.vehicles.push({
    id: 'veh_test_1',
    type: 'car',
    species: 'human',
    settlementId: baseBld.settlementId,
    epochLevel: 1,
    x: baseBld.tileX,
    y: 1,
    z: baseBld.tileZ,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 2,
    path: [],
    pathIndex: 0,
    variantSeed: 1,
  });

  const adapter = createMemoryWorldStorageAdapter();
  const saved = await saveWorldToLocalCache(
    {
      name: 'Epoch Rule World',
      thumbnailDataUrl: null,
      lightingPreset: 'noon',
      activeZones: DEFAULT_ZONE_TOGGLES,
      sim,
    },
    adapter,
  );

  const updated = await updateSavedWorldRules(
    saved.id,
    { rules: sim.worldRules!, epochIndex: 5 },
    adapter,
  );
  assert.ok(updated);
  assert.equal(updated.simulation.worldRules?.startingEpochIndex, 5, 'startingEpochIndex must sync to updated epoch');
  const updatedBld = updated.simulation.buildings.find((b) => b.id === baseBld.id)!;
  assert.equal(updatedBld.epochLevel, 5);
  assert.equal(updatedBld.maxHp, origMaxHp + (5 - 1) * 40, 'Building maxHp must scale by (deltaEpoch * 40)');
  assert.equal(updatedBld.hp, Math.min(updatedBld.maxHp, origHp + (5 - 1) * 40));
  assert.equal(updated.simulation.vehicles?.[0]?.epochLevel, 5, 'Vehicle epochLevel must update to new epoch');

  // Verify localStorage QuotaExceededError is surfaced instead of silently succeeding
  const origWindow = (globalThis as { window?: unknown }).window;
  try {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          const err = new Error('QuotaExceededError: storage full');
          err.name = 'QuotaExceededError';
          throw err;
        },
      },
    };
    const failingAdapter = {
      getAll: async () => {
        throw new Error('IDB unavailable');
      },
      getById: async () => {
        throw new Error('IDB unavailable');
      },
      put: async () => {
        throw new Error('IDB unavailable');
      },
      delete: async () => {
        throw new Error('IDB unavailable');
      },
    };
    await assert.rejects(
      saveWorldToLocalCache(
        {
          name: 'Quota Overflow World',
          thumbnailDataUrl: null,
          lightingPreset: 'noon',
          activeZones: DEFAULT_ZONE_TOGGLES,
          sim,
        },
        failingAdapter,
      ),
      /quota/i,
      'QuotaExceededError in localStorage fallback must reject with a quota message',
    );
  } finally {
    if (origWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = origWindow;
    }
  }
});

test('Phase 3 (L4): AgeProgressBanner triggers only on genuine epoch advances, not when low-epoch kingdoms die', () => {
  const sim = createInitialSimulationState(64, 9990, {
    rules: { ...DEFAULT_WORLD_RULES, startingSettlers: 'colony' },
  });
  sim.sandboxFreeMode = true;
  const b1 = sim.buildings[0];
  assert.ok(b1?.settlementId, 'Expected starter settlement');
  const k1 = getKingdomId(sim, b1.settlementId);

  const farTile = sim.tiles.find(
    (t) =>
      t.height > 0 &&
      t.height <= 4 &&
      !t.buildingId &&
      Math.hypot(t.x - b1.tileX, t.z - b1.tileZ) > 16,
  );
  assert.ok(farTile);
  const res2 = placeBuilding(sim, 'bonfire', farTile.x, farTile.z);
  assert.ok(res2.ok);
  const b2 = sim.buildings[sim.buildings.length - 1];
  assert.ok(b2?.settlementId);
  const k2 = getKingdomId(sim, b2.settlementId);

  sim.kingdomEpochs![k1] = 0;
  sim.kingdomEpochs![k2] = 4;
  syncAverageEpochFromKingdoms(sim);
  const prevEpoch = sim.epochIndex; // average ~2
  const prevSeq = sim.epochAdvanceSeq ?? 0;

  // Wipe out Stone Age kingdom k1 -> world average jumps from 2 to 4 without any kingdom advancing!
  sim.buildings = sim.buildings.filter((b) => b.settlementId !== b1.settlementId);
  sim.units = sim.units.filter((u) => u.settlementId !== b1.settlementId && u.kingdomId !== k1);
  syncAverageEpochFromKingdoms(sim);

  assert.ok(sim.epochIndex > prevEpoch, 'Average epoch should rise when low-epoch kingdom dies');
  assert.equal(
    shouldTriggerAgeProgressBanner(prevEpoch, sim.epochIndex, prevSeq, sim.epochAdvanceSeq ?? 0),
    false,
    'Dying low-epoch kingdom must NOT trigger AgeProgressBanner',
  );

  // Genuine kingdom epoch advance MUST increment epochAdvanceSeq and trigger banner
  const seqBeforeAdvance = sim.epochAdvanceSeq ?? 0;
  const epochBeforeAdvance = sim.epochIndex;
  advanceKingdomEpoch(sim, k2);
  assert.equal(
    shouldTriggerAgeProgressBanner(
      epochBeforeAdvance,
      sim.epochIndex,
      seqBeforeAdvance,
      sim.epochAdvanceSeq ?? 0,
    ),
    true,
    'Genuine advanceKingdomEpoch must trigger AgeProgressBanner',
  );
});
