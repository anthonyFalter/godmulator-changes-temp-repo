import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ANIMAL_ROLE_SET,
  ANIMAL_UNITS,
  FLYING_WILDLIFE_ROLES,
  MYTHICAL_BEAST_UNITS,
  MYTHICAL_ROLE_SET,
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

const NEW_WILDLIFE_ROLES: AnimalRole[] = [
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
];

const NEW_MYTHICAL_ROLES: AnimalRole[] = [
  'phoenix',
  'griffin',
  'yeti',
  'golem',
  'kitsune',
];

const ALL_NEW_ROLES: AnimalRole[] = [...NEW_WILDLIFE_ROLES, ...NEW_MYTHICAL_ROLES];

test('catalog registers 17 wildlife units and 8 mythical beasts with lookup sets', () => {
  assert.equal(ANIMAL_UNITS.length, 17);
  assert.equal(MYTHICAL_BEAST_UNITS.length, 8);

  for (const role of NEW_WILDLIFE_ROLES) {
    assert.ok(ANIMAL_UNITS.some((u) => u.role === role), `Missing wildlife catalog entry: ${role}`);
    assert.ok(ANIMAL_ROLE_SET.has(role), `ANIMAL_ROLE_SET missing: ${role}`);
    assert.ok(!MYTHICAL_ROLE_SET.has(role), `Wildlife role should not be in MYTHICAL_ROLE_SET: ${role}`);
  }

  for (const role of NEW_MYTHICAL_ROLES) {
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
  assert.ok(!FLYING_WILDLIFE_ROLES.has('penguin'));
});

test('all 15 new creatures build valid articulated 3D meshes and pixel sprites', () => {
  for (let i = 0; i < ALL_NEW_ROLES.length; i++) {
    const role = ALL_NEW_ROLES[i];
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

    if (role === 'phoenix' || role === 'griffin') {
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

test('entity inspector provides tailored genes, items, lifespans, and factions for all 15 new roles', () => {
  const state = createInitialSimulationState(48, 777);
  const center = Math.floor(state.gridSize / 2);
  state.tiles[center * state.gridSize + center].terrain = 'grass';
  state.tiles[center * state.gridSize + center].height = 2;

  for (const role of ALL_NEW_ROLES) {
    const res = spawnUnit(state, role, center, center, true);
    assert.ok(res.ok && res.unit, `Failed to spawn ${role}: ${res.reason}`);

    const profile = getEntityInspectProfile(state, res.unit);
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
      assert.ok(lifespan >= 8 && lifespan <= 100, `Expected wildlife lifespan for ${role}, got ${lifespan}`);
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

test('mythical powers and biome traits execute cleanly in simulation', () => {
  const state = createInitialSimulationState(48, 999);
  const gs = state.gridSize;
  for (let z = 18; z <= 30; z++) {
    for (let x = 18; x <= 30; x++) {
      const t = state.tiles[z * gs + x];
      t.terrain = 'grass';
      t.height = 2;
    }
  }
  state.units = [];

  // 1. Phoenix heals and blesses a wounded nearby human
  const phoenix = spawnUnit(state, 'phoenix', 24, 24, true).unit;
  const woundedHuman = spawnUnit(state, 'human', 25, 24, true).unit;
  assert.ok(phoenix && woundedHuman);
  woundedHuman.hp = Math.floor(woundedHuman.maxHp * 0.4);
  const hpBefore = woundedHuman.hp;

  // 2. Yeti freezes a hostile skeleton & Stone Golem deals AoE quake damage
  const yeti = spawnUnit(state, 'yeti', 20, 20, true).unit;
  const skel1 = spawnUnit(state, 'skeleton', 21, 20, true).unit;
  assert.ok(yeti && skel1);

  const golem = spawnUnit(state, 'golem', 28, 28, true).unit;
  const skel2 = spawnUnit(state, 'skeleton', 29, 28, true).unit;
  const skel3 = spawnUnit(state, 'skeleton', 28, 29, true).unit;
  assert.ok(golem && skel2 && skel3);
  const skel2Hp0 = skel2.hp;
  const skel3Hp0 = skel3.hp;

  // 3. Penguin survives on sea ice tile without drowning
  state.tiles[22 * gs + 28].terrain = 'ice';
  state.tiles[22 * gs + 28].height = 0;
  const penguin = spawnUnit(state, 'penguin', 28, 22, true).unit;
  assert.ok(penguin);

  for (let i = 0; i < 40; i++) {
    stepSimulation(state, 0.1);
  }

  assert.ok(
    woundedHuman.hp > hpBefore || Boolean(woundedHuman.statusEffects.blessed),
    'Phoenix aura should heal or bless nearby wounded human',
  );
  assert.ok(
    Boolean(skel1.statusEffects.frozen) || skel1.hp < skel1.maxHp,
    'Yeti should strike and freeze nearby hostile',
  );
  assert.ok(
    skel2.hp < skel2Hp0 && skel3.hp < skel3Hp0,
    'Stone Golem seismic slam should damage multiple adjacent hostiles',
  );
  assert.notEqual(penguin.state, 'ko', 'Penguin should survive safely on sea ice');
});
