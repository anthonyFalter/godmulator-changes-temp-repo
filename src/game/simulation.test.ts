import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceEpoch,
  applyTerrainTool,
  castGodPower,
  createInitialSimulationState,
  formatYearLabel,
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
  assert.equal(treeTile.resourceNode, 'none', 'Nearby timber grove should be felled after harvesting');
  assert.equal(treeTile.terrain, 'grass', 'Deforested tile should transform from forest to grass');
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


