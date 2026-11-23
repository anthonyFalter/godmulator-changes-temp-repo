import * as THREE from 'three';
import { ResourceNodeType, TerrainType, TileData } from './types';

export const CHUNK_SIZE = 32;
export const TERRAIN_HEIGHT_STEP = 0.45;
export const TERRAIN_BOTTOM_Y = -0.6;

/**
 * Canonical terrain type -> numeric byte code mapping.
 * Matches `STYLED_TERRAIN_CODE` in `skyAndSea.ts` 1:1.
 */
export const TERRAIN_TO_CODE: Record<TerrainType, number> = {
  deep_water: 0,
  shallow_water: 1,
  sand: 2,
  grass: 3,
  fertile: 4,
  forest: 5,
  savanna: 6,
  swamp: 7,
  highland: 8,
  stone_road: 9,
  rock: 10,
  snow: 11,
  scorched: 12,
  crystal_field: 13,
  rail_track: 14,
  jungle: 15,
  mountain: 16,
  taiga: 17,
  tundra: 18,
  badlands: 19,
  blossom: 20,
  runway: 21,
  void_goo: 22,
  ice: 23,
  volcanic_wasteland: 24,
  blighted_mire: 25,
  floral_plains: 26,
};

export const RESOURCE_NODE_TO_CODE: Record<ResourceNodeType, number> = {
  none: 0,
  timber_grove: 1,
  berry_bush: 2,
  stone_outcrop: 3,
  ore_vein: 4,
  crystal_monolith: 5,
  coral_reef: 6,
  scrap_flotsam: 7,
  atlantis_ruin: 8,
  ancient_ruin: 9,
};

export interface WorldGridBuffers {
  gridSize: number;
  chunkSize: number;
  chunksPerSide: number;
  heightMap: Uint8Array;
  terrainCodeMap: Uint8Array;
  resourceNodeMap: Uint8Array;
  resourceAmountMap: Uint16Array;
  ownerMap: Uint16Array;
  crushedMask: Uint8Array;
  dirtyChunks: Uint8Array;
  dirtyChunkCount: number;
  activeFireTiles: Set<number>;
  /** Monotonic terrain mutation counter for invalidating cached flow fields & coarse graphs. */
  terrainVersion: number;
  /** Monotonic prop/resource mutation counter. */
  propVersion: number;
}

export function createWorldGridBuffers(
  gridSize: number,
  chunkSize = CHUNK_SIZE,
): WorldGridBuffers {
  const totalTiles = gridSize * gridSize;
  const chunksPerSide = Math.ceil(gridSize / chunkSize);
  const totalChunks = chunksPerSide * chunksPerSide;
  const dirtyChunks = new Uint8Array(totalChunks);
  dirtyChunks.fill(1);

  return {
    gridSize,
    chunkSize,
    chunksPerSide,
    heightMap: new Uint8Array(totalTiles),
    terrainCodeMap: new Uint8Array(totalTiles),
    resourceNodeMap: new Uint8Array(totalTiles),
    resourceAmountMap: new Uint16Array(totalTiles),
    ownerMap: new Uint16Array(totalTiles),
    crushedMask: new Uint8Array(totalTiles),
    dirtyChunks,
    dirtyChunkCount: totalChunks,
    activeFireTiles: new Set<number>(),
    terrainVersion: 1,
    propVersion: 1,
  };
}

/**
 * Computes exact surface top Y coordinate for a tile, matching IsometricWorldCanvas 1:1.
 */
export function getTileTopYFromCode(
  height: number,
  terrainCode: number,
  isCrushed = false,
): number {
  if (height <= 0) {
    // Water walkways (stone_road=9, rail_track=14, runway=21)
    if (terrainCode === 9 || terrainCode === 14 || terrainCode === 21) return 0.3;
    // Sea ice (ice=23)
    if (terrainCode === 23) return 0.21;
    // Submerged seabed
    return 0.12;
  }
  return height * TERRAIN_HEIGHT_STEP + 0.25 - (isCrushed ? 0.14 : 0);
}

/**
 * Returns true if a tile acts as submerged non-shadow-casting water/sea-ice seabed.
 */
export function isNonShadowTerrainCode(height: number, terrainCode: number): boolean {
  if (height > 0) return false;
  return terrainCode === 0 || terrainCode === 1 || terrainCode === 23;
}

export function markChunkDirty(grid: WorldGridBuffers, cx: number, cz: number): void {
  if (cx < 0 || cz < 0 || cx >= grid.chunksPerSide || cz >= grid.chunksPerSide) return;
  const idx = cz * grid.chunksPerSide + cx;
  if (grid.dirtyChunks[idx] === 0) {
    grid.dirtyChunks[idx] = 1;
    grid.dirtyChunkCount++;
  }
}

/**
 * Marks the owning chunk dirty, plus adjacent neighbor chunks if the tile lies on a
 * 1-tile chunk boundary (so exposed cliff walls stay 100% watertight across chunk seams).
 */
export function markTileDirty(grid: WorldGridBuffers, x: number, z: number): void {
  const cs = grid.chunkSize;
  const cx = Math.floor(x / cs);
  const cz = Math.floor(z / cs);
  markChunkDirty(grid, cx, cz);

  const lx = x - cx * cs;
  const lz = z - cz * cs;
  if (lx === 0) markChunkDirty(grid, cx - 1, cz);
  else if (lx === cs - 1) markChunkDirty(grid, cx + 1, cz);
  if (lz === 0) markChunkDirty(grid, cx, cz - 1);
  else if (lz === cs - 1) markChunkDirty(grid, cx, cz + 1);
}

export function markAllChunksDirty(grid: WorldGridBuffers): void {
  grid.dirtyChunks.fill(1);
  grid.dirtyChunkCount = grid.dirtyChunks.length;
}

/**
 * Populates flat TypedArrays from `SimulationState.tiles`.
 * O(N) single pass; also seeds `activeFireTiles`.
 */
export function syncWorldGridFromTiles(
  grid: WorldGridBuffers,
  tiles: TileData[],
  markAllDirty = true,
): void {
  const len = Math.min(tiles.length, grid.heightMap.length);
  const { heightMap, terrainCodeMap, resourceNodeMap, resourceAmountMap, crushedMask, activeFireTiles } =
    grid;
  activeFireTiles.clear();

  for (let i = 0; i < len; i++) {
    const t = tiles[i];
    heightMap[i] = t.height;
    terrainCodeMap[i] = TERRAIN_TO_CODE[t.terrain] ?? 3;
    resourceNodeMap[i] = RESOURCE_NODE_TO_CODE[t.resourceNode] ?? 0;
    resourceAmountMap[i] = t.resourceAmount > 65535 ? 65535 : Math.max(0, t.resourceAmount | 0);
    crushedMask[i] = t.height > 0 && (t.crushedTimer ?? 0) > 0 ? 1 : 0;
    if (t.onFireTimer > 0) {
      activeFireTiles.add(i);
    }
  }

  if (markAllDirty) {
    markAllChunksDirty(grid);
  }
  grid.terrainVersion++;
  grid.propVersion++;
}

/**
 * Incrementally syncs a single mutated tile into the flat TypedArrays and marks its
 * chunk (and border neighbor if applicable) dirty.
 */
export function syncTileToWorldGrid(grid: WorldGridBuffers, t: TileData): void {
  const idx = t.z * grid.gridSize + t.x;
  if (idx < 0 || idx >= grid.heightMap.length) return;

  const nextHeight = t.height;
  const nextCode = TERRAIN_TO_CODE[t.terrain] ?? 3;
  const nextNode = RESOURCE_NODE_TO_CODE[t.resourceNode] ?? 0;
  const nextAmount = t.resourceAmount > 65535 ? 65535 : Math.max(0, t.resourceAmount | 0);
  const nextCrushed = t.height > 0 && (t.crushedTimer ?? 0) > 0 ? 1 : 0;

  const terrainChanged =
    grid.heightMap[idx] !== nextHeight ||
    grid.terrainCodeMap[idx] !== nextCode ||
    grid.crushedMask[idx] !== nextCrushed;

  const propChanged =
    grid.resourceNodeMap[idx] !== nextNode || grid.resourceAmountMap[idx] !== nextAmount;

  grid.heightMap[idx] = nextHeight;
  grid.terrainCodeMap[idx] = nextCode;
  grid.resourceNodeMap[idx] = nextNode;
  grid.resourceAmountMap[idx] = nextAmount;
  grid.crushedMask[idx] = nextCrushed;

  if (t.onFireTimer > 0) {
    grid.activeFireTiles.add(idx);
  } else {
    grid.activeFireTiles.delete(idx);
  }

  if (terrainChanged) {
    markTileDirty(grid, t.x, t.z);
    grid.terrainVersion++;
  }
  if (propChanged || terrainChanged) {
    grid.propVersion++;
  }
}

export interface VoxelRayHit {
  x: number;
  z: number;
  tileIndex: number;
  hitY: number;
  t: number;
}

/**
 * Analytical 3D Amanatides–Woo DDA Voxel Column Raymarch against flat `WorldGridBuffers`.
 * Each tile `(x, z)` occupies X in `[x - 0.5, x + 0.5]`, Z in `[z - 0.5, z + 0.5]`,
 * and Y in `[TERRAIN_BOTTOM_Y, topY(x, z)]`.
 *
 * Complexity: O(gridSize) worst case (~512 cheap arithmetic steps, < 0.05 ms even on 512x512).
 * Zero allocations during traversal.
 */
export function raycastWorldGrid(
  ray: THREE.Ray,
  grid: WorldGridBuffers,
  yOverrides?: Float32Array | null,
): VoxelRayHit | null {
  const gs = grid.gridSize;
  const minX = -0.5;
  const maxX = gs - 0.5;
  const minZ = -0.5;
  const maxZ = gs - 0.5;
  const minY = TERRAIN_BOTTOM_Y;
  // Max possible terrain elevation (height 12 * 0.45 + 0.25 + tsunami headroom)
  const maxY = 12 * TERRAIN_HEIGHT_STEP + 2.5;

  const ox = ray.origin.x;
  const oy = ray.origin.y;
  const oz = ray.origin.z;
  const dx = ray.direction.x;
  const dy = ray.direction.y;
  const dz = ray.direction.z;

  // Slab intersection with world AABB
  let tMin = 0;
  let tMax = 1e9;

  if (Math.abs(dx) < 1e-8) {
    if (ox < minX || ox > maxX) return null;
  } else {
    const invX = 1 / dx;
    let t1 = (minX - ox) * invX;
    let t2 = (maxX - ox) * invX;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  if (Math.abs(dy) < 1e-8) {
    if (oy < minY || oy > maxY) return null;
  } else {
    const invY = 1 / dy;
    let t1 = (minY - oy) * invY;
    let t2 = (maxY - oy) * invY;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  if (Math.abs(dz) < 1e-8) {
    if (oz < minZ || oz > maxZ) return null;
  } else {
    const invZ = 1 / dz;
    let t1 = (minZ - oz) * invZ;
    let t2 = (maxZ - oz) * invZ;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  // Entry point slightly nudged into the world AABB
  let tCur = Math.max(0, tMin);
  const startX = ox + dx * (tCur + 1e-5);
  const startZ = oz + dz * (tCur + 1e-5);

  let cx = Math.floor(startX + 0.5);
  let cz = Math.floor(startZ + 0.5);
  if (cx < 0) cx = 0;
  else if (cx >= gs) cx = gs - 1;
  if (cz < 0) cz = 0;
  else if (cz >= gs) cz = gs - 1;

  const stepX = dx > 1e-8 ? 1 : dx < -1e-8 ? -1 : 0;
  const stepZ = dz > 1e-8 ? 1 : dz < -1e-8 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : 1e30;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : 1e30;

  let tMaxX = 1e30;
  if (stepX > 0) {
    tMaxX = (cx + 0.5 - ox) / dx;
  } else if (stepX < 0) {
    tMaxX = (cx - 0.5 - ox) / dx;
  }

  let tMaxZ = 1e30;
  if (stepZ > 0) {
    tMaxZ = (cz + 0.5 - oz) / dz;
  } else if (stepZ < 0) {
    tMaxZ = (cz - 0.5 - oz) / dz;
  }

  const { heightMap, terrainCodeMap, crushedMask } = grid;
  const maxSteps = gs * 3 + 4;

  for (let step = 0; step < maxSteps; step++) {
    const tExit = Math.min(tMaxX, tMaxZ, tMax);
    const tileIndex = cz * gs + cx;
    const topY =
      yOverrides && tileIndex < yOverrides.length
        ? yOverrides[tileIndex]
        : getTileTopYFromCode(
            heightMap[tileIndex],
            terrainCodeMap[tileIndex],
            crushedMask[tileIndex] !== 0,
          );

    const yEnter = oy + dy * tCur;
    const yExit = oy + dy * tExit;

    // Check if the ray intersects this tile's column [TERRAIN_BOTTOM_Y, topY] during [tCur, tExit]
    if (yEnter <= topY && yEnter >= minY) {
      // Entered through the side cliff face (or started inside the column)
      return { x: cx, z: cz, tileIndex, hitY: yEnter, t: tCur };
    }
    if (yEnter > topY && yExit <= topY && dy < -1e-8) {
      // Pierced the top face of the tile within this cell interval
      const tHit = (topY - oy) / dy;
      if (tHit >= tCur - 1e-4 && tHit <= tExit + 1e-4) {
        return { x: cx, z: cz, tileIndex, hitY: topY, t: tHit };
      }
    }

    if (tExit >= tMax) break;

    if (tMaxX < tMaxZ) {
      tCur = tMaxX;
      tMaxX += tDeltaX;
      cx += stepX;
      if (cx < 0 || cx >= gs) break;
    } else {
      tCur = tMaxZ;
      tMaxZ += tDeltaZ;
      cz += stepZ;
      if (cz < 0 || cz >= gs) break;
    }
  }

  return null;
}
