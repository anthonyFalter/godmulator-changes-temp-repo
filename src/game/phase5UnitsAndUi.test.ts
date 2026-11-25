import assert from 'node:assert/strict';
import test from 'node:test';
import { getBatchedUnitTemplateKey } from './batchedUnits';
import { GOD_POWERS, getDragonVariant, getUnitMaxLifespan } from './catalog';
import { getEntityInspectProfile } from './entityInspector';
import {
  castGodPower,
  createInitialSimulationState,
  getKingdomId,
  getTile,
  placeBuilding,
  seedWorldWildlife,
  setKingdomEpoch,
  setKingdomRelation,
  spawnUnit,
  stepSimulation,
} from './simulation';
import {
  UNIT_GENES,
  computeUnitEffectiveStats,
  getUnitSizeScale,
  resolveGeneInfo,
  setUnitAgeYears,
  setUnitStatValue,
  syncUnitDerivedStats,
} from './unitCustomization';

function makeFlatLandState(seed = 'PHASE5-TEST', gridSize = 64) {
  const state = createInitialSimulationState(gridSize, seed);
  state.sandboxFreeMode = true;
  state.wildlifeSeeded = true;
  state.units = [];
  state.buildings = [];
  state.vehicles = [];
  for (const t of state.tiles) {
    t.height = 2;
    t.terrain = 'grass';
    t.resourceNode = 'none';
    t.resourceAmount = 0;
    t.buildingId = null;
    t.onFireTimer = 0;
    t.devastatedTimer = 0;
  }
  return state;
}

test('Phase 5 [H12]: Leviathan respects animalAttacks=false for ships & units and uses unit customization stats in melee', () => {
  const state = makeFlatLandState('PHASE5-LEVI', 48);
  state.worldRules = { ...state.worldRules!, animalAttacks: false };

  // Carve an ocean strip
  for (let z = 14; z <= 34; z++) {
    for (let x = 14; x <= 34; x++) {
      const t = getTile(state, x, z)!;
      t.height = 0;
      t.terrain = 'deep_water';
    }
  }

  placeBuilding(state, 'bonfire', 8, 8);
  const shipSid = state.buildings[0].settlementId!;
  const levi = spawnUnit(state, 'leviathan', 22, 22, true).unit!;
  levi.leviathanBeamCooldown = 99;
  levi.leviathanLeapCooldown = 99;
  const swimmer = spawnUnit(state, 'human', 24, 22, true).unit!;
  swimmer.hp = 500;
  swimmer.maxHp = 500;
  const ship = {
    id: 'veh_test_ship',
    type: 'passenger_ship' as const,
    species: 'human' as const,
    settlementId: shipSid,
    epochLevel: 2,
    x: 23,
    y: 0.25,
    z: 22,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 0,
    path: [],
    pathIndex: 0,
    variantSeed: 1,
    hp: 300,
    maxHp: 300,
  };
  state.vehicles = [ship];

  for (let i = 0; i < 10; i++) stepSimulation(state, 0.2);
  assert.equal(ship.hp, 300, 'Leviathan must not attack ships when animalAttacks is false');
  assert.equal(swimmer.hp, 500, 'Leviathan must not attack non-hostile swimmers when animalAttacks is false');

  // Re-enable animalAttacks and buff Leviathan attackDamage via statBonuses
  state.worldRules.animalAttacks = true;
  setUnitStatValue(levi, 'attackDamage', 250);
  levi.actionCooldown = 0;
  levi.x = 22.5;
  levi.z = 22;
  swimmer.x = 24.0;
  swimmer.z = 22;
  state.vehicles = [];
  stepSimulation(state, 0.1);
  assert.ok(swimmer.hp <= 300, `Leviathan melee must use customized attackDamage (remaining hp=${swimmer.hp})`);
});

test('Phase 5 [H12]: Direct-KO damage paths trigger Phoenix Rebirth instead of instant permanent death', () => {
  const state = makeFlatLandState('PHASE5-PHOENIX', 48);
  const phoenix = spawnUnit(state, 'phoenix', 24, 24, true).unit!;
  assert.equal(phoenix.phoenixReborn, undefined);

  // Simulate a direct-KO path (e.g. god power, hazard, fall damage, or Leviathan)
  phoenix.hp = 0;
  phoenix.state = 'ko';
  phoenix.koTimer = 0.45;

  stepSimulation(state, 0.1);
  assert.equal(phoenix.phoenixReborn, true, 'Unreborn Phoenix must trigger rebirth on direct-KO');
  assert.notEqual(phoenix.state, 'ko', 'Reborn Phoenix must exit KO state');
  assert.ok(phoenix.hp > 0, 'Reborn Phoenix must revive with positive HP');

  // Second direct-KO should NOT revive again
  phoenix.hp = 0;
  phoenix.state = 'ko';
  phoenix.koTimer = 0.05;
  stepSimulation(state, 0.1);
  assert.equal(state.units.some((u) => u.id === phoenix.id), false, 'Already-reborn Phoenix should die on second KO');
});

test('Phase 5 [H13]: Dragon breath, hostile vs building, and civ vs building/vehicle combat respect customization & fireproof', () => {
  const state = makeFlatLandState('PHASE5-CUSTOM-COMBAT', 48);

  // 1. Dragon fire breath respects fireproof & customized attackDamage
  const dragon = spawnUnit(state, 'dragon', 20, 20, true).unit!;
  setUnitStatValue(dragon, 'attackDamage', 200);
  dragon.dragonBreathCooldown = 0;
  dragon.actionCooldown = 0;
  dragon.dragonRunPhase = 'strafe';
  dragon.dragonRunTimer = 2.0;
  dragon.dragonRunDirX = 1;
  dragon.dragonRunDirZ = 0;

  const fireproofTarget = spawnUnit(state, 'wolf', 22, 20, true).unit!;
  fireproofTarget.traits = ['fireproof'];
  syncUnitDerivedStats(fireproofTarget, false);
  fireproofTarget.hp = fireproofTarget.maxHp;
  const hpBefore = fireproofTarget.hp;

  stepSimulation(state, 0.1);
  assert.equal(fireproofTarget.hp, hpBefore, 'Fireproof target must not take Dragon fire breath damage');

  // 2. Hostile vs building uses customized attackDamage
  const state2 = makeFlatLandState('PHASE5-HOSTILE-BLD', 48);
  placeBuilding(state2, 'bonfire', 24, 24);
  const bld = state2.buildings[0];
  bld.hp = 500;
  bld.maxHp = 500;
  const raider = spawnUnit(state2, 'raider_swarmer', 24.5, 24, true).unit!;
  setUnitStatValue(raider, 'attackDamage', 180);
  raider.actionCooldown = 0;
  raider.windupTimer = 0.6;
  stepSimulation(state2, 0.1);
  assert.ok(bld.hp <= 330, `Customized hostile attackDamage must apply to buildings (bld.hp=${bld.hp})`);
});

test('Phase 5 [H14]: spawnUnit enforces allowFantasy (including dwarf & lizardfolk) and allowDinosaurs', () => {
  const state = makeFlatLandState('PHASE5-RULES', 48);
  state.worldRules = { ...state.worldRules!, allowFantasy: false, allowDinosaurs: false };

  assert.equal(spawnUnit(state, 'human', 20, 20, true).ok, true, 'Humans remain spawnable');
  assert.equal(spawnUnit(state, 'elf', 21, 20, true).ok, false, 'Elves blocked when allowFantasy=false');
  assert.equal(spawnUnit(state, 'orc', 22, 20, true).ok, false, 'Orcs blocked when allowFantasy=false');
  assert.equal(spawnUnit(state, 'dwarf', 23, 20, true).ok, false, 'Dwarves blocked when allowFantasy=false');
  assert.equal(spawnUnit(state, 'lizardfolk', 24, 20, true).ok, false, 'Lizardfolk blocked when allowFantasy=false');
  assert.equal(spawnUnit(state, 'dragon', 25, 20, true).ok, false, 'Mythicals blocked when allowFantasy=false');
  assert.equal(spawnUnit(state, 'dinosaur', 26, 20, true).ok, false, 'Dinosaurs blocked when allowDinosaurs=false');
});

test('Phase 5 [M10]: fireproof trait protects both wildlife and civilization units from burning ground', () => {
  const state = makeFlatLandState('PHASE5-FIREPROOF', 48);
  state.worldRules = { ...state.worldRules!, animalAttacks: false };
  const fireTileA = getTile(state, 20, 20)!;
  const fireTileB = getTile(state, 24, 20)!;
  fireTileA.onFireTimer = 10;
  fireTileB.onFireTimer = 10;

  const civ = spawnUnit(state, 'human', 20, 20, true).unit!;
  civ.x = 20;
  civ.z = 20;
  civ.traits = ['fireproof'];
  syncUnitDerivedStats(civ, false);
  civ.hp = civ.maxHp;
  const civHp = civ.hp;

  const wolf = spawnUnit(state, 'wolf', 24, 20, true).unit!;
  wolf.x = 24;
  wolf.z = 20;
  wolf.traits = ['fireproof'];
  syncUnitDerivedStats(wolf, false);
  wolf.hp = wolf.maxHp;
  const wolfHp = wolf.hp;

  for (let i = 0; i < 5; i++) {
    fireTileA.onFireTimer = 10;
    fireTileB.onFireTimer = 10;
    stepSimulation(state, 0.2);
  }
  assert.ok(civ.hp >= civHp, 'Fireproof civilization unit must not take burning ground damage');
  assert.ok(wolf.hp >= wolfHp, 'Fireproof wildlife unit must not take burning ground damage');
});

test('Phase 5 [M11]: 6 luminous creatures have lifespans, inspector diet entries, and worldgen seeding', () => {
  const state = createInitialSimulationState(64, 'PHASE5-LUMINOUS');
  state.units = [];
  seedWorldWildlife(state);

  const luminousRoles = ['firefly', 'glow_moth', 'lantern_jelly', 'fairy', 'fae', 'will_o_wisp'] as const;
  for (const role of luminousRoles) {
    const ls = getUnitMaxLifespan({ role, species: 'human', appearanceSeed: 7 });
    if (role === 'firefly' || role === 'glow_moth' || role === 'lantern_jelly') {
      assert.ok(ls <= 15, `${role} should have short wildlife lifespan, got ${ls}`);
    } else {
      assert.ok(ls >= 300, `${role} should have mythical lifespan, got ${ls}`);
    }
    const u = spawnUnit(state, role, 32, 32, true).unit!;
    const profile = getEntityInspectProfile(state, u);
    assert.ok(profile.diet.detail.length > 0, `${role} must have inspector diet detail`);
    if (role === 'fairy' || role === 'fae' || role === 'will_o_wisp') {
      assert.equal(profile.diet.category, 'Arcane', `${role} should have Arcane diet category`);
    }
  }
});

test('Phase 5 [M12]: Lizardfolk Sun Scales does not trigger dragon-scale fireproof fallback and Dwarf/Lizardfolk genes exist in UNIT_GENES', () => {
  const expectedGenes = [
    'Stoneblood',
    'Forge Born',
    'Iron Grip',
    'Rune Sense',
    'Runic Resilience',
    'Sun Scales',
    'Cold Blood',
    'Jungle Step',
    'Solar Focus',
    'Sun-Blessed Scales',
  ];
  for (const name of expectedGenes) {
    assert.ok(UNIT_GENES.some((g) => g.name === name), `UNIT_GENES must register ${name}`);
  }
  const sunScales = resolveGeneInfo('Sun Scales', true);
  assert.equal(Boolean(sunScales.mods.fireproof), false, 'Sun Scales must not grant dragon-scale fireproof');
  assert.equal(sunScales.description.toLowerCase().includes('dragon'), false, 'Sun Scales must not use dragon description');
});

test('Phase 5 [M13]: setUnitStatValue avoids double-heal, setUnitAgeYears syncs child stats, terraform_beam scales sizeScale & statBonuses, Dragon batches use 4 variants', () => {
  const state = makeFlatLandState('PHASE5-M13', 48);
  const u = spawnUnit(state, 'human', 20, 20, true).unit!;
  u.hp = 50;
  const beforeMax = u.maxHp;
  setUnitStatValue(u, 'maxHp', beforeMax + 100);
  assert.equal(u.hp, 50 + 100, 'setUnitStatValue must add maxHp delta once (no double-heal)');

  setUnitAgeYears(u, 5);
  assert.equal(u.ageStage, 'child');
  assert.ok((u.growthTimer ?? 0) > 0, 'Aging down to child must initialize growthTimer');
  assert.ok(u.maxHp < beforeMax + 100, 'Aging down to child must resync derived child maxHp');

  // terraform_beam preserves >900 maxHp via statBonuses and grows sizeScale
  const champ = spawnUnit(state, 'human', 24, 24, true).unit!;
  setUnitStatValue(champ, 'maxHp', 1200);
  const scaleBefore = getUnitSizeScale(champ);
  castGodPower(state, 'terraform_beam', 24, 24);
  assert.ok(champ.maxHp > 1200, `terraform_beam must boost via statBonuses without 900 cap (got ${champ.maxHp})`);
  assert.ok(getUnitSizeScale(champ) > scaleBefore, 'terraform_beam must grow unit sizeScale');

  // Dragon batched template key matches getDragonVariant 4 colors
  const seenKeys = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const key = getBatchedUnitTemplateKey('dragon', 'wildlife', 0, 'human', 'adult', seed, 'default');
    const variantName = getDragonVariant(seed).name;
    assert.ok(key.includes(`|${variantName}|`), `Dragon key ${key} must include variant ${variantName}`);
    seenKeys.add(variantName);
  }
  assert.equal(seenKeys.size, 4, 'All 4 Dragon color variants must map to distinct batched keys');
});

test('Phase 5 [M14]: eureka targets local kingdom, Rage tooltip aligns with 2.0x damage, and Inspector diet & civ range floors are accurate', () => {
  const state = makeFlatLandState('PHASE5-M14', 64);
  placeBuilding(state, 'bonfire', 14, 14);
  placeBuilding(state, 'bonfire', 50, 50);
  const sidA = state.buildings[0].settlementId!;
  const sidB = state.buildings[1].settlementId!;
  const kidA = getKingdomId(state, sidA);
  const kidB = getKingdomId(state, sidB);
  state.kingdomResources![kidA].knowledge = 0;
  state.kingdomResources![kidB].knowledge = 0;

  castGodPower(state, 'eureka', 14, 14);
  assert.equal(state.kingdomResources![kidA].knowledge, 140, 'Eureka must grant +140 Knowledge to the targeted kingdom');
  assert.equal(state.kingdomResources![kidB].knowledge, 0, 'Eureka must not split Knowledge to unrelated distant kingdoms');

  const rageDef = GOD_POWERS.find((p) => p.type === 'bloodlust_frenzy')!;
  assert.ok(rageDef.summary.includes('+100%'), 'Rage tooltip should match +100% (2.0x) damage');

  // Entity Inspector diet categories for skeleton & alien
  const skel = spawnUnit(state, 'skeleton', 30, 30, true).unit!;
  const alien = spawnUnit(state, 'alien_trooper', 32, 30, true).unit!;
  assert.equal(getEntityInspectProfile(state, skel).diet.category, 'Undead');
  assert.equal(getEntityInspectProfile(state, alien).diet.category, 'Energy-Powered');

  // Entity Inspector attack range reflects species/epoch combat range floor
  setKingdomEpoch(state, sidA, 3);
  const gunHuman = spawnUnit(state, 'human', 15, 15, true, sidA).unit!;
  const profile = getEntityInspectProfile(state, gunHuman);
  assert.ok(profile.informations.attackRange >= 5.8, `Industrial Human inspector attackRange should reflect firearm range floor (got ${profile.informations.attackRange})`);

  // Frenzied effective stats preview aligns with 2.0x damage
  const baseProfile = getEntityInspectProfile(state, gunHuman);
  gunHuman.statusEffects.frenzied = 10;
  const frenzProfile = getEntityInspectProfile(state, gunHuman);
  const ratio = frenzProfile.informations.attackDamage / baseProfile.informations.attackDamage;
  assert.ok(ratio >= 1.9 && ratio <= 2.1, `Frenzied inspector damage should be ~2.0x (got ${ratio.toFixed(2)}x)`);

  // Verify civ vs building respects customized attackDamage at war
  setKingdomRelation(state, sidA, sidB, 'war');
  const bldB = state.buildings[1];
  bldB.hp = 600;
  bldB.maxHp = 600;
  const attacker = spawnUnit(state, 'human', 49, 50, true, sidA).unit!;
  setUnitStatValue(attacker, 'attackDamage', 150);
  attacker.actionCooldown = 0;
  const effBefore = computeUnitEffectiveStats(attacker);
  assert.ok(effBefore.attackDamage >= 150);
});
