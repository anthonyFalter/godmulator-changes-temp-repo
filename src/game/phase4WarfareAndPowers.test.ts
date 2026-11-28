import test from 'node:test';
import assert from 'node:assert/strict';
import {
  castGodPower,
  createInitialSimulationState,
  getKingdomId,
  getKingdomRelation,
  getTile,
  placeBuilding,
  setKingdomEpoch,
  setKingdomRelation,
  spawnUnit,
  stepSimulation,
  stepStrategicWarfare,
  triggerRandomWorldEvent,
} from './simulation';
import type { BuildingEntity, SimulationState, SpeciesId, UnitEntity, VehicleEntity } from './types';

function makeCleanLandSim(gridSize = 64, seed = 'PHASE4-TEST'): SimulationState {
  const sim = createInitialSimulationState(gridSize, seed);
  sim.wildlifeSeeded = true;
  for (let i = 0; i < sim.tiles.length; i++) {
    const t = sim.tiles[i];
    t.height = 2;
    t.terrain = 'grass';
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    t.buildingId = null;
    t.onFireTimer = 0;
    t.devastatedTimer = 0;
    t.waterKind = undefined;
  }
  sim.buildings = [];
  sim.units = [];
  sim.vehicles = [];
  sim.pendingVfx = [];
  sim.activeStrategicStrikes = [];
  sim.activeHazards = [];
  sim.kingdomRelations = {};
  sim.kingdomPeaceTreaties = {};
  sim.kingdomPeacefulTraits = {};
  sim.kingdomUltimateCooldowns = {};
  sim.settlementRebuildCooldowns = {};
  return sim;
}

function seedKingdom(
  sim: SimulationState,
  kingdomId: string,
  species: SpeciesId,
  epoch: number,
  cx: number,
  cz: number,
  buildingCount: number,
  unitCount: number,
): void {
  sim.settlementSpecies = sim.settlementSpecies ?? {};
  sim.settlementNames = sim.settlementNames ?? {};
  sim.settlementKingdoms = sim.settlementKingdoms ?? {};
  sim.kingdomResources = sim.kingdomResources ?? {};
  sim.settlementSpecies[kingdomId] = species;
  sim.settlementNames[kingdomId] = `City_${kingdomId}`;
  sim.settlementKingdoms[kingdomId] = kingdomId;
  sim.kingdomResources[kingdomId] = {
    wood: 600,
    stone: 600,
    food: 600,
    ore: 600,
    knowledge: 600,
    energy: 600,
    alloy: 600,
    faith: 0,
  };
  setKingdomEpoch(sim, kingdomId, epoch);

  const facilityType: BuildingEntity['type'] =
    epoch >= 4
      ? species === 'human'
        ? 'launch_arcology'
        : species === 'elf'
          ? 'observatory'
          : 'fission_reactor'
      : 'steam_foundry';

  const offsets: ReadonlyArray<readonly [number, number, BuildingEntity['type']]> = [
    [0, 0, 'bonfire'],
    [2, 0, facilityType],
    [-2, 0, 'guildhall'],
    [0, 2, 'forager_hut'],
    [0, -2, 'granary'],
    [2, 2, 'smeltery'],
    [-2, 2, 'forager_hut'],
    [2, -2, 'forager_hut'],
    [-2, -2, 'forager_hut'],
    [4, 0, 'forager_hut'],
  ];

  for (let i = 0; i < Math.min(buildingCount, offsets.length); i++) {
    const [dx, dz, bType] = offsets[i];
    const tx = cx + dx;
    const tz = cz + dz;
    const id = `${kingdomId}_b_${i}`;
    const b: BuildingEntity = {
      id,
      type: bType,
      tileX: tx,
      tileZ: tz,
      hp: 300,
      maxHp: 300,
      constructionProgress: 100,
      epochLevel: epoch,
      blessedTimer: 0,
      cursedTimer: 0,
      shieldTimer: 0,
      settlementId: kingdomId,
      species,
    };
    sim.buildings.push(b);
    const tile = getTile(sim, tx, tz);
    if (tile) tile.buildingId = id;
  }

  for (let u = 0; u < unitCount; u++) {
    const unit: UnitEntity = {
      id: `${kingdomId}_u_${u}`,
      name: `${kingdomId}_Warrior_${u}`,
      role: 'warrior',
      faction: 'civilization',
      species,
      x: cx + ((u % 4) - 1.5),
      z: cz + 1.2 + Math.floor(u / 4) * 0.6,
      targetX: cx,
      targetZ: cz,
      hp: 180,
      maxHp: 180,
      state: 'idle',
      koTimer: 0,
      statusEffects: {},
      carryingType: null,
      carryingAmount: 0,
      actionCooldown: 0,
      windupTimer: 0,
      targetEntityId: null,
      settlementId: kingdomId,
      kingdomId,
    };
    sim.units.push(unit);
  }
}

test('Phase 4 [C8]: super_tornado random world event and direct castGodPower spawn active super tornado vortex', () => {
  const sim = makeCleanLandSim(64, 'P4-C8-TORNADO');
  sim.resources.faith = 500;

  const ev = triggerRandomWorldEvent(sim, 'super_tornado');
  assert.ok(ev, 'triggerRandomWorldEvent("super_tornado") must return event metadata');
  const superVortex = (sim.activeHazards ?? []).find(
    (h) => h.kind === 'tornado_vortex' && h.isSuper === true,
  );
  assert.ok(superVortex, 'super_tornado random event must spawn an active tornado_vortex hazard with isSuper=true');
  assert.ok(superVortex.radius >= 6, `super_tornado vortex should have mega radius >= 6 (got ${superVortex.radius})`);

  // Direct castGodPower('super_tornado', ...) must also resolve instead of failing silently
  const sim2 = makeCleanLandSim(64, 'P4-C8-DIRECT');
  sim2.resources.faith = 500;
  const castRes = castGodPower(sim2, 'super_tornado', 32, 32, { brushSize: 1 });
  assert.equal(castRes.ok, true, `castGodPower('super_tornado') must succeed (got ${castRes.reason})`);
  assert.ok(
    (sim2.activeHazards ?? []).some((h) => h.kind === 'tornado_vortex' && h.isSuper === true),
    'Direct castGodPower("super_tornado") must create a super tornado hazard',
  );
});

test('Phase 4 [H6]: start_war respects warsEnabled=false and single-nation start_war prefers neutral rivals over closer allies', () => {
  // Part 1: warsEnabled = false must NOT mutate diplomacy, break alliances/treaties, or increment warsStarted
  const simOff = makeCleanLandSim(64, 'P4-H6-OFF');
  simOff.sandboxFreeMode = true;
  simOff.worldRules = { ...simOff.worldRules!, warsEnabled: false };
  seedKingdom(simOff, 'k_a', 'human', 3, 20, 30, 3, 3);
  seedKingdom(simOff, 'k_b', 'elf', 3, 36, 30, 3, 3);
  setKingdomRelation(simOff, 'k_a', 'k_b', 'allied');
  simOff.kingdomPeaceTreaties = { 'k_a::k_b': simOff.year + 200 };
  const warsBefore = simOff.worldStats?.warsStarted ?? 0;

  castGodPower(simOff, 'start_war', 28, 30, { radiusOverride: 14 });
  assert.equal(
    getKingdomRelation(simOff, 'k_a', 'k_b'),
    'allied',
    'start_war must NOT break alliances or declare war when warsEnabled=false',
  );
  assert.equal(
    simOff.kingdomPeaceTreaties?.['k_a::k_b'] !== undefined,
    true,
    'start_war must NOT erase peace treaties when warsEnabled=false',
  );
  assert.equal(
    simOff.worldStats?.warsStarted ?? 0,
    warsBefore,
    'start_war must NOT increment warsStarted when warsEnabled=false',
  );
  assert.equal(
    simOff.kingdomPeacefulTraits?.['k_a'],
    false,
    'start_war with warsEnabled=false may still shift target kingdom trait to expansionist',
  );

  // Part 2: single-nation start_war with warsEnabled=true prefers a neutral kingdom over a closer allied kingdom
  const simPref = makeCleanLandSim(64, 'P4-H6-PREF');
  simPref.sandboxFreeMode = true;
  simPref.worldRules = { ...simPref.worldRules!, warsEnabled: true };
  seedKingdom(simPref, 'k_src', 'human', 3, 10, 30, 3, 3);
  seedKingdom(simPref, 'k_ally_close', 'elf', 3, 32, 30, 3, 3);
  seedKingdom(simPref, 'k_neutral_far', 'dwarf', 3, 54, 30, 3, 3);
  setKingdomRelation(simPref, 'k_src', 'k_ally_close', 'allied');
  setKingdomRelation(simPref, 'k_src', 'k_neutral_far', 'neutral');

  // Cast tightly over k_src only (outside k_ally_close's radius) so single-nation target selection runs
  castGodPower(simPref, 'start_war', 10, 30, { radiusOverride: 2 });
  assert.equal(
    getKingdomRelation(simPref, 'k_src', 'k_neutral_far'),
    'war',
    'Single-nation start_war must target a neutral rival before betraying a closer ally',
  );
  assert.equal(
    getKingdomRelation(simPref, 'k_src', 'k_ally_close'),
    'allied',
    'Closer ally must remain allied when a neutral rival is available',
  );
});

test('Phase 4 [H5]: bombed/devastated settlements do not replant farms, terrace quarries, pave bridges/rails/runways, or drop homeless bonfires on scorched land', () => {
  const sim = makeCleanLandSim(64, 'P4-H5-AFTERMATH');
  sim.sandboxFreeMode = true;
  seedKingdom(sim, 'k_bombed', 'human', 4, 30, 30, 6, 6);

  // Put city into post-war recovery and mark surrounding tiles burning/devastated
  sim.settlementRebuildCooldowns = { k_bombed: 45 };
  for (let z = 24; z <= 36; z++) {
    for (let x = 24; x <= 36; x++) {
      const t = getTile(sim, x, z)!;
      if (!t.buildingId) {
        t.terrain = 'scorched';
        t.height = 1;
        t.onFireTimer = 12;
        t.devastatedTimer = 30;
      }
    }
  }
  // Place a narrow water channel next to the bombed city to verify bridges are also paused
  for (let z = 28; z <= 32; z++) {
    const wt = getTile(sim, 37, z)!;
    wt.height = 0;
    wt.terrain = 'shallow_water';
  }
  // Place a homeless survivor on devastated ground outside the bombed city
  const homeless = spawnUnit(sim, 'human', 26, 26, true).unit!;
  homeless.settlementId = undefined;
  homeless.kingdomId = 'k_bombed';

  const bldCountBefore = sim.buildings.length;
  for (let i = 0; i < 20; i++) stepSimulation(sim, 0.25);

  // No new bonfires founded by homeless survivor while kingdom is recovering / on devastated tiles
  assert.equal(
    sim.buildings.length,
    bldCountBefore,
    'Homeless survivor must not immediately drop a new bonfire on burning/devastated terrain during aftermath',
  );

  // No scorched/devastated tiles converted into farm plots, fertile soil, stone_road, or rail_track
  let rebuiltTiles = 0;
  for (let z = 24; z <= 36; z++) {
    for (let x = 24; x <= 36; x++) {
      const t = getTile(sim, x, z)!;
      if (
        !t.buildingId &&
        (Boolean(t.farmPlotKind) ||
          t.terrain === 'fertile' ||
          t.terrain === 'rail_track' ||
          t.terrain === 'stone_road')
      ) {
        rebuiltTiles++;
      }
    }
  }
  assert.equal(
    rebuiltTiles,
    0,
    `Post-war aftermath tiles must not be leveled/replanted/paved during rebuild cooldown (found ${rebuiltTiles})`,
  );

  // Bridge must not be laid across water while settlement is recovering
  const bridgedWater = [28, 29, 30, 31, 32].some((z) => getTile(sim, 37, z)!.terrain === 'stone_road');
  assert.equal(bridgedWater, false, 'Recovering settlement must not construct bridges during aftermath cooldown');
});

test('Phase 4 [H7]: Orcs launch Epoch 4+ strategic superweapon (orc_waagh_cataclysm) and Dwarves & Lizardfolk unleash battlefield ultimates', () => {
  // 1. Orc strategic superweapon (orc_waagh_cataclysm) strips building shields & craters target
  const simOrc = makeCleanLandSim(64, 'P4-H7-ORC');
  seedKingdom(simOrc, 'orc_emp', 'orc', 4, 12, 12, 9, 16);
  seedKingdom(simOrc, 'hum_tgt', 'human', 4, 50, 50, 6, 8);
  for (const b of simOrc.buildings) {
    if (b.settlementId === 'hum_tgt') {
      b.shieldTimer = 30;
    }
  }
  setKingdomRelation(simOrc, 'orc_emp', 'hum_tgt', 'war');

  stepStrategicWarfare(simOrc, 4.0);
  const orcSuper = (simOrc.activeStrategicStrikes ?? []).find(
    (s) => s.attackerKingdomId === 'orc_emp' && s.kind === 'orc_waagh_cataclysm' && s.isSuperweapon === true,
  );
  assert.ok(orcSuper, 'Epoch 4+ Orc kingdom with superweapon facility must launch orc_waagh_cataclysm (isSuperweapon=true)');

  // Detonate the Orc superweapon on arrival
  simOrc.pendingVfx = [];
  stepStrategicWarfare(simOrc, orcSuper.flightDuration + 0.2);
  assert.ok(
    simOrc.pendingVfx.some((v) => v.type === 'nuke_blast'),
    'orc_waagh_cataclysm must emit heavy crimson blast VFX on arrival',
  );
  const targetBlds = simOrc.buildings.filter((b) => b.settlementId === 'hum_tgt');
  const strippedOrDamaged = targetBlds.some((b) => b.shieldTimer === 0 || b.hp < b.maxHp);
  assert.ok(strippedOrDamaged, 'orc_waagh_cataclysm must strip shields and damage enemy structures');

  // 2. Dwarf battlefield ultimate (Seismic Slam) in Epoch 4+ combat
  const simDwarf = makeCleanLandSim(64, 'P4-H7-DWARF');
  simDwarf.sandboxFreeMode = true;
  placeBuilding(simDwarf, 'bonfire', 16, 32);
  placeBuilding(simDwarf, 'bonfire', 48, 32);
  const dIds = Array.from(new Set(simDwarf.buildings.map((b) => b.settlementId!)));
  setKingdomEpoch(simDwarf, dIds[0], 5);
  setKingdomEpoch(simDwarf, dIds[1], 1);
  setKingdomRelation(simDwarf, dIds[0], dIds[1], 'war');

  const dHero = spawnUnit(simDwarf, 'dwarf', 30, 32, true).unit!;
  dHero.role = 'warrior';
  dHero.settlementId = dIds[0];
  dHero.kingdomId = getKingdomId(simDwarf, dIds[0]);
  dHero.weaponCooldown = 0;
  const dBoss = spawnUnit(simDwarf, 'orc', 33, 32, true).unit!;
  dBoss.settlementId = dIds[1];
  dBoss.kingdomId = getKingdomId(simDwarf, dIds[1]);
  dBoss.hp = 600;
  dBoss.maxHp = 600;

  for (let i = 0; i < 12; i++) stepSimulation(simDwarf, 0.1);
  const sawDwarfUlt = simDwarf.pendingVfx.some(
    (v) => v.vfxSubtype === 'dwarf_quake_mortar' || (v.type === 'nuke_blast' && v.species === 'dwarf'),
  );
  assert.ok(sawDwarfUlt, 'Epoch 4+ Dwarf combatant must unleash Seismic Slam battlefield ultimate against worthy threat');

  // 3. Lizardfolk battlefield ultimate (Solar Beam) in Epoch 4+ combat
  const simLiz = makeCleanLandSim(64, 'P4-H7-LIZARD');
  simLiz.sandboxFreeMode = true;
  placeBuilding(simLiz, 'bonfire', 16, 32);
  placeBuilding(simLiz, 'bonfire', 48, 32);
  const lIds = Array.from(new Set(simLiz.buildings.map((b) => b.settlementId!)));
  setKingdomEpoch(simLiz, lIds[0], 5);
  setKingdomEpoch(simLiz, lIds[1], 1);
  setKingdomRelation(simLiz, lIds[0], lIds[1], 'war');

  const lHero = spawnUnit(simLiz, 'lizardfolk', 30, 32, true).unit!;
  lHero.role = 'warrior';
  lHero.settlementId = lIds[0];
  lHero.kingdomId = getKingdomId(simLiz, lIds[0]);
  lHero.weaponCooldown = 0;
  const lBoss = spawnUnit(simLiz, 'orc', 33, 32, true).unit!;
  lBoss.settlementId = lIds[1];
  lBoss.kingdomId = getKingdomId(simLiz, lIds[1]);
  lBoss.hp = 600;
  lBoss.maxHp = 600;

  for (let i = 0; i < 12; i++) stepSimulation(simLiz, 0.1);
  const sawLizUlt = simLiz.pendingVfx.some(
    (v) => v.vfxSubtype === 'lizard_solar_lance' || (v.type === 'arcane_cataclysm' && v.species === 'lizardfolk'),
  );
  assert.ok(sawLizUlt, 'Epoch 4+ Lizardfolk combatant must unleash Solar Beam battlefield ultimate against worthy threat');
});

test('Phase 4 [M9]: Bomber/Orbital Gunship payloads apply species-specific environmental impacts and damage enemy vehicles in splash radius', () => {
  const sim = makeCleanLandSim(64, 'P4-M9-BOMBER');
  sim.sandboxFreeMode = true;
  seedKingdom(sim, 'liz_k', 'lizardfolk', 5, 14, 32, 4, 4);
  seedKingdom(sim, 'hum_k', 'human', 5, 42, 32, 4, 4);
  setKingdomRelation(sim, 'liz_k', 'hum_k', 'war');

  // Spawn a Lizardfolk bomber right over the human target + an enemy tank right at ground zero
  const bomber: VehicleEntity = {
    id: 'test_liz_bomber',
    type: 'bomber_plane',
    x: 41.2,
    y: 3.4,
    z: 32,
    heading: Math.PI / 2,
    pitch: 0,
    bank: 0,
    speed: 6,
    path: [{ x: 42, z: 32 }],
    pathIndex: 0,
    variantSeed: 1,
    epochLevel: 5,
    settlementId: 'liz_k',
    kingdomId: 'liz_k',
    species: 'lizardfolk',
    isMilitary: true,
    hp: 300,
    maxHp: 300,
    attackCooldown: 0,
  };
  const enemyTank: VehicleEntity = {
    id: 'test_enemy_tank',
    type: 'tank',
    x: 42,
    y: 0.1,
    z: 32,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 2,
    path: [{ x: 42, z: 32 }],
    pathIndex: 0,
    variantSeed: 2,
    epochLevel: 5,
    settlementId: 'hum_k',
    kingdomId: 'hum_k',
    species: 'human',
    isMilitary: true,
    hp: 400,
    maxHp: 400,
    attackCooldown: 5,
  };
  sim.vehicles = [bomber, enemyTank];
  const targetTile = getTile(sim, 42, 32)!;
  targetTile.height = 4;
  targetTile.terrain = 'grass';

  for (let i = 0; i < 8; i++) stepSimulation(sim, 0.1);

  assert.ok(
    (enemyTank.hp ?? 400) < 400,
    `Bomber super-payload must splash damage onto enemy vehicles in blast radius (tank hp=${enemyTank.hp})`,
  );
  // Lizardfolk solar payload ignites golden sunfire (#facc15), distinct from Elf violet arcane (#c084fc)
  assert.equal(
    targetTile.fireColor,
    '#facc15',
    `Lizardfolk bomber payload must apply solar environmental impact (#facc15 sunfire, got ${targetTile.fireColor})`,
  );
});

test('Phase 4 [L2]: Military vehicles do not spawn when warsEnabled is false', () => {
  const sim = makeCleanLandSim(64, 'P4-L2-NOWAR-VEH');
  sim.sandboxFreeMode = true;
  sim.worldRules = { ...sim.worldRules!, warsEnabled: false };
  // Give coastline so naval warships would otherwise spawn
  for (let z = 10; z <= 54; z++) {
    for (let x = 44; x <= 58; x++) {
      const t = getTile(sim, x, z)!;
      t.height = 0;
      t.terrain = 'deep_water';
    }
  }
  seedKingdom(sim, 'k_peace', 'human', 5, 36, 32, 6, 8);

  for (let i = 0; i < 16; i++) stepSimulation(sim, 0.25);
  const military = (sim.vehicles ?? []).filter((v) => v.isMilitary);
  assert.equal(
    military.length,
    0,
    `No military vehicles may spawn when warsEnabled=false (found ${military.map((v) => v.type).join(',')})`,
  );
});

test('Phase 4 [L3]: quarry_truck despawns when foundry is destroyed/flooded and farm_tractor skips burning/devastated tiles', () => {
  // Part 1: quarry_truck stops shuttling and despawns when its foundry is destroyed
  const simQ = makeCleanLandSim(64, 'P4-L3-QUARRY');
  simQ.sandboxFreeMode = true;
  seedKingdom(simQ, 'k_q', 'human', 3, 28, 28, 3, 4);
  const foundry = simQ.buildings.find((b) => b.type === 'steam_foundry' || b.type === 'smeltery');
  const oreTile = getTile(simQ, 34, 28)!;
  oreTile.terrain = 'rock';
  oreTile.resourceNode = 'ore_vein';
  oreTile.resourceAmount = 100;

  const truck: VehicleEntity = {
    id: 'test_quarry_truck',
    type: 'quarry_truck',
    x: 30,
    y: 0.08,
    z: 28,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 2,
    path: [
      { x: foundry ? foundry.tileX : 30, z: foundry ? foundry.tileZ : 28 },
      { x: 34, z: 28 },
    ],
    pathIndex: 0,
    variantSeed: 1,
    epochLevel: 3,
    settlementId: 'k_q',
    kingdomId: 'k_q',
    species: 'human',
    isMilitary: false,
    hp: 100,
    maxHp: 100,
  };
  simQ.vehicles = [truck];

  // Destroy ALL foundries/smelteries in k_q
  simQ.buildings = simQ.buildings.filter((b) => b.type !== 'steam_foundry' && b.type !== 'smeltery');

  for (let i = 0; i < 4; i++) stepSimulation(simQ, 0.25);
  assert.equal(
    (simQ.vehicles ?? []).some((v) => v.id === 'test_quarry_truck'),
    false,
    'quarry_truck must despawn instead of shuttling forever once its foundry is destroyed',
  );

  // Part 2: farm_tractor skips harvesting/replanting burning or devastated tiles
  const simF = makeCleanLandSim(64, 'P4-L3-TRACTOR');
  simF.sandboxFreeMode = true;
  seedKingdom(simF, 'k_f', 'human', 3, 28, 28, 3, 4);
  const burnTile = getTile(simF, 32, 28)!;
  burnTile.terrain = 'scorched';
  burnTile.farmSettlementId = 'k_f';
  burnTile.farmPlotKind = 'wheat';
  burnTile.onFireTimer = 10;
  burnTile.devastatedTimer = 25;
  burnTile.resourceNode = 'none';
  burnTile.resourceAmount = 0;

  const foodBefore = simF.kingdomResources!['k_f'].food;
  const tractor: VehicleEntity = {
    id: 'test_farm_tractor',
    type: 'farm_tractor',
    x: 32,
    y: 0.08,
    z: 28,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 2,
    path: [
      { x: 32, z: 28 },
      { x: 32, z: 28 },
    ],
    pathIndex: 0,
    variantSeed: 2,
    epochLevel: 3,
    settlementId: 'k_f',
    kingdomId: 'k_f',
    species: 'human',
    isMilitary: false,
    hp: 100,
    maxHp: 100,
  };
  simF.vehicles = [tractor];

  for (let i = 0; i < 6; i++) stepSimulation(simF, 0.25);
  assert.equal(
    burnTile.resourceNode,
    'none',
    'farm_tractor must NOT replant crops on burning/devastated farmland',
  );
  assert.ok(
    simF.kingdomResources!['k_f'].food <= foodBefore,
    `farm_tractor must NOT harvest free food from burning/devastated terrain (before=${foodBefore}, after=${simF.kingdomResources!['k_f'].food})`,
  );
});
