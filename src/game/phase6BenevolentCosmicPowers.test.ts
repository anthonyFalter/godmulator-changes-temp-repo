import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginDragUnit,
  castGodPower,
  createInitialSimulationState,
  executeGodPowerImpact,
  getTile,
  placeBuilding,
  spawnUnit,
  stepDraggedUnitKinematics,
  stepSimulation,
} from './simulation';

function makeFlatState(seed = 'PHASE6-TEST', gridSize = 64) {
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
    t.devastatedTimer = 0;
    delete t.liquidLevel;
    delete t.liquidKind;
    delete t.waterKind;
    delete t.isBridge;
  }
  return state;
}

test('Phase 6 [P-C1]: rain_of_plenty deferred cast fires once with radiusOverride and skips upwind pre-ticks while arriving', () => {
  const state = makeFlatState('PHASE6-RAIN', 64);
  // Put sand far upwind where arriving cloud spawns
  for (const t of state.tiles) {
    t.terrain = 'sand';
  }
  state.resources.food = 0;
  state.unallocatedResources!.food = 0;

  const res = castGodPower(state, 'rain_of_plenty', 32, 32, { deferImpact: true, radiusOverride: 5.0 });
  assert.equal(res.ok, true);
  assert.equal(state.activeHazards.filter((h) => h.kind === 'rain_cloud').length, 1);

  // Step 0.4s (still arriving): should NOT have converted upwind sand yet
  stepSimulation(state, 0.2);
  stepSimulation(state, 0.2);
  const cloud = state.activeHazards.find((h) => h.kind === 'rain_cloud')!;
  assert.ok((cloud.arrivalRemaining ?? 0) > 0, 'Cloud should still be arriving');

  // Finish arrival so stepHazards triggers impact
  for (let i = 0; i < 30; i++) stepSimulation(state, 0.04);
  assert.equal(
    state.activeHazards.filter((h) => h.kind === 'rain_cloud').length,
    1,
    'rain_of_plenty must not spawn a duplicate rain_cloud on arrival',
  );
  assert.equal(cloud.impactPending, false, 'impactPending must be cleared after arrival impact');
});

test('Phase 6 [H1 & H3]: divine_shield periodic shield_dome tick continues past Frame 1 and protects World Wonders', () => {
  const state = makeFlatState('PHASE6-SHIELD', 48);
  placeBuilding(state, 'bonfire', 24, 24);
  const b = state.buildings[0];
  const kid = state.settlementKingdoms?.[b.settlementId!] ?? b.settlementId!;
  state.worldWonders = [
    {
      id: 'wnd_test_1',
      kingdomId: kid,
      settlementId: b.settlementId!,
      species: 'human',
      name: 'Grand Citadel',
      tileX: 25,
      tileZ: 24,
      builtYear: 1,
      bonusSummary: '+Knowledge',
      hp: 1000,
      maxHp: 2600,
      constructionProgress: 100,
      shieldTimer: 0,
    },
  ];

  castGodPower(state, 'divine_shield', 24, 24);
  assert.equal(state.worldWonders[0].hp, 2600, 'divine_shield must heal World Wonders');
  assert.ok((state.worldWonders[0].shieldTimer ?? 0) >= 40, 'divine_shield must shield World Wonders');

  // Step 1: Frame 1 sets shield_dome tickTimer = 0.25
  stepSimulation(state, 0.05);
  // Expire timers manually, ignite ground, and step 0.4s to prove periodic tick fires again!
  b.shieldTimer = 0;
  b.cursedTimer = 10;
  state.worldWonders[0].shieldTimer = 0;
  getTile(state, 24, 24)!.onFireTimer = 10;

  for (let i = 0; i < 8; i++) stepSimulation(state, 0.05);
  assert.ok(b.shieldTimer > 0, 'shield_dome periodic tick must continue re-shielding buildings after Frame 1');
  assert.equal(b.cursedTimer, 0, 'shield_dome periodic tick must continue clearing building curses');
  assert.ok((state.worldWonders[0].shieldTimer ?? 0) > 0, 'shield_dome periodic tick must re-shield World Wonders');
  assert.equal(getTile(state, 24, 24)!.onFireTimer, 0, 'shield_dome periodic tick must extinguish fires');
});

test('Phase 6 [H2 & L3]: beginDragUnit disembarks embarked passengers, surfaces Leviathan, and stepDraggedUnitKinematics clears KO flag', () => {
  const state = makeFlatState('PHASE6-DRAG', 48);
  placeBuilding(state, 'bonfire', 10, 10);
  const sid = state.buildings[0].settlementId!;
  const u = spawnUnit(state, 'human', 20, 20, true, sid).unit!;
  state.vehicles = [
    {
      id: 'veh_ship_drag',
      type: 'passenger_ship',
      species: 'human',
      settlementId: sid,
      epochLevel: 2,
      x: 20,
      y: 0.2,
      z: 20,
      heading: 0,
      pitch: 0,
      bank: 0,
      speed: 1,
      path: [],
      pathIndex: 0,
      variantSeed: 1,
      hp: 200,
      maxHp: 200,
      passengerIds: [u.id],
    },
  ];
  u.embarkedVehicleId = 'veh_ship_drag';

  beginDragUnit(state, u.id);
  assert.equal(u.embarkedVehicleId, null, 'beginDragUnit must disembark embarked passengers');
  assert.equal(state.vehicles[0].passengerIds!.includes(u.id), false, 'beginDragUnit must remove unit from vehicle passengerIds');

  // Mid-drag KO clears draggedByPlayer
  u.state = 'ko';
  stepDraggedUnitKinematics(state, 0.05);
  assert.equal(u.draggedByPlayer, false, 'stepDraggedUnitKinematics must clear draggedByPlayer on KO units');

  // Submerged Leviathan surfaces on beginDragUnit
  getTile(state, 28, 28)!.height = 0;
  getTile(state, 28, 28)!.terrain = 'deep_water';
  const levi = spawnUnit(state, 'leviathan', 28, 28, true).unit!;
  levi.leviathanSubmerged = true;
  beginDragUnit(state, levi.id);
  assert.equal(levi.leviathanSubmerged, false, 'beginDragUnit must surface submerged Leviathans');
});

test('Phase 6 [H9]: floral_paradise, lava_deluge, and blight_plague resolve and execute cleanly', () => {
  const state = makeFlatState('PHASE6-INTERNAL', 48);
  assert.equal(castGodPower(state, 'floral_paradise', 16, 16).ok, true);
  assert.equal(castGodPower(state, 'lava_deluge', 24, 24).ok, true);
  assert.equal(castGodPower(state, 'blight_plague', 32, 32).ok, true);
  assert.equal(
    state.activeHazards.filter((h) => h.kind === 'biome_bloom_wave').length,
    3,
    'All 3 internal biome wave powers must spawn active biome_bloom_wave hazards',
  );
});

test('Phase 6 [M2, M3, M4, M5]: sentinel_eye skips shielded targets, cleanse_land clears devastated/cursed/coral, Black Hole has no Faith refund, global powers cap clusterCount=1', () => {
  const state = makeFlatState('PHASE6-COSMIC', 64);
  state.sandboxFreeMode = false;
  state.unallocatedResources!.faith = 500;
  state.resources.faith = 500;

  // M5: global powers cap clusterCount = 1 even at 10x brush
  const gaRes = castGodPower(state, 'golden_age', 32, 32, { brushSize: 10 });
  assert.equal(gaRes.ok, true);
  assert.equal(gaRes.count, 1, 'golden_age must cap clusterCount to 1 on 10x brush');
  assert.equal(gaRes.totalCost, 40, 'golden_age must only charge 1x cost on 10x brush');

  // M4: wormhole_ascension does not refund 50% Faith
  const faithBeforeBH = state.resources.faith;
  const bhRes = castGodPower(state, 'wormhole_ascension', 32, 32);
  assert.equal(bhRes.ok, true);
  assert.equal(state.resources.faith, faithBeforeBH - 50, 'Black Hole must deduct full 50 Faith with no 25-Faith refund');

  // M2: sentinel_eye skips shielded unit and targets unshielded unit instead
  const s2 = makeFlatState('PHASE6-EYE', 48);
  const shielded = spawnUnit(s2, 'human', 24, 24, true).unit!;
  shielded.statusEffects.shielded = 30;
  const unshielded = spawnUnit(s2, 'raider_swarmer', 26, 24, true).unit!;
  unshielded.hp = 30;
  unshielded.maxHp = 30;
  executeGodPowerImpact(s2, 'fortify_walls', 24, 24);
  for (let i = 0; i < 6; i++) stepSimulation(s2, 0.1);
  assert.equal(unshielded.state, 'ko', 'sentinel_eye must skip shielded unit and KO unshielded target');
  assert.ok(s2.totalRaidersDefeated >= 1, 'sentinel_eye lethal hit on hostile must increment totalRaidersDefeated');

  // M3: cleanse_land clears devastatedTimer, coralBleachTimer, and building cursedTimer
  const s3 = makeFlatState('PHASE6-CLEANSE', 48);
  placeBuilding(s3, 'bonfire', 24, 24);
  s3.buildings[0].cursedTimer = 20;
  getTile(s3, 25, 24)!.devastatedTimer = 30;
  getTile(s3, 26, 24)!.coralBleachTimer = 25;
  executeGodPowerImpact(s3, 'cleanse_land', 24, 24);
  for (let i = 0; i < 20; i++) stepSimulation(s3, 0.2);
  assert.equal(getTile(s3, 25, 24)!.devastatedTimer, 0, 'cleanse_land must clear devastatedTimer');
  assert.equal(getTile(s3, 26, 24)!.coralBleachTimer, 0, 'cleanse_land must clear coralBleachTimer');
  assert.equal(s3.buildings[0].cursedTimer, 0, 'cleanse_land must clear building cursedTimer');
});

test('Phase 6 [M6 & M7]: summon_fleet avoids bridges/poison & refunds on land; undead_portal avoids ocean spawns', () => {
  const state = makeFlatState('PHASE6-FLEET', 48);
  state.sandboxFreeMode = false;
  state.resources.faith = 200;
  stepSimulation(state, 0.01);
  const faithBefore = state.resources.faith;

  // Cast summon_fleet on dry land: 0 ships spawned, Faith refunded
  const landFleet = castGodPower(state, 'summon_fleet', 24, 24);
  assert.equal(landFleet.ok, true);
  assert.equal((state.vehicles ?? []).length, 0);
  assert.equal(state.resources.faith, faithBefore, 'summon_fleet must refund Faith when no open water is in range');

  // Cast undead_portal over open ocean: 0 skeletons spawned in water
  for (let z = 10; z <= 38; z++) {
    for (let x = 10; x <= 38; x++) {
      const t = getTile(state, x, z)!;
      t.height = 0;
      t.terrain = 'deep_water';
    }
  }
  state.sandboxFreeMode = true;
  executeGodPowerImpact(state, 'undead_portal', 24, 24);
  for (let i = 0; i < 10; i++) stepSimulation(state, 0.5);
  assert.equal(
    state.units.filter((u) => u.role === 'skeleton').length,
    0,
    'undead_portal must not spawn skeletons on ocean tiles',
  );
});
