import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialSimulationState, spawnUnit, stepSimulation } from './simulation';
import { getEntityInspectProfile } from './entityInspector';
import {
  UNIT_GENES,
  UNIT_ITEMS,
  UNIT_TRAITS,
  addUnitItem,
  computeUnitEffectiveStats,
  getEffectiveUnitSizeScale,
  getUnitSizeScale,
  healUnitFull,
  removeUnitItem,
  resetUnitStatBonuses,
  setUnitSizeScale,
  setUnitStatValue,
  toggleUnitGene,
  toggleUnitTrait,
} from './unitCustomization';

test('unit customization calculates effective stats from traits, genes, items, and edits', () => {
  const sim = createInitialSimulationState(48, 42);
  const tile = sim.tiles.find((t) => t.height >= 1 && !t.buildingId)!;
  const spawnRes = spawnUnit(sim, 'warrior', tile.x, tile.z, true, undefined, { appearanceSeed: 7 });
  const unit = spawnRes.unit!;
  assert.ok(unit, 'Should spawn warrior');

  // Clear to a known baseline
  unit.traits = [];
  unit.genes = ['Adaptable'];
  unit.items = [];
  resetUnitStatBonuses(unit);

  const base = computeUnitEffectiveStats(unit);

  // Add trait (Tough: +40 HP, +5 Armor) and item (Iron Plate: +22 Armor, +55 HP, -0.2 Speed)
  toggleUnitTrait(unit, 'tough');
  addUnitItem(unit, 'Iron Plate');
  addUnitItem(unit, 'Iron Sword');
  toggleUnitGene(unit, 'Eagle Eye');

  const boosted = computeUnitEffectiveStats(unit);
  assert.equal(boosted.maxHp, base.maxHp + 40 + 55);
  assert.equal(boosted.armor, base.armor + 5 + 22);
  assert.equal(boosted.attackDamage, base.attackDamage + 12);
  assert.ok(boosted.attackRange > base.attackRange);
  assert.ok(boosted.critChance > base.critChance);

  // Direct stat editing overrides exact effective values and resets cleanly
  setUnitStatValue(unit, 'attackDamage', 120);
  setUnitStatValue(unit, 'armor', 60);
  assert.equal(computeUnitEffectiveStats(unit).attackDamage, 120);
  assert.equal(computeUnitEffectiveStats(unit).armor, 60);

  resetUnitStatBonuses(unit);
  assert.equal(computeUnitEffectiveStats(unit).attackDamage, boosted.attackDamage);

  // Opposite traits replace each other cleanly
  toggleUnitTrait(unit, 'giant');
  assert.ok(unit.traits.includes('giant'));
  toggleUnitTrait(unit, 'tiny');
  assert.ok(unit.traits.includes('tiny'));
  assert.ok(!unit.traits.includes('giant'));

  // Remove item updates stats immediately
  const beforeDrop = computeUnitEffectiveStats(unit).armor;
  assert.equal(removeUnitItem(unit, 'Iron Plate'), true);
  assert.ok(computeUnitEffectiveStats(unit).armor < beforeDrop);

  // Inspector profile exposes real computed stats, traits, geneDetails, itemDetails
  const profile = getEntityInspectProfile(sim, unit);
  assert.equal(profile.informations.armor, computeUnitEffectiveStats(unit).armor);
  assert.ok(profile.traits.length >= 1);
  assert.ok(profile.geneDetails.every((g) => Boolean(g.info.icon && g.info.description)));
  assert.ok(profile.itemDetails.every((i) => Boolean(i.info.icon && i.info.description)));
});

test('traits and edited stats actually take effect in live simulation (regen, fireproof, immortal)', () => {
  const sim = createInitialSimulationState(48, 99);
  const tile = sim.tiles.find((t) => t.height >= 1 && !t.buildingId)!;
  const unit = spawnUnit(sim, 'human', tile.x, tile.z, true, undefined, { appearanceSeed: 3 }).unit!;
  assert.ok(unit);

  // Passive regeneration heals injured unit over time
  toggleUnitTrait(unit, 'fast_healer');
  setUnitStatValue(unit, 'regenPerSec', 10);
  unit.hp = Math.max(10, unit.maxHp - 50);
  const startHp = unit.hp;
  stepSimulation(sim, 0.5);
  assert.ok(unit.hp > startHp + 3, 'Fast Healer + regen should actively restore HP');

  // Fireproof protects unit standing in lava
  const waterTile = sim.tiles.find((t) => t.height === 0) ?? sim.tiles[0];
  waterTile.height = 0;
  waterTile.terrain = 'shallow_water';
  waterTile.waterKind = 'lava';
  unit.x = waterTile.x;
  unit.z = waterTile.z;
  unit.targetX = waterTile.x;
  unit.targetZ = waterTile.z;
  healUnitFull(unit);
  toggleUnitTrait(unit, 'fireproof');
  const hpBeforeLava = unit.hp;
  stepSimulation(sim, 0.25);
  assert.ok(unit.hp >= hpBeforeLava - 1, 'Fireproof unit should not burn in lava');

  // Immortal trait prevents death from old age even when past maxLifespan
  toggleUnitTrait(unit, 'immortal');
  unit.ageYears = 9999;
  unit.maxLifespan = 80;
  stepSimulation(sim, 0.25);
  assert.notEqual(unit.state, 'ko', 'Immortal trait must prevent death by old age');
  assert.equal(getEntityInspectProfile(sim, unit).informations.immortal, true);
});

test('all catalog traits, genes, and items have concise non-empty descriptions and icons', () => {
  assert.ok(UNIT_TRAITS.length >= 20);
  assert.ok(UNIT_GENES.length >= 30);
  assert.ok(UNIT_ITEMS.length >= 35);
  for (const t of UNIT_TRAITS) {
    assert.ok(t.name.length > 0 && t.description.length > 5 && t.icon.length > 0);
  }
  for (const g of UNIT_GENES) {
    assert.ok(g.name.length > 0 && g.description.length > 5 && g.icon.length > 0);
  }
  for (const item of UNIT_ITEMS) {
    assert.ok(item.name.length > 0 && item.description.length > 5 && item.icon.length > 0);
  }
});

test('creature size editing clamps bounds, combines with giant/tiny traits, exposes in inspector, and resets cleanly', () => {
  const sim = createInitialSimulationState(48, 77);
  const tile = sim.tiles.find((t) => t.height >= 1 && !t.buildingId)!;
  const unit = spawnUnit(sim, 'wolf', tile.x, tile.z, true, undefined, { appearanceSeed: 3 }).unit!;
  unit.traits = [];

  assert.equal(getUnitSizeScale(unit), 1.0);
  assert.equal(getEffectiveUnitSizeScale(unit), 1.0);

  // Set custom size and verify clamping
  assert.equal(setUnitSizeScale(unit, 2.5), 2.5);
  assert.equal(getEntityInspectProfile(sim, unit).informations.sizeScale, 2.5);
  assert.equal(getEntityInspectProfile(sim, unit).hasStatOverrides, true);

  assert.equal(setUnitSizeScale(unit, 99), 4.0);
  assert.equal(setUnitSizeScale(unit, 0.05), 0.35);

  // Combines cleanly with giant/tiny traits
  setUnitSizeScale(unit, 2.0);
  toggleUnitTrait(unit, 'giant');
  assert.ok(Math.abs(getEffectiveUnitSizeScale(unit) - 2.56) < 0.01);

  // Reset restores 1.0x
  resetUnitStatBonuses(unit);
  assert.equal(unit.sizeScale, undefined);
  assert.equal(getUnitSizeScale(unit), 1.0);
});
