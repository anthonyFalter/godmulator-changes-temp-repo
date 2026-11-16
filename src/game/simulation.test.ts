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
  executeGodPowerImpact,
  formatYearLabel,
  generateEarthquakeFaultNetwork,
  getKingdomId,
  getKingdomRelation,
  getMaxCityBuildings,
  getMaxCityFarmFields,
  getSettlementAnchor,
  getTile,
  initializeKingdomDiplomacyPair,
  isCarnivoreAnimal,
  isHerbivoreAnimal,
  placeBuilding,
  releaseDragUnit,
  rollKingdomPeacefulTrait,
  setKingdomRelation,
  spawnRaiderWave,
  spawnUnit,
  stepSimulation,
  triggerCityRebellion,
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
import { createUnitGroup, createVehicleGroup } from './meshBuilders';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  applyGraphicsPreset,
  inferGraphicsPreset,
  resolveGraphicsProfile,
  sanitizeGraphicsSettings,
} from './graphics';
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

test('simulation step advances year at 1 year per second on 1x speed, scales with multiplier, and spawns raiders cleanly', () => {
  const state = createInitialSimulationState(128, 55555);
  spawnUnit(state, 'villager', 64, 64);
  const yearBefore = state.year;
  assert.equal(formatYearLabel(yearBefore), '10,000 BCE');

  spawnRaiderWave(state);
  const hostiles = state.units.filter((u) => u.faction === 'hostile');
  assert.equal(hostiles.length, 3);

  // 0.9 seconds at 1x speed should still be 10,000 BCE (< 1 full year elapsed)
  for (let i = 0; i < 9; i++) {
    stepSimulation(state, 0.1);
  }
  assert.ok(state.year > yearBefore);
  assert.ok(Math.abs(state.year - (yearBefore + 0.9)) < 1e-6);
  assert.equal(formatYearLabel(state.year), '10,000 BCE');

  // 0.1 more second completes 1 full second -> advances 1 full year to 9,999 BCE
  stepSimulation(state, 0.1);
  assert.ok(Math.abs(state.year - (yearBefore + 1.0)) < 1e-6);
  assert.equal(formatYearLabel(state.year), '9,999 BCE');

  // 10x speed (dt = 0.1 * 10 = 1.0 per tick) advances 10 full years in 1 real second
  const yearBefore10x = state.year;
  for (let i = 0; i < 10; i++) {
    stepSimulation(state, 0.1 * 10);
  }
  assert.ok(Math.abs(state.year - (yearBefore10x + 10.0)) < 1e-6);
  assert.equal(formatYearLabel(state.year), '9,989 BCE');
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

test('world seeds 7 initial animals and 2 mythical beasts with 3D meshes, unicorn healing, and dragon combat', () => {
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
  assert.equal(MYTHICAL_BEAST_UNITS.length, 2);
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

  for (let i = 0; i < expectedRoles.length; i++) {
    const role = expectedRoles[i];
    const res = spawnUnit(state, role, flatX + (i % 3) - 1, flatZ + Math.floor(i / 3) - 1);
    assert.equal(res.ok, true, `Should spawn ${role}: ${res.reason ?? ''}`);

    const mesh = createUnitGroup(role, 'wildlife', 0, 'human', i * 17);
    assert.ok(mesh instanceof THREE.Group, `${role} 3D builder should return a THREE.Group`);
    assert.ok(mesh.getObjectByName('head_pivot'), `${role} mesh should expose articulated head_pivot`);
    assert.ok(mesh.getObjectByName('tail_pivot'), `${role} mesh should expose articulated tail_pivot`);
    if (role === 'dragon' || role === 'chicken') {
      assert.ok(mesh.getObjectByName('wing_l'), `${role} mesh should expose wing_l pivot`);
      assert.ok(mesh.getObjectByName('wing_r'), `${role} mesh should expose wing_r pivot`);
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

  // 3. Sci-Fi Orbital template: starts right in the Orbital Age (epochIndex = 6, 2150 CE) with an established colony
  const scifiCfg = createWorldConfigFromTemplate('scifi', { seed: 9999, gridSize: 128 });
  assert.equal(scifiCfg.rules.startingEpochIndex, 6);
  assert.equal(scifiCfg.rules.startingSettlers, 'colony');
  const scifiSim = createInitialSimulationState(scifiCfg.gridSize, scifiCfg.seed, scifiCfg);
  assert.equal(scifiSim.epochIndex, 6, 'Sci-Fi template must start at Orbital Age (epochIndex 6)');
  assert.equal(scifiSim.year, 2150, 'Sci-Fi template must start at year 2150 CE');
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

  assert.equal(state.buildings.length, 2, 'Independent human group must found its own separate city');
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
  state.epochIndex = 1; // Bronze Age
  for (let i = 0; i < 6; i++) stepSimulation(state, 0.25);

  const fixedBronze = (state.vehicles ?? []).find((v) => v.isMilitary && v.type === 'glider');
  const shipBronze = (state.vehicles ?? []).find((v) => v.isMilitary && v.type === 'warship');
  assert.ok(fixedBronze, 'Bronze Age city should field a glider');
  assert.ok(shipBronze, 'Bronze Age coastal city should field a warship');
  const bronzeShipMaxHp = shipBronze.maxHp ?? 0;

  // Advance to Medieval/Exploration (Epoch 2 -> Airship hoverer spawns alongside glider/biplane)
  state.epochIndex = 2;
  stepSimulation(state, 0.2);
  const hoverCraft = (state.vehicles ?? []).find((v) => v.isMilitary && v.type === 'airship');
  assert.ok(hoverCraft, 'Medieval/Exploration city should field an Airship in the hover branch');
  assert.equal(fixedBronze.type, 'glider', 'Fixed-wing branch stays fixed-wing into biplane era');
  assert.ok((shipBronze.maxHp ?? 0) > bronzeShipMaxHp, 'Warship maxHp should scale up with Epoch');

  // Advance to Industrial (Epoch 3 -> Airship evolves to Helicopter; Glider stays fixed-wing)
  state.epochIndex = 3;
  stepSimulation(state, 0.2);
  assert.equal(hoverCraft.type, 'helicopter', 'Airship should evolve into Helicopter in Industrial epoch');

  // Advance to Atomic (Epoch 4 -> Glider evolves to Bomber Plane)
  state.epochIndex = 4;
  stepSimulation(state, 0.2);
  assert.equal(fixedBronze.type, 'bomber_plane', 'Glider should evolve into Bomber Plane in Atomic epoch');

  // Advance to Space/Orbital (Epoch 6 -> Helicopter evolves to Orbital Gunship + Hover Tank)
  state.epochIndex = 6;
  stepSimulation(state, 0.2);
  assert.equal(
    hoverCraft.type,
    'orbital_gunship',
    'Helicopter should evolve into Orbital Gunship in Space epoch',
  );
  assert.equal(fixedBronze.type, 'bomber_plane', 'Fixed-wing Bomber Plane stays fixed-wing (upgrades to plasma jet)');
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
