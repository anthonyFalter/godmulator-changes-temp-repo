import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ANIMAL_ROLE_SET,
  ANIMAL_UNITS,
  FLYING_WILDLIFE_ROLES,
  MYTHICAL_BEAST_UNITS,
  MYTHICAL_ROLE_SET,
  UNITS,
  getUnitMaxLifespan,
} from './catalog';
import { createUnitGroup, disposeEntityGroup } from './meshBuilders';
import { getEntityInspectProfile, isIntrinsicGene } from './entityInspector';
import {
  DEFAULT_WORLD_RULES,
  createInitialSimulationState,
  spawnUnit,
  stepSimulation,
} from './simulation';
import { UNIT_SPRITES } from '../components/icons/unitSprites';
import type { AnimalRole } from './types';

const EXPANDED_WILDLIFE_ROLES: AnimalRole[] = [
  'deer',
  'sheep',
  'rabbit',
  'fox',
  'boar',
  'lion',
  'elephant',
  'camel',
  'penguin',
  'crocodile',
  'horse',
  'goat',
  'monkey',
  'panda',
  'polar_bear',
  'hippo',
  'rhino',
  'turtle',
  'frog',
  'crab',
  'giraffe',
  'zebra',
  'tiger',
  'gorilla',
  'kangaroo',
  'moose',
  'bison',
  'flamingo',
  'ostrich',
  'seal',
];

const EXPANDED_MYTHICAL_ROLES: AnimalRole[] = [
  'phoenix',
  'griffin',
  'yeti',
  'golem',
  'kitsune',
  'hydra',
  'minotaur',
  'pegasus',
  'cerberus',
  'ent',
  'basilisk',
  'thunderbird',
  'kraken',
  'manticore',
  'gargoyle',
];

const ALL_EXPANDED_ROLES: AnimalRole[] = [...EXPANDED_WILDLIFE_ROLES, ...EXPANDED_MYTHICAL_ROLES];

test('catalog registers 37 wildlife units and 18 mythical beasts with clean names', () => {
  assert.equal(ANIMAL_UNITS.length, 37);
  assert.equal(MYTHICAL_BEAST_UNITS.length, 18);

  for (const unit of UNITS) {
    assert.ok(
      !/\(.*mythical.*\)|\b•\s*(wildlife|hostile|mythical)/i.test(unit.name),
      `Unit name should not include rarity or category labels: "${unit.name}"`,
    );
  }

  for (const role of EXPANDED_WILDLIFE_ROLES) {
    assert.ok(ANIMAL_UNITS.some((u) => u.role === role), `Missing wildlife catalog entry: ${role}`);
    assert.ok(ANIMAL_ROLE_SET.has(role), `ANIMAL_ROLE_SET missing: ${role}`);
    assert.ok(!MYTHICAL_ROLE_SET.has(role), `Wildlife role should not be in MYTHICAL_ROLE_SET: ${role}`);
  }

  for (const role of EXPANDED_MYTHICAL_ROLES) {
    assert.ok(
      MYTHICAL_BEAST_UNITS.some((u) => u.role === role),
      `Missing mythical catalog entry: ${role}`,
    );
    assert.ok(ANIMAL_ROLE_SET.has(role), `ANIMAL_ROLE_SET missing mythical: ${role}`);
    assert.ok(MYTHICAL_ROLE_SET.has(role), `MYTHICAL_ROLE_SET missing: ${role}`);
  }

  assert.ok(FLYING_WILDLIFE_ROLES.has('dragon'));
  assert.ok(FLYING_WILDLIFE_ROLES.has('phoenix'));
  assert.ok(FLYING_WILDLIFE_ROLES.has('griffin'));
  assert.ok(FLYING_WILDLIFE_ROLES.has('pegasus'));
  assert.ok(FLYING_WILDLIFE_ROLES.has('thunderbird'));
  assert.ok(FLYING_WILDLIFE_ROLES.has('manticore'));
  assert.ok(FLYING_WILDLIFE_ROLES.has('gargoyle'));
  assert.ok(!FLYING_WILDLIFE_ROLES.has('penguin'));
  assert.ok(!FLYING_WILDLIFE_ROLES.has('ostrich'));
});

test('all 45 expanded creatures build valid articulated 3D meshes and pixel sprites', () => {
  for (let i = 0; i < ALL_EXPANDED_ROLES.length; i++) {
    const role = ALL_EXPANDED_ROLES[i];
    const sprite = UNIT_SPRITES[role];
    assert.ok(sprite && sprite.runs.length > 0 && sprite.paths.length > 0, `Missing pixel sprite for ${role}`);

    const group = createUnitGroup(role, 'wildlife', 0, 'human', 101 + i * 17, 'adult');
    let meshCount = 0;
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        meshCount++;
      }
    });
    assert.ok(meshCount >= 2, `Expected rendered meshes for ${role}, got ${meshCount}`);
    assert.ok(group.getObjectByName('body_pivot'), `Expected body_pivot for ${role}`);
    assert.ok(group.getObjectByName('head_pivot'), `Expected head_pivot for ${role}`);

    if (
      role === 'phoenix' ||
      role === 'griffin' ||
      role === 'pegasus' ||
      role === 'thunderbird' ||
      role === 'manticore' ||
      role === 'gargoyle'
    ) {
      assert.ok(group.getObjectByName('wing_l'), `Expected wing_l for flying creature ${role}`);
      assert.ok(group.getObjectByName('wing_r'), `Expected wing_r for flying creature ${role}`);
    }
    if (role === 'phoenix' || role === 'griffin' || role === 'pegasus' || role === 'thunderbird') {
      assert.ok(group.getObjectByName('wing_outer_l'), `Expected wing_outer_l for ${role}`);
      assert.ok(group.getObjectByName('wing_outer_r'), `Expected wing_outer_r for ${role}`);
    }
    if (role === 'ent') {
      assert.ok(group.getObjectByName('treant_awakened'), 'Expected treant_awakened group on ent');
      assert.ok(group.getObjectByName('treant_disguised'), 'Expected treant_disguised oak tree group on ent');
    }
    if (role === 'gargoyle') {
      assert.ok(group.getObjectByName('gargoyle_awakened'), 'Expected gargoyle_awakened group on gargoyle');
      assert.ok(group.getObjectByName('gargoyle_statue'), 'Expected gargoyle_statue group on gargoyle');
    }
    if (role === 'penguin') {
      assert.ok(group.getObjectByName('wing_l'), 'Expected wing_l flipper for penguin');
      assert.ok(group.getObjectByName('wing_r'), 'Expected wing_r flipper for penguin');
    }

    disposeEntityGroup(group);
  }
});

test('entity inspector provides clean subtitles, tailored genes, items, and lifespans for all 45 expanded roles', () => {
  const state = createInitialSimulationState(48, 777);
  const center = Math.floor(state.gridSize / 2);
  state.tiles[center * state.gridSize + center].terrain = 'grass';
  state.tiles[center * state.gridSize + center].height = 2;

  for (const role of ALL_EXPANDED_ROLES) {
    const res = spawnUnit(state, role, center, center, true);
    assert.ok(res.ok && res.unit, `Failed to spawn ${role}: ${res.reason}`);

    const profile = getEntityInspectProfile(state, res.unit);
    assert.ok(
      !profile.subtitle.includes('•') && !profile.subtitle.includes('('),
      `Inspector subtitle for ${role} should only contain the creature name, got "${profile.subtitle}"`,
    );
    assert.ok(profile.genes.length >= 1, `Expected genes for ${role}`);
    assert.ok(
      isIntrinsicGene(profile.genes[0]),
      `Intrinsic gene "${profile.genes[0]}" for ${role} should be recognized by isIntrinsicGene`,
    );
    assert.notEqual(profile.genes[0], 'Adaptable', `${role} should have a species-specific intrinsic gene`);
    assert.ok(profile.items.length >= 2, `Expected tailored items for ${role}`);

    const expectedFaction = MYTHICAL_ROLE_SET.has(role) ? 'Mythical' : 'Wildlife';
    assert.equal(profile.factionLabel, expectedFaction, `Unexpected factionLabel for ${role}`);

    const lifespan = getUnitMaxLifespan({ role, species: res.unit.species, appearanceSeed: 42 });
    if (MYTHICAL_ROLE_SET.has(role)) {
      assert.ok(lifespan >= 240, `Expected mythical lifespan >= 240 for ${role}, got ${lifespan}`);
    } else {
      assert.ok(lifespan >= 8 && lifespan <= 140, `Expected wildlife lifespan for ${role}, got ${lifespan}`);
    }
  }
});

test('world seeding populates rich multi-species wildlife ecosystems and respects allowFantasy', () => {
  const normalWorld = createInitialSimulationState(96, 2025, { gridSize: 96 });
  const wildlife = normalWorld.units.filter((u) => u.faction === 'wildlife');
  const speciesCounts = new Map<string, number>();
  for (const u of wildlife) {
    speciesCounts.set(u.role, (speciesCounts.get(u.role) ?? 0) + 1);
  }

  assert.ok(
    wildlife.length >= 40,
    `Expected vibrant wildlife population (>= 40) on 96x96 map, got ${wildlife.length}`,
  );
  assert.ok(
    speciesCounts.size >= 8,
    `Expected diverse wildlife species (>= 8) on 96x96 map, got ${speciesCounts.size}`,
  );

  const largeWorld = createInitialSimulationState(160, 2025, { gridSize: 160 });
  const largeWildlife = largeWorld.units.filter((u) => u.faction === 'wildlife');
  assert.ok(
    largeWildlife.length > wildlife.length,
    `Expected 160x160 world (${largeWildlife.length}) to seed more wildlife than 96x96 (${wildlife.length})`,
  );

  const lowFantasyWorld = createInitialSimulationState(96, 2025, {
    gridSize: 96,
    rules: { ...DEFAULT_WORLD_RULES, allowFantasy: false },
  });
  const seededMythics = lowFantasyWorld.units.filter((u) => MYTHICAL_ROLE_SET.has(u.role));
  assert.equal(
    seededMythics.length,
    0,
    `Expected 0 mythical beasts when allowFantasy=false, found ${seededMythics.map((u) => u.role).join(', ')}`,
  );
});

test('Hydra bio-laser, Basilisk petrify, Thunderbird lightning, Manticore spikes, Kraken, Yeti, and Kitsune powers work', () => {
  const state = createInitialSimulationState(96, 999);
  const gs = state.gridSize;
  for (let z = 4; z <= 92; z++) {
    for (let x = 4; x <= 92; x++) {
      const t = state.tiles[z * gs + x];
      t.terrain = 'grass';
      t.height = 2;
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }
  // Carve an isolated deep ocean bay for Kraken
  for (let z = 72; z <= 84; z++) {
    for (let x = 72; x <= 84; x++) {
      const t = state.tiles[z * gs + x];
      t.terrain = 'deep_water';
      t.height = 0;
    }
  }

  state.wildlifeSeeded = true;
  state.units = [];
  state.pendingVfx = [];

  // 1. Yeti throws blocky ice_ball at a ranged hostile skeleton
  const yeti = spawnUnit(state, 'yeti', 14, 14, true).unit;
  const rangedSkel = spawnUnit(state, 'skeleton', 17.5, 14, true).unit;
  assert.ok(yeti && rangedSkel);

  // 2. Kitsune retaliates with foxfire_ball in self-defense & Spirit Blinks from melee
  const kitsune = spawnUnit(state, 'kitsune', 48, 14, true).unit;
  const wolfAttacker = spawnUnit(state, 'wolf', 49.4, 14, true).unit;
  assert.ok(kitsune && wolfAttacker);
  kitsune.lastAttackerId = wolfAttacker.id;
  kitsune.underAttackTimer = 8;

  // 3. Hydra fires emerald laser_beam and passively regenerates HP
  const hydra = spawnUnit(state, 'hydra', 80, 14, true).unit;
  const hydraTarget = spawnUnit(state, 'skeleton', 84.0, 14, true).unit;
  assert.ok(hydra && hydraTarget);
  hydra.hp = Math.floor(hydra.maxHp * 0.5);
  const hydraHpBefore = hydra.hp;

  // 4. Basilisk fires lime-gold petrifying gaze laser_beam that freezes its target
  const basilisk = spawnUnit(state, 'basilisk', 14, 48, true).unit;
  const basiliskTarget = spawnUnit(state, 'skeleton', 18.0, 48, true).unit;
  assert.ok(basilisk && basiliskTarget);

  // 5. Thunderbird calls down lightning_smite on foes
  const thunderbird = spawnUnit(state, 'thunderbird', 48, 48, true).unit;
  const thunderTarget = spawnUnit(state, 'skeleton', 51.0, 48, true).unit;
  assert.ok(thunderbird && thunderTarget);

  // 6. Manticore fires dual venom_ball tail spikes
  const manticore = spawnUnit(state, 'manticore', 14, 80, true).unit;
  const manticoreTarget = spawnUnit(state, 'skeleton', 17.8, 80, true).unit;
  assert.ok(manticore && manticoreTarget);

  // 7. Kraken fights in deep water without drowning
  const kraken = spawnUnit(state, 'kraken', 78, 78, true).unit;
  const krakenPrey = spawnUnit(state, 'skeleton', 79.5, 78, true).unit;
  assert.ok(kraken && krakenPrey);

  let sawIceBall = false;
  let sawFoxfireBall = false;
  let sawHydraLaser = false;
  let sawBasiliskLaser = false;
  let sawLightningSmite = false;
  let sawVenomBall = false;

  for (let i = 0; i < 45; i++) {
    stepSimulation(state, 0.1);
    for (const vfx of state.pendingVfx) {
      if (vfx.type === 'projectile_tracer' && vfx.vfxSubtype === 'ice_ball') sawIceBall = true;
      if (vfx.type === 'projectile_tracer' && vfx.vfxSubtype === 'foxfire_ball') sawFoxfireBall = true;
      if (vfx.type === 'projectile_tracer' && vfx.vfxSubtype === 'venom_ball') sawVenomBall = true;
      if (vfx.type === 'projectile_tracer' && vfx.vfxSubtype === 'laser_beam') {
        if (vfx.color === '#22ff88') sawHydraLaser = true;
        if (vfx.color === '#a3e635') sawBasiliskLaser = true;
      }
      if (vfx.type === 'lightning_smite') sawLightningSmite = true;
    }
    state.pendingVfx.length = 0;
  }

  assert.ok(sawIceBall, 'Yeti should throw a blocky ice_ball projectile at ranged foes');
  assert.ok(
    Boolean(rangedSkel.statusEffects.frozen) || rangedSkel.hp < rangedSkel.maxHp,
    'Yeti ice ball should freeze and damage the ranged hostile',
  );
  assert.ok(sawFoxfireBall, 'Kitsune should fire a blocky foxfire_ball in self-defense');
  assert.ok(
    wolfAttacker.hp < wolfAttacker.maxHp || wolfAttacker.state === 'ko',
    'Kitsune self-defense flame ball should damage the attacker',
  );
  assert.ok(sawHydraLaser, 'Hydra should fire an emerald bio-laser beam (#22ff88) at enemies');
  assert.ok(hydra.hp > hydraHpBefore, 'Hydra should passively regenerate health over time');
  assert.ok(sawBasiliskLaser, 'Basilisk should fire its lime-gold petrifying gaze laser_beam');
  assert.ok(
    Boolean(basiliskTarget.statusEffects.frozen) || basiliskTarget.hp < basiliskTarget.maxHp,
    'Basilisk petrifying gaze should freeze and damage its target',
  );
  assert.ok(sawLightningSmite, 'Thunderbird should call down lightning_smite bolts on enemies');
  assert.ok(sawVenomBall, 'Manticore should fire blocky venom_ball tail spikes at enemies');
  assert.notEqual(kraken.state, 'ko', 'Kraken should swim in deep ocean water without drowning');
  assert.ok(
    krakenPrey.hp < krakenPrey.maxHp || krakenPrey.state === 'ko',
    'Kraken should damage enemies in water with tentacle slams',
  );
});

test('Treant tree disguise, Gargoyle stone statue, Phoenix rebirth, Pegasus aura, and Arctic sea-ice survival work', () => {
  const state = createInitialSimulationState(64, 1234);
  const gs = state.gridSize;
  for (let z = 4; z <= 60; z++) {
    for (let x = 4; x <= 60; x++) {
      const t = state.tiles[z * gs + x];
      t.terrain = 'grass';
      t.height = 2;
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tBear = state.tiles[(12 + dz) * gs + (50 + dx)];
      tBear.terrain = 'ice';
      tBear.height = 0;
      const tSeal = state.tiles[(48 + dz) * gs + (50 + dx)];
      tSeal.terrain = 'ice';
      tSeal.height = 0;
    }
  }

  state.wildlifeSeeded = true;
  state.units = [];
  state.pendingVfx = [];

  // 1. Phoenix revives once via Rebirth from Ashes when reduced to 0 HP
  const phoenix = spawnUnit(state, 'phoenix', 14, 14, true).unit;
  assert.ok(phoenix);
  phoenix.hp = 0;

  // 2. Pegasus heals/blesses nearby wounded human
  const pegasus = spawnUnit(state, 'pegasus', 32, 14, true).unit;
  const woundedHuman = spawnUnit(state, 'human', 33, 14, true).unit;
  assert.ok(pegasus && woundedHuman);
  woundedHuman.hp = Math.floor(woundedHuman.maxHp * 0.4);
  const humanHpBefore = woundedHuman.hp;

  // 3. Peaceful Treant disguises as an ordinary oak tree & Gargoyle perches as stone statue
  const ent = spawnUnit(state, 'ent', 14, 48, true).unit;
  const gargoyle = spawnUnit(state, 'gargoyle', 32, 48, true).unit;
  assert.ok(ent && gargoyle);
  ent.treantIdleTimer = 3.5;
  gargoyle.treantIdleTimer = 3.5;
  gargoyle.hp = Math.floor(gargoyle.maxHp * 0.6);
  const gargoyleHpBefore = gargoyle.hp;

  // 4. Polar Bear & Seal survive safely on sea ice
  const polarBear = spawnUnit(state, 'polar_bear', 50, 12, true).unit;
  const seal = spawnUnit(state, 'seal', 50, 48, true).unit;
  assert.ok(polarBear && seal);

  let sawTreantDisguised = false;
  let sawGargoyleStatue = false;

  for (let i = 0; i < 30; i++) {
    stepSimulation(state, 0.1);
    if (ent.treantDisguised) sawTreantDisguised = true;
    if (gargoyle.gargoylePetrified) sawGargoyleStatue = true;
    state.pendingVfx.length = 0;
  }

  assert.equal(phoenix.phoenixReborn, true, 'Phoenix should revive once via Rebirth from Ashes');
  assert.notEqual(phoenix.state, 'ko', 'Reborn Phoenix should remain alive after reviving');
  assert.ok(phoenix.hp > 0, 'Reborn Phoenix should restore health upon rebirth');
  assert.ok(
    woundedHuman.hp > humanHpBefore || Boolean(woundedHuman.statusEffects.blessed),
    'Pegasus should heal or bless nearby wounded allies',
  );
  assert.ok(sawTreantDisguised, 'Peaceful Treant on dry land should disguise itself as an oak tree');
  assert.equal(
    getEntityInspectProfile(state, ent).informations.activity,
    'Disguised as Tree',
    'Inspector should report Disguised as Tree while Treant is disguised',
  );
  assert.ok(sawGargoyleStatue, 'Peaceful Gargoyle should perch as a stone statue');
  assert.ok(gargoyle.hp > gargoyleHpBefore, 'Petrified Gargoyle should regenerate HP quickly');
  assert.notEqual(polarBear.state, 'ko', 'Polar bear should walk safely on sea ice without drowning');
  assert.notEqual(seal.state, 'ko', 'Seal should thrive on sea ice without drowning');

  // Drop hostiles next to the disguised Treant & petrified Gargoyle to verify ambush wake-up
  const treantIntruder = spawnUnit(state, 'skeleton', ent.x + 1.5, ent.z, true).unit;
  const gargoyleIntruder = spawnUnit(state, 'skeleton', gargoyle.x + 1.5, gargoyle.z, true).unit;
  assert.ok(treantIntruder && gargoyleIntruder);

  for (let i = 0; i < 6; i++) {
    stepSimulation(state, 0.1);
  }
  assert.equal(
    Boolean(ent.treantDisguised),
    false,
    'Treant should snap out of tree disguise when a hostile approaches',
  );
  assert.equal(
    Boolean(gargoyle.gargoylePetrified),
    false,
    'Gargoyle should wake from stone statue form when a hostile approaches',
  );
});
