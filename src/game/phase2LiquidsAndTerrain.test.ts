import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  applyTerrainTool,
  castGodPower,
  createInitialSimulationState,
  ensureWorldGrid,
  fillLiquidBasin,
  flushPendingBasinWaves,
  getTile,
  spawnUnit,
  stepSimulation,
} from './simulation';
import { TERRAIN_TOOLS } from './catalog';
import { getTileTopYFromCode, raycastWorldGrid, TERRAIN_HEIGHT_STEP } from './worldGrid';

function makeFlatLandWorld(seed = 42, gridSize = 64, height = 2) {
  const sim = createInitialSimulationState(gridSize, seed);
  sim.units = [];
  sim.buildings = [];
  sim.vehicles = [];
  sim.sandboxFreeMode = true;
  sim.resources.faith = 9999;
  for (const t of sim.tiles) {
    t.height = height;
    t.terrain = 'grass';
    t.buildingId = null;
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    delete t.waterKind;
    delete t.liquidLevel;
    delete t.liquidKind;
    delete t.frozenWaterBase;
    t.onFireTimer = 0;
    t.cursedTimer = 0;
    t.blessedTimer = 0;
    t.devastatedTimer = undefined;
  }
  return sim;
}

describe('Phase 2: Dynamic Liquids, Tile Timers & Terrain Sync', () => {
  it('C5: clears liquidLevel/liquidKind when tiles drop to height 0 and prevents infinite fountains', () => {
    const sim = makeFlatLandWorld(101, 64, 1);
    const tile = getTile(sim, 30, 30)!;
    tile.liquidLevel = 2.5;
    tile.liquidKind = 'water';

    // Lowering to height 0 must remove liquidLevel & liquidKind
    const res = applyTerrainTool(sim, 'lower', 30, 30, 0, { deferSkyImpact: false });
    assert.equal(res.ok, true);
    assert.equal(tile.height, 0);
    assert.equal(tile.liquidLevel, undefined);
    assert.equal(tile.liquidKind, undefined);

    // Even if an orphaned liquidLevel exists on a height===0 tile (e.g. legacy save),
    // stepSimulation cleans it up instead of pumping infinite liquid to neighbors.
    const orphan = getTile(sim, 20, 20)!;
    orphan.height = 0;
    orphan.terrain = 'shallow_water';
    orphan.liquidLevel = 3.0;
    orphan.liquidKind = 'lava';

    for (let i = 0; i < 6; i++) {
      stepSimulation(sim, 0.1, { skipRandomEvents: true });
    }
    assert.equal(orphan.liquidLevel, undefined, 'Orphaned liquidLevel on height===0 must be cleared');
    assert.equal(orphan.liquidKind, undefined, 'Orphaned liquidKind on height===0 must be cleared');
    const neighbor = getTile(sim, 21, 20)!;
    assert.equal(neighbor.liquidLevel, undefined, 'Neighbor must not receive infinite fountain outflow');
  });

  it('C6: devastatedTimer decays cleanly even when all other tile timers are 0', () => {
    const sim = makeFlatLandWorld(102, 64, 2);
    const tile = getTile(sim, 24, 24)!;
    tile.onFireTimer = 0;
    tile.blessedTimer = 0;
    tile.cursedTimer = 0;
    tile.crushedTimer = 0;
    tile.tempOffset = undefined;
    tile.coralBleachTimer = undefined;
    tile.devastatedTimer = 1.5;

    for (let i = 0; i < 30; i++) {
      stepSimulation(sim, 0.1, { skipRandomEvents: true });
    }
    assert.equal(tile.devastatedTimer, undefined, 'devastatedTimer must decay to undefined when alone');
  });

  it('H3: elevated lava/poison hurts units & vehicles, water_drop extinguishes burning buildings, elevated lava ignites buildings on stone_road', () => {
    const sim = makeFlatLandWorld(103, 64, 2);

    // 1. Unit on elevated lava takes damage; unit on elevated poison takes damage & plague
    const lavaTile = getTile(sim, 16, 16)!;
    lavaTile.liquidLevel = 3.2;
    lavaTile.liquidKind = 'lava';

    const poisonTile = getTile(sim, 24, 16)!;
    poisonTile.liquidLevel = 3.2;
    poisonTile.liquidKind = 'poison';

    const uLava = spawnUnit(sim, 'warrior', 16, 16, true).unit!;
    const uPoison = spawnUnit(sim, 'warrior', 24, 16, true).unit!;
    uLava.traits = [];
    uPoison.traits = [];
    uLava.x = 16;
    uLava.z = 16;
    uPoison.x = 24;
    uPoison.z = 16;
    const lavaStartHp = uLava.hp;
    const poisonStartHp = uPoison.hp;

    // 2. Ground vehicle vs flying plane over elevated lava
    const anchorTile = getTile(sim, 45, 45)!;
    sim.buildings.push({
      id: 'bld_anchor_h3',
      type: 'bonfire',
      tileX: 45,
      tileZ: 45,
      hp: 400,
      maxHp: 400,
      constructionProgress: 100,
      epochLevel: 4,
      blessedTimer: 0,
      cursedTimer: 0,
      shieldTimer: 0,
      settlementId: 'city_h3',
      species: 'human',
    });
    anchorTile.buildingId = 'bld_anchor_h3';
    const citizen = spawnUnit(sim, 'villager', 46, 45, true).unit!;
    citizen.settlementId = 'city_h3';
    sim.settlementKingdoms = { ...(sim.settlementKingdoms ?? {}), city_h3: 'kingdom_h3' };
    sim.kingdomEpochs = { ...(sim.kingdomEpochs ?? {}), kingdom_h3: 4 };
    sim.buildings.push({
      id: 'bld_airport_h3',
      type: 'airport',
      tileX: 44,
      tileZ: 45,
      hp: 400,
      maxHp: 400,
      constructionProgress: 100,
      epochLevel: 4,
      blessedTimer: 0,
      cursedTimer: 0,
      shieldTimer: 0,
      settlementId: 'city_h3',
      species: 'human',
    });
    getTile(sim, 44, 45)!.buildingId = 'bld_airport_h3';

    sim.vehicles = [
      {
        id: 'veh_tank_h3',
        type: 'tank',
        settlementId: 'city_h3',
        kingdomId: 'kingdom_h3',
        species: 'human',
        epochLevel: 4,
        x: 16,
        y: 1.0,
        z: 16,
        heading: 0,
        pitch: 0,
        bank: 0,
        speed: 0,
        path: [],
        pathIndex: 0,
        variantSeed: 1,
        hp: 200,
        maxHp: 200,
        isMilitary: true,
      },
      {
        id: 'veh_plane_h3',
        type: 'plane',
        settlementId: 'city_h3',
        kingdomId: 'kingdom_h3',
        species: 'human',
        epochLevel: 4,
        x: 16,
        y: 6.0,
        z: 16,
        heading: 0,
        pitch: 0,
        bank: 0,
        speed: 0,
        path: [],
        pathIndex: 0,
        variantSeed: 2,
        hp: 200,
        maxHp: 200,
        isMilitary: false,
      },
    ];

    // 3. Adjacent building on stone_road next to elevated lava gets ignited
    const roadBldTile = getTile(sim, 17, 16)!;
    roadBldTile.terrain = 'stone_road';
    roadBldTile.buildingId = 'bld_road_h3';
    sim.buildings.push({
      id: 'bld_road_h3',
      type: 'forager_hut',
      tileX: 17,
      tileZ: 16,
      hp: 300,
      maxHp: 300,
      constructionProgress: 100,
      epochLevel: 2,
      blessedTimer: 0,
      cursedTimer: 0,
      shieldTimer: 0,
      settlementId: 'city_h3',
      species: 'human',
    });

    stepSimulation(sim, 0.25, { skipRandomEvents: true });

    assert.ok(uLava.hp < lavaStartHp, 'Unit on elevated lava must take damage');
    assert.ok(uPoison.hp < poisonStartHp, 'Unit on elevated poison must take damage');
    assert.ok((uPoison.statusEffects.plagued ?? 0) > 0, 'Unit on elevated poison must be plagued');

    const vehicles = sim.vehicles ?? [];
    const tank = vehicles.find((v) => v.id === 'veh_tank_h3')!;
    const plane = vehicles.find((v) => v.id === 'veh_plane_h3')!;
    assert.ok(tank.hp! < tank.maxHp!, 'Ground vehicle on elevated lava must take damage');
    assert.equal(plane.hp, plane.maxHp, 'Flying plane over elevated lava must not take lava damage');
    assert.ok(roadBldTile.onFireTimer > 0, 'Elevated lava must ignite adjacent building on stone_road');

    // 4. water_drop extinguishes burning building without destroying it
    const extinguishRes = applyTerrainTool(sim, 'water_drop', 17, 16, 0, { deferSkyImpact: false });
    assert.equal(extinguishRes.ok, true, 'water_drop should succeed on a burning building tile');
    assert.equal(roadBldTile.onFireTimer, 0, 'water_drop must extinguish burning building');
    assert.equal(roadBldTile.buildingId, 'bld_road_h3', 'water_drop must preserve the building');
  });

  it('H4: cleanse_land, heat_wave, freeze_snap, blizzard, and alpine_glacier handle elevated liquids and never freeze lava into burning ice', () => {
    const sim = makeFlatLandWorld(104, 64, 2);

    // 1. alpine_glacier on sea-level lava solidifies to rock (never ice with waterKind='lava')
    const lavaSea = getTile(sim, 12, 12)!;
    lavaSea.height = 0;
    lavaSea.terrain = 'shallow_water';
    lavaSea.waterKind = 'lava';
    applyTerrainTool(sim, 'alpine_glacier', 12, 12, 0, { deferSkyImpact: false });
    assert.equal(lavaSea.terrain, 'rock');
    assert.equal(lavaSea.waterKind, undefined);
    assert.ok(lavaSea.height >= 1);

    // 2. alpine_glacier clears elevated liquid on land
    const elevWater = getTile(sim, 16, 12)!;
    elevWater.liquidLevel = 3.5;
    elevWater.liquidKind = 'water';
    applyTerrainTool(sim, 'alpine_glacier', 16, 12, 0, { deferSkyImpact: false });
    assert.equal(elevWater.liquidLevel, undefined);
    assert.equal(elevWater.liquidKind, undefined);

    // 3. cleanse_land (purify_wave) removes elevated lava & poison
    const elevLava = getTile(sim, 26, 26)!;
    elevLava.liquidLevel = 3.4;
    elevLava.liquidKind = 'lava';
    const elevPoison = getTile(sim, 27, 26)!;
    elevPoison.liquidLevel = 3.4;
    elevPoison.liquidKind = 'poison';
    castGodPower(sim, 'cleanse_land', 26, 26);
    for (let i = 0; i < 40; i++) {
      stepSimulation(sim, 0.1, { skipRandomEvents: true });
    }
    assert.equal(elevLava.liquidLevel, undefined, 'cleanse_land must remove elevated lava');
    assert.equal(elevPoison.liquidLevel, undefined, 'cleanse_land must remove elevated poison');

    // 4. heat_wave evaporates elevated water
    const pool = getTile(sim, 36, 26)!;
    pool.liquidLevel = 2.6;
    pool.liquidKind = 'water';
    pool.tempOffset = 28;
    castGodPower(sim, 'heat_wave', 36, 26);
    for (let i = 0; i < 40; i++) {
      stepSimulation(sim, 0.1, { skipRandomEvents: true });
    }
    assert.equal(pool.liquidLevel, undefined, 'heat_wave must evaporate elevated water');

    // 5. freeze_snap quenches sea-level lava into rock (never burning ice) and solidifies elevated lava
    const seaLava2 = getTile(sim, 46, 26)!;
    seaLava2.height = 0;
    seaLava2.terrain = 'shallow_water';
    seaLava2.waterKind = 'lava';
    const elevLava2 = getTile(sim, 47, 26)!;
    elevLava2.terrain = 'rock';
    elevLava2.liquidLevel = 3.2;
    elevLava2.liquidKind = 'lava';
    elevLava2.tempOffset = -10;
    castGodPower(sim, 'freeze_snap', 46, 26);
    for (let i = 0; i < 40; i++) {
      stepSimulation(sim, 0.1, { skipRandomEvents: true });
    }
    assert.notEqual(seaLava2.terrain, 'ice', 'freeze_snap must never turn lava into burning ice');
    assert.equal(seaLava2.terrain, 'rock');
    assert.equal(seaLava2.waterKind, undefined);
    assert.equal(elevLava2.liquidLevel, undefined, 'freeze_snap must solidify elevated lava');
  });

  it('M4: lava+water interactions consistently solidify into rock (height >= 1), including floral water', () => {
    const sim = makeFlatLandWorld(105, 64, 2);

    const cases: Array<{ x: number; setup: (t: ReturnType<typeof getTile>) => void; tool: 'lava_drop' | 'lava_river' | 'water_drop' | 'carve_river' }> = [
      {
        x: 12,
        setup: (t) => {
          t!.height = 0;
          t!.terrain = 'shallow_water';
          delete t!.waterKind;
        },
        tool: 'lava_drop',
      },
      {
        x: 16,
        setup: (t) => {
          t!.height = 0;
          t!.terrain = 'shallow_water';
          t!.waterKind = 'floral';
        },
        tool: 'lava_drop',
      },
      {
        x: 20,
        setup: (t) => {
          t!.height = 0;
          t!.terrain = 'shallow_water';
          delete t!.waterKind;
        },
        tool: 'lava_river',
      },
      {
        x: 24,
        setup: (t) => {
          t!.height = 0;
          t!.terrain = 'shallow_water';
          t!.waterKind = 'lava';
        },
        tool: 'water_drop',
      },
      {
        x: 28,
        setup: (t) => {
          t!.height = 0;
          t!.terrain = 'shallow_water';
          t!.waterKind = 'lava';
        },
        tool: 'carve_river',
      },
    ];

    for (const c of cases) {
      const tile = getTile(sim, c.x, 30)!;
      c.setup(tile);
      const res = applyTerrainTool(sim, c.tool, c.x, 30, 0, { deferSkyImpact: false });
      assert.equal(res.ok, true, `${c.tool} should succeed`);
      assert.equal(tile.terrain, 'rock', `${c.tool} lava+water must solidify into rock`);
      assert.ok(tile.height >= 1, `${c.tool} lava+water must have height >= 1`);
      assert.equal(tile.waterKind, undefined, `${c.tool} solidified rock must clear waterKind`);
    }
  });

  it('M5: floral_rain is registered in TERRAIN_TOOLS and applies cleanly', () => {
    const def = TERRAIN_TOOLS.find((t) => t.type === 'floral_rain');
    assert.ok(def, 'floral_rain must exist in TERRAIN_TOOLS');
    assert.equal(def.isSkyRain, true);

    const sim = makeFlatLandWorld(106, 64, 2);
    const res = applyTerrainTool(sim, 'floral_rain', 30, 30, 1, { deferSkyImpact: false });
    assert.equal(res.ok, true, 'applyTerrainTool(floral_rain) must succeed');
    assert.equal(getTile(sim, 30, 30)!.terrain, 'floral_plains');
  });

  it('H11: terrain tools advance worldGrid terrainVersion & heightVersion so canvas never misses zoneHeightDirty or throttles rebuilds', () => {
    const sim = makeFlatLandWorld(107, 64, 2);
    const grid = ensureWorldGrid(sim);
    const prevTerrainVer = grid.terrainVersion;
    const prevHeightVer = grid.heightVersion;

    const res = applyTerrainTool(sim, 'raise', 32, 32, 1, { deferSkyImpact: false });
    assert.equal(res.ok, true);
    assert.ok(grid.terrainVersion > prevTerrainVer, 'terrainVersion must increment on raise');
    assert.ok(grid.heightVersion > prevHeightVer, 'heightVersion must increment on raise');
    assert.ok(grid.dirtyChunkCount > 0, 'dirtyChunkCount must be marked on raise');
  });

  it('L6: raycastWorldGrid hits elevated liquidLevel surface & flushPendingBasinWaves commits queued ripple rings', () => {
    const sim = makeFlatLandWorld(108, 64, 4);
    // Build an enclosed 3x3 basin at height 1 surrounded by height 4 walls
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = getTile(sim, 30 + dx, 30 + dz)!;
        t.height = 1;
        t.terrain = 'rock';
      }
    }

    const filled = fillLiquidBasin(sim, 30, 30, 'water', 64);
    assert.ok(filled > 0, 'Basin fill should start');
    // Outer corners of 3x3 basin are queued in ring 2 — flushing before save must commit all of them!
    const flushed = flushPendingBasinWaves(sim);
    assert.ok(flushed > 0, 'flushPendingBasinWaves must commit queued outer ripple rings');
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = getTile(sim, 30 + dx, 30 + dz)!;
        assert.equal(t.liquidLevel, 2, `Basin tile (${t.x},${t.z}) should be filled to level 2 after flush`);
      }
    }

    // Raise center tile's liquidLevel to 3.5 and verify raycast hits elevated surface Y above tile floor
    const center = getTile(sim, 30, 30)!;
    center.liquidLevel = 3.5;
    const grid = ensureWorldGrid(sim);
    grid.liquidLevelMap[30 * sim.gridSize + 30] = 3.5;
    const floorTopY = getTileTopYFromCode(center.height, grid.terrainCodeMap[30 * sim.gridSize + 30]);
    const expectedLiquidTopY = Math.max(floorTopY + 0.04, 3.5 * TERRAIN_HEIGHT_STEP + 0.22);

    const dir = new THREE.Vector3(-1, -1.2, -1).normalize();
    const origin = new THREE.Vector3(30, expectedLiquidTopY, 30).addScaledVector(dir, -12);
    const hit = raycastWorldGrid(new THREE.Ray(origin, dir), grid);
    assert.ok(hit, 'Raycast should hit elevated liquid tile');
    assert.equal(hit.x, 30);
    assert.equal(hit.z, 30);
    assert.ok(hit.hitY > floorTopY + 0.5, `Expected hitY (${hit.hitY}) above floor (${floorTopY})`);
    assert.ok(Math.abs(hit.hitY - expectedLiquidTopY) < 0.08, `Expected hitY near ${expectedLiquidTopY}, got ${hit.hitY}`);
  });
});
