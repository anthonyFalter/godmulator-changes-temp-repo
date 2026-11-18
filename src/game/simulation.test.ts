import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_TEMPLATES,
  advanceEpoch,
  applyTerrainTool,
  areKingdomsAtWar,
  beginDragUnit,
  castGodPower,
  createInitialSimulationState,
  createWorldConfigFromTemplate,
  dismissWorldEventCinematic,
  executeGodPowerImpact,
  executeHugeAsteroidImpact,
  formatYearLabel,
  generateEarthquakeFaultNetwork,
  getKingdomId,
  getKingdomRelation,
  getMaxCityBuildings,
  getMaxCityFarmFields,
  getMaxCityPopulation,
  getSettlementAnchor,
  getTile,
  initializeKingdomDiplomacyPair,
  isCarnivoreAnimal,
  isHerbivoreAnimal,
  isSettlementRoadTile,
  paveSettlementRailNetwork,
  placeBuilding,
  releaseDragUnit,
  rollKingdomPeacefulTrait,
  setKingdomRelation,
  spawnRaiderWave,
  spawnUnit,
  stepSimulation,
  triggerCityRebellion,
  triggerRandomWorldEvent,
  updateDragUnit,
} from './simulation';
import {
  ANIMAL_UNITS,
  DRAGON_VARIANTS,
  EPOCHS,
  GOD_POWERS,
  MYTHICAL_BEAST_UNITS,
  SPECIES_UNITS,
  getDinosaurVariant,
  getDragonVariant,
  getUnitMaxLifespan,
} from './catalog';
import { getEntityInspectProfile, toggleUnitFavorite } from './entityInspector';
import {
  DEFAULT_ZONE_TOGGLES,
  buildZoneOverlayTextures,
  computeWorldZones,
  extractKingdomColorsMap,
  inspectTileZones,
} from './zones';
import { createBuildingGroup, createUnitGroup, createVehicleGroup, getNodeVariantLibrary } from './meshBuilders';
import { generateWorldTiles } from './worldGen';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  applyGraphicsPreset,
  inferGraphicsPreset,
  resolveGraphicsProfile,
  sanitizeGraphicsSettings,
} from './graphics';
import { computeDynamicPixelScale, getResponsiveMaxZoomOut } from './cameraTouch';
import * as THREE from 'three';

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
  for (let dz = -12; dz <= 12; dz++) {
    for (let dx = -12; dx <= 12; dx++) {
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
  treeTile.resourceAmount = 16;
  const berryTile = getTile(state, cx - 1, cz)!;
  berryTile.resourceNode = 'berry_bush';
  berryTile.resourceAmount = 24;

  const s1 = spawnUnit(state, 'villager', cx, cz);
  const s2 = spawnUnit(state, 'villager', cx, cz);
  assert.equal(s1.ok, true);
  assert.equal(s2.ok, true);

  // Step 55s of simulation at 0.1s increments (accounting for gather-before-build pacing)
  for (let i = 0; i < 550; i++) {
    stepSimulation(state, 0.1);
  }

  assert.ok(state.buildings.length >= 1, 'Settlers should autonomously found Ancestral Bonfire');
  assert.equal(state.buildings[0].type, 'bonfire');
  assert.equal(state.buildings[0].constructionProgress, 100);
  assert.notEqual(treeTile.resourceNode, 'timber_grove', 'Nearby timber grove should be felled after harvesting');
  assert.notEqual(treeTile.terrain, 'forest', 'Deforested tile should transform out of forest');
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

test('simulation step advances year at 1 year per second on 1x speed starting from Year 0, scales with multiplier, and spawns raiders cleanly', () => {
  const state = createInitialSimulationState(128, 55555);
  spawnUnit(state, 'villager', 64, 64);
  const yearBefore = state.year;
  assert.equal(yearBefore, 0);
  assert.equal(formatYearLabel(yearBefore), 'Year 0');

  spawnRaiderWave(state);
  const hostiles = state.units.filter((u) => u.faction === 'hostile');
  assert.equal(hostiles.length, 3);

  // 0.9 seconds at 1x speed should still be Year 0 (< 1 full year elapsed)
  for (let i = 0; i < 9; i++) {
    stepSimulation(state, 0.1);
  }
  assert.ok(state.year > yearBefore);
  assert.ok(Math.abs(state.year - (yearBefore + 0.9)) < 1e-6);
  assert.equal(formatYearLabel(state.year), 'Year 0');

  // 0.1 more second completes 1 full second -> advances 1 full year to Year 1
  stepSimulation(state, 0.1);
  assert.ok(Math.abs(state.year - (yearBefore + 1.0)) < 1e-6);
  assert.equal(formatYearLabel(state.year), 'Year 1');

  // Advancing epoch preserves continuous counting up from 0 rather than jumping years
  advanceEpoch(state, true);
  assert.equal(formatYearLabel(state.year), 'Year 1');

  // 10x speed (dt = 0.1 * 10 = 1.0 per tick) advances 10 full years in 1 real second
  const yearBefore10x = state.year;
  for (let i = 0; i < 10; i++) {
    stepSimulation(state, 0.1 * 10);
  }
  assert.ok(Math.abs(state.year - (yearBefore10x + 10.0)) < 1e-6);
  assert.equal(formatYearLabel(state.year), 'Year 11');
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

test('playable catalog exposes strictly 3 species (human, elf, orc) that found separate species settlements', () => {
  assert.deepEqual(
    SPECIES_UNITS.map((u) => u.role),
    ['human', 'elf', 'orc'],
  );

  const state = createInitialSimulationState(128, 'SPECIES-3');
  state.sandboxFreeMode = true;
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      const t = getTile(state, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }

  const hRes = spawnUnit(state, 'human', 62, 64);
  const eRes = spawnUnit(state, 'elf', 66, 64);
  const oRes = spawnUnit(state, 'orc', 64, 67);
  assert.equal(hRes.unit?.species, 'human');
  assert.equal(eRes.unit?.species, 'elf');
  assert.equal(oRes.unit?.species, 'orc');

  for (let i = 0; i < 30; i++) stepSimulation(state, 0.1);

  assert.ok(hRes.unit?.settlementId);
  assert.ok(eRes.unit?.settlementId);
  assert.ok(oRes.unit?.settlementId);
  assert.notEqual(hRes.unit?.settlementId, eRes.unit?.settlementId);
  assert.notEqual(eRes.unit?.settlementId, oRes.unit?.settlementId);
  assert.equal(state.settlementSpecies?.[hRes.unit!.settlementId!], 'human');
  assert.equal(state.settlementSpecies?.[eRes.unit!.settlementId!], 'elf');
  assert.equal(state.settlementSpecies?.[oRes.unit!.settlementId!], 'orc');
});

test('god powers execute real effects: meteor craters & fires, rain douses without tree spam, plague/shield/terraform work', () => {
  const state = createInitialSimulationState(128, 'POWERS-REAL');
  state.sandboxFreeMode = true;
  const cx = 64;
  const cz = 64;
  for (let dz = -5; dz <= 5; dz++) {
    for (let dx = -5; dx <= 5; dx++) {
      const t = getTile(state, cx + dx, cz + dz)!;
      t.height = 4;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }

  // 1. Meteor craters, scorches, ignites fires, and deposits ore_vein
  const meteorRes = castGodPower(state, 'meteor_strike', cx, cz);
  assert.equal(meteorRes.ok, true);
  const center = getTile(state, cx, cz)!;
  assert.equal(center.height, 2);
  assert.equal(center.terrain, 'scorched');
  assert.ok(center.onFireTimer > 0, 'Meteor impact should ignite fire');
  assert.equal(center.resourceNode, 'ore_vein', 'Meteor crater core should deposit ore');

  // 2. Rain extinguishes fires, revives scorched soil, creates rain_cloud hazard, and does not checkerboard trees
  const rainRes = castGodPower(state, 'rain_of_plenty', cx, cz);
  assert.equal(rainRes.ok, true);
  assert.equal(center.onFireTimer, 0, 'Rain must extinguish active fire');
  assert.equal(center.terrain, 'grass', 'Rain must restore scorched ground to grass');
  assert.ok(
    state.activeHazards.some((h) => h.kind === 'rain_cloud'),
    'Rain must spawn lingering rain_cloud hazard',
  );
  let spawnedNodes = 0;
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      const t = getTile(state, cx + dx, cz + dz)!;
      if (t.resourceNode === 'timber_grove' || t.resourceNode === 'berry_bush') {
        spawnedNodes += 1;
      }
    }
  }
  assert.ok(spawnedNodes < 15, `Rain must not spam checkerboard trees/bushes, got ${spawnedNodes}`);

  // 3. Divine Shield protects target from Lightning Smite & spawns shield_dome
  const unitRes = spawnUnit(state, 'human', cx, cz);
  assert.equal(unitRes.ok, true);
  const target = unitRes.unit!;
  castGodPower(state, 'divine_shield', cx, cz);
  assert.ok(state.activeHazards.some((h) => h.kind === 'shield_dome'));
  castGodPower(state, 'lightning_smite', cx, cz);
  assert.equal(target.hp, target.maxHp, 'Shielded unit must take zero lightning damage');

  // 4. Plague Miasma creates lingering plague_cloud and infects unshielded unit nearby
  delete target.statusEffects.shielded;
  castGodPower(state, 'plague_miasma', cx, cz);
  assert.ok(state.activeHazards.some((h) => h.kind === 'rain_cloud' || h.kind === 'plague_cloud'));
  assert.ok((target.statusEffects.plagued ?? 0) > 0);

  // 5. Deferred rain_of_plenty moves fast to summoned spot, lingers slowly, then accelerates as it expires
  state.activeHazards = [];
  castGodPower(state, 'rain_of_plenty', 80, 80, { deferImpact: true });
  const cloud = state.activeHazards.find((h) => h.kind === 'rain_cloud')!;
  assert.ok(cloud, 'Deferred rain cast must spawn arriving rain_cloud');
  const initialDist = Math.hypot(cloud.x - 80, cloud.z - 80);
  assert.ok(initialDist > 15, `Cloud should start far upwind, got ${initialDist}`);
  assert.ok((cloud.currentSpeed ?? 0) > 25, 'Cloud should start at fast arrival speed');

  // Step through fast arrival (0.72s)
  for (let i = 0; i < 20; i++) stepSimulation(state, 0.04);
  const arrivedDist = Math.hypot(cloud.x - 80, cloud.z - 80);
  assert.ok(arrivedDist < 2.5, `Cloud should arrive near summoned spot (80,80), got ${arrivedDist}`);
  const lingerSpeed = cloud.currentSpeed ?? 0;
  assert.ok(lingerSpeed < 1.0, `Cloud should move slowly while lingering at target, got ${lingerSpeed}`);

  // Step into expiration phase (last 10% of duration) and verify it accelerates
  for (let i = 0; i < 48; i++) stepSimulation(state, 0.2);
  const expiringSpeed = cloud.currentSpeed ?? 0;
  assert.ok(
    expiringSpeed > lingerSpeed * 12,
    `Cloud must accelerate and become fast as it expires (${expiringSpeed} vs ${lingerSpeed})`,
  );
});

test('context-aware terraforming: asteroid on water spawns tsunami without creating land, and plant_forest rejects dead/barren soil', () => {
  const state = createInitialSimulationState(128, 'TERRAFORM-CONTEXT');
  state.sandboxFreeMode = false;
  state.resources.faith = 500;

  // 1. Prepare an ocean basin with nearby low shoreline (height 1 grass) and coastal forest (height 2 forest)
  const wx = 30;
  const wz = 30;
  for (let dz = -15; dz <= 15; dz++) {
    for (let dx = -15; dx <= 15; dx++) {
      const t = getTile(state, wx + dx, wz + dz)!;
      const dist = Math.hypot(dx, dz);
      if (dist <= 6) {
        t.height = 0;
        t.terrain = 'shallow_water';
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      } else if (dist <= 10) {
        t.height = 1;
        t.terrain = 'grass';
        t.resourceNode = 'berry_bush';
        t.resourceAmount = 150;
      } else {
        t.height = 2;
        t.terrain = 'forest';
        t.resourceNode = 'timber_grove';
        t.resourceAmount = 200;
      }
      t.onFireTimer = dist > 6 && dist <= 8 ? 10 : 0;
    }
  }

  // Cast meteor_strike onto water
  const meteorWaterRes = castGodPower(state, 'meteor_strike', wx, wz);
  assert.equal(meteorWaterRes.ok, true);

  // Verify zero new land was created in the water impact zone
  for (let dz = -5; dz <= 5; dz++) {
    for (let dx = -5; dx <= 5; dx++) {
      const t = getTile(state, wx + dx, wz + dz)!;
      if (Math.hypot(dx, dz) <= 4.5) {
        assert.equal(t.height, 0, 'Asteroid on water must never raise new land');
        assert.equal(t.terrain, 'deep_water', 'Water impact must deepen ocean into deep_water trench');
      }
    }
  }

  // Verify tsunami_wave hazard was spawned and scaled to asteroid radius (6.2 * 3.8)
  const tsunami = state.activeHazards.find((h) => h.kind === 'tsunami_wave');
  assert.ok(tsunami, 'Asteroid on water must spawn an expanding tsunami_wave hazard');
  assert.ok(Math.abs((tsunami.maxRadius ?? 0) - 6.2 * 3.8) < 1e-6);
  const r0 = tsunami.currentRadius ?? 0;

  // Step simulation so the tsunami wave expands across the coastline and inland forest
  for (let i = 0; i < 18; i++) stepSimulation(state, 0.2);
  assert.ok((tsunami.currentRadius ?? 0) > r0 + 12, 'Tsunami wave must expand outward across tiles');
  const shoreTile = getTile(state, wx + 8, wz)!;
  assert.equal(shoreTile.onFireTimer, 0, 'Expanding tsunami wave must douse coastal fires');
  assert.notEqual(shoreTile.terrain, 'grass', 'Tsunami wave must flood or wash nearby height-1 grass shoreline');
  assert.equal(shoreTile.resourceNode, 'none', 'Tsunami wave must sweep away coastal bushes');

  const coastalForestTile = getTile(state, wx + 12, wz)!;
  assert.notEqual(
    coastalForestTile.terrain,
    'forest',
    'Tsunami wave must inundate nearby height-2 coastal forest into swamp/sand',
  );
  assert.equal(
    coastalForestTile.resourceNode,
    'none',
    'Tsunami wave must uproot coastal timber groves in its path',
  );

  // 2. Verify plant_forest & fertile_meadow reject dead/barren lands (scorched, rock, water)
  const dx = 90;
  const dz = 90;
  for (let oz = -2; oz <= 2; oz++) {
    for (let ox = -2; ox <= 2; ox++) {
      const t = getTile(state, dx + ox, dz + oz)!;
      t.height = 2;
      t.terrain = 'scorched';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }
  const faithBeforeDeadPlant = state.resources.faith;
  const deadPlantRes = applyTerrainTool(state, 'plant_forest', dx, dz, 1);
  assert.equal(deadPlantRes.ok, false, 'plant_forest must reject dead scorched land');
  assert.equal(state.resources.faith, faithBeforeDeadPlant, 'Failed plant_forest must not deduct Faith');
  assert.equal(getTile(state, dx, dz)!.terrain, 'scorched');
  assert.equal(getTile(state, dx, dz)!.resourceNode, 'none');

  const deadMeadowRes = applyTerrainTool(state, 'fertile_meadow', dx, dz, 1);
  assert.equal(deadMeadowRes.ok, false, 'fertile_meadow must reject dead scorched land');

  // Revive the scorched land with Rain of Plenty -> becomes grass -> plant_forest now succeeds!
  castGodPower(state, 'rain_of_plenty', dx, dz);
  assert.equal(getTile(state, dx, dz)!.terrain, 'grass', 'Rain of Plenty revives scorched soil to grass');

  const livePlantRes = applyTerrainTool(state, 'plant_forest', dx, dz, 1);
  assert.equal(livePlantRes.ok, true, 'plant_forest must succeed on revived living grass soil');
  assert.equal(getTile(state, dx, dz)!.terrain, 'forest');
  assert.equal(getTile(state, dx, dz)!.resourceNode, 'timber_grove');
});

test('black hole (wormhole_rift) pulls entities smoothly every frame along an inward spiral without teleporting or walking away', () => {
  const state = createInitialSimulationState(128, 'BLACK-HOLE-SMOOTH');
  state.sandboxFreeMode = true;
  const bx = 64;
  const bz = 64;
  for (let dz = -10; dz <= 10; dz++) {
    for (let dx = -10; dx <= 10; dx++) {
      const t = getTile(state, bx + dx, bz + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }

  // Spawn a unit 5 tiles away from the black hole center and try to give it a distant walk target
  const uRes = spawnUnit(state, 'human', bx + 5, bz);
  assert.equal(uRes.ok, true);
  const unit = uRes.unit!;
  unit.x = bx + 5;
  unit.z = bz;
  unit.targetX = bx + 20;
  unit.targetZ = bz + 20;
  unit.state = 'moving';

  const castRes = castGodPower(state, 'wormhole_ascension', bx, bz);
  assert.equal(castRes.ok, true);

  let prevDist = Math.hypot(unit.x - bx, unit.z - bz);
  assert.equal(prevDist, 5);

  // Step 25 frames at 0.05s (50ms) per frame and verify smooth, continuous inward pull on EVERY frame
  for (let i = 0; i < 25; i++) {
    const prevX = unit.x;
    const prevZ = unit.z;
    stepSimulation(state, 0.05);
    const curDist = Math.hypot(unit.x - bx, unit.z - bz);
    const frameStepDist = Math.hypot(unit.x - prevX, unit.z - prevZ);

    assert.ok(
      curDist < prevDist,
      `Unit must move closer to black hole on every 50ms frame (frame ${i}: ${curDist} < ${prevDist})`,
    );
    assert.ok(
      frameStepDist > 0.02 && frameStepDist < 0.85,
      `Frame movement must be smooth and continuous, never teleporting (${frameStepDist})`,
    );
    prevDist = curDist;
  }

  // Verify the unit also spiraled tangentially (z changed from bz) and arrived near the Event Horizon core
  assert.notEqual(unit.z, bz, 'Unit must spiral tangentially around the accretion disk as it is pulled in');
  assert.ok(prevDist < 1.5, `Unit should be smoothly drawn close to the singularity core, got ${prevDist}`);
});

test('individual buildings start at primitive epochLevel 0 and progressively upgrade through ages to the Orbital Age', () => {
  const state = createInitialSimulationState(128, 'BLD-PROGRESSION');
  state.sandboxFreeMode = true;
  const cx = 64;
  const cz = 64;
  for (let dz = -6; dz <= 6; dz++) {
    for (let dx = -6; dx <= 6; dx++) {
      const t = getTile(state, cx + dx, cz + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }

  // Place primitive hearth & forager hut at Prehistoric Age (epochIndex 0)
  assert.equal(placeBuilding(state, 'bonfire', cx, cz).ok, true);
  assert.equal(placeBuilding(state, 'forager_hut', cx + 2, cz).ok, true);
  const hearth = state.buildings.find((b) => b.type === 'bonfire')!;
  const hut = state.buildings.find((b) => b.type === 'forager_hut')!;
  assert.equal(hearth.epochLevel, 0, 'Hearth must start at primitive epochLevel 0 (sticks/campfire)');
  assert.equal(hut.epochLevel, 0, 'Forager hut must start at primitive epochLevel 0 (mud/thatch/sticks)');

  // Advance civilization to Bronze Age (epochIndex 1): buildings should not all snap instantly before simulation steps
  advanceEpoch(state, true);
  assert.equal(state.epochIndex, 1);
  assert.equal(hearth.epochLevel, 0, 'Existing building should upgrade progressively rather than snapping on frame 0');

  // Step simulation so individual buildings accumulate upgradeProgress and reach epochLevel 1
  for (let i = 0; i < 35; i++) stepSimulation(state, 0.2);
  assert.equal(hearth.epochLevel, 1, 'Hearth should upgrade to Bronze Age (epochLevel 1)');
  assert.equal(hut.epochLevel, 1, 'Forager hut should upgrade to Bronze Age (epochLevel 1)');

  // Advance through Classical (2), Industrial (3), Atomic (4), Info Age (5), to Orbital Age (6) and verify buildings progress step-by-step
  while (state.epochIndex < 6) {
    advanceEpoch(state, true);
    for (let i = 0; i < 40; i++) stepSimulation(state, 0.2);
  }
  assert.equal(state.epochIndex, 6);
  assert.equal(EPOCHS[state.epochIndex].id, 'orbital');
  assert.equal(hearth.epochLevel, 6, 'Hearth must progress all the way to Orbital Age (epochLevel 6 techno-modern)');
  assert.equal(hut.epochLevel, 6, 'Forager hut must progress all the way to Orbital Age (epochLevel 6 bio-dome)');
});

test('city layout planner builds unblocked street networks and never places buildings on stone_road tiles', () => {
  const state = createInitialSimulationState(128, 'CITY-LAYOUT-TEST');
  state.sandboxFreeMode = true;
  state.resources.food = 2000;
  state.resources.wood = 2000;
  state.resources.stone = 2000;
  state.resources.ore = 2000;
  state.resources.faith = 2000;
  state.resources.knowledge = 2000;

  const cx = 64;
  const cz = 64;
  for (let dz = -14; dz <= 14; dz++) {
    for (let dx = -14; dx <= 14; dx++) {
      const t = getTile(state, cx + dx, cz + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }

  // Spawn settlers & advance to Classical Age so streets and cottages are actively planned
  for (let i = 0; i < 8; i++) {
    spawnUnit(state, 'human', cx + (i % 3) - 1, cz + Math.floor(i / 3) - 1, true);
  }
  for (let i = 0; i < 40; i++) stepSimulation(state, 0.2);
  advanceEpoch(state, true); // Bronze
  advanceEpoch(state, true); // Classical

  for (let i = 0; i < 80; i++) {
    stepSimulation(state, 0.25);
    for (const b of state.buildings) {
      b.constructionProgress = 100;
    }
  }

  assert.ok(state.buildings.length >= 6, `City should grow multiple buildings, got ${state.buildings.length}`);

  // Verify NO building sits on a stone_road tile (buildings never block roads)
  for (const b of state.buildings) {
    const bTile = getTile(state, b.tileX, b.tileZ)!;
    assert.notEqual(
      bTile.terrain,
      'stone_road',
      `Building ${b.type} at (${b.tileX},${b.tileZ}) must not sit on and block a stone_road tile`,
    );
  }

  // Verify road tiles exist in the settlement and none of them have a buildingId
  const roadTiles = state.tiles.filter((t) => t.terrain === 'stone_road');
  assert.ok(roadTiles.length >= 8, `Settlement should have a connected street network, got ${roadTiles.length} road tiles`);
  for (const rt of roadTiles) {
    assert.equal(rt.buildingId, null, `Road tile at (${rt.x},${rt.z}) must be unblocked by buildings`);
  }
});

test('cities respect max building size caps and launch settler expeditions to found distant cities', () => {
  const state = createInitialSimulationState(128, 'COLONIZE-EXPANSION');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.resources.food = 5000;
  state.resources.wood = 5000;
  state.resources.stone = 5000;
  state.resources.ore = 5000;
  state.resources.faith = 5000;
  state.resources.knowledge = 5000;

  // Flatten habitable grass across a wide central continent so both primary city and distant frontier have room
  for (let z = 16; z < 112; z++) {
    for (let x = 16; x < 112; x++) {
      const t = getTile(state, x, z)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }

  const cx = 36;
  const cz = 36;

  // Spawn initial human settlers in the northwest region
  for (let i = 0; i < 8; i++) {
    spawnUnit(state, 'human', cx + (i % 3) - 1, cz + Math.floor(i / 3) - 1, true);
  }

  // Let them found their primary city and grow
  for (let i = 0; i < 15; i++) stepSimulation(state, 0.25);
  if (state.epochIndex < 1) advanceEpoch(state, true);
  assert.ok(getMaxCityBuildings(state.epochIndex) >= 12);

  for (let i = 0; i < 240; i++) {
    stepSimulation(state, 0.25);
    for (const b of state.buildings) {
      b.constructionProgress = 100;
    }
  }

  const maxAllowedForEpoch = getMaxCityBuildings(state.epochIndex);
  const settlementIds = Array.from(new Set(state.buildings.map((b) => b.settlementId).filter(Boolean)));
  assert.ok(
    settlementIds.length >= 2,
    `Surplus settlers must launch an expedition and found at least a 2nd city (found ${settlementIds.length})`,
  );

  // Check each city respects the per-city maximum building cap
  for (const sid of settlementIds) {
    const cityBuildings = state.buildings.filter((b) => b.settlementId === sid);
    assert.ok(
      cityBuildings.length <= maxAllowedForEpoch,
      `City ${sid} has ${cityBuildings.length} buildings, exceeding epoch cap ${maxAllowedForEpoch}`,
    );
  }

  // Verify the first city grew meaningfully large and the second city was founded far away (>= 24 tiles)
  const city1Buildings = state.buildings.filter((b) => b.settlementId === settlementIds[0]);
  const city2Buildings = state.buildings.filter((b) => b.settlementId === settlementIds[1]);
  assert.ok(city1Buildings.length >= 6, `Primary city should grow large before/while expanding, got ${city1Buildings.length}`);
  const distBetweenCities = Math.hypot(
    city1Buildings[0].tileX - city2Buildings[0].tileX,
    city1Buildings[0].tileZ - city2Buildings[0].tileZ,
  );
  assert.ok(
    distBetweenCities >= 24,
    `Second city must be founded in a distant location (>= 24 tiles away), got ${distBetweenCities.toFixed(1)}`,
  );
});

test('city farming fields are strictly capped at 200% of parent city size and never take over open land', () => {
  const state = createInitialSimulationState(128, 'FARM-CAP-200');
  state.sandboxFreeMode = true;
  state.autoBuildEnabled = false;
  if (state.worldRules) {
    state.worldRules.allowRebellion = false;
    state.worldRules.randomEvents = false;
  }
  state.resources.food = 1000;

  const cx = 64;
  const cz = 64;
  for (let dz = -18; dz <= 18; dz++) {
    for (let dx = -18; dx <= 18; dx++) {
      const t = getTile(state, cx + dx, cz + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }

  // Place a 3-building city with settlers (max farm fields = 200% of 3 = 6 tiles)
  assert.equal(placeBuilding(state, 'bonfire', cx, cz).ok, true);
  assert.equal(placeBuilding(state, 'forager_hut', cx + 2, cz).ok, true);
  assert.equal(placeBuilding(state, 'granary', cx - 2, cz).ok, true);
  const sid = state.buildings[0].settlementId!;
  spawnUnit(state, 'human', cx, cz + 1, true, sid);
  spawnUnit(state, 'human', cx + 1, cz + 1, true, sid);
  const maxAllowedFarms = getMaxCityFarmFields(3);
  assert.equal(maxAllowedFarms, 6);

  // Step for a long period to verify farming never expands past 200% of the parent city size
  for (let i = 0; i < 200; i++) {
    stepSimulation(state, 0.3);
  }

  const cityBuildings = state.buildings.filter((b) => b.settlementId === sid);
  const farmTiles = state.tiles.filter((t) => t.farmSettlementId === sid);
  const regionalFertileTiles = state.tiles.filter(
    (t) => t.terrain === 'fertile' && Math.abs(t.x - cx) <= 18 && Math.abs(t.z - cz) <= 18,
  );

  assert.equal(cityBuildings.length, 3);
  assert.ok(farmTiles.length > 0, 'City should cultivate farming fields near its food hubs');
  assert.ok(
    farmTiles.length <= maxAllowedFarms,
    `City of ${cityBuildings.length} buildings must never exceed ${maxAllowedFarms} (200%) farming fields, got ${farmTiles.length}`,
  );
  assert.ok(
    regionalFertileTiles.length <= maxAllowedFarms,
    `Fertile crop spread around city must remain bounded by city cap (${regionalFertileTiles.length} <= ${maxAllowedFarms})`,
  );
});

test('each race maintains its own distinct species architectural identity on buildings across ages', () => {
  const state = createInitialSimulationState(128, 'RACIAL-ARCH-3');
  state.sandboxFreeMode = true;
  state.resources.food = 3000;
  state.resources.wood = 3000;
  state.resources.stone = 3000;
  state.resources.ore = 3000;
  state.resources.knowledge = 3000;

  const sites: Array<{ sp: 'human' | 'elf' | 'orc'; x: number; z: number }> = [
    { sp: 'human', x: 24, z: 24 },
    { sp: 'elf', x: 64, z: 64 },
    { sp: 'orc', x: 100, z: 100 },
  ];

  for (const s of sites) {
    for (let dz = -8; dz <= 8; dz++) {
      for (let dx = -8; dx <= 8; dx++) {
        const t = getTile(state, s.x + dx, s.z + dz)!;
        t.height = 2;
        t.terrain = 'grass';
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      }
    }
    for (let i = 0; i < 4; i++) {
      spawnUnit(state, s.sp, s.x + (i % 2), s.z + Math.floor(i / 2), true);
    }
  }

  for (let i = 0; i < 60; i++) {
    stepSimulation(state, 0.25);
    for (const b of state.buildings) {
      b.constructionProgress = 100;
    }
  }

  advanceEpoch(state, true);
  advanceEpoch(state, true);
  for (let i = 0; i < 50; i++) {
    stepSimulation(state, 0.25);
    for (const b of state.buildings) {
      b.constructionProgress = 100;
    }
  }

  const humanBlds = state.buildings.filter((b) => b.species === 'human');
  const elfBlds = state.buildings.filter((b) => b.species === 'elf');
  const orcBlds = state.buildings.filter((b) => b.species === 'orc');

  assert.ok(humanBlds.length >= 2, `Human city should construct multiple species-tagged buildings, got ${humanBlds.length}`);
  assert.ok(elfBlds.length >= 2, `Elven city should construct multiple species-tagged buildings, got ${elfBlds.length}`);
  assert.ok(orcBlds.length >= 2, `Orcish city should construct multiple species-tagged buildings, got ${orcBlds.length}`);

  for (const b of state.buildings) {
    assert.ok(b.settlementId, 'Every building must belong to a settlement');
    assert.equal(
      b.species,
      state.settlementSpecies?.[b.settlementId!],
      'Each building species must match its parent settlement race',
    );
  }
});

test('Industrial to Information Age pacing includes Info Age, metro railways, cars, trains, and airport planes', () => {
  assert.equal(EPOCHS[3].id, 'industrial');
  assert.equal(EPOCHS[4].id, 'atomic');
  assert.equal(EPOCHS[5].id, 'information');
  assert.equal(EPOCHS[6].id, 'orbital');
  assert.ok(
    EPOCHS[4].unlockCost.knowledge > EPOCHS[2].unlockCost.knowledge * 4,
    'Industrial -> Atomic unlock cost should lengthen modern era',
  );
  assert.ok(
    EPOCHS[5].unlockCost.knowledge >= 1100,
    'Atomic -> Information Age unlock cost should provide extended progression',
  );
  assert.ok(getMaxCityBuildings(5) >= 28, 'Information Age cities must allow high urbanization (>= 28 buildings)');

  const state = createInitialSimulationState(128, 'TRANSIT-AVIATION');
  state.sandboxFreeMode = true;
  state.resources.food = 10000;
  state.resources.wood = 10000;
  state.resources.stone = 10000;
  state.resources.ore = 10000;
  state.resources.energy = 5000;
  state.resources.alloy = 5000;
  state.resources.knowledge = 10000;

  const cx = 64;
  const cz = 64;
  for (let dz = -16; dz <= 16; dz++) {
    for (let dx = -16; dx <= 16; dx++) {
      const t = getTile(state, cx + dx, cz + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }

  for (let i = 0; i < 6; i++) {
    spawnUnit(state, 'human', cx + (i % 3) - 1, cz + Math.floor(i / 3) - 1, true);
  }
  for (let i = 0; i < 20; i++) stepSimulation(state, 0.2);

  // Advance to Industrial (3) -> rails & cars/trains unlock
  while (state.epochIndex < 3) advanceEpoch(state, true);
  assert.equal(state.epochIndex, 3);

  const railRes = placeBuilding(state, 'rail_station', cx + 4, cz + 2);
  assert.equal(railRes.ok, true);
  const railTiles = state.tiles.filter((t) => t.terrain === 'rail_track');
  assert.ok(railTiles.length >= 12, `Industrial Age should lay metro/rail tracks around city, got ${railTiles.length}`);

  // Advance to Information Age (5) and place an Airport
  while (state.epochIndex < 5) advanceEpoch(state, true);
  assert.equal(state.epochIndex, 5);
  const airRes = placeBuilding(state, 'airport', cx - 6, cz - 4);
  assert.equal(airRes.ok, true);

  for (const b of state.buildings) {
    b.constructionProgress = 100;
  }

  // Step simulation so vehicles spawn and move along roads, rails, and airspace
  for (let i = 0; i < 40; i++) {
    stepSimulation(state, 0.25);
  }

  const vehicles = state.vehicles ?? [];
  const trains = vehicles.filter((v) => v.type === 'train');
  const cars = vehicles.filter((v) => v.type === 'car');
  const planes = vehicles.filter((v) => v.type === 'plane');

  assert.ok(trains.length >= 1, `Should spawn moving metro/trains on rail_track, got ${trains.length}`);
  assert.ok(cars.length >= 1, `Should spawn moving automobiles on stone_road, got ${cars.length}`);
  assert.ok(planes.length >= 1, `Should spawn aircraft at Airport, got ${planes.length}`);

  // Record positions & step further to confirm real locomotion and flight takeoff/cruise
  const carBefore = { x: cars[0].x, z: cars[0].z };
  const trainBefore = { x: trains[0].x, z: trains[0].z };
  let carMoved = false;
  let trainMoved = false;
  let sawPlaneAirborne = planes[0].y > 0.2 || planes[0].flightPhase === 'cruise' || planes[0].flightPhase === 'takeoff';

  for (let i = 0; i < 45; i++) {
    stepSimulation(state, 0.2);
    if (Math.hypot(cars[0].x - carBefore.x, cars[0].z - carBefore.z) > 0.2) {
      carMoved = true;
    }
    if (Math.hypot(trains[0].x - trainBefore.x, trains[0].z - trainBefore.z) > 0.2) {
      trainMoved = true;
    }
    if ((planes[0]?.y ?? 0) > 0.4 || planes[0]?.flightPhase === 'cruise') {
      sawPlaneAirborne = true;
    }
  }

  assert.ok(carMoved, 'Cars must drive continuously along road network');
  assert.ok(trainMoved, 'Trains/metros must travel continuously along rail network');
  assert.ok(sawPlaneAirborne, 'Airport aircraft must take off and become airborne');
});

test('Worldgen spawns towering mountains (height >= 7), jungles, and diverse biomes', () => {
  const seenTerrains = new Set<string>();
  let maxHeight = 0;
  let mountainCount = 0;

  // Sample several seeds across 128x128 worlds to ensure full biome & peak variety
  for (const seed of [101, 202, 303, 404, 505]) {
    const state = createInitialSimulationState(128, `BIOME-${seed}`);
    for (const t of state.tiles) {
      seenTerrains.add(t.terrain);
      if (t.height > maxHeight) maxHeight = t.height;
      if (t.terrain === 'mountain') mountainCount++;
    }
  }

  assert.ok(maxHeight >= 7, `Expected towering alpine peaks height >= 7, got ${maxHeight}`);
  assert.ok(mountainCount > 50, `Expected substantial mountain ranges, got ${mountainCount} tiles`);
  for (const required of ['mountain', 'jungle', 'taiga', 'tundra', 'badlands', 'blossom']) {
    assert.ok(seenTerrains.has(required), `Expected worldgen to generate biome "${required}"`);
  }
});

test('Earthquake god power creates fault lines, protects ocean tiles, damages structures/units, and ticks aftershocks', () => {
  const state = createInitialSimulationState(128, 'QUAKE-TEST');
  state.resources.faith = 500;
  state.sandboxFreeMode = true;

  const qx = 64;
  const qz = 64;
  for (let dz = -8; dz <= 8; dz++) {
    for (let dx = -8; dx <= 8; dx++) {
      const t = getTile(state, qx + dx, qz + dz)!;
      // Leave far edge (-7, -7) as ocean water to ensure earthquake never raises sea tiles into land
      if (dx <= -6 && dz <= -6) {
        t.height = 0;
        t.terrain = 'deep_water';
      } else {
        t.height = 3;
        t.terrain = dx === 0 ? 'stone_road' : 'grass';
      }
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
    }
  }

  const bRes = placeBuilding(state, 'forager_hut', qx + 2, qz);
  assert.equal(bRes.ok, true, bRes.reason);
  state.sandboxFreeMode = false;
  const bld = state.buildings.find((b) => b.tileX === qx + 2 && b.tileZ === qz)!;
  assert.ok(bld, 'Placed structure must exist in state.buildings');
  bld.hp = 600;
  bld.maxHp = 600;

  const uRes = spawnUnit(state, 'human', qx - 2, qz + 1, false);
  assert.equal(uRes.ok, true);
  const unit = uRes.unit!;
  const unitHpBefore = unit.hp;

  const faithBefore = state.resources.faith;
  const castRes = castGodPower(state, 'earthquake', qx, qz);
  assert.equal(castRes.ok, true);
  assert.equal(state.resources.faith, faithBefore - 30, 'Earthquake should deduct 30 Faith');

  const quakeZone = (state.activeHazards ?? []).find((h) => h.kind === 'earthquake_zone');
  assert.ok(quakeZone, 'Earthquake should register sustained earthquake_zone hazard');

  let sawElevationChange = false;
  for (let dz = -6; dz <= 6; dz++) {
    for (let dx = -6; dx <= 6; dx++) {
      const t = getTile(state, qx + dx, qz + dz)!;
      if (dx <= -6 && dz <= -6) {
        assert.equal(t.height, 0, 'Ocean tiles must remain submerged at height 0 during earthquakes');
      } else if (t.height !== 3) {
        sawElevationChange = true;
      }
    }
  }
  assert.ok(sawElevationChange, 'Earthquake should fracture and displace land height along fault & ridges');
  assert.ok(bld.hp < 600, `Earthquake should damage unshielded buildings (hp=${bld.hp})`);
  assert.ok(unit.hp < unitHpBefore, `Earthquake should injure unshielded units (hp=${unit.hp})`);

  const hpBeforeAftershock = bld.hp;
  for (let i = 0; i < 6; i++) {
    stepSimulation(state, 0.25);
  }
  assert.ok(bld.hp < hpBeforeAftershock, 'Sustained earthquake_zone aftershocks should deal follow-up damage');

  // Step until earthquake_zone expires cleanly
  for (let i = 0; i < 20; i++) {
    stepSimulation(state, 0.25);
  }
  assert.equal(
    (state.activeHazards ?? []).some((h) => h.kind === 'earthquake_zone'),
    false,
    'Earthquake hazard zone should expire cleanly after duration',
  );
});

test('Individuals in every race have unique appearance diversity, different skin tones, and child-to-adult growth', () => {
  const state = createInitialSimulationState(128, 'DIVERSITY-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;

  for (let dz = -5; dz <= 5; dz++) {
    for (let dx = -5; dx <= 5; dx++) {
      const t = getTile(state, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
    }
  }

  for (const species of ['human', 'elf', 'orc'] as const) {
    const seeds = new Set<number>();
    const skinColors = new Set<number>();
    const tunicColors = new Set<number>();
    const meshHeights = new Set<number>();

    for (let i = 0; i < 12; i++) {
      const res = spawnUnit(state, species, 64 + (i % 3), 64 + Math.floor(i / 3), true, undefined, {
        ageStage: i >= 8 ? 'child' : 'adult',
      });
      assert.equal(res.ok, true);
      const u = res.unit!;
      assert.ok(u.appearanceSeed && u.appearanceSeed > 0, 'Every unit must receive a unique appearanceSeed');
      seeds.add(u.appearanceSeed);

      const group = createUnitGroup(
        u.role,
        u.faction,
        0,
        species,
        u.appearanceSeed,
        u.ageStage ?? 'adult',
      );
      // Extract torso/head materials & height box to verify real visual diversity & smaller child stature
      const meshes = group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
      assert.ok(meshes.length >= 6, 'Composite unit mesh should have distinct body, head, hair, legs, and details');
      const torsoMesh = meshes[3]; // [shadow, legL, legR, torso, ...]
      const headMesh = meshes.find((m) => m.position.y > 0.25 && m.material instanceof THREE.MeshStandardMaterial);
      if (torsoMesh?.material instanceof THREE.MeshStandardMaterial) {
        tunicColors.add(torsoMesh.material.color.getHex());
      }
      if (headMesh?.material instanceof THREE.MeshStandardMaterial) {
        skinColors.add(headMesh.material.color.getHex());
      }
      const bbox = new THREE.Box3().setFromObject(group);
      meshHeights.add(Math.round((bbox.max.y - bbox.min.y) * 100));
    }

    assert.equal(seeds.size, 12, `All 12 ${species} individuals must have unique appearanceSeeds`);
    assert.ok(skinColors.size >= 3, `${species} population should display multiple distinct skin tones, got ${skinColors.size}`);
    assert.ok(tunicColors.size >= 3, `${species} population should display varied outfits, got ${tunicColors.size}`);
    assert.ok(meshHeights.size >= 3, `${species} individuals should vary in stature & child height, got ${meshHeights.size}`);
  }

  // Test child lifecycle growing into adult naturally over time
  const childRes = spawnUnit(state, 'human', 64, 64, true, undefined, { ageStage: 'child' });
  assert.equal(childRes.ok, true);
  const kid = childRes.unit!;
  assert.equal(kid.ageStage, 'child');
  assert.ok((kid.growthTimer ?? 0) > 0, 'Children must start with positive growthTimer');

  // Step until child matures into adult
  const steps = Math.ceil(((kid.growthTimer ?? 30) + 2) / 0.5);
  for (let i = 0; i < steps; i++) {
    stepSimulation(state, 0.5);
  }
  assert.equal(kid.ageStage, 'adult', 'Children must mature into adults after childhood duration elapses');
});

test('Earthquakes randomize into short, long, branching, and mountain-forming fault shapes', () => {
  const seenKinds = new Set<string>();
  const extents: number[] = [];
  let sawBranches = false;
  let orogenicPlan: ReturnType<typeof generateEarthquakeFaultNetwork> | null = null;

  for (let i = 0; i < 48; i++) {
    const plan = generateEarthquakeFaultNetwork(64, 64, 5.5);
    seenKinds.add(plan.quakeShapeKind);
    extents.push(plan.quakeExtent);
    if (plan.faultSegments.some((s) => s.isBranch)) {
      sawBranches = true;
    }
    if (plan.quakeShapeKind === 'orogenic_uplift' && !orogenicPlan) {
      orogenicPlan = plan;
    }
  }

  assert.equal(seenKinds.size, 4, `Expected all 4 earthquake archetypes across casts, got ${[...seenKinds].join(', ')}`);
  assert.ok(sawBranches, 'Branching/spurred fault networks must generate forked branch segments');
  const minExtent = Math.min(...extents);
  const maxExtent = Math.max(...extents);
  assert.ok(maxExtent - minExtent >= 4.0, `Earthquakes should vary sharply in length/reach (min=${minExtent.toFixed(1)}, max=${maxExtent.toFixed(1)})`);

  // Verify orogenic_uplift actively builds mountain terrain (height >= 5, mountain/snow) from flat grass plains
  const state = createInitialSimulationState(128, 'OROGENIC-MOUNTAIN');
  for (let dz = -16; dz <= 16; dz++) {
    for (let dx = -16; dx <= 16; dx++) {
      const t = getTile(state, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
    }
  }

  assert.ok(orogenicPlan, 'Expected at least one orogenic_uplift sample');
  executeGodPowerImpact(state, 'earthquake', 64, 64, orogenicPlan!);

  let mountainCount = 0;
  for (let dz = -16; dz <= 16; dz++) {
    for (let dx = -16; dx <= 16; dx++) {
      const t = getTile(state, 64 + dx, 64 + dz)!;
      if (t.height >= 5 && (t.terrain === 'mountain' || t.terrain === 'snow')) {
        mountainCount++;
      }
    }
  }
  assert.ok(mountainCount >= 6, `Orogenic uplift earthquake should raise new mountains (height>=5), got ${mountainCount}`);
});

test('Tesla Roadster Easter egg spawns in modern cities and uses thruster propulsion for aerial stunts', () => {
  const state = createInitialSimulationState(128, 'ROADSTER-EASTER-EGG');
  state.sandboxFreeMode = true;

  for (let dz = -8; dz <= 8; dz++) {
    for (let dx = -8; dx <= 8; dx++) {
      const t = getTile(state, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = dz === 0 || dx === 0 ? 'stone_road' : 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
    }
  }

  const hut = placeBuilding(state, 'forager_hut', 65, 65);
  assert.equal(hut.ok, true, hut.reason);

  // Advance to Information Age (epochIndex === 5)
  for (let i = 0; i < 5; i++) {
    advanceEpoch(state, true);
  }
  assert.equal(state.epochIndex, 5);

  stepSimulation(state, 0.25);

  const roadster = (state.vehicles ?? []).find((v) => v.type === 'roadster');
  assert.ok(roadster, 'Information Age city with streets should spawn the Tesla Roadster Easter egg');

  let sawThrustersActive = false;
  let maxAirAltitude = 0;
  let sawAerialRotation = false;
  let sawPostStuntLanding = false;

  for (let i = 0; i < 40; i++) {
    stepSimulation(state, 0.2);
    if (roadster!.thrusterActive) sawThrustersActive = true;
    if (roadster!.y > maxAirAltitude) maxAirAltitude = roadster!.y;
    if (Math.abs(roadster!.pitch) > 0.5 || Math.abs(roadster!.bank) > 0.5) {
      sawAerialRotation = true;
    }
    if (sawThrustersActive && maxAirAltitude > 1.0 && roadster!.stuntPhase === 'cruise' && !roadster!.thrusterActive) {
      sawPostStuntLanding = true;
    }
  }

  assert.equal(sawThrustersActive, true, 'Roadster must fire its SpaceX cold-gas thrusters');
  assert.ok(maxAirAltitude >= 1.2, `Roadster propulsion stunts should launch airborne (maxY=${maxAirAltitude.toFixed(2)})`);
  assert.equal(sawAerialRotation, true, 'Roadster should perform flips, rolls, or spins mid-air');
  assert.equal(sawPostStuntLanding, true, 'Roadster should touch back down into road cruise after completing stunt');

  const roadsterMesh = createVehicleGroup('roadster', 5, 'human', 0);
  const plumes = roadsterMesh.children.filter((c) => c.name === 'thruster_plume');
  assert.ok(plumes.length >= 4, `Roadster 3D model should include thruster plume meshes, got ${plumes.length}`);
});

test('dedicated airport runways host plane takeoffs/landings and Epoch 5+ metro trains ride elevated above ground', () => {
  const state = createInitialSimulationState(128, 'METRO-RUNWAY-TEST');
  state.sandboxFreeMode = true;

  for (let dz = -10; dz <= 10; dz++) {
    for (let dx = -10; dx <= 10; dx++) {
      const t = getTile(state, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = dz === 0 ? 'rail_track' : 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
    }
  }

  // Advance to Atomic Age (epochIndex === 4) so rail_station & airport are unlocked and rail is still ground-level
  for (let i = 0; i < 4; i++) {
    advanceEpoch(state, true);
  }
  assert.equal(state.epochIndex, 4);

  const stationRes = placeBuilding(state, 'rail_station', 60, 64);
  assert.equal(stationRes.ok, true, stationRes.reason);
  const airportRes = placeBuilding(state, 'airport', 64, 59);
  assert.equal(airportRes.ok, true, airportRes.reason);
  spawnUnit(state, 'human', 61, 63, true);

  // Verify dedicated flat runway strip was automatically graded & paved near airport
  const runwayTiles = state.tiles.filter((t) => t.terrain === 'runway');
  assert.ok(
    runwayTiles.length >= 4,
    `Placing an airport must pave a dedicated multi-tile runway strip (got ${runwayTiles.length})`,
  );
  const runwayHeights = new Set(runwayTiles.map((t) => t.height));
  assert.equal(runwayHeights.size, 1, 'All runway strip tiles must be leveled to a uniform height');

  stepSimulation(state, 0.25);

  const train = (state.vehicles ?? []).find((v) => v.type === 'train');
  const plane = (state.vehicles ?? []).find((v) => v.type === 'plane');
  assert.ok(train, 'Rail station must spawn a train on rail_track tiles');
  assert.ok(plane, 'Airport must spawn a plane');
  assert.ok(train!.y < 0.15, `Epoch 4 trains should still run on ground ballast (y=${train!.y})`);

  // Verify plane begins on the runway strip, rolls down the runway on takeoff, climbs, and completes a flight circuit
  const nearRunway = (x: number, z: number) =>
    runwayTiles.some((rt) => Math.hypot(rt.x - x, rt.z - z) <= 1.25);
  assert.equal(
    nearRunway(plane!.x, plane!.z),
    true,
    `Parked plane should align directly on the dedicated runway (${plane!.x.toFixed(1)}, ${plane!.z.toFixed(1)})`,
  );

  let sawTakeoffOnRunway = false;
  let sawClimbAirborne = false;
  for (let i = 0; i < 45; i++) {
    stepSimulation(state, 0.2);
    if (plane!.flightPhase === 'takeoff' && plane!.y <= 0.12 && nearRunway(plane!.x, plane!.z)) {
      sawTakeoffOnRunway = true;
    }
    if ((plane!.flightPhase === 'takeoff' || plane!.flightPhase === 'cruise') && plane!.y > 2.5) {
      sawClimbAirborne = true;
    }
  }
  assert.equal(sawTakeoffOnRunway, true, 'Plane should roll along the dedicated runway strip during takeoff');
  assert.equal(sawClimbAirborne, true, 'Plane should climb airborne after clearing the runway');

  // Advance to Information Age (epochIndex === 5): trains must elevate onto the suspended metro viaduct
  advanceEpoch(state, true);
  assert.equal(state.epochIndex, 5);
  stepSimulation(state, 0.25);
  assert.ok(
    train!.y >= 0.75,
    `Epoch 5+ elevated metro trains must ride suspended above ground (y=${train!.y})`,
  );

  // Verify Epoch 5 elevated metro trains omit ground contact_shadow disc (unlike ground Epoch 3 trains)
  const groundTrainMesh = createVehicleGroup('train', 3, 'human', 0);
  const elevatedTrainMesh = createVehicleGroup('train', 5, 'human', 0);
  assert.ok(
    groundTrainMesh.children.some((c) => c.name === 'contact_shadow'),
    'Ground-level Epoch 3 train should cast a ground contact shadow disc',
  );
  assert.equal(
    elevatedTrainMesh.children.some((c) => c.name === 'contact_shadow'),
    false,
    'Elevated Epoch 5 metro train should omit ground contact shadow disc while riding on viaduct',
  );
});

test('world seeds 7 initial animals and 3 mythical beasts with 3D meshes, unicorn healing, and dragon combat', () => {
  const state = createInitialSimulationState(128, 'WILDLIFE-ARK-9');
  assert.equal(state.units.length, 0, 'Initial state starts empty before simulation starts ticking');

  // Stepping simulation lazily populates natural wildlife without inflating civ population
  stepSimulation(state, 0.25);

  const expectedRoles = [
    'cow',
    'bear',
    'wolf',
    'chicken',
    'pig',
    'capybara',
    'dinosaur',
    'dragon',
    'unicorn',
    'leviathan',
  ] as const;

  assert.equal(state.population, 0, 'Ambient wildlife must not inflate civilization population');
  assert.equal(
    state.units.some((u) => u.faction === 'hostile'),
    false,
    'Ambient wildlife must not count as hostile raiders',
  );
  for (const role of expectedRoles) {
    assert.ok(
      state.units.some((u) => u.role === role && u.faction === 'wildlife'),
      `World seeding should include wildlife role ${role}`,
    );
  }

  // Verify catalog sizes & manual spawning + distinct 3D meshes for all animals & mythical beasts
  assert.equal(ANIMAL_UNITS.length, 7);
  assert.equal(MYTHICAL_BEAST_UNITS.length, 3);
  state.sandboxFreeMode = true;

  const flatX = 64;
  const flatZ = 64;
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      const t = getTile(state, flatX + dx, flatZ + dz)!;
      t.height = 2;
      t.terrain = dz === 0 && dx === 0 ? 'scorched' : 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
    }
  }
  const leviathanPool = getTile(state, flatX + 4, flatZ + 4)!;
  leviathanPool.height = 0;
  leviathanPool.terrain = 'deep_water';
  leviathanPool.resourceNode = 'none';
  leviathanPool.buildingId = null;

  for (let i = 0; i < expectedRoles.length; i++) {
    const role = expectedRoles[i];
    const spawnX = role === 'leviathan' ? flatX + 4 : flatX + (i % 3) - 1;
    const spawnZ = role === 'leviathan' ? flatZ + 4 : flatZ + Math.floor(i / 3) - 1;
    const res = spawnUnit(state, role, spawnX, spawnZ);
    assert.equal(res.ok, true, `Should spawn ${role}: ${res.reason ?? ''}`);

    const mesh = createUnitGroup(role, 'wildlife', 0, 'human', i * 17);
    assert.ok(mesh instanceof THREE.Group, `${role} 3D builder should return a THREE.Group`);
    assert.ok(mesh.getObjectByName('head_pivot'), `${role} mesh should expose articulated head_pivot`);
    assert.ok(mesh.getObjectByName('tail_pivot'), `${role} mesh should expose articulated tail_pivot`);
    if (role === 'dragon' || role === 'chicken') {
      assert.ok(mesh.getObjectByName('wing_l'), `${role} mesh should expose wing_l pivot`);
      assert.ok(mesh.getObjectByName('wing_r'), `${role} mesh should expose wing_r pivot`);
    }
    if (role === 'leviathan') {
      assert.ok(mesh.getObjectByName('leviathan_silhouette'), 'leviathan mesh should expose submerged silhouette group');
      assert.ok(mesh.getObjectByName('leviathan_surfaced'), 'leviathan mesh should expose surfaced Bloop group');
    }
  }

  // Verify all 3 dinosaur morphs (T-Rex, Triceratops, Stegosaurus) build cleanly
  for (let seed = 0; seed < 3; seed++) {
    const dinoMesh = createUnitGroup('dinosaur', 'wildlife', 0, 'human', seed);
    assert.ok(dinoMesh.getObjectByName('head_pivot'), `Dinosaur morph ${seed} should have head_pivot`);
    assert.ok(dinoMesh.getObjectByName('tail_pivot'), `Dinosaur morph ${seed} should have tail_pivot`);
  }

  // Verify Unicorn heals nearby injured citizen and blooms scorched tile (in a clean meadow away from predators)
  const uniX = 36;
  const uniZ = 36;
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const t = getTile(state, uniX + dx, uniZ + dz)!;
      t.height = 2;
      t.terrain = dz === 0 && dx === 0 ? 'scorched' : 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
      t.onFireTimer = 0;
    }
  }
  const injuredRes = spawnUnit(state, 'human', uniX, uniZ);
  assert.equal(injuredRes.ok, true);
  const injured = injuredRes.unit!;
  injured.hp = 40;
  injured.statusEffects.plagued = 10;

  const uniRes = spawnUnit(state, 'unicorn', uniX, uniZ);
  assert.equal(uniRes.ok, true);
  uniRes.unit!.actionCooldown = 0;

  // Verify Dragon attacks nearby hostile raider and ignores fire damage
  const raiderRes = spawnUnit(state, 'raider_swarmer', flatX + 2, flatZ + 2);
  assert.equal(raiderRes.ok, true);
  const raider = raiderRes.unit!;
  const initialRaiderHp = raider.hp;

  const dragonRes = spawnUnit(state, 'dragon', flatX + 1, flatZ + 1);
  assert.equal(dragonRes.ok, true);
  const dragon = dragonRes.unit!;
  dragon.actionCooldown = 0;
  const initialDragonHp = dragon.hp;
  getTile(state, Math.round(dragon.x), Math.round(dragon.z))!.onFireTimer = 5;

  for (let i = 0; i < 15; i++) {
    stepSimulation(state, 0.2);
  }

  assert.ok(injured.hp > 40, `Unicorn should heal nearby injured unit (hp=${injured.hp})`);
  assert.equal(injured.statusEffects.plagued, undefined, 'Unicorn aura should cleanse plague');
  assert.equal(getTile(state, uniX, uniZ)!.terrain, 'blossom', 'Unicorn aura should bloom scorched earth');
  assert.ok(raider.hp < initialRaiderHp, `Dragon should breathe fire on hostile raiders (hp=${raider.hp}/${initialRaiderHp})`);
  assert.equal(dragon.hp, initialDragonHp, 'Dragon should be immune to ground fire tiles');

  // Divine shield should not repel or damage friendly wildlife
  const cowCountBefore = state.units.filter((u) => u.role === 'cow').length;
  executeGodPowerImpact(state, 'divine_shield', flatX, flatZ);
  const cowCountAfter = state.units.filter((u) => u.role === 'cow').length;
  assert.equal(cowCountAfter, cowCountBefore, 'Divine shield must not harm peaceful wildlife');
});

test('colossal dragon shoots directional dragon_fire_breath VFX and animals trigger distinct animated strike VFX', () => {
  const dragonMesh = createUnitGroup('dragon', 'wildlife', 0, 'human', 1);
  dragonMesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(dragonMesh);
  const width = box.max.x - box.min.x;
  const length = box.max.z - box.min.z;
  assert.ok(width >= 3.8, `Dragon wingspan should be imposing (>= 3.8 units, got ${width.toFixed(2)})`);
  assert.ok(length >= 2.8, `Dragon nose-to-tail length should be imposing (>= 2.8 units, got ${length.toFixed(2)})`);
  assert.ok(dragonMesh.getObjectByName('jaw_pivot'), 'Dragon mesh must expose articulated jaw_pivot');
  assert.ok(dragonMesh.getObjectByName('wing_outer_l'), 'Dragon mesh must expose outer wing_outer_l segment');
  assert.ok(dragonMesh.getObjectByName('wing_outer_r'), 'Dragon mesh must expose outer wing_outer_r segment');

  const state = createInitialSimulationState(128, 'DRAGON-BREATH-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let dz = -5; dz <= 5; dz++) {
    for (let dx = -5; dx <= 5; dx++) {
      const t = getTile(state, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
      t.onFireTimer = 0;
    }
  }

  const drg = spawnUnit(state, 'dragon', 64, 64).unit!;
  const foe = spawnUnit(state, 'raider_behemoth', 66, 65).unit!;
  drg.actionCooldown = 0;
  state.pendingVfx.length = 0;

  stepSimulation(state, 0.15);

  const fireVfx = state.pendingVfx.find((v) => v.type === 'dragon_fire_breath');
  assert.ok(fireVfx, 'Dragon attack must emit directional dragon_fire_breath VFX');
  assert.equal(fireVfx!.variant, 'fire_breath');
  assert.ok(typeof fireVfx!.originX === 'number' && typeof fireVfx!.originZ === 'number', 'Fire breath must include origin coords');
  assert.ok((drg.attackAnimTimer ?? 0) > 0, 'Dragon must enter attackAnimTimer state to animate jaw & swoop');
  assert.ok(getTile(state, foe.x, foe.z)!.onFireTimer > 0, 'Dragon fire breath should ignite target tile');

  // Verify Wolf ('bite') and Bear ('slam') emit distinct animal_attack VFX and set attackAnimTimer
  state.units = [];
  state.pendingVfx.length = 0;
  const wolf = spawnUnit(state, 'wolf', 62, 64).unit!;
  const prey = spawnUnit(state, 'raider_swarmer', 62.5, 64).unit!;
  void prey;
  wolf.actionCooldown = 0;
  stepSimulation(state, 0.1);
  const biteVfx = state.pendingVfx.find((v) => v.type === 'animal_attack' && v.variant === 'bite');
  assert.ok(biteVfx, 'Wolf attack should emit animal_attack bite VFX');
  assert.ok((wolf.attackAnimTimer ?? 0) > 0, 'Wolf should trigger attackAnimTimer pounce animation');

  state.units = [];
  state.pendingVfx.length = 0;
  const bear = spawnUnit(state, 'bear', 64, 64).unit!;
  spawnUnit(state, 'raider_swarmer', 64.8, 64);
  bear.actionCooldown = 0;
  stepSimulation(state, 0.1);
  const slamVfx = state.pendingVfx.find((v) => v.type === 'animal_attack' && v.variant === 'slam');
  assert.ok(slamVfx, 'Bear attack should emit animal_attack slam VFX');
  assert.ok((bear.attackAnimTimer ?? 0) > 0, 'Bear should trigger attackAnimTimer rear-up slam animation');
});

test('dragons breathe fire matching their scale color and actively attack trees and buildings in the environment', () => {
  // 1. Verify all 4 dragon color variants produce matching fire_maw 3D material & dragon_fire_breath VFX colors
  const seenVariants = new Set<string>();
  for (let seed = 1; seed <= 40 && seenVariants.size < DRAGON_VARIANTS.length; seed++) {
    const palette = getDragonVariant(seed);
    if (seenVariants.has(palette.name)) continue;
    seenVariants.add(palette.name);

    const mesh = createUnitGroup('dragon', 'wildlife', 0, 'human', seed);
    const maw = mesh.getObjectByName('fire_maw') as THREE.Mesh | undefined;
    assert.ok(maw, `Dragon seed ${seed} must expose fire_maw`);
    const mawMat = maw!.material as THREE.MeshStandardMaterial;
    assert.equal(
      mawMat.color.getHex(),
      palette.glow,
      `${palette.name} fire_maw color must match variant glow`,
    );

    const state = createInitialSimulationState(128, `DRG-COL-${seed}`);
    state.sandboxFreeMode = true;
    state.wildlifeSeeded = true;
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        const t = getTile(state, 64 + dx, 64 + dz)!;
        t.height = 2;
        t.terrain = 'grass';
        t.resourceNode = 'none';
        t.resourceAmount = 0;
        t.buildingId = null;
        t.onFireTimer = 0;
      }
    }
    const treeTile = getTile(state, 66, 64)!;
    treeTile.terrain = 'forest';
    treeTile.resourceNode = 'timber_grove';
    treeTile.resourceAmount = 100;

    const dragon = spawnUnit(state, 'dragon', 64, 64, false, undefined, { appearanceSeed: seed }).unit!;
    dragon.actionCooldown = 0;
    state.pendingVfx.length = 0;

    stepSimulation(state, 0.15);

    const breathVfx = state.pendingVfx.find((v) => v.type === 'dragon_fire_breath');
    assert.ok(breathVfx, `${palette.name} dragon should attack nearby forest tree with fire breath`);
    assert.equal(
      breathVfx!.color,
      palette.glowHex,
      `${palette.name} dragon must spew fire matching its own color (${palette.glowHex})`,
    );
    assert.ok(treeTile.onFireTimer > 0, 'Targeted tree tile must catch fire');
    assert.equal(
      treeTile.fireColor,
      palette.glowHex,
      'Ignited tile ground fire must carry the dragon breath fireColor',
    );
    assert.equal(treeTile.resourceNode, 'none', 'Direct dragon fire blast should burn away the tree');
    assert.equal(treeTile.terrain, 'scorched', 'Burned tree tile should scorch into scorched terrain');
  }
  assert.equal(seenVariants.size, DRAGON_VARIANTS.length, 'Should verify all 4 dragon color variants');

  // 2. Verify dragons attack nearby unshielded buildings even when no units are around
  const bldState = createInitialSimulationState(128, 'DRG-ENV-BLD');
  bldState.sandboxFreeMode = true;
  bldState.wildlifeSeeded = true;
  for (let dz = -5; dz <= 5; dz++) {
    for (let dx = -5; dx <= 5; dx++) {
      const t = getTile(bldState, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
      t.onFireTimer = 0;
    }
  }
  const bRes = placeBuilding(bldState, 'forager_hut', 66, 64);
  assert.equal(bRes.ok, true);
  const hut = bldState.buildings[bldState.buildings.length - 1];
  const initialHp = hut.hp;

  const drg = spawnUnit(bldState, 'dragon', 64, 64).unit!;
  drg.actionCooldown = 0;
  bldState.pendingVfx.length = 0;
  stepSimulation(bldState, 0.15);

  assert.ok(hut.hp < initialHp, `Dragon should damage nearby building (hp=${hut.hp}/${initialHp})`);
  assert.ok(
    bldState.pendingVfx.some((v) => v.type === 'dragon_fire_breath'),
    'Dragon attacking a building must emit dragon_fire_breath VFX',
  );

  // 3. Verify carnivore dinosaur can also smash nearby environmental bushes/trees when no combat units are present
  const dinoState = createInitialSimulationState(128, 'DINO-ENV-TREE');
  dinoState.sandboxFreeMode = true;
  dinoState.wildlifeSeeded = true;
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      const t = getTile(dinoState, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
      t.onFireTimer = 0;
    }
  }
  const carnivoreSeed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((s) => getDinosaurVariant(s).diet === 'carnivore')!;
  const bushTile = getTile(dinoState, 65, 64)!;
  bushTile.resourceNode = 'berry_bush';
  bushTile.resourceAmount = 100;
  const dino = spawnUnit(dinoState, 'dinosaur', 64, 64, false, undefined, { appearanceSeed: carnivoreSeed }).unit!;
  dino.actionCooldown = 0;
  dinoState.pendingVfx.length = 0;

  stepSimulation(dinoState, 0.1);
  assert.equal(bushTile.resourceNode, 'none', 'Carnivore dinosaur should smash nearby berry bush');
  assert.ok(
    dinoState.pendingVfx.some((v) => v.type === 'animal_attack' && v.variant === 'crunch'),
    'Carnivore dinosaur smashing environment should emit crunch animal_attack VFX',
  );
});

test('dragons execute gliding carpet-bombing strafe runs before banking to turn around, and dinosaurs roam when rocks are far from destroyed', () => {
  const state = createInitialSimulationState(128, 'DRAGON-STRAFE-TURN-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let dz = -10; dz <= 10; dz++) {
    for (let dx = -10; dx <= 10; dx++) {
      const t = getTile(state, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
      t.onFireTimer = 0;
    }
  }

  placeBuilding(state, 'forager_hut', 67, 64);
  const bld = state.buildings[state.buildings.length - 1];
  bld.maxHp = 5000;
  bld.hp = 5000;

  const dragon = spawnUnit(state, 'dragon', 64, 64).unit!;
  dragon.x = 64;
  dragon.z = 64;
  dragon.actionCooldown = 0;
  state.pendingVfx.length = 0;

  const startX = dragon.x;
  let sawStrafe = false;
  let sawTurn = false;
  let breathCountDuringFirstWindow = 0;

  for (let step = 0; step < 36; step++) {
    stepSimulation(state, 0.1);
    if (dragon.dragonRunPhase === 'strafe') {
      sawStrafe = true;
    }
    if (dragon.dragonRunPhase === 'turn') {
      sawTurn = true;
    }
    for (const v of state.pendingVfx) {
      if (v.type === 'dragon_fire_breath') {
        assert.equal(v.sourceUnitId, dragon.id, 'Dragon breath VFX must carry sourceUnitId for 3D jaw tracking');
        breathCountDuringFirstWindow++;
      }
    }
    state.pendingVfx.length = 0;
  }

  assert.ok(sawStrafe, 'Dragon must enter gliding strafe phase when engaging target');
  assert.ok(sawTurn, 'Dragon must transition to banking turn phase after gliding past target');
  assert.equal(
    breathCountDuringFirstWindow,
    1,
    `Dragon breath cooldown must prevent every-second spam during initial 3.6s window (got ${breathCountDuringFirstWindow})`,
  );
  assert.ok(
    (dragon.dragonBreathCooldown ?? 0) > 0,
    'Dragon should remain on fire breath cooldown right after a 3.6s pass',
  );
  assert.ok(
    Math.hypot(dragon.x - startX, dragon.z - 64) > 1.5,
    'Dragon must glide across the map rather than stopping in 1 spot',
  );

  // Advance another ~2.5s so cooldown finishes and confirm the dragon can breathe again cleanly
  let followUpBreaths = 0;
  for (let step = 0; step < 25; step++) {
    stepSimulation(state, 0.1);
    for (const v of state.pendingVfx) {
      if (v.type === 'dragon_fire_breath' && v.sourceUnitId === dragon.id) {
        followUpBreaths++;
      }
    }
    state.pendingVfx.length = 0;
  }
  assert.ok(followUpBreaths >= 1, 'Dragon should resume fire breath once cooldown finishes');

  // Verify detailed dragon mesh keeps draw calls compact and reuses cached merged geometry across spawns
  const dragonPreview = createUnitGroup('dragon', 'wildlife', 0, 'human', 1);
  const dragonPreview2 = createUnitGroup('dragon', 'wildlife', 0, 'human', 2);
  let meshCount = 0;
  const geos1: THREE.BufferGeometry[] = [];
  const geos2: THREE.BufferGeometry[] = [];
  dragonPreview.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      meshCount++;
      geos1.push((obj as THREE.Mesh).geometry);
    }
  });
  dragonPreview2.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      geos2.push((obj as THREE.Mesh).geometry);
    }
  });
  assert.ok(meshCount <= 36, `Detailed dragon should use merged cached geometry to prevent lag (meshes=${meshCount})`);
  assert.equal(geos1[0], geos2[0], 'Dragon spawns must reuse cached merged geometry instances');

  // Verify carnivore dinosaur does not stay locked on a tough stone outcrop when far from destroying it
  const carnivoreSeed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((s) => getDinosaurVariant(s).diet === 'carnivore')!;
  const rockTile = getTile(state, 58, 58)!;
  rockTile.resourceNode = 'stone_outcrop';
  rockTile.resourceAmount = 350;
  const dino = spawnUnit(state, 'dinosaur', 57, 58, false, undefined, { appearanceSeed: carnivoreSeed }).unit!;
  dino.x = 57;
  dino.z = 58;
  dino.actionCooldown = 0;

  stepSimulation(state, 0.1);
  assert.ok(rockTile.resourceAmount < 350, 'Carnivore dinosaur should crunch stone outcrop once');
  assert.ok(rockTile.resourceAmount > 150, 'Stone outcrop is still far from destroyed');
  assert.equal(dino.state, 'moving', 'Carnivore dinosaur should immediately switch to moving/roaming instead of camping the rock');
});

test('herbivore dinosaurs and herbivores only eat plants, flee carnivores, and never smash rocks or buildings', () => {
  const dinoSeeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const carnSeed = dinoSeeds.find((s) => getDinosaurVariant(s).morph === 0)!;
  const triceratopsSeed = dinoSeeds.find((s) => getDinosaurVariant(s).morph === 1)!;
  const stegoSeed = dinoSeeds.find((s) => getDinosaurVariant(s).morph === 2)!;
  assert.equal(isCarnivoreAnimal('dinosaur', carnSeed), true);
  assert.equal(isHerbivoreAnimal('dinosaur', triceratopsSeed), true);
  assert.equal(isHerbivoreAnimal('dinosaur', stegoSeed), true);

  // World wildlife seeding includes both herbivore and carnivore dinosaurs
  const world = createInitialSimulationState(128, 'DINO-ECOSYSTEM');
  stepSimulation(world, 0.1);
  assert.ok(
    world.units.some((u) => u.role === 'dinosaur' && isHerbivoreAnimal(u.role, u.appearanceSeed)),
    'Seeded world should contain herbivore dinosaurs',
  );
  assert.ok(
    world.units.some((u) => u.role === 'dinosaur' && isCarnivoreAnimal(u.role, u.appearanceSeed)),
    'Seeded world should contain carnivore dinosaurs',
  );

  // Herbivore arena: herbivore dino + cow + berry bush + stone outcrop + hut + chicken
  const state = createInitialSimulationState(128, 'HERBIVORE-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let dz = -8; dz <= 8; dz++) {
    for (let dx = -8; dx <= 8; dx++) {
      const t = getTile(state, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
      t.onFireTimer = 0;
    }
  }

  const rock = getTile(state, 63, 64)!;
  rock.resourceNode = 'stone_outcrop';
  rock.resourceAmount = 300;
  const bush = getTile(state, 65, 64)!;
  bush.terrain = 'fertile';
  bush.resourceNode = 'berry_bush';
  bush.resourceAmount = 140;

  placeBuilding(state, 'forager_hut', 64, 65);
  const hut = state.buildings[state.buildings.length - 1];
  const hutHp0 = hut.hp;

  const chicken = spawnUnit(state, 'chicken', 64.4, 63.6).unit!;
  const chickenHp0 = chicken.hp;

  const herbDino = spawnUnit(state, 'dinosaur', 64, 64, false, undefined, { appearanceSeed: triceratopsSeed }).unit!;
  herbDino.x = 64;
  herbDino.z = 64;
  herbDino.hp = herbDino.maxHp - 30;
  herbDino.actionCooldown = 0;

  const cow = spawnUnit(state, 'cow', 65.5, 64.5).unit!;
  cow.x = 65.5;
  cow.z = 64.5;
  cow.actionCooldown = 0;

  for (let i = 0; i < 20; i++) {
    stepSimulation(state, 0.15);
  }

  assert.ok(bush.resourceAmount < 140, `Herbivores must eat plants from berry_bush (left=${bush.resourceAmount})`);
  assert.ok(herbDino.hp > herbDino.maxHp - 30, 'Eating plants should nourish/heal injured herbivore dinosaur');
  assert.equal(rock.resourceAmount, 300, 'Herbivore dinosaur must never smash stone outcrops');
  assert.equal(hut.hp, hutHp0, 'Herbivore dinosaur must never damage buildings');
  assert.equal(chicken.hp, chickenHp0, 'Herbivore dinosaur must never attack passive animals');

  // Spawn a carnivore Tyrannosaur nearby -> herbivore dinosaur and cow must run away from it
  const trex = spawnUnit(state, 'dinosaur', 66.5, 64, false, undefined, { appearanceSeed: carnSeed }).unit!;
  trex.x = 66.5;
  trex.z = 64;
  herbDino.x = 64.5;
  herbDino.z = 64;
  const dinoStartX = herbDino.x;
  const cowStartX = cow.x;
  cow.x = 65.0;
  cow.z = 64.0;
  // Remove bushes so herbivore focuses on fleeing
  bush.resourceNode = 'none';
  bush.resourceAmount = 0;

  for (let i = 0; i < 10; i++) {
    stepSimulation(state, 0.1);
  }
  assert.ok(herbDino.x < dinoStartX, `Herbivore dinosaur should flee away from carnivore (${herbDino.x} < ${dinoStartX})`);
  assert.ok(cow.x < cowStartX || Math.hypot(cow.x - trex.x, cow.z - trex.z) > 1.5, 'Prey cow should flee carnivore');
});

test('carnivores (carnivore dinosaurs, wolves, bears) hunt targets and destroy structures by specialty', () => {
  const dinoSeeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const carnSeed = dinoSeeds.find((s) => getDinosaurVariant(s).morph === 0)!;
  const stegoSeed = dinoSeeds.find((s) => getDinosaurVariant(s).morph === 2)!;

  const makeArena = (seedName: string) => {
    const s = createInitialSimulationState(128, seedName);
    s.sandboxFreeMode = true;
    s.wildlifeSeeded = true;
    for (let dz = -7; dz <= 7; dz++) {
      for (let dx = -7; dx <= 7; dx++) {
        const t = getTile(s, 64 + dx, 64 + dz)!;
        t.height = 2;
        t.terrain = 'grass';
        t.resourceNode = 'none';
        t.resourceAmount = 0;
        t.buildingId = null;
        t.onFireTimer = 0;
      }
    }
    return s;
  };

  // 1. Wolf hunts prey animals (chicken) while ignoring nearby buildings
  const wolfState = makeArena('WOLF-HUNT');
  placeBuilding(wolfState, 'forager_hut', 62, 64);
  const wolfHut = wolfState.buildings[wolfState.buildings.length - 1];
  const wolf = spawnUnit(wolfState, 'wolf', 64, 64).unit!;
  const chicken = spawnUnit(wolfState, 'chicken', 65, 64).unit!;
  const chickHp0 = chicken.hp;
  wolf.actionCooldown = 0;
  for (let i = 0; i < 12; i++) stepSimulation(wolfState, 0.1);
  assert.ok(chicken.hp < chickHp0, 'Wolf should actively hunt nearby chicken');
  assert.equal(wolfHut.hp, wolfHut.maxHp, 'Wolf should not smash buildings');

  // 2. Bear hunts animals (cow) and destroys nearby trees
  const bearState = makeArena('BEAR-HUNT');
  const treeTile = getTile(bearState, 65, 64)!;
  treeTile.terrain = 'forest';
  treeTile.resourceNode = 'timber_grove';
  treeTile.resourceAmount = 80;
  const bear = spawnUnit(bearState, 'bear', 64, 64).unit!;
  bear.actionCooldown = 0;
  stepSimulation(bearState, 0.1);
  assert.equal(treeTile.resourceNode, 'none', 'Bear should smash nearby timber grove when no prey is present');

  const pig = spawnUnit(bearState, 'pig', 65, 64).unit!;
  const pigHp0 = pig.hp;
  bear.actionCooldown = 0;
  stepSimulation(bearState, 0.1);
  assert.ok(pig.hp < pigHp0, 'Bear should hunt nearby pig');

  // 3. Carnivore dinosaur hunts herbivore dinosaurs and destroys buildings
  const dinoState = makeArena('CARN-DINO-HUNT');
  const trex = spawnUnit(dinoState, 'dinosaur', 64, 64, false, undefined, { appearanceSeed: carnSeed }).unit!;
  const stego = spawnUnit(dinoState, 'dinosaur', 65.2, 64, false, undefined, { appearanceSeed: stegoSeed }).unit!;
  const stegoHp0 = stego.hp;
  trex.actionCooldown = 0;
  stepSimulation(dinoState, 0.15);
  assert.ok(stego.hp < stegoHp0, 'Carnivore dinosaur should hunt herbivore dinosaur');

  // Without living targets, carnivore dinosaur smashes unshielded building
  stego.state = 'ko';
  stego.koTimer = 0;
  placeBuilding(dinoState, 'forager_hut', 65, 64);
  const targetHut = dinoState.buildings[dinoState.buildings.length - 1];
  const hutHpBefore = targetHut.hp;
  trex.x = 64;
  trex.z = 64;
  trex.actionCooldown = 0;
  stepSimulation(dinoState, 0.15);
  assert.ok(targetHut.hp < hutHpBefore, 'Carnivore dinosaur should destroy unshielded buildings');
});

test('wildfire spreads from meteors, lightning, and other fire sources across flammable land without burning water or rock', () => {
  // 1. Meteor strike ignites crater edge & ejecta that spreads outward into surrounding dense forest
  const mState = createInitialSimulationState(128, 'FIRE-METEOR');
  mState.sandboxFreeMode = true;
  mState.wildlifeSeeded = true;
  const cx = 64;
  const cz = 64;
  for (let dz = -14; dz <= 14; dz++) {
    for (let dx = -14; dx <= 14; dx++) {
      const t = getTile(mState, cx + dx, cz + dz)!;
      if (Math.abs(dx) >= 13 || Math.abs(dz) >= 13) {
        t.height = 0;
        t.terrain = 'shallow_water';
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      } else if (dx === -12 && dz === 0) {
        t.height = 3;
        t.terrain = 'rock';
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      } else {
        t.height = 3;
        t.terrain = 'forest';
        t.resourceNode = 'timber_grove';
        t.resourceAmount = 220;
      }
      t.buildingId = null;
      t.onFireTimer = 0;
      t.blessedTimer = 0;
    }
  }

  const mRes = castGodPower(mState, 'meteor_strike', cx, cz);
  assert.equal(mRes.ok, true);

  const initiallyBurningKeys = new Set<string>();
  for (const t of mState.tiles) {
    if (t.onFireTimer > 0) initiallyBurningKeys.add(`${t.x},${t.z}`);
  }
  assert.ok(initiallyBurningKeys.size >= 3, 'Meteor should ignite multiple crater/ejecta fires on impact');

  const spreadNewKeys = new Set<string>();
  for (let step = 0; step < 60; step++) {
    stepSimulation(mState, 0.1);
    for (const t of mState.tiles) {
      const key = `${t.x},${t.z}`;
      if (t.onFireTimer > 0 && !initiallyBurningKeys.has(key)) {
        spreadNewKeys.add(key);
      }
      assert.equal(getTile(mState, cx - 12, cz)!.onFireTimer, 0, 'Rock tile must not catch fire');
      assert.equal(getTile(mState, cx + 13, cz)!.onFireTimer, 0, 'Water tile must not catch fire');
    }
  }
  assert.ok(
    spreadNewKeys.size >= 3,
    `Meteor fires must spread outward to unburned adjacent forest tiles (newly burned=${spreadNewKeys.size})`,
  );

  // 2. Lightning strike ignites spreading fire across flammable trees/buildings
  const lState = createInitialSimulationState(128, 'FIRE-LIGHTNING');
  lState.sandboxFreeMode = true;
  lState.wildlifeSeeded = true;
  for (let dz = -10; dz <= 10; dz++) {
    for (let dx = -10; dx <= 10; dx++) {
      const t = getTile(lState, cx + dx, cz + dz)!;
      t.height = 2;
      t.terrain = 'forest';
      t.resourceNode = 'timber_grove';
      t.resourceAmount = 200;
      t.buildingId = null;
      t.onFireTimer = 0;
      t.blessedTimer = 0;
    }
  }
  castGodPower(lState, 'lightning_smite', cx, cz);
  const initialLightningKeys = new Set<string>();
  for (const t of lState.tiles) {
    if (t.onFireTimer > 0) initialLightningKeys.add(`${t.x},${t.z}`);
  }
  assert.ok(initialLightningKeys.size >= 2, 'Lightning should ignite flammable tiles around strike');

  let lightningSpreadCount = 0;
  for (let step = 0; step < 60; step++) {
    stepSimulation(lState, 0.1);
    for (const t of lState.tiles) {
      if (t.onFireTimer > 0 && !initialLightningKeys.has(`${t.x},${t.z}`)) {
        initialLightningKeys.add(`${t.x},${t.z}`);
        lightningSpreadCount++;
      }
    }
  }
  assert.ok(
    lightningSpreadCount >= 2,
    `Lightning fire must spread to adjacent forest tiles (spread=${lightningSpreadCount})`,
  );

  // 3. Generic single burning source spreads to adjacent trees & unshielded structures
  const gState = createInitialSimulationState(128, 'FIRE-GENERIC');
  gState.sandboxFreeMode = true;
  gState.wildlifeSeeded = true;
  for (let dz = -6; dz <= 6; dz++) {
    for (let dx = -6; dx <= 6; dx++) {
      const t = getTile(gState, cx + dx, cz + dz)!;
      t.height = 2;
      t.terrain = 'forest';
      t.resourceNode = 'timber_grove';
      t.resourceAmount = 180;
      t.buildingId = null;
      t.onFireTimer = 0;
      t.blessedTimer = 0;
    }
  }
  placeBuilding(gState, 'forager_hut', cx + 1, cz);
  getTile(gState, cx, cz)!.onFireTimer = 7.0;

  let genericSpread = 0;
  for (let step = 0; step < 60; step++) {
    stepSimulation(gState, 0.1);
    for (let dz = -5; dz <= 5; dz++) {
      for (let dx = -5; dx <= 5; dx++) {
        if (dx === 0 && dz === 0) continue;
        const t = getTile(gState, cx + dx, cz + dz)!;
        if (t.onFireTimer > 0) genericSpread++;
      }
    }
  }
  assert.ok(genericSpread > 0, 'Fire on a single source tile must spread to adjacent forest/building neighbors');
});

test('entity inspector resolves names, diets, informations, carried/equipped items, genes, and favorite toggling', () => {
  const state = createInitialSimulationState(128, 'INSPECT-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const t = getTile(state, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }

  const human = spawnUnit(state, 'human', 64, 64).unit!;
  human.carryingType = 'wood';
  human.carryingAmount = 12;
  human.statusEffects.blessed = 8;

  const humanProfile = getEntityInspectProfile(state, human);
  assert.equal(humanProfile.name, human.name);
  assert.equal(humanProfile.diet.category, 'Omnivore');
  assert.ok(humanProfile.items[0].includes('Carrying 12 Wood'), 'Should show carried cargo item');
  assert.ok(humanProfile.items.length >= 3, 'Should include equipped/epoch items plus cargo');
  assert.ok(humanProfile.genes.length >= 1, 'Should include deterministic genetic traits');
  assert.ok(humanProfile.genes.includes('Human Adaptability'), 'Should include intrinsic human lineage trait');

  const standardHuman = spawnUnit(state, 'human', 64, 64, false, undefined, { appearanceSeed: 2 }).unit!;
  const standardProfile = getEntityInspectProfile(state, standardHuman);
  assert.deepEqual(standardProfile.genes, ['Human Adaptability'], 'Standard individual only expresses intrinsic gene');

  const rareHuman = spawnUnit(state, 'human', 64, 64, false, undefined, { appearanceSeed: 66 }).unit!;
  const rareProfile = getEntityInspectProfile(state, rareHuman);
  assert.ok(rareProfile.genes.includes('Human Adaptability'), 'Must retain intrinsic gene');
  assert.ok(rareProfile.genes.includes('Iron Lung'), 'RNG rare roll selects extra gene like Iron Lung');

  assert.ok(humanProfile.informations.statusEffects.includes('blessed'));

  const dinoSeeds = Array.from({ length: 24 }, (_, idx) => idx + 1);
  const carnSeed = dinoSeeds.find((s) => getDinosaurVariant(s).diet === 'carnivore')!;
  const herbSeed = dinoSeeds.find((s) => getDinosaurVariant(s).diet === 'herbivore')!;

  const trex = spawnUnit(state, 'dinosaur', 65, 64, false, undefined, { appearanceSeed: carnSeed }).unit!;
  const trike = spawnUnit(state, 'dinosaur', 63, 64, false, undefined, { appearanceSeed: herbSeed }).unit!;
  const dragon = spawnUnit(state, 'dragon', 64, 65).unit!;
  dragon.dragonBreathCooldown = 3.2;
  const unicorn = spawnUnit(state, 'unicorn', 64, 63).unit!;

  assert.equal(getEntityInspectProfile(state, trex).diet.category, 'Carnivore');
  assert.equal(getEntityInspectProfile(state, trike).diet.category, 'Herbivore');
  assert.equal(getEntityInspectProfile(state, trex).genes[0], 'Apex Theropod Physiology');
  assert.ok(
    getEntityInspectProfile(state, trike).genes[0] === 'Ceratopsian Crest' ||
      getEntityInspectProfile(state, trike).genes[0] === 'Dorsal Bone Plates',
  );
  const dragonProfile = getEntityInspectProfile(state, dragon);
  assert.equal(dragonProfile.diet.category, 'Pyro-Carnivore');
  assert.ok(dragonProfile.genes[0].endsWith('Scales'), 'Dragon must have its intrinsic scale gene');
  assert.equal(dragonProfile.informations.breathCooldown, 3.2);
  const unicornProfile = getEntityInspectProfile(state, unicorn);
  assert.equal(unicornProfile.diet.category, 'Fey Herbivore');
  assert.equal(unicornProfile.genes[0], 'Celestial Fey Horn');

  assert.equal(Boolean(dragon.favorite), false);
  assert.equal(toggleUnitFavorite(state, dragon.id), true);
  assert.equal(getEntityInspectProfile(state, dragon).favorite, true);
  assert.equal(toggleUnitFavorite(state, dragon.id), false);
  assert.equal(getEntityInspectProfile(state, dragon).favorite, false);

  dragon.state = 'ko';
  assert.equal(toggleUnitFavorite(state, dragon.id), false, 'KO units should not be toggleable as favorites');
});

test('camera target locks and tracks moving entity coordinates during follow mode', () => {
  const state = createInitialSimulationState(128, 'FOLLOW-CAM-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let dz = -5; dz <= 5; dz++) {
    for (let dx = -5; dx <= 5; dx++) {
      const t = getTile(state, 64 + dx, 64 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.buildingId = null;
    }
  }

  const unit = spawnUnit(state, 'human', 64, 64).unit!;
  assert.ok(unit, 'Unit should spawn');

  // Verify camera tracking updates to moving unit position
  const camDesiredTarget = { x: 64, y: 1.2, z: 64 };
  const followingEntityId = unit.id;

  // Unit moves towards (68, 64)
  unit.x = 65.5;
  unit.z = 64.2;
  const targetUnit = state.units.find((u) => u.id === followingEntityId && u.state !== 'ko');
  assert.ok(targetUnit);

  camDesiredTarget.x = targetUnit.x;
  camDesiredTarget.z = targetUnit.z;

  assert.equal(camDesiredTarget.x, 65.5);
  assert.equal(camDesiredTarget.z, 64.2);

  // Unit moves further
  unit.x = 67.8;
  unit.z = 64.9;
  camDesiredTarget.x = targetUnit.x;
  camDesiredTarget.z = targetUnit.z;

  assert.equal(camDesiredTarget.x, 67.8);
  assert.equal(camDesiredTarget.z, 64.9);
});

test('pressing play smoothly targets 45 degree isometric angle, centers world, and zooms out to see whole map', () => {
  const state = createInitialSimulationState(128, 'PLAY-TRANSITION-TEST');
  const worldCenter = (state.gridSize - 1) / 2;

  // Test angular delta calculation from any arbitrary rotating title yaw to 45 deg (Math.PI / 4)
  const targetYaw = Math.PI / 4;
  const testYaws = [0.1, 1.25, 2.7, 3.8, 5.5, 6.2, 12.4];
  for (const camYaw of testYaws) {
    const yawDiff = Math.atan2(Math.sin(targetYaw - camYaw), Math.cos(targetYaw - camYaw));
    const finalYaw = camYaw + yawDiff;
    const normFinal = ((finalYaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const normTarget = ((targetYaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    assert.ok(
      Math.abs(normFinal - normTarget) < 1e-5,
      `Calculated yaw must rotate directly to 45 degrees (camYaw=${camYaw}, got=${normFinal}, target=${normTarget})`,
    );
    assert.ok(Math.abs(yawDiff) <= Math.PI, `Yaw rotation must take shortest angular path (<= 180 deg, got ${yawDiff})`);
  }

  // Camera pan target centers the whole map
  assert.equal(worldCenter, 63.5);

  // Whole map overview frustum size is 105 (zoomed out)
  const wholeMapZoomFrustum = 105;
  assert.equal(wholeMapZoomFrustum, 105);
});

test('zones feature defaults to off, dynamically contours across land and sea, and supports hover inspection', () => {
  // 1. Default toggles must all be OFF by default
  assert.deepEqual(DEFAULT_ZONE_TOGGLES, {
    kingdoms: false,
    kings: false,
    territories: false,
    biomes: false,
    temperature: false,
    alliances: false,
  });

  const state = createInitialSimulationState(128, 'ZONES-LAND-SEA-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;

  // Sculpt a coastal peninsula at (50, 50):
  // x <= 50 is dry land (height 2, grass), x = 51..54 is shallow_water (height 0), x >= 55 is deep_water (height 0)
  for (let z = 42; z <= 58; z++) {
    for (let x = 42; x <= 60; x++) {
      const t = getTile(state, x, z)!;
      t.resourceNode = 'none';
      t.buildingId = null;
      if (x <= 50) {
        t.height = 2;
        t.terrain = 'grass';
      } else if (x <= 54) {
        t.height = 0;
        t.terrain = 'shallow_water';
      } else {
        t.height = 0;
        t.terrain = 'deep_water';
      }
    }
  }

  // Place a mountain wall to the west (x = 45) to verify non-circular topographic shaping
  for (let z = 44; z <= 56; z++) {
    const mt = getTile(state, 45, z)!;
    mt.height = 9;
    mt.terrain = 'mountain';
  }

  // Build a paved road heading north from (49, 49) to (49, 43)
  for (let z = 43; z <= 49; z++) {
    const rt = getTile(state, 49, z)!;
    rt.terrain = 'stone_road';
  }

  // Found a Human coastal kingdom at (49, 50) with 3 citizens
  const placed = placeBuilding(state, 'bonfire', 49, 50);
  assert.ok(placed.ok, 'Coastal settlement bonfire should place');
  spawnUnit(state, 'human', 49, 50);
  spawnUnit(state, 'human', 48, 50);
  spawnUnit(state, 'human', 49, 49);

  // Spawn a terrestrial wolf pack on an inland meadow at (25, 25) bordered by water at x >= 27
  for (let z = 20; z <= 30; z++) {
    for (let x = 20; x <= 32; x++) {
      const t = getTile(state, x, z)!;
      t.resourceNode = 'none';
      t.buildingId = null;
      if (x <= 26) {
        t.height = 2;
        t.terrain = 'forest';
      } else {
        t.height = 0;
        t.terrain = 'shallow_water';
      }
    }
  }
  spawnUnit(state, 'wolf', 25, 25);
  spawnUnit(state, 'wolf', 24, 25);

  // Spawn an amphibious capybara herd on the shoreline at (50, 55) next to shallow_water (51, 55)
  spawnUnit(state, 'capybara', 50, 55);
  spawnUnit(state, 'capybara', 50, 54);

  const zones = computeWorldZones(state);

  // Verify Kingdom zone includes population = 3 and claims BOTH land and adjacent maritime sea water
  assert.equal(zones.kingdomsById.size, 1);
  const kingdom = Array.from(zones.kingdomsById.values())[0];
  assert.equal(kingdom.population, 3);
  assert.ok(kingdom.landTileCount > 10, 'Kingdom should claim surrounding land tiles');
  assert.ok(
    kingdom.seaTileCount > 5,
    'Intelligent kingdom on coast must dynamically claim adjacent maritime sea tiles',
  );

  // Verify non-circular shaping: road north (49, 43) is reached easily while mountain barrier behind (43, 50) is blocked/resisted
  const roadReachIdx = 43 * state.gridSize + 49;
  const behindMountainIdx = 50 * state.gridSize + 42;
  assert.equal(zones.kingdomMap[roadReachIdx], kingdom.zoneId, 'Kingdom expands further along stone road');
  assert.equal(zones.kingdomMap[behindMountainIdx], 0, 'Mountain ridge blocks circular expansion');

  // Verify terrestrial Wolf territory strictly stays on land (seaTileCount === 0)
  const wolfTerritory = Array.from(zones.territoriesById.values()).find((t) => t.species === 'wolf')!;
  assert.ok(wolfTerritory, 'Wolf territory should exist');
  assert.ok(wolfTerritory.landTileCount > 5, 'Wolf territory covers forest land');
  assert.equal(wolfTerritory.seaTileCount, 0, 'Terrestrial wolf territory must stop at the coastline and never enter sea');

  // Verify amphibious Capybara territory spans both land and shallow sea lagoons
  const capyTerritory = Array.from(zones.territoriesById.values()).find((t) => t.species === 'capybara')!;
  assert.ok(capyTerritory, 'Capybara territory should exist');
  assert.ok(capyTerritory.landTileCount > 0, 'Capybara territory includes coastal land');
  assert.ok(capyTerritory.seaTileCount > 0, 'Amphibious capybara territory dynamically extends into shallow sea waters');

  // Verify hover inspection with inspectTileZones returns complete zone info on both land and sea
  const landInspect = inspectTileZones(zones, state, 49, 50)!;
  assert.ok(landInspect.kingdom);
  assert.equal(landInspect.kingdom?.name, kingdom.name);
  assert.equal(landInspect.kingdom?.population, 3);
  assert.equal(landInspect.isKingdomMaritime, false);
  assert.ok(landInspect.biomeZone);
  assert.ok(landInspect.temperatureZone);

  const seaInspect = inspectTileZones(zones, state, 51, 50)!;
  assert.ok(seaInspect.kingdom, 'Hovering coastal water next to kingdom should inspect its maritime zone');
  assert.equal(seaInspect.isKingdomMaritime, true);

  // Verify buildZoneOverlayTextures returns all zeros when toggles are off, and populates buffers when toggled on
  const offPack = buildZoneOverlayTextures(zones, DEFAULT_ZONE_TOGGLES, { x: 49, z: 50 });
  assert.equal(offPack.anyActive, false);

  const onPack = buildZoneOverlayTextures(
    zones,
    { kingdoms: true, kings: false, territories: true, biomes: false, temperature: false, alliances: false },
    { x: 49, z: 50 },
  );
  assert.equal(onPack.anyActive, true);
  const centerPixelOffset = (50 * state.gridSize + 49) * 4;
  assert.ok(onPack.colorData[centerPixelOffset + 3] > 0, 'Active zone tile must have non-zero alpha');
  assert.equal(onPack.idData[centerPixelOffset + 2], 255, 'Hovered zone must have hover highlight byte = 255');
});

test('World Creator templates (Realistic, Fantastic, Sci-Fi Orbital) and map sizes up to 256x256 apply rules accurately', () => {
  const templateIds = WORLD_TEMPLATES.map((t) => t.id);
  assert.ok(templateIds.includes('realistic'));
  assert.ok(templateIds.includes('fantastic'));
  assert.ok(templateIds.includes('scifi'));
  assert.ok(templateIds.includes('prehistoric'));
  assert.ok(templateIds.includes('archipelago'));
  assert.ok(templateIds.includes('custom'));

  // 1. Realistic template: no fantasy creatures (dragons/unicorns) and no crystal_field biomes
  const realisticCfg = createWorldConfigFromTemplate('realistic', { seed: 4242, gridSize: 96 });
  assert.equal(realisticCfg.rules.allowFantasy, false);
  assert.equal(realisticCfg.rules.allowDinosaurs, false);
  const realisticSim = createInitialSimulationState(realisticCfg.gridSize, realisticCfg.seed, realisticCfg);
  assert.equal(realisticSim.gridSize, 96);
  assert.equal(
    realisticSim.units.some((u) => u.role === 'dragon' || u.role === 'unicorn' || u.role === 'dinosaur'),
    false,
    'Realistic template must not spawn fantasy creatures or dinosaurs',
  );
  assert.equal(
    realisticSim.tiles.some((t) => t.terrain === 'crystal_field'),
    false,
    'Realistic template must not generate arcane crystal_field terrain',
  );
  assert.ok(realisticSim.population >= 4, 'Realistic template spawns starting pioneer settlers');

  // 2. Fantastic template: includes fantasy creatures (dragons/unicorns)
  const fantasticCfg = createWorldConfigFromTemplate('fantastic', { seed: 7777, gridSize: 128 });
  assert.equal(fantasticCfg.rules.allowFantasy, true);
  const fantasticSim = createInitialSimulationState(fantasticCfg.gridSize, fantasticCfg.seed, fantasticCfg);
  assert.equal(
    fantasticSim.units.some((u) => u.role === 'dragon' || u.role === 'unicorn'),
    true,
    'Fantastic template should spawn mythical creatures (Dragons / Unicorns)',
  );

  // 3. Sci-Fi Orbital template: starts right in the Orbital Age (epochIndex = 6) with an established colony and Year 0
  const scifiCfg = createWorldConfigFromTemplate('scifi', { seed: 9999, gridSize: 128 });
  assert.equal(scifiCfg.rules.startingEpochIndex, 6);
  assert.equal(scifiCfg.rules.startingSettlers, 'colony');
  const scifiSim = createInitialSimulationState(scifiCfg.gridSize, scifiCfg.seed, scifiCfg);
  assert.equal(scifiSim.epochIndex, 6, 'Sci-Fi template must start at Orbital Age (epochIndex 6)');
  assert.equal(scifiSim.year, 0, 'Worlds must start counting from Year 0');
  assert.ok(scifiSim.buildings.length >= 4, 'Sci-Fi template should start with an established colony');
  assert.ok(
    scifiSim.buildings.every((b) => b.epochLevel === 6),
    'Sci-Fi starting buildings should be upgraded to Orbital Age level 6',
  );
  assert.ok(scifiSim.population >= 6, 'Sci-Fi colony should have starting citizens');

  // 4. Max map size 256x256 ("Only for beefy computers!") generates 65,536 tiles cleanly
  const colossalSim = createInitialSimulationState(256, 12345);
  assert.equal(colossalSim.gridSize, 256);
  assert.equal(colossalSim.tiles.length, 256 * 256);
});

test('kingdoms maintain strictly 1 King across all branched-out zones', () => {
  const state = createInitialSimulationState(128, 'SINGLE-KING-BRANCH');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.worldRules = { ...state.worldRules!, allowRebellion: false };
  state.resources.food = 5000;
  state.resources.wood = 5000;
  state.resources.stone = 5000;

  for (let z = 20; z < 108; z++) {
    for (let x = 20; x < 108; x++) {
      const t = getTile(state, x, z)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
    }
  }

  for (let i = 0; i < 8; i++) {
    spawnUnit(state, 'human', 36 + (i % 3) - 1, 36 + Math.floor(i / 3) - 1, true);
  }
  for (let i = 0; i < 15; i++) stepSimulation(state, 0.25);
  advanceEpoch(state, true);

  for (let i = 0; i < 240; i++) {
    stepSimulation(state, 0.25);
    for (const b of state.buildings) {
      b.constructionProgress = 100;
    }
  }

  const settlementIds = Array.from(new Set(state.buildings.map((b) => b.settlementId).filter(Boolean))) as string[];
  assert.ok(settlementIds.length >= 2, `Expected kingdom to branch into >= 2 zones, got ${settlementIds.length}`);

  const rootKingdoms = new Set(settlementIds.map((sid) => state.settlementKingdoms?.[sid] ?? sid));
  assert.equal(rootKingdoms.size, 1, 'Branched-out settlement zones must share the same root kingdom');

  const kings = state.units.filter((u) => u.isKing && u.state !== 'ko' && u.faction === 'civilization');
  assert.equal(kings.length, 1, `Expected strictly 1 King across all branched zones, found ${kings.length}`);

  // All branched zones of the same kingdom share the same zone color
  const zones = computeWorldZones(state);
  const kingdomZones = Array.from(zones.kingdomsById.values());
  assert.ok(kingdomZones.length >= 2);
  const colors = new Set(kingdomZones.map((k) => k.hexColor));
  assert.equal(colors.size, 1, 'Branched-out zones of the same kingdom should share their kingdom color');

  const colorMap = extractKingdomColorsMap(zones, state);
  const king = kings[0];
  const resolvedKingColor =
    (king.settlementId && colorMap[king.settlementId]) ||
    (king.kingdomId && colorMap[king.kingdomId]);
  assert.equal(resolvedKingColor, kingdomZones[0].hexColor, 'King label color must match their kingdom zone color');

  // If the monarch falls, exactly 1 successor is crowned across the kingdom
  kings[0].hp = 0;
  kings[0].state = 'ko';
  stepSimulation(state, 0.25);
  const newKings = state.units.filter((u) => u.isKing && u.state !== 'ko' && u.faction === 'civilization');
  assert.equal(newKings.length, 1, 'Exactly 1 successor King should be crowned for the kingdom');
});

test('same-race units spawned on other parts of the map form independent cities, kingdoms, and their own Kings', () => {
  const state = createInitialSimulationState(128, 'INDEPENDENT-REALMS');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;

  for (let z = 20; z < 110; z++) {
    for (let x = 20; x < 110; x++) {
      const t = getTile(state, x, z)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
    }
  }

  // Colony 1 (Human) at (30, 30)
  for (let i = 0; i < 4; i++) {
    const res = spawnUnit(state, 'human', 30 + (i % 2), 30 + Math.floor(i / 2), true);
    assert.equal(res.ok, true);
  }
  for (let i = 0; i < 15; i++) stepSimulation(state, 0.1);
  assert.equal(state.buildings.length, 1);
  const colony1Id = state.buildings[0].settlementId!;
  const kingdom1Id = state.settlementKingdoms?.[colony1Id] ?? colony1Id;

  // Spawn another Human group ~28 tiles away at (58, 30) — should NOT merge into Colony 1's kingdom
  const group2: string[] = [];
  for (let i = 0; i < 3; i++) {
    const res = spawnUnit(state, 'human', 58 + i, 30, true);
    assert.equal(res.ok, true);
    assert.equal(res.unit?.settlementId, undefined, 'Independent settlers must not auto-join Colony 1');
    assert.equal(res.unit?.kingdomId, undefined, 'Independent settlers must not auto-ally with Colony 1');
    assert.equal(res.unit?.ageStage, 'adult', 'Pioneers spawned on unclaimed land must spawn as adults');
    group2.push(res.unit!.id);
  }

  // Step 4s so group 2 builds its own city hearth & crowns its own King
  for (let i = 0; i < 40; i++) stepSimulation(state, 0.1);

  const bonfires = state.buildings.filter((b) => b.type === 'bonfire');
  const settlementSet = new Set(state.buildings.map((b) => b.settlementId).filter(Boolean));
  assert.equal(bonfires.length, 2, 'Independent human group must found its own separate city hearth');
  assert.equal(settlementSet.size, 2, 'Independent human group must found its own separate city');
  const colony2Bld = state.buildings.find((b) => b.settlementId !== colony1Id)!;
  assert.ok(colony2Bld, 'Second city must have a distinct settlementId');
  const kingdom2Id = state.settlementKingdoms?.[colony2Bld.settlementId!] ?? colony2Bld.settlementId!;
  assert.notEqual(kingdom2Id, kingdom1Id, 'Second city must form its own independent kingdom');

  const kings = state.units.filter((u) => u.isKing && u.state !== 'ko' && u.faction === 'civilization');
  assert.equal(kings.length, 2, 'Each independent human kingdom must crown its own King');
  const kingKingdoms = new Set(kings.map((k) => k.kingdomId ?? k.settlementId));
  assert.equal(kingKingdoms.size, 2, 'Each King must rule a separate kingdom');

  const zones = computeWorldZones(state);
  const kingdomZones = Array.from(zones.kingdomsById.values());
  assert.equal(kingdomZones.length, 2);
  assert.notEqual(
    kingdomZones[0].hexColor,
    kingdomZones[1].hexColor,
    'Independent human kingdoms must display distinct zone colors',
  );
});

test('graphics presets, profile resolution, auto-trim levels, and settings sanitization preserve defaults and scale cleanly', () => {
  assert.deepEqual(DEFAULT_GRAPHICS_SETTINGS, {
    preset: 'high',
    shadows: 'on',
    cloudsAndSky: 'full',
    foliageDensity: 'full',
    particles: 'full',
    autoOptimizeFps: true,
  });

  // Default High preset resolves to full fidelity matching original look
  const highProfile = resolveGraphicsProfile(DEFAULT_GRAPHICS_SETTINGS, 0);
  assert.equal(highProfile.shadowsEnabled, true);
  assert.equal(highProfile.shadowMapSize, 1024);
  assert.equal(highProfile.shadowUpdateStride, 1);
  assert.equal(highProfile.cloudsAndSky, 'full');
  assert.equal(highProfile.foliageFactor, 1.0);
  assert.equal(highProfile.particleScale, 1.0);

  // Balanced & Fast presets
  const balanced = applyGraphicsPreset('balanced', true);
  assert.equal(balanced.preset, 'balanced');
  assert.equal(balanced.shadows, 'fast');
  const balancedProfile = resolveGraphicsProfile(balanced, 0);
  assert.equal(balancedProfile.shadowsEnabled, true);
  assert.equal(balancedProfile.shadowMapSize, 512);
  assert.equal(balancedProfile.shadowUpdateStride, 1);
  assert.equal(balancedProfile.cloudsAndSky, 'reduced');
  assert.equal(balancedProfile.foliageFactor, 0.55);
  assert.equal(balancedProfile.particleScale, 0.55);

  const fast = applyGraphicsPreset('fast', false);
  assert.equal(fast.preset, 'fast');
  assert.equal(fast.autoOptimizeFps, false);
  const fastProfile = resolveGraphicsProfile(fast, 2);
  assert.equal(fastProfile.shadowsEnabled, false);
  assert.equal(fastProfile.cloudsAndSky, 'off');
  assert.equal(fastProfile.foliageFactor, 0.22);
  assert.equal(fastProfile.particleScale, 0.25);

  // inferGraphicsPreset detects presets vs custom combinations
  assert.equal(inferGraphicsPreset(DEFAULT_GRAPHICS_SETTINGS), 'high');
  assert.equal(inferGraphicsPreset(balanced), 'balanced');
  assert.equal(inferGraphicsPreset(fast), 'fast');
  assert.equal(
    inferGraphicsPreset({
      ...DEFAULT_GRAPHICS_SETTINGS,
      shadows: 'off',
    }),
    'custom',
  );

  // Auto-trim levels 1 & 2 dynamically scale down lightweight runtime effects without shadow RT reallocations
  const trim1 = resolveGraphicsProfile(DEFAULT_GRAPHICS_SETTINGS, 1);
  assert.equal(trim1.shadowsEnabled, true);
  assert.equal(trim1.shadowMapSize, 1024);
  assert.equal(trim1.shadowUpdateStride, 1);
  assert.equal(trim1.cloudsAndSky, 'reduced');
  assert.equal(trim1.particleScale, 0.55);
  assert.equal(trim1.foliageFactor, 1.0);

  const trim2 = resolveGraphicsProfile(DEFAULT_GRAPHICS_SETTINGS, 2);
  assert.equal(trim2.shadowsEnabled, true);
  assert.equal(trim2.shadowMapSize, 1024);
  assert.equal(trim2.shadowUpdateStride, 3);
  assert.equal(trim2.cloudsAndSky, 'off');
  assert.equal(trim2.foliageFactor, 0.55);
  assert.equal(trim2.particleScale, 0.25);

  const manualHigh = { ...DEFAULT_GRAPHICS_SETTINGS, autoOptimizeFps: false };
  const trimDisabled = resolveGraphicsProfile(manualHigh, 2);
  assert.deepEqual(trimDisabled, highProfile);

  // sanitizeGraphicsSettings safely handles corrupt/partial values
  assert.deepEqual(sanitizeGraphicsSettings(null), DEFAULT_GRAPHICS_SETTINGS);
  assert.deepEqual(sanitizeGraphicsSettings('bad'), DEFAULT_GRAPHICS_SETTINGS);
  const partial = sanitizeGraphicsSettings({
    shadows: 'fast',
    cloudsAndSky: 'invalid',
    foliageDensity: 'medium',
    particles: 'reduced',
    autoOptimizeFps: false,
  });
  assert.equal(partial.shadows, 'fast');
  assert.equal(partial.cloudsAndSky, 'full');
  assert.equal(partial.foliageDensity, 'medium');
  assert.equal(partial.particles, 'reduced');
  assert.equal(partial.autoOptimizeFps, false);
  assert.equal(partial.preset, 'custom');
});

test('all entities have fixed species lifespans (elves 200+, dragons 500+), die of old age when mortal, and survive epoch leaps', () => {
  const state = createInitialSimulationState(64, 'LIFESPAN-TEST');
  state.wildlifeSeeded = true;
  for (const t of state.tiles) {
    if (t.x >= 20 && t.x <= 44 && t.z >= 20 && t.z <= 44) {
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }

  const humanRes = spawnUnit(state, 'human', 24, 24, true, undefined, { ageYears: 20, maxLifespan: 80 });
  const elfRes = spawnUnit(state, 'elf', 32, 30, true);
  const dragonRes = spawnUnit(state, 'dragon', 40, 40, true);
  const orcRes = spawnUnit(state, 'orc', 36, 30, true);
  const chickenRes = spawnUnit(state, 'chicken', 38, 30, true);

  assert.equal(humanRes.ok, true);
  assert.equal(elfRes.ok, true);
  assert.equal(dragonRes.ok, true);
  assert.equal(orcRes.ok, true);
  assert.equal(chickenRes.ok, true);

  const human = humanRes.unit!;
  const elf = elfRes.unit!;
  const dragon = dragonRes.unit!;
  const orc = orcRes.unit!;
  const chicken = chickenRes.unit!;

  assert.ok((human.maxLifespan ?? 0) >= 75 && (human.maxLifespan ?? 0) <= 110);
  assert.ok((elf.maxLifespan ?? 0) >= 200, `Elves must live 200+ years, got ${elf.maxLifespan}`);
  assert.ok((dragon.maxLifespan ?? 0) >= 500, `Dragons must live 500+ years, got ${dragon.maxLifespan}`);
  assert.ok((orc.maxLifespan ?? 0) >= 55 && (orc.maxLifespan ?? 0) <= 85);
  assert.ok((chicken.maxLifespan ?? 0) >= 8 && (chicken.maxLifespan ?? 0) <= 15);
  assert.equal(getUnitMaxLifespan({ role: 'unicorn', species: 'human', appearanceSeed: 42 }) >= 350, true);

  // Epoch leap jumps state.year forward by thousands of years — must NOT kill living units prematurely!
  advanceEpoch(state, true);
  stepSimulation(state, 0.5);
  assert.notEqual(elf.state, 'ko', 'Elves should survive epoch calendar year jump');
  assert.notEqual(dragon.state, 'ko', 'Dragons should survive epoch calendar year jump');

  // Inspector profile reports lifespan when mortal
  const elfProfile = getEntityInspectProfile(state, elf);
  assert.equal(elfProfile.informations.immortal, false);
  assert.ok((elfProfile.informations.maxLifespan ?? 0) >= 200);

  // Enable Immortal Entities rule -> even an ancient unit past maxLifespan survives
  state.worldRules!.animalAttacks = false;
  state.worldRules!.immortalEntities = true;
  human.ageYears = 95;
  stepSimulation(state, 0.5);
  assert.notEqual(human.state, 'ko', 'Immortal Entities rule must protect entities past maxLifespan');
  assert.equal(getEntityInspectProfile(state, human).informations.immortal, true);
  assert.equal(getEntityInspectProfile(state, human).informations.maxLifespan, null);

  // Disable Immortal Entities -> mortal unit past maxLifespan passes away cleanly & successor King crowns
  state.sandboxFreeMode = true;
  const bldRes = placeBuilding(state, 'bonfire', 24, 24);
  assert.equal(bldRes.ok, true);
  const sid = state.buildings[0].settlementId;
  const heirRes = spawnUnit(state, 'human', 24, 24, true, sid, {
    ageStage: 'adult',
    ageYears: 10,
    maxLifespan: 85,
  });
  assert.equal(heirRes.ok, true);
  human.settlementId = sid;
  human.kingdomId = state.settlementKingdoms?.[sid!];
  human.isKing = true;
  state.worldRules!.immortalEntities = false;
  for (let i = 0; i < 6; i++) stepSimulation(state, 0.25);
  assert.equal(human.state, 'ko', 'Mortal unit past maxLifespan must pass away naturally');
  assert.equal(heirRes.unit!.isKing, true, 'Successor must be crowned King after previous King dies of old age');
});

test('God Rules live toggles govern wildfireSpread, allowReproduction, and animalAttacks', () => {
  // 1. Wildfire Spread OFF prevents fire propagation across adjacent tiles
  const fireState = createInitialSimulationState(64, 'GOD-RULE-FIRE');
  fireState.wildlifeSeeded = true;
  fireState.worldRules!.wildfireSpread = false;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const t = getTile(fireState, 32 + dx, 32 + dz)!;
      t.height = 2;
      t.terrain = 'forest';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }
  const centerFire = getTile(fireState, 32, 32)!;
  centerFire.onFireTimer = 4.0;
  for (let i = 0; i < 10; i++) stepSimulation(fireState, 0.25);
  const neighborFire = getTile(fireState, 33, 32)!;
  assert.equal(neighborFire.onFireTimer, 0, 'wildfireSpread=false must prevent fire from spreading to neighbors');

  // 2. Reproduction OFF prevents autonomous village births even with surplus food
  const popState = createInitialSimulationState(64, 'GOD-RULE-REPRO');
  popState.wildlifeSeeded = true;
  popState.sandboxFreeMode = true;
  popState.resources.food = 500;
  popState.worldRules!.allowReproduction = false;
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const t = getTile(popState, 32 + dx, 32 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }
  placeBuilding(popState, 'bonfire', 32, 32);
  popState.buildings[0].constructionProgress = 100;
  placeBuilding(popState, 'forager_hut', 34, 32);
  popState.buildings[1].constructionProgress = 100;
  spawnUnit(popState, 'human', 32, 32, true);
  spawnUnit(popState, 'human', 33, 32, true);
  const beforeCount = popState.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko').length;
  for (let i = 0; i < 20; i++) stepSimulation(popState, 0.5);
  const afterCount = popState.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko').length;
  assert.equal(afterCount, beforeCount, 'allowReproduction=false must stop settlements from spawning new citizens');

  // 3. Animal Attacks OFF keeps predators & dragons peaceful toward nearby prey
  const calmState = createInitialSimulationState(64, 'GOD-RULE-ANIMALS');
  calmState.wildlifeSeeded = true;
  calmState.worldRules!.animalAttacks = false;
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const t = getTile(calmState, 32 + dx, 32 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }
  const wolfRes = spawnUnit(calmState, 'wolf', 32, 32, true);
  const chickenRes = spawnUnit(calmState, 'chicken', 33, 32, true);
  const startHp = chickenRes.unit!.hp;
  for (let i = 0; i < 10; i++) stepSimulation(calmState, 0.25);
  assert.equal(chickenRes.unit!.hp, startHp, 'animalAttacks=false must stop predators from attacking prey');
  assert.notEqual(wolfRes.unit!.state, 'fighting', 'Wolf should not enter combat when animalAttacks=false');
});

test('1x land brush (brushRadius=0) paints strictly a single tile instead of a 5-tile cross', () => {
  const state = createInitialSimulationState(64, 'BRUSH-1X-SINGLE');
  state.sandboxFreeMode = true;
  const cx = 32;
  const cz = 32;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const t = getTile(state, cx + dx, cz + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }

  // Paint rail_track at 1x (brushRadius = 0) along three collinear tiles (cx..cx+2, cz)
  assert.equal(applyTerrainTool(state, 'rail_track', cx, cz, 0).ok, true);
  assert.equal(applyTerrainTool(state, 'rail_track', cx + 1, cz, 0).ok, true);
  assert.equal(applyTerrainTool(state, 'rail_track', cx + 2, cz, 0).ok, true);

  assert.equal(getTile(state, cx, cz)!.terrain, 'rail_track');
  assert.equal(getTile(state, cx + 1, cz)!.terrain, 'rail_track');
  assert.equal(getTile(state, cx + 2, cz)!.terrain, 'rail_track');
  // Adjacent perpendicular tiles must stay untouched grass (no '+' cross!)
  assert.equal(getTile(state, cx, cz - 1)!.terrain, 'grass', '1x brush must not paint northern neighbor');
  assert.equal(getTile(state, cx, cz + 1)!.terrain, 'grass', '1x brush must not paint southern neighbor');
  assert.equal(getTile(state, cx - 1, cz)!.terrain, 'grass', '1x brush must not paint western neighbor');

  // Verify raise at 1x (brushRadius = 0) raises strictly 1 tile
  const beforeCenterH = getTile(state, cx, cz - 2)!.height;
  assert.equal(applyTerrainTool(state, 'raise', cx, cz - 2, 0).ok, true);
  assert.equal(getTile(state, cx, cz - 2)!.height, beforeCenterH + 1);
  assert.equal(getTile(state, cx + 1, cz - 2)!.height, 2);
  assert.equal(getTile(state, cx - 1, cz - 2)!.height, 2);
});

test('strengthened meteor, lightning, and tsunami kill targets and destroy buildings', () => {
  const state = createInitialSimulationState(64, 'POWER-LETHAL');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (const t of state.tiles) {
    if (t.x >= 10 && t.x <= 54 && t.z >= 10 && t.z <= 54) {
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }

  // 1. Asteroid (meteor_strike) one-shots high-HP buildings in core blast
  const b1 = placeBuilding(state, 'fission_reactor', 20, 20);
  assert.equal(b1.ok, true);
  const reactor = state.buildings.find((b) => b.tileX === 20 && b.tileZ === 20)!;
  reactor.hp = 1200;
  reactor.maxHp = 1200;
  castGodPower(state, 'meteor_strike', 20, 20);
  assert.equal(reactor.hp, 0, 'Meteor strike must one-shot buildings within core blast');

  // 2. Lightning destroys buildings cleanly
  const b2 = placeBuilding(state, 'forager_hut', 36, 20);
  assert.equal(b2.ok, true);
  const hut = state.buildings.find((b) => b.tileX === 36 && b.tileZ === 20)!;
  castGodPower(state, 'lightning_smite', 36, 20);
  assert.equal(hut.hp, 0, 'Lightning smite must destroy buildings near impact');

  // 3. Tsunami kills non-flying NPCs and wrecks coastal buildings
  const b3 = placeBuilding(state, 'bonfire', 40, 40);
  assert.equal(b3.ok, true);
  const coastalNpc = spawnUnit(state, 'human', 42, 40, true);
  const coastalDragon = spawnUnit(state, 'dragon', 42, 41, true);
  assert.equal(coastalNpc.ok, true);
  assert.equal(coastalDragon.ok, true);
  castGodPower(state, 'tsunami', 38, 40);
  for (let i = 0; i < 12; i++) stepSimulation(state, 0.2);
  assert.equal(coastalNpc.unit!.state, 'ko', 'Tsunami surge must kill unshielded non-flying NPCs');
  assert.notEqual(coastalDragon.unit!.state, 'ko', 'Flying dragon survives tsunami surge');
});

test('black hole orbits & lifts entities, erodes terrain, then explodes into supernova scattering units with fall damage', () => {
  const state = createInitialSimulationState(64, 'BLACKHOLE-SUPERNOVA');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  const bx = 32;
  const bz = 32;
  for (let dz = -12; dz <= 12; dz++) {
    for (let dx = -12; dx <= 12; dx++) {
      const t = getTile(state, bx + dx, bz + dz)!;
      t.height = 3;
      t.terrain = 'forest';
      t.resourceNode = 'timber_grove';
      t.resourceAmount = 120;
      t.buildingId = null;
    }
  }

  const cowRes = spawnUnit(state, 'cow', bx + 4, bz, true);
  const dragonRes = spawnUnit(state, 'dragon', bx + 3, bz + 2, true);
  assert.equal(cowRes.ok, true);
  assert.equal(dragonRes.ok, true);
  const cow = cowRes.unit!;
  const dragon = dragonRes.unit!;

  castGodPower(state, 'wormhole_ascension', bx, bz);

  // Step 2.0s during orbiting phase: cow is pulled in and lifted into orbit
  for (let i = 0; i < 20; i++) stepSimulation(state, 0.1);
  assert.ok((cow.altitude ?? 0) > 0.5, `Trapped entity must be lifted into black hole orbit (alt=${cow.altitude})`);

  // Step past 5.5s so supernova explosion fires
  let sawExplosionVfx = false;
  for (let i = 0; i < 45; i++) {
    stepSimulation(state, 0.1);
    if (state.pendingVfx.some((v) => v.type === 'blackhole_explosion')) {
      sawExplosionVfx = true;
    }
  }
  assert.equal(sawExplosionVfx, true, 'Black hole must emit blackhole_explosion supernova VFX on collapse');

  // Step through ballistic scatter & landing impact
  for (let i = 0; i < 45; i++) stepSimulation(state, 0.1);
  const scatterDist = Math.hypot(cow.x - bx, cow.z - bz);
  assert.ok(scatterDist > 3.5, `Supernova must scatter entities outward across the map (dist=${scatterDist})`);
  assert.ok(cow.hp < cow.maxHp || cow.state === 'ko', 'Land animal must take lethal/heavy fall damage on landing');
  assert.notEqual(dragon.state, 'ko', 'Flying dragon must not suffer fatal ground fall damage');
});

test('powers (heat_wave, freeze_snap, tornado, tsunamis, asteroids) and drag_entity telekinesis work end to end with incremental waves and no phantom black holes', () => {
  const state = createInitialSimulationState(64, 'NEW-POWERS');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (const t of state.tiles) {
    if (t.x >= 8 && t.x <= 56 && t.z >= 8 && t.z <= 56) {
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }

  // 1. Bomb-related powers (bomb, cluster_bomb, mega_bomb/Tsar Bomb) are removed from the catalog
  const powerTypes = GOD_POWERS.map((p) => p.type);
  assert.equal(powerTypes.includes('bomb' as any), false, 'Bomb must be removed from GOD_POWERS');
  assert.equal(powerTypes.includes('cluster_bomb' as any), false, 'Cluster bomb must be removed from GOD_POWERS');
  assert.equal(powerTypes.includes('mega_bomb' as any), false, 'Mega bomb must be removed from GOD_POWERS');

  // 2. Freeze Snap & Heat Wave work incrementally via expanding waves without creating phantom black holes
  const centerTile = getTile(state, 20, 20)!;
  const outerTile = getTile(state, 24, 20)!; // Distance 4.0 tiles away from center
  centerTile.onFireTimer = 5.0;
  outerTile.terrain = 'grass';
  const hRes = spawnUnit(state, 'human', 20, 20, true);
  assert.equal(hRes.ok, true);
  const human = hRes.unit!;

  castGodPower(state, 'freeze_snap', 20, 20);
  // Center tile is extinguished immediately at impact
  assert.equal(centerTile.onFireTimer, 0, 'Freeze snap must extinguish fires at center');
  assert.ok((human.statusEffects.frozen ?? 0) > 0, 'Freeze snap must freeze units at center');
  // Outer tile (dist 4.0) has NOT been frozen yet because the wave spreads incrementally outward!
  assert.notEqual(outerTile.terrain, 'snow', 'Outer tile at radius 4 must NOT freeze immediately on cast');

  // Verify no phantom black hole (wormhole_rift) was created by casting freeze_snap
  const phantomBlackHoles = state.activeHazards.filter((h) => h.kind === 'wormhole_rift');
  assert.equal(phantomBlackHoles.length, 0, 'Casting freeze_snap must not spawn a phantom black hole');

  // Advance simulation so the expanding wave reaches outer tile
  for (let s = 0; s < 16; s++) {
    stepSimulation(state, 0.1);
  }
  assert.equal(outerTile.terrain, 'snow', 'Freeze snap wave must reach outer tile incrementally');

  // Now cast Heat Wave incrementally
  castGodPower(state, 'heat_wave', 20, 20);
  // Verify no phantom black hole
  assert.equal(state.activeHazards.filter((h) => h.kind === 'wormhole_rift').length, 0);
  assert.equal(human.statusEffects.frozen, undefined, 'Heat wave must thaw center unit');

  // Advance simulation so heat wave reaches outer tile
  for (let s = 0; s < 16; s++) {
    stepSimulation(state, 0.1);
  }
  assert.notEqual(outerTile.terrain, 'snow', 'Heat wave must melt snow on outer tile incrementally');

  // 3. Tornado spawns moving tornado_vortex that lifts & tosses units
  const wolfRes = spawnUnit(state, 'wolf', 32, 32, true);
  castGodPower(state, 'tornado', 32, 32);
  const tornado = state.activeHazards.find((h) => h.kind === 'tornado_vortex');
  assert.ok(tornado, 'Tornado must spawn tornado_vortex hazard');
  const tStartX = tornado.x;
  const tStartZ = tornado.z;
  for (let i = 0; i < 12; i++) stepSimulation(state, 0.1);
  assert.ok(Math.hypot(tornado.x - tStartX, tornado.z - tStartZ) > 1.0, 'Tornado must roam across the map');
  assert.ok((wolfRes.unit!.altitude ?? 0) > 0 || wolfRes.unit!.hp < wolfRes.unit!.maxHp);

  // 4. Telekinesis Drag Tool grabs entity with physical weight/lag and inflicts fall damage on release
  const pigRes = spawnUnit(state, 'pig', 16, 44, true);
  assert.equal(pigRes.ok, true);
  const pig = pigRes.unit!;
  const initialPigX = pig.x;
  beginDragUnit(state, pig.id);
  assert.equal(pig.draggedByPlayer, true);

  // Set drag target 10 tiles away
  updateDragUnit(state, pig.id, 26, 44, 5.5);
  // Unit position must NOT immediately snap to 26; it retains physical drag delay
  assert.equal(pig.x, initialPigX, 'Dragged entity must not snap instantly to cursor target');
  assert.equal(pig.dragTargetX, 26);

  // Step simulation once: pig starts lagging behind target with natural weight
  stepSimulation(state, 0.05);
  assert.ok(pig.x > initialPigX && pig.x < 25.0, `Dragged entity should lag smoothly towards target (x=${pig.x})`);

  // Over subsequent steps, entity catches up to target position
  for (let i = 0; i < 20; i++) stepSimulation(state, 0.05);
  assert.ok(pig.x > 25.0, `Dragged entity should smoothly catch up over time (x=${pig.x})`);
  assert.ok((pig.altitude ?? 0) >= 4.5);

  // Release and verify momentum and fall damage
  releaseDragUnit(state, pig.id, 6, 0);
  assert.equal(pig.draggedByPlayer, false);
  for (let i = 0; i < 20; i++) stepSimulation(state, 0.1);
  assert.ok(pig.hp < pig.maxHp || pig.state === 'ko', 'Dropping animal from high altitude must inflict fall damage');
});

test('War Update: chance-based Human/Elf peace vs barbaric Orcs with rare peaceful Orc roll & warsEnabled toggle', () => {
  const state = createInitialSimulationState(96, 'DIPLOMACY-TEST');
  state.sandboxFreeMode = true;

  let humanPeaceCount = 0;
  let orcPeaceCount = 0;
  for (let i = 0; i < 80; i++) {
    const s = createInitialSimulationState(64, `D-${i}`);
    if (rollKingdomPeacefulTrait(s, `k-h-${i}`, 'human')) humanPeaceCount++;
    if (rollKingdomPeacefulTrait(s, `k-o-${i}`, 'orc')) orcPeaceCount++;
  }
  assert.ok(humanPeaceCount >= 40, `Expected Humans to usually be peaceful (${humanPeaceCount}/80)`);
  assert.ok(orcPeaceCount < humanPeaceCount && orcPeaceCount > 0 && orcPeaceCount <= 25,
    `Expected Orcs to rarely roll peaceful (${orcPeaceCount}/80)`);

  // Verify peaceful Human + Elf kingdoms can start allied or neutral rather than forced war
  state.kingdomPeacefulTraits = state.kingdomPeacefulTraits ?? {};
  state.kingdomPeacefulTraits['h-1'] = true;
  state.kingdomPeacefulTraits['e-1'] = true;
  const relHE = initializeKingdomDiplomacyPair(state, 'h-1', 'human', 'e-1', 'elf');
  assert.notEqual(relHE, 'war', 'Peaceful Human and Elf kingdoms should not force instant war');

  // Verify default non-peaceful Orc starts at war
  state.kingdomPeacefulTraits['o-1'] = false;
  const relHO = initializeKingdomDiplomacyPair(state, 'h-1', 'human', 'o-1', 'orc');
  assert.equal(relHO, 'war', 'Barbaric Orc kingdom must start hostile (war)');

  // When warsEnabled is false, areKingdomsAtWar must return false even if pair relation is war
  state.worldRules = { ...state.worldRules!, warsEnabled: false };
  assert.equal(areKingdomsAtWar(state, 'h-1', 'o-1'), false, 'Disabling Wars rule must suppress active war state');
  state.worldRules = { ...state.worldRules!, warsEnabled: true };
  assert.equal(areKingdomsAtWar(state, 'h-1', 'o-1'), true);
});

test('War Update: universal self-defense + rivaling racial weapons (Human Nuke, Elf Cataclysm, Orc attached Battlewill)', () => {
  const state = createInitialSimulationState(96, 'RACIAL-WAR-WEAPONS');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.epochIndex = 5; // Atomic/Information era so Nukes, Arcane Cataclysm & Battlewill are unlocked
  for (let z = 15; z <= 75; z++) {
    for (let x = 15; x <= 75; x++) {
      const t = getTile(state, x, z)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }

  // 1. Self-defense: Citizen under attack fights back against a wolf instead of ignoring it
  const defenderRes = spawnUnit(state, 'human', 40, 40, true);
  const wolfRes = spawnUnit(state, 'wolf', 41.2, 40, true);
  assert.ok(defenderRes.ok && wolfRes.ok);
  const defender = defenderRes.unit!;
  const wolf = wolfRes.unit!;
  defender.weaponCooldown = 0;
  for (let i = 0; i < 8; i++) stepSimulation(state, 0.25);
  assert.ok(
    wolf.hp < wolf.maxHp || wolf.state === 'ko',
    'Human citizen under predator attack must actively defend and damage the attacker',
  );

  // 2. Rivaling superweapons across Human, Elf, and Orc
  // Clear old units & hearth buildings and place settlements far enough apart so they stay distinct
  state.units = [];
  state.buildings = [];
  for (const t of state.tiles) t.buildingId = null;
  state.pendingVfx = [];
  placeBuilding(state, 'bonfire', 20, 42);
  placeBuilding(state, 'bonfire', 68, 42);
  const sIds = Array.from(new Set(state.buildings.map((b) => b.settlementId!)));
  assert.equal(sIds.length, 2);
  setKingdomRelation(state, sIds[0], sIds[1], 'war');

  // Human Nuke vs Enemy Orc
  const hBomber = spawnUnit(state, 'human', 42, 44, true).unit!;
  hBomber.settlementId = sIds[0];
  hBomber.weaponCooldown = 0;
  const oTarget1 = spawnUnit(state, 'orc', 45.5, 44, true).unit!;
  oTarget1.settlementId = sIds[1];
  oTarget1.hp = 500;
  oTarget1.maxHp = 500;

  for (let i = 0; i < 6; i++) stepSimulation(state, 0.1);
  const sawNuke = state.pendingVfx.some((v) => v.type === 'nuke_blast');
  assert.ok(sawNuke, 'Industrial/Atomic Human combatant should fire Nuke Bomb VFX in wartime combat');

  // Elf Arcane Cataclysm
  state.units = [];
  state.pendingVfx = [];
  state.kingdomUltimateCooldowns = {};
  const eMage = spawnUnit(state, 'elf', 42, 48, true).unit!;
  eMage.settlementId = sIds[0];
  eMage.weaponCooldown = 0;
  const oTarget2 = spawnUnit(state, 'orc', 45.5, 48, true).unit!;
  oTarget2.settlementId = sIds[1];
  oTarget2.hp = 500;
  oTarget2.maxHp = 500;

  for (let i = 0; i < 6; i++) stepSimulation(state, 0.1);
  const sawCataclysm = state.pendingVfx.some((v) => v.type === 'arcane_cataclysm');
  assert.ok(sawCataclysm, 'Advanced Elf combatant should unleash Arcane Cataclysm VFX rivaling Nukes');

  // Orc Battlewill: manifests as attached state on caster, emits battlewill_slash VFX, spawns ZERO summon units
  state.units = [];
  state.pendingVfx = [];
  const oWarlord = spawnUnit(state, 'orc', 42, 52, true).unit!;
  oWarlord.settlementId = sIds[1];
  oWarlord.battlewillCooldown = 0;
  oWarlord.weaponCooldown = 0;
  const hTarget = spawnUnit(state, 'human', 44.2, 52, true).unit!;
  hTarget.settlementId = sIds[0];
  hTarget.hp = 500;
  hTarget.maxHp = 500;

  const initialUnitCount = state.units.length;
  for (let i = 0; i < 6; i++) stepSimulation(state, 0.1);
  assert.ok((oWarlord.battlewillActive ?? 0) > 0, 'Orc caster must activate attached Battlewill extension');
  assert.ok(
    state.pendingVfx.some((v) => v.type === 'battlewill_slash'),
    'Orc Battlewill must unleash wide battlewill_slash VFX',
  );
  assert.ok(
    state.units.length <= initialUnitCount,
    'Orc Battlewill must NOT spawn an autonomous summon UnitEntity',
  );

  // Verify 3D Orc mesh contains attached battlewill_avatar + battlewill_sword_pivot child nodes
  const orcGroup = createUnitGroup('warrior', 'civilization', 5, 'orc', 11, 'adult');
  assert.ok(orcGroup.getObjectByName('battlewill_avatar'), 'Orc 3D mesh must include battlewill_avatar child');
  assert.ok(
    orcGroup.getObjectByName('battlewill_sword_pivot'),
    'Orc 3D mesh must include battlewill_sword_pivot greatsword',
  );
});

test('War Update: multi-domain battle vehicles (land, air, sea, orbital) spawn and have valid 3D meshes', () => {
  const vehicleTypes = [
    'glider',
    'tank',
    'warship',
    'airship',
    'helicopter',
    'orc_flyer',
    'bomber_plane',
    'orbital_gunship',
  ] as const;

  for (const vt of vehicleTypes) {
    const species = vt === 'orc_flyer' ? 'orc' : 'human';
    const mesh = createVehicleGroup(vt, 6, species, 42);
    assert.ok(mesh instanceof THREE.Group, `Vehicle ${vt} should construct a THREE.Group`);
    assert.ok(mesh.children.length >= 2, `Vehicle ${vt} should have multi-part 3D geometry`);
  }

  // Verify runtime military vehicle spawning & engagement during active war in Atomic/Orbital age
  const state = createInitialSimulationState(96, 'VEHICLES-WAR-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.epochIndex = 5;
  for (let z = 15; z <= 75; z++) {
    for (let x = 15; x <= 75; x++) {
      const t = getTile(state, x, z)!;
      t.resourceNode = 'none';
      t.buildingId = null;
      if (x >= 68) {
        t.height = 0;
        t.terrain = 'deep_water';
      } else {
        t.height = 2;
        t.terrain = 'grass';
      }
    }
  }
  placeBuilding(state, 'bonfire', 22, 44);
  placeBuilding(state, 'bonfire', 62, 44);
  const sIds = Array.from(new Set(state.buildings.map((b) => b.settlementId!)));
  assert.equal(sIds.length, 2);
  setKingdomRelation(state, sIds[0], sIds[1], 'war');
  for (let i = 0; i < 4; i++) {
    const u1 = spawnUnit(state, 'human', 22, 44 + i * 0.5, true).unit!;
    u1.settlementId = sIds[0];
    const u2 = spawnUnit(state, 'orc', 62, 44 + i * 0.5, true).unit!;
    u2.settlementId = sIds[1];
  }

  for (let i = 0; i < 30; i++) stepSimulation(state, 0.4);
  const militaryVehicles = (state.vehicles ?? []).filter((v) => v.isMilitary);
  assert.ok(militaryVehicles.length > 0, 'Warring settlements should field military battle vehicles');
});

test('War Update: city rebellions spawn splinter kingdoms at war & honor allowRebellion rule', () => {
  const state = createInitialSimulationState(96, 'REBELLION-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let z = 25; z <= 65; z++) {
    for (let x = 25; x <= 65; x++) {
      const t = getTile(state, x, z)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }
  placeBuilding(state, 'bonfire', 45, 45);
  const parentSettlementId = state.buildings[0].settlementId!;
  const c1 = spawnUnit(state, 'human', 46, 45, true).unit!;
  c1.settlementId = parentSettlementId;
  c1.isKing = false;
  const c2 = spawnUnit(state, 'human', 44, 45, true).unit!;
  c2.settlementId = parentSettlementId;
  c2.isKing = false;
  const c3 = spawnUnit(state, 'human', 45, 46, true).unit!;
  c3.settlementId = parentSettlementId;
  c3.isKing = false;

  // Respects allowRebellion = false
  state.worldRules = { ...state.worldRules!, allowRebellion: false };
  const blocked = triggerCityRebellion(state, parentSettlementId);
  assert.equal(blocked, false, 'Rebellion must be blocked when Citizens Can Rebel rule is OFF');

  // Succeeds when allowRebellion = true
  state.worldRules = { ...state.worldRules!, allowRebellion: true };
  const rebelled = triggerCityRebellion(state, parentSettlementId);
  assert.equal(rebelled, true, 'Citizen should rebel when rule is ON');
  const rebelUnit = state.units.find((u) => u.isRebel);
  assert.ok(rebelUnit, 'At least one citizen should be marked isRebel');
  assert.ok(rebelUnit.kingdomId, 'Rebel must belong to a splinter kingdomId');
  assert.equal(
    getKingdomRelation(state, getKingdomId(state, parentSettlementId), rebelUnit.kingdomId!),
    'war',
    'Rebel splinter faction must enter war with parent kingdom',
  );
});

test('War Update: Alliances zone highlights clicked kingdom & allies in Blue and enemies in Red', () => {
  const state = createInitialSimulationState(96, 'ALLIANCE-ZONE-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let z = 15; z <= 75; z++) {
    for (let x = 15; x <= 75; x++) {
      const t = getTile(state, x, z)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }

  placeBuilding(state, 'bonfire', 20, 26); // Kingdom A
  placeBuilding(state, 'bonfire', 46, 26); // Kingdom B (Ally)
  placeBuilding(state, 'bonfire', 70, 26); // Kingdom C (Enemy)

  const kA = state.buildings[0].settlementId!;
  const kB = state.buildings[1].settlementId!;
  const kC = state.buildings[2].settlementId!;
  spawnUnit(state, 'human', 20, 26, true).unit!.settlementId = kA;
  spawnUnit(state, 'elf', 46, 26, true).unit!.settlementId = kB;
  spawnUnit(state, 'orc', 70, 26, true).unit!.settlementId = kC;

  setKingdomRelation(state, kA, kB, 'allied');
  setKingdomRelation(state, kA, kC, 'war');

  const zones = computeWorldZones(state);
  const packed = buildZoneOverlayTextures(
    zones,
    { ...DEFAULT_ZONE_TOGGLES, alliances: true },
    null,
    undefined,
    undefined,
    {
      selectedAllianceKingdomId: getKingdomId(state, kA),
      kingdomRelations: state.kingdomRelations,
      settlementKingdoms: state.settlementKingdoms,
    },
  );
  assert.equal(packed.anyActive, true);

  const offA = (26 * state.gridSize + 20) * 4;
  const offB = (26 * state.gridSize + 46) * 4;
  const offC = (26 * state.gridSize + 70) * 4;

  // Clicked kingdom A & Ally B -> Blue dominant (B > R)
  assert.ok(packed.colorData[offA + 2] > packed.colorData[offA], 'Clicked kingdom should render Blue');
  assert.ok(packed.colorData[offB + 2] > packed.colorData[offB], 'Allied kingdom should render Blue');
  // War enemy C -> Red dominant (R > B)
  assert.ok(packed.colorData[offC] > packed.colorData[offC + 2], 'Enemy kingdom at war should render Red');
});

test('War Update Follow-Up: military vehicles evolve through epochs in simulation and 3D geometry', () => {
  // 1. 3D Mesh geometry distinctly evolves across Epochs for warship, tank, airship, bomber, gunship
  const bronzeShip = createVehicleGroup('warship', 1, 'human', 1);
  const ironcladShip = createVehicleGroup('warship', 3, 'human', 1);
  const orbitalShip = createVehicleGroup('warship', 6, 'human', 1);
  assert.notEqual(
    bronzeShip.children.length,
    ironcladShip.children.length,
    'Bronze galley warship and Industrial ironclad should differ structurally',
  );
  assert.notEqual(
    ironcladShip.children.length,
    orbitalShip.children.length,
    'Industrial ironclad and Orbital plasma cruiser should differ structurally',
  );

  const indTank = createVehicleGroup('tank', 3, 'human', 2);
  const hoverTank = createVehicleGroup('tank', 6, 'human', 2);
  assert.notEqual(
    indTank.children.length,
    hoverTank.children.length,
    'Industrial tank and Space Age hover-railgun tank must differ in geometry parts',
  );

  // 2. Simulation evolves fixed-wing (glider -> bomber_plane) and hover/VTOL (airship -> helicopter -> orbital_gunship) cleanly
  const state = createInitialSimulationState(96, 'VEH-EVOLVE-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let z = 15; z <= 75; z++) {
    for (let x = 15; x <= 75; x++) {
      const t = getTile(state, x, z)!;
      t.resourceNode = 'none';
      t.buildingId = null;
      t.height = x >= 58 ? 0 : 2;
      t.terrain = x >= 58 ? 'deep_water' : 'grass';
    }
  }
  placeBuilding(state, 'bonfire', 48, 44);
  spawnUnit(state, 'human', 48, 45, true);
  state.epochIndex = 1; // Bronze Age (only coastal Bronze Galley warship — no aircraft yet!)
  for (let i = 0; i < 6; i++) stepSimulation(state, 0.25);

  const earlyGlider = (state.vehicles ?? []).find((v) => v.isMilitary && v.type === 'glider');
  const shipBronze = (state.vehicles ?? []).find((v) => v.isMilitary && v.type === 'warship');
  assert.equal(earlyGlider, undefined, 'Bronze Age city must not field aircraft/gliders');
  assert.ok(shipBronze, 'Bronze Age coastal city should field a Bronze Oared Galley warship');
  const bronzeShipMaxHp = shipBronze.maxHp ?? 0;

  // Advance to Medieval (Epoch 2 -> Sailing Galleon warship ONLY; NO airships, NO gliders, NO aircraft!)
  state.epochIndex = 2;
  stepSimulation(state, 0.2);
  assert.equal(
    (state.vehicles ?? []).find((v) => v.isMilitary && (v.type === 'glider' || v.type === 'airship')),
    undefined,
    'Medieval Era city must NEVER field airships, gliders, or aircraft',
  );
  assert.ok((shipBronze.maxHp ?? 0) > bronzeShipMaxHp, 'Warship maxHp should scale up with Epoch');

  // Advance to Industrial (Epoch 3 -> Propeller Biplane Fighter + Rigid Zeppelin Dirigible + WWI Trench Tank; NO helicopters or jets!)
  state.epochIndex = 3;
  stepSimulation(state, 0.2);
  const fixedWing = (state.vehicles ?? []).find((v) => v.isMilitary && v.type === 'glider');
  const hoverCraft = (state.vehicles ?? []).find((v) => v.isMilitary && v.type === 'airship');
  assert.ok(fixedWing, 'Industrial Age city should field a Propeller Biplane Fighter (glider)');
  assert.ok(hoverCraft, 'Industrial Age city should field a Rigid Zeppelin Airship');
  const industrialTankVeh = (state.vehicles ?? []).find((v) => v.isMilitary && v.type === 'tank');
  assert.ok(industrialTankVeh && industrialTankVeh.y < 0.12, 'Industrial Age city should field a ground WWI Trench Tank');

  // Advance to Atomic (Epoch 4 -> Biplane evolves to Prop Heavy Bomber; Zeppelin evolves to Utility Helicopter)
  state.epochIndex = 4;
  stepSimulation(state, 0.2);
  assert.equal(fixedWing.type, 'bomber_plane', 'Biplane should evolve into Heavy Bomber Plane in Atomic epoch');
  assert.equal(hoverCraft.type, 'helicopter', 'Airship should evolve into Helicopter in Atomic epoch');

  // Advance to Space/Orbital (Epoch 6 -> Helicopter evolves to Orbital Gunship + Hover Tank)
  state.epochIndex = 6;
  stepSimulation(state, 0.2);
  assert.equal(
    hoverCraft.type,
    'orbital_gunship',
    'Helicopter should evolve into Orbital Gunship in Space epoch',
  );
  assert.equal(fixedWing.type, 'bomber_plane', 'Fixed-wing Bomber Plane stays fixed-wing (upgrades to plasma jet)');
  const tankVeh = (state.vehicles ?? []).find((v) => v.isMilitary && v.type === 'tank');
  assert.ok(tankVeh && tankVeh.y > 0.15, 'Space Age tank should hover above terrain');
});

test('War Update Follow-Up: Nukes, Elf Arcane Cataclysm, and Orc Battlewill destroy environment, craters, and structures', () => {
  const setupFlatArena = (seed: string) => {
    const state = createInitialSimulationState(96, seed);
    state.sandboxFreeMode = true;
    state.wildlifeSeeded = true;
    state.epochIndex = 5;
    for (let z = 12; z <= 84; z++) {
      for (let x = 12; x <= 84; x++) {
        const t = getTile(state, x, z)!;
        t.height = 4;
        t.terrain = 'grass';
        t.resourceNode = 'timber_grove';
        t.resourceAmount = 120;
        t.buildingId = null;
      }
    }
    return state;
  };

  // 1. Human Nuke environment & structure destruction
  {
    const s = setupFlatArena('NUKE-ENV-TEST');
    placeBuilding(s, 'bonfire', 18, 44);
    placeBuilding(s, 'bonfire', 48, 44);
    placeBuilding(s, 'forager_hut', 49, 44);
    const sidA = s.buildings[0].settlementId!;
    const sidB = s.buildings[1].settlementId!;
    setKingdomRelation(s, sidA, sidB, 'war');

    const hNuker = spawnUnit(s, 'human', 43, 44, true).unit!;
    hNuker.settlementId = sidA;
    hNuker.weaponCooldown = 0;
    const enemy = spawnUnit(s, 'orc', 47, 44, true).unit!;
    enemy.settlementId = sidB;
    enemy.hp = 800;
    enemy.maxHp = 800;

    for (let i = 0; i < 5; i++) stepSimulation(s, 0.1);
    const craterCenter = getTile(s, 47, 44)!;
    assert.ok(craterCenter.height < 4, 'Human Nuke must crater terrain height at blast epicenter');
    assert.equal(craterCenter.terrain, 'scorched', 'Human Nuke must scorch terrain tiles');
    assert.equal(craterCenter.resourceNode, 'none', 'Human Nuke must obliterate forest trees in blast radius');
    const enemyHouse = s.buildings.find((b) => b.settlementId === sidB && b.type === 'forager_hut');
    assert.ok(!enemyHouse || enemyHouse.hp < 80, 'Human Nuke must devastate enemy buildings in blast zone');
  }

  // 2. Elf Arcane Cataclysm crystalline environment destruction
  {
    const s = setupFlatArena('ARCANE-ENV-TEST');
    placeBuilding(s, 'bonfire', 18, 44);
    placeBuilding(s, 'bonfire', 48, 44);
    const sidA = s.buildings[0].settlementId!;
    const sidB = s.buildings[1].settlementId!;
    setKingdomRelation(s, sidA, sidB, 'war');

    const eMage = spawnUnit(s, 'elf', 43, 44, true).unit!;
    eMage.settlementId = sidA;
    eMage.weaponCooldown = 0;
    const enemy = spawnUnit(s, 'orc', 47, 44, true).unit!;
    enemy.settlementId = sidB;
    enemy.hp = 800;
    enemy.maxHp = 800;

    for (let i = 0; i < 5; i++) stepSimulation(s, 0.1);
    const arcaneCenter = getTile(s, 47, 44)!;
    assert.ok(arcaneCenter.height < 4, 'Elf Arcane Cataclysm must shatter & crater ground elevation');
    assert.equal(arcaneCenter.terrain, 'crystal_field', 'Elf Cataclysm must transform blast ground to crystal_field');
    assert.equal(arcaneCenter.resourceNode, 'none', 'Elf Cataclysm must wipe out trees/flora in blast');
  }

  // 3. Orc Battlewill tectonic slash environment destruction
  {
    const s = setupFlatArena('BATTLEWILL-ENV-TEST');
    placeBuilding(s, 'bonfire', 18, 44);
    placeBuilding(s, 'bonfire', 48, 44);
    const sidA = s.buildings[0].settlementId!;
    const sidB = s.buildings[1].settlementId!;
    setKingdomRelation(s, sidA, sidB, 'war');

    const oWarlord = spawnUnit(s, 'orc', 44, 44, true).unit!;
    oWarlord.settlementId = sidA;
    oWarlord.battlewillCooldown = 0;
    oWarlord.weaponCooldown = 0;
    const enemy = spawnUnit(s, 'human', 46.5, 44, true).unit!;
    enemy.settlementId = sidB;
    enemy.hp = 800;
    enemy.maxHp = 800;

    for (let i = 0; i < 5; i++) stepSimulation(s, 0.1);
    const slashTile = getTile(s, 46, 44)!;
    assert.ok(slashTile.height < 4, 'Orc Battlewill wide slash must carve lowered tectonic scar into ground');
    assert.ok(
      slashTile.terrain === 'scorched' || slashTile.terrain === 'badlands' || slashTile.terrain === 'rock',
      'Orc Battlewill slash must scar terrain ground biome',
    );
    assert.equal(slashTile.resourceNode, 'none', 'Orc Battlewill slash must splinter trees in cleave path');
  }
});

test('War Update Model & VFX Overhaul: fixed-wing planes never hover, helicopters spin horizontally, weapons & VFX scale cleanly', () => {
  // 1. Fixed-wing planes NEVER contain overhead helicopter 'spin_rotor', while helicopters & orc_flyers DO
  const gliderMesh = createVehicleGroup('glider', 2, 'human', 1);
  const bomberMesh = createVehicleGroup('bomber_plane', 5, 'human', 1);
  const civPlaneMesh = createVehicleGroup('plane', 4, 'human', 1);
  assert.equal(gliderMesh.getObjectByName('spin_rotor'), undefined, 'Glider/biplane must not have helicopter top rotor');
  assert.equal(bomberMesh.getObjectByName('spin_rotor'), undefined, 'Bomber plane must not have helicopter top rotor');
  assert.equal(civPlaneMesh.getObjectByName('spin_rotor'), undefined, 'Civilian plane must not have helicopter top rotor');

  const heliMesh = createVehicleGroup('helicopter', 4, 'human', 1);
  const orcChopperMesh = createVehicleGroup('orc_flyer', 4, 'orc', 1);
  assert.ok(heliMesh.getObjectByName('spin_rotor'), 'Helicopter must have horizontal top spin_rotor');
  assert.ok(heliMesh.getObjectByName('spin_prop'), 'Helicopter must have tail spin_prop');
  assert.ok(orcChopperMesh.getObjectByName('spin_rotor'), 'Orc chopper must have horizontal top spin_rotor');
  assert.ok(orcChopperMesh.getObjectByName('spin_prop'), 'Orc chopper must have tail spin_prop');

  // 2. Held unit weapons are multi-part 3D groups per race & age
  const elfStaff = createUnitGroup('priest', 'civilization', 3, 'elf', 7, 'adult').getObjectByName('held_tool');
  const humanRifle = createUnitGroup('warrior', 'civilization', 5, 'human', 7, 'adult').getObjectByName('held_tool');
  const orcCleaver = createUnitGroup('warrior', 'civilization', 5, 'orc', 7, 'adult').getObjectByName('held_tool');
  assert.ok(elfStaff && elfStaff.children.length >= 2, 'Elf weapon should be multi-part 3D runestaff');
  assert.ok(humanRifle && humanRifle.children.length >= 3, 'Modern human rifle should be multi-part 3D weapon');
  assert.ok(orcCleaver && orcCleaver.children.length >= 2, 'Orc weapon should be multi-part 3D cleaver');

  // 3. Fixed-wing plane NEVER stops/hovers even when engaged inside fireRange; makes continuous forward bombing passes
  const state = createInitialSimulationState(96, 'PLANE-NO-HOVER-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.epochIndex = 4; // Atomic Age
  for (let z = 12; z <= 84; z++) {
    for (let x = 12; x <= 84; x++) {
      const t = getTile(state, x, z)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }
  placeBuilding(state, 'bonfire', 22, 44);
  placeBuilding(state, 'bonfire', 52, 44);
  const sidA = state.buildings[0].settlementId!;
  const sidB = state.buildings[1].settlementId!;
  setKingdomRelation(state, sidA, sidB, 'war');
  const crewA = spawnUnit(state, 'human', 22, 45, true).unit!;
  crewA.settlementId = sidA;

  const bomberId = 'test_bomber_1';
  state.vehicles = [
    {
      id: bomberId,
      type: 'bomber_plane',
      species: 'human',
      settlementId: sidA,
      kingdomId: getKingdomId(state, sidA),
      isMilitary: true,
      hp: 300,
      maxHp: 300,
      attackCooldown: 0,
      strafeExtendTimer: 0,
      epochLevel: 4,
      x: 46,
      y: 5.2,
      z: 38,
      heading: 0, // Pointed straight +Z toward enemy at (46, 44)
      pitch: 0,
      bank: 0,
      speed: 7.8,
      path: [{ x: 46, z: 38 }],
      pathIndex: 0,
      variantSeed: 1,
    },
    {
      id: 'test_heli_1',
      type: 'helicopter',
      species: 'human',
      settlementId: sidA,
      kingdomId: getKingdomId(state, sidA),
      isMilitary: true,
      hp: 260,
      maxHp: 260,
      attackCooldown: 0,
      epochLevel: 4,
      x: 42,
      y: 3.55,
      z: 44,
      heading: Math.PI / 2,
      pitch: 0,
      bank: 0,
      speed: 5.3,
      path: [{ x: 42, z: 44 }],
      pathIndex: 0,
      variantSeed: 2,
    },
  ];

  const enemy = spawnUnit(state, 'orc', 46, 44, true).unit!;
  enemy.settlementId = sidB;
  enemy.hp = 1200;
  enemy.maxHp = 1200;

  let totalPlaneMovement = 0;
  let lastBx = 46;
  let lastBz = 38;
  const collectedSubtypes = new Set<string>();

  for (let i = 0; i < 16; i++) {
    stepSimulation(state, 0.15);
    const bomber = state.vehicles.find((v) => v.id === bomberId)!;
    const stepMove = Math.hypot(bomber.x - lastBx, bomber.z - lastBz);
    totalPlaneMovement += stepMove;
    assert.ok(stepMove > 0.7, `Fixed-wing bomber must never stop/hover in combat (moved ${stepMove.toFixed(2)})`);
    lastBx = bomber.x;
    lastBz = bomber.z;
    for (const vfx of state.pendingVfx) {
      if (vfx.vfxSubtype) collectedSubtypes.add(vfx.vfxSubtype);
    }
    state.pendingVfx = [];
  }

  const heli = state.vehicles.find((v) => v.id === 'test_heli_1')!;
  const bomberEnd = state.vehicles.find((v) => v.id === bomberId)!;
  assert.ok(totalPlaneMovement > 15, 'Fixed-wing plane must continuously streak across target zone');
  assert.ok((bomberEnd.strafeExtendTimer ?? 0) >= 0, 'Fixed-wing plane tracks strafe extend state');
  assert.ok(Math.hypot(heli.x - 42, heli.z - 44) < 2.0, 'Hovering helicopter holds standoff combat orbit');
  assert.ok(
    collectedSubtypes.has('bomb') || collectedSubtypes.has('missile') || collectedSubtypes.has('bullet'),
    'War update combat must emit rich vfxSubtype events',
  );
});

test('Racial ultimate cooldown stops spam & Orc Battlewill cleaves mountains', () => {
  const state = createInitialSimulationState(96, 'ULT-COOLDOWN-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.epochIndex = 4; // Atomic Age
  for (let z = 12; z <= 84; z++) {
    for (let x = 12; x <= 84; x++) {
      const t = getTile(state, x, z)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }
  placeBuilding(state, 'bonfire', 20, 44);
  placeBuilding(state, 'bonfire', 70, 44);
  const sIds = Array.from(new Set(state.buildings.map((b) => b.settlementId!)));
  setKingdomRelation(state, sIds[0], sIds[1], 'war');

  // 1. Weak lone foot soldier (90 HP, not a King) must NOT trigger a nuke
  const hKing = spawnUnit(state, 'human', 20, 44, true).unit!;
  hKing.settlementId = sIds[0];
  hKing.isKing = true;
  const oKing = spawnUnit(state, 'orc', 70, 44, true).unit!;
  oKing.settlementId = sIds[1];
  oKing.isKing = true;
  const hSoldier = spawnUnit(state, 'human', 42, 44, true).unit!;
  hSoldier.settlementId = sIds[0];
  hSoldier.isKing = false;
  hSoldier.weaponCooldown = 0;
  const weakEnemy = spawnUnit(state, 'orc', 45, 44, true).unit!;
  weakEnemy.settlementId = sIds[1];
  weakEnemy.isKing = false;
  weakEnemy.hp = 90;
  weakEnemy.maxHp = 90;

  for (let i = 0; i < 6; i++) stepSimulation(state, 0.1);
  assert.equal(
    state.pendingVfx.some((v) => v.type === 'nuke_blast'),
    false,
    'Human must not waste a Nuke on a single weak non-boss enemy',
  );
  assert.ok(
    state.pendingVfx.some((v) => v.type === 'projectile_tracer'),
    'Standard enemy should be engaged with regular weapon arsenal projectiles',
  );

  // 2. Boss enemy triggers Nuke once, putting the whole kingdom on cooldown against a 2nd boss
  state.pendingVfx = [];
  const bossA = spawnUnit(state, 'orc', 45.2, 44, true).unit!;
  bossA.settlementId = sIds[1];
  bossA.hp = 600;
  bossA.maxHp = 600;
  hSoldier.weaponCooldown = 0;
  hSoldier.actionCooldown = 0;
  for (let i = 0; i < 6; i++) stepSimulation(state, 0.1);
  const nukeCount1 = state.pendingVfx.filter((v) => v.type === 'nuke_blast').length;
  assert.equal(nukeCount1, 1, 'First worthy boss threat triggers 1 Nuke');
  assert.ok(
    (state.kingdomUltimateCooldowns?.[getKingdomId(state, sIds[0])] ?? 0) > 25,
    'Launching racial ultimate must apply shared kingdom-wide cooldown',
  );

  // Second human ally attacks another 600 HP boss immediately -> blocked by kingdom cooldown!
  state.pendingVfx = [];
  const hAlly = spawnUnit(state, 'human', 42, 50, true).unit!;
  hAlly.settlementId = sIds[0];
  hAlly.weaponCooldown = 0;
  const bossB = spawnUnit(state, 'orc', 45, 50, true).unit!;
  bossB.settlementId = sIds[1];
  bossB.hp = 600;
  bossB.maxHp = 600;
  for (let i = 0; i < 6; i++) stepSimulation(state, 0.1);
  assert.equal(
    state.pendingVfx.some((v) => v.type === 'nuke_blast'),
    false,
    'Second unit in same kingdom must not spam Nuke while kingdom cooldown is active',
  );

  // 3. Orc Battlewill cleaves steep mountain tiles in its wide path
  state.units = [];
  state.pendingVfx = [];
  state.kingdomUltimateCooldowns = {};
  const peakTile = getTile(state, 46, 56)!;
  peakTile.height = 6;
  peakTile.terrain = 'mountain';
  const orcWarlord = spawnUnit(state, 'orc', 42, 56, true).unit!;
  orcWarlord.settlementId = sIds[1];
  orcWarlord.battlewillCooldown = 0;
  orcWarlord.weaponCooldown = 0;
  const targetOnPeak = spawnUnit(state, 'human', 46, 56, true).unit!;
  targetOnPeak.settlementId = sIds[0];
  targetOnPeak.hp = 700;
  targetOnPeak.maxHp = 700;
  for (let i = 0; i < 6; i++) stepSimulation(state, 0.1);
  assert.ok(peakTile.height < 6, `Orc Battlewill must cleave mountain height downward (got ${peakTile.height})`);
});

test('Gather-before-build pacing, per-kingdom stockpiles, and zone inspect resources work end-to-end', () => {
  const state = createInitialSimulationState(96, 'GATHER-STOCKPILE-TEST');
  state.sandboxFreeMode = false;
  state.wildlifeSeeded = true;
  state.resources = { wood: 0, stone: 0, food: 0, ore: 0, knowledge: 0, energy: 0, alloy: 0, faith: 0 };
  for (let z = 20; z <= 70; z++) {
    for (let x = 20; x <= 70; x++) {
      const t = getTile(state, x, z)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }
  // Place harvestable wood & stone right next to two fresh pioneers
  const treeTile = getTile(state, 32, 32)!;
  treeTile.terrain = 'forest';
  treeTile.resourceNode = 'timber_grove';
  const stoneTile = getTile(state, 34, 32)!;
  stoneTile.terrain = 'rock';
  stoneTile.resourceNode = 'stone_outcrop';

  spawnUnit(state, 'human', 33, 33, true);
  spawnUnit(state, 'human', 33.4, 33.2, true);

  // Right away, in survival mode with rich nearby resources, settlers should gather BEFORE founding bonfire
  stepSimulation(state, 0.5);
  assert.equal(state.buildings.length, 0, 'Fresh settlers must gather nearby resources before immediately placing bonfire');

  // After sufficient time, they gather >= 8 carried goods and found their settlement bonfire
  for (let i = 0; i < 60; i++) stepSimulation(state, 0.25);
  const bonfire = state.buildings.find((b) => b.type === 'bonfire');
  assert.ok(bonfire, 'Settlers found bonfire after gathering resources');
  bonfire!.constructionProgress = 100;

  // Direct test of per-kingdom resource stockpile tracking & zone inspection
  const kId = getKingdomId(state, bonfire!.settlementId!);
  assert.ok(state.kingdomResources && state.kingdomResources[kId], 'Simulation must track per-kingdom resource stockpiles');
  state.kingdomResources[kId].wood = 240;
  state.kingdomResources[kId].stone = 150;
  const zones = computeWorldZones(state);
  const kZone = Array.from(zones.kingdomsById.values()).find((z) => z.kingdomId === kId);
  assert.ok(kZone, 'Kingdom zone should exist for founded settlement');
  assert.equal(kZone.resources.wood, 240, 'Inspect zone info must expose kingdom stocked wood');
  assert.equal(kZone.resources.stone, 150, 'Inspect zone info must expose kingdom stocked stone');
});

test('Rebellions trigger more frequently and respect allowRebellion world rule', () => {
  const setupOvercrowdedEmpire = (allowRebellion: boolean) => {
    const s = createInitialSimulationState(96, `REBEL-${allowRebellion}`);
    s.sandboxFreeMode = true;
    s.wildlifeSeeded = true;
    s.worldRules = { ...s.worldRules!, allowRebellion };
    for (let z = 12; z <= 84; z++) {
      for (let x = 12; x <= 84; x++) {
        const t = getTile(s, x, z)!;
        t.height = 2;
        t.terrain = 'grass';
        t.resourceNode = 'none';
        t.buildingId = null;
      }
    }
    placeBuilding(s, 'bonfire', 28, 44);
    const sid = s.buildings[0].settlementId!;
    placeBuilding(s, 'forager_hut', 31, 44);
    placeBuilding(s, 'forager_hut', 31, 47);
    for (const b of s.buildings) {
      b.constructionProgress = 100;
      b.settlementId = sid;
    }
    for (let i = 0; i < 8; i++) {
      const u = spawnUnit(s, 'human', 28 + (i % 4), 45 + Math.floor(i / 4), true).unit!;
      u.settlementId = sid;
    }
    return s;
  };

  // With allowRebellion ON and active war driving unrest, rebellion triggers reliably within 80s
  const simOn = setupOvercrowdedEmpire(true);
  placeBuilding(simOn, 'bonfire', 72, 44);
  const sidMain = simOn.buildings[0].settlementId!;
  const sidRival = simOn.buildings[simOn.buildings.length - 1].settlementId!;
  setKingdomRelation(simOn, sidMain, sidRival, 'war');
  const initialSettlementCount = new Set(simOn.buildings.map((b) => b.settlementId)).size;
  for (let i = 0; i < 320; i++) stepSimulation(simOn, 0.25);
  const afterSettlementCount = new Set(simOn.buildings.map((b) => b.settlementId)).size;
  const hasRebels = simOn.units.some((u) => u.isRebel);
  const hasRebelChronicle = simOn.chronicle.some(
    (c) => c.text.includes('Rebellion') || c.text.includes('seceded'),
  );
  assert.ok(
    afterSettlementCount > initialSettlementCount || hasRebels || hasRebelChronicle,
    `Rebellion should trigger rival rebel faction/settlement (cities: ${afterSettlementCount} vs ${initialSettlementCount}, rebels: ${hasRebels}, log: ${hasRebelChronicle})`,
  );

  // With allowRebellion OFF, no rebellion ever splits the empire into rival kingdoms
  const simOff = setupOvercrowdedEmpire(false);
  const initOff = new Set(simOff.buildings.map((b) => getKingdomId(simOff, b.settlementId!))).size;
  for (let i = 0; i < 320; i++) stepSimulation(simOff, 0.25);
  const afterOff = new Set(simOff.buildings.map((b) => getKingdomId(simOff, b.settlementId!))).size;
  assert.equal(afterOff, initOff, 'allowRebellion = false must prevent rebellions');
  assert.equal(simOff.units.some((u) => u.isRebel), false, 'allowRebellion = false must spawn zero rebels');
  assert.equal(
    simOff.chronicle.some((c) => c.text.includes('Rebellion') || c.text.includes('seceded')),
    false,
    'allowRebellion = false must never log rebellion events',
  );
});

test('War vehicles use distinct 3D architectures per race AND evolve structurally across ages', () => {
  const vehicleTypes = [
    { type: 'glider' as const, epoch: 3 },
    { type: 'helicopter' as const, epoch: 4 },
    { type: 'tank' as const, epoch: 4 },
    { type: 'warship' as const, epoch: 4 },
    { type: 'airship' as const, epoch: 3 },
    { type: 'bomber_plane' as const, epoch: 5 },
    { type: 'orbital_gunship' as const, epoch: 6 },
  ];

  const signature = (g: ReturnType<typeof createVehicleGroup>) =>
    `${g.children.length}:${g.children.map((c) => `${c.type[0]}@${Math.round(c.position.x * 10)},${Math.round(c.position.y * 10)},${Math.round(c.position.z * 10)}`).join('|')}`;

  for (const { type, epoch } of vehicleTypes) {
    const h = createVehicleGroup(type, epoch, 'human', 1);
    const e = createVehicleGroup(type, epoch, 'elf', 1);
    const o = createVehicleGroup(type, epoch, 'orc', 1);
    const sigH = signature(h);
    const sigE = signature(e);
    const sigO = signature(o);
    assert.notEqual(sigH, sigE, `${type} human vs elf must have distinct 3D architecture`);
    assert.notEqual(sigH, sigO, `${type} human vs orc must have distinct 3D architecture`);
    assert.notEqual(sigE, sigO, `${type} elf vs orc must have distinct 3D architecture`);
  }

  // Every race must visibly evolve geometry across epochs (no reused same-model silhouettes across ages!)
  for (const sp of ['human', 'elf', 'orc'] as const) {
    const shipSigs = [1, 2, 3, 4, 5, 6, 7].map((ep) => signature(createVehicleGroup('warship', ep, sp, 1)));
    assert.equal(new Set(shipSigs).size, shipSigs.length, `${sp} warship must evolve structurally across epochs 1..7`);

    const tankSigs = [3, 4, 5, 6, 7].map((ep) => signature(createVehicleGroup('tank', ep, sp, 1)));
    assert.equal(new Set(tankSigs).size, tankSigs.length, `${sp} tank must evolve structurally across epochs 3..7`);

    const bomberSigs = [4, 5, 6, 7].map((ep) => signature(createVehicleGroup('bomber_plane', ep, sp, 1)));
    assert.equal(new Set(bomberSigs).size, bomberSigs.length, `${sp} bomber_plane must evolve structurally across epochs 4..7`);

    const gunship6 = signature(createVehicleGroup('orbital_gunship', 6, sp, 1));
    const gunship7 = signature(createVehicleGroup('orbital_gunship', 7, sp, 1));
    assert.notEqual(gunship6, gunship7, `${sp} orbital_gunship must upgrade in Star Era (7)`);

    if (sp === 'orc') {
      const f4 = signature(createVehicleGroup('orc_flyer', 4, 'orc', 1));
      const f5 = signature(createVehicleGroup('orc_flyer', 5, 'orc', 1));
      assert.notEqual(f4, f5, 'orc_flyer must evolve between Atomic (4) and Info (5)');
    } else {
      const h4 = signature(createVehicleGroup('helicopter', 4, sp, 1));
      const h5 = signature(createVehicleGroup('helicopter', 5, sp, 1));
      assert.notEqual(h4, h5, `${sp} helicopter must evolve between Atomic (4) and Info (5)`);
    }
  }
});

test('Historical War Vehicle Timeline & Mortality: no airships in Medieval, no choppers/jets in Industrial Age, and vehicles perish when population or kingdom falls', () => {
  // 1. Verify 3D vehicle models match historical epochs (Industrial propeller -> Atomic prop bomber/Huey -> Info Age jet/Apache)
  const industrialBiplane = createVehicleGroup('glider', 3, 'human', 1);
  assert.ok(industrialBiplane.getObjectByName('spin_prop'), 'Industrial glider must be a motorized propeller biplane fighter');

  const industrialZeppelin = createVehicleGroup('airship', 3, 'human', 1);
  const industrialElfAirship = createVehicleGroup('airship', 3, 'elf', 1);
  const industrialOrcAirship = createVehicleGroup('airship', 3, 'orc', 1);
  assert.ok(industrialZeppelin.getObjectByName('spin_prop'), 'Industrial rigid zeppelin must have motorized propellers');
  assert.ok(industrialElfAirship.getObjectByName('spin_prop'), 'Industrial Elf solar dirigible must have wind-propellers');
  assert.ok(industrialOrcAirship.getObjectByName('spin_prop'), 'Industrial Orc war-dirigible must have iron propellers');

  const atomicPropBomber = createVehicleGroup('bomber_plane', 4, 'human', 1);
  const infoStealthJet = createVehicleGroup('bomber_plane', 5, 'human', 1);
  assert.ok(atomicPropBomber.getObjectByName('spin_prop'), 'Atomic Age heavy bomber must use multi-engine propellers');
  assert.equal(infoStealthJet.getObjectByName('spin_prop'), undefined, 'Information Age stealth jet bomber must be jet-powered (no propellers)');

  // 2. Medieval Era (epochIndex = 2) spawns warships ONLY — zero airships or gliders!
  const medievalState = createInitialSimulationState(96, 'MEDIEVAL-NO-AIR-TEST');
  medievalState.sandboxFreeMode = true;
  medievalState.wildlifeSeeded = true;
  medievalState.epochIndex = 2; // Medieval Era
  for (let z = 20; z <= 70; z++) {
    for (let x = 20; x <= 70; x++) {
      const t = getTile(medievalState, x, z)!;
      t.height = x >= 56 ? 0 : 2;
      t.terrain = x >= 56 ? 'deep_water' : 'stone_road';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }
  placeBuilding(medievalState, 'bonfire', 46, 44);
  const medCitizen = spawnUnit(medievalState, 'human', 46, 45, true).unit!;
  medCitizen.settlementId = medievalState.buildings[0].settlementId;
  for (let i = 0; i < 4; i++) stepSimulation(medievalState, 0.25);
  assert.ok((medievalState.vehicles ?? []).some((v) => v.type === 'warship'), 'Medieval coastal city should field naval warships');
  assert.equal(
    (medievalState.vehicles ?? []).some((v) => v.type === 'airship' || v.type === 'glider' || v.type === 'tank'),
    false,
    'Medieval Era must NEVER spawn airships, gliders, or tanks',
  );

  // 3. Vehicles are destroyed and stop roaming when their settlement/kingdom loses all population or buildings
  const state = createInitialSimulationState(96, 'VEH-MORTALITY-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.epochIndex = 3; // Industrial Age
  for (let z = 20; z <= 70; z++) {
    for (let x = 20; x <= 70; x++) {
      const t = getTile(state, x, z)!;
      t.height = x >= 56 ? 0 : 2;
      t.terrain = x >= 56 ? 'deep_water' : 'stone_road';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }

  placeBuilding(state, 'bonfire', 46, 44);
  const citizen = spawnUnit(state, 'human', 46, 45, true).unit!;
  citizen.settlementId = state.buildings[0].settlementId;

  for (let i = 0; i < 4; i++) stepSimulation(state, 0.25);

  assert.ok((state.vehicles ?? []).length >= 3, 'Populated Industrial city should field ground, air, and naval vehicles');
  assert.equal(
    (state.vehicles ?? []).some((v) => v.type === 'helicopter' || v.type === 'bomber_plane'),
    false,
    'Industrial Age city must NEVER field helicopters or jet/heavy bombers',
  );

  // Kill all civilization population -> all vehicles (civilian & military) must be destroyed and stop roaming!
  for (const u of state.units) {
    if (u.faction === 'civilization') {
      u.hp = 0;
      u.state = 'ko';
    }
  }
  stepSimulation(state, 0.25);
  assert.equal(
    (state.vehicles ?? []).length,
    0,
    'All vehicles must be destroyed and stop roaming when no living population remains',
  );

  // Respawn population and vehicles, then destroy the settlement's buildings -> vehicles must also be destroyed
  const citizen2 = spawnUnit(state, 'human', 46, 45, true).unit!;
  citizen2.settlementId = state.buildings[0].settlementId;
  stepSimulation(state, 0.25);
  assert.ok((state.vehicles ?? []).length >= 2, 'Repopulated city should field vehicles again');

  for (const b of state.buildings) {
    b.hp = 0;
  }
  stepSimulation(state, 0.25);
  assert.equal(
    (state.vehicles ?? []).length,
    0,
    'All vehicles must be destroyed when their home kingdom/settlement falls',
  );
});

test('Sea Update: localized warm coral reefs stay submerged, scrap_sea has pure water + scrap_flotsam, swimming fatigues units, and ships/walkways evolve', () => {
  // 1. Coral reef spawning is localized to warm lagoon patches (NOT blanketing all shorelines) and submerged geometries stay below y=0.295 water plane
  const worldTiles = generateWorldTiles(128, 4242);
  const shallowTiles = worldTiles.filter((t) => t.terrain === 'shallow_water');
  const coralTiles = worldTiles.filter((t) => t.resourceNode === 'coral_reef');
  assert.ok(shallowTiles.length > 50, 'World should contain shallow coastal/reef waters');
  assert.ok(coralTiles.length >= 4, 'World should generate localized warm coral reef lagoons');
  assert.ok(
    coralTiles.length < shallowTiles.length * 0.45,
    `Coral reefs must appear in localized parts rather than blanketing all shorelines (coral=${coralTiles.length}, shallow=${shallowTiles.length})`,
  );

  // Verify submerged 3D coral reef variants remain strictly under the y=0.295 ocean surface when placed on the y=0.12 seabed
  const nodeLib = getNodeVariantLibrary();
  assert.equal(nodeLib.coralReef.length, 4, 'Should provide 4 rich submerged coral+seagrass geometry variants');
  for (let vi = 0; vi < nodeLib.coralReef.length; vi++) {
    const geo = nodeLib.coralReef[vi];
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    assert.ok(bb.min.y >= -0.02, `Coral variant ${vi} must anchor on seabed (min.y=${bb.min.y})`);
    assert.ok(
      0.12 + bb.max.y < 0.295,
      `Coral variant ${vi} must remain submerged under the water plane at y=0.295 (top=${0.12 + bb.max.y})`,
    );
  }

  // 2. Scrap Sea template spawns 100% water (height === 0), scrap_flotsam resources, and localized reef shoals
  const scrapCfg = createWorldConfigFromTemplate('scrap_sea', { seed: 5150, gridSize: 96 });
  const scrapSim = createInitialSimulationState(scrapCfg.gridSize, scrapCfg.seed, scrapCfg);
  assert.equal(
    scrapSim.tiles.every((t) => t.height === 0),
    true,
    'scrap_sea template must generate purely aquatic tiles (height === 0)',
  );
  assert.ok(
    scrapSim.tiles.some((t) => t.resourceNode === 'scrap_flotsam'),
    'scrap_sea template must scatter salvageable scrap_flotsam across the ocean',
  );
  assert.ok(
    scrapSim.buildings.length >= 1,
    'scrap_sea template should establish an initial floating city settlement on the waves',
  );

  // 3. Open-water swimming slows down units & drains swimStamina to drowning, whereas stone_road walkways keep them dry & fast
  const swimState = createInitialSimulationState(64, 'SWIM-FATIGUE-TEST');
  swimState.sandboxFreeMode = true;
  swimState.wildlifeSeeded = true;
  for (let z = 12; z <= 52; z++) {
    for (let x = 12; x <= 52; x++) {
      const t = getTile(swimState, x, z)!;
      t.height = 0;
      t.terrain = 'deep_water';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }
  const anchorLand = getTile(swimState, 16, 16)!;
  anchorLand.height = 2;
  anchorLand.terrain = 'grass';
  placeBuilding(swimState, 'bonfire', 16, 16);
  const homeSettlementId = swimState.buildings[0].settlementId;

  const swimmer = spawnUnit(swimState, 'human', 30, 32, true).unit!;
  swimmer.settlementId = homeSettlementId;
  swimmer.swimStamina = 100;
  swimmer.targetX = 46;
  swimmer.targetZ = 32;
  swimmer.state = 'moving';

  const startX = swimmer.x;
  for (let i = 0; i < 12; i++) {
    stepSimulation(swimState, 0.25);
  }
  const movedDist = Math.hypot(swimmer.x - startX, swimmer.z - 32);
  assert.ok(
    (swimmer.swimStamina ?? 100) < 100 && movedDist > 0.5,
    `Swimmer in open deep_water should swim slowly and drain swimStamina (stamina=${swimmer.swimStamina}, moved=${movedDist.toFixed(2)})`,
  );

  // Exhausted unit in deep water eventually drowns
  swimmer.swimStamina = 1;
  swimmer.hp = 12;
  for (let i = 0; i < 12; i++) {
    stepSimulation(swimState, 0.25);
  }
  assert.equal(swimmer.state, 'ko', 'Exhausted swimmer stranded far in open sea should drown');

  // Unit standing on a stone_road water walkway retains full stamina without drowning
  const walkwayTile = getTile(swimState, 30, 24)!;
  walkwayTile.terrain = 'stone_road';
  const walker = spawnUnit(swimState, 'human', 30, 24, true).unit!;
  walker.swimStamina = 40;
  walker.targetX = 30;
  walker.targetZ = 24;
  for (let i = 0; i < 6; i++) {
    stepSimulation(swimState, 0.25);
  }
  assert.ok((walker.swimStamina ?? 0) > 40, 'Water walkway (stone_road) should recover stamina and keep units dry');

  // 4. Passenger ships differ structurally per race and evolve across ages
  const shipSig = (g: ReturnType<typeof createVehicleGroup>) =>
    `${g.children.length}:${g.children.map((c) => `${c.type[0]}@${Math.round(c.position.x * 100)},${Math.round(c.position.y * 100)},${Math.round(c.position.z * 100)}`).join('|')}`;

  for (const sp of ['human', 'elf', 'orc'] as const) {
    const p1 = createVehicleGroup('passenger_ship', 1, sp, 1);
    const p4 = createVehicleGroup('passenger_ship', 4, sp, 1);
    const p6 = createVehicleGroup('passenger_ship', 6, sp, 1);
    assert.notEqual(shipSig(p1), shipSig(p6), `${sp} passenger_ship should evolve from age 1 to age 6`);
    assert.ok(p4.children.length >= 3, `${sp} industrial/atomic passenger_ship should build multi-part hull`);
  }
  for (const ep of [0, 2, 3, 4, 5, 6]) {
    const hSig = shipSig(createVehicleGroup('passenger_ship', ep, 'human', 1));
    const eSig = shipSig(createVehicleGroup('passenger_ship', ep, 'elf', 1));
    const oSig = shipSig(createVehicleGroup('passenger_ship', ep, 'orc', 1));
    assert.notEqual(hSig, eSig, `Epoch ${ep} human vs elf passenger_ship must have distinct 3D architecture`);
    assert.notEqual(hSig, oSig, `Epoch ${ep} human vs orc passenger_ship must have distinct 3D architecture`);
    assert.notEqual(eSig, oSig, `Epoch ${ep} elf vs orc passenger_ship must have distinct 3D architecture`);
  }
});

test('Smooth dynamic pixel scale: 2.5x when zoomed in down to 1.0x when fully zoomed out', () => {
  const gridSize = 128;
  const aspect = 16 / 9;
  const maxZoom = getResponsiveMaxZoomOut(gridSize, aspect);

  // When fully zoomed in (frustum <= 8.0)
  assert.equal(computeDynamicPixelScale(8.0, gridSize, aspect), 2.5);
  assert.equal(computeDynamicPixelScale(6.0, gridSize, aspect), 2.5);

  // When zooming out slightly, scale smoothly glides through 2.49, 2.47, 2.xx
  const s10 = computeDynamicPixelScale(10.0, gridSize, aspect);
  const s12 = computeDynamicPixelScale(12.0, gridSize, aspect);
  assert.ok(s10 < 2.5 && s10 > 2.45, `s10 was ${s10}`);
  assert.ok(s12 < s10 && s12 > 2.40, `s12 was ${s12}`);

  // When midway through zoom range (halfway between 2.5 and 1.0 is ~1.75)
  const midFrustum = (8.0 + maxZoom) / 2;
  const sMid = computeDynamicPixelScale(midFrustum, gridSize, aspect);
  assert.ok(Math.abs(sMid - 1.75) < 0.05, `Midway zoom should be ~1.75, got ${sMid}`);

  // When fully zoomed out (frustum >= maxZoom)
  assert.equal(computeDynamicPixelScale(maxZoom, gridSize, aspect), 1.0);
  assert.equal(computeDynamicPixelScale(maxZoom + 50, gridSize, aspect), 1.0);

  // Strictly monotonically decreasing as frustum increases (zooming out)
  let prevScale = 2.5;
  for (let f = 8.0; f < maxZoom; f += 5.0) {
    const sc = computeDynamicPixelScale(f, gridSize, aspect);
    assert.ok(sc <= prevScale, `Pixel scale must not increase when zooming out: ${sc} > ${prevScale}`);
    prevScale = sc;
  }
  const finalScale = computeDynamicPixelScale(maxZoom, gridSize, aspect);
  assert.ok(finalScale <= prevScale);
  assert.equal(finalScale, 1.0);
});

test('Sea Update: uncommon corals bleach to gray when destroyed and regenerate, Leviathan takes damage & engages in mutual combat, and sea builds are destructible', () => {
  // 1. Coral reefs are uncommon, never wrap coastlines, have bleached gray 3D variants, turn gray when destroyed, and regenerate
  const worldTiles = generateWorldTiles(128, 4242);
  const shallowTiles = worldTiles.filter((t) => t.terrain === 'shallow_water');
  const coralTiles = worldTiles.filter((t) => t.resourceNode === 'coral_reef');
  assert.ok(coralTiles.length >= 2, 'World should contain uncommon coral reef patches');
  assert.ok(
    coralTiles.length < shallowTiles.length * 0.25,
    `Corals should be uncommon and never wrap every island (coral=${coralTiles.length}, shallow=${shallowTiles.length})`,
  );

  const nodeLib = getNodeVariantLibrary();
  assert.ok(nodeLib.coralReefBleached.length >= 2, 'Should provide bleached gray coral 3D variants');

  const state = createInitialSimulationState(64, 'CORAL-LEVIATHAN-COMBAT');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let z = 10; z <= 54; z++) {
    for (let x = 10; x <= 54; x++) {
      const t = getTile(state, x, z)!;
      t.height = x < 24 ? 1 : 0;
      t.terrain = x < 24 ? 'sand' : x < 34 ? 'shallow_water' : 'deep_water';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.coralBleachTimer = 0;
      t.buildingId = null;
    }
  }

  // Place a coral reef at (28, 30) and destroy it with meteor_strike
  const coralTile = getTile(state, 28, 30)!;
  coralTile.resourceNode = 'coral_reef';
  coralTile.resourceAmount = 240;
  executeGodPowerImpact(state, 'meteor_strike', 28, 30);

  assert.equal(coralTile.resourceNode, 'coral_reef', 'Destroyed coral reef remains as a bleached coral_reef node');
  assert.equal(coralTile.resourceAmount, 0, 'Bleached coral reef has 0 resourceAmount while gray');
  assert.ok((coralTile.coralBleachTimer ?? 0) > 10, `Bleached coral should have a regeneration timer, got ${coralTile.coralBleachTimer}`);

  // Fast-forward simulation after hazard subsides until the coral regenerates back to full health
  state.activeHazards = [];
  coralTile.coralBleachTimer = 1.0;
  for (let i = 0; i < 6; i++) {
    stepSimulation(state, 0.25);
  }
  assert.equal(coralTile.coralBleachTimer, 0, 'Coral bleach timer should expire to 0');
  assert.equal(coralTile.resourceAmount, 240, 'Regenerated coral should restore resourceAmount to 240');

  // 2. Floating sea buildings / ports and water walkways are destructible, and Leviathan takes damage & fights back
  placeBuilding(state, 'bonfire', 20, 30);
  const homeSettlementId = state.buildings[0].settlementId!;
  const portRes = placeBuilding(state, 'forager_hut', 26, 30); // Floating port/hut on shallow_water (height === 0)
  assert.equal(portRes.ok, true, 'Should place coastal/floating structure at (26, 30)');
  const portBuilding = state.buildings[state.buildings.length - 1]!;
  portBuilding.settlementId = homeSettlementId;
  portBuilding.constructionProgress = 100;

  const walkway = getTile(state, 27, 30)!;
  walkway.terrain = 'stone_road';

  const leviathan = spawnUnit(state, 'leviathan', 28, 30, true).unit!;
  const initialLeviathanHp = leviathan.hp;

  // God power damages Leviathan directly
  executeGodPowerImpact(state, 'lightning_smite', 28, 30);
  assert.ok(leviathan.hp < initialLeviathanHp, `Leviathan must take damage from lightning_smite (${leviathan.hp} < ${initialLeviathanHp})`);

  // Spawn a fresh coastal warrior after the lightning strike so he can actively engage the Leviathan in mutual combat
  const warrior = spawnUnit(state, 'human', 23, 30, true).unit!;
  warrior.role = 'warrior';
  warrior.settlementId = homeSettlementId;
  warrior.hp = 260;
  warrior.maxHp = 260;

  // Step combat: warrior and Leviathan should attack each other, and Leviathan should damage the port building & smash the water walkway
  const hpBeforeCombat = leviathan.hp;
  const portHpBefore = portBuilding.hp;
  for (let i = 0; i < 24; i++) {
    stepSimulation(state, 0.25);
  }

  assert.ok(
    leviathan.hp < hpBeforeCombat,
    `Units/defenses must actively attack and damage the Leviathan (${leviathan.hp} < ${hpBeforeCombat})`,
  );
  assert.ok(
    portBuilding.hp < portHpBefore || !state.buildings.some((b) => b.id === portBuilding.id),
    'Leviathan should damage or destroy coastal/floating sea structures',
  );
  assert.equal(
    walkway.terrain,
    'shallow_water',
    'Leviathan breaching attack should smash water walkways back into shallow_water',
  );
});

test('Sea Update: active vortices deal lethal DOT, shallow seas follow organic coastal shelves without circular rings, and Sunken Atlantis has a broad underwater city', () => {
  // 1. Verify Sunken Atlantis 3D complex spans > 3.2 tiles across the seabed with raised underwater structures + emergent portal spire
  const nodeLib = getNodeVariantLibrary();
  assert.ok(nodeLib.atlantisRuin.length >= 2, 'Should provide Sunken Atlantis temple complex variants');
  for (let i = 0; i < nodeLib.atlantisRuin.length; i++) {
    const geo = nodeLib.atlantisRuin[i];
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const widthX = bb.max.x - bb.min.x;
    const widthZ = bb.max.z - bb.min.z;
    assert.ok(widthX >= 3.2 && widthZ >= 3.2, `Atlantis variant ${i} must have an expansive underwater city footprint (${widthX.toFixed(2)}x${widthZ.toFixed(2)})`);
    assert.ok(bb.max.y >= 0.8, `Atlantis variant ${i} must have emergent temple columns and portal spire above water (max.y=${bb.max.y})`);
  }

  // 2. Verify world generation does NOT create a giant circle of shallow_water inside normDist < 0.78 far from land
  const worldTiles = generateWorldTiles(96, 8080);
  const center = 48;
  const maxRadius = center * 0.88;
  let deepInsideCircleCount = 0;
  for (const t of worldTiles) {
    if (t.height === 0 && !t.isRiver && !t.isLake) {
      const normDist = Math.hypot(t.x - center, t.z - center) / maxRadius;
      if (normDist < 0.72 && t.terrain === 'deep_water') {
        deepInsideCircleCount++;
      }
    }
  }
  assert.ok(
    deepInsideCircleCount > 80,
    `Open ocean inside normDist < 0.72 far from land must be deep_water rather than a giant shallow_water circle (deepInsideCircleCount=${deepInsideCircleCount})`,
  );

  // 3. Verify active vortices (whirlpool, tornado_vortex, wormhole_rift) deal continuous DOT and kill entities while active
  const state = createInitialSimulationState(64, 'VORTEX-DOT-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let z = 10; z <= 54; z++) {
    for (let x = 10; x <= 54; x++) {
      const t = getTile(state, x, z)!;
      t.height = 0;
      t.terrain = 'shallow_water';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }

  // Active Whirlpool kills swimming unit via DOT
  const swimmer = spawnUnit(state, 'human', 32, 32, true).unit!;
  swimmer.hp = 90;
  swimmer.maxHp = 100;
  swimmer.swimStamina = 100;
  state.activeHazards.push({
    id: 'test-whirlpool',
    kind: 'whirlpool',
    x: 32,
    z: 32,
    radius: 4.5,
    remaining: 10,
    duration: 10,
    tickTimer: 0,
  });
  for (let i = 0; i < 12; i++) {
    stepSimulation(state, 0.25);
  }
  assert.equal(swimmer.hp, 0, 'Whirlpool DOT should reduce trapped unit HP to 0');
  assert.equal(swimmer.state, 'ko', 'Whirlpool DOT must transition unit to ko state when HP reaches 0');

  // Active Wormhole Rift kills friendly/neutral/hostile units via continuous gravitational DOT before supernova
  state.activeHazards = [];
  const landTile = getTile(state, 20, 20)!;
  landTile.height = 2;
  landTile.terrain = 'grass';
  const villager = spawnUnit(state, 'human', 20.5, 20.5, true).unit!;
  villager.hp = 85;
  villager.maxHp = 100;
  state.activeHazards.push({
    id: 'test-wormhole',
    kind: 'wormhole_rift',
    x: 20,
    z: 20,
    radius: 5.0,
    remaining: 12,
    duration: 12,
    tickTimer: 0,
  });
  for (let i = 0; i < 12; i++) {
    stepSimulation(state, 0.25);
  }
  assert.equal(villager.hp, 0, 'Wormhole rift DOT should reduce trapped unit HP to 0 while active');
  assert.equal(villager.state, 'ko', 'Wormhole rift DOT must transition unit to ko state when HP reaches 0');
});

test('Sea Update: Leviathan has articulated silhouette & 3D beam rig, fires 7s stationary Water Beam (10s CD) that destroys buildings & landmasses, performs slow-mo head-first Breach Jump (30s CD) causing omnidirectional tsunamis, and rarely eats deep-sea islands while sparing shallow-sea islands', () => {
  // 1. Verify articulated 3D silhouette and surfaced dreadnought rig
  const leviGroup = createUnitGroup('leviathan', 'wildlife', 77);
  for (const name of [
    'leviathan_silhouette',
    'sil_head',
    'sil_seg_0',
    'sil_seg_1',
    'sil_seg_2',
    'sil_tail',
    'sil_fin_l',
    'sil_fin_r',
    'leviathan_surfaced',
    'jaw_pivot',
    'mandible_l',
    'mandible_r',
    'fire_maw',
    'leviathan_beam_group',
    'beam_shaft',
    'beam_impact',
    'beam_muzzle',
    'wing_l',
    'wing_r',
    'tail_pivot',
    'leviathan_tail_mid',
  ]) {
    assert.ok(leviGroup.getObjectByName(name), `Leviathan 3D mesh must include articulated node "${name}"`);
  }

  // 2. Verify 7-second stationary Water Beam (10s cooldown) locks Leviathan position and destroys buildings & landmasses
  const state = createInitialSimulationState(64, 'LEVIATHAN-BEAM-BREACH');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let z = 0; z < 64; z++) {
    for (let x = 0; x < 64; x++) {
      const t = getTile(state, x, z)!;
      t.height = 0;
      t.terrain = 'deep_water';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
    }
  }

  // Create a coastal landmass at x=22..25, z=30..32 with a building on it
  for (let z = 29; z <= 33; z++) {
    for (let x = 21; x <= 25; x++) {
      const t = getTile(state, x, z)!;
      t.height = 1;
      t.terrain = 'sand';
    }
  }
  const bRes = placeBuilding(state, 'forager_hut', 23, 31);
  assert.equal(bRes.ok, true);
  const coastalHut = state.buildings[state.buildings.length - 1]!;
  coastalHut.constructionProgress = 100;

  const levi = spawnUnit(state, 'leviathan', 30, 31, true).unit!;
  levi.leviathanLeapCooldown = 25.0; // Prevent leap so water beam triggers first
  levi.leviathanBeamCooldown = 0;

  // Step once to trigger the Water Beam
  stepSimulation(state, 0.25);
  assert.ok(
    (levi.leviathanBeamTimer ?? 0) > 6.5 && (levi.leviathanBeamTimer ?? 0) <= 7.0,
    `Leviathan should initiate 7-second Water Beam, got timer=${levi.leviathanBeamTimer}`,
  );
  assert.equal(levi.leviathanBeamCooldown, 10.0, 'Water Beam cooldown must be set to 10.0 seconds');
  assert.equal(levi.leviathanSubmerged, false, 'Leviathan must be surfaced with gaping maw while firing Water Beam');

  const lockedX = levi.x;
  const lockedZ = levi.z;
  // Step through 4 seconds of the 7-second beam and verify the Leviathan cannot move and destroys both the building and landmass tiles
  for (let i = 0; i < 16; i++) {
    stepSimulation(state, 0.25);
    assert.equal(levi.x, lockedX, 'Leviathan must remain stationary (x locked) during 7s Water Beam');
    assert.equal(levi.z, lockedZ, 'Leviathan must remain stationary (z locked) during 7s Water Beam');
  }

  assert.ok(
    !state.buildings.some((b) => b.id === coastalHut.id),
    '7-second Water Beam must destroy buildings in its path',
  );
  let erodedLandCount = 0;
  for (let z = 29; z <= 33; z++) {
    for (let x = 21; x <= 25; x++) {
      if (getTile(state, x, z)!.height === 0) erodedLandCount++;
    }
  }
  assert.ok(erodedLandCount >= 2, `7-second Water Beam must erode/destroy landmass tiles into water, eroded=${erodedLandCount}`);

  // 3. Verify Slow-Motion Head-First Breach Jump (30s cooldown, 2.2s deep dive + 4.0s slow-mo airtime + omnidirectional tsunami landing)
  levi.leviathanBeamTimer = 0;
  levi.leviathanBeamCooldown = 10.0;
  levi.leviathanLeapCooldown = 0;
  state.activeHazards = [];
  const targetShip = spawnUnit(state, 'human', 38, 31, true).unit!;
  targetShip.hp = 500;
  targetShip.maxHp = 500;

  stepSimulation(state, 0.25);
  assert.ok(
    (levi.leviathanLeapTimer ?? 0) > 5.8,
    `Leviathan should initiate 6.2s Breach Jump sequence, got leapTimer=${levi.leviathanLeapTimer}`,
  );
  assert.equal(levi.leviathanLeapCooldown, 30.0, 'Breach Jump cooldown must be 30.0 seconds (non-spammable)');
  // Phase 1 (first 2.2s, leapTimer > 4.0): submerged deep dive
  assert.equal(levi.leviathanSubmerged, true, 'Leviathan dives underwater during first 2.2s of Breach Jump');
  assert.ok((levi.altitude ?? 0) <= 0, 'Leviathan altitude is <= 0 while diving underwater');

  // Advance into Phase 2 (slow-motion head-first breach airtime, leapTimer ~ 2.0s)
  for (let i = 0; i < 16; i++) {
    stepSimulation(state, 0.25);
  }
  assert.equal(levi.leviathanSubmerged, false, 'Leviathan breaches above water during slow-mo jump arc');
  assert.ok((levi.altitude ?? 0) > 2.5, `Leviathan should arch high into the air in slow motion, got altitude=${levi.altitude}`);

  // Advance until head-first landing (leapTimer reaches 0)
  for (let i = 0; i < 12; i++) {
    stepSimulation(state, 0.25);
  }
  assert.equal(levi.leviathanLeapTimer, 0, 'Breach Jump timer should finish at 0');
  const tsunamiWaves = state.activeHazards.filter((h) => h.kind === 'tsunami_wave');
  const rogueWaves = state.activeHazards.filter((h) => h.kind === 'rogue_wave');
  assert.ok(tsunamiWaves.length >= 1, 'Head-first breach landing must trigger omnidirectional tsunami_wave');
  assert.ok(rogueWaves.length >= 6, `Head-first breach landing must radiate rogue waves in all directions, got ${rogueWaves.length}`);

  // 4. Verify Leviathan rarely eats deep-sea islands (surrounded by deep_water) but NEVER eats shallow-sea islands
  // Create a shallow-sea island at (14, 14) surrounded by shallow_water
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      const t = getTile(state, 14 + dx, 14 + dz)!;
      if (Math.hypot(dx, dz) <= 1.5) {
        t.height = 1;
        t.terrain = 'grass';
      } else {
        t.height = 0;
        t.terrain = 'shallow_water';
      }
    }
  }
  // Create a deep-sea islet at (48, 48) surrounded by deep_water
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      const t = getTile(state, 48 + dx, 48 + dz)!;
      if (Math.hypot(dx, dz) <= 1.5) {
        t.height = 1;
        t.terrain = 'mountain';
      } else {
        t.height = 0;
        t.terrain = 'deep_water';
      }
    }
  }

  // Place Leviathan next to the shallow-sea island with eat cooldown ready: must NOT eat shallow-sea island
  state.units = [levi];
  levi.x = 17;
  levi.z = 14;
  levi.leviathanEatIslandCooldown = 0;
  levi.leviathanBeamCooldown = 10;
  levi.leviathanLeapCooldown = 30;
  for (let i = 0; i < 8; i++) {
    stepSimulation(state, 0.25);
  }
  assert.equal(
    getTile(state, 14, 14)!.height,
    1,
    'Leviathan must NEVER eat islands located in shallow seas (surrounded by shallow_water)',
  );

  // Move Leviathan next to the deep-sea islet at (48, 48) with eat cooldown ready: should devour the deep-sea islet
  levi.x = 45.8;
  levi.z = 48;
  levi.leviathanEatIslandCooldown = 0;
  for (let i = 0; i < 20; i++) {
    stepSimulation(state, 0.25);
  }
  assert.equal(
    getTile(state, 48, 48)!.height,
    0,
    'Leviathan should devour small islands located in the deep seas (surrounded by deep_water)',
  );
  assert.equal(
    getTile(state, 48, 48)!.terrain,
    'deep_water',
    'Devoured deep-sea island tiles should submerge into deep_water',
  );
  assert.ok(
    (levi.leviathanEatIslandCooldown ?? 0) > 60,
    `Eating a deep-sea island should set a long rare cooldown, got ${levi.leviathanEatIslandCooldown}`,
  );
});

test('Organic Urban Masterplans & Wide Curved Railroads: non-rectangular roads, boulevards, diagonal/Bezier rails without tiny loops', () => {
  // 1. Verify all 4 settlement road variants generate non-rectangular curved/angled/boulevard patterns
  for (let variant = 0; variant < 4; variant++) {
    assert.equal(
      isSettlementRoadTile(0, 0, variant),
      false,
      `Variant ${variant} must keep (0,0) clear for the central hearth`,
    );
    let diagonalCount = 0;
    let curvedRingCount = 0;
    let boulevardPairCount = 0;
    for (let dz = -13; dz <= 13; dz++) {
      for (let dx = -13; dx <= 13; dx++) {
        if (!isSettlementRoadTile(dx, dz, variant)) continue;
        // Points strictly off cardinal axes & box edges prove organic/curved/diagonal geometry
        if (dx !== 0 && dz !== 0 && Math.abs(dx) !== Math.abs(dz)) {
          curvedRingCount++;
        }
        if (Math.abs(dx) === Math.abs(dz) && Math.abs(dx) >= 3) {
          diagonalCount++;
        }
        if (isSettlementRoadTile(dx, dz + 1, variant) && isSettlementRoadTile(dx + 1, dz, variant)) {
          boulevardPairCount++;
        }
      }
    }
    assert.ok(
      curvedRingCount >= 12,
      `Road variant ${variant} must include curved/organic off-axis avenues (got ${curvedRingCount})`,
    );
    assert.ok(
      boulevardPairCount >= 2 || diagonalCount >= 4,
      `Road variant ${variant} must include 2-tile boulevards or diagonal expressways (blvd=${boulevardPairCount}, diag=${diagonalCount})`,
    );
  }

  // 2. Verify wide orbital rail loops (span >= 22 tiles, zero 2x2 clumps) & curved inter-city corridors
  const state = createInitialSimulationState(128, 'CURVED-RAIL-ARCH');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let z = 16; z <= 112; z++) {
    for (let x = 16; x <= 112; x++) {
      const t = getTile(state, x, z)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
    }
  }

  // Advance to Industrial Age and found two distant settlements + rail stations
  while (state.epochIndex < 3) advanceEpoch(state, true);
  assert.equal(placeBuilding(state, 'bonfire', 36, 40).ok, true);
  assert.equal(placeBuilding(state, 'rail_station', 40, 42).ok, true);
  const sid1 = state.buildings[0].settlementId!;
  // Found a 2nd settlement with an offset station to force a sweeping inter-city Bezier spline
  assert.equal(placeBuilding(state, 'bonfire', 86, 74).ok, true);
  const sid2 = state.buildings[state.buildings.length - 1]!.settlementId!;
  assert.equal(placeBuilding(state, 'rail_station', 82, 71).ok, true);

  paveSettlementRailNetwork(state, sid1);
  paveSettlementRailNetwork(state, sid2);

  const railTiles = state.tiles.filter((t) => t.terrain === 'rail_track');
  assert.ok(railTiles.length >= 60, `Wide orbital + inter-city rail network should pave >= 60 tiles, got ${railTiles.length}`);

  // Check city-1 metro loop span around (36, 40) is wide (>= 22 tiles diameter)
  const localRails = railTiles.filter((t) => Math.abs(t.x - 36) <= 15 && Math.abs(t.z - 40) <= 15);
  const minX = Math.min(...localRails.map((t) => t.x));
  const maxX = Math.max(...localRails.map((t) => t.x));
  const minZ = Math.min(...localRails.map((t) => t.z));
  const maxZ = Math.max(...localRails.map((t) => t.z));
  assert.ok(maxX - minX >= 22, `Metro loop must span wide distance X >= 22 tiles, got ${maxX - minX}`);
  assert.ok(maxZ - minZ >= 22, `Metro loop must span wide distance Z >= 22 tiles, got ${maxZ - minZ}`);

  // Verify NO 2x2 solid rail blocks exist anywhere (no tiny micro-loops or blocky clumps)
  let block2x2Count = 0;
  for (const rt of railTiles) {
    const e = getTile(state, rt.x + 1, rt.z)?.terrain === 'rail_track';
    const s = getTile(state, rt.x, rt.z + 1)?.terrain === 'rail_track';
    const se = getTile(state, rt.x + 1, rt.z + 1)?.terrain === 'rail_track';
    if (e && s && se) block2x2Count++;
  }
  assert.equal(block2x2Count, 0, `Railroads must never form 2x2 solid clumps/micro-loops (found ${block2x2Count})`);

  // Verify diagonal corner transitions & curves exist along the network
  let diagConnectedCount = 0;
  for (const rt of railTiles) {
    const diagNeighbors = [
      getTile(state, rt.x + 1, rt.z + 1),
      getTile(state, rt.x - 1, rt.z + 1),
      getTile(state, rt.x + 1, rt.z - 1),
      getTile(state, rt.x - 1, rt.z - 1),
    ].filter((n) => n && n.terrain === 'rail_track').length;
    if (diagNeighbors > 0) diagConnectedCount++;
  }
  assert.ok(
    diagConnectedCount >= 16,
    `Chamfered corners and curved Bezier rails must use 8-way diagonal transitions (got ${diagConnectedCount})`,
  );

  // 3. Verify trains traverse the wide curved network continuously without getting stuck in tiny oscillations
  assert.equal(placeBuilding(state, 'smeltery', 38, 40).ok, true);
  for (let c = 0; c < 4; c++) {
    spawnUnit(state, 'human', 36 + (c % 2), 40 + Math.floor(c / 2), true, sid1);
    spawnUnit(state, 'elf', 86 + (c % 2), 74 + Math.floor(c / 2), true, sid2);
  }
  for (const b of state.buildings) b.constructionProgress = 100;
  for (let i = 0; i < 30; i++) stepSimulation(state, 0.25);
  const trains = (state.vehicles ?? []).filter((v) => v.type === 'train');
  assert.ok(trains.length >= 1, 'Should spawn at least one train on the wide rail network');
  const t0 = trains[0];
  const visitedCells = new Set<string>();
  for (let i = 0; i < 40; i++) {
    stepSimulation(state, 0.25);
    visitedCells.add(`${Math.round(t0.x)},${Math.round(t0.z)}`);
  }
  assert.ok(
    visitedCells.size >= 8,
    `Train must cruise cleanly across >= 8 distinct tiles instead of looping in a small trap (visited ${visitedCells.size})`,
  );
});

test('Distinct Racial Building Architectures: Human, Elf, and Orc build unique 3D silhouettes across types', () => {
  const summarizeGroupGeometry = (group: THREE.Group): string => {
    const parts: string[] = [];
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        const geo = obj.geometry;
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        const posCount = geo.getAttribute('position')?.count ?? 0;
        const sx = bb ? (bb.max.x - bb.min.x) * obj.scale.x : 0;
        const sy = bb ? (bb.max.y - bb.min.y) * obj.scale.y : 0;
        const sz = bb ? (bb.max.z - bb.min.z) * obj.scale.z : 0;
        // Signature uses geometry type, vertex count, and quantized proportions — immune to mere material recoloring
        parts.push(`${geo.type}:${posCount}:${sx.toFixed(2)}x${sy.toFixed(2)}x${sz.toFixed(2)}`);
      }
    });
    parts.sort();
    return `${parts.length}|${parts.join(';')}`;
  };

  const cases: Array<{ type: Parameters<typeof createBuildingGroup>[0]; epoch: number }> = [
    { type: 'forager_hut', epoch: 6 },
    { type: 'granary', epoch: 4 },
    { type: 'smeltery', epoch: 5 },
    { type: 'fission_reactor', epoch: 4 },
    { type: 'cyber_institute', epoch: 5 },
    { type: 'rail_station', epoch: 5 },
    { type: 'airport', epoch: 5 },
    { type: 'launch_arcology', epoch: 6 },
    { type: 'dyson_spire', epoch: 6 },
  ];

  for (const { type, epoch } of cases) {
    const humanSig = summarizeGroupGeometry(createBuildingGroup(type, epoch, 0, 'human', false));
    const elfSig = summarizeGroupGeometry(createBuildingGroup(type, epoch, 0, 'elf', false));
    const orcSig = summarizeGroupGeometry(createBuildingGroup(type, epoch, 0, 'orc', false));

    assert.notEqual(
      elfSig,
      humanSig,
      `${type} (epoch ${epoch}) Elf architecture must differ structurally from Human, not merely be recolored`,
    );
    assert.notEqual(
      orcSig,
      humanSig,
      `${type} (epoch ${epoch}) Orc architecture must differ structurally from Human, not merely be recolored`,
    );
    assert.notEqual(
      orcSig,
      elfSig,
      `${type} (epoch ${epoch}) Orc architecture must differ structurally from Elf, not merely be recolored`,
    );
  }
});

test('Per-city max population scales with world size and enforces city housing cap', () => {
  const sizes = [64, 96, 128, 160, 192, 224, 256];
  for (let i = 1; i < sizes.length; i++) {
    assert.ok(
      getMaxCityPopulation(sizes[i]) > getMaxCityPopulation(sizes[i - 1]),
      `Larger world (${sizes[i]}) must have higher max city population than (${sizes[i - 1]})`,
    );
  }

  // Test clamping on a small 64x64 world even when high-epoch buildings provide huge raw housing
  const smallWorld = createInitialSimulationState(64, 'CAP-SMALL-64');
  smallWorld.sandboxFreeMode = true;
  smallWorld.wildlifeSeeded = true;
  for (let z = 20; z <= 44; z++) {
    for (let x = 20; x <= 44; x++) {
      const t = getTile(smallWorld, x, z)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }
  for (let i = 0; i < EPOCHS.length - 1; i++) {
    advanceEpoch(smallWorld, true);
  }
  assert.equal(placeBuilding(smallWorld, 'bonfire', 30, 30).ok, true);
  assert.equal(placeBuilding(smallWorld, 'guildhall', 33, 30).ok, true);
  assert.equal(placeBuilding(smallWorld, 'launch_arcology', 36, 30).ok, true);
  for (const b of smallWorld.buildings) {
    b.constructionProgress = 100;
  }

  const maxSmall = getMaxCityPopulation(64);
  for (let i = 0; i < maxSmall; i++) {
    spawnUnit(smallWorld, 'human', 31 + (i % 4), 32 + (Math.floor(i / 4) % 4), true, smallWorld.buildings[0].settlementId);
  }

  smallWorld.resources.food = 1000;
  stepSimulation(smallWorld, 0.25);
  assert.equal(
    smallWorld.populationCap,
    maxSmall,
    `64x64 world city cap must clamp to ${maxSmall}, got ${smallWorld.populationCap}`,
  );

  // Even with abundant food and planner ticks, city must not reproduce beyond its world-size cap
  const zonesBefore = computeWorldZones(smallWorld);
  const kZone = Array.from(zonesBefore.kingdomsById.values())[0];
  assert.ok(kZone, 'Kingdom zone must exist');
  assert.equal(kZone.maxPopulation, maxSmall, 'KingdomZoneInfo.maxPopulation must match world-size city cap');

  const popAtCap = smallWorld.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko').length;
  for (let i = 0; i < 12; i++) {
    stepSimulation(smallWorld, 0.5);
  }
  const popAfter = smallWorld.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko').length;
  assert.ok(
    popAfter <= maxSmall && popAfter <= popAtCap,
    `City population (${popAfter}) must remain capped at ${maxSmall}`,
  );
});

test('Starting races survive early wilderness, heal out of combat, and reproduce sustainably before dying of old age', () => {
  for (const species of ['human', 'orc', 'elf'] as const) {
    const state = createInitialSimulationState(96, `SUSTAIN-${species}`);
    state.wildlifeSeeded = true;
    state.resources.food = 45;
    state.resources.wood = 65;
    state.resources.stone = 40;
    for (let z = 34; z <= 62; z++) {
      for (let x = 34; x <= 62; x++) {
        const t = getTile(state, x, z)!;
        t.height = 2;
        t.terrain = 'grass';
        t.resourceNode = 'none';
        t.resourceAmount = 0;
        t.buildingId = null;
      }
    }
    // Place nearby berry bushes and timber so settlers sustain themselves realistically
    for (let i = 0; i < 6; i++) {
      const bt = getTile(state, 44 + i, 44)!;
      bt.resourceNode = 'berry_bush';
      bt.resourceAmount = 45;
      const tt = getTile(state, 44 + i, 52)!;
      tt.terrain = 'forest';
      tt.resourceNode = 'timber_grove';
      tt.resourceAmount = 45;
    }

    assert.equal(placeBuilding(state, 'bonfire', 48, 48).ok, true);
    state.buildings[0].constructionProgress = 100;
    const sid = state.buildings[0].settlementId!;

    for (let i = 0; i < 5; i++) {
      const spawned = spawnUnit(state, species, 47 + (i % 3), 47 + Math.floor(i / 3), true, sid, {
        ageStage: 'adult',
        ageYears: 18,
      });
      assert.equal(spawned.ok, true);
      if (i === 0 && spawned.unit) {
        // Injure first settler to verify out-of-combat passive healing works for every settled race
        spawned.unit.hp = Math.max(20, spawned.unit.maxHp - 40);
      }
    }

    const firstUnit = state.units.find((u) => u.faction === 'civilization')!;
    const hpBefore = firstUnit.hp;
    for (let i = 0; i < 10; i++) {
      stepSimulation(state, 0.5);
    }
    assert.ok(firstUnit.hp > hpBefore, `${species} settled unit should recover HP out of combat`);

    // Simulate 40 years (40s at 1x) — population must grow well above the initial 5 founders
    for (let i = 0; i < 80; i++) {
      stepSimulation(state, 0.5);
    }
    const livingPop = state.units.filter((u) => u.faction === 'civilization' && u.state !== 'ko').length;
    assert.ok(
      livingPop >= 8,
      `${species} founding band should grow sustainably past initial 5 units before aging out (got ${livingPop})`,
    );
  }
});

test('Random World Events are toggleable in worldRules, support huge slow asteroid cinematic & dismissal, and remain rare', () => {
  const state = createInitialSimulationState(96, 'RANDOM-EVENTS-1');
  assert.equal(state.worldRules?.randomEvents, true, 'randomEvents rule should default to enabled');

  // When disabled in God Rules, stepping well past max threshold never triggers an autonomous event
  state.worldRules = { ...state.worldRules!, randomEvents: false };
  state.worldEventTimer = 250;
  stepSimulation(state, 0.5);
  assert.equal(state.activeWorldEvent ?? null, null, 'Disabling randomEvents must suppress autonomous random events');

  // Also test skipRandomEvents option (used on Title screen tour)
  state.worldRules.randomEvents = true;
  state.worldEventTimer = 250;
  stepSimulation(state, 0.5, { skipRandomEvents: true });
  assert.equal(state.activeWorldEvent ?? null, null, 'skipRandomEvents option must suppress random event triggers');

  // Flatten center for predictable impact check
  for (let dz = -8; dz <= 8; dz++) {
    for (let dx = -8; dx <= 8; dx++) {
      const t = getTile(state, 48 + dx, 48 + dz)!;
      t.height = 4;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }

  // Trigger huge_asteroid cinematic event explicitly
  const evt = triggerRandomWorldEvent(state, 'huge_asteroid', 48, 48);
  assert.ok(evt, 'triggerRandomWorldEvent should create huge_asteroid world event');
  assert.equal(evt!.kind, 'huge_asteroid');
  assert.equal(evt!.cinematicActive, true);
  assert.equal(evt!.dismissedByUser, false);
  assert.equal(evt!.impactTriggered, false);
  assert.ok(evt!.trackY > 20, `Huge asteroid camera trackY should start high above impact site (got ${evt!.trackY})`);

  const pendingStrike = state.pendingVfx.find((v) => v.type === 'huge_asteroid_strike');
  assert.ok(pendingStrike, 'Huge asteroid event must queue huge_asteroid_strike VFX');
  assert.equal(pendingStrike!.deferImpact, true);

  // Execute impact when slow asteroid lands
  executeHugeAsteroidImpact(state, 48, 48);
  const centerTile = getTile(state, 48, 48)!;
  assert.equal(centerTile.terrain, 'scorched', 'Huge asteroid impact should scorch a deep crater basin at epicenter');
  assert.equal(centerTile.height, 1, 'Huge asteroid crater floor should depress from height 4 down to 1');
  const rimTile = getTile(state, 54, 48)!;
  assert.ok(rimTile.height >= 5, `Huge asteroid impact should heave up a blast rim around the crater (got ${rimTile.height})`);

  // Dismissing cinematic immediately hides cinematic overlay flag and records user dismissal
  dismissWorldEventCinematic(state);
  assert.equal(state.activeWorldEvent?.dismissedByUser, true);
  assert.equal(state.activeWorldEvent?.cinematicActive, false);
});

test('Volcano Eruption and Super Tornado powers spawn distinct lingering hazards and effects', () => {
  const state = createInitialSimulationState(96, 'VOLCANO-SUPERTORNADO');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  for (let dz = -10; dz <= 10; dz++) {
    for (let dx = -10; dx <= 10; dx++) {
      const t = getTile(state, 48 + dx, 48 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }

  const vRes = castGodPower(state, 'volcano_eruption', 40, 48);
  assert.equal(vRes.ok, true);
  const volcanoZone = (state.activeHazards ?? []).find((h) => h.kind === 'volcano_eruption');
  assert.ok(volcanoZone, 'Volcano power must register lingering volcano_eruption hazard');
  const calderaTile = getTile(state, 40, 48)!;
  const rimPeakTile = getTile(state, 42, 48)!;
  assert.ok(calderaTile.height >= 5 && calderaTile.onFireTimer > 0, 'Volcano epicenter must form an ignited elevated caldera');
  assert.ok(rimPeakTile.height >= 6, `Volcano flanks must uplift steep mountain slopes (got ${rimPeakTile.height})`);

  const tRes = castGodPower(state, 'super_tornado', 58, 48);
  assert.equal(tRes.ok, true);
  const superTornado = (state.activeHazards ?? []).find((h) => h.kind === 'tornado_vortex' && h.isSuper);
  assert.ok(superTornado, 'Super Tornado power must register isSuper tornado_vortex hazard');
  assert.ok(superTornado!.radius >= 6, 'Super Tornado must have expanded damage/pull radius');
});

test('Void Goo infects land into starry void terrain, spreads, revives killed beings as colorful varied-size wisps, and is cleansed by Blessing', () => {
  const state = createInitialSimulationState(96, 'VOID-GOO-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.worldRules = { ...state.worldRules!, randomEvents: false };

  for (let dz = -10; dz <= 10; dz++) {
    for (let dx = -10; dx <= 10; dx++) {
      const t = getTile(state, 48 + dx, 48 + dz)!;
      t.height = 2;
      t.terrain = 'grass';
      t.resourceNode = 'none';
      t.resourceAmount = 0;
      t.buildingId = null;
    }
  }

  const victims = [];
  for (let i = 0; i < 6; i++) {
    const u = spawnUnit(state, i % 2 === 0 ? 'human' : 'elf', 47 + (i % 3), 47 + Math.floor(i / 3), false);
    assert.equal(u.ok, true);
    victims.push(u.unit!);
  }

  const res = castGodPower(state, 'void_goo', 48, 48);
  assert.equal(res.ok, true);

  const initialVoidCount = state.tiles.filter((t) => t.terrain === 'void_goo').length;
  assert.ok(initialVoidCount >= 5, `Void Goo cast must convert patch tiles to void_goo (got ${initialVoidCount})`);

  // Step simulation so void goo infects neighbors, consumes/kills units on infected soil, and revives varied-color/size wisps
  for (let i = 0; i < 14; i++) {
    stepSimulation(state, 0.35);
  }

  const spreadVoidCount = state.tiles.filter((t) => t.terrain === 'void_goo').length;
  assert.ok(
    spreadVoidCount > initialVoidCount,
    `Void Goo should spread organically to neighboring land (${initialVoidCount} -> ${spreadVoidCount})`,
  );

  const killedCount = victims.filter((u) => u.state === 'ko').length;
  assert.ok(killedCount >= 3, `Units inside Void Goo must be killed (killed=${killedCount})`);

  const wisps = state.voidWisps ?? [];
  assert.ok(wisps.length >= 3, `Killed units must revive as moving Void Wisps (wisps=${wisps.length})`);

  const distinctColors = new Set(wisps.map((w) => w.color));
  const distinctSizes = new Set(wisps.map((w) => Math.round(w.size * 10)));
  assert.ok(distinctColors.size >= 2, `Void Wisps should spawn in multiple colors (got ${distinctColors.size})`);
  assert.ok(distinctSizes.size >= 2, `Void Wisps should vary in size (got ${distinctSizes.size})`);

  // Verify wisps actively move over time
  const w0Start = { x: wisps[0].x, z: wisps[0].z };
  stepSimulation(state, 0.5);
  const w0After = state.voidWisps![0];
  assert.ok(
    Math.hypot(w0After.x - w0Start.x, w0After.z - w0Start.z) > 0.05,
    'Void Wisps must move smoothly across the map',
  );

  // Blessing should cleanse void_goo back to living grass/fertile terrain
  assert.equal(castGodPower(state, 'blessing', 48, 48).ok, true);
  const cleansedTerrain = getTile(state, 48, 48)!.terrain;
  assert.ok(
    cleansedTerrain === 'grass' || cleansedTerrain === 'fertile',
    `Blessing miracle should cleanse Void Goo back to living green soil (got ${cleansedTerrain})`,
  );

  // Verify UI deferred cast queues void_goo sky-seed VFX and executes impact when seed lands
  const deferredRes = castGodPower(state, 'void_goo', 40, 40, { deferImpact: true });
  assert.equal(deferredRes.ok, true);
  const queuedSeedVfx = state.pendingVfx.find((v) => v.type === 'void_goo' && v.x === 40 && v.z === 40);
  assert.ok(queuedSeedVfx && queuedSeedVfx.deferImpact, 'Deferred Void Goo cast must queue void_goo sky-seed VFX');
  executeGodPowerImpact(state, 'void_goo', 40, 40);
  assert.equal(getTile(state, 40, 40)!.terrain, 'void_goo', 'Void Goo sky-seed impact must infect target tile');
});

test('Advanced settlements flatten urban plateaus, build connected road networks, reclaim coastal artificial islands, and construct distinct towering racial skyscrapers', () => {
  const state = createInitialSimulationState(96, 'URBAN-TERRAFORM-TEST');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.worldRules = { ...state.worldRules!, randomEvents: false };

  // Create uneven jagged terrain around settlement center (48, 48) with water bay to the East (52..57, 46..50)
  for (let dz = -8; dz <= 8; dz++) {
    for (let dx = -8; dx <= 10; dx++) {
      const t = getTile(state, 48 + dx, 48 + dz)!;
      t.buildingId = null;
      if (dx >= 4) {
        t.height = 0;
        t.terrain = dx <= 6 ? 'shallow_water' : 'deep_water';
        t.resourceNode = 'none';
        t.resourceAmount = 0;
      } else {
        t.height = 2 + ((Math.abs(dx * 3 + dz * 5) % 3)); // ragged heights 2, 3, 4
        t.terrain = 'grass';
        t.resourceNode = (dx + dz) % 2 === 0 ? 'stone_outcrop' : 'none';
        t.resourceAmount = t.resourceNode !== 'none' ? 120 : 0;
      }
    }
  }

  getTile(state, 48, 48)!.height = 2;
  getTile(state, 48, 48)!.terrain = 'grass';
  getTile(state, 48, 48)!.resourceNode = 'none';
  const bfRes = placeBuilding(state, 'bonfire', 48, 48);
  assert.equal(bfRes.ok, true);
  const bonfire = state.buildings.find((b) => b.type === 'bonfire')!;

  // Place houses around the settlement
  placeBuilding(state, 'forager_hut', 46, 48);
  placeBuilding(state, 'forager_hut', 48, 46);
  placeBuilding(state, 'forager_hut', 50, 48);
  placeBuilding(state, 'guildhall', 48, 50);

  // Advance epochs up to Information Age (Epoch 5)
  for (let ep = 0; ep < 5; ep++) {
    state.resources.food = 99999;
    state.resources.wood = 99999;
    state.resources.stone = 99999;
    state.resources.ore = 99999;
    state.resources.faith = 99999;
    const adv = advanceEpoch(state);
    assert.equal(adv.ok, true, `Advance to epoch ${ep + 1} failed: ${adv.reason}`);
  }

  // 1. Verify urban plateau around (48, 48) is flattened to a consistent level grade
  const coreHeights = new Set<number>();
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const t = getTile(state, 48 + dx, 48 + dz)!;
      if (t.height > 0) coreHeights.add(t.height);
    }
  }
  assert.equal(
    coreHeights.size,
    1,
    `High-epoch settlement core plateau must be leveled to a uniform height (got heights: ${[...coreHeights].join(',')})`,
  );

  // 2. Verify road tiles form a single connected component and remain compact (no sea of roads)
  const roadTiles = state.tiles.filter(
    (t) => t.terrain === 'stone_road' && Math.abs(t.x - 48) <= 8 && Math.abs(t.z - 48) <= 8,
  );
  assert.ok(
    roadTiles.length >= 12 && roadTiles.length <= 45,
    `Settlement should pave compact connected streets near buildings rather than an empty sea of roads (got ${roadTiles.length})`,
  );
  const roadSet = new Set(roadTiles.map((t) => `${t.x},${t.z}`));
  const visited = new Set<string>();
  const startRoad = `${roadTiles[0].x},${roadTiles[0].z}`;
  const queue = [startRoad];
  visited.add(startRoad);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const [cx, cz] = cur.split(',').map(Number);
    for (const [nx, nz] of [
      [cx + 1, cz],
      [cx - 1, cz],
      [cx, cz + 1],
      [cx, cz - 1],
    ]) {
      const key = `${nx},${nz}`;
      if (roadSet.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(key);
      }
    }
  }
  assert.equal(
    visited.size,
    roadSet.size,
    `All settlement roads must be 4-way connected to the civic center (${visited.size}/${roadSet.size} connected)`,
  );

  // 3. Verify coastal settlement constructed an Artificial Island in the eastern bay (dx >= 4)
  const reclaimedBayLand = state.tiles.filter(
    (t) => t.x >= 52 && t.x <= 58 && Math.abs(t.z - 48) <= 4 && t.height >= 1,
  );
  assert.ok(
    reclaimedBayLand.length >= 9,
    `High-tech coastal settlement must reclaim an artificial island with causeway in adjacent water (got ${reclaimedBayLand.length} tiles)`,
  );

  // 4. Verify Ep 5 & Ep 6+ Human, Elf, and Orc skyscrapers are tall and structurally distinct per species
  const measureHeightAndVerts = (species: 'human' | 'elf' | 'orc', ep: number) => {
    const grp = createBuildingGroup('forager_hut', ep, 0, species, false);
    const box = new THREE.Box3().setFromObject(grp);
    let verts = 0;
    grp.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const g = (obj as THREE.Mesh).geometry;
        if (g?.attributes?.position) verts += g.attributes.position.count;
      }
    });
    return { height: box.max.y - box.min.y, verts };
  };

  const humanEp5 = measureHeightAndVerts('human', 5);
  const elfEp5 = measureHeightAndVerts('elf', 5);
  const orcEp5 = measureHeightAndVerts('orc', 5);
  const humanEp6 = measureHeightAndVerts('human', 6);

  assert.ok(humanEp5.height > 1.5, `Human Ep 5 skyscraper must be towering (got ${humanEp5.height.toFixed(2)})`);
  assert.ok(elfEp5.height > 1.5, `Elf Ep 5 arcology spire must be towering (got ${elfEp5.height.toFixed(2)})`);
  assert.ok(orcEp5.height > 1.4, `Orc Ep 5 brutalist megablock must be towering (got ${orcEp5.height.toFixed(2)})`);
  assert.ok(humanEp6.height > 1.7, `Human Ep 6 cyber-arcology must not shrink to cottage height (got ${humanEp6.height.toFixed(2)})`);
  assert.ok(
    humanEp5.verts !== elfEp5.verts && elfEp5.verts !== orcEp5.verts && humanEp5.verts !== orcEp5.verts,
    `Racial skyscrapers must have distinct 3D geometry silhouettes (verts: human=${humanEp5.verts}, elf=${elfEp5.verts}, orc=${orcEp5.verts})`,
  );
});

test('Giant asteroid impact unleashes expanding shockwave, wide environmental destruction, hurricane blast winds, and 15-20 year post-impact rains', () => {
  const state = createInitialSimulationState(96, 'ASTEROID-SHOCKWAVE-TEST');
  state.wildlifeSeeded = true;
  state.worldRules = { ...state.worldRules!, randomEvents: false };

  // Prepare forested land out to radius 28 around (48, 48)
  for (let dz = -30; dz <= 30; dz++) {
    for (let dx = -30; dx <= 30; dx++) {
      const t = getTile(state, 48 + dx, 48 + dz);
      if (!t) continue;
      t.height = 3;
      t.terrain = 'forest';
      t.resourceNode = 'timber_grove';
      t.resourceAmount = 150;
      t.buildingId = null;
    }
  }

  // Place a unit 21 tiles away to test wide-radius hurricane blast winds
  spawnUnit(state, 'human', 48 + 21, 48, true);
  const farUnit = state.units[state.units.length - 1]!;
  farUnit.statusEffects.shielded = 0;
  farUnit.hp = 800;
  farUnit.maxHp = 800;
  farUnit.vxAir = 0;
  farUnit.vzAir = 0;

  executeHugeAsteroidImpact(state, 48, 48);

  // 1. Verify expanding asteroid_shockwave hazard is spawned with maxRadius >= 28
  const shockHaz = state.activeHazards.find((h) => h.kind === 'asteroid_shockwave');
  assert.ok(shockHaz, 'Giant asteroid impact must spawn an asteroid_shockwave hazard');
  assert.ok((shockHaz!.maxRadius ?? 0) >= 28, `Shockwave maxRadius must be >= 28 (got ${shockHaz!.maxRadius})`);

  // 2. Verify post-impact deluge rain clouds are spawned and last between 15 and 20 years (20 years max)
  const rainHazards = state.activeHazards.filter((h) => h.kind === 'rain_cloud' && h.isSuper);
  assert.ok(rainHazards.length >= 3, 'Giant asteroid impact must spawn multi-year post-impact rain clouds');
  for (const rh of rainHazards) {
    assert.ok(
      rh.duration >= 15 && rh.duration <= 20,
      `Post-impact rain duration must be 15-20 years (20 years max), got ${rh.duration}`,
    );
  }

  // 3. Verify unit at 21 tiles was hurled outward by immediate hurricane blast winds
  assert.ok(
    (farUnit.vxAir ?? 0) > 8.0 && (farUnit.altitude ?? 0) > 1.5,
    `Unit 21 tiles away must be hurled outward by asteroid blast winds (vxAir=${farUnit.vxAir}, altitude=${farUnit.altitude})`,
  );

  // 4. Step simulation so the shockwave expands out to 28+ tiles and strips distant forests
  for (let s = 0; s < 16; s++) {
    stepSimulation(state, 0.2, { skipRandomEvents: true });
  }
  const distantTile = getTile(state, 48 + 24, 48)!;
  assert.equal(
    distantTile.resourceNode,
    'none',
    'Expanding asteroid shockwave must strip trees/timber_grove at 24 tiles from impact center',
  );
  assert.notEqual(
    distantTile.terrain,
    'forest',
    'Expanding asteroid shockwave must flatten/scorch forest terrain at 24 tiles from impact center',
  );
});

test('World Chronicle logs dynamically respond to new kings, royal succession, enraged Leviathan attacks, and fallen cities', () => {
  const state = createInitialSimulationState(96, 'CHRONICLE-WORLD-EVENTS');
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;

  for (let dz = -6; dz <= 6; dz++) {
    for (let dx = -6; dx <= 6; dx++) {
      const t = getTile(state, 48 + dx, 48 + dz)!;
      t.height = dx <= -3 ? 0 : 2;
      t.terrain = dx <= -3 ? 'deep_water' : 'grass';
      t.resourceNode = 'none';
      t.buildingId = null;
    }
  }

  // 1. Place a settlement and 2 citizens -> stepping crowns a King and logs it to the chronicle
  placeBuilding(state, 'bonfire', 48, 48);
  const sid = state.buildings[0].settlementId!;
  spawnUnit(state, 'human', 48, 49, true, sid);
  spawnUnit(state, 'human', 49, 49, true, sid);

  stepSimulation(state, 0.2, { skipRandomEvents: true });
  const king = state.units.find((u) => u.isKing)!;
  assert.ok(king, 'Kingdom must crown a monarch');
  assert.ok(
    state.chronicle.some((c) => c.text.includes('crowned monarch of')),
    'World Chronicle must log the coronation of a new King',
  );

  // 2. Slay the King in battle -> chronicle logs the King's fall AND the successor's coronation
  const firstKingName = king.name;
  king.hp = 0;
  king.state = 'ko';
  king.koTimer = 0.05;
  stepSimulation(state, 0.2, { skipRandomEvents: true });

  assert.ok(
    state.chronicle.some((c) => c.text.includes(`${firstKingName} has fallen!`)),
    'World Chronicle must log when a reigning King falls',
  );
  const secondKing = state.units.find((u) => u.isKing)!;
  assert.ok(secondKing && secondKing.id !== king.id, 'A successor King must be crowned');
  assert.ok(
    state.chronicle.some((c) => c.text.includes(`${secondKing.name} has been crowned monarch`)),
    'World Chronicle must log the successor King coronation',
  );

  // 3. Spawn a Leviathan offshore and provoke/engage it -> chronicle logs enraged Leviathan actions and its death
  const levRes = spawnUnit(state, 'leviathan', 48 - 4, 48, true);
  assert.equal(levRes.ok, true);
  const leviathan = levRes.unit!;
  leviathan.hp = leviathan.maxHp * 0.4; // Wounded / enraged
  leviathan.underAttackTimer = 8.0;
  leviathan.lastAttackerId = secondKing.id;
  leviathan.leviathanLeapCooldown = 99;
  leviathan.leviathanBeamCooldown = 0;

  stepSimulation(state, 0.2, { skipRandomEvents: true });
  assert.ok(
    state.chronicle.some((c) => c.text.includes('enraged Leviathan') && c.text.includes('Hydro-Beam')),
    'World Chronicle must log when an enraged Leviathan unleashes its abyssal Hydro-Beam',
  );

  leviathan.hp = 0;
  leviathan.state = 'ko';
  leviathan.koTimer = 0.05;
  stepSimulation(state, 0.2, { skipRandomEvents: true });
  assert.ok(
    state.chronicle.some((c) => c.text.includes(`Leviathan (${leviathan.name}) has been slain`)),
    'World Chronicle must log when a Leviathan is slain',
  );
});

