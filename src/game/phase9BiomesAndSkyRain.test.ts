import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTerrainTool,
  createInitialSimulationState,
  ensureWorldGrid,
  executeTerrainDropBatchImpact,
  executeTerrainDropTileImpact,
  getTile,
  placeBuilding,
  spawnUnit,
  stepSimulation,
} from './simulation';
import type { SimulationState, WorldWonder } from './types';

function makeFlatState(seed = 'PHASE9-TEST', gridSize = 48): SimulationState {
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

function makeWonder(id: string, tileX: number, tileZ: number): WorldWonder {
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
    shieldTimer: 0,
  };
}

test('Phase 9 [H10]: non-liquid Sky Rain drops sync worldGrid on delayed tile and batch impact', () => {
  const state = makeFlatState('PHASE9-WG', 48);
  const wg = ensureWorldGrid(state);
  const vBeforeTile = wg.terrainVersion;

  assert.equal(executeTerrainDropTileImpact(state, 'floral_rain', 20, 20), true);
  assert.ok(wg.terrainVersion > vBeforeTile, 'executeTerrainDropTileImpact must advance worldGrid.terrainVersion for non-liquid drops');

  const vBeforeBatch = wg.terrainVersion;
  const count = executeTerrainDropBatchImpact(state, 'floral_rain', [
    { x: 24, z: 24 },
    { x: 25, z: 24 },
  ]);
  assert.equal(count, 2);
  assert.ok(wg.terrainVersion > vBeforeBatch, 'executeTerrainDropBatchImpact must advance worldGrid.terrainVersion for non-liquid drops');
});

test('Phase 9 [H16, L8]: floral_rain rejects occupied buildings & snow peaks with accurate reason and 0 Faith cost', () => {
  const state = makeFlatState('PHASE9-FLORAL', 48);
  placeBuilding(state, 'bonfire', 20, 20);
  assert.ok(getTile(state, 20, 20)!.buildingId, 'bonfire should occupy (20, 20)');
  state.sandboxFreeMode = false;
  state.resources.faith = 500;
  stepSimulation(state, 0.01);
  const faithStart = state.resources.faith;

  const resBld = applyTerrainTool(state, 'floral_rain', 20, 20, 0);
  assert.equal(resBld.ok, false, 'floral_rain must reject occupied building tile');
  assert.equal(resBld.reason, 'Cast this sky drop over existing land!', 'floral_rain error message must match sky-drop land requirement');
  assert.equal(state.resources.faith, faithStart, 'rejected floral_rain must charge 0 Faith');

  const peak = getTile(state, 28, 28)!;
  peak.height = 8;
  peak.terrain = 'snow';
  assert.equal(applyTerrainTool(state, 'floral_rain', 28, 28, 0).ok, false, 'floral_rain must not paint height-8 snow peaks');
  assert.equal(applyTerrainTool(state, 'floral_plains', 28, 28, 0).ok, false, 'floral_plains must not paint height-8 snow peaks');
});

test('Phase 9 [H17]: marine tools reject lava, poison, and bridge tiles', () => {
  const state = makeFlatState('PHASE9-MARINE', 48);
  const lava = getTile(state, 10, 10)!;
  lava.height = 0;
  lava.terrain = 'shallow_water';
  lava.waterKind = 'lava';

  const poison = getTile(state, 12, 10)!;
  poison.height = 0;
  poison.terrain = 'shallow_water';
  poison.waterKind = 'poison';

  const bridge = getTile(state, 14, 10)!;
  bridge.height = 0;
  bridge.terrain = 'stone_road';
  bridge.isBridge = true;

  for (const [x, label] of [
    [10, 'lava'],
    [12, 'poison'],
    [14, 'bridge'],
  ] as const) {
    assert.equal(applyTerrainTool(state, 'coral_reef_rain', x, 10, 0).ok, false, `coral_reef_rain must reject ${label}`);
    assert.equal(applyTerrainTool(state, 'atlantis_rise', x, 10, 0).ok, false, `atlantis_rise must reject ${label}`);
    assert.equal(applyTerrainTool(state, 'salvage_drop', x, 10, 0).ok, false, `salvage_drop must reject ${label}`);
  }
});

test('Phase 9 [H18, M17]: alpine_glacier & volcanic tools spare buildings/Wonders and biome tools clear farm & burntTree metadata', () => {
  const state = makeFlatState('PHASE9-CLEANUP', 48);
  placeBuilding(state, 'bonfire', 10, 10);
  const bTile = getTile(state, 10, 10)!;
  bTile.height = 2;
  bTile.terrain = 'grass';

  const wonder = makeWonder('w-glac', 11, 10);
  state.worldWonders = [wonder];
  const wTile = getTile(state, 11, 10)!;
  wTile.height = 2;
  wTile.terrain = 'grass';

  applyTerrainTool(state, 'alpine_glacier', 10, 10, 1);
  applyTerrainTool(state, 'volcanic_obsidian', 10, 10, 1);
  assert.equal(bTile.height, 2, 'alpine_glacier/volcanic_obsidian must not raise terrain under buildings');
  assert.equal(bTile.terrain, 'grass', 'alpine_glacier/volcanic_obsidian must not alter terrain under buildings');
  assert.equal(wTile.height, 2, 'alpine_glacier/volcanic_obsidian must not alter terrain under World Wonders');

  // M17: desert_dunes clears farm/crop & burntTree
  const farmTile = getTile(state, 24, 24)!;
  farmTile.farmSettlementId = 's1';
  farmTile.farmPlotKind = 'wheat';
  farmTile.cropType = 'wheat';
  farmTile.cropStage = 2;
  farmTile.cropGrowth = 0.8;
  farmTile.burntTree = true;

  assert.equal(applyTerrainTool(state, 'desert_dunes', 24, 24, 0).ok, true);
  assert.equal(farmTile.terrain, 'sand');
  assert.equal(farmTile.farmSettlementId, undefined, 'desert_dunes must clear farmSettlementId');
  assert.equal(farmTile.cropType, undefined, 'desert_dunes must clear cropType');
  assert.equal(farmTile.burntTree, undefined, 'desert_dunes must clear burntTree');
});

test('Phase 9 [M18, M19]: blighted_mire curses tiles/units, boulder_rain deals impact damage, and terrain_sculpt emits dropKind', () => {
  const state = makeFlatState('PHASE9-EFFECTS', 48);
  const u1 = spawnUnit(state, 'villager', 20, 20, true).unit!;
  state.pendingVfx = [];

  assert.equal(applyTerrainTool(state, 'blighted_mire', 20, 20, 0).ok, true);
  assert.ok(getTile(state, 20, 20)!.cursedTimer >= 18, 'blighted_mire must curse the tile');
  assert.ok((u1.statusEffects.cursed ?? 0) >= 12, 'blighted_mire must curse nearby unshielded units');

  const sculptVfx = state.pendingVfx.find((v) => v.type === 'terrain_sculpt');
  assert.ok(sculptVfx, 'non-sky terrain tool must emit terrain_sculpt VFX');
  assert.equal(sculptVfx.dropKind, 'blighted_mire', 'terrain_sculpt VFX must include dropKind for magic circle themes (M19)');

  // boulder_rain impact damage on delayed landing
  const u2 = spawnUnit(state, 'villager', 30, 30, true).unit!;
  const hpStart = u2.hp;
  assert.equal(executeTerrainDropTileImpact(state, 'boulder_rain', 30, 30), true);
  assert.ok(u2.hp < hpStart, 'boulder_rain landing should deal impact damage to unshielded units');
});

test('Organic biomes (grass, jungle, etc.) naturally spread onto cooled burnt (scorched) land', () => {
  const state = makeFlatState('ORGANIC-SPREAD', 24);
  ensureWorldGrid(state);

  // Set entire map to non-organic rock first so we control neighbors strictly
  for (const t of state.tiles) {
    t.height = 2;
    t.terrain = 'rock';
    t.onFireTimer = 0;
    t.cursedTimer = 0;
    t.devastatedTimer = undefined;
  }

  // Case 1: Scorched tile surrounded by jungle should be reclaimed by jungle and clear burntTree
  const jungleCenter = getTile(state, 6, 6)!;
  jungleCenter.terrain = 'scorched';
  jungleCenter.burntTree = true;
  jungleCenter.burntTreeBiome = 'jungle';
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    getTile(state, 6 + dx, 6 + dz)!.terrain = 'jungle';
  }

  // Case 2: Scorched tile surrounded by grass should be reclaimed by grass
  const grassCenter = getTile(state, 12, 6)!;
  grassCenter.terrain = 'scorched';
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    getTile(state, 12 + dx, 6 + dz)!.terrain = 'grass';
  }

  // Case 3: Scorched tile surrounded only by non-organic rock must stay scorched
  const rockCenter = getTile(state, 18, 6)!;
  rockCenter.terrain = 'scorched';

  // Case 4: Still-devastated scorched tile surrounded by jungle must NOT be reclaimed while devastatedTimer > 0
  const devastatedCenter = getTile(state, 6, 14)!;
  devastatedCenter.terrain = 'scorched';
  devastatedCenter.devastatedTimer = 999;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    getTile(state, 6 + dx, 14 + dz)!.terrain = 'jungle';
  }

  // Advance simulation ~35 seconds in 0.25s steps
  for (let i = 0; i < 140; i++) {
    stepSimulation(state, 0.25);
  }

  assert.equal(jungleCenter.terrain, 'jungle', 'Jungle must spread onto adjacent cooled scorched land');
  assert.equal(jungleCenter.burntTree, undefined, 'Reclaimed scorched tile must clear burntTree');
  assert.equal(grassCenter.terrain, 'grass', 'Grass must spread onto adjacent cooled scorched land');
  assert.equal(rockCenter.terrain, 'scorched', 'Non-organic rock must not spread onto scorched land');
  assert.equal(devastatedCenter.terrain, 'scorched', 'Devastated scorched land must wait until devastation clears');
});
