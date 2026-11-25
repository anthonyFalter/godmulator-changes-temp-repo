import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  FULL_SEASON_CYCLE_YEARS,
  SEASON_WATER_PROFILES,
  YEARS_PER_SEASON,
  computeSeasonState,
  multiplyColorByTint,
  stepSeasonWeightsVector,
} from './worldSeasons';
import {
  classifyChronicleMilestone,
  computeBuildingHitWobble,
  computeElasticPopScale,
  computeHitRecoil,
} from './worldJuice';
import { TERRAIN_TOOLS } from './catalog';
import {
  createInitialSimulationState,
  executeTerrainDropTileImpact,
  getTile,
  stepSimulation,
} from './simulation';
import {
  DEFAULT_ZONE_TOGGLES,
  buildZoneOverlayTextures,
  computeWorldZones,
} from './zones';

test('computeSeasonState returns pure locked seasonal presets', () => {
  for (const s of ['spring', 'summer', 'autumn', 'winter'] as const) {
    const res = computeSeasonState(s, 123);
    assert.equal(res.dominantSeason, s);
    assert.equal(res.weights[s], 1);
    const totalW =
      res.weights.spring + res.weights.summer + res.weights.autumn + res.weights.winter;
    assert.ok(Math.abs(totalW - 1) < 1e-6);
  }
});

test('computeSeasonState auto-cycles smoothly across all four seasons by year', () => {
  const spring = computeSeasonState('auto', 1);
  assert.equal(spring.dominantSeason, 'spring');
  assert.equal(spring.weights.spring, 1);

  const summer = computeSeasonState('auto', YEARS_PER_SEASON + 1);
  assert.equal(summer.dominantSeason, 'summer');
  assert.equal(summer.weights.summer, 1);

  const autumn = computeSeasonState('auto', YEARS_PER_SEASON * 2 + 1);
  assert.equal(autumn.dominantSeason, 'autumn');
  assert.equal(autumn.weights.autumn, 1);

  const winter = computeSeasonState('auto', YEARS_PER_SEASON * 3 + 1);
  assert.equal(winter.dominantSeason, 'winter');
  assert.equal(winter.weights.winter, 1);

  // Boundary crossfade between spring and summer sums cleanly to 1.0
  const transition = computeSeasonState('auto', YEARS_PER_SEASON - 0.5);
  assert.ok(transition.weights.spring > 0 && transition.weights.spring < 1);
  assert.ok(transition.weights.summer > 0 && transition.weights.summer < 1);
  const sum =
    transition.weights.spring +
    transition.weights.summer +
    transition.weights.autumn +
    transition.weights.winter;
  assert.ok(Math.abs(sum - 1) < 1e-6);

  // Wraps seamlessly after a full 4-season cycle
  const wrapped = computeSeasonState('auto', FULL_SEASON_CYCLE_YEARS + 1);
  assert.equal(wrapped.dominantSeason, 'spring');
});

test('multiplyColorByTint modulates color channels safely within HDR cap', () => {
  const col = new THREE.Color(0.8, 0.8, 0.8);
  multiplyColorByTint(col, [1.12, 0.89, 0.72], 1.0);
  assert.ok(col.r > col.g && col.g > col.b);
  assert.ok(col.r <= 1.35 && col.g <= 1.35 && col.b <= 1.35);
});

test('stepSeasonWeightsVector smoothly blends and stays normalized', () => {
  const v = new THREE.Vector4(0, 1, 0, 0); // start in summer
  const target = computeSeasonState('winter', 0).weights;
  stepSeasonWeightsVector(v, target, 0.1, 2.4);
  assert.ok(v.y < 1 && v.y > 0.5, 'summer weight decays smoothly');
  assert.ok(v.w > 0 && v.w < 0.5, 'winter weight ramps smoothly');
  assert.ok(Math.abs(v.x + v.y + v.z + v.w - 1) < 1e-6, 'weights remain normalized');

  for (let i = 0; i < 60; i++) {
    stepSeasonWeightsVector(v, target, 0.1, 2.4);
  }
  assert.ok(v.w > 0.999, 'converges cleanly to winter');
  assert.ok(SEASON_WATER_PROFILES.winter.frostStrength === 1.0);
  assert.ok(SEASON_WATER_PROFILES.summer.frostStrength === 0.0);
});

test('computeElasticPopScale bounces with squash-and-stretch and settles to (1, 1)', () => {
  const out = { xz: 1, y: 1 };
  computeElasticPopScale(0.0, 0.42, out);
  assert.ok(out.y < 0.6, 'starts compressed at age 0');

  computeElasticPopScale(0.11, 0.42, out);
  assert.ok(out.y > 1.02, 'overshoots vertically during pop-in');

  computeElasticPopScale(0.42, 0.42, out);
  assert.equal(out.xz, 1);
  assert.equal(out.y, 1);
});

test('computeHitRecoil produces crisp flash, hop, and settles cleanly', () => {
  const out = { flash: 0, hopY: 0, squashXZ: 1, squashY: 1 };
  computeHitRecoil(0.0, 0.2, out);
  assert.ok(out.flash > 0.95, 'peaks immediately at frame 0');

  computeHitRecoil(0.06, 0.2, out);
  assert.ok(out.flash > 0.25 && out.flash < 0.8);
  assert.ok(out.hopY > 0.1, 'hops upward during recoil');

  computeHitRecoil(0.15, 0.2, out);
  assert.equal(out.flash, 0, 'flash finishes after ~115ms');
  assert.ok(out.squashXZ > 1.0 && out.squashY < 1.0, 'squashes on landing');

  computeHitRecoil(0.25, 0.2, out);
  assert.equal(out.flash, 0);
  assert.equal(out.hopY, 0);
  assert.equal(out.squashXZ, 1);
  assert.equal(out.squashY, 1);
});

test('computeBuildingHitWobble decays to zero cleanly', () => {
  assert.ok(Math.abs(computeBuildingHitWobble(0.03)) > 0.01);
  assert.equal(computeBuildingHitWobble(0.3), 0);
  assert.equal(computeBuildingHitWobble(-1), 0);
});

test('classifyChronicleMilestone categorizes historic world events accurately', () => {
  assert.equal(
    classifyChronicleMilestone({ text: 'Aurelia entered the Medieval Age!', tone: 'epoch' }),
    'epoch_up',
  );
  assert.equal(
    classifyChronicleMilestone({ text: 'Ironhold declared war on Sunvale!', tone: 'warning' }),
    'war',
  );
  assert.equal(
    classifyChronicleMilestone({ text: 'Aurelia and Sunvale signed peace treaty.', tone: 'divine' }),
    'peace',
  );
  assert.equal(
    classifyChronicleMilestone({ text: 'Settlers founded a new settlement: Oakwatch.', tone: 'build' }),
    'city_founded',
  );
  assert.equal(
    classifyChronicleMilestone({ text: 'Ironhold captured Oakwatch!', tone: 'warning' }),
    'city_captured',
  );
  assert.equal(
    classifyChronicleMilestone({ text: 'Sunvale completed the Grand Sun Wonder!', tone: 'divine' }),
    'wonder',
  );
  assert.equal(
    classifyChronicleMilestone({ text: 'A wolf chased a rabbit.', tone: 'build' }),
    null,
  );
});

test('computeWorldZones shifts temperature bands with seasons and anchors labels strictly inside matching bands', () => {
  const sim = createInitialSimulationState(64, 'TEMP-ZONE-SEASON-TEST');
  for (const t of sim.tiles) {
    t.height = 2;
    t.terrain = 'grass';
    t.onFireTimer = 0;
    t.tempOffset = 0;
  }

  const summerZones = computeWorldZones(sim, 'summer');
  const winterZones = computeWorldZones(sim, 'winter');

  const centerIdx = 32 * sim.gridSize + 32;
  assert.ok(
    summerZones.tempCelsiusMap[centerIdx] >= winterZones.tempCelsiusMap[centerIdx] + 15,
    'winter must cool temperate grassland significantly compared to summer',
  );

  // All 5 thermal bands must have distinct hex colors
  const uniqueColors = new Set(
    Array.from(winterZones.tempBandsById.values()).map((b) => b.hexColor),
  );
  assert.equal(uniqueColors.size, 5, 'all 5 thermal bands should have distinct colors');

  const winterPack = buildZoneOverlayTextures(
    winterZones,
    { ...DEFAULT_ZONE_TOGGLES, kingdomLabels: false, temperature: true },
    null,
  );
  assert.ok(winterPack.labels.length >= 1, 'winter temperature overlay emits labels');
  for (const lbl of winterPack.labels) {
    const idx = lbl.tileZ * sim.gridSize + lbl.tileX;
    const bandId = winterZones.tempBandMap[idx];
    const bandInfo = winterZones.tempBandsById.get(bandId);
    assert.equal(bandInfo?.name, lbl.name);
    assert.equal(bandInfo?.hexColor, lbl.hexColor);
    assert.ok(lbl.subtitle?.endsWith('°C'), 'temperature label should show local °C subtitle');
  }
});

test('TERRAIN_TOOLS is ordered by player usage frequency with all tools preserved', () => {
  const types = TERRAIN_TOOLS.map((t) => t.type);
  assert.equal(types.length, 33);
  assert.deepEqual(types.slice(0, 8), [
    'raise',
    'lower',
    'flatten',
    'smooth_terrain',
    'island_bridge',
    'water_drop',
    'carve_river',
    'abyssal_trench',
  ]);
  assert.equal(new Set(types).size, 33, 'all terrain tool types must be unique');
});

test('water_drop pours dynamic elevated water on slopes without carving height-0 holes and cascades downhill', () => {
  const sim = createInitialSimulationState(48, 'DYNAMIC-WATER-FLOW-TEST');
  for (const t of sim.tiles) {
    t.buildingId = null;
    t.resourceNode = 'none';
    t.onFireTimer = 0;
    delete t.liquidLevel;
    delete t.liquidKind;
    // Build a stepped slope from height 4 at x=20 down to height 1 at x=26
    if (t.x <= 20) t.height = 4;
    else if (t.x === 21) t.height = 3;
    else if (t.x === 22) t.height = 2;
    else t.height = 1;
    t.terrain = 'grass';
  }

  const peak = getTile(sim, 20, 24)!;
  const ok = executeTerrainDropTileImpact(sim, 'water_drop', 20, 24);
  assert.equal(ok, true);
  assert.equal(peak.height, 4, 'pouring water on a hilltop must not destroy the hill down to height 0');
  assert.ok((peak.liquidLevel ?? 0) > peak.height, 'hilltop receives dynamic elevated water');

  // Step simulation so water cascades downhill onto the lower terrace at x=21
  stepSimulation(sim, 0.2);
  const lowerStep = getTile(sim, 21, 24)!;
  assert.ok(
    (lowerStep.liquidLevel ?? 0) > lowerStep.height,
    'dynamic water must cascade downhill onto lower neighboring terraces',
  );
});
