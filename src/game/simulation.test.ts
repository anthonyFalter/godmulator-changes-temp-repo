import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceEpoch,
  applyTerrainTool,
  castGodPower,
  createInitialSimulationState,
  executeGodPowerImpact,
  formatYearLabel,
  generateEarthquakeFaultNetwork,
  getMaxCityBuildings,
  getMaxCityFarmFields,
  getTile,
  placeBuilding,
  spawnRaiderWave,
  spawnUnit,
  stepSimulation,
} from './simulation';
import { ANIMAL_UNITS, DRAGON_VARIANTS, EPOCHS, MYTHICAL_BEAST_UNITS, SPECIES_UNITS, getDragonVariant } from './catalog';
import { createUnitGroup, createVehicleGroup } from './meshBuilders';
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

test('simulation step advances year at 1 year per 10 seconds on 1x speed and spawns raiders cleanly', () => {
  const state = createInitialSimulationState(128, 55555);
  spawnUnit(state, 'villager', 64, 64);
  const yearBefore = state.year;
  assert.equal(formatYearLabel(yearBefore), '10,000 BCE');

  spawnRaiderWave(state);
  const hostiles = state.units.filter((u) => u.faction === 'hostile');
  assert.equal(hostiles.length, 3);

  // 9 seconds at 1x speed should still be 10,000 BCE (< 1 full year elapsed)
  for (let i = 0; i < 90; i++) {
    stepSimulation(state, 0.1);
  }
  assert.ok(state.year > yearBefore);
  assert.ok(Math.abs(state.year - (yearBefore + 0.9)) < 1e-6);
  assert.equal(formatYearLabel(state.year), '10,000 BCE');

  // 1 more second completes 10 seconds -> advances 1 full year to 9,999 BCE
  for (let i = 0; i < 10; i++) {
    stepSimulation(state, 0.1);
  }
  assert.ok(Math.abs(state.year - (yearBefore + 1.0)) < 1e-6);
  assert.equal(formatYearLabel(state.year), '9,999 BCE');
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
  let sawPlaneAirborne = planes[0].y > 0.2 || planes[0].flightPhase === 'cruise' || planes[0].flightPhase === 'takeoff';

  for (let i = 0; i < 45; i++) {
    stepSimulation(state, 0.2);
    if ((planes[0]?.y ?? 0) > 0.4 || planes[0]?.flightPhase === 'cruise') {
      sawPlaneAirborne = true;
    }
  }

  assert.ok(
    Math.hypot(cars[0].x - carBefore.x, cars[0].z - carBefore.z) > 0.2,
    'Cars must drive continuously along road network',
  );
  assert.ok(
    Math.hypot(trains[0].x - trainBefore.x, trains[0].z - trainBefore.z) > 0.2,
    'Trains/metros must travel continuously along rail network',
  );
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

  // 3. Verify dinosaur can also smash nearby environmental trees when no combat units are present
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
  const bushTile = getTile(dinoState, 65, 64)!;
  bushTile.resourceNode = 'berry_bush';
  bushTile.resourceAmount = 100;
  const dino = spawnUnit(dinoState, 'dinosaur', 64, 64).unit!;
  dino.actionCooldown = 0;
  dinoState.pendingVfx.length = 0;

  stepSimulation(dinoState, 0.1);
  assert.equal(bushTile.resourceNode, 'none', 'Dinosaur should smash nearby berry bush');
  assert.ok(
    dinoState.pendingVfx.some((v) => v.type === 'animal_attack' && v.variant === 'crunch'),
    'Dinosaur smashing environment should emit crunch animal_attack VFX',
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
  let breathCountDuringStrafe = 0;

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
        breathCountDuringStrafe++;
      }
    }
    state.pendingVfx.length = 0;
  }

  assert.ok(sawStrafe, 'Dragon must enter gliding strafe phase when carpet-bombing target');
  assert.ok(sawTurn, 'Dragon must transition to banking turn phase after gliding past target');
  assert.ok(
    breathCountDuringStrafe >= 2,
    `Dragon should spew multiple fire blasts while gliding across target (got ${breathCountDuringStrafe})`,
  );
  assert.ok(
    Math.hypot(dragon.x - startX, dragon.z - 64) > 1.5,
    'Dragon must glide across the map while carpet-bombing rather than stopping in 1 spot',
  );

  // Verify dinosaur does not stay locked on a tough stone outcrop when far from destroying it
  const rockTile = getTile(state, 58, 58)!;
  rockTile.resourceNode = 'stone_outcrop';
  rockTile.resourceAmount = 350;
  const dino = spawnUnit(state, 'dinosaur', 57, 58).unit!;
  dino.x = 57;
  dino.z = 58;
  dino.actionCooldown = 0;

  stepSimulation(state, 0.1);
  assert.ok(rockTile.resourceAmount < 350, 'Dinosaur should crunch stone outcrop once');
  assert.ok(rockTile.resourceAmount > 150, 'Stone outcrop is still far from destroyed');
  assert.equal(dino.state, 'moving', 'Dinosaur should immediately switch to moving/roaming instead of camping the rock');
});
