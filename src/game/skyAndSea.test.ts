import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createOceanFoamSystem,
  createPixelSpaceSystem,
  createSkyCloudSystem,
  createWorldUnderglowSystem,
} from './skyAndSea';

test('Starry space backdrop is uniquely randomized per world seed and stays locked until a new world seed is set', () => {
  const skyA = createPixelSpaceSystem(104729);
  const stateAInitial = skyA.getDebugState();

  // Quality adjustments (including FPS auto-trim 'reduced'/'off') must NEVER hide stars or alter shader mode
  skyA.setQuality('off');
  skyA.setQuality('reduced');
  skyA.setQuality('full');

  // Advancing updates across presets, zooms, and long elapsed playtimes keeps cosmic parameters unchanged
  for (const elapsed of [1, 45, 900, 12_500]) {
    skyA.update({
      elapsed,
      width: 640,
      height: 360,
      pixelScale: elapsed > 50 ? 2 : 3,
      camYaw: Math.PI / 4,
      camX: 64,
      camZ: 64,
      frustumSize: elapsed > 50 ? 42 : 14,
      preset: elapsed > 900 ? 'midnight' : 'noon',
    });
  }

  const stateAAfterPlay = skyA.getDebugState();
  assert.deepEqual(stateAAfterPlay, stateAInitial);
  assert.equal(stateAAfterPlay.spaceQuality, 2.0);
  assert.equal(skyA.mesh.renderOrder, -100);

  const mat = skyA.mesh.material as THREE.ShaderMaterial;
  assert.ok(Number.isFinite(mat.uniforms.uTime.value));
  assert.ok(mat.uniforms.uTime.value >= 0 && mat.uniforms.uTime.value < 1900);

  // Calling setSeed with the same seed leaves the cosmos unchanged
  skyA.setSeed(104729);
  assert.deepEqual(skyA.getDebugState(), stateAInitial);

  // Creating a new world with a different seed produces a distinct cosmic sky
  skyA.setSeed(883921);
  const stateB = skyA.getDebugState();
  assert.notEqual(stateB.seed, stateAInitial.seed);
  assert.ok(
    stateB.bandAngle !== stateAInitial.bandAngle ||
      stateB.bandAHex !== stateAInitial.bandAHex ||
      stateB.bandBHex !== stateAInitial.bandBHex,
  );

  skyA.dispose();
});

test('Ocean surface renders before all transparent VFX, unit attacks, and magic circles', () => {
  const ocean = createOceanFoamSystem(32);
  const underglow = createWorldUnderglowSystem(32);
  const clouds = createSkyCloudSystem(32);

  // Ocean surface must draw strictly before default renderOrder (0) transparent unit attacks & powers
  assert.ok(ocean.mesh.renderOrder < 0, `expected ocean renderOrder < 0, got ${ocean.mesh.renderOrder}`);
  assert.equal((ocean.mesh.material as THREE.ShaderMaterial).transparent, true);
  assert.equal((ocean.mesh.material as THREE.ShaderMaterial).depthWrite, false);
  // Water surface + max wave swell (0.295 + 0.030 = 0.325) stays strictly below water VFX surface Y (0.36)
  assert.ok(ocean.mesh.position.y + 0.03 < 0.36);

  assert.ok(underglow.mesh.renderOrder < 0);
  assert.ok(ocean.mesh.renderOrder < underglow.mesh.renderOrder);

  // Cloud shadows render above ocean but strictly below transparent VFX (renderOrder >= 0)
  assert.ok(clouds.shadowGroup.children.length > 0);
  for (const child of clouds.shadowGroup.children) {
    assert.ok(child.renderOrder > ocean.mesh.renderOrder && child.renderOrder < 0);
  }
  // High-altitude clouds render above ground VFX (renderOrder 9)
  assert.ok(clouds.group.children.length > 0);
  for (const child of clouds.group.children) {
    assert.ok(child.renderOrder > 9);
  }

  ocean.dispose();
  underglow.dispose();
  clouds.dispose();
});
