import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeDynamicPixelScale,
  computeDynamicRenderDimensions,
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

test('mobile portrait and landscape dynamic pixelation scales smoothly across DPR and zoom', () => {
  // Narrow mobile portrait (360x800, DPR 3): must NOT clamp at 160px when zoomed in,
  // must visibly sharpen as you zoom out, and must unlock HiDPI crispness at whole-map zoom
  const portraitAspect = 360 / 800;
  const wholePortrait = getResponsiveWholeMapFrustum(128, portraitAspect);

  const sClose = computeDynamicPixelScale(8, 128, portraitAspect);
  const sVillage = computeDynamicPixelScale(35, 128, portraitAspect);
  const sRegion = computeDynamicPixelScale(100, 128, portraitAspect);
  const sWhole = computeDynamicPixelScale(wholePortrait, 128, portraitAspect);

  assert.equal(sClose, 2.5);
  assert.ok(sVillage < 2.25, `Portrait village zoom should noticeably sharpen (got ${sVillage})`);
  assert.ok(sRegion < sVillage);
  assert.equal(sWhole, 1.0, 'Portrait whole-map view should reach crisp 1.0 pixel scale');

  const dimClose = computeDynamicRenderDimensions(360, 800, sClose, 3);
  const dimVillage = computeDynamicRenderDimensions(360, 800, sVillage, 3);
  const dimWhole = computeDynamicRenderDimensions(360, 800, sWhole, 3);

  assert.equal(dimClose.width, 144, '360px phone zoomed in must not clamp at 160px');
  assert.ok(dimVillage.width > dimClose.width + 40, `Expected clear jump from close (${dimClose.width}) to village (${dimVillage.width})`);
  assert.equal(dimWhole.width, 720, 'Zoomed-out HiDPI phone should unlock 2x crisp buffer width');
  assert.equal(dimWhole.height, 1600, 'Zoomed-out HiDPI phone should unlock 2x crisp buffer height');

  // Desktop 1080p (DPR 1): exact 1:1 behavior preserved
  const pcClose = computeDynamicRenderDimensions(1920, 1080, 2.5, 1);
  const pcFar = computeDynamicRenderDimensions(1920, 1080, 1.0, 1);
  assert.equal(pcClose.width, 768);
  assert.equal(pcClose.height, 432);
  assert.equal(pcFar.width, 1920);
  assert.equal(pcFar.height, 1080);
});
