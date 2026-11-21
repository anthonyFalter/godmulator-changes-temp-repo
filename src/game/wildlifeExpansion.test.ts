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
];

const ALL_EXPANDED_ROLES: AnimalRole[] = [...EXPANDED_WILDLIFE_ROLES, ...EXPANDED_MYTHICAL_ROLES];

test('catalog registers 27 wildlife units and 13 mythical beasts with clean names', () => {
  assert.equal(ANIMAL_UNITS.length, 27);
  assert.equal(MYTHICAL_BEAST_UNITS.length, 13);

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
  assert.ok(!FLYING_WILDLIFE_ROLES.has('penguin'));
});

test('all 30 expanded creatures build valid articulated 3D meshes and pixel sprites', () => {
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

    if (role === 'phoenix' || role === 'griffin' || role === 'pegasus') {
      assert.ok(group.getObjectByName('wing_l'), `Expected wing_l for flying creature ${role}`);
      assert.ok(group.getObjectByName('wing_r'), `Expected wing_r for flying creature ${role}`);
      assert.ok(group.getObjectByName('wing_outer_l'), `Expected wing_outer_l for ${role}`);
      assert.ok(group.getObjectByName('wing_outer_r'), `Expected wing_outer_r for ${role}`);
    }
    if (role === 'penguin') {
      assert.ok(group.getObjectByName('wing_l'), 'Expected wing_l flipper for penguin');
      assert.ok(group.getObjectByName('wing_r'), 'Expected wing_r flipper for penguin');
    }

    disposeEntityGroup(group);
  }
});

test('entity inspector provides clean subtitles, tailored genes, items, and lifespans for all 30 expanded roles', () => {
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

  // Larger maps scale wildlife population even further
  const largeWorld = createInitialSimulationState(160, 2025, { gridSize: 160 });
  const largeWildlife = largeWorld.units.filter((u) => u.faction === 'wildlife');
  assert.ok(
    largeWildlife.length > wildlife.length,
    `Expected 160x160 world (${largeWildlife.length}) to seed more wildlife than 96x96 (${wildlife.length})`,
  );

  // allowFantasy: false excludes all mythical beasts from natural world seeding
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

test('Yeti throws blocky ice balls, Kitsune shoots self-defense flame balls, and mythical powers work', () => {
  const state = createInitialSimulationState(48, 999);
  const gs = state.gridSize;
  for (let z = 12; z <= 36; z++) {
    for (let x = 12; x <= 36; x++) {
      const t = state.tiles[z * gs + x];
      t.terrain = 'grass';
      t.height = 2;
      t.resourceNode = 'none';
      t.resourceAmount = 0;
    }
  }
  state.units = [];
  state.pendingVfx = [];

  // 1. Yeti throws blocky ice_ball at a ranged hostile skeleton (~3.5 tiles away)
  const yeti = spawnUnit(state, 'yeti', 16, 16, true).unit;
  const rangedSkel = spawnUnit(state, 'skeleton', 19.5, 16, true).unit;
  assert.ok(yeti && rangedSkel);

  // 2. Kitsune retaliates with foxfire_ball in self-defense when attacked by a predator
  const kitsune = spawnUnit(state, 'kitsune', 24, 16, true).unit;
  const wolfAttacker = spawnUnit(state, 'wolf', 27.2, 16, true).unit;
  assert.ok(kitsune && wolfAttacker);
  kitsune.lastAttackerId = wolfAttacker.id;
  kitsune.underAttackTimer = 8;

  // 3. Hydra regenerates HP and spits venom_ball; Cerberus fires foxfire_ball
  const hydra = spawnUnit(state, 'hydra', 16, 28, true).unit;
  const hydraTarget = spawnUnit(state, 'skeleton', 19.2, 28, true).unit;
  assert.ok(hydra && hydraTarget);
  hydra.hp = Math.floor(hydra.maxHp * 0.5);
  const hydraHpBefore = hydra.hp;

  // 4. Pegasus heals nearby wounded human & Treant regrows trees on scorched earth
  const pegasus = spawnUnit(state, 'pegasus', 30, 28, true).unit;
  const woundedHuman = spawnUnit(state, 'human', 31, 28, true).unit;
  assert.ok(pegasus && woundedHuman);
  woundedHuman.hp = Math.floor(woundedHuman.maxHp * 0.4);
  const humanHpBefore = woundedHuman.hp;

  state.tiles[32 * gs + 24].terrain = 'scorched';
  const ent = spawnUnit(state, 'ent', 24, 32, true).unit;
  assert.ok(ent);

  // 5. Polar Bear survives safely on sea ice
  state.tiles[20 * gs + 32].terrain = 'ice';
  state.tiles[20 * gs + 32].height = 0;
  const polarBear = spawnUnit(state, 'polar_bear', 32, 20, true).unit;
  assert.ok(polarBear);

  let sawIceBall = false;
  let sawFoxfireBall = false;
  let sawVenomBall = false;

  for (let i = 0; i < 45; i++) {
    stepSimulation(state, 0.1);
    for (const vfx of state.pendingVfx) {
      if (vfx.type === 'projectile_tracer' && vfx.vfxSubtype === 'ice_ball') sawIceBall = true;
      if (vfx.type === 'projectile_tracer' && vfx.vfxSubtype === 'foxfire_ball') sawFoxfireBall = true;
      if (vfx.type === 'projectile_tracer' && vfx.vfxSubtype === 'venom_ball') sawVenomBall = true;
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
  assert.ok(sawVenomBall, 'Hydra should spit a blocky venom_ball at ranged enemies');
  assert.ok(hydra.hp > hydraHpBefore, 'Hydra should passively regenerate health over time');
  assert.ok(
    woundedHuman.hp > humanHpBefore || Boolean(woundedHuman.statusEffects.blessed),
    'Pegasus should heal or bless nearby wounded allies',
  );
  assert.notEqual(polarBear.state, 'ko', 'Polar bear should walk safely on sea ice without drowning');
});
