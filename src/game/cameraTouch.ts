export interface TouchPoint {
  clientX: number;
  clientY: number;
}

export interface TwoFingerState {
  midX: number;
  midY: number;
  dist: number;
  angle: number;
}

export function getResponsiveWholeMapFrustum(gridSize: number, aspect: number): number {
  const base = gridSize * (105 / 128);
  const safeAspect = Math.max(0.35, Math.min(3.5, aspect || 1));
  if (safeAspect < 1.1) {
    const scale = Math.min(2.6, 1.12 / safeAspect);
    return Math.round(base * scale);
  }
  return Math.round(base);
}

export function getResponsiveMaxZoomOut(gridSize: number, aspect: number): number {
  return Math.max(125, Math.round(getResponsiveWholeMapFrustum(gridSize, aspect) * 1.35));
}

export function getResponsiveTitleFrustum(aspect: number): number {
  const safeAspect = Math.max(0.45, Math.min(3.5, aspect || 1));
  if (safeAspect < 1) {
    return Math.round(22 / Math.max(0.55, safeAspect));
  }
  return 22;
}

/**
 * Smoothly interpolates the rendering pixel scale based on camera zoom:
 * - 3.0x when fully zoomed in (frustum <= 8.0)
 * - 1.0x when fully zoomed out (frustum >= maxZoomOut)
 * - Continuously scales through intermediate levels (3.0 -> 2.98 -> 2.xx -> ... -> 1.0)
 */
export function computeDynamicPixelScale(
  currentFrustum: number,
  gridSize: number,
  aspect: number,
  baseScale = 3.0,
  minScale = 1.0,
): number {
  const minFrustum = 8.0;
  const maxFrustum = getResponsiveMaxZoomOut(gridSize, aspect);
  const span = Math.max(1, maxFrustum - minFrustum);
  const zoomFactor = Math.max(0, Math.min(1, (currentFrustum - minFrustum) / span));
  const raw = baseScale - zoomFactor * (baseScale - minScale);
  return Math.round(raw * 1000) / 1000;
}

export function computeTwoFingerState(a: TouchPoint, b: TouchPoint): TwoFingerState {
  const midX = (a.clientX + b.clientX) * 0.5;
  const midY = (a.clientY + b.clientY) * 0.5;
  const dx = b.clientX - a.clientX;
  const dy = b.clientY - a.clientY;
  const dist = Math.max(10, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  return { midX, midY, dist, angle };
}

export function normalizeAngleDelta(delta: number): number {
  let d = delta;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function computeTwoFingerCameraDelta(
  prev: TwoFingerState,
  next: TwoFingerState,
  currentFrustum: number,
  maxZoomOut: number,
  viewportHeight: number,
): {
  panScreenDx: number;
  panScreenDy: number;
  panFactor: number;
  nextFrustum: number;
  yawDelta: number;
} {
  const panScreenDx = next.midX - prev.midX;
  const panScreenDy = next.midY - prev.midY;
  const panFactor = Math.max(
    currentFrustum * 0.0018,
    (currentFrustum / Math.max(260, viewportHeight)) * 1.3,
  );

  const distRatio = prev.dist > 10 && next.dist > 10 ? prev.dist / next.dist : 1;
  const clampedRatio = Math.max(0.75, Math.min(1.35, distRatio));
  const nextFrustum = Math.max(7.5, Math.min(maxZoomOut, currentFrustum * clampedRatio));

  const rawAngleDelta = normalizeAngleDelta(next.angle - prev.angle);
  const yawDelta = Math.abs(rawAngleDelta) < 0.65 ? rawAngleDelta : 0;

  return {
    panScreenDx,
    panScreenDy,
    panFactor,
    nextFrustum,
    yawDelta,
  };
}
