import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GOD_POWERS, TERRAIN_TOOLS } from './catalog';
import {
  ENHANCED_HAZARD_KINDS,
  EnhancedHazardKind,
  createEnhancedHazardVfx,
  createSharedGodPowerGeos,
  disposeEnhancedHazardVfx,
  updateEnhancedHazardVfx,
} from './godPowerVfx';
import {
  applyTerrainTool,
  castGodPower,
  createInitialSimulationState,
  placeBuilding,
  spawnUnit,
  stepSimulation,
} from './simulation';
import { TERRAIN_SPRITES } from '../components/icons/uiAndWorldSprites';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  applyGraphicsPreset,
  sanitizeGraphicsSettings,
} from './graphics';
import type { ActiveHazardZone } from './types';

function makeDummyCircleMat() {
  return new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
}

describe('God Powers Dramatic VFX & Gameplay Rework', () => {
  it('renames fortify_walls to Eye of Judgment and summons a laser-firing sentinel_eye hazard that attacks any nearby unit', () => {
    const def = GOD_POWERS.find((p) => p.type === 'fortify_walls');
    assert.ok(def, 'fortify_walls definition should exist');
    assert.equal(def.name, 'Eye of Judgment');
    assert.equal(def.category, 'Wrathful');

    const state = createInitialSimulationState();
    state.sandboxFreeMode = true;

    const center = Math.floor(state.gridSize / 2);
    let landX = center;
    let landZ = center;
    for (const t of state.tiles) {
      if (t.height > 0 && Math.hypot(t.x - center, t.z - center) < 14) {
        landX = t.x;
        landZ = t.z;
        break;
      }
    }

    state.units = [];
    const spawned = spawnUnit(state, 'warrior', landX + 2, landZ + 1, true);
    assert.equal(spawned.ok, true);
    const targetUnit = spawned.unit!;
    const initialHp = targetUnit.hp;

    const castRes = castGodPower(state, 'fortify_walls', landX, landZ);
    assert.equal(castRes.ok, true);

    const eyeHaz = state.activeHazards.find((h) => h.kind === 'sentinel_eye');
    assert.ok(eyeHaz, 'sentinel_eye hazard should be spawned');
    assert.ok(eyeHaz.radius >= 9.5, 'sentinel_eye radius should be >= 9.5');

    for (let i = 0; i < 20; i++) {
      stepSimulation(state, 0.08);
    }

    assert.ok(targetUnit.hp < initialHp, 'Eye of Judgment laser should damage nearby unit');
    assert.ok(eyeHaz.beamTargetX !== undefined && eyeHaz.beamTargetZ !== undefined, 'Eye should track target coords');
    const hasLaserVfx = state.pendingVfx.some((v) => v.vfxSubtype === 'laser_beam');
    assert.equal(hasLaserVfx, true, 'Eye should emit laser_beam VFX');
  });

  it('executes Purify in 3 synchronized phases: descent, expanding purification, and skyward ascension', () => {
    const state = createInitialSimulationState();
    state.sandboxFreeMode = true;

    const center = Math.floor(state.gridSize / 2);
    const landTile = state.tiles.find((t) => t.height > 0 && Math.hypot(t.x - center, t.z - center) < 14)!;
    assert.ok(landTile, 'land tile should exist');
    landTile.terrain = 'blighted_mire';
    landTile.cursedTimer = 15;
    landTile.onFireTimer = 10;

    const castRes = castGodPower(state, 'cleanse_land', landTile.x, landTile.z);
    assert.equal(castRes.ok, true);

    const haz = state.activeHazards.find((h) => h.kind === 'purify_wave');
    assert.ok(haz, 'purify_wave hazard should be spawned');
    assert.ok(haz.duration >= 4.0, 'purify_wave duration should support 3-phase sky beam');

    // Phase 1: early descent (<18% progress)
    stepSimulation(state, 0.25);
    assert.ok((haz.currentRadius ?? 0) <= 0.5, 'beam should stay tight during sky descent');

    // Phase 2: expanding beam (around 50% progress) cleanses blight, fire & curse
    for (let i = 0; i < 24; i++) {
      stepSimulation(state, 0.1);
    }
    assert.ok((haz.currentRadius ?? 0) > 2.5, 'beam should expand outward during phase 2');
    assert.equal(landTile.terrain, 'grass');
    assert.equal(landTile.cursedTimer, 0);
    assert.equal(landTile.onFireTimer, 0);

    // Phase 3: retraction (>80% progress) contracts beam back inward before ascending
    const expandedR = haz.currentRadius ?? 0;
    for (let i = 0; i < 14; i++) {
      stepSimulation(state, 0.1);
    }
    assert.ok((haz.currentRadius ?? 0) < expandedR, 'beam should contract during skyward retraction');
  });

  it('renders Locust Swarm with 1 InstancedMesh of >= 64 articulated flying voxel locusts and conforms to draw-call & particle-throttle budgets for all 10 hazards', () => {
    const geos = createSharedGodPowerGeos();
    const magicCircleGeo = new THREE.PlaneGeometry(2, 2);

    const particleCalls = { burst: 0, rising: 0 };
    const callbacks = {
      spawnBurst: () => {
        particleCalls.burst += 1;
      },
      spawnRising: () => {
        particleCalls.rising += 1;
      },
      getGroundY: () => 0.8,
    };

    for (const kindStr of ENHANCED_HAZARD_KINDS) {
      const kind = kindStr as EnhancedHazardKind;
      const vfx = createEnhancedHazardVfx(kind, 7.0, geos, magicCircleGeo, makeDummyCircleMat);

      let meshDrawCalls = 0;
      vfx.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) meshDrawCalls += 1;
      });
      assert.ok(meshDrawCalls <= 18, `${kind} mesh count (${meshDrawCalls}) should stay low`);

      if (kind === 'locust_swarm') {
        assert.equal(vfx.instancedMeshes.length, 1);
        assert.ok(vfx.instancedMeshes[0].count >= 64, 'Locust Swarm should render >= 64 instanced locusts');
      }

      const haz: ActiveHazardZone = {
        id: `test_${kind}`,
        kind,
        biomeWaveKind: 'floral',
        x: 32,
        z: 32,
        radius: 7.0,
        currentRadius: 4.5,
        maxRadius: 7.0,
        remaining: 3.0,
        duration: 4.4,
        tickTimer: 0.1,
        beamTargetX: 35,
        beamTargetZ: 34,
        beamFireTimer: 0.25,
        heading: 0.6,
      };

      // Simulate 3 frames at 60 FPS (dt = 0.016) — particle timer throttles emission to ~18 Hz
      particleCalls.burst = 0;
      particleCalls.rising = 0;
      for (let f = 0; f < 3; f++) {
        updateEnhancedHazardVfx(vfx, haz, 0.8, f * 0.016, 0.016, 1.0, callbacks);
      }
      assert.ok(
        particleCalls.burst + particleCalls.rising <= 1,
        `${kind} should throttle ambient particles (~18 Hz)`,
      );

      // Verify Purify sky-beam 3-phase vertical kinematics (descent -> grounded expansion -> skyward retraction)
      if (kind === 'purify_wave') {
        const beamCore = vfx.refs.beamCore as THREE.Mesh;
        haz.remaining = haz.duration * 0.95;
        updateEnhancedHazardVfx(vfx, haz, 0.8, 0.2, 0.016, 1.0, callbacks);
        assert.ok(beamCore.position.y > 20, 'Phase 1 beam should descend from high sky');

        haz.remaining = haz.duration * 0.5;
        updateEnhancedHazardVfx(vfx, haz, 0.8, 2.2, 0.016, 1.0, callbacks);
        assert.ok(Math.abs(beamCore.position.y - 13) < 0.5, 'Phase 2 beam should be grounded');
        assert.ok(beamCore.scale.x > 1.5, 'Phase 2 beam should expand outward');

        haz.remaining = haz.duration * 0.08;
        updateEnhancedHazardVfx(vfx, haz, 0.8, 4.05, 0.016, 1.0, callbacks);
        assert.ok(beamCore.position.y > 17, 'Phase 3 beam should retract back up into the sky');
      }

      disposeEnhancedHazardVfx(vfx);
    }

    magicCircleGeo.dispose();
    geos.dispose();
  });

  it('reworks Solar Beam into a blazing overhead Sun that periodically launches map-wide solar projectiles creating lava on impact', () => {
    assert.ok(ENHANCED_HAZARD_KINDS.has('orbital_beam'), 'orbital_beam should use the enhanced Sun + Beam VFX');

    const state = createInitialSimulationState();
    state.sandboxFreeMode = true;
    const center = Math.floor(state.gridSize / 2);

    const res = castGodPower(state, 'solar_orbital_laser', center, center);
    assert.equal(res.ok, true);

    const beamHaz = state.activeHazards.find((h) => h.kind === 'orbital_beam');
    assert.ok(beamHaz, 'orbital_beam hazard should spawn');
    assert.ok(beamHaz.duration >= 8.0, 'Solar Beam should stay active long enough for multiple flare salvos');

    let sawInFlightProjectiles = false;
    const impactPositions: Array<{ x: number; z: number }> = [];

    for (let step = 0; step < 65; step++) {
      stepSimulation(state, 0.1);
      if ((beamHaz.solarProjectiles?.length ?? 0) > 0) {
        sawInFlightProjectiles = true;
      }
      if (beamHaz.recentSolarImpacts && beamHaz.recentSolarImpacts.length > 0) {
        for (const imp of beamHaz.recentSolarImpacts) {
          impactPositions.push({ x: imp.x, z: imp.z });
        }
        beamHaz.recentSolarImpacts.length = 0;
      }
    }

    assert.equal(sawInFlightProjectiles, true, 'Sun should periodically launch solar projectiles');
    assert.ok(impactPositions.length >= 6, `Expected >= 6 map-wide solar impacts, got ${impactPositions.length}`);

    // Verify impacts spread across multiple distinct quadrants of the map
    const half = state.gridSize / 2;
    const quadrantsHit = new Set(
      impactPositions.map((p) => `${p.x < half ? 'W' : 'E'}${p.z < half ? 'N' : 'S'}`),
    );
    assert.ok(quadrantsHit.size >= 3, `Solar projectiles should hit across the map (quadrants hit: ${quadrantsHit.size})`);

    // Verify landing projectiles created real glowing molten lava tiles
    const lavaTiles = state.tiles.filter((t) => t.waterKind === 'lava');
    assert.ok(lavaTiles.length >= 12, `Expected >= 12 molten lava tiles from impacts, got ${lavaTiles.length}`);
  });

  it('tracks WorldStats accurately for births, deaths, cities created/destroyed, wildlife, and mythical creatures', () => {
    const state = createInitialSimulationState();
    state.sandboxFreeMode = true;
    const landTile = state.tiles.find((t) => t.height >= 1 && t.height <= 4 && !t.buildingId);
    assert.ok(landTile, 'Expected a land tile');

    const startStats = { ...(state.worldStats!) };

    // Spawn a newborn citizen, a wildlife animal, and a mythical dragon
    const birthRes = spawnUnit(state, 'human', landTile.x, landTile.z, true, undefined, {
      ageStage: 'child',
      isBirth: true,
    });
    assert.equal(birthRes.ok, true);

    const wolfRes = spawnUnit(state, 'wolf', landTile.x, landTile.z, true);
    assert.equal(wolfRes.ok, true);

    const dragonRes = spawnUnit(state, 'dragon', landTile.x, landTile.z, true);
    assert.equal(dragonRes.ok, true);

    assert.equal(state.worldStats!.totalBirths, startStats.totalBirths + 1);
    assert.equal(state.worldStats!.wildlifeSpawned, startStats.wildlifeSpawned + 1);
    assert.equal(state.worldStats!.mythicalSpawned, startStats.mythicalSpawned + 1);

    // Kill the wildlife and mythical unit and step past koTimer
    wolfRes.unit!.hp = 0;
    dragonRes.unit!.hp = 0;
    for (let i = 0; i < 12; i++) {
      stepSimulation(state, 0.1);
    }

    assert.ok(state.worldStats!.totalDeaths >= startStats.totalDeaths + 2);
    assert.ok(state.worldStats!.wildlifeDeaths >= startStats.wildlifeDeaths + 1);
    assert.ok(state.worldStats!.mythicalDeaths >= startStats.mythicalDeaths + 1);

    // Create a brand new isolated city via building placement and then destroy it
    const isolatedTile = state.tiles.find(
      (t) =>
        t.height >= 1 &&
        t.height <= 3 &&
        !t.buildingId &&
        state.buildings.every((b) => Math.hypot(b.tileX - t.x, b.tileZ - t.z) > 16),
    );
    if (isolatedTile) {
      const citiesBefore = state.worldStats!.citiesCreated;
      const destroyedBefore = state.worldStats!.citiesDestroyed;
      const bldRes = placeBuilding(state, 'bonfire', isolatedTile.x, isolatedTile.z);
      assert.equal(bldRes.ok, true);
      assert.equal(state.worldStats!.citiesCreated, citiesBefore + 1);

      const newBld = state.buildings.find((b) => b.tileX === isolatedTile.x && b.tileZ === isolatedTile.z);
      assert.ok(newBld);
      // Remove any adopted units in that settlement so destroying the building destroys the city
      state.units = state.units.filter((u) => u.settlementId !== newBld.settlementId);
      newBld.hp = 0;
      stepSimulation(state, 0.1);
      assert.equal(state.worldStats!.citiesDestroyed, destroyedBefore + 1);
      assert.ok(state.worldStats!.buildingsDestroyed >= 1);
    }
  });

  it('defaults cameraShake to true and preserves disabled state through sanitizeGraphicsSettings and applyGraphicsPreset', () => {
    assert.equal(DEFAULT_GRAPHICS_SETTINGS.cameraShake, true);
    assert.equal(sanitizeGraphicsSettings({}).cameraShake, true);
    assert.equal(sanitizeGraphicsSettings({ cameraShake: false }).cameraShake, false);
    assert.equal(applyGraphicsPreset('fast', true, true, false, false).cameraShake, false);
    assert.equal(applyGraphicsPreset('high', true, true, false, true).cameraShake, true);
  });

  it('quenches lava into water when a barrier block between lava and water is lowered and propagates across connected lava', () => {
    const state = createInitialSimulationState();
    state.sandboxFreeMode = true;
    const gs = state.gridSize;
    const cx = Math.floor(gs / 2);
    const cz = Math.floor(gs / 2);
    const tileAt = (x: number, z: number) => state.tiles[z * gs + x];

    // Build a clean test arena: active water on the left (cx-2), 1-block land barrier at cx-1, lava strip at cx..cx+2
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        const t = tileAt(cx + dx, cz + dz);
        t.buildingId = null;
        t.resourceNode = 'none';
        t.resourceAmount = 0;
        t.height = 1;
        t.terrain = 'grass';
        delete t.waterKind;
        t.isRiver = false;
        t.isLake = false;
      }
    }
    const waterTile = tileAt(cx - 2, cz);
    waterTile.height = 0;
    waterTile.terrain = 'shallow_water';

    for (let dx = 0; dx <= 2; dx++) {
      const lt = tileAt(cx + dx, cz);
      lt.height = 0;
      lt.terrain = 'shallow_water';
      lt.waterKind = 'lava';
    }

    // Lower the barrier tile at (cx - 1, cz) using the terrain sculpt lower tool (radius 0)
    const lowerRes = applyTerrainTool(state, 'lower', cx - 1, cz, 0);
    assert.equal(lowerRes.ok, true);
    assert.equal(tileAt(cx - 1, cz).height, 0);
    assert.equal(tileAt(cx - 1, cz).waterKind, undefined);
    // Immediately touching lava tile at (cx, cz) should quench straight into water
    assert.equal(tileAt(cx, cz).height, 0, 'Quenched lava should stay at water height 0');
    assert.equal(tileAt(cx, cz).waterKind, undefined, 'Touching lava tile should quench into regular water');
    assert.equal(tileAt(cx, cz).terrain, 'shallow_water');

    // Step simulation so the water wave front quenches the remaining connected lava tiles (cx+1, cx+2)
    for (let i = 0; i < 20; i++) {
      stepSimulation(state, 0.1);
    }
    assert.equal(tileAt(cx + 1, cz).waterKind, undefined, 'Connected lava tile 2 should quench to water');
    assert.equal(tileAt(cx + 2, cz).waterKind, undefined, 'Connected lava tile 3 should quench to water');
  });

  it('dilutes exposed poison tiles when connected to active open water', () => {
    const state = createInitialSimulationState();
    state.sandboxFreeMode = true;
    const gs = state.gridSize;
    const cx = Math.floor(gs / 2);
    const cz = Math.floor(gs / 2);
    const tileAt = (x: number, z: number) => state.tiles[z * gs + x];

    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const t = tileAt(cx + dx, cz + dz);
        t.buildingId = null;
        t.height = 0;
        t.terrain = 'shallow_water';
        delete t.waterKind;
      }
    }
    // Single exposed poison tile surrounded by clean water should dilute smoothly
    const poisonTip = tileAt(cx, cz);
    poisonTip.waterKind = 'poison';

    for (let i = 0; i < 10; i++) {
      stepSimulation(state, 0.1);
    }
    assert.equal(poisonTip.waterKind, undefined, 'Exposed poison surrounded by active water should dilute to clean water');
  });

  it('compiles non-empty 16x16 pixel sprites for all Terrain Sculpt tools', () => {
    const sculptTools = TERRAIN_TOOLS.filter((t) => t.category === 'Sculpt');
    assert.ok(sculptTools.length >= 11);
    for (const tool of sculptTools) {
      const sprite = TERRAIN_SPRITES[tool.type];
      assert.ok(sprite, `Missing sprite for ${tool.type}`);
      assert.equal(sprite.size, 16, `Expected 16x16 sprite for ${tool.type}`);
      assert.ok(sprite.paths.length > 0, `Expected non-empty paths for ${tool.type}`);
    }
  });
});
