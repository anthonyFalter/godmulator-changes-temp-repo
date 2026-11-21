import * as THREE from 'three';

export interface BrushSizePreset {
  id: string;
  label: string;
  size: number;
  terrainRadius: number;
  powerScale: number;
  iconDiameter: number;
}

export const BRUSH_SIZE_PRESETS: BrushSizePreset[] = [
  { id: '0.5x', label: '0.5', size: 0.5, terrainRadius: 0, powerScale: 0.5, iconDiameter: 1 },
  { id: '1x', label: '1', size: 1, terrainRadius: 1, powerScale: 1.0, iconDiameter: 3 },
  { id: '2x', label: '2', size: 2, terrainRadius: 2, powerScale: 1.35, iconDiameter: 5 },
  { id: '3x', label: '3', size: 3, terrainRadius: 3, powerScale: 1.7, iconDiameter: 7 },
  { id: '5x', label: '5', size: 5, terrainRadius: 5, powerScale: 2.25, iconDiameter: 9 },
  { id: '7x', label: '7', size: 7, terrainRadius: 7, powerScale: 2.85, iconDiameter: 11 },
  { id: '10x', label: '10', size: 10, terrainRadius: 10, powerScale: 3.6, iconDiameter: 13 },
];

export const DEFAULT_BRUSH_SIZE = 1;

/**
 * Symmetric integer pixel-circle inclusion test used consistently by:
 * - Terrain tool brush masks
 * - Pixelated circle UI buttons
 * - 3D ground/water hover reticle
 */
export function isInsidePixelCircle(dx: number, dz: number, tileRadius: number): boolean {
  const r = Math.max(0, Math.floor(tileRadius));
  if (r === 0) return dx === 0 && dz === 0;
  const limit = r + 0.28;
  return dx * dx + dz * dz <= limit * limit;
}

/**
 * Returns the integer pixel coordinates for an odd-diameter pixelated circle
 * centered within a [0..diameter-1] x [0..diameter-1] grid.
 */
export function getPixelCircleCells(diameter: number): Array<{ x: number; y: number }> {
  const d = Math.max(1, Math.floor(diameter));
  const half = Math.floor(d / 2);
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      if (isInsidePixelCircle(x - half, y - half, half)) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

export function getBrushPreset(brushSize: number): BrushSizePreset {
  const exact = BRUSH_SIZE_PRESETS.find((p) => p.size === brushSize);
  if (exact) return exact;
  let best = BRUSH_SIZE_PRESETS[1];
  let bestDiff = Math.abs(best.size - brushSize);
  for (const p of BRUSH_SIZE_PRESETS) {
    const diff = Math.abs(p.size - brushSize);
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return best;
}

export function getTerrainTileRadius(brushSize: number): number {
  if (!Number.isFinite(brushSize) || brushSize <= 0.5) return 0;
  const preset = BRUSH_SIZE_PRESETS.find((p) => p.size === brushSize);
  if (preset) return preset.terrainRadius;
  return Math.max(0, Math.min(12, Math.round(brushSize)));
}

export function getPowerClusterCount(brushSize = DEFAULT_BRUSH_SIZE): number {
  if (!Number.isFinite(brushSize) || brushSize <= 1) return 1;
  return Math.max(1, Math.min(10, Math.round(brushSize)));
}

export function getPowerClusterSpreadRadius(baseRadius: number, brushSize = DEFAULT_BRUSH_SIZE): number {
  const count = getPowerClusterCount(brushSize);
  if (count <= 1) return 0;
  const safeBase = Math.max(1.0, baseRadius);
  return Math.min(16, Math.max(2.4, Math.sqrt(count) * Math.max(1.35, safeBase * 0.55)));
}

export function getPowerClusterTargets(
  count: number,
  baseRadius: number,
  centerX: number,
  centerZ: number,
  gridSize: number,
): Array<{ x: number; z: number }> {
  const safeCount = Math.max(1, Math.min(10, Math.round(count)));
  const clampCoord = (v: number) => Math.max(2, Math.min(gridSize - 3, Math.round(v)));
  const cx = clampCoord(centerX);
  const cz = clampCoord(centerZ);
  if (safeCount === 1) return [{ x: cx, z: cz }];

  const spread = getPowerClusterSpreadRadius(baseRadius, safeCount);
  const targets: Array<{ x: number; z: number }> = [{ x: cx, z: cz }];
  const goldenAngle = 2.399963229728653;
  const basePhase = (((cx * 73856093) ^ (cz * 19349663)) & 255) * 0.0245;

  for (let i = 1; i < safeCount; i++) {
    const frac = Math.sqrt(i / (safeCount - 1));
    const dist = Math.max(1.5, spread * frac);
    const angle = basePhase + i * goldenAngle;
    targets.push({
      x: clampCoord(cx + Math.cos(angle) * dist),
      z: clampCoord(cz + Math.sin(angle) * dist),
    });
  }
  return targets;
}

export function getPowerEffectiveRadius(baseRadius: number, brushSize = DEFAULT_BRUSH_SIZE): number {
  const safeBase = Math.max(0.5, baseRadius);
  const count = getPowerClusterCount(brushSize);
  if (count <= 1) return safeBase;
  return Math.min(28, Number((safeBase + getPowerClusterSpreadRadius(safeBase, count)).toFixed(2)));
}

const reticleTextureCache = new Map<number, THREE.CanvasTexture>();

/**
 * Generates a razor-sharp pixelated circle outline CanvasTexture (NearestFilter)
 * covering exactly (2 * tileRadius + 1) x (2 * tileRadius + 1) world tiles.
 * Rendered in white so reticleMat.color tints it dynamically per active tool/power.
 */
export function getPixelReticleTexture(tileRadius: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const r = Math.max(0, Math.min(28, Math.round(tileRadius)));
  const cached = reticleTextureCache.get(r);
  if (cached) return cached;

  const gridTiles = r * 2 + 1;
  const pxPerTile = r <= 4 ? 12 : r <= 10 ? 8 : 6;
  const size = gridTiles * pxPerTile;
  const borderW = Math.max(2, Math.round(pxPerTile * 0.28));

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // Fill every cell inside the exact pixelated circle mask & stroke crisp stepped outer edges
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (!isInsidePixelCircle(dx, dz, r)) continue;
      const px = (dx + r) * pxPerTile;
      const py = (dz + r) * pxPerTile;

      // Subtle translucent tile fill
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(px, py, pxPerTile, pxPerTile);

      // Subtle dark inner contrast outline along outer boundary so it reads on snow/sand/water
      const hasTop = isInsidePixelCircle(dx, dz - 1, r);
      const hasBottom = isInsidePixelCircle(dx, dz + 1, r);
      const hasLeft = isInsidePixelCircle(dx - 1, dz, r);
      const hasRight = isInsidePixelCircle(dx + 1, dz, r);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
      if (!hasTop) ctx.fillRect(px, py, pxPerTile, borderW);
      if (!hasBottom) ctx.fillRect(px, py + pxPerTile - borderW, pxPerTile, borderW);
      if (!hasLeft) ctx.fillRect(px, py, borderW, pxPerTile);
      if (!hasRight) ctx.fillRect(px + pxPerTile - borderW, py, borderW, pxPerTile);
    }
  }

  // Crisp center pip on larger circles so the exact aim tile is always unmistakable
  if (r >= 2) {
    const cx = r * pxPerTile + Math.floor(pxPerTile * 0.35);
    const cy = r * pxPerTile + Math.floor(pxPerTile * 0.35);
    const pip = Math.max(2, Math.ceil(pxPerTile * 0.3));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fillRect(cx, cy, pip, pip);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  reticleTextureCache.set(r, tex);
  return tex;
}

export function disposePixelReticleTextureCache(): void {
  for (const tex of reticleTextureCache.values()) {
    tex.dispose();
  }
  reticleTextureCache.clear();
}
