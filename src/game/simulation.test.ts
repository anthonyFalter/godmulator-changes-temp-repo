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

test('initial state starts in Prehistoric Age with valid settlement and rates', () => {
  const state = createInitialSimulationState(128);
  assert.equal(state.gridSize, 128);
  assert.equal(state.tiles.length, 128 * 128);
  assert.equal(state.epochIndex, 0);
  assert.equal(EPOCHS[state.epochIndex].id, 'prehistoric');
  assert.equal(state.buildings.length, 3);
  assert.equal(state.units.length, 7);
  assert.ok(state.rates.food > 0);
  assert.ok(state.rates.faith > 0);
});

test('placing a structure deducts cost, updates tile, and increases production rates', () => {
  const state = createInitialSimulationState(128);
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
  const state = createInitialSimulationState(128);
  const initialPop = state.population;
  const res = spawnUnit(state, 'warrior', 64, 64);
  assert.equal(res.ok, true);
  assert.equal(state.population, initialPop + 1);
});

test('terrain sculpting raises and lowers tile elevation and consumes faith', () => {
  const state = createInitialSimulationState(128);
  const tile = getTile(state, 62, 62)!;
  const h0 = tile.height;
  const f0 = state.resources.faith;

  const res = applyTerrainTool(state, 'raise', 62, 62, 1);
  assert.equal(res.ok, true);
  assert.equal(tile.height, Math.min(8, h0 + 1));
  assert.ok(state.resources.faith < f0);
});

test('casting god powers applies status effects, resources, and chronicle events', () => {
  const state = createInitialSimulationState(128);
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
  const state = createInitialSimulationState(128);
  for (let i = 0; i < EPOCHS.length - 1; i++) {
    const res = advanceEpoch(state, true);
    assert.equal(res.ok, true);
    assert.equal(state.epochIndex, i + 1);
  }
  assert.equal(EPOCHS[state.epochIndex].id, 'interstellar');
});

test('simulation step advances resources, year, and processes hostile raider encounters', () => {
  const state = createInitialSimulationState(128);
  const foodBefore = state.resources.food;
  const yearBefore = state.year;

  spawnRaiderWave(state);
  const hostiles = state.units.filter((u) => u.faction === 'hostile');
  assert.equal(hostiles.length, 3);

  stepSimulation(state, 0.05);
  assert.ok(state.resources.food > foodBefore);
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
