import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceEpoch,
  applyTerrainTool,
  castGodPower,
  createInitialSimulationState,
  getTile,
  placeBuilding,
  spawnRaiderWave,
  spawnUnit,
  stepSimulation,
} from './simulation';
import { EPOCHS } from './catalog';

test('initial state starts as uninhabited wilderness with zero settlements or units', () => {
  const state = createInitialSimulationState(128, 'WILD-1');
  assert.equal(state.gridSize, 128);
  assert.equal(state.tiles.length, 128 * 128);
  assert.equal(state.epochIndex, 0);
  assert.equal(EPOCHS[state.epochIndex].id, 'prehistoric');
  assert.equal(state.buildings.length, 0);
  assert.equal(state.units.length, 0);
  assert.equal(state.population, 0);
  assert.ok(state.resources.faith >= 100);
  assert.equal(
    state.tiles.some((t) => t.terrain === 'stone_road'),
    false,
    'Fresh world must have zero pre-paved roads',
  );
});

test('settlers found hearth, chop down trees into wood, construct buildings, and transform environment', () => {
  const state = createInitialSimulationState(128, 'TRIBE-77');
  // Prepare flat grass center + adjacent timber grove so behavior is deterministic & fast
  const cx = 64;
  const cz = 64;
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      const t = getTile(state, cx + dx, cz + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }
  const treeTile = getTile(state, cx + 1, cz)!;
  treeTile.terrain = 'forest';
  treeTile.resourceNode = 'timber_grove';
  treeTile.resourceAmount = 24;

  const s1 = spawnUnit(state, 'villager', cx, cz);
  const s2 = spawnUnit(state, 'villager', cx, cz);
  assert.equal(s1.ok, true);
  assert.equal(s2.ok, true);

  // Step 40s of simulation at 0.1s increments
  for (let i = 0; i < 400; i++) {
    stepSimulation(state, 0.1);
  }

  assert.ok(state.buildings.length >= 1, 'Settlers should autonomously found Ancestral Bonfire');
  assert.equal(state.buildings[0].type, 'bonfire');
  assert.equal(state.buildings[0].constructionProgress, 100);
  assert.equal(treeTile.resourceNode, 'none', 'Nearby timber grove should be felled after harvesting');
  assert.equal(treeTile.terrain, 'grass', 'Deforested tile should transform from forest to grass');
  assert.ok(state.resources.wood > 0, 'Chopped wood should be hauled back to settlement resources');

  // Advance to Bronze Age & verify environment transformation (stone_road paving & epoch buildings)
  state.resources.food += 500;
  state.resources.wood += 500;
  state.resources.stone += 500;
  state.resources.ore += 200;
  state.resources.knowledge += 300;
  state.resources.faith += 200;

  for (let i = 0; i < 300; i++) {
    stepSimulation(state, 0.1);
  }

  assert.ok(state.epochIndex >= 1, 'Civilization should autonomously progress out of Prehistoric Age');
  assert.ok(state.buildings.length >= 2, 'Civilization should autonomously construct multiple structures');
  assert.ok(
    state.tiles.some((t) => t.terrain === 'stone_road'),
    'Bronze+ civilization should pave stone roads around its settlement',
  );
});

test('placing a structure manually deducts cost, updates tile, and increases production rates', () => {
  const state = createInitialSimulationState(128, 12345);
  state.resources.wood = 200;
  state.resources.stone = 200;
  const cx = 64;
  const cz = 66;
  const tile = getTile(state, cx, cz)!;
  tile.height = 3;
  tile.terrain = 'grass';
  tile.buildingId = null;

  const initialWood = state.resources.wood;
  const initialFoodRate = state.rates.food;

  const res = placeBuilding(state, 'forager_hut', cx, cz);
  assert.equal(res.ok, true);
  assert.ok(state.resources.wood < initialWood);
  assert.equal(tile.buildingId !== null, true);
  assert.ok(state.rates.food > initialFoodRate);
});

test('spawning a unit adds entity and updates population count', () => {
  const state = createInitialSimulationState(128, 54321);
  state.resources.food = 100;
  state.resources.ore = 100;
  const initialPop = state.population;
  const res = spawnUnit(state, 'warrior', 64, 64);
  assert.equal(res.ok, true);
  assert.equal(state.population, initialPop + 1);
});

test('terrain sculpting raises and lowers tile elevation and consumes faith', () => {
  const state = createInitialSimulationState(128, 22222);
  const tile = getTile(state, 62, 62)!;
  const h0 = tile.height;
  const f0 = state.resources.faith;

  const res = applyTerrainTool(state, 'raise', 62, 62, 1);
  assert.equal(res.ok, true);
  assert.equal(tile.height, Math.min(8, h0 + 1));
  assert.ok(state.resources.faith < f0);
});

test('casting god powers applies status effects, resources, and chronicle events', () => {
  const state = createInitialSimulationState(128, 33333);
  spawnUnit(state, 'villager', 64, 64);
  const k0 = state.resources.knowledge;

  const eurekaRes = castGodPower(state, 'eureka', 64, 64);
  assert.equal(eurekaRes.ok, true);
  assert.equal(state.resources.knowledge, k0 + 140);

  const blessRes = castGodPower(state, 'blessing', 64, 64);
  assert.equal(blessRes.ok, true);
  const blessedUnits = state.units.filter((u) => (u.statusEffects.blessed ?? 0) > 0);
  assert.ok(blessedUnits.length > 0);
});

test('advancing epochs progresses from Prehistoric all the way to Interstellar Age', () => {
  const state = createInitialSimulationState(128, 44444);
  spawnUnit(state, 'villager', 64, 64);
  for (let i = 0; i < EPOCHS.length - 1; i++) {
    const res = advanceEpoch(state, true);
    assert.equal(res.ok, true);
    assert.equal(state.epochIndex, i + 1);
  }
  assert.equal(EPOCHS[state.epochIndex].id, 'interstellar');
});

test('simulation step advances year when mortals exist and spawns hostile raiders cleanly', () => {
  const state = createInitialSimulationState(128, 55555);
  spawnUnit(state, 'villager', 64, 64);
  const yearBefore = state.year;

  spawnRaiderWave(state);
  const hostiles = state.units.filter((u) => u.faction === 'hostile');
  assert.equal(hostiles.length, 3);

  stepSimulation(state, 0.05);
  assert.ok(state.year > yearBefore);
});

test('seed pipeline produces deterministic identical worlds for same seed and distinct biomes across seeds', () => {
  const w1 = createInitialSimulationState(128, 'AEON-42');
  const w2 = createInitialSimulationState(128, 'AEON-42');
  const w3 = createInitialSimulationState(128, 999111);

  assert.equal(w1.seed, w2.seed);
  assert.notEqual(w1.seed, w3.seed);

  let diffCount = 0;
  const biomeSet = new Set<string>();
  for (let i = 0; i < w1.tiles.length; i++) {
    assert.equal(w1.tiles[i].height, w2.tiles[i].height);
    assert.equal(w1.tiles[i].terrain, w2.tiles[i].terrain);
    assert.equal(w1.tiles[i].resourceNode, w2.tiles[i].resourceNode);
    if (w1.tiles[i].height !== w3.tiles[i].height || w1.tiles[i].terrain !== w3.tiles[i].terrain) {
      diffCount += 1;
    }
    biomeSet.add(w1.tiles[i].terrain);
  }

  assert.ok(diffCount > 4000, `Expected distinct terrain across seeds, got ${diffCount} diffs`);
  assert.ok(biomeSet.size >= 6, `Expected diverse biomes, got ${[...biomeSet].join(', ')}`);
});

test('faraway settlers found separate independent villages and never trek to the first city', () => {
  const state = createInitialSimulationState(128, 'MULTI-VILLAGE');
  const sites = [
    { x: 24, z: 24 },
    { x: 96, z: 96 },
  ];
  for (const s of sites) {
    for (let dz = -3; dz <= 3; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        const t = getTile(state, s.x + dx, s.z + dz)!;
        t.height = 2;
        t.terrain = 'grass';
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      }
    }
    const berry = getTile(state, s.x + 2, s.z)!;
    berry.terrain = 'fertile';
    berry.resourceNode = 'berry_bush';
    berry.resourceAmount = 120;
  }

  // 1. Spawn settler 1 near (24, 24) and let them found Village 1
  const u1 = spawnUnit(state, 'villager', 24, 24);
  assert.equal(u1.ok, true);
  for (let i = 0; i < 60; i++) stepSimulation(state, 0.1);

  assert.equal(state.buildings.length, 1);
  const v1Id = state.buildings[0].settlementId;
  assert.ok(v1Id, 'First village should have a settlementId');

  // 2. Spawn settler 2 far away at (96, 96) — beyond 22-tile awareness radius
  const u2Res = spawnUnit(state, 'villager', 96, 96);
  assert.equal(u2Res.ok, true);
  assert.equal(u2Res.unit?.settlementId, undefined, 'Faraway settler must not know about Village 1 on spawn');

  // Step 8s so faraway settler founds Village 2 and stays local
  for (let i = 0; i < 80; i++) stepSimulation(state, 0.1);

  const distinctSettlements = new Set(state.buildings.map((b) => b.settlementId));
  assert.equal(distinctSettlements.size, 2, 'Two distant pioneer bands must found two independent villages');

  const v2Id = u2Res.unit!.settlementId;
  assert.ok(v2Id && v2Id !== v1Id, 'Faraway settler must belong to Village 2, not Village 1');
  assert.ok(
    Math.hypot(u2Res.unit!.x - 96, u2Res.unit!.z - 96) < 12,
    'Faraway settler must remain near their own village instead of walking across the map to (24,24)',
  );
});

