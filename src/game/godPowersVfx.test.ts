import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GOD_POWERS } from './catalog';
import {
  ENHANCED_HAZARD_KINDS,
  EnhancedHazardKind,
  createEnhancedHazardVfx,
  createSharedGodPowerGeos,
  disposeEnhancedHazardVfx,
  updateEnhancedHazardVfx,
} from './godPowerVfx';
import {
  castGodPower,
  createInitialSimulationState,
  spawnUnit,
  stepSimulation,
} from './simulation';
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
});
