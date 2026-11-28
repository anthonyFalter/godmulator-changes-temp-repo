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
import { GOD_POWERS, TERRAIN_TOOLS } from './catalog';
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

test('TERRAIN_TOOLS is ordered by player usage frequency with all liquid tools grouped together', () => {
  const types = TERRAIN_TOOLS.map((t) => t.type);
  assert.equal(types.length, 46);
  assert.deepEqual(types.slice(0, 12), [
    'raise',
    'lower',
    'flatten',
    'smooth_terrain',
    'island_bridge',
    'water_drop',
    'lava_drop',
    'poison_drop',
    'carve_river',
    'abyssal_trench',
    'lava_river',
    'poison_river',
  ]);
  assert.equal(new Set(types).size, 46, 'all terrain tool types must be unique');
});

test('GOD_POWERS is ordered by usage frequency and logical category groups with all powers preserved', () => {
  const types = GOD_POWERS.map((p) => p.type);
  assert.equal(types.length, 37);
  assert.equal(new Set(types).size, 37, 'all god power types must be unique');
  assert.deepEqual(types.slice(0, 4), [
    'drag_entity',
    'blessing',
    'rain_of_plenty',
    'cleanse_land',
  ]);
  // Climate controls grouped together
  const heatIdx = types.indexOf('heat_wave');
  assert.deepEqual(types.slice(heatIdx, heatIdx + 4), ['heat_wave', 'freeze_snap', 'blizzard', 'acid_rain']);
  // Classic disasters grouped together
  const lightningIdx = types.indexOf('lightning_smite');
  assert.deepEqual(types.slice(lightningIdx, lightningIdx + 5), [
    'lightning_smite',
    'meteor_strike',
    'tornado',
    'earthquake',
    'tsunami',
  ]);
});

test('water_drop pours dynamic elevated water on slopes without carving height-0 holes, cascades to sea and runs out cleanly', () => {
  const sim = createInitialSimulationState(48, 'DYNAMIC-WATER-FLOW-TEST');
  for (const t of sim.tiles) {
    t.buildingId = null;
    t.resourceNode = 'none';
    t.onFireTimer = 0;
    delete t.liquidLevel;
    delete t.liquidKind;
    // Build a stepped slope from height 4 at x=20 down to open sea (height 0) at x>=24
    if (t.x <= 20) {
      t.height = 4;
      t.terrain = 'grass';
    } else if (t.x === 21) {
      t.height = 3;
      t.terrain = 'grass';
    } else if (t.x === 22) {
      t.height = 2;
      t.terrain = 'grass';
    } else if (t.x === 23) {
      t.height = 1;
      t.terrain = 'grass';
    } else {
      t.height = 0;
      t.terrain = 'shallow_water';
    }
  }

  const peak = getTile(sim, 20, 24)!;
  const ok = executeTerrainDropTileImpact(sim, 'water_drop', 20, 24);
  assert.equal(ok, true);
  assert.equal(peak.height, 4, 'pouring water on a hilltop must not destroy the hill down to height 0');
  assert.ok((peak.liquidLevel ?? 0) > peak.height, 'hilltop receives dynamic elevated water');

  // Step simulation so water cascades downhill onto the lower terrace at x=21
  stepSimulation(sim, 0.12);
  const lowerStep = getTile(sim, 21, 24)!;
  assert.ok(
    (lowerStep.liquidLevel ?? 0) > lowerStep.height,
    'dynamic water must cascade downhill onto lower neighboring terraces',
  );

  // Continue stepping: water flowing down to the sea MUST strictly conserve volume and eventually run out!
  for (let i = 0; i < 80; i++) {
    stepSimulation(sim, 0.1);
  }
  let remainingElevatedTiles = 0;
  for (const t of sim.tiles) {
    if ((t.liquidLevel ?? 0) > t.height) remainingElevatedTiles++;
  }
  assert.equal(
    remainingElevatedTiles,
    0,
    'water poured on a mountain slope flowing into the sea must eventually run out cleanly',
  );
});

test('water_drop inside an enclosed basin pools into a continuous flat lake with zero checkerboard gaps', () => {
  const sim = createInitialSimulationState(32, 'DYNAMIC-WATER-BASIN-TEST');
  for (const t of sim.tiles) {
    t.buildingId = null;
    t.resourceNode = 'none';
    t.onFireTimer = 0;
    delete t.liquidLevel;
    delete t.liquidKind;
    // 5x5 enclosed crater floor (height 1) surrounded by height 3 walls
    const inFloor = t.x >= 12 && t.x <= 16 && t.z >= 12 && t.z <= 16;
    t.height = inFloor ? 1 : 3;
    t.terrain = 'grass';
  }

  executeTerrainDropTileImpact(sim, 'water_drop', 14, 14);
  for (let i = 0; i < 20; i++) {
    stepSimulation(sim, 0.1);
  }

  // Every single tile inside the 5x5 basin must be smoothly filled (zero dry checkerboard gaps!)
  for (let z = 12; z <= 16; z++) {
    for (let x = 12; x <= 16; x++) {
      const t = getTile(sim, x, z)!;
      assert.ok(
        (t.liquidLevel ?? 0) > t.height + 0.5,
        `basin tile (${x},${z}) must remain continuously filled without checkerboard gaps`,
      );
    }
  }
});

test('lava_drop and poison_drop pour dynamic elevated liquid on hills and cascade downhill', () => {
  const sim = createInitialSimulationState(32, 'LAVA-POISON-DROP-TEST');
  for (const t of sim.tiles) {
    t.buildingId = null;
    t.resourceNode = 'none';
    t.onFireTimer = 0;
    t.cursedTimer = 0;
    delete t.liquidLevel;
    delete t.liquidKind;
    t.height = t.x <= 14 ? 3 : 2;
    t.terrain = 'grass';
  }

  assert.equal(executeTerrainDropTileImpact(sim, 'lava_drop', 14, 10), true);
  assert.equal(executeTerrainDropTileImpact(sim, 'poison_drop', 14, 22), true);

  const lavaSrc = getTile(sim, 14, 10)!;
  const poisonSrc = getTile(sim, 14, 22)!;
  assert.equal(lavaSrc.liquidKind, 'lava');
  assert.equal(poisonSrc.liquidKind, 'poison');
  assert.equal(lavaSrc.height, 3, 'lava_drop does not carve height-0 hole');
  assert.equal(poisonSrc.height, 3, 'poison_drop does not carve height-0 hole');

  stepSimulation(sim, 0.12);
  const lavaDown = getTile(sim, 15, 10)!;
  const poisonDown = getTile(sim, 15, 22)!;
  assert.equal(lavaDown.liquidKind, 'lava', 'lava cascades downhill onto lower tile');
  assert.equal(poisonDown.liquidKind, 'poison', 'poison cascades downhill onto lower tile');
  assert.equal(lavaSrc.terrain, 'volcanic_wasteland', 'lava melts touched land into volcanic rock');
  assert.equal(lavaDown.terrain, 'volcanic_wasteland', 'cascading lava turns downhill blocks into volcanic rock');
  assert.equal(poisonSrc.terrain, 'blighted_mire', 'poison corrodes touched land into Land of Blight');
  assert.equal(poisonDown.terrain, 'blighted_mire', 'cascading poison turns downhill blocks into Land of Blight');
  assert.ok(poisonSrc.cursedTimer > 0, 'flowing poison corrupts ground beneath it');
  // Lava and poison must persist as active flowing liquid across multiple ticks instead of despawning immediately
  stepSimulation(sim, 0.12);
  stepSimulation(sim, 0.12);
  assert.ok((lavaDown.liquidLevel ?? 0) > lavaDown.height, 'lava remains actively flowing across ticks');
  assert.ok((poisonDown.liquidLevel ?? 0) > poisonDown.height, 'poison remains actively flowing across ticks');
});

test('lava_drop on water solidifies into stone (rock, height 1)', () => {
  const sim = createInitialSimulationState(24, 'LAVA-WATER-STONE-TEST');
  const seaTile = getTile(sim, 12, 12)!;
  seaTile.height = 0;
  seaTile.terrain = 'shallow_water';
  delete seaTile.waterKind;
  seaTile.buildingId = null;

  assert.equal(executeTerrainDropTileImpact(sim, 'lava_drop', 12, 12), true);
  assert.equal(seaTile.terrain, 'rock', 'lava dropped onto water must solidify into stone');
  assert.equal(seaTile.height, 1, 'stone formed by lava on water rises to land height 1');
});

test('lava_drop and poison_drop poured on a snowy mountain peak flow downhill and run out cleanly', () => {
  const sim = createInitialSimulationState(48, 'MOUNTAIN-LAVA-POISON-RUNOUT-TEST');
  for (const t of sim.tiles) {
    t.buildingId = null;
    t.resourceNode = 'none';
    t.onFireTimer = 0;
    t.cursedTimer = 0;
    delete t.liquidLevel;
    delete t.liquidKind;
    if (t.x <= 20) {
      t.height = 4;
      t.terrain = 'snow';
    } else if (t.x === 21) {
      t.height = 3;
      t.terrain = 'snow';
    } else if (t.x === 22) {
      t.height = 2;
      t.terrain = 'grass';
    } else if (t.x === 23) {
      t.height = 1;
      t.terrain = 'grass';
    } else {
      t.height = 0;
      t.terrain = 'shallow_water';
    }
  }

  assert.equal(executeTerrainDropTileImpact(sim, 'lava_drop', 20, 14), true);
  assert.equal(executeTerrainDropTileImpact(sim, 'poison_drop', 20, 32), true);

  // After a few ticks both streams should be actively flowing downhill
  for (let i = 0; i < 4; i++) {
    stepSimulation(sim, 0.1);
  }
  assert.ok((getTile(sim, 21, 14)!.liquidLevel ?? 0) > 3, 'lava should cascade down snowy mountain slope');
  assert.ok((getTile(sim, 21, 32)!.liquidLevel ?? 0) > 3, 'poison should cascade down snowy mountain slope');

  // After sufficient time, both lava and poison MUST thin out and run out completely to 0 elevated tiles
  for (let i = 0; i < 120; i++) {
    stepSimulation(sim, 0.1);
  }
  let remainingLava = 0;
  let remainingPoison = 0;
  for (const t of sim.tiles) {
    if ((t.liquidLevel ?? 0) > t.height) {
      if (t.liquidKind === 'lava') remainingLava++;
      if (t.liquidKind === 'poison') remainingPoison++;
    }
  }
  assert.equal(remainingLava, 0, 'lava poured on a snowy mountain must eventually cool/run out completely');
  assert.equal(remainingPoison, 0, 'poison poured on a snowy mountain must eventually soak/run out completely');
});

