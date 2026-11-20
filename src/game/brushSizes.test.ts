import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRUSH_SIZE_PRESETS,
  getPixelCircleCells,
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

test('brush presets span 0.5x to 10x with symmetric pixelated circles and monotonic scaling', () => {
  assert.equal(BRUSH_SIZE_PRESETS[0].size, 0.5);
  assert.equal(BRUSH_SIZE_PRESETS[BRUSH_SIZE_PRESETS.length - 1].size, 10);

  let prevPixels = 0;
  let prevPowerR = 0;
  let prevTerrainR = -1;
  for (const preset of BRUSH_SIZE_PRESETS) {
    const cells = getPixelCircleCells(preset.iconDiameter);
    assert.ok(cells.length > prevPixels, `preset ${preset.id} icon pixels should strictly grow`);
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

    const pr = getPowerEffectiveRadius(4.5, preset.size);
    assert.ok(pr > prevPowerR, `power radius for ${preset.id} should strictly increase`);
    prevPowerR = pr;
  }

  assert.equal(getTerrainTileRadius(0.5), 0);
  assert.equal(getTerrainTileRadius(10), 10);
  assert.equal(isInsidePixelCircle(0, 0, 0), true);
  assert.equal(isInsidePixelCircle(1, 0, 0), false);
});

test('terrain tools can build land directly on ocean water from 0.5x single tile up to 10x circular island', () => {
  const state = createInitialSimulationState(64, 'BUILD-LAND-ON-WATER');
  state.sandboxFreeMode = true;

  // Flood the whole test map with deep water
  for (const t of state.tiles) {
    t.height = 0;
    t.terrain = 'deep_water';
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    t.buildingId = null;
  }

  // Direct land-building tools on deep_water at 0.5x (radius 0 -> strictly 1 tile)
  const directChecks: Array<{ tool: Parameters<typeof applyTerrainTool>[1]; x: number; z: number; expectedTerrain: string }> = [
    { tool: 'raise', x: 10, z: 10, expectedTerrain: 'sand' },
    { tool: 'flatten', x: 14, z: 10, expectedTerrain: 'sand' },
    { tool: 'soil_enrich', x: 18, z: 10, expectedTerrain: 'grass' },
    { tool: 'fertile_meadow', x: 22, z: 10, expectedTerrain: 'fertile' },
    { tool: 'plant_forest', x: 26, z: 10, expectedTerrain: 'forest' },
    { tool: 'jungle_bloom', x: 30, z: 10, expectedTerrain: 'jungle' },
    { tool: 'desert_dunes', x: 34, z: 10, expectedTerrain: 'sand' },
    { tool: 'volcanic_obsidian', x: 38, z: 10, expectedTerrain: 'scorched' },
    { tool: 'swamp_mire', x: 42, z: 10, expectedTerrain: 'swamp' },
  ];

  for (const chk of directChecks) {
    const res = applyTerrainTool(state, chk.tool, chk.x, chk.z, getTerrainTileRadius(0.5));
    assert.equal(res.ok, true, `${chk.tool} should build land on deep_water`);
    const center = getTile(state, chk.x, chk.z)!;
    assert.equal(center.height, 1, `${chk.tool} should raise water to height 1`);
    assert.equal(center.terrain, chk.expectedTerrain, `${chk.tool} expected ${chk.expectedTerrain}`);
    // Neighbor tile remains deep_water at 0.5x (single-tile brush)
    assert.equal(getTile(state, chk.x + 1, chk.z)!.height, 0, `${chk.tool} at 0.5x should only affect 1 tile`);
  }

  // Sky-rain tool on water raises land on impact
  const blossomRes = applyTerrainTool(state, 'blossom_rain', 46, 10, 0);
  assert.equal(blossomRes.ok, true);
  assert.equal(executeTerrainDropTileImpact(state, 'blossom_rain', 46, 10), true);
  assert.equal(getTile(state, 46, 10)!.height, 1);
  assert.equal(getTile(state, 46, 10)!.terrain, 'blossom');

  // 10x brush paints a large pixelated circular island out of deep ocean water
  const islandRes = applyTerrainTool(state, 'soil_enrich', 32, 36, getTerrainTileRadius(10));
  assert.equal(islandRes.ok, true);
  let islandTiles = 0;
  for (let dz = -12; dz <= 12; dz++) {
    for (let dx = -12; dx <= 12; dx++) {
      const t = getTile(state, 32 + dx, 36 + dz)!;
      if (t.height > 0) islandTiles++;
    }
  }
  assert.ok(islandTiles > 300, `expected 10x circular island > 300 tiles, got ${islandTiles}`);
  // Corner outside circle (dx=10, dz=10) remains water
  assert.equal(getTile(state, 42, 46)!.height, 0);
});

test('all god powers scale radius cleanly with brushSize from 0.5x to 10x', () => {
  const state = createInitialSimulationState(64, 'POWER-BRUSH-SCALE');
  state.sandboxFreeMode = true;

  // Prepare flat grass land
  for (const t of state.tiles) {
    t.height = 1;
    t.terrain = 'grass';
    t.blessedTimer = 0;
    t.cursedTimer = 0;
  }

  state.pendingVfx = [];
  assert.equal(castGodPower(state, 'blessing', 20, 20, { brushSize: 0.5, deferImpact: true }).ok, true);
  const smallR = state.pendingVfx[state.pendingVfx.length - 1].radius;

  assert.equal(castGodPower(state, 'blessing', 20, 20, { brushSize: 1, deferImpact: true }).ok, true);
  const normalR = state.pendingVfx[state.pendingVfx.length - 1].radius;

  assert.equal(castGodPower(state, 'blessing', 20, 20, { brushSize: 10, deferImpact: true }).ok, true);
  const giantR = state.pendingVfx[state.pendingVfx.length - 1].radius;

  assert.ok(smallR < normalR, `0.5x power radius (${smallR}) must be smaller than 1x (${normalR})`);
  assert.ok(giantR > normalR * 2.5, `10x power radius (${giantR}) must be much larger than 1x (${normalR})`);

  // Verify actual impact area scales too (non-deferred curse at 0.5x vs 10x)
  assert.equal(castGodPower(state, 'curse', 32, 32, { brushSize: 0.5, deferImpact: false }).ok, true);
  const farTile = getTile(state, 44, 32)!; // distance 12
  assert.equal(farTile.cursedTimer, 0, '0.5x curse must not reach 12 tiles away');

  assert.equal(castGodPower(state, 'curse', 32, 32, { brushSize: 10, deferImpact: false }).ok, true);
  const giantWave = state.activeHazards?.find((h) => h.kind === 'curse_wave' && h.maxRadius && h.maxRadius > 12);
  assert.ok(giantWave, '10x curse must spawn a giant expanding curse_wave with maxRadius > 12');
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

