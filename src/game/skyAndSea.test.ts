import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createOceanFoamSystem,
  createPixelSpaceSystem,
  createSkyCloudSystem,
  createWorldUnderglowSystem,
  createZoneOverlaySystem,
} from './skyAndSea';
import type { TileData } from './types';

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
  assert.equal(skyA.mesh.renderOrder, 100);

  const mat = skyA.mesh.material as THREE.ShaderMaterial;
  assert.equal(mat.depthTest, true);
  assert.equal(mat.depthFunc, THREE.LessEqualDepth);
  assert.ok(Number.isFinite(mat.uniforms.uTime.value));
  assert.ok(mat.uniforms.uTime.value >= 0 && mat.uniforms.uTime.value < 1900);

  // Zooming through dynamic framebuffer resizes keeps viewport aspect locked without integer-rounding wobble
  const cssAspect = 1366 / 768;
  for (const [rw, rh, frustum] of [
    [546, 307, 10],
    [728, 409, 28],
    [1024, 576, 60],
    [1366, 768, 110],
  ] as const) {
    skyA.update({
      elapsed: 120,
      width: rw,
      height: rh,
      viewportAspect: cssAspect,
      pixelScale: 1366 / rw,
      camYaw: Math.PI / 4,
      camX: 64,
      camZ: 64,
      frustumSize: frustum,
      preset: 'night',
    });
    assert.ok(Math.abs(mat.uniforms.uViewportAspect.value - cssAspect) < 1e-6);
  }

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

test('Zone overlay uses GreaterDepth occluded X-ray pass above objects without double-tinting open ground', () => {
  const gridSize = 16;
  const overlay = createZoneOverlaySystem(gridSize);
  const clouds = createSkyCloudSystem(gridSize);
  const mat = overlay.mesh.material as THREE.ShaderMaterial;

  // Starts hidden when no zone is active (zero GPU overhead)
  assert.equal(overlay.mesh.visible, false);
  assert.equal(mat.transparent, true);
  assert.equal(mat.depthTest, true);
  assert.equal(mat.depthFunc, THREE.GreaterDepth);
  assert.equal(mat.depthWrite, false);
  assert.equal(mat.toneMapped, false);

  // Renders after opaque trees/buildings/units/VFX (9) and before high sky clouds (12)
  assert.ok(overlay.mesh.renderOrder > 9, `expected renderOrder > 9, got ${overlay.mesh.renderOrder}`);
  for (const child of clouds.group.children) {
    assert.ok(overlay.mesh.renderOrder < child.renderOrder);
  }

  // Update map heights and verify water sits at 0.28 and land at height * 0.45 + 0.28 (+0.03 above block top)
  const tiles: TileData[] = [];
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      tiles.push({
        x,
        z,
        height: x === 5 && z === 5 ? 3 : 0,
        terrain: x === 5 && z === 5 ? 'forest' : 'deep_water',
        resourceNode: 'none',
        resourceAmount: 0,
        buildingId: null,
        onFireTimer: 0,
        blessedTimer: 0,
        cursedTimer: 0,
      });
    }
  }
  overlay.updateMap(tiles);
  const posAttr = overlay.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  // Tile (0,0) is water -> y = 0.28
  assert.ok(Math.abs(posAttr.getY(0) - 0.28) < 1e-4);
  // Tile (5,5) is height 3 -> y = 3 * 0.45 + 0.28 = 1.63
  const landVertexIdx = (5 * gridSize + 5) * 4;
  assert.ok(Math.abs(posAttr.getY(landVertexIdx) - (3 * 0.45 + 0.28)) < 1e-4);

  // Toggling zones flips mesh visibility cleanly
  const colors = new Uint8Array(gridSize * gridSize * 4);
  const ids = new Uint8Array(gridSize * gridSize * 4);
  colors[0] = 255;
  colors[3] = 220;
  ids[0] = 1;
  overlay.updateZones(colors, ids, true);
  assert.equal(overlay.mesh.visible, true);
  assert.equal(mat.uniforms.uZoneActive.value, 1);

  overlay.updateZones(colors, ids, false);
  assert.equal(overlay.mesh.visible, false);
  assert.equal(mat.uniforms.uZoneActive.value, 0);

  overlay.updateFrame(42.5);
  assert.ok(Number.isFinite(mat.uniforms.uTime.value));

  overlay.dispose();
  clouds.dispose();
});

test('Poison smoothly gradients across connected active water and never bleeds through land barriers', () => {
  const gridSize = 16;
  const ocean = createOceanFoamSystem(gridSize);
  const tiles: TileData[] = [];
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      // Wall along x === 4 separates poison (x=3) from right-side water (x>=5),
      // while row z === 8 has an open channel at (4, 8) once lowered!
      const isBarrier = x === 4;
      tiles.push({
        x,
        z,
        height: isBarrier ? 1 : 0,
        terrain: isBarrier ? 'grass' : 'shallow_water',
        waterKind: x === 3 && z === 8 ? 'poison' : undefined,
        resourceNode: 'none',
        resourceAmount: 0,
        buildingId: null,
        onFireTimer: 0,
        blessedTimer: 0,
        cursedTimer: 0,
      });
    }
  }

  const mat = ocean.mesh.material as THREE.ShaderMaterial;
  const waterTex = mat.uniforms.uWaterMap.value as THREE.DataTexture;
  const getBlue = (x: number, z: number) => (waterTex.image.data as Uint8Array)[(z * gridSize + x) * 4 + 2];

  // With intact land barrier at x=4, poison (3,8) must NOT bleed onto water at (5,8)
  ocean.updateMap(tiles);
  assert.equal(getBlue(3, 8), 76, 'Poison source tile should encode full concentration 76');
  assert.equal(getBlue(5, 8), 0, 'Land barrier must block poison from bleeding across dry land');
  // Connected clean water on the left (2,8 -> 1,8 -> 0,8) should form a smoothly decreasing dilution gradient
  const b1 = getBlue(2, 8);
  const b2 = getBlue(1, 8);
  const b3 = getBlue(0, 8);
  assert.ok(b1 > b2 && b2 > b3 && b3 > 0 && b1 < 76, `Expected monotonic dilution gradient, got ${b1}, ${b2}, ${b3}`);

  // Lowering the barrier at (4,8) connects poison to right-side active water
  const barrier = tiles[8 * gridSize + 4];
  barrier.height = 0;
  barrier.terrain = 'shallow_water';
  ocean.updateMap(tiles);
  const bBarrier = getBlue(4, 8);
  const bRight1 = getBlue(5, 8);
  const bRight2 = getBlue(6, 8);
  assert.ok(
    bBarrier > bRight1 && bRight1 > bRight2 && bRight2 > 0,
    `Expected smooth dilution gradient through opened channel, got ${bBarrier}, ${bRight1}, ${bRight2}`,
  );

  // Verify quenched river tile next to volcanic_wasteland does NOT falsely render as lava (135)
  tiles[2 * gridSize + 10].height = 1;
  tiles[2 * gridSize + 10].terrain = 'volcanic_wasteland';
  tiles[2 * gridSize + 11].height = 0;
  tiles[2 * gridSize + 11].terrain = 'shallow_water';
  tiles[2 * gridSize + 11].isRiver = true;
  delete tiles[2 * gridSize + 11].waterKind;
  ocean.updateMap(tiles);
  assert.equal(getBlue(11, 2), 170, 'Quenched river next to volcanic_wasteland should render as river water, not lava');

  ocean.dispose();
});


