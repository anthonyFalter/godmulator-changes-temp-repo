import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeTwoFingerCameraDelta,
  computeTwoFingerState,
  getResponsiveMaxZoomOut,
  getResponsiveTitleFrustum,
  getResponsiveWholeMapFrustum,
  normalizeAngleDelta,
} from './cameraTouch';

test('portrait viewport expands whole-map frustum and zoom-out ceiling so full island fits', () => {
  const desktopWhole = getResponsiveWholeMapFrustum(128, 16 / 9);
  const portraitWhole = getResponsiveWholeMapFrustum(128, 390 / 844);
  const landscapeWhole = getResponsiveWholeMapFrustum(128, 844 / 390);

  assert.equal(desktopWhole, 105);
  assert.equal(landscapeWhole, 105);
  assert.ok(portraitWhole > desktopWhole * 1.8, `portraitWhole=${portraitWhole} should fit full width`);

  const portraitMaxZoom = getResponsiveMaxZoomOut(128, 390 / 844);
  assert.ok(portraitMaxZoom > portraitWhole, 'max zoom out should exceed portrait whole-map view');
  assert.ok(getResponsiveTitleFrustum(390 / 844) > getResponsiveTitleFrustum(16 / 9));
});

test('two-finger pinch zoom scales frustum in and out smoothly within bounds', () => {
  const prev = computeTwoFingerState(
    { clientX: 100, clientY: 200 },
    { clientX: 200, clientY: 200 },
  );
  // Pinch out (fingers spread apart 100px -> 150px) zooms IN (smaller frustum)
  const spread = computeTwoFingerState(
    { clientX: 75, clientY: 200 },
    { clientX: 225, clientY: 200 },
  );
  const zoomInRes = computeTwoFingerCameraDelta(prev, spread, 60, 200, 800);
  assert.ok(zoomInRes.nextFrustum < 60, 'spreading fingers must zoom in');

  // Pinch in (fingers closer 100px -> 75px) zooms OUT (larger frustum)
  const pinch = computeTwoFingerState(
    { clientX: 112.5, clientY: 200 },
    { clientX: 187.5, clientY: 200 },
  );
  const zoomOutRes = computeTwoFingerCameraDelta(prev, pinch, 60, 200, 800);
  assert.ok(zoomOutRes.nextFrustum > 60, 'pinching fingers together must zoom out');
});

test('two-finger twist computes shortest wrapped rotation delta and centroid pan delta', () => {
  assert.ok(Math.abs(normalizeAngleDelta(Math.PI * 1.9) - -Math.PI * 0.1) < 1e-6);

  const prev = computeTwoFingerState(
    { clientX: 100, clientY: 200 },
    { clientX: 200, clientY: 200 },
  );
  // Rotate clockwise by ~0.25 rad and drag centroid (+20, -15)
  const dx = 50 * Math.cos(0.25);
  const dy = 50 * Math.sin(0.25);
  const next = computeTwoFingerState(
    { clientX: 170 - dx, clientY: 185 - dy },
    { clientX: 170 + dx, clientY: 185 + dy },
  );
  const delta = computeTwoFingerCameraDelta(prev, next, 50, 200, 800);
  assert.ok(Math.abs(delta.yawDelta - 0.25) < 0.01);
  assert.equal(delta.panScreenDx, 20);
  assert.equal(delta.panScreenDy, -15);
  assert.ok(delta.panFactor > 0);
});
