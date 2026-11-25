import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTerrainTool,
  createInitialSimulationState,
  executeGodPowerImpact,
  executeTerrainDropBatchImpact,
  executeTerrainDropTileImpact,
  getTile,
  placeBuilding,
  stepSimulation,
} from './simulation';
import type { SimulationState, WorldWonder } from './types';

function makeFlatState(seed = 'PHASE8-TEST', gridSize = 48): SimulationState {
  const state = createInitialSimulationState(gridSize, seed);
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.units = [];
  state.buildings = [];
  state.vehicles = [];
  state.activeHazards = [];
  state.worldWonders = [];
  for (const t of state.tiles) {
    t.height = 2;
    t.terrain = 'grass';
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    t.buildingId = null;
    t.onFireTimer = 0;
    t.cursedTimer = 0;
    t.blessedTimer = 0;
    t.devastatedTimer = 0;
    delete t.liquidLevel;
    delete t.liquidKind;
    delete t.waterKind;
    delete t.isBridge;
    delete t.farmPlotKind;
    t.farmSettlementId = undefined;
  }
  return state;
}

function makeWonder(id: string, tileX: number, tileZ: number, shieldTimer = 0): WorldWonder {
  return {
    id,
    kingdomId: 's1',
    settlementId: 's1',
    species: 'human',
    name: 'Great Pyramid',
    tileX,
    tileZ,
    builtYear: 1,
    bonusSummary: '+Knowledge',
    hp: 2600,
    maxHp: 2600,
    constructionProgress: 100,
    shieldTimer,
  };
}

test('Phase 8 [L-C1, L7]: raise lifts ocean to height-1 sand, increments land by +1, and 2x brush sculpts all cardinal tiles', () => {
  const state = makeFlatState('PHASE8-RAISE', 48);
  const ocean = getTile(state, 10, 10)!;
  ocean.height = 0;
  ocean.terrain = 'deep_water';

  const r1 = applyTerrainTool(state, 'raise', 10, 10, 0);
  assert.equal(r1.ok, true);
  assert.equal(ocean.height, 1, '1x raise on ocean should produce height 1');
  assert.equal(ocean.terrain, 'sand', '1x raise on ocean should produce sand beach');

  const r2 = applyTerrainTool(state, 'raise', 10, 10, 0);
  assert.equal(r2.ok, true);
  assert.equal(ocean.height, 2, 'second 1x raise should increment by +1 to height 2');
  assert.equal(ocean.terrain, 'grass', 'height 2 sand should transition to grass');

  // 2x brush (radius = 1) must sculpt every cardinal neighbor without random rim skipping
  const r2x = applyTerrainTool(state, 'raise', 24, 24, 1);
  assert.equal(r2x.ok, true);
  for (const [dx, dz] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    assert.equal(getTile(state, 24 + dx, 24 + dz)!.height, 3, `2x raise must lift (${dx},${dz}) by +1`);
  }
});

test('Phase 8 [L-C2, M15]: stone_road/rail_track/island_bridge reject lava/poison, clear ocean nodes, and island_bridge is destructible', () => {
  const state = makeFlatState('PHASE8-BRIDGES', 48);
  const lavaTile = getTile(state, 20, 20)!;
  lavaTile.height = 0;
  lavaTile.terrain = 'shallow_water';
  lavaTile.waterKind = 'lava';

  const poisonTile = getTile(state, 21, 20)!;
  poisonTile.height = 0;
  poisonTile.terrain = 'shallow_water';
  poisonTile.waterKind = 'poison';

  assert.equal(applyTerrainTool(state, 'stone_road', 20, 20, 0).ok, false, 'stone_road must reject sea-level lava');
  assert.equal(applyTerrainTool(state, 'rail_track', 21, 20, 0).ok, false, 'rail_track must reject sea-level poison');
  assert.equal(applyTerrainTool(state, 'island_bridge', 20, 20, 0).ok, false, 'island_bridge must reject lava');
  assert.equal(applyTerrainTool(state, 'island_bridge', 21, 20, 0).ok, false, 'island_bridge must reject poison');

  // Clean water with coral_reef -> stone_road clears reef and sets isBridge
  const waterTile = getTile(state, 22, 20)!;
  waterTile.height = 0;
  waterTile.terrain = 'shallow_water';
  waterTile.resourceNode = 'coral_reef';
  waterTile.resourceAmount = 300;
  assert.equal(applyTerrainTool(state, 'stone_road', 22, 20, 0).ok, true);
  assert.equal(waterTile.terrain, 'stone_road');
  assert.equal(waterTile.isBridge, true);
  assert.equal(waterTile.resourceNode, 'none');

  // island_bridge on clean water is destroyed by meteor water impact
  const bridgeTile = getTile(state, 30, 30)!;
  bridgeTile.height = 0;
  bridgeTile.terrain = 'shallow_water';
  assert.equal(applyTerrainTool(state, 'island_bridge', 30, 30, 0).ok, true);
  assert.equal(bridgeTile.height, 1);
  assert.equal(bridgeTile.isBridge, true);

  // Adjacent ocean tile so meteor_strike triggers water impact with destroyWalkway=true
  const adjWater = getTile(state, 31, 30)!;
  adjWater.height = 0;
  adjWater.terrain = 'deep_water';
  executeGodPowerImpact(state, 'meteor_strike', 31, 30);
  assert.equal(bridgeTile.isBridge, undefined, 'meteor water impact should clear isBridge on island_bridge');
});

test('Phase 8 [L-C3]: elevated lava_drop & poison_drop on buildings/Wonders do not punch height-0 pits or bypass shields', () => {
  const state = makeFlatState('PHASE8-LIQBLD', 48);
  const mountain = getTile(state, 24, 24)!;
  mountain.height = 6;
  mountain.terrain = 'mountain';
  placeBuilding(state, 'bonfire', 24, 24);
  const shieldedBld = state.buildings[0];
  shieldedBld.shieldTimer = 20;
  const bHpStart = shieldedBld.hp;

  const wonderTile = getTile(state, 25, 24)!;
  wonderTile.height = 5;
  wonderTile.terrain = 'mountain';
  const shieldedWonder = makeWonder('w-shield', 25, 24, 20);
  state.worldWonders = [shieldedWonder];

  executeTerrainDropTileImpact(state, 'lava_drop', 24, 24);
  executeTerrainDropTileImpact(state, 'poison_drop', 25, 24);

  assert.equal(mountain.height, 6, 'lava_drop on elevated building must NOT punch a height-0 pit');
  assert.equal(shieldedBld.hp, bHpStart, 'lava_drop must NOT bypass building shieldTimer');
  assert.equal(wonderTile.height, 5, 'poison_drop on elevated World Wonder must NOT punch a height-0 pit');
  assert.equal(shieldedWonder.hp, 2600, 'poison_drop must NOT bypass World Wonder shieldTimer');
});

test('Phase 8 [H11]: executeTerrainDropBatchImpact does not skip remaining tiles after a single basin fill', () => {
  const state = makeFlatState('PHASE8-BATCH', 48);
  // Create a tiny enclosed 1-tile crater at (20,20) surrounded by height-4 rim
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      getTile(state, 20 + dx, 20 + dz)!.height = dx === 0 && dz === 0 ? 1 : 4;
    }
  }
  // Place a burning building outside the crater at (25,25)
  placeBuilding(state, 'bonfire', 25, 25);
  const burningTile = getTile(state, 25, 25)!;
  burningTile.onFireTimer = 10;

  executeTerrainDropBatchImpact(state, 'water_drop', [
    { x: 20, z: 20 },
    { x: 25, z: 25 },
  ]);

  assert.ok((getTile(state, 20, 20)!.liquidLevel ?? 0) > 1, 'crater should be filled by water_drop');
  assert.equal(burningTile.onFireTimer, 0, 'burning building in the same batch must still be extinguished');
});

test('Phase 8 [H12]: dry height-0 stone_road is not treated as water by lava_drop or liquid reactions', () => {
  const state = makeFlatState('PHASE8-DRY0', 48);
  const roadTile = getTile(state, 24, 24)!;
  roadTile.height = 0;
  roadTile.terrain = 'stone_road';
  roadTile.isBridge = true;

  // lava_drop directly on dry height-0 road should turn it into lava, NOT solidify into rock
  applyTerrainTool(state, 'lava_drop', 24, 24, 0, { deferSkyImpact: false });
  assert.equal(roadTile.waterKind, 'lava', 'lava_drop on dry height-0 road should place lava, not solidify as water');

  // Adjacent dry height-0 road tiles must not quench lava
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nb = getTile(state, 24 + dx, 24 + dz)!;
    nb.height = 0;
    nb.terrain = 'stone_road';
    nb.isBridge = true;
  }
  // Re-trigger liquid reactions via a nearby sculpt
  applyTerrainTool(state, 'raise', 28, 28, 0);
  assert.equal(roadTile.waterKind, 'lava', 'dry height-0 roads adjacent to lava must not quench lava');
});

test('Phase 8 [H13]: no-op terrain tool casts return ok=false and charge 0 Faith', () => {
  const state = makeFlatState('PHASE8-NOOP', 48);
  state.sandboxFreeMode = false;
  state.resources.faith = 500;
  stepSimulation(state, 0.01);
  const faithStart = state.resources.faith;

  const peak = getTile(state, 10, 10)!;
  peak.height = 10;
  peak.terrain = 'snow';
  assert.equal(applyTerrainTool(state, 'raise', 10, 10, 0).ok, false, 'raise on height-10 must be no-op');

  const deep = getTile(state, 12, 12)!;
  deep.height = 0;
  deep.terrain = 'deep_water';
  assert.equal(applyTerrainTool(state, 'lower', 12, 12, 0).ok, false, 'lower on deep_water must be no-op');

  assert.equal(applyTerrainTool(state, 'flatten', 24, 24, 0).ok, false, 'flatten on uniform height must be no-op');

  const shallow = getTile(state, 14, 14)!;
  shallow.height = 0;
  shallow.terrain = 'shallow_water';
  assert.equal(applyTerrainTool(state, 'carve_river', 14, 14, 0).ok, false, 'carve_river on shallow_water must be no-op');

  assert.equal(state.resources.faith, faithStart, 'no-op terrain casts must charge 0 Faith');
});

test('Phase 8 [H14, H15, M13, M16]: flatten spares buildings, smooth_terrain is symmetric, carve_river floods hills, mesa_plateau caps height', () => {
  const state = makeFlatState('PHASE8-SCULPT', 48);

  // H14: flatten must spare buildings and World Wonders
  placeBuilding(state, 'bonfire', 10, 10);
  getTile(state, 10, 10)!.height = 2;
  const wonder = makeWonder('w-flat', 11, 10);
  state.worldWonders = [wonder];
  getTile(state, 11, 10)!.height = 2;
  applyTerrainTool(state, 'flatten', 10, 10, 2, { flattenHeightOverride: 6 });
  assert.equal(getTile(state, 10, 10)!.height, 2, 'flatten must not alter height under building');
  assert.equal(getTile(state, 11, 10)!.height, 2, 'flatten must not alter height under World Wonder');

  // H15: smooth_terrain produces symmetric heights around a centered spike
  getTile(state, 24, 24)!.height = 8;
  applyTerrainTool(state, 'smooth_terrain', 24, 24, 2);
  const nw = getTile(state, 23, 23)!.height;
  const ne = getTile(state, 25, 23)!.height;
  const sw = getTile(state, 23, 25)!.height;
  const se = getTile(state, 25, 25)!.height;
  assert.equal(nw, ne, 'smooth_terrain NW and NE corners must be symmetric');
  assert.equal(nw, sw, 'smooth_terrain NW and SW corners must be symmetric');
  assert.equal(nw, se, 'smooth_terrain NW and SE corners must be symmetric');

  // M16: carve_river places shallow water even on height-4 hill
  const hill = getTile(state, 34, 34)!;
  hill.height = 4;
  hill.terrain = 'highland';
  assert.equal(applyTerrainTool(state, 'carve_river', 34, 34, 0).ok, true);
  assert.equal(hill.height, 0, 'carve_river should carve hill directly to height 0');
  assert.equal(hill.terrain, 'shallow_water', 'carve_river should place shallow_water');

  // M13: repeated mesa_plateau clicks stabilize instead of escalating to 9
  const mesaTile = getTile(state, 40, 40)!;
  mesaTile.height = 2;
  applyTerrainTool(state, 'mesa_plateau', 40, 40, 0);
  const h1 = mesaTile.height;
  applyTerrainTool(state, 'mesa_plateau', 40, 40, 0);
  applyTerrainTool(state, 'mesa_plateau', 40, 40, 0);
  assert.equal(mesaTile.height, h1, 'repeated mesa_plateau clicks must stabilize instead of escalating');
  assert.ok(mesaTile.height <= 7, 'mesa_plateau height must stay capped at <= 7');
});
