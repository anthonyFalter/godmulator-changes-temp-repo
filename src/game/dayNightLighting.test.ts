import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_SIMULATION_SPEED,
  SIMULATION_SPEED_OPTIONS,
  clampSimulationSpeed,
  getEpochCityLightProfile,
  getTimeOfDayLightingState,
  resolveCyclePresetFromPhase,
} from './dayNightLighting';

test('Simulation speed options are capped at 5x', () => {
  assert.equal(MAX_SIMULATION_SPEED, 5);
  assert.deepEqual([...SIMULATION_SPEED_OPTIONS], [0, 0.5, 1, 2, 5]);
  assert.equal(clampSimulationSpeed(10), 5);
  assert.equal(clampSimulationSpeed(5), 5);
  assert.equal(clampSimulationSpeed(2), 2);
  assert.equal(clampSimulationSpeed(-3), 0);
});

test('Time-of-day presets produce distinct lighting, shading, and sun angles for Dawn, Noon, Dusk, Night, and Midnight', () => {
  const dawn = getTimeOfDayLightingState('dawn');
  const noon = getTimeOfDayLightingState('noon');
  const dusk = getTimeOfDayLightingState('dusk');
  const night = getTimeOfDayLightingState('night');
  const midnight = getTimeOfDayLightingState('midnight');

  // Darkness progression: noon (0) < dawn < dusk < night < midnight (1.0)
  assert.equal(noon.darkness, 0);
  assert.ok(dawn.darkness > 0 && dawn.darkness < dusk.darkness);
  assert.ok(dusk.darkness < night.darkness);
  assert.ok(night.darkness < midnight.darkness);
  assert.equal(midnight.darkness, 1.0);

  // Environment intensity dims significantly at dark hours so terrain & props actually shade dark
  assert.ok(noon.environmentIntensity > dawn.environmentIntensity);
  assert.ok(dawn.environmentIntensity > dusk.environmentIntensity);
  assert.ok(dusk.environmentIntensity > night.environmentIntensity);
  assert.ok(night.environmentIntensity > midnight.environmentIntensity);

  // Sun keyOffset flips from East (+X) at Dawn to West (-X) at Dusk
  assert.ok(dawn.keyOffset[0] > 15);
  assert.ok(dusk.keyOffset[0] < -15);

  // Auto cycle transitions across all 5 phases
  assert.equal(resolveCyclePresetFromPhase(0.10), 'noon');
  assert.equal(resolveCyclePresetFromPhase(0.35), 'dusk');
  assert.equal(resolveCyclePresetFromPhase(0.55), 'night');
  assert.equal(resolveCyclePresetFromPhase(0.72), 'midnight');
  assert.equal(resolveCyclePresetFromPhase(0.90), 'dawn');
});

test('Cities light up at dark hours with creative age-dependent profiles from Prehistoric campfires to Modern streetlights', () => {
  const stoneNoon = getEpochCityLightProfile(0, 'human', 0, 1.0);
  const stoneNight = getEpochCityLightProfile(0, 'human', 0.9, 1.0);
  assert.equal(stoneNight.fixtureKind, 'campfire');
  assert.ok(stoneNight.pointLightIntensity > stoneNoon.pointLightIntensity * 2.5);
  assert.ok(stoneNight.streetFixtureEmissiveIntensity > stoneNoon.streetFixtureEmissiveIntensity * 4);

  const medievalNight = getEpochCityLightProfile(2, 'human', 0.9, 1.0);
  assert.equal(medievalNight.fixtureKind, 'brazier_lantern');

  const industrialNight = getEpochCityLightProfile(3, 'human', 0.9, 1.0);
  assert.equal(industrialNight.fixtureKind, 'gas_lamppost');
  assert.ok(industrialNight.windowEmissiveIntensity > 1.5);

  const modernNight = getEpochCityLightProfile(5, 'human', 0.95, 1.0);
  assert.equal(modernNight.fixtureKind, 'city_streetlight');
  assert.ok(modernNight.windowEmissiveIntensity > industrialNight.windowEmissiveIntensity);
  assert.ok(modernNight.pointLightDistance >= 14);

  const futureNight = getEpochCityLightProfile(7, 'elf', 1.0, 1.0);
  assert.equal(futureNight.fixtureKind, 'arcology_neon');
  assert.ok(futureNight.streetFixtureEmissiveIntensity > 2.2);
});
