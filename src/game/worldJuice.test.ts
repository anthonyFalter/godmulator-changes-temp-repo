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
