import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDINGS } from './catalog';
import {
  applyTerrainTool,
  castGodPower,
  createInitialSimulationState,
  getBuildingEpochProductionMult,
  getBuildingPopCapBonus,
  getTile,
  placeBuilding,
  setKingdomEpoch,
  spawnUnit,
  stepSimulation,
} from './simulation';

function makeDryTestWorld(gridSize = 48, seed = 4242) {
  const sim = createInitialSimulationState(gridSize, seed);
  sim.sandboxFreeMode = true;
  for (const t of sim.tiles) {
    t.height = 2;
    t.terrain = 'grass';
    t.waterKind = undefined;
    t.isRiver = false;
    t.isLake = false;
    t.isBridge = false;
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    t.buildingId = null;
    t.onFireTimer = 0;
    t.devastatedTimer = 0;
  }
  sim.buildings = [];
  sim.units = [];
  sim.worldWonders = [];
  sim.battleMemorials = [];
  sim.settlementDistricts = {};
  sim.kingdomEpochs = {};
  sim.kingdomResources = {};
  sim.kingdomEpochProgress = {};
  return sim;
}

test('C1: windmill & quarry rigs exist in catalog, windmill bonus requires completed entity, wipeout cleans districts & farmPlotKind', () => {
  const promotedTypes = ['windmill', 'quarry_crane', 'ore_crusher', 'quarry_excavator'] as const;
  for (const bt of promotedTypes) {
    const def = BUILDINGS.find((d) => d.type === bt);
    assert.ok(def, `Catalog should define ${bt}`);
    assert.ok(def!.maxHp > 0, `${bt} should have positive maxHp`);
  }

  // Test crop growth speed: without a completed windmill vs with a completed windmill
  const simNoMill = makeDryTestWorld(32, 101);
  simNoMill.epochIndex = 2;
  const simWithMill = makeDryTestWorld(32, 101);
  simWithMill.epochIndex = 2;

  for (const s of [simNoMill, simWithMill]) {
    const sid = 'city_farm';
    s.kingdomEpochs![sid] = 2;
    s.settlementSpecies = { [sid]: 'human' };
    s.settlementDistricts = {
      [sid]: {
        farmX: 16,
        farmZ: 16,
        farmHalfSize: 2,
        farmTargetHeight: 2,
        quarryX: 22,
        quarryZ: 16,
        quarryHalfSize: 2,
        quarryTargetHeight: 2,
      },
    };
    const hearthRes = placeBuilding(s, 'bonfire', 12, 16);
    assert.ok(hearthRes.ok, `Bonfire placement failed: ${hearthRes.reason}`);
    const hearth = s.buildings[0];
    hearth.settlementId = sid;
    hearth.constructionProgress = 100;

    const plot = getTile(s, 17, 16)!;
    plot.terrain = 'fertile';
    plot.resourceNode = 'berry_bush';
    plot.resourceAmount = 100;
    plot.farmSettlementId = sid;
    plot.farmPlotKind = 'wheat';
    plot.cropType = 'wheat';
    plot.cropStage = 1;
    plot.cropGrowth = 30;
  }

  // Place a completed windmill only in simWithMill
  const wmRes = placeBuilding(simWithMill, 'windmill', 16, 16);
  assert.ok(wmRes.ok, `Windmill should be placeable on dry land: ${wmRes.reason}`);
  const wm = simWithMill.buildings.find((b) => b.type === 'windmill')!;
  wm.settlementId = 'city_farm';
  wm.constructionProgress = 100;

  for (let i = 0; i < 12; i++) {
    stepSimulation(simNoMill, 0.25);
    stepSimulation(simWithMill, 0.25);
  }

  const plotNoMill = getTile(simNoMill, 17, 16)!;
  const plotWithMill = getTile(simWithMill, 17, 16)!;
  const totalGrowthNoMill = (plotNoMill.cropStage ?? 1) + (plotNoMill.cropGrowth ?? 0);
  const totalGrowthWithMill = (plotWithMill.cropStage ?? 1) + (plotWithMill.cropGrowth ?? 0);
  assert.ok(
    totalGrowthWithMill > totalGrowthNoMill,
    `Completed windmill should accelerate crop growth (${totalGrowthWithMill} > ${totalGrowthNoMill})`,
  );

  // Settlement wipeout clears settlementDistricts and farmPlotKind
  for (const b of simWithMill.buildings) b.hp = 0;
  stepSimulation(simWithMill, 0.25);
  assert.equal(simWithMill.settlementDistricts?.['city_farm'], undefined);
  assert.equal(plotWithMill.farmSettlementId, undefined);
  assert.equal(plotWithMill.farmPlotKind, undefined);
});

test('C2: island_bridge tags tile.isBridge and lowering/carving clears it', () => {
  const sim = makeDryTestWorld(32, 202);
  // Carve a 3-tile water channel at x=15..17, z=16
  for (let x = 15; x <= 17; x++) {
    const t = getTile(sim, x, 16)!;
    t.height = 0;
    t.terrain = 'shallow_water';
  }
  const bridgeRes = applyTerrainTool(sim, 'island_bridge', 16, 16, 1);
  assert.ok(bridgeRes.ok);
  const mid = getTile(sim, 16, 16)!;
  assert.equal(mid.isBridge, true, 'island_bridge must tag tile.isBridge = true');
  assert.equal(mid.terrain, 'stone_road');

  // Lowering the bridge back into water clears isBridge
  applyTerrainTool(sim, 'lower', 16, 16, 1);
  assert.equal(mid.height, 0);
  assert.equal(mid.isBridge, undefined, 'Lowering a bridge to water must clear isBridge');
});

test('C3: World Wonders cost resources, occupy tile.buildingId, start unfinished, and collapse under disaster/sinking', () => {
  const sim = makeDryTestWorld(48, 303);
  sim.epochIndex = 2;
  const sid = 'city_wonder';
  sim.kingdomEpochs![sid] = 2;
  sim.settlementSpecies = { [sid]: 'human' };
  sim.kingdomResources![sid] = {
    food: 400,
    wood: 400,
    stone: 400,
    ore: 400,
    knowledge: 100,
    energy: 0,
    alloy: 0,
    faith: 100,
  };
  // Place 8 completed buildings and 14 citizens so kingdom qualifies for a World Wonder
  for (let i = 0; i < 8; i++) {
    const type = i === 0 ? 'bonfire' : i === 1 ? 'guildhall' : 'forager_hut';
    const r = placeBuilding(sim, type, 18 + (i % 4) * 2, 18 + Math.floor(i / 4) * 2);
    assert.ok(r.ok, `Place ${type} failed: ${r.reason}`);
    const b = sim.buildings[sim.buildings.length - 1];
    b.settlementId = sid;
    b.constructionProgress = 100;
    b.epochLevel = 2;
  }
  setKingdomEpoch(sim, sid, 2, true);
  for (let i = 0; i < 14; i++) {
    const uRes = spawnUnit(sim, 'builder', 18 + (i % 4), 19 + Math.floor(i / 4), true, sid);
    assert.ok(uRes.ok);
    const u = sim.units[sim.units.length - 1];
    u.settlementId = sid;
    u.kingdomId = sid;
  }
  sim.sandboxFreeMode = false;

  // Step past the 3.0s wonder check cadence
  for (let i = 0; i < 14; i++) {
    stepSimulation(sim, 0.25);
  }

  assert.equal(sim.worldWonders?.length, 1, 'Qualifying wealthy kingdom should start a World Wonder');
  const w = sim.worldWonders![0];
  assert.ok((w.constructionProgress ?? 100) < 100, 'Newly founded Wonder should start unfinished');
  assert.ok(sim.kingdomResources![sid].stone <= 270, 'Wonder foundation should deduct stone');
  const wTile = getTile(sim, w.tileX, w.tileZ)!;
  assert.equal(wTile.buildingId, w.id, 'Wonder must occupy tile.buildingId');

  // Meteor strike directly on the Wonder should damage/destroy it
  sim.sandboxFreeMode = true;
  w.hp = 200;
  castGodPower(sim, 'meteor_strike', w.tileX, w.tileZ);
  stepSimulation(sim, 0.1);
  assert.equal(
    sim.worldWonders?.some((item) => item.id === w.id),
    false,
    'Meteor strike should destroy a weakened World Wonder',
  );
  assert.equal(wTile.buildingId, null, 'Destroyed Wonder must release tile.buildingId');
});

test('C4: Undermining terrain destroys land buildings while preserving water-built scrap_sea structures on clean water', () => {
  const sim = makeDryTestWorld(32, 404);
  const res = placeBuilding(sim, 'forager_hut', 15, 15);
  assert.ok(res.ok, `Place failed: ${res.reason}`);
  const tile = getTile(sim, 15, 15)!;
  assert.ok(tile.buildingId);

  // Lower twice to submerge (height 2 -> 1 -> 0)
  applyTerrainTool(sim, 'lower', 15, 15, 1);
  applyTerrainTool(sim, 'lower', 15, 15, 1);
  assert.equal(tile.height, 0);
  assert.equal(tile.buildingId, null, 'Submerged land building must be cleared from tile');
  assert.equal(
    sim.buildings.filter((b) => b.hp > 0 && b.tileX === 15 && b.tileZ === 15).length,
    0,
    'Submerged land building must be destroyed',
  );

  // Reject placing buildings on lava
  const lavaTile = getTile(sim, 18, 18)!;
  lavaTile.height = 0;
  lavaTile.terrain = 'deep_water';
  lavaTile.waterKind = 'lava';
  const lavaPlace = placeBuilding(sim, 'forager_hut', 18, 18);
  assert.equal(lavaPlace.ok, false, 'Must reject placing buildings on lava');

  // Water-built building in scrap_sea survives clean water but dies on lava
  const seaSim = makeDryTestWorld(32, 405);
  seaSim.worldTemplate = 'scrap_sea';
  const seaTile = getTile(seaSim, 14, 14)!;
  seaTile.height = 0;
  seaTile.terrain = 'shallow_water';
  seaTile.waterKind = undefined;
  const seaPlace = placeBuilding(seaSim, 'forager_hut', 14, 14);
  assert.ok(seaPlace.ok, `scrap_sea place failed: ${seaPlace.reason}`);
  const seaBld = seaSim.buildings[0];
  assert.equal(seaBld.isWaterBuilt, true);
  stepSimulation(seaSim, 0.25);
  assert.ok(seaBld.hp > 0, 'scrap_sea water-built building must survive clean water');

  // Carving poison onto the scrap_sea tile destroys even water-built buildings
  applyTerrainTool(seaSim, 'poison_river', 14, 14, 1);
  assert.equal(seaTile.buildingId, null, 'Poison must destroy even water-built buildings');
});

test('H8: Individual building epochLevel scales production & residential popCapBonus across Epochs 0..7', () => {
  const mult0 = getBuildingEpochProductionMult(0);
  const mult4 = getBuildingEpochProductionMult(4);
  const mult7 = getBuildingEpochProductionMult(7);
  assert.equal(mult0, 1);
  assert.ok(mult4 > mult0, 'Epoch 4 production multiplier must exceed Epoch 0');
  assert.ok(mult7 > mult4, 'Epoch 7 production multiplier must exceed Epoch 4');

  const hutDef = BUILDINGS.find((d) => d.type === 'forager_hut')!;
  assert.equal(getBuildingPopCapBonus(hutDef, 0), hutDef.popCapBonus);
  assert.ok(
    getBuildingPopCapBonus(hutDef, 7) > getBuildingPopCapBonus(hutDef, 0),
    'Epoch 7 dwelling must provide higher housing capacity than Epoch 0 dwelling',
  );
});

test('H9: Battle memorials prune on submerged/devastated/occupied tiles', () => {
  const sim = makeDryTestWorld(32, 505);
  sim.battleMemorials = [
    { id: 'mem_submerged', tileX: 10, tileZ: 10, yearLabel: 'Year 12', label: 'Fall of Reef', fallenCount: 5, species: 'human' },
    { id: 'mem_devastated', tileX: 12, tileZ: 12, yearLabel: 'Year 12', label: 'Ash Field', fallenCount: 5, species: 'elf' },
    { id: 'mem_safe', tileX: 14, tileZ: 14, yearLabel: 'Year 12', label: 'High Ridge', fallenCount: 5, species: 'dwarf' },
  ];
  getTile(sim, 10, 10)!.height = 0;
  getTile(sim, 10, 10)!.terrain = 'deep_water';
  getTile(sim, 12, 12)!.devastatedTimer = 15;

  stepSimulation(sim, 0.25);

  assert.deepEqual(
    sim.battleMemorials.map((m) => m.id),
    ['mem_safe'],
    'Submerged and devastated memorials should be pruned while safe memorial survives',
  );
});

test('M2: Non-sandbox expansion bridges do not materialize with zero nearby units', () => {
  const sim = makeDryTestWorld(32, 606);
  sim.epochIndex = 2;
  const sid = 'city_isle';
  sim.kingdomEpochs![sid] = 2;
  sim.settlementSpecies = { [sid]: 'human' };
  // Create a 2-tile water strait separating island A (x <= 14) and island B (x >= 17)
  for (let z = 0; z < sim.gridSize; z++) {
    for (let x = 15; x <= 16; x++) {
      const t = getTile(sim, x, z)!;
      t.height = 0;
      t.terrain = 'shallow_water';
    }
  }
  const res = placeBuilding(sim, 'bonfire', 12, 16);
  assert.ok(res.ok, `Place bonfire failed: ${res.reason}`);
  sim.buildings[0].settlementId = sid;
  sim.buildings[0].constructionProgress = 100;
  // Disable sandbox mode after initial setup
  sim.sandboxFreeMode = false;
  // Spawn a unit far away from the shore (not near x=14, z=16)
  const uRes = spawnUnit(sim, 'builder', 2, 2, true, sid);
  assert.ok(uRes.ok);
  sim.units[0].settlementId = sid;
  sim.units[0].kingdomId = sid;

  // Step through bridge tick cadence
  for (let i = 0; i < 16; i++) {
    stepSimulation(sim, 0.25);
  }

  const bridged = getTile(sim, 15, 16)!.terrain === 'stone_road' || getTile(sim, 16, 16)!.terrain === 'stone_road';
  assert.equal(bridged, false, 'Bridge should not remotely materialize without a unit near the bridgehead');
});

test('L5: Lowering a tile with an Ancient Ruin into water clears the ruin node', () => {
  const sim = makeDryTestWorld(32, 707);
  const t = getTile(sim, 16, 16)!;
  t.height = 1;
  t.terrain = 'grass';
  t.resourceNode = 'ancient_ruin';
  t.resourceAmount = 45;

  applyTerrainTool(sim, 'lower', 16, 16, 1);
  assert.equal(t.height, 0);
  assert.equal(t.resourceNode, 'none', 'Submerged ancient_ruin must be cleared');
});
