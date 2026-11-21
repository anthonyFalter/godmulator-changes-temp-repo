import * as THREE from 'three';

export interface WorldCullBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface AutoOptimizerDecisions {
  /** 0 = full fidelity, 1 = gentle crowd optimization, 2 = heavy crowd/zoom protection, 3 = extreme spike protection */
  tier: 0 | 1 | 2 | 3;
  /** Shadow map refresh cadence (1 = every frame, 2 = every 2nd, 3 = every 3rd, 4 = every 4th) */
  shadowUpdateStride: 1 | 2 | 3 | 4;
  /** Whether individual small humanoid units should cast directional shadow-map shadows (contact shadows always stay on) */
  unitCastShadows: boolean;
  /** Animation update stride for distant/crowded non-hero units (positions still interpolate at full 60Hz) */
  crowdAnimStride: 1 | 2 | 3;
  /** Cosmetic particle emission multiplier (0.35..1.0) */
  particleScale: number;
  /** Dynamic pixel-ratio multiplier during sustained heavy load (0.78..1.0) */
  pixelScaleMult: number;
  /** Safe simulation dt clamp so heavy frames never freeze camera responsiveness */
  maxSimDt: number;
  /** True when camera is zoomed out into continent/overview distance */
  isZoomedOut: boolean;
}

export class AutoOptimizer {
  private emaFrameMs = 16.7;
  private tier: 0 | 1 | 2 | 3 = 0;
  private cooldown = 2.0;
  private frameCounter = 0;

  public reset(): void {
    this.emaFrameMs = 16.7;
    this.tier = 0;
    this.cooldown = 2.0;
  }

  public getFrameCounter(): number {
    return this.frameCounter;
  }

  public getTier(): 0 | 1 | 2 | 3 {
    return this.tier;
  }

  public getEmaFrameMs(): number {
    return this.emaFrameMs;
  }

  /**
   * Advances the invisible adaptive governor using smoothed frame time, camera zoom level,
   * and visible entity density. Always keeps exact 3D models & exact simulation outcomes.
   */
  public update(params: {
    rawFrameMs: number;
    dt: number;
    frustumSize: number;
    visibleUnitCount: number;
    totalUnitCount: number;
    isPlaying: boolean;
    isSoftwareGl: boolean;
    autoEnabled: boolean;
    strictLossless?: boolean;
  }): AutoOptimizerDecisions {
    this.frameCounter = (this.frameCounter + 1) | 0;

    const {
      rawFrameMs,
      dt,
      frustumSize,
      visibleUnitCount,
      totalUnitCount,
      isPlaying,
      isSoftwareGl,
      autoEnabled,
      strictLossless = false,
    } = params;

    const isZoomedOut = frustumSize >= 28;
    const isFarOverview = frustumSize >= 44;

    if (strictLossless) {
      this.tier = 0;
      return {
        tier: 0,
        shadowUpdateStride: 1,
        unitCastShadows: !isSoftwareGl,
        crowdAnimStride: 1,
        particleScale: 1.0,
        pixelScaleMult: 1.0,
        maxSimDt: totalUnitCount > 450 ? 0.065 : 0.1,
        isZoomedOut,
      };
    }

    if (!isSoftwareGl && isPlaying && autoEnabled) {
      const clampedMs = Math.min(120, Math.max(4, rawFrameMs));
      this.emaFrameMs = this.emaFrameMs * 0.92 + clampedMs * 0.08;

      if (this.cooldown > 0) {
        this.cooldown = Math.max(0, this.cooldown - dt);
      } else {
        // Step up quickly if frame time degrades, step down conservatively with hysteresis so there is zero flicker
        if (this.emaFrameMs > 23.5 && this.tier < 1) {
          this.tier = 1;
          this.cooldown = 1.8;
        } else if (this.emaFrameMs > 28.5 && this.tier < 2) {
          this.tier = 2;
          this.cooldown = 2.0;
        } else if (this.emaFrameMs > 36.0 && this.tier < 3) {
          this.tier = 3;
          this.cooldown = 2.4;
        } else if (this.emaFrameMs < 16.5 && this.tier > 0) {
          this.tier = (this.tier - 1) as 0 | 1 | 2 | 3;
          this.cooldown = 3.5;
        }
      }
    } else if (!autoEnabled) {
      this.tier = 0;
    }

    // Shadow update cadence: imperceptibly relaxed when zoomed out or during dense crowd load
    let shadowUpdateStride: 1 | 2 | 3 | 4 = 1;
    if (this.tier >= 3 || (isFarOverview && visibleUnitCount > 140)) {
      shadowUpdateStride = 4;
    } else if (this.tier >= 2 || (isZoomedOut && visibleUnitCount > 160)) {
      shadowUpdateStride = 3;
    } else if (this.tier >= 1 || isZoomedOut || visibleUnitCount > 120) {
      shadowUpdateStride = 2;
    }

    const unitCastShadows =
      !isSoftwareGl &&
      frustumSize < 31 &&
      this.tier < 2 &&
      !(this.tier >= 1 && visibleUnitCount > 130) &&
      visibleUnitCount < 220;

    let crowdAnimStride: 1 | 2 | 3 = 1;
    if (this.tier >= 3 || (isFarOverview && visibleUnitCount > 180) || visibleUnitCount > 320) {
      crowdAnimStride = 3;
    } else if (this.tier >= 1 || (isZoomedOut && visibleUnitCount > 90) || visibleUnitCount > 160) {
      crowdAnimStride = 2;
    }

    let particleScale = 1.0;
    if (this.tier >= 3) particleScale = 0.35;
    else if (this.tier === 2 || isFarOverview) particleScale = 0.55;
    else if (this.tier === 1 || isZoomedOut || totalUnitCount > 260) particleScale = 0.78;

    const pixelScaleMult = this.tier >= 3 ? 0.8 : 1.0;
    const maxSimDt = totalUnitCount > 350 ? 0.065 : totalUnitCount > 200 ? 0.09 : 0.12;

    return {
      tier: this.tier,
      shadowUpdateStride,
      unitCastShadows,
      crowdAnimStride,
      particleScale,
      pixelScaleMult,
      maxSimDt,
      isZoomedOut,
    };
  }
}

// Reusable scratch vectors for zero-GC frustum ground projection
const _ndcCorners = [
  new THREE.Vector3(-1, -1, -1),
  new THREE.Vector3(1, -1, -1),
  new THREE.Vector3(-1, 1, -1),
  new THREE.Vector3(1, 1, -1),
];
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

/**
 * Projects the 4 corners of an orthographic isometric camera onto the world ground slab (y = 0 and y = maxElevation)
 * to produce an exact, generously padded world-space culling AABB with zero GC allocations.
 */
export function computeOrthoGroundCullBounds(
  camera: THREE.OrthographicCamera,
  gridSize: number,
  out: WorldCullBounds,
  padTiles = 5.5,
  maxElevation = 5.5,
): WorldCullBounds {
  camera.updateMatrixWorld();
  camera.getWorldDirection(_rayDir);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const dirY = _rayDir.y;
  if (Math.abs(dirY) < 1e-4) {
    out.minX = -padTiles;
    out.maxX = gridSize + padTiles;
    out.minZ = -padTiles;
    out.maxZ = gridSize + padTiles;
    return out;
  }

  for (let i = 0; i < 4; i++) {
    _rayOrigin.copy(_ndcCorners[i]).unproject(camera);

    // Intersect plane y = 0 (sea level)
    const t0 = -_rayOrigin.y / dirY;
    const x0 = _rayOrigin.x + _rayDir.x * t0;
    const z0 = _rayOrigin.z + _rayDir.z * t0;
    if (x0 < minX) minX = x0;
    if (x0 > maxX) maxX = x0;
    if (z0 < minZ) minZ = z0;
    if (z0 > maxZ) maxZ = z0;

    // Intersect plane y = maxElevation (mountain peaks / tall towers / flying units)
    const t1 = (maxElevation - _rayOrigin.y) / dirY;
    const x1 = _rayOrigin.x + _rayDir.x * t1;
    const z1 = _rayOrigin.z + _rayDir.z * t1;
    if (x1 < minX) minX = x1;
    if (x1 > maxX) maxX = x1;
    if (z1 < minZ) minZ = z1;
    if (z1 > maxZ) maxZ = z1;
  }

  out.minX = minX - padTiles;
  out.maxX = maxX + padTiles;
  out.minZ = minZ - padTiles;
  out.maxZ = maxZ + padTiles;
  return out;
}

/**
 * Computes tight, texel-snapped directional shadow camera bounds centered on the current viewport
 * target so shadow resolution is focused on visible ground with zero shadow crawling while panning.
 */
export function computeSnappedShadowBounds(
  targetX: number,
  targetZ: number,
  frustumSize: number,
  aspect: number,
  gridSize: number,
  shadowMapSize: number,
): { centerX: number; centerZ: number; halfExtent: number } {
  const maxWorldHalf = gridSize * 0.72 + 6;
  const visibleSpan = frustumSize * Math.max(1, aspect) * 0.78 + 6;
  const rawHalf = Math.max(15, Math.min(maxWorldHalf, visibleSpan));
  // Quantize half-extent to 4-unit steps so shadow projection matrix only updates meaningfully on zoom
  const halfExtent = Math.ceil(rawHalf / 4) * 4;
  // Texel-snap center in world space to prevent shadow edge shimmer when panning
  const texelWorldSize = (halfExtent * 2) / Math.max(256, shadowMapSize);
  const snapStep = Math.max(0.5, texelWorldSize * 4);
  const clampedX = Math.max(0, Math.min(gridSize - 1, targetX));
  const clampedZ = Math.max(0, Math.min(gridSize - 1, targetZ));
  const centerX = Math.round(clampedX / snapStep) * snapStep;
  const centerZ = Math.round(clampedZ / snapStep) * snapStep;
  return { centerX, centerZ, halfExtent };
}

/** Hysteresis buffer (tiles) outside spawn cull bounds before existing 3D objects are unrendered & disposed. */
export const DESPAWN_CULL_HYSTERESIS = 4.0;

/** Zero-GC point-in-AABB check against the padded camera ground cull bounds. */
export function isPointInCullBounds(
  x: number,
  z: number,
  bounds: WorldCullBounds,
  pad = 0,
): boolean {
  return (
    x >= bounds.minX - pad &&
    x <= bounds.maxX + pad &&
    z >= bounds.minZ - pad &&
    z <= bounds.maxZ + pad
  );
}

/** Zero-GC AABB-vs-AABB overlap test against camera ground cull bounds. */
export function isAabbIntersectingCullBounds(
  aMinX: number,
  aMaxX: number,
  aMinZ: number,
  aMaxZ: number,
  bounds: WorldCullBounds,
  pad = 0,
): boolean {
  return (
    aMaxX >= bounds.minX - pad &&
    aMinX <= bounds.maxX + pad &&
    aMaxZ >= bounds.minZ - pad &&
    aMinZ <= bounds.maxZ + pad
  );
}

/**
 * Exact zero-GC annulus/ring vs AABB overlap test.
 * Used for expanding tsunami wavefronts so off-screen waves stay unrendered until their crest crosses the viewport.
 */
export function isRingIntersectingCullBounds(
  cx: number,
  cz: number,
  innerRadius: number,
  outerRadius: number,
  bounds: WorldCullBounds,
  pad = 0,
): boolean {
  const bMinX = bounds.minX - pad;
  const bMaxX = bounds.maxX + pad;
  const bMinZ = bounds.minZ - pad;
  const bMaxZ = bounds.maxZ + pad;

  const nearX = cx < bMinX ? bMinX : cx > bMaxX ? bMaxX : cx;
  const nearZ = cz < bMinZ ? bMinZ : cz > bMaxZ ? bMaxZ : cz;
  const ndx = cx - nearX;
  const ndz = cz - nearZ;
  const rOut = Math.max(0, outerRadius);
  if (ndx * ndx + ndz * ndz > rOut * rOut) {
    return false;
  }

  if (innerRadius <= 0) {
    return true;
  }

  const fdx = Math.max(Math.abs(cx - bMinX), Math.abs(cx - bMaxX));
  const fdz = Math.max(Math.abs(cz - bMinZ), Math.abs(cz - bMaxZ));
  return fdx * fdx + fdz * fdz >= innerRadius * innerRadius;
}

/**
 * Zero-GC visibility check for lingering world hazards (tsunamis, quakes, mothership, tornadoes, storms, volcanoes, etc.).
 */
export function isHazardIntersectingCullBounds(
  haz: {
    kind: string;
    x: number;
    z: number;
    radius: number;
    currentRadius?: number;
    faultSegments?: ReadonlyArray<{ x1: number; z1: number; x2: number; z2: number; width?: number }>;
  },
  bounds: WorldCullBounds,
  pad = 0,
): boolean {
  if (haz.kind === 'tsunami_wave') {
    const curR = haz.currentRadius ?? haz.radius;
    const innerR = Math.max(0, curR * 0.65 - 2.5 - pad);
    const outerR = curR + 3.5 + pad;
    return isRingIntersectingCullBounds(haz.x, haz.z, innerR, outerR, bounds, 0);
  }

  if (haz.kind === 'earthquake_zone' && haz.faultSegments && haz.faultSegments.length > 0) {
    let minX = haz.x - 4;
    let maxX = haz.x + 4;
    let minZ = haz.z - 4;
    let maxZ = haz.z + 4;
    for (let i = 0; i < haz.faultSegments.length; i++) {
      const s = haz.faultSegments[i];
      const segPad = (s.width ?? 1) * 1.5 + 1.5;
      if (s.x1 - segPad < minX) minX = s.x1 - segPad;
      if (s.x2 - segPad < minX) minX = s.x2 - segPad;
      if (s.x1 + segPad > maxX) maxX = s.x1 + segPad;
      if (s.x2 + segPad > maxX) maxX = s.x2 + segPad;
      if (s.z1 - segPad < minZ) minZ = s.z1 - segPad;
      if (s.z2 - segPad < minZ) minZ = s.z2 - segPad;
      if (s.z1 + segPad > maxZ) maxZ = s.z1 + segPad;
      if (s.z2 + segPad > maxZ) maxZ = s.z2 + segPad;
    }
    return isAabbIntersectingCullBounds(minX, maxX, minZ, maxZ, bounds, pad);
  }

  if (haz.kind === 'alien_mothership') {
    return isPointInCullBounds(haz.x, haz.z, bounds, Math.max(36, haz.radius * 3) + pad);
  }

  const r = Math.max(2.5, (haz.radius || 4) * 1.45 + 2.0);
  return isPointInCullBounds(haz.x, haz.z, bounds, r + pad);
}

