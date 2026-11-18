import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createPixelSpaceSystem } from './skyAndSea';

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
