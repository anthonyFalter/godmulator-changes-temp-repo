import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceEpoch,
  applyTerrainTool,
  castGodPower,
  createInitialSimulationState,
  formatYearLabel,
  getMaxCityBuildings,
  getMaxCityFarmFields,
  getTile,
  placeBuilding,
  spawnRaiderWave,
  spawnUnit,
  stepSimulation,
} from './simulation';
import { EPOCHS, SPECIES_UNITS } from './catalog';

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

  // Advance through Classical (2), Industrial (3), Atomic (4), to Orbital Age (5) and verify buildings progress step-by-step to Orbital sci-fi
  while (state.epochIndex < 5) {
    advanceEpoch(state, true);
    for (let i = 0; i < 35; i++) stepSimulation(state, 0.2);
  }
  assert.equal(state.epochIndex, 5);
  assert.equal(hearth.epochLevel, 5, 'Hearth must progress all the way to Orbital Age (epochLevel 5 techno-modern)');
  assert.equal(hut.epochLevel, 5, 'Forager hut must progress all the way to Orbital Age (epochLevel 5 bio-dome)');
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

