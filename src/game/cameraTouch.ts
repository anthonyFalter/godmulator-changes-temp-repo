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
 * - 2.5x when fully zoomed in (frustum <= 8.0)
 * - 1.0x when zoomed out (whole-map view on portrait mobile, maxZoomOut on landscape/desktop)
 * - Continuously scales through intermediate levels (2.5 -> 2.48 -> 2.xx -> ... -> 1.0)
 */
export function computeDynamicPixelScale(
  currentFrustum: number,
  gridSize: number,
  aspect: number,
  baseScale = 2.5,
  minScale = 1.0,
): number {
  const minFrustum = 8.0;
  const isPortrait = aspect > 0 && aspect < 1.0;
  const maxFrustum = isPortrait
    ? getResponsiveWholeMapFrustum(gridSize, aspect)
    : getResponsiveMaxZoomOut(gridSize, aspect);
  const span = Math.max(1, maxFrustum - minFrustum);
  const linearFactor = Math.max(0, Math.min(1, (currentFrustum - minFrustum) / span));
  // Portrait mobile has a much taller vertical frustum range; ease the curve so pinching
  // between close-up, village, and region views produces an immediate, visible shift in pixel size.
  const zoomFactor = isPortrait ? Math.pow(linearFactor, 0.72) : linearFactor;
  const raw = baseScale - zoomFactor * (baseScale - minScale);
  return Math.round(raw * 1000) / 1000;
}

const MAX_DYNAMIC_RENDER_PIXELS = 2_200_000;

/**
 * Computes the WebGL drawing buffer dimensions (rw, rh) from CSS viewport size,
 * current dynamic pixel scale, and devicePixelRatio.
 *
 * - On 1x DPR desktop: behaves identically to floor(w / scale) x floor(h / scale).
 * - On HiDPI mobile (DPR 2-3): keeps chunky retro pixel blocks when zoomed in (baseScale CSS px)
 *   and smoothly unlocks up to 2x HiDPI crispness when zoomed out (capped by GPU pixel budget),
 *   without prematurely clamping narrow phone widths at 160px.
 */
export function computeDynamicRenderDimensions(
  cssWidth: number,
  cssHeight: number,
  dynamicPixelScale: number,
  devicePixelRatio = 1,
  baseScale = 2.5,
  minScale = 1.0,
  isSoftwareGl = false,
  out?: { width: number; height: number },
): { width: number; height: number } {
  const safeW = Math.max(1, cssWidth);
  const safeH = Math.max(1, cssHeight);
  const clampedScale = Math.max(minScale, dynamicPixelScale || baseScale);

  const rawDpr = isSoftwareGl ? 1 : Math.max(1, Math.min(2, devicePixelRatio || 1));
  const cssArea = safeW * safeH;
  const budgetDpr = cssArea > 0 ? Math.sqrt(MAX_DYNAMIC_RENDER_PIXELS / cssArea) : 1;
  const effectiveDpr = Math.max(1, Math.min(rawDpr, budgetDpr));

  const scaleSpan = Math.max(0.001, baseScale - minScale);
  const zoomOutProgress = Math.max(0, Math.min(1, (baseScale - clampedScale) / scaleSpan));
  const dprBoost = 1 + (effectiveDpr - 1) * zoomOutProgress;
  const effectiveScale = clampedScale / dprBoost;

  const rw = Math.max(96, Math.floor(safeW / effectiveScale));
  const rh = Math.max(96, Math.floor(safeH / effectiveScale));

  if (out) {
    out.width = rw;
    out.height = rh;
    return out;
  }
  return { width: rw, height: rh };
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
