import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRUSH_SIZE_PRESETS,
  getPixelCircleCells,
  getPowerClusterCount,
  getPowerEffectiveRadius,
  getTerrainTileRadius,
  isInsidePixelCircle,
} from './brushSizes';
import { GOD_POWERS } from './catalog';
import {
  applyTerrainTool,
  castGodPower,
  createInitialSimulationState,
  executeTerrainDropTileImpact,
  getTile,
  stepSimulation,
} from './simulation';

test('brush presets span 1x to 10x with 1x mapped to a single tile (radius 0) and monotonic scaling', () => {
  assert.equal(BRUSH_SIZE_PRESETS[0].size, 1);
  assert.equal(BRUSH_SIZE_PRESETS[BRUSH_SIZE_PRESETS.length - 1].size, 10);

  let prevPixels = 0;
  let prevPowerR = 0;
  let prevTerrainR = -1;
  let prevCluster = 0;
  for (const preset of BRUSH_SIZE_PRESETS) {
    const cells = getPixelCircleCells(preset.iconDiameter);
    assert.ok(cells.length >= prevPixels, `preset ${preset.id} icon pixels should not shrink`);
    prevPixels = cells.length;

    // Verify 4-way symmetry of every pixel circle icon
    const cellSet = new Set(cells.map((c) => `${c.x},${c.y}`));
    const maxIdx = preset.iconDiameter - 1;
    for (const c of cells) {
      assert.ok(cellSet.has(`${maxIdx - c.x},${c.y}`), 'horizontal symmetry');
      assert.ok(cellSet.has(`${c.x},${maxIdx - c.y}`), 'vertical symmetry');
    }

    const tr = getTerrainTileRadius(preset.size);
    assert.ok(tr > prevTerrainR, `terrain radius for ${preset.id} should strictly increase`);
    prevTerrainR = tr;

    const cc = getPowerClusterCount(preset.size);
    assert.ok(cc > prevCluster, `power cluster count for ${preset.id} should strictly increase`);
    prevCluster = cc;

    const pr = getPowerEffectiveRadius(4.5, preset.size);
    assert.ok(pr > prevPowerR, `power radius for ${preset.id} should strictly increase`);
    prevPowerR = pr;
  }

  assert.equal(getTerrainTileRadius(1), 0);
  assert.equal(getTerrainTileRadius(2), 1);
  assert.equal(getTerrainTileRadius(10), 9);
  assert.equal(getPowerClusterCount(1), 1);
  assert.equal(getPowerClusterCount(10), 10);
  assert.equal(isInsidePixelCircle(0, 0, 0), true);
  assert.equal(isInsidePixelCircle(1, 0, 0), false);
  assert.equal(isInsidePixelCircle(0, 1, 0), false);
});

test('1x land powers (Road, Rail, sculpt, biome) spawn strictly 1 single tile instead of a 5-tile cross', () => {
  const state = createInitialSimulationState(64, 'SINGLE-TILE-1X-BRUSH');
  state.sandboxFreeMode = true;

  // Prepare flat grass land across the map
  for (const t of state.tiles) {
    t.height = 1;
    t.terrain = 'grass';
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    t.buildingId = null;
  }

  const r1 = getTerrainTileRadius(1);
  assert.equal(r1, 0);

  // Road at 1x must place strictly 1 road tile (no 4 orthogonal cross neighbors)
  const roadRes = applyTerrainTool(state, 'stone_road', 12, 12, r1);
  assert.equal(roadRes.ok, true);
  let roadCount = 0;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (getTile(state, 12 + dx, 12 + dz)!.terrain === 'stone_road') roadCount++;
    }
  }
  assert.equal(roadCount, 1, `1x stone_road must place strictly 1 tile, got ${roadCount}`);
  assert.equal(getTile(state, 12, 12)!.terrain, 'stone_road');
  assert.equal(getTile(state, 13, 12)!.terrain, 'grass');
  assert.equal(getTile(state, 11, 12)!.terrain, 'grass');
  assert.equal(getTile(state, 12, 13)!.terrain, 'grass');
  assert.equal(getTile(state, 12, 11)!.terrain, 'grass');

  // Rail at 1x must place strictly 1 rail tile
  const railRes = applyTerrainTool(state, 'rail_track', 20, 12, r1);
  assert.equal(railRes.ok, true);
  let railCount = 0;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (getTile(state, 20 + dx, 12 + dz)!.terrain === 'rail_track') railCount++;
    }
  }
  assert.equal(railCount, 1, `1x rail_track must place strictly 1 tile, got ${railCount}`);

  // Road at 2x (radius 1) places a 5-tile cross
  const road2xRes = applyTerrainTool(state, 'stone_road', 30, 12, getTerrainTileRadius(2));
  assert.equal(road2xRes.ok, true);
  let road2xCount = 0;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (getTile(state, 30 + dx, 12 + dz)!.terrain === 'stone_road') road2xCount++;
    }
  }
  assert.equal(road2xCount, 5, `2x stone_road should place 5-tile cross, got ${road2xCount}`);

  // Biome/sculpt tools at 1x modify strictly 1 tile
  const singleLandChecks: Array<{ tool: Parameters<typeof applyTerrainTool>[1]; x: number; z: number; expectedTerrain: string }> = [
    { tool: 'desert_dunes', x: 12, z: 24, expectedTerrain: 'sand' },
    { tool: 'fertile_meadow', x: 18, z: 24, expectedTerrain: 'fertile' },
    { tool: 'jungle_bloom', x: 30, z: 24, expectedTerrain: 'jungle' },
    { tool: 'swamp_mire', x: 36, z: 24, expectedTerrain: 'swamp' },
    { tool: 'volcanic_obsidian', x: 42, z: 24, expectedTerrain: 'scorched' },
  ];
  for (const chk of singleLandChecks) {
    const res = applyTerrainTool(state, chk.tool, chk.x, chk.z, r1, { deferSkyImpact: false });
    assert.equal(res.ok, true, `${chk.tool} at 1x should succeed`);
    assert.equal(getTile(state, chk.x, chk.z)!.terrain, chk.expectedTerrain);
    assert.equal(getTile(state, chk.x + 1, chk.z)!.terrain, 'grass', `${chk.tool} at 1x must not modify +x neighbor`);
    assert.equal(getTile(state, chk.x, chk.z + 1)!.terrain, 'grass', `${chk.tool} at 1x must not modify +z neighbor`);
  }

  // Forest planting at 1x spawns strictly 1 timber grove tile
  const forestRes = applyTerrainTool(state, 'plant_forest', 24, 24, r1, { deferSkyImpact: false });
  assert.equal(forestRes.ok, true);
  assert.equal(getTile(state, 24, 24)!.resourceNode, 'timber_grove');
  assert.equal(getTile(state, 25, 24)!.resourceNode, 'none');
  assert.equal(getTile(state, 24, 25)!.resourceNode, 'none');

  // Sky-rain tool at 1x schedules strictly 1 drop target
  state.pendingVfx = [];
  const blossomRes = applyTerrainTool(state, 'blossom_rain', 48, 24, r1);
  assert.equal(blossomRes.ok, true);
  const dropVfx = state.pendingVfx.find((v) => v.type === 'sky_rain_drop');
  assert.equal(dropVfx?.dropTargets?.length, 1, '1x sky_rain_drop should target strictly 1 tile');
  assert.equal(executeTerrainDropTileImpact(state, 'blossom_rain', 48, 24), true);
  assert.ok(getTile(state, 48, 24)!.blessedTimer >= 18);
  assert.notEqual(getTile(state, 48, 24)!.resourceNode, 'none');
  assert.equal(getTile(state, 49, 24)!.resourceNode, 'none');
});

test('land-raising tools build land directly on ocean water from 1x single tile up to 10x circular island', () => {
  const state = createInitialSimulationState(64, 'BUILD-LAND-ON-WATER');
  state.sandboxFreeMode = true;

  for (const t of state.tiles) {
    t.height = 0;
    t.terrain = 'deep_water';
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    t.buildingId = null;
  }

  const waterRaiseChecks: Array<{ tool: Parameters<typeof applyTerrainTool>[1]; x: number; z: number; expectedTerrain: string }> = [
    { tool: 'raise', x: 10, z: 10, expectedTerrain: 'sand' },
    { tool: 'flatten', x: 16, z: 10, expectedTerrain: 'sand' },
    { tool: 'volcanic_obsidian', x: 22, z: 10, expectedTerrain: 'scorched' },
  ];

  for (const chk of waterRaiseChecks) {
    const res = applyTerrainTool(state, chk.tool, chk.x, chk.z, getTerrainTileRadius(1));
    assert.equal(res.ok, true, `${chk.tool} should build land on deep_water`);
    const center = getTile(state, chk.x, chk.z)!;
    assert.equal(center.height, 1, `${chk.tool} should raise water to height 1`);
    assert.equal(center.terrain, chk.expectedTerrain, `${chk.tool} expected ${chk.expectedTerrain}`);
    assert.equal(getTile(state, chk.x + 1, chk.z)!.height, 0, `${chk.tool} at 1x should only raise 1 tile`);
  }

  // 10x brush paints a large pixelated circular island out of deep ocean water
  const islandRes = applyTerrainTool(state, 'raise', 32, 36, getTerrainTileRadius(10));
  assert.equal(islandRes.ok, true);
  let islandTiles = 0;
  for (let dz = -12; dz <= 12; dz++) {
    for (let dx = -12; dx <= 12; dx++) {
      const t = getTile(state, 32 + dx, 36 + dz)!;
      if (t.height > 0) islandTiles++;
    }
  }
  assert.ok(islandTiles > 240, `expected 10x circular island > 240 tiles, got ${islandTiles}`);
  // Corner outside circle (dx=9, dz=9) remains water
  assert.equal(getTile(state, 41, 45)!.height, 0);
});

test('all god powers spawn 1 cast at 1x and scale cleanly up to 10x clusters', () => {
  const state = createInitialSimulationState(64, 'POWER-BRUSH-SCALE');
  state.sandboxFreeMode = true;

  for (const t of state.tiles) {
    t.height = 1;
    t.terrain = 'grass';
    t.blessedTimer = 0;
    t.cursedTimer = 0;
  }

  state.pendingVfx = [];
  const res1 = castGodPower(state, 'blessing', 20, 20, { brushSize: 1, deferImpact: true });
  assert.equal(res1.ok, true);
  assert.equal(res1.count, 1, '1x god power should spawn strictly 1 cast');
  assert.equal(state.pendingVfx.length, 1);

  state.pendingVfx = [];
  const res10 = castGodPower(state, 'blessing', 32, 32, { brushSize: 10, deferImpact: true });
  assert.equal(res10.ok, true);
  assert.equal(res10.count, 10, '10x god power should spawn 10 cluster casts');
  assert.equal(state.pendingVfx.length, 10);
});

test('Alien Probe and every god power are usable on deep_water, shallow_water, and sea ice blocks', () => {
  for (const waterTerrain of ['deep_water', 'shallow_water', 'ice'] as const) {
    const state = createInitialSimulationState(64, `ALL-POWERS-${waterTerrain}`);
    state.sandboxFreeMode = true;
    for (const t of state.tiles) {
      t.height = 0;
      t.terrain = waterTerrain;
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
    }

    for (const power of GOD_POWERS) {
      state.pendingVfx = [];
      const res = castGodPower(state, power.type, 32, 32, { deferImpact: false });
      assert.equal(res.ok, true, `${power.type} must succeed on ${waterTerrain}, got: ${res.reason}`);
      assert.ok(state.pendingVfx.length > 0, `${power.type} on ${waterTerrain} must emit VFX`);
      assert.ok(
        state.pendingVfx[0].y >= 0.36,
        `${power.type} VFX y (${state.pendingVfx[0].y}) must sit cleanly above water surface`,
      );
    }
  }

  // Verify Alien Invasion over open ocean summons mothership and deploys hovering UFOs + invasion force
  const oceanState = createInitialSimulationState(64, 'ALIEN-OCEAN-INVASION');
  oceanState.sandboxFreeMode = true;
  for (const t of oceanState.tiles) {
    t.height = 0;
    t.terrain = 'deep_water';
    t.buildingId = null;
  }
  const alienRes = castGodPower(oceanState, 'alien_invasion', 32, 32);
  assert.equal(alienRes.ok, true);
  assert.ok(oceanState.activeHazards?.some((h) => h.kind === 'alien_mothership'));
  for (let i = 0; i < 25; i++) stepSimulation(oceanState, 0.1);
  const ufos = oceanState.units.filter((u) => u.role === 'alien_ufo');
  assert.ok(ufos.length >= 5, `open-ocean alien invasion should deploy >= 5 UFOs, got ${ufos.length}`);

  // Verify Earthquake on open water triggers an undersea tsunami wave without raising land
  const quakeRes = castGodPower(oceanState, 'earthquake', 20, 20);
  assert.equal(quakeRes.ok, true);
  assert.ok(
    oceanState.activeHazards?.some((h) => h.kind === 'tsunami_wave' && h.x === 20 && h.z === 20),
    'undersea earthquake must trigger a tsunami_wave',
  );
  assert.equal(getTile(oceanState, 20, 20)!.height, 0);
});
